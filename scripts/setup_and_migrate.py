#!/usr/bin/env python3
"""
Script intelligent pour exécuter la migration 007
Teste automatiquement différentes configurations de connexion
"""

import os
import sys
from pathlib import Path
import psycopg2

atlas_root = Path(__file__).parent.parent

print("=" * 70)
print("  SETUP & MIGRATION 007 - ENRICHISSEMENT ADM2")
print("=" * 70)

# Configurations à tester (par ordre de priorité)
configs_to_try = [
    {
        'name': 'Docker (atlas/atlas)',
        'host': 'localhost',
        'port': '5432',
        'database': 'atlas_clean',
        'user': 'atlas',
        'password': 'atlas'
    },
    {
        'name': 'Local (postgres/postgres)',
        'host': 'localhost',
        'port': '5432',
        'database': 'atlas_geotechnique',
        'user': 'postgres',
        'password': 'postgres'
    },
    {
        'name': 'Docker host db',
        'host': 'db',
        'port': '5432',
        'database': 'atlas_clean',
        'user': 'atlas',
        'password': 'atlas'
    }
]

# Chemin vers la migration
migration_file = atlas_root / 'db' / 'migrations' / '007_enrichir_mailles_adm2_prefectures.sql'

if not migration_file.exists():
    print(f"\n❌ Fichier migration introuvable: {migration_file}")
    sys.exit(1)

print(f"\n📂 Migration: {migration_file.name}")

# Lire le contenu SQL
with open(migration_file, 'r', encoding='utf-8') as f:
    sql_content = f.read()

print(f"\n🔍 Test des configurations de connexion...")

conn = None
working_config = None

for config in configs_to_try:
    print(f"\n  Essai: {config['name']}")
    print(f"    → {config['user']}@{config['host']}:{config['port']}/{config['database']}")
    
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password'],
            connect_timeout=3
        )
        working_config = config
        print(f"    ✅ Connexion réussie!")
        break
    except psycopg2.OperationalError as e:
        print(f"    ❌ Échec: {str(e)[:80]}...")
        continue
    except Exception as e:
        print(f"    ❌ Erreur: {str(e)[:80]}...")
        continue

if not conn:
    print("\n" + "=" * 70)
    print("❌ AUCUNE CONFIGURATION DE CONNEXION NE FONCTIONNE")
    print("=" * 70)
    print("\n💡 Solutions:")
    print("  1. Démarrer PostgreSQL:")
    print("     - Windows: Services → PostgreSQL")
    print("     - Docker: docker-compose up -d db")
    print("  2. Vérifier les credentials dans .env")
    print("  3. Créer la base manuellement:")
    print("     createdb -U postgres atlas_geotechnique")
    sys.exit(1)

print("\n" + "=" * 70)
print(f"✅ CONNEXION ÉTABLIE: {working_config['name']}")
print("=" * 70)

try:
    cursor = conn.cursor()
    
    # Vérifier si le schéma atlas existe
    cursor.execute("""
        SELECT schema_name 
        FROM information_schema.schemata 
        WHERE schema_name = 'atlas';
    """)
    
    if not cursor.fetchone():
        print("\n⚠️ Schéma 'atlas' non trouvé - création...")
        cursor.execute("CREATE SCHEMA IF NOT EXISTS atlas;")
        conn.commit()
        print("✅ Schéma 'atlas' créé")
    
    # Vérifier si la table mailles_with_data existe
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'atlas' 
        AND table_name = 'mailles_with_data';
    """)
    
    if not cursor.fetchone():
        print("\n⚠️ Table 'atlas.mailles_with_data' non trouvée")
        print("   La migration nécessite que cette table existe.")
        print("\n💡 Actions requises:")
        print("  1. Exécuter les migrations précédentes (001-006)")
        print("  2. Vérifier que les données sont chargées")
        cursor.close()
        conn.close()
        sys.exit(1)
    
    print("\n🔧 Exécution de la migration SQL...")
    print("   (Cela peut prendre quelques secondes...)")
    
    # Exécuter la migration
    cursor.execute(sql_content)
    conn.commit()
    
    print("✅ Migration exécutée avec succès!")
    
    # Vérifications post-migration
    print("\n🔍 Vérifications post-migration...")
    
    # 1. Couverture ADM2
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(adm2_name) as avec_adm2,
          ROUND(COUNT(adm2_name) * 100.0 / NULLIF(COUNT(*), 0), 1) as pct_couverture
        FROM atlas.mailles_with_data
        WHERE n_sondages > 0;
    """)
    
    result = cursor.fetchone()
    if result and result[0] > 0:
        total, avec_adm2, pct = result
        print(f"\n📊 Couverture ADM2:")
        print(f"  Total mailles actives: {total}")
        print(f"  Mailles avec ADM2: {avec_adm2}")
        print(f"  Couverture: {pct}%")
        
        if pct < 10:
            print(f"\n⚠️ WARNING: Couverture ADM2 très faible ({pct}%)")
            print("   Les graphes seront dominés par 'Non classé'")
        elif pct < 90:
            print(f"\n⚠️ INFO: Couverture ADM2 partielle ({pct}%)")
        else:
            print(f"\n✅ Couverture ADM2 excellente!")
    else:
        print("\n⚠️ Aucune maille active trouvée (n_sondages > 0)")
    
    # 2. Vue v_pref_kpi
    cursor.execute("""
        SELECT COUNT(*) 
        FROM information_schema.views 
        WHERE table_schema = 'atlas' 
        AND table_name = 'v_pref_kpi';
    """)
    
    if cursor.fetchone()[0]:
        cursor.execute("SELECT COUNT(*) FROM atlas.v_pref_kpi;")
        pref_count = cursor.fetchone()[0]
        print(f"\n✅ Vue v_pref_kpi: {pref_count} préfectures")
    else:
        print(f"\n⚠️ Vue v_pref_kpi non créée")
    
    # 3. Vue v_maille_kpi_pref
    cursor.execute("""
        SELECT COUNT(*) 
        FROM information_schema.views 
        WHERE table_schema = 'atlas' 
        AND table_name = 'v_maille_kpi_pref';
    """)
    
    if cursor.fetchone()[0]:
        cursor.execute("SELECT COUNT(*) FROM atlas.v_maille_kpi_pref;")
        maille_count = cursor.fetchone()[0]
        print(f"✅ Vue v_maille_kpi_pref: {maille_count} mailles")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ MIGRATION 007 TERMINÉE AVEC SUCCÈS!")
    print("=" * 70)
    print("\n📊 Prochaine étape:")
    print("  python scripts/generate_national_analysis.py")
    print("\n💡 Configuration DB à utiliser:")
    print(f"  Host: {working_config['host']}")
    print(f"  Port: {working_config['port']}")
    print(f"  Database: {working_config['database']}")
    print(f"  User: {working_config['user']}")
    
except psycopg2.Error as e:
    print(f"\n❌ Erreur SQL: {e}")
    if conn:
        conn.rollback()
        conn.close()
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    if conn:
        conn.close()
    sys.exit(1)
