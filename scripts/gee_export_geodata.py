#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — Export GEE vers Google Drive
=======================================================
Lance les tâches d'export depuis Google Earth Engine via l'API Python :
  - Copernicus DEM GLO-30 (10m résolution) sur le Togo
  - JRC Global Surface Water — Maximum Extent (30m)
  - Sentinel-2 Clay Minerals Index raster (20m)

Les fichiers atterrissent dans Google Drive → dossier 'atlas_togo_data'.
Après export (20-60 min selon GEE), télécharger dans :
  data/raw/copernicus_dem/
  data/raw/jrc_gsw/
  data/raw/sentinel2/   (raster haute résolution, optionnel — points déjà en base)

Usage :
  python scripts/gee_export_geodata.py
"""

from __future__ import annotations

import logging
import time

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
log = logging.getLogger("gee_export")

GEE_PROJECT = "gen-lang-client-0964618990"
DRIVE_FOLDER = "atlas_togo_data"

# Emprise Togo EPSG:4326
TOGO = [0.0, 6.0, 1.9, 11.2]  # [west, south, east, north]


def init_gee():
    import ee
    try:
        ee.Initialize(project=GEE_PROJECT)
        log.info("GEE initialisé (projet: %s)", GEE_PROJECT)
    except Exception as exc:
        raise RuntimeError(
            f"GEE non initialisé : {exc}\n"
            "Exécuter : earthengine authenticate"
        ) from exc
    return ee


def export_copernicus_dem(ee):
    """Export Copernicus DEM GLO-30 sur le Togo."""
    log.info("Préparation export Copernicus DEM GLO-30...")

    togo = ee.Geometry.Rectangle(TOGO)

    dem = (
        ee.ImageCollection("COPERNICUS/DEM/GLO30")
        .filterBounds(togo)
        .select("DEM")
        .mosaic()
        .clip(togo)
        .toFloat()
    )

    task = ee.batch.Export.image.toDrive(
        image=dem,
        description="copernicus_dem_togo_10m",
        folder=DRIVE_FOLDER,
        fileNamePrefix="copernicus_dem_togo_10m",
        region=togo,
        scale=30,          # GLO-30 = résolution native ~30m (10m disponible via Copernicus Land)
        crs="EPSG:4326",
        maxPixels=int(1e10),
        fileFormat="GeoTIFF",
    )
    task.start()
    log.info("  ✅ Task lancée : copernicus_dem_togo_10m (ID: %s)", task.id)
    log.info("     Résolution : 30m | Emprise : Togo complet")
    log.info("     Destination Drive : %s/copernicus_dem_togo_10m.tif", DRIVE_FOLDER)
    return task


def export_jrc_gsw(ee):
    """Export JRC Global Surface Water — Maximum Water Extent et Occurrence."""
    log.info("Préparation export JRC GSW...")

    togo = ee.Geometry.Rectangle(TOGO)
    gsw = ee.Image("JRC/GSW1_4/GlobalSurfaceWater")

    # Maximum Water Extent : 1 = eau observée au moins une fois (1984-2021)
    max_extent = gsw.select("max_extent").clip(togo).toByte()

    # Occurrence : % de temps où pixel = eau (0-100)
    occurrence = gsw.select("occurrence").clip(togo).toByte()

    task_max = ee.batch.Export.image.toDrive(
        image=max_extent,
        description="jrc_gsw_max_extent_togo",
        folder=DRIVE_FOLDER,
        fileNamePrefix="jrc_gsw_max_extent_togo_30m",
        region=togo,
        scale=30,
        crs="EPSG:4326",
        maxPixels=int(1e10),
        fileFormat="GeoTIFF",
    )
    task_max.start()
    log.info("  ✅ Task lancée : jrc_gsw_max_extent (ID: %s)", task_max.id)

    task_occ = ee.batch.Export.image.toDrive(
        image=occurrence,
        description="jrc_gsw_occurrence_togo",
        folder=DRIVE_FOLDER,
        fileNamePrefix="jrc_gsw_occurrence_togo_30m",
        region=togo,
        scale=30,
        crs="EPSG:4326",
        maxPixels=int(1e10),
        fileFormat="GeoTIFF",
    )
    task_occ.start()
    log.info("  ✅ Task lancée : jrc_gsw_occurrence (ID: %s)", task_occ.id)
    log.info("     Destination Drive : %s/jrc_gsw_*.tif", DRIVE_FOLDER)
    return task_max, task_occ


def export_sentinel2_clay_raster(ee):
    """Export Clay Minerals Index Sentinel-2 raster 20m (optionnel — points déjà en base)."""
    log.info("Préparation export Sentinel-2 Clay Index raster (20m)...")

    togo = ee.Geometry.Rectangle(TOGO)

    s2 = (
        ee.ImageCollection("COPERNICUS/S2_SR_HARMONIZED")
        .filterDate("2023-01-01", "2024-12-31")
        .filter(ee.Filter.lt("CLOUDY_PIXEL_PERCENTAGE", 20))
        .filterBounds(togo)
        .select(["B4", "B8", "B11", "B12"])
        .median()
        .multiply(0.0001)
    )

    # Clay Minerals Index = B11 / B12 (Kalinowski & Oliver 2004)
    clay_index = s2.select("B11").divide(s2.select("B12")).rename("clay_index")
    ndvi = s2.normalizedDifference(["B8", "B4"]).rename("ndvi")

    # Masque végétation dense (signal argile non fiable)
    clay_masked = clay_index.updateMask(ndvi.lt(0.6)).clip(togo).toFloat()

    task = ee.batch.Export.image.toDrive(
        image=clay_masked,
        description="sentinel2_clay_index_togo_20m",
        folder=DRIVE_FOLDER,
        fileNamePrefix="sentinel2_clay_index_togo_20m",
        region=togo,
        scale=20,
        crs="EPSG:4326",
        maxPixels=int(1e10),
        fileFormat="GeoTIFF",
    )
    task.start()
    log.info("  ✅ Task lancée : sentinel2_clay_index (ID: %s)", task.id)
    log.info("     Résolution : 20m | Masque NDVI > 0.6 appliqué")
    log.info("     Destination Drive : %s/sentinel2_clay_index_togo_20m.tif", DRIVE_FOLDER)
    return task


def monitor_tasks(ee, tasks, timeout_min: int = 90):
    """Surveille l'état des tâches GEE toutes les 30 secondes."""
    log.info("\nSurveillance des tâches (timeout: %d min)...", timeout_min)
    log.info("Vous pouvez aussi suivre sur : https://code.earthengine.google.com/tasks")

    start = time.time()
    task_ids = [t.id for t in tasks]
    completed = set()
    failed = set()

    while len(completed) + len(failed) < len(tasks):
        elapsed = (time.time() - start) / 60
        if elapsed > timeout_min:
            log.warning("Timeout atteint (%d min). Vérifier manuellement les tâches.", timeout_min)
            break

        time.sleep(30)

        for task in tasks:
            if task.id in completed or task.id in failed:
                continue
            status = task.status()
            state = status.get("state", "UNKNOWN")

            if state == "COMPLETED":
                completed.add(task.id)
                log.info("  ✅ TERMINÉ : %s", status.get("description", task.id))
            elif state in ("FAILED", "CANCELLED"):
                failed.add(task.id)
                log.error("  ❌ ÉCHOUÉ : %s — %s",
                          status.get("description", task.id),
                          status.get("error_message", ""))
            else:
                log.info("  ⏳ %s : %s (%.0f min)", state,
                         status.get("description", task.id), elapsed)

    log.info("\nRésultats :")
    log.info("  Terminés : %d/%d", len(completed), len(tasks))
    if failed:
        log.error("  Échoués  : %d/%d", len(failed), len(tasks))

    return completed, failed


