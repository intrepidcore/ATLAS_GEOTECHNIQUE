# 🧪 Guide de Test - Import Bulk Phase 1

**Date:** 19 octobre 2025  
**Version:** 1.0  
**Statut:** ✅ Prêt pour tests

---

## 🚀 Démarrage Rapide

### 1. Lancer la stack complète

```powershell
cd c:\PROJET_ATLAS_MASTER\atlas
.\scripts\quick-start.ps1
```

Ceci démarre :
- 🐳 PostgreSQL/PostGIS (port 5432)
- 🦀 API Rust (port 8001)
- 🎨 Frontend Vite (port 5173)

### 2. Vérifier que tout fonctionne

```powershell
# Santé API
curl http://localhost:8001/healthz

# Version
curl http://localhost:8001/version
```

### 3. Lancer le test automatisé

```powershell
cd scripts
.\test-import-bulk.ps1
```

Ce script va :
1. ✅ Vérifier l'API
2. 🔍 Faire un dry-run (prévisualisation)
3. 🚀 Lancer un import réel
4. 📊 Suivre le statut
5. 💾 Télécharger le rapport

---

## 📝 Tests Manuels

### Test 1: Dry-Run (Prévisualisation)

```powershell
# Créer config.json
@"
{
  "format": "csv",
  "mapping": {
    "structure": "long",
    "localite_col": "localite",
    "type_essai_col": "type",
    "profondeur_col": "profondeur_m",
    "valeur_col": "valeur",
    "unite_col": "unite",
    "date_col": "date",
    "source_col": "source",
    "operator_col": "operator",
    "adm3_col": "adm3"
  },
  "geolocation": {
    "mode": "centroid",
    "seed": 42
  },
  "dry_run": true
}
"@ | Out-File -Encoding UTF8 config.json

# Lancer dry-run
curl.exe -X POST "http://localhost:8001/surveys/bulk-import/dry-run" `
  -F "file=@..\data\test_import_mini.csv" `
  -F "config=@config.json;type=application/json"
```

**Résultat attendu:**
```json
{
  "valid": true,
  "stats": {
    "total_rows": 8,
    "sondages": 2,
    "essais": 8,
    "warnings": 0,
    "errors": 0
  },
  "preview": [...],
  "warnings": [],
  "errors": []
}
```

### Test 2: Import Async

```powershell
# Lancer import
$result = curl.exe -s -X POST "http://localhost:8001/surveys/bulk-import/async" `
  -F "file=@..\data\test_import_mini.csv" `
  -F "config=@config.json;type=application/json" | ConvertFrom-Json

$jobId = $result.job_id
Write-Host "Job ID: $jobId"

# Suivre le statut
curl "http://localhost:8001/surveys/bulk-import/status/$jobId"
```

**Statuts possibles:**
- `pending` → En attente
- `running` → En cours
- `succeeded` → ✅ Réussi
- `failed` → ❌ Échoué
- `partial` → ⚠️ Partiel (certaines lignes ont échoué)
- `cancelled` → 🚫 Annulé

### Test 3: Annuler un Import

```powershell
curl.exe -X POST "http://localhost:8001/surveys/bulk-import/cancel/$jobId"
```

### Test 4: Télécharger le Rapport

```powershell
# Format CSV
curl.exe -o report.csv "http://localhost:8001/surveys/bulk-import/report/$jobId?format=csv"

# Format JSON
curl "http://localhost:8001/surveys/bulk-import/report/$jobId"
```

### Test 5: Télécharger un Template

```powershell
# Template Granulométrie
curl.exe -o template_granulo.csv "http://localhost:8001/surveys/bulk-import/templates/granulometrie"

# Template VBS
curl.exe -o template_vbs.csv "http://localhost:8001/surveys/bulk-import/templates/vbs"

# Template Atterberg
curl.exe -o template_atterberg.csv "http://localhost:8001/surveys/bulk-import/templates/atterberg"
```

---

## 🗄️ Vérifications Base de Données

### Connexion PostgreSQL

```powershell
docker exec -it atlas-db psql -U atlas -d atlas
```

### Requêtes Utiles

```sql
-- Compter les imports
SELECT COUNT(*) FROM imports;

-- Voir les imports récents
SELECT id, filename, status, stats_json->>'sondages' as sondages, 
       stats_json->>'essais' as essais, created_at
FROM imports
ORDER BY created_at DESC
LIMIT 10;

-- Compter les sondages importés
SELECT COUNT(*) FROM sondages WHERE import_id IS NOT NULL;

-- Compter les essais importés
SELECT COUNT(*) FROM essais WHERE is_from_import = true;

-- Voir les types d'essais importés
SELECT type, COUNT(*) 
FROM essais 
WHERE is_from_import = true
GROUP BY type
ORDER BY COUNT(*) DESC;

-- Vérifier les géométries
SELECT 
    location_mode,
    COUNT(*),
    ST_SRID(geom) as srid,
    GeometryType(geom) as geom_type
FROM sondages
WHERE import_id IS NOT NULL
GROUP BY location_mode, ST_SRID(geom), GeometryType(geom);

-- Voir les erreurs d'import
SELECT import_id, row_idx, status, error_msg, warning_msg
FROM import_items
WHERE status IN ('error', 'warning')
ORDER BY import_id DESC, row_idx
LIMIT 20;

-- Statistiques par import
SELECT 
    i.filename,
    i.status,
    COUNT(DISTINCT ii.created_survey_id) as surveys_created,
    SUM(ii.created_tests_count) as tests_created,
    COUNT(*) FILTER (WHERE ii.status = 'error') as errors,
    COUNT(*) FILTER (WHERE ii.status = 'warning') as warnings
FROM imports i
LEFT JOIN import_items ii ON ii.import_id = i.id
GROUP BY i.id, i.filename, i.status
ORDER BY i.created_at DESC;
```

