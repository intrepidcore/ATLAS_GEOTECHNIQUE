#!/usr/bin/env python3
"""
render_3d_archetypes.py  v2 — Redesign complet
4 archetypes 3D stratifies H1/H2/H3, lisibles et professionnels.

B — Colonnes : 3 mini-cartes cote a cote + fleches delta (lisible)
A — Cube     : Plotly 3D surfaces empilees (interactif/HTML + PNG)
C — Fence    : 2 coupes orthogonales propres (matplotlib, masque Togo)
D — Isovaleurs : 6 panneaux analyses (delta, zones critiques, profils)

Usage:
  python render_3d_archetypes.py --param vbs --archetype BACD
  python render_3d_archetypes.py --all --archetype B
"""
from __future__ import annotations

import argparse, math, os, sys, time
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

DB_DEFAULT = os.environ.get("DATABASE_URL","postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")
DPI = 300
A4W, A4H = 297/25.4, 210/25.4   # landscape

HORIZON_Z   = {"H1": 0.0,  "H2": -1.0, "H3": -1.5}
HORIZON_LAB = {"H1": "H1 (0–1 m)", "H2": "H2 (1–1.5 m)", "H3": "H3 (>1.5 m)"}
HORIZON_CLR = {"H1": "#1a5276", "H2": "#1e8449", "H3": "#922b21"}

PARAM_CONFIGS = {
    "vbs": {
        "label": "VBS (Valeur de Bleu de Methylene)", "unit": "g/100g",
        "param_ids": {"H1":"vbs_ked_h1","H2":"vbs_ked_h2","H3":"vbs_ked_h3"},
        "cmap": "YlOrRd", "vmin": 0, "vmax": 10,
        "threshold_pct": 65,   # percentile pour zones critiques
        "threshold_label": "VBS > seuil (argile expansive)",
    },
    "ip": {
        "label": "Indice de Plasticite (IP)", "unit": "%",
        "param_ids": {"H1":"ip_ked_h1","H2":"ip_ked_h2","H3":"ip_ked_h3"},
        "cmap": "PuRd", "vmin": 5, "vmax": 45, "threshold_pct": 65,
        "threshold_label": "IP > seuil (sol argileux)",
    },
    "wl": {
        "label": "Limite de Liquidite (WL)", "unit": "%",
        "param_ids": {"H1":"wl_ked_h1","H2":"wl_ked_h2","H3":"wl_ked_h3"},
        "cmap": "Blues", "vmin": 15, "vmax": 75, "threshold_pct": 70,
        "threshold_label": "WL > seuil",
    },
    "wp": {
        "label": "Limite de Plasticite (WP)", "unit": "%",
        "param_ids": {"H1":"wp_ked_h1","H2":"wp_ked_h2","H3":"wp_ked_h3"},
        "cmap": "BuPu", "vmin": 8, "vmax": 35, "threshold_pct": 70,
        "threshold_label": "WP > seuil",
    },
    "rd_mpa": {
        "label": "Resistance Dynamique Rd", "unit": "MPa",
        "param_ids": {"H1":"rd_mpa_ked_h1","H2":"rd_mpa_ked_h2","H3":"rd_mpa_ked_h3"},
        "cmap": "Greens", "vmin": 0, "vmax": 25, "threshold_pct": 40,
        "threshold_label": "Rd < seuil (sol mou)",
    },
}

# ── DB helpers ────────────────────────────────────────────────────────────────

def get_conn():
    conn = psycopg2.connect(DB_DEFAULT); conn.set_client_encoding("UTF8"); return conn

def load_centroids(cur) -> Dict[str, Tuple[float,float]]:
    cur.execute("""
        SELECT id::text,
               ST_X(ST_Transform(ST_Centroid(geom),4326))::float,
               ST_Y(ST_Transform(ST_Centroid(geom),4326))::float
        FROM atlas.mailles
    """)
    return {r[0]:(float(r[1]),float(r[2])) for r in cur.fetchall()}

