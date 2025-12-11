#!/usr/bin/env python3
"""
🔍 AUDIT MÉDICO-LÉGAL - Import AMESSEFE
========================================
Ce script analyse les données AMESSEFE dans Excel vs Base de données
pour identifier les pertes d'information lors de l'import.

Fichiers sources:
- bleu.xlsx (VBS)
- limite.xlsx (Limites d'Atterberg)
- Granulométrie.xlsx
- classification.xlsx
- potentielle_de_gonflement.xlsx

Auteur: Audit automatique
Date: 2025-12-08
"""

import pandas as pd
import psycopg
import json
import sys
from pathlib import Path
from collections import defaultdict
from uuid import UUID
import re

# Configuration
DATA_DIR = Path(__file__).parent.parent / "data" / "xlsx"
DSN = "postgresql://atlas:atlas@localhost:5432/atlas_clean"
SOURCE_AMESSEFE = "AMESSEFE Komi Yoan Freddy"

# Fichiers à auditer
FILES = {
    'vbs': DATA_DIR / 'bleu.xlsx',
    'limites': DATA_DIR / 'limite.xlsx',
    'granulo': DATA_DIR / 'Granulométrie.xlsx',
    'classif': DATA_DIR / 'classification.xlsx',
    'gonflement': DATA_DIR / 'potentielle_de_gonflement.xlsx',
}

def normalize_localite(localite: str) -> str:
    """Normaliser le nom de localité"""
    if pd.isna(localite):
        return None
    clean = str(localite).strip()
    clean = re.sub(r'\s+', ' ', clean)
    clean = re.sub(r'\(\s+', '(', clean)
    clean = re.sub(r'\s+\)', ')', clean)
    return clean

def print_header(title: str):
    """Afficher un header formaté"""
    print("\n" + "=" * 80)
    print(f"  {title}")
    print("=" * 80)

def print_section(title: str):
    """Afficher une section"""
    print(f"\n--- {title} ---")

# =============================================================================
# PHASE 1: Analyser les fichiers Excel
# =============================================================================

