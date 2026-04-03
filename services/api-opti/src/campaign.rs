//! Optimisation de campagne de reconnaissance : scores SQL + classement heuristique + AG (bitmask).
//! Score officiel : `atlas.v_campaign_priority_score.priority_score_v1` (audit SQL).
//! Fitness AG (Rust, rapide) : somme des priorités + terme proxy « variance_reduction » + métriques trajet post hoc.

use crate::AppState;
use axum::extract::State;
use axum::{http::StatusCode, Json};
use rand::seq::SliceRandom;
use rand::Rng;
use serde::{Deserialize, Serialize};
use sqlx::PgPool;
use std::collections::HashSet;
use uuid::Uuid;

/// Doit rester aligné sur `db/migrations/161_campaign_priority_score_v1.sql`.
pub const PRIORITY_FORMULA_VERSION: &str = "campaign_priority_v1";

/// Pondération du terme Σ sqrt(norm_var) dans la fitness (réduction d’incertitude proxy).
const FITNESS_VAR_REDUCTION_WEIGHT: f64 = 0.18;
const EARTH_RADIUS_KM: f64 = 6371.0088;

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct CampaignWeights {
    #[serde(default = "w1")]
    pub w_risque: f64,
    #[serde(default = "w1")]
    pub w_variance: f64,
    #[serde(default = "w1")]
    pub w_distance_sondage: f64,
    #[serde(default = "w1")]
    pub w_transition_geol: f64,
    #[serde(default = "w1")]
    pub w_infrastructure: f64,
    #[serde(default = "w05")]
    pub w_zone_coverage: f64,
}

fn w1() -> f64 {
    1.0
}
fn w05() -> f64 {
    0.5
}

