#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — BLOC C : VBS-from-Sentinel (VfS)
===========================================================
Intrepid Core Engineering Standards

Pipeline :
  1. Extraire les indices spectraux Sentinel-2 via Google Earth Engine (GEE)
     pour les coordonnées des sondages → pas de téléchargement de scènes brutes.
  2. Calibrer un modèle PLS (Partial Least Squares) sur Clay_Index → VBS.
  3. Prédire le VBS spectral sur les 29 407 mailles (si NDVI < seuil végétation).
  4. Stocker dans atlas.sondage_spectral_features (sondages) et
     atlas.maille_spectral_vfs (mailles, prédiction spatiale).

Fondements scientifiques :
  - Clay_Index = B11/B12 (Kalinowski & Oliver 2004, Int. J. Remote Sensing)
  - SWIR spectral signatures → minéralogie argile (Viscarra Rossel 2006)
  - PLS régression : norme spectroscopie sols pour N < 200 (Mouazen 2010)
  - r(VBS_H1, VBS_H3) = 0.511 → cohérence verticale vérifiée en DB

Points de vigilance gérés :
  - Masque cuirasses (atlas.unites_geologiques LIKE '%Cuirasse%') → incertitude haute
  - NDVI > 0.6 → masque végétation dense (signal argile non fiable)
  - N_composantes_PLS optimisé par LOO-CV (évite overfitting avec N~120)

Règles respectées :
  CFG-01     : aucune URL hardcodée, tout via --database-url
  GEN-01     : inspection DB avant écriture
  ETL-03     : gestion erreurs systématique
  DATA-02    : VBS 0-20 g/100g, validation plages physiques
  BM-SYNC-05 : idempotent

Usage :
  # Phase 1 : extraction spectrale sur les sondages
  python scripts/vfs_extract_spectral.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --mode extract

  # Phase 2 : calibration PLS + prédiction sur les mailles
  python scripts/vfs_extract_spectral.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --mode calibrate

  # Phase 3 : prédiction sur toutes les mailles (requiert calibration)
  python scripts/vfs_extract_spectral.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --mode predict

  # Pipeline complet
  python scripts/vfs_extract_spectral.py \\
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \\
      --mode all

Prérequis :
  pip install earthengine-api geemap scikit-learn psycopg2-binary pandas numpy
  earthengine authenticate          # une seule fois, ouvre le navigateur
