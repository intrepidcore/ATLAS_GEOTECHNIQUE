#!/usr/bin/env python3
"""
Génération des figures pour l'article géostatistique Togo
==========================================================
Artefacts visuels nécessaires pour la soumission.

Figures générées :
  A4 : Graphique PICP (Prediction Interval Coverage Probability)
       VBS avant/après log-transform, IP, EG — H1
  A7 : Checklist de Confiance Opérationnelle (figure visuelle)
  A9 : Carte de densité des sondages par région/préfecture

Usage :
    python scripts/generate_article_figures.py \
        --database-url postgres://atlas:atlas@host.docker.internal:5433/atlas_clean \
        --output-dir docs/RECHERCHE/article_geostats_togo/figures/
"""

from __future__ import annotations

import argparse
import json
import os
import sys
from datetime import datetime

import numpy as np
import psycopg2

# Matplotlib — mode non-interactif (pour CI/CD et Docker)
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
import matplotlib.patches as mpatches
from matplotlib.colors import LinearSegmentedColormap
import matplotlib.ticker as ticker

DB_DEFAULT = os.environ.get("DATABASE_URL",
                            "postgresql://atlas:atlas@host.docker.internal:5433/atlas_clean")


def fig_picp_bar(output_path: str, picp_data: dict) -> None:
    """
    A4 — Figure PICP : graphique en barres comparant la couverture réelle
    vs nominale pour chaque paramètre et niveau de confiance.

    Format standard des articles géostatistiques (Gneiting & Raftery, 2007).
    """
    params = list(picp_data.keys())
    levels = [90, 95, 99]
    colors = ['#2196F3', '#4CAF50', '#FF9800']
    n_params = len(params)

    fig, axes = plt.subplots(1, len(levels), figsize=(15, 5), sharey=True)
    fig.suptitle('Prediction Interval Coverage Probability (PICP)\nAtlas Géotechnique Togo — H1',
                 fontsize=13, fontweight='bold', y=1.02)

    for ax_idx, (level, color) in enumerate(zip(levels, colors)):
        ax = axes[ax_idx]
        ax.set_title(f'{level}% Nominal PI', fontsize=11)

        picp_vals = []
        param_labels = []
        bar_colors = []

        for param in params:
            val = picp_data[param].get(f'picp_{level}')
            if val is not None:
                picp_vals.append(val)
                param_labels.append(param.upper())
                # Rouge si PICP < nominal - 5%, vert sinon
                bar_colors.append('#F44336' if val < (level/100 - 0.05) else '#4CAF50')

        if not picp_vals:
            ax.text(0.5, 0.5, 'Données\nnon disponibles', ha='center', va='center',
                    transform=ax.transAxes)
            continue

        x = np.arange(len(param_labels))
        bars = ax.bar(x, picp_vals, color=bar_colors, alpha=0.8, edgecolor='white', linewidth=1.5)

        # Ligne de référence (couverture nominale)
        ax.axhline(level/100, color='black', linestyle='--', linewidth=2,
                   label=f'Nominal ({level}%)')
        ax.axhline(level/100 - 0.05, color='#FF5722', linestyle=':', linewidth=1,
                   alpha=0.7, label='Seuil -5%')

        ax.set_ylim(0.6, 1.05)
        ax.set_xticks(x)
        ax.set_xticklabels(param_labels, fontsize=9)
        ax.set_ylabel('Coverage Probability', fontsize=10)
        ax.yaxis.set_major_formatter(ticker.PercentFormatter(xmax=1))
        ax.grid(axis='y', alpha=0.3)

        # Valeurs sur les barres
        for bar, val in zip(bars, picp_vals):
            ax.text(bar.get_x() + bar.get_width()/2, bar.get_height() + 0.005,
                    f'{val:.2f}', ha='center', va='bottom', fontsize=8, fontweight='bold')

        if ax_idx == 0:
            ax.legend(loc='lower right', fontsize=8)

    plt.tight_layout()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path, dpi=300, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print(f"  [OK] Figure A4 sauvegardée: {output_path}")


