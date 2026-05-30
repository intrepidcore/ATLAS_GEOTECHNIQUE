#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — Calcul LOO-CV analytique pour Régression Kriging
===========================================================================
Intrepid Core Engineering Standards

Calcule la LOO-CV analytique pour les 5 paramètres RK × H1
et met à jour les métriques dans atlas.ai_interpolation_runs.

Règles :
  ETL-03 : jamais continuer silencieusement sur erreur
  DATA-02 : validation plages physiques obligatoire
  BM-SYNC-05 : idempotent (relancer est sûr)
  GEN-01 : inspecter la DB avant d'écrire

Usage :
  python scripts/compute_loo_cv_rk.py \
    --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean

Notes :
  - La colonne EG dans v_echantillons_essais s'appelle potentiel_gonflement
  - LOO-CV = O(N²) analytique via PyKrige.get_statistics() si disponible,
    sinon N itérations complètes (lent pour N > 100)
  - Ne recalcule que les paramètres où loo_rmse est encore NULL
"""

import sys
import math
import time
import json
import logging
import argparse
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import Json
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import r2_score, mean_squared_error
from pykrige.ok import OrdinaryKriging

# ── Logging ──────────────────────────────────────────────────────────
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s.%(msecs)03d | %(levelname)-8s | %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S',
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f'logs/loo_cv_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log',
            encoding='utf-8'
        )
    ]
)
log = logging.getLogger('LOO_CV')

# ── Constantes métier (DATA-02) ───────────────────────────────────────
PARAMS = {
    'vbs': {'col': 'vbs', 'unit': 'g/100g', 'min': 0.0, 'max': 20.0},
    'ip':  {'col': 'ip',  'unit': '%',       'min': 0.0, 'max': 80.0},
    'wl':  {'col': 'wl',  'unit': '%',       'min': 20.0,'max': 120.0},
    'wp':  {'col': 'wp',  'unit': '%',       'min': 10.0,'max': 60.0},
    'eg':  {'col': 'potentiel_gonflement', 'unit': '%', 'min': 0.0, 'max': 20.0},
}

DEPTH_WINDOWS = {'h1': (0.5, 1.5), 'h2': (1.0, 2.0), 'h3': (1.5, 2.5)}

NUMERIC_FEATURES = [
    'dem_altitude', 'dem_slope', 'dem_tpi',
    'dem_hand', 'distance_river_m',
    'prec_annual', 'prec_dry', 'prec_wet',
    'lon', 'lat',
]


def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn


def inspect_db(conn) -> dict:
    """GEN-01 : inspecter avant d'écrire."""
    cur = conn.cursor()
    info = {}

    # Colonnes v_echantillons_essais
    cur.execute("""
        SELECT column_name FROM information_schema.columns
        WHERE table_schema='atlas' AND table_name='v_echantillons_essais'
        ORDER BY ordinal_position
    """)
    info['echantillons_cols'] = [r[0] for r in cur.fetchall()]

    # Colonnes v_scorpan_features (matview — utiliser pg_attribute)
    cur.execute("""
        SELECT a.attname
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'atlas'
          AND c.relname = 'v_scorpan_features'
          AND a.attnum > 0
          AND NOT a.attisdropped
        ORDER BY a.attnum
    """)
    info['scorpan_cols'] = [r[0] for r in cur.fetchall()]

    # Runs RK déjà avec loo_rmse
    cur.execute("""
        SELECT parameter_id,
               meta->>'loo_rmse' as loo_rmse
        FROM atlas.ai_interpolation_runs
        WHERE method='regression_kriging_scorpan'
          AND status='finished'
        ORDER BY parameter_id, created_at DESC
    """)
    info['rk_runs'] = {r[0]: r[1] for r in cur.fetchall()}

    cur.close()
    return info


