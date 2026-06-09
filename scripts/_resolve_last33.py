#!/usr/bin/env python3
"""
Resoudre les 33 sondages fallback_default restants par recherche ADM3 ciblee.
"""
import psycopg2

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"


def search(cur, patterns, adm1=None, adm2=None):
    for p in patterns:
        sql = """
            SELECT gid, adm3_fr, adm2_fr, adm1_fr,
                   ST_X(ST_Centroid(geom)) lon, ST_Y(ST_Centroid(geom)) lat
            FROM atlas.adm3 WHERE LOWER(adm3_fr) LIKE LOWER(%s)
        """
        params = [f"%{p}%"]
        if adm1:
            sql += " AND LOWER(adm1_fr) LIKE LOWER(%s)"
            params.append(f"%{adm1}%")
        if adm2:
            sql += " AND LOWER(adm2_fr) LIKE LOWER(%s)"
            params.append(f"%{adm2}%")
        sql += " ORDER BY adm3_fr LIMIT 1"
        cur.execute(sql, params)
        r = cur.fetchone()
        if r:
            return r
    return None


def apply_batch(cur, ids, adm):
    if not ids or not adm:
        return 0
    gid, adm3_fr, adm2_fr, adm1_fr, lon, lat = adm
    ph = ",".join(["%s"] * len(ids))
    cur.execute(f"""
        UPDATE atlas.sondages SET
            geom          = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            adm3_id       = %s, adm3_name = %s, adm2_name = %s, adm1_name = %s,
            location_mode = 'inferred',
            maille_code   = (
                SELECT m.code FROM atlas.mailles m
                WHERE ST_Contains(m.geom, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 25231))
                LIMIT 1),
            updated_at    = NOW()
        WHERE id::text IN ({ph})
          AND location_mode = 'fallback_default'
          AND deleted_at IS NULL
    """, [lon, lat, gid, adm3_fr, adm2_fr, adm1_fr, lon, lat] + list(ids))
    return cur.rowcount


def flag_manual(cur, ids):
    for sid in ids:
        cur.execute("""
            SELECT code FROM atlas.sondages WHERE id::text = %s
        """, [sid])
        row = cur.fetchone()
        code = row[0] if row else sid[:12]
        cur.execute("""
            INSERT INTO atlas.geocode_suggestions
                (sondage_id, sondage_code, locality_extracted, fuzzy_score, source_import, action)
            VALUES (%s::uuid, %s, %s, 0.0, 'V10_MASTER_2026', 'manual_required')
            ON CONFLICT DO NOTHING
        """, [sid, code, code[:20]])


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur  = conn.cursor()

    # Charger les 33 sondages restants
    cur.execute("""
        SELECT id::text, code FROM atlas.sondages
        WHERE location_mode = 'fallback_default' AND deleted_at IS NULL
        ORDER BY code
    """)
    remaining = cur.fetchall()
    print(f"Sondages fallback_default restants: {len(remaining)}")

    # Desactiver triggers
    cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER ALL")
    conn.commit()

    # Mappings explicites bases sur analyse des codes
    # (code_prefix, [search_patterns], adm1, adm2)
    mappings = [
        ("BAF",           ["bafilo", "assoli"],             "kara",      "assoli"),
        ("KABLE",         ["kloto", "kpalime", "kablo"],    "plateaux",  None),
        ("KANTE",         ["dankpen", "natimba", "kante"],  "kara",      None),
        ("KONTONGBONGUE", ["kontong", "kara", "bassar"],    "kara",      None),
        ("KPOGANDJI",     ["vogan", "yoto", "kpog"],        "maritime",  None),
        ("KPOVE",         ["kloto", "kpov", "kpalime"],     "plateaux",  None),
        ("LM2",           ["lome commune", "golfe"],        "maritime",  None),
        ("MESSIWOBE",     ["aneho", "lacs", "messiw"],      "maritime",  None),
        ("TOKOH",         ["yoto", "tabligbo", "tokoh"],    "maritime",  None),
        ("WANOUKOPE",     ["vogan", "wano", "vo"],          "maritime",  "vo"),
    ]

    applied  = 0
    flagged  = 0

    for prefix, patterns, adm1, adm2 in mappings:
        # Recuperer IDs correspondants
        ids = [r[0] for r in remaining if r[1].upper().startswith(prefix.upper())]
        if not ids:
            continue

        adm = search(cur, patterns, adm1, adm2)
        if adm:
            n = apply_batch(cur, ids, adm)
            conn.commit()
            applied += n
            print(f"  APPLIQUE {prefix:20s} {n:2d} -> {adm[1]} ({adm[2]}, {adm[3]})")
        else:
            flag_manual(cur, ids)
            conn.commit()
            flagged += len(ids)
            print(f"  FLAG_MAN {prefix:20s} {len(ids):2d} -> geocode_suggestions")

    # Reactiver triggers
    cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER ALL")
    conn.commit()

    # Refresh MV
    print("Refresh MV...")
    conn.autocommit = True
    cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech")
    conn.autocommit = False

    # Bilan
    print(f"\n=== BILAN ===")
    cur.execute("SELECT location_mode, COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL GROUP BY location_mode ORDER BY COUNT(*) DESC")
    for mode, n in cur.fetchall():
        print(f"  {str(mode):<25}: {n}")

    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE location_mode='fallback_default' AND deleted_at IS NULL")
    n_left = cur.fetchone()[0]
    print(f"\n  fallback_default restants: {n_left}")
    cur.execute("SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data=true")
    print(f"  Mailles has_data=true    : {cur.fetchone()[0]}")

    print(f"\n  Appliques: {applied}")
    print(f"  Flagges manuel: {flagged}")

    conn.close()
    return 0 if n_left == 0 else 2


if __name__ == "__main__":
    import sys
    sys.exit(main())
