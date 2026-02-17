// ============================================================================
// Parser XLSX multi-feuilles pour import géotechnique complet
// ============================================================================

use anyhow::{Context, Result};
use calamine::{open_workbook_from_rs, DataType, Reader, Xlsx};
use std::collections::HashMap;
use std::io::Read;

fn normalize_code_site(raw: &str) -> Option<String> {
    let mut s = raw.trim().to_string();
    if s.is_empty() {
        return None;
    }

    // Harmoniser séparateurs
    s = s.replace([' ', '-'], "_");
    s = s.to_uppercase();

    // Supprimer suffixes canonisation
    for suffix in ["_S1", "-S1"] {
        if s.ends_with(suffix) {
            s = s.trim_end_matches(suffix).to_string();
        }
    }

    // Artefact (vu dans certains fichiers canonisés)
    if s == "GRANULO" {
        return None;
    }

    // Corrections ponctuelles
    if s == "NASSABL" {
        s = "NASSABLE".to_string();
    }

    Some(s)
}

#[derive(Debug, Clone)]
pub struct XlsxImportData {
    pub sondages: Vec<SondageRow>,
    pub echantillons: Vec<EchantillonRow>,
    pub atterberg: Vec<AtterbergRow>,
    pub vbs: Vec<VbsRow>,
    pub proctor: Vec<ProctorRow>,
    pub granulo_tamisage_large: Option<GranuloLargeSheet>,
    pub granulo_sedimento_large: Option<GranuloLargeSheet>,
    pub granulo_points: Vec<GranuloPointRow>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct SondageRow {
    pub code_site: String,
    pub localite: Option<String>,
    pub date: Option<String>,
    pub lat: Option<f64>,
    pub lon: Option<f64>,
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    pub source: Option<String>,
}

#[derive(Debug, Clone)]
#[allow(dead_code)]
pub struct EchantillonRow {
    pub code_site: String,
    pub depth_m: f64,
    pub date: Option<String>,
    pub laboratory: Option<String>,
    pub norm: Option<String>,
    pub rho_s_gcm3: Option<f64>,
    pub water_content_w: Option<f64>,
    pub is_index: Option<f64>,
    pub eg: Option<f64>,
    pub commentaire: Option<String>,
}

#[derive(Debug, Clone)]
pub struct AtterbergRow {
    pub code_site: String,
    pub depth_m: f64,
    pub wl: Option<f64>,
    pub wp: Option<f64>,
}

#[derive(Debug, Clone)]
pub struct VbsRow {
    pub code_site: String,
    pub depth_m: f64,
    pub vbs: f64,
    pub commentaire: Option<String>,
}

#[derive(Debug, Clone)]
pub struct ProctorRow {
    pub code_site: String,
    pub depth_m: f64,
    pub proctor_type: String, // "normal" ou "modifie"
    pub gamma_d_max: f64,
    pub w_opt: f64,
}

#[derive(Debug, Clone)]
pub struct GranuloLargeSheet {
    pub method: String, // "tamisage" ou "sedimento"
    pub sieve_mm: Vec<f64>,
    pub samples: HashMap<String, Vec<Option<f64>>>, // key = "code_site@depth_m"
}

#[derive(Debug, Clone)]
pub struct GranuloPointRow {
    pub code_site: String,
    pub depth_m: f64,
    pub method: String,
    pub sieve_mm: f64,
    pub passing_pct: f64,
}

// ============================================================================
// Parser principal
// ============================================================================

pub fn parse_xlsx_multisheet<R: Read + std::io::Seek>(reader: R) -> Result<XlsxImportData> {
    let mut workbook: Xlsx<_> =
        open_workbook_from_rs(reader).context("Impossible d'ouvrir le fichier XLSX")?;

    let sheet_names: Vec<String> = workbook.sheet_names().to_vec();

    let mut data = XlsxImportData {
        sondages: Vec::new(),
        echantillons: Vec::new(),
        atterberg: Vec::new(),
        vbs: Vec::new(),
        proctor: Vec::new(),
        granulo_tamisage_large: None,
        granulo_sedimento_large: None,
        granulo_points: Vec::new(),
    };

    // Parser chaque feuille selon son nom
    for sheet_name in &sheet_names {
        let sheet_lower = sheet_name.to_lowercase();

        if sheet_lower == "sondages" {
            data.sondages = parse_sondages_sheet(&mut workbook, sheet_name)?;
        } else if sheet_lower == "echantillons" {
            data.echantillons = parse_echantillons_sheet(&mut workbook, sheet_name)?;
        } else if sheet_lower == "atterberg" {
            data.atterberg = parse_atterberg_sheet(&mut workbook, sheet_name)?;
        } else if sheet_lower == "vbs" {
            data.vbs = parse_vbs_sheet(&mut workbook, sheet_name)?;
        } else if sheet_lower == "proctor" {
            data.proctor = parse_proctor_sheet(&mut workbook, sheet_name)?;
        } else if sheet_lower == "granulo_tamisage_large" {
            data.granulo_tamisage_large = Some(parse_granulo_large_sheet(
                &mut workbook,
                sheet_name,
                "tamisage",
            )?);
        } else if sheet_lower == "granulo_sedimento_large" {
            data.granulo_sedimento_large = Some(parse_granulo_large_sheet(
                &mut workbook,
                sheet_name,
                "sedimento",
            )?);
        } else if sheet_lower == "granulo_points" {
            data.granulo_points = parse_granulo_points_sheet(&mut workbook, sheet_name)?;
        } else if sheet_lower == "granulo" {
            // Format long canonisé (code_site, depth_m, sieve_mm, passing_pct, method)
            data.granulo_points = parse_granulo_points_sheet(&mut workbook, sheet_name)?;
        }
    }

    Ok(data)
}

// ============================================================================
// Parsers de feuilles individuelles
// ============================================================================

fn parse_sondages_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
) -> Result<Vec<SondageRow>> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille sondages introuvable"))?;

    let mut rows = Vec::new();
    let mut headers: HashMap<String, usize> = HashMap::new();

    // Lire les entêtes (ligne 0)
    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if let Some(header) = cell.as_string() {
                headers.insert(header.to_lowercase(), idx);
            }
        }
    }

    // Lire les données (lignes 1+)
    for (row_idx, row) in range.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let code_site_raw = get_string_cell(row, &headers, "code_site")
            .context(format!("code_site manquant ligne {}", row_idx + 1))?;
        let Some(code_site) = normalize_code_site(&code_site_raw) else {
            continue;
        };

        rows.push(SondageRow {
            code_site,
            localite: get_string_cell(row, &headers, "localite"),
            date: get_string_cell(row, &headers, "date"),
            lat: get_float_cell(row, &headers, "lat"),
            lon: get_float_cell(row, &headers, "lon"),
            adm1: get_string_cell(row, &headers, "adm1"),
            adm2: get_string_cell(row, &headers, "adm2"),
            adm3: get_string_cell(row, &headers, "adm3"),
            source: get_string_cell(row, &headers, "source"),
        });
    }

    Ok(rows)
}

