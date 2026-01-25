#!/usr/bin/env python3
"""
Rapport détaillé - Comparaison colonne par colonne Excel vs DB
3 premières lignes de chaque table
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

def compare_excel_vs_db_detailed():
    """Comparaison détaillée Excel vs DB - 3 premières lignes"""
    
    print("🔍 RAPPORT DÉTAILLÉ - COMPARAISON EXCEL vs DB (3 PREMIÈRES LIGNES)")
    print("=" * 100)
    
    # Tables à analyser
    tables_to_analyze = [
        'sondages', 'echantillons', 'essais_atterberg', 'essais_geotechniques',
        'essais_physiques', 'essais_vbs', 'granulo_points', 'raw_lab_ags'
    ]
    
    try:
        # Connexion DB
        conn = connect_db()
        cur = conn.cursor()
        
        # Lecture Excel
        xl_file = pd.ExcelFile('atlas_import.xlsx')
        
        for table in tables_to_analyze:
            print(f"\n{'='*100}")
            print(f"📋 TABLE: {table.upper()}")
            print(f"{'='*100}")
            
            sheet_name = f'public.{table}'
            
            try:
                # 1. Lire Excel
                df_excel = pd.read_excel('atlas_import.xlsx', sheet_name=sheet_name)
                excel_rows = min(3, len(df_excel))
                
                # 2. Lire DB
                cur.execute(f"SELECT * FROM public.{table} ORDER BY created_at LIMIT 3")
                db_rows = cur.fetchall()
                
                # Colonnes DB
                cur.execute("""
                    SELECT column_name FROM information_schema.columns 
                    WHERE table_name = %s AND table_schema = 'public'
                    ORDER BY ordinal_position
                """, (table,))
                db_columns = [row[0] for row in cur.fetchall()]
                
                print(f"📊 STATISTIQUES:")
                print(f"   Excel: {len(df_excel)} lignes, {len(df_excel.columns)} colonnes")
                print(f"   DB: {len(db_rows)} lignes, {len(db_columns)} colonnes")
                
                # 3. Comparaison ligne par ligne
                for ligne_idx in range(min(excel_rows, len(db_rows))):
                    print(f"\n🔍 LIGNE {ligne_idx + 1}:")
                    print("-" * 80)
                    
                    excel_row = df_excel.iloc[ligne_idx]
                    db_row = db_rows[ligne_idx]
                    
                    # Créer un dictionnaire des valeurs DB
                    db_dict = dict(zip(db_columns, db_row))
                    
                    # Comparer chaque colonne Excel
                    for col_excel in df_excel.columns:
                        excel_val = excel_row[col_excel]
                        
                        # Trouver la colonne correspondante en DB
                        col_db = col_excel.lower().replace(' ', '_')
                        
                        # Vérifier différentes variantes de noms
                        possible_db_cols = [
                            col_excel,
                            col_excel.lower(),
                            col_excel.replace(' ', '_'),
                            col_excel.lower().replace(' ', '_'),
                            col_excel.replace(' ', ''),
                            col_excel.lower().replace(' ', '')
                        ]
                        
                        db_val = None
                        found_col = None
                        
                        for possible_col in possible_db_cols:
                            if possible_col in db_dict:
                                db_val = db_dict[possible_col]
                                found_col = possible_col
                                break
                        
                        # Nettoyer les valeurs pour comparaison
                        excel_clean = str(excel_val).strip() if pd.notna(excel_val) else None
                        db_clean = str(db_val).strip() if db_val is not None else None
                        
                        # Statut de la comparaison
                        if excel_clean is None and db_clean is None:
                            status = "✅ VIDE→VIDE"
                        elif excel_clean is None and db_clean is not None:
                            status = "⚠️ VIDE→REMPLI"
                        elif excel_clean is not None and db_clean is None:
                            status = "❌ PERDU"
                        elif excel_clean == db_clean:
                            status = "✅ IDENTIQUE"
                        elif excel_clean == 'nan' and db_clean is None:
                            status = "✅ NaN→NULL"
                        else:
                            status = "🔄 MODIFIÉ"
                        
                        # Affichage seulement si problématique ou intéressant
                        if status in ["❌ PERDU", "🔄 MODIFIÉ", "⚠️ VIDE→REMPLI"] or (excel_clean and len(str(excel_clean)) > 0):
                            print(f"   {col_excel:25} | {status:15} | Excel: '{excel_clean}' → DB: '{db_clean}' ({found_col})")
                
                # 4. Colonnes manquantes
                excel_cols = set(df_excel.columns)
                db_cols_lower = set([col.lower().replace(' ', '_') for col in db_columns])
                excel_cols_lower = set([col.lower().replace(' ', '_') for col in excel_cols])
                
                missing_in_db = excel_cols_lower - db_cols_lower
                if missing_in_db:
                    print(f"\n❌ COLONNES PERDUES (Excel → DB):")
                    for col in missing_in_db:
                        original_col = next((c for c in excel_cols if c.lower().replace(' ', '_') == col), col)
                        print(f"   - {original_col}")
                
                extra_in_db = db_cols_lower - excel_cols_lower
                if extra_in_db:
                    print(f"\n➕ COLONNES AJOUTÉES (DB seulement):")
                    for col in extra_in_db:
                        original_col = next((c for c in db_columns if c.lower().replace(' ', '_') == col), col)
                        print(f"   - {original_col}")
                
                # 5. Résumé des problèmes pour cette table
                print(f"\n📋 RÉSUMÉ TABLE {table.upper()}:")
                
                # Compter les problèmes
                problems_count = 0
                for ligne_idx in range(min(excel_rows, len(db_rows))):
                    excel_row = df_excel.iloc[ligne_idx]
                    db_row = db_rows[ligne_idx]
                    db_dict = dict(zip(db_columns, db_row))
                    
                    for col_excel in df_excel.columns:
                        excel_val = excel_row[col_excel]
                        
                        # Trouver colonne DB correspondante
                        possible_db_cols = [
                            col_excel, col_excel.lower(), col_excel.replace(' ', '_'),
                            col_excel.lower().replace(' ', '_')
                        ]
                        
                        db_val = None
                        for possible_col in possible_db_cols:
                            if possible_col in db_dict:
                                db_val = db_dict[possible_col]
                                break
                        
                        excel_clean = str(excel_val).strip() if pd.notna(excel_val) else None
                        db_clean = str(db_val).strip() if db_val is not None else None
                        
                        if excel_clean is not None and db_clean is None:
                            problems_count += 1
                
                if problems_count == 0:
                    print("   ✅ Aucune donnée perdue")
                else:
                    print(f"   ❌ {problems_count} valeurs perdues détectées")
                
            except Exception as e:
                print(f"❌ Erreur pour table {table}: {e}")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur générale: {e}")

if __name__ == "__main__":
    compare_excel_vs_db_detailed()
