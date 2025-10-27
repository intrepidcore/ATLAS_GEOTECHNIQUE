import pandas as pd

file = r"data\xlsx\IMPORT\atlas_import_nicabou_ninsao_vianney.xlsx"

print("="*80)
print("Vérification contenu sondages")
print("="*80)

df = pd.read_excel(file, sheet_name="sondages")
print(f"\n{len(df)} sondages:")
print(df.to_string(index=False))

print("\n" + "="*80)
print("Vérification contenu échantillons")
print("="*80)

df = pd.read_excel(file, sheet_name="echantillons")
print(f"\n{len(df)} échantillons:")
print(df.head(10).to_string(index=False))