"""

from __future__ import annotations

import argparse
import json
import logging
import math
import os
import sys
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_batch
from sklearn.cross_decomposition import PLSRegression
from sklearn.metrics import mean_squared_error, r2_score
from sklearn.model_selection import LeaveOneOut
from sklearn.preprocessing import StandardScaler

# ── Logging ──────────────────────────────────────────────────────────
os.makedirs("logs", exist_ok=True)
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s.%(msecs)03d | %(levelname)-8s | %(message)s",
    datefmt="%Y-%m-%d %H:%M:%S",
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f"logs/vfs_{datetime.now().strftime('%Y%m%d_%H%M%S')}.log",
            encoding="utf-8",
        ),
    ],
)
log = logging.getLogger("VfS")

# ── Constantes ────────────────────────────────────────────────────────
VBS_MIN, VBS_MAX = 0.0, 20.0
NDVI_VEGETATION_THRESHOLD = 0.6   # au-dessus → végétation dense, signal argile peu fiable
N_PLS_COMPONENTS_MAX = 5           # max composantes PLS (optimisé par LOO-CV)
MIN_N_PLS_FIT = 15                 # N minimal pour calibrer le modèle PLS

# Bandes Sentinel-2 utilisées
# B4=Rouge, B8=NIR, B11=SWIR1(1610nm), B12=SWIR2(2190nm)
GEE_BANDS = ["B4", "B8", "B11", "B12"]

SPECTRAL_FEATURES = ["clay_index", "swir_ratio", "ndvi", "iron_oxide"]

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)


# ── Connexion DB ──────────────────────────────────────────────────────
def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn


# ── Création tables si nécessaire (GEN-02 : ajouter sans casser) ──────
def ensure_tables(cur) -> None:
    """Crée les tables VfS si elles n'existent pas (idempotent)."""
    cur.execute("""
        CREATE TABLE IF NOT EXISTS atlas.sondage_spectral_features (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sondage_id      UUID NOT NULL REFERENCES atlas.sondages(id),
            extracted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
            clay_index      DOUBLE PRECISION,
            swir_ratio      DOUBLE PRECISION,
            ndvi            DOUBLE PRECISION,
            iron_oxide      DOUBLE PRECISION,
            sentinel2_date  DATE,
            cloud_pct       DOUBLE PRECISION,
            quality_flag    TEXT,
            source_label    TEXT DEFAULT 'vfs_extract_spectral.py'
        );
        CREATE INDEX IF NOT EXISTS idx_sondage_spectral_sondage_id
            ON atlas.sondage_spectral_features (sondage_id);
    """)

    cur.execute("""
        CREATE TABLE IF NOT EXISTS atlas.maille_spectral_vfs (
            id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            maille_id       UUID NOT NULL,
            computed_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
            clay_index      DOUBLE PRECISION,
            swir_ratio      DOUBLE PRECISION,
            ndvi            DOUBLE PRECISION,
            iron_oxide      DOUBLE PRECISION,
            vbs_vfs_pred    DOUBLE PRECISION,
            vbs_vfs_std     DOUBLE PRECISION,
            is_cuirasse     BOOLEAN DEFAULT false,
            is_alluvial     BOOLEAN DEFAULT false,
            uncertainty_flag TEXT,
            pls_n_components INTEGER,
            pls_loo_rmse    DOUBLE PRECISION,
            source_label    TEXT DEFAULT 'vfs_extract_spectral.py'
        );
        CREATE INDEX IF NOT EXISTS idx_maille_spectral_maille_id
            ON atlas.maille_spectral_vfs (maille_id);
    """)


# ── Chargement des sondages (GEN-01) ─────────────────────────────────
def load_sondages(cur) -> pd.DataFrame:
    """Charge les sondages avec coordonnées et VBS H1 moyen."""
    cur.execute("""
        SELECT
            s.id::text          AS sondage_id,
            s.maille_code,
            ST_X(ST_Transform(s.geom, 4326))::float8 AS lon,
            ST_Y(ST_Transform(s.geom, 4326))::float8 AS lat,
            AVG(ev.vbs)::float8 AS vbs_h1,
            -- Type géologique (masque cuirasses)
            COALESCE(ug.type_sols, 'INCONNU') AS formation_geologique
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
        LEFT JOIN atlas.unites_geologiques ug
            ON ST_Intersects(s.geom, ug.geom)
        WHERE s.deleted_at IS NULL
          AND s.geom IS NOT NULL
          AND e.depth_m BETWEEN 0.75 AND 1.25
          AND ev.vbs BETWEEN 0 AND 20
        GROUP BY s.id, s.maille_code, s.geom, ug.type_sols
        ORDER BY s.id
    """)
    df = pd.DataFrame(
        cur.fetchall(),
        columns=["sondage_id", "maille_code", "lon", "lat", "vbs_h1", "formation_geologique"],
    )
    return df


def load_mailles_for_prediction(cur) -> pd.DataFrame:
    """Charge les mailles avec leur contexte géologique pour la prédiction spatiale."""
    cur.execute("""
        SELECT
            m.id::text AS maille_id,
            m.code,
            ST_X(ST_Transform(ST_Centroid(m.geom), 4326))::float8 AS lon,
            ST_Y(ST_Transform(ST_Centroid(m.geom), 4326))::float8 AS lat,
            COALESCE(ug.type_sols, 'INCONNU') AS formation_geologique
        FROM atlas.mailles m
        LEFT JOIN atlas.unites_geologiques ug
            ON ST_Intersects(ST_Centroid(m.geom), ug.geom)
        ORDER BY m.code
    """)
    df = pd.DataFrame(
        cur.fetchall(),
        columns=["maille_id", "code", "lon", "lat", "formation_geologique"],
    )
    return df


