#!/usr/bin/env python3
"""
generate_3d_exports.py
Genere les exports 3D (archetypes B/C/D) pour les parametres nouveaux et existants.

Parametres cibles :
  - cbr_95   : CBR 95% Proctor    (H1 uniquement — H2/H3 indisponibles)
  - gamma_d  : Densite seche      (H1 uniquement)
  - w_opt    : Teneur eau optimale (H1 uniquement)
  - rd_mpa   : Resistance dyn.    (H1/H2/H3)
  - vbs      : VBS                (H1/H2/H3)
  - ip       : IP                 (H1/H2/H3)
  - wl       : WL                 (H1/H2/H3)
  - wp       : WP                 (H1/H2/H3)

Note : pour cbr_95/gamma_d/w_opt (H1 seul), les archetypes B/C/D s'adaptent
automatiquement (pas de delta H3-H1, etc.).

Usage:
  python generate_3d_exports.py --new          # cbr_95 + gamma_d + w_opt
  python generate_3d_exports.py --all          # tous les parametres
  python generate_3d_exports.py --param cbr_95
  python generate_3d_exports.py --param rd_mpa --archetype BCD
"""
from __future__ import annotations

import argparse
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
import numpy as np
import psycopg2
import warnings
warnings.filterwarnings("ignore")

# Reutiliser les fonctions du script existant
sys.path.insert(0, str(Path(__file__).parent))
from render_3d_archetypes import (
    get_conn, load_centroids, load_values, load_togo_mask,
    build_grid, save,
    render_B, render_C, render_D,
    HORIZON_LAB, HORIZON_CLR,
    DPI, A4W, A4H,
)

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")

# ── Configurations parametres (etendu) ───────────────────────────────────────

PARAM_CONFIGS_EXTENDED = {
    # --- Parametres multi-horizons ---
    "vbs": {
        "label": "VBS (Valeur de Bleu de Methylene)", "unit": "g/100g",
        "param_ids": {"H1": "vbs_ked_h1", "H2": "vbs_ked_h2", "H3": "vbs_ked_h3"},
        "cmap": "YlOrRd", "vmin": 0, "vmax": 10,
        "threshold_pct": 65,
        "threshold_label": "VBS > seuil (argile expansive)",
    },
    "ip": {
        "label": "Indice de Plasticite (IP)", "unit": "%",
        "param_ids": {"H1": "ip_ked_h1", "H2": "ip_ked_h2", "H3": "ip_ked_h3"},
        "cmap": "PuRd", "vmin": 5, "vmax": 45,
        "threshold_pct": 65,
        "threshold_label": "IP > seuil (sol argileux)",
    },
    "wl": {
        "label": "Limite de Liquidite (WL)", "unit": "%",
        "param_ids": {"H1": "wl_ked_h1", "H2": "wl_ked_h2", "H3": "wl_ked_h3"},
        "cmap": "Blues", "vmin": 15, "vmax": 75,
        "threshold_pct": 70,
        "threshold_label": "WL > seuil",
    },
    "wp": {
        "label": "Limite de Plasticite (WP)", "unit": "%",
        "param_ids": {"H1": "wp_ked_h1", "H2": "wp_ked_h2", "H3": "wp_ked_h3"},
        "cmap": "BuPu", "vmin": 8, "vmax": 35,
        "threshold_pct": 70,
        "threshold_label": "WP > seuil",
    },
    "rd_mpa": {
        "label": "Resistance Dynamique Rd", "unit": "MPa",
        "param_ids": {"H1": "rd_mpa_ked_h1", "H2": "rd_mpa_ked_h2", "H3": "rd_mpa_ked_h3"},
        "cmap": "Greens", "vmin": 0, "vmax": 25,
        "threshold_pct": 40,
        "threshold_label": "Rd < seuil (sol mou)",
    },
    # --- Parametres H1 uniquement ---
    "cbr_95": {
        "label": "CBR 95% Proctor", "unit": "%",
        "param_ids": {"H1": "cbr_95_ked_h1"},
        "cmap": "RdYlGn", "vmin": 0, "vmax": 80,
        "threshold_pct": 35,
        "threshold_label": "CBR < seuil (sol insuffisant)",
        "single_horizon": True,
    },
    "gamma_d": {
        "label": "Densite Seche Maximale (gamma_d)", "unit": "g/cm3",
        "param_ids": {"H1": "gamma_d_ked_h1"},
        "cmap": "copper_r", "vmin": 1.6, "vmax": 2.2,
        "threshold_pct": 30,
        "threshold_label": "gamma_d < seuil (compacite insuffisante)",
        "single_horizon": True,
    },
    "w_opt": {
        "label": "Teneur en eau Optimale OPN (w_opt)", "unit": "%",
        "param_ids": {"H1": "w_opt_ked_h1"},
        "cmap": "Blues", "vmin": 5, "vmax": 25,
        "threshold_pct": 70,
        "threshold_label": "w_opt > seuil (sol humide)",
        "single_horizon": True,
    },
}

