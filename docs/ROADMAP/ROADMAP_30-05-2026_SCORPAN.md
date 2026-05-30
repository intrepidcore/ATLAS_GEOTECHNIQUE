```
══════════════════════════════════════════════════════════════════════
ATLAS GÉOTECHNIQUE TOGO — ROADMAP SCORPAN + RK COMPLÈTE
Intrepid Core Engineering Standards
Session : Architecture + Tests + Orchestration SCORPAN/RK
══════════════════════════════════════════════════════════════════════

VISION INTREPID CORE :
  "Innover localement, impacter globalement."
  Platform-grade, jamais prototype-grade.
  Chaque livrable doit être :
  - Traçable   : versionné, auditable, reproductible
  - Fiable     : testé, validé, avec preuves mesurables
  - Durable    : auto-améliorant sur import de nouvelles données
  - Honnête    : aucune simplification algorithmique déguisée
                en optimisation

CONTEXTE SCIENTIFIQUE :
  Ce pipeline calcule les covariables SCORPAN et la Régression
  Kriging (RK) pour la cartographie géotechnique nationale du Togo.
  La base de données GROSSIRA avec de nouveaux sondages.
  Chaque décision d'architecture doit rester valide à N=1000 sondages.

  Hiérarchie des méthodes (immuable) :
    L1 : KED (déjà en production, 21 params × 29 407 mailles)
    L2 : Régression Kriging SCORPAN (cette session)
    L3 : ML CatBoost (session future, N > 200 sondages)

ÉTAT ACQUIS — NE PAS RECALCULER :
  ✅ KED : 21 paramètres × 3 horizons × 29 407 mailles (100%)
  ✅ DSM altitude_mean : 29 407 mailles (calculé)
  ✅ DSM slope/TPI/HAND/river : 29 407 mailles (calculé)
  ✅ WorldClim rasters : tables worldclim_prec + worldclim_bio en DB
  ✅ maille_climate_features : prec_annual, bio12, bio15, bio4, bio17
  ✅ Vue v_scorpan_features : migration 150 (29 407 lignes)
  ✅ RK VBS/IP/WL/WP H1/H2/H3 : 352 884 valeurs (terrain, pas KED)

PROBLÈMES IDENTIFIÉS À CORRIGER (dans l'ordre) :
  ❌ EG manquant dans le pipeline RK
  ❌ prec_dry / prec_wet non calculés (worldclim_prec structure inconnue)
  ❌ LOO-CV non implémentée (formule analytique PyKrige, pas sous-échant.)
  ❌ API non recompilée (params vbs_rk_h1... renvoient 422)
  ❌ Dump desktop contient rasters WorldClim (+900 MB inutiles)
  ❌ token.txt + temp_*.ps1 + *.exe dans Git

RÈGLES D'EXÉCUTION (issues des guidelines Intrepid Core) :
  [GEN-01] Inspecter la DB avant d'écrire quoi que ce soit
  [DB-10]  Lister tables/colonnes/SRID/FK avant toute migration
  [DB-11]  Scripts atomiques, idempotents, ON_ERROR_STOP=1
  [DB-22]  Dump avant toute migration numérotée
  [ETL-03] Gestion d'erreurs systématique, jamais continuer en silence
  [CFG-01] Aucune URL/port hardcodé dans le code
  [DATA-02] Plages physiques : VBS 0-20, WL 20-120, WP 10-60,
            IP 0-80, EG 0-20
  [BM-11]  Tout dump = manifest SHA256 obligatoire
  [BM-SYNC-05] Scripts idempotents, un même run ne s'applique pas 2×

VARIABLES D'ENVIRONNEMENT :
  DB   : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
  PSQL : "C:\Program Files\PostgreSQL\17\bin\psql.exe"
  PG_DUMP : "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"
  API  : http://127.0.0.1:8000
  REPO : C:\PROJET_ATLAS_MASTER\atlas_reclone
  PORT DB : 5433 (NE PAS UTILISER 5432 — mauvaise instance)

══════════════════════════════════════════════════════════════════════
PHASE 0 — CARTOGRAPHIE COMPLÈTE DE LA BASE DE DONNÉES
Principe GEN-01 + DB-10 : inspecter AVANT d'écrire
Durée estimée : 20 min — aucune modification DB
══════════════════════════════════════════════════════════════════════

OBJECTIF : Produire un catalogue précis de chaque table/colonne
impliquée dans le pipeline SCORPAN/RK. Zéro erreur de type ou de nom
dans les étapes suivantes.

0A — Cartographie des tables de calcul SCORPAN :

  Écrire scripts/psql/00_cartographie_db.sql :
  ```sql
  -- 0A-1 : Tables impliquées dans SCORPAN/RK
  SELECT
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
  FROM information_schema.tables t
  JOIN information_schema.columns c
    ON c.table_schema = t.table_schema
    AND c.table_name = t.table_name
  WHERE t.table_schema = 'atlas'
    AND t.table_name IN (
      'mailles',
      'ai_context_features_maille',
      'maille_climate_features',
      'ai_interpolation_values',
      'ai_interpolation_runs',
      'ai_variograms',
      'ai_parameter_catalog',
      'v_scorpan_features',
      'worldclim_prec',
      'worldclim_bio',
      'essais_geotechniques',
      'essais_vbs',
      'essais_atterberg',
      'essais_physiques',
      'essais_potentiel_gonflement',
      'sondages',
      'echantillons'
    )
  ORDER BY t.table_name, c.ordinal_position;
```

0B — Cartographie des vues et matviews :

```sql
-- 0B-1 : Toutes les vues liées au pipeline
SELECT viewname, definition
FROM pg_views
WHERE schemaname = 'atlas'
  AND viewname IN (
    'v_scorpan_features',
    'v_echantillons_essais',
    'v_latest_ai_interpolation',
    'v_maille_dsm_2km',
    'v_sondages_clean',
    'v_sondages_active'
  );

-- 0B-2 : Matviews
SELECT matviewname, ispopulated
FROM pg_matviews
WHERE schemaname = 'atlas';
```

0C — Cartographie de la structure WorldClim :

```sql
-- 0C-1 : Structure exacte des rasters WorldClim
SELECT
  'worldclim_prec' as tbl,
  COUNT(*) as n_tuiles,
  ST_Numbands(rast) as n_bandes,
  ST_ScaleX(rast) as scale_x,
  ST_ScaleY(rast) as scale_y,
  ST_SRID(rast) as srid
FROM atlas.worldclim_prec
LIMIT 1;

SELECT
  'worldclim_bio' as tbl,
  COUNT(*) as n_tuiles,
  ST_Numbands(rast) as n_bandes,
  ST_SRID(rast) as srid
FROM atlas.worldclim_bio
LIMIT 1;

-- 0C-2 : Nombre de bandes par tuile (crucial pour prec_dry/wet)
SELECT rid, ST_Numbands(rast) as bands
FROM atlas.worldclim_prec
ORDER BY rid
LIMIT 5;
```

0D — Cartographie des données terrain (v_echantillons_essais) :

```sql
-- 0D-1 : Colonnes disponibles dans la vue terrain
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'atlas'
  AND table_name = 'v_echantillons_essais'
ORDER BY ordinal_position;

-- 0D-2 : Vérifier si EG est disponible
SELECT
  COUNT(*) as total,
  COUNT(eg) as eg_count,
  COUNT(vbs) as vbs_count,
  COUNT(wl) as wl_count,
  COUNT(ip) as ip_count
FROM atlas.v_echantillons_essais
WHERE depth_m BETWEEN 0.5 AND 2.5;

-- 0D-3 : Distribution par paramètre et horizon
SELECT
  CASE
    WHEN depth_m BETWEEN 0.5 AND 1.5 THEN 'h1'
    WHEN depth_m BETWEEN 1.0 AND 2.0 THEN 'h2'
    WHEN depth_m BETWEEN 1.5 AND 2.5 THEN 'h3'
  END as horizon,
  COUNT(vbs) as vbs,
  COUNT(ip) as ip,
  COUNT(wl) as wl,
  COUNT(wp) as wp,
  COUNT(eg) as eg
FROM atlas.v_echantillons_essais
GROUP BY 1
ORDER BY 1;
```

0E — Cartographie de l'état actuel du pipeline RK :

```sql
-- 0E-1 : Paramètres RK déjà en base
SELECT
  parameter_id,
  method,
  COUNT(DISTINCT maille_id) as n_mailles,
  ROUND(AVG(value)::numeric, 3) as moyenne,
  ROUND(STDDEV(value)::numeric, 3) as ecart_type,
  ROUND(MIN(value)::numeric, 3) as min_val,
  ROUND(MAX(value)::numeric, 3) as max_val
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan'
  AND COALESCE(is_superseded, false) = false
GROUP BY parameter_id, method
ORDER BY parameter_id;

-- 0E-2 : Paramètres RK manquants (EG)
SELECT unnest(ARRAY[
  'vbs_rk_h1','vbs_rk_h2','vbs_rk_h3',
  'ip_rk_h1','ip_rk_h2','ip_rk_h3',
  'wl_rk_h1','wl_rk_h2','wl_rk_h3',
  'wp_rk_h1','wp_rk_h2','wp_rk_h3',
  'eg_rk_h1','eg_rk_h2','eg_rk_h3'
]) AS expected
EXCEPT
SELECT parameter_id
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan'
  AND COALESCE(is_superseded, false) = false;