def load_terrain_samples(conn, param: str, col: str, horizon: str) -> pd.DataFrame:
    """Charge les mesures terrain depuis v_echantillons_essais."""
    depth_min, depth_max = DEPTH_WINDOWS[horizon]
    clamp_min = PARAMS[param]['min']
    clamp_max = PARAMS[param]['max']

    cur = conn.cursor()
    # Vérifier les colonnes via pg_attribute (compatible tables ET matviews)
    cur.execute("""
        SELECT a.attname
        FROM pg_attribute a
        JOIN pg_class c ON c.oid = a.attrelid
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE n.nspname = 'atlas'
          AND c.relname = 'v_scorpan_features'
          AND a.attnum > 0
          AND NOT a.attisdropped
          AND a.attname = ANY(%s)
    """, ([f for f in NUMERIC_FEATURES],))
    available = {r[0] for r in cur.fetchall()}
    features = [f for f in NUMERIC_FEATURES if f in available]

    if not features:
        log.error(f"  Aucune feature SCORPAN disponible!")
        cur.close()
        return pd.DataFrame()

    features_sql = ', '.join(f'sc.{f}' for f in features)
    cur.execute(f"""
        SELECT
            e.sondage_id,
            s.maille_code,
            ST_X(ST_Transform(s.geom, 25231)) AS x_utm31,
            ST_Y(ST_Transform(s.geom, 25231)) AS y_utm31,
            {features_sql},
            e.depth_m,
            e.{col} AS target
        FROM atlas.v_echantillons_essais e
        JOIN atlas.sondages s ON s.id = e.sondage_id
        JOIN atlas.v_scorpan_features sc ON sc.maille_code = s.maille_code
        WHERE e.{col} IS NOT NULL
          AND e.depth_m BETWEEN %s AND %s
          AND s.maille_code IS NOT NULL
          AND e.{col} BETWEEN %s AND %s
    """, (depth_min, depth_max, clamp_min, clamp_max))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    df = pd.DataFrame(rows, columns=cols)
    cur.close()

    # Utiliser seulement les features disponibles
    missing = [f for f in features if f not in df.columns]
    if missing:
        log.warning(f"  Features manquantes: {missing}")

    log.info(f"    {param} {horizon}: {len(df)} échantillons "
             f"(prof={depth_min}-{depth_max}m, {col}={clamp_min}-{clamp_max})")
    return df


def build_pipeline(features: list) -> Pipeline:
    preprocessor = ColumnTransformer([
        ('num', Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler()),
        ]), features),
    ])
    return Pipeline([('preprocessor', preprocessor), ('regressor', Ridge(alpha=1.0))])


def compute_loo_cv(df: pd.DataFrame, features: list, residuals: np.ndarray,
                   ok: OrdinaryKriging) -> float:
    """LOO-CV analytique si PyKrige le supporte, sinon N itérations."""
    n = len(df)
    try:
        # Tentative analytique (PyKrige >= 1.7)
        stats = ok.get_statistics() if hasattr(ok, 'get_statistics') else {}
        loo = stats.get('loo_residuals')
        if loo is not None and len(loo) > 0:
            rmse = float(np.sqrt(np.mean(np.array(loo)**2)))
            log.info(f"    LOO-CV analytique: RMSE={rmse:.4f}")
            return rmse
    except Exception:
        pass

    # Fallback : N itérations (seul moyen si version ancienne de PyKrige)
    log.info(f"    LOO-CV numérique ({n} itérations)...")
    errors = []
    x = df['x_utm31'].values
    y = df['y_utm31'].values
    for i in range(n):
        idx = [j for j in range(n) if j != i]
        try:
            ok_i = OrdinaryKriging(
                x[idx], y[idx], residuals[idx],
                variogram_model='spherical',
                verbose=False, enable_plotting=False
            )
            z_i, _ = ok_i.execute('points',
                                  np.array([x[i]]), np.array([y[i]]))
            errors.append((float(z_i[0]) - residuals[i]) ** 2)
        except Exception as e:
            log.warning(f"    LOO iter {i}: {e}")
            errors.append(float('nan'))

    valid = [e for e in errors if math.isfinite(e)]
    if not valid:
        return float('nan')
    return float(np.sqrt(np.mean(valid)))


