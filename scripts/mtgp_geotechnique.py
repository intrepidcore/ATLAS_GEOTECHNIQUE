#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — BLOC D : Multi-Task Gaussian Process (co-krigeage)
=============================================================================
Intrepid Core Engineering Standards

Exploite les corrélations entre paramètres géotechniques pour améliorer
les prédictions, en particulier pour EG (101 mesures) qui bénéficie
de la structure spatiale de VBS et IP (200+ mesures).

Groupes de paramètres supportés :
  plasticite : vbs, ip, wl, wp, eg
    Corrélations : r(IP, WL)=0.802, r(IP, EG)=0.742, r(WL, EG)=0.741, r(VBS, EG)=0.350

  compactage : cbr_95, gamma_d, w_opt
    cbr_95  : essais_cbr WHERE compactage_pct BETWEEN 94 AND 96 (colonne cbr_pct)
    gamma_d : essais_proctor.gamma_d_max (kN/m³, plage 14-25)
    w_opt   : essais_proctor.w_opt

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
  DATA-02    : validation plages physiques
  ETL-03     : gestion erreurs systématique
  BM-SYNC-05 : idempotent (superseded avant réinsertion)

Usage :
  pip install gpflow tensorflow

  # Groupe plasticité (défaut)
  python scripts/mtgp_geotechnique.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --group plasticite --horizons h1 [--dry-run]

  # Groupe compactage
  python scripts/mtgp_geotechnique.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --group compactage --horizons h1

  # Paramètres explicites (compatibilité ascendante)
  python scripts/mtgp_geotechnique.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --horizons h1 --params vbs,ip,wl,wp,eg

Notes :
  - L'EG dans v_echantillons_essais s'appelle 'potentiel_gonflement' (pas 'eg')
  - gamma_d stocké en kN/m³ (valeurs 14-25) — filtrage BETWEEN 14 AND 25
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
from typing import Any, Dict, List, Optional, Tuple

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
        logging.StreamHandler(sys.stderr),   # stderr pour ne pas polluer le JSON stdout
        logging.FileHandler(
            f"logs/mtgp_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("MTGP")

# ── Constantes métier (DATA-02) ───────────────────────────────────────
PARAMS_CONFIG: Dict[str, Dict] = {
    # Groupe plasticite
    "vbs":     {"col": "vbs",                   "min": 0.0,  "max": 20.0,  "unit": "g/100g"},
    "ip":      {"col": "ip",                    "min": 0.0,  "max": 80.0,  "unit": "%"},
    "wl":      {"col": "wl",                    "min": 20.0, "max": 120.0, "unit": "%"},
    "wp":      {"col": "wp",                    "min": 10.0, "max": 60.0,  "unit": "%"},
    "eg":      {"col": "potentiel_gonflement",  "min": 0.0,  "max": 20.0,  "unit": "%"},
    # Groupe compactage
    "cbr_95":  {"col": "cbr_pct",              "min": 0.0,  "max": 200.0, "unit": "%"},
    "gamma_d": {"col": "gamma_d_max",          "min": 14.0, "max": 25.0,  "unit": "kN/m³"},
    "w_opt":   {"col": "w_opt",                "min": 0.0,  "max": 50.0,  "unit": "%"},
}

# Définition des groupes de paramètres
GROUPS: Dict[str, List[str]] = {
    "plasticite": ["vbs", "ip", "wl", "wp", "eg"],
    "compactage": ["cbr_95", "gamma_d", "w_opt"],
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
def _build_plasticite_sql(
    params: List[str], depth_min: float, depth_max: float
) -> Tuple[List[str], List[str]]:
    """Construit les clauses SELECT et JOIN pour le groupe plasticité."""
    select_cols: List[str] = []
    joins: List[str] = []
    joined_tables: set = set()

    for p in params:
        if p == "vbs" and "vbs" not in joined_tables:
            joins.append("LEFT JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id")
            joined_tables.add("vbs")
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN ev.vbs END)::float8 AS vbs"
            )
        elif p in ("ip", "wl", "wp") and "atterberg" not in joined_tables:
            joins.append("LEFT JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id")
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
            # EG passe par essais_potentiel_gonflement.cg (vue canonique)
            joins.append(
                "LEFT JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id"
            )
            joined_tables.add("eg")
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN epg.cg END)::float8 AS eg"
            )

    return select_cols, joins


