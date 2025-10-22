use statrs::statistics::{Data, OrderStatistics, Distribution, Min, Max};
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
#[allow(dead_code)]
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
        assert_eq!(stats.count, 5);
    }
    
    #[test]
    fn test_statistics_empty() {
        let values: Vec<f64> = vec![];
        let stats = calculate_statistics(&values);
        assert_eq!(stats.count, 0);
        assert_eq!(stats.min, 0.0);
    }
    
    #[test]
    fn test_outliers() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0, 100.0]; // 100 est un outlier
        let outliers = detect_outliers(&values);
        assert_eq!(outliers.len(), 1);
        assert_eq!(outliers[0], 5);
    }
    
    #[test]
    fn test_no_outliers() {
        let values = vec![1.0, 2.0, 3.0, 4.0, 5.0];
        let outliers = detect_outliers(&values);
        assert_eq!(outliers.len(), 0);
    }
    
    #[test]
    fn test_outliers_too_few_values() {
        let values = vec![1.0, 2.0];
        let outliers = detect_outliers(&values);
        assert_eq!(outliers.len(), 0);
    }
}
