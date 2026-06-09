#!/usr/bin/env python3
"""
generate_sgs_vfs_maps.py
Cartes SGS (P10/P50/P90) et VfS pour l'Atlas Geotechnique Togo.
300 DPI, format A4 portrait.

Usage:
  python scripts/generate_sgs_vfs_maps.py --all
  python scripts/generate_sgs_vfs_maps.py --group sgs
  python scripts/generate_sgs_vfs_maps.py --group vfs
"""
from __future__ import annotations

import argparse
import os
import sys
import time
from pathlib import Path

import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.colors as mcolors
import matplotlib.patches as mpatches
import numpy as np
import psycopg2
import geopandas as gpd
from shapely import wkb

DB_DEFAULT = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
DPI = 300

# Metadonnees SGS
SGS_META = {
    'vbs': {'label': 'VBS (Valeur de Bleu de Methylene)', 'unit': 'g/100g',
             'cmap': 'YlOrRd', 'vmin': 0, 'vmax': 10},
    'ip':  {'label': 'IP (Indice de Plasticite)',          'unit': '%',
             'cmap': 'PuBu',   'vmin': 5, 'vmax': 50},
    'wl':  {'label': 'WL (Limite de Liquidite)',           'unit': '%',
             'cmap': 'Blues',  'vmin': 20, 'vmax': 70},
    'wp':  {'label': 'WP (Limite de Plasticite)',          'unit': '%',
             'cmap': 'Greens', 'vmin': 10, 'vmax': 40},
    'eg':  {'label': 'EG (Equivalent de Greve)',           'unit': '%',
             'cmap': 'viridis_r', 'vmin': 0, 'vmax': 10},
    'cbr_95': {'label': 'CBR 95% Proctor',                 'unit': '%',
               'cmap': 'RdYlGn', 'vmin': 5, 'vmax': 80},
}

SGS_QUANTILES = {
    'p10': 'sgs_p10',
    'p50': 'sgs_p50',
    'p90': 'sgs_p90',
}

# Parametres SGS disponibles en DB
SGS_PARAMS = ['vbs', 'ip', 'wl', 'wp', 'eg', 'cbr_95']


def load_mailles_gdf(cur) -> gpd.GeoDataFrame:
    """Charge les mailles comme GeoDataFrame polygones EPSG:4326."""
    print("[LOAD] geometries mailles (polygones)...", flush=True)
    cur.execute("""
        SELECT id::text AS maille_id,
               ST_AsEWKB(ST_Transform(geom, 4326)) AS geom_wkb
        FROM atlas.mailles
        WHERE geom IS NOT NULL
    """)
    rows = cur.fetchall()
    geoms = [wkb.loads(bytes(r[1])) for r in rows]
    gdf = gpd.GeoDataFrame({'maille_id': [r[0] for r in rows]},
                           geometry=geoms, crs="EPSG:4326")
    print(f"  {len(gdf)} mailles", flush=True)
    return gdf


def load_sgs_values(cur, param_base: str, quantile_method: str) -> dict:
    """Charge valeurs SGS pour un parametre et quantile."""
    # parameter_id format: vbs_ked_h1, cbr_95_ked_h1
    if param_base == 'cbr_95':
        pid = 'cbr_95_ked_h1'
    else:
        pid = f'{param_base}_ked_h1'
    cur.execute("""
        SELECT maille_id::text, value
        FROM atlas.ai_interpolation_values
        WHERE parameter_id = %s AND method = %s AND value IS NOT NULL
    """, (pid, quantile_method))
    d = {r[0]: float(r[1]) for r in cur.fetchall()}
    print(f"  {len(d)} valeurs ({pid}, {quantile_method})", flush=True)
    return d


def load_vfs_values(cur) -> dict:
    """Charge les predictions VfS (VBS uniquement)."""
    cur.execute("""
        SELECT maille_id::text, vbs_vfs_pred, is_cuirasse
        FROM atlas.maille_spectral_vfs
        WHERE vbs_vfs_pred IS NOT NULL
    """)
    rows = cur.fetchall()
    d = {r[0]: float(r[1]) for r in rows}
    nodata_flags = {r[0]: r[2] for r in rows}
    print(f"  {len(d)} predictions VfS", flush=True)
    return d, nodata_flags


