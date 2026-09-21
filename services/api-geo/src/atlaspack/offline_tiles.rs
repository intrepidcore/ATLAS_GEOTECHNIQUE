//! Constructeur de fichiers MBTiles hors-ligne (OSM XYZ -> `.mbtiles` v1.3).
//!
//! Assemble, pour une ou plusieurs missions d'un opérateur (une bbox WGS84
//! par mission), un fichier MBTiles (spec 1.3 :
//! https://github.com/mapbox/mbtiles-spec/blob/master/1.3/spec.md) contenant
//! les tuiles raster nécessaires à un usage Leaflet 100% hors-ligne sur le
//! terrain.
//!
//! Pipeline : `plan_tiles` (pur, sans réseau) décide QUELLES tuiles
//! embarquer et à quel zoom max, en respectant `max_tiles` -> les tuiles
//! retenues sont récupérées une par une par HTTP -> écrites dans un fichier
//! sqlite au format MBTiles. Cette séparation calcul/récupération est
//! volontaire : elle permet de tester toute la logique de dédup et de
//! réduction de zoom sans la moindre requête réseau.

use std::collections::HashSet;
use std::path::Path;
use std::time::Duration;

use anyhow::Context;
use sqlx::{sqlite::SqliteConnectOptions, Connection, SqliteConnection};

/// Latitude max représentable en projection Web Mercator (au-delà, y diverge
/// vers l'infini). Valeur standard OSM/Google : au-delà, on "clampe" plutôt
/// que de produire un indice de tuile absurde.
const MAX_MERCATOR_LAT: f64 = 85.05112878;

/// Rayon terrestre moyen implicite dans l'approximation degré<->mètres
/// utilisée pour la marge (1° de latitude ≈ 111.32 km) — cf. exigence du
/// cahier des charges, volontairement la même approximation partout dans le
/// module pour rester cohérent avec `config.rs`.
const METERS_PER_DEGREE_LAT: f64 = 111_320.0;

/// Zoom XYZ maximal jugé raisonnable pour un fournisseur de tuiles web.
/// Sert uniquement de garde-fou contre une config aberrante (ex: zoom_max
/// à 200) qui ferait déborder les décalages binaires `2^z` utilisés pour le
/// flip TMS.
const MAX_REASONABLE_ZOOM: u8 = 24;

/// Au-delà de ce nombre de tuiles potentielles (majorant non dédupliqué), on
/// renonce à matérialiser le `HashSet` réel : pour un paquet opérateur de
/// terrain, un pic mémoire de cet ordre serait disproportionné. Le majorant
/// est alors traité comme le compte pour la décision de réduction de zoom
/// (conservateur : peut réduire le zoom un peu plus qu'une dédup parfaite ne
/// l'exigerait, mais ne prend jamais le risque d'un OOM).
const HASHSET_MATERIALIZE_GUARD: u64 = 2_000_000;

/// Configuration d'une construction de MBTiles hors-ligne.
#[derive(Debug, Clone)]
pub struct TileBuildConfig {
    /// Gabarit d'URL, ex: "https://tile.openstreetmap.org/{z}/{x}/{y}.png".
    pub tile_url_template: String,
    /// Envoyé comme en-tête `User-Agent` sur chaque requête — exigé par la
    /// politique d'usage des tuiles OSM (un user-agent de navigateur
    /// générique y expose à un bannissement).
    pub user_agent: String,
    pub zoom_min: u8,
    pub zoom_max: u8,
    pub max_tiles: u32,
    pub request_delay_ms: u64,
}

/// Résultat d'une construction de MBTiles hors-ligne.
#[derive(Debug, Clone)]
pub struct TileBuildResult {
    /// Nombre de tuiles réellement écrites dans le fichier (après échecs
    /// réseau éventuels) — pas le nombre demandé.
    pub tile_count: u32,
    /// Zoom max réellement utilisé, après réduction éventuelle.
    pub actual_zoom_max: u8,
    /// Taille du fichier `.mbtiles` sur disque, mesurée après écriture.
    pub bytes_written: u64,
    /// `true` si `actual_zoom_max < config.zoom_max` (réduction automatique).
    pub truncated: bool,
    pub truncation_reason: Option<String>,
    /// Nombre de tuiles individuelles sautées suite à un échec réseau isolé.
    pub skipped_tiles: u32,
}