# Parametres nouveaux (non encore dans exports_3d_v2/)
NEW_PARAMS = ["cbr_95", "gamma_d", "w_opt"]
ALL_PARAMS = list(PARAM_CONFIGS_EXTENDED.keys())


# ── Rendu adaptatif pour horizon unique ──────────────────────────────────────

def render_B_single(LON, LAT, grids, cfg, out: Path):
    """
    Version B pour 1 seul horizon : carte unique + statistiques + colorbar.
    """
    t0 = time.time()
    print(f"  [B-single] {out.name}...", flush=True)
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    hz = list(grids.keys())[0] if grids else "H1"
    g = grids.get(hz)

    fig = plt.figure(figsize=(A4W, A4H), dpi=DPI)
    fig.patch.set_facecolor("white")

    # Layout : carte principale + panneau droite
    gs = fig.add_gridspec(1, 2, width_ratios=[3.5, 1.0],
                           left=0.03, right=0.97, top=0.88, bottom=0.08, wspace=0.04)
    ax_map = fig.add_subplot(gs[0])
    ax_info = fig.add_subplot(gs[1])
    ax_info.axis("off")

    if g is not None and not np.all(np.isnan(g)):
        im = ax_map.pcolormesh(LON, LAT, g, cmap=cmap, norm=norm, shading="auto")
        try:
            levels = np.linspace(vmin, vmax, 8)
            ax_map.contour(LON, LAT, g, levels=levels, colors="white",
                           linewidths=0.3, alpha=0.5)
        except Exception:
            pass
        ax_map.set_facecolor("#d6eaf8")
        ax_map.set_aspect("equal")
        ax_map.set_xticks([]); ax_map.set_yticks([])
        ax_map.spines[:].set_linewidth(1.5)
        ax_map.spines[:].set_edgecolor(HORIZON_CLR.get(hz, "#1a5276"))

        # Statistiques dans le panneau info (bien separes de la legende)
        vals = g[np.isfinite(g)]
        if len(vals) > 0:
            stats_lines = [
                f"N cellules : {len(vals):,}",
                f"Min        : {vals.min():.3f} {cfg['unit']}",
                f"Max        : {vals.max():.3f} {cfg['unit']}",
                f"Mediane    : {np.median(vals):.3f} {cfg['unit']}",
                f"Moyenne    : {vals.mean():.3f} {cfg['unit']}",
                f"Ecart-type : {vals.std():.3f} {cfg['unit']}",
                f"P10        : {np.percentile(vals, 10):.3f} {cfg['unit']}",
                f"P90        : {np.percentile(vals, 90):.3f} {cfg['unit']}",
            ]
            ax_info.text(0.5, 0.95, "Atlas Geotechnique Togo",
                         transform=ax_info.transAxes, ha="center", va="top",
                         fontsize=11, fontweight="bold", color="#1a3a5c")
            ax_info.text(0.5, 0.87, cfg["label"],
                         transform=ax_info.transAxes, ha="center", va="top",
                         fontsize=9, fontweight="bold", color="#2c5f8a", wrap=True)
            ax_info.text(0.5, 0.80, f"Horizon {HORIZON_LAB.get(hz, hz)} — KED hierarchique",
                         transform=ax_info.transAxes, ha="center", va="top",
                         fontsize=8, color="#555", style="italic")

            ax_info.axhline(0.75, color="#aaa", linewidth=0.8, xmin=0.05, xmax=0.95)
            ax_info.text(0.5, 0.72, "Statistiques",
                         transform=ax_info.transAxes, ha="center", va="top",
                         fontsize=9, fontweight="bold", color="#333")
            for i, line in enumerate(stats_lines):
                ax_info.text(0.05, 0.68 - i * 0.056, line,
                             transform=ax_info.transAxes, ha="left", va="top",
                             fontsize=7, color="#222", family="monospace")

            # Colorbar en bas du panneau info — bien separee des stats
            ax_info.axhline(0.24, color="#aaa", linewidth=0.8, xmin=0.05, xmax=0.95)
            ax_info.text(0.5, 0.22, "Echelle de valeurs",
                         transform=ax_info.transAxes, ha="center", va="top",
                         fontsize=8, fontweight="bold", color="#333")
        # Colorbar positionnee sous le texte stats
        cbar_ax = fig.add_axes([
            ax_info.get_position().x0 + 0.01,
            ax_info.get_position().y0 + 0.05,
            0.025,
            0.14,
        ])
        sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); sm.set_array([])
        cb = fig.colorbar(sm, cax=cbar_ax, orientation="vertical")
        cb.set_label(f"[{cfg['unit']}]", fontsize=7)
        cb.ax.tick_params(labelsize=6)
    else:
        ax_map.text(0.5, 0.5, "No data", ha="center", va="center",
                    transform=ax_map.transAxes, fontsize=16, color="#aaa")

    fig.suptitle(
        f"{cfg['label']}  |  {HORIZON_LAB.get(hz, hz)}  |  KED Hierarchique",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c"
    )
    save(fig, out)
    print(f"  [B-single] OK {time.time()-t0:.1f}s", flush=True)


