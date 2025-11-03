import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

tables = ['raw_lab_agt', 'raw_lab_ags', 'raw_lab_atterberg']

print("="*60)
print("Vérification tables RAW")
print("="*60)

for table in tables:
    try:
        cur = conn.execute(f"SELECT COUNT(*) FROM {table}")
        count = cur.fetchone()[0]
        print(f"✓ {table}: {count} lignes")
    except Exception as e:
        print(f"✗ {table}: {e}")

conn.close()
