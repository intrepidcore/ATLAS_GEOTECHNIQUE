#!/usr/bin/env python3
"""
Script d'import des données AMESSEFE Komi Yoan Freddy
Fichiers: potentielle_de_gonflement.xlsx, bleu.xlsx, Granulométrie.xlsx, classification.xlsx

Règle métier: 1 localité + 1 auteur = 1 sondage
Profondeurs: 1.0m, 1.5m, 2.0m
Operator: Serge TABE DJATO
"""

import pandas as pd
import psycopg
import argparse
import logging
import json
import re
from pathlib import Path
from typing import Dict, Tuple

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# Constantes
SOURCE = "AMESSEFE Komi Yoan Freddy"
OPERATOR = "Serge TABE DJATO"
DEPTHS = [1.0, 1.5, 2.0]

def normalize_localite(localite: str) -> str:
    """Normaliser le nom de localité pour code_site"""
    if pd.isna(localite):
        return None
    # Trim, supprimer parenthèses en trop, normaliser espaces
    clean = str(localite).strip()
    clean = re.sub(r'\s+', ' ', clean)  # Espaces multiples → 1 espace
    clean = re.sub(r'\(\s+', '(', clean)  # "( " → "("
    clean = re.sub(r'\s+\)', ')', clean)  # " )" → ")"
    return clean

def normalize_depth(depth_str: str) -> float:
    """Convertir '1m', '1,5m', '2m' → 1.0, 1.5, 2.0"""
    if pd.isna(depth_str):
        return None
    s = str(depth_str).strip().lower().replace('m', '').replace(',', '.')
    try:
        return round(float(s), 1)
    except:
        return None

def convert_wide_to_long(df: pd.DataFrame, localite_col: str, value_cols: Dict[str, float]) -> pd.DataFrame:
    """
    Convertir format WIDE → LONG
    
    Args:
        df: DataFrame source
        localite_col: nom de la colonne localité
        value_cols: dict {nom_colonne: depth_m}
    
    Returns:
        DataFrame avec colonnes: localite, depth_m, + colonnes de valeurs
    """
    rows = []
    for idx, row in df.iterrows():
        localite = normalize_localite(row.get(localite_col))
        if not localite:
            continue
        
        for col_name, depth in value_cols.items():
            if col_name in df.columns:
                value = row.get(col_name)
                if pd.notna(value):
                    rows.append({
                        'localite': localite,
                        'depth_m': depth,
                        'value': value,
                        'column': col_name
                    })
    
    return pd.DataFrame(rows)

