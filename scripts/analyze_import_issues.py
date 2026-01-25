#!/usr/bin/env python3
"""
Analyse des problèmes d'import - Comparaison Excel vs CSV vs Base de données
"""

import pandas as pd
import psycopg2
from pathlib import Path
import json

def connect_db():
    """Connexion à la base de données"""
    return psycopg2.connect(
        host="localhost",
        port="5432", 
        database="atlas_clean",
        user="atlas",
        password="atlas"
    )

def analyze_excel_vs_csv_vs_db():
    """Analyse comparative Excel -> CSV -> DB"""
    
    print("🔍 RAPPORT D'ANALYSE - PROBLÈMES D'IMPORT")
    print("=" * 60)
    
    # 1. Analyser le fichier Excel original
    print("\n📊 1. ANALYSE FICHIER EXCEL ORIGINAL")
    try:
        xl_file = pd.ExcelFile('atlas_import.xlsx')
        print(f"Feuilles disponibles: {xl_file.sheet_names}")
        
        # Analyser la feuille sondages
        df_excel = pd.read_excel('atlas_import.xlsx', sheet_name='sondages')
        print(f"Colonnes Excel sondages ({len(df_excel.columns)}): {list(df_excel.columns)}")
        print(f"Nombre de lignes Excel: {len(df_excel)}")
        
        # Afficher les 2 premières lignes
        print("\n📋 Premières lignes Excel:")
        for i in range(min(2, len(df_excel))):
            print(f"Ligne {i+1}:")
            for col in df_excel.columns:
                val = df_excel.iloc[i][col]
                if pd.notna(val):
                    print(f"  {col}: {val}")
        
    except Exception as e:
        print(f"❌ Erreur lecture Excel: {e}")
    
    # 2. Analyser le fichier CSV généré
    print(f"\n📄 2. ANALYSE FICHIER CSV GÉNÉRÉ")
    try:
        df_csv = pd.read_csv('reimport_work/csv/sondages.csv')
        print(f"Colonnes CSV sondages ({len(df_csv.columns)}): {list(df_csv.columns)}")
        print(f"Nombre de lignes CSV: {len(df_csv)}")
        
        # Afficher les 2 premières lignes
        print("\n📋 Premières lignes CSV:")
        for i in range(min(2, len(df_csv))):
            print(f"Ligne {i+1}:")
            for col in df_csv.columns:
                val = df_csv.iloc[i][col]
                if pd.notna(val):
                    print(f"  {col}: {val}")
                    
    except Exception as e:
        print(f"❌ Erreur lecture CSV: {e}")
    
    # 3. Analyser la base de données
    print(f"\n🗄️ 3. ANALYSE BASE DE DONNÉES")
    try:
        conn = connect_db()
        cur = conn.cursor()
        
        # Structure de la table
        cur.execute("""
            SELECT column_name, data_type, is_nullable, column_default 
            FROM information_schema.columns 
            WHERE table_name = 'sondages' AND table_schema = 'public'
            ORDER BY ordinal_position
        """)
        
        db_columns = cur.fetchall()
        print(f"Colonnes DB sondages ({len(db_columns)}):")
        for col in db_columns:
            print(f"  {col[0]} ({col[1]}) - Nullable: {col[2]} - Default: {col[3]}")
        
        # Données importées
        cur.execute("SELECT COUNT(*) FROM public.sondages")
        count = cur.fetchone()[0]
        print(f"Nombre de lignes DB: {count}")
        
        # Premières lignes avec toutes les colonnes
        cur.execute("""
            SELECT id, code, source, localite_base, localite_key, adm1_name, adm2_name, adm3_name, 
                   location_mode, location_accuracy, is_geocoded, geom IS NOT NULL as has_geom
            FROM public.sondages 
            ORDER BY created_at 
            LIMIT 2
        """)
        
        db_rows = cur.fetchall()
        print(f"\n📋 Premières lignes DB:")
        columns = ['id', 'code', 'source', 'localite_base', 'localite_key', 'adm1_name', 'adm2_name', 'adm3_name', 'location_mode', 'location_accuracy', 'is_geocoded', 'has_geom']
        
        for i, row in enumerate(db_rows):
            print(f"Ligne {i+1}:")
            for j, val in enumerate(row):
                if val is not None:
                    print(f"  {columns[j]}: {val}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur base de données: {e}")
    
    # 4. Comparaison et identification des problèmes
    print(f"\n🔍 4. IDENTIFICATION DES PROBLÈMES")
    
    problems = []
    
    try:
        # Comparer colonnes Excel vs CSV
        excel_cols = set(df_excel.columns)
        csv_cols = set(df_csv.columns)
        db_cols = set([col[0] for col in db_columns])
        
        missing_in_csv = excel_cols - csv_cols
        missing_in_db = csv_cols - db_cols
        
        if missing_in_csv:
            problems.append(f"❌ Colonnes perdues Excel → CSV: {missing_in_csv}")
        
        if missing_in_db:
            problems.append(f"❌ Colonnes perdues CSV → DB: {missing_in_db}")
        
        # Vérifier les données spécifiques
        if 'localite_key' in df_excel.columns and 'localite_key' in df_csv.columns:
            excel_localite_key = df_excel['localite_key'].dropna().tolist()[:2]
            csv_localite_key = df_csv['localite_key'].dropna().tolist()[:2]
            
            if excel_localite_key != csv_localite_key:
                problems.append(f"❌ Données localite_key différentes: Excel={excel_localite_key} vs CSV={csv_localite_key}")
        
        # Vérifier les géométries
        if count > 0:
            cur = conn.cursor() if 'conn' in locals() else connect_db().cursor()
            cur.execute("SELECT COUNT(*) FROM public.sondages WHERE geom IS NOT NULL")
            geom_count = cur.fetchone()[0]
            
            if geom_count == 0:
                problems.append(f"❌ Aucune géométrie importée (0/{count} sondages)")
            
            # Vérifier is_geocoded
            cur.execute("SELECT COUNT(*) FROM public.sondages WHERE is_geocoded = true")
            geocoded_count = cur.fetchone()[0]
            
            if geocoded_count == 0:
                problems.append(f"❌ Aucun sondage marqué comme géocodé (0/{count})")
        
    except Exception as e:
        problems.append(f"❌ Erreur analyse: {e}")
    
    # 5. Solutions proposées
    print(f"\n💡 5. SOLUTIONS PROPOSÉES")
    
    solutions = []
    
    if any("localite_key" in p for p in problems):
        solutions.append({
            "problème": "Colonne localite_key manquante ou incorrecte",
            "cause": "Conversion Excel→CSV ou mapping incorrect",
            "solution": "Régénérer le CSV avec mapping correct des colonnes Excel",
            "action": "Corriger reimport_prepare.py pour inclure toutes les colonnes"
        })
    
    if any("géométrie" in p for p in problems):
        solutions.append({
            "problème": "Aucune géométrie importée", 
            "cause": "Colonnes geom_wkt vides ou trigger auto-géocodage non déclenché",
            "solution": "Forcer le géocodage via adm3_id ou coordonnées manuelles",
            "action": "Exécuter trigger manuel + mise à jour is_geocoded"
        })
    
    if any("géocodé" in p for p in problems):
        solutions.append({
            "problème": "Données sondages en gris (non géocodées)",
            "cause": "is_geocoded = false car pas de géométrie",
            "solution": "Activer géocodage automatique basé sur adm3_id",
            "action": "UPDATE sondages SET is_geocoded = true WHERE adm3_id IS NOT NULL"
        })
    
    solutions.append({
        "problème": "Import incomplet général",
        "cause": "Script de conversion ou d'import défaillant", 
        "solution": "Refaire conversion Excel→CSV avec toutes les colonnes",
        "action": "Nouveau script Python complet + réimport"
    })
    
    # Affichage des résultats
    print("\n📋 PROBLÈMES IDENTIFIÉS:")
    for i, problem in enumerate(problems, 1):
        print(f"{i}. {problem}")
    
    print(f"\n🔧 SOLUTIONS PROPOSÉES:")
    for i, sol in enumerate(solutions, 1):
        print(f"\n{i}. {sol['problème']}")
        print(f"   Cause: {sol['cause']}")
        print(f"   Solution: {sol['solution']}")
        print(f"   Action: {sol['action']}")
    
    return problems, solutions

if __name__ == "__main__":
    analyze_excel_vs_csv_vs_db()
