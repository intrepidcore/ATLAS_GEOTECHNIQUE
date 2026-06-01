#!/usr/bin/env python3
"""
phase_05_import_cbr_proctor.py — Import courbes CBR + points Proctor V10
Intrepid Core Engineering Standards

Sources : V10_COMPACITE_CBR_*.csv  -> atlas.essais_cbr (courbe complète)
          V10_PROCTOR_POINTS_*.csv -> atlas.essais_proctor.meta['curve_points']

Format CBR   (sans en-tête) : id_sondage; n_coups; compactage_pct; gamma_d_gcm3; cbr_pct; w_pct
Format Proctor (sans en-tête) : id_sondage; w_pct; gamma_d_gcm3
"""
import sys, csv, logging, json
from pathlib import Path
from collections import defaultdict

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from config import (DATABASE_URL, V10_FILES, CSV_SEP, LOGS_DIR, IMPORT_BATCH)

log_file = LOGS_DIR / "phase_05_cbr_proctor.log"
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"),
              logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

CBR_COLS    = ["id_sondage","n_coups","compactage_pct","gamma_d_gcm3","cbr_pct","w_pct"]
PROCTOR_COLS = ["id_sondage","w_pct","gamma_d_gcm3"]


def safe_float(val):
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None

def safe_int(val):
    try:
        return int(float(val)) if val else None
    except (ValueError, TypeError):
        return None

def read_csv_noheader(path, col_names):
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=CSV_SEP)
        for line in reader:
            if not line or not line[0].strip():
                continue
            row = {}
            for i, name in enumerate(col_names):
                row[name] = line[i].strip() if i < len(line) else None
            rows.append(row)
    return rows


