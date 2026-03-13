# ADR-002 — Seed dump Desktop : format, versionnement, contrat

- **Statut** : Accepté
- **Date** : 2026-03-13
- **Décideurs** : Équipe Atlas

---

## Contexte

Le Desktop (Tauri) embarque un runtime PostgreSQL et doit pouvoir initialiser la base localement, de manière :

- déterministe
- offline
- reproductible

Incidents observés :

- dumps incompatibles (`pg_restore: unsupported version`) lors d’un changement de version majeure PG
- hash calculé mais non vérifié avant restore
- heuristiques fragiles pour décider si la DB est “déjà initialisée”

---

## Décision

- Le seed dump Desktop a un **format canonique unique** : `pg_dump -Fc`.
- Le dump est accompagné d’un **manifest JSON** adjacent.
- Le dump est versionné via **Git LFS**.

---

## Conséquences

- Restore exclusivement via `pg_restore`.
- Le Desktop doit (à terme) vérifier le hash avant restore.
- Le Desktop doit éviter d’écraser une DB utilisateur sans action explicite.

Voir `docs/CONTRAT_SEED_DUMP.md` pour le protocole opératoire complet.

---

## Alternatives rejetées

- **SQL plain** : restore plus fragile, logs et erreurs moins structurés, volumétrie non adaptée.
- **sql.gz** : pipeline plus complexe, non standardisé, erreurs difficiles à diagnostiquer.
- **Versionnement hors LFS** : gonfle le repo et pénalise tous les workflows Git.
