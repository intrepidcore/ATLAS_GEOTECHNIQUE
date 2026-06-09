══════════════════════════════════════════════════════════════════
ATLAS GÉOTECHNIQUE — ROADMAP SCORPAN + RÉGRESSION KRIGING
Intrepid Core Engineering Standards
Session : Enrichissement covariables + RK pipeline
══════════════════════════════════════════════════════════════════

VISION INTREPID CORE :
  "Innover localement, impacter globalement."
  Chaque ligne de code produite doit être :
  - Traçable  : versionnée Git, auditée, reproductible
  - Fiable    : testée, validée par SQL direct ou curl
  - Durable   : maintenable sans l'auteur, auto-améliorante
                sur import de nouvelles données
  Platform-grade. Jamais prototype-grade.

CONTEXTE SCIENTIFIQUE :
  Le pipeline actuel (KED seul) n'exploite pas les covariables
  géologie/pédologie/climat déjà présentes en base.
  Cette session complète le cadre SCORPAN pour la Régression
  Kriging (RK) : première cartographie géotechnique nationale
  du Togo avec fusion topographie + géologie + pédologie + climat.

  Hiérarchie des méthodes (ne pas déroger) :
    L1 : KED (déjà implémenté, 100% couverture)
    L2 : Régression Kriging SCORPAN (cette session)
    L3 : ML CatBoost (session future, N>200 sondages)

ÉTAT ACQUIS — NE PAS RÉEXÉCUTER :
  ✅ KED complet : 21 paramètres × 3 horizons × 29 407 mailles
  ✅ geol_label  : 29 161/29 407 (99%) dans ai_context_features_maille
  ✅ pedo_label  : 28 724/29 407 (98%) dans ai_context_features_maille
  ✅ hydro_label : 29 175/29 407 (99%) dans ai_context_features_maille
  ✅ dsm_cop30   : 2 926 tuiles raster en base PostGIS
  ✅ DSM features : schéma présent, données NULL (à calculer)
  ✅ WorldClim   : fichiers .tif téléchargés (prec 2.5m + bio 2.5m)
  ✅ Smoke tests : 8/9 validés
  ✅ Manifest    : seed dump v1.2.1 conforme contrat v2

RÈGLES D'EXÉCUTION INTREPID CORE :
  1. Bash > Glob pour accès fichiers Windows
  2. PowerShell : jamais head/grep/tail → Select-String, Select-Object
  3. Commandes longues → Start-Process PowerShell détaché
  4. Chaque étape = preuve SQL directe ou curl AVANT de clôturer
  5. Seed Dump v2 : archiver l'ancien AVANT d'écraser le nouveau
  6. Git commit à chaque étape majeure complète (pas à la fin)
  7. Jamais déclarer une tâche terminée sans métrique mesurable

ADR (Architecture Decision Records) à respecter :
  ADR-001 : ip_derived = wl_ked - wp_ked (pas ip_ked direct)
  ADR-002 : derived_avg_from_ked pour les cartes _avg
  ADR-003 : Clamp des valeurs à la sortie API (pas en DB)
  ADR-004 : Sous-requête directe sur ai_interpolation_values
            (pas la vue lente v_latest_ai_interpolation)
  ADR-005 : .initialization_script() pour window.__ATLAS_CONFIG__
  ADR-006 : seed_dump archivé avant tout remplacement
  ADR-007 [NOUVEAU] : RK stockée dans ai_interpolation_values
            avec method='regression_kriging_scorpan'
            parameter_id format : 'vbs_rk_h1', 'eg_rk_h2'...