impl Default for CampaignWeights {
    fn default() -> Self {
        Self {
            w_risque: 1.0,
            w_variance: 1.0,
            w_distance_sondage: 1.0,
            w_transition_geol: 1.0,
            w_infrastructure: 1.0,
            w_zone_coverage: 0.5,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct CampaignRequest {
    pub zone: String,
    pub budget: usize,
    /// Ex. "gonflement" | "exploration" (informatif + défauts)
    #[serde(default)]
    pub objectif: String,
    #[serde(default)]
    pub mode: String,
    /// Par défaut **true** : pool = mailles en dépression géologique uniquement (recommandé terrain).
    #[serde(default = "default_depression_hard")]
    pub depression_hard_constraint: bool,
    /// Si true : élargit le pool à **toute** la zone (désactive le filtre dépression). Rare ; audit explicite.
    #[serde(default)]
    pub relax_depression_pool: bool,
    #[serde(default)]
    pub generations: Option<usize>,
    #[serde(default)]
    pub population_size: Option<usize>,
    #[serde(default)]
    pub weights: Option<CampaignWeights>,
}

fn default_depression_hard() -> bool {
    true
}

#[derive(Debug, Clone, sqlx::FromRow)]
struct CampaignRow {
    maille_id: Uuid,
    maille_code: String,
    in_depression: bool,
    #[allow(dead_code)]
    risque_gonflement: Option<String>,
    risque_gonflement_score: i32,
    distance_sondage_m: f64,
    variance_kriging: Option<f64>,
    transition_geologique: f64,
    priorite_infrastructure: f64,
    #[allow(dead_code)]
    n_sondages: i64,
    pct_in_lama: f64,
    #[allow(dead_code)]
    pct_zone: Option<f64>,
    /// Score officiel (vue `v_campaign_priority_score`).
    priority_score_v1: Option<f64>,
    norm_variance_v1: Option<f64>,
    lon: Option<f64>,
    lat: Option<f64>,
}

#[derive(Debug, Serialize, Clone)]
pub struct MaillePriorite {
    /// Ordre de passage terrain (TSP léger / plus proche voisin depuis le point le plus critique).
    pub rank: usize,
    pub maille_id: Uuid,
    pub maille_code: String,
    pub score_critique: f64,
    pub in_depression: bool,
    /// Libellés audit (FR).
    pub justification: Vec<String>,
    /// Même contenu que `justification` (compat intégrations / spec JSON « reasons »).
    pub reasons: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct CampaignMetrics {
    pub pool_size: usize,
    pub candidates_in_depression: usize,
    pub mean_risque_score: f64,
    pub budget_requested: usize,
    pub budget_returned: usize,
    pub priority_score_formula_version: String,
    /// Masse de variance normalisée captée / masse totale zone (proxy réduction incertitude).
    pub variance_reduction_ratio: f64,
    /// Part du risque « max » théorique (score 5) captée par les mailles choisies ; in [0,1].
    pub risk_capture: f64,
    /// Longueur approximative tournée NN sur la solution principale (km WGS84).
    pub approx_travel_tour_km: f64,
    /// Alias métier : même valeur que `variance_reduction_ratio` ( synthèse couverture ).
    pub coverage_gain: f64,
    /// Toujours présent dans le JSON (`null` en heuristique, nombre en AG) — compat clients legacy.
    pub best_fitness: Option<f64>,
}

#[derive(Debug, Serialize)]
pub struct CampaignResponse {
    pub ok: bool,
    pub model_version: &'static str,
    pub zone: String,
    pub budget: usize,
    pub objectif: String,
    pub mode: String,
    pub depression_hard_constraint: bool,
    pub method: String,
    pub pool_size: usize,
    pub weights: CampaignWeights,
    /// Classement détaillé (scores + justifications).
    pub mailles_prioritaires: Vec<MaillePriorite>,
    /// Alias métier (même contenu que `mailles_prioritaires`, pour intégrations / UI).
    pub recommended_cells: Vec<MaillePriorite>,
    /// Scores criticité alignés sur `recommended_cells`.
    pub score: Vec<f64>,
    /// Justifications scientifiques alignées sur `recommended_cells`.
    pub justification: Vec<Vec<String>>,
    pub metrics: CampaignMetrics,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ga_generations: Option<usize>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub ga_population: Option<usize>,
    /// Réservé extensions multi-stratégies (ex. NSGA-II) ; vide en MVP.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub alternatives: Vec<serde_json::Value>,
    /// Rétro-compat (même valeur que `metrics.best_fitness` pour l’AG) ; toujours sérialisé (`null` si heuristique).
    pub best_fitness: Option<f64>,
}

fn norm_variance(v: Option<f64>) -> f64 {
    let x = v.unwrap_or(0.0).max(0.0);
    (x / (x + 15.0)).min(1.0)
}

fn norm_distance_sondage(d: f64) -> f64 {
    let denom = 15.0_f64.ln();
    if denom <= 0.0 {
        return 0.0;
    }
    (d / 1000.0 + 1.0).ln() / denom
}

/// Pondération locale (API) autour du score SQL — conserve les écarts « objectif gonflement » sans casser la piste audit.
fn weighted_priority(row: &CampaignRow, w: &CampaignWeights) -> f64 {
    let base = row
        .priority_score_v1
        .unwrap_or_else(|| priority_score_v1_rust(row));
    let r_boost = (row.risque_gonflement_score as f64) / 5.0;
    let vz = norm_variance(row.variance_kriging);
    base + (w.w_risque - 1.0).max(0.0) * 0.08 * r_boost + (w.w_variance - 1.0).max(0.0) * 0.05 * vz
}

/// Rétro-calcul si colonne SQL absente (doit matcher `priority_score_v1` dans 161).
fn priority_score_v1_rust(row: &CampaignRow) -> f64 {
    let r = (row.risque_gonflement_score as f64) / 5.0;
    let vz = norm_variance(row.variance_kriging);
    let ds = norm_distance_sondage(row.distance_sondage_m).min(1.0);
    let tg = row.transition_geologique.clamp(0.0, 1.0);
    let inf = row.priorite_infrastructure.clamp(0.0, 1.0);
    0.35 * vz + 0.25 * r + 0.15 * ds + 0.15 * tg + 0.10 * inf
}

fn justify(row: &CampaignRow) -> Vec<String> {
    let mut j = Vec::new();
    if row.in_depression {
        j.push(
            "[DEPRESSION] Maille en dépression géologique — priorité réglementaire / hydrogéologie."
                .to_string(),
        );
    }
    match row.risque_gonflement_score {
        5 => j.push("[RISQUE_ELEVE] Risque de gonflement fort à très fort (score 5)".to_string()),
        3 => j.push("[RISQUE_MODERE] Risque de gonflement moyen (score 3)".to_string()),
        _ => j.push("[RISQUE_FAIBLE] Risque de gonflement faible ou non renseigné (score 1)".to_string()),
    }
    if let Some(v) = row.variance_kriging {
        if v > 5.0 {
            j.push(format!(
                "[VAR_KRIG_ELEVEE] Variance krigeage VBS élevée ({v:.2}) — gain d'information géostatistique attendu"
            ));
        } else if v > 1.0 {
            j.push(format!(
                "[VAR_KRIG_MODEREE] Variance krigeage VBS modérée ({v:.2})"
            ));
        } else {
            j.push(format!("[VAR_KRIG_FAIBLE] Variance krigeage VBS faible ({v:.2})"));
        }
    } else {
        j.push("[VAR_KRIG_ABSENTE] Pas de variance krigeage (exécuter le pipeline interpolation)".to_string());
    }
    if row.distance_sondage_m > 4000.0 {
        j.push(format!(
            "[DIST_FORAGE] Éloignement forage existant ~{:.0} m — sous-échantillonnage local",
            row.distance_sondage_m
        ));
    } else if row.distance_sondage_m > 1500.0 {
        j.push(format!(
            "[DIST_FORAGE_MODERE] Distance forage existant ~{:.0} m",
            row.distance_sondage_m
        ));
    }
    if row.transition_geologique > 0.35 {
        j.push("[FRONT_GEO] Proximité frontière géologique — contexte transitionnel.".to_string());
    }
    if row.priorite_infrastructure > 0.45 {
        j.push("[ENJEU_INFRA] Fort enjeu socio-économique (proximité axes / eau)".to_string());
    }
    if row.pct_in_lama >= 25.0 {
        j.push("[LAMA] Forte intersection contexte Lama / corridor argileux".to_string());
    }
    j
}

fn haversine_km(lon1: f64, lat1: f64, lon2: f64, lat2: f64) -> f64 {
    let (phi1, phi2, dphi, dlambda) = (
        lat1.to_radians(),
        lat2.to_radians(),
        (lat2 - lat1).to_radians(),
        (lon2 - lon1).to_radians(),
    );
    let a = (dphi / 2.0).sin().powi(2) + phi1.cos() * phi2.cos() * (dlambda / 2.0).sin().powi(2);
    (a.sqrt().min(1.0).asin() * 2.0) * EARTH_RADIUS_KM
}

struct GaScratch {
    priority: Vec<f64>,
    norm_var: Vec<f64>,
}

fn build_scratch(rows: &[CampaignRow], w: &CampaignWeights) -> GaScratch {
    GaScratch {
        priority: rows.iter().map(|r| weighted_priority(r, w)).collect(),
        norm_var: rows
            .iter()
            .map(|r| {
                r.norm_variance_v1
                    .unwrap_or_else(|| norm_variance(r.variance_kriging))
            })
            .collect(),
    }
}

fn fitness_var_reduction(bits: &[bool], s: &GaScratch) -> f64 {
    let mut sum_p = 0.0;
    let mut sum_vr = 0.0;
    for i in 0..bits.len() {
        if bits[i] {
            sum_p += s.priority[i];
            sum_vr += s.norm_var[i].sqrt().min(1.0);
        }
    }
    sum_p + FITNESS_VAR_REDUCTION_WEIGHT * sum_vr
}

/// Tournée gloutonne (NN) depuis la maille de plus forte `priority_score_v1`.
fn nearest_neighbor_tour(selected_idx: &[usize], rows: &[CampaignRow]) -> (f64, Vec<usize>) {
    if selected_idx.is_empty() {
        return (0.0, vec![]);
    }
    if selected_idx.len() == 1 {
        return (0.0, vec![selected_idx[0]]);
    }
    let mut remaining: Vec<usize> = selected_idx.to_vec();
    let start_pos = *remaining
        .iter()
        .max_by(|a, b| {
            let pa = rows[**a]
                .priority_score_v1
                .unwrap_or_else(|| priority_score_v1_rust(&rows[**a]));
            let pb = rows[**b]
                .priority_score_v1
                .unwrap_or_else(|| priority_score_v1_rust(&rows[**b]));
            pa.partial_cmp(&pb).unwrap_or(std::cmp::Ordering::Equal)
        })
        .unwrap();
    let mut route: Vec<usize> = vec![start_pos];
    remaining.retain(|&x| x != start_pos);
    let mut cur = start_pos;
    while !remaining.is_empty() {
        let mut best_j = remaining[0];
        let mut best_d = f64::INFINITY;
        for &j in &remaining {
            let d = match (
                rows[cur].lon,
                rows[cur].lat,
                rows[j].lon,
                rows[j].lat,
            ) {
                (Some(a), Some(b), Some(c), Some(d))
                    if a.is_finite() && b.is_finite() && c.is_finite() && d.is_finite() =>
                {
                    haversine_km(a, b, c, d)
                }
                _ => 0.0,
            };
            if d < best_d {
                best_d = d;
                best_j = j;
            }
        }
        route.push(best_j);
        remaining.retain(|&x| x != best_j);
        cur = best_j;
    }
    let mut dist_km = 0.0;
    for w in route.windows(2) {
        if let (Some(a), Some(b), Some(c), Some(d)) = (
            rows[w[0]].lon,
            rows[w[0]].lat,
            rows[w[1]].lon,
            rows[w[1]].lat,
        ) {
            if a.is_finite() && b.is_finite() && c.is_finite() && d.is_finite() {
                dist_km += haversine_km(a, b, c, d);
            }
        }
    }
    (dist_km, route)
}

fn variance_risk_metrics(bits: &[bool], rows: &[CampaignRow], s: &GaScratch) -> (f64, f64) {
    let sum_pool: f64 = s.norm_var.iter().sum::<f64>().max(1e-9);
    let sel_var: f64 = bits
        .iter()
        .enumerate()
        .filter_map(|(i, b)| if *b { Some(s.norm_var[i]) } else { None })
        .sum();
    let var_ratio = (sel_var / sum_pool).min(1.0);
    let k = bits.iter().filter(|b| **b).count().max(1);
    let cap: f64 = bits
        .iter()
        .enumerate()
        .filter_map(|(i, b)| {
            if *b {
                Some(rows[i].risque_gonflement_score as f64)
            } else {
                None
            }
        })
        .sum();
    let risk_cap = cap / (5.0 * k as f64);
    (var_ratio, risk_cap.min(1.0))
}

async fn load_pool(
    pool: &PgPool,
    zone_code: &str,
    depression_only: bool,
) -> Result<Vec<CampaignRow>, sqlx::Error> {
    let sql = r#"
    SELECT DISTINCT ON (v.maille_id)
      v.maille_id,
      v.maille_code,
      v.in_depression,
      v.risque_gonflement,
      v.risque_gonflement_score,
      v.distance_sondage_m,
      v.variance_kriging,
      v.transition_geologique,
      v.priorite_infrastructure,
      v.n_sondages,
      v.pct_in_lama,
      mze.pct_intersection::float8 AS pct_zone,
      v.priority_score_v1,
      v.norm_variance_v1,
      ST_X(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lon,
      ST_Y(ST_Transform(ST_PointOnSurface(m.geom), 4326))::float8 AS lat
    FROM atlas.v_campaign_priority_score v
    INNER JOIN atlas.mailles m ON m.id = v.maille_id
    INNER JOIN atlas.mailles_zones_etude mze ON mze.maille_id = v.maille_id
    INNER JOIN atlas.zones_etude z ON z.id = mze.zone_id
    WHERE z.code = $1
      AND z.is_published = TRUE
      AND ($2::bool IS NOT TRUE OR v.in_depression = TRUE)
    ORDER BY v.maille_id, mze.pct_intersection DESC NULLS LAST
    "#;
    sqlx::query_as::<_, CampaignRow>(sql)
        .bind(zone_code)
        .bind(depression_only)
        .fetch_all(pool)
        .await
}

fn sorted_by_priority(rows: &[CampaignRow], weights: &CampaignWeights) -> Vec<(usize, f64)> {
    let mut scored: Vec<(usize, f64)> = rows
        .iter()
        .enumerate()
        .map(|(i, r)| (i, weighted_priority(r, weights)))
        .collect();
    scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    scored
}

fn mailles_mission_ordered(rows: &[CampaignRow], top: &[(usize, f64)], weights: &CampaignWeights) -> Vec<MaillePriorite> {
    let idxs: Vec<usize> = top.iter().map(|(i, _)| *i).collect();
    let (_km, tour) = nearest_neighbor_tour(&idxs, rows);
    tour.into_iter()
        .enumerate()
        .map(|(mr, idx)| {
            let r = &rows[idx];
            let sc = top
                .iter()
                .find(|(i, _)| *i == idx)
                .map(|(_, s)| *s)
                .unwrap_or_else(|| weighted_priority(r, weights));
            let j = justify(r);
            MaillePriorite {
                rank: mr + 1,
                maille_id: r.maille_id,
                maille_code: r.maille_code.clone(),
                score_critique: (sc * 1000.0).round() / 1000.0,
                in_depression: r.in_depression,
                justification: j.clone(),
                reasons: j,
            }
        })
        .collect()
}

fn repair_to_k(bits: &mut [bool], k: usize, rng: &mut impl Rng) {
    let mut ones: Vec<usize> = bits
        .iter()
        .enumerate()
        .filter_map(|(i, b)| if *b { Some(i) } else { None })
        .collect();
    let mut zeros: Vec<usize> = bits
        .iter()
        .enumerate()
        .filter_map(|(i, b)| if !*b { Some(i) } else { None })
        .collect();
    while ones.len() > k {
        let j = *ones.choose(rng).unwrap();
        bits[j] = false;
        ones.retain(|&x| x != j);
        zeros.push(j);
    }
    while ones.len() < k {
        let j = *zeros.choose(rng).unwrap();
        bits[j] = true;
        zeros.retain(|&x| x != j);
        ones.push(j);
    }
}

fn random_individual(n: usize, k: usize, rng: &mut impl Rng) -> Vec<bool> {
    let mut bits = vec![false; n];
    let mut idx: Vec<usize> = (0..n).collect();
    idx.shuffle(rng);
    for i in idx.into_iter().take(k) {
        bits[i] = true;
    }
    bits
}

fn crossover(
    p1: &[bool],
    p2: &[bool],
    k: usize,
    rng: &mut impl Rng,
) -> (Vec<bool>, Vec<bool>) {
    let mut c1 = vec![false; p1.len()];
    let mut c2 = vec![false; p1.len()];
    for i in 0..p1.len() {
        if rng.gen_bool(0.5) {
            c1[i] = p1[i];
            c2[i] = p2[i];
        } else {
            c1[i] = p2[i];
            c2[i] = p1[i];
        }
    }
    repair_to_k(&mut c1, k, rng);
    repair_to_k(&mut c2, k, rng);
    (c1, c2)
}

fn mutate(bits: &mut [bool], k: usize, rng: &mut impl Rng) {
    if bits.len() < 2 {
        return;
    }
    let i = rng.gen_range(0..bits.len());
    bits[i] = !bits[i];
    repair_to_k(bits, k, rng);
}

fn tournament<'a>(
    pop: &'a [Vec<bool>],
    scratch: &GaScratch,
    rng: &mut impl Rng,
) -> &'a Vec<bool> {
    let a = rng.gen_range(0..pop.len());
    let b = rng.gen_range(0..pop.len());
    if fitness_var_reduction(&pop[a], scratch) >= fitness_var_reduction(&pop[b], scratch) {
        &pop[a]
    } else {
        &pop[b]
    }
}

fn run_ga(
    rows: &[CampaignRow],
    weights: &CampaignWeights,
    budget: usize,
    pop_size: usize,
    generations: usize,
) -> (Vec<bool>, f64, Vec<Vec<bool>>) {
    let n = rows.len();
    let k = budget.min(n);
    let scratch = build_scratch(rows, weights);
    let mut rng = rand::thread_rng();
    let elite_n = (pop_size / 10).max(2);
    let mut pop: Vec<Vec<bool>> = (0..pop_size)
        .map(|_| random_individual(n, k, &mut rng))
        .collect();
    let mut best = pop[0].clone();
    let mut best_f = fitness_var_reduction(&best, &scratch);
    for _ in 0..generations {
        for ind in &pop {
            let f = fitness_var_reduction(ind, &scratch);
            if f > best_f {
                best_f = f;
                best.clone_from(ind);
            }
        }
        let mut scored: Vec<(usize, f64)> = pop
            .iter()
            .enumerate()
            .map(|(i, b)| (i, fitness_var_reduction(b, &scratch)))
            .collect();
        scored.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
        let mut next: Vec<Vec<bool>> = scored
            .iter()
            .take(elite_n)
            .map(|(i, _)| pop[*i].clone())
            .collect();
        while next.len() < pop_size {
            let p1 = tournament(&pop, &scratch, &mut rng).clone();
            let p2 = tournament(&pop, &scratch, &mut rng).clone();
            let (mut c1, mut c2) = crossover(&p1, &p2, k, &mut rng);
            if rng.gen_bool(0.25) {
                mutate(&mut c1, k, &mut rng);
            }
            if rng.gen_bool(0.25) {
                mutate(&mut c2, k, &mut rng);
            }
            next.push(c1);
            if next.len() < pop_size {
                next.push(c2);
            }
        }
        pop = next;
    }
    let mut uniq: Vec<(Vec<bool>, f64)> = pop
        .into_iter()
        .map(|b| {
            let f = fitness_var_reduction(&b, &scratch);
            (b, f)
        })
        .collect();
    uniq.sort_by(|a, b| b.1.partial_cmp(&a.1).unwrap_or(std::cmp::Ordering::Equal));
    let mut seen: HashSet<String> = HashSet::new();
    let mut alt: Vec<Vec<bool>> = Vec::new();
    for (b, _) in uniq {
        let key: String = b.iter().map(|x| if *x { '1' } else { '0' }).collect();
        if seen.insert(key) {
            alt.push(b);
            if alt.len() >= 5 {
                break;
            }
        }
    }
    (best, best_f, alt)
}

fn build_campaign_metrics(
    rows: &[CampaignRow],
    bits: &[bool],
    scratch: &GaScratch,
    budget_requested: usize,
    k_returned: usize,
    best_fitness: Option<f64>,
    tour_km: f64,
) -> CampaignMetrics {
    let n_dep = rows.iter().filter(|r| r.in_depression).count();
    let mean_risque = if rows.is_empty() {
        0.0
    } else {
        rows.iter().map(|r| r.risque_gonflement_score as f64).sum::<f64>() / rows.len() as f64
    };
    let (var_ratio, risk_cap) = variance_risk_metrics(bits, rows, scratch);
    CampaignMetrics {
        pool_size: rows.len(),
        candidates_in_depression: n_dep,
        mean_risque_score: (mean_risque * 100.0).round() / 100.0,
        budget_requested,
        budget_returned: k_returned,
        priority_score_formula_version: PRIORITY_FORMULA_VERSION.to_string(),
        variance_reduction_ratio: (var_ratio * 1000.0).round() / 1000.0,
        risk_capture: (risk_cap * 1000.0).round() / 1000.0,
        approx_travel_tour_km: (tour_km * 1000.0).round() / 1000.0,
        coverage_gain: (var_ratio * 1000.0).round() / 1000.0,
        best_fitness: best_fitness,
    }
}

fn alternatives_to_json(
    alt_bits: &[Vec<bool>],
    rows: &[CampaignRow],
    scratch: &GaScratch,
) -> Vec<serde_json::Value> {
    let mut out = Vec::new();
    for (i, bits) in alt_bits.iter().enumerate() {
        let f = fitness_var_reduction(bits, scratch);
        let sel: Vec<usize> = bits
            .iter()
            .enumerate()
            .filter_map(|(j, b)| if *b { Some(j) } else { None })
            .collect();
        let (_km, tour) = nearest_neighbor_tour(&sel, rows);
        let codes: Vec<String> = tour.iter().map(|&idx| rows[idx].maille_code.clone()).collect();
        out.push(serde_json::json!({
            "strategy_index": i + 1,
            "fitness": (f * 1000.0).round() / 1000.0,
            "maille_codes_mission_order": codes,
        }));
    }
    out
}

fn pack_response(
    zone: String,
    objectif: String,
    mode: String,
    depression_hard: bool,
    method: String,
    weights: CampaignWeights,
    rows: &[CampaignRow],
    mailles_prioritaires: Vec<MaillePriorite>,
    budget_requested: usize,
    ga_generations: Option<usize>,
    ga_population: Option<usize>,
    best_fitness: Option<f64>,
    bits_for_metrics: Vec<bool>,
    scratch: &GaScratch,
    tour_km: f64,
    alternatives: Vec<serde_json::Value>,
) -> CampaignResponse {
    let recommended_cells = mailles_prioritaires.clone();
    let score: Vec<f64> = mailles_prioritaires.iter().map(|x| x.score_critique).collect();
    let justification: Vec<Vec<String>> = mailles_prioritaires
        .iter()
        .map(|x| x.justification.clone())
        .collect();
    let metrics = build_campaign_metrics(
        rows,
        &bits_for_metrics,
        scratch,
        budget_requested,
        mailles_prioritaires.len(),
        best_fitness,
        tour_km,
    );
    CampaignResponse {
        ok: true,
        model_version: "api-opti-campaign-v2",
        zone,
        budget: mailles_prioritaires.len(),
        objectif,
        mode,
        depression_hard_constraint: depression_hard,
        method,
        pool_size: rows.len(),
        weights,
        mailles_prioritaires,
        recommended_cells,
        score,
        justification,
        metrics,
        ga_generations,
        ga_population,
        alternatives,
        best_fitness,
    }
}

fn priorites_from_bits(
    bits: &[bool],
    rows: &[CampaignRow],
    weights: &CampaignWeights,
) -> Vec<MaillePriorite> {
    let mut idxs: Vec<usize> = bits
        .iter()
        .enumerate()
        .filter_map(|(i, b)| if *b { Some(i) } else { None })
        .collect();
    idxs.sort_by(|&a, &b| {
        weighted_priority(&rows[b], weights)
            .partial_cmp(&weighted_priority(&rows[a], weights))
            .unwrap_or(std::cmp::Ordering::Equal)
    });
    let top: Vec<(usize, f64)> = idxs
        .iter()
        .map(|&i| (i, weighted_priority(&rows[i], weights)))
        .collect();
    mailles_mission_ordered(rows, &top, weights)
}

pub async fn campaign_simple(
    State(state): State<AppState>,
    Json(req): Json<CampaignRequest>,
) -> Result<Json<CampaignResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut weights = req.weights.clone().unwrap_or_default();
    if req.objectif.eq_ignore_ascii_case("gonflement") && !req.mode.contains("soft") {
        weights.w_risque = weights.w_risque.max(1.2);
    }
    let depression_only = req.depression_hard_constraint && !req.relax_depression_pool;
    let rows = load_pool(&state.pool, &req.zone, depression_only)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "db_load", "detail": e.to_string() })),
            )
        })?;
    if rows.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "empty_pool",
                "detail": "Aucune maille candidate (zone inconnue, ou contrainte dépression exclut toutes les mailles)."
            })),
        ));
    }
    let budget = req.budget.max(1);
    let scratch = build_scratch(&rows, &weights);
    let sorted = sorted_by_priority(&rows, &weights);
    let take = budget.min(sorted.len());
    let top: Vec<(usize, f64)> = sorted.into_iter().take(take).collect();
    let mut bits = vec![false; rows.len()];
    for (i, _) in &top {
        if *i < bits.len() {
            bits[*i] = true;
        }
    }
    let mailles_prioritaires = mailles_mission_ordered(&rows, &top, &weights);
    let sel_idx: Vec<usize> = top.iter().map(|(i, _)| *i).collect();
    let (tour_km, _) = nearest_neighbor_tour(&sel_idx, &rows);
    let resp = pack_response(
        req.zone,
        req.objectif,
        req.mode,
        depression_only,
        "heuristic".to_string(),
        weights,
        &rows,
        mailles_prioritaires,
        budget,
        None,
        None,
        None,
        bits,
        &scratch,
        tour_km,
        vec![],
    );
    Ok(Json(resp))
}

