#!/usr/bin/env python3
import hashlib
import os
import subprocess
import shutil
import sys
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable, Optional


@dataclass(frozen=True)
class PgConfig:
    host: str
    port: str
    user: str
    password: str
    dbname: str


def _resolve_psql_cmd() -> list[str]:
    psql = shutil.which("psql")
    if psql:
        return [psql]

    docker = shutil.which("docker")
    if docker:
        return ["docker", "compose", "exec", "-T", "db", "psql"]

    raise RuntimeError(
        "psql not found. Install PostgreSQL client tools (psql) or ensure Docker Desktop is installed "
        "so 'docker compose exec db psql' can be used."
    )


def _is_docker_compose_psql(cmd: list[str]) -> bool:
    return len(cmd) >= 5 and cmd[0] == "docker" and cmd[1] == "compose" and cmd[2] == "exec"


def _run_psql(cfg: PgConfig, sql: str) -> str:
    env = os.environ.copy()
    env["PGPASSWORD"] = cfg.password

    cmd = _resolve_psql_cmd() + [
        "-h",
        cfg.host,
        "-p",
        cfg.port,
        "-U",
        cfg.user,
        "-d",
        cfg.dbname,
        "-v",
        "ON_ERROR_STOP=1",
        "-tAc",
        sql,
    ]

    proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "psql failed (exit={}): {}".format(proc.returncode, proc.stderr.strip())
        )
    return proc.stdout.strip()


def _run_psql_file(cfg: PgConfig, path: Path) -> None:
    env = os.environ.copy()
    env["PGPASSWORD"] = cfg.password

    base = _resolve_psql_cmd()
    cmd = base + [
        "-h",
        cfg.host,
        "-p",
        cfg.port,
        "-U",
        cfg.user,
        "-d",
        cfg.dbname,
        "-v",
        "ON_ERROR_STOP=1",
    ]

    if _is_docker_compose_psql(base):
        # The SQL file path is on the host, not inside the container.
        # Feed the SQL via stdin to psql.
        sql = path.read_text(encoding="utf-8")
        proc = subprocess.run(
            cmd,
            env=env,
            capture_output=True,
            text=True,
            input=sql,
        )
    else:
        cmd = cmd + ["-f", str(path)]
        proc = subprocess.run(cmd, env=env, capture_output=True, text=True)
    if proc.returncode != 0:
        raise RuntimeError(
            "migration failed (file={} exit={}): {}".format(
                path.as_posix(), proc.returncode, proc.stderr.strip()
            )
        )


def _sha256_hex(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def _escape_literal(s: str) -> str:
    return s.replace("\\", "\\\\").replace("'", "''")


def _list_sql_files(dir_path: Path) -> list[Path]:
    if not dir_path.exists():
        return []
    files = [p for p in dir_path.iterdir() if p.is_file() and p.suffix.lower() == ".sql"]
    files.sort(key=lambda p: p.name)
    return files


def _ensure_schema_migrations(cfg: PgConfig) -> None:
    _run_psql(
        cfg,
        "CREATE SCHEMA IF NOT EXISTS atlas;\n"
        "CREATE TABLE IF NOT EXISTS atlas.schema_migrations (\n"
        "  migration_id TEXT PRIMARY KEY,\n"
        "  version INTEGER,\n"
        "  name TEXT NOT NULL,\n"
        "  checksum_sha256 TEXT NOT NULL,\n"
        "  applied_at TIMESTAMPTZ NOT NULL DEFAULT now(),\n"
        "  execution_ms INTEGER\n"
        ");",
    )


def _assert_fresh_db(cfg: PgConfig) -> None:
    out = _run_psql(cfg, "SELECT COUNT(*)::text FROM atlas.schema_migrations;")
    try:
        n = int(out.strip() or "0")
    except Exception:
        n = 0
    if n != 0:
        raise RuntimeError(
            "schema_migrations is not empty. This validator must run against a fresh database to reliably "
            "enforce checksums/idempotence. Drop/recreate the DB or run in CI with a clean instance."
        )


def _get_existing_checksum(cfg: PgConfig, migration_id: str) -> Optional[str]:
    mid = _escape_literal(migration_id)
    out = _run_psql(
        cfg,
        f"SELECT checksum_sha256 FROM atlas.schema_migrations WHERE migration_id='{mid}' LIMIT 1;",
    )
    return out if out else None


def _insert_migration_row(
    cfg: PgConfig,
    migration_id: str,
    version: Optional[int],
    checksum: str,
    execution_ms: int,
) -> None:
    mid = _escape_literal(migration_id)
    name = _escape_literal(migration_id)
    chk = _escape_literal(checksum)
    ver_sql = "NULL" if version is None else str(int(version))

    _run_psql(
        cfg,
        "INSERT INTO atlas.schema_migrations(migration_id, version, name, checksum_sha256, execution_ms) "
        f"VALUES ('{mid}', {ver_sql}, '{name}', '{chk}', {int(execution_ms)}) "
        "ON CONFLICT (migration_id) DO NOTHING;",
    )


def _version_from_filename(name: str) -> Optional[int]:
    prefix = name.split("_", 1)[0]
    try:
        return int(prefix)
    except Exception:
        return None


def apply_migrations_with_tracking(cfg: PgConfig, files: Iterable[Path], *, replay: bool) -> None:
    for p in files:
        migration_id = p.name
        checksum = _sha256_hex(p)

        existing = _get_existing_checksum(cfg, migration_id)
        if existing is not None and existing != checksum:
            raise RuntimeError(
                f"CHECKSUM_MISMATCH: file={migration_id} expected={existing} actual={checksum}"
            )

        start_ms = int(time.time() * 1000)
        _run_psql_file(cfg, p)
        end_ms = int(time.time() * 1000)
        exec_ms = max(0, end_ms - start_ms)

        if not replay:
            _insert_migration_row(
                cfg,
                migration_id=migration_id,
                version=_version_from_filename(migration_id),
                checksum=checksum,
                execution_ms=exec_ms,
            )


def main() -> int:
    cfg = PgConfig(
        host=os.environ.get("DB_HOST", "127.0.0.1"),
        port=os.environ.get("DB_PORT", "5432"),
        user=os.environ.get("DB_USER", "atlas"),
        password=os.environ.get("PGPASSWORD", os.environ.get("DB_PASSWORD", "atlas")),
        dbname=os.environ.get("DB_NAME", "atlas_clean"),
    )

    repo_root = Path(__file__).resolve().parents[1]

    migration_dirs = [
        repo_root / "migrations",
        repo_root / "db" / "migrations",
    ]
    if os.environ.get("ATLAS_APPLY_MIGRATIONS_POST_V1", "").strip() in {"1", "true", "yes"}:
        migration_dirs.append(repo_root / "migrations_post_v1")

    files: list[Path] = []
    for d in migration_dirs:
        files.extend(_list_sql_files(d))

    if not files:
        print("No migration files found")
        return 0

    _ensure_schema_migrations(cfg)
    _assert_fresh_db(cfg)

    print(f"Applying {len(files)} migrations...")
    apply_migrations_with_tracking(cfg, files, replay=False)

    print("Replaying migrations to enforce idempotence...")
    apply_migrations_with_tracking(cfg, files, replay=True)

    print("OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as e:
        print(str(e), file=sys.stderr)
        raise SystemExit(1)
