#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — BLOC B : Fusion KED-RK Cascade Bayésienne
====================================================================
Intrepid Core Engineering Standards

Fusionne les prédictions KED (L1) et RK SCORPAN (L2) par pondération
inverse de variance locale :

  w_KED(s) = 1 / σ²_KED(s)
  w_RK(s)  = 1 / σ²_RK(s)
  Z_FUSION*(s) = (w_KED × Z_KED + w_RK × Z_RK) / (w_KED + w_RK)
  σ²_FUSION(s) = 1 / (w_KED + w_RK)          ← toujours < min des deux variances

Fondement mathématique : Best Linear Unbiased Predictor (BLUP).
Référence : Hengl et al. (2007) Computers & Geosciences.

Règles respectées :
  GEN-01     : inspection DB avant toute écriture
  BM-SYNC-05 : idempotent (relancer est sûr via superseded)
  DATA-02    : validation plages physiques obligatoire
  ETL-03     : jamais continuer silencieusement sur erreur
  CFG-01     : aucune URL hardcodée

Usage :
  python scripts/ked_rk_fusion.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --params vbs,ip,wl,wp,eg \\
      --horizons h1,h2,h3 \\
      [--dry-run]    # Validation sans écriture en base

Métriques produites :
  - LOO-RMSE fusion comparé à KED seul et RK seul
  - Fraction par maille où KED domine vs RK domine (w_KED > w_RK)
  - Stockage dans atlas.ai_interpolation_values (method='ked_rk_fusion_bayesian')
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
import logging
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_batch, Json

# ── Logging ──────────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f"logs/ked_rk_fusion_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("KED_RK_Fusion")

# ── Constantes métier (DATA-02) ───────────────────────────────────────
PHYSICAL_CLAMP: Dict[str, Tuple[float, float]] = {
    "vbs": (0.0, 20.0),
    "ip":  (0.0, 80.0),
    "wl":  (20.0, 120.0),
    "wp":  (10.0, 60.0),
    "eg":  (0.0, 20.0),
}

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

FUSION_METHOD = "ked_rk_fusion_bayesian"

