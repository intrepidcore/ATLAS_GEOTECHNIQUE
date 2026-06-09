#!/usr/bin/env python3
"""
Lookup ADM3 etendu + application forcee des mappings connus.
Tous les sondages manual_required sont tries:
  - Ceux identifiables par lookup intelligent -> appliques avec mode 'inferred'
  - Les vraiment inconnus -> restes en manual_required dans geocode_suggestions
"""
import psycopg2
import sys

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

def search_adm3(cur, patterns, adm1_hint=None):
    """Cherche un ADM3 en essayant plusieurs patterns."""
    for pattern in patterns:
        sql = """
            SELECT gid, adm3_fr, adm2_fr, adm1_fr,
                   ST_X(ST_Centroid(geom)) AS lon,
                   ST_Y(ST_Centroid(geom)) AS lat
            FROM atlas.adm3
            WHERE LOWER(adm3_fr) LIKE LOWER(%s)
        """
        params = [f"%{pattern}%"]
        if adm1_hint:
            sql += " AND LOWER(adm1_fr) LIKE LOWER(%s)"
            params.append(f"%{adm1_hint}%")
        sql += " ORDER BY adm3_fr LIMIT 1"
        cur.execute(sql, params)
        row = cur.fetchone()
        if row:
            return row
    return None


