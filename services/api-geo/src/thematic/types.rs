use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Paramètres disponibles pour visualisation thématique
#[derive(Debug, Serialize, Deserialize, Clone, PartialEq)]
#[serde(rename_all = "snake_case")]
pub enum ThematicParameter {
    // Densité et couverture
    NSondages,
    NEssaisGeo,

    // Granulométrie - avec alias pour compatibilité UI (avec et sans underscore)
    #[serde(alias = "passant80um_avg", alias = "passant_80um_avg")]
    Passant80umAvg,
    #[serde(alias = "passant2mm_avg", alias = "passant_2mm_avg")]
    Passant2mmAvg,
    #[serde(alias = "passant20mm_avg", alias = "passant_20mm_avg")]
    Passant20mmAvg,

    // Atterberg
    #[serde(alias = "wl_avg")]
    WlAvg,
    #[serde(alias = "wp_avg")]
    WpAvg,
    #[serde(alias = "ip_avg")]
    IpAvg,
    #[serde(alias = "ip_stddev")]
    IpStddev,
    #[serde(alias = "ip_min")]
    IpMin,
    #[serde(alias = "ip_max")]
    IpMax,

    // VBS
    #[serde(alias = "vbs_avg")]
    VbsAvg,
    #[serde(alias = "vbs_stddev")]
    VbsStddev,
    #[serde(alias = "vbs_min")]
    VbsMin,
    #[serde(alias = "vbs_max")]
    VbsMax,

    // Proctor
    #[serde(alias = "gamma_d_max_avg", alias = "gammadmax_avg")]
    GammaDMaxAvg,
    #[serde(alias = "gamma_d_max_stddev", alias = "gammadmax_stddev")]
    GammaDMaxStddev,
    #[serde(alias = "w_opt_avg", alias = "wopt_avg")]
    WOptAvg,
    #[serde(alias = "w_opt_stddev", alias = "wopt_stddev")]
    WOptStddev,

    // Gonflement
    #[serde(alias = "eg_avg")]
    EgAvg,
    #[serde(alias = "eg_stddev")]
    EgStddev,
    #[serde(alias = "eg_min")]
    EgMin,
    #[serde(alias = "eg_max")]
    EgMax,

    // Contexte géographique (DSM COP30)
    #[serde(alias = "altitude_mean")]
    AltitudeMean,

    // IA / Interpolation / AG
    #[serde(alias = "ai_rga_score_infer")]
    AiRgaScoreInfer,
    #[serde(alias = "ai_portance_kpa_infer")]
    AiPortanceKpaInfer,
    #[serde(alias = "kriging_ip")]
    KrigingIp,
    #[serde(alias = "kriging_vbs")]
    KrigingVbs,
    #[serde(alias = "ag_safety_factor")]
    AgSafetyFactor,
    #[serde(alias = "ag_cout_millions")]
    AgCoutMillions,
}

impl ThematicParameter {
    /// Nom de la colonne SQL correspondante
    pub fn sql_column(&self) -> &str {
        match self {
            Self::NSondages => "n_sondages",
            Self::NEssaisGeo => "n_essais_geo",
            Self::Passant80umAvg => "passant_80um_avg",
            Self::Passant2mmAvg => "passant_2mm_avg",
            Self::Passant20mmAvg => "passant_20mm_avg",
            Self::WlAvg => "wl_avg",
            Self::WpAvg => "wp_avg",
            Self::IpAvg => "ip_avg",
            Self::IpStddev => "ip_stddev",
            Self::IpMin => "ip_min",
            Self::IpMax => "ip_max",
            Self::VbsAvg => "vbs_avg",
            Self::VbsStddev => "vbs_stddev",
            Self::VbsMin => "vbs_min",
            Self::VbsMax => "vbs_max",
            Self::GammaDMaxAvg => "gamma_d_max_avg",
            Self::GammaDMaxStddev => "gamma_d_max_stddev",
            Self::WOptAvg => "w_opt_avg",
            Self::WOptStddev => "w_opt_stddev",
            Self::EgAvg => "eg_avg",
            Self::EgStddev => "eg_stddev",
            Self::EgMin => "eg_min",
            Self::EgMax => "eg_max",
            Self::AltitudeMean => "altitude_mean",
            Self::AiRgaScoreInfer => "ai_rga_score_infer",
            Self::AiPortanceKpaInfer => "ai_portance_kpa_infer",
            Self::KrigingIp => "kriging_ip",
            Self::KrigingVbs => "kriging_vbs",
            Self::AgSafetyFactor => "ag_safety_factor",
            Self::AgCoutMillions => "ag_cout_millions",
        }
    }

