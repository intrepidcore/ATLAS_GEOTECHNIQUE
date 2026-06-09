#!/usr/bin/env python3
"""
import_trec_chaussee.py
Import des données Atterberg/OPM/CBR depuis :
  TREC_EXTRACT/SONDAGES EN CHAUSSÉE.md  (14 sondages en chaussée)

Données issues de TABLEAU 1 (Atterberg, profondeurs, classification) et
TABLEAU 2 (Proctor OPM + CBR 95%).

Le fichier contient trois groupes de sondages :
  - SOKODE  Tronçon 1   → zone Maritime (lon=1.25, lat=6.25)
  - LOMÉ 2              → zone Maritime (lon=1.25, lat=6.25)
  - KARA                → zone Maritime/Nord (lon=1.18, lat=6.30)

DB : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
Source  : TREC_CHAUSSEE_MARITIME
Batch   : trec_chaussee_import_2024
"""
import sys, hashlib, random, uuid, psycopg2
from datetime import date

DB_URL  = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
SOURCE  = "TREC_CHAUSSEE_MARITIME"
BATCH   = "trec_chaussee_import_2024"
SPREAD  = 0.05

# ── TABLEAU 1 ─────────────────────────────────────────────────────────────────
# (id, site_label, troncon, pk_label, dep_min, dep_max, materiau,
#  LL, IP, pct_80um, IG, hrb, date_essai)
#
# Note : la profondeur est extraite de la colonne "Profondeur (m)".
# Les virgules françaises (,) sont converties en points décimaux.
CHAUSSEE_T1 = [
    # ── SOKODE Tronçon 1 ──────────────────────────────────────────────────────
    (1,  "SOKODE", "TRONCON1",  "PK0+000",   0.10, 0.40, "Sable silteux",                 25,  9, 10, 0, "A2-4", date(2024, 12, 30)),
    (2,  "SOKODE", "TRONCON1",  "PK0+000",   0.40, 1.00, "Decomposition du schiste",       45, 19, 29, 0, "A2-7", date(2024, 12, 30)),
    (12, "SOKODE", "TRONCON1",  "PK9+000",   0.00, 0.80, "Sable silteux",                 38, 15, 27, 0, "A2-6", date(2024, 12, 30)),
    (13, "SOKODE", "TRONCON1",  "PK10+000",  0.10, 0.30, "Sable silteux",                 36, 14, 25, 0, "A2-6", date(2024, 12, 30)),
    # ── LOMÉ 2 ────────────────────────────────────────────────────────────────
    (3,  "LOME2",  "TRONCON_LOME2", "PK0+200", 0.30, 1.00, "Argile sableuse",             38, 15, 31, 0, "A2-6", date(2025,  3, 15)),
    (4,  "LOME2",  "TRONCON_LOME2", "PK0+300", 0.25, 1.00, "Argile sableuse",             45, 18, 31, 0, "A2-7", date(2025,  3, 15)),
    (5,  "LOME2",  "TRONCON_LOME2", "PK0+400", 0.10, 1.00, "Argile sableuse",             36, 14, 30, 0, "A2-6", date(2025,  3, 15)),
    (6,  "LOME2",  "TRONCON_LOME2", "PK0+500", 0.20, 1.00, "Argile sableuse",             38, 15, 31, 0, "A2-6", date(2025,  3, 15)),
    # ── KARA ──────────────────────────────────────────────────────────────────
    (7,  "KARA",   "TRONCON_KARA",  "PK6+000", 0.00, 0.25, "Graveleux lateritique rougeatre", 38, 15, 28, 0, "A2-6", date(2025,  6, 17)),
    (8,  "KARA",   "TRONCON_KARA",  "PK6+000", 0.00, 0.25, "Argile compacte",                 81, 37, 72, 0, "A7-5", date(2025,  6, 17)),
    (9,  "KARA",   "TRONCON_KARA",  "PK7+000", 0.00, 0.67, "Graveleux lateritique jaunatre",  43, 18, 36, 0, "A7-6", date(2025,  6, 17)),
    (10, "KARA",   "TRONCON_KARA",  "PK8+000", 0.00, 0.65, "Graveleux lateritique rougeatre", 38, 15, 25, 0, "A2-6", date(2025,  6, 17)),
    (11, "KARA",   "TRONCON_KARA",  "PK9+000", 0.00, 0.80, "Sable argileux jaunatre",         66, 29, 54, 0, "A7-5", date(2025,  6, 17)),
    (14, "KARA",   "TRONCON_KARA",  "PK12+300",0.00, 0.80, "Argile compacte noiratre",        75, 34, 69, 0, "A7-5", date(2025,  6, 18)),
]

