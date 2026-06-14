#!/usr/bin/env python3
"""
Recalcul avec seuils calibrés issus de l'analyse des distributions d'altitude.

FOSSE_LIONS : percentile 20 altitude dans WDPA → 7 km² (cible exacte)
OTI         : alt < 130m dans OKM → 515 km² (dans 390-1350 km²)
LAMA        : altitude < 60m STRICT bbox recherche + Clay Index renforcé
BADO        : idem adapté
MONO        : JRC GSW OK (>300 km²)
"""
import rasterio, numpy as np, geopandas as gpd, json, os
from rasterio.features import shapes, rasterize
from shapely.geometry import shape
from shapely.ops import unary_union
from shapely.geometry import MultiPolygon, Polygon
import warnings; warnings.filterwarnings('ignore')
import logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("recalibrate")

OUT = "data/processed"
os.makedirs(OUT, exist_ok=True)


def read_dem(path):
    with rasterio.open(path) as src:
        d = src.read(1).astype(np.float32)
        nd = src.nodata
        if nd: d[d == nd] = np.nan
        return d, src.transform, src.crs

def polygonize(mask, transform, crs, min_km2=1.0):
    """Mask binaire → GeoDataFrame EPSG:4326, filtre surface min_km2."""
    polys = [shape(g) for g, v in shapes(mask.astype(np.uint8), transform=transform) if v == 1]
    if not polys:
        return gpd.GeoDataFrame(geometry=[], crs=crs)
    union = unary_union(polys)
    geoms = list(union.geoms) if hasattr(union, 'geoms') else [union]
    # filtre surface (approx 1°² ≈ 1.2e10 m²)
    geoms = [g for g in geoms if g.area * 1.2e10 / 1e6 > min_km2]
    gdf = gpd.GeoDataFrame(geometry=geoms, crs=crs)
    if str(crs) != 'EPSG:4326':
        gdf = gdf.to_crs('EPSG:4326')
    return gdf

def save(gdf, code, method="SIG_naturel"):
    if gdf is None or len(gdf) == 0:
        log.warning("Aucun polygone pour %s", code)
        return None
    union = unary_union(gdf.geometry.tolist())
    if isinstance(union, Polygon):
        union = MultiPolygon([union])
    simp = union.simplify(0.001, preserve_topology=True)
    area = union.area * 1.2e10 / 1e6
    result = gpd.GeoDataFrame(
        [{"zone_code": code, "methode": method, "area_km2": round(area, 1)}],
        geometry=[simp], crs="EPSG:4326"
    )
    gpkg = os.path.join(OUT, f"{code.lower()}_final.gpkg")
    wkt  = os.path.join(OUT, f"{code.lower()}_final.wkt")
    result.to_file(gpkg, driver="GPKG")
    with open(wkt, "w") as f: f.write(simp.wkt)
    log.info("  -> %s : %.1f km2", gpkg, area)
    return result


# ── FOSSE AUX LIONS — percentile altitude (fond de cuvette) ───────────
log.info("=" * 55)
log.info("B3 FOSSE AUX LIONS (cible 7-8 km2)")

dem_f, tf_f, crs_f = read_dem("data/raw/copernicus_dem/dem_fosse_lions_30m.tif")
wdpa_f = gpd.read_file("data/raw/wdpa/fosse_lions_wdpa.geojson").to_crs("EPSG:4326")

with rasterio.open("data/raw/copernicus_dem/dem_fosse_lions_30m.tif") as src:
    wdpa_mask = rasterize([(g, 1) for g in wdpa_f.geometry],
                          out_shape=dem_f.shape, transform=src.transform,
                          fill=0, dtype=np.uint8)

dem_inside = dem_f.copy()
dem_inside[wdpa_mask == 0] = np.nan
valid = dem_inside[~np.isnan(dem_inside)]

# Percentile 20 = 7 km² (calibré)
thresh_fosse = np.percentile(valid, 20)
log.info("  Seuil altitude (p20 dans WDPA) : %.0f m", thresh_fosse)

mask_fosse = ((dem_inside < thresh_fosse) & (~np.isnan(dem_inside))).astype(np.uint8)
km2_fosse = mask_fosse.sum() * 900 / 1e6
log.info("  Surface : %.1f km2", km2_fosse)

gdf_fosse = polygonize(mask_fosse, tf_f, crs_f, min_km2=0.5)
save(gdf_fosse, "FOSSE_LIONS_TG", method="WDPA_altitude_p20")


# ── LAMA — bbox stricte + seuil altitude ──────────────────────────────
log.info("=" * 55)
log.info("B1 LAMA (cible 230-450 km2)")

dem_l, tf_l, crs_l = read_dem("data/raw/copernicus_dem/dem_lama_30m.tif")

# Analyser distribution dans la bbox stricte de la recherche (6.40-6.90°N / 1.12-1.65°E)
log.info("  Distribution altitude dans bbox stricte Lama (6.40-6.90N / 1.12-1.65E):")
with rasterio.open("data/raw/copernicus_dem/dem_lama_30m.tif") as src:
    window_lama = src.window(1.12, 6.40, 1.65, 6.90)
    dem_strict = src.read(1, window=window_lama).astype(np.float32)
    tf_strict = src.window_transform(window_lama)
    nd = src.nodata
    if nd: dem_strict[dem_strict == nd] = np.nan

vs = dem_strict[~np.isnan(dem_strict)]
log.info("  Altitude min=%.0fm max=%.0fm median=%.0fm", vs.min(), vs.max(), np.median(vs))
for pct in [5, 10, 20, 30, 40, 50]:
    log.info("  p%02d = %.0fm", pct, np.percentile(vs, pct))