---

## 🎯 Scénarios de Test

### Scénario 1: Import Simple (Format Long)

**Fichier:** `test_import_mini.csv` (8 lignes)
- 2 sondages (Adjengré, Akéi)
- 8 essais (Granulométrie, VBS, Atterberg)
- Mode: Centroid
- Résultat attendu: 100% succès

### Scénario 2: Import avec Warnings

Créer un CSV avec valeurs hors plage:
```csv
localite,type,profondeur_m,valeur,unite,date,source,operator,adm3
Test,Granulometrie,1.0,150,%,2024-01-15,Lab,Op,Sotouboua
```

Résultat attendu: Warning "Valeur hors plage: 150% (attendu: [0, 100])"

### Scénario 3: Import avec Erreurs

Créer un CSV avec données invalides:
```csv
localite,type,profondeur_m,valeur,unite,date,source,operator,adm3
,TypeInconnu,abc,xyz,%,invalid-date,Lab,Op,
```

Résultat attendu: Erreurs de validation

### Scénario 4: Import Format Large

```csv
localite,1,1.5,2,date,source,adm3
Adjengré,77.73,81.8,74.85,2024-01-15,LNBTP,Sotouboua
```

Config:
```json
{
  "mapping": {
    "structure": "large",
    "type_essai": "Granulometrie",
    "profondeur_cols": ["1", "1.5", "2"],
    ...
  }
}
```

### Scénario 5: Modes de Géolocalisation

Tester chaque mode:
- `exact` → Avec lon/lat dans le CSV
- `centroid` → Centroïde de l'ADM3
- `random` → Point aléatoire dans l'ADM3 (déterministe avec seed)
- `unknown` → Pas de géométrie (NULL)
- `maille` → Centroïde de la maille

---

## 🐛 Dépannage

### Erreur: "API non accessible"

```powershell
# Vérifier que Docker tourne
docker ps

# Voir les logs
docker compose logs api-geo

# Redémarrer
docker compose restart api-geo
```

### Erreur: "Database connection refused"

```powershell
# Vérifier PostgreSQL
docker compose logs db

# Redémarrer la DB
docker compose restart db
```

### Erreur: "Column does not exist"

La migration 009 n'est peut-être pas appliquée:

```powershell
# Appliquer la migration
Get-Content db\migrations\009_import_bulk.sql | docker exec -i atlas-db psql -U atlas -d atlas
```

### Erreur: "Extension unaccent does not exist"

```sql
-- Dans psql
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;
```

### Performances lentes (Matching ADM3)

```sql
-- Créer index trigram
CREATE INDEX IF NOT EXISTS idx_adm3_name_trgm 
ON adm3 USING gin (unaccent(lower(name)) gin_trgm_ops);
```

---

## 📊 Métriques de Performance

### Objectifs Phase 1

- ✅ Import < 1000 lignes: < 5 secondes
- ✅ Dry-run: < 2 secondes
- ✅ Matching ADM3: < 100ms par localité
- ✅ Validation: < 10ms par ligne

### Mesurer les Performances

```sql
-- Durée des imports
SELECT 
    filename,
    EXTRACT(EPOCH FROM (completed_at - started_at)) as duration_seconds,
    (stats_json->>'total_rows')::int as rows,
    (stats_json->>'total_rows')::int / EXTRACT(EPOCH FROM (completed_at - started_at)) as rows_per_second
FROM imports
WHERE status = 'succeeded'
ORDER BY created_at DESC;
```

---

## ✅ Checklist de Validation

Avant de passer en Phase 2:

- [ ] ✅ Dry-run fonctionne
- [ ] ✅ Import async fonctionne
- [ ] ✅ Statut job fonctionne
- [ ] ✅ Annulation fonctionne
- [ ] ✅ Rapport CSV/JSON fonctionne
- [ ] ✅ Templates téléchargeables
- [ ] ✅ Sondages créés en base
- [ ] ✅ Essais créés en base
- [ ] ✅ Géométries correctes (SRID 25231)
- [ ] ✅ Traçabilité (import_id, row_idx)
- [ ] ✅ Matching ADM3 fonctionne
- [ ] ✅ Validation valeurs fonctionne
- [ ] ✅ Fingerprint anti-doublon fonctionne
- [ ] ✅ Logs structurés
- [ ] ✅ Gestion erreurs vs warnings

---

## 🚀 Prochaines Étapes (Phase 2)

1. **Profils de Mapping** - Sauvegarder/réutiliser configurations
2. **Support XLSX** - Parser Excel avec `calamine`
3. **Chunking** - Gros fichiers (>10k lignes)
4. **Job Queue** - Traitement asynchrone vrai (tokio channels)
5. **UI Frontend** - Composant d'upload + suivi
6. **Tests automatisés** - Tests d'intégration Rust
7. **Mode Offline SQLx** - `cargo sqlx prepare`
8. **Optimisations** - Cache ADM, batch inserts

---

## 📚 Références

- **Cahier des charges:** `docs/CAHIER_CHARGES_IMPORT_BULK.md`
- **Décisions techniques:** `docs/IMPORT_BULK_DECISIONS.md`
- **Contrat DB:** `docs/DB_CONTRACT_v1.4.0.md`
- **Code source:** `services/api-geo/src/import_bulk/`
- **Migration SQL:** `db/migrations/009_import_bulk.sql`
