#!/usr/bin/env python3
"""
Atlas RG - Regression Kriging pour EG (Essai de Gonflement / Argiles Gibbsitiques)
========================================================================

Méthode: Regression Kriging avec covariables SCORPAN
Données:cg depuis essais_potentiel_gonflement (327 valeurs)
Horizons: H1 (0.5-1.5m), H2 (1.0-2.0m), H3 (1.5-2.5m)
"""

import os
import sys
import json
import logging
from datetime import datetime
from pathlib import Path
from typing import Tuple, Dict, List

import numpy as np
import pandas as pd
import psycopg2
from sklearn.preprocessing import StandardScaler
from sklearn.linear_model import LinearRegression
from sklearn.metrics import mean_squared_error, mean_absolute_error, r2_score

try:
    from pykrige.uk import UniversalKriging
except ImportError:
    print("ERREUR: pykrige non installé")
    sys.exit(1)

# Configuration logging
LOG_DIR = Path("C:/PROJET_ATLAS_MASTER/atlas_reclone/logs")
LOG_DIR.mkdir(exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)-8s | %(message)s',
    handlers=[
        logging.FileHandler(LOG_DIR / f"rk_eg_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log"),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

DB_CONFIG = {
    'host': '127.0.0.1',
    'port': 5433,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

PHYSICAL_RANGE = (0.0, 20.0)


def get_db_connection():
    return psycopg2.connect(**DB_CONFIG)


def extract_eg_terrain_data(horizon: str) -> pd.DataFrame:
    logger.info(f"Extraction EG terrain horizon {horizon}")
    
    depth_range = {'H1': (0.5, 1.5), 'H2': (1.0, 2.0), 'H3': (1.5, 2.5)}
    d_min, d_max = depth_range[horizon]
    
    query = f"""
    WITH eg_data AS (
        SELECT e.depth_m, eg.cg as value, 
            ST_Transform(s.geom, 25231) as geom_25231
        FROM atlas.essais_potentiel_gonflement eg
        JOIN atlas.echantillons e ON e.id = eg.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE eg.cg IS NOT NULL AND eg.cg >= {PHYSICAL_RANGE[0]} AND eg.cg <= {PHYSICAL_RANGE[1]}
            AND s.geom IS NOT NULL
            AND e.depth_m >= {d_min} - 0.3 AND e.depth_m <= {d_max} + 0.3
    )
    SELECT m.code as maille_code,
        m.xc_utm31 as x_utm,
        m.yc_utm31 as y_utm,
        AVG(eg.value) as value
    FROM eg_data eg
    JOIN atlas.mailles m ON ST_Contains(m.geom, eg.geom_25231)
    GROUP BY m.code, m.xc_utm31, m.yc_utm31
    """
    
    with get_db_connection() as conn:
        df = pd.read_sql(query, conn)
    
    logger.info(f"  -> {len(df)} mailles")
    return df


def extract_scorpan_features(maille_codes: List[str]) -> pd.DataFrame:
    if not maille_codes:
        return pd.DataFrame()
    
    codes_list = "', '".join(maille_codes[:5000])
    query = f"""
    SELECT maille_code, dem_altitude, dem_slope, dem_tpi, dem_hand,
           distance_river_m, prec_annual, lon, lat
    FROM atlas.v_scorpan_features
    WHERE maille_code IN ('{codes_list}')
    """
    
    with get_db_connection() as conn:
        df = pd.read_sql(query, conn)
    return df


def prepare_data(eg_df: pd.DataFrame, scorfan_df: pd.DataFrame):
    merged = eg_df.merge(scorfan_df, on='maille_code', how='inner')
    if len(merged) < 10:
        return None
    
    feature_cols = ['dem_altitude', 'dem_slope', 'dem_tpi', 'dem_hand', 
                   'distance_river_m', 'prec_annual', 'lon', 'lat']
    available = [c for c in feature_cols if c in merged.columns]
    
    X = merged[available].fillna(0).values
    y = merged['value'].values
    coords = merged[['x_utm', 'y_utm']].values
    
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)
    
    return X_scaled, y, coords, scaler, available


def train_regression(X_train: np.ndarray, y_train: np.ndarray):
    model = LinearRegression(fit_intercept=True)
    model.fit(X_train, y_train)
    
    y_pred = model.predict(X_train)
    r2 = r2_score(y_train, y_pred)
    rmse = np.sqrt(mean_squared_error(y_train, y_pred))
    
    logger.info(f"  -> R2={r2:.4f}, RMSE={rmse:.4f}")
    
    return model, {'r2_train': r2, 'rmse_train': rmse, 'n_train': len(y_train)}


def perform_loo_cv(coords: np.ndarray, residuals: np.ndarray) -> Dict:
    logger.info("LOO-CV analytique")
    
    if len(coords) < 20:
        return {'rmse_loo': None, 'r2_loo': None}
    
    x_c, y_c = coords[:, 0], coords[:, 1]
    preds = []
    
    for i in range(len(residuals)):
        mask = np.ones(len(residuals), dtype=bool)
        mask[i] = False
        try:
            uk = UniversalKriging(x_c[mask], y_c[mask], residuals[mask],
                                 variogram_model='spherical', verbose=False,
                                 enable_plotting=False, drift_terms=['simple'])
            pred, _ = uk.execute('points', np.array([x_c[i]]), np.array([y_c[i]]))
            preds.append(pred[0])
        except:
            preds.append(0.0)
    
    preds = np.array(preds)
    rmse_loo = np.sqrt(mean_squared_error(residuals, preds))
    
    ss_res = np.sum((residuals - preds) ** 2)
    ss_tot = np.sum((residuals - np.mean(residuals)) ** 2)
    r2_loo = 1 - (ss_res / ss_tot) if ss_tot > 0 else 0
    
    logger.info(f"  -> LOO: RMSE={rmse_loo:.4f}, R2={r2_loo:.4f}")
    return {'rmse_loo': rmse_loo, 'r2_loo': r2_loo, 'n_loo': len(residuals)}


def fit_variogram(coords: np.ndarray, residuals: np.ndarray):
    logger.info("Ajustement variogramme")
    
    x_c, y_c = coords[:, 0], coords[:, 1]
    
    for vm in ['spherical', 'exponential']:
        try:
            uk = UniversalKriging(x_c, y_c, residuals, variogram_model=vm,
                                 verbose=False, enable_plotting=False,
                                 drift_terms=['simple'])
            pred, _ = uk.execute('points', x_c, y_c)
            rmse = np.sqrt(mean_squared_error(residuals, pred))
            logger.info(f"  -> {vm}: RMSE={rmse:.4f}")
            
            vp = uk.variogram_model_parameters
            return uk, {'variogram': vm, 'nugget': vp.get('sill', 0)*0.1, 
                       'sill': vp.get('sill', 1), 'range': vp.get('range', 1000)}
        except Exception as e:
            logger.warning(f"  -> Echec {vm}: {e}")
    
    return None, {}


def interpolate_mailles(variogram, all_mailles_df: pd.DataFrame, X_all: np.ndarray,
                       model, scaler, feature_cols) -> np.ndarray:
    logger.info(f"Interpolation sur {len(all_mailles_df)} mailles")
    
    x_m = all_mailles_df['x_utm'].values
    y_m = all_mailles_df['y_utm'].values
    
    X_scaled = scaler.transform(X_all)
    trend = model.predict(X_scaled)
    
    residual_grid = np.zeros(len(x_m))
    indices = np.random.choice(len(x_m), min(5000, len(x_m)), replace=False)
    
    if variogram:
        try:
            pred_res, _ = variogram.execute('points', x_m[indices], y_m[indices])
            residual_grid[indices] = pred_res
        except:
            pass
    
    final = trend + residual_grid
    final = np.clip(final, PHYSICAL_RANGE[0], PHYSICAL_RANGE[1])
    
    logger.info(f"  -> min={final.min():.2f}, max={final.max():.2f}, mean={final.mean():.2f}")
    return final


def store_results(maille_codes: List[str], values: np.ndarray, param_id: str, run_id: str):
    logger.info(f"Stockage {len(values)} valeurs pour {param_id}")
    
    # Stocker sans run_id (laisser NULL) car ce n'est pas un UUID valide
    query = """
    INSERT INTO atlas.ai_interpolation_values
        (id, maille_id, parameter_id, value, method, created_at)
    SELECT gen_random_uuid(), id, %s, %s, 'regression_kriging_scorpan', NOW()
    FROM atlas.mailles WHERE code = %s
    """
    
    with get_db_connection() as conn:
        with conn.cursor() as cur:
            for code, val in zip(maille_codes, values):
                cur.execute(query, (param_id, float(val), code))
            conn.commit()
    
    return len(values)


def run_horizon(horizon: str) -> Dict:
    logger.info(f"=== RK EG HORIZON {horizon} ===")
    
    run_id = f"rk_eg_{horizon}_{datetime.now().strftime('%Y%m%d_%H%M%S')}"
    param_id = f"eg_rk_{horizon.lower()}"
    
    eg_df = extract_eg_terrain_data(horizon)
    if len(eg_df) < 10:
        return {'status': 'insufficient', 'n': len(eg_df)}
    
    scorfan_df = extract_scorpan_features(eg_df['maille_code'].tolist())
    result = prepare_data(eg_df, scorfan_df)
    if result is None:
        return {'status': 'no_merge'}
    
    X_train, y_train, coords, scaler, features = result
    model, reg_metrics = train_regression(X_train, y_train)
    
    y_pred = model.predict(X_train)
    residuals = y_train - y_pred
    
    loo_metrics = perform_loo_cv(coords, residuals)
    variogram, var_metrics = fit_variogram(coords, residuals)
    
    with get_db_connection() as conn:
        all_mailles = pd.read_sql("""
            SELECT code as maille_code, xc_utm31 as x_utm, yc_utm31 as y_utm 
            FROM atlas.mailles WHERE code IS NOT NULL
        """, conn)
    
    all_features = extract_scorpan_features(all_mailles['maille_code'].tolist())
    all_mailles = all_mailles.merge(all_features, on='maille_code', how='left')
    X_all = all_mailles[features].fillna(0).values
    
    values = interpolate_mailles(variogram, all_mailles, X_all, model, scaler, features)
    count = store_results(all_mailles['maille_code'].tolist(), values, param_id, run_id)
    
    logger.info(f"OK {horizon}: {count} valeurs")
    return {'status': 'success', 'param': param_id, 'n_interp': count,
            'reg': reg_metrics, 'loo': loo_metrics, 'var': var_metrics}


def main():
    logger.info("=== ATLAS RG - RK EG ===")
    
    results = {}
    for h in ['H1', 'H2', 'H3']:
        try:
            results[h] = run_horizon(h)
        except Exception as e:
            logger.error(f"Erreur {h}: {e}")
            results[h] = {'status': 'error', 'error': str(e)}
    
    # Resume
    for h, r in results.items():
        if r.get('status') == 'success':
            logger.info(f"{h}: R2={r['reg']['r2_train']:.4f}, LOO_R2={r['loo'].get('r2_loo', 'N/A')}")
    
    # Save
    out = LOG_DIR / f"rk_eg_results_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    with open(out, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    logger.info(f"Sauvegarde: {out}")
    
    return results


if __name__ == '__main__':
    main()