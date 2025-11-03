import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)
cur = conn.execute("SELECT column_name, data_type FROM information_schema.columns WHERE table_name='adm3' ORDER BY ordinal_position")
print("Colonnes table adm3:")
for row in cur:
    print(f"  - {row[0]}: {row[1]}")

# Vérifier aussi sondages
cur = conn.execute("SELECT meta FROM sondages LIMIT 1")
row = cur.fetchone()
if row:
    print(f"\nExemple meta sondage: {row[0]}")

conn.close()