fn parse_echantillons_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
) -> Result<Vec<EchantillonRow>> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille echantillons introuvable"))?;

    let mut rows = Vec::new();
    let mut headers: HashMap<String, usize> = HashMap::new();

    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if let Some(header) = cell.as_string() {
                headers.insert(header.to_lowercase(), idx);
            }
        }
    }

    for (row_idx, row) in range.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let code_site_raw = get_string_cell(row, &headers, "code_site")
            .context(format!("code_site manquant ligne {}", row_idx + 1))?;
        let Some(code_site) = normalize_code_site(&code_site_raw) else {
            continue;
        };
        let depth_m = get_float_cell(row, &headers, "depth_m")
            .context(format!("depth_m manquant ligne {}", row_idx + 1))?;

        rows.push(EchantillonRow {
            code_site,
            depth_m,
            date: get_string_cell(row, &headers, "date"),
            laboratory: get_string_cell(row, &headers, "laboratory"),
            norm: get_string_cell(row, &headers, "norm"),
            rho_s_gcm3: get_float_cell(row, &headers, "rho_s_gcm3"),
            water_content_w: get_float_cell(row, &headers, "water_content_w"),
            is_index: get_float_cell(row, &headers, "is_index"),
            eg: get_float_cell(row, &headers, "eg"),
            commentaire: get_string_cell(row, &headers, "commentaire"),
        });
    }

    Ok(rows)
}

