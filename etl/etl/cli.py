import os
import uuid
import json
import math
import random
from datetime import date
import typer
from dotenv import load_dotenv
from .db import get_conn

app = typer.Typer(help="CLI ETL pour charger des données d'exemple et gérer les migrations")

@app.command()
def load_sample():
    """Insère des mailles (3), sondages (8) et essais (16–24) proches de Lomé.
    - Truncate sondages/essais
    - Upsert mailles par code
    - Géométries saisies en 4326 puis transformées en 25231"""
    load_dotenv()
    conn = get_conn()
    with conn, conn.cursor() as cur:
        # Truncate sondages/essais (réensemencement)
        cur.execute("TRUNCATE TABLE essais RESTART IDENTITY CASCADE")
        cur.execute("TRUNCATE TABLE sondages RESTART IDENTITY CASCADE")

        # Upsert mailles (3 + 2 supplémentaires)
        mailles = [
            ("TG-001", "POLYGON((1.20 6.12, 1.22 6.12, 1.22 6.14, 1.20 6.14, 1.20 6.12))"),
            ("TG-002", "POLYGON((1.22 6.12, 1.24 6.12, 1.24 6.14, 1.22 6.14, 1.22 6.12))"),
            ("TG-003", "POLYGON((1.20 6.14, 1.22 6.14, 1.22 6.16, 1.20 6.16, 1.20 6.14))"),
            ("TG-004", "POLYGON((1.24 6.12, 1.26 6.12, 1.26 6.14, 1.24 6.14, 1.24 6.12))"),
            ("TG-005", "POLYGON((1.22 6.14, 1.24 6.14, 1.24 6.16, 1.22 6.16, 1.22 6.14))"),
        ]
        for code, wkt in mailles:
            mid = str(uuid.uuid4())
            cur.execute(
                """
                INSERT INTO mailles(id, geom, code, stats)
                VALUES (%s, ST_Transform(ST_GeomFromText(%s,4326),25231), %s, %s)
                ON CONFLICT (code) DO UPDATE SET
                  geom = EXCLUDED.geom,
                  stats = EXCLUDED.stats,
                  updated_at = now()
                """,
                (mid, wkt, code, json.dumps({"samples": 0}))
            )

        # Sondages (8 + 4) – tous à la même date/source
        date_s = date(2024, 6, 15)
        src = "SEED"
        pts = [
            ("S1", (1.205, 6.125)), ("S2", (1.215, 6.135)), ("S3", (1.208, 6.132)),
            ("S4", (1.225, 6.125)), ("S5", (1.235, 6.135)), ("S6", (1.228, 6.138)),
            ("S7", (1.205, 6.145)), ("S8", (1.215, 6.155)),
            # supplémentaires (TG-004 & TG-005 zones)
            ("S9",  (1.245, 6.125)), ("S10", (1.255, 6.135)),
            ("S11", (1.225, 6.145)), ("S12", (1.235, 6.155)),
        ]
        sondage_ids = {}
        for name, (x, y) in pts:
            sid = str(uuid.uuid4())
            sondage_ids[name] = sid
            cur.execute(
                """
                INSERT INTO sondages(id, geom, date_sondage, source, meta)
                VALUES (%s, ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),25231), %s, %s, %s)
                """,
                (sid, x, y, date_s, src, json.dumps({"name": name}))
            )

        # Essais (2–3 par sondage)
        def ins(s_name, typ, depth, value, unit):
            cur.execute(
                "INSERT INTO essais(id, sondage_id, type, depth_m, value, unit, meta) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                (str(uuid.uuid4()), sondage_ids[s_name], typ, depth, value, unit, json.dumps({}))
            )

        # TG-001: S1, S2, S3
        ins("S1", "SPT_N", 1.5, 8, "blows/30cm")
        ins("S1", "qc",    3.0, 2.5, "MPa")
        ins("S1", "SPT_N", 6.0, 14, "blows/30cm")

        ins("S2", "SPT_N", 1.5, 12, "blows/30cm")
        ins("S2", "qc",    3.0, 4.0, "MPa")
        ins("S2", "SPT_N", 6.0, 18, "blows/30cm")

        ins("S3", "qc",    1.5, 3.2, "MPa")
        ins("S3", "SPT_N", 3.0, 10, "blows/30cm")
        ins("S3", "qc",    6.0, 5.0, "MPa")

        # TG-002: S4, S5, S6
        ins("S4", "SPT_N", 1.5, 9,  "blows/30cm")
        ins("S4", "qc",    3.0, 3.0, "MPa")
        ins("S4", "SPT_N", 6.0, 15, "blows/30cm")

        ins("S5", "SPT_N", 1.5, 16, "blows/30cm")
        ins("S5", "qc",    3.0, 6.0, "MPa")
        ins("S5", "SPT_N", 6.0, 22, "blows/30cm")

        ins("S6", "qc",    1.5, 4.0, "MPa")
        ins("S6", "SPT_N", 3.0, 14, "blows/30cm")
        ins("S6", "qc",    6.0, 7.5, "MPa")

        # TG-003: S7, S8
        ins("S7", "SPT_N", 1.5, 20, "blows/30cm")
        ins("S7", "qc",    3.0, 7.0,  "MPa")
        ins("S7", "SPT_N", 6.0, 28, "blows/30cm")

        ins("S8", "SPT_N", 1.5, 24, "blows/30cm")
        ins("S8", "qc",    3.0, 9.0,  "MPa")
        ins("S8", "SPT_N", 6.0, 32, "blows/30cm")

        # TG-004: S9, S10
        ins("S9",  "SPT_N", 1.5, 11, "blows/30cm")
        ins("S9",  "qc",    3.0, 3.5, "MPa")
        ins("S9",  "SPT_N", 6.0, 16, "blows/30cm")
        ins("S10", "SPT_N", 1.5, 9,  "blows/30cm")
        ins("S10","qc",    3.0, 2.8, "MPa")
        ins("S10","SPT_N", 6.0, 14, "blows/30cm")

        # TG-005: S11, S12
        ins("S11", "SPT_N", 1.5, 13, "blows/30cm")
        ins("S11", "qc",    3.0, 4.2, "MPa")
        ins("S11", "SPT_N", 6.0, 19, "blows/30cm")
        ins("S12", "SPT_N", 1.5, 17, "blows/30cm")
        ins("S12", "qc",    3.0, 5.5, "MPa")
        ins("S12", "SPT_N", 6.0, 23, "blows/30cm")

    typer.secho("Données d'exemple chargées (EPSG:25231).", fg=typer.colors.GREEN)