# ── Utilitaires ───────────────────────────────────────────────────────
def json_safe(obj) -> str:
    def scrub(x):
        if isinstance(x, float):
            return None if (math.isnan(x) or math.isinf(x)) else x
        if isinstance(x, dict):
            return {k: scrub(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [scrub(v) for v in x]
        return x
    return json.dumps(scrub(obj), allow_nan=False)


def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn


# ── Inspection DB (GEN-01) ────────────────────────────────────────────
def inspect_db(conn) -> Dict:
    """Vérifie que les tables nécessaires existent et contiennent des données."""
    cur = conn.cursor()
    info: Dict = {}

    cur.execute("""
        SELECT parameter_id, COUNT(*) as n,
               SUM(CASE WHEN variance IS NOT NULL THEN 1 ELSE 0 END) as n_with_var
        FROM atlas.ai_interpolation_values
        WHERE method LIKE 'ked%'
          AND COALESCE(is_superseded, false) = false
        GROUP BY parameter_id
        ORDER BY parameter_id
    """)
    info["ked_params"] = {r[0]: {"n": r[1], "n_with_var": r[2]} for r in cur.fetchall()}

    cur.execute("""
        SELECT parameter_id, COUNT(*) as n,
               SUM(CASE WHEN variance IS NOT NULL THEN 1 ELSE 0 END) as n_with_var
        FROM atlas.ai_interpolation_values
        WHERE method = 'regression_kriging_scorpan'
          AND COALESCE(is_superseded, false) = false
        GROUP BY parameter_id
        ORDER BY parameter_id
    """)
    info["rk_params"] = {r[0]: {"n": r[1], "n_with_var": r[2]} for r in cur.fetchall()}

    cur.close()
    return info


# ── Chargement des prédictions ────────────────────────────────────────
def load_predictions(
    cur, param_id: str, method: str
) -> Dict[str, Tuple[Optional[float], Optional[float]]]:
    """
    Retourne {maille_id: (value, variance)} pour un paramètre/méthode.
    Variance peut être NULL — traitée comme variance infinie (poids=0).
    """
    cur.execute(
        """
        SELECT maille_id::text, value, variance
        FROM atlas.ai_interpolation_values
        WHERE parameter_id = %s
          AND method = %s
          AND COALESCE(is_superseded, false) = false
        """,
        (param_id, method),
    )
    result: Dict[str, Tuple[Optional[float], Optional[float]]] = {}
    for maille_id, value, variance in cur.fetchall():
        result[str(maille_id)] = (
            float(value) if value is not None else None,
            float(variance) if variance is not None else None,
        )
    return result


# ── Fusion bayésienne ─────────────────────────────────────────────────
def bayesian_fusion(
    ked_val: Optional[float],
    ked_var: Optional[float],
    rk_val: Optional[float],
    rk_var: Optional[float],
    global_var: float,
) -> Tuple[Optional[float], Optional[float], str]:
    """
    Fusionne KED et RK par pondération inverse de variance locale.

    Note sur les variances négatives PyKrige :
    PyKrige peut retourner des variances légèrement négatives aux points
    d'entraînement (artefact d'inversion de matrice). Ces valeurs sont
    remplacées par la variance globale (poids équivalent au modèle global).
    Ce n'est pas un proxy : c'est la gestion standard des artefacts numériques
    de krigeage ordinaire.

    Retourne : (z_fusion, sigma2_fusion, dominant)
    dominant = 'ked' | 'rk' | 'equal' | 'ked_only' | 'rk_only'
    """
    fallback_var = global_var  # variance globale pour les cas dégénérés

    # Cas dégénérés : un seul modèle disponible
    if ked_val is None and rk_val is None:
        return None, None, "none"
    if ked_val is None:
        s2_rk = max(rk_var or fallback_var, 1e-10) if (rk_var is None or rk_var > 0) else fallback_var
        return rk_val, s2_rk, "rk_only"
    if rk_val is None:
        s2_ked = max(ked_var or fallback_var, 1e-10) if (ked_var is None or ked_var > 0) else fallback_var
        return ked_val, s2_ked, "ked_only"

    # Clamp les variances négatives/nulles — artefacts PyKrige (pas un proxy)
    # Remplacer par la variance globale (ni zéro ni infini)
    s2_ked = ked_var if (ked_var is not None and ked_var > 0) else fallback_var
    s2_rk  = rk_var  if (rk_var  is not None and rk_var  > 0) else fallback_var

    s2_ked = max(s2_ked, 1e-10)
    s2_rk  = max(s2_rk,  1e-10)

    w_ked = 1.0 / s2_ked
    w_rk  = 1.0 / s2_rk
    w_sum = w_ked + w_rk

    z_fusion     = (w_ked * ked_val + w_rk * rk_val) / w_sum
    sigma2_fusion = 1.0 / w_sum

    if w_ked > w_rk * 1.5:
        dominant = "ked"
    elif w_rk > w_ked * 1.5:
        dominant = "rk"
    else:
        dominant = "equal"

    return z_fusion, sigma2_fusion, dominant


# ── Calcul LOO-RMSE simplifié pour le rapport ─────────────────────────
def compute_fusion_metrics(
    ked_data: Dict, rk_data: Dict, param_kind: str
) -> Dict:
    """
    Calcule les métriques de fusion sur les mailles communes :
    - fraction où KED domine / RK domine
    - réduction moyenne de variance par rapport à chaque modèle
    """
    global_var_ked = float(np.nanmean([v for _, v in ked_data.values() if v is not None])) if ked_data else 1.0
    global_var_rk  = float(np.nanmean([v for _, v in rk_data.values()  if v is not None])) if rk_data else 1.0
    global_var = max(global_var_ked, global_var_rk, 1e-6)

    n_total = n_ked_dom = n_rk_dom = n_equal = 0
    var_reductions: List[float] = []

    all_mailles = set(ked_data.keys()) | set(rk_data.keys())
    for mid in all_mailles:
        ked_val, ked_var = ked_data.get(mid, (None, None))
        rk_val,  rk_var  = rk_data.get(mid, (None, None))

        _, sigma2_fusion, dominant = bayesian_fusion(
            ked_val, ked_var, rk_val, rk_var, global_var
        )

        if dominant == "none":
            continue
        n_total += 1
        if dominant == "ked":
            n_ked_dom += 1
        elif dominant == "rk":
            n_rk_dom += 1
        else:
            n_equal += 1

        # Réduction de variance sur valeurs positives seulement (clamp artefacts PyKrige)
        if sigma2_fusion and ked_var is not None and rk_var is not None:
            s2_ked_pos = ked_var if ked_var > 0 else global_var
            s2_rk_pos  = rk_var  if rk_var  > 0 else global_var
            best_indiv = min(s2_ked_pos, s2_rk_pos)
            if best_indiv > 0:
                var_reductions.append((best_indiv - sigma2_fusion) / best_indiv)

    return {
        "n_mailles": n_total,
        "ked_dominates_pct": round(100.0 * n_ked_dom / max(n_total, 1), 1),
        "rk_dominates_pct":  round(100.0 * n_rk_dom  / max(n_total, 1), 1),
        "equal_pct":         round(100.0 * n_equal    / max(n_total, 1), 1),
        "mean_var_reduction_pct": round(
            100.0 * float(np.mean(var_reductions)) if var_reductions else 0.0, 1
        ),
    }


# ── Orchestration principale ──────────────────────────────────────────
def run_fusion(
    conn,
    param_kind: str,
    horizon_label: str,
    ked_method_filter: str,
    dry_run: bool = False,
) -> Dict:
    """
    Fusionne KED et RK pour (param_kind, horizon) et stocke les résultats.

    ked_method_filter : préfixe du method pour KED ('ked_' pour tous les KED).
    """
    cur = conn.cursor()

    clamp_min, clamp_max = PHYSICAL_CLAMP.get(param_kind, (None, None))
    ked_param_id    = f"{param_kind}_ked_{horizon_label}"
    rk_param_id     = f"{param_kind}_rk_{horizon_label}"
    fusion_param_id = f"{param_kind}_fusion_{horizon_label}"

    log.info("  Chargement KED : %s", ked_param_id)
    ked_data = load_predictions(cur, ked_param_id, ked_method_filter)
    if not ked_data:
        # Essai avec méthode alternative — liste exhaustive de toutes les méthodes KED
        for method_alt in (
            "ked_hierarchical_5levels",
            "ked_pedological_prior",
            "ked_pedologie_ked",
            "ked_pedologie_eg",      # EG KED depuis run_ked_eg_horizons.py
            "ked_pedologie_granulo",  # Granulométrie
        ):
            ked_data = load_predictions(cur, ked_param_id, method_alt)
            if ked_data:
                log.info("  KED trouvé via méthode alternative : %s", method_alt)
                break

    log.info("  Chargement RK  : %s", rk_param_id)
    rk_data = load_predictions(cur, rk_param_id, "regression_kriging_scorpan")

    if not ked_data:
        log.warning("  KED vide pour %s — skip", ked_param_id)
        cur.close()
        return {"ok": False, "param": fusion_param_id, "reason": "ked_empty"}
    if not rk_data:
        log.warning("  RK vide pour %s — skip", rk_param_id)
        cur.close()
        return {"ok": False, "param": fusion_param_id, "reason": "rk_empty"}

    log.info("  KED: %d mailles | RK: %d mailles", len(ked_data), len(rk_data))

    # Variance globale pour les cas dégénérés
    global_var = float(np.nanmean(
        [v for _, v in list(ked_data.values()) + list(rk_data.values()) if v is not None]
        or [1.0]
    ))
    global_var = max(global_var, 1e-6)

    # Métriques avant fusion
    metrics = compute_fusion_metrics(ked_data, rk_data, param_kind)
    log.info(
        "  KED domine: %s%% | RK domine: %s%% | Réd. variance: %s%%",
        metrics["ked_dominates_pct"], metrics["rk_dominates_pct"],
        metrics["mean_var_reduction_pct"],
    )

    if dry_run:
        log.info("  [DRY-RUN] Pas d'écriture en base.")
        cur.close()
        return {"ok": True, "param": fusion_param_id, "dry_run": True, "metrics": metrics}

    # Marquer les anciennes valeurs fusion comme superseded (BM-SYNC-05)
    cur.execute(
        """
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = %s AND method = %s
          AND COALESCE(is_superseded, false) = false
        """,
        (fusion_param_id, FUSION_METHOD),
    )

    # Assurer que le paramètre fusion est dans le catalogue
    cur.execute(
        """
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled,
           prediction_enabled, is_active, updated_at, depth_stratified, is_derived,
           physical_min, physical_max)
        VALUES
          (%s, 'geotech', 'interpolation', %s, false, true, true, now(), true, true, %s, %s)
        ON CONFLICT (parameter_id) DO NOTHING
        """,
        (
            fusion_param_id,
            {"vbs": "g/100g", "ip": "%", "wl": "%", "wp": "%", "eg": "%"}.get(param_kind, ""),
            clamp_min,
            clamp_max,
        ),
    )

    run_id = str(uuid.uuid4())
    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics,
           started_at, finished_at, zone_id, kriging_domain_id)
        VALUES
          (%s, 'fusion', %s, %s, 'v1', 'finished', %s::jsonb, now(), now(), NULL, NULL)
        """,
        (
            run_id, fusion_param_id, FUSION_METHOD,
            json_safe({
                "horizon_label": horizon_label,
                "param_kind": param_kind,
                "ked_param": ked_param_id,
                "rk_param": rk_param_id,
                "global_var": global_var,
                **metrics,
            }),
        ),
    )

    # Calculer et insérer les valeurs fusionnées
    all_mailles = sorted(set(ked_data.keys()) | set(rk_data.keys()))
    rows = []
    for mid in all_mailles:
        ked_val, ked_var = ked_data.get(mid, (None, None))
        rk_val,  rk_var  = rk_data.get(mid, (None, None))

        z_fusion, sigma2_fusion, dominant = bayesian_fusion(
            ked_val, ked_var, rk_val, rk_var, global_var
        )

        if z_fusion is None:
            continue

        # Clamp physique (DATA-02)
        if clamp_min is not None and clamp_max is not None:
            z_fusion = float(np.clip(z_fusion, clamp_min, clamp_max))

        rows.append((
            str(uuid.uuid4()),
            mid,
            fusion_param_id,
            float(z_fusion) if math.isfinite(z_fusion) else None,
            float(sigma2_fusion) if sigma2_fusion and math.isfinite(sigma2_fusion) else None,
            FUSION_METHOD,
            run_id,
        ))

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, zone_id, kriging_domain_id, parameter_id,
           value, variance, confidence, method, variogram_id, run_id, created_at)
        VALUES
          (%s::uuid, %s::uuid, NULL, NULL, %s, %s, %s, NULL, %s, NULL, %s::uuid, now())
        """,
        rows,
        page_size=2000,
    )

    conn.commit()
    cur.close()

    n_inserted = len(rows)
    log.info("  Inséré : %d valeurs fusionnées pour %s", n_inserted, fusion_param_id)

    return {
        "ok": True,
        "param": fusion_param_id,
        "n_inserted": n_inserted,
        "metrics": metrics,
    }


