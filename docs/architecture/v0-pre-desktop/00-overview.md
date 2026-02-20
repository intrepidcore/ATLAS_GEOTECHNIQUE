# Atlas Géotechnique — Snapshot architecture (v0-pre-desktop)

## Objectif
Snapshot factuel de l’architecture existante avant migration desktop (Tauri).

## Stack
- UI: Vite + React + TypeScript + Tailwind (PWA, MPA `index.html` + `mobile.html`)
- Backend principal: Rust (Axum) `services/api-geo`
- DB: PostgreSQL + PostGIS (Docker)
- ETL: `etl/` (container; exécution via `docker compose run --rm etl ...`)
- Worker carto: `qgis_worker/` (génération PDF/QGIS en container)

## Organisation du dépôt (haut niveau)
- `services/api-geo/`: API principale (REST + WebSocket)
- `ui/`: frontend
- `migrations/`: SQL appliqué au démarrage DB (monté dans `/docker-entrypoint-initdb.d`)
- `data/db/`: volume Postgres local (persisté)
- `exports/`: sorties d’exports (monté dans container API + worker)
- `etl/`: jobs de chargement / seed
- `qgis_worker/`: worker QGIS
- `scripts/`: scripts PowerShell / bash d’exploitation locale

## Exécution locale (baseline)
- `docker compose up --build -d`
- API: `http://localhost:8000` (et aussi `http://localhost:8000/api/...` via double-nesting)
- UI: `http://localhost:8080`

## Décisions à préserver pour la migration desktop
- API expose les routes à la racine ET sous `/api` (compat reverse proxy et fallback UI)
- Projection/geo: calculs côté DB, réponses API en GeoJSON
- Stockage DB local persisté (Docker volume bind sur `./data/db`)
