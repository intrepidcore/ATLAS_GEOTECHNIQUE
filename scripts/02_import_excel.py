#!/usr/bin/env python3
"""
============================================================================
Script 02: Import Excel → PostgreSQL (Atlas Géotechnique)
============================================================================
Description: Import idempotent de données géotechniques depuis Excel multi-feuilles
Usage: python 02_import_excel.py --file data.xlsx --dsn "postgresql://user:pass@host/atlas_clean"
============================================================================
"""

import sys
import argparse
import hashlib
import logging
import unicodedata
from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from datetime import datetime
from dataclasses import dataclass, field
from difflib import get_close_matches

try:
    import pandas as pd
    import psycopg
    from psycopg import sql
except ImportError as e:
    print(f"❌ Dépendances manquantes: {e}")
    print("Installez avec: pip install pandas openpyxl psycopg[binary]")
    sys.exit(1)

# ============================================================================
# CONFIGURATION & LOGGING
# ============================================================================

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    datefmt='%Y-%m-%d %H:%M:%S'
)
logger = logging.getLogger(__name__)

# ============================================================================
# DATACLASSES & STRUCTURES
# ============================================================================

@dataclass
class ImportStats:
    """Statistiques d'import par table"""
    table_name: str
    rows_read: int = 0
    rows_inserted: int = 0
    rows_updated: int = 0
    rows_skipped: int = 0
    errors: List[str] = field(default_factory=list)
    warnings: List[str] = field(default_factory=list)
    
    def total_processed(self) -> int:
        return self.rows_inserted + self.rows_updated + self.rows_skipped
    
    def success_rate(self) -> float:
        if self.rows_read == 0:
            return 0.0
        return (self.total_processed() / self.rows_read) * 100

@dataclass
class ImportReport:
    """Rapport global d'import"""
    started_at: datetime
    completed_at: Optional[datetime] = None
    stats_by_table: Dict[str, ImportStats] = field(default_factory=dict)
    global_errors: List[str] = field(default_factory=list)
    dry_run: bool = False
    
    def add_table_stats(self, stats: ImportStats):
        self.stats_by_table[stats.table_name] = stats
    
    def total_rows_inserted(self) -> int:
        return sum(s.rows_inserted for s in self.stats_by_table.values())
    
    def total_rows_updated(self) -> int:
        return sum(s.rows_updated for s in self.stats_by_table.values())
    
    def has_errors(self) -> bool:
        return len(self.global_errors) > 0 or any(
            len(s.errors) > 0 for s in self.stats_by_table.values()
        )

# ============================================================================
# MAPPING COLONNES (clé canonique → nom colonne Excel)
# ============================================================================

COLUMN_MAPPINGS = {
    'sondages': {
        'code': 'code',
        'localite': 'localite',
        'date': 'date',
        'lat': 'lat',
        'lon': 'lon',
        'source': 'source'
    },
    'echantillons': {
        'code': 'code',
        'depth_m': 'depth_m',
        'date': 'date',
        'laboratory': 'laboratory',
        'rho_s_gcm3': 'rho_s_gcm3',
        'water_content_w': 'water_content_w',
        'is_index': 'is_index'
    },
    'atterberg': {
        'code': 'code',
        'depth_m': 'depth_m',
        'wl': 'wl',
        'wp': 'wp'
    },
    'vbs': {
        'code': 'code',
        'depth_m': 'depth_m',
        'vbs': 'vbs',
        'commentaire': 'commentaire'
    },
    'proctor': {
        'code': 'code',
        'depth_m': 'depth_m',
        'gamma_d_max': 'gamma_d_max',
        'w_opt': 'w_opt',
        'proctor_type': 'proctor_type'
    }
}

# ============================================================================
# VALIDATION & NETTOYAGE
# ============================================================================

def validate_percentage(value: Any, field_name: str) -> Optional[float]:
    """Valide et clamp un pourcentage [0, 100]"""
    if pd.isna(value):
        return None
    try:
        val = float(value)
        if val < 0:
            logger.warning(f"{field_name}: valeur négative {val} → 0")
            return 0.0
        if val > 100:
            logger.warning(f"{field_name}: valeur > 100 ({val}) → 100")
            return 100.0
        return val
    except (ValueError, TypeError):
        logger.error(f"{field_name}: valeur invalide '{value}'")
        return None

def validate_numeric(value: Any, field_name: str, min_val: float = None, max_val: float = None) -> Optional[float]:
    """Valide une valeur numérique avec plage optionnelle et normalisation virgule→point"""
    if pd.isna(value):
        return None
    try:
        # Normalisation: virgule → point (pour données européennes)
        if isinstance(value, str):
            value = value.replace(',', '.')
        
        val = float(value)
        if min_val is not None and val < min_val:
            logger.warning(f"{field_name}: {val} < {min_val}")
            return None
        if max_val is not None and val > max_val:
            logger.warning(f"{field_name}: {val} > {max_val}")
            return None
        return val
    except (ValueError, TypeError):
        logger.error(f"{field_name}: valeur invalide '{value}'")
        return None