@app.command()
def migrate():
    """Exécute le script de migration init.sql dans la DB."""
    load_dotenv()
    # Dans le conteneur, les migrations sont montées sur /migrations
    sql_path = os.path.abspath("/migrations/init.sql")
    if not os.path.exists(sql_path):
        raise FileNotFoundError(sql_path)
    with open(sql_path, 'r', encoding='utf-8') as f:
        sql = f.read()
    conn = get_conn()
    with conn, conn.cursor() as cur:
        cur.execute(sql)
    typer.secho("Migration appliquée.", fg=typer.colors.GREEN)

@app.command("load-country")
def load_country(
    geojson_path: str = typer.Option(
        "/data/togo.geojson",
        "-g", "--geojson",
        help="Chemin vers le fichier GeoJSON du polygone du Togo (EPSG:4326)"
    ),
    truncate: bool = typer.Option(
        False,
        "--truncate/--no-truncate",
        help="Vider la table country_tg avant import"
    )
):
    """Charge le polygone du Togo depuis un fichier GeoJSON dans la table country_tg."""
    load_dotenv()
    if not os.path.exists(geojson_path):
        typer.secho(f"Fichier introuvable: {geojson_path}", fg=typer.colors.RED, err=True)
        raise typer.Exit(1)

    with open(geojson_path, 'r', encoding='utf-8') as f:
        geojson = json.load(f)

    # Extraire la géométrie du premier feature
    if geojson.get("type") == "FeatureCollection" and geojson.get("features"):
        feature = geojson["features"][0]
        geom = feature["geometry"]
        name = feature.get("properties", {}).get("name", "Togo")
    elif geojson.get("type") == "Feature":
        geom = geojson["geometry"]
        name = geojson.get("properties", {}).get("name", "Togo")
    else:
        typer.secho("Format GeoJSON invalide", fg=typer.colors.RED, err=True)
        raise typer.Exit(1)

    geom_wkt = _geojson_geom_to_wkt(geom)

    conn = get_conn()
    with conn, conn.cursor() as cur:
        # Nettoyer l'ancienne version si demandé
        if truncate:
            cur.execute("DELETE FROM country_tg")
            typer.secho("✓ Table country_tg vidée", fg=typer.colors.YELLOW)
        # Insérer le nouveau polygone
        cur.execute(
            """
            INSERT INTO country_tg (name, geom)
            VALUES (%s, ST_GeomFromText(%s, 4326))
            """,
            (name, geom_wkt)
        )

    typer.secho(f"✓ Polygone du Togo chargé depuis {geojson_path}", fg=typer.colors.GREEN)

