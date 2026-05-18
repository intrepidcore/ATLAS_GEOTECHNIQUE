"""
Extract WorldClim values by maille centroids.
Creates maille_climate_features table with precipitation and bioclimatic variables.

Usage:
    python scripts/compute_climate_features.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""

import argparse
import sys
import os
from datetime import datetime, timezone

import numpy as np
import psycopg2

def main(db_url: str):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("=== Creating maille_climate_features table ===")

    # Create table
    cur.execute("""
    CREATE TABLE IF NOT EXISTS atlas.maille_climate_features (
      maille_code TEXT PRIMARY KEY,
      prec_annual DOUBLE PRECISION,
      prec_dry DOUBLE PRECISION,
      prec_wet DOUBLE PRECISION,
      bio12 DOUBLE PRECISION,
      bio15 DOUBLE PRECISION,
      bio4 DOUBLE PRECISION,
      bio17 DOUBLE PRECISION,
      updated_at TIMESTAMPTZ DEFAULT now()
    );
    """)
    conn.commit()

    # Load WorldClim files as rasters if not exists
    prec_dir = "C:\\PROJET_ATLAS_MASTER\\atlas_reclone\\data\\word-clim\\prec"
    bio_dir = "C:\\PROJET_ATLAS_MASTER\\atlas_reclone\\data\\word-clim\\bio"

    # Check if tables exist
    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'worldclim_prec'")
    if cur.fetchone()[0] == 0:
        print("Loading precipitation rasters...")
        # Load each file
        for i in range(1, 13):
            f = f"{prec_dir}\\wc2.1_2.5m_prec_{i:02d}.tif"
            if os.path.exists(f):
                cur.execute(f"""
                INSERT INTO atlas.worldclim_prec (rast, filename)
                SELECT ST_FromGDAL(rast), filename FROM ST_FromGDAL(%s) AS rast, (SELECT %s AS filename) AS f
                """, (f, f"wc2.1_2.5m_prec_{i:02d}.tif"))
        conn.commit()

    cur.execute("SELECT COUNT(*) FROM information_schema.tables WHERE table_name = 'worldclim_bio'")
    if cur.fetchone()[0] == 0:
        print("Loading bioclimatic rasters...")
        for i in range(1, 20):
            f = f"{bio_dir}\\wc2.1_2.5m_bio_{i}.tif"
            if os.path.exists(f):
                cur.execute(f"""
                INSERT INTO atlas.worldclim_bio (rast, filename)
                SELECT ST_FromGDAL(rast), filename FROM ST_FromGDAL(%s) AS rast, (SELECT %s AS filename) AS f
                """, (f, f"wc2.1_2.5m_bio_{i}.tif"))
        conn.commit()

    print("Extracting climate values by maille centroids...")

    # Extract values for each maille
    cur.execute("""
    INSERT INTO atlas.maille_climate_features (
      maille_code, prec_annual, bio12, bio15, bio4, bio17
    )
    SELECT
      m.code,
      (SELECT AVG(ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)))
       FROM atlas.worldclim_prec r
       WHERE ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
      ) as prec_annual,
      (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       FROM atlas.worldclim_bio r
       WHERE r.filename = 'wc2.1_2.5m_bio_12.tif'
         AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       LIMIT 1) as bio12,
      (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       FROM atlas.worldclim_bio r
       WHERE r.filename = 'wc2.1_2.5m_bio_15.tif'
         AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       LIMIT 1) as bio15,
      (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       FROM atlas.worldclim_bio r
       WHERE r.filename = 'wc2.1_2.5m_bio_4.tif'
         AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       LIMIT 1) as bio4,
      (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       FROM atlas.worldclim_bio r
       WHERE r.filename = 'wc2.1_2.5m_bio_17.tif'
         AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
       LIMIT 1) as bio17
    FROM atlas.mailles m
    ON CONFLICT (maille_code) DO NOTHING;
    """)
    conn.commit()

    # Verify
    cur.execute("""
    SELECT
      COUNT(*) as total,
      COUNT(prec_annual) as prec_ok,
      ROUND(AVG(prec_annual)::numeric, 0) as prec_moy,
      ROUND(MIN(prec_annual)::numeric, 0) as prec_min,
      ROUND(MAX(prec_annual)::numeric, 0) as prec_max,
      ROUND(AVG(bio15)::numeric, 1) as bio15_moy
    FROM atlas.maille_climate_features
    WHERE prec_annual IS NOT NULL;
    """)
    result = cur.fetchone()
    print(f"\n✅ Climate features extracted:")
    print(f"   Total mailles: {result[0]}")
    print(f"   Precip OK: {result[1]} ({result[1]/result[0]*100:.1f}%)")
    print(f"   Precip moy: {result[2]} mm/an")
    print(f"   Precip range: {result[3]}-{result[4]} mm/an")
    print(f"   Bio15 (seasonality) moy: {result[5]}")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-url', required=True)
    args = parser.parse_args()
    main(args.database_url)