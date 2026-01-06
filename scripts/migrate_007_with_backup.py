#!/usr/bin/env python3
"""
Migration 007 avec backup intégré (sans pg_dump)
Sauvegarde les données critiques avant modification
"""

import psycopg2
from pathlib import Path
from datetime import datetime
import json

atlas_root = Path(__file__).parent.parent
migration_file = atlas_root / 'db' / 'migrations' / '007_enrichir_mailles_adm2_prefectures.sql'

config = {
    'host': 'localhost',
    'port': '5432',
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

print("=" * 70)
print("  MIGRATION 007 AVEC BACKUP INTÉGRÉ")
print("=" * 70)

# Créer le dossier de backup
backup_dir = atlas_root / 'backups'
backup_dir.mkdir(exist_ok=True)

timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
backup_file = backup_dir / f'mailles_backup_{timestamp}.json'

print(f"\n💾 ÉTAPE 1: Backup des données mailles")
print(f"   Fichier: {backup_file.name}")

try:
    conn = psycopg2.connect(**config)
    cursor = conn.cursor()
    
    # Vérifier si les colonnes pref_code/pref_name existent déjà
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'atlas' 
        AND table_name = 'mailles' 
        AND column_name IN ('pref_code', 'pref_name');
    """)
    
    existing_cols = [row[0] for row in cursor.fetchall()]
    
    if existing_cols:
        print(f"   ℹ️ Colonnes déjà présentes: {', '.join(existing_cols)}")
        print("   Sauvegarde des valeurs existantes...")
        
        # Backup des valeurs existantes
        cursor.execute("""
            SELECT 
                gid,
                pref_code,
                pref_name,
                ST_AsText(ST_Centroid(geom)) as centroid
            FROM atlas.mailles
            WHERE pref_code IS NOT NULL OR pref_name IS NOT NULL
            LIMIT 1000;
        """)
        
        backup_data = []
        for row in cursor.fetchall():
            backup_data.append({
                'gid': row[0],
                'pref_code': row[1],
                'pref_name': row[2],
                'centroid': row[3]
            })
        
        if backup_data:
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump({
                    'timestamp': timestamp,
                    'database': config['database'],
                    'table': 'atlas.mailles',
                    'columns': ['pref_code', 'pref_name'],
                    'count': len(backup_data),
                    'data': backup_data
                }, f, indent=2, ensure_ascii=False)
            
            print(f"   ✅ Backup créé: {len(backup_data)} mailles sauvegardées")
        else:
            print("   ℹ️ Aucune donnée à sauvegarder")
    else:
        print("   ℹ️ Colonnes non existantes, pas de backup nécessaire")
    
    cursor.close()
    conn.close()
    
except Exception as e:
    print(f"   ⚠️ Erreur backup: {e}")
    response = input("\n   Continuer quand même? (oui/non): ").strip().lower()
    if response not in ['oui', 'o', 'yes', 'y']:
        print("\n❌ Migration annulée")
        exit(0)

print(f"\n🔧 ÉTAPE 2: Exécution de la migration")

# Lire et filtrer le SQL
with open(migration_file, 'r', encoding='utf-8') as f:
    sql_lines = f.readlines()

filtered_lines = []
in_do_block = False
for line in sql_lines:
    if 'DO $$' in line or 'DO $' in line:
        in_do_block = True
    if '$$;' in line or '$;' in line:
        in_do_block = False
    
    if line.strip().startswith('RAISE NOTICE') and not in_do_block:
        continue
    
    filtered_lines.append(line)

sql_content = ''.join(filtered_lines)

try:
    conn = psycopg2.connect(**config)
    print(f"   ✅ Connecté à {config['database']}")
    
    cursor = conn.cursor()
    
    print("   Exécution du SQL...")
    cursor.execute(sql_content)
    conn.commit()
    
    print("   ✅ Migration exécutée!")
    
    # Vérifications
    print(f"\n🔍 ÉTAPE 3: Vérifications")
    
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(pref_name) as avec_pref,
          ROUND(COUNT(pref_name) * 100.0 / COUNT(*), 1) as pct
        FROM atlas.mailles;
    """)
    
    total, avec_pref, pct = cursor.fetchone()
    print(f"   Mailles totales: {total}")
    print(f"   Mailles avec préfecture: {avec_pref} ({pct}%)")
    
    if pct > 80:
        print(f"   ✅ Excellent rattachement!")
    elif pct > 50:
        print(f"   ⚠️ Rattachement partiel")
    else:
        print(f"   ⚠️ Rattachement faible - vérifier les géométries ADM2")
    
    # Vérifier les vues
    cursor.execute("""
        SELECT COUNT(*) 
        FROM information_schema.views 
        WHERE table_schema = 'atlas' 
        AND table_name IN ('v_pref_kpi', 'v_maille_kpi_pref');
    """)
    
    view_count = cursor.fetchone()[0]
    if view_count == 2:
        print(f"   ✅ Vues créées: v_pref_kpi, v_maille_kpi_pref")
    else:
        print(f"   ⚠️ Vues manquantes ({view_count}/2)")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ MIGRATION 007 TERMINÉE!")
    print("=" * 70)
    
    if backup_file.exists():
        print(f"\n💾 Backup disponible: {backup_file}")
        print("   Pour restaurer: voir le fichier JSON")
    
    print("\n📊 Prochaine étape:")
    print("   python scripts/generate_national_analysis.py")
    
except psycopg2.Error as e:
    print(f"\n❌ Erreur SQL: {e}")
    if conn:
        conn.rollback()
        conn.close()
    
    if backup_file.exists():
        print(f"\n💾 Backup disponible pour restauration: {backup_file}")
    
    exit(1)
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    
    if backup_file.exists():
        print(f"\n💾 Backup disponible: {backup_file}")
    
    exit(1)
