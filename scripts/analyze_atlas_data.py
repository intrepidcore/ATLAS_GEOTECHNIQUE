#!/usr/bin/env python3
"""
Script d'analyse des données Atlas pour préparer la réimportation
"""

import pandas as pd
import numpy as np
from pathlib import Path

def analyze_atlas_data():
    """Analyse complète des données Atlas"""
    
    print("=== ANALYSE DES DONNÉES ATLAS ===\n")
    
    # Fichier source
    excel_file = "atlas_export.xlsx"
    
    # Tables géotechniques à analyser
    geo_tables = [
        'public.sondages', 'public.echantillons', 'public.mailles',
        'public.essais_atterberg', 'public.essais_classif', 'public.essais_geotechniques',
        'public.essais_physiques', 'public.essais_proctor', 'public.essais_vbs',
        'public.granulo_points', 'public.granulometrie_points',
        'public.raw_lab_ags', 'public.raw_lab_agt', 'public.raw_lab_atterberg',
        'public.ref_types_essais', 'public.classifications'
    ]
    
    print("📊 ÉTAPE 3 - ANALYSE DES TABLES GÉOTECHNIQUES")
    print("=" * 50)
    
    analysis_results = {}
    
    for table in geo_tables:
        try:
            df = pd.read_excel(excel_file, sheet_name=table)
            
            # Analyse de base
            result = {
                'rows': len(df),
                'columns': len(df.columns),
                'column_names': df.columns.tolist(),
                'has_id': 'id' in df.columns,
                'has_geometry': any('geom' in col.lower() for col in df.columns),
                'null_counts': df.isnull().sum().to_dict(),
                'data_types': df.dtypes.to_dict()
            }
            
            # Vérification clé primaire
            if result['has_id']:
                null_ids = df['id'].isnull().sum()
                duplicate_ids = df['id'].duplicated().sum()
                result['id_issues'] = {
                    'null_count': null_ids,
                    'duplicate_count': duplicate_ids,
                    'valid': null_ids == 0 and duplicate_ids == 0
                }
            
            # Géométries
            geom_cols = [col for col in df.columns if 'geom' in col.lower()]
            if geom_cols:
                result['geometry_info'] = {}
                for geom_col in geom_cols:
                    result['geometry_info'][geom_col] = {
                        'null_count': df[geom_col].isnull().sum(),
                        'total_rows': len(df)
                    }
            
            analysis_results[table] = result
            
            # Affichage résumé
            print(f"\n📋 {table}")
            print(f"   Lignes: {result['rows']}")
            print(f"   Colonnes: {result['columns']}")
            
            if result['has_id']:
                id_status = "✅ Valide" if result['id_issues']['valid'] else "❌ Problème"
                print(f"   Clé primaire (id): {id_status}")
                if not result['id_issues']['valid']:
                    print(f"      - Nulls: {result['id_issues']['null_count']}")
                    print(f"      - Doublons: {result['id_issues']['duplicate_count']}")
            else:
                print(f"   Clé primaire (id): ❌ Absente")
            
            if result['has_geometry']:
                print(f"   Géométrie: ✅ Présente ({geom_cols})")
                for geom_col in geom_cols:
                    null_geom = result['geometry_info'][geom_col]['null_count']
                    total = result['geometry_info'][geom_col]['total_rows']
                    print(f"      - {geom_col}: {null_geom}/{total} nulls")
            else:
                print(f"   Géométrie: ❌ Aucune")
                
        except Exception as e:
            print(f"\n❌ {table}: Erreur - {e}")
            analysis_results[table] = {'error': str(e)}
    
    print("\n" + "=" * 50)
    print("📊 ÉTAPE 4 - PROBLÈMES IDENTIFIÉS")
    print("=" * 50)
    
    # Analyse des problèmes critiques
    critical_issues = []
    
    # Problème 1: Sondages sans géométrie
    if 'public.sondages' in analysis_results:
        sondages = analysis_results['public.sondages']
        if 'geometry_info' in sondages:
            geom_nulls = sondages['geometry_info'].get('geom', {}).get('null_count', 0)
            total_sondages = sondages['rows']
            if geom_nulls > 0:
                critical_issues.append({
                    'table': 'sondages',
                    'issue': f'Géométries manquantes: {geom_nulls}/{total_sondages}',
                    'impact': 'Zoom et cartographie impossibles',
                    'priority': 'CRITIQUE'
                })
    
    # Problème 2: Tables sans clé primaire
    for table, data in analysis_results.items():
        if not data.get('has_id', False) and 'error' not in data:
            critical_issues.append({
                'table': table,
                'issue': 'Pas de colonne id (clé primaire)',
                'impact': 'Édition impossible',
                'priority': 'ÉLEVÉ'
            })
    
    # Problème 3: Clés primaires invalides
    for table, data in analysis_results.items():
        if data.get('has_id', False) and 'id_issues' in data:
            if not data['id_issues']['valid']:
                critical_issues.append({
                    'table': table,
                    'issue': f"PK invalide: {data['id_issues']['null_count']} nulls, {data['id_issues']['duplicate_count']} doublons",
                    'impact': 'Édition et relations corrompues',
                    'priority': 'CRITIQUE'
                })
    
    # Affichage des problèmes
    if critical_issues:
        print("\n🚨 PROBLÈMES CRITIQUES DÉTECTÉS:")
        for i, issue in enumerate(critical_issues, 1):
            print(f"\n{i}. [{issue['priority']}] {issue['table']}")
            print(f"   Problème: {issue['issue']}")
            print(f"   Impact: {issue['impact']}")
    else:
        print("\n✅ Aucun problème critique détecté")
    
    print("\n" + "=" * 50)
    print("📊 ÉTAPE 5 - RECOMMANDATIONS")
    print("=" * 50)
    
    print("\n🔧 ACTIONS RECOMMANDÉES:")
    print("\n1. NETTOYAGE DES DONNÉES:")
    print("   - Supprimer les lignes avec des IDs null ou dupliqués")
    print("   - Générer des UUIDs valides pour les nouvelles lignes")
    print("   - Corriger les géométries manquantes via géocodage")
    
    print("\n2. STRUCTURE DE BASE:")
    print("   - Ajouter colonne 'id' UUID aux tables qui n'en ont pas")
    print("   - Vérifier les contraintes NOT NULL")
    print("   - Valider les relations FK (sondage_id, echantillon_id, etc.)")
    
    print("\n3. TYPES POSTGRESQL:")
    print("   - UUID pour les colonnes id")
    print("   - GEOMETRY(Point, 4326) pour les géométries")
    print("   - NUMERIC pour les mesures")
    print("   - TEXT pour les codes et descriptions")
    print("   - TIMESTAMP pour created_at, updated_at")
    
    return analysis_results