fn parse_atterberg_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
) -> Result<Vec<AtterbergRow>> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille atterberg introuvable"))?;

    let mut rows = Vec::new();
    let mut headers: HashMap<String, usize> = HashMap::new();

    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if let Some(header) = cell.as_string() {
                headers.insert(header.to_lowercase(), idx);
            }
        }
    }

    for (row_idx, row) in range.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let code_site_raw = get_string_cell(row, &headers, "code_site")
            .context(format!("code_site manquant ligne {}", row_idx + 1))?;
        let Some(code_site) = normalize_code_site(&code_site_raw) else {
            continue;
        };
        let depth_m = get_float_cell(row, &headers, "depth_m")
            .context(format!("depth_m manquant ligne {}", row_idx + 1))?;

        rows.push(AtterbergRow {
            code_site,
            depth_m,
            wl: get_float_cell(row, &headers, "wl"),
            wp: get_float_cell(row, &headers, "wp"),
        });
    }

    Ok(rows)
}

fn parse_vbs_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
) -> Result<Vec<VbsRow>> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille vbs introuvable"))?;

    let mut rows = Vec::new();
    let mut headers: HashMap<String, usize> = HashMap::new();

    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if let Some(header) = cell.as_string() {
                headers.insert(header.to_lowercase(), idx);
            }
        }
    }

    for (row_idx, row) in range.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let code_site_raw = get_string_cell(row, &headers, "code_site")
            .context(format!("code_site manquant ligne {}", row_idx + 1))?;
        let Some(code_site) = normalize_code_site(&code_site_raw) else {
            continue;
        };
        let depth_m = get_float_cell(row, &headers, "depth_m")
            .context(format!("depth_m manquant ligne {}", row_idx + 1))?;
        let vbs = get_float_cell(row, &headers, "vbs")
            .context(format!("vbs manquant ligne {}", row_idx + 1))?;

        rows.push(VbsRow {
            code_site,
            depth_m,
            vbs,
            commentaire: get_string_cell(row, &headers, "commentaire"),
        });
    }

    Ok(rows)
}

fn parse_proctor_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
) -> Result<Vec<ProctorRow>> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille proctor introuvable"))?;

    let mut rows = Vec::new();
    let mut headers: HashMap<String, usize> = HashMap::new();

    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if let Some(header) = cell.as_string() {
                headers.insert(header.to_lowercase(), idx);
            }
        }
    }

    for (row_idx, row) in range.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let code_site_raw = get_string_cell(row, &headers, "code_site")
            .context(format!("code_site manquant ligne {}", row_idx + 1))?;
        let Some(code_site) = normalize_code_site(&code_site_raw) else {
            continue;
        };
        let depth_m = get_float_cell(row, &headers, "depth_m")
            .context(format!("depth_m manquant ligne {}", row_idx + 1))?;
        let proctor_type = get_string_cell(row, &headers, "proctor_type")
            .context(format!("proctor_type manquant ligne {}", row_idx + 1))?;
        let gamma_d_max = get_float_cell(row, &headers, "gamma_d_max")
            .context(format!("gamma_d_max manquant ligne {}", row_idx + 1))?;
        let w_opt = get_float_cell(row, &headers, "w_opt")
            .context(format!("w_opt manquant ligne {}", row_idx + 1))?;

        rows.push(ProctorRow {
            code_site,
            depth_m,
            proctor_type,
            gamma_d_max,
            w_opt,
        });
    }

    Ok(rows)
}

fn parse_granulo_large_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
    method: &str,
) -> Result<GranuloLargeSheet> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille {} introuvable", sheet_name))?;

    let mut sieve_mm = Vec::new();
    let mut samples: HashMap<String, Vec<Option<f64>>> = HashMap::new();

    // Lire les entêtes (ligne 0)
    let mut sample_cols: Vec<String> = Vec::new();
    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if idx == 0 {
                // Première colonne = sieve_mm
                continue;
            }
            if let Some(header) = cell.as_string() {
                // Format attendu: "code_site@depth_m"
                sample_cols.push(header.to_string());
                samples.insert(header.to_string(), Vec::new());
            }
        }
    }

    // Lire les données (lignes 1+)
    for row in range.rows().skip(1) {
        if row.is_empty() {
            continue;
        }

        // Première colonne = sieve_mm
        if let Some(sieve) = get_float_from_cell(&row[0]) {
            sieve_mm.push(sieve);

            // Colonnes suivantes = passant pour chaque échantillon
            for (idx, sample_key) in sample_cols.iter().enumerate() {
                let col_idx = idx + 1;
                if col_idx < row.len() {
                    let passing = get_float_from_cell(&row[col_idx]);
                    if let Some(vec) = samples.get_mut(sample_key) {
                        vec.push(passing);
                    }
                }
            }
        }
    }

    Ok(GranuloLargeSheet {
        method: method.to_string(),
        sieve_mm,
        samples,
    })
}

