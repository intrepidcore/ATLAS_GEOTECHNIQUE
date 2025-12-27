#!/usr/bin/env python3
"""
ADD-ON 8: Génération boxplots et choroplèthes par préfecture
Date: 27/12/2025
Objectif: Visualisations statistiques par préfecture (ADM2) pour Eg, VBS, IP
"""

import os
import sys
from datetime import datetime
from pathlib import Path
import psycopg2
import pandas as pd
import plotly.graph_objects as go
import plotly.express as px
from plotly.subplots import make_subplots
import json

# ============================================================================
# Configuration
# ============================================================================

DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'atlas_geotechnique'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

OUTPUT_DIR = Path(__file__).parent.parent / 'exports' / 'stats' / datetime.now().strftime('%Y%m%d_%H%M%S')
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

BOXPLOT_DIR = OUTPUT_DIR / 'boxplots'
CHOROPLETH_DIR = OUTPUT_DIR / 'choropleths'
BOXPLOT_DIR.mkdir(exist_ok=True)
CHOROPLETH_DIR.mkdir(exist_ok=True)

# KPI à analyser
KPIS = [
    {'name': 'eg_avg', 'label': 'Eg (MPa)', 'title': 'Module Pressiométrique'},
    {'name': 'vbs_avg', 'label': 'VBS', 'title': 'Valeur au Bleu de Méthylène'},
    {'name': 'ip_avg', 'label': 'IP (%)', 'title': 'Indice de Plasticité'}
]

# ============================================================================
# Connexion base de données
# ============================================================================

