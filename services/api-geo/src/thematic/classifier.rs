use statrs::statistics::{Data, OrderStatistics};
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
/// Fallback vers quantiles si > 1000 valeurs (performance)
pub fn classify_jenks(values: &[f64], n_classes: usize) -> Result<Vec<f64>, String> {
    if values.is_empty() {
        return Err("Aucune valeur fournie".to_string());
    }
    if n_classes < 2 || n_classes >= values.len() {
        return Err("Nombre de classes invalide".to_string());
    }
    
    // Fallback vers quantiles si trop de valeurs (performance)
    if values.len() > 1000 {
        eprintln!("⚠️  Jenks: {} valeurs > 1000, fallback vers quantiles", values.len());
        return classify_quantiles(values, n_classes);
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
        // Vérifier que les breaks sont croissants
        assert!(breaks[0] < breaks[1]);
        assert!(breaks[1] < breaks[2]);
    }
    
    #[test]
    fn test_equal_interval() {
        let breaks = classify_equal_interval(0.0, 100.0, 5).unwrap();
        assert_eq!(breaks, vec![20.0, 40.0, 60.0, 80.0]);
    }
    
    #[test]
    fn test_equal_interval_errors() {
        assert!(classify_equal_interval(0.0, 100.0, 1).is_err());
        assert!(classify_equal_interval(100.0, 0.0, 5).is_err());
    }
    
    #[test]
    fn test_jenks_small() {
        let values = vec![1.0, 2.0, 3.0, 10.0, 11.0, 12.0, 20.0, 21.0, 22.0];
        let breaks = classify_jenks(&values, 3).unwrap();
        assert_eq!(breaks.len(), 2);
        // Jenks devrait identifier les 3 groupes naturels
        assert!(breaks[0] > 3.0 && breaks[0] < 10.0);
        assert!(breaks[1] > 12.0 && breaks[1] < 20.0);
    }
    
    #[test]
    fn test_jenks_fallback() {
        // Trop de valeurs → fallback vers quantiles
        let values: Vec<f64> = (0..1500).map(|i| i as f64).collect();
        let breaks = classify_jenks(&values, 5).unwrap();
        assert_eq!(breaks.len(), 4);
    }
    
    #[test]
    fn test_labels() {
        let breaks = vec![10.0, 20.0, 30.0];
        let labels = generate_labels(&breaks, 1);
        assert_eq!(labels.len(), 4);
        assert_eq!(labels[0], "< 10.0");
        assert_eq!(labels[1], "10.0 - 20.0");
        assert_eq!(labels[2], "20.0 - 30.0");
        assert_eq!(labels[3], "≥ 30.0");
    }
    
    #[test]
    fn test_labels_precision() {
        let breaks = vec![10.123, 20.456];
        let labels = generate_labels(&breaks, 2);
        assert_eq!(labels[0], "< 10.12");
        assert_eq!(labels[2], "≥ 20.46");
    }
}
