# IMPORT BULK - RAPPORT D'IMPLÉMENTATION v2.0

**Date** : 19 octobre 2025
**Statut Global** : 🟡 35% Complété
**Phase actuelle** : Phase 1 (MVP) - **INCOMPLÈTE**

---

## 📋 RÉSUMÉ EXÉCUTIF

L'analyse du code révèle que la fonctionnalité d'import bulk dispose de **fondations solides** (base de données, types, parser CSV) mais souffre de **lacunes critiques** dans la logique métier et l'interface utilisateur.

### Statut par Composant

| Composant | Complétude | État | Blocage |
|-----------|------------|------|---------|
| Base de données | 100% | ✅ Complet | - |
| Parser CSV | 100% | ✅ Complet | - |
| Parser XLSX | 0% | 🔴 Stub | Phase 3 |
| Parser JSON | 0% | 🔴 Stub | Phase 3 |
| Transformation données | 100% | ✅ Complet | - |
| Validation | 50% | ⚠️ Partiel | Bug latitude |
| Géolocalisation | 40% | ⚠️ Partiel | PostGIS requis |
| **Import DB** | **30%** | 🔴 **Bloquant** | **process_import() incomplet** |
| Jobs async | 0% | 🔴 Manquant | Tokio queue |
| API REST | 70% | ⚠️ Partiel | Profils 501 |
| Frontend UI | 0% | 🔴 Manquant | Tout à faire |
| Profils mapping | 50% | ⚠️ Partiel | CRUD stubé |

---

## 🔴 BLOCAGES CRITIQUES (P0 - URGENT)

### 1. Import ne crée pas les sondages/essais en base

**Fichier** : `atlas/services/api-geo/src/import_bulk/importer.rs`

**Problème** :
```rust
// Fonction process_import() existe mais est incomplète
// Les endpoints appellent cette fonction mais aucune insertion DB n'est effectuée
```

**Impact** :
- ❌ Les imports sont validés mais **aucune donnée n'est créée**
- ❌ Impossible de tester end-to-end
- ❌ Bloque toutes les phases suivantes

**Preuve** : Ligne 235 de `routes.rs` contient :
```rust
// TODO: Lancer job async (tokio::spawn)
// Pour l'instant, traitement synchrone
```

**Action requise** :
1. Implémenter `process_import()` pour :
   - Créer les sondages dans table `sondages`
   - Créer les essais dans table `essais`
   - Remplir `import_id` et `import_row_idx`
   - Gérer les transactions (rollback si erreur)
   - Calculer les fingerprints et détecter doublons
2. Gérer les erreurs ligne par ligne (continuer si erreur partielle)
3. Mettre à jour `import_items` avec statut (ok/warning/error)

**Estimation** : 2-3 jours

---

### 2. Traitement synchrone bloque le thread

**Fichier** : `atlas/services/api-geo/src/import_bulk/routes.rs:235`

**Problème** :
- Endpoint nommé `/async` mais traitement **synchrone**
- Aucune file de jobs (queue)
- Risque de timeout sur fichiers > 1000 lignes

**Impact** :
- ❌ API bloquée pendant import (peut durer plusieurs minutes)
- ❌ Impossible d'importer en arrière-plan
- ❌ Pas de vraie gestion de progression

**Action requise** :
1. Implémenter job queue avec `tokio::spawn`
2. Utiliser `Arc<Mutex<JobStatus>>` pour partager état
3. Endpoint `/async` retourne immédiatement job_id
4. Endpoint `/status/:job_id` interroge progression

**Estimation** : 1-2 jours

---

### 3. Parsers XLSX et JSON sont des stubs

**Fichier** : `atlas/services/api-geo/src/import_bulk/parser.rs:163-188`

**Code actuel** :
```rust
pub struct XlsxParser;
impl XlsxParser {
    pub fn parse(_bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        Err(anyhow!("XLSX parsing not implemented yet - Phase 3"))
    }
}

pub struct JsonParser;
impl JsonParser {
    pub fn parse(_bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        Err(anyhow!("JSON parsing not implemented yet - Phase 3"))
    }
}
```

**Impact** :
- ❌ Seuls fichiers CSV fonctionnent
- ❌ Cahier des charges spécifie les 3 formats

**Action requise** :
1. **XLSX** : Utiliser crate `calamine` ou `xlsx`
   - Lire première feuille
   - Extraire en-têtes (ligne 1)
   - Convertir cellules → HashMap<String, String>
2. **JSON** : Utiliser `serde_json`
   - Déserialiser `Vec<Map<String, Value>>`
   - Convertir values → String

**Estimation** : 1 jour par parser

---

### 4. Frontend UI totalement absent

**Localisation** : `atlas/ui/src/`

**Manquant** :
- ❌ Composant upload fichier (drag & drop)
- ❌ Interface mapping colonnes
- ❌ Sélecteur mode géolocalisation
- ❌ Prévisualisation tableau + carte
- ❌ Barre de progression
- ❌ Gestion profils mapping

**Impact** :
- Utilisateurs ne peuvent pas utiliser la fonctionnalité
- Seule utilisation possible : cURL avec API directe

**Action requise** :
Créer 5 composants selon wireframes du cahier des charges :

1. **UploadStep.ts** : Zone drop + sélection fichier
2. **MappingStep.ts** : Interface drag-drop colonnes → champs
3. **GeolocationStep.ts** : Radio buttons modes + configuration
4. **PreviewStep.ts** : Tableau lignes + carte Leaflet
5. **ProgressStep.ts** : WebSocket progression + erreurs

**Estimation** : 5-7 jours

---

## ⚠️ BUGS CRITIQUES (P1 - IMPORTANT)

### 5. Bug validation latitude Togo

**Fichier** : `atlas/services/api-geo/src/import_bulk/validator.rs:94`

**Code erroné** :
```rust
if lat < 6.0 || lat < 11.5 {  // ❌ ERREUR LOGIQUE
    return Err(anyhow!("Latitude hors limites Togo"));
}
```

**Correction** :
```rust
if lat < 6.0 || lat > 11.5 {  // ✅ CORRECT
    return Err(anyhow!("Latitude hors limites Togo (6.0 - 11.5)"));
}
```

**Impact** :
- Latitudes valides > 11.5 sont rejetées à tort
- Zones nord du Togo impossibles à importer

**Estimation** : 5 minutes

---

### 6. Profils mapping non fonctionnels

**Fichier** : `atlas/services/api-geo/src/import_bulk/routes.rs:502-527`

**Code actuel** :
```rust
async fn create_profile(...) -> Result<impl warp::Reply> {
    Ok(reply::with_status(
        reply::json(&json!({"error": "Not implemented yet"})),
        StatusCode::NOT_IMPLEMENTED  // 501
    ))
}
```

