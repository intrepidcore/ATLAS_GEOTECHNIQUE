#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
from pathlib import Path


def next_semver_patch(version: str) -> str:
    parts = (version or "").strip().split(".")
    if len(parts) != 3:
        return "1.0.0"

    try:
        major = int(parts[0])
        minor = int(parts[1])
        patch = int(parts[2])
    except ValueError:
        return "1.0.0"
    return f"{major}.{minor}.{patch + 1}"


def _find_repo_root(start: Path) -> Path | None:
    p = start.resolve()
    for _ in range(10):
        if (p / "db" / "migrations").exists():
            return p
        if p.parent == p:
            break
        p = p.parent
    return None


def _max_migration_applied(repo_root: Path) -> int:
    mig_dir = repo_root / "db" / "migrations"
    if not mig_dir.exists():
        return 0
    max_v = 0
    for f in mig_dir.glob("*.sql"):
        name = f.name
        prefix = name.split("_")[0]
        try:
            v = int(prefix)
        except ValueError:
            continue
        if v > max_v:
            max_v = v
    return max_v


def infer_seed_version(out_path: Path) -> str:
    if out_path.exists():
        try:
            m = json.loads(out_path.read_text(encoding="utf-8"))
            v = (m.get("identity") or {}).get("seed_version") or m.get("seed_version")
            if isinstance(v, str) and v.strip():
                return next_semver_patch(v)
        except Exception:
            return "1.0.0"
    return "1.0.0"


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def sha512_file(path: Path) -> str:
    h = hashlib.sha512()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def git_commit_short() -> str:
    try:
        out = subprocess.check_output(["git", "rev-parse", "--short", "HEAD"], stderr=subprocess.DEVNULL)
        return out.decode("utf-8").strip()
    except Exception:
        return "unknown"


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("dump", help="Path to pg_dump custom format file (.dump)")
    ap.add_argument("--db-name", default="atlas_clean")
    ap.add_argument("--format", default="pg_dump -Fc")
    ap.add_argument("--out", default=None, help="Output manifest path (default: <dump>.json)")
    args = ap.parse_args()

    dump_path = Path(args.dump)
    if not dump_path.exists() or not dump_path.is_file():
        raise SystemExit(f"Dump file not found: {dump_path}")

    out_path = Path(args.out) if args.out else dump_path.with_suffix(dump_path.suffix + ".json")

    size_bytes = dump_path.stat().st_size
    sha = sha256_file(dump_path)
    sha512 = sha512_file(dump_path)

    seed_id = os.environ.get("ATLAS_SEED_ID") or ""
    seed_version = os.environ.get("ATLAS_SEED_VERSION") or ""
    seed_environment = os.environ.get("ATLAS_SEED_ENVIRONMENT") or "production"
    seed_classification = os.environ.get("ATLAS_SEED_CLASSIFICATION") or "internal"
    created_by = os.environ.get("ATLAS_SEED_CREATED_BY") or os.environ.get("USERNAME") or os.environ.get("USER") or "unknown"

    postgres_target_major = os.environ.get("ATLAS_SEED_POSTGRES_TARGET_MAJOR")
    postgis_version = os.environ.get("ATLAS_SEED_POSTGIS_VERSION")
    max_migration_applied = os.environ.get("ATLAS_SEED_MAX_MIGRATION_APPLIED")

    created_at = dt.datetime.now(dt.timezone.utc).isoformat()
    git_commit = git_commit_short()

    if not seed_version.strip():
        seed_version = infer_seed_version(out_path)

    if not max_migration_applied or str(max_migration_applied).strip() == "":
        repo_root = _find_repo_root(dump_path.parent)
        if repo_root is not None:
            max_migration_applied = str(_max_migration_applied(repo_root))
        else:
            max_migration_applied = "0"

    manifest = {
        "schema_version": "2.0",
        "identity": {
            "seed_id": seed_id,
            "seed_version": seed_version,
            "environment": seed_environment,
            "classification": seed_classification,
        },
        "source": {
            "created_at": created_at,
            "created_by": created_by,
            "git_commit": git_commit,
            "db_name": args.db_name,
            "format": args.format,
        },
        "integrity": {
            "sha256": sha,
            "sha512": sha512,
            "size_bytes": size_bytes,
        },
        "compatibility": {
            "postgres_target_major": postgres_target_major,
            "postgis_version": postgis_version,
            "max_migration_applied": int(max_migration_applied),
        },
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "db_name": args.db_name,
        "format": args.format,
        "sha256": sha,
        "sha512": sha512,
        "size_bytes": size_bytes,
        "git_commit": git_commit,
        "postgres_target_major": int(postgres_target_major) if postgres_target_major else None,
        "postgis_version": postgis_version,
        "max_migration_applied": int(max_migration_applied) if max_migration_applied else None,
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
