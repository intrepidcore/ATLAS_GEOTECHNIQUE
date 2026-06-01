#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import math
import os
import uuid
from typing import Any, Dict, List, Optional, Sequence, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_batch
from pykrige.ok import OrdinaryKriging
from sklearn.metrics import mean_absolute_error, mean_squared_error

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5432/atlas_clean")
HORIZONS: List[Tuple[str, float]] = [("h1", 1.0), ("h2", 1.5), ("h3", 2.0)]


def json_safe(obj: Any) -> str:
    def scrub(x: Any) -> Any:
        if isinstance(x, float):
            return None if (math.isnan(x) or math.isinf(x)) else x
        if isinstance(x, dict):
            return {k: scrub(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [scrub(v) for v in x]
        return x

    return json.dumps(scrub(obj), allow_nan=False)


def load_training_points(cur, depth_m: float) -> List[Tuple[str, float, float, float, str]]:
    cur.execute(
        """
        SELECT
          m.id::text AS maille_id,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
          epg.cg::float8 AS eg,
          COALESCE(up.type_sol, s.type_sol, 'UNKNOWN') AS type_sol
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
        JOIN atlas.mailles m ON m.code = s.maille_code
        LEFT JOIN LATERAL (
          SELECT p.type_sol
          FROM atlas.unites_pedologiques p
          WHERE ST_Contains(p.geom, ST_PointOnSurface(m.geom))
          LIMIT 1
        ) up ON TRUE
        WHERE s.deleted_at IS NULL
          AND e.depth_m = %s
          AND epg.cg IS NOT NULL
        """,
        (depth_m,),
    )
    out = []
    for row in cur.fetchall():
        mid, lon, lat, eg, tsol = row
        if eg is None:
            continue
        if not (math.isfinite(float(lon)) and math.isfinite(float(lat)) and math.isfinite(float(eg))):
            continue
        out.append((str(mid), float(lon), float(lat), float(eg), str(tsol or "UNKNOWN")))
    return out


def load_grid(cur) -> List[Tuple[str, float, float, str]]:
    cur.execute(
        """
        SELECT
          m.id::text AS maille_id,
          ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
          ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
          COALESCE(up.type_sol, 'UNKNOWN') AS type_sol
        FROM atlas.mailles m
        LEFT JOIN LATERAL (
          SELECT p.type_sol
          FROM atlas.unites_pedologiques p
          WHERE ST_Contains(p.geom, ST_PointOnSurface(m.geom))
          LIMIT 1
        ) up ON TRUE
        """
    )
    return [(str(a), float(b), float(c), str(d or "UNKNOWN")) for a, b, c, d in cur.fetchall()]


def _extract_ok_params(ok_obj) -> Dict[str, Optional[float]]:
    """Extrait nugget/sill/range d'un objet OrdinaryKriging ajusté."""
    try:
        params = ok_obj.variogram_model_parameters
        if params is not None and len(params) >= 3:
            partial_sill = float(params[0])
            rng = float(params[1])
            nugget = float(params[2])
            sill = partial_sill + nugget
            if rng < 10:
                rng_m = rng * 111000.0
            else:
                rng_m = rng
            return {"nugget": nugget, "sill": sill, "range_m": rng_m}
    except Exception:
        pass
    return {}


def fallback_kriging(x, y, values, gx, gy) -> Tuple[np.ndarray, np.ndarray, str, Dict[str, Optional[float]]]:
    models: Sequence[str] = ("spherical", "exponential", "gaussian", "linear")
    for m in models:
        try:
            ok = OrdinaryKriging(
                x, y, values, variogram_model=m, nlags=15, weight=True, verbose=False, enable_plotting=False, coordinates_type="geographic"
            )
            z, ss = ok.execute("points", gx, gy)
            zv = np.asarray(z, dtype=np.float64).ravel()
            sv = np.asarray(ss, dtype=np.float64).ravel()
            if np.isfinite(zv).sum() > 0:
                vp = _extract_ok_params(ok)
                return zv, sv, m, vp
        except Exception:
            continue
    return np.full(gx.shape[0], np.nan), np.full(gx.shape[0], np.nan), "spherical", {}


def loo_rmse_residual(x, y, resid) -> Dict[str, float]:
    n = len(resid)
    if n < 6:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    preds = []
    truths = []
    for i in range(n):
        mask = np.ones(n, dtype=bool)
        mask[i] = False
        try:
            ok = OrdinaryKriging(
                x[mask], y[mask], resid[mask], variogram_model="spherical", verbose=False, enable_plotting=False, coordinates_type="geographic"
            )
            z, _ = ok.execute("points", np.array([x[i]]), np.array([y[i]]))
            preds.append(float(z[0]))
            truths.append(float(resid[i]))
        except Exception:
            continue
    if len(preds) < 4:
        return {"rmse": float("nan"), "mae": float("nan"), "n": float(n)}
    p = np.array(preds)
    t = np.array(truths)
    return {
        "rmse": float(np.sqrt(mean_squared_error(t, p))),
        "mae": float(mean_absolute_error(t, p)),
        "n": float(n),
    }


def ensure_param(cur, pid: str) -> None:
    cur.execute("SELECT 1 FROM atlas.ai_parameter_catalog WHERE parameter_id=%s LIMIT 1", (pid,))
    if cur.fetchone():
        return
    cur.execute(
        """
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled, is_active,
           source_table, source_column, domain_type_pref, drift_strategy, physical_min, physical_max, depth_stratified, is_derived, derived_from)
        VALUES
          (%s, 'geotech', 'interpolation', '%%', TRUE, FALSE, TRUE,
           'essais_potentiel_gonflement', 'cg', 'pedologie', 'pedological_prior_residual_kriging', 0, 20, TRUE, FALSE, '{}'::text[])
        ON CONFLICT (parameter_id) DO NOTHING
        """,
        (pid,),
    )


def run_one(conn, horizon_label: str, depth_m: float) -> Dict[str, Any]:
    param_id = f"eg_ked_{horizon_label}"
    cur = conn.cursor()
    ensure_param(cur, param_id)

    train = load_training_points(cur, depth_m)
    if len(train) < 10:
        cur.close()
        return {"ok": False, "parameter": param_id, "depth_m": depth_m, "reason": "insufficient_training_points", "n_train": len(train)}

    grid = load_grid(cur)
    mids = [r[0] for r in train]
    x = np.array([r[1] for r in train], dtype=np.float64)
    y = np.array([r[2] for r in train], dtype=np.float64)
    vals = np.array([r[3] for r in train], dtype=np.float64)
    tsol_train = [r[4] for r in train]

    gx = np.array([r[1] for r in grid], dtype=np.float64)
    gy = np.array([r[2] for r in grid], dtype=np.float64)
    gmids = [r[0] for r in grid]
    tsol_grid = [r[3] for r in grid]

    priors: Dict[str, float] = {}
    counts: Dict[str, int] = {}
    for ts in sorted(set(tsol_train)):
        sel = [vals[i] for i in range(len(vals)) if tsol_train[i] == ts]
        if not sel:
            continue
        priors[ts] = float(np.mean(sel))
        counts[ts] = len(sel)
    global_mean = float(np.mean(vals))
    drift_train = np.array([priors.get(ts, global_mean) for ts in tsol_train], dtype=np.float64)
    drift_grid = np.array([priors.get(ts, global_mean) for ts in tsol_grid], dtype=np.float64)

    residuals = vals - drift_train
    z_res, z_var, model_used, ok_params = fallback_kriging(x, y, residuals, gx, gy)
    z_pred = z_res + drift_grid
    z_pred = np.clip(z_pred, 0.0, 20.0)

    var_base = float(np.nanvar(vals)) if np.isfinite(np.nanvar(vals)) else 1.0
    confidence = (1.0 / (1.0 + (z_var / max(var_base, 1e-6)))) * 100.0

    loo = loo_rmse_residual(x, y, residuals)
    run_id = str(uuid.uuid4())
    variogram_id = str(uuid.uuid4())

    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics, started_at, finished_at, zone_id, kriging_domain_id)
        VALUES
          (%s, 'kriging', %s, 'ked_pedologie_eg', 'v1', 'finished', %s::jsonb, now(), now(), NULL, NULL)
        """,
        (
            run_id,
            param_id,
            json_safe(
                {
                    "horizon_label": horizon_label,
                    "depth_m": depth_m,
                    "n_train": int(len(vals)),
                    "n_grid": int(len(gmids)),
                    "loo_residual": loo,
                    "model_used": model_used,
                    "drift_priors": priors,
                    "global_mean": global_mean,
                }
            ),
        ),
    )

    cur.execute(
        """
        INSERT INTO atlas.ai_variograms
          (id, parameter_id, zone_id, model_type, range_m, sill, nugget, anisotropy_ratio, anisotropy_angle_deg, fit_quality, created_at, kriging_domain_id, loo_rmse)
        VALUES
          (%s, %s, NULL, %s, %s, %s, %s, NULL, NULL, %s::jsonb, now(), NULL, %s)
        """,
        (
            variogram_id,
            param_id,
            model_used,
            ok_params.get("range_m"),
            ok_params.get("sill"),
            ok_params.get("nugget"),
            json_safe({"horizon_label": horizon_label, "depth_m": depth_m, "model": model_used}),
            None if not math.isfinite(float(loo.get("rmse", float("nan")))) else float(loo["rmse"]),
        ),
    )

    cur.execute("DELETE FROM atlas.ai_interpolation_values WHERE parameter_id = %s", (param_id,))
    rows = []
    for i, mid in enumerate(gmids):
        rows.append(
            (
                str(uuid.uuid4()),
                mid,
                param_id,
                float(z_pred[i]) if math.isfinite(float(z_pred[i])) else None,
                max(0.0, float(z_var[i])) if math.isfinite(float(z_var[i])) else None,  # clamp artefacts négatifs PyKrige (DATA-02)
                float(confidence[i]) if math.isfinite(float(confidence[i])) else None,
                variogram_id,
                run_id,
            )
        )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, zone_id, kriging_domain_id, parameter_id, value, variance, confidence, method, variogram_id, run_id, created_at)
        VALUES
          (%s::uuid, %s::uuid, NULL, NULL, %s, %s, %s, %s, 'ked_pedologie_eg', %s::uuid, %s::uuid, now())
        """,
        rows,
        page_size=1000,
    )

    cur.execute("DELETE FROM atlas.pedological_drift_priors WHERE parameter_id=%s AND horizon_label=%s", (param_id, horizon_label.upper()))
    prior_rows = [
        (param_id, horizon_label.upper(), depth_m, ts, float(v), int(counts.get(ts, 0)))
        for ts, v in priors.items()
    ]
    if prior_rows:
        execute_batch(
            cur,
            """
            INSERT INTO atlas.pedological_drift_priors
              (parameter_id, horizon_label, depth_m, type_sol, drift_value, n_points, computed_at, source_label)
            VALUES
              (%s, %s, %s, %s, %s, %s, now(), 'run_ked_eg_horizons.py')
            """,
            prior_rows,
            page_size=200,
        )

    conn.commit()
    cur.close()

    return {
        "ok": True,
        "parameter": param_id,
        "horizon": horizon_label.upper(),
        "depth_m": depth_m,
        "n_train": int(len(vals)),
        "n_grid": int(len(gmids)),
        "loo_rmse_residual": loo.get("rmse"),
        "variogram_model": model_used,
        "run_id": run_id,
    }


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=DB_DEFAULT)
    args = ap.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL required")

    conn = psycopg2.connect(args.database_url)
    out = []
    try:
        for hz, depth in HORIZONS:
            out.append(run_one(conn, hz, depth))
    finally:
        conn.close()

    print(json_safe({"runs": out}))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
