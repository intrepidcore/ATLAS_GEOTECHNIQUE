#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import json
import os
from dataclasses import dataclass
from typing import Dict, List, Optional, Tuple

import numpy as np
import psycopg2

from sklearn.ensemble import HistGradientBoostingRegressor
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import train_test_split
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import StandardScaler


def _require_env(name: str) -> str:
    v = os.environ.get(name)
    if not v:
        raise SystemExit(f"Missing env var {name}")
    return v


def round2(v: np.ndarray) -> np.ndarray:
    return np.round(v.astype(np.float64), 2)


def stable_code_unit(s: Optional[str]) -> float:
    """Encodage déterministe [0,1] pour codes géol/pédo/hydro (features tabulaires)."""
    if not s:
        return 0.0
    h = hashlib.md5(s.encode("utf-8")).digest()
    return int.from_bytes(h[:4], "big") / 4294967295.0

def _safe_split(X: np.ndarray, y: np.ndarray, min_test: int = 2) -> Tuple[np.ndarray, np.ndarray, np.ndarray, np.ndarray]:
    """
    Split with guard for tiny datasets.
    If dataset too small, returns full train and empty test.
    """
    n = int(X.shape[0])
    if n < (min_test + 3):
        return X, np.empty((0, X.shape[1])), y, np.empty((0,))
    return train_test_split(X, y, test_size=0.2, random_state=0)

def _regressor_pipeline() -> Pipeline:
    base = HistGradientBoostingRegressor(
        random_state=0,
        max_depth=None,
        learning_rate=0.05,
        max_iter=400,
    )
    return Pipeline(
        steps=[
            ("imputer", SimpleImputer(strategy="median")),
            ("scaler", StandardScaler()),
            ("model", base),
        ]
    )