    /// Label lisible pour l'UI
    pub fn label(&self) -> &str {
        match self {
            Self::NSondages => "Nombre de sondages",
            Self::NEssaisGeo => "Nombre d'essais géotechniques",
            Self::Passant80umAvg => "% Passant 80µm (moyen)",
            Self::Passant2mmAvg => "% Passant 2mm (moyen)",
            Self::Passant20mmAvg => "% Passant 20mm (moyen)",
            Self::WlAvg => "Limite de liquidité WL (moyenne)",
            Self::WpAvg => "Limite de plasticité WP (moyenne)",
            Self::IpAvg => "Indice de plasticité IP (moyen)",
            Self::IpStddev => "Écart-type IP",
            Self::IpMin => "IP minimum",
            Self::IpMax => "IP maximum",
            Self::VbsAvg => "Valeur de Bleu VBS (moyenne)",
            Self::VbsStddev => "Écart-type VBS",
            Self::VbsMin => "VBS minimum",
            Self::VbsMax => "VBS maximum",
            Self::GammaDMaxAvg => "Densité sèche γd max (moyenne)",
            Self::GammaDMaxStddev => "Écart-type γd max",
            Self::WOptAvg => "Teneur en eau optimale wopt (moyenne)",
            Self::WOptStddev => "Écart-type wopt",
            Self::EgAvg => "Potentiel de gonflement eg (moyen)",
            Self::EgStddev => "Écart-type eg",
            Self::EgMin => "eg minimum",
            Self::EgMax => "eg maximum",
            Self::AltitudeMean => "Altitude moyenne (DSM COP30)",
            Self::AiRgaScoreInfer => "Score RGA IA (infer)",
            Self::AiPortanceKpaInfer => "Portance estimee IA (kPa)",
            Self::KrigingIp => "IP interpole (kriging proxy)",
            Self::KrigingVbs => "VBS interpole (kriging proxy)",
            Self::AgSafetyFactor => "Facteur de securite AG",
            Self::AgCoutMillions => "Cout AG (millions FCFA)",
        }
    }

    /// Unité de mesure
    pub fn unit(&self) -> &str {
        match self {
            Self::NSondages | Self::NEssaisGeo => "",
            Self::Passant80umAvg | Self::Passant2mmAvg | Self::Passant20mmAvg => "%",
            Self::WlAvg
            | Self::WpAvg
            | Self::IpAvg
            | Self::IpStddev
            | Self::IpMin
            | Self::IpMax => "%",
            Self::VbsAvg | Self::VbsStddev | Self::VbsMin | Self::VbsMax => "g/100g",
            Self::GammaDMaxAvg | Self::GammaDMaxStddev => "kN/m³",
            Self::WOptAvg | Self::WOptStddev => "%",
            Self::EgAvg | Self::EgStddev | Self::EgMin | Self::EgMax => "%",
            Self::AltitudeMean => "m",
            Self::AiRgaScoreInfer => "score",
            Self::AiPortanceKpaInfer => "kPa",
            Self::KrigingIp => "%",
            Self::KrigingVbs => "g/100g",
            Self::AgSafetyFactor => "FS",
            Self::AgCoutMillions => "M FCFA",
        }
    }