def get_echantillon_h1(conn, sondage_id):
    """
    Retourne l'echantillon H1 ou H2 du sondage (profil CBR = horizon de surface).
    Crée un echantillon H1 synthétique si aucun n'existe.
    """
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, h_canon FROM atlas.echantillons
            WHERE sondage_id = %s
              AND h_canon IN ('H1','H2')
            ORDER BY depth_m ASC
            LIMIT 1
        """, (sondage_id,))
        row = cur.fetchone()
        if row:
            return row[0]

        # Pas d'échantillon H1/H2 -> créer synthétique à 0.5 m
        # echantillons n'a pas created_by_batch -> on met dans meta
        cur.execute("""
            INSERT INTO atlas.echantillons
              (sondage_id, depth_m, depth_z_min, depth_z_max, h_canon, meta)
            VALUES (%s, 0.5, 0.0, 1.0, 'H1', %s)
            RETURNING id
        """, (sondage_id,
              psycopg2.extras.Json({"synthetic": True,
                                     "reason": "CBR_no_H1_echantillon",
                                     "batch": IMPORT_BATCH})))
        return cur.fetchone()[0]


def import_cbr_curves(conn, sondage_map):
    """Import courbes CBR complètes depuis V10_COMPACITE_CBR_*.csv."""
    total = 0
    cbr_keys = [k for k in V10_FILES if k.startswith("cbr_")]

    for key in cbr_keys:
        path = V10_FILES[key]
        rows = read_csv_noheader(path, CBR_COLS)
        file_count = 0

        for r in rows:
            sid_code = r.get("id_sondage")
            if not sid_code or sid_code not in sondage_map:
                continue

            sondage_id  = sondage_map[sid_code]
            n_coups     = safe_int(r.get("n_coups"))
            compact_pct = safe_float(r.get("compactage_pct"))
            gamma_d     = safe_float(r.get("gamma_d_gcm3"))
            cbr_pct     = safe_float(r.get("cbr_pct"))
            w_pct       = safe_float(r.get("w_pct"))

            if cbr_pct is None:
                continue

            ech_id = get_echantillon_h1(conn, sondage_id)

            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_cbr
                      (echantillon_id, proctor_type, n_coups, compactage_pct,
                       cbr_pct, gamma_d_gcm3, w_pct, h_canon,
                       source_reference, created_by_batch, meta)
                    VALUES (%s,'modified',%s,%s,%s,%s,%s,'H1',%s,%s,%s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, n_coups, compact_pct, cbr_pct, gamma_d, w_pct,
                      key.upper(), IMPORT_BATCH,
                      psycopg2.extras.Json({"source_file": path.name})))
            file_count += 1

        log.info(f"  CBR {key:25s} : {file_count} lignes")
        total += file_count

    conn.commit()
    log.info(f"  Total CBR insérés : {total}")
    return total


def import_proctor_curves(conn, sondage_map):
    """
    Import points courbe Proctor -> stocké dans essais_proctor.meta['curve_points'].
    Met à jour l'entrée OPM existante ou crée une nouvelle.
    """
    total = 0
    proctor_keys = [k for k in V10_FILES if k.startswith("proctor_")]

    # Grouper par id_sondage pour construire la courbe complète
    for key in proctor_keys:
        path = V10_FILES[key]
        rows = read_csv_noheader(path, PROCTOR_COLS)

        # Grouper par sondage
        by_sondage = defaultdict(list)
        for r in rows:
            sid = r.get("id_sondage")
            if sid and sid in sondage_map:
                w  = safe_float(r.get("w_pct"))
                gd = safe_float(r.get("gamma_d_gcm3"))
                if w is not None and gd is not None:
                    by_sondage[sid].append({"w_pct": w, "gamma_d_gcm3": gd})

        for sid_code, points in by_sondage.items():
            sondage_id = sondage_map[sid_code]

            # Calculer OPM = point de gamma_d_max
            gamma_max_pt = max(points, key=lambda p: p["gamma_d_gcm3"])
            gamma_d_max  = gamma_max_pt["gamma_d_gcm3"]
            w_opt        = gamma_max_pt["w_pct"]

            ech_id = get_echantillon_h1(conn, sondage_id)

            meta = {
                "source_file":   path.name,
                "batch":         IMPORT_BATCH,
                "curve_points":  points,
                "n_points":      len(points),
                "opm_auto":      True,
            }

            with conn.cursor() as cur:
                # Mettre à jour si essais_proctor existe déjà pour cet echantillon
                cur.execute("""
                    UPDATE atlas.essais_proctor
                    SET gamma_d_max = %s, w_opt = %s,
                        meta = meta || %s::jsonb
                    WHERE echantillon_id = %s
                      AND proctor_type = 'modified'
                """, (gamma_d_max, w_opt,
                      json.dumps({"curve_points": points, "n_points": len(points)}),
                      ech_id))

                if cur.rowcount == 0:
                    # Créer nouvelle entrée
                    # proctor_type='modifie', gamma_d en kN/m3 (x10 depuis g/cm3)
                    cur.execute("""
                        INSERT INTO atlas.essais_proctor
                          (echantillon_id, proctor_type, gamma_d_max, w_opt, meta)
                        VALUES (%s, 'modifie', %s, %s, %s)
                        ON CONFLICT (echantillon_id, proctor_type) DO NOTHING
                    """, (ech_id, float(gamma_d_max) * 10.0, w_opt,
                          psycopg2.extras.Json(meta)))

            total += len(points)

        log.info(f"  Proctor {key:20s} : {sum(len(v) for v in by_sondage.values())} points, "
                 f"{len(by_sondage)} sondages")

    conn.commit()
    log.info(f"  Total points Proctor traités : {total}")
    return total


def main():
    log.info("=== PHASE 05 — Import CBR + Proctor curves V10 ===")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        with conn.cursor() as cur:
            cur.execute("SELECT code, id FROM atlas.sondages WHERE code IS NOT NULL")
            sondage_map = {r[0]: r[1] for r in cur.fetchall()}

        n_cbr    = import_cbr_curves(conn, sondage_map)
        n_proct  = import_proctor_curves(conn, sondage_map)
        log.info(f"Phase 05 terminée : {n_cbr} CBR + {n_proct} points Proctor")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
