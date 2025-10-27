# Comparaison des workflows v0.7.0

Ce document compare les deux workflows disponibles : **simple** (legacy) et **étendu** (nouvelle grille nationale).

## Vue d'ensemble

| Aspect | Workflow Simple | Workflow Étendu (v0.7.0) |
|--------|----------------|--------------------------|
| **Commande** | `etl load-sample` | `etl load-country` + `etl make-grid` + `etl load-sample-extended` |
| **Grille** | 5 mailles prédéfinies (~Lomé) | 800-1200 mailles couvrant tout le Togo |
| **Aire maille** | Variable (~0.02° × 0.02°) | Fixe (~2 km² en EPSG:25231) |
| **Géographie** | Zone unique (Lomé) | Multi-villes (Lomé, Sokodé, Kara, Dapaong) |
| **Sondages** | 12 fixes | 19-31 aléatoires |
| **Essais** | ~36 fixes | 50-100 aléatoires |
| **Distributions** | Valeurs arbitraires | Gaussiennes + corrélation |
| **Reproductibilité** | Totale (hardcodé) | Contrôlée (seed=42) |
| **Temps setup** | ~5 secondes | ~20-30 secondes |
| **Cas d'usage** | Tests rapides, CI/CD | Démo réaliste, développement |

## Workflow Simple (Legacy)

### Commande
```bash
docker compose run --rm etl etl load-sample
```

### Ce qui est créé

#### Mailles (5)
- `TG-001` : Polygon((1.20 6.12, 1.22 6.12, 1.22 6.14, 1.20 6.14, 1.20 6.12))
- `TG-002` : Polygon((1.22 6.12, 1.24 6.12, 1.24 6.14, 1.22 6.14, 1.22 6.12))
- `TG-003` : Polygon((1.20 6.14, 1.22 6.14, 1.22 6.16, 1.20 6.16, 1.20 6.14))
- `TG-004` : Polygon((1.24 6.12, 1.26 6.12, 1.26 6.14, 1.24 6.14, 1.24 6.12))
- `TG-005` : Polygon((1.22 6.14, 1.24 6.14, 1.24 6.16, 1.22 6.16, 1.22 6.14))

Toutes définies en 4326, converties en 25231.

#### Sondages (12)
Nommés S1 à S12, répartis dans les 5 mailles :
- TG-001 : S1, S2, S3
- TG-002 : S4, S5, S6
- TG-003 : S7, S8
- TG-004 : S9, S10
- TG-005 : S11, S12

#### Essais (~36)
2-3 essais par sondage, types SPT_N et qc mélangés.

**Exemple S1** :
- SPT_N @ 1.5m = 8
- qc @ 3.0m = 2.5 MPa
- SPT_N @ 6.0m = 14

### Avantages
- **Rapide** : Setup en 5 secondes
- **Prévisible** : Toujours les mêmes valeurs
- **Simple** : Pas de dépendances externes (pas de GeoJSON)
- **Tests** : Idéal pour CI/CD, tests unitaires

### Inconvénients
- **Limité** : Seulement zone Lomé
- **Peu réaliste** : Valeurs arbitraires, pas de variabilité géographique
- **Pas extensible** : Difficile d'ajouter des villes

### Quand l'utiliser
- Tests rapides d'API
- CI/CD (GitHub Actions, etc.)
- Développement backend (pas besoin de carte complète)
- Validation de nouvelles fonctionnalités

---

## Workflow Étendu (v0.7.0)

### Commandes
```bash
# 1. Migration (une seule fois)
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql

# 2. Charger polygone Togo
docker compose run --rm etl etl load-country

# 3. Générer grille nationale
docker compose run --rm etl etl make-grid

# 4. Seed multi-villes
docker compose run --rm etl etl load-sample-extended
```

### Ce qui est créé

#### country_tg (1 row)
Polygone simplifié du Togo en EPSG:4326, ~19 sommets.

#### Mailles (800-1200)
Grille carrée régulière en EPSG:25231 :
- Côté : ~1414.21 m
- Aire : ~2 000 000 m² (2 km²)
- Clippée au polygone du Togo
- Codes : TG-0001, TG-0002, ..., TG-1200

**Distribution géographique** :
- Nord (Dapaong) : ~150 mailles
- Centre (Sokodé, Kara) : ~300 mailles
- Sud (Lomé) : ~400 mailles
- Zones frontalières : mailles partielles (clippées)

#### Sondages (19-31)
Répartis dans 4 villes avec distribution spatiale réaliste :

| Ville | Coordonnées approx. | Nb sondages | Rayon distribution |
|-------|---------------------|-------------|-------------------|
| Lomé | (1.215°, 6.131°) | 8-12 | 3-6 km |
| Sokodé | (1.131°, 8.984°) | 4-7 | 2-4 km |
| Kara | (1.213°, 9.551°) | 4-7 | 2-4 km |
| Dapaong | (0.205°, 10.862°) | 3-5 | 2-4 km |

