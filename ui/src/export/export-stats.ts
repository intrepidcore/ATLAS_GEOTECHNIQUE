/**
 * Statistiques pour l'export de cartes thématiques
 * Atlas Géotechnique v3.2 - Stats ingénieur complètes par thématique
 * 
 * Organisation:
 * 1. Socle commun (mailles, couverture, fiabilité, comparaison parent)
 * 2. Stats spécifiques par thématique
 */

export interface ExportStatsRow {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean;
}

export interface ExportStats {
  title: string;
  subtitle?: string;
  rows: ExportStatsRow[];
  contextRows?: ExportStatsRow[];
}

export interface ParentContext {
  level: string;
  parent_name: string;
  parent_sum: number;
  parent_cells: number;
  parent_mean?: number;
}

export interface ApiStatistics {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stddev?: number;
  count: number;
  null_count?: number;
  count_total?: number;
  sum?: number;
  parent_context?: ParentContext;
}

// ============================================================================
// FORMATAGE ROBUSTE - Évite les bugs d'affichage
// ============================================================================

/**
 * Formate un nombre de manière robuste
 * Gère null, undefined, NaN, Infinity
 */
function formatNumber(value: number | null | undefined, decimals: number = 2, fallback: string = '—'): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return fallback;
  }
  // Arrondir et formater
  const rounded = Number(value.toFixed(decimals));
  // Supprimer les zéros inutiles après la virgule
  if (decimals > 0 && rounded === Math.floor(rounded)) {
    return rounded.toFixed(0);
  }
  return rounded.toFixed(decimals);
}

/**
 * Formate un pourcentage
 */
function formatPercent(value: number | null | undefined, decimals: number = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return '—';
  }
  return `${value.toFixed(decimals)} %`;
}

/**
 * Formate une plage de valeurs
 */
function formatRange(min: number | null | undefined, max: number | null | undefined, decimals: number = 2): string {
  const minStr = formatNumber(min, decimals);
  const maxStr = formatNumber(max, decimals);
  return `${minStr} / ${maxStr}`;
}

/**
 * Formate médiane avec quartiles
 */
function formatMedianWithQuartiles(median: number | null, q1: number | null, q3: number | null, decimals: number = 2): string {
  return `${formatNumber(median, decimals)} (${formatNumber(q1, decimals)}-${formatNumber(q3, decimals)})`;
}

/**
 * Détermine le niveau de fiabilité basé sur le nombre de mailles avec données
 */
function computeReliability(nWithData: number, nTotal: number): { level: string; color: string } {
  const coverage = nTotal > 0 ? (nWithData / nTotal) : 0;
  
  if (nWithData >= 20 && coverage >= 0.3) {
    return { level: 'Bon', color: '#22c55e' };
  } else if (nWithData >= 10 && coverage >= 0.15) {
    return { level: 'Moyen', color: '#f59e0b' };
  } else if (nWithData >= 3) {
    return { level: 'Faible', color: '#ef4444' };
  } else {
    return { level: 'Très faible', color: '#dc2626' };
  }
}

export interface StatsInput {
  parameterId: string;
  parameterLabel: string;
  unit: string;
  // Statistiques enrichies depuis l'API (prioritaire)
  apiStats?: ApiStatistics;
  // Fallback: features brutes
  features?: any[];
  totalCellCount?: number;
  classes?: Array<{ min: number | null; max: number | null; color: string; label: string; count?: number }>;
  admFilters: {
    adm1?: string | { code: string; name: string };
    adm2?: string | { code: string; name: string };
    adm3?: string | { code: string; name: string };
  };
}

/**
 * Filtre les features par ADM (adm1, adm2, adm3)
 * Utilisé pour calculer les stats uniquement sur la zone exportée
 */
