#!/usr/bin/env python3
"""
Analyse Nationale - Atlas Géotechnique
Date: 29/12/2025
Objectif: Génération robuste des graphes d'analyse nationale avec garde-fous

Ce script génère des visualisations statistiques nationales en lecture seule:
- Histogrammes (sans zéros)
- Boxplots par préfecture (ADM2)
- Camemberts de couverture
- Bar charts par ADM2

Garde-fous:
- Lecture seule sur la base de données
- Vérification de la qualité des données (ADM2 attachés)
- Filtrage des zéros pour histogrammes
- Logs détaillés
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

OUTPUT_DIR = Path(__file__).parent.parent / 'exports' / 'stats' / 'national' / datetime.now().strftime('%Y%m%d_%H%M%S')
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

# Paramètres d'analyse
PARAMETERS = [
    {'id': 'n_sondages', 'label': 'Nombre de sondages', 'unit': '', 'type': 'count'},
    {'id': 'vbs_avg', 'label': 'VBS moyen', 'unit': 'g/100g', 'type': 'physical'},
    {'id': 'ip_avg', 'label': 'IP moyen', 'unit': '%', 'type': 'physical'},
    {'id': 'eg_avg', 'label': 'Eg moyen', 'unit': '%', 'type': 'physical'},
]

# Seuils de qualité
MIN_ADM2_COVERAGE = 0.10  # Au moins 10% des mailles doivent avoir un ADM2 attaché
MIN_ACTIVE_CELLS = 5  # Au moins 5 mailles avec données pour générer un graphe

# ============================================================================
# Connexion base de données
# ============================================================================

def get_db_connection():
    """Connexion PostgreSQL en lecture seule"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        # Forcer le mode lecture seule
        cursor = conn.cursor()
        cursor.execute("SET SESSION CHARACTERISTICS AS TRANSACTION READ ONLY;")
        conn.commit()
        print(f"✅ Connexion DB (READ ONLY): {DB_CONFIG['database']}")
        return conn
    except Exception as e:
        print(f"❌ Erreur connexion DB: {e}")
        sys.exit(1)

# ============================================================================
# Vérification qualité des données
# ============================================================================

def check_data_quality(conn):
    """Vérifie la qualité des données avant génération"""
    print("\n🔍 Vérification qualité des données...")
    
    cursor = conn.cursor()
    
    # 1. Vérifier que les mailles ont des ADM2 attachés
    cursor.execute("""
        SELECT 
            COUNT(*) as total_mailles,
            COUNT(adm2_name) as mailles_avec_adm2,
            COUNT(CASE WHEN n_sondages > 0 THEN 1 END) as mailles_actives,
            COUNT(CASE WHEN n_sondages > 0 AND adm2_name IS NOT NULL THEN 1 END) as mailles_actives_avec_adm2
        FROM atlas.mailles_with_data
    """)
    
    row = cursor.fetchone()
    total_mailles, mailles_avec_adm2, mailles_actives, mailles_actives_avec_adm2 = row
    
    adm2_coverage = mailles_avec_adm2 / total_mailles if total_mailles > 0 else 0
    active_adm2_coverage = mailles_actives_avec_adm2 / mailles_actives if mailles_actives > 0 else 0
    
    print(f"  📊 Total mailles: {total_mailles}")
    print(f"  📊 Mailles avec ADM2: {mailles_avec_adm2} ({adm2_coverage*100:.1f}%)")
    print(f"  📊 Mailles actives: {mailles_actives}")
    print(f"  📊 Mailles actives avec ADM2: {mailles_actives_avec_adm2} ({active_adm2_coverage*100:.1f}%)")
    
    # Garde-fou critique
    if active_adm2_coverage < MIN_ADM2_COVERAGE:
        print(f"\n❌ CRITICAL: Moins de {MIN_ADM2_COVERAGE*100:.0f}% des mailles actives ont un ADM2 attaché")
        print(f"   → Couverture actuelle: {active_adm2_coverage*100:.1f}%")
        print(f"   → Les graphes par ADM2 seront trompeurs (dominés par 'Non classé')")
        print(f"\n🔧 Action requise:")
        print(f"   1. Vérifier que la migration 007_enrichir_mailles_adm2_prefectures.sql a été exécutée")
        print(f"   2. Vérifier que le post-process ADM1/ADM2 fonctionne (erreur 401 détectée)")
        print(f"   3. Exécuter: psql -U postgres -d atlas_geotechnique -f db/migrations/007_enrichir_mailles_adm2_prefectures.sql")
        return False
    
    if mailles_actives < MIN_ACTIVE_CELLS:
        print(f"\n⚠️ WARNING: Seulement {mailles_actives} mailles actives (< {MIN_ACTIVE_CELLS})")
        print(f"   → Les graphes seront peu représentatifs")
        return False
    
    print(f"  ✅ Qualité des données: OK")
    return True

