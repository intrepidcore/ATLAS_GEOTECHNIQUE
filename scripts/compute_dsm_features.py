"""
Compute DSM-derived features for Atlas mailles.
Uses PostGIS raster functions to extract:
- altitude_mean (already done)
- dem_slope_mean_deg (via ST_Slope)
- dem_tpi_mean (via neighbor average)
- dem_hand_mean (via minimum in radius)

Usage:
    python scripts/compute_dsm_features.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""

import argparse
import sys
import math
from datetime import datetime, timezone

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values

def main(db_url: str):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("=== Computing DSM-derived features ===")

    # 1. Calculate slope via ST_Slope on DSM
    print("\n[1/4] Computing slope from DSM...")
    cur.execute("""
    UPDATE atlas.ai_context_features_maille f
    SET dem_slope_mean_deg = sub.slope
    FROM (
      SELECT
        f2.maille_code,
        ST_Value(
          ST_Slope(
            ST_Clip(d.rast, m.geom),
            1, '32BF', 'DEGREES'
          ),
          ST_Transform(ST_Centroid(m.geom), 25231)
        ) AS slope
      FROM atlas.ai_context_features_maille f2
      JOIN atlas.mailles m ON m.code = f2.maille_code
      JOIN LATERAL (
        SELECT rast FROM atlas.dsm_cop30 d
        WHERE ST_Intersects(d.rast, m.geom)
        LIMIT 1
      ) d ON true
      WHERE f2.dem_slope_mean_deg IS NULL
        AND f2.altitude_mean IS NOT NULL
    ) sub
    WHERE f.maille_code = sub.maille_code;
    """)
    conn.commit()
    print(f"  Slope update: {cur.rowcount} rows affected")

    # 2. Calculate TPI (Topographic Position Index)
    # TPI = elevation - mean(neighbors within radius)
    print("\n[2/4] Computing TPI (neighbor average)...")
    cur.execute("""
    UPDATE atlas.ai_context_features_maille f
    SET dem_tpi_mean = sub.tpi
    FROM (
      SELECT
        f1.maille_code,
        f1.altitude_mean - COALESCE(avg_neigh.alt_moy, f1.altitude_mean) AS tpi
      FROM atlas.ai_context_features_maille f1
      LEFT JOIN (
        SELECT
          f2.maille_code,
          AVG(f3.altitude_mean) AS alt_moy
        FROM atlas.ai_context_features_maille f2
        JOIN atlas.mailles m2 ON m2.code = f2.maille_code
        JOIN atlas.mailles m3 ON m3.code != m2.code
        JOIN atlas.ai_context_features_maille f3 ON f3.maille_code = m3.code
        WHERE ST_DWithin(m2.geom, m3.geom, 5000)
          AND f3.altitude_mean IS NOT NULL
        GROUP BY f2.maille_code
      ) avg_neigh ON f1.maille_code = avg_neigh.maille_code
      WHERE f1.altitude_mean IS NOT NULL
        AND f1.dem_tpi_mean IS NULL
    ) sub
    WHERE f.maille_code = sub.maille_code;
    """)
    conn.commit()
    print(f"  TPI update: {cur.rowcount} rows affected")

    # 3. Calculate HAND (Height Above Nearest Drainage)
    # HAND = elevation - min(elevation within 10km)
    print("\n[3/4] Computing HAND (min elevation in 10km radius)...")
    cur.execute("""
    UPDATE atlas.ai_context_features_maille f
    SET dem_hand_mean = sub.hand
    FROM (
      SELECT
        f1.maille_code,
        f1.altitude_mean - COALESCE(min_neigh.alt_min, f1.altitude_mean) AS hand
      FROM atlas.ai_context_features_maille f1
      LEFT JOIN (
        SELECT
          f2.maille_code,
          MIN(f3.altitude_mean) AS alt_min
        FROM atlas.ai_context_features_maille f2
        JOIN atlas.mailles m2 ON m2.code = f2.maille_code
        JOIN atlas.mailles m3 ON m3.code != m2.code
        JOIN atlas.ai_context_features_maille f3 ON f3.maille_code = m3.code
        WHERE ST_DWithin(m2.geom, m3.geom, 10000)
          AND f3.altitude_mean IS NOT NULL
        GROUP BY f2.maille_code
      ) min_neigh ON f1.maille_code = min_neigh.maille_code
      WHERE f1.altitude_mean IS NOT NULL
        AND f1.dem_hand_mean IS NULL
    ) sub
    WHERE f.maille_code = sub.maille_code;
    """)
    conn.commit()
    print(f"  HAND update: {cur.rowcount} rows affected")

    # 4. Verify all features
    print("\n[4/4] Verification...")
    cur.execute("""
    SELECT
      COUNT(*) AS total,
      COUNT(altitude_mean) AS alt_ok,
      COUNT(dem_slope_mean_deg) AS slope_ok,
      COUNT(dem_tpi_mean) AS tpi_ok,
      COUNT(dem_hand_mean) AS hand_ok,
      ROUND(AVG(altitude_mean)::numeric, 1) AS alt_moy,
      ROUND(AVG(dem_slope_mean_deg)::numeric, 2) AS slope_moy,
      ROUND(AVG(dem_tpi_mean)::numeric, 2) AS tpi_moy,
      ROUND(AVG(dem_hand_mean)::numeric, 2) AS hand_moy
    FROM atlas.ai_context_features_maille;
    """)
    result = cur.fetchone()
    print(f"\n✅ DSM Features computed:")
    print(f"   Total mailles: {result[0]}")
    print(f"   altitude_mean: {result[1]} ({result[1]/result[0]*100:.1f}%)")
    print(f"   dem_slope_mean_deg: {result[2]} ({result[2]/result[0]*100:.1f}%)")
    print(f"   dem_tpi_mean: {result[3]} ({result[3]/result[0]*100:.1f}%)")
    print(f"   dem_hand_mean: {result[4]} ({result[4]/result[0]*100:.1f}%)")
    print(f"\n   Moyennes: alt={result[5]}m, slope={result[6]}°, tpi={result[7]}, hand={result[8]}")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Compute DSM features')
    parser.add_argument('--database-url', required=True)
    args = parser.parse_args()
    main(args.database_url)