def _build_compactage_sql(
    params: List[str], depth_min: float, depth_max: float
) -> Tuple[List[str], List[str]]:
    """Construit les clauses SELECT et JOIN pour le groupe compactage.

    Sources :
      cbr_95  : essais_cbr.cbr_pct WHERE compactage_pct BETWEEN 94 AND 96
      gamma_d : essais_proctor.gamma_d_max (kN/m³, BETWEEN 14 AND 25)
      w_opt   : essais_proctor.w_opt
    """
    select_cols: List[str] = []
    joins: List[str] = []
    joined_tables: set = set()

    for p in params:
        if p == "cbr_95" and "cbr" not in joined_tables:
            joins.append(
                "LEFT JOIN atlas.essais_cbr ecbr ON ecbr.echantillon_id = e.id"
                "  AND ecbr.compactage_pct BETWEEN 94 AND 96"
            )
            joined_tables.add("cbr")
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN ecbr.cbr_pct END)::float8 AS cbr_95"
            )

        if p in ("gamma_d", "w_opt") and "proctor" not in joined_tables:
            joins.append(
                "LEFT JOIN atlas.essais_proctor epro ON epro.echantillon_id = e.id"
            )
            joined_tables.add("proctor")

        if p == "gamma_d":
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"  AND epro.gamma_d_max BETWEEN 14 AND 25 "
                f"THEN epro.gamma_d_max END)::float8 AS gamma_d"
            )
        elif p == "w_opt":
            select_cols.append(
                f"AVG(CASE WHEN e.depth_m BETWEEN {depth_min} AND {depth_max} "
                f"THEN epro.w_opt END)::float8 AS w_opt"
            )

    return select_cols, joins


def load_training_data(
    cur, params: List[str], depth_window: Tuple[float, float], group: str = "plasticite"
) -> pd.DataFrame:
    """
    Charge les sondages avec toutes les mesures demandées.

    Chaque ligne = un sondage avec ses coordonnées et ses valeurs
    pour chaque paramètre (NaN si non mesuré à cette profondeur).

    group : 'plasticite' | 'compactage'
      Détermine les tables sources et les filtres appliqués.
    """
    depth_min, depth_max = depth_window

    if group == "compactage":
        select_cols, joins = _build_compactage_sql(params, depth_min, depth_max)
    else:
        select_cols, joins = _build_plasticite_sql(params, depth_min, depth_max)

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
) -> Tuple[np.ndarray, np.ndarray, Dict]:
    """
    Prépare les données au format MTGP (GPflow SwitchedLikelihood).

    Format GPflow SwitchedLikelihood (stacked multi-output) :
      X : (N_total, 3) → [lon_norm, lat_norm, output_index]
      Y : (N_total, 2) → [valeur_norm, output_index]
                         ↑ GPflow SwitchedLikelihood exige l'index dans Y[:, 1]

    Normalisation spatiale (z-score) appliquée sur lon/lat pour stabilité
    numérique du kernel Matern32 (évite ELBO=NaN par mauvais conditionnement).
    Les scalers sont retournés pour l'inversion lors de la prédiction.

    Seules les observations non-NaN sont incluses pour chaque paramètre.
    Référence : gpflow.likelihoods.SwitchedLikelihood documentation.
    """
    X_list, Y_list = [], []

    # Normalisation spatiale globale (sur tous les sondages confondus)
    lon_all = df_train["lon"].values
    lat_all = df_train["lat"].values
    lon_mean, lon_std = float(np.mean(lon_all)), float(np.std(lon_all)) + 1e-8
    lat_mean, lat_std = float(np.mean(lat_all)), float(np.std(lat_all)) + 1e-8

    # Normalisation par paramètre (z-score des valeurs — stabilité Adam)
    y_scalers: Dict[str, Tuple[float, float]] = {}
    for param in params:
        vals = df_train[param].dropna().values
        if len(vals) > 0:
            y_scalers[param] = (float(np.mean(vals)), float(np.std(vals)) + 1e-8)
        else:
            y_scalers[param] = (0.0, 1.0)

    for idx, param in enumerate(params):
        mask = df_train[param].notna()
        if mask.sum() == 0:
            continue
        df_p = df_train.loc[mask]
        n = len(df_p)
        # X : (lon_norm, lat_norm, output_index)
        lon_n = (df_p["lon"].values - lon_mean) / lon_std
        lat_n = (df_p["lat"].values - lat_mean) / lat_std
        X_p = np.column_stack([lon_n, lat_n, np.full(n, float(idx))])

        # Y : (valeur_norm, output_index)
        y_mean, y_std = y_scalers[param]
        y_norm = (df_p[param].values - y_mean) / y_std
        Y_p = np.column_stack([y_norm, np.full(n, float(idx))])

        X_list.append(X_p)
        Y_list.append(Y_p)
        log.info("  Param %s (idx=%d) : %d observations | y∈[%.2f, %.2f] → norm∈[%.2f, %.2f]",
                 param, idx, n,
                 float(df_p[param].min()), float(df_p[param].max()),
                 float(y_norm.min()), float(y_norm.max()))

    if not X_list:
        raise ValueError("Aucune donnée d'entraînement valide.")

    X = np.vstack(X_list).astype(np.float64)
    Y = np.vstack(Y_list).astype(np.float64)

    scalers = {
        "lon": (lon_mean, lon_std),
        "lat": (lat_mean, lat_std),
        "y": y_scalers,
    }
    log.info("  Scalers spatiaux : lon=(%.4f ± %.4f) lat=(%.4f ± %.4f)",
             lon_mean, lon_std, lat_mean, lat_std)
    return X, Y, scalers