pub async fn campaign_ga(
    State(state): State<AppState>,
    Json(req): Json<CampaignRequest>,
) -> Result<Json<CampaignResponse>, (StatusCode, Json<serde_json::Value>)> {
    let mut weights = req.weights.clone().unwrap_or_default();
    if req.objectif.eq_ignore_ascii_case("gonflement") && !req.mode.contains("soft") {
        weights.w_risque = weights.w_risque.max(1.2);
    }
    let depression_only = req.depression_hard_constraint && !req.relax_depression_pool;
    let rows = load_pool(&state.pool, &req.zone, depression_only)
        .await
        .map_err(|e| {
            (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({ "error": "db_load", "detail": e.to_string() })),
            )
        })?;
    if rows.is_empty() {
        return Err((
            StatusCode::BAD_REQUEST,
            Json(serde_json::json!({
                "error": "empty_pool",
                "detail": "Aucune maille candidate."
            })),
        ));
    }
    let budget = req.budget.max(1);
    let k = budget.min(rows.len());
    let pop = req.population_size.unwrap_or(50).clamp(10, 200);
    let gen = req.generations.unwrap_or(45).clamp(5, 500);
    let (bits, best_f, alt_bits) = run_ga(&rows, &weights, k, pop, gen);
    let scratch = build_scratch(&rows, &weights);
    let mailles_prioritaires = priorites_from_bits(&bits, &rows, &weights);
    let bf = Some((best_f * 1000.0).round() / 1000.0);
    let sel_idx: Vec<usize> = bits
        .iter()
        .enumerate()
        .filter_map(|(i, b)| if *b { Some(i) } else { None })
        .collect();
    let (tour_km, _) = nearest_neighbor_tour(&sel_idx, &rows);
    let alts = alternatives_to_json(&alt_bits, &rows, &scratch);
    let resp = pack_response(
        req.zone,
        req.objectif,
        req.mode,
        depression_only,
        "genetic".to_string(),
        weights,
        &rows,
        mailles_prioritaires,
        budget,
        Some(gen),
        Some(pop),
        bf,
        bits,
        &scratch,
        tour_km,
        alts,
    );
    Ok(Json(resp))
}

