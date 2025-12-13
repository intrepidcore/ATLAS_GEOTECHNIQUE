#!/usr/bin/env python3
"""
Script d'import des données AMESSEFE - VERSION 3
=================================================
Utilise le module centralisé utils/amessefe_excel.py pour la lecture Excel.

Fichiers sources (dans data/xlsx/amessefe_raw/):
- bleu.xlsx (VBS)
- limite.xlsx (Limites d'Atterberg WL/WP/IP)
- Granulométrie.xlsx
- classification.xlsx
- potentielle_de_gonflement.xlsx

Règle métier: 1 localité = 1 sondage
Profondeurs: 1.0m, 1.5m, 2.0m
Operator: Serge TABE DJATO

Usage:
    python scripts/04_import_amessefe_v3.py [--dry-run] [--dsn DSN]
"""

import sys
import argparse
import logging
import json
from pathlib import Path
from typing import Dict, Set, Tuple, Optional

# Ajouter le dossier scripts au path pour les imports
sys.path.insert(0, str(Path(__file__).resolve().parent))

from utils.normalize import normalize_localite
from utils.amessefe_excel import (
    load_vbs, load_limites, load_granulo, load_classif, load_gonflement,
    get_all_localites, STANDARD_DEPTHS
)

import subprocess

try:
    import psycopg
    HAS_PSYCOPG = True
except ImportError:
    HAS_PSYCOPG = False

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# =============================================================================
# CONSTANTES
# =============================================================================

SOURCE = "AMESSEFE Komi Yoan Freddy"
OPERATOR = "Serge TABE DJATO"
SCHEMA = "atlas"


# =============================================================================
# CLASSE PRINCIPALE
# =============================================================================

