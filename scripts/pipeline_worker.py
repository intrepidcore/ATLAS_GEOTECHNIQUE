#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — BLOC E : Pipeline Worker Auto-amélioration
=====================================================================
Intrepid Core Engineering Standards

Ce worker écoute la table atlas.ai_job_queue et exécute les scripts
de calcul appropriés (KED, RK SCORPAN, Fusion, VfS) à chaque import
de nouveaux sondages.

Architecture :
  Nouveau sondage importé
    → trigger trg_enqueue_ai_jobs_after_sondage
    → INSERT INTO atlas.ai_job_queue
    → Ce worker (polling ou pg_notify LISTEN)
    → Script Python approprié
    → UPDATE ai_job_queue (status=finished/failed)
    → LOG dans ai_interpolation_runs

Job types supportés :
  run_ked     → run_ked_vbs_ip_wl_wp_horizons.py --hierarchical
  run_rk      → atlas_regression_kriging_terrain.py (tous horizons)
  run_fusion  → ked_rk_fusion.py
  run_vfs     → vfs_extract_spectral.py --mode all --skip-gee
               (GEE extraction séparée, coûteuse)

Règles :
  ETL-03     : gestion erreurs systématique, jamais continuer en silence
  BM-SYNC-05 : idempotent, reprise après crash
  CFG-01     : DATABASE_URL via --database-url ou env

Usage :
  # Lancement en mode démon (polling toutes les 30s)
  python scripts/pipeline_worker.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --interval 30

  # Lancement unique (traiter les jobs en attente et quitter)
  python scripts/pipeline_worker.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --once
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, Optional, Tuple

import psycopg2
from psycopg2.extras import Json

# ── Logging ──────────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f"logs/pipeline_worker_{datetime.now().strftime('%Y%m%d')}.log",
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("PipelineWorker")

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

# Répertoire des scripts (relatif à ce fichier)
SCRIPTS_DIR = Path(__file__).parent


def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    return conn


def build_command(job_type: str, parameter_id: str, payload: Dict, db_url: str) -> Optional[Tuple]:
    """
    Construit la commande Python à exécuter pour un job type donné.

    Retourne (script_path, args_list) ou None si job_type inconnu.
    """
    horizons = "h1,h2,h3"

    if job_type == "run_ked":
        kinds = payload.get("kinds", "vbs,ip,wl,wp")
        use_hier = payload.get("hierarchical", True)
        args = [
            sys.executable,
            str(SCRIPTS_DIR / "run_ked_vbs_ip_wl_wp_horizons.py"),
            "--database-url", db_url,
            "--kinds", kinds,
        ]
        if use_hier:
            args.append("--hierarchical")
        return tuple(args)

    elif job_type == "run_rk":
        param = payload.get("parameter", parameter_id)
        # Lancer les 3 horizons séquentiellement (le script gère 1 paramètre à la fois)
        cmds = []
        for hz in ["h1", "h2", "h3"]:
            cmds.append((
                sys.executable,
                str(SCRIPTS_DIR / "atlas_regression_kriging_terrain.py"),
                "--database-url", db_url,
                "--parameter", param,
                "--horizon", hz,
            ))
        return cmds  # type: ignore  # retourne une liste de commandes

    elif job_type == "run_fusion":
        params = payload.get("params", "vbs,ip,wl,wp,eg")
        return (
            sys.executable,
            str(SCRIPTS_DIR / "ked_rk_fusion.py"),
            "--database-url", db_url,
            "--params", params,
            "--horizons", horizons,
        )

    elif job_type == "run_vfs":
        mode = payload.get("mode", "calibrate")  # par défaut recalibrer uniquement
        batch_size = str(payload.get("batch_size", 500))  # 500 par défaut (évite GEE memory limit)
        args = [
            sys.executable,
            str(SCRIPTS_DIR / "vfs_extract_spectral.py"),
            "--database-url", db_url,
            "--mode", mode,
            "--batch-size", batch_size,
        ]
        if mode == "calibrate":
            args.append("--skip-gee")  # Calibration seule = pas d'extraction GEE
        elif mode == "all":
            # En mode all déclenché par trigger : ré-extraire les mailles
            # mais pas les sondages (déjà extraits)
            args.append("--skip-sondage-gee")
        return tuple(args)

    elif job_type in ("kriging_stratifie", "regression_kriging", "kriging", "kriging_interpolate"):
        # Jobs legacy — router vers run_ked + run_rk pour VBS
        log.info("  Job legacy '%s' → redirection vers run_ked+run_rk (vbs)", job_type)
        return (
            sys.executable,
            str(SCRIPTS_DIR / "run_ked_vbs_ip_wl_wp_horizons.py"),
            "--database-url", db_url,
            "--kinds", "vbs",
            "--hierarchical",
        )

    else:
        log.warning("  Job type inconnu : '%s' — skip", job_type)
        return None