# ── TABLEAU 2 ─────────────────────────────────────────────────────────────────
# (id, gd_max_t_m3, w_opt_pct, cbr_95)
# Note : virgules décimales françaises converties en points.
CHAUSSEE_T2 = [
    (1,  2.020,  9.5, 29),
    (2,  1.940, 11.9, 25),
    (3,  1.970,  9.6, 18),
    (4,  1.960, 10.7, 20),
    (5,  1.990,  6.7, 18),
    (6,  2.010,  6.7, 19),
    (7,  2.140,  7.6, 41),
    (8,  1.880, 13.3, 15),
    (9,  2.140,  9.3, 39),
    (10, 2.170,  8.0, 45),
    (11, 1.940, 11.5, 16),
    (12, 2.160,  8.5, 45),
    (13, 2.130,  9.6, 37),
    (14, 1.790, 14.0, 15),
]

# ── Coordonnées de fallback par site ─────────────────────────────────────────
# SOKODE et LOMÉ 2 → zone Maritime
# KARA → Maritime/PC07 area comme indiqué dans les requirements
SITE_COORDS = {
    "SOKODE":  (1.25, 6.25),   # Kodjé-Agbodjékpo area, Maritime (PC03)
    "LOME2":   (1.18, 6.30),   # Wonougba-Frangadua, Maritime (PC04)
    "KARA":    (1.15, 6.40),   # unknown route section (PC07)
}


def det_point(code: str, lon_c: float, lat_c: float, spread: float = SPREAD):
    """Point pseudo-aléatoire déterministe autour du centroïde."""
    seed = int(hashlib.sha256(code.encode()).hexdigest(), 16) % (2 ** 32)
    rng = random.Random(seed)
    lon = lon_c + (rng.random() - 0.5) * spread
    lat = lat_c + (rng.random() - 0.5) * spread
    return lon, lat