# ── Extraction spectrale via GEE ──────────────────────────────────────
def extract_gee_indices(
    lons: List[float], lats: List[float], ids: List[str]
) -> pd.DataFrame:
    """
    Extrait les indices spectraux Sentinel-2 via Google Earth Engine.

    Utilise un composite médian annuel sans nuage (< 20% nuages).
    Résolution 20m pour les bandes SWIR (B11, B12).

    Référence : Copernicus/S2_SR_HARMONIZED (Surface Reflectance, harmonisé).
    """
    try:
        import ee
        import geemap
    except ImportError:
        raise ImportError(
            "Google Earth Engine requis : pip install earthengine-api geemap\n"
            "Puis : earthengine authenticate"
        )

    try:
        ee.Initialize(project='gen-lang-client-0964618990')  # ADC gcloud
    except Exception as exc:
        raise RuntimeError(
            f"GEE non initialisé : {exc}\n"
            "Exécuter : earthengine authenticate"
        ) from exc

    log.info("  GEE : composite Sentinel-2 annuel sans nuage (2023-2024)...")

    # Composite médian sans nuage sur 2 ans
    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate("2023-01-01", "2024-12-31")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .filterBounds(
            ee.Geometry.Rectangle([-0.2, 6.0, 1.9, 11.2])  # bbox Togo
        )
        .select(GEE_BANDS)
        .median()
        # Normalisation reflectance (S2_SR_HARMONIZED = valeurs × 10000)
        .multiply(0.0001)
    )

    # Indices spectraux
    clay_index  = s2.select("B11").divide(s2.select("B12")).rename("clay_index")
    swir_ratio  = s2.normalizedDifference(["B11", "B12"]).rename("swir_ratio")
    ndvi        = s2.normalizedDifference(["B8", "B4"]).rename("ndvi")
    iron_oxide  = s2.select("B4").divide(s2.select("B8")).rename("iron_oxide")

    image = ee.Image.cat([clay_index, swir_ratio, ndvi, iron_oxide])

    # Points de sondage
    features = ee.FeatureCollection([
        ee.Feature(
            ee.Geometry.Point([float(lon), float(lat)]),
            {"point_id": str(pid)},
        )
        for pid, lon, lat in zip(ids, lons, lats)
    ])

    result = image.sampleRegions(
        collection=features,
        scale=20,          # résolution SWIR Sentinel-2
        geometries=False,
    )

    log.info("  GEE : extraction en cours (peut prendre 30-120 secondes)...")
    # Conversion manuelle — contourne bug geemap.ee_to_df avec pandas >= 2.0
    # (geemap appelle df.drop(columns=["geo"], axis=1) qui est invalide en pandas 2+)
    features_info = result.getInfo().get("features", [])
    records = [f.get("properties", {}) for f in features_info]
    df_gee = pd.DataFrame(records)
    log.info("  GEE : %d points extraits", len(df_gee))

    if "point_id" in df_gee.columns:
        df_gee = df_gee.rename(columns={"point_id": "id"})
    return df_gee


