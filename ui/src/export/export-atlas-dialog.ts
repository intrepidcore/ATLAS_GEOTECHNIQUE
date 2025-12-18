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

import { ActiveAdmFilters } from './export-types';

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
  quality: 'web' | 'print';
  includeStats: boolean;
  includeNeighbors: boolean;
  showEmptyCells: boolean;
  onlyAdmCells: boolean;
  showAdmBoundary: boolean; // Toujours afficher la délimitation ADM
}

export interface AtlasExportCallbacks {
  getAdmList: (level: 'adm1' | 'adm2' | 'adm3') => Promise<Array<{ code: string; name: string }>>;
  exportSingleMap: (admLevel: string, admName: string, thematicId: string, config: AtlasExportConfig) => Promise<Blob | null>;
  setThematicAndAdm: (thematicId: string, admLevel: string, admName: string) => Promise<void>;
  captureCurrentMap: () => Promise<Blob | null>;
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

.atlas-row {
  display: flex;
  gap: 16px;
}

.atlas-row-3 {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
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
  min-height: 80px;
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
      quality: 'print',
      includeStats: true,
      includeNeighbors: true,
      showEmptyCells: false,
      onlyAdmCells: true,
      showAdmBoundary: true
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
        fetch('http://localhost:8000/adm1'),
        fetch('http://localhost:8000/adm2'),
        fetch('http://localhost:8000/adm3'),
        fetch('http://localhost:8000/coverage/mailles')
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
            <div class="atlas-row-3">
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
                  <option value="print" selected>Impression (150 DPI)</option>
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
   * Rendu des thématiques en accordéon
   */
  private renderThematicsAccordion(): string {
    const items = THEMATIC_CATEGORIES.map((cat, idx) => {
      const isOpen = idx === 0 || idx === 1 || idx === 2; // Ouvrir les 3 premiers
      const params = cat.parameters.map(p => `
        <label class="atlas-checkbox">
          <input type="checkbox" name="thematic" value="${p.id}" ${['n_sondages', 'vbs_avg', 'ip_avg'].includes(p.id) ? 'checked' : ''}>
          <span>${p.label}${p.unit ? ` (${p.unit})` : ''}</span>
        </label>
      `).join('');
      
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
        fetch(`http://localhost:8000/adm2?adm1=${encodeURIComponent(adm1)}`)
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
        fetch(`http://localhost:8000/adm3?adm2=${encodeURIComponent(adm2)}`)
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
    const quality = (this.overlay.querySelector('#atlas-quality') as HTMLSelectElement)?.value as 'web' | 'print';
    const maskMode = (this.overlay.querySelector('#atlas-mask') as HTMLSelectElement)?.value as 'none' | 'context' | 'focus' | 'clip';
    const includeStats = (this.overlay.querySelector('#atlas-stats') as HTMLInputElement)?.checked;
    const includeNeighbors = (this.overlay.querySelector('#atlas-neighbors') as HTMLInputElement)?.checked;
    const showAdmBoundary = (this.overlay.querySelector('#atlas-show-boundary') as HTMLInputElement)?.checked;
    const showEmptyCells = (this.overlay.querySelector('#atlas-show-empty-cells') as HTMLInputElement)?.checked;
    const onlyAdmCells = (this.overlay.querySelector('#atlas-only-adm-cells') as HTMLInputElement)?.checked;
    
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
      showAdmBoundary
    };
  }
  
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
    
    // Afficher la progression
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
    
    // Appeler le callback
    if (this.onExportStart) {
      this.onExportStart(config);
    }
    
    try {
      await this.runBatchExport(config);
    } catch (e) {
      console.error('[Atlas Export] Erreur:', e);
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
    
    // Confirmation
    const confirmMsg = `Vous allez générer ${totalExports} cartes:\n\n` +
      levels.map(l => `- ${l.toUpperCase()}: ${admToExport[l]?.length || 0} zones`).join('\n') +
      `\n- Thématiques: ${config.thematics.length}\n\n` +
      `Cela peut prendre plusieurs minutes. Continuer?`;
    
    if (!confirm(confirmMsg)) {
      this.updateProgress('Export annulé', 0);
      return;
    }
    
    // Préparer le ZIP
    const JSZip = (window as any).JSZip;
    let zip: any = null;
    if (JSZip) {
      zip = new JSZip();
    }
    
    // Générer les exports
    let current = 0;
    const results: Array<{ level: string; name: string; thematic: string; success: boolean; blob?: Blob }> = [];
    
    for (const level of levels) {
      const admList = admToExport[level] || [];
      
      for (const adm of admList) {
        for (const thematicId of config.thematics) {
          if (this.abortRequested) {
            this.updateProgress(`Export annulé (${current}/${totalExports} complétés)`, (current / totalExports) * 100);
            await this.finalizeExport(zip, results, current, totalExports);
            return;
          }
          
          current++;
          const percent = (current / totalExports) * 100;
          const thematicLabel = ALL_THEMATICS.find(t => t.id === thematicId)?.label || thematicId;
          this.updateProgress(
            `${current}/${totalExports} - ${level.toUpperCase()} ${adm.name} - ${thematicLabel}`,
            percent
          );
          
          // Générer l'export via callback
          let success = false;
          let blob: Blob | null = null;
          
          if (this.callbacks?.setThematicAndAdm && this.callbacks?.captureCurrentMap) {
            try {
              // Changer la thématique et l'ADM
              await this.callbacks.setThematicAndAdm(thematicId, level, adm.name);
              // Attendre le rendu (optimisé: 800ms)
              await new Promise(r => setTimeout(r, 800));
              // Capturer la carte
              blob = await this.callbacks.captureCurrentMap();
              success = blob !== null;
              
              // Ajouter au ZIP
              if (zip && blob) {
                const filename = this.sanitizeFilename(`${level}/${thematicId}/${adm.name}_${thematicId}.png`);
                zip.file(filename, blob);
              }
            } catch (e) {
              console.warn(`[Atlas] Erreur export ${level}/${adm.name}/${thematicId}:`, e);
            }
          } else if (this.callbacks?.exportSingleMap) {
            try {
              blob = await this.callbacks.exportSingleMap(level, adm.name, thematicId, config);
              success = blob !== null;
              
              if (zip && blob) {
                const filename = this.sanitizeFilename(`${level}/${thematicId}/${adm.name}_${thematicId}.png`);
                zip.file(filename, blob);
              }
            } catch (e) {
              console.warn(`[Atlas] Erreur export ${level}/${adm.name}/${thematicId}:`, e);
            }
          } else {
            // Simulation - pause pour montrer la progression
            await new Promise(r => setTimeout(r, 50));
            success = true;
          }
          
          results.push({ level, name: adm.name, thematic: thematicId, success, blob: blob || undefined });
        }
      }
    }
    
    // Finaliser et télécharger le ZIP
    this.updateProgress('Création du fichier ZIP...', 99);
    await this.finalizeExport(zip, results, current, totalExports);
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
    total: number
  ): Promise<void> {
    const successful = results.filter(r => r.success).length;
    const failed = results.filter(r => !r.success).length;
    
    // Générer le ZIP si disponible et des exports ont réussi
    if (zip && successful > 0) {
      try {
        // Ajouter un fichier index.json avec les métadonnées
        const indexData = {
          generated: new Date().toISOString(),
          version: '3.3.0',
          total: total,
          completed: completed,
          successful: successful,
          failed: failed,
          exports: results.map(r => ({
            level: r.level,
            name: r.name,
            thematic: r.thematic,
            success: r.success,
            filename: r.success ? this.sanitizeFilename(`${r.level}/${r.thematic}/${r.name}_${r.thematic}.png`) : null
          }))
        };
        zip.file('index.json', JSON.stringify(indexData, null, 2));
        
        // Générer et télécharger le ZIP
        const zipBlob = await zip.generateAsync({ type: 'blob' });
        const timestamp = new Date().toISOString().slice(0, 10);
        const filename = `atlas_geotechnique_${timestamp}.zip`;
        
        const url = URL.createObjectURL(zipBlob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        this.updateProgress('Export terminé!', 100);
        this.showResults(results, completed, total, true);
        return;
      } catch (e) {
        console.error('[Atlas] Erreur génération ZIP:', e);
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