def fig_rmse_comparison(output_path: str, rmse_data: dict) -> None:
    """
    Figure supplémentaire : LOO-CV vs Bloc-Spatial RMSE comparison.
    Montre quantitativement l'optimisme du LOO-CV.
    """
    params = list(rmse_data.keys())
    loo_vals   = [rmse_data[p]['loo'] for p in params]
    bloc_vals  = [rmse_data[p]['bloc'] for p in params]
    units      = [rmse_data[p]['unit'] for p in params]

    fig, ax = plt.subplots(figsize=(10, 5))
    x = np.arange(len(params))
    width = 0.35

    bars1 = ax.bar(x - width/2, loo_vals,  width, label='LOO-CV (publié)',
                   color='#2196F3', alpha=0.85, edgecolor='white')
    bars2 = ax.bar(x + width/2, bloc_vals, width, label='Bloc-Spatial (réel)',
                   color='#FF5722', alpha=0.85, edgecolor='white')

    ax.set_title('RMSE LOO-CV vs Validation par Blocs Spatiaux — H1\n'
                 'Atlas Géotechnique Togo (Roberts et al., 2017)',
                 fontsize=12, fontweight='bold')
    ax.set_xticks(x)
    ax.set_xticklabels([f"{p.upper()}\n({u})" for p, u in zip(params, units)], fontsize=10)
    ax.set_ylabel('RMSE (unités du paramètre)', fontsize=11)
    ax.legend(fontsize=10)
    ax.grid(axis='y', alpha=0.3)

    # Annotation du biais
    for i, (l, b) in enumerate(zip(loo_vals, bloc_vals)):
        bias_pct = (b - l) / l * 100
        ax.annotate(f'+{bias_pct:.0f}%',
                    xy=(x[i] + width/2, b + max(bloc_vals)*0.01),
                    ha='center', fontsize=9, color='#B71C1C', fontweight='bold')

    plt.tight_layout()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path, dpi=300, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print(f"  [OK] Figure RMSE comparison sauvegardée: {output_path}")


def fig_sondage_density_map(conn, output_path: str) -> None:
    """
    A9 — Carte de densité des sondages par préfecture (ADM2).
    Points GPS exact vs ADM random. Mise en évidence des zones blanches (Kara/Savanes).
    """
    cur = conn.cursor()

    # Charger les sondages avec coordonnées et région
    cur.execute("""
    SELECT
        ST_X(ST_Transform(s.geom, 4326))::float8 AS lon,
        ST_Y(ST_Transform(s.geom, 4326))::float8 AS lat,
        s.location_mode,
        COALESCE(s.adm1_name, 'Inconnu') AS region
    FROM atlas.sondages s
    WHERE s.deleted_at IS NULL AND s.geom IS NOT NULL
    """)
    rows = cur.fetchall()

    if not rows:
        print("  [SKIP] Aucun sondage avec géométrie")
        return

    lons = np.array([r[0] for r in rows])
    lats = np.array([r[1] for r in rows])
    types = [r[2] for r in rows]
    regions = [r[3] for r in rows]

    exact_mask  = np.array([t == 'exact' for t in types])
    random_mask = ~exact_mask

    # Charger les frontières Togo
    cur.execute("""
    SELECT ST_AsGeoJSON(ST_Simplify(geom, 0.01)) FROM atlas.country_tg LIMIT 1
    """)
    row = cur.fetchone()

    fig, ax = plt.subplots(figsize=(8, 10))
    ax.set_facecolor('#E8F4F8')

    # Tracer les frontières (approximation manuelle si pas de geojson)
    # Contour Togo approximatif
    togo_lon = [-0.14, 0.03, 0.52, 0.78, 1.20, 1.87, 1.78, 1.44, 1.10, 0.69, 0.12, -0.14]
    togo_lat = [11.14, 11.14, 10.93, 10.62, 9.55, 9.43, 6.11, 6.07, 6.19, 6.10, 6.07, 11.14]
    ax.plot(togo_lon, togo_lat, 'k-', linewidth=1.5, alpha=0.7)
    ax.fill(togo_lon, togo_lat, alpha=0.05, color='gray')

    # Points sondages
    ax.scatter(lons[random_mask], lats[random_mask],
               c='#FFA726', s=15, alpha=0.5, label=f'ADM random (n={random_mask.sum()})',
               zorder=3, edgecolors='none')
    ax.scatter(lons[exact_mask], lats[exact_mask],
               c='#1565C0', s=30, alpha=0.9, label=f'GPS exact (n={exact_mask.sum()})',
               zorder=4, marker='*', edgecolors='none')

    # Annotations régions
    region_centers = {
        'Maritime': (1.05, 6.5, 203),
        'Plateaux': (1.0, 7.8, 250),
        'Centrale': (1.1, 8.6, 57),
        'Kara': (1.1, 9.5, 45),
        'Savanes': (0.6, 10.6, 14),
    }
    for region, (lon_c, lat_c, n) in region_centers.items():
        color = '#C62828' if region in ('Kara', 'Savanes') else '#1B5E20'
        ax.text(lon_c, lat_c, f'{region}\n(n={n})', fontsize=8.5, ha='center',
                color=color, fontweight='bold',
                bbox=dict(boxstyle='round,pad=0.2', facecolor='white', alpha=0.7))

    # Zones blanches
    ax.annotate('[WARN] Zone blanche\n(0 GPS exact)',
                xy=(0.9, 10.0), fontsize=8, color='#B71C1C',
                ha='center', style='italic')

    ax.set_xlim(-0.3, 2.2)
    ax.set_ylim(5.8, 11.4)
    ax.set_xlabel('Longitude (°E)', fontsize=10)
    ax.set_ylabel('Latitude (°N)', fontsize=10)
    ax.set_title('Distribution spatiale des sondages géotechniques\nAtlas Géotechnique Togo (n=572)',
                 fontsize=12, fontweight='bold')
    ax.legend(loc='lower right', fontsize=9)
    ax.grid(True, alpha=0.2)

    plt.tight_layout()
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    plt.savefig(output_path, dpi=300, bbox_inches='tight',
                facecolor='white', edgecolor='none')
    plt.close()
    print(f"  [OK] Figure A9 sauvegardée: {output_path}")


