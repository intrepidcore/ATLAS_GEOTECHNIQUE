#!/usr/bin/env python3
"""
import_trec_notse.py
Import des données Atterberg/OPM/CBR depuis :
  TREC_EXTRACT/EMPRUNTS DE NOTSE (1).md  (31 sondages d'emprunts)

Données issues de TABLEAU 1 (Atterberg, classification) et
TABLEAU 2 (Proctor OPM + CBR 95%).

DB : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
Source  : TREC_NOTSE_2023
Batch   : trec_notse_import_2024
"""
import sys, hashlib, random, uuid, psycopg2
from datetime import date

DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
SOURCE = "TREC_NOTSE_2023"
BATCH  = "trec_notse_import_2024"

# ── TABLEAU 1 ─────────────────────────────────────────────────────────────────
# (id, locality, troncon_prefix, pk_label, materiau, LL, IP, pct_80um, IG, hrb, date_essai)
NOTSE_T1 = [
    (1,  "DOGLOBO",      "PC2",  "PK04+000", "Graveleux lateritique sableux", 28, 10,  7, 0, "A2-4", date(2023, 9, 25)),
    (2,  "DOGLOBO",      "PC2",  "PK04+100", "Graveleux lateritique sableux", 29, 11,  8, 0, "A2-6", date(2023, 9, 25)),
    (3,  "AYA-KOPE",     "PC2",  "PK05+300", "Graveleux lateritique",         33, 14, 12, 0, "A2-6", date(2023, 9, 25)),
    (4,  "KOME",         "PC2",  "PK11+600", "Graveleux lateritique",         42, 16, 16, 0, "A2-7", date(2023, 9, 25)),
    (5,  "KOME",         "PC2",  "PK14+800", "Graveleux lateritique",         36, 16, 12, 0, "A2-6", date(2023, 9, 25)),
    (6,  "KPEVIADZI",    "PC4",  "PK05+200", "Graveleux lateritique",         45, 18, 21, 0, "A2-7", date(2023, 9, 26)),
    (7,  "HEKPE",        "PC4",  "PK10+200", "Graveleux lateritique sableux", 31, 13,  6, 0, "A2-6", date(2023, 9, 26)),
    (8,  "HEKPE",        "PC4",  "PK08+700", "Graveleux lateritique sableux", 33, 14,  7, 0, "A2-6", date(2023, 9, 26)),
    (9,  "TADO",         "PC13", "PK02+000", "Graveleux lateritique",         38, 17, 11, 0, "A2-6", date(2023, 9, 26)),
    (10, "TADO",         "PC13", "PK02+200", "Graveleux lateritique",         35, 15,  8, 0, "A2-6", date(2023, 9, 26)),
    (11, "CARREFOUR",    "PC14", "PK00+900", "Graveleux lateritique",         38, 16,  9, 0, "A2-6", date(2023, 9, 27)),
    (12, "AGBAVE",       "PC15", "PK03+500", "Graveleux lateritique",         46, 19, 19, 0, "A2-7", date(2023, 9, 27)),
    (13, "AGBAVE",       "PC15", "PK04+800", "Graveleux lateritique sableux", 28, 11,  6, 0, "A2-6", date(2023, 9, 27)),
    (14, "ADJAYAO-KOPE", "PC17", "PK02+000", "Graveleux lateritique sableux", 28, 10,  7, 0, "A2-4", date(2023, 9, 27)),
    (15, "KOUGNONWOU",   "PC17", "PK08+000", "Graveleux lateritique",         38, 17, 13, 0, "A2-6", date(2023, 9, 27)),
    (16, "KOUGNONWOU",   "PC17", "PK07+500", "Graveleux lateritique",         31, 12, 11, 0, "A2-6", date(2023, 9, 27)),
    (17, "GLITTO",       "PC22", "PK00+000", "Graveleux lateritique",         34, 14, 11, 0, "A2-6", date(2023, 9, 28)),
    (18, "AKORISSEVA",   "PC23", "PK06+500", "Graveleux lateritique",         31, 12, 10, 0, "A2-6", date(2023, 9, 28)),
    (19, "AKORISSEVA",   "PC23", "PK06+500", "Graveleux lateritique",         33, 14, 13, 0, "A2-6", date(2023, 9, 28)),
    (20, "AKORISSEVA",   "PC23", "PK06+500", "Graveleux lateritique",         31, 13, 13, 0, "A2-6", date(2023, 9, 28)),
    (21, "HOMA",         "PC23", "PK12+500", "Graveleux lateritique sableux", 28, 11,  8, 0, "A2-6", date(2023, 9, 28)),
    (22, "SOHONOUHOE",   "PC23", "PK20+800", "Graveleux lateritique",         42, 16, 17, 0, "A2-7", date(2023, 9, 28)),
    (23, "HOUTO",        "PC25", "PK22+600", "Graveleux lateritique",         29, 11,  9, 0, "A2-6", date(2023, 9, 30)),
    (24, "ADEGBENOU",    "PC25", "PK16+900", "Graveleux lateritique",         38, 15, 12, 0, "A2-6", date(2023, 9, 30)),
    (25, "GLITTO",       "PC26", "PK08+100", "Graveleux lateritique",         35, 13, 11, 0, "A2-6", date(2023, 9, 30)),
    (26, "GBADI N'KOUGNA", "CC02", "PK47+800", "Graveleux lateritique",      42, 18, 22, 0, "A2-7", date(2023, 10, 1)),
    (27, "ADOMI-ABRA",   "CC02", "PK29+800", "Graveleux lateritique",         42, 16, 16, 0, "A2-7", date(2023, 10, 1)),
    (28, "AGADJI-TODJI", "CC02", "PK16+500", "Graveleux lateritique",         33, 14, 11, 0, "A2-6", date(2023, 10, 1)),
    (29, "AGADJI-TODJI", "CC02", "PK18+200", "Graveleux lateritique",         29, 11,  8, 0, "A2-6", date(2023, 10, 2)),
    (30, "ELAVAGNON",    "CC02", "PK19+900", "Graveleux lateritique",         37, 15, 14, 0, "A2-6", date(2023, 10, 2)),
    (31, "ELAVAGNON",    "CC02", "PK19+300", "Graveleux lateritique",         41, 16, 15, 0, "A2-7", date(2023, 10, 2)),
]