def render_C_single(LON, LAT, grids, cfg, out: Path):
    """
    Version C pour 1 seul horizon : 2 coupes orthogonales + carte localisation.
    """
    t0 = time.time()
    print(f"  [C-single] {out.name}...", flush=True)
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    hz = list(grids.keys())[0] if grids else "H1"
    g = grids.get(hz)

    fig = plt.figure(figsize=(A4W, A4H), dpi=DPI)
    fig.patch.set_facecolor("white")
    gs = fig.add_gridspec(2, 2, left=0.06, right=0.95, top=0.88, bottom=0.08,
                           hspace=0.30, wspace=0.20)
    axes = [[fig.add_subplot(gs[r, c]) for c in range(2)] for r in range(2)]

    lon_fixed = 1.0   # coupe N-S
    lat_fixed = 8.5   # coupe E-O
    lons_1d = LON[0, :]
    lats_1d = LAT[:, 0]
    c_ns = np.argmin(np.abs(lons_1d - lon_fixed))
    r_ew = np.argmin(np.abs(lats_1d - lat_fixed))

    # Carte H1
    ax_map = axes[0][0]
    if g is not None and not np.all(np.isnan(g)):
        ax_map.pcolormesh(LON, LAT, g, cmap=cmap, norm=norm, shading="auto", alpha=0.85)
        ax_map.axvline(lon_fixed, color="#e74c3c", linewidth=2, linestyle="-", label=f"N-S {lon_fixed:.2f}E")
        ax_map.axhline(lat_fixed, color="#8e44ad", linewidth=2, linestyle="-", label=f"E-O {lat_fixed:.2f}N")
        ax_map.legend(fontsize=6, loc="lower right",
                      bbox_to_anchor=(1.0, 0.0),
                      framealpha=0.95, facecolor="white")
    ax_map.set_aspect("equal"); ax_map.set_xticks([]); ax_map.set_yticks([])
    ax_map.set_facecolor("#d6eaf8")
    ax_map.set_title(f"Carte {HORIZON_LAB.get(hz, hz)}", fontsize=9, fontweight="bold",
                     color=HORIZON_CLR.get(hz, "#1a5276"))

    # Coupe N-S
    ax_ns = axes[0][1]
    ax_ns.set_facecolor("#f8f9fa")
    if g is not None:
        col = g[:, c_ns]
        valid = np.isfinite(col)
        if valid.sum() >= 2:
            ax_ns.plot(lats_1d[valid], col[valid],
                       color=HORIZON_CLR.get(hz, "#1a5276"), linewidth=2.0)
            ax_ns.fill_between(lats_1d[valid], col[valid], vmin,
                               alpha=0.2, color=HORIZON_CLR.get(hz, "#1a5276"))
    ax_ns.set_xlabel("Latitude (N)", fontsize=8)
    ax_ns.set_ylabel(f"{cfg['unit']}", fontsize=8)
    ax_ns.set_title(f"Coupe N-S  (lon = {lon_fixed:.2f}E)", fontsize=9, fontweight="bold")
    ax_ns.set_ylim(vmin, vmax)
    ax_ns.grid(True, linewidth=0.3, alpha=0.5)
    ax_ns.tick_params(labelsize=7)
    # Stats en haut a gauche — separes de toute legende
    if g is not None:
        col_valid = g[:, c_ns][np.isfinite(g[:, c_ns])]
        if len(col_valid) > 0:
            ax_ns.text(0.02, 0.97,
                       f"med={np.median(col_valid):.2f}\nsd={col_valid.std():.2f}",
                       transform=ax_ns.transAxes, fontsize=7, va="top",
                       bbox=dict(facecolor="white", alpha=0.85, boxstyle="round,pad=0.2"))

    # Coupe E-O
    ax_ew = axes[1][0]
    ax_ew.set_facecolor("#f8f9fa")
    if g is not None:
        row = g[r_ew, :]
        valid = np.isfinite(row)
        if valid.sum() >= 2:
            ax_ew.plot(lons_1d[valid], row[valid],
                       color=HORIZON_CLR.get(hz, "#1a5276"), linewidth=2.0)
            ax_ew.fill_between(lons_1d[valid], row[valid], vmin,
                               alpha=0.2, color=HORIZON_CLR.get(hz, "#1a5276"))
    ax_ew.set_xlabel("Longitude (E)", fontsize=8)
    ax_ew.set_ylabel(f"{cfg['unit']}", fontsize=8)
    ax_ew.set_title(f"Coupe E-O  (lat = {lat_fixed:.2f}N)", fontsize=9, fontweight="bold")
    ax_ew.set_ylim(vmin, vmax)
    ax_ew.grid(True, linewidth=0.3, alpha=0.5)
    ax_ew.tick_params(labelsize=7)
    if g is not None:
        row_valid = g[r_ew, :][np.isfinite(g[r_ew, :])]
        if len(row_valid) > 0:
            ax_ew.text(0.02, 0.97,
                       f"med={np.median(row_valid):.2f}\nsd={row_valid.std():.2f}",
                       transform=ax_ew.transAxes, fontsize=7, va="top",
                       bbox=dict(facecolor="white", alpha=0.85, boxstyle="round,pad=0.2"))

    # Histogramme
    ax_hist = axes[1][1]
    ax_hist.set_facecolor("#fafafa")
    if g is not None:
        vals = g[np.isfinite(g)]
        if len(vals) >= 3:
            ax_hist.hist(vals, bins=40, color=HORIZON_CLR.get(hz, "#1a5276"),
                         alpha=0.7, density=True, histtype="stepfilled",
                         edgecolor="white", linewidth=0.3)
            thr_pct = cfg.get("threshold_pct", 65)
            thr = float(np.percentile(vals, thr_pct))
            ax_hist.axvline(thr, color="#e74c3c", linewidth=1.5, linestyle="--")
            # Stats en haut a gauche de l'histo — pas de superposition avec legende
            ax_hist.text(0.02, 0.97,
                         f"N={len(vals):,}\nmed={np.median(vals):.2f}\nP{thr_pct}={thr:.2f}",
                         transform=ax_hist.transAxes, fontsize=7, va="top",
                         bbox=dict(facecolor="white", alpha=0.85, boxstyle="round,pad=0.2"))
    ax_hist.set_xlabel(f"{cfg['unit']}", fontsize=8)
    ax_hist.set_ylabel("Densite", fontsize=8)
    ax_hist.set_title("Distribution des valeurs", fontsize=9, fontweight="bold")
    ax_hist.tick_params(labelsize=7)
    ax_hist.grid(True, linewidth=0.3, alpha=0.4)

    # Colorbar principale
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); sm.set_array([])
    cbar_ax = fig.add_axes([0.96, 0.08, 0.012, 0.80])
    cb = fig.colorbar(sm, cax=cbar_ax)
    cb.set_label(f"{cfg['label']} [{cfg['unit']}]", fontsize=7)
    cb.ax.tick_params(labelsize=6)

    fig.suptitle(
        f"Coupes spatiales — {cfg['label']}  |  {HORIZON_LAB.get(hz, hz)}",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c"
    )
    save(fig, out)
    print(f"  [C-single] OK {time.time()-t0:.1f}s", flush=True)


