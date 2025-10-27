import psycopg
import json

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')

print("=" * 80)
print("VÉRIFICATION DES DONNÉES DAVIE POUR LES GRAPHIQUES")
print("=" * 80)

# 1. Trouver le sondage Davie
print("\n1. SONDAGE DAVIE")
cur = conn.execute("""
    SELECT id, meta->>'code' as code, meta->>'localite' as localite, 
           meta->>'adm3_code' as adm3, loc_mode
    FROM sondages
    WHERE meta->>'localite' = 'Davie'
""")
davie = cur.fetchone()
if davie:
    davie_id = davie[0]
    print(f"   ID: {davie_id}")
    print(f"   Code: {davie[1]}")
    print(f"   Localité: {davie[2]}")
    print(f"   ADM3: {davie[3]}")
    print(f"   Mode: {davie[4]}")
else:
    print("   ❌ Sondage Davie non trouvé")
    conn.close()
    exit()

# 2. Vérifier les échantillons
print("\n2. ÉCHANTILLONS DAVIE")
cur = conn.execute("""
    SELECT id, depth_m, water_content_w, rho_s_gcm3
    FROM echantillons
    WHERE sondage_id = %s
    ORDER BY depth_m
""", (davie_id,))
echantillons = cur.fetchall()
print(f"   Total: {len(echantillons)}")
for ech in echantillons:
    print(f"   - ID: {ech[0]}, Profondeur: {ech[1]}m, w: {ech[2]}%, ρs: {ech[3]} g/cm³")

# 3. Vérifier les essais Atterberg
print("\n3. ESSAIS ATTERBERG DAVIE")
cur = conn.execute("""
    SELECT a.id, e.depth_m, a.wl, a.wp, a.ip_generated
    FROM essais_atterberg a
    JOIN echantillons e ON a.echantillon_id = e.id
    WHERE e.sondage_id = %s
    ORDER BY e.depth_m
""", (davie_id,))
atterberg = cur.fetchall()
print(f"   Total: {len(atterberg)}")
for att in atterberg:
    print(f"   - Profondeur: {att[1]}m, WL: {att[2]}%, WP: {att[3]}%, IP: {att[4]}%")

# 4. Vérifier les essais VBS
print("\n4. ESSAIS VBS DAVIE")
cur = conn.execute("""
    SELECT v.id, e.depth_m, v.vbs
    FROM essais_vbs v
    JOIN echantillons e ON v.echantillon_id = e.id
    WHERE e.sondage_id = %s
    ORDER BY e.depth_m
""", (davie_id,))
vbs = cur.fetchall()
print(f"   Total: {len(vbs)}")
for v in vbs:
    print(f"   - Profondeur: {v[1]}m, VBS: {v[2]} g/100g")

# 5. Vérifier la maille associée
print("\n5. MAILLE ASSOCIÉE")
cur = conn.execute("""
    SELECT maille_code, source
    FROM v_maille_sondages_all
    WHERE sondage_id = %s
""", (davie_id,))
mailles = cur.fetchall()
if mailles:
    print(f"   Total mailles: {len(mailles)}")
    for m in mailles:
        print(f"   - Maille: {m[0]}, Source: {m[1]}")
        
        # Tester api_panel_cell pour cette maille
        print(f"\n   Test api_panel_cell('{m[0]}'):")
        cur2 = conn.execute("SELECT api_panel_cell(%s)", (m[0],))
        result = cur2.fetchone()[0]
        print(json.dumps(result, indent=4, ensure_ascii=False))
else:
    print("   ❌ Aucune maille associée")
    
    # Vérifier pourquoi
    print("\n   Diagnostic:")
    cur = conn.execute("""
        SELECT 
            s.id,
            s.meta->>'adm3_code' as adm3_code,
            s.loc_mode,
            s.geom IS NOT NULL as has_geom,
            s.geom_real IS NOT NULL as has_geom_real
        FROM sondages s
        WHERE s.id = %s
    """, (davie_id,))
    diag = cur.fetchone()
    print(f"   - ADM3 code: {diag[1]}")
    print(f"   - loc_mode: {diag[2]}")
    print(f"   - has_geom: {diag[3]}")
    print(f"   - has_geom_real: {diag[4]}")
    
    # Vérifier si l'ADM3 existe dans ref_adm3
    if diag[1]:
        cur = conn.execute("""
            SELECT adm3_pcode, adm3_name, adm2_name, adm1_name
            FROM ref_adm3
            WHERE adm3_pcode = %s
        """, (diag[1],))
        adm3_ref = cur.fetchone()
        if adm3_ref:
            print(f"\n   ADM3 trouvé dans ref_adm3:")
            print(f"   - Code: {adm3_ref[0]}")
            print(f"   - Nom: {adm3_ref[1]}")
            print(f"   - ADM2: {adm3_ref[2]}")
            print(f"   - ADM1: {adm3_ref[3]}")
        else:
            print(f"\n   ❌ ADM3 '{diag[1]}' non trouvé dans ref_adm3")

print("\n" + "=" * 80)

conn.close()
