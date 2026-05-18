"""
Extract REAL WorldClim values using rasterio (not PostGIS).
Uses actual .tif files as source, computes values per maille centroid.

Usage:
    python scripts/compute_worldclim_real.py --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""

import argparse
import sys
import numpy as np
import psycopg2
import rasterio
from rasterio.warp import transform
import os

def get_centroids(conn):
    """Get maille centroids in WGS84 (EPSG:4326)"""
    cur = conn.cursor()
    cur.execute("""
    SELECT m.code,
           ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) as lon,
           ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) as lat
    FROM atlas.mailles m
    """)
    return {row[0]: (row[1], row[2]) for row in cur.fetchall()}

def extract_worldclim_values(centroids, prec_dir, bio_dir):
    """Extract values from WorldClim .tif files for each centroid"""
    results = {}

    # Precipitation files (monthly)
    prec_files = sorted([f for f in os.listdir(prec_dir) if f.endswith('.tif') and 'prec' in f])
    bio_files = sorted([f for f in os.listdir(bio_dir) if f.endswith('.tif') and 'bio' in f])

    print(f"Found {len(prec_files)} precipitation files, {len(bio_files)} bio files")

    # Process precipitation - compute annual sum
    print("Processing precipitation...")
    annual_prec = {}
    for code, (lon, lat) in centroids.items():
        total_prec = 0
        valid = True
        for pf in prec_files:
            try:
                with rasterio.open(os.path.join(prec_dir, pf)) as src:
                    # Transform coordinates
                    xs, ys = transform([4326], [src.crs], [lon], [lat])
                    row, col = src.index(xs[0], ys[0])
                    val = src.read(1)[row, col]
                    if val < 0 or val > 10000:  # invalid
                        valid = False
                        break
                    total_prec += val
            except:
                valid = False
                break
        if valid:
            annual_prec[code] = total_prec

    print(f"  Annual precip computed for {len(annual_prec)} mailles")

    # Process BIO variables (12 = annual precip, 15 = seasonality, 4 = temp seasonality, 17 = driest quarter)
    bio_vars = {12: 'bio12', 15: 'bio15', 4: 'bio4', 17: 'bio17'}
    bio_results = {code: {} for code in centroids.keys()}

    for bio_num, bio_name in bio_vars.items():
        print(f"Processing {bio_name}...")
        bf = [f for f in bio_files if f'bio_{bio_num}' in f]
        if not bf:
            print(f"  Warning: bio_{bio_num} file not found")
            continue

        with rasterio.open(os.path.join(bio_dir, bf[0])) as src:
            for code, (lon, lat) in centroids.items():
                try:
                    xs, ys = transform([4326], [src.crs], [lon], [lat])
                    row, col = src.index(xs[0], ys[0])
                    val = src.read(1)[row, col]
                    if 0 <= val <= 10000:
                        bio_results[code][bio_name] = float(val)
                except:
                    pass

    print(f"  Bio vars computed for {len([k for k,v in bio_results.items() if v])} mailles")

    # Combine results
    for code in centroids.keys():
        if code in annual_prec:
            results[code] = {
                'prec_annual': annual_prec[code],
                'bio12': annual_prec[code],  # bio12 = annual precip
                'bio15': bio_results[code].get('bio15'),
                'bio4': bio_results[code].get('bio4'),
                'bio17': bio_results[code].get('bio17'),
            }

    return results

def update_database(conn, climate_data):
    """Update maille_climate_features with real values"""
    cur = conn.cursor()
    updated = 0

    for code, data in climate_data.items():
        cur.execute("""
        UPDATE atlas.maille_climate_features
        SET prec_annual = %s, bio12 = %s, bio15 = %s, bio4 = %s, bio17 = %s
        WHERE maille_code = %s
        """, (data['prec_annual'], data['bio12'],
              data.get('bio15'), data.get('bio4'), data.get('bio17'), code))
        if cur.rowcount > 0:
            updated += 1

    conn.commit()
    print(f"Updated {updated} mailles with real WorldClim data")
    return updated

def main(db_url):
    conn = psycopg2.connect(db_url)

    print("=== Computing REAL WorldClim values (from .tif files) ===")

    prec_dir = "C:\\PROJET_ATLAS_MASTER\\atlas_reclone\\data\\word-clim\\prec"
    bio_dir = "C:\\PROJET_ATLAS_MASTER\\atlas_reclone\\data\\word-clim\\bio"

    print("Loading centroids...")
    centroids = get_centroids(conn)
    print(f"  {len(centroids)} mailles")

    print("Extracting WorldClim values...")
    climate_data = extract_worldclim_values(centroids, prec_dir, bio_dir)

    print("Updating database...")
    update_database(conn, climate_data)

    # Verify
    cur = conn.cursor()
    cur.execute("""
    SELECT COUNT(*) as total, ROUND(AVG(prec_annual)::numeric, 0) as moy,
           ROUND(MIN(prec_annual)::numeric, 0) as min_val,
           ROUND(MAX(prec_annual)::numeric, 0) as max_val
    FROM atlas.maille_climate_features WHERE prec_annual IS NOT NULL
    """)
    result = cur.fetchone()
    print(f"\n[OK] Real WorldClim data:")
    print(f"  Total: {result[0]}, Moy: {result[1]} mm, Range: {result[2]}-{result[3]} mm")

    conn.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--database-url', required=True)
    args = parser.parse_args()
    main(args.database_url)