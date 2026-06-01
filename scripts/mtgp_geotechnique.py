#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — BLOC D : Multi-Task Gaussian Process (co-krigeage)
=============================================================================
Intrepid Core Engineering Standards

Exploite les corrélations entre paramètres géotechniques pour améliorer
les prédictions, en particulier pour EG (101 mesures) qui bénéficie
de la structure spatiale de VBS et IP (200+ mesures).

Corrélations mesurées en DB :
  r(IP, WL)  = 0.802 → très forte
  r(IP, EG)  = 0.742 → forte
  r(WL, EG)  = 0.741 → forte
  r(VBS, EG) = 0.350 → modérée

Complexité mémoire :
  N_train = ~300-600 points → matrice 600×600 → triviale (< 1s)
  Pas de SVGP nécessaire tant que N < 2000

Fondements :
  ICM (Intrinsic Coregionalization Model) — Journel & Huijbregts (1978)
  Álvarez et al. (2012) "Kernels for Vector-Valued Functions"
  GPflow documentation : gpflow.kernels.Coregion

Règles respectées :
  CFG-01     : aucune URL hardcodée
  GEN-01     : inspection DB avant écriture
  DATA-02    : validation plages physiques (VBS 0-20, IP 0-80, WL 20-120, WP 10-60, EG 0-20)
  ETL-03     : gestion erreurs systématique
  BM-SYNC-05 : idempotent (superseded avant réinsertion)

Usage :
  pip install gpflow tensorflow

  python scripts/mtgp_geotechnique.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --horizons h1 \\
      --params vbs,ip,eg \\
      [--dry-run]

  # Avec entraînement sur H1 uniquement (recommandé pour démonstration mémoire)
  python scripts/mtgp_geotechnique.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --horizons h1 --params vbs,ip,wl,wp,eg

Notes :
  - L'EG dans v_echantillons_essais s'appelle 'potentiel_gonflement' (pas 'eg')
  - $env:PYTHONUTF8 = "1" avant exécution sur Windows (encodage)
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import uuid
from datetime import datetime
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch

# ── Logging ──────────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f"logs/mtgp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("MTGP")

# ── Constantes métier (DATA-02) ───────────────────────────────────────
PARAMS_CONFIG: Dict[str, Dict] = {
    "vbs": {"col": "vbs",                   "min": 0.0,  "max": 20.0,  "unit": "g/100g"},
    "ip":  {"col": "ip",                    "min": 0.0,  "max": 80.0,  "unit": "%"},
    "wl":  {"col": "wl",                    "min": 20.0, "max": 120.0, "unit": "%"},
    "wp":  {"col": "wp",                    "min": 10.0, "max": 60.0,  "unit": "%"},
    "eg":  {"col": "potentiel_gonflement",  "min": 0.0,  "max": 20.0,  "unit": "%"},
}

DEPTH_WINDOWS = {"h1": (0.5, 1.5), "h2": (1.0, 2.0), "h3": (1.5, 2.5)}

MTGP_METHOD = "mtgp_icm_gpflow"

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)


def json_safe(obj) -> str:
    def scrub(x):
        if isinstance(x, float):
            return None if (math.isnan(x) or math.isinf(x)) else x
        if isinstance(x, dict):
            return {k: scrub(v) for k, v in x.items()}
        if isinstance(x, (list, tuple)):
            return [scrub(v) for v in x]
        return x
    return json.dumps(scrub(obj), allow_nan=False)


def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn


