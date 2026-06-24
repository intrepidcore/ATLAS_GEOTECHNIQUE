use lettre::{
    message::{header::ContentType, Attachment, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    AsyncSmtpTransport, AsyncTransport, Message, Tokio1Executor,
};
use printpdf::{BuiltinFont, Color, Line, Mm, PdfDocument, Point, Rgb};
use qrcode::{types::Color as QrColor, QrCode};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};
use std::io::Write as _;
use std::time::Duration;
use uuid::Uuid;
use zip::write::{FileOptions, ZipWriter};

// ─────────────────────────────────────────────────────────────────────────────
// Configuration SMTP
// ─────────────────────────────────────────────────────────────────────────────

struct SmtpConfig {
    host: String,
    port: u16,
    user: String,
    password: String,
    from: String,
    dry_run: bool,
    subject: String,
    instructions: String,
}

impl SmtpConfig {
    fn from_env() -> Option<Self> {
        let non_empty = |s: String| if s.is_empty() { None } else { Some(s) };
        let user = std::env::var("GMAIL_USER").ok().and_then(non_empty)
            .or_else(|| std::env::var("SMTP_USER").ok().and_then(non_empty))?;
        let password = std::env::var("GMAIL_APP_PASSWORD").ok().and_then(non_empty)
            .or_else(|| std::env::var("SMTP_PASSWORD").ok().and_then(non_empty))?;
        let from = std::env::var("GMAIL_FROM").ok().and_then(non_empty)
            .or_else(|| std::env::var("SMTP_FROM").ok().and_then(non_empty))
            .unwrap_or_else(|| user.clone());
        let host = std::env::var("SMTP_HOST").unwrap_or_else(|_| "smtp.gmail.com".to_string());
        let port = std::env::var("SMTP_PORT").ok().and_then(|p| p.parse().ok()).unwrap_or(587u16);
        let dry_run = std::env::var("COLAB_NOTIFY_DRY_RUN")
            .map(|v| v == "true" || v == "1")
            .unwrap_or(false);
        let subject = std::env::var("COLAB_NOTIFY_SUBJECT").unwrap_or_else(|_| {
            "Atlas Géotechnique Togo — Ordre de mission de reconnaissance terrain".to_string()
        });
        let instructions = std::env::var("COLAB_NOTIFY_INSTRUCTIONS").unwrap_or_default();
        Some(SmtpConfig { host, port, user, password, from, dry_run, subject, instructions })
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Structures de données
// ─────────────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone)]
struct SondagePoint {
    numero: i32,
    label: Option<String>,
    lat: f64,
    lon: f64,
    notes: Option<String>,
}

struct EmailData {
    assignment_id: Uuid,
    assignment_role: String,
    assignment_notes: Option<String>,
    student_email: String,
    student_name: String,
    matricule: String,
    maille_code: String,
    mission_title: String,
    mission_code: String,
    mission_theme: String,
    mission_objectifs: Option<String>,
    expected_sondages: Option<i32>,
    start_date: Option<chrono::NaiveDate>,
    end_date: Option<chrono::NaiveDate>,
    // Profondeurs indicatives
    depth_h1_m: Option<f64>,
    depth_h2_m: Option<f64>,
    depth_h3_m: Option<f64>,
    // Encadrement
    supervisor_name: String,
    supervisor_email: String,
    supervisor_phone: String,
    supervisor_titre: String,
    // Géométrie
    lat: Option<f64>,
    lon: Option<f64>,
    bbox_ymin: Option<f64>,
    bbox_xmin: Option<f64>,
    bbox_ymax: Option<f64>,
    bbox_xmax: Option<f64>,
    maille_geojson: Option<String>,
    // Contexte administratif
    prefecture: Option<String>,
    commune: Option<String>,
    region: Option<String>,
    canton: Option<String>,
    // Terrain physique
    altitude_mean: Option<f64>,
    dem_slope_mean_deg: Option<f64>,
    distance_river_m: Option<f64>,
    vbs_rk_h1: Option<f64>,
    ip_rk_h1: Option<f64>,
    // Climatique
    prec_annual: Option<f64>,
    prec_dry: Option<f64>,
    prec_wet: Option<f64>,
    // Contexte géologique/pédologique (sans données ML)
    geologie: Option<String>,
    pedologie: Option<String>,
    risque_gonflement: Option<String>,
    nb_sondages_existants: i32,
    // Points de sondage planifiés
    sondage_points: Vec<SondagePoint>,
}

// ─────────────────────────────────────────────────────────────────────────────
// Worker principal
// ─────────────────────────────────────────────────────────────────────────────

pub fn spawn_colab_email_worker(pool: PgPool) {
    tokio::spawn(async move {
        let cfg = match SmtpConfig::from_env() {
            Some(c) => c,
            None => {
                tracing::warn!(
                    "Colab email worker désactivé — GMAIL_USER/GMAIL_APP_PASSWORD non définis"
                );
                return;
            }
        };
        if cfg.dry_run {
            tracing::info!("Colab email worker démarré en mode DRY_RUN");
        } else {
            tracing::info!(host = %cfg.host, port = cfg.port, "Colab email worker démarré");
        }
        let mut backoff_ms: u64 = 5_000;
        loop {
            match process_one_email_job(&pool, &cfg).await {
                Ok(Some(_)) => { backoff_ms = 2_000; }
                Ok(None) => { backoff_ms = (backoff_ms * 2).min(60_000); }
                Err(e) => {
                    tracing::error!(error = %e, "colab email worker error");
                    backoff_ms = (backoff_ms * 2).min(60_000);
                }
            }
            tokio::time::sleep(Duration::from_millis(backoff_ms)).await;
        }
    });
}

async fn process_one_email_job(pool: &PgPool, cfg: &SmtpConfig) -> anyhow::Result<Option<()>> {
    let mut tx = pool.begin().await?;
    let job = sqlx::query(
        r#"SELECT id, params
           FROM atlas.colab_email_jobs
           WHERE status = 'pending'
           ORDER BY created_at ASC
           FOR UPDATE SKIP LOCKED
           LIMIT 1"#,
    )
    .fetch_optional(&mut *tx)
    .await?;

    let Some(job) = job else {
        tx.rollback().await?;
        return Ok(None);
    };

    let job_id: Uuid = job.get("id");
    let params: Value = job.get("params");

    sqlx::query("UPDATE atlas.colab_email_jobs SET status = 'running', started_at = NOW() WHERE id = $1")
        .bind(job_id)
        .execute(&mut *tx)
        .await?;
    tx.commit().await?;

    log_job(pool, job_id, "info", "Job démarré", json!({"params": &params})).await;

    let result = send_assignment_emails(pool, cfg, job_id, &params).await;

    match &result {
        Ok(sent) => {
            sqlx::query(
                "UPDATE atlas.colab_email_jobs SET status = 'completed', finished_at = NOW() WHERE id = $1",
            )
            .bind(job_id)
            .execute(pool)
            .await?;
            log_job(pool, job_id, "info", &format!("{} email(s) traité(s)", sent), json!({"sent": sent})).await;
        }
        Err(e) => {
            sqlx::query(
                "UPDATE atlas.colab_email_jobs SET status = 'failed', finished_at = NOW(), error = $2 WHERE id = $1",
            )
            .bind(job_id)
            .bind(e.to_string())
            .execute(pool)
            .await?;
            log_job(pool, job_id, "error", "Échec traitement job", json!({"error": e.to_string()})).await;
        }
    }

    result.map(|_| Some(()))
}

// ─────────────────────────────────────────────────────────────────────────────
// Requête enrichie + envoi
// ─────────────────────────────────────────────────────────────────────────────

async fn send_assignment_emails(
    pool: &PgPool,
    cfg: &SmtpConfig,
    job_id: Uuid,
    params: &Value,
) -> anyhow::Result<usize> {
    let assignment_ids: Vec<Uuid> = params["assignment_ids"]
        .as_array()
        .ok_or_else(|| anyhow::anyhow!("assignment_ids manquant dans params"))?
        .iter()
        .filter_map(|v| v.as_str().and_then(|s| s.trim().parse().ok()))
        .collect();

    let opts = &params["options"];
    let include_bbox         = opts["include_bbox"].as_bool().unwrap_or(true);
    let include_instructions = opts["include_instructions"].as_bool().unwrap_or(true);
    let include_pdf          = opts["include_pdf"].as_bool().unwrap_or(true);
    let include_geojson      = opts["include_geojson"].as_bool().unwrap_or(true);

    if assignment_ids.is_empty() {
        return Ok(0);
    }

    // Requête principale — part de colab_mission_assignments (IDs exposés par l'UI via la vue).
    // colab_maille_assignments est vide pour les étudiants sans matricule → on l'évite.
    let rows = sqlx::query(
        r#"
        SELECT
            cma.id                                       AS assignment_id,
            COALESCE(cma.role, 'primary')                AS assignment_role,
            cma.notes                                    AS assignment_notes,
            u.email                                      AS student_email,
            COALESCE(NULLIF(TRIM(u.first_name || ' ' || u.last_name), ''),
                     NULLIF(TRIM(u.last_name  || ' ' || u.first_name), ''),
                     u.username, u.email)                AS student_name,
            COALESCE(cs.matricule, '')                   AS matricule,
            COALESCE(ma.code, '')                        AS maille_code,
            cm.title                                     AS mission_title,
            cm.code                                      AS mission_code,
            cm.theme::text                               AS mission_theme,
            cm.objectifs                                 AS mission_objectifs,
            cm.expected_sondages,
            cm.start_date,
            cm.end_date,
            cm.depth_h1_m,
            cm.depth_h2_m,
            cm.depth_h3_m,
            -- Superviseur
            COALESCE(su.first_name || ' ' || su.last_name, '') AS supervisor_name,
            COALESCE(su.email, '')                       AS supervisor_email,
            COALESCE(sup.telephone, '')                  AS supervisor_phone,
            COALESCE(sup.titre, '')                      AS supervisor_titre,
            -- Géométrie WGS84
            ST_Y(ST_Transform(ST_Centroid(ma.geom), 4326))    AS lat,
            ST_X(ST_Transform(ST_Centroid(ma.geom), 4326))    AS lon,
            ST_YMin(ST_Transform(ma.geom, 4326))               AS bbox_ymin,
            ST_XMin(ST_Transform(ma.geom, 4326))               AS bbox_xmin,
            ST_YMax(ST_Transform(ma.geom, 4326))               AS bbox_ymax,
            ST_XMax(ST_Transform(ma.geom, 4326))               AS bbox_xmax,
            ST_AsGeoJSON(ST_Transform(ma.geom, 4326))::text    AS maille_geojson,
            -- Administratif
            COALESCE(ma.adm2_name, ma.pref_name, '')     AS prefecture,
            COALESCE(cm.commune, '')                     AS commune,
            COALESCE(
                (SELECT a2.adm1_name FROM atlas.adm2_tg a2 WHERE a2.code = ma.pref_code LIMIT 1),
                ''
            )                                            AS region,
            COALESCE(
                (SELECT a3.name FROM atlas.adm3_tg a3
                 WHERE ST_Intersects(a3.geom, ma.geom) LIMIT 1),
                ''
            )                                            AS canton,
            -- Terrain physique
            ma.altitude_mean,
            ma.dem_slope_mean_deg,
            ma.distance_river_m,
            ma.vbs_rk_h1,
            ma.ip_rk_h1,
            -- Climatique
            cl.prec_annual,
            cl.prec_dry,
            cl.prec_wet,
            -- Contexte géologique/pédologique
            COALESCE(
                (SELECT STRING_AGG(DISTINCT ug.libelle, ' / ')
                 FROM atlas.unites_geologiques ug
                 WHERE ST_Intersects(ug.geom, ma.geom)),
                ''
            )                                            AS geologie,
            COALESCE(
                (SELECT STRING_AGG(DISTINCT up.libelle, ' / ')
                 FROM atlas.unites_pedologiques up
                 WHERE ST_Intersects(up.geom, ma.geom)),
                ''
            )                                            AS pedologie,
            COALESCE(
                (SELECT STRING_AGG(DISTINCT rg.niveau_risque, ' / ')
                 FROM atlas.risque_gonflement rg
                 WHERE ST_Intersects(rg.geom, ma.geom)),
                ''
            )                                            AS risque_gonflement,
            -- Sondages existants dans la maille
            COALESCE(
                (SELECT COUNT(*)::int FROM atlas.sondages s
                 WHERE s.maille_code = ma.code AND s.deleted_at IS NULL),
                0
            )                                            AS nb_sondages_existants,
            -- Points GPS planifiés (JSON)
            COALESCE(
                (SELECT json_agg(json_build_object(
                    'numero', sp.numero,
                    'label',  sp.label,
                    'lat',    sp.lat,
                    'lon',    sp.lon,
                    'notes',  sp.notes
                ) ORDER BY sp.numero)
                 FROM atlas.colab_mission_sondage_points sp
                 WHERE sp.mission_id = cm.id),
                '[]'::json
            )                                            AS sondage_points_json
        FROM atlas.colab_mission_assignments cma
        JOIN  atlas.colab_missions      cm  ON cm.id   = cma.mission_id
                                           AND cm.deleted_at IS NULL
        JOIN  atlas.colab_students      cs  ON cs.id   = cma.student_id
                                           AND cs.deleted_at IS NULL
        JOIN  atlas.users               u   ON u.id    = cs.user_id
        LEFT JOIN atlas.mailles         ma  ON ma.id   = cm.maille_id
        LEFT JOIN atlas.colab_supervisors sup ON sup.id = cm.supervisor_id
        LEFT JOIN atlas.users           su  ON su.id   = sup.user_id
        LEFT JOIN atlas.maille_climate_features cl ON cl.maille_code = ma.code
        WHERE cma.id = ANY($1)
          AND cma.unassigned_at IS NULL
          AND u.email IS NOT NULL AND u.email <> ''
        "#,
    )
    .bind(&assignment_ids)
    .fetch_all(pool)
    .await?;

    let transport: Option<AsyncSmtpTransport<Tokio1Executor>> = if !cfg.dry_run {
        let creds = Credentials::new(cfg.user.clone(), cfg.password.clone());
        let t = AsyncSmtpTransport::<Tokio1Executor>::starttls_relay(&cfg.host)?
            .port(cfg.port)
            .credentials(creds)
            .build();
        Some(t)
    } else {
        None
    };

    let mut sent_count = 0usize;

    for row in &rows {
        let data = extract_email_data(row)?;
        let assignment_id = data.assignment_id;
        let student_email = data.student_email.clone();

        // Créer le log de notification avant l'envoi (UPDATE en fin de boucle)
        let options_json = json!({
            "include_bbox":         include_bbox,
            "include_pdf":          include_pdf,
            "include_geojson":      include_geojson,
            "include_instructions": include_instructions,
        });
        sqlx::query(
            r#"INSERT INTO atlas.colab_maille_notification_logs
               (assignment_id, email_job_id, status, options, requested_at)
               VALUES ($1, $2, 'pending', $3, NOW())"#,
        )
        .bind(assignment_id)
        .bind(job_id)
        .bind(&options_json)
        .execute(pool)
        .await
        .ok();

        // ── GeoJSON + ZIP ────────────────────────────────────────────────────
        let (zip_attachment, geojson_sha256) = if include_geojson && data.maille_geojson.is_some() {
            let geojson_bytes = build_geojson(&data, job_id).into_bytes();
            let hash = sha256_hex(&geojson_bytes);
            let zip_filename = format!(
                "ATLAS-{}-{}.zip",
                sanitize_filename(&data.mission_code),
                sanitize_filename(&data.maille_code)
            );
            let geojson_filename = format!(
                "ATLAS-{}-{}.geojson",
                sanitize_filename(&data.mission_code),
                sanitize_filename(&data.maille_code)
            );
            match build_zip_attachment(&geojson_bytes, &geojson_filename) {
                Ok(zip_bytes) => (Some((zip_bytes, zip_filename)), hash),
                Err(e) => {
                    tracing::warn!(error = %e, "ZIP GeoJSON échoué — email envoyé sans GeoJSON");
                    (None, hash)
                }
            }
        } else {
            (None, String::new())
        };

        // ── PDF Ordre de Mission ─────────────────────────────────────────────
        let pdf_attachment = if include_pdf {
            match build_ordre_de_mission_pdf(&data, job_id) {
                Ok(pdf_bytes) => {
                    let pdf_filename = format!(
                        "OrdresMission-ATLAS-{}.pdf",
                        sanitize_filename(&data.mission_code)
                    );
                    // Debug: sauvegarder le PDF dans /tmp si COLAB_PDF_DEBUG_DIR est défini
                    if let Ok(debug_dir) = std::env::var("COLAB_PDF_DEBUG_DIR") {
                        let path = format!("{}/{}-{}.pdf", debug_dir, sanitize_filename(&data.mission_code), &data.assignment_id.to_string()[..8]);
                        if let Err(e) = std::fs::write(&path, &pdf_bytes) {
                            tracing::warn!("PDF debug save failed: {}", e);
                        } else {
                            tracing::info!("PDF debug saved: {}", path);
                        }
                    }
                    Some((pdf_bytes, pdf_filename))
                }
                Err(e) => {
                    tracing::warn!(error = %e, "PDF ordre de mission échoué — email envoyé sans PDF");
                    None
                }
            }
        } else {
            None
        };

        // ── Corps HTML ───────────────────────────────────────────────────────
        let instructions_str = if include_instructions { cfg.instructions.as_str() } else { "" };
        let body = build_email_html(&data, instructions_str, include_bbox, job_id, &geojson_sha256);

        let send_result = if cfg.dry_run {
            tracing::info!(
                "[DRY_RUN] -> {} <{}> | maille={} | mission={}",
                data.student_name, student_email, data.maille_code, data.mission_code
            );
            Ok(())
        } else {
            let zip_att  = zip_attachment.as_ref().map(|(b, f)| (b.clone(), f.clone()));
            let pdf_att  = pdf_attachment.as_ref().map(|(b, f)| (b.clone(), f.clone()));
            send_one_email(
                transport.as_ref().unwrap(),
                &cfg.from,
                &student_email,
                &data.student_name,
                &cfg.subject,
                &body,
                zip_att,
                pdf_att,
            )
            .await
        };

        match send_result {
            Ok(()) => {
                tracing::info!(
                    student = %student_email,
                    maille  = %data.maille_code,
                    mission = %data.mission_code,
                    sha256  = %geojson_sha256,
                    pdf     = pdf_attachment.is_some(),
                    "Email Colab envoyé"
                );
                log_job(pool, job_id, "info", &format!("Email envoyé à {}", student_email), json!({
                    "assignment_id":  assignment_id,
                    "maille_code":    data.maille_code,
                    "geojson_sha256": geojson_sha256,
                    "zip":            zip_attachment.is_some(),
                    "pdf":            pdf_attachment.is_some(),
                })).await;
                sqlx::query(
                    r#"UPDATE atlas.colab_maille_notification_logs
                       SET status = 'sent', sent_at = NOW()
                       WHERE assignment_id = $1 AND email_job_id = $2 AND status = 'pending'"#,
                )
                .bind(assignment_id)
                .bind(job_id)
                .execute(pool)
                .await
                .ok();
                sent_count += 1;
            }
            Err(e) => {
                tracing::error!(error = %e, student = %student_email, "Échec envoi email Colab");
                sqlx::query(
                    r#"UPDATE atlas.colab_maille_notification_logs
                       SET status = 'failed', error = $3
                       WHERE assignment_id = $1 AND email_job_id = $2 AND status = 'pending'"#,
                )
                .bind(assignment_id)
                .bind(job_id)
                .bind(e.to_string())
                .execute(pool)
                .await
                .ok();
                log_job(pool, job_id, "warn", &format!("Échec email {}", student_email), json!({
                    "error": e.to_string(), "assignment_id": assignment_id
                })).await;
            }
        }
    }

    Ok(sent_count)
}

// ─────────────────────────────────────────────────────────────────────────────
// Extraction des données depuis une ligne sqlx
// ─────────────────────────────────────────────────────────────────────────────

fn extract_email_data(row: &sqlx::postgres::PgRow) -> anyhow::Result<EmailData> {
    // Points de sondage (JSON -> Vec<SondagePoint>)
    let sondage_points: Vec<SondagePoint> = {
        let raw: Option<serde_json::Value> = row.try_get("sondage_points_json").ok();
        raw.and_then(|v| v.as_array().cloned())
            .unwrap_or_default()
            .into_iter()
            .filter_map(|obj| {
                let numero = obj.get("numero")?.as_i64()? as i32;
                let lat    = obj.get("lat")?.as_f64()?;
                let lon    = obj.get("lon")?.as_f64()?;
                let label  = obj.get("label").and_then(|v| v.as_str()).map(|s| s.to_string());
                let notes  = obj.get("notes").and_then(|v| v.as_str()).map(|s| s.to_string());
                Some(SondagePoint { numero, label, lat, lon, notes })
            })
            .collect()
    };

    Ok(EmailData {
        assignment_id:    row.try_get("assignment_id")?,
        assignment_role:  row.try_get::<String, _>("assignment_role").unwrap_or_else(|_| "primary".to_string()),
        assignment_notes: row.try_get("assignment_notes").ok(),
        student_email:    row.try_get("student_email")?,
        student_name:     row.try_get("student_name")?,
        matricule:        row.try_get::<String, _>("matricule").unwrap_or_default(),
        maille_code:      row.try_get("maille_code")?,
        mission_title:    row.try_get("mission_title")?,
        mission_code:     row.try_get("mission_code")?,
        mission_theme:    row.try_get::<String, _>("mission_theme").unwrap_or_else(|_| "reconnaissance".to_string()),
        mission_objectifs: row.try_get("mission_objectifs").ok(),
        expected_sondages: row.try_get("expected_sondages").ok(),
        start_date:       row.try_get("start_date").ok(),
        end_date:         row.try_get("end_date").ok(),
        depth_h1_m:       row.try_get::<f64, _>("depth_h1_m").ok(),
        depth_h2_m:       row.try_get::<f64, _>("depth_h2_m").ok(),
        depth_h3_m:       row.try_get::<f64, _>("depth_h3_m").ok(),
        supervisor_name:  row.try_get::<String, _>("supervisor_name").unwrap_or_default(),
        supervisor_email: row.try_get::<String, _>("supervisor_email").unwrap_or_default(),
        supervisor_phone: row.try_get::<String, _>("supervisor_phone").unwrap_or_default(),
        supervisor_titre: row.try_get::<String, _>("supervisor_titre").unwrap_or_default(),
        lat:              row.try_get("lat").ok(),
        lon:              row.try_get("lon").ok(),
        bbox_ymin:        row.try_get("bbox_ymin").ok(),
        bbox_xmin:        row.try_get("bbox_xmin").ok(),
        bbox_ymax:        row.try_get("bbox_ymax").ok(),
        bbox_xmax:        row.try_get("bbox_xmax").ok(),
        maille_geojson:   row.try_get("maille_geojson").ok(),
        prefecture:       row.try_get::<String, _>("prefecture").ok().filter(|s| !s.is_empty()),
        commune:          row.try_get::<String, _>("commune").ok().filter(|s| !s.is_empty()),
        region:           row.try_get::<String, _>("region").ok().filter(|s| !s.is_empty()),
        canton:           row.try_get::<String, _>("canton").ok().filter(|s| !s.is_empty()),
        altitude_mean:    row.try_get::<f64, _>("altitude_mean").ok(),
        dem_slope_mean_deg: row.try_get::<f64, _>("dem_slope_mean_deg").ok(),
        distance_river_m: row.try_get::<f64, _>("distance_river_m").ok(),
        vbs_rk_h1:        row.try_get::<f64, _>("vbs_rk_h1").ok(),
        ip_rk_h1:         row.try_get::<f64, _>("ip_rk_h1").ok(),
        prec_annual:      row.try_get::<f64, _>("prec_annual").ok(),
        prec_dry:         row.try_get::<f64, _>("prec_dry").ok(),
        prec_wet:         row.try_get::<f64, _>("prec_wet").ok(),
        geologie:         row.try_get::<String, _>("geologie").ok().filter(|s| !s.is_empty()),
        pedologie:        row.try_get::<String, _>("pedologie").ok().filter(|s| !s.is_empty()),
        risque_gonflement: row.try_get::<String, _>("risque_gonflement").ok().filter(|s| !s.is_empty()),
        nb_sondages_existants: row.try_get::<i32, _>("nb_sondages_existants").unwrap_or(0),
        sondage_points,
    })
}

// ─────────────────────────────────────────────────────────────────────────────
// GeoJSON + ZIP + SHA-256
// ─────────────────────────────────────────────────────────────────────────────

fn build_geojson(data: &EmailData, job_id: Uuid) -> String {
    use serde_json::Map;

    let geom_value: Value = data
        .maille_geojson
        .as_deref()
        .and_then(|s| serde_json::from_str(s).ok())
        .unwrap_or(Value::Null);

    let now = chrono::Utc::now().format("%Y-%m-%dT%H:%M:%SZ").to_string();

    let mut props = Map::new();
    let ins = |m: &mut Map<String, Value>, k: &str, v: Value| { m.insert(k.to_string(), v); };

    ins(&mut props, "code_maille",     json!(data.maille_code));
    ins(&mut props, "mission_code",    json!(data.mission_code));
    ins(&mut props, "mission_title",   json!(data.mission_title));
    ins(&mut props, "theme",           json!(data.mission_theme));
    ins(&mut props, "role_operateur",  json!(data.assignment_role));
    ins(&mut props, "region",          json!(data.region));
    ins(&mut props, "prefecture",      json!(data.prefecture));
    ins(&mut props, "commune",         json!(data.commune));
    ins(&mut props, "canton",          json!(data.canton));
    ins(&mut props, "centroid_lat",    json!(data.lat));
    ins(&mut props, "centroid_lon",    json!(data.lon));
    ins(&mut props, "bbox_N_deg",      json!(data.bbox_ymax));
    ins(&mut props, "bbox_S_deg",      json!(data.bbox_ymin));
    ins(&mut props, "bbox_E_deg",      json!(data.bbox_xmax));
    ins(&mut props, "bbox_O_deg",      json!(data.bbox_xmin));
    ins(&mut props, "altitude_moy_m",  json!(data.altitude_mean));
    ins(&mut props, "pente_moy_deg",   json!(data.dem_slope_mean_deg));
    ins(&mut props, "dist_riviere_m",  json!(data.distance_river_m));
    ins(&mut props, "prec_annual_mm",  json!(data.prec_annual));
    ins(&mut props, "prec_dry_mm",     json!(data.prec_dry));
    ins(&mut props, "prec_wet_mm",     json!(data.prec_wet));
    ins(&mut props, "geologie",        json!(data.geologie));
    ins(&mut props, "pedologie",       json!(data.pedologie));
    ins(&mut props, "risque_gonflement", json!(data.risque_gonflement));
    ins(&mut props, "vbs_rk_h1",      json!(data.vbs_rk_h1));
    ins(&mut props, "ip_rk_h1",       json!(data.ip_rk_h1));
    ins(&mut props, "depth_h1_m",     json!(data.depth_h1_m));
    ins(&mut props, "depth_h2_m",     json!(data.depth_h2_m));
    ins(&mut props, "depth_h3_m",     json!(data.depth_h3_m));
    ins(&mut props, "nb_sondages_existants", json!(data.nb_sondages_existants));
    ins(&mut props, "date_debut",     json!(data.start_date.map(|d| d.to_string())));
    ins(&mut props, "date_fin",       json!(data.end_date.map(|d| d.to_string())));
    ins(&mut props, "superviseur",    json!(data.supervisor_name));
    ins(&mut props, "superviseur_tel", json!(data.supervisor_phone));

    // Maille polygon feature
    let maille_feature = json!({
        "type": "Feature",
        "geometry": geom_value,
        "properties": Value::Object(props)
    });

    // Sondage point features
    let sondage_features: Vec<Value> = data.sondage_points.iter().map(|sp| {
        json!({
            "type": "Feature",
            "geometry": {
                "type": "Point",
                "coordinates": [sp.lon, sp.lat]
            },
            "properties": {
                "type": "sondage_prevu",
                "numero": sp.numero,
                "label": sp.label,
                "notes": sp.notes,
                "mission_code": data.mission_code,
                "maille_code": data.maille_code
            }
        })
    }).collect();

    let mut features = vec![maille_feature];
    features.extend(sondage_features);

    let fc = json!({
        "type": "FeatureCollection",
        "metadata": {
            "source":         "Atlas Géotechnique Togo — DGTP/MTPTMU",
            "generated_at":   now,
            "job_id":         job_id.to_string(),
            "classification": "USAGE INTERNE — NE PAS DIFFUSER",
            "mission_code":   data.mission_code
        },
        "features": features
    });

    serde_json::to_string_pretty(&fc).unwrap_or_else(|_| "{}".to_string())
}

fn build_zip_attachment(geojson_bytes: &[u8], geojson_filename: &str) -> anyhow::Result<Vec<u8>> {
    let buf = Vec::new();
    let cursor = std::io::Cursor::new(buf);
    let mut zip = ZipWriter::new(cursor);

    let options = FileOptions::default()
        .compression_method(zip::CompressionMethod::Deflated)
        .unix_permissions(0o644);

    zip.start_file(geojson_filename, options)?;
    zip.write_all(geojson_bytes)?;

    let cursor = zip.finish()?;
    Ok(cursor.into_inner())
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

fn sanitize_filename(s: &str) -> String {
    s.chars()
        .map(|c| if c.is_alphanumeric() || c == '-' || c == '_' { c } else { '_' })
        .collect()
}

// ─────────────────────────────────────────────────────────────────────────────
// PDF — Ordre de Mission
// ─────────────────────────────────────────────────────────────────────────────

fn build_ordre_de_mission_pdf(data: &EmailData, job_id: Uuid) -> anyhow::Result<Vec<u8>> {
    let title = format!("Ordre de Mission — {}", data.mission_code);
    let (doc, page1, layer1) = PdfDocument::new(&title, Mm(210.0), Mm(297.0), "Contenu");
    let layer = doc.get_page(page1).get_layer(layer1);

    // Fontes intégrées (aucun fichier requis)
    let f  = doc.add_builtin_font(BuiltinFont::Helvetica)
        .map_err(|e| anyhow::anyhow!("font: {}", e))?;
    let fb = doc.add_builtin_font(BuiltinFont::HelveticaBold)
        .map_err(|e| anyhow::anyhow!("font bold: {}", e))?;

    let navy  = Color::Rgb(Rgb { r: 0.106, g: 0.227, b: 0.361, icc_profile: None });
    let white = Color::Rgb(Rgb { r: 1.0,   g: 1.0,   b: 1.0,   icc_profile: None });
    let black = Color::Rgb(Rgb { r: 0.0,   g: 0.0,   b: 0.0,   icc_profile: None });
    let lgray = Color::Rgb(Rgb { r: 0.94,  g: 0.95,  b: 0.96,  icc_profile: None });
    let mgray = Color::Rgb(Rgb { r: 0.55,  g: 0.55,  b: 0.55,  icc_profile: None });

    let today = chrono::Utc::now().format("%d/%m/%Y").to_string();
    let ref_str = format!("Ref. ATLAS-{}", data.mission_code);

    // ── En-tête bleu marine (Y: 274-297mm) ───────────────────────────────────
    fill_rect(&layer, navy.clone(), 0.0, 273.0, 210.0, 297.0);

    layer.set_fill_color(white.clone());
    layer.use_text("ORDRE DE MISSION", 18.0, Mm(14.0), Mm(283.5), &fb);
    layer.use_text("Republique Togolaise — Programme Atlas Geotechnique Togo", 8.5, Mm(14.0), Mm(277.0), &f);
    layer.use_text(&ref_str, 8.0, Mm(133.0), Mm(284.5), &f);
    layer.use_text(&format!("Emis le {}", today), 8.0, Mm(133.0), Mm(279.5), &f);

    // ── Bande grise légère sous l'en-tête ────────────────────────────────────
    fill_rect(&layer, lgray.clone(), 0.0, 268.0, 210.0, 273.0);
    layer.set_fill_color(navy.clone());
    layer.use_text("DOCUMENT OFFICIEL — A CONSERVER POUR LA DUREE DE LA MISSION", 7.5, Mm(14.0), Mm(269.5), &fb);

    // ── Contenu — deux colonnes ───────────────────────────────────────────────
    // Colonne gauche : x 14..125mm
    // Colonne droite  : x 133..196mm (QR code)

    let lx  = 14.0_f64; // left x
    let vx  = 72.0_f64; // value x
    let mut y = 260.0_f64;

    let row_h    = 5.0_f64;  // hauteur d'une ligne de données
    let sec_gap  = 3.5_f64;  // espace entre sections
    let sec_size = 8.0_f64;  // taille police section header

    // Helper macros inline
    macro_rules! sec {
        ($txt:expr) => {{
            layer.set_fill_color(navy.clone());
            layer.use_text($txt, sec_size, Mm(lx), Mm(y), &fb);
            y -= 1.5;
            // underline
            layer.set_fill_color(navy.clone());
            layer.set_outline_color(navy.clone());
            layer.add_shape(Line {
                points: vec![
                    (Point::new(Mm(lx), Mm(y)), false),
                    (Point::new(Mm(123.0), Mm(y)), false),
                ],
                is_closed: false, has_fill: false, has_stroke: true, is_clipping_path: false,
            });
            y -= row_h;
        }};
    }

    macro_rules! row {
        ($lbl:expr, $val:expr) => {{
            layer.set_fill_color(mgray.clone());
            layer.use_text($lbl, 7.5, Mm(lx), Mm(y), &f);
            layer.set_fill_color(black.clone());
            layer.use_text($val, 8.0, Mm(vx), Mm(y), &f);
            y -= row_h;
        }};
    }

    macro_rules! rowb {
        ($lbl:expr, $val:expr) => {{
            layer.set_fill_color(mgray.clone());
            layer.use_text($lbl, 7.5, Mm(lx), Mm(y), &f);
            layer.set_fill_color(black.clone());
            layer.use_text($val, 8.0, Mm(vx), Mm(y), &fb);
            y -= row_h;
        }};
    }

    // ── Section BENEFICIAIRE ──────────────────────────────────────────────────
    sec!("BENEFICIAIRE");
    let role_label = match data.assignment_role.as_str() {
        "primary"   => "Operateur principal",
        "assistant" => "Operateur assistant",
        "observer"  => "Observateur",
        other       => other,
    };
    rowb!("Nom complet", &data.student_name);
    row!("Matricule",    &if data.matricule.is_empty() { "—".to_string() } else { data.matricule.clone() });
    row!("Role",         role_label);
    row!("Email",        &data.student_email);
    y -= sec_gap;

    // ── Section MISSION ───────────────────────────────────────────────────────
    sec!("MISSION");
    rowb!("Code",   &data.mission_code);

    // Titre : wrap sur 2-3 lignes par mots (max 34 chars/ligne — colonne valeur = 62mm à 8pt)
    {
        let words: Vec<&str> = data.mission_title.split_whitespace().collect();
        let mut lines: Vec<String> = Vec::new();
        let mut current = String::new();
        for word in &words {
            if current.is_empty() {
                current = word.to_string();
            } else if current.len() + 1 + word.len() <= 34 {
                current.push(' ');
                current.push_str(word);
            } else {
                lines.push(current.clone());
                current = word.to_string();
                if lines.len() == 2 { break; }
            }
        }
        if !current.is_empty() && lines.len() < 3 { lines.push(current); }

        // Ligne 1
        layer.set_fill_color(mgray.clone());
        layer.use_text("Titre", 7.5, Mm(lx), Mm(y), &f);
        if let Some(l1) = lines.get(0) {
            layer.set_fill_color(black.clone());
            layer.use_text(l1.as_str(), 8.0, Mm(vx), Mm(y), &f);
        }
        y -= row_h;
        // Lignes suivantes (indent sous la valeur)
        for li in lines.iter().skip(1) {
            layer.set_fill_color(black.clone());
            layer.use_text(li.as_str(), 8.0, Mm(vx), Mm(y), &f);
            y -= row_h;
        }
    }

    let theme_fr = match data.mission_theme.as_str() {
        "reconnaissance"  => "Reconnaissance geotechnique",
        "etude_detaillee" => "Etude geotechnique detaillee",
        "stabilisation"   => "Stabilisation / Traitement des sols",
        "synthese"        => "Synthese bibliographique",
        "controle"        => "Controle et surveillance",
        "fondation"       => "Etudes de fondations",
        "voirie"          => "Voirie et infrastructure routiere",
        "hydraulique"     => "Hydraulique et drainage",
        "risque"          => "Risques geologiques",
        other             => other,
    };
    row!("Theme", theme_fr);
    let fmt_d = |d: Option<chrono::NaiveDate>| d.map(|x| x.format("%d/%m/%Y").to_string()).unwrap_or_else(|| "—".to_string());
    let period = format!("{} au {}", fmt_d(data.start_date), fmt_d(data.end_date));
    row!("Periode", &period);
    y -= sec_gap;

    // ── Section ZONE D'INTERVENTION ──────────────────────────────────────────
    sec!("ZONE D'INTERVENTION");
    rowb!("Code maille", &data.maille_code);
    if let Some(r) = &data.region    { row!("Region", r); }
    if let Some(p) = &data.prefecture { row!("Prefecture", p); }
    if let Some(c) = &data.canton    { row!("Canton", c); }
    if let (Some(la), Some(lo)) = (data.lat, data.lon) {
        row!("Centroide WGS84", &format!("{:.5} N,  {:.5} E", la, lo));
    }
    y -= sec_gap;

    // ── Section PROTOCOLE ────────────────────────────────────────────────────
    if y > 50.0 {
        sec!("PROTOCOLE DE RECONNAISSANCE");
        let nb = data.expected_sondages.unwrap_or(0);
        row!("Sondages attendus", &if nb > 0 { nb.to_string() } else { "A definir".to_string() });
        if let Some(h1) = data.depth_h1_m { row!("Profondeur H1", &format!("{:.1} m", h1)); }
        if let Some(h2) = data.depth_h2_m { row!("Profondeur H2", &format!("{:.1} m", h2)); }
        if let Some(h3) = data.depth_h3_m { row!("Profondeur H3", &format!("{:.1} m", h3)); }
        y -= sec_gap;
    }

    // ── Section POINTS DE SONDAGE ─────────────────────────────────────────────
    if !data.sondage_points.is_empty() && y > 60.0 {
        sec!("LOCALISATIONS DES SONDAGES PREVUS");

        // En-tête tableau
        fill_rect(&layer, lgray.clone(), lx - 0.5, y - 1.0, 123.5, y + 3.5);
        layer.set_fill_color(navy.clone());
        layer.use_text("N",        7.0, Mm(lx),       Mm(y), &fb);
        layer.use_text("Label",    7.0, Mm(lx + 8.0), Mm(y), &fb);
        layer.use_text("Latitude", 7.0, Mm(lx + 40.0), Mm(y), &fb);
        layer.use_text("Longitude",7.0, Mm(lx + 68.0), Mm(y), &fb);
        y -= 4.5;

        for (idx, sp) in data.sondage_points.iter().enumerate() {
            if y < 30.0 { break; }
            layer.set_fill_color(black.clone());
            let num_str = (idx + 1).to_string();
            layer.use_text(&num_str, 7.5, Mm(lx), Mm(y), &f);
            layer.use_text(sp.label.as_deref().unwrap_or("—"), 7.5, Mm(lx + 8.0), Mm(y), &f);
            layer.use_text(&format!("{:.5}", sp.lat), 7.5, Mm(lx + 40.0), Mm(y), &f);
            layer.use_text(&format!("{:.5}", sp.lon), 7.5, Mm(lx + 68.0), Mm(y), &f);
            y -= 4.0;
        }
        y -= sec_gap;
    }

    // ── Superviseur ───────────────────────────────────────────────────────────
    if !data.supervisor_name.is_empty() && y > 40.0 {
        sec!("ENCADREMENT");
        rowb!("Superviseur", &data.supervisor_name);
        if !data.supervisor_email.is_empty() {
            row!("Contact email", &data.supervisor_email);
        }
        if !data.supervisor_phone.is_empty() {
            row!("Telephone",  &data.supervisor_phone);
        }
        y -= sec_gap;
    }

    // ── QR Code (colonne droite) ──────────────────────────────────────────────
    if let (Some(la), Some(lo)) = (data.lat, data.lon) {
        let maps_url = format!("https://www.google.com/maps?q={:.6},{:.6}&z=14", la, lo);
        let qr_x    = 134.0_f64;
        let qr_y    = 200.0_f64;
        let qr_size = 45.0_f64;

        draw_qr_on_layer(&layer, &maps_url, qr_x, qr_y, qr_size);

        layer.set_fill_color(navy.clone());
        layer.use_text("Localisation GPS", 7.5, Mm(qr_x), Mm(qr_y + qr_size + 3.5), &fb);
        layer.set_fill_color(mgray.clone());
        layer.use_text("Google Maps — scanner le QR", 7.0, Mm(qr_x), Mm(qr_y + qr_size + 0.5), &f);
        layer.set_fill_color(black.clone());
        layer.use_text(&format!("{:.5} N", la), 7.5, Mm(qr_x), Mm(qr_y - 5.0), &f);
        layer.use_text(&format!("{:.5} E", lo), 7.5, Mm(qr_x), Mm(qr_y - 9.0), &f);
    }

    // ── Pied de page ──────────────────────────────────────────────────────────
    // Ligne séparatrice
    layer.set_fill_color(Color::Rgb(Rgb { r: 0.78, g: 0.78, b: 0.78, icc_profile: None }));
    layer.set_outline_color(Color::Rgb(Rgb { r: 0.78, g: 0.78, b: 0.78, icc_profile: None }));
    layer.add_shape(Line {
        points: vec![
            (Point::new(Mm(14.0), Mm(24.0)), false),
            (Point::new(Mm(196.0), Mm(24.0)), false),
        ],
        is_closed: false, has_fill: false, has_stroke: true, is_clipping_path: false,
    });

    layer.set_fill_color(mgray.clone());
    let notif_ref = format!("ATLAS-{}-{}", data.mission_code, data.maille_code);
    layer.use_text("Ce document constitue un ordre de mission officiel. A conserver et presenter sur le terrain.", 7.0, Mm(14.0), Mm(20.5), &f);
    layer.use_text(&format!("Ref : {}   |   ID job : {}   |   Atlas Geotechnique Togo — DGTP/MTPTMU",
        notif_ref, &job_id.to_string()[..8]), 6.5, Mm(14.0), Mm(16.5), &f);

    // ── Sauvegarde ────────────────────────────────────────────────────────────
    let mut buf = Vec::new();
    {
        let mut writer = std::io::BufWriter::new(&mut buf);
        doc.save(&mut writer)
            .map_err(|e| anyhow::anyhow!("PDF save: {}", e))?;
    }
    Ok(buf)
}

/// Dessine un rectangle rempli (couleur définie avant l'appel via fill_rect)
fn fill_rect(layer: &printpdf::PdfLayerReference, color: Color, x0: f64, y0: f64, x1: f64, y1: f64) {
    layer.set_fill_color(color.clone());
    layer.set_outline_color(color);
    layer.add_shape(Line {
        points: vec![
            (Point::new(Mm(x0), Mm(y0)), false),
            (Point::new(Mm(x1), Mm(y0)), false),
            (Point::new(Mm(x1), Mm(y1)), false),
            (Point::new(Mm(x0), Mm(y1)), false),
        ],
        is_closed: true,
        has_fill: true,
        has_stroke: false,
        is_clipping_path: false,
    });
}

/// Dessine un QR code en tant que grille de petits rectangles noirs
fn draw_qr_on_layer(layer: &printpdf::PdfLayerReference, url: &str, x_mm: f64, y_mm: f64, size_mm: f64) {
    let code = match QrCode::new(url.as_bytes()) {
        Ok(c) => c,
        Err(_) => return,
    };
    let colors = code.to_colors();
    let width = code.width();
    let module_size = size_mm / width as f64;

    for (i, color) in colors.iter().enumerate() {
        if *color == QrColor::Dark {
            let col = i % width;
            let row = i / width;
            let x = x_mm + col as f64 * module_size;
            // PDF : Y=0 en bas — row 0 (haut du QR) → y_mm + (width-1-row)*module_size
            let y = y_mm + (width - 1 - row) as f64 * module_size;
            fill_rect(layer,
                Color::Rgb(Rgb { r: 0.0, g: 0.0, b: 0.0, icc_profile: None }),
                x, y, x + module_size, y + module_size,
            );
        }
    }
}

// ─────────────────────────────────────────────────────────────────────────────
// Envoi SMTP — multiple pièces jointes
// ─────────────────────────────────────────────────────────────────────────────

async fn send_one_email(
    transport: &AsyncSmtpTransport<Tokio1Executor>,
    from: &str,
    to_email: &str,
    to_name: &str,
    subject: &str,
    html_body: &str,
    zip_attachment:  Option<(Vec<u8>, String)>,
    pdf_attachment:  Option<(Vec<u8>, String)>,
) -> anyhow::Result<()> {
    let from_mb = from.parse().map_err(|e| anyhow::anyhow!("from invalide: {}", e))?;
    let to_mb   = format!("{} <{}>", to_name, to_email)
        .parse()
        .map_err(|e| anyhow::anyhow!("to invalide: {}", e))?;

    let email = if zip_attachment.is_some() || pdf_attachment.is_some() {
        let mut mp = MultiPart::mixed()
            .singlepart(SinglePart::html(html_body.to_string()));

        if let Some((pdf_bytes, pdf_name)) = pdf_attachment {
            let ct = "application/pdf".parse::<ContentType>().unwrap_or(ContentType::TEXT_PLAIN);
            mp = mp.singlepart(Attachment::new(pdf_name).body(pdf_bytes, ct));
        }
        if let Some((zip_bytes, zip_name)) = zip_attachment {
            let ct = "application/zip".parse::<ContentType>().unwrap_or(ContentType::TEXT_PLAIN);
            mp = mp.singlepart(Attachment::new(zip_name).body(zip_bytes, ct));
        }

        Message::builder()
            .from(from_mb)
            .to(to_mb)
            .subject(subject)
            .multipart(mp)
            .map_err(|e| anyhow::anyhow!("build message: {}", e))?
    } else {
        Message::builder()
            .from(from_mb)
            .to(to_mb)
            .subject(subject)
            .header(ContentType::TEXT_HTML)
            .body(html_body.to_string())
            .map_err(|e| anyhow::anyhow!("build message: {}", e))?
    };

    transport.send(email).await.map_err(|e| anyhow::anyhow!("SMTP: {}", e))?;
    Ok(())
}

// ─────────────────────────────────────────────────────────────────────────────
// Template HTML — design professionnel, sans emojis
// ─────────────────────────────────────────────────────────────────────────────

fn build_email_html(
    data: &EmailData,
    instructions: &str,
    include_bbox: bool,
    job_id: Uuid,
    geojson_sha256: &str,
) -> String {
    let today = chrono::Utc::now().format("%d/%m/%Y").to_string();
    let notification_ref = format!("ATLAS-{}-{}", &data.mission_code, &data.maille_code);
    let job_id_short = &job_id.to_string()[..8];

    let role_label = match data.assignment_role.as_str() {
        "primary"   => "Opérateur principal",
        "assistant" => "Opérateur assistant",
        "observer"  => "Observateur",
        other       => other,
    };

    let theme_label = match data.mission_theme.as_str() {
        "reconnaissance"    => "Reconnaissance géotechnique",
        "etude_detaillee"   => "Étude détaillée",
        "stabilisation"     => "Stabilisation de sol",
        "synthese"          => "Synthèse géotechnique",
        "controle"          => "Contrôle et suivi",
        other               => other,
    };

    let fmt_date = |d: Option<chrono::NaiveDate>| {
        d.map(|x| x.format("%d/%m/%Y").to_string())
         .unwrap_or_else(|| "—".to_string())
    };
    let date_debut = fmt_date(data.start_date);
    let date_fin   = fmt_date(data.end_date);

    // ── Bloc 1 — Identité mission ─────────────────────────────────────────────
    let objectifs_row = data.mission_objectifs.as_deref().filter(|s| !s.is_empty())
        .map(|obj| format!("{}", tr_row("Objectifs", obj, "")))
        .unwrap_or_default();

    let notes_row = data.assignment_notes.as_deref().filter(|s| !s.is_empty())
        .map(|n| format!(
            r#"<tr style="background:#fefce8">
              <td style="{}">{}</td>
              <td style="{}">{}</td>
            </tr>"#, TD_LBL, "Notes d'affectation", TD_VAL, html_escape(n)
        ))
        .unwrap_or_default();

    let instructions_row = if !instructions.is_empty() {
        format!(
            r#"<tr style="background:#fefce8">
              <td style="{}">{}</td>
              <td style="{}">{}</td>
            </tr>"#, TD_LBL, "Instructions", TD_VAL, html_escape(instructions)
        )
    } else { String::new() };

    // ── Bloc 2 — Localisation ─────────────────────────────────────────────────
    let admin_rows = {
        let mut s = String::new();
        if let Some(r) = &data.region     { s.push_str(&tr_row("Région", r, "")); }
        if let Some(p) = &data.prefecture { s.push_str(&tr_row("Préfecture", p, "")); }
        if let Some(c) = &data.canton     { s.push_str(&tr_row("Canton", c, "")); }
        s
    };

    let geo_rows = if let (Some(la), Some(lo)) = (data.lat, data.lon) {
        let maps_url = format!("https://www.google.com/maps?q={:.6},{:.6}&z=14", la, lo);
        let centroid_str = format!(
            r#"{:.5}&deg; N, {:.5}&deg; E &nbsp;&nbsp;<a href="{}" style="color:#1a5276;font-weight:600;text-decoration:none">Voir sur Google Maps &rarr;</a>"#,
            la, lo, maps_url
        );
        let mut s = format!(
            r#"<tr style="background:#ebf5fb">
              <td style="{}">{}</td>
              <td style="{}">{}</td>
            </tr>"#,
            TD_LBL, "Centroïde WGS84", TD_VAL, centroid_str
        );
        if include_bbox {
            if let (Some(x0), Some(y0), Some(x1), Some(y1)) =
                (data.bbox_xmin, data.bbox_ymin, data.bbox_xmax, data.bbox_ymax)
            {
                s.push_str(&format!(
                    r#"<tr>
                      <td style="{}">Emprise (BBox)</td>
                      <td style="{}" class="mono">N {:.5}&deg; &nbsp;S {:.5}&deg;<br>E {:.5}&deg; &nbsp;O {:.5}&deg;</td>
                    </tr>"#,
                    TD_LBL, TD_VAL, y1, y0, x1, x0
                ));
            }
        }
        s
    } else { String::new() };

    // ── Bloc 3 — Contexte physique et climatique ──────────────────────────────
    let terrain_rows = {
        let mut s = String::new();
        if let Some(alt) = data.altitude_mean {
            let desc = if alt < 50.0 { "plaine" } else if alt < 300.0 { "basse altitude" } else { "altitude moyenne" };
            s.push_str(&tr_row("Altitude moyenne", &format!("{:.0} m ({})", alt, desc), ""));
        }
        if let Some(slope) = data.dem_slope_mean_deg {
            let desc = if slope < 2.0 { "quasi-plat" } else if slope < 10.0 { "légèrement pentu" } else { "pentu" };
            s.push_str(&tr_row("Pente moyenne", &format!("{:.1}° ({})", slope, desc), ""));
        }
        if let Some(river) = data.distance_river_m {
            let desc = if river < 500.0 { "Attention — proche du réseau hydrographique" }
                       else if river < 2000.0 { "Réseau hydrographique à proximité" }
                       else { "Éloigné du réseau hydrographique" };
            s.push_str(&tr_row("Distance rivière", &format!("{:.0} m — {}", river, desc), ""));
        }
        if let Some(pa) = data.prec_annual {
            let ps = data.prec_dry.unwrap_or(0.0);
            let pw = data.prec_wet.unwrap_or(0.0);
            s.push_str(&tr_row("Précipitations annuelles",
                &format!("{:.0} mm  (saison sèche : {:.0} mm | saison humide : {:.0} mm)", pa, ps, pw), ""));
        }
        s
    };

    // ── Bloc 4 — Contexte géologique et pédologique (sans ML) ─────────────────
    let geo_context_rows = {
        let mut s = String::new();
        if let Some(g) = &data.geologie {
            if !g.is_empty() { s.push_str(&tr_row("Formation géologique", g, "")); }
        }
        if let Some(p) = &data.pedologie {
            if !p.is_empty() { s.push_str(&tr_row("Type de sol (pédologique)", p, "")); }
        }
        if let Some(rg) = &data.risque_gonflement {
            if !rg.is_empty() {
                let rg_style = if rg.to_lowercase().contains("fort") { "color:#b91c1c;font-weight:600" }
                               else if rg.to_lowercase().contains("moyen") { "color:#b45309;font-weight:600" }
                               else { "" };
                s.push_str(&format!(
                    r#"<tr>
                      <td style="{}">{}</td>
                      <td style="{};{}">{}</td>
                    </tr>"#,
                    TD_LBL, "Risque de gonflement", TD_VAL, rg_style, html_escape(rg)
                ));
            }
        }
        if let Some(vbs) = data.vbs_rk_h1 {
            let note = if vbs > 5.0 { "argile très gonflante" }
                       else if vbs > 2.5 { "argile gonflante" }
                       else if vbs > 0.5 { "sol limoneux-argileux" }
                       else { "sol sableux non plastique" };
            s.push_str(&tr_row("VBS indicatif H1", &format!("{:.2} — {}", vbs, note), ""));
        }
        if let Some(ip) = data.ip_rk_h1 {
            let cl = if ip > 35.0 { "Très plastique (A7)" }
                     else if ip > 25.0 { "Plastique (A6)" }
                     else if ip > 17.0 { "Moyennement plastique (A4-A5)" }
                     else { "Peu plastique (A2-A3)" };
            s.push_str(&tr_row("Indice de plasticité H1", &format!("{:.1}% — {}", ip, cl), ""));
        }
        s
    };

    // ── Bloc 5 — Protocole de reconnaissance ──────────────────────────────────
    let protocol_rows = {
        let mut html = String::new();
        let expected = data.expected_sondages.unwrap_or(0);
        html.push_str(&tr_row("Nombre de sondages attendus",
            &if expected > 0 { format!("{}", expected) } else { "À définir sur site".to_string() }, ""));

        if let Some(h1) = data.depth_h1_m {
            html.push_str(&tr_row("Profondeur indicative H1", &format!("{:.1} m", h1), ""));
        }
        if let Some(h2) = data.depth_h2_m {
            html.push_str(&tr_row("Profondeur indicative H2", &format!("{:.1} m", h2), ""));
        }
        if let Some(h3) = data.depth_h3_m {
            html.push_str(&tr_row("Profondeur indicative H3", &format!("{:.1} m", h3), ""));
        }

        // Tableau des localisations GPS de sondages
        if !data.sondage_points.is_empty() {
            html.push_str(&format!(
                r#"<tr>
                  <td style="{}" colspan="2">
                    <strong>Points de sondage planifiés</strong>
                    <table width="100%" style="border-collapse:collapse;margin-top:8px;font-size:12px">
                      <thead>
                        <tr style="background:#e8ecf2">
                          <th style="padding:5px 8px;border:1px solid #d0d7e2;text-align:left;font-size:11px">N°</th>
                          <th style="padding:5px 8px;border:1px solid #d0d7e2;text-align:left;font-size:11px">Label</th>
                          <th style="padding:5px 8px;border:1px solid #d0d7e2;text-align:left;font-size:11px">Latitude</th>
                          <th style="padding:5px 8px;border:1px solid #d0d7e2;text-align:left;font-size:11px">Longitude</th>
                          <th style="padding:5px 8px;border:1px solid #d0d7e2;text-align:left;font-size:11px">Lien</th>
                        </tr>
                      </thead>
                      <tbody>"#,
                TD_LBL
            ));
            for sp in &data.sondage_points {
                let gmap = format!("https://www.google.com/maps?q={:.6},{:.6}&z=18", sp.lat, sp.lon);
                let bg = if sp.numero % 2 == 0 { "background:#f7f9fb" } else { "" };
                html.push_str(&format!(
                    r#"<tr style="{}">
                      <td style="padding:5px 8px;border:1px solid #d0d7e2;text-align:center;font-weight:600">{}</td>
                      <td style="padding:5px 8px;border:1px solid #d0d7e2">{}</td>
                      <td style="padding:5px 8px;border:1px solid #d0d7e2;font-family:monospace;font-size:11px">{:.5}</td>
                      <td style="padding:5px 8px;border:1px solid #d0d7e2;font-family:monospace;font-size:11px">{:.5}</td>
                      <td style="padding:5px 8px;border:1px solid #d0d7e2"><a href="{}" style="color:#1a5276;text-decoration:none;font-weight:600">Voir</a></td>
                    </tr>"#,
                    bg, sp.numero,
                    html_escape(sp.label.as_deref().unwrap_or("—")),
                    sp.lat, sp.lon, gmap
                ));
            }
            html.push_str("</tbody></table></td></tr>");
        }

        html
    };

    // ── Bloc 6 — Données de référence ─────────────────────────────────────────
    let nb = data.nb_sondages_existants;
    let sondages_block = format!(
        r#"<tr>
          <td style="{}">Sondages dans la base Atlas (maille)</td>
          <td style="{}">{} sondage{} déjà enregistré{} &nbsp;—&nbsp;
            <a href="http://localhost:1420" style="color:#1a5276;font-weight:600">Consulter la plateforme Atlas &rarr;</a>
          </td>
        </tr>"#,
        TD_LBL, TD_VAL, nb,
        if nb > 1 { "s" } else { "" },
        if nb > 1 { "s" } else { "" }
    );

    // ── Bloc 7 — Pièces jointes ────────────────────────────────────────────────
    let pdf_name = format!("OrdresMission-ATLAS-{}.pdf", sanitize_filename(&data.mission_code));
    let zip_name = format!("ATLAS-{}-{}.zip",
        sanitize_filename(&data.mission_code),
        sanitize_filename(&data.maille_code));
    let sha256_display = if geojson_sha256.is_empty() { "N/A".to_string() }
                         else { format!("{}…", &geojson_sha256[..32]) };

    let attachments_block = format!(
        r#"<div style="background:#f0f7ff;border:1px solid #bcd4f0;border-radius:6px;padding:14px;margin:12px 0;line-height:1.8">
          <div style="font-weight:600;color:#1a5276;margin-bottom:6px">Pièces jointes</div>
          <div style="margin-bottom:6px">
            <span style="display:inline-block;background:#1B3A5C;color:#fff;padding:1px 8px;border-radius:3px;font-size:11px;font-weight:600">PDF</span>
            &nbsp;<strong>{pdf_name}</strong><br>
            <span style="font-size:12px;color:#555">Ordre de mission officiel (1 page) avec QR code de localisation.</span>
          </div>
          <div>
            <span style="display:inline-block;background:#2c7a7b;color:#fff;padding:1px 8px;border-radius:3px;font-size:11px;font-weight:600">ZIP</span>
            &nbsp;<strong>{zip_name}</strong><br>
            <span style="font-size:12px;color:#555">
              Délimitation exacte de la maille au format GeoJSON (compatible QGIS, ArcGIS, Google Earth, Atlas Mobile).<br>
              <strong>Classification :</strong> <span style="color:#b91c1c;font-weight:600">USAGE INTERNE — NE PAS DIFFUSER</span>&nbsp;&nbsp;
              <strong>SHA-256 :</strong> <span style="font-family:monospace;font-size:11px">{sha256_display}</span>
            </span>
          </div>
        </div>"#,
        pdf_name = pdf_name, zip_name = zip_name, sha256_display = sha256_display,
    );

    // ── Superviseur ───────────────────────────────────────────────────────────
    let supervisor_block = if !data.supervisor_name.is_empty() {
        let titre = if data.supervisor_titre.is_empty() { String::new() }
                    else { format!(" — {}", data.supervisor_titre) };
        let email_part = if !data.supervisor_email.is_empty() {
            format!(r#"&nbsp;<a href="mailto:{0}" style="color:#1a5276">{0}</a>"#, data.supervisor_email)
        } else { String::new() };
        let phone_part = if !data.supervisor_phone.is_empty() {
            format!(" &nbsp;|&nbsp; <strong>{}</strong>", data.supervisor_phone)
        } else { String::new() };
        format!(
            r#"<div style="background:#f0f4f8;border-left:4px solid #1B3A5C;padding:10px 14px;margin:14px 0;border-radius:0 4px 4px 0">
              <strong>Encadrement :</strong> {}{}<br>
              <span style="font-size:13px">{}{}</span>
            </div>"#,
            html_escape(&data.supervisor_name), html_escape(&titre), email_part, phone_part
        )
    } else { String::new() };

    // ── Terrain block conditionnel ────────────────────────────────────────────
    let terrain_block = if terrain_rows.is_empty() { String::new() } else {
        format!(
            r#"<h4 style="{SH}">3. Contexte physique et climatique</h4>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
            {terrain_rows}
            </table>"#,
            SH = SH, terrain_rows = terrain_rows
        )
    };

    let geo_context_block = if geo_context_rows.is_empty() { String::new() } else {
        format!(
            r#"<h4 style="{SH}">4. Contexte géologique et pédologique</h4>
            <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
            {geo_context_rows}
            </table>"#,
            SH = SH, geo_context_rows = geo_context_rows
        )
    };

    // ── Assemblage ────────────────────────────────────────────────────────────
    format!(
        r#"<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    body {{
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;
      max-width: 660px;
      margin: 0 auto;
      padding: 0;
      color: #1a202c;
      font-size: 14px;
      background: #f4f6f9;
    }}
    .mono {{ font-family: 'Courier New', Courier, monospace; font-size: 12px; }}
  </style>
</head>
<body>

<!-- EN-TETE -->
<table width="100%" cellpadding="0" cellspacing="0" style="background:#1B3A5C;border-radius:8px 8px 0 0">
  <tr>
    <td style="padding:16px 22px">
      <div style="color:rgba(255,255,255,0.7);font-size:10px;letter-spacing:1.5px;text-transform:uppercase">République Togolaise — DGTP / MTPTMU</div>
      <div style="color:#fff;font-size:20px;font-weight:700;margin-top:3px;letter-spacing:-0.3px">Atlas Géotechnique Togo</div>
    </td>
    <td style="padding:16px 22px;text-align:right;vertical-align:top">
      <div style="color:#90b8d8;font-size:11px">Réf. {notification_ref}</div>
      <div style="color:#90b8d8;font-size:11px;margin-top:2px">Émis le {today}</div>
    </td>
  </tr>
</table>

<!-- CORPS -->
<div style="border:1px solid #dce3ec;border-top:none;padding:24px 28px;border-radius:0 0 8px 8px;background:#ffffff">

  <h3 style="margin-top:6px;margin-bottom:4px;font-size:16px;color:#1a202c">Bonjour {name},</h3>
  <p style="line-height:1.7;color:#374151;margin-top:6px">
    Cette notification officialise votre affectation en qualité de <strong>{role_label}</strong>
    à une mission de reconnaissance géotechnique dans le cadre du programme Atlas Géotechnique Togo.
    Elle peut s'inscrire dans le cadre d'une collecte institutionnelle de données, d'une étude de sol,
    d'un mémoire de fin d'études ou de tout autre programme d'identification géotechnique terrain.
  </p>
  <p style="line-height:1.7;color:#374151;margin-top:4px">
    Ce message constitue votre ordre de mission. Il contient toutes les informations nécessaires à la
    préparation et à l'exécution de votre intervention sur le terrain.
  </p>

  <!-- BLOC 1 — IDENTITE MISSION -->
  <h4 style="{SH}">1. Identité de la mission</h4>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
    <tr style="background:#eef2f7">
      <td style="{TD_LBL}">Mission</td>
      <td style="{TD_VAL}"><strong>{mission_title}</strong><br><span class="mono" style="color:#64748b">{mission_code}</span></td>
    </tr>
    <tr>
      <td style="{TD_LBL}">Thème</td>
      <td style="{TD_VAL}">{theme_label}</td>
    </tr>
    <tr style="background:#eef2f7">
      <td style="{TD_LBL}">Matricule / Rôle</td>
      <td style="{TD_VAL}"><span class="mono">{matricule}</span> &nbsp;—&nbsp; {role_label}</td>
    </tr>
    <tr>
      <td style="{TD_LBL}">Période d'exécution</td>
      <td style="{TD_VAL}">Du <strong>{date_debut}</strong> au <strong>{date_fin}</strong></td>
    </tr>
    {objectifs_row}
    {notes_row}
    {instructions_row}
  </table>

  <!-- BLOC 2 — LOCALISATION -->
  <h4 style="{SH}">2. Localisation de la zone d'intervention</h4>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
    <tr style="background:#eef2f7">
      <td style="{TD_LBL}">Code maille</td>
      <td style="{TD_VAL}" class="mono"><strong>{maille_code}</strong></td>
    </tr>
    {admin_rows}
    {geo_rows}
  </table>

  <!-- BLOC 3 — CONTEXTE PHYSIQUE -->
  {terrain_block}

  <!-- BLOC 4 — CONTEXTE GEOLOGIQUE -->
  {geo_context_block}

  <!-- BLOC 5 — PROTOCOLE -->
  <h4 style="{SH}">5. Protocole de reconnaissance</h4>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
    {protocol_rows}
  </table>

  <!-- BLOC 6 — DONNEES EXISTANTES -->
  <h4 style="{SH}">6. Données de référence</h4>
  <table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse;margin-bottom:14px">
    {sondages_block}
  </table>

  <!-- BLOC 7 — PIECES JOINTES -->
  <h4 style="{SH}">7. Documents joints</h4>
  {attachments_block}

  <!-- SUPERVISEUR -->
  {supervisor_block}

  <p style="margin-top:22px;color:#374151">Bonne mission,<br>
  <strong style="color:#1B3A5C">Programme Atlas Géotechnique Togo</strong></p>

</div>

<!-- PIED DE PAGE LEGAL -->
<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:10px">
  <tr>
    <td style="background:#f4f6f9;border:1px solid #dce3ec;border-radius:6px;padding:10px 16px;font-size:11px;color:#64748b;line-height:1.7">
      <strong style="color:#475569">Avertissement de confidentialité</strong><br>
      Ce message est nominatif et exclusivement destiné à <em>{name} ({student_email})</em>.
      Il contient des données opérationnelles de la DGTP/MTPTMU.
      Toute diffusion à des tiers non autorisés est interdite.
      En cas de réception par erreur, contactez immédiatement votre superviseur et détruisez ce message.<br>
      <strong>ID notification :</strong> <span class="mono">{job_id_short}…</span>
      &nbsp;|&nbsp;
      <strong>Réf :</strong> <span class="mono">{notification_ref}</span>
      &nbsp;|&nbsp; Atlas Géotechnique Togo — DGTP/MTPTMU
    </td>
  </tr>
</table>

</body>
</html>"#,
        notification_ref  = notification_ref,
        today             = today,
        name              = html_escape(&data.student_name),
        role_label        = role_label,
        SH                = SH,
        TD_LBL            = TD_LBL,
        TD_VAL            = TD_VAL,
        mission_title     = html_escape(&data.mission_title),
        mission_code      = html_escape(&data.mission_code),
        theme_label       = theme_label,
        matricule         = html_escape(&data.matricule),
        date_debut        = date_debut,
        date_fin          = date_fin,
        maille_code       = html_escape(&data.maille_code),
        admin_rows        = admin_rows,
        geo_rows          = geo_rows,
        terrain_block     = terrain_block,
        geo_context_block = geo_context_block,
        protocol_rows     = protocol_rows,
        sondages_block    = sondages_block,
        attachments_block = attachments_block,
        supervisor_block  = supervisor_block,
        objectifs_row     = objectifs_row,
        notes_row         = notes_row,
        instructions_row  = instructions_row,
        student_email     = html_escape(&data.student_email),
        job_id_short      = job_id_short,
    )
}

// ─────────────────────────────────────────────────────────────────────────────
// Constantes CSS
// ─────────────────────────────────────────────────────────────────────────────

const TD_LBL: &str = "padding:9px 13px;border:1px solid #dce3ec;font-weight:600;width:42%;vertical-align:top;background:#f0f4f8;color:#374151;font-size:13px";
const TD_VAL: &str = "padding:9px 13px;border:1px solid #dce3ec;vertical-align:top;color:#1a202c;font-size:13px";
const SH: &str     = "color:#1B3A5C;border-bottom:2px solid #dce3ec;padding-bottom:6px;font-size:15px;font-weight:600;margin-top:22px;margin-bottom:8px";

fn tr_row(label: &str, value: &str, row_style: &str) -> String {
    format!(
        r#"<tr style="{}">
          <td style="{}">{}</td>
          <td style="{}">{}</td>
        </tr>"#,
        row_style, TD_LBL, label, TD_VAL, html_escape(value)
    )
}

fn html_escape(s: &str) -> String {
    s.replace('&', "&amp;")
     .replace('<', "&lt;")
     .replace('>', "&gt;")
     .replace('"', "&quot;")
}

// ─────────────────────────────────────────────────────────────────────────────
// Log job
// ─────────────────────────────────────────────────────────────────────────────

async fn log_job(pool: &PgPool, job_id: Uuid, level: &str, message: &str, details: Value) {
    let _ = sqlx::query(
        r#"INSERT INTO atlas.colab_email_job_logs (job_id, level, message, details)
           VALUES ($1, $2, $3, $4)"#,
    )
    .bind(job_id)
    .bind(level)
    .bind(message)
    .bind(details)
    .execute(pool)
    .await;
}
