import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

# Vérifier geom
cur = conn.execute("SELECT meta->>'code', geom IS NULL AS no_geom, meta->>'adm3_code' FROM sondages")
print("Sondages:")
for row in cur:
    print(f"  {row[0]}: geom=NULL? {row[1]}, adm3={row[2]}")

# Test manuel du JOIN
cur = conn.execute("""
SELECT s.meta->>'code', a.adm3_fr, COUNT(m.id) AS nb_mailles
FROM sondages s
JOIN adm3 a ON (a.adm3_fr = s.meta->>'adm3_code')
JOIN mailles m ON ST_Intersects(m.geom, a.geom)
WHERE s.geom IS NULL
GROUP BY s.meta->>'code', a.adm3_fr
""")
print("\nTest JOIN spread:")
for row in cur:
    print(f"  {row[0]} ({row[1]}): {row[2]} mailles")

conn.close()
