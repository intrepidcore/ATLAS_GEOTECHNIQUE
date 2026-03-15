---
description: SDD — Offline-first update + sync (Desktop) : invariants, migrations, Tauri commands
---

# SDD — Offline-first update + sync (Desktop)

## 1) Contexte

Le Desktop Atlas doit fonctionner sans réseau (terrain) tout en garantissant :

- la **continuité opérationnelle** (base locale + API embarquée)
- la **mise à jour** de l’application quand le réseau redevient disponible
- la **synchronisation** des données (référentiels inbound + données terrain outbound)
- la **traçabilité** et une stratégie zéro-dette (idempotence, rollback, logs).

## 2) Objectifs

- Permettre un check d’update **best-effort** côté Tauri sans bloquer le démarrage.
- Tracer chaque check et chaque opération de sync (DB source-of-truth).
- Mettre en place une base technique pour :
  - bundles de référence (pull)
  - bundles terrain (push)
  - snapshots / patch apply

## 3) Non-objectifs (phase actuelle)

- Implémenter le téléchargement et l’installation automatique de l’update (updater complet).
- Implémenter le protocole complet de sync (delta, conflits).

## 4) Règles métier (références)

- `BM-SYNC-01`..`BM-SYNC-05` dans `docs/REGLES_METIER.md`.

## 5) Contrat DB

### Migration 134 — infrastructure de suivi

Fichier : `db/migrations/134_sync_infrastructure.sql`

Tables :

- `atlas.sync_state`
  - état machine des opérations de sync/update (type, direction, status, bundle_id/hash, erreurs)
- `atlas.update_check_log`
  - historique des checks d’update (versions, compatibilité schéma, erreurs, url)

Objectif : diagnostiquer, supporter la reprise après incident, et éviter les doubles-applies.

## 6) Contrat Tauri (Desktop)

### Commande `check_for_updates`

Implémentation :

- `apps/atlas-pro/src-tauri/src/sync.rs`
- exposée via `invoke_handler` dans `apps/atlas-pro/src-tauri/src/lib.rs`

Comportement :

- Prend une `update_url` optionnelle (sinon env `ATLAS_UPDATE_URL`).
- Télécharge un JSON versionné (contract minimal) :

```json
{
  "version": "0.2.0",
  "min_schema_version": 134,
  "notes": "...",
  "pub_date": "...",
  "platforms": {
    "windows-x86_64": { "signature": "...", "url": "..." }
  }
}
```

- Calcule :
  - `update_available` (comparaison lexicale simple en phase actuelle)
  - `schema_compatible` (comparaison `desktop_seed_state.max_migration_applied` vs `min_schema_version`)
- Écrit un log dans `atlas.update_check_log`.

## 7) Roadmap (phases)

### Phase A — Observabilité (terminée)

- Migration 134 (tables + index)
- Commande Tauri `check_for_updates` + logging DB

### Phase B — Updater

- Gestion de signature + téléchargement sécurisé
- Installation (selon stratégie retenue : tauri updater ou custom)

### Phase C — Sync inbound/outbound

- Format bundles (manifest + hash)
- `sync_state` comme état machine
- Apply idempotent + reprise après incident

## 8) Critères d’acceptation

- La migration 134 s’applique sans erreur.
- `check_for_updates` compile et ne bloque pas le startup.
- Un check écrit une ligne `atlas.update_check_log` (succès/erreur).
