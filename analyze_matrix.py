import pandas as pd

file_path = r"c:\PROJET_ATLAS_MASTER\atlas_reclone\data\thematic_maille_matrix_fixed.xlsx"
df = pd.read_excel(file_path)

data_cols = [c for c in df.columns if c.startswith('has_data_') and c != 'has_data_n_sondages']

print("--- GLOBAL MISSING DATA (FALSE values) ---")
for col in data_cols:
    # missing means the boolean flag is False or 0
    missing_count = sum(~df[col].astype(bool))
    print(f"{col}: {missing_count} mailles manquantes ({missing_count/len(df)*100:.1f}%)")

print("\n--- MISSING DATA BY REGION (ADM1) ---")
regions = df['adm1_name'].unique()
for r in regions:
    sub = df[df['adm1_name'] == r]
    print(f"\nRegion: {r} (Total mailles: {len(sub)})")
    for col in data_cols:
        missing_count = sum(~sub[col].astype(bool))
        if missing_count > 0:
            print(f"  - {col}: {missing_count} manquantes ({missing_count/len(sub)*100:.1f}%)")

