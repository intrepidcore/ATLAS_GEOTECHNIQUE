#!/usr/bin/env python3
"""
inject_mtgp_fusion_new_params.py
Injecte les jobs MTGP et Fusion pour les nouveaux parametres V11.
Cree les entrees catalog manquantes.
N>200 atteint pour gamma_d (N=304), w_opt (N=304) -> MTGP eligible.
"""
import json
import os
import sys
import uuid
import psycopg2

DSN = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

# Parametres catalog a creer si absents
CATALOG_NEEDED = [
    # (parameter_id, category, unit, source_table, physical_min, physical_max)
    ("gamma_d_mtgp_h1",  "compacite", "g/cm3", "essais_proctor",      1.4, 2.5),
    ("gamma_d_mtgp_h2",  "compacite", "g/cm3", "essais_proctor",      1.4, 2.5),
    ("gamma_d_mtgp_h3",  "compacite", "g/cm3", "essais_proctor",      1.4, 2.5),
    ("w_opt_mtgp_h1",    "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("w_opt_mtgp_h2",    "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("w_opt_mtgp_h3",    "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("rd_mpa_mtgp_h1",   "geotech",   "MPa",   "essais_penetrometre", 0.0, 120.0),
    ("rd_mpa_mtgp_h2",   "geotech",   "MPa",   "essais_penetrometre", 0.0, 120.0),
    ("rd_mpa_mtgp_h3",   "geotech",   "MPa",   "essais_penetrometre", 0.0, 120.0),
    ("cbr_95_mtgp_h1",   "portance",  "%",      "essais_cbr",          0.0, 100.0),
    ("cbr_95_mtgp_h2",   "portance",  "%",      "essais_cbr",          0.0, 100.0),
    ("cbr_95_mtgp_h3",   "portance",  "%",      "essais_cbr",          0.0, 100.0),
    ("gamma_d_fusion_h1","compacite", "g/cm3", "essais_proctor",      1.4, 2.5),
    ("gamma_d_fusion_h2","compacite", "g/cm3", "essais_proctor",      1.4, 2.5),
    ("gamma_d_fusion_h3","compacite", "g/cm3", "essais_proctor",      1.4, 2.5),
    ("w_opt_fusion_h1",  "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("w_opt_fusion_h2",  "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("w_opt_fusion_h3",  "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("rd_mpa_fusion_h1", "geotech",   "MPa",   "essais_penetrometre", 0.0, 120.0),
    ("rd_mpa_fusion_h2", "geotech",   "MPa",   "essais_penetrometre", 0.0, 120.0),
    ("rd_mpa_fusion_h3", "geotech",   "MPa",   "essais_penetrometre", 0.0, 120.0),
    ("cbr_95_fusion_h1", "portance",  "%",      "essais_cbr",          0.0, 100.0),
    ("cbr_95_fusion_h2", "portance",  "%",      "essais_cbr",          0.0, 100.0),
    ("cbr_95_fusion_h3", "portance",  "%",      "essais_cbr",          0.0, 100.0),
    ("w_opt_ked_h2",     "compacite", "%",      "essais_proctor",      0.0, 50.0),
    ("w_opt_ked_h3",     "compacite", "%",      "essais_proctor",      0.0, 50.0),
]

# Jobs a injecter : (parameter_id, job_type, payload_dict)
JOBS_TO_INJECT = [
    # --- MTGP pour nouveaux params N>200 ---
    # gamma_d + w_opt ICM (3 params correlated: gamma_d, w_opt, cbr_95)
    ("gamma_d_mtgp_h1", "run_mtgp", {"horizon": "H1", "params": ["gamma_d", "w_opt", "cbr_95"]}),
    ("gamma_d_mtgp_h2", "run_mtgp", {"horizon": "H2", "params": ["gamma_d", "w_opt", "cbr_95"]}),
    ("gamma_d_mtgp_h3", "run_mtgp", {"horizon": "H3", "params": ["gamma_d", "w_opt", "cbr_95"]}),
    # rd_mpa MTGP (seul param penetrometre correlated avec cbr_95)
    ("rd_mpa_mtgp_h1",  "run_mtgp", {"horizon": "H1", "params": ["rd_mpa", "cbr_95"]}),
    ("rd_mpa_mtgp_h2",  "run_mtgp", {"horizon": "H2", "params": ["rd_mpa", "cbr_95"]}),
    ("rd_mpa_mtgp_h3",  "run_mtgp", {"horizon": "H3", "params": ["rd_mpa", "cbr_95"]}),
    # --- Fusion BLUP pour nouveaux params (KED + RK) ---
    ("gamma_d_fusion_h1", "run_fusion", {"horizon": "H1", "ked_param": "gamma_d_ked_h1", "rk_param": "gamma_d_rk_h1"}),
    ("gamma_d_fusion_h2", "run_fusion", {"horizon": "H2", "ked_param": "gamma_d_ked_h2", "rk_param": "gamma_d_rk_h2"}),
    ("gamma_d_fusion_h3", "run_fusion", {"horizon": "H3", "ked_param": "gamma_d_ked_h3", "rk_param": "gamma_d_rk_h3"}),
    ("w_opt_fusion_h1",   "run_fusion", {"horizon": "H1", "ked_param": "w_opt_ked_h1",   "rk_param": "w_opt_rk_h1"}),
    ("w_opt_fusion_h2",   "run_fusion", {"horizon": "H2", "ked_param": "w_opt_ked_h2",   "rk_param": "w_opt_rk_h2"}),
    ("w_opt_fusion_h3",   "run_fusion", {"horizon": "H3", "ked_param": "w_opt_ked_h3",   "rk_param": "w_opt_rk_h3"}),
    ("rd_mpa_fusion_h1",  "run_fusion", {"horizon": "H1", "ked_param": "rd_mpa_ked_h1",  "rk_param": "rd_mpa_rk_h1"}),
    ("rd_mpa_fusion_h2",  "run_fusion", {"horizon": "H2", "ked_param": "rd_mpa_ked_h2",  "rk_param": "rd_mpa_rk_h2"}),
    ("rd_mpa_fusion_h3",  "run_fusion", {"horizon": "H3", "ked_param": "rd_mpa_ked_h3",  "rk_param": "rd_mpa_rk_h3"}),
    ("cbr_95_fusion_h1",  "run_fusion", {"horizon": "H1", "ked_param": "cbr_95_ked_h1",  "rk_param": "cbr_95_rk_h1"}),
    ("cbr_95_fusion_h2",  "run_fusion", {"horizon": "H2", "ked_param": "cbr_95_ked_h2",  "rk_param": "cbr_95_rk_h2"}),
    ("cbr_95_fusion_h3",  "run_fusion", {"horizon": "H3", "ked_param": "cbr_95_ked_h3",  "rk_param": "cbr_95_rk_h3"}),
]


def main():
    conn = psycopg2.connect(DSN)
    conn.set_client_encoding("UTF8")
    cur = conn.cursor()

    # 1. Creer les entrees catalog manquantes
    print("=== CATALOG ===")
    created_cat = 0
    for pid, cat, unit, tbl, pmin, pmax in CATALOG_NEEDED:
        cur.execute(
            "SELECT 1 FROM atlas.ai_parameter_catalog WHERE parameter_id=%s",
            (pid,),
        )
        if cur.fetchone():
            continue
        cur.execute(
            """
            INSERT INTO atlas.ai_parameter_catalog
              (parameter_id, category, source, unit, interpolation_enabled,
               prediction_enabled, is_active, source_table, physical_min, physical_max,
               depth_stratified, is_derived, derived_from, min_pts_stratified, min_pts_rk)
            VALUES (%s, %s, 'interpolation', %s, TRUE, FALSE, TRUE, %s, %s, %s,
                    TRUE, FALSE, '{}', 5, 10)
            ON CONFLICT (parameter_id) DO NOTHING
            """,
            (pid, cat, unit, tbl, pmin, pmax),
        )
        created_cat += 1
        print(f"  CREATE catalog: {pid}")
    conn.commit()
    print(f"  Catalog: {created_cat} crees")

    # 2. Injecter les jobs
    print("\n=== INJECTION JOBS ===")
    injected = 0
    skipped  = 0
    for pid, jtype, payload in JOBS_TO_INJECT:
        horizon_val = payload.get("horizon", "")
        cur.execute(
            """
            SELECT id FROM atlas.ai_job_queue
            WHERE parameter_id=%s AND job_type=%s
              AND COALESCE(payload->>'horizon','') = %s
              AND status IN ('queued','running')
            """,
            (pid, jtype, horizon_val),
        )
        if cur.fetchone():
            skipped += 1
            print(f"  SKIP (deja en queue): {jtype} {pid}")
            continue
        cur.execute(
            """
            INSERT INTO atlas.ai_job_queue
              (id, parameter_id, job_type, status, payload, requested_at)
            VALUES (%s, %s, %s, 'queued', %s::jsonb, now())
            """,
            (str(uuid.uuid4()), pid, jtype, json.dumps(payload)),
        )
        injected += 1
        print(f"  QUEUED: {jtype:<12s} {pid}")

    conn.commit()
    print(f"\n  Injectes: {injected} | Deja en queue: {skipped}")

    # 3. Bilan final queue
    cur.execute(
        """
        SELECT job_type, status, COUNT(*)
        FROM atlas.ai_job_queue
        GROUP BY job_type, status ORDER BY job_type, status
        """
    )
    print("\n=== QUEUE FINALE ===")
    total_queued = 0
    total_running = 0
    for r in cur.fetchall():
        print(f"  {r[0]:25s} | {r[1]:12s} | {r[2]}")
        if r[1] == "queued":
            total_queued += r[2]
        elif r[1] == "running":
            total_running += r[2]
    print(f"\n  TOTAL en queue: {total_queued} | running: {total_running}")

    cur.close()
    conn.close()
    return 0


if __name__ == "__main__":
    sys.exit(main())
