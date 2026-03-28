#!/usr/bin/env python3
"""
Pipeline complet Atlas : QA → variogrammes → kriging ordinaire → CV (LOO, blocs, leave-zone-out)
→ ML (CatBoost) → regression kriging → persistance PostgreSQL.

Usage (depuis la racine atlas_reclone, avec deps installées) :
  pip install -r scripts/requirements-atlas-ml.txt
  export DATABASE_URL=postgres://user:pass@host:5432/db   # PowerShell: $env:DATABASE_URL='...'
  python scripts/atlas_geostat_ml_pipeline.py --zone DEPRESSION_LAMA_TG --parameter vbs_avg
  python scripts/atlas_geostat_ml_pipeline.py --kriging-only --all-kriging-jobs
  python scripts/atlas_geostat_ml_pipeline.py --kriging-domain-id '<uuid>' --parameter ip_avg --verbose
  python scripts/atlas_geostat_ml_pipeline.py --kriging-only --all-domain-kriging-jobs --domain-job-limit 20

GPU : CatBoost utilise task_type='GPU' si disponible (sinon CPU). --kriging-only évite CatBoost.
"""
from __future__ import annotations

import argparse
import json
import math
import os
import sys
import uuid
from dataclasses import dataclass
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_batch

try:
    from pykrige.ok import OrdinaryKriging
except ImportError as e:
    print("PyKrige requis: pip install PyKrige", file=sys.stderr)
    raise

try:
    import gstools as gs
except ImportError:
    gs = None  # type: ignore

try:
    from catboost import CatBoostRegressor
except ImportError:
    CatBoostRegressor = None  # type: ignore

from sklearn.cluster import KMeans
from sklearn.metrics import mean_absolute_error, mean_squared_error

VERBOSE = False


def vlog(msg: str) -> None:
    if VERBOSE:
        print(msg, file=sys.stderr)

PARAM_TO_STATS_COL = {
    "vbs_avg": "vbs_avg",
    "ip_avg": "ip_avg",
    "eg_avg": "eg_avg",
    "passant_80um_avg": "passant_80um_avg",
    "gamma_d_max_avg": "gamma_d_max_avg",
    "wl_avg": "wl_avg",
    "wp_avg": "wp_avg",
    "passant_2mm_avg": "passant_2mm_avg",
    "passant_20mm_avg": "passant_20mm_avg",
}

# Colonne stats pour l'entraînement vs id catalogue de sortie (interpolation « métier »)
KRIGING_OUTPUT_TO_STATS_COL = {
    "kriging_vbs": "vbs_avg",
    "kriging_ip": "ip_avg",
}


def resolve_kriging_columns(parameter_id: str) -> Tuple[Optional[str], str]:
    """Retourne (colonne mailles_geotechnique_stats_wgs84, parameter_id à persister en base)."""
    if parameter_id in PARAM_TO_STATS_COL:
        return PARAM_TO_STATS_COL[parameter_id], parameter_id
    if parameter_id in KRIGING_OUTPUT_TO_STATS_COL:
        return KRIGING_OUTPUT_TO_STATS_COL[parameter_id], parameter_id
    return None, parameter_id


def loo_is_scientifically_usable(loo: Dict[str, Any], n_train: int) -> Tuple[bool, str]:
    """LOO PyKrige : exige assez de points et RMSE fini."""
    if n_train < 6:
        return False, "n_train_lt_6"
    rmse = loo.get("rmse")
    if rmse is None:
        return False, "rmse_missing"
    try:
        rf = float(rmse)
    except (TypeError, ValueError):
        return False, "rmse_not_numeric"
    if not math.isfinite(rf):
        return False, "rmse_non_finite"
    return True, "ok"


def list_kriging_jobs(cur) -> List[Tuple[str, str]]:
    """Couples (zone_code, parameter_id) depuis la vue plan (zones publiées)."""
    cur.execute(
        """
        SELECT zone_code, parameter_id
        FROM atlas.v_ai_kriging_zone_plan
        ORDER BY zone_code, parameter_id
        """
    )
    return [(str(a), str(b)) for a, b in cur.fetchall()]


def list_kriging_domain_jobs(cur, limit: int = 0) -> List[Tuple[str, str]]:
    """Couples (kriging_domain_id, parameter_id) pour krigeage stratifié (migration 157+)."""
    lim = f"LIMIT {int(limit)}" if limit and limit > 0 else ""
    cur.execute(
        f"""
        SELECT kriging_domain_id::text, parameter_id
        FROM atlas.v_ai_kriging_domain_plan
        ORDER BY domain_type, domain_code, parameter_id
        {lim}
        """
    )
    return [(str(a), str(b)) for a, b in cur.fetchall()]


