// ============================================================================
// Importeur géotechnique complet (XLSX multi-feuilles)
// ============================================================================

use super::xlsx_parser::*;
use anyhow::{Result, Context};
use sqlx::{PgPool, Postgres, Transaction};
use uuid::Uuid;
use std::collections::HashMap;
use chrono::NaiveDate;

#[derive(Debug, Clone, serde::Serialize)]
pub struct GeotechnicalImportStats {
    pub sondages_created: i32,
    pub sondages_updated: i32,
    pub echantillons_created: i32,
    pub atterberg_created: i32,
    pub vbs_created: i32,
    pub proctor_created: i32,
    pub granulo_points_created: i32,
    pub errors: Vec<String>,
    pub warnings: Vec<String>,
}

impl Default for GeotechnicalImportStats {
    fn default() -> Self {
        Self {
            sondages_created: 0,
            sondages_updated: 0,
            echantillons_created: 0,
            atterberg_created: 0,
            vbs_created: 0,
            proctor_created: 0,
            granulo_points_created: 0,
            errors: Vec::new(),
            warnings: Vec::new(),
        }
    }
}

// ============================================================================
// Import principal
// ============================================================================

pub async fn import_geotechnical_data(
    pool: &PgPool,
    data: XlsxImportData,
    geoloc_mode: &str,  // "exact", "centroid", "random", "unknown"
) -> Result<GeotechnicalImportStats> {
    let mut stats = GeotechnicalImportStats::default();
    let mut tx = pool.begin().await?;
    
    // 1. Créer/mettre à jour les sondages
    let mut sondage_ids: HashMap<String, Uuid> = HashMap::new();
    for sondage in &data.sondages {
        match upsert_sondage(&mut tx, sondage, geoloc_mode).await {
            Ok((id, is_new)) => {
                sondage_ids.insert(sondage.code_site.clone(), id);
                if is_new {
                    stats.sondages_created += 1;
                } else {
                    stats.sondages_updated += 1;
                }
            }
            Err(e) => {
                stats.errors.push(format!("Sondage {}: {}", sondage.code_site, e));
            }
        }
    }
    
    // 2. Créer les échantillons
    let mut echantillon_ids: HashMap<(String, String), Uuid> = HashMap::new();
    for echantillon in &data.echantillons {
        let sondage_id = match sondage_ids.get(&echantillon.code_site) {
            Some(id) => *id,
            None => {
                stats.warnings.push(format!(
                    "Échantillon {}@{}: sondage introuvable",
                    echantillon.code_site, echantillon.depth_m
                ));
                continue;
            }
        };
        
        match insert_echantillon(&mut tx, echantillon, sondage_id).await {
            Ok(id) => {
                let key = (echantillon.code_site.clone(), format!("{}", echantillon.depth_m));
                echantillon_ids.insert(key, id);
                stats.echantillons_created += 1;
            }
            Err(e) => {
                stats.errors.push(format!(
                    "Échantillon {}@{}: {}",
                    echantillon.code_site, echantillon.depth_m, e
                ));
            }
        }
    }
    
    // 3. Insérer essais Atterberg
    for atterberg in &data.atterberg {
        let key = (atterberg.code_site.clone(), format!("{}", atterberg.depth_m));
        let echantillon_id = match echantillon_ids.get(&key) {
            Some(id) => *id,
            None => {
                stats.warnings.push(format!(
                    "Atterberg {}@{}: échantillon introuvable",
                    atterberg.code_site, atterberg.depth_m
                ));
                continue;
            }
        };
        
        match insert_atterberg(&mut tx, atterberg, echantillon_id).await {
            Ok(_) => stats.atterberg_created += 1,
            Err(e) => {
                stats.errors.push(format!(
                    "Atterberg {}@{}: {}",
                    atterberg.code_site, atterberg.depth_m, e
                ));
            }
        }
    }
    
    // 4. Insérer essais VBS
    for vbs in &data.vbs {
        let key = (vbs.code_site.clone(), format!("{}", vbs.depth_m));
        let echantillon_id = match echantillon_ids.get(&key) {
            Some(id) => *id,
            None => {
                stats.warnings.push(format!(
                    "VBS {}@{}: échantillon introuvable",
                    vbs.code_site, vbs.depth_m
                ));
                continue;
            }
        };
        
        match insert_vbs(&mut tx, vbs, echantillon_id).await {
            Ok(_) => stats.vbs_created += 1,
            Err(e) => {
                stats.errors.push(format!(
                    "VBS {}@{}: {}",
                    vbs.code_site, vbs.depth_m, e
                ));
            }
        }
    }
    
    // 5. Insérer essais Proctor
    for proctor in &data.proctor {
        let key = (proctor.code_site.clone(), format!("{}", proctor.depth_m));
        let echantillon_id = match echantillon_ids.get(&key) {
            Some(id) => *id,
            None => {
                stats.warnings.push(format!(
                    "Proctor {}@{}: échantillon introuvable",
                    proctor.code_site, proctor.depth_m
                ));
                continue;
            }
        };
        
        match insert_proctor(&mut tx, proctor, echantillon_id).await {
            Ok(_) => stats.proctor_created += 1,
            Err(e) => {
                stats.errors.push(format!(
                    "Proctor {}@{}: {}",
                    proctor.code_site, proctor.depth_m, e
                ));
            }
        }
    }
    
    // 6. Transformer granulo "large" → "long" et insérer
    let mut all_granulo_points = data.granulo_points.clone();
    
    if let Some(ref tamisage) = data.granulo_tamisage_large {
        all_granulo_points.extend(transform_large_to_long(tamisage));
    }
    
    if let Some(ref sedimento) = data.granulo_sedimento_large {
        all_granulo_points.extend(transform_large_to_long(sedimento));
    }
    
    for point in &all_granulo_points {
        let key = (point.code_site.clone(), format!("{}", point.depth_m));
        let echantillon_id = match echantillon_ids.get(&key) {
            Some(id) => *id,
            None => {
                // Silencieux pour les points granulo (trop de warnings sinon)
                continue;
            }
        };
        
        match insert_granulo_point(&mut tx, point, echantillon_id).await {
            Ok(_) => stats.granulo_points_created += 1,
            Err(e) => {
                stats.errors.push(format!(
                    "Granulo {}@{}@{}: {}",
                    point.code_site, point.depth_m, point.sieve_mm, e
                ));
            }
        }
    }
    
    // 7. Commit transaction
    tx.commit().await?;
    
    // 8. Trigger refresh de la matview
    sqlx::query("INSERT INTO refresh_queue (object, reason) VALUES ($1, $2)")
        .bind("mailles_geotechnique_stats")
        .bind("geotechnical_import")
        .execute(pool)
        .await?;
    
    Ok(stats)
}

