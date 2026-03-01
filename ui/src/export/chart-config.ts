/**
 * Configuration centralisée des graphes statistiques
 * Style Atlas unifié pour boxplots, histogrammes et scatterplots
 * 
 * v3.4.2 - Cohérence Visuelle
 */

import { THEMATIC_PALETTE_MAP, getRecommendedPalette } from '../thematic/thematic-types';

// ============================================================================
// Style Atlas - Constantes visuelles
// ============================================================================

export const ATLAS_CHART_STYLE = {
  // Polices
  fonts: {
    family: 'Arial, Helvetica, sans-serif',
    title: {
      size: 14,
      weight: 'bold' as const
    },
    subtitle: {
      size: 11,
      weight: 'normal' as const
    },
    axis: {
      size: 11,
      weight: 'normal' as const
    },
    legend: {
      size: 10,
      weight: 'normal' as const
    },
    annotation: {
      size: 9,
      weight: 'normal' as const
    }
  },
  
  // Couleurs
  colors: {
    background: '#f8f9fa',
    gridLine: '#e0e0e0',
    axisLine: '#333333',
    text: '#1f2937',
    textLight: '#6b7280',
    thresholdLine: '#dc2626',
    regressionLine: '#3b82f6',
    confidenceBand: 'rgba(59, 130, 246, 0.1)'
  },
  
  // Dimensions
  dimensions: {
    width: 800,
    height: 600,
    margin: {
      top: 60,
      right: 30,
      bottom: 80,
      left: 70
    }
  },
  
  // Grille
  grid: {
    display: true,
    color: '#e0e0e0',
    lineWidth: 0.5,
    drawBorder: true
  }
};

// ============================================================================
// Configuration par type de graphe
// ============================================================================

export interface BoxplotConfig {
  title: string;
  subtitle?: string;
  yAxisLabel: string;
  unit: string;
  parameterId: string;
  groupBy?: 'adm1' | 'adm2' | 'adm3';
  showOutliers?: boolean;
  showMean?: boolean;
  thresholds?: number[];
}

export interface HistogramConfig {
  title: string;
  subtitle?: string;
  xAxisLabel: string;
  yAxisLabel: string;
  unit: string;
  parameterId: string;
  binMethod?: 'freedman-diaconis' | 'sturges' | 'scott' | 'fixed';
  binCount?: number;
  showClassThresholds?: boolean;
  classBreaks?: number[];
  showStats?: boolean;
}

export interface ScatterplotConfig {
  title: string;
  subtitle?: string;
  xAxisLabel: string;
  yAxisLabel: string;
  xUnit: string;
  yUnit: string;
  xParameterId: string;
  yParameterId: string;
  showRegression?: boolean;
  showConfidenceBand?: boolean;
  showCorrelation?: boolean;
  minSondages?: number;
  colorBy?: string;
}

// ============================================================================
// Configurations par défaut pour chaque thématique
// ============================================================================

export const DEFAULT_BOXPLOT_CONFIGS: Record<string, Partial<BoxplotConfig>> = {
  vbs_avg: {
    title: 'Distribution VBS par préfecture',
    yAxisLabel: 'VBS moyen',
    unit: 'g/100g',
    groupBy: 'adm2',
    showOutliers: true,
    showMean: true,
    thresholds: [0.2, 1.5, 2.5, 6, 8]
  },
  ip_avg: {
    title: 'Distribution IP par préfecture',
    yAxisLabel: 'Indice de plasticité',
    unit: '%',
    groupBy: 'adm2',
    showOutliers: true,
    showMean: true,
    thresholds: [7, 12, 25, 40]
  },
  eg_avg: {
    title: 'Distribution Eg par préfecture',
    yAxisLabel: 'Potentiel de gonflement',
    unit: '%',
    groupBy: 'adm2',
    showOutliers: true,
    showMean: true,
    thresholds: [0.5, 2, 5, 10]
  },
  passant_80um_avg: {
    title: 'Distribution % fines par préfecture',
    yAxisLabel: 'Passant 80µm',
    unit: '%',
    groupBy: 'adm2',
    showOutliers: true,
    showMean: true,
    thresholds: [12, 35, 50, 70]
  }
};