function filterFeaturesByAdm(
  features: any[],
  admFilters: StatsInput['admFilters']
): any[] {
  if (!features || features.length === 0) return [];
  
  const getAdmName = (adm: string | { code: string; name: string } | undefined): string | undefined => {
    if (!adm) return undefined;
    if (typeof adm === 'string') return adm;
    return adm.name;
  };
  
  const adm1Name = getAdmName(admFilters.adm1);
  const adm2Name = getAdmName(admFilters.adm2);
  const adm3Name = getAdmName(admFilters.adm3);
  
  // Si aucun filtre ADM, retourner toutes les features
  if (!adm1Name && !adm2Name && !adm3Name) {
    return features;
  }
  
  return features.filter(f => {
    const props = f.properties || f;
    
    // Filtrer par ADM1 si spécifié
    if (adm1Name) {
      const featureAdm1 = props.adm1_name || props.adm1 || props.region;
      if (featureAdm1 && featureAdm1 !== adm1Name) return false;
    }
    
    // Filtrer par ADM2 si spécifié
    if (adm2Name) {
      const featureAdm2 = props.adm2_name || props.adm2 || props.prefecture;
      if (featureAdm2 && featureAdm2 !== adm2Name) return false;
    }
    
    // Filtrer par ADM3 si spécifié
    if (adm3Name) {
      const featureAdm3 = props.adm3_name || props.adm3 || props.commune;
      if (featureAdm3 && featureAdm3 !== adm3Name) return false;
    }
    
    return true;
  });
}

/**
 * Construit les statistiques d'export selon la thématique
 * Utilise les stats API enrichies si disponibles, sinon calcule depuis les features
 * IMPORTANT: Les features sont filtrées par ADM pour refléter uniquement la zone exportée
 */
