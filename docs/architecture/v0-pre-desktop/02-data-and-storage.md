# Données & stockage (v0-pre-desktop)

## PostgreSQL/PostGIS
- DB: `atlas_clean` (voir `.env.example`)
- Connexion:
  - Dans compose: `postgres://atlas:atlas@db:5432/atlas_clean`
  - En local (host): `127.0.0.1:5432` (bind loopback)

## Migrations
- Source: `./migrations/*.sql`
- Mode: montées en `/docker-entrypoint-initdb.d` (init DB au démarrage container)
- Note: dans `api-geo`, `sqlx::migrate!()` est désactivé (migrations gérées via SQL)

## Volumes / répertoires de données
- `data/db/`: stockage physique Postgres (persistant)
- `exports/`: exports PDF/GeoPackage/etc. (persistant)
- `data/tiles/`: MBTiles (optionnel, tileserver)

## Fichiers à ne jamais versionner
- Dumps DB / backups / DSM / répertoires `target/`
- Secrets: `.env` (variables runtime)

## Implications desktop (cible)
- Déplacer la persistance dans un DataDir utilisateur (Windows) plutôt que dans le répertoire projet
- Encapsuler DB (PostGIS) via Docker Desktop (Phase 2) ou alternative embarquée si contrainte
