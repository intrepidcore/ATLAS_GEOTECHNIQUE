use std::path::Path;
use std::path::PathBuf;
use uuid::Uuid;
use sqlx::PgPool;
use sqlx::Row;
use chrono::Utc;
use tokio::fs;
use rust_xlsxwriter::Workbook;

use crate::AppState;
use crate::auth::AuthUser;
use crate::export::formats::{ExportRequest, ExportDataSource, ExportFormat, ExportFilters, ExportJobResponse, ExportJobStatus};
use crate::export::jobs::ExportJob;

pub struct ExportService {
    pool: PgPool,
}

impl ExportService {
    pub fn new(pool: PgPool) -> Self {
        Self { pool }
    }

    /// Lance un export asynchrone
    pub async fn create_export_job(
        &self,
        request: ExportRequest,
        auth_user: AuthUser,
    ) -> Result<ExportJobResponse, (String, u16)> {
        let job = ExportJob::new(
            request.source.clone(),
            request.format.clone(),
            request.filters.clone(),
            auth_user.username.clone(),
        );

        // Persister le job en BDD
        let query = r#"
            INSERT INTO atlas.colab_export_jobs (
                id, source, format, filters, status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        "#;

        let filters_json = serde_json::to_value(&request.filters)
            .map_err(|e| (format!("Erreur sérialisation filtres: {}", e), 500))?;

        sqlx::query(query)
            .bind(job.id)
            .bind(job.source.to_string())
            .bind(job.format.to_string())
            .bind(filters_json)
            .bind(job.status.to_string()) // <-- Convertir en string
            .bind(&job.created_by)
            .bind(job.created_at)
            .execute(&self.pool)
            .await
            .map_err(|e| (format!("Erreur BDD création job: {}", e), 500))?;

        // Log audit
        if let Err(e) = self.log_action(job.id, "created", &auth_user.username, Some(serde_json::to_value(&request).unwrap())).await {
            tracing::error!("Erreur log audit création export job {}: {}", job.id, e);
        }

        // Lancer le job en arrière-plan (Tokio spawn)
        let pool = self.pool.clone();
        let job_id = job.id;
        tokio::spawn(async move {
            if let Err(e) = Self::run_export_job(pool, job_id).await {
                tracing::error!("Export job {} failed: {}", job_id, e);
            }
        });

        Ok(ExportJobResponse {
            job_id: job.id,
            status: job.status,
            created_at: job.created_at,
            started_at: job.started_at,
            finished_at: job.finished_at,
            file_path: job.file_path,
            error: job.error,
        })
    }

    /// Récupère le statut d’un job
    pub async fn get_job_status(&self, job_id: Uuid) -> Result<Option<ExportJobResponse>, (String, u16)> {
        let row_opt = sqlx::query(
            r#"
                SELECT id, status, created_at, started_at, finished_at, file_path, error
                FROM atlas.colab_export_jobs
                WHERE id = $1
            "#,
        )
        .bind(job_id)
        .fetch_optional(&self.pool)
        .await
        .map_err(|e| (format!("Erreur BDD récupération job: {}", e), 500))?;

        if let Some(row) = row_opt {
            let status: String = row.get("status");
            Ok(Some(ExportJobResponse {
                job_id: row.get("id"),
                status: parse_job_status(&status),
                created_at: row.get("created_at"),
                started_at: row.try_get("started_at").ok(),
                finished_at: row.try_get("finished_at").ok(),
                file_path: row.try_get("file_path").ok(),
                error: row.try_get("error").ok(),
            }))
        } else {
            Ok(None)
        }
    }

    /// Historique des exports (consultable)
    pub async fn get_export_history(&self, auth_user: AuthUser) -> Result<Vec<ExportJobResponse>, (String, u16)> {
        let rows = sqlx::query(
            r#"
                SELECT id, status, created_at, started_at, finished_at, file_path, error
                FROM atlas.colab_export_jobs
                WHERE created_by = $1
                ORDER BY created_at DESC
                LIMIT 50
            "#,
        )
        .bind(auth_user.username)
        .fetch_all(&self.pool)
        .await
        .map_err(|e| (format!("Erreur BDD historique: {}", e), 500))?;

        let history = rows
            .into_iter()
            .map(|row| {
                let status: String = row.get("status");
                ExportJobResponse {
                    job_id: row.get("id"),
                    status: parse_job_status(&status),
                    created_at: row.get("created_at"),
                    started_at: row.try_get("started_at").ok(),
                    finished_at: row.try_get("finished_at").ok(),
                    file_path: row.try_get("file_path").ok(),
                    error: row.try_get("error").ok(),
                }
            })
            .collect();

        Ok(history)
    }

    /// Exécute un job (arrière-plan)
    async fn run_export_job(pool: PgPool, job_id: Uuid) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Marquer comme démarré
        sqlx::query("UPDATE atlas.colab_export_jobs SET status = 'running', started_at = NOW() WHERE id = $1")
            .bind(job_id)
            .execute(&pool)
            .await?;

        // Récupérer les détails du job
        let job_row = sqlx::query("SELECT source, format, filters FROM atlas.colab_export_jobs WHERE id = $1")
            .bind(job_id)
            .fetch_one(&pool)
            .await?;

        let source_str: String = job_row.get("source");
        let format_str: String = job_row.get("format");
        let filters_val: serde_json::Value = job_row.get("filters");

        let source = ExportDataSource::from_db_str(&source_str)
            .ok_or_else(|| format!("Source export inconnue: {}", source_str))?;
        let format = ExportFormat::from_db_str(&format_str)
            .ok_or_else(|| format!("Format export inconnu: {}", format_str))?;
        let filters: ExportFilters = serde_json::from_value(filters_val)?;

        let export_dir = std::env::var("EXPORT_DIR").unwrap_or_else(|_| "exports".to_string());
        let export_dir_path = PathBuf::from(&export_dir);

        // Créer le dossier exports si besoin
        fs::create_dir_all(&export_dir_path).await?;

        // Générer le fichier
        let filename = format!("{}_{}.{}", source, job_id, format);
        let full_path = export_dir_path.join(&filename);
        let file_path = full_path.to_string_lossy().to_string();

        // Générer le fichier selon source/format/filters
        if let Err(e) = Self::generate_export_file(&pool, &full_path, &source, &format, &filters).await {
            let err_str = format!("{}", e);
            sqlx::query(
                "UPDATE atlas.colab_export_jobs SET status = 'failed', finished_at = NOW(), error = $1 WHERE id = $2",
            )
            .bind(&err_str)
            .bind(job_id)
            .execute(&pool)
            .await?;

            return Err(err_str.into());
        }

        let file_size = fs::metadata(&full_path).await?.len();

        // Marquer comme complété
        sqlx::query(
            "UPDATE atlas.colab_export_jobs SET status = 'completed', finished_at = NOW(), file_path = $1, file_size = $2 WHERE id = $3",
        )
        .bind(file_path)
        .bind(file_size as i64)
        .bind(job_id)
        .execute(&pool)
        .await?;

        Ok(())
    }

