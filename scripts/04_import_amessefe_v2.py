#!/usr/bin/env python3
"""
Script d'import des données AMESSEFE Komi Yoan Freddy - VERSION 2
=================================================================
Fichiers sources:
- bleu.xlsx (VBS)
- limite.xlsx (Limites d'Atterberg WL/WP/IP)
- Granulométrie.xlsx
- classification.xlsx
- potentielle_de_gonflement.xlsx

Règle métier: 1 localité + 1 auteur = 1 sondage
Profondeurs: 1.0m, 1.5m, 2.0m
Operator: Serge TABE DJATO

AMÉLIORATIONS v2:
- Import des limites d'Atterberg (manquant en v1)
- Correction bug updated_at sur granulo_points
- Script idempotent (supprime avant d'insérer)
- Meilleure gestion des erreurs (pas de transaction globale cassée)
"""

import pandas as pd
import psycopg
import argparse
import logging
import json
import re
from pathlib import Path
from typing import Dict, Set, Tuple, Optional
from decimal import Decimal

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
SCHEMA = "atlas"  # Schéma PostgreSQL pour les tables

def normalize_localite(localite: str) -> str:
    """Normaliser le nom de localité pour code_site"""
    if pd.isna(localite):
        return None
    clean = str(localite).strip()
    clean = re.sub(r'\s+', ' ', clean)
    clean = re.sub(r'\(\s+', '(', clean)
    clean = re.sub(r'\s+\)', ')', clean)
    return clean

def normalize_depth(depth_str) -> Optional[float]:
    """Convertir '1m', '1,5m', '2m' → 1.0, 1.5, 2.0"""
    if pd.isna(depth_str):
        return None
    s = str(depth_str).strip().lower().replace('m', '').replace(',', '.')
    try:
        return round(float(s), 1)
    except:
        return None

def parse_decimal(value) -> Optional[float]:
    """Parser une valeur décimale (gère virgule française)"""
    if pd.isna(value):
        return None
    if isinstance(value, (int, float)):
        return float(value)
    s = str(value).strip().replace(',', '.').replace(' ', '')
    try:
        return float(s)
    except:
        return None