# ============================================================================
# Récupération données
# ============================================================================

def fetch_active_cells_data(conn, parameter_id):
    """Récupère uniquement les mailles avec données (n_sondages > 0)"""
    query = f"""
    SELECT 
        maille_id,
        adm1_name,
        adm2_name,
        adm3_name,
        n_sondages,
        {parameter_id}
    FROM atlas.mailles_with_data
    WHERE n_sondages > 0
      AND {parameter_id} IS NOT NULL
    ORDER BY adm2_name NULLS LAST, {parameter_id}
    """
    
    df = pd.read_sql(query, conn)
    print(f"  📊 {parameter_id}: {len(df)} mailles actives")
    
    # Statistiques ADM2
    adm2_null_count = df['adm2_name'].isna().sum()
    if adm2_null_count > 0:
        print(f"    ⚠️ {adm2_null_count} mailles sans ADM2 (seront étiquetées 'Non classé')")
    
    return df

def fetch_coverage_stats(conn):
    """Récupère statistiques de couverture"""
    query = """
    SELECT 
        COUNT(*) as total_mailles,
        COUNT(CASE WHEN n_sondages > 0 THEN 1 END) as mailles_avec_donnees,
        COUNT(CASE WHEN n_sondages = 0 OR n_sondages IS NULL THEN 1 END) as mailles_sans_donnees
    FROM atlas.mailles_with_data
    """
    
    df = pd.read_sql(query, conn)
    return df.iloc[0].to_dict()

# ============================================================================
# Génération histogrammes (sans zéros)
# ============================================================================

def generate_histogram(df, parameter):
    """Génère histogramme de distribution (mailles actives uniquement)"""
    param_id = parameter['id']
    param_label = parameter['label']
    param_unit = parameter['unit']
    
    if len(df) < MIN_ACTIVE_CELLS:
        print(f"  ⚠️ {param_id}: Pas assez de données ({len(df)} < {MIN_ACTIVE_CELLS})")
        return None
    
    # Créer histogramme
    fig = go.Figure()
    
    fig.add_trace(go.Histogram(
        x=df[param_id],
        nbinsx=30,
        marker_color='steelblue',
        marker_line_color='white',
        marker_line_width=1,
        name=param_label
    ))
    
    # Ajouter ligne médiane
    median_val = df[param_id].median()
    fig.add_vline(
        x=median_val,
        line_dash="dash",
        line_color="red",
        annotation_text=f"Médiane: {median_val:.2f}",
        annotation_position="top"
    )
    
    # Layout
    unit_str = f" ({param_unit})" if param_unit else ""
    fig.update_layout(
        title=f"Distribution {param_label}{unit_str}<br><sub>Mailles actives uniquement (n={len(df)})</sub>",
        xaxis_title=f"{param_label}{unit_str}",
        yaxis_title="Nombre de mailles",
        height=500,
        template='plotly_white',
        showlegend=False
    )
    
    # Export
    html_path = OUTPUT_DIR / f'{param_id}_histogram.html'
    fig.write_html(str(html_path))
    print(f"  ✅ {param_id}: {html_path}")
    
    return fig

# ============================================================================
# Génération boxplots par ADM2
# ============================================================================