def load_values(cur, pid:str) -> Dict[str,float]:
    cur.execute("SELECT maille_id::text, value FROM atlas.ai_interpolation_values WHERE parameter_id=%s AND value IS NOT NULL",(pid,))
    return {r[0]:float(r[1]) for r in cur.fetchall()}

def load_togo_mask(cur):
    """Retourne le polygone du Togo pour masquage."""
    try:
        from shapely import wkb
        import geopandas as gpd
        cur.execute("SELECT ST_AsEWKB(ST_Transform(geom,4326)) FROM atlas.boundary_togo LIMIT 1")
        row = cur.fetchone()
        if row: return wkb.loads(bytes(row[0]))
    except: pass
    return None

def build_grid(centroids, values_h, n_lon=100, n_lat=170, togo_mask=None):
    """Grille reguliere scipy.griddata, masquee sur territoire Togo."""
    from scipy.interpolate import griddata
    lon_min, lon_max = -0.15, 1.85
    lat_min, lat_max =  6.00, 11.2
    lon_g = np.linspace(lon_min, lon_max, n_lon)
    lat_g = np.linspace(lat_min, lat_max, n_lat)
    LON, LAT = np.meshgrid(lon_g, lat_g)

    # Masque Togo (points hors territoire -> NaN)
    mask = None
    if togo_mask is not None:
        try:
            from shapely.geometry import Point
            pts_flat = [Point(lo, la) for lo, la in zip(LON.ravel(), LAT.ravel())]
            inside = np.array([togo_mask.contains(p) for p in pts_flat]).reshape(LON.shape)
            mask = ~inside
        except: pass

    grids = {}
    for hz, vals in values_h.items():
        common = set(centroids) & set(vals)
        if not common: grids[hz] = np.full(LON.shape, np.nan); continue
        pts  = np.array([[centroids[m][0], centroids[m][1]] for m in common])
        zv   = np.array([vals[m] for m in common])
        g    = griddata(pts, zv, (LON, LAT), method="linear")
        if mask is not None: g[mask] = np.nan
        grids[hz] = g

    return LON, LAT, grids

# ── Save ─────────────────────────────────────────────────────────────────────

