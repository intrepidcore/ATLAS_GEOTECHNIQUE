#!/usr/bin/env python3
"""
Corrige les types de colonnes en analysant les données réelles
"""

import pandas as pd
import psycopg2

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def get_real_type(series):
    """Détermine le vrai type d'une colonne en analysant les données"""
    # Enlever les NaN
    clean = series.dropna()
    
    if len(clean) == 0:
        return 'TEXT'
    
    # Vérifier si c'est du texte
    if clean.apply(lambda x: isinstance(x, str)).any():
        return 'TEXT'
    
    # Vérifier si c'est un entier
    if clean.apply(lambda x: isinstance(x, (int, bool))).all():
        return 'INTEGER'
    
    # Sinon c'est un float
    return 'DOUBLE PRECISION'

def fix_table_schema(conn, sheet_name, df):
    """Corrige le schéma d'une table"""
    table_name = sheet_name.replace('public.', '')
    
    cur = conn.cursor()
    
    # Analyser chaque colonne
    fixes = []
    for col in df.columns:
        real_type = get_real_type(df[col])
        
        # Si c'est TEXT, on change
        if real_type == 'TEXT':
            fixes.append(f'ALTER COLUMN "{col}" TYPE TEXT USING "{col}"::TEXT')
    
    if fixes:
        alter_query = f"ALTER TABLE {table_name} " + ", ".join(fixes) + ";"
        try:
            cur.execute(alter_query)
            conn.commit()
            print(f"  ✅ {table_name}: {len(fixes)} colonnes corrigées")
        except Exception as e:
            conn.rollback()
            print(f"  ❌ {table_name}: {str(e)[:100]}")
    
    cur.close()

def main():
    filepath = 'atlas_export.xlsx'
    
    print("🔧 Correction des types de colonnes...")
    
    # Tables problématiques
    problem_tables = [
        'public.adm3',
        'public.essais_classif',
        'public.essais_geotechniques',
        'public.essais_physiques',
        'public.sondages'
    ]
    
    conn = psycopg2.connect(**DB_CONFIG)
    
    for sheet_name in problem_tables:
        print(f"\n📋 {sheet_name}...")
        df = pd.read_excel(filepath, sheet_name=sheet_name, nrows=100)  # Analyser les 100 premières lignes
        fix_table_schema(conn, sheet_name, df)
    
    conn.close()
    print("\n✅ Corrections terminées")

if __name__ == '__main__':
    main()
