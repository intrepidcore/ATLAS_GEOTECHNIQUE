#!/usr/bin/env python3
"""
Script pour débugger la génération des mailles 28km
"""
import psycopg
import sys

DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def main():
    print("Connexion à la base de données...")
    
    try:
        conn = psycopg.connect(DATABASE_URL)
        print("✅ Connecté\n")
        
        with conn.cursor() as cur:
            # Vérifier les bounds des mailles 2km
            print("Analyse des mailles 2km...")
            cur.execute("""
                SELECT 
                    COUNT(*) as total,
                    MIN(ST_XMin(geom)) as xmin,
                    MIN(ST_YMin(geom)) as ymin,
                    MAX(ST_XMax(geom)) as xmax,
                    MAX(ST_YMax(geom)) as ymax,
                    ST_SRID(geom) as srid
                FROM atlas.mailles
                LIMIT 1;
            """)
            row = cur.fetchone()
            print(f"  Total mailles 2km: {row[0]}")
            print(f"  SRID: {row[5]}")
            print(f"  Bounds: X[{row[1]:.0f}, {row[3]:.0f}], Y[{row[2]:.0f}, {row[4]:.0f}]")
            
            # Tester la génération des indices 28km
            print("\nTest de génération des indices 28km...")
            cur.execute("""
                WITH bounds AS (
                    SELECT
                        MIN(ST_XMin(geom)) AS xmin,
                        MIN(ST_YMin(geom)) AS ymin
                    FROM atlas.mailles
                ),
                grille_index AS (
                    SELECT
                        m.id,
                        FLOOR((ST_XMin(m.geom) - b.xmin) / 28000.0)::int AS col28,
                        FLOOR((ST_YMin(m.geom) - b.ymin) / 28000.0)::int AS row28
                    FROM atlas.mailles m
                    CROSS JOIN bounds b
                    LIMIT 10
                )
                SELECT col28, row28, COUNT(*) 
                FROM grille_index 
                GROUP BY col28, row28
                ORDER BY row28, col28;
            """)
            print("  Exemples d'indices (col28, row28):")
            for row in cur.fetchall():
                print(f"    Col {row[0]}, Row {row[1]}: {row[2]} mailles")
            
            # Compter les groupes 28km potentiels
            print("\nComptage des groupes 28km potentiels...")
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
                SELECT COUNT(DISTINCT (row28, col28)) as nb_groupes_28km
                FROM grille_index;
            """)
            nb_groupes = cur.fetchone()[0]
            print(f"  → {nb_groupes} groupes 28km distincts détectés")
            
            # Tester la création des polygones 28km
            print("\nTest de création des polygones 28km...")
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
                ),
                mailles_28km_brut AS (
                    SELECT
                        row28,
                        col28,
                        ST_SetSRID(ST_Envelope(ST_Collect(geom)), 25231) AS geom
                    FROM grille_index
                    GROUP BY row28, col28
                )
                SELECT COUNT(*) FROM mailles_28km_brut;
            """)
            nb_poly = cur.fetchone()[0]
            print(f"  → {nb_poly} polygones 28km créés avant filtrage")
            
            # Vérifier le filtrage par adm0_raw
            print("\nTest du filtrage par frontière Togo...")
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
                ),
                mailles_28km_brut AS (
                    SELECT
                        row28,
                        col28,
                        ST_SetSRID(ST_Envelope(ST_Collect(geom)), 25231) AS geom
                    FROM grille_index
                    GROUP BY row28, col28
                )
                SELECT COUNT(*)
                FROM mailles_28km_brut m
                CROSS JOIN public.adm0_raw t
                WHERE ST_Intersects(m.geom, ST_Transform(t.geom, 25231));
            """)
            nb_filtered = cur.fetchone()[0]
            print(f"  → {nb_filtered} polygones 28km intersectent le Togo")
            
            # Vérifier le SRID de adm0_raw
            cur.execute("SELECT ST_SRID(geom) FROM public.adm0_raw LIMIT 1;")
            srid_adm0 = cur.fetchone()[0]
            print(f"  → SRID de public.adm0_raw: {srid_adm0}")
            
            if nb_filtered > 0:
                print(f"\n✅ La génération devrait créer {nb_filtered} mailles 28km")
                print("   Le problème vient probablement de la transaction ou du DELETE")
            else:
                print("\n❌ Aucune maille 28km n'intersecte le Togo après transformation")
                print("   Problème de SRID ou de géométrie")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
