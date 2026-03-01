# 📋 AUDIT COMPLET - Données & Géocodage (Partie 1/3)

**Date:** 2025-11-06  
**Objectif:** Photo exacte du modèle, lignage, flags UI

---

## A) SCHÉMA & DICTIONNAIRE

### Tables Principales

#### 1. `sondages` (Brute - 230 sondages)

**État actuel:**
- 230 sondages totaux
- 1 avec géométrie (0.4%)
- 0 avec ADM3
- 229 en mode `unknown` (99.6%)
- 176 avec `localite = NULL` (76%)

**Colonnes clés:**
- `id` (uuid PK)
- `code` (text UK) - Ex: "GRANULO-KOMAH"
- `localite` (text) - Nom village (NULL pour 176)
- `adm3_id` (uuid FK) - NULL pour tous
- `adm3_name` (text) - NULL pour tous
- `geom` (geometry Point 25231) - NULL pour 229
- `location_mode` (enum) - unknown pour 229
- `is_geocoded` (boolean) - false pour 229
- `source` (text) - "Granulométrie", "Limite", etc.

#### 2. `atlas.surveys` (Canonique - 40 localités)

**État actuel:**
- 40 localités uniques
- 1 avec géométrie (2.5%)
- 0 avec ADM3
- 39 sans localisation (97.5%)

**Colonnes clés:**
- `id` (uuid PK) - = premier sondage de la localité
- `code` (text UK) - Code canonique
- `localite_canon` (text UK) - Clé de regroupement normalisée
- `localite` (text) - Nom humain
- `nb_sondages_source` (int) - Nombre agrégé
- `has_geom` (boolean GENERATED) - `geom IS NOT NULL`
- `has_adm3` (boolean GENERATED) - `adm3_id IS NOT NULL`
- `is_geocoded` (boolean) - `geom OR adm3`

#### 3. `atlas.survey_aliases` (54 alias)

Mapping codes historiques → localité canonique.

Exemple: GRANULO-KOMAH, BLEU-KOMAH, LIMITE-KOMAH → Komah

---

## B) LIGNAGE

### Pipeline

```
Import → sondages (brute)
       ↓
atlas.v_sondages_unifies (vue, agrège par localite_canon)
       ↓
atlas.mv_sondages_unifies (MV)
       ↓
atlas.refresh_surveys() (fonction)
       ↓
atlas.surveys + atlas.survey_aliases (tables canoniques)
```

### Fonction `atlas.refresh_surveys()`

1. REFRESH MV
2. TRUNCATE surveys + aliases
3. INSERT depuis MV
4. Transforme geom (25231 → 4326)

**Appelé par:**
- PATCH `/surveys-canon/:id/geometry` (après update)
- Manuellement

### Calcul Flags

**Dans MV:**
```sql
has_geom := (array_agg(geom) FILTER (WHERE geom IS NOT NULL))[1] IS NOT NULL
has_adm3 := (array_agg(adm3_id) FILTER (WHERE adm3_id IS NOT NULL))[1] IS NOT NULL
is_geocoded := has_geom OR has_adm3
```

**Dans surveys:**
```sql
has_geom BOOLEAN GENERATED ALWAYS AS (geom IS NOT NULL) STORED
has_adm3 BOOLEAN GENERATED ALWAYS AS (adm3_id IS NOT NULL) STORED
```

### Fonction `atlas.norm()`

```sql
lower(unaccent(regexp_replace($1, '\s+', ' ', 'g')))
```

Transforme: "Adjengré  " → "adjengre"

Utilisé pour:
- Index trigram
- Recherche accent-insensitive
- Similarité ADM3

---

## C) ENDPOINTS API

### ✅ Implémentés

| Endpoint | Méthode | Fichier | UI |
|----------|---------|---------|-----|
| `/surveys-canon` | GET | surveys_canon.rs:45 | geocode-canon-panel, sondages-modal |
| `/surveys-canon/stats` | GET | surveys_canon.rs:170 | Tous panneaux |
| `/surveys-canon/:id` | GET | surveys_canon.rs:133 | sondages-modal:433 |
| `/surveys-canon/:id/adm3-candidates` | GET | surveys_canon.rs:316 | geocode-canon-panel:257 |
| `/surveys-canon/:id/geometry` | PATCH | surveys_canon.rs:209 | geocode-canon-panel:331 |

**Payload PATCH:**
```json
{
  "mode": "exact|adm",
  "geom": {"type": "Point", "coordinates": [lon, lat]},  // Si exact
  "adm3_id": 184  // Si adm (gid de adm3)
}
```

### ❌ Anciens (non utilisés)

- `/geocode/suggestions` (geocoding.rs)
- `/geocode/manual` (geocode_manual.rs)

**Action:** Marquer deprecated

---

## D) KPI SONDAGES

### Requête

```sql
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geom,
  COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as avec_adm3,
  COUNT(*) FILTER (WHERE geom IS NOT NULL OR adm3_id IS NOT NULL) as geocodes,
  COUNT(*) FILTER (WHERE location_mode = 'unknown') as mode_unknown
FROM sondages
WHERE deleted_at IS NULL;
```

### Résultats

| Métrique | Valeur | % |
|----------|--------|---|
| Total | 230 | 100% |
| Avec géométrie | 1 | 0.4% |
| Avec ADM3 | 0 | 0% |
| Géocodés | 1 | 0.4% |
| Mode unknown | 229 | 99.6% |

### Top Localités

| Localité | Nb Sondages |
|----------|-------------|
| INCONNU | 176 (76%) |
| Lama | 4 |
| Kamina | 3 |
| Tchamba | 2 |
| Ountivou | 2 |

---

Voir PART2 pour incohérences et recommandations.