/// Écrit un MBTiles **valide mais vide** (schéma + métadonnées, zéro tuile).
///
/// Cas d'usage : un opérateur dont aucune mission active n'a de maille
/// rattachée n'a aucune emprise géographique à couvrir. Faire échouer la
/// génération entière serait disproportionné — les données de mission
/// restent exploitables hors-ligne sans fond de carte. On produit donc un
/// fichier conforme à la spec plutôt que rien, pour que le format du paquet
/// (manifeste + archive) reste inchangé côté mobile.
pub async fn write_empty_mbtiles(output_path: &Path) -> anyhow::Result<TileBuildResult> {
    if let Some(parent) = output_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("création du répertoire {parent:?}"))?;
        }
    }
    let connect_options = SqliteConnectOptions::new()
        .filename(output_path)
        .create_if_missing(true);
    let mut conn = SqliteConnection::connect_with(&connect_options)
        .await
        .with_context(|| format!("ouverture sqlite {output_path:?}"))?;
    create_schema(&mut conn)
        .await
        .context("création du schéma MBTiles (metadata/tiles)")?;
    for (name, value) in [
        ("name", "offline"),
        ("type", "baselayer"),
        ("version", "1.1"),
        ("description", "Aucune emprise à couvrir — paquet sans fond de carte"),
        ("format", "png"),
    ] {
        sqlx::query("INSERT INTO metadata (name, value) VALUES (?1, ?2)")
            .bind(name)
            .bind(value)
            .execute(&mut conn)
            .await
            .with_context(|| format!("insertion metadata '{name}'"))?;
    }
    drop(conn);
    let bytes_written = std::fs::metadata(output_path)
        .map(|m| m.len())
        .unwrap_or(0);
    Ok(TileBuildResult {
        tile_count: 0,
        actual_zoom_max: 0,
        bytes_written,
        truncated: false,
        truncation_reason: Some("aucune maille rattachée aux missions".to_string()),
        skipped_tiles: 0,
    })
}