def h_canon(depth_min: float, depth_max: float) -> str:
    """Catégorie de profondeur basée sur le point médian."""
    mid = (depth_min + depth_max) / 2.0
    if mid <= 1.0:
        return "H1"
    elif mid <= 1.5:
        return "H2"
    else:
        return "H3"


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Import TREC Sondages en Chaussée")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans écriture DB")
    parser.add_argument("--database-url", default=DB_URL)
    args = parser.parse_args()

    print("=== Import TREC SONDAGES EN CHAUSSÉE ===")
    print(f"Source  : {SOURCE}")
    print(f"Batch   : {BATCH}")
    print(f"Dry-run : {args.dry_run}")
    print(f"Sondages: {len(CHAUSSEE_T1)}")
    print()

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Compteurs avant
    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch=%s", (BATCH,))
    count_before = cur.fetchone()[0]
    print(f"Sondages existants (batch={BATCH}) avant import : {count_before}")
    print()

    # Index T2 par id
    t2_idx = {r[0]: r for r in CHAUSSEE_T2}

    stats = dict(sondages=0, echantillons=0, atterberg=0, cbr=0, proctor=0, maille=0)

    try:
        for row1 in CHAUSSEE_T1:
            (idx, site_label, troncon, pk_label, dep_min, dep_max,
             materiau, wl, ip, pct_80um, ig, hrb, date_essai) = row1

            hc        = h_canon(dep_min, dep_max)
            depth_mid = round((dep_min + dep_max) / 2.0, 3)
            wp        = round(float(wl) - float(ip), 1)

            # Code sondage unique : SOURCE + site + numéro page
            code = f"CHAUSSEE_{site_label}_{troncon}_{idx:02d}"

            # Coordonnées
            lon_c, lat_c = SITE_COORDS.get(site_label, (1.20, 6.30))
            lon, lat = det_point(code, lon_c, lat_c, SPREAD)

            if args.dry_run:
                print(
                    f"  DRY: {code} site={site_label} troncon={troncon} pk={pk_label} "
                    f"depth={dep_min}-{dep_max}m hc={hc} "
                    f"lon={lon:.4f} lat={lat:.4f} WL={wl} IP={ip} WP={wp}"
                )
                stats["sondages"] += 1
                continue

            # ── 1. Sondage ────────────────────────────────────────────────────
            cur.execute("""
                INSERT INTO atlas.sondages
                  (code, date_sondage, geom, location_mode, location_accuracy,
                   type_sol, created_by_batch, meta)
                SELECT %s, %s,
                  ST_SetSRID(ST_MakePoint(%s, %s), 4326),
                  'inferred', 'low',
                  %s, %s, %s::jsonb
                WHERE NOT EXISTS (
                  SELECT 1 FROM atlas.sondages WHERE code=%s AND deleted_at IS NULL
                )
            """, (
                code, date_essai, lon, lat,
                materiau, BATCH,
                (f'{{"source":"{SOURCE}","site":"{site_label}","troncon":"{troncon}",'
                 f'"pk":"{pk_label}","pct_80um":{pct_80um},"ig":{ig},"hrb":"{hrb}"}}'),
                code
            ))
            inserted = cur.rowcount
            stats["sondages"] += inserted
            print(f"  [SONDAGE] {code} site={site_label} {'INSERTED' if inserted else 'SKIP (exists)'}")

            # Récupérer l'id du sondage
            cur.execute(
                "SELECT id FROM atlas.sondages WHERE code=%s AND deleted_at IS NULL LIMIT 1",
                (code,)
            )
            sondage_id = str(cur.fetchone()[0])

            # ── 2. Echantillon ────────────────────────────────────────────────
            ech_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO atlas.echantillons
                  (id, sondage_id, depth_m, depth_z_min, depth_z_max, h_canon, meta)
                SELECT %s, %s, %s, %s, %s, %s, %s::jsonb
                WHERE NOT EXISTS (
                  SELECT 1 FROM atlas.echantillons e
                  WHERE e.sondage_id=%s AND ABS(e.depth_m - %s) < 0.01
                )
            """, (
                ech_id, sondage_id, depth_mid, dep_min, dep_max, hc,
                f'{{"batch":"{BATCH}","source":"{SOURCE}"}}',
                sondage_id, depth_mid
            ))
            if cur.rowcount == 0:
                cur.execute(
                    "SELECT id FROM atlas.echantillons "
                    "WHERE sondage_id=%s AND ABS(depth_m-%s)<0.01 LIMIT 1",
                    (sondage_id, depth_mid)
                )
                ech_id = str(cur.fetchone()[0])
            else:
                stats["echantillons"] += 1

            # ── 3. Essais Atterberg ───────────────────────────────────────────
            cur.execute("""
                INSERT INTO atlas.essais_atterberg
                  (echantillon_id, wl, wp, ip_generated, source_reference)
                SELECT %s, %s, %s, %s, %s
                WHERE NOT EXISTS (
                  SELECT 1 FROM atlas.essais_atterberg WHERE echantillon_id=%s
                )
            """, (ech_id, float(wl), float(wp), float(ip), SOURCE, ech_id))
            att_ok = cur.rowcount
            stats["atterberg"] += att_ok
            print(f"  [ATTERBERG] {code} WL={wl} IP={ip} WP={wp} {'OK' if att_ok else 'SKIP'}")

            # ── 4. Essais Proctor + CBR ───────────────────────────────────────
            t2row = t2_idx.get(idx)
            if t2row:
                gd_max_t_m3 = t2row[1]
                w_opt       = t2row[2]
                cbr_95      = t2row[3]
                gd_kn_m3    = round(gd_max_t_m3 * 10.0, 3)  # t/m3 → kN/m3

                # Proctor
                if 14.0 <= gd_kn_m3 <= 25.0 and 0.0 <= w_opt <= 50.0:
                    cur.execute("""
                        INSERT INTO atlas.essais_proctor
                          (echantillon_id, proctor_type, gamma_d_max, w_opt, meta)
                        SELECT %s, 'modifie', %s, %s, %s::jsonb
                        WHERE NOT EXISTS (
                          SELECT 1 FROM atlas.essais_proctor
                          WHERE echantillon_id=%s AND proctor_type='modifie'
                        )
                    """, (
                        ech_id, gd_kn_m3, w_opt,
                        f'{{"gamma_d_original_t_m3":{gd_max_t_m3},"batch":"{BATCH}"}}',
                        ech_id
                    ))
                    pr_ok = cur.rowcount
                    stats["proctor"] += pr_ok
                    print(f"  [PROCTOR] {code} gd={gd_kn_m3}kN/m3 wopt={w_opt}% {'OK' if pr_ok else 'SKIP'}")
                else:
                    print(f"  [PROCTOR] {code} SKIP — valeurs hors plage (gd={gd_kn_m3}, wopt={w_opt})")

                # CBR à 95% — skip si CBR=0 ou nul
                if cbr_95 and cbr_95 > 0:
                    cur.execute("""
                        INSERT INTO atlas.essais_cbr
                          (echantillon_id, n_coups, cbr_pct, proctor_type, source_reference, meta)
                        SELECT %s, %s, %s, 'modified', %s, %s::jsonb
                        WHERE NOT EXISTS (
                          SELECT 1 FROM atlas.essais_cbr
                          WHERE echantillon_id=%s AND n_coups=%s
                        )
                    """, (
                        ech_id, 25, float(cbr_95), "CBR_CHAUSSEE",
                        f'{{"compactage_pct":95,"batch":"{BATCH}"}}',
                        ech_id, 25
                    ))
                    cbr_ok = cur.rowcount
                    stats["cbr"] += cbr_ok
                    print(f"  [CBR] {code} CBR95={cbr_95}% n_coups=25 {'OK' if cbr_ok else 'SKIP'}")
                else:
                    print(f"  [CBR] {code} SKIP — CBR nul ou absent")

            # ── 5. Lien maille ────────────────────────────────────────────────
            cur.execute("""
                UPDATE atlas.sondages
                SET maille_code = (
                  SELECT code FROM atlas.mailles m
                  WHERE ST_Within(sondages.geom, m.geom)
                  LIMIT 1
                )
                WHERE code = %s
                  AND maille_code IS NULL
            """, (code,))
            ml_ok = cur.rowcount
            stats["maille"] += ml_ok
            print(f"  [MAILLE] {code} {'lié' if ml_ok else 'déjà lié ou hors maille'}")

        if not args.dry_run:
            conn.commit()
            print()
            print("Commit effectué.")

            # Vérification finale
            cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch=%s", (BATCH,))
            count_after = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(*) FROM atlas.essais_atterberg ea
                JOIN atlas.echantillons e ON e.id=ea.echantillon_id
                JOIN atlas.sondages s ON s.id=e.sondage_id
                WHERE s.created_by_batch=%s
            """, (BATCH,))
            att_total = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(*) FROM atlas.essais_cbr ec
                JOIN atlas.echantillons e ON e.id=ec.echantillon_id
                JOIN atlas.sondages s ON s.id=e.sondage_id
                WHERE s.created_by_batch=%s
            """, (BATCH,))
            cbr_total = cur.fetchone()[0]
            cur.execute("""
                SELECT COUNT(*) FROM atlas.essais_proctor ep
                JOIN atlas.echantillons e ON e.id=ep.echantillon_id
                JOIN atlas.sondages s ON s.id=e.sondage_id
                WHERE s.created_by_batch=%s
            """, (BATCH,))
            prc_total = cur.fetchone()[0]

            print()
            print("══ RÉSUMÉ FINAL ════════════════════════════════════════════")
            print(f"  Sondages avant import : {count_before}")
            print(f"  Sondages après import : {count_after}")
            print(f"  Sondages insérés      : {stats['sondages']}")
            print(f"  Echantillons insérés  : {stats['echantillons']}")
            print(f"  Atterberg insérés     : {stats['atterberg']}")
            print(f"  CBR insérés           : {stats['cbr']}")
            print(f"  Proctor insérés       : {stats['proctor']}")
            print(f"  Mailles liées         : {stats['maille']}")
            print(f"  --- Totaux en DB (batch) ---")
            print(f"  Sondages  DB          : {count_after}")
            print(f"  Atterberg DB          : {att_total}")
            print(f"  CBR       DB          : {cbr_total}")
            print(f"  Proctor   DB          : {prc_total}")
            print("════════════════════════════════════════════════════════════")
        else:
            print()
            print("── DRY-RUN terminé — aucune écriture effectuée ──")
            print(f"  Sondages simulés : {stats['sondages']}")

    except Exception as exc:
        conn.rollback()
        print(f"\n[ERREUR] {exc}", file=sys.stderr)
        raise
    finally:
        cur.close()
        conn.close()

    print()
    print("DONE")


if __name__ == "__main__":
    main()