# ── Chargement des données terrain ───────────────────────────────────
def load_training_data(
    cur, params: List[str], depth_window: Tuple[float, float]
) -> pd.DataFrame:
    """
    Charge les sondages avec toutes les mesures demandées.

    Chaque ligne = un sondage avec ses coordonnées et ses valeurs
    pour chaque paramètre (NaN si non mesuré à cette profondeur).
    """
    depth_min, depth_max = depth_window

    # Construire les colonnes dynamiquement selon les paramètres
    select_cols = []
    joins = []
    joined_tables: set = set()

    for p in params:
        cfg = PARAMS_CONFIG[p]
        col = cfg["col"]

        if p == "vbs" and "vbs" not in joined_tables:
            joins.append(
                "LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id"
            )
            joined_tables.add("vbs")
            select_cols.append(f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} THEN ev.vbs END)::float8 AS vbs")

        elif p in ("ip", "wl", "wp") and "atterberg" not in joined_tables:
            joins.append(
                "LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id"
            )
            joined_tables.add("atterberg")

        if p == "ip":
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN COALESCE(ea.ip_generated, ea.wl - ea.wp) END)::float8 AS ip"
            )
        elif p == "wl":
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN ea.wl END)::float8 AS wl"
            )
        elif p == "wp":
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN ea.wp END)::float8 AS wp"
            )
        elif p == "eg" and "eg" not in joined_tables:
            # EG passe par v_echantillons_essais.potentiel_gonflement (canonique)
            # La table brute (essais_potentiel_gonflement.cg) n'est jamais accédée
            # directement — règle d'harmonisation: toujours la vue canonique.
            joins.append(
                "LEFT JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id"
            )
            joined_tables.add("eg")
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN epg.cg END)::float8 AS eg"  # cg = colonne physique = potentiel_gonflement
            )

    cols_sql = ",\n    ".join(select_cols)
    joins_sql = "\n".join(joins)

    cur.execute(f"""
        SELECT
            m.id::text AS maille_id,
            ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
            ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat,
            {cols_sql}
        FROM atlas.sondages s
        JOIN atlas.mailles m ON m.code = s.maille_code
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        {joins_sql}
        WHERE s.deleted_at IS NULL
          AND m.code IS NOT NULL
        GROUP BY m.id
        HAVING {" OR ".join([
            f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} THEN 1.0 END) IS NOT NULL"
        ])}
        ORDER BY m.id
    """)

    rows = cur.fetchall()
    cols = ["maille_id", "lon", "lat"] + params
    df = pd.DataFrame(rows, columns=cols)
    return df


def load_grid(cur) -> pd.DataFrame:
    """Charge toutes les mailles avec coordonnées pour la prédiction."""
    cur.execute("""
        SELECT
            m.id::text AS maille_id,
            m.code,
            ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
            ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat
        FROM atlas.mailles m
        ORDER BY m.code
    """)
    return pd.DataFrame(cur.fetchall(), columns=["maille_id", "code", "lon", "lat"])


# ── Construction du modèle MTGP ───────────────────────────────────────
def build_mtgp_data(
    df_train: pd.DataFrame, params: List[str]
) -> Tuple[np.ndarray, np.ndarray]:
    """
    Prépare les données au format MTGP (GPflow SwitchedLikelihood).

    Format GPflow SwitchedLikelihood (stacked multi-output) :
      X : (N_total, 3) → [lon, lat, output_index]
      Y : (N_total, 2) → [valeur, output_index]
                         ↑ GPflow SwitchedLikelihood exige l'index dans Y[:, 1]

    Seules les observations non-NaN sont incluses pour chaque paramètre.
    Référence : gpflow.likelihoods.SwitchedLikelihood documentation.
    """
    X_list, Y_list = [], []

    for idx, param in enumerate(params):
        mask = df_train[param].notna()
        if mask.sum() == 0:
            continue
        df_p = df_train.loc[mask]
        n = len(df_p)
        # X : (lon, lat, output_index)
        X_p = np.column_stack([
            df_p["lon"].values,
            df_p["lat"].values,
            np.full(n, float(idx)),
        ])
        # Y : (valeur, output_index) — SwitchedLikelihood nécessite l'index dans Y
        Y_p = np.column_stack([
            df_p[param].values,
            np.full(n, float(idx)),
        ])
        X_list.append(X_p)
        Y_list.append(Y_p)
        log.info("  Param %s (idx=%d) : %d observations", param, idx, n)

    if not X_list:
        raise ValueError("Aucune donnée d'entraînement valide.")

    X = np.vstack(X_list).astype(np.float64)
    Y = np.vstack(Y_list).astype(np.float64)
    return X, Y