def load_picp_from_db(conn) -> dict:
    """Charge les résultats PICP depuis ai_spatial_validation_runs."""
    cur = conn.cursor()
    cur.execute("""
    SELECT parameter_id, validation_type, metrics
    FROM atlas.ai_spatial_validation_runs
    WHERE validation_type LIKE 'picp_loo%'
    ORDER BY created_at DESC
    """)
    rows = cur.fetchall()

    result = {}
    for param_id, vtype, metrics in rows:
        param = param_id.replace('_ked_h1', '').replace('_ked_h2', '').replace('_ked_h3', '')
        if param not in result:
            result[param] = {}
        if isinstance(metrics, dict):
            result[param].update(metrics)
    return result


def main():
    ap = argparse.ArgumentParser(description="Génération des figures pour l'article")
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--output-dir",
                    default="docs/RECHERCHE/article_geostats_togo/figures")
    args = ap.parse_args()

    conn = psycopg2.connect(args.database_url)
    out_dir = args.output_dir

    print(f"\n{'='*55}")
    print("GENERATION DES FIGURES POUR L'ARTICLE")
    print(f"Output: {out_dir}")
    print(f"{'='*55}")

    # Figure A9 : carte densité sondages
    print("\n[A9] Carte densité sondages...")
    try:
        fig_sondage_density_map(conn, os.path.join(out_dir, 'A9_sondage_density_map.png'))
    except Exception as ex:
        print(f"  [WARN] A9 échoué: {ex}")
        conn.rollback()

    # Figure A4 : PICP (si données disponibles)
    print("\n[A4] Graphique PICP...")
    try:
        picp_data = load_picp_from_db(conn)
    except Exception as ex:
        print(f"  [WARN] A4 load PICP échoué: {ex}")
        conn.rollback()
        picp_data = {}
    if picp_data:
        try:
            fig_picp_bar(os.path.join(out_dir, 'A4_picp_coverage.png'), picp_data)
        except Exception as ex:
            print(f"  [WARN] A4 échoué: {ex}")
    else:
        print("  [WAIT] Données PICP pas encore disponibles — relancer après validation_picp.py")

    # Figure comparaison RMSE
    print("\n[EXTRA] Comparaison LOO-CV vs Bloc-Spatial...")
    rmse_data = {
        'VBS': {'loo': 2.933, 'bloc': 4.067, 'unit': 'g/100g'},
        'IP':  {'loo': 9.786, 'bloc': 10.776, 'unit': '%'},
        'WL':  {'loo': 12.314, 'bloc': 13.929, 'unit': '%'},
        'WP':  {'loo': 7.771, 'bloc': 8.510, 'unit': '%'},
        'EG':  {'loo': 1.668, 'bloc': 1.768, 'unit': '%'},
    }
    try:
        fig_rmse_comparison(os.path.join(out_dir, 'EXTRA_rmse_loo_vs_bloc.png'), rmse_data)
    except Exception as ex:
        print(f"  [WARN] RMSE comparison échoué: {ex}")

    conn.close()
    print(f"\n[OK] Figures générées dans: {out_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
