#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — Génération de cartes thématiques L1-L4
=================================================================
Génère des cartes PNG pour tous les modèles implémentés.

Modèles :
  L1 : KED hiérarchique 5 niveaux (ked_hierarchical_5levels)
  L2a: RK SCORPAN (regression_kriging_scorpan)
  L2b: Fusion Bayésienne KED-RK (ked_rk_fusion_bayesian)
  L3 : VBS-from-Sentinel (maille_spectral_vfs)
  L4 : MTGP GPflow (mtgp_icm_gpflow)

Usage :
  python scripts/generate_maps_l1_l4.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
  python scripts/generate_maps_l1_l4.py --param vbs --horizon h1 --models all
"""
from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2
import matplotlib
matplotlib.use("Agg")  # sans affichage graphique
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
from matplotlib.patches import Patch
from matplotlib.ticker import MaxNLocator

# ── Config ─────────────────────────────────────────────────────────────────
DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")
OUT_DIR = Path("exports/maps")

PARAM_CONFIG = {
    "vbs":  {"label": "VBS (g/100g)", "cmap": "YlOrRd", "vmin": 0, "vmax": 12},
    "ip":   {"label": "IP (%)",       "cmap": "RdYlGn_r", "vmin": 0, "vmax": 50},
    "wl":   {"label": "WL (%)",       "cmap": "Blues",    "vmin": 20, "vmax": 80},
    "wp":   {"label": "WP (%)",       "cmap": "Greens",   "vmin": 10, "vmax": 40},
    "eg":   {"label": "EG (%)",       "cmap": "Reds",     "vmin": 0, "vmax": 10},
}

MODELS_CONFIG = {
    "ked_hier":   {"method": "ked_hierarchical_5levels", "label": "L1 — KED Hierarchique 5 niveaux",  "color": "#2196F3"},
    "rk_scorpan": {"method": "regression_kriging_scorpan","label": "L2a — Regression Kriging SCORPAN", "color": "#4CAF50"},
    "fusion":     {"method": "ked_rk_fusion_bayesian",    "label": "L2b — Fusion Bayesienne KED-RK",  "color": "#9C27B0"},
    "mtgp":       {"method": "mtgp_icm_gpflow",           "label": "L4 — MTGP GPflow ICM",            "color": "#FF5722"},
    "vfs":        {"method": "vfs_spectral",              "label": "L3 — VBS-from-Sentinel (VfS)",    "color": "#FF9800"},
}

HORIZON_MAP = {"h1": "H1 (0.5–1.5m)", "h2": "H2 (1.0–2.0m)", "h3": "H3 (1.5–2.5m)"}


def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    return conn


def load_maille_geometries(conn) -> pd.DataFrame:
    """Charge les centroïdes et géométries simplifiées des mailles."""
    cur = conn.cursor()
    cur.execute("""
        SELECT id::text AS maille_id,
               code,
               ST_X(ST_Transform(ST_PointOnSurface(geom), 4326))::float8 AS lon,
               ST_Y(ST_Transform(ST_PointOnSurface(geom), 4326))::float8 AS lat
        FROM atlas.mailles
        ORDER BY code
    """)
    rows = cur.fetchall()
    cur.close()
    return pd.DataFrame(rows, columns=["maille_id", "code", "lon", "lat"])


def load_interpolation_values(
    conn, param: str, horizon: str, method: str
) -> pd.DataFrame:
    """Charge les valeurs interpolées pour un paramètre/horizon/méthode."""
    parameter_id = f"{param}_ked_{horizon}" if "ked" in method else f"{param}_{method.split('_')[0]}_{horizon}"

    # Construire le parameter_id selon la méthode
    if method == "ked_hierarchical_5levels":
        parameter_id = f"{param}_ked_{horizon}"
    elif method == "regression_kriging_scorpan":
        parameter_id = f"{param}_rk_{horizon}"
    elif method == "ked_rk_fusion_bayesian":
        parameter_id = f"{param}_fusion_{horizon}"
    elif method == "mtgp_icm_gpflow":
        parameter_id = f"{param}_mtgp_{horizon}"
    else:
        parameter_id = f"{param}_{horizon}"

    cur = conn.cursor()
    cur.execute("""
        SELECT maille_id::text, value, variance
        FROM atlas.ai_interpolation_values
        WHERE parameter_id = %s
          AND method = %s
          AND COALESCE(is_superseded, false) = false
    """, (parameter_id, method))
    rows = cur.fetchall()
    cur.close()
    if not rows:
        return pd.DataFrame(columns=["maille_id", "value", "variance"])
    return pd.DataFrame(rows, columns=["maille_id", "value", "variance"])


def load_vfs_predictions(conn) -> pd.DataFrame:
    """Charge les prédictions VfS (L3)."""
    cur = conn.cursor()
    cur.execute("""
        SELECT maille_id::text, vbs_vfs_pred, vbs_vfs_std, uncertainty_flag
        FROM atlas.maille_spectral_vfs
        WHERE vbs_vfs_pred > 0 AND vbs_vfs_pred < 20
    """)
    rows = cur.fetchall()
    cur.close()
    return pd.DataFrame(rows, columns=["maille_id", "vbs_vfs_pred", "vbs_vfs_std", "uncertainty_flag"])


def load_sondages(conn) -> pd.DataFrame:
    """Charge les sondages pour affichage en overlay."""
    cur = conn.cursor()
    cur.execute("""
        SELECT code,
               ST_X(ST_Transform(geom, 4326))::float8 AS lon,
               ST_Y(ST_Transform(geom, 4326))::float8 AS lat
        FROM atlas.sondages
        WHERE deleted_at IS NULL AND geom IS NOT NULL
    """)
    rows = cur.fetchall()
    cur.close()
    return pd.DataFrame(rows, columns=["code", "lon", "lat"])


def make_scatter_map(
    df_geo: pd.DataFrame,
    values: pd.Series,
    title: str,
    param: str,
    out_path: Path,
    sondages: pd.DataFrame = None,
    variance: pd.Series = None,
    subtitle: str = "",
) -> None:
    """Génère une carte scatter (centroïdes mailles colorisés par valeur)."""
    cfg = PARAM_CONFIG.get(param, {"label": param, "cmap": "viridis", "vmin": None, "vmax": None})

    fig, axes = plt.subplots(1, 2 if variance is not None else 1,
                              figsize=(16 if variance is not None else 10, 8))
    if variance is None:
        axes = [axes]

    # — Carte valeur ——————————————————————————————————————
    ax = axes[0]
    sc = ax.scatter(
        df_geo["lon"], df_geo["lat"],
        c=values, cmap=cfg["cmap"],
        vmin=cfg["vmin"], vmax=cfg["vmax"],
        s=2.5, alpha=0.8, linewidths=0, rasterized=True,
    )
    if sondages is not None and len(sondages) > 0:
        ax.scatter(sondages["lon"], sondages["lat"],
                   c="black", s=20, marker="^", zorder=5,
                   label=f"Sondages (N={len(sondages)})")
        ax.legend(fontsize=8, loc="lower right")

    cbar = fig.colorbar(sc, ax=ax, shrink=0.7, pad=0.01)
    cbar.set_label(cfg["label"], fontsize=9)
    ax.set_title(title, fontsize=10, fontweight="bold", wrap=True)
    ax.set_xlabel("Longitude (°)", fontsize=8)
    ax.set_ylabel("Latitude (°)", fontsize=8)
    ax.tick_params(labelsize=7)
    if subtitle:
        ax.set_title(f"{title}\n{subtitle}", fontsize=9, fontweight="bold")

    # — Carte variance ——————————————————————————————————————
    if variance is not None:
        ax2 = axes[1]
        var_clean = variance.clip(lower=0)
        sc2 = ax2.scatter(
            df_geo["lon"], df_geo["lat"],
            c=var_clean, cmap="plasma_r",
            s=2.5, alpha=0.8, linewidths=0, rasterized=True,
        )
        cbar2 = fig.colorbar(sc2, ax=ax2, shrink=0.7, pad=0.01)
        cbar2.set_label(f"σ² ({cfg['label']})", fontsize=9)
        ax2.set_title(f"Incertitude (σ²)\n{subtitle}", fontsize=9)
        ax2.set_xlabel("Longitude (°)", fontsize=8)
        ax2.set_ylabel("Latitude (°)", fontsize=8)
        ax2.tick_params(labelsize=7)

    fig.suptitle(f"Atlas Géotechnique Togo — {title}", fontsize=11, fontweight="bold", y=1.01)
    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(out_path), dpi=120, bbox_inches="tight")
    plt.close(fig)
    print(f"  Carte : {out_path.name} ({len(df_geo)} mailles)")


def generate_comparison_map(
    df_geo: pd.DataFrame,
    datasets: list[dict],
    param: str,
    horizon: str,
    out_path: Path,
    sondages: pd.DataFrame = None,
) -> None:
    """Carte comparative multi-modèles (L1 / L2a / L2b / L4) côte à côte."""
    cfg = PARAM_CONFIG.get(param, {"label": param, "cmap": "YlOrRd", "vmin": None, "vmax": None})
    n = len(datasets)
    fig, axes = plt.subplots(1, n, figsize=(6 * n, 7))
    if n == 1:
        axes = [axes]

    for ax, ds in zip(axes, datasets):
        df_merged = df_geo.merge(ds["data"], on="maille_id", how="left")
        sc = ax.scatter(
            df_merged["lon"], df_merged["lat"],
            c=df_merged["value"], cmap=cfg["cmap"],
            vmin=cfg["vmin"], vmax=cfg["vmax"],
            s=2.0, alpha=0.8, linewidths=0, rasterized=True,
        )
        if sondages is not None:
            ax.scatter(sondages["lon"], sondages["lat"],
                       c="black", s=15, marker="^", zorder=5)
        cbar = fig.colorbar(sc, ax=ax, shrink=0.65, pad=0.01)
        cbar.set_label(cfg["label"], fontsize=8)
        ax.set_title(ds["label"], fontsize=9, fontweight="bold", wrap=True)
        ax.tick_params(labelsize=6)
        n_valid = df_merged["value"].notna().sum()
        ax.set_xlabel(f"N={n_valid} mailles prédites", fontsize=7)

    hz_label = HORIZON_MAP.get(horizon, horizon)
    fig.suptitle(
        f"Atlas Géotechnique Togo — {param.upper()} {hz_label}\nComparaison modèles L1–L4",
        fontsize=11, fontweight="bold"
    )
    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    fig.savefig(str(out_path), dpi=120, bbox_inches="tight")
    plt.close(fig)
    print(f"  Comparaison : {out_path.name}")


def main():
    ap = argparse.ArgumentParser(description="Générer cartes thématiques L1-L4")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--param", default="vbs", choices=list(PARAM_CONFIG.keys()))
    ap.add_argument("--horizon", default="h1", choices=["h1", "h2", "h3"])
    ap.add_argument("--models", default="all",
                    help="Modèles à cartographier : all ou ked_hier,rk_scorpan,fusion,mtgp,vfs")
    ap.add_argument("--out-dir", default=str(OUT_DIR))
    ap.add_argument("--compare", action="store_true", help="Générer carte comparative multi-modèles")
    args = ap.parse_args()

    out_dir = Path(args.out_dir)
    out_dir.mkdir(parents=True, exist_ok=True)

    print(f"=== Génération cartes Atlas — {args.param.upper()} {args.horizon.upper()} ===")
    conn = get_conn(args.database_url)

    print("Chargement géométries mailles...")
    df_geo = load_maille_geometries(conn)
    print(f"  {len(df_geo)} mailles chargées")

    print("Chargement sondages...")
    sondages = load_sondages(conn)
    print(f"  {len(sondages)} sondages")

    models = list(MODELS_CONFIG.keys()) if args.models == "all" else args.models.split(",")

    comparison_datasets = []

    # — Cartes individuelles ——————————————————————————————
    for model_key in models:
        if model_key not in MODELS_CONFIG:
            print(f"  Modèle inconnu: {model_key}")
            continue
        mc = MODELS_CONFIG[model_key]

        # Cas spécial VfS (pas de notion d'horizon pour la prédiction spatiale)
        if model_key == "vfs" or mc["method"] == "vfs_spectral":
            if args.param != "vbs":
                continue
            print(f"\nChargement L3 VfS...")
            df_vfs = load_vfs_predictions(conn)
            if df_vfs.empty:
                print("  Pas de données VfS")
                continue
            df_merged = df_geo.merge(df_vfs, on="maille_id", how="left")
            df_merged = df_merged.rename(columns={"vbs_vfs_pred": "value", "vbs_vfs_std": "variance"})
            out_path = out_dir / f"vbs_L3_vfs.png"
            make_scatter_map(
                df_merged, df_merged["value"],
                title="L3 — VBS-from-Sentinel (VfS PLS)",
                param=args.param, out_path=out_path,
                sondages=sondages,
                variance=df_merged["variance"],
                subtitle=f"PLS LOO-RMSE = 2.788 g/100g | N=24038 mailles (82%)",
            )
            continue

        print(f"\nChargement {mc['label']} ({args.param} {args.horizon})...")
        df_vals = load_interpolation_values(conn, args.param, args.horizon, mc["method"])
        if df_vals.empty:
            print(f"  Pas de données pour {mc['method']}")
            continue

        df_merged = df_geo.merge(df_vals, on="maille_id", how="left")
        n_valid = df_merged["value"].notna().sum()
        print(f"  {n_valid}/{len(df_merged)} mailles avec valeurs")

        hz_label = HORIZON_MAP.get(args.horizon, args.horizon)
        out_path = out_dir / f"{args.param}_{model_key}_{args.horizon}.png"
        make_scatter_map(
            df_merged, df_merged["value"],
            title=mc["label"],
            param=args.param, out_path=out_path,
            sondages=sondages,
            variance=df_merged.get("variance"),
            subtitle=f"{hz_label} | N={n_valid} mailles",
        )

        if args.compare:
            comparison_datasets.append({
                "label": mc["label"].split("—")[1].strip() if "—" in mc["label"] else mc["label"],
                "data": df_vals,
            })

    # — Carte comparative ———————————————————————————————————
    if args.compare and len(comparison_datasets) > 1:
        print(f"\nGénération carte comparative ({len(comparison_datasets)} modèles)...")
        hz_label = HORIZON_MAP.get(args.horizon, args.horizon)
        out_path = out_dir / f"{args.param}_comparison_{args.horizon}.png"
        generate_comparison_map(df_geo, comparison_datasets, args.param, args.horizon, out_path, sondages)

    conn.close()
    print(f"\nCartes enregistrées dans : {out_dir.resolve()}")


if __name__ == "__main__":
    main()
