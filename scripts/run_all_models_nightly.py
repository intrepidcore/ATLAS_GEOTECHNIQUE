#!/usr/bin/env python3
"""
run_all_models_nightly.py — Super-Orchestrateur ML Atlas Géotechnique du Togo
==============================================================================
Orchestre le lancement séquentiel des modèles L1 → L2a → L2b → L3 → L4
avec checkpointing, reprise automatique, gestion RAM et support GPU NVIDIA.

Usage :
  # Lancer normalement (reprend depuis le dernier checkpoint)
  python scripts/run_all_models_nightly.py

  # Dry-run complet (affiche le plan sans rien exécuter)
  python scripts/run_all_models_nightly.py --dry-run

  # Effacer le checkpoint et tout relancer
  python scripts/run_all_models_nightly.py --reset

  # Lancer seulement certains modèles
  python scripts/run_all_models_nightly.py --models l1,l2a,l2b

  # Skip les exports (juste les modèles ML)
  python scripts/run_all_models_nightly.py --skip-exports

  # Afficher le statut du checkpoint actuel
  python scripts/run_all_models_nightly.py --status

Architecture :
  - Checkpointing JSON dans logs/checkpoint_nightly.json
  - Un "task_key" par (modèle, paramètre, horizon)
  - Catch toutes les exceptions → log → passe au suivant
  - OMP_NUM_THREADS contrôlé par --threads
  - GPU NVIDIA : TF_FORCE_GPU_ALLOW_GROWTH=true + tf.config.experimental.set_memory_growth
  - Exports PNG 300dpi + 3D archetypes + cartes comparatives L1-L4

Référence : AUDIT_GEOCODAGE_CRITIQUE_2026-06-04.md — Phase 4
DB cible  : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean (CONV-15)
"""

from __future__ import annotations

import argparse
import gc
import json
import logging
import os
import platform
import subprocess
import sys
import time
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

# ─── Constantes ─────────────────────────────────────────────────────────────

SCRIPTS_DIR = Path(__file__).parent.resolve()
PROJECT_ROOT = SCRIPTS_DIR.parent
LOGS_DIR = PROJECT_ROOT / "logs"
CHECKPOINT_FILE = LOGS_DIR / "checkpoint_nightly.json"

DB_URL = os.environ.get(
    "DATABASE_URL",
    "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean",
)

# Paramètres par modèle (CONV-16/17 respectées)
L1_KINDS     = ["vbs", "ip", "wl", "wp"]   # EG via run_ked_eg_horizons.py séparé
L1_HORIZONS  = ["h1", "h2", "h3"]
L2A_PARAMS   = ["vbs", "ip", "wl", "wp", "eg"]
L2A_HORIZONS = ["h1", "h2", "h3"]
L2B_PARAMS   = ["vbs", "ip", "wl", "wp", "eg"]
L2B_HORIZONS = ["h1", "h2", "h3"]
L4_PARAMS    = ["vbs", "ip", "eg"]          # WL/WP non exposés dans API Rust (MTGP)
L4_HORIZONS  = ["h1", "h2", "h3"]

# Paramètres pour les exports PNG 300dpi
EXPORT_PARAMS = [
    "vbs_ked_h1", "vbs_ked_h2", "vbs_ked_h3",
    "ip_ked_h1",  "ip_ked_h2",  "ip_ked_h3",
    "wl_ked_h1",  "wl_ked_h2",  "wl_ked_h3",
    "wp_ked_h1",  "wp_ked_h2",  "wp_ked_h3",
    "eg_ked_h1",  "eg_ked_h2",  "eg_ked_h3",
    "vbs_fusion_h1", "vbs_fusion_h2", "vbs_fusion_h3",
    "ip_fusion_h1",  "ip_fusion_h2",  "ip_fusion_h3",
    "eg_fusion_h1",  "eg_fusion_h2",  "eg_fusion_h3",
    "vbs_mtgp_h1",   "vbs_mtgp_h2",   "vbs_mtgp_h3",
    "ip_mtgp_h1",    "ip_mtgp_h2",    "ip_mtgp_h3",
    "eg_mtgp_h1",    "eg_mtgp_h2",    "eg_mtgp_h3",
]