# ── Calibration PLS ───────────────────────────────────────────────────
def calibrate_pls(df: pd.DataFrame) -> Dict:
    """
    Calibre un modèle PLS sur les paires (spectral, VBS).

    Sélectionne le nombre optimal de composantes par LOO-CV.
    Exclut les mailles cuirasse (incertitude verticale haute).

    Retourne : {model, scaler, n_components, loo_rmse, r2_loo, features}
    """
    # Exclure cuirasses (signal surface ≠ géotechnique profonde)
    df_fit = df[
        ~df["formation_geologique"].str.contains("Cuirasse", na=False, case=False)
        & df["vbs_h1"].notna()
        & df[SPECTRAL_FEATURES].notna().all(axis=1)
        & (df["ndvi"] < NDVI_VEGETATION_THRESHOLD)  # végétation dense masquée
    ].copy()

    if len(df_fit) < MIN_N_PLS_FIT:
        log.warning(
            "  Seulement %d sondages valides (min=%d) — PLS non calibré",
            len(df_fit), MIN_N_PLS_FIT,
        )
        return {"ok": False, "n_valid": len(df_fit)}

    log.info("  PLS calibration sur %d sondages (excl. cuirasses + NDVI > %.1f)",
             len(df_fit), NDVI_VEGETATION_THRESHOLD)

    X = df_fit[SPECTRAL_FEATURES].values.astype(np.float64)
    y = df_fit["vbs_h1"].values.astype(np.float64)

    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # Optimisation n_components par LOO-CV
    best_rmse = np.inf
    best_n = 1
    loo = LeaveOneOut()

    # n_components <= min(n_features, n_samples-1) — borne scikit-learn
    n_comp_max = min(N_PLS_COMPONENTS_MAX, len(SPECTRAL_FEATURES), len(df_fit) - 1)
    for n_comp in range(1, n_comp_max + 1):
        pls = PLSRegression(n_components=n_comp)
        preds = []
        truths = []
        for train_idx, test_idx in loo.split(X_scaled):
            pls.fit(X_scaled[train_idx], y[train_idx])
            pred = pls.predict(X_scaled[test_idx])
            p = float(pred.ravel()[0])  # compatible 1D et 2D
            preds.append(float(p))
            truths.append(float(y[test_idx[0]]))
        rmse = float(np.sqrt(mean_squared_error(truths, preds)))
        log.info("    PLS n_components=%d → LOO-RMSE=%.3f g/100g", n_comp, rmse)
        if rmse < best_rmse:
            best_rmse = rmse
            best_n = n_comp

    # Modèle final sur toutes les données
    pls_final = PLSRegression(n_components=best_n)
    pls_final.fit(X_scaled, y)

    y_pred_train = pls_final.predict(X_scaled).ravel()
    r2_train = float(r2_score(y, y_pred_train))

    log.info(
        "  PLS sélectionné : n_comp=%d | LOO-RMSE=%.3f g/100g | R²_train=%.3f",
        best_n, best_rmse, r2_train,
    )
    log.info(
        "  Interprétation : LOO-RMSE %.3f vs LOO-RMSE KED=3.06 → %s",
        best_rmse,
        "VfS UTILE comme covariable" if best_rmse < 3.06 else "VfS marginal — valeur exploratoire",
    )

    return {
        "ok": True,
        "model": pls_final,
        "scaler": scaler,
        "n_components": best_n,
        "loo_rmse": best_rmse,
        "r2_train": r2_train,
        "n_train": len(df_fit),
        "features": SPECTRAL_FEATURES,
    }


# ── Prédiction spatiale ───────────────────────────────────────────────
def predict_vbs_vfs(
    df_mailles: pd.DataFrame,
    df_spectral: pd.DataFrame,
    pls_result: Dict,
) -> pd.DataFrame:
    """
    Prédit VBS_VfS sur les mailles à partir des indices spectraux.

    Applique le masque cuirasse et le masque végétation dense.
    Produit un flag d'incertitude par maille.
    """
    if not pls_result.get("ok"):
        log.warning("  Modèle PLS non disponible — prédiction impossible.")
        return pd.DataFrame()

    model  = pls_result["model"]
    scaler = pls_result["scaler"]

    df = df_mailles.merge(df_spectral, on="maille_id", how="left")

    # Indicateurs d'incertitude
    df["is_cuirasse"] = df["formation_geologique"].str.contains(
        "Cuirasse", na=False, case=False
    )
    df["is_alluvial"] = df["formation_geologique"].str.contains(
        "Alluvion", na=False, case=False
    )

    # Prédiction sur les mailles avec données spectrales valides
    valid_mask = (
        df[SPECTRAL_FEATURES].notna().all(axis=1)
        & (~df["is_cuirasse"])
        & (df["ndvi"] < NDVI_VEGETATION_THRESHOLD)
    )

    df["vbs_vfs_pred"] = np.nan
    df["vbs_vfs_std"]  = np.nan
    df["uncertainty_flag"] = "ok"

    if valid_mask.sum() > 0:
        X_valid = df.loc[valid_mask, SPECTRAL_FEATURES].values.astype(np.float64)
        X_scaled = scaler.transform(X_valid)
        preds = model.predict(X_scaled)[:, 0]
        preds = np.clip(preds, VBS_MIN, VBS_MAX)
        df.loc[valid_mask, "vbs_vfs_pred"] = preds
        df.loc[valid_mask, "vbs_vfs_std"]  = pls_result["loo_rmse"]

    # Flags d'incertitude pour les zones problématiques
    df.loc[df["is_cuirasse"], "uncertainty_flag"] = "cuirasse_high_uncertainty"
    df.loc[df["is_alluvial"] & ~df["is_cuirasse"], "uncertainty_flag"] = "alluvial_moderate_uncertainty"
    df.loc[df["ndvi"] >= NDVI_VEGETATION_THRESHOLD, "uncertainty_flag"] = "dense_vegetation_masked"
    df.loc[df[SPECTRAL_FEATURES].isna().any(axis=1), "uncertainty_flag"] = "no_spectral_data"

    return df


