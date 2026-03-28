# Contrat de Packaging Atlas Pro Desktop

## Objectif

Définir une structure **canonique et reproductible** des ressources embarquées dans l'installeur (MSI) afin que le runtime Desktop (Tauri) puisse résoudre **de manière déterministe** les chemins des ressources critiques.

Ce contrat est **enforced** par :

- `scripts/verify-bundle.ps1`
- le job CI `bundle-contract` (voir `.github/workflows/quality-gates.yml`)

## Structure garantie dans `resource_dir()` après installation MSI

Le dossier retourné par `app.path().resource_dir()` doit contenir :

```text
resources/
├── pg/
│   └── bin/
│       ├── pg_ctl.exe
│       ├── postgres.exe
│       ├── pg_restore.exe
│       ├── initdb.exe
│       └── psql.exe
├── atlas_desktop_seed.dump
├── atlas_desktop_seed.dump.json
└── api-geo-x86_64-pc-windows-msvc.exe
```

### Invariants

- `pg/bin/pg_ctl.exe` doit exister.
- `atlas_desktop_seed.dump` doit exister et être non-vide.
- Le manifest `atlas_desktop_seed.dump.json` doit exister (voir `BM-11`).

## Source → destination dans `tauri.conf.json`

Le contrat est exprimé via `bundle.resources` **en mode mapping** :

```json
"bundle": {
  "resources": {
    "../../../data/db/backups/atlas_desktop_seed.dump": "atlas_desktop_seed.dump",
    "../../../data/db/backups/atlas_desktop_seed.dump.json": "atlas_desktop_seed.dump.json",
    "bin/api-geo-x86_64-pc-windows-msvc.exe": "api-geo-x86_64-pc-windows-msvc.exe",
    "pg/**/*": "pg/"
  }
}
```

## Résolution runtime (point d'entrée unique)

Le runtime Desktop doit résoudre les chemins via un **unique resolver** (fail-fast with context) exécuté **au startup** :

- `AtlasResources::resolve()` dans `apps/atlas-pro/src-tauri/src/lib.rs`
- stockage dans `State` (`ManagedAtlasResources`)
- export canonique dans l'environnement :
  - `ATLAS_PG_BIN_DIR`
  - `ATLAS_DESKTOP_SEED_DUMP_PATH`
  - `ATLAS_DESKTOP_SEED_DIR`

## Vérification locale

- Vérifier les inputs (sources + mapping) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-bundle.ps1 -RepoRoot .
```

- Vérifier un MSI buildé (inspect via install admin) :

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/verify-bundle.ps1 -RepoRoot . -MsiPath <chemin.msi>
```

## Règles associées

- `BM-10` / `BM-11` / `BM-12` (seed dump)
- `[DEPLOY-01..03]` dans `docs/REGLE_BONNE_PRATIQUE_MEMOIRE.MD`

### SEED-CLEAN-01 — Le seed ne contient pas de schémas temporaires

Le seed dump de production **n'inclut pas** les schémas temporaires ou historiques :

- `backup_*`
- `staging_*`
- `temp_*`

Raison : ces schémas gonflent le dump, ralentissent le restore, et n'apportent aucune valeur au runtime client.