class AmessefeImporter:
    def __init__(self, dsn: str, dry_run: bool = False):
        self.dsn = dsn
        self.dry_run = dry_run
        self.conn = None
        self.sondage_map = {}  # {code: sondage_id}
        self.echantillon_map = {}  # {(code, depth): echantillon_id}
        
    def __enter__(self):
        self.conn = psycopg.connect(self.dsn)
        self.conn.autocommit = False
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if exc_type is None and not self.dry_run:
            self.conn.commit()
            logger.info("✓ Transaction committée")
        else:
            self.conn.rollback()
            if exc_type:
                logger.error(f"✗ Transaction annulée: {exc_val}")
        self.conn.close()
    
    def create_sondages(self, localites: set):
        """Créer les sondages AMESSEFE (1 par localité) - IDEMPOTENT"""
        logger.info(f"\n📍 Création des sondages pour {len(localites)} localités...")
        
        created = 0
        existing = 0
        
        with self.conn.cursor() as cur:
            for localite in sorted(localites):
                code = normalize_localite(localite)
                if not code:
                    continue
                
                # Vérifier si le sondage existe déjà via meta->>'localite' + source
                # (correspond à l'index unique idx_sondages_amessefe_unique)
                cur.execute("""
                    SELECT id FROM sondages
                    WHERE meta->>'localite' = %s AND source = %s
                """, (localite, SOURCE))
                row = cur.fetchone()
                
                if row:
                    sondage_id = row[0]
                    existing += 1
                else:
                    # Créer le sondage avec code = localité normalisée (PAS de préfixe)
                    meta = json.dumps({
                        'code': code,
                        'localite': localite,
                        'auteur': SOURCE
                    })
                    
                    cur.execute("""
                        INSERT INTO sondages (geom, date, source, operator, meta, created_at, updated_at)
                        VALUES (NULL, NULL, %s, %s, %s::jsonb, now(), now())
                        RETURNING id;
                    """, (SOURCE, OPERATOR, meta))
                    sondage_id = cur.fetchone()[0]
                    created += 1
                
                self.sondage_map[code] = sondage_id
        
        logger.info(f"  ✓ {created} sondages créés, {existing} existants")
        return created, existing
    
    def create_echantillons(self):
        """Créer les échantillons (1m, 1.5m, 2m) pour chaque sondage"""
        logger.info(f"\n🧪 Création des échantillons (3 profondeurs par sondage)...")
        
        created = 0
        existing = 0
        
        with self.conn.cursor() as cur:
            for code, sondage_id in self.sondage_map.items():
                for depth in DEPTHS:
                    cur.execute("""
                        INSERT INTO echantillons (sondage_id, depth_m, date, laboratory, created_at)
                        VALUES (%s, %s, NULL, 'AMESSEFE', now())
                        ON CONFLICT (sondage_id, depth_m, date) DO NOTHING
                        RETURNING id;
                    """, (sondage_id, depth))
                    
                    row = cur.fetchone()
                    if row:
                        echantillon_id = row[0]
                        created += 1
                    else:
                        # Déjà existant, récupérer l'ID
                        cur.execute("""
                            SELECT id FROM echantillons
                            WHERE sondage_id = %s AND depth_m = %s
                        """, (sondage_id, depth))
                        echantillon_id = cur.fetchone()[0]
                        existing += 1
                    
                    self.echantillon_map[(code, depth)] = echantillon_id
        
        logger.info(f"  ✓ {created} échantillons créés, {existing} existants")
        return created, existing
    
    def import_vbs(self, filepath: Path):
        """Importer bleu.xlsx → essais_vbs"""
        logger.info(f"\n💙 Import VBS (bleu): {filepath.name}")
        
        xl = pd.ExcelFile(filepath)
        total_imported = 0
        total_errors = 0
        
        for sheet_name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name)
            
            # Identifier la colonne localité
            localite_col = None
            for col in df.columns:
                if 'localit' in str(col).lower():
                    localite_col = col
                    break
            
            if not localite_col:
                logger.warning(f"  ⚠️  Sheet '{sheet_name}': colonne localité introuvable")
                continue
            
            # Colonnes VBS: 1, 1.5, 2 (numériques)
            vbs_cols = {1: 1.0, 1.5: 1.5, 2: 2.0}
            vbs_qual_cols = {'1.1': 1.0, '1.5.1': 1.5, '2.1': 2.0}
            
            with self.conn.cursor() as cur:
                for idx, row in df.iterrows():
                    localite = normalize_localite(row.get(localite_col))
                    if not localite:
                        continue
                    
                    code = normalize_localite(localite)
                    
                    for col, depth in vbs_cols.items():
                        if col not in df.columns:
                            continue
                        
                        vbs_value = row.get(col)
                        if pd.isna(vbs_value):
                            continue
                        
                        # Récupérer le qualificatif correspondant
                        qual_col = list(vbs_qual_cols.keys())[list(vbs_qual_cols.values()).index(depth)]
                        vbs_qual = row.get(qual_col) if qual_col in df.columns else None
                        
                        key = (code, depth)
                        echantillon_id = self.echantillon_map.get(key)
                        
                        if not echantillon_id:
                            logger.warning(f"  ⚠️  Échantillon {code}@{depth}m introuvable")
                            total_errors += 1
                            continue
                        
                        try:
                            # Insérer dans essais_vbs (source of truth)
                            cur.execute("""
                                INSERT INTO essais_vbs (echantillon_id, vbs, created_at)
                                VALUES (%s, %s, now())
                                ON CONFLICT (echantillon_id)
                                DO UPDATE SET
                                  vbs = EXCLUDED.vbs;
                            """, (echantillon_id, float(vbs_value)))
                            
                            total_imported += 1
                        except Exception as e:
                            logger.error(f"  ✗ Erreur {code}@{depth}m: {e}")
                            total_errors += 1
        
        logger.info(f"  ✓ {total_imported} VBS importés, {total_errors} erreurs")
        return total_imported, total_errors
    
    def import_potentiel_gonflement(self, filepath: Path):
        """Importer potentielle_de_gonflement.xlsx → essais_classif.cg"""
        logger.info(f"\n📈 Import Potentiel de gonflement: {filepath.name}")
        
        xl = pd.ExcelFile(filepath)
        total_imported = 0
        total_errors = 0
        
        for sheet_name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name)
            
            localite_col = 'Localité'
            if localite_col not in df.columns:
                logger.warning(f"  ⚠️  Sheet '{sheet_name}': colonne Localité introuvable")
                continue
            
            # Mapping colonnes → profondeurs
            cg_cols = {
                'Potentiel gonflement (cg) 1m': 1.0,
                'Potentiel gonflement (cg) 1,5m': 1.5,
                'Potentiel gonflement (cg) 2m': 2.0
            }
            
            qual_cols = {
                'Analyse 1m': 1.0,
                'Analyse 1,5m': 1.5,
                'Analyse 2m': 2.0
            }
            
            with self.conn.cursor() as cur:
                for idx, row in df.iterrows():
                    localite = normalize_localite(row.get(localite_col))
                    if not localite:
                        continue
                    
                    code = normalize_localite(localite)
                    type_sol = row.get('Type de sol')
                    
                    for col, depth in cg_cols.items():
                        if col not in df.columns:
                            continue
                        
                        cg_value = row.get(col)
                        if pd.isna(cg_value):
                            continue
                        
                        # Convertir virgule → point
                        if isinstance(cg_value, str):
                            cg_value = cg_value.replace(',', '.')
                        
                        # Récupérer le qualificatif
                        qual_col = list(qual_cols.keys())[list(qual_cols.values()).index(depth)]
                        cg_qual = row.get(qual_col) if qual_col in df.columns else None
                        
                        key = (code, depth)
                        echantillon_id = self.echantillon_map.get(key)
                        
                        if not echantillon_id:
                            logger.warning(f"  ⚠️  Échantillon {code}@{depth}m introuvable")
                            total_errors += 1
                            continue
                        
                        try:
                            # Insérer dans essais_classif (source of truth)
                            cur.execute("""
                                INSERT INTO essais_classif (echantillon_id, depth_m, cg, cg_qual, type_sol, laboratory, created_at)
                                VALUES (%s, %s, %s, %s, %s, 'FORMATEC', now())
                                ON CONFLICT (echantillon_id)
                                DO UPDATE SET
                                  cg = EXCLUDED.cg,
                                  cg_qual = EXCLUDED.cg_qual,
                                  type_sol = COALESCE(EXCLUDED.type_sol, essais_classif.type_sol),
                                  laboratory = EXCLUDED.laboratory,
                                  updated_at = now();
                            """, (echantillon_id, depth, float(cg_value), cg_qual, type_sol))
                            total_imported += 1
                        except Exception as e:
                            logger.error(f"  ✗ Erreur {code}@{depth}m: {e}")
                            total_errors += 1
        
        logger.info(f"  ✓ {total_imported} potentiels de gonflement importés, {total_errors} erreurs")
        return total_imported, total_errors
    
    def import_granulometrie(self, filepath: Path):
        """Importer Granulométrie.xlsx → granulo_points"""
        logger.info(f"\n📊 Import Granulométrie: {filepath.name}")
        
        xl = pd.ExcelFile(filepath)
        total_imported = 0
        total_errors = 0
        
        for sheet_name in xl.sheet_names:
            # Lire en sautant les 2 premières lignes (en-têtes mal placés)
            df = pd.read_excel(xl, sheet_name, skiprows=2)
            
            # Identifier la colonne localité
            localite_col = None
            for col in df.columns:
                if 'localit' in str(col).lower():
                    localite_col = col
                    break
            
            if not localite_col:
                logger.warning(f"  ⚠️  Sheet '{sheet_name}': colonne localité introuvable")
                continue
            
            # Colonnes de passants (assumées être 1.0, 1.5, 2.0)
            passant_cols = {1.0: 1.0, 1.5: 1.5, 2.0: 2.0}
            
            with self.conn.cursor() as cur:
                for idx, row in df.iterrows():
                    localite = normalize_localite(row.get(localite_col))
                    if not localite:
                        continue
                    
                    code = normalize_localite(localite)
                    
                    for col, depth in passant_cols.items():
                        if col not in df.columns:
                            continue
                        
                        passant_value = row.get(col)
                        if pd.isna(passant_value):
                            continue
                        
                        key = (code, depth)
                        echantillon_id = self.echantillon_map.get(key)
                        
                        if not echantillon_id:
                            logger.warning(f"  ⚠️  Échantillon {code}@{depth}m introuvable")
                            total_errors += 1
                            continue
                        
                        try:
                            # Insérer dans granulo_points (source of truth)
                            # Assumons tamis 80µm pour l'instant (à ajuster selon contexte)
                            cur.execute("""
                                INSERT INTO granulo_points (echantillon_id, sieve_mm, passing_pct, created_at)
                                VALUES (%s, 0.08, %s, now())
                                ON CONFLICT (echantillon_id, sieve_mm)
                                DO UPDATE SET
                                  passing_pct = EXCLUDED.passing_pct,
                                  updated_at = now();
                            """, (echantillon_id, float(passant_value)))
                            total_imported += 1
                        except Exception as e:
                            logger.error(f"  ✗ Erreur {code}@{depth}m: {e}")
                            total_errors += 1
        
        logger.info(f"  ✓ {total_imported} granulométries importées, {total_errors} erreurs")
        return total_imported, total_errors
    
    def import_classification(self, filepath: Path):
        """Importer classification.xlsx → essais_classif.class_*"""
        logger.info(f"\n🏷️  Import Classifications: {filepath.name}")
        
        xl = pd.ExcelFile(filepath)
        total_imported = 0
        total_errors = 0
        
        for sheet_name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name)
            
            if 'Localité' not in df.columns or 'Profondeur' not in df.columns:
                logger.warning(f"  ⚠️  Sheet '{sheet_name}': colonnes manquantes")
                continue
            
            with self.conn.cursor() as cur:
                for idx, row in df.iterrows():
                    localite = normalize_localite(row.get('Localité'))
                    if not localite:
                        continue
                    
                    code = normalize_localite(localite)
                    depth = normalize_depth(row.get('Profondeur'))
                    
                    if depth is None:
                        continue
                    
                    key = (code, depth)
                    echantillon_id = self.echantillon_map.get(key)
                    
                    if not echantillon_id:
                        logger.warning(f"  ⚠️  Échantillon {code}@{depth}m introuvable")
                        total_errors += 1
                        continue
                    
                    # Extraire les classifications
                    class_chassagneux = row.get('Classification CHASSAGNEUX D. et al. 1996')
                    class_daksha = row.get('Classification Dakshanamurthy et Raman 1973')
                    class_seed = row.get('Classification SEED H. et al 1962')
                    class_vijay = row.get('Classification VIJAYVERGIYA et GHAZZALY 1973')
                    type_sol = row.get('Type de sol')
                    
                    try:
                        # Insérer dans essais_classif (source of truth)
                        cur.execute("""
                            INSERT INTO essais_classif (
                                echantillon_id, depth_m,
                                class_chassagneux, class_daksha, class_seed, class_vijay, type_sol,
                                laboratory, created_at
                            )
                            VALUES (%s, %s, %s, %s, %s, %s, %s, 'FORMATEC', now())
                            ON CONFLICT (echantillon_id)
                            DO UPDATE SET
                              class_chassagneux = EXCLUDED.class_chassagneux,
                              class_daksha = EXCLUDED.class_daksha,
                              class_seed = EXCLUDED.class_seed,
                              class_vijay = EXCLUDED.class_vijay,
                              type_sol = COALESCE(EXCLUDED.type_sol, essais_classif.type_sol),
                              laboratory = EXCLUDED.laboratory,
                              updated_at = now();
                        """, (echantillon_id, depth, class_chassagneux, class_daksha, class_seed, class_vijay, type_sol))
                        total_imported += 1
                    except Exception as e:
                        logger.error(f"  ✗ Erreur {code}@{depth}m: {e}")
                        total_errors += 1
        
        logger.info(f"  ✓ {total_imported} classifications importées, {total_errors} erreurs")
        return total_imported, total_errors

