"""
Pipeline Régression Kriging (RK) — Atlas Géotechnique Togo
SUR LES VRAISES DONNÉES TERRAIN (v_echantillons_essais)

Usage:
    python scripts/atlas_regression_kriging_terrain.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean --parameter vbs --horizon h1

 dry-run:
    python scripts/atlas_regression_kriging_terrain.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean --parameter vbs --horizon h1 --dry-run
"""

import sys
import math
import argparse
import warnings
import uuid
from datetime import datetime, timezone
from typing import Tuple, List

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

DEPTH_MAP = {'h1': (0.5, 1.5), 'h2': (1.0, 2.0), 'h3': (1.5, 2.5)}

CLAMP_MAP = {
    'vbs': (0.0, 15.0),
    'eg':  (0.0, 20.0),
    'ip':  (0.0, 60.0),
    'wl':  (10.0, 120.0),
    'wp':  (5.0, 80.0),
}

NUMERIC_FEATURES = ['dem_altitude', 'lon', 'lat', 'prec_annual', 'dem_slope', 'dem_tpi', 'dem_hand', 'distance_river_m']
CATEGORICAL_FEATURES = []

def get_connection(db_url):
    return psycopg2.connect(db_url)

def load_terrain_data(conn, param: str, horizon: str) -> pd.DataFrame:
    """Charge les VRAISES données terrain depuis v_echantillons_essais"""
    depth_min, depth_max = DEPTH_MAP[horizon]
    col_map = {'vbs': 'vbs', 'ip': 'ip', 'wl': 'wl', 'wp': 'wp', 'eg': 'eg'}

    if param not in col_map:
        raise ValueError(f"Paramètre {param} non supporté")

    target_col = col_map[param]

    cur = conn.cursor()
    cur.execute("""
    SELECT
      s.code as sondage_code,
      s.maille_code,
      ST_X(ST_Transform(s.geom, 25231)) as x_utm31,
      ST_Y(ST_Transform(s.geom, 25231)) as y_utm31,
      sc.dem_altitude,
      sc.prec_annual,
      sc.dem_slope,
      sc.dem_tpi,
      sc.dem_hand,
      sc.distance_river_m,
      sc.lon,
      sc.lat,
      e.depth_m,
      e.%s as target
    FROM atlas.v_echantillons_essais e
    JOIN atlas.sondages s ON s.id = e.sondage_id
    JOIN atlas.v_scorpan_features sc ON sc.maille_code = s.maille_code
    WHERE e.%s IS NOT NULL
      AND e.depth_m BETWEEN %%s AND %%s
      AND s.maille_code IS NOT NULL
    """ % (target_col, target_col), (depth_min, depth_max))

    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    df = pd.DataFrame(rows, columns=cols)

    print(f"  Donnees terrain chargees: {len(df)} echantillons ({param}, {horizon}, prof={depth_min}-{depth_max}m)")
    return df[df['target'].notna() & df['x_utm31'].notna()]

def load_all_mailles(conn) -> pd.DataFrame:
    cur = conn.cursor()
    cur.execute("""
    SELECT maille_code, x_utm31, y_utm31, dem_altitude, prec_annual, dem_slope, dem_tpi, dem_hand, distance_river_m, lon, lat
    FROM atlas.v_scorpan_features
    """)
    rows = cur.fetchall()
    cols = [desc[0] for desc in cur.description]
    df = pd.DataFrame(rows, columns=cols)
    print(f"  Mailles chargees: {len(df)}")
    return df

def build_preprocessor(geol_cats: List[str], pedo_cats: List[str]) -> ColumnTransformer:
    numeric_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='median')),
        ('scaler', StandardScaler()),
    ])
    categorical_pipeline = Pipeline([
        ('imputer', SimpleImputer(strategy='constant', fill_value='UNKNOWN')),
        ('onehot', OneHotEncoder(categories=[geol_cats, pedo_cats], handle_unknown='ignore', sparse_output=False)),
    ])
    return ColumnTransformer([
        ('num', numeric_pipeline, NUMERIC_FEATURES),
        ('cat', categorical_pipeline, CATEGORICAL_FEATURES),
    ])

