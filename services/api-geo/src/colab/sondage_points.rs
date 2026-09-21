//! Génération automatique des points de sondage prévisionnels d'une mission.
//!
//! Objectif : minimiser la variance de prédiction d'un BLUP stationnaire
//! (krigeage ordinaire) sur l'emprise de chaque maille.
//!
//! ## Le plan retenu
//!
//! **Réseau triangulaire équilatéral, orientation et calage optimisés, plus
//! quelques couples rapprochés.**
//!
//! 1. Pour un champ stationnaire isotrope de covariance décroissante, la
//!    variance de krigeage en un point croît avec sa distance au plus proche
//!    point échantillonné. Minimiser la variance sur l'emprise revient donc à
//!    minimiser le *rayon de couverture* — la distance du pire point du domaine
//!    à son plus proche voisin. À densité égale, le réseau triangulaire est le
//!    meilleur pavage pour ce critère (Matérn 1960 ; Yfantis, Flatman & Behar
//!    1987).
//!
//! 2. Ce résultat est asymptotique : sur un domaine borné et un effectif
//!    faible, l'orientation et le calage du réseau par rapport aux bords pèsent
//!    autant que sa maille. Un réseau simplement centré sur l'emprise laisse
//!    des coins mal couverts. On balaie donc rotations et décalages, et on
//!    retient la configuration de rayon de couverture minimal — mesuré sur une
//!    grille dense à l'intérieur du polygone.
//!
//! 3. Un réseau strictement régulier ne produit aucun couple à courte
//!    distance : le palier et surtout l'effet de pépite du variogramme
//!    deviennent inidentifiables. Or le BLUP « stationnaire » emploie en
//!    pratique une covariance *estimée* : une pépite mal identifiée fausse
//!    directement les poids de krigeage. On ajoute donc quelques couples
//!    rapprochés — sauf sur les petits effectifs, où sacrifier un point de
//!    couverture coûterait plus qu'il ne rapporte.
//!
//! Tout le calcul métrique se fait en UTM 31N (EPSG:32631), qui couvre le Togo.
//! La base ne sert qu'à deux choses : fournir le polygone projeté, et
//! reprojeter les points finaux en WGS84.

use axum::{
    extract::{Path, State},
    http::StatusCode,
    Json,
};
use serde_json::json;
use sqlx::Row;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::state::AppState;

type ApiResult<T> = Result<T, (StatusCode, Json<serde_json::Value>)>;

/// SRID métrique utilisé pour toutes les distances et aires.
const METRIC_SRID: i32 = 32631;
/// Hauteur d'une rangée du réseau triangulaire, en pas : sin(60°).
const ROW_FACTOR: f64 = 0.866_025_403_784_438_6;
/// En deçà de cet effectif, on ne dépense pas de point en couple rapproché.
const MIN_COUNT_FOR_CLOSE_PAIRS: i32 = 8;
/// Côté de la grille d'évaluation du rayon de couverture.
const EVAL_GRID: usize = 48;

fn err(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": message.into() })))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": format!("Erreur DB: {e}") })),
    )
}

// ───────────────────────── géométrie ─────────────────────────

/// Polygone projeté : anneau extérieur et éventuels trous, en mètres.
#[derive(Debug, Clone)]
struct Ring(Vec<(f64, f64)>);

#[derive(Debug, Clone)]
pub struct MetricPolygon {
    rings: Vec<Ring>,
    minx: f64,
    miny: f64,
    maxx: f64,
    maxy: f64,
}

