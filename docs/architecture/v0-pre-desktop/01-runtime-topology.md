# Topologie runtime (v0-pre-desktop)

## Docker Compose (services principaux)
- `db`:
  - Image: `postgis/postgis:16-3.4`
  - Port: `127.0.0.1:5432:5432`
  - Volumes:
    - `./data/db` -> `/var/lib/postgresql/data`
    - `./migrations` -> `/docker-entrypoint-initdb.d` (read-only)
- `api-geo`:
  - Build: `./services/api-geo`
  - Port: `8000:8000`
  - Env (compose): `API_BIND=0.0.0.0:8000`, `CORS_ORIGIN=*`, `EXPORT_DIR=/data/exports`
  - Volume: `./exports` -> `/data/exports`
  - Health: `GET /healthz`
- `ui`:
  - Build: `./ui`
  - Port: `8080:80`
  - Volume: `./ui/dist` -> nginx html (read-only)
- `etl`:
  - Build: `./etl`
  - Exécution: `docker compose run --rm etl ...` (pas de port)
- `qgis-worker`:
  - Build: `./qgis_worker`
  - Consomme `api-geo` + DB, écrit dans `exports/`

## Réseau
- Tous les services dans `atlas-net`.

## API `api-geo` (Rust/Axum)
- Bind: `0.0.0.0:${API_GEO_PORT:-8000}`
- Routes exposées à la racine ET sous `/api`.
- Observabilité:
  - `GET /healthz`
  - `GET /metrics` (Prometheus)
  - `GET /ws` (WebSocket broadcast)

## UI (Vite)
- Dev proxy:
  - `/api/*` -> `http://localhost:8000` avec rewrite supprimant `/api`.
- MPA:
  - `/colab/mobile/*` -> `mobile.html`
  - autres routes -> `index.html`

## Points à traiter en desktop
- CORS actuellement permissif (OK dev, à restreindre en desktop via loopback + token interne)
- Ports fixes (8000/8080) — prévoir allocation dynamique côté desktop si conflit