/// Construit un fichier MBTiles hors-ligne couvrant l'union des `bboxes`
/// (une par mission), avec une marge `margin_m` appliquée à chacune, sur la
/// plage de zoom de `config`, sans jamais dépasser `config.max_tiles`.
pub async fn build_mbtiles_for_bboxes(
    bboxes: &[(f64, f64, f64, f64)],
    margin_m: f64,
    config: &TileBuildConfig,
    output_path: &Path,
) -> anyhow::Result<TileBuildResult> {
    anyhow::ensure!(
        config.zoom_min <= config.zoom_max,
        "zoom_min ({}) doit être <= zoom_max ({})",
        config.zoom_min,
        config.zoom_max
    );
    anyhow::ensure!(
        config.zoom_max <= MAX_REASONABLE_ZOOM,
        "zoom_max ({}) dépasse le maximum raisonnable ({}) pour des tuiles XYZ",
        config.zoom_max,
        MAX_REASONABLE_ZOOM
    );
    validate_bboxes(bboxes)?;

    // Étape 1 (pure, sans réseau) : décider quelles tuiles embarquer et à
    // quel zoom max, en respectant le budget `max_tiles`.
    let plan = plan_tiles(
        bboxes,
        margin_m,
        config.zoom_min,
        config.zoom_max,
        config.max_tiles,
    )
    .context("planification de la couverture de tuiles hors-ligne")?;

    let global_bounds = union_expanded_bounds(bboxes, margin_m)?;

    // Ordre stable (z, x, y) : logs plus lisibles, et écritures sqlite
    // globalement plus séquentielles que dans l'ordre d'itération d'un
    // HashSet (non déterministe).
    let mut tiles: Vec<(u8, u32, u32)> = plan.tiles.into_iter().collect();
    tiles.sort_unstable();

    if let Some(parent) = output_path.parent() {
        if !parent.as_os_str().is_empty() {
            std::fs::create_dir_all(parent)
                .with_context(|| format!("création du répertoire {parent:?}"))?;
        }
    }
    // sqlite refuse de recréer un schéma sur un fichier existant incompatible :
    // repartir d'un fichier propre à chaque (re)génération de paquet.
    if output_path.exists() {
        std::fs::remove_file(output_path)
            .with_context(|| format!("suppression du .mbtiles existant {output_path:?}"))?;
    }

    // sqlx (backend "sqlite") plutôt que rusqlite : le projet dépend déjà de
    // sqlx pour Postgres, et rusqlite entrait en conflit Cargo `links =
    // "sqlite3"` avec `sqlx-sqlite` (deux crates ne peuvent pas fournir la
    // même bibliothèque native dans un même graphe de dépendances, même si
    // l'une des deux n'est qu'optionnelle) — une seule bibliothèque sqlite
    // dans le graphe, pas deux.
    let connect_options = SqliteConnectOptions::new()
        .filename(output_path)
        .create_if_missing(true);
    let mut conn = SqliteConnection::connect_with(&connect_options)
        .await
        .with_context(|| format!("ouverture sqlite {output_path:?}"))?;
    create_schema(&mut conn)
        .await
        .context("création du schéma MBTiles (metadata/tiles)")?;

    // Étape 2 : récupération réseau, tuile par tuile, avec throttling.
    let client = reqwest::Client::builder()
        .user_agent(config.user_agent.clone())
        .build()
        .context("construction du client HTTP de récupération de tuiles")?;

    let mut fetched: Vec<(u8, u32, u32, Vec<u8>)> = Vec::with_capacity(tiles.len());
    let mut skipped_tiles: u32 = 0;

    for (i, &(z, x, y)) in tiles.iter().enumerate() {
        // Délai AVANT chaque requête sauf la toute première : espace les
        // appels sans ajouter d'attente inutile en tête ou en fin de boucle.
        if i > 0 && config.request_delay_ms > 0 {
            tokio::time::sleep(Duration::from_millis(config.request_delay_ms)).await;
        }
        match fetch_tile(&client, &config.tile_url_template, z, x, y).await {
            Ok(bytes) => fetched.push((z, x, y, bytes)),
            Err(err) => {
                // Une tuile manquante (404, timeout, réponse vide) ne doit
                // jamais faire échouer tout le paquet : le terrain hors-ligne
                // avec un trou de couverture reste largement préférable à
                // aucun paquet du tout.
                tracing::warn!(
                    zoom = z,
                    x,
                    y,
                    error = %err,
                    "tuile hors-ligne ignorée après échec de récupération"
                );
                skipped_tiles += 1;
            }
        }
    }

    let tile_count = fetched.len() as u32;
    let attribution = attribution_from_url(&config.tile_url_template);

    write_tiles(
        &mut conn,
        &fetched,
        config.zoom_min,
        plan.zoom_max,
        global_bounds,
        &attribution,
    )
    .await
    .context("écriture des tuiles dans le fichier MBTiles")?;

    // Ferme proprement la connexion (checkpoint WAL -> fichier unique) avant
    // de mesurer la taille finale : un lecteur MBTiles n'attend qu'UN seul
    // fichier, pas un `.mbtiles` + `-wal`/`-shm` à côté.
    conn.close().await.context("fermeture de la connexion sqlite")?;

    let bytes_written = std::fs::metadata(output_path)
        .with_context(|| format!("lecture de la taille du fichier {output_path:?}"))?
        .len();

    Ok(TileBuildResult {
        tile_count,
        actual_zoom_max: plan.zoom_max,
        bytes_written,
        truncated: plan.truncated,
        truncation_reason: plan.truncation_reason,
        skipped_tiles,
    })
}

// ============================================================================
// Planification (pure, testable sans réseau)
// ============================================================================

#[derive(Debug)]
struct TilePlan {
    zoom_max: u8,
    tiles: HashSet<(u8, u32, u32)>,
    truncated: bool,
    truncation_reason: Option<String>,
}

/// Décide, sans le moindre appel réseau, quelles tuiles (z,x,y) embarquer et
/// à quel `zoom_max` effectif, en réduisant `zoom_max` niveau par niveau tant
/// que le total (dédupliqué entre missions et entre niveaux voisins) dépasse
/// `max_tiles`. N'échoue que si même `zoom_min` seul dépasse déjà le budget —
/// dans ce cas, aucune réduction de zoom ne peut plus aider : c'est à
/// l'appelant de revoir la couverture demandée ou la limite.
fn plan_tiles(
    bboxes: &[(f64, f64, f64, f64)],
    margin_m: f64,
    zoom_min: u8,
    zoom_max_requested: u8,
    max_tiles: u32,
) -> anyhow::Result<TilePlan> {
    anyhow::ensure!(!bboxes.is_empty(), "au moins une bbox est requise");
    anyhow::ensure!(
        zoom_min <= zoom_max_requested,
        "zoom_min ({zoom_min}) doit être <= zoom_max ({zoom_max_requested})"
    );

    let mut zoom_max = zoom_max_requested;
    loop {
        if let Some(tiles) = try_tile_set_within_budget(bboxes, margin_m, zoom_min, zoom_max, max_tiles) {
            let truncated = zoom_max < zoom_max_requested;
            let truncation_reason = truncated.then(|| {
                let needed = tile_count_upper_bound(bboxes, margin_m, zoom_min, zoom_max_requested);
                format!(
                    "zoom réduit de {zoom_max_requested} à {zoom_max} : {needed} tuiles nécessaires au zoom {zoom_max_requested} demandé > limite {max_tiles}"
                )
            });
            return Ok(TilePlan {
                zoom_max,
                tiles,
                truncated,
                truncation_reason,
            });
        }

        if zoom_max == zoom_min {
            let needed = tile_count_upper_bound(bboxes, margin_m, zoom_min, zoom_min);
            anyhow::bail!(
                "impossible de générer le paquet hors-ligne : le zoom minimal ({zoom_min}) nécessite déjà au moins {needed} tuiles, au-delà de la limite {max_tiles} — réduisez la couverture, la marge, ou augmentez max_tiles"
            );
        }
        zoom_max -= 1;
    }
}

