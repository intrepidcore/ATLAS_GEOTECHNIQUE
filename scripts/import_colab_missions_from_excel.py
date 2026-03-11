#!/usr/bin/env python3

import argparse
import os
import sys
import urllib.parse
from pathlib import Path
from typing import Dict, Optional, Tuple

import pandas as pd
import psycopg2
from dotenv import load_dotenv


def get_database_url() -> str:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return _build_database_url_from_env()
    if "@db:" in database_url:
        database_url = database_url.replace("@db:", "@localhost:")
    return database_url


def _read_text_file_best_effort(path: Path) -> Optional[str]:
    try:
        s = path.read_text(encoding="utf-8", errors="strict").strip()
        return s if s else None
    except Exception:
        return None


def _try_read_atlas_desktop_pg_password() -> Optional[str]:
    base = os.getenv("LOCALAPPDATA") or os.getenv("APPDATA")
    if not base:
        return None
    path = Path(base) / "IntrepidCore" / "Atlas" / "postgres.password"
    if not path.exists():
        return None
    return _read_text_file_best_effort(path)


def _build_database_url_from_env() -> str:
    host = os.getenv("PGHOST", "127.0.0.1")
    port = os.getenv("PGPORT")
    user = os.getenv("PGUSER")
    dbname = os.getenv("PGDATABASE")
    password = os.getenv("PGPASSWORD")

    if not user:
        user = os.getenv("POSTGRES_USER")
    if not dbname:
        dbname = os.getenv("POSTGRES_DB")
    if not password:
        password = os.getenv("POSTGRES_PASSWORD")

    if not port:
        port = "5432"
    if not password:
        password = _try_read_atlas_desktop_pg_password() or ""

    if not user or not dbname:
        raise ValueError("DATABASE_URL ou POSTGRES_USER/POSTGRES_DB requis")

    if password:
        return f"postgres://{urllib.parse.quote(user)}:{urllib.parse.quote(password)}@{host}:{port}/{urllib.parse.quote(dbname)}"
    return f"postgres://{urllib.parse.quote(user)}@{host}:{port}/{urllib.parse.quote(dbname)}"


def _resolve_psycopg2_connect_kwargs(database_url: str) -> Dict[str, object]:
    host = os.getenv("PGHOST")
    port = os.getenv("PGPORT")
    user = os.getenv("PGUSER")
    dbname = os.getenv("PGDATABASE")
    password = os.getenv("PGPASSWORD")
    if not password:
        password = _try_read_atlas_desktop_pg_password()

    if host and port and user and dbname:
        kwargs: Dict[str, object] = {
            "host": host,
            "port": int(str(port)),
            "user": user,
            "dbname": dbname,
        }
        if password:
            kwargs["password"] = password
        return kwargs

    parsed = urllib.parse.urlparse(database_url)
    if parsed.scheme not in ("postgres", "postgresql"):
        raise ValueError(f"DATABASE_URL invalide (scheme={parsed.scheme})")

    q = urllib.parse.parse_qs(parsed.query)
    kwargs = {
        "host": parsed.hostname or "127.0.0.1",
        "port": int(parsed.port or 5432),
        "user": urllib.parse.unquote(parsed.username or ""),
        "dbname": urllib.parse.unquote((parsed.path or "/").lstrip("/")),
    }
    if parsed.password:
        kwargs["password"] = urllib.parse.unquote(parsed.password)
    elif password:
        kwargs["password"] = password
    if "sslmode" in q and q["sslmode"]:
        kwargs["sslmode"] = q["sslmode"][0]
    return kwargs


def _normalize_str(v: object) -> Optional[str]:
    if v is None:
        return None
    s = str(v).strip()
    if not s or s.lower() == "nan":
        return None
    return s


def _infer_theme(title: Optional[str]) -> str:
    t = (title or "").lower()
    if "stabil" in t:
        return "stabilisation"
    return "reconnaissance"


def _infer_status(_: Optional[str]) -> str:
    return "draft"


def _parse_date(v: object) -> Optional[str]:
    if v is None or (isinstance(v, float) and pd.isna(v)):
        return None
    if isinstance(v, pd.Timestamp):
        return v.date().isoformat()
    try:
        ts = pd.to_datetime(v, errors="coerce")
        if pd.isna(ts):
            return None
        return ts.date().isoformat()
    except Exception:
        return None


