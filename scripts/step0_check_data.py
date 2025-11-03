import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*60)
print("ÉTAPE 0 : Vérification données en base")
print("="*60)

queries = [
    ("Sondages", "SELECT count(*) FROM sondages"),
    ("Échantillons", "SELECT count(*) FROM echantillons"),
    ("Atterberg", "SELECT count(*) FROM essais_atterberg"),
    ("VBS", "SELECT count(*) FROM essais_vbs"),
]

for name, query in queries:
    cur = conn.execute(query)
    count = cur.fetchone()[0]
    status = "✓" if count > 0 else "✗"
    print(f"{status} {name}: {count}")

conn.close()
