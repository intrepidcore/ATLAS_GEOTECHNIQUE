#!/usr/bin/env python3
"""
Script pour exécuter la migration 007 - Enrichissement ADM2
Détecte automatiquement les credentials DB depuis .env ou variables d'environnement
Utilise psycopg2 directement (pas besoin de psql)
"""

import os
import sys
from pathlib import Path
import psycopg2

# Chercher le fichier .env
atlas_root = Path(__file__).parent.parent
env_file = atlas_root / '.env'

print("=" * 70)
print("  MIGRATION 007 - ENRICHISSEMENT ADM2")
print("=" * 70)

# Essayer de charger les variables depuis .env
db_config = {
    'host': 'localhost',
    'port': '5432',
    'database': 'atlas_geotechnique',
    'user': 'postgres',
    'password': 'postgres'
}

if env_file.exists():
    print(f"\n📄 Lecture {env_file}")
    with open(env_file, 'r') as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith('#'):
                continue
            if '=' in line:
                key, value = line.split('=', 1)
                key = key.strip()
                value = value.strip()
                
                if key == 'POSTGRES_USER':
                    db_config['user'] = value
                elif key == 'POSTGRES_PASSWORD':
                    db_config['password'] = value
                elif key == 'POSTGRES_DB':
                    db_config['database'] = value
                elif key == 'DATABASE_URL':
                    # Parser postgres://user:pass@host:port/db
                    if value.startswith('postgres://'):
                        try:
                            # Extraire user:pass
                            auth_part = value.split('//')[1].split('@')[0]
                            if ':' in auth_part:
                                db_config['user'], db_config['password'] = auth_part.split(':', 1)
                            
                            # Extraire host:port/db
                            host_part = value.split('@')[1]
                            if '/' in host_part:
                                host_port, db = host_part.split('/', 1)
                                if ':' in host_port:
                                    db_config['host'], db_config['port'] = host_port.split(':', 1)
                                else:
                                    db_config['host'] = host_port
                                db_config['database'] = db
                        except:
                            pass

# Override avec variables d'environnement si présentes
for key in ['host', 'port', 'database', 'user', 'password']:
    env_key = f'DB_{key.upper()}' if key != 'database' else 'DB_NAME'
    if os.getenv(env_key):
        db_config[key] = os.getenv(env_key)

print(f"\n🔧 Configuration DB:")
print(f"  Host: {db_config['host']}")
print(f"  Port: {db_config['port']}")
print(f"  Database: {db_config['database']}")
print(f"  User: {db_config['user']}")
print(f"  Password: {'*' * len(db_config['password'])}")

# Chemin vers la migration
migration_file = atlas_root / 'db' / 'migrations' / '007_enrichir_mailles_adm2_prefectures.sql'

if not migration_file.exists():
    print(f"\n❌ Fichier migration introuvable: {migration_file}")
    sys.exit(1)

print(f"\n📂 Migration: {migration_file}")

# Lire le contenu SQL
with open(migration_file, 'r', encoding='utf-8') as f:
    sql_content = f.read()

print(f"\n🚀 Connexion à la base de données...")
print(f"   Host: {db_config['host']}:{db_config['port']}")
print(f"   Database: {db_config['database']}")
print(f"   User: {db_config['user']}")

try:
    # Connexion à la base
    conn = psycopg2.connect(
        host=db_config['host'],
        port=db_config['port'],
        database=db_config['database'],
        user=db_config['user'],
        password=db_config['password']
    )
    
    print("✅ Connexion établie")
    
    # Exécuter la migration
    print(f"\n🔧 Exécution de la migration SQL...")
    cursor = conn.cursor()
    
    # Exécuter le SQL (peut contenir plusieurs statements)
    cursor.execute(sql_content)
    conn.commit()
    
    print("✅ Migration exécutée avec succès!")
    
    # Vérification post-migration
    print("\n🔍 Vérification post-migration...")
    
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(adm2_name) as avec_adm2,
          ROUND(COUNT(adm2_name) * 100.0 / COUNT(*), 1) as pct_couverture
        FROM atlas.mailles_with_data
        WHERE n_sondages > 0;
    """)
    
    result = cursor.fetchone()
    if result:
        total, avec_adm2, pct = result
        print(f"\n📊 Résultats:")
        print(f"  Total mailles actives: {total}")
        print(f"  Mailles avec ADM2: {avec_adm2}")
        print(f"  Couverture ADM2: {pct}%")
        
        if pct < 10:
            print(f"\n⚠️ WARNING: Couverture ADM2 très faible ({pct}%)")
            print("   Les graphes d'analyse seront dominés par 'Non classé'")
        elif pct < 90:
            print(f"\n⚠️ INFO: Couverture ADM2 partielle ({pct}%)")
        else:
            print(f"\n✅ Couverture ADM2 excellente ({pct}%)")
    
    # Vérifier que la vue v_pref_kpi existe
    cursor.execute("""
        SELECT COUNT(*) 
        FROM information_schema.views 
        WHERE table_schema = 'atlas' 
        AND table_name = 'v_pref_kpi';
    """)
    
    view_exists = cursor.fetchone()[0]
    if view_exists:
        cursor.execute("SELECT COUNT(*) FROM atlas.v_pref_kpi;")
        pref_count = cursor.fetchone()[0]
        print(f"\n✅ Vue v_pref_kpi créée: {pref_count} préfectures")
    else:
        print(f"\n⚠️ Vue v_pref_kpi non trouvée")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ Migration 007 terminée avec succès!")
    print("=" * 70)
    print("\nProchaine étape:")
    print("  python scripts/generate_national_analysis.py")
    
except psycopg2.OperationalError as e:
    print(f"\n❌ Erreur de connexion: {e}")
    print("\n💡 Solutions:")
    print("  1. Vérifier que PostgreSQL est démarré")
    print("  2. Vérifier les credentials dans .env")
    print("  3. Si host='db', essayer host='localhost' ou '127.0.0.1'")
    print("\n🔧 Configuration actuelle:")
    print(f"  Host: {db_config['host']}")
    print(f"  Port: {db_config['port']}")
    print(f"  Database: {db_config['database']}")
    print(f"  User: {db_config['user']}")
    sys.exit(1)
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
