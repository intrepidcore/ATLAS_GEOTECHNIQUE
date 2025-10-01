import os
import uuid
import json
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

if __name__ == "__main__":
    app()