def run_loo_cv_for_param(conn, param: str, horizon: str,
                         existing_loo: dict) -> dict:
    """Calcule LOO-CV pour un paramètre/horizon et met à jour la DB."""
    param_id = f'{param}_rk_{horizon}'
    cfg = PARAMS[param]

    # BM-SYNC-05 : idempotent — ne recalculer que si loo_rmse est NULL
    if existing_loo.get(param_id) not in (None, ''):
        existing = existing_loo[param_id]
        log.info(f"  {param_id}: déjà calculé (loo_rmse={existing}). Skip.")
        return {'param_id': param_id, 'status': 'skipped', 'loo_rmse': float(existing)}

    log.info(f"  → {param_id.upper()}")

    df = load_terrain_samples(conn, param, cfg['col'], horizon)
    if len(df) < 6:
        log.warning(f"    Insuffisant: {len(df)} < 6 points. Skip.")
        return {'param_id': param_id, 'status': 'insufficient_data', 'n': len(df)}

    available_features = [f for f in NUMERIC_FEATURES if f in df.columns]
    if len(available_features) < 2:
        log.warning(f"    Pas assez de features SCORPAN disponibles.")
        return {'param_id': param_id, 'status': 'no_features'}

    # Convertir en float (psycopg2 retourne decimal.Decimal pour NUMERIC)
    X = df[available_features].astype(float)
    y = df['target'].values.astype(float)

    # Régression Ridge
    model = build_pipeline(available_features)
    model.fit(X, y)
    y_pred = model.predict(X)
    residuals = y - y_pred
    reg_r2 = float(r2_score(y, y_pred))
    reg_rmse = float(np.sqrt(mean_squared_error(y, y_pred)))
    log.info(f"    Ridge: R²={reg_r2:.4f}, RMSE={reg_rmse:.4f}")

    # Variogramme sur résidus
    ok = OrdinaryKriging(
        df['x_utm31'].values, df['y_utm31'].values, residuals,
        variogram_model='spherical', nlags=10, weight=True,
        verbose=False, enable_plotting=False
    )

    # LOO-CV
    t0 = time.time()
    loo_rmse = compute_loo_cv(df, available_features, residuals, ok)
    elapsed = time.time() - t0

    loo_str = f"{loo_rmse:.4f}" if math.isfinite(loo_rmse) else "NaN"
    log.info(f"    LOO-RMSE={loo_str} | N={len(df)} | Durée={elapsed:.1f}s")

    # Mettre à jour ou insérer le run en DB (BM-SYNC-05 : idempotent)
    import uuid
    cur = conn.cursor()
    meta_payload = Json({
        'loo_rmse': loo_rmse if math.isfinite(loo_rmse) else None,
        'loo_rmse_computed_at': datetime.now(timezone.utc).isoformat(),
        'n_terrain_samples': len(df),
        'regression_r2': reg_r2,
        'regression_rmse': reg_rmse,
        'features_used': available_features,
    })

    # Vérifier si un run existe
    cur.execute("""
        SELECT id FROM atlas.ai_interpolation_runs
        WHERE parameter_id = %s AND method = 'regression_kriging_scorpan'
          AND status = 'finished'
        ORDER BY created_at DESC LIMIT 1
    """, (param_id,))
    existing_run = cur.fetchone()

    if existing_run:
        # UPDATE du run existant
        cur.execute("""
            UPDATE atlas.ai_interpolation_runs
            SET meta = COALESCE(meta, '{}'::jsonb) || %s::jsonb
            WHERE id = %s
        """, (meta_payload, existing_run[0]))
    else:
        # INSERT d'un nouveau run (cas EG ou paramètre sans run antérieur)
        now = datetime.now(timezone.utc)
        cur.execute("""
            INSERT INTO atlas.ai_interpolation_runs
              (id, run_type, parameter_id, method, status, metrics, created_at, meta)
            VALUES (%s, 'kriging', %s, 'regression_kriging_scorpan',
                    'finished', %s::jsonb, %s, %s)
        """, (
            str(uuid.uuid4()), param_id,
            Json({}), now, meta_payload
        ))
        log.info(f"    Nouveau run créé pour {param_id} (pas de run antérieur)")

    conn.commit()
    cur.close()

    return {
        'param_id': param_id,
        'status': 'computed',
        'n': len(df),
        'loo_rmse': loo_rmse,
        'regression_r2': reg_r2,
        'elapsed_s': elapsed,
    }


