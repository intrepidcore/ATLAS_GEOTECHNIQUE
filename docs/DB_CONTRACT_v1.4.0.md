# Contrat Base de Données v1.4.0 - Import Bulk

**Date:** 19 octobre 2025  
**Version:** 1.4.0  
**Statut:** ✅ Contrat stable

---

## 📋 Vue d'ensemble

Ce document définit le **contrat d'interface stable** entre l'API Rust et la base de données PostgreSQL/PostGIS pour la fonctionnalité Import Bulk. Tout écart entre le schéma physique et ce contrat doit être résolu par des **vues de compatibilité** ou des **alias SQL**.

---

## 🗂️ Tables et Colonnes

### Table: `sondages`

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | UUID | NO | Identifiant unique (PK) |
| `gid` | INTEGER | NO | ID séquentiel (legacy) |
| `code` | TEXT | YES | Code unique du sondage |
| `geom` | GEOMETRY(Point, 25231) | YES | Géométrie (projection UTM 31N) |
| `date` | DATE | YES | Date du sondage |
| `source` | TEXT | YES | Source des données |
| `operator` | TEXT | YES | Opérateur |
| `notes` | TEXT | YES | Notes |
| `type_sol` | TEXT | YES | Type de sol |
| `location_mode` | TEXT | YES | Mode géolocalisation (exact/centroid/random/unknown/maille) |
| `is_geocoded` | BOOLEAN | YES | Indique si géocodé |
| `location_accuracy` | TEXT | YES | Précision localisation |
| `adm1_id` | UUID | YES | Référence ADM1 |
| `adm2_id` | UUID | YES | Référence ADM2 |
| `adm3_id` | UUID | YES | Référence ADM3 |
| `maille_code` | TEXT | YES | Code de maille |
| `import_id` | UUID | YES | Référence lot d'import |
| `import_row_idx` | INTEGER | YES | Index ligne dans fichier source |
| `created_at` | TIMESTAMPTZ | YES | Date création |
| `updated_at` | TIMESTAMPTZ | YES | Date modification |
| `deleted_at` | TIMESTAMPTZ | YES | Date suppression (soft delete) |

**Notes:**
- `geom` est en SRID 25231 (UTM 31N)
- Pour l'API, transformer en 4326 (WGS84) avec `ST_Transform(geom, 4326)`
- `location_mode` valeurs: `exact`, `centroid`, `random`, `unknown`, `maille`

---

### Table: `essais`

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | UUID | NO | Identifiant unique (PK) |
| `gid` | INTEGER | NO | ID séquentiel (legacy) |
| `sondage_id` | UUID | NO | Référence sondage (FK) |
| `type` | TEXT | NO | Type d'essai |
| `depth_m` | NUMERIC | NO | Profondeur (m) |
| `value` | NUMERIC | YES | Valeur numérique |
| `unit` | TEXT | YES | Unité |
| `analyse_qualitative` | TEXT | YES | Analyse qualitative (Faible/Moyen/Fort/etc.) |
| `is_from_import` | BOOLEAN | YES | Provient d'un import bulk |
| `import_id` | UUID | YES | Référence lot d'import |
| `created_at` | TIMESTAMPTZ | YES | Date création |
| `updated_at` | TIMESTAMPTZ | YES | Date modification |
| `deleted_at` | TIMESTAMPTZ | YES | Date suppression (soft delete) |

**Notes:**
- `type` contient les valeurs: `Granulometrie`, `BleuMethylene_VBS`, `Atterberg_WL`, `Atterberg_WP`, `Atterberg_IP`, `Proctor_gdmax`, `Proctor_wopt`, `PotentielGonflement_eg`, `SPT_N`, `qc`, etc.
- `value` et `analyse_qualitative` sont mutuellement exclusifs (au moins un doit être renseigné)

---

### Tables: `adm1`, `adm2`, `adm3`

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | UUID | NO | Identifiant unique (PK) |
| `gid` | INTEGER | NO | ID séquentiel (legacy) |
| `name` | TEXT | NO | Nom de la division |
| `code` | TEXT | YES | Code (ex: TG040106 pour ADM3) |
| `geom` | GEOMETRY(MultiPolygon, 4326) | NO | Géométrie (WGS84) |

**Notes ADM2:**
- Colonne additionnelle: `adm1_id` (UUID, référence vers ADM1)

**Notes ADM3:**
- Colonne additionnelle: `adm2_id` (UUID, référence vers ADM2)

**Matching:**
- Utiliser `unaccent(lower(name))` pour matching insensible aux accents/casse
- Extension PostgreSQL requise: `unaccent`, `pg_trgm` (pour fuzzy matching)

---

### Table: `mailles`

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | UUID | NO | Identifiant unique (PK) |
| `gid` | INTEGER | NO | ID séquentiel (legacy) |
| `code` | TEXT | NO | Code unique maille |
| `geom` | GEOMETRY(Polygon, 25231) | NO | Géométrie (UTM 31N) |
| `adm1_name` | TEXT | YES | Nom ADM1 |
| `adm2_name` | TEXT | YES | Nom ADM2 |
| `adm3_name` | TEXT | YES | Nom ADM3 |

---

