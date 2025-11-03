#!/usr/bin/env python3
"""Corrige LP en PL dans le fichier soglo_ferdinand"""

import pandas as pd
from pathlib import Path

file_path = Path(r"data\xlsx\IMPORT\atlas_import_soglo_ferdinand.xlsx")

print("="*80)
print("Correction LP → PL dans atterberg_raw")
print("="*80)

# Lire le fichier
df = pd.read_excel(file_path, sheet_name="atterberg_raw")

print(f"\nAvant correction:")
print(f"  LL: {(df['test_type'] == 'LL').sum()}")
print(f"  PL: {(df['test_type'] == 'PL').sum()}")
print(f"  LP: {(df['test_type'] == 'LP').sum()}")

# Corriger LP → PL
df['test_type'] = df['test_type'].replace('LP', 'PL')

print(f"\nAprès correction:")
print(f"  LL: {(df['test_type'] == 'LL').sum()}")
print(f"  PL: {(df['test_type'] == 'PL').sum()}")
print(f"  LP: {(df['test_type'] == 'LP').sum()}")

# Sauvegarder (écraser la feuille)
with pd.ExcelWriter(file_path, mode='a', if_sheet_exists='replace', engine='openpyxl') as writer:
    df.to_excel(writer, sheet_name='atterberg_raw', index=False)

print(f"\n✓ Fichier corrigé : {file_path}")