**Impact** :
- ❌ Utilisateurs ne peuvent pas sauvegarder configurations
- ❌ Doivent refaire mapping à chaque import

**Action requise** :
1. Implémenter CRUD complet :
   - `GET /profiles` → SELECT * FROM import_mapping_profiles WHERE user_id = $1
   - `POST /profiles` → INSERT avec validation JSON
   - `GET /profiles/:id` → SELECT par ID + user_id
   - `PUT /profiles/:id` → UPDATE avec ownership check
   - `DELETE /profiles/:id` → DELETE avec ownership check
   - `POST /profiles/:id/use` → UPDATE last_used_at, use_count++

**Estimation** : 1 jour

---

### 7. Géolocalisation modes avancés non implémentés

**Fichier** : `atlas/services/api-geo/src/import_bulk/validator.rs`

**Statut actuel** :
- ✅ Mode `exact` : Validation coordonnées OK
- ⚠️ Mode `centroid` : Validation ADM3 OK, calcul manquant
- ⚠️ Mode `random` : Validation ADM3 OK, génération point manquante
- ✅ Mode `unknown` : OK (pas de coords)
- ⚠️ Mode `maille` : Validation code OK, lookup centroïde manquant

**Manquant** :
```rust
// Calculer centroïde d'une zone ADM3
async fn compute_adm3_centroid(adm3_id: Uuid) -> Result<(f64, f64)> {
    // SELECT ST_X(ST_Centroid(geom)), ST_Y(ST_Centroid(geom))
    // FROM adm3 WHERE id = $1
    todo!("Nécessite PostGIS")
}

// Générer point aléatoire déterministe dans zone
async fn generate_random_point(adm3_id: Uuid, seed: &str) -> Result<(f64, f64)> {
    // Hash(seed + adm3_id) → RNG → point in polygon
    todo!("Nécessite geometry + seedable RNG")
}

// Récupérer centroïde d'une maille
async fn get_maille_centroid(maille_code: &str) -> Result<(f64, f64)> {
    // SELECT ST_X(centroid), ST_Y(centroid)
    // FROM mailles WHERE code = $1
    todo!("Nécessite table mailles")
}
```

**Action requise** :
1. Installer extension PostGIS si absente
2. Vérifier colonnes `geometry` dans tables ADM
3. Implémenter les 3 fonctions ci-dessus
4. Intégrer dans `process_import()`

**Estimation** : 2 jours

---

### 8. Matching ADM ignore contexte hiérarchique

**Fichier** : `atlas/services/api-geo/src/import_bulk/matcher.rs:14-19`

**Code actuel** :
```rust
pub async fn match_adm3_fuzzy(
    pool: &PgPool,
    commune_name: &str,
    _adm2_hint: Option<&str>,  // ❌ Inutilisé (préfixe _)
    _adm1_hint: Option<&str>,  // ❌ Inutilisé
) -> Result<Vec<AdmMatch>> {
    let rows = sqlx::query_as!(
        AdmMatch,
        r#"
        SELECT id, name, similarity(name, $1) as score
        FROM adm3
        WHERE similarity(name, $1) > 0.75
        ORDER BY score DESC
        LIMIT 5
        "#,
        commune_name
    )
    // ❌ ADM2/ADM1 hints ignorés dans requête SQL
```

**Problème** :
- Recherche "Lomé" peut retourner communes homonymes dans mauvaise région
- Pas de filtrage par préfecture (ADM2) ou région (ADM1)

**Correction** :
```rust
pub async fn match_adm3_fuzzy(
    pool: &PgPool,
    commune_name: &str,
    adm2_hint: Option<&str>,  // ✅ Renommé (plus de _)
    adm1_hint: Option<&str>,
) -> Result<Vec<AdmMatch>> {
    let mut query = String::from(
        "SELECT a3.id, a3.name, similarity(a3.name, $1) as score
         FROM adm3 a3"
    );

    let mut conditions = vec!["similarity(a3.name, $1) > 0.75"];
    let mut param_idx = 2;

    if adm2_hint.is_some() {
        query.push_str(" JOIN adm2 a2 ON a3.adm2_id = a2.id");
        conditions.push(&format!("similarity(a2.name, ${}) > 0.7", param_idx));
        param_idx += 1;
    }

    if adm1_hint.is_some() {
        query.push_str(" JOIN adm1 a1 ON a2.adm1_id = a1.id");
        conditions.push(&format!("similarity(a1.name, ${}) > 0.7", param_idx));
    }

    query.push_str(&format!(" WHERE {}", conditions.join(" AND ")));
    query.push_str(" ORDER BY score DESC LIMIT 5");

    // Exécuter requête dynamique avec params
    // ...
}
```

**Estimation** : 0.5 jour

---

## 📊 DÉTAILS DES LACUNES PAR COMPOSANT

### Base de données ✅ (100%)
**Statut** : Complet, aucune action requise

Migration `009_import_bulk.sql` contient :
- ✅ 5 tables (imports, import_items, import_logs, test_type_defaults, import_mapping_profiles)
- ✅ 2 fonctions SQL (compute_fingerprint, validate_test_value)
- ✅ Indexes optimisés
- ✅ Vue v_import_stats

---

### Parser CSV ✅ (100%)
**Statut** : Complet, bien testé

Fichier `parser.rs` ligne 18-161 :
- ✅ Auto-détection séparateur (`,` `;` `\t`)
- ✅ Détection encodage (UTF-8, ISO-8859-15, Windows-1252)
- ✅ Protection CSV injection
- ✅ Tests unitaires

---

### Parser XLSX 🔴 (0%)
**Statut** : Stub retournant erreur

**Tâches** :
1. Ajouter dépendance `calamine = "0.22"` dans `Cargo.toml`
2. Implémenter :
```rust
use calamine::{Reader, open_workbook_auto, Xlsx};

pub struct XlsxParser;

impl XlsxParser {
    pub fn parse(bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        // Créer curseur mémoire
        let cursor = std::io::Cursor::new(bytes);

        // Ouvrir workbook
        let mut workbook: Xlsx<_> = open_workbook_auto(cursor)?;

        // Lire première feuille
        let sheet_name = workbook.sheet_names()[0].clone();
        let range = workbook.worksheet_range(&sheet_name)?;

        // Extraire en-têtes (ligne 1)
        let headers: Vec<String> = range.rows().next()
            .ok_or(anyhow!("Fichier vide"))?
            .iter()
            .map(|cell| cell.to_string())
            .collect();

        // Convertir lignes → HashMap
        let mut rows = Vec::new();
        for row in range.rows().skip(1) {
            let mut map = HashMap::new();
            for (i, cell) in row.iter().enumerate() {
                if let Some(header) = headers.get(i) {
                    map.insert(header.clone(), cell.to_string());
                }
            }
            rows.push(map);
        }

        Ok(rows)
    }
}
```