**Total** : 19-31 sondages (dépend du seed)

#### Essais (50-100)
2-4 essais par sondage, avec distributions réalistes :

**SPT_N** :
- Moyenne : 18 ± 7 (gaussienne)
- Biais par ville :
  - Lomé : -2 (sols plus mous, littoral)
  - Sokodé : 0 (référence)
  - Kara : +2 (sols plus durs, montagne)
  - Dapaong : +1
- Plage typique : 5-50 blows/30cm
- Unit : "blows/30cm"

**qc (CPT)** :
- Moyenne : 4.0 ± 2.0 MPa (gaussienne)
- Biais par ville :
  - Lomé : -0.5 MPa
  - Sokodé : 0.0 MPa
  - Kara : +0.5 MPa
  - Dapaong : +0.2 MPa
- Corrélation avec SPT_N : qc += 0.03 * (SPT_N - 18)
- Plage typique : 0.5-15 MPa
- Unit : "MPa"

**Profondeurs** :
- Distribution triangulaire : min=1m, max=20m, mode=8m
- Plage typique : 1-20m

**Répartition types** :
- 60% SPT_N
- 40% qc

### Avantages
- **Réaliste** : Variabilité géographique, distributions cohérentes
- **Complet** : Couverture nationale
- **Flexible** : Paramétrable (seed, aire mailles, villes)
- **Extensible** : Facile d'ajouter des villes
- **Démonstration** : Idéal pour démos clients, présentations

### Inconvénients
- **Plus lent** : Setup ~30 secondes
- **Plus complexe** : 4 commandes au lieu d'1
- **Dépendances** : Nécessite togo.geojson
- **Variabilité** : Valeurs changent avec seed (mais reproductible)

### Quand l'utiliser
- Développement frontend (carte complète)
- Démos clients
- Tests d'interpolation (krigeage, IDW)
- Analyse spatiale
- Documentation (screenshots, tutoriels)

---

## Comparaison détaillée

### Structure des données

| Élément | Simple | Étendu |
|---------|--------|--------|
| **Mailles** |
| Nombre | 5 | 800-1200 |
| Définition | Hardcodées WKT | Générées via ST_SquareGrid |
| Projection input | 4326 | 4326 (country_tg) → 25231 (grille) |
| Codes | TG-001 à TG-005 | TG-0001 à TG-1200 |
| Clipping | Non (carrés parfaits) | Oui (frontière Togo) |
| **Sondages** |
| Nombre | 12 | 19-31 |
| Positionnement | Hardcodé | Aléatoire (disk distribution) |
| Géographie | Lomé uniquement | 4 villes |
| Nommage | S1-S12 (meta.name) | meta.city + index |
| Source | "SEED" | "SEED-{ville}" |
| **Essais** |
| Nombre | ~36 | 50-100 |
| Par sondage | 2-3 | 2-4 |
| Valeurs SPT_N | Arbitraires (8-32) | Gaussiennes (5-50) |
| Valeurs qc | Arbitraires (2.5-9.0) | Gaussiennes (0.5-15) |
| Corrélation SPT/qc | Aucune | Légère (coefficient 0.03/0.3) |
| Profondeurs | Fixes (1.5, 3.0, 6.0) | Triangulaires (1-20, mode 8) |

### Couverture spatiale

#### Workflow Simple
```
    6.16° N  ┌─────┬─────┐
             │ 003 │ 005 │
    6.14° N  ├─────┼─────┼─────┐
             │ 001 │ 002 │ 004 │
    6.12° N  └─────┴─────┴─────┘
             1.20° 1.22° 1.24° 1.26° E

Zoom : Lomé uniquement
Surface : ~0.08° × 0.04° ≈ 50 km²
```

#### Workflow Étendu
```
    11° N  ┌─────────────────────────┐
           │ ▓▓▓▓ Dapaong (3-5)      │
    10° N  │ ░░░░░░░░░░░░░░░░░░░░░░░ │
           │ ░░░░░░░░░░░░░░░░░░░░░░░ │
     9° N  │ ▓▓▓ Kara (4-7)          │
           │ ░░░░ Sokodé (4-7) ▓▓▓   │
     8° N  │ ░░░░░░░░░░░░░░░░░░░░░░░ │
           │ ░░░░░░░░░░░░░░░░░░░░░░░ │
     7° N  │ ░░░░░░░░░░░░░░░░░░░░░░░ │
           │ ▓▓▓▓▓▓ Lomé (8-12)      │
     6° N  └─────────────────────────┘
           0°                      2° E

Légende : ░ mailles vides, ▓ mailles avec données
Zoom : Togo complet
Surface : ~56 785 km²
```

### Performance

