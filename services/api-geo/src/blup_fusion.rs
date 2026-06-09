/// BLUP Bayesian fusion engine — KED ⊕ RK → fusion (L2b)
///
/// Implémente la fusion inverse-de-variance (Hengl et al. 2007) :
///   w_KED = 1/σ²_KED  ;  w_RK = 1/σ²_RK
///   z_fusion   = (w_KED·z_KED + w_RK·z_RK) / (w_KED + w_RK)
///   σ²_fusion  = 1 / (w_KED + w_RK)          ← toujours < min des deux
///
/// Parallélisme : rayon::par_iter sur les 29 407 mailles (≈4× plus rapide
/// que la version Python single-thread sur les gros jeux de données).
///
/// Rétro-compatibilité : le script Python ked_rk_fusion.py reste fonctionnel
/// et peut appeler cet endpoint via --use-rust-api <URL>.
use axum::{
    extract::{Query, State},
    http::StatusCode,
    routing::{get, post},
    Json, Router,
};
use rayon::prelude::*;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sqlx::{PgPool, Row};
use std::{
    collections::HashMap,
    time::Instant,
};
use uuid::Uuid;

use crate::{auth::AuthUser, state::AppState};

// ── Constantes ────────────────────────────────────────────────────────────────

const FUSION_METHOD: &str = "ked_rk_fusion_bayesian";

/// Plages physiques par paramètre (DATA-02)
fn physical_clamp(param: &str) -> (f64, f64) {
    match param {
        "vbs"  => (0.0, 20.0),
        "ip"   => (0.0, 80.0),
        "wl"   => (20.0, 120.0),
        "wp"   => (10.0, 60.0),
        "eg"   => (0.0, 20.0),
        "cbr_95"   => (0.0, 300.0),
        "gamma_d"  => (12.0, 25.0),
        "w_opt"    => (5.0, 50.0),
        _ => (f64::NEG_INFINITY, f64::INFINITY),
    }
}

/// Unité par paramètre (pour le catalogue)
fn param_unit(param: &str) -> &'static str {
    match param {
        "vbs"      => "g/100g",
        "ip" | "wl" | "wp" | "eg" | "w_opt" => "%",
        "cbr_95"   => "%",
        "gamma_d"  => "kN/m³",
        _ => "",
    }
}

// ── Types HTTP ────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
pub struct FusionQuery {
    /// Paramètres à fusionner, séparés par virgule. Défaut : vbs,ip,wl,wp,eg
    pub params: Option<String>,
    /// Horizons à fusionner, séparés par virgule. Défaut : h1,h2,h3
    pub horizons: Option<String>,
    /// Si true : calcule mais n'écrit pas en base
    pub dry_run: Option<bool>,
}