**Tests requis** :
- Fichier .xlsx simple (10 lignes)
- Feuilles multiples (utiliser première)
- Cellules vides
- Types mixtes (nombre, texte, date)

---

### Parser JSON 🔴 (0%)
**Statut** : Stub retournant erreur

**Tâches** :
1. Utiliser `serde_json` (déjà dépendance)
2. Implémenter :
```rust
use serde_json::Value;

pub struct JsonParser;

impl JsonParser {
    pub fn parse(bytes: &[u8]) -> Result<Vec<HashMap<String, String>>> {
        // Déserialiser JSON
        let value: Value = serde_json::from_slice(bytes)?;

        // Vérifier que c'est un array
        let array = value.as_array()
            .ok_or(anyhow!("JSON doit être un array d'objets"))?;

        // Convertir chaque objet
        let mut rows = Vec::new();
        for item in array {
            let obj = item.as_object()
                .ok_or(anyhow!("Chaque élément doit être un objet"))?;

            let mut map = HashMap::new();
            for (key, val) in obj {
                // Convertir toutes valeurs en String
                let str_val = match val {
                    Value::String(s) => s.clone(),
                    Value::Number(n) => n.to_string(),
                    Value::Bool(b) => b.to_string(),
                    Value::Null => String::new(),
                    _ => val.to_string(),
                };
                map.insert(key.clone(), str_val);
            }
            rows.push(map);
        }

        Ok(rows)
    }
}
```

**Tests requis** :
- Array d'objets simple
- Valeurs null
- Types mixtes
- Clés avec espaces/accents

---

### Transformation données ✅ (100%)
**Statut** : Complet

Fichier `transformer.rs` :
- ✅ Conversion Large → Long
- ✅ Extraction métadonnées
- ✅ Parsing profondeurs
- ✅ Détection analyses qualitatives

---

### Validation ⚠️ (50%)
**Statut** : Partiel, avec bug

**Implémenté** :
- ✅ Validation type essai via `validate_test_value()`
- ✅ Vérification plages de valeurs
- ⚠️ Vérification bornes Togo (bug `lat < 11.5`)

**Manquant** :
- 🔴 Détection doublons par fingerprint
- 🔴 Validation date obligatoire
- 🔴 Validation profondeur > 0
- 🔴 Validation unité acceptée pour type essai

**Actions** :
1. Corriger bug latitude (voir section 5)
2. Ajouter vérifications :
```rust
// Validation complète d'une ligne
pub fn validate_row(row: &ParsedRow, pool: &PgPool) -> Result<ValidationResult> {
    let mut errors = Vec::new();
    let mut warnings = Vec::new();

    // 1. Champs obligatoires
    if row.localite.is_empty() {
        errors.push("Localité obligatoire".to_string());
    }
    if row.date_sondage.is_none() {
        errors.push("Date sondage obligatoire".to_string());
    }

    // 2. Profondeur positive
    if let Some(prof) = row.profondeur_m {
        if prof <= 0.0 {
            errors.push("Profondeur doit être > 0".to_string());
        }
    }

    // 3. Détection doublon
    if let Some(fingerprint) = compute_fingerprint(row) {
        let exists = sqlx::query_scalar!(
            "SELECT EXISTS(SELECT 1 FROM import_items WHERE fingerprint = $1)",
            fingerprint
        ).fetch_one(pool).await?;

        if exists {
            warnings.push("Sondage potentiellement déjà importé".to_string());
        }
    }

    // 4. Validation type/valeur/unité
    if let (Some(type_essai), Some(valeur), unit) =
        (&row.type_essai, row.valeur, &row.unite) {
        match validate_test_value_sql(pool, type_essai, valeur, unit).await {
            Err(e) => errors.push(e.to_string()),
            Ok(false) => warnings.push("Valeur hors plage normale".to_string()),
            _ => {}
        }
    }

    Ok(ValidationResult { errors, warnings })
}
```

---

### Import DB 🔴 (30%)
**Statut** : **BLOQUANT CRITIQUE**

Fichier `importer.rs` :

**Implémenté** :
- ✅ Création job import (`create_import_job()`)
- ✅ Mise à jour statut (`update_import_status()`)
- ✅ Journalisation (`log_import()`)

**Manquant** :
- 🔴 **Fonction `process_import()` incomplète**
- 🔴 Création sondages
- 🔴 Création essais
- 🔴 Gestion transactions

**Implémentation requise** :

```rust
pub async fn process_import(
    pool: &PgPool,
    import_id: Uuid,
    validated_rows: Vec<ValidatedRow>,
    geoloc_config: &GeolocationConfig,
) -> Result<ImportStats> {
    let mut stats = ImportStats::default();

    // Transaction globale
    let mut tx = pool.begin().await?;

    for (idx, row) in validated_rows.iter().enumerate() {
        // 1. Gérer erreurs de validation
        if !row.validation_errors.is_empty() {
            update_import_item(&mut tx, import_id, idx, ItemStatus::Error,
                               &row.validation_errors.join("; ")).await?;
            stats.errors += 1;
            continue;
        }

        // 2. Calculer coordonnées selon mode
        let (longitude, latitude) = match geoloc_config.mode {
            GeolocationMode::Exact => {
                (row.longitude.unwrap(), row.latitude.unwrap())
            },
            GeolocationMode::Centroid => {
                compute_adm3_centroid(&mut tx, &row.adm3_id.unwrap()).await?
            },
            GeolocationMode::Random => {
                let seed = format!("{}-{}", import_id, idx);
                generate_random_point(&mut tx, &row.adm3_id.unwrap(), &seed).await?
            },
            GeolocationMode::Unknown => (None, None),
            GeolocationMode::Maille => {
                get_maille_centroid(&mut tx, &row.maille_code.unwrap()).await?
            },
        };

        // 3. Créer sondage
        let sondage_id = sqlx::query_scalar!(
            r#"
            INSERT INTO sondages (
                code_sondage, localite, adm1_id, adm2_id, adm3_id,
                longitude, latitude, profondeur_atteinte_m,
                date_sondage, type_sol, operateur, source,
                import_id, import_row_idx
            )
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
            RETURNING id
            "#,
            row.code_sondage,
            row.localite,
            row.adm1_id,
            row.adm2_id,
            row.adm3_id,
            longitude,
            latitude,
            row.profondeur_atteinte_m,
            row.date_sondage,
            row.type_sol,
            row.operateur,
            row.source,
            import_id,
            idx as i32
        ).fetch_one(&mut tx).await?;

        // 4. Créer essais
        let mut tests_created = 0;
        for test in &row.tests {
            sqlx::query!(
                r#"
                INSERT INTO essais (
                    sondage_id, type_essai, profondeur_m,
                    valeur, unite, analyse_qualitative,
                    is_from_import, import_id
                )
                VALUES ($1, $2, $3, $4, $5, $6, true, $7)
                "#,
                sondage_id,
                test.type_essai,
                test.profondeur_m,
                test.valeur,
                test.unite,
                test.analyse_qualitative,
                import_id
            ).execute(&mut tx).await?;
            tests_created += 1;
        }

        // 5. Marquer ligne comme OK
        update_import_item(&mut tx, import_id, idx, ItemStatus::Ok, "").await?;
        stats.succeeded += 1;
        stats.tests_created += tests_created;

        // 6. Log progression tous les 100 lignes
        if idx % 100 == 0 {
            update_import_progress(&mut tx, import_id,
                                   (idx as f32 / validated_rows.len() as f32) * 100.0).await?;
        }
    }

    // Commit transaction
    tx.commit().await?;

    // Finaliser statut import
    let final_status = if stats.errors == 0 {
        ImportStatus::Succeeded
    } else if stats.succeeded > 0 {
        ImportStatus::Partial
    } else {
        ImportStatus::Failed
    };

    finalize_import(pool, import_id, final_status, &stats).await?;

    Ok(stats)
}

// Helpers
async fn update_import_item(
    tx: &mut Transaction<'_, Postgres>,
    import_id: Uuid,
    row_idx: usize,
    status: ItemStatus,
    error_msg: &str,
) -> Result<()> {
    sqlx::query!(
        "INSERT INTO import_items (import_id, row_idx, status, error_msg)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (import_id, row_idx) DO UPDATE
         SET status = $3, error_msg = $4",
        import_id,
        row_idx as i32,
        status.to_string(),
        error_msg
    ).execute(tx).await?;
    Ok(())
}

async fn update_import_progress(
    tx: &mut Transaction<'_, Postgres>,
    import_id: Uuid,
    progress: f32,
) -> Result<()> {
    sqlx::query!(
        "UPDATE imports SET progress = $1, updated_at = NOW() WHERE id = $2",
        progress,
        import_id
    ).execute(tx).await?;
    Ok(())
}
```