def save(fig, path:Path):
    pdf = path.with_suffix(".pdf"); png = path.with_suffix(".png")
    fig.savefig(pdf, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    fig.savefig(png, dpi=DPI, bbox_inches="tight", facecolor=fig.get_facecolor())
    plt.close(fig)
    print(f"    -> {pdf.name} ({pdf.stat().st_size//1024} KB)", flush=True)

# ── ARCHETYPE B — 3 mini-cartes + delta ──────────────────────────────────────

def render_B(LON, LAT, grids, cfg, out:Path):
    """
    B redesigne : 3 cartes cote a cote (H1/H2/H3) + carte delta H3-H1.
    Chaque carte = choropleth avec meme echelle couleur.
    Fleches colorees montrent la tendance N-S (augmentation/diminution).
    Lisible, professionnel, imprimable.
    """
    t0 = time.time()
    print(f"  [B] 3 mini-cartes H1/H2/H3 {out.name}...", flush=True)
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig = plt.figure(figsize=(A4W, A4H), dpi=DPI)
    fig.patch.set_facecolor("white")

    # Layout : 3 cartes + 1 delta + colorbar
    gs = fig.add_gridspec(1, 5, left=0.04, right=0.97, top=0.88, bottom=0.08,
                           wspace=0.08, width_ratios=[1,1,1,1,0.08])
    axes = [fig.add_subplot(gs[i]) for i in range(4)]
    ax_cb = fig.add_subplot(gs[4])

    hz_list = ["H1", "H2", "H3"]
    for i, hz in enumerate(hz_list):
        ax = axes[i]
        g = grids.get(hz)
        if g is None or np.all(np.isnan(g)):
            ax.text(0.5,0.5,"No data",ha="center",va="center",transform=ax.transAxes)
            ax.set_title(HORIZON_LAB[hz], fontsize=9, fontweight="bold", color=HORIZON_CLR[hz])
            ax.axis("off"); continue

        im = ax.pcolormesh(LON, LAT, g, cmap=cmap, norm=norm, shading="auto")
        # Contours isovaleurs
        try:
            levels = np.linspace(vmin, vmax, 7)
            cs = ax.contour(LON, LAT, g, levels=levels, colors="white",
                            linewidths=0.3, alpha=0.6)
        except: pass

        ax.set_title(HORIZON_LAB[hz], fontsize=9, fontweight="bold",
                     color=HORIZON_CLR[hz], pad=4)
        ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
        ax.spines[:].set_linewidth(1.5)
        ax.spines[:].set_edgecolor(HORIZON_CLR[hz])

        # Stats texte
        vals = g[np.isfinite(g)]
        if len(vals)>0:
            ax.text(0.02, 0.02, f"med={np.median(vals):.1f}\nsd={vals.std():.1f}",
                    transform=ax.transAxes, fontsize=6, color="white",
                    bbox=dict(facecolor="#0005", boxstyle="round,pad=0.2"), va="bottom")

    # Delta H3 - H1
    ax_d = axes[3]
    g1, g3 = grids.get("H1"), grids.get("H3")
    if g1 is not None and g3 is not None:
        diff = np.where(np.isfinite(g1)&np.isfinite(g3), g3-g1, np.nan)
        vd = max(abs(np.nanpercentile(diff,3)), abs(np.nanpercentile(diff,97)))
        if vd < 0.01: vd = 1.0
        im2 = ax_d.pcolormesh(LON, LAT, diff,
                              cmap="RdBu_r",
                              norm=mcolors.TwoSlopeNorm(vcenter=0, vmin=-vd, vmax=vd),
                              shading="auto")
        try: ax_d.contour(LON, LAT, diff, levels=[0], colors=["black"], linewidths=0.8)
        except: pass
        # Colorbar delta (petite, inline)
        cbr = fig.colorbar(im2, ax=ax_d, shrink=0.8, pad=0.02, aspect=25)
        cbr.set_label(cfg["unit"], fontsize=6); cbr.ax.tick_params(labelsize=6)
        ax_d.set_title("Delta H3 − H1\n(evolution en profondeur)", fontsize=8,
                       fontweight="bold", color="#555")
        # Annotation zones
        pos = diff[np.isfinite(diff)]
        if len(pos)>0:
            pct_increase = (diff[diff>0.2*vd][~np.isnan(diff[diff>0.2*vd])]).size
            # simple text
            ax_d.text(0.02,0.02,
                      f"Rouge = augmente\nBleu = diminue\nen profondeur",
                      transform=ax_d.transAxes, fontsize=6, color="#333",
                      bbox=dict(facecolor="white", alpha=0.8, boxstyle="round,pad=0.2"),
                      va="bottom")
    else:
        ax_d.text(0.5,0.5,"No data",ha="center",va="center",transform=ax_d.transAxes)
        ax_d.axis("off")
    ax_d.set_aspect("equal"); ax_d.set_xticks([]); ax_d.set_yticks([])

    # Colorbar principale
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); sm.set_array([])
    fig.colorbar(sm, cax=ax_cb, label=f"{cfg['label']} [{cfg['unit']}]")
    ax_cb.tick_params(labelsize=7)
    ax_cb.yaxis.label.set_fontsize(8)

    # Titre global
    fig.suptitle(
        f"Archetype B — Distribution spatiale stratifiee  |  {cfg['label']}",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c"
    )
    # Legende horizons
    patches = [mpatches.Patch(color=HORIZON_CLR[h], label=HORIZON_LAB[h]) for h in hz_list]
    fig.legend(handles=patches, loc="lower center", ncol=3, fontsize=8,
               bbox_to_anchor=(0.4, 0.01), framealpha=0.9)

    save(fig, out)
    print(f"  [B] OK {time.time()-t0:.1f}s", flush=True)


# ── ARCHETYPE A — Cube Plotly 3D ─────────────────────────────────────────────