def main():
    ee = init_gee()

    log.info("=" * 60)
    log.info("LANCEMENT EXPORTS GEE — Atlas Géotechnique Togo")
    log.info("Projet GEE : %s", GEE_PROJECT)
    log.info("Drive folder : %s", DRIVE_FOLDER)
    log.info("=" * 60)

    tasks = []

    task_dem = export_copernicus_dem(ee)
    tasks.append(task_dem)

    task_max, task_occ = export_jrc_gsw(ee)
    tasks.extend([task_max, task_occ])

    task_clay = export_sentinel2_clay_raster(ee)
    tasks.append(task_clay)

    log.info("\n%d tâches lancées. Surveillance en cours...", len(tasks))
    log.info("IDs : %s", [t.id for t in tasks])

    completed, failed = monitor_tasks(ee, tasks, timeout_min=90)

    if completed:
        log.info("\n✅ Exports terminés. Télécharger depuis Google Drive :")
        log.info("   Drive → %s → Télécharger les .tif", DRIVE_FOLDER)
        log.info("   DEM  → data/raw/copernicus_dem/copernicus_dem_togo_10m.tif")
        log.info("   GSW  → data/raw/jrc_gsw/jrc_gsw_max_extent_togo_30m.tif")
        log.info("   Clay → data/raw/sentinel2/sentinel2_clay_index_togo_20m.tif")
        log.info("\n▶ Prochaine étape : BLOC B (traitement QGIS/Python par zone)")

    return 0 if not failed else 1


if __name__ == "__main__":
    raise SystemExit(main())
