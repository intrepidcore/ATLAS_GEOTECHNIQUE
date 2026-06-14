#!/usr/bin/env python3
"""Export WDPA OKM (Oti-Kéran-Mandouri) complet depuis GEE et ajuste les seuils de délimitation."""
import ee, json, os, rasterio, numpy as np, geopandas as gpd
from shapely.geometry import shape
from shapely.ops import unary_union
from rasterio.features import shapes, rasterize

ee.Initialize(project='gen-lang-client-0964618990')

togo = ee.Geometry.Rectangle([0.0, 6.0, 1.9, 11.2])
wdpa = ee.FeatureCollection('WCMC/WDPA/current/polygons').filterBounds(togo)

# Télécharger OKM complet = Parc national de la Kéran + Oti-Mandouri
fc_okm = wdpa.filter(ee.Filter.inList('NAME', ['Parc national de la Keran', 'Oti-Mandouri']))
info_okm = fc_okm.getInfo()
print("OKM polygones:", len(info_okm['features']))
for f in info_okm['features']:
    p = f.get('properties', {})
    print("  -", p.get('NAME','?'), ":", p.get('GIS_AREA','?'), "km2")

os.makedirs('data/raw/wdpa', exist_ok=True)
with open('data/raw/wdpa/oti_keran_mandouri_wdpa.geojson', 'w', encoding='utf-8') as f:
    json.dump(info_okm, f, ensure_ascii=False)
print("OKM sauvegardé -> data/raw/wdpa/oti_keran_mandouri_wdpa.geojson")

# Analyser altitude dans zone OKM
print("\n=== Analyse altitude OKM ===")
dem_path = "data/raw/copernicus_dem/dem_oti_30m.tif"
wdpa_gdf = gpd.read_file('data/raw/wdpa/oti_keran_mandouri_wdpa.geojson').to_crs('EPSG:4326')
print("OKM bbox:", wdpa_gdf.total_bounds)

with rasterio.open(dem_path) as src:
    wdpa_mask = rasterize(
        [(geom, 1) for geom in wdpa_gdf.geometry],
        out_shape=(src.height, src.width),
        transform=src.transform,
        fill=0,
        dtype=np.uint8,
    )
    dem = src.read(1).astype(np.float32)
    nodata = src.nodata
    if nodata:
        dem[dem == nodata] = np.nan

dem_okm = dem.copy()
dem_okm[wdpa_mask == 0] = np.nan

valid = dem_okm[~np.isnan(dem_okm)]
print("Altitude dans OKM :")
for pct in [5, 10, 25, 50, 75, 90, 95]:
    print("  p%02d = %.0f m" % (pct, np.percentile(valid, pct)))

for thresh in [110, 120, 130, 140, 150, 160]:
    n = (dem_okm < thresh).sum()
    km2 = n * 900 / 1e6
    print("  Alt < %dm dans OKM : %.0f km2" % (thresh, km2))

# Analyser altitude dans zone FOSSE aux LIONS
print("\n=== Analyse altitude FOSSE AUX LIONS ===")
wdpa_fosse = gpd.read_file('data/raw/wdpa/fosse_lions_wdpa.geojson').to_crs('EPSG:4326')
dem_fosse_path = "data/raw/copernicus_dem/dem_fosse_lions_30m.tif"
with rasterio.open(dem_fosse_path) as src:
    wdpa_f_mask = rasterize(
        [(geom, 1) for geom in wdpa_fosse.geometry],
        out_shape=(src.height, src.width),
        transform=src.transform,
        fill=0,
        dtype=np.uint8,
    )
    dem_f = src.read(1).astype(np.float32)

dem_fosse = dem_f.copy()
dem_fosse[wdpa_f_mask == 0] = np.nan
valid_f = dem_fosse[~np.isnan(dem_fosse)]
print("Altitude dans réserve Fosse (%.1f km2):" % (valid_f.size * 900 / 1e6))
for pct in [5, 10, 15, 20, 25, 50]:
    print("  p%02d = %.0f m" % (pct, np.percentile(valid_f, pct)))

# Surfaces attendues par percentile
total_px = valid_f.size
for pct in [10, 15, 20, 25, 30]:
    n_px = int(total_px * pct / 100)
    km2 = n_px * 900 / 1e6
    print("  p%d zone basse (%.0f km2)" % (pct, km2))