// ============================================================================
// Fonctions d'insertion individuelles
// ============================================================================

async fn upsert_sondage(
    tx: &mut Transaction<'_, Postgres>,
    sondage: &SondageRow,
    geoloc_mode: &str,
) -> Result<(Uuid, bool)> {
    // Vérifier si le sondage existe déjà
    let existing: Option<(Uuid,)> = sqlx::query_as(
        "SELECT id FROM sondages WHERE code = $1 AND deleted_at IS NULL LIMIT 1"
    )
    .bind(&sondage.code_site)
    .fetch_optional(&mut **tx)
    .await?;
    
    if let Some((id,)) = existing {
        // Mettre à jour
        sqlx::query(
            r#"
            UPDATE sondages 
            SET 
                source = COALESCE($2, source),
                updated_at = now()
            WHERE id = $1
            "#
        )
        .bind(id)
        .bind(&sondage.source)
        .execute(&mut **tx)
        .await?;
        
        return Ok((id, false));
    }
    
    // Créer nouveau sondage
    let id = Uuid::new_v4();
    
    // Construire géométrie selon mode
    let geom_expr = if let (Some(lon), Some(lat)) = (sondage.lon, sondage.lat) {
        format!("ST_Transform(ST_SetSRID(ST_MakePoint({}, {}), 4326), 25231)", lon, lat)
    } else {
        "NULL".to_string()
    };
    
    let date_parsed = sondage.date.as_ref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    
    let query = format!(
        r#"
        INSERT INTO sondages (
            id, code, geom, date_sondage, source,
            location_mode, is_geocoded,
            created_at, updated_at
        )
        VALUES (
            $1, $2, {}, $3, $4,
            $5, $6,
            now(), now()
        )
        "#,
        geom_expr
    );
    
    sqlx::query(&query)
        .bind(id)
        .bind(&sondage.code_site)
        .bind(date_parsed)
        .bind(&sondage.source)
        .bind(geoloc_mode)
        .bind(sondage.lon.is_some() && sondage.lat.is_some())
        .execute(&mut **tx)
        .await?;
    
    Ok((id, true))
}

