import pandas as pd

excel_file = "data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx"

print("="*80)
print("FEUILLE ATTERBERG")
print("="*80)
df = pd.read_excel(excel_file, sheet_name='atterberg')
print(df.to_string())

print("\n"+"="*80)
print("FEUILLE VBS")
print("="*80)
df = pd.read_excel(excel_file, sheet_name='vbs')
print(df.to_string())