impl MetricPolygon {
    /// Construit le polygone depuis le GeoJSON renvoyé par `ST_AsGeoJSON`.
    /// Un MultiPolygon est aplati : tous ses anneaux sont conservés, ce qui
    /// suffit au test d'appartenance par parité de croisements.
    fn from_geojson(value: &serde_json::Value) -> Option<Self> {
        let kind = value.get("type")?.as_str()?;
        let coords = value.get("coordinates")?;
        let mut rings: Vec<Ring> = Vec::new();

        let mut push_polygon = |poly: &serde_json::Value| {
            if let Some(list) = poly.as_array() {
                for ring in list {
                    let pts: Vec<(f64, f64)> = ring
                        .as_array()
                        .map(|a| {
                            a.iter()
                                .filter_map(|p| {
                                    let c = p.as_array()?;
                                    Some((c.first()?.as_f64()?, c.get(1)?.as_f64()?))
                                })
                                .collect()
                        })
                        .unwrap_or_default();
                    if pts.len() >= 4 {
                        rings.push(Ring(pts));
                    }
                }
            }
        };

        match kind {
            "Polygon" => push_polygon(coords),
            "MultiPolygon" => {
                for poly in coords.as_array()? {
                    push_polygon(poly);
                }
            }
            _ => return None,
        }
        if rings.is_empty() {
            return None;
        }

        let (mut minx, mut miny) = (f64::MAX, f64::MAX);
        let (mut maxx, mut maxy) = (f64::MIN, f64::MIN);
        for r in &rings {
            for &(x, y) in &r.0 {
                minx = minx.min(x);
                miny = miny.min(y);
                maxx = maxx.max(x);
                maxy = maxy.max(y);
            }
        }
        Some(Self {
            rings,
            minx,
            miny,
            maxx,
            maxy,
        })
    }

    /// Appartenance par lancer de rayon : un point est dedans si le nombre
    /// total de croisements, trous compris, est impair.
    fn contains(&self, x: f64, y: f64) -> bool {
        if x < self.minx || x > self.maxx || y < self.miny || y > self.maxy {
            return false;
        }
        let mut inside = false;
        for ring in &self.rings {
            let pts = &ring.0;
            let n = pts.len();
            let mut j = n - 1;
            for i in 0..n {
                let (xi, yi) = pts[i];
                let (xj, yj) = pts[j];
                if (yi > y) != (yj > y) {
                    let t = (y - yi) / (yj - yi);
                    if x < xi + t * (xj - xi) {
                        inside = !inside;
                    }
                }
                j = i;
            }
        }
        inside
    }

    /// Grille régulière de points intérieurs, servant à mesurer le rayon de
    /// couverture d'un plan candidat.
    fn evaluation_grid(&self) -> Vec<(f64, f64)> {
        let mut out = Vec::new();
        let dx = (self.maxx - self.minx) / (EVAL_GRID as f64 - 1.0);
        let dy = (self.maxy - self.miny) / (EVAL_GRID as f64 - 1.0);
        for j in 0..EVAL_GRID {
            for i in 0..EVAL_GRID {
                let x = self.minx + i as f64 * dx;
                let y = self.miny + j as f64 * dy;
                if self.contains(x, y) {
                    out.push((x, y));
                }
            }
        }
        out
    }
}

/// Points d'un réseau triangulaire de pas `spacing`, tourné de `rot` radians
/// et décalé de (`offx`, `offy`) autour du centre de l'emprise, retenus s'ils
/// tombent dans le polygone.
fn lattice(poly: &MetricPolygon, spacing: f64, rot: f64, offx: f64, offy: f64) -> Vec<(f64, f64)> {
    let dy = spacing * ROW_FACTOR;
    let (cx, cy) = (
        (poly.minx + poly.maxx) / 2.0,
        (poly.miny + poly.maxy) / 2.0,
    );
    let diag = ((poly.maxx - poly.minx).powi(2) + (poly.maxy - poly.miny).powi(2)).sqrt();
    let ni = (diag / spacing) as i64 + 2;
    let nj = (diag / dy) as i64 + 2;
    let (c, s) = (rot.cos(), rot.sin());

    let mut out = Vec::new();
    for j in -nj..=nj {
        for i in -ni..=ni {
            let lx = (i as f64 + if j.rem_euclid(2) == 1 { 0.5 } else { 0.0 }) * spacing;
            let ly = j as f64 * dy;
            let x = cx + offx + lx * c - ly * s;
            let y = cy + offy + lx * s + ly * c;
            if poly.contains(x, y) {
                out.push((x, y));
            }
        }
    }
    out
}

