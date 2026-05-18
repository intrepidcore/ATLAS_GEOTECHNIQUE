$env:PGPASSWORD = 'atlas'
$PSQL = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'
$ARGS_BASE = @('-U','atlas','-h','127.0.0.1','-p','5433','-d','atlas_clean')

function Run-Query($label, $sql) {
    Write-Host "`n======================================================" -ForegroundColor Cyan
    Write-Host "=== $label" -ForegroundColor Cyan
    Write-Host "======================================================" -ForegroundColor Cyan
    & $PSQL @ARGS_BASE -c $sql
}

# ─── ÉTAPE 1A : Inventaire complet ─────────────────────────────
Run-Query "ETAPE 1A - INVENTAIRE COMPLET PAR PARAMETRE" "
SELECT parameter_id, method,
  COUNT(DISTINCT maille_id) as n_mailles,
  ROUND(COUNT(DISTINCT maille_id)::numeric * 100.0 / 29407, 2) as pct,
  ROUND(MIN(value)::numeric, 4) as val_min,
  ROUND(AVG(value)::numeric, 4) as val_avg,
  ROUND(MAX(value)::numeric, 4) as val_max,
  MAX(created_at)::date as dernier_run
FROM atlas.ai_interpolation_values
WHERE COALESCE(is_superseded, false) = false
GROUP BY parameter_id, method
ORDER BY parameter_id, method;
"

# ─── ÉTAPE 1B : Résumé par famille ─────────────────────────────
Run-Query "ETAPE 1B - RESUME PAR FAMILLE" "
SELECT
  CASE
    WHEN parameter_id LIKE 'vbs%'          THEN 'VBS'
    WHEN parameter_id LIKE 'ip_ked%'       THEN 'IP KED direct'
    WHEN parameter_id LIKE 'ip_derived%'   THEN 'IP derive WL-WP'
    WHEN parameter_id LIKE 'ip_avg%'       THEN 'IP moyenne'
    WHEN parameter_id LIKE 'eg%'           THEN 'EG'
    WHEN parameter_id LIKE 'wl%'           THEN 'WL'
    WHEN parameter_id LIKE 'wp%'           THEN 'WP'
    WHEN parameter_id LIKE 'passant_2mm%'  THEN 'Granulo 2mm'
    WHEN parameter_id LIKE 'passant_80um%' THEN 'Granulo 80um'
    WHEN parameter_id LIKE 'kriging_%'     THEN 'Kriging ordinaire'
    ELSE 'Autre: ' || parameter_id
  END AS famille,
  parameter_id,
  COUNT(DISTINCT maille_id) as n_mailles,
  ROUND(COUNT(DISTINCT maille_id)::numeric * 100.0 / 29407, 1) as pct
FROM atlas.ai_interpolation_values
WHERE COALESCE(is_superseded, false) = false
GROUP BY famille, parameter_id
ORDER BY famille, parameter_id;
"

# ─── ÉTAPE 2A : Matrice présence/absence 21 KED attendus ───────
Run-Query "ETAPE 2A - MATRICE PRESENCE/ABSENCE 21 KED" "
WITH expected AS (
  SELECT unnest(ARRAY[
    'vbs_ked_h1','vbs_ked_h2','vbs_ked_h3',
    'ip_ked_h1','ip_ked_h2','ip_ked_h3',
    'eg_ked_h1','eg_ked_h2','eg_ked_h3',
    'wl_ked_h1','wl_ked_h2','wl_ked_h3',
    'wp_ked_h1','wp_ked_h2','wp_ked_h3',
    'passant_2mm_ked_h1','passant_2mm_ked_h2','passant_2mm_ked_h3',
    'passant_80um_ked_h1','passant_80um_ked_h2','passant_80um_ked_h3'
  ]) as parameter_id
),
actual AS (
  SELECT parameter_id,
    COUNT(DISTINCT maille_id) as n_mailles,
    ROUND(COUNT(DISTINCT maille_id)::numeric * 100.0 / 29407, 2) as pct,
    ROUND(AVG(value)::numeric, 4) as avg_val,
    ROUND(MIN(value)::numeric, 4) as min_val,
    ROUND(MAX(value)::numeric, 4) as max_val
  FROM atlas.ai_interpolation_values
  WHERE COALESCE(is_superseded, false) = false
  GROUP BY parameter_id
)
SELECT
  e.parameter_id,
  CASE WHEN a.parameter_id IS NOT NULL THEN 'PRESENT' ELSE 'ABSENT' END as statut,
  COALESCE(a.n_mailles::text, '0') as n_mailles,
  CASE
    WHEN a.n_mailles = 29407 THEN 'COMPLET 100%'
    WHEN a.n_mailles > 0 AND a.n_mailles < 29407 THEN 'PARTIEL ' || a.pct || '%'
    WHEN a.parameter_id IS NULL THEN 'MANQUANT'
    ELSE 'VIDE'
  END as evaluation,
  a.avg_val, a.min_val, a.max_val
