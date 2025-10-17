#!/usr/bin/env python3
"""
Script simple pour charger les ADM depuis les shapefiles.
À exécuter dans le conteneur ETL existant.
"""
import geopandas as gpd
from sqlalchemy import create_engine, text
from pathlib import Path

DB_URL = "postgresql://atlas:atlas@db:5432/atlas"

def load_adm_level(level, shapefile_path, table_name):
    """Charge un niveau ADM dans la base."""
    print(f"\n📂 Chargement {level} depuis {shapefile_path}")
    
    if not Path(shapefile_path).exists():
        print(f"❌ Fichier non trouvé: {shapefile_path}")
        return False
    
    # Lire le shapefile
    gdf = gpd.read_file(shapefile_path)
    print(f"✓ {len(gdf)} zones trouvées")
    
    # Reprojection si nécessaire
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        print(f"  Reprojection vers EPSG:4326...")
        gdf = gdf.to_crs(epsg=4326)
    
    # Assurer MultiPolygon
    gdf['geometry'] = gdf['geometry'].apply(
        lambda geom: geom if geom.geom_type == 'MultiPolygon' 
        else gpd.GeoSeries([geom]).unary_union
    )
    
    # Préparer les colonnes selon le niveau
    if level == "ADM1":
        gdf_clean = gpd.GeoDataFrame({
            'name': gdf.get('ADM1_FR', gdf.get('ADM1_EN', gdf.get('ADM1_PCODE', ''))),
            'name_en': gdf.get('ADM1_EN', ''),
            'code': gdf.get('ADM1_PCODE', ''),
            'geometry': gdf['geometry']
        }, crs='EPSG:4326')
    elif level == "ADM2":
        gdf_clean = gpd.GeoDataFrame({
            'name': gdf.get('ADM2_FR', gdf.get('ADM2_EN', gdf.get('ADM2_PCODE', ''))),
            'name_en': gdf.get('ADM2_EN', ''),
            'code': gdf.get('ADM2_PCODE', ''),
            'adm1_name': gdf.get('ADM1_FR', gdf.get('ADM1_EN', '')),
            'adm1_code': gdf.get('ADM1_PCODE', ''),
            'geometry': gdf['geometry']
        }, crs='EPSG:4326')
    elif level == "ADM3":
        gdf_clean = gpd.GeoDataFrame({
            'name': gdf.get('ADM3_FR', gdf.get('ADM3_EN', gdf.get('ADM3_PCODE', ''))),
            'name_en': gdf.get('ADM3_EN', ''),
            'code': gdf.get('ADM3_PCODE', ''),
            'adm2_name': gdf.get('ADM2_FR', gdf.get('ADM2_EN', '')),
            'adm2_code': gdf.get('ADM2_PCODE', ''),
            'adm1_name': gdf.get('ADM1_FR', gdf.get('ADM1_EN', '')),
            'adm1_code': gdf.get('ADM1_PCODE', ''),
            'geometry': gdf['geometry']
        }, crs='EPSG:4326')
    else:
        print(f"❌ Niveau inconnu: {level}")
        return False
    
    # Connexion DB et insertion
    engine = create_engine(DB_URL)
    print(f"  Insertion dans {table_name}...")
    
    gdf_clean.to_postgis(
        table_name,
        engine,
        if_exists='append',
        index=False,
        dtype={'geometry': 'Geometry'}
    )
    
    print(f"✅ {len(gdf_clean)} zones chargées dans {table_name}")
    return True

def main():
    print("🗺️  Chargement des divisions administratives du Togo\n")
    
    base_path = "/data/shp/togo"
    
    # ADM1
    success = load_adm_level(
        "ADM1",
        f"{base_path}/tgo_admbnda_adm1_inseed_itos_20210107.shp",
        "adm1_tg"
    )
    
    if not success:
        return
    
    # ADM2
    success = load_adm_level(
        "ADM2",
        f"{base_path}/tgo_admbnda_adm2_inseed_itos_20210107.shp",
        "adm2_tg"
    )
    
    if not success:
        return
    
    # ADM3
    success = load_adm_level(
        "ADM3",
        f"{base_path}/tgo_admbnda_adm3_inseed_20210107.shp",
        "adm3_tg"
    )
    
    print("\n✅ Chargement complet terminé!")

if __name__ == "__main__":
    main()
