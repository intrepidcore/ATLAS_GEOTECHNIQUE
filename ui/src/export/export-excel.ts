/**
 * Module d'export Excel pour Atlas Géotechnique
 * Génère un fichier Excel unique avec toutes les données d'analyse
 * 
 * v3.4.3 - Pack Analyse Avancée
 */

import ExcelJS from 'exceljs';

// ============================================================================
// Types
// ============================================================================

export interface ExcelSheetData {
  name: string;
  data: Record<string, any>[];
  columns?: ExcelColumnDef[];
}

export interface ExcelColumnDef {
  key: string;
  header: string;
  width?: number;
  type?: 'string' | 'number' | 'date' | 'boolean';
}

export interface QACheckResult {
  check: string;
  status: 'ok' | 'warning' | 'error';
  value: number | string;
  threshold?: number | string;
  message: string;
}

export interface GridWideRow {
  grid_id: string;
  adm1?: string;
  adm2?: string;
  adm3?: string;
  n_sondages?: number;
  vbs_avg?: number;
  ip_avg?: number;
  eg_avg?: number;
  passant_80um_avg?: number;
  passant_2mm_avg?: number;
  wl_avg?: number;
  wp_avg?: number;
  gamma_d_max_avg?: number;
  w_opt_avg?: number;
}

// ============================================================================
// Dictionnaire des colonnes
// ============================================================================

const COLUMN_DICTIONARY: Record<string, { definition: string; unit: string; source: string }> = {
  // Identifiants
  grid_id: { definition: 'Identifiant unique de la maille (code UTM)', unit: '-', source: 'Grille nationale' },
  code: { definition: 'Code du sondage', unit: '-', source: 'Import Excel' },
  sondage_id: { definition: 'Identifiant unique du sondage', unit: '-', source: 'BDD' },
  
  // Localisation
  adm1: { definition: 'Région administrative (niveau 1)', unit: '-', source: 'Référentiel ADM' },
  adm2: { definition: 'Préfecture (niveau 2)', unit: '-', source: 'Référentiel ADM' },
  adm3: { definition: 'Commune (niveau 3)', unit: '-', source: 'Référentiel ADM' },
  x: { definition: 'Coordonnée X (longitude)', unit: '°', source: 'GPS/Géocodage' },
  y: { definition: 'Coordonnée Y (latitude)', unit: '°', source: 'GPS/Géocodage' },
  
  // Instrumentation
  n_sondages: { definition: 'Nombre de sondages dans la maille', unit: '-', source: 'Calcul' },
  n_echantillons: { definition: 'Nombre d\'échantillons prélevés', unit: '-', source: 'Calcul' },
  n_essais: { definition: 'Nombre total d\'essais', unit: '-', source: 'Calcul' },
  
  // Profondeur
  depth_m: { definition: 'Profondeur de prélèvement', unit: 'm', source: 'Essai' },
  depth_min: { definition: 'Profondeur minimale', unit: 'm', source: 'Calcul' },
  depth_max: { definition: 'Profondeur maximale', unit: 'm', source: 'Calcul' },
  depth_mean: { definition: 'Profondeur moyenne', unit: 'm', source: 'Calcul' },
  
  // Atterberg
  wl: { definition: 'Limite de liquidité', unit: '%', source: 'Essai Atterberg' },
  wp: { definition: 'Limite de plasticité', unit: '%', source: 'Essai Atterberg' },
  ip: { definition: 'Indice de plasticité (WL - WP)', unit: '%', source: 'Calcul' },
  wl_avg: { definition: 'Limite de liquidité moyenne', unit: '%', source: 'Agrégation' },
  wp_avg: { definition: 'Limite de plasticité moyenne', unit: '%', source: 'Agrégation' },
  ip_avg: { definition: 'Indice de plasticité moyen', unit: '%', source: 'Agrégation' },
  
  // VBS
  vbs: { definition: 'Valeur de Bleu de Méthylène', unit: 'g/100g', source: 'Essai VBS' },
  vbs_avg: { definition: 'VBS moyenne', unit: 'g/100g', source: 'Agrégation' },
  
  // Gonflement
  eg: { definition: 'Potentiel de gonflement', unit: '%', source: 'Essai Gonflement' },
  eg_avg: { definition: 'Potentiel de gonflement moyen', unit: '%', source: 'Agrégation' },
  
  // Granulométrie
  passant_80um: { definition: 'Passant au tamis 80µm (fines)', unit: '%', source: 'Essai Granulo' },
  passant_2mm: { definition: 'Passant au tamis 2mm', unit: '%', source: 'Essai Granulo' },
  passant_20mm: { definition: 'Passant au tamis 20mm', unit: '%', source: 'Essai Granulo' },
  passant_80um_avg: { definition: 'Passant 80µm moyen', unit: '%', source: 'Agrégation' },
  passant_2mm_avg: { definition: 'Passant 2mm moyen', unit: '%', source: 'Agrégation' },
  
  // Proctor
  gamma_d_max: { definition: 'Densité sèche maximale Proctor', unit: 't/m³', source: 'Essai Proctor' },
  w_opt: { definition: 'Teneur en eau optimale Proctor', unit: '%', source: 'Essai Proctor' },
  gamma_d_max_avg: { definition: 'Densité sèche max moyenne', unit: 't/m³', source: 'Agrégation' },
  w_opt_avg: { definition: 'Teneur en eau optimale moyenne', unit: '%', source: 'Agrégation' },
  
  // Métadonnées
  value: { definition: 'Valeur du paramètre thématique', unit: 'variable', source: 'Agrégation' },
  has_data: { definition: 'Maille avec données (true/false)', unit: '-', source: 'Calcul' },
  source: { definition: 'Source des données', unit: '-', source: 'Import' },
  created_at: { definition: 'Date de création', unit: '-', source: 'BDD' }
};