export function buildExportStats(input: StatsInput): ExportStats {
  const { parameterId, parameterLabel, unit, apiStats, features = [], totalCellCount, classes = [], admFilters } = input;
  
  // Déterminer le nom de la zone
  const getAdmName = (adm: string | { code: string; name: string } | undefined): string | undefined => {
    if (!adm) return undefined;
    if (typeof adm === 'string') return adm;
    return adm.name;
  };
  const zoneName = getAdmName(admFilters.adm3) || getAdmName(admFilters.adm2) || getAdmName(admFilters.adm1) || 'Togo';
  
  // FILTRER les features par ADM avant de calculer les stats
  const filteredFeatures = filterFeaturesByAdm(features, admFilters);
  
  console.log('[ExportStats] Features filtrées par ADM:', {
    totalFeatures: features.length,
    filteredFeatures: filteredFeatures.length,
    admFilters: {
      adm1: getAdmName(admFilters.adm1),
      adm2: getAdmName(admFilters.adm2),
      adm3: getAdmName(admFilters.adm3)
    }
  });
  
  // Utiliser les stats API si disponibles
  let nMaillesTotales: number;
  let nMaillesAvecDonnees: number;
  let sum: number;
  let values: number[];
  
  if (apiStats) {
    // Stats enrichies depuis l'API
    nMaillesTotales = apiStats.count_total ?? (apiStats.count + (apiStats.null_count ?? 0));
    nMaillesAvecDonnees = apiStats.count;
    sum = apiStats.sum ?? 0;
    // Pas de values individuelles, on utilise les stats agrégées
    values = [];
  } else {
    // Fallback: calculer depuis les features FILTRÉES
    nMaillesTotales = totalCellCount || filteredFeatures.length;
    nMaillesAvecDonnees = filteredFeatures.filter(f => {
      const val = f.properties?.value ?? f.value ?? f.properties?.[parameterId] ?? f[parameterId];
      return val !== null && val !== undefined && val > 0;
    }).length;
    
    values = filteredFeatures
      .map(f => f.properties?.value ?? f.value ?? f.properties?.[parameterId] ?? f[parameterId])
      .filter(v => v !== null && v !== undefined && typeof v === 'number' && v > 0) as number[];
    
    sum = values.reduce((a, b) => a + b, 0);
  }
  
  const stats: ExportStats = {
    title: 'Statistiques',
    subtitle: zoneName,
    rows: []
  };
  
  // Vérifier si on a des données
  const hasData = apiStats ? apiStats.count > 0 : values.length > 0;
  if (!hasData) {
    stats.rows.push({ label: 'Données', value: 'Aucune donnée disponible' });
    return stats;
  }
  
  // Stats selon la thématique - Organisation par catégorie métier
  switch (parameterId) {
    // ═══════════════════════════════════════════════════════════════════════
    // COUVERTURE & INSTRUMENTATION
    // ═══════════════════════════════════════════════════════════════════════
    case 'n_sondages':
      stats.rows = buildSondagesStats(apiStats, values, sum, nMaillesTotales, nMaillesAvecDonnees);
      break;
    case 'n_echantillons':
      stats.rows = buildEchantillonsStats(apiStats, values, sum, nMaillesTotales, nMaillesAvecDonnees);
      break;
    case 'n_essais_total':
      stats.rows = buildEssaisStats(apiStats, values, sum, nMaillesTotales, nMaillesAvecDonnees);
      break;
      
    // ═══════════════════════════════════════════════════════════════════════
    // ARGILOSITÉ / PLASTICITÉ
    // ═══════════════════════════════════════════════════════════════════════
    case 'vbs_avg':
    case 'vbs_moy':
    case 'vbs_mean':
      stats.rows = buildVbsStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'ip_avg':
    case 'ip_moy':
    case 'ip_mean':
      stats.rows = buildIpStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'wl_avg':
    case 'wl_moy':
      stats.rows = buildWlStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'wp_avg':
    case 'wp_moy':
      stats.rows = buildWpStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
      
    // ═══════════════════════════════════════════════════════════════════════
    // POTENTIEL DE GONFLEMENT
    // ═══════════════════════════════════════════════════════════════════════
    case 'eg_avg':
    case 'eg_moy':
      stats.rows = buildEgAvgStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'eg_max':
      stats.rows = buildEgMaxStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'eg_min':
      stats.rows = buildEgMinStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
      
    // ═══════════════════════════════════════════════════════════════════════
    // COMPACITÉ / PORTANCE (PROCTOR)
    // ═══════════════════════════════════════════════════════════════════════
    case 'gamma_d_max_avg':
    case 'gamma_d_max':
      stats.rows = buildGammaDMaxStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'w_opt_avg':
    case 'w_opt':
      stats.rows = buildWOptStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
      
    // ═══════════════════════════════════════════════════════════════════════
    // GRANULOMÉTRIE
    // ═══════════════════════════════════════════════════════════════════════
    case 'passant_80um_avg':
    case 'passant_80um':
      stats.rows = buildPassant80umStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'passant_2mm_avg':
    case 'passant_2mm':
      stats.rows = buildPassant2mmStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'passant_20mm_avg':
    case 'passant_20mm':
      stats.rows = buildPassant20mmStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
      
    // ═══════════════════════════════════════════════════════════════════════
    // AUTRES / GÉNÉRIQUE
    // ═══════════════════════════════════════════════════════════════════════
    case 'profondeur_max':
    case 'depth_max':
      stats.rows = buildDepthStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    default:
      stats.rows = buildGenericStats(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, parameterLabel, unit);
  }
  
  // Ajouter le contexte parent si disponible
  if (apiStats?.parent_context) {
    stats.contextRows = buildParentContextRows(apiStats.parent_context, sum, nMaillesAvecDonnees);
  }
  
  return stats;
}

// ============================================================================
// FONCTIONS UTILITAIRES DE CALCUL STATISTIQUE
// ============================================================================

function computeMedian(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

function computeStdDev(values: number[], mean: number): number {
  if (values.length < 2) return 0;
  const squaredDiffs = values.map(v => Math.pow(v - mean, 2));
  const variance = squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(variance);
}

function computeQuartiles(values: number[]): { q1: number | null; q3: number | null } {
  if (values.length < 4) return { q1: null, q3: null };
  const sorted = [...values].sort((a, b) => a - b);
  const q1Idx = Math.floor(sorted.length * 0.25);
  const q3Idx = Math.floor(sorted.length * 0.75);
  return { q1: sorted[q1Idx], q3: sorted[q3Idx] };
}

function computePercentile(values: number[], percentile: number): number | null {
  if (values.length < 5) return null; // Pas assez de données pour percentiles fiables
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * percentile / 100);
  return sorted[Math.min(idx, sorted.length - 1)];
}

