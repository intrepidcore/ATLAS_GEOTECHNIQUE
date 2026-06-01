#!/usr/bin/env python3
"""
trigger_pipeline.py — Lance les calculs géostatistiques sur tous les paramètres
Intrepid Core Engineering Standards

Actions :
  1. Injecte des jobs dans atlas.ai_job_queue pour recalcul complet
  2. Paramètres existants : vbs/ip/wl/wp/eg (tous horizons)
  3. Nouveaux paramètres  : rd_mpa, em_mpa, pl_mpa, cbr_95, gamma_d (H1/H2/H3)
  4. Lance le pipeline_worker en arrière-plan si non déjà actif
  5. Surveille la progression via ai_interpolation_runs toutes les 60s

Usage:
    python trigger_pipeline.py [--watch] [--params all|new|existing]
"""
import sys, time, logging, argparse, subprocess, json
from pathlib import Path
from datetime import datetime, timezone

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from config import DATABASE_URL, LOGS_DIR

log_file = LOGS_DIR / "pipeline_trigger.log"
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"),
              logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)

# -- Paramètres à recalculer ---------------------------------------------------
# Format : (parameter_id, horizon, priority)
EXISTING_PARAMS = [
    # VBS — pas de nouvelles données mais recalcul avec nouvelle géographie
    ("vbs_ked_h1", "H1", 10), ("vbs_ked_h2", "H2", 10), ("vbs_ked_h3", "H3", 10),
    ("vbs_rk_h1",  "H1", 9),  ("vbs_rk_h2",  "H2", 9),  ("vbs_rk_h3",  "H3", 9),
    # IP/WL/WP — +215 nouveaux points
    ("ip_ked_h1",  "H1", 10), ("ip_ked_h2",  "H2", 10), ("ip_ked_h3",  "H3", 10),
    ("ip_rk_h1",   "H1", 9),  ("ip_rk_h2",   "H2", 9),  ("ip_rk_h3",   "H3", 9),
    ("wl_ked_h1",  "H1", 10), ("wl_ked_h2",  "H2", 10), ("wl_ked_h3",  "H3", 10),
    ("wl_rk_h1",   "H1", 9),  ("wl_rk_h2",   "H2", 9),  ("wl_rk_h3",   "H3", 9),
    ("wp_ked_h1",  "H1", 10), ("wp_ked_h2",  "H2", 10), ("wp_ked_h3",  "H3", 10),
    ("wp_rk_h1",   "H1", 9),  ("wp_rk_h2",   "H2", 9),  ("wp_rk_h3",   "H3", 9),
    # EG
    ("eg_ked_h1",  "H1", 8),  ("eg_ked_h2",  "H2", 8),  ("eg_ked_h3",  "H3", 8),
    ("eg_rk_h1",   "H1", 7),  ("eg_rk_h2",   "H2", 7),  ("eg_rk_h3",   "H3", 7),
    # Granulométrie
    ("passant_2mm_ked_h1",  "H1", 6), ("passant_2mm_ked_h2",  "H2", 6),
    ("passant_2mm_ked_h3",  "H3", 6),
    ("passant_80um_ked_h1", "H1", 6), ("passant_80um_ked_h2", "H2", 6),
    ("passant_80um_ked_h3", "H3", 6),
]

NEW_PARAMS = [
    # Pénétromètre Rd
    ("rd_mpa_ked_h1", "H1", 10), ("rd_mpa_ked_h2", "H2", 10), ("rd_mpa_ked_h3", "H3", 10),
    ("rd_mpa_rk_h1",  "H1", 9),  ("rd_mpa_rk_h2",  "H2", 9),  ("rd_mpa_rk_h3",  "H3", 9),
    # Pressiomètre Em
    ("em_mpa_ked_h1", "H1", 10), ("em_mpa_ked_h2", "H2", 10), ("em_mpa_ked_h3", "H3", 10),
    ("em_mpa_rk_h1",  "H1", 9),  ("em_mpa_rk_h2",  "H2", 9),  ("em_mpa_rk_h3",  "H3", 9),
    # Pressiomètre Pl
    ("pl_mpa_ked_h1", "H1", 8),  ("pl_mpa_ked_h2", "H2", 8),  ("pl_mpa_ked_h3", "H3", 8),
    # CBR 95%
    ("cbr_95_ked_h1", "H1", 10), ("cbr_95_ked_h2", "H2", 10), ("cbr_95_ked_h3", "H3", 10),
    ("cbr_95_rk_h1",  "H1", 9),  ("cbr_95_rk_h2",  "H2", 9),  ("cbr_95_rk_h3",  "H3", 9),
    # Proctor gamma_d
    ("gamma_d_ked_h1","H1", 7),  ("gamma_d_ked_h2","H2", 7),  ("gamma_d_ked_h3","H3", 7),
]


