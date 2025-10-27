import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')

davie_id = 'c51ed7af-3d27-4a3f-9ba3-6562fb0460b6'

print("=" * 80)
print("DEBUG: Liaison échantillons → essais")
print("=" * 80)

print("\n1. Échantillons du sondage Davie:")
cur = conn.execute("""
    SELECT id, depth_m, sondage_id
    FROM echantillons
    WHERE sondage_id = %s
    ORDER BY depth_m
""", (davie_id,))
echantillons = cur.fetchall()
for ech in echantillons:
    print(f"  ID: {ech[0]}, depth: {ech[1]}m, sondage_id: {ech[2]}")

if echantillons:
    ech_id = echantillons[0][0]
    print(f"\n2. Essais Atterberg pour l'échantillon {ech_id}:")
    cur = conn.execute("""
        SELECT id, echantillon_id, wl, wp
        FROM essais_atterberg
        WHERE echantillon_id = %s
    """, (ech_id,))
    atterberg = cur.fetchall()
    if atterberg:
        for att in atterberg:
            print(f"  ID: {att[0]}, echantillon_id: {att[1]}, WL: {att[2]}, WP: {att[3]}")
    else:
        print("  ❌ Aucun essai Atterberg trouvé")
    
    print(f"\n3. Essais VBS pour l'échantillon {ech_id}:")
    cur = conn.execute("""
        SELECT id, echantillon_id, vbs
        FROM essais_vbs
        WHERE echantillon_id = %s
    """, (ech_id,))
    vbs = cur.fetchall()
    if vbs:
        for v in vbs:
            print(f"  ID: {v[0]}, echantillon_id: {v[1]}, VBS: {v[2]}")
    else:
        print("  ❌ Aucun essai VBS trouvé")

print("\n4. Tous les essais Atterberg (peu importe le sondage):")
cur = conn.execute("""
    SELECT a.id, a.echantillon_id, a.wl, a.wp, e.depth_m, s.meta->>'code' as code
    FROM essais_atterberg a
    JOIN echantillons e ON e.id = a.echantillon_id
    JOIN sondages s ON s.id = e.sondage_id
    LIMIT 10
""")
for row in cur:
    print(f"  {row[5]} @ {row[4]}m: WL={row[2]}, WP={row[3]}")

print("\n5. Tous les essais VBS (peu importe le sondage):")
cur = conn.execute("""
    SELECT v.id, v.echantillon_id, v.vbs, e.depth_m, s.meta->>'code' as code
    FROM essais_vbs v
    JOIN echantillons e ON e.id = v.echantillon_id
    JOIN sondages s ON s.id = e.sondage_id
    LIMIT 10
""")
for row in cur:
    print(f"  {row[4]} @ {row[3]}m: VBS={row[2]}")

conn.close()
