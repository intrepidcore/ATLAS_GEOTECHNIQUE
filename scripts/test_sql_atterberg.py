import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')

# Test direct de la requête Atterberg pour le sondage Davie
davie_id = 'c51ed7af-3d27-4a3f-9ba3-6562fb0460b6'

print("Test 1: Essais Atterberg directs")
cur = conn.execute("""
    SELECT a.wl, a.wp, a.ip_generated, e.depth_m
    FROM essais_atterberg a
    JOIN echantillons e ON e.id = a.echantillon_id
    WHERE e.sondage_id = %s
    ORDER BY e.depth_m
""", (davie_id,))
for row in cur:
    print(f"  WL={row[0]}, WP={row[1]}, IP={row[2]}, depth={row[3]}")

print("\nTest 2: Agrégation JSONB comme dans api_panel_cell")
cur = conn.execute("""
    SELECT jsonb_agg(jsonb_build_object(
        'depth_m', e.depth_m,
        'wl', a.wl, 
        'wp', a.wp
    ) ORDER BY e.depth_m) AS arr
    FROM essais_atterberg a
    JOIN echantillons e ON e.id = a.echantillon_id
    WHERE e.sondage_id = %s
      AND (a.wl IS NOT NULL OR a.wp IS NOT NULL)
""", (davie_id,))
result = cur.fetchone()[0]
print(f"  Résultat: {result}")

print("\nTest 3: Essais VBS directs")
cur = conn.execute("""
    SELECT v.vbs, e.depth_m
    FROM essais_vbs v
    JOIN echantillons e ON e.id = v.echantillon_id
    WHERE e.sondage_id = %s
    ORDER BY e.depth_m
""", (davie_id,))
for row in cur:
    print(f"  VBS={row[0]}, depth={row[1]}")

print("\nTest 4: Agrégation VBS JSONB")
cur = conn.execute("""
    SELECT jsonb_agg(jsonb_build_object(
        'depth_m', e.depth_m,
        'vbs', v.vbs
    ) ORDER BY e.depth_m) AS arr
    FROM essais_vbs v
    JOIN echantillons e ON e.id = v.echantillon_id
    WHERE e.sondage_id = %s
      AND v.vbs IS NOT NULL
""", (davie_id,))
result = cur.fetchone()[0]
print(f"  Résultat: {result}")

print("\nTest 5: Vérifier la CTE 'sids' dans api_panel_cell")
# Simuler la CTE sids pour la maille TG-0496-0212-01
cur = conn.execute("""
    WITH sids AS (
        SELECT DISTINCT sondage_id
        FROM v_maille_sondages_all
        WHERE maille_code = 'TG-0496-0212-01'
    )
    SELECT sondage_id FROM sids
""")
print("  Sondages dans la maille TG-0496-0212-01:")
for row in cur:
    print(f"    - {row[0]}")

print("\nTest 6: Atterberg via CTE sids (comme dans api_panel_cell)")
cur = conn.execute("""
    WITH sids AS (
        SELECT DISTINCT sondage_id
        FROM v_maille_sondages_all
        WHERE maille_code = 'TG-0496-0212-01'
    )
    SELECT jsonb_agg(jsonb_build_object(
        'depth_m', e.depth_m,
        'wl', a.wl, 
        'wp', a.wp
    ) ORDER BY e.depth_m) AS arr
    FROM essais_atterberg a
    JOIN echantillons e ON e.id = a.echantillon_id
    WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
      AND (a.wl IS NOT NULL OR a.wp IS NOT NULL)
""")
result = cur.fetchone()[0]
print(f"  Résultat Atterberg: {result}")

print("\nTest 7: VBS via CTE sids")
cur = conn.execute("""
    WITH sids AS (
        SELECT DISTINCT sondage_id
        FROM v_maille_sondages_all
        WHERE maille_code = 'TG-0496-0212-01'
    )
    SELECT jsonb_agg(jsonb_build_object(
        'depth_m', e.depth_m,
        'vbs', v.vbs
    ) ORDER BY e.depth_m) AS arr
    FROM essais_vbs v
    JOIN echantillons e ON e.id = v.echantillon_id
    WHERE e.sondage_id IN (SELECT sondage_id FROM sids)
      AND v.vbs IS NOT NULL
""")
result = cur.fetchone()[0]
print(f"  Résultat VBS: {result}")

conn.close()
