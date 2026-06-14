#!/usr/bin/env python3
"""
Cherche et exporte les zones WDPA nécessaires depuis GEE :
- Fosse aux Lions
- Oti-Kéran-Mandouri (OKM)
Exporte en GeoJSON EPSG:4326 dans data/raw/wdpa/
"""
import ee
import json
import os

ee.Initialize(project='gen-lang-client-0964618990')

togo = ee.Geometry.Rectangle([0.0, 6.0, 1.9, 11.2])
wdpa = ee.FeatureCollection('WCMC/WDPA/current/polygons').filterBounds(togo)

all_names = wdpa.aggregate_array('NAME').getInfo()
print("Recherche Fosse aux Lions et Oti-Keran-Mandouri...")

fosse_names = [n for n in all_names if 'fosse' in n.lower() or 'lion' in n.lower()]
oti_names = [n for n in all_names if 'oti' in n.lower() or 'keran' in n.lower() or 'mandouri' in n.lower()]

print("Fosse :", fosse_names)
print("Oti   :", oti_names)

os.makedirs("data/raw/wdpa", exist_ok=True)

def export_zone(name, filename):
    fc = wdpa.filter(ee.Filter.eq('NAME', name))
    info = fc.getInfo()
    feats = info.get('features', [])
    if not feats:
        print("  INTROUVABLE:", name)
        return None

    props = feats[0].get('properties', {})
    area = props.get('GIS_AREA', props.get('REP_AREA', '?'))
    status = props.get('STATUS', '?')
    print("  Trouvé:", name, "| GIS_AREA:", area, "km2 | STATUS:", status)

    geojson = {"type": "FeatureCollection", "features": feats}
    path = os.path.join("data/raw/wdpa", filename)
    with open(path, "w", encoding="utf-8") as f:
        json.dump(geojson, f, ensure_ascii=False, indent=2)
    print("  Exporté:", path)
    return path

# Chercher Fosse aux Lions
fosse_exported = None
if fosse_names:
    for n in fosse_names:
        fosse_exported = export_zone(n, "fosse_lions_wdpa.geojson")
else:
    # Recherche par bbox Fosse aux Lions (10.75-10.85°N / 0.12-0.30°E)
    print("Aucun nom Fosse trouvé — recherche par bbox...")
    fosse_bbox = ee.Geometry.Rectangle([0.10, 10.70, 0.32, 10.90])
    fc_bbox = wdpa.filterBounds(fosse_bbox)
    names_bbox = fc_bbox.aggregate_array('NAME').getInfo()
    print("  Zones dans bbox Fosse:", names_bbox)
    if names_bbox:
        fosse_exported = export_zone(names_bbox[0], "fosse_lions_wdpa.geojson")

# Chercher Oti-Kéran-Mandouri
oti_exported = None
if oti_names:
    for n in oti_names:
        oti_exported = export_zone(n, "oti_keran_mandouri_wdpa.geojson")
        if oti_exported:
            break

# Export GEE task pour avoir le shapefile complet si besoin
print("\nLancement export GEE tâche (toutes zones WDPA Togo)...")
task = ee.batch.Export.table.toDrive(
    collection=wdpa,
    description='wdpa_togo_all',
    folder='atlas_togo_data',
    fileNamePrefix='wdpa_togo_all',
    fileFormat='GeoJSON',
)
task.start()
print("  Task GEE lancée:", task.id)
print("  -> Drive/atlas_togo_data/wdpa_togo_all.geojson")
print("\nTerminé.")