def render_A(LON, LAT, grids, cfg, out:Path):
    """
    A : Plotly 3D surfaces — 3 plans horizontaux semi-transparents.
    Export HTML (interactif) + PNG statique via kaleido.
    Beaucoup plus lisible que matplotlib 3D.
    """
    t0 = time.time()
    print(f"  [A] Cube Plotly 3D {out.name}...", flush=True)
    try:
        import plotly.graph_objects as go
    except ImportError:
        print("  [A] plotly non installe — skip"); return

    vmin, vmax = cfg["vmin"], cfg["vmax"]
    # Sous-echantillonner pour Plotly (sinon trop lourd)
    step = 3
    LON_s = LON[::step, ::step]
    LAT_s = LAT[::step, ::step]

    # Couleurs par horizon
    opacities = {"H1": 0.75, "H2": 0.65, "H3": 0.55}
    z_offset  = {"H1": 0.0, "H2": -1.0, "H3": -1.5}

    # Colorscale Plotly depuis cmap matplotlib
    cmap_name = cfg["cmap"]
    cmap_mpl = plt.cm.get_cmap(cmap_name, 256)
    colorscale = [
        [i/255, f"rgb({int(cmap_mpl(i)[0]*255)},{int(cmap_mpl(i)[1]*255)},{int(cmap_mpl(i)[2]*255)})"]
        for i in range(0, 256, 16)
    ]

    traces = []
    for hz in ["H3","H2","H1"]:  # bottom to top pour transparence correcte
        g = grids.get(hz)
        if g is None: continue
        g_s = g[::step, ::step]
        z_plane = np.full_like(LON_s, z_offset[hz])

        # Masque NaN
        g_display = np.where(np.isfinite(g_s), g_s, None)

        traces.append(go.Surface(
            x=LON_s, y=LAT_s, z=z_plane,
            surfacecolor=g_s,
            cmin=vmin, cmax=vmax,
            colorscale=colorscale,
            showscale=(hz == "H1"),
            colorbar=dict(title=dict(text=f"{cfg['unit']}", side="right"), thickness=15, len=0.6) if hz=="H1" else None,
            opacity=opacities[hz],
            name=HORIZON_LAB[hz],
            showlegend=True,
            hovertemplate=f"<b>{HORIZON_LAB[hz]}</b><br>Lon: %{{x:.2f}}<br>Lat: %{{y:.2f}}<br>Valeur: %{{surfacecolor:.2f}} {cfg['unit']}<extra></extra>",
        ))

    # Annotations Z
    annotations_3d = []
    for hz in ["H1","H2","H3"]:
        annotations_3d.append(dict(
            x=LON_s.max()+0.1, y=LAT_s.min(), z=z_offset[hz],
            text=f"<b>{HORIZON_LAB[hz]}</b>", showarrow=False,
            font=dict(size=11, color=HORIZON_CLR[hz]),
        ))

    fig3d = go.Figure(data=traces)
    fig3d.update_layout(
        title=dict(
            text=f"Archetype A — Cube feuillete H1/H2/H3 | {cfg['label']}",
            x=0.5, font=dict(size=14, color="#1a3a5c"),
        ),
        scene=dict(
            xaxis_title="Longitude (E)", yaxis_title="Latitude (N)", zaxis_title="Profondeur (m)",
            zaxis=dict(tickvals=[0,-1,-1.5], ticktext=["0m","-1m","-1.5m"]),
            bgcolor="#eaf0f8",
            camera=dict(eye=dict(x=1.4, y=-1.6, z=0.9)),
            aspectmode="manual",
            aspectratio=dict(x=1.5, y=3, z=0.5),
            annotations=annotations_3d,
        ),
        legend=dict(x=0.01, y=0.99, bgcolor="rgba(255,255,255,0.8)"),
        margin=dict(l=0,r=0,t=50,b=0),
        paper_bgcolor="white",
        width=2200, height=1400,
    )

    # Export HTML (interactif)
    html_path = out.with_suffix(".html")
    fig3d.write_html(str(html_path))
    print(f"    -> {html_path.name} (HTML interactif)", flush=True)

    # Export PNG via kaleido
    try:
        png_path = out.with_suffix(".png")
        fig3d.write_image(str(png_path), width=2200, height=1400, scale=1)
        # Convertir PNG -> PDF via matplotlib
        img = plt.imread(str(png_path))
        fig_wrap, ax_wrap = plt.subplots(figsize=(A4W,A4H), dpi=DPI)
        fig_wrap.patch.set_facecolor("white")
        ax_wrap.imshow(img, aspect="auto")
        ax_wrap.axis("off")
        fig_wrap.tight_layout(pad=0)
        fig_wrap.savefig(out.with_suffix(".pdf"), dpi=DPI, bbox_inches="tight")
        plt.close(fig_wrap)
        print(f"    -> {out.with_suffix('.pdf').name}", flush=True)
    except Exception as e:
        print(f"    [WARN] kaleido: {e}. HTML seul disponible.", flush=True)

    print(f"  [A] OK {time.time()-t0:.1f}s", flush=True)