FROM expected e
LEFT JOIN actual a USING (parameter_id)
ORDER BY e.parameter_id;
"

# ─── ÉTAPE 2B : Paramètres dérivés ip_derived ──────────────────
Run-Query "ETAPE 2B - PARAMETRES DERIVES ip_derived" "
WITH expected_derived AS (
  SELECT unnest(ARRAY['ip_derived_h1','ip_derived_h2','ip_derived_h3']) as parameter_id
),
actual AS (
  SELECT parameter_id,
    COUNT(DISTINCT maille_id) as n_mailles,
    ROUND(COUNT(DISTINCT maille_id)::numeric * 100.0 / 29407, 2) as pct
  FROM atlas.ai_interpolation_values
  WHERE COALESCE(is_superseded, false) = false
  GROUP BY parameter_id
)
SELECT
  e.parameter_id,
  CASE WHEN a.parameter_id IS NOT NULL THEN 'PRESENT' ELSE 'ABSENT' END as statut,
  COALESCE(a.n_mailles::text, '0') as n_mailles,
  CASE
    WHEN a.n_mailles = 29407 THEN 'COMPLET 100%'
    WHEN a.parameter_id IS NULL THEN 'MANQUANT'
    ELSE 'PARTIEL ' || a.pct || '%'
  END as evaluation
FROM expected_derived e
LEFT JOIN actual a USING (parameter_id);
"

# ─── ÉTAPE 2C : Paramètres moyens _avg ─────────────────────────
Run-Query "ETAPE 2C - PARAMETRES MOYENS _avg" "
WITH expected_avg AS (
  SELECT unnest(ARRAY[
    'vbs_avg','ip_avg','eg_avg','wl_avg','wp_avg',
    'passant_2mm_avg','passant_80um_avg'
  ]) as parameter_id
),
actual AS (
  SELECT parameter_id, method,
    COUNT(DISTINCT maille_id) as n_mailles,
    ROUND(COUNT(DISTINCT maille_id)::numeric * 100.0 / 29407, 2) as pct,
    ROUND(AVG(value)::numeric, 4) as avg_val
  FROM atlas.ai_interpolation_values
  WHERE COALESCE(is_superseded, false) = false
  GROUP BY parameter_id, method
)
SELECT
  e.parameter_id,
  COALESCE(a.method, 'ABSENT') as methode,
  COALESCE(a.n_mailles::text, '0') as n_mailles,
  COALESCE(a.avg_val::text, 'N/A') as valeur_moy,
  CASE
    WHEN a.n_mailles = 29407 THEN 'COMPLET 100%'
    WHEN a.n_mailles > 5000  THEN 'PARTIEL ' || a.pct || '%'
    WHEN a.n_mailles > 0     THEN 'TRES PARTIEL ' || a.pct || '%'
    WHEN a.parameter_id IS NULL THEN 'ABSENT'
    ELSE 'VIDE'
  END as evaluation
FROM expected_avg e
LEFT JOIN actual a ON a.parameter_id = e.parameter_id
ORDER BY e.parameter_id;
"

# ─── ÉTAPE 3A : Variogrammes ────────────────────────────────────
Run-Query "ETAPE 3A - ETAT DES VARIOGRAMMES KED" "
WITH expected_ked AS (
  SELECT unnest(ARRAY[
    'vbs_ked_h1','vbs_ked_h2','vbs_ked_h3',
    'ip_ked_h1','ip_ked_h2','ip_ked_h3',
    'eg_ked_h1','eg_ked_h2','eg_ked_h3',
    'wl_ked_h1','wl_ked_h2','wl_ked_h3',
    'wp_ked_h1','wp_ked_h2','wp_ked_h3',
    'passant_2mm_ked_h1','passant_2mm_ked_h2','passant_2mm_ked_h3',
    'passant_80um_ked_h1','passant_80um_ked_h2','passant_80um_ked_h3'
  ]) as parameter_id
),
best_vario AS (
  SELECT DISTINCT ON (parameter_id)
    parameter_id, nugget, sill, range_m, loo_rmse, model_type
  FROM atlas.ai_variograms
  WHERE nugget IS NOT NULL
  ORDER BY parameter_id, created_at DESC
)
SELECT
  e.parameter_id,
  CASE WHEN v.parameter_id IS NOT NULL THEN 'VARIO OK' ELSE 'PAS DE VARIO' END as statut,
  ROUND(v.nugget::numeric, 4) as nugget,
  ROUND(v.sill::numeric, 4) as sill,
  ROUND(v.range_m::numeric / 1000, 1) as portee_km,
  ROUND(v.loo_rmse::numeric, 4) as loo_rmse,
  v.model_type