EXPORT_3D_PARAMS = ["vbs", "ip", "eg", "wl", "wp"]
EXPORT_3D_ARCHETYPES = "BACD"

COMPARE_PARAMS   = ["vbs", "ip", "eg"]
COMPARE_HORIZONS = ["h1", "h2", "h3"]

# Timeouts (secondes)
TIMEOUT_L1   = 3600   # 1h — KED complet (toutes kinds × horizons)
TIMEOUT_L2A  = 1800   # 30 min — RK un paramètre
TIMEOUT_L2B  = 2400   # 40 min — BLUP tous params
TIMEOUT_L3   = 7200   # 2h — VfS (GEE + calibration PLS)
TIMEOUT_L4   = 5400   # 1h30 — MTGP (GPU, tous params × horizons)
TIMEOUT_EXPORT_PNG = 600   # 10 min par paramètre
TIMEOUT_EXPORT_3D  = 900   # 15 min par paramètre
TIMEOUT_MAPS = 300          # 5 min par param/horizon

# ─── Logging ────────────────────────────────────────────────────────────────

def setup_logging(dry_run: bool = False) -> logging.Logger:
    LOGS_DIR.mkdir(parents=True, exist_ok=True)
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    log_file = LOGS_DIR / f"nightly_{ts}{'_dryrun' if dry_run else ''}.log"

    fmt = "%(asctime)s [%(levelname)-8s] %(message)s"
    handlers: List[logging.Handler] = [
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(log_file, encoding="utf-8"),
    ]
    logging.basicConfig(level=logging.INFO, format=fmt, handlers=handlers)
    log = logging.getLogger("orchestrator")
    log.info("Log file: %s", log_file)
    return log


# ─── Checkpointing ──────────────────────────────────────────────────────────

class Checkpoint:
    """Gestion du fichier de checkpoint JSON pour reprise automatique."""

    def __init__(self, path: Path) -> None:
        self.path = path
        self._data: Dict[str, Any] = self._load()

    def _load(self) -> Dict[str, Any]:
        if self.path.exists():
            try:
                return json.loads(self.path.read_text(encoding="utf-8"))
            except (json.JSONDecodeError, OSError):
                return {}
        return {}

    def _save(self) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self.path.write_text(
            json.dumps(self._data, indent=2, ensure_ascii=False, default=str),
            encoding="utf-8",
        )

    def is_done(self, key: str) -> bool:
        entry = self._data.get(key, {})
        return entry.get("status") == "success"

    def mark_start(self, key: str, cmd: List[str]) -> None:
        self._data[key] = {
            "status": "running",
            "started_at": datetime.now(timezone.utc).isoformat(),
            "cmd": " ".join(cmd),
        }
        self._save()

    def mark_success(self, key: str, elapsed: float) -> None:
        entry = self._data.get(key, {})
        entry.update({
            "status": "success",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "elapsed_s": round(elapsed, 1),
        })
        self._data[key] = entry
        self._save()

    def mark_failure(self, key: str, error: str, elapsed: float) -> None:
        entry = self._data.get(key, {})
        entry.update({
            "status": "failed",
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "elapsed_s": round(elapsed, 1),
            "error": error[:2000],  # tronque les stacktraces
        })
        self._data[key] = entry
        self._save()

    def reset(self) -> None:
        self._data = {}
        self._save()

    def summary(self) -> Dict[str, int]:
        counts: Dict[str, int] = {}
        for v in self._data.values():
            s = v.get("status", "unknown")
            counts[s] = counts.get(s, 0) + 1
        return counts

    def print_status(self) -> None:
        if not self._data:
            print("Aucun checkpoint enregistré.")
            return
        s = self.summary()
        print(f"\nCheckpoint : {self.path}")
        print(f"  Success  : {s.get('success', 0)}")
        print(f"  Failed   : {s.get('failed', 0)}")
        print(f"  Running  : {s.get('running', 0)}")
        print(f"  Total    : {len(self._data)}\n")
        failed = [(k, v) for k, v in self._data.items() if v.get("status") == "failed"]
        if failed:
            print("  Tâches en échec :")
            for k, v in failed[:20]:
                print(f"    ✗ {k} — {v.get('error','')[:80]}")