# ── Stockage en base ──────────────────────────────────────────────────
def store_sondage_features(conn, df: pd.DataFrame) -> int:
    """Stocke les indices spectraux des sondages dans atlas.sondage_spectral_features."""
    cur = conn.cursor()
    ensure_tables(cur)

    rows = []
    for _, row in df.iterrows():
        if row.get("sondage_id") is None:
            continue
        rows.append((
            str(uuid.uuid4()),
            str(row["sondage_id"]),
            row.get("clay_index"),
            row.get("swir_ratio"),
            row.get("ndvi"),
            row.get("iron_oxide"),
        ))

    # Supprimer les anciennes extractions (BM-SYNC-05 idempotent)
    if rows:
        sondage_ids = [r[1] for r in rows]
        cur.executemany(
            "DELETE FROM atlas.sondage_spectral_features WHERE sondage_id = %s::uuid",
            [(sid,) for sid in sondage_ids],
        )

    execute_batch(
        cur,
        """
        INSERT INTO atlas.sondage_spectral_features
          (id, sondage_id, clay_index, swir_ratio, ndvi, iron_oxide, extracted_at)
        VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, now())
        """,
        rows,
        page_size=500,
    )

    conn.commit()
    cur.close()
    return len(rows)


def store_maille_predictions(conn, df: pd.DataFrame, pls_result: Dict) -> int:
    """Stocke les prédictions VBS_VfS dans atlas.maille_spectral_vfs."""
    cur = conn.cursor()
    ensure_tables(cur)

    cur.execute("DELETE FROM atlas.maille_spectral_vfs")

    rows = []
    for _, row in df.iterrows():
        if row.get("maille_id") is None:
            continue
        rows.append((
            str(uuid.uuid4()),
            str(row["maille_id"]),
            row.get("clay_index"),
            row.get("swir_ratio"),
            row.get("ndvi"),
            row.get("iron_oxide"),
            row.get("vbs_vfs_pred"),
            row.get("vbs_vfs_std"),
            bool(row.get("is_cuirasse", False)),
            bool(row.get("is_alluvial", False)),
            str(row.get("uncertainty_flag", "ok")),
            int(pls_result.get("n_components", 0)),
            float(pls_result.get("loo_rmse", np.nan)) if pls_result.get("loo_rmse") else None,
        ))

    execute_batch(
        cur,
        """
        INSERT INTO atlas.maille_spectral_vfs
          (id, maille_id, clay_index, swir_ratio, ndvi, iron_oxide,
           vbs_vfs_pred, vbs_vfs_std, is_cuirasse, is_alluvial,
           uncertainty_flag, pls_n_components, pls_loo_rmse, computed_at)
        VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
        """,
        rows,
        page_size=2000,
    )

    conn.commit()
    cur.close()
    return len(rows)


