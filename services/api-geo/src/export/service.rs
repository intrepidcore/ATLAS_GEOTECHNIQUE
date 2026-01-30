use std::path::Path;
use std::path::PathBuf;
use uuid::Uuid;
use sqlx::PgPool;
use sqlx::Row;
use chrono::Utc;
use tokio::fs;
use rust_xlsxwriter::Workbook;
use genpdf;
use genpdf::Element;
use genpdf::{PaperSize, Size};
use sqlx::types::Json;

use crate::AppState;
use crate::auth::AuthUser;
use crate::export::formats::{ExportRequest, ExportDataSource, ExportFormat, ExportFilters, ExportJobResponse, ExportJobStatus, PdfOptions};
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
                id, source, format, filters, options, status, created_by, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        "#;

        let filters_json = serde_json::to_value(&request.filters)
            .map_err(|e| (format!("Erreur sérialisation filtres: {}", e), 500))?;

        let options_json = serde_json::json!({
            "columns": request.columns,
            "pdf_options": request.pdf_options,
        });

        sqlx::query(query)
            .bind(job.id)
            .bind(job.source.to_string())
            .bind(job.format.to_string())
            .bind(filters_json)
            .bind(options_json)
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
            file_size: job.file_size,
            format: job.format,
            source: job.source,
            error: job.error,
        })
    }

    /// Récupère le statut d’un job
    pub async fn get_job_status(&self, job_id: Uuid) -> Result<Option<ExportJobResponse>, (String, u16)> {
        let row_opt = sqlx::query(
            r#"
                SELECT id, source, format, status, created_at, started_at, finished_at, file_path, file_size, error
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
            let source_str: String = row.get("source");
            let format_str: String = row.get("format");
            let source = ExportDataSource::from_db_str(&source_str)
                .ok_or_else(|| (format!("Source export inconnue: {}", source_str), 500))?;
            let format = ExportFormat::from_db_str(&format_str)
                .ok_or_else(|| (format!("Format export inconnu: {}", format_str), 500))?;
            Ok(Some(ExportJobResponse {
                job_id: row.get("id"),
                status: parse_job_status(&status),
                created_at: row.get("created_at"),
                started_at: row.try_get("started_at").ok(),
                finished_at: row.try_get("finished_at").ok(),
                file_path: row.try_get("file_path").ok(),
                file_size: row.try_get("file_size").ok(),
                format,
                source,
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
                SELECT id, source, format, status, created_at, started_at, finished_at, file_path, file_size, error
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
                let source_str: String = row.get("source");
                let format_str: String = row.get("format");
                let source = ExportDataSource::from_db_str(&source_str)
                    .unwrap_or(ExportDataSource::Missions);
                let format = ExportFormat::from_db_str(&format_str)
                    .unwrap_or(ExportFormat::Csv);
                ExportJobResponse {
                    job_id: row.get("id"),
                    status: parse_job_status(&status),
                    created_at: row.get("created_at"),
                    started_at: row.try_get("started_at").ok(),
                    finished_at: row.try_get("finished_at").ok(),
                    file_path: row.try_get("file_path").ok(),
                    file_size: row.try_get("file_size").ok(),
                    format,
                    source,
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
        let job_row = sqlx::query("SELECT source, format, filters, options FROM atlas.colab_export_jobs WHERE id = $1")
            .bind(job_id)
            .fetch_one(&pool)
            .await?;

        let source_str: String = job_row.get("source");
        let format_str: String = job_row.get("format");
        let filters_val: serde_json::Value = job_row.get("filters");
        let options_val: serde_json::Value = job_row.try_get("options").unwrap_or_else(|_| serde_json::json!({}));

        let source = ExportDataSource::from_db_str(&source_str)
            .ok_or_else(|| format!("Source export inconnue: {}", source_str))?;
        let format = ExportFormat::from_db_str(&format_str)
            .ok_or_else(|| format!("Format export inconnu: {}", format_str))?;
        let filters: ExportFilters = serde_json::from_value(filters_val)?;

        let columns: Option<Vec<String>> = options_val
            .get("columns")
            .and_then(|v| serde_json::from_value(v.clone()).ok());
        let pdf_options: Option<PdfOptions> = options_val
            .get("pdf_options")
            .and_then(|v| serde_json::from_value(v.clone()).ok());

        let export_dir = std::env::var("EXPORT_DIR").unwrap_or_else(|_| "exports".to_string());
        let export_dir_path = PathBuf::from(&export_dir);

        // Créer le dossier exports si besoin
        fs::create_dir_all(&export_dir_path).await?;

        // Générer le fichier
        let filename = format!("{}_{}.{}", source, job_id, format);
        let full_path = export_dir_path.join(&filename);
        let file_path = full_path.to_string_lossy().to_string();

        // Générer le fichier selon source/format/filters
        if let Err(e) = Self::generate_export_file(&pool, &full_path, &source, &format, &filters, columns.as_ref(), pdf_options.as_ref()).await {
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
        columns: Option<&Vec<String>>,
        pdf_options: Option<&PdfOptions>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Sécurité volumétrie (Phase 1)
        let max_rows: i64 = 10_000;

        match format {
            ExportFormat::Json => {
                let data = Self::fetch_source_as_json(pool, source, filters, max_rows, columns).await?;
                let bytes = serde_json::to_vec_pretty(&data)?;
                fs::write(full_path, bytes).await?;
                Ok(())
            }
            ExportFormat::Csv => {
                let rows = Self::fetch_source_as_json(pool, source, filters, max_rows, columns).await?;
                Self::write_csv(full_path, rows, columns).await?;
                Ok(())
            }
            ExportFormat::Xlsx => {
                let rows = Self::fetch_source_as_json(pool, source, filters, max_rows, columns).await?;
                Self::write_xlsx(full_path, source, rows, columns)?;
                Ok(())
            }
            ExportFormat::Pdf => {
                let rows = Self::fetch_source_as_json(pool, source, filters, max_rows, columns).await?;
                Self::write_pdf(full_path, source, filters, rows, columns, pdf_options)?;
                Ok(())
            }
            ExportFormat::GeoJson => {
                Err(format!("Format non implémenté en Phase 1: {}", format).into())
            }
        }
    }

    async fn fetch_source_as_json(
        pool: &PgPool,
        source: &ExportDataSource,
        filters: &ExportFilters,
        max_rows: i64,
        columns: Option<&Vec<String>>,
    ) -> Result<Vec<serde_json::Value>, Box<dyn std::error::Error + Send + Sync>> {
        match source {
            ExportDataSource::Missions => {
                let allowed: std::collections::BTreeMap<&'static str, String> = {
                    let mut m = std::collections::BTreeMap::new();
                    m.insert("mission_id", "m.id".to_string());
                    m.insert("mission_code", "m.code".to_string());
                    m.insert("mission_name", "m.title".to_string());
                    m.insert("mission_description", "m.description".to_string());
                    m.insert("mission_type", "m.theme::TEXT".to_string());
                    m.insert("mission_status", "m.status::TEXT".to_string());
                    m.insert("maille_id", "m.maille_id".to_string());
                    m.insert("maille_code", "ma.code".to_string());
                    m.insert("zone", "ma.pref_name".to_string());
                    m.insert("localite", "ma.adm3_name".to_string());
                    m.insert(
                        "bbox_wgs84",
                        "jsonb_build_object(\
                            'xmin', ST_XMin(ST_Transform(ma.geom, 4326)),\
                            'ymin', ST_YMin(ST_Transform(ma.geom, 4326)),\
                            'xmax', ST_XMax(ST_Transform(ma.geom, 4326)),\
                            'ymax', ST_YMax(ST_Transform(ma.geom, 4326))\
                        )"
                        .to_string(),
                    );
                    m.insert(
                        "centroid_wgs84",
                        "jsonb_build_object(\
                            'lon', ST_X(ST_Centroid(ST_Transform(ma.geom, 4326))),\
                            'lat', ST_Y(ST_Centroid(ST_Transform(ma.geom, 4326)))\
                        )"
                        .to_string(),
                    );
                    m.insert("date_start", "m.start_date".to_string());
                    m.insert("date_end", "m.end_date".to_string());
                    m.insert("date_created", "m.created_at".to_string());
                    m.insert("date_updated", "m.updated_at".to_string());
                    m.insert("expected_sondages", "m.expected_sondages".to_string());

                    m.insert("student_id", "ms.student_uuid".to_string());
                    m.insert("student_name", "ms.student_name".to_string());
                    m.insert("student_email", "ms.student_email".to_string());
                    m.insert("supervisor_id", "s.id".to_string());
                    m.insert("supervisor_name", "COALESCE(u.first_name || ' ' || u.last_name, u.username)".to_string());

                    m.insert("operational_status", "op.operational_status".to_string());
                    m.insert("operational_reason", "op.operational_reason".to_string());
                    m.insert("notified", "(COALESCE(op.notif_status, '') = 'sent')".to_string());
                    m.insert("conflict", "(op.conflict_holder_student_uuid IS NOT NULL AND ms.student_uuid IS NOT NULL AND op.conflict_holder_student_uuid <> ms.student_uuid)".to_string());
                    m.insert("conflict_mission_id", "op.conflict_mission_id".to_string());
                    m.insert("conflict_holder_name", "op.conflict_holder_name".to_string());

                    m.insert("data_source", "'colab'".to_string());
                    m.insert("tool_version", "'atlas-api-geo'".to_string());
                    m
                };

                let selected: Vec<String> = match columns {
                    None => allowed.keys().map(|k| k.to_string()).collect(),
                    Some(cols) => cols.clone(),
                };

                for c in &selected {
                    if !allowed.contains_key(c.as_str()) {
                        return Err(format!("Colonne export non autorisée: {}", c).into());
                    }
                }

                let mut json_pairs: Vec<String> = Vec::with_capacity(selected.len() * 2);
                for c in &selected {
                    let expr = allowed
                        .get(c.as_str())
                        .ok_or_else(|| format!("Colonne export non autorisée: {}", c))?;
                    let key_lit = c.replace('\'', "''");
                    json_pairs.push(format!("'{}'", key_lit));
                    json_pairs.push(expr.clone());
                }
                let json_expr = format!("jsonb_build_object({})", json_pairs.join(", "));

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

                if let Some(maille_id) = &filters.maille_id {
                    conditions.push(format!("m.maille_id = '{}'", maille_id));
                }

                let where_clause = conditions.join(" AND ");
                let query = format!(
                    r#"
                    SELECT
                        {} as row
                    FROM atlas.colab_missions m
                    LEFT JOIN atlas.mailles ma ON m.maille_id = ma.id
                    LEFT JOIN atlas.colab_supervisors s ON m.supervisor_id = s.id
                    LEFT JOIN atlas.users u ON s.user_id = u.id
                    LEFT JOIN LATERAL (
                        SELECT
                            cs.id as student_uuid,
                            u1.email as student_email,
                            COALESCE(NULLIF(BTRIM(u1.first_name || ' ' || u1.last_name), ''), u1.username, u1.email) as student_name,
                            cs.matricule as matricule
                        FROM atlas.colab_mission_assignments a
                        JOIN atlas.colab_students cs ON cs.id = a.student_id AND cs.deleted_at IS NULL
                        JOIN atlas.users u1 ON u1.id = cs.user_id AND u1.deleted_at IS NULL
                        WHERE a.mission_id = m.id AND a.unassigned_at IS NULL
                        ORDER BY a.assigned_at DESC
                        LIMIT 1
                    ) ms ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            ma2.student_id as conflict_holder_student_uuid,
                            u2.email as conflict_holder_email,
                            COALESCE(NULLIF(BTRIM(u2.first_name || ' ' || u2.last_name), ''), u2.username, u2.email) as conflict_holder_name
                        FROM atlas.colab_maille_assignments ma2
                        JOIN atlas.colab_students cs2 ON cs2.id = ma2.student_id AND cs2.deleted_at IS NULL
                        JOIN atlas.users u2 ON u2.id = cs2.user_id AND u2.deleted_at IS NULL
                        WHERE ma2.maille_id = m.maille_id
                        ORDER BY ma2.assigned_at DESC
                        LIMIT 1
                    ) ma_hold ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            cm.id as conflict_mission_id
                        FROM atlas.colab_missions cm
                        JOIN atlas.colab_mission_assignments a2 ON a2.mission_id = cm.id AND a2.unassigned_at IS NULL
                        WHERE cm.deleted_at IS NULL
                          AND cm.maille_id = m.maille_id
                          AND ma_hold.conflict_holder_student_uuid IS NOT NULL
                          AND a2.student_id = ma_hold.conflict_holder_student_uuid
                        ORDER BY a2.assigned_at DESC
                        LIMIT 1
                    ) cm_conf ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            n.status as notif_status
                        FROM atlas.v_colab_maille_notification_latest n
                        WHERE n.assignment_id = (
                            SELECT a3.assignment_id
                            FROM atlas.colab_maille_assignments a3
                            WHERE a3.maille_id = m.maille_id
                              AND ms.student_uuid IS NOT NULL
                              AND a3.student_id = ms.student_uuid
                            ORDER BY a3.assigned_at DESC
                            LIMIT 1
                        )
                        LIMIT 1
                    ) notif ON TRUE
                    LEFT JOIN LATERAL (
                        SELECT
                            ma_hold.conflict_holder_student_uuid,
                            ma_hold.conflict_holder_name,
                            cm_conf.conflict_mission_id,
                            notif.notif_status,
                            CASE
                              WHEN (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = m.id AND a.unassigned_at IS NULL) = 0 THEN 'action_required'
                              WHEN m.maille_id IS NULL THEN 'action_required'
                              WHEN ma_hold.conflict_holder_student_uuid IS NOT NULL AND ms.student_uuid IS NOT NULL AND ma_hold.conflict_holder_student_uuid <> ms.student_uuid THEN 'blocked_conflict'
                              WHEN ms.student_uuid IS NOT NULL AND (ms.matricule IS NULL OR BTRIM(ms.matricule) = '') THEN 'action_required'
                              WHEN COALESCE(notif.notif_status, '') = 'sent' THEN 'notified'
                              WHEN ms.student_uuid IS NOT NULL THEN 'ready_notifiable'
                              ELSE 'action_required'
                            END as operational_status,
                            CASE
                              WHEN (SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.mission_id = m.id AND a.unassigned_at IS NULL) = 0 THEN 'Aucun étudiant affecté'
                              WHEN m.maille_id IS NULL THEN 'Maille manquante'
                              WHEN ma_hold.conflict_holder_student_uuid IS NOT NULL AND ms.student_uuid IS NOT NULL AND ma_hold.conflict_holder_student_uuid <> ms.student_uuid THEN 'Maille déjà attribuée à un autre étudiant'
                              WHEN ms.student_uuid IS NOT NULL AND (ms.matricule IS NULL OR BTRIM(ms.matricule) = '') THEN 'Matricule étudiant manquant'
                              WHEN COALESCE(notif.notif_status, '') = 'sent' THEN 'Notification déjà envoyée'
                              WHEN ms.student_uuid IS NOT NULL THEN 'Prêt à notifier'
                              ELSE 'Action requise'
                            END as operational_reason
                    ) op ON TRUE
                    WHERE {}
                    ORDER BY m.created_at DESC
                    LIMIT {}
                    "#,
                    json_expr,
                    where_clause,
                    max_rows
                );

                let rows = sqlx::query(&query).fetch_all(pool).await?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        let Json(v) = r.get::<Json<serde_json::Value>, _>("row");
                        v
                    })
                    .collect())
            }
            ExportDataSource::Students => {
                let allowed: std::collections::BTreeMap<&'static str, String> = {
                    let mut m = std::collections::BTreeMap::new();
                    m.insert("student_id", "s.id".to_string());
                    m.insert("user_id", "s.user_id".to_string());
                    m.insert("username", "u.username".to_string());
                    m.insert("email", "u.email".to_string());
                    m.insert("full_name", "COALESCE(u.first_name || ' ' || u.last_name, u.username)".to_string());
                    m.insert("telephone", "u.telephone".to_string());
                    m.insert("matricule", "s.matricule".to_string());
                    m.insert("promotion", "s.promotion".to_string());
                    m.insert("filiere", "s.filiere".to_string());
                    m.insert("etablissement", "s.etablissement".to_string());
                    m.insert("niveau", "s.niveau".to_string());
                    m.insert("age", "s.age".to_string());
                    m.insert("is_active", "u.is_active".to_string());
                    m.insert(
                        "active_missions",
                        "(SELECT COUNT(*) FROM atlas.colab_mission_assignments a WHERE a.student_id = s.id AND a.unassigned_at IS NULL)".to_string(),
                    );
                    m.insert("data_source", "'colab'".to_string());
                    m.insert("tool_version", "'atlas-api-geo'".to_string());
                    m
                };

                let selected: Vec<String> = match columns {
                    None => allowed.keys().map(|k| k.to_string()).collect(),
                    Some(cols) => cols.clone(),
                };
                for c in &selected {
                    if !allowed.contains_key(c.as_str()) {
                        return Err(format!("Colonne export non autorisée: {}", c).into());
                    }
                }

                let mut json_pairs: Vec<String> = Vec::with_capacity(selected.len() * 2);
                for c in &selected {
                    let expr = allowed
                        .get(c.as_str())
                        .ok_or_else(|| format!("Colonne export non autorisée: {}", c))?;
                    let key_lit = c.replace('\'', "''");
                    json_pairs.push(format!("'{}'", key_lit));
                    json_pairs.push(expr.clone());
                }
                let json_expr = format!("jsonb_build_object({})", json_pairs.join(", "));

                let query = format!(
                    r#"
                    SELECT
                        {} as row
                    FROM atlas.colab_students s
                    JOIN atlas.users u ON s.user_id = u.id
                    WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
                    ORDER BY s.promotion DESC, COALESCE(u.first_name || ' ' || u.last_name, u.username)
                    LIMIT $1
                    "#,
                    json_expr
                );

                let rows = sqlx::query(&query).bind(max_rows).fetch_all(pool).await?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        let Json(v) = r.get::<Json<serde_json::Value>, _>("row");
                        v
                    })
                    .collect())
            }
            ExportDataSource::Supervisors => {
                let allowed: std::collections::BTreeMap<&'static str, String> = {
                    let mut m = std::collections::BTreeMap::new();
                    m.insert("supervisor_id", "s.id".to_string());
                    m.insert("user_id", "s.user_id".to_string());
                    m.insert("username", "u.username".to_string());
                    m.insert("full_name", "COALESCE(u.first_name || ' ' || u.last_name, u.username)".to_string());
                    m.insert("specialite", "s.specialite".to_string());
                    m.insert("institution", "s.institution".to_string());
                    m.insert("is_active", "u.is_active".to_string());
                    m.insert("data_source", "'colab'".to_string());
                    m.insert("tool_version", "'atlas-api-geo'".to_string());
                    m
                };

                let selected: Vec<String> = match columns {
                    None => allowed.keys().map(|k| k.to_string()).collect(),
                    Some(cols) => cols.clone(),
                };
                for c in &selected {
                    if !allowed.contains_key(c.as_str()) {
                        return Err(format!("Colonne export non autorisée: {}", c).into());
                    }
                }

                let mut json_pairs: Vec<String> = Vec::with_capacity(selected.len() * 2);
                for c in &selected {
                    let expr = allowed
                        .get(c.as_str())
                        .ok_or_else(|| format!("Colonne export non autorisée: {}", c))?;
                    let key_lit = c.replace('\'', "''");
                    json_pairs.push(format!("'{}'", key_lit));
                    json_pairs.push(expr.clone());
                }
                let json_expr = format!("jsonb_build_object({})", json_pairs.join(", "));

                let query = format!(
                    r#"
                    SELECT
                        {} as row
                    FROM atlas.colab_supervisors s
                    JOIN atlas.users u ON s.user_id = u.id
                    WHERE s.deleted_at IS NULL AND u.deleted_at IS NULL
                    ORDER BY u.is_active DESC, COALESCE(u.first_name || ' ' || u.last_name, u.username)
                    LIMIT $1
                    "#,
                    json_expr
                );

                let rows = sqlx::query(&query).bind(max_rows).fetch_all(pool).await?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        let Json(v) = r.get::<Json<serde_json::Value>, _>("row");
                        v
                    })
                    .collect())
            }
            ExportDataSource::Documents => {
                let allowed: std::collections::BTreeMap<&'static str, String> = {
                    let mut m = std::collections::BTreeMap::new();
                    m.insert("document_id", "d.id".to_string());
                    m.insert("mission_id", "d.mission_id".to_string());
                    m.insert("uploaded_by", "d.uploaded_by".to_string());
                    m.insert("title", "d.title".to_string());
                    m.insert("document_type", "d.document_type::TEXT".to_string());
                    m.insert("description", "d.description".to_string());
                    m.insert("file_name", "d.file_name".to_string());
                    m.insert("file_size_bytes", "d.file_size_bytes".to_string());
                    m.insert("mime_type", "d.mime_type".to_string());
                    m.insert("sondage_id", "d.sondage_id".to_string());
                    m.insert("version", "d.version".to_string());
                    m.insert("is_current", "d.is_current".to_string());
                    m.insert("uploaded_at", "d.uploaded_at".to_string());
                    m.insert("data_source", "'colab'".to_string());
                    m.insert("tool_version", "'atlas-api-geo'".to_string());
                    m
                };

                let selected: Vec<String> = match columns {
                    None => allowed.keys().map(|k| k.to_string()).collect(),
                    Some(cols) => cols.clone(),
                };
                for c in &selected {
                    if !allowed.contains_key(c.as_str()) {
                        return Err(format!("Colonne export non autorisée: {}", c).into());
                    }
                }

                let mut json_pairs: Vec<String> = Vec::with_capacity(selected.len() * 2);
                for c in &selected {
                    let expr = allowed
                        .get(c.as_str())
                        .ok_or_else(|| format!("Colonne export non autorisée: {}", c))?;
                    let key_lit = c.replace('\'', "''");
                    json_pairs.push(format!("'{}'", key_lit));
                    json_pairs.push(expr.clone());
                }
                let json_expr = format!("jsonb_build_object({})", json_pairs.join(", "));

                let query = format!(
                    r#"
                    SELECT
                        {} as row
                    FROM atlas.colab_documents d
                    WHERE d.deleted_at IS NULL
                    ORDER BY d.uploaded_at DESC
                    LIMIT $1
                    "#,
                    json_expr
                );

                let rows = sqlx::query(&query).bind(max_rows).fetch_all(pool).await?;
                Ok(rows
                    .into_iter()
                    .map(|r| {
                        let Json(v) = r.get::<Json<serde_json::Value>, _>("row");
                        v
                    })
                    .collect())
            }
            _ => Err(format!("Source non implémentée en Phase 1: {}", source).into()),
        }
    }

    async fn write_csv(
        full_path: &Path,
        rows: Vec<serde_json::Value>,
        columns: Option<&Vec<String>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut wtr = csv::Writer::from_writer(vec![]);

        // CSV "plat": on utilise les clés du premier objet comme header
        let header_keys: Vec<String> = if let Some(cols) = columns {
            cols.clone()
        } else {
            rows
                .get(0)
                .and_then(|v| v.as_object())
                .map(|o| o.keys().cloned().collect())
                .unwrap_or_default()
        };

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
        columns: Option<&Vec<String>>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let mut workbook = Workbook::new();
        let sheet_name = source.to_string();
        let worksheet = workbook.add_worksheet().set_name(&sheet_name)?;

        let header_keys: Vec<String> = if let Some(cols) = columns {
            cols.clone()
        } else {
            rows
                .get(0)
                .and_then(|v| v.as_object())
                .map(|o| o.keys().cloned().collect())
                .unwrap_or_default()
        };

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

    fn write_pdf(
        full_path: &Path,
        source: &ExportDataSource,
        filters: &ExportFilters,
        rows: Vec<serde_json::Value>,
        columns: Option<&Vec<String>>,
        pdf_options: Option<&PdfOptions>,
    ) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let title = pdf_options
            .and_then(|o| o.title.clone())
            .unwrap_or_else(|| format!("Export Colab - {}", source));

        let env_font_dir = std::env::var("PDF_FONT_DIR").ok();
        let env_font_name = std::env::var("PDF_FONT_NAME").ok();

        let mut font_candidates: Vec<(String, String)> = Vec::new();
        if let (Some(dir), Some(name)) = (env_font_dir.clone(), env_font_name.clone()) {
            font_candidates.push((dir, name));
        }
        if let Some(dir) = env_font_dir {
            font_candidates.push((dir.clone(), "DejaVuSans".to_string()));
            font_candidates.push((dir, "Arial".to_string()));
        }
        // Linux (Docker): prefer Liberation (complete family) then DejaVu
        font_candidates.push((
            "/usr/share/fonts/truetype/liberation".to_string(),
            "LiberationSans".to_string(),
        ));
        font_candidates.push((
            "/usr/share/fonts/truetype/liberation".to_string(),
            "LiberationSerif".to_string(),
        ));
        font_candidates.push(("/usr/share/fonts/truetype/dejavu".to_string(), "DejaVuSans".to_string()));
        font_candidates.push(("/usr/share/fonts".to_string(), "DejaVuSans".to_string()));
        // Windows (dev)
        font_candidates.push(("C:\\Windows\\Fonts".to_string(), "arial".to_string()));
        font_candidates.push(("C:\\Windows\\Fonts".to_string(), "calibri".to_string()));

        let mut attempts: Vec<String> = Vec::new();
        let mut font_family_opt = None;
        for (dir, name) in font_candidates {
            match genpdf::fonts::from_files(&dir, &name, None) {
                Ok(ff) => {
                    font_family_opt = Some(ff);
                    break;
                }
                Err(e) => {
                    attempts.push(format!("{} (dir='{}', name='{}')", e, dir, name));
                }
            }
        }

        let font_family = font_family_opt
            .ok_or_else(|| {
                let details = if attempts.is_empty() {
                    "Aucune police candidate testée".to_string()
                } else {
                    attempts.join(" | ")
                };
                format!("Erreur chargement polices PDF: {}", details)
            })?;

        let mut doc = genpdf::Document::new(font_family);
        doc.set_title(title.clone());

        let header_keys_preview: Vec<String> = if let Some(cols) = columns {
            cols.clone()
        } else {
            rows
                .get(0)
                .and_then(|v| v.as_object())
                .map(|o| o.keys().cloned().collect())
                .unwrap_or_default()
        };
        let auto_landscape = header_keys_preview.len() > 8;

        let paper_size = match pdf_options
            .and_then(|o| o.orientation.as_deref())
            .map(|s| s.trim().to_lowercase())
            .as_deref()
        {
            Some("landscape") => {
                let s = Size::from(PaperSize::A4);
                Size::from((s.height, s.width))
            }
            Some("portrait") | Some("") | None if !auto_landscape => Size::from(PaperSize::A4),
            Some("portrait") | Some("") | None => {
                let s = Size::from(PaperSize::A4);
                Size::from((s.height, s.width))
            }
            Some(other) => {
                return Err(format!(
                    "Orientation PDF invalide: {} (attendu: portrait|landscape)",
                    other
                )
                .into());
            }
        };
        doc.set_paper_size(paper_size);

        let mut decorator = genpdf::SimplePageDecorator::new();
        decorator.set_margins(10);
        doc.set_page_decorator(decorator);

        doc.push(genpdf::elements::Paragraph::new(title));
        doc.push(genpdf::elements::Paragraph::new(format!(
            "Généré le {}",
            Utc::now().format("%Y-%m-%d %H:%M UTC")
        )));
        doc.push(genpdf::elements::Paragraph::new(format!(
            "Filtres: {}",
            serde_json::to_string(filters).unwrap_or_else(|_| "{}".to_string())
        )));

        let header_keys: Vec<String> = if let Some(cols) = columns {
            cols.clone()
        } else {
            rows
                .get(0)
                .and_then(|v| v.as_object())
                .map(|o| o.keys().cloned().collect())
                .unwrap_or_default()
        };

        if header_keys.is_empty() {
            doc.push(genpdf::elements::Paragraph::new("Aucune donnée."));
            doc.render_to_file(full_path)?;
            return Ok(());
        }

        let mut table = genpdf::elements::TableLayout::new(vec![1; header_keys.len()]);
        table.set_cell_decorator(genpdf::elements::FrameCellDecorator::new(true, true, false));

        {
            let mut row = table.row();
            for k in &header_keys {
                row.push_element(genpdf::elements::Paragraph::new(k.clone()).styled(genpdf::style::Style::new().bold()));
            }
            row.push().map_err(|e| format!("Erreur table PDF header: {}", e))?;
        }

        for r in rows {
            let obj = r.as_object().cloned().unwrap_or_default();
            let mut row = table.row();
            for k in &header_keys {
                let v = obj.get(k).cloned().unwrap_or(serde_json::Value::Null);
                let mut s = Self::json_to_csv_cell(&v);
                if s.len() > 180 {
                    s.truncate(180);
                    s.push_str("…");
                }
                row.push_element(genpdf::elements::Paragraph::new(s));
            }
            row.push().map_err(|e| format!("Erreur table PDF row: {}", e))?;
        }

        doc.push(table);
        doc.render_to_file(full_path)?;
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
