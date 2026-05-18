"""
Create climate features using empirical models based on latitude.
For Togo: precip ~ 800mm (North) to 1600mm (South), seasonality ~80.

Usage:
    python scripts/create_climate_simple.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""

import argparse
import psycopg2

def main(db_url: str):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("=== Creating climate features (empirical model) ===")

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

    # Insert using empirical model based on latitude
    # Togo: latitude ~6-11°N, precip ~800-1600mm
    # bio15 (precipitation seasonality): ~60-100 (high seasonality)
    cur.execute("""
    INSERT INTO atlas.maille_climate_features (
      maille_code, prec_annual, bio12, bio15, bio4, bio17
    )
    SELECT
      m.code,
      -- Precip annual: 800 + 100*(11-lat) -> Nord: ~800, Sud: ~1400
      ROUND((800 + 100 * (11 - ST_Y(ST_Transform(ST_Centroid(m.geom), 4326))))::numeric, 0)::double precision,
      -- Same as prec_annual (bio12 = annual precip)
      ROUND((800 + 100 * (11 - ST_Y(ST_Transform(ST_Centroid(m.geom), 4326))))::numeric, 0)::double precision,
      -- bio15 (seasonality): ~70-90 (higher in North)
      ROUND((70 + 20 * (11 - ST_Y(ST_Transform(ST_Centroid(m.geom), 4326))) / 5)::numeric, 1)::double precision,
      -- bio4 (temp seasonality): ~50-70 (low in tropics)
      ROUND((55 + 15 * (ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) - 6) / 5)::numeric, 1)::double precision,
      -- bio17 (driest quarter precip): ~50-150mm
      ROUND((50 + 100 * (11 - ST_Y(ST_Transform(ST_Centroid(m.geom), 4326))) / 5)::numeric, 0)::double precision
    FROM atlas.mailles m
    WHERE m.code NOT IN (SELECT maille_code FROM atlas.maille_climate_features)
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
    FROM atlas.maille_climate_features;
    """)
    result = cur.fetchone()
    print(f"\n[OK] Climate features created:")
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