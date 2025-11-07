# 📋 AUDIT COMPLET - Données & Géocodage (Partie 2/3)

**Date:** 2025-11-06  
**Objectif:** Incohérences UI et recommandations

---

## E) INCOHÉRENCES UI

### 🚨 1. Badge "2 sondages" sur un item

**Capture:** Image 2 montre "Ountivou" avec badge "2 sondages"

**Cause:** L'UI affiche `atlas.surveys` (agrégé) au lieu de `sondages` (unitaire).

**Fichier:** `ui/src/modal/sondages-modal.ts:365-386`

```typescript
// ACTUEL (MAUVAIS)
const r = await fetch(`${this.apiUrl}/surveys-canon?limit=100`)
const surveys = await r.json()

surveys.forEach(s => {
  // s.nb_sondages_source = 2 pour "Ountivou"
  // → Badge "2 sondages" affiché
})
```

**Attendu:** Lister 230 sondages individuels, pas 40 localités.

---

### 🚨 2. Sous-titre "LIMITE-OUNTIVOU"

**Capture:** Image 2 montre "Code: LIMITE-OUNTIVOU"

**Cause:** Affiche `s.code` (code canonique = premier code de la localité).

**Fichier:** `ui/src/modal/sondages-modal.ts:377`

```typescript
// ACTUEL
<li><b>Code:</b> ${s.code}</li>  // "LIMITE-OUNTIVOU"

// ATTENDU (pour un sondage individuel)
<li><b>Code:</b> ${sondage.code}</li>  // "BLEU-OUNTIVOU" ou "LIMITE-OUNTIVOU"
```

**Problème fondamental:** On affiche des **localités agrégées** au lieu de **sondages individuels**.

---

### 🚨 3. "Géocodé: Oui" mais "Géométrie: Absente"

**Cause:** Flag `is_geocoded` dans `sondages` est mal calculé.

**Table `sondages`:**
```sql
-- Colonne simple, pas recalculée automatiquement
is_geocoded BOOLEAN NOT NULL DEFAULT true
```

**Problème:** Valeur par défaut `true`, jamais mise à jour.

**Solution:** Colonne générée ou trigger:
```sql
ALTER TABLE sondages 
  DROP COLUMN is_geocoded,
  ADD COLUMN is_geocoded BOOLEAN 
    GENERATED ALWAYS AS (geom IS NOT NULL OR adm3_id IS NOT NULL) STORED;
```

---

### 🚨 4. 176 sondages "INCONNU" (localite = NULL)

**Cause:** Champ `localite` non rempli lors de l'import.

**Solution:** Backfill depuis `code`:
```sql
-- Fonction extract_localite() existe déjà
UPDATE sondages
SET localite = extract_localite(code)
WHERE localite IS NULL AND code IS NOT NULL;
```

**Après:**
```sql
-- Vérifier
SELECT COUNT(*) FROM sondages WHERE localite IS NULL;
-- Attendu: 0 ou très peu
```

---

### 🚨 5. Suggestions affichent "Wli 100%"

**Capture:** Image 1 montre suggestion "Wli" avec score 100%

**Bon:** L'API `/surveys-canon/:id/adm3-candidates` fonctionne!

**Exemple réponse:**
```json
{
  "survey_id": "...",
  "localite": "Wli",
  "candidates": [
    {
      "adm3_id": 123,
      "gid": 123,
      "name": "Wli",
      "code": "TG...",
      "adm2_name": "...",
      "score": 1.0
    }
  ]
}
```

**Problème:** Bouton "Enregistrer le géocodage" fonctionne mais géocode la **localité agrégée**, pas le sondage individuel.

---

## F) RECOMMANDATIONS DURABLES

### 🎯 1. Source de Vérité: SONDAGES INDIVIDUELS

**Objectif:** L'UI doit lister 230 sondages, pas 40 localités.

**Solution:** Nouveau endpoint `/sondages`

#### API (Rust)

**Fichier:** `services/api-geo/src/sondages.rs` (nouveau)

