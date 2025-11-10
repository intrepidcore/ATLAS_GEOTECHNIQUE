# État des Migrations - 2025-11-07

## ✅ Migrations Complétées

### 1. **Table `sondages`** ✅
- `id`: TEXT → **UUID**
- `adm3_id`: TEXT → **INTEGER**
- `date`: TEXT → **DATE**
- `created_at`: TEXT → **TIMESTAMPTZ**
- `updated_at`: TEXT → **TIMESTAMPTZ**
- `deleted_at`: TEXT → **TIMESTAMPTZ**
- `is_geocoded`: **BOOLEAN GENERATED**
- **Fichier**: `fix_sondages_types.sql` + `fix_sondages_timestamps.sql`

### 2. **Schéma `atlas`** ✅
- Schéma créé
- Fonction `atlas.norm()` pour normalisation
- Fonction `atlas.norm_key()` pour clés
- Extension `unaccent` activée
- **Fichier**: `create_atlas_schema.sql`

### 3. **Table `adm3`** ✅
- `gid`: TEXT → **INTEGER** (PRIMARY KEY)
- Index sur `adm3_fr`, `adm3_pcode`, `adm2_fr`
- **Fichier**: `fix_adm3_types.sql`

### 4. **Table `echantillons`** ✅
- `id`: TEXT → **UUID**
- `sondage_id`: TEXT → **UUID** (FK vers sondages)
- `created_at`: TEXT → **TIMESTAMPTZ**
- `updated_at`: TEXT → **TIMESTAMPTZ**
- `depth_m`: TEXT → **NUMERIC**
- `rho_s_gcm3`: TEXT → **NUMERIC**
- `water_content_w`: TEXT → **NUMERIC**
- `date`: TEXT → **DATE**
- **Fichier**: `fix_echantillons_simple.sql`

### 5. **Vue Matérialisée `mv_mailles_geotech`** ✅
- Recréée après chaque migration
- Index GIST sur `geom_4326`
- Index unique sur `id`

---

## ⚠️ Tables Restantes (types TEXT à corriger)

### Tables d'essais (non critiques pour l'affichage de base)
- `essais_atterberg` (id, echantillon_id, wl, wp, ip_generated, created_at)
- `essais_vbs` (id, echantillon_id, vbs, created_at)
- `essais_classif` (id, essai_id, created_at, updated_at, deleted_at)
- `essais_geotechniques` (id, sondage_id, depth_m, wl, wp, ip, vbs, gamma_d_max, w_opt, test_date, created_at, updated_at, deleted_at)
- `essais_physiques` (id, essai_id, densite_absolue_gcm3, densite_apparente_gcm3, teneur_eau_pct, measured_at, created_at, updated_at, deleted_at)
- `granulo_points` (id, echantillon_id, sieve_mm, passing_pct, created_at)

### Tables administratives
- `mailles` (id, updated_at)
- `adm1`, `adm2` (probablement pas utilisées directement)

---

## 🧪 Tests API Réussis

### `/sondages/stats` ✅
```json
{
  "total": 230,
  "geocoded": 1,
  "with_geom": 1,
  "with_adm3": 0,
  "missing_geom": 229,
  "missing_adm3": 230
}
```

### `/sondages?limit=3` ✅
Retourne les sondages avec types corrects (UUID, dates ISO8601)

### `/sondages/:id/adm3-candidates` ✅
```json
{
  "survey_id": "b87f4500-9665-4ebd-85fb-623711881de9",
  "localite": "TCHAMDE",
  "candidates": [
    {"adm3_id": 328, "gid": 328, "name": "Tchamba", "score": 0.45454547},
    ...
  ]
}
```

---

## 📝 Prochaines Étapes

1. **Tester l'UI** - Vérifier que les sondages s'affichent et que le géocodage fonctionne
2. **Migrer les tables d'essais** (si nécessaire pour les graphiques/détails)
3. **Migrer `mailles`** (si nécessaire pour les statistiques)
4. **Tests de bout en bout** - Workflow complet de géocodage

---

## 🔧 Scripts de Migration Disponibles

- `fix_sondages_types.sql` - Types principaux de sondages
- `fix_sondages_timestamps.sql` - Timestamps de sondages
- `create_atlas_schema.sql` - Schéma et fonctions
- `fix_adm3_types.sql` - Table adm3
- `fix_echantillons_simple.sql` - Table echantillons
- `run_migration_docker.ps1` - Script PowerShell pour exécution