**Estimation** : 3 jours (complexe, critique)

---

### Jobs asynchrones 🔴 (0%)
**Statut** : Totalement manquant

**Architecture requise** :

```rust
// Nouveau fichier: src/import_bulk/job_queue.rs

use tokio::sync::{mpsc, Mutex};
use std::sync::Arc;
use std::collections::HashMap;

pub struct JobQueue {
    jobs: Arc<Mutex<HashMap<Uuid, JobHandle>>>,
    tx: mpsc::Sender<ImportJob>,
}

pub struct JobHandle {
    pub status: ImportStatus,
    pub progress: f32,
    pub error: Option<String>,
    cancel_token: tokio_util::sync::CancellationToken,
}

impl JobQueue {
    pub fn new() -> Self {
        let (tx, mut rx) = mpsc::channel::<ImportJob>(100);
        let jobs = Arc::new(Mutex::new(HashMap::new()));

        // Worker thread
        let jobs_clone = jobs.clone();
        tokio::spawn(async move {
            while let Some(job) = rx.recv().await {
                let jobs = jobs_clone.clone();

                // Spawner pour chaque job
                tokio::spawn(async move {
                    let result = process_import_job(job, jobs).await;
                    // Gérer résultat
                });
            }
        });

        Self { jobs, tx }
    }

    pub async fn submit(&self, import_id: Uuid, job: ImportJob) -> Result<()> {
        let handle = JobHandle {
            status: ImportStatus::Pending,
            progress: 0.0,
            error: None,
            cancel_token: tokio_util::sync::CancellationToken::new(),
        };

        self.jobs.lock().await.insert(import_id, handle);
        self.tx.send(job).await?;
        Ok(())
    }

    pub async fn get_status(&self, import_id: &Uuid) -> Option<JobHandle> {
        self.jobs.lock().await.get(import_id).cloned()
    }

    pub async fn cancel(&self, import_id: &Uuid) -> Result<()> {
        if let Some(handle) = self.jobs.lock().await.get(import_id) {
            handle.cancel_token.cancel();
        }
        Ok(())
    }
}

async fn process_import_job(job: ImportJob, jobs: Arc<Mutex<HashMap<Uuid, JobHandle>>>) {
    // Mettre statut Running
    if let Some(handle) = jobs.lock().await.get_mut(&job.import_id) {
        handle.status = ImportStatus::Running;
    }

    // Exécuter import
    let result = process_import(&job.pool, job.import_id, job.rows, &job.geoloc_config).await;

    // Mettre à jour statut final
    if let Some(handle) = jobs.lock().await.get_mut(&job.import_id) {
        match result {
            Ok(stats) => {
                handle.status = ImportStatus::Succeeded;
                handle.progress = 100.0;
            },
            Err(e) => {
                handle.status = ImportStatus::Failed;
                handle.error = Some(e.to_string());
            }
        }
    }
}
```

**Intégration dans routes.rs** :

```rust
// État global
lazy_static! {
    static ref JOB_QUEUE: JobQueue = JobQueue::new();
}

// Endpoint async
async fn bulk_import_async(
    body: ImportRequest,
    pool: PgPool,
) -> Result<impl warp::Reply> {
    // Créer job
    let import_id = Uuid::new_v4();
    let job = ImportJob {
        import_id,
        pool: pool.clone(),
        rows: body.rows,
        geoloc_config: body.geoloc_config,
    };

    // Soumettre à la queue
    JOB_QUEUE.submit(import_id, job).await?;

    // Retourner immédiatement
    Ok(reply::json(&ImportResponse {
        import_id,
        status: ImportStatus::Pending,
        message: "Import démarré en arrière-plan".to_string(),
    }))
}

// Endpoint status
async fn get_import_status(
    import_id: Uuid,
) -> Result<impl warp::Reply> {
    match JOB_QUEUE.get_status(&import_id).await {
        Some(handle) => Ok(reply::json(&handle)),
        None => Err(warp::reject::not_found()),
    }
}
```

**Estimation** : 2 jours

---

### API REST ⚠️ (70%)
**Statut** : Principaux endpoints OK, profils stubés

**Fonctionnels** :
- ✅ POST /dry-run
- ✅ POST /async
- ✅ GET /status/:id
- ✅ POST /cancel/:id
- ✅ GET /report/:id
- ✅ GET /templates/:type

**Non fonctionnels** :
- 🔴 GET /profiles (retourne [])
- 🔴 POST /profiles (501)
- 🔴 GET /profiles/:id (501)
- 🔴 PUT /profiles/:id (501)
- 🔴 DELETE /profiles/:id (501)
- 🔴 POST /profiles/:id/use (501)