def analyze_excel_files():
    """Analyser tous les fichiers Excel et extraire les statistiques"""
    print_header("📂 PHASE 1: VÉRITÉ DE RÉFÉRENCE CÔTÉ EXCEL")
    
    excel_stats = {}
    all_localites = set()
    
    # 1. VBS (bleu.xlsx)
    print_section("1.1 Analyse bleu.xlsx (VBS)")
    if FILES['vbs'].exists():
        df = pd.read_excel(FILES['vbs'])
        localite_col = None
        for col in df.columns:
            if 'localit' in str(col).lower():
                localite_col = col
                break
        
        if localite_col:
            vbs_stats = {}
            for idx, row in df.iterrows():
                loc = normalize_localite(row.get(localite_col))
                if loc:
                    all_localites.add(loc)
                    # Compter les profondeurs avec données VBS
                    count = 0
                    for col in [1, 1.5, 2]:
                        if col in df.columns and pd.notna(row.get(col)):
                            count += 1
                    vbs_stats[loc] = count
            
            excel_stats['vbs'] = vbs_stats
            print(f"  ✓ {len(vbs_stats)} localités avec VBS")
            print(f"  ✓ Total essais VBS: {sum(vbs_stats.values())}")
    else:
        print(f"  ⚠️ Fichier non trouvé: {FILES['vbs']}")
    
    # 2. Limites (limite.xlsx)
    print_section("1.2 Analyse limite.xlsx (Limites d'Atterberg)")
    if FILES['limites'].exists():
        df = pd.read_excel(FILES['limites'])
        limites_stats = defaultdict(int)
        
        if 'Localité' in df.columns:
            for idx, row in df.iterrows():
                loc = normalize_localite(row.get('Localité'))
                if loc:
                    all_localites.add(loc)
                    limites_stats[loc] += 1
            
            excel_stats['limites'] = dict(limites_stats)
            print(f"  ✓ {len(limites_stats)} localités avec Limites")
            print(f"  ✓ Total essais Limites: {sum(limites_stats.values())}")
    else:
        print(f"  ⚠️ Fichier non trouvé: {FILES['limites']}")
    
    # 3. Granulométrie
    print_section("1.3 Analyse Granulométrie.xlsx")
    if FILES['granulo'].exists():
        xl = pd.ExcelFile(FILES['granulo'])
        granulo_stats = {}
        
        for sheet in xl.sheet_names:
            df = pd.read_excel(xl, sheet)
            localite_col = None
            for col in df.columns:
                if 'localit' in str(col).lower():
                    localite_col = col
                    break
            
            if localite_col:
                for idx, row in df.iterrows():
                    loc = normalize_localite(row.get(localite_col))
                    if loc:
                        all_localites.add(loc)
                        count = 0
                        for col in [1, 1.5, 2, '1', '1.5', '2']:
                            if col in df.columns and pd.notna(row.get(col)):
                                count += 1
                        if loc not in granulo_stats:
                            granulo_stats[loc] = 0
                        granulo_stats[loc] += count
        
        excel_stats['granulo'] = granulo_stats
        print(f"  ✓ {len(granulo_stats)} localités avec Granulo")
        print(f"  ✓ Total points Granulo: {sum(granulo_stats.values())}")
    else:
        print(f"  ⚠️ Fichier non trouvé: {FILES['granulo']}")
    
    # 4. Classification
    print_section("1.4 Analyse classification.xlsx")
    if FILES['classif'].exists():
        df = pd.read_excel(FILES['classif'])
        classif_stats = defaultdict(int)
        
        if 'Localité' in df.columns:
            for idx, row in df.iterrows():
                loc = normalize_localite(row.get('Localité'))
                if loc:
                    all_localites.add(loc)
                    classif_stats[loc] += 1
            
            excel_stats['classif'] = dict(classif_stats)
            print(f"  ✓ {len(classif_stats)} localités avec Classification")
            print(f"  ✓ Total essais Classification: {sum(classif_stats.values())}")
    else:
        print(f"  ⚠️ Fichier non trouvé: {FILES['classif']}")
    
    # 5. Potentiel de gonflement
    print_section("1.5 Analyse potentielle_de_gonflement.xlsx")
    if FILES['gonflement'].exists():
        df = pd.read_excel(FILES['gonflement'])
        gonflement_stats = defaultdict(int)
        
        if 'Localité' in df.columns:
            for idx, row in df.iterrows():
                loc = normalize_localite(row.get('Localité'))
                if loc:
                    all_localites.add(loc)
                    # Compter les profondeurs avec données
                    count = 0
                    for col in df.columns:
                        if 'gonflement' in str(col).lower() and pd.notna(row.get(col)):
                            count += 1
                    gonflement_stats[loc] += count
            
            excel_stats['gonflement'] = dict(gonflement_stats)
            print(f"  ✓ {len(gonflement_stats)} localités avec Gonflement")
            print(f"  ✓ Total essais Gonflement: {sum(gonflement_stats.values())}")
    else:
        print(f"  ⚠️ Fichier non trouvé: {FILES['gonflement']}")
    
    # Résumé
    print_section("1.6 RÉSUMÉ EXCEL")
    print(f"  📊 Total localités uniques: {len(all_localites)}")
    
    return excel_stats, all_localites

# =============================================================================
# PHASE 2: Audit de la base de données
# =============================================================================

