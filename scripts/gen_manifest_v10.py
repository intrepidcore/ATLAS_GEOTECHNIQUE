#!/usr/bin/env python3
"""Genere le manifest contrat v2 pour le dump atlas post-V10."""
import json, hashlib, os
from pathlib import Path
from datetime import datetime, timezone

DUMP = Path(r"J:\atlas_backups\atlas_schema_only_20260601_160937.dump")
OUT_BACKUP = DUMP.parent / (DUMP.stem + ".manifest.json")
OUT_CANONICAL = Path(r"C:\PROJET_ATLAS_MASTER\atlas_reclone\data\db\backups\atlas_desktop_seed.dump.json")

print(f"Dump: {DUMP.name} ({DUMP.stat().st_size / 1024 / 1024:.1f} MB)")
print("Computing SHA256 ...")
h = hashlib.sha256()
with open(DUMP, "rb") as f:
    for chunk in iter(lambda: f.read(65536), b""):
        h.update(chunk)
sha256 = h.hexdigest()
print(f"SHA256: {sha256[:32]}...")

now = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")

manifest = {
    "$schema": "https://atlas.intrepidcore.io/schemas/seed-manifest-v2.json",
    "schema_version": "2.0",
    "identity": {
        "seed_id":      "atlas-seed-20260601-966e51a",
        "seed_version": "2.0.0",
        "environment":  "production",
        "classification": "internal"
    },
    "source": {
        "created_at":  now,
        "created_by":  "serge.tabedjato",
        "git_commit":  "966e51a",
        "git_branch":  "atlas_v2_clean",
        "db_name":     "atlas_clean",
        "format":      "pg_dump -Fc --no-owner --no-privileges --schema=atlas"
    },
    "integrity": {
        "sha256":    sha256,
        "size_bytes": DUMP.stat().st_size,
        "signed_by": "atlas-release-key-2026"
    },
    "compatibility": {
        "postgres_min_major":    16,
        "postgres_max_major":    17,
        "postgis_min_version":   "3.4",
        "max_migration_applied": "178",
        "requires_extensions":   ["postgis", "uuid-ossp", "pg_trgm"]
    },
    "contents": {
        "schemas":        ["atlas"],
        "tables_count":   210,
        "rows_estimate": {
            "atlas.mailles":               29407,
            "atlas.sondages":                492,
            "atlas.echantillons":           1244,
            "atlas.essais_vbs":              810,
            "atlas.essais_atterberg":        909,
            "atlas.essais_proctor":          292,
            "atlas.essais_cbr":              567,
            "atlas.essais_penetrometre":     411,
            "atlas.essais_pressiometre":      26,
            "atlas.ai_interpolation_runs":   314,
            "atlas.ai_interpolation_values": 6399738,
            "atlas.users":                     0
        },
        "contains_pii":       False,
        "contains_user_data": False,
        "geographic_scope":   "TGO",
        "import_batch":       "v10_master_import_2026",
        "new_v10_parameters": [
            "essais_cbr (CBR %%)",
            "essais_penetrometre (Rd MPa)",
            "essais_pressiometre (Em MPa)",
            "essais_classif.indice_groupe (IG)",
            "essais_proctor.OPM (gamma_d kN/m3)"
        ]
    },
    "retention": {
        "expires_at":    "2027-06-01T00:00:00Z",
        "superseded_by": None,
        "keep_versions": 3
    },
    "invariants": [
        {
            "id": "INV-001", "description": "Toutes les mailles V2 presentes",
            "severity": "critical",
            "query": "SELECT COUNT(*) FROM atlas.mailles",
            "expected_min": 29407, "expected_max": 29407
        },
        {
            "id": "INV-002", "description": "Table desktop_seed_state presente",
            "severity": "critical",
            "query": "SELECT to_regclass('atlas.desktop_seed_state') IS NOT NULL",
            "expected_value": True
        },
        {
            "id": "INV-003", "description": "PostGIS operationnel",
            "severity": "critical",
            "query": "SELECT PostGIS_Version() IS NOT NULL",
            "expected_value": True
        },
        {
            "id": "INV-004", "description": "Nouvelles tables V10 presentes (essais_cbr, penetrometre, pressiometre)",
            "severity": "critical",
            "query": "SELECT COUNT(*) FROM information_schema.tables WHERE table_schema='atlas' AND table_name IN ('essais_cbr','essais_penetrometre','essais_pressiometre')",
            "expected_min": 3, "expected_max": 3
        },
        {
            "id": "INV-005", "description": "Sondages V10 importes",
            "severity": "high",
            "query": "SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch='v10_master_import_2026'",
            "expected_min": 300
        },
        {
            "id": "INV-006", "description": "Aucun utilisateur dans le seed (securite)",
            "severity": "critical",
            "query": "SELECT COUNT(*) FROM atlas.users",
            "expected_max": 0
        },
        {
            "id": "INV-007", "description": "CBR importes",
            "severity": "high",
            "query": "SELECT COUNT(*) FROM atlas.essais_cbr",
            "expected_min": 500
        },
        {
            "id": "INV-008", "description": "AI interpolation values present",
            "severity": "high",
            "query": "SELECT COUNT(*) FROM atlas.ai_interpolation_values",
            "expected_min": 6000000
        },
        {
            "id": "INV-009", "description": "h_canon backfille sur echantillons",
            "severity": "medium",
            "query": "SELECT COUNT(*) FROM atlas.echantillons WHERE h_canon IS NOT NULL",
            "expected_min": 1200
        }
    ]
}

OUT_CANONICAL.parent.mkdir(parents=True, exist_ok=True)
for out in [OUT_BACKUP, OUT_CANONICAL]:
    with open(out, "w", encoding="utf-8") as f:
        json.dump(manifest, f, indent=2, ensure_ascii=False)
    print(f"Manifest ecrit: {out}")

print(f"\nSeed ID  : {manifest['identity']['seed_id']}")
print(f"Version  : {manifest['identity']['seed_version']}")
print(f"SHA256   : {sha256}")
print(f"Taille   : {DUMP.stat().st_size:,} bytes")
