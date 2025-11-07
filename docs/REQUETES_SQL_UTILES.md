# 📊 REQUÊTES SQL UTILES - Atlas Géotechnique

**Date:** 2025-11-06  
**Usage:** Copier-coller directement dans psql ou pgAdmin

---

## 🔍 DIAGNOSTICS

### KPI Sondages (Niveau Unitaire)

```sql
-- Vue d'ensemble
SELECT 
  COUNT(*) as total_sondages,
  COUNT(*) FILTER (WHERE localite IS NOT NULL) as avec_localite,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geom,
  COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as avec_adm3,
  COUNT(*) FILTER (WHERE location_mode = 'exact') as mode_exact,
  COUNT(*) FILTER (WHERE location_mode = 'adm_random_cell') as mode_adm,
  COUNT(*) FILTER (WHERE location_mode = 'unknown') as mode_unknown,
  COUNT(*) FILTER (WHERE deleted_at IS NULL) as actifs
FROM sondages;
```

### KPI Localités (Niveau Agrégé)

```sql
-- Vue d'ensemble canonique
SELECT 
  COUNT(*) as total_localites,
  COUNT(*) FILTER (WHERE has_geom) as avec_geom,
  COUNT(*) FILTER (WHERE has_adm3) as avec_adm3,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  SUM(nb_sondages_source) as total_sondages_source
FROM atlas.surveys;
```

### Top 20 Localités par Nb Sondages

```sql
SELECT 
  COALESCE(localite, 'INCONNU') as localite,
  COUNT(*) as nb_sondages,
  COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geom,
  COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as avec_adm3,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  array_agg(DISTINCT code ORDER BY code) FILTER (WHERE code IS NOT NULL) as codes_sample
FROM sondages
WHERE deleted_at IS NULL
GROUP BY COALESCE(localite, 'INCONNU')
ORDER BY nb_sondages DESC
LIMIT 20;
```

### Répartition par Source

```sql
SELECT 
  source,
  COUNT(*) as nb_sondages,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_geocoded) / COUNT(*), 1) as pct_geocodes
FROM sondages
WHERE deleted_at IS NULL
GROUP BY source
ORDER BY nb_sondages DESC;
```

---

## 🔎 RECHERCHE

### Rechercher un Sondage par Code

```sql
SELECT 
  id, code, localite, adm3_name,
  CASE WHEN geom IS NOT NULL THEN 'OUI' ELSE 'NON' END as geom_present,
  is_geocoded, location_mode, date, source
FROM sondages
WHERE atlas.norm(code) LIKE '%' || atlas.norm('KOMAH') || '%'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Rechercher par Localité

```sql
SELECT 
  id, code, localite, adm3_name, is_geocoded, location_mode
FROM sondages
WHERE atlas.norm(localite) LIKE '%' || atlas.norm('Ountivou') || '%'
  AND deleted_at IS NULL
ORDER BY created_at DESC;
```

### Sondages Sans Géométrie

```sql
SELECT 
  id, code, localite, adm3_name, location_mode, date
FROM sondages
WHERE geom IS NULL
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

### Sondages Sans ADM3

```sql
SELECT 
  id, code, localite, location_mode, date
FROM sondages
WHERE adm3_id IS NULL
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

### Sondages Non Géocodés (ni geom ni ADM3)

```sql
SELECT 
  id, code, localite, location_mode, date, source
FROM sondages
WHERE NOT is_geocoded
  AND deleted_at IS NULL
ORDER BY created_at DESC
LIMIT 50;
```

---

## 🎯 GÉOCODAGE

### Candidats ADM3 pour un Sondage

```sql
-- Par ID
SELECT 
  a.gid as adm3_id,
  a.adm3_fr as name,
  a.adm3_pcode as code,
  a.adm2_fr as adm2_name,
  similarity(atlas.norm(a.adm3_fr), atlas.norm(s.localite)) as score
FROM sondages s
CROSS JOIN adm3 a
WHERE s.id = 'UUID_SONDAGE'
  AND similarity(atlas.norm(a.adm3_fr), atlas.norm(s.localite)) > 0.3
ORDER BY score DESC
LIMIT 5;

-- Par Localité
SELECT 
  gid as adm3_id,
  adm3_fr as name,
  adm3_pcode as code,
  adm2_fr as adm2_name,
  similarity(atlas.norm(adm3_fr), atlas.norm('Komah')) as score
FROM adm3
WHERE similarity(atlas.norm(adm3_fr), atlas.norm('Komah')) > 0.3
ORDER BY score DESC
LIMIT 5;
```

### Géocoder un Sondage (ADM3)

```sql
-- Trouver ADM3
SELECT gid, adm3_fr, adm3_pcode FROM adm3 WHERE adm3_fr ILIKE '%Komah%';