#[derive(Debug, Serialize)]
pub struct FusionTaskResult {
    pub param: String,
    pub horizon: String,
    pub n_mailles: usize,
    pub n_ked_only: usize,
    pub n_rk_only: usize,
    pub n_fused: usize,
    pub ked_dominates_pct: f64,
    pub rk_dominates_pct: f64,
    pub mean_var_reduction_pct: f64,
    pub mean_var_fusion: f64,
    pub elapsed_ms: u64,
    pub dry_run: bool,
    pub skipped: bool,
    pub skip_reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct FusionResponse {
    pub ok: bool,
    pub tasks: Vec<FusionTaskResult>,
    pub total_elapsed_ms: u64,
}

// ── Mathématique de fusion ────────────────────────────────────────────────────

#[derive(Debug, Clone, Copy)]
enum Dominant {
    Ked,
    Rk,
    Equal,
    KedOnly,
    RkOnly,
}

/// Fusion BLUP inverse-de-variance — traduit exactement la fonction Python
fn bayesian_fusion(
    ked_val: Option<f64>,
    ked_var: Option<f64>,
    rk_val: Option<f64>,
    rk_var: Option<f64>,
    global_var: f64,
) -> (Option<f64>, Option<f64>, Dominant) {
    let fallback = global_var;

    match (ked_val, rk_val) {
        (None, None) => (None, None, Dominant::Equal),

        (None, Some(rv)) => {
            let s2 = rk_var
                .filter(|&v| v > 0.0)
                .unwrap_or(fallback)
                .max(1e-10);
            (Some(rv), Some(s2), Dominant::RkOnly)
        }

        (Some(kv), None) => {
            let s2 = ked_var
                .filter(|&v| v > 0.0)
                .unwrap_or(fallback)
                .max(1e-10);
            (Some(kv), Some(s2), Dominant::KedOnly)
        }

        (Some(kv), Some(rv)) => {
            let s2_ked = ked_var
                .filter(|&v| v > 0.0)
                .unwrap_or(fallback)
                .max(1e-10);
            let s2_rk = rk_var
                .filter(|&v| v > 0.0)
                .unwrap_or(fallback)
                .max(1e-10);

            let w_ked = 1.0 / s2_ked;
            let w_rk = 1.0 / s2_rk;
            let w_sum = w_ked + w_rk;

            let z = (w_ked * kv + w_rk * rv) / w_sum;
            let sigma2 = 1.0 / w_sum;

            let dominant = if w_ked > w_rk * 1.5 {
                Dominant::Ked
            } else if w_rk > w_ked * 1.5 {
                Dominant::Rk
            } else {
                Dominant::Equal
            };

            (Some(z), Some(sigma2), dominant)
        }
    }
}

// ── Chargement des prédictions depuis la DB ───────────────────────────────────

/// Charge {maille_id → (value, variance)} pour un parameter_id + méthode KED
/// Non-macro sqlx::query() pour compatibilité SQLX_OFFLINE=true (Docker).
async fn load_ked_predictions(
    pool: &PgPool,
    param_id: &str,
) -> sqlx::Result<HashMap<Uuid, (Option<f64>, Option<f64>)>> {
    let rows = sqlx::query(
        r#"
        SELECT maille_id, value, variance
        FROM atlas.ai_interpolation_values
        WHERE parameter_id = $1
          AND (
              method IN (
                  'ked_hierarchical_5levels',
                  'ked_pedological_prior',
                  'ked_pedologie_ked',
                  'ked_pedologie_eg',
                  'ked_pedologie_granulo'
              )
              OR method LIKE 'ked%'
          )
          AND NOT COALESCE(is_superseded, false)
        ORDER BY
            CASE method
                WHEN 'ked_hierarchical_5levels' THEN 1
                WHEN 'ked_pedological_prior'    THEN 2
                ELSE 9
            END,
            created_at DESC
        "#,
    )
    .bind(param_id)
    .fetch_all(pool)
    .await?;

    let mut map: HashMap<Uuid, (Option<f64>, Option<f64>)> = HashMap::with_capacity(rows.len());
    for r in rows {
        let maille_id: Uuid = r.try_get("maille_id")?;
        let value: Option<f64> = r.try_get("value").ok().flatten();
        let variance: Option<f64> = r.try_get("variance").ok().flatten();
        map.entry(maille_id).or_insert((value, variance));
    }
    Ok(map)
}

/// Charge {maille_id → (value, variance)} pour un parameter_id + méthode RK
/// Non-macro sqlx::query() pour compatibilité SQLX_OFFLINE=true (Docker).
async fn load_rk_predictions(
    pool: &PgPool,
    param_id: &str,
) -> sqlx::Result<HashMap<Uuid, (Option<f64>, Option<f64>)>> {
    let rows = sqlx::query(
        r#"
        SELECT maille_id, value, variance
        FROM atlas.ai_interpolation_values
        WHERE parameter_id = $1
          AND method = 'regression_kriging_scorpan'
          AND NOT COALESCE(is_superseded, false)
        "#,
    )
    .bind(param_id)
    .fetch_all(pool)
    .await?;

    let mut map = HashMap::with_capacity(rows.len());
    for r in rows {
        let maille_id: Uuid = r.try_get("maille_id")?;
        let value: Option<f64> = r.try_get("value").ok().flatten();
        let variance: Option<f64> = r.try_get("variance").ok().flatten();
        map.insert(maille_id, (value, variance));
    }
    Ok(map)
}

// ── Calcul de fusion pour un couple (param, horizon) ─────────────────────────

struct FusionComputed {
    /// (maille_id, z_fused, sigma2_fused)
    rows: Vec<(Uuid, f64, Option<f64>)>,
    metrics: FusionMetrics,
}

#[derive(Default)]
struct FusionMetrics {
    n_total: usize,
    n_ked_only: usize,
    n_rk_only: usize,
    n_fused: usize,
    n_ked_dom: usize,
    n_rk_dom: usize,
    n_equal: usize,
    fus_vars: Vec<f64>,
    mean_var_ked: f64,
    mean_var_rk: f64,
}

fn compute_fusion(
    ked_map: &HashMap<Uuid, (Option<f64>, Option<f64>)>,
    rk_map: &HashMap<Uuid, (Option<f64>, Option<f64>)>,
    param: &str,
) -> FusionComputed {
    // Variance globale (comme Python : nanmean de toutes les variances)
    let all_vars: Vec<f64> = ked_map
        .values()
        .chain(rk_map.values())
        .filter_map(|(_, var)| *var)
        .filter(|v| v.is_finite())
        .collect();

    let global_var = if all_vars.is_empty() {
        1.0
    } else {
        all_vars.iter().sum::<f64>() / all_vars.len() as f64
    };

    let mean_var_ked = {
        let v: Vec<f64> = ked_map.values().filter_map(|(_, var)| *var).collect();
        if v.is_empty() { 0.0 } else { v.iter().sum::<f64>() / v.len() as f64 }
    };
    let mean_var_rk = {
        let v: Vec<f64> = rk_map.values().filter_map(|(_, var)| *var).collect();
        if v.is_empty() { 0.0 } else { v.iter().sum::<f64>() / v.len() as f64 }
    };

    let (clamp_min, clamp_max) = physical_clamp(param);

    // Union des maille_ids
    let all_ids: Vec<Uuid> = {
        let mut ids: Vec<Uuid> = ked_map.keys().chain(rk_map.keys()).copied().collect();
        ids.sort_unstable();
        ids.dedup();
        ids
    };

    // Fusion parallèle avec rayon
    let partial_results: Vec<(Uuid, f64, Option<f64>, Dominant)> = all_ids
        .par_iter()
        .filter_map(|mid| {
            let (kv, kvar) = ked_map.get(mid).copied().unwrap_or((None, None));
            let (rv, rvar) = rk_map.get(mid).copied().unwrap_or((None, None));

            let (z_opt, sigma2, dominant) = bayesian_fusion(kv, kvar, rv, rvar, global_var);
            let z = z_opt?;

            // Clamp physique (DATA-02)
            let z = if z.is_finite() {
                z.clamp(clamp_min, clamp_max)
            } else {
                return None;
            };

            Some((*mid, z, sigma2, dominant))
        })
        .collect();

    // Agrégation des métriques (séquentiel — trivial)
    let mut metrics = FusionMetrics {
        mean_var_ked,
        mean_var_rk,
        ..Default::default()
    };
    let mut rows = Vec::with_capacity(partial_results.len());
    let mut fus_vars: Vec<f64> = Vec::with_capacity(partial_results.len());

    for (mid, z, sigma2, dominant) in partial_results {
        metrics.n_total += 1;
        match dominant {
            Dominant::KedOnly => metrics.n_ked_only += 1,
            Dominant::RkOnly => metrics.n_rk_only += 1,
            Dominant::Ked => { metrics.n_fused += 1; metrics.n_ked_dom += 1; }
            Dominant::Rk => { metrics.n_fused += 1; metrics.n_rk_dom += 1; }
            Dominant::Equal => { metrics.n_fused += 1; metrics.n_equal += 1; }
        }
        if let Some(s2) = sigma2 {
            fus_vars.push(s2);
        }
        rows.push((mid, z, sigma2));
    }
    metrics.fus_vars = fus_vars;

    FusionComputed { rows, metrics }
}

fn make_task_result(
    param: &str,
    horizon: &str,
    computed: &FusionComputed,
    elapsed_ms: u64,
    dry_run: bool,
) -> FusionTaskResult {
    let m = &computed.metrics;
    let n = m.n_total.max(1);

    let mean_fus = if m.fus_vars.is_empty() {
        0.0
    } else {
        m.fus_vars.iter().sum::<f64>() / m.fus_vars.len() as f64
    };

    let best_mean = m.mean_var_ked.min(m.mean_var_rk);
    let mean_var_reduction_pct = if best_mean > 1e-8 {
        ((1.0 - mean_fus / best_mean) * 100.0 * 10.0).round() / 10.0
    } else {
        0.0
    };

    FusionTaskResult {
        param: param.to_string(),
        horizon: horizon.to_string(),
        n_mailles: m.n_total,
        n_ked_only: m.n_ked_only,
        n_rk_only: m.n_rk_only,
        n_fused: m.n_fused,
        ked_dominates_pct: (100.0 * m.n_ked_dom as f64 / n as f64 * 10.0).round() / 10.0,
        rk_dominates_pct: (100.0 * m.n_rk_dom as f64 / n as f64 * 10.0).round() / 10.0,
        mean_var_reduction_pct,
        mean_var_fusion: (mean_fus * 10000.0).round() / 10000.0,
        elapsed_ms,
        dry_run,
        skipped: false,
        skip_reason: None,
    }
}

// ── Écriture en base ──────────────────────────────────────────────────────────

/// Marque les anciennes valeurs fusion comme superseded (BM-SYNC-05)
async fn supersede_old_fusion(
    pool: &PgPool,
    fusion_param_id: &str,
) -> sqlx::Result<u64> {
    let result = sqlx::query(
        r#"
        UPDATE atlas.ai_interpolation_values
        SET is_superseded = true
        WHERE parameter_id = $1
          AND method = $2
          AND NOT COALESCE(is_superseded, false)
        "#,
    )
    .bind(fusion_param_id)
    .bind(FUSION_METHOD)
    .execute(pool)
    .await?;
    Ok(result.rows_affected())
}

/// Assure que le paramètre fusion est dans le catalogue (GEN-01)
async fn upsert_catalog_entry(
    pool: &PgPool,
    fusion_param_id: &str,
    param: &str,
) -> sqlx::Result<()> {
    let unit = param_unit(param);
    let (pmin, pmax) = {
        let (a, b) = physical_clamp(param);
        (
            if a.is_finite() { Some(a) } else { None },
            if b.is_finite() { Some(b) } else { None },
        )
    };

    sqlx::query(
        r#"
        INSERT INTO atlas.ai_parameter_catalog
          (parameter_id, category, source, unit, interpolation_enabled,
           prediction_enabled, is_active, updated_at, depth_stratified, is_derived,
           physical_min, physical_max)
        VALUES ($1, 'geotech', 'interpolation', $2, false, true, true, now(), true, true, $3, $4)
        ON CONFLICT (parameter_id) DO NOTHING
        "#,
    )
    .bind(fusion_param_id)
    .bind(unit)
    .bind(pmin)
    .bind(pmax)
    .execute(pool)
    .await?;
    Ok(())
}

/// Insère un enregistrement de run dans ai_interpolation_runs
async fn insert_run(
    pool: &PgPool,
    run_id: Uuid,
    fusion_param_id: &str,
    param: &str,
    horizon: &str,
    metrics: &FusionTaskResult,
) -> sqlx::Result<()> {
    let metrics_json = json!({
        "horizon_label": horizon,
        "param_kind": param,
        "engine": "rust_blup_fusion",
        "n_mailles": metrics.n_mailles,
        "ked_dominates_pct": metrics.ked_dominates_pct,
        "rk_dominates_pct": metrics.rk_dominates_pct,
        "mean_var_reduction_pct": metrics.mean_var_reduction_pct,
        "mean_var_fusion": metrics.mean_var_fusion,
        "elapsed_ms": metrics.elapsed_ms,
    });

    sqlx::query(
        r#"
        INSERT INTO atlas.ai_interpolation_runs
          (id, run_type, parameter_id, method, model_version, status, metrics,
           started_at, finished_at, zone_id, kriging_domain_id)
        VALUES ($1, 'fusion', $2, $3, 'v2-rust', 'finished', $4::jsonb, now(), now(), NULL, NULL)
        "#,
    )
    .bind(run_id)
    .bind(fusion_param_id)
    .bind(FUSION_METHOD)
    .bind(metrics_json)
    .execute(pool)
    .await?;
    Ok(())
}

/// Insère les valeurs de fusion via UNNEST (plus robuste que push_values pour les grands volumes)
async fn insert_fusion_values(
    pool: &PgPool,
    rows: &[(Uuid, f64, Option<f64>)],
    fusion_param_id: &str,
    run_id: Uuid,
) -> sqlx::Result<usize> {
    if rows.is_empty() {
        return Ok(0);
    }

    // Décomposition en colonnes parallèles pour UNNEST
    let ids: Vec<Uuid>         = rows.iter().map(|_| Uuid::new_v4()).collect();
    let maille_ids: Vec<Uuid>  = rows.iter().map(|(m, _, _)| *m).collect();
    let values: Vec<f64>       = rows.iter().map(|(_, z, _)| *z).collect();
    let variances: Vec<Option<f64>> = rows.iter().map(|(_, _, v)| *v).collect();

    // Un seul INSERT avec UNNEST — évite les limites de paramètres et le push_values
    let result = sqlx::query(
        r#"
        INSERT INTO atlas.ai_interpolation_values
          (id, maille_id, parameter_id, value, variance, method, run_id, created_at)
        SELECT
          unnest($1::uuid[]),
          unnest($2::uuid[]),
          $3::text,
          unnest($4::float8[]),
          unnest($5::float8[]),
          $6::text,
          $7::uuid,
          now()
        "#,
    )
    .bind(&ids)
    .bind(&maille_ids)
    .bind(fusion_param_id)
    .bind(&values)
    .bind(&variances)
    .bind(FUSION_METHOD)
    .bind(run_id)
    .execute(pool)
    .await?;

    Ok(result.rows_affected() as usize)
}

// ── Orchestration ─────────────────────────────────────────────────────────────

async fn run_one_param_horizon(
    pool: &PgPool,
    param: &str,
    horizon: &str,
    dry_run: bool,
) -> Result<FusionTaskResult, String> {
    let ked_param_id = format!("{}_ked_{}", param, horizon);
    let rk_param_id = format!("{}_rk_{}", param, horizon);
    let fusion_param_id = format!("{}_fusion_{}", param, horizon);

    let t0 = Instant::now();

    let ked_map = load_ked_predictions(pool, &ked_param_id)
        .await
        .map_err(|e| format!("DB KED {ked_param_id}: {e}"))?;

    if ked_map.is_empty() {
        return Ok(FusionTaskResult {
            param: param.to_string(),
            horizon: horizon.to_string(),
            n_mailles: 0,
            n_ked_only: 0,
            n_rk_only: 0,
            n_fused: 0,
            ked_dominates_pct: 0.0,
            rk_dominates_pct: 0.0,
            mean_var_reduction_pct: 0.0,
            mean_var_fusion: 0.0,
            elapsed_ms: t0.elapsed().as_millis() as u64,
            dry_run,
            skipped: true,
            skip_reason: Some(format!("KED vide pour {ked_param_id}")),
        });
    }

    let rk_map = load_rk_predictions(pool, &rk_param_id)
        .await
        .map_err(|e| format!("DB RK {rk_param_id}: {e}"))?;

    if rk_map.is_empty() {
        return Ok(FusionTaskResult {
            param: param.to_string(),
            horizon: horizon.to_string(),
            n_mailles: 0,
            n_ked_only: 0,
            n_rk_only: 0,
            n_fused: 0,
            ked_dominates_pct: 0.0,
            rk_dominates_pct: 0.0,
            mean_var_reduction_pct: 0.0,
            mean_var_fusion: 0.0,
            elapsed_ms: t0.elapsed().as_millis() as u64,
            dry_run,
            skipped: true,
            skip_reason: Some(format!("RK vide pour {rk_param_id}")),
        });
    }

    // Calcul parallèle (rayon)
    let computed = tokio::task::spawn_blocking({
        let ked = ked_map;
        let rk = rk_map;
        let p = param.to_string();
        move || compute_fusion(&ked, &rk, &p)
    })
    .await
    .map_err(|e| format!("rayon panic: {e}"))?;

    let elapsed_ms = t0.elapsed().as_millis() as u64;
    let task_result = make_task_result(param, horizon, &computed, elapsed_ms, dry_run);

    if dry_run {
        return Ok(task_result);
    }

    // Écriture en base
    supersede_old_fusion(pool, &fusion_param_id)
        .await
        .map_err(|e| format!("supersede {fusion_param_id}: {e}"))?;

    upsert_catalog_entry(pool, &fusion_param_id, param)
        .await
        .map_err(|e| format!("catalog {fusion_param_id}: {e}"))?;

    let run_id = Uuid::new_v4();
    insert_run(pool, run_id, &fusion_param_id, param, horizon, &task_result)
        .await
        .map_err(|e| format!("insert_run {fusion_param_id}: {e}"))?;

    insert_fusion_values(pool, &computed.rows, &fusion_param_id, run_id)
        .await
        .map_err(|e| format!("insert_values {fusion_param_id}: {e}"))?;

    Ok(task_result)
}

// ── Handlers Axum ─────────────────────────────────────────────────────────────

/// POST /ai/fusion/run
/// Déclenche la fusion BLUP pour les paramètres et horizons demandés.
/// Requiert le rôle analyst (permission colab.missions.read).
pub async fn run_blup_fusion(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<FusionQuery>,
) -> Result<Json<FusionResponse>, (StatusCode, Json<Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée — rôle analyst requis" })),
        ));
    }

    let params: Vec<String> = q
        .params
        .as_deref()
        .unwrap_or("vbs,ip,wl,wp,eg")
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let horizons: Vec<String> = q
        .horizons
        .as_deref()
        .unwrap_or("h1,h2,h3")
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let dry_run = q.dry_run.unwrap_or(false);
    let t_total = Instant::now();
    let mut tasks: Vec<FusionTaskResult> = Vec::new();

    // Séquentiel par (param, horizon) — la parallélisation est interne (rayon)
    for param in &params {
        for horizon in &horizons {
            match run_one_param_horizon(&state.pool, param, horizon, dry_run).await {
                Ok(result) => {
                    tracing::info!(
                        param = %param,
                        horizon = %horizon,
                        n_mailles = result.n_mailles,
                        elapsed_ms = result.elapsed_ms,
                        skipped = result.skipped,
                        "blup_fusion complete"
                    );
                    tasks.push(result);
                }
                Err(e) => {
                    tracing::error!(param = %param, horizon = %horizon, error = %e, "blup_fusion error");
                    tasks.push(FusionTaskResult {
                        param: param.clone(),
                        horizon: horizon.clone(),
                        n_mailles: 0,
                        n_ked_only: 0,
                        n_rk_only: 0,
                        n_fused: 0,
                        ked_dominates_pct: 0.0,
                        rk_dominates_pct: 0.0,
                        mean_var_reduction_pct: 0.0,
                        mean_var_fusion: 0.0,
                        elapsed_ms: 0,
                        dry_run,
                        skipped: true,
                        skip_reason: Some(e),
                    });
                }
            }
        }
    }

    Ok(Json(FusionResponse {
        ok: true,
        tasks,
        total_elapsed_ms: t_total.elapsed().as_millis() as u64,
    }))
}