def main() -> int:
    p = argparse.ArgumentParser(description="Supervised ML inference for rga/bearing/settlement on all mailles.")
    p.add_argument("--database-url", default=os.environ.get("DATABASE_URL", ""))
    p.add_argument("--model-version", default="supervised_ml_gb_v2_context")
    p.add_argument("--target", default="rga_predictor")
    args = p.parse_args()

    db_url = args.database_url or _require_env("DATABASE_URL")
    model_version = args.model_version

    conn = psycopg2.connect(db_url)
    conn.autocommit = False

    try:
        # ---------------------------------------------------------------------
        # 1) Feature matrix for ALL mailles (lightweight, stable)
        # ---------------------------------------------------------------------
        with conn.cursor() as cur:
            cur.execute(
                """
                SELECT
                  m.id AS maille_id,
                  m.code AS maille_code,
                  COALESCE(dc.altitude_mean, d.altitude_mean)::double precision AS altitude_mean,
                  COALESCE(dc.altitude_stddev, d.altitude_stddev)::double precision AS altitude_stddev,
                  COALESCE(dc.altitude_range, d.altitude_range)::double precision AS altitude_range,
                  COALESCE((
                    SELECT MAX(mz.pct_intersection)::double precision
                    FROM atlas.mailles_zones_etude mz
                    JOIN atlas.zones_etude ze ON ze.id = mz.zone_id
                    WHERE mz.maille_id = m.id
                      AND ze.is_published = true
                      AND ze.code IN (
                        'DEPRESSION_LAMA_TG',
                        'DEPRESSION_BADO_TG',
                        'PLAINE_MONO_TG',
                        'PLAINE_OTI_TG',
                        'FOSSE_LIONS_TG'
                      )
                  ), 0)::double precision AS pct_zones_etude,
                  COALESCE(sond.n_sondages, 0)::int AS n_sondages,
                  COALESCE(cf.risque_score, 0)::double precision AS risque_score,
                  cf.geol_code,
                  cf.pedo_code,
                  cf.hydro_code
                FROM atlas.mailles m
                LEFT JOIN atlas.dsm_maille_flat_cache dc ON dc.id = m.id
                LEFT JOIN atlas.v_maille_dsm_2km_flat d ON d.id = m.id
                LEFT JOIN atlas.ai_context_features_maille cf ON cf.maille_code = m.code
                LEFT JOIN (
                  SELECT s.maille_code, COUNT(DISTINCT s.id)::int AS n_sondages
                  FROM atlas.sondages s
                  WHERE s.deleted_at IS NULL AND s.maille_code IS NOT NULL
                  GROUP BY s.maille_code
                ) sond ON sond.maille_code = m.code;
                """
            )
            all_feature_rows = cur.fetchall()

        maille_ids_all: List[str] = []
        maille_codes_all: List[str] = []
        X_all_rows: List[List[float]] = []
        n_sondages_map: Dict[str, int] = {}
        pct_lama_map: Dict[str, float] = {}
        for row in all_feature_rows:
            (
                mid,
                mcode,
                alt_mean,
                alt_std,
                alt_rng,
                pct_zones,
                n_sond,
                risque_score,
                geol_code,
                pedo_code,
                hydro_code,
            ) = row
            maille_ids_all.append(mid)
            maille_codes_all.append(mcode)
            n_sondages_map[mcode] = int(n_sond or 0)
            pct_lama_map[mcode] = float(pct_zones or 0.0)
            alt_m = float(alt_mean) if alt_mean is not None else 0.0
            alt_s = float(alt_std) if alt_std is not None else 0.0
            alt_r = float(alt_rng) if alt_rng is not None else 0.0
            rs = float(risque_score) if risque_score is not None else 0.0
            X_all_rows.append(
                [
                    float(pct_zones or 0.0),
                    float(n_sond or 0),
                    alt_m,
                    alt_s,
                    alt_r,
                    rs,
                    stable_code_unit(geol_code),
                    stable_code_unit(pedo_code),
                    stable_code_unit(hydro_code),
                ]
            )
        X_all = np.array(X_all_rows, dtype=np.float64)

        # ---------------------------------------------------------------------
        # 2) Targets from available lab tables (partial multi-task)
        # ---------------------------------------------------------------------
        with conn.cursor() as cur:
            # VBS target by maille_code
            cur.execute(
                """
                SELECT
                  s.maille_code,
                  AVG(ev.vbs)::double precision AS vbs_moy
                FROM atlas.essais_vbs ev
                JOIN atlas.echantillons e ON e.id = ev.echantillon_id
                JOIN atlas.sondages s ON s.id = e.sondage_id
                WHERE s.deleted_at IS NULL AND s.maille_code IS NOT NULL
                GROUP BY s.maille_code
                HAVING AVG(ev.vbs) IS NOT NULL;
                """
            )
            vbs_rows = cur.fetchall()

            # IP target by maille_code (Atterberg)
            cur.execute(
                """
                SELECT
                  s.maille_code,
                  AVG(COALESCE(ea.ip_generated, (ea.wl - ea.wp)))::double precision AS ip_moy
                FROM atlas.essais_atterberg ea
                JOIN atlas.echantillons e ON e.id = ea.echantillon_id
                JOIN atlas.sondages s ON s.id = e.sondage_id
                WHERE s.deleted_at IS NULL AND s.maille_code IS NOT NULL
                GROUP BY s.maille_code
                HAVING AVG(COALESCE(ea.ip_generated, (ea.wl - ea.wp))) IS NOT NULL;
                """
            )
            ip_rows = cur.fetchall()

            # CG target by maille_code (gonflement)
            cur.execute(
                """
                SELECT
                  s.maille_code,
                  AVG(pg.cg)::double precision AS cg_moy
                FROM atlas.essais_potentiel_gonflement pg
                JOIN atlas.echantillons e ON e.id = pg.echantillon_id
                JOIN atlas.sondages s ON s.id = e.sondage_id
                WHERE s.deleted_at IS NULL AND s.maille_code IS NOT NULL
                GROUP BY s.maille_code
                HAVING AVG(pg.cg) IS NOT NULL;
                """
            )
            cg_rows = cur.fetchall()

        # Helper: map features by maille_code
        feat_by_code: Dict[str, np.ndarray] = {
            c: X_all[i] for i, c in enumerate(maille_codes_all)
        }

        def build_xy(rows: List[Tuple[str, float]]) -> Tuple[np.ndarray, np.ndarray, List[str]]:
            codes = []
            X = []
            y = []
            for (code, val) in rows:
                if code not in feat_by_code:
                    continue
                codes.append(code)
                X.append(feat_by_code[code].tolist())
                y.append(float(val))
            if not X:
                return np.empty((0, X_all.shape[1])), np.empty((0,)), []
            return np.array(X, dtype=np.float64), np.array(y, dtype=np.float64), codes

        X_vbs, y_vbs, codes_vbs = build_xy(vbs_rows)
        X_ip, y_ip, codes_ip = build_xy(ip_rows)
        X_cg, y_cg, codes_cg = build_xy(cg_rows)

        # V1: require at least some label signal; otherwise fail fast.
        if X_vbs.shape[0] < 5 and X_ip.shape[0] < 5 and X_cg.shape[0] < 5:
            raise SystemExit(
                f"Not enough labeled rows for supervised inference (vbs={X_vbs.shape[0]}, ip={X_ip.shape[0]}, cg={X_cg.shape[0]})."
            )

        def compute_labels(ip_moy: float, vbs_moy: float, cg_moy: float, pct_in_lama: float) -> Tuple[float, str, float, float]:
            sum_score = (vbs_moy * 7.2) + (ip_moy * 1.45) + (cg_moy * 2.4) + (10.0 if pct_in_lama >= 25.0 else 0.0)
            rga_score = float(np.round(np.clip(sum_score, 0.0, 100.0), 2))
            if sum_score >= 80.0:
                rga_class = "tres_fort"
            elif sum_score >= 60.0:
                rga_class = "fort"
            elif sum_score >= 40.0:
                rga_class = "moyen"
            else:
                rga_class = "faible"
            bearing = float(np.round(max(60.0, 230.0 - (np.clip(sum_score, 0.0, 100.0) * 1.1)), 2))
            settlement = float(np.round(np.clip((150.0 / max(bearing, 1.0)) * 100.0, 0.0, 100.0), 2))
            return rga_score, rga_class, bearing, settlement

        # ---------------------------------------------------------------------
        # 3) Train 3 regressors (partial multi-task): predict VBS/IP/CG separately
        # ---------------------------------------------------------------------
        model_vbs = _regressor_pipeline()
        model_ip = _regressor_pipeline()
        model_cg = _regressor_pipeline()

        metrics: Dict[str, float | int | str | None] = {
            "model_version": model_version,
            "target": args.target,
            "n_vbs_training": int(X_vbs.shape[0]),
            "n_ip_training": int(X_ip.shape[0]),
            "n_cg_training": int(X_cg.shape[0]),
        }

        def fit_with_metrics(name: str, model: Pipeline, X: np.ndarray, y: np.ndarray):
            X_tr, X_te, y_tr, y_te = _safe_split(X, y)
            model.fit(X_tr, y_tr)
            if X_te.shape[0] > 0:
                pred = model.predict(X_te)
                metrics[f"rmse_{name}"] = float(np.sqrt(mean_squared_error(y_te, pred)))
                metrics[f"r2_{name}"] = float(r2_score(y_te, pred))
            else:
                metrics[f"rmse_{name}"] = None
                metrics[f"r2_{name}"] = None

        if X_vbs.shape[0] >= 5:
            fit_with_metrics("vbs", model_vbs, X_vbs, y_vbs)
        if X_ip.shape[0] >= 5:
            fit_with_metrics("ip", model_ip, X_ip, y_ip)
        if X_cg.shape[0] >= 5:
            fit_with_metrics("cg", model_cg, X_cg, y_cg)

        pred_rows = []
        # Predict VBS/IP/CG for all mailles; derive RGA/bearing/settlement deterministically.
        # If a model wasn't trained (too few labels), fall back to global means of available labels.
        vbs_fallback = float(np.nanmean(y_vbs)) if y_vbs.shape[0] > 0 else 8.0
        ip_fallback = float(np.nanmean(y_ip)) if y_ip.shape[0] > 0 else 15.0
        cg_fallback = float(np.nanmean(y_cg)) if y_cg.shape[0] > 0 else 5.0

        vbs_pred_all = model_vbs.predict(X_all) if X_vbs.shape[0] >= 5 else np.full((X_all.shape[0],), vbs_fallback)
        ip_pred_all = model_ip.predict(X_all) if X_ip.shape[0] >= 5 else np.full((X_all.shape[0],), ip_fallback)
        cg_pred_all = model_cg.predict(X_all) if X_cg.shape[0] >= 5 else np.full((X_all.shape[0],), cg_fallback)

        for i in range(X_all.shape[0]):
            maille_id = maille_ids_all[i]
            maille_code = maille_codes_all[i]
            pct_in_lama = float(pct_lama_map.get(maille_code, 0.0))
            n_sondages = int(n_sondages_map.get(maille_code, 0))

            # Clamp physical plausibility (V1 guardrails)
            vbs_moy = float(np.clip(vbs_pred_all[i], 0.0, 35.0))
            ip_moy = float(np.clip(ip_pred_all[i], 0.0, 80.0))
            cg_moy = float(np.clip(cg_pred_all[i], 0.0, 25.0))

            rga_score, rga_class, bearing_kpa, settlement_pct = compute_labels(ip_moy, vbs_moy, cg_moy, pct_in_lama)

            # Confidence: more sondages + in-sample target availability boosts score
            has_any_label = (maille_code in set(codes_vbs)) or (maille_code in set(codes_ip)) or (maille_code in set(codes_cg))
            confidence_base = 30 + (n_sondages * 8)
            confidence = confidence_base + (20 if has_any_label else 0)
            confidence_score = float(np.round(np.clip(confidence, 0, 100), 2))

            pred_rows.append(
                (
                    maille_id,
                    maille_code,
                    rga_score,
                    rga_class,
                    bearing_kpa,
                    settlement_pct,
                    confidence_score,
                )
            )

        # Upsert in atlas.maille_geotech_infer
        with conn.cursor() as cur:
            # Bulk insert/update
            from psycopg2.extras import execute_values

            execute_values(
                cur,
                """
                INSERT INTO atlas.maille_geotech_infer (
                    maille_id,
                    maille_code,
                    rga_score,
                    rga_class,
                    bearing_capacity_kpa,
                    settlement_risk_pct,
                    confidence_score,
                    model_version,
                    updated_at
                ) VALUES %s
                ON CONFLICT (maille_id) DO UPDATE SET
                    maille_code = EXCLUDED.maille_code,
                    rga_score = EXCLUDED.rga_score,
                    rga_class = EXCLUDED.rga_class,
                    bearing_capacity_kpa = EXCLUDED.bearing_capacity_kpa,
                    settlement_risk_pct = EXCLUDED.settlement_risk_pct,
                    confidence_score = EXCLUDED.confidence_score,
                    model_version = EXCLUDED.model_version,
                    updated_at = NOW();
                """,
                [
                    (
                        mid,
                        mcode,
                        rs,
                        rclass,
                        bearing,
                        settle,
                        conf,
                        model_version,
                    )
                    for (mid, mcode, rs, rclass, bearing, settle, conf) in pred_rows
                ],
                template="(%s,%s,%s,%s,%s,%s,%s,%s,NOW())",
                page_size=500,
            )

        conn.commit()

        result = {
            "success": True,
            "n_predicted": len(pred_rows),
            "metrics": metrics,
            "model_version": model_version,
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

