import psycopg
import json

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')

# Vérifier les mailles avec des sondages
print("=== Mailles avec des sondages ===")
cur = conn.execute("""
    SELECT code, nb_sondages_real, nb_sondages_spread, has_data
    FROM mv_mailles_geotech
    WHERE has_data = true
    ORDER BY (nb_sondages_real + nb_sondages_spread) DESC
    LIMIT 5
""")
for row in cur:
    print(f"Code: {row[0]}, Real: {row[1]}, Spread: {row[2]}, Has Data: {row[3]}")

# Vérifier spécifiquement Davie
print("\n=== Données Davie ===")
cur = conn.execute("""
    SELECT code, nb_sondages_real, nb_sondages_spread, has_data
    FROM mv_mailles_geotech
    WHERE code LIKE '%DV%'
""")
for row in cur:
    print(f"Code: {row[0]}, Real: {row[1]}, Spread: {row[2]}, Has Data: {row[3]}")

# Vérifier les sondages directement
print("\n=== Sondages avec ADM3 Davie ===")
cur = conn.execute("""
    SELECT id, meta->>'adm3_code' as adm3, loc_mode
    FROM sondages
    WHERE meta->>'adm3_code' LIKE '%DV%'
    LIMIT 5
""")
for row in cur:
    print(f"ID: {row[0]}, ADM3: {row[1]}, Mode: {row[2]}")

# Vérifier v_maille_sondages_all
print("\n=== v_maille_sondages_all pour Davie ===")
cur = conn.execute("""
    SELECT maille_code, sondage_id, sondage_nom, source_mode
    FROM v_maille_sondages_all
    WHERE maille_code LIKE '%DV%'
    LIMIT 5
""")
for row in cur:
    print(f"Maille: {row[0]}, Sondage: {row[1]}, Nom: {row[2]}, Mode: {row[3]}")

conn.close()