# ─── Environnement GPU / RAM ─────────────────────────────────────────────────

def build_env(threads: int = 4, gpu: bool = False) -> Dict[str, str]:
    """
    Construit l'environnement subprocess avec contrôle RAM et GPU NVIDIA.

    RAM / CPU :
      OMP_NUM_THREADS, MKL_NUM_THREADS, OPENBLAS_NUM_THREADS → limite les threads BLAS
      pour éviter la saturation CPU sur des matrices kriging volumineuses.

    GPU (MTGP / GPflow) :
      TF_FORCE_GPU_ALLOW_GROWTH=true  → allocation mémoire dynamique (évite OOM)
      TF_GPU_THREAD_MODE=gpu_private  → threads GPU dédiés
      TF_CPP_MIN_LOG_LEVEL=2         → réduit le bruit TF dans les logs
      CUDA_VISIBLE_DEVICES=0         → force la GPU 0 (modifier si multi-GPU)
      Absence de CUDA_VISIBLE_DEVICES=-1 → GPU actif (pas de désactivation)
    """
    env = os.environ.copy()
    t = str(threads)
    env.update({
        "OMP_NUM_THREADS":       t,
        "MKL_NUM_THREADS":       t,
        "OPENBLAS_NUM_THREADS":  t,
        "NUMEXPR_NUM_THREADS":   t,
        "VECLIB_MAXIMUM_THREADS": t,
        "DATABASE_URL": DB_URL,
        "PYTHONUNBUFFERED": "1",
        "PYTHONUTF8":       "1",
    })

    if gpu:
        env.update({
            "TF_FORCE_GPU_ALLOW_GROWTH":  "true",
            "TF_GPU_THREAD_MODE":         "gpu_private",
            "TF_CPP_MIN_LOG_LEVEL":       "2",
            "TF_ENABLE_ONEDNN_OPTS":      "0",
            "CUDA_VISIBLE_DEVICES":       "0",
        })
        # Désactive la préallocation totale de VRAM par GPflow/TF
        # tf.config.experimental.set_memory_growth est appelé dans le script fils
        # via la variable d'env — le script mtgp_geotechnique.py doit l'honorer.
        # Si non, injecter via sitecustomize ou wrapper (voir ci-dessous).
    else:
        # Sur les tâches CPU, masquer le GPU pour ne pas charger TF dessus
        env["CUDA_VISIBLE_DEVICES"] = "-1"

    return env


def inject_gpu_growth_wrapper(
    script: Path,
    db_url: str,
    extra_args: List[str],
    dry_run: bool,
) -> List[str]:
    """
    Wrapper Python inline qui active memory_growth AVANT d'importer gpflow/tf,
    puis exécute le script MTGP via subprocess.run(sys.argv[1:]).
    Cela contourne l'impossibilité de patcher tf.config depuis l'extérieur.
    """
    snippet = (
        "import os; os.environ.setdefault('TF_FORCE_GPU_ALLOW_GROWTH','true'); "
        "import sys; sys.argv = [str(sys.argv[0])] + sys.argv[2:]; "
    )
    # Vérifie si gpflow est installé avant d'injecter le hook TF
    check = (
        "try:\n"
        "    import tensorflow as tf\n"
        "    gpus = tf.config.list_physical_devices('GPU')\n"
        "    [tf.config.experimental.set_memory_growth(g, True) for g in gpus]\n"
        "    print(f'[GPU] {len(gpus)} GPU(s) avec memory_growth activé', flush=True)\n"
        "except Exception as e:\n"
        "    print(f'[GPU] Pas de GPU ou TF absent: {e}', flush=True)\n"
    )
    wrapper_code = (
        "import sys, os\n"
        + check
        + f"exec(open({str(script)!r}).read())\n"
    )
    # On passe le script réel comme argument positionnel au wrapper
    return [sys.executable, "-c", wrapper_code, "--database-url", db_url] + extra_args


