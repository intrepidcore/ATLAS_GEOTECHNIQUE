/**
 * Dialogue d'export Atlas complet (batch)
 * Atlas Géotechnique v3.3.0
 * 
 * Permet d'exporter automatiquement toutes les cartes thématiques
 * pour tous les ADM sélectionnés en un seul clic.
 * 
 * Fonctionnalités:
 * - Thématiques en accordéon avec paramètres par catégorie
 * - Sélection cascade des ADM (ADM1 → ADM2 → ADM3)
 * - Comptage dynamique des ADM avec données
 * - Options de qualité et 4 niveaux de masque
 */

import { ActiveAdmFilters, ExportQuality } from './export-types';
import { exportData, downloadBlob, type ExportDataConfig } from './export-data';
import { generateAllCharts, type ThematicChartSet } from './chart-generator';
import { ExportQuickDialog, type ExportQuickDialogConfig } from './export-quick-dialog';
import { generateAnalysisExcel, type ExportExcelOptions } from './export-excel';
import { getExportProgressModal, type ExportProgressModal } from './export-progress-modal';
import { PALETTE_OPTIONS, getRecommendedPalette } from '../thematic/thematic-types';
import { API_BASE_URL } from '../services/api';
import { tokenStorage } from '../services/auth-api';
import { getExportLogger, destroyExportLogger, type LogEntry } from './export-logger';

// ============================================================================
// Types
// ============================================================================

export interface AtlasExportConfig {
  levels: {
    adm1: boolean;
    adm2: boolean;
    adm3: boolean;
  };
  // ADM sélectionnés spécifiquement (si vide = tous)
  selectedAdms: {
    adm1: string[];
    adm2: string[];
    adm3: string[];
  };
  thematics: string[];
  maskMode: 'none' | 'context' | 'focus' | 'clip';
  format: 'png' | 'pdf';
  quality: 'web' | 'print' | 'hd';
  includeStats: boolean;
  includeNeighbors: boolean;
  showEmptyCells: boolean;
  onlyAdmCells: boolean;
  showAdmBoundary: boolean; // Toujours afficher la délimitation ADM
  // MODE DEBUG RAPIDE - pour itérer vite sur les corrections
  debugMode: boolean; // Limite à 1 zone + 1-3 thématiques
  // Nouveau: délimitation hiérarchique (frontières du niveau parent)
  boundaryLevel: 'none' | 'adm1' | 'adm2'; // Niveau des frontières à afficher
  // Export données pour analyse
  exportData: boolean;
  dataOptions: {
    includeGrid: boolean;
    includeAdm: boolean;
    includeThematic: boolean;
    includeSondages: boolean;
    includeEssais: boolean;
  };
  // Export graphes statistiques
  exportCharts: boolean;
  // Export Excel unique (v3.4.3)
  exportExcel: boolean;
  // Palettes par thématique (v3.5.0)
  thematicPalettes: Record<string, string>;
  // Options grille et cadre (v3.5.3)
  gridType: 'none' | 'cross' | 'continuous' | 'labels-only';
  frameStyle: 'none' | 'simple' | 'double' | 'zebra';
}

export interface AtlasExportCallbacks {
  getAdmList: (level: 'adm1' | 'adm2' | 'adm3') => Promise<Array<{ code: string; name: string }>>;
  exportSingleMap?: (admLevel: string, admName: string, thematicId: string, config: AtlasExportConfig) => Promise<Blob | null>;
  /** Change la thématique et l'ADM sur la carte. palette optionnelle pour forcer une palette spécifique (v3.5.2) */
  setThematicAndAdm: (thematicId: string, admLevel: string, admName: string, palette?: string) => Promise<void>;
  /** Configuration pour ExportQuickDialog - utilisé pour l'export via le moteur Pro */
  getExportProConfig: () => ExportQuickDialogConfig;
}

export interface AtlasExportProgress {
  total: number;
  current: number;
  currentAdm: string;
  currentThematic: string;
  status: 'idle' | 'running' | 'complete' | 'error';
  errors: string[];
}

// ============================================================================
// Thématiques organisées par catégorie
// ============================================================================

interface ThematicCategory {
  id: string;
  label: string;
  icon: string;
  parameters: Array<{ id: string; label: string; unit?: string }>;
}

const THEMATIC_CATEGORIES: ThematicCategory[] = [
  {
    id: 'density',
    label: 'Couverture & Instrumentation',
    icon: '📊',
    parameters: [
      { id: 'n_sondages', label: 'Nombre de sondages' },
      { id: 'n_echantillons', label: 'Nombre d\'échantillons' },
      { id: 'n_essais_total', label: 'Nombre d\'essais' },
      { id: 'profondeur_max', label: 'Profondeur maximale', unit: 'm' },
    ]
  },
  {
    id: 'vbs',
    label: 'Argilosité (VBS)',
    icon: '🔬',
    parameters: [
      { id: 'vbs_avg', label: 'VBS moyen', unit: 'g/100g' },
      { id: 'vbs_max', label: 'VBS maximum', unit: 'g/100g' },
      { id: 'vbs_min', label: 'VBS minimum', unit: 'g/100g' },
    ]
  },
  {
    id: 'atterberg',
    label: 'Plasticité (Atterberg)',
    icon: '💧',
    parameters: [
      { id: 'ip_avg', label: 'IP moyen', unit: '%' },
      { id: 'wl_avg', label: 'Limite de liquidité WL', unit: '%' },
      { id: 'wp_avg', label: 'Limite de plasticité WP', unit: '%' },
    ]
  },
  {
    id: 'gonflement',
    label: 'Potentiel de gonflement',
    icon: '📈',
    parameters: [
      { id: 'eg_avg', label: 'Eg moyen', unit: '%' },
      { id: 'eg_max', label: 'Eg maximum', unit: '%' },
    ]
  },
  {
    id: 'proctor',
    label: 'Compacité (Proctor)',
    icon: '🔨',
    parameters: [
      { id: 'gamma_d_max_avg', label: 'γd,max moyen', unit: 't/m³' },
      { id: 'w_opt_avg', label: 'wopt moyenne', unit: '%' },
    ]
  },
  {
    id: 'granulo',
    label: 'Granulométrie',
    icon: '🏔️',
    parameters: [
      { id: 'passant_80um_avg', label: '% Passant 80µm', unit: '%' },
      { id: 'passant_2mm_avg', label: '% Passant 2mm', unit: '%' },
    ]
  },
];

// Liste plate pour compatibilité
const ALL_THEMATICS = THEMATIC_CATEGORIES.flatMap(cat => 
  cat.parameters.map(p => ({ ...p, category: cat.id }))
);

// ============================================================================
// Styles CSS
// ============================================================================

const ATLAS_DIALOG_STYLES = `
.atlas-dialog-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.atlas-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 60px rgba(0, 0, 0, 0.3);
  width: 580px;
  max-height: 85vh;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.atlas-dialog-header {
  padding: 16px 20px;
  border-bottom: 1px solid #e5e7eb;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: white;
}

.atlas-dialog-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 600;
}

.atlas-dialog-close {
  background: none;
  border: none;
  font-size: 24px;
  cursor: pointer;
  color: white;
  opacity: 0.8;
}

.atlas-dialog-close:hover {
  opacity: 1;
}

.atlas-dialog-body {
  padding: 20px;
  overflow-y: auto;
  flex: 1;
}

.atlas-section {
  margin-bottom: 20px;
}

.atlas-section-title {
  font-weight: 600;
  font-size: 13px;
  color: #374151;
  margin-bottom: 10px;
  display: flex;
  align-items: center;
  gap: 6px;
}

.atlas-checkboxes {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.atlas-checkbox {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  font-size: 13px;
  color: #1f2937;
}

.atlas-checkbox span {
  color: #1f2937;
}

.atlas-checkbox input {
  width: 16px;
  height: 16px;
  accent-color: #3b82f6;
}

.atlas-checkbox .adm-count {
  font-size: 11px;
  color: #6b7280;
  margin-left: auto;
}

/* Sélecteur de palette par thématique (v3.5.0) */
.atlas-thematic-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 4px 0;
}

.atlas-thematic-row .atlas-checkbox {
  flex: 1;
}

.atlas-palette-select {
  width: 100px;
  padding: 4px 6px;
  font-size: 11px;
  font-family: 'Consolas', 'Monaco', monospace;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #f9fafb;
  cursor: pointer;
}

.atlas-palette-select:hover {
  border-color: #3b82f6;
}

.atlas-palette-select:focus {
  outline: none;
  border-color: #3b82f6;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.1);
}

.atlas-row {
  display: flex;
  gap: 16px;
}

.atlas-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: 12px;
}

.atlas-row-4 {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 12px;
}

.atlas-field {
  flex: 1;
}

.atlas-field label {
  display: block;
  font-size: 12px;
  color: #6b7280;
  margin-bottom: 4px;
}

.atlas-field .field-hint {
  display: block;
  font-size: 10px;
  color: #9ca3af;
  margin-top: 4px;
}

.atlas-field select {
  width: 100%;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
}

.atlas-dialog-footer {
  padding: 16px 20px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.atlas-btn {
  padding: 10px 20px;
  border-radius: 6px;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  border: none;
}

.atlas-btn-secondary {
  background: #f3f4f6;
  color: #374151;
}

.atlas-btn-secondary:hover {
  background: #e5e7eb;
}

.atlas-btn-primary {
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: white;
}

.atlas-btn-primary:hover {
  background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
}

.atlas-btn-primary:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.atlas-progress {
  margin-top: 16px;
  padding: 16px;
  background: #f9fafb;
  border-radius: 8px;
}

.atlas-progress-bar {
  height: 8px;
  background: #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.atlas-progress-fill {
  height: 100%;
  background: linear-gradient(90deg, #3b82f6, #1e40af);
  transition: width 0.3s ease;
}

.atlas-progress-text {
  font-size: 12px;
  color: #6b7280;
  text-align: center;
}

.atlas-info {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  border-radius: 8px;
  padding: 12px;
  font-size: 12px;
  color: #1e40af;
  margin-bottom: 16px;
}

/* Accordéon pour les thématiques */
.atlas-accordion {
  border: 1px solid #e5e7eb;
  border-radius: 8px;
  overflow: hidden;
}

.atlas-accordion-item {
  border-bottom: 1px solid #e5e7eb;
}

.atlas-accordion-item:last-child {
  border-bottom: none;
}

.atlas-accordion-header {
  display: flex;
  align-items: center;
  padding: 10px 12px;
  background: #f9fafb;
  cursor: pointer;
  user-select: none;
  gap: 8px;
}

.atlas-accordion-header:hover {
  background: #f3f4f6;
}

.atlas-accordion-header .icon {
  font-size: 14px;
}

.atlas-accordion-header .title {
  flex: 1;
  font-size: 13px;
  font-weight: 500;
  color: #374151;
}

.atlas-accordion-header .count {
  font-size: 11px;
  color: #6b7280;
  background: #e5e7eb;
  padding: 2px 8px;
  border-radius: 10px;
}

.atlas-accordion-header .chevron {
  font-size: 12px;
  color: #9ca3af;
  transition: transform 0.2s;
}

.atlas-accordion-item.open .atlas-accordion-header .chevron {
  transform: rotate(90deg);
}

.atlas-accordion-body {
  display: none;
  padding: 8px 12px 12px 32px;
  background: white;
}

.atlas-accordion-item.open .atlas-accordion-body {
  display: block;
}

.atlas-accordion-body .atlas-checkbox {
  padding: 4px 0;
}

/* Sélection ADM en cascade */
.atlas-adm-cascade {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.atlas-adm-level {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.atlas-adm-level .level-checkbox {
  padding-top: 8px;
}

.atlas-adm-level .level-select {
  flex: 1;
}

.atlas-adm-level select {
  width: 100%;
  padding: 8px;
  border: 1px solid #d1d5db;
  border-radius: 6px;
  font-size: 13px;
  max-height: 120px;
}

.atlas-adm-level select[multiple] {
  min-height: 120px;
  max-height: 180px;
}

/* Amélioration UX: zone de sélection plus grande au focus */
.atlas-adm-level select[multiple]:focus {
  min-height: 180px;
  transition: min-height 0.2s ease;
}

.atlas-adm-level .level-info {
  font-size: 11px;
  color: #6b7280;
  margin-top: 4px;
}
`;