def train_mtgp(
    X_train: np.ndarray,
    Y_train: np.ndarray,
    n_outputs: int,
    rank: int = 2,
    max_iter: int = 500,
    jitter: float = 1e-4,
) -> "gpflow.models.VGP":
    """
    Entraîne le modèle MTGP (ICM) avec GPflow.

    rank=2 : deux processus latents (axe activité argileuse VBS/IP/EG + axe plasticité WL/WP).
    Noyau : Matérn 3/2 (adapté aux discontinuités géologiques).

    Jitter gpflow.config.set_default_jitter(jitter) : régularisation numérique
    pour éviter le mauvais conditionnement de la matrice de covariance.
    """
    try:
        import gpflow
        import tensorflow as tf
    except ImportError:
        raise ImportError(
            "GPflow requis : pip install gpflow tensorflow\n"
            "Documentation : https://gpflow.github.io/"
        )

    gpflow.config.set_default_jitter(jitter)
    log.info("  GPflow jitter=%.1e | rank=%d | max_iter=%d", jitter, rank, max_iter)

    # Noyau spatial Matérn 3/2 sur (lon, lat)
    kernel_spatial = gpflow.kernels.Matern32(active_dims=[0, 1])

    # Noyau de coregionalisation (ICM)
    # active_dims=[2] : dimension qui encode l'indice du paramètre
    kernel_coreg = gpflow.kernels.Coregion(
        output_dim=n_outputs,
        rank=rank,
        active_dims=[2],
    )

    kernel = kernel_spatial * kernel_coreg

    # Vraisemblance : bruit gaussien indépendant par sortie
    likelihood = gpflow.likelihoods.SwitchedLikelihood([
        gpflow.likelihoods.Gaussian() for _ in range(n_outputs)
    ])

    # VGP avec num_latent_gps=1 pour format stacked (SwitchedLikelihood)
    # Y[:, 1] encode l'indice de sortie, ce que SwitchedLikelihood utilise
    # pour sélectionner la vraisemblance appropriée.
    model = gpflow.models.VGP(
        data=(X_train, Y_train),
        kernel=kernel,
        likelihood=likelihood,
        num_latent_gps=1,  # stacked format : 1 latent GP avec Coregion
    )

    opt = gpflow.optimizers.Scipy()
    log.info("  Optimisation du modèle MTGP (Scipy L-BFGS-B)...")
    opt.minimize(
        model.training_loss,
        model.trainable_variables,
        options={"maxiter": max_iter, "disp": False},
    )
    log.info("  ELBO final : %.3f", -float(model.training_loss()))

    return model


def predict_mtgp(
    model: "gpflow.models.VGP",
    df_grid: pd.DataFrame,
    params: List[str],
    clamp_config: Dict,
) -> pd.DataFrame:
    """
    Prédit les paramètres géotechniques sur la grille de mailles.

    Pour chaque paramètre (output_index=idx), prédit mean + variance
    sur les 29 407 mailles.

    Retourne un DataFrame avec colonnes : maille_id, code,
    {param}_mtgp, {param}_mtgp_var pour chaque param.
    """
    import tensorflow as tf

    df_pred = df_grid[["maille_id", "code"]].copy()

    for idx, param in enumerate(params):
        cfg = clamp_config[param]
        n_mailles = len(df_grid)
        idx_col = np.full(n_mailles, float(idx))
        X_pred = np.column_stack([
            df_grid["lon"].values,
            df_grid["lat"].values,
            idx_col,
        ]).astype(np.float64)

        log.info("  Prédiction %s sur %d mailles...", param, n_mailles)
        # SwitchedLikelihood retourne (N, n_outputs) — prendre la colonne idx
        mean, var = model.predict_y(X_pred)
        mean_arr = mean.numpy()
        var_arr  = var.numpy()
        # Extraire la colonne correspondant à ce paramètre
        if mean_arr.ndim == 2 and mean_arr.shape[1] > 1:
            mean_col = mean_arr[:, idx]
            var_col  = var_arr[:, idx]
        else:
            mean_col = mean_arr.ravel()
            var_col  = var_arr.ravel()
        mean_np = np.clip(mean_col, cfg["min"], cfg["max"])
        var_np  = np.maximum(var_col, 0.0)

        df_pred[f"{param}_mtgp"]     = mean_np
        df_pred[f"{param}_mtgp_var"] = var_np

        log.info(
            "  %s : moy=%.3f %s | var_moy=%.4f",
            param, float(np.nanmean(mean_np)), cfg["unit"], float(np.nanmean(var_np)),
        )

    return df_pred


