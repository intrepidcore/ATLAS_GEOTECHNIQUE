#!/usr/bin/env python3
"""
Vérifie que chaque `id` de `THEMATIC_PARAMETERS` (TypeScript) est accepté par
l'enum serde `ThematicParameter` (Rust api-geo).

Usage (depuis la racine du dépôt atlas_reclone) :
  python3 scripts/ci/check_thematic_params_consistency.py
"""
from __future__ import annotations

import re
import sys
from pathlib import Path


def repo_root() -> Path:
    return Path(__file__).resolve().parents[2]


def serde_variant_snake(ident: str) -> str:
    """Même logique que serde `rename_all = \"snake_case\"` pour identifiants PascalCase."""
    s1 = re.sub(r"(.)([A-Z][a-z]+)", r"\1_\2", ident)
    s2 = re.sub(r"([a-z0-9])([A-Z])", r"\1_\2", s1)
    return s2.lower()


def parse_ts_thematic_ids(ts_path: Path) -> list[str]:
    text = ts_path.read_text(encoding="utf-8")
    m = re.search(
        r"export const THEMATIC_PARAMETERS:\s*ThematicParameter\[\]\s*=\s*\[(.*?)\n\]\s*\n\n// =+",
        text,
        re.DOTALL,
    )
    if not m:
        print("FATAL: bloc THEMATIC_PARAMETERS introuvable dans thematic-types.ts", file=sys.stderr)
        sys.exit(2)
    block = m.group(1)
    return re.findall(r"\bid:\s*'([^']+)'", block)


def parse_rust_accepted_ids(rs_path: Path) -> dict[str, str]:
    text = rs_path.read_text(encoding="utf-8")
    start = text.find("pub enum ThematicParameter {")
    if start < 0:
        print("FATAL: pub enum ThematicParameter introuvable", file=sys.stderr)
        sys.exit(2)
    start = text.find("{", start) + 1
    depth = 1
    i = start
    while i < len(text) and depth:
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
        i += 1
    body = text[start : i - 1]

    variant_to_keys: dict[str, set[str]] = {}
    current_attrs: list[str] = []

    for line in body.splitlines():
        s = line.strip()
        if not s or s.startswith("//"):
            continue
        if s.startswith("#["):
            current_attrs.append(s)
            continue
        if s.endswith(","):
            name = s[:-1].strip()
            if not name or not name[0].isupper():
                current_attrs = []
                continue
            keys: set[str] = {serde_variant_snake(name)}
            attr_blob = " ".join(current_attrs)
            for alias in re.findall(r'alias\s*=\s*"([^"]+)"', attr_blob):
                keys.add(alias)
            variant_to_keys[name] = keys
            current_attrs = []

    # id string -> variant Rust (affichage)
    accepted: dict[str, str] = {}
    for vname, keys in variant_to_keys.items():
        for k in keys:
            if k in accepted and accepted[k] != vname:
                print(
                    f"WARN: clé serde dupliquée {k!r} ({accepted[k]} vs {vname})",
                    file=sys.stderr,
                )
            accepted[k] = vname
    return accepted


def main() -> None:
    root = repo_root()
    ts_path = root / "ui" / "src" / "thematic" / "thematic-types.ts"
    rs_path = root / "services" / "api-geo" / "src" / "thematic" / "types.rs"
    if not ts_path.is_file() or not rs_path.is_file():
        print("FATAL: chemins TS/Rust introuvables", file=sys.stderr)
        sys.exit(2)

    ts_ids = parse_ts_thematic_ids(ts_path)
    rust_accepted = parse_rust_accepted_ids(rs_path)

    mismatches: list[tuple[str, str]] = []
    for tid in ts_ids:
        if tid in rust_accepted:
            v = rust_accepted[tid]
            print(f"[OK] {tid} -> {v}")
        else:
            mismatches.append((tid, "(aucune variante Rust)"))

    print(f"\nTotal: {len(ts_ids)} parametres catalogue TS verifies, {len(mismatches)} mismatch")
    if mismatches:
        for tid, msg in mismatches:
            print(f"[FAIL] {tid} -> {msg}", file=sys.stderr)
        sys.exit(1)
    sys.exit(0)


if __name__ == "__main__":
    main()