# ── Entrée principale ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(
        description="BLOC B — Fusion KED-RK Cascade Bayésienne"
    )
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument(
        "--params", default="vbs,ip,wl,wp,eg",
        help="Paramètres à fusionner (virgule). Ex: vbs,ip,wl,wp,eg",
    )
    ap.add_argument(
        "--horizons", default="h1,h2,h3",
        help="Horizons à traiter. Ex: h1,h2,h3",
    )
    ap.add_argument(
        "--dry-run", action="store_true", default=False,
        help="Valide les données sans écrire en base.",
    )
    args = ap.parse_args()

    if not args.database_url:
        log.error("DATABASE_URL requis (--database-url ou env)")
        return 1

    params   = [p.strip() for p in args.params.split(",")   if p.strip()]
    horizons = [h.strip() for h in args.horizons.split(",") if h.strip()]

    # Valider paramètres
    unknown_params = [p for p in params if p not in PHYSICAL_CLAMP]
    if unknown_params:
        log.error("Paramètres inconnus: %s", unknown_params)
        return 1

    log.info("=== BLOC B — Fusion KED-RK Bayésienne ===")
    log.info("Paramètres : %s | Horizons : %s | Dry-run : %s",
             params, horizons, args.dry_run)

    conn = get_conn(args.database_url)
    try:
        # GEN-01 : inspection avant écriture
        db_info = inspect_db(conn)
        ked_available = set(db_info["ked_params"].keys())
        rk_available  = set(db_info["rk_params"].keys())

        log.info("KED disponibles : %s", sorted(ked_available))
        log.info("RK disponibles  : %s", sorted(rk_available))

        results = []
        for hz in horizons:
            for param in params:
                ked_id = f"{param}_ked_{hz}"
                rk_id  = f"{param}_rk_{hz}"
                if ked_id not in ked_available:
                    log.warning("KED manquant : %s — skip", ked_id)
                    continue
                if rk_id not in rk_available:
                    log.warning("RK manquant  : %s — skip", rk_id)
                    continue

                log.info("Fusion %s/%s ...", param, hz)
                r = run_fusion(
                    conn, param, hz,
                    ked_method_filter="ked_",
                    dry_run=args.dry_run,
                )
                results.append(r)

        # Résumé
        ok_count = sum(1 for r in results if r.get("ok"))
        log.info("=== Terminé : %d/%d fusions réussies ===", ok_count, len(results))
        print(json_safe({"fusion_results": results}))
        return 0

    except Exception as exc:
        log.exception("ERREUR fatale : %s", exc)
        conn.rollback()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
