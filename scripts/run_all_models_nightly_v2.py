#!/usr/bin/env python3
"""
run_all_models_nightly_v2.py -- Orchestrateur ML via API Rust (gain de performance)
====================================================================================
Version 2 du super-orchestrateur nightly. Au lieu d'appeler les scripts Python
directement via subprocess, cette version passe PAR L'API Rust de api-geo :

  POST /ai/jobs/enqueue  ->  cree le job dans ai_job_queue (ARCH-02)
  GET  /ai/jobs/:id      ->  poll statut + logs + barre progression

Avantages par rapport a run_all_models_nightly.py (v1) :
  1. Pas de gestion memoire Python directe -> RAM liberee entre chaque job
  2. Logs centralises en DB (ai_job_queue.logs) + observabilite via UI
  3. Reprise possible depuis l'interface `localhost:1420` (ARCH-04)
  4. Controle de concurrence via SKIP LOCKED en Rust (pas de double-lancement)
  5. Support GPU herite du worker Rust (TF_FORCE_GPU_ALLOW_GROWTH configure au niveau API)
  6. Checkpoint DB persistant (pas de fichier JSON local a gerer)

IMPORTANT : Cette version necessite que l'API api-geo soit en ligne et que le
worker ai_jobs soit actif (ai_jobs::spawn_job_worker lance dans main.rs).
Pour l'orchestration nocturne sans UI, l'API peut tourner en mode minimal :
  ENABLE_DB_MANAGER=false ATLAS_DESKTOP=false ./api-geo

Architecture des jobs (ARCH-02) :
  job_type IN : ked_recompute | rk_recompute | blup_recompute | vfs_recompute
                mtgp_recompute | export_png | export_3d | export_maps | export_article

Reference : AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md -- Phase 4 + run_all_models_nightly.py
DB cible  : via api-geo -> host.docker.internal:5433 / 127.0.0.1:5433 (CONV-15/18)

Usage :
  python scripts/run_all_models_nightly_v2.py
  python scripts/run_all_models_nightly_v2.py --dry-run
  python scripts/run_all_models_nightly_v2.py --models l1,l2a,l2b
  python scripts/run_all_models_nightly_v2.py --api-url http://localhost:8000
  python scripts/run_all_models_nightly_v2.py --skip-exports
  python scripts/run_all_models_nightly_v2.py --status
  python scripts/run_all_models_nightly_v2.py --reset
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

try:
    import requests
except ImportError:
    print("ERREUR: requests requis. Installer: pip install requests")
    sys.exit(1)

# --- Constantes --------------------------------------------------------------

SCRIPTS_DIR  = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPTS_DIR.parent
LOGS_DIR     = PROJECT_ROOT / "logs"
CHECKPOINT_FILE = LOGS_DIR / "checkpoint_nightly_v2.json"

API_URL = os.environ.get("ATLAS_API_URL", "http://localhost:8000")
API_TOKEN = os.environ.get("ATLAS_API_TOKEN", "")  # JWT si auth activee

# Timeouts polling (secondes)
POLL_INTERVAL   = 10    # Toutes les 10s
POLL_TIMEOUT    = {
    "ked_recompute":    4200,   # 70 min
    "rk_recompute":     2100,   # 35 min
    "blup_recompute":   2700,   # 45 min
    "vfs_recompute":    7800,   # 130 min (GEE + PLS)
    "mtgp_recompute":   6000,   # 100 min (GPU)
    "export_png":        720,   # 12 min
    "export_3d":        1020,   # 17 min
    "export_maps":       360,   # 6 min
    "export_article":    360,   # 6 min
}

# Definition du pipeline ML (ordre imperatif)
# (job_type, label, params_extra)
PIPELINE: List[Dict[str, Any]] = [
    {"job_type": "ked_recompute",   "label": "L1 KED Hierarchique",  "params": {"kinds": "vbs,ip,wl,wp,eg", "hierarchical": True}},
    {"job_type": "rk_recompute",    "label": "L2a RK-SCORPAN",       "params": {"params": "vbs,ip,wl,wp,eg"}},
    {"job_type": "blup_recompute",  "label": "L2b Fusion BLUP",      "params": {"params": "vbs,ip,wl,wp,eg"}},
    {"job_type": "vfs_extract",     "label": "L3 VfS Sentinel-2",    "params": {"mode": "all", "skip_gee": False}},
    {"job_type": "mtgp_recompute",  "label": "L4 MTGP/ICM GPU",      "params": {"params": "vbs,ip,eg", "horizons": "h1,h2,h3"}},
]

EXPORTS: List[Dict[str, Any]] = [
    {"job_type": "export_png",      "label": "Export PNG 300dpi",        "params": {"dpi": 300}},
    {"job_type": "export_3d",       "label": "Export 3D archetypes BCD", "params": {"archetypes": "BCD"}},
    {"job_type": "export_maps",     "label": "Cartes comparatives L1-L4","params": {"models": "all"}},
    {"job_type": "export_article",  "label": "Figures article",          "params": {}},
]

# Mapping job_type -> modele (pour filtre --models)
JOB_MODEL_MAP = {
    "ked_recompute":   "l1",
    "rk_recompute":    "l2a",
    "blup_recompute":  "l2b",
    "vfs_extract":     "l3",
    "mtgp_recompute":  "l4",
}

# --- Logging -----------------------------------------------------------------

def setup_logging(dry_run: bool = False) -> logging.Logger:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts  = datetime.now().strftime("%Y%m%d_%H%M%S")
    tag = "_dryrun" if dry_run else ""
    log_path = LOGS_DIR / f"nightly_v2_{ts}{tag}.log"

    fmt = "%(asctime)s [%(levelname)-8s] %(message)s"
    logging.basicConfig(
        level=logging.INFO,
        format=fmt,
        handlers=[
            logging.StreamHandler(sys.stdout),
            logging.FileHandler(log_path, encoding="utf-8"),
        ],
    )
    log = logging.getLogger("nightly_v2")
    log.info("Log : %s", log_path)
    return log


# --- Checkpoint --------------------------------------------------------------

class Checkpoint:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text(encoding="utf-8"))
            except Exception:
                return {}
        return {}

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self._data, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    def is_done(self, key: str) -> bool:
        return self._data.get(key, {}).get("status") == "success"

    def mark(self, key: str, status: str, job_id: Optional[str] = None, elapsed: float = 0.0) -> None:
        self._data[key] = {
            "status": status,
            "ts": datetime.now(timezone.utc).isoformat(),
            "elapsed_s": round(elapsed, 1),
            **({"job_id": job_id} if job_id else {}),
        }
        self._save()

    def reset(self) -> None:
        self._data = {}
        self._save()

    def print_status(self) -> None:
        if not self._data:
            print("Aucun checkpoint v2 enregistre.")
            return
        counts: Dict[str, int] = {}
        for v in self._data.values():
            s = v.get("status", "unknown")
            counts[s] = counts.get(s, 0) + 1
        print(f"\nCheckpoint v2 : {self.path}")
        for s, n in sorted(counts.items()):
            print(f"  {s:<15}: {n}")
        failed = [(k, v) for k, v in self._data.items() if v.get("status") == "failed"]
        if failed:
            print("\n  Taches en echec :")
            for k, v in failed[:10]:
                print(f"    [FAIL] {k}")


# --- API client --------------------------------------------------------------

def api_headers() -> Dict[str, str]:
    h = {"Content-Type": "application/json", "Accept": "application/json"}
    if API_TOKEN:
        h["Authorization"] = f"Bearer {API_TOKEN}"
    return h


def enqueue_job(job_type: str, params: Dict[str, Any], requested_by: str = "nightly_v2") -> Optional[str]:
    """
    POST /ai/jobs/enqueue -> retourne job_id ou None en cas d'erreur.
    """
    url  = f"{API_URL}/ai/jobs/enqueue"
    # Schema API Rust : job_type + payload (pas "params") + parameter_id + requested_by
    body = {
        "job_type":     job_type,
        "payload":      params,       # API attend "payload" pas "params"
        "parameter_id": "all",        # cible tous les parametres
        "requested_by": requested_by,
    }
    try:
        r = requests.post(url, json=body, headers=api_headers(), timeout=30)
        if r.status_code == 401:
            return None  # token manquant/invalide
        r.raise_for_status()
        data = r.json()
        return str(data.get("job_id") or data.get("id") or "")
    except requests.RequestException as e:
        return None


def poll_job(job_id: str, timeout: int, log: logging.Logger) -> Tuple[bool, str]:
    """
    Poll GET /ai/jobs/:id jusqu'a completion ou timeout.
    Retourne (success, final_status).
    """
    url      = f"{API_URL}/ai/jobs/{job_id}"
    deadline = time.monotonic() + timeout
    last_pct = -1

    while time.monotonic() < deadline:
        try:
            r = requests.get(url, headers=api_headers(), timeout=10)
            r.raise_for_status()
            data = r.json()
        except requests.RequestException as e:
            log.warning("    Poll erreur : %s", e)
            time.sleep(POLL_INTERVAL)
            continue

        status = data.get("status", "unknown")
        pct    = data.get("progress_pct")

        if pct is not None and pct != last_pct:
            log.info("    Progress : %d%% -- %s", pct, status)
            last_pct = pct

        if status in ("completed", "success"):
            return True, status
        elif status in ("failed", "error", "cancelled"):
            err = data.get("logs", "")[-200:]
            log.error("    Job %s echoue : %s", job_id, err)
            return False, status

        time.sleep(POLL_INTERVAL)

    log.error("    TIMEOUT apres %ds -- job %s toujours %s", timeout, job_id, status)
    return False, "timeout"


def check_api_alive(api_url: str, log: logging.Logger) -> bool:
    """Verifie que l'API est accessible (supporte /health et /healthz)."""
    for path in ("/health", "/healthz"):
        try:
            r = requests.get(f"{api_url}{path}", timeout=5)
            if r.status_code == 200:
                return True
        except requests.RequestException:
            pass
    log.error("API non accessible a %s", api_url)
    return False


