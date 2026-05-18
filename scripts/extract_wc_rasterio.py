"""
Extract WorldClim values directly from .tif files using rasterio.
More reliable than PostGIS raster when columns are missing.

Usage:
    python scripts/extract_wc_rasterio.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""

import argparse
import os
import numpy as np
import psycopg2
from rasterio.warp import transform as warp_transform
from rasterio.features import bounds
import rasterio

def main(db_url):
    conn = psycopg2.connect(db_url)
    cur = conn.cursor()

    print("=== Extracting REAL WorldClim values from .tif files ===")

    # Get maille centroids
    print("Loading maille centroids...")
    cur.execute("""
    SELECT m.code,
           ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) as lon,
           ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) as lat
    FROM atlas.mailles m
    """)
    centroids = {row[0]: (row[1], row[2]) for row in cur.fetchall()}
    print(f"  {len(centroids)} mailles loaded")

    prec_dir = "C:\\PROJET_ATLAS_MASTER\\atlas_reclone\\data\\word-clim\\prec"
    bio_dir = "C:\\PROJET_ATLAS_MASTER\\atlas_reclone\\data\\word-clim\\bio"

    # Process precipitation - get annual sum
    print("Processing precipitation (annual sum)...")
    prec_files = sorted([f for f in os.listdir(prec_dir) if f.endswith('.tif')])
    print(f"  Found {len(prec_files)} files")

    prec_data = {}
    batch_size = 1000
    codes = list(centroids.keys())

    for i in range(0, len(codes), batch_size):
        batch = codes[i:i+batch_size]
        for code in batch:
            lon, lat = centroids[code]
            total = 0
            valid = True
            for pf in prec_files:
                try:
                    with rasterio.open(os.path.join(prec_dir, pf)) as src:
                        # Convert WGS84 to raster CRS
                        xs, ys = warp_transform([4326], [src.crs], [lon], [lat])
                        row, col = src.index(xs[0], ys[0])
                        if 0 <= row < src.height and 0 <= col < src.width:
                            val = src.read(1)[row, col]
                            if val > 0 and val < 10000:
                                total += val
                            else:
                                valid = False
                                break
                        else:
                            valid = False
                            break
                except Exception:
                    valid = False
                    break
            if valid and total > 0:
                prec_data[code] = total

        if (i + batch_size) % 5000 == 0:
            print(f"    Processed {i + batch_size}/{len(codes)} mailles")

    print(f"  Precipitation extracted for {len(prec_data)} mailles")

    # Process bio variables
    bio_vars = {'bio_12.tif': 'bio12', 'bio_15.tif': 'bio15', 'bio_4.tif': 'bio4', 'bio_17.tif': 'bio17'}

    for bio_file, bio_name in bio_vars.items():
        print(f"Processing {bio_name}...")
        bio_path = os.path.join(bio_dir, bio_file)

        if not os.path.exists(bio_path):
            # Try to find the file
            matching = [f for f in os.listdir(bio_dir) if 'bio_' in f.lower() and bio_file.split('_')[1].split('.')[0] in f]
            if matching:
                bio_path = os.path.join(bio_dir, matching[0])
            else:
                print(f"  Warning: {bio_file} not found, skipping")
                continue

        print(f"  Reading {os.path.basename(bio_path)}...")
        with rasterio.open(bio_path) as src:
            for i, code in enumerate(codes):
                lon, lat = centroids[code]
                try:
                    xs, ys = warp_transform([4326], [src.crs], [lon], [lat])
                    row, col = src.index(xs[0], ys[0])
                    if 0 <= row < src.height and 0 <= col < src.width:
                        val = src.read(1)[row, col]
                        if val > 0 and val < 10000:
                            cur.execute(f"""
                            UPDATE atlas.maille_climate_features
                            SET {bio_name} = %s
                            WHERE maille_code = %s
                            """, (float(val), code))
                except:
                    pass

                if (i + 1) % 5000 == 0:
                    print(f"    Processed {i+1}/{len(codes)}")
                    conn.commit()

        print(f"  Updated {bio_name}")

    # Update precipitation
    print("Updating precipitation values...")
    for code, val in prec_data.items():
        cur.execute("""
        UPDATE atlas.maille_climate_features
        SET prec_annual = %s, bio12 = %s
        WHERE maille_code = %s
        """, (val, val, code))

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
    main(args.database_url)