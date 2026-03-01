# 📋 RAPPORT TECHNIQUE ATLAS - SYSTÈME DE GÉOCODAGE ET INTÉGRATION UI

## 🎯 RÉSUMÉ EXÉCUTIF

**Problème principal identifié :** 99.6% des sondages (229/230) n'ont pas de géométrie, rendant impossible l'édition et le zoom cartographique.

**Cause racine :** Le système de géocodage existe mais n'est pas appliqué automatiquement lors de l'import des données.

---

## 1️⃣ INVENTAIRE DES TABLES GÉOTECHNIQUES

### Tables principales identifiées :
- ✅ **sondages** (230 lignes) - Table principale avec géométries manquantes
- ✅ **mailles** (29,407 lignes) - Grille spatiale complète avec géométries
- ✅ **echantillons** (946 lignes) - Liés aux sondages
- ✅ **essais_*** (1,192 lignes total) - Données géotechniques
- ✅ **raw_lab_*** (565 lignes) - Données brutes laboratoire

### Structure des contraintes :
```sql
-- Clés primaires : Toutes les tables ont une PK UUID sauf ref_types_essais
-- Clés étrangères : echantillons.sondage_id → sondages.id
-- Index spatiaux : GIST sur geom (sondages, mailles)
-- Géométries : SRID 25231 (UTM Zone 31N) pour sondages, 4326 pour mailles
```

---

## 2️⃣ SYSTÈME DE GÉOCODAGE BACKEND

### Endpoints identifiés :
- `POST /surveys/{id}/geocode` - Géocodage manuel
- `GET /geocode/suggestions` - Suggestions automatiques  
- `POST /geocode/apply-accepted` - Application des suggestions
- `GET /geocode/stats` - Statistiques

### Modes de géocodage supportés :
1. **exact** : Coordonnées précises (lon/lat)
2. **centroid** : Centroïde ADM (adm1/adm2/adm3)
3. **random** : Point aléatoire dans ADM
4. **unknown** : Pas de géométrie

### Fonctions PostgreSQL :
- `get_adm_centroid(level, gid)` - Calcul centroïde
- `get_adm_random_point(level, gid, seed)` - Point aléatoire
- `refresh_sondages_unifies()` - Refresh vue unifiée

### Points de défaillance identifiés :
❌ **Import sans géocodage** : Les données Excel importées ne déclenchent pas le géocodage automatique
❌ **Relation maille manquante** : `maille_code` NULL pour 229/230 sondages
❌ **Pas de fallback** : Aucun géocodage par défaut sur ADM3

---

## 3️⃣ LOGIQUE UI ET AFFICHAGE

### Désactivation édition :
```tsx
// Dans DataGrid.tsx - ligne 171
const canEdit = editable && typeof onCellEdit === "function" && normalized(primary) !== ''
```
**Problème :** L'édition est désactivée si la PK est vide, mais les PK sont valides.

### Gestion des couleurs cartographiques :
```tsx
// Dans thematic-maps.ts - ligne 316
private getColorForValue(value: number, breaks: number[], colors: string[]): string {
  if (value == null || isNaN(value)) return '#cccccc' // GRIS
}
```

### Règles de style identifiées :
- **Vert** : `location_mode = 'exact'` 
- **Bleu** : `location_mode IN ('centroid', 'random')`
- **Gris** : `geom IS NULL OR location_mode = 'unknown'`

### Logique MapPanel :
- Zoom sur bbox via `fitBounds()`
- Box zoom pour sélection spatiale
- Fallback `/extent` → `/extent-related`

---

## 4️⃣ CORRECTIONS PRIORITAIRES

### Backend (HAUTE PRIORITÉ)
```sql
-- 1. Trigger auto-géocodage sur INSERT sondages
CREATE OR REPLACE FUNCTION auto_geocode_sondage() 
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.geom IS NULL AND NEW.adm3_id IS NOT NULL THEN
    NEW.geom := get_adm_centroid('ADM3', NEW.adm3_id);
    NEW.location_mode := 'centroid';
    NEW.location_accuracy := 'centroid_adm3';
    NEW.is_geocoded := TRUE;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_auto_geocode 
  BEFORE INSERT OR UPDATE ON sondages
  FOR EACH ROW EXECUTE FUNCTION auto_geocode_sondage();
```