def _require_env_db(url: str) -> None:
    if not url:
        sys.exit("DATABASE_URL ou --database-url requis")


def _connect(db_url: str):
    return psycopg2.connect(db_url)


@dataclass
class ZoneInfo:
    zone_id: str
    code: str


@dataclass
class KrigingDomainInfo:
    domain_id: str
    domain_type: str
    domain_code: str


def fetch_kriging_domain(cur, domain_id: str) -> Optional[KrigingDomainInfo]:
    cur.execute(
        """
        SELECT id::text, domain_type, domain_code
        FROM atlas.kriging_domains
        WHERE id = %s::uuid AND is_active = TRUE
        LIMIT 1
        """,
        (domain_id,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return KrigingDomainInfo(domain_id=row[0], domain_type=row[1], domain_code=row[2])


def fetch_zone(cur, code: str) -> Optional[ZoneInfo]:
    cur.execute(
        "SELECT id::text, code FROM atlas.zones_etude WHERE code = %s AND is_published = TRUE LIMIT 1",
        (code,),
    )
    row = cur.fetchone()
    if not row:
        return None
    return ZoneInfo(zone_id=row[0], code=row[1])


def load_training_points(
    cur, zone_code: str, param: str, stats_col: str
) -> Tuple[np.ndarray, np.ndarray, List[str], np.ndarray]:
    """Centroïdes mailles (WGS84) + valeur agrégée maille dans la zone."""
    cur.execute(
        f"""
        SELECT
          m.id::text,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
          s.{stats_col}::float8 AS val
        FROM atlas.mailles m
        JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
        JOIN atlas.zones_etude z ON z.id = mze.zone_id
        JOIN mailles_geotechnique_stats_wgs84 s ON s.code = m.code
        WHERE z.code = %s
          AND s.{stats_col} IS NOT NULL
        """,
        (zone_code,),
    )
    rows = cur.fetchall()
    mids, xs, ys, vs = [], [], [], []
    for mid, lon, lat, v in rows:
        if v is None or not (math.isfinite(lon) and math.isfinite(lat) and math.isfinite(float(v))):
            continue
        mids.append(mid)
        xs.append(lon)
        ys.append(lat)
        vs.append(float(v))
    return np.array(xs), np.array(ys), mids, np.array(vs)


def load_grid_mailles(cur, zone_code: str) -> List[Tuple[str, float, float]]:
    cur.execute(
        """
        SELECT
          m.id::text,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8
        FROM atlas.mailles m
        JOIN atlas.mailles_zones_etude mze ON mze.maille_id = m.id
        JOIN atlas.zones_etude z ON z.id = mze.zone_id
        WHERE z.code = %s
        """,
        (zone_code,),
    )
    return [(r[0], float(r[1]), float(r[2])) for r in cur.fetchall()]


def load_training_points_domain(
    cur, domain_id: str, stats_col: str
) -> Tuple[np.ndarray, np.ndarray, List[str], np.ndarray]:
    """Mailles dont le centroïde est dans le domaine (unité géo/pédo/risque) + stats."""
    cur.execute(
        f"""
        SELECT
          m.id::text,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
          s.{stats_col}::float8 AS val
        FROM atlas.mailles m
        JOIN atlas.kriging_domains d ON d.id = %s::uuid
        JOIN mailles_geotechnique_stats_wgs84 s ON s.code = m.code
        WHERE ST_Contains(d.geom, ST_PointOnSurface(m.geom))
          AND s.{stats_col} IS NOT NULL
        """,
        (domain_id,),
    )
    rows = cur.fetchall()
    mids, xs, ys, vs = [], [], [], []
    for mid, lon, lat, v in rows:
        if v is None or not (math.isfinite(lon) and math.isfinite(lat) and math.isfinite(float(v))):
            continue
        mids.append(mid)
        xs.append(lon)
        ys.append(lat)
        vs.append(float(v))
    return np.array(xs), np.array(ys), mids, np.array(vs)


def load_grid_mailles_domain(cur, domain_id: str) -> List[Tuple[str, float, float]]:
    cur.execute(
        """
        SELECT
          m.id::text,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8
        FROM atlas.mailles m
        JOIN atlas.kriging_domains d ON d.id = %s::uuid
        WHERE ST_Contains(d.geom, ST_PointOnSurface(m.geom))
        """,
        (domain_id,),
    )
    return [(r[0], float(r[1]), float(r[2])) for r in cur.fetchall()]


def fit_gstools_variogram(
    x: np.ndarray, y: np.ndarray, values: np.ndarray
) -> Tuple[str, Dict[str, float]]:
    """Retourne modèle PyKrige + paramètres pour variogramme empirique."""
    if gs is None or len(values) < 8:
        return "spherical", {}
    pos = np.array([x, y])
    span = max(float(np.ptp(x)), float(np.ptp(y)), 1e-4)
    bin_edges = gs.standard_bins(pos, max_dist=span * 0.45, latlon=True)
    bin_c, emp = gs.vario_estimate(pos, values, bin_edges, latlon=True)
    model = gs.Spherical(dim=2, latlon=True)
    try:
        model.fit_variogram(bin_c, emp, nugget=True)
        return "spherical", {
            "range": float(model.len_scale),
            "sill": float(model.var + model.nugget) if hasattr(model, "nugget") else float(model.var),
            "nugget": float(getattr(model, "nugget", 0) or 0),
        }
    except Exception:
        return "spherical", {}


def ordinary_kriging_grid(
    x: np.ndarray,
    y: np.ndarray,
    values: np.ndarray,
    grid_x: np.ndarray,
    grid_y: np.ndarray,
    variogram_model: str = "spherical",
) -> Tuple[np.ndarray, np.ndarray]:
    ok = OrdinaryKriging(
        x,
        y,
        values,
        variogram_model=variogram_model,
        verbose=False,
        enable_plotting=False,
        coordinates_type="geographic",
    )
    z, ss = ok.execute("points", grid_x, grid_y)
    z = np.asarray(z, dtype=np.float64).ravel()
    ss = np.asarray(ss, dtype=np.float64).ravel()
    return z, ss


def ordinary_kriging_with_fallback(
    x: np.ndarray,
    y: np.ndarray,
    values: np.ndarray,
    grid_x: np.ndarray,
    grid_y: np.ndarray,
    preferred_models: Optional[Sequence[str]] = None,
) -> Tuple[np.ndarray, np.ndarray, str, Optional[str]]:
    """Essaie plusieurs variogrammes PyKrige ; retourne (z, ss, modèle_ok, erreur)."""
    models = list(preferred_models or ("spherical", "exponential", "gaussian", "linear"))
    last_err: Optional[str] = None
    for m in models:
        try:
            z, ss = ordinary_kriging_grid(x, y, values, grid_x, grid_y, variogram_model=m)
            if np.all(~np.isfinite(z)):
                raise ValueError("prédictions non finies")
            return z, ss, m, None
        except Exception as e:
            last_err = str(e)
            continue
    return (
        np.full(grid_x.shape[0], np.nan),
        np.full(grid_x.shape[0], np.nan),
        models[0] if models else "spherical",
        last_err or "kriging_failed",
    )


def cross_validate_loo(
    x, y, values, models: Sequence[str] = ("spherical", "exponential", "gaussian")
) -> Dict[str, Any]:
    n = len(values)
    if n < 5:
        return {"rmse": float("nan"), "mae": float("nan"), "bias": float("nan"), "n": float(n)}
    for model in models:
        preds: List[float] = []
        try:
            for i in range(n):
                mask = np.ones(n, dtype=bool)
                mask[i] = False
                ok = OrdinaryKriging(
                    x[mask],
                    y[mask],
                    values[mask],
                    variogram_model=model,
                    verbose=False,
                    enable_plotting=False,
                    coordinates_type="geographic",
                )
                z, _ = ok.execute("points", np.array([x[i]]), np.array([y[i]]))
                preds.append(float(z[0]))
            p = np.array(preds)
            rmse = float(np.sqrt(mean_squared_error(values, p)))
            mae = float(mean_absolute_error(values, p))
            bias = float(np.mean(p - values))
            return {"rmse": rmse, "mae": mae, "bias": bias, "n": float(n), "variogram_model": model}
        except Exception:
            continue
    return {"rmse": float("nan"), "mae": float("nan"), "bias": float("nan"), "n": float(n)}


def spatial_block_cv(
    x,
    y,
    values,
    n_blocks: int = 5,
    models: Sequence[str] = ("spherical", "exponential", "gaussian"),
) -> Dict[str, Any]:
    n = len(values)
    if n < n_blocks + 2:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    km = KMeans(n_clusters=n_blocks, random_state=0, n_init=10)
    labels = km.fit_predict(np.column_stack([x, y]))
    preds = np.full(n, np.nan)
    for b in range(n_blocks):
        te = labels == b
        tr = ~te
        if tr.sum() < 4 or te.sum() < 1:
            continue
        filled = False
        for vm in models:
            try:
                ok = OrdinaryKriging(
                    x[tr],
                    y[tr],
                    values[tr],
                    variogram_model=vm,
                    verbose=False,
                    enable_plotting=False,
                    coordinates_type="geographic",
                )
                z, _ = ok.execute("points", x[te], y[te])
                preds[te] = z
                filled = True
                break
            except Exception:
                continue
        if not filled:
            preds[te] = np.nan
    mask = np.isfinite(preds) & np.isfinite(values)
    if mask.sum() < 3:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    rmse = float(np.sqrt(mean_squared_error(values[mask], preds[mask])))
    mae = float(mean_absolute_error(values[mask], preds[mask]))
    return {"rmse": rmse, "mae": mae, "n": float(n)}


def spatial_kfold_cv(
    x,
    y,
    values,
    k_folds: int = 5,
    models: Sequence[str] = ("spherical", "exponential", "gaussian"),
) -> Dict[str, Any]:
    """K-fold spatial : chaque pli = un cluster KMeans (coords) en test, le reste en train."""
    n = len(values)
    if n < k_folds + 3:
        return {
            "rmse": float("nan"),
            "mae": float("nan"),
            "n": float(n),
            "k_folds": k_folds,
            "per_fold_rmse": [],
        }
    km = KMeans(n_clusters=k_folds, random_state=0, n_init=10)
    labels = km.fit_predict(np.column_stack([x, y]))
    fold_rmses: List[float] = []
    for fold in range(k_folds):
        te = labels == fold
        tr = ~te
        if tr.sum() < 4 or te.sum() < 1:
            continue
        x_te, y_te, v_te = x[te], y[te], values[te]
        pred_te: Optional[np.ndarray] = None
        for vm in models:
            try:
                ok = OrdinaryKriging(
                    x[tr],
                    y[tr],
                    values[tr],
                    variogram_model=vm,
                    verbose=False,
                    enable_plotting=False,
                    coordinates_type="geographic",
                )
                z, _ = ok.execute("points", x_te, y_te)
                pred_te = np.asarray(z, dtype=np.float64).ravel()
                break
            except Exception:
                continue
        if pred_te is None or not np.all(np.isfinite(pred_te)):
            continue
        fold_rmses.append(
            float(np.sqrt(mean_squared_error(v_te, pred_te)))
        )
    if len(fold_rmses) < 2:
        return {
            "rmse": float("nan"),
            "mae": float("nan"),
            "n": float(n),
            "k_folds": k_folds,
            "per_fold_rmse": fold_rmses,
        }
    return {
        "rmse": float(np.mean(fold_rmses)),
        "mae": float("nan"),
        "n": float(n),
        "k_folds": k_folds,
        "per_fold_rmse": fold_rmses,
        "n_folds_used": len(fold_rmses),
    }


def catboost_quantiles(
    X_train: np.ndarray,
    y_train: np.ndarray,
    X_pred: np.ndarray,
    use_gpu: bool,
) -> Tuple[np.ndarray, np.ndarray, np.ndarray]:
    if CatBoostRegressor is None:
        mu = float(np.mean(y_train))
        pred = np.full(len(X_pred), mu)
        return pred, pred, pred
    task = "GPU" if use_gpu else "CPU"
    try:
        def one(alpha: float, seed: int) -> np.ndarray:
            m = CatBoostRegressor(
                depth=6,
                iterations=400,
                learning_rate=0.06,
                loss_function=f"Quantile:alpha={alpha}",
                task_type=task,
                verbose=False,
                random_seed=seed,
            )
            m.fit(X_train, y_train)
            return np.asarray(m.predict(X_pred), dtype=np.float64)

        p10 = one(0.1, 1)
        p50 = one(0.5, 0)
        p90 = one(0.9, 2)
        return p10, p50, p90
    except Exception:
        mu = float(np.mean(y_train))
        pred = np.full(len(X_pred), mu)
        return pred, pred, pred


def load_ml_features(cur, maille_ids: Sequence[str]) -> Dict[str, np.ndarray]:
    if not maille_ids:
        return {}
    cur.execute(
        """
        SELECT
          m.id::text,
          COALESCE(af.vbs_moyen, 0)::float8,
          COALESCE(af.ip_moyen, 0)::float8,
          COALESCE(af.gonflement_cg_moyen, 0)::float8,
          COALESCE(af.dsm_altitude_mean, 0)::float8,
          COALESCE(af.pct_in_lama, 0)::float8,
          COALESCE(cf.risque_score, 0)::float8
        FROM atlas.mailles m
        LEFT JOIN atlas.ai_maille_features_fast af ON af.maille_id = m.id
        LEFT JOIN atlas.ai_context_features_maille cf ON cf.maille_code = m.code
        WHERE m.id = ANY(%s::uuid[])
        """,
        ([uuid.UUID(str(x)) for x in maille_ids],),
    )
    out: Dict[str, np.ndarray] = {}
    for row in cur.fetchall():
        mid = row[0]
        out[mid] = np.array(row[1:], dtype=np.float64)
    return out


def run_zone(
    conn,
    zone_code: str,
    parameter_id: str,
    stats_col: str,
    use_gpu: bool,
    kriging_only: bool = False,
    kriging_domain_id: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    cur = conn.cursor()
    train_label: str
    zone_id_db: Optional[str] = None
    domain_id_db: Optional[str] = None

    if kriging_domain_id:
        dinfo = fetch_kriging_domain(cur, kriging_domain_id)
        if not dinfo:
            cur.close()
            return {
                "ok": False,
                "kriging_domain_id": kriging_domain_id,
                "parameter": parameter_id,
                "reason": "domain_not_found_or_inactive",
            }
        domain_id_db = dinfo.domain_id
        train_label = f"{dinfo.domain_type}:{dinfo.domain_code}"
        x, y, mids_train, vals = load_training_points_domain(cur, kriging_domain_id, stats_col)
        grid = load_grid_mailles_domain(cur, kriging_domain_id)
    else:
        zinfo = fetch_zone(cur, zone_code)
        if not zinfo:
            cur.close()
            return {"ok": False, "zone": zone_code, "parameter": parameter_id, "reason": "zone_not_found_or_unpublished"}
        zone_id_db = zinfo.zone_id
        train_label = zone_code
        x, y, mids_train, vals = load_training_points(cur, zone_code, parameter_id, stats_col)
        grid = load_grid_mailles(cur, zone_code)

    if len(vals) < 6:
        cur.close()
        return {
            "ok": False,
            "train": train_label,
            "parameter": parameter_id,
            "reason": "insufficient_training_points",
            "n_train": len(vals),
        }

    if not grid:
        cur.close()
        return {"ok": False, "train": train_label, "parameter": parameter_id, "reason": "no_grid_mailles"}

    vlog(
        f"[kriging] train={train_label} param={parameter_id} stats_col={stats_col} "
        f"n_train={len(vals)} n_grid={len(grid)} lon_span={float(np.ptp(x)) if len(x) else 0:.5f} "
        f"lat_span={float(np.ptp(y)) if len(y) else 0:.5f}"
    )

    vg_model, vg_params = fit_gstools_variogram(x, y, vals)
    gx = np.array([g[1] for g in grid])
    gy = np.array([g[2] for g in grid])
    z_pred, z_var, pykrige_model_used, kriging_err = ordinary_kriging_with_fallback(
        x, y, vals, gx, gy
    )

    loo = cross_validate_loo(x, y, vals)
    loo_ok, loo_reason = loo_is_scientifically_usable(loo, len(vals))
    v_pref = str(loo.get("variogram_model") or pykrige_model_used)
    blk = spatial_block_cv(x, y, vals, models=(v_pref, "spherical", "exponential", "gaussian"))
    skf = spatial_kfold_cv(x, y, vals, k_folds=5, models=(v_pref, "spherical", "exponential", "gaussian"))

    lzo_metrics: Dict[str, Any] = {"skipped": True}
    if not kriging_domain_id and zone_code == "DEPRESSION_LAMA_TG":
        x2, y2, _, v2 = load_training_points(cur, "PLAINE_MONO_TG", parameter_id, stats_col)
        if len(v2) >= 4:
            zp, _, _, lzo_k_err = ordinary_kriging_with_fallback(x, y, vals, x2, y2)
            lzo_metrics = {
                "train_zone": "DEPRESSION_LAMA_TG",
                "test_zone": "PLAINE_MONO_TG",
                "rmse": float(np.sqrt(mean_squared_error(v2, zp))),
                "mae": float(mean_absolute_error(v2, zp)),
                "kriging_error": lzo_k_err,
            }

    vlog(
        f"[variogram] model={vg_model} range={vg_params.get('range')} sill={vg_params.get('sill')} "
        f"nugget={vg_params.get('nugget')} pykrige={pykrige_model_used} loo_rmse={loo.get('rmse')} "
        f"block_rmse={blk.get('rmse')} skfold_rmse={skf.get('rmse')} krig_err={kriging_err}"
    )

    run_id = str(uuid.uuid4())
    vario_id = str(uuid.uuid4())

    metrics_run = {
        "loo": loo,
        "block_cv": blk,
        "spatial_kfold_cv": skf,
        "leave_zone_out": lzo_metrics,
        "variogram_gstools": vg_params,
        "pykrige_variogram_model": pykrige_model_used,
        "kriging_grid_error": kriging_err,
        "loo_valid": loo_ok,
        "loo_validity_reason": loo_reason,
        "train_label": train_label,
        "stratified_domain": bool(kriging_domain_id),
    }

    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs (id, zone_id, kriging_domain_id, parameter_id, method, status, metrics, run_type, started_at, finished_at)
        VALUES (%s::uuid, %s::uuid, %s::uuid, %s, 'ordinary_kriging', 'finished', %s::jsonb, 'kriging', now(), now())
        """,
        (
            run_id,
            zone_id_db,
            domain_id_db,
            parameter_id,
            json.dumps(metrics_run),
        ),
    )

    fit_quality = {
        "source": "gstools+pykrige",
        "loo_rmse": loo.get("rmse"),
        "pykrige_variogram_model": pykrige_model_used,
        "anisotropy": {"mode": "isotropic_v1", "note": "directional_variogram_not_fitted"},
    }

    def _safe_rmse(d: Dict[str, Any], key: str = "rmse") -> Optional[float]:
        v = d.get(key)
        try:
            f = float(v) if v is not None else float("nan")
        except (TypeError, ValueError):
            return None
        return f if math.isfinite(f) else None

    loo_rmse_col = _safe_rmse(loo)
    blk_rmse_col = _safe_rmse(blk)
    skf_rmse_col = _safe_rmse(skf)

    cur.execute(
        """
        INSERT INTO atlas.ai_variograms (
          id, parameter_id, zone_id, kriging_domain_id, model_type, range_m, sill, nugget,
          loo_rmse, block_cv_rmse, spatial_kfold_rmse, fit_quality
        ) VALUES (
          %s::uuid, %s, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
        )
        """,
        (
            vario_id,
            parameter_id,
            zone_id_db,
            domain_id_db,
            vg_model,
            vg_params.get("range"),
            vg_params.get("sill"),
            vg_params.get("nugget"),
            loo_rmse_col,
            blk_rmse_col,
            skf_rmse_col,
            json.dumps(fit_quality),
        ),
    )

    cur.execute(
        """
        INSERT INTO atlas.ai_spatial_validation_runs (validation_type, parameter_id, train_zone_code, test_zone_code, metrics)
        VALUES ('loo_kriging', %s, %s, NULL, %s::jsonb)
        """,
        (parameter_id, train_label, json.dumps(loo)),
    )
    cur.execute(
        """
        INSERT INTO atlas.ai_spatial_validation_runs (validation_type, parameter_id, train_zone_code, test_zone_code, metrics)
        VALUES ('block_kriging', %s, %s, NULL, %s::jsonb)
        """,
        (parameter_id, train_label, json.dumps(blk)),
    )
    cur.execute(
        """
        INSERT INTO atlas.ai_spatial_validation_runs (validation_type, parameter_id, train_zone_code, test_zone_code, metrics)
        VALUES ('spatial_kfold_kriging', %s, %s, NULL, %s::jsonb)
        """,
        (parameter_id, train_label, json.dumps(skf)),
    )

    rows_iv = []
    for i, (mid, lon, lat) in enumerate(grid):
        vp = float(z_var[i]) if i < len(z_var) else None
        zp = float(z_pred[i]) if np.isfinite(z_pred[i]) else None
        rows_iv.append(
            (
                mid,
                zone_id_db,
                domain_id_db,
                parameter_id,
                zp,
                vp,
                0.75 if zp is not None else None,
                "ordinary_kriging_pykrige",
                vario_id,
                run_id,
            )
        )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values (
          maille_id, zone_id, kriging_domain_id, parameter_id, value, variance, confidence, method, variogram_id, run_id
        ) VALUES (
          %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s::uuid, %s::uuid
        )
        """,
        rows_iv,
        page_size=500,
    )

    if kriging_only:
        conn.commit()
        cur.close()
        return {
            "ok": True,
            "zone": zone_code,
            "kriging_domain_id": kriging_domain_id,
            "train": train_label,
            "parameter": parameter_id,
            "kriging_run": run_id,
            "variogram_id": vario_id,
            "ml_run": None,
            "n_train": len(vals),
            "n_grid": len(grid),
            "loo": loo,
            "loo_valid": loo_ok,
            "loo_validity_reason": loo_reason,
            "block_cv": blk,
            "spatial_kfold_cv": skf,
            "kriging_only": True,
            "pykrige_variogram_model": pykrige_model_used,
            "kriging_grid_error": kriging_err,
        }

    # --- ML + régression-kriging (CatBoost + krigeage des résidus) → surface persistée dans ai_interpolation_values ---
    train_ids = mids_train
    feat_map = load_ml_features(cur, train_ids + [g[0] for g in grid])
    z6 = np.zeros(6, dtype=np.float64)
    X_train = np.stack([feat_map.get(i, z6) for i in train_ids])
    y_train = vals
    X_grid = np.stack([feat_map.get(g[0], z6) for g in grid])

    p10, p50, p90 = catboost_quantiles(X_train, y_train, X_grid, use_gpu)
    _, p50_tr, _ = catboost_quantiles(X_train, y_train, X_train, use_gpu)
    resid = y_train - p50_tr
    rk_applied = len(resid) >= 6 and float(np.std(resid)) > 1e-9
    if rk_applied:
        r_pred, r_var, r_mod, r_err = ordinary_kriging_with_fallback(x, y, resid, gx, gy)
        rk = np.asarray(p50, dtype=np.float64) + r_pred
        vlog(
            f"[regression_kriging] applied=True model={r_mod} resid_std={float(np.std(resid)):.6f} err={r_err}"
        )
    else:
        rk = np.asarray(p50, dtype=np.float64)
        r_var = np.full(len(grid), np.nan)
        r_mod = None
        r_err = "skipped_weak_residual"
        vlog("[regression_kriging] applied=False")

    rk_run_id = str(uuid.uuid4())
    rk_metrics = {
        "parent_kriging_run_id": run_id,
        "variogram_id": vario_id,
        "residual_kriging_applied": rk_applied,
        "residual_std_train": float(np.std(resid)) if len(resid) else None,
        "residual_kriging_model": r_mod,
        "residual_kriging_error": r_err,
    }
    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs (id, zone_id, kriging_domain_id, parameter_id, method, status, metrics, run_type, started_at, finished_at)
        VALUES (%s::uuid, %s::uuid, %s::uuid, %s, 'regression_kriging_catboost', 'finished', %s::jsonb, 'regression_kriging', now(), now())
        """,
        (
            rk_run_id,
            zone_id_db,
            domain_id_db,
            parameter_id,
            json.dumps(rk_metrics),
        ),
    )

    rk_rows_iv = []
    for i, (mid, _lon, _lat) in enumerate(grid):
        vp = float(r_var[i]) if i < len(r_var) and np.isfinite(r_var[i]) else None
        rkp = float(rk[i]) if i < len(rk) and np.isfinite(rk[i]) else None
        rk_rows_iv.append(
            (
                mid,
                zone_id_db,
                domain_id_db,
                parameter_id,
                rkp,
                vp,
                0.82 if rkp is not None else None,
                "regression_kriging_catboost",
                vario_id,
                rk_run_id,
            )
        )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values (
          maille_id, zone_id, kriging_domain_id, parameter_id, value, variance, confidence, method, variogram_id, run_id
        ) VALUES (
          %s::uuid, %s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s::uuid, %s::uuid
        )
        """,
        rk_rows_iv,
        page_size=500,
    )

    pred_run = str(uuid.uuid4())
    ml_run_metrics = {
        **rk_metrics,
        "loo": loo,
        "block_cv": blk,
        "spatial_kfold_cv": skf,
        "loo_valid": loo_ok,
        "loo_validity_reason": loo_reason,
        "train_label": train_label,
        "stratified_domain": bool(kriging_domain_id),
        "pykrige_variogram_model": pykrige_model_used,
        "kriging_grid_error": kriging_err,
    }
    cur.execute(
        """
        INSERT INTO atlas.ai_prediction_runs (id, run_type, target_id, model_version, status, metrics, started_at, finished_at)
        VALUES (%s::uuid, %s, %s, %s, 'finished', %s::jsonb, now(), now())
        """,
        (
            pred_run,
            "regression_kriging_catboost",
            parameter_id,
            "catboost_quantile_residual_ok_v1",
            json.dumps(ml_run_metrics),
        ),
    )

    ml_model_version = "catboost_quantile_residual_ok_v1"
    ml_rows = []
    for i, (mid, _lon, _lat) in enumerate(grid):
        rkv = float(rk[i]) if i < len(rk) and np.isfinite(rk[i]) else None
        row_m = {"regression_kriging_value": rkv, "residual_kriging_applied": rk_applied}
        ml_rows.append(
            (
                mid,
                zone_id_db,
                parameter_id,
                pred_run,
                rkv,
                float(p10[i]),
                float(p50[i]),
                float(p90[i]),
                ml_model_version,
                json.dumps(row_m),
            )
        )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_maille_ml_values (
          maille_id, zone_id, parameter_id, prediction_run_id, value, p10, p50, p90, model_version, metrics
        ) VALUES (%s::uuid, %s::uuid, %s, %s::uuid, %s, %s, %s, %s, %s, %s::jsonb)
        ON CONFLICT DO NOTHING
        """,
        ml_rows,
        page_size=500,
    )

    conn.commit()
    cur.close()
    return {
        "ok": True,
        "zone": zone_code,
        "kriging_domain_id": kriging_domain_id,
        "train": train_label,
        "parameter": parameter_id,
        "kriging_run": run_id,
        "regression_kriging_run_id": rk_run_id,
        "variogram_id": vario_id,
        "ml_run": pred_run,
        "n_train": len(vals),
        "n_grid": len(grid),
        "loo": loo,
        "loo_valid": loo_ok,
        "loo_validity_reason": loo_reason,
        "block_cv": blk,
        "spatial_kfold_cv": skf,
        "regression_kriging_applied": rk_applied,
    }


def main() -> int:
    global VERBOSE
    p = argparse.ArgumentParser()
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    p.add_argument("--zone", default="DEPRESSION_LAMA_TG")
    p.add_argument("--parameter", default="vbs_avg")
    p.add_argument(
        "--kriging-domain-id",
        default="",
        help="UUID atlas.kriging_domains : krigeage stratifié (géologie/pédologie/risque), sans zone d'étude.",
    )
    p.add_argument("--gpu", action="store_true", help="CatBoost GPU si disponible")
    p.add_argument(
        "--verbose",
        action="store_true",
        help="Logs scientifiques sur stderr (effectifs, variogramme, LOO, blocs).",
    )
    p.add_argument(
        "--kriging-only",
        action="store_true",
        help="N'exécute que le krigage + persistance ai_interpolation_* (pas CatBoost / ai_maille_ml_values).",
    )
    p.add_argument(
        "--all-kriging-jobs",
        action="store_true",
        help="Parcourt atlas.v_ai_kriging_zone_plan (toutes les zones × paramètres interpolation).",
    )
    p.add_argument(
        "--all-domain-kriging-jobs",
        action="store_true",
        help="Parcourt atlas.v_ai_kriging_domain_plan (domaines homogènes × paramètres).",
    )
    p.add_argument(
        "--domain-job-limit",
        type=int,
        default=0,
        help="Limite le nombre de couples (domaine×paramètre) pour --all-domain-kriging-jobs (0 = sans limite).",
    )
    args = p.parse_args()
    VERBOSE = bool(args.verbose)
    _require_env_db(args.database_url or "")

    db_url = args.database_url or os.environ["DATABASE_URL"]
    conn = _connect(db_url)
    try:
        if args.all_domain_kriging_jobs:
            cur = conn.cursor()
            jobs = list_kriging_domain_jobs(cur, limit=args.domain_job_limit)
            cur.close()
            summary_d: List[Optional[Dict[str, Any]]] = []
            for dom_id, pid in jobs:
                sc, pkey = resolve_kriging_columns(pid)
                if not sc:
                    summary_d.append(
                        {
                            "ok": False,
                            "kriging_domain_id": dom_id,
                            "parameter": pid,
                            "reason": "no_stats_column_mapping",
                        }
                    )
                    continue
                out = run_zone(
                    conn,
                    "",
                    pkey,
                    sc,
                    use_gpu=args.gpu,
                    kriging_only=args.kriging_only,
                    kriging_domain_id=dom_id,
                )
                summary_d.append(out)
            n_ok_d = sum(1 for s in summary_d if s and s.get("ok"))
            n_loo_d = sum(1 for s in summary_d if s and s.get("ok") and s.get("loo_valid"))
            print(
                json.dumps(
                    {
                        "mode": "stratified_domains",
                        "jobs_total": len(jobs),
                        "runs_attempted": len(summary_d),
                        "runs_ok": n_ok_d,
                        "runs_loo_valid": n_loo_d,
                        "summary": summary_d,
                    },
                    indent=2,
                )
            )
        elif args.all_kriging_jobs:
            cur = conn.cursor()
            jobs = list_kriging_jobs(cur)
            cur.close()
            summary: List[Optional[Dict[str, Any]]] = []
            for zone_code, pid in jobs:
                sc, _ = resolve_kriging_columns(pid)
                if not sc:
                    summary.append(
                        {
                            "ok": False,
                            "zone": zone_code,
                            "parameter": pid,
                            "reason": "no_stats_column_mapping",
                        }
                    )
                    continue
                out = run_zone(
                    conn,
                    zone_code,
                    pid,
                    sc,
                    use_gpu=args.gpu,
                    kriging_only=args.kriging_only,
                )
                summary.append(out)
            n_ok = sum(1 for s in summary if s and s.get("ok"))
            n_loo = sum(
                1 for s in summary if s and s.get("ok") and s.get("loo_valid")
            )
            print(
                json.dumps(
                    {
                        "jobs_total": len(jobs),
                        "runs_attempted": len(summary),
                        "runs_ok": n_ok,
                        "runs_loo_valid": n_loo,
                        "summary": summary,
                    },
                    indent=2,
                )
            )
        else:
            stats_col, param_key = resolve_kriging_columns(args.parameter)
            if not stats_col:
                sys.exit(f"Paramètre non mappé (stats): {args.parameter}")
            dom_opt = (args.kriging_domain_id or "").strip() or None
            out = run_zone(
                conn,
                args.zone,
                param_key,
                stats_col,
                use_gpu=args.gpu,
                kriging_only=args.kriging_only,
                kriging_domain_id=dom_opt,
            )
            print(json.dumps(out, indent=2))
    finally:
        conn.close()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
