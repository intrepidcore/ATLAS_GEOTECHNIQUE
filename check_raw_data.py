import pandas as pd

file = r"data\xlsx\IMPORT\atlas_import_nicabou_ninsao_vianney.xlsx"

print("="*80)
print("Vérification AGT RAW")
print("="*80)

df = pd.read_excel(file, sheet_name="agt_raw_long")
print(f"\n{len(df)} lignes AGT RAW")
print(f"Colonnes: {df.columns.tolist()}")
print("\nAperçu:")
print(df.head(10).to_string(index=False))

print("\n" + "="*80)
print("Vérification AGS RAW")
print("="*80)

df = pd.read_excel(file, sheet_name="ags_raw_long")
print(f"\n{len(df)} lignes AGS RAW")
print(f"Colonnes: {df.columns.tolist()}")
print("\nAperçu:")
print(df.head(10).to_string(index=False))

# Vérifier les valeurs NULL
print("\n" + "="*80)
print("Valeurs NULL dans AGT RAW")
print("="*80)
df_agt = pd.read_excel(file, sheet_name="agt_raw_long")
for col in df_agt.columns:
    null_count = df_agt[col].isna().sum()
    if null_count > 0:
        print(f"  {col}: {null_count}/{len(df_agt)} NULL")