/** Extrait les stats de base depuis apiStats ou values */
function extractBaseStats(apiStats: ApiStatistics | undefined, values: number[], nTotal: number, nWithData: number) {
  const mean = apiStats?.mean ?? (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const min = apiStats?.min ?? (values.length > 0 ? Math.min(...values) : null);
  const max = apiStats?.max ?? (values.length > 0 ? Math.max(...values) : null);
  const median = apiStats?.median ?? (values.length > 0 ? computeMedian(values) : null);
  const stddev = apiStats?.stddev ?? computeStdDev(values, mean);
  const cv = mean > 0 ? (stddev / mean) : 0;
  const coverage = nTotal > 0 ? (nWithData / nTotal * 100) : 0;
  const { q1, q3 } = computeQuartiles(values);
  const p10 = computePercentile(values, 10);
  const p90 = computePercentile(values, 90);
  const reliability = computeReliability(nWithData, nTotal);
  
  return { mean, min, max, median, stddev, cv, coverage, q1, q3, p10, p90, reliability };
}

// ============================================================================
// 1. COUVERTURE & INSTRUMENTATION
// ============================================================================

/** Stats pour Nombre de sondages (n_sondages) */
function buildSondagesStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  sum: number,
  nTotal: number,
  nWithData: number
): ExportStatsRow[] {
  let total = apiStats?.sum ?? sum;
  if (total === 0 && apiStats?.mean && apiStats.count > 0) total = apiStats.mean * apiStats.count;
  if (total === 0 && values.length > 0) total = values.reduce((a, b) => a + b, 0);
  
  const { mean, median, max, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  
  // Mailles denses (≥3 sondages)
  const nDenses = values.filter(v => v >= 3).length;
  const pctDenses = nWithData > 0 ? (nDenses / nWithData * 100) : 0;
  
  // Densité surfacique (mailles 2x2 km = 4 km²)
  const aireZoneKm2 = nTotal * 4;
  const densiteSurfacique = aireZoneKm2 > 0 ? (total / aireZoneKm2 * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Sondages total', value: formatNumber(total, 0), highlight: true },
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Moyenne / maille', value: formatNumber(mean, 2) },
    { label: 'Médiane', value: formatNumber(median, 1) },
    { label: 'Max / maille', value: formatNumber(max, 0) },
    { label: 'Mailles denses (≥3)', value: `${nDenses} (${formatNumber(pctDenses, 0)}%)` },
    { label: 'Densité', value: `${formatNumber(densiteSurfacique, 1)} / 100 km²` }
  ];
  
  return rows;
}

/** Stats pour Nombre d'échantillons (n_echantillons) */
function buildEchantillonsStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  sum: number,
  nTotal: number,
  nWithData: number
): ExportStatsRow[] {
  let total = apiStats?.sum ?? sum;
  if (total === 0 && values.length > 0) total = values.reduce((a, b) => a + b, 0);
  
  const { mean, median, max, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  
  const rows: ExportStatsRow[] = [
    { label: 'Échantillons total', value: formatNumber(total, 0), highlight: true },
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Moyenne / maille', value: formatNumber(mean, 2) },
    { label: 'Médiane', value: formatNumber(median, 1) },
    { label: 'Max / maille', value: formatNumber(max, 0) }
  ];
  
  return rows;
}

/** Stats pour Nombre d'essais (n_essais_total) */
function buildEssaisStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  sum: number,
  nTotal: number,
  nWithData: number
): ExportStatsRow[] {
  let total = apiStats?.sum ?? sum;
  if (total === 0 && values.length > 0) total = values.reduce((a, b) => a + b, 0);
  
  const { mean, median, max, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  
  const rows: ExportStatsRow[] = [
    { label: 'Essais total', value: formatNumber(total, 0), highlight: true },
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Moyenne / maille', value: formatNumber(mean, 2) },
    { label: 'Médiane', value: formatNumber(median, 1) },
    { label: 'Max / maille', value: formatNumber(max, 0) }
  ];
  
  return rows;
}

// ============================================================================
// 2. ARGILOSITÉ / PLASTICITÉ
// ============================================================================

/** Classification VBS selon seuils standards */
function classifyVBS(value: number | null): string {
  if (value === null) return '—';
  if (value >= 8) return 'Très argileux';
  if (value >= 6) return 'Argileux';
  if (value >= 2.5) return 'Limoneux';
  if (value >= 1.5) return 'Sablo-limoneux';
  if (value >= 0.2) return 'Sableux';
  return 'Très sableux';
}

/** Stats pour VBS moyen (vbs_avg) */
function buildVbsStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || 'g/100g';
  
  // Classe dominante
  const classeDominante = classifyVBS(median);
  
  // % mailles au-dessus seuil alerte (VBS ≥ 2.5 = sols argileux)
  const nAboveSeuil = values.filter(v => v >= 2.5).length;
  const pctAboveSeuil = values.length > 0 ? (nAboveSeuil / values.length * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'VBS médian (Q1-Q3)', value: `${formatNumber(median, 2)} (${formatNumber(q1, 1)}-${formatNumber(q3, 1)})`, unit: unitStr, highlight: true },
    { label: 'VBS min / max', value: `${formatNumber(min, 2)} / ${formatNumber(max, 2)}`, unit: unitStr },
    { label: 'P10 / P90', value: `${formatNumber(p10, 2)} / ${formatNumber(p90, 2)}`, unit: unitStr },
    { label: 'Classe dominante', value: classeDominante },
    { label: '% sols argileux (≥2.5)', value: `${formatNumber(pctAboveSeuil, 0)}%` }
  ];
  
  return rows;
}