/// Tente de construire l'ensemble dédupliqué des tuiles nécessaires pour
/// `zoom_min..=zoom_max` et retourne `Some(set)` seulement s'il tient dans
/// `max_tiles`. Utilise d'abord un majorant O(1) (somme non dédupliquée,
/// `tile_count_upper_bound`) comme garde-fou mémoire : au-delà de
/// `HASHSET_MATERIALIZE_GUARD`, on ne matérialise jamais le `HashSet` réel.
fn try_tile_set_within_budget(
    bboxes: &[(f64, f64, f64, f64)],
    margin_m: f64,
    zoom_min: u8,
    zoom_max: u8,
    max_tiles: u32,
) -> Option<HashSet<(u8, u32, u32)>> {
    let upper_bound = tile_count_upper_bound(bboxes, margin_m, zoom_min, zoom_max);
    if upper_bound <= max_tiles as u64 {
        // Le majorant (somme sans dédup) borne le compte réel par le haut :
        // s'il tient déjà dans le budget, le compte dédupliqué (toujours
        // <= majorant) y tient forcément aussi — pas besoin de matérialiser
        // le HashSet pour le savoir.
        return Some(tile_set_for_bboxes(bboxes, margin_m, zoom_min, zoom_max));
    }
    if upper_bound > HASHSET_MATERIALIZE_GUARD {
        return None;
    }
    let tiles = tile_set_for_bboxes(bboxes, margin_m, zoom_min, zoom_max);
    if tiles.len() as u64 <= max_tiles as u64 {
        Some(tiles)
    } else {
        None
    }
}

/// Ensemble dédupliqué des tuiles (z,x,y) couvrant l'union de toutes les
/// bbox (avec marge) sur `zoom_min..=zoom_max`. Le `HashSet` élimine
/// naturellement les tuiles partagées entre deux missions voisines ou qui se
/// chevauchent.
fn tile_set_for_bboxes(
    bboxes: &[(f64, f64, f64, f64)],
    margin_m: f64,
    zoom_min: u8,
    zoom_max: u8,
) -> HashSet<(u8, u32, u32)> {
    let mut set = HashSet::new();
    for bbox in bboxes {
        let expanded = expand_bbox_with_margin(*bbox, margin_m);
        for z in zoom_min..=zoom_max {
            for (x, y) in tiles_for_bbox_at_zoom(expanded, z) {
                set.insert((z, x, y));
            }
        }
    }
    set
}

/// Majorant O(1) (sans allocation) du nombre de tuiles nécessaires sur
/// `zoom_min..=zoom_max` : somme, PAS union, des rectangles de tuiles de
/// chaque bbox à chaque niveau. Toujours >= au compte réel dédupliqué — sert
/// de garde-fou mémoire avant de matérialiser un `HashSet` potentiellement
/// énorme.
fn tile_count_upper_bound(
    bboxes: &[(f64, f64, f64, f64)],
    margin_m: f64,
    zoom_min: u8,
    zoom_max: u8,
) -> u64 {
    let mut total: u64 = 0;
    for bbox in bboxes {
        for z in zoom_min..=zoom_max {
            total = total.saturating_add(count_tiles_for_bbox_at_zoom(*bbox, margin_m, z));
        }
    }
    total
}

/// Nombre de tuiles nécessaires pour couvrir UNE bbox (avec marge) à UN
/// niveau de zoom donné. Fonction pure, sans I/O — c'est le brique de base
/// testée indépendamment de tout réseau.
fn count_tiles_for_bbox_at_zoom(bbox: (f64, f64, f64, f64), margin_m: f64, z: u8) -> u64 {
    let expanded = expand_bbox_with_margin(bbox, margin_m);
    let (x_min, y_min, x_max, y_max) = tile_range_for_bbox_at_zoom(expanded, z);
    (x_max - x_min + 1) as u64 * (y_max - y_min + 1) as u64
}