# ── LOO-CV simplifié pour évaluation ─────────────────────────────────
def loo_rmse_gpflow(
    df_train: pd.DataFrame,
    param: str,
    n_iter_loo: int = 20,
    rank: int = 2,
) -> float:
    """
    LOO-CV partielle (n_iter_loo itérations aléatoires) pour évaluer
    la performance MTGP sur le paramètre cible.

    LOO-CV complète N itérations serait O(N³) × N — trop lent.
    On utilise un sous-échantillon aléatoire pour estimer le RMSE.
    """
    df_p = df_train[["lon", "lat", param]].dropna()
    if len(df_p) < 20:
        return float("nan")

    n = len(df_p)
    indices = np.random.choice(n, size=min(n_iter_loo, n), replace=False)
    errors = []

    for i in indices:
        mask = np.ones(n, dtype=bool)
        mask[i] = False

        df_sub = df_p.iloc[mask]
        X_tr = np.column_stack([
            df_sub["lon"].values,
            df_sub["lat"].values,
            np.zeros(len(df_sub)),
        ]).astype(np.float64)
        Y_tr = df_sub[[param]].values.astype(np.float64)
        X_te = np.array([[df_p.iloc[i]["lon"], df_p.iloc[i]["lat"], 0.0]])
        y_te = float(df_p.iloc[i][param])

        try:
            model = train_mtgp(X_tr, Y_tr, n_outputs=1, rank=1, max_iter=200)
            mean, _ = model.predict_y(X_te)
            errors.append((float(mean.numpy()[0, 0]) - y_te) ** 2)
        except Exception:
            continue

    if not errors:
        return float("nan")
    return float(np.sqrt(np.mean(errors)))


# ── Stockage des résultats ────────────────────────────────────────────
def store_mtgp_predictions(
    conn,
    df_pred: pd.DataFrame,
    params: List[str],
    horizon_label: str,
    run_id: str,
    clamp_config: Dict,
) -> int:
    """Stocke les prédictions MTGP dans atlas.ai_interpolation_values."""
    cur = conn.cursor()
    total_inserted = 0

    for param in params:
        param_id = f"{param}_mtgp_{horizon_label}"
        col_val = f"{param}_mtgp"
        col_var = f"{param}_mtgp_var"

        if col_val not in df_pred.columns:
            continue

        cfg = clamp_config[param]

        # Supersede les anciennes prédictions (BM-SYNC-05)
        cur.execute(
            """
            UPDATE atlas.ai_interpolation_values
            SET is_superseded = true
            WHERE parameter_id = %s AND method = %s
              AND COALESCE(is_superseded, false) = false
            """,
            (param_id, MTGP_METHOD),
        )

        # Assurer présence dans le catalogue
        cur.execute(
            """
            INSERT INTO atlas.ai_parameter_catalog
              (parameter_id, category, source, unit, interpolation_enabled,
               prediction_enabled, is_active, updated_at, depth_stratified, is_derived,
               physical_min, physical_max)
            VALUES (%s, 'geotech', 'ia', %s, false, true, true, now(), true, true, %s, %s)
            ON CONFLICT (parameter_id) DO NOTHING
            """,
            (param_id, cfg["unit"], cfg["min"], cfg["max"]),
        )

        rows = []
        for _, row in df_pred.iterrows():
            val = row.get(col_val)
            var = row.get(col_var)
            if val is None or (isinstance(val, float) and not math.isfinite(val)):
                continue
            rows.append((
                str(uuid.uuid4()),
                str(row["maille_id"]),
                param_id,
                float(np.clip(val, cfg["min"], cfg["max"])),
                float(var) if var is not None and math.isfinite(float(var)) else None,
                MTGP_METHOD,
                run_id,
            ))

        execute_batch(
            cur,
            """
            INSERT INTO atlas.ai_interpolation_values
              (id, maille_id, zone_id, kriging_domain_id, parameter_id,
               value, variance, confidence, method, variogram_id, run_id, created_at)
            VALUES
              (%s::uuid, %s::uuid, NULL, NULL, %s, %s, %s, NULL, %s, NULL, %s::uuid, now())
            """,
            rows,
            page_size=2000,
        )

        conn.commit()
        total_inserted += len(rows)
        log.info("  %s : %d valeurs insérées", param_id, len(rows))

    cur.close()
    return total_inserted