def fit_regression(df_train, geol_cats, pedo_cats):
    X_num = df_train[NUMERIC_FEATURES].astype(float)
    if CATEGORICAL_FEATURES:
        X_cat = df_train[CATEGORICAL_FEATURES].astype(str)
        X = pd.concat([X_num, X_cat], axis=1)
    else:
        X = X_num
    y = df_train['target'].astype(float).values

    if CATEGORICAL_FEATURES:
        preprocessor = build_preprocessor(geol_cats, pedo_cats)
    else:
        preprocessor = Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler()),
        ])
    model = Pipeline([('preprocessor', preprocessor), ('regressor', Ridge(alpha=1.0))])
    model.fit(X, y)

    y_pred = model.predict(X)
    residuals = y - y_pred
    r2 = r2_score(y, y_pred)
    rmse = math.sqrt(mean_squared_error(y, y_pred))
    print(f"  Regression Ridge: R2={r2:.4f}, RMSE={rmse:.4f}")
    return model, residuals, r2, rmse

def loo_cross_validation(df_train, geol_cats, pedo_cats) -> float:
    """Leave-One-Out Cross-Validation - MESURE RÉELLE DE LA PERTE"""
    n = len(df_train)
    if n < 6:
        print(f"  LOO-CV: N={n} < 6, impossible")
        return float('nan')

    all_features = NUMERIC_FEATURES + CATEGORICAL_FEATURES if CATEGORICAL_FEATURES else NUMERIC_FEATURES
    
    errors = []
    for i in range(n):
        train_idx = list(range(n))
        train_idx.remove(i)

        X_train = df_train.iloc[train_idx][all_features]
        y_train = df_train.iloc[train_idx]['target'].values
        X_test = df_train.iloc[i:i+1][all_features]
        y_test = df_train.iloc[i]['target']

        try:
            if CATEGORICAL_FEATURES:
                preprocessor = build_preprocessor(geol_cats, pedo_cats)
            else:
                preprocessor = Pipeline([
                    ('imputer', SimpleImputer(strategy='median')),
                    ('scaler', StandardScaler()),
                ])
            model = Pipeline([('preprocessor', preprocessor), ('regressor', Ridge(alpha=1.0))])
            model.fit(X_train, y_train)

            y_pred = model.predict(X_test)[0]
            errors.append((y_pred - y_test) ** 2)
        except Exception as e:
            pass

    if not errors:
        return float('nan')
    loo_rmse = math.sqrt(sum(errors) / len(errors))
    print(f"  LOO-CV RMSE: {loo_rmse:.4f} ({len(errors)}/{n} points)")
    return loo_rmse

def store_results(conn, df_all, z_rk, param, horizon, loo_rmse, reg_r2, n_terrain):
    clamp_min, clamp_max = CLAMP_MAP.get(param, (0, 100))
    parameter_id = f'{param}_rk_{horizon}'
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    cur = conn.cursor()

    # Marquer les anciens RK comme superseded
    cur.execute("""
    UPDATE atlas.ai_interpolation_values
    SET is_superseded = true
    WHERE parameter_id = %s AND method = 'regression_kriging_scorpan'
    """, (parameter_id,))

    # Insérer le run avec métadonnées
    cur.execute("""
    INSERT INTO atlas.ai_interpolation_runs
      (id, run_type, parameter_id, method, status, metrics, created_at, meta)
    VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
    """, (run_id, 'kriging', parameter_id, 'regression_kriging_scorpan', 'finished',
          psycopg2.extras.Json({'loo_rmse': loo_rmse, 'regression_r2': reg_r2, 'n_terrain_samples': n_terrain}),
          now, psycopg2.extras.Json({'source': 'v_echantillons_essais', 'note': 'trained on real terrain data'})))

    # Insérer les valeurs interpolées
    rows = []
    for i, row in df_all.iterrows():
        val = float(z_rk[i]) if i < len(z_rk) else float('nan')
        val = max(clamp_min, min(clamp_max, val))
        if math.isfinite(val):
            rows.append((str(uuid.uuid4()), row['maille_code'], parameter_id, val, run_id, 'regression_kriging_scorpan', False, now))

    if rows:
        execute_values(cur, """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, parameter_id, value, run_id, method, is_superseded, created_at)
        SELECT data.id::uuid, m.id, data.parameter_id, data.value, data.run_id::uuid, data.method, data.is_superseded, data.created_at
        FROM (VALUES %s) AS data(id, maille_code, parameter_id, value, run_id, method, is_superseded, created_at)
        JOIN atlas.mailles m ON m.code = data.maille_code
        """, rows, template="(%s,%s,%s,%s,%s,%s,%s,%s)")
        conn.commit()
        print(f"  [OK] {len(rows)} valeurs RK stockees (param={parameter_id})")
    return run_id

