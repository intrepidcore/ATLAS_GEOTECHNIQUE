#!/usr/bin/env python3
"""
Génération graphiques nationaux avec corrections:
- Bar chart trié par valeur décroissante
- Histogramme sans zéros (mailles actives uniquement)
- Camembert avec couleurs contrastées + valeurs absolues
"""

import os
import sys
from pathlib import Path
import psycopg2
import pandas as pd
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime

# Configuration
DB_CONFIG = {
    'host': os.getenv('DB_HOST', 'localhost'),
    'port': os.getenv('DB_PORT', '5432'),
    'database': os.getenv('DB_NAME', 'atlas_geotechnique'),
    'user': os.getenv('DB_USER', 'postgres'),
    'password': os.getenv('DB_PASSWORD', 'postgres')
}

OUTPUT_DIR = Path(__file__).parent.parent / 'exports' / 'graphes'
OUTPUT_DIR.mkdir(parents=True, exist_ok=True)

def get_db_connection():
    """Connexion PostgreSQL"""
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        print(f"✅ Connexion DB: {DB_CONFIG['database']}")
        return conn
    except Exception as e:
        print(f"❌ Erreur connexion DB: {e}")
        sys.exit(1)

def fetch_data_by_adm2(conn, parameter='n_sondages'):
    """Récupère données par préfecture (ADM2)"""
    query = f"""
    SELECT 
        COALESCE(adm2_name, 'Non classé') as adm2_name,
        COUNT(DISTINCT maille_id) as n_mailles,
        SUM({parameter}) as total_value,
        AVG({parameter}) as avg_value
    FROM atlas.v_maille_kpi
    WHERE {parameter} IS NOT NULL
    GROUP BY adm2_name
    ORDER BY total_value DESC
    """
    
    df = pd.read_sql(query, conn)
    print(f"📊 Données ADM2: {len(df)} préfectures, paramètre: {parameter}")
    
    # Warning si trop de "Non classé"
    non_classe_pct = df[df['adm2_name'] == 'Non classé']['n_mailles'].sum() / df['n_mailles'].sum() * 100
    if non_classe_pct > 90:
        print(f"⚠️ WARNING: {non_classe_pct:.1f}% des mailles sont 'Non classé' - jointure ADM2 semble cassée!")
    
    return df

def fetch_histogram_data(conn, parameter='n_sondages'):
    """Récupère données pour histogramme (SANS zéros)"""
    query = f"""
    SELECT {parameter} as value
    FROM atlas.v_maille_kpi
    WHERE {parameter} IS NOT NULL AND {parameter} > 0
    ORDER BY {parameter}
    """
    
    df = pd.read_sql(query, conn)
    print(f"📊 Histogramme: {len(df)} mailles actives (> 0)")
    return df

def fetch_coverage_data(conn):
    """Récupère données couverture (avec/sans données)"""
    query = """
    SELECT 
        CASE WHEN n_sondages > 0 THEN 'Avec données' ELSE 'Sans données' END as category,
        COUNT(*) as n_mailles
    FROM atlas.v_maille_kpi
    GROUP BY category
    """
    
    df = pd.read_sql(query, conn)
    print(f"📊 Couverture: {len(df)} catégories")
    return df

def generate_bar_chart(df, parameter='n_sondages', output_dir=OUTPUT_DIR):
    """Bar chart trié par valeur décroissante"""
    
    print(f"\n📊 Génération bar chart: {parameter}")
    
    # Filtrer "Non classé" si trop dominant
    if 'Non classé' in df['adm2_name'].values:
        non_classe_pct = df[df['adm2_name'] == 'Non classé']['n_mailles'].sum() / df['n_mailles'].sum() * 100
        if non_classe_pct > 90:
            print(f"  ⚠️ Skipping bar chart - {non_classe_pct:.1f}% 'Non classé'")
            return
    
    # Trier par valeur décroissante
    df_sorted = df.sort_values('total_value', ascending=False)
    
    fig, ax = plt.subplots(figsize=(12, 6))
    
    bars = ax.bar(range(len(df_sorted)), df_sorted['total_value'], color='steelblue', edgecolor='navy')
    ax.set_xticks(range(len(df_sorted)))
    ax.set_xticklabels(df_sorted['adm2_name'], rotation=45, ha='right')
    ax.set_xlabel('Préfecture (ADM2)', fontsize=12, fontweight='bold')
    ax.set_ylabel(f'Total {parameter}', fontsize=12, fontweight='bold')
    ax.set_title(f'Répartition du nombre de sondages par préfecture (ADM2)\nTrié par valeur décroissante', 
                 fontsize=14, fontweight='bold', pad=20)
    ax.grid(axis='y', alpha=0.3)
    
    # Ajouter valeurs sur les barres
    for i, (bar, val) in enumerate(zip(bars, df_sorted['total_value'])):
        height = bar.get_height()
        ax.text(bar.get_x() + bar.get_width()/2., height,
                f'{int(val)}',
                ha='center', va='bottom', fontsize=9)
    
    plt.tight_layout()
    
    output_path = output_dir / f'{parameter}_bar_3.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Bar chart: {output_path}")