# ── TABLEAU 2 ─────────────────────────────────────────────────────────────────
# (id, gd_max_t_m3, w_opt_pct, cbr_95)
NOTSE_T2 = [
    (1,  2.210, 7.1, 51),  (2,  2.190, 7.8, 50),  (3,  2.180, 7.5, 48),
    (4,  2.220, 8.0, 53),  (5,  2.190, 7.5, 47),  (6,  2.150, 8.0, 44),
    (7,  2.160, 6.0, 41),  (8,  2.220, 7.6, 58),  (9,  2.200, 7.4, 46),
    (10, 2.170, 7.8, 42),  (11, 2.180, 7.5, 44),  (12, 2.210, 7.9, 56),
    (13, 2.200, 7.1, 41),  (14, 2.210, 7.5, 45),  (15, 2.180, 7.8, 47),
    (16, 2.160, 8.5, 43),  (17, 2.240, 8.0, 56),  (18, 2.210, 8.5, 48),
    (19, 2.170, 7.7, 45),  (20, 2.160, 7.6, 41),  (21, 2.150, 7.4, 38),
    (22, 2.180, 7.0, 50),  (23, 2.190, 7.5, 43),  (24, 2.220, 7.0, 54),
    (25, 2.220, 8.8, 55),  (26, 2.090, 7.5, 39),  (27, 2.220, 9.4, 53),
    (28, 2.070, 9.0, 37),  (29, 2.110, 7.5, 41),  (30, 2.040, 7.5, 43),
    (31, 2.210, 9.0, 54),
]

# ── Coordonnées de fallback par préfixe de tronçon ───────────────────────────
# PC2/PC4/PC13/PC14/PC15/PC17/PC22/PC23/PC25/PC26 → Haho prefecture
# CC02 → Kloto/Est-Mono area
TRONCON_FALLBACK = {
    "PC2":  (1.16, 6.95),
    "PC4":  (1.16, 6.95),
    "PC13": (1.16, 6.95),
    "PC14": (1.16, 6.95),
    "PC15": (1.16, 6.95),
    "PC17": (1.16, 6.95),
    "PC22": (1.16, 6.95),
    "PC23": (1.16, 6.95),
    "PC25": (1.16, 6.95),
    "PC26": (1.16, 6.95),
    "CC02": (1.20, 7.80),
}

SPREAD = 0.05


def det_point(code: str, lon_c: float, lat_c: float, spread: float = SPREAD):
    """Point pseudo-aléatoire déterministe dans un rayon spread autour du centroïde."""
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


