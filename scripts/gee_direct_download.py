#!/usr/bin/env python3
"""
Téléchargement direct GEE (sans Drive) via getDownloadURL.
Fonctionne pour les petites zones (<100MB) — Fosse aux Lions, Bado, Lama partiel.
Pour les grandes zones (Oti, Mono), nécessite Drive.

Usage : python scripts/gee_direct_download.py
"""
import ee
import os
import urllib.request
import zipfile
import io
import logging

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("gee_direct")

ee.Initialize(project='gen-lang-client-0964618990')

os.makedirs("data/raw/copernicus_dem", exist_ok=True)
os.makedirs("data/raw/jrc_gsw", exist_ok=True)


def download_gee_image(image, bbox, scale, filename, description=""):
    """Télécharge un raster GEE directement via getDownloadURL."""
    region = ee.Geometry.Rectangle(bbox)  # [west, south, east, north]

    log.info("Préparation download : %s (%s)", filename, description)

    url = image.getDownloadURL({
        'region': region,
        'scale': scale,
        'crs': 'EPSG:4326',
        'format': 'GEO_TIFF',
    })

    log.info("  Téléchargement en cours...")
    req = urllib.request.Request(url)
    req.add_header('User-Agent', 'Atlas-Geotechnique-Togo/1.0')

    with urllib.request.urlopen(req, timeout=300) as resp:
        data = resp.read()

    size_mb = len(data) / 1e6
    log.info("  Reçu : %.1f MB", size_mb)

    # GEE retourne un ZIP contenant le GeoTIFF
    if data[:2] == b'PK':  # ZIP magic bytes
        with zipfile.ZipFile(io.BytesIO(data)) as z:
            tif_files = [n for n in z.namelist() if n.endswith('.tif')]
            if tif_files:
                with z.open(tif_files[0]) as tif:
                    tif_data = tif.read()
                with open(filename, 'wb') as f:
                    f.write(tif_data)
                log.info("  Sauvegardé : %s (%.1f MB)", filename, len(tif_data)/1e6)
                return True
    else:
        # Données brutes GeoTIFF
        with open(filename, 'wb') as f:
            f.write(data)
        log.info("  Sauvegardé : %s (%.1f MB)", filename, size_mb)
        return True

    return False


# ── 1. Copernicus DEM — Fosse aux Lions (zone critique, petite) ────────
log.info("=" * 60)
log.info("1. Copernicus DEM — Fosse aux Lions")
fosse_bbox = [0.10, 10.68, 0.32, 10.92]  # [W, S, E, N]

dem = (
    ee.ImageCollection("COPERNICUS/DEM/GLO30")
    .filterBounds(ee.Geometry.Rectangle(fosse_bbox))
    .select("DEM")
    .mosaic()
    .toFloat()
)

dem_fosse_path = "data/raw/copernicus_dem/dem_fosse_lions_30m.tif"
try:
    download_gee_image(dem, fosse_bbox, 30, dem_fosse_path, "Fosse aux Lions ~22x24km")
except Exception as e:
    log.error("  Erreur DEM Fosse : %s", e)


# ── 2. Copernicus DEM — Lama (bbox réduit au cœur argile) ─────────────
log.info("=" * 60)
log.info("2. Copernicus DEM — Dépression de la Lama")
lama_bbox = [1.05, 6.35, 1.72, 6.95]  # [W, S, E, N]

dem_lama = (
    ee.ImageCollection("COPERNICUS/DEM/GLO30")
    .filterBounds(ee.Geometry.Rectangle(lama_bbox))
    .select("DEM")
    .mosaic()
    .toFloat()
)

dem_lama_path = "data/raw/copernicus_dem/dem_lama_30m.tif"
try:
    download_gee_image(dem_lama, lama_bbox, 30, dem_lama_path, "Lama ~75x65km")
except Exception as e:
    log.error("  Erreur DEM Lama : %s", e)


# ── 3. Copernicus DEM — Bado ───────────────────────────────────────────
log.info("=" * 60)
log.info("3. Copernicus DEM — Dépression du Bado")
bado_bbox = [1.25, 6.18, 1.65, 6.65]  # [W, S, E, N]

