#!/usr/bin/env python3
"""
Exécution directe de la migration 007 sur la base atlas_clean
Avec dump de sauvegarde automatique
"""

import psycopg2
from pathlib import Path
from datetime import datetime
import subprocess
import os

atlas_root = Path(__file__).parent.parent
migration_file = atlas_root / 'db' / 'migrations' / '007_enrichir_mailles_adm2_prefectures.sql'

# Configuration qui fonctionne
config = {
    'host': 'localhost',
    'port': '5432',
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

print("=" * 70)
print("  EXÉCUTION MIGRATION 007 AVEC BACKUP")
print("=" * 70)

# Créer le dossier de backup
backup_dir = atlas_root / 'backups'
backup_dir.mkdir(exist_ok=True)

# Nom du fichier de backup avec timestamp
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = backup_dir / f'atlas_clean_before_migration_007_{timestamp}.sql'

print(f"\n💾 ÉTAPE 1: Backup de la base de données")
print(f"   Fichier: {backup_file.name}")

# Commande pg_dump
pg_dump_cmd = [
    'pg_dump',
    '-h', config['host'],
    '-p', config['port'],
    '-U', config['user'],
    '-d', config['database'],
    '--schema=atlas',
    '--schema=public',
    '-f', str(backup_file)
]

env = os.environ.copy()
env['PGPASSWORD'] = config['password']

try:
    print("   Exécution pg_dump...")
    result = subprocess.run(
        pg_dump_cmd,
        env=env,
        capture_output=True,
        text=True,
        timeout=300  # 5 minutes max
    )
    
    if result.returncode == 0:
        size_mb = backup_file.stat().st_size / (1024 * 1024)
        print(f"   ✅ Backup créé: {size_mb:.2f} MB")
    else:
        print(f"   ⚠️ pg_dump non disponible, backup ignoré")
        print(f"   Erreur: {result.stderr[:200]}")
        
        # Demander confirmation pour continuer sans backup
        response = input("\n   Continuer sans backup? (oui/non): ").strip().lower()
        if response not in ['oui', 'o', 'yes', 'y']:
            print("\n❌ Migration annulée par l'utilisateur")
            exit(0)
            
except FileNotFoundError:
    print("   ⚠️ pg_dump non trouvé dans le PATH")
    print("   💡 Le backup sera ignoré, mais la migration continuera")
    
    # Demander confirmation
    response = input("\n   Continuer sans backup? (oui/non): ").strip().lower()
    if response not in ['oui', 'o', 'yes', 'y']:
        print("\n❌ Migration annulée par l'utilisateur")
        exit(0)
        
except Exception as e:
    print(f"   ⚠️ Erreur backup: {e}")
    response = input("\n   Continuer sans backup? (oui/non): ").strip().lower()
    if response not in ['oui', 'o', 'yes', 'y']:
        print("\n❌ Migration annulée par l'utilisateur")
        exit(0)

print(f"\n🔧 ÉTAPE 2: Exécution de la migration")

with open(migration_file, 'r', encoding='utf-8') as f:
    sql_lines = f.readlines()

# Filtrer les lignes RAISE NOTICE qui sont en dehors des blocs DO $$
filtered_lines = []
in_do_block = False
for line in sql_lines:
    if 'DO $$' in line or 'DO $' in line:
        in_do_block = True
    if '$$;' in line or '$;' in line:
        in_do_block = False
    
    # Garder les RAISE NOTICE seulement dans les blocs DO
    if line.strip().startswith('RAISE NOTICE') and not in_do_block:
        continue
    
    filtered_lines.append(line)

sql_content = ''.join(filtered_lines)

try:
    conn = psycopg2.connect(**config)
    print(f"✅ Connecté à {config['database']}")
    
    cursor = conn.cursor()
    
    print("\n🔧 Exécution de la migration...")
    cursor.execute(sql_content)
    conn.commit()
    
    print("✅ Migration exécutée!")
    
    # Vérifications
    print("\n🔍 Vérifications:")
    
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(pref_name) as avec_pref,
          ROUND(COUNT(pref_name) * 100.0 / COUNT(*), 1) as pct
        FROM atlas.mailles;
    """)
    
    total, avec_pref, pct = cursor.fetchone()
    print(f"  Mailles totales: {total}")
    print(f"  Mailles avec préfecture: {avec_pref} ({pct}%)")
    
    cursor.close()
    conn.close()
    
    print("\n✅ TERMINÉ!")
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
