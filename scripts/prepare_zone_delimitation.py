#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — Préparation données pour délimitation zones géologiques
==================================================================================

Ce script prépare les données nécessaires à la délimitation naturelle des 5 zones :
  - Exporte le Clay Index Sentinel-2 depuis la DB (déjà extrait sur 29 407 mailles)
  - Génère les scripts GEE pour Copernicus DEM et JRC GSW
  - Télécharge les données OSM (fleuve Oti) via Overpass API
  - Génère les instructions pour WDPA

Roadmap : docs/ROADMAP/roadmap_delimitation_zones_geo_14_06_2026.md
Source   : docs/DEPRESSION DE LAMA/RESULTAT — Délimitation des zones géologiques du Togo.md

Usage :
  python scripts/prepare_zone_delimitation.py --step all
  python scripts/prepare_zone_delimitation.py --step clay_export
  python scripts/prepare_zone_delimitation.py --step gee_scripts
  python scripts/prepare_zone_delimitation.py --step osm
"""

from __future__ import annotations

import argparse
import json
import logging
import os
import sys
import urllib.request
import urllib.parse
from pathlib import Path

import psycopg2
import pandas as pd
import numpy as np

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s | %(levelname)-8s | %(message)s",
)
log = logging.getLogger("zone_delim")

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean")

# Chemins de sortie
OUT_RAW       = Path("data/raw")
OUT_PROCESSED = Path("data/processed")
OUT_SENTINEL  = OUT_RAW / "sentinel2"
OUT_OSM       = OUT_RAW / "osm"
OUT_GEE       = OUT_RAW / "gee_scripts"

for d in [OUT_RAW, OUT_PROCESSED, OUT_SENTINEL, OUT_OSM, OUT_GEE]:
    d.mkdir(parents=True, exist_ok=True)

# ── Bounding boxes des zones (EPSG:4326) ──────────────────────────────
ZONE_BBOX = {
    "DEPRESSION_LAMA_TG":  {"s": 6.20, "n": 6.95, "w": 1.05, "e": 1.70},
    "DEPRESSION_BADO_TG":  {"s": 6.20, "n": 6.65, "w": 1.25, "e": 1.65},
    "FOSSE_LIONS_TG":      {"s": 10.70, "n": 10.85, "w": 0.12, "e": 0.30},
    "PLAINE_MONO_TG":      {"s": 6.15, "n": 7.20, "w": 1.15, "e": 1.85},
    "PLAINE_OTI_TG":       {"s": 9.80, "n": 11.20, "w": 0.35, "e": 1.05},
}

TOGO_BBOX = {"s": 6.0, "n": 11.2, "w": 0.0, "e": 1.9}


def get_conn(db_url: str):
    conn = psycopg2.connect(db_url)
    conn.autocommit = True
    return conn


# ── Étape 1 : Export Clay Index depuis DB → GeoJSON ───────────────────
def step_clay_export(conn):
    """
    Exporte le Clay Minerals Index (B11/B12 Sentinel-2) depuis atlas.maille_spectral_vfs
    vers un fichier GeoJSON pour utilisation dans QGIS.

    Les 29 407 mailles avec clay_index sont déjà en base — pas besoin de re-extraire GEE.
    """
    log.info("Export Clay Index Sentinel-2 depuis DB...")

    cur = conn.cursor()
    cur.execute("""
        SELECT
            m.code,
            ST_X(ST_Transform(ST_Centroid(m.geom), 4326))::float8 AS lon,
            ST_Y(ST_Transform(ST_Centroid(m.geom), 4326))::float8 AS lat,
            sv.clay_index,
            sv.swir_ratio,
            sv.ndvi,
            sv.iron_oxide,
            sv.uncertainty_flag,
            sv.is_cuirasse,
            sv.is_alluvial
        FROM atlas.maille_spectral_vfs sv
        JOIN atlas.mailles m ON m.id = sv.maille_id
        WHERE sv.clay_index IS NOT NULL
        ORDER BY m.code
    """)
    rows = cur.fetchall()
    cur.close()

    log.info("  %d mailles avec clay_index", len(rows))

    features = []
    for code, lon, lat, clay, swir, ndvi, iron, uflag, is_cur, is_all in rows:
        features.append({
            "type": "Feature",
            "geometry": {"type": "Point", "coordinates": [lon, lat]},
            "properties": {
                "maille_code": code,
                "clay_index": round(float(clay), 4) if clay else None,
                "swir_ratio": round(float(swir), 4) if swir else None,
                "ndvi": round(float(ndvi), 4) if ndvi else None,
                "iron_oxide": round(float(iron), 4) if iron else None,
                "uncertainty_flag": uflag,
                "is_cuirasse": is_cur,
                "is_alluvial": is_all,
                # Seuil vertisol : clay_index > 1.05 → argile montmorillonitique
                "is_clay_zone": (float(clay) > 1.05) if clay else False,
            }
        })

    geojson = {
        "type": "FeatureCollection",
        "crs": {"type": "name", "properties": {"name": "EPSG:4326"}},
        "features": features,
    }

    out_path = OUT_SENTINEL / "clay_index_mailles_29407.geojson"
    with open(out_path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False)

    log.info("  Exporté : %s (%.1f MB)", out_path, out_path.stat().st_size / 1e6)

    # Stats par zone approx (using bbox)
    log.info("\n  Statistiques clay_index par zone :")
    df = pd.DataFrame(rows, columns=[
        "code", "lon", "lat", "clay_index", "swir_ratio", "ndvi", "iron_oxide",
        "uncertainty_flag", "is_cuirasse", "is_alluvial"
    ])
    df["clay_index"] = df["clay_index"].astype(float)

    for zone_code, bbox in ZONE_BBOX.items():
        mask = (
            (df["lat"] >= bbox["s"]) & (df["lat"] <= bbox["n"]) &
            (df["lon"] >= bbox["w"]) & (df["lon"] <= bbox["e"])
        )
        sub = df[mask & df["clay_index"].notna()]
        if len(sub) > 0:
            n_clay = (sub["clay_index"] > 1.05).sum()
            log.info("  %-25s : %d mailles | clay_index moy=%.3f | clay>1.05: %d (%.0f%%)",
                     zone_code, len(sub),
                     sub["clay_index"].mean(),
                     n_clay, 100 * n_clay / len(sub))

    return str(out_path)


# ── Étape 2 : Génération scripts GEE pour Copernicus DEM et JRC GSW ───
def step_gee_scripts():
    """
    Génère les scripts JavaScript GEE à copier-coller dans https://code.earthengine.google.com/
    Projet GEE existant : gen-lang-client-0964618990
    """
    log.info("Génération scripts GEE...")

    # Script 1 : Export Copernicus DEM 10m
    gee_dem = """