### UI (MOYENNE PRIORITÉ)
```tsx
// Réactiver édition même sans géométrie
const canEdit = editable && typeof onCellEdit === "function" && 
                normalized(primary) !== '' && primary !== null

// Améliorer feedback zoom
if (bbox && bbox.min_x != null) setBboxToZoom(bbox)
else alert('Aucune géométrie trouvée pour la sélection (table ou relations).')
```

### Endpoint robustesse (MOYENNE PRIORITÉ)
```rust
// Dans table.rs - améliorer gestion NULL
pub async fn get_extent_by_ids(...) -> Result<Option<BBox>, sqlx::Error> {
    // Vérifier géométrie existe avant ST_Extent
    let has_geom: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM sondages WHERE id = ANY($1) AND geom IS NOT NULL"
    ).bind(&ids).fetch_one(pool).await?;
    
    if has_geom == 0 { return Ok(None); }
    // ... reste du code
}
```

---

## 5️⃣ PLAN DE RÉIMPORTATION PROPRE

### Script de nettoyage :
```sql
-- 1. Sauvegarde
pg_dump -U atlas -d atlas_clean > backup_$(date +%Y%m%d_%H%M%S).sql

-- 2. Nettoyage ciblé (GARDER la structure)
BEGIN;
DELETE FROM essais_atterberg;
DELETE FROM essais_classif; 
DELETE FROM essais_geotechniques;
DELETE FROM essais_physiques;
DELETE FROM essais_vbs;
DELETE FROM granulo_points;
DELETE FROM granulometrie_points;
DELETE FROM raw_lab_ags;
DELETE FROM raw_lab_agt; 
DELETE FROM raw_lab_atterberg;
DELETE FROM echantillons;
DELETE FROM sondages WHERE deleted_at IS NULL;
COMMIT;

-- 3. Réindexation
REINDEX TABLE sondages;
ANALYZE sondages;
```

### Validation post-import :
```sql
-- Vérifications obligatoires
SELECT 'PK_nulls' as check_name, COUNT(*) FROM sondages WHERE id IS NULL;
SELECT 'Geom_populated' as check_name, COUNT(*) FROM sondages WHERE geom IS NOT NULL;
SELECT 'FK_valid' as check_name, COUNT(*) FROM echantillons e 
  LEFT JOIN sondages s ON e.sondage_id = s.id WHERE s.id IS NULL;
```

### Stratégie anti-doublon :
```sql
-- Import via table temporaire
CREATE TEMP TABLE temp_sondages (LIKE sondages);
-- ... import Excel vers temp_sondages
INSERT INTO sondages SELECT * FROM temp_sondages 
  ON CONFLICT (id) DO UPDATE SET 
    code = EXCLUDED.code,
    geom = COALESCE(EXCLUDED.geom, sondages.geom),
    updated_at = now();
```

---

## 6️⃣ TRIGGERS RECOMMANDÉS

### Calcul automatique IP :
```sql
CREATE OR REPLACE FUNCTION calculate_ip() RETURNS TRIGGER AS $$
BEGIN
  IF NEW.wl IS NOT NULL AND NEW.wp IS NOT NULL THEN
    NEW.ip_generated := NEW.wl - NEW.wp;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_calculate_ip 
  BEFORE INSERT OR UPDATE ON essais_atterberg
  FOR EACH ROW EXECUTE FUNCTION calculate_ip();
```

### Refresh automatique des vues :
```sql
CREATE OR REPLACE FUNCTION refresh_views_after_sondage() RETURNS TRIGGER AS $$
BEGIN
  -- Refresh vue matérialisée si elle existe
  IF EXISTS (SELECT 1 FROM pg_matviews WHERE matviewname = 'sondages_unifies') THEN
    REFRESH MATERIALIZED VIEW CONCURRENTLY sondages_unifies;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_refresh_views
  AFTER INSERT OR UPDATE OR DELETE ON sondages
  FOR EACH STATEMENT EXECUTE FUNCTION refresh_views_after_sondage();
```