def _geojson_geom_to_wkt(geom: dict) -> str:
    """Convertit une géométrie GeoJSON en WKT."""
    geom_type = geom["type"]
    coords = geom["coordinates"]

    if geom_type == "Polygon":
        rings = []
        for ring in coords:
            points = ", ".join(f"{lon} {lat}" for lon, lat in ring)
            rings.append(f"({points})")
        return f"POLYGON({', '.join(rings)})"
    elif geom_type == "MultiPolygon":
        polys = []
        for poly in coords:
            rings = []
            for ring in poly:
                points = ", ".join(f"{lon} {lat}" for lon, lat in ring)
                rings.append(f"({points})")
            polys.append(f"({', '.join(rings)})")
        return f"MULTIPOLYGON({', '.join(polys)})"
    else:
        raise ValueError(f"Type de géométrie non supporté: {geom_type}")

@app.command("make-grid")
def make_grid(
    cell_area_m2: float = typer.Option(
        2_000_000.0,
        "--cell-area-m2",
        help="Aire cible par maille en m² (défaut: 2 000 000 m² = 2 km²)"
    ),
    to_srid: int = typer.Option(
        25231,
        "--to-srid",
        help="SRID de travail en mètres (défaut: 25231 pour Togo)"
    ),
    min_area_m2: float = typer.Option(
        1.0,
        "--min-area-m2",
        help="Seuil minimal d'aire pour filtrer les reliquats (m²)"
    ),
    truncate: bool = typer.Option(
        False,
        "--truncate/--no-truncate",
        help="Vider la table mailles avant génération"
    )
):
    """Génère une grille nationale couvrant le Togo avec des mailles carrées de ~cell_m2."""
    load_dotenv()
    conn = get_conn()

    # Calculer le côté du carré
    side_m = math.sqrt(cell_area_m2)
    typer.secho(f"Génération grille : aire cible = {cell_area_m2:,.0f} m² → côté ≈ {side_m:.2f} m", fg=typer.colors.CYAN)

    with conn, conn.cursor() as cur:
        # Vérifier que le polygone du Togo existe
        cur.execute("SELECT COUNT(*) FROM country_tg")
        if cur.fetchone()[0] == 0:
            typer.secho("❌ Aucun polygone trouvé dans country_tg. Exécutez d'abord : etl load-country", fg=typer.colors.RED, err=True)
            raise typer.Exit(1)

        # Nettoyer les mailles existantes si demandé
        if truncate:
            cur.execute("TRUNCATE TABLE mailles RESTART IDENTITY CASCADE")
            typer.secho("✓ Mailles existantes supprimées", fg=typer.colors.YELLOW)

        # Générer la grille via PostGIS
        typer.secho("Génération de la grille (peut prendre quelques secondes)...", fg=typer.colors.CYAN)

        sql = """
        WITH tg AS (
          SELECT ST_Transform(geom, 25231) AS g
          FROM country_tg
          LIMIT 1
        ),
        env AS (
          SELECT ST_Envelope(g) AS bbox FROM tg
        ),
        grid_raw AS (
          SELECT
            (ST_SquareGrid(%(side)s, (SELECT bbox FROM env))).geom AS cell,
            (ST_SquareGrid(%(side)s, (SELECT bbox FROM env))).i AS col,
            (ST_SquareGrid(%(side)s, (SELECT bbox FROM env))).j AS row
        ),
        grid_clip AS (
          SELECT
            ST_Intersection(cell, (SELECT g FROM tg)) AS geom,
            col, row
          FROM grid_raw
          WHERE ST_Intersects(cell, (SELECT g FROM tg))
        ),
        grid_ok AS (
          SELECT
            geom,
            col,
            row,
            ROW_NUMBER() OVER (ORDER BY row, col) AS seq
          FROM grid_clip
          WHERE geom IS NOT NULL AND ST_Area(geom) > %(min_area)s
        )
        INSERT INTO mailles(id, geom, code, stats)
        SELECT
          gen_random_uuid(),
          geom,
          'TG-' || LPAD(seq::text, 4, '0') AS code,
          '{"samples":0}'::jsonb
        FROM grid_ok
        RETURNING code;
        """

        cur.execute(sql, {"side": side_m, "min_area": min_area_m2})
        inserted = cur.rowcount

    typer.secho(f"✓ {inserted} mailles générées avec succès", fg=typer.colors.GREEN)