async fn insert_echantillon(
    tx: &mut Transaction<'_, Postgres>,
    echantillon: &EchantillonRow,
    sondage_id: Uuid,
) -> Result<Uuid> {
    let id = Uuid::new_v4();
    
    let date_parsed = echantillon.date.as_ref()
        .and_then(|d| NaiveDate::parse_from_str(d, "%Y-%m-%d").ok());
    
    sqlx::query(
        r#"
        INSERT INTO echantillons (
            id, sondage_id, depth_m,
            date, laboratory, norm,
            rho_s_gcm3, water_content_w, is_index, eg,
            created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, now())
        ON CONFLICT (sondage_id, depth_m, date) DO UPDATE
        SET
            laboratory = EXCLUDED.laboratory,
            norm = EXCLUDED.norm,
            rho_s_gcm3 = EXCLUDED.rho_s_gcm3,
            water_content_w = EXCLUDED.water_content_w,
            is_index = EXCLUDED.is_index,
            eg = EXCLUDED.eg,
            updated_at = now()
        RETURNING id
        "#
    )
    .bind(id)
    .bind(sondage_id)
    .bind(echantillon.depth_m)
    .bind(date_parsed)
    .bind(&echantillon.laboratory)
    .bind(&echantillon.norm)
    .bind(echantillon.rho_s_gcm3)
    .bind(echantillon.water_content_w)
    .bind(echantillon.is_index)
    .bind(echantillon.eg)
    .fetch_one(&mut **tx)
    .await
    .map(|row| {
        use sqlx::Row;
        row.get(0)
    })
    .context("Échec insertion échantillon")
}

async fn insert_atterberg(
    tx: &mut Transaction<'_, Postgres>,
    atterberg: &AtterbergRow,
    echantillon_id: Uuid,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO essais_atterberg (echantillon_id, wl, wp, created_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (echantillon_id) DO UPDATE
        SET wl = EXCLUDED.wl, wp = EXCLUDED.wp
        "#
    )
    .bind(echantillon_id)
    .bind(atterberg.wl)
    .bind(atterberg.wp)
    .execute(&mut **tx)
    .await?;
    
    Ok(())
}

async fn insert_vbs(
    tx: &mut Transaction<'_, Postgres>,
    vbs: &VbsRow,
    echantillon_id: Uuid,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO essais_vbs (echantillon_id, vbs, commentaire, created_at)
        VALUES ($1, $2, $3, now())
        ON CONFLICT (echantillon_id) DO UPDATE
        SET vbs = EXCLUDED.vbs, commentaire = EXCLUDED.commentaire
        "#
    )
    .bind(echantillon_id)
    .bind(vbs.vbs)
    .bind(&vbs.commentaire)
    .execute(&mut **tx)
    .await?;
    
    Ok(())
}

async fn insert_proctor(
    tx: &mut Transaction<'_, Postgres>,
    proctor: &ProctorRow,
    echantillon_id: Uuid,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO essais_proctor (
            echantillon_id, proctor_type, gamma_d_max, w_opt, created_at
        )
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (echantillon_id, proctor_type) DO UPDATE
        SET gamma_d_max = EXCLUDED.gamma_d_max, w_opt = EXCLUDED.w_opt
        "#
    )
    .bind(echantillon_id)
    .bind(&proctor.proctor_type)
    .bind(proctor.gamma_d_max)
    .bind(proctor.w_opt)
    .execute(&mut **tx)
    .await?;
    
    Ok(())
}

async fn insert_granulo_point(
    tx: &mut Transaction<'_, Postgres>,
    point: &GranuloPointRow,
    echantillon_id: Uuid,
) -> Result<()> {
    sqlx::query(
        r#"
        INSERT INTO granulo_points (
            echantillon_id, method, sieve_mm, passing_pct, created_at
        )
        VALUES ($1, $2, $3, $4, now())
        ON CONFLICT (echantillon_id, method, sieve_mm) DO UPDATE
        SET passing_pct = EXCLUDED.passing_pct
        "#
    )
    .bind(echantillon_id)
    .bind(&point.method)
    .bind(point.sieve_mm)
    .bind(point.passing_pct)
    .execute(&mut **tx)
    .await?;
    
    Ok(())
}
