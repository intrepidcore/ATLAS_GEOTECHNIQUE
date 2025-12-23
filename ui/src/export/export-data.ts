/**
 * Module d'export de données pour analyse géotechnique
 * Génère les fichiers GeoJSON, CSV et métadonnées pour QGIS/Python
 * 
 * Structure d'export:
 * /exports/
 *   referentiels/
 *     grille_nationale.geojson
 *     adm1.geojson
 *     adm2.geojson
 *     adm3.geojson
 *   donnees_agregees/
 *     grid_<param>.geojson (pour chaque paramètre)
 *   donnees_brutes/
 *     sondages.geojson
 *     essais_atterberg.csv
 *     essais_vbs.csv
 *     essais_proctor.csv
 *     essais_granulo.csv
 *   metadata.json
 */

// Utiliser JSZip depuis window (chargé globalement)
declare const JSZip: any

// ============================================================================
// Types
// ============================================================================

export interface ExportDataConfig {
  // Référentiels à exporter
  includeGrid: boolean
  includeAdm1: boolean
  includeAdm2: boolean
  includeAdm3: boolean
  
  // Données agrégées par maille
  parameters: string[] // Liste des paramètres à exporter (vbs_avg, ip_avg, etc.)
  
  // Données brutes
  includeSondages: boolean
  includeEssaisAtterberg: boolean
  includeEssaisVbs: boolean
  includeEssaisProctor: boolean
  includeEssaisGranulo: boolean
  
  // Filtres
  admFilters?: {
    adm1?: string
    adm2?: string
    adm3?: string
  }
  
  // Options
  format: 'geojson' | 'shapefile' // Pour les géométries
  includeMetadata: boolean
}

export interface GridFeatureProperties {
  cell_id: string
  adm1: string
  adm2: string
  adm3?: string
  surface_km2: number
  centroid_x: number
  centroid_y: number
  n_sondages: number
  n_echantillons: number
  n_essais_total: number
  fiabilite: string
}

export interface ThematicGridProperties extends GridFeatureProperties {
  val_mean: number | null
  val_median: number | null
  val_min: number | null
  val_max: number | null
  val_stddev: number | null
  val_count: number
  classe_legende: number
  label_classe: string
}

export interface SondageProperties {
  sondage_id: string
  code: string
  x: number
  y: number
  cell_id: string
  adm1: string
  adm2: string
  adm3?: string
  profondeur_max: number | null
  type_sondage: string | null
  date: string | null
  source: string | null
  n_echantillons: number
  n_essais: number
}

export interface EssaiRecord {
  essai_id: string
  sondage_id: string
  sondage_code: string
  cell_id: string
  adm1: string
  adm2: string
  profondeur_de: number
  profondeur_a: number | null
  type_essai: string
  date_essai: string | null
  [key: string]: any // Valeurs spécifiques au type d'essai
}

export interface ExportMetadata {
  version: string
  exportDate: string
  atlasVersion: string
  
  // Filtres appliqués
  filters: {
    adm1?: string
    adm2?: string
    adm3?: string
  }
  
  // Contenu exporté
  content: {
    referentiels: string[]
    parametersAgreges: string[]
    donneesBrutes: string[]
  }
  
  // Statistiques globales
  stats: {
    totalMailles: number
    maillesAvecDonnees: number
    totalSondages: number
    totalEssais: number
  }
  
  // Légendes par paramètre
  legends: Record<string, {
    parameter: string
    unit: string
    classes: Array<{
      min: number | null
      max: number | null
      label: string
      color: string
    }>
  }>
}

// ============================================================================
// Fonctions d'export
// ============================================================================

const API_BASE = 'http://localhost:8000'

/**
 * Exporte les données complètes selon la configuration
 */
