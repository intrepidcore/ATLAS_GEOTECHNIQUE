#!/usr/bin/env python3
"""Compare deux matrices géotechniques et produit un rapport de delta."""

import pandas as pd
import sys
from pathlib import Path

def compare_matrices(before_path: str, after_path: str):
    df_before = pd.read_excel(before_path)
    df_after  = pd.read_excel(after_path)
    
    has_cols = [c for c in df_after.columns if c.startswith('has_data_')]
    
    print("=== Comparaison Matrice Géotechnique ===")
    print(f"Avant : {before_path}")
    print(f"Après : {after_path}")
    print()
    
    total = len(df_after)
    improved = False
    
    for col in has_cols:
        if col not in df_before.columns:
            continue
        
        before_count = (df_before[col] > 0).sum() if pd.api.types.is_numeric_dtype(df_before[col]) else df_before[col].sum() if col in df_before.columns else 0
        after_count  = (df_after[col] > 0).sum() if pd.api.types.is_numeric_dtype(df_after[col]) else df_after[col].sum()
        delta = after_count - before_count
        
        label = col.replace('has_data_', '').replace('_avg', '').upper()
        pct_before = before_count / total * 100
        pct_after  = after_count  / total * 100
        
        status = "✅ amélioration" if delta > 0 else ("⚠️  inchangé" if delta == 0 else "❌ régression")
        print(f"{label:20s} : {before_count:3d}/{total} ({pct_before:5.1f}%) → "
              f"{after_count:3d}/{total} ({pct_after:5.1f}%) {status} ({delta:+d})")
        
        if delta > 0:
            improved = True
    
    print()
    if improved:
        print("✅ Import validé — couverture améliorée sur au moins un essai")
    else:
        print("⚠️  Aucune amélioration détectée — vérifier l'import")

if __name__ == "__main__":
    compare_matrices(sys.argv[1], sys.argv[2])
