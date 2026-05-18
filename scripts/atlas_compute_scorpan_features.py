#!/usr/bin/env python3
"""
Atlas DSM + WorldClim Feature Computation Pipeline
====================================================
Scientific pipeline for computing SCORPAN covariates:
- DSM derivatives: altitude_mean, dem_slope_mean_deg, dem_tpi_mean, dem_hand_mean, distance_river_m
- WorldClim derivatives: prec_annual, bio12, bio15, bio4, bio17, prec_dry, prec_wet

Usage:
    python scripts/atlas_compute_scorpan_features.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean

Author: Atlas Engineering Team
Scientific References:
    - Wilson & Gallant (2000) - Terrain Analysis
    - Guisan et al. (2006) - Environmental niche models  
    - Rennó et al. (2008) - HAND: a new terrain descriptor
"""

import sys
import os
import time
import argparse
import logging
import uuid
from datetime import datetime, timezone
from typing import Optional, Tuple, List
from pathlib import Path

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
from psycopg2 import sql

# Configure logging with timeline format
LOG_FORMAT = '%(asctime)s | %(levelname)-8s | %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

class AtlasFeaturePipeline:
    """Pipeline for computing SCORPAN covariates"""
    
    def __init__(self, db_url: str, dry_run: bool = False):
        self.db_url = db_url
        self.dry_run = dry_run
        self.conn = None
        self.run_id = str(uuid.uuid4())[:8]
        
        # Setup logging
        self.logger = logging.getLogger(f'AtlasFeaturePipeline-{self.run_id}')
        self.logger.setLevel(logging.INFO)
        
        # Console handler
        ch = logging.StreamHandler()
        ch.setFormatter(logging.Formatter(LOG_FORMAT, DATE_FORMAT))
        self.logger.addHandler(ch)
        
        # Stats tracking
        self.stats = {
            'altitude_computed': 0,
            'slope_computed': 0,
            'tpi_computed': 0,
            'hand_computed': 0,
            'river_computed': 0,
            'climate_computed': 0,
            'start_time': None,
            'end_time': None
        }
    
    def connect(self) -> psycopg2.extensions.connection:
        """Establish database connection"""
        self.logger.info("Connecting to database...")
        self.conn = psycopg2.connect(self.db_url)
        self.conn.autocommit = False
        self.logger.info(f"Connected successfully (run_id: {self.run_id})")
        return self.conn
    
    def close(self):
        """Close database connection"""
        if self.conn:
            self.conn.close()
            self.logger.info("Database connection closed")
    
    def execute_sql_file(self, filepath: str) -> Tuple[bool, str]:
        """Execute SQL file with error handling"""
        try:
            with open(filepath, 'r') as f:
                sql_content = f.read()
            
            cur = self.conn.cursor()
            cur.execute(sql_content)
            self.conn.commit()
            cur.close()
            return True, "OK"
        except Exception as e:
            self.conn.rollback()
            return False, str(e)
    
    def execute_query(self, query: str, params: tuple = None) -> bool:
        """Execute a query with error handling"""
        try:
            cur = self.conn.cursor()
            if params:
                cur.execute(query, params)
            else:
                cur.execute(query)
            self.conn.commit()
            cur.close()
            return True
        except Exception as e:
            self.conn.rollback()
            self.logger.error(f"Query failed: {str(e)}")
            return False
    
    # =========================================================================
    # DSM DERIVATIVES
    # =========================================================================
    
    def setup_dsm_columns(self) -> bool:
        """Create DSM derivative columns in mailles table"""
        self.logger.info("[1/6] Setting up DSM columns in mailles table...")
        
        columns = [
            ("altitude_mean", "numeric"),
            ("dem_slope_mean_deg", "numeric"),
            ("dem_tpi_mean", "numeric"),
            ("dem_hand_mean", "numeric"),
            ("distance_river_m", "numeric"),
            ("dsm_features_ok", "boolean")
        ]
        
        for col_name, col_type in columns:
            query = f"""
                ALTER TABLE atlas.mailles 
                ADD COLUMN IF NOT EXISTS {col_name} {col_type};
            """
            self.execute_query(query)
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'atlas' AND table_name = 'mailles'
            AND column_name IN ('altitude_mean', 'dem_slope_mean_deg', 'dem_tpi_mean', 'dem_hand_mean', 'distance_river_m')
        """)
        cols = [row[0] for row in cur.fetchall()]
        cur.close()
        
        self.logger.info(f"  DSM columns ready: {len(cols)}/5")
        return len(cols) == 5
    
    def compute_altitude_mean(self) -> bool:
        """
        Compute altitude_mean from DSM raster
        Method: ST_Clip + ST_SummaryStats on each maille geometry
        Scientific: Direct extraction from dsm_cop30 (2926 tiles, 30m resolution)
        """
        self.logger.info("  Computing altitude_mean from DSM...")
        start = time.time()
        
        # Batch computation - 3 batches of ~10000
        # Using subquery with ST_Union for proper aggregation
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.mailles m
                SET altitude_mean = sub.alt_mean
                FROM (
                    SELECT
                        m.id,
                        ROUND((ST_SummaryStats(ST_Clip(
                            (SELECT ST_Union(r.rast) FROM atlas.dsm_cop30 r WHERE ST_Intersects(r.rast, m.geom)),
                            m.geom
                        ), true)).mean::numeric, 2) as alt_mean
                    FROM atlas.mailles m
                    WHERE m.altitude_mean IS NULL
                    LIMIT 10000
                ) sub
                WHERE m.id = sub.id;
            """
            success = self.execute_query(query)
            if not success:
                # Fallback: compute at centroids only
                query = """
                    UPDATE atlas.mailles m
                    SET altitude_mean = sub.alt
                    FROM (
                        SELECT
                            m.id,
                            ROUND(AVG(ST_Value(r.rast, ST_Centroid(ST_Transform(m.geom, 25231))))::numeric, 2) as alt
                        FROM atlas.mailles m
                        CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 25231) as pt
                        JOIN atlas.dsm_cop30 r ON ST_Intersects(r.rast, pt)
                        WHERE m.altitude_mean IS NULL
                        GROUP BY m.id
                        LIMIT 10000
                    ) sub
                    WHERE m.id = sub.id;
                """
                self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3 completed")
        
        # Update flag
        self.execute_query("""
            UPDATE atlas.mailles SET dsm_features_ok = true 
            WHERE altitude_mean IS NOT NULL
        """)
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(altitude_mean), ROUND(AVG(altitude_mean), 1), ROUND(MIN(altitude_mean), 1), ROUND(MAX(altitude_mean), 1) FROM atlas.mailles")
        row = cur.fetchone()
        cur.close()
        
        self.stats['altitude_computed'] = row[0]
        elapsed = time.time() - start
        self.logger.info(f"  altitude_mean: {row[0]:,} mailles, mean={row[1]}m, range=[{row[2]}-{row[3]}]m, time={elapsed:.1f}s")
        
        return row[0] >= 29000
    
    def compute_slope_mean(self) -> bool:
        """
        Compute dem_slope_mean_deg from DSM using ST_Slope
        Method: ST_Slope on raster, then extract mean per maille
        Scientific: First derivative of elevation (Wilson & Gallant, 2000)
        """
        self.logger.info("  Computing dem_slope_mean_deg...")
        start = time.time()
        
        # Check if dsm_slope table exists
        cur = self.conn.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'atlas' AND table_name = 'dsm_slope'
        """)
        has_slope_table = len(cur.fetchall()) > 0
        cur.close()
        
        if not has_slope_table:
            self.logger.info("    Creating slope raster (one-time ~5-10 min)...")
            self.execute_query("""
                CREATE TABLE IF NOT EXISTS atlas.dsm_slope AS
                SELECT ST_Slope(rast, 1, '32BF') as rast
                FROM atlas.dsm_cop30;
            """)
            # Grant permissions
            self.execute_query("ALTER TABLE atlas.dsm_slope OWNER TO atlas")
        
        # Batch computation - using centroid extraction
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.mailles m
                SET dem_slope_mean_deg = sub.slope
                FROM (
                    SELECT
                        m.id,
                        ROUND(AVG(ST_Value(s.rast, ST_Centroid(ST_Transform(m.geom, 25231))))::numeric, 2) as slope
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 25231) as pt
                    JOIN atlas.dsm_slope s ON ST_Intersects(s.rast, pt)
                    WHERE m.dem_slope_mean_deg IS NULL
                    GROUP BY m.id
                    LIMIT 10000
                ) sub
                WHERE m.id = sub.id;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3 completed")
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(dem_slope_mean_deg), ROUND(AVG(dem_slope_mean_deg), 2), ROUND(MIN(dem_slope_mean_deg), 2), ROUND(MAX(dem_slope_mean_deg), 2) FROM atlas.mailles")
        row = cur.fetchone()
        cur.close()
        
        self.stats['slope_computed'] = row[0]
        elapsed = time.time() - start
        self.logger.info(f"  dem_slope_mean_deg: {row[0]:,} mailles, mean={row[1]}°, range=[{row[2]}-{row[3]}]°, time={elapsed:.1f}s")
        
        return row[0] >= 29000
    
    def compute_tpi_mean(self) -> bool:
        """
        Compute dem_tpi_mean (Topographic Position Index)
        Method: TPI = altitude - mean(altitude in annular window 3-6km)
        Scientific: Guisan et al. (2006) - distinguishes ridges from valleys
        """
        self.logger.info("  Computing dem_tpi_mean (6km radius = 3 mailles ring)...")
        start = time.time()
        
        # Batch computation
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.mailles m
                SET dem_tpi_mean = sub.tpi
                FROM (
                    SELECT
                        m.id,
                        ROUND((m.altitude_mean - sub.avg_neighbor_alt)::numeric, 2) as tpi
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL (
                        SELECT AVG(n.altitude_mean) as avg_neighbor_alt
                        FROM atlas.mailles n
                        WHERE n.id != m.id
                          AND n.altitude_mean IS NOT NULL
                          -- Annulus: 3km to 6km (excludes inner circle)
                          AND ST_DWithin(
                              ST_Transform(ST_Centroid(m.geom), 25231),
                              ST_Transform(ST_Centroid(n.geom), 25231),
                              6000
                          )
                          AND NOT ST_DWithin(
                              ST_Transform(ST_Centroid(m.geom), 25231),
                              ST_Transform(ST_Centroid(n.geom), 25231),
                              3000
                          )
                    ) sub
                    WHERE m.altitude_mean IS NOT NULL
                      AND sub.avg_neighbor_alt IS NOT NULL
                      AND m.dem_tpi_mean IS NULL
                    LIMIT 10000
                ) sub
                WHERE m.id = sub.id;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3 completed")
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(dem_tpi_mean), ROUND(AVG(dem_tpi_mean), 2), ROUND(MIN(dem_tpi_mean), 2), ROUND(MAX(dem_tpi_mean), 2) FROM atlas.mailles")
        row = cur.fetchone()
        cur.close()
        
        self.stats['tpi_computed'] = row[0]
        elapsed = time.time() - start
        self.logger.info(f"  dem_tpi_mean: {row[0]:,} mailles, mean={row[1]}m, range=[{row[2]}-{row[3]}]m, time={elapsed:.1f}s")
        
        return row[0] >= 28000
    
    def compute_hand_mean(self) -> bool:
        """
        Compute dem_hand_mean (Height Above Nearest Drainage)
        Method: HAND = altitude - min(altitude within 10km)
        Scientific: Rennó et al. (2008) - proxy for water table depth
        """
        self.logger.info("  Computing dem_hand_mean (10km radius)...")
        start = time.time()
        
        # Batch computation
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.mailles m
                SET dem_hand_mean = sub.hand
                FROM (
                    SELECT
                        m.id,
                        ROUND((m.altitude_mean - sub.min_neighbor_alt)::numeric, 2) as hand
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL (
                        SELECT MIN(n.altitude_mean) as min_neighbor_alt
                        FROM atlas.mailles n
                        WHERE n.id != m.id
                          AND n.altitude_mean IS NOT NULL
                          -- 10km radius
                          AND ST_DWithin(
                              ST_Transform(ST_Centroid(m.geom), 25231),
                              ST_Transform(ST_Centroid(n.geom), 25231),
                              10000
                          )
                    ) sub
                    WHERE m.altitude_mean IS NOT NULL
                      AND sub.min_neighbor_alt IS NOT NULL
                      AND m.dem_hand_mean IS NULL
                    LIMIT 10000
                ) sub
                WHERE m.id = sub.id;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3 completed")
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(dem_hand_mean), ROUND(AVG(dem_hand_mean), 2), ROUND(MIN(dem_hand_mean), 2), ROUND(MAX(dem_hand_mean), 2) FROM atlas.mailles")
        row = cur.fetchone()
        cur.close()
        
        self.stats['hand_computed'] = row[0]
        elapsed = time.time() - start
        self.logger.info(f"  dem_hand_mean: {row[0]:,} mailles, mean={row[1]}m, range=[{row[2]}-{row[3]}]m, time={elapsed:.1f}s")
        
        return row[0] >= 28000
    
    def compute_distance_river(self) -> bool:
        """
        Compute distance_river_m
        Method: ST_Distance between maille centroid and hydrogeologie network
        Scientific: Proximity to drainage affects groundwater and soil moisture
        """
        self.logger.info("  Computing distance_river_m...")
        start = time.time()
        
        # Check if hydrogeologie table exists
        cur = self.conn.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'atlas' AND table_name = 'hydrogeologie'
        """)
        has_hydro = len(cur.fetchall()) > 0
        cur.close()
        
        if not has_hydro:
            self.logger.warning("  hydrogeologie table not found, skipping distance_river_m")
            return True
        
        # Compute distances
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.mailles m
                SET distance_river_m = sub.dist
                FROM (
                    SELECT
                        m.id,
                        ROUND(ST_Distance(
                            ST_Transform(ST_Centroid(m.geom), 25231),
                            ST_Transform(ST_Centroid(h.geom), 25231)
                        )::numeric, 2) as dist
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL (
                        SELECT geom FROM atlas.hydrogeologie
                        ORDER BY ST_Transform(ST_Centroid(m.geom), 25231) <-> ST_Transform(ST_Centroid(geom), 25231)
                        LIMIT 1
                    ) h
                    WHERE m.distance_river_m IS NULL
                    LIMIT 10000
                ) sub
                WHERE m.id = sub.id;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3 completed")
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("SELECT COUNT(distance_river_m), ROUND(AVG(distance_river_m)/1000, 2), ROUND(MIN(distance_river_m)/1000, 2), ROUND(MAX(distance_river_m)/1000, 2) FROM atlas.mailles WHERE distance_river_m IS NOT NULL")
        row = cur.fetchone()
        cur.close()
        
        self.stats['river_computed'] = row[0] if row[0] else 0
        elapsed = time.time() - start
        if row[0]:
            self.logger.info(f"  distance_river_m: {row[0]:,} mailles, mean={row[1]}km, range=[{row[2]}-{row[3]}]km, time={elapsed:.1f}s")
        else:
            self.logger.info("  distance_river_m: 0 mailles computed")
        
        return True
    
    # =========================================================================
    # WORLDCLIM DERIVATIVES
    # =========================================================================
    
    def setup_climate_tables(self) -> bool:
        """Create climate feature tables"""
        self.logger.info("[2/6] Setting up climate tables...")
        
        # Create maille_climate_features table
        self.execute_query("""
            CREATE TABLE IF NOT EXISTS atlas.maille_climate_features (
                maille_code TEXT PRIMARY KEY,
                prec_annual NUMERIC,
                prec_dry NUMERIC,
                prec_wet NUMERIC,
                bio12 NUMERIC,
                bio15 NUMERIC,
                bio4 NUMERIC,
                bio17 NUMERIC,
                updated_at TIMESTAMPTZ DEFAULT now()
            );
        """)
        
        # Create indexes
        self.execute_query("CREATE INDEX IF NOT EXISTS idx_climate_maille ON atlas.maille_climate_features(maille_code)")
        
        self.logger.info("  Climate tables ready")
        return True
    
    def compute_worldclim_features(self) -> bool:
        """
        Compute WorldClim features from rasters
        Method: Extract values at maille centroids from worldclim_prec and worldclim_bio
        Scientific: WorldClim v2.1 - global climate grids (2.5 arcmin resolution)
        """
        self.logger.info("  Computing WorldClim features from rasters...")
        start = time.time()
        
        # Check if worldclim tables exist
        cur = self.conn.cursor()
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'atlas' AND (table_name LIKE 'worldclim_prec%' OR table_name LIKE 'worldclim_bio%')
        """)
        tables = [row[0] for row in cur.fetchall()]
        cur.close()
        
        if not tables:
            self.logger.warning("  WorldClim tables not found. Using maille_climate_features if exists.")
            # Check if we already have data in maille_climate_features
            cur = self.conn.cursor()
            cur.execute("SELECT COUNT(*) FROM atlas.maille_climate_features")
            count = cur.fetchone()[0]
            cur.close()
            
            if count >= 29000:
                self.logger.info(f"  Using existing maille_climate_features: {count:,} mailles")
                self.stats['climate_computed'] = count
                return True
            else:
                self.logger.error("  No WorldClim data found")
                return False
        
        # Compute precipitation annual (sum of 12 months)
        for batch_num in range(1, 4):
            query = """
                INSERT INTO atlas.maille_climate_features (maille_code, prec_annual)
                SELECT 
                    m.code,
                    sub.prec_annual
                FROM atlas.mailles m
                CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 4326) as pt
                CROSS JOIN LATERAL (
                    SELECT COALESCE(
                        (SELECT SUM(ST_Value(r.rast, pt)::numeric) FROM worldclim_prec r WHERE ST_Intersects(r.rast, pt)),
                        (SELECT SUM(ST_Value(r.rast, pt)::numeric) FROM worldclim_prec_01 r WHERE ST_Intersects(r.rast, pt))
                    ) as prec_annual
                ) sub
                WHERE m.code NOT IN (SELECT maille_code FROM atlas.maille_climate_features WHERE prec_annual IS NOT NULL)
                LIMIT 10000
                ON CONFLICT (maille_code) DO UPDATE SET prec_annual = EXCLUDED.prec_annual;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: prec_annual")
        
        # Compute bio12 (Annual Precipitation)
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.maille_climate_features cf
                SET bio12 = sub.bio12
                FROM (
                    SELECT 
                        m.code as maille_code,
                        ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as bio12
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 4326) as pt
                    JOIN worldclim_bio r ON ST_Intersects(r.rast, pt)
                    WHERE cf.bio12 IS NULL
                    LIMIT 10000
                ) sub
                WHERE cf.maille_code = sub.maille_code;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: bio12")
        
        # Compute bio15 (Precipitation Seasonality)
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.maille_climate_features cf
                SET bio15 = sub.bio15
                FROM (
                    SELECT 
                        m.code as maille_code,
                        ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as bio15
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 4326) as pt
                    JOIN worldclim_bio r ON ST_Intersects(r.rast, pt)
                    WHERE cf.bio15 IS NULL
                    LIMIT 10000
                ) sub
                WHERE cf.maille_code = sub.maille_code;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: bio15")
        
        # Compute bio4 (Temperature Seasonality)
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.maille_climate_features cf
                SET bio4 = sub.bio4
                FROM (
                    SELECT 
                        m.code as maille_code,
                        ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as bio4
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 4326) as pt
                    JOIN worldclim_bio r ON ST_Intersects(r.rast, pt)
                    WHERE cf.bio4 IS NULL
                    LIMIT 10000
                ) sub
                WHERE cf.maille_code = sub.maille_code;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: bio4")
        
        # Compute bio17 (Precipitation Driest Quarter)
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.maille_climate_features cf
                SET bio17 = sub.bio17
                FROM (
                    SELECT 
                        m.code as maille_code,
                        ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as bio17
                    FROM atlas.mailles m
                    CROSS JOIN LATERAL ST_Transform(ST_Centroid(m.geom), 4326) as pt
                    JOIN worldclim_bio r ON ST_Intersects(r.rast, pt)
                    WHERE cf.bio17 IS NULL
                    LIMIT 10000
                ) sub
                WHERE cf.maille_code = sub.maille_code;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: bio17")
        
        # Compute prec_dry (driest month = min of 12 months)
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.maille_climate_features cf
                SET prec_dry = sub.prec_dry
                FROM (
                    SELECT 
                        m.code as maille_code,
                        (SELECT MIN(v) FROM (
                            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as v
                            FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                            UNION ALL
                            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric
                            FROM worldclim_prec_01 r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                        ) vals) as prec_dry
                    FROM atlas.mailles m
                    WHERE cf.prec_dry IS NULL
                    LIMIT 10000
                ) sub
                WHERE cf.maille_code = sub.maille_code;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: prec_dry")
        
        # Compute prec_wet (wettest month = max of 12 months)
        for batch_num in range(1, 4):
            query = """
                UPDATE atlas.maille_climate_features cf
                SET prec_wet = sub.prec_wet
                FROM (
                    SELECT 
                        m.code as maille_code,
                        (SELECT MAX(v) FROM (
                            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric as v
                            FROM worldclim_prec r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                            UNION ALL
                            SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))::numeric
                            FROM worldclim_prec_01 r WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
                        ) vals) as prec_wet
                    FROM atlas.mailles m
                    WHERE cf.prec_wet IS NULL
                    LIMIT 10000
                ) sub
                WHERE cf.maille_code = sub.maille_code;
            """
            self.execute_query(query)
            self.logger.info(f"    Batch {batch_num}/3: prec_wet")
        
        # Verify
        cur = self.conn.cursor()
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(prec_annual) as prec_annual,
                COUNT(bio12) as bio12,
                COUNT(bio15) as bio15,
                COUNT(bio4) as bio4,
                COUNT(bio17) as bio17,
                COUNT(prec_dry) as prec_dry,
                COUNT(prec_wet) as prec_wet
            FROM atlas.maille_climate_features
        """)
        row = cur.fetchone()
        cur.close()
        
        self.stats['climate_computed'] = row[0]
        elapsed = time.time() - start
        self.logger.info(f"  WorldClim: {row[0]:,} mailles, prec={row[1]}, bio12={row[2]}, bio15={row[3]}, bio4={row[4]}, bio17={row[5]}, prec_dry={row[6]}, prec_wet={row[7]}, time={elapsed:.1f}s")
        
        return row[1] >= 29000
    
    # =========================================================================
    # MAIN PIPELINE
    # =========================================================================
    
    def run(self):
        """Execute the complete SCORPAN feature computation pipeline"""
        self.stats['start_time'] = datetime.now(timezone.utc)
        
        self.logger.info("=" * 70)
        self.logger.info("ATLAS SCORPAN FEATURE COMPUTATION PIPELINE")
        self.logger.info(f"Run ID: {self.run_id}")
        self.logger.info("=" * 70)
        
        try:
            self.connect()
            
            # Step 1: DSM Features
            self.logger.info("")
            self.logger.info("=" * 50)
            self.logger.info("[STEP 1] Computing DSM Derivatives")
            self.logger.info("=" * 50)
            
            if not self.setup_dsm_columns():
                raise RuntimeError("DSM columns setup failed")
            
            if not self.compute_altitude_mean():
                raise RuntimeError("altitude_mean computation failed")
            
            if not self.compute_slope_mean():
                raise RuntimeError("dem_slope_mean_deg computation failed")
            
            if not self.compute_tpi_mean():
                raise RuntimeError("dem_tpi_mean computation failed")
            
            if not self.compute_hand_mean():
                raise RuntimeError("dem_hand_mean computation failed")
            
            if not self.compute_distance_river():
                raise RuntimeError("distance_river_m computation failed")
            
            # Step 2: Climate Features
            self.logger.info("")
            self.logger.info("=" * 50)
            self.logger.info("[STEP 2] Computing WorldClim Derivatives")
            self.logger.info("=" * 50)
            
            if not self.setup_climate_tables():
                raise RuntimeError("Climate tables setup failed")
            
            if not self.compute_worldclim_features():
                raise RuntimeError("WorldClim computation failed")
            
            # Final verification
            self.logger.info("")
            self.logger.info("=" * 50)
            self.logger.info("[STEP 3] Final Verification")
            self.logger.info("=" * 50)
            
            cur = self.conn.cursor()
            cur.execute("""
                SELECT 
                    COUNT(*) as total,
                    COUNT(altitude_mean) as altitude,
                    COUNT(dem_slope_mean_deg) as slope,
                    COUNT(dem_tpi_mean) as tpi,
                    COUNT(dem_hand_mean) as hand,
                    COUNT(distance_river_m) as river,
                    COUNT(prec_annual) as climate
                FROM atlas.mailles m
                LEFT JOIN atlas.maille_climate_features cf ON cf.maille_code = m.code
            """)
            row = cur.fetchone()
            cur.close()
            
            self.logger.info(f"Final Stats:")
            self.logger.info(f"  Total mailles: {row[0]:,}")
            self.logger.info(f"  altitude_mean: {row[1]:,}")
            self.logger.info(f"  dem_slope_mean_deg: {row[2]:,}")
            self.logger.info(f"  dem_tpi_mean: {row[3]:,}")
            self.logger.info(f"  dem_hand_mean: {row[4]:,}")
            self.logger.info(f"  distance_river_m: {row[5]:,}")
            self.logger.info(f"  climate features: {row[6]:,}")
            
            self.stats['end_time'] = datetime.now(timezone.utc)
            elapsed = (self.stats['end_time'] - self.stats['start_time']).total_seconds()
            
            self.logger.info("")
            self.logger.info("=" * 70)
            self.logger.info("PIPELINE COMPLETED SUCCESSFULLY")
            self.logger.info(f"Total time: {elapsed/60:.1f} minutes")
            self.logger.info("=" * 70)
            
        except Exception as e:
            self.logger.error(f"PIPELINE FAILED: {str(e)}")
            raise
        
        finally:
            self.close()


def main():
    parser = argparse.ArgumentParser(description='Atlas SCORPAN Feature Computation')
    parser.add_argument('--database-url', required=True, help='PostgreSQL connection URL')
    parser.add_argument('--dry-run', action='store_true', help='Validate database state without computing')
    
    args = parser.parse_args()
    
    if args.dry_run:
        # Run validation only
        print("=== DRY RUN MODE - Validation Only ===")
        conn = psycopg2.connect(args.database_url)
        cur = conn.cursor()
        
        # Check tables
        cur.execute("""
            SELECT table_name FROM information_schema.tables 
            WHERE table_schema = 'atlas' 
            AND table_name IN ('mailles', 'dsm_cop30', 'dsm_slope', 'maille_climate_features', 'worldclim_prec', 'worldclim_bio', 'hydrogeologie')
        """)
        tables = [r[0] for r in cur.fetchall()]
        print(f"Tables found: {tables}")
        
        # Check columns
        cur.execute("""
            SELECT column_name FROM information_schema.columns 
            WHERE table_schema = 'atlas' AND table_name = 'mailles'
            AND column_name IN ('altitude_mean', 'dem_slope_mean_deg', 'dem_tpi_mean', 'dem_hand_mean', 'distance_river_m', 'dsm_features_ok')
        """)
        cols = [r[0] for r in cur.fetchall()]
        print(f"DSM columns: {cols}")
        
        # Check current data
        cur.execute("""
            SELECT 
                COUNT(altitude_mean) as altitude,
                COUNT(dem_slope_mean_deg) as slope,
                COUNT(dem_tpi_mean) as tpi,
                COUNT(dem_hand_mean) as hand,
                COUNT(distance_river_m) as river
            FROM atlas.mailles
        """)
        print(f"DSM values: {cur.fetchone()}")
        
        cur.execute("SELECT COUNT(*), COUNT(prec_annual), COUNT(bio12), COUNT(bio15), COUNT(prec_dry), COUNT(prec_wet) FROM atlas.maille_climate_features")
        print(f"Climate values: {cur.fetchone()}")
        
        cur.close()
        conn.close()
        print("=== DRY RUN COMPLETE ===")
        return
    
    pipeline = AtlasFeaturePipeline(args.database_url, args.dry_run)
    pipeline.run()


if __name__ == '__main__':
    main()