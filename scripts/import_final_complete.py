#!/usr/bin/env python3
"""
Import FINAL et COMPLET avec gestion automatique des erreurs
1. DROP + CREATE schema
2. Création des tables avec types TEXT (sûr)
3. Import de toutes les données
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def reset_database(conn):
    """Efface et recrée le schéma"""
    print("🗑️  Suppression du schéma...")
    cur = conn.cursor()
    cur.execute("DROP SCHEMA IF EXISTS public CASCADE;")
    cur.execute("CREATE SCHEMA public;")
    cur.execute("GRANT ALL ON SCHEMA public TO atlas;")
    cur.execute("GRANT ALL ON SCHEMA public TO public;")
    cur.execute("CREATE EXTENSION IF NOT EXISTS postgis;")
    cur.execute("CREATE EXTENSION IF NOT EXISTS pg_trgm;")
    conn.commit()
    cur.close()
    print("✅ Base réinitialisée")

def create_table_safe(conn, table_name, columns):
    """Crée une table avec tous les types en TEXT (sûr)"""
    cur = conn.cursor()
    
    # Créer les colonnes en TEXT sauf geometry
    col_defs = []
    has_id = 'id' in columns
    
    for col in columns:
        if 'geom' in col.lower():
            col_defs.append(f'"{col}" GEOMETRY')
        elif col == 'id' and has_id:
            col_defs.append(f'"{col}" TEXT PRIMARY KEY')
        else:
            col_defs.append(f'"{col}" TEXT')
    
    create_query = f"""
        CREATE TABLE IF NOT EXISTS {table_name} (
            {', '.join(col_defs)}
        );
    """
    
    try:
        cur.execute(create_query)
        conn.commit()
        cur.close()
        return True
    except Exception as e:
        conn.rollback()
        cur.close()
        print(f"    ⚠️  Erreur création: {str(e)[:80]}")
        return False

def import_sheet_final(conn, sheet_name, df):
    """Importe une feuille complète"""
    table_name = sheet_name.replace('public.', '')
    
    if len(df) == 0:
        return 0, 0
    
    # Remplacer NaN par None
    df = df.where(pd.notnull(df), None)
    
    # Créer la table
    if not create_table_safe(conn, table_name, df.columns):
        return 0, len(df)
    
    cur = conn.cursor()
    
    # Préparer les données
    columns = list(df.columns)
    columns_str = ', '.join([f'"{col}"' for col in columns])
    records = [tuple(str(val) if val is not None else None for val in row) 
               for row in df.values]
    
    # Insert (avec ou sans ON CONFLICT selon si id existe)
    has_id = 'id' in columns
    if has_id:
        insert_query = f"""
            INSERT INTO {table_name} ({columns_str})
            VALUES %s
            ON CONFLICT (id) DO NOTHING
        """
    else:
        insert_query = f"""
            INSERT INTO {table_name} ({columns_str})
            VALUES %s
        """
    
    try:
        execute_values(cur, insert_query, records, page_size=1000)
        conn.commit()
        
        cur.execute(f"SELECT COUNT(*) FROM {table_name}")
        count = cur.fetchone()[0]
        cur.close()
        
        return count, 0
        
    except Exception as e:
        conn.rollback()
        cur.close()
        return 0, len(df)

def main():
    filepath = 'atlas_export.xlsx'
    
    print("="*80)
    print("🚀 IMPORT FINAL COMPLET")
    print("="*80)
    
    # Connexion
    conn = psycopg2.connect(**DB_CONFIG)
    
    # 1. Reset base
    reset_database(conn)
    
    # 2. Lire toutes les feuilles
    xl = pd.ExcelFile(filepath)
    public_sheets = [s for s in xl.sheet_names if s.startswith('public.')]
    
    print(f"\n📋 {len(public_sheets)} feuilles à importer\n")
    
    total_success = 0
    total_errors = 0
    success_tables = []
    error_tables = []
    
    # 3. Importer tout
    for i, sheet_name in enumerate(public_sheets, 1):
        table_name = sheet_name.replace('public.', '')
        
        try:
            df = pd.read_excel(filepath, sheet_name=sheet_name)
            
            if len(df) == 0:
                print(f"[{i:2d}/{len(public_sheets)}] {table_name:30s} ⏭️  vide")
                continue
            
            success, errors = import_sheet_final(conn, sheet_name, df)
            
            if errors > 0:
                print(f"[{i:2d}/{len(public_sheets)}] {table_name:30s} ❌ {errors} erreurs")
                error_tables.append(table_name)
                total_errors += errors
            else:
                print(f"[{i:2d}/{len(public_sheets)}] {table_name:30s} ✅ {success:6d} lignes")
                success_tables.append((table_name, success))
                total_success += success
                
        except Exception as e:
            print(f"[{i:2d}/{len(public_sheets)}] {table_name:30s} ❌ {str(e)[:50]}")
            error_tables.append(table_name)
    
    conn.close()
    
    # 4. Résumé
    print("\n" + "="*80)
    print(f"✅ TERMINÉ")
    print(f"   {len(success_tables)} tables importées")
    print(f"   {total_success:,} lignes au total")
    if error_tables:
        print(f"   ⚠️  {len(error_tables)} tables en erreur: {', '.join(error_tables[:5])}")
    print("="*80)
    
    # 5. Top 10 des tables
    print("\n📊 Top 10 des tables:")
    for table, count in sorted(success_tables, key=lambda x: x[1], reverse=True)[:10]:
        print(f"   {table:30s} {count:6,} lignes")

if __name__ == '__main__':
    main()
