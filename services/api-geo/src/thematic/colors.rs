/// Palettes de couleurs prédéfinies (ColorBrewer)
#[derive(Debug, Clone)]
pub struct ColorPalette {
    #[allow(dead_code)]
    pub name: String,
    pub colors: Vec<String>,
    #[allow(dead_code)]
    pub palette_type: PaletteType,
}

#[derive(Debug, Clone, PartialEq)]
pub enum PaletteType {
    Sequential,  // Une couleur, intensité croissante
    Diverging,   // Deux couleurs opposées
    #[allow(dead_code)]
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
        None => {
            eprintln!("⚠️  Palette '{}' inconnue, fallback vers 'Blues'", palette_name);
            get_palette("Blues").unwrap()
        }
    };
    
    let colors = &palette.colors;
    
    if n_classes >= colors.len() {
        // Retourner toutes les couleurs
        colors.clone()
    } else if n_classes == 0 {
        vec![]
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
        assert_eq!(palette.palette_type, PaletteType::Sequential);
    }
    
    #[test]
    fn test_get_palette_diverging() {
        let palette = get_palette("RdYlGn").unwrap();
        assert_eq!(palette.palette_type, PaletteType::Diverging);
    }
    
    #[test]
    fn test_get_palette_unknown() {
        let palette = get_palette("Unknown");
        assert!(palette.is_none());
    }
    
    #[test]
    fn test_select_colors() {
        let colors = select_colors("Blues", 5);
        assert_eq!(colors.len(), 5);
        assert_eq!(colors[0], "#f7fbff"); // Premier
        assert_eq!(colors[4], "#08306b"); // Dernier
    }
    
    #[test]
    fn test_select_colors_more_than_available() {
        let colors = select_colors("Blues", 15);
        assert_eq!(colors.len(), 9); // Toutes les couleurs disponibles
    }
    
    #[test]
    fn test_select_colors_unknown_palette() {
        let colors = select_colors("Unknown", 3);
        assert_eq!(colors.len(), 3); // Fallback vers Blues
    }
    
    #[test]
    fn test_list_palettes() {
        let palettes = list_palettes();
        assert!(palettes.contains(&"Blues".to_string()));
        assert!(palettes.contains(&"RdYlGn".to_string()));
        assert!(palettes.contains(&"Viridis".to_string()));
    }
}