dem_bado = (
    ee.ImageCollection("COPERNICUS/DEM/GLO30")
    .filterBounds(ee.Geometry.Rectangle(bado_bbox))
    .select("DEM")
    .mosaic()
    .toFloat()
)

dem_bado_path = "data/raw/copernicus_dem/dem_bado_30m.tif"
try:
    download_gee_image(dem_bado, bado_bbox, 30, dem_bado_path, "Bado ~44x52km")
except Exception as e:
    log.error("  Erreur DEM Bado : %s", e)


# ── 4. Copernicus DEM — Oti ────────────────────────────────────────────
log.info("=" * 60)
log.info("4. Copernicus DEM — Plaine de l'Oti")
oti_bbox = [0.33, 9.75, 1.07, 11.22]  # [W, S, E, N]

dem_oti = (
    ee.ImageCollection("COPERNICUS/DEM/GLO30")
    .filterBounds(ee.Geometry.Rectangle(oti_bbox))
    .select("DEM")
    .mosaic()
    .toFloat()
)

dem_oti_path = "data/raw/copernicus_dem/dem_oti_30m.tif"
try:
    download_gee_image(dem_oti, oti_bbox, 30, dem_oti_path, "Oti ~82x165km")
except Exception as e:
    log.error("  Erreur DEM Oti : %s", e)


# ── 5. JRC GSW Max Extent — Mono ──────────────────────────────────────
log.info("=" * 60)
log.info("5. JRC GSW Max Extent — Plaine du Mono")
mono_bbox = [1.12, 6.12, 1.88, 7.22]  # [W, S, E, N]

gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")
max_extent_mono = gsw.select("max_extent").clip(ee.Geometry.Rectangle(mono_bbox)).toByte()

gsw_mono_path = "data/raw/jrc_gsw/jrc_gsw_max_extent_mono_30m.tif"
try:
    download_gee_image(max_extent_mono, mono_bbox, 30, gsw_mono_path, "Mono plaine ~84x122km")
except Exception as e:
    log.error("  Erreur JRC GSW Mono : %s", e)


# ── 6. JRC GSW Max Extent — Togo complet ──────────────────────────────
log.info("=" * 60)
log.info("6. JRC GSW Max Extent — Togo complet")
togo_bbox = [0.0, 6.0, 1.9, 11.2]

max_extent_togo = gsw.select("max_extent").clip(ee.Geometry.Rectangle(togo_bbox)).toByte()

gsw_togo_path = "data/raw/jrc_gsw/jrc_gsw_max_extent_togo_30m.tif"
try:
    download_gee_image(max_extent_togo, togo_bbox, 30, gsw_togo_path, "Togo complet ~211x580km")
except Exception as e:
    log.error("  Erreur JRC GSW Togo : %s", e)


# ── 7. DEM Togo complet ────────────────────────────────────────────────
log.info("=" * 60)
log.info("7. Copernicus DEM — Togo complet")
togo_bbox = [0.0, 6.0, 1.9, 11.2]

dem_togo = (
    ee.ImageCollection("COPERNICUS/DEM/GLO30")
    .filterBounds(ee.Geometry.Rectangle(togo_bbox))
    .select("DEM")
    .mosaic()
    .toFloat()
)

dem_togo_path = "data/raw/copernicus_dem/dem_togo_30m.tif"
try:
    download_gee_image(dem_togo, togo_bbox, 30, dem_togo_path, "Togo complet ~211x580km")
except Exception as e:
    log.error("  Erreur DEM Togo : %s", e)


# ── Résumé ─────────────────────────────────────────────────────────────
log.info("\n" + "=" * 60)
log.info("RÉSUMÉ TÉLÉCHARGEMENTS")
files_check = [
    dem_fosse_path, dem_lama_path, dem_bado_path,
    dem_oti_path, gsw_mono_path, gsw_togo_path, dem_togo_path,
]
for f in files_check:
    exists = os.path.exists(f)
    size = os.path.getsize(f) / 1e6 if exists else 0
    status = "✅" if exists else "❌"
    log.info("  %s %s (%.1f MB)", status, f, size)

log.info("\nProchaine étape : BLOC B — traitement SIG par zone")
log.info("Script : scripts/compute_zone_boundaries.py")
