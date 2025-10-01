import os
import psycopg


def get_conn():
    url = os.getenv("DATABASE_URL")
    if not url:
        raise RuntimeError("DATABASE_URL manquant")
    return psycopg.connect(url)