-- Update sondage
UPDATE sondages
SET 
  adm3_id = (SELECT gid FROM adm3 WHERE adm3_fr = 'Komah' LIMIT 1),
  location_mode = 'adm_random_cell',
  updated_at = NOW()
WHERE id = 'UUID_SONDAGE';

-- Vérifier
SELECT id, code, localite, adm3_id, is_geocoded, location_mode
FROM sondages
WHERE id = 'UUID_SONDAGE';
```

### Géocoder un Sondage (Géométrie Exacte)

```sql
-- Update avec coordonnées (lon, lat)
UPDATE sondages
SET 
  geom = ST_SetSRID(ST_MakePoint(1.2345, 6.1234), 25231),
  location_mode = 'exact',
  updated_at = NOW()
WHERE id = 'UUID_SONDAGE';

-- Vérifier
SELECT 
  id, code, localite,
  ST_AsText(geom) as geom_wkt,
  is_geocoded, location_mode
FROM sondages
WHERE id = 'UUID_SONDAGE';
```

---

## 🔄 MAINTENANCE

### Refresh Vues Matérialisées

```sql
-- Refresh MV sondages unifiés
REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;

-- Refresh tables canoniques
SELECT atlas.refresh_surveys();

-- Vérifier
SELECT 
  COUNT(*) as total_surveys,
  COUNT(*) FILTER (WHERE has_geom) as avec_geom,
  COUNT(*) FILTER (WHERE has_adm3) as avec_adm3
FROM atlas.surveys;
```

### Backfill Localite

```sql
-- Backfill depuis code
UPDATE sondages
SET localite = extract_localite(code)
WHERE localite IS NULL 
  AND code IS NOT NULL
  AND deleted_at IS NULL;

-- Vérifier
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE localite IS NOT NULL) as avec_localite
FROM sondages;
```

### Synchroniser adm3_name

```sql
-- Sync depuis adm3 table
UPDATE sondages s
SET adm3_name = a.adm3_fr
FROM adm3 a
WHERE s.adm3_id = a.gid
  AND (s.adm3_name IS NULL OR s.adm3_name != a.adm3_fr);

-- Vérifier
SELECT 
  COUNT(*) as total_avec_adm3,
  COUNT(*) FILTER (WHERE adm3_name IS NOT NULL) as avec_adm3_name
FROM sondages
WHERE adm3_id IS NOT NULL;
```

---

## 📊 ANALYSES

### Distribution Géographique (ADM1)

```sql
SELECT 
  COALESCE(adm1_name, 'INCONNU') as region,
  COUNT(*) as nb_sondages,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_geocoded) / COUNT(*), 1) as pct_geocodes
FROM sondages
WHERE deleted_at IS NULL
GROUP BY COALESCE(adm1_name, 'INCONNU')
ORDER BY nb_sondages DESC;
```

### Distribution Géographique (ADM2)

```sql
SELECT 
  COALESCE(adm2_name, 'INCONNU') as prefecture,
  COUNT(*) as nb_sondages,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes,
  ROUND(100.0 * COUNT(*) FILTER (WHERE is_geocoded) / COUNT(*), 1) as pct_geocodes
FROM sondages
WHERE deleted_at IS NULL
GROUP BY COALESCE(adm2_name, 'INCONNU')
ORDER BY nb_sondages DESC;
```

### Évolution Temporelle

```sql
SELECT 
  DATE_TRUNC('month', created_at) as mois,
  COUNT(*) as nb_sondages,
  COUNT(*) FILTER (WHERE is_geocoded) as geocodes
FROM sondages
WHERE deleted_at IS NULL
  AND created_at >= NOW() - INTERVAL '12 months'
GROUP BY DATE_TRUNC('month', created_at)
ORDER BY mois DESC;
```

### Qualité des Données

```sql
SELECT 
  'Total sondages' as metrique,
  COUNT(*)::text as valeur
FROM sondages
WHERE deleted_at IS NULL

UNION ALL

SELECT 
  'Avec code',
  COUNT(*)::text
FROM sondages
WHERE code IS NOT NULL AND deleted_at IS NULL

UNION ALL

SELECT 
  'Avec localite',
  COUNT(*)::text
FROM sondages
WHERE localite IS NOT NULL AND deleted_at IS NULL

UNION ALL

SELECT 
  'Avec date',
  COUNT(*)::text
FROM sondages
WHERE date IS NOT NULL AND deleted_at IS NULL

UNION ALL

SELECT 
  'Avec source',
  COUNT(*)::text