    /// Catégorie du paramètre
    pub fn category(&self) -> &str {
        match self {
            Self::NSondages | Self::NEssaisGeo => "density",
            Self::Passant80umAvg | Self::Passant2mmAvg | Self::Passant20mmAvg => "granulo",
            Self::WlAvg
            | Self::WpAvg
            | Self::IpAvg
            | Self::IpStddev
            | Self::IpMin
            | Self::IpMax => "atterberg",
            Self::VbsAvg | Self::VbsStddev | Self::VbsMin | Self::VbsMax => "vbs",
            Self::GammaDMaxAvg | Self::GammaDMaxStddev | Self::WOptAvg | Self::WOptStddev => {
                "proctor"
            }
            Self::EgAvg | Self::EgStddev | Self::EgMin | Self::EgMax => "gonflement",
            Self::AltitudeMean => "contexte",
            Self::AiRgaScoreInfer
            | Self::AiPortanceKpaInfer
            | Self::KrigingIp
            | Self::KrigingVbs
            | Self::AgSafetyFactor
            | Self::AgCoutMillions => "ai",
        }
    }
}

/// Requête pour récupérer les données thématiques
#[derive(Debug, Deserialize)]
pub struct ThematicDataRequest {
    /// Paramètre à visualiser
    pub parameter: ThematicParameter,

    /// Grille source ("2km" | "28km")
    #[serde(default)]
    pub grid: Option<String>,

    /// Filtre géographique (bbox en WGS84)
    #[serde(default)]
    pub bbox: Option<[f64; 4]>, // [west, south, east, north]

    /// Filtres administratifs
    #[serde(default)]
    pub adm1: Option<String>,
    #[serde(default)]
    pub adm2: Option<String>,
    #[serde(default)]
    pub adm3: Option<String>,

    /// Nombre minimum de sondages par maille
    #[serde(default)]
    pub min_sondages: Option<i32>,

    /// Inclure les géométries (false pour stats uniquement)
    #[serde(default = "default_true")]
    pub include_geometry: bool,

    /// Niveau de zoom (pour simplification géométrique)
    #[serde(default)]
    pub zoom: Option<u8>,
}

fn default_true() -> bool {
    true
}

/// Réponse avec données thématiques
#[derive(Debug, Serialize)]
pub struct ThematicDataResponse {
    #[serde(rename = "type")]
    pub feature_type: String,
    pub features: Vec<serde_json::Value>,
    pub statistics: Statistics,
    pub metadata: ResponseMetadata,
}

/// Statistiques descriptives enrichies pour export
#[derive(Debug, Serialize, Clone)]
pub struct Statistics {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub median: f64,
    pub stddev: f64,
    pub variance: f64,
    pub quantiles: Quantiles,
    /// Nombre de mailles avec données (après filtres)
    pub count: usize,
    /// Nombre de mailles sans données dans la zone
    pub null_count: usize,
    /// Nombre total de mailles dans la zone (avant filtres)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub count_total: Option<usize>,
    /// Somme des valeurs (pour calcul densité)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub sum: Option<f64>,
    /// Contexte parent pour comparaison multi-niveaux
    #[serde(skip_serializing_if = "Option::is_none")]
    pub parent_context: Option<ParentContext>,
}

/// Contexte du niveau parent pour comparaisons
#[derive(Debug, Serialize, Clone)]
pub struct ParentContext {
    /// Niveau parent (adm0, adm1, adm2)
    pub level: String,
    /// Code/nom du parent
    pub parent_name: String,
    /// Total sondages dans le parent
    pub parent_sum: f64,
    /// Total mailles dans le parent
    pub parent_cells: usize,
}

#[derive(Debug, Serialize, Clone)]
pub struct Quantiles {
    pub q25: f64, // 1er quartile
    pub q50: f64, // Médiane
    pub q75: f64, // 3e quartile
    pub q90: f64, // 90e percentile
    pub q95: f64, // 95e percentile
}

#[derive(Debug, Serialize)]
pub struct ResponseMetadata {
    pub parameter: String,
    pub parameter_label: String,
    pub unit: String,
    pub category: String,
    pub generated_at: String,
    pub filters_applied: FiltersApplied,
}