def generate_boxplot_adm2(df, parameter):
    """Génère boxplot par préfecture (ADM2)"""
    param_id = parameter['id']
    param_label = parameter['label']
    param_unit = parameter['unit']
    
    # Remplacer NaN par "Non classé"
    df_plot = df.copy()
    df_plot['adm2_name'] = df_plot['adm2_name'].fillna('Non classé')
    
    # Compter mailles par ADM2
    adm2_counts = df_plot.groupby('adm2_name').size().sort_values(ascending=False)
    
    if len(adm2_counts) < 2:
        print(f"  ⚠️ {param_id}: Pas assez d'ADM2 distincts ({len(adm2_counts)})")
        return None
    
    # Créer figure
    fig = go.Figure()
    
    # Trier par nombre de mailles décroissant
    for adm2 in adm2_counts.index:
        data = df_plot[df_plot['adm2_name'] == adm2][param_id]
        
        fig.add_trace(go.Box(
            y=data,
            name=f"{adm2} (n={len(data)})",
            boxmean='sd',
            marker_color='lightblue',
            line_color='darkblue'
        ))
    
    # Layout
    unit_str = f" ({param_unit})" if param_unit else ""
    fig.update_layout(
        title=f"Distribution {param_label}{unit_str} par Préfecture (ADM2)<br><sub>Trié par nombre de mailles décroissant</sub>",
        yaxis_title=f"{param_label}{unit_str}",
        xaxis_title="Préfecture",
        height=600,
        template='plotly_white',
        showlegend=False
    )
    
    # Export
    html_path = OUTPUT_DIR / f'{param_id}_boxplot_adm2.html'
    fig.write_html(str(html_path))
    print(f"  ✅ {param_id}: {html_path}")
    
    return fig

# ============================================================================
# Génération bar chart par ADM2
# ============================================================================

def generate_barchart_adm2(df, parameter):
    """Génère bar chart par préfecture (ADM2)"""
    param_id = parameter['id']
    param_label = parameter['label']
    param_unit = parameter['unit']
    
    # Remplacer NaN par "Non classé"
    df_plot = df.copy()
    df_plot['adm2_name'] = df_plot['adm2_name'].fillna('Non classé')
    
    # Agréger par ADM2
    agg_data = df_plot.groupby('adm2_name').agg({
        param_id: ['mean', 'median', 'count']
    }).reset_index()
    
    agg_data.columns = ['adm2_name', 'mean', 'median', 'count']
    agg_data = agg_data.sort_values('count', ascending=False)
    
    # Créer bar chart
    fig = go.Figure()
    
    fig.add_trace(go.Bar(
        x=agg_data['adm2_name'],
        y=agg_data['median'],
        name='Médiane',
        marker_color='steelblue',
        text=agg_data['median'].round(2),
        textposition='outside'
    ))
    
    # Layout
    unit_str = f" ({param_unit})" if param_unit else ""
    fig.update_layout(
        title=f"{param_label}{unit_str} par Préfecture (Médiane)<br><sub>Trié par nombre de mailles décroissant</sub>",
        xaxis_title="Préfecture",
        yaxis_title=f"{param_label}{unit_str}",
        height=600,
        template='plotly_white',
        showlegend=False
    )
    
    # Export
    html_path = OUTPUT_DIR / f'{param_id}_barchart_adm2.html'
    fig.write_html(str(html_path))
    print(f"  ✅ {param_id}: {html_path}")
    
    return fig

# ============================================================================
# Génération camembert couverture
# ============================================================================

def generate_coverage_pie(coverage_stats):
    """Génère camembert de couverture"""
    
    fig = go.Figure(data=[go.Pie(
        labels=['Avec données', 'Sans données'],
        values=[coverage_stats['mailles_avec_donnees'], coverage_stats['mailles_sans_donnees']],
        marker_colors=['#2ecc71', '#e74c3c'],
        hole=0.3,
        textinfo='label+percent+value',
        textposition='outside'
    )])
    
    fig.update_layout(
        title=f"Couverture spatiale nationale<br><sub>Total: {coverage_stats['total_mailles']} mailles</sub>",
        height=500,
        template='plotly_white'
    )
    
    # Export
    html_path = OUTPUT_DIR / 'coverage_pie.html'
    fig.write_html(str(html_path))
    print(f"  ✅ Couverture: {html_path}")
    
    return fig

# ============================================================================
# Génération README
# ============================================================================