def run_command(cmd) -> Tuple[bool, str]:
    """
    Exécute une commande (tuple ou liste de tuples pour run_rk).
    Retourne (success, output_summary).
    """
    # run_rk retourne une liste de commandes (une par horizon)
    if isinstance(cmd, list):
        all_ok = True
        outputs = []
        for c in cmd:
            ok, out = run_command(c)
            all_ok = all_ok and ok
            outputs.append(out)
        return all_ok, " | ".join(outputs)

    log.info("  Commande : %s %s", Path(cmd[1]).name if len(cmd) > 1 else cmd[0],
             " ".join(cmd[2:6]))

    env = {**os.environ, "PYTHONUTF8": "1", "TF_ENABLE_ONEDNN_OPTS": "0"}
    result = subprocess.run(
        cmd,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        env=env,
        cwd=str(SCRIPTS_DIR.parent),
    )

    success = result.returncode == 0
    last_lines = (result.stdout or result.stderr or "")[-500:].strip()
    return success, last_lines


def process_one_job(conn, db_url: str) -> bool:
    """
    Dépile et traite un job en attente depuis ai_job_queue.
    Retourne True si un job a été traité, False si la queue est vide.
    """
    cur = conn.cursor()

    # Sélectionner et verrouiller 1 job (SKIP LOCKED pour concurrence)
    cur.execute("""
        SELECT id, parameter_id, job_type, payload
        FROM atlas.ai_job_queue
        WHERE status IN ('pending', 'queued')  -- 'queued' = valeur DB, 'pending' = compatibilité
        ORDER BY requested_at ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    """)
    row = cur.fetchone()

    if not row:
        cur.close()
        return False

    job_id, parameter_id, job_type, payload = row
    payload = payload or {}

    log.info("Job %s | type=%s | param=%s", str(job_id)[:8], job_type, parameter_id)

    # Marquer en cours
    cur.execute("""
        UPDATE atlas.ai_job_queue
        SET status='running', started_at=now()
        WHERE id=%s
    """, (job_id,))
    cur.close()

    # Construire et exécuter la commande
    cmd = build_command(job_type, parameter_id, payload, db_url)

    if cmd is None:
        cur = conn.cursor()
        cur.execute("""
            UPDATE atlas.ai_job_queue
            SET status='cancelled', finished_at=now(),
                error_message='job_type inconnu'
            WHERE id=%s
        """, (job_id,))
        cur.close()
        return True

    t0 = time.time()
    success, output = run_command(cmd)
    elapsed = time.time() - t0

    status = "finished" if success else "failed"
    log.info("  %s en %.1fs | %s", status, elapsed, output[-100:])

    cur = conn.cursor()
    cur.execute("""
        UPDATE atlas.ai_job_queue
        SET status=%s, finished_at=now(),
            error_message=%s
        WHERE id=%s
    """, (status, None if success else output[-500:], job_id))
    cur.close()
    return True


def main() -> int:
    ap = argparse.ArgumentParser(
        description="BLOC E — Pipeline Worker Auto-amélioration"
    )
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument(
        "--interval", type=int, default=30,
        help="Intervalle de polling en secondes (défaut : 30)",
    )
    ap.add_argument(
        "--once", action="store_true",
        help="Traiter tous les jobs en attente et quitter",
    )
    args = ap.parse_args()

    if not args.database_url:
        log.error("--database-url requis")
        return 1

    log.info("=== Pipeline Worker démarré ===")
    log.info("DB : %s | Interval : %ds | Once : %s",
             args.database_url.replace("atlas:atlas@", "***@"),
             args.interval, args.once)

    try:
        conn = get_conn(args.database_url)
    except Exception as e:
        log.error("Connexion DB impossible : %s", e)
        return 1

    while True:
        try:
            # Vider la queue
            while process_one_job(conn, args.database_url):
                pass  # continuer jusqu'à ce que la queue soit vide

        except Exception as e:
            log.exception("Erreur worker : %s — retry dans %ds", e, args.interval)
            try:
                conn = get_conn(args.database_url)
            except Exception:
                pass

        if args.once:
            log.info("Mode --once : terminé.")
            break

        log.info("Queue vide — attente %ds...", args.interval)
        time.sleep(args.interval)

    conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
