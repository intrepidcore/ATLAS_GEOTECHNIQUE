#!/usr/bin/env python3
"""
headless_render_300dpi.py
Renderer headless autonome — lit les predictions depuis atlas.ai_interpolation_values
et produit des PDF/PNG A4 a 300 DPI avec cadre cartographique complet.

Equivalent Python du moteur Node.js atlas-headless (Sprint 2-3) :
- Pas besoin d'un navigateur ou UI en cours
- Produit la meme qualite de rendu que le frontend
- Utilisable en ligne de commande ou via pipeline CI

Usage:
  python headless_render_300dpi.py --param vbs_ked_h1
  python headless_render_300dpi.py --all
  python headless_render_300dpi.py --param gamma_d_ked_h1 --out /tmp/exports
"""
from __future__ import annotations

import argparse
import math
import os
import sys
import time
from pathlib import Path
from typing import Dict, List, Optional, Tuple

import matplotlib
matplotlib.use("Agg")  # headless — pas d'affichage
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.patches as mpatches
import matplotlib.patheffects as pe
from matplotlib.patches import FancyArrowPatch
from matplotlib.ticker import FuncFormatter
import numpy as np
import psycopg2
import geopandas as gpd
from shapely.geometry import shape
from shapely import wkb
import warnings
warnings.filterwarnings("ignore")

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

# ── Dimensions A4 a 300 DPI ──────────────────────────────────────────────────
# A4 = 210 x 297 mm = 2480 x 3508 px @ 300 DPI
# En landscape: 297 x 210 mm = 3508 x 2480 px
A4_W_IN = 297 / 25.4   # 11.69 pouces (landscape)
A4_H_IN = 210 / 25.4   # 8.27 pouces
DPI = 300

