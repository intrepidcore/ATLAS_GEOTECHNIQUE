#!/usr/bin/env python3
"""
Analyse complète de TOUTES les tables importées - Excel vs CSV vs DB
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

def analyze_all_tables():
    """Analyse de toutes les tables importées"""
    
    print("🔍 RAPPORT COMPLET - ANALYSE DE TOUTES LES TABLES IMPORTÉES")
    print("=" * 80)
    
    # Liste des tables à analyser
    tables_to_analyze = [
        'sondages', 'echantillons', 'essais_atterberg', 'essais_geotechniques',
        'essais_physiques', 'essais_vbs', 'essais_classif', 'granulo_points',
        'granulometrie_points', 'raw_lab_ags', 'raw_lab_agt', 'raw_lab_atterberg',
        'ref_types_essais'
    ]
    
    # 1. Analyser le fichier Excel original
    print("\n📊 1. ANALYSE FICHIER EXCEL ORIGINAL")
    try:
        xl_file = pd.ExcelFile('atlas_import.xlsx')
        excel_sheets = xl_file.sheet_names
        print(f"Feuilles Excel disponibles: {len(excel_sheets)}")
        for sheet in excel_sheets:
            print(f"  - {sheet}")
        
        excel_data = {}
        for table in tables_to_analyze:
            sheet_name = f'public.{table}'
            if sheet_name in excel_sheets:
                try:
                    df = pd.read_excel('atlas_import.xlsx', sheet_name=sheet_name)
                    excel_data[table] = {
                        'columns': list(df.columns),
                        'rows': len(df),
                        'sample_data': df.head(2) if len(df) > 0 else None
                    }
                    print(f"✅ {table}: {len(df.columns)} colonnes, {len(df)} lignes")
                except Exception as e:
                    print(f"❌ {table}: Erreur lecture - {e}")
            else:
                print(f"⚠️ {table}: Feuille non trouvée")
        
    except Exception as e:
        print(f"❌ Erreur lecture Excel: {e}")
        excel_data = {}
    
    # 2. Analyser les fichiers CSV générés
    print(f"\n📄 2. ANALYSE FICHIERS CSV GÉNÉRÉS")
    csv_data = {}
    csv_dir = Path('reimport_work/csv')
    
    for table in tables_to_analyze:
        csv_path = csv_dir / f'{table}.csv'
        if csv_path.exists():
            try:
                df = pd.read_csv(csv_path)
                csv_data[table] = {
                    'columns': list(df.columns),
                    'rows': len(df),
                    'sample_data': df.head(2) if len(df) > 0 else None
                }
                print(f"✅ {table}.csv: {len(df.columns)} colonnes, {len(df)} lignes")
            except Exception as e:
                print(f"❌ {table}.csv: Erreur lecture - {e}")
        else:
            print(f"⚠️ {table}.csv: Fichier non trouvé")
    
    # 3. Analyser la base de données
    print(f"\n🗄️ 3. ANALYSE BASE DE DONNÉES")
    try:
        conn = connect_db()
        cur = conn.cursor()
        
        db_data = {}
        
        for table in tables_to_analyze:
            try:
                # Structure de la table
                cur.execute("""
                    SELECT column_name, data_type, is_nullable 
                    FROM information_schema.columns 
                    WHERE table_name = %s AND table_schema = 'public'
                    ORDER BY ordinal_position
                """, (table,))
                
                columns_info = cur.fetchall()
                
                if columns_info:
                    # Nombre de lignes
                    cur.execute(f"SELECT COUNT(*) FROM public.{table}")
                    row_count = cur.fetchone()[0]
                    
                    # Colonnes
                    columns = [col[0] for col in columns_info]
                    
                    # Échantillon de données (2 premières lignes)
                    if row_count > 0:
                        columns_str = ', '.join(columns[:10])  # Limiter à 10 colonnes pour l'affichage
                        cur.execute(f"SELECT {columns_str} FROM public.{table} LIMIT 2")
                        sample_rows = cur.fetchall()
                    else:
                        sample_rows = []
                    
                    db_data[table] = {
                        'columns': columns,
                        'columns_info': columns_info,
                        'rows': row_count,
                        'sample_rows': sample_rows
                    }
                    
                    print(f"✅ {table}: {len(columns)} colonnes, {row_count} lignes")
                else:
                    print(f"❌ {table}: Table non trouvée en DB")
                    
            except Exception as e:
                print(f"❌ {table}: Erreur DB - {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur connexion DB: {e}")
        db_data = {}
    
    # 4. Comparaison et analyse des problèmes
    print(f"\n🔍 4. COMPARAISON ET PROBLÈMES PAR TABLE")
    
    all_problems = []
    
    for table in tables_to_analyze:
        print(f"\n📋 TABLE: {table.upper()}")
        print("-" * 50)
        
        table_problems = []
        
        # Données disponibles
        has_excel = table in excel_data
        has_csv = table in csv_data  
        has_db = table in db_data
        
        print(f"Sources: Excel={has_excel}, CSV={has_csv}, DB={has_db}")
        
        if has_excel:
            print(f"Excel: {excel_data[table]['rows']} lignes, {len(excel_data[table]['columns'])} colonnes")
        if has_csv:
            print(f"CSV: {csv_data[table]['rows']} lignes, {len(csv_data[table]['columns'])} colonnes")
        if has_db:
            print(f"DB: {db_data[table]['rows']} lignes, {len(db_data[table]['columns'])} colonnes")
        
        # Vérifier les pertes de données
        if has_excel and has_csv:
            excel_rows = excel_data[table]['rows']
            csv_rows = csv_data[table]['rows']
            if excel_rows != csv_rows:
                problem = f"❌ {table}: Perte de lignes Excel→CSV ({excel_rows} → {csv_rows})"
                table_problems.append(problem)
                print(problem)
        
        if has_csv and has_db:
            csv_rows = csv_data[table]['rows']
            db_rows = db_data[table]['rows']
            if csv_rows != db_rows:
                problem = f"❌ {table}: Perte de lignes CSV→DB ({csv_rows} → {db_rows})"
                table_problems.append(problem)
                print(problem)
        
        # Vérifier les colonnes
        if has_excel and has_csv:
            excel_cols = set(excel_data[table]['columns'])
            csv_cols = set(csv_data[table]['columns'])
            missing_cols = excel_cols - csv_cols
            if missing_cols:
                problem = f"❌ {table}: Colonnes perdues Excel→CSV: {missing_cols}"
                table_problems.append(problem)
                print(problem)
        
        if has_csv and has_db:
            csv_cols = set(csv_data[table]['columns'])
            db_cols = set(db_data[table]['columns'])
            missing_cols = csv_cols - db_cols
            if missing_cols:
                problem = f"❌ {table}: Colonnes perdues CSV→DB: {missing_cols}"
                table_problems.append(problem)
                print(problem)
        
        # Vérifier si la table est vide
        if has_db and db_data[table]['rows'] == 0:
            problem = f"⚠️ {table}: Table vide en DB"
            table_problems.append(problem)
            print(problem)
        
        if not table_problems:
            print("✅ Aucun problème détecté")
        
        all_problems.extend(table_problems)
    
    # 5. Résumé global et solutions
    print(f"\n📊 5. RÉSUMÉ GLOBAL")
    print("=" * 50)
    
    total_excel_rows = sum([excel_data[t]['rows'] for t in excel_data])
    total_db_rows = sum([db_data[t]['rows'] for t in db_data])
    
    print(f"Total lignes Excel: {total_excel_rows}")
    print(f"Total lignes DB: {total_db_rows}")
    print(f"Tables avec problèmes: {len(set([p.split(':')[1].strip().split(' ')[0] for p in all_problems if '❌' in p]))}")
    
    print(f"\n📋 TOUS LES PROBLÈMES IDENTIFIÉS:")
    for i, problem in enumerate(all_problems, 1):
        print(f"{i}. {problem}")
    
    # Solutions globales
    print(f"\n💡 6. SOLUTIONS RECOMMANDÉES")
    print("=" * 50)
    
    solutions = [
        {
            "priorité": "HAUTE",
            "problème": "Tables vides ou données manquantes",
            "solution": "Réimport complet avec script corrigé",
            "actions": [
                "1. Vérifier tous les fichiers CSV générés",
                "2. Corriger le script reimport_prepare.py",
                "3. Régénérer tous les CSV",
                "4. Réimporter avec gestion d'erreurs"
            ]
        },
        {
            "priorité": "HAUTE", 
            "problème": "Colonnes perdues dans la conversion",
            "solution": "Mapping complet Excel→CSV→DB",
            "actions": [
                "1. Analyser toutes les colonnes Excel",
                "2. Créer mapping 1:1 pour chaque table",
                "3. Adapter les scripts SQL d'import"
            ]
        },
        {
            "priorité": "MOYENNE",
            "problème": "Données sondages en gris (géocodage)",
            "solution": "Activer géocodage automatique",
            "actions": [
                "1. Vérifier trigger auto-géocodage",
                "2. Forcer géocodage sur adm3_id",
                "3. Mettre à jour is_geocoded"
            ]
        }
    ]
    
    for i, sol in enumerate(solutions, 1):
        print(f"\n{i}. PRIORITÉ {sol['priorité']}: {sol['problème']}")
        print(f"   Solution: {sol['solution']}")
        for action in sol['actions']:
            print(f"   {action}")
    
    return all_problems, solutions, excel_data, csv_data, db_data

if __name__ == "__main__":
    analyze_all_tables()