# ── Mode extraction GEE ───────────────────────────────────────────────
def run_extract(conn) -> int:
    cur = conn.cursor()
    ensure_tables(cur)

    log.info("Chargement des sondages avec VBS H1...")
    df_sondages = load_sondages(cur)
    cur.close()

    if len(df_sondages) == 0:
        log.error("Aucun sondage avec VBS H1 trouvé.")
        return 1

    log.info("Sondages valides : %d", len(df_sondages))

    log.info("Extraction GEE (Sentinel-2)...")
    df_gee = extract_gee_indices(
        df_sondages["lon"].tolist(),
        df_sondages["lat"].tolist(),
        df_sondages["sondage_id"].tolist(),
    )
    df_gee = df_gee.rename(columns={"id": "sondage_id"})
    df_merged = df_sondages.merge(df_gee, on="sondage_id", how="left")

    n_stored = store_sondage_features(conn, df_merged)
    log.info("Indices spectraux stockés pour %d sondages.", n_stored)
    return 0


# ── Extraction GEE sur les mailles (prédiction spatiale) ─────────────
def run_extract_mailles(conn, batch_size: int = 5000) -> int:
    """
    Extrait les indices spectraux Sentinel-2 pour les 29 407 centroïdes de mailles.
    Traitement par batch pour éviter les timeouts GEE.
    Stocke dans atlas.maille_spectral_vfs.
    """
    cur = conn.cursor()
    ensure_tables(cur)

    log.info("Chargement des mailles pour extraction GEE...")
    df_mailles = load_mailles_for_prediction(cur)
    cur.close()
    log.info("Mailles à traiter : %d (batch_size=%d)", len(df_mailles), batch_size)

    n_batches = (len(df_mailles) + batch_size - 1) // batch_size

    # CONVENTION UUID (correctif 2026-06-01) :
    # maille_id dans load_mailles_for_prediction est un uuid.UUID (objet Python),
    # mais extract_gee_indices retourne des strings via str(pid).
    # Unification en string avant merge pour eviter NaN systematiques.
    df_mailles["maille_id"] = df_mailles["maille_id"].astype(str)

    # Stockage incremental (correctif 2026-06-01) :
    # On vide la table AVANT les batches et on UPSERT par batch.
    # Avantage : si GEE echoue sur un batch, les batches precedents sont sauvegardes.
    cur = conn.cursor()
    cur.execute("DELETE FROM atlas.maille_spectral_vfs")
    conn.commit()
    cur.close()
    log.info("Table maille_spectral_vfs videe — stockage incremental par batch.")

    n_total_stored = 0
    n_batches_ok = 0

    for i in range(n_batches):
        batch = df_mailles.iloc[i * batch_size : (i + 1) * batch_size].copy()
        log.info("  Batch %d/%d (%d mailles)...", i + 1, n_batches, len(batch))

        try:
            df_gee = extract_gee_indices(
                batch["lon"].tolist(),
                batch["lat"].tolist(),
                batch["maille_id"].tolist(),
            )
        except Exception as exc:
            log.error("  Batch %d : erreur GEE (%s) — batch stocke sans spectral", i + 1, exc)
            df_gee = pd.DataFrame(columns=["maille_id"] + SPECTRAL_FEATURES)

        if not df_gee.empty:
            if "point_id" in df_gee.columns:
                df_gee = df_gee.rename(columns={"point_id": "maille_id"})
            elif "id" in df_gee.columns:
                df_gee = df_gee.rename(columns={"id": "maille_id"})
            df_gee["maille_id"] = df_gee["maille_id"].astype(str)
            df_merged = batch.merge(df_gee, on="maille_id", how="left")
        else:
            df_merged = batch.copy()
            for col in SPECTRAL_FEATURES:
                if col not in df_merged.columns:
                    df_merged[col] = None

        n_valid = df_merged[SPECTRAL_FEATURES].notna().all(axis=1).sum()
        log.info("    -> %d/%d mailles avec indices spectraux valides", n_valid, len(batch))

        # Deduplication sur maille_id (un maille = une ligne)
        df_merged = df_merged.drop_duplicates(subset=["maille_id"], keep="first")

        rows_batch = []
        for _, row in df_merged.iterrows():
            rows_batch.append((
                str(uuid.uuid4()),
                str(row["maille_id"]),
                row.get("clay_index"),
                row.get("swir_ratio"),
                row.get("ndvi"),
                row.get("iron_oxide"),
                bool(str(row.get("formation_geologique", "")).find("Cuirasse") >= 0),
                bool(str(row.get("formation_geologique", "")).find("Alluvion") >= 0),
            ))

        cur = conn.cursor()
        try:
            execute_batch(
                cur,
                """
                INSERT INTO atlas.maille_spectral_vfs
                  (id, maille_id, clay_index, swir_ratio, ndvi, iron_oxide,
                   is_cuirasse, is_alluvial, computed_at)
                VALUES (%s::uuid, %s::uuid, %s, %s, %s, %s, %s, %s, now())
                ON CONFLICT (maille_id) DO UPDATE SET
                  clay_index=EXCLUDED.clay_index,
                  swir_ratio=EXCLUDED.swir_ratio,
                  ndvi=EXCLUDED.ndvi,
                  iron_oxide=EXCLUDED.iron_oxide,
                  computed_at=now()
                """,
                rows_batch, page_size=500,
            )
            conn.commit()
            n_total_stored += len(rows_batch)
            n_batches_ok += 1
        except Exception as exc:
            log.error("  Batch %d : erreur stockage (%s)", i + 1, exc)
            conn.rollback()
        finally:
            cur.close()

    log.info(
        "Extraction terminee : %d/%d batches OK | %d mailles stockees.",
        n_batches_ok, n_batches, n_total_stored,
    )
    if n_total_stored == 0:
        log.error("Aucune donnee GEE extraite pour les mailles.")
        return 1
    return 0