**Action** : Voir section 6 pour implémentation CRUD profils

---

### Frontend UI 🔴 (0%)
**Statut** : Aucun composant

**Architecture proposée** :

```
ui/src/components/import-bulk/
├── ImportBulkWizard.ts          # Composant principal
├── steps/
│   ├── Step1_Upload.ts          # Upload fichier
│   ├── Step2_Mapping.ts         # Mapping colonnes
│   ├── Step3_Geolocation.ts     # Config géoloc
│   ├── Step4_Preview.ts         # Prévisualisation
│   └── Step5_Progress.ts        # Progression import
├── components/
│   ├── FileDropZone.ts          # Zone drag & drop
│   ├── ColumnMapper.ts          # Interface drag-drop
│   ├── GeolocationSelector.ts   # Radio + config
│   ├── DataPreview.ts           # Tableau lignes
│   └── MapPreview.ts            # Carte Leaflet
└── services/
    ├── ImportBulkAPI.ts         # Client API
    └── ImportBulkStore.ts       # État Svelte store
```

**Spécifications détaillées** :

#### Step1_Upload.ts
```typescript
// Fonctionnalités :
// - Drag & drop zone
// - Bouton sélection fichier
// - Validation taille (< 50 MB)
// - Détection format (CSV, XLSX, JSON)
// - Lecture préliminaire (10 premières lignes)

<script lang="ts">
  let file: File | null = null;
  let uploading = false;
  let preview: any[] = [];

  async function handleFileDrop(e: DragEvent) {
    e.preventDefault();
    file = e.dataTransfer?.files[0];
    await loadPreview();
  }

  async function loadPreview() {
    if (!file) return;

    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch('/api/v1/surveys/bulk-import/preview', {
      method: 'POST',
      body: formData
    });

    const data = await res.json();
    preview = data.rows.slice(0, 10);

    goto('step2');
  }
</script>

<div class="upload-zone"
     on:drop={handleFileDrop}
     on:dragover={(e) => e.preventDefault()}>

  {#if !file}
    <div class="placeholder">
      <svg>...</svg>
      <h3>Glissez un fichier ici</h3>
      <p>ou <button on:click={() => fileInput.click()}>parcourir</button></p>
      <p class="hint">CSV, Excel ou JSON (max 50 MB)</p>
    </div>
  {:else}
    <div class="file-info">
      <strong>{file.name}</strong>
      <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
      <button on:click={() => file = null}>Changer</button>
    </div>

    {#if preview.length > 0}
      <table>
        <thead>
          <tr>
            {#each Object.keys(preview[0]) as col}
              <th>{col}</th>
            {/each}
          </tr>
        </thead>
        <tbody>
          {#each preview as row}
            <tr>
              {#each Object.values(row) as val}
                <td>{val}</td>
              {/each}
            </tr>
          {/each}
        </tbody>
      </table>

      <button on:click={loadPreview} disabled={uploading}>
        {uploading ? 'Chargement...' : 'Suivant →'}
      </button>
    {/if}
  {/if}
</div>

<input type="file" bind:this={fileInput} style="display:none"
       accept=".csv,.xlsx,.xls,.json" on:change={handleFileChange} />
```

#### Step2_Mapping.ts
```typescript
// Interface drag & drop pour mapper colonnes fichier → champs Atlas

<script lang="ts">
  import { flip } from 'svelte/animate';
  import { dndzone } from 'svelte-dnd-action';

  let fileColumns = ['Commune', 'Date', 'Prof_1m', 'Prof_2m', ...];
  let mappedFields = {
    localite: null,
    code_sondage: null,
    date_sondage: null,
    profondeur_1: null,
    // ...
  };

  let suggestions = {
    localite: ['Commune', 'Localité', 'Village'],
    date_sondage: ['Date', 'Date_Sondage'],
    // Calculées par API /detect-mapping
  };

  async function autoMap() {
    const res = await fetch('/api/v1/surveys/bulk-import/detect-mapping', {
      method: 'POST',
      body: JSON.stringify({ columns: fileColumns })
    });
    mappedFields = await res.json();
  }

  function handleDrop(field: string, e: CustomEvent) {
    mappedFields[field] = e.detail.items[0];
  }
</script>

<div class="mapping-grid">
  <div class="source-columns">
    <h3>Colonnes du fichier</h3>
    {#each fileColumns as col}
      <div class="column-chip" draggable="true">
        {col}
      </div>
    {/each}
  </div>

  <div class="target-fields">
    <h3>Champs Atlas</h3>

    {#each Object.keys(mappedFields) as field}
      <div class="field-row">
        <label>{field}</label>
        <div class="drop-zone"
             use:dndzone={{items: [mappedFields[field]]}}
             on:consider={e => handleDrop(field, e)}>

          {#if mappedFields[field]}
            <span class="mapped">{mappedFields[field]}</span>
          {:else}
            <span class="placeholder">Glissez une colonne ici</span>
          {/if}
        </div>

        {#if suggestions[field]}
          <div class="suggestions">
            {#each suggestions[field] as sug}
              <button on:click={() => mappedFields[field] = sug}>
                {sug}
              </button>
            {/each}
          </div>
        {/if}
      </div>
    {/each}
  </div>
</div>

<div class="actions">
  <button on:click={autoMap}>Mapping automatique</button>
  <button on:click={saveAsProfile}>Sauvegarder comme profil</button>
  <button on:click={() => goto('step3')} disabled={!isValid}>
    Suivant →
  </button>
</div>
```

