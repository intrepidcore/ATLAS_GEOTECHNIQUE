# Architecture v0.7.0

Ce document décrit l'architecture technique de la version 0.7.0 avec la grille nationale.

## Vue d'ensemble

```
┌─────────────────────────────────────────────────────────────────┐
│                         UI (Vite + TS + Leaflet)               │
│                         http://127.0.0.1:8080                   │
│                                                                 │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐         │
│  │ Map Leaflet  │  │   Controls   │  │    Status    │         │
│  │              │  │   - Grid     │  │   - OK/Err   │         │
│  │  - Grille TG │  │   - Shape    │  │   - Loading  │         │
│  │  - Cliquable │  │   - Recompute│  │              │         │
│  │  - Colorée   │  │   - Export   │  │              │         │
│  └──────────────┘  └──────────────┘  └──────────────┘         │
└────────────────────────┬────────────────────────────────────────┘
                         │ HTTP/JSON (EPSG:4326)
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    API-GEO (Rust/Axum)                          │
│                    http://127.0.0.1:8001                        │
│                                                                 │
│  Routes:                                                        │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ GET  /coverage/mailles    → FeatureCollection 4326     │   │
│  │ GET  /grid/{code}         → Stats + bbox + summary     │   │
│  │ GET  /grid/{code}/shape   → GeoJSON Feature 4326       │   │
│  │ POST /grid/recompute/{code} → IDW calculation          │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Logique:                                                       │
│  - Transformation EPSG:25231 → 4326                             │
│  - Comptages (sondages, essais, by_type)                        │
│  - IDW p=2 sur SPT_N au centroïde (25231)                      │
│  - Validation (min 3 samples pour IDW)                          │
└────────────────────────┬────────────────────────────────────────┘
                         │ SQL/PostGIS
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                    PostgreSQL + PostGIS                          │
│                    127.0.0.1:5432 (local only)                  │
│                                                                 │
│  Tables principales:                                            │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ country_tg                                              │   │
│  │   - id, name, geom (Polygon, 4326), created_at         │   │
│  │   → Polygone du Togo (frontière nationale)             │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ mailles                                                 │   │
│  │   - id, code, geom (Polygon, 25231), stats, updated_at │   │
│  │   → Grille nationale ~2 km² par maille                 │   │
│  │   → Code: TG-0001, TG-0002, ...                        │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ sondages                                                │   │
│  │   - id, geom (Point, 25231), date, source, meta        │   │
│  │   → Points de sondage géotechnique                     │   │
│  ├─────────────────────────────────────────────────────────┤   │
│  │ essais                                                  │   │
│  │   - id, sondage_id, type, depth_m, value, unit, meta   │   │
│  │   → Essais géotechniques (SPT_N, qc, ...)              │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Index spatiaux (GIST):                                         │
│  - idx_country_tg_geom                                          │
│  - idx_mailles_geom                                             │
│  - idx_sondages_geom                                            │
└────────────────────────┬────────────────────────────────────────┘
                         │ Populate via ETL
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│                      ETL (Python/Typer)                          │
│                      docker compose run --rm etl                │
│                                                                 │
│  Commandes:                                                     │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ load-country         → charge togo.geojson → country_tg│   │
│  │ make-grid            → génère grille nationale          │   │
│  │ load-sample-extended → seed multi-villes                │   │
│  │ load-sample          → seed simple (legacy)             │   │
│  │ migrate              → applique init.sql                │   │
│  └─────────────────────────────────────────────────────────┘   │
│                                                                 │
│  Dépendances:                                                   │
│  - psycopg (PostgreSQL adapter)                                 │
│  - typer (CLI framework)                                        │
│  - python-dotenv (config)                                       │
└─────────────────────────────────────────────────────────────────┘
```

## Flux de données : Génération de la grille