export async function exportData(
  config: ExportDataConfig,
  onProgress?: (message: string, percent: number) => void
): Promise<Blob> {
  const zip = new JSZip()
  const metadata: ExportMetadata = {
    version: '1.0',
    exportDate: new Date().toISOString(),
    atlasVersion: 'v2.6.0',
    filters: config.admFilters || {},
    content: {
      referentiels: [],
      parametersAgreges: [],
      donneesBrutes: []
    },
    stats: {
      totalMailles: 0,
      maillesAvecDonnees: 0,
      totalSondages: 0,
      totalEssais: 0
    },
    legends: {}
  }
  
  let progress = 0
  const totalSteps = 
    (config.includeGrid ? 1 : 0) +
    (config.includeAdm1 ? 1 : 0) +
    (config.includeAdm2 ? 1 : 0) +
    (config.includeAdm3 ? 1 : 0) +
    config.parameters.length +
    (config.includeSondages ? 1 : 0) +
    (config.includeEssaisAtterberg ? 1 : 0) +
    (config.includeEssaisVbs ? 1 : 0) +
    (config.includeEssaisProctor ? 1 : 0) +
    (config.includeEssaisGranulo ? 1 : 0) +
    1 // metadata
  
  const updateProgress = (msg: string) => {
    progress++
    onProgress?.(msg, (progress / totalSteps) * 100)
  }
  
  // ========== RÉFÉRENTIELS ==========
  
  // Grille nationale
  if (config.includeGrid) {
    updateProgress('Export grille nationale...')
    const gridData = await fetchGridData(config.admFilters)
    zip.file('referentiels/grille_nationale.geojson', JSON.stringify(gridData, null, 2))
    metadata.content.referentiels.push('grille_nationale.geojson')
    metadata.stats.totalMailles = gridData.features?.length || 0
  }
  
  // ADM1
  if (config.includeAdm1) {
    updateProgress('Export limites ADM1...')
    const adm1Data = await fetchAdmGeojson('adm1')
    zip.file('referentiels/adm1.geojson', JSON.stringify(adm1Data, null, 2))
    metadata.content.referentiels.push('adm1.geojson')
  }
  
  // ADM2
  if (config.includeAdm2) {
    updateProgress('Export limites ADM2...')
    const adm2Data = await fetchAdmGeojson('adm2')
    zip.file('referentiels/adm2.geojson', JSON.stringify(adm2Data, null, 2))
    metadata.content.referentiels.push('adm2.geojson')
  }
  
  // ADM3
  if (config.includeAdm3) {
    updateProgress('Export limites ADM3...')
    const adm3Data = await fetchAdmGeojson('adm3')
    zip.file('referentiels/adm3.geojson', JSON.stringify(adm3Data, null, 2))
    metadata.content.referentiels.push('adm3.geojson')
  }
  
  // ========== DONNÉES AGRÉGÉES PAR MAILLE ==========
  
  for (const param of config.parameters) {
    updateProgress(`Export données ${param}...`)
    const { geojson, legend, stats } = await fetchThematicGridData(param, config.admFilters)
    zip.file(`donnees_agregees/grid_${param}.geojson`, JSON.stringify(geojson, null, 2))
    metadata.content.parametersAgreges.push(`grid_${param}.geojson`)
    metadata.legends[param] = legend
    metadata.stats.maillesAvecDonnees = Math.max(metadata.stats.maillesAvecDonnees, stats.withData)
  }
  
  // ========== DONNÉES BRUTES ==========
  
  // Sondages
  if (config.includeSondages) {
    updateProgress('Export sondages...')
    const sondagesData = await fetchSondagesData(config.admFilters)
    zip.file('donnees_brutes/sondages.geojson', JSON.stringify(sondagesData.geojson, null, 2))
    zip.file('donnees_brutes/sondages.csv', sondagesData.csv)
    metadata.content.donneesBrutes.push('sondages.geojson', 'sondages.csv')
    metadata.stats.totalSondages = sondagesData.count
  }
  
  // Essais Atterberg
  if (config.includeEssaisAtterberg) {
    updateProgress('Export essais Atterberg...')
    const essaisData = await fetchEssaisData('atterberg', config.admFilters)
    zip.file('donnees_brutes/essais_atterberg.csv', essaisData.csv)
    metadata.content.donneesBrutes.push('essais_atterberg.csv')
    metadata.stats.totalEssais += essaisData.count
  }
  
  // Essais VBS
  if (config.includeEssaisVbs) {
    updateProgress('Export essais VBS...')
    const essaisData = await fetchEssaisData('vbs', config.admFilters)
    zip.file('donnees_brutes/essais_vbs.csv', essaisData.csv)
    metadata.content.donneesBrutes.push('essais_vbs.csv')
    metadata.stats.totalEssais += essaisData.count
  }
  
  // Essais Proctor
  if (config.includeEssaisProctor) {
    updateProgress('Export essais Proctor...')
    const essaisData = await fetchEssaisData('proctor', config.admFilters)
    zip.file('donnees_brutes/essais_proctor.csv', essaisData.csv)
    metadata.content.donneesBrutes.push('essais_proctor.csv')
    metadata.stats.totalEssais += essaisData.count
  }
  
  // Essais Granulométrie
  if (config.includeEssaisGranulo) {
    updateProgress('Export essais Granulométrie...')
    const essaisData = await fetchEssaisData('granulo', config.admFilters)
    zip.file('donnees_brutes/essais_granulo.csv', essaisData.csv)
    metadata.content.donneesBrutes.push('essais_granulo.csv')
    metadata.stats.totalEssais += essaisData.count
  }
  
  // ========== MÉTADONNÉES ==========
  
  if (config.includeMetadata) {
    updateProgress('Génération métadonnées...')
    zip.file('metadata.json', JSON.stringify(metadata, null, 2))
    
    // Générer aussi un README
    const readme = generateReadme(metadata)
    zip.file('README.md', readme)
  }
  
  // Générer le ZIP
  return zip.generateAsync({ type: 'blob' })
}

