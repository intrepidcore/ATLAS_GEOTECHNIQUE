#!/usr/bin/env python3
"""
Import COMPLET du backup atlas_export.xlsx
Importe TOUTES les feuilles et TOUTES les colonnes
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import sys
from datetime import datetime

# Configuration DB
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def import_sheet(conn, sheet_name, df):
    """Importe une feuille complète dans PostgreSQL"""
    
    # Extraire le nom de la table (enlever "public.")
    table_name = sheet_name.replace('public.', '')
    
    print(f"\n📥 Import de {sheet_name} ({len(df)} lignes)...")
    
    if len(df) == 0:
        print(f"  ⏭️  Feuille vide, ignorée")
        return
    
    # Remplacer NaN par None
    df = df.where(pd.notnull(df), None)
    
    cur = conn.cursor()
    
    # Préparer les colonnes
    columns = list(df.columns)
    placeholders = ', '.join(['%s'] * len(columns))
    columns_str = ', '.join([f'"{col}"' for col in columns])
    
    # Requête INSERT
    insert_query = f"""
        INSERT INTO {table_name} ({columns_str})
        VALUES ({placeholders})
        ON CONFLICT DO NOTHING
    """
    
    # Préparer les données
    records = []
    for _, row in df.iterrows():
        record = tuple(row[col] for col in columns)
        records.append(record)
    
    try:
        # Insert batch
        execute_batch(cur, insert_query, records, page_size=100)
        conn.commit()
        print(f"  ✅ {len(records)} lignes importées dans {table_name}")
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Erreur: {e}")
        print(f"  ⚠️  Tentative ligne par ligne...")
        
        # Tentative ligne par ligne
        success_count = 0
        error_count = 0
        for record in records:
            try:
                cur.execute(insert_query, record)
                conn.commit()
                success_count += 1
            except Exception as e2:
                conn.rollback()
                error_count += 1
                if error_count <= 5:  # Afficher seulement les 5 premières erreurs
                    print(f"    ⚠️  Ligne ignorée: {str(e2)[:100]}")
        
        print(f"  ✅ {success_count} lignes importées, {error_count} erreurs")
    
    cur.close()

def main():
    filepath = 'atlas_export.xlsx'
    
    print("="*80)
    print("🚀 IMPORT COMPLET DU BACKUP")
    print("="*80)
    
    # Lire toutes les feuilles
    xl = pd.ExcelFile(filepath)
    print(f"\n📋 {len(xl.sheet_names)} feuilles trouvées")
    
    # Connexion DB
    print("\n🔌 Connexion à PostgreSQL...")
    conn = psycopg2.connect(**DB_CONFIG)
    print("✅ Connecté")
    
    # Importer chaque feuille
    for i, sheet_name in enumerate(xl.sheet_names, 1):
        print(f"\n[{i}/{len(xl.sheet_names)}] Traitement de {sheet_name}...")
        
        try:
            df = pd.read_excel(filepath, sheet_name=sheet_name)
            import_sheet(conn, sheet_name, df)
        except Exception as e:
            print(f"  ❌ Erreur lors de la lecture: {e}")
            continue
    
    conn.close()
    
    print("\n" + "="*80)
    print("✅ IMPORT TERMINÉ")
    print("="*80)

if __name__ == '__main__':
    main()