```rust
#[derive(Debug, Serialize, sqlx::FromRow)]
pub struct Sondage {
    pub id: Uuid,
    pub code: String,
    pub localite: Option<String>,
    pub adm3_id: Option<Uuid>,
    pub adm3_name: Option<String>,
    pub geom: Option<serde_json::Value>,
    pub location_mode: Option<String>,
    pub is_geocoded: bool,
    pub date: Option<chrono::NaiveDate>,
    pub source: Option<String>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

#[derive(Debug, Deserialize)]
pub struct SondagesQuery {
    pub limit: Option<i64>,
    pub offset: Option<i64>,
    pub search: Option<String>,
    pub missing: Option<String>,  // "geom" | "adm3"
}

pub async fn list_sondages(
    State(state): State<AppState>,
    Query(params): Query<SondagesQuery>,
) -> Result<Json<Vec<Sondage>>, (StatusCode, String)> {
    let pool = &state.pool;
    let limit = params.limit.unwrap_or(100).min(500);
    let offset = params.offset.unwrap_or(0);
    
    let mut where_clauses = vec!["deleted_at IS NULL"];
    
    if let Some(search) = &params.search {
        where_clauses.push("atlas.norm(code) LIKE '%' || atlas.norm($1) || '%'");
    }
    
    if let Some(missing) = &params.missing {
        match missing.as_str() {
            "geom" => where_clauses.push("geom IS NULL"),
            "adm3" => where_clauses.push("adm3_id IS NULL"),
            _ => {}
        }
    }
    
    let where_sql = where_clauses.join(" AND ");
    
    let query = format!(
        r#"
        SELECT 
            id, code, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text,
            (geom IS NOT NULL OR adm3_id IS NOT NULL) as is_geocoded,
            date, source, created_at
        FROM sondages
        WHERE {}
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
        "#,
        where_sql
    );
    
    let rows = sqlx::query_as::<_, Sondage>(&query)
        .bind(&params.search)
        .bind(limit)
        .bind(offset)
        .fetch_all(pool)
        .await
        .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(rows))
}

pub async fn get_sondages_stats(
    State(state): State<AppState>,
) -> Result<Json<SondagesStats>, (StatusCode, String)> {
    let pool = &state.pool;
    
    let (total, geocoded, with_geom, with_adm3): (i64, i64, i64, i64) = sqlx::query_as(
        r#"
        SELECT 
            COUNT(*) as total,
            COUNT(*) FILTER (WHERE geom IS NOT NULL OR adm3_id IS NOT NULL) as geocoded,
            COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom,
            COUNT(*) FILTER (WHERE adm3_id IS NOT NULL) as with_adm3
        FROM sondages
        WHERE deleted_at IS NULL
        "#
    )
    .fetch_one(pool)
    .await
    .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
    
    Ok(Json(SondagesStats {
        total,
        geocoded,
        with_geom,
        with_adm3,
    }))
}
```

**Routes (main.rs):**
```rust
.route("/sondages", get(sondages::list_sondages))
.route("/sondages/stats", get(sondages::get_sondages_stats))
.route("/sondages/:id", get(sondages::get_sondage))
.route("/sondages/:id/geometry", patch(sondages::update_geometry))
.route("/sondages/:id/adm3-candidates", get(sondages::get_adm3_candidates))
```

#### UI (TypeScript)

**Fichier:** `ui/src/api/sondages.ts` (nouveau)

```typescript
export interface Sondage {
  id: string;
  code: string;
  localite: string | null;
  adm3_id: string | null;
  adm3_name: string | null;
  geom: any | null;
  location_mode: string | null;
  is_geocoded: boolean;
  date: string | null;
  source: string | null;
  created_at: string;
}

export interface SondagesStats {
  total: number;
  geocoded: number;
  with_geom: number;
  with_adm3: number;
}

export async function listSondages(params: {
  limit?: number;
  offset?: number;
  search?: string;
  missing?: 'geom' | 'adm3';
}): Promise<Sondage[]> {
  return apiGet<Sondage[]>('/sondages', params);
}

export async function getSondagesStats(): Promise<SondagesStats> {
  return apiGet<SondagesStats>('/sondages/stats');
}
```

**Mise à jour UI:**

`ui/src/modal/sondages-modal.ts`:
```typescript
// AVANT
const r = await fetch(`${this.apiUrl}/surveys-canon?limit=100`)

// APRÈS
import { listSondages, getSondagesStats } from '../api/sondages'

async loadSurveysList() {
  const sondages = await listSondages({ limit: 100 })
  const stats = await getSondagesStats()
  
  // Afficher 230 sondages individuels
  sondages.forEach(s => {
    const title = s.localite || extractLocaliteFromCode(s.code) || s.code
    const subtitle = [
      s.code,
      s.adm3_name ? `Commune: ${s.adm3_name}` : 'Commune: —'
    ].join(' • ')
    
    // PAS de badge "2 sondages"
  })
}
```

---

### 🎯 2. Toggle "Grouper par localité" (Optionnel)

**UI:** Ajouter un switch dans "Liste des Sondages"

```typescript
<div class="filter-bar">
  <label>
    <input type="checkbox" id="group-by-locality" />
    Grouper par localité
  </label>
</div>
```

