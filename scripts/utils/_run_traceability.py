"""
_run_traceability.py — Utilitaire partagé de traçabilité des runs ML
======================================================================
Utilisé par tous les scripts d'interpolation (KED, RK, BLUP, MTGP).

Garantit que chaque run enregistré dans atlas.ai_interpolation_runs contient :
  - model_version  : "<script>-<git_hash>-<hp_hash>"
  - meta (jsonb)   : git_hash, hyperparamètres, versions logicielles, timestamps
  - started_at     : horodatage de début réel (pas now() au moment du INSERT)
  - finished_at    : horodatage de fin réel

Usage :
    from utils._run_traceability import make_run_meta, build_version_tag

    t_start = datetime.utcnow()
    # ... calculs ...
    meta = make_run_meta(
        script_name="ked_vbs_ip_wl_wp",
        hyperparams={"drift_method": "pedologie", "n_train": 304},
        metrics={"loo_rmse": 0.42},
        t_start=t_start,
    )
    version_tag = build_version_tag("ked")
"""

from __future__ import annotations

import hashlib
import platform
import subprocess
from datetime import datetime, timezone
from typing import Any, Dict, Optional


def _git_hash() -> str:
    """Retourne le hash court du commit HEAD (best-effort)."""
    try:
        return subprocess.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=subprocess.DEVNULL,
            text=True,
        ).strip()
    except Exception:
        return "nogit"


def _software_versions(extras: Optional[list[str]] = None) -> Dict[str, str]:
    """
    Retourne les versions Python + librairies importantes.
    extras : liste de noms de modules à inspecter (ex: ['sklearn', 'gpflow'])
    """
    versions: Dict[str, str] = {"python": platform.python_version()}
    modules = ["numpy", "pandas", "sklearn", "scipy", "pykrige"] + (extras or [])
    for mod in modules:
        try:
            import importlib
            m = importlib.import_module(mod)
            versions[mod] = getattr(m, "__version__", "?")
        except ImportError:
            pass
    return versions


def build_version_tag(script_prefix: str, hyperparams: Optional[Dict] = None) -> str:
    """
    Construit un tag de version reproductible :
      "<prefix>-<git_hash>-<hp_hash>"

    hp_hash : SHA1 court des hyperparamètres (si fournis), sinon "nohp".
    Permet d'identifier exactement quelle configuration a produit ce run.
    """
    git = _git_hash()
    if hyperparams:
        hp_str = str(sorted(hyperparams.items()))
        hp_hash = hashlib.sha1(hp_str.encode()).hexdigest()[:8]
    else:
        hp_hash = "nohp"
    return f"{script_prefix}-{git}-{hp_hash}"


def make_run_meta(
    script_name: str,
    hyperparams: Dict[str, Any],
    metrics: Optional[Dict[str, Any]] = None,
    t_start: Optional[datetime] = None,
    extra_modules: Optional[list[str]] = None,
) -> Dict[str, Any]:
    """
    Génère le dictionnaire `meta` à insérer dans atlas.ai_interpolation_runs.meta.

    Champs produits :
      git_hash       : hash du commit source
      hp_hash        : hash des hyperparamètres
      hyperparams    : dict complet des hyperparamètres
      software       : versions Python + librairies
      started_at_utc : ISO 8601 début de calcul
      finished_at_utc: ISO 8601 fin de calcul (au moment de l'appel)
      duration_sec   : durée en secondes
      metrics        : métriques de qualité (RMSE, R², etc.)
    """
    t_end = datetime.now(timezone.utc)
    if t_start is None:
        t_start = t_end

    # S'assurer que t_start est timezone-aware
    if t_start.tzinfo is None:
        t_start = t_start.replace(tzinfo=timezone.utc)

    duration = (t_end - t_start).total_seconds()

    git = _git_hash()
    hp_str = str(sorted(hyperparams.items()))
    hp_hash = hashlib.sha1(hp_str.encode()).hexdigest()[:8]

    return {
        "script": script_name,
        "git_hash": git,
        "hp_hash": hp_hash,
        "hyperparams": hyperparams,
        "software": _software_versions(extra_modules),
        "started_at_utc": t_start.isoformat(),
        "finished_at_utc": t_end.isoformat(),
        "duration_sec": round(duration, 1),
        "metrics": metrics or {},
    }
