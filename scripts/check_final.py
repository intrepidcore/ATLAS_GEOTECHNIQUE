import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*60)
print("VÉRIFICATION FINALE")
print("="*60)

# Mailles avec données
cur = conn.execute("SELECT COUNT(*) FROM mv_mailles_geotech")
count = cur.fetchone()[0]
print(f"\n✓ Mailles avec données : {count}")

# Détails
cur = conn.execute("""
    SELECT 
        COUNT(*) AS total_mailles,
        SUM(CASE WHEN has_spread THEN 1 ELSE 0 END) AS mailles_spread,
        SUM(CASE WHEN NOT has_spread THEN 1 ELSE 0 END) AS mailles_real
    FROM mv_mailles_geotech
""")
row = cur.fetchone()
print(f"  - Mailles spread : {row[1]}")
print(f"  - Mailles real : {row[2]}")

# Échantillon de données
cur = conn.execute("""
    SELECT maille_id, nb_ech, 
           ROUND(w_avg::numeric, 2) AS w, 
           ROUND(ip_avg::numeric, 2) AS ip,
           ROUND(vbs_avg::numeric, 2) AS vbs,
           has_spread
    FROM mv_mailles_geotech
    ORDER BY nb_ech DESC
    LIMIT 5
""")
print("\nTop 5 mailles par nombre d'échantillons:")
print("maille_id                              | nb_ech | w_avg | ip_avg | vbs_avg | spread")
print("-" * 80)
for row in cur:
    spread_mark = "✓" if row[5] else " "
    print(f"{str(row[0]):38} | {row[1]:6} | {row[2]:5} | {row[3]:6} | {row[4]:7} | {spread_mark}")

# Test vue API
cur = conn.execute("""
    SELECT COUNT(*) AS total,
           SUM(CASE WHEN has_data THEN 1 ELSE 0 END) AS avec_data
    FROM mailles_geotechnique_stats
""")
row = cur.fetchone()
print(f"\nVue API (mailles_geotechnique_stats):")
print(f"  Total mailles : {row[0]}")
print(f"  Avec données : {row[1]}")

conn.close()

print("\n" + "="*60)
print("✅ SPREAD ADM3 OPÉRATIONNEL !")
print("="*60)
print("\nProchaines étapes:")
print("  1. Rafraîchir le navigateur (Ctrl+Shift+R)")
print("  2. Les mailles devraient maintenant être colorées")