def get_db_connection():
    """Connexion PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"✅ Connexion DB: {DB_CONFIG['database']}")
        return conn
    except Exception as e:
        print(f"❌ Erreur connexion DB: {e}")
        sys.exit(1)

# ============================================================================
# Récupération données
# ============================================================================

def fetch_maille_kpi_data(conn):
    """Récupère données mailles avec préfectures et KPI"""
    query = """
    SELECT 
        maille_id,
        pref_name,
        eg_avg,
        vbs_avg,
        ip_avg,
        n_sondages
    FROM atlas.v_maille_kpi_pref
    WHERE pref_name IS NOT NULL
    ORDER BY pref_name, maille_id
    """
    
    df = pd.read_sql(query, conn)
    print(f"📊 Données mailles: {len(df)} lignes, {df['pref_name'].nunique()} préfectures")
    return df

def fetch_pref_kpi_data(conn):
    """Récupère données préfectures agrégées"""
    query = """
    SELECT 
        pref_code,
        pref_name,
        ST_AsGeoJSON(geom) as geometry,
        n_mailles,
        n_sondages_total,
        eg_med, eg_avg, eg_std, eg_min, eg_max,
        vbs_med, vbs_avg, vbs_std, vbs_min, vbs_max,
        ip_med, ip_avg, ip_std, ip_min, ip_max
    FROM atlas.v_pref_kpi
    WHERE n_mailles > 0
    ORDER BY pref_name
    """
    
    df = pd.read_sql(query, conn)
    print(f"🗺️ Données préfectures: {len(df)} préfectures")
    return df

# ============================================================================
# Génération boxplots
# ============================================================================

def generate_boxplots(df_mailles):
    """Génère boxplots par préfecture pour chaque KPI"""
    
    print("\n📦 Génération boxplots...")
    
    for kpi in KPIS:
        kpi_name = kpi['name']
        kpi_label = kpi['label']
        kpi_title = kpi['title']
        
        # Filtrer valeurs non nulles
        df_clean = df_mailles[['pref_name', kpi_name]].dropna()
        
        if len(df_clean) == 0:
            print(f"  ⚠️ {kpi_name}: Aucune donnée")
            continue
        
        # Créer figure
        fig = go.Figure()
        
        # Ajouter boxplot par préfecture
        for pref in sorted(df_clean['pref_name'].unique()):
            data = df_clean[df_clean['pref_name'] == pref][kpi_name]
            
            fig.add_trace(go.Box(
                y=data,
                name=pref,
                boxmean='sd',  # Afficher moyenne + écart-type
                marker_color='lightblue',
                line_color='darkblue'
            ))
        
        # Layout
        fig.update_layout(
            title=f"Distribution {kpi_title} par Préfecture",
            yaxis_title=kpi_label,
            xaxis_title="Préfecture",
            showlegend=False,
            height=600,
            template='plotly_white'
        )
        
        # Export HTML
        html_path = BOXPLOT_DIR / f'{kpi_name}_boxplot.html'
        fig.write_html(str(html_path))
        print(f"  ✅ {kpi_name}: {html_path}")
        
        # Export PNG
        try:
            png_path = BOXPLOT_DIR / f'{kpi_name}_boxplot.png'
            fig.write_image(str(png_path), width=1200, height=600)
            print(f"  ✅ {kpi_name}: {png_path}")
        except Exception as e:
            print(f"  ⚠️ {kpi_name}: PNG export failed (kaleido required): {e}")
        
        # Export SVG
        try:
            svg_path = BOXPLOT_DIR / f'{kpi_name}_boxplot.svg'
            fig.write_image(str(svg_path), width=1200, height=600)
            print(f"  ✅ {kpi_name}: {svg_path}")
        except Exception as e:
            print(f"  ⚠️ {kpi_name}: SVG export failed (kaleido required): {e}")

# ============================================================================
# Génération choroplèthes
# ============================================================================

def generate_choropleths(df_pref):
    """Génère choroplèthes par préfecture pour chaque KPI (médiane)"""
    
    print("\n🗺️ Génération choroplèthes...")
    
    # Convertir geometry en GeoJSON
    geojson_features = []
    for _, row in df_pref.iterrows():
        geojson_features.append({
            'type': 'Feature',
            'geometry': json.loads(row['geometry']),
            'properties': {
                'pref_name': row['pref_name'],
                'pref_code': row['pref_code'],
                'n_mailles': row['n_mailles'],
                'n_sondages': row['n_sondages_total'],
                'eg_med': row['eg_med'],
                'vbs_med': row['vbs_med'],
                'ip_med': row['ip_med']
            }
        })
    
    geojson = {
        'type': 'FeatureCollection',
        'features': geojson_features
    }
    
    for kpi in KPIS:
        kpi_name = kpi['name'].replace('_avg', '_med')  # Utiliser médiane
        kpi_label = kpi['label']
        kpi_title = kpi['title']
        
        # Filtrer valeurs non nulles
        df_clean = df_pref[['pref_name', kpi_name]].dropna()
        
        if len(df_clean) == 0:
            print(f"  ⚠️ {kpi_name}: Aucune donnée")
            continue
        
        # Créer choroplèthe
        fig = px.choropleth_mapbox(
            df_pref,
            geojson=geojson,
            locations='pref_name',
            featureidkey='properties.pref_name',
            color=kpi_name,
            color_continuous_scale='YlOrRd',
            mapbox_style='carto-positron',
            zoom=6,
            center={'lat': 8.5, 'lon': 1.0},  # Centre Togo
            opacity=0.7,
            labels={kpi_name: kpi_label},
            hover_data=['pref_name', 'n_mailles', 'n_sondages_total', kpi_name]
        )
        
        # Layout
        fig.update_layout(
            title=f"Choroplèthe {kpi_title} par Préfecture (Médiane)",
            height=800,
            margin={'r': 0, 't': 50, 'l': 0, 'b': 0}
        )
        
        # Export HTML
        html_path = CHOROPLETH_DIR / f'{kpi_name}_choropleth.html'
        fig.write_html(str(html_path))
        print(f"  ✅ {kpi_name}: {html_path}")
        
        # Export PNG
        try:
            png_path = CHOROPLETH_DIR / f'{kpi_name}_choropleth.png'
            fig.write_image(str(png_path), width=1200, height=800)
            print(f"  ✅ {kpi_name}: {png_path}")
        except Exception as e:
            print(f"  ⚠️ {kpi_name}: PNG export failed (kaleido required): {e}")

# ============================================================================
# Génération README
# ============================================================================

def generate_readme(df_mailles, df_pref):
    """Génère README avec statistiques et commandes"""
    
    readme_content = f"""# Statistiques par Préfecture - Atlas Géotechnique