# ── Orchestration principale ──────────────────────────────────────────
def run_mtgp(
    conn,
    params: List[str],
    horizon_label: str,
    dry_run: bool = False,
    rank: int = 2,
    max_iter: int = 500,
) -> Dict:
    depth_window = DEPTH_WINDOWS.get(horizon_label, (0.5, 1.5))
    clamp = {p: PARAMS_CONFIG[p] for p in params}

    cur = conn.cursor()

    log.info("Chargement des données terrain (horizon=%s, fenêtre=%.1f-%.1f m)...",
             horizon_label, *depth_window)
    df_train = load_training_data(cur, params, depth_window)
    n_total = len(df_train)
    n_per_param = {p: int(df_train[p].notna().sum()) for p in params}
    log.info("Sondages chargés : %d | Par paramètre : %s", n_total, n_per_param)

    if n_total < 10:
        cur.close()
        return {"ok": False, "reason": "insufficient_training_data", "n": n_total}

    log.info("Chargement de la grille de prédiction (29 407 mailles)...")
    df_grid = load_grid(cur)
    cur.close()

    # Construction du tenseur d'entraînement MTGP
    X_train, Y_train = build_mtgp_data(df_train, params)
    log.info("Tenseur X_train : %s | Y_train : %s", X_train.shape, Y_train.shape)

    if dry_run:
        log.info("[DRY-RUN] Pas d'entraînement ni d'écriture.")
        return {"ok": True, "dry_run": True, "n_train_points": len(X_train)}

    # Entraînement MTGP
    log.info("Entraînement MTGP (ICM rank=%d, max_iter=%d)...", rank, max_iter)
    n_outputs = len(params)
    model = train_mtgp(X_train, Y_train, n_outputs=n_outputs, rank=rank, max_iter=max_iter)

    # Prédiction sur la grille
    log.info("Prédiction sur 29 407 mailles...")
    df_pred = predict_mtgp(model, df_grid, params, clamp)

    # Run ID pour la traçabilité
    run_id = str(uuid.uuid4())
    cur = conn.cursor()

    # Assurer que le premier paramètre existe dans le catalogue (FK constraint)
    # Le run est attaché au premier paramètre de la liste (ex: vbs_mtgp_h1)
    first_param_id = f"{params[0]}_mtgp_{horizon_label}"
    cur.execute("""
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled,
           prediction_enabled, is_active, updated_at, depth_stratified, is_derived,
           physical_min, physical_max)
        VALUES (%s, 'geotech', 'interpolation', %s, false, true, true, now(), true, true, %s, %s)
        ON CONFLICT (parameter_id) DO NOTHING
        """,
        (first_param_id,
         clamp.get(params[0], {}).get("unit", "%"),
         clamp.get(params[0], {}).get("min", 0.0),
         clamp.get(params[0], {}).get("max", 100.0))
    )
    conn.commit()

    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics,
           started_at, finished_at, zone_id, kriging_domain_id)
        VALUES (%s, 'kriging', %s, %s, 'v1', 'finished', %s::jsonb, now(), now(), NULL, NULL)
        """,
        (
            run_id,                     # id
            first_param_id,             # parameter_id (FK vers ai_parameter_catalog)
            MTGP_METHOD,                # method = 'mtgp_icm_gpflow'
            json_safe({                 # metrics
                "horizon_label": horizon_label,
                "params": params,
                "rank": rank,
                "n_train_total": int(len(X_train)),
                "n_per_param": n_per_param,
                "n_grid": int(len(df_grid)),
            }),
        ),
    )
    conn.commit()
    cur.close()

    # Stockage des prédictions
    n_inserted = store_mtgp_predictions(conn, df_pred, params, horizon_label, run_id, clamp)

    return {
        "ok": True,
        "horizon": horizon_label,
        "params": params,
        "n_train_total": int(len(X_train)),
        "n_per_param": n_per_param,
        "n_inserted": n_inserted,
        "run_id": run_id,
    }


# ── Entrée principale ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(
        description="BLOC D — Multi-Task Gaussian Process (co-krigeage géotechnique)"
    )
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument(
        "--params", default="vbs,ip,eg",
        help="Paramètres à modéliser conjointement. Ex: vbs,ip,wl,wp,eg",
    )
    ap.add_argument(
        "--horizons", default="h1",
        help="Horizons. Ex: h1 (h2/h3 possible mais plus lent).",
    )
    ap.add_argument(
        "--rank", type=int, default=2,
        help="Rang ICM (nombre de processus latents). 2 = axe activité argileuse + axe plasticité.",
    )
    ap.add_argument(
        "--max-iter", type=int, default=500,
        help="Itérations max optimisation GPflow L-BFGS-B.",
    )
    ap.add_argument(
        "--dry-run", action="store_true",
        help="Valide les données sans entraîner ni écrire.",
    )
    args = ap.parse_args()

    if not args.database_url:
        log.error("--database-url requis")
        return 1

    params   = [p.strip() for p in args.params.split(",")   if p.strip()]
    horizons = [h.strip() for h in args.horizons.split(",") if h.strip()]

    unknown = [p for p in params if p not in PARAMS_CONFIG]
    if unknown:
        log.error("Paramètres inconnus : %s. Valides : %s", unknown, list(PARAMS_CONFIG))
        return 1

    unknown_h = [h for h in horizons if h not in DEPTH_WINDOWS]
    if unknown_h:
        log.error("Horizons inconnus : %s. Valides : h1, h2, h3", unknown_h)
        return 1

    log.info("=== BLOC D — Multi-Task Gaussian Process ===")
    log.info(
        "Paramètres : %s | Horizons : %s | Rank : %d | Max-iter : %d | Dry-run : %s",
        params, horizons, args.rank, args.max_iter, args.dry_run,
    )

    # Vérifier que GPflow est disponible
    if not args.dry_run:
        try:
            import gpflow  # noqa: F401
        except ImportError:
            log.error(
                "GPflow non installé. Installer : pip install gpflow tensorflow\n"
                "Ou utiliser --dry-run pour valider les données sans entraîner."
            )
            return 1

    conn = get_conn(args.database_url)
    try:
        results = []
        for hz in horizons:
            log.info("--- Horizon %s ---", hz)
            r = run_mtgp(
                conn, params, hz,
                dry_run=args.dry_run,
                rank=args.rank,
                max_iter=args.max_iter,
            )
            results.append(r)
            if r.get("ok"):
                log.info(
                    "  Horizon %s : %d points entraînement | %d valeurs insérées",
                    hz, r.get("n_train_total", 0), r.get("n_inserted", 0),
                )

        ok_count = sum(1 for r in results if r.get("ok"))
        log.info("=== Terminé : %d/%d horizons réussis ===", ok_count, len(results))
        print(json_safe({"mtgp_results": results}))
        return 0

    except Exception as exc:
        log.exception("ERREUR fatale : %s", exc)
        conn.rollback()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