---

## 7️⃣ CHECKLIST TESTS

### Tests manuels à exécuter :
1. ✅ **Backup** : `docker exec atlas-db pg_dump -U atlas -d atlas_clean > backup.sql`
2. ⏳ **UI Refresh** : Ctrl+F5 sur http://localhost:8080/db-manager.html
3. ⏳ **Dropdown tables** : Vérifier liste peuplée
4. ⏳ **Édition ligne** : Tester avec PK valide vs invalide
5. ⏳ **Zoom sélection** : 
   - Sélectionner NABIYOU Warou
   - Cliquer Zoom → observer logs console (F12)
   - Vérifier fallback `/extent-related`
6. ⏳ **Import test** : 5 sondages propres → vérifier affichage UI
7. ⏳ **Couleurs couches** : Vérifier vert/bleu/gris selon `location_mode`

### Commandes de diagnostic :
```bash
# Logs backend
docker logs atlas-api-geo -n 50

# Logs UI  
docker logs atlas-ui -n 20

# Test endpoints
curl http://localhost:8000/db/table/public/sondages/extent \
  -X POST -H "Content-Type: application/json" \
  -d '["dda1e71b-8d0d-4c9e-b53f-877a6cf70da9"]'
```

---

## 8️⃣ LIVRABLES ET SÉVÉRITÉ

### Fichiers créés :
- ✅ `database_inventory.sql` - Script d'inventaire complet
- ✅ `analyze_atlas_data.py` - Analyse Excel et création atlas_import.xlsx
- ✅ `atlas_import.xlsx` - Données nettoyées (16 tables, 34K+ lignes)
- ✅ `backup_before_reimport_*.sql` - Sauvegarde sécurité

### Corrections par priorité :

| Sévérité | Issue | Impact | Estimation |
|----------|-------|--------|------------|
| 🔴 **CRITIQUE** | 229/230 sondages sans géométrie | Zoom/édition impossible | 2h |
| 🟡 **ÉLEVÉ** | UI désactive édition sur PK valides | Édition bloquée | 30min |
| 🟡 **ÉLEVÉ** | Pas de géocodage auto à l'import | Données futures sans géo | 1h |
| 🟢 **MOYEN** | Endpoints /extent erreur 500 | UX dégradée | 45min |
| 🟢 **MOYEN** | Fallback /extent-related manquant | Zoom limité | 30min |

### Snippets UI prêts :
```tsx
// Correction édition - DataGrid.tsx ligne 171
const canEdit = editable && typeof onCellEdit === "function" && 
                normalized(primary) !== '' && primary !== null

// Correction feedback zoom - App.tsx ligne 264  
if (bbox && bbox.min_x != null) setBboxToZoom(bbox)
else alert('Aucune géométrie trouvée pour la sélection (table ou relations).')
```

### Vue SQL recommandée :
```sql
CREATE VIEW sondages_status AS
SELECT 
  id, code, geom,
  CASE 
    WHEN geom IS NOT NULL AND location_mode = 'exact' THEN 'green'
    WHEN geom IS NOT NULL AND location_mode IN ('centroid', 'random') THEN 'blue'  
    ELSE 'grey'
  END as map_color,
  location_mode, location_accuracy, is_geocoded
FROM sondages 
WHERE deleted_at IS NULL;
```

---

## 🎯 CONCLUSION

**Problème racine :** Import Excel sans déclenchement du géocodage automatique.

**Solution recommandée :** 
1. Appliquer trigger auto-géocodage (section 4)
2. Réimporter données nettoyées (section 5) 
3. Corriger UI pour réactiver édition (section 8)

**Temps estimé total :** 4h30 pour résolution complète.

**Prochaine étape :** Exécuter les tests de la section 7 pour valider l'état actuel avant corrections.
