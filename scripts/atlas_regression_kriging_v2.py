"""
Pipeline Régression Kriging (RK) v2 — utilise les données KED existantes
pour l'entraînement au lieu des sondages bruts.

Usage:
    python scripts/atlas_regression_kriging_v2.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean --parameter vbs --horizon h1
"""

import sys
import math
import argparse
import warnings
import uuid
from datetime import datetime, timezone
from typing import List

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from sklearn.linear_model import Ridge
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score

warnings.filterwarnings('ignore')

DEPTH_MAP = {'h1': 1.0, 'h2': 1.5, 'h3': 2.0}

CLAMP_MAP = {
    'vbs': (0.0, 15.0),
    'eg':  (0.0, 20.0),
    'ip':  (0.0, 60.0),
    'wl':  (10.0, 120.0),
    'wp':  (5.0, 80.0),
}

NUMERIC_FEATURES = ['altitude_mean', 'lon_wgs84', 'lat_wgs84', 'prec_annual', 'bio15', 'bio12', 'bio17']
CATEGORICAL_FEATURES = ['geol_code', 'pedo_code']

def get_connection(db_url):
    return psycopg2.connect(db_url)

def load_ked_training_data(conn, param: str, horizon: str) -> pd.DataFrame:
    ked_param = f'{param}_ked_{horizon}'
    cur = conn.cursor()
    cur.execute("""
    SELECT
      m.code as maille_code,
      m.xc_utm31 as x_utm31,
      m.yc_utm31 as y_utm31,
      v.value as target,
      sc.altitude_mean,
      sc.prec_annual,
      sc.bio15,
      sc.bio12,
      sc.bio17,
      sc.lon_wgs84,
      sc.lat_wgs84,
      COALESCE(sc.geol_code, 'UNKNOWN') AS geol_code,
      COALESCE(sc.pedo_code, 'UNKNOWN') AS pedo_code
    FROM atlas.ai_interpolation_values v
    JOIN atlas.mailles m ON m.id = v.maille_id
    JOIN atlas.v_scorpan_features sc ON sc.maille_code = m.code
    WHERE v.parameter_id = %s
      AND v.method = 'ked_pedologie_ked'
      AND v.value IS NOT NULL
      AND COALESCE(v.is_superseded, false) = false
    """, (ked_param,))
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    df = pd.DataFrame(rows, columns=cols)
    print(f"  Donnees KED chargees: {len(df)} points (param={param}, horizon={horizon})")
    return df

def load_all_mailles(conn) -> pd.DataFrame:
    cur = conn.cursor()
    cur.execute("""
    SELECT maille_code, x_utm31, y_utm31, altitude_mean, prec_annual, bio15, bio12, bio17,
           lon_wgs84, lat_wgs84,
           COALESCE(geol_code, 'UNKNOWN') AS geol_code,
           COALESCE(pedo_code, 'UNKNOWN') AS pedo_code
    FROM atlas.v_scorpan_features
    """)
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    df = pd.DataFrame(rows, columns=cols)
    print(f"  Mailles chargees: {len(df)}")
    return df

def build_preprocessor(geol_cats: List[str], pedo_cats: List[str]) -> ColumnTransformer:
    from sklearn.pipeline import Pipeline
    numeric_pipeline = Pipeline([('imputer', SimpleImputer(strategy='median')), ('scaler', StandardScaler())])
    categorical_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value='UNKNOWN')),
        ('onehot', OneHotEncoder(categories=[geol_cats, pedo_cats], handle_unknown='ignore', sparse_output=False)),
    ])
    return ColumnTransformer([('num', numeric_pipeline, NUMERIC_FEATURES), ('cat', categorical_pipeline, CATEGORICAL_FEATURES)])

