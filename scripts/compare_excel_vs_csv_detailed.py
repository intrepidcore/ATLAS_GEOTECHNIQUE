#!/usr/bin/env python3
"""
Rapport détaillé - Comparaison colonne par colonne Excel vs CSV
3 premières lignes de chaque table
"""

import pandas as pd
from pathlib import Path
import json

def compare_excel_vs_csv_detailed():
    """Comparaison détaillée Excel vs CSV - 3 premières lignes"""
    
    print("🔍 RAPPORT DÉTAILLÉ - COMPARAISON EXCEL vs CSV (3 PREMIÈRES LIGNES)")
    print("=" * 100)
    
    # Tables à analyser
    tables_to_analyze = [
        'sondages', 'echantillons', 'essais_atterberg', 'essais_geotechniques',
        'essais_physiques', 'essais_vbs', 'granulo_points', 'raw_lab_ags',
        'raw_lab_agt', 'raw_lab_atterberg', 'ref_types_essais'
    ]
    
    try:
        # Lecture Excel
        xl_file = pd.ExcelFile('atlas_import.xlsx')
        csv_dir = Path('reimport_work/csv_ready')
        
        for table in tables_to_analyze:
            print(f"\n{'='*100}")
            print(f"📋 TABLE: {table.upper()}")
            print(f"{'='*100}")
            
            sheet_name = f'public.{table}'
            csv_path = csv_dir / f'{table}.csv'
            
            try:
                # 1. Lire Excel
                if sheet_name in xl_file.sheet_names:
                    df_excel = pd.read_excel('atlas_import.xlsx', sheet_name=sheet_name)
                    excel_rows = min(3, len(df_excel))
                else:
                    print(f"❌ Feuille Excel '{sheet_name}' non trouvée")
                    continue
                
                # 2. Lire CSV
                if csv_path.exists():
                    df_csv = pd.read_csv(csv_path)
                    csv_rows = min(3, len(df_csv))
                else:
                    print(f"❌ Fichier CSV '{csv_path}' non trouvé")
                    continue
                
                print(f"📊 STATISTIQUES:")
                print(f"   Excel: {len(df_excel)} lignes, {len(df_excel.columns)} colonnes")
                print(f"   CSV: {len(df_csv)} lignes, {len(df_csv.columns)} colonnes")
                
                # 3. Comparaison ligne par ligne
                for ligne_idx in range(min(excel_rows, csv_rows)):
                    print(f"\n🔍 LIGNE {ligne_idx + 1}:")
                    print("-" * 80)
                    
                    excel_row = df_excel.iloc[ligne_idx]
                    csv_row = df_csv.iloc[ligne_idx]
                    
                    # Créer un dictionnaire des valeurs CSV
                    csv_dict = dict(zip(df_csv.columns, csv_row))
                    
                    # Comparer chaque colonne Excel
                    for col_excel in df_excel.columns:
                        excel_val = excel_row[col_excel]
                        
                        # Trouver la colonne correspondante en CSV
                        possible_csv_cols = [
                            col_excel,
                            col_excel.lower(),
                            col_excel.replace(' ', '_'),
                            col_excel.lower().replace(' ', '_'),
                            col_excel.replace(' ', ''),
                            col_excel.lower().replace(' ', '')
                        ]
                        
                        csv_val = None
                        found_col = None
                        
                        for possible_col in possible_csv_cols:
                            if possible_col in csv_dict:
                                csv_val = csv_dict[possible_col]
                                found_col = possible_col
                                break
                        
                        # Nettoyer les valeurs pour comparaison
                        excel_clean = str(excel_val).strip() if pd.notna(excel_val) else None
                        csv_clean = str(csv_val).strip() if pd.notna(csv_val) else None
                        
                        # Statut de la comparaison
                        if excel_clean is None and csv_clean is None:
                            status = "✅ VIDE→VIDE"
                        elif excel_clean is None and csv_clean is not None:
                            status = "⚠️ VIDE→REMPLI"
                        elif excel_clean is not None and csv_clean is None:
                            status = "❌ PERDU"
                        elif excel_clean == csv_clean:
                            status = "✅ IDENTIQUE"
                        elif excel_clean == 'nan' and csv_clean is None:
                            status = "✅ NaN→NULL"
                        elif str(excel_clean).lower() == str(csv_clean).lower():
                            status = "🔄 CASSE"
                        else:
                            status = "🔄 MODIFIÉ"
                        
                        # Affichage seulement si problématique ou intéressant
                        if status in ["❌ PERDU", "🔄 MODIFIÉ", "🔄 CASSE", "⚠️ VIDE→REMPLI"] or (excel_clean and len(str(excel_clean)) > 0):
                            # Tronquer les valeurs longues pour l'affichage
                            excel_display = str(excel_clean)[:50] + "..." if excel_clean and len(str(excel_clean)) > 50 else excel_clean
                            csv_display = str(csv_clean)[:50] + "..." if csv_clean and len(str(csv_clean)) > 50 else csv_clean
                            
                            print(f"   {col_excel:25} | {status:15} | Excel: '{excel_display}' → CSV: '{csv_display}' ({found_col})")
                
                # 4. Colonnes manquantes
                excel_cols = set(df_excel.columns)
                csv_cols = set(df_csv.columns)
                
                # Normaliser les noms pour comparaison
                excel_cols_norm = set([col.lower().replace(' ', '_') for col in excel_cols])
                csv_cols_norm = set([col.lower().replace(' ', '_') for col in csv_cols])
                
                missing_in_csv = excel_cols_norm - csv_cols_norm
                if missing_in_csv:
                    print(f"\n❌ COLONNES PERDUES (Excel → CSV):")
                    for col in missing_in_csv:
                        original_col = next((c for c in excel_cols if c.lower().replace(' ', '_') == col), col)
                        print(f"   - {original_col}")
                
                extra_in_csv = csv_cols_norm - excel_cols_norm
                if extra_in_csv:
                    print(f"\n➕ COLONNES AJOUTÉES (CSV seulement):")
                    for col in extra_in_csv:
                        original_col = next((c for c in csv_cols if c.lower().replace(' ', '_') == col), col)
                        print(f"   - {original_col}")
                
                # 5. Résumé des problèmes pour cette table
                print(f"\n📋 RÉSUMÉ TABLE {table.upper()}:")
                
                # Compter les problèmes
                problems_count = 0
                lost_data_count = 0
                
                for ligne_idx in range(min(excel_rows, csv_rows)):
                    excel_row = df_excel.iloc[ligne_idx]
                    csv_row = df_csv.iloc[ligne_idx]
                    csv_dict = dict(zip(df_csv.columns, csv_row))
                    
                    for col_excel in df_excel.columns:
                        excel_val = excel_row[col_excel]
                        
                        # Trouver colonne CSV correspondante
                        possible_csv_cols = [
                            col_excel, col_excel.lower(), col_excel.replace(' ', '_'),
                            col_excel.lower().replace(' ', '_')
                        ]
                        
                        csv_val = None
                        for possible_col in possible_csv_cols:
                            if possible_col in csv_dict:
                                csv_val = csv_dict[possible_col]
                                break
                        
                        excel_clean = str(excel_val).strip() if pd.notna(excel_val) else None
                        csv_clean = str(csv_val).strip() if pd.notna(csv_val) else None
                        
                        if excel_clean is not None and csv_clean is None:
                            lost_data_count += 1
                        elif excel_clean != csv_clean and excel_clean is not None and csv_clean is not None:
                            problems_count += 1
                
                if lost_data_count == 0 and problems_count == 0:
                    print("   ✅ Conversion parfaite")
                else:
                    if lost_data_count > 0:
                        print(f"   ❌ {lost_data_count} valeurs perdues")
                    if problems_count > 0:
                        print(f"   🔄 {problems_count} valeurs modifiées")
                
                # Vérifier l'ordre des lignes (par ID si disponible)
                if 'id' in df_excel.columns and 'id' in df_csv.columns:
                    excel_ids = df_excel['id'].head(3).tolist()
                    csv_ids = df_csv['id'].head(3).tolist()
                    
                    if excel_ids != csv_ids:
                        print(f"   ⚠️ ORDRE DES LIGNES DIFFÉRENT")
                        print(f"      Excel IDs: {excel_ids}")
                        print(f"      CSV IDs: {csv_ids}")
                
            except Exception as e:
                print(f"❌ Erreur pour table {table}: {e}")
        
        # 6. Résumé global
        print(f"\n{'='*100}")
        print(f"📊 RÉSUMÉ GLOBAL DE LA CONVERSION EXCEL → CSV")
        print(f"{'='*100}")
        
        print(f"\n💡 RECOMMANDATIONS:")
        print(f"1. Vérifier le script reimport_prepare.py")
        print(f"2. S'assurer que toutes les colonnes Excel sont mappées")
        print(f"3. Préserver l'ordre des lignes (tri par ID)")
        print(f"4. Gérer correctement les valeurs NULL/NaN")
        print(f"5. Conserver les types de données (pas de troncature)")
        
    except Exception as e:
        print(f"❌ Erreur générale: {e}")

if __name__ == "__main__":
    compare_excel_vs_csv_detailed()