| Opération | Simple | Étendu | Facteur |
|-----------|--------|--------|---------|
| **Setup initial** |
| Migration | - | ~1s | - |
| Load country | - | ~1s | - |
| Make grid | - | 5-15s | - |
| Seed | ~5s | ~3s | - |
| **Total** | **~5s** | **~20s** | **×4** |
| **Queries** |
| `/coverage/mailles` | <50ms (5 mailles) | <500ms (1000 mailles) | ×10 |
| `/grid/{code}` | <100ms | <100ms | ×1 |
| `/recompute/{code}` | <150ms (3-5 pts) | <200ms (5-20 pts) | ×1.3 |

### Reproductibilité

#### Workflow Simple
```bash
# Toujours identique
docker compose run --rm etl etl load-sample
# → 12 sondages S1-S12 aux mêmes positions
# → 36 essais avec les mêmes valeurs
```

#### Workflow Étendu
```bash
# Reproductible avec seed
docker compose run --rm etl etl load-sample-extended --seed 42
# → 24 sondages (exemple) aux mêmes positions
# → 67 essais (exemple) avec les mêmes valeurs

# Seed différent = données différentes
docker compose run --rm etl etl load-sample-extended --seed 123
# → 28 sondages à d'autres positions
# → 73 essais avec d'autres valeurs
```

---

## Recommandations

### Utiliser Workflow Simple si :
- ✅ Vous développez l'API backend
- ✅ Vous écrivez des tests automatisés
- ✅ Vous avez besoin d'un setup rapide (<10s)
- ✅ Vous voulez des données prévisibles
- ✅ Vous n'avez pas besoin de carte complète

### Utiliser Workflow Étendu si :
- ✅ Vous développez l'UI/carte
- ✅ Vous faites une démo client
- ✅ Vous testez des algorithmes d'interpolation spatiale
- ✅ Vous voulez des statistiques réalistes
- ✅ Vous documentez le projet (screenshots)
- ✅ Vous développez des fonctionnalités géographiques

### Combiner les deux ?
Oui ! Les workflows sont **compatibles** :

```bash
# Development rapide avec Simple
docker compose run --rm etl etl load-sample

# Passer à Étendu pour démo
docker compose exec db psql -U atlas -d atlas -f /docker-entrypoint-initdb.d/007_grid_v0.7.0.sql
docker compose run --rm etl etl load-country
docker compose run --rm etl etl make-grid
docker compose run --rm etl etl load-sample-extended

# Revenir à Simple pour tests
docker compose run --rm etl etl load-sample
# (écrase les données mais garde la grille)
```

---

## Migration Simple → Étendu

Si vous avez déjà des données avec le workflow Simple :

```bash
# 1. Sauvegarder les données existantes (optionnel)
docker compose exec db pg_dump -U atlas atlas > backup.sql

# 2. Nettoyer
docker compose run --rm etl etl load-sample-extended
# (TRUNCATE automatique des sondages/essais)

# 3. La grille existante sera remplacée par make-grid
docker compose run --rm etl etl make-grid
```

**Attention** : Les codes mailles changeront (TG-001 → TG-0234 par exemple).

---

## FAQ

### Puis-je combiner les deux seeds ?
Non, `load-sample` et `load-sample-extended` font tous deux un TRUNCATE des tables `sondages` et `essais`. Le dernier exécuté écrase les données.

### Puis-je ajouter des sondages manuellement après ?
Oui ! Les commandes ETL ne sont que des helpers. Vous pouvez INSERT via SQL :

```sql
INSERT INTO sondages (id, geom, date_sondage, source, meta)
VALUES (
  gen_random_uuid(),
  ST_Transform(ST_SetSRID(ST_MakePoint(1.25, 6.15), 4326), 25231),
  '2025-01-15',
  'MANUAL',
  '{"operator": "John Doe"}'::jsonb
);
```

### La grille Étendue est-elle nécessaire pour Simple ?
Non ! `load-sample` crée ses propres 5 mailles. Vous n'avez pas besoin de `make-grid`.

### Puis-je utiliser make-grid sans load-sample-extended ?
Oui ! La grille est indépendante des sondages. Vous pouvez :
- Générer la grille
- Charger vos propres sondages (CSV, ShapeFile, etc.)

### Combien de temps pour regénérer tout ?
```bash
# Simple : ~5s
docker compose run --rm etl etl load-sample

# Étendu : ~25s
docker compose run --rm etl etl load-country && \
docker compose run --rm etl etl make-grid && \
docker compose run --rm etl etl load-sample-extended
```

---

## Conclusion

Les deux workflows sont **complémentaires** :

- **Simple** = rapidité, tests, développement backend
- **Étendu** = réalisme, démos, développement UI

Choisissez selon votre cas d'usage, et n'hésitez pas à **alterner** entre les deux ! 🎯