// ============================================================================
// Fonctions utilitaires
// ============================================================================

/**
 * Parse un CSV en tableau d'objets
 */
function parseCSV(csvContent: string): Record<string, any>[] {
  const lines = csvContent.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
  const rows: Record<string, any>[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim().replace(/^"|"$/g, ''));
    const row: Record<string, any> = {};
    headers.forEach((h, idx) => {
      const val = values[idx];
      // Tenter de convertir en nombre
      const num = parseFloat(val);
      row[h] = isNaN(num) ? val : num;
    });
    rows.push(row);
  }
  
  return rows;
}

/**
 * Extrait les propriétés d'un GeoJSON (sans géométrie)
 */
function extractGeoJSONProperties(geojson: any): Record<string, any>[] {
  if (!geojson?.features) return [];
  return geojson.features.map((f: any) => ({ ...f.properties }));
}

/**
 * Génère la feuille GRID_WIDE (jointure de toutes les grilles thématiques)
 */
function generateGridWideData(grids: Map<string, Record<string, any>[]>): GridWideRow[] {
  const gridMap = new Map<string, GridWideRow>();
  
  // Parcourir toutes les grilles et fusionner par grid_id
  for (const [gridName, rows] of grids) {
    const paramName = gridName.replace('grid_', '').replace('_avg', '_avg');
    
    for (const row of rows) {
      const gridId = row.grid_id || row.code || row.cell_id;
      if (!gridId) continue;
      
      if (!gridMap.has(gridId)) {
        gridMap.set(gridId, {
          grid_id: gridId,
          adm1: row.adm1_name || row.adm1,
          adm2: row.adm2_name || row.adm2,
          adm3: row.adm3_name || row.adm3,
          n_sondages: row.n_sondages
        });
      }
      
      const existing = gridMap.get(gridId)!;
      
      // Ajouter la valeur thématique
      if (row.value !== undefined && row.value !== null) {
        (existing as any)[paramName] = row.value;
      }
      
      // Mettre à jour n_sondages si présent
      if (row.n_sondages && (!existing.n_sondages || row.n_sondages > existing.n_sondages)) {
        existing.n_sondages = row.n_sondages;
      }
    }
  }
  
  return Array.from(gridMap.values());
}

/**
 * Génère la feuille DICT_COLONNES
 */
function generateColumnDictionary(): Record<string, any>[] {
  return Object.entries(COLUMN_DICTIONARY).map(([key, info]) => ({
    colonne: key,
    definition: info.definition,
    unite: info.unit,
    source: info.source
  }));
}

/**
 * Exécute les contrôles QA sur les données
 */