def load_boundary(cur) -> gpd.GeoDataFrame | None:
    for table in ('atlas.boundary_togo', 'atlas.country_tg'):
        try:
            cur.execute(f"SELECT ST_AsEWKB(ST_Transform(geom, 4326)) FROM {table} LIMIT 1")
            row = cur.fetchone()
            if row:
                g = wkb.loads(bytes(row[0]))
                return gpd.GeoDataFrame(geometry=[g], crs="EPSG:4326")
        except Exception:
            cur.connection.rollback()
    return None


def load_adm1(cur) -> gpd.GeoDataFrame | None:
    try:
        cur.execute("SELECT ST_AsEWKB(ST_Transform(geom, 4326)) FROM atlas.adm1_tg")
        rows = cur.fetchall()
        geoms = [wkb.loads(bytes(r[0])) for r in rows]
        return gpd.GeoDataFrame(geometry=geoms, crs="EPSG:4326")
    except Exception:
        cur.connection.rollback()
        return None


def render_map(gdf_mailles: gpd.GeoDataFrame, values: dict, meta: dict,
               title: str, out_path: Path, boundary=None, adm1=None):
    """Rendu carte 300 DPI — polygones GeoDataFrame (pas scatter, pas de stries)."""
    t0 = time.time()
    print(f"  [RENDER] {out_path.name} ...", flush=True)

    # Joindre valeurs sur GDF
    gdf = gdf_mailles.copy()
    gdf['value'] = gdf['maille_id'].map(values)
    gdf_data   = gdf[gdf['value'].notna()].copy()
    gdf_nodata = gdf[gdf['value'].isna()].copy()

    vals = gdf_data['value'].values
    if len(vals) == 0:
        print(f"  [SKIP] aucune valeur", flush=True)
        return

    # vmin/vmax : meta fixe en priorite, sinon P2/P98 dynamique
    vmin = meta.get('vmin', float(np.percentile(vals, 2)))
    vmax = meta.get('vmax', float(np.percentile(vals, 98)))
    cmap_name = meta.get('cmap', 'YlOrRd')
    cmap = matplotlib.colormaps.get_cmap(cmap_name).resampled(9)
    norm = mcolors.Normalize(vmin=vmin, vmax=vmax)

    fig, ax = plt.subplots(figsize=(8.27, 11.69), dpi=DPI)  # A4 portrait
    ax.set_facecolor('#d6eaf8')

    # NoData en gris clair
    if len(gdf_nodata) > 0:
        gdf_nodata.plot(ax=ax, color='#e8e8e8', linewidth=0.0, edgecolor='none')

    # Donnees : remplissage polygone (zero stries)
    gdf_data.plot(ax=ax, column='value', cmap=cmap, norm=norm,
                  linewidth=0.0, edgecolor='none')

    if boundary is not None:
        try:
            boundary.boundary.plot(ax=ax, color='black', linewidth=1.2, zorder=5)
        except Exception:
            for geom in boundary.geometry:
                xs, ys = geom.exterior.xy
                ax.plot(list(xs), list(ys), 'k-', linewidth=1.2, zorder=5)
    if adm1 is not None:
        try:
            adm1.boundary.plot(ax=ax, color='#444444', linewidth=0.5,
                               linestyle='--', zorder=4)
        except Exception:
            pass

    # Colorbar
    sm = plt.cm.ScalarMappable(cmap=cmap, norm=norm)
    sm.set_array([])
    cbar = fig.colorbar(sm, ax=ax, orientation='vertical', fraction=0.03, pad=0.02)
    cbar.set_label(meta.get('unit', ''), fontsize=10)
    cbar.ax.tick_params(labelsize=8)

    ax.set_xlabel('Longitude (°E)', fontsize=9)
    ax.set_ylabel('Latitude (°N)', fontsize=9)
    ax.tick_params(labelsize=7)
    ax.set_aspect('equal')
    ax.grid(True, linewidth=0.25, color='#aaaaaa', linestyle=':')

    ax.set_title(title, fontsize=11, fontweight='bold', pad=10)

    # Annotations regions
    region_centers = {
        'Maritime': (1.05, 6.5),
        'Plateaux': (1.0, 7.8),
        'Centrale': (1.1, 8.6),
        'Kara': (1.1, 9.5),
        'Savanes': (0.6, 10.6),
    }
    for region, (lon_c, lat_c) in region_centers.items():
        ax.text(lon_c, lat_c, region, fontsize=6.5, ha='center', color='#222222',
                alpha=0.7, fontstyle='italic')

    # Stats
    ax.text(0.02, 0.02,
            f"n={len(vals):,}  |  moy={vals.mean():.2f}  |  P10={np.percentile(vals,10):.2f}"
            f"  |  P90={np.percentile(vals,90):.2f}",
            transform=ax.transAxes, fontsize=6, color='#333',
            bbox=dict(boxstyle='round,pad=0.3', facecolor='white', alpha=0.7))

    plt.tight_layout()
    out_path.parent.mkdir(parents=True, exist_ok=True)
    pdf_path = out_path.with_suffix('.pdf')
    png_path = out_path.with_suffix('.png')
    plt.savefig(pdf_path, dpi=DPI, bbox_inches='tight', facecolor='white')
    plt.savefig(png_path, dpi=DPI, bbox_inches='tight', facecolor='white')
    plt.close()
    elapsed = time.time() - t0
    sz = pdf_path.stat().st_size // 1024
    print(f"  [OK] {pdf_path.name} ({sz} KB) + PNG @ {elapsed:.1f}s", flush=True)