FROM expected_ked e
LEFT JOIN best_vario v USING (parameter_id)
ORDER BY e.parameter_id;
"

# ─── ÉTAPE 3B : LOO RMSE qualité ───────────────────────────────
Run-Query "ETAPE 3B - LOO RMSE QUALITE INTERPOLATION" "
SELECT DISTINCT ON (parameter_id)
  parameter_id,
  ROUND(loo_rmse::numeric, 3) as loo_rmse,
  ROUND(nugget::numeric, 4) as nugget,
  ROUND(sill::numeric, 4) as sill,
  ROUND(range_m::numeric/1000, 1) as portee_km,
  model_type,
  CASE
    WHEN parameter_id LIKE 'vbs%' AND loo_rmse < 2 THEN 'Excellent'
    WHEN parameter_id LIKE 'vbs%' AND loo_rmse < 4 THEN 'Bon'
    WHEN parameter_id LIKE 'vbs%' AND loo_rmse < 6 THEN 'Acceptable'
    WHEN parameter_id LIKE 'vbs%'                  THEN 'Faible'
    WHEN parameter_id LIKE 'ip%'  AND loo_rmse < 5  THEN 'Excellent'
    WHEN parameter_id LIKE 'ip%'  AND loo_rmse < 10 THEN 'Bon'
    WHEN parameter_id LIKE 'ip%'  AND loo_rmse < 15 THEN 'Acceptable'
    WHEN parameter_id LIKE 'ip%'                    THEN 'Faible'
    WHEN parameter_id LIKE 'eg%'  AND loo_rmse < 2  THEN 'Excellent'
    WHEN parameter_id LIKE 'eg%'  AND loo_rmse < 4  THEN 'Bon'
    WHEN parameter_id LIKE 'eg%'                    THEN 'Acceptable'
    WHEN parameter_id LIKE 'wl%'  AND loo_rmse < 10 THEN 'Bon'
    WHEN parameter_id LIKE 'wl%'  AND loo_rmse < 20 THEN 'Acceptable'
    WHEN parameter_id LIKE 'wp%'  AND loo_rmse < 7  THEN 'Bon'
    WHEN parameter_id LIKE 'wp%'  AND loo_rmse < 15 THEN 'Acceptable'
    WHEN parameter_id LIKE 'passant%' AND loo_rmse < 10 THEN 'Bon'
    WHEN parameter_id LIKE 'passant%' AND loo_rmse < 20 THEN 'Acceptable'
    ELSE 'Evaluer manuellement'
  END as qualite
FROM atlas.ai_variograms
WHERE parameter_id LIKE '%ked%'
  AND nugget IS NOT NULL
  AND loo_rmse IS NOT NULL
ORDER BY parameter_id, created_at DESC;
"

# ─── ÉTAPE 4B : Données source AMESSEFE ─────────────────────────
Run-Query "ETAPE 4B - DONNEES SOURCE PAR PARAMETRE/HORIZON" "
SELECT
  'VBS' as parametre,
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 0.8 AND 1.2 THEN 1 ELSE 0 END) as n_h1,
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 1.3 AND 1.7 THEN 1 ELSE 0 END) as n_h2,
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 1.8 AND 2.2 THEN 1 ELSE 0 END) as n_h3,
  COUNT(*) as total
FROM atlas.essais_vbs ev
JOIN atlas.echantillons e ON e.id = ev.echantillon_id
JOIN atlas.sondages s ON s.id = e.sondage_id
WHERE s.deleted_at IS NULL AND ev.vbs IS NOT NULL
UNION ALL
SELECT 'WL/WP',
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 0.8 AND 1.2 THEN 1 ELSE 0 END),
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 1.3 AND 1.7 THEN 1 ELSE 0 END),
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 1.8 AND 2.2 THEN 1 ELSE 0 END),
  COUNT(*)