def validate_date(value: Any, field_name: str) -> Optional[str]:
    """Valide et formate une date ISO YYYY-MM-DD"""
    if pd.isna(value):
        return None
    try:
        if isinstance(value, str):
            dt = pd.to_datetime(value)
        else:
            dt = value
        return dt.strftime('%Y-%m-%d')
    except Exception as e:
        logger.warning(f"{field_name}: date invalide '{value}' → None")
        return None

def clean_string(value: Any) -> Optional[str]:
    """Nettoie une chaîne de caractères"""
    if pd.isna(value):
        return None
    s = str(value).strip()
    return s if s else None

# ============================================================================
# LECTURE EXCEL
# ============================================================================

class ExcelReader:
    """Lecteur de fichiers Excel multi-feuilles"""
    
    def __init__(self, filepath: Path):
        self.filepath = filepath
        self.sheets: Dict[str, pd.DataFrame] = {}
    
    def load_all_sheets(self) -> Dict[str, pd.DataFrame]:
        """Charge toutes les feuilles du classeur"""
        logger.info(f"📂 Lecture du fichier: {self.filepath}")
        try:
            excel_file = pd.ExcelFile(self.filepath, engine='openpyxl')
            logger.info(f"   Feuilles disponibles: {excel_file.sheet_names}")
            
            for sheet_name in excel_file.sheet_names:
                df = pd.read_excel(excel_file, sheet_name=sheet_name)
                self.sheets[sheet_name] = df
                logger.info(f"   ✓ {sheet_name}: {len(df)} lignes, {len(df.columns)} colonnes")
            
            return self.sheets
        except Exception as e:
            logger.error(f"❌ Erreur lecture Excel: {e}")
            raise
    
    def get_sheet(self, name: str) -> Optional[pd.DataFrame]:
        """Récupère une feuille par nom (insensible à la casse)"""
        for sheet_name, df in self.sheets.items():
            if sheet_name.lower() == name.lower():
                return df
        return None

# ============================================================================
# IMPORTEURS PAR TABLE
# ============================================================================