/// Ensemble des tuiles (x,y) couvrant une bbox déjà marginée, à un zoom fixé.
fn tiles_for_bbox_at_zoom(bbox: (f64, f64, f64, f64), z: u8) -> HashSet<(u32, u32)> {
    let (x_min, y_min, x_max, y_max) = tile_range_for_bbox_at_zoom(bbox, z);
    let mut set =
        HashSet::with_capacity(((x_max - x_min + 1) as usize) * ((y_max - y_min + 1) as usize));
    for x in x_min..=x_max {
        for y in y_min..=y_max {
            set.insert((x, y));
        }
    }
    set
}

/// Rectangle d'indices de tuiles [x_min,x_max] x [y_min,y_max] couvrant une
/// bbox déjà marginée, à un zoom fixé.
fn tile_range_for_bbox_at_zoom(bbox: (f64, f64, f64, f64), z: u8) -> (u32, u32, u32, u32) {
    let (min_lon, min_lat, max_lon, max_lat) = bbox;
    // Coin nord-ouest (longitude min, latitude max) -> (x_min, y_min) :
    // l'axe y d'une tuile XYZ croît vers le sud, donc "y_min" est en haut.
    let (x_min, y_min) = lonlat_to_tile(min_lon, max_lat, z);
    let (x_max, y_max) = lonlat_to_tile(max_lon, min_lat, z);
    (x_min, y_min, x_max, y_max)
}

/// Convertit lon/lat WGS84 en indices de tuile slippy-map (x,y) au niveau de
/// zoom `z`, selon la formule standard Web Mercator (EPSG:3857) — cf. OSM
/// wiki "Slippy map tilenames".
fn lonlat_to_tile(lon: f64, lat: f64, z: u8) -> (u32, u32) {
    let lat = lat.clamp(-MAX_MERCATOR_LAT, MAX_MERCATOR_LAT);
    let lon = lon.clamp(-180.0, 180.0);
    let n = 2f64.powi(z as i32);
    let lat_rad = lat.to_radians();
    let x = ((lon + 180.0) / 360.0 * n).floor();
    let y = ((1.0 - (lat_rad.tan() + 1.0 / lat_rad.cos()).ln() / std::f64::consts::PI) / 2.0 * n)
        .floor();
    // Clamp final : aux bornes exactes (±180°, ±MAX_MERCATOR_LAT), les
    // arrondis flottants peuvent faire tomber l'indice pile sur `n` au lieu
    // de `n-1` (dernier indice valide).
    let max_index = (n as u32).saturating_sub(1);
    (x.clamp(0.0, max_index as f64) as u32, y.clamp(0.0, max_index as f64) as u32)
}

/// Inversion TMS : MBTiles stocke `tile_row` selon le schéma TMS (origine en
/// bas, sud), alors que le calcul slippy-map ci-dessus produit un `y` en
/// schéma XYZ (origine en haut, nord) — les deux schémas sont utilisés côte
/// à côte par l'écosystème et ne sont PAS interchangeables. Sans ce flip,
/// n'importe quel lecteur MBTiles standard affiche les tuiles inversées
/// verticalement. Formule spec MBTiles 1.3 : `tms_y = (2^z - 1) - xyz_y`.
fn tms_row_from_xyz(z: u8, xyz_y: u32) -> u32 {
    let n = 1u32 << z; // 2^z ; z borné par MAX_REASONABLE_ZOOM donc pas de dépassement
    (n - 1) - xyz_y
}

/// Étend une bbox WGS84 d'une marge en mètres, convertie en degrés par
/// l'approximation standard : 1° de latitude ≈ 111.32 km partout, et 1° de
/// longitude ≈ 111.32 km × cos(latitude du centre) (la longueur d'un degré
/// de longitude rétrécit en s'éloignant de l'équateur).
fn expand_bbox_with_margin(
    bbox: (f64, f64, f64, f64),
    margin_m: f64,
) -> (f64, f64, f64, f64) {
    let (min_lon, min_lat, max_lon, max_lat) = bbox;
    let center_lat = (min_lat + max_lat) / 2.0;
    let lat_margin_deg = margin_m / METERS_PER_DEGREE_LAT;
    // Garde-fou : cos(latitude) tend vers 0 près des pôles, ce qui ferait
    // exploser la marge en longitude. Un usage géotechnique de terrain ne
    // s'approche jamais des pôles ; ce plancher évite juste une division
    // par (quasi) zéro sur une entrée aberrante.
    let cos_center = center_lat.to_radians().cos().max(1e-6);
    let lon_margin_deg = margin_m / (METERS_PER_DEGREE_LAT * cos_center);
    (
        min_lon - lon_margin_deg,
        min_lat - lat_margin_deg,
        max_lon + lon_margin_deg,
        max_lat + lat_margin_deg,
    )
}

