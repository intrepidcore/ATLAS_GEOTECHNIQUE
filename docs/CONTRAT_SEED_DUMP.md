# Contrat technique — Seed Dump Desktop (Atlas)

Ce document spécifie le protocole canonique de **génération**, **validation**, **versionnement** et **restauration** du seed dump utilisé par le Desktop (Tauri).

Il est écrit pour éviter les trois classes de pannes observées en pratique :

- dump corrompu (hash non vérifié)
- incompatibilité de versions Postgres / PostGIS (`pg_restore: unsupported version`)
- restore involontaire qui écrase une DB déjà initialisée

---

## 1) Artefacts canoniques

- **Dump** : `data/db/backups/atlas_desktop_seed.dump`
- **Manifest** : `data/db/backups/atlas_desktop_seed.dump.json`

Le dump est au format `pg_dump -Fc`.

---

## 2) Format du dump (obligatoire)

### 2.1 Génération (format custom)

Commande canonique :

```bash
pg_dump -Fc --no-owner --no-privileges -U atlas -d atlas_clean -f data/db/backups/atlas_desktop_seed.dump
```

Raisons :

- `-Fc` est le format recommandé pour `pg_restore` (erreurs plus propres, restore sélectif possible)
- `--no-owner --no-privileges` évite de figer des rôles/propriétaires dépendants de l’environnement cible

### 2.2 Restauration (pg_restore)

Commande canonique :

```bash
pg_restore --clean --if-exists --no-owner --no-privileges -U atlas -d atlas_clean data/db/backups/atlas_desktop_seed.dump
```

---

## 3) Manifest (contrat)

Le manifest est un JSON adjacent au dump.

### 3.1 Champs minimum

- `created_at` (ISO8601)
- `db_name`
- `format` (doit être `pg_dump -Fc`)
- `sha256`
- `size_bytes`

### 3.2 Champs recommandés (anti dette)

- `git_commit`
- `postgres_target_major`
- `postgis_version`
- `max_migration_applied`
- `invariants[]` (requêtes SQL + min attendus)

---

## 4) Versionnement Git (Desktop)

- Le dump est versionné via **Git LFS**.
- Le manifest `.json` est un petit fichier texte versionné normalement.

---

## 5) Politique de restore (Desktop)

Objectif : ne jamais écraser implicitement une DB utilisateur.

Règle canonique Desktop :

- si `atlas.desktop_state.seed_hash` est présent : la DB est considérée seedée
- sinon, si la DB est vide et qu’un dump seed est disponible : restore seed
- pour forcer en dev : `ATLAS_FORCE_SEED_RESTORE=1`

---

## 6) Vérifications obligatoires

Avant tout restore :

- recalcul du **SHA256** et comparaison au manifest
- vérification de compatibilité `postgres_target_major` (si fourni)

Après restore :

- exécuter les invariants du manifest
- appliquer les migrations du repo

---

## 7) Procédure de génération depuis Docker (recommandée)

Si la DB source est dans le container `atlas-db` :

```bash
docker exec atlas-db pg_dump -U atlas -d atlas_clean -Fc -f /tmp/atlas_desktop_seed.dump
docker cp atlas-db:/tmp/atlas_desktop_seed.dump data/db/backups/atlas_desktop_seed.dump
```

Puis générer/mettre à jour le manifest (SHA256 + size).

Scripts associés (repo) :

- `scripts/create-desktop-seed-dump.ps1` (Windows, `pg_dump` local si disponible sinon fallback Docker)
- `scripts/generate_seed_manifest.py` (génération manifest SHA256/size)
- `scripts/validate-dump.ps1` (validation manifest + hash)

---

## 8) Historique des seeds

- 2026-03-13 — `b07b917` — `atlas_desktop_seed.dump` (sha256 dans le manifest)

## 9) Politique de versionnement des seeds (v2)

- Chaque génération met à jour `identity.seed_version` (SemVer) dans le manifest.
- Avant d'écraser le seed courant, l'ancien dump est archivé dans `data/db/backups/versions/`.
- Politique de rétention locale : conserver les 3 dernières versions (les plus anciennes sont supprimées).