class DatabaseImporter:
    """Gère l'import vers PostgreSQL"""
    
    def __init__(self, dsn: str, dry_run: bool = False):
        self.dsn = dsn
        self.dry_run = dry_run
        self.conn: Optional[psycopg.Connection] = None
        self.adm3_index: Dict[str, str] = {}  # localité normalisée → adm3_pcode
    
    def __enter__(self):
        if not self.dry_run:
            logger.info("Connexion à PostgreSQL...")
            try:
                self.conn = psycopg.connect(self.dsn, autocommit=False, connect_timeout=10)
                logger.info("✓ Connexion PostgreSQL établie")
            except psycopg.OperationalError as e:
                logger.error(f"✗ Impossible de se connecter à PostgreSQL: {e}")
                logger.error("Vérifiez que PostgreSQL est démarré et accessible")
                raise
        else:
            logger.info("🔍 Mode DRY-RUN: aucune écriture en base")
        return self
    
    def __exit__(self, exc_type, exc_val, exc_tb):
        if self.conn:
            if exc_type is None:
                self.conn.commit()
                logger.info("✓ Transaction committée")
            else:
                self.conn.rollback()
                logger.error("❌ Transaction rollback")
            self.conn.close()
    
    def ensure_tables_exist(self):
        """Crée les tables si elles n'existent pas"""
        if self.dry_run:
            return
        
        create_tables_sql = """
        -- Table sondages (déjà créée normalement)
        CREATE TABLE IF NOT EXISTS sondages (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            geom geometry(Point, 25231),
            date_sondage DATE,
            source TEXT,
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ DEFAULT now(),
            deleted_at TIMESTAMPTZ
        );
        
        -- Table echantillons
        CREATE TABLE IF NOT EXISTS echantillons (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            sondage_id UUID NOT NULL REFERENCES sondages(id) ON DELETE CASCADE,
            depth_m NUMERIC NOT NULL CHECK (depth_m >= 0),
            date DATE,
            laboratory TEXT,
            norm TEXT,
            rho_s_gcm3 NUMERIC CHECK (rho_s_gcm3 >= 2.0 AND rho_s_gcm3 <= 3.5),
            water_content_w NUMERIC CHECK (water_content_w >= 0 AND water_content_w <= 100),
            is_index NUMERIC CHECK (is_index >= 0 AND is_index <= 1),
            eg NUMERIC CHECK (eg >= 0 AND eg <= 50),
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            updated_at TIMESTAMPTZ,
            UNIQUE(sondage_id, depth_m, date)
        );
        
        -- Table essais_atterberg
        CREATE TABLE IF NOT EXISTS essais_atterberg (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
            wl NUMERIC CHECK (wl >= 0 AND wl <= 200),
            wp NUMERIC CHECK (wp >= 0 AND wp <= 200),
            ip_generated NUMERIC GENERATED ALWAYS AS (
                CASE WHEN wl IS NOT NULL AND wp IS NOT NULL AND wl >= wp 
                THEN wl - wp ELSE NULL END
            ) STORED,
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(echantillon_id)
        );
        
        -- Table essais_vbs
        CREATE TABLE IF NOT EXISTS essais_vbs (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
            vbs NUMERIC NOT NULL CHECK (vbs >= 0 AND vbs <= 20),
            commentaire TEXT,
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(echantillon_id)
        );
        
        -- Table essais_proctor
        CREATE TABLE IF NOT EXISTS essais_proctor (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
            proctor_type TEXT NOT NULL CHECK (proctor_type IN ('normal', 'modifie')),
            gamma_d_max NUMERIC NOT NULL CHECK (gamma_d_max >= 10 AND gamma_d_max <= 30),
            w_opt NUMERIC NOT NULL CHECK (w_opt >= 0 AND w_opt <= 50),
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(echantillon_id, proctor_type)
        );
        
        -- Table granulo_points
        CREATE TABLE IF NOT EXISTS granulo_points (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            echantillon_id UUID NOT NULL REFERENCES echantillons(id) ON DELETE CASCADE,
            method TEXT NOT NULL CHECK (method IN ('tamisage', 'sedimento')),
            sieve_mm NUMERIC NOT NULL CHECK (sieve_mm > 0),
            passing_pct NUMERIC NOT NULL CHECK (passing_pct >= 0 AND passing_pct <= 100),
            meta JSONB DEFAULT '{}'::jsonb,
            created_at TIMESTAMPTZ DEFAULT now(),
            UNIQUE(echantillon_id, method, sieve_mm)
        );
        """
        
        with self.conn.cursor() as cur:
            cur.execute(create_tables_sql)
        logger.info("✓ Tables vérifiées/créées")
    
    def load_adm3_index(self):
        """Charge l'index ADM3 depuis la base - utilise la fonction PostgreSQL robuste"""
        if self.dry_run or not self.conn:
            return
        
        logger.info("📍 Vérification fonction match_adm3_from_localite()...")
        with self.conn.cursor() as cur:
            # Vérifier que la fonction existe
            cur.execute("""
                SELECT EXISTS(
                    SELECT 1 FROM pg_proc 
                    WHERE proname = 'match_adm3_from_localite'
                )
            """)
            exists = cur.fetchone()[0]
            if not exists:
                logger.warning("⚠️  Fonction match_adm3_from_localite() non trouvée")
                logger.warning("   Exécutez d'abord: step0_adm3_matching_setup.sql")
            else:
                logger.info("✓ Fonction match_adm3_from_localite() disponible")
    
    def match_adm3_from_localite(self, localite: str, adm2_code: str = None) -> Optional[Tuple[str, float, str]]:
        """
        Trouve le code ADM3 correspondant à une localité via PostgreSQL (4 passes robustes)
        
        Returns:
            Tuple[adm3_code, score, method] ou None
        """
        if not localite or self.dry_run or not self.conn:
            return None
        
        try:
            with self.conn.cursor() as cur:
                cur.execute("""
                    SELECT adm3_code, score, method
                    FROM match_adm3_from_localite(%s, %s)
                    ORDER BY score DESC
                    LIMIT 1
                """, (localite, adm2_code))
                
                result = cur.fetchone()
                if result and result[1] >= 0.72:  # Seuil de confiance
                    return (result[0], float(result[1]), result[2])
                
                return None
        except Exception as e:
            logger.warning(f"Erreur matching ADM3 pour '{localite}': {e}")
            return None
    
    def import_sondages(self, df: pd.DataFrame) -> ImportStats:
        """Import des sondages avec géolocalisation WGS84"""
        stats = ImportStats(table_name='sondages')
        stats.rows_read = len(df)
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Sondages: {len(df)} lignes à importer")
            stats.rows_inserted = len(df)
            return stats
        
        # Vérifier si sondage existe déjà et faire INSERT ou UPDATE
        check_sql = "SELECT id FROM sondages WHERE meta->>'code' = %s"
        insert_sql = """
        INSERT INTO sondages (geom, date_sondage, source, meta, created_at, updated_at)
        VALUES (
            CASE 
                WHEN %s::NUMERIC IS NOT NULL AND %s::NUMERIC IS NOT NULL 
                THEN ST_Transform(ST_SetSRID(ST_MakePoint(%s::NUMERIC, %s::NUMERIC), 4326), 25231)
                ELSE NULL
            END,
            %s, %s, %s, now(), now()
        )
        RETURNING id
        """
        update_sql = """
        UPDATE sondages SET
            geom = CASE 
                WHEN %s::NUMERIC IS NOT NULL AND %s::NUMERIC IS NOT NULL 
                THEN ST_Transform(ST_SetSRID(ST_MakePoint(%s::NUMERIC, %s::NUMERIC), 4326), 25231)
                ELSE NULL
            END,
            date_sondage = COALESCE(%s, date_sondage),
            source = COALESCE(%s, source),
            updated_at = now()
        WHERE id = %s
        RETURNING id
        """
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    code = clean_string(row.get('code') or row.get('code_site'))
                    if not code:
                        stats.errors.append(f"Ligne {idx}: code manquant")
                        continue
                    
                    lon = validate_numeric(row.get('lon'), 'lon', -180, 180)
                    lat = validate_numeric(row.get('lat'), 'lat', -90, 90)
                    adm3_code = clean_string(row.get('adm3'))
                    localite = clean_string(row.get('localite'))
                    
                    # AUTO-DÉTECTION ADM3 depuis localité si pas d'ADM3 fourni
                    if not adm3_code and localite:
                        match_result = self.match_adm3_from_localite(localite, row.get('adm2'))
                        if match_result:
                            adm3_code, score, method = match_result
                            logger.info(f"✓ {code}: ADM3 auto-détecté '{localite}' → {adm3_code} (score={score:.2f}, method={method})")
                    
                    # Accepter sondages SANS GPS si adm3_code présent (pour spread)
                    # OU accepter sans géoloc du tout (mode orphelin)
                    if (lon is None or lat is None) and not adm3_code:
                        logger.warning(f"Sondage {code}: ni coordonnées ni adm3_code (mode orphelin)")
                        # Continue quand même pour permettre l'import
                    
                    date = validate_date(row.get('date'), 'date')
                    source = clean_string(row.get('source'))
                    
                    meta = {'code': code}
                    if localite:
                        meta['localite'] = localite
                    if adm3_code:
                        meta['adm3_code'] = adm3_code
                    
                    try:
                        # Vérifier si existe
                        cur.execute(check_sql, (code,))
                        existing = cur.fetchone()
                        
                        if existing:
                            # UPDATE
                            cur.execute(update_sql, (lon, lat, lon, lat, date, source, existing[0]))
                            stats.rows_updated += 1
                        else:
                            # INSERT
                            cur.execute(insert_sql, (lon, lat, lon, lat, date, source, psycopg.types.json.Json(meta)))
                            stats.rows_inserted += 1
                    except Exception as sql_err:
                        stats.errors.append(f"Ligne {idx} ({code}): SQL error - {str(sql_err)}")
                        logger.error(f"SQL error for {code}: {sql_err}")
                        raise  # Re-raise pour voir l'erreur complète
                
                except Exception as e:
                    stats.errors.append(f"Ligne {idx}: {str(e)}")
        
        logger.info(f"✓ Sondages: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
        return stats
    
    def import_echantillons(self, df: pd.DataFrame) -> ImportStats:
        """Import des échantillons"""
        stats = ImportStats(table_name='echantillons')
        stats.rows_read = len(df)
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Échantillons: {len(df)} lignes")
            stats.rows_inserted = len(df)
            return stats
        
        # Récupérer mapping code → sondage_id
        with self.conn.cursor() as cur:
            cur.execute("SELECT id, meta->>'code' as code FROM sondages WHERE meta->>'code' IS NOT NULL")
            sondage_map = {row[1]: row[0] for row in cur.fetchall()}
        
        upsert_sql = """
        INSERT INTO echantillons (
            sondage_id, depth_m, date, laboratory, rho_s_gcm3, 
            water_content_w, is_index, created_at
        ) VALUES (%s, %s, %s, %s, %s, %s, %s, now())
        ON CONFLICT (sondage_id, depth_m, date) 
        DO UPDATE SET
            laboratory = COALESCE(EXCLUDED.laboratory, echantillons.laboratory),
            rho_s_gcm3 = COALESCE(EXCLUDED.rho_s_gcm3, echantillons.rho_s_gcm3),
            water_content_w = COALESCE(EXCLUDED.water_content_w, echantillons.water_content_w),
            is_index = COALESCE(EXCLUDED.is_index, echantillons.is_index),
            updated_at = now()
        RETURNING id, (xmax = 0) AS inserted
        """
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    code = clean_string(row.get('code') or row.get('code_site'))
                    if not code or code not in sondage_map:
                        stats.errors.append(f"Ligne {idx}: sondage '{code}' introuvable")
                        continue
                    
                    sondage_id = sondage_map[code]
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    
                    if depth_m is None:
                        stats.errors.append(f"Ligne {idx}: depth_m invalide")
                        continue
                    
                    date = validate_date(row.get('date'), 'date')
                    laboratory = clean_string(row.get('laboratory'))
                    rho_s_gcm3 = validate_numeric(row.get('rho_s_gcm3'), 'rho_s_gcm3', 2.0, 3.5)
                    water_content_w = validate_percentage(row.get('water_content_w'), 'water_content_w')
                    is_index = validate_numeric(row.get('is_index'), 'is_index', 0, 1)
                    
                    cur.execute(upsert_sql, (
                        sondage_id, depth_m, date, laboratory, 
                        rho_s_gcm3, water_content_w, is_index
                    ))
                    result = cur.fetchone()
                    
                    if result[1]:
                        stats.rows_inserted += 1
                    else:
                        stats.rows_updated += 1
                
                except Exception as e:
                    stats.errors.append(f"Ligne {idx}: {str(e)}")
        
        logger.info(f"✓ Échantillons: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
        return stats
    
    def import_atterberg(self, df: pd.DataFrame) -> ImportStats:
        """Import des essais Atterberg"""
        stats = ImportStats(table_name='essais_atterberg')
        stats.rows_read = len(df)
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Atterberg: {len(df)} lignes")
            stats.rows_inserted = len(df)
            return stats
        
        # Récupérer mapping (code, depth_m) → echantillon_id
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, s.meta->>'code' as code, e.depth_m
                FROM echantillons e
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.meta->>'code' IS NOT NULL
            """)
            echantillon_map = {(row[1], float(row[2])): row[0] for row in cur.fetchall()}
        
        upsert_sql = """
        INSERT INTO essais_atterberg (echantillon_id, wl, wp, created_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (echantillon_id)
        DO UPDATE SET
            wl = COALESCE(EXCLUDED.wl, essais_atterberg.wl),
            wp = COALESCE(EXCLUDED.wp, essais_atterberg.wp)
        RETURNING id, (xmax = 0) AS inserted
        """
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    code = clean_string(row.get('code') or row.get('code_site'))
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    
                    if not code or depth_m is None:
                        stats.errors.append(f"Ligne {idx}: code ou depth_m manquant")
                        continue
                    
                    key = (code, depth_m)
                    if key not in echantillon_map:
                        stats.errors.append(f"Ligne {idx}: échantillon {code}@{depth_m}m introuvable")
                        continue
                    
                    echantillon_id = echantillon_map[key]
                    wl = validate_percentage(row.get('wl'), 'wl')
                    wp = validate_percentage(row.get('wp'), 'wp')
                    
                    if wl is None and wp is None:
                        stats.warnings.append(f"Ligne {idx}: WL et WP tous deux NULL")
                        stats.rows_skipped += 1
                        continue
                    
                    cur.execute(upsert_sql, (echantillon_id, wl, wp))
                    result = cur.fetchone()
                    
                    if result[1]:
                        stats.rows_inserted += 1
                    else:
                        stats.rows_updated += 1
                
                except Exception as e:
                    stats.errors.append(f"Ligne {idx}: {str(e)}")
        
        logger.info(f"✓ Atterberg: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
        return stats
    
    def import_vbs(self, df: pd.DataFrame) -> ImportStats:
        """Import des essais VBS"""
        stats = ImportStats(table_name='essais_vbs')
        stats.rows_read = len(df)
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] VBS: {len(df)} lignes")
            stats.rows_inserted = len(df)
            return stats
        
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, s.meta->>'code' as code, e.depth_m
                FROM echantillons e
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.meta->>'code' IS NOT NULL
            """)
            echantillon_map = {(row[1], float(row[2])): row[0] for row in cur.fetchall()}
        
        upsert_sql = """
        INSERT INTO essais_vbs (echantillon_id, vbs, commentaire, created_at)
        VALUES (%s, %s, %s, now())
        ON CONFLICT (echantillon_id)
        DO UPDATE SET
            vbs = EXCLUDED.vbs,
            commentaire = COALESCE(EXCLUDED.commentaire, essais_vbs.commentaire)
        RETURNING id, (xmax = 0) AS inserted
        """
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    code = clean_string(row.get('code') or row.get('code_site'))
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    vbs = validate_numeric(row.get('vbs'), 'vbs', 0, 20)
                    
                    if not code or depth_m is None or vbs is None:
                        stats.errors.append(f"Ligne {idx}: données manquantes")
                        continue
                    
                    key = (code, depth_m)
                    if key not in echantillon_map:
                        stats.errors.append(f"Ligne {idx}: échantillon {code}@{depth_m}m introuvable")
                        continue
                    
                    echantillon_id = echantillon_map[key]
                    commentaire = clean_string(row.get('commentaire'))
                    
                    cur.execute(upsert_sql, (echantillon_id, vbs, commentaire))
                    result = cur.fetchone()
                    
                    if result[1]:
                        stats.rows_inserted += 1
                    else:
                        stats.rows_updated += 1
                
                except Exception as e:
                    stats.errors.append(f"Ligne {idx}: {str(e)}")
        
        logger.info(f"✓ VBS: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
        return stats
    
    def import_proctor(self, df: pd.DataFrame) -> ImportStats:
        """Import des essais Proctor"""
        stats = ImportStats(table_name='essais_proctor')
        stats.rows_read = len(df)
        
        if self.dry_run:
            logger.info(f"[DRY-RUN] Proctor: {len(df)} lignes")
            stats.rows_inserted = len(df)
            return stats
        
        with self.conn.cursor() as cur:
            cur.execute("""
                SELECT e.id, s.meta->>'code' as code, e.depth_m
                FROM echantillons e
                JOIN sondages s ON e.sondage_id = s.id
                WHERE s.meta->>'code' IS NOT NULL
            """)
            echantillon_map = {(row[1], float(row[2])): row[0] for row in cur.fetchall()}
        
        upsert_sql = """
        INSERT INTO essais_proctor (echantillon_id, proctor_type, gamma_d_max, w_opt, created_at)
        VALUES (%s, %s, %s, %s, now())
        ON CONFLICT (echantillon_id, proctor_type)
        DO UPDATE SET
            gamma_d_max = EXCLUDED.gamma_d_max,
            w_opt = EXCLUDED.w_opt
        RETURNING id, (xmax = 0) AS inserted
        """
        
        with self.conn.cursor() as cur:
            for idx, row in df.iterrows():
                try:
                    code = clean_string(row.get('code') or row.get('code_site'))
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    gamma_d_max = validate_numeric(row.get('gamma_d_max'), 'gamma_d_max', 10, 30)
                    w_opt = validate_percentage(row.get('w_opt'), 'w_opt')
                    proctor_type = clean_string(row.get('proctor_type', 'normal'))
                    
                    if proctor_type not in ['normal', 'modifie']:
                        proctor_type = 'normal'
                    
                    if not code or depth_m is None or gamma_d_max is None or w_opt is None:
                        stats.errors.append(f"Ligne {idx}: données manquantes")
                        continue
                    
                    key = (code, depth_m)
                    if key not in echantillon_map:
                        stats.errors.append(f"Ligne {idx}: échantillon {code}@{depth_m}m introuvable")
                        continue
                    
                    echantillon_id = echantillon_map[key]
                    
                    cur.execute(upsert_sql, (echantillon_id, proctor_type, gamma_d_max, w_opt))
                    result = cur.fetchone()
                    
                    if result[1]:
                        stats.rows_inserted += 1
                    else:
                        stats.rows_updated += 1
                
                except Exception as e:
                    stats.errors.append(f"Ligne {idx}: {str(e)}")
        
        logger.info(f"✓ Proctor: {stats.rows_inserted} créés, {stats.rows_updated} mis à jour")
        return stats
    
    def import_raw_agt(self, df: pd.DataFrame) -> ImportStats:
        """Import des données RAW AGT (Analyse Granulométrique par Tamisage)"""
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
                    code_site = clean_string(row.get('code_site'))
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    sieve_mm = validate_numeric(row.get('sieve_mm'), 'sieve_mm', 0.0001)
                    
                    if not code_site or depth_m is None or sieve_mm is None:
                        stats.errors.append(f"Ligne {idx}: données obligatoires manquantes")
                        continue
                    
                    # Colonnes optionnelles
                    mass_refus_cum_g = validate_numeric(row.get('mass_refus_cum_g'), 'mass_refus_cum_g')
                    refus_cum_pct = validate_numeric(row.get('refus_cum_pct'), 'refus_cum_pct')
                    passants_pct = validate_numeric(row.get('passants_pct'), 'passants_pct')
                    
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
    
    def import_raw_ags(self, df: pd.DataFrame) -> ImportStats:
        """Import des données RAW AGS (Analyse Granulométrique par Sédimentométrie)"""
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
                    code_site = clean_string(row.get('code_site'))
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    sieve_mm = validate_numeric(row.get('sieve_mm'), 'sieve_mm', 0.0001)
                    passants_pct = validate_numeric(row.get('passants_pct'), 'passants_pct')
                    
                    if not code_site or depth_m is None or sieve_mm is None or passants_pct is None:
                        stats.errors.append(f"Ligne {idx}: données obligatoires manquantes")
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
    
    def import_raw_atterberg(self, df: pd.DataFrame) -> ImportStats:
        """Import des données RAW Atterberg (mesures détaillées par tare)"""
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
                    code_site = clean_string(row.get('code_site'))
                    depth_m = validate_numeric(row.get('depth_m'), 'depth_m', 0)
                    test_type = clean_string(row.get('test_type'))
                    
                    if not code_site or depth_m is None or not test_type:
                        stats.errors.append(f"Ligne {idx}: données obligatoires manquantes")
                        continue
                    
                    test_type = test_type.upper()
                    if test_type not in ['LL', 'PL']:
                        stats.errors.append(f"Ligne {idx}: test_type doit être LL ou PL (reçu: {test_type})")
                        continue
                    
                    # Colonnes optionnelles
                    tare_no = int(row['tare_no']) if pd.notna(row.get('tare_no')) else None
                    nb_coups = validate_numeric(row.get('nb_coups'), 'nb_coups')
                    poids_total_humide_g = validate_numeric(row.get('poids_total_humide_g'), 'poids_total_humide_g')
                    poids_total_sec_g = validate_numeric(row.get('poids_total_sec_g'), 'poids_total_sec_g')
                    poids_tare_g = validate_numeric(row.get('poids_tare_g'), 'poids_tare_g')
                    poids_eau_g = validate_numeric(row.get('poids_eau_g'), 'poids_eau_g')
                    poids_sol_sec_g = validate_numeric(row.get('poids_sol_sec_g'), 'poids_sol_sec_g')
                    teneur_eau_pct = validate_numeric(row.get('teneur_eau_pct'), 'teneur_eau_pct')
                    
                    # Validations Atterberg strictes
                    if test_type == 'LL':
                        if nb_coups is None:
                            stats.warnings.append(f"Ligne {idx}: nb_coups manquant pour LL (requis)")
                        elif nb_coups < 10 or nb_coups > 35:
                            stats.warnings.append(f"Ligne {idx}: nb_coups={nb_coups} hors plage normale [10-35] pour LL")
                    elif test_type == 'PL':
                        if nb_coups is not None:
                            stats.warnings.append(f"Ligne {idx}: nb_coups renseigné pour PL (devrait être NULL)")
                    
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
            FROM sondages s, echantillons e
            WHERE s.meta->>'code' = r.code_site
              AND e.sondage_id = s.id 
              AND e.depth_m = r.depth_m
              AND (r.echantillon_id IS DISTINCT FROM e.id)
            """,
            # AGS
            """
            UPDATE raw_lab_ags r
            SET echantillon_id = e.id
            FROM sondages s, echantillons e
            WHERE s.meta->>'code' = r.code_site
              AND e.sondage_id = s.id 
              AND e.depth_m = r.depth_m
              AND (r.echantillon_id IS DISTINCT FROM e.id)
            """,
            # Atterberg
            """
            UPDATE raw_lab_atterberg r
            SET echantillon_id = e.id
            FROM sondages s, echantillons e
            WHERE s.meta->>'code' = r.code_site
              AND e.sondage_id = s.id 
              AND e.depth_m = r.depth_m
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
# ORCHESTRATION & MAIN
# ============================================================================

def print_report(report: ImportReport):
    """Affiche le rapport d'import"""
    print("\n" + "="*70)
    print("📊 RAPPORT D'IMPORT")
    print("="*70)
    print(f"Début: {report.started_at.strftime('%Y-%m-%d %H:%M:%S')}")
    if report.completed_at:
        duration = (report.completed_at - report.started_at).total_seconds()
        print(f"Fin: {report.completed_at.strftime('%Y-%m-%d %H:%M:%S')} (durée: {duration:.1f}s)")
    
    if report.dry_run:
        print("\n⚠️  MODE DRY-RUN: Aucune donnée écrite en base")
    
    print(f"\n{'Table':<25} {'Lues':<8} {'Créées':<8} {'MAJ':<8} {'Erreurs':<8} {'Taux':<8}")
    print("-"*70)
    
    for table_name, stats in report.stats_by_table.items():
        print(f"{table_name:<25} {stats.rows_read:<8} {stats.rows_inserted:<8} "
              f"{stats.rows_updated:<8} {len(stats.errors):<8} {stats.success_rate():<7.1f}%")
    
    print("-"*70)
    print(f"{'TOTAL':<25} {'':<8} {report.total_rows_inserted():<8} "
          f"{report.total_rows_updated():<8}")
    
    # Erreurs
    if report.has_errors():
        print("\n❌ ERREURS DÉTECTÉES:")
        for table_name, stats in report.stats_by_table.items():
            if stats.errors:
                print(f"\n  {table_name}:")
                for err in stats.errors[:10]:  # Limiter à 10
                    print(f"    - {err}")
                if len(stats.errors) > 10:
                    print(f"    ... et {len(stats.errors) - 10} autres erreurs")
    
    # Warnings
    has_warnings = any(len(s.warnings) > 0 for s in report.stats_by_table.values())
    if has_warnings:
        print("\n⚠️  WARNINGS:")
        for table_name, stats in report.stats_by_table.items():
            if stats.warnings:
                print(f"\n  {table_name}:")
                for warn in stats.warnings[:5]:
                    print(f"    - {warn}")
                if len(stats.warnings) > 5:
                    print(f"    ... et {len(stats.warnings) - 5} autres warnings")
    
    print("\n" + "="*70)

def main():
    parser = argparse.ArgumentParser(
        description='Import Excel → PostgreSQL (Atlas Géotechnique)',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Exemples:
  # Import normal
  python 02_import_excel.py --file data.xlsx --dsn "postgresql://user:pass@localhost/atlas_clean"
  
  # Mode dry-run (validation sans écriture)
  python 02_import_excel.py --file data.xlsx --dsn "..." --dry-run
  
  # Avec variable d'environnement
  export DATABASE_URL="postgresql://user:pass@localhost/atlas_clean"
  python 02_import_excel.py --file data.xlsx
        """
    )
    
    parser.add_argument('--file', required=True, type=Path, help='Fichier Excel (.xlsx)')
    parser.add_argument('--dsn', help='DSN PostgreSQL (ou variable DATABASE_URL)')
    parser.add_argument('--dry-run', action='store_true', help='Mode validation (pas d\'écriture)')
    parser.add_argument('--verbose', '-v', action='store_true', help='Mode verbeux')
    parser.add_argument('--import-raw', choices=['yes', 'no'], default='yes',
                        help='Importer les tables RAW (default: yes, v1.5.3)')
    parser.add_argument('--raw-only', action='store_true',
                        help='Importer UNIQUEMENT les tables RAW (skip canoniques)')
    
    args = parser.parse_args()
    
    if args.verbose:
        logger.setLevel(logging.DEBUG)
    
    # DSN
    dsn = args.dsn or os.environ.get('DATABASE_URL')
    if not dsn:
        logger.error("❌ DSN manquant. Utilisez --dsn ou DATABASE_URL")
        sys.exit(1)
    
    # Vérifier fichier
    if not args.file.exists():
        logger.error(f"❌ Fichier introuvable: {args.file}")
        sys.exit(1)
    
    # Rapport
    report = ImportReport(started_at=datetime.now(), dry_run=args.dry_run)
    
    try:
        # Lecture Excel
        reader = ExcelReader(args.file)
        sheets = reader.load_all_sheets()
        
        # Import
        with DatabaseImporter(dsn, dry_run=args.dry_run) as importer:
            if not args.dry_run:
                importer.ensure_tables_exist()
                importer.load_adm3_index()  # Charger l'index ADM3 pour auto-matching
            
            # 1. Sondages
            df_sondages = reader.get_sheet('sondages')
            if df_sondages is not None and len(df_sondages) > 0:
                logger.info(f"\n📍 Import sondages ({len(df_sondages)} lignes)...")
                stats = importer.import_sondages(df_sondages)
                report.add_table_stats(stats)
            else:
                logger.warning("⚠️  Feuille 'sondages' absente ou vide")
            
            # 2. Échantillons
            df_echantillons = reader.get_sheet('echantillons')
            if df_echantillons is not None and len(df_echantillons) > 0:
                logger.info(f"\n🧪 Import échantillons ({len(df_echantillons)} lignes)...")
                stats = importer.import_echantillons(df_echantillons)
                report.add_table_stats(stats)
            else:
                logger.warning("⚠️  Feuille 'echantillons' absente ou vide")
            
            # 3. Atterberg
            df_atterberg = reader.get_sheet('atterberg')
            if df_atterberg is not None and len(df_atterberg) > 0:
                logger.info(f"\n📊 Import Atterberg ({len(df_atterberg)} lignes)...")
                stats = importer.import_atterberg(df_atterberg)
                report.add_table_stats(stats)
            
            # 4. VBS
            df_vbs = reader.get_sheet('vbs')
            if df_vbs is not None and len(df_vbs) > 0:
                logger.info(f"\n🔵 Import VBS ({len(df_vbs)} lignes)...")
                stats = importer.import_vbs(df_vbs)
                report.add_table_stats(stats)
            
            # 5. Proctor
            df_proctor = reader.get_sheet('proctor')
            if df_proctor is not None and len(df_proctor) > 0:
                logger.info(f"\n🔨 Import Proctor ({len(df_proctor)} lignes)...")
                stats = importer.import_proctor(df_proctor)
                report.add_table_stats(stats)
            
            # ========================================
            # 6. TABLES RAW (v1.5.3)
            # ========================================
            if args.import_raw == 'yes':
                logger.info("\n" + "="*70)
                logger.info("📊 IMPORT TABLES RAW (v1.5.3)")
                logger.info("="*70)
                
                # AGT RAW
                df_agt_raw = reader.get_sheet('agt_raw_long')
                if df_agt_raw is not None and len(df_agt_raw) > 0:
                    logger.info(f"\n🔬 Import RAW AGT ({len(df_agt_raw)} lignes)...")
                    stats = importer.import_raw_agt(df_agt_raw)
                    report.add_table_stats(stats)
                else:
                    logger.info("⚠️  Feuille 'agt_raw_long' absente ou vide (OK si v < 1.5.3)")
                
                # AGS RAW
                df_ags_raw = reader.get_sheet('ags_raw_long')
                if df_ags_raw is not None and len(df_ags_raw) > 0:
                    logger.info(f"\n🔬 Import RAW AGS ({len(df_ags_raw)} lignes)...")
                    stats = importer.import_raw_ags(df_ags_raw)
                    report.add_table_stats(stats)
                else:
                    logger.info("⚠️  Feuille 'ags_raw_long' absente ou vide (OK si v < 1.5.3)")
                
                # Atterberg RAW
                df_att_raw = reader.get_sheet('atterberg_raw')
                if df_att_raw is not None and len(df_att_raw) > 0:
                    logger.info(f"\n🔬 Import RAW Atterberg ({len(df_att_raw)} lignes)...")
                    stats = importer.import_raw_atterberg(df_att_raw)
                    report.add_table_stats(stats)
                else:
                    logger.info("⚠️  Feuille 'atterberg_raw' absente ou vide (OK si v < 1.5.3)")
                
                # Rétro-liaison echantillon_id
                if not args.dry_run:
                    importer.link_raw_to_echantillons()
        
        report.completed_at = datetime.now()
        print_report(report)
        
        if not args.dry_run:
            logger.info("\n🔄 Refresh de la vue matérialisée...")
            try:
                with psycopg.connect(dsn, connect_timeout=10) as conn:
                    with conn.cursor() as cur:
                        # Vérifier si la vue existe
                        cur.execute("SELECT EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'mailles_geotechnique_stats')")
                        if cur.fetchone()[0]:
                            cur.execute("REFRESH MATERIALIZED VIEW mailles_geotechnique_stats")
                            logger.info("✓ Vue matérialisée rafraîchie")
                        else:
                            logger.warning("⚠ Vue mailles_geotechnique_stats n'existe pas - skip refresh")
                    conn.commit()
            except Exception as e:
                logger.warning(f"⚠ Erreur refresh vue: {e}")
        
        if report.has_errors():
            logger.error("\n❌ Import terminé avec erreurs")
            sys.exit(1)
        else:
            logger.info("\n✅ Import terminé avec succès!")
            sys.exit(0)
    
    except Exception as e:
        logger.exception(f"❌ Erreur fatale: {e}")
        sys.exit(1)

if __name__ == '__main__':
    import os
    main()