def render_D_single(LON, LAT, grids, cfg, out: Path):
    """
    Version D pour 1 seul horizon : carte + zones critiques + histogramme.
    """
    t0 = time.time()
    print(f"  [D-single] {out.name}...", flush=True)
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    hz = list(grids.keys())[0] if grids else "H1"
    g = grids.get(hz)

    thr_pct = cfg.get("threshold_pct", 65)
    thr = float(np.nanpercentile(g[np.isfinite(g)], thr_pct)) if g is not None else (vmin + vmax) / 2
    thr_lbl = cfg.get("threshold_label", f"Seuil {thr:.1f}")

    fig = plt.figure(figsize=(A4W, A4H), dpi=DPI)
    fig.patch.set_facecolor("white")
    gs = fig.add_gridspec(1, 3, left=0.04, right=0.94, top=0.88, bottom=0.08,
                           wspace=0.18, width_ratios=[1.2, 1.2, 1])
    ax_carte = fig.add_subplot(gs[0])
    ax_zones = fig.add_subplot(gs[1])
    ax_hist  = fig.add_subplot(gs[2])

    # Carte principale
    if g is not None and not np.all(np.isnan(g)):
        ax_carte.pcolormesh(LON, LAT, g, cmap=cmap, norm=norm, shading="auto")
        try:
            ax_carte.contour(LON, LAT, g, levels=[thr],
                             colors=[HORIZON_CLR.get(hz, "#e74c3c")],
                             linewidths=1.5, linestyles="--")
        except Exception:
            pass
        vals = g[np.isfinite(g)]
        if len(vals) > 0:
            # Stats en bas a gauche — separe des autres elements visuels
            ax_carte.text(0.02, 0.02,
                          f"med={np.median(vals):.2f}\nn={len(vals):,}",
                          transform=ax_carte.transAxes, fontsize=7, va="bottom",
                          bbox=dict(facecolor="white", alpha=0.85, boxstyle="round,pad=0.2"))
    ax_carte.set_title(f"{HORIZON_LAB.get(hz, hz)}\nContour = seuil {thr:.1f} {cfg['unit']}",
                       fontsize=8, fontweight="bold", color=HORIZON_CLR.get(hz, "#1a5276"))
    ax_carte.set_aspect("equal"); ax_carte.set_xticks([]); ax_carte.set_yticks([])
    ax_carte.set_facecolor("#d6eaf8")

    # Zones critiques
    ax_zones.set_aspect("equal"); ax_zones.set_xticks([]); ax_zones.set_yticks([])
    ax_zones.set_facecolor("#f0f4f8")
    if g is not None and not np.all(np.isnan(g)):
        try:
            ax_zones.contourf(LON, LAT, g, levels=[thr, vmax + 1],
                              colors=[HORIZON_CLR.get(hz, "#e74c3c")], alpha=0.4)
            ax_zones.contour(LON, LAT, g, levels=[thr],
                             colors=[HORIZON_CLR.get(hz, "#e74c3c")], linewidths=1.5)
        except Exception:
            pass
    # Legende en bas a droite — texte stats totalement absent de ce panneau
    zone_patch = mpatches.Patch(color=HORIZON_CLR.get(hz, "#e74c3c"), alpha=0.5,
                                label=f"{thr_lbl}\n(seuil = {thr:.1f} {cfg['unit']})")
    ax_zones.legend(handles=[zone_patch], fontsize=7, loc="lower right",
                    framealpha=0.95, facecolor="white")
    ax_zones.set_title(f"Zones critiques\n({thr_lbl})", fontsize=8, fontweight="bold", color="#333")

    # Histogramme
    ax_hist.set_facecolor("#fafafa")
    if g is not None:
        vals = g[np.isfinite(g)]
        if len(vals) >= 3:
            ax_hist.hist(vals, bins=40, color=HORIZON_CLR.get(hz, "#1a5276"),
                         alpha=0.7, density=True, histtype="stepfilled",
                         edgecolor="white", linewidth=0.3, orientation="horizontal")
            ax_hist.axhline(thr, color="#e74c3c", linewidth=1.5, linestyle="--")
            # Stats en haut a droite de l'histo
            ax_hist.text(0.98, 0.97,
                         f"N={len(vals):,}\nmed={np.median(vals):.2f}\nsd={vals.std():.2f}\nP{thr_pct}={thr:.2f}",
                         transform=ax_hist.transAxes, fontsize=7, va="top", ha="right",
                         bbox=dict(facecolor="white", alpha=0.85, boxstyle="round,pad=0.2"))
    ax_hist.set_ylabel(f"{cfg['unit']}", fontsize=8)
    ax_hist.set_xlabel("Densite", fontsize=8)
    ax_hist.set_title("Distribution\ndes valeurs", fontsize=8, fontweight="bold")
    ax_hist.tick_params(labelsize=7)
    ax_hist.grid(True, linewidth=0.3, alpha=0.4)
    ax_hist.set_ylim(vmin, vmax)

    # Colorbar principale
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); sm.set_array([])
    cbar_ax = fig.add_axes([0.945, 0.08, 0.012, 0.55])
    cb = fig.colorbar(sm, cax=cbar_ax)
    cb.set_label(f"[{cfg['unit']}]", fontsize=7)
    cb.ax.tick_params(labelsize=6)

    fig.suptitle(
        f"Isovaleurs + Zones Critiques — {cfg['label']}  |  {HORIZON_LAB.get(hz, hz)}",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c"
    )
    save(fig, out)
    print(f"  [D-single] OK {time.time()-t0:.1f}s", flush=True)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(
        description="Genere les exports 3D (B/C/D) pour les parametres Atlas Geotechnique"
    )
    parser.add_argument("--param", default=None,
                        help="Parametre a rendre (ex: cbr_95, rd_mpa, vbs)")
    parser.add_argument("--all", action="store_true",
                        help="Rendre tous les parametres")
    parser.add_argument("--new", action="store_true",
                        help="Rendre uniquement les nouveaux parametres (cbr_95, gamma_d, w_opt)")
    parser.add_argument("--archetype", default="BCD",
                        help="Archetypes a generer : B=strati, C=fence, D=isovaleurs (defaut: BCD)")
    parser.add_argument("--out", default="./exports_3d_v2",
                        help="Repertoire de sortie (defaut: ./exports_3d_v2)")
    parser.add_argument("--grid-size", type=int, default=100,
                        help="Taille grille (defaut: 100)")
    parser.add_argument("--database-url", default=DB_DEFAULT)
    args = parser.parse_args()

    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    archs = list(args.archetype.upper())

    if args.param:
        params = [args.param]
    elif args.new:
        params = NEW_PARAMS
    elif args.all:
        params = ALL_PARAMS
    else:
        params = NEW_PARAMS  # par defaut : les nouveaux

    print("=" * 60)
    print(f"generate_3d_exports.py — {len(params)} parametres, archetypes: {archs}")
    print(f"Output : {out_dir.resolve()}")
    print("=" * 60)

    conn = psycopg2.connect(args.database_url)
    conn.set_client_encoding("UTF8")
    cur = conn.cursor()

    print("[LOAD] centroides mailles...", flush=True)
    centroids = load_centroids(cur)
    print(f"  {len(centroids)} mailles", flush=True)
    togo_mask = load_togo_mask(cur)

    results = []
    for param in params:
        cfg = PARAM_CONFIGS_EXTENDED.get(param)
        if cfg is None:
            print(f"[SKIP] {param} — non configure")
            results.append(("SKIP", param, "non configure"))
            continue

        print(f"\n{'='*55}")
        print(f"  {param.upper()} — {cfg['label']}")
        print(f"{'='*55}")

        is_single = cfg.get("single_horizon", False)

        # Charger les valeurs
        values_h = {}
        for hz, pid in cfg["param_ids"].items():
            v = load_values(cur, pid)
            if v:
                values_h[hz] = v
                print(f"  {hz}: {len(v)} pts ({pid})", flush=True)
            else:
                print(f"  {hz}: VIDE ({pid})", flush=True)

        if not values_h:
            print(f"  [SKIP] aucune donnee")
            results.append(("SKIP", param, "aucune donnee en DB"))
            continue

        # Construire la grille
        print(f"  [GRID] griddata {args.grid_size}x{int(args.grid_size*1.7)}...",
              end=" ", flush=True)
        tg = time.time()
        LON, LAT, grids = build_grid(
            centroids, values_h,
            n_lon=args.grid_size,
            n_lat=int(args.grid_size * 1.7),
            togo_mask=togo_mask,
        )
        print(f"OK {time.time()-tg:.1f}s", flush=True)

        # Choisir les renderers selon horizon unique ou multi
        if is_single:
            if "B" in archs:
                try:
                    render_B_single(LON, LAT, grids, cfg,
                                    out_dir / f"{param}_B_strati_maps")
                except Exception as e:
                    print(f"  [ERR B] {e}")
            if "C" in archs:
                try:
                    render_C_single(LON, LAT, grids, cfg,
                                    out_dir / f"{param}_C_fence_coupes")
                except Exception as e:
                    print(f"  [ERR C] {e}")
            if "D" in archs:
                try:
                    render_D_single(LON, LAT, grids, cfg,
                                    out_dir / f"{param}_D_isovaleurs")
                except Exception as e:
                    print(f"  [ERR D] {e}")
        else:
            if "B" in archs:
                try:
                    render_B(LON, LAT, grids, cfg,
                             out_dir / f"{param}_B_strati_maps")
                except Exception as e:
                    print(f"  [ERR B] {e}")
            if "C" in archs:
                try:
                    render_C(LON, LAT, grids, cfg,
                             out_dir / f"{param}_C_fence_coupes")
                except Exception as e:
                    print(f"  [ERR C] {e}")
            if "D" in archs:
                try:
                    render_D(LON, LAT, grids, cfg,
                             out_dir / f"{param}_D_isovaleurs")
                except Exception as e:
                    print(f"  [ERR D] {e}")

        results.append(("OK", param, str(out_dir)))

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print("BILAN generate_3d_exports.py")
    print(f"{'='*60}")
    for status, param, info in results:
        print(f"  [{status}] {param:<20} {info}")
    n_ok = sum(1 for r in results if r[0] == "OK")
    print(f"\n  Succes: {n_ok} / {len(results)} parametres")
    print(f"  Dossier: {out_dir.resolve()}")

    return 0


if __name__ == "__main__":
    sys.exit(main())
