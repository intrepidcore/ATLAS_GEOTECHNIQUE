#!/usr/bin/env python3
"""Inspecte tous les fichiers de la TODO"""

import json
import pandas as pd
from pathlib import Path

base_dir = Path(r"c:\PROJET_ATLAS_MASTER\atlas")

# Charger la TODO
with open(base_dir / "todo_import.json", "r", encoding="utf-8") as f:
    todo = json.load(f)

files_to_inspect = [
    "data/xlsx/ABGBANA_Essi_Odette.xlsx",
    "data/xlsx/ADOTE Adote emmanuel.xlsx",
    "data/xlsx/AKONDOR Tigana Messanh.xlsx",
    "data/xlsx/ANYO Akouete jean-paul.xlsx",
    "data/xlsx/GAMBAGA Inoussa.xlsx",
    "data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx",
    "data/xlsx/IMPORT/atlas_import_soglo_ferdinand.xlsx",
    "data/xlsx/NABIYOU Warou.xlsx",
    "data/xlsx/NGOAPO-GOLLO Roxane Lenira Chrisie.xlsx",
    "data/xlsx/NICABOU Ninsao Vianney.xlsx",
    "data/xlsx/OUDJABITI Bassirou.xlsx",
    "data/xlsx/SOGLO FERDINAND.xlsx",
    "data/xlsx/TCHALA Komla Hyacinthe.xlsx",
]

results = []

for file_rel in files_to_inspect:
    file_path = base_dir / file_rel
    
    print("="*80)
    print(f"📁 {file_rel}")
    print("="*80)
    
    if not file_path.exists():
        print(f"✗ Fichier introuvable")
        results.append({"file": file_rel, "status": "not_found", "sheets": []})
        continue
    
    try:
        xl = pd.ExcelFile(file_path)
        sheets = xl.sheet_names
        
        print(f"📊 {len(sheets)} feuille(s): {', '.join(sheets)}")
        
        file_info = {
            "file": file_rel,
            "status": "ok",
            "sheets": []
        }
        
        for sheet_name in sheets:
            try:
                df = pd.read_excel(file_path, sheet_name=sheet_name)
                rows = len(df)
                cols = len(df.columns)
                
                print(f"  • {sheet_name}: {rows} lignes × {cols} colonnes")
                
                if rows > 0 and cols > 0:
                    print(f"    Colonnes: {', '.join(df.columns[:5].tolist())}" + 
                          ("..." if len(df.columns) > 5 else ""))
                
                file_info["sheets"].append({
                    "name": sheet_name,
                    "rows": rows,
                    "cols": cols,
                    "columns": df.columns.tolist() if rows > 0 else []
                })
                
            except Exception as e:
                print(f"  ✗ {sheet_name}: Erreur - {e}")
                file_info["sheets"].append({
                    "name": sheet_name,
                    "error": str(e)
                })
        
        results.append(file_info)
        
    except Exception as e:
        print(f"✗ Erreur lecture fichier: {e}")
        results.append({"file": file_rel, "status": "error", "error": str(e)})
    
    print()

# Sauvegarder les résultats
with open(base_dir / "inspection_results.json", "w", encoding="utf-8") as f:
    json.dump({"files": results}, f, indent=2, ensure_ascii=False)

print("="*80)
print("✓ Inspection terminée - Résultats sauvegardés dans inspection_results.json")
print("="*80)

# Résumé
total = len(results)
ok = sum(1 for r in results if r.get("status") == "ok")
empty = sum(1 for r in results if r.get("status") == "ok" and 
            all(s.get("rows", 0) == 0 for s in r.get("sheets", [])))
errors = sum(1 for r in results if r.get("status") in ["error", "not_found"])

print(f"\nRésumé:")
print(f"  Total fichiers: {total}")
print(f"  OK: {ok}")
print(f"  Vides: {empty}")
print(f"  Erreurs: {errors}")
