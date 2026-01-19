# Session 2026-01-17 — Refonte Grille V2 (Migration 106) : tentative, exécution, échec contrôlé, diagnostic

## 0) Métadonnées

- **Date**: 2026-01-17
- **Sujet**: Refonte grille 2km/28km (topologie parfaite + conservation des codes) + tentative d’implémentation SQL
- **Périmètre impacté**:
  - Documentation (ADR + TODO)
  - DB PostGIS (tentative migration `106_refonte_grille_v2.sql`)
- **Conteneurs**:
  - DB: `atlas-db` (image `postgis/postgis:16-3.4`)
  - API: `atlas-api-geo`
  - UI: `atlas-ui`

---

## 1) Contexte / objectif

### 1.1 Constat

- En UI (Leaflet), apparition de:
  - “doubles traits” sur les frontières de mailles
  - “canyons” (vides) entre certaines mailles

### 1.2 Hypothèse de départ

- La grille 28km hérite des défauts de la grille 2km.
- Une refonte bottom-up (2km propre, puis 28km = agrégation) est nécessaire.

### 1.3 Objectif de la session

- Documenter une stratégie robuste (Iso-Code) et démarrer l’implémentation DB.

---

## 2) Décisions & documentation produite

### 2.1 ADR

- **Ajout**: `atlas/docs/ADR_001_REFONTE_GRILLE.md`
- **Contenu**:
  - Contexte / cause racine
  - Principes directeurs (28km = 14x14 strict)
  - Algorithme “Iso-Code” (conserver les codes, régénérer géométrie)
  - Architecture de données (legacy + mapping)
  - Procédure technique et validation

### 2.2 Session TODO

- **Ajout en tête de fichier**: `atlas/TODO.md`
- **Section**: `SESSION 17/01/2026 - ADR_001 REFONTE GRILLE ...`
- **Contenu**:
  - Objectifs
  - Checklist exécution DB
  - Recette/tests

---

## 3) Cartographie DB & état initial (avant migration)

### 3.1 Commandes exécutées

- État docker:

```powershell
docker compose ps
```

- Inventaire tables:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "\\dt atlas.*"
```

- Schéma tables clés:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.mailles"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "\\d+ atlas.maille_28km"
```

- Bornes/compteurs:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS n_mailles, MIN(ST_XMin(geom)) xmin, MIN(ST_YMin(geom)) ymin, MAX(ST_XMax(geom)) xmax, MAX(ST_YMax(geom)) ymax FROM atlas.mailles;"
```

### 3.2 Résultats notables

- `atlas.mailles`:
  - PK `id` (uuid)
  - code unique `code`
  - géométrie `geometry(Polygon,25231)`
  - FK sortantes: `id_m28` → `atlas.maille_28km(id_m28)`
  - FK entrantes: `colab_missions.maille_id`, `colab_maille_assignments.maille_id`

- `atlas.maille_28km`:
  - `id_m28 serial` PK
  - `code_m28` unique
  - `code_lisible` indexé

- `atlas.sondages`: contient `grid_code`, `id_m28`

---

## 4) Implémentation tentée: Migration 106 (refonte grille V2)

### 4.1 Création du script

- **Fichier créé**:
  - `atlas/db/migrations/106_refonte_grille_v2.sql`

> Problème: le conteneur DB ne monte pas `atlas/db/migrations` dans `/docker-entrypoint-initdb.d`.

- **Copie créée pour exécution via volume monté**:
  - `atlas/migrations/106_refonte_grille_v2.sql`

### 4.2 Contenu fonctionnel visé

- Snapshot legacy: `atlas.mailles_legacy` (idempotent)
- Paramètres: `atlas.grid_refonte_v2_params`
- Estimation X0/Y0 via `mode()` (hypothèse: pas de rotation)
- Régénération in-place de `atlas.mailles.geom` via `ST_MakeEnvelope` (conserver UUID)
- Rebuild `atlas.maille_28km`
- Recréation FK + relink `id_m28`
- Mapping optionnel: `atlas.migration_mailles_logs`

---

## 5) Sauvegarde de sécurité

### 5.1 Commandes

- Création dossier backups dans le volume PG:

```powershell
docker exec -i atlas-db bash -lc "mkdir -p /var/lib/postgresql/data/backups && ls -la /var/lib/postgresql/data/backups"
```

- Dump (format custom):

```powershell
docker exec -i atlas-db pg_dump -U atlas -d atlas_clean -Fc -f /var/lib/postgresql/data/backups/pre_refonte_grille_v2_20260117.dump
```

### 5.2 Résultat

- Dump créé avec succès:
  - `/var/lib/postgresql/data/backups/pre_refonte_grille_v2_20260117.dump`

---

## 6) Exécution de la migration 106 et incidents

### 6.1 Premier run (échec FK)

- Exécution:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/106_refonte_grille_v2.sql
```

- **Erreur**: violation FK lors de la recréation de `fk_mailles_maille28km`
  - Cause: `atlas.mailles.id_m28` contenait encore des valeurs historiques alors que `atlas.maille_28km` avait été `TRUNCATE ... RESTART IDENTITY`.

- **Correctif appliqué au script**:
  - Reset `id_m28` à `NULL` (mailles + sondages) avant de recréer les FK.

### 6.2 Second run (succès technique mais résultat fonctionnel incorrect)

- Après correction FK, la migration s’exécute sans erreur.

