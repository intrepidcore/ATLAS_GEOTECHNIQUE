import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10, autocommit=True)

sql = open('vue_basique.sql', encoding='utf-8').read()
conn.execute(sql)
print("✓ Vue basique créée")

conn.execute("REFRESH MATERIALIZED VIEW mv_mailles_geotech")
print("✓ Vue rafraîchie")

cur = conn.execute("SELECT * FROM mv_mailles_geotech")
row = cur.fetchone()
print(f"\nDonnées: maille_id={row[0]}, w_avg={row[1]}, ip_avg={row[2]}, vbs_avg={row[3]}, n={row[4]}")

conn.close()
print("\n✅ Vue basique OK - Les données sont accessibles !")
print("L'UI devrait maintenant afficher quelque chose")
print("Rafraîchissez le navigateur (Ctrl+Shift+R)")