/// Rayon de couverture : distance du pire point de la grille d'évaluation à
/// son plus proche point du plan. C'est le majorant de la variance de krigeage.
fn covering_radius(design: &[(f64, f64)], eval: &[(f64, f64)]) -> f64 {
    if design.is_empty() || eval.is_empty() {
        return f64::MAX;
    }
    let mut worst: f64 = 0.0;
    for &(ex, ey) in eval {
        let mut best = f64::MAX;
        for &(px, py) in design {
            let d = (ex - px).powi(2) + (ey - py).powi(2);
            if d < best {
                best = d;
            }
        }
        worst = worst.max(best);
    }
    worst.sqrt()
}

/// Ajuste le pas pour obtenir `wanted` points, à orientation et calage fixés.
fn solve_spacing_for(
    poly: &MetricPolygon,
    area: f64,
    wanted: i32,
    rot: f64,
    offx: f64,
    offy: f64,
) -> Option<(f64, Vec<(f64, f64)>)> {
    let a0 = (area / (wanted.max(1) as f64 * ROW_FACTOR)).sqrt();
    let (mut lo, mut hi) = (a0 * 0.2, a0 * 5.0);
    let mut exact: Option<(f64, Vec<(f64, f64)>)> = None;

    for _ in 0..24 {
        let a = (lo + hi) / 2.0;
        let pts = lattice(poly, a, rot, offx, offy);
        match (pts.len() as i32).cmp(&wanted) {
            std::cmp::Ordering::Greater => lo = a,
            std::cmp::Ordering::Less => hi = a,
            std::cmp::Ordering::Equal => {
                exact = Some((a, pts));
                break;
            }
        }
    }
    exact
}

/// Cherche le meilleur plan : on balaie orientations et décalages, on ne garde
/// que les configurations qui donnent exactement l'effectif visé, et parmi
/// elles celle de rayon de couverture minimal.
///
/// Le balayage porte sur 60° seulement : au-delà le réseau triangulaire se
/// répète.
fn best_design(poly: &MetricPolygon, area: f64, wanted: i32) -> Option<(f64, Vec<(f64, f64)>, f64)> {
    if wanted <= 0 {
        return None;
    }
    let eval = poly.evaluation_grid();
    let a0 = (area / (wanted as f64 * ROW_FACTOR)).sqrt();

    let rotations = 6;
    let offsets = 5;
    let mut best: Option<(f64, Vec<(f64, f64)>, f64)> = None;

    for ri in 0..rotations {
        let rot = std::f64::consts::FRAC_PI_3 * ri as f64 / rotations as f64;
        for oi in 0..offsets {
            for oj in 0..offsets {
                let offx = a0 * (oi as f64 / offsets as f64 - 0.5);
                let offy = a0 * ROW_FACTOR * (oj as f64 / offsets as f64 - 0.5);
                if let Some((a, pts)) = solve_spacing_for(poly, area, wanted, rot, offx, offy) {
                    let r = covering_radius(&pts, &eval);
                    if best.as_ref().is_none_or(|(_, _, br)| r < *br) {
                        best = Some((a, pts, r));
                    }
                }
            }
        }
    }

    // Aucun calage ne donne l'effectif exact (mailles très petites ou très
    // découpées) : on retombe sur le réseau centré, quitte à tronquer.
    if best.is_none() {
        let mut lo = a0 * 0.2;
        let mut hi = a0 * 5.0;
        let mut fallback: Option<(f64, Vec<(f64, f64)>)> = None;
        for _ in 0..24 {
            let a = (lo + hi) / 2.0;
            let pts = lattice(poly, a, 0.0, 0.0, 0.0);
            if pts.len() as i32 >= wanted {
                fallback = Some((a, pts));
                lo = a;
            } else {
                hi = a;
            }
        }
        if let Some((a, mut pts)) = fallback {
            keep_most_central(&mut pts, wanted as usize);
            let r = covering_radius(&pts, &eval);
            best = Some((a, pts, r));
        }
    }

    best.map(|(a, mut pts, r)| {
        sort_north_to_south(&mut pts);
        (a, pts, r)
    })
}