FROM atlas.essais_atterberg ea
JOIN atlas.echantillons e ON e.id = ea.echantillon_id
JOIN atlas.sondages s ON s.id = e.sondage_id
WHERE s.deleted_at IS NULL AND ea.wl IS NOT NULL AND ea.wp IS NOT NULL
UNION ALL
SELECT 'EG (Gonflement)',
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 0.8 AND 1.2 THEN 1 ELSE 0 END),
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 1.3 AND 1.7 THEN 1 ELSE 0 END),
  SUM(CASE WHEN e.profondeur::numeric BETWEEN 1.8 AND 2.2 THEN 1 ELSE 0 END),
  COUNT(*)
FROM atlas.essais_potentiel_gonflement epg
JOIN atlas.echantillons e ON e.id = epg.echantillon_id
JOIN atlas.sondages s ON s.id = e.sondage_id
WHERE s.deleted_at IS NULL
ORDER BY parametre;
"

# ─── ÉTAPE 5 : Bornes physiques ─────────────────────────────────
Run-Query "ETAPE 5 - VERIFICATION BORNES PHYSIQUES" "
WITH bounds AS (
  SELECT * FROM (VALUES
    ('vbs_ked_h1',0.0,15.0,'g/100g'),('vbs_ked_h2',0.0,15.0,'g/100g'),('vbs_ked_h3',0.0,15.0,'g/100g'),
    ('ip_ked_h1',0.0,60.0,'%'),('ip_ked_h2',0.0,60.0,'%'),('ip_ked_h3',0.0,60.0,'%'),
    ('eg_ked_h1',0.0,20.0,'%'),('eg_ked_h2',0.0,20.0,'%'),('eg_ked_h3',0.0,20.0,'%'),
    ('wl_ked_h1',10.0,100.0,'%'),('wl_ked_h2',10.0,100.0,'%'),('wl_ked_h3',10.0,100.0,'%'),
    ('wp_ked_h1',5.0,60.0,'%'),('wp_ked_h2',5.0,60.0,'%'),('wp_ked_h3',5.0,60.0,'%'),
    ('passant_2mm_ked_h1',0.0,100.0,'%'),('passant_2mm_ked_h2',0.0,100.0,'%'),('passant_2mm_ked_h3',0.0,100.0,'%'),
    ('passant_80um_ked_h1',0.0,100.0,'%'),('passant_80um_ked_h2',0.0,100.0,'%'),('passant_80um_ked_h3',0.0,100.0,'%')
  ) AS t(parameter_id,min_ok,max_ok,unite)
),
stats AS (
  SELECT parameter_id,
    COUNT(*) as total,
    COUNT(CASE WHEN value < 0 THEN 1 END) as n_negatifs,
    COUNT(CASE WHEN value = 0 THEN 1 END) as n_zero,
    ROUND(MIN(value)::numeric,4) as val_min,
    ROUND(AVG(value)::numeric,4) as val_avg,
    ROUND(MAX(value)::numeric,4) as val_max,
    ROUND(STDDEV(value)::numeric,4) as val_std
  FROM atlas.ai_interpolation_values
  WHERE COALESCE(is_superseded,false) = false
  GROUP BY parameter_id
)
SELECT b.parameter_id, b.unite,
  b.min_ok || '-' || b.max_ok as bornes,
  s.val_min, s.val_avg, s.val_max, s.val_std,
  s.n_negatifs as negatifs,
  CASE
    WHEN s.n_negatifs > 0 THEN 'ERREUR: ' || s.n_negatifs || ' valeurs negatives'
    WHEN s.val_max > b.max_ok THEN 'HORS MAX: val_max=' || s.val_max || ' > ' || b.max_ok
    WHEN s.val_min < b.min_ok THEN 'HORS MIN: val_min=' || s.val_min || ' < ' || b.min_ok
    ELSE 'OK dans bornes'
  END as anomalies
FROM bounds b
LEFT JOIN stats s USING (parameter_id)
ORDER BY b.parameter_id;
"

# ─── ÉTAPE 6A : WL > WP ─────────────────────────────────────────
Run-Query "ETAPE 6A - COHERENCE WL > WP (erreurs physiques)" "
SELECT
  COUNT(*) as n_erreurs_wl_lte_wp,
  COUNT(CASE WHEN wl.value <= wp.value THEN 1 END) as wl_inferieur_wp,
  MIN(wl.value - wp.value) as diff_min,
  AVG(wl.value - wp.value) as diff_avg,
  MAX(wl.value - wp.value) as diff_max