class AmessefeImporterV2:
    def __init__(self, dsn: str, data_dir: Path, dry_run: bool = False):
        self.dsn = dsn
        self.data_dir = data_dir
        self.dry_run = dry_run
        self.conn = None
        self.sondage_map: Dict[str, str] = {}  # {localite: sondage_id}
        self.echantillon_map: Dict[Tuple[str, float], str] = {}  # {(localite, depth): echantillon_id}
        
        # Fichiers
        self.files = {
            'vbs': data_dir / 'bleu.xlsx',
            'limites': data_dir / 'limite.xlsx',
            'granulo': data_dir / 'Granulométrie.xlsx',
            'classif': data_dir / 'classification.xlsx',
            'gonflement': data_dir / 'potentielle_de_gonflement.xlsx',
        }
        
    def connect(self):
        self.conn = psycopg.connect(self.dsn)
        self.conn.autocommit = False
        
    def close(self):
        if self.conn:
            self.conn.close()
    
    def commit(self):
        if not self.dry_run:
            self.conn.commit()
            logger.info("✓ Transaction committée")
        else:
            self.conn.rollback()
            logger.info("⚠ Mode dry-run: transaction annulée")
    
    def rollback(self):
        if self.conn:
            self.conn.rollback()
    
    # =========================================================================
    # ÉTAPE 1: Collecter toutes les localités uniques
    # =========================================================================
    def collect_all_localites(self) -> Set[str]:
        """Collecter toutes les localités uniques depuis tous les fichiers Excel"""
        logger.info("\n📋 Collecte des localités uniques...")
        all_localites = set()
        
        for name, filepath in self.files.items():
            if not filepath.exists():
                logger.warning(f"  ⚠️ Fichier manquant: {filepath}")
                continue
            
            xl = pd.ExcelFile(filepath)
            for sheet in xl.sheet_names:
                df = pd.read_excel(xl, sheet)
                for col in df.columns:
                    if 'localit' in str(col).lower():
                        localites = df[col].dropna().apply(normalize_localite)
                        all_localites.update(loc for loc in localites if loc)
                        break
        
        logger.info(f"  ✓ {len(all_localites)} localités uniques trouvées")
        return all_localites
    
    # =========================================================================
    # ÉTAPE 2: Créer les sondages
    # =========================================================================
    def create_sondages(self, localites: Set[str]) -> Tuple[int, int]:
        """Créer les sondages AMESSEFE (1 par localité) - IDEMPOTENT"""
        logger.info(f"\n📍 Création des sondages pour {len(localites)} localités...")
        
        created = 0
        existing = 0
        
        with self.conn.cursor() as cur:
            for localite in sorted(localites):
                if not localite:
                    continue
                
                # Vérifier si le sondage existe déjà
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.sondages
                    WHERE meta->>'localite' = %s AND source = %s
                """, (localite, SOURCE))
                row = cur.fetchone()
                
                if row:
                    sondage_id = str(row[0])
                    existing += 1
                else:
                    meta = json.dumps({
                        'code': localite,
                        'localite': localite,
                        'auteur': SOURCE
                    })
                    
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.sondages (
                            code, localite_base, localite_key, localite,
                            geom, date, source, operator, meta, location_mode,
                            created_at, updated_at
                        )
                        VALUES (
                            %s, %s, %s, %s,
                            NULL, NULL, %s, %s, %s::jsonb, 'unknown',
                            now(), now()
                        )
                        RETURNING id;
                    """, (localite, localite, localite, localite, SOURCE, OPERATOR, meta))
                    sondage_id = str(cur.fetchone()[0])
                    created += 1
                
                self.sondage_map[localite] = sondage_id
        
        logger.info(f"  ✓ {created} sondages créés, {existing} existants")
        return created, existing
    
    # =========================================================================
    # ÉTAPE 3: Créer les échantillons
    # =========================================================================
    def create_echantillons(self) -> Tuple[int, int]:
        """Créer les échantillons (1m, 1.5m, 2m) pour chaque sondage"""
        logger.info(f"\n🧪 Création des échantillons (3 profondeurs par sondage)...")
        
        created = 0
        existing = 0
        
        with self.conn.cursor() as cur:
            for localite, sondage_id in self.sondage_map.items():
                for depth in DEPTHS:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.echantillons (sondage_id, depth_m, date, laboratory, created_at)
                        VALUES (%s, %s, NULL, 'AMESSEFE', now())
                        ON CONFLICT (sondage_id, depth_m, date) DO NOTHING
                        RETURNING id;
                    """, (sondage_id, depth))
                    
                    row = cur.fetchone()
                    if row:
                        echantillon_id = str(row[0])
                        created += 1
                    else:
                        cur.execute(f"""
                            SELECT id FROM {SCHEMA}.echantillons
                            WHERE sondage_id = %s AND depth_m = %s
                        """, (sondage_id, depth))
                        echantillon_id = str(cur.fetchone()[0])
                        existing += 1
                    
                    self.echantillon_map[(localite, depth)] = echantillon_id
        
        logger.info(f"  ✓ {created} échantillons créés, {existing} existants")
        return created, existing
    
    # =========================================================================
    # IMPORT VBS (bleu.xlsx)
    # =========================================================================
    def import_vbs(self) -> Tuple[int, int]:
        """Importer bleu.xlsx → essais_vbs"""
        filepath = self.files['vbs']
        logger.info(f"\n💙 Import VBS: {filepath.name}")
        
        if not filepath.exists():
            logger.warning(f"  ⚠️ Fichier non trouvé")
            return 0, 0
        
        total_imported = 0
        total_errors = 0
        
        df = pd.read_excel(filepath)
        
        # Identifier la colonne localité
        localite_col = None
        for col in df.columns:
            if 'localit' in str(col).lower():
                localite_col = col
                break
        
        if not localite_col:
            logger.error("  ✗ Colonne localité introuvable")
            return 0, 1
        
        # Colonnes VBS: 1, 1.5, 2 (numériques)
        vbs_cols = {1: 1.0, 1.5: 1.5, 2: 2.0}
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                localite = normalize_localite(row.get(localite_col))
                if not localite:
                    continue
                
                for col, depth in vbs_cols.items():
                    if col not in df.columns:
                        continue
                    
                    vbs_value = parse_decimal(row.get(col))
                    if vbs_value is None:
                        continue
                    
                    key = (localite, depth)
                    echantillon_id = self.echantillon_map.get(key)
                    
                    if not echantillon_id:
                        logger.warning(f"  ⚠️ Échantillon {localite}@{depth}m introuvable")
                        total_errors += 1
                        continue
                    
                    try:
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.essais_vbs (echantillon_id, vbs, created_at)
                            VALUES (%s, %s, now())
                            ON CONFLICT (echantillon_id)
                            DO UPDATE SET vbs = EXCLUDED.vbs;
                        """, (echantillon_id, vbs_value))
                        total_imported += 1
                    except Exception as e:
                        logger.error(f"  ✗ Erreur {localite}@{depth}m: {e}")
                        total_errors += 1
        
        logger.info(f"  ✓ {total_imported} VBS importés, {total_errors} erreurs")
        return total_imported, total_errors
    
    # =========================================================================
    # IMPORT LIMITES D'ATTERBERG (limite.xlsx) - NOUVEAU
    # =========================================================================
    def import_limites(self) -> Tuple[int, int]:
        """Importer limite.xlsx → essais_geotechniques (wl, wp, ip)"""
        filepath = self.files['limites']
        logger.info(f"\n📐 Import Limites d'Atterberg: {filepath.name}")
        
        if not filepath.exists():
            logger.warning(f"  ⚠️ Fichier non trouvé")
            return 0, 0
        
        total_imported = 0
        total_errors = 0
        
        df = pd.read_excel(filepath)
        
        # Colonnes attendues
        col_localite = 'Localité'
        col_profondeur = 'Profondeur'
        col_wl = 'Limite de liquidité (WL)'
        col_wp = 'Limite de plasticité (WP)'
        col_ip = 'Indice de plasticité (IP)'
        col_analyse = 'Analyse WI'
        col_type_sol = 'Type de sol'
        
        if col_localite not in df.columns:
            logger.error(f"  ✗ Colonne '{col_localite}' introuvable")
            return 0, 1
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                localite = normalize_localite(row.get(col_localite))
                if not localite:
                    continue
                
                depth = normalize_depth(row.get(col_profondeur))
                if depth is None:
                    continue
                
                wl = parse_decimal(row.get(col_wl))
                wp = parse_decimal(row.get(col_wp))
                ip = parse_decimal(row.get(col_ip))
                analyse_wi = row.get(col_analyse) if col_analyse in df.columns else None
                type_sol = row.get(col_type_sol) if col_type_sol in df.columns else None
                
                if wl is None and wp is None and ip is None:
                    continue
                
                key = (localite, depth)
                echantillon_id = self.echantillon_map.get(key)
                
                if not echantillon_id:
                    logger.warning(f"  ⚠️ Échantillon {localite}@{depth}m introuvable")
                    total_errors += 1
                    continue
                
                try:
                    # Insérer dans essais_geotechniques (table existante avec wl, wp, ip)
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.essais_geotechniques (echantillon_id, wl, wp, ip, type_sol, created_at)
                        VALUES (%s, %s, %s, %s, %s, now())
                        ON CONFLICT (echantillon_id)
                        DO UPDATE SET 
                            wl = COALESCE(EXCLUDED.wl, essais_geotechniques.wl),
                            wp = COALESCE(EXCLUDED.wp, essais_geotechniques.wp),
                            ip = COALESCE(EXCLUDED.ip, essais_geotechniques.ip),
                            type_sol = COALESCE(EXCLUDED.type_sol, essais_geotechniques.type_sol);
                    """, (echantillon_id, wl, wp, ip, type_sol))
                    total_imported += 1
                except Exception as e:
                    logger.error(f"  ✗ Erreur {localite}@{depth}m: {e}")
                    total_errors += 1
        
        logger.info(f"  ✓ {total_imported} limites importées, {total_errors} erreurs")
        return total_imported, total_errors
    
    # =========================================================================
    # IMPORT GRANULOMÉTRIE (Granulométrie.xlsx) - CORRIGÉ
    # =========================================================================
    def import_granulometrie(self) -> Tuple[int, int]:
        """Importer Granulométrie.xlsx → granulo_points (% passant à 0.08mm)"""
        filepath = self.files['granulo']
        logger.info(f"\n📊 Import Granulométrie: {filepath.name}")
        
        if not filepath.exists():
            logger.warning(f"  ⚠️ Fichier non trouvé")
            return 0, 0
        
        total_imported = 0
        total_errors = 0
        
        xl = pd.ExcelFile(filepath)
        
        for sheet_name in xl.sheet_names:
            df = pd.read_excel(xl, sheet_name)
            
            # Normaliser les noms de colonnes
            df.columns = [str(c).strip() for c in df.columns]
            
            # Identifier la colonne localité
            localite_col = None
            for col in df.columns:
                if 'localit' in col.lower():
                    localite_col = col
                    break
            
            if not localite_col:
                continue
            
            # Mapping colonnes profondeur
            depth_map = {'1': 1.0, '1.5': 1.5, '2': 2.0, 1: 1.0, 1.5: 1.5, 2: 2.0}
            
            with self.conn.cursor() as cur:
                for idx, row in df.iterrows():
                    localite = normalize_localite(row.get(localite_col))
                    if not localite:
                        continue
                    
                    for col_name, depth in depth_map.items():
                        if col_name not in df.columns:
                            continue
                        
                        passant_value = parse_decimal(row.get(col_name))
                        if passant_value is None:
                            continue
                        
                        key = (localite, depth)
                        echantillon_id = self.echantillon_map.get(key)
                        
                        if not echantillon_id:
                            logger.warning(f"  ⚠️ Échantillon {localite}@{depth}m introuvable")
                            total_errors += 1
                            continue
                        
                        try:
                            # CORRIGÉ: pas de updated_at !
                            cur.execute(f"""
                                INSERT INTO {SCHEMA}.granulo_points (echantillon_id, sieve_mm, passing_pct, method, created_at)
                                VALUES (%s, 0.08, %s, NULL, now())
                                ON CONFLICT (echantillon_id, method, sieve_mm)
                                DO UPDATE SET passing_pct = EXCLUDED.passing_pct;
                            """, (echantillon_id, passant_value))
                            total_imported += 1
                        except Exception as e:
                            logger.error(f"  ✗ Erreur {localite}@{depth}m: {e}")
                            total_errors += 1
        
        logger.info(f"  ✓ {total_imported} granulométries importées, {total_errors} erreurs")
        return total_imported, total_errors
    
    # =========================================================================
    # IMPORT CLASSIFICATION (classification.xlsx)
    # =========================================================================
    def import_classification(self) -> Tuple[int, int]:
        """Importer classification.xlsx → essais_classif"""
        filepath = self.files['classif']
        logger.info(f"\n🏷️ Import Classifications: {filepath.name}")
        
        if not filepath.exists():
            logger.warning(f"  ⚠️ Fichier non trouvé")
            return 0, 0
        
        total_imported = 0
        total_errors = 0
        
        df = pd.read_excel(filepath)
        
        if 'Localité' not in df.columns or 'Profondeur' not in df.columns:
            logger.error("  ✗ Colonnes Localité/Profondeur introuvables")
            return 0, 1
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                localite = normalize_localite(row.get('Localité'))
                if not localite:
                    continue
                
                depth = normalize_depth(row.get('Profondeur'))
                if depth is None:
                    continue
                
                key = (localite, depth)
                echantillon_id = self.echantillon_map.get(key)
                
                if not echantillon_id:
                    logger.warning(f"  ⚠️ Échantillon {localite}@{depth}m introuvable")
                    total_errors += 1
                    continue
                
                # Extraire les classifications
                class_chassagneux = row.get('Classification CHASSAGNEUX D. et al. 1996')
                class_daksha = row.get('Classification Dakshanamurthy et Raman 1973')
                class_seed = row.get('Classification SEED H. et al 1962')
                class_vijay = row.get('Classification VIJAYVERGIYA et GHAZZALY 1973')
                type_sol = row.get('Type de sol')
                
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.essais_classif (
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
                            type_sol = COALESCE(EXCLUDED.type_sol, essais_classif.type_sol);
                    """, (echantillon_id, depth, class_chassagneux, class_daksha, class_seed, class_vijay, type_sol))
                    total_imported += 1
                except Exception as e:
                    logger.error(f"  ✗ Erreur {localite}@{depth}m: {e}")
                    total_errors += 1
        
        logger.info(f"  ✓ {total_imported} classifications importées, {total_errors} erreurs")
        return total_imported, total_errors
    
    # =========================================================================
    # IMPORT POTENTIEL DE GONFLEMENT (potentielle_de_gonflement.xlsx)
    # =========================================================================
    def import_gonflement(self) -> Tuple[int, int]:
        """Importer potentielle_de_gonflement.xlsx → essais_potentiel_gonflement"""
        filepath = self.files['gonflement']
        logger.info(f"\n📈 Import Potentiel de gonflement: {filepath.name}")
        
        if not filepath.exists():
            logger.warning(f"  ⚠️ Fichier non trouvé")
            return 0, 0
        
        total_imported = 0
        total_errors = 0
        
        df = pd.read_excel(filepath)
        
        if 'Localité' not in df.columns:
            logger.error("  ✗ Colonne Localité introuvable")
            return 0, 1
        
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
                localite = normalize_localite(row.get('Localité'))
                if not localite:
                    continue
                
                type_sol = row.get('Type de sol')
                
                for col, depth in cg_cols.items():
                    if col not in df.columns:
                        continue
                    
                    cg_value = parse_decimal(row.get(col))
                    if cg_value is None:
                        continue
                    
                    # Récupérer le qualificatif
                    qual_col = [k for k, v in qual_cols.items() if v == depth]
                    cg_qual = row.get(qual_col[0]) if qual_col and qual_col[0] in df.columns else None
                    
                    key = (localite, depth)
                    echantillon_id = self.echantillon_map.get(key)
                    
                    if not echantillon_id:
                        logger.warning(f"  ⚠️ Échantillon {localite}@{depth}m introuvable")
                        total_errors += 1
                        continue
                    
                    try:
                        cur.execute(f"""
                            INSERT INTO {SCHEMA}.essais_potentiel_gonflement (echantillon_id, cg, cg_qual, type_sol, created_at)
                            VALUES (%s, %s, %s, %s, now())
                            ON CONFLICT (echantillon_id)
                            DO UPDATE SET
                                cg = EXCLUDED.cg,
                                cg_qual = EXCLUDED.cg_qual,
                                type_sol = COALESCE(EXCLUDED.type_sol, essais_potentiel_gonflement.type_sol);
                        """, (echantillon_id, cg_value, cg_qual, type_sol))
                        total_imported += 1
                    except Exception as e:
                        logger.error(f"  ✗ Erreur {localite}@{depth}m: {e}")
                        total_errors += 1
        
        logger.info(f"  ✓ {total_imported} potentiels de gonflement importés, {total_errors} erreurs")
        return total_imported, total_errors
    
    # =========================================================================
    # PIPELINE PRINCIPAL
    # =========================================================================
    def run(self):
        """Exécuter le pipeline complet d'import"""
        logger.info("=" * 80)
        logger.info("IMPORT DONNÉES AMESSEFE v2 - Pipeline complet")
        logger.info("=" * 80)
        logger.info(f"Source: {SOURCE}")
        logger.info(f"Operator: {OPERATOR}")
        logger.info(f"Profondeurs: {DEPTHS}")
        logger.info(f"Data dir: {self.data_dir}")
        logger.info("=" * 80)
        
        try:
            self.connect()
            
            # 1. Collecter les localités
            all_localites = self.collect_all_localites()
            
            # 2. Créer sondages et échantillons
            self.create_sondages(all_localites)
            self.create_echantillons()
            
            # 3. Importer les essais
            logger.info("\n" + "=" * 80)
            logger.info("IMPORT DES ESSAIS")
            logger.info("=" * 80)
            
            results = {}
            results['vbs'] = self.import_vbs()
            results['limites'] = self.import_limites()  # NOUVEAU
            results['granulo'] = self.import_granulometrie()
            results['classif'] = self.import_classification()
            results['gonflement'] = self.import_gonflement()
            
            # 4. Commit
            self.commit()
            
            # 5. Résumé
            logger.info("\n" + "=" * 80)
            logger.info("RÉSUMÉ DE L'IMPORT")
            logger.info("=" * 80)
            for name, (imported, errors) in results.items():
                status = "✅" if errors == 0 else "⚠️"
                logger.info(f"  {status} {name}: {imported} importés, {errors} erreurs")
            
            total_errors = sum(e for _, e in results.values())
            if total_errors == 0:
                logger.info("\n✅ IMPORT TERMINÉ AVEC SUCCÈS")
            else:
                logger.warning(f"\n⚠️ IMPORT TERMINÉ AVEC {total_errors} ERREURS")
            
            return 0 if total_errors == 0 else 1
            
        except Exception as e:
            logger.error(f"\n✗ ERREUR FATALE: {e}")
            import traceback
            traceback.print_exc()
            self.rollback()
            return 1
        finally:
            self.close()

def main():
    parser = argparse.ArgumentParser(description='Import données AMESSEFE v2')
    parser.add_argument('--dsn', default='postgresql://atlas:atlas@localhost:5432/atlas_clean',
                        help='PostgreSQL DSN')
    parser.add_argument('--data-dir', default='data/xlsx', help='Répertoire des fichiers Excel')
    parser.add_argument('--dry-run', action='store_true', help='Mode test (pas de commit)')
    
    args = parser.parse_args()
    data_dir = Path(args.data_dir)
    
    if not data_dir.exists():
        logger.error(f"✗ Répertoire introuvable: {data_dir}")
        return 1
    
    importer = AmessefeImporterV2(args.dsn, data_dir, args.dry_run)
    return importer.run()

if __name__ == '__main__':
    exit(main())
