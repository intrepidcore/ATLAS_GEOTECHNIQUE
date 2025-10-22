# 🗺️ Cartes Thématiques - Atlas Géotechnique v1.5.0

**Date** : 2025-10-19  
**Version** : 1.5.0  
**Statut** : Spécification complète

---

## 📋 Table des Matières

1. [Vue d'ensemble](#vue-densemble)
2. [Types de cartes thématiques](#types-de-cartes-thématiques)
3. [Architecture backend](#architecture-backend)
4. [Architecture frontend](#architecture-frontend)
5. [Base de données](#base-de-données)
6. [Plan d'implémentation](#plan-dimplémentation)
7. [Exemples d'usage](#exemples-dusage)

---

## 📋 Vue d'ensemble

### Contexte

Le projet Atlas Géotechnique dispose actuellement d'une visualisation basique des mailles avec coloration conditionnelle (avec/sans données). Les cartes thématiques permettront une analyse visuelle avancée des données géotechniques selon différents paramètres.

### Objectifs

1. **Visualisation multi-paramètres** : Afficher densité de sondages, profondeur d'investigation, qualité des données
2. **Styles cartographiques variés** : Choroplèthe, symboles proportionnels, heatmap, isolignes
3. **Interactivité avancée** : Filtres dynamiques, légendes interactives, comparaison de paramètres
4. **Export professionnel** : PNG, PDF, GeoJSON avec légende et métadonnées
5. **Sauvegarde et partage** : Configurations de cartes réutilisables

### Paramètres Disponibles

**Densité et couverture** :
- `n_sondages` : Nombre de sondages par maille
- `n_essais` : Nombre total d'essais par maille
- `density_km2` : Densité de sondages par km²

**Profondeur d'investigation** :
- `depth_avg` : Profondeur moyenne des essais (m)
- `depth_max` : Profondeur maximale atteinte (m)
- `depth_min` : Profondeur minimale (m)

**Qualité des données** :
- `data_quality` : Score de qualité 0-100 (basé sur nombre de sondages, essais, profondeur)
- `completeness` : Pourcentage de complétude des métadonnées
- `age_avg` : Âge moyen des sondages (années)

**Distribution par profondeur** :
- `n_depth_0_5` : Nombre d'essais entre 0-5m
- `n_depth_5_10` : Nombre d'essais entre 5-10m
- `n_depth_10_20` : Nombre d'essais entre 10-20m
- `n_depth_20plus` : Nombre d'essais > 20m

**Temporel** :
- `last_survey_date` : Date du dernier sondage
- `first_survey_date` : Date du premier sondage
- `survey_span_years` : Période couverte (années)

---

## 🎨 Types de Cartes Thématiques

### 1. Carte Choroplèthe (Aplats de couleur)

**Description** : Coloration des mailles selon une valeur statistique. C'est le type de carte le plus courant pour représenter des données quantitatives par zone.

**Cas d'usage** :
- Identifier les zones bien/mal échantillonnées
- Visualiser la profondeur d'investigation
- Évaluer la qualité globale des données

**Paramètres recommandés** :
- `n_sondages` : Couverture spatiale
- `depth_avg` : Profondeur moyenne d'investigation
- `data_quality` : Score de qualité des données

**Méthodes de classification** :

1. **Quantiles** (recommandé pour distributions asymétriques)
   - Divise les données en classes de même effectif
   - Chaque classe contient le même nombre de mailles
   - Idéal pour : Densité de sondages, nombre d'essais

2. **Intervalles égaux** (pour distributions uniformes)
   - Divise la plage de valeurs en intervalles de même taille
   - Peut créer des classes vides si distribution irrégulière
   - Idéal pour : Profondeur, scores de qualité

3. **Seuils naturels (Jenks)** (optimal statistiquement)
   - Minimise la variance intra-classe
   - Maximise la variance inter-classe
   - Idéal pour : Tous paramètres, mais coûteux en calcul

4. **Seuils personnalisés**
   - Définis par l'utilisateur selon expertise métier
   - Exemple : 0-5, 5-10, 10-20, 20+ sondages
   - Idéal pour : Normes géotechniques, seuils réglementaires

**Palettes de couleurs** :

- **Séquentielle** (une couleur, intensité croissante)
  - `Blues` : Bleu clair → Bleu foncé
  - `Greens` : Vert clair → Vert foncé
  - `Reds` : Rouge clair → Rouge foncé
  - Usage : Valeurs croissantes (densité, profondeur)

- **Divergente** (deux couleurs opposées)
  - `RdYlGn` : Rouge ← Jaune → Vert
  - `RdBu` : Rouge ← Blanc → Bleu
  - Usage : Valeurs autour d'une médiane (écart à la moyenne)

- **Qualitative** (couleurs distinctes)
  - `Set1`, `Set2`, `Paired`
  - Usage : Catégories (type de sol, source de données)

**Options de style** :
- Nombre de classes : 3-10 (recommandé : 5-7)
- Opacité : 0-100% (recommandé : 60-80%)
- Épaisseur des contours : 0.5-3px
- Couleur des contours : Noir, gris, ou transparent

---

### 2. Carte à Symboles Proportionnels

**Description** : Cercles, carrés ou triangles dont la taille est proportionnelle à une valeur. Permet de superposer deux variables (taille + couleur).

**Cas d'usage** :
- Visualiser simultanément densité ET qualité
- Comparer plusieurs paramètres sur une même carte
- Identifier les outliers (valeurs extrêmes)

**Variables** :
- **Taille** : `n_sondages`, `n_essais`, `depth_max`
- **Couleur** : `data_quality`, `age_avg`, `completeness`
- **Position** : Centroïde de maille ou points de sondage réels

**Types de symboles** :
- **Cercles** : Standard, facile à lire
- **Carrés** : Meilleure visibilité à petit zoom
- **Triangles** : Distinguer plusieurs séries de données

**Échelles de taille** :
- **Linéaire** : Taille proportionnelle à la valeur
- **Logarithmique** : Pour valeurs avec grande amplitude
- **Racine carrée** : Compromis visuel (aire proportionnelle)

**Options** :
- Taille min/max : 5-50 pixels
- Transparence : 50-80% (pour voir superpositions)
- Contour : Oui/Non, couleur, épaisseur

---

### 3. Heatmap (Carte de chaleur)

**Description** : Interpolation spatiale continue créant un dégradé de couleurs. Transforme des points discrets en surface continue.

**Cas d'usage** :
- Identifier les zones de forte/faible densité
- Visualiser des tendances spatiales
- Créer des cartes "lissées" sans frontières de mailles

**Méthodes d'interpolation** :

1. **IDW (Inverse Distance Weighting)**
   - Pondération par inverse de la distance
   - Paramètre : puissance (p=1, 2, 3)
   - Rapide, simple, mais peut créer des "bulls-eyes"

2. **Kernel Density Estimation (KDE)**
   - Estimation de densité par noyau gaussien
   - Paramètre : rayon du kernel (bandwidth)
   - Idéal pour densité de points

3. **Spline**
   - Interpolation polynomiale lisse
   - Crée des surfaces très lisses
   - Peut créer des valeurs hors plage

**Paramètres** :
- Rayon d'influence : 500m - 5000m
- Résolution de la grille : 50m - 500m
- Lissage : 0-100%
- Palette : Viridis, Plasma, Inferno

**Options avancées** :
- Masquage hors zones de données
- Affichage des points sources
- Isolignes superposées

---

### 4. Carte d'Isolignes (Contours)

**Description** : Lignes reliant les points de même valeur, comme des courbes de niveau topographiques.

**Cas d'usage** :
- Visualiser des gradients (profondeur, densité)
- Identifier des zones homogènes
- Créer des cartes "professionnelles" type atlas

**Paramètres** :
- Variable : `depth_avg`, `n_sondages`, `data_quality`
- Intervalle : Automatique ou personnalisé
- Lissage : Faible, Moyen, Fort

**Options de style** :
- Épaisseur des lignes : 1-3px
- Couleur : Monochrome ou dégradé
- Étiquettes : Oui/Non, fréquence
- Courbes maîtresses : Toutes les N lignes

---

### 5. Carte de Densité de Points

**Description** : Visualisation de la concentration spatiale des sondages individuels (pas par maille).

**Cas d'usage** :
- Identifier les clusters de sondages
- Détecter les zones sous-échantillonnées
- Planifier de nouvelles campagnes

**Méthodes** :

1. **Kernel Density (KDE)**
   - Dégradé de couleur continu
   - Rayon : 100m - 2000m

2. **Hexbins**
   - Grille hexagonale avec comptage
   - Taille hexagone : 200m - 1000m

3. **Grille de comptage**
   - Grille carrée régulière
   - Taille cellule : 100m - 500m

**Options** :
- Normalisation : Par aire ou absolu
- Palette : Chaleur (jaune-orange-rouge)
- Transparence : 60-80%

---

### 6. Carte Comparative (Multi-vues)

**Description** : Affichage simultané de 2-4 paramètres pour comparaison visuelle.

**Cas d'usage** :
- Comparer densité vs qualité
- Analyser évolution temporelle
- Identifier corrélations spatiales

**Modes d'affichage** :

1. **Split vertical/horizontal**
   - Deux cartes côte-à-côte
   - Zoom/pan synchronisés

2. **Swipe (glissière)**
   - Curseur pour révéler carte sous-jacente
   - Comparaison avant/après

3. **Grille 2x2**
   - Quatre paramètres simultanés
   - Vue d'ensemble complète

**Options** :
- Synchronisation : Zoom, pan, filtres
- Légendes : Partagée ou individuelles
- Export : Mosaïque unique

---

## 🛠️ Architecture Backend

### Structure des Fichiers

```
services/api-geo/src/
├── thematic/
│   ├── mod.rs              # Module principal
│   ├── routes.rs           # Endpoints HTTP
│   ├── types.rs            # DTOs et structures
│   ├── classifier.rs       # Algorithmes de classification
│   ├── statistics.rs       # Calculs statistiques
│   ├── interpolation.rs    # IDW, KDE (Phase 2)
│   └── colors.rs           # Palettes de couleurs
```

### Dépendances Rust

Ajouter dans `Cargo.toml` :

```toml
[dependencies]
# Existantes
axum = "0.7"
sqlx = { version = "0.7", features = ["postgres", "runtime-tokio-native-tls", "uuid", "chrono"] }
serde = { version = "1.0", features = ["derive"] }
serde_json = "1.0"
tokio = { version = "1", features = ["full"] }
uuid = { version = "1.0", features = ["v4", "serde"] }

# Nouvelles pour cartes thématiques
statrs = "0.17"           # Statistiques (quantiles, variance, etc.)
ordered-float = "4.0"     # Tri de floats pour Jenks
```

### Types de Données (`thematic/types.rs`)

```rust
use serde::{Deserialize, Serialize};
use uuid::Uuid;

/// Requête pour récupérer les données thématiques
#[derive(Debug, Deserialize)]
pub struct ThematicDataRequest {
    /// Paramètre à visualiser
    pub parameter: ThematicParameter,
    
    /// Filtre géographique (bbox en WGS84)
    pub bbox: Option<[f64; 4]>, // [west, south, east, north]
    
    /// Filtres administratifs
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    
    /// Nombre minimum de sondages par maille
    pub min_sondages: Option<i32>,
    
    /// Inclure les géométries (false pour stats uniquement)
    pub include_geometry: Option<bool>,
}

/// Paramètres disponibles pour visualisation
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "snake_case")]
pub enum ThematicParameter {
    // Densité et couverture
    NSondages,
    NEssais,
    DensityKm2,
    
    // Profondeur
    DepthAvg,
    DepthMax,
    DepthMin,
    
    // Qualité
    DataQuality,
    Completeness,
    AgeAvg,
    
    // Distribution profondeur
    NDepth0_5,
    NDepth5_10,
    NDepth10_20,
    NDepth20Plus,
}

impl ThematicParameter {
    /// Nom de la colonne SQL correspondante
    pub fn sql_column(&self) -> &str {
        match self {
            Self::NSondages => "n_sondages",
            Self::NEssais => "n_essais",
            Self::DensityKm2 => "density_km2",
            Self::DepthAvg => "depth_avg",
            Self::DepthMax => "depth_max",
            Self::DepthMin => "depth_min",
            Self::DataQuality => "data_quality",
            Self::Completeness => "completeness",
            Self::AgeAvg => "age_avg",
            Self::NDepth0_5 => "n_depth_0_5",
            Self::NDepth5_10 => "n_depth_5_10",
            Self::NDepth10_20 => "n_depth_10_20",
            Self::NDepth20Plus => "n_depth_20plus",
        }
    }
    
    /// Label lisible pour l'UI
    pub fn label(&self) -> &str {
        match self {
            Self::NSondages => "Nombre de sondages",
            Self::NEssais => "Nombre d'essais",
            Self::DensityKm2 => "Densité (sondages/km²)",
            Self::DepthAvg => "Profondeur moyenne (m)",
            Self::DepthMax => "Profondeur maximale (m)",
            Self::DepthMin => "Profondeur minimale (m)",
            Self::DataQuality => "Score de qualité",
            Self::Completeness => "Complétude (%)",
            Self::AgeAvg => "Âge moyen (années)",
            Self::NDepth0_5 => "Essais 0-5m",
            Self::NDepth5_10 => "Essais 5-10m",
            Self::NDepth10_20 => "Essais 10-20m",
            Self::NDepth20Plus => "Essais >20m",
        }
    }
    
    /// Unité de mesure
    pub fn unit(&self) -> &str {
        match self {
            Self::DepthAvg | Self::DepthMax | Self::DepthMin => "m",
            Self::DensityKm2 => "sondages/km²",
            Self::DataQuality | Self::Completeness => "%",
            Self::AgeAvg => "années",
            _ => "",
        }
    }
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

/// Statistiques descriptives
#[derive(Debug, Serialize)]
pub struct Statistics {
    pub min: f64,
    pub max: f64,
    pub mean: f64,
    pub median: f64,
    pub stddev: f64,
    pub variance: f64,
    pub quantiles: Quantiles,
    pub count: usize,
    pub null_count: usize,
}

#[derive(Debug, Serialize)]
pub struct Quantiles {
    pub q25: f64,  // 1er quartile
    pub q50: f64,  // Médiane
    pub q75: f64,  // 3e quartile
    pub q90: f64,  // 90e percentile
    pub q95: f64,  // 95e percentile
}

#[derive(Debug, Serialize)]
pub struct ResponseMetadata {
    pub parameter: String,
    pub parameter_label: String,
    pub unit: String,
    pub generated_at: String,
    pub filters_applied: FiltersApplied,
}

#[derive(Debug, Serialize)]
pub struct FiltersApplied {
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
    pub custom_breaks: Option<Vec<f64>>,
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
    pub id: Option<Uuid>,
    pub name: String,
    pub description: Option<String>,
    
    #[serde(rename = "type")]
    pub map_type: MapType,
    
    pub parameter: ThematicParameter,
    
    pub classification: Option<ClassificationConfig>,
    pub style: StyleConfig,
    pub filters: FilterConfig,
    
    pub is_public: bool,
    pub created_by: Option<String>,
    pub created_at: Option<chrono::DateTime<chrono::Utc>>,
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

#[derive(Debug, Serialize, Deserialize)]
pub struct ClassificationConfig {
    pub method: ClassificationMethod,
    pub n_classes: usize,
    pub custom_breaks: Option<Vec<f64>>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct StyleConfig {
    pub palette: String,
    pub opacity: f64,
    pub stroke_width: f64,
    pub stroke_color: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct FilterConfig {
    pub bbox: Option<[f64; 4]>,
    pub adm1: Option<String>,
    pub adm2: Option<String>,
    pub adm3: Option<String>,
    pub min_sondages: Option<i32>,
}
```

### Algorithmes de Classification (`thematic/classifier.rs`)

```rust
use statrs::statistics::{Data, OrderStatistics, Statistics};
use ordered_float::OrderedFloat;

/// Classification par quantiles
pub fn classify_quantiles(values: &[f64], n_classes: usize) -> Result<Vec<f64>, String> {
    if values.is_empty() {
        return Err("Aucune valeur fournie".to_string());
    }
    if n_classes < 2 {
        return Err("Nombre de classes doit être >= 2".to_string());
    }
    
    let mut data = Data::new(values.to_vec());
    let mut breaks = Vec::with_capacity(n_classes - 1);
    
    for i in 1..n_classes {
        let quantile = i as f64 / n_classes as f64;
        breaks.push(data.quantile(quantile));
    }
    
    Ok(breaks)
}

/// Classification par intervalles égaux
pub fn classify_equal_interval(min: f64, max: f64, n_classes: usize) -> Result<Vec<f64>, String> {
    if n_classes < 2 {
        return Err("Nombre de classes doit être >= 2".to_string());
    }
    if max <= min {
        return Err("Max doit être > Min".to_string());
    }
    
    let interval = (max - min) / n_classes as f64;
    let breaks = (1..n_classes)
        .map(|i| min + interval * i as f64)
        .collect();
    
    Ok(breaks)
}

/// Classification par seuils naturels (Jenks)
/// Algorithme de Fisher-Jenks pour minimiser la variance intra-classe
pub fn classify_jenks(values: &[f64], n_classes: usize) -> Result<Vec<f64>, String> {
    if values.is_empty() {
        return Err("Aucune valeur fournie".to_string());
    }
    if n_classes < 2 || n_classes >= values.len() {
        return Err("Nombre de classes invalide".to_string());
    }
    
    // Trier les valeurs
    let mut sorted: Vec<OrderedFloat<f64>> = values.iter()
        .map(|&v| OrderedFloat(v))
        .collect();
    sorted.sort();
    let sorted: Vec<f64> = sorted.iter().map(|&v| v.0).collect();
    
    let n = sorted.len();
    
    // Matrices pour programmation dynamique
    let mut variance_matrix = vec![vec![0.0; n]; n];
    let mut class_matrix = vec![vec![0; n]; n_classes + 1];
    
    // Calculer les variances pour tous les segments possibles
    for i in 0..n {
        let mut sum = 0.0;
        let mut sum_sq = 0.0;
        
        for j in i..n {
            let val = sorted[j];
            sum += val;
            sum_sq += val * val;
            let count = (j - i + 1) as f64;
            let mean = sum / count;
            let variance = sum_sq / count - mean * mean;
            variance_matrix[i][j] = variance * count;
        }
    }
    
    // Initialiser pour 1 classe
    for i in 0..n {
        class_matrix[1][i] = 1;
    }
    
    // Programmation dynamique pour trouver les breaks optimaux
    let mut optimal_variance = vec![vec![f64::INFINITY; n]; n_classes + 1];
    optimal_variance[1] = variance_matrix[0].clone();
    
    for k in 2..=n_classes {
        for i in (k - 1)..n {
            let mut min_var = f64::INFINITY;
            let mut min_j = 0;
            
            for j in (k - 2)..i {
                let var = optimal_variance[k - 1][j] + variance_matrix[j + 1][i];
                if var < min_var {
                    min_var = var;
                    min_j = j;
                }
            }
            
            optimal_variance[k][i] = min_var;
            class_matrix[k][i] = min_j + 1;
        }
    }
    
    // Extraire les breaks
    let mut breaks = Vec::with_capacity(n_classes - 1);
    let mut k = n - 1;
    
    for _ in 0..(n_classes - 1) {
        let break_idx = class_matrix[n_classes - breaks.len()][k];
        breaks.push(sorted[break_idx]);
        k = break_idx - 1;
    }
    
    breaks.reverse();
    Ok(breaks)
}

/// Générer des labels pour les classes
pub fn generate_labels(breaks: &[f64], precision: usize) -> Vec<String> {
    let mut labels = Vec::with_capacity(breaks.len() + 1);
    
    if breaks.is_empty() {
        return labels;
    }
    
    // Première classe
    labels.push(format!("< {:.prec$}", breaks[0], prec = precision));
    
    // Classes intermédiaires
    for i in 0..breaks.len() - 1 {
        labels.push(format!(
            "{:.prec$} - {:.prec$}",
            breaks[i],
            breaks[i + 1],
            prec = precision
        ));
    }
    
    // Dernière classe
    labels.push(format!("≥ {:.prec$}", breaks[breaks.len() - 1], prec = precision));
    
    labels
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_quantiles() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0, 6.0, 7.0, 8.0, 9.0, 10.0];
        let breaks = classify_quantiles(&values, 4).unwrap();
        assert_eq!(breaks.len(), 3);
        // Q1=2.75, Q2=5.5, Q3=8.25 (approximativement)
    }
    
    #[test]
    fn test_equal_interval() {
        let breaks = classify_equal_interval(0.0, 100.0, 5).unwrap();
        assert_eq!(breaks, vec![20.0, 40.0, 60.0, 80.0]);
    }
    
    #[test]
    fn test_labels() {
        let breaks = vec![10.0, 20.0, 30.0];
        let labels = generate_labels(&breaks, 1);
        assert_eq!(labels.len(), 4);
        assert_eq!(labels[0], "< 10.0");
        assert_eq!(labels[3], "≥ 30.0");
    }
}
```

---

### Palettes de Couleurs (`thematic/colors.rs`)

```rust
/// Palettes de couleurs prédéfinies (ColorBrewer)
pub struct ColorPalette {
    pub name: String,
    pub colors: Vec<String>,
    pub palette_type: PaletteType,
}

pub enum PaletteType {
    Sequential,  // Une couleur, intensité croissante
    Diverging,   // Deux couleurs opposées
    Qualitative, // Couleurs distinctes
}

/// Récupérer une palette par nom
pub fn get_palette(name: &str) -> Option<ColorPalette> {
    match name {
        "Blues" => Some(ColorPalette {
            name: "Blues".to_string(),
            colors: vec![
                "#f7fbff", "#deebf7", "#c6dbef", "#9ecae1", "#6baed6",
                "#4292c6", "#2171b5", "#08519c", "#08306b"
            ].iter().map(|s| s.to_string()).collect(),
            palette_type: PaletteType::Sequential,
        }),
        "Greens" => Some(ColorPalette {
            name: "Greens".to_string(),
            colors: vec![
                "#f7fcf5", "#e5f5e0", "#c7e9c0", "#a1d99b", "#74c476",
                "#41ab5d", "#238b45", "#006d2c", "#00441b"
            ].iter().map(|s| s.to_string()).collect(),
            palette_type: PaletteType::Sequential,
        }),
        "Reds" => Some(ColorPalette {
            name: "Reds".to_string(),
            colors: vec![
                "#fff5f0", "#fee0d2", "#fcbba1", "#fc9272", "#fb6a4a",
                "#ef3b2c", "#cb181d", "#a50f15", "#67000d"
            ].iter().map(|s| s.to_string()).collect(),
            palette_type: PaletteType::Sequential,
        }),
        "RdYlGn" => Some(ColorPalette {
            name: "RdYlGn".to_string(),
            colors: vec![
                "#d73027", "#f46d43", "#fdae61", "#fee08b", "#ffffbf",
                "#d9ef8b", "#a6d96a", "#66bd63", "#1a9850"
            ].iter().map(|s| s.to_string()).collect(),
            palette_type: PaletteType::Diverging,
        }),
        "RdBu" => Some(ColorPalette {
            name: "RdBu".to_string(),
            colors: vec![
                "#b2182b", "#d6604d", "#f4a582", "#fddbc7", "#f7f7f7",
                "#d1e5f0", "#92c5de", "#4393c3", "#2166ac"
            ].iter().map(|s| s.to_string()).collect(),
            palette_type: PaletteType::Diverging,
        }),
        "Viridis" => Some(ColorPalette {
            name: "Viridis".to_string(),
            colors: vec![
                "#440154", "#482878", "#3e4989", "#31688e", "#26828e",
                "#1f9e89", "#35b779", "#6ece58", "#b5de2b", "#fde724"
            ].iter().map(|s| s.to_string()).collect(),
            palette_type: PaletteType::Sequential,
        }),
        _ => None,
    }
}

/// Sélectionner N couleurs d'une palette
pub fn select_colors(palette_name: &str, n_classes: usize) -> Vec<String> {
    let palette = match get_palette(palette_name) {
        Some(p) => p,
        None => return vec!["#cccccc".to_string(); n_classes], // Fallback gris
    };
    
    let colors = &palette.colors;
    
    if n_classes >= colors.len() {
        // Retourner toutes les couleurs
        colors.clone()
    } else {
        // Échantillonner uniformément
        let step = (colors.len() - 1) as f64 / (n_classes - 1) as f64;
        (0..n_classes)
            .map(|i| {
                let idx = (i as f64 * step).round() as usize;
                colors[idx].clone()
            })
            .collect()
    }
}

/// Lister toutes les palettes disponibles
pub fn list_palettes() -> Vec<String> {
    vec![
        "Blues", "Greens", "Reds",
        "RdYlGn", "RdBu",
        "Viridis"
    ].iter().map(|s| s.to_string()).collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_get_palette() {
        let palette = get_palette("Blues").unwrap();
        assert_eq!(palette.name, "Blues");
        assert_eq!(palette.colors.len(), 9);
    }
    
    #[test]
    fn test_select_colors() {
        let colors = select_colors("Blues", 5);
        assert_eq!(colors.len(), 5);
        assert_eq!(colors[0], "#f7fbff"); // Premier
        assert_eq!(colors[4], "#08306b"); // Dernier
    }
}
```

---

### Calculs Statistiques (`thematic/statistics.rs`)

```rust
use statrs::statistics::{Data, OrderStatistics, Statistics as StatrsStats};
use crate::thematic::types::{Statistics, Quantiles};

/// Calculer les statistiques descriptives d'un ensemble de valeurs
pub fn calculate_statistics(values: &[f64]) -> Statistics {
    if values.is_empty() {
        return Statistics {
            min: 0.0,
            max: 0.0,
            mean: 0.0,
            median: 0.0,
            stddev: 0.0,
            variance: 0.0,
            quantiles: Quantiles {
                q25: 0.0,
                q50: 0.0,
                q75: 0.0,
                q90: 0.0,
                q95: 0.0,
            },
            count: 0,
            null_count: 0,
        };
    }
    
    let mut data = Data::new(values.to_vec());
    
    Statistics {
        min: data.min(),
        max: data.max(),
        mean: data.mean().unwrap_or(0.0),
        median: data.median(),
        stddev: data.std_dev().unwrap_or(0.0),
        variance: data.variance().unwrap_or(0.0),
        quantiles: Quantiles {
            q25: data.quantile(0.25),
            q50: data.quantile(0.50),
            q75: data.quantile(0.75),
            q90: data.quantile(0.90),
            q95: data.quantile(0.95),
        },
        count: values.len(),
        null_count: 0,
    }
}

/// Détecter les outliers (méthode IQR)
pub fn detect_outliers(values: &[f64]) -> Vec<usize> {
    if values.len() < 4 {
        return vec![];
    }
    
    let mut data = Data::new(values.to_vec());
    let q1 = data.quantile(0.25);
    let q3 = data.quantile(0.75);
    let iqr = q3 - q1;
    
    let lower_bound = q1 - 1.5 * iqr;
    let upper_bound = q3 + 1.5 * iqr;
    
    values.iter()
        .enumerate()
        .filter(|(_, &v)| v < lower_bound || v > upper_bound)
        .map(|(i, _)| i)
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_statistics() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let stats = calculate_statistics(&values);
        assert_eq!(stats.min, 1.0);
        assert_eq!(stats.max, 5.0);
        assert_eq!(stats.mean, 3.0);
        assert_eq!(stats.median, 3.0);
    }
    
    #[test]
    fn test_outliers() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0, 100.0]; // 100 est un outlier
        let outliers = detect_outliers(&values);
        assert_eq!(outliers.len(), 1);
        assert_eq!(outliers[0], 5);
    }
}
```

---

*Suite dans la partie 3 (Routes et Frontend)...*
