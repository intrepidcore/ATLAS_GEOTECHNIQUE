import psycopg
import json

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')
cur = conn.execute("SELECT api_panel_cell('ADM3_CM_CE_LK_DV_01')")
result = cur.fetchone()[0]
conn.close()

print(json.dumps(result, indent=2, ensure_ascii=False))