def apply_geocode(cur, sondage_ids, adm):
    """
    Applique le geocodage ADM3 centroid sur une liste de sondages.
    Desactive/reactive les triggers pour eviter les 185 MV refreshes.
    """
    if not sondage_ids or not adm:
        return 0

    gid, adm3_fr, adm2_fr, adm1_fr, lon, lat = adm

    # Desactiver triggers
    cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER ALL")

    placeholders = ",".join(["%s"] * len(sondage_ids))
    cur.execute(f"""
        UPDATE atlas.sondages
        SET
            geom          = ST_SetSRID(ST_MakePoint(%s, %s), 4326),
            adm3_id       = %s,
            adm3_name     = %s,
            adm2_name     = %s,
            adm1_name     = %s,
            location_mode = 'inferred',
            maille_code   = (
                SELECT m.code FROM atlas.mailles m
                WHERE ST_Contains(m.geom, ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 25231))
                LIMIT 1
            ),
            updated_at    = NOW()
        WHERE id::text IN ({placeholders})
          AND deleted_at IS NULL
          AND location_mode = 'fallback_default'
    """, [lon, lat, gid, adm3_fr, adm2_fr, adm1_fr, lon, lat] + list(sondage_ids))

    n = cur.rowcount

    # Reactiver triggers
    cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER ALL")
    return n


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur  = conn.cursor()

    print("=== RECHERCHE ADM3 ETENDUE ===", flush=True)

    # Recherche manuelle etendue pour les cas problematiques
    extended_lookups = [
        # (display_name, patterns, adm1_hint)
        ("KANTE",     ["kante", "kanti", "kanntindi"],        "kara"),
        ("SOK",       ["sokode", "sokod", "sotouboua"],        "central"),
        ("ETRA",      ["etra", "aveta", "kpele"],              "plateau"),
        ("AGB",       ["agbal", "agoeny", "agoe"],             "maritime"),
        ("BADJA",     ["badja", "badou"],                      "plateau"),
        ("BEDJI",     ["bedji", "vogan", "haho"],              None),
        ("FODJAYE",   ["fodjay", "afagnan", "tabligbo"],       "maritime"),
        ("KPOVE",     ["kpove", "kpalime", "kloto"],           "plateau"),
        ("KPOG",      ["kpog", "kpogam"],                      None),
        ("GBOBLE",    ["gboble", "gblob", "aneho"],            "maritime"),
        ("NASSABLE",  ["nassable", "nassab", "baguida"],       "maritime"),
        ("WANO",      ["wano", "wanouk"],                      None),
        ("WEDEME",    ["wedeme", "wedm", "lome"],              "maritime"),
        ("TOKOH",     ["tokoh", "toko"],                       "maritime"),
        ("SEYDOU",    ["seydou", "togoville", "agoeny"],       "maritime"),
        ("SIM",       ["amoussime", "yoto", "sim"],            "maritime"),
        ("ATRAVE",    ["atrave", "atrave", "agou"],            "plateau"),
        ("TCHEKITA",  ["tchekpo", "tchekita"],                 "maritime"),
        ("MESSIWOBE", ["messiw", "messim"],                    None),
        ("PK",        ["lome commune", "lome"],                "maritime"),
        ("IRANDOMI",  ["irand", "kloto", "agou"],              "plateau"),
        ("KONTONG",   ["kontong", "kantchili"],                "kara"),
        ("KENOUKOPE", ["kenou", "vogan", "kono"],              "maritime"),
        ("KPOGANDJI", ["kpogan", "yoto"],                      "maritime"),
        ("AMENOUKOPE",["amenou", "aneho"],                     "maritime"),
        ("GLITTO",    ["glitto", "glit", "tabligbo"],          "maritime"),
    ]

    resolved = {}  # display_name -> adm row

    for name, patterns, adm1 in extended_lookups:
        row = search_adm3(cur, patterns, adm1)
        if row:
            resolved[name] = row
            print(f"  RESOLU  {name:20s} -> {row[1]} ({row[2]}, {row[3]}) gid={row[0]}", flush=True)
        else:
            print(f"  INCONNU {name:20s} -> [aucun match]", flush=True)

    # Charger les sondages fallback_default restants
    cur.execute("""
        SELECT id::text, code, source
        FROM atlas.sondages
        WHERE location_mode = 'fallback_default'
          AND deleted_at IS NULL
        ORDER BY code
    """)
    sondages = cur.fetchall()
    print(f"\n  {len(sondages)} sondages fallback_default a traiter", flush=True)

    # Grouper par prefix
    groups = {}  # prefix -> [ids]
    for sid, code, source in sondages:
        code_up = code.upper().strip()
        # Determiner le groupe
        matched_group = None
        for name in resolved:
            if code_up.startswith(name.upper()) or (name.upper() in code_up[:12]):
                matched_group = name
                break
        # Cas speciaux
        if not matched_group:
            if code_up.startswith("SOK"):        matched_group = "SOK"
            elif code_up.startswith("KANTE"):    matched_group = "KANTE"
            elif code_up.startswith("ETRA"):     matched_group = "ETRA"
            elif code_up.startswith("AGB"):      matched_group = "AGB"
            elif code_up.startswith("LM2"):      matched_group = "LM2"
            elif code_up.startswith("BAF"):      matched_group = "BAF"
            elif code_up.startswith("PK"):       matched_group = "PK"
            elif code_up.startswith("FODJAYE"):  matched_group = "FODJAYE"
            elif code_up.startswith("KPOVE"):    matched_group = "KPOVE"
            elif code_up.startswith("BEDJI"):    matched_group = "BEDJI"
            elif code_up.startswith("GBOBLE"):   matched_group = "GBOBLE"
            elif code_up.startswith("WANOUKOR") or code_up.startswith("WANOUKOPE"): matched_group = "WANO"
            elif code_up.startswith("WEDEME"):   matched_group = "WEDEME"
            elif code_up.startswith("TOKOH"):    matched_group = "TOKOH"
            elif code_up.startswith("TCHEKITA"): matched_group = "TCHEKITA"
            elif code_up.startswith("AMEN"):     matched_group = "AMENOUKOPE"
            elif code_up.startswith("NASSABLE"): matched_group = "NASSABLE"

        if matched_group not in groups:
            groups[matched_group] = []
        groups[matched_group].append(sid)

    # Appliquer les geocodages resolus
    total_applied = 0
    total_flags   = 0

    print("\n=== APPLICATION GEOCODAGE ===", flush=True)
    for group_name, ids in groups.items():
        if group_name and group_name in resolved:
            adm = resolved[group_name]
            n   = apply_geocode(cur, ids, adm)
            conn.commit()
            total_applied += n
            print(f"  APPLIQUE {group_name:20s} {n:3d} sondages -> {adm[1]} ({adm[2]})", flush=True)
        else:
            # Inserer en manual_required dans geocode_suggestions
            for sid in ids:
                code_row = next((r for r in sondages if r[0] == sid), None)
                code_val = code_row[1] if code_row else ""
                try:
                    cur.execute("""
                        INSERT INTO atlas.geocode_suggestions
                            (sondage_id, sondage_code, locality_extracted, fuzzy_score, source_import, action)
                        VALUES (%s::uuid, %s, %s, 0.0, %s, 'manual_required')
                        ON CONFLICT DO NOTHING
                    """, (sid, code_val, group_name or code_val[:20], "V10_MASTER_2026"))
                    total_flags += 1
                except Exception as e:
                    print(f"    ERREUR insert suggestion {sid}: {e}", flush=True)
                    conn.rollback()
            conn.commit()
            lbl = group_name or "INCONNU"
            print(f"  FLAG_MANUAL {lbl:18s} {len(ids):3d} sondages -> geocode_suggestions", flush=True)

    # Refresh MV une fois
    print("\nRefresh mv_mailles_geotech...", flush=True)
    conn.autocommit = True
    cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech")
    conn.autocommit = False
    print("  MV OK", flush=True)

    # Bilan final
    print("\n=== BILAN FINAL ===", flush=True)
    cur.execute("""
        SELECT location_mode, COUNT(*) FROM atlas.sondages
        WHERE deleted_at IS NULL GROUP BY location_mode ORDER BY COUNT(*) DESC
    """)
    for mode, n in cur.fetchall():
        print(f"  {str(mode):<25}: {n}", flush=True)

    cur.execute("SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data=true")
    print(f"\n  Mailles avec has_data=true: {cur.fetchone()[0]}", flush=True)

    cur.execute("SELECT COUNT(*) FROM atlas.geocode_suggestions WHERE action='manual_required'")
    print(f"  Suggestions manual_required: {cur.fetchone()[0]}", flush=True)

    remaining_fb = next(
        (n for m, n in [
            (r[0], r[1]) for r in [
                (mode, n) for mode, n in
                [(row[0], row[1]) for row in
                 [r for r in (cur.execute("SELECT location_mode, COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL AND location_mode='fallback_default' GROUP BY location_mode"), cur.fetchall())[1]]]
            ]
        ] if m == 'fallback_default'),
        0
    )

    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE location_mode='fallback_default' AND deleted_at IS NULL")
    remaining = cur.fetchone()[0]
    print(f"\n  fallback_default restants: {remaining}", flush=True)

    if remaining == 0:
        print("\n  TOUT GECODE - Lancement calcul ML possible !", flush=True)
    else:
        print(f"\n  {remaining} sondages necessite intervention manuelle dans l'UI", flush=True)

    print(f"\nTotal appliques automatiquement: {total_applied}", flush=True)
    print(f"Total flagges manual            : {total_flags}", flush=True)

    conn.close()
    return 0 if remaining == 0 else 2  # exit 2 = manual required


if __name__ == "__main__":
    sys.exit(main())