def main():
    ap = argparse.ArgumentParser(description="Cartes SGS P10/P50/P90 + VfS")
    ap.add_argument("--all", action="store_true", help="SGS + VfS")
    ap.add_argument("--group", choices=["sgs", "vfs"], help="Groupe a generer")
    ap.add_argument("--force", action="store_true", help="Forcer meme si existant")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--out", default="exports_300dpi")  # cartes atlas → exports_300dpi
    args = ap.parse_args()

    out_dir = Path(args.out)
    do_sgs = args.all or args.group == "sgs"

    if not do_sgs:
        print("Specifier --all ou --group sgs")
        print("Note: VfS est genere par headless_render_300dpi.py --param vbs_vfs")
        return 1

    conn = psycopg2.connect(args.database_url)
    cur = conn.cursor()

    gdf_mailles = load_mailles_gdf(cur)
    boundary    = load_boundary(cur)
    adm1        = load_adm1(cur)

    results = []

    # ── SGS maps ──────────────────────────────────────────────────────────────
    if do_sgs:
        print("\n" + "="*60)
        print("  SGS P10 / P50 / P90")
        print("="*60)
        for param in SGS_PARAMS:
            meta = SGS_META.get(param, {'label': param.upper(), 'unit': '?', 'cmap': 'viridis'})
            for q_name, q_method in SGS_QUANTILES.items():
                pid = f"{param}_sgs_{q_name}"
                out_path = out_dir / pid
                if not args.force and out_path.with_suffix('.png').exists():
                    print(f"  [SKIP] {pid} (deja existant)")
                    results.append(("SKIP", pid, "existant"))
                    continue
                print(f"\n{'='*50}")
                print(f"  {pid}")
                print(f"{'='*50}")
                try:
                    vals = load_sgs_values(cur, param, q_method)
                    if not vals:
                        print(f"  [SKIP] pas de donnees")
                        results.append(("SKIP", pid, "no data"))
                        continue
                    q_pct = {'p10': '10e', 'p50': '50e (mediane)', 'p90': '90e'}[q_name]
                    title = (f"{meta['label']} — {meta['unit']}\n"
                             f"Simulation Geostochastique Sequentielle — Percentile {q_pct}\n"
                             f"Atlas Geotechnique Togo (50 realisations)")
                    render_map(gdf_mailles, vals, meta, title, out_path, boundary, adm1)
                    results.append(("OK", pid, str(out_path)))
                except Exception as exc:
                    import traceback
                    print(f"  [ERR] {pid}: {exc}")
                    traceback.print_exc()
                    results.append(("ERR", pid, str(exc)))

    cur.close()
    conn.close()

    print(f"\n{'='*60}")
    print("BILAN SGS/VfS")
    print(f"{'='*60}")
    n_ok   = sum(1 for r in results if r[0] == "OK")
    n_skip = sum(1 for r in results if r[0] == "SKIP")
    n_err  = sum(1 for r in results if r[0] == "ERR")
    for status, pid, info in results:
        print(f"  [{status}] {pid}")
    print(f"\n  OK={n_ok} SKIP={n_skip} ERR={n_err}")
    return 0 if n_err == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