def generate_readme(coverage_stats, parameters_stats):
    """Génère README avec statistiques"""
    
    readme_content = f"""# Analyse Nationale - Atlas Géotechnique

## Date de génération
{datetime.now().strftime('%Y-%m-%d %H:%M:%S')}

## Couverture spatiale

- **Total mailles**: {coverage_stats['total_mailles']}
- **Mailles avec données**: {coverage_stats['mailles_avec_donnees']} ({coverage_stats['mailles_avec_donnees']/coverage_stats['total_mailles']*100:.1f}%)
- **Mailles sans données**: {coverage_stats['mailles_sans_donnees']} ({coverage_stats['mailles_sans_donnees']/coverage_stats['total_mailles']*100:.1f}%)

## Paramètres analysés

| Paramètre | Mailles actives | Médiane | Min | Max |
|-----------|-----------------|---------|-----|-----|
"""
    
    for param_id, stats in parameters_stats.items():
        if stats:
            readme_content += f"| {stats['label']} | {stats['count']} | {stats['median']:.2f} | {stats['min']:.2f} | {stats['max']:.2f} |\n"
    
    readme_content += f"""

## Fichiers générés

### Histogrammes (distribution, sans zéros)
"""
    for param in PARAMETERS:
        readme_content += f"- `{param['id']}_histogram.html` - {param['label']}\n"
    
    readme_content += f"""
### Boxplots par préfecture (ADM2)
"""
    for param in PARAMETERS:
        readme_content += f"- `{param['id']}_boxplot_adm2.html` - {param['label']}\n"
    
    readme_content += f"""
### Bar charts par préfecture (ADM2)
"""
    for param in PARAMETERS:
        readme_content += f"- `{param['id']}_barchart_adm2.html` - {param['label']}\n"
    
    readme_content += f"""
### Couverture
- `coverage_pie.html` - Camembert de couverture spatiale

## Commandes de reproduction

### 1. Vérifier que les vues sont à jour
```bash
psql -U postgres -d atlas_geotechnique -c "SELECT COUNT(*) FROM atlas.v_pref_kpi;"
```

### 2. Générer les graphes
```bash
python scripts/generate_national_analysis.py
```

## Dépendances Python

```bash
pip install psycopg2-binary pandas plotly
```

## Notes importantes

- **Histogrammes**: Excluent les mailles sans données (n_sondages = 0)
- **Boxplots**: Affichent moyenne ± écart-type
- **Bar charts**: Utilisent la médiane (plus robuste aux outliers)
- **"Non classé"**: Mailles sans ADM2 attaché (nécessite post-process ADM)
- **Lecture seule**: Ce script ne modifie jamais la base de données

## Garde-fous

- Vérification de la couverture ADM2 avant génération
- Seuil minimal de {MIN_ACTIVE_CELLS} mailles actives par graphe
- Logs détaillés pour traçabilité
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
    print("  ANALYSE NATIONALE - ATLAS GÉOTECHNIQUE")
    print("  Génération graphes robustes avec garde-fous")
    print("  29/12/2025")
    print("═" * 70)
    
    # Connexion DB
    conn = get_db_connection()
    
    try:
        # Vérification qualité
        if not check_data_quality(conn):
            print("\n❌ Qualité des données insuffisante - arrêt")
            sys.exit(1)
        
        # Récupération couverture
        print("\n📥 Récupération statistiques de couverture...")
        coverage_stats = fetch_coverage_stats(conn)
        
        # Génération camembert couverture
        print("\n🥧 Génération camembert de couverture...")
        generate_coverage_pie(coverage_stats)
        
        # Génération graphes par paramètre
        parameters_stats = {}
        
        for parameter in PARAMETERS:
            param_id = parameter['id']
            print(f"\n📊 Traitement {param_id}...")
            
            # Récupération données
            df = fetch_active_cells_data(conn, param_id)
            
            if len(df) < MIN_ACTIVE_CELLS:
                print(f"  ⚠️ Pas assez de données pour {param_id}")
                parameters_stats[param_id] = None
                continue
            
            # Statistiques
            parameters_stats[param_id] = {
                'label': parameter['label'],
                'count': len(df),
                'median': df[param_id].median(),
                'min': df[param_id].min(),
                'max': df[param_id].max()
            }
            
            # Génération graphes
            generate_histogram(df, parameter)
            generate_boxplot_adm2(df, parameter)
            generate_barchart_adm2(df, parameter)
        
        # Génération README
        generate_readme(coverage_stats, parameters_stats)
        
        print("\n" + "═" * 70)
        print(f"✅ TERMINÉ - Fichiers dans: {OUTPUT_DIR}")
        print("═" * 70)
        
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
    finally:
        conn.close()

if __name__ == '__main__':
    main()