export const DEFAULT_HISTOGRAM_CONFIGS: Record<string, Partial<HistogramConfig>> = {
  vbs_avg: {
    title: 'Distribution des valeurs VBS',
    xAxisLabel: 'VBS moyen',
    yAxisLabel: 'Nombre de mailles',
    unit: 'g/100g',
    binMethod: 'freedman-diaconis',
    showClassThresholds: true,
    classBreaks: [0.2, 1.5, 2.5, 6, 8],
    showStats: true
  },
  ip_avg: {
    title: 'Distribution des valeurs IP',
    xAxisLabel: 'Indice de plasticité',
    yAxisLabel: 'Nombre de mailles',
    unit: '%',
    binMethod: 'freedman-diaconis',
    showClassThresholds: true,
    classBreaks: [7, 12, 25, 40],
    showStats: true
  },
  eg_avg: {
    title: 'Distribution du potentiel de gonflement',
    xAxisLabel: 'Gonflement Eg',
    yAxisLabel: 'Nombre de mailles',
    unit: '%',
    binMethod: 'freedman-diaconis',
    showClassThresholds: true,
    classBreaks: [0.5, 2, 5, 10],
    showStats: true
  },
  passant_80um_avg: {
    title: 'Distribution des fines (<80µm)',
    xAxisLabel: 'Passant 80µm',
    yAxisLabel: 'Nombre de mailles',
    unit: '%',
    binMethod: 'freedman-diaconis',
    showClassThresholds: true,
    classBreaks: [12, 35, 50, 70],
    showStats: true
  }
};

export const DEFAULT_SCATTERPLOT_CONFIGS: Array<ScatterplotConfig> = [
  {
    title: 'Corrélation VBS vs IP',
    xAxisLabel: 'Indice de plasticité',
    yAxisLabel: 'VBS moyen',
    xUnit: '%',
    yUnit: 'g/100g',
    xParameterId: 'ip_avg',
    yParameterId: 'vbs_avg',
    showRegression: true,
    showCorrelation: true,
    minSondages: 2
  },
  {
    title: 'Corrélation VBS vs % fines',
    xAxisLabel: 'Passant 80µm',
    yAxisLabel: 'VBS moyen',
    xUnit: '%',
    yUnit: 'g/100g',
    xParameterId: 'passant_80um_avg',
    yParameterId: 'vbs_avg',
    showRegression: true,
    showCorrelation: true,
    minSondages: 2
  },
  {
    title: 'Corrélation Eg vs VBS',
    xAxisLabel: 'VBS moyen',
    yAxisLabel: 'Gonflement Eg',
    xUnit: 'g/100g',
    yUnit: '%',
    xParameterId: 'vbs_avg',
    yParameterId: 'eg_avg',
    showRegression: true,
    showCorrelation: true,
    minSondages: 2
  },
  {
    title: 'Corrélation Eg vs IP',
    xAxisLabel: 'Indice de plasticité',
    yAxisLabel: 'Gonflement Eg',
    xUnit: '%',
    yUnit: '%',
    xParameterId: 'ip_avg',
    yParameterId: 'eg_avg',
    showRegression: true,
    showCorrelation: true,
    minSondages: 2
  }
];

// ============================================================================
// Fonctions utilitaires
// ============================================================================

/**
 * Récupère la couleur principale pour un paramètre thématique
 */
