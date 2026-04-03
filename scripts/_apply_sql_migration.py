"""Apply a single SQL migration file in one transaction (psycopg2 multi-statement)."""
from __future__ import annotations

import os
import sys
from pathlib import Path


def load_env() -> None:
    root = Path(__file__).resolve().parent.parent
    p = root / ".env"
    if p.exists():
        try:
            from dotenv import load_dotenv

            load_dotenv(p)
        except ImportError:
            for line in p.read_text(encoding="utf-8", errors="replace").splitlines():
                line = line.strip()
                if not line or line.startswith("#") or "=" not in line:
                    continue
                k, v = line.split("=", 1)
                os.environ.setdefault(k.strip(), v.strip().strip('"\''))


def main() -> None:
    load_env()
    if len(sys.argv) < 2:
        print("Usage: _apply_sql_migration.py <path-to.sql>", file=sys.stderr)
        sys.exit(1)
    path = Path(sys.argv[1])
    if not path.is_file():
        print("Not a file:", path, file=sys.stderr)
        sys.exit(1)
    sql = path.read_text(encoding="utf-8")
    import psycopg2

    url = os.environ.get("DATABASE_URL", "").strip()
    if not url:
        print("DATABASE_URL missing", file=sys.stderr)
        sys.exit(2)
    conn = psycopg2.connect(url)
    conn.autocommit = False
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
        conn.commit()
        print("OK:", path.name)
    except Exception as e:
        conn.rollback()
        print("FAILED:", path.name, e, file=sys.stderr)
        sys.exit(1)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
