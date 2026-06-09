#!/usr/bin/env python3
"""
Audit profond :
1. Les 12 geocoded suspects POINT(0.0758, 11.0687)
2. Les geocoded avec coords rondes
3. Les inferred = tous au meme centroide ADM3
4. Plan de correction : inferred -> adm_random_cell
"""
import psycopg2, json

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

def main():
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()

    # ─── 1. Qui sont les 12 geocoded a (0.0758, 11.0687) ? ──────────────────
    print("=" * 70)
    print("1. LES 12 GEOCODED SUSPECTS POINT(0.0758, 11.0687)")
    print("=" * 70)
    cur.execute("""
        SELECT id::text, code, source, adm1_name, adm2_name, adm3_name,
               ST_X(geom) lon, ST_Y(geom) lat,
               location_accuracy_m,
               meta::text
        FROM atlas.sondages
        WHERE deleted_at IS NULL
          AND location_mode = 'geocoded'
          AND ROUND(ST_X(geom)::numeric,4) = 0.0758
          AND ROUND(ST_Y(geom)::numeric,4) = 11.0687
        ORDER BY code
    """)
    rows = cur.fetchall()
    print(f"  N={len(rows)}")
    for r in rows:
        print(f"  {r[1]:30s} adm3={r[5]} lon={r[6]:.4f} lat={r[7]:.4f}")

    # Est-ce un autre centroide fallback ?
    cur.execute("""
        SELECT adm3_fr, adm2_fr, adm1_fr,
               ST_AsText(ST_Centroid(geom)) AS centroid
        FROM atlas.adm3
        WHERE ST_DWithin(
            ST_Centroid(geom),
            ST_SetSRID(ST_MakePoint(0.0758, 11.0687), 4326),
            0.01
        )
    """)
    adm_close = cur.fetchall()
    if adm_close:
        print(f"\n  ADM3 proche de ce point:")
        for a in adm_close:
            print(f"    {a[0]} ({a[1]}, {a[2]}) centroid={a[3]}")

    # ─── 2. Tous les geocoded avec coords rondes (< 4 dec) ──────────────────
    print("\n" + "=" * 70)
    print("2. GEOCODED AVEC COORDONNEES RONDES (potentiels centroide-fallback)")
    print("=" * 70)
    cur.execute("""
        SELECT id::text, code, source,
               ST_X(geom) lon, ST_Y(geom) lat,
               adm3_name, maille_code
        FROM atlas.sondages
        WHERE deleted_at IS NULL AND location_mode = 'geocoded'
          AND (
               -- Coords avec peu de decimales significatives
               ROUND(ST_X(geom)::numeric, 4) = ST_X(geom)::numeric::numeric(10,4)
               OR ROUND(ST_Y(geom)::numeric, 4) = ST_Y(geom)::numeric::numeric(10,4)
          )
        ORDER BY code
    """)
    # Alternative : detecter les points partages par plusieurs sondages
    cur.execute("""
        SELECT ST_X(geom)::numeric(10,6) lon, ST_Y(geom)::numeric(10,6) lat,
               COUNT(*) n,
               STRING_AGG(code, ', ' ORDER BY code) codes,
               MAX(adm3_name) adm3
        FROM atlas.sondages
        WHERE deleted_at IS NULL AND location_mode = 'geocoded'
        GROUP BY ST_X(geom)::numeric(10,6), ST_Y(geom)::numeric(10,6)
        HAVING COUNT(*) > 1
        ORDER BY n DESC
    """)
    rows = cur.fetchall()
    if rows:
        print(f"  Points partages par plusieurs sondages geocoded:")
        for lon, lat, n, codes, adm3 in rows:
            print(f"  POINT({lon}, {lat}) n={n} adm3={adm3}")
            print(f"    Codes: {codes[:80]}")
    else:
        print("  Aucun point partage -> les 185 geocoded ont bien des coords individuelles !")

    # ─── 3. Analyse des inferred (tous au centroide ADM3) ───────────────────
    print("\n" + "=" * 70)
    print("3. SONDAGES INFERRED — CENTROIDE vs RANDOM")
    print("=" * 70)
    cur.execute("""
        SELECT ST_X(geom)::numeric(10,4) lon, ST_Y(geom)::numeric(10,4) lat,
               COUNT(*) n,
               MAX(adm3_name) adm3,
               MAX(adm2_name) adm2,
               MAX(adm1_name) adm1,
               STRING_AGG(DISTINCT maille_code, ', ') mailles
        FROM atlas.sondages
        WHERE deleted_at IS NULL AND location_mode = 'inferred'
        GROUP BY ST_X(geom)::numeric(10,4), ST_Y(geom)::numeric(10,4)
        ORDER BY n DESC
        LIMIT 20
    """)
    rows = cur.fetchall()
    total_concentres = sum(r[2] for r in rows if r[2] > 1)
    print(f"  Centroïdes partages (>1 sondage): {len([r for r in rows if r[2] > 1])}")
    print(f"  Sondages dans ces centroïdes     : {total_concentres}")
    print(f"\n  {'Centroide':35s} {'N':>4}  {'ADM3':25s}  {'ADM1':12s}  Maille(s)")
    print("  " + "-" * 100)
    for lon, lat, n, adm3, adm2, adm1, mailles in rows:
        if n > 1:
            print(f"  POINT({lon},{lat}) {n:4d}  {str(adm3):<25}  {str(adm1):<12}  {mailles}")

    # Total inferred vs leurs ADM3 distincts
    cur.execute("SELECT COUNT(*), COUNT(DISTINCT adm3_name), COUNT(DISTINCT maille_code) FROM atlas.sondages WHERE deleted_at IS NULL AND location_mode='inferred'")
    tot, adm3_ct, mailles_ct = cur.fetchone()
    print(f"\n  Total inferred     : {tot}")
    print(f"  ADM3 distincts     : {adm3_ct}")
    print(f"  Mailles distinctes : {mailles_ct}")
    print(f"  -> Chaque ADM3 = 1 maille (centroide) au lieu de N mailles (si random)")

    # ─── 4. Verifier si random_point_in_polygon existe ──────────────────────
    print("\n" + "=" * 70)
    print("4. FONCTION adm_random disponible ?")
    print("=" * 70)
    cur.execute("""
        SELECT proname, pronargs FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE proname IN ('random_point_in_polygon', 'random_point_in_adm3', 'adm3_random_point')
    """)
    funcs = cur.fetchall()
    if funcs:
        for f in funcs:
            print(f"  Fonction trouvee: {f[0]}() ({f[1]} args)")
    else:
        print("  Aucune fonction random_point trouvee -> utiliser ST_GeneratePoints ou calcul Python")

    # Tester ST_GeneratePoints
    cur.execute("""
        SELECT ST_AsText(
            (ST_Dump(ST_GeneratePoints(geom, 1))).geom
        ) AS random_pt
        FROM atlas.adm3 WHERE gid = 235 LIMIT 1
    """)
    r = cur.fetchone()
    if r:
        print(f"  ST_GeneratePoints disponible: {r[0][:40]}")

    # ─── 5. Plan de correction : compter ce qui sera change ─────────────────
    print("\n" + "=" * 70)
    print("5. PLAN DE CORRECTION")
    print("=" * 70)
    cur.execute("""
        SELECT COUNT(*) FROM atlas.sondages
        WHERE deleted_at IS NULL
          AND location_mode = 'inferred'
          AND adm3_id IS NOT NULL
    """)
    n_correctable = cur.fetchone()[0]
    print(f"  inferred avec adm3_id -> random_cell : {n_correctable}")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.sondages
        WHERE deleted_at IS NULL
          AND location_mode = 'inferred'
          AND adm3_id IS NULL
    """)
    n_no_adm3 = cur.fetchone()[0]
    print(f"  inferred SANS adm3_id (probleme)    : {n_no_adm3}")

    # Pour les geocoded multi-centroide
    cur.execute("""
        SELECT COUNT(*) FROM atlas.sondages s
        WHERE deleted_at IS NULL
          AND location_mode = 'geocoded'
          AND EXISTS (
            SELECT 1 FROM atlas.sondages s2
            WHERE s2.id != s.id
              AND ST_Equals(s2.geom, s.geom)
              AND s2.deleted_at IS NULL
          )
    """)
    n_geocoded_shared = cur.fetchone()[0]
    print(f"  geocoded avec coord partagee (autre fallback?) : {n_geocoded_shared}")

    conn.close()

if __name__ == "__main__":
    main()