# --- Runner ------------------------------------------------------------------

def run_ml_job(
    job_def: Dict[str, Any],
    checkpoint: Checkpoint,
    log: logging.Logger,
    dry_run: bool,
) -> bool:
    """Enqueue + poll un job ML via l'API Rust."""
    job_type  = job_def["job_type"]
    label     = job_def["label"]
    params    = job_def.get("params", {})
    key       = f"ml_{job_type}"
    timeout   = POLL_TIMEOUT.get(job_type, 3600)

    if checkpoint.is_done(key):
        log.info("    -> SKIP (deja reussi) : %s", label)
        return True

    if dry_run:
        log.info("  [DRY-RUN] enqueue %s (params=%s)", job_type, params)
        checkpoint.mark(key, "success", job_id="dry-run")
        return True

    log.info("  -> Enqueue : %s", label)
    job_id = enqueue_job(job_type, params, requested_by="nightly_v2")
    if not job_id:
        log.error("  [FAIL] Impossible d'enqueuer %s -- verifier l'API", label)
        checkpoint.mark(key, "failed")
        return False

    log.info("    job_id = %s -- polling toutes les %ds (timeout=%ds)...", job_id, POLL_INTERVAL, timeout)
    checkpoint.mark(key, "running", job_id=job_id)
    t0 = time.monotonic()

    success, final_status = poll_job(job_id, timeout, log)
    elapsed = time.monotonic() - t0

    if success:
        log.info("  [OK] DONE : %s (%.1fs)", label, elapsed)
        checkpoint.mark(key, "success", job_id=job_id, elapsed=elapsed)
    else:
        log.error("  [FAIL] FAILED : %s (%s, %.1fs)", label, final_status, elapsed)
        checkpoint.mark(key, "failed", job_id=job_id, elapsed=elapsed)

    return success


