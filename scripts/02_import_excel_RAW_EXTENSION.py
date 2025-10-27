#!/usr/bin/env python3
"""
============================================================================
Extension RAW pour 02_import_excel.py (v1.5.3)
============================================================================
Ce fichier contient les méthodes d'import pour les tables RAW :
- raw_lab_agt
- raw_lab_ags  
- raw_lab_atterberg

À intégrer dans la classe DatabaseImporter de 02_import_excel.py
============================================================================
"""

import logging
from typing import Optional
import pandas as pd
import psycopg
from psycopg import sql

logger = logging.getLogger(__name__)

# ============================================================================
# MÉTHODES D'IMPORT RAW (à ajouter dans DatabaseImporter)
# ============================================================================

def import_raw_agt(self, df: pd.DataFrame) -> 'ImportStats':
    """Import des données RAW AGT (Analyse Granulométrique par Tamisage)"""
    from dataclasses import dataclass, field
    from typing import List
    
    @dataclass
    class ImportStats:
        table_name: str
        rows_read: int = 0
        rows_inserted: int = 0
        rows_updated: int = 0
        rows_skipped: int = 0
        errors: List[str] = field(default_factory=list)
        warnings: List[str] = field(default_factory=list)
    
    stats = ImportStats(table_name='raw_lab_agt')
    stats.rows_read = len(df)
    
    if self.dry_run:
        logger.info(f"[DRY-RUN] RAW AGT: {len(df)} lignes à importer")
        stats.rows_inserted = len(df)
        return stats
    
    # Vérifier colonnes requises
    required_cols = ['code_site', 'depth_m', 'sieve_mm']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        stats.errors.append(f"Colonnes manquantes: {missing_cols}")
        logger.error(f"❌ RAW AGT: colonnes manquantes {missing_cols}")
        return stats
    
    upsert_sql = """
    INSERT INTO raw_lab_agt (
        code_site, depth_m, sieve_mm, mass_refus_cum_g, 
        refus_cum_pct, passants_pct, created_at
    ) VALUES (%s, %s, %s, %s, %s, %s, now())
    ON CONFLICT (code_site, depth_m, sieve_mm)
    DO UPDATE SET
        mass_refus_cum_g = EXCLUDED.mass_refus_cum_g,
        refus_cum_pct = EXCLUDED.refus_cum_pct,
        passants_pct = EXCLUDED.passants_pct,
        updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
    """
    
    with self.conn.cursor() as cur:
        for idx, row in df.iterrows():
            try:
                code_site = str(row['code_site']).strip() if pd.notna(row['code_site']) else None
                depth_m = float(row['depth_m']) if pd.notna(row['depth_m']) else None
                sieve_mm = float(row['sieve_mm']) if pd.notna(row['sieve_mm']) else None
                
                if not code_site or depth_m is None or sieve_mm is None:
                    stats.errors.append(f"Ligne {idx}: données obligatoires manquantes")
                    continue
                
                if sieve_mm <= 0:
                    stats.warnings.append(f"Ligne {idx}: sieve_mm <= 0 ({sieve_mm})")
                    continue
                
                # Colonnes optionnelles
                mass_refus_cum_g = float(row['mass_refus_cum_g']) if pd.notna(row.get('mass_refus_cum_g')) else None
                refus_cum_pct = float(row['refus_cum_pct']) if pd.notna(row.get('refus_cum_pct')) else None
                passants_pct = float(row['passants_pct']) if pd.notna(row.get('passants_pct')) else None
                
                # Warnings pour valeurs hors bornes (mais on archive quand même)
                if passants_pct is not None and (passants_pct < 0 or passants_pct > 100):
                    stats.warnings.append(f"Ligne {idx}: passants_pct hors [0,100] = {passants_pct}")
                
                cur.execute(upsert_sql, (
                    code_site, depth_m, sieve_mm, mass_refus_cum_g,
                    refus_cum_pct, passants_pct
                ))
                result = cur.fetchone()
                
                if result[1]:
                    stats.rows_inserted += 1
                else:
                    stats.rows_updated += 1
            
            except Exception as e:
                stats.errors.append(f"Ligne {idx}: {str(e)}")
    
    logger.info(f"✓ RAW AGT: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
    return stats


def import_raw_ags(self, df: pd.DataFrame) -> 'ImportStats':
    """Import des données RAW AGS (Analyse Granulométrique par Sédimentométrie)"""
    from dataclasses import dataclass, field
    from typing import List
    
    @dataclass
    class ImportStats:
        table_name: str
        rows_read: int = 0
        rows_inserted: int = 0
        rows_updated: int = 0
        rows_skipped: int = 0
        errors: List[str] = field(default_factory=list)
        warnings: List[str] = field(default_factory=list)
    
    stats = ImportStats(table_name='raw_lab_ags')
    stats.rows_read = len(df)
    
    if self.dry_run:
        logger.info(f"[DRY-RUN] RAW AGS: {len(df)} lignes à importer")
        stats.rows_inserted = len(df)
        return stats
    
    # Vérifier colonnes requises
    required_cols = ['code_site', 'depth_m', 'sieve_mm', 'passants_pct']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        stats.errors.append(f"Colonnes manquantes: {missing_cols}")
        logger.error(f"❌ RAW AGS: colonnes manquantes {missing_cols}")
        return stats
    
    upsert_sql = """
    INSERT INTO raw_lab_ags (
        code_site, depth_m, sieve_mm, passants_pct, created_at
    ) VALUES (%s, %s, %s, %s, now())
    ON CONFLICT (code_site, depth_m, sieve_mm)
    DO UPDATE SET
        passants_pct = EXCLUDED.passants_pct,
        updated_at = now()
    RETURNING id, (xmax = 0) AS inserted
    """
    
    with self.conn.cursor() as cur:
        for idx, row in df.iterrows():
            try:
                code_site = str(row['code_site']).strip() if pd.notna(row['code_site']) else None
                depth_m = float(row['depth_m']) if pd.notna(row['depth_m']) else None
                sieve_mm = float(row['sieve_mm']) if pd.notna(row['sieve_mm']) else None
                passants_pct = float(row['passants_pct']) if pd.notna(row['passants_pct']) else None
                
                if not code_site or depth_m is None or sieve_mm is None or passants_pct is None:
                    stats.errors.append(f"Ligne {idx}: données obligatoires manquantes")
                    continue
                
                if sieve_mm <= 0:
                    stats.warnings.append(f"Ligne {idx}: sieve_mm <= 0 ({sieve_mm})")
                    continue
                
                # Warnings pour valeurs hors bornes
                if passants_pct < 0 or passants_pct > 100:
                    stats.warnings.append(f"Ligne {idx}: passants_pct hors [0,100] = {passants_pct}")
                
                cur.execute(upsert_sql, (code_site, depth_m, sieve_mm, passants_pct))
                result = cur.fetchone()
                
                if result[1]:
                    stats.rows_inserted += 1
                else:
                    stats.rows_updated += 1
            
            except Exception as e:
                stats.errors.append(f"Ligne {idx}: {str(e)}")
    
    logger.info(f"✓ RAW AGS: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
    return stats


def import_raw_atterberg(self, df: pd.DataFrame) -> 'ImportStats':
    """Import des données RAW Atterberg (mesures détaillées par tare)"""
    from dataclasses import dataclass, field
    from typing import List
    
    @dataclass
    class ImportStats:
        table_name: str
        rows_read: int = 0
        rows_inserted: int = 0
        rows_updated: int = 0
        rows_skipped: int = 0
        errors: List[str] = field(default_factory=list)
        warnings: List[str] = field(default_factory=list)
    
    stats = ImportStats(table_name='raw_lab_atterberg')
    stats.rows_read = len(df)
    
    if self.dry_run:
        logger.info(f"[DRY-RUN] RAW Atterberg: {len(df)} lignes à importer")
        stats.rows_inserted = len(df)
        return stats
    
    # Vérifier colonnes requises
    required_cols = ['code_site', 'depth_m', 'test_type']
    missing_cols = [col for col in required_cols if col not in df.columns]
    if missing_cols:
        stats.errors.append(f"Colonnes manquantes: {missing_cols}")
        logger.error(f"❌ RAW Atterberg: colonnes manquantes {missing_cols}")
        return stats
    
    insert_sql = """
    INSERT INTO raw_lab_atterberg (
        code_site, depth_m, test_type, tare_no, nb_coups,
        poids_total_humide_g, poids_total_sec_g, poids_tare_g,
        poids_eau_g, poids_sol_sec_g, teneur_eau_pct, created_at
    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now())
    RETURNING id
    """
    
    with self.conn.cursor() as cur:
        for idx, row in df.iterrows():
            try:
                code_site = str(row['code_site']).strip() if pd.notna(row['code_site']) else None
                depth_m = float(row['depth_m']) if pd.notna(row['depth_m']) else None
                test_type = str(row['test_type']).strip().upper() if pd.notna(row['test_type']) else None
                
                if not code_site or depth_m is None or test_type is None:
                    stats.errors.append(f"Ligne {idx}: données obligatoires manquantes")
                    continue
                
                if test_type not in ['LL', 'PL']:
                    stats.errors.append(f"Ligne {idx}: test_type doit être LL ou PL (reçu: {test_type})")
                    continue
                
                # Colonnes optionnelles
                tare_no = int(row['tare_no']) if pd.notna(row.get('tare_no')) else None
                nb_coups = float(row['nb_coups']) if pd.notna(row.get('nb_coups')) else None
                poids_total_humide_g = float(row['poids_total_humide_g']) if pd.notna(row.get('poids_total_humide_g')) else None
                poids_total_sec_g = float(row['poids_total_sec_g']) if pd.notna(row.get('poids_total_sec_g')) else None
                poids_tare_g = float(row['poids_tare_g']) if pd.notna(row.get('poids_tare_g')) else None
                poids_eau_g = float(row['poids_eau_g']) if pd.notna(row.get('poids_eau_g')) else None
                poids_sol_sec_g = float(row['poids_sol_sec_g']) if pd.notna(row.get('poids_sol_sec_g')) else None
                teneur_eau_pct = float(row['teneur_eau_pct']) if pd.notna(row.get('teneur_eau_pct')) else None
                
                # Validation: nb_coups requis pour LL
                if test_type == 'LL' and nb_coups is None:
                    stats.warnings.append(f"Ligne {idx}: nb_coups manquant pour LL")
                
                cur.execute(insert_sql, (
                    code_site, depth_m, test_type, tare_no, nb_coups,
                    poids_total_humide_g, poids_total_sec_g, poids_tare_g,
                    poids_eau_g, poids_sol_sec_g, teneur_eau_pct
                ))
                
                stats.rows_inserted += 1
            
            except Exception as e:
                stats.errors.append(f"Ligne {idx}: {str(e)}")
    
    logger.info(f"✓ RAW Atterberg: {stats.rows_inserted} créés")
    return stats


def link_raw_to_echantillons(self):
    """Rétro-liaison: mise à jour des echantillon_id dans les tables RAW"""
    if self.dry_run:
        logger.info("[DRY-RUN] Rétro-liaison RAW → échantillons skippée")
        return
    
    logger.info("🔗 Rétro-liaison RAW → échantillons...")
    
    update_queries = [
        # AGT
        """
        UPDATE raw_lab_agt r
        SET echantillon_id = e.id
        FROM sondages s
        JOIN echantillons e ON e.sondage_id = s.id AND e.depth_m = r.depth_m
        WHERE s.meta->>'code' = r.code_site
          AND (r.echantillon_id IS DISTINCT FROM e.id)
        """,
        # AGS
        """
        UPDATE raw_lab_ags r
        SET echantillon_id = e.id
        FROM sondages s
        JOIN echantillons e ON e.sondage_id = s.id AND e.depth_m = r.depth_m
        WHERE s.meta->>'code' = r.code_site
          AND (r.echantillon_id IS DISTINCT FROM e.id)
        """,
        # Atterberg
        """
        UPDATE raw_lab_atterberg r
        SET echantillon_id = e.id
        FROM sondages s
        JOIN echantillons e ON e.sondage_id = s.id AND e.depth_m = r.depth_m
        WHERE s.meta->>'code' = r.code_site
          AND (r.echantillon_id IS DISTINCT FROM e.id)
        """
    ]
    
    with self.conn.cursor() as cur:
        for query in update_queries:
            cur.execute(query)
            updated = cur.rowcount
            table_name = query.split('UPDATE ')[1].split(' ')[0]
            logger.info(f"  ✓ {table_name}: {updated} liens mis à jour")
    
    logger.info("✓ Rétro-liaison terminée")


# ============================================================================
# INSTRUCTIONS D'INTÉGRATION
# ============================================================================
"""
Pour intégrer ces méthodes dans 02_import_excel.py :

1. Ajouter les imports en haut du fichier (si pas déjà présents)

2. Ajouter ces méthodes dans la classe DatabaseImporter

3. Ajouter les flags CLI dans main() :
   parser.add_argument('--import-raw', choices=['yes', 'no'], default='yes',
                       help='Importer les tables RAW (default: yes)')
   parser.add_argument('--raw-only', action='store_true',
                       help='Importer UNIQUEMENT les tables RAW')

4. Dans main(), après l'import des essais canoniques, ajouter :
   
   # Import RAW (v1.5.3)
   if args.import_raw == 'yes':
       # AGT RAW
       df_agt_raw = reader.get_sheet('agt_raw_long')
       if df_agt_raw is not None and len(df_agt_raw) > 0:
           logger.info(f"\n📊 Import RAW AGT ({len(df_agt_raw)} lignes)...")
           stats = importer.import_raw_agt(df_agt_raw)
           report.add_table_stats(stats)
       
       # AGS RAW
       df_ags_raw = reader.get_sheet('ags_raw_long')
       if df_ags_raw is not None and len(df_ags_raw) > 0:
           logger.info(f"\n📊 Import RAW AGS ({len(df_ags_raw)} lignes)...")
           stats = importer.import_raw_ags(df_ags_raw)
           report.add_table_stats(stats)
       
       # Atterberg RAW
       df_att_raw = reader.get_sheet('atterberg_raw')
       if df_att_raw is not None and len(df_att_raw) > 0:
           logger.info(f"\n📊 Import RAW Atterberg ({len(df_att_raw)} lignes)...")
           stats = importer.import_raw_atterberg(df_att_raw)
           report.add_table_stats(stats)
       
       # Rétro-liaison
       if not args.dry_run:
           importer.link_raw_to_echantillons()
"""
