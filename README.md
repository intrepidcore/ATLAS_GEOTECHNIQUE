# Atlas Géotechnique (Monorepo local)

Ce dépôt fournit une ossature de monorepo pour un atlas géotechnique local uniquement, avec PostGIS, APIs Rust (axum), UI Vite + TS + Leaflet, et un ETL Python.

## Prérequis
- Docker + Docker Compose
- Rust (local facultatif). Les images Docker utilisent Rust 1.86 pour la compilation.
- Node.js 18+
- Python 3.11+

## Projections et données
- La base de données stocke les géométries en EPSG:25231 (Lomé / UTM zone 31N), en mètres.
- Les APIs renvoient les emprises (bbox) et GeoJSON en EPSG:4326 pour l’UI.
- Les données d’exemple (mailles/sondages) sont saisies en 4326 puis transformées en 25231 côté ETL.

## Démarrage rapide
1. Assurez-vous que le fichier `.env` existe à la racine du projet. Vous pouvez copier `.env.example` vers `.env` puis ajuster si besoin.
2. Lancez l’ensemble (sans rebuild forcé):
   ```bash
   docker compose up -d
   ```
3. Vérifiez la santé:
   - DB: `127.0.0.1:5432` (local seulement)
   - API GEO: http://127.0.0.1:8001/healthz
   - API INFER: http://127.0.0.1:8002/healthz
   - API OPTI: http://127.0.0.1:8003/healthz
   - UI: http://127.0.0.1:8080/

4. Charger les données d’exemple:
   ```bash
   docker compose run --rm etl etl load-sample
   ```
   (répétez pour réensemencer, l’ETL tronque sondages/essais et upsert les mailles)

## Workflow de build incrémental (Docker)
- **Cycle quotidien**: utilisez `docker compose up -d`. Cela ne reconstruit pas tant que les sources n’ont pas changé.
- **Quand vous changez le code d’un service**:
  ```bash
  docker compose build api-geo && docker compose up -d api-geo
  # ou remplacez api-geo par api-infer / api-opti / ui selon le service modifié
  ```
- **Évitez** `--build` sauf en cas de chantier majeur; cela force un rebuild de toutes les images.
- Les Dockerfiles Rust utilisent des caches BuildKit (`/usr/local/cargo/registry` et `/app/target`) pour accélérer les recompilations.
- L’UI utilise `npm ci` déterministe et est mise en cache; `node_modules` est exclu via `.dockerignore`.

## Migrations
Les migrations SQL se trouvent dans `migrations/`. Le conteneur `db` exécute `init.sql` au démarrage.

Pour rejouer manuellement la migration principale:
```bash
make db-migrate
```

## Données de démonstration (seed)
Pour (ré)insérer des données de démonstration:
```bash
make seed
```
Cela invoque la CLI `etl` pour insérer quelques `sondages`, `essais` et `mailles` stubs.

## Développement
- Chaque API expose:
  - `GET /healthz` → `{status:"ok"}`
  - `GET /version` → hash git + date de build
  - `POST /echo` → renvoi du JSON
- Spécifique:
  - `api-geo`:
    - `GET /grid/{code}` → lit la maille par `code`, retourne `bbox` (4326), `stats` et `summary` (comptages sondages/essais et par type)
    - `POST /grid/recompute/{code}` → calcule un IDW (p=2) de `SPT_N` au centroïde de la maille (en 25231), met à jour `mailles.stats` et retourne la même structure que `GET`
  - `api-infer`:
    - `POST /predict` (renvoie 501 si `MODEL_PATH` absent)
  - `api-opti`:
    - `POST /pareto`

## Qualité
- Formatage et lint:
```bash
make fmt
make lint
```

## Tests rapides
Après démarrage et seed, testez:
```bash
curl http://127.0.0.1:8001/grid/TG-001 | jq
curl -X POST http://127.0.0.1:8001/grid/recompute/TG-001 | jq
```

## Notes
- Tous les ports publiés sont bindés à `127.0.0.1` uniquement.
- `ui` est servie par Nginx sur le port 80 du conteneur (publié sur 127.0.0.1:8080).
- `etl` s’exécute à la demande via `docker compose run --rm etl etl ...`.