# --- Phases ------------------------------------------------------------------

def phase_ml(
    pipeline: List[Dict[str, Any]],
    models_to_run: set,
    checkpoint: Checkpoint,
    log: logging.Logger,
    dry_run: bool,
) -> Dict[str, Tuple[int, int]]:
    results: Dict[str, Tuple[int, int]] = {}

    for job_def in pipeline:
        job_type = job_def["job_type"]
        model    = JOB_MODEL_MAP.get(job_type, "")

        # Filtre --models
        if models_to_run and model and model not in models_to_run:
            log.info("    -> SKIP (non dans --models) : %s", job_def["label"])
            continue

        # L2b BLUP depend de L1 ET L2a
        if job_type == "blup_recompute":
            l1_ok  = checkpoint.is_done("ml_ked_recompute") or dry_run
            l2a_ok = checkpoint.is_done("ml_rk_recompute")  or dry_run
            if not l1_ok:
                log.warning("  [!] BLUP : L1 KED non termine ou en echec")
            if not l2a_ok:
                log.warning("  [!] BLUP : L2a RK non termine ou en echec")

        ok    = 1 if run_ml_job(job_def, checkpoint, log, dry_run) else 0
        fail  = 1 - ok
        results[job_def["label"]] = (ok, fail)

    return results