def train_mtgp(
    X_train: np.ndarray,
    Y_train: np.ndarray,
    n_outputs: int,
    rank: int = 2,
    max_iter: int = 500,
    jitter: float = 1e-2,
) -> "gpflow.models.VGP":
    """
    Entraîne le modèle MTGP (ICM) avec GPflow.

    rank=2 : deux processus latents (axe activité argileuse VBS/IP/EG + axe plasticité WL/WP).
    Noyau : Matérn 3/2 (adapté aux discontinuités géologiques).

    Prérequis : X_train[:, :2] doit être déjà normalisé (z-score) par build_mtgp_data
    pour éviter le mauvais conditionnement de la matrice de covariance (ELBO=NaN).

    jitter=1e-2 (au lieu de 1e-4) : plus robuste sur GPU RTX 2050 avec float32.
    Retry automatique avec jitter×10 si NaN détecté à iter=50.
    """
    try:
        import gpflow
        import tensorflow as tf
    except ImportError:
        raise ImportError(
            "GPflow requis : pip install gpflow tensorflow\n"
            "Documentation : https://gpflow.github.io/"
        )

    # GPU memory growth — doit être appelé avant toute opération TF (ARCH-GPU-01)
    gpus = tf.config.list_physical_devices("GPU")
    for gpu in gpus:
        try:
            tf.config.experimental.set_memory_growth(gpu, True)
        except RuntimeError:
            pass  # déjà initialisé — sans impact
    if gpus:
        log.info("  GPU détecté : %d device(s) — memory_growth activé", len(gpus))
    else:
        log.info("  Aucun GPU — calculs sur CPU")

    def _build_model(jitter_val: float) -> "gpflow.models.VGP":
        gpflow.config.set_default_jitter(jitter_val)
        log.info("  GPflow jitter=%.1e | rank=%d | max_iter=%d", jitter_val, rank, max_iter)

        # Noyau spatial Matérn 3/2 sur (lon_norm, lat_norm)
        # Lengthscale initialisé à 1.0 (données déjà normalisées → range ≈ [-2, 2])
        kernel_spatial = gpflow.kernels.Matern32(
            active_dims=[0, 1],
            lengthscales=1.0,
            variance=1.0,
        )

        # Noyau de coregionalisation (ICM)
        # active_dims=[2] : dimension qui encode l'indice du paramètre
        kernel_coreg = gpflow.kernels.Coregion(
            output_dim=n_outputs,
            rank=rank,
            active_dims=[2],
        )
        # Initialiser W avec bruit faible — évite W≈0 → matrice covariance nulle → NaN
        kernel_coreg.W.assign(
            np.random.RandomState(42).randn(n_outputs, rank).astype(np.float64) * 0.1
        )
        kernel_coreg.kappa.assign(np.ones(n_outputs, dtype=np.float64) * 0.1)

        kernel = kernel_spatial * kernel_coreg

        # Vraisemblance : bruit gaussien indépendant par sortie
        # Variance initialisée à 0.5 (données normalisées → variance Y ≈ 1)
        likelihoods = []
        for _ in range(n_outputs):
            lik = gpflow.likelihoods.Gaussian()
            lik.variance.assign(0.5)
            likelihoods.append(lik)
        likelihood = gpflow.likelihoods.SwitchedLikelihood(likelihoods)

        # VGP stacked format : num_latent_gps=1 avec SwitchedLikelihood + Coregion
        m = gpflow.models.VGP(
            data=(X_train, Y_train),
            kernel=kernel,
            likelihood=likelihood,
            num_latent_gps=1,
        )
        return m

    model = _build_model(jitter)

    # Optimiseur Adam GPU-natif
    opt = tf.optimizers.Adam(learning_rate=0.005)
    log.info("  Optimisation Adam lr=0.005 GPU-native (max_iter=%d)...", max_iter)

    @tf.function
    def _train_step() -> None:
        opt.minimize(model.training_loss, model.trainable_variables)

    prev_elbo: float = float("inf")
    patience: int = 0
    nan_retry_done: bool = False

    for i in range(max_iter):
        _train_step()
        if i % 50 == 0:
            elbo = -float(model.training_loss())
            log.info("  iter=%d ELBO=%.4f", i, elbo)

            # Détection NaN précoce → retry avec jitter×10
            if math.isnan(elbo) or math.isinf(elbo):
                if not nan_retry_done and jitter < 0.5:
                    new_jitter = jitter * 10.0
                    log.warning(
                        "  ELBO=NaN à iter=%d — retry avec jitter=%.2e", i, new_jitter
                    )
                    model = _build_model(new_jitter)
                    opt = tf.optimizers.Adam(learning_rate=0.005)
                    nan_retry_done = True
                    prev_elbo = float("inf")
                    patience = 0
                    continue
                else:
                    log.error("  ELBO=NaN persistant après retry — arrêt anticipé")
                    break

            improvement = abs(elbo - prev_elbo) / (abs(prev_elbo) + 1e-8)
            if improvement < 1e-4 and i > 100:
                patience += 1
                if patience >= 3:
                    log.info("  Convergence iter=%d ELBO=%.4f (patience plateau)", i, elbo)
                    break
            else:
                patience = 0
            prev_elbo = elbo

    final_elbo = -float(model.training_loss())
    log.info("  ELBO final : %.3f", final_elbo)
    return model