def audit_database():
    """Auditer les données AMESSEFE en base"""
    print_header("🗄️ PHASE 2: AUDIT DES DONNÉES BRUTES EN BASE")
    
    db_stats = {}
    
    with psycopg.connect(DSN) as conn:
        with conn.cursor() as cur:
            # 2.1 Sondages AMESSEFE
            print_section("2.1 Sondages AMESSEFE")
            cur.execute("""
                SELECT COUNT(*) FROM sondages 
                WHERE source = %s
            """, (SOURCE_AMESSEFE,))
            nb_sondages = cur.fetchone()[0]
            print(f"  ✓ Nombre de sondages: {nb_sondages}")
            
            # Liste des sondages avec localité
            cur.execute("""
                SELECT id, meta->>'localite' as localite, meta->>'code' as code
                FROM sondages 
                WHERE source = %s
                ORDER BY meta->>'localite'
            """, (SOURCE_AMESSEFE,))
            sondages = cur.fetchall()
            db_stats['sondages'] = {row[1]: {'id': row[0], 'code': row[2]} for row in sondages}
            
            # 2.2 Échantillons
            print_section("2.2 Échantillons liés")
            cur.execute("""
                SELECT COUNT(*) 
                FROM echantillons e
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.source = %s
            """, (SOURCE_AMESSEFE,))
            nb_echantillons = cur.fetchone()[0]
            print(f"  ✓ Nombre d'échantillons: {nb_echantillons}")
            
            # Par sondage
            cur.execute("""
                SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                FROM echantillons e
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.source = %s
                GROUP BY s.meta->>'localite'
            """, (SOURCE_AMESSEFE,))
            echantillons_par_loc = {row[0]: row[1] for row in cur.fetchall()}
            db_stats['echantillons'] = echantillons_par_loc
            
            # 2.3 VBS
            print_section("2.3 Essais VBS")
            cur.execute("""
                SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                FROM essais_vbs v
                JOIN echantillons e ON v.echantillon_id = e.id
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.source = %s
                GROUP BY s.meta->>'localite'
            """, (SOURCE_AMESSEFE,))
            vbs_db = {row[0]: row[1] for row in cur.fetchall()}
            db_stats['vbs'] = vbs_db
            print(f"  ✓ Localités avec VBS: {len(vbs_db)}")
            print(f"  ✓ Total essais VBS: {sum(vbs_db.values())}")
            
            # 2.4 Limites (essais_limites ou dans essais_geotechniques?)
            print_section("2.4 Essais Limites d'Atterberg")
            # Vérifier si la table essais_limites existe
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'essais_limites'
                )
            """)
            has_essais_limites = cur.fetchone()[0]
            
            if has_essais_limites:
                cur.execute("""
                    SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                    FROM essais_limites l
                    JOIN echantillons e ON l.echantillon_id = e.id
                    JOIN sondages s ON e.sondage_id = s.id
                    WHERE s.source = %s
                    GROUP BY s.meta->>'localite'
                """, (SOURCE_AMESSEFE,))
                limites_db = {row[0]: row[1] for row in cur.fetchall()}
            else:
                # Peut-être dans essais_geotechniques avec wl, wp, ip
                cur.execute("""
                    SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                    FROM essais_geotechniques eg
                    JOIN echantillons e ON eg.echantillon_id = e.id
                    JOIN sondages s ON e.sondage_id = s.id
                    WHERE s.source = %s
                    AND (eg.wl IS NOT NULL OR eg.wp IS NOT NULL OR eg.ip IS NOT NULL)
                    GROUP BY s.meta->>'localite'
                """, (SOURCE_AMESSEFE,))
                limites_db = {row[0]: row[1] for row in cur.fetchall()}
            
            db_stats['limites'] = limites_db
            print(f"  ✓ Localités avec Limites: {len(limites_db)}")
            print(f"  ✓ Total essais Limites: {sum(limites_db.values()) if limites_db else 0}")
            
            # 2.5 Classifications
            print_section("2.5 Essais Classifications")
            cur.execute("""
                SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                FROM essais_classif c
                JOIN echantillons e ON c.echantillon_id = e.id
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.source = %s
                GROUP BY s.meta->>'localite'
            """, (SOURCE_AMESSEFE,))
            classif_db = {row[0]: row[1] for row in cur.fetchall()}
            db_stats['classif'] = classif_db
            print(f"  ✓ Localités avec Classification: {len(classif_db)}")
            print(f"  ✓ Total essais Classification: {sum(classif_db.values()) if classif_db else 0}")
            
            # 2.6 Granulométrie
            print_section("2.6 Granulométrie (granulo_points)")
            cur.execute("""
                SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                FROM granulo_points p
                JOIN echantillons e ON p.echantillon_id = e.id
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.source = %s
                GROUP BY s.meta->>'localite'
            """, (SOURCE_AMESSEFE,))
            granulo_db = {row[0]: row[1] for row in cur.fetchall()}
            db_stats['granulo'] = granulo_db
            print(f"  ✓ Localités avec Granulo: {len(granulo_db)}")
            print(f"  ✓ Total points Granulo: {sum(granulo_db.values()) if granulo_db else 0}")
            
            # 2.7 Potentiel de gonflement
            print_section("2.7 Potentiel de gonflement")
            # Vérifier si la table existe
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.tables 
                    WHERE table_schema = 'public' AND table_name = 'essais_potentiel_gonflement'
                )
            """)
            has_gonflement = cur.fetchone()[0]
            
            if has_gonflement:
                cur.execute("""
                    SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                    FROM essais_potentiel_gonflement g
                    JOIN echantillons e ON g.echantillon_id = e.id
                    JOIN sondages s ON e.sondage_id = s.id
                    WHERE s.source = %s
                    GROUP BY s.meta->>'localite'
                """, (SOURCE_AMESSEFE,))
                gonflement_db = {row[0]: row[1] for row in cur.fetchall()}
            else:
                # Peut-être dans essais_geotechniques avec cg
                cur.execute("""
                    SELECT s.meta->>'localite' as localite, COUNT(*) as nb
                    FROM essais_geotechniques eg
                    JOIN echantillons e ON eg.echantillon_id = e.id
                    JOIN sondages s ON e.sondage_id = s.id
                    WHERE s.source = %s AND eg.cg IS NOT NULL
                    GROUP BY s.meta->>'localite'
                """, (SOURCE_AMESSEFE,))
                gonflement_db = {row[0]: row[1] for row in cur.fetchall()}
            
            db_stats['gonflement'] = gonflement_db
            print(f"  ✓ Localités avec Gonflement: {len(gonflement_db)}")
            print(f"  ✓ Total essais Gonflement: {sum(gonflement_db.values()) if gonflement_db else 0}")
            
            # 2.8 Structure des tables
            print_section("2.8 Structure des tables critiques")
            
            # granulo_points
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'granulo_points'
                ORDER BY ordinal_position
            """)
            cols = [row[0] for row in cur.fetchall()]
            print(f"  granulo_points: {', '.join(cols)}")
            has_updated_at = 'updated_at' in cols
            print(f"    → updated_at existe: {'✓ OUI' if has_updated_at else '❌ NON'}")
            
            # essais_classif
            cur.execute("""
                SELECT column_name FROM information_schema.columns
                WHERE table_name = 'essais_classif'
                ORDER BY ordinal_position
            """)
            cols = [row[0] for row in cur.fetchall()]
            print(f"  essais_classif: {', '.join(cols)}")
    
    return db_stats

# =============================================================================
# PHASE 3: Comparaison Excel vs DB
# =============================================================================

def compare_excel_db(excel_stats, db_stats, all_localites):
    """Comparer les données Excel avec la base"""
    print_header("🔍 PHASE 3: COMPARAISON EXCEL vs BASE DE DONNÉES")
    
    comparison = []
    
    for loc in sorted(all_localites):
        row = {
            'localite': loc,
            'vbs_excel': excel_stats.get('vbs', {}).get(loc, 0),
            'vbs_db': db_stats.get('vbs', {}).get(loc, 0),
            'limites_excel': excel_stats.get('limites', {}).get(loc, 0),
            'limites_db': db_stats.get('limites', {}).get(loc, 0),
            'granulo_excel': excel_stats.get('granulo', {}).get(loc, 0),
            'granulo_db': db_stats.get('granulo', {}).get(loc, 0),
            'classif_excel': excel_stats.get('classif', {}).get(loc, 0),
            'classif_db': db_stats.get('classif', {}).get(loc, 0),
            'gonflement_excel': excel_stats.get('gonflement', {}).get(loc, 0),
            'gonflement_db': db_stats.get('gonflement', {}).get(loc, 0),
        }
        
        # Calculer les statuts
        row['vbs_status'] = get_status(row['vbs_excel'], row['vbs_db'])
        row['limites_status'] = get_status(row['limites_excel'], row['limites_db'])
        row['granulo_status'] = get_status(row['granulo_excel'], row['granulo_db'])
        row['classif_status'] = get_status(row['classif_excel'], row['classif_db'])
        row['gonflement_status'] = get_status(row['gonflement_excel'], row['gonflement_db'])
        
        comparison.append(row)
    
    # Afficher le résumé
    print_section("3.1 Résumé par type d'essai")
    
    for essai in ['vbs', 'limites', 'granulo', 'classif', 'gonflement']:
        ok = sum(1 for r in comparison if r[f'{essai}_status'] == 'OK')
        partiel = sum(1 for r in comparison if r[f'{essai}_status'] == 'PARTIEL')
        manquant = sum(1 for r in comparison if r[f'{essai}_status'] == 'MANQUANT')
        na = sum(1 for r in comparison if r[f'{essai}_status'] == 'N/A')
        
        total_excel = sum(r[f'{essai}_excel'] for r in comparison)
        total_db = sum(r[f'{essai}_db'] for r in comparison)
        
        print(f"\n  {essai.upper()}:")
        print(f"    Excel: {total_excel} | DB: {total_db} | Diff: {total_excel - total_db}")
        print(f"    ✅ OK: {ok} | ⚠️ Partiel: {partiel} | ❌ Manquant: {manquant} | ➖ N/A: {na}")
    
    # Afficher les localités problématiques
    print_section("3.2 Localités avec données MANQUANTES")
    
    problematic = [r for r in comparison if any(
        r[f'{e}_status'] == 'MANQUANT' for e in ['vbs', 'limites', 'granulo', 'classif', 'gonflement']
    )]
    
    if problematic:
        print(f"\n  {len(problematic)} localités avec au moins un type d'essai manquant:\n")
        for r in problematic[:20]:  # Limiter à 20
            issues = []
            for e in ['vbs', 'limites', 'granulo', 'classif', 'gonflement']:
                if r[f'{e}_status'] == 'MANQUANT':
                    issues.append(f"{e}({r[f'{e}_excel']}→0)")
            print(f"    • {r['localite']}: {', '.join(issues)}")
        
        if len(problematic) > 20:
            print(f"    ... et {len(problematic) - 20} autres")
    else:
        print("  ✅ Aucune localité avec données manquantes!")
    
    return comparison

def get_status(excel_val, db_val):
    """Déterminer le statut de comparaison"""
    if excel_val == 0 and db_val == 0:
        return 'N/A'
    elif excel_val == db_val:
        return 'OK'
    elif db_val == 0 and excel_val > 0:
        return 'MANQUANT'
    elif 0 < db_val < excel_val:
        return 'PARTIEL'
    elif db_val > excel_val:
        return 'SURPLUS'
    else:
        return 'OK'

# =============================================================================
# PHASE 4: Analyse des vues
# =============================================================================

def analyze_views():
    """Analyser les vues utilisées par l'UI"""
    print_header("🧱 PHASE 4: ANALYSE DES VUES / UI")
    
    with psycopg.connect(DSN) as conn:
        with conn.cursor() as cur:
            # Lister les vues potentiellement utilisées
            print_section("4.1 Vues disponibles")
            cur.execute("""
                SELECT table_schema, table_name 
                FROM information_schema.views
                WHERE table_schema IN ('public', 'atlas')
                AND (table_name LIKE '%sondage%' OR table_name LIKE '%sample%' OR table_name LIKE '%essai%')
                ORDER BY table_schema, table_name
            """)
            views = cur.fetchall()
            
            for schema, name in views:
                print(f"  • {schema}.{name}")
            
            # Analyser la vue principale (probablement v_samples ou v_sondages_detail)
            print_section("4.2 Analyse de la vue v_samples_v3 (si existe)")
            cur.execute("""
                SELECT EXISTS (
                    SELECT FROM information_schema.views 
                    WHERE table_name = 'v_samples_v3'
                )
            """)
            if cur.fetchone()[0]:
                cur.execute("""
                    SELECT view_definition 
                    FROM information_schema.views 
                    WHERE table_name = 'v_samples_v3'
                """)
                definition = cur.fetchone()[0]
                print(f"  Définition (extrait):")
                print(f"  {definition[:500]}...")
            
            # Test sur un sondage spécifique (Sanfatoute de la capture)
            print_section("4.3 Test sur sondage 'Sanfatoute'")
            
            # Données brutes
            cur.execute("""
                SELECT s.id, s.meta->>'localite' as localite
                FROM sondages s
                WHERE s.source = %s AND s.meta->>'localite' ILIKE '%%sanfatoute%%'
            """, (SOURCE_AMESSEFE,))
            sondage = cur.fetchone()
            
            if sondage:
                sondage_id = sondage[0]
                print(f"  Sondage trouvé: ID={sondage_id}, localité={sondage[1]}")
                
                # Compter les essais bruts
                cur.execute("""
                    SELECT 'VBS' as type, COUNT(*) FROM essais_vbs v
                    JOIN echantillons e ON v.echantillon_id = e.id
                    WHERE e.sondage_id = %s
                    UNION ALL
                    SELECT 'Classif', COUNT(*) FROM essais_classif c
                    JOIN echantillons e ON c.echantillon_id = e.id
                    WHERE e.sondage_id = %s
                    UNION ALL
                    SELECT 'Granulo', COUNT(*) FROM granulo_points p
                    JOIN echantillons e ON p.echantillon_id = e.id
                    WHERE e.sondage_id = %s
                """, (sondage_id, sondage_id, sondage_id))
                
                print("\n  Données BRUTES:")
                for row in cur.fetchall():
                    print(f"    • {row[0]}: {row[1]}")
            else:
                print("  ⚠️ Sondage Sanfatoute non trouvé")