/// Ne conserve que les `keep` points les plus proches du barycentre : les plus
/// excentrés sont ceux qui apportent le moins à la couverture du cœur.
fn keep_most_central(pts: &mut Vec<(f64, f64)>, keep: usize) {
    if pts.len() <= keep {
        return;
    }
    let cx = pts.iter().map(|p| p.0).sum::<f64>() / pts.len() as f64;
    let cy = pts.iter().map(|p| p.1).sum::<f64>() / pts.len() as f64;
    pts.sort_by(|a, b| {
        let da = (a.0 - cx).powi(2) + (a.1 - cy).powi(2);
        let db = (b.0 - cx).powi(2) + (b.1 - cy).powi(2);
        da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
    });
    pts.truncate(keep);
}

/// Numérotation de terrain : du nord au sud, puis d'ouest en est.
fn sort_north_to_south(pts: &mut [(f64, f64)]) {
    pts.sort_by(|a, b| {
        b.1.partial_cmp(&a.1)
            .unwrap_or(std::cmp::Ordering::Equal)
            .then(a.0.partial_cmp(&b.0).unwrap_or(std::cmp::Ordering::Equal))
    });
}

/// Répartit `total` points entre les mailles au prorata de leur aire, avec au
/// moins un point par maille (méthode des plus forts restes).
fn allocate(total: i32, areas: &[f64]) -> Vec<i32> {
    let n = areas.len();
    if n == 0 {
        return Vec::new();
    }
    let total = total.max(n as i32);
    let sum: f64 = areas.iter().sum();
    if sum <= 0.0 {
        let base = total / n as i32;
        let mut out = vec![base; n];
        for item in out.iter_mut().take((total - base * n as i32) as usize) {
            *item += 1;
        }
        return out;
    }

    let exact: Vec<f64> = areas.iter().map(|a| a / sum * total as f64).collect();
    let mut out: Vec<i32> = exact.iter().map(|e| (e.floor() as i32).max(1)).collect();
    let mut left = total - out.iter().sum::<i32>();

    let mut order: Vec<usize> = (0..n).collect();
    order.sort_by(|&i, &j| {
        let ri = exact[i] - exact[i].floor();
        let rj = exact[j] - exact[j].floor();
        rj.partial_cmp(&ri).unwrap_or(std::cmp::Ordering::Equal)
    });

    let mut k = 0usize;
    while left > 0 {
        out[order[k % n]] += 1;
        left -= 1;
        k += 1;
    }
    // Le plancher à 1 point par maille peut faire dépasser la cible : on rend
    // les points aux plus grandes mailles, jamais en descendant sous 1.
    let mut k = 0usize;
    while left < 0 && k <= 10 * n {
        let idx = order[k % n];
        if out[idx] > 1 {
            out[idx] -= 1;
            left += 1;
        }
        k += 1;
    }
    out
}

// ───────────────────────── endpoint ─────────────────────────

#[derive(Debug, serde::Deserialize)]
pub struct GeneratePointsRequest {
    /// Nombre de points visé sur l'ensemble des mailles de la mission.
    /// Par défaut `expected_sondages` de la mission.
    pub target_count: Option<i32>,
    /// Nombre de points imposé à CHAQUE maille. Prioritaire sur
    /// `target_count` : la répartition au prorata de l'aire n'a plus lieu
    /// d'être, chaque maille reçoit exactement cet effectif. C'est la
    /// formulation naturelle quand la charge de terrain se raisonne par zone
    /// et non par mission.
    pub points_per_maille: Option<i32>,
    /// Couples rapprochés pour identifier l'effet de pépite. Par défaut actif
    /// dès que l'effectif le permet.
    pub close_pairs: Option<bool>,
    /// Écraser les points existants. Sans cela une mission qui en a déjà est
    /// refusée : ils peuvent avoir été communiqués aux opérateurs.
    pub replace: Option<bool>,
}

struct PlacedPoint {
    numero: i32,
    label: String,
    lat: f64,
    lon: f64,
    maille_code: String,
    kind: &'static str,
}