/// Union des bbox (chacune marginée individuellement) — utilisée pour le
/// champ `bounds` des métadonnées MBTiles.
fn union_expanded_bounds(
    bboxes: &[(f64, f64, f64, f64)],
    margin_m: f64,
) -> anyhow::Result<(f64, f64, f64, f64)> {
    anyhow::ensure!(!bboxes.is_empty(), "au moins une bbox est requise");
    let mut expanded = bboxes.iter().map(|b| expand_bbox_with_margin(*b, margin_m));
    let mut acc = expanded.next().expect("non vide, vérifié ci-dessus");
    for b in expanded {
        acc.0 = acc.0.min(b.0);
        acc.1 = acc.1.min(b.1);
        acc.2 = acc.2.max(b.2);
        acc.3 = acc.3.max(b.3);
    }
    Ok(acc)
}

fn validate_bboxes(bboxes: &[(f64, f64, f64, f64)]) -> anyhow::Result<()> {
    anyhow::ensure!(!bboxes.is_empty(), "au moins une bbox est requise");
    for (i, &(min_lon, min_lat, max_lon, max_lat)) in bboxes.iter().enumerate() {
        anyhow::ensure!(
            min_lon < max_lon && min_lat < max_lat,
            "bbox #{i} invalide ({min_lon},{min_lat},{max_lon},{max_lat}) : min doit être < max"
        );
        anyhow::ensure!(
            (-180.0..=180.0).contains(&min_lon) && (-180.0..=180.0).contains(&max_lon),
            "bbox #{i} : longitude hors de [-180,180]"
        );
        anyhow::ensure!(
            (-90.0..=90.0).contains(&min_lat) && (-90.0..=90.0).contains(&max_lat),
            "bbox #{i} : latitude hors de [-90,90]"
        );
    }
    Ok(())
}

// ============================================================================
// Récupération réseau
// ============================================================================

async fn fetch_tile(
    client: &reqwest::Client,
    url_template: &str,
    z: u8,
    x: u32,
    y: u32,
) -> anyhow::Result<Vec<u8>> {
    let url = url_template
        .replace("{z}", &z.to_string())
        .replace("{x}", &x.to_string())
        .replace("{y}", &y.to_string());

    let resp = client
        .get(&url)
        .send()
        .await
        .with_context(|| format!("requête GET {url}"))?;

    if !resp.status().is_success() {
        anyhow::bail!("statut HTTP {} pour {url}", resp.status());
    }

    let bytes = resp
        .bytes()
        .await
        .with_context(|| format!("lecture du corps de réponse pour {url}"))?;

    if bytes.is_empty() {
        anyhow::bail!("contenu vide pour {url}");
    }

    Ok(bytes.to_vec())
}

/// Déduit un libellé d'attribution lisible depuis le gabarit d'URL des
/// tuiles, plutôt qu'une chaîne figée en dur : si demain `tile_url_template`
/// pointe vers un autre fournisseur que OSM, l'attribution du MBTiles généré
/// suit automatiquement.
fn attribution_from_url(url_template: &str) -> String {
    let host = url_template
        .split("://")
        .nth(1)
        .and_then(|rest| rest.split('/').next())
        .filter(|h| !h.is_empty())
        .unwrap_or(url_template);
    format!("© contributeurs {host}")
}

// ============================================================================
// Écriture MBTiles (sqlx backend "sqlite", spec 1.3)
// ============================================================================

async fn create_schema(conn: &mut SqliteConnection) -> anyhow::Result<()> {
    sqlx::query(
        "CREATE TABLE metadata (name text, value text);
         CREATE TABLE tiles (zoom_level integer, tile_column integer, tile_row integer, tile_data blob);
         CREATE UNIQUE INDEX tile_index ON tiles (zoom_level, tile_column, tile_row);",
    )
    .execute(&mut *conn)
    .await
    .context("création du schéma metadata/tiles")?;
    Ok(())
}