FROM sondages
WHERE source IS NOT NULL AND deleted_at IS NULL

UNION ALL

SELECT 
  'Géocodés',
  COUNT(*)::text
FROM sondages
WHERE is_geocoded AND deleted_at IS NULL;
```

---

## 🧪 ESSAIS

### Sondages avec Essais

```sql
SELECT 
  s.id,
  s.code,
  s.localite,
  COUNT(DISTINCT e.id) as nb_echantillons,
  COUNT(DISTINCT eg.id) as nb_essais_geotech,
  COUNT(DISTINCT c.id) as nb_classifications
FROM sondages s
LEFT JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN classifications c ON c.sondage_id = s.id
WHERE s.deleted_at IS NULL
GROUP BY s.id, s.code, s.localite
HAVING COUNT(DISTINCT e.id) > 0
ORDER BY nb_echantillons DESC
LIMIT 20;
```

### Détail Essais pour un Sondage

```sql
-- Échantillons
SELECT 
  id, profondeur_m, type_sol, created_at
FROM echantillons
WHERE sondage_id = 'UUID_SONDAGE'
ORDER BY profondeur_m;

-- Atterberg
SELECT 
  e.profondeur_m,
  a.wl, a.wp, a.ip
FROM essais_atterberg a
JOIN echantillons e ON e.id = a.echantillon_id
WHERE e.sondage_id = 'UUID_SONDAGE'
ORDER BY e.profondeur_m;

-- Proctor
SELECT 
  e.profondeur_m,
  p.wopn, p.gamma_opn
FROM essais_proctor p
JOIN echantillons e ON e.id = p.echantillon_id
WHERE e.sondage_id = 'UUID_SONDAGE'
ORDER BY e.profondeur_m;

-- VBS
SELECT 
  e.profondeur_m,
  v.vbs
FROM essais_vbs v
JOIN echantillons e ON e.id = v.echantillon_id
WHERE e.sondage_id = 'UUID_SONDAGE'
ORDER BY e.profondeur_m;
```

---

## 🔧 UTILITAIRES

### Vérifier Extensions

```sql
SELECT 
  extname, extversion
FROM pg_extension
WHERE extname IN ('postgis', 'unaccent', 'pg_trgm');
```

### Vérifier Fonctions Atlas

```sql
SELECT 
  p.proname as function_name,
  pg_get_function_arguments(p.oid) as arguments
FROM pg_proc p
JOIN pg_namespace n ON p.pronamespace = n.oid
WHERE n.nspname = 'atlas'
ORDER BY p.proname;
```

### Taille Tables

```sql
SELECT 
  schemaname,
  tablename,
  pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) as size
FROM pg_tables
WHERE schemaname IN ('public', 'atlas')
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC
LIMIT 20;
```

### Index Manquants (Suggestions)

```sql
SELECT 
  schemaname,
  tablename,
  attname,
  n_distinct,
  correlation
FROM pg_stats
WHERE schemaname IN ('public', 'atlas')
  AND tablename = 'sondages'
  AND n_distinct > 100
ORDER BY n_distinct DESC;
```

---

## 📝 NOTES

### Normalisation

```sql
-- Test atlas.norm()
SELECT 
  'Adjengré  ' as original,
  atlas.norm('Adjengré  ') as normalise;
-- Résultat: "adjengre"

-- Test extract_localite()
SELECT 
  'GRANULO-KOMAH' as code,
  extract_localite('GRANULO-KOMAH') as localite;
-- Résultat: "KOMAH"
```

### Similarité

```sql
-- Test similarity()
SELECT 
  'Komah' as search,
  adm3_fr as name,
  similarity(atlas.norm(adm3_fr), atlas.norm('Komah')) as score
FROM adm3
WHERE similarity(atlas.norm(adm3_fr), atlas.norm('Komah')) > 0.3
ORDER BY score DESC
LIMIT 10;
```

---

## 🚀 COMMANDES RAPIDES

```bash
# Se connecter à la DB
docker exec -it atlas-db psql -U atlas atlas_clean

# Exécuter un fichier SQL
cat migrations/backfill_localite.sql | docker exec -i atlas-db psql -U atlas atlas_clean

# Exécuter une requête inline
docker exec -i atlas-db psql -U atlas atlas_clean -c "SELECT COUNT(*) FROM sondages;"

# Export CSV
docker exec -i atlas-db psql -U atlas atlas_clean -c "COPY (SELECT * FROM sondages WHERE deleted_at IS NULL) TO STDOUT WITH CSV HEADER;" > sondages.csv
```

---

**FIN DES REQUÊTES SQL UTILES**