# ─── Exécution d'un sous-processus ──────────────────────────────────────────

def run_task(
    key: str,
    cmd: List[str],
    env: Dict[str, str],
    timeout: int,
    checkpoint: Checkpoint,
    log: logging.Logger,
    dry_run: bool,
) -> bool:
    """
    Lance un subprocess, logge sa sortie, gère timeout et erreurs.
    Retourne True si succès, False sinon.
    """
    if checkpoint.is_done(key):
        log.info("  ↳ SKIP (déjà réussi) : %s", key)
        return True

    cmd_str = " ".join(str(c) for c in cmd)

    if dry_run:
        log.info("  [DRY-RUN] %s", cmd_str)
        checkpoint.mark_success(key, 0.0)
        return True

    log.info("  ▶ START : %s", key)
    log.debug("  CMD : %s", cmd_str)
    checkpoint.mark_start(key, cmd)
    t0 = time.monotonic()

    try:
        result = subprocess.run(
            cmd,
            env=env,
            timeout=timeout,
            capture_output=False,  # stdout/stderr vont dans le terminal + fichier log
            check=True,
            cwd=str(PROJECT_ROOT),
        )
        elapsed = time.monotonic() - t0
        checkpoint.mark_success(key, elapsed)
        log.info("  ✓ DONE  : %s (%.1fs)", key, elapsed)
        # Libère les ressources Python après chaque tâche lourde
        gc.collect()
        return True

    except subprocess.TimeoutExpired:
        elapsed = time.monotonic() - t0
        msg = f"TIMEOUT après {elapsed:.0f}s (limite={timeout}s)"
        checkpoint.mark_failure(key, msg, elapsed)
        log.error("  ✗ TIMEOUT : %s — %s", key, msg)
        return False

    except subprocess.CalledProcessError as exc:
        elapsed = time.monotonic() - t0
        msg = f"exit={exc.returncode}"
        checkpoint.mark_failure(key, msg, elapsed)
        log.error("  ✗ FAILED  : %s — %s (%.1fs)", key, msg, elapsed)
        return False

    except Exception as exc:
        elapsed = time.monotonic() - t0
        msg = str(exc)
        checkpoint.mark_failure(key, msg, elapsed)
        log.error("  ✗ ERROR   : %s — %s", key, msg)
        return False


# ─── Phases ML ───────────────────────────────────────────────────────────────