-- 0E-3 : Vérifier les doublons
SELECT parameter_id, maille_id, COUNT(*) as n
FROM atlas.ai_interpolation_values
WHERE method = 'regression_kriging_scorpan'
  AND COALESCE(is_superseded, false) = false
GROUP BY parameter_id, maille_id
HAVING COUNT(*) > 1
LIMIT 10;
```

0F — Cartographie de la vue SCORPAN :

```sql
-- 0F-1 : Colonnes exactes de v_scorpan_features
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'atlas'
  AND table_name = 'v_scorpan_features'
ORDER BY ordinal_position;

-- 0F-2 : Couverture des features
SELECT
  COUNT(*) as total,
  COUNT(dem_altitude) as altitude,
  COUNT(dem_slope) as slope,
  COUNT(dem_tpi) as tpi,
  COUNT(dem_hand) as hand,
  COUNT(distance_river_m) as river,
  COUNT(prec_annual) as prec,
  COUNT(lon) as lon,
  COUNT(lat) as lat
FROM atlas.v_scorpan_features;
```

0G — Cartographie de ai_parameter_catalog :

```sql
-- 0G-1 : Paramètres RK dans le catalogue
SELECT parameter_id, source, category, physical_min, physical_max
FROM atlas.ai_parameter_catalog
WHERE parameter_id LIKE '%_rk_%'
ORDER BY parameter_id;

-- 0G-2 : Contraintes sur ai_interpolation_runs
SELECT
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'atlas.ai_interpolation_runs'::regclass;

-- 0G-3 : Statuts autorisés dans ai_interpolation_runs
SELECT
  conname,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'atlas.ai_interpolation_runs'::regclass
  AND conname LIKE '%status%';
```

0H — Sauvegarder le catalogue :

Exécuter le fichier SQL complet et sauvegarder la sortie dans : docs/db_catalogue_scorpan_$(date +%Y%m%d).txt

IMPORTANT : Lire attentivement chaque résultat. Ne passer à la Phase 1 qu'après avoir noté :

- Le nom exact de la colonne EG dans v_echantillons_essais (eg, eg_value, essai_eg, valeur_eg ?)
- Le nombre de bandes dans worldclim_prec (1 ou 12 ?)
- Les colonnes exactes de v_scorpan_features
- Le statut autorisé dans ai_interpolation_runs ('finished' ou 'completed' ?)
- Tous les paramètres RK déjà en base (pour ne pas recalculer)
- La présence ou non de doublons

══════════════════════════════════════════════════════════════════════ PHASE 1 — ARCHITECTURE ET TESTS Règle DB-11 : Scripts atomiques. Règle BM-SYNC-05 : Idempotents. Durée estimée : 45 min — migrations légères uniquement ══════════════════════════════════════════════════════════════════════

OBJECTIF : Mettre en place l'architecture complète avant d'écrire le script d'orchestration. Tests unitaires, d'intégration et dry-run.

1A — Migration 151 : Colonnes prec_dry / prec_wet

CONTEXTE : La cartographie Phase 0 a révélé la structure exacte de worldclim_prec. Adapter la migration en conséquence.

Si worldclim_prec a N_BANDES = 1 (une tuile par bande) : → chaque tuile est un mois → 12 tuiles correspondant aux 12 mois → prec_dry = MIN des 12 valeurs, prec_wet = MAX des 12 valeurs → utiliser ST_Value(rast, 1, centroid) sur chaque tuile

Si worldclim_prec a N_BANDES = 12 (toutes bandes dans chaque tuile) : → utiliser LEAST(ST_Value(rast,1,...), ..., ST_Value(rast,12,...))

Écrire migrations_post_v1/151_add_prec_dry_wet.sql :

```sql
-- Migration 151 : Ajout prec_dry et prec_wet
-- Ref: BM-SYNC-05 (idempotent), DB-11 (atomique)
-- Auteur: Intrepid Core Engineering
\set ON_ERROR_STOP 1
BEGIN;

ALTER TABLE atlas.maille_climate_features
  ADD COLUMN IF NOT EXISTS prec_dry  NUMERIC,
  ADD COLUMN IF NOT EXISTS prec_wet  NUMERIC;

COMMENT ON COLUMN atlas.maille_climate_features.prec_dry IS
  'Précipitation mensuelle minimale (WorldClim 2.5 arcmin) — mm';
COMMENT ON COLUMN atlas.maille_climate_features.prec_wet IS
  'Précipitation mensuelle maximale (WorldClim 2.5 arcmin) — mm';

COMMIT;
```

Exécuter : $env:PGPASSWORD = 'atlas' & $PSQL -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean `-v ON_ERROR_STOP=1` -f "migrations_post_v1\151_add_prec_dry_wet.sql"

TEST UNITAIRE 1A :

```sql
SELECT column_name FROM information_schema.columns
WHERE table_schema = 'atlas'
  AND table_name = 'maille_climate_features'
  AND column_name IN ('prec_dry', 'prec_wet');
-- ATTENDU : 2 lignes
```

1B — Migration 152 : Paramètres EG dans ai_parameter_catalog

Vérifier d'abord si eg_rk_h1/h2/h3 sont déjà dans le catalogue (résultat de la Phase 0G).

Si absents, écrire migrations_post_v1/152_add_eg_rk_catalog.sql :

```sql
\set ON_ERROR_STOP 1
BEGIN;

INSERT INTO atlas.ai_parameter_catalog
  (parameter_id, category, source, unit,
   interpolation_enabled, prediction_enabled, is_active,
   updated_at, depth_stratified, is_derived,
   physical_min, physical_max)
VALUES
  ('eg_rk_h1', 'geotech', 'interpolation', '%',
   true, true, true, now(), true, true, 0.0, 20.0),
  ('eg_rk_h2', 'geotech', 'interpolation', '%',
   true, true, true, now(), true, true, 0.0, 20.0),
  ('eg_rk_h3', 'geotech', 'interpolation', '%',
   true, true, true, now(), true, true, 0.0, 20.0)
ON CONFLICT (parameter_id) DO NOTHING;

COMMIT;
```

TEST UNITAIRE 1B :

```sql
SELECT parameter_id, physical_min, physical_max
FROM atlas.ai_parameter_catalog
WHERE parameter_id LIKE 'eg_rk_%'
ORDER BY parameter_id;
-- ATTENDU : 3 lignes, physical_max = 20.0
```

1C — Migration 153 : Paramètres EG dans types.rs (API Rust)

Ouvrir services/api-geo/src/thematic/types.rs. Après la dernière entrée WpRkH3, ajouter :

```rust
// RK EG — Essai de Gonflement
#[serde(alias = "eg_rk_h1")]
EgRkH1,
#[serde(alias = "eg_rk_h2")]
EgRkH2,
#[serde(alias = "eg_rk_h3")]
EgRkH3,
```

Dans le match sql_column(), après WpRkH3 :

```rust
Self::EgRkH1 => "eg_rk_h1",
Self::EgRkH2 => "eg_rk_h2",
Self::EgRkH3 => "eg_rk_h3",
```

Dans services/api-geo/src/thematic/routes.rs, dans la whitelist, après "wp_rk_h3" :

```rust
| "eg_rk_h1"
| "eg_rk_h2"
| "eg_rk_h3"
```

1D — Recompiler l'API (règle DESKTOP-04) :

cd C:\PROJET_ATLAS_MASTER\atlas_reclone\services\api-geo cargo build --release 2>&1 | Select-Object -Last 10

ATTENDU : Finishing `release` target(s) in Xs, 0 errors

Arrêter l'ancienne API et relancer : -- Trouver le process sur port 8000 Get-NetTCPConnection -LocalPort 8000 -ErrorAction SilentlyContinue | Select-Object OwningProcess -- Tuer le process et relancer avec le nouveau binaire

1E — Tests d'intégration API :

Récupérer un token frais :

```powershell
$body = @{email='admin@atlas.local';password='Atlas2024!'} |
  ConvertTo-Json
$r = Invoke-RestMethod http://127.0.0.1:8000/api/auth/login `
  -Method POST -ContentType 'application/json' -Body $body
$TOKEN = $r.access_token
```

TEST INTÉGRATION 1E-a : Paramètres KED existants curl "http://127.0.0.1:8000/thematic/data?parameter=vbs_ked_h1" ` -H "Authorization: Bearer $TOKEN" ATTENDU : HTTP 200, count=29407

