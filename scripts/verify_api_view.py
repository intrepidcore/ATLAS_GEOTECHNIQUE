import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*70)
print("VÉRIFICATION VUE API")
print("="*70)

# Test vue API
cur = conn.execute("""
    SELECT
      COUNT(*) FILTER (WHERE has_data) AS avec_donnees,
      COUNT(*) FILTER (WHERE NOT has_data) AS sans_donnees,
      COUNT(*) FILTER (WHERE has_spread) AS spread
    FROM public.mailles_geotechnique_stats
""")
row = cur.fetchone()
print(f"\n✓ Vue public.mailles_geotechnique_stats:")
print(f"  - Mailles AVEC données : {row[0]}")
print(f"  - Mailles SANS données : {row[1]}")
print(f"  - Mailles spread : {row[2]}")

# Échantillon
cur = conn.execute("""
    SELECT maille_code, nb_sondages, nb_echantillons, has_data, has_spread,
           ROUND(w_avg::numeric, 2) AS w,
           ROUND(ip_avg::numeric, 2) AS ip,
           ROUND(vbs_avg::numeric, 2) AS vbs
    FROM public.mailles_geotechnique_stats
    WHERE has_data
    LIMIT 5
""")
print("\nÉchantillon de mailles avec données:")
print("code     | sond | ech | data | spread | w_avg | ip_avg | vbs_avg")
print("-" * 70)
for row in cur:
    print(f"{row[0]:8} | {row[1]:4} | {row[2]:3} | {row[3]:4} | {row[4]:6} | {row[5]:5} | {row[6]:6} | {row[7]:7}")

conn.close()

print("\n" + "="*70)
print("✅ VUE API PRÊTE")
print("="*70)
print("\nProchaine étape : Redémarrer l'API")
print("  docker compose up -d api-geo")
print("  Puis Ctrl+Shift+R dans le navigateur")