# ── ARCHETYPE C — Fence diagram propre ───────────────────────────────────────

def render_C(LON, LAT, grids, cfg, out:Path):
    """
    C redesigne : 2 coupes (1 N-S + 1 E-O) presentees proprement.
    Haut : coupe N-S (longitude fixe au centroid Togo ~0.85E)
    Bas  : coupe E-O (latitude fixe a ~8.5N)
    Chaque coupe montre les 3 horizons en couleurs distinctes.
    """
    t0 = time.time()
    print(f"  [C] Fence diagram 2 coupes {out.name}...", flush=True)
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig, axes = plt.subplots(2, 2, figsize=(A4W, A4H), dpi=DPI,
                              gridspec_kw=dict(width_ratios=[2.5,1], hspace=0.35, wspace=0.25,
                                               left=0.07, right=0.97, top=0.88, bottom=0.07))
    fig.patch.set_facecolor("white")

    lons_1d = LON[0, :]
    lats_1d = LAT[:, 0]

    # Index centraux
    c_ns = int(LON.shape[1] * 0.5)   # lon ~0.85E
    r_ew = int(LON.shape[0] * 0.45)  # lat ~8.5N

    lon_fixed = lons_1d[c_ns]
    lat_fixed = lats_1d[r_ew]

    hz_list = ["H1","H2","H3"]
    linestyles = ["-","--","-."]

    # ── Coupe N-S ─────────────────────────────────────────────────
    ax_ns = axes[0, 0]
    ax_ns.set_facecolor("#f8f9fa")
    for hz, ls in zip(hz_list, linestyles):
        g = grids.get(hz)
        if g is None: continue
        col = g[:, c_ns]
        valid = np.isfinite(col)
        if valid.sum() < 3: continue
        ax_ns.plot(lats_1d[valid], col[valid], color=HORIZON_CLR[hz],
                   linewidth=2.0, linestyle=ls, label=HORIZON_LAB[hz])
        ax_ns.fill_between(lats_1d[valid], col[valid], vmin,
                           alpha=0.12, color=HORIZON_CLR[hz])
    ax_ns.set_xlabel("Latitude (N)", fontsize=8); ax_ns.set_ylabel(f"{cfg['unit']}", fontsize=8)
    ax_ns.set_title(f"Coupe N-S  (lon = {lon_fixed:.2f}°E)", fontsize=9, fontweight="bold")
    ax_ns.set_ylim(vmin, vmax); ax_ns.legend(fontsize=7, loc="upper right")
    ax_ns.grid(True, linewidth=0.3, alpha=0.5); ax_ns.tick_params(labelsize=7)
    # Annotations
    ax_ns.text(0.02, 0.97, "SOUTH → NORTH", transform=ax_ns.transAxes,
               fontsize=7, color="#888", va="top")

    # ── Coupe E-O ─────────────────────────────────────────────────
    ax_ew = axes[1, 0]
    ax_ew.set_facecolor("#f8f9fa")
    for hz, ls in zip(hz_list, linestyles):
        g = grids.get(hz)
        if g is None: continue
        row = g[r_ew, :]
        valid = np.isfinite(row)
        if valid.sum() < 3: continue
        ax_ew.plot(lons_1d[valid], row[valid], color=HORIZON_CLR[hz],
                   linewidth=2.0, linestyle=ls, label=HORIZON_LAB[hz])
        ax_ew.fill_between(lons_1d[valid], row[valid], vmin,
                           alpha=0.12, color=HORIZON_CLR[hz])
    ax_ew.set_xlabel("Longitude (E)", fontsize=8); ax_ew.set_ylabel(f"{cfg['unit']}", fontsize=8)
    ax_ew.set_title(f"Coupe E-O  (lat = {lat_fixed:.2f}°N)", fontsize=9, fontweight="bold")
    ax_ew.set_ylim(vmin, vmax); ax_ew.legend(fontsize=7, loc="upper right")
    ax_ew.grid(True, linewidth=0.3, alpha=0.5); ax_ew.tick_params(labelsize=7)
    ax_ew.text(0.02, 0.97, "WEST → EAST", transform=ax_ew.transAxes,
               fontsize=7, color="#888", va="top")

    # ── Carte localisation coupes ──────────────────────────────────
    for ax_loc, hz_show in [(axes[0,1], "H1"), (axes[1,1], "H1")]:
        g = grids.get(hz_show)
        if g is not None:
            ax_loc.pcolormesh(LON, LAT, g, cmap=cmap, norm=norm, shading="auto", alpha=0.8)
        ax_loc.set_aspect("equal"); ax_loc.set_xticks([]); ax_loc.set_yticks([])
        ax_loc.set_facecolor("#d6eaf8")

    # Ligne N-S
    axes[0,1].axvline(lon_fixed, color="#e74c3c", linewidth=2, linestyle="-")
    axes[0,1].set_title("Localisation coupe N-S", fontsize=7, color="#e74c3c")
    axes[0,1].text(lon_fixed+0.05, LAT.max()-0.3, f"{lon_fixed:.2f}°E",
                   color="#e74c3c", fontsize=6, va="top")
    # Ligne E-O
    axes[1,1].axhline(lat_fixed, color="#8e44ad", linewidth=2, linestyle="-")
    axes[1,1].set_title("Localisation coupe E-O", fontsize=7, color="#8e44ad")
    axes[1,1].text(LON.max()-0.3, lat_fixed+0.1, f"{lat_fixed:.2f}°N",
                   color="#8e44ad", fontsize=6, ha="right")

    # Colorbar
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); sm.set_array([])
    cbar_ax = fig.add_axes([0.965, 0.08, 0.012, 0.80])
    cb = fig.colorbar(sm, cax=cbar_ax)
    cb.set_label(f"{cfg['label']} [{cfg['unit']}]", fontsize=7); cb.ax.tick_params(labelsize=6)

    fig.suptitle(
        f"Archetype C — Coupes stratigraphiques N-S et E-O  |  {cfg['label']}",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c"
    )
    save(fig, out)
    print(f"  [C] OK {time.time()-t0:.1f}s", flush=True)


