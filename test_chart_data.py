import psycopg
import json

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')

# Vérifier la structure de v_maille_sondages_all
print("=== Structure de v_maille_sondages_all ===")
cur = conn.execute("""
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_name = 'v_maille_sondages_all'
    ORDER BY ordinal_position
""")
for row in cur:
    print(f"{row[0]}: {row[1]}")

# Tester avec une maille qui a des données
print("\n=== Test avec TG-0496-0212-01 ===")
cur = conn.execute("SELECT api_panel_cell('TG-0496-0212-01')")
result = cur.fetchone()[0]
print(json.dumps(result, indent=2, ensure_ascii=False))

# Vérifier les données brutes de cette maille
print("\n=== Données brutes de v_maille_sondages_all ===")
cur = conn.execute("""
    SELECT *
    FROM v_maille_sondages_all
    WHERE maille_code = 'TG-0496-0212-01'
    LIMIT 3
""")
for row in cur:
    print(row)

conn.close()
