#!/usr/bin/env python3
import argparse
import datetime as dt
import hashlib
import json
import os
import subprocess
from pathlib import Path


def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
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

    manifest = {
        "created_at": dt.datetime.now(dt.timezone.utc).isoformat(),
        "db_name": args.db_name,
        "format": args.format,
        "sha256": sha,
        "size_bytes": size_bytes,
        "git_commit": git_commit_short(),
    }

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)
        f.write("\n")

    print(str(out_path))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
