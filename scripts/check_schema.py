import psycopg2
conn = psycopg2.connect("postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")
cur = conn.cursor()
cur.execute("""
    SELECT column_name, data_type, is_nullable, column_default
    FROM information_schema.columns
    WHERE table_schema='atlas' AND table_name='mailles_zones_etude'
    ORDER BY ordinal_position
""")
print("Schema mailles_zones_etude:")
for r in cur.fetchall():
    print(" ", r)
conn.close()