#### Step3_Geolocation.ts
```typescript
// Sélection mode géolocalisation + configuration

<script lang="ts">
  let mode: 'exact' | 'centroid' | 'random' | 'unknown' | 'maille' = 'centroid';
  let randomSeed = generateSeed();
  let randomJitter = 100; // mètres

  $: configValid = validateConfig(mode);

  function validateConfig(m: string) {
    if (m === 'exact') {
      return mappedFields.longitude && mappedFields.latitude;
    }
    if (m === 'centroid' || m === 'random') {
      return mappedFields.adm3 || (mappedFields.adm1 && mappedFields.adm2);
    }
    if (m === 'maille') {
      return mappedFields.maille_code;
    }
    return true; // unknown
  }
</script>

<div class="geoloc-selector">
  <h3>Mode de géolocalisation</h3>

  <label class="mode-option">
    <input type="radio" bind:group={mode} value="exact" />
    <div class="option-content">
      <strong>Coordonnées exactes</strong>
      <p>Utiliser longitude/latitude du fichier</p>
      {#if mode === 'exact'}
        <div class="config">
          <select bind:value={mappedFields.longitude}>
            <option value="">Colonne longitude</option>
            {#each fileColumns as col}<option>{col}</option>{/each}
          </select>
          <select bind:value={mappedFields.latitude}>
            <option value="">Colonne latitude</option>
            {#each fileColumns as col}<option>{col}</option>{/each}
          </select>
        </div>
      {/if}
    </div>
  </label>

  <label class="mode-option">
    <input type="radio" bind:group={mode} value="centroid" />
    <div class="option-content">
      <strong>Centroïde zone administrative</strong>
      <p>Calculer le centre géométrique de la commune (ADM3)</p>
      {#if mode === 'centroid'}
        <div class="config">
          <p class="info">Nécessite colonne Commune/ADM3 mappée</p>
        </div>
      {/if}
    </div>
  </label>

  <label class="mode-option">
    <input type="radio" bind:group={mode} value="random" />
    <div class="option-content">
      <strong>Point aléatoire déterministe</strong>
      <p>Générer un point dans la zone avec seed fixe</p>
      {#if mode === 'random'}
        <div class="config">
          <label>
            Seed aléatoire :
            <input type="text" bind:value={randomSeed} />
            <button on:click={() => randomSeed = generateSeed()}>
              Régénérer
            </button>
          </label>
          <label>
            Jitter max (mètres) :
            <input type="number" bind:value={randomJitter} min="0" max="1000" />
          </label>
        </div>
      {/if}
    </div>
  </label>

  <label class="mode-option">
    <input type="radio" bind:group={mode} value="maille" />
    <div class="option-content">
      <strong>Centroïde maille</strong>
      <p>Utiliser le centre d'une maille de grille</p>
      {#if mode === 'maille'}
        <div class="config">
          <select bind:value={mappedFields.maille_code}>
            <option value="">Colonne code maille</option>
            {#each fileColumns as col}<option>{col}</option>{/each}
          </select>
        </div>
      {/if}
    </div>
  </label>

  <label class="mode-option">
    <input type="radio" bind:group={mode} value="unknown" />
    <div class="option-content">
      <strong>Pas de coordonnées</strong>
      <p>Stocker uniquement zones administratives</p>
    </div>
  </label>
</div>

<div class="actions">
  <button on:click={() => goto('step2')}>← Retour</button>
  <button on:click={() => goto('step4')} disabled={!configValid}>
    Prévisualiser →
  </button>
</div>
```

#### Step4_Preview.ts
```typescript
// Prévisualisation avec tableau + carte

<script lang="ts">
  import { onMount } from 'svelte';
  import L from 'leaflet';

  let previewData: any[] = [];
  let map: L.Map;
  let loading = true;

  onMount(async () => {
    // Appel dry-run
    const res = await fetch('/api/v1/surveys/bulk-import/dry-run', {
      method: 'POST',
      body: JSON.stringify({
        file: fileData,
        mapping: mappedFields,
        geoloc_config: { mode, seed: randomSeed, jitter: randomJitter }
      })
    });

    const result = await res.json();
    previewData = result.preview;
    loading = false;

    // Initialiser carte
    map = L.map('preview-map').setView([8.5, 1.0], 7);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map);

    // Ajouter markers
    previewData.forEach(row => {
      if (row.longitude && row.latitude) {
        L.marker([row.latitude, row.longitude])
          .bindPopup(`<strong>${row.localite}</strong><br>${row.code_sondage}`)
          .addTo(map);
      }
    });
  });
</script>

<div class="preview-layout">
  <div class="preview-table">
    <h3>Aperçu des données ({previewData.length} lignes)</h3>

    {#if loading}
      <div class="loading">Calcul en cours...</div>
    {:else}
      <table>
        <thead>
          <tr>
            <th>Statut</th>
            <th>Localité</th>
            <th>Code</th>
            <th>Date</th>
            <th>Coords</th>
            <th>Essais</th>
            <th>Erreurs/Warnings</th>
          </tr>
        </thead>
        <tbody>
          {#each previewData as row}
            <tr class={row.status}>
              <td>
                {#if row.status === 'ok'}
                  <span class="badge ok">✓</span>
                {:else if row.status === 'warning'}
                  <span class="badge warning">⚠</span>
                {:else}
                  <span class="badge error">✗</span>
                {/if}
              </td>
              <td>{row.localite}</td>
              <td>{row.code_sondage}</td>
              <td>{row.date_sondage}</td>
              <td>
                {#if row.longitude}
                  {row.longitude.toFixed(4)}, {row.latitude.toFixed(4)}
                {:else}
                  -
                {/if}
              </td>
              <td>{row.tests_count} essais</td>
              <td>
                {#if row.errors?.length > 0}
                  <ul class="errors">
                    {#each row.errors as err}<li>{err}</li>{/each}
                  </ul>
                {/if}
                {#if row.warnings?.length > 0}
                  <ul class="warnings">
                    {#each row.warnings as warn}<li>{warn}</li>{/each}
                  </ul>
                {/if}
              </td>
            </tr>
          {/each}
        </tbody>
      </table>

      <div class="stats">
        <span class="ok">{result.stats.ok} OK</span>
        <span class="warning">{result.stats.warnings} Warnings</span>
        <span class="error">{result.stats.errors} Erreurs</span>
      </div>
    {/if}
  </div>

  <div class="preview-map-container">
    <h3>Localisation</h3>
    <div id="preview-map"></div>
  </div>
</div>

<div class="actions">
  <button on:click={() => goto('step3')}>← Retour</button>
  <button on:click={startImport}
          disabled={result.stats.errors > 0}>
    Lancer l'import ({result.stats.ok} sondages)
  </button>
</div>
```