CONTEXTE :
  Repo  : C:\PROJET_ATLAS_MASTER\atlas_reclone
  DB    : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
  API   : http://127.0.0.1:8000
  PSQL  : "C:\Program Files\PostgreSQL\17\bin\psql.exe"
  PGPASS: atlas
  WorldClim : [DEMANDER À SERGE LE CHEMIN EXACT DES FICHIERS .tif
               avant de commencer l'étape 2]

══════════════════════════════════════════════════════════════════
ÉTAPE 0 — ÉTAT DES LIEUX (10 min)
══════════════════════════════════════════════════════════════════

0A — Token frais :
  Écrire temp_token.ps1 :
```powershell
  $body = @{email='admin@atlas.local';password='Atlas2024!'} |
    ConvertTo-Json
  $r = Invoke-RestMethod http://127.0.0.1:8000/api/auth/login `
    -Method POST -ContentType 'application/json' -Body $body
  $r.access_token | Out-File token.tmp -NoNewline
  Write-Output "Token OK: $($r.access_token.Substring(0,20))..."
```
  powershell -File temp_token.ps1
  $TOKEN = Get-Content token.tmp

0B — Sanity DB complète :
  Écrire temp_sanity0.ps1 :
```powershell
  $env:PGPASSWORD = 'atlas'
  $psql = "C:\Program Files\PostgreSQL\17\bin\psql.exe"
  & $psql -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean -c "
  SELECT
    (SELECT COUNT(*) FROM atlas.mailles) AS mailles,
    (SELECT COUNT(*) FROM atlas.ai_context_features_maille
     WHERE geol_label IS NOT NULL) AS geol_ok,
    (SELECT COUNT(*) FROM atlas.ai_context_features_maille
     WHERE pedo_label IS NOT NULL) AS pedo_ok,
    (SELECT COUNT(*) FROM atlas.ai_context_features_maille
     WHERE dem_slope_mean_deg IS NOT NULL) AS dsm_features_ok,
    (SELECT COUNT(*) FROM atlas.dsm_cop30) AS dsm_tiles,
    (SELECT COUNT(*) FROM atlas.ai_interpolation_values
     WHERE method = 'regression_kriging_scorpan'
       AND COALESCE(is_superseded,false) = false) AS rk_values_existing;"
```
  ATTENDU :
    mailles=29407, geol_ok≥29000, pedo_ok≥28000,
    dsm_features_ok=0 (à calculer), dsm_tiles≥2900,
    rk_values_existing=0 (pipeline à créer)

0C — Localiser les fichiers WorldClim :
  Demander à Serge le chemin exact des fichiers téléchargés.
  Exemple attendu : C:\DATA\worldclim\prec\ et C:\DATA\worldclim\bio\
  Vérifier qu'ils existent :
```powershell
  Get-ChildItem "C:\DATA\worldclim\prec\" -Filter "*.tif" |
    Measure-Object | Select-Object Count
  Get-ChildItem "C:\DATA\worldclim\bio\" -Filter "*.tif" |
    Measure-Object | Select-Object Count
```
  ATTENDU : 12 fichiers prec, 19 fichiers bio

0D — Git status initial :
  cd C:\PROJET_ATLAS_MASTER\atlas_reclone
  git status
  git log --oneline -3
  NOTER le dernier commit hash.

══════════════════════════════════════════════════════════════════
ÉTAPE 1 — CALCUL DES FEATURES DSM (Populate NULL → valeurs réelles)
Source : dsm_cop30 (2926 tuiles en base)
══════════════════════════════════════════════════════════════════

CONTEXTE :
  ai_context_features_maille contient les colonnes
  dem_slope_mean_deg, dem_tpi_mean, dem_curvature_mean,
  dem_flow_acc_mean, dem_hand_mean → toutes à NULL.
  Le raster dsm_cop30 est en base. Il faut calculer les
  dérivés topographiques par maille via PostGIS.

1A — Vérifier la structure du raster DSM :
```sql
  SELECT rid, ST_MetaData(rast) FROM atlas.dsm_cop30 LIMIT 1;
  SELECT ST_SRID(rast) FROM atlas.dsm_cop30 LIMIT 1;
```
  NOTER : SRID, résolution en degrés, coverage.

1B — Calculer altitude_mean par maille :
  Cette requête extrait l'altitude moyenne du DSM dans
  l'emprise de chaque maille. Exécuter en batch par
  tranches de 5000 mailles pour éviter timeout.

  Écrire scripts/compute_dsm_features_pg.sql :
```sql
  -- Altitude moyenne par maille (via ST_SummaryStats + ST_Clip)
  UPDATE atlas.ai_context_features_maille f
  SET altitude_mean = sub.alt
  FROM (
    SELECT
      m.code AS maille_code,
      AVG((ST_SummaryStats(
        ST_Clip(d.rast, 1, m.geom, true)
      )).mean) AS alt
    FROM atlas.mailles m
    JOIN atlas.dsm_cop30 d
      ON ST_Intersects(d.rast, m.geom)
    GROUP BY m.code
  ) sub
  WHERE f.maille_code = sub.maille_code
    AND f.altitude_mean IS NULL;
```
  IMPORTANT : Si la colonne altitude_mean n'existe pas encore,
  l'ajouter :
```sql
  ALTER TABLE atlas.ai_context_features_maille
    ADD COLUMN IF NOT EXISTS altitude_mean DOUBLE PRECISION;
```

1C — Calculer slope par maille via ST_Slope :
```sql
  -- Pente moyenne en degrés
  UPDATE atlas.ai_context_features_maille f
  SET dem_slope_mean_deg = sub.slope
  FROM (
    SELECT
      m.code AS maille_code,
      AVG((ST_SummaryStats(
        ST_Slope(ST_Clip(d.rast, 1, m.geom, true), 1, '32BF', 'DEGREES')
      )).mean) AS slope
    FROM atlas.mailles m
    JOIN atlas.dsm_cop30 d
      ON ST_Intersects(d.rast, m.geom)
    GROUP BY m.code
  ) sub
  WHERE f.maille_code = sub.maille_code
    AND f.dem_slope_mean_deg IS NULL;
```

1D — Calculer TPI (Topographic Position Index) :
  Le TPI n'est pas une fonction native PostGIS.
  Utiliser un proxy : différence entre l'altitude de la maille
  et la moyenne des mailles voisines (anneau de 3 mailles).
```sql
  -- TPI = altitude_maille - moyenne_voisins (approximation)
  UPDATE atlas.ai_context_features_maille f
  SET dem_tpi_mean = f.altitude_mean - voisins.alt_moy
  FROM (
    SELECT f2.maille_code,
      AVG(f3.altitude_mean) AS alt_moy
    FROM atlas.ai_context_features_maille f2
    JOIN atlas.ai_context_features_maille f3
      ON f2.maille_code != f3.maille_code
    JOIN atlas.mailles m2 ON m2.code = f2.maille_code
    JOIN atlas.mailles m3 ON m3.code = f3.maille_code
    WHERE ST_DWithin(m2.geom, m3.geom, 6000) -- 3 mailles voisines
      AND f3.altitude_mean IS NOT NULL
    GROUP BY f2.maille_code
  ) voisins
  WHERE f.maille_code = voisins.maille_code
    AND f.altitude_mean IS NOT NULL;
```

1E — Calculer HAND (Height Above Nearest Drainage) :
  HAND = altitude_maille - altitude minimale dans un rayon de 10km
  (proxy du niveau de la nappe/drainage le plus proche).
```sql
  UPDATE atlas.ai_context_features_maille f
  SET dem_hand_mean = f.altitude_mean - drain.alt_min
  FROM (
    SELECT f2.maille_code,
      MIN(f3.altitude_mean) AS alt_min
    FROM atlas.ai_context_features_maille f2
    JOIN atlas.ai_context_features_maille f3
      ON f2.maille_code != f3.maille_code
    JOIN atlas.mailles m2 ON m2.code = f2.maille_code
    JOIN atlas.mailles m3 ON m3.code = f3.maille_code
    WHERE ST_DWithin(m2.geom, m3.geom, 10000)
      AND f3.altitude_mean IS NOT NULL
    GROUP BY f2.maille_code
  ) drain
  WHERE f.maille_code = drain.maille_code
    AND f.altitude_mean IS NOT NULL;
```

1F — Calculer distance_river_m et distance_fault_m :
```sql
  -- Distance au réseau hydrographique
  UPDATE atlas.ai_context_features_maille f
  SET distance_river_m = sub.dist
  FROM (
    SELECT m.code AS maille_code,
      MIN(ST_Distance(
        ST_Transform(m.geom, 25231),
        ST_Transform(h.geom, 25231)
      )) AS dist
    FROM atlas.mailles m
    CROSS JOIN atlas.hydrogeologie h
    GROUP BY m.code
  ) sub
  WHERE f.maille_code = sub.maille_code;
```
  Si atlas.hydrogeologie ne contient pas le réseau de drainage
  linéaire (seulement des polygones), noter le problème et
  utiliser ST_Centroid(h.geom) comme proxy.

1G — TEST L1 : Vérifier les features DSM calculées :
```sql
  SELECT
    COUNT(*) AS total,
    COUNT(altitude_mean) AS alt_ok,
    COUNT(dem_slope_mean_deg) AS slope_ok,
    COUNT(dem_tpi_mean) AS tpi_ok,
    COUNT(dem_hand_mean) AS hand_ok,
    ROUND(AVG(altitude_mean)::numeric, 1) AS alt_moy_m,
    ROUND(AVG(dem_slope_mean_deg)::numeric, 2) AS slope_moy_deg
  FROM atlas.ai_context_features_maille;
```
  ATTENDU :
    alt_ok ≥ 29000 (quelques NULL en bordure possible)
    slope_ok ≥ 29000
    alt_moy_m : entre 200 et 400 m (altitude moyenne Togo)
    slope_moy_deg : entre 1 et 5 degrés (pays peu pentu)

1H — GIT COMMIT #1 :
  git add -A
  git commit -m "feat(scorpan): populate DSM features in ai_context_features_maille
  
  - altitude_mean calculée depuis dsm_cop30 (ST_Clip + ST_SummaryStats)
  - dem_slope_mean_deg calculée via ST_Slope
  - dem_tpi_mean calculée (proxy voisins 6km)
  - dem_hand_mean calculée (proxy drainage 10km)
  - distance_river_m calculée (ST_Distance hydrogeologie)
  
  Coverage: ~29200/29407 mailles (99%)
  Ref: SCORPAN-R factor, ADR-007"

══════════════════════════════════════════════════════════════════
ÉTAPE 2 — INTÉGRATION WORLDCLIM EN BASE POSTGIS
Source : fichiers .tif téléchargés (prec 2.5m + bio 2.5m)
══════════════════════════════════════════════════════════════════

CONTEXTE :
  Les précipitations et variables bioclimatiques sont les
  covariables climatiques (facteur C du SCORPAN).
  Elles permettent de distinguer la zone soudanienne (Nord,
  800-1000mm) de la zone guinéenne (Sud, 1200-1600mm),
  ce qui corrèle directement avec l'intensité de la
  latérisation et le comportement des argiles.

2A — Charger les rasters précipitations en PostGIS :
  Créer la table et importer les 12 mois.
  Dans un terminal CMD (pas PowerShell, raster2pgsql est en PATH) :

  Écrire scripts/load_worldclim.bat :
```batch
  @echo off
  set PGPASSWORD=atlas
  set PSQL="C:\Program Files\PostgreSQL\17\bin\psql.exe"
  set R2P="C:\Program Files\PostgreSQL\17\bin\raster2pgsql.exe"
  set PREC_DIR=[CHEMIN_WORLDCLIM]\prec
  set BIO_DIR=[CHEMIN_WORLDCLIM]\bio
  set CONN=-U atlas -h 127.0.0.1 -p 5433 -d atlas_clean

  echo === Chargement precipitations (12 mois) ===
  %R2P% -s 4326 -I -C -M -t 100x100 -F ^
    %PREC_DIR%\wc2.1_2.5m_prec_*.tif ^
    atlas.worldclim_prec | %PSQL% %CONN%

  echo === Chargement bioclimatiques (19 variables) ===
  %R2P% -s 4326 -I -C -M -t 100x100 -F ^
    %BIO_DIR%\wc2.1_2.5m_bio_*.tif ^
    atlas.worldclim_bio | %PSQL% %CONN%

  echo === Done ===
```
  REMPLACER [CHEMIN_WORLDCLIM] par le vrai chemin.
  Exécuter : scripts\load_worldclim.bat

  Si raster2pgsql n'est pas dans PATH, chercher :
```powershell
  Get-ChildItem "C:\Program Files\PostgreSQL\" -Recurse `
    -Filter "raster2pgsql.exe" | Select FullName
```

2B — Vérifier le chargement :
```sql
  SELECT COUNT(*) FROM atlas.worldclim_prec;
  SELECT COUNT(*) FROM atlas.worldclim_bio;
  SELECT filename FROM atlas.worldclim_bio LIMIT 5;
```
  ATTENDU : worldclim_prec > 0, worldclim_bio > 0

2C — Créer la table des features climatiques par maille :
```sql
  CREATE TABLE IF NOT EXISTS atlas.maille_climate_features (
    maille_code   TEXT PRIMARY KEY,
    prec_annual   DOUBLE PRECISION,  -- mm/an (somme 12 mois)
    prec_dry      DOUBLE PRECISION,  -- mm saison sèche (nov-mars)
    prec_wet      DOUBLE PRECISION,  -- mm saison pluies (avr-oct)
    bio12         DOUBLE PRECISION,  -- Annual Precipitation
    bio15         DOUBLE PRECISION,  -- Precipitation Seasonality
    bio4          DOUBLE PRECISION,  -- Temperature Seasonality
    bio17         DOUBLE PRECISION,  -- Precipitation Driest Quarter
    updated_at    TIMESTAMPTZ DEFAULT now()
  );
```

2D — Extraire les valeurs WorldClim par centroïde de maille :
  Écrire scripts/compute_climate_features.py :
```python
  """
  Extraction des covariables WorldClim par maille Atlas.
  Utilise ST_Value() pour extraire la valeur du pixel raster
  au centroïde de chaque maille.
  
  Usage:
    python scripts/compute_climate_features.py \
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
  """
  import sys
  import argparse
  import psycopg2

  def main(db_url: str):
      conn = psycopg2.connect(db_url)
      cur = conn.cursor()

      print("Calcul précipitations annuelles...")
      cur.execute("""
      INSERT INTO atlas.maille_climate_features (
        maille_code, prec_annual, bio12, bio15, bio4, bio17
      )
      SELECT
        m.code,
        -- Somme 12 mois precipitation
        (SELECT SUM(ST_Value(r.rast, 1,
           ST_Transform(ST_Centroid(m.geom), 4326)))
         FROM atlas.worldclim_prec r
         WHERE ST_Intersects(r.rast,
           ST_Transform(ST_Centroid(m.geom), 4326))
        ) AS prec_annual,
        -- BIO12 Annual Precipitation
        (SELECT ST_Value(r.rast, 1,
           ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename ILIKE '%bio_12%'
           AND ST_Intersects(r.rast,
             ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1
        ) AS bio12,
        -- BIO15 Precipitation Seasonality
        (SELECT ST_Value(r.rast, 1,
           ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename ILIKE '%bio_15%'
           AND ST_Intersects(r.rast,
             ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1
        ) AS bio15,
        -- BIO4 Temperature Seasonality
        (SELECT ST_Value(r.rast, 1,
           ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename ILIKE '%bio_4%'
           AND ST_Intersects(r.rast,
             ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1
        ) AS bio4,
        -- BIO17 Precipitation Driest Quarter
        (SELECT ST_Value(r.rast, 1,
           ST_Transform(ST_Centroid(m.geom), 4326))
         FROM atlas.worldclim_bio r
         WHERE r.filename ILIKE '%bio_17%'
           AND ST_Intersects(r.rast,
             ST_Transform(ST_Centroid(m.geom), 4326))
         LIMIT 1
        ) AS bio17
      FROM atlas.mailles m
      ON CONFLICT (maille_code) DO NOTHING;
      """)
      conn.commit()

      cur.execute("""
        SELECT COUNT(*), AVG(prec_annual), AVG(bio15)
        FROM atlas.maille_climate_features
        WHERE prec_annual IS NOT NULL;
      """)
      n, avg_prec, avg_seas = cur.fetchone()
      print(f"✅ {n} mailles traitées")
      print(f"   Précip annuelle moy : {avg_prec:.0f} mm")
      print(f"   Saisonnalité moy    : {avg_seas:.1f}")
      conn.close()

  if __name__ == '__main__':
      parser = argparse.ArgumentParser()
      parser.add_argument('--database-url', required=True)
      args = parser.parse_args()
      main(args.database_url)
```

2E — Exécuter le script :
  $env:DATABASE_URL = 'postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean'
  python scripts\compute_climate_features.py `
    --database-url $env:DATABASE_URL

2F — TEST L1 : Vérifier les données climatiques :
```sql
  SELECT
    COUNT(*) AS total,
    COUNT(prec_annual) AS prec_ok,
    COUNT(bio15) AS bio15_ok,
    ROUND(AVG(prec_annual)::numeric, 0) AS prec_moy_mm,
    ROUND(MIN(prec_annual)::numeric, 0) AS prec_min_mm,
    ROUND(MAX(prec_annual)::numeric, 0) AS prec_max_mm,
    ROUND(AVG(bio15)::numeric, 1) AS saisonnalite_moy
  FROM atlas.maille_climate_features;
```
  ATTENDU :
    prec_ok ≥ 29000
    prec_moy_mm : entre 900 et 1300 (Togo : 900-1600mm)
    prec_min_mm : ~700 (extrême Nord)
    prec_max_mm : ~1600 (Sud-Ouest, Plateaux Akposso)
    saisonnalite_moy : entre 60 et 100 (forte saisonnalité)

2G — GIT COMMIT #2 :
  git add -A
  git commit -m "feat(scorpan): integrate WorldClim climate covariates
  
  - worldclim_prec : 12 mois precipitation (2.5 arcmin)
  - worldclim_bio  : 19 bioclimatic variables (2.5 arcmin)
  - maille_climate_features : prec_annual, bio12, bio15, bio4, bio17
  - Script: scripts/compute_climate_features.py
  
  Coverage: ~29200/29407 mailles
  Ref: SCORPAN-C factor, Fick & Hijmans 2017"

══════════════════════════════════════════════════════════════════
ÉTAPE 3 — MIGRATION DB : TABLE SCORPAN CONSOLIDÉE
ADR-007 : toutes les covariables SCORPAN dans une vue unique
══════════════════════════════════════════════════════════════════

CONTEXTE :
  Le pipeline Python de Régression Kriging doit pouvoir
  accéder à toutes les covariables en une seule requête.
  Créer une vue matérialisée SCORPAN consolidée.

3A — Créer la migration :
  Chercher le numéro de la dernière migration :
```powershell
  Get-ChildItem "migrations_post_v1\" -Filter "*.sql" |
    Sort-Object Name | Select-Object -Last 1
```
  Créer le fichier suivant avec le bon numéro (ex: 149) :

  Écrire migrations_post_v1\149_create_scorpan_view.sql :
```sql
  -- Migration 149 : Vue matérialisée SCORPAN
  -- Consolide toutes les covariables pour la Régression Kriging
  -- Ref: SCORPAN (McBratney 2003), ADR-007

  CREATE MATERIALIZED VIEW IF NOT EXISTS atlas.v_scorpan_features AS
  SELECT
    m.code              AS maille_code,
    m.xc_utm31          AS x_utm31,
    m.yc_utm31          AS y_utm31,

    -- S : Sol (sera jointuré depuis les sondages à l'exécution)
    -- N : Position spatiale
    ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) AS lon_wgs84,
    ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) AS lat_wgs84,

    -- R : Relief (topographie DSM)
    f.altitude_mean,
    f.dem_slope_mean_deg,
    f.dem_tpi_mean,
    f.dem_curvature_mean,
    f.dem_flow_acc_mean,
    f.dem_hand_mean,
    f.distance_river_m,
    f.distance_fault_m,

    -- P : Parent material (géologie)
    f.geol_code,
    f.geol_label,

    -- Sol type (pédologie)
    f.pedo_code,
    f.pedo_label,

    -- Hydrologie
    f.hydro_code,
    f.hydro_label,

    -- C : Climat (WorldClim)
    c.prec_annual,
    c.bio12,
    c.bio15,   -- Saisonnalité précipitations (clé pour RGA)
    c.bio4,
    c.bio17,

    -- Risque RGA existant (référence CHASSAGNEUX)
    f.risque_gonflement,
    f.risque_score

  FROM atlas.mailles m
  LEFT JOIN atlas.ai_context_features_maille f
    ON f.maille_code = m.code
  LEFT JOIN atlas.maille_climate_features c
    ON c.maille_code = m.code
  WITH DATA;

  CREATE UNIQUE INDEX IF NOT EXISTS idx_v_scorpan_maille_code
    ON atlas.v_scorpan_features (maille_code);

  CREATE INDEX IF NOT EXISTS idx_v_scorpan_geol
    ON atlas.v_scorpan_features (geol_code);

  CREATE INDEX IF NOT EXISTS idx_v_scorpan_pedo
    ON atlas.v_scorpan_features (pedo_code);

  COMMENT ON MATERIALIZED VIEW atlas.v_scorpan_features IS
    'Covariables SCORPAN consolidées pour la Régression Kriging.
     Rafraîchir avec: REFRESH MATERIALIZED VIEW atlas.v_scorpan_features;
     Ref: McBratney 2003, ADR-007, Migration 149';
```

3B — Exécuter la migration :
  $env:PGPASSWORD = 'atlas'
  & "C:\Program Files\PostgreSQL\17\bin\psql.exe" `
    -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean `
    -f "migrations_post_v1\149_create_scorpan_view.sql"

3C — TEST L1 : Vérifier la vue :
```sql
  SELECT COUNT(*) AS total,
    COUNT(altitude_mean) AS dsm_ok,
    COUNT(geol_label) AS geol_ok,
    COUNT(pedo_label) AS pedo_ok,
    COUNT(prec_annual) AS climat_ok,
    COUNT(bio15) AS bio15_ok
  FROM atlas.v_scorpan_features;
```
  ATTENDU : total=29407, tous les counts ≥ 28500

3D — GIT COMMIT #3 :
  git add -A
  git commit -m "feat(scorpan): migration 149 - vue materialisee v_scorpan_features
  
  - Consolide toutes covariables SCORPAN : R, P, S, C, N
  - Index sur maille_code, geol_code, pedo_code
  - Prête pour le pipeline Régression Kriging
  
  Ref: McBratney 2003, ADR-007, Migration 149"

══════════════════════════════════════════════════════════════════
ÉTAPE 4 — PIPELINE RÉGRESSION KRIGING (SCORPAN)
Cœur scientifique de cette session
══════════════════════════════════════════════════════════════════

CONTEXTE SCIENTIFIQUE :
  La Régression Kriging (RK) décompose la variable géotechnique :
    ẑ(s) = m̂(s) + ê(s)
  où :
    m̂(s) = régression sur covariables SCORPAN (tendance)
    ê(s) = krigeage ordinaire des résidus (structure locale)

  Priorité des paramètres (fort gain RK attendu) :
    1. VBS    → forte corrélation géologie/pédologie
    2. EG     → forte corrélation altitude/précipitations
    3. IP     → corrélation modérée
    4. WL/WP  → corrélation faible (fort nugget)

  Paramètre_id RK (convention ADR-007) :
    'vbs_rk_h1', 'vbs_rk_h2', 'vbs_rk_h3'
    'eg_rk_h1',  'eg_rk_h2',  'eg_rk_h3'
    'ip_rk_h1',  'ip_rk_h2',  'ip_rk_h3'
    'wl_rk_h1',  'wl_rk_h2',  'wl_rk_h3'
    'wp_rk_h1',  'wp_rk_h2',  'wp_rk_h3'

4A — Écrire le script principal RK :
  Créer scripts/atlas_regression_kriging.py :

```python
  """
  Pipeline Régression Kriging (RK) — Atlas Géotechnique Togo
  Intrepid Core Engineering Standards
  
  Architecture :
    L1 : Régression Ridge sur covariables SCORPAN
         (géologie, pédologie, topographie, climat, position)
    L2 : Krigeage Ordinaire des résidus (pykrige.ok.OrdinaryKriging)
    L3 : Fusion : ẑ_RK = m̂_regression + ê_kriging
  
  Sortie : paramètre_id = '{param}_rk_{horizon}'
           method = 'regression_kriging_scorpan'
           stocké dans atlas.ai_interpolation_values
  
  Usage :
    python scripts/atlas_regression_kriging.py \
      --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean \
      --parameter vbs \
      --horizon h1
  
  Ref: Hengl 2007, Goovaerts 1997, ADR-007
  """

  import sys
  import math
  import argparse
  import warnings
  import uuid
  from datetime import datetime, timezone
  from typing import Tuple, Dict, Any, List, Optional

  import numpy as np
  import pandas as pd
  import psycopg2
  from psycopg2.extras import execute_values
  from sklearn.linear_model import Ridge
  from sklearn.preprocessing import OneHotEncoder, StandardScaler
  from sklearn.compose import ColumnTransformer
  from sklearn.pipeline import Pipeline
  from sklearn.metrics import mean_squared_error, r2_score
  from pykrige.ok import OrdinaryKriging

  warnings.filterwarnings('ignore')

  # ── Configuration ────────────────────────────────────────────
  DEPTH_MAP = {'h1': 1.0, 'h2': 1.5, 'h3': 2.0}

  # Paramètres KED source pour récupérer les mesures terrain
  KED_PARAM_MAP = {
    'vbs': 'vbs_ked_{h}',
    'eg':  'eg_ked_{h}',
    'ip':  'ip_ked_{h}',
    'wl':  'wl_ked_{h}',
    'wp':  'wp_ked_{h}',
  }

  # Clamp physique (ADR-003)
  CLAMP_MAP = {
    'vbs': (0.0, 15.0),
    'eg':  (0.0, 20.0),
    'ip':  (0.0, 60.0),
    'wl':  (10.0, 120.0),
    'wp':  (5.0, 80.0),
  }

  # Features numériques SCORPAN
  NUMERIC_FEATURES = [
    'altitude_mean', 'dem_slope_mean_deg', 'dem_tpi_mean',
    'dem_curvature_mean', 'dem_hand_mean', 'distance_river_m',
    'prec_annual', 'bio15', 'bio12', 'bio17',
    'lon_wgs84', 'lat_wgs84',
  ]

  # Features catégorielles SCORPAN
  CATEGORICAL_FEATURES = ['geol_code', 'pedo_code']

  def get_connection(db_url: str):
      return psycopg2.connect(db_url)

  def load_sondage_data(
      conn, param: str, horizon: str
  ) -> pd.DataFrame:
      """
      Charge les mesures terrain aux points de sondage
      avec toutes les covariables SCORPAN.
      """
      depth_m = DEPTH_MAP[horizon]
      cur = conn.cursor()

      cur.execute("""
      SELECT
        s.code_sondage,
        s.x_utm31,
        s.y_utm31,
        e.value AS target,
        sc.altitude_mean,
        sc.dem_slope_mean_deg,
        sc.dem_tpi_mean,
        sc.dem_curvature_mean,
        sc.dem_hand_mean,
        sc.distance_river_m,
        sc.prec_annual,
        sc.bio15,
        sc.bio12,
        sc.bio17,
        sc.lon_wgs84,
        sc.lat_wgs84,
        COALESCE(sc.geol_code, 'UNKNOWN') AS geol_code,
        COALESCE(sc.pedo_code, 'UNKNOWN') AS pedo_code
      FROM atlas.sondages s
      JOIN atlas.essais e
        ON e.sondage_id = s.id
      JOIN atlas.v_scorpan_features sc
        ON sc.maille_code = (
          SELECT m.code FROM atlas.mailles m
          WHERE ST_Within(s.geom, m.geom)
          LIMIT 1
        )
      WHERE e.test_type ILIKE %s
        AND ABS(e.depth_m - %s) < 0.3
        AND e.value IS NOT NULL
        AND s.deleted_at IS NULL
      """, (f'%{param}%', depth_m))

      rows = cur.fetchall()
      cols = [desc[0] for desc in cur.description]
      df = pd.DataFrame(rows, columns=cols)
      print(f"  Sondages chargés : {len(df)} points "
            f"({param} à {depth_m}m)")
      return df

  def load_all_mailles(conn) -> pd.DataFrame:
      """
      Charge toutes les mailles avec leurs covariables SCORPAN.
      """
      cur = conn.cursor()
      cur.execute("""
      SELECT
        maille_code,
        x_utm31,
        y_utm31,
        altitude_mean,
        dem_slope_mean_deg,
        dem_tpi_mean,
        dem_curvature_mean,
        dem_hand_mean,
        distance_river_m,
        prec_annual,
        bio15,
        bio12,
        bio17,
        lon_wgs84,
        lat_wgs84,
        COALESCE(geol_code, 'UNKNOWN') AS geol_code,
        COALESCE(pedo_code, 'UNKNOWN') AS pedo_code
      FROM atlas.v_scorpan_features
      """)
      rows = cur.fetchall()
      cols = [desc[0] for desc in cur.description]
      df = pd.DataFrame(rows, columns=cols)
      print(f"  Mailles chargées : {len(df)} mailles")
      return df

  def build_preprocessor(
      geol_categories: List[str],
      pedo_categories: List[str]
  ) -> ColumnTransformer:
      """
      Préprocesseur SCORPAN :
      - Features numériques : imputation médiane + standardisation
      - Features catégorielles : OneHot encoding
      """
      from sklearn.impute import SimpleImputer
      numeric_pipeline = Pipeline([
          ('imputer', SimpleImputer(strategy='median')),
          ('scaler', StandardScaler()),
      ])
      categorical_pipeline = Pipeline([
          ('imputer', SimpleImputer(strategy='constant',
                                    fill_value='UNKNOWN')),
          ('onehot', OneHotEncoder(
              categories=[geol_categories, pedo_categories],
              handle_unknown='ignore',
              sparse_output=False
          )),
      ])
      return ColumnTransformer([
          ('num', numeric_pipeline, NUMERIC_FEATURES),
          ('cat', categorical_pipeline, CATEGORICAL_FEATURES),
      ])

  def fit_regression(
      df_train: pd.DataFrame,
      geol_cats: List[str],
      pedo_cats: List[str]
  ) -> Tuple[Pipeline, np.ndarray, float, float]:
      """
      Ajuste le modèle de régression Ridge sur les sondages.
      Retourne : modèle, résidus, R², RMSE
      """
      X = df_train[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
      y = df_train['target'].values

      preprocessor = build_preprocessor(geol_cats, pedo_cats)
      model = Pipeline([
          ('preprocessor', preprocessor),
          ('regressor', Ridge(alpha=1.0, random_seed=42
                              if hasattr(Ridge, 'random_seed')
                              else None)),
      ])

      # Ridge ne prend pas random_seed, correction :
      model = Pipeline([
          ('preprocessor', preprocessor),
          ('regressor', Ridge(alpha=1.0)),
      ])

      model.fit(X, y)
      y_pred = model.predict(X)
      residuals = y - y_pred

      r2 = r2_score(y, y_pred)
      rmse = math.sqrt(mean_squared_error(y, y_pred))
      print(f"  Régression : R²={r2:.3f}, RMSE={rmse:.3f}")
      return model, residuals, r2, rmse

  def fit_variogram_and_krige(
      df_train: pd.DataFrame,
      residuals: np.ndarray,
      df_all: pd.DataFrame
  ) -> Tuple[np.ndarray, np.ndarray]:
      """
      Krigeage Ordinaire des résidus.
      Retourne : valeurs krigées + variance pour toutes les mailles.
      Note : le variogramme est ajusté sur les résidus,
             pas sur les données brutes.
      """
      ok = OrdinaryKriging(
          df_train['x_utm31'].values,
          df_train['y_utm31'].values,
          residuals,
          variogram_model='spherical',
          nlags=10,
          weight=True,
          verbose=False,
          enable_plotting=False,
      )
      nugget = ok.variogram_model_parameters[0]
      sill   = ok.variogram_model_parameters[1]
      range_ = ok.variogram_model_parameters[2]
      loo_rmse = ok.get_statistics()

      print(f"  Variogramme résidus : "
            f"nugget={nugget:.3f}, sill={sill:.3f}, "
            f"range={range_:.0f}m")

      z_kriged, ss_kriged = ok.execute(
          'points',
          df_all['x_utm31'].values,
          df_all['y_utm31'].values,
      )
      return z_kriged, ss_kriged

  def loo_cv(
      df_train: pd.DataFrame,
      geol_cats: List[str],
      pedo_cats: List[str],
      param: str
  ) -> float:
      """
      Leave-One-Out Cross-Validation sur le pipeline RK complet.
      Retourne LOO-RMSE.
      """
      n = len(df_train)
      if n < 6:
          print(f"  LOO-CV : N={n} < 6, skipped")
          return float('nan')

      errors = []
      for i in range(n):
          train_idx = [j for j in range(n) if j != i]
          test_row  = df_train.iloc[i]
          train_sub = df_train.iloc[train_idx]

          try:
              model_i, res_i, _, _ = fit_regression(
                  train_sub, geol_cats, pedo_cats
              )
              x_test = pd.DataFrame([test_row[
                  NUMERIC_FEATURES + CATEGORICAL_FEATURES
              ]])
              trend_test = model_i.predict(x_test)[0]

              ok_i = OrdinaryKriging(
                  train_sub['x_utm31'].values,
                  train_sub['y_utm31'].values,
                  res_i,
                  variogram_model='spherical',
                  verbose=False, enable_plotting=False,
              )
              z_i, _ = ok_i.execute(
                  'points',
                  np.array([test_row['x_utm31']]),
                  np.array([test_row['y_utm31']]),
              )
              pred = trend_test + float(z_i[0])
              errors.append((pred - test_row['target']) ** 2)
          except Exception as e:
              print(f"  LOO point {i} skipped: {e}")

      if not errors:
          return float('nan')
      loo_rmse = math.sqrt(sum(errors) / len(errors))
      print(f"  LOO-RMSE : {loo_rmse:.4f} ({len(errors)}/{n} points)")
      return loo_rmse

  def store_results(
      conn,
      df_all: pd.DataFrame,
      z_rk: np.ndarray,
      ss_kriged: np.ndarray,
      param: str,
      horizon: str,
      loo_rmse: float,
      regression_r2: float,
  ) -> str:
      """
      Stocke les résultats RK dans atlas.ai_interpolation_values.
      Convention ADR-007.
      """
      clamp_min, clamp_max = CLAMP_MAP[param]
      parameter_id = f'{param}_rk_{horizon}'
      run_id = str(uuid.uuid4())
      now = datetime.now(timezone.utc)

      # Marquer les anciens comme superseded
      cur = conn.cursor()
      cur.execute("""
      UPDATE atlas.ai_interpolation_values
      SET is_superseded = true
      WHERE parameter_id = %s
        AND method = 'regression_kriging_scorpan'
        AND COALESCE(is_superseded, false) = false
      """, (parameter_id,))

      # Créer le run
      cur.execute("""
      INSERT INTO atlas.ai_interpolation_runs
        (id, parameter_id, method, status, created_at, meta)
      VALUES (%s, %s, %s, 'completed', %s, %s)
      """, (
          run_id, parameter_id,
          'regression_kriging_scorpan', now,
          psycopg2.extras.Json({
              'loo_rmse': loo_rmse,
              'regression_r2': regression_r2,
              'n_sondages': len(df_all),
              'features': NUMERIC_FEATURES + CATEGORICAL_FEATURES,
              'horizon': horizon,
              'generated_at': now.isoformat(),
          })
      ))

      # Insérer les valeurs
      rows = []
      for i, row in df_all.iterrows():
          val = float(z_rk[i])
          val = max(clamp_min, min(clamp_max, val))
          if not math.isfinite(val):
              continue
          rows.append((
              str(uuid.uuid4()),
              row['maille_code'],
              parameter_id,
              val,
              run_id,
              'regression_kriging_scorpan',
              False,
              now,
          ))

      execute_values(cur, """
      INSERT INTO atlas.ai_interpolation_values
        (id, maille_id, parameter_id, value, run_id,
         method, is_superseded, created_at)
      SELECT
        data.id::uuid,
        m.id,
        data.parameter_id,
        data.value,
        data.run_id::uuid,
        data.method,
        data.is_superseded,
        data.created_at
      FROM (VALUES %s) AS data(
        id, maille_code, parameter_id, value,
        run_id, method, is_superseded, created_at
      )
      JOIN atlas.mailles m ON m.code = data.maille_code
      """, rows, template="(%s,%s,%s,%s,%s,%s,%s,%s)")

      conn.commit()
      print(f"  ✅ {len(rows)} valeurs RK stockées "
            f"(parameter_id={parameter_id})")
      return run_id

  def main():
      parser = argparse.ArgumentParser(
          description='Régression Kriging SCORPAN — Atlas Togo'
      )
      parser.add_argument('--database-url', required=True)
      parser.add_argument('--parameter',
          choices=['vbs','eg','ip','wl','wp'], required=True)
      parser.add_argument('--horizon',
          choices=['h1','h2','h3'], required=True)
      parser.add_argument('--skip-loo', action='store_true',
          help='Passer la LOO-CV (plus rapide)')
      args = parser.parse_args()

      print(f"\n{'='*60}")
      print(f"RÉGRESSION KRIGING : {args.parameter.upper()} "
            f"horizon {args.horizon.upper()}")
      print(f"{'='*60}\n")

      conn = get_connection(args.database_url)

      # 1. Charger les données
      print("→ Chargement des données sondages...")
      df_train = load_sondage_data(conn, args.parameter, args.horizon)
      if len(df_train) < 6:
          print(f"❌ Pas assez de sondages ({len(df_train)} < 6)")
          sys.exit(1)

      print("→ Chargement des mailles...")
      df_all = load_all_mailles(conn)

      # 2. Catégories connues
      geol_cats = sorted(df_all['geol_code'].unique().tolist())
      pedo_cats = sorted(df_all['pedo_code'].unique().tolist())

      # 3. Régression sur covariables
      print("→ Régression Ridge SCORPAN...")
      model, residuals, reg_r2, reg_rmse = fit_regression(
          df_train, geol_cats, pedo_cats
      )

      # 4. LOO-CV si demandé
      loo_rmse = float('nan')
      if not args.skip_loo:
          print("→ Leave-One-Out Cross-Validation...")
          loo_rmse = loo_cv(df_train, geol_cats, pedo_cats,
                             args.parameter)

      # 5. Prédire la tendance sur toutes les mailles
      print("→ Prédiction tendance sur 29 407 mailles...")
      X_all = df_all[NUMERIC_FEATURES + CATEGORICAL_FEATURES]
      trend_all = model.predict(X_all)

      # 6. Krigeage des résidus
      print("→ Krigeage Ordinaire des résidus...")
      z_kriged, ss_kriged = fit_variogram_and_krige(
          df_train, residuals, df_all
      )

      # 7. Fusion
      z_rk = trend_all + z_kriged
      print(f"  RK stats : min={z_rk.min():.2f}, "
            f"max={z_rk.max():.2f}, "
            f"mean={z_rk.mean():.2f}")

      # 8. Stocker
      print("→ Stockage des résultats...")
      run_id = store_results(
          conn, df_all, z_rk, ss_kriged,
          args.parameter, args.horizon,
          loo_rmse, reg_r2
      )

      print(f"\n✅ TERMINÉ — run_id : {run_id}")
      print(f"   LOO-RMSE RK : {loo_rmse:.4f}")
      print(f"   R² régression : {reg_r2:.4f}")

      conn.close()

  if __name__ == '__main__':
      main()
```

4B — Exécuter la RK sur VBS H1 (test pilote) :
  python scripts\atlas_regression_kriging.py `
    --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean `
    --parameter vbs `
    --horizon h1 `
    --skip-loo
  
  VÉRIFIER :
  - Pas d'erreur Python
  - Affichage R² régression et stats z_rk
  - Message "✅ X valeurs RK stockées"

4C — TEST L1 : Vérifier le résultat en DB :
```sql
  SELECT
    parameter_id,
    COUNT(*) AS n,
    ROUND(AVG(value)::numeric, 3) AS moy,
    ROUND(MIN(value)::numeric, 3) AS min_val,
    ROUND(MAX(value)::numeric, 3) AS max_val
  FROM atlas.ai_interpolation_values
  WHERE parameter_id = 'vbs_rk_h1'
    AND COALESCE(is_superseded, false) = false
  GROUP BY parameter_id;
```
  ATTENDU :
    n = 29407
    moy : entre 2.0 et 6.0 (plage physique VBS Togo)
    min_val ≥ 0.0 (clamp)
    max_val ≤ 15.0 (clamp)

4D — COMPARER RK vs KED (validation scientifique) :
```sql
  SELECT
    'KED' AS methode,
    parameter_id,
    COUNT(*) AS n,
    ROUND(AVG(value)::numeric, 3) AS moy,
    ROUND(STDDEV(value)::numeric, 3) AS ecart_type
  FROM atlas.ai_interpolation_values
  WHERE parameter_id = 'vbs_ked_h1'
    AND COALESCE(is_superseded, false) = false
  GROUP BY parameter_id
  UNION ALL
  SELECT
    'RK' AS methode,
    parameter_id,
    COUNT(*) AS n,
    ROUND(AVG(value)::numeric, 3) AS moy,
    ROUND(STDDEV(value)::numeric, 3) AS ecart_type
  FROM atlas.ai_interpolation_values
  WHERE parameter_id = 'vbs_rk_h1'
    AND COALESCE(is_superseded, false) = false
  GROUP BY parameter_id;
```
  NOTER les différences moy et ecart_type KED vs RK.
  Si RK ecart_type < KED ecart_type → bonne régularisation.

4E — Exécuter la LOO-CV complète sur VBS H1 :
  python scripts\atlas_regression_kriging.py `
    --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean `
    --parameter vbs `
    --horizon h1
  NOTER le LOO-RMSE RK vs LOO-RMSE KED (3.06 g/100g).
  Si LOO-RMSE RK < 3.06 → RK améliore. Documenter.

4F — Exécuter RK sur tous les paramètres prioritaires :
  $DB = 'postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean'
  
  foreach ($param in @('vbs','eg','ip','wl','wp')) {
    foreach ($h in @('h1','h2','h3')) {
      Write-Host "=== RK $param $h ==="
      python scripts\atlas_regression_kriging.py `
        --database-url $DB `
        --parameter $param `
        --horizon $h `
        --skip-loo
    }
  }

4G — TEST L1 : Vérifier la couverture complète RK :
```sql
  SELECT
    parameter_id,
    COUNT(DISTINCT maille_id) AS n_mailles,
    ROUND(COUNT(DISTINCT maille_id) * 100.0 / 29407, 1) AS pct
  FROM atlas.ai_interpolation_values
  WHERE method = 'regression_kriging_scorpan'
    AND COALESCE(is_superseded, false) = false
  GROUP BY parameter_id
  ORDER BY parameter_id;
```
  ATTENDU : 15 lignes (5 params × 3 horizons), toutes à ≥98%

4H — GIT COMMIT #4 :
  git add -A
  git commit -m "feat(rk): pipeline Regression Kriging SCORPAN complet
  
  - Script: scripts/atlas_regression_kriging.py
  - Régression Ridge sur covariables SCORPAN (géol, pédo, DSM, climat)
  - Krigeage Ordinaire des résidus (pykrige.ok)
  - LOO-CV implémentée
  - 15 paramètres RK stockés (5 params × 3 horizons × 29407 mailles)
  - method='regression_kriging_scorpan', ADR-007 respecté
  
  Coverage: 29407/29407 mailles
  Ref: Hengl 2007, Goovaerts 1997"

══════════════════════════════════════════════════════════════════
ÉTAPE 5 — TABLE DE COMPARAISON LOO-RMSE KED vs RK
Résultat scientifique central du mémoire
══════════════════════════════════════════════════════════════════

5A — Exécuter LOO-CV complète sur les 5 paramètres prioritaires :
  Seulement H1 pour comparaison directe avec les LOO-RMSE KED.
  Lancer en parallèle si possible (5 fenêtres séparées) :

  $DB = 'postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean'
  python scripts\atlas_regression_kriging.py `
    --database-url $DB --parameter vbs --horizon h1
  python scripts\atlas_regression_kriging.py `
    --database-url $DB --parameter eg  --horizon h1
  python scripts\atlas_regression_kriging.py `
    --database-url $DB --parameter ip  --horizon h1
  python scripts\atlas_regression_kriging.py `
    --database-url $DB --parameter wl  --horizon h1
  python scripts\atlas_regression_kriging.py `
    --database-url $DB --parameter wp  --horizon h1

5B — Construire le tableau de comparaison final :
  Récupérer les LOO-RMSE RK depuis ai_interpolation_runs.meta :
```sql
  SELECT
    r.parameter_id,
    r.method,
    (r.meta->>'loo_rmse')::numeric AS loo_rmse_rk,
    (r.meta->>'regression_r2')::numeric AS r2_regression,
    v.loo_rmse AS loo_rmse_ked
  FROM atlas.ai_interpolation_runs r
  JOIN atlas.ai_variograms v
    ON v.parameter_id = REPLACE(r.parameter_id, '_rk_', '_ked_')
  WHERE r.method = 'regression_kriging_scorpan'
    AND r.parameter_id LIKE '%_h1'
    AND r.status = 'completed'
  ORDER BY r.parameter_id;
```

  Produire le tableau final :
  | Paramètre | LOO-RMSE KED | LOO-RMSE RK | Gain (%) | Décision  |
  |-----------|-------------|------------|----------|-----------|
  | VBS H1    | 3.060       | ?          | ?%       | RK/KED    |
  | EG  H1    | 1.670       | ?          | ?%       | RK/KED    |
  | IP  H1    | 10.531      | ?          | ?%       | RK/KED    |
  | WL  H1    | 13.681      | ?          | ?%       | RK/KED    |
  | WP  H1    | 8.384       | ?          | ?%       | RK/KED    |

  RÈGLE DE DÉCISION :
    Si gain ≥ 10% → RK devient méthode principale (L2)
    Si gain < 10% → KED reste méthode principale (L1)
    Documenter la décision dans le mémoire.

══════════════════════════════════════════════════════════════════
ÉTAPE 6 — EXPOSER LA RK DANS L'API ET L'UI
══════════════════════════════════════════════════════════════════

6A — Vérifier que les endpoints existants supportent la RK :
  curl "http://127.0.0.1:8000/api/thematic/data?parameter=vbs_rk_h1" \
    -H "Authorization: Bearer $TOKEN"
  ATTENDU : count=29407 (si l'endpoint est générique)
  Si 404 ou count=0 → le paramètre n'est pas reconnu,
  voir étape 6B.

6B — Si l'API ne supporte pas les nouveaux parameter_id :
  Chercher dans services/api-geo/src/thematic/ si les
  parameter_id sont filtrés par une liste blanche.
  Ajouter 'vbs_rk_h1'...'wp_rk_h3' à cette liste.
  Recompiler : cargo build --release
  Redémarrer l'API.

6C — Ajouter les paramètres RK au catalogue thématique frontend :
  Chercher dans ui/src/thematic/thematic-types-source.ts
  la définition des paramètres.
  Pour chaque paramètre KED existant (vbs_ked_h1...),
  ajouter la variante RK correspondante :
```typescript
  {
    id: 'vbs_rk',
    label: 'VBS — Régression Kriging (SCORPAN)',
    unit: 'g/100g',
    horizons: ['h1', 'h2', 'h3'],
    method: 'regression_kriging_scorpan',
    description: 'Valeur de Bleu interpolée par Régression ' +
                 'Kriging avec covariables SCORPAN ' +
                 '(géologie, pédologie, topographie, climat)'
  }
```

6D — npm run build + npm run test:unit :
  cd ui && npm run build 2>&1 | Select-Object -Last 5
  npm run test:unit 2>&1 | Select-Object -Last 5
  ATTENDU : build OK, 31/31 tests passés

6E — TEST L2 : Vérifier l'endpoint API RK :
  curl "http://127.0.0.1:8000/api/stats/descriptive?parameter=vbs_rk_h1" \
    -H "Authorization: Bearer $TOKEN"
  ATTENDU : n=29407, source=interpolated_values

6F — GIT COMMIT #5 :
  git add -A
  git commit -m "feat(api+ui): expose Regression Kriging parameters
  
  - API : paramètres vbs_rk_*, eg_rk_*, ip_rk_*, wl_rk_*, wp_rk_*
  - UI  : catalogue thématique enrichi avec variante RK
  - Build UI : OK
  - Tests : 31/31 passed"

══════════════════════════════════════════════════════════════════
ÉTAPE 7 — SEED DUMP FINAL + GIT PUSH
Standard Intrepid Core : sauvegarder l'état validé
══════════════════════════════════════════════════════════════════

7A — Vérifier les invariants avant dump :
```sql
  SELECT
    (SELECT COUNT(*) FROM atlas.mailles) = 29407 AS inv001,
    (SELECT COUNT(*) FROM atlas.ai_interpolation_values
     WHERE method = 'regression_kriging_scorpan'
       AND COALESCE(is_superseded, false) = false
    ) >= 200000 AS inv_rk_ok,
    (SELECT COUNT(*) FROM atlas.maille_climate_features
     WHERE prec_annual IS NOT NULL
    ) >= 29000 AS inv_climat_ok,
    (SELECT COUNT(*) FROM atlas.v_scorpan_features
     WHERE geol_label IS NOT NULL
    ) >= 29000 AS inv_geol_ok,
    (SELECT COUNT(*) FROM atlas.ai_model_registry
     WHERE status = 'active'
    ) >= 1 AS inv_ml_ok;
```
  ATTENDU : toutes les colonnes = true

7B — Archiver l'ancien dump (ADR-006 obligatoire) :
```powershell
  $verDir = "data\db\backups\versions"
  New-Item -ItemType Directory -Force -Path $verDir | Out-Null
  $ts = Get-Date -Format "yyyyMMdd_HHmmss"
  Copy-Item "data\db\backups\atlas_desktop_seed.dump" `
    "$verDir\atlas_desktop_seed_v1.2.1_pre_scorpan_$ts.dump" -Force
  Write-Output "✅ Archive créée"
```

7C — Créer le nouveau dump :
  Écrire do_dump_final.ps1 :
```powershell
  $env:PGPASSWORD = 'atlas'
  Write-Output "Démarrage dump $(Get-Date)..."
  & "C:\Program Files\PostgreSQL\17\bin\pg_dump.exe" `
    -U atlas -h 127.0.0.1 -p 5433 -d atlas_clean `
    -Fc --no-owner --no-privileges -n atlas `
    -f "data\db\backups\atlas_desktop_seed.dump"
  $f = Get-Item "data\db\backups\atlas_desktop_seed.dump"
  $hash = (Get-FileHash $f.FullName -Algorithm SHA256).Hash
  Write-Output "✅ Dump OK"
  Write-Output "Taille : $([math]::Round($f.Length/1MB,1)) MB"
  Write-Output "SHA256 : $hash"
  $hash | Out-File "data\db\backups\atlas_desktop_seed.dump.sha256"
```
  Start-Process powershell -ArgumentList "-File","do_dump_final.ps1" -Wait

7D — Mettre à jour le manifest seed v1.3.0 :
  Lire le SHA256 depuis atlas_desktop_seed.dump.sha256
  Mettre à jour data\db\backups\atlas_desktop_seed.dump.json :
  - identity.seed_version → "1.3.0"
  - identity.seed_id → "atlas-seed-[DATE]-v1.3.0"
  - integrity.sha256 → [nouveau hash]
  - integrity.size_bytes → [nouvelle taille]
  - source.created_at → [timestamp actuel]
  - Ajouter invariant INV-007 :
```json
    {
      "id": "INV-007",
      "description": "RK complet — 15 paramètres SCORPAN",
      "severity": "high",
      "query": "SELECT COUNT(DISTINCT parameter_id) FROM atlas.ai_interpolation_values WHERE method='regression_kriging_scorpan' AND COALESCE(is_superseded,false)=false",
      "expected_min": 15
    }
```
  - Ajouter INV-008 :
```json
    {
      "id": "INV-008",
      "description": "Covariables climatiques WorldClim présentes",
      "severity": "high",
      "query": "SELECT COUNT(*) FROM atlas.maille_climate_features WHERE prec_annual IS NOT NULL",
      "expected_min": 29000
    }
```
  - changelog : ajouter entrée v1.3.0

7E — TEST final manifest :
```powershell
  $j = Get-Content "data\db\backups\atlas_desktop_seed.dump.json" |
    ConvertFrom-Json
  Write-Output "Version: $($j.identity.seed_version)"
  Write-Output "Invariants: $($j.invariants.Count)"
  Write-Output "SHA256 OK: $(
    $j.integrity.sha256 -eq (Get-Content 'data\db\backups\atlas_desktop_seed.dump.sha256')
  )"
```
  ATTENDU : Version=1.3.0, Invariants=8, SHA256 OK=True

7F — GIT COMMIT FINAL + PUSH :
  git add -A
  git commit -m "feat(scorpan+rk): pipeline complet SCORPAN + Regression Kriging
  
  NOUVELLES COVARIABLES :
  - DSM features : altitude, slope, TPI, curvature, HAND (29407 mailles)
  - WorldClim : prec_annual, bio12, bio15, bio4, bio17
  - Vue v_scorpan_features : SCORPAN consolidé (migration 149)
  
  RÉGRESSION KRIGING :
  - 15 paramètres × 29407 mailles = ~440 000 nouvelles valeurs
  - method='regression_kriging_scorpan', ADR-007
  - LOO-RMSE comparé KED vs RK (voir tableau section 5)
  
  SEED DUMP v1.3.0 :
  - Invariants 7 et 8 ajoutés
  - SHA256 : [VALEUR]
  
  Ref: McBratney 2003, Hengl 2007, Goovaerts 1997"

  git push origin atlas_v2_clean
  Write-Output "✅ Git push OK"

══════════════════════════════════════════════════════════════════
RAPPORT FINAL DE SESSION
══════════════════════════════════════════════════════════════════

Produire ce rapport à la fin :

## RAPPORT SCORPAN + RK — Atlas Géotechnique Togo
## Date : [DATE] | Intrepid Core Engineering

### COUVERTURE SCORPAN
| Facteur | Covariable | Mailles peuplées | % |
|---------|-----------|-----------------|---|
| R — Relief | altitude_mean | ? | ? |
| R — Relief | dem_slope_mean_deg | ? | ? |
| P — Géologie | geol_label | ? | ? |
| S — Pédologie | pedo_label | ? | ? |
| C — Climat | prec_annual | ? | ? |
| C — Climat | bio15 | ? | ? |

### TABLEAU COMPARAISON KED vs RK
| Paramètre | LOO-RMSE KED | LOO-RMSE RK | Gain | Méthode retenue |
|-----------|-------------|------------|------|-----------------|
| VBS H1 | 3.060 | ? | ?% | ? |
| EG  H1 | 1.670 | ? | ?% | ? |
| IP  H1 | 10.531 | ? | ?% | ? |
| WL  H1 | 13.681 | ? | ?% | ? |
| WP  H1 | 8.384 | ? | ?% | ? |

### SEED DUMP v1.3.0
SHA256 : [VALEUR COMPLÈTE]
Invariants : 8/8 validés
Git : [HASH DU DERNIER COMMIT]

══════════════════════════════════════════════════════════════════
CHECKLIST VALIDATION UI — À FAIRE PAR SERGE
══════════════════════════════════════════════════════════════════

Ouvrir http://localhost:1420/index.html

□ 1. Panneau thématique → Source → "VBS — Régression Kriging"
     visible dans la liste des paramètres ?

□ 2. Sélectionner vbs_rk → H1 → Appliquer
     La carte s'affiche avec une choroplèthe ?

□ 3. Comparer visuellement vbs_ked_h1 vs vbs_rk_h1
     Les cartes sont-elles différentes ?
     (si identiques → la RK n'est pas chargée)

□ 4. Cliquer une maille en zone Lama (zone Vertisols)
     Popup affiche-t-il la valeur vbs_rk ?

□ 5. DB Manager → Expert Scientifique → EDA
     Sélectionner vbs_rk_h1 → N = 29407 ?

□ 6. DB Manager → Couverture
     vbs_rk_h1 → 100% ?