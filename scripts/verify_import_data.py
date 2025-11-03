import psycopg
import json

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')

print("=" * 80)
print("VÉRIFICATION DES DONNÉES IMPORTÉES")
print("=" * 80)

# 1. Compter les sondages
print("\n1. SONDAGES")
cur = conn.execute("SELECT COUNT(*) FROM sondages")
nb_sondages = cur.fetchone()[0]
print(f"   Total sondages: {nb_sondages}")

cur = conn.execute("""
    SELECT meta->>'code' as code, meta->>'localite' as localite, 
           meta->>'adm3_code' as adm3, date_sondage, 
           ST_X(ST_Transform(geom, 4326)) as lon, 
           ST_Y(ST_Transform(geom, 4326)) as lat
    FROM sondages
    LIMIT 5
""")
print("\n   Exemples de sondages:")
for row in cur:
    lon_str = f"{row[4]:.4f}" if row[4] is not None else "N/A"
    lat_str = f"{row[5]:.4f}" if row[5] is not None else "N/A"
    print(f"   - {row[0]}: {row[1]} (ADM3: {row[2]}) - Date: {row[3]} - GPS: ({lon_str}, {lat_str})")

# 2. Compter les échantillons
print("\n2. ÉCHANTILLONS")
cur = conn.execute("SELECT COUNT(*) FROM echantillons")
nb_echantillons = cur.fetchone()[0]
print(f"   Total échantillons: {nb_echantillons}")

cur = conn.execute("""
    SELECT s.meta->>'code' as code, e.depth_m, e.water_content_w, e.rho_s_gcm3
    FROM echantillons e
    JOIN sondages s ON e.sondage_id = s.id
    LIMIT 5
""")
print("\n   Exemples d'échantillons:")
for row in cur:
    print(f"   - {row[0]} @ {row[1]}m: w={row[2]}%, ρs={row[3]} g/cm³")

# 3. Compter les essais Atterberg
print("\n3. ESSAIS ATTERBERG")
cur = conn.execute("SELECT COUNT(*) FROM essais_atterberg")
nb_atterberg = cur.fetchone()[0]
print(f"   Total essais Atterberg: {nb_atterberg}")

if nb_atterberg > 0:
    cur = conn.execute("""
        SELECT s.meta->>'code' as code, e.depth_m, a.wl, a.wp, a.ip_generated
        FROM essais_atterberg a
        JOIN echantillons e ON a.echantillon_id = e.id
        JOIN sondages s ON e.sondage_id = s.id
        LIMIT 5
    """)
    print("\n   Exemples d'essais Atterberg:")
    for row in cur:
        print(f"   - {row[0]} @ {row[1]}m: WL={row[2]}%, WP={row[3]}%, IP={row[4]}%")

# 4. Compter les essais VBS
print("\n4. ESSAIS VBS")
cur = conn.execute("SELECT COUNT(*) FROM essais_vbs")
nb_vbs = cur.fetchone()[0]
print(f"   Total essais VBS: {nb_vbs}")

if nb_vbs > 0:
    cur = conn.execute("""
        SELECT s.meta->>'code' as code, e.depth_m, v.vbs
        FROM essais_vbs v
        JOIN echantillons e ON v.echantillon_id = e.id
        JOIN sondages s ON e.sondage_id = s.id
        LIMIT 5
    """)
    print("\n   Exemples d'essais VBS:")
    for row in cur:
        print(f"   - {row[0]} @ {row[1]}m: VBS={row[2]} g/100g")

# 5. Compter les essais Proctor
print("\n5. ESSAIS PROCTOR")
cur = conn.execute("SELECT COUNT(*) FROM essais_proctor")
nb_proctor = cur.fetchone()[0]
print(f"   Total essais Proctor: {nb_proctor}")

# 6. Vérifier les sondages avec ADM3
print("\n6. SONDAGES AVEC ADM3")
cur = conn.execute("""
    SELECT meta->>'adm3_code' as adm3, COUNT(*) as nb
    FROM sondages
    WHERE meta->>'adm3_code' IS NOT NULL
    GROUP BY meta->>'adm3_code'
    ORDER BY nb DESC
    LIMIT 10
""")
print("\n   Répartition par ADM3:")
for row in cur:
    print(f"   - {row[0]}: {row[1]} sondages")

# 7. Vérifier les localités
print("\n7. LOCALITÉS")
cur = conn.execute("""
    SELECT meta->>'localite' as localite, COUNT(*) as nb
    FROM sondages
    WHERE meta->>'localite' IS NOT NULL
    GROUP BY meta->>'localite'
    ORDER BY nb DESC
    LIMIT 10
""")
print("\n   Répartition par localité:")
for row in cur:
    print(f"   - {row[0]}: {row[1]} sondages")

# 8. Vérifier si Davie existe
print("\n8. RECHERCHE DAVIE")
cur = conn.execute("""
    SELECT id, meta->>'code' as code, meta->>'localite' as localite, 
           meta->>'adm3_code' as adm3, date_sondage
    FROM sondages
    WHERE meta->>'localite' ILIKE '%dav%'
       OR meta->>'code' ILIKE '%dav%'
""")
davie_sondages = cur.fetchall()
if davie_sondages:
    print(f"\n   Trouvé {len(davie_sondages)} sondages liés à Davie:")
    for row in davie_sondages:
        print(f"   - {row[1]}: {row[2]} (ADM3: {row[3]}) - Date: {row[4]}")
else:
    print("\n   ❌ Aucun sondage trouvé pour Davie")

print("\n" + "=" * 80)
print("RÉSUMÉ")
print("=" * 80)
print(f"Sondages:        {nb_sondages}")
print(f"Échantillons:    {nb_echantillons}")
print(f"Atterberg:       {nb_atterberg}")
print(f"VBS:             {nb_vbs}")
print(f"Proctor:         {nb_proctor}")
print("=" * 80)

conn.close()
