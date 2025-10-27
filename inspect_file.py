#!/usr/bin/env python3
"""Inspecte un fichier Excel pour découvrir sa structure"""

import sys
import pandas as pd
from pathlib import Path

if len(sys.argv) < 2:
    print("Usage: python inspect_file.py <fichier.xlsx>")
    sys.exit(1)

file_path = Path(sys.argv[1])
if not file_path.exists():
    print(f"✗ Fichier introuvable: {file_path}")
    sys.exit(1)

print("="*80)
print(f"INSPECTION: {file_path.name}")
print("="*80)

# Lire toutes les feuilles
xl = pd.ExcelFile(file_path)
sheets = xl.sheet_names

print(f"\n📊 {len(sheets)} feuille(s) trouvée(s):")
for i, sheet in enumerate(sheets, 1):
    print(f"  {i}. {sheet}")

print("\n" + "="*80)

# Pour chaque feuille, afficher structure
for sheet_name in sheets:
    print(f"\n📄 Feuille: {sheet_name}")
    print("-"*80)
    
    try:
        df = pd.read_excel(file_path, sheet_name=sheet_name)
        
        print(f"Dimensions: {len(df)} lignes × {len(df.columns)} colonnes")
        print(f"\nColonnes ({len(df.columns)}):")
        for col in df.columns:
            dtype = df[col].dtype
            non_null = df[col].notna().sum()
            print(f"  • {col:<40} [{dtype}] ({non_null}/{len(df)} remplis)")
        
        # Aperçu des premières lignes
        if len(df) > 0:
            print(f"\nAperçu (3 premières lignes):")
            print(df.head(3).to_string(index=False, max_cols=10))
        else:
            print("\n⚠ Feuille vide")
            
    except Exception as e:
        print(f"✗ Erreur lecture: {e}")
    
    print("-"*80)

print("\n✓ Inspection terminée")