export function getThematicColor(parameterId: string): string {
  const config = getRecommendedPalette(parameterId);
  // Retourner une couleur représentative de la palette
  const paletteColors: Record<string, string> = {
    'Greens': '#22c55e',
    'YlOrRd': '#f97316',
    'PuRd': '#db2777',
    'PuBu': '#3b82f6',
    'BuPu': '#8b5cf6',
    'Blues': '#3b82f6',
    'Oranges': '#f97316',
    'BrBG': '#78716c',
    'YlGnBu': '#06b6d4',
    'Reds': '#ef4444'
  };
  return paletteColors[config.palette] || '#3b82f6';
}

/**
 * Génère le footer statistique pour un graphe
 */
export function generateStatsFooter(stats: {
  n: number;
  mean: number;
  median: number;
  min: number;
  max: number;
  q1?: number;
  q3?: number;
}, unit: string): string {
  let footer = `n = ${stats.n} | moy = ${stats.mean.toFixed(2)} ${unit}`;
  footer += ` | médiane = ${stats.median.toFixed(2)}`;
  
  if (stats.q1 !== undefined && stats.q3 !== undefined) {
    footer += ` | Q1–Q3 = ${stats.q1.toFixed(2)}–${stats.q3.toFixed(2)}`;
  }
  
  footer += ` | min = ${stats.min.toFixed(2)} | max = ${stats.max.toFixed(2)}`;
  
  return footer;
}

/**
 * Génère l'annotation de corrélation pour un scatterplot
 */
export function generateCorrelationAnnotation(stats: {
  r: number;
  r2: number;
  pValue?: number;
  n: number;
}): string {
  let annotation = `R² = ${stats.r2.toFixed(3)} | r = ${stats.r.toFixed(3)}`;
  
  if (stats.pValue !== undefined) {
    const pFormatted = stats.pValue < 0.001 ? '< 0.001' : stats.pValue.toFixed(3);
    annotation += ` | p = ${pFormatted}`;
  }
  
  annotation += ` | n = ${stats.n}`;
  
  // Ajouter interprétation
  const absR = Math.abs(stats.r);
  let interpretation = '';
  if (absR < 0.3) {
    interpretation = 'Corrélation faible';
  } else if (absR < 0.5) {
    interpretation = 'Corrélation modérée';
  } else if (absR < 0.7) {
    interpretation = 'Corrélation moyenne';
  } else {
    interpretation = 'Corrélation forte';
  }
  
  return `${annotation}\n${interpretation}`;
}

/**
 * Calcule le nombre optimal de bins pour un histogramme
 * Méthode Freedman-Diaconis
 */
export function calculateOptimalBins(data: number[]): number {
  if (data.length < 2) return 1;
  
  const sorted = [...data].sort((a, b) => a - b);
  const n = sorted.length;
  
  // Calcul IQR
  const q1Index = Math.floor(n * 0.25);
  const q3Index = Math.floor(n * 0.75);
  const q1 = sorted[q1Index];
  const q3 = sorted[q3Index];
  const iqr = q3 - q1;
  
  // Freedman-Diaconis
  const binWidth = 2 * iqr * Math.pow(n, -1/3);
  
  if (binWidth === 0) {
    // Fallback Sturges si IQR = 0
    return Math.ceil(Math.log2(n) + 1);
  }
  
  const range = sorted[n - 1] - sorted[0];
  const bins = Math.ceil(range / binWidth);
  
  // Limiter entre 5 et 30 bins
  return Math.max(5, Math.min(30, bins));
}

/**
 * Calcule les statistiques de régression linéaire
 */