fn parse_granulo_points_sheet<R: Read + std::io::Seek>(
    workbook: &mut Xlsx<R>,
    sheet_name: &str,
) -> Result<Vec<GranuloPointRow>> {
    let range = workbook
        .worksheet_range(sheet_name)
        .map_err(|_| anyhow::anyhow!("Feuille granulo_points introuvable"))?;

    let mut rows = Vec::new();
    let mut headers: HashMap<String, usize> = HashMap::new();

    if let Some(header_row) = range.rows().next() {
        for (idx, cell) in header_row.iter().enumerate() {
            if let Some(header) = cell.as_string() {
                headers.insert(header.to_lowercase(), idx);
            }
        }
    }

    for (row_idx, row) in range.rows().enumerate().skip(1) {
        if row.is_empty() {
            continue;
        }

        let code_site_raw = get_string_cell(row, &headers, "code_site")
            .context(format!("code_site manquant ligne {}", row_idx + 1))?;
        let Some(code_site) = normalize_code_site(&code_site_raw) else {
            continue;
        };
        let depth_m = get_float_cell(row, &headers, "depth_m")
            .context(format!("depth_m manquant ligne {}", row_idx + 1))?;
        let method = get_string_cell(row, &headers, "method")
            .context(format!("method manquant ligne {}", row_idx + 1))?;
        let sieve_mm = get_float_cell(row, &headers, "sieve_mm")
            .context(format!("sieve_mm manquant ligne {}", row_idx + 1))?;
        let passing_pct = get_float_cell(row, &headers, "passing_pct")
            .context(format!("passing_pct manquant ligne {}", row_idx + 1))?;

        rows.push(GranuloPointRow {
            code_site,
            depth_m,
            method,
            sieve_mm,
            passing_pct,
        });
    }

    Ok(rows)
}

// ============================================================================
// Helpers
// ============================================================================

fn get_string_cell(
    row: &[calamine::Data],
    headers: &HashMap<String, usize>,
    key: &str,
) -> Option<String> {
    headers
        .get(key)
        .and_then(|&idx| row.get(idx))
        .and_then(|cell| cell.as_string())
        .map(|s| s.to_string())
        .filter(|s| !s.is_empty())
}

fn get_float_cell(
    row: &[calamine::Data],
    headers: &HashMap<String, usize>,
    key: &str,
) -> Option<f64> {
    headers
        .get(key)
        .and_then(|&idx| row.get(idx))
        .and_then(get_float_from_cell)
}

fn get_float_from_cell(cell: &calamine::Data) -> Option<f64> {
    match cell {
        calamine::Data::Float(f) => Some(*f),
        calamine::Data::Int(i) => Some(*i as f64),
        calamine::Data::String(s) => {
            // Accepter virgule ou point comme séparateur décimal
            let normalized = s.replace(',', ".");
            normalized.parse::<f64>().ok()
        }
        _ => None,
    }
}

// ============================================================================
// Transformation Large → Long
// ============================================================================

pub fn transform_large_to_long(large: &GranuloLargeSheet) -> Vec<GranuloPointRow> {
    let mut points = Vec::new();

    for (sample_key, passings) in &large.samples {
        // Parser "code_site@depth_m"
        let parts: Vec<&str> = sample_key.split('@').collect();
        if parts.len() != 2 {
            continue;
        }

        let Some(code_site) = normalize_code_site(parts[0]) else {
            continue;
        };
        let depth_str = parts[1].replace(',', "."); // Accepter virgule
        let depth_m = match depth_str.parse::<f64>() {
            Ok(d) => d,
            Err(_) => continue,
        };

        // Créer un point par tamis
        for (idx, &sieve) in large.sieve_mm.iter().enumerate() {
            if let Some(Some(passing)) = passings.get(idx) {
                points.push(GranuloPointRow {
                    code_site: code_site.clone(),
                    depth_m,
                    method: large.method.clone(),
                    sieve_mm: sieve,
                    passing_pct: *passing,
                });
            }
        }
    }

    points
}