def lookup_adm3_centroid(cur, locality: str):
    """Recherche le centroïde de la commune ADM3 à partir du nom de la localité."""
    cur.execute(
        "SELECT ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom)) "
        "FROM atlas.adm3_tg WHERE LOWER(name) LIKE LOWER(%s) LIMIT 1",
        (f"%{locality}%",)
    )
    row = cur.fetchone()
    if row:
        return float(row[0]), float(row[1])
    return None


def main():
    import argparse
    parser = argparse.ArgumentParser(description="Import TREC Notse emprunts")
    parser.add_argument("--dry-run", action="store_true", help="Simulation sans écriture DB")
    parser.add_argument("--database-url", default=DB_URL)
    args = parser.parse_args()

    print("=== Import TREC NOTSE EMPRUNTS 2023 ===")
    print(f"Source  : {SOURCE}")
    print(f"Batch   : {BATCH}")
    print(f"Dry-run : {args.dry_run}")
    print(f"Sondages: {len(NOTSE_T1)}")
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
    t2_idx = {r[0]: r for r in NOTSE_T2}

    stats = dict(sondages=0, echantillons=0, atterberg=0, cbr=0, proctor=0, maille=0)

    try:
        for row1 in NOTSE_T1:
            (idx, locality, troncon_prefix, pk_label, materiau,
             wl, ip, pct_80um, ig, hrb, date_essai) = row1

            # Profondeur emprunt : 0.20–0.30 m (H1)
            dep_min, dep_max = 0.20, 0.30
            hc = h_canon(dep_min, dep_max)
            depth_mid = round((dep_min + dep_max) / 2.0, 3)
            wp = round(float(wl) - float(ip), 1)

            # Code sondage
            # Ex: EMPRUNT_NOTSE_PC2_DOGLOBO_N1
            # On utilise la numérotation de l'emprunt depuis le nom de localité dans T1
            # Les noms contiennent déjà la multiplicité (DOGLOBO N1, DOGLOBO N2…)
            # On encode idx pour être unique
            code = f"EMPRUNT_NOTSE_{troncon_prefix}_{idx:02d}"

            # Géolocalisation : essai ADM3, sinon fallback tronçon
            adm3_lon, adm3_lat = None, None
            if not args.dry_run:
                result = lookup_adm3_centroid(cur, locality)
                if result:
                    adm3_lon, adm3_lat = result
                    print(f"  [MAILLE] ADM3 match pour '{locality}': lon={adm3_lon:.4f} lat={adm3_lat:.4f}")

            if adm3_lon is None:
                fb = TRONCON_FALLBACK.get(troncon_prefix, (1.16, 6.95))
                adm3_lon, adm3_lat = fb
                if args.dry_run:
                    print(f"  [DRY] {code} fallback troncon {troncon_prefix}: lon={adm3_lon} lat={adm3_lat}")

            lon, lat = det_point(code, adm3_lon, adm3_lat, SPREAD)

            if args.dry_run:
                print(
                    f"  DRY: {code} locality={locality} troncon={troncon_prefix} pk={pk_label} "
                    f"lon={lon:.4f} lat={lat:.4f} hc={hc} WL={wl} IP={ip} WP={wp}"
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
                (f'{{"source":"{SOURCE}","troncon":"{troncon_prefix}",'
                 f'"pk":"{pk_label}","locality":"{locality}",'
                 f'"pct_80um":{pct_80um},"ig":{ig},"hrb":"{hrb}"}}'),
                code
            ))
            inserted = cur.rowcount
            stats["sondages"] += inserted
            print(f"  [SONDAGE] {code} locality={locality} {'INSERTED' if inserted else 'SKIP (exists)'}")

            # Récupérer l'id du sondage (nouveau ou existant)
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
                # L'échantillon existait déjà — récupérer son id
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

                # CBR à 95%
                cur.execute("""
                    INSERT INTO atlas.essais_cbr
                      (echantillon_id, n_coups, cbr_pct, proctor_type, source_reference, meta)
                    SELECT %s, %s, %s, 'modified', %s, %s::jsonb
                    WHERE NOT EXISTS (
                      SELECT 1 FROM atlas.essais_cbr
                      WHERE echantillon_id=%s AND n_coups=%s
                    )
                """, (
                    ech_id, 25, float(cbr_95), "CBR_NOTSE",
                    f'{{"compactage_pct":95,"batch":"{BATCH}"}}',
                    ech_id, 25
                ))
                cbr_ok = cur.rowcount
                stats["cbr"] += cbr_ok
                print(f"  [CBR] {code} CBR95={cbr_95}% n_coups=25 {'OK' if cbr_ok else 'SKIP'}")

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
