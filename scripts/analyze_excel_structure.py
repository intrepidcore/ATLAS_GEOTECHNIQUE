#!/usr/bin/env python3
"""
Script pour analyser la structure des fichiers Excel AMESSEFE
"""
import pandas as pd
import sys

files = [
    ('../data/xlsx/potentielle_de_gonflement.xlsx', 'POTENTIEL DE GONFLEMENT'),
    ('../data/xlsx/bleu.xlsx', 'VBS (BLEU)'),
    ('../data/xlsx/Granulométrie.xlsx', 'GRANULOMÉTRIE'),
    ('../data/xlsx/classification.xlsx', 'CLASSIFICATION')
]

for filepath, name in files:
    print(f"\n{'='*80}")
    print(f"FICHIER: {name}")
    print(f"Path: {filepath}")
    print('='*80)
    
    try:
        xl = pd.ExcelFile(filepath)
        print(f"\nNombre de sheets: {len(xl.sheet_names)}")
        print(f"Sheets: {xl.sheet_names}")
        
        for i, sheet in enumerate(xl.sheet_names[:2]):  # Analyser les 2 premières sheets
            print(f"\n--- Sheet {i+1}/{len(xl.sheet_names)}: '{sheet}' ---")
            df = pd.read_excel(xl, sheet)
            print(f"Shape: {df.shape} (lignes x colonnes)")
            print(f"Columns: {list(df.columns)}")
            
            # Identifier la colonne localité
            localite_col = None
            for col in df.columns:
                if 'localit' in str(col).lower():
                    localite_col = col
                    break
            
            if localite_col:
                print(f"\nColonne localité: '{localite_col}'")
                print(f"Nombre de localités uniques: {df[localite_col].nunique()}")
                print(f"Premières localités: {df[localite_col].dropna().unique()[:5].tolist()}")
            
            # Identifier les colonnes de profondeur
            depth_cols = [col for col in df.columns if any(x in str(col).lower() for x in ['1m', '1.5', '2m', 'profondeur'])]
            if depth_cols:
                print(f"Colonnes de profondeur détectées: {depth_cols}")
            
            # Afficher les 3 premières lignes
            print(f"\nPremières lignes:")
            print(df.head(3).to_string())
            
    except Exception as e:
        print(f"ERREUR: {e}")
        import traceback
        traceback.print_exc()

print(f"\n{'='*80}")
print("ANALYSE TERMINÉE")
print('='*80)