class AmessefeImporterV3:
    """Importeur AMESSEFE utilisant le module centralisé de lecture Excel."""
    
    def __init__(self, dsn: str, dry_run: bool = False):
        self.dsn = dsn
        self.dry_run = dry_run
        self.conn = None
        
        # Mappings construits pendant l'import
        self.sondage_map: Dict[str, str] = {}  # localite_norm -> sondage_id
        self.echantillon_map: Dict[Tuple[str, float], str] = {}  # (localite_norm, depth) -> echantillon_id
        
        # Statistiques
        self.stats = {
            "sondages_created": 0,
            "sondages_existing": 0,
            "echantillons_created": 0,
            "echantillons_existing": 0,
            "vbs_imported": 0,
            "limites_imported": 0,
            "granulo_imported": 0,
            "classif_imported": 0,
            "gonflement_imported": 0,
            "errors": 0,
        }
    
    def connect(self):
        """Ouvre la connexion à la base de données."""
        if not HAS_PSYCOPG:
            raise RuntimeError("psycopg non installé. Installe avec: pip install psycopg[binary]")
        self.conn = psycopg.connect(self.dsn)
        self.conn.autocommit = False
        logger.info("✓ Connexion établie")
    
    def close(self):
        """Ferme la connexion."""
        if self.conn:
            self.conn.close()
    
    def commit(self):
        """Commit ou rollback selon le mode."""
        if not self.dry_run:
            self.conn.commit()
            logger.info("✓ Transaction committée")
        else:
            self.conn.rollback()
            logger.info("⚠ Mode dry-run: transaction annulée")
    
    def rollback(self):
        """Rollback la transaction."""
        if self.conn:
            self.conn.rollback()
    
    # =========================================================================
    # ÉTAPE 1: Créer les sondages
    # =========================================================================
    def create_sondages(self) -> int:
        """Crée les sondages pour toutes les localités Excel."""
        logger.info("\n📍 Création des sondages...")
        
        # Récupérer toutes les localités depuis le module centralisé
        all_localites = get_all_localites()
        logger.info(f"   {len(all_localites)} localités uniques dans Excel")
        
        created = 0
        existing = 0
        
        with self.conn.cursor() as cur:
            for localite_norm in sorted(all_localites):
                if not localite_norm:
                    continue
                
                # Vérifier si le sondage existe déjà
                cur.execute(f"""
                    SELECT id FROM {SCHEMA}.sondages
                    WHERE source = %s 
                      AND (localite_key = %s OR localite_base = %s OR localite = %s)
                      AND deleted_at IS NULL
                """, (SOURCE, localite_norm, localite_norm, localite_norm))
                row = cur.fetchone()
                
                if row:
                    sondage_id = str(row[0])
                    existing += 1
                else:
                    # Créer le sondage
                    # Utiliser le nom normalisé comme code et localite_*
                    meta = json.dumps({
                        'localite': localite_norm,
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
                    """, (localite_norm, localite_norm, localite_norm, localite_norm, 
                          SOURCE, OPERATOR, meta))
                    sondage_id = str(cur.fetchone()[0])
                    created += 1
                
                self.sondage_map[localite_norm] = sondage_id
        
        self.stats["sondages_created"] = created
        self.stats["sondages_existing"] = existing
        logger.info(f"   ✓ {created} créés, {existing} existants")
        return created
    
    # =========================================================================
    # ÉTAPE 2: Créer les échantillons
    # =========================================================================
    def create_echantillons(self) -> int:
        """Crée les échantillons (1m, 1.5m, 2m) pour chaque sondage."""
        logger.info("\n🧪 Création des échantillons...")
        
        created = 0
        existing = 0
        
        with self.conn.cursor() as cur:
            for localite_norm, sondage_id in self.sondage_map.items():
                for depth in STANDARD_DEPTHS:
                    # Essayer d'insérer, ignorer si existe
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
                        # Récupérer l'existant
                        cur.execute(f"""
                            SELECT id FROM {SCHEMA}.echantillons
                            WHERE sondage_id = %s AND depth_m = %s
                        """, (sondage_id, depth))
                        result = cur.fetchone()
                        if result:
                            echantillon_id = str(result[0])
                            existing += 1
                        else:
                            logger.warning(f"   ⚠ Échantillon introuvable: {localite_norm}@{depth}m")
                            continue
                    
                    self.echantillon_map[(localite_norm, depth)] = echantillon_id
        
        self.stats["echantillons_created"] = created
        self.stats["echantillons_existing"] = existing
        logger.info(f"   ✓ {created} créés, {existing} existants")
        return created
    
    # =========================================================================
    # IMPORT VBS
    # =========================================================================
    def import_vbs(self) -> int:
        """Importe les VBS depuis le module centralisé."""
        logger.info("\n💙 Import VBS...")
        
        records = load_vbs()
        logger.info(f"   {len(records)} records Excel")
        
        imported = 0
        errors = 0
        
        with self.conn.cursor() as cur:
            for rec in records:
                ech_id = self.echantillon_map.get((rec.localite_norm, rec.depth_m))
                if not ech_id:
                    logger.debug(f"   ⚠ Échantillon non trouvé: {rec.localite_norm}@{rec.depth_m}m")
                    errors += 1
                    continue
                
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.essais_vbs (echantillon_id, vbs, source, created_at)
                        VALUES (%s, %s, %s, now())
                        ON CONFLICT (echantillon_id) DO UPDATE SET vbs = EXCLUDED.vbs
                    """, (ech_id, rec.vbs, SOURCE))
                    imported += 1
                except Exception as e:
                    logger.error(f"   ✗ Erreur VBS {rec.localite_norm}@{rec.depth_m}m: {e}")
                    errors += 1
        
        self.stats["vbs_imported"] = imported
        self.stats["errors"] += errors
        logger.info(f"   ✓ {imported} importés, {errors} erreurs")
        return imported
    
    # =========================================================================
    # IMPORT LIMITES D'ATTERBERG
    # =========================================================================
    def import_limites(self) -> int:
        """Importe les limites d'Atterberg depuis le module centralisé."""
        logger.info("\n📐 Import Limites d'Atterberg...")
        
        records = load_limites()
        logger.info(f"   {len(records)} records Excel")
        
        imported = 0
        errors = 0
        
        with self.conn.cursor() as cur:
            for rec in records:
                ech_id = self.echantillon_map.get((rec.localite_norm, rec.depth_m))
                if not ech_id:
                    logger.debug(f"   ⚠ Échantillon non trouvé: {rec.localite_norm}@{rec.depth_m}m")
                    errors += 1
                    continue
                
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.essais_geotechniques (
                            echantillon_id, wl, wp, ip, source, created_at, updated_at
                        )
                        VALUES (%s, %s, %s, %s, %s, now(), now())
                        ON CONFLICT (echantillon_id) DO UPDATE SET 
                            wl = COALESCE(EXCLUDED.wl, {SCHEMA}.essais_geotechniques.wl),
                            wp = COALESCE(EXCLUDED.wp, {SCHEMA}.essais_geotechniques.wp),
                            ip = COALESCE(EXCLUDED.ip, {SCHEMA}.essais_geotechniques.ip),
                            updated_at = now()
                    """, (ech_id, rec.wl, rec.wp, rec.ip, SOURCE))
                    imported += 1
                except Exception as e:
                    logger.error(f"   ✗ Erreur limites {rec.localite_norm}@{rec.depth_m}m: {e}")
                    errors += 1
        
        self.stats["limites_imported"] = imported
        self.stats["errors"] += errors
        logger.info(f"   ✓ {imported} importés, {errors} erreurs")
        return imported
    
    # =========================================================================
    # IMPORT GRANULOMÉTRIE
    # =========================================================================
    def import_granulo(self) -> int:
        """Importe la granulométrie depuis le module centralisé."""
        logger.info("\n📊 Import Granulométrie...")
        
        records = load_granulo()
        logger.info(f"   {len(records)} records Excel")
        
        imported = 0
        errors = 0
        
        with self.conn.cursor() as cur:
            for rec in records:
                ech_id = self.echantillon_map.get((rec.localite_norm, rec.depth_m))
                if not ech_id:
                    logger.debug(f"   ⚠ Échantillon non trouvé: {rec.localite_norm}@{rec.depth_m}m")
                    errors += 1
                    continue
                
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.granulo_points (
                            echantillon_id, sieve_mm, passing_pct, source, created_at
                        )
                        VALUES (%s, %s, %s, %s, now())
                        ON CONFLICT (echantillon_id, sieve_mm) DO UPDATE SET 
                            passing_pct = EXCLUDED.passing_pct
                    """, (ech_id, rec.sieve_mm, rec.passing_pct, SOURCE))
                    imported += 1
                except Exception as e:
                    logger.error(f"   ✗ Erreur granulo {rec.localite_norm}@{rec.depth_m}m: {e}")
                    errors += 1
        
        self.stats["granulo_imported"] = imported
        self.stats["errors"] += errors
        logger.info(f"   ✓ {imported} importés, {errors} erreurs")
        return imported
    
    # =========================================================================
    # IMPORT CLASSIFICATION
    # =========================================================================
    def import_classif(self) -> int:
        """Importe les classifications depuis le module centralisé."""
        logger.info("\n🏷️ Import Classifications...")
        
        records = load_classif()
        logger.info(f"   {len(records)} records Excel")
        
        imported = 0
        errors = 0
        
        with self.conn.cursor() as cur:
            for rec in records:
                ech_id = self.echantillon_map.get((rec.localite_norm, rec.depth_m))
                if not ech_id:
                    logger.debug(f"   ⚠ Échantillon non trouvé: {rec.localite_norm}@{rec.depth_m}m")
                    errors += 1
                    continue
                
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.essais_classif (
                            echantillon_id, class_chassagneux, class_daksha, 
                            class_seed, class_vijay, type_sol, source, created_at
                        )
                        VALUES (%s, %s, %s, %s, %s, %s, %s, now())
                        ON CONFLICT (echantillon_id) DO UPDATE SET 
                            class_chassagneux = COALESCE(EXCLUDED.class_chassagneux, {SCHEMA}.essais_classif.class_chassagneux),
                            class_daksha = COALESCE(EXCLUDED.class_daksha, {SCHEMA}.essais_classif.class_daksha),
                            class_seed = COALESCE(EXCLUDED.class_seed, {SCHEMA}.essais_classif.class_seed),
                            class_vijay = COALESCE(EXCLUDED.class_vijay, {SCHEMA}.essais_classif.class_vijay),
                            type_sol = COALESCE(EXCLUDED.type_sol, {SCHEMA}.essais_classif.type_sol)
                    """, (ech_id, rec.class_chassagneux, rec.class_daksha, 
                          rec.class_seed, rec.class_vijay, rec.type_sol, SOURCE))
                    imported += 1
                except Exception as e:
                    logger.error(f"   ✗ Erreur classif {rec.localite_norm}@{rec.depth_m}m: {e}")
                    errors += 1
        
        self.stats["classif_imported"] = imported
        self.stats["errors"] += errors
        logger.info(f"   ✓ {imported} importés, {errors} erreurs")
        return imported
    
    # =========================================================================
    # IMPORT POTENTIEL DE GONFLEMENT
    # =========================================================================
    def import_gonflement(self) -> int:
        """Importe le potentiel de gonflement depuis le module centralisé."""
        logger.info("\n🔄 Import Potentiel de gonflement...")
        
        records = load_gonflement()
        logger.info(f"   {len(records)} records Excel")
        
        imported = 0
        errors = 0
        
        with self.conn.cursor() as cur:
            for rec in records:
                ech_id = self.echantillon_map.get((rec.localite_norm, rec.depth_m))
                if not ech_id:
                    logger.debug(f"   ⚠ Échantillon non trouvé: {rec.localite_norm}@{rec.depth_m}m")
                    errors += 1
                    continue
                
                try:
                    cur.execute(f"""
                        INSERT INTO {SCHEMA}.essais_potentiel_gonflement (
                            echantillon_id, cg, cg_qual, source, created_at
                        )
                        VALUES (%s, %s, %s, %s, now())
                        ON CONFLICT (echantillon_id) DO UPDATE SET 
                            cg = EXCLUDED.cg,
                            cg_qual = EXCLUDED.cg_qual
                    """, (ech_id, rec.cg, rec.cg_qual, SOURCE))
                    imported += 1
                except Exception as e:
                    logger.error(f"   ✗ Erreur gonflement {rec.localite_norm}@{rec.depth_m}m: {e}")
                    errors += 1
        
        self.stats["gonflement_imported"] = imported
        self.stats["errors"] += errors
        logger.info(f"   ✓ {imported} importés, {errors} erreurs")
        return imported
    
    # =========================================================================
    # EXÉCUTION COMPLÈTE
    # =========================================================================
    def run(self) -> dict:
        """Exécute l'import complet."""
        logger.info("=" * 60)
        logger.info("🚀 IMPORT AMESSEFE v3")
        logger.info("=" * 60)
        
        if self.dry_run:
            logger.info("⚠ MODE DRY-RUN: aucune modification ne sera persistée")
        
        try:
            self.connect()
            
            # Créer la structure
            self.create_sondages()
            self.create_echantillons()
            
            # Importer les essais
            self.import_vbs()
            self.import_limites()
            self.import_granulo()
            self.import_classif()
            self.import_gonflement()
            
            # Commit
            self.commit()
            
            # Résumé
            logger.info("\n" + "=" * 60)
            logger.info("📊 RÉSUMÉ")
            logger.info("=" * 60)
            logger.info(f"   Sondages    : {self.stats['sondages_created']} créés, {self.stats['sondages_existing']} existants")
            logger.info(f"   Échantillons: {self.stats['echantillons_created']} créés, {self.stats['echantillons_existing']} existants")
            logger.info(f"   VBS         : {self.stats['vbs_imported']} importés")
            logger.info(f"   Limites     : {self.stats['limites_imported']} importés")
            logger.info(f"   Granulo     : {self.stats['granulo_imported']} importés")
            logger.info(f"   Classif     : {self.stats['classif_imported']} importés")
            logger.info(f"   Gonflement  : {self.stats['gonflement_imported']} importés")
            logger.info(f"   Erreurs     : {self.stats['errors']}")
            
            if self.stats['errors'] == 0:
                logger.info("\n✅ IMPORT TERMINÉ AVEC SUCCÈS")
            else:
                logger.warning(f"\n⚠ IMPORT TERMINÉ AVEC {self.stats['errors']} ERREURS")
            
            return self.stats
            
        except Exception as e:
            logger.error(f"\n❌ ERREUR FATALE: {e}")
            self.rollback()
            raise
        finally:
            self.close()


# =============================================================================
# MAIN
# =============================================================================

def main():
    parser = argparse.ArgumentParser(description="Import AMESSEFE v3")
    parser.add_argument("--dry-run", action="store_true", help="Mode test sans commit")
    parser.add_argument("--dsn", default="postgresql://atlas:atlas@localhost:5432/atlas_clean",
                        help="DSN PostgreSQL")
    args = parser.parse_args()
    
    importer = AmessefeImporterV3(dsn=args.dsn, dry_run=args.dry_run)
    stats = importer.run()
    
    # Exit code basé sur les erreurs
    return 1 if stats["errors"] > 0 else 0


if __name__ == "__main__":
    sys.exit(main())