# =============================================================================
# MAIN
# =============================================================================

def main():
    print("\n" + "🔬" * 40)
    print("  AUDIT MÉDICO-LÉGAL - IMPORT AMESSEFE")
    print("🔬" * 40)
    
    # Phase 0: Contexte
    print_header("🧯 PHASE 0: CONTEXTE DE L'AUDIT")
    print(f"  Source: {SOURCE_AMESSEFE}")
    print(f"  Répertoire données: {DATA_DIR}")
    print(f"  Fichiers à auditer:")
    for name, path in FILES.items():
        exists = "✓" if path.exists() else "✗"
        print(f"    {exists} {name}: {path.name}")
    
    # Phase 1: Excel
    excel_stats, all_localites = analyze_excel_files()
    
    # Phase 2: DB
    db_stats = audit_database()
    
    # Phase 3: Comparaison
    comparison = compare_excel_db(excel_stats, db_stats, all_localites)
    
    # Phase 4: Vues
    analyze_views()
    
    # Résumé final
    print_header("📋 RÉSUMÉ FINAL DE L'AUDIT")
    
    print("\n  DIAGNOSTIC:")
    
    # Vérifier les problèmes majeurs
    total_limites_excel = sum(excel_stats.get('limites', {}).values())
    total_limites_db = sum(db_stats.get('limites', {}).values())
    total_granulo_excel = sum(excel_stats.get('granulo', {}).values())
    total_granulo_db = sum(db_stats.get('granulo', {}).values())
    total_classif_excel = sum(excel_stats.get('classif', {}).values())
    total_classif_db = sum(db_stats.get('classif', {}).values())
    
    has_issues = False
    
    if total_limites_excel > 0 and total_limites_db == 0:
        print(f"  ❌ LIMITES: 0/{total_limites_excel} importés → IMPORT MANQUANT")
        has_issues = True
    elif total_limites_db < total_limites_excel:
        print(f"  ⚠️ LIMITES: {total_limites_db}/{total_limites_excel} importés → PARTIEL")
        has_issues = True
    else:
        print(f"  ✅ LIMITES: {total_limites_db}/{total_limites_excel} → OK")
    
    if total_granulo_excel > 0 and total_granulo_db == 0:
        print(f"  ❌ GRANULOMÉTRIE: 0/{total_granulo_excel} importés → IMPORT ÉCHOUÉ")
        has_issues = True
    elif total_granulo_db < total_granulo_excel:
        print(f"  ⚠️ GRANULOMÉTRIE: {total_granulo_db}/{total_granulo_excel} importés → PARTIEL")
        has_issues = True
    else:
        print(f"  ✅ GRANULOMÉTRIE: {total_granulo_db}/{total_granulo_excel} → OK")
    
    if total_classif_excel > 0 and total_classif_db == 0:
        print(f"  ❌ CLASSIFICATION: 0/{total_classif_excel} importés → IMPORT ÉCHOUÉ")
        has_issues = True
    else:
        print(f"  ✅ CLASSIFICATION: {total_classif_db} en DB → OK")
    
    if has_issues:
        print("\n  RECOMMANDATION:")
        print("    1. Exécuter reset_amessefe.sql")
        print("    2. Ré-exécuter 04_import_amessefe_v2.py")
        print("    3. Relancer cet audit")
    else:
        print("\n  ✅ TOUTES LES DONNÉES SONT CORRECTEMENT IMPORTÉES")
    
    # Sauvegarder le rapport (convertir UUID en str)
    def convert_for_json(obj):
        if isinstance(obj, UUID):
            return str(obj)
        elif isinstance(obj, dict):
            return {k: convert_for_json(v) for k, v in obj.items()}
        elif isinstance(obj, list):
            return [convert_for_json(i) for i in obj]
        return obj
    
    report_path = Path(__file__).parent.parent / "audit_amessefe_report.json"
    report = {
        'excel_stats': convert_for_json({k: dict(v) if isinstance(v, dict) else v for k, v in excel_stats.items()}),
        'db_stats': convert_for_json({k: dict(v) if isinstance(v, dict) else v for k, v in db_stats.items()}),
        'comparison_summary': {
            'total_localites': len(all_localites),
            'vbs': {'excel': sum(excel_stats.get('vbs', {}).values()), 'db': sum(db_stats.get('vbs', {}).values())},
            'limites': {'excel': total_limites_excel, 'db': total_limites_db},
            'granulo': {'excel': total_granulo_excel, 'db': total_granulo_db},
            'classif': {'excel': total_classif_excel, 'db': total_classif_db},
            'gonflement': {'excel': sum(excel_stats.get('gonflement', {}).values()), 'db': sum(db_stats.get('gonflement', {}).values())},
        },
        'has_issues': has_issues
    }
    
    with open(report_path, 'w', encoding='utf-8') as f:
        json.dump(report, f, indent=2, ensure_ascii=False)
    
    print(f"\n  📄 Rapport sauvegardé: {report_path}")
    
    # Exit code pour intégration CI/CD
    return 1 if has_issues else 0

if __name__ == '__main__':
    sys.exit(main())