// ============================================================================
// Classe ExportAtlasDialog
// ============================================================================

export class ExportAtlasDialog {
  private overlay: HTMLElement | null = null;
  private config: AtlasExportConfig;
  private progress: AtlasExportProgress;
  private isExporting: boolean = false;
  private callbacks?: AtlasExportCallbacks;
  private onExportStart?: (config: AtlasExportConfig) => void;
  private abortRequested: boolean = false;
  
  // Cache des ADM
  private admCache: {
    adm1: Array<{ code: string; name: string }>;
    adm2: Array<{ code: string; name: string; parent?: string }>;
    adm3: Array<{ code: string; name: string; parent?: string }>;
  } = { adm1: [], adm2: [], adm3: [] };
  
  // ADM avec données
  private admsWithData: {
    adm1: Set<string>;
    adm2: Set<string>;
    adm3: Set<string>;
  } = { adm1: new Set(), adm2: new Set(), adm3: new Set() };
  
  constructor(onExportStart?: (config: AtlasExportConfig) => void, callbacks?: AtlasExportCallbacks) {
    this.onExportStart = onExportStart;
    this.callbacks = callbacks;
    this.config = {
      levels: { adm1: true, adm2: false, adm3: false },
      selectedAdms: { adm1: [], adm2: [], adm3: [] },
      thematics: ['n_sondages', 'vbs_avg', 'ip_avg'],
      maskMode: 'context',
      format: 'png',
      quality: 'hd',
      includeStats: true,
      includeNeighbors: true,
      showEmptyCells: true,
      onlyAdmCells: true,
      showAdmBoundary: true,
      debugMode: false, // Mode debug rapide désactivé par défaut
      boundaryLevel: 'adm2',
      exportData: false,
      dataOptions: {
        includeGrid: true,
        includeAdm: true,
        includeThematic: true,
        includeSondages: true,
        includeEssais: true
      },
      exportCharts: false,
      exportExcel: false,
      gridType: 'cross',
      frameStyle: 'double',
      thematicPalettes: {}
    };
    this.progress = {
      total: 0,
      current: 0,
      currentAdm: '',
      currentThematic: '',
      status: 'idle',
      errors: []
    };
    this.injectStyles();
  }
  
  private injectStyles(): void {
    if (document.getElementById('atlas-dialog-styles')) return;
    const style = document.createElement('style');
    style.id = 'atlas-dialog-styles';
    style.textContent = ATLAS_DIALOG_STYLES;
    document.head.appendChild(style);
  }
  
  async open(): Promise<void> {
    if (this.overlay) return;
    
    // Charger les données ADM avant d'ouvrir
    await this.loadAdmData();
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'atlas-dialog-overlay';
    this.overlay.innerHTML = this.renderDialog();
    document.body.appendChild(this.overlay);
    
    this.attachEventListeners();
    this.updateAdmCounts();
  }
  