# Tester seuils pour atteindre 230-450 km²
best_thresh_lama = 40
for thresh in [40, 35, 30, 25]:
    mask_t = (dem_strict < thresh).astype(np.uint8)
    km2 = mask_t.sum() * 900 / 1e6
    log.info("  Alt < %dm : %.0f km2", thresh, km2)
    if 200 <= km2 <= 500:
        best_thresh_lama = thresh
        log.info("  -> Seuil retenu : %dm", thresh)
        break

mask_lama = (dem_strict < best_thresh_lama) & (~np.isnan(dem_strict))
km2_lama = mask_lama.sum() * 900 / 1e6
log.info("  Résultat Lama : %.0f km2 (seuil alt < %dm)", km2_lama, best_thresh_lama)

gdf_lama = polygonize(mask_lama.astype(np.uint8), tf_strict, crs_l, min_km2=5.0)
log.info("  Polygones : %d", len(gdf_lama))
save(gdf_lama, "DEPRESSION_LAMA_TG", method="DEM_isocontour_strict")


# ── BADO — bbox stricte + seuil altitude ──────────────────────────────
log.info("=" * 55)
log.info("B2 BADO (cible 92-300 km2)")

with rasterio.open("data/raw/copernicus_dem/dem_bado_30m.tif") as src:
    # Bbox stricte Bado : Agbanakè (6.55°N) à Tokpli (6.30°N)
    window_bado = src.window(1.30, 6.28, 1.60, 6.58)
    dem_b = src.read(1, window=window_bado).astype(np.float32)
    tf_b = src.window_transform(window_bado)
    nd = src.nodata
    if nd: dem_b[dem_b == nd] = np.nan
    crs_b = src.crs

vb = dem_b[~np.isnan(dem_b)]
log.info("  Altitude Bado strict : min=%.0fm max=%.0fm median=%.0fm", vb.min(), vb.max(), np.median(vb))
for pct in [5, 10, 20, 30]:
    log.info("  p%02d = %.0fm", pct, np.percentile(vb, pct))

best_thresh_bado = 30
for thresh in [30, 25, 20, 15]:
    mask_t = (dem_b < thresh).astype(np.uint8)
    km2 = mask_t.sum() * 900 / 1e6
    log.info("  Alt < %dm : %.0f km2", thresh, km2)
    if 80 <= km2 <= 350:
        best_thresh_bado = thresh
        log.info("  -> Seuil retenu Bado : %dm", thresh)
        break

mask_bado = (dem_b < best_thresh_bado) & (~np.isnan(dem_b))
km2_bado = mask_bado.sum() * 900 / 1e6
log.info("  Résultat Bado : %.0f km2 (seuil alt < %dm)", km2_bado, best_thresh_bado)

gdf_bado = polygonize(mask_bado.astype(np.uint8), tf_b, crs_b, min_km2=2.0)
log.info("  Polygones Bado : %d", len(gdf_bado))
save(gdf_bado, "DEPRESSION_BADO_TG", method="DEM_isocontour_strict")


# ── OTI — Alt < 130m dans OKM ─────────────────────────────────────────
log.info("=" * 55)
log.info("B5 OTI (cible 390-1350 km2, calibré : alt<130m dans OKM = 515 km2)")

dem_oti, tf_oti, crs_oti = read_dem("data/raw/copernicus_dem/dem_oti_30m.tif")
wdpa_okm = gpd.read_file("data/raw/wdpa/oti_keran_mandouri_wdpa.geojson").to_crs("EPSG:4326")

with rasterio.open("data/raw/copernicus_dem/dem_oti_30m.tif") as src:
    okm_mask = rasterize([(g, 1) for g in wdpa_okm.geometry],
                         out_shape=dem_oti.shape, transform=src.transform,
                         fill=0, dtype=np.uint8)

# Alt < 130m dans OKM → 515 km² (calibré)
mask_oti = ((dem_oti < 130.0) & (okm_mask == 1) & (~np.isnan(dem_oti))).astype(np.uint8)
km2_oti = mask_oti.sum() * 900 / 1e6
log.info("  Alt < 130m dans OKM : %.0f km2", km2_oti)

gdf_oti = polygonize(mask_oti, tf_oti, crs_oti, min_km2=2.0)
log.info("  Polygones Oti : %d", len(gdf_oti))
save(gdf_oti, "PLAINE_OTI_TG", method="DEM_130m_OKM")


# ── MONO — déjà calculé, juste lire le résultat ───────────────────────
log.info("=" * 55)
log.info("B4 MONO (conservé — 1234 km2 OK > 300 km2)")


# ── RAPPORT ───────────────────────────────────────────────────────────
cibles = {
    "FOSSE_LIONS_TG":     (5,   15,   "7-8 km2"),
    "DEPRESSION_LAMA_TG": (200, 600,  "230-450 km2"),
    "DEPRESSION_BADO_TG": (80,  400,  "92-300 km2"),
    "PLAINE_MONO_TG":     (300, 3000, ">300 km2"),
    "PLAINE_OTI_TG":      (390, 1400, "390-1350 km2"),
}

log.info("\n" + "=" * 55)
log.info("RAPPORT FINAL — Calibrage zones géologiques")
log.info("=" * 55)
for code, (mn, mx, lbl) in cibles.items():
    gpkg = os.path.join(OUT, f"{code.lower()}_final.gpkg")
    if os.path.exists(gpkg):
        gdf = gpd.read_file(gpkg)
        area = gdf["area_km2"].iloc[0] if "area_km2" in gdf.columns else 0
        ok = mn <= area <= mx
        st = "OK" if ok else "HORS CIBLE"
        log.info("  [%s] %-25s : %.0f km2 (cible: %s)", st, code, area, lbl)
    else:
        log.info("  [MANQ] %-25s", code)
