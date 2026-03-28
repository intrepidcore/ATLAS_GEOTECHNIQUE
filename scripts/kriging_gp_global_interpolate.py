#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from typing import Dict, List, Optional, Tuple

import numpy as np
import psycopg2
from psycopg2.extras import execute_values

from sklearn.gaussian_process import GaussianProcessRegressor
from sklearn.gaussian_process.kernels import ConstantKernel, RBF, WhiteKernel
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error
from sklearn.preprocessing import StandardScaler


def _require_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"Missing env var {name}")
    return v


def _fit_gp(X_train: np.ndarray, y_train: np.ndarray) -> GaussianProcessRegressor:
    # "Kriging-like": Gaussian Process regression (stationary kernel).
    # With <= few hundred points, this remains tractable and provides uncertainty via `return_std=True`.
    kernel = (
        ConstantKernel(1.0, (1e-2, 1e3))
        * RBF(length_scale=1.0, length_scale_bounds=(1e-2, 1e3))
        + WhiteKernel(noise_level=1e-3, noise_level_bounds=(1e-8, 1e1))
    )
    gp = GaussianProcessRegressor(
        kernel=kernel,
        normalize_y=True,
        n_restarts_optimizer=2,
        random_state=0,
    )
    gp.fit(X_train, y_train)
    return gp


def _quality_from_std(std: np.ndarray) -> np.ndarray:
    # Higher uncertainty => lower quality. std in target units.
    # Quality is clipped to [0, 100].
    q = 100.0 * (1.0 / (1.0 + std))
    return np.clip(q, 0.0, 100.0)


