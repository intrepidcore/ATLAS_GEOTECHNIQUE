#!/usr/bin/env python3
"""
Import COMPLET et PROPRE du backup atlas_export.xlsx
Sans doublons, avec gestion des erreurs
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import sys

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def import_sheet_clean(conn, sheet_name, df):
    """Importe une feuille sans doublons"""
    
    table_name = sheet_name.replace('public.', '')
    
    if len(df) == 0:
        print(f"  ⏭️  {table_name}: vide")
        return 0
    
    # Remplacer NaN par None
    df = df.where(pd.notnull(df), None)
    
    cur = conn.cursor()
    
    # Préparer les colonnes
    columns = list(df.columns)
    placeholders = ', '.join(['%s'] * len(columns))
    columns_str = ', '.join([f'"{col}"' for col in columns])
    
    # Préparer les données
    records = [tuple(row[col] for col in columns) for _, row in df.iterrows()]
    
    # Insert avec ON CONFLICT DO NOTHING pour éviter les doublons
    insert_query = f"""
        INSERT INTO {table_name} ({columns_str})
        VALUES %s
        ON CONFLICT DO NOTHING
    """
    
    try:
        execute_values(cur, insert_query, records, page_size=500)
        conn.commit()
        
        # Compter ce qui a été vraiment inséré
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cur.fetchone()[0]
        
        print(f"  ✅ {table_name}: {count} lignes (source: {len(df)})")
        cur.close()
        return count
        
    except Exception as e:
        conn.rollback()
        error_msg = str(e)[:150]
        print(f"  ❌ {table_name}: {error_msg}")
        cur.close()
        return 0

def main():
    filepath = 'atlas_export.xlsx'
    
    print("="*80)
    print("🚀 IMPORT COMPLET ET PROPRE")
    print("="*80)
    
    # Lire toutes les feuilles
    xl = pd.ExcelFile(filepath)
    public_sheets = [s for s in xl.sheet_names if s.startswith('public.')]
    
    print(f"\n📋 {len(public_sheets)} feuilles à importer")
    
    # Connexion DB
    conn = psycopg2.connect(**DB_CONFIG)
    
    total_imported = 0
    success_count = 0
    
    # Importer chaque feuille
    for i, sheet_name in enumerate(public_sheets, 1):
        print(f"\n[{i}/{len(public_sheets)}] {sheet_name}...")
        
        try:
            df = pd.read_excel(filepath, sheet_name=sheet_name)
            count = import_sheet_clean(conn, sheet_name, df)
            if count > 0:
                total_imported += count
                success_count += 1
        except Exception as e:
            print(f"  ❌ Erreur lecture: {str(e)[:100]}")
            continue
    
    conn.close()
    
    print("\n" + "="*80)
    print(f"✅ TERMINÉ: {success_count} tables importées, {total_imported} lignes au total")
    print("="*80)

if __name__ == '__main__':
    main()
