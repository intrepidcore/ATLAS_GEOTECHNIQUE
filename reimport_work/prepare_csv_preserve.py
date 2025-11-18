# prepare_csv_preserve.py
import pandas as pd
import re
from pathlib import Path

IN = Path("../atlas_import.xlsx")
OUT = Path("csv_preserve")
OUT.mkdir(exist_ok=True)

# Liste des feuilles à exporter (ajuster si besoin)
sheets = [
  "sondages", "echantillons", "mailles", "essais_atterberg",
  "essais_classif", "essais_geotechniques", "essais_physiques",
  "essais_vbs", "granulo_points", "granulometrie_points",
  "raw_lab_ags", "raw_lab_agt", "raw_lab_atterberg", "ref_types_essais"
]

def snake_case(s):
    s = re.sub(r'[^0-9a-zA-Z]+', '_', s or '')
    s = re.sub(r'([a-z0-9])([A-Z])', r'\1_\2', s)
    return s.strip('_').lower()

print("🔄 PRÉPARATION CSV FIDÈLES - PRÉSERVATION EXACTE DES DONNÉES EXCEL")
print("=" * 80)

xls = pd.ExcelFile(IN)
available_sheets = [s for s in xls.sheet_names if s.startswith('public.')]

for sheet in sheets:
    full_sheet_name = f"public.{sheet}"
    if full_sheet_name not in available_sheets:
        print(f"⚠️ feuille manquante: {full_sheet_name}")
        continue
    
    print(f"\n📋 Traitement: {sheet}")
    
    # Read without forcing types (preserve original strings/numbers)
    df = pd.read_excel(IN, sheet_name=full_sheet_name, engine="openpyxl", dtype=object)
    
    # Keep original columns order
    orig_cols = list(df.columns)
    print(f"   Colonnes originales: {len(orig_cols)}")
    
    # Make a safe copy of columns mapping (original -> snake)
    col_map = {c: snake_case(c) for c in orig_cols}
    
    # Rename columns to snake_case for downstream consistency
    df_renamed = df.rename(columns=col_map)
    
    # Trim string cells but preserve all values (no conversion)
    df_renamed = df_renamed.applymap(lambda x: x.strip() if isinstance(x, str) else x)
    
    # For CSV header we will use the snake_case names to be consistent with DB scripts
    csv_path = OUT / f"{sheet}.csv"
    df_renamed.to_csv(csv_path, index=False, encoding='utf-8', na_rep='', float_format='%.15g')
    
    # Save a small manifest with original->snake mapping
    with open(OUT / f"{sheet}.columns.map.txt", "w", encoding="utf-8") as f:
        f.write(f"# Mapping colonnes {sheet}\n")
        f.write(f"# Original -> Snake_case\n")
        for orig, snake in col_map.items():
            f.write(f"{orig} -> {snake}\n")
    
    print(f"   ✅ Écrit: {csv_path} ({len(df_renamed.columns)} colonnes, {len(df_renamed)} lignes)")
    print(f"   📋 Mapping: {sheet}.columns.map.txt")

print(f"\n✅ TERMINÉ - CSV préservés dans: {OUT}")
print("📁 Fichiers générés:")
for csv_file in OUT.glob("*.csv"):
    print(f"   - {csv_file.name}")