#[cfg(test)]
mod tests {
    use super::*;
    use uuid::Uuid;

    fn sample_row(
        in_depression: bool,
        risque: i32,
        dist: f64,
        var: Option<f64>,
        trans: f64,
    ) -> CampaignRow {
        CampaignRow {
            maille_id: Uuid::nil(),
            maille_code: "TEST".to_string(),
            in_depression,
            risque_gonflement: Some("moyen".to_string()),
            risque_gonflement_score: risque,
            distance_sondage_m: dist,
            variance_kriging: var,
            transition_geologique: trans,
            priorite_infrastructure: 0.5,
            n_sondages: 0,
            pct_in_lama: 0.0,
            pct_zone: Some(50.0),
            priority_score_v1: None,
            norm_variance_v1: None,
            lon: Some(1.0),
            lat: Some(1.0),
        }
    }

    #[test]
    fn weighted_priority_increases_with_risque() {
        let w = CampaignWeights::default();
        let low = sample_row(true, 1, 5000.0, Some(2.0), 0.1);
        let high = sample_row(true, 5, 5000.0, Some(2.0), 0.1);
        assert!(weighted_priority(&high, &w) > weighted_priority(&low, &w));
    }

    #[test]
    fn priority_v1_rust_stable() {
        let r = sample_row(false, 3, 3000.0, Some(10.0), 0.4);
        let p = priority_score_v1_rust(&r);
        assert!(p > 0.2 && p < 1.1);
    }