/** Classification IP selon seuils standards */
function classifyIP(value: number | null): string {
  if (value === null) return '—';
  if (value > 40) return 'Très plastique';
  if (value > 25) return 'Plastique';
  if (value > 12) return 'Moyennement plastique';
  if (value > 7) return 'Peu plastique';
  return 'Non plastique';
}

/** Stats pour IP moyen (ip_avg) */
function buildIpStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const classeDominante = classifyIP(median);
  
  // % mailles à risque (IP ≥ 25)
  const nRisque = values.filter(v => v >= 25).length;
  const pctRisque = values.length > 0 ? (nRisque / values.length * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'IP médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'IP min / max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr },
    { label: 'Plasticité dominante', value: classeDominante },
    { label: '% plastiques (IP≥25)', value: `${formatNumber(pctRisque, 0)}%` }
  ];
  
  return rows;
}

/** Stats pour WL moyen (wl_avg) */
function buildWlStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'WL médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'WL min / max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr }
  ];
  
  return rows;
}

/** Stats pour WP moyen (wp_avg) */
function buildWpStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'WP médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'WP min / max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr }
  ];
  
  return rows;
}

// 3. POTENTIEL DE GONFLEMENT
// ============================================================================

/** Classification Eg selon seuils standards */
function classifyEg(value: number | null): string {
  if (value === null) return '—';
  if (value >= 10) return 'Très fort';
  if (value >= 5) return 'Fort';
  if (value >= 2) return 'Modéré';
  if (value >= 0.5) return 'Faible';
  return 'Négligeable';
}

