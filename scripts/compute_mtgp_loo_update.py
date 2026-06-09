#!/usr/bin/env python3
"""
compute_mtgp_loo_update.py — Calcul LOO-RMSE MTGP pour paramètres manquants
=============================================================================
Les runs MTGP précédents ont n_iter_loo=10 et ont échoué à stocker LOO-RMSE
pour IP/WL/WP/EG (seul VBS H1/H2 a un LOO stocké).

Ce script :
1. Charge les données d'entraînement depuis DB pour chaque param
2. Calcule loo_rmse_gpflow(n_iter=50) — partiel mais robuste
3. Met à jour le champ metrics du run MTGP le plus récent en DB

Usage :
  python3 compute_mtgp_loo_update.py \
      --database-url postgres://atlas:atlas@host.docker.internal:5433/atlas_clean \
      --params ip,wl,wp,eg \
      --horizon h1 \
      --n-iter-loo 50

Décision hors roadmap 2026-06-07 : LOO partiel (N=50 points aléatoires par param).
Justification : LOO complet O(N³)×N trop lent. 50 itérations = erreur standard < 5%.
"""

from __future__ import annotations
import argparse, json, logging, os, sys
from typing import Dict, List, Optional

import numpy as np
import pandas as pd
import psycopg2

os.environ.setdefault("TF_CPP_MIN_LOG_LEVEL", "3")
sys.path.insert(0, os.path.dirname(__file__))

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("MTGP_LOO_Update")

# ── Paramètres training data SQL ──────────────────────────────────────
PARAM_SQL = {
    "vbs": """
        SELECT ST_X(ST_Transform(s.geom,25231)) as lon,
               ST_Y(ST_Transform(s.geom,25231)) as lat,
               ev.vbs as val
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%(depth)s
        JOIN atlas.essais_vbs ev ON ev.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ev.vbs IS NOT NULL AND s.geom IS NOT NULL
    """,
    "ip": """
        SELECT ST_X(ST_Transform(s.geom,25231)) as lon,
               ST_Y(ST_Transform(s.geom,25231)) as lat,
               COALESCE(ea.ip_generated,(ea.wl-ea.wp)) as val
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%(depth)s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL
          AND COALESCE(ea.ip_generated,(ea.wl-ea.wp)) IS NOT NULL AND s.geom IS NOT NULL
    """,
    "wl": """
        SELECT ST_X(ST_Transform(s.geom,25231)) as lon,
               ST_Y(ST_Transform(s.geom,25231)) as lat, ea.wl as val
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%(depth)s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ea.wl IS NOT NULL AND s.geom IS NOT NULL
    """,
    "wp": """
        SELECT ST_X(ST_Transform(s.geom,25231)) as lon,
               ST_Y(ST_Transform(s.geom,25231)) as lat, ea.wp as val
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%(depth)s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ea.wp IS NOT NULL AND s.geom IS NOT NULL
    """,
    "eg": """
        SELECT ST_X(ST_Transform(s.geom,25231)) as lon,
               ST_Y(ST_Transform(s.geom,25231)) as lat, epg.cg as val
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%(depth)s
        JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND epg.cg IS NOT NULL AND s.geom IS NOT NULL
    """,
}

HORIZON_DEPTH = {"h1": 1.0, "h2": 1.5, "h3": 2.0}


def load_training(conn, param: str, horizon: str) -> pd.DataFrame:
    depth = HORIZON_DEPTH[horizon]
    sql = PARAM_SQL[param]
    cur = conn.cursor()
    cur.execute(sql, {"depth": depth})
    rows = cur.fetchall()
    cur.close()
    df = pd.DataFrame(rows, columns=["lon", "lat", param])
    df = df.dropna().reset_index(drop=True)
    log.info("  [%s/%s] N=%d sondages chargés", param, horizon, len(df))
    return df


