#!/usr/bin/env python3
import argparse
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path


@dataclass(frozen=True)
class ArchiveInfo:
    seed_version: str
    git_commit: str


def _read_manifest_info(manifest_path: Path) -> ArchiveInfo:
    if not manifest_path.exists():
        return ArchiveInfo(seed_version="unknown", git_commit="unknown")

    try:
        m = json.loads(manifest_path.read_text(encoding="utf-8"))
    except Exception:
        return ArchiveInfo(seed_version="unknown", git_commit="unknown")

    seed_version = (
        (m.get("identity") or {}).get("seed_version")
        or m.get("seed_version")
        or "unknown"
    )
    git_commit = (m.get("source") or {}).get("git_commit") or m.get("git_commit") or "unknown"
    return ArchiveInfo(seed_version=str(seed_version), git_commit=str(git_commit))


def _safe(s: str) -> str:
    s = s.strip()
    s = re.sub(r"[^A-Za-z0-9._-]+", "_", s)
    return s or "unknown"


def apply_retention(versions_dir: Path, keep: int) -> None:
    dumps = sorted(versions_dir.glob("atlas_desktop_seed_v*.dump"), key=lambda p: p.stat().st_mtime)
    if len(dumps) <= keep:
        return

    for old in dumps[: -keep]:
        try:
            old.unlink(missing_ok=True)
        except Exception:
            pass
        old_json = old.with_suffix(old.suffix + ".json")
        try:
            old_json.unlink(missing_ok=True)
        except Exception:
            pass


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--seed", required=True, help="Path to current atlas_desktop_seed.dump")
    ap.add_argument(
        "--versions-dir",
        required=True,
        help="Directory to store archived seeds (e.g. data/db/backups/versions)",
    )
    ap.add_argument("--keep", type=int, default=3)
    args = ap.parse_args()

    seed_path = Path(args.seed)
    if not seed_path.exists() or not seed_path.is_file():
        return 0

    manifest_path = seed_path.with_suffix(seed_path.suffix + ".json")
    info = _read_manifest_info(manifest_path)

    versions_dir = Path(args.versions_dir)
    versions_dir.mkdir(parents=True, exist_ok=True)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    name = f"atlas_desktop_seed_v{_safe(info.seed_version)}_{ts}_{_safe(info.git_commit)}.dump"

    dst_dump = versions_dir / name
    shutil.copy2(seed_path, dst_dump)

    if manifest_path.exists():
        dst_manifest = versions_dir / (name + ".json")
        shutil.copy2(manifest_path, dst_manifest)

    apply_retention(versions_dir, int(args.keep))
    print(str(dst_dump))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