def phase_exports(
    exports: List[Dict[str, Any]],
    checkpoint: Checkpoint,
    log: logging.Logger,
    dry_run: bool,
) -> Dict[str, Tuple[int, int]]:
    results: Dict[str, Tuple[int, int]] = {}
    log.info("== EXPORTS ======================================")

    for job_def in exports:
        ok   = 1 if run_ml_job(job_def, checkpoint, log, dry_run) else 0
        fail = 1 - ok
        results[job_def["label"]] = (ok, fail)

    return results


# --- Rapport final -----------------------------------------------------------

def print_final_report(
    results: Dict[str, Tuple[int, int]],
    t_total: float,
    log: logging.Logger,
) -> None:
    log.info("=" * 60)
    log.info("RAPPORT FINAL -- Orchestrateur Nightly v2 (via API Rust)")
    log.info("=" * 60)

    total_ok = total_fail = 0
    for label, (ok, fail) in results.items():
        sym = "[OK]" if fail == 0 else "[FAIL]"
        log.info("  %s %-40s  OK=%d  ECHEC=%d", sym, label, ok, fail)
        total_ok   += ok
        total_fail += fail

    log.info("-" * 60)
    log.info("  TOTAL  : %d OK, %d ECHEC -- %.1f min", total_ok, total_fail, t_total / 60)
    if total_fail > 0:
        log.warning("  %d echec(s) -- relancer le script (reprise depuis checkpoint)", total_fail)
    else:
        log.info("  Tous les calculs sont termines avec succes.")
    log.info("=" * 60)


# --- CLI ---------------------------------------------------------------------

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Orchestrateur ML nightly v2 -- via API Rust api-geo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    p.add_argument("--dry-run", action="store_true",
                   help="Simule sans appeler l'API (marque en succes dans le checkpoint)")
    p.add_argument("--reset", action="store_true",
                   help="Efface le checkpoint et repart de zero")
    p.add_argument("--status", action="store_true",
                   help="Affiche le statut du checkpoint et quitte")
    p.add_argument("--models", default="l1,l2a,l2b,l3,l4",
                   help="Modeles a lancer (defaut: l1,l2a,l2b,l3,l4)")
    p.add_argument("--skip-exports", action="store_true",
                   help="Ne pas lancer les exports apres les modeles")
    p.add_argument("--api-url", default=API_URL,
                   help=f"URL de l'API api-geo (defaut: {API_URL})")
    p.add_argument("--token", default=API_TOKEN,
                   help="JWT Bearer token si authentification activee")
    return p.parse_args()


def main() -> int:
    args = parse_args()

    global API_URL, API_TOKEN
    API_URL   = args.api_url
    API_TOKEN = args.token

    log        = setup_logging(dry_run=args.dry_run)
    checkpoint = Checkpoint(CHECKPOINT_FILE)

    if args.status:
        checkpoint.print_status()
        return 0

    if args.reset:
        log.info("Reset checkpoint v2 : %s", CHECKPOINT_FILE)
        checkpoint.reset()

    log.info("API           : %s", API_URL)
    log.info("Mode          : %s", "DRY-RUN" if args.dry_run else "RÉEL")
    log.info("Modeles       : %s", args.models)
    log.info("Skip exports  : %s", args.skip_exports)

    if not args.dry_run:
        log.info("Verification de l'API...")
        if not check_api_alive(API_URL, log):
            log.error("API non accessible -- arret. Demarrer api-geo avant de lancer cet orchestrateur.")
            return 1
        log.info("  [OK] API accessible")

    models_to_run = {m.strip().lower() for m in args.models.split(",")}
    results: Dict[str, Tuple[int, int]] = {}
    t_start = time.monotonic()

    # -- Pipeline ML ----------------------------------------------------------
    log.info("== PIPELINE ML ==================================")
    results.update(phase_ml(PIPELINE, models_to_run, checkpoint, log, args.dry_run))

    # -- Exports --------------------------------------------------------------
    if not args.skip_exports:
        ml_fail = sum(f for _, f in results.values())
        if ml_fail > 0 and not args.dry_run:
            log.warning("%d echec(s) ML -- exports lances quand meme (peuvent etre incomplets)", ml_fail)
        results.update(phase_exports(EXPORTS, checkpoint, log, args.dry_run))

    # -- Rapport --------------------------------------------------------------
    t_total = time.monotonic() - t_start
    print_final_report(results, t_total, log)

    total_fail = sum(f for _, f in results.values())
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