// ============================================================================
// Fonctions de récupération des données
// ============================================================================

/**
 * Récupère la grille nationale avec propriétés de base
 */
async function fetchGridData(admFilters?: ExportDataConfig['admFilters']): Promise<any> {
  const url = `${API_BASE}/coverage/mailles`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Erreur fetch grille: ${response.status}`)
  
  const data = await response.json()
  
  // Enrichir les propriétés
  const features = (data.features || []).map((f: any) => {
    const props = f.properties || {}
    const coords = f.geometry?.coordinates?.[0] || []
    
    // Calculer le centroïde
    let centroidX = 0, centroidY = 0
    if (coords.length > 0) {
      for (const c of coords) {
        centroidX += c[0]
        centroidY += c[1]
      }
      centroidX /= coords.length
      centroidY /= coords.length
    }
    
    return {
      ...f,
      properties: {
        cell_id: props.cell_id || props.code,
        adm1: props.adm1 || props.region || '',
        adm2: props.adm2 || props.prefecture || '',
        adm3: props.adm3 || props.commune || '',
        surface_km2: props.surface_km2 || 25, // Maille 5x5km par défaut
        centroid_x: centroidX,
        centroid_y: centroidY,
        n_sondages: props.n_sondages || 0,
        n_echantillons: props.n_echantillons || 0,
        n_essais_total: props.n_essais || 0,
        has_data: props.has_data || props.n_sondages > 0
      }
    }
  })
  
  // Filtrer par ADM si demandé
  let filteredFeatures = features
  if (admFilters?.adm1) {
    filteredFeatures = filteredFeatures.filter((f: any) => 
      f.properties.adm1?.toLowerCase() === admFilters.adm1?.toLowerCase()
    )
  }
  if (admFilters?.adm2) {
    filteredFeatures = filteredFeatures.filter((f: any) => 
      f.properties.adm2?.toLowerCase() === admFilters.adm2?.toLowerCase()
    )
  }
  
  return {
    type: 'FeatureCollection',
    name: 'grille_nationale_atlas',
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
    features: filteredFeatures
  }
}

/**
 * Récupère les limites ADM en GeoJSON
 */
async function fetchAdmGeojson(level: 'adm1' | 'adm2' | 'adm3'): Promise<any> {
  // Récupérer la liste des ADM
  const listUrl = `${API_BASE}/${level}`
  const listResponse = await fetch(listUrl)
  if (!listResponse.ok) throw new Error(`Erreur fetch ${level}: ${listResponse.status}`)
  
  const admList = await listResponse.json()
  const features: any[] = []
  
  // Récupérer chaque géométrie
  for (const adm of admList) {
    try {
      const geoUrl = `${API_BASE}/adm-geojson?level=${level}&name=${encodeURIComponent(adm.name)}`
      const geoResponse = await fetch(geoUrl)
      if (geoResponse.ok) {
        const geoJson = await geoResponse.json()
        if (geoJson?.features?.length > 0) {
          features.push(...geoJson.features.map((f: any) => ({
            ...f,
            properties: {
              ...f.properties,
              code: adm.code,
              name: adm.name,
              level: level
            }
          })))
        }
      }
    } catch (e) {
      console.warn(`Erreur chargement géométrie ${adm.name}:`, e)
    }
  }
  
  return {
    type: 'FeatureCollection',
    name: `limites_${level}`,
    crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
    features
  }
}

/**
 * Récupère les données thématiques agrégées par maille
 */
async function fetchThematicGridData(
  parameter: string,
  admFilters?: ExportDataConfig['admFilters']
): Promise<{
  geojson: any
  legend: ExportMetadata['legends'][string]
  stats: { total: number; withData: number }
}> {
  // Récupérer les données thématiques
  const params = new URLSearchParams({
    parameter,
    include_geometry: 'true',
    min_sondages: '1'
  })
  
  const url = `${API_BASE}/thematic/data?${params}`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Erreur fetch thematic ${parameter}: ${response.status}`)
  
  const data = await response.json()
  const features = data.features || []
  const classification = data.classification || {}
  const stats = data.statistics || {}
  
  // Enrichir les propriétés avec stats par maille
  const enrichedFeatures = features.map((f: any) => {
    const props = f.properties || {}
    const value = props.value
    
    // Déterminer la classe
    let classeIndex = -1
    let classeLabel = 'Sans données'
    const breaks = classification.breaks || []
    
    if (value != null) {
      for (let i = 0; i < breaks.length; i++) {
        if (value <= breaks[i]) {
          classeIndex = i
          break
        }
      }
      if (classeIndex === -1) classeIndex = breaks.length
      classeLabel = classification.labels?.[classeIndex] || `Classe ${classeIndex}`
    }
    
    return {
      ...f,
      properties: {
        cell_id: props.cell_id || props.code,
        adm1: props.adm1 || '',
        adm2: props.adm2 || '',
        adm3: props.adm3 || '',
        n_sondages: props.n_sondages || 0,
        n_essais: props.n_essais || 0,
        val_mean: value,
        val_median: props.median || null,
        val_min: props.min || null,
        val_max: props.max || null,
        val_stddev: props.stddev || null,
        val_count: props.count || 1,
        classe_legende: classeIndex,
        label_classe: classeLabel,
        fiabilite: getReliabilityLabel(props.n_sondages || 0)
      }
    }
  })
  
  // Filtrer par ADM si demandé
  let filteredFeatures = enrichedFeatures
  if (admFilters?.adm1) {
    filteredFeatures = filteredFeatures.filter((f: any) => 
      f.properties.adm1?.toLowerCase() === admFilters.adm1?.toLowerCase()
    )
  }
  if (admFilters?.adm2) {
    filteredFeatures = filteredFeatures.filter((f: any) => 
      f.properties.adm2?.toLowerCase() === admFilters.adm2?.toLowerCase()
    )
  }
  
  // Construire la légende
  const legend: ExportMetadata['legends'][string] = {
    parameter,
    unit: stats.unit || '',
    classes: (classification.breaks || []).map((b: number, i: number) => ({
      min: i === 0 ? null : classification.breaks[i - 1],
      max: b,
      label: classification.labels?.[i] || `≤ ${b}`,
      color: classification.colors?.[i] || '#cccccc'
    }))
  }
  
  // Ajouter la dernière classe (> dernier seuil)
  if (classification.breaks?.length > 0) {
    const lastBreak = classification.breaks[classification.breaks.length - 1]
    legend.classes.push({
      min: lastBreak,
      max: null,
      label: classification.labels?.[classification.breaks.length] || `> ${lastBreak}`,
      color: classification.colors?.[classification.breaks.length] || '#333333'
    })
  }
  
  return {
    geojson: {
      type: 'FeatureCollection',
      name: `grid_${parameter}`,
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
      features: filteredFeatures,
      metadata: {
        parameter,
        unit: stats.unit,
        statistics: {
          count: filteredFeatures.length,
          min: stats.min,
          max: stats.max,
          mean: stats.mean,
          median: stats.median
        }
      }
    },
    legend,
    stats: {
      total: features.length,
      withData: filteredFeatures.length
    }
  }
}

