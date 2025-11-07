#!/usr/bin/env python3
"""
Génère un script SQL pour créer toutes les tables depuis le backup Excel
"""

import pandas as pd

def get_pg_type(dtype):
    """Convertit un type pandas en type PostgreSQL"""
    dtype_str = str(dtype)
    if 'int' in dtype_str:
        return 'INTEGER'
    elif 'float' in dtype_str:
        return 'DOUBLE PRECISION'
    elif 'bool' in dtype_str:
        return 'BOOLEAN'
    elif 'datetime' in dtype_str or 'timestamp' in dtype_str:
        return 'TIMESTAMP'
    elif 'object' in dtype_str:
        return 'TEXT'
    else:
        return 'TEXT'

def main():
    filepath = 'atlas_export.xlsx'
    xl = pd.ExcelFile(filepath)
    
    sql_output = []
    sql_output.append("-- Script généré automatiquement depuis atlas_export.xlsx")
    sql_output.append("-- Date: " + pd.Timestamp.now().strftime('%Y-%m-%d %H:%M:%S'))
    sql_output.append("")
    
    for sheet_name in xl.sheet_names:
        table_name = sheet_name.replace('public.', '')
        
        df = pd.read_excel(filepath, sheet_name=sheet_name, nrows=10)
        
        if len(df) == 0:
            continue
        
        sql_output.append(f"\n-- Table: {table_name}")
        sql_output.append(f"CREATE TABLE IF NOT EXISTS {table_name} (")
        
        columns = []
        for col in df.columns:
            pg_type = get_pg_type(df[col].dtype)
            columns.append(f'    "{col}" {pg_type}')
        
        sql_output.append(',\n'.join(columns))
        sql_output.append(");")
        sql_output.append("")
    
    # Écrire dans un fichier
    with open('schema_from_backup.sql', 'w', encoding='utf-8') as f:
        f.write('\n'.join(sql_output))
    
    print("✅ Schéma SQL généré dans schema_from_backup.sql")

if __name__ == '__main__':
    main()
