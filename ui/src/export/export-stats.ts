/**
 * Statistiques pour l'export de cartes thématiques
 * Atlas Géotechnique v3.1 - Stats enrichies avec contexte parent
 */

export interface ExportStatsRow {
  label: string;
  value: string;
  unit?: string;
  highlight?: boolean; // Pour mettre en évidence certaines lignes
}

export interface ExportStats {
  title: string;
  subtitle?: string;
  rows: ExportStatsRow[];
  // Section contexte multi-niveaux (optionnelle)
  contextRows?: ExportStatsRow[];
}

/** Contexte parent depuis l'API */
export interface ParentContext {
  level: string;       // adm0, adm1, adm2
  parent_name: string;
  parent_sum: number;
  parent_cells: number;
}

/** Statistiques enrichies depuis l'API */
export interface ApiStatistics {
  min?: number;
  max?: number;
  mean?: number;
  median?: number;
  stddev?: number;
  count: number;           // Mailles avec données (après filtres)
  null_count?: number;     // Mailles sans données
  count_total?: number;    // Total mailles dans la zone
  sum?: number;            // Somme des valeurs
  parent_context?: ParentContext;
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
 * Construit les statistiques d'export selon la thématique
 * Utilise les stats API enrichies si disponibles, sinon calcule depuis les features
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
    // Fallback: calculer depuis les features
    nMaillesTotales = totalCellCount || features.length;
    nMaillesAvecDonnees = features.filter(f => {
      const val = f.properties?.value ?? f.value ?? f.properties?.[parameterId] ?? f[parameterId];
      return val !== null && val !== undefined && val > 0;
    }).length;
    
    values = features
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
  
  // Stats selon la thématique
  switch (parameterId) {
    case 'n_sondages':
      stats.rows = buildSondagesStatsEnriched(apiStats, values, sum, nMaillesTotales, nMaillesAvecDonnees, classes);
      break;
    case 'vbs_avg':
    case 'vbs_moy':
    case 'vbs_mean':
      stats.rows = buildVbsStatsEnriched(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'ip_avg':
    case 'ip_moy':
    case 'ip_mean':
      stats.rows = buildIpStatsEnriched(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    case 'profondeur_max':
    case 'depth_max':
      stats.rows = buildDepthStatsEnriched(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    default:
      stats.rows = buildGenericStatsEnriched(apiStats, values, nMaillesTotales, nMaillesAvecDonnees, parameterLabel, unit);
  }
  
  // Ajouter le contexte parent si disponible
  if (apiStats?.parent_context) {
    stats.contextRows = buildParentContextRows(apiStats.parent_context, sum, nMaillesAvecDonnees);
  }
  
  return stats;
}

// ============================================================================
// FONCTIONS STATS ENRICHIES (utilisent apiStats si disponible)
// ============================================================================

/**
 * Stats enrichies pour "Nombre de sondages"
 */
function buildSondagesStatsEnriched(
  apiStats: ApiStatistics | undefined,
  values: number[],
  sum: number,
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  classes: any[]
): ExportStatsRow[] {
  const total = apiStats?.sum ?? sum;
  const moyenne = nMaillesAvecDonnees > 0 ? total / nMaillesAvecDonnees : 0;
  const couverture = nMaillesTotales > 0 ? (nMaillesAvecDonnees / nMaillesTotales * 100) : 0;
  
  const rows: ExportStatsRow[] = [
    { label: 'Sondages total', value: Math.round(total).toString(), highlight: true },
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture.toFixed(1), unit: '%' },
    { label: 'Moyenne par maille', value: moyenne.toFixed(1) }
  ];
  
  // Mailles denses (≥3 sondages) - utile pour planification
  if (values.length > 0) {
    const nDenses = values.filter(v => v >= 3).length;
    rows.push({ label: 'Mailles denses (≥3)', value: nDenses.toString() });
  }
  
  return rows;
}

/**
 * Stats enrichies pour VBS (argilosité)
 */
function buildVbsStatsEnriched(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  unit: string
): ExportStatsRow[] {
  const moyenne = apiStats?.mean ?? (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const min = apiStats?.min ?? (values.length > 0 ? Math.min(...values) : 0);
  const max = apiStats?.max ?? (values.length > 0 ? Math.max(...values) : 0);
  const couverture = nMaillesTotales > 0 ? (nMaillesAvecDonnees / nMaillesTotales * 100) : 0;
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture.toFixed(1), unit: '%' },
    { label: 'VBS moyen', value: moyenne.toFixed(2), unit: unit || 'g/100g', highlight: true },
    { label: 'VBS min / max', value: `${min.toFixed(2)} / ${max.toFixed(2)}`, unit: unit || 'g/100g' }
  ];
}

/**
 * Stats enrichies pour IP (plasticité)
 */
function buildIpStatsEnriched(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  unit: string
): ExportStatsRow[] {
  const moyenne = apiStats?.mean ?? (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const min = apiStats?.min ?? (values.length > 0 ? Math.min(...values) : 0);
  const max = apiStats?.max ?? (values.length > 0 ? Math.max(...values) : 0);
  const couverture = nMaillesTotales > 0 ? (nMaillesAvecDonnees / nMaillesTotales * 100) : 0;
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture.toFixed(1), unit: '%' },
    { label: 'IP moyen', value: moyenne.toFixed(1), unit: unit || '%', highlight: true },
    { label: 'IP min / max', value: `${min.toFixed(1)} / ${max.toFixed(1)}`, unit: unit || '%' }
  ];
}