async fn write_tiles(
    conn: &mut SqliteConnection,
    fetched: &[(u8, u32, u32, Vec<u8>)],
    zoom_min: u8,
    zoom_max: u8,
    bounds: (f64, f64, f64, f64),
    attribution: &str,
) -> anyhow::Result<()> {
    // Transaction unique pour tout le lot : sqlite est nettement plus lent en
    // autocommit ligne par ligne pour plusieurs milliers de tuiles.
    let mut tx = conn.begin().await.context("ouverture de la transaction sqlite")?;

    let (min_lon, min_lat, max_lon, max_lat) = bounds;
    let rows: [(&str, String); 9] = [
        ("name", "Atlas Terrain — tuiles hors-ligne".to_string()),
        ("format", "png".to_string()),
        ("type", "baselayer".to_string()),
        ("version", "1.1".to_string()),
        (
            "description",
            "Paquet de tuiles raster hors-ligne généré par api-geo/atlaspack".to_string(),
        ),
        ("bounds", format!("{min_lon},{min_lat},{max_lon},{max_lat}")),
        ("minzoom", zoom_min.to_string()),
        ("maxzoom", zoom_max.to_string()),
        ("attribution", attribution.to_string()),
    ];
    for (name, value) in rows {
        sqlx::query("INSERT INTO metadata (name, value) VALUES (?1, ?2)")
            .bind(name)
            .bind(&value)
            .execute(&mut *tx)
            .await
            .with_context(|| format!("insertion metadata '{name}'"))?;
    }

    for (z, x, y, data) in fetched {
        let tms_row = tms_row_from_xyz(*z, *y);
        sqlx::query(
            "INSERT INTO tiles (zoom_level, tile_column, tile_row, tile_data) VALUES (?1, ?2, ?3, ?4)",
        )
        .bind(*z as i64)
        .bind(*x as i64)
        .bind(tms_row as i64)
        .bind(data.as_slice())
        .execute(&mut *tx)
        .await
        .with_context(|| format!("insertion tuile z={z} x={x} y={y}"))?;
    }

    tx.commit().await.context("commit de la transaction sqlite")?;
    Ok(())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    // --- lonlat_to_tile -----------------------------------------------------

    #[test]
    fn lonlat_to_tile_reference_values() {
        // (0,0) au zoom 0 : une seule tuile (0,0) couvre toute la planète.
        assert_eq!(lonlat_to_tile(0.0, 0.0, 0), (0, 0));
        // (0,0) est le centre exact de la grille 2x2 au zoom 1 -> tuile (1,1).
        assert_eq!(lonlat_to_tile(0.0, 0.0, 1), (1, 1));
        // Coin nord-ouest exact (longitude min, latitude Mercator max) au
        // zoom 2 -> première tuile de la grille 4x4.
        assert_eq!(lonlat_to_tile(-180.0, MAX_MERCATOR_LAT, 2), (0, 0));
        // Coin sud-est exact -> dernière tuile de la grille 4x4 (symétrie de
        // la projection Mercator autour de l'équateur).
        assert_eq!(lonlat_to_tile(180.0, -MAX_MERCATOR_LAT, 2), (3, 3));
    }

    // --- flip TMS -------------------------------------------------------------

    #[test]
    fn tms_row_flip_is_correct() {
        assert_eq!(tms_row_from_xyz(0, 0), 0); // n=1 : seule tuile, inchangée
        assert_eq!(tms_row_from_xyz(1, 0), 1); // n=2 : (2-1)-0=1
        assert_eq!(tms_row_from_xyz(1, 1), 0); // (2-1)-1=0
        assert_eq!(tms_row_from_xyz(3, 0), 7); // n=8 : rangée du haut (XYZ) -> bas (TMS)
        assert_eq!(tms_row_from_xyz(3, 7), 0); // rangée du bas (XYZ) -> haut (TMS)
        assert_eq!(tms_row_from_xyz(3, 4), 3);
    }

    // --- comptage pur, sans réseau --------------------------------------------

    #[test]
    fn count_tiles_for_bbox_matches_manual_range() {
        let bbox = (2.0, 48.5, 2.5, 49.0);
        let count = count_tiles_for_bbox_at_zoom(bbox, 0.0, 10);
        let (x_min, y_min) = lonlat_to_tile(2.0, 49.0, 10);
        let (x_max, y_max) = lonlat_to_tile(2.5, 48.5, 10);
        let expected = (x_max - x_min + 1) as u64 * (y_max - y_min + 1) as u64;
        assert_eq!(count, expected);
        assert!(count >= 1);
    }

    #[test]
    fn margin_never_decreases_tile_count() {
        let bbox = (2.0, 48.5, 2.05, 48.55);
        let no_margin = count_tiles_for_bbox_at_zoom(bbox, 0.0, 14);
        let with_margin = count_tiles_for_bbox_at_zoom(bbox, 2_000.0, 14);
        assert!(with_margin >= no_margin);
    }

    // --- déduplication multi-missions -----------------------------------------

    #[test]
    fn overlapping_bboxes_deduplicate_tiles() {
        let bbox_a = (2.0, 48.0, 2.5, 48.5);
        let bbox_b = (2.2, 48.1, 2.7, 48.6); // chevauche bbox_a
        let z = 10;

        let set_a = tiles_for_bbox_at_zoom(bbox_a, z);
        let set_b = tiles_for_bbox_at_zoom(bbox_b, z);
        let naive_sum = set_a.len() + set_b.len();

        let union_via_dedup = tile_set_for_bboxes(&[bbox_a, bbox_b], 0.0, z, z);

        assert!(
            union_via_dedup.len() < naive_sum,
            "les tuiles communes aux deux bbox doivent être dédupliquées (union={}, somme naïve={naive_sum})",
            union_via_dedup.len()
        );

        let mut manual_union: HashSet<(u32, u32)> = set_a;
        manual_union.extend(set_b);
        assert_eq!(union_via_dedup.len(), manual_union.len());
    }

    // --- planification / réduction de zoom (aucun réseau) --------------------

    #[test]
    fn plan_tiles_reduces_zoom_when_over_budget() {
        // Bbox assez grande pour qu'à zoom 15 elle nécessite largement plus
        // de 50 tuiles, mais qu'à zoom 5 elle en nécessite très peu.
        let bboxes = [(2.0, 48.0, 3.0, 49.0)];
        let max_tiles = 50;

        let plan = plan_tiles(&bboxes, 0.0, 5, 15, max_tiles)
            .expect("doit réussir en réduisant le zoom, pas échouer");

        assert!(
            plan.zoom_max < 15,
            "le zoom aurait dû être réduit sous la limite, obtenu {}",
            plan.zoom_max
        );
        assert!(plan.zoom_max >= 5);
        assert!(plan.tiles.len() as u32 <= max_tiles);
        assert!(plan.truncated);
        assert!(plan.truncation_reason.is_some());
    }

    #[test]
    fn plan_tiles_keeps_requested_zoom_when_within_budget() {
        // Bbox minuscule (une poignée de tuiles même à zoom 14) et budget large.
        let bboxes = [(2.0, 48.0, 2.01, 48.01)];
        let plan = plan_tiles(&bboxes, 0.0, 10, 14, 10_000).expect("doit réussir sans réduction");
        assert_eq!(plan.zoom_max, 14);
        assert!(!plan.truncated);
        assert!(plan.truncation_reason.is_none());
    }

    #[test]
    fn plan_tiles_errors_when_even_min_zoom_exceeds_budget() {
        let bboxes = [(2.0, 48.0, 3.0, 49.0)];
        // Budget nul : même la seule tuile du zoom minimal (5) le dépasse.
        let err = plan_tiles(&bboxes, 0.0, 5, 15, 0).unwrap_err();
        let msg = err.to_string();
        assert!(
            msg.contains("zoom minimal"),
            "le message d'erreur doit expliquer clairement la cause, obtenu: {msg}"
        );
    }

    // --- validation des bbox ----------------------------------------------------

    #[test]
    fn validate_bboxes_rejects_inverted_bbox() {
        let bad = [(3.0, 48.0, 2.0, 49.0)]; // min_lon > max_lon
        assert!(validate_bboxes(&bad).is_err());
    }

    #[test]
    fn validate_bboxes_accepts_normal_bbox() {
        let ok = [(2.0, 48.0, 3.0, 49.0)];
        assert!(validate_bboxes(&ok).is_ok());
    }

    // --- attribution déduite de l'URL, pas figée en dur -----------------------

    #[test]
    fn attribution_is_derived_from_url_not_hardcoded() {
        let osm = attribution_from_url("https://tile.openstreetmap.org/{z}/{x}/{y}.png");
        assert!(osm.contains("tile.openstreetmap.org"));

        let other = attribution_from_url("https://tiles.example-provider.net/{z}/{x}/{y}.png");
        assert!(other.contains("tiles.example-provider.net"));
        assert_ne!(osm, other);
    }
}
