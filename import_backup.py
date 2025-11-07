#!/usr/bin/env python3
"""
Script d'import du backup atlas_export.xlsx
"""

import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
import sys

# Configuration DB
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def analyze_excel(filepath):
    """Analyse le contenu du fichier Excel"""
    print(f"📊 Analyse de {filepath}...")
    
    # Lire toutes les feuilles
    xl = pd.ExcelFile(filepath)
    print(f"\n📋 Feuilles trouvées: {xl.sheet_names}")
    
    for sheet_name in xl.sheet_names:
        df = pd.read_excel(filepath, sheet_name=sheet_name)
        print(f"\n--- {sheet_name} ---")
        print(f"Lignes: {len(df)}")
        print(f"Colonnes: {list(df.columns)}")
        print(f"\nPremières lignes:")
        print(df.head(2))
    
    return xl.sheet_names

def import_sondages(filepath):
    """Importe les sondages depuis Excel vers PostgreSQL"""
    print("\n🚀 Import des sondages...")
    
    # Lire la feuille public.sondages
    df = pd.read_excel(filepath, sheet_name='public.sondages')
    print(f"✅ {len(df)} sondages à importer")
    
    # Connexion DB
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Remplacer NaN par None
    df = df.where(pd.notnull(df), None)
    
    # Préparer les données (toutes les colonnes disponibles)
    records = []
    for _, row in df.iterrows():
        record = tuple(row[col] if col in df.columns else None for col in [
            'id', 'code', 'localite_base', 'date', 'source',
            'geom', 'adm3_id', 'adm3_name', 'location_mode',
            'adm1_name', 'adm2_name', 'depth_m_min', 'depth_m_max',
            'location_accuracy', 'operator', 'notes', 'type_sol'
        ])
        records.append(record)
    
    # Insert batch (simplifié sans géométrie pour l'instant)
    insert_query = """
        INSERT INTO sondages (
            id, code, localite, date, source, 
            geom, adm3_id, adm3_name, location_mode,
            adm1_name, adm2_name, depth_m_min, depth_m_max,
            location_accuracy, operator, notes, type_sol
        ) VALUES (
            %s, %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s,
            %s, %s, %s, %s
        )
        ON CONFLICT (id) DO UPDATE SET
            code = EXCLUDED.code,
            localite = EXCLUDED.localite,
            updated_at = NOW()
    """
    
    execute_batch(cur, insert_query, records, page_size=100)
    conn.commit()
    
    print(f"✅ {len(records)} sondages importés")
    
    cur.close()
    conn.close()

def main():
    filepath = 'atlas_export.xlsx'
    
    # 1. Analyser
    sheets = analyze_excel(filepath)
    
    # 2. Demander confirmation
    print("\n" + "="*60)
    response = input("Voulez-vous importer les données ? (oui/non): ")
    
    if response.lower() in ['oui', 'o', 'yes', 'y']:
        # 3. Importer
        if 'public.sondages' in sheets:
            import_sondages(filepath)
        else:
            print("❌ Feuille 'public.sondages' non trouvée")
    else:
        print("❌ Import annulé")

if __name__ == '__main__':
    main()
