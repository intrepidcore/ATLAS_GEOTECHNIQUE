#!/usr/bin/env python3
"""
A2 — Validation PICP (Prediction Interval Coverage Probability)
================================================================
Artefact A2 du plan de révision directeur (POINTS_REVISION_PROCHAINE_ITERATION_V2.md §4.2).

Le PICP mesure la proportion des observations réelles qui tombent dans l'intervalle
de prédiction prévu. Pour un intervalle à 95%, un PICP idéal = 0.95.

Motivation :
  Le directeur a relevé que l'asymétrie de VBS (skewness=2.41) rend les intervalles
  normaux [pred ± 1.96σ] non-fiables (PICP ≈ 0.87 au lieu de 0.95).
  Ce script calcule le PICP pour tous les paramètres/horizons et compare
  avant/après log-transformation pour VBS et CBR.

Méthode :
  1. Pour chaque paramètre/horizon, charger les N sondages
  2. LOO-CV : pour chaque sondage i, prédire avec les N-1 autres (krigeage ordinaire)
  3. Calculer l'intervalle [pred_i ± z_{α/2} × σ_pred_i]
  4. PICP = proportion des i où obs_i ∈ intervalle_i

Usage :
    python scripts/validation_picp.py \
        --database-url postgres://atlas:atlas@host.docker.internal:5433/atlas_clean \
        --params vbs,ip,wl,wp,eg,cbr_95 \
        --horizons h1,h2,h3

Référence :
    Gneiting, T. & Raftery, A.E. (2007). "Strictly Proper Scoring Rules,
    Prediction, and Estimation." JASA 102(477), 359-378.
"""

from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_values
from scipy import stats

try:
    from pykrige.ok import OrdinaryKriging
    HAS_PYKRIGE = True
except ImportError:
    HAS_PYKRIGE = False
    print("[WARN] pykrige non disponible")

DB_DEFAULT = os.environ.get("DATABASE_URL",
                            "postgresql://atlas:atlas@host.docker.internal:5433/atlas_clean")

HORIZON_DEPTH = {'h1': 1.0, 'h2': 1.5, 'h3': 2.0}

# Paramètres nécessitant une log-transformation (asymétrie élevée)
LOG_TRANSFORM_PARAMS = {'vbs', 'cbr_95', 'eg'}


def load_param_data(conn, param: str, horizon: str) -> Optional[np.ndarray]:
    """Charge (lon, lat, val) depuis la DB."""
    depth = HORIZON_DEPTH.get(horizon)
    if depth is None:
        return None

    cur = conn.cursor()

    if param == 'vbs':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8,
               ev.vbs::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_vbs ev ON ev.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s AND ev.vbs IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'ip':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8,
               COALESCE(ea.ip_generated,(ea.wl-ea.wp))::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s
          AND COALESCE(ea.ip_generated,(ea.wl-ea.wp)) IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'wl':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8, ea.wl::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s AND ea.wl IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'wp':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8, ea.wp::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s AND ea.wp IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'eg':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8, epg.cg::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s AND epg.cg IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'cbr_95':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8, ec.cbr_pct::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_cbr ec ON ec.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s
          AND ec.cbr_pct IS NOT NULL AND ec.compactage_pct=95 AND s.geom IS NOT NULL
        """
    elif param == 'gamma_d':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8, epr.gamma_d_max::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_proctor epr ON epr.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s
          AND epr.gamma_d_max IS NOT NULL AND s.geom IS NOT NULL
        """
    elif param == 'w_opt':
        sql = """
        SELECT ST_X(ST_Transform(s.geom,4326))::float8,
               ST_Y(ST_Transform(s.geom,4326))::float8, epr.w_opt::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id
        JOIN atlas.essais_proctor epr ON epr.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND e.depth_m=%s
          AND epr.w_opt IS NOT NULL AND s.geom IS NOT NULL
        """
    else:
        return None

    try:
        cur.execute(sql, (depth,))
        rows = cur.fetchall()
    except Exception as ex:
        conn.rollback()
        print(f"  [WARN] Erreur chargement {param}/{horizon}: {ex}")
        return None

    if len(rows) < 10:
        return None

    data = np.array(rows, dtype=np.float64)
    data = data[np.isfinite(data[:, 2])]
    return data