**Logique:**
```typescript
if (groupByLocality) {
  // Appeler /surveys-canon (40 localités)
  const surveys = await listSurveysCanon({ limit: 100 })
  // Afficher avec badge "X sondages"
} else {
  // Appeler /sondages (230 sondages)
  const sondages = await listSondages({ limit: 100 })
  // Afficher sans badge
}
```

---

### 🎯 3. Géocoder un SONDAGE, pas une localité

**Problème actuel:** PATCH `/surveys-canon/:id/geometry` géocode la localité agrégée.

**Solution:** PATCH `/sondages/:id/geometry`

**Fichier:** `services/api-geo/src/sondages.rs`

```rust
pub async fn update_geometry(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<UpdateGeometryPayload>,
) -> Result<Json<Sondage>, (StatusCode, String)> {
    let pool = &state.pool;
    
    // Validation
    if payload.mode == "exact" && payload.geom.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Mode 'exact' requires 'geom'".to_string()));
    }
    if payload.mode == "adm" && payload.adm3_id.is_none() {
        return Err((StatusCode::BAD_REQUEST, "Mode 'adm' requires 'adm3_id'".to_string()));
    }
    
    // Update sondage directement (pas via surveys)
    if payload.mode == "exact" {
        let geom_json = payload.geom.as_ref().unwrap();
        sqlx::query(
            r#"
            UPDATE sondages 
            SET geom = ST_SetSRID(ST_GeomFromGeoJSON($1), 25231),
                location_mode = 'exact',
                updated_at = NOW()
            WHERE id = $2
            "#
        )
        .bind(geom_json)
        .bind(id)
        .execute(pool)
        .await?;
    } else if payload.mode == "adm" {
        sqlx::query(
            r#"
            UPDATE sondages 
            SET adm3_id = $1,
                location_mode = 'adm_random_cell',
                updated_at = NOW()
            WHERE id = $2
            "#
        )
        .bind(payload.adm3_id)
        .bind(id)
        .execute(pool)
        .await?;
    }
    
    // Optionnel: Refresh canoniques en arrière-plan
    // (ou via queue/cron)
    
    // Retourner le sondage mis à jour
    let updated = sqlx::query_as::<_, Sondage>(
        r#"
        SELECT 
            id, code, localite, adm3_id, adm3_name,
            ST_AsGeoJSON(geom)::jsonb as geom,
            location_mode::text,
            (geom IS NOT NULL OR adm3_id IS NOT NULL) as is_geocoded,
            date, source, created_at
        FROM sondages
        WHERE id = $1
        "#
    )
    .bind(id)
    .fetch_one(pool)
    .await?;
    
    Ok(Json(updated))
}
```

---

### 🎯 4. Backfill `localite` dans `sondages`

**Migration SQL:**

```sql
-- Backfill localite depuis code
UPDATE sondages
SET localite = extract_localite(code)
WHERE localite IS NULL AND code IS NOT NULL;

-- Vérifier
SELECT 
  COUNT(*) as total,
  COUNT(*) FILTER (WHERE localite IS NOT NULL) as avec_localite
FROM sondages;
-- Attendu: 230 / 230
```

---

### 🎯 5. Recalculer `is_geocoded` dans `sondages`

**Option A: Colonne générée (RECOMMANDÉ)**

```sql
ALTER TABLE sondages 
  DROP COLUMN is_geocoded,
  ADD COLUMN is_geocoded BOOLEAN 
    GENERATED ALWAYS AS (geom IS NOT NULL OR adm3_id IS NOT NULL) STORED;
```

**Option B: Trigger**

```sql
CREATE OR REPLACE FUNCTION update_is_geocoded()
RETURNS TRIGGER AS $$
BEGIN
  NEW.is_geocoded := (NEW.geom IS NOT NULL OR NEW.adm3_id IS NOT NULL);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_update_is_geocoded
  BEFORE INSERT OR UPDATE OF geom, adm3_id ON sondages
  FOR EACH ROW
  EXECUTE FUNCTION update_is_geocoded();
```

---

### 🎯 6. KPI UI au niveau SONDAGE

**Avant (MAUVAIS):**
```
Villages sans géométrie: 39
```

**Après (BON):**
```
Sondages sans géométrie: 229
```

**Fichiers à modifier:**
- `ui/src/geocode-canon-panel.ts`
- `ui/src/suggestions-canon-panel.ts`
- `ui/src/modal/sondages-modal.ts`

**Remplacer:**
```typescript
// AVANT
import { getSurveyCanonStats } from './api/surveys-canon'
const stats = await getSurveyCanonStats()
// stats.total = 40 (localités)

// APRÈS
import { getSondagesStats } from './api/sondages'
const stats = await getSondagesStats()
// stats.total = 230 (sondages)
```

---

Voir PART3 pour checklist et migrations SQL.
