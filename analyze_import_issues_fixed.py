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
        
        # Analyser la feuille sondages (nom correct)
        df_excel = pd.read_excel('atlas_import.xlsx', sheet_name='public.sondages')
        print(f"Colonnes Excel sondages ({len(df_excel.columns)}): {list(df_excel.columns)}")
        print(f"Nombre de lignes Excel: {len(df_excel)}")
        
        # Afficher les 2 premières lignes avec colonnes importantes
        print("\n📋 Premières lignes Excel (colonnes clés):")
        key_cols = ['id', 'code', 'localite_base', 'localite_key', 'adm1_name', 'adm2_name', 'adm3_name', 'adm3_id', 'location_mode', 'geom_wkt']
        available_cols = [col for col in key_cols if col in df_excel.columns]
        
        for i in range(min(2, len(df_excel))):
            print(f"\nLigne Excel {i+1}:")
            for col in available_cols:
                val = df_excel.iloc[i][col]
                if pd.notna(val):
                    print(f"  {col}: {val}")
        
    except Exception as e:
        print(f"❌ Erreur lecture Excel: {e}")
        df_excel = None
    
    # 2. Analyser le fichier CSV généré
    print(f"\n📄 2. ANALYSE FICHIER CSV GÉNÉRÉ")
    try:
        csv_path = Path('reimport_work/csv/sondages.csv')
        if csv_path.exists():
            df_csv = pd.read_csv(csv_path)
            print(f"Colonnes CSV sondages ({len(df_csv.columns)}): {list(df_csv.columns)}")
            print(f"Nombre de lignes CSV: {len(df_csv)}")
            
            # Afficher les 2 premières lignes
            print("\n📋 Premières lignes CSV (colonnes clés):")
            key_cols = ['id', 'code', 'localite_base', 'localite_key', 'adm1_name', 'adm2_name', 'adm3_name', 'adm3_id', 'location_mode', 'geom_wkt']
            available_cols = [col for col in key_cols if col in df_csv.columns]
            
            for i in range(min(2, len(df_csv))):
                print(f"\nLigne CSV {i+1}:")
                for col in available_cols:
                    val = df_csv.iloc[i][col]
                    if pd.notna(val):
                        print(f"  {col}: {val}")
        else:
            print("❌ Fichier CSV non trouvé")
            df_csv = None
                    
    except Exception as e:
        print(f"❌ Erreur lecture CSV: {e}")
        df_csv = None
    
    # 3. Analyser la base de données
    print(f"\n🗄️ 3. ANALYSE BASE DE DONNÉES")
    try:
        conn = connect_db()
        cur = conn.cursor()
        
        # Données importées avec colonnes clés
        cur.execute("SELECT COUNT(*) FROM public.sondages")
        count = cur.fetchone()[0]
        print(f"Nombre de lignes DB: {count}")
        
        # Premières lignes avec colonnes importantes
        cur.execute("""
            SELECT id, code, source, localite_base, localite_key, adm1_name, adm2_name, adm3_name, 
                   location_mode, location_accuracy, is_geocoded, geom IS NOT NULL as has_geom, adm3_id
            FROM public.sondages 
            ORDER BY created_at 
            LIMIT 2
        """)
        
        db_rows = cur.fetchall()
        print(f"\n📋 Premières lignes DB:")
        columns = ['id', 'code', 'source', 'localite_base', 'localite_key', 'adm1_name', 'adm2_name', 'adm3_name', 'location_mode', 'location_accuracy', 'is_geocoded', 'has_geom', 'adm3_id']
        
        for i, row in enumerate(db_rows):
            print(f"\nLigne DB {i+1}:")
            for j, val in enumerate(row):
                if val is not None and val != '':
                    print(f"  {columns[j]}: {val}")
        
        # Statistiques géocodage
        cur.execute("SELECT COUNT(*) FROM public.sondages WHERE geom IS NOT NULL")
        geom_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.sondages WHERE is_geocoded = true")
        geocoded_count = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.sondages WHERE adm3_id IS NOT NULL")
        adm3_count = cur.fetchone()[0]
        
        print(f"\n📊 Statistiques géocodage:")
        print(f"  Sondages avec géométrie: {geom_count}/{count}")
        print(f"  Sondages marqués géocodés: {geocoded_count}/{count}")
        print(f"  Sondages avec adm3_id: {adm3_count}/{count}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur base de données: {e}")
        count = 0
        geom_count = 0
        geocoded_count = 0
        adm3_count = 0
    
    # 4. Comparaison et identification des problèmes
    print(f"\n🔍 4. IDENTIFICATION DES PROBLÈMES")
    
    problems = []
    
    # Problème 1: Données en gris (non géocodées)
    if geocoded_count == 0 and count > 0:
        problems.append("❌ PROBLÈME MAJEUR: Tous les sondages sont en gris (is_geocoded = false)")
    
    # Problème 2: Pas de géométries
    if geom_count == 0 and count > 0:
        problems.append("❌ PROBLÈME MAJEUR: Aucune géométrie importée (geom IS NULL)")
    
    # Problème 3: Comparaison Excel vs DB
    if df_excel is not None:
        excel_cols = set(df_excel.columns)
        
        # Vérifier colonnes importantes
        important_cols = ['localite_key', 'geom_wkt', 'adm3_id']
        for col in important_cols:
            if col in excel_cols:
                # Vérifier si les données sont présentes dans Excel
                non_null_excel = df_excel[col].notna().sum()
                if non_null_excel > 0:
                    problems.append(f"❌ Colonne '{col}' présente dans Excel ({non_null_excel} valeurs) mais possiblement perdue")
    
    # Problème 4: Trigger auto-géocodage
    if adm3_count > 0 and geom_count == 0:
        problems.append("❌ Trigger auto-géocodage non fonctionnel (adm3_id présent mais pas de géométries)")
    
    # 5. Solutions proposées
    print(f"\n💡 5. SOLUTIONS PROPOSÉES")
    
    solutions = []
    
    # Solution 1: Corriger les données en gris
    solutions.append({
        "problème": "Sondages affichés en gris dans l'interface",
        "cause": "is_geocoded = false car aucune géométrie",
        "solution": "Activer le géocodage automatique basé sur adm3_id",
        "actions": [
            "1. Vérifier le trigger auto-géocodage",
            "2. Forcer le géocodage: UPDATE sondages SET geom = (SELECT ST_Centroid(geom) FROM atlas.adm3 WHERE gid = sondages.adm3_id) WHERE adm3_id IS NOT NULL",
            "3. Mettre à jour is_geocoded: UPDATE sondages SET is_geocoded = true WHERE geom IS NOT NULL"
        ]
    })
    
    # Solution 2: Réimport complet avec toutes les colonnes
    solutions.append({
        "problème": "Données incomplètes (colonnes manquantes)",
        "cause": "Script de conversion Excel→CSV incomplet",
        "solution": "Refaire la conversion avec toutes les colonnes Excel",
        "actions": [
            "1. Corriger reimport_prepare.py pour inclure TOUTES les colonnes",
            "2. Régénérer les CSV avec mapping correct",
            "3. Réimporter avec le script SQL corrigé"
        ]
    })
    
    # Solution 3: Corriger le trigger de géocodage
    solutions.append({
        "problème": "Trigger auto-géocodage non fonctionnel",
        "cause": "Trigger mal configuré ou données adm3 manquantes",
        "solution": "Réparer le système de géocodage automatique",
        "actions": [
            "1. Vérifier l'existence de la table atlas.adm3",
            "2. Corriger le trigger setup_auto_geocoding.sql",
            "3. Forcer l'exécution du trigger sur les données existantes"
        ]
    })
    
    # Affichage des résultats
    print("\n📋 PROBLÈMES IDENTIFIÉS:")
    for i, problem in enumerate(problems, 1):
        print(f"{i}. {problem}")
    
    print(f"\n🔧 SOLUTIONS PROPOSÉES:")
    for i, sol in enumerate(solutions, 1):
        print(f"\n{i}. PROBLÈME: {sol['problème']}")
        print(f"   CAUSE: {sol['cause']}")
        print(f"   SOLUTION: {sol['solution']}")
        print(f"   ACTIONS:")
        for action in sol['actions']:
            print(f"     {action}")
    
    return problems, solutions

if __name__ == "__main__":
    analyze_excel_vs_csv_vs_db()
