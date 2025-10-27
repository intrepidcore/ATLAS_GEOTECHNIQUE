import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)
conn.execute("ALTER TABLE sondages DROP CONSTRAINT IF EXISTS check_geocoded_has_geom")
conn.commit()
print("✓ Contrainte supprimée")
conn.close()
