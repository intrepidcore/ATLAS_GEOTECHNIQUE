#!/usr/bin/env python3
"""
phase_04_import_insitu.py — Import profils in-situ V10_INSITU_PROFIL_Z
Intrepid Core Engineering Standards

Pour chaque ligne de profil :
  - Trouver/créer un echantillon pour la profondeur z
  - essais_penetrometre (Rd, ELU, ELS) si données pénétromètre non-null
  - essais_pressiometre (Pf, Pl, Em) si données pressiomètre non-null
  - Profondeurs > 2 m -> h_canon = H3, z_reel_m conservé
"""
import sys, csv, logging
from pathlib import Path
from collections import defaultdict

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from config import (DATABASE_URL, V10_FILES, CSV_SEP, LOGS_DIR,
                    canon_from_z, IMPORT_BATCH)

log_file = LOGS_DIR / "phase_04_insitu.log"
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


def get_or_create_echantillon(conn, sondage_id, z_m, h_canon, ech_cache):
    """
    Retourne l'UUID de l'échantillon pour (sondage_id, z_m).
    Crée l'echantillon si non existant — chaque mesure in-situ correspond
    à un point de profondeur distinct.
    """
    key = (str(sondage_id), round(z_m, 3))
    if key in ech_cache:
        return ech_cache[key]

    with conn.cursor() as cur:
        # Chercher echantillon existant à cette profondeur (±0.05 m)
        cur.execute("""
            SELECT id FROM atlas.echantillons
            WHERE sondage_id = %s
              AND ABS(depth_m - %s) < 0.05
            LIMIT 1
        """, (sondage_id, z_m))
        row = cur.fetchone()
        if row:
            ech_id = row[0]
            ech_cache[key] = ech_id
            return ech_id

        # Créer - echantillons n'a pas created_by_batch, on le met dans meta
        cur.execute("""
            INSERT INTO atlas.echantillons
              (sondage_id, depth_m, depth_z_min, depth_z_max, h_canon, meta)
            VALUES (%s, %s, %s, %s, %s, %s)
            RETURNING id
        """, (sondage_id, z_m, z_m, z_m, h_canon,
              psycopg2.extras.Json({"source": "V10_INSITU_PROFIL_Z",
                                     "batch": IMPORT_BATCH})))
        ech_id = cur.fetchone()[0]
        ech_cache[key] = ech_id
        return ech_id


def import_insitu(conn):
    insitu_rows = read_csv(V10_FILES["insitu"])

    # Index sondages
    with conn.cursor() as cur:
        cur.execute("SELECT code, id FROM atlas.sondages WHERE code IS NOT NULL")
        sondage_map = {r[0]: r[1] for r in cur.fetchall()}

    stats = dict(echantillons_crees=0, penetrometre=0, pressiometre=0, skipped=0)
    ech_cache = {}

    for row in insitu_rows:
        sid_code = row.get("id_sondage")
        if not sid_code or sid_code not in sondage_map:
            stats["skipped"] += 1
            continue

        sondage_id = sondage_map[sid_code]
        z_m = safe_float(row.get("profondeur_z_m"))
        if z_m is None:
            stats["skipped"] += 1
            continue

        h_canon = canon_from_z(z_m)  # H3 si > 1.5m (y compris > 2m)

        # Récupérer ou créer echantillon
        ech_id = get_or_create_echantillon(conn, sondage_id, z_m, h_canon, ech_cache)

        # -- Pénétromètre ---------------------------------------------------
        rd  = safe_float(row.get("penetrometre_rd_mpa"))
        elu = safe_float(row.get("penetrometre_elu_mpa"))
        els = safe_float(row.get("penetrometre_els_mpa"))
        resistiv = safe_float(row.get("geophysique_resistivite_ohm"))

        if rd is not None or elu is not None or els is not None:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_penetrometre
                      (echantillon_id, z_reel_m, h_canon, rd_mpa, elu_mpa, els_mpa,
                       resistivite_ohm, source_reference, created_by_batch, meta)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, z_m, h_canon, rd, elu, els, resistiv,
                      "V10_INSITU_PROFIL_Z", IMPORT_BATCH,
                      psycopg2.extras.Json({
                          "depth_gt_2m": z_m > 2.0,
                          "mapped_h3_from_real": z_m > 1.5,
                      })))
            stats["penetrometre"] += 1

        # -- Pressiomètre ---------------------------------------------------
        pf  = safe_float(row.get("pressiometre_pf_mpa"))
        pl  = safe_float(row.get("pressiometre_pl_mpa"))
        em  = safe_float(row.get("pressiometre_em_mpa"))
        epl = safe_float(row.get("pressiometre_e_pl_ratio"))

        if pf is not None or pl is not None or em is not None:
            with conn.cursor() as cur:
                cur.execute("""
                    INSERT INTO atlas.essais_pressiometre
                      (echantillon_id, z_reel_m, h_canon, pf_mpa, pl_mpa, em_mpa,
                       e_pl_ratio, source_reference, created_by_batch, meta)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    ON CONFLICT DO NOTHING
                """, (ech_id, z_m, h_canon, pf, pl, em, epl,
                      "V10_INSITU_PROFIL_Z", IMPORT_BATCH,
                      psycopg2.extras.Json({"depth_gt_2m": z_m > 2.0})))
            stats["pressiometre"] += 1

    conn.commit()

    # Compter echantillons créés
    with conn.cursor() as cur:
        cur.execute("""
            SELECT COUNT(*) FROM atlas.echantillons
            WHERE meta->>'batch' = %s
              AND meta->>'source' = 'V10_INSITU_PROFIL_Z'
        """, (IMPORT_BATCH,))
        stats["echantillons_crees"] = cur.fetchone()[0]

    log.info("  Résultats phase 04 :")
    for k, v in stats.items():
        log.info(f"    {k:20s} : {v:>6}")
    return stats


def main():
    log.info("=== PHASE 04 — Import profils in-situ V10 ===")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        import_insitu(conn)
        log.info("Phase 04 terminée")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
