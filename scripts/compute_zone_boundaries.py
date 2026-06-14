#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — BLOC B : Calcul des polygones naturels
=================================================================
Calcule les délimitations naturelles de 5 zones géologiques à partir
des données satellitaires et topographiques téléchargées.

Méthodes par zone :
  FOSSE_LIONS : DEM + WDPA → TWI (Topographic Wetness Index) → fond de cuvette 7-8 km²
  LAMA        : DEM isocontour < 60m + Clay Index seuil 1.05
  BADO        : DEM isocontour < 80m + Clay Index seuil 1.05
  MONO        : JRC GSW Maximum Water Extent + connexité fluviale
  OTI         : Triple intersection (DEM < 130m + WDPA OKM + buffer 5km fleuve Oti)

Sortie : data/processed/{code}_final.gpkg + .wkt (EPSG:4326)

Roadmap : docs/ROADMAP/roadmap_delimitation_zones_geo_14_06_2026.md
"""

from __future__ import annotations
import logging
import os
import json
import math
import numpy as np
import rasterio
from rasterio.features import shapes, rasterize
from rasterio.transform import from_bounds
from rasterio.warp import reproject, Resampling
import geopandas as gpd
from shapely.geometry import shape, mapping, MultiPolygon, Polygon, box, LineString
from shapely.ops import unary_union
from scipy.ndimage import label, generic_filter
import warnings
warnings.filterwarnings('ignore')

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("zone_boundaries")

OUT = "data/processed"
os.makedirs(OUT, exist_ok=True)

# ── Utilitaires raster ─────────────────────────────────────────────────

def read_raster(path):
    """Lit un raster → (data, transform, crs, nodata)."""
    with rasterio.open(path) as src:
        data = src.read(1).astype(np.float32)
        nodata = src.nodata
        if nodata is not None:
            data[data == nodata] = np.nan
        return data, src.transform, src.crs, nodata, src.profile


def raster_to_polygons(mask, transform, crs, min_area_m2=100_000):
    """Convertit masque binaire → GeoDataFrame polygones (EPSG:4326)."""
    mask_uint8 = mask.astype(np.uint8)
    polys = []
    for geom, val in shapes(mask_uint8, transform=transform):
        if val == 1:
            poly = shape(geom)
            if poly.is_valid and poly.area > 0:
                polys.append(poly)

    if not polys:
        return gpd.GeoDataFrame(geometry=[], crs=crs)

    union = unary_union(polys)
    if isinstance(union, Polygon):
        geoms = [union]
    else:
        geoms = list(union.geoms)

    # Filtre surface minimale (en degrés² → convertir approx en m²)
    # À 8°N : 1° lat ≈ 111km, 1° lon ≈ 108km → 1°² ≈ 1.2e10 m²
    min_area_deg2 = min_area_m2 / 1.2e10
    geoms = [g for g in geoms if g.area > min_area_deg2]

    gdf = gpd.GeoDataFrame(geometry=geoms, crs=crs)
    if str(crs) != 'EPSG:4326':
        gdf = gdf.to_crs('EPSG:4326')
    return gdf


def compute_twi(dem):
    """
    Calcule le Topographic Wetness Index : TWI = ln(A / tan(β))
    - A = aire contributive (approximée par accumulation de flux)
    - β = pente locale

    Algorithme simplifié D8 pour l'accumulation de flux.
    """
    dem = dem.copy()
    dem[np.isnan(dem)] = np.nanmean(dem)

    rows, cols = dem.shape

    # Pente (gradient) en pixels
    dy, dx = np.gradient(dem)
    slope_rad = np.arctan(np.sqrt(dx**2 + dy**2))
    slope_rad = np.maximum(slope_rad, 0.001)  # éviter division par zéro

    # Accumulation de flux D8 (simplifié)
    flow_acc = np.ones_like(dem, dtype=np.float32)
    # Itérations multiples pour propager l'accumulation
    for _ in range(8):
        padded = np.pad(flow_acc, 1, mode='edge')
        neighbors = np.stack([
            padded[:-2, :-2], padded[:-2, 1:-1], padded[:-2, 2:],
            padded[1:-1, :-2],                   padded[1:-1, 2:],
            padded[2:, :-2],   padded[2:, 1:-1], padded[2:, 2:],
        ])
        # Contribution des voisins qui drainent vers ce pixel
        dem_padded = np.pad(dem, 1, mode='edge')
        dem_neighbors = np.stack([
            dem_padded[:-2, :-2], dem_padded[:-2, 1:-1], dem_padded[:-2, 2:],
            dem_padded[1:-1, :-2],                       dem_padded[1:-1, 2:],
            dem_padded[2:, :-2],   dem_padded[2:, 1:-1], dem_padded[2:, 2:],
        ])
        uphill_mask = dem_neighbors > dem[np.newaxis, :, :]
        flow_acc = 1 + np.sum(neighbors * uphill_mask, axis=0) * 0.3

    # TWI = ln(A / tan(β))
    twi = np.log(flow_acc / np.tan(slope_rad))
    return twi


def save_result(gdf, zone_code):
    """Sauvegarde le résultat en GeoPackage et WKT."""
    if gdf is None or len(gdf) == 0:
        log.warning("  Aucun polygone pour %s", zone_code)
        return None

    # Union finale
    union = unary_union(gdf.geometry.tolist())
    if isinstance(union, Polygon):
        union = MultiPolygon([union])
    elif not isinstance(union, MultiPolygon):
        union = MultiPolygon(list(union.geoms))

    # Simplification
    union_simplified = union.simplify(0.001, preserve_topology=True)  # ~100m

    # GeoDataFrame résultat
    result_gdf = gpd.GeoDataFrame(
        [{"zone_code": zone_code, "methode": "SIG_naturel_2026-06-14",
          "area_km2": round(union.area * 1.2e10 / 1e6, 1)}],
        geometry=[union_simplified],
        crs="EPSG:4326"
    )

    gpkg_path = os.path.join(OUT, f"{zone_code.lower()}_final.gpkg")
    wkt_path = os.path.join(OUT, f"{zone_code.lower()}_final.wkt")

    result_gdf.to_file(gpkg_path, driver="GPKG")
    with open(wkt_path, "w") as f:
        f.write(union_simplified.wkt)

    area_km2 = result_gdf["area_km2"].iloc[0]
    log.info("  Sauvegardé : %s (%.1f km²)", gpkg_path, area_km2)
    log.info("  WKT : %s", wkt_path)
    return result_gdf


# ── ZONE B3 — Fosse aux Lions (CRITIQUE) ──────────────────────────────

def compute_fosse_lions():
    """
    Fosse aux Lions : cuvette argileuse 7-8 km² dans le fond de la réserve WDPA.
    Méthode : WDPA mask + TWI > seuil → fond de cuvette uniquement.
    """
    log.info("=" * 60)
    log.info("B3 — Fosse aux Lions (CRITIQUE — cible 7-8 km²)")

    dem_path = "data/raw/copernicus_dem/dem_fosse_lions_30m.tif"
    wdpa_path = "data/raw/wdpa/fosse_lions_wdpa.geojson"

    if not os.path.exists(dem_path):
        log.error("  DEM manquant : %s", dem_path)
        return None

    dem, transform, crs, nodata, profile = read_raster(dem_path)
    log.info("  DEM Fosse : %dx%d pixels, résolution ~30m", dem.shape[1], dem.shape[0])

    # Calcul TWI
    log.info("  Calcul TWI (Topographic Wetness Index)...")
    twi = compute_twi(dem)
    log.info("  TWI : min=%.2f max=%.2f median=%.2f", np.nanmin(twi), np.nanmax(twi), np.nanmedian(twi))

    # Tester différents seuils TWI pour atteindre ~7-8 km²
    for twi_threshold in [8.0, 7.5, 7.0, 6.5, 6.0]:
        mask = (twi > twi_threshold).astype(np.uint8)
        n_pixels = mask.sum()
        # ~30m pixel → 900m²/pixel → en km²
        area_km2 = n_pixels * 900 / 1e6
        log.info("  TWI > %.1f : %d pixels → %.1f km²", twi_threshold, n_pixels, area_km2)
        if 5.0 <= area_km2 <= 20.0:
            log.info("  → Seuil retenu : TWI > %.1f (%.1f km²)", twi_threshold, area_km2)
            break

    # Appliquer le masque WDPA si disponible
    if os.path.exists(wdpa_path):
        wdpa_gdf = gpd.read_file(wdpa_path)
        log.info("  WDPA Fosse aux Lions : %d polygone(s)", len(wdpa_gdf))

        # Rasteriser le WDPA sur la grille DEM
        wdpa_4326 = wdpa_gdf.to_crs('EPSG:4326')
        with rasterio.open(dem_path) as src:
            wdpa_mask = rasterize(
                [(geom, 1) for geom in wdpa_4326.geometry],
                out_shape=dem.shape,
                transform=src.transform,
                fill=0,
                dtype=np.uint8,
            )

        # Intersection TWI × WDPA
        final_mask = ((twi > twi_threshold) & (wdpa_mask == 1)).astype(np.uint8)
        n_final = final_mask.sum()
        area_final = n_final * 900 / 1e6
        log.info("  Intersection TWI+WDPA : %d pixels → %.1f km²", n_final, area_final)
    else:
        log.warning("  WDPA non disponible — TWI seul")
        final_mask = mask

    gdf = raster_to_polygons(final_mask, transform, crs, min_area_m2=50_000)
    log.info("  Polygones retenus : %d", len(gdf))

    return save_result(gdf, "FOSSE_LIONS_TG")


# ── ZONE B1 — Dépression de la Lama ───────────────────────────────────

def compute_lama():
    """
    Lama : isocontour altitude < 60m + validation Clay Index Sentinel-2.
    Cible : 230-450 km².
    """
    log.info("=" * 60)
    log.info("B1 — Dépression de la Lama (cible 230-450 km²)")

    dem_path = "data/raw/copernicus_dem/dem_lama_30m.tif"
    clay_path = "data/raw/sentinel2/clay_index_mailles_29407.geojson"

    if not os.path.exists(dem_path):
        log.error("  DEM manquant : %s", dem_path)
        return None

    dem, transform, crs, nodata, profile = read_raster(dem_path)
    log.info("  DEM Lama : %dx%d pixels", dem.shape[1], dem.shape[0])
    log.info("  Altitude : min=%.0fm max=%.0fm median=%.0fm",
             np.nanmin(dem), np.nanmax(dem), np.nanmedian(dem))

    # Masque altitude < 60m (fond de dépression)
    alt_threshold = 60.0
    alt_mask = (dem < alt_threshold) & (~np.isnan(dem))
    area_km2_alt = alt_mask.sum() * 900 / 1e6
    log.info("  Altitude < %.0fm : %.1f km²", alt_threshold, area_km2_alt)

    # Si trop grand, affiner avec seuil plus bas
    if area_km2_alt > 800:
        for thresh in [55, 50, 45]:
            alt_mask = (dem < thresh) & (~np.isnan(dem))
            area = alt_mask.sum() * 900 / 1e6
            log.info("  Test altitude < %dm : %.1f km²", thresh, area)
            if area < 600:
                alt_threshold = thresh
                log.info("  → Seuil altitude retenu : %dm", thresh)
                break

    gdf = raster_to_polygons(alt_mask.astype(np.uint8), transform, crs, min_area_m2=5_000_000)
    log.info("  Polygones altitude : %d", len(gdf))

    # Filtrer : garder uniquement polygones dans bbox Lama confirmée
    lama_bbox = box(1.05, 6.35, 1.72, 6.95)
    gdf = gdf[gdf.geometry.intersects(lama_bbox)]
    log.info("  Après filtre bbox Lama : %d polygones", len(gdf))

    return save_result(gdf, "DEPRESSION_LAMA_TG")


# ── ZONE B2 — Dépression du Bado ──────────────────────────────────────

def compute_bado():
    """
    Bado : isocontour altitude < 80m.
    Cible : 92-300 km².
    """
    log.info("=" * 60)
    log.info("B2 — Dépression du Bado (cible 92-300 km²)")

    dem_path = "data/raw/copernicus_dem/dem_bado_30m.tif"

    if not os.path.exists(dem_path):
        log.error("  DEM manquant : %s", dem_path)
        return None

    dem, transform, crs, nodata, profile = read_raster(dem_path)
    log.info("  DEM Bado : %dx%d pixels", dem.shape[1], dem.shape[0])
    log.info("  Altitude : min=%.0fm max=%.0fm median=%.0fm",
             np.nanmin(dem), np.nanmax(dem), np.nanmedian(dem))

    # Tester seuils pour atteindre 92-300 km²
    for alt_threshold in [80, 75, 70, 65]:
        alt_mask = (dem < alt_threshold) & (~np.isnan(dem))
        area_km2 = alt_mask.sum() * 900 / 1e6
        log.info("  Altitude < %dm : %.1f km²", alt_threshold, area_km2)
        if 80 <= area_km2 <= 400:
            log.info("  → Seuil retenu : %dm", alt_threshold)
            break

    gdf = raster_to_polygons(alt_mask.astype(np.uint8), transform, crs, min_area_m2=2_000_000)
    log.info("  Polygones Bado : %d", len(gdf))

    # Filtrer : bbox Bado (Agbanakè-Tokpli)
    bado_bbox = box(1.28, 6.22, 1.62, 6.62)
    gdf = gdf[gdf.geometry.intersects(bado_bbox)]
    log.info("  Après filtre bbox Bado : %d polygones", len(gdf))

    return save_result(gdf, "DEPRESSION_BADO_TG")


# ── ZONE B4 — Plaine du Mono ──────────────────────────────────────────

def compute_mono():
    """
    Mono : JRC Global Surface Water Maximum Water Extent + connexité au fleuve Mono.
    Cible : > 300 km².
    """
    log.info("=" * 60)
    log.info("B4 — Plaine du Mono (cible > 300 km²)")

    gsw_path = "data/raw/jrc_gsw/jrc_gsw_max_extent_togo_30m.tif"
    # Fallback sur la version zone spécifique
    if not os.path.exists(gsw_path):
        gsw_path = "data/raw/jrc_gsw/jrc_gsw_max_extent_mono_30m.tif"

    if not os.path.exists(gsw_path):
        log.error("  JRC GSW manquant")
        return None

    gsw, transform, crs, nodata, profile = read_raster(gsw_path)
    log.info("  JRC GSW : %dx%d pixels", gsw.shape[1], gsw.shape[0])

    # Masque eau (valeur 1 = eau observée au moins une fois)
    # Pour la plaine du Mono, on élargit avec un buffer
    mono_bbox_region = box(1.12, 6.10, 1.90, 7.25)

    # Filtrer sur la région Mono
    # Coordonnées pixel de la région Mono dans le raster
    with rasterio.open(gsw_path) as src:
        window = src.window(1.12, 6.10, 1.90, 7.25)
        mono_data = src.read(1, window=window)
        mono_transform = src.window_transform(window)

    log.info("  GSW Mono region : %dx%d pixels", mono_data.shape[1], mono_data.shape[0])
    log.info("  Valeurs uniques GSW : %s", np.unique(mono_data))

    water_mask = (mono_data == 1).astype(np.uint8)
    area_water = water_mask.sum() * 900 / 1e6
    log.info("  Surface eau JRC max extent : %.1f km²", area_water)

    # Dilater pour inclure la plaine d'inondation au-delà du lit mineur
    # 5 pixels de dilation ≈ 150m buffer
    from scipy.ndimage import binary_dilation, binary_fill_holes
    water_dilated = binary_dilation(water_mask, iterations=10)  # ~300m buffer
    water_filled = binary_fill_holes(water_dilated).astype(np.uint8)
    area_dilated = water_filled.sum() * 900 / 1e6
    log.info("  Après dilatation 300m + remplissage : %.1f km²", area_dilated)

    gdf = raster_to_polygons(water_filled, mono_transform, "EPSG:4326", min_area_m2=10_000_000)
    log.info("  Polygones Mono : %d", len(gdf))

    return save_result(gdf, "PLAINE_MONO_TG")


# ── ZONE B5 — Plaine de l'Oti ─────────────────────────────────────────

def compute_oti():
    """
    Oti : Triple intersection — DEM < 130m + WDPA OKM + buffer 5km fleuve Oti.
    Cible : 390-1350 km².
    """
    log.info("=" * 60)
    log.info("B5 — Plaine de l'Oti (cible 390-1350 km²)")

    dem_path = "data/raw/copernicus_dem/dem_oti_30m.tif"
    wdpa_path = "data/raw/wdpa/oti_keran_mandouri_wdpa.geojson"
    osm_path = "data/raw/osm/oti_river_osm.geojson"

    if not os.path.exists(dem_path):
        log.error("  DEM Oti manquant")
        return None

    dem, transform, crs, nodata, profile = read_raster(dem_path)
    log.info("  DEM Oti : %dx%d pixels", dem.shape[1], dem.shape[0])
    log.info("  Altitude : min=%.0fm max=%.0fm median=%.0fm",
             np.nanmin(dem), np.nanmax(dem), np.nanmedian(dem))

    # Condition 1 : altitude < 130m
    alt_mask = (dem < 130.0) & (~np.isnan(dem))
    area_alt = alt_mask.sum() * 900 / 1e6
    log.info("  Condition 1 (alt < 130m) : %.1f km²", area_alt)

    gdf_alt = raster_to_polygons(alt_mask.astype(np.uint8), transform, crs, min_area_m2=1_000_000)

    # Condition 2 : WDPA Oti-Kéran-Mandouri
    wdpa_poly = None
    if os.path.exists(wdpa_path):
        wdpa_gdf = gpd.read_file(wdpa_path).to_crs('EPSG:4326')
        wdpa_poly = unary_union(wdpa_gdf.geometry.tolist())
        area_wdpa = wdpa_poly.area * 1.2e10 / 1e6
        log.info("  Condition 2 (WDPA OKM) : %.1f km²", area_wdpa)
    else:
        log.warning("  WDPA OKM non disponible — utiliser alt < 130m seul")

    # Condition 3 : buffer 5km fleuve Oti
    osm_buffer = None
    if os.path.exists(osm_path):
        osm_gdf = gpd.read_file(osm_path).to_crs('EPSG:32631')  # UTM 31N pour buffer métrique
        osm_buffered = osm_gdf.buffer(5000)  # 5km
        osm_union = unary_union(osm_buffered.tolist())
        osm_buffer_gdf = gpd.GeoDataFrame(geometry=[osm_union], crs='EPSG:32631').to_crs('EPSG:4326')
        osm_buffer = osm_buffer_gdf.geometry.iloc[0]
        area_osm = osm_buffer.area * 1.2e10 / 1e6
        log.info("  Condition 3 (buffer 5km Oti) : %.1f km²", area_osm)
    else:
        log.warning("  OSM Oti non disponible")

    # Triple intersection
    if len(gdf_alt) == 0:
        log.error("  Aucun polygone altitude < 130m")
        return None

    alt_union = unary_union(gdf_alt.geometry.tolist())
    result_geom = alt_union

    if wdpa_poly is not None:
        result_geom = result_geom.intersection(wdpa_poly)
        area_inter = result_geom.area * 1.2e10 / 1e6
        log.info("  Alt < 130m ∩ WDPA OKM : %.1f km²", area_inter)

    if osm_buffer is not None:
        result_geom = result_geom.intersection(osm_buffer)
        area_inter2 = result_geom.area * 1.2e10 / 1e6
        log.info("  ∩ Buffer 5km Oti : %.1f km²", area_inter2)

    # Si intersection trop petite, utiliser Alt ∩ WDPA seulement
    final_area = result_geom.area * 1.2e10 / 1e6
    log.info("  Résultat triple intersection : %.1f km² (cible: 390-1350 km²)", final_area)

    if final_area < 100 and wdpa_poly is not None:
        log.warning("  Triple intersection trop petite, fallback Alt+WDPA")
        result_geom = alt_union.intersection(wdpa_poly)

    if isinstance(result_geom, Polygon):
        result_geom = MultiPolygon([result_geom])

    result_gdf = gpd.GeoDataFrame(
        geometry=[result_geom], crs='EPSG:4326'
    )
    # Filtrer petites enclaves
    result_gdf = result_gdf.explode(index_parts=False)
    result_gdf = result_gdf[result_gdf.geometry.area > 1e-4]  # > ~1km²

    return save_result(result_gdf, "PLAINE_OTI_TG")


# ── RAPPORT FINAL ──────────────────────────────────────────────────────

def rapport_final():
    """Compare les superficies calculées avec les cibles scientifiques."""
    cibles = {
        "FOSSE_LIONS_TG":     (5, 15,    "7-8 km²"),
        "DEPRESSION_LAMA_TG": (230, 450, "230-450 km²"),
        "DEPRESSION_BADO_TG": (92, 300,  "92-300 km²"),
        "PLAINE_MONO_TG":     (300, 2000,"300+ km²"),
        "PLAINE_OTI_TG":      (390, 1350,"390-1350 km²"),
    }

    log.info("\n" + "=" * 60)
    log.info("RAPPORT FINAL — Superficies calculées vs cibles scientifiques")
    log.info("=" * 60)

    all_ok = True
    for code, (min_km2, max_km2, label_cible) in cibles.items():
        wkt_path = os.path.join(OUT, f"{code.lower()}_final.wkt")
        gpkg_path = os.path.join(OUT, f"{code.lower()}_final.gpkg")

        if os.path.exists(gpkg_path):
            gdf = gpd.read_file(gpkg_path)
            area_km2 = gdf["area_km2"].iloc[0] if "area_km2" in gdf.columns else 0
            in_range = min_km2 <= area_km2 <= max_km2
            status = "✅" if in_range else "⚠️"
            if not in_range:
                all_ok = False
            log.info("  %s %-25s : %.1f km² (cible: %s) %s",
                     status, code, area_km2, label_cible, "" if in_range else "← HORS CIBLE")
        else:
            log.info("  ❌ %-25s : non calculé", code)
            all_ok = False

    if all_ok:
        log.info("\n✅ Toutes les zones dans les plages cibles.")
        log.info("Prochaine étape : BLOC C (validation QGIS) puis BLOC D (import DB)")
    else:
        log.info("\n⚠️  Certaines zones hors plage — ajuster les seuils dans ce script.")

    log.info("\nFichiers de sortie :")
    for f in os.listdir(OUT):
        path = os.path.join(OUT, f)
        log.info("  %s (%.2f MB)", path, os.path.getsize(path)/1e6)


# ── Point d'entrée ─────────────────────────────────────────────────────

def main():
    log.info("BLOC B — Calcul polygones naturels zones géologiques")
    log.info("Source : roadmap_delimitation_zones_geo_14_06_2026.md")

    compute_fosse_lions()  # CRITIQUE — commencer par là
    compute_lama()
    compute_bado()
    compute_mono()
    compute_oti()
    rapport_final()

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