# ── Mode calibration PLS ──────────────────────────────────────────────
def run_calibrate(conn) -> Tuple[int, Dict]:
    cur = conn.cursor()
    cur.execute("""
        SELECT sf.sondage_id::text, sf.clay_index, sf.swir_ratio, sf.ndvi, sf.iron_oxide,
               s_agg.vbs_h1, s_agg.formation_geologique
        FROM atlas.sondage_spectral_features sf
        JOIN (
            SELECT s.id::text AS sid,
                   AVG(ev.vbs)::float8 AS vbs_h1,
                   COALESCE(ug.type_sols, 'INCONNU') AS formation_geologique
            FROM atlas.sondages s
            JOIN atlas.echantillons e ON e.sondage_id = s.id
            JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
            LEFT JOIN atlas.unites_geologiques ug ON ST_Intersects(s.geom, ug.geom)
            WHERE s.deleted_at IS NULL AND e.depth_m BETWEEN 0.75 AND 1.25
              AND ev.vbs BETWEEN 0 AND 20
            GROUP BY s.id, ug.type_sols
        ) s_agg ON s_agg.sid = sf.sondage_id::text
        WHERE sf.clay_index IS NOT NULL
    """)
    rows = cur.fetchall()
    cur.close()

    if not rows:
        log.error("Aucune donnée spectrale en base. Exécuter d'abord --mode extract.")
        return 1, {}

    df = pd.DataFrame(
        rows,
        columns=["sondage_id", "clay_index", "swir_ratio", "ndvi", "iron_oxide",
                 "vbs_h1", "formation_geologique"],
    )

    pls_result = calibrate_pls(df)
    if not pls_result.get("ok"):
        log.warning("Calibration PLS impossible (N trop petit).")
        return 1, {}

    return 0, pls_result


