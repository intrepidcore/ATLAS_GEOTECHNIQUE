#!/usr/bin/env python3
"""Test de connexion PostgreSQL simple"""

import psycopg

dsn = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

print("Test de connexion PostgreSQL...")
print(f"DSN: {dsn}")
print()

try:
    with psycopg.connect(dsn) as conn:
        with conn.cursor() as cur:
            # Test 1: Version PostgreSQL
            cur.execute("SELECT version()")
            version = cur.fetchone()[0]
            print(f"✓ Connexion réussie !")
            print(f"  PostgreSQL: {version.split(',')[0]}")
            
            # Test 2: Compteurs de tables
            print()
            print("Compteurs de tables:")
            
            tables = ['sondages', 'echantillons', 'essais_atterberg', 'essais_vbs', 
                     'raw_lab_agt', 'raw_lab_ags', 'raw_lab_atterberg']
            
            for table in tables:
                try:
                    cur.execute(f"SELECT COUNT(*) FROM {table}")
                    count = cur.fetchone()[0]
                    print(f"  - {table}: {count} lignes")
                except Exception as e:
                    print(f"  - {table}: Table n'existe pas ou erreur")
            
            # Test 3: Vues spread
            print()
            print("Vues spread:")
            cur.execute("""
                SELECT table_name 
                FROM information_schema.tables 
                WHERE table_name IN ('v_sondages_spread', 'mv_mailles_geotech', 'mailles_geotechnique_stats')
                ORDER BY table_name
            """)
            vues = cur.fetchall()
            if vues:
                for vue in vues:
                    print(f"  ✓ {vue[0]}")
            else:
                print("  ✗ Aucune vue spread trouvée")
                print("  → Exécuter: psql -U atlas -d atlas_clean -f create_spread_views.sql")
            
            print()
            print("="*60)
            print("✓ Base de données accessible et prête !")
            print("="*60)
            
except psycopg.OperationalError as e:
    print(f"✗ Erreur de connexion: {e}")
    print()
    print("Solutions possibles:")
    print("  1. Vérifier que PostgreSQL est démarré")
    print("  2. Vérifier les credentials (user: atlas, password: atlas)")
    print("  3. Vérifier que la base 'atlas_clean' existe")
    print("  4. Vérifier le port (5432)")
except Exception as e:
    print(f"✗ Erreur: {e}")