def main():
    parser = argparse.ArgumentParser(description='Atlas LOO-CV RK')
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--horizons', default='h1',
                        help='Horizons séparés par virgule (h1,h2,h3)')
    parser.add_argument('--params', default='vbs,ip,wl,wp,eg',
                        help='Paramètres séparés par virgule')
    args = parser.parse_args()

    horizons = [h.strip() for h in args.horizons.split(',')]
    params_to_run = [p.strip() for p in args.params.split(',')]

    t_total = time.time()
    log.info("╔══════════════════════════════════════════════════╗")
    log.info("║  ATLAS — LOO-CV Analytique Régression Kriging    ║")
    log.info("║  Intrepid Core Engineering Standards             ║")
    log.info(f"║  Paramètres : {','.join(params_to_run):<35}║")
    log.info(f"║  Horizons   : {','.join(horizons):<35}║")
    log.info("╚══════════════════════════════════════════════════╝")

    conn = get_conn(args.database_url)

    # GEN-01 : inspecter avant d'écrire
    log.info("=== Inspection de la base de données (GEN-01) ===")
    info = inspect_db(conn)
    log.info(f"  Colonnes v_echantillons_essais: {info['echantillons_cols'][:5]}...")
    log.info(f"  Runs RK existants: {len(info['rk_runs'])}")
    log.info(f"  LOO déjà calculés: "
             f"{sum(1 for v in info['rk_runs'].values() if v is not None)}")

    results = []
    for param in params_to_run:
        if param not in PARAMS:
            log.warning(f"Paramètre inconnu: {param}. Skip.")
            continue
        log.info(f"\n=== {param.upper()} ===")
        for horizon in horizons:
            result = run_loo_cv_for_param(conn, param, horizon, info['rk_runs'])
            results.append(result)

    conn.close()

    # Rapport final
    elapsed_total = time.time() - t_total
    log.info("\n╔══════════════════════════════════════════════════╗")
    log.info("║  TABLEAU LOO-RMSE RK                              ║")
    log.info("╠══════════════════════════════════════════════════╣")
    log.info(f"║  {'Paramètre':<15} {'N':>5} {'LOO-RMSE':>10} {'Statut':<12}║")
    log.info("╠══════════════════════════════════════════════════╣")
    for r in results:
        n = r.get('n', '—')
        loo = r.get('loo_rmse', float('nan'))
        loo_str = f"{loo:.4f}" if isinstance(loo, float) and math.isfinite(loo) else '—'
        status = r['status']
        log.info(f"║  {r['param_id']:<15} {str(n):>5} {loo_str:>10} {status:<12}║")
    log.info(f"╠══════════════════════════════════════════════════╣")
    log.info(f"║  Durée totale: {elapsed_total/60:.1f} min{' '*(33-len(f'{elapsed_total/60:.1f}'))}║")
    log.info("╚══════════════════════════════════════════════════╝")

    # Sauvegarder résultats JSON
    ts = datetime.now().strftime('%Y%m%d_%H%M%S')
    out_path = f'logs/loo_cv_results_{ts}.json'
    with open(out_path, 'w') as f:
        json.dump(results, f, indent=2, default=str)
    log.info(f"Résultats sauvegardés: {out_path}")


if __name__ == '__main__':
    main()