// ============================================================
// Atlas Togo — Export Copernicus DEM GLO-10 (10m) pour le Togo
// Projet GEE : gen-lang-client-0964618990
// Roadmap : BLOC A1
// ============================================================

var togo = ee.Geometry.Rectangle([0.0, 6.0, 1.9, 11.2]);

// Copernicus DEM GLO-10 (10m résolution)
var dem = ee.ImageCollection('COPERNICUS/DEM/GLO30')
  .filterBounds(togo)
  .select('DEM')
  .mosaic()
  .clip(togo);

// Visualisation rapide
Map.centerObject(togo, 7);
Map.addLayer(dem, {min: 0, max: 500, palette: ['blue','green','yellow','red']}, 'DEM Togo');

// Export vers Google Drive
Export.image.toDrive({
  image: dem,
  description: 'copernicus_dem_togo_10m',
  folder: 'atlas_togo_data',
  fileNamePrefix: 'copernicus_dem_togo_10m',
  region: togo,
  scale: 10,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

print('DEM stats:', dem.reduceRegion({
  reducer: ee.Reducer.minMax().combine(ee.Reducer.mean(), null, true),
  geometry: togo,
  scale: 100,
  maxPixels: 1e9
}));
"""

    # Script 2 : Export JRC Global Surface Water Maximum Extent
    gee_gsw = """
// ============================================================
// Atlas Togo — Export JRC Global Surface Water Maximum Extent
// Projet GEE : gen-lang-client-0964618990
// Roadmap : BLOC A2
// ============================================================

var togo = ee.Geometry.Rectangle([0.0, 6.0, 1.9, 11.2]);

// JRC Global Surface Water v1.4
var gsw = ee.Image('JRC/GSW1_4/GlobalSurfaceWater');

// Maximum Water Extent : 1 = eau observée au moins une fois depuis 1984
var max_extent = gsw.select('max_extent').clip(togo);

// Occurrence : pourcentage du temps où le pixel est eau
var occurrence = gsw.select('occurrence').clip(togo);

// Visualisation
Map.centerObject(togo, 7);
Map.addLayer(max_extent, {min: 0, max: 1, palette: ['white', 'blue']}, 'JRC Max Extent');
Map.addLayer(occurrence, {min: 0, max: 100, palette: ['white', 'cyan', 'blue']}, 'JRC Occurrence');

// Export Max Extent (couche principale pour délimiter plaine du Mono)
Export.image.toDrive({
  image: max_extent,
  description: 'jrc_gsw_max_extent_togo',
  folder: 'atlas_togo_data',
  fileNamePrefix: 'jrc_gsw_max_extent_togo_30m',
  region: togo,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

// Export Occurrence (pour affiner si besoin)
Export.image.toDrive({
  image: occurrence,
  description: 'jrc_gsw_occurrence_togo',
  folder: 'atlas_togo_data',
  fileNamePrefix: 'jrc_gsw_occurrence_togo_30m',
  region: togo,
  scale: 30,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});
"""

    # Script 3 : Export Clay Index raster haute résolution (20m) pour QGIS
    gee_clay_raster = """
// ============================================================
// Atlas Togo — Export Clay Minerals Index Sentinel-2 (20m)
// Bandes B11 (SWIR1) / B12 (SWIR2) → ratio = clay_index
// Composite médian 2023-2024, nuages < 20%
// Projet GEE : gen-lang-client-0964618990
// Roadmap : BLOC A4
// ============================================================

var togo = ee.Geometry.Rectangle([0.0, 6.0, 1.9, 11.2]);

var s2 = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
  .filterDate('2023-01-01', '2024-12-31')
  .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 20))
  .filterBounds(togo)
  .select(['B4', 'B8', 'B11', 'B12'])
  .median()
  .multiply(0.0001);

// Clay Minerals Index (Kalinowski & Oliver 2004)
var clay_index = s2.select('B11').divide(s2.select('B12')).rename('clay_index');

// NDVI (masque végétation dense)
var ndvi = s2.normalizedDifference(['B8', 'B4']).rename('ndvi');

// Iron Oxide (contexte latérite/cuirasse)
var iron_oxide = s2.select('B4').divide(s2.select('B8')).rename('iron_oxide');

// Masque végétation dense (signal argile non fiable sous forêt)
var veg_mask = ndvi.lt(0.6);
var clay_masked = clay_index.updateMask(veg_mask).clip(togo);

// Visualisation
Map.centerObject(togo, 7);
Map.addLayer(clay_masked, {min: 0.8, max: 1.3, palette: ['white','yellow','orange','red','purple']}, 'Clay Index (seuil argile: 1.05)');

// Export raster Clay Index à 20m
Export.image.toDrive({
  image: clay_masked,
  description: 'sentinel2_clay_index_togo_20m',
  folder: 'atlas_togo_data',
  fileNamePrefix: 'sentinel2_clay_index_togo_20m',
  region: togo,
  scale: 20,
  crs: 'EPSG:4326',
  maxPixels: 1e10,
  fileFormat: 'GeoTIFF'
});

print('Clay Index stats:', clay_index.reduceRegion({
  reducer: ee.Reducer.percentile([5, 25, 50, 75, 95]),
  geometry: togo,
  scale: 100,
  maxPixels: 1e9
}));
"""

    # Écrire les scripts
    scripts = {
        "gee_01_copernicus_dem_export.js": gee_dem,
        "gee_02_jrc_gsw_export.js": gee_gsw,
        "gee_03_sentinel2_clay_index_export.js": gee_clay_raster,
    }

    for fname, content in scripts.items():
        path = OUT_GEE / fname
        path.write_text(content.strip(), encoding="utf-8")
        log.info("  Écrit : %s", path)

    log.info("  Scripts GEE prêts. Ouvrir : https://code.earthengine.google.com/")
    log.info("  Projet GEE : gen-lang-client-0964618990")
    log.info("  Les exports iront dans Google Drive → dossier 'atlas_togo_data'")
    log.info("  Télécharger ensuite dans : data/raw/copernicus_dem/ et data/raw/jrc_gsw/")


# ── Étape 3 : Téléchargement OSM fleuve Oti via Overpass ──────────────
def step_osm_download():
    """
    Télécharge l'axe du fleuve Oti depuis OpenStreetMap via l'API Overpass.
    Nécessite connexion internet.
    """
    log.info("Téléchargement OSM fleuve Oti (Overpass API)...")

    query = """
[out:json][timeout:60];
(
  way["waterway"="river"]["name"~"Oti|Pendjari|Outi",i](9.5,0.0,11.5,1.5);
  way["waterway"="river"]["name:fr"~"Oti|Pendjari",i](9.5,0.0,11.5,1.5);
  relation["waterway"="river"]["name"~"Oti|Pendjari",i](9.5,0.0,11.5,1.5);
);
out body;
>;
out skel qt;
"""

    url = "https://overpass-api.de/api/interpreter"
    data = urllib.parse.urlencode({"data": query}).encode("utf-8")

    try:
        req = urllib.request.Request(url, data=data)
        req.add_header("User-Agent", "Atlas-Geotechnique-Togo/1.0")

        log.info("  Requête Overpass (fleuve Oti dans bbox [9.5–11.5°N / 0.0–1.5°E])...")
        with urllib.request.urlopen(req, timeout=90) as resp:
            osm_data = json.loads(resp.read().decode("utf-8"))

        n_elements = len(osm_data.get("elements", []))
        log.info("  %d éléments OSM trouvés", n_elements)

        out_path = OUT_OSM / "oti_river_osm.geojson"
        # Conversion simplifiée OSM → GeoJSON (nodes → points)
        nodes = {e["id"]: e for e in osm_data["elements"] if e["type"] == "node"}
        ways = [e for e in osm_data["elements"] if e["type"] == "way"]

        features = []
        for way in ways:
            coords = []
            for nid in way.get("nodes", []):
                if nid in nodes:
                    n = nodes[nid]
                    coords.append([n["lon"], n["lat"]])
            if len(coords) >= 2:
                features.append({
                    "type": "Feature",
                    "geometry": {"type": "LineString", "coordinates": coords},
                    "properties": way.get("tags", {}),
                })

        geojson = {"type": "FeatureCollection", "features": features}
        with open(out_path, "w", encoding="utf-8") as f:
            json.dump(geojson, f, ensure_ascii=False)

        log.info("  Fleuve Oti exporté : %s (%d segments)", out_path, len(features))
        log.info("  Utiliser dans QGIS pour le buffer 5km (BLOC B5)")

    except Exception as exc:
        log.warning("  Overpass indisponible (%s)", exc)
        log.info("  Alternative manuelle :")
        log.info("    1. Télécharger OSM Togo : https://download.geofabrik.de/africa/togo.html")
        log.info("    2. Ouvrir dans QGIS → filtrer waterway=river name=Oti")
        log.info("    3. Sauvegarder dans data/raw/osm/oti_river_osm.geojson")


# ── Étape 4 : Instructions WDPA ───────────────────────────────────────
def step_wdpa_instructions():
    """Génère un fichier d'instructions pour le téléchargement WDPA."""

    instructions = """# Téléchargement WDPA — Aires protégées Togo

## URL de téléchargement
https://www.protectedplanet.net/country/TGO

## Procédure
1. Aller sur protectedplanet.net → Download → Togo (TGO)
2. Format : Shapefile (recommandé) ou GeoJSON
3. Sauvegarder dans : data/raw/wdpa/

## Aires protégées nécessaires pour le projet

### FOSSE AUX LIONS (CRITIQUE)
- Nom officiel : "Réserve de faune de la Fosse aux Lions"
- Superficie attendue : ~16.5 km²
- Localisation : Extrême nord, bbox 10.75-10.80°N / 0.17-0.25°E
- Utilisation : Masque de départ pour calcul TWI (BLOC B3)
- WDPA ID : à vérifier (chercher "Fosse" dans la liste TGO)

### OTI-KÉRAN-MANDOURI (OKM)
- Nom officiel : "Parc national de l'Oti-Kéran-Mandouri"
- Superficie attendue : ~147 000 ha (1 470 km²)
- Localisation : Extrême nord
- Utilisation : Condition 2 du triple critère Oti (BLOC B5)
- WDPA ID : à vérifier

## Vérification dans QGIS
Après téléchargement :
1. Ouvrir le shapefile WDPA dans QGIS
2. Filtrer : "NAME" LIKE '%Fosse%' OU "DESIG" LIKE '%Fosse%'
3. Vérifier superficie : doit être ~16.5 km² pour Fosse aux Lions
4. Exporter chaque zone séparément en GeoJSON EPSG:4326 :
   - data/raw/wdpa/fosse_lions_wdpa.geojson
   - data/raw/wdpa/oti_keran_mandouri_wdpa.geojson
"""

    out_path = OUT_RAW / "wdpa" / "INSTRUCTIONS_TELECHARGEMENT_WDPA.md"
    out_path.write_text(instructions, encoding="utf-8")
    log.info("  Instructions WDPA : %s", out_path)


# ── Étape 5 : Résumé de l'état des acquisitions ───────────────────────
def step_status_check(conn):
    """Vérifie l'état d'acquisition de chaque couche de données."""

    log.info("\n" + "=" * 60)
    log.info("ÉTAT ACQUISITION DONNÉES — BLOC A")
    log.info("=" * 60)

    # A4 — Sentinel-2 (déjà en base)
    cur = conn.cursor()
    cur.execute("SELECT COUNT(*), COUNT(clay_index) FROM atlas.maille_spectral_vfs")
    total, with_clay = cur.fetchone()
    cur.close()

    checks = [
        ("A1 — MNT Copernicus 10m",
         (OUT_RAW / "copernicus_dem").exists() and
         any((OUT_RAW / "copernicus_dem").iterdir()) if (OUT_RAW / "copernicus_dem").exists() else False,
         f"Télécharger depuis GEE → dossier atlas_togo_data"),
        ("A2 — JRC GSW Max Extent",
         any((OUT_RAW / "jrc_gsw").iterdir()) if (OUT_RAW / "jrc_gsw").exists() else False,
         "Télécharger depuis GEE → dossier atlas_togo_data"),
        ("A3 — WDPA Togo",
         any((OUT_RAW / "wdpa" / f).exists() for f in
             ["fosse_lions_wdpa.geojson", "oti_keran_mandouri_wdpa.geojson"]),
         "Télécharger depuis protectedplanet.net/country/TGO"),
        ("A4 — Sentinel-2 Clay Index",
         with_clay == total and total > 0,
         f"✅ DÉJÀ EN BASE : {with_clay}/{total} mailles avec clay_index"),
        ("A5 — OSM fleuve Oti",
         (OUT_RAW / "osm" / "oti_river_osm.geojson").exists(),
         "Télécharger via Overpass ou Geofabrik"),
    ]

    for label, done, note in checks:
        status = "✅ OK" if done else "⬜ MANQUANT"
        log.info("  %s : %s", label, status)
        if not done:
            log.info("       → %s", note)

    log.info("\nScripts GEE disponibles dans : %s", OUT_GEE)
    log.info("Lancer GEE : https://code.earthengine.google.com/ (projet gen-lang-client-0964618990)")


# ── Point d'entrée ─────────────────────────────────────────────────────
def main() -> int:
    ap = argparse.ArgumentParser(
        description="Préparation données pour délimitation zones géologiques Atlas Togo"
    )
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--step", choices=["all", "clay_export", "gee_scripts", "osm", "status"],
                    default="all")
    args = ap.parse_args()

    conn = None
    if args.step in ("all", "clay_export", "status"):
        conn = get_conn(args.database_url)

    try:
        if args.step in ("all", "gee_scripts"):
            step_gee_scripts()
            step_wdpa_instructions()

        if args.step in ("all", "osm"):
            step_osm_download()

        if args.step in ("all", "clay_export") and conn:
            step_clay_export(conn)

        if args.step in ("all", "status") and conn:
            step_status_check(conn)

        log.info("\nTerminé. Prochaines étapes :")
        log.info("  1. Ouvrir GEE : https://code.earthengine.google.com/")
        log.info("  2. Copier-coller les scripts depuis data/raw/gee_scripts/")
        log.info("  3. Lancer les exports (Tasks panel → Run)")
        log.info("  4. Télécharger les GeoTIFF depuis Google Drive vers data/raw/")
        log.info("  5. Télécharger WDPA Togo depuis protectedplanet.net")
        log.info("  6. Passer au BLOC B (traitement QGIS/Python par zone)")
        return 0

    except Exception as exc:
        log.exception("ERREUR : %s", exc)
        return 1
    finally:
        if conn:
            conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