def predict_mtgp(
    model: "gpflow.models.VGP",
    df_grid: pd.DataFrame,
    params: List[str],
    clamp_config: Dict,
    scalers: Optional[Dict] = None,
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

    # Appliquer les mêmes scalers spatiaux que lors de l'entraînement
    lon_arr = df_grid["lon"].values
    lat_arr = df_grid["lat"].values
    if scalers is not None:
        lon_mean, lon_std = scalers["lon"]
        lat_mean, lat_std = scalers["lat"]
        lon_arr = (lon_arr - lon_mean) / lon_std
        lat_arr = (lat_arr - lat_mean) / lat_std

    for idx, param in enumerate(params):
        cfg = clamp_config[param]
        n_mailles = len(df_grid)
        idx_col = np.full(n_mailles, float(idx))
        X_pred = np.column_stack([
            lon_arr,
            lat_arr,
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
        # Dénormaliser les prédictions (annuler le z-score appliqué dans build_mtgp_data)
        if scalers is not None and param in scalers.get("y", {}):
            y_mean, y_std = scalers["y"][param]
            mean_col = mean_col * y_std + y_mean
            var_col  = var_col * (y_std ** 2)  # variance se scale au carré

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
    group: str = "plasticite",
) -> Dict:
    depth_window = DEPTH_WINDOWS.get(horizon_label, (0.5, 1.5))
    clamp = {p: PARAMS_CONFIG[p] for p in params}

    cur = conn.cursor()

    log.info("Chargement des données terrain (groupe=%s, horizon=%s, fenêtre=%.1f-%.1f m)...",
             group, horizon_label, *depth_window)
    df_train = load_training_data(cur, params, depth_window, group=group)
    n_total = len(df_train)
    n_per_param = {p: int(df_train[p].notna().sum()) for p in params}
    log.info("Sondages chargés : %d | Par paramètre : %s", n_total, n_per_param)

    if n_total < 10:
        cur.close()
        return {"ok": False, "reason": "insufficient_training_data", "n": n_total}

    log.info("Chargement de la grille de prédiction (29 407 mailles)...")
    df_grid = load_grid(cur)
    cur.close()

    # Construction du tenseur d'entraînement MTGP (avec normalisation z-score)
    X_train, Y_train, scalers = build_mtgp_data(df_train, params)
    log.info("Tenseur X_train : %s | Y_train : %s", X_train.shape, Y_train.shape)

    if dry_run:
        log.info("[DRY-RUN] Pas d'entraînement ni d'écriture.")
        return {"ok": True, "dry_run": True, "n_train_points": len(X_train)}

    # Entraînement MTGP
    log.info("Entraînement MTGP (ICM rank=%d, max_iter=%d)...", rank, max_iter)
    n_outputs = len(params)
    model = train_mtgp(X_train, Y_train, n_outputs=n_outputs, rank=rank, max_iter=max_iter)

    # Prédiction sur la grille (avec les mêmes scalers que l'entraînement)
    log.info("Prédiction sur 29 407 mailles...")
    df_pred = predict_mtgp(model, df_grid, params, clamp, scalers=scalers)

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

    # ── Versioning du run (traçabilité) ──────────────────────────────────
    # NOTE : le run est inséré ICI avec status='running' pour que les prédictions
    # soient disponibles en DB immédiatement. La LOO-CV (lente) viendra mettre à
    # jour le run en 'finished' avec les métriques. BM-SYNC-05 respecté.
    import subprocess as _sp, hashlib as _hl, platform as _pl
    # Git hash (best-effort — pas disponible dans tous les containers)
    try:
        _git_hash = _sp.check_output(
            ["git", "rev-parse", "--short", "HEAD"],
            stderr=_sp.DEVNULL, text=True
        ).strip()
    except Exception:
        _git_hash = "nogit"
    # Hash des hyperparamètres pour identifier la configuration exacte
    _hp_str = f"rank={rank}_maxiter={max_iter}_group={group}_horizon={horizon_label}"
    _hp_hash = _hl.sha1(_hp_str.encode()).hexdigest()[:8]
    model_version_tag = f"mtgp-{_git_hash}-{_hp_hash}"

    # Versions logicielles
    try:
        import gpflow as _gpf, tensorflow as _tf
        _sw_versions = {
            "gpflow": _gpf.__version__,
            "tensorflow": _tf.__version__,
            "python": _pl.python_version(),
        }
    except Exception:
        _sw_versions = {}

    meta_base = json_safe({
        "git_hash": _git_hash,
        "hp_hash": _hp_hash,
        "hyperparams": {
            "rank": rank, "max_iter": max_iter, "jitter": 1e-2,
            "lr_adam": 0.005, "group": group, "horizon": horizon_label,
            "normalization": "zscore_spatial_and_y",
        },
        "scalers": {
            "lon": list(scalers["lon"]),
            "lat": list(scalers["lat"]),
            "y": {k: list(v) for k, v in scalers["y"].items()},
        },
        "software": _sw_versions,
        "timestamp_utc": datetime.utcnow().isoformat(),
    })

    # ── INSERT run status='running' — prédictions disponibles immédiatement ──
    cur.execute(
        """
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics,
           started_at, finished_at, zone_id, kriging_domain_id, meta)
        VALUES (%s, 'kriging', %s, %s, %s, 'running', %s::jsonb, now(), NULL, NULL, NULL, %s::jsonb)
        """,
        (
            run_id, first_param_id, MTGP_METHOD, model_version_tag,
            json_safe({
                "horizon_label": horizon_label, "params": params,
                "rank": rank, "max_iter": max_iter,
                "n_train_total": int(len(X_train)),
                "n_per_param": n_per_param,
                "n_grid": int(len(df_grid)),
                "loo_rmse": None,          # sera mis à jour après LOO-CV
                "loo_rmse_by_param": {},
            }),
            meta_base,
        ),
    )
    conn.commit()
    cur.close()

    # ── Stockage immédiat des prédictions (avant LOO-CV) ──────────────────
    log.info("Stockage des prédictions en DB (avant LOO-CV)...")
    n_inserted = store_mtgp_predictions(conn, df_pred, params, horizon_label, run_id, clamp)
    log.info("✓ %d valeurs MTGP insérées en DB — run_id=%s", n_inserted, run_id)

    # ── LOO-CV en arrière-plan (n_iter réduit à 10 par param) ─────────────
    log.info("Calcul LOO-RMSE (10 itérations par paramètre)...")
    loo_by_param = {}
    for p in params:
        try:
            rmse_val = loo_rmse_gpflow(df_train, p, n_iter_loo=10, rank=rank)
            loo_by_param[p] = None if (rmse_val is None or rmse_val != rmse_val) else round(float(rmse_val), 4)
            log.info("  LOO-RMSE %s = %s", p, loo_by_param[p])
        except Exception as e:
            log.warning("  LOO-RMSE %s FAILED: %s", p, e)
            loo_by_param[p] = None

    primary_loo = loo_by_param.get(params[0])

    # ── UPDATE run → 'finished' avec métriques LOO ────────────────────────
    cur2 = conn.cursor()
    cur2.execute(
        """
        UPDATE atlas.ai_interpolation_runs
        SET status = 'finished',
            finished_at = now(),
            metrics = metrics || %s::jsonb
        WHERE id = %s
        """,
        (
            json_safe({"loo_rmse": primary_loo, "loo_rmse_by_param": loo_by_param,
                       "loo_residual": {"rmse": primary_loo}}),
            run_id,
        ),
    )
    conn.commit()
    cur2.close()
    log.info("✓ Run %s marqué 'finished' (LOO-RMSE principal=%s)", run_id, primary_loo)

    return {
        "ok": True,
        "horizon": horizon_label,
        "params": params,
        "n_train_total": int(len(X_train)),
        "n_per_param": n_per_param,
        "n_inserted": n_inserted,
        "run_id": run_id,
    }


# ── Insertion des parameter_id manquants dans le catalogue ────────────
def ensure_catalog_entries(conn, params: List[str], horizon_label: str) -> None:
    """
    Assure que tous les parameter_id MTGP existent dans ai_parameter_catalog.
    Utilisé avant l'entraînement pour éviter les erreurs de FK.
    """
    cur = conn.cursor()
    for p in params:
        param_id = f"{p}_mtgp_{horizon_label}"
        cfg = PARAMS_CONFIG[p]
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
    conn.commit()
    cur.close()


# ── Entrée principale ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(
        description="BLOC D — Multi-Task Gaussian Process (co-krigeage géotechnique)"
    )
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument(
        "--group", default=None,
        choices=list(GROUPS.keys()),
        help=(
            "Groupe de paramètres prédéfini : 'plasticite' (vbs,ip,wl,wp,eg) "
            "ou 'compactage' (cbr_95,gamma_d,w_opt). "
            "Ignoré si --params est fourni explicitement."
        ),
    )
    ap.add_argument(
        "--params", default=None,
        help=(
            "Paramètres à modéliser conjointement (liste séparée par virgules). "
            "Ex: vbs,ip,wl,wp,eg. Prioritaire sur --group."
        ),
    )
    ap.add_argument(
        "--horizons", default="h1",
        help="Horizons. Ex: h1 (h2/h3 possible mais plus lent).",
    )
    ap.add_argument(
        "--rank", type=int, default=2,
        help="Rang ICM (nombre de processus latents). 2 = deux axes latents.",
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

    # Résolution des paramètres : --params prime sur --group
    if args.params:
        params = [p.strip() for p in args.params.split(",") if p.strip()]
        # Déterminer le groupe pour les requêtes SQL
        group = "plasticite"
        if all(p in GROUPS["compactage"] for p in params):
            group = "compactage"
        elif any(p in GROUPS["compactage"] for p in params):
            # Mélange des deux groupes — utiliser plasticite par défaut
            group = "plasticite"
            log.warning(
                "Mélange de paramètres de groupes différents détecté. "
                "Groupe SQL utilisé : '%s'. Vérifier les jointures.", group
            )
    elif args.group:
        group = args.group
        params = GROUPS[group]
    else:
        # Défaut historique : groupe plasticite
        group = "plasticite"
        params = GROUPS["plasticite"]
        log.info("Ni --group ni --params fourni. Défaut : groupe 'plasticite'.")

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
        "Groupe : %s | Paramètres : %s | Horizons : %s | Rank : %d | Max-iter : %d | Dry-run : %s",
        group, params, horizons, args.rank, args.max_iter, args.dry_run,
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
        # Assurer l'existence des parameter_id dans le catalogue (évite les FK errors)
        for hz in horizons:
            ensure_catalog_entries(conn, params, hz)

        results = []
        for hz in horizons:
            log.info("--- Horizon %s ---", hz)
            r = run_mtgp(
                conn, params, hz,
                dry_run=args.dry_run,
                rank=args.rank,
                max_iter=args.max_iter,
                group=group,
            )
            results.append(r)
            if r.get("ok"):
                log.info(
                    "  Horizon %s : %d points entraînement | %d valeurs insérées",
                    hz, r.get("n_train_total", 0), r.get("n_inserted", 0),
                )

        ok_count = sum(1 for r in results if r.get("ok"))
        log.info("=== Terminé : %d/%d horizons réussis ===", ok_count, len(results))
        print(json_safe({"group": group, "mtgp_results": results}))
        return 0

    except Exception as exc:
        log.exception("ERREUR fatale : %s", exc)
        conn.rollback()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