def main():
    parser = argparse.ArgumentParser(description='Import données AMESSEFE')
    parser.add_argument('--dsn', required=True, help='PostgreSQL DSN')
    parser.add_argument('--data-dir', default='../data/xlsx', help='Répertoire des fichiers Excel')
    parser.add_argument('--dry-run', action='store_true', help='Mode test (pas de commit)')
    
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    
    files = {
        'vbs': data_dir / 'bleu.xlsx',
        'gonflement': data_dir / 'potentielle_de_gonflement.xlsx',
        'granulo': data_dir / 'Granulométrie.xlsx',
        'classif': data_dir / 'classification.xlsx'
    }
    
    # Vérifier que tous les fichiers existent
    for name, filepath in files.items():
        if not filepath.exists():
            logger.error(f"✗ Fichier introuvable: {filepath}")
            return 1
    
    logger.info("="*80)
    logger.info("IMPORT DONNÉES AMESSEFE Komi Yoan Freddy")
    logger.info("="*80)
    logger.info(f"Source: {SOURCE}")
    logger.info(f"Operator: {OPERATOR}")
    logger.info(f"Profondeurs: {DEPTHS}")
    logger.info("="*80)
    
    try:
        with AmessefeImporter(args.dsn, args.dry_run) as importer:
            # 1. Collecter toutes les localités uniques
            all_localites = set()
            
            for name, filepath in files.items():
                xl = pd.ExcelFile(filepath)
                for sheet in xl.sheet_names:
                    df = pd.read_excel(xl, sheet, skiprows=2 if name == 'granulo' else 0)
                    for col in df.columns:
                        if 'localit' in str(col).lower():
                            localites = df[col].dropna().apply(normalize_localite).unique()
                            all_localites.update(localites)
                            break
            
            logger.info(f"\n📋 {len(all_localites)} localités uniques détectées")
            
            # 2. Créer sondages et échantillons
            importer.create_sondages(all_localites)
            importer.create_echantillons()
            
            # 3. Importer les données dans les tables source of truth
            logger.info("\n" + "="*80)
            logger.info("IMPORT DANS LES TABLES SOURCE OF TRUTH")
            logger.info("  → essais_vbs (VBS)")
            logger.info("  → essais_classif (classifications + potentiel gonflement)")
            logger.info("  → granulo_points (granulométrie)")
            logger.info("="*80)
            
            importer.import_vbs(files['vbs'])
            importer.import_potentiel_gonflement(files['gonflement'])
            importer.import_granulometrie(files['granulo'])
            importer.import_classification(files['classif'])
            
            logger.info("\n" + "="*80)
            logger.info("✅ IMPORT AMESSEFE TERMINÉ AVEC SUCCÈS")
            logger.info("="*80)
            
    except Exception as e:
        logger.error(f"\n✗ ERREUR FATALE: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0

if __name__ == '__main__':
    exit(main())
