#!/usr/bin/env python3
"""
phase_03_import_labo.py — Import données laboratoire V10_LABORATOIRE_HORIZONS
Intrepid Core Engineering Standards

Pour chaque horizon de V10_LABORATOIRE_HORIZONS.csv :
  1. Créer echantillon (si non existant) avec h_canon + depth_z_min/max
  2. essais_atterberg (WL, WP=WL-IP, ip_generated=IP)
  3. essais_classif   (hrb, indice_groupe)
  4. essais_proctor   (gamma_d_max=OPM, w_opt)
  5. essais_physiques (densite_seche_nat, teneur_eau_nat)
  6. essais_cbr       (cbr_95_pct seul, comme point CBR à ~95%)
"""
import sys, csv, json, logging, uuid
from pathlib import Path

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from config import (DATABASE_URL, V10_FILES, CSV_SEP, LOGS_DIR,
                    canon_horizon, IMPORT_BATCH)

log_file = LOGS_DIR / "phase_03_labo.log"
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"),
              logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)


def safe_float(val):
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None


def read_csv(path):
    """Lit un CSV ; gere colonnes extra (list) + valeurs NULL string."""
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_SEP)
        for row in reader:
            clean = {}
            for k, v in row.items():
                if k is None:
                    continue
                if isinstance(v, list):
                    v = v[0] if v else None
                sv = v.strip() if v and isinstance(v, str) else None
                clean[k] = None if sv in ("NULL", "null", "None", "") else sv
            if any(v for v in clean.values()):
                rows.append(clean)
    return rows


def get_sondage_map(conn):
    """Retourne {code: id} pour tous les sondages en DB."""
    with conn.cursor() as cur:
        cur.execute("SELECT code, id FROM atlas.sondages WHERE code IS NOT NULL")
        return {r[0]: r[1] for r in cur.fetchall()}


def get_echantillon_key(sondage_id, z_min, z_max):
    """Clé unique pour dédupliquer echantillons : (sondage_id, z_min, z_max)."""
    return (str(sondage_id), z_min, z_max)


