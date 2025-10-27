import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

cur = conn.execute("SELECT COUNT(*) FROM v_sondages_spread")
count = cur.fetchone()[0]
print(f"✓ Vue spread : {count} lignes")

if count > 0:
    cur = conn.execute("""
        SELECT code_site, COUNT(DISTINCT maille_id) AS nb_mailles
        FROM v_sondages_spread
        GROUP BY 1
    """)
    print("\nSondages spread sur mailles:")
    for row in cur:
        print(f"  {row[0]}: {row[1]} mailles")
else:
    print("⚠ Aucune ligne - Vérifier que adm3_code dans sondages matche adm3_fr dans la map")

conn.close()
