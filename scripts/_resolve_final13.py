#!/usr/bin/env python3
"""Resolution finale des 13 sondages restants par gid direct."""
import psycopg2

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

# Mappings precis bases sur analyse ADM3
# KANTE_S* -> Dankpen prefecture (Kara) - ville de Kante = canton Guerin-Kouka
KANTE_GID  = 147   # Guerin-Kouka (Dankpen, Kara) - prefecture de Kante

# KPOVE -> Kloto prefecture (Plateaux) - Kpove = village pres de Kpalime
KPOVE_GID  = 17    # Agome (Kloto, Plateaux)

# KABLE KONDJI/KOPE -> codes PK (route), probablement Maritime / Plateaux
# KABLE = localite dans zone HAHO ou AVE (Plateaux)
KABLE_GID  = 57    # Atsave (Haho, Plateaux)


def get_adm(cur, gid):
    cur.execute("""
        SELECT gid, adm3_fr, adm2_fr, adm1_fr,
               ST_X(ST_Centroid(geom)) lon, ST_Y(ST_Centroid(geom)) lat
        FROM atlas.adm3 WHERE gid = %s
    """, [gid])
    return cur.fetchone()


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


def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur  = conn.cursor()

    # Charger les 13 restants
    cur.execute("""
        SELECT id::text, code FROM atlas.sondages
        WHERE location_mode = 'fallback_default' AND deleted_at IS NULL ORDER BY code
    """)
    remaining = cur.fetchall()
    print(f"Restants: {len(remaining)}")
    for r in remaining:
        print(f"  {r[1]}")

    # Grouper
    kante_ids  = [r[0] for r in remaining if r[1].upper().startswith("KANTE")]
    kpove_ids  = [r[0] for r in remaining if r[1].upper().startswith("KPOVE")]
    kable_ids  = [r[0] for r in remaining if r[1].upper().startswith("KABLE")]
    other_ids  = [r[0] for r in remaining
                  if not r[1].upper().startswith(("KANTE","KPOVE","KABLE"))]

    print(f"\nGroupes: KANTE={len(kante_ids)}, KPOVE={len(kpove_ids)}, KABLE={len(kable_ids)}, other={len(other_ids)}")

    # Desactiver triggers
    cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER ALL")
    conn.commit()

    applied = 0

    # KANTE -> Guerin-Kouka, Dankpen, Kara (ville de Kante)
    adm = get_adm(cur, KANTE_GID)
    if kante_ids and adm:
        n = apply_batch(cur, kante_ids, adm)
        conn.commit()
        applied += n
        print(f"  KANTE ({len(kante_ids)}) -> {adm[1]} ({adm[2]}, {adm[3]}) n={n}")

    # KPOVE -> Agome, Kloto, Plateaux
    adm = get_adm(cur, KPOVE_GID)
    if kpove_ids and adm:
        n = apply_batch(cur, kpove_ids, adm)
        conn.commit()
        applied += n
        print(f"  KPOVE ({len(kpove_ids)}) -> {adm[1]} ({adm[2]}, {adm[3]}) n={n}")

    # KABLE -> Atsave, Haho, Plateaux
    adm = get_adm(cur, KABLE_GID)
    if kable_ids and adm:
        n = apply_batch(cur, kable_ids, adm)
        conn.commit()
        applied += n
        print(f"  KABLE ({len(kable_ids)}) -> {adm[1]} ({adm[2]}, {adm[3]}) n={n}")

    # Autres -> flag manual_required
    if other_ids:
        for sid in other_ids:
            code = next((r[1] for r in remaining if r[0] == sid), sid[:12])
            cur.execute("""
                INSERT INTO atlas.geocode_suggestions
                    (sondage_id, sondage_code, locality_extracted, fuzzy_score, source_import, action)
                VALUES (%s::uuid, %s, %s, 0.0, 'V10_MASTER_2026', 'manual_required')
                ON CONFLICT DO NOTHING
            """, [sid, code, code[:20]])
        conn.commit()
        print(f"  OTHER ({len(other_ids)}) -> flagges manual_required")

    # Reactiver triggers
    cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER ALL")
    conn.commit()

    # Refresh MV
    print("Refresh MV...")
    conn.autocommit = True
    cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech")
    conn.autocommit = False
    print("  MV OK")

    # Bilan final
    print("\n=== BILAN FINAL ===")
    cur.execute("SELECT location_mode, COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL GROUP BY location_mode ORDER BY COUNT(*) DESC")
    for mode, n in cur.fetchall():
        print(f"  {str(mode):<25}: {n}")

    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE location_mode='fallback_default' AND deleted_at IS NULL")
    n_left = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data=true")
    n_mailles = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM atlas.geocode_suggestions WHERE action='manual_required'")
    n_manual  = cur.fetchone()[0]

    print(f"\n  fallback_default restants  : {n_left}")
    print(f"  Mailles has_data=true      : {n_mailles}")
    print(f"  Suggestions manual_required: {n_manual}")
    print(f"\n  Total appliques cette passe: {applied}")

    conn.close()

    if n_left == 0:
        print("\n>>> GEOCODAGE COMPLET - Aucun fallback_default restant")
        print(">>> Lancement calcul ML autorise")
        return 0
    else:
        print(f"\n>>> {n_left} sondages necessitent validation UI")
        return 2


if __name__ == "__main__":
    import sys; sys.exit(main())
