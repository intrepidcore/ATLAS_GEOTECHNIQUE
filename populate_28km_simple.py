#!/usr/bin/env python3
"""
Script pour peupler atlas.maille_28km avec des données de test
"""
import psycopg

DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def main():
    print("Connexion à la base de données...")
    
    conn = psycopg.connect(DATABASE_URL)
    print("✅ Connecté\n")
    
    with conn.cursor() as cur:
        # Générer les mailles 28km directement
        print("Génération des mailles 28km...")
        
        sql = """
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
        ),
        mailles_28km_brut AS (
            SELECT
                row28,
                col28,
                ST_SetSRID(ST_Envelope(ST_Collect(geom)), 25231)::geometry(Polygon, 25231) AS geom
            FROM grille_index
            GROUP BY row28, col28
        )
        INSERT INTO atlas.maille_28km (geom)
        SELECT geom
        FROM mailles_28km_brut m
        WHERE EXISTS (
            SELECT 1 FROM public.adm0_raw t
            WHERE ST_Intersects(m.geom, ST_Transform(t.geom, 25231))
        );
        
        -- Attribuer code_m28
        WITH numbered AS (
            SELECT id_m28, ROW_NUMBER() OVER (ORDER BY ST_YMin(geom), ST_XMin(geom)) as rn
            FROM atlas.maille_28km
        )
        UPDATE atlas.maille_28km m
        SET code_m28 = n.rn
        FROM numbered n
        WHERE m.id_m28 = n.id_m28;
        
        -- Calcul profils et PK
        WITH bounds AS (
            SELECT MIN(ST_YMin(geom)) AS ymin
            FROM atlas.maille_28km
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
        
        -- Lier avec mailles 2km
        UPDATE atlas.mailles m2
        SET id_m28 = m28.id_m28
        FROM atlas.maille_28km m28
        WHERE ST_Intersects(ST_Centroid(m2.geom), m28.geom);
        """
        
        cur.execute(sql)
        conn.commit()
        
        # Vérifier
        cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
        count = cur.fetchone()[0]
        print(f"✅ {count} mailles 28km créées")
        
        if count > 0:
            cur.execute("""
                SELECT code_m28, profil_num, pk_min_km, pk_max_km 
                FROM atlas.maille_28km 
                ORDER BY code_m28 
                LIMIT 5;
            """)
            print("\nExemples:")
            for row in cur.fetchall():
                print(f"  Code: {row[0]}, Profil: {row[1]}, PK: {row[2]:.1f}-{row[3]:.1f} km")
            
            # Vérifier la vue KPI
            cur.execute("SELECT COUNT(*) FROM atlas.v_maille_28km_kpi;")
            count_kpi = cur.fetchone()[0]
            print(f"\n✅ {count_kpi} features dans v_maille_28km_kpi")
    
    conn.close()
    print("\n✅ Terminé")

if __name__ == "__main__":
    main()