def fit_regression(df_train, geol_cats, pedo_cats):
    X = df_train[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    y = df_train['target'].values
    preprocessor = build_preprocessor(geol_cats, pedo_cats)
    model = Pipeline([('preprocessor', preprocessor), ('regressor', Ridge(alpha=1.0))])
    model.fit(X, y)
    y_pred = model.predict(X)
    residuals = y - y_pred
    r2 = r2_score(y, y_pred)
    rmse = math.sqrt(mean_squared_error(y, y_pred))
    print(f"  Regression: R2={r2:.3f}, RMSE={rmse:.3f}")
    return model, residuals, r2, rmse

def store_results(conn, df_all, z_rk, param, horizon, reg_r2):
    clamp_min, clamp_max = CLAMP_MAP[param]
    parameter_id = f'{param}_rk_{horizon}'
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    cur = conn.cursor()
    cur.execute("UPDATE atlas.ai_interpolation_values SET is_superseded = true WHERE parameter_id = %s AND method = 'regression_kriging_scorpan'", (parameter_id,))
    cur.execute("INSERT INTO atlas.ai_interpolation_runs (id, run_type, parameter_id, method, status, metrics, created_at, meta) VALUES (%s, %s, %s, %s, %s, %s, %s, %s)",
                (run_id, 'kriging', parameter_id, 'regression_kriging_scorpan', 'finished', '{}', now, psycopg2.extras.Json({'regression_r2': reg_r2})))
    rows = []
    for i, row in df_all.iterrows():
        val = float(z_rk[i]) if i < len(z_rk) else float('nan')
        val = max(clamp_min, min(clamp_max, val))
        if math.isfinite(val):
            rows.append((str(uuid.uuid4()), row['maille_code'], parameter_id, val, run_id, 'regression_kriging_scorpan', False, now))
    if rows:
        execute_values(cur, """
        INSERT INTO atlas.ai_interpolation_values (id, maille_id, parameter_id, value, run_id, method, is_superseded, created_at)
        SELECT data.id::uuid, m.id, data.parameter_id, data.value, data.run_id::uuid, data.method, data.is_superseded, data.created_at
        FROM (VALUES %s) AS data(id, maille_code, parameter_id, value, run_id, method, is_superseded, created_at)
        JOIN atlas.mailles m ON m.code = data.maille_code
        """, rows, template="(%s,%s,%s,%s,%s,%s,%s,%s)")
        conn.commit()
        print(f"  [OK] {len(rows)} valeurs RK stockees")
    return run_id

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--parameter', choices=['vbs','eg','ip','wl','wp'], required=True)
    parser.add_argument('--horizon', choices=['h1','h2','h3'], required=True)
    args = parser.parse_args()
    print(f"\n=== REGRESSION KRIGING: {args.parameter.upper()} {args.horizon.upper()} ===\n")
    conn = get_connection(args.database_url)
    df_train = load_ked_training_data(conn, args.parameter, args.horizon)
    if len(df_train) < 6:
        print(f"ERREUR: Pas assez de donnees ({len(df_train)} < 6)")
        sys.exit(1)
    df_all = load_all_mailles(conn)
    geol_cats = sorted(df_all['geol_code'].dropna().unique().tolist())
    pedo_cats = sorted(df_all['pedo_code'].dropna().unique().tolist())
    print("Regression Ridge...")
    model, residuals, reg_r2, reg_rmse = fit_regression(df_train, geol_cats, pedo_cats)
    print("Prediction tendance...")
    X_all = df_all[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    trend_all = model.predict(X_all)
    print("Krigeage residus (echantillon pour memoire)...")
    try:
        from pykrige.ok import OrdinaryKriging
        n_sample = min(500, len(df_train))
        idx = np.random.choice(len(df_train), n_sample, replace=False)
        ok = OrdinaryKriging(df_train.iloc[idx]['x_utm31'].values, df_train.iloc[idx]['y_utm31'].values, residuals[idx],
                              variogram_model='spherical', nlags=8, weight=True, verbose=False, enable_plotting=False)
        z_kriged, _ = ok.execute('points', df_all['x_utm31'].values, df_all['y_utm31'].values)
        z_rk = trend_all + z_kriged.flatten()
    except Exception as e:
        print(f"  Warning: Krigeage simplifie: {e}")
        z_rk = trend_all
    print(f"  RK stats: min={z_rk.min():.2f}, max={z_rk.max():.2f}, mean={z_rk.mean():.2f}")
    run_id = store_results(conn, df_all, z_rk, args.parameter, args.horizon, reg_r2)
    print(f"\n=== TERMINE run_id={run_id} R2={reg_r2:.4f} ===")
    conn.close()

if __name__ == '__main__':
    main()