    async fn generate_export_file(
        pool: &PgPool,
        full_path: &Path,
        source: &ExportDataSource,
        format: &ExportFormat,
        filters: &ExportFilters,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Sécurité volumétrie (Phase 1)
        let max_rows: i64 = 10_000;

        match format {
            ExportFormat::Json => {
                let data = Self::fetch_source_as_json(pool, source, filters, max_rows).await?;
                let bytes = serde_json::to_vec_pretty(&data)?;
                fs::write(full_path, bytes).await?;
                Ok(())
            }
            ExportFormat::Csv => {
                let rows = Self::fetch_source_as_json(pool, source, filters, max_rows).await?;
                Self::write_csv(full_path, rows).await?;
                Ok(())
            }
            ExportFormat::Xlsx => {
                let rows = Self::fetch_source_as_json(pool, source, filters, max_rows).await?;
                Self::write_xlsx(full_path, source, rows)?;
                Ok(())
            }
            ExportFormat::Pdf | ExportFormat::GeoJson => {
                Err(format!("Format non implémenté en Phase 1: {}", format).into())
            }
        }
    }

    async fn fetch_source_as_json(
        pool: &PgPool,
        source: &ExportDataSource,
        filters: &ExportFilters,
        max_rows: i64,
    ) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
        match source {
            ExportDataSource::Missions => {
                // Phase 1: filtre simple par status/theme + date_range (created_at)
                let mut conditions: Vec<String> = vec!["m.deleted_at IS NULL".to_string()];
                if let Some(status) = &filters.status {
                    if !status.is_empty() {
                        let list = status
                            .iter()
                            .map(|s| format!("'{}'", s.replace('\'', "''")))
                            .collect::<Vec<_>>()
                            .join(",");
                        conditions.push(format!("m.status::TEXT IN ({})", list));
                    }
                }
                if let Some(theme) = &filters.theme {
                    if !theme.is_empty() {
                        let list = theme
                            .iter()
                            .map(|s| format!("'{}'", s.replace('\'', "''")))
                            .collect::<Vec<_>>()
                            .join(",");
                        conditions.push(format!("m.theme::TEXT IN ({})", list));
                    }
                }
                if let Some(dr) = &filters.date_range {
                    conditions.push(format!(
                        "m.created_at::DATE BETWEEN '{}' AND '{}'",
                        dr.start, dr.end
                    ));
                }

                let where_clause = conditions.join(" AND ");
                let query = format!(
                    r#"
                    SELECT
                        m.id,
                        m.code,
                        m.title,
                        m.theme::TEXT as theme,
                        m.status::TEXT as status,
                        m.commune,
                        m.region,
                        m.maille_id,
                        ma.code as maille_code,
                        ma.pref_code,
                        ma.pref_name,
                        ma.adm1_name,
                        ma.adm2_name,
                        ma.adm3_name,
                        ST_XMin(ST_Transform(ma.geom, 4326)) as bbox_xmin,
                        ST_YMin(ST_Transform(ma.geom, 4326)) as bbox_ymin,
                        ST_XMax(ST_Transform(ma.geom, 4326)) as bbox_xmax,
                        ST_YMax(ST_Transform(ma.geom, 4326)) as bbox_ymax,
                        m.start_date,
                        m.end_date,
                        m.expected_sondages,
                        m.created_at,
                        m.updated_at,
                        s.id as supervisor_id,
                        COALESCE(u.first_name || ' ' || u.last_name, u.username) as supervisor_name
                    FROM atlas.colab_missions m
                    LEFT JOIN atlas.mailles ma ON m.maille_id = ma.id
                    LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
                    LEFT JOIN atlas.users u ON s.user_id = u.id
                    WHERE {}
                    ORDER BY m.created_at DESC
                    LIMIT {}
                    "#,
                    where_clause,
                    max_rows
                );

                let rows = sqlx::query(&query).fetch_all(pool).await?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        serde_json::json!({
                            "id": r.get::<Uuid, _>("id"),
                            "code": r.get::<String, _>("code"),
                            "title": r.get::<String, _>("title"),
                            "theme": r.get::<String, _>("theme"),
                            "status": r.get::<String, _>("status"),
                            "commune": r.get::<Option<String>, _>("commune"),
                            "region": r.get::<Option<String>, _>("region"),
                            "maille_id": r.try_get::<Option<Uuid>, _>("maille_id").ok(),
                            "maille_code": r.try_get::<Option<String>, _>("maille_code").ok(),
                            "pref_code": r.try_get::<Option<String>, _>("pref_code").ok(),
                            "pref_name": r.try_get::<Option<String>, _>("pref_name").ok(),
                            "adm1_name": r.try_get::<Option<String>, _>("adm1_name").ok(),
                            "adm2_name": r.try_get::<Option<String>, _>("adm2_name").ok(),
                            "adm3_name": r.try_get::<Option<String>, _>("adm3_name").ok(),
                            "bbox_wgs84": {
                                "xmin": r.try_get::<Option<f64>, _>("bbox_xmin").ok(),
                                "ymin": r.try_get::<Option<f64>, _>("bbox_ymin").ok(),
                                "xmax": r.try_get::<Option<f64>, _>("bbox_xmax").ok(),
                                "ymax": r.try_get::<Option<f64>, _>("bbox_ymax").ok(),
                            },
                            "start_date": r.try_get::<Option<chrono::NaiveDate>, _>("start_date").ok(),
                            "end_date": r.try_get::<Option<chrono::NaiveDate>, _>("end_date").ok(),
                            "expected_sondages": r.get::<i32, _>("expected_sondages"),
                            "created_at": r.get::<chrono::DateTime<chrono::Utc>, _>("created_at"),
                            "updated_at": r.get::<chrono::DateTime<chrono::Utc>, _>("updated_at"),
                            "supervisor_id": r.try_get::<Option<Uuid>, _>("supervisor_id").ok(),
                            "supervisor_name": r.try_get::<Option<String>, _>("supervisor_name").ok(),
                        })
                    })
                    .collect())
            }
            ExportDataSource::Students => {
                let rows = sqlx::query(
                    r#"
                    SELECT 
                        s.id,
                        s.user_id,
                        u.username,
                        u.email,
                        COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
                        u.telephone,
                        s.matricule,
                        s.promotion,
                        s.filiere,
                        s.etablissement,
                        s.niveau,
                        s.age,
                        u.is_active,
                        (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL) as active_missions
                    FROM atlas.colab_students s
                    JOIN atlas.users u ON s.user_id = u.id
                    WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
                    ORDER BY s.promotion DESC, full_name
                    LIMIT $1
                    "#,
                )
                .bind(max_rows)
                .fetch_all(pool)
                .await?;

                Ok(rows
                    .into_iter()
                    .map(|r| {
                        serde_json::json!({
                            "id": r.get::<Uuid, _>("id"),
                            "user_id": r.get::<Uuid, _>("user_id"),
                            "username": r.get::<String, _>("username"),
                            "email": r.get::<String, _>("email"),
                            "full_name": r.get::<String, _>("full_name"),
                            "telephone": r.get::<Option<String>, _>("telephone"),
                            "matricule": r.get::<Option<String>, _>("matricule"),
                            "promotion": r.get::<String, _>("promotion"),
                            "filiere": r.get::<Option<String>, _>("filiere"),
                            "etablissement": r.get::<Option<String>, _>("etablissement"),
                            "niveau": r.get::<Option<String>, _>("niveau"),
                            "age": r.get::<Option<i32>, _>("age"),
                            "is_active": r.get::<bool, _>("is_active"),
                            "active_missions": r.get::<i64, _>("active_missions"),
                        })
                    })
                    .collect())
            }
            ExportDataSource::Supervisors => {
                let rows = sqlx::query(
                    r#"
                    SELECT 
                        s.id,
                        s.user_id,
                        u.username,
                        COALESCE(u.first_name || ' ' || u.last_name, u.username) as full_name,
                        s.specialite,
                        s.institution,
                        u.is_active
                    FROM atlas.colab_supervisors s
                    JOIN atlas.users u ON s.user_id = u.id
                    WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
                    ORDER BY u.is_active DESC, full_name
                    LIMIT $1
                    "#,
                )
                .bind(max_rows)
                .fetch_all(pool)
                .await?;

                Ok(rows
                    .into_iter()
                    .map(|r| {
                        serde_json::json!({
                            "id": r.get::<Uuid, _>("id"),
                            "user_id": r.get::<Uuid, _>("user_id"),
                            "username": r.get::<String, _>("username"),
                            "full_name": r.get::<String, _>("full_name"),
                            "specialite": r.get::<Option<String>, _>("specialite"),
                            "institution": r.get::<Option<String>, _>("institution"),
                            "is_active": r.get::<bool, _>("is_active"),
                        })
                    })
                    .collect())
            }
            ExportDataSource::Documents => {
                let rows = sqlx::query(
                    r#"
                    SELECT
                        d.id,
                        d.mission_id,
                        d.uploaded_by,
                        d.title,
                        d.document_type::TEXT as document_type,
                        d.description,
                        d.file_name,
                        d.file_size_bytes,
                        d.mime_type,
                        d.sondage_id,
                        d.version,
                        d.is_current,
                        d.uploaded_at
                    FROM atlas.colab_documents d
                    WHERE d.deleted_at IS NULL
                    ORDER BY d.uploaded_at DESC
                    LIMIT $1
                    "#,
                )
                .bind(max_rows)
                .fetch_all(pool)
                .await?;

                Ok(rows
                    .into_iter()
                    .map(|r| {
                        serde_json::json!({
                            "id": r.get::<Uuid, _>("id"),
                            "mission_id": r.get::<Uuid, _>("mission_id"),
                            "uploaded_by": r.get::<Uuid, _>("uploaded_by"),
                            "title": r.get::<String, _>("title"),
                            "document_type": r.get::<String, _>("document_type"),
                            "description": r.get::<Option<String>, _>("description"),
                            "file_name": r.get::<String, _>("file_name"),
                            "file_size_bytes": r.get::<Option<i64>, _>("file_size_bytes"),
                            "mime_type": r.get::<Option<String>, _>("mime_type"),
                            "sondage_id": r.get::<Option<Uuid>, _>("sondage_id"),
                            "version": r.get::<i32, _>("version"),
                            "is_current": r.get::<bool, _>("is_current"),
                            "uploaded_at": r.get::<chrono::DateTime<chrono::Utc>, _>("uploaded_at"),
                        })
                    })
                    .collect())
            }
            _ => Err(format!("Source non implémentée en Phase 1: {}", source).into()),
        }
    }

    async fn write_csv(
        full_path: &Path,
        rows: Vec<serde_json::Value>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut wtr = csv::Writer::from_writer(vec![]);

        // CSV "plat": on utilise les clés du premier objet comme header
        let header_keys: Vec<String> = rows
            .get(0)
            .and_then(|v| v.as_object())
            .map(|o| o.keys().cloned().collect())
            .unwrap_or_default();

        if !header_keys.is_empty() {
            wtr.write_record(&header_keys)?;
        }

        for row in rows {
            let obj = row.as_object().cloned().unwrap_or_default();
            let record = header_keys
                .iter()
                .map(|k| obj.get(k).map(Self::json_to_csv_cell).unwrap_or_default())
                .collect::<Vec<_>>();
            wtr.write_record(&record)?;
        }

        let bytes = wtr.into_inner()?;
        fs::write(full_path, bytes).await?;
        Ok(())
    }

    fn json_to_csv_cell(v: &serde_json::Value) -> String {
        match v {
            serde_json::Value::Null => "".to_string(),
            serde_json::Value::Bool(b) => b.to_string(),
            serde_json::Value::Number(n) => n.to_string(),
            serde_json::Value::String(s) => s.clone(),
            _ => v.to_string(),
        }
    }

    fn write_xlsx(
        full_path: &Path,
        source: &ExportDataSource,
        rows: Vec<serde_json::Value>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut workbook = Workbook::new();
        let sheet_name = source.to_string();
        let worksheet = workbook.add_worksheet().set_name(&sheet_name)?;

        let header_keys: Vec<String> = rows
            .get(0)
            .and_then(|v| v.as_object())
            .map(|o| o.keys().cloned().collect())
            .unwrap_or_default();

        for (col, key) in header_keys.iter().enumerate() {
            worksheet.write_string(0, col as u16, key)?;
        }

        for (row_idx, row_val) in rows.iter().enumerate() {
            let obj = row_val.as_object();
            for (col, key) in header_keys.iter().enumerate() {
                let cell = obj.and_then(|o| o.get(key)).unwrap_or(&serde_json::Value::Null);
                let r = (row_idx + 1) as u32;
                let c = col as u16;
                match cell {
                    serde_json::Value::Null => {}
                    serde_json::Value::Bool(b) => {
                        worksheet.write_boolean(r, c, *b)?;
                    }
                    serde_json::Value::Number(n) => {
                        if let Some(f) = n.as_f64() {
                            worksheet.write_number(r, c, f)?;
                        } else {
                            worksheet.write_string(r, c, &n.to_string())?;
                        }
                    }
                    serde_json::Value::String(s) => {
                        worksheet.write_string(r, c, s)?;
                    }
                    _ => {
                        worksheet.write_string(r, c, &cell.to_string())?;
                    }
                }
            }
        }

        workbook.save(full_path)?;
        Ok(())
    }

    /// Log d’audit
    async fn log_action(
        &self,
        job_id: Uuid,
        action: &str,
        actor: &str,
        details: Option<serde_json::Value>,
    ) -> Result<(), sqlx::Error> {
        sqlx::query(
            r#"
                INSERT INTO atlas.colab_export_logs (job_id, action, actor, timestamp, details)
                VALUES ($1, $2, $3, NOW(), $4)
            "#,
        )
        .bind(job_id)
        .bind(action)
        .bind(actor)
        .bind(details)
        .execute(&self.pool)
        .await?;

        Ok(())
    }
}

fn parse_job_status(status: &str) -> ExportJobStatus {
    match status {
        "pending" => ExportJobStatus::Pending,
        "running" => ExportJobStatus::Running,
        "completed" => ExportJobStatus::Completed,
        "failed" => ExportJobStatus::Failed,
        _ => ExportJobStatus::Pending,
    }
}
