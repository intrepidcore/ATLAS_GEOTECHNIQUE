#!/usr/bin/env python3
"""
Correction : centroide ADM3 -> position aleatoire dans le polygone ADM3.
Cible :
  1. Tous les 'inferred' (274) - centroide ADM3 assigne par nos scripts
  2. Les 'geocoded' avec coordonnee partagee (59) - autre fallback V10 non detecte
Mode : adm_random_cell (position aleatoire reproducible dans l'ADM3)
Utilise random_point_in_polygon() deja presente en DB.
"""
import psycopg2

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur  = conn.cursor()

    print("=== CORRECTION CENTROIDE -> ADM_RANDOM_CELL ===\n")

    # ─── Etape 1 : identifier les geocoded a corriger ────────────────────────
    # = geocoded dont la geom est partagee par plusieurs sondages (faux GPS)
    print("Identification des geocoded avec coord partagee...")
    cur.execute("""
        SELECT DISTINCT s.id::text
        FROM atlas.sondages s
        WHERE s.deleted_at IS NULL
          AND s.location_mode = 'geocoded'
          AND EXISTS (
              SELECT 1 FROM atlas.sondages s2
              WHERE s2.id != s.id
                AND ST_Equals(s2.geom, s.geom)
                AND s2.deleted_at IS NULL
                AND s2.location_mode = 'geocoded'
          )
    """)
    geocoded_shared_ids = [r[0] for r in cur.fetchall()]
    print(f"  geocoded partages a corriger : {len(geocoded_shared_ids)}")

    # ─── Etape 2 : identifier les inferred ───────────────────────────────────
    cur.execute("""
        SELECT DISTINCT id::text FROM atlas.sondages
        WHERE deleted_at IS NULL AND location_mode = 'inferred'
    """)
    inferred_ids = [r[0] for r in cur.fetchall()]
    print(f"  inferred a corriger          : {len(inferred_ids)}")

    all_ids = list(set(geocoded_shared_ids + inferred_ids))
    print(f"  Total a corriger             : {len(all_ids)}\n")

    # ─── Etape 3 : verifier que tous ont un adm3_id ─────────────────────────
    ph = ",".join(["%s"] * len(all_ids))
    cur.execute(f"""
        SELECT COUNT(*) FROM atlas.sondages
        WHERE id::text IN ({ph})
          AND adm3_id IS NULL
    """, all_ids)
    n_no_adm3 = cur.fetchone()[0]
    print(f"  Sans adm3_id (probleme) : {n_no_adm3}")
    if n_no_adm3 > 0:
        # Pour ceux sans adm3_id : retrouver l'ADM3 par point-in-polygon depuis le centroide actuel
        print("  Correction adm3_id manquant via point-in-polygon...")
        cur.execute(f"""
            UPDATE atlas.sondages s
            SET adm3_id = (
                SELECT a.gid FROM atlas.adm3 a
                WHERE ST_Contains(a.geom, s.geom) LIMIT 1
            )
            WHERE s.id::text IN ({ph})
              AND s.adm3_id IS NULL
              AND s.deleted_at IS NULL
        """, all_ids)
        print(f"    adm3_id mis a jour : {cur.rowcount}")
        conn.commit()

    # ─── Etape 4 : desactiver triggers ───────────────────────────────────────
    cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER ALL")
    conn.commit()
    print("Triggers desactives")

    # ─── Etape 5 : appliquer random_point_in_polygon pour chaque sondage ────
    # On traite par lot de 50 pour des commits reguliers
    print(f"\nApplication random_point_in_polygon sur {len(all_ids)} sondages...")
    updated = 0
    errors  = 0
    BATCH   = 100

    for i in range(0, len(all_ids), BATCH):
        batch = all_ids[i:i+BATCH]
        ph_b  = ",".join(["%s"] * len(batch))
        try:
            cur.execute(f"""
                UPDATE atlas.sondages s
                SET
                    geom = public.random_point_in_polygon(a.geom),
                    maille_code = (
                        SELECT m.code FROM atlas.mailles m
                        WHERE ST_Contains(m.geom, ST_Transform(
                            public.random_point_in_polygon(a.geom), 25231))
                        LIMIT 1
                    ),
                    location_mode = 'adm_random_cell',
                    updated_at    = NOW()
                FROM atlas.adm3 a
                WHERE s.adm3_id = a.gid
                  AND s.id::text IN ({ph_b})
                  AND s.deleted_at IS NULL
            """, batch)
            n = cur.rowcount
            updated += n
            conn.commit()
            print(f"  Lot {i//BATCH + 1}: {n} sondages mis a jour (total={updated})")
        except Exception as e:
            print(f"  ERREUR lot {i//BATCH + 1}: {e}")
            errors += 1
            conn.rollback()

    # ─── Etape 6 : reactiver triggers + refresh MV ───────────────────────────
    cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER ALL")
    conn.commit()
    print("\nTriggers reactives")

    print("Refresh mv_mailles_geotech...")
    conn.autocommit = True
    cur.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech")
    conn.autocommit = False
    print("  MV OK")

    # ─── Bilan ───────────────────────────────────────────────────────────────
    print("\n" + "=" * 70)
    print("BILAN APRES CORRECTION")
    print("=" * 70)

    cur.execute("""
        SELECT location_mode, COUNT(*) AS n
        FROM atlas.sondages WHERE deleted_at IS NULL
        GROUP BY location_mode ORDER BY n DESC
    """)
    for mode, n in cur.fetchall():
        print(f"  {str(mode):<25}: {n}")

    cur.execute("SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data=true")
    n_mailles = cur.fetchone()[0]
    print(f"\n  Mailles has_data=true : {n_mailles}  (avant: 300)")

    # Top 10 mailles les plus denses
    cur.execute("""
        SELECT maille_code, COUNT(*) AS n
        FROM atlas.sondages WHERE deleted_at IS NULL AND maille_code IS NOT NULL
        GROUP BY maille_code ORDER BY n DESC LIMIT 10
    """)
    print("\n  Top 10 mailles (apres correction):")
    for code, n in cur.fetchall():
        print(f"    {code}: {n} sondages")

    # Verifier dispersion des NOT_E (Notse)
    cur.execute("""
        SELECT COUNT(DISTINCT maille_code) AS mailles_notse
        FROM atlas.sondages
        WHERE code LIKE 'NOT_%' AND deleted_at IS NULL
    """)
    print(f"\n  Mailles distinctes pour NOT_E*: {cur.fetchone()[0]} (avant: 1)")

    # Verifier dispersion des BADJA (Gbadjahe)
    cur.execute("""
        SELECT COUNT(DISTINCT maille_code) FROM atlas.sondages
        WHERE code LIKE 'BADJA%' AND deleted_at IS NULL
    """)
    print(f"  Mailles distinctes pour BADJA*: {cur.fetchone()[0]} (avant: 1)")

    # Verifier dispersion des SOK (Sotouboua)
    cur.execute("""
        SELECT COUNT(DISTINCT maille_code) FROM atlas.sondages
        WHERE (code LIKE 'SOK_%' OR code LIKE 'SOK_T%') AND deleted_at IS NULL
    """)
    print(f"  Mailles distinctes pour SOK*  : {cur.fetchone()[0]} (avant: 1)")

    print(f"\n  Total mis a jour : {updated}")
    if errors:
        print(f"  Erreurs          : {errors}")

    conn.close()
    return 0


if __name__ == "__main__":
    import sys; sys.exit(main())