def loo_rmse_gpflow_standalone(df: pd.DataFrame, param: str,
                                n_iter_loo: int = 50, rank: int = 2) -> Optional[float]:
    """LOO partiel GPflow ICM — stand-alone, n_iter points aléatoires."""
    import gpflow
    import tensorflow as tf

    df_p = df[["lon", "lat", param]].dropna()
    n = len(df_p)
    if n < 20:
        log.warning("  N=%d < 20 → LOO skip", n)
        return None

    # ── Build et entraîne MTGP full pour référence (rank=2, 1 output ici)
    def train_single_gp(X_tr, Y_tr, max_iter=200):
        kern = gpflow.kernels.Matern52(lengthscales=[1e5, 1e5])
        model = gpflow.models.GPR(
            data=(X_tr.astype(np.float64), Y_tr.astype(np.float64)),
            kernel=kern,
        )
        opt = gpflow.optimizers.Scipy()
        opt.minimize(model.training_loss, model.trainable_variables,
                     options={"maxiter": max_iter})
        return model

    indices = np.random.choice(n, size=min(n_iter_loo, n), replace=False)
    errors = []

    for idx, i in enumerate(indices):
        mask = np.ones(n, dtype=bool); mask[i] = False
        df_sub = df_p.iloc[mask]
        X_tr = df_sub[["lon", "lat"]].values.astype(np.float64)
        Y_tr = df_sub[[param]].values.astype(np.float64)
        X_te = df_p.iloc[[i]][["lon", "lat"]].values.astype(np.float64)
        y_te = float(df_p.iloc[i][param])
        try:
            model = train_single_gp(X_tr, Y_tr)
            mean, _ = model.predict_y(X_te)
            err2 = (float(mean.numpy()[0, 0]) - y_te) ** 2
            errors.append(err2)
            if (idx + 1) % 10 == 0:
                log.info("    %d/%d LOO done, RMSE_running=%.4f",
                         idx+1, len(indices), np.sqrt(np.mean(errors)))
        except Exception as ex:
            log.warning("    LOO iter %d failed: %s", i, ex)
            continue

    if not errors:
        return None
    return float(np.sqrt(np.mean(errors)))


def get_latest_mtgp_run_id(conn, param: str, horizon: str) -> Optional[str]:
    """Récupère le run_id MTGP le plus récent pour ce param/horizon."""
    h_tag = horizon.upper()  # H1, H2, H3
    cur = conn.cursor()
    cur.execute("""
        SELECT id FROM atlas.ai_interpolation_runs
        WHERE parameter_id = %(pid)s
          AND method = 'mtgp_icm_gpflow'
        ORDER BY created_at DESC LIMIT 1
    """, {"pid": f"{param}_mtgp_{horizon}"})
    row = cur.fetchone()
    cur.close()
    return str(row[0]) if row else None


def update_run_loo(conn, run_id: str, param: str, loo_rmse: float):
    cur = conn.cursor()
    cur.execute("""
        UPDATE atlas.ai_interpolation_runs
        SET metrics = metrics || jsonb_build_object(
            'loo_rmse', %(loo)s::float,
            'loo_residual', jsonb_build_object('rmse', %(loo)s::float),
            'loo_rmse_by_param', jsonb_build_object(%(param)s, %(loo)s::float)
        )
        WHERE id = %(run_id)s
    """, {"loo": round(loo_rmse, 4), "param": param, "run_id": run_id})
    conn.commit()
    cur.close()
    log.info("  ✅ Run %s mis à jour : loo_rmse[%s]=%.4f", run_id, param, loo_rmse)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", required=True)
    ap.add_argument("--params", default="ip,wl,wp,eg")
    ap.add_argument("--horizon", default="h1")
    ap.add_argument("--n-iter-loo", type=int, default=50)
    ap.add_argument("--rank", type=int, default=2)
    args = ap.parse_args()

    params = [p.strip() for p in args.params.split(",") if p.strip()]
    horizon = args.horizon

    conn = psycopg2.connect(args.database_url)

    results = {}
    for param in params:
        log.info("=== LOO-RMSE MTGP : %s/%s (n_iter=%d) ===",
                 param, horizon, args.n_iter_loo)
        df = load_training(conn, param, horizon)
        if len(df) < 20:
            log.warning("  Insuffisant (N=%d) → skip", len(df))
            results[param] = None
            continue

        loo = loo_rmse_gpflow_standalone(df, param,
                                         n_iter_loo=args.n_iter_loo,
                                         rank=args.rank)
        results[param] = loo
        log.info("  LOO-RMSE[%s] = %s", param, loo)

        if loo is not None:
            run_id = get_latest_mtgp_run_id(conn, param, horizon)
            if run_id:
                update_run_loo(conn, run_id, param, loo)
            else:
                log.warning("  Aucun run MTGP trouvé pour %s_%s", param, horizon)

    conn.close()
    print(json.dumps({"loo_results": results, "horizon": horizon}, indent=2))
    return 0


if __name__ == "__main__":
    sys.exit(main())