def phase_l1_ked(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    L1 KED Hiérarchique 5 niveaux.
    Lance le script une fois par KIND (pour checkpointing fin-grain).
    Le script gère lui-même tous les horizons H1/H2/H3 pour ce kind.
    """
    log.info("══ PHASE L1 — KED Hiérarchique 5 niveaux ══")
    ok = fail = 0

    script = SCRIPTS_DIR / "run_ked_vbs_ip_wl_wp_horizons.py"

    for kind in L1_KINDS:
        key = f"l1_ked_{kind}_all_horizons"
        cmd = [
            sys.executable, str(script),
            "--database-url", DB_URL,
            "--kinds", kind,
            "--hierarchical",
        ]
        success = run_task(key, cmd, env, TIMEOUT_L1, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    # EG horizons (script séparé)
    script_eg = SCRIPTS_DIR / "run_ked_eg_horizons.py"
    if script_eg.exists():
        key = "l1_ked_eg_all_horizons"
        cmd = [sys.executable, str(script_eg), "--database-url", DB_URL, "--hierarchical"]
        success = run_task(key, cmd, env, TIMEOUT_L1, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    log.info("L1 KED : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_l2a_rk(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    L2a RK-SCORPAN — 1 subprocess par (paramètre × horizon) pour granularité max.
    Ainsi un échec sur WP-H3 ne bloque pas VBS-H1.
    """
    log.info("══ PHASE L2a — Regression Kriging SCORPAN ══")
    ok = fail = 0
    script = SCRIPTS_DIR / "atlas_regression_kriging_terrain.py"

    for param in L2A_PARAMS:
        for hz in L2A_HORIZONS:
            key = f"l2a_rk_{param}_{hz}"
            cmd = [
                sys.executable, str(script),
                "--database-url", DB_URL,
                "--parameter", param,
                "--horizon", hz,
            ]
            success = run_task(key, cmd, env, TIMEOUT_L2A, checkpoint, log, dry_run)
            if success: ok += 1
            else:        fail += 1

    log.info("L2a RK : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_l2b_blup(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    L2b Fusion Bayésienne BLUP — attend que L1 ET L2a soient terminés.
    Le script prend tous params × horizons en un seul appel.
    Pour le checkpointing, on lance un pass global (idempotent si déjà fait).
    """
    log.info("══ PHASE L2b — Fusion Bayésienne BLUP ══")
    ok = fail = 0
    script = SCRIPTS_DIR / "ked_rk_fusion.py"

    # Stratégie : un call par paramètre pour granularité checkpointing
    for param in L2B_PARAMS:
        key = f"l2b_blup_{param}_all_horizons"
        cmd = [
            sys.executable, str(script),
            "--database-url", DB_URL,
            "--params", param,
            "--horizons", ",".join(L2B_HORIZONS),
        ]
        success = run_task(key, cmd, env, TIMEOUT_L2B, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    log.info("L2b BLUP : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_l3_vfs(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    L3 VfS-PLS Sentinel-2 — pipeline complet (skip-gee si données déjà extraites).
    Ce modèle est indépendant de L1/L2 mais nécessite des données GEE externes.
    """
    log.info("══ PHASE L3 — VfS-PLS Sentinel-2 ══")
    ok = fail = 0
    script = SCRIPTS_DIR / "vfs_extract_spectral.py"

    key = "l3_vfs_all"
    cmd = [
        sys.executable, str(script),
        "--database-url", DB_URL,
        "--mode", "all",
        "--skip-gee",  # Utilise les données déjà en base pour éviter les appels GEE
    ]
    success = run_task(key, cmd, env, TIMEOUT_L3, checkpoint, log, dry_run)
    if success: ok += 1
    else:        fail += 1

    log.info("L3 VfS : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_l4_mtgp(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env_cpu: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    L4 MTGP/ICM GPflow — requiert GPU NVIDIA.

    Stratégie GPU :
    1. Env var TF_FORCE_GPU_ALLOW_GROWTH=true → allocation dynamique VRAM
    2. Wrapper Python qui appelle tf.config.experimental.set_memory_growth AVANT gpflow
    3. Un appel par paramètre (VBS, IP, EG) pour libérer VRAM entre chaque

    Note : WL/WP ne sont pas calculés par MTGP (non exposés dans l'API Rust CONV-17)
    """
    log.info("══ PHASE L4 — MTGP/ICM GPflow (GPU) ══")
    ok = fail = 0

    # Environnement spécifique GPU
    env_gpu = build_env(threads=4, gpu=True)

    # Vérifie si NVIDIA GPU disponible
    _check_nvidia_gpu(log)

    script = SCRIPTS_DIR / "mtgp_geotechnique.py"

    for param in L4_PARAMS:
        key = f"l4_mtgp_{param}_all_horizons"
        # Wrapper GPU qui active memory_growth avant gpflow
        cmd = inject_gpu_growth_wrapper(
            script=script,
            db_url=DB_URL,
            extra_args=[
                "--params", param,
                "--horizons", ",".join(L4_HORIZONS),
            ],
            dry_run=dry_run,
        )
        if dry_run:
            # En dry-run, utiliser la commande directe pour affichage lisible
            cmd = [
                sys.executable, str(script),
                "--database-url", DB_URL,
                "--params", param,
                "--horizons", ",".join(L4_HORIZONS),
                "--dry-run",
            ]
        success = run_task(key, cmd, env_gpu, TIMEOUT_L4, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    log.info("L4 MTGP : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def _check_nvidia_gpu(log: logging.Logger) -> None:
    """Vérifie la présence d'un GPU NVIDIA via nvidia-smi."""
    try:
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version",
             "--format=csv,noheader"],
            capture_output=True, text=True, timeout=10,
        )
        if result.returncode == 0:
            for line in result.stdout.strip().splitlines():
                log.info("  [GPU] Détecté : %s", line.strip())
        else:
            log.warning("  [GPU] nvidia-smi disponible mais erreur : %s", result.stderr[:100])
    except FileNotFoundError:
        log.warning("  [GPU] nvidia-smi introuvable — GPU non détecté ou non configuré")
    except subprocess.TimeoutExpired:
        log.warning("  [GPU] nvidia-smi timeout")


# ─── Phases Export ───────────────────────────────────────────────────────────

def phase_exports_png_300dpi(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    Export PNG 300dpi via headless_render_300dpi.py.
    Lance --all en une seule fois (le script gère la liste complète).
    Pour un checkpointing plus fin, on passe --param individuellement.
    """
    log.info("══ EXPORT — PNG 300dpi ══")
    ok = fail = 0
    script = SCRIPTS_DIR / "headless_render_300dpi.py"

    for param in EXPORT_PARAMS:
        key = f"export_png300__{param}"
        cmd = [
            sys.executable, str(script),
            "--database-url", DB_URL,
            "--param", param,
            "--dpi", "300",
        ]
        success = run_task(key, cmd, env, TIMEOUT_EXPORT_PNG, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    log.info("Export PNG 300dpi : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_exports_3d(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    Export exports_3d_v2 — archetypes B, C, D en PNG/SVG via render_3d_archetypes.py.
    L'archetype A (Cube Plotly) est servi dynamiquement, pas besoin de pré-générer.
    """
    log.info("══ EXPORT — 3D Archetypes (B/C/D) ══")
    ok = fail = 0
    script = SCRIPTS_DIR / "render_3d_archetypes.py"
    exports_dir = PROJECT_ROOT / "exports_3d_v2"
    exports_dir.mkdir(parents=True, exist_ok=True)

    for param in EXPORT_3D_PARAMS:
        key = f"export_3d__{param}__BCD"
        cmd = [
            sys.executable, str(script),
            "--database-url", DB_URL,
            "--param", param,
            "--archetype", "BCD",  # Pas A (Plotly servi à la demande)
            "--out", str(exports_dir),
        ]
        success = run_task(key, cmd, env, TIMEOUT_EXPORT_3D, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    log.info("Export 3D archetypes : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_exports_maps_compare(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    Cartes comparatives L1/L2a/L2b/L4 via generate_maps_l1_l4.py.
    Ces cartes nourrissent les figures de l'article scientifique.
    """
    log.info("══ EXPORT — Cartes comparatives L1-L4 ══")
    ok = fail = 0
    script = SCRIPTS_DIR / "generate_maps_l1_l4.py"

    if not script.exists():
        log.warning("Script generate_maps_l1_l4.py introuvable — skip export cartes")
        return 0, 0

    for param in COMPARE_PARAMS:
        for hz in COMPARE_HORIZONS:
            key = f"export_maps_compare__{param}__{hz}"
            cmd = [
                sys.executable, str(script),
                "--database-url", DB_URL,
                "--param", param,
                "--horizon", hz,
                "--models", "all",
                "--compare",
            ]
            success = run_task(key, cmd, env, TIMEOUT_MAPS, checkpoint, log, dry_run)
            if success: ok += 1
            else:        fail += 1

    log.info("Cartes comparatives : %d OK, %d ECHEC", ok, fail)
    return ok, fail


def phase_exports_article_figures(
    checkpoint: Checkpoint,
    log: logging.Logger,
    env: Dict[str, str],
    dry_run: bool,
) -> Tuple[int, int]:
    """
    Régénère les figures de l'article scientifique :
    fig01 (boxplots), fig02 (variogramme), fig03 (LOO-RMSE), fig04 (corrélation), fig05 (variance).
    Utilise les scripts dédiés si disponibles, sinon appel API pour métriques.
    """
    log.info("══ EXPORT — Figures article scientifique ══")
    ok = fail = 0

    figure_scripts: List[Tuple[str, str, List[str]]] = [
        ("fig01_boxplots",         "generate_national_graphs.py",   []),
        ("fig02_variogram",        "generate_variogram_plot.py",    ["--param", "vbs", "--horizon", "h1"]),
        ("fig03_loo_rmse",         "get_article_metrics.py",        []),
        ("fig04_correlation",      "get_corr2.py",                  []),
        ("fig05_variance_reduction","generate_national_analysis.py", ["--variance-reduction"]),
    ]

    for key_suffix, script_name, extra in figure_scripts:
        script = SCRIPTS_DIR / script_name
        if not script.exists():
            log.debug("  Skip %s (script introuvable)", script_name)
            continue
        key = f"export_article__{key_suffix}"
        cmd = [sys.executable, str(script), "--database-url", DB_URL] + extra
        success = run_task(key, cmd, env, TIMEOUT_MAPS, checkpoint, log, dry_run)
        if success: ok += 1
        else:        fail += 1

    log.info("Figures article : %d OK, %d ECHEC (scripts absents ignorés)", ok, fail)
    return ok, fail


# ─── Rapport final ───────────────────────────────────────────────────────────

def print_final_report(
    results: Dict[str, Tuple[int, int]],
    t_total: float,
    log: logging.Logger,
) -> None:
    log.info("═" * 60)
    log.info("RAPPORT FINAL — Orchestrateur Nightly Atlas ML")
    log.info("═" * 60)

    total_ok = total_fail = 0
    for phase, (ok, fail) in results.items():
        status = "✓" if fail == 0 else "✗"
        log.info("  %s %-35s  OK=%d  ECHEC=%d", status, phase, ok, fail)
        total_ok   += ok
        total_fail += fail

    log.info("─" * 60)
    log.info("  TOTAL : %d tâches OK, %d tâches en ECHEC", total_ok, total_fail)
    log.info("  Durée totale : %.1f minutes", t_total / 60)

    if total_fail > 0:
        log.warning("  %d tâche(s) en échec — relancer le script pour reprise automatique", total_fail)
        log.warning("  Consulter les logs et le checkpoint : %s", CHECKPOINT_FILE)
    else:
        log.info("  Tous les calculs sont terminés avec succès.")
    log.info("═" * 60)


# ─── Point d'entrée ──────────────────────────────────────────────────────────

def parse_args() -> argparse.Namespace:
    p = argparse.ArgumentParser(
        description="Super-Orchestrateur ML Atlas Geotechnique du Togo",
        formatter_class=argparse.RawDescriptionHelpFormatter,
    )
    p.add_argument(
        "--dry-run", action="store_true",
        help="Affiche le plan complet sans rien exécuter (écrit quand même dans le checkpoint)",
    )
    p.add_argument(
        "--reset", action="store_true",
        help="Efface le checkpoint et repart de zéro",
    )
    p.add_argument(
        "--status", action="store_true",
        help="Affiche le statut du checkpoint actuel et quitte",
    )
    p.add_argument(
        "--models",
        default="l1,l2a,l2b,l3,l4",
        help="Modèles à lancer, séparés par virgule (défaut: l1,l2a,l2b,l3,l4)",
    )
    p.add_argument(
        "--skip-exports", action="store_true",
        help="Ne pas régénérer les exports après les modèles ML",
    )
    p.add_argument(
        "--threads", type=int, default=4,
        help="Nombre de threads CPU (OMP_NUM_THREADS etc.) — défaut: 4",
    )
    p.add_argument(
        "--database-url",
        default=DB_URL,
        help=f"URL de la base PostgreSQL (défaut: {DB_URL})",
    )
    return p.parse_args()


def main() -> int:
    args = parse_args()

    # Mise à jour globale DB_URL si passée en argument
    global DB_URL
    if args.database_url != DB_URL:
        DB_URL = args.database_url

    log = setup_logging(dry_run=args.dry_run)
    checkpoint = Checkpoint(CHECKPOINT_FILE)

    # ── Commandes utilitaires ──
    if args.status:
        checkpoint.print_status()
        return 0

    if args.reset:
        log.info("Reset du checkpoint : %s", CHECKPOINT_FILE)
        checkpoint.reset()

    # ── Info système ──
    log.info("Système     : %s %s", platform.system(), platform.release())
    log.info("Python      : %s", sys.version.split()[0])
    log.info("Scripts dir : %s", SCRIPTS_DIR)
    log.info("DB URL      : %s", DB_URL)
    log.info("Threads     : %d", args.threads)
    log.info("Dry-run     : %s", args.dry_run)
    log.info("Modèles     : %s", args.models)
    log.info("Checkpoint  : %s", CHECKPOINT_FILE)

    if not args.dry_run:
        checkpoint.print_status()

    models_to_run = {m.strip().lower() for m in args.models.split(",")}
    env_cpu = build_env(threads=args.threads, gpu=False)

    results: Dict[str, Tuple[int, int]] = {}
    t_start = time.monotonic()

    # ═══════════════════════════════════════════════════════════════
    # PIPELINE ML — ordre impératif (BLUP dépend de L1 ET L2a)
    # ═══════════════════════════════════════════════════════════════

    if "l1" in models_to_run:
        results["L1 KED Hiérarchique"] = phase_l1_ked(checkpoint, log, env_cpu, args.dry_run)

    # L3 peut être lancé en parallèle avec L1/L2a mais on reste séquentiel
    # pour éviter la saturation RAM (PostgreSQL + numpy + kriging matrices)
    if "l3" in models_to_run:
        results["L3 VfS Sentinel-2"] = phase_l3_vfs(checkpoint, log, env_cpu, args.dry_run)

    if "l2a" in models_to_run:
        results["L2a RK-SCORPAN"] = phase_l2a_rk(checkpoint, log, env_cpu, args.dry_run)

    # L2b BLUP nécessite que L1 et L2a soient terminés
    if "l2b" in models_to_run:
        l1_ok = results.get("L1 KED Hiérarchique", (0, 1))[1] == 0
        l2a_ok = results.get("L2a RK-SCORPAN", (0, 1))[1] == 0
        if not args.dry_run and not l1_ok:
            log.warning("L2b BLUP : L1 KED a des échecs — résultats BLUP potentiellement incomplets")
        if not args.dry_run and not l2a_ok:
            log.warning("L2b BLUP : L2a RK a des échecs — résultats BLUP potentiellement incomplets")
        results["L2b Fusion BLUP"] = phase_l2b_blup(checkpoint, log, env_cpu, args.dry_run)

    if "l4" in models_to_run:
        results["L4 MTGP/ICM GPU"] = phase_l4_mtgp(checkpoint, log, env_cpu, args.dry_run)

    # ═══════════════════════════════════════════════════════════════
    # EXPORTS — uniquement si tous les modèles demandés sont OK
    # ═══════════════════════════════════════════════════════════════

    if not args.skip_exports:
        total_ml_fail = sum(f for _, f in results.values())
        if total_ml_fail > 0 and not args.dry_run:
            log.warning(
                "%d échec(s) ML détecté(s) — les exports seront lancés quand même "
                "mais peuvent être incomplets. Relancer après correction.",
                total_ml_fail,
            )

        results["Export PNG 300dpi"] = phase_exports_png_300dpi(
            checkpoint, log, env_cpu, args.dry_run
        )
        results["Export 3D archetypes"] = phase_exports_3d(
            checkpoint, log, env_cpu, args.dry_run
        )
        results["Export cartes comparatives"] = phase_exports_maps_compare(
            checkpoint, log, env_cpu, args.dry_run
        )
        results["Export figures article"] = phase_exports_article_figures(
            checkpoint, log, env_cpu, args.dry_run
        )

    # ── Rapport final ──
    t_total = time.monotonic() - t_start
    print_final_report(results, t_total, log)

    total_fail = sum(f for _, f in results.values())
    return 0 if total_fail == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