function runQAChecks(
  sondages: Record<string, any>[],
  essaisAtterberg: Record<string, any>[],
  essaisVbs: Record<string, any>[],
  essaisGranulo: Record<string, any>[],
  essaisProctor: Record<string, any>[]
): QACheckResult[] {
  const results: QACheckResult[] = [];
  
  // 1. % coordonnées vides dans sondages
  const sondagesWithCoords = sondages.filter(s => s.x && s.y).length;
  const pctCoordsEmpty = sondages.length > 0 
    ? ((sondages.length - sondagesWithCoords) / sondages.length * 100) 
    : 0;
  results.push({
    check: 'Coordonnées sondages',
    status: pctCoordsEmpty > 10 ? 'warning' : 'ok',
    value: `${pctCoordsEmpty.toFixed(1)}%`,
    threshold: '10%',
    message: pctCoordsEmpty > 10 
      ? `${pctCoordsEmpty.toFixed(1)}% des sondages sans coordonnées` 
      : 'Coordonnées complètes'
  });
  
  // 2. % sondage_id manquant dans essais Atterberg
  const atterbergWithSondageId = essaisAtterberg.filter(e => e.sondage_id).length;
  const pctAtterbergMissing = essaisAtterberg.length > 0 
    ? ((essaisAtterberg.length - atterbergWithSondageId) / essaisAtterberg.length * 100) 
    : 0;
  results.push({
    check: 'Lien sondage_id (Atterberg)',
    status: pctAtterbergMissing > 5 ? 'warning' : 'ok',
    value: `${pctAtterbergMissing.toFixed(1)}%`,
    threshold: '5%',
    message: pctAtterbergMissing > 5 
      ? `${pctAtterbergMissing.toFixed(1)}% des essais Atterberg sans sondage_id` 
      : 'Liens complets'
  });
  
  // 3. % sondage_id manquant dans essais VBS
  const vbsWithSondageId = essaisVbs.filter(e => e.sondage_id).length;
  const pctVbsMissing = essaisVbs.length > 0 
    ? ((essaisVbs.length - vbsWithSondageId) / essaisVbs.length * 100) 
    : 0;
  results.push({
    check: 'Lien sondage_id (VBS)',
    status: pctVbsMissing > 5 ? 'warning' : 'ok',
    value: `${pctVbsMissing.toFixed(1)}%`,
    threshold: '5%',
    message: pctVbsMissing > 5 
      ? `${pctVbsMissing.toFixed(1)}% des essais VBS sans sondage_id` 
      : 'Liens complets'
  });
  
  // 4. Valeurs IP négatives
  const negativeIP = essaisAtterberg.filter(e => e.ip !== undefined && e.ip < 0).length;
  results.push({
    check: 'IP négatifs',
    status: negativeIP > 0 ? 'error' : 'ok',
    value: negativeIP,
    threshold: '0',
    message: negativeIP > 0 
      ? `${negativeIP} essais avec IP < 0 (anomalie)` 
      : 'Aucune valeur aberrante'
  });
  
  // 5. Valeurs VBS négatives
  const negativeVBS = essaisVbs.filter(e => e.vbs !== undefined && e.vbs < 0).length;
  results.push({
    check: 'VBS négatifs',
    status: negativeVBS > 0 ? 'error' : 'ok',
    value: negativeVBS,
    threshold: '0',
    message: negativeVBS > 0 
      ? `${negativeVBS} essais avec VBS < 0 (anomalie)` 
      : 'Aucune valeur aberrante'
  });
  
  // 6. Données Proctor disponibles
  results.push({
    check: 'Données Proctor',
    status: essaisProctor.length === 0 ? 'warning' : 'ok',
    value: essaisProctor.length,
    threshold: '>0',
    message: essaisProctor.length === 0 
      ? 'Aucune donnée Proctor disponible' 
      : `${essaisProctor.length} essais Proctor`
  });
  
  // 7. Données Granulo disponibles
  results.push({
    check: 'Données Granulométrie',
    status: essaisGranulo.length === 0 ? 'warning' : 'ok',
    value: essaisGranulo.length,
    threshold: '>0',
    message: essaisGranulo.length === 0 
      ? 'Aucune donnée granulométrique disponible' 
      : `${essaisGranulo.length} essais granulo`
  });
  
  // 8. Résumé global
  const errors = results.filter(r => r.status === 'error').length;
  const warnings = results.filter(r => r.status === 'warning').length;
  results.push({
    check: 'RÉSUMÉ GLOBAL',
    status: errors > 0 ? 'error' : warnings > 0 ? 'warning' : 'ok',
    value: `${errors} erreurs, ${warnings} avertissements`,
    message: errors > 0 
      ? 'Données nécessitant correction' 
      : warnings > 0 
        ? 'Données partiellement complètes' 
        : 'Données de bonne qualité'
  });
  
  return results;
}

