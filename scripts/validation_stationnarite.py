#!/usr/bin/env python3
"""
A8 — Test de Stationnarité des Résidus KED (Indice de Moran I)
===============================================================
Artefact A8 du plan de révision directeur (POINTS_REVISION_PROCHAINE_ITERATION_V2.md §3.5).

Test l'hypothèse de stationnarité des résidus du krigeage après dérive pédologique.
Le directeur a demandé : "aucun test (type Dickey-Fuller spatial) n'est présenté".

Méthode :
  1. Charger les prédictions KED et les observations pour un paramètre/horizon
  2. Calculer les résidus : résidu_i = obs_i - pred_i
  3. Calculer l'indice de Moran I sur les résidus (avec matrice de poids spatial)
  4. Tester la significativité (test de permutation, 999 itérations)
  5. Analyse supplémentaire : variance des résidus par moitié N/S

Interpétation de Moran I :
  I ≈ 0    → résidus spatialement aléatoires → stationnarité confirmée
  I > 0    → autocorrélation positive → résidus spatialement groupés → non-stationnarité
  I < 0    → autocorrélation négative

Usage :
    python scripts/validation_stationnarite.py \
        --database-url postgres://atlas:atlas@host.docker.internal:5433/atlas_clean \
        --params vbs,ip \
        --horizons h1

Référence :
    Moran, P.A.P. (1950). "Notes on Continuous Stochastic Phenomena." Biometrika 37, 17-23.
    Le Bivand, R. et al. (2013). Applied Spatial Data Analysis with R.
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
    from scipy.spatial import distance_matrix
    from scipy import stats
    HAS_SCIPY = True
except ImportError:
    HAS_SCIPY = False
    print("[WARN] scipy non disponible")

DB_DEFAULT = os.environ.get("DATABASE_URL",
                            "postgresql://atlas:atlas@host.docker.internal:5433/atlas_clean")

HORIZON_DEPTH = {'h1': 1.0, 'h2': 1.5, 'h3': 2.0}


def load_residuals(conn, param: str, horizon: str) -> Optional[Dict]:
    """
    Charge les résidus KED (obs - pred) depuis la DB.
    Nécessite que les prédictions KED-H soient disponibles dans ai_interpolation_values.
    """
    depth = HORIZON_DEPTH.get(horizon)
    if depth is None:
        return None

    cur = conn.cursor()
    parameter_id = f"{param}_ked_{horizon}"

    # Charger les prédictions KED depuis ai_interpolation_values
    # Note : la colonne est 'maille_id' (UUID → text) et 'value' (pas predicted_value)
    try:
        cur.execute("""
        SELECT
            m.code AS maille_code,
            v.value,
            v.variance,
            ST_Y(ST_Transform(ST_Centroid(m.geom),4326))::float8 AS lat,
            ST_X(ST_Transform(ST_Centroid(m.geom),4326))::float8 AS lon
        FROM atlas.ai_interpolation_values v
        JOIN atlas.mailles m ON m.id = v.maille_id::uuid
        WHERE v.parameter_id = %s
          AND v.method = 'ked_hierarchical_5levels'
          AND COALESCE(v.is_superseded, false) = false
          AND v.value IS NOT NULL
        ORDER BY lat, lon
        LIMIT 29407
        """, (parameter_id,))
    except Exception as ex:
        conn.rollback()
        print(f"  [WARN] {ex}")
        return None

    preds_rows = cur.fetchall()
    if not preds_rows:
        # Essayer aussi avec method = 'ked_pedological_prior' (ancien nom)
        cur.execute("""
        SELECT
            m.code AS maille_code,
            v.value,
            v.variance,
            ST_Y(ST_Transform(ST_Centroid(m.geom),4326))::float8 AS lat,
            ST_X(ST_Transform(ST_Centroid(m.geom),4326))::float8 AS lon
        FROM atlas.ai_interpolation_values v
        JOIN atlas.mailles m ON m.id = v.maille_id::uuid
        WHERE v.parameter_id = %s
          AND v.method LIKE 'ked_%'
          AND COALESCE(v.is_superseded, false) = false
          AND v.value IS NOT NULL
        ORDER BY lat, lon
        LIMIT 29407
        """, (parameter_id,))
        preds_rows = cur.fetchall()

    if not preds_rows:
        print(f"  [SKIP] Aucune prédiction KED pour {parameter_id}")
        return None

    preds_df = {r[0]: (r[1], r[2], r[3], r[4]) for r in preds_rows}

    # Charger les observations terrain
    if param == 'vbs':
        obs_sql = """
        SELECT s.maille_code,
               ST_Y(ST_Transform(s.geom,4326))::float8 AS lat,
               ST_X(ST_Transform(s.geom,4326))::float8 AS lon,
               ev.vbs::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_vbs ev ON ev.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ev.vbs IS NOT NULL
          AND s.maille_code IS NOT NULL
        """
    elif param == 'ip':
        obs_sql = """
        SELECT s.maille_code,
               ST_Y(ST_Transform(s.geom,4326))::float8 AS lat,
               ST_X(ST_Transform(s.geom,4326))::float8 AS lon,
               COALESCE(ea.ip_generated,(ea.wl-ea.wp))::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL
          AND COALESCE(ea.ip_generated,(ea.wl-ea.wp)) IS NOT NULL
          AND s.maille_code IS NOT NULL
        """
    elif param == 'wl':
        obs_sql = """
        SELECT s.maille_code,
               ST_Y(ST_Transform(s.geom,4326))::float8,
               ST_X(ST_Transform(s.geom,4326))::float8,
               ea.wl::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ea.wl IS NOT NULL AND s.maille_code IS NOT NULL
        """
    elif param == 'wp':
        obs_sql = """
        SELECT s.maille_code,
               ST_Y(ST_Transform(s.geom,4326))::float8,
               ST_X(ST_Transform(s.geom,4326))::float8,
               ea.wp::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND ea.wp IS NOT NULL AND s.maille_code IS NOT NULL
        """
    elif param == 'eg':
        obs_sql = """
        SELECT s.maille_code,
               ST_Y(ST_Transform(s.geom,4326))::float8,
               ST_X(ST_Transform(s.geom,4326))::float8,
               epg.cg::float8
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id=s.id AND e.depth_m=%s
        JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id=e.id
        WHERE s.deleted_at IS NULL AND epg.cg IS NOT NULL AND s.maille_code IS NOT NULL
        """
    else:
        return None

    try:
        cur.execute(obs_sql, (depth,))
        obs_rows = cur.fetchall()
    except Exception as ex:
        conn.rollback()
        print(f"  [WARN] Erreur chargement obs {param}/{horizon}: {ex}")
        return None

    # Calculer les résidus (jointure sur maille_code)
    residuals = []
    lats, lons = [], []

    for mcode, lat_obs, lon_obs, val_obs in obs_rows:
        if mcode in preds_df:
            pred_val = preds_df[mcode][0]
            if pred_val is not None and val_obs is not None:
                resid = float(val_obs) - float(pred_val)
                if math.isfinite(resid):
                    residuals.append(resid)
                    lats.append(float(lat_obs))
                    lons.append(float(lon_obs))

    if len(residuals) < 10:
        print(f"  [SKIP] Trop peu de résidus calculables: {len(residuals)}")
        return None

    return {
        'residuals': np.array(residuals),
        'lats': np.array(lats),
        'lons': np.array(lons),
        'n': len(residuals),
    }


def moran_i(residuals: np.ndarray, lats: np.ndarray, lons: np.ndarray,
            bandwidth_km: float = 150.0, n_permutations: int = 999) -> Dict:
    """
    Calcule l'indice de Moran I avec matrice de poids spatial basée sur la distance.

    Poids : w_ij = exp(-d_ij / bandwidth) si d_ij < 3*bandwidth, 0 sinon.
    (Noyau gaussien tronqué)

    Arguments :
        bandwidth_km : portée du noyau en km (défaut 150 = ~portée variogramme VBS)
        n_permutations : nombre de permutations pour le test de significativité
    """
    if not HAS_SCIPY:
        return {'error': 'scipy non disponible'}

    n = len(residuals)
    coords = np.column_stack([lons, lats])

    # Matrice de distances (en degrés → convertir en km approximatif)
    # 1° lat ≈ 111 km, 1° lon ≈ 111*cos(lat_moy) km
    lat_moy = lats.mean()
    cos_lat = math.cos(math.radians(lat_moy))
    coords_km = np.column_stack([lons * 111.0 * cos_lat, lats * 111.0])

    # Distance matrix
    D = distance_matrix(coords_km, coords_km)
    np.fill_diagonal(D, np.inf)  # éviter w_ii

    # Matrice de poids gaussienne tronquée
    W = np.exp(-D / bandwidth_km)
    W[D > 3 * bandwidth_km] = 0.0  # troncature
    np.fill_diagonal(W, 0.0)

    # Normaliser chaque ligne
    row_sums = W.sum(axis=1, keepdims=True)
    row_sums[row_sums == 0] = 1
    W_norm = W / row_sums

    # Moran I
    z = residuals - residuals.mean()
    I = float((z @ W_norm @ z) / (z @ z) * n)

    # Test de permutation (sous H0 : données aléatoires)
    I_perm = np.zeros(n_permutations)
    for k in range(n_permutations):
        z_perm = np.random.permutation(z)
        I_perm[k] = float((z_perm @ W_norm @ z_perm) / (z_perm @ z_perm) * n)

    p_value = float(np.mean(np.abs(I_perm) >= abs(I)))
    I_expected = -1.0 / (n - 1)

    return {
        'moran_I': round(I, 6),
        'expected_I': round(I_expected, 6),
        'p_value': round(p_value, 4),
        'n': int(n),
        'bandwidth_km': bandwidth_km,
        'n_permutations': n_permutations,
        'interpretation': (
            'AUTOCORRÉLATION POSITIVE → résidus spatialement groupés → non-stationnarité possible'
            if I > 0.1 and p_value < 0.05
            else 'Pas d\'autocorrélation significative → stationnarité raisonnable'
            if p_value >= 0.05
            else 'AUTOCORRÉLATION NÉGATIVE → résidus dispersés'
        ),
    }


def variance_ns_test(residuals: np.ndarray, lats: np.ndarray) -> Dict:
    """
    Teste si la variance des résidus diffère entre moitié nord et moitié sud.
    Utilise le test de Levene (robuste à la non-normalité).
    """
    median_lat = np.median(lats)
    south = residuals[lats <= median_lat]
    north = residuals[lats > median_lat]

    if len(south) < 5 or len(north) < 5:
        return {'error': 'Trop peu de points dans une moitié'}

    stat, p_val = stats.levene(south, north)

    return {
        'var_south': round(float(np.var(south)), 4),
        'var_north': round(float(np.var(north)), 4),
        'n_south': int(len(south)),
        'n_north': int(len(north)),
        'levene_stat': round(float(stat), 4),
        'levene_pvalue': round(float(p_val), 4),
        'median_lat_split': round(float(median_lat), 4),
        'interpretation': (
            'HÉTÉROSCÉDASTICITÉ N/S détectée → résidus non-stationnaires'
            if p_val < 0.05
            else 'Variance homogène N/S → stationnarité confirmée pour la variance'
        ),
    }


def store_stationarity_result(conn, param: str, horizon: str,
                               moran_result: Dict, ns_result: Dict) -> None:
    """Stocke les résultats dans ai_spatial_validation_runs."""
    cur = conn.cursor()
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    metrics = {
        'moran_i': moran_result,
        'variance_ns': ns_result,
    }

    cur.execute("""
    INSERT INTO atlas.ai_spatial_validation_runs
      (id, validation_type, parameter_id, train_zone_code, test_zone_code, metrics, created_at)
    VALUES (%s, %s, %s, %s, %s, %s, %s)
    """, (
        run_id, 'stationarity_moran_i',
        f"{param}_ked_{horizon}",
        'TOGO_FULL', 'TOGO_FULL',
        psycopg2.extras.Json(metrics),
        now,
    ))
    conn.commit()


def main():
    ap = argparse.ArgumentParser(description="A8 — Test de stationnarité des résidus KED")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--params", default="vbs,ip")
    ap.add_argument("--horizons", default="h1")
    ap.add_argument("--bandwidth-km", type=float, default=150.0,
                    help="Portée du noyau gaussien pour le Moran I (en km)")
    ap.add_argument("--n-perm", type=int, default=999,
                    help="Nombre de permutations pour le test de significativité")
    args = ap.parse_args()

    params   = [p.strip() for p in args.params.split(',') if p.strip()]
    horizons = [h.strip() for h in args.horizons.split(',') if h.strip()]

    conn = psycopg2.connect(args.database_url)
    summary = []

    for param in params:
        for horizon in horizons:
            print(f"\n{'─'*60}")
            print(f"Test stationnarité résidus KED : {param.upper()} {horizon.upper()}")

            result = load_residuals(conn, param, horizon)
            if result is None:
                continue

            resid = result['residuals']
            lats  = result['lats']
            lons  = result['lons']

            print(f"  N résidus = {result['n']}")
            print(f"  Résidu moyen = {resid.mean():.4f}, std = {resid.std():.4f}")
            print(f"  Calcul Moran I (bande={args.bandwidth_km}km, {args.n_perm} perm.)...")

            moran_result = moran_i(resid, lats, lons,
                                   bandwidth_km=args.bandwidth_km,
                                   n_permutations=args.n_perm)
            ns_result    = variance_ns_test(resid, lats)

            if 'error' not in moran_result:
                print(f"  Moran I = {moran_result['moran_I']:.6f} "
                      f"(E[I]={moran_result['expected_I']:.6f}, p={moran_result['p_value']:.4f})")
                print(f"  {moran_result['interpretation']}")

            if 'error' not in ns_result:
                print(f"  Var(Sud)={ns_result['var_south']:.4f}, "
                      f"Var(Nord)={ns_result['var_north']:.4f}, "
                      f"Levene p={ns_result['levene_pvalue']:.4f}")
                print(f"  {ns_result['interpretation']}")

            store_stationarity_result(conn, param, horizon, moran_result, ns_result)
            summary.append({
                'param': param,
                'horizon': horizon,
                'moran_I': moran_result.get('moran_I'),
                'moran_pval': moran_result.get('p_value'),
                'levene_pval': ns_result.get('levene_pvalue'),
            })

    conn.close()

    print(f"\n{'═'*65}")
    print("RÉSUMÉ TEST DE STATIONNARITÉ")
    print(f"{'═'*65}")
    print(f"{'Param':<12} {'Hz':<6} {'Moran I':<12} {'p(Moran)':<12} {'p(Levene N/S)':<15}")
    print(f"{'─'*58}")
    for r in summary:
        print(f"{r['param']:<12} {r['horizon']:<6} "
              f"{str(r['moran_I']):<12} {str(r['moran_pval']):<12} {str(r['levene_pval']):<15}")

    print(json.dumps({'stationarity_summary': summary}, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