def main() -> int:
    p = argparse.ArgumentParser(
        description="Interpolation 'kriging-like' using global GP regression (uncertainty-aware)."
    )
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    p.add_argument("--method", default="kriging_gp_global_v1")
    p.add_argument("--limit-mailles", type=int, default=0)
    args = p.parse_args()

    db_url = args.database_url or _require_env("DATABASE_URL")

    limit_mailles = int(args.limit_mailles or 0)
    method = args.method

    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        with conn.cursor() as cur:
            mailles_sql = """
                SELECT
                    m.id,
                    m.code,
                    ST_X(ST_Centroid(m.geom))::double precision AS x,
                    ST_Y(ST_Centroid(m.geom))::double precision AS y
                FROM atlas.mailles m
            """
            if limit_mailles > 0:
                mailles_sql += f" LIMIT {limit_mailles}"
            cur.execute(mailles_sql)
            mailles = cur.fetchall()

        maille_ids: List[str] = [str(r[0]) for r in mailles]
        maille_codes: List[str] = [r[1] for r in mailles]
        X_pred_raw = np.array([[float(r[2]), float(r[3])] for r in mailles], dtype=np.float64)

        with conn.cursor() as cur:
            # Points from sondages, aggregated to one value per sondage (mean across samples/tests).
            cur.execute(
                """
                WITH pts AS (
                    SELECT
                        s.id,
                        ST_X(ST_Transform(s.geom, 25231))::double precision AS x,
                        ST_Y(ST_Transform(s.geom, 25231))::double precision AS y,
                        ip_data.ip_moy::double precision AS ip_moy,
                        vbs_data.vbs_moy::double precision AS vbs_moy,
                        eg_data.eg_moy::double precision AS eg_moy
                    FROM atlas.sondages s
                    LEFT JOIN LATERAL (
                        SELECT AVG(a.ip_generated) AS ip_moy
                        FROM atlas.echantillons e
                        JOIN atlas.essais_atterberg a ON a.echantillon_id = e.id
                        WHERE e.sondage_id = s.id
                          AND a.ip_generated IS NOT NULL
                    ) ip_data ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT AVG(v.vbs) AS vbs_moy
                        FROM atlas.echantillons e
                        JOIN atlas.essais_vbs v ON v.echantillon_id = e.id
                        WHERE e.sondage_id = s.id
                          AND v.vbs IS NOT NULL
                    ) vbs_data ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT AVG(e.eg) AS eg_moy
                        FROM atlas.echantillons e
                        WHERE e.sondage_id = s.id
                          AND e.eg IS NOT NULL
                    ) eg_data ON TRUE
                    WHERE s.geom IS NOT NULL
                      AND (ip_data.ip_moy IS NOT NULL OR vbs_data.vbs_moy IS NOT NULL OR eg_data.eg_moy IS NOT NULL)
                )
                SELECT id::text, x, y, ip_moy, vbs_moy, eg_moy
                FROM pts
                """
            )
            pts = cur.fetchall()

        X_pts_raw = np.array([[float(r[1]), float(r[2])] for r in pts], dtype=np.float64)
        ip_pts = np.array([r[3] if r[3] is not None else np.nan for r in pts], dtype=np.float64)
        vbs_pts = np.array([r[4] if r[4] is not None else np.nan for r in pts], dtype=np.float64)
        eg_pts = np.array([r[5] if r[5] is not None else np.nan for r in pts], dtype=np.float64)

        def predict_one(y_pts: np.ndarray) -> Tuple[Optional[np.ndarray], Optional[np.ndarray], int]:
            mask = np.isfinite(y_pts)
            n = int(mask.sum())
            if n < 3:
                return None, None, n

            X_train_raw = X_pts_raw[mask]
            y_train = y_pts[mask]

            scaler = StandardScaler()
            X_train = scaler.fit_transform(X_train_raw)
            X_pred = scaler.transform(X_pred_raw)

            gp = _fit_gp(X_train, y_train)
            y_mean, y_std = gp.predict(X_pred, return_std=True)
            return y_mean, y_std, n

        ip_mean, ip_std, n_ip = predict_one(ip_pts)
        vbs_mean, vbs_std, n_vbs = predict_one(vbs_pts)
        eg_mean, eg_std, n_eg = predict_one(eg_pts)

        # Build interpolation outputs per maille
        ip_out = ip_mean if ip_mean is not None else np.full((len(mailles),), np.nan)
        vbs_out = vbs_mean if vbs_mean is not None else np.full((len(mailles),), np.nan)
        eg_out = eg_mean if eg_mean is not None else np.full((len(mailles),), np.nan)

        qualities: List[np.ndarray] = []
        if ip_std is not None:
            qualities.append(_quality_from_std(ip_std))
        if vbs_std is not None:
            qualities.append(_quality_from_std(vbs_std))
        if eg_std is not None:
            qualities.append(_quality_from_std(eg_std))

        if qualities:
            q_avg = np.mean(np.stack(qualities, axis=0), axis=0)
        else:
            q_avg = np.zeros((len(mailles),), dtype=np.float64)

        support_points = max(n_ip, n_vbs, n_eg)

        rows = []
        for maille_id, maille_code, ip, vbs, eg, q in zip(
            maille_ids, maille_codes, ip_out, vbs_out, eg_out, q_avg
        ):
            rows.append(
                (
                    maille_id,
                    maille_code,
                    method,
                    None if np.isnan(ip) else float(np.round(ip, 3)),
                    None if np.isnan(vbs) else float(np.round(vbs, 3)),
                    None if np.isnan(eg) else float(np.round(eg, 3)),
                    int(support_points),
                    float(np.round(q, 2)),
                )
            )

        with conn.cursor() as cur:
            execute_values(
                cur,
                """
                INSERT INTO atlas.maille_geotech_interpolation (
                    maille_id,
                    maille_code,
                    method,
                    ip_interpolated,
                    vbs_interpolated,
                    eg_interpolated,
                    support_points,
                    interpolation_quality,
                    updated_at
                ) VALUES %s
                ON CONFLICT (maille_id) DO UPDATE SET
                    maille_code = EXCLUDED.maille_code,
                    method = EXCLUDED.method,
                    ip_interpolated = EXCLUDED.ip_interpolated,
                    vbs_interpolated = EXCLUDED.vbs_interpolated,
                    eg_interpolated = EXCLUDED.eg_interpolated,
                    support_points = EXCLUDED.support_points,
                    interpolation_quality = EXCLUDED.interpolation_quality,
                    updated_at = NOW()
                """,
                rows,
                template="(%s,%s,%s,%s,%s,%s,%s,%s,NOW())",
                page_size=500,
            )

        conn.commit()

        result = {
            "success": True,
            "mailles_interpolated": len(mailles),
            "points_total": len(pts),
            "points_ip": n_ip,
            "points_vbs": n_vbs,
            "points_eg": n_eg,
            "support_points_used": support_points,
            "method": method,
        }
        print(json.dumps(result))
        return 0
    finally:
        try:
            conn.close()
        except Exception:
            pass


if __name__ == "__main__":
    raise SystemExit(main())