```
1. load-country
   ┌─────────────────┐
   │ togo.geojson    │ (EPSG:4326, Polygon simplifié)
   └────────┬────────┘
            │ Parse GeoJSON → WKT
            ▼
   ┌─────────────────┐
   │ country_tg      │ (EPSG:4326)
   └─────────────────┘

2. make-grid
   ┌─────────────────┐
   │ country_tg      │
   └────────┬────────┘
            │ ST_Transform(geom, 25231) → polygone en mètres
            ▼
   ┌─────────────────┐
   │ Envelope (bbox) │ Xmin, Ymin, Xmax, Ymax (25231)
   └────────┬────────┘
            │ ST_SquareGrid(1414.21356, bbox)
            ▼
   ┌─────────────────┐
   │ Grille brute    │ Carrés réguliers (peut déborder)
   └────────┬────────┘
            │ ST_Intersects + ST_Intersection(cell, country_tg)
            ▼
   ┌─────────────────┐
   │ Grille clippée  │ Seulement les cellules dans le Togo
   └────────┬────────┘
            │ Filtrage aire > 1 m² (éviter reliquats)
            ▼
   ┌─────────────────┐
   │ mailles         │ Code TG-0001, TG-0002, ...
   └─────────────────┘

3. load-sample-extended
   ┌─────────────────┐
   │ Config villes   │ Lomé, Sokodé, Kara, Dapaong
   │  - lon, lat     │
   │  - n_sondages   │
   │  - radius_km    │
   │  - biais SPT/qc │
   └────────┬────────┘
            │ Pour chaque ville:
            │   - rand_in_disk_km() → lon, lat aléatoires
            │   - INSERT sondages (4326 → 25231)
            │   - Pour chaque sondage:
            │       - Génération 2-4 essais
            │       - Distributions gaussiennes + corrélation
            ▼
   ┌─────────────────┐
   │ sondages        │ 19-31 points
   │ essais          │ 50-100 essais (SPT_N, qc)
   └─────────────────┘
```

## Flux de données : Requête utilisateur

```
1. UI: Chargement initial
   GET /coverage/mailles
   ─────────────────────▶ API-GEO
                          │
                          │ SQL:
                          │   SELECT m.code, ST_AsGeoJSON(ST_Transform(m.geom, 4326)),
                          │          COUNT(DISTINCT s.id) AS n_sondages,
                          │          COUNT(e.id) AS n_essais
                          │   FROM mailles m
                          │   LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
                          │   LEFT JOIN essais e ON e.sondage_id = s.id
                          │   GROUP BY m.code, m.geom
                          │
                          ▼ PostgreSQL
                          │
   FeatureCollection     │
   (4326, properties:    │
    code, has_data,      │
    n_sondages, n_essais)│
   ◀─────────────────────┘
   │
   │ Affichage carte Leaflet:
   │ - Style conditionnel (has_data → rouge, else gris)
   │ - OnEachFeature → click handler
   │
   └─▶ Carte interactive

2. UI: Clic sur maille → GET /grid/{code}
   GET /grid/TG-0234
   ─────────────────────▶ API-GEO
                          │
                          │ SQL:
                          │   1. SELECT bbox (4326), stats FROM mailles WHERE code=...
                          │   2. SELECT COUNT(*) sondages WHERE ST_Within(...)
                          │   3. SELECT COUNT(*) essais WHERE ST_Within(...)
                          │   4. SELECT COUNT(*) BY type WHERE ST_Within(...)
                          │
                          ▼ PostgreSQL
                          │
   { code, bbox, stats,  │
     summary: {          │
       n_sondages,       │
       n_essais,         │
       by_type: {...}    │
     }                   │
   }                     │
   ◀─────────────────────┘
   │
   └─▶ Affichage info panel + dessin bbox

3. UI: Export GeoJSON
   GET /grid/{code}/shape
   ─────────────────────▶ API-GEO
                          │
                          │ SQL:
                          │   SELECT ST_AsGeoJSON(ST_Transform(geom, 4326))
                          │   FROM mailles WHERE code=...
                          │
                          ▼ PostgreSQL
                          │
   { type: "Feature",    │
     geometry: {...},    │
     properties: {code}  │
   }                     │
   ◀─────────────────────┘
   │
   │ Blob + download automatique
   │
   └─▶ Fichier TG-0234.geojson téléchargé

4. UI: Recompute IDW
   POST /grid/recompute/{code}
   ─────────────────────▶ API-GEO
                          │
                          │ SQL:
                          │   1. SELECT id, geom, stats FROM mailles WHERE code=...
                          │   2. SELECT SPT_N samples WHERE ST_Within(...)
                          │   3. SELECT ST_Centroid(geom) → cx, cy (25231)
                          │
                          ▼ PostgreSQL
                          │
                          │ Calcul IDW en Rust:
                          │   v_hat = Σ(wi * vi) / Σ(wi)
                          │   où wi = 1 / di^p  (p=2)
                          │
                          │ SQL:
                          │   UPDATE mailles SET stats = stats || {...}, updated_at=now()
                          │   WHERE id=...
                          │
                          ▼ PostgreSQL
                          │
   { code, bbox, stats,  │
     summary: {...}      │
   }                     │
   ◀─────────────────────┘
   │
   └─▶ Affichage résultat IDW dans info panel
```