FROM atlas.ai_interpolation_values wl
JOIN atlas.ai_interpolation_values wp ON wl.maille_id = wp.maille_id
WHERE wl.parameter_id = 'wl_ked_h1'
  AND wp.parameter_id = 'wp_ked_h1'
  AND COALESCE(wl.is_superseded,false) = false
  AND COALESCE(wp.is_superseded,false) = false;
"

# ─── ÉTAPE 6B : Corrélation VBS-IP ─────────────────────────────
Run-Query "ETAPE 6B - CORRELATION VBS-IP" "
SELECT
  ROUND(CORR(vbs.value, ip.value)::numeric * 100) as corr_vbs_ip_pct,
  COUNT(*) as n_mailles,
  CASE
    WHEN CORR(vbs.value, ip.value) > 0.5 THEN 'Correlation forte (>50%) - OK'
    WHEN CORR(vbs.value, ip.value) > 0.3 THEN 'Correlation moderee (30-50%) - Acceptable'
    ELSE 'Correlation faible (<30%) - Verifier'
  END as analyse
FROM atlas.ai_interpolation_values vbs
JOIN atlas.ai_interpolation_values ip ON vbs.maille_id = ip.maille_id
WHERE vbs.parameter_id = 'vbs_ked_h1'
  AND ip.parameter_id = 'ip_ked_h1'
  AND COALESCE(vbs.is_superseded,false) = false
  AND COALESCE(ip.is_superseded,false) = false;
"

# ─── ÉTAPE 6C : Corrélation VBS-EG ─────────────────────────────
Run-Query "ETAPE 6C - CORRELATION VBS-EG" "
SELECT
  ROUND(CORR(vbs.value, eg.value)::numeric * 100) as corr_vbs_eg_pct,
  COUNT(*) as n_mailles,
  CASE
    WHEN CORR(vbs.value, eg.value) > 0.4 THEN 'Correlation forte (>40%) - Coherent'
    WHEN CORR(vbs.value, eg.value) > 0.2 THEN 'Correlation moderee - Acceptable'
    ELSE 'Correlation faible - Verifier'
  END as analyse
FROM atlas.ai_interpolation_values vbs
JOIN atlas.ai_interpolation_values eg ON vbs.maille_id = eg.maille_id
WHERE vbs.parameter_id = 'vbs_ked_h1'
  AND eg.parameter_id = 'eg_ked_h1'
  AND COALESCE(vbs.is_superseded,false) = false
  AND COALESCE(eg.is_superseded,false) = false;
"

# ─── ÉTAPE 7 : Diagnostic ip_ked vs ip_derived ──────────────────
Run-Query "ETAPE 7 - DIAGNOSTIC ip_ked vs ip_derived" "
SELECT
  (SELECT COUNT(DISTINCT maille_id) FROM atlas.ai_interpolation_values
   WHERE parameter_id = 'ip_ked_h1' AND COALESCE(is_superseded,false) = false) as n_ip_ked_h1,
  (SELECT COUNT(DISTINCT maille_id) FROM atlas.ai_interpolation_values
   WHERE parameter_id = 'ip_derived_h1' AND COALESCE(is_superseded,false) = false) as n_ip_derived_h1,
  (SELECT COUNT(DISTINCT maille_id) FROM atlas.ai_interpolation_values
   WHERE parameter_id = 'wl_ked_h1' AND COALESCE(is_superseded,false) = false) as n_wl_ked_h1,
  (SELECT COUNT(DISTINCT maille_id) FROM atlas.ai_interpolation_values
   WHERE parameter_id = 'wp_ked_h1' AND COALESCE(is_superseded,false) = false) as n_wp_ked_h1;
"

# ─── BONUS : Granulométrie tables disponibles ───────────────────
Run-Query "BONUS - VERIFIER TABLES GRANULO DISPONIBLES" "
SELECT table_name FROM information_schema.tables
WHERE table_schema = 'atlas'
  AND (table_name LIKE '%granulo%' OR table_name LIKE '%classif%'
    OR table_name LIKE '%passant%' OR table_name LIKE '%gonflement%'
    OR table_name LIKE '%atterberg%' OR table_name LIKE '%vbs%')
ORDER BY table_name;
"

Write-Host "`n=====================================================" -ForegroundColor Green
Write-Host "=== AUDIT KED TERMINE" -ForegroundColor Green
Write-Host "=====================================================" -ForegroundColor Green