/** Stats pour Eg moyen (eg_avg) */
function buildEgAvgStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  const p95 = computePercentile(values, 95);
  
  const classeDominante = classifyEg(median);
  
  // % mailles au-dessus seuil critique (Eg ≥ 5%)
  const nCritique = values.filter(v => v >= 5).length;
  const pctCritique = values.length > 0 ? (nCritique / values.length * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Eg médian (Q1-Q3)', value: `${formatNumber(median, 2)} (${formatNumber(q1, 1)}-${formatNumber(q3, 1)})`, unit: unitStr, highlight: true },
    { label: 'Eg P95 (pire cas)', value: formatNumber(p95, 2), unit: unitStr },
    { label: 'Eg min / max', value: `${formatNumber(min, 2)} / ${formatNumber(max, 2)}`, unit: unitStr },
    { label: 'Risque dominant', value: classeDominante },
    { label: '% risque fort (≥5%)', value: `${formatNumber(pctCritique, 0)}%` }
  ];
  
  return rows;
}

/** Stats pour Eg max (eg_max) */
function buildEgMaxStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, max, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  const p95 = computePercentile(values, 95);
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Eg max médian', value: formatNumber(median, 2), unit: unitStr, highlight: true },
    { label: 'P90 / P95 / Max', value: `${formatNumber(p90, 1)} / ${formatNumber(p95, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'Risque pire cas', value: classifyEg(max) }
  ];
  
  return rows;
}

/** Stats pour Eg min (eg_min) */
function buildEgMinStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, p10, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Eg min médian', value: formatNumber(median, 2), unit: unitStr, highlight: true },
    { label: 'Min / P10', value: `${formatNumber(min, 2)} / ${formatNumber(p10, 2)}`, unit: unitStr }
  ];
  
  return rows;
}

// ============================================================================
// 4. COMPACITÉ / PORTANCE (PROCTOR)
// ============================================================================

/** Stats pour γd,max moyen (gamma_d_max_avg) */
function buildGammaDMaxStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || 't/m³';
  
  // % mailles faible compacité (γd,max < 1.7)
  const nFaible = values.filter(v => v < 1.7).length;
  const pctFaible = values.length > 0 ? (nFaible / values.length * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'γd,max médian (Q1-Q3)', value: `${formatNumber(median, 2)} (${formatNumber(q1, 2)}-${formatNumber(q3, 2)})`, unit: unitStr, highlight: true },
    { label: 'P10 / P90', value: `${formatNumber(p10, 2)} / ${formatNumber(p90, 2)}`, unit: unitStr },
    { label: 'Min / Max', value: `${formatNumber(min, 2)} / ${formatNumber(max, 2)}`, unit: unitStr },
    { label: '% faible compacité (<1.7)', value: `${formatNumber(pctFaible, 0)}%` }
  ];
  
  return rows;
}

/** Stats pour wopt moyenne (w_opt_avg) */
function buildWOptStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  // Fenêtre de compactage (wopt ± 2%)
  const wOptMin = median !== null ? median - 2 : null;
  const wOptMax = median !== null ? median + 2 : null;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'wopt médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr },
    { label: 'Min / Max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'Fenêtre compactage', value: `${formatNumber(wOptMin, 1)} - ${formatNumber(wOptMax, 1)}`, unit: unitStr }
  ];
  
  return rows;
}

// ============================================================================
// 5. GRANULOMÉTRIE
// ============================================================================

/** Classification fines selon % passant 80µm */
function classifyFines(value: number | null): string {
  if (value === null) return '—';
  if (value >= 70) return 'Très fin (argile)';
  if (value >= 50) return 'Fin (limon argileux)';
  if (value >= 35) return 'Moyen (limon)';
  if (value >= 12) return 'Grossier (sable limoneux)';
  return 'Très grossier (sable/gravier)';
}

/** Stats pour % passant 80µm (passant_80um_avg) */
function buildPassant80umStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const classeDominante = classifyFines(median);
  
  // % mailles à fortes fines (≥50%)
  const nFortesFines = values.filter(v => v >= 50).length;
  const pctFortesFines = values.length > 0 ? (nFortesFines / values.length * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: '% <80µm médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr },
    { label: 'Min / Max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'Texture dominante', value: classeDominante },
    { label: '% fortes fines (≥50%)', value: `${formatNumber(pctFortesFines, 0)}%` }
  ];
  
  return rows;
}

/** Stats pour % passant 2mm (passant_2mm_avg) */
function buildPassant2mmStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const tendance = median === null ? '—' : median >= 80 ? 'Plutôt fin' : median >= 50 ? 'Mixte' : 'Plutôt grossier';
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: '% <2mm médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr },
    { label: 'Min / Max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'Tendance', value: tendance }
  ];
  
  return rows;
}

/** Stats pour % passant 20mm (passant_20mm_avg) */
function buildPassant20mmStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || '%';
  
  const tendance = median === null ? '—' : median >= 90 ? 'Peu de graviers' : median >= 70 ? 'Graviers modérés' : 'Graveleux';
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: '% <20mm médian (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 0)}-${formatNumber(q3, 0)})`, unit: unitStr, highlight: true },
    { label: 'P10 / P90', value: `${formatNumber(p10, 1)} / ${formatNumber(p90, 1)}`, unit: unitStr },
    { label: 'Min / Max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: 'Tendance', value: tendance }
  ];
  
  return rows;
}