@app.command("load-sample-extended")
def load_sample_extended(
    seed: int = typer.Option(
        42,
        "-s", "--seed",
        help="Graine aléatoire pour reproductibilité"
    ),
    n_min: int = typer.Option(
        19,
        "--n-min",
        help="Nombre minimum de sondages à générer"
    ),
    n_max: int = typer.Option(
        31,
        "--n-max",
        help="Nombre maximum de sondages à générer"
    ),
    truncate: bool = typer.Option(
        False,
        "--truncate/--no-truncate",
        help="Vider les tables sondages/essais avant génération"
    )
):
    """
    Génère des sondages et essais fictifs répartis dans plusieurs villes du Togo
    avec des distributions logiques (SPT_N, qc, profondeurs).

    Cette commande remplace load_sample et génère beaucoup plus de données.
    """
    load_dotenv()
    random.seed(seed)

    # Configuration des villes (lon, lat, nb_sondages, rayon_km, biais)
    CITIES = [
        {
            "name": "Lome",
            "lon": 1.215, "lat": 6.131,
            "n": (8, 12),
            "radius_km": (3.0, 6.0),
            "spt_bias": -2,
            "qc_bias": -0.5
        },
        {
            "name": "Sokode",
            "lon": 1.131, "lat": 8.984,
            "n": (4, 7),
            "radius_km": (2.0, 4.0),
            "spt_bias": 0,
            "qc_bias": 0.0
        },
        {
            "name": "Kara",
            "lon": 1.213, "lat": 9.551,
            "n": (4, 7),
            "radius_km": (2.0, 4.0),
            "spt_bias": 2,
            "qc_bias": 0.5
        },
        {
            "name": "Dapaong",
            "lon": 0.205, "lat": 10.862,
            "n": (3, 5),
            "radius_km": (2.0, 4.0),
            "spt_bias": 1,
            "qc_bias": 0.2
        },
    ]

    def rand_in_disk_km(center_lon, center_lat, rmin_km, rmax_km):
        """Génère un point aléatoire dans un disque (approximation planaire)."""
        r_deg = random.uniform(rmin_km / 111.0, rmax_km / 111.0)  # ~111 km/degré
        theta = random.uniform(0, 2 * math.pi)
        return (
            center_lon + r_deg * math.cos(theta),
            center_lat + r_deg * math.sin(theta)
        )

    conn = get_conn()
    with conn, conn.cursor() as cur:
        # Nettoyer les données existantes si demandé
        if truncate:
            cur.execute("TRUNCATE TABLE essais RESTART IDENTITY CASCADE")
            cur.execute("TRUNCATE TABLE sondages RESTART IDENTITY CASCADE")
            typer.secho("✓ Données de sondage/essais nettoyées", fg=typer.colors.YELLOW)

        total_sondages = 0
        total_essais = 0
        date_s = date(2024, 6, 15)

        for city in CITIES:
            n_sondages = random.randint(*city["n"])
            typer.secho(f"Génération de {n_sondages} sondages pour {city['name']}...", fg=typer.colors.CYAN)

            for i in range(n_sondages):
                # Position aléatoire dans le rayon
                lon, lat = rand_in_disk_km(
                    city["lon"], city["lat"],
                    city["radius_km"][0], city["radius_km"][1]
                )

                # Insérer le sondage
                sondage_id = str(uuid.uuid4())
                cur.execute(
                    """
                    INSERT INTO sondages(id, geom, date_sondage, source, meta)
                    VALUES (
                        %s,
                        ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 25231),
                        %s,
                        %s,
                        %s
                    )
                    """,
                    (
                        sondage_id,
                        lon, lat,
                        date_s,
                        f"SEED-{city['name']}",
                        json.dumps({"city": city["name"], "index": i})
                    )
                )
                total_sondages += 1

                # Générer 2-4 essais par sondage
                n_essais = random.randint(2, 4)
                for j in range(n_essais):
                    # Valeurs de base avec distribution gaussienne
                    spt_base = max(1, random.gauss(18, 7) + city["spt_bias"])
                    qc_base = max(0.2, random.gauss(4.0, 2.0) + city["qc_bias"])

                    # Corrélation légère entre SPT_N et qc
                    qc = qc_base + 0.03 * (spt_base - 18)
                    spt = spt_base + 0.3 * (qc_base - 4.0)

                    # Profondeur avec distribution triangulaire (mode = 8m)
                    depth = max(1.0, random.triangular(1.0, 20.0, 8.0))

                    # Choisir le type d'essai (60% SPT_N, 40% qc)
                    if random.random() < 0.6:
                        essai_type = "SPT_N"
                        value = round(spt, 1)
                        unit = "blows/30cm"
                    else:
                        essai_type = "qc"
                        value = round(qc, 2)
                        unit = "MPa"

                    # Insérer l'essai
                    cur.execute(
                        """
                        INSERT INTO essais(id, sondage_id, type, depth_m, value, unit, meta)
                        VALUES (%s, %s, %s, %s, %s, %s, %s)
                        """,
                        (
                            str(uuid.uuid4()),
                            sondage_id,
                            essai_type,
                            round(depth, 2),
                            value,
                            unit,
                            json.dumps({})
                        )
                    )
                    total_essais += 1

    typer.secho(
        f"✓ Seed multi-villes terminé : {total_sondages} sondages, {total_essais} essais (seed={seed})",
        fg=typer.colors.GREEN
    )

if __name__ == "__main__":
    app()