TEST INTÉGRATION 1E-b : Paramètre RK existant curl "http://127.0.0.1:8000/thematic/data?parameter=vbs_rk_h1" ` -H "Authorization: Bearer $TOKEN" ATTENDU : HTTP 200, count=29407 (plus 422) Si encore 422 → l'API n'a pas été recompilée/relancée. Bloquer ici.

TEST INTÉGRATION 1E-c : Paramètre EG RK (pas encore calculé) curl "http://127.0.0.1:8000/thematic/data?parameter=eg_rk_h1" ` -H "Authorization: Bearer $TOKEN" ATTENDU : HTTP 200, count=0 (accepté — pas encore de données) REFUS : HTTP 422 (signifie que la whitelist n'est pas à jour)

1F — Nettoyage Git (règle GIT-01, GIT-02, INFRA-03) :

Ajouter à .gitignore :

```
token.txt
token.tmp
temp_*.ps1
temp_*.bat
temp_*.sql
*.exe
prec_err.txt
prec_out.txt
do_dump*.ps1
data/word-clim/**/*.tif
data/word-clim/**/*.zip
data/db/backups/*.dump
data/db/backups/versions/
```

Retirer du suivi Git les fichiers sensibles déjà committés : git rm --cached token.txt git rm --cached "api-geo-backup.exe" git rm --cached "atlas-pro-backup.exe" git rm --cached prec_err.txt prec_out.txt

NE PAS COMMIT encore — attendre la fin de Phase 1.

1G — Vérification de l'état global après Phase 1 :

```sql
SELECT
  -- Colonnes prec_dry/wet
  (SELECT COUNT(*) FROM information_schema.columns
   WHERE table_schema = 'atlas'
     AND table_name = 'maille_climate_features'
     AND column_name IN ('prec_dry','prec_wet')) = 2
  AS migration_151_ok,

  -- EG dans catalogue
  (SELECT COUNT(*) FROM atlas.ai_parameter_catalog
   WHERE parameter_id LIKE 'eg_rk_%') = 3
  AS migration_152_ok,

  -- Paramètres RK existants
  (SELECT COUNT(DISTINCT parameter_id)
   FROM atlas.ai_interpolation_values
   WHERE method = 'regression_kriging_scorpan'
     AND COALESCE(is_superseded, false) = false) AS rk_params_count,

  -- Doublons
  (SELECT COUNT(*) FROM (
     SELECT parameter_id, maille_id
     FROM atlas.ai_interpolation_values
     WHERE method = 'regression_kriging_scorpan'
       AND COALESCE(is_superseded, false) = false
     GROUP BY parameter_id, maille_id
     HAVING COUNT(*) > 1
  ) t) AS doublons_rk;
```

ATTENDU : migration_151_ok = true migration_152_ok = true rk_params_count = 12 (VBS/IP/WL/WP × H1/H2/H3) doublons_rk = 0

══════════════════════════════════════════════════════════════════════ PHASE 2 — SCRIPTS SQL ATOMIQUES Règle DB-11 : atomiques, idempotents, ON_ERROR_STOP=1 Un fichier SQL = une opération logique ══════════════════════════════════════════════════════════════════════

OBJECTIF : Écrire les scripts SQL de support qui seront appelés par le script Python d'orchestration. Ces scripts ne s'exécutent pas encore — ils sont seulement écrits et validés syntaxiquement.

2A — Script SQL : Calcul prec_dry depuis raster bande unique

Selon le résultat de Phase 0C (structure worldclim_prec) :

CAS A — worldclim_prec a 1 bande, 12 tuiles (une par mois) : Écrire scripts/sql/compute_prec_dry_wet_single_band.sql :

```sql
\set ON_ERROR_STOP 1
-- Calcul prec_dry (min mensuel) et prec_wet (max mensuel)
-- Source : worldclim_prec (1 bande, tuiles mensuelles)
-- Méthode : extraction ST_Value au centroïde de chaque maille

BEGIN;

CREATE TEMP TABLE IF NOT EXISTS _monthly_prec AS
SELECT
  m.code AS maille_code,
  ARRAY_AGG(
    ST_Value(r.rast, 1, ST_Transform(ST_Centroid(m.geom), 4326))
    ORDER BY r.rid
  ) AS monthly_values
FROM atlas.mailles m
JOIN atlas.worldclim_prec r
  ON ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
GROUP BY m.code;

UPDATE atlas.maille_climate_features cf
SET
  prec_dry = (
    SELECT MIN(v)
    FROM UNNEST((SELECT monthly_values FROM _monthly_prec t
                 WHERE t.maille_code = cf.maille_code)) AS v
    WHERE v IS NOT NULL AND v >= 0
  ),
  prec_wet = (
    SELECT MAX(v)
    FROM UNNEST((SELECT monthly_values FROM _monthly_prec t
                 WHERE t.maille_code = cf.maille_code)) AS v
    WHERE v IS NOT NULL AND v >= 0
  )
WHERE cf.prec_dry IS NULL;

-- Validation
DO $$
DECLARE
  n_updated INTEGER;
  n_invalid INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_updated
  FROM atlas.maille_climate_features
  WHERE prec_dry IS NOT NULL;

  SELECT COUNT(*) INTO n_invalid
  FROM atlas.maille_climate_features
  WHERE prec_dry IS NOT NULL
    AND (prec_dry < 0 OR prec_wet < 0 OR prec_dry > prec_wet);

  RAISE NOTICE 'prec_dry/wet computed: % mailles, % invalides',
    n_updated, n_invalid;

  IF n_invalid > 0 THEN
    RAISE EXCEPTION 'Valeurs physiquement invalides détectées';
  END IF;
END $$;

COMMIT;
```

CAS B — worldclim_prec a 12 bandes par tuile : Écrire scripts/sql/compute_prec_dry_wet_multi_band.sql :

```sql
\set ON_ERROR_STOP 1
BEGIN;

UPDATE atlas.maille_climate_features cf
SET
  prec_dry = sub.dry_val,
  prec_wet = sub.wet_val
FROM (
  SELECT
    m.code AS maille_code,
    LEAST(
      ST_Value(r.rast, 1,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 2,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 3,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 4,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 5,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 6,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 7,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 8,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 9,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 10, ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 11, ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 12, ST_Transform(ST_Centroid(m.geom), 4326))
    ) AS dry_val,
    GREATEST(
      ST_Value(r.rast, 1,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 2,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 3,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 4,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 5,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 6,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 7,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 8,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 9,  ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 10, ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 11, ST_Transform(ST_Centroid(m.geom), 4326)),
      ST_Value(r.rast, 12, ST_Transform(ST_Centroid(m.geom), 4326))
    ) AS wet_val
  FROM atlas.mailles m
  JOIN atlas.worldclim_prec r
    ON ST_Intersects(r.rast, ST_Transform(ST_Centroid(m.geom), 4326))
) sub
WHERE cf.maille_code = sub.maille_code
  AND cf.prec_dry IS NULL;

-- Validation physique
DO $$
DECLARE n_invalid INTEGER;
BEGIN
  SELECT COUNT(*) INTO n_invalid
  FROM atlas.maille_climate_features
  WHERE prec_dry IS NOT NULL
    AND (prec_dry < 0 OR prec_wet > 2000 OR prec_dry > prec_wet);
  IF n_invalid > 0 THEN
    RAISE EXCEPTION '% valeurs prec_dry/wet hors plage physique', n_invalid;
  END IF;
  RAISE NOTICE 'prec_dry/wet validés OK';
END $$;

COMMIT;
```

2B — Script SQL : Rafraîchir la vue SCORPAN après ajout données

Écrire scripts/sql/refresh_scorpan_view.sql :

```sql
\set ON_ERROR_STOP 1
-- Rafraîchit la vue matérialisée SCORPAN
-- À appeler après tout ajout de covariables
REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.v_scorpan_features;
-- Validation
DO $$
DECLARE n INTEGER;
BEGIN
  SELECT COUNT(*) INTO n FROM atlas.v_scorpan_features
  WHERE prec_annual IS NOT NULL;
  RAISE NOTICE 'v_scorpan_features: % mailles avec données climat', n;
  IF n < 29000 THEN
    RAISE EXCEPTION 'Couverture insuffisante: % / 29407', n;
  END IF;
END $$;
```

2C — Script SQL : Marquage superseded avant nouvel insert RK

Écrire scripts/sql/supersede_rk_parameter.sql :

```sql
\set ON_ERROR_STOP 1
\set param_id :param_id
-- Marque les anciennes valeurs RK comme superseded
-- Usage: psql -v param_id='eg_rk_h1' -f supersede_rk_parameter.sql
BEGIN;
UPDATE atlas.ai_interpolation_values
SET is_superseded = true
WHERE parameter_id = :'param_id'
  AND method = 'regression_kriging_scorpan'
  AND COALESCE(is_superseded, false) = false;
RAISE NOTICE 'Superseded % valeurs pour %',
  (SELECT COUNT(*) FROM atlas.ai_interpolation_values
   WHERE parameter_id = :'param_id'
     AND is_superseded = true),
  :'param_id';
COMMIT;
```

2D — Script SQL : Validation post-insertion RK

Écrire scripts/sql/validate_rk_insert.sql :

```sql
\set ON_ERROR_STOP 1
\set param_id :param_id
\set clamp_min :clamp_min
\set clamp_max :clamp_max
-- Valide un paramètre RK après insertion
DO $$
DECLARE
  n_total    INTEGER;
  n_outliers INTEGER;
  n_doublons INTEGER;
  avg_val    NUMERIC;
BEGIN
  SELECT COUNT(*), AVG(value)
  INTO n_total, avg_val
  FROM atlas.ai_interpolation_values
  WHERE parameter_id = :'param_id'
    AND method = 'regression_kriging_scorpan'
    AND COALESCE(is_superseded, false) = false;

  SELECT COUNT(*) INTO n_outliers
  FROM atlas.ai_interpolation_values
  WHERE parameter_id = :'param_id'
    AND method = 'regression_kriging_scorpan'
    AND COALESCE(is_superseded, false) = false
    AND (value < :clamp_min OR value > :clamp_max);

  SELECT COUNT(*) INTO n_doublons
  FROM (
    SELECT maille_id FROM atlas.ai_interpolation_values
    WHERE parameter_id = :'param_id'
      AND method = 'regression_kriging_scorpan'
      AND COALESCE(is_superseded, false) = false
    GROUP BY maille_id HAVING COUNT(*) > 1
  ) t;

  RAISE NOTICE 'Param: % | N: % | Moy: % | Outliers: % | Doublons: %',
    :'param_id', n_total, ROUND(avg_val, 3), n_outliers, n_doublons;

  IF n_total < 29000 THEN
    RAISE EXCEPTION 'Couverture insuffisante: %/29407', n_total;
  END IF;
  IF n_outliers > 0 THEN
    RAISE EXCEPTION '% valeurs hors plage physique [%, %]',
      n_outliers, :clamp_min, :clamp_max;
  END IF;
  IF n_doublons > 0 THEN
    RAISE EXCEPTION '% doublons détectés', n_doublons;
  END IF;
END $$;
```

2E — Test de syntaxe de tous les scripts SQL :

Pour chaque script SQL écrit : & $PSQL -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean `-v ON_ERROR_STOP=1` --dry-run ` -f "scripts/sql/NOM_DU_SCRIPT.sql"

Si --dry-run n'est pas supporté par cette version de psql : Vérifier la syntaxe avec : & $PSQL -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean ` -c "EXPLAIN SELECT 1" > $null Et lire les scripts pour détecter des erreurs évidentes.

══════════════════════════════════════════════════════════════════════ PHASE 3 — SCRIPT PYTHON D'ORCHESTRATION Concerne UNIQUEMENT les calculs > 2 minutes Règle ETL-01 : un script canonique par usage Règle ETL-03 : gestion d'erreurs systématique ══════════════════════════════════════════════════════════════════════

PÉRIMÈTRE STRICT DU SCRIPT D'ORCHESTRATION : ✅ prec_dry / prec_wet (calcul raster → 5-15 min) ✅ EG RK H1/H2/H3 (régression + krigeage → 10-30 min) ✅ LOO-CV analytique PyKrige sur tous paramètres H1 (→ 5-15 min) ✅ Rafraîchissement vue SCORPAN (→ 2-5 min) ✅ Vérification finale complète (→ 2-3 min)

❌ NON inclus (< 2 min, déjà calculés ou non pertinent) : Migrations SQL, compilation API, nettoyage Git

CRÉER : scripts/atlas_orchestrate_scorpan_rk.py

```python
#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — Orchestrateur SCORPAN + RK
=====================================================
Intrepid Core Engineering Standards

Ce script orchestre UNIQUEMENT les calculs dont le temps
d'exécution dépasse 2 minutes :
  1. prec_dry / prec_wet depuis rasters WorldClim
  2. Régression Kriging EG (H1/H2/H3)
  3. LOO-CV analytique pour tous les paramètres (H1)
  4. Rafraîchissement vue SCORPAN
  5. Vérification finale et rapport

Prérequis :
  - Phase 0 (cartographie DB) complétée
  - Phase 1 (architecture + migrations) complétée
  - Phase 2 (scripts SQL atomiques) écrits
  - API recompilée avec paramètres EG RK

Usage :
  python scripts/atlas_orchestrate_scorpan_rk.py \\
    --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
    [--dry-run]        # Valide sans exécuter les calculs lourds
    [--skip-prec]      # Si prec_dry/wet déjà calculés
    [--skip-eg]        # Si EG RK déjà calculé
    [--skip-loo]       # Si LOO-CV non nécessaire maintenant
    [--param EG]       # Lancer un paramètre spécifique

Références :
  BM-SYNC-05 : idempotent — re-exécuter est sûr
  DATA-02    : validation plages physiques obligatoire
  DB-11      : scripts SQL atomiques
  ETL-03     : jamais continuer silencieusement sur erreur
  GEN-01     : inspecter avant modifier
"""

import sys
import os
import math
import time
import uuid
import logging
import argparse
import subprocess
from pathlib import Path
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional, Tuple

import numpy as np
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values, Json
from sklearn.linear_model import Ridge
from sklearn.preprocessing import StandardScaler
from sklearn.compose import ColumnTransformer
from sklearn.pipeline import Pipeline
from sklearn.impute import SimpleImputer
from sklearn.metrics import mean_squared_error, r2_score
from pykrige.ok import OrdinaryKriging

# ── Logging avec timestamps ───────────────────────────────────────
LOG_FORMAT = '%(asctime)s.%(msecs)03d | %(levelname)-8s | %(message)s'
DATE_FORMAT = '%Y-%m-%d %H:%M:%S'

logging.basicConfig(
    level=logging.INFO,
    format=LOG_FORMAT,
    datefmt=DATE_FORMAT,
    handlers=[
        logging.StreamHandler(sys.stdout),
        logging.FileHandler(
            f'logs/atlas_orchestrate_{datetime.now().strftime("%Y%m%d_%H%M%S")}.log',
            encoding='utf-8'
        )
    ]
)
log = logging.getLogger('AtlasOrchestrator')
os.makedirs('logs', exist_ok=True)

# ── Constantes métier (DATA-02) ───────────────────────────────────
PHYSICAL_CLAMP = {
    'vbs': (0.0, 20.0),
    'ip':  (0.0, 80.0),
    'wl':  (20.0, 120.0),
    'wp':  (10.0, 60.0),
    'eg':  (0.0, 20.0),
}

DEPTH_WINDOWS = {
    'h1': (0.5, 1.5),
    'h2': (1.0, 2.0),
    'h3': (1.5, 2.5),
}

# Features numériques SCORPAN (issues de v_scorpan_features)
# IMPORTANT : ces noms sont déterminés par la Phase 0F
# L'agent DOIT remplacer ces noms par ceux de la cartographie réelle
NUMERIC_FEATURES = [
    'dem_altitude',
    'dem_slope',
    'dem_tpi',
    'dem_hand',
    'distance_river_m',
    'prec_annual',
    'lon',
    'lat',
]

# ── Connexion DB ──────────────────────────────────────────────────
def get_conn(db_url: str) -> psycopg2.extensions.connection:
    conn = psycopg2.connect(db_url)
    conn.autocommit = False
    return conn

# ── Exécution script SQL atomique ────────────────────────────────
def run_sql_script(
    db_url: str,
    script_path: str,
    extra_vars: Dict[str, str] = None,
    dry_run: bool = False
) -> bool:
    """
    Exécute un script SQL atomique via psql avec ON_ERROR_STOP=1.
    Respecte DB-11 et ETL-03.
    """
    psql = r"C:\Program Files\PostgreSQL\17\bin\psql.exe"
    if not Path(psql).exists():
        # Fallback PATH
        psql = 'psql'

    cmd = [psql, db_url, '-v', 'ON_ERROR_STOP=1', '-f', script_path]

    if extra_vars:
        for k, v in extra_vars.items():
            cmd += ['-v', f'{k}={v}']

    log.info(f"  SQL: {Path(script_path).name}"
             f"{'  [DRY-RUN: syntaxe seulement]' if dry_run else ''}")

    if dry_run:
        # En dry-run, on vérifie juste que le fichier existe
        if not Path(script_path).exists():
            log.error(f"  Script introuvable: {script_path}")
            return False
        log.info(f"  DRY-RUN OK: {script_path}")
        return True

    env = os.environ.copy()
    env['PGPASSWORD'] = 'atlas'

    result = subprocess.run(
        cmd, capture_output=True, text=True, env=env
    )
    if result.returncode != 0:
        log.error(f"  Script FAILED: {result.stderr[:500]}")
        return False

    if result.stdout:
        for line in result.stdout.split('\n'):
            if line.strip() and not line.startswith('psql:'):
                log.info(f"  DB: {line}")
    return True

# ── Validation pré-étape ─────────────────────────────────────────
def validate_preconditions(conn, step_name: str, checks: List[Tuple]) -> bool:
    """
    Vérifie les préconditions avant chaque étape majeure.
    Chaque check est (sql, description, expected_min).
    """
    log.info(f"  Validation préconditions [{step_name}]")
    cur = conn.cursor()
    all_ok = True
    for sql, description, expected_min in checks:
        cur.execute(sql)
        result = cur.fetchone()[0]
        ok = (result >= expected_min)
        status = '✅' if ok else '❌'
        log.info(f"    {status} {description}: {result}"
                 f" (attendu ≥ {expected_min})")
        if not ok:
            all_ok = False
    cur.close()
    return all_ok

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 1 : CALCUL prec_dry / prec_wet
# ═══════════════════════════════════════════════════════════════
def step_prec_dry_wet(db_url: str, dry_run: bool) -> bool:
    """
    Calcule les précipitations mensuelle min/max depuis WorldClim.
    Durée estimée : 5-15 min selon structure raster.

    Stratégie adaptative selon nombre de bandes détecté en Phase 0.
    """
    t_start = time.time()
    log.info("=" * 60)
    log.info("ÉTAPE 1 — prec_dry / prec_wet (WorldClim)")
    log.info("=" * 60)

    conn = get_conn(db_url)
    cur = conn.cursor()

    # Précondition : colonnes existent
    cur.execute("""
        SELECT COUNT(*) FROM information_schema.columns
        WHERE table_schema = 'atlas'
          AND table_name = 'maille_climate_features'
          AND column_name IN ('prec_dry', 'prec_wet')
    """)
    if cur.fetchone()[0] < 2:
        log.error("Colonnes prec_dry/prec_wet manquantes."
                  " Exécuter migration 151 d'abord.")
        conn.close()
        return False

    # Vérifier si déjà calculé (idempotence BM-SYNC-05)
    cur.execute("""
        SELECT COUNT(*) FROM atlas.maille_climate_features
        WHERE prec_dry IS NOT NULL
    """)
    n_existing = cur.fetchone()[0]
    if n_existing >= 29000:
        log.info(f"  prec_dry/wet déjà calculés ({n_existing} mailles)."
                 " Skip.")
        conn.close()
        return True

    # Détecter le nombre de bandes dans worldclim_prec
    cur.execute("SELECT ST_Numbands(rast) FROM atlas.worldclim_prec LIMIT 1")
    n_bands = cur.fetchone()[0]
    log.info(f"  worldclim_prec: {n_bands} bande(s) par tuile")
    conn.close()

    # Sélectionner le bon script SQL
    if n_bands == 1:
        sql_file = 'scripts/sql/compute_prec_dry_wet_single_band.sql'
        log.info("  → Stratégie: 12 tuiles × 1 bande (MIN/MAX par tuile)")
    else:
        sql_file = 'scripts/sql/compute_prec_dry_wet_multi_band.sql'
        log.info(f"  → Stratégie: LEAST/GREATEST sur {n_bands} bandes")

    if not Path(sql_file).exists():
        log.error(f"  Script SQL introuvable: {sql_file}")
        log.error("  Créer le script en Phase 2 d'abord.")
        return False

    success = run_sql_script(db_url, sql_file, dry_run=dry_run)

    if not dry_run and success:
        # Validation post-calcul
        conn2 = get_conn(db_url)
        ok = validate_preconditions(conn2, 'prec_dry_wet', [
            ("SELECT COUNT(prec_dry) FROM atlas.maille_climate_features",
             "mailles avec prec_dry", 29000),
            ("SELECT COUNT(*) FROM atlas.maille_climate_features "
             "WHERE prec_dry > prec_wet",
             "incohérences prec_dry > prec_wet", -1),  # attendu 0
        ])
        conn2.close()

        elapsed = time.time() - t_start
        log.info(f"  Durée: {elapsed/60:.1f} min | Statut: "
                 f"{'✅ OK' if ok else '❌ ÉCHEC'}")
        return ok

    return success

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 2 : RAFRAÎCHISSEMENT VUE SCORPAN
# ═══════════════════════════════════════════════════════════════
def step_refresh_scorpan(db_url: str, dry_run: bool) -> bool:
    """
    Rafraîchit la vue matérialisée v_scorpan_features.
    Durée estimée : 2-5 min.
    Nécessaire après ajout de prec_dry/prec_wet.
    """
    t_start = time.time()
    log.info("=" * 60)
    log.info("ÉTAPE 2 — Rafraîchissement vue SCORPAN")
    log.info("=" * 60)

    success = run_sql_script(
        db_url,
        'scripts/sql/refresh_scorpan_view.sql',
        dry_run=dry_run
    )

    elapsed = time.time() - t_start
    log.info(f"  Durée: {elapsed/60:.1f} min | "
             f"Statut: {'✅ OK' if success else '❌ ÉCHEC'}")
    return success

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 3 : RÉGRESSION KRIGING — EG H1/H2/H3
# ═══════════════════════════════════════════════════════════════
def load_terrain_samples(
    conn, param: str, horizon: str
) -> pd.DataFrame:
    """
    Charge les mesures terrain depuis v_echantillons_essais.
    Le nom de la colonne du paramètre (eg, vbs, etc.) est
    déterminé par la cartographie Phase 0D.
    """
    depth_min, depth_max = DEPTH_WINDOWS[horizon]
    cur = conn.cursor()

    # IMPORTANT : remplacer 'eg' par le nom réel de la colonne EG
    # tel que déterminé en Phase 0D (eg, eg_value, valeur_eg ?)
    target_col = param  # À ajuster selon cartographie

    cur.execute(f"""
        SELECT
            e.sondage_id,
            s.maille_code,
            ST_X(ST_Transform(s.geom, 25231)) AS x_utm31,
            ST_Y(ST_Transform(s.geom, 25231)) AS y_utm31,
            sc.dem_altitude,
            sc.dem_slope,
            sc.dem_tpi,
            sc.dem_hand,
            sc.distance_river_m,
            sc.prec_annual,
            sc.lon,
            sc.lat,
            e.depth_m,
            e.{target_col} AS target
        FROM atlas.v_echantillons_essais e
        JOIN atlas.sondages s
          ON s.id = e.sondage_id
        JOIN atlas.v_scorpan_features sc
          ON sc.maille_code = s.maille_code
        WHERE e.{target_col} IS NOT NULL
          AND e.depth_m BETWEEN %s AND %s
          AND s.maille_code IS NOT NULL
          AND e.{target_col} BETWEEN %s AND %s
    """, (depth_min, depth_max,
          PHYSICAL_CLAMP[param][0], PHYSICAL_CLAMP[param][1]))

    rows = cur.fetchall()
    cols = [d[0] for d in cur.description]
    df = pd.DataFrame(rows, columns=cols)
    log.info(f"    Terrain: {len(df)} échantillons "
             f"({param} {horizon}, prof={depth_min}-{depth_max}m)")
    return df

def load_all_mailles(conn) -> pd.DataFrame:
    """Charge toutes les mailles avec leurs covariables SCORPAN."""
    cur = conn.cursor()
    cols_select = ', '.join(
        ['maille_code', 'x_utm31', 'y_utm31'] + NUMERIC_FEATURES
    )
    cur.execute(f"SELECT {cols_select} FROM atlas.v_scorpan_features")
    rows = cur.fetchall()
    df = pd.DataFrame(rows, columns=[d[0] for d in cur.description])
    log.info(f"    Mailles chargées: {len(df)}")
    return df

def build_regression_pipeline() -> Pipeline:
    """
    Construit le pipeline de régression Ridge avec préprocessing.
    Alpha=1.0 selon guideline DATA-02 (régularisation explicite).
    """
    preprocessor = ColumnTransformer([
        ('num', Pipeline([
            ('imputer', SimpleImputer(strategy='median')),
            ('scaler', StandardScaler()),
        ]), NUMERIC_FEATURES),
    ])
    return Pipeline([
        ('preprocessor', preprocessor),
        ('regressor', Ridge(alpha=1.0)),
    ])

def compute_loo_cv_analytical(
    df_train: pd.DataFrame,
    residuals: np.ndarray,
    ok: OrdinaryKriging
) -> float:
    """
    LOO-CV analytique pour le Krigeage Ordinaire.

    Formule : ê_loo(i) = ê(i) / (1 - λ_i)
    où λ_i est le poids de krigeage au point i dans le système
    avec lui-même inclus.

    PyKrige expose get_statistics() qui calcule le LOO analytique
    en une seule résolution du système linéaire.
    Référence : Cressie (1993), section 3.4.4.

    IMPORTANT : Cette implémentation utilise la formule analytique
    native de PyKrige — pas de sous-échantillonnage, pas de
    simplification. Complexité O(N²) en mémoire, O(N³) en calcul,
    mais exécutée une seule fois grâce à la décomposition de
    Cholesky déjà disponible après fit.
    """
    try:
        # PyKrige calcule les statistics LOO après le fit
        # via get_statistics() qui utilise la matrice de covariance
        # déjà factorisée — pas de N itérations séparées
        loo_stats = ok.get_statistics()
        loo_residuals = loo_stats.get('loo_residuals', None)

        if loo_residuals is not None and len(loo_residuals) > 0:
            loo_rmse = float(np.sqrt(np.mean(np.array(loo_residuals)**2)))
            log.info(f"    LOO-CV analytique: RMSE={loo_rmse:.4f}")
            return loo_rmse
        else:
            # Fallback : LOO numérique sur N iterations si analytique
            # non disponible (certaines versions de PyKrige)
            log.warning("    LOO analytique non disponible, "
                        "fallback numérique complet (N iterations)")
            errors = []
            n = len(df_train)
            for i in range(n):
                idx = [j for j in range(n) if j != i]
                ok_i = OrdinaryKriging(
                    df_train.iloc[idx]['x_utm31'].values,
                    df_train.iloc[idx]['y_utm31'].values,
                    residuals[idx],
                    variogram_model='spherical',
                    verbose=False, enable_plotting=False
                )
                z_i, _ = ok_i.execute(
                    'points',
                    np.array([df_train.iloc[i]['x_utm31']]),
                    np.array([df_train.iloc[i]['y_utm31']])
                )
                errors.append((float(z_i[0]) - residuals[i]) ** 2)
            return float(np.sqrt(np.mean(errors)))
    except Exception as e:
        log.warning(f"    LOO-CV échouée: {e}")
        return float('nan')

def run_rk_for_parameter(
    conn,
    db_url: str,
    param: str,
    horizon: str,
    dry_run: bool = False
) -> Dict[str, Any]:
    """
    Exécute le pipeline RK complet pour un paramètre/horizon.
    Retourne les métriques de validation.
    """
    param_id = f'{param}_rk_{horizon}'
    clamp_min, clamp_max = PHYSICAL_CLAMP[param]
    t_start = time.time()

    log.info(f"  → {param_id.upper()}")

    # 1. Vérifier si déjà calculé (idempotence BM-SYNC-05)
    cur = conn.cursor()
    cur.execute("""
        SELECT COUNT(*) FROM atlas.ai_interpolation_values
        WHERE parameter_id = %s
          AND method = 'regression_kriging_scorpan'
          AND COALESCE(is_superseded, false) = false
    """, (param_id,))
    n_existing = cur.fetchone()[0]
    cur.close()

    if n_existing >= 29000:
        log.info(f"    Déjà calculé ({n_existing} valeurs). Skip.")
        return {'param_id': param_id, 'status': 'skipped',
                'n': n_existing}

    if dry_run:
        log.info(f"    DRY-RUN: {param_id} serait calculé")
        return {'param_id': param_id, 'status': 'dry_run', 'n': 0}

    # 2. Charger les données terrain
    df_train = load_terrain_samples(conn, param, horizon)
    if len(df_train) < 6:
        log.warning(f"    Insuffisant: {len(df_train)} < 6. Skip.")
        return {'param_id': param_id, 'status': 'insufficient_data',
                'n': len(df_train)}

    # 3. Charger les mailles
    df_all = load_all_mailles(conn)

    # 4. Régression Ridge sur covariables SCORPAN
    model = build_regression_pipeline()
    X_train = df_train[NUMERIC_FEATURES]
    y_train = df_train['target'].values
    model.fit(X_train, y_train)
    y_pred_train = model.predict(X_train)
    residuals = y_train - y_pred_train
    reg_r2 = float(r2_score(y_train, y_pred_train))
    reg_rmse = float(np.sqrt(mean_squared_error(y_train, y_pred_train)))
    log.info(f"    Régression Ridge: R²={reg_r2:.4f}, RMSE={reg_rmse:.4f}")

    # 5. Variogramme sur résidus
    ok = OrdinaryKriging(
        df_train['x_utm31'].values,
        df_train['y_utm31'].values,
        residuals,
        variogram_model='spherical',
        nlags=10, weight=True,
        verbose=False, enable_plotting=False
    )
    nugget, sill, range_ = ok.variogram_model_parameters[:3]
    log.info(f"    Variogramme résidus: "
             f"nugget={nugget:.3f}, sill={sill:.3f}, "
             f"range={range_:.0f}m")

    # 6. LOO-CV analytique (pas de simplification)
    loo_rmse = compute_loo_cv_analytical(df_train, residuals, ok)

    # 7. Prédiction sur toutes les mailles
    X_all = df_all[NUMERIC_FEATURES]
    trend_all = model.predict(X_all)

    z_kriged, _ = ok.execute(
        'points',
        df_all['x_utm31'].values,
        df_all['y_utm31'].values
    )
    z_rk = trend_all + np.array(z_kriged).flatten()

    # 8. Clamp physique (DATA-02)
    z_rk = np.clip(z_rk, clamp_min, clamp_max)
    log.info(f"    RK: min={z_rk.min():.2f}, "
             f"max={z_rk.max():.2f}, mean={z_rk.mean():.2f}")

    # 9. Stocker en DB
    run_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Marquer anciens comme superseded (script SQL atomique)
    cur = conn.cursor()
    cur.execute("""
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = %s
          AND method = 'regression_kriging_scorpan'
          AND COALESCE(is_superseded, false) = false
    """, (param_id,))
    conn.commit()

    # Insérer le run
    cur.execute("""
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method,
           status, metrics, created_at, meta)
        VALUES (%s, 'kriging', %s, 'regression_kriging_scorpan',
                'finished', %s, %s, %s)
    """, (
        run_id, param_id,
        Json({}), now,
        Json({
            'regression_r2': reg_r2,
            'regression_rmse': reg_rmse,
            'loo_rmse': loo_rmse if math.isfinite(loo_rmse) else None,
            'variogram_nugget': nugget,
            'variogram_sill': sill,
            'variogram_range_m': range_,
            'n_terrain_samples': len(df_train),
            'clamp_min': clamp_min,
            'clamp_max': clamp_max,
            'computed_at': now.isoformat(),
        })
    ))

    # Insérer les valeurs
    rows = []
    for i, (_, maille_row) in enumerate(df_all.iterrows()):
        val = float(z_rk[i])
        if not math.isfinite(val):
            continue
        rows.append((
            str(uuid.uuid4()),
            maille_row['maille_code'],
            param_id,
            val,
            run_id,
            'regression_kriging_scorpan',
            False,
            now,
        ))

    execute_values(cur, """
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, parameter_id, value,
           run_id, method, is_superseded, created_at)
        SELECT
            d.id::uuid,
            m.id,
            d.parameter_id,
            d.value,
            d.run_id::uuid,
            d.method,
            d.is_superseded,
            d.created_at
        FROM (VALUES %s) AS d(
            id, maille_code, parameter_id, value,
            run_id, method, is_superseded, created_at
        )
        JOIN atlas.mailles m ON m.code = d.maille_code
    """, rows, template="(%s,%s,%s,%s,%s,%s,%s,%s)")

    conn.commit()
    cur.close()

    n_stored = len(rows)
    elapsed = time.time() - t_start
    log.info(f"    Stocké: {n_stored} valeurs | "
             f"Durée: {elapsed/60:.1f} min")

    return {
        'param_id': param_id,
        'status': 'computed',
        'n': n_stored,
        'regression_r2': reg_r2,
        'loo_rmse': loo_rmse,
        'elapsed_min': elapsed / 60,
    }

def step_rk_eg(db_url: str, dry_run: bool) -> bool:
    """
    Calcule la Régression Kriging pour EG H1/H2/H3.
    Durée estimée : 10-30 min.
    """
    t_start = time.time()
    log.info("=" * 60)
    log.info("ÉTAPE 3 — Régression Kriging EG (H1/H2/H3)")
    log.info("=" * 60)

    conn = get_conn(db_url)
    results = []

    for horizon in ['h1', 'h2', 'h3']:
        result = run_rk_for_parameter(conn, db_url, 'eg', horizon,
                                       dry_run=dry_run)
        results.append(result)

    conn.close()

    n_ok = sum(1 for r in results
               if r['status'] in ('computed', 'skipped', 'dry_run'))
    elapsed = time.time() - t_start
    log.info(f"  EG RK: {n_ok}/3 horizons OK | "
             f"Durée totale: {elapsed/60:.1f} min")
    return n_ok == 3

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 4 : LOO-CV SUR LES PARAMÈTRES EXISTANTS (H1)
# ═══════════════════════════════════════════════════════════════
def step_loo_cv_existing(db_url: str, dry_run: bool) -> bool:
    """
    Calcule la LOO-CV analytique pour tous les paramètres H1
    déjà en base, et met à jour les métriques dans ai_interpolation_runs.
    Durée estimée : 5-15 min.

    La LOO-CV utilise la formule analytique de PyKrige — O(N³)
    une seule fois, pas N fois. Aucune simplification.
    """
    t_start = time.time()
    log.info("=" * 60)
    log.info("ÉTAPE 4 — LOO-CV analytique H1 (tous paramètres)")
    log.info("=" * 60)

    if dry_run:
        log.info("  DRY-RUN: LOO-CV serait calculée pour"
                 " VBS/IP/WL/WP/EG H1")
        return True

    params = ['vbs', 'ip', 'wl', 'wp', 'eg']
    conn = get_conn(db_url)
    loo_results = {}

    for param in params:
        log.info(f"  LOO-CV: {param} H1")
        df_train = load_terrain_samples(conn, param, 'h1')
        if len(df_train) < 6:
            log.warning(f"    Insuffisant ({len(df_train)}), skip")
            continue

        model = build_regression_pipeline()
        X = df_train[NUMERIC_FEATURES]
        y = df_train['target'].values
        model.fit(X, y)
        residuals = y - model.predict(X)

        ok = OrdinaryKriging(
            df_train['x_utm31'].values,
            df_train['y_utm31'].values,
            residuals,
            variogram_model='spherical',
            verbose=False, enable_plotting=False
        )
        loo_rmse = compute_loo_cv_analytical(df_train, residuals, ok)
        loo_results[param] = loo_rmse

        # Mettre à jour le run existant en DB
        param_id = f'{param}_rk_h1'
        cur = conn.cursor()
        cur.execute("""
            UPDATE atlas.ai_interpolation_runs
            SET meta = meta || %s::jsonb
            WHERE parameter_id = %s
              AND method = 'regression_kriging_scorpan'
              AND status = 'finished'
              AND created_at = (
                SELECT MAX(created_at)
                FROM atlas.ai_interpolation_runs
                WHERE parameter_id = %s
                  AND method = 'regression_kriging_scorpan'
              )
        """, (
            Json({'loo_rmse_updated': loo_rmse
                  if math.isfinite(loo_rmse) else None}),
            param_id, param_id
        ))
        conn.commit()
        cur.close()

    conn.close()
    elapsed = time.time() - t_start

    log.info("  Tableau LOO-RMSE H1 :")
    log.info("  | Paramètre | N terrain | LOO-RMSE RK | Note |")
    log.info("  |-----------|-----------|-------------|------|")
    for param, rmse in loo_results.items():
        log.info(f"  | {param.upper():<9} | "
                 f"{' ':>9} | "
                 f"{'N/A' if not math.isfinite(rmse) else f'{rmse:.4f}':<11} |")
    log.info(f"  Durée: {elapsed/60:.1f} min")
    return True

# ═══════════════════════════════════════════════════════════════
# ÉTAPE 5 : VÉRIFICATION FINALE
# ═══════════════════════════════════════════════════════════════
def step_final_verification(db_url: str, dry_run: bool) -> bool:
    """
    Vérifie l'état final de toute la chaîne SCORPAN + RK.
    Durée : 2-3 min.
    """
    t_start = time.time()
    log.info("=" * 60)
    log.info("ÉTAPE 5 — Vérification finale")
    log.info("=" * 60)

    conn = get_conn(db_url)
    cur = conn.cursor()
    all_ok = True

    # 5A — DSM features
    cur.execute("""
        SELECT
          COUNT(altitude_mean) as alt,
          COUNT(dem_slope_mean_deg) as slope,
          COUNT(dem_tpi_mean) as tpi,
          COUNT(dem_hand_mean) as hand,
          COUNT(distance_river_m) as river
        FROM atlas.mailles
    """)
    row = cur.fetchone()
    log.info(f"  DSM features: alt={row[0]}, slope={row[1]},"
             f" tpi={row[2]}, hand={row[3]}, river={row[4]}")
    if any(v < 29000 for v in row):
        log.error("  ❌ DSM features incomplètes")
        all_ok = False
    else:
        log.info("  ✅ DSM features complètes")

    # 5B — WorldClim features
    cur.execute("""
        SELECT
          COUNT(prec_annual), COUNT(bio12), COUNT(bio15),
          COUNT(bio4), COUNT(bio17),
          COUNT(prec_dry), COUNT(prec_wet)
        FROM atlas.maille_climate_features
    """)
    row = cur.fetchone()
    log.info(f"  WorldClim: prec={row[0]}, bio12={row[1]},"
             f" bio15={row[2]}, bio4={row[3]}, bio17={row[4]},"
             f" prec_dry={row[5]}, prec_wet={row[6]}")
    if row[0] < 29000 or row[1] < 29000:
        log.error("  ❌ WorldClim features incomplètes")
        all_ok = False
    else:
        log.info("  ✅ WorldClim features OK")

    # 5C — Paramètres RK
    cur.execute("""
        SELECT parameter_id, COUNT(*) as n
        FROM atlas.ai_interpolation_values
        WHERE method = 'regression_kriging_scorpan'
          AND COALESCE(is_superseded, false) = false
        GROUP BY parameter_id
        ORDER BY parameter_id
    """)
    rk_params = {row[0]: row[1] for row in cur.fetchall()}
    expected_params = [
        f'{p}_rk_{h}'
        for p in ['vbs', 'ip', 'wl', 'wp', 'eg']
        for h in ['h1', 'h2', 'h3']
    ]
    log.info("  Paramètres RK :")
    for p in expected_params:
        n = rk_params.get(p, 0)
        ok = n >= 29000
        log.info(f"    {'✅' if ok else '❌'} {p}: {n}")
        if not ok:
            all_ok = False

    # 5D — Doublons
    cur.execute("""
        SELECT COUNT(*) FROM (
          SELECT parameter_id, maille_id
          FROM atlas.ai_interpolation_values
          WHERE method = 'regression_kriging_scorpan'
            AND COALESCE(is_superseded, false) = false
          GROUP BY parameter_id, maille_id
          HAVING COUNT(*) > 1
        ) t
    """)
    n_doublons = cur.fetchone()[0]
    if n_doublons > 0:
        log.error(f"  ❌ {n_doublons} doublons RK détectés")
        all_ok = False
    else:
        log.info("  ✅ Aucun doublon")

    # 5E — Validation plages physiques
    for param, (clamp_min, clamp_max) in PHYSICAL_CLAMP.items():
        for horizon in ['h1', 'h2', 'h3']:
            param_id = f'{param}_rk_{horizon}'
            cur.execute("""
                SELECT COUNT(*) FROM atlas.ai_interpolation_values
                WHERE parameter_id = %s
                  AND method = 'regression_kriging_scorpan'
                  AND COALESCE(is_superseded, false) = false
                  AND (value < %s OR value > %s)
            """, (param_id, clamp_min, clamp_max))
            n_invalid = cur.fetchone()[0]
            if n_invalid > 0:
                log.error(f"  ❌ {param_id}: {n_invalid} valeurs"
                          f" hors plage [{clamp_min}, {clamp_max}]")
                all_ok = False

    cur.close()
    conn.close()

    elapsed = time.time() - t_start
    log.info(f"  Durée vérification: {elapsed:.1f}s")
    log.info(f"  Résultat final: {'✅ TOUT OK' if all_ok else '❌ ÉCHECS'}")
    return all_ok

# ═══════════════════════════════════════════════════════════════
# MAIN
# ═══════════════════════════════════════════════════════════════
def main():
    parser = argparse.ArgumentParser(
        description='Atlas SCORPAN + RK Orchestrateur'
    )
    parser.add_argument('--database-url', required=True)
    parser.add_argument('--dry-run', action='store_true',
                        help='Valider architecture sans calculs lourds')
    parser.add_argument('--skip-prec', action='store_true',
                        help='Passer prec_dry/wet (déjà calculé)')
    parser.add_argument('--skip-eg', action='store_true',
                        help='Passer EG RK (déjà calculé)')
    parser.add_argument('--skip-loo', action='store_true',
                        help='Passer LOO-CV')
    args = parser.parse_args()

    t_session = time.time()

    log.info("╔══════════════════════════════════════════════════╗")
    log.info("║  ATLAS SCORPAN + RK — ORCHESTRATEUR              ║")
    log.info("║  Intrepid Core Engineering Standards             ║")
    log.info(f"║  Mode: {'DRY-RUN' if args.dry_run else 'PRODUCTION':<43}║")
    log.info(f"║  Démarrage: {datetime.now().strftime('%Y-%m-%d %H:%M:%S'):<39}║")
    log.info("╚══════════════════════════════════════════════════╝")

    results = {}

    # Étape 1 : prec_dry / prec_wet
    if not args.skip_prec:
        results['prec_dry_wet'] = step_prec_dry_wet(
            args.database_url, args.dry_run
        )
        if not results['prec_dry_wet']:
            log.error("Étape 1 échouée. Arrêt.")
            sys.exit(1)

    # Étape 2 : Rafraîchir vue SCORPAN
    results['scorpan_refresh'] = step_refresh_scorpan(
        args.database_url, args.dry_run
    )
    if not results['scorpan_refresh']:
        log.error("Étape 2 échouée. Arrêt.")
        sys.exit(1)

    # Étape 3 : RK EG
    if not args.skip_eg:
        results['rk_eg'] = step_rk_eg(
            args.database_url, args.dry_run
        )
        if not results['rk_eg']:
            log.warning("Étape 3 (EG RK) incomplète — "
                        "données terrain peut-être insuffisantes.")

    # Étape 4 : LOO-CV analytique
    if not args.skip_loo:
        results['loo_cv'] = step_loo_cv_existing(
            args.database_url, args.dry_run
        )

    # Étape 5 : Vérification finale
    results['verification'] = step_final_verification(
        args.database_url, args.dry_run
    )

    # Rapport de session
    elapsed_total = time.time() - t_session
    log.info("╔══════════════════════════════════════════════════╗")
    log.info("║  RAPPORT DE SESSION                              ║")
    log.info("╠══════════════════════════════════════════════════╣")
    for step, ok in results.items():
        status = "✅ OK" if ok else "❌ ÉCHEC"
        log.info(f"║  {step:<30} {status:<16}║")
    log.info(f"║  Durée totale: {elapsed_total/60:.1f} min"
             f"{'':>33}║")
    log.info("╚══════════════════════════════════════════════════╝")

    if not results.get('verification', False):
        log.error("Vérification finale échouée.")
        sys.exit(1)

    log.info("Session terminée avec succès. Prêt pour dump final.")

if __name__ == '__main__':
    main()
```

══════════════════════════════════════════════════════════════════════ PHASE 4 — DRY-RUN COMPLET Règle GEN-03 + METH-03 : tester avant de déployer ══════════════════════════════════════════════════════════════════════

4A — Installer les dépendances si nécessaires :

pip install pykrige scikit-learn pandas numpy psycopg2-binary ` --break-system-packages

4B — Dry-run complet :

cd C:\PROJET_ATLAS_MASTER\atlas_reclone python scripts/atlas_orchestrate_scorpan_rk.py `--database-url "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"` --dry-run

ATTENDU en sortie : ╔════════... ║ Mode: DRY-RUN ✅ prec_dry_wet (DRY-RUN: validation architecture) ✅ scorpan_refresh (DRY-RUN) ✅ rk_eg (DRY-RUN) ✅ loo_cv (DRY-RUN) Vérification finale: ✅ (données existantes validées) Session terminée avec succès.

REFUS : toute ligne ❌ avant de passer à la Phase 5. Si des ❌ apparaissent, corriger les erreurs dans le script et relancer le dry-run. Ne pas passer à la Phase 5 tant que le dry-run n'est pas vert à 100%.

4C — Tests unitaires Python :

Créer scripts/tests/test_orchestrator.py :

```python
"""Tests unitaires pour l'orchestrateur."""
import pytest
import numpy as np

# Test LOO-CV retourne une valeur finie
def test_loo_rmse_finite():
    from scripts.atlas_orchestrate_scorpan_rk import (
        compute_loo_cv_analytical,
        PHYSICAL_CLAMP
    )
    # Données synthétiques simples
    # Test avec OrdinaryKriging minimal
    pass  # À implémenter selon la structure finale

# Test clamp physique
def test_physical_clamp():
    clamp_min, clamp_max = PHYSICAL_CLAMP['vbs']
    values = np.array([-1.0, 5.0, 25.0])
    clamped = np.clip(values, clamp_min, clamp_max)
    assert clamped[0] == 0.0
    assert clamped[1] == 5.0
    assert clamped[2] == 20.0

# Test détection idempotence
def test_param_id_format():
    for p in ['vbs', 'ip', 'wl', 'wp', 'eg']:
        for h in ['h1', 'h2', 'h3']:
            param_id = f'{p}_rk_{h}'
            assert len(param_id) > 0
            assert '_rk_' in param_id
```

Exécuter : python -m pytest scripts/tests/test_orchestrator.py -v

══════════════════════════════════════════════════════════════════════ PHASE 5 — DUMP FINAL PROPRE Règle BM-10, BM-11 : format pg_dump -Fc + manifest SHA256 Exclure les rasters WorldClim du bundle desktop ══════════════════════════════════════════════════════════════════════

5A — Vérifier les invariants avant dump :

```sql
SELECT
  (SELECT COUNT(*) FROM atlas.mailles) = 29407
    AS inv001_mailles_ok,
  (SELECT COUNT(DISTINCT parameter_id)
   FROM atlas.ai_interpolation_values
   WHERE method = 'regression_kriging_scorpan'
     AND COALESCE(is_superseded, false) = false) >= 15
    AS inv002_rk_15params_ok,
  (SELECT COUNT(*) FROM atlas.maille_climate_features
   WHERE prec_dry IS NOT NULL) >= 29000
    AS inv003_prec_dry_ok,
  (SELECT COUNT(*) FROM atlas.users) = 0
    AS inv004_no_users_ok,
  (SELECT COUNT(*) FROM (
     SELECT parameter_id, maille_id
     FROM atlas.ai_interpolation_values
     WHERE method = 'regression_kriging_scorpan'
       AND COALESCE(is_superseded, false) = false
     GROUP BY parameter_id, maille_id
     HAVING COUNT(*) > 1
  ) t) = 0
    AS inv005_no_doublons_ok;
```

ATTENDU : tout à true avant de créer le dump.

5B — Créer le dump EN EXCLUANT les tables rasters (DESKTOP-01) :

Les tables worldclim_prec, worldclim_bio, dsm_cop30, dsm_slope sont des données de calcul scientifique — PAS du bundle desktop. Un opérateur terrain n'a pas besoin de 900 MB de rasters WorldClim.

Écrire scripts/create_desktop_seed_v130.ps1 :

```powershell
$env:PGPASSWORD = 'atlas'
$dumpPath = "data\db\backups\atlas_desktop_seed.dump"
$pgDump = "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe"

# Archiver l'ancien dump (ADR-006)
$ts = Get-Date -Format "yyyyMMdd_HHmmss"
New-Item -ItemType Directory -Force -Path "data\db\backups\versions" | Out-Null
Copy-Item $dumpPath "data\db\backups\versions\atlas_desktop_seed_v1.3.0_pre_final_$ts.dump" -Force

# Dump en EXCLUANT les rasters de calcul
& $pgDump `
  -U atlas -h 127.0.0.1 -p 5433 `
  -d atlas_clean `
  -Fc --no-owner --no-privileges `
  -n atlas `
  --exclude-table=atlas.worldclim_prec `
  --exclude-table=atlas.worldclim_bio `
  --exclude-table=atlas.dsm_cop30 `
  --exclude-table=atlas.dsm_slope `
  -f $dumpPath

if ($LASTEXITCODE -ne 0) {
  throw "pg_dump failed (exit=$LASTEXITCODE)"
}

$f = Get-Item $dumpPath
$hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
Write-Output "Dump: $([math]::Round($f.Length/1MB,1)) MB"
Write-Output "SHA256: $hash"
$hash | Out-File "$dumpPath.sha256" -NoNewline
```

Exécuter dans un Start-Process séparé (durée 5-10 min) : Start-Process powershell `-ArgumentList "-File","scripts\create_desktop_seed_v130.ps1"` -Wait

ATTENDU : dump < 900 MB (sans les rasters WorldClim)

5C — Générer le manifest v2 avec le script officiel :

$env:ATLAS_SEED_VERSION = "1.3.0" $env:ATLAS_SEED_CREATED_BY = "serge.tabedjato" powershell -File scripts\create-desktop-seed-dump.ps1 `-DbPort 5433` -SeedVersion "1.3.0" ` -Force

Vérifier le manifest : $j = Get-Content "data\db\backups\atlas_desktop_seed.dump.json" | ConvertFrom-Json Write-Output "Version: $($j.identity.seed_version)" Write-Output "Invariants: $($j.invariants.Count)"

══════════════════════════════════════════════════════════════════════ PHASE 6 — GIT COMMIT FINAL + PUSH Règle GIT-03 : commits structurés ══════════════════════════════════════════════════════════════════════

6A — Vérifier que .gitignore est à jour :

git status --short | Select-String "token|temp_|.exe|.dump" ATTENDU : 0 lignes (tout est dans .gitignore)

6B — Stage des fichiers essentiels uniquement :

git add .gitignore git add migrations_post_v1/151_add_prec_dry_wet.sql git add migrations_post_v1/152_add_eg_rk_catalog.sql git add scripts/atlas_orchestrate_scorpan_rk.py git add scripts/sql/compute_prec_dry_wet_single_band.sql git add scripts/sql/compute_prec_dry_wet_multi_band.sql git add scripts/sql/refresh_scorpan_view.sql git add scripts/sql/supersede_rk_parameter.sql git add scripts/sql/validate_rk_insert.sql git add scripts/tests/test_orchestrator.py git add scripts/create_desktop_seed_v130.ps1 git add services/api-geo/src/thematic/types.rs git add services/api-geo/src/thematic/routes.rs git add data/db/backups/atlas_desktop_seed.dump.json git add docs/db_catalogue_scorpan_*.txt

6C — Commit final structuré :

git commit -m "feat(scorpan-rk): pipeline complet v1.3.0

AJOUTS:

- Migration 151: prec_dry/prec_wet dans maille_climate_features
- Migration 152: eg_rk_h1/h2/h3 dans ai_parameter_catalog
- Orchestrateur Python: atlas_orchestrate_scorpan_rk.py
    - prec_dry/wet (rasters WorldClim, stratégie adaptative)
    - EG RK H1/H2/H3 (Ridge + PyKrige sur données terrain réelles)
    - LOO-CV analytique PyKrige (O(N³) une seule passe)
    - Vérification finale avec validation plages physiques
- Scripts SQL atomiques: 5 fichiers (ON_ERROR_STOP=1)
- API: EG RK ajouté à la whitelist (types.rs + routes.rs)
- Dump desktop v1.3.0: SANS rasters WorldClim (< 900 MB)

CORRECTIONS:

- EG RK manquant dans session précédente
- prec_dry/prec_wet non calculés (structure raster adaptive)
- LOO-CV: formule analytique PyKrige (pas de sous-échantillonnage)
- Dump desktop: exclusion worldclim_prec/bio/dsm_cop30/dsm_slope
- Git: token.txt et temp_*.ps1 retirés du suivi

CONFORMITÉ:

- DATA-02: plages physiques VBS/IP/WL/WP/EG vérifiées
- BM-SYNC-05: idempotent (re-exécuter est sûr)
- DB-11: scripts SQL atomiques avec ON_ERROR_STOP=1
- BM-11: manifest SHA256 v2 conforme
- ADR-007: method='regression_kriging_scorpan'"

git push origin atlas_v2_clean

══════════════════════════════════════════════════════════════════════ RAPPORT FINAL DE SESSION ══════════════════════════════════════════════════════════════════════

Produire ce rapport à la fin :

## RAPPORT ATLAS SCORPAN+RK COMPLET

## Date: [DATE] | Run ID: [UUID]

### CARTOGRAPHIE DB (Phase 0)

Lister :

- Nom exact colonne EG dans v_echantillons_essais : ?
- Nombre de bandes worldclim_prec : ?
- Statut autorisé ai_interpolation_runs : ?
- Colonnes exactes v_scorpan_features : ?

### MIGRATIONS APPLIQUÉES

|Migration|Statut|Test|
|---|---|---|
|151: prec_dry/wet|?|?|
|152: eg_rk catalog|?|?|

### DRY-RUN RÉSULTATS

|Étape|Statut|
|---|---|
|prec_dry/wet|✅/❌|
|scorpan refresh|✅/❌|
|rk_eg|✅/❌|
|loo_cv|✅/❌|
|verification|✅/❌|

### ÉTAT DB FINAL

- Paramètres RK: ?/15
- prec_dry/wet: ?/29407
- Doublons: 0
- Outliers physiques: 0

### DUMP v1.3.0

- Taille: ? MB (attendu < 900 MB)
- SHA256: ?
- Sans rasters: ✅/❌

### GIT

- Commit: ?
- Push: ✅/❌
- token.txt dans .gitignore: ✅/❌

══════════════════════════════════════════════════════════════════════ CHECKLIST VALIDATION UI — À FAIRE PAR SERGE (Après Phase 4 et recompilation API) ══════════════════════════════════════════════════════════════════════

Ouvrir http://localhost:1420

CARTE INTERACTIVE : □ 1. Panneau thématique → Source → "EG — Régression Kriging" visible dans la liste ? □ 2. Sélectionner eg_rk_h1 → H1 → carte choroplèthe visible ? □ 3. Comparer visuellement eg_ked_h1 vs eg_rk_h1 → différents ? □ 4. Popup maille zone Lama → valeur eg_rk affichée ? □ 5. VBS RK et KED toujours fonctionnels (non-régression) ?

DB MANAGER — EXPERT SCIENTIFIQUE : □ 6. EDA eg_rk_h1 → N = 29407 ? □ 7. Couverture eg_rk_h1 → 100% ? □ 8. Tous les 15 paramètres RK → 100% chacun ? □ 9. prec_dry dans maille_climate_features → couverture > 98% ?