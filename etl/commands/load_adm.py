"""
Commande ETL pour charger les divisions administratives du Togo (ADM1/2/3)
depuis les shapefiles INSEED.
"""
import typer
import geopandas as gpd
from pathlib import Path
from sqlalchemy import create_engine, text
import os

app = typer.Typer()


def get_db_engine():
    """Créer une connexion SQLAlchemy à la base de données."""
    db_url = os.getenv("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas")
    return create_engine(db_url)


@app.command()
def load_adm1(
    shapefile: Path = typer.Option(
        Path("data/shp/togo/tgo_admbnda_adm1_inseed_itos_20210107.shp"),
        help="Chemin vers le shapefile ADM1"
    ),
    truncate: bool = typer.Option(False, help="Vider la table avant import")
):
    """
    Charger les régions (ADM1) depuis le shapefile.
    """
    typer.echo(f"📂 Chargement ADM1 depuis {shapefile}")
    
    if not shapefile.exists():
        typer.echo(f"❌ Fichier non trouvé: {shapefile}", err=True)
        raise typer.Exit(1)
    
    # Lire le shapefile
    gdf = gpd.read_file(shapefile)
    typer.echo(f"✓ {len(gdf)} régions trouvées")
    
    # Convertir en EPSG:4326 si nécessaire
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        typer.echo(f"  Reprojection de {gdf.crs.to_epsg()} vers 4326...")
        gdf = gdf.to_crs(epsg=4326)
    
    # Assurer MultiPolygon
    gdf['geometry'] = gdf['geometry'].apply(
        lambda geom: geom if geom.geom_type == 'MultiPolygon' 
        else gpd.GeoSeries([geom]).unary_union
    )
    
    # Préparer les colonnes
    gdf_clean = gpd.GeoDataFrame({
        'name': gdf.get('ADM1_FR', gdf.get('ADM1_EN', gdf.get('ADM1_PCODE', ''))),
        'name_en': gdf.get('ADM1_EN', ''),
        'code': gdf.get('ADM1_PCODE', ''),
        'geometry': gdf['geometry']
    }, crs='EPSG:4326')
    
    # Connexion DB
    engine = get_db_engine()
    
    if truncate:
        typer.echo("  Vidage de la table adm1_tg...")
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE adm1_tg CASCADE"))
            conn.commit()
    
    # Insertion
    typer.echo("  Insertion dans PostgreSQL...")
    gdf_clean.to_postgis(
        'adm1_tg',
        engine,
        if_exists='append',
        index=False,
        dtype={'geometry': 'Geometry'}
    )
    
    typer.echo(f"✅ {len(gdf_clean)} régions chargées dans adm1_tg")


@app.command()
def load_adm2(
    shapefile: Path = typer.Option(
        Path("data/shp/togo/tgo_admbnda_adm2_inseed_itos_20210107.shp"),
        help="Chemin vers le shapefile ADM2"
    ),
    truncate: bool = typer.Option(False, help="Vider la table avant import")
):
    """
    Charger les préfectures (ADM2) depuis le shapefile.
    """
    typer.echo(f"📂 Chargement ADM2 depuis {shapefile}")
    
    if not shapefile.exists():
        typer.echo(f"❌ Fichier non trouvé: {shapefile}", err=True)
        raise typer.Exit(1)
    
    gdf = gpd.read_file(shapefile)
    typer.echo(f"✓ {len(gdf)} préfectures trouvées")
    
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        typer.echo(f"  Reprojection de {gdf.crs.to_epsg()} vers 4326...")
        gdf = gdf.to_crs(epsg=4326)
    
    gdf['geometry'] = gdf['geometry'].apply(
        lambda geom: geom if geom.geom_type == 'MultiPolygon' 
        else gpd.GeoSeries([geom]).unary_union
    )
    
    gdf_clean = gpd.GeoDataFrame({
        'name': gdf.get('ADM2_FR', gdf.get('ADM2_EN', gdf.get('ADM2_PCODE', ''))),
        'name_en': gdf.get('ADM2_EN', ''),
        'code': gdf.get('ADM2_PCODE', ''),
        'adm1_name': gdf.get('ADM1_FR', gdf.get('ADM1_EN', '')),
        'adm1_code': gdf.get('ADM1_PCODE', ''),
        'geometry': gdf['geometry']
    }, crs='EPSG:4326')
    
    engine = get_db_engine()
    
    if truncate:
        typer.echo("  Vidage de la table adm2_tg...")
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE adm2_tg CASCADE"))
            conn.commit()
    
    typer.echo("  Insertion dans PostgreSQL...")
    gdf_clean.to_postgis(
        'adm2_tg',
        engine,
        if_exists='append',
        index=False,
        dtype={'geometry': 'Geometry'}
    )
    
    typer.echo(f"✅ {len(gdf_clean)} préfectures chargées dans adm2_tg")


@app.command()
def load_adm3(
    shapefile: Path = typer.Option(
        Path("data/shp/togo/tgo_admbnda_adm3_inseed_20210107.shp"),
        help="Chemin vers le shapefile ADM3"
    ),
    truncate: bool = typer.Option(False, help="Vider la table avant import")
):
    """
    Charger les communes (ADM3) depuis le shapefile.
    """
    typer.echo(f"📂 Chargement ADM3 depuis {shapefile}")
    
    if not shapefile.exists():
        typer.echo(f"❌ Fichier non trouvé: {shapefile}", err=True)
        raise typer.Exit(1)
    
    gdf = gpd.read_file(shapefile)
    typer.echo(f"✓ {len(gdf)} communes trouvées")
    
    if gdf.crs and gdf.crs.to_epsg() != 4326:
        typer.echo(f"  Reprojection de {gdf.crs.to_epsg()} vers 4326...")
        gdf = gdf.to_crs(epsg=4326)
    
    gdf['geometry'] = gdf['geometry'].apply(
        lambda geom: geom if geom.geom_type == 'MultiPolygon' 
        else gpd.GeoSeries([geom]).unary_union
    )
    
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
    
    engine = get_db_engine()
    
    if truncate:
        typer.echo("  Vidage de la table adm3_tg...")
        with engine.connect() as conn:
            conn.execute(text("TRUNCATE TABLE adm3_tg CASCADE"))
            conn.commit()
    
    typer.echo("  Insertion dans PostgreSQL...")
    gdf_clean.to_postgis(
        'adm3_tg',
        engine,
        if_exists='append',
        index=False,
        dtype={'geometry': 'Geometry'}
    )
    
    typer.echo(f"✅ {len(gdf_clean)} communes chargées dans adm3_tg")


@app.command()
def load_all(truncate: bool = typer.Option(False, help="Vider les tables avant import")):
    """
    Charger tous les niveaux administratifs (ADM1, ADM2, ADM3).
    """
    typer.echo("🗺️  Chargement complet des divisions administratives du Togo\n")
    
    load_adm1(truncate=truncate)
    typer.echo()
    load_adm2(truncate=truncate)
    typer.echo()
    load_adm3(truncate=truncate)
    
    typer.echo("\n✅ Chargement complet terminé!")


if __name__ == "__main__":
    app()