// ============================================================================
// 6. AUTRES / GÉNÉRIQUE
// ============================================================================

/** Stats pour profondeur d'investigation */
function buildDepthStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  const unitStr = unit || 'm';
  
  // % profondeur >= 10m
  const nDeep = values.filter(v => v >= 10).length;
  const pctDeep = values.length > 0 ? (nDeep / values.length * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Prof. médiane (Q1-Q3)', value: `${formatNumber(median, 1)} (${formatNumber(q1, 1)}-${formatNumber(q3, 1)})`, unit: unitStr, highlight: true },
    { label: 'Prof. min / max', value: `${formatNumber(min, 1)} / ${formatNumber(max, 1)}`, unit: unitStr },
    { label: '% prof. ≥10m', value: `${formatNumber(pctDeep, 0)}%` }
  ];
  
  return rows;
}

/** Stats génériques pour paramètres non spécifiques */
function buildGenericStats(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nTotal: number,
  nWithData: number,
  parameterLabel: string,
  unit: string
): ExportStatsRow[] {
  const { median, min, max, q1, q3, p10, p90, coverage, reliability } = extractBaseStats(apiStats, values, nTotal, nWithData);
  
  const rows: ExportStatsRow[] = [
    { label: 'Mailles avec données', value: `${nWithData} / ${nTotal}` },
    { label: 'Couverture', value: formatPercent(coverage) },
    { label: 'Fiabilité', value: reliability.level },
    { label: 'Médiane (Q1-Q3)', value: formatMedianWithQuartiles(median, q1, q3), unit, highlight: true },
    { label: 'P10 / P90', value: formatRange(p10, p90), unit },
    { label: 'Min / Max', value: formatRange(min, max), unit }
  ];
  
  return rows;
}

/**
 * Construit les lignes de contexte parent (comparaison multi-niveaux)
 */
function buildParentContextRows(
  parentContext: ParentContext,
  currentSum: number,
  currentCells: number
): ExportStatsRow[] {
  const rows: ExportStatsRow[] = [];
  
  // Part des sondages par rapport au parent
  if (parentContext.parent_sum > 0) {
    const shareSum = (currentSum / parentContext.parent_sum * 100);
    const levelLabel = parentContext.level === 'adm0' ? 'national' 
                     : parentContext.level === 'adm1' ? 'régional'
                     : 'préfectoral';
    rows.push({
      label: `Part ${levelLabel}`,
      value: shareSum.toFixed(1),
      unit: '%'
    });
  }
  
  // Densité relative
  if (parentContext.parent_cells > 0 && currentCells > 0) {
    const parentDensity = parentContext.parent_sum / parentContext.parent_cells;
    const currentDensity = currentSum / currentCells;
    if (parentDensity > 0) {
      const relativeDensity = ((currentDensity / parentDensity) - 1) * 100;
      const sign = relativeDensity >= 0 ? '+' : '';
      rows.push({
        label: `vs ${parentContext.parent_name}`,
        value: `${sign}${relativeDensity.toFixed(0)}%`
      });
    }
  }
  
  return rows;
}

