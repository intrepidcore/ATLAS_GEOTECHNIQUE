#!/usr/bin/env python3
"""
Diagnostic final pour comprendre pourquoi les mailles 28km ne se créent pas
"""
import psycopg

DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def main():
    conn = psycopg.connect(DATABASE_URL)
    
    with conn.cursor() as cur:
        # Test 1: Compter les groupes 28km
        print("Test 1: Comptage des groupes 28km...")
        cur.execute("""
            WITH bounds AS (
                SELECT
                    MIN(ST_XMin(geom)) AS xmin,
                    MIN(ST_YMin(geom)) AS ymin
                FROM atlas.mailles
            ),
            grille_index AS (
                SELECT
                    FLOOR((ST_XMin(m.geom) - b.xmin) / 28000.0)::int AS col28,
                    FLOOR((ST_YMin(m.geom) - b.ymin) / 28000.0)::int AS row28
                FROM atlas.mailles m
                CROSS JOIN bounds b
            )
            SELECT COUNT(DISTINCT (row28, col28)) FROM grille_index;
        """)
        nb_groupes = cur.fetchone()[0]
        print(f"  → {nb_groupes} groupes distincts")
        
        # Test 2: Essayer de créer UN seul polygone 28km
        print("\nTest 2: Création d'UN polygone 28km de test...")
        cur.execute("""
            WITH bounds AS (
                SELECT
                    MIN(ST_XMin(geom)) AS xmin,
                    MIN(ST_YMin(geom)) AS ymin
                FROM atlas.mailles
            ),
            grille_index AS (
                SELECT
                    m.geom,
                    FLOOR((ST_XMin(m.geom) - b.xmin) / 28000.0)::int AS col28,
                    FLOOR((ST_YMin(m.geom) - b.ymin) / 28000.0)::int AS row28
                FROM atlas.mailles m
                CROSS JOIN bounds b
            )
            SELECT 
                row28, col28, COUNT(*) as nb_mailles,
                ST_AsText(ST_SetSRID(ST_Envelope(ST_Collect(geom)), 25231))
            FROM grille_index
            GROUP BY row28, col28
            LIMIT 1;
        """)
        row = cur.fetchone()
        if row:
            print(f"  → Groupe (row={row[0]}, col={row[1]}): {row[2]} mailles 2km")
            print(f"  → Géométrie créée: {row[3][:100]}...")
            
            # Insérer ce polygone dans maille_28km
            print("\nTest 3: Insertion dans atlas.maille_28km...")
            cur.execute("""
                TRUNCATE TABLE atlas.maille_28km CASCADE;
                
                WITH bounds AS (
                    SELECT
                        MIN(ST_XMin(geom)) AS xmin,
                        MIN(ST_YMin(geom)) AS ymin
                    FROM atlas.mailles
                ),
                grille_index AS (
                    SELECT
                        m.geom,
                        FLOOR((ST_XMin(m.geom) - b.xmin) / 28000.0)::int AS col28,
                        FLOOR((ST_YMin(m.geom) - b.ymin) / 28000.0)::int AS row28
                    FROM atlas.mailles m
                    CROSS JOIN bounds b
                )
                INSERT INTO atlas.maille_28km (geom)
                SELECT ST_SetSRID(ST_Envelope(ST_Collect(geom)), 25231)::geometry(Polygon, 25231)
                FROM grille_index
                GROUP BY row28, col28
                RETURNING id_m28;
            """)
            inserted = cur.fetchall()
            print(f"  → {len(inserted)} mailles 28km insérées")
            
            if len(inserted) > 0:
                # Mettre à jour les métadonnées
                cur.execute("""
                    WITH numbered AS (
                        SELECT id_m28, ROW_NUMBER() OVER (ORDER BY ST_YMin(geom), ST_XMin(geom)) as rn
                        FROM atlas.maille_28km
                    )
                    UPDATE atlas.maille_28km m
                    SET code_m28 = n.rn
                    FROM numbered n
                    WHERE m.id_m28 = n.id_m28;
                    
                    WITH bounds AS (
                        SELECT MIN(ST_YMin(geom)) AS ymin FROM atlas.maille_28km
                    ),
                    profil_calc AS (
                        SELECT
                            id_m28,
                            FLOOR((ST_YMin(geom) - b.ymin) / 28000.0)::int AS profil_row
                        FROM atlas.maille_28km m
                        CROSS JOIN bounds b
                    )
                    UPDATE atlas.maille_28km m
                    SET 
                        profil_num = p.profil_row + 1,
                        pk_min_km = 28.0 * p.profil_row,
                        pk_max_km = 28.0 * (p.profil_row + 1)
                    FROM profil_calc p
                    WHERE m.id_m28 = p.id_m28;
                """)
                conn.commit()
                
                # Vérifier
                cur.execute("SELECT code_m28, profil_num, pk_min_km, pk_max_km FROM atlas.maille_28km LIMIT 5;")
                print("\n✅ Mailles 28km créées avec succès:")
                for r in cur.fetchall():
                    print(f"  Code: {r[0]}, Profil: {r[1]}, PK: {r[2]:.1f}-{r[3]:.1f} km")
                
                cur.execute("SELECT COUNT(*) FROM atlas.v_maille_28km_kpi;")
                count_kpi = cur.fetchone()[0]
                print(f"\n✅ {count_kpi} features dans v_maille_28km_kpi")
        else:
            print("  ❌ Aucun groupe trouvé")
    
    conn.close()

if __name__ == "__main__":
    main()