/**
 * Récupère les données des sondages
 */
async function fetchSondagesData(admFilters?: ExportDataConfig['admFilters']): Promise<{
  geojson: any
  csv: string
  count: number
}> {
  const url = `${API_BASE}/surveys`
  const response = await fetch(url)
  if (!response.ok) throw new Error(`Erreur fetch sondages: ${response.status}`)
  
  const data = await response.json()
  const sondages = data.surveys || data || []
  
  // Transformer en GeoJSON
  const features = sondages.map((s: any) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [s.longitude || s.x, s.latitude || s.y]
    },
    properties: {
      sondage_id: s.id,
      code: s.code,
      x: s.longitude || s.x,
      y: s.latitude || s.y,
      cell_id: s.cell_id || s.maille_code,
      adm1: s.adm1 || s.region || '',
      adm2: s.adm2 || s.prefecture || '',
      adm3: s.adm3 || s.commune || '',
      profondeur_max: s.profondeur_max || s.depth_max || null,
      type_sondage: s.type || null,
      date: s.date || null,
      source: s.source || null,
      n_echantillons: s.n_echantillons || 0,
      n_essais: s.n_essais || 0
    }
  }))
  
  // Filtrer par ADM si demandé
  let filteredFeatures = features
  if (admFilters?.adm1) {
    filteredFeatures = filteredFeatures.filter((f: any) => 
      f.properties.adm1?.toLowerCase() === admFilters.adm1?.toLowerCase()
    )
  }
  if (admFilters?.adm2) {
    filteredFeatures = filteredFeatures.filter((f: any) => 
      f.properties.adm2?.toLowerCase() === admFilters.adm2?.toLowerCase()
    )
  }
  
  // Générer le CSV
  const csvHeaders = ['sondage_id', 'code', 'x', 'y', 'cell_id', 'adm1', 'adm2', 'adm3', 'profondeur_max', 'type_sondage', 'date', 'source', 'n_echantillons', 'n_essais']
  const csvRows = filteredFeatures.map((f: any) => 
    csvHeaders.map(h => {
      const val = f.properties[h]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`
      return val
    }).join(',')
  )
  const csv = [csvHeaders.join(','), ...csvRows].join('\n')
  
  return {
    geojson: {
      type: 'FeatureCollection',
      name: 'sondages',
      crs: { type: 'name', properties: { name: 'urn:ogc:def:crs:EPSG::4326' } },
      features: filteredFeatures
    },
    csv,
    count: filteredFeatures.length
  }
}

/**
 * Récupère les données des essais par type
 */
async function fetchEssaisData(
  type: 'atterberg' | 'vbs' | 'proctor' | 'granulo',
  admFilters?: ExportDataConfig['admFilters']
): Promise<{
  csv: string
  count: number
}> {
  // Mapper le type vers le paramètre API
  const paramMap: Record<string, string> = {
    atterberg: 'ip_avg',
    vbs: 'vbs_avg',
    proctor: 'gamma_d_max_avg',
    granulo: 'passant_80um_avg'
  }
  
  // Récupérer les données thématiques qui contiennent les essais
  const url = `${API_BASE}/thematic/data?parameter=${paramMap[type]}&include_geometry=true`
  const response = await fetch(url)
  if (!response.ok) {
    console.warn(`Pas de données pour ${type}`)
    return { csv: '', count: 0 }
  }
  
  const data = await response.json()
  const features = data.features || []
  
  // Colonnes spécifiques par type d'essai
  const columnsByType: Record<string, string[]> = {
    atterberg: ['essai_id', 'sondage_id', 'cell_id', 'adm1', 'adm2', 'profondeur', 'wl', 'wp', 'ip', 'ic'],
    vbs: ['essai_id', 'sondage_id', 'cell_id', 'adm1', 'adm2', 'profondeur', 'vbs'],
    proctor: ['essai_id', 'sondage_id', 'cell_id', 'adm1', 'adm2', 'profondeur', 'gamma_d_max', 'w_opt'],
    granulo: ['essai_id', 'sondage_id', 'cell_id', 'adm1', 'adm2', 'profondeur', 'passant_80um', 'passant_2mm', 'passant_20mm']
  }
  
  const columns = columnsByType[type]
  
  // Générer les lignes CSV à partir des features
  const rows: string[] = []
  let essaiId = 1
  
  for (const f of features) {
    const props = f.properties || {}
    
    // Filtrer par ADM
    if (admFilters?.adm1 && props.adm1?.toLowerCase() !== admFilters.adm1?.toLowerCase()) continue
    if (admFilters?.adm2 && props.adm2?.toLowerCase() !== admFilters.adm2?.toLowerCase()) continue
    
    const row: Record<string, any> = {
      essai_id: `E${String(essaiId++).padStart(6, '0')}`,
      sondage_id: props.sondage_id || '',
      cell_id: props.cell_id || props.code || '',
      adm1: props.adm1 || '',
      adm2: props.adm2 || '',
      profondeur: props.depth || props.profondeur || ''
    }
    
    // Ajouter les valeurs spécifiques
    if (type === 'atterberg') {
      row.wl = props.wl || props.value || ''
      row.wp = props.wp || ''
      row.ip = props.ip || props.value || ''
      row.ic = props.ic || ''
    } else if (type === 'vbs') {
      row.vbs = props.vbs || props.value || ''
    } else if (type === 'proctor') {
      row.gamma_d_max = props.gamma_d_max || props.value || ''
      row.w_opt = props.w_opt || ''
    } else if (type === 'granulo') {
      row.passant_80um = props.passant_80um || props.value || ''
      row.passant_2mm = props.passant_2mm || ''
      row.passant_20mm = props.passant_20mm || ''
    }
    
    rows.push(columns.map(c => {
      const val = row[c]
      if (val === null || val === undefined) return ''
      if (typeof val === 'string' && val.includes(',')) return `"${val}"`
      return val
    }).join(','))
  }
  
  const csv = [columns.join(','), ...rows].join('\n')
  
  return {
    csv,
    count: rows.length
  }
}

// ============================================================================
// Fonctions utilitaires
// ============================================================================

/**
 * Détermine le label de fiabilité selon le nombre de sondages
 */
function getReliabilityLabel(nSondages: number): string {
  if (nSondages === 0) return 'Sans données'
  if (nSondages === 1) return 'Très faible'
  if (nSondages <= 2) return 'Faible'
  if (nSondages <= 4) return 'Moyenne'
  return 'Bonne'
}

/**
 * Génère le README pour l'export
 */
function generateReadme(metadata: ExportMetadata): string {
  return `# Export Atlas Géotechnique

## Informations générales
- **Date d'export**: ${new Date(metadata.exportDate).toLocaleString('fr-FR')}
- **Version Atlas**: ${metadata.atlasVersion}

## Filtres appliqués
${metadata.filters.adm1 ? `- **Région (ADM1)**: ${metadata.filters.adm1}` : '- Aucun filtre ADM1'}
${metadata.filters.adm2 ? `- **Préfecture (ADM2)**: ${metadata.filters.adm2}` : ''}
${metadata.filters.adm3 ? `- **Commune (ADM3)**: ${metadata.filters.adm3}` : ''}

## Contenu de l'export

### Référentiels géographiques
${metadata.content.referentiels.map(f => `- \`referentiels/${f}\``).join('\n') || '- Aucun'}

### Données agrégées par maille
${metadata.content.parametersAgreges.map(f => `- \`donnees_agregees/${f}\``).join('\n') || '- Aucun'}

### Données brutes
${metadata.content.donneesBrutes.map(f => `- \`donnees_brutes/${f}\``).join('\n') || '- Aucun'}

## Statistiques globales
- **Mailles totales**: ${metadata.stats.totalMailles.toLocaleString('fr-FR')}
- **Mailles avec données**: ${metadata.stats.maillesAvecDonnees.toLocaleString('fr-FR')}
- **Sondages**: ${metadata.stats.totalSondages.toLocaleString('fr-FR')}
- **Essais**: ${metadata.stats.totalEssais.toLocaleString('fr-FR')}

## Légendes par paramètre

${Object.entries(metadata.legends).map(([param, legend]) => `
### ${param} (${legend.unit})
| Classe | Min | Max | Couleur |
|--------|-----|-----|---------|
${legend.classes.map(c => `| ${c.label} | ${c.min ?? '-'} | ${c.max ?? '-'} | ${c.color} |`).join('\n')}
`).join('\n')}

## Utilisation

### Dans QGIS
1. Ouvrir QGIS
2. Glisser-déposer les fichiers GeoJSON dans la fenêtre
3. Utiliser les fichiers \`grid_*.geojson\` pour les cartes thématiques
4. Joindre les données CSV aux couches si nécessaire

### Dans Python (geopandas)
\`\`\`python
import geopandas as gpd
import pandas as pd

# Charger la grille thématique
gdf = gpd.read_file('donnees_agregees/grid_vbs_avg.geojson')

# Statistiques par ADM2
stats_adm2 = gdf.groupby('adm2').agg({
    'val_mean': ['mean', 'median', 'std'],
    'n_sondages': 'sum'
})
print(stats_adm2)

# Carte
gdf.plot(column='val_mean', legend=True, cmap='RdYlGn_r')
\`\`\`

## Contact
Atlas Géotechnique - ${new Date().getFullYear()}
`
}

/**
 * Télécharge le fichier ZIP
 */
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  URL.revokeObjectURL(url)
}

/**
 * Configuration par défaut pour l'export de données
 */
export const DEFAULT_EXPORT_DATA_CONFIG: ExportDataConfig = {
  includeGrid: true,
  includeAdm1: true,
  includeAdm2: true,
  includeAdm3: false,
  
  parameters: ['n_sondages', 'vbs_avg', 'ip_avg', 'eg_avg', 'gamma_d_max_avg', 'passant_80um_avg'],
  
  includeSondages: true,
  includeEssaisAtterberg: true,
  includeEssaisVbs: true,
  includeEssaisProctor: true,
  includeEssaisGranulo: true,
  
  format: 'geojson',
  includeMetadata: true
}