# ── Metadonnees parametres ───────────────────────────────────────────────────
PARAM_META: Dict[str, Dict] = {
    # VBS — Valeur de Bleu de Methylene
    "vbs_ked_h1":    {"label": "VBS — Valeur de Bleu de Methylene", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H1 (0-1 m)"},
    "vbs_ked_h2":    {"label": "VBS — Valeur de Bleu de Methylene", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H2 (1-1.5 m)"},
    "vbs_ked_h3":    {"label": "VBS — Valeur de Bleu de Methylene", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H3 (>1.5 m)"},
    "vbs_rk_h1":     {"label": "VBS RK-SCORPAN", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H1"},
    "vbs_rk_h2":     {"label": "VBS RK-SCORPAN", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H2 (1-1.5 m)"},
    "vbs_rk_h3":     {"label": "VBS RK-SCORPAN", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H3 (>1.5 m)"},
    "vbs_fusion_h1": {"label": "VBS — Fusion KED+RK", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H1 (0-1 m)"},
    "vbs_fusion_h2": {"label": "VBS — Fusion KED+RK", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H2 (1-1.5 m)"},
    "vbs_fusion_h3": {"label": "VBS — Fusion KED+RK", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H3 (>1.5 m)"},
    "vbs_mtgp_h1":   {"label": "VBS — MTGP", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H1 (0-1 m)"},
    "vbs_mtgp_h2":   {"label": "VBS — MTGP", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H2 (1-1.5 m)"},
    "vbs_mtgp_h3":   {"label": "VBS — MTGP", "unit": "g/100g", "cmap": "YlOrRd", "vmin": 0, "vmax": 10, "horizon": "H3 (>1.5 m)"},
    # IP — Indice de Plasticite
    "ip_ked_h1":     {"label": "Indice de Plasticite (IP)", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H1 (0-1 m)"},
    "ip_ked_h2":     {"label": "Indice de Plasticite (IP)", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H2 (1-1.5 m)"},
    "ip_ked_h3":     {"label": "Indice de Plasticite (IP)", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H3 (>1.5 m)"},
    "ip_rk_h1":      {"label": "IP RK-SCORPAN", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H1 (0-1 m)"},
    "ip_rk_h2":      {"label": "IP RK-SCORPAN", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H2 (1-1.5 m)"},
    "ip_rk_h3":      {"label": "IP RK-SCORPAN", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H3 (>1.5 m)"},
    "ip_fusion_h1":  {"label": "IP — Fusion KED+RK", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H1 (0-1 m)"},
    "ip_fusion_h2":  {"label": "IP — Fusion KED+RK", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H2 (1-1.5 m)"},
    "ip_fusion_h3":  {"label": "IP — Fusion KED+RK", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H3 (>1.5 m)"},
    "ip_mtgp_h1":    {"label": "IP — MTGP", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H1 (0-1 m)"},
    "ip_mtgp_h2":    {"label": "IP — MTGP", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H2 (1-1.5 m)"},
    "ip_mtgp_h3":    {"label": "IP — MTGP", "unit": "%", "cmap": "PuRd", "vmin": 5, "vmax": 50, "horizon": "H3 (>1.5 m)"},
    # WL — Limite de Liquidite
    "wl_ked_h1":     {"label": "Limite de Liquidite (WL)", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H1 (0-1 m)"},
    "wl_ked_h2":     {"label": "Limite de Liquidite (WL)", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H2 (1-1.5 m)"},
    "wl_ked_h3":     {"label": "Limite de Liquidite (WL)", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H3 (>1.5 m)"},
    "wl_rk_h1":      {"label": "WL RK-SCORPAN", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H1 (0-1 m)"},
    "wl_rk_h2":      {"label": "WL RK-SCORPAN", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H2 (1-1.5 m)"},
    "wl_rk_h3":      {"label": "WL RK-SCORPAN", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H3 (>1.5 m)"},
    "wl_fusion_h1":  {"label": "WL — Fusion KED+RK", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H1 (0-1 m)"},
    "wl_fusion_h2":  {"label": "WL — Fusion KED+RK", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H2 (1-1.5 m)"},
    "wl_fusion_h3":  {"label": "WL — Fusion KED+RK", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H3 (>1.5 m)"},
    "wl_mtgp_h1":    {"label": "WL — MTGP", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H1 (0-1 m)"},
    "wl_mtgp_h2":    {"label": "WL — MTGP", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H2 (1-1.5 m)"},
    "wl_mtgp_h3":    {"label": "WL — MTGP", "unit": "%", "cmap": "Blues", "vmin": 10, "vmax": 80, "horizon": "H3 (>1.5 m)"},
    # WP — Limite de Plasticite
    "wp_ked_h1":     {"label": "Limite de Plasticite (WP)", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H1 (0-1 m)"},
    "wp_ked_h2":     {"label": "Limite de Plasticite (WP)", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H2 (1-1.5 m)"},
    "wp_ked_h3":     {"label": "Limite de Plasticite (WP)", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H3 (>1.5 m)"},
    "wp_rk_h1":      {"label": "WP RK-SCORPAN", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H1 (0-1 m)"},
    "wp_rk_h2":      {"label": "WP RK-SCORPAN", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H2 (1-1.5 m)"},
    "wp_rk_h3":      {"label": "WP RK-SCORPAN", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H3 (>1.5 m)"},
    "wp_fusion_h1":  {"label": "WP — Fusion KED+RK", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H1 (0-1 m)"},
    "wp_fusion_h2":  {"label": "WP — Fusion KED+RK", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H2 (1-1.5 m)"},
    "wp_fusion_h3":  {"label": "WP — Fusion KED+RK", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H3 (>1.5 m)"},
    "wp_mtgp_h1":    {"label": "WP — MTGP", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H1 (0-1 m)"},
    "wp_mtgp_h2":    {"label": "WP — MTGP", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H2 (1-1.5 m)"},
    "wp_mtgp_h3":    {"label": "WP — MTGP", "unit": "%", "cmap": "BuPu", "vmin": 5, "vmax": 40, "horizon": "H3 (>1.5 m)"},
    # EG — Potentiel de Gonflement
    "eg_ked_h1":     {"label": "Potentiel de Gonflement (EG)", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H1 (0-1 m)"},
    "eg_ked_h2":     {"label": "Potentiel de Gonflement (EG)", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H2 (1-1.5 m)"},
    "eg_ked_h3":     {"label": "Potentiel de Gonflement (EG)", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H3 (>1.5 m)"},
    "eg_rk_h1":      {"label": "EG RK-SCORPAN", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H1 (0-1 m)"},
    "eg_rk_h2":      {"label": "EG RK-SCORPAN", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H2 (1-1.5 m)"},
    "eg_rk_h3":      {"label": "EG RK-SCORPAN", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H3 (>1.5 m)"},
    "eg_fusion_h1":  {"label": "EG — Fusion KED+RK", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H1 (0-1 m)"},
    "eg_fusion_h2":  {"label": "EG — Fusion KED+RK", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H2 (1-1.5 m)"},
    "eg_fusion_h3":  {"label": "EG — Fusion KED+RK", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H3 (>1.5 m)"},
    "eg_mtgp_h1":    {"label": "EG — MTGP", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H1 (0-1 m)"},
    "eg_mtgp_h2":    {"label": "EG — MTGP", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H2 (1-1.5 m)"},
    "eg_mtgp_h3":    {"label": "EG — MTGP", "unit": "%", "cmap": "RdYlGn_r", "vmin": 0, "vmax": 12, "horizon": "H3 (>1.5 m)"},
    # Rd — Resistance Dynamique
    "rd_mpa_ked_h1": {"label": "Resistance Dynamique (Rd)", "unit": "MPa", "cmap": "Greens", "vmin": 0, "vmax": 20, "horizon": "H1 (0-1 m)"},
    "rd_mpa_ked_h2": {"label": "Resistance Dynamique (Rd)", "unit": "MPa", "cmap": "Greens", "vmin": 0, "vmax": 30, "horizon": "H2 (1-1.5 m)"},
    "rd_mpa_ked_h3": {"label": "Resistance Dynamique (Rd)", "unit": "MPa", "cmap": "Greens", "vmin": 0, "vmax": 40, "horizon": "H3 (>1.5 m)"},
    # CBR
    "cbr_95_ked_h1": {"label": "CBR 95% Proctor", "unit": "%", "cmap": "RdYlGn", "vmin": 0, "vmax": 80, "horizon": "H1 (0-1 m)"},
    # Gamma d
    "gamma_d_ked_h1":{"label": "Densite Seche Maximale (gamma_d)", "unit": "g/cm3", "cmap": "copper_r", "vmin": 1.6, "vmax": 2.2, "horizon": "H1 (0-1 m)"},
    # w_opt
    "w_opt_ked_h1":  {"label": "Teneur en eau Optimale (w_opt)", "unit": "%", "cmap": "Blues", "vmin": 5, "vmax": 25, "horizon": "H1 (0-1 m)"},
    # Passants granulometriques
    "passant_2mm_ked_h1":  {"label": "Passant 2 mm", "unit": "%", "cmap": "YlGn", "vmin": 0, "vmax": 100, "horizon": "H1 (0-1 m)"},
    "passant_2mm_ked_h2":  {"label": "Passant 2 mm", "unit": "%", "cmap": "YlGn", "vmin": 0, "vmax": 100, "horizon": "H2 (1-1.5 m)"},
    "passant_2mm_ked_h3":  {"label": "Passant 2 mm", "unit": "%", "cmap": "YlGn", "vmin": 0, "vmax": 100, "horizon": "H3 (>1.5 m)"},
    "passant_80um_ked_h1": {"label": "Passant 80 um (fines)", "unit": "%", "cmap": "OrRd", "vmin": 0, "vmax": 100, "horizon": "H1 (0-1 m)"},
    "passant_80um_ked_h2": {"label": "Passant 80 um (fines)", "unit": "%", "cmap": "OrRd", "vmin": 0, "vmax": 100, "horizon": "H2 (1-1.5 m)"},
    "passant_80um_ked_h3": {"label": "Passant 80 um (fines)", "unit": "%", "cmap": "OrRd", "vmin": 0, "vmax": 100, "horizon": "H3 (>1.5 m)"},
    # Modules pressiometriques
    "em_mpa_ked_h1": {"label": "Module Pressiometrique (Em)", "unit": "MPa", "cmap": "Spectral", "vmin": 0, "vmax": 30, "horizon": "H1 (0-1 m)"},
    "em_mpa_ked_h3": {"label": "Module Pressiometrique (Em)", "unit": "MPa", "cmap": "Spectral", "vmin": 0, "vmax": 60, "horizon": "H3 (>1.5 m)"},
    "pl_mpa_ked_h1": {"label": "Pression Limite (Pl)", "unit": "MPa", "cmap": "RdYlGn", "vmin": 0, "vmax": 2, "horizon": "H1 (0-1 m)"},
    "pl_mpa_ked_h3": {"label": "Pression Limite (Pl)", "unit": "MPa", "cmap": "RdYlGn", "vmin": 0, "vmax": 4, "horizon": "H3 (>1.5 m)"},
    # VfS — Prediction spectrale Sentinel-2 (source: atlas.maille_spectral_vfs)
    "vbs_vfs":        {"label": "VBS — Prediction VfS-PLS (Sentinel-2)", "unit": "g/100g", "cmap": "YlOrRd",
                       "horizon": "Surface (Sentinel-2)", "source": "spectral_vfs", "dynamic_range": True},
}

# ── Connexion DB ─────────────────────────────────────────────────────────────

def get_conn(dsn: str = DB_DEFAULT):
    conn = psycopg2.connect(dsn)
    conn.set_client_encoding("UTF8")
    return conn


def load_mailles_gdf(cur) -> gpd.GeoDataFrame:
    """Charge les mailles avec geometrie WGS84."""
    print("  [LOAD] geometries mailles ...", flush=True)
    cur.execute("""
        SELECT id::text AS maille_id,
               code,
               ST_AsEWKB(ST_Transform(geom, 4326)) AS geom_wkb
        FROM atlas.mailles
    """)
    rows = cur.fetchall()
    geoms = [wkb.loads(bytes(r[2])) for r in rows]
    gdf = gpd.GeoDataFrame(
        {"maille_id": [r[0] for r in rows], "code": [r[1] for r in rows]},
        geometry=geoms,
        crs="EPSG:4326",
    )
    print(f"  [LOAD] {len(gdf)} mailles", flush=True)
    return gdf


def load_values(cur, parameter_id: str) -> Dict[str, float]:
    """Charge les valeurs interpolees pour un parametre."""
    meta = PARAM_META.get(parameter_id, {})
    if meta.get("source") == "spectral_vfs":
        return load_values_vfs(cur)
    print(f"  [LOAD] valeurs {parameter_id} ...", flush=True)
    cur.execute(
        "SELECT maille_id::text, value FROM atlas.ai_interpolation_values "
        "WHERE parameter_id = %s AND value IS NOT NULL",
        (parameter_id,),
    )
    d = {r[0]: float(r[1]) for r in cur.fetchall()}
    print(f"  [LOAD] {len(d)} valeurs", flush=True)
    return d


def load_values_vfs(cur) -> Dict[str, float]:
    """Charge les predictions VfS depuis atlas.maille_spectral_vfs (NaN exclus)."""
    import math as _math
    print("  [LOAD] valeurs VfS (spectral_vfs) ...", flush=True)
    cur.execute("""
        SELECT maille_id::text, vbs_vfs_pred
        FROM atlas.maille_spectral_vfs
        WHERE vbs_vfs_pred IS NOT NULL
    """)
    d = {}
    for mid, val in cur.fetchall():
        v = float(val)
        if not _math.isnan(v):
            d[mid] = v
    print(f"  [LOAD] {len(d)} valeurs VfS (finies)", flush=True)
    return d


def load_togo_boundary(cur) -> Optional[gpd.GeoDataFrame]:
    """Charge la frontiere du Togo si disponible."""
    try:
        cur.execute("""
            SELECT ST_AsEWKB(ST_Transform(geom, 4326)) FROM atlas.boundary_togo LIMIT 1
        """)
        row = cur.fetchone()
        if row:
            g = wkb.loads(bytes(row[0]))
            return gpd.GeoDataFrame(geometry=[g], crs="EPSG:4326")
    except Exception:
        pass
    return None


def load_adm1(cur) -> Optional[gpd.GeoDataFrame]:
    """Charge les limites ADM1 (regions)."""
    try:
        cur.execute("""
            SELECT ST_AsEWKB(ST_Transform(geom, 4326)) FROM atlas.adm1_tg
        """)
        rows = cur.fetchall()
        if rows:
            geoms = [wkb.loads(bytes(r[0])) for r in rows]
            return gpd.GeoDataFrame(geometry=geoms, crs="EPSG:4326")
    except Exception:
        pass
    return None


# ── Calcul classes quantiles ─────────────────────────────────────────────────

def compute_quantile_classes(
    values: np.ndarray, n_classes: int = 7
) -> Tuple[np.ndarray, List[str]]:
    """Calcule des classes quantiles et les labels associes."""
    qs = np.linspace(0, 100, n_classes + 1)
    breaks = np.percentile(values[np.isfinite(values)], qs)
    breaks = np.unique(breaks)
    labels = []
    for i in range(len(breaks) - 1):
        labels.append(f"{breaks[i]:.2f} – {breaks[i+1]:.2f}")
    return breaks, labels


# ── Rendu cartographique ─────────────────────────────────────────────────────

def build_north_arrow(ax, x: float = 0.96, y: float = 0.15, scale: float = 0.06):
    """Dessine une rose des vents simple."""
    ax.annotate(
        "", xy=(x, y + scale), xytext=(x, y - scale * 0.3),
        xycoords="axes fraction", textcoords="axes fraction",
        arrowprops=dict(arrowstyle="-|>", color="black", lw=1.5),
    )
    ax.text(x, y + scale + 0.015, "N", transform=ax.transAxes,
            ha="center", va="bottom", fontsize=10, fontweight="bold")


def build_scale_bar(ax, lon_min: float, lat_mid: float):
    """Dessine une barre d'echelle en km."""
    # ~100 km en degres longitude a lat_mid
    deg_per_km = 1.0 / (111.32 * math.cos(math.radians(lat_mid)))
    bar_km = 100
    bar_deg = bar_km * deg_per_km

    x0 = lon_min + (ax.get_xlim()[1] - ax.get_xlim()[0]) * 0.05
    y0 = ax.get_ylim()[0] + (ax.get_ylim()[1] - ax.get_ylim()[0]) * 0.04
    y1 = y0 + (ax.get_ylim()[1] - ax.get_ylim()[0]) * 0.008

    # Barre alternee noir/blanc
    half = bar_deg / 2
    ax.fill_between([x0, x0 + half], y0, y1, color="black")
    ax.fill_between([x0 + half, x0 + bar_deg], y0, y1, color="white",
                    edgecolor="black", linewidth=0.5)
    ax.plot([x0, x0 + bar_deg], [y0, y0], color="black", lw=0.5)
    ax.plot([x0, x0 + bar_deg], [y1, y1], color="black", lw=0.5)
    ax.text(x0, y1 + (y1 - y0) * 0.5, "0", ha="center", va="bottom", fontsize=7)
    ax.text(x0 + half, y1 + (y1 - y0) * 0.5, "50", ha="center", va="bottom", fontsize=7)
    ax.text(x0 + bar_deg, y1 + (y1 - y0) * 0.5, "100 km", ha="center", va="bottom", fontsize=7)


def render_map(
    gdf: gpd.GeoDataFrame,
    values: Dict[str, float],
    meta: Dict,
    parameter_id: str,
    out_path: Path,
    boundary: Optional[gpd.GeoDataFrame] = None,
    adm1: Optional[gpd.GeoDataFrame] = None,
    dpi: int = DPI,
    sondages_gdf: Optional[gpd.GeoDataFrame] = None,
) -> Path:
    """Rendu A4 300 DPI d'une carte thematique."""
    t0 = time.time()
    print(f"  [RENDER] {parameter_id} -> {out_path.name} ...", flush=True)

    # Joindre les valeurs
    gdf = gdf.copy()
    gdf["value"] = gdf["maille_id"].map(values)
    gdf_data = gdf[gdf["value"].notna()].copy()
    gdf_nodata = gdf[gdf["value"].isna()].copy()

    vals_arr = gdf_data["value"].values
    vmin = meta.get("vmin", float(np.percentile(vals_arr, 2)))
    vmax = meta.get("vmax", float(np.percentile(vals_arr, 98)))

    cmap = plt.cm.get_cmap(meta.get("cmap", "YlOrRd"), 7)
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    # ── Figure A4 landscape ──────────────────────────────────────────────
    fig = plt.figure(figsize=(A4_W_IN, A4_H_IN), dpi=dpi)
    fig.patch.set_facecolor("white")

    # Layout : carte principale + panneau droite (titre/legende/stats)
    gs = fig.add_gridspec(
        1, 2,
        width_ratios=[3.2, 1.0],
        left=0.02, right=0.98,
        top=0.93, bottom=0.06,
        wspace=0.02,
    )
    ax_map  = fig.add_subplot(gs[0])
    ax_info = fig.add_subplot(gs[1])
    ax_info.axis("off")

    # ── Carte ────────────────────────────────────────────────────────────
    # NoData en gris clair
    if len(gdf_nodata) > 0:
        gdf_nodata.plot(ax=ax_map, color="#e8e8e8", linewidth=0.05, edgecolor="#ccc")

    # Donnees colorees
    gdf_data.plot(
        ax=ax_map,
        column="value",
        cmap=cmap,
        norm=norm,
        linewidth=0.05,
        edgecolor="none",
    )

    # Frontiere Togo
    if boundary is not None:
        boundary.boundary.plot(ax=ax_map, color="#333", linewidth=1.0, zorder=5)

    # ADM1 (regions)
    if adm1 is not None:
        adm1.boundary.plot(ax=ax_map, color="#555", linewidth=0.4, linestyle="--", zorder=4)

    # Points sondages (si disponibles)
    if sondages_gdf is not None and len(sondages_gdf) > 0:
        sondages_gdf.plot(ax=ax_map, color="black", markersize=3, marker=".", zorder=8,
                          alpha=0.6)

    # Decoration axes
    ax_map.set_xlabel("Longitude (°E)", fontsize=8, labelpad=4)
    ax_map.set_ylabel("Latitude (°N)", fontsize=8, labelpad=4)
    ax_map.tick_params(labelsize=7)
    ax_map.set_aspect("equal")
    ax_map.set_facecolor("#d6eaf8")  # ocean bleu clair

    # Grille de coordonnees
    ax_map.grid(True, linewidth=0.3, color="#aaa", linestyle=":")

    # Barre d'echelle + rose
    xlim = ax_map.get_xlim()
    ylim = ax_map.get_ylim()
    lat_mid = (ylim[0] + ylim[1]) / 2
    build_scale_bar(ax_map, xlim[0], lat_mid)
    build_north_arrow(ax_map)

    # ── Panneau info ──────────────────────────────────────────────────────
    # Titre
    ax_info.text(
        0.5, 0.97,
        "ATLAS\nGEOTECHNIQUE\nTOGO",
        transform=ax_info.transAxes,
        ha="center", va="top",
        fontsize=13, fontweight="bold",
        color="#1a3a5c",
        linespacing=1.4,
    )
    ax_info.text(
        0.5, 0.82,
        meta["label"],
        transform=ax_info.transAxes,
        ha="center", va="top",
        fontsize=9, fontweight="bold",
        color="#2c5f8a",
        wrap=True,
    )
    ax_info.text(
        0.5, 0.76,
        f"Horizon {meta.get('horizon', '')}",
        transform=ax_info.transAxes,
        ha="center", va="top",
        fontsize=8, color="#555",
        style="italic",
    )

    # Separateur
    ax_info.axhline(0.73, color="#aaa", linewidth=0.8, xmin=0.05, xmax=0.95)

    # Legende couleur — placée ENTRE le bloc titre et les statistiques
    # (entre y=0.73 et y=0.52 dans les coordonnées de ax_info)
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])

    info_pos = ax_info.get_position()
    # Colorbar : centrée dans ax_info, entre 52% et 72% de hauteur
    cbar_x0  = info_pos.x0 + (info_pos.width - 0.032) / 2
    cbar_y0  = info_pos.y0 + info_pos.height * 0.52
    cbar_h   = info_pos.height * 0.20
    cbar_ax  = fig.add_axes([cbar_x0, cbar_y0, 0.032, cbar_h])
    cb = fig.colorbar(sm, cax=cbar_ax, orientation="vertical")
    cb.set_label(f"[{meta['unit']}]", fontsize=7.5, labelpad=3)
    cb.ax.tick_params(labelsize=6.5)

    # Label colorbar à gauche de la barre
    ax_info.text(
        0.30, 0.715,
        f"{vmax:.3g}",
        transform=ax_info.transAxes, ha="right", va="top", fontsize=6.5, color="#333"
    )
    ax_info.text(
        0.30, 0.525,
        f"{vmin:.3g}",
        transform=ax_info.transAxes, ha="right", va="bottom", fontsize=6.5, color="#333"
    )

    # Séparateur entre légende et stats
    ax_info.axhline(0.50, color="#aaa", linewidth=0.8, xmin=0.05, xmax=0.95)

    # Statistiques
    stats_y = 0.47
    stats = {
        "N mailles":  f"{len(gdf_data):,}",
        "Min":        f"{vals_arr.min():.3f} {meta['unit']}",
        "Max":        f"{vals_arr.max():.3f} {meta['unit']}",
        "Mediane":    f"{np.median(vals_arr):.3f} {meta['unit']}",
        "Moyenne":    f"{vals_arr.mean():.3f} {meta['unit']}",
        "Ecart-type": f"{vals_arr.std():.3f} {meta['unit']}",
    }
    ax_info.text(0.5, stats_y + 0.03, "Statistiques",
                 transform=ax_info.transAxes, ha="center", va="top",
                 fontsize=8, fontweight="bold", color="#333")
    for i, (k, v) in enumerate(stats.items()):
        y = stats_y - 0.002 - i * 0.055
        ax_info.text(0.08, y, k + ":", transform=ax_info.transAxes,
                     ha="left", va="top", fontsize=7, color="#555")
        ax_info.text(0.95, y, v, transform=ax_info.transAxes,
                     ha="right", va="top", fontsize=7, color="#222", fontweight="bold")

    # Separateur
    ax_info.axhline(0.16, color="#aaa", linewidth=0.8, xmin=0.05, xmax=0.95)

    # Methode + date
    from datetime import datetime
    ax_info.text(
        0.5, 0.14,
        f"Methode : KED hierarchique\n(Krigeage avec derive externe)\n{parameter_id}",
        transform=ax_info.transAxes,
        ha="center", va="top", fontsize=6.5, color="#777",
        style="italic",
    )
    ax_info.text(
        0.5, 0.04,
        f"Genere le {datetime.now().strftime('%d/%m/%Y')}\nAtlas Geotechnique du Togo",
        transform=ax_info.transAxes,
        ha="center", va="bottom", fontsize=6.5, color="#999",
    )

    # ── Titre global ──────────────────────────────────────────────────────
    fig.suptitle(
        f"Carte de {meta['label']} — {meta.get('horizon', '')}",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c",
    )

    # ── Export ────────────────────────────────────────────────────────────
    pdf_path  = out_path.with_suffix(".pdf")
    png_path  = out_path.with_suffix(".png")

    fig.savefig(pdf_path, dpi=dpi, format="pdf", bbox_inches="tight",
                facecolor=fig.get_facecolor())
    fig.savefig(png_path, dpi=dpi, format="png", bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)

    elapsed = time.time() - t0
    size_kb = pdf_path.stat().st_size // 1024
    print(f"  [OK] {pdf_path.name} ({size_kb} KB) + PNG — {elapsed:.1f}s", flush=True)
    return pdf_path


# ── Main ─────────────────────────────────────────────────────────────────────

TEST_PARAMS = [
    # VBS
    "vbs_ked_h1", "vbs_ked_h2", "vbs_ked_h3",
    # IP
    "ip_ked_h1", "ip_ked_h2", "ip_ked_h3",
    # WL
    "wl_ked_h1", "wl_ked_h2", "wl_ked_h3",
    # WP
    "wp_ked_h1", "wp_ked_h2", "wp_ked_h3",
    # EG
    "eg_ked_h1", "eg_ked_h2", "eg_ked_h3",
    # Rd
    "rd_mpa_ked_h1", "rd_mpa_ked_h2", "rd_mpa_ked_h3",
    # CBR, gamma_d, w_opt
    "cbr_95_ked_h1", "gamma_d_ked_h1", "w_opt_ked_h1",
    # Passants
    "passant_80um_ked_h1", "passant_80um_ked_h2", "passant_80um_ked_h3",
    "passant_2mm_ked_h1", "passant_2mm_ked_h2", "passant_2mm_ked_h3",
    # Pressiometrique
    "em_mpa_ked_h1", "em_mpa_ked_h3",
    "pl_mpa_ked_h1", "pl_mpa_ked_h3",
]

# Parametres manquants prioritaires (ceux non encore dans exports_300dpi/)
MISSING_PARAMS = [
    "wl_ked_h2", "wl_ked_h3",
    "wp_ked_h2", "wp_ked_h3",
    "ip_ked_h2", "ip_ked_h3",
    "eg_ked_h2", "eg_ked_h3",
    "rd_mpa_ked_h2",
    "passant_80um_ked_h2", "passant_80um_ked_h3",
    "passant_2mm_ked_h1", "passant_2mm_ked_h2", "passant_2mm_ked_h3",
    "em_mpa_ked_h1", "em_mpa_ked_h3",
    "pl_mpa_ked_h1", "pl_mpa_ked_h3",
]


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Renderer headless 300 DPI — Atlas Geotechnique Togo"
    )
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument("--param", default=None, help="Parametre a rendre (ex: vbs_ked_h1)")
    parser.add_argument("--all", action="store_true", help="Rendre tous les parametres de test")
    parser.add_argument("--missing", action="store_true", help="Rendre uniquement les parametres manquants")
    parser.add_argument(
        "--out", default="./exports_300dpi",
        help="Repertoire de sortie (defaut: ./exports_300dpi)",
    )
    parser.add_argument("--dpi", type=int, default=300)
    parser.add_argument("--no-sondages", action="store_true",
                        help="Ne pas afficher les points sondages")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    if args.param:
        params = [args.param]
    elif args.all:
        params = TEST_PARAMS
    elif args.missing:
        params = MISSING_PARAMS
    else:
        # Par defaut : les 5 plus representatifs
        params = ["vbs_ked_h1", "ip_ked_h1", "rd_mpa_ked_h1", "gamma_d_ked_h1", "cbr_95_ked_h1"]

    print("=" * 60)
    print(f"Renderer headless 300 DPI — {len(params)} cartes")
    print(f"Output : {out_dir.resolve()}")
    print(f"DPI    : {args.dpi}")
    print("=" * 60)

    conn = psycopg2.connect(args.database_url)
    conn.set_client_encoding("UTF8")
    cur  = conn.cursor()

    # Chargement commun (une seule fois)
    gdf      = load_mailles_gdf(cur)
    boundary = load_togo_boundary(cur)
    adm1     = load_adm1(cur)

    # Points sondages
    sondages_gdf = None
    if not args.no_sondages:
        try:
            cur.execute("""
                SELECT ST_X(ST_Transform(geom, 4326)), ST_Y(ST_Transform(geom, 4326))
                FROM atlas.sondages
                WHERE deleted_at IS NULL AND geom IS NOT NULL
            """)
            rows = cur.fetchall()
            from shapely.geometry import Point
            pts = [Point(r[0], r[1]) for r in rows]
            sondages_gdf = gpd.GeoDataFrame(geometry=pts, crs="EPSG:4326")
            print(f"  [LOAD] {len(sondages_gdf)} sondages", flush=True)
        except Exception as e:
            print(f"  [WARN] sondages: {e}")

    results = []
    for pid in params:
        print(f"\n{'='*55}")
        print(f"  {pid}")
        print(f"{'='*55}")

        # Verifier si le parametre a des donnees
        meta = PARAM_META.get(pid)
        if meta is None:
            # Generer meta auto depuis la DB
            cur.execute(
                "SELECT MIN(value), MAX(value), AVG(value), COUNT(*) "
                "FROM atlas.ai_interpolation_values WHERE parameter_id=%s AND value IS NOT NULL",
                (pid,),
            )
            row = cur.fetchone()
            if not row or row[3] == 0:
                print(f"  [SKIP] pas de donnees pour {pid}")
                continue
            meta = {
                "label": pid.replace("_", " ").upper(),
                "unit": "?",
                "cmap": "viridis",
                "vmin": float(row[0]),
                "vmax": float(row[1]),
                "horizon": "",
            }

        values = load_values(cur, pid)
        if not values:
            print(f"  [SKIP] {pid} — aucune valeur en DB")
            continue

        out_path = out_dir / pid
        try:
            pdf = render_map(
                gdf=gdf,
                values=values,
                meta=meta,
                parameter_id=pid,
                out_path=out_path,
                boundary=boundary,
                adm1=adm1,
                dpi=args.dpi,
                sondages_gdf=sondages_gdf,
            )
            results.append(("OK", pid, str(pdf)))
        except Exception as exc:
            import traceback
            print(f"  [ERR] {pid}: {exc}", file=sys.stderr)
            traceback.print_exc(file=sys.stderr)
            results.append(("ERR", pid, str(exc)))

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print("BILAN RENDU 300 DPI")
    print(f"{'='*60}")
    for status, pid, info in results:
        print(f"  [{status}] {pid:<30} {info}")

    n_ok  = sum(1 for r in results if r[0] == "OK")
    n_err = sum(1 for r in results if r[0] == "ERR")
    print(f"\n  Succes: {n_ok} | Erreurs: {n_err}")
    print(f"  Dossier: {out_dir.resolve()}")

    return 0 if n_err == 0 else 1


if __name__ == "__main__":
    sys.exit(main())
