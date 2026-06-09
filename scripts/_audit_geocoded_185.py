#!/usr/bin/env python3
"""
Audit exhaustif des 185 sondages reclassifies 'geocoded'
+ verification des mailles surpeuplees
"""
import psycopg2, json

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

def main():
    conn = psycopg2.connect(DB_URL)
    cur  = conn.cursor()

    # ─── 1. Audit des 185 sondages 'geocoded' ───────────────────────────────
    print("=" * 70)
    print("AUDIT DES 185 SONDAGES location_mode='geocoded'")
    print("=" * 70)

    cur.execute("""
        SELECT
            id::text, code, source,
            ST_X(geom) AS lon, ST_Y(geom) AS lat,
            maille_code, adm1_name, adm2_name, adm3_name,
            location_accuracy_m,
            meta::text,
            -- Est-ce que la geom est dans le Togo ?
            (ST_X(geom) BETWEEN -0.2 AND 1.9
             AND ST_Y(geom) BETWEEN 6.0 AND 11.2) AS in_togo,
            -- Est-ce que geom = centroide d'ADM3 (coords rondes)?
            (ROUND(ST_X(geom)::numeric, 3) = ROUND(ST_X(geom)::numeric, 3)) AS geom_ok
        FROM atlas.sondages
        WHERE location_mode = 'geocoded'
          AND deleted_at IS NULL
        ORDER BY source, code
    """)
    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]

    print(f"\nTotal geocoded: {len(rows)}")

    # Stats globales
    in_togo     = sum(1 for r in rows if r[cols.index('in_togo')])
    out_togo    = sum(1 for r in rows if not r[cols.index('in_togo')])
    has_acc     = sum(1 for r in rows if r[cols.index('location_accuracy_m')] is not None)
    has_meta    = sum(1 for r in rows if r[cols.index('meta')] and r[cols.index('meta')] != 'null')

    print(f"  Dans le Togo (lon[-0.2,1.9] lat[6,11.2]): {in_togo}")
    print(f"  HORS du Togo                            : {out_togo}  <-- ANOMALIE")
    print(f"  Avec location_accuracy_m                : {has_acc}")
    print(f"  Avec meta JSON                          : {has_meta}")

    # Sondages hors Togo
    if out_togo > 0:
        print(f"\n--- {out_togo} SONDAGES HORS TOGO ---")
        for r in rows:
            d = dict(zip(cols, r))
            if not d['in_togo']:
                print(f"  {d['code']:35s} lon={d['lon']:8.4f} lat={d['lat']:8.4f} | "
                      f"maille={d['maille_code']} | source={d['source']}")

    # Coordonnees suspectes (lon/lat trop rondes = centroide ADM3 ?)
    print(f"\n--- COORDONNEES SUSPECTES (arrondi >= 2 decimales) ---")
    suspicious = []
    for r in rows:
        d = dict(zip(cols, r))
        lon, lat = d['lon'], d['lat']
        if lon is None or lat is None:
            continue
        lon_str = f"{lon:.6f}"
        lat_str = f"{lat:.6f}"
        # Detecter les coords tres rondes (= centroide ADM3 probable)
        lon_decimals = len(lon_str.rstrip('0').split('.')[-1]) if '.' in lon_str else 0
        lat_decimals = len(lat_str.rstrip('0').split('.')[-1]) if '.' in lat_str else 0
        if lon_decimals <= 2 or lat_decimals <= 2:
            suspicious.append(d)
    print(f"  Coords tres rondes (probable centroide ADM3): {len(suspicious)}")
    for d in suspicious[:20]:
        print(f"  {d['code']:35s} lon={d['lon']:.4f} lat={d['lat']:.4f} | adm3={d['adm3_name']}")
    if len(suspicious) > 20:
        print(f"  ... et {len(suspicious)-20} autres")

    # Verifier meta pour coords GPS reelles
    print(f"\n--- ANALYSE META JSON pour coords GPS ---")
    meta_with_gps = 0
    meta_without_gps = 0
    for r in rows:
        d = dict(zip(cols, r))
        if d['meta'] and d['meta'] != 'null':
            try:
                m = json.loads(d['meta'])
                if any(k in m for k in ['latitude','longitude','lat','lon','x','y','gps_lat','gps_lon']):
                    meta_with_gps += 1
                else:
                    meta_without_gps += 1
            except:
                pass
    print(f"  meta avec coords GPS identifiables: {meta_with_gps}")
    print(f"  meta sans coords GPS              : {meta_without_gps}")

    # Distribution par source
    print(f"\n--- DISTRIBUTION PAR SOURCE ---")
    cur.execute("""
        SELECT source, COUNT(*) AS n,
               COUNT(*) FILTER (WHERE ST_X(geom) BETWEEN -0.2 AND 1.9
                                  AND ST_Y(geom) BETWEEN 6.0 AND 11.2) AS in_togo
        FROM atlas.sondages
        WHERE location_mode = 'geocoded' AND deleted_at IS NULL
        GROUP BY source ORDER BY n DESC
    """)
    for src, n, it in cur.fetchall():
        print(f"  {str(src):<35}: {n} total, {it} dans Togo, {n-it} hors Togo")

    # ─── 2. Mailles surpeuplees ─────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("MAILLES LES PLUS DENSES — AUDIT DETAILLE")
    print("=" * 70)

    cur.execute("""
        SELECT maille_code, COUNT(*) AS n,
               STRING_AGG(DISTINCT location_mode::text, ', ') AS modes,
               STRING_AGG(DISTINCT source, ', ' ORDER BY source) AS sources
        FROM atlas.sondages
        WHERE deleted_at IS NULL AND maille_code IS NOT NULL
        GROUP BY maille_code
        HAVING COUNT(*) >= 5
        ORDER BY n DESC
        LIMIT 20
    """)
    mailles_denses = cur.fetchall()
    print(f"\nMailles avec >= 5 sondages: {len(mailles_denses)}")
    print(f"\n{'Maille':25s} {'N':>4}  {'Modes':40s}  Source")
    print("-" * 100)
    for code, n, modes, sources in mailles_denses:
        print(f"{code:25s} {n:4d}  {str(modes):<40s}  {str(sources)[:40]}")

    # Detail des sondages dans la maille la plus dense
    top_maille = mailles_denses[0][0] if mailles_denses else None
    if top_maille:
        print(f"\n--- DETAIL MAILLE {top_maille} ({mailles_denses[0][1]} sondages) ---")
        cur.execute("""
            SELECT code, location_mode,
                   ROUND(ST_X(geom)::numeric, 4) AS lon,
                   ROUND(ST_Y(geom)::numeric, 4) AS lat,
                   source, adm3_name
            FROM atlas.sondages
            WHERE maille_code = %s AND deleted_at IS NULL
            ORDER BY code
        """, [top_maille])
        for r in cur.fetchall():
            print(f"  {r[0]:35s} mode={str(r[1]):<20} lon={r[2]} lat={r[3]} | {r[5]}")

    # ─── 3. Verif: combien de mailles ont des coords identiques (centroide) ─
    print("\n" + "=" * 70)
    print("SONDAGES PARTAGEANT LA MEME COORDONNEE EXACTE (probleme centroide)")
    print("=" * 70)

    cur.execute("""
        SELECT ST_AsText(geom) AS pt, COUNT(*) AS n,
               STRING_AGG(DISTINCT location_mode::text, ', ') AS modes,
               STRING_AGG(DISTINCT maille_code, ', ' ORDER BY maille_code) AS mailles
        FROM atlas.sondages
        WHERE deleted_at IS NULL
        GROUP BY geom
        HAVING COUNT(*) > 3
        ORDER BY n DESC
        LIMIT 15
    """)
    print(f"\n{'Point':35s} {'N':>4}  {'Modes':35s}  Mailles")
    print("-" * 110)
    for pt, n, modes, mailles in cur.fetchall():
        pt_short = pt[:33] if pt else '?'
        print(f"{pt_short:35s} {n:4d}  {str(modes):<35s}  {str(mailles)[:25]}")

    # ─── 4. Synthese ────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("SYNTHESE — QUALITE DU GEOCODAGE")
    print("=" * 70)
    cur.execute("""
        SELECT
            COUNT(*) AS total,
            COUNT(*) FILTER (WHERE ST_X(geom) BETWEEN -0.2 AND 1.9
                               AND ST_Y(geom) BETWEEN 6.0 AND 11.2)  AS in_togo,
            COUNT(*) FILTER (WHERE NOT (ST_X(geom) BETWEEN -0.2 AND 1.9
                               AND ST_Y(geom) BETWEEN 6.0 AND 11.2)) AS hors_togo,
            COUNT(DISTINCT maille_code)                               AS mailles_uniques,
            COUNT(DISTINCT geom)                                       AS geoms_uniques
        FROM atlas.sondages
        WHERE deleted_at IS NULL
    """)
    r = cur.fetchone()
    print(f"  Total sondages         : {r[0]}")
    print(f"  Dans le Togo           : {r[1]}")
    print(f"  HORS du Togo           : {r[2]}  <-- a corriger")
    print(f"  Mailles uniques        : {r[3]}")
    print(f"  Geometries uniques     : {r[4]}")
    print(f"  Ratio sondages/maille  : {r[0]/r[3]:.1f}")

    conn.close()

if __name__ == "__main__":
    main()