def create_import_file(analysis_results):
    """Crée le fichier atlas_import.xlsx nettoyé"""
    
    print("\n" + "=" * 50)
    print("📊 CRÉATION DU FICHIER ATLAS_IMPORT.XLSX")
    print("=" * 50)
    
    # Tables à inclure (seulement les géotechniques)
    tables_to_include = [
        'public.sondages', 'public.echantillons', 'public.mailles',
        'public.essais_atterberg', 'public.essais_classif', 'public.essais_geotechniques',
        'public.essais_physiques', 'public.essais_proctor', 'public.essais_vbs',
        'public.granulo_points', 'public.granulometrie_points',
        'public.raw_lab_ags', 'public.raw_lab_agt', 'public.raw_lab_atterberg',
        'public.ref_types_essais', 'public.classifications'
    ]
    
    print(f"\n📋 Tables à inclure dans atlas_import.xlsx:")
    for table in tables_to_include:
        if table in analysis_results and 'error' not in analysis_results[table]:
            rows = analysis_results[table]['rows']
            print(f"   ✅ {table} ({rows} lignes)")
        else:
            print(f"   ❌ {table} (erreur ou absente)")
    
    print(f"\n🗑️  Tables exclues (non géotechniques): {40 - len(tables_to_include)} tables")
    
    # Créer le fichier nettoyé
    with pd.ExcelWriter('atlas_import.xlsx', engine='openpyxl') as writer:
        for table in tables_to_include:
            try:
                df = pd.read_excel('atlas_export.xlsx', sheet_name=table)
                
                # Nettoyage de base
                # 1. Supprimer les lignes avec ID null (si colonne id existe)
                if 'id' in df.columns:
                    before_count = len(df)
                    df = df.dropna(subset=['id'])
                    after_count = len(df)
                    if before_count != after_count:
                        print(f"   🧹 {table}: {before_count - after_count} lignes avec ID null supprimées")
                
                # 2. Supprimer les doublons d'ID
                if 'id' in df.columns:
                    before_count = len(df)
                    df = df.drop_duplicates(subset=['id'])
                    after_count = len(df)
                    if before_count != after_count:
                        print(f"   🧹 {table}: {before_count - after_count} doublons d'ID supprimés")
                
                # 3. Écrire dans le fichier
                df.to_excel(writer, sheet_name=table, index=False)
                print(f"   ✅ {table}: {len(df)} lignes nettoyées exportées")
                
            except Exception as e:
                print(f"   ❌ {table}: Erreur - {e}")
    
    print(f"\n✅ Fichier atlas_import.xlsx créé avec succès!")
    print(f"📁 Emplacement: {Path('atlas_import.xlsx').absolute()}")

if __name__ == "__main__":
    # Exécution du script
    results = analyze_atlas_data()
    create_import_file(results)
    
    print("\n" + "=" * 50)
    print("🎯 PROCHAINES ÉTAPES")
    print("=" * 50)
    print("\n1. Vérifier le fichier atlas_import.xlsx créé")
    print("2. Sauvegarder la base existante (✅ Fait)")
    print("3. Vider les tables PostgreSQL (DELETE FROM table)")
    print("4. Réimporter depuis atlas_import.xlsx")
    print("5. Tester l'édition et le zoom")