def import_labo(conn):
    labo_rows   = read_csv(V10_FILES["labo"])
    sondage_map = get_sondage_map(conn)

    # Echantillons déjà en DB (pour idempotence)
    with conn.cursor() as cur:
        cur.execute("""
            SELECT sondage_id, depth_z_min, depth_z_max, id
            FROM atlas.echantillons
            WHERE depth_z_min IS NOT NULL
        """)
        existing_echs = {(str(r[0]), r[1], r[2]): r[3] for r in cur.fetchall()}

    stats = dict(echantillons=0, atterberg=0, classif=0, proctor=0,
                 physiques=0, cbr=0, skipped=0)

    for row in labo_rows:
        sid_code = row.get("id_sondage")
        if not sid_code or sid_code not in sondage_map:
            stats["skipped"] += 1
            continue

        sondage_id = sondage_map[sid_code]
        z_min = safe_float(row.get("z_min_m")) or 0.0
        z_max = safe_float(row.get("z_max_m")) or 0.0

        if z_max <= 0:
            z_max = z_min + 0.5  # estimation si manquant

        h_canon  = canon_horizon(z_min, z_max)
        centroid = (z_min + z_max) / 2.0

        # -- 1. Echantillon -------------------------------------------------
        ech_key = get_echantillon_key(sondage_id, z_min, z_max)
        if ech_key in existing_echs:
            ech_id = existing_echs[ech_key]
        else:
            ech_meta = {
                "nature_sol":     row.get("nature_sol_brute"),
                "import_batch":   IMPORT_BATCH,
                "passant_2mm":    safe_float(row.get("passant_2mm_pct")),
                "passant_80um":   safe_float(row.get("passant_80um_pct")),
                "volume_emprunt": safe_float(row.get("volume_emprunt_m3")),
            }
            # echantillons n'a pas de created_by_batch -> on stocke dans meta
            # et on utilise SELECT WHERE NOT EXISTS pour idempotence (pas de UNIQUE sur depth)
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.echantillons
                      (sondage_id, depth_m, depth_z_min, depth_z_max, h_canon, meta)
                    SELECT %s, %s, %s, %s, %s, %s
                    WHERE NOT EXISTS (
                      SELECT 1 FROM atlas.echantillons
                      WHERE sondage_id=%s AND ABS(depth_m - %s) < 0.01
                    )
                    RETURNING id
                """, (sondage_id, centroid, z_min, z_max, h_canon,
                      psycopg2.extras.Json(ech_meta),
                      sondage_id, centroid))
                res = cur.fetchone()
                if res:
                    ech_id = res[0]
                    existing_echs[ech_key] = ech_id
                    stats["echantillons"] += 1
                else:
                    # Fetch si ON CONFLICT DO NOTHING
                    cur.execute("""
                        SELECT id FROM atlas.echantillons
                        WHERE sondage_id=%s AND depth_z_min=%s AND depth_z_max=%s
                    """, (sondage_id, z_min, z_max))
                    res2 = cur.fetchone()
                    if res2:
                        ech_id = res2[0]
                        existing_echs[ech_key] = ech_id
                    else:
                        stats["skipped"] += 1
                        continue

        # -- 2. Atterberg (WL, WP, IP) --------------------------------------
        ll = safe_float(row.get("limite_liquidite_ll"))
        ip = safe_float(row.get("indice_plasticite_ip"))
        if ll is not None or ip is not None:
            wp = (ll - ip) if (ll is not None and ip is not None) else None
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_atterberg
                      (echantillon_id, wl, wp, ip_generated, source_reference)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, ll, wp, ip, "V10_LABORATOIRE_HORIZONS"))
            stats["atterberg"] += 1

        # -- 3. Classification HRB + indice_groupe --------------------------
        hrb = row.get("classe_sol_hbr")
        ig  = safe_float(row.get("indice_groupe_ig"))
        if hrb or ig is not None:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_classif
                      (echantillon_id, hrb, indice_groupe, source_reference,
                       created_by_batch)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, hrb, ig, "V10_LABORATOIRE_HORIZONS", IMPORT_BATCH))
            stats["classif"] += 1

        # -- 4. Proctor OPM -------------------------------------------------
        gamma_d_opm = safe_float(row.get("densite_seche_opm"))
        w_opt       = safe_float(row.get("teneur_eau_opt_opm"))
        if gamma_d_opm is not None and w_opt is not None:
            with conn.cursor() as cur:
                # gamma_d_max : V10 en g/cm3 -> DB en kN/m3 (x10)
                # proctor_type : 'modifie' (contrainte DB)
                cur.execute("""
                    INSERT INTO atlas.essais_proctor
                      (echantillon_id, proctor_type, gamma_d_max, w_opt, meta)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT (echantillon_id, proctor_type) DO NOTHING
                """, (ech_id, "modifie", float(gamma_d_opm) * 10.0, w_opt,
                      psycopg2.extras.Json({"source": "V10_LABORATOIRE_HORIZONS",
                                             "batch": IMPORT_BATCH,
                                             "gamma_d_original_gcm3": float(gamma_d_opm)})))
            stats["proctor"] += 1

        # -- 5. Physiques (densité naturelle, teneur eau) -------------------
        dens_nat = safe_float(row.get("densite_seche_nat_g_cm3"))
        w_nat    = safe_float(row.get("teneur_eau_nat_pct"))
        if dens_nat is not None or w_nat is not None:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_physiques
                      (echantillon_id, densite_apparente_gcm3, teneur_eau_pct,
                       source, created_by_batch)
                    VALUES (%s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, dens_nat, w_nat, "V10_LABORATOIRE_HORIZONS", IMPORT_BATCH))
            stats["physiques"] += 1

        # -- 6. CBR 95% ponctuel --------------------------------------------
        cbr_95 = safe_float(row.get("cbr_95_pct"))
        if cbr_95 is not None:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_cbr
                      (echantillon_id, proctor_type, compactage_pct, cbr_pct,
                       h_canon, source_reference, created_by_batch,
                       meta)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, "modified", 95.0, cbr_95, h_canon,
                      "V10_LABORATOIRE_HORIZONS", IMPORT_BATCH,
                      psycopg2.extras.Json({"note": "cbr_95_pct_ponctuel"})))
            stats["cbr"] += 1

    conn.commit()
    log.info("  Résultats phase 03 :")
    for k, v in stats.items():
        log.info(f"    {k:15s} : {v:>6}")
    return stats


def main():
    log.info("=== PHASE 03 — Import données laboratoire V10 ===")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        import_labo(conn)
        log.info("Phase 03 terminée")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
