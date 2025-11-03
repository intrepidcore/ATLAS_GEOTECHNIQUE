import pandas as pd

df = pd.read_excel('atlas_import_example_1761495185.xlsx', sheet_name='sondages')
print("Sondages:")
print(df.head())
print("\nColonnes:", df.columns.tolist())
print("\nTypes:", df.dtypes)
