#!/usr/bin/env python3
"""
render_3d_archetypes.py
4 archetypes de visualisation 3D stratifiee H1/H2/H3.
Lit les predictions depuis ai_interpolation_values et produit des PDF 300 DPI.

Archetypes implementes :
  B — Colonnes 3D par maille (H1/H2/H3 empilees, matplotlib 3D)
  A — Cube feuillete (3 plans horizontaux semi-transparents, matplotlib 3D)
  C — Fence diagram stratigraphique (coupes N-S et E-O, matplotlib 3D)
  D — Carte isovaleur 2.5D (contours par horizon, matplotlib)

Usage:
  python render_3d_archetypes.py --param vbs --out /tmp/atlas_3d
  python render_3d_archetypes.py --all
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
matplotlib.use("Agg")
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.patches as mpatches
from mpl_toolkits.mplot3d import Axes3D
from mpl_toolkits.mplot3d.art3d import Poly3DCollection
import numpy as np
import psycopg2
import warnings
warnings.filterwarnings("ignore")

DB_DEFAULT = os.environ.get(
    "DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

DPI = 300
A4_W = 297 / 25.4
A4_H = 210 / 25.4

# Profondeurs de reference par horizon (en metres negatifs pour l'axe Z)
HORIZON_Z = {"H1": 0.0, "H2": -1.0, "H3": -1.5}  # top de chaque couche
HORIZON_THICK = {"H1": 1.0, "H2": 0.5, "H3": 1.0}  # epaisseur estimee
HORIZON_LABELS = {"H1": "H1 (0–1 m)", "H2": "H2 (1–1.5 m)", "H3": "H3 (>1.5 m)"}
HORIZON_COLORS_FACE = {"H1": "#d4e6f1", "H2": "#d5f5e3", "H3": "#fadbd8"}

PARAM_CONFIGS = {
    "vbs": {
        "label": "VBS (g/100g)",
        "unit": "g/100g",
        "param_ids": {"H1": "vbs_ked_h1", "H2": "vbs_ked_h2", "H3": "vbs_ked_h3"},
        "cmap": "YlOrRd",
        "vmin": 0, "vmax": 10,
    },
    "ip": {
        "label": "IP (%)",
        "unit": "%",
        "param_ids": {"H1": "ip_ked_h1", "H2": "ip_ked_h2", "H3": "ip_ked_h3"},
        "cmap": "PuRd",
        "vmin": 5, "vmax": 45,
    },
    "wl": {
        "label": "WL (%)",
        "unit": "%",
        "param_ids": {"H1": "wl_ked_h1", "H2": "wl_ked_h2", "H3": "wl_ked_h3"},
        "cmap": "Blues",
        "vmin": 15, "vmax": 75,
    },
    "wp": {
        "label": "WP (%)",
        "unit": "%",
        "param_ids": {"H1": "wp_ked_h1", "H2": "wp_ked_h2", "H3": "wp_ked_h3"},
        "cmap": "BuPu",
        "vmin": 8, "vmax": 35,
    },
    "rd_mpa": {
        "label": "Rd (MPa)",
        "unit": "MPa",
        "param_ids": {"H1": "rd_mpa_ked_h1", "H2": "rd_mpa_ked_h2", "H3": "rd_mpa_ked_h3"},
        "cmap": "Greens",
        "vmin": 0, "vmax": 25,
    },
}


# ── Helpers DB ───────────────────────────────────────────────────────────────

def get_conn():
    conn = psycopg2.connect(DB_DEFAULT)
    conn.set_client_encoding("UTF8")
    return conn


def load_maille_centroids(cur) -> Dict[str, Tuple[float, float]]:
    """Charge les centroides lon/lat de chaque maille (uuid -> (lon, lat))."""
    cur.execute("""
        SELECT id::text,
               ST_X(ST_Transform(ST_Centroid(geom), 4326))::float,
               ST_Y(ST_Transform(ST_Centroid(geom), 4326))::float
        FROM atlas.mailles
    """)
    return {r[0]: (float(r[1]), float(r[2])) for r in cur.fetchall()}


def load_values(cur, pid: str) -> Dict[str, float]:
    cur.execute(
        "SELECT maille_id::text, value FROM atlas.ai_interpolation_values "
        "WHERE parameter_id=%s AND value IS NOT NULL",
        (pid,),
    )
    return {r[0]: float(r[1]) for r in cur.fetchall()}


def build_grid_arrays(
    centroids: Dict[str, Tuple[float, float]],
    values_h: Dict[str, Dict[str, float]],
    n_lon: int = 80,
    n_lat: int = 140,
) -> Tuple[np.ndarray, np.ndarray, Dict[str, np.ndarray]]:
    """
    Construit des grilles regulieres lon/lat interpolees depuis les centroides.
    Utilise griddata (scipy) pour interpolation.
    """
    from scipy.interpolate import griddata

    # Togo bounding box
    lon_min, lon_max = -0.15, 1.85
    lat_min, lat_max =  6.0,  11.2

    lon_grid = np.linspace(lon_min, lon_max, n_lon)
    lat_grid = np.linspace(lat_min, lat_max, n_lat)
    LON, LAT = np.meshgrid(lon_grid, lat_grid)

    grids: Dict[str, np.ndarray] = {}
    for hz, vals in values_h.items():
        common_ids = set(centroids.keys()) & set(vals.keys())
        if not common_ids:
            grids[hz] = np.full(LON.shape, np.nan)
            continue
        pts   = np.array([[centroids[m][0], centroids[m][1]] for m in common_ids])
        zvals = np.array([vals[m] for m in common_ids])
        grid  = griddata(pts, zvals, (LON, LAT), method="linear")
        grids[hz] = grid

    return LON, LAT, grids


# ── Archetype B — Colonnes 3D par zone ───────────────────────────────────────

def render_B_columns(
    LON: np.ndarray, LAT: np.ndarray,
    grids: Dict[str, np.ndarray],
    cfg: Dict,
    out_path: Path,
) -> None:
    """
    Archetype B : Colonnes 3D.
    Chaque cellule de la grille est representee par une colonne divisee en 3 segments
    (H1/H2/H3), dont la couleur reflete la valeur du parametre a cette profondeur.
    """
    t0 = time.time()
    print(f"  [B] Colonnes 3D {out_path.name} ...", flush=True)

    # Sous-echantillonnage pour la visibilite
    step = 6
    lons = LON[::step, ::step].ravel()
    lats = LAT[::step, ::step].ravel()
    nx, ny = LON[::step, ::step].shape

    horizons = ["H1", "H2", "H3"]
    z_bottoms = {"H1": -1.0, "H2": -1.5, "H3": -3.0}
    z_tops    = {"H1":  0.0, "H2": -1.0, "H3": -1.5}

    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig = plt.figure(figsize=(A4_W, A4_H), dpi=DPI)
    fig.patch.set_facecolor("white")
    ax = fig.add_subplot(111, projection="3d")

    col_w = (LON.max() - LON.min()) / LON.shape[1] * step * 0.8
    col_h = (LAT.max() - LAT.min()) / LAT.shape[0] * step * 0.8

    for i, (lon, lat) in enumerate(zip(lons, lats)):
        for hz in horizons:
            grid = grids.get(hz)
            if grid is None:
                continue
            r_idx = (i // ny) * step
            c_idx = (i %  ny) * step
            if r_idx >= grid.shape[0] or c_idx >= grid.shape[1]:
                continue
            val = grid[r_idx, c_idx]
            if not np.isfinite(val):
                continue
            color = cmap(norm(val))
            zb = z_bottoms[hz]
            zt = z_tops[hz]
            ax.bar3d(
                lon - col_w / 2, lat - col_h / 2, zb,
                col_w, col_h, zt - zb,
                color=color, alpha=0.85, shade=True,
            )

    ax.set_xlabel("Longitude (E)", fontsize=7, labelpad=5)
    ax.set_ylabel("Latitude (N)", fontsize=7, labelpad=5)
    ax.set_zlabel("Profondeur (m)", fontsize=7, labelpad=5)
    ax.set_zticks([0, -1.0, -1.5, -3.0])
    ax.set_zticklabels(["0m", "-1m", "-1.5m", ">-1.5m"], fontsize=6)
    ax.view_init(elev=28, azim=-65)
    ax.set_facecolor("#f0f0f8")
    ax.grid(True, linewidth=0.3, alpha=0.5)

    # Legende couleur
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, shrink=0.5, aspect=15, pad=0.08)
    cbar.set_label(f"{cfg['label']} [{cfg['unit']}]", fontsize=8)
    cbar.ax.tick_params(labelsize=7)

    # Legende horizons
    patches = [
        mpatches.Patch(color=cmap(0.2), alpha=0.8, label="H1 (0–1 m)"),
        mpatches.Patch(color=cmap(0.5), alpha=0.8, label="H2 (1–1.5 m)"),
        mpatches.Patch(color=cmap(0.8), alpha=0.8, label="H3 (>1.5 m)"),
    ]
    ax.legend(handles=patches, loc="upper left", fontsize=7, framealpha=0.8)

    fig.suptitle(
        f"Archetype B — Colonnes 3D stratifiees | {cfg['label']}",
        fontsize=10, fontweight="bold", y=0.97,
    )
    _save(fig, out_path)
    print(f"  [B] OK — {time.time()-t0:.1f}s", flush=True)


# ── Archetype A — Cube feuillete ─────────────────────────────────────────────

def render_A_layered_cube(
    LON: np.ndarray, LAT: np.ndarray,
    grids: Dict[str, np.ndarray],
    cfg: Dict,
    out_path: Path,
) -> None:
    """
    Archetype A : Cube feuillete.
    3 plans horizontaux semi-transparents a z=-0, -1, -1.5m.
    Chaque plan est texture par le raster KED de l'horizon correspondant.
    Vue 3/4 pour voir toutes les couches simultanement.
    """
    t0 = time.time()
    print(f"  [A] Cube feuillete {out_path.name} ...", flush=True)

    z_levels = {"H1": 0.0, "H2": -1.0, "H3": -1.5}
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig = plt.figure(figsize=(A4_W, A4_H), dpi=DPI)
    fig.patch.set_facecolor("white")

    # 1 subplot 3D + 3 sous-cartes 2D pour les plans individuels
    gs = fig.add_gridspec(2, 4, left=0.04, right=0.96, top=0.90, bottom=0.06,
                           hspace=0.3, wspace=0.15)
    ax3d = fig.add_subplot(gs[:, :3], projection="3d")
    ax_h1 = fig.add_subplot(gs[0, 3])
    ax_h2 = fig.add_subplot(gs[1, 3])

    for hz, z in z_levels.items():
        grid = grids.get(hz)
        if grid is None or np.all(np.isnan(grid)):
            continue

        # Surface matplotlib (pcolormesh en 3D via plot_surface)
        masked = np.ma.masked_invalid(grid)
        colored = cmap(norm(masked))

        ax3d.plot_surface(
            LON, LAT, np.full_like(LON, z),
            facecolors=colored,
            alpha=0.55 if hz != "H1" else 0.65,
            shade=False,
            rcount=60, ccount=60,
        )

        # Bordure du plan
        lon_min, lon_max = LON.min(), LON.max()
        lat_min, lat_max = LAT.min(), LAT.max()
        for (x0, x1, y0, y1) in [
            (lon_min, lon_max, lat_min, lat_min),
            (lon_min, lon_max, lat_max, lat_max),
            (lon_min, lon_min, lat_min, lat_max),
            (lon_max, lon_max, lat_min, lat_max),
        ]:
            ax3d.plot([x0, x1], [y0, y1], [z, z], "k-", linewidth=0.6, alpha=0.8)

        # Label de l'horizon
        ax3d.text(
            lon_max + 0.05, lat_min, z,
            HORIZON_LABELS[hz], fontsize=7, color="#333", va="center",
        )

    ax3d.set_xlabel("Longitude", fontsize=7, labelpad=5)
    ax3d.set_ylabel("Latitude", fontsize=7, labelpad=5)
    ax3d.set_zlabel("Prof. (m)", fontsize=7, labelpad=3)
    ax3d.set_zticks([0, -1.0, -1.5])
    ax3d.set_zticklabels(["0", "-1 m", "-1.5 m"], fontsize=6)
    ax3d.view_init(elev=35, azim=-55)
    ax3d.set_facecolor("#eaf0f8")

    # Plans individuels en 2D (detail)
    for ax_mini, hz, title in [(ax_h1, "H1", "H1 (0–1 m)"), (ax_h2, "H3", "H3 (>1.5 m)")]:
        grid = grids.get(hz)
        if grid is not None:
            im = ax_mini.pcolormesh(LON, LAT, grid, cmap=cmap, norm=norm, shading="auto")
            ax_mini.set_title(title, fontsize=7, pad=2)
            ax_mini.set_xticks([]); ax_mini.set_yticks([])
            ax_mini.set_aspect("equal")

    # Colorbar
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax3d, shrink=0.55, aspect=18, pad=0.06)
    cbar.set_label(f"{cfg['label']} [{cfg['unit']}]", fontsize=8)
    cbar.ax.tick_params(labelsize=7)

    fig.suptitle(
        f"Archetype A — Cube feuillete H1/H2/H3 | {cfg['label']}",
        fontsize=10, fontweight="bold", y=0.97,
    )
    _save(fig, out_path)
    print(f"  [A] OK — {time.time()-t0:.1f}s", flush=True)


# ── Archetype C — Fence diagram ───────────────────────────────────────────────

def render_C_fence_diagram(
    LON: np.ndarray, LAT: np.ndarray,
    grids: Dict[str, np.ndarray],
    cfg: Dict,
    out_path: Path,
) -> None:
    """
    Archetype C : Fence diagram stratigraphique.
    4 coupes 2D (N-S x2, E-O x2) dressees en 3D comme des cloisons.
    Chaque cloture montre la variation laterale du parametre par profondeur.
    """
    t0 = time.time()
    print(f"  [C] Fence diagram {out_path.name} ...", flush=True)

    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    lon_min, lon_max = LON.min(), LON.max()
    lat_min, lat_max = LAT.min(), LAT.max()

    # Transects : (type, position, label)
    transects = [
        ("NS", 0.5,  "Coupe A-A'  (lon=0.85E)"),   # N-S au centre
        ("NS", 0.25, "Coupe B-B'  (lon=0.38E)"),   # N-S ouest
        ("EW", 0.33, "Coupe C-C'  (lat=7.9N)"),    # E-O sud
        ("EW", 0.66, "Coupe D-D'  (lat=9.5N)"),    # E-O nord
    ]
    z_planes = {"H1": 0.0, "H2": -1.0, "H3": -1.5}

    fig = plt.figure(figsize=(A4_W, A4_H), dpi=DPI)
    fig.patch.set_facecolor("white")
    ax = fig.add_subplot(111, projection="3d")

    for tr_type, tr_frac, tr_label in transects:
        if tr_type == "NS":
            # Coupe N-S : longitude fixe, lat varie
            lon_fixed = lon_min + tr_frac * (lon_max - lon_min)
            c_idx = int(tr_frac * LON.shape[1])
            c_idx = min(c_idx, LON.shape[1] - 1)
            lats_1d = LAT[:, 0]

            for hz, z in z_planes.items():
                grid = grids.get(hz)
                if grid is None:
                    continue
                vals_1d = grid[:, c_idx]
                colors_1d = cmap(norm(np.nan_to_num(vals_1d, nan=vmin)))

                # Panneau vertical : un rectangle par paire de points lat consecutifs
                for j in range(len(lats_1d) - 1):
                    v1, v2 = vals_1d[j], vals_1d[j + 1]
                    if not (np.isfinite(v1) and np.isfinite(v2)):
                        continue
                    c_avg = cmap(norm((v1 + v2) / 2))
                    verts = [
                        [(lon_fixed, lats_1d[j],   z),
                         (lon_fixed, lats_1d[j+1], z),
                         (lon_fixed, lats_1d[j+1], z - 0.8),
                         (lon_fixed, lats_1d[j],   z - 0.8)],
                    ]
                    poly = Poly3DCollection(verts, alpha=0.70, shade=False)
                    poly.set_facecolor(c_avg)
                    poly.set_edgecolor("none")
                    ax.add_collection3d(poly)

            # Label de la coupe
            ax.text(lon_fixed, lat_max + 0.05, 0.1, tr_label,
                    fontsize=6, color="#333", ha="center")

        else:  # EW
            lat_fixed = lat_min + tr_frac * (lat_max - lat_min)
            r_idx = int(tr_frac * LON.shape[0])
            r_idx = min(r_idx, LON.shape[0] - 1)
            lons_1d = LON[0, :]

            for hz, z in z_planes.items():
                grid = grids.get(hz)
                if grid is None:
                    continue
                vals_1d = grid[r_idx, :]
                for j in range(len(lons_1d) - 1):
                    v1, v2 = vals_1d[j], vals_1d[j + 1]
                    if not (np.isfinite(v1) and np.isfinite(v2)):
                        continue
                    c_avg = cmap(norm((v1 + v2) / 2))
                    verts = [
                        [(lons_1d[j],   lat_fixed, z),
                         (lons_1d[j+1], lat_fixed, z),
                         (lons_1d[j+1], lat_fixed, z - 0.8),
                         (lons_1d[j],   lat_fixed, z - 0.8)],
                    ]
                    poly = Poly3DCollection(verts, alpha=0.70, shade=False)
                    poly.set_facecolor(c_avg)
                    poly.set_edgecolor("none")
                    ax.add_collection3d(poly)

            ax.text(lon_max + 0.05, lat_fixed, 0.1, tr_label,
                    fontsize=6, color="#333", va="center")

    # Sol (plan de base)
    ax.plot_surface(
        LON[::4, ::4], LAT[::4, ::4],
        np.full_like(LON[::4, ::4], -3.0),
        color="#c8a96e", alpha=0.15, shade=True,
    )

    # Axes
    ax.set_xlabel("Longitude (E)", fontsize=7, labelpad=5)
    ax.set_ylabel("Latitude (N)", fontsize=7, labelpad=5)
    ax.set_zlabel("Profondeur (m)", fontsize=7, labelpad=3)
    ax.set_zticks([0, -1.0, -1.5, -3.0])
    ax.set_zticklabels(["0", "-1m", "-1.5m", "base"], fontsize=6)
    ax.view_init(elev=22, azim=-50)
    ax.set_facecolor("#eaf0f8")

    # Legendes horizons
    patches = [
        mpatches.Patch(color="#4472C4", alpha=0.7, label="H1 (0–1 m)"),
        mpatches.Patch(color="#70AD47", alpha=0.7, label="H2 (1–1.5 m)"),
        mpatches.Patch(color="#ED7D31", alpha=0.7, label="H3 (>1.5 m)"),
    ]
    ax.legend(handles=patches, loc="upper left", fontsize=7, framealpha=0.8)

    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, shrink=0.5, aspect=15, pad=0.08)
    cbar.set_label(f"{cfg['label']} [{cfg['unit']}]", fontsize=8)
    cbar.ax.tick_params(labelsize=7)

    fig.suptitle(
        f"Archetype C — Fence diagram stratigraphique | {cfg['label']}",
        fontsize=10, fontweight="bold", y=0.97,
    )
    _save(fig, out_path)
    print(f"  [C] OK — {time.time()-t0:.1f}s", flush=True)


# ── Archetype D — Isovaleurs 2.5D ────────────────────────────────────────────

def render_D_isovalues(
    LON: np.ndarray, LAT: np.ndarray,
    grids: Dict[str, np.ndarray],
    cfg: Dict,
    out_path: Path,
    threshold: Optional[float] = None,
) -> None:
    """
    Archetype D : Isovaleurs / volumes implicites.
    Pour chaque horizon, trace les contours d'isovaleur (ex: VBS > 3 g/100g).
    Represente la zone critique en planimetre par horizon, avec superposition.
    Aussi : carte de difference H1-H3 (evolution en profondeur).
    """
    t0 = time.time()
    print(f"  [D] Isovaleurs {out_path.name} ...", flush=True)

    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    # Seuil : 60e percentile de H1 si non specifie
    grid_h1 = grids.get("H1")
    if threshold is None and grid_h1 is not None:
        vals_h1 = grid_h1[np.isfinite(grid_h1)]
        threshold = float(np.percentile(vals_h1, 65)) if len(vals_h1) > 0 else (vmin + vmax) / 2

    fig, axes = plt.subplots(2, 3, figsize=(A4_W, A4_H), dpi=DPI)
    fig.patch.set_facecolor("white")

    hz_list = ["H1", "H2", "H3"]
    hz_colors = ["#1a5276", "#1e8449", "#922b21"]
    levels = np.linspace(vmin, vmax, 9)

    # Ligne 1 : carte remplie + isovaleurs par horizon
    for col, (hz, hzc) in enumerate(zip(hz_list, hz_colors)):
        ax = axes[0, col]
        grid = grids.get(hz)
        if grid is None or np.all(np.isnan(grid)):
            ax.text(0.5, 0.5, f"{hz}\n(no data)", ha="center", va="center",
                    transform=ax.transAxes, fontsize=9)
            ax.axis("off")
            continue

        im = ax.pcolormesh(LON, LAT, grid, cmap=cmap, norm=norm, shading="auto")
        # Isovaleurs
        cs = ax.contour(LON, LAT, grid, levels=levels, colors="white",
                        linewidths=0.4, alpha=0.7)
        ax.clabel(cs, fmt="%.1f", fontsize=5, inline=True)
        # Zone critique (au-dessus du seuil)
        if threshold is not None:
            ax.contourf(LON, LAT, grid, levels=[threshold, vmax + 1],
                        colors=[hzc], alpha=0.3, hatches=["//"])
            ax.contour(LON, LAT, grid, levels=[threshold],
                       colors=[hzc], linewidths=1.2, linestyles="--")

        ax.set_title(f"{HORIZON_LABELS[hz]}", fontsize=8, fontweight="bold", color=hzc)
        ax.set_xticks([]); ax.set_yticks([])
        ax.set_aspect("equal")
        if col == 0:
            ax.set_ylabel("Latitude", fontsize=7)

    # Ligne 2 : Difference H3-H1, superposition H1+H3, zone critique commune
    # --- Diff H3 - H1 ---
    ax = axes[1, 0]
    g1 = grids.get("H1")
    g3 = grids.get("H3")
    if g1 is not None and g3 is not None:
        diff = g3 - g1
        vdiff = max(abs(np.nanpercentile(diff, 5)), abs(np.nanpercentile(diff, 95)))
        im = ax.pcolormesh(LON, LAT, diff,
                           cmap="RdBu_r",
                           norm=mcolors.TwoSlopeNorm(vcenter=0, vmin=-vdiff, vmax=vdiff),
                           shading="auto")
        ax.contour(LON, LAT, diff, levels=[0], colors="black", linewidths=0.7)
        fig.colorbar(im, ax=ax, shrink=0.7, label=f"Delta {cfg['unit']}")
        ax.set_title("Delta H3 - H1\n(Evolution en profondeur)", fontsize=8, fontweight="bold")
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_aspect("equal")
    ax.set_xlabel("Longitude", fontsize=7)

    # --- Superposition contours H1/H2/H3 ---
    ax = axes[1, 1]
    legends = []
    for hz, hzc in zip(hz_list, hz_colors):
        grid = grids.get(hz)
        if grid is None or np.all(np.isnan(grid)) or threshold is None:
            continue
        cs = ax.contour(LON, LAT, grid, levels=[threshold],
                        colors=[hzc], linewidths=1.2, linestyles="-")
        if threshold:
            ax.contourf(LON, LAT, grid, levels=[threshold, vmax + 1],
                        colors=[hzc], alpha=0.18)
        legends.append(mpatches.Patch(color=hzc, alpha=0.7,
                                      label=f"{HORIZON_LABELS[hz]}"))
    ax.set_title(f"Zones critiques superposees\n(seuil = {threshold:.2f} {cfg['unit']})",
                 fontsize=8, fontweight="bold")
    ax.legend(handles=legends, fontsize=7, loc="lower right")
    ax.set_xticks([]); ax.set_yticks([])
    ax.set_aspect("equal")

    # --- Profil vertical moyen (pseudo-coupe E-O au centre) ---
    ax = axes[1, 2]
    lons_1d = LON[0, :]
    r_mid   = LON.shape[0] // 2
    z_vals  = {"H1": HORIZON_Z["H1"], "H2": HORIZON_Z["H2"], "H3": HORIZON_Z["H3"]}
    hz_z    = [0.0, -1.0, -1.5]

    for hz, z, hzc in zip(hz_list, hz_z, hz_colors):
        grid = grids.get(hz)
        if grid is None:
            continue
        vals_row = grid[r_mid, :]
        valid = np.isfinite(vals_row)
        if valid.sum() < 3:
            continue
        ax.plot(lons_1d[valid], vals_row[valid], color=hzc, linewidth=1.5,
                label=HORIZON_LABELS[hz])
        ax.fill_between(lons_1d[valid], vals_row[valid], vmin,
                        alpha=0.15, color=hzc)

    if threshold is not None:
        ax.axhline(threshold, color="gray", linestyle="--", linewidth=0.8,
                   label=f"Seuil = {threshold:.2f}")

    ax.set_xlabel("Longitude (E)", fontsize=7)
    ax.set_ylabel(f"{cfg['label']} [{cfg['unit']}]", fontsize=7)
    ax.set_title("Profil latitudinal\n(lat = centre du Togo)", fontsize=8, fontweight="bold")
    ax.legend(fontsize=6, loc="upper right")
    ax.set_ylim(vmin, vmax)
    ax.grid(True, linewidth=0.3, alpha=0.5)
    ax.tick_params(labelsize=7)

    fig.suptitle(
        f"Archetype D — Isovaleurs + Evolution stratigraphique | {cfg['label']}",
        fontsize=10, fontweight="bold", y=0.99,
    )
    plt.tight_layout(rect=[0, 0, 1, 0.97])
    _save(fig, out_path)
    print(f"  [D] OK — {time.time()-t0:.1f}s", flush=True)


# ── Helper save ──────────────────────────────────────────────────────────────

def _save(fig: plt.Figure, out_path: Path) -> None:
    pdf_path = out_path.with_suffix(".pdf")
    png_path = out_path.with_suffix(".png")
    fig.savefig(pdf_path, dpi=DPI, format="pdf", bbox_inches="tight",
                facecolor=fig.get_facecolor())
    fig.savefig(png_path, dpi=DPI, format="png", bbox_inches="tight",
                facecolor=fig.get_facecolor())
    plt.close(fig)
    kb = pdf_path.stat().st_size // 1024
    print(f"    -> {pdf_path.name} ({kb} KB)", flush=True)


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> int:
    parser = argparse.ArgumentParser(
        description="Archetypes 3D stratifies H1/H2/H3 — Atlas Geotechnique Togo"
    )
    parser.add_argument("--database-url", default=DB_DEFAULT)
    parser.add_argument("--param", default="vbs",
                        help="Parametre : vbs | ip | wl | wp | rd_mpa")
    parser.add_argument("--all", action="store_true", help="Tous les parametres configures")
    parser.add_argument("--archetype", default="BACD",
                        help="Archetypes a generer (ex: BA, CD, BACD)")
    parser.add_argument("--out", default="./exports_3d")
    parser.add_argument("--grid-size", type=int, default=80,
                        help="Resolution grille lon (defaut 80)")
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)

    params = list(PARAM_CONFIGS.keys()) if args.all else [args.param]
    archetypes = list(args.archetype.upper())

    print("=" * 60)
    print(f"Archetypes 3D : {archetypes}")
    print(f"Parametres    : {params}")
    print(f"Output        : {out_dir.resolve()}")
    print("=" * 60)

    conn = get_conn()
    cur  = conn.cursor()

    print("\n[LOAD] Centroides mailles ...", flush=True)
    centroids = load_maille_centroids(cur)
    print(f"  {len(centroids)} mailles", flush=True)

    for param in params:
        cfg = PARAM_CONFIGS.get(param)
        if cfg is None:
            print(f"[SKIP] Parametre {param} non configure")
            continue

        print(f"\n{'='*55}")
        print(f"  {param.upper()} — {cfg['label']}")
        print(f"{'='*55}")

        # Charger les valeurs pour H1/H2/H3
        values_h: Dict[str, Dict[str, float]] = {}
        for hz, pid in cfg["param_ids"].items():
            vals = load_values(cur, pid)
            if vals:
                values_h[hz] = vals
                print(f"  {hz}: {len(vals)} valeurs ({pid})")
            else:
                print(f"  {hz}: VIDE ({pid})")

        if not values_h:
            print(f"  [SKIP] {param} — aucune donnee")
            continue

        print(f"\n  [GRID] interpolation scipy ({args.grid_size}x{int(args.grid_size * 1.75)}) ...", flush=True)
        t_grid = time.time()
        LON, LAT, grids = build_grid_arrays(
            centroids, values_h, n_lon=args.grid_size, n_lat=int(args.grid_size * 1.75)
        )
        print(f"  [GRID] OK {LON.shape} — {time.time()-t_grid:.1f}s", flush=True)

        # Rendu archetypes
        if "B" in archetypes:
            render_B_columns(LON, LAT, grids, cfg, out_dir / f"{param}_B_colonnes")

        if "A" in archetypes:
            render_A_layered_cube(LON, LAT, grids, cfg, out_dir / f"{param}_A_cube_feuillete")

        if "C" in archetypes:
            render_C_fence_diagram(LON, LAT, grids, cfg, out_dir / f"{param}_C_fence_diagram")

        if "D" in archetypes:
            render_D_isovalues(LON, LAT, grids, cfg, out_dir / f"{param}_D_isovaleurs")

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print(f"Terminé. Rendus dans : {out_dir.resolve()}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