### Table: `imports` (Import Bulk)

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | UUID | NO | Identifiant unique (PK) |
| `filename` | TEXT | NO | Nom fichier |
| `size_bytes` | INTEGER | NO | Taille fichier |
| `content_hash` | TEXT | NO | Hash SHA256 |
| `created_by` | TEXT | YES | Utilisateur |
| `created_at` | TIMESTAMPTZ | YES | Date création |
| `started_at` | TIMESTAMPTZ | YES | Date démarrage |
| `completed_at` | TIMESTAMPTZ | YES | Date fin |
| `mapping_json` | JSONB | NO | Configuration mapping |
| `geoloc_mode` | TEXT | NO | Mode géolocalisation |
| `seed` | INTEGER | YES | Seed pour random |
| `status` | TEXT | NO | Statut (pending/running/succeeded/failed/partial/cancelled) |
| `stats_json` | JSONB | YES | Statistiques |
| `file_blob` | BYTEA | YES | Fichier brut |
| `error_message` | TEXT | YES | Message d'erreur |
| `progress` | NUMERIC(5,2) | YES | Progression (0-100) |

---

### Table: `import_items` (Traçabilité)

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `id` | UUID | NO | Identifiant unique (PK) |
| `import_id` | UUID | NO | Référence import (FK) |
| `row_idx` | INTEGER | NO | Numéro ligne source |
| `status` | TEXT | NO | Statut (ok/warning/error/skipped) |
| `error_msg` | TEXT | YES | Message erreur |
| `warning_msg` | TEXT | YES | Message warning |
| `created_survey_id` | UUID | YES | Sondage créé |
| `created_tests_count` | INTEGER | YES | Nombre essais créés |
| `raw_json` | JSONB | YES | Données source brutes |
| `fingerprint` | TEXT | YES | Hash anti-doublon |
| `created_at` | TIMESTAMPTZ | YES | Date création |

---

### Table: `test_type_defaults` (Référentiel)

**Colonnes du contrat API:**

| Colonne | Type | Nullable | Description |
|---------|------|----------|-------------|
| `type_essai` | TEXT | NO | Type d'essai (PK) |
| `default_unit` | TEXT | NO | Unité par défaut |
| `min_value` | NUMERIC | YES | Valeur minimale |
| `max_value` | NUMERIC | YES | Valeur maximale |
| `accepted_units` | TEXT[] | YES | Unités acceptées |
| `converter_fn` | TEXT | YES | Fonction conversion |
| `description` | TEXT | YES | Description |
| `created_at` | TIMESTAMPTZ | YES | Date création |

---

## 🔄 Transformations Géométriques

### Insertion (API → DB)

```sql
-- Coordonnées WGS84 (lon, lat) → UTM 31N (SRID 25231)
ST_Transform(
    ST_SetSRID(ST_MakePoint($lon, $lat), 4326),
    25231
)
```

### Lecture (DB → API)

```sql
-- UTM 31N → WGS84 pour GeoJSON
ST_AsGeoJSON(ST_Transform(geom, 4326))::jsonb
```

---

## 🎯 Fonctions SQL Requises

### Extensions PostgreSQL

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```

### Fonctions Utilitaires

```sql
-- Fingerprint anti-doublon
compute_import_fingerprint(localite, date, type_essai, profondeur_m, valeur) → TEXT

-- Validation valeur essai
validate_test_value(type_essai, valeur, unite) → (is_valid BOOLEAN, error_msg TEXT, warning_msg TEXT)
```

---

## 📝 Règles de Nommage

### Conventions

- **Tables:** snake_case, pluriel (ex: `sondages`, `essais`)
- **Colonnes:** snake_case (ex: `created_at`, `adm1_id`)
- **Enum values:** snake_case (ex: `pending`, `succeeded`)
- **Géométries:** toujours nommées `geom`
- **IDs:** `id` (UUID) + `gid` (INTEGER legacy)
- **Foreign Keys:** `{table}_id` (ex: `sondage_id`, `import_id`)

### Types Spéciaux

- **Dates:** `TIMESTAMPTZ` (avec timezone)
- **JSON:** `JSONB` (indexable)
- **Géométries:** `GEOMETRY(type, SRID)`
- **UUIDs:** `UUID` (v4 par défaut)

---

## ✅ Checklist Conformité

Pour qu'un module soit conforme au contrat v1.4.0:

- [ ] Utilise les noms de colonnes exacts du contrat
- [ ] Transforme les géométries avec les bons SRID
- [ ] Gère les soft deletes (`deleted_at IS NULL`)
- [ ] Utilise `unaccent(lower())` pour matching texte
- [ ] Valide les valeurs avec `test_type_defaults`
- [ ] Trace les imports avec `import_id`
- [ ] Génère des fingerprints anti-doublon
- [ ] Log les erreurs dans `import_logs`

---

## 🔧 Maintenance

### Évolution du Contrat

1. **Changements non-breaking:** Ajout colonnes optionnelles → Patch version
2. **Changements breaking:** Renommage/suppression colonnes → Major version
3. **Migrations:** Toujours fournir script de migration + rollback

### Vérification

```bash
# Vérifier conformité schéma
cargo sqlx prepare --check

# Regénérer métadonnées
cargo sqlx prepare --merge
```

---

## 📚 Références

- **Migrations:** `db/migrations/009_import_bulk.sql`
- **Code Rust:** `services/api-geo/src/import_bulk/`
- **Cahier des charges:** `docs/CAHIER_CHARGES_IMPORT_BULK.md`
- **Décisions techniques:** `docs/IMPORT_BULK_DECISIONS.md`
