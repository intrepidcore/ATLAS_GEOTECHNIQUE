"""
Extract WorldClim values from PostGIS rasters using ST_Value.
More efficient than complex SQL subqueries.

Usage:
    python scripts/extract_wc_from_db.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""

import argparse
import psycopg2
from psycopg2.extras import execute_batch

def extract_climate_values(db_url):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("=== Extracting REAL WorldClim from DB rasters ===")

    # Get count
    cur.execute("SELECT COUNT(*) FROM atlas.maille_climate_features")
    total = cur.fetchone()[0]
    print(f"  Total mailles: {total}")

    # Extract precipitation (sum 12 months) via a more efficient query
    print("  Extracting precipitation (annual sum)...")
    cur.execute("""
    UPDATE atlas.maille_climate_features c
    SET prec_annual = sub.prec_sum,
        bio12 = sub.prec_sum
    FROM (
      SELECT m.code,
        COALESCE(p1.val, 0) + COALESCE(p2.val, 0) + COALESCE(p3.val, 0) +
        COALESCE(p4.val, 0) + COALESCE(p5.val, 0) + COALESCE(p6.val, 0) +
        COALESCE(p7.val, 0) + COALESCE(p8.val, 0) + COALESCE(p9.val, 0) +
        COALESCE(p10.val, 0) + COALESCE(p11.val, 0) + COALESCE(p12.val, 0) as prec_sum
      FROM atlas.mailles m
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_01.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p1 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_02.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p2 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_03.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p3 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_04.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p4 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_05.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p5 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_06.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p6 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_07.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p7 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_08.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p8 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_09.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p9 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_10.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p10 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_11.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p11 ON true
      LEFT JOIN LATERAL (
        SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326)) as val
        FROM atlas.worldclim_prec r
        WHERE r.filename = 'wc2.1_2.5m_prec_12.tif'
          AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
        LIMIT 1
      ) p12 ON true
    ) sub
    WHERE c.maille_code = sub.code;
    """)
    print(f"    Precipitation updated: {cur.rowcount}")

    # Extract bio15
    print("  Extracting bio15...")
    cur.execute("""
    UPDATE atlas.maille_climate_features c
    SET bio15 = sub.bio15
    FROM (
      SELECT m.code,
        (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename = 'wc2.1_2.5m_bio_15.tif'
           AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1) as bio15
      FROM atlas.mailles m
    ) sub
    WHERE c.maille_code = sub.code;
    """)
    print(f"    bio15 updated: {cur.rowcount}")

    # Extract bio4
    print("  Extracting bio4...")
    cur.execute("""
    UPDATE atlas.maille_climate_features c
    SET bio4 = sub.bio4
    FROM (
      SELECT m.code,
        (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename = 'wc2.1_2.5m_bio_4.tif'
           AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1) as bio4
      FROM atlas.mailles m
    ) sub
    WHERE c.maille_code = sub.code;
    """)
    print(f"    bio4 updated: {cur.rowcount}")

    # Extract bio17
    print("  Extracting bio17...")
    cur.execute("""
    UPDATE atlas.maille_climate_features c
    SET bio17 = sub.bio17
    FROM (
      SELECT m.code,
        (SELECT ST_Value(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename = 'wc2.1_2.5m_bio_17.tif'
           AND ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1) as bio17
      FROM atlas.mailles m
    ) sub
    WHERE c.maille_code = sub.code;
    """)
    print(f"    bio17 updated: {cur.rowcount}")

    conn.commit()

    # Verify
    cur.execute("""
    SELECT COUNT(*) as total,
           COUNT(prec_annual) as prec_ok,
           ROUND(AVG(prec_annual)::numeric, 0) as moy,
           ROUND(MIN(prec_annual)::numeric, 0) as min_val,
           ROUND(MAX(prec_annual)::numeric, 0) as max_val
    FROM atlas.maille_climate_features
    WHERE prec_annual IS NOT NULL AND prec_annual > 0
    """)
    result = cur.fetchone()
    print(f"\n[OK] Real WorldClim values:")
    print(f"  Total: {result[0]}, Precip OK: {result[1]}")
    print(f"  Moy: {result[2]} mm, Range: {result[3]}-{result[4]} mm")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-url', required=True)
    args = parser.parse_args()
    extract_climate_values(args.database_url)