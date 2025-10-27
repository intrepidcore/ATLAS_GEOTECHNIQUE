import psycopg

print("Création des vues spread...")
conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10, autocommit=True)

sql = open('vues_simple.sql', encoding='utf-8').read()
conn.execute(sql)

print("✓ Vues créées")

# Refresh
print("Refresh vue matérialisée...")
conn.execute("REFRESH MATERIALIZED VIEW mv_mailles_geotech")
print("✓ Vue rafraîchie")

# Vérification
cur = conn.execute("SELECT COUNT(*) FROM mv_mailles_geotech")
count = cur.fetchone()[0]
print(f"✓ {count} mailles avec stats")

conn.close()
print("\n✅ TERMINÉ - Les données devraient apparaître dans l'UI !")
print("Rafraîchissez le navigateur (Ctrl+Shift+R)")