# ── ARCHETYPE D — Isovaleurs / evolution profondeur ───────────────────────────

def render_D(LON, LAT, grids, cfg, out:Path):
    """
    D : 6 panneaux d'analyse stratigraphique.
    [0] H1 carte  [1] H2 carte  [2] H3 carte
    [3] Delta H3-H1  [4] Zones critiques superposees  [5] Histogrammes distribs
    """
    t0 = time.time()
    print(f"  [D] Isovaleurs 6 panneaux {out.name}...", flush=True)
    vmin, vmax = cfg["vmin"], cfg["vmax"]
    cmap = plt.cm.get_cmap(cfg["cmap"])
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    # Seuil : percentile configurable
    thr_pct = cfg.get("threshold_pct", 65)
    g1 = grids.get("H1")
    thr = float(np.nanpercentile(g1[np.isfinite(g1)], thr_pct)) if g1 is not None else (vmin+vmax)/2

    fig = plt.figure(figsize=(A4W, A4H), dpi=DPI)
    fig.patch.set_facecolor("white")
    gs = fig.add_gridspec(2, 3, left=0.04, right=0.94, top=0.88, bottom=0.06,
                           hspace=0.30, wspace=0.15)
    axes = [[fig.add_subplot(gs[r,c]) for c in range(3)] for r in range(2)]

    # Ligne 1 : cartes H1/H2/H3
    for col, hz in enumerate(["H1","H2","H3"]):
        ax = axes[0][col]
        g = grids.get(hz)
        if g is None or np.all(np.isnan(g)):
            ax.text(0.5,0.5,"No data",ha="center",va="center",transform=ax.transAxes); ax.axis("off"); continue
        ax.pcolormesh(LON, LAT, g, cmap=cmap, norm=norm, shading="auto")
        # Isovaleur critique
        try: ax.contour(LON, LAT, g, levels=[thr], colors=[HORIZON_CLR[hz]], linewidths=1.2, linestyles="--")
        except: pass
        ax.set_title(f"{HORIZON_LAB[hz]}", fontsize=8, fontweight="bold", color=HORIZON_CLR[hz], pad=3)
        ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
        ax.set_facecolor("#d6eaf8")
        vals = g[np.isfinite(g)]
        if len(vals)>0:
            ax.text(0.02,0.98,f"med={np.median(vals):.1f}\nn={len(vals):,}",
                    transform=ax.transAxes, fontsize=6, va="top",
                    bbox=dict(facecolor="white", alpha=0.7, boxstyle="round,pad=0.15"))

    # [3] Delta H3 - H1
    ax = axes[1][0]
    g3 = grids.get("H3")
    if g1 is not None and g3 is not None:
        diff = np.where(np.isfinite(g1)&np.isfinite(g3), g3-g1, np.nan)
        vd = max(abs(np.nanpercentile(diff,3)), abs(np.nanpercentile(diff,97)), 0.5)
        im = ax.pcolormesh(LON, LAT, diff,
                           cmap="RdBu_r",
                           norm=mcolors.TwoSlopeNorm(vcenter=0, vmin=-vd, vmax=vd),
                           shading="auto")
        try: ax.contour(LON, LAT, diff, levels=[0], colors="black", linewidths=0.8, linestyles="-")
        except: pass
        plt.colorbar(im, ax=ax, shrink=0.9, pad=0.01, label=cfg["unit"], aspect=20).ax.tick_params(labelsize=6)
        ax.text(0.02,0.98,"Rouge=augmente\nBleu=diminue",
                transform=ax.transAxes,fontsize=6,va="top",
                bbox=dict(facecolor="white",alpha=0.8,boxstyle="round,pad=0.15"))
    else:
        ax.text(0.5,0.5,"No data",ha="center",va="center",transform=ax.transAxes); ax.axis("off")
    ax.set_title("Delta H3 − H1\n(evolution en profondeur)", fontsize=8, fontweight="bold", color="#555")
    ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])

    # [4] Zones critiques superposees
    ax = axes[1][1]
    ax.set_facecolor("#f0f4f8")
    ax.set_aspect("equal"); ax.set_xticks([]); ax.set_yticks([])
    legends_c = []
    for hz in ["H1","H2","H3"]:
        g = grids.get(hz)
        if g is None or np.all(np.isnan(g)): continue
        try:
            ax.contourf(LON, LAT, g, levels=[thr, vmax+1], colors=[HORIZON_CLR[hz]], alpha=0.3)
            ax.contour(LON, LAT, g, levels=[thr], colors=[HORIZON_CLR[hz]], linewidths=1.2)
        except: pass
        legends_c.append(mpatches.Patch(color=HORIZON_CLR[hz], alpha=0.6, label=HORIZON_LAB[hz]))
    ax.legend(handles=legends_c, fontsize=6, loc="lower right", framealpha=0.9)
    thr_lbl = cfg.get("threshold_label", f"Seuil {thr:.1f}")
    ax.set_title(f"Zones critiques superposees\n({thr_lbl} = {thr:.1f} {cfg['unit']})",
                 fontsize=8, fontweight="bold", color="#333")

    # [5] Histogrammes distributions H1/H2/H3
    ax = axes[1][2]
    ax.set_facecolor("#fafafa")
    for hz in ["H1","H2","H3"]:
        g = grids.get(hz)
        if g is None: continue
        vals = g[np.isfinite(g)]
        if len(vals) < 3: continue
        ax.hist(vals, bins=35, alpha=0.5, color=HORIZON_CLR[hz],
                label=HORIZON_LAB[hz], density=True, histtype="stepfilled",
                edgecolor="white", linewidth=0.3)
    ax.axvline(thr, color="#e74c3c", linewidth=1.5, linestyle="--",
               label=f"Seuil = {thr:.1f}")
    ax.set_xlabel(f"{cfg['unit']}", fontsize=7); ax.set_ylabel("Densite", fontsize=7)
    ax.set_title("Distributions par horizon", fontsize=8, fontweight="bold")
    ax.legend(fontsize=6); ax.tick_params(labelsize=6)
    ax.grid(True, linewidth=0.3, alpha=0.4)

    # Colorbar principale
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm); sm.set_array([])
    cbar_ax = fig.add_axes([0.945, 0.06, 0.012, 0.55])
    cb = fig.colorbar(sm, cax=cbar_ax)
    cb.set_label(f"[{cfg['unit']}]", fontsize=7); cb.ax.tick_params(labelsize=6)

    fig.suptitle(
        f"Archetype D — Isovaleurs + Evolution stratigraphique  |  {cfg['label']}",
        fontsize=11, fontweight="bold", y=0.97, color="#1a3a5c"
    )
    save(fig, out)
    print(f"  [D] OK {time.time()-t0:.1f}s", flush=True)