  close(): void {
    if (this.isExporting) return;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
  
  /**
   * Charge les données ADM et identifie ceux avec données
   */
  private async loadAdmData(): Promise<void> {
    try {
      // Charger les listes ADM
      const [adm1Res, adm2Res, adm3Res, maillesRes] = await Promise.all([
        fetch(`${API_BASE_URL}/adm1`),
        fetch(`${API_BASE_URL}/adm2`),
        fetch(`${API_BASE_URL}/adm3`),
        fetch(`${API_BASE_URL}/coverage/mailles`)
      ]);
      
      if (adm1Res.ok) this.admCache.adm1 = await adm1Res.json();
      if (adm2Res.ok) this.admCache.adm2 = await adm2Res.json();
      if (adm3Res.ok) this.admCache.adm3 = await adm3Res.json();
      
      // Identifier les ADM avec données
      if (maillesRes.ok) {
        const geojson = await maillesRes.json();
        const features = geojson.features || [];
        
        for (const f of features) {
          const props = f.properties || {};
          const hasData = props.has_data || props.n_sondages > 0;
          if (!hasData) continue;
          
          if (props.adm1_name) this.admsWithData.adm1.add(props.adm1_name);
          if (props.adm2_name) this.admsWithData.adm2.add(props.adm2_name);
          if (props.adm3_name) this.admsWithData.adm3.add(props.adm3_name);
        }
      }
      
      console.log('[Atlas] ADM avec données:', {
        adm1: this.admsWithData.adm1.size,
        adm2: this.admsWithData.adm2.size,
        adm3: this.admsWithData.adm3.size
      });
    } catch (e) {
      console.warn('[Atlas] Erreur chargement ADM:', e);
    }
  }
  
  private renderDialog(): string {
    return `
      <div class="atlas-dialog">
        <div class="atlas-dialog-header">
          <h3>📚 Export Atlas Complet</h3>
          <button class="atlas-dialog-close" data-action="close">&times;</button>
        </div>
        
        <div class="atlas-dialog-body">
          <div class="atlas-info">
            ℹ️ Cet export génère automatiquement toutes les cartes thématiques
            pour chaque zone administrative sélectionnée. Les fichiers seront
            téléchargés dans un dossier ZIP structuré.
          </div>
          
          <!-- Niveaux ADM avec sélection cascade -->
          <div class="atlas-section">
            <div class="atlas-section-title">🗺️ Zones administratives</div>
            ${this.renderAdmCascade()}
          </div>
          
          <!-- Thématiques en accordéon -->
          <div class="atlas-section">
            <div class="atlas-section-title">📊 Thématiques</div>
            ${this.renderThematicsAccordion()}
          </div>
          
          <!-- Options -->
          <div class="atlas-section">
            <div class="atlas-section-title">⚙️ Options</div>
            <div class="atlas-row-4">
              <div class="atlas-field">
                <label>Format</label>
                <select id="atlas-format">
                  <option value="png" selected>PNG (images)</option>
                  <option value="pdf">PDF (documents)</option>
                </select>
              </div>
              <div class="atlas-field">
                <label>Qualité</label>
                <select id="atlas-quality">
                  <option value="web">Web (72 DPI)</option>
                  <option value="print">Standard (150 DPI)</option>
                  <option value="hd" selected>HD (300 DPI)</option>
                </select>
              </div>
              <div class="atlas-field">
                <label>Masque hors ADM</label>
                <select id="atlas-mask">
                  <option value="none">Aucun (0%)</option>
                  <option value="context" selected>Contexte (45%)</option>
                  <option value="focus">Focus (85%)</option>
                  <option value="clip">Clip (100%)</option>
                </select>
              </div>
              <div class="atlas-field">
                <label>🗺️ Subdivisions</label>
                <select id="atlas-boundary-level">
                  <option value="none">Aucune</option>
                  <option value="adm1">Régions (ADM1)</option>
                  <option value="adm2" selected>Préfectures (ADM2)</option>
                </select>
                <small class="field-hint">Frontières internes à afficher</small>
              </div>
            </div>
            <div class="atlas-checkboxes" style="margin-top: 12px;">
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-stats" checked>
                <span>Inclure statistiques</span>
              </label>
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-neighbors" checked>
                <span>Afficher ADM limitrophes</span>
              </label>
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-show-boundary" checked>
                <span>Toujours afficher délimitation ADM</span>
              </label>
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-show-empty-cells">
                <span>Afficher mailles sans données</span>
              </label>
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-only-adm-cells" checked>
                <span>Uniquement mailles dans l'ADM</span>
              </label>
            </div>
            
            <!-- Options avancées (v3.5.0) -->
            <details class="atlas-advanced-options" style="margin-top: 12px;">
              <summary style="cursor: pointer; font-size: 12px; color: #6b7280; padding: 8px 0;">
                ⚙️ Options avancées
              </summary>
              <div class="atlas-row" style="margin-top: 12px;">
                <div class="atlas-field">
                  <label>🔲 Type de grille</label>
                  <select id="atlas-grid-type">
                    <option value="cross" selected>Croix</option>
                    <option value="continuous">Continue</option>
                    <option value="labels-only">Labels uniquement</option>
                    <option value="none">Aucune</option>
                  </select>
                </div>
                <div class="atlas-field">
                  <label>🖼️ Style cadre</label>
                  <select id="atlas-frame-style">
                    <option value="simple" selected>Simple</option>
                    <option value="double">Double</option>
                    <option value="zebra">Zébré (QGIS)</option>
                    <option value="none">Aucun</option>
                  </select>
                </div>
                <div class="atlas-field">
                  <label>🌐 SCR affiché</label>
                  <select id="atlas-crs">
                    <option value="EPSG:4326" selected>WGS84 (EPSG:4326)</option>
                    <option value="EPSG:3857">Web Mercator (EPSG:3857)</option>
                    <option value="EPSG:32631">UTM 31N (EPSG:32631)</option>
                  </select>
                </div>
                <div class="atlas-field">
                  <label>🗺️ Style carte</label>
                  <select id="atlas-basemap">
                    <option value="osm" selected>OSM Standard</option>
                    <option value="satellite">ESRI Satellite</option>
                    <option value="topo">ESRI Topo</option>
                    <option value="offline">Offline Local</option>
                  </select>
                </div>
              </div>
            </details>
          </div>
          
          <!-- Export des données pour analyse -->
          <div class="atlas-section">
            <div class="atlas-section-title">📁 Export données (analyse)</div>
            <div class="atlas-checkboxes">
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-export-data">
                <span>Inclure données pour analyse (GeoJSON/CSV)</span>
              </label>
            </div>
            <div id="atlas-data-options" style="display: none; margin-top: 8px; padding: 12px; background: #f8fafc; border-radius: 6px;">
              <div style="font-size: 12px; color: #64748b; margin-bottom: 8px;">
                📊 Fichiers générés dans le ZIP :
              </div>
              <div class="atlas-checkboxes" style="font-size: 12px;">
                <label class="atlas-checkbox">
                  <input type="checkbox" id="atlas-data-grid" checked>
                  <span>Grille nationale (GeoJSON)</span>
                </label>
                <label class="atlas-checkbox">
                  <input type="checkbox" id="atlas-data-adm" checked>
                  <span>Limites ADM (GeoJSON)</span>
                </label>
                <label class="atlas-checkbox">
                  <input type="checkbox" id="atlas-data-thematic" checked>
                  <span>Données agrégées par maille (GeoJSON)</span>
                </label>
                <label class="atlas-checkbox">
                  <input type="checkbox" id="atlas-data-sondages" checked>
                  <span>Sondages (GeoJSON + CSV)</span>
                </label>
                <label class="atlas-checkbox">
                  <input type="checkbox" id="atlas-data-essais" checked>
                  <span>Essais bruts (CSV)</span>
                </label>
              </div>
              <div style="font-size: 11px; color: #94a3b8; margin-top: 8px;">
                💡 Ces fichiers sont compatibles QGIS et Python (geopandas)
              </div>
            </div>
          </div>
          
          <!-- Export graphes statistiques -->
          <div class="atlas-section">
            <div class="atlas-section-title">📈 Graphes statistiques</div>
            <div class="atlas-checkboxes">
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-export-charts">
                <span>Générer les graphes d'analyse par thématique</span>
              </label>
            </div>
            <div id="atlas-charts-info" style="display: none; margin-top: 8px; padding: 12px; background: #f0fdf4; border-radius: 6px; border: 1px solid #bbf7d0;">
              <div style="font-size: 12px; color: #166534; margin-bottom: 8px;">
                📊 Graphes générés automatiquement :
              </div>
              <ul style="font-size: 11px; color: #15803d; margin: 0; padding-left: 20px; line-height: 1.6;">
                <li><strong>Histogrammes</strong> - Distribution des valeurs par maille</li>
                <li><strong>Boxplots</strong> - Comparaison par préfecture (ADM2)</li>
                <li><strong>Camemberts</strong> - Couverture spatiale (avec/sans données)</li>
                <li><strong>Nuages de points</strong> - Corrélations entre paramètres</li>
                <li><strong>Diagramme de Casagrande</strong> - Classification des sols (IP vs WL)</li>
                <li><strong>Matrice de corrélation</strong> - Relations entre tous les paramètres</li>
              </ul>
              <div style="font-size: 11px; color: #166534; margin-top: 8px;">
                💡 Les graphes sont adaptés à chaque thématique sélectionnée
              </div>
            </div>
          </div>
          
          <!-- Export Excel unique (v3.4.3) -->
          <div class="atlas-section">
            <div class="atlas-section-title">📊 Export Excel (analyse)</div>
            <div class="atlas-checkboxes">
              <label class="atlas-checkbox">
                <input type="checkbox" id="atlas-export-excel">
                <span>Générer un fichier Excel unique pour analyse</span>
              </label>
            </div>
            <div id="atlas-excel-info" style="display: none; margin-top: 8px; padding: 12px; background: #eff6ff; border-radius: 6px; border: 1px solid #bfdbfe;">
              <div style="font-size: 12px; color: #1e40af; margin-bottom: 8px;">
                📋 Feuilles générées dans le fichier Excel :
              </div>
              <ul style="font-size: 11px; color: #1d4ed8; margin: 0; padding-left: 20px; line-height: 1.6;">
                <li><strong>_GRID_WIDE</strong> - Données pivotées (une ligne par maille, colonnes = paramètres)</li>
                <li><strong>_DICT_COLONNES</strong> - Dictionnaire des colonnes avec unités et descriptions</li>
                <li><strong>_QA_SUMMARY</strong> - Contrôles qualité automatiques (valeurs aberrantes, couverture)</li>
                <li><strong>Sondages</strong> - Liste complète des sondages avec métadonnées</li>
                <li><strong>Essais_*</strong> - Données brutes par type d'essai (Atterberg, VBS, Granulo...)</li>
              </ul>
              <div style="font-size: 11px; color: #1e40af; margin-top: 8px;">
                💡 Compatible Excel, LibreOffice et Python (pandas)
              </div>
            </div>
          </div>
          
          <!-- Progression (masquée par défaut) -->
          <div class="atlas-progress" id="atlas-progress" style="display: none;">
            <div class="atlas-progress-bar">
              <div class="atlas-progress-fill" id="atlas-progress-fill" style="width: 0%"></div>
            </div>
            <div class="atlas-progress-text" id="atlas-progress-text">
              Préparation...
            </div>
          </div>
        </div>
        
        <div class="atlas-dialog-footer">
          <button class="atlas-btn atlas-btn-secondary" data-action="close">Annuler</button>
          <button class="atlas-btn atlas-btn-primary" data-action="export" id="atlas-export-btn">
            🚀 Lancer l'export
          </button>
        </div>
      </div>
    `;
  }
  
  /**
   * Rendu de la sélection ADM en cascade
   */
  private renderAdmCascade(): string {
    const adm1Options = this.admCache.adm1.map(a => {
      const hasData = this.admsWithData.adm1.has(a.name);
      return `<option value="${a.name}" ${hasData ? '' : 'disabled'}>${a.name}${hasData ? '' : ' (sans données)'}</option>`;
    }).join('');
    
    return `
      <div class="atlas-adm-cascade">
        <!-- ADM1 -->
        <div class="atlas-adm-level">
          <label class="atlas-checkbox level-checkbox">
            <input type="checkbox" id="atlas-level-adm1" name="level" value="adm1" checked>
          </label>
          <div class="level-select">
            <label>ADM1 - Régions</label>
            <select id="atlas-adm1-select" multiple>
              ${adm1Options}
            </select>
            <div class="level-info">
              <span id="adm1-count">${this.admsWithData.adm1.size}</span> régions avec données
              <small>(Ctrl+clic pour sélection multiple, vide = toutes)</small>
            </div>
          </div>
        </div>
        
        <!-- ADM2 -->
        <div class="atlas-adm-level">
          <label class="atlas-checkbox level-checkbox">
            <input type="checkbox" id="atlas-level-adm2" name="level" value="adm2">
          </label>
          <div class="level-select">
            <label>ADM2 - Préfectures</label>
            <select id="atlas-adm2-select" multiple disabled>
              <option value="">-- Sélectionnez d'abord une région --</option>
            </select>
            <div class="level-info">
              <span id="adm2-count">0</span> préfectures avec données
            </div>
          </div>
        </div>
        
        <!-- ADM3 -->
        <div class="atlas-adm-level">
          <label class="atlas-checkbox level-checkbox">
            <input type="checkbox" id="atlas-level-adm3" name="level" value="adm3">
          </label>
          <div class="level-select">
            <label>ADM3 - Communes</label>
            <select id="atlas-adm3-select" multiple disabled>
              <option value="">-- Sélectionnez d'abord une préfecture --</option>
            </select>
            <div class="level-info">
              <span id="adm3-count">0</span> communes avec données
            </div>
          </div>
        </div>
      </div>
    `;
  }
  
  /**
   * Rendu des thématiques en accordéon avec sélecteur de palette (v3.5.0)
   */
  private renderThematicsAccordion(): string {
    const items = THEMATIC_CATEGORIES.map((cat, idx) => {
      const isOpen = idx === 0 || idx === 1 || idx === 2; // Ouvrir les 3 premiers
      const params = cat.parameters.map(p => {
        const recommendedPalette = getRecommendedPalette(p.id);
        const paletteOptions = PALETTE_OPTIONS.map(pal => 
          `<option value="${pal.value}" ${pal.value === recommendedPalette.palette ? 'selected' : ''}>${pal.label}</option>`
        ).join('');
        
        return `
          <div class="atlas-thematic-row">
            <label class="atlas-checkbox">
              <input type="checkbox" name="thematic" value="${p.id}" ${['n_sondages', 'vbs_avg', 'ip_avg'].includes(p.id) ? 'checked' : ''}>
              <span>${p.label}${p.unit ? ` (${p.unit})` : ''}</span>
            </label>
            <select id="atlas-palette-${p.id}" class="atlas-palette-select" title="Palette pour ${p.label}">
              ${paletteOptions}
            </select>
          </div>
        `;
      }).join('');
      
      return `
        <div class="atlas-accordion-item ${isOpen ? 'open' : ''}">
          <div class="atlas-accordion-header" data-category="${cat.id}">
            <span class="icon">${cat.icon}</span>
            <span class="title">${cat.label}</span>
            <span class="count">${cat.parameters.length}</span>
            <span class="chevron">▶</span>
          </div>
          <div class="atlas-accordion-body">
            ${params}
          </div>
        </div>
      `;
    }).join('');
    
    return `<div class="atlas-accordion">${items}</div>`;
  }
  
  private attachEventListeners(): void {
    if (!this.overlay) return;
    
    // Fermeture
    this.overlay.querySelectorAll('[data-action="close"]').forEach(btn => {
      btn.addEventListener('click', () => this.close());
    });
    
    // Clic sur overlay
    this.overlay.addEventListener('click', (e) => {
      if (e.target === this.overlay && !this.isExporting) {
        this.close();
      }
    });
    
    // Export
    const exportBtn = this.overlay.querySelector('[data-action="export"]');
    exportBtn?.addEventListener('click', () => this.startExport());
    
    // Accordéon thématiques
    this.overlay.querySelectorAll('.atlas-accordion-header').forEach(header => {
      header.addEventListener('click', () => {
        const item = header.closest('.atlas-accordion-item');
        item?.classList.toggle('open');
      });
    });
    
    // Cascade ADM
    const adm1Select = this.overlay.querySelector('#atlas-adm1-select') as HTMLSelectElement;
    const adm2Select = this.overlay.querySelector('#atlas-adm2-select') as HTMLSelectElement;
    const adm3Select = this.overlay.querySelector('#atlas-adm3-select') as HTMLSelectElement;
    
    const levelAdm1 = this.overlay.querySelector('#atlas-level-adm1') as HTMLInputElement;
    const levelAdm2 = this.overlay.querySelector('#atlas-level-adm2') as HTMLInputElement;
    const levelAdm3 = this.overlay.querySelector('#atlas-level-adm3') as HTMLInputElement;
    
    // Quand ADM1 change, mettre à jour ADM2
    adm1Select?.addEventListener('change', () => {
      this.updateAdm2Options();
    });
    
    // Quand ADM2 change, mettre à jour ADM3
    adm2Select?.addEventListener('change', () => {
      this.updateAdm3Options();
    });
    
    // Activer/désactiver les selects selon les checkboxes
    levelAdm1?.addEventListener('change', () => {
      if (adm1Select) adm1Select.disabled = !levelAdm1.checked;
    });
    
    levelAdm2?.addEventListener('change', () => {
      if (adm2Select) adm2Select.disabled = !levelAdm2.checked;
      if (levelAdm2.checked && adm1Select) {
        this.updateAdm2Options();
      }
    });
    
    levelAdm3?.addEventListener('change', () => {
      if (adm3Select) adm3Select.disabled = !levelAdm3.checked;
      if (levelAdm3.checked && adm2Select) {
        this.updateAdm3Options();
      }
    });
    
    // Toggle options export données
    const exportDataCheckbox = this.overlay.querySelector('#atlas-export-data') as HTMLInputElement;
    const dataOptionsDiv = this.overlay.querySelector('#atlas-data-options') as HTMLElement;
    exportDataCheckbox?.addEventListener('change', () => {
      if (dataOptionsDiv) {
        dataOptionsDiv.style.display = exportDataCheckbox.checked ? 'block' : 'none';
      }
    });
    
    // Toggle info graphes
    const exportChartsCheckbox = this.overlay.querySelector('#atlas-export-charts') as HTMLInputElement;
    const chartsInfoDiv = this.overlay.querySelector('#atlas-charts-info') as HTMLElement;
    exportChartsCheckbox?.addEventListener('change', () => {
      if (chartsInfoDiv) {
        chartsInfoDiv.style.display = exportChartsCheckbox.checked ? 'block' : 'none';
      }
    });
    
    // Toggle info Excel (v3.4.3)
    const exportExcelCheckbox = this.overlay.querySelector('#atlas-export-excel') as HTMLInputElement;
    const excelInfoDiv = this.overlay.querySelector('#atlas-excel-info') as HTMLElement;
    exportExcelCheckbox?.addEventListener('change', () => {
      if (excelInfoDiv) {
        excelInfoDiv.style.display = exportExcelCheckbox.checked ? 'block' : 'none';
      }
    });
  }
  
  /**
   * Met à jour les options ADM2 selon la sélection ADM1 (cascade)
   */
  private async updateAdm2Options(): Promise<void> {
    if (!this.overlay) return;
    
    const adm1Select = this.overlay.querySelector('#atlas-adm1-select') as HTMLSelectElement;
    const adm2Select = this.overlay.querySelector('#atlas-adm2-select') as HTMLSelectElement;
    const levelAdm2 = this.overlay.querySelector('#atlas-level-adm2') as HTMLInputElement;
    
    if (!adm1Select || !adm2Select) return;
    
    const selectedAdm1 = Array.from(adm1Select.selectedOptions).map(o => o.value).filter(v => v);
    
    // Charger les ADM2 filtrés par ADM1 via l'API
    let adm2List: Array<{ name: string; code?: string }> = [];
    
    if (selectedAdm1.length > 0) {
      // Charger les ADM2 pour chaque ADM1 sélectionné
      const promises = selectedAdm1.map(adm1 => 
        fetch(`${API_BASE_URL}/adm2?adm1=${encodeURIComponent(adm1)}`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      adm2List = results.flat();
    } else {
      // Aucune sélection = tous les ADM2
      adm2List = this.admCache.adm2;
    }
    
    // Filtrer par ceux qui ont des données
    const options = adm2List.map(a => {
      const hasData = this.admsWithData.adm2.has(a.name);
      return `<option value="${a.name}" ${hasData ? '' : 'disabled'}>${a.name}${hasData ? '' : ' (sans données)'}</option>`;
    }).join('');
    
    adm2Select.innerHTML = options || '<option value="">Aucune préfecture disponible</option>';
    adm2Select.disabled = !levelAdm2?.checked;
    
    // Mettre à jour le compteur
    const adm2WithData = adm2List.filter(a => this.admsWithData.adm2.has(a.name)).length;
    const adm2Count = this.overlay.querySelector('#adm2-count');
    if (adm2Count) adm2Count.textContent = String(adm2WithData);
    
    // Réinitialiser ADM3
    await this.updateAdm3Options();
  }
  
  /**
   * Met à jour les options ADM3 selon la sélection ADM2 (cascade)
   */
  private async updateAdm3Options(): Promise<void> {
    if (!this.overlay) return;
    
    const adm2Select = this.overlay.querySelector('#atlas-adm2-select') as HTMLSelectElement;
    const adm3Select = this.overlay.querySelector('#atlas-adm3-select') as HTMLSelectElement;
    const levelAdm3 = this.overlay.querySelector('#atlas-level-adm3') as HTMLInputElement;
    
    if (!adm2Select || !adm3Select) return;
    
    const selectedAdm2 = Array.from(adm2Select.selectedOptions).map(o => o.value).filter(v => v);
    
    // Charger les ADM3 filtrés par ADM2 via l'API
    let adm3List: Array<{ name: string; code?: string }> = [];
    
    if (selectedAdm2.length > 0) {
      // Charger les ADM3 pour chaque ADM2 sélectionné
      const promises = selectedAdm2.map(adm2 => 
        fetch(`${API_BASE_URL}/adm3?adm2=${encodeURIComponent(adm2)}`)
          .then(r => r.ok ? r.json() : [])
          .catch(() => [])
      );
      const results = await Promise.all(promises);
      adm3List = results.flat();
    } else {
      // Aucune sélection = tous les ADM3
      adm3List = this.admCache.adm3;
    }
    
    // Filtrer par ceux qui ont des données
    const options = adm3List.map(a => {
      const hasData = this.admsWithData.adm3.has(a.name);
      return `<option value="${a.name}" ${hasData ? '' : 'disabled'}>${a.name}${hasData ? '' : ' (sans données)'}</option>`;
    }).join('');
    
    adm3Select.innerHTML = options || '<option value="">Aucune commune disponible</option>';
    adm3Select.disabled = !levelAdm3?.checked;
    
    // Mettre à jour le compteur
    const adm3WithData = adm3List.filter(a => this.admsWithData.adm3.has(a.name)).length;
    const adm3Count = this.overlay.querySelector('#adm3-count');
    if (adm3Count) adm3Count.textContent = String(adm3WithData);
  }
  
  /**
   * Met à jour les compteurs d'ADM avec données
   */
  private updateAdmCounts(): void {
    if (!this.overlay) return;
    
    const adm1Count = this.overlay.querySelector('#adm1-count');
    const adm2Count = this.overlay.querySelector('#adm2-count');
    const adm3Count = this.overlay.querySelector('#adm3-count');
    
    if (adm1Count) adm1Count.textContent = String(this.admsWithData.adm1.size);
    if (adm2Count) adm2Count.textContent = String(this.admsWithData.adm2.size);
    if (adm3Count) adm3Count.textContent = String(this.admsWithData.adm3.size);
  }
  
  private collectConfig(): AtlasExportConfig {
    if (!this.overlay) return this.config;
    
    // Niveaux et sélections
    const levels = { adm1: false, adm2: false, adm3: false };
    const selectedAdms = { adm1: [] as string[], adm2: [] as string[], adm3: [] as string[] };
    
    const levelAdm1 = this.overlay.querySelector('#atlas-level-adm1') as HTMLInputElement;
    const levelAdm2 = this.overlay.querySelector('#atlas-level-adm2') as HTMLInputElement;
    const levelAdm3 = this.overlay.querySelector('#atlas-level-adm3') as HTMLInputElement;
    
    const adm1Select = this.overlay.querySelector('#atlas-adm1-select') as HTMLSelectElement;
    const adm2Select = this.overlay.querySelector('#atlas-adm2-select') as HTMLSelectElement;
    const adm3Select = this.overlay.querySelector('#atlas-adm3-select') as HTMLSelectElement;
    
    if (levelAdm1?.checked) {
      levels.adm1 = true;
      selectedAdms.adm1 = Array.from(adm1Select?.selectedOptions || []).map(o => o.value).filter(v => v);
    }
    if (levelAdm2?.checked) {
      levels.adm2 = true;
      selectedAdms.adm2 = Array.from(adm2Select?.selectedOptions || []).map(o => o.value).filter(v => v);
    }
    if (levelAdm3?.checked) {
      levels.adm3 = true;
      selectedAdms.adm3 = Array.from(adm3Select?.selectedOptions || []).map(o => o.value).filter(v => v);
    }
    
    // Thématiques
    const thematics: string[] = [];
    this.overlay.querySelectorAll('input[name="thematic"]:checked').forEach((cb: any) => {
      thematics.push(cb.value);
    });
    
    // Options
    const format = (this.overlay.querySelector('#atlas-format') as HTMLSelectElement)?.value as 'png' | 'pdf';
    const quality = (this.overlay.querySelector('#atlas-quality') as HTMLSelectElement)?.value as 'web' | 'print' | 'hd';
    const maskMode = (this.overlay.querySelector('#atlas-mask') as HTMLSelectElement)?.value as 'none' | 'context' | 'focus' | 'clip';
    const includeStats = (this.overlay.querySelector('#atlas-stats') as HTMLInputElement)?.checked;
    const includeNeighbors = (this.overlay.querySelector('#atlas-neighbors') as HTMLInputElement)?.checked;
    const showAdmBoundary = (this.overlay.querySelector('#atlas-show-boundary') as HTMLInputElement)?.checked;
    const showEmptyCells = (this.overlay.querySelector('#atlas-show-empty-cells') as HTMLInputElement)?.checked;
    const onlyAdmCells = (this.overlay.querySelector('#atlas-only-adm-cells') as HTMLInputElement)?.checked;
    const boundaryLevel = (this.overlay.querySelector('#atlas-boundary-level') as HTMLSelectElement)?.value as 'none' | 'adm1' | 'adm2';
    
    // Options export données
    const exportDataEnabled = (this.overlay.querySelector('#atlas-export-data') as HTMLInputElement)?.checked || false;
    const dataOptions = {
      includeGrid: (this.overlay.querySelector('#atlas-data-grid') as HTMLInputElement)?.checked || false,
      includeAdm: (this.overlay.querySelector('#atlas-data-adm') as HTMLInputElement)?.checked || false,
      includeThematic: (this.overlay.querySelector('#atlas-data-thematic') as HTMLInputElement)?.checked || false,
      includeSondages: (this.overlay.querySelector('#atlas-data-sondages') as HTMLInputElement)?.checked || false,
      includeEssais: (this.overlay.querySelector('#atlas-data-essais') as HTMLInputElement)?.checked || false
    };
    
    // Collecter les palettes par thématique (v3.5.0)
    const thematicPalettes: Record<string, string> = {};
    thematics.forEach(thematicId => {
      const paletteSelect = this.overlay?.querySelector(`#atlas-palette-${thematicId}`) as HTMLSelectElement;
      if (paletteSelect?.value) {
        thematicPalettes[thematicId] = paletteSelect.value;
      } else {
        // Utiliser la palette recommandée par défaut
        const recommended = getRecommendedPalette(thematicId);
        thematicPalettes[thematicId] = recommended.palette;
      }
    });
    
    return {
      levels,
      selectedAdms,
      thematics,
      maskMode,
      format,
      quality,
      includeStats,
      includeNeighbors,
      showEmptyCells,
      onlyAdmCells,
      showAdmBoundary,
      boundaryLevel,
      exportData: exportDataEnabled,
      dataOptions,
      exportCharts: (this.overlay.querySelector('#atlas-export-charts') as HTMLInputElement)?.checked || false,
      exportExcel: (this.overlay.querySelector('#atlas-export-excel') as HTMLInputElement)?.checked || false,
      thematicPalettes,
      // Options grille et cadre (v3.5.3)
      gridType: ((this.overlay.querySelector('#atlas-grid-type') as HTMLSelectElement)?.value || 'cross') as 'none' | 'cross' | 'continuous' | 'labels-only',
      frameStyle: ((this.overlay.querySelector('#atlas-frame-style') as HTMLSelectElement)?.value || 'simple') as 'none' | 'simple' | 'double' | 'zebra',
      // Mode debug rapide
      debugMode: (this.overlay.querySelector('#atlas-debug-mode') as HTMLInputElement)?.checked || false
    };
  }
  
  private progressModal: ExportProgressModal | null = null;
  
  private async startExport(): Promise<void> {
    if (this.isExporting) return;
    
    const config = this.collectConfig();
    
    // Validation
    if (!config.levels.adm1 && !config.levels.adm2 && !config.levels.adm3) {
      alert('Veuillez sélectionner au moins un niveau administratif.');
      return;
    }
    if (config.thematics.length === 0) {
      alert('Veuillez sélectionner au moins une thématique.');
      return;
    }
    
    this.isExporting = true;
    this.abortRequested = false;
    this.config = config;
    
    // Afficher la progression simple
    const progressDiv = this.overlay?.querySelector('#atlas-progress') as HTMLElement;
    const exportBtn = this.overlay?.querySelector('#atlas-export-btn') as HTMLButtonElement;
    const closeBtn = this.overlay?.querySelector('[data-action="close"]') as HTMLButtonElement;
    if (progressDiv) progressDiv.style.display = 'block';
    if (exportBtn) {
      exportBtn.disabled = true;
      exportBtn.textContent = '⏳ Export en cours...';
    }
    if (closeBtn) {
      closeBtn.textContent = 'Annuler';
      closeBtn.onclick = () => { this.abortRequested = true; };
    }
    
    // Connecter le callback d'annulation du modal de progression (v3.5.2)
    if (this.progressModal) {
      this.progressModal.setOnCancel(() => {
        this.abortRequested = true;
        this.progressModal?.log('warning', 'CANCEL', 'Signal d\'annulation reçu');
      });
    }
    
    // Appeler le callback
    if (this.onExportStart) {
      this.onExportStart(config);
    }
    
    try {
      await this.runBatchExport(config);
    } catch (e) {
      console.error('[Atlas Export] Erreur:', e);
      this.progressModal?.fail(String(e));
      alert(`Erreur lors de l'export: ${e}`);
    } finally {
      this.isExporting = false;
      if (exportBtn) {
        exportBtn.disabled = false;
        exportBtn.textContent = '🚀 Lancer l\'export';
      }
      if (closeBtn) {
        closeBtn.textContent = 'Annuler';
        closeBtn.onclick = () => this.close();
      }
    }
  }
  
  /**
   * Exécute l'export batch séquentiel
   */
  private async runBatchExport(config: AtlasExportConfig): Promise<void> {
    // v3.5.2: Attacher le bridge console pour capturer tous les logs F12
    const exportLogger = getExportLogger({
      exportId: `atlas-${Date.now()}`,
      captureConsole: true,
      onLog: (entry: LogEntry) => {
        // Bridge vers le modal de progression si disponible
        if (this.progressModal) {
          const level = entry.level === 'warning' ? 'warning' :
                        entry.level === 'error' ? 'error' :
                        entry.level === 'success' ? 'success' : 'info';
          this.progressModal.log(level, entry.category, entry.message);
        }
      }
    });
    exportLogger.attach();
    
    try {
      await this.runBatchExportInternal(config, exportLogger);
    } finally {
      // Toujours détacher le logger à la fin
      exportLogger.detach();
    }
  }
  
  /**
   * Implémentation interne de l'export batch
   */
  private async runBatchExportInternal(config: AtlasExportConfig, exportLogger: ReturnType<typeof getExportLogger>): Promise<void> {
    // Log de configuration (v3.5.1 - debug)
    console.log('[Atlas][CONFIG] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('[Atlas][CONFIG] Qualité:', config.quality);
    console.log('[Atlas][CONFIG] Export Data:', config.exportData);
    console.log('[Atlas][CONFIG] Export Charts:', config.exportCharts);
    console.log('[Atlas][CONFIG] Export Excel:', config.exportExcel);
    console.log('[Atlas][CONFIG] Thématiques:', config.thematics);
    
    // Déterminer les ADM à exporter
    const levels: Array<'adm1' | 'adm2' | 'adm3'> = [];
    if (config.levels.adm1) levels.push('adm1');
    if (config.levels.adm2) levels.push('adm2');
    if (config.levels.adm3) levels.push('adm3');
    
    this.updateProgress('Préparation des zones administratives...', 5);
    
    // Construire la liste des ADM à exporter
    const admToExport: Record<string, Array<{ code: string; name: string }>> = {};
    
    for (const level of levels) {
      let admList = this.admCache[level] || [];
      
      // Filtrer par sélection spécifique
      const selected = config.selectedAdms[level];
      if (selected && selected.length > 0) {
        admList = admList.filter(a => selected.includes(a.name));
      }
      
      // Filtrer par données disponibles
      admList = admList.filter(a => this.admsWithData[level].has(a.name));
      
      admToExport[level] = admList;
      console.log(`[Atlas] ${level}: ${admList.length} ADM à exporter`);
    }
    
    // Calculer le total
    let totalExports = 0;
    for (const level of levels) {
      totalExports += (admToExport[level]?.length || 0) * config.thematics.length;
    }
    
    if (totalExports === 0) {
      alert('Aucune zone administrative avec données trouvée pour les niveaux sélectionnés.');
      return;
    }
    
    // Afficher un modal de confirmation professionnel
    const confirmed = await this.showConfirmationModal(config, levels, admToExport);
    if (!confirmed) {
      this.updateProgress('Export annulé', 0);
      return;
    }
    
    // Ouvrir le modal de progression verbose
    this.progressModal = getExportProgressModal();
    this.progressModal.open(totalExports, () => {
      // Callback de fermeture du modal
    });
    this.progressModal.log('info', 'CONFIG', `Niveaux: ${levels.join(', ')}`);
    this.progressModal.log('info', 'CONFIG', `Thématiques: ${config.thematics.join(', ')}`);
    this.progressModal.log('info', 'CONFIG', `Qualité: ${config.quality} | Masque: ${config.maskMode}`);
    this.progressModal.log('info', 'CONFIG', `Options: stats=${config.includeStats}, voisins=${config.includeNeighbors}, mailles vides=${config.showEmptyCells}`);
    
    // Préparer le ZIP
    const JSZip = (window as any).JSZip;
    let zip: any = null;
    if (JSZip) {
      zip = new JSZip();
      this.progressModal.log('success', 'ZIP', 'JSZip initialisé');
    } else {
      this.progressModal.log('warning', 'ZIP', 'JSZip non disponible - export sans ZIP');
    }
    
    // Générer les exports
    let current = 0;
    const results: Array<{ level: string; name: string; thematic: string; success: boolean; blob?: Blob }> = [];
    
    for (const level of levels) {
      const admList = admToExport[level] || [];
      this.progressModal?.log('info', 'LEVEL', `Traitement niveau ${level.toUpperCase()}: ${admList.length} ADM`);
      
      for (const adm of admList) {
        for (const thematicId of config.thematics) {
          if (this.abortRequested) {
            this.progressModal?.log('warning', 'ABORT', 'Export annulé par l\'utilisateur');
            this.updateProgress(`Export annulé (${current}/${totalExports} complétés)`, (current / totalExports) * 100);
            await this.finalizeExport(zip, results, current, totalExports, config);
            return;
          }
          
          current++;
          const percent = (current / totalExports) * 100;
          const thematicLabel = ALL_THEMATICS.find(t => t.id === thematicId)?.label || thematicId;
          const startTime = Date.now();
          
          // Log début de carte
          this.progressModal?.startMap(level, adm.name, thematicId, current - 1);
          this.progressModal?.updateProgress(current - 1, adm.name, thematicId, 'Préparation...');
          
          this.updateProgress(
            `${current}/${totalExports} - ${level.toUpperCase()} ${adm.name} - ${thematicLabel}`,
            percent
          );
          
          // Générer l'export via le moteur Export Pro
          let success = false;
          let blob: Blob | null = null;
          
          if (this.callbacks?.setThematicAndAdm && this.callbacks?.getExportProConfig) {
            try {
              // 1. Changer la thématique et l'ADM sur la carte (v3.5.2: avec palette)
              this.progressModal?.logStep('Chargement thématique et ADM...');
              const palette = config.thematicPalettes?.[thematicId];
              await this.callbacks.setThematicAndAdm(thematicId, level, adm.name, palette);
              
              // 2. Attendre le rendu complet (tuiles + thématique)
              this.progressModal?.logStep('Attente rendu carte (1s)...');
              await new Promise(r => setTimeout(r, 1000));
              
              // 3. Créer une instance d'ExportQuickDialog avec la config actuelle
              this.progressModal?.logStep('Initialisation moteur export...');
              const exportProConfig = this.callbacks.getExportProConfig();
              const exportPro = new ExportQuickDialog(exportProConfig);
              
              // 4. Exporter via le moteur Pro (qualité identique à Export Pro)
              this.progressModal?.logStep('Capture et rendu PNG...');
              blob = await exportPro.exportSingle({
                quality: config.quality as ExportQuality,
                maskMode: config.maskMode,
                showEmptyCells: config.showEmptyCells,
                onlyAdmCells: config.onlyAdmCells,
                includeStats: config.includeStats,
                includeNeighbors: config.includeNeighbors,
                boundaryLevel: config.boundaryLevel,
                // v3.5.3: Options grille et cadre
                gridType: config.gridType,
                frameStyle: config.frameStyle,
                onProgress: (msg) => {
                  this.progressModal?.logStep(msg);
                  this.updateProgress(`${current}/${totalExports} - ${adm.name} - ${msg}`, percent);
                }
              });
              
              success = blob !== null;
              const duration = Date.now() - startTime;
              
              // Ajouter au ZIP
              if (zip && blob) {
                const filename = this.sanitizeFilename(`${level}/${thematicId}/${adm.name}_${thematicId}.png`);
                zip.file(filename, blob);
                this.progressModal?.endMapSuccess(adm.name, thematicId, duration, blob.size);
              } else if (!blob) {
                this.progressModal?.endMapError(adm.name, thematicId, 'Blob null');
              }
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              this.progressModal?.endMapError(adm.name, thematicId, errorMsg);
              console.warn(`[Atlas] Erreur export ${level}/${adm.name}/${thematicId}:`, e);
            }
          } else if (this.callbacks?.exportSingleMap) {
            // Fallback sur l'ancienne méthode si disponible
            this.progressModal?.logStep('Utilisation fallback exportSingleMap...');
            try {
              blob = await this.callbacks.exportSingleMap(level, adm.name, thematicId, config);
              success = blob !== null;
              const duration = Date.now() - startTime;
              
              if (zip && blob) {
                const filename = this.sanitizeFilename(`${level}/${thematicId}/${adm.name}_${thematicId}.png`);
                zip.file(filename, blob);
                this.progressModal?.endMapSuccess(adm.name, thematicId, duration, blob.size);
              }
            } catch (e) {
              const errorMsg = e instanceof Error ? e.message : String(e);
              this.progressModal?.endMapError(adm.name, thematicId, errorMsg);
              console.warn(`[Atlas] Erreur export ${level}/${adm.name}/${thematicId}:`, e);
            }
          } else {
            this.progressModal?.log('error', 'EXPORT', 'Aucun callback d\'export disponible');
            console.error('[Atlas] Aucun callback d\'export disponible');
            success = false;
          }
          
          results.push({ level, name: adm.name, thematic: thematicId, success, blob: blob || undefined });
        }
      }
    }
    
    // Finaliser et télécharger le ZIP
    this.updateProgress('Création du fichier ZIP...', 99);
    await this.finalizeExport(zip, results, current, totalExports, config);
  }
  
  private sanitizeFilename(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_\-\/\.]/g, '_')
      .replace(/_+/g, '_');
  }
  
  private async finalizeExport(
    zip: any,
    results: Array<{ level: string; name: string; thematic: string; success: boolean }>,
    completed: number,
    total: number,
    config?: AtlasExportConfig
  ): Promise<void> {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    // Démarrer la phase de finalisation dans le modal
    this.progressModal?.startFinalization();
    this.progressModal?.log('info', 'FINAL', `Cartes exportées: ${successful}/${total} (${failed} erreurs)`);
    
    // Générer le ZIP si disponible et des exports ont réussi
    console.log('[Atlas] Finalisation export:', { zip: !!zip, successful, failed, completed, total });
    
    if (zip && successful > 0) {
      try {
        // ========== EXPORT DONNÉES POUR ANALYSE ==========
        if (config?.exportData) {
          this.updateProgress('Export des données pour analyse...', 92);
          console.log('[Atlas] Export données activé:', config.dataOptions);
          
          try {
            const dataConfig: ExportDataConfig = {
              includeGrid: config.dataOptions.includeGrid,
              includeAdm1: config.dataOptions.includeAdm,
              includeAdm2: config.dataOptions.includeAdm,
              includeAdm3: false,
              parameters: config.dataOptions.includeThematic ? config.thematics : [],
              includeSondages: config.dataOptions.includeSondages,
              includeEssaisAtterberg: config.dataOptions.includeEssais,
              includeEssaisVbs: config.dataOptions.includeEssais,
              includeEssaisProctor: config.dataOptions.includeEssais,
              includeEssaisGranulo: config.dataOptions.includeEssais,
              format: 'geojson',
              includeMetadata: true
            };
            
            // Exporter les données
            const dataBlob = await exportData(dataConfig, (msg, pct) => {
              this.updateProgress(`Données: ${msg}`, 92 + pct * 0.02);
            });
            
            // Ajouter au ZIP principal
            const dataArrayBuffer = await dataBlob.arrayBuffer();
            zip.file('donnees_analyse.zip', dataArrayBuffer);
            console.log('[Atlas] Données pour analyse ajoutées au ZIP');
          } catch (e) {
            console.warn('[Atlas] Erreur export données:', e);
          }
        }
        
        // ========== GÉNÉRATION DES GRAPHES STATISTIQUES ==========
        if (config?.exportCharts && config.thematics.length > 0) {
          this.updateProgress('Génération des graphes statistiques...', 95);
          console.log('[Atlas] Génération graphes pour:', config.thematics);
          
          try {
            // Récupérer les données thématiques pour les graphes
            const featuresMap: Record<string, any[]> = {};
            
            for (const thematicId of config.thematics) {
              try {
                const url = `${API_BASE_URL}/thematic/data?parameter=${thematicId}&include_geometry=true`;
                const response = await fetch(url);
                if (response.ok) {
                  const data = await response.json();
                  featuresMap[thematicId] = data.features || [];
                }
              } catch (e) {
                console.warn(`[Atlas] Erreur chargement données ${thematicId}:`, e);
              }
            }
            
            // Générer les graphes
            const chartSets = await generateAllCharts(
              config.thematics,
              featuresMap,
              (msg, pct) => this.updateProgress(`Graphes: ${msg}`, 95 + pct * 0.03)
            );
            
            // Ajouter les graphes au ZIP
            let chartCount = 0;
            chartSets.forEach((chartSet, thematicId) => {
              for (const chart of chartSet.charts) {
                const filename = `graphes/${thematicId}/${chart.filename}`;
                zip.file(filename, chart.blob);
                chartCount++;
              }
            });
            
            console.log(`[Atlas] ${chartCount} graphes ajoutés au ZIP`);
          } catch (e) {
            console.warn('[Atlas] Erreur génération graphes:', e);
          }
        }
        
        // ========== EXPORT EXCEL UNIQUE (v3.5.1) ==========
        console.log('[Atlas][EXCEL] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
        console.log('[Atlas][EXCEL] Flag exportExcel:', config?.exportExcel);
        if (config?.exportExcel) {
          this.updateProgress('Génération du fichier Excel...', 97);
          console.log('[Atlas][EXCEL] Démarrage génération Excel...');
          this.progressModal?.log('info', 'EXCEL', 'Préparation des données Excel...');
          
          try {
            // Collecter les données GeoJSON et CSV pour l'Excel
            const geojsonFiles = new Map<string, any>();
            const csvFiles = new Map<string, string>();
            
            // Récupérer les grilles thématiques
            for (const thematicId of config.thematics) {
              try {
                const url = `${API_BASE_URL}/thematic/data?parameter=${thematicId}&include_geometry=false`;
                const response = await fetch(url);
                if (response.ok) {
                  const data = await response.json();
                  geojsonFiles.set(`grid_${thematicId}`, data);
                }
              } catch (e) {
                console.warn(`[Atlas] Erreur chargement ${thematicId} pour Excel:`, e);
              }
            }
            
            // v3.5.3: Les endpoints /export/sondages et /export/essais/* n'existent pas dans le backend
            // Utiliser les données thématiques déjà chargées pour générer un résumé CSV
            console.log('[Atlas][EXCEL] Génération CSV à partir des données thématiques disponibles...');
            
            // Créer un CSV résumé à partir des données geojson thématiques
            if (geojsonFiles.size > 0) {
              // Générer un CSV de synthèse par maille
              const syntheseRows: string[] = ['code,n_sondages,vbs_avg,ip_avg,wl_avg,eg_avg,gamma_d_max_avg'];
              const mailleData = new Map<string, Record<string, number>>();
              
              for (const [thematicId, geojson] of geojsonFiles) {
                if (geojson?.features) {
                  for (const feature of geojson.features) {
                    const code = feature.properties?.code || 'unknown';
                    if (!mailleData.has(code)) {
                      mailleData.set(code, {});
                    }
                    const data = mailleData.get(code)!;
                    const value = feature.properties?.value;
                    if (value != null && Number.isFinite(value)) {
                      data[thematicId] = value;
                    }
                  }
                }
              }
              
              // Convertir en CSV
              for (const [code, data] of mailleData) {
                syntheseRows.push([
                  code,
                  data.n_sondages ?? '',
                  data.vbs_avg ?? '',
                  data.ip_avg ?? '',
                  data.wl_avg ?? '',
                  data.eg_avg ?? '',
                  data.gamma_d_max_avg ?? ''
                ].join(','));
              }
              
              if (syntheseRows.length > 1) {
                csvFiles.set('synthese_mailles', syntheseRows.join('\n'));
                console.log(`[Atlas][EXCEL] CSV synthèse généré: ${mailleData.size} mailles, ${syntheseRows.length - 1} lignes`);
              }
            }
            
            console.log(`[Atlas][EXCEL] ${geojsonFiles.size} fichiers GeoJSON, ${csvFiles.size} fichiers CSV`);
            
            // Générer le fichier Excel
            const excelBlob = await generateAnalysisExcel({
              geojsonFiles,
              csvFiles,
              includeGridWide: true,
              includeDictionary: true,
              includeQASummary: true,
              metadata: {
                exportDate: new Date().toLocaleDateString('fr-FR'),
                version: '3.4.3'
              }
            });
            
            // Ajouter au ZIP
            const excelSizeMB = excelBlob.size / 1024 / 1024;
            zip.file('atlas_geotechnique_donnees_analyse.xlsx', excelBlob);
            console.log(`[Atlas][EXCEL] ✅ Fichier Excel ajouté au ZIP (${excelSizeMB.toFixed(2)} Mo)`);
            this.progressModal?.log('success', 'EXCEL', `Fichier Excel généré: ${excelSizeMB.toFixed(2)} Mo`);
          } catch (e) {
            console.error('[Atlas][EXCEL] ❌ Erreur génération Excel:', e);
            this.progressModal?.log('error', 'EXCEL', `Erreur: ${e}`);
          }
        } else {
          console.log('[Atlas][EXCEL] Export Excel désactivé (checkbox non cochée)');
        }
        
        // Ajouter un fichier index.json avec les métadonnées (v3.4.1 enrichi)
        const skippedThematics = this.getSkippedThematics(config?.thematics || []);
        const indexData = {
          generated: new Date().toISOString(),
          version: '3.4.1',
          total: total,
          completed: completed,
          successful: successful,
          failed: failed,
          includesDataExport: config?.exportData || false,
          includesCharts: config?.exportCharts || false,
          // v3.4.1: Thématiques ignorées car sans données
          skipped: skippedThematics.map(t => ({
            thematic: t.id,
            reason: 'no_data' as const,
            message: `Aucune donnée disponible pour ${t.label}`
          })),
          exports: results.map(r => ({
            level: r.level,
            name: r.name,
            thematic: r.thematic,
            success: r.success,
            filename: r.success ? this.sanitizeFilename(`${r.level}/${r.thematic}/${r.name}_${r.thematic}.png`) : null
          }))
        };
        zip.file('index.json', JSON.stringify(indexData, null, 2));
        
        this.progressModal?.log('info', 'ZIP', 'Compression du fichier ZIP...');
        console.log('[Atlas] Génération du ZIP en cours...');
        this.updateProgress('Compression du fichier ZIP...', 99);
        
        // Générer le ZIP avec compression
        const zipBlob = await zip.generateAsync({ 
          type: 'blob',
          compression: 'DEFLATE',
          compressionOptions: { level: 6 }
        });
        
        const zipSizeMB = zipBlob.size / 1024 / 1024;
        console.log('[Atlas] ZIP généré, taille:', zipSizeMB.toFixed(2), 'Mo');
        this.progressModal?.log('success', 'ZIP', `ZIP généré: ${zipSizeMB.toFixed(2)} Mo`);
        
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `atlas_geotechnique_${timestamp}.zip`;
        
        // Méthode de téléchargement améliorée
        const url = URL.createObjectURL(zipBlob);
        console.log('[Atlas] Blob URL créé:', url);
        
        // Créer un lien et déclencher le téléchargement
        const a = document.createElement('a');
        a.style.display = 'none';
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        
        // Petit délai pour s'assurer que le navigateur est prêt
        await new Promise(r => setTimeout(r, 100));
        
        a.click();
        this.progressModal?.log('success', 'DOWNLOAD', `Téléchargement: ${filename}`);
        console.log('[Atlas] Téléchargement déclenché');
        
        // Attendre un peu avant de révoquer l'URL (laisser le temps au téléchargement de démarrer)
        setTimeout(() => {
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          console.log('[Atlas] Blob URL révoqué');
        }, 5000);
        
        this.updateProgress('Export terminé!', 100);
        
        // Marquer l'export comme terminé dans le modal
        this.progressModal?.complete(zipSizeMB);
        
        // POST-TRAITEMENT: Si export ADM1, lancer SQL + Python automatiquement
        if (config?.levels?.adm1) {
          console.log('[Atlas] 🔄 Lancement post-traitement ADM1 (SQL + Python)...');
          this.progressModal?.log('info', 'POST-PROCESS', 'Lancement enrichissement préfectures...');
          
          try {
            const token = tokenStorage.getAccessToken();
            const response = await fetch(`${API_BASE_URL}/export/post-process/adm1`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                ...(token ? { 'Authorization': `Bearer ${token}` } : {})
              }
            });
            
            if (response.ok) {
              const result = await response.json();
              console.log('[Atlas] ✅ Post-traitement terminé:', result);
              this.progressModal?.log('success', 'POST-PROCESS', 'Enrichissement préfectures terminé');
            } else {
              console.warn('[Atlas] ⚠️ Post-traitement échoué:', response.status);
              this.progressModal?.log('warning', 'POST-PROCESS', `Erreur ${response.status} - stats préfectures non générées`);
            }
          } catch (e) {
            console.warn('[Atlas] ⚠️ Post-traitement non disponible:', e);
            this.progressModal?.log('warning', 'POST-PROCESS', 'Service post-traitement non disponible');
          }
        }
        
        this.showResults(results, completed, total, true);
        return;
      } catch (e) {
        console.error('[Atlas] Erreur génération ZIP:', e);
        alert(`Erreur lors de la génération du ZIP: ${e}`);
      }
    }
    
    // Fallback: afficher les résultats sans ZIP
    this.updateProgress('Export terminé!', 100);
    this.showResults(results, completed, total, false);
  }
  
  private showResults(
    results: Array<{ level: string; name: string; thematic: string; success: boolean }>,
    completed: number,
    total: number,
    zipDownloaded: boolean = false
  ): void {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    let message = `📚 Export Atlas Terminé\n\n`;
    message += `✅ ${successful} exports réussis\n`;
    if (failed > 0) {
      message += `❌ ${failed} exports échoués\n`;
    }
    if (completed < total) {
      message += `⏸️ ${total - completed} exports annulés\n`;
    }
    
    if (zipDownloaded) {
      message += `\n📦 Fichier ZIP téléchargé avec succès!`;
    } else if (successful > 0) {
      message += `\n⚠️ JSZip non disponible - exports simulés.\n`;
      message += `Ajoutez JSZip pour le téléchargement ZIP.`;
    } else {
      message += `\nNote: Aucun callback d'export configuré.\n`;
      message += `Utilisez "Export Pro" pour exporter une carte à la fois.`;
    }
    
    alert(message);
    this.close();
  }
  
  private updateProgress(text: string, percent: number): void {
    const progressText = this.overlay?.querySelector('#atlas-progress-text');
    const progressFill = this.overlay?.querySelector('#atlas-progress-fill') as HTMLElement;
    
    if (progressText) progressText.textContent = text;
    if (progressFill) progressFill.style.width = `${percent}%`;
  }
  
  /**
   * Affiche un modal de confirmation professionnel au lieu de confirm()
   */
  private showConfirmationModal(
    config: AtlasExportConfig,
    levels: Array<'adm1' | 'adm2' | 'adm3'>,
    admToExport: Record<string, Array<{ code: string; name: string }>>
  ): Promise<boolean> {
    return new Promise((resolve) => {
      // Calculer les totaux
      let totalMaps = 0;
      const levelCounts: Record<string, number> = {};
      for (const level of levels) {
        const count = admToExport[level]?.length || 0;
        levelCounts[level] = count;
        totalMaps += count * config.thematics.length;
      }
      
      // Créer le modal
      const modal = document.createElement('div');
      modal.className = 'atlas-confirm-overlay';
      modal.innerHTML = `
        <div class="atlas-confirm-modal">
          <div class="atlas-confirm-header">
            <span class="atlas-confirm-icon">🗺️</span>
            <h3>Confirmer l'export</h3>
          </div>
          <div class="atlas-confirm-body">
            <div class="atlas-confirm-summary">
              <div class="atlas-confirm-total">
                <span class="number">${totalMaps}</span>
                <span class="label">cartes à générer</span>
              </div>
            </div>
            <div class="atlas-confirm-details">
              ${levels.map(l => `
                <div class="atlas-confirm-row">
                  <span class="atlas-confirm-level">${l.toUpperCase()}</span>
                  <span class="atlas-confirm-count">${levelCounts[l]} zone${levelCounts[l] > 1 ? 's' : ''}</span>
                </div>
              `).join('')}
              <div class="atlas-confirm-row">
                <span class="atlas-confirm-level">Thématiques</span>
                <span class="atlas-confirm-count">${config.thematics.length}</span>
              </div>
              ${config.boundaryLevel !== 'none' ? `
              <div class="atlas-confirm-row" style="background: #dbeafe;">
                <span class="atlas-confirm-level">🗺️ Subdivisions</span>
                <span class="atlas-confirm-count" style="background: #3b82f6; color: white;">
                  ${config.boundaryLevel === 'adm1' ? 'Régions' : 'Préfectures'}
                </span>
              </div>
              ` : ''}
            </div>
            <div class="atlas-confirm-warning">
              <span class="icon">⏱️</span>
              <span>Cette opération peut prendre plusieurs minutes selon le nombre de cartes.</span>
            </div>
          </div>
          <div class="atlas-confirm-footer">
            <button class="atlas-btn atlas-btn-secondary" data-action="cancel">Annuler</button>
            <button class="atlas-btn atlas-btn-primary" data-action="confirm">
              <span>🚀</span> Lancer l'export
            </button>
          </div>
        </div>
      `;
      
      // Ajouter les styles si pas déjà présents
      if (!document.getElementById('atlas-confirm-styles')) {
        const style = document.createElement('style');
        style.id = 'atlas-confirm-styles';
        style.textContent = `
          .atlas-confirm-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0, 0, 0, 0.6);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 10001;
            animation: fadeIn 0.2s ease;
          }
          @keyframes fadeIn {
            from { opacity: 0; }
            to { opacity: 1; }
          }
          .atlas-confirm-modal {
            background: white;
            border-radius: 16px;
            box-shadow: 0 25px 80px rgba(0, 0, 0, 0.4);
            width: 420px;
            overflow: hidden;
            animation: slideUp 0.3s ease;
          }
          @keyframes slideUp {
            from { transform: translateY(20px); opacity: 0; }
            to { transform: translateY(0); opacity: 1; }
          }
          .atlas-confirm-header {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            padding: 20px 24px;
            display: flex;
            align-items: center;
            gap: 12px;
          }
          .atlas-confirm-header .atlas-confirm-icon {
            font-size: 28px;
          }
          .atlas-confirm-header h3 {
            margin: 0;
            color: white;
            font-size: 18px;
            font-weight: 600;
          }
          .atlas-confirm-body {
            padding: 24px;
          }
          .atlas-confirm-summary {
            text-align: center;
            margin-bottom: 20px;
          }
          .atlas-confirm-total {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
          }
          .atlas-confirm-total .number {
            font-size: 48px;
            font-weight: 700;
            color: #1e40af;
            line-height: 1;
          }
          .atlas-confirm-total .label {
            font-size: 14px;
            color: #6b7280;
          }
          .atlas-confirm-details {
            background: #f8fafc;
            border-radius: 10px;
            padding: 16px;
            margin-bottom: 16px;
          }
          .atlas-confirm-row {
            display: flex;
            justify-content: space-between;
            padding: 8px 0;
            border-bottom: 1px solid #e5e7eb;
          }
          .atlas-confirm-row:last-child {
            border-bottom: none;
          }
          .atlas-confirm-level {
            font-weight: 500;
            color: #374151;
          }
          .atlas-confirm-count {
            color: #6b7280;
            background: #e5e7eb;
            padding: 2px 10px;
            border-radius: 12px;
            font-size: 13px;
          }
          .atlas-confirm-warning {
            display: flex;
            align-items: center;
            gap: 10px;
            background: #fef3c7;
            border: 1px solid #fcd34d;
            border-radius: 8px;
            padding: 12px 16px;
            font-size: 13px;
            color: #92400e;
          }
          .atlas-confirm-warning .icon {
            font-size: 18px;
          }
          .atlas-confirm-footer {
            padding: 16px 24px;
            background: #f9fafb;
            display: flex;
            justify-content: flex-end;
            gap: 12px;
          }
          .atlas-confirm-footer .atlas-btn {
            padding: 10px 20px;
            border-radius: 8px;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            border: none;
            display: flex;
            align-items: center;
            gap: 6px;
          }
          .atlas-confirm-footer .atlas-btn-secondary {
            background: #e5e7eb;
            color: #374151;
          }
          .atlas-confirm-footer .atlas-btn-secondary:hover {
            background: #d1d5db;
          }
          .atlas-confirm-footer .atlas-btn-primary {
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            color: white;
          }
          .atlas-confirm-footer .atlas-btn-primary:hover {
            background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%);
          }
        `;
        document.head.appendChild(style);
      }
      
      document.body.appendChild(modal);
      
      // Event listeners
      const cancelBtn = modal.querySelector('[data-action="cancel"]');
      const confirmBtn = modal.querySelector('[data-action="confirm"]');
      
      const cleanup = () => {
        modal.remove();
      };
      
      cancelBtn?.addEventListener('click', () => {
        cleanup();
        resolve(false);
      });
      
      confirmBtn?.addEventListener('click', () => {
        cleanup();
        resolve(true);
      });
      
      // Fermer sur clic overlay
      modal.addEventListener('click', (e) => {
        if (e.target === modal) {
          cleanup();
          resolve(false);
        }
      });
    });
  }
  
  /**
   * Identifie les thématiques sans données (v3.4.1 - E2)
   * Utilisé pour skip automatique et reporting dans index.json
   */
  private getSkippedThematics(requestedThematics: string[]): Array<{ id: string; label: string }> {
    const skipped: Array<{ id: string; label: string }> = [];
    
    // Thématiques connues pour être souvent vides (Proctor notamment)
    const knownEmptyThematics = ['gamma_d_max_avg', 'w_opt_avg'];
    
    for (const thematicId of requestedThematics) {
      // Vérifier si la thématique est dans la liste des thématiques connues vides
      if (knownEmptyThematics.includes(thematicId)) {
        const thematicInfo = ALL_THEMATICS.find(t => t.id === thematicId);
        if (thematicInfo) {
          skipped.push({ id: thematicId, label: thematicInfo.label });
        }
      }
    }
    
    return skipped;
  }
  
  /**
   * Vérifie si une thématique a des données pour un ADM donné (v3.4.1)
   * @returns true si des données existent, false sinon
   */
  private async checkThematicHasData(
    thematicId: string,
    admLevel: string,
    admName: string
  ): Promise<boolean> {
    try {
      const url = `${API_BASE_URL}/thematic/data?parameter=${thematicId}&${admLevel}=${encodeURIComponent(admName)}&limit=1`;
      const response = await fetch(url);
      
      if (!response.ok) return false;
      
      const data = await response.json();
      const features = data.features || [];
      
      // Vérifier si au moins une feature a une valeur non nulle
      return features.some((f: any) => f.properties?.value !== null && f.properties?.value !== undefined);
    } catch (e) {
      console.warn(`[Atlas] Erreur vérification données ${thematicId}/${admLevel}/${admName}:`, e);
      return false;
    }
  }
}

// ============================================================================
// Factory function
// ============================================================================

export function createExportAtlasDialog(
  onExportStart?: (config: AtlasExportConfig) => void,
  callbacks?: AtlasExportCallbacks
): ExportAtlasDialog {
  return new ExportAtlasDialog(onExportStart, callbacks);
}
