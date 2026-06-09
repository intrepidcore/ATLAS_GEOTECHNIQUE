#!/usr/bin/env python3
import psycopg2
conn = psycopg2.connect("postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean")
cur = conn.cursor()

print("=== REPARTITION MAILLE_CODE ===")
cur.execute("""
    SELECT
        COUNT(*) AS total,
        COUNT(maille_code) AS avec_maille_code,
        COUNT(*) - COUNT(maille_code) AS sans_maille_code,
        COUNT(DISTINCT maille_code) AS mailles_distinctes
    FROM atlas.sondages WHERE deleted_at IS NULL
""")
r = cur.fetchone()
print(f"  Total sondages        : {r[0]}")
print(f"  Avec maille_code      : {r[1]}")
print(f"  SANS maille_code      : {r[2]}  <-- PROBLEME ?")
print(f"  Mailles distinctes    : {r[3]}")

print("\n=== SONDAGES SANS MAILLE_CODE par location_mode ===")
cur.execute("""
    SELECT location_mode, COUNT(*) AS n
    FROM atlas.sondages
    WHERE deleted_at IS NULL AND maille_code IS NULL
    GROUP BY location_mode ORDER BY n DESC
""")
for mode, n in cur.fetchall():
    print(f"  {str(mode):<25}: {n}")

print("\n=== TOP 10 MAILLES LES PLUS DENSES ===")
cur.execute("""
    SELECT maille_code, COUNT(*) AS n
    FROM atlas.sondages
    WHERE deleted_at IS NULL AND maille_code IS NOT NULL
    GROUP BY maille_code ORDER BY n DESC LIMIT 10
""")
for code, n in cur.fetchall():
    print(f"  {code}: {n} sondages")

print("\n=== MAILLES DANS mv_mailles_geotech ===")
cur.execute("""
    SELECT
        COUNT(*) AS total_mv,
        COUNT(*) FILTER (WHERE has_data=true)  AS has_data_true,
        COUNT(*) FILTER (WHERE n_sondages > 0) AS n_sondages_positif,
        MAX(n_sondages) AS max_par_maille
    FROM atlas.mv_mailles_geotech
""")
r = cur.fetchone()
print(f"  Total mailles MV      : {r[0]}")
print(f"  has_data=true         : {r[1]}")
print(f"  n_sondages > 0        : {r[2]}")
print(f"  Max sondages/maille   : {r[3]}")

print("\n=== SONDAGES inferred SANS maille_code ===")
cur.execute("""
    SELECT id::text, code, maille_code, location_mode,
           ST_AsText(geom) AS geom_wkt
    FROM atlas.sondages
    WHERE deleted_at IS NULL
      AND location_mode = 'inferred'
      AND maille_code IS NULL
    LIMIT 10
""")
rows = cur.fetchall()
print(f"  inferred sans maille_code: {len(rows)}")
for r in rows:
    print(f"    {r[1]} | maille={r[2]} | geom={r[4]}")

print("\n=== SONDAGES geocoded SANS maille_code ===")
cur.execute("""
    SELECT COUNT(*) FROM atlas.sondages
    WHERE deleted_at IS NULL AND location_mode = 'geocoded' AND maille_code IS NULL
""")
print(f"  geocoded sans maille_code: {cur.fetchone()[0]}")

print("\n=== GEOM HORS TOGO (lat non dans [6,11] ou lon non dans [-0.2,1.9]) ===")
cur.execute("""
    SELECT location_mode, COUNT(*) AS n
    FROM atlas.sondages
    WHERE deleted_at IS NULL
      AND geom IS NOT NULL
      AND (ST_Y(geom) < 6 OR ST_Y(geom) > 11
        OR ST_X(geom) < -0.2 OR ST_X(geom) > 1.9)
    GROUP BY location_mode ORDER BY n DESC
""")
rows = cur.fetchall()
if rows:
    for mode, n in rows:
        print(f"  {str(mode):<25}: {n} (hors Togo)")
else:
    print("  Aucun sondage hors Togo")

conn.close()
