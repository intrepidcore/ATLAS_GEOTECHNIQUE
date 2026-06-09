#!/usr/bin/env python3
"""
A1 — Validation par blocs spatiaux (Block Spatial Cross-Validation)
====================================================================
Artefact A1 du plan de révision directeur (POINTS_REVISION_PROCHAINE_ITERATION_V2.md §5).

Implémente la validation LOO-par-blocs recommandée par Roberts et al. (2017) pour
corriger l'optimisme du LOO-CV classique en présence de corrélation spatiale.

Principe : 5 blocs longitudinaux N→S (chacun ~120 km de haut). Pour chaque fold :
  - Bloc test     = 1 bande latitudinale
  - Bloc entraîn. = les 4 bandes restantes
  → La distance min test–train ≈ 120 km >> portée variogramme (~80 km pour VBS)
  → Pas de "fuite" d'information spatiale

Usage :
    python scripts/validation_bloc_spatial.py \
        --database-url postgres://atlas:atlas@host.docker.internal:5433/atlas_clean \
        --params vbs,ip,wl,wp,eg,cbr_95,gamma_d,w_opt \
        --horizons h1,h2,h3 \
        --n-blocs 5

Référence :
    Roberts, D.R. et al. (2017). "Cross-validation strategies for data with temporal,
    spatial, hierarchical, or phylogenetic structure." Ecography 40(8), 913-929.
    → LOO classique sous-estime l'erreur réelle de 15-30% quand la portée du variogramme
      est grande par rapport aux distances inter-points (notre cas : portée ~80-220 km,
      distance médiane voisins ~15 km → optimisme estimé 20-30%).
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

try:
    from pykrige.ok import OrdinaryKriging
    HAS_PYKRIGE = True
except ImportError:
    HAS_PYKRIGE = False
    print("[WARN] pykrige non disponible — krigeage désactivé, métriques Ridge uniquement")

DB_DEFAULT = os.environ.get("DATABASE_URL",
                            "postgresql://atlas:atlas@host.docker.internal:5433/atlas_clean")

# ── Configuration des paramètres ────────────────────────────────────────────

PARAM_CONFIG = {
    # param_key : (table, colonne, profondeur H1, H2, H3, clamp_min, clamp_max)
    'vbs':      ('essais_vbs',           'vbs',         [1.0, 1.5, 2.0], 0.0, 15.0),
    'ip':       ('essais_atterberg',      'ip_generated',[1.0, 1.5, 2.0], 0.0, 80.0),
    'wl':       ('essais_atterberg',      'wl',          [1.0, 1.5, 2.0], 20.0, 120.0),
    'wp':       ('essais_atterberg',      'wp',          [1.0, 1.5, 2.0], 10.0, 60.0),
    'eg':       ('essais_potentiel_gonflement', 'cg',   [1.0, 1.5, 2.0], 0.0, 20.0),
    'cbr_95':   ('essais_cbr',           'cbr_pct',     [1.0],          0.0, 150.0),
    'gamma_d':  ('essais_proctor',        'gamma_d_max', [1.0],          1.0, 2.5),
    'w_opt':    ('essais_proctor',        'w_opt',       [1.0],          5.0, 35.0),
    'rd_mpa':   ('essais_penetrometre',   'rd_mpa',      [1.0, 1.5, 2.0], 0.0, 50.0),
}

HORIZON_DEPTH = {'h1': 1.0, 'h2': 1.5, 'h3': 2.0}


def load_param_data(conn, param: str, horizon: str) -> Optional[np.ndarray]:
    """
    Charge (lon, lat, val) pour un paramètre et un horizon donnés.
    Retourne None si N < 10 (validation impossible).
    """
    depth = HORIZON_DEPTH.get(horizon)
    if depth is None:
        return None

    cfg = PARAM_CONFIG.get(param)
    if cfg is None:
        return None

    table, col, _, _, _ = cfg

    cur = conn.cursor()
    if param == 'ip':
        val_expr = "COALESCE(ea.ip_generated, (ea.wl - ea.wp))"
        where_nn  = "COALESCE(ea.ip_generated, (ea.wl - ea.wp)) IS NOT NULL"
        join_sql  = f"JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id"
        select_val = val_expr
    elif param == 'cbr_95':
        # Proctor/CBR : depth_m variable (0.25-0.65m) — utiliser une plage
        join_sql  = "JOIN atlas.essais_cbr ec ON ec.echantillon_id = e.id"
        where_nn  = "ec.cbr_pct IS NOT NULL AND ec.compactage_pct = 95"
        select_val = "ec.cbr_pct"
        depth = None  # pas de filtre depth pour portance
    elif param == 'eg':
        join_sql  = "JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id"
        where_nn  = "epg.cg IS NOT NULL"
        select_val = "epg.cg"
    elif param in ('gamma_d', 'w_opt'):
        col_db = 'gamma_d_max' if param == 'gamma_d' else 'w_opt'
        join_sql  = "JOIN atlas.essais_proctor epr ON epr.echantillon_id = e.id"
        where_nn  = f"epr.{col_db} IS NOT NULL"
        select_val = f"epr.{col_db}"
        depth = None  # pas de filtre depth pour portance (profondeurs 0.25-0.65m)
    elif param == 'rd_mpa':
        join_sql  = "JOIN atlas.essais_penetrometre epe ON epe.echantillon_id = e.id"
        where_nn  = "epe.rd_mpa IS NOT NULL"
        select_val = "epe.rd_mpa"
    else:
        join_sql  = f"JOIN atlas.{table} ess ON ess.echantillon_id = e.id"
        where_nn  = f"ess.{col} IS NOT NULL"
        select_val = f"ess.{col}"

    # Construire la clause depth selon le paramètre
    if depth is not None:
        depth_clause = f"AND e.depth_m = {depth}"
        depth_param = (depth,)
    else:
        depth_clause = ""
        depth_param = ()

    try:
        cur.execute(f"""
        SELECT
            ST_X(ST_Transform(s.geom, 4326))::float8 AS lon,
            ST_Y(ST_Transform(s.geom, 4326))::float8 AS lat,
            AVG({select_val}::float8)                 AS val
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        {join_sql}
        WHERE s.deleted_at IS NULL
          {depth_clause}
          AND {where_nn}
          AND s.geom IS NOT NULL
        GROUP BY s.id, s.geom
        HAVING AVG({select_val}::float8) IS NOT NULL
        """, depth_param)
        rows = cur.fetchall()
    except Exception as ex:
        cur.execute("ROLLBACK")
        conn.rollback()
        print(f"  [WARN] Erreur chargement {param}/{horizon}: {ex}")
        return None

    if len(rows) < 10:
        print(f"  [SKIP] {param}/{horizon}: N={len(rows)} < 10")
        return None

    data = np.array(rows, dtype=np.float64)
    data = data[np.isfinite(data[:, 2])]  # supprimer NaN/Inf
    print(f"  Chargé {param}/{horizon}: N={len(data)}")
    return data


def assign_blocs(lat: np.ndarray, n_blocs: int = 5) -> np.ndarray:
    """
    Assigne chaque point à un bloc latitudinal.
    Togo s'étend de ~6.0°N à ~11.2°N → 5 blocs de ~1.04° chacun.
    """
    lat_min, lat_max = lat.min(), lat.max()
    edges = np.linspace(lat_min, lat_max, n_blocs + 1)
    bloc = np.digitize(lat, edges[:-1]) - 1
    bloc = np.clip(bloc, 0, n_blocs - 1)
    return bloc


def compute_bloc_cv_metrics(
    data: np.ndarray, n_blocs: int = 5, use_kriging: bool = True
) -> Dict:
    """
    Validation par blocs spatiaux.

    Pour chaque bloc test :
      - Entraîner sur les 4 autres blocs
      - Prédire au centroïde du bloc test par krigeage ordinaire
      - Calculer RMSE, MAE, biais

    Retourne les métriques globales ET par bloc.
    """
    lon, lat, val = data[:, 0], data[:, 1], data[:, 2]
    blocs = assign_blocs(lat, n_blocs)
    n = len(val)

    bloc_metrics = []
    all_errors = []
    all_preds  = []
    all_obs    = []

    for bloc_id in range(n_blocs):
        test_mask  = blocs == bloc_id
        train_mask = ~test_mask
        n_test  = test_mask.sum()
        n_train = train_mask.sum()

        if n_test == 0 or n_train < 10:
            print(f"    Bloc {bloc_id}: n_test={n_test}, n_train={n_train} → skip")
            continue

        x_train, y_train, z_train = lon[train_mask], lat[train_mask], val[train_mask]
        x_test,  y_test,  z_test  = lon[test_mask],  lat[test_mask],  val[test_mask]

        preds = np.full(n_test, np.nan)

        if use_kriging and HAS_PYKRIGE and n_train >= 6:
            try:
                ok = OrdinaryKriging(
                    x_train, y_train, z_train,
                    variogram_model='spherical', nlags=10, weight=True,
                    verbose=False, enable_plotting=False,
                    coordinates_type='geographic',
                )
                z_pred, _ = ok.execute('points', x_test, y_test)
                preds = np.asarray(z_pred, dtype=np.float64)
            except Exception as ex:
                print(f"    Bloc {bloc_id}: krigeage échec ({ex}) → moyenne naïve")
                preds = np.full(n_test, z_train.mean())
        else:
            # Fallback : prédiction par la moyenne d'entraînement
            preds = np.full(n_test, z_train.mean())

        valid = np.isfinite(preds) & np.isfinite(z_test)
        if valid.sum() == 0:
            continue

        errors = z_test[valid] - preds[valid]
        rmse_b = float(np.sqrt(np.mean(errors**2)))
        mae_b  = float(np.mean(np.abs(errors)))
        bias_b = float(np.mean(errors))

        lat_ctr = float(lat[test_mask].mean())
        bloc_metrics.append({
            'bloc_id': bloc_id,
            'lat_center': round(lat_ctr, 3),
            'n_test': int(valid.sum()),
            'n_train': int(n_train),
            'rmse': round(rmse_b, 4),
            'mae':  round(mae_b, 4),
            'bias': round(bias_b, 4),
        })
        all_errors.extend(errors[valid].tolist())
        all_preds.extend(preds[valid].tolist())
        all_obs.extend(z_test[valid].tolist())
        print(f"    Bloc {bloc_id} (lat≈{lat_ctr:.2f}°): n_test={valid.sum()}, RMSE={rmse_b:.4f}")

    if not all_errors:
        return {'error': 'No valid bloc found', 'bloc_metrics': []}

    errors_arr = np.array(all_errors)
    global_rmse = float(np.sqrt(np.mean(errors_arr**2)))
    global_mae  = float(np.mean(np.abs(errors_arr)))
    global_bias = float(np.mean(errors_arr))

    return {
        'global_rmse': round(global_rmse, 4),
        'global_mae':  round(global_mae, 4),
        'global_bias': round(global_bias, 4),
        'n_total': len(all_errors),
        'n_blocs': n_blocs,
        'bloc_metrics': bloc_metrics,
    }


def store_results(conn, param: str, horizon: str, metrics: Dict) -> None:
    """Stocke les résultats dans atlas.ai_spatial_validation_runs."""
    cur = conn.cursor()
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    parameter_id = f"{param}_ked_{horizon}"

    cur.execute("""
    INSERT INTO atlas.ai_spatial_validation_runs
      (id, validation_type, parameter_id, train_zone_code, test_zone_code, metrics, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    ON CONFLICT DO NOTHING
    """, (
        run_id,
        'block_spatial_cv_5blocs',
        parameter_id,
        'TOGO_4blocs',
        'TOGO_1bloc_test',
        psycopg2.extras.Json(metrics),
        now,
    ))
    conn.commit()
    print(f"  ✅ Stocké: {parameter_id} | RMSE_bloc={metrics.get('global_rmse')}")


def main():
    ap = argparse.ArgumentParser(description="A1 — Validation par blocs spatiaux")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--params", default="vbs,ip,wl,wp,eg",
                    help="Paramètres séparés par virgule")
    ap.add_argument("--horizons", default="h1,h2,h3",
                    help="Horizons séparés par virgule")
    ap.add_argument("--n-blocs", type=int, default=5)
    ap.add_argument("--no-kriging", action="store_true",
                    help="Prédire par moyenne seule (plus rapide, moins précis)")
    args = ap.parse_args()

    params   = [p.strip() for p in args.params.split(',') if p.strip()]
    horizons = [h.strip() for h in args.horizons.split(',') if h.strip()]
    use_krig = not args.no_kriging

    conn = psycopg2.connect(args.database_url)
    results_summary = []

    for param in params:
        for horizon in horizons:
            print(f"\n{'─'*60}")
            print(f"Validation bloc-spatial : {param.upper()} {horizon.upper()}")

            data = load_param_data(conn, param, horizon)
            if data is None:
                continue

            metrics = compute_bloc_cv_metrics(data, n_blocs=args.n_blocs,
                                              use_kriging=use_krig)
            if 'error' not in metrics:
                store_results(conn, param, horizon, metrics)
                results_summary.append({
                    'param': param, 'horizon': horizon,
                    'bloc_rmse': metrics['global_rmse'],
                    'n_total': metrics['n_total'],
                })

    conn.close()

    print(f"\n{'═'*60}")
    print("RÉSUMÉ VALIDATION PAR BLOCS SPATIAUX")
    print(f"{'═'*60}")
    print(f"{'Param':<12} {'Hz':<6} {'N':<8} {'RMSE_bloc':<12}")
    print(f"{'─'*40}")
    for r in results_summary:
        print(f"{r['param']:<12} {r['horizon']:<6} {r['n_total']:<8} {r['bloc_rmse']:<12.4f}")

    print(json.dumps({'results': results_summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