/**
 * Stats enrichies pour profondeur d'investigation
 */
function buildDepthStatsEnriched(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  unit: string
): ExportStatsRow[] {
  const moyenne = apiStats?.mean ?? (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const min = apiStats?.min ?? (values.length > 0 ? Math.min(...values) : 0);
  const max = apiStats?.max ?? (values.length > 0 ? Math.max(...values) : 0);
  const couverture = nMaillesTotales > 0 ? (nMaillesAvecDonnees / nMaillesTotales * 100) : 0;
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture.toFixed(1), unit: '%' },
    { label: 'Profondeur moyenne', value: moyenne.toFixed(2), unit: unit || 'm', highlight: true },
    { label: 'Prof. min / max', value: `${min.toFixed(2)} / ${max.toFixed(2)}`, unit: unit || 'm' }
  ];
}

/**
 * Stats enrichies génériques
 */
function buildGenericStatsEnriched(
  apiStats: ApiStatistics | undefined,
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  parameterLabel: string,
  unit: string
): ExportStatsRow[] {
  const moyenne = apiStats?.mean ?? (values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : 0);
  const min = apiStats?.min ?? (values.length > 0 ? Math.min(...values) : 0);
  const max = apiStats?.max ?? (values.length > 0 ? Math.max(...values) : 0);
  const couverture = nMaillesTotales > 0 ? (nMaillesAvecDonnees / nMaillesTotales * 100) : 0;
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture.toFixed(1), unit: '%' },
    { label: 'Moyenne', value: moyenne.toFixed(2), unit, highlight: true },
    { label: 'Min / Max', value: `${min.toFixed(2)} / ${max.toFixed(2)}`, unit }
  ];
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

// ============================================================================
// FONCTIONS LEGACY (conservées pour compatibilité)
// ============================================================================

/**
 * Stats génériques legacy
 */
function buildGenericStats(
  values: number[],
  nMailles: number,
  nMaillesAvecDonnees: number,
  parameterLabel: string,
  unit: string
): ExportStatsRow[] {
  const moyenne = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const couverture = (nMaillesAvecDonnees / nMailles * 100).toFixed(1);
  
  return [
    { label: 'Moyenne', value: moyenne.toFixed(2), unit },
    { label: 'Min', value: min.toFixed(2), unit },
    { label: 'Max', value: max.toFixed(2), unit },
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMailles}` },
    { label: 'Couverture', value: couverture, unit: '%' }
  ];
}