export function calculateRegression(xData: number[], yData: number[]): {
  slope: number;
  intercept: number;
  r: number;
  r2: number;
  pValue?: number;
} {
  const n = xData.length;
  if (n < 2) {
    return { slope: 0, intercept: 0, r: 0, r2: 0 };
  }
  
  // Moyennes
  const xMean = xData.reduce((a, b) => a + b, 0) / n;
  const yMean = yData.reduce((a, b) => a + b, 0) / n;
  
  // Sommes pour régression
  let ssXX = 0, ssYY = 0, ssXY = 0;
  for (let i = 0; i < n; i++) {
    const dx = xData[i] - xMean;
    const dy = yData[i] - yMean;
    ssXX += dx * dx;
    ssYY += dy * dy;
    ssXY += dx * dy;
  }
  
  // Pente et ordonnée à l'origine
  const slope = ssXX !== 0 ? ssXY / ssXX : 0;
  const intercept = yMean - slope * xMean;
  
  // Coefficient de corrélation
  const r = ssXX !== 0 && ssYY !== 0 ? ssXY / Math.sqrt(ssXX * ssYY) : 0;
  const r2 = r * r;
  
  // P-value approximative (test t)
  let pValue: number | undefined;
  if (n > 2 && r !== 0) {
    const t = r * Math.sqrt((n - 2) / (1 - r2));
    // Approximation de la p-value pour un test bilatéral
    const df = n - 2;
    pValue = 2 * (1 - tDistributionCDF(Math.abs(t), df));
  }
  
  return { slope, intercept, r, r2, pValue };
}

/**
 * Approximation de la CDF de la distribution t de Student
 */
function tDistributionCDF(t: number, df: number): number {
  // Approximation simple pour df > 30
  if (df > 30) {
    // Utiliser approximation normale
    const z = t;
    return 0.5 * (1 + erf(z / Math.sqrt(2)));
  }
  
  // Pour df <= 30, utiliser une approximation plus précise
  const x = df / (df + t * t);
  const a = df / 2;
  const b = 0.5;
  
  // Beta incomplète régularisée (approximation)
  const beta = incompleteBeta(x, a, b);
  
  return t >= 0 ? 1 - beta / 2 : beta / 2;
}

/**
 * Fonction d'erreur (erf)
 */
function erf(x: number): number {
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

/**
 * Approximation de la fonction bêta incomplète
 */
function incompleteBeta(x: number, a: number, b: number): number {
  // Approximation simple
  if (x === 0) return 0;
  if (x === 1) return 1;
  
  // Utiliser une série pour l'approximation
  let sum = 0;
  let term = 1;
  for (let n = 0; n < 100; n++) {
    sum += term;
    term *= (a + n) * x / ((a + b + n) * (n + 1));
    if (Math.abs(term) < 1e-10) break;
  }
  
  return Math.pow(x, a) * sum / a;
}

// ============================================================================
// Export des configurations Chart.js
// ============================================================================

/**
 * Génère les options Chart.js pour le style Atlas
 */
export function getChartJsOptions(type: 'bar' | 'line' | 'scatter'): any {
  return {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        font: {
          family: ATLAS_CHART_STYLE.fonts.family,
          size: ATLAS_CHART_STYLE.fonts.title.size,
          weight: ATLAS_CHART_STYLE.fonts.title.weight
        },
        color: ATLAS_CHART_STYLE.colors.text
      }
    },
    scales: {
      x: {
        grid: {
          display: ATLAS_CHART_STYLE.grid.display,
          color: ATLAS_CHART_STYLE.grid.color,
          lineWidth: ATLAS_CHART_STYLE.grid.lineWidth
        },
        ticks: {
          font: {
            family: ATLAS_CHART_STYLE.fonts.family,
            size: ATLAS_CHART_STYLE.fonts.axis.size
          },
          color: ATLAS_CHART_STYLE.colors.text
        }
      },
      y: {
        grid: {
          display: ATLAS_CHART_STYLE.grid.display,
          color: ATLAS_CHART_STYLE.grid.color,
          lineWidth: ATLAS_CHART_STYLE.grid.lineWidth
        },
        ticks: {
          font: {
            family: ATLAS_CHART_STYLE.fonts.family,
            size: ATLAS_CHART_STYLE.fonts.axis.size
          },
          color: ATLAS_CHART_STYLE.colors.text
        }
      }
    }
  };
}