# ── Main ─────────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--param", default="vbs")
    parser.add_argument("--all", action="store_true")
    parser.add_argument("--archetype", default="BACD")
    parser.add_argument("--out", default="./exports_3d")
    parser.add_argument("--grid-size", type=int, default=100)
    parser.add_argument("--database-url", default=DB_DEFAULT)
    args = parser.parse_args()
    out_dir = Path(args.out); out_dir.mkdir(parents=True, exist_ok=True)
    params = list(PARAM_CONFIGS) if args.all else [args.param]
    archs  = list(args.archetype.upper())

    print("="*60)
    print(f"3D Archetypes v2: {archs} | params: {params}")
    print("="*60)

    conn = get_conn(); cur = conn.cursor()
    print("[LOAD] centroides..."); centroids = load_centroids(cur)
    print(f"  {len(centroids)} mailles")
    togo_mask = load_togo_mask(cur)

    for param in params:
        cfg = PARAM_CONFIGS.get(param)
        if not cfg: print(f"[SKIP] {param} not in config"); continue
        print(f"\n{'='*55}\n  {param.upper()} — {cfg['label']}\n{'='*55}")

        values_h = {}
        for hz, pid in cfg["param_ids"].items():
            v = load_values(cur, pid)
            if v: values_h[hz] = v; print(f"  {hz}: {len(v)} pts ({pid})")
            else: print(f"  {hz}: VIDE")
        if not values_h: print(f"  [SKIP]"); continue

        print(f"  [GRID] scipy griddata {args.grid_size}x{int(args.grid_size*1.7)}...", end=" ", flush=True)
        tg = time.time()
        LON, LAT, grids = build_grid(centroids, values_h,
                                      n_lon=args.grid_size, n_lat=int(args.grid_size*1.7),
                                      togo_mask=togo_mask)
        print(f"OK {time.time()-tg:.1f}s")

        if "B" in archs: render_B(LON,LAT,grids,cfg, out_dir/f"{param}_B_strati_maps")
        if "A" in archs: render_A(LON,LAT,grids,cfg, out_dir/f"{param}_A_cube_plotly")
        if "C" in archs: render_C(LON,LAT,grids,cfg, out_dir/f"{param}_C_fence_coupes")
        if "D" in archs: render_D(LON,LAT,grids,cfg, out_dir/f"{param}_D_isovaleurs")

    cur.close(); conn.close()
    print(f"\nDone -> {out_dir.resolve()}")

if __name__ == "__main__":
    sys.exit(main())