def enqueue_jobs(conn, params: list, recalculate: bool = True) -> int:
    """Injecte les jobs dans atlas.ai_job_queue.
    Schema reel: id, parameter_id, job_type, status, payload, requested_at, ...
    """
    # Map parameter suffix -> job_type valide dans ai_job_queue
    def get_job_type(pid: str) -> str:
        if "_rk_"     in pid: return "run_rk"
        if "_fusion_" in pid: return "run_fusion"
        if "_mtgp_"   in pid: return "run_mtgp"
        if "_vfs"     in pid: return "run_vfs"
        return "run_ked"  # défaut pour _ked_ et nouveaux paramètres

    inserted = 0
    with conn.cursor() as cur:
        for param_id, horizon, priority in params:
            job_type = get_job_type(param_id)
            payload = json.dumps({
                "parameter_id": param_id,
                "horizon":      horizon,
                "recalculate":  recalculate,
                "triggered_by": "trigger_pipeline_v10_import",
                "triggered_at": datetime.now(timezone.utc).isoformat(),
                "priority":     priority,
            })
            # Eviter les doublons: un seul job queued/running par parameter_id
            cur.execute("""
                INSERT INTO atlas.ai_job_queue
                  (parameter_id, job_type, payload, status, requested_at)
                SELECT %s, %s, %s::jsonb, 'queued', now()
                WHERE NOT EXISTS (
                  SELECT 1 FROM atlas.ai_job_queue
                  WHERE parameter_id=%s AND status IN ('queued','running')
                )
            """, (param_id, job_type, payload, param_id))
            inserted += cur.rowcount

    conn.commit()
    return inserted


def check_queue_schema(conn) -> bool:
    """Verifie que ai_job_queue a les colonnes minimales."""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT column_name FROM information_schema.columns
            WHERE table_schema='atlas' AND table_name='ai_job_queue'
        """)
        cols = {r[0] for r in cur.fetchall()}
    expected = {"job_type", "payload", "status"}
    missing  = expected - cols
    if missing:
        log.warning(f"  Colonnes manquantes dans ai_job_queue : {missing}")
        return False
    return True


def monitor_progress(conn, initial_runs: int, n_jobs: int, max_wait_min: int = 120):
    """Surveille la progression des runs toutes les 60 secondes."""
    log.info(f"\n  Surveillance pipeline ({n_jobs} jobs, timeout {max_wait_min}min)...")
    t0 = time.time()
    last_runs = initial_runs

    while (time.time() - t0) < (max_wait_min * 60):
        time.sleep(60)

        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM atlas.ai_interpolation_runs")
            curr_runs = cur.fetchone()[0]

            cur.execute("""
                SELECT status, COUNT(*) FROM atlas.ai_job_queue
                WHERE status IN ('queued','running','finished','failed')
                GROUP BY status
            """)
            queue_status = dict(cur.fetchall())

        delta = curr_runs - last_runs
        queued  = queue_status.get("queued", 0)
        running = queue_status.get("running", 0)
        done    = queue_status.get("finished", 0)
        failed  = queue_status.get("failed", 0)
        elapsed = int(time.time() - t0)

        log.info(f"  [{elapsed:4d}s] runs: {curr_runs:+d} (+{delta}) | "
                 f"queue: {queued}Q {running}R {done}D {failed}F")
        last_runs = curr_runs

        if queued == 0 and running == 0:
            log.info("  OK Pipeline terminé — plus aucun job en queue")
            return True

    log.warning(f"  ! Timeout {max_wait_min}min atteint — pipeline toujours actif")
    return False


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--watch", action="store_true",
                        help="Surveiller la progression après enqueue")
    parser.add_argument("--params", choices=["all","new","existing"], default="all",
                        help="Quels paramètres recalculer")
    parser.add_argument("--max-wait", type=int, default=120,
                        help="Minutes max de surveillance (défaut 120)")
    args = parser.parse_args()

    log.info("+==========================================================+")
    log.info("|     PIPELINE TRIGGER — RECALCUL GÉOSTATISTIQUE V10      |")
    log.info("+==========================================================╝")

    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = False

    try:
        # Vérifier le schéma
        schema_ok = check_queue_schema(conn)

        # État initial
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM atlas.ai_interpolation_runs")
            initial_runs = cur.fetchone()[0]
        log.info(f"  Runs actuels : {initial_runs}")

        # Déterminer les paramètres à enqueuer
        if args.params == "all":
            params = EXISTING_PARAMS + NEW_PARAMS
        elif args.params == "new":
            params = NEW_PARAMS
        else:
            params = EXISTING_PARAMS

        log.info(f"  Paramètres à enqueuer : {len(params)}")

        if schema_ok:
            n = enqueue_jobs(conn, params)
            log.info(f"  OK {n} jobs injectés dans ai_job_queue")
        else:
            log.error("  Schéma ai_job_queue incompatible — injection annulée")
            log.error("  -> Vérifier la structure de ai_job_queue et adapter")
            sys.exit(1)

        # Info pipeline worker
        log.info("\n  Pour activer le pipeline worker (si inactif) :")
        log.info("    docker-compose --profile pipeline up -d pipeline-worker")
        log.info("    OU: python scripts/pipeline_worker.py --database-url " + DATABASE_URL)

        # Surveillance optionnelle
        if args.watch:
            monitor_progress(conn, initial_runs, n, args.max_wait)

        log.info("\n  Surveiller la progression :")
        log.info("    psql -c \"SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status\"")
        log.info("    psql -c \"SELECT COUNT(*) FROM atlas.ai_interpolation_runs\"")

    finally:
        conn.close()


if __name__ == "__main__":
    main()