def generate_boxplot(df, parameter='n_sondages', output_dir=OUTPUT_DIR):
    """Boxplot par préfecture"""
    
    print(f"\n📊 Génération boxplot: {parameter}")
    
    # Filtrer "Non classé" si trop dominant
    if 'Non classé' in df['adm2_name'].values:
        non_classe_pct = df[df['adm2_name'] == 'Non classé']['n_mailles'].sum() / df['n_mailles'].sum() * 100
        if non_classe_pct > 90:
            print(f"  ⚠️ Skipping boxplot - {non_classe_pct:.1f}% 'Non classé'")
            return
    
    fig, ax = plt.subplots(figsize=(12, 6))
    
    # Créer boxplot
    df.boxplot(column='avg_value', by='adm2_name', ax=ax)
    ax.set_xlabel('Préfecture (ADM2)', fontsize=12, fontweight='bold')
    ax.set_ylabel(f'Moyenne {parameter}', fontsize=12, fontweight='bold')
    ax.set_title(f'Distribution du nombre de sondages par préfecture (ADM2)', 
                 fontsize=14, fontweight='bold')
    plt.suptitle('')  # Supprimer titre par défaut
    ax.grid(axis='y', alpha=0.3)
    
    plt.xticks(rotation=45, ha='right')
    plt.tight_layout()
    
    output_path = output_dir / f'{parameter}_boxplot_4.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Boxplot: {output_path}")

def generate_histogram(df, parameter='n_sondages', output_dir=OUTPUT_DIR):
    """Histogramme SANS zéros (mailles actives uniquement)"""
    
    print(f"\n📊 Génération histogramme: {parameter}")
    
    if len(df) == 0:
        print(f"  ⚠️ Aucune donnée pour histogramme")
        return
    
    fig, ax = plt.subplots(figsize=(10, 6))
    
    # Histogramme
    n, bins, patches = ax.hist(df['value'], bins=20, color='lightcoral', edgecolor='darkred', alpha=0.7)
    
    ax.set_xlabel(f'{parameter}', fontsize=12, fontweight='bold')
    ax.set_ylabel('Nombre de mailles', fontsize=12, fontweight='bold')
    ax.set_title(f'Distribution du nombre de sondages par maille\n(mailles avec au moins 1 sondage)', 
                 fontsize=14, fontweight='bold', pad=20)
    ax.grid(axis='y', alpha=0.3)
    
    # Stats
    mean_val = df['value'].mean()
    median_val = df['value'].median()
    ax.axvline(mean_val, color='blue', linestyle='--', linewidth=2, label=f'Moyenne: {mean_val:.1f}')
    ax.axvline(median_val, color='green', linestyle='--', linewidth=2, label=f'Médiane: {median_val:.1f}')
    ax.legend()
    
    plt.tight_layout()
    
    output_path = output_dir / f'{parameter}_histogram_1.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Histogramme: {output_path}")

def generate_pie_chart(df, output_dir=OUTPUT_DIR):
    """Camembert avec couleurs contrastées + valeurs absolues"""
    
    print(f"\n📊 Génération camembert couverture")
    
    if len(df) == 0:
        print(f"  ⚠️ Aucune donnée pour camembert")
        return
    
    fig, ax = plt.subplots(figsize=(10, 8))
    
    # Couleurs contrastées
    colors = ['#2ecc71', '#e74c3c']  # Vert vif, Rouge vif
    
    # Créer labels avec valeurs absolues
    labels = []
    for _, row in df.iterrows():
        pct = row['n_mailles'] / df['n_mailles'].sum() * 100
        labels.append(f"{row['category']}\n{int(row['n_mailles'])} mailles ({pct:.1f}%)")
    
    # Pie chart
    wedges, texts, autotexts = ax.pie(
        df['n_mailles'], 
        labels=labels,
        colors=colors,
        autopct='',  # Pas de % dans le camembert (déjà dans labels)
        startangle=90,
        textprops={'fontsize': 12, 'fontweight': 'bold'}
    )
    
    ax.set_title('Couverture des mailles\nAvec données vs Sans données', 
                 fontsize=14, fontweight='bold', pad=20)
    
    plt.tight_layout()
    
    output_path = output_dir / 'n_sondages_pie_2.png'
    plt.savefig(output_path, dpi=300, bbox_inches='tight')
    plt.close()
    
    print(f"  ✅ Camembert: {output_path}")

def main():
    print("═" * 70)
    print("  GÉNÉRATION GRAPHIQUES NATIONAUX")
    print("  Atlas Géotechnique - Corrections appliquées")
    print("═" * 70)
    
    conn = get_db_connection()
    
    try:
        parameter = 'n_sondages'
        
        # Créer sous-dossier pour le paramètre
        param_dir = OUTPUT_DIR / parameter
        param_dir.mkdir(exist_ok=True)
        
        # 1. Bar chart par ADM2 (trié)
        df_adm2 = fetch_data_by_adm2(conn, parameter)
        generate_bar_chart(df_adm2, parameter, param_dir)
        
        # 2. Boxplot par ADM2
        generate_boxplot(df_adm2, parameter, param_dir)
        
        # 3. Histogramme (sans zéros)
        df_hist = fetch_histogram_data(conn, parameter)
        generate_histogram(df_hist, parameter, param_dir)
        
        # 4. Camembert couverture
        df_coverage = fetch_coverage_data(conn)
        generate_pie_chart(df_coverage, param_dir)
        
        print("\n" + "═" * 70)
        print(f"✅ TERMINÉ - Fichiers dans: {param_dir}")
        print("═" * 70)
        
    finally:
        conn.close()

if __name__ == '__main__':
    main()