#### Step5_Progress.ts
```typescript
// Suivi progression import en temps réel

<script lang="ts">
  import { onMount, onDestroy } from 'svelte';

  let importId: string;
  let status: ImportStatus = 'pending';
  let progress = 0;
  let stats = { succeeded: 0, errors: 0, warnings: 0 };
  let pollInterval: any;

  onMount(async () => {
    // Démarrer import
    const res = await fetch('/api/v1/surveys/bulk-import/async', {
      method: 'POST',
      body: JSON.stringify({ /* config */ })
    });

    const data = await res.json();
    importId = data.import_id;

    // Polling statut
    pollInterval = setInterval(pollStatus, 1000);
  });

  onDestroy(() => {
    clearInterval(pollInterval);
  });

  async function pollStatus() {
    const res = await fetch(`/api/v1/surveys/bulk-import/status/${importId}`);
    const data = await res.json();

    status = data.status;
    progress = data.progress;
    stats = data.stats;

    if (status === 'succeeded' || status === 'failed' || status === 'cancelled') {
      clearInterval(pollInterval);
    }
  }

  async function cancelImport() {
    await fetch(`/api/v1/surveys/bulk-import/cancel/${importId}`, {
      method: 'POST'
    });
  }
</script>

<div class="progress-view">
  <h3>Import en cours...</h3>

  <div class="progress-bar">
    <div class="fill" style="width: {progress}%"></div>
    <span class="label">{progress.toFixed(1)}%</span>
  </div>

  <div class="status">
    {#if status === 'pending'}
      <p>⏳ En attente de démarrage...</p>
    {:else if status === 'running'}
      <p>⚙️ Import en cours...</p>
    {:else if status === 'succeeded'}
      <p class="success">✅ Import terminé avec succès !</p>
    {:else if status === 'partial'}
      <p class="warning">⚠️ Import terminé avec erreurs partielles</p>
    {:else if status === 'failed'}
      <p class="error">❌ Échec de l'import</p>
    {:else if status === 'cancelled'}
      <p class="cancelled">🚫 Import annulé</p>
    {/if}
  </div>

  <div class="live-stats">
    <div class="stat ok">
      <strong>{stats.succeeded}</strong>
      <span>Sondages créés</span>
    </div>
    <div class="stat warning">
      <strong>{stats.warnings}</strong>
      <span>Warnings</span>
    </div>
    <div class="stat error">
      <strong>{stats.errors}</strong>
      <span>Erreurs</span>
    </div>
  </div>

  {#if status === 'running'}
    <button class="cancel" on:click={cancelImport}>
      Annuler l'import
    </button>
  {/if}

  {#if status === 'succeeded' || status === 'partial'}
    <div class="actions">
      <a href="/api/v1/surveys/bulk-import/report/{importId}?format=csv">
        Télécharger rapport CSV
      </a>
      <button on:click={() => goto('/surveys')}>
        Voir les sondages
      </button>
      <button on:click={startNewImport}>
        Nouvel import
      </button>
    </div>
  {/if}
</div>
```

**Estimation totale frontend** : 7 jours

---

## 📅 PLAN D'ACTION RECOMMANDÉ

### Sprint 1 - Déblocage MVP (5 jours)
**Objectif** : Rendre l'import CSV fonctionnel end-to-end

| Jour | Tâche | Fichier | Estimation |
|------|-------|---------|------------|
| J1 | Corriger bug latitude | validator.rs | 0.5h |
| J1 | Implémenter `process_import()` | importer.rs | 6h |
| J1 | Tests unitaires import | importer_test.rs | 1.5h |
| J2 | Implémenter job queue async | job_queue.rs | 6h |
| J2 | Intégrer queue dans routes | routes.rs | 2h |
| J3 | Implémenter centroid PostGIS | geolocation.rs | 4h |
| J3 | Implémenter random point | geolocation.rs | 4h |
| J4 | Frontend Step1 (Upload) | Step1_Upload.ts | 6h |
| J4 | Frontend Step5 (Progress) | Step5_Progress.ts | 2h |
| J5 | Tests end-to-end | integration_test.rs | 4h |
| J5 | Documentation + démo | README.md | 2h |

**Livrables** :
- ✅ Import CSV fonctionnel
- ✅ Mode centroid/random opérationnels
- ✅ UI upload + progression
- ✅ Tests automatisés

---

### Sprint 2 - Enrichissement (5 jours)
**Objectif** : Profils, XLSX, JSON, UI complète

| Jour | Tâche | Fichier | Estimation |
|------|-------|---------|------------|
| J1 | Implémenter CRUD profils | routes.rs | 4h |
| J1 | Parser XLSX (calamine) | parser.rs | 4h |
| J2 | Parser JSON | parser.rs | 2h |
| J2 | Améliorer matching ADM | matcher.rs | 4h |
| J2 | Détection doublons | validator.rs | 2h |
| J3 | Frontend Step2 (Mapping) | Step2_Mapping.ts | 6h |
| J3 | Auto-détection mapping | detector.rs | 2h |
| J4 | Frontend Step3 (Geoloc) | Step3_Geolocation.ts | 6h |
| J4 | UI profils mapping | ProfileManager.ts | 2h |
| J5 | Frontend Step4 (Preview) | Step4_Preview.ts | 6h |
| J5 | Intégration carte Leaflet | MapPreview.ts | 2h |

**Livrables** :
- ✅ Support XLSX et JSON
- ✅ UI complète 5 étapes
- ✅ Profils réutilisables
- ✅ Prévisualisation interactive

---

### Sprint 3 - Optimisation (3 jours)
**Objectif** : Performance, UX, robustesse

| Jour | Tâche | Fichier | Estimation |
|------|-------|---------|------------|
| J1 | Traitement batch (chunks) | importer.rs | 4h |
| J1 | Gestion mémoire gros fichiers | parser.rs | 4h |
| J2 | Amélioration messages erreur | validator.rs | 3h |
| J2 | Rollback partiel | rollback.rs | 3h |
| J2 | Export rapport Excel | reporter.rs | 2h |
| J3 | Tests charge (10k lignes) | load_test.rs | 4h |
| J3 | Optimisation requêtes SQL | importer.rs | 2h |
| J3 | Documentation utilisateur | USER_GUIDE.md | 2h |

**Livrables** :
- ✅ Performance 10k+ lignes
- ✅ Gestion erreurs avancée
- ✅ Rollback sécurisé
- ✅ Documentation complète

---

## 🧪 TESTS REQUIS

### Tests unitaires

```rust
// tests/import_bulk/parser_test.rs
#[tokio::test]
async fn test_csv_parser_auto_detect_separator() {
    let csv = b"col1,col2\nval1,val2";
    let rows = CsvParser::parse(csv).unwrap();
    assert_eq!(rows[0]["col1"], "val1");
}

#[tokio::test]
async fn test_xlsx_parser() {
    let xlsx = include_bytes!("fixtures/test.xlsx");
    let rows = XlsxParser::parse(xlsx).unwrap();
    assert!(rows.len() > 0);
}

#[tokio::test]
async fn test_json_parser() {
    let json = br#"[{"col1":"val1","col2":"val2"}]"#;
    let rows = JsonParser::parse(json).unwrap();
    assert_eq!(rows[0]["col1"], "val1");
}

// tests/import_bulk/validator_test.rs
#[tokio::test]
async fn test_togo_bounds_validation() {
    let valid = validate_coordinates(8.5, 1.0);
    assert!(valid.is_ok());

    let invalid_lat = validate_coordinates(15.0, 1.0);
    assert!(invalid_lat.is_err());
}

#[tokio::test]
async fn test_duplicate_detection() {
    // Créer sondage
    // Tenter import doublon
    // Vérifier warning
}

// tests/import_bulk/importer_test.rs
#[tokio::test]
async fn test_process_import_creates_surveys() {
    let pool = setup_test_db().await;

    let rows = vec![ValidatedRow {
        localite: "Lomé".to_string(),
        date_sondage: Some(NaiveDate::from_ymd(2024, 1, 15)),
        // ...
    }];

    let import_id = Uuid::new_v4();
    let stats = process_import(&pool, import_id, rows, &default_geoloc()).await.unwrap();

    assert_eq!(stats.succeeded, 1);

    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sondages WHERE import_id = $1")
        .bind(import_id)
        .fetch_one(&pool)
        .await
        .unwrap();

    assert_eq!(count, 1);
}
```

