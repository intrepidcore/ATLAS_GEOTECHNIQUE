# Atlas Dataset v1 (Base Saine)

Ce dossier contient les **artefacts officiels** du dataset embarqué Desktop (baseline "Base Saine v1").

## Contenu

- `seed_v1.dump`
  - Dump PostgreSQL **custom format** (`pg_dump -Fc`)
  - Contient **schéma + données** nécessaires au produit Desktop
- `schema_v1.sql`
  - Dump **schema-only** (fingerprint du schéma)
  - Sert à calculer un hash de référence (`schema_sha256`)
- `DATASET_MANIFEST.json`
  - Métadonnées + hashes (traçabilité et vérification)

## Règles

- Le Desktop restaure `seed_v1.dump` au **premier boot** (DB vide), puis écrit :
  - `atlas.desktop_state.seed_version = v1`
  - `atlas.desktop_state.seed_hash = <blake3(seed_v1.dump)>`
- Après installation de la baseline, le Desktop **n’applique que** les migrations de `migrations_post_v1/`.
- Les migrations legacy ne doivent pas être rejouées (baseline figée).

## Génération

Pré-requis : accès à une base de référence stable (`atlas_clean`).

1) Générer le dump custom :

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d atlas_clean -Fc -f seed_v1.dump
```

2) Générer le schéma :

```powershell
pg_dump -h 127.0.0.1 -p 5432 -U postgres -d atlas_clean --schema-only --no-owner --no-privileges -f schema_v1.sql
```

3) Calculer les hashes SHA256 et mettre à jour `DATASET_MANIFEST.json`.

## Test minimal obligatoire

Sur une DB vierge :

- restore `seed_v1.dump`
- vérifier PostGIS (`select postgis_full_version();`)
- login OK
- endpoints Colab OK