    #[test]
    fn repair_to_k_respects_exact_count() {
        let mut rng = rand::thread_rng();
        let mut bits = vec![true, true, true, false, false];
        repair_to_k(&mut bits, 2, &mut rng);
        assert_eq!(bits.iter().filter(|b| **b).count(), 2);
        repair_to_k(&mut bits, 4, &mut rng);
        assert_eq!(bits.iter().filter(|b| **b).count(), 4);
    }

    #[test]
    fn campaign_response_json_always_has_best_fitness_keys() {
        let rows = vec![sample_row(true, 3, 2000.0, Some(12.0), 0.25)];
        let w = CampaignWeights::default();
        let scratch = build_scratch(&rows, &w);
        let prio = vec![MaillePriorite {
            rank: 1,
            maille_id: rows[0].maille_id,
            maille_code: rows[0].maille_code.clone(),
            score_critique: 0.5,
            in_depression: true,
            justification: vec![],
            reasons: vec![],
        }];
        let resp = pack_response(
            "DEPRESSION_LAMA_TG".to_string(),
            "gonflement".to_string(),
            "exploration".to_string(),
            true,
            "heuristic".to_string(),
            w,
            &rows,
            prio,
            4,
            None,
            None,
            None,
            vec![true],
            &scratch,
            1.25,
            vec![],
        );
        let v = serde_json::to_value(&resp).expect("serialize");
        assert!(
            v.get("best_fitness").is_some(),
            "top-level best_fitness key missing"
        );
        assert!(
            v["best_fitness"].is_null(),
            "heuristic path should serialize null best_fitness"
        );
        let metrics = v.get("metrics").expect("metrics");
        assert!(
            metrics.get("best_fitness").is_some(),
            "metrics.best_fitness key missing"
        );
        assert!(metrics["best_fitness"].is_null());
    }

