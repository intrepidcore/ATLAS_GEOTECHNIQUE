import pandas as pd
from pathlib import Path

excel_files = [
    Path("data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx"),
    Path("data/xlsx/IMPORT/atlas_import_soglo_ferdinand.xlsx")
]

for excel_file in excel_files:
    if not excel_file.exists():
        print(f"❌ Fichier non trouvé: {excel_file}")
        continue
    
    print(f"\n{'='*80}")
    print(f"📂 Fichier: {excel_file.name}")
    print(f"{'='*80}")
    
    # Lire toutes les feuilles
    excel = pd.ExcelFile(excel_file)
    print(f"Feuilles disponibles: {excel.sheet_names}")
    
    # Chercher Davie dans chaque feuille
    for sheet_name in excel.sheet_names:
        df = pd.read_excel(excel, sheet_name=sheet_name)
        print(f"\n📄 Feuille: {sheet_name}")
        print(f"   Colonnes: {list(df.columns)}")
        print(f"   Lignes: {len(df)}")
        
        # Chercher Davie
        if 'code' in df.columns or 'code_site' in df.columns:
            code_col = 'code' if 'code' in df.columns else 'code_site'
            davie_rows = df[df[code_col].astype(str).str.upper().str.contains('DAVIE', na=False)]
            
            if len(davie_rows) > 0:
                print(f"\n   ✅ Trouvé {len(davie_rows)} lignes DAVIE:")
                print(davie_rows.to_string())