/// POST /colab/missions/:id/sondage-points/generate
pub async fn generate_sondage_points(
    State(state): State<AppState>,
    auth: AuthUser,
    Path(mission_id): Path<Uuid>,
    Json(request): Json<GeneratePointsRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    if !auth.has_permission("colab.missions.update") {
        return Err(err(StatusCode::FORBIDDEN, "Permission refusée"));
    }

    let mission = sqlx::query(
        "SELECT code, COALESCE(expected_sondages, 0) AS expected
         FROM atlas.colab_missions WHERE id = $1 AND deleted_at IS NULL",
    )
    .bind(mission_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| err(StatusCode::NOT_FOUND, "Mission non trouvée"))?;

    let mission_code: String = mission.get("code");
    let expected: i32 = mission.get("expected");
    let target = request
        .target_count
        .unwrap_or(if expected > 0 { expected } else { 6 });
    if let Some(n) = request.points_per_maille {
        if !(1..=100).contains(&n) {
            return Err(err(
                StatusCode::BAD_REQUEST,
                "Le nombre de points par maille doit être compris entre 1 et 100",
            ));
        }
    }
    if !(1..=500).contains(&target) {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "Le nombre de points doit être compris entre 1 et 500",
        ));
    }

    let existing: i64 = sqlx::query_scalar(
        "SELECT COUNT(*) FROM atlas.colab_mission_sondage_points WHERE mission_id = $1",
    )
    .bind(mission_id)
    .fetch_one(&state.pool)
    .await
    .map_err(db_err)?;

    let replace = request.replace.unwrap_or(false);
    if existing > 0 && !replace {
        return Err(err(
            StatusCode::CONFLICT,
            format!("Cette mission a déjà {existing} point(s) prévisionnel(s). Cochez le remplacement pour les régénérer."),
        ));
    }
    if replace {
        let confirmed: i64 = sqlx::query_scalar(
            "SELECT COUNT(*) FROM atlas.colab_mission_sondage_points
             WHERE mission_id = $1 AND confirmed_sondage_id IS NOT NULL",
        )
        .bind(mission_id)
        .fetch_one(&state.pool)
        .await
        .map_err(db_err)?;
        if confirmed > 0 {
            return Err(err(
                StatusCode::CONFLICT,
                format!("{confirmed} point(s) ont déjà été confirmés sur le terrain : ils ne peuvent pas être régénérés."),
            ));
        }
    }

    // Mailles de la mission : items explicites, complétés par la maille
    // principale si elle n'y figure pas.
    let maille_rows = sqlx::query(
        r#"
        SELECT DISTINCT mc.id, mc.code,
               ST_Area(ST_Transform(mc.geom, $2)) AS area_m2,
               ST_AsGeoJSON(ST_Transform(mc.geom, $2)) AS gj
        FROM atlas.mailles mc
        -- `atlas.v_mission_mailles` est la définition unique des mailles d'une
        -- mission (cf. migration 108). Une mission peut légitimement en couvrir
        -- plusieurs — c'est le cas d'une des missions en cours.
        WHERE mc.id IN (SELECT maille_id FROM atlas.v_mission_mailles WHERE mission_id = $1)
        ORDER BY mc.code
        "#,
    )
    .bind(mission_id)
    .bind(METRIC_SRID)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    if maille_rows.is_empty() {
        return Err(err(
            StatusCode::BAD_REQUEST,
            "Cette mission n'a aucune maille rattachée : impossible de placer des points.",
        ));
    }

    struct Prepared {
        code: String,
        area: f64,
        poly: MetricPolygon,
    }
    let mut prepared: Vec<Prepared> = Vec::new();
    for r in &maille_rows {
        let code: String = r.get("code");
        let area: f64 = r.get("area_m2");
        let gj: String = r.get("gj");
        let value: serde_json::Value = serde_json::from_str(&gj).map_err(|e| {
            err(
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Géométrie illisible pour la maille {code}: {e}"),
            )
        })?;
        let poly = MetricPolygon::from_geojson(&value).ok_or_else(|| {
            err(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("La maille {code} n'a pas une géométrie surfacique exploitable."),
            )
        })?;
        prepared.push(Prepared { code, area, poly });
    }

    let areas: Vec<f64> = prepared.iter().map(|p| p.area).collect();
    let quota = match request.points_per_maille {
        Some(n) if n >= 1 => vec![n; prepared.len()],
        _ => allocate(target, &areas),
    };
    let total_wanted: i32 = quota.iter().sum();
    let want_pairs = request
        .close_pairs
        .unwrap_or(total_wanted >= MIN_COUNT_FOR_CLOSE_PAIRS)
        && total_wanted >= MIN_COUNT_FOR_CLOSE_PAIRS;

    // Les couples se décident sur l'effectif de la MISSION, pas maille par
    // maille : 12 points répartis sur 3 mailles n'en donnaient aucun, alors
    // que le variogramme s'ajuste sur l'ensemble des données remontées. On
    // place ensuite les couples dans les mailles les mieux dotées, en leur
    // laissant toujours au moins deux points de réseau.
    let mut pairs_per_maille = vec![0usize; quota.len()];
    if want_pairs {
        let mut remaining = (total_wanted / MIN_COUNT_FOR_CLOSE_PAIRS).max(1) as usize;
        let mut order: Vec<usize> = (0..quota.len()).collect();
        order.sort_by(|&a, &b| quota[b].cmp(&quota[a]));
        let mut guard = 0usize;
        while remaining > 0 && guard < 10 * quota.len().max(1) {
            let mut placed_this_round = false;
            for &i in &order {
                if remaining == 0 {
                    break;
                }
                // Une maille garde toujours au moins 3 points de réseau : en
                // dessous, le couple rapproché coûte plus de couverture qu'il
                // n'apporte d'information sur les lags courts.
                let capacity = (quota[i] - 3).max(0) as usize;
                if pairs_per_maille[i] < capacity {
                    pairs_per_maille[i] += 1;
                    remaining -= 1;
                    placed_this_round = true;
                }
            }
            if !placed_this_round {
                break;
            }
            guard += 1;
        }
    }

    // Coordonnées métriques retenues, à reprojeter en une seule requête.
    let mut metric: Vec<(f64, f64)> = Vec::new();
    let mut origin: Vec<(String, &'static str)> = Vec::new();
    let mut reports: Vec<serde_json::Value> = Vec::new();

    for (idx, (p, &wanted)) in prepared.iter().zip(quota.iter()).enumerate() {
        let pairs_here = pairs_per_maille[idx];
        let lattice_wanted = wanted - pairs_here as i32;

        let (spacing, net, radius) = best_design(&p.poly, p.area, lattice_wanted).ok_or_else(|| {
            err(
                StatusCode::UNPROCESSABLE_ENTITY,
                format!("Aucun plan n'a pu être calé dans la maille {}.", p.code),
            )
        })?;

        for &(x, y) in &net {
            metric.push((x, y));
            origin.push((p.code.clone(), "reseau"));
        }

        // Couples rapprochés : compagnons des points les plus centraux, à des
        // distances très inférieures au pas (a/6 puis a/24) pour peupler les
        // lags courts du variogramme.
        let mut placed_pairs = 0usize;
        if pairs_here > 0 && !net.is_empty() {
            let cx = net.iter().map(|q| q.0).sum::<f64>() / net.len() as f64;
            let cy = net.iter().map(|q| q.1).sum::<f64>() / net.len() as f64;
            let mut central: Vec<usize> = (0..net.len()).collect();
            central.sort_by(|&a, &b| {
                let da = (net[a].0 - cx).powi(2) + (net[a].1 - cy).powi(2);
                let db = (net[b].0 - cx).powi(2) + (net[b].1 - cy).powi(2);
                da.partial_cmp(&db).unwrap_or(std::cmp::Ordering::Equal)
            });

            for (k, &idx) in central.iter().take(pairs_here).enumerate() {
                let (bx, by) = net[idx];
                let dist = if k % 2 == 0 { spacing / 6.0 } else { spacing / 24.0 };
                let bearing = std::f64::consts::FRAC_PI_6 * (k as f64 + 1.0);
                let (dx, dy) = (dist * bearing.cos(), dist * bearing.sin());
                // Direction opposée en secours : près d'un bord, le compagnon
                // peut sortir de la maille.
                let candidate = if p.poly.contains(bx + dx, by + dy) {
                    Some((bx + dx, by + dy))
                } else if p.poly.contains(bx - dx, by - dy) {
                    Some((bx - dx, by - dy))
                } else {
                    None
                };
                if let Some(c) = candidate {
                    metric.push(c);
                    origin.push((p.code.clone(), "couple_rapproche"));
                    placed_pairs += 1;
                }
            }
        }

        reports.push(json!({
            "code": p.code,
            "area_m2": p.area.round(),
            "points": net.len() + placed_pairs,
            "spacing_m": (spacing * 10.0).round() / 10.0,
            "covering_radius_m": (radius * 10.0).round() / 10.0,
            "close_pairs": placed_pairs,
        }));
    }

    if metric.is_empty() {
        return Err(err(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Aucun point n'a pu être placé dans les mailles de cette mission.",
        ));
    }

    // Reprojection en WGS84 : une seule requête pour tous les points.
    let xs: Vec<f64> = metric.iter().map(|m| m.0).collect();
    let ys: Vec<f64> = metric.iter().map(|m| m.1).collect();
    let geo = sqlx::query(
        r#"
        SELECT ST_Y(p) AS lat, ST_X(p) AS lon FROM (
            SELECT ord, ST_Transform(ST_SetSRID(ST_MakePoint(x, y), $1), 4326) AS p
            FROM unnest($2::float8[], $3::float8[]) WITH ORDINALITY AS t(x, y, ord)
        ) q ORDER BY ord
        "#,
    )
    .bind(METRIC_SRID)
    .bind(&xs)
    .bind(&ys)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    if geo.len() != metric.len() {
        return Err(err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Reprojection incomplète des points générés.",
        ));
    }

    let points: Vec<PlacedPoint> = geo
        .iter()
        .zip(origin.iter())
        .enumerate()
        .map(|(i, (row, (code, kind)))| PlacedPoint {
            numero: i as i32 + 1,
            label: format!("S{}", i + 1),
            lat: row.get("lat"),
            lon: row.get("lon"),
            maille_code: code.clone(),
            kind,
        })
        .collect();

    let mut tx = state.pool.begin().await.map_err(db_err)?;
    if replace {
        sqlx::query("DELETE FROM atlas.colab_mission_sondage_points WHERE mission_id = $1")
            .bind(mission_id)
            .execute(&mut *tx)
            .await
            .map_err(db_err)?;
    }
    for p in &points {
        let note = if p.kind == "couple_rapproche" {
            format!(
                "{} · couple rapproché (lag court, identification de l'effet de pépite)",
                p.maille_code
            )
        } else {
            format!("{} · réseau triangulaire", p.maille_code)
        };
        sqlx::query(
            r#"INSERT INTO atlas.colab_mission_sondage_points
               (mission_id, numero, label, lat, lon, notes)
               VALUES ($1, $2, $3, $4, $5, $6)"#,
        )
        .bind(mission_id)
        .bind(p.numero)
        .bind(&p.label)
        .bind(p.lat)
        .bind(p.lon)
        .bind(note)
        .execute(&mut *tx)
        .await
        .map_err(db_err)?;
    }

    // Le nombre de sondages attendus doit refléter le plan réellement posé,
    // sinon la mission affiche « 0/3 » avec neuf points sur la carte.
    sqlx::query(
        "UPDATE atlas.colab_missions SET expected_sondages = $2, updated_at = NOW() WHERE id = $1",
    )
    .bind(mission_id)
    .bind(points.len() as i32)
    .execute(&mut *tx)
    .await
    .map_err(db_err)?;

    tx.commit().await.map_err(db_err)?;

    Ok(Json(json!({
        "mission_code": mission_code,
        "generated": points.len(),
        "close_pairs": points.iter().filter(|p| p.kind == "couple_rapproche").count(),
        "design": "réseau triangulaire équilatéral (orientation et calage optimisés) + couples rapprochés",
        "mailles": reports,
        "points": points.iter().map(|p| json!({
            "numero": p.numero,
            "label": p.label,
            "lat": p.lat,
            "lon": p.lon,
            "maille_code": p.maille_code,
            "kind": p.kind,
        })).collect::<Vec<_>>(),
    })))
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Carré de 1414 m de côté ≈ 2 km², la forme réelle des mailles Atlas.
    fn carre() -> MetricPolygon {
        let v = serde_json::json!({
            "type": "Polygon",
            "coordinates": [[[0.0, 0.0], [1414.0, 0.0], [1414.0, 1414.0], [0.0, 1414.0], [0.0, 0.0]]]
        });
        MetricPolygon::from_geojson(&v).expect("polygone valide")
    }

    #[test]
    fn detecte_l_interieur_et_l_exterieur() {
        let p = carre();
        assert!(p.contains(700.0, 700.0));
        assert!(!p.contains(-1.0, 700.0));
        assert!(!p.contains(700.0, 1500.0));
    }

    #[test]
    fn ecarte_les_trous() {
        let v = serde_json::json!({
            "type": "Polygon",
            "coordinates": [
                [[0.0, 0.0], [100.0, 0.0], [100.0, 100.0], [0.0, 100.0], [0.0, 0.0]],
                [[40.0, 40.0], [60.0, 40.0], [60.0, 60.0], [40.0, 60.0], [40.0, 40.0]]
            ]
        });
        let p = MetricPolygon::from_geojson(&v).expect("polygone à trou");
        assert!(p.contains(10.0, 10.0), "hors du trou");
        assert!(!p.contains(50.0, 50.0), "dans le trou");
    }

    #[test]
    fn place_exactement_l_effectif_demande() {
        let p = carre();
        for n in [3, 6, 9, 12, 25] {
            let (_, pts, _) = super::best_design(&p, 1_999_396.0, n).expect("plan trouvé");
            assert_eq!(pts.len(), n as usize, "effectif visé pour n={n}");
            assert!(pts.iter().all(|&(x, y)| p.contains(x, y)), "tous dedans");
        }
    }

    #[test]
    fn le_calage_optimise_couvre_mieux_que_le_reseau_centre() {
        let p = carre();
        let eval = p.evaluation_grid();
        let (_, opt, radius) = super::best_design(&p, 1_999_396.0, 9).expect("plan trouvé");
        assert_eq!(opt.len(), 9);

        // Réseau simplement centré, à effectif identique.
        let a0 = (1_999_396.0f64 / (9.0 * ROW_FACTOR)).sqrt();
        let (mut lo, mut hi) = (a0 * 0.2, a0 * 5.0);
        let mut centre = Vec::new();
        for _ in 0..24 {
            let a = (lo + hi) / 2.0;
            let pts = super::lattice(&p, a, 0.0, 0.0, 0.0);
            if pts.len() as i32 >= 9 {
                centre = pts;
                lo = a;
            } else {
                hi = a;
            }
        }
        super::keep_most_central(&mut centre, 9);
        let r_centre = super::covering_radius(&centre, &eval);
        assert!(
            radius <= r_centre,
            "le calage optimisé doit couvrir au moins aussi bien : {radius:.0} m vs {r_centre:.0} m"
        );
    }

    #[test]
    fn numerote_du_nord_au_sud() {
        let mut pts = vec![(10.0, 0.0), (0.0, 100.0), (50.0, 100.0)];
        super::sort_north_to_south(&mut pts);
        assert_eq!(pts, vec![(0.0, 100.0), (50.0, 100.0), (10.0, 0.0)]);
    }

    #[test]
    fn repartit_au_prorata_des_aires() {
        assert_eq!(allocate(9, &[2e6, 2e6, 2e6]), vec![3, 3, 3]);
    }

    #[test]
    fn garantit_au_moins_un_point_par_maille() {
        let out = allocate(3, &[1e7, 1e3, 1e3]);
        assert_eq!(out.len(), 3);
        assert!(out.iter().all(|&n| n >= 1));
        assert_eq!(out.iter().sum::<i32>(), 3);
    }

    #[test]
    fn releve_le_total_si_moins_de_points_que_de_mailles() {
        assert_eq!(allocate(1, &[1.0, 1.0, 1.0]).iter().sum::<i32>(), 3);
    }

    #[test]
    fn conserve_le_total_demande() {
        assert_eq!(allocate(10, &[5e6, 3e6, 2e6]).iter().sum::<i32>(), 10);
    }
}
