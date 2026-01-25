#!/usr/bin/env python3
"""
Import UNIQUEMENT des sondages avec toutes les colonnes nécessaires
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

def main():
    # Lire les sondages
    df = pd.read_excel('atlas_export.xlsx', sheet_name='public.sondages')
    df = df.where(pd.notnull(df), None)
    
    print(f"📊 {len(df)} sondages à importer")
    print(f"📋 Colonnes: {list(df.columns)}")
    
    # Connexion
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Créer les colonnes manquantes
    print("\n🔧 Ajout des colonnes manquantes...")
    cur.execute("""
        ALTER TABLE sondages 
        ADD COLUMN IF NOT EXISTS code TEXT,
        ADD COLUMN IF NOT EXISTS localite TEXT,
        ADD COLUMN IF NOT EXISTS date DATE;
    """)
    conn.commit()
    
    # Préparer les données (colonnes minimales)
    records = []
    for _, row in df.iterrows():
        # Gérer les dates NaN
        date_val = row.get('date')
        if pd.isna(date_val):
            date_val = None
        
        record = (
            str(row['id']),
            row['code'],
            row.get('localite_base'),  # Utiliser localite_base comme localite
            date_val,
            row.get('source'),
        )
        records.append(record)
    
    # Insert avec execute_values (plus rapide)
    print(f"\n📥 Import de {len(records)} sondages...")
    
    insert_query = """
        INSERT INTO sondages (id, code, localite, date, source)
        VALUES %s
        ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            localite = EXCLUDED.localite,
            date = EXCLUDED.date,
            source = EXCLUDED.source,
            updated_at = NOW()
    """
    
    execute_values(cur, insert_query, records, page_size=100)
    conn.commit()
    
    print(f"✅ {len(records)} sondages importés")
    
    # Vérification
    cur.execute("SELECT COUNT(*) FROM sondages")
    count = cur.fetchone()[0]
    print(f"✅ Total dans la base: {count} sondages")
    
    cur.close()
    conn.close()

if __name__ == '__main__':
    main()