#[derive(Debug, Serialize)]
pub struct FiltersApplied {
    pub grid: Option<String>,
    pub bbox: Option<[f64; 4]>,
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    pub min_sondages: Option<i32>,
}

/// Requête de classification
#[derive(Debug, Deserialize)]
pub struct ClassifyRequest {
    pub values: Vec<f64>,
    pub method: ClassificationMethod,
    pub n_classes: usize,
    #[serde(default)]
    pub custom_breaks: Option<Vec<f64>>,
    #[serde(default)]
    pub palette: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ClassificationMethod {
    Quantiles,
    EqualInterval,
    Jenks,
    Custom,
}

/// Réponse de classification
#[derive(Debug, Serialize)]
pub struct ClassifyResponse {
    pub breaks: Vec<f64>,
    pub colors: Vec<String>,
    pub labels: Vec<String>,
    pub method: String,
    pub n_classes: usize,
}

/// Configuration de carte thématique
#[derive(Debug, Serialize, Deserialize)]
pub struct ThematicConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub id: Option<Uuid>,
    pub name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub description: Option<String>,

    #[serde(rename = "type")]
    pub map_type: MapType,

    pub parameter: String,

    #[serde(skip_serializing_if = "Option::is_none")]
    pub classification: Option<ClassificationConfig>,
    pub style: StyleConfig,
    pub filters: FilterConfig,

    pub is_public: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_by: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub updated_at: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum MapType {
    Choropleth,
    Proportional,
    Heatmap,
    Isolines,
    Density,
    Comparative,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ClassificationConfig {
    pub method: ClassificationMethod,
    pub n_classes: usize,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub custom_breaks: Option<Vec<f64>>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StyleConfig {
    pub palette: String,
    pub opacity: f64,
    pub stroke_width: f64,
    pub stroke_color: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct FilterConfig {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub bbox: Option<[f64; 4]>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adm1: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adm2: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub adm3: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub min_sondages: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parameter_sql_column() {
        assert_eq!(ThematicParameter::IpAvg.sql_column(), "ip_avg");
        assert_eq!(ThematicParameter::VbsAvg.sql_column(), "vbs_avg");
        assert_eq!(ThematicParameter::EgAvg.sql_column(), "eg_avg");
    }

    #[test]
    fn test_parameter_label() {
        assert!(ThematicParameter::IpAvg
            .label()
            .contains("Indice de plasticité"));
        assert!(ThematicParameter::VbsAvg.label().contains("Valeur de Bleu"));
    }

    #[test]
    fn test_parameter_unit() {
        assert_eq!(ThematicParameter::IpAvg.unit(), "%");
        assert_eq!(ThematicParameter::VbsAvg.unit(), "g/100g");
        assert_eq!(ThematicParameter::GammaDMaxAvg.unit(), "kN/m³");
    }

    #[test]
    fn test_parameter_category() {
        assert_eq!(ThematicParameter::IpAvg.category(), "atterberg");
        assert_eq!(ThematicParameter::VbsAvg.category(), "vbs");
        assert_eq!(ThematicParameter::EgAvg.category(), "gonflement");
    }
}

// ============================================================================
// Types pour l'endpoint /thematic/cells/adm
// ============================================================================

/// Requête pour récupérer les mailles d'un ADM
#[derive(Debug, Deserialize)]
pub struct AdmCellsRequest {
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
}

/// Une maille dans un ADM
#[derive(Debug, Serialize)]
pub struct AdmCell {
    pub cell_id: String,
    pub geometry: serde_json::Value,
    pub has_data: bool,
    pub n_sondages: Option<i32>,
}

/// Réponse avec toutes les mailles d'un ADM
#[derive(Debug, Serialize)]
pub struct AdmCellsResponse {
    pub cells: Vec<AdmCell>,
    pub total_count: usize,
    pub with_data_count: usize,
    pub without_data_count: usize,
}