// ============================================================================
// Fonction principale d'export
// ============================================================================

export interface ExportExcelOptions {
  /** Données GeoJSON agrégées par thématique */
  geojsonFiles?: Map<string, any>;
  /** Données CSV brutes */
  csvFiles?: Map<string, string>;
  /** Inclure la feuille GRID_WIDE */
  includeGridWide?: boolean;
  /** Inclure la feuille DICT_COLONNES */
  includeDictionary?: boolean;
  /** Inclure la feuille _QA_SUMMARY */
  includeQASummary?: boolean;
  /** Métadonnées de l'export */
  metadata?: {
    exportDate: string;
    zone?: string;
    version?: string;
  };
}

/**
 * Génère le fichier Excel d'analyse complet
 */
export async function generateAnalysisExcel(options: ExportExcelOptions): Promise<Blob> {
  const workbook = new ExcelJS.Workbook();
  
  // Métadonnées du workbook
  workbook.creator = 'Atlas Géotechnique';
  workbook.created = new Date();
  workbook.modified = new Date();
  workbook.lastModifiedBy = 'Atlas Export';
  
  const grids = new Map<string, Record<string, any>[]>();
  
  // 1. Ajouter les feuilles GeoJSON (données agrégées)
  if (options.geojsonFiles) {
    for (const [name, geojson] of options.geojsonFiles) {
      const rows = extractGeoJSONProperties(geojson);
      if (rows.length > 0) {
        const sheetName = name.substring(0, 31); // Excel limite à 31 caractères
        const sheet = workbook.addWorksheet(sheetName);
        
        // En-têtes
        const headers = Object.keys(rows[0]);
        sheet.addRow(headers);
        
        // Style des en-têtes
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Données
        rows.forEach(row => {
          sheet.addRow(headers.map(h => row[h]));
        });
        
        // Auto-fit colonnes
        sheet.columns.forEach(col => {
          col.width = Math.min(30, Math.max(10, (col.header?.toString().length || 10) + 2));
        });
        
        // Stocker pour GRID_WIDE
        if (name.startsWith('grid_')) {
          grids.set(name, rows);
        }
      }
    }
  }
  
  // 2. Ajouter les feuilles CSV (données brutes)
  const csvData: {
    sondages: Record<string, any>[];
    essaisAtterberg: Record<string, any>[];
    essaisVbs: Record<string, any>[];
    essaisGranulo: Record<string, any>[];
    essaisProctor: Record<string, any>[];
  } = {
    sondages: [],
    essaisAtterberg: [],
    essaisVbs: [],
    essaisGranulo: [],
    essaisProctor: []
  };
  
  if (options.csvFiles) {
    for (const [name, csvContent] of options.csvFiles) {
      const rows = parseCSV(csvContent);
      if (rows.length > 0) {
        const sheetName = name.replace('.csv', '').substring(0, 31);
        const sheet = workbook.addWorksheet(sheetName);
        
        // En-têtes
        const headers = Object.keys(rows[0]);
        sheet.addRow(headers);
        
        // Style des en-têtes
        const headerRow = sheet.getRow(1);
        headerRow.font = { bold: true };
        headerRow.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFE0E0E0' }
        };
        
        // Données
        rows.forEach(row => {
          sheet.addRow(headers.map(h => row[h]));
        });
        
        // Auto-fit colonnes
        sheet.columns.forEach(col => {
          col.width = Math.min(30, Math.max(10, (col.header?.toString().length || 10) + 2));
        });
        
        // Stocker pour QA
        if (name.includes('sondages')) csvData.sondages = rows;
        if (name.includes('atterberg')) csvData.essaisAtterberg = rows;
        if (name.includes('vbs')) csvData.essaisVbs = rows;
        if (name.includes('granulo')) csvData.essaisGranulo = rows;
        if (name.includes('proctor')) csvData.essaisProctor = rows;
      }
    }
  }
  
  // 3. Feuille GRID_WIDE (jointure de toutes les grilles)
  if (options.includeGridWide !== false && grids.size > 0) {
    const gridWideData = generateGridWideData(grids);
    if (gridWideData.length > 0) {
      const sheet = workbook.addWorksheet('GRID_WIDE');
      
      const headers = ['grid_id', 'adm1', 'adm2', 'adm3', 'n_sondages', 
        'vbs_avg', 'ip_avg', 'eg_avg', 'passant_80um_avg', 'passant_2mm_avg',
        'wl_avg', 'wp_avg', 'gamma_d_max_avg', 'w_opt_avg'];
      
      sheet.addRow(headers);
      
      // Style des en-têtes
      const headerRow = sheet.getRow(1);
      headerRow.font = { bold: true };
      headerRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'FF4472C4' }
      };
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      
      // Données
      gridWideData.forEach(row => {
        sheet.addRow(headers.map(h => (row as any)[h]));
      });
      
      // Auto-fit colonnes
      sheet.columns.forEach((col, idx) => {
        col.width = Math.max(12, headers[idx].length + 2);
      });
    }
  }
  
  // 4. Feuille DICT_COLONNES
  if (options.includeDictionary !== false) {
    const dictData = generateColumnDictionary();
    const sheet = workbook.addWorksheet('DICT_COLONNES');
    
    sheet.addRow(['Colonne', 'Définition', 'Unité', 'Source']);
    
    // Style des en-têtes
    const headerRow = sheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF70AD47' }
    };
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    
    // Données
    dictData.forEach(row => {
      sheet.addRow([row.colonne, row.definition, row.unite, row.source]);
    });
    
    // Largeurs de colonnes
    sheet.getColumn(1).width = 20;
    sheet.getColumn(2).width = 50;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 20;
  }
  
  // 5. Feuille _QA_SUMMARY
  if (options.includeQASummary !== false) {
    const qaResults = runQAChecks(
      csvData.sondages,
      csvData.essaisAtterberg,
      csvData.essaisVbs,
      csvData.essaisGranulo,
      csvData.essaisProctor
    );
    
    const sheet = workbook.addWorksheet('_QA_SUMMARY');
    
    // Titre
    sheet.mergeCells('A1:E1');
    const titleCell = sheet.getCell('A1');
    titleCell.value = 'Contrôle Qualité des Données';
    titleCell.font = { bold: true, size: 14 };
    titleCell.alignment = { horizontal: 'center' };
    
    // Date d'export
    sheet.mergeCells('A2:E2');
    const dateCell = sheet.getCell('A2');
    dateCell.value = `Export du ${options.metadata?.exportDate || new Date().toLocaleDateString('fr-FR')}`;
    dateCell.alignment = { horizontal: 'center' };
    
    // En-têtes
    sheet.addRow([]);
    sheet.addRow(['Contrôle', 'Statut', 'Valeur', 'Seuil', 'Message']);
    
    const headerRow = sheet.getRow(4);
    headerRow.font = { bold: true };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE0E0E0' }
    };
    
    // Résultats QA
    qaResults.forEach(result => {
      const row = sheet.addRow([
        result.check,
        result.status.toUpperCase(),
        result.value,
        result.threshold || '-',
        result.message
      ]);
      
      // Colorer selon le statut
      const statusCell = row.getCell(2);
      if (result.status === 'error') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFF6B6B' }
        };
      } else if (result.status === 'warning') {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FFFFD93D' }
        };
      } else {
        statusCell.fill = {
          type: 'pattern',
          pattern: 'solid',
          fgColor: { argb: 'FF6BCB77' }
        };
      }
    });
    
    // Largeurs de colonnes
    sheet.getColumn(1).width = 25;
    sheet.getColumn(2).width = 12;
    sheet.getColumn(3).width = 15;
    sheet.getColumn(4).width = 10;
    sheet.getColumn(5).width = 45;
  }
  
  // Générer le buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return new Blob([buffer], { 
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' 
  });
}

/**
 * Télécharge le fichier Excel
 */
export async function downloadAnalysisExcel(
  options: ExportExcelOptions,
  filename: string = 'atlas_geotechnique_donnees_analyse.xlsx'
): Promise<void> {
  const blob = await generateAnalysisExcel(options);
  
  // Créer un lien de téléchargement
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