def main():
    parser = argparse.ArgumentParser(description='Regression Kriging sur DONNEES TERRAIN')
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--parameter', choices=['vbs','eg','ip','wl','wp'], required=True)
    parser.add_argument('--horizon', choices=['h1','h2','h3'], required=True)
    parser.add_argument('--dry-run', action='store_true', help='Mode dry-run: valider config sans executer')
    args = parser.parse_args()

    if args.dry_run:
        print("[DRY-RUN] Validation de la configuration...")
        conn = get_connection(args.database_url)
        cur = conn.cursor()
        cur.execute("SELECT COUNT(*) FROM atlas.v_echantillons_essais WHERE %s IS NOT NULL" % {'vbs': 'vbs', 'ip': 'ip', 'wl': 'wl', 'wp': 'wp'}[args.parameter])
        n = cur.fetchone()[0]
        print(f"  [OK] {n} echantillons {args.parameter} disponibles")
        cur.execute("SELECT COUNT(*) FROM atlas.v_scorpan_features")
        m = cur.fetchone()[0]
        print(f"  [OK] {m} mailles avec covariables SCORPAN")
        conn.close()
        print("[DRY-RUN] Termine - Configuration valide")
        return

    print(f"\n=== REGRESSION KRIGING TERRAIN: {args.parameter.upper()} {args.horizon.upper()} ===")
    print("=== ENTRAINE SUR LES VRAIS MESURES TERRAIN (v_echantillons_essais) ===\n")

    conn = get_connection(args.database_url)

    # Charger les vraies données terrain
    print("Chargement donnees terrain (vraies mesures)...")
    df_terrain = load_terrain_data(conn, args.parameter, args.horizon)
    n_terrain = len(df_terrain)
    if n_terrain < 6:
        print(f"ERREUR: Pas assez de donnees terrain ({n_terrain} < 6)")
        sys.exit(1)

    # Charger toutes les mailles pour interpolation
    print("Chargement mailles pour interpolation...")
    df_all = load_all_mailles(conn)

    # Pas de features catégorielles (utiliser uniquement numériques)
    geol_cats = []
    pedo_cats = []

    # Régression sur les données terrain
    print("Regression Ridge sur covariables SCORPAN...")
    model, residuals, reg_r2, reg_rmse = fit_regression(df_terrain, geol_cats, pedo_cats)

    # LOO-CV pour validation réelle (optionnel)
    print("LOO-Cross-Validation (mesure de la vraie performance)...")
    loo_rmse_raw = loo_cross_validation(df_terrain, geol_cats, pedo_cats)
    loo_rmse = float(loo_rmse_raw) if not math.isnan(loo_rmse_raw) else None

    # Prédiction sur toutes les mailles
    print("Prediction tendance sur 29 407 mailles...")
    X_all = df_all[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
    trend_all = model.predict(X_all)

    # Krigeage des résidus (échantillonné pour mémoire)
    print("Krigeage des residus (echantillon 500 pts)...")
    try:
        from pykrige.ok import OrdinaryKriging
        n_sample = min(500, len(df_terrain))
        idx = np.random.choice(len(df_terrain), n_sample, replace=False)
        ok = OrdinaryKriging(
            df_terrain.iloc[idx]['x_utm31'].values,
            df_terrain.iloc[idx]['y_utm31'].values,
            residuals[idx],
            variogram_model='spherical', nlags=8, weight=True,
            verbose=False, enable_plotting=False
        )
        z_kriged, ss_kriged = ok.execute('points', df_all['x_utm31'].values, df_all['y_utm31'].values)
        z_rk = trend_all + z_kriged.flatten()
    except Exception as e:
        print(f"  Warning: Krigeage simplifie: {e}")
        z_rk = trend_all

    print(f"  RK stats: min={z_rk.min():.2f}, max={z_rk.max():.2f}, mean={z_rk.mean():.2f}")

    # Stockage des résultats
    print("Stockage resultats...")
    run_id = store_results(conn, df_all, z_rk, args.parameter, args.horizon, loo_rmse, reg_r2, n_terrain)

    print(f"\n=== TERMINE ===")
    print(f"  Run ID: {run_id}")
    print(f"  Echantillons terrain: {n_terrain}")
    print(f"  Regression R2: {reg_r2:.4f}")
    print(f"  LOO-CV RMSE: {loo_rmse if loo_rmse else 'N/A'}")

    conn.close()

if __name__ == '__main__':
    main()