def compute_picp_loo(
    data: np.ndarray,
    alpha: float = 0.05,
    log_transform: bool = False,
) -> Dict:
    """
    Calcule le PICP via LOO-CV (Leave-One-Out Cross-Validation).

    Pour chaque sondage i :
      1. Entraîner krigeage ordinaire sur les N-1 autres
      2. Prédire mu_i et sigma²_i au point i
      3. Vérifier si obs_i ∈ [mu_i - z*sigma_i, mu_i + z*sigma_i]

    Retourne : dict avec PICP pour différents niveaux de confiance

    Note : si log_transform=True, la transformation log(x+1) est appliquée
    avant krigeage et les intervalles sont back-transformés.
    """
    if not HAS_PYKRIGE:
        return {'error': 'pykrige non disponible'}

    lon, lat, val = data[:, 0], data[:, 1], data[:, 2]
    n = len(val)

    # Log-transformation
    if log_transform:
        val_krig = np.log1p(val)
    else:
        val_krig = val.copy()

    # Niveaux de confiance à tester
    alphas = [0.10, 0.05, 0.01]  # 90%, 95%, 99%
    z_scores = {a: float(stats.norm.ppf(1 - a / 2)) for a in alphas}

    # LOO-CV : prédictions et variances
    preds_mu    = np.full(n, np.nan)
    preds_sigma = np.full(n, np.nan)

    for i in range(n):
        mask = np.ones(n, dtype=bool)
        mask[i] = False
        x_tr = lon[mask]; y_tr = lat[mask]; z_tr = val_krig[mask]
        x_te = lon[i];    y_te = lat[i]

        try:
            ok = OrdinaryKriging(
                x_tr, y_tr, z_tr,
                variogram_model='spherical', nlags=10, weight=True,
                verbose=False, enable_plotting=False,
                coordinates_type='geographic',
            )
            z_pred, ss_pred = ok.execute('points',
                                         np.array([x_te]), np.array([y_te]))
            preds_mu[i]    = float(z_pred[0])
            preds_sigma[i] = float(np.sqrt(max(ss_pred[0], 1e-12)))
        except Exception:
            continue

    # Calculer PICP pour chaque niveau de confiance
    valid = np.isfinite(preds_mu) & np.isfinite(preds_sigma)
    n_valid = valid.sum()

    if n_valid < 5:
        return {'error': f'Trop peu de prédictions valides: {n_valid}'}

    picp_results = {}
    obs = val[valid]        # observations originales (non transformées)
    mu  = preds_mu[valid]   # prédictions (dans l'espace transformé si log)
    sig = preds_sigma[valid]

    for a in alphas:
        z = z_scores[a]
        lower = mu - z * sig
        upper = mu + z * sig

        if log_transform:
            # Back-transform : exp(x) - 1
            lower_bt = np.expm1(lower)
            upper_bt = np.expm1(upper)
        else:
            lower_bt = lower
            upper_bt = upper

        covered = np.mean((obs >= lower_bt) & (obs <= upper_bt))
        level = int((1 - a) * 100)
        picp_results[f'picp_{level}'] = round(float(covered), 4)
        picp_results[f'n_covered_{level}'] = int(np.sum((obs >= lower_bt) & (obs <= upper_bt)))

    # Métriques supplémentaires
    errors = obs - np.expm1(mu) if log_transform else obs - mu
    rmse = float(np.sqrt(np.mean(errors**2)))
    bias = float(np.mean(errors))
    skewness = float(stats.skew(obs))

    return {
        'n_valid': int(n_valid),
        'n_total': int(n),
        'rmse_loo': round(rmse, 4),
        'bias_loo': round(bias, 4),
        'skewness': round(skewness, 4),
        'log_transform': log_transform,
        **picp_results,
    }


def store_picp_result(conn, param: str, horizon: str,
                      metrics: Dict, log_transform: bool) -> None:
    """Stocke le résultat PICP dans ai_spatial_validation_runs."""
    cur = conn.cursor()
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    vtype = f'picp_loo{"_log" if log_transform else ""}'

    cur.execute("""
    INSERT INTO atlas.ai_spatial_validation_runs
      (id, validation_type, parameter_id, train_zone_code, test_zone_code, metrics, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        run_id, vtype,
        f"{param}_ked_{horizon}",
        'LOO_train', 'LOO_test',
        psycopg2.extras.Json(metrics),
        now,
    ))
    conn.commit()


def main():
    ap = argparse.ArgumentParser(description="A2 — Validation PICP LOO-CV")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--params", default="vbs,ip,wl,wp,eg,cbr_95")
    ap.add_argument("--horizons", default="h1")
    ap.add_argument("--no-log-transform", action="store_true",
                    help="Désactiver la log-transformation pour VBS/CBR")
    args = ap.parse_args()

    params   = [p.strip() for p in args.params.split(',') if p.strip()]
    horizons = [h.strip() for h in args.horizons.split(',') if h.strip()]

    conn = psycopg2.connect(args.database_url)
    summary = []

    for param in params:
        for horizon in horizons:
            print(f"\n{'─'*55}")
            print(f"PICP LOO-CV : {param.upper()} {horizon.upper()}")

            data = load_param_data(conn, param, horizon)
            if data is None:
                print("  [SKIP] Données insuffisantes")
                continue

            # Version sans transformation
            print(f"  Calcul PICP (sans log-transform)...")
            m_raw = compute_picp_loo(data, log_transform=False)
            if 'error' not in m_raw:
                store_picp_result(conn, param, horizon, m_raw, log_transform=False)
                print(f"  PICP_95%={m_raw.get('picp_95','N/A')} | "
                      f"PICP_90%={m_raw.get('picp_90','N/A')} | "
                      f"RMSE_LOO={m_raw.get('rmse_loo','N/A')}")

            # Version avec log-transformation (pour param asymétriques)
            if not args.no_log_transform and param in LOG_TRANSFORM_PARAMS:
                print(f"  Calcul PICP (avec log-transform)...")
                m_log = compute_picp_loo(data, log_transform=True)
                if 'error' not in m_log:
                    store_picp_result(conn, param, horizon, m_log, log_transform=True)
                    print(f"  PICP_95%(log)={m_log.get('picp_95','N/A')} | "
                          f"RMSE_LOO(log)={m_log.get('rmse_loo','N/A')}")
                else:
                    m_log = {}
            else:
                m_log = {}

            summary.append({
                'param': param,
                'horizon': horizon,
                'picp_95_raw': m_raw.get('picp_95'),
                'picp_95_log': m_log.get('picp_95'),
                'rmse_loo': m_raw.get('rmse_loo'),
                'skewness': m_raw.get('skewness'),
                'n': m_raw.get('n_total'),
            })

    conn.close()

    print(f"\n{'═'*65}")
    print("RÉSUMÉ PICP (PREDICTION INTERVAL COVERAGE PROBABILITY)")
    print(f"{'═'*65}")
    print(f"{'Param':<12} {'Hz':<6} {'N':<8} {'Skew':<8} {'PICP95':<10} {'PICP95_log':<12} {'RMSE_LOO':<10}")
    print(f"{'─'*65}")
    for r in summary:
        picp = r['picp_95_raw'] or '-'
        picplog = r['picp_95_log'] or '-'
        print(f"{r['param']:<12} {r['horizon']:<6} {str(r['n']):<8} "
              f"{str(r['skewness']):<8} {str(picp):<10} {str(picplog):<12} {str(r['rmse_loo']):<10}")

    print(json.dumps({'picp_summary': summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