def _resolve_maille_id(cur, maille_code: Optional[str]) -> Optional[str]:
    if not maille_code:
        return None
    cur.execute(
        "SELECT id::text FROM atlas.mailles WHERE code = %s LIMIT 1",
        (maille_code,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def import_missions(excel_path: str, sheet: str, dry_run: bool) -> int:
    database_url = get_database_url()

    connect_kwargs = _resolve_psycopg2_connect_kwargs(database_url)
    conn = psycopg2.connect(**connect_kwargs)
    conn.autocommit = False

    df = pd.read_excel(excel_path, sheet_name=sheet)

    required = ["mission_code", "mission_name"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes dans l'Excel: {missing}")

    cur = conn.cursor()

    inserted = 0
    updated = 0
    skipped = 0
    unresolved_mailles = 0

    for idx, row in df.iterrows():
        code = _normalize_str(row.get("mission_code"))
        title = _normalize_str(row.get("mission_name"))
        mission_id = _normalize_str(row.get("mission_id"))
        maille_code = _normalize_str(row.get("maille_code"))
        zone_label = _normalize_str(row.get("zone"))
        commune = _normalize_str(row.get("localite"))
        region = _normalize_str(row.get("region"))

        if not code or not title:
            skipped += 1
            continue

        maille_id = _resolve_maille_id(cur, maille_code)
        if maille_code and not maille_id:
            unresolved_mailles += 1

        notes_internal = None
        if maille_code:
            notes_internal = f"import_source:export_missions maille_code={maille_code}"

        theme = _infer_theme(title)
        status = _infer_status(_normalize_str(row.get("operational_status")))
        start_date = _parse_date(row.get("date_start"))
        end_date = _parse_date(row.get("date_end"))

        if dry_run:
            cur.execute(
                "SELECT id::text FROM atlas.colab_missions WHERE code = %s",
                (code,),
            )
            existing = cur.fetchone()
            if existing:
                updated += 1
            else:
                inserted += 1
            continue

        if mission_id:
            cur.execute(
                """
                INSERT INTO atlas.colab_missions (
                    id, code, title, theme, maille_id, zone_label, commune, region,
                    start_date, end_date, expected_sondages, status, notes_internal
                )
                VALUES (
                    %s::uuid, %s, %s, %s::mission_theme, %s::uuid, %s, %s, %s,
                    %s::date, %s::date, 0, %s::mission_status, %s
                )
                ON CONFLICT (code) DO UPDATE SET
                    title = EXCLUDED.title,
                    theme = EXCLUDED.theme,
                    maille_id = EXCLUDED.maille_id,
                    zone_label = EXCLUDED.zone_label,
                    commune = EXCLUDED.commune,
                    region = EXCLUDED.region,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date,
                    status = EXCLUDED.status,
                    notes_internal = COALESCE(EXCLUDED.notes_internal, atlas.colab_missions.notes_internal),
                    updated_at = NOW()
                """,
                (
                    mission_id,
                    code,
                    title,
                    theme,
                    maille_id,
                    zone_label,
                    commune,
                    region,
                    start_date,
                    end_date,
                    status,
                    notes_internal,
                ),
            )
        else:
            cur.execute(
                """
                INSERT INTO atlas.colab_missions (
                    code, title, theme, maille_id, zone_label, commune, region,
                    start_date, end_date, expected_sondages, status, notes_internal
                )
                VALUES (
                    %s, %s, %s::mission_theme, %s::uuid, %s, %s, %s,
                    %s::date, %s::date, 0, %s::mission_status, %s
                )
                ON CONFLICT (code) DO UPDATE SET
                    title = EXCLUDED.title,
                    theme = EXCLUDED.theme,
                    maille_id = EXCLUDED.maille_id,
                    zone_label = EXCLUDED.zone_label,
                    commune = EXCLUDED.commune,
                    region = EXCLUDED.region,
                    start_date = EXCLUDED.start_date,
                    end_date = EXCLUDED.end_date,
                    status = EXCLUDED.status,
                    notes_internal = COALESCE(EXCLUDED.notes_internal, atlas.colab_missions.notes_internal),
                    updated_at = NOW()
                """,
                (
                    code,
                    title,
                    theme,
                    maille_id,
                    zone_label,
                    commune,
                    region,
                    start_date,
                    end_date,
                    status,
                    notes_internal,
                ),
            )

        cur.execute(
            "SELECT EXISTS(SELECT 1 FROM atlas.colab_missions WHERE code = %s)",
            (code,),
        )

    if not dry_run:
        conn.commit()

    cur.close()
    conn.close()

    if unresolved_mailles:
        print(f"WARN: {unresolved_mailles} lignes avec maille_code non résolu (maille_id NULL)", file=sys.stderr)

    print(f"OK: inserted~{inserted} updated~{updated} skipped={skipped} rows={len(df)}")
    return 0


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--sheet", default="missions")
    parser.add_argument("--dry-run", default="true")

    args = parser.parse_args()

    dry_run = str(args.dry_run).lower() == "true"
    return import_missions(args.input, args.sheet, dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