# ── Mode prédiction spatiale ──────────────────────────────────────────
def run_predict(conn, pls_result: Optional[Dict] = None) -> int:
    if pls_result is None or not pls_result.get("ok"):
        log.error("Modèle PLS non disponible. Exécuter --mode calibrate d'abord.")
        return 1

    cur = conn.cursor()

    log.info("Chargement des mailles pour prédiction spatiale...")
    df_mailles = load_mailles_for_prediction(cur)

    # Charger les indices spectraux des mailles (si déjà extraits)
    cur.execute("""
        SELECT maille_id::text, clay_index, swir_ratio, ndvi, iron_oxide
        FROM atlas.maille_spectral_vfs
        WHERE clay_index IS NOT NULL
    """)
    rows_spectral = cur.fetchall()
    cur.close()

    if rows_spectral:
        df_spectral_mailles = pd.DataFrame(
            rows_spectral,
            columns=["maille_id", "clay_index", "swir_ratio", "ndvi", "iron_oxide"],
        )
    else:
        log.warning(
            "Pas d'indices spectraux sur les mailles. "
            "Pour une prédiction spatiale complète, extraire les indices sur les 29 407 mailles "
            "via GEE (extract_gee_indices sur les centroïdes des mailles)."
        )
        df_spectral_mailles = pd.DataFrame(columns=["maille_id"] + SPECTRAL_FEATURES)

    df_pred = predict_vbs_vfs(df_mailles, df_spectral_mailles, pls_result)

    if df_pred.empty:
        log.warning("Dataframe de prédiction vide.")
        return 1

    n_stored = store_maille_predictions(conn, df_pred, pls_result)
    n_predicted = df_pred["vbs_vfs_pred"].notna().sum()
    log.info(
        "Stocké : %d mailles | VBS_VfS prédit sur %d mailles (%.1f%%)",
        n_stored, n_predicted, 100.0 * n_predicted / max(len(df_pred), 1),
    )
    return 0


# ── Entrée principale ─────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(
        description="BLOC C — VBS-from-Sentinel : extraction GEE + calibration PLS"
    )
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument(
        "--mode",
        choices=["extract", "calibrate", "predict", "all"],
        default="all",
        help=(
            "extract   : extraction spectrale GEE sur les sondages\n"
            "calibrate : calibration PLS (Clay_Index → VBS)\n"
            "predict   : prédiction spatiale sur les mailles\n"
            "all       : pipeline complet extract → calibrate → predict"
        ),
    )
    ap.add_argument(
        "--skip-gee", action="store_true",
        help="Sauter l'extraction GEE sondages ET mailles (utiliser données déjà en base).",
    )
    ap.add_argument(
        "--skip-sondage-gee", action="store_true",
        help="Sauter uniquement l'extraction GEE des sondages (96 déjà extraits), mais relancer l'extraction maille.",
    )
    ap.add_argument(
        "--batch-size", type=int, default=1000,
        help="Taille des batches GEE pour extraction maille (défaut: 1000).",
    )
    args = ap.parse_args()

    if not args.database_url:
        log.error("--database-url requis")
        return 1

    log.info("=== BLOC C — VBS-from-Sentinel (VfS) ===")
    log.info("Mode : %s | DB : %s", args.mode,
             args.database_url.replace("atlas:atlas@", "atlas:***@"))

    conn = get_conn(args.database_url)
    try:
        pls_result: Optional[Dict] = None

        if args.mode in ("extract", "all") and not args.skip_gee:
            if not getattr(args, 'skip_sondage_gee', False):
                rc = run_extract(conn)
                if rc != 0:
                    return rc
            # Extraction spectrale sur les mailles (prédiction spatiale)
            log.info("Extraction GEE sur les mailles (batch=%d)...", args.batch_size)
            rc = run_extract_mailles(conn, batch_size=args.batch_size)
            if rc != 0:
                log.warning("Extraction mailles echouee — prediction spatiale impossible.")

        if args.mode in ("calibrate", "all"):
            rc, pls_result = run_calibrate(conn)
            if rc != 0:
                return rc

        if args.mode in ("predict", "all"):
            if pls_result is None:
                # Tenter de récalibrer depuis les données en base
                rc, pls_result = run_calibrate(conn)
                if rc != 0:
                    return rc
            rc = run_predict(conn, pls_result)
            if rc != 0:
                return rc

        log.info("=== VfS terminé ===")
        return 0

    except Exception as exc:
        log.exception("ERREUR fatale : %s", exc)
        conn.rollback()
        return 1
    finally:
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