### Tests d'intégration

```rust
// tests/integration/bulk_import_test.rs

#[tokio::test]
async fn test_full_import_workflow() {
    let app = setup_test_server().await;

    // 1. Upload fichier
    let file = include_bytes!("fixtures/granulometrie.csv");
    let res = app.post("/api/v1/surveys/bulk-import/async")
        .multipart_form(&[("file", file)])
        .await;

    assert_eq!(res.status(), 200);
    let body: ImportResponse = res.json().await;
    let import_id = body.import_id;

    // 2. Attendre fin import
    let mut status = ImportStatus::Pending;
    for _ in 0..30 {
        tokio::time::sleep(Duration::from_secs(1)).await;

        let res = app.get(&format!("/api/v1/surveys/bulk-import/status/{}", import_id))
            .await;
        let data: StatusResponse = res.json().await;
        status = data.status;

        if status == ImportStatus::Succeeded {
            break;
        }
    }

    assert_eq!(status, ImportStatus::Succeeded);

    // 3. Vérifier sondages créés
    let pool = app.db_pool();
    let count: i64 = sqlx::query_scalar("SELECT COUNT(*) FROM sondages WHERE import_id = $1")
        .bind(import_id)
        .fetch_one(pool)
        .await
        .unwrap();

    assert!(count > 0);
}

#[tokio::test]
async fn test_dry_run_validation() {
    let app = setup_test_server().await;

    let file = include_bytes!("fixtures/invalid_data.csv");
    let res = app.post("/api/v1/surveys/bulk-import/dry-run")
        .multipart_form(&[("file", file)])
        .await;

    assert_eq!(res.status(), 200);
    let body: DryRunResult = res.json().await;

    assert!(body.stats.errors > 0);
    assert!(body.preview.iter().any(|r| r.status == ItemStatus::Error));
}
```

### Tests UI (E2E)

```typescript
// ui/tests/import-bulk.spec.ts

import { test, expect } from '@playwright/test';

test('full import workflow', async ({ page }) => {
  await page.goto('/import-bulk');

  // Step 1: Upload
  const fileInput = page.locator('input[type="file"]');
  await fileInput.setInputFiles('fixtures/granulometrie.csv');
  await page.waitForSelector('.file-info');
  await page.click('button:has-text("Suivant")');

  // Step 2: Mapping
  await page.waitForSelector('.mapping-grid');
  await page.click('button:has-text("Mapping automatique")');
  await page.click('button:has-text("Suivant")');

  // Step 3: Geolocation
  await page.click('input[value="centroid"]');
  await page.click('button:has-text("Prévisualiser")');

  // Step 4: Preview
  await page.waitForSelector('.preview-table table');
  const rows = await page.locator('.preview-table tbody tr').count();
  expect(rows).toBeGreaterThan(0);
  await page.click('button:has-text("Lancer l\'import")');

  // Step 5: Progress
  await page.waitForSelector('.progress-bar');
  await page.waitForSelector('.success', { timeout: 60000 });

  const successText = await page.locator('.success').textContent();
  expect(successText).toContain('terminé avec succès');
});
```

---

## 📊 MÉTRIQUES DE SUCCÈS

### Phase 1 - MVP
- ✅ Import CSV simple réussi (100 lignes)
- ✅ Validation erreurs détectées
- ✅ Sondages créés en DB
- ✅ Mode centroid fonctionnel
- ✅ UI upload + progression

### Phase 2 - Production
- ✅ Support XLSX et JSON
- ✅ UI complète 5 étapes
- ✅ Profils mapping réutilisables
- ✅ Import async non bloquant
- ✅ Performance < 10s pour 1000 lignes

### Phase 3 - Excellence
- ✅ Import 10k+ lignes (< 2 min)
- ✅ Rollback partiel
- ✅ Export rapports Excel
- ✅ Tests couverture > 80%
- ✅ Documentation utilisateur

---

## 🔗 RÉFÉRENCES

### Code existant
- Migration DB : `db/migrations/009_import_bulk.sql`
- Routes API : `services/api-geo/src/import_bulk/routes.rs`
- Parser CSV : `services/api-geo/src/import_bulk/parser.rs`
- Types : `services/api-geo/src/import_bulk/types.rs`

### Documentation
- Cahier des charges v1 : `docs/CAHIER_CHARGES_IMPORT_BULK.md`
- Décisions techniques : `docs/IMPORT_BULK_DECISIONS.md`
- Roadmap : `docs/IMPORT_BULK_SUMMARY.md`

### Dépendances à ajouter
```toml
# Cargo.toml
[dependencies]
calamine = "0.22"           # Parser XLSX
tokio-util = "0.7"          # CancellationToken
lazy_static = "1.4"         # Job queue global

# package.json
{
  "dependencies": {
    "svelte-dnd-action": "^0.9.0",  // Drag & drop
    "leaflet": "^1.9.4"             // Carte
  }
}
```

---

## ✅ CHECKLIST DE DÉPLOIEMENT

### Avant mise en production

- [ ] Tous les tests unitaires passent
- [ ] Tests d'intégration end-to-end OK
- [ ] Tests de charge validés (10k lignes)
- [ ] Documentation utilisateur rédigée
- [ ] Migration DB appliquée en staging
- [ ] Revue de code complétée
- [ ] Logs structurés configurés
- [ ] Monitoring alertes configurées
- [ ] Rollback plan documenté
- [ ] Formation utilisateurs effectuée

### Critères d'acceptation

1. **Fonctionnel** :
   - ✅ Import CSV, XLSX, JSON fonctionnels
   - ✅ 5 modes géolocalisation opérationnels
   - ✅ Validation détectant erreurs critiques
   - ✅ UI intuitive sans formation

2. **Performance** :
   - ✅ 1000 lignes en < 10s
   - ✅ 10000 lignes en < 2 min
   - ✅ Pas de timeout API

3. **Robustesse** :
   - ✅ Gestion erreurs ligne par ligne
   - ✅ Transactions atomiques par sondage
   - ✅ Détection doublons fonctionnelle
   - ✅ Annulation import possible

4. **UX** :
   - ✅ Messages erreur explicites
   - ✅ Progression temps réel
   - ✅ Rapport téléchargeable
   - ✅ Profils mapping réutilisables

---

**Document généré le** : 19 octobre 2025
**Prochaine révision** : Après Sprint 1 (MVP)
**Contact** : Équipe Atlas Togo