## Projections et transformations

### Stockage (DB)
- **country_tg** : EPSG:4326 (degrés) - polygone source inchangé
- **mailles** : EPSG:25231 (mètres) - grille en projection métrique
- **sondages** : EPSG:25231 (mètres) - points en projection métrique

### API → UI
- Toutes les réponses en **EPSG:4326** (degrés)
- Transformation via `ST_Transform(geom, 4326)` dans les requêtes SQL

### ETL → DB
- Input GeoJSON : EPSG:4326
- Conversion : `ST_Transform(ST_SetSRID(ST_MakePoint(lon, lat), 4326), 25231)`

## Caractéristiques de la grille

| Paramètre | Valeur |
|-----------|--------|
| Aire cible par maille | 2 000 000 m² (2 km²) |
| Côté du carré | √2000000 ≈ 1414.21356 m |
| Projection | EPSG:25231 (Lomé / UTM zone 31N) |
| Nombre de mailles | 800-1200 (selon précision polygone) |
| Clipping | Oui (ST_Intersection avec country_tg) |
| Filtrage reliquats | Oui (aire > 1 m²) |
| Codes | TG-0001, TG-0002, ... (LPAD 4 chiffres) |

## Performance

### Métriques cibles

| Opération | Temps cible | Notes |
|-----------|-------------|-------|
| Génération grille | < 15 s | PostGIS ST_SquareGrid + clipping |
| Seed multi-villes | < 5 s | 20-30 sondages, 50-100 essais |
| GET /coverage/mailles | < 500 ms | 800-1200 features avec LEFT JOIN |
| GET /grid/{code} | < 100 ms | Comptages sur 1 maille |
| POST /recompute/{code} | < 200 ms | IDW sur 5-50 points |

### Optimisations

1. **Index spatiaux GIST** sur toutes les colonnes `geom`
2. **LEFT JOIN** au lieu de sous-requêtes multiples pour `/coverage/mailles`
3. **COUNT(DISTINCT s.id)** pour éviter la multiplication des lignes
4. **ST_Within** au lieu de ST_Intersects pour requêtes ponctuelles
5. **Transformation 4326 uniquement en sortie** (calculs en 25231)

## Extensibilité

### Ajouter une nouvelle ville au seed
Éditez `etl/cli.py`, section `CITIES` dans `load_sample_extended()` :

```python
{
    "name": "Nouvelle-Ville",
    "lon": X.XXX, "lat": Y.YYY,
    "n": (min, max),           # nombre de sondages
    "radius_km": (rmin, rmax), # rayon de distribution
    "spt_bias": 0,             # biais SPT_N
    "qc_bias": 0.0             # biais qc (MPa)
}
```

### Ajouter un nouveau type d'essai
1. Éditez le seed pour générer les valeurs
2. Pas de changement DB/API (colonne `type` TEXT libre)
3. L'UI affichera automatiquement dans `by_type`

### Changer la projection
1. Modifier `EPSG:25231` → nouvelle projection dans :
   - `migrations/init.sql` (geom columns)
   - `etl/cli.py` (ST_Transform calls)
   - Garder sortie API en 4326

### Ajouter un nouveau pays
1. Créer `data/pays.geojson`
2. Ajuster `country_tg` → `countries` (multi-rows)
3. Modifier `make-grid` pour filtrer par pays

## Sécurité

- Tous les ports bindés sur **127.0.0.1** uniquement (pas d'exposition externe)
- Pas d'authentification (usage local)
- Validation minimale (codes mailles via URL path)
- CORS permissif (dev/local)

Pour production :
- Ajouter authentification (JWT, OAuth2)
- HTTPS + certificats
- CORS restreint
- Rate limiting
- Input validation stricte