    #[test]
    fn campaign_response_ga_best_fitness_is_number() {
        let rows: Vec<CampaignRow> = (0..3)
            .map(|i| sample_row(true, 3, 1000.0, Some((i + 1) as f64), 0.1))
            .collect();
        let w = CampaignWeights::default();
        let scratch = build_scratch(&rows, &w);
        let prio = priorites_from_bits(&[true, false, true], &rows, &w);
        let resp = pack_response(
            "Z".to_string(),
            "gonflement".to_string(),
            "exploration".to_string(),
            true,
            "genetic".to_string(),
            w,
            &rows,
            prio,
            2,
            Some(40),
            Some(30),
            Some(0.42),
            vec![true, false, true],
            &scratch,
            2.0,
            vec![serde_json::json!({})],
        );
        let v = serde_json::to_value(&resp).unwrap();
        assert_eq!(v["best_fitness"], serde_json::json!(0.42));
        assert_eq!(v["metrics"]["best_fitness"], serde_json::json!(0.42));
    }

    #[test]
    fn fitness_var_reduction_favors_high_variance_subset() {
        let rows: Vec<CampaignRow> = (0..4)
            .map(|i| CampaignRow {
                maille_id: Uuid::from_u128(0x1000u128 + i),
                maille_code: format!("M{i}"),
                in_depression: true,
                risque_gonflement: None,
                risque_gonflement_score: 3,
                distance_sondage_m: 2000.0,
                variance_kriging: Some((i as f64) * 3.0),
                transition_geologique: 0.2,
                priorite_infrastructure: 0.3,
                n_sondages: 0,
                pct_in_lama: 0.0,
                pct_zone: None,
                priority_score_v1: None,
                norm_variance_v1: None,
                lon: Some(0.1 * i as f64),
                lat: Some(0.1 * i as f64),
            })
            .collect();
        let w = CampaignWeights::default();
        let s = build_scratch(&rows, &w);
        let f_low = fitness_var_reduction(&vec![true, true, false, false], &s);
        let f_high = fitness_var_reduction(&vec![false, false, true, true], &s);
        assert!(f_high > f_low);
    }
}