- Tests rapides post-run:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS n_m28 FROM atlas.maille_28km;"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) AS n_mailles_linked FROM atlas.mailles WHERE id_m28 IS NOT NULL;"
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FILTER (WHERE id_m28 IS NULL) AS orphelins, COUNT(*) FILTER (WHERE id_m28 IS NOT NULL) AS ok FROM atlas.sondages WHERE deleted_at IS NULL;"
```

- **Résultat**:
  - `atlas.maille_28km` vide (`n_m28 = 0`)
  - `atlas.mailles.id_m28` non rempli
  - Tous les sondages deviennent orphelins côté 28km

### 6.3 Tentative de correction: 28km par coordonnées calculées

- Hypothèse: génération 28km via `ST_GeometryN`/`ST_Union` renvoyait des `NULL`.
- Modification du script: construire les 28km par `ST_MakeEnvelope` (blocs 14x14) basé sur X0/Y0.
- Re-run: insertion 28km non vide avant filtrage, puis suppression totale au filtrage (au final `0`).

---

## 7) Investigation / analyse (diagnostic final)

### 7.1 Vérifications sur la legacy

- Statistiques sur `atlas.mailles_legacy`:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) n, MIN(ST_Area(geom)) min_area, PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ST_Area(geom)) p50_area, MAX(ST_Area(geom)) max_area FROM atlas.mailles_legacy;"
```

- Dimensions bbox typiques:

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -c "SELECT code, (ST_XMax(geom)-ST_XMin(geom)) w, (ST_YMax(geom)-ST_YMin(geom)) h, ST_NPoints(ST_ExteriorRing(geom)) npts FROM atlas.mailles_legacy WHERE code LIKE 'TG-%-%-01' ORDER BY w DESC LIMIT 5;"
```

### 7.2 Résultats

- La bbox d’une maille legacy est souvent ~`1414.21356` sur X et Y (≈ `2000 / sqrt(2)`), ce qui révèle une **grille tournée / oblique**, pas une grille axis-aligned.
- La surface médiane est ~`2,000,000 m²`.

### 7.3 Conclusion

- Hypothèse initiale de migration (récupérer uniquement `X0/Y0` avec un pas de 2000 sur axes X/Y) est **fausse**.
- La grille 2km actuelle est compatible avec un repère oblique (rotation ~45°) : pour conserver les codes en iso-position, il faut retrouver:
  - un **point d’origine**
  - **deux vecteurs de base** (pas col/row), pas seulement X0/Y0.

---

## 8) Recommandation et plan correctif

### 8.1 Action immédiate recommandée

- **Rollback** vers le dump créé avant migration:
  - `/var/lib/postgresql/data/backups/pre_refonte_grille_v2_20260117.dump`

### 8.2 Nouvelle approche de refonte (à implémenter)

- Modèle affine sur les centroïdes (ou sommets) :
  - `C = O + ix * U + iy * V`
  - où `U` et `V` sont des vecteurs (pas) représentant les directions de grille.
- Estimation de `O, U, V` par moindres carrés (ou par calibration sur voisins).
- Reconstruction de chaque maille comme un parallélogramme: coins = `C ± U/2 ± V/2`.
- Construction 28km: blocs 14x14 via `14*U` et `14*V`.

---

## 9) Etat final de la session

- Documentation produite: ✅ (ADR + TODO)
- Dump de sécurité: ✅
- Migration 106: ✅ exécution possible, ❌ résultat fonctionnel (grille non conforme)
- Diagnostic: ✅ (grille legacy oblique → modèle X0/Y0 insuffisant)
- Action en attente: rollback (validation utilisateur)

---

## 10) Next steps (checklist reproductible)

1. Restaurer la DB depuis le dump pré-refonte.

---

## 11) Tournant de stratégie (Breaking Change) : "Vrai 2km" (V2)

### 11.1 Décision

- Abandon de la conservation stricte de la correspondance code→position (Iso-Code) : la grille legacy étant oblique, la conservation du code en conservant la géométrie/position n'est pas mathématiquement compatible avec une grille axis-aligned 2km.
- Adoption d'une **rupture de compatibilité** :
  - La maille `TG-0488-0212-01` (legacy) ne correspondra pas spatialement à la maille `TG-0488-0212-01` (V2).
  - On archive la grille legacy et on **migre spatialement** les sondages vers la nouvelle grille.

### 11.2 Norme V2 (définition mathématique)

- SRID: EPSG:25231
- Origine (point rond, indices positifs):
  - `X0 = 200000`
  - `Y0 = 600000`
- Pas strict:
  - `step = 2000`
- Structure 28km:
  - `28km = 14 x 14` mailles 2km

### 11.3 Migration V2 proposée

- **Nom**: `107_correction_taille_reelle_2km.sql`
- **But**:
  - Archiver l'ancienne grille (`atlas.mailles` -> legacy)
  - Générer une grille 2km parfaite via `ST_MakeEnvelope`
  - Regénérer `atlas.maille_28km`
  - Migrer `atlas.sondages.grid_code` et `atlas.sondages.id_m28` spatialement

---

## 12) Next steps (nouvelle checklist reproductible)

1. Restaurer la DB depuis le dump pré-refonte.
2. Créer et exécuter la migration `107_correction_taille_reelle_2km.sql`.
3. Recette DB:
   - `COUNT(*)` sur `atlas.mailles` et `atlas.maille_28km` > 0
   - surface moyenne des mailles (hors bord) ~ `4,000,000 m²`
   - `atlas.mailles.id_m28` rempli
   - `atlas.sondages.grid_code` et `atlas.sondages.id_m28` remplis pour les sondages géocodés
4. Recette UI:
   - zoom fort: disparition des doubles traits / canyons