/// GET /ai/fusion/status?params=vbs,ip&horizons=h1,h2,h3
/// Retourne le nombre de valeurs fusion existantes sans écrire en base.
pub async fn fusion_status(
    State(state): State<AppState>,
    auth: AuthUser,
    Query(q): Query<FusionQuery>,
) -> Result<Json<Value>, (StatusCode, Json<Value>)> {
    if !auth.has_permission("colab.missions.read") {
        return Err((
            StatusCode::FORBIDDEN,
            Json(json!({ "error": "Permission refusée" })),
        ));
    }

    let params: Vec<String> = q
        .params
        .as_deref()
        .unwrap_or("vbs,ip,wl,wp,eg")
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let horizons: Vec<String> = q
        .horizons
        .as_deref()
        .unwrap_or("h1,h2,h3")
        .split(',')
        .map(|s| s.trim().to_lowercase())
        .filter(|s| !s.is_empty())
        .collect();

    let mut status_list: Vec<Value> = Vec::new();

    for param in &params {
        for horizon in &horizons {
            let fusion_param_id = format!("{}_fusion_{}", param, horizon);
            let ked_param_id = format!("{}_ked_{}", param, horizon);
            let rk_param_id = format!("{}_rk_{}", param, horizon);

            let fusion_count: i64 = sqlx::query(
                "SELECT COUNT(*)::bigint AS c FROM atlas.ai_interpolation_values \
                 WHERE parameter_id = $1 AND method = $2 \
                 AND NOT COALESCE(is_superseded, false)"
            )
            .bind(&fusion_param_id)
            .bind(FUSION_METHOD)
            .fetch_one(&state.pool)
            .await
            .ok()
            .and_then(|r| r.try_get::<i64, _>("c").ok())
            .unwrap_or(0);

            let ked_count: i64 = sqlx::query(
                "SELECT COUNT(*)::bigint AS c FROM atlas.ai_interpolation_values \
                 WHERE parameter_id = $1 AND method LIKE 'ked%' \
                 AND NOT COALESCE(is_superseded, false)"
            )
            .bind(&ked_param_id)
            .fetch_one(&state.pool)
            .await
            .ok()
            .and_then(|r| r.try_get::<i64, _>("c").ok())
            .unwrap_or(0);

            let rk_count: i64 = sqlx::query(
                "SELECT COUNT(*)::bigint AS c FROM atlas.ai_interpolation_values \
                 WHERE parameter_id = $1 AND method = 'regression_kriging_scorpan' \
                 AND NOT COALESCE(is_superseded, false)"
            )
            .bind(&rk_param_id)
            .fetch_one(&state.pool)
            .await
            .ok()
            .and_then(|r| r.try_get::<i64, _>("c").ok())
            .unwrap_or(0);

            status_list.push(json!({
                "param": param,
                "horizon": horizon,
                "fusion_param_id": fusion_param_id,
                "n_fusion": fusion_count,
                "n_ked": ked_count,
                "n_rk": rk_count,
                "ready": ked_count > 0 && rk_count > 0,
            }));
        }
    }

    Ok(Json(json!({
        "ok": true,
        "params_horizons": status_list,
    })))
}

// ── Router ────────────────────────────────────────────────────────────────────

pub fn blup_fusion_routes() -> Router<AppState> {
    Router::new()
        .route("/ai/fusion/run", post(run_blup_fusion))
        .route("/ai/fusion/status", get(fusion_status))
}
