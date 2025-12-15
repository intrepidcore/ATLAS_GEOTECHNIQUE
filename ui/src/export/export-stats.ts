/**
 * Statistiques pour l'export de cartes thématiques
 * Atlas Géotechnique v3.0.5
 */

export interface ExportStatsRow {
  label: string;
  value: string;
  unit?: string;
}

export interface ExportStats {
  title: string;
  subtitle?: string;
  rows: ExportStatsRow[];
}

export interface StatsInput {
  parameterId: string;
  parameterLabel: string;
  unit: string;
  features: any[];
  totalCellCount?: number; // Nombre total de mailles dans la zone (pour calcul couverture)
  classes: Array<{ min: number | null; max: number | null; color: string; label: string; count?: number }>;
  admFilters: {
    adm1?: string | { code: string; name: string };
    adm2?: string | { code: string; name: string };
    adm3?: string | { code: string; name: string };
  };
}

/**
 * Construit les statistiques d'export selon la thématique
 */
export function buildExportStats(input: StatsInput): ExportStats {
  const { parameterId, parameterLabel, unit, features, totalCellCount, classes, admFilters } = input;
  
  // Déterminer le nom de la zone
  const getAdmName = (adm: string | { code: string; name: string } | undefined): string | undefined => {
    if (!adm) return undefined;
    if (typeof adm === 'string') return adm;
    return adm.name;
  };
  const zoneName = getAdmName(admFilters.adm3) || getAdmName(admFilters.adm2) || getAdmName(admFilters.adm1) || 'Togo';
  
  // Calculer les stats de base
  // nMaillesTotales = totalCellCount si fourni, sinon features.length
  const nMaillesTotales = totalCellCount || features.length;
  const nMaillesAvecDonnees = features.filter(f => {
    const val = f.properties?.[parameterId] ?? f[parameterId];
    return val !== null && val !== undefined && val > 0;
  }).length;
  
  // Extraire les valeurs numériques (uniquement > 0 pour les stats)
  const values = features
    .map(f => f.properties?.[parameterId] ?? f[parameterId])
    .filter(v => v !== null && v !== undefined && typeof v === 'number' && v > 0) as number[];
  
  const stats: ExportStats = {
    title: 'Statistiques',
    subtitle: zoneName,
    rows: []
  };
  
  if (values.length === 0) {
    stats.rows.push({ label: 'Données', value: 'Aucune donnée disponible' });
    return stats;
  }
  
  // Stats selon la thématique
  switch (parameterId) {
    case 'n_sondages':
      stats.rows = buildSondagesStats(values, nMaillesTotales, nMaillesAvecDonnees, classes);
      break;
    case 'vbs_moy':
    case 'vbs_mean':
      stats.rows = buildVbsStats(values, nMaillesTotales, nMaillesAvecDonnees, classes, unit);
      break;
    case 'ip_moy':
    case 'ip_mean':
      stats.rows = buildIpStats(values, nMaillesTotales, nMaillesAvecDonnees, classes, unit);
      break;
    case 'profondeur_max':
    case 'depth_max':
      stats.rows = buildDepthStats(values, nMaillesTotales, nMaillesAvecDonnees, unit);
      break;
    default:
      stats.rows = buildGenericStats(values, nMaillesTotales, nMaillesAvecDonnees, parameterLabel, unit);
  }
  
  return stats;
}

/**
 * Stats pour "Nombre de sondages"
 */
function buildSondagesStats(
  values: number[],
  nMailles: number,
  nMaillesAvecDonnees: number,
  classes: any[]
): ExportStatsRow[] {
  const total = values.reduce((a, b) => a + b, 0);
  const moyenne = total / values.length;
  const couverture = (nMaillesAvecDonnees / nMailles * 100).toFixed(1);
  
  const rows: ExportStatsRow[] = [
    { label: 'Sondages total', value: total.toString() },
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMailles}` },
    { label: 'Couverture', value: couverture, unit: '%' },
    { label: 'Moyenne par maille', value: moyenne.toFixed(1) }
  ];
  
  // Ajouter répartition par classes si disponible
  if (classes && classes.length > 0) {
    const classeHaute = classes[classes.length - 1];
    const nClasseHaute = values.filter(v => v > (classeHaute.min || 0)).length;
    if (nClasseHaute > 0) {
      rows.push({
        label: `Mailles ${classeHaute.label}`,
        value: nClasseHaute.toString()
      });
    }
  }
  
  return rows;
}

/**
 * Stats pour VBS (argilosité)
 */
function buildVbsStats(
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  classes: any[],
  unit: string
): ExportStatsRow[] {
  const moyenne = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const couverture = (nMaillesAvecDonnees / nMaillesTotales * 100).toFixed(1);
  
  // % très argileux (VBS > 5 g/100g typiquement)
  const seuilArgileux = 5;
  const nArgileux = values.filter(v => v > seuilArgileux).length;
  const pctArgileux = (nArgileux / nMaillesAvecDonnees * 100).toFixed(1);
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture, unit: '%' },
    { label: 'VBS moyen', value: moyenne.toFixed(2), unit: unit || 'g/100g' },
    { label: 'VBS min', value: min.toFixed(2), unit: unit || 'g/100g' },
    { label: 'VBS max', value: max.toFixed(2), unit: unit || 'g/100g' },
    { label: 'Mailles très argileuses', value: `${nArgileux} (${pctArgileux}%)` }
  ];
}

/**
 * Stats pour IP (plasticité)
 */
function buildIpStats(
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  classes: any[],
  unit: string
): ExportStatsRow[] {
  const moyenne = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const couverture = (nMaillesAvecDonnees / nMaillesTotales * 100).toFixed(1);
  
  // % plasticité élevée (IP > 20 typiquement)
  const seuilPlastique = 20;
  const nPlastique = values.filter(v => v > seuilPlastique).length;
  const pctPlastique = (nPlastique / nMaillesAvecDonnees * 100).toFixed(1);
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture, unit: '%' },
    { label: 'IP moyen', value: moyenne.toFixed(1), unit: unit || '%' },
    { label: 'IP min', value: min.toFixed(1), unit: unit || '%' },
    { label: 'IP max', value: max.toFixed(1), unit: unit || '%' },
    { label: 'Plasticité élevée', value: `${nPlastique} mailles (${pctPlastique}%)` }
  ];
}

/**
 * Stats pour profondeur d'investigation
 */
function buildDepthStats(
  values: number[],
  nMaillesTotales: number,
  nMaillesAvecDonnees: number,
  unit: string
): ExportStatsRow[] {
  const moyenne = values.reduce((a, b) => a + b, 0) / values.length;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const couverture = (nMaillesAvecDonnees / nMaillesTotales * 100).toFixed(1);
  
  // Sondages profonds (> 2m)
  const seuilProfond = 2;
  const nProfonds = values.filter(v => v > seuilProfond).length;
  
  return [
    { label: 'Mailles avec données', value: `${nMaillesAvecDonnees} / ${nMaillesTotales}` },
    { label: 'Couverture', value: couverture, unit: '%' },
    { label: 'Profondeur moyenne', value: moyenne.toFixed(2), unit: unit || 'm' },
    { label: 'Profondeur min', value: min.toFixed(2), unit: unit || 'm' },
    { label: 'Profondeur max', value: max.toFixed(2), unit: unit || 'm' },
    { label: 'Sondages > 2m', value: nProfonds.toString() }
  ];
}

/**
 * Stats génériques pour autres thématiques
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
