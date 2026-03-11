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

try:
    import requests  # type: ignore
except Exception:
    requests = None


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


def get_database_url() -> str:
    load_dotenv()
    database_url = os.getenv("DATABASE_URL")
    if not database_url:
        return _build_database_url_from_env()
    if "@db:" in database_url:
        database_url = database_url.replace("@db:", "@localhost:")
    return database_url


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


def _split_full_name(full_name: str) -> Tuple[str, str]:
    parts = [p for p in full_name.replace("  ", " ").strip().split(" ") if p]
    if not parts:
        return ("Prénom", "Nom")
    if len(parts) == 1:
        return (parts[0], parts[0])
    return (" ".join(parts[1:]), parts[0])


def _get_api_base() -> str:
    base = (os.getenv("API_GEO_BASE") or os.getenv("API_BASE_URL") or "http://127.0.0.1:8000/api").strip()
    return base.rstrip("/")


def _ensure_requests_available() -> None:
    if requests is None:
        raise RuntimeError(
            "Le module 'requests' est requis pour appeler l'API (/auth/register/student). Installe-le dans ton environnement Python."
        )


def _lookup_user_and_student_ids(cur, email: str) -> Tuple[Optional[str], Optional[str]]:
    cur.execute(
        "SELECT id::text FROM atlas.users WHERE deleted_at IS NULL AND lower(email) = lower(%s) LIMIT 1",
        (email,),
    )
    row = cur.fetchone()
    user_id = row[0] if row else None
    if not user_id:
        return (None, None)

    cur.execute(
        "SELECT id::text FROM atlas.colab_students WHERE deleted_at IS NULL AND user_id = %s::uuid LIMIT 1",
        (user_id,),
    )
    row = cur.fetchone()
    student_id = row[0] if row else None
    return (user_id, student_id)


def _lookup_mission_id(cur, mission_code: str) -> Optional[str]:
    cur.execute(
        "SELECT id::text FROM atlas.colab_missions WHERE deleted_at IS NULL AND code = %s LIMIT 1",
        (mission_code,),
    )
    row = cur.fetchone()
    return row[0] if row else None


def _set_student_promotion(cur, user_id: str, promotion: str) -> None:
    cur.execute(
        "UPDATE atlas.colab_students SET promotion = %s, updated_at = now() WHERE user_id = %s::uuid",
        (promotion, user_id),
    )


def _create_assignment(cur, mission_id: str, student_id: str, role: str) -> bool:
    cur.execute(
        """
        INSERT INTO atlas.colab_mission_assignments (mission_id, student_id, role)
        VALUES (%s::uuid, %s::uuid, %s)
        ON CONFLICT ON CONSTRAINT unique_active_assignment DO NOTHING
        """,
        (mission_id, student_id, role),
    )
    return cur.rowcount > 0


def run_import(excel_path: str, sheet: str, promotion: str, dry_run: bool) -> int:
    _ensure_requests_available()

    api_base = _get_api_base()
    database_url = get_database_url()
    connect_kwargs = _resolve_psycopg2_connect_kwargs(database_url)

    df = pd.read_excel(excel_path, sheet_name=sheet)

    required = ["mission_code", "student_email", "student_name"]
    missing = [c for c in required if c not in df.columns]
    if missing:
        raise ValueError(f"Colonnes manquantes dans l'Excel: {missing}")

    conn = psycopg2.connect(**connect_kwargs)
    conn.autocommit = False
    cur = conn.cursor()

    created_users = 0
    existing_users = 0
    created_students = 0
    created_assignments = 0
    skipped_rows = 0
    missing_missions = 0
    bad_emails = 0

    for _, row in df.iterrows():
        mission_code = _normalize_str(row.get("mission_code"))
        email = _normalize_str(row.get("student_email"))
        full_name = _normalize_str(row.get("student_name"))

        if not mission_code or not email or not full_name:
            skipped_rows += 1
            continue

        email_norm = email.strip().lower()
        if "@" not in email_norm:
            bad_emails += 1
            continue

        first_name, last_name = _split_full_name(full_name)

        mission_id = _lookup_mission_id(cur, mission_code)
        if not mission_id:
            missing_missions += 1
            continue

        user_id, student_id = _lookup_user_and_student_ids(cur, email_norm)

        if not user_id:
            if dry_run:
                created_users += 1
                created_students += 1
                created_assignments += 1
                continue
            else:
                payload = {
                    "email": email_norm,
                    "password": "TempPass#2026-ChangeMe",
                    "first_name": first_name,
                    "last_name": last_name,
                    "phone": None,
                    "student_info": {
                        "matricule": None,
                        "school": "import",
                        "program": "import",
                        "level": "import",
                    },
                }

                r = requests.post(f"{api_base}/auth/register/student", json=payload, timeout=20)
                if not r.ok:
                    # Si compte existe déjà ou autre: on retombe sur la lookup DB pour décider
                    user_id2, student_id2 = _lookup_user_and_student_ids(cur, email_norm)
                    if not user_id2:
                        raise RuntimeError(f"Échec création user {email_norm}: HTTP {r.status_code} {r.text}")
                    user_id, student_id = user_id2, student_id2
                else:
                    created_users += 1
                    data = r.json() if r.text else {}
                    user_id = data.get("user_id") or _lookup_user_and_student_ids(cur, email_norm)[0]
                    student_id = _lookup_user_and_student_ids(cur, email_norm)[1]

        else:
            existing_users += 1

        if not user_id:
            raise RuntimeError(f"Impossible de résoudre user_id pour {email_norm}")

        if not student_id:
            # L'endpoint register_student crée colab_students, mais si user existant avant,
            # il est possible que la fiche n'existe pas.
            if dry_run:
                created_students += 1
            else:
                cur.execute(
                    """
                    INSERT INTO atlas.colab_students (user_id, promotion)
                    VALUES (%s::uuid, %s)
                    ON CONFLICT (user_id) DO NOTHING
                    """,
                    (user_id, promotion),
                )
                created_students += cur.rowcount
                _, student_id = _lookup_user_and_student_ids(cur, email_norm)

        if not dry_run:
            _set_student_promotion(cur, user_id, promotion)

        if not student_id:
            raise RuntimeError(f"Impossible de résoudre student_id pour {email_norm}")

        if dry_run:
            created_assignments += 1
        else:
            if _create_assignment(cur, mission_id, student_id, "membre"):
                created_assignments += 1

    if dry_run:
        conn.rollback()
    else:
        conn.commit()

    cur.close()
    conn.close()

    print(
        "OK: "
        f"dry_run={dry_run} "
        f"created_users~{created_users} existing_users~{existing_users} "
        f"created_students~{created_students} assignments~{created_assignments} "
        f"skipped_rows={skipped_rows} bad_emails={bad_emails} missing_missions={missing_missions}"
    )
    return 0


def main() -> int:
    load_dotenv()

    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True)
    parser.add_argument("--sheet", default="missions")
    parser.add_argument("--promotion", default="2025-2026")
    parser.add_argument("--dry-run", default="true")

    args = parser.parse_args()
    dry_run = str(args.dry_run).lower() == "true"

    return run_import(args.input, args.sheet, args.promotion, dry_run)


if __name__ == "__main__":
    raise SystemExit(main())