## Date de génération
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Données sources

### Mailles
- **Total mailles**: {len(df_mailles)}
- **Préfectures**: {df_mailles['pref_name'].nunique()}
- **Mailles avec Eg**: {df_mailles['eg_avg'].notna().sum()}
- **Mailles avec VBS**: {df_mailles['vbs_avg'].notna().sum()}
- **Mailles avec IP**: {df_mailles['ip_avg'].notna().sum()}

### Préfectures
- **Total préfectures**: {len(df_pref)}
- **Mailles totales**: {df_pref['n_mailles'].sum()}
- **Sondages totaux**: {df_pref['n_sondages_total'].sum()}

## Répartition par préfecture

| Préfecture | Mailles | Sondages | Eg (med) | VBS (med) | IP (med) |
|------------|---------|----------|----------|-----------|----------|
"""
    
    for _, row in df_pref.iterrows():
        readme_content += f"| {row['pref_name']} | {row['n_mailles']} | {row['n_sondages_total']} | {row['eg_med']:.1f if pd.notna(row['eg_med']) else 'N/A'} | {row['vbs_med']:.2f if pd.notna(row['vbs_med']) else 'N/A'} | {row['ip_med']:.1f if pd.notna(row['ip_med']) else 'N/A'} |\n"
    
    readme_content += f"""

## Fichiers générés

### Boxplots (distribution par préfecture)
- `boxplots/eg_avg_boxplot.html` - Module Pressiométrique
- `boxplots/vbs_avg_boxplot.html` - Valeur au Bleu
- `boxplots/ip_avg_boxplot.html` - Indice de Plasticité

### Choroplèthes (médiane par préfecture)
- `choropleths/eg_med_choropleth.html` - Module Pressiométrique
- `choropleths/vbs_med_choropleth.html` - Valeur au Bleu
- `choropleths/ip_med_choropleth.html` - Indice de Plasticité

## Commandes de reproduction

### 1. Exécuter migration SQL
```bash
psql -U postgres -d atlas_geotechnique -f db/migrations/007_enrichir_mailles_adm2_prefectures.sql
```

### 2. Générer visualisations
```bash
python scripts/generate_stats_prefecture.py
```

## Dépendances Python

```bash
pip install psycopg2-binary pandas plotly kaleido
```

## Notes

- **Médiane recommandée**: Plus robuste aux outliers que la moyenne
- **Boxplots**: Montrent la distribution complète (quartiles, outliers)
- **Choroplèthes**: Visualisation spatiale des valeurs agrégées
- **NO DATA**: Préfectures sans données sont exclues des visualisations
"""
    
    readme_path = OUTPUT_DIR / 'README.md'
    with open(readme_path, 'w', encoding='utf-8') as f:
        f.write(readme_content)
    
    print(f"\n📄 README: {readme_path}")

# ============================================================================
# Main
# ============================================================================

def main():
    print("═" * 70)
    print("  GÉNÉRATION STATISTIQUES PAR PRÉFECTURE")
    print("  Atlas Géotechnique - 27/12/2025")
    print("═" * 70)
    
    # Connexion DB
    conn = get_db_connection()
    
    try:
        # Récupération données
        print("\n📥 Récupération données...")
        df_mailles = fetch_maille_kpi_data(conn)
        df_pref = fetch_pref_kpi_data(conn)
        
        # Génération visualisations
        generate_boxplots(df_mailles)
        generate_choropleths(df_pref)
        
        # Génération README
        generate_readme(df_mailles, df_pref)
        
        print("\n" + "═" * 70)
        print(f"✅ TERMINÉ - Fichiers dans: {OUTPUT_DIR}")
        print("═" * 70)
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
