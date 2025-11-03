import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

# Vérifier les codes ADM3 dans sondages
cur = conn.execute("SELECT meta->>'code' AS code, meta->>'adm3_code' AS adm3 FROM sondages")
print("Sondages et leurs ADM3:")
for row in cur:
    print(f"  {row[0]}: {row[1]}")

# Vérifier si ces codes existent dans adm3
print("\nRecherche dans table adm3:")
cur = conn.execute("SELECT DISTINCT adm3_fr FROM adm3 WHERE adm3_fr LIKE '%Keve%' OR adm3_fr LIKE '%Assa%' OR adm3_fr LIKE '%Badja%'")
for row in cur:
    print(f"  - {row[0]}")

# Vérifier spread
cur = conn.execute("SELECT COUNT(*) FROM v_sondages_spread")
count = cur.fetchone()[0]
print(f"\nv_sondages_spread: {count} lignes")

conn.close()
