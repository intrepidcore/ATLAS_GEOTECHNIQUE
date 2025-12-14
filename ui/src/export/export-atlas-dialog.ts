/**
 * Dialogue d'export Atlas complet (batch)
 * Atlas Géotechnique v3.0.5
 * 
 * Permet d'exporter automatiquement toutes les cartes thématiques
 * pour tous les ADM sélectionnés en un seul clic.
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
  thematics: string[];
  maskMode: 'none' | 'context' | 'focus';
  format: 'png' | 'pdf';
  quality: 'web' | 'print';
  includeStats: boolean;
  includeNeighbors: boolean;
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
  width: 500px;
  max-height: 80vh;
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
}

.atlas-checkbox input {
  width: 16px;
  height: 16px;
}

.atlas-row {
  display: flex;
  gap: 16px;
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
`;

// ============================================================================
// Thématiques disponibles
// ============================================================================

const AVAILABLE_THEMATICS = [
  { id: 'n_sondages', label: 'Nombre de sondages' },
  { id: 'vbs_moy', label: 'VBS moyen (argilosité)' },
  { id: 'ip_moy', label: 'IP moyen (plasticité)' },
  { id: 'profondeur_max', label: 'Profondeur max' },
];

// ============================================================================
// Classe ExportAtlasDialog
// ============================================================================

export class ExportAtlasDialog {
  private overlay: HTMLElement | null = null;
  private config: AtlasExportConfig;
  private progress: AtlasExportProgress;
  private isExporting: boolean = false;
  private onExportStart?: (config: AtlasExportConfig) => void;
  
  constructor(onExportStart?: (config: AtlasExportConfig) => void) {
    this.onExportStart = onExportStart;
    this.config = {
      levels: { adm1: true, adm2: true, adm3: true },
      thematics: AVAILABLE_THEMATICS.map(t => t.id),
      maskMode: 'context',
      format: 'png',
      quality: 'print',
      includeStats: true,
      includeNeighbors: true
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
  
  open(): void {
    if (this.overlay) return;
    
    this.overlay = document.createElement('div');
    this.overlay.className = 'atlas-dialog-overlay';
    this.overlay.innerHTML = this.renderDialog();
    document.body.appendChild(this.overlay);
    
    this.attachEventListeners();
  }
  
  close(): void {
    if (this.isExporting) return;
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
    }
  }
  
  private renderDialog(): string {
    const thematicsHtml = AVAILABLE_THEMATICS.map(t => `
      <label class="atlas-checkbox">
        <input type="checkbox" name="thematic" value="${t.id}" checked>
        <span>${t.label}</span>
      </label>
    `).join('');
    
    return `
      <div class="atlas-dialog">
        <div class="atlas-dialog-header">
          <h3>📚 Export Atlas Complet</h3>
          <button class="atlas-dialog-close" data-action="close">&times;</button>
        </div>
        
        <div class="atlas-dialog-body">
          <div class="atlas-info">
            ℹ️ Cet export génère automatiquement toutes les cartes thématiques
            pour chaque niveau administratif sélectionné. Les fichiers seront
            téléchargés dans un dossier ZIP structuré.
          </div>
          
          <!-- Niveaux ADM -->
          <div class="atlas-section">
            <div class="atlas-section-title">🗺️ Niveaux administratifs</div>
            <div class="atlas-checkboxes">
              <label class="atlas-checkbox">
                <input type="checkbox" name="level" value="adm1" checked>
                <span>ADM1 - Régions (5)</span>
              </label>
              <label class="atlas-checkbox">
                <input type="checkbox" name="level" value="adm2" checked>
                <span>ADM2 - Préfectures (~40)</span>
              </label>
              <label class="atlas-checkbox">
                <input type="checkbox" name="level" value="adm3" checked>
                <span>ADM3 - Communes (~400)</span>
              </label>
            </div>
          </div>
          
          <!-- Thématiques -->
          <div class="atlas-section">
            <div class="atlas-section-title">📊 Thématiques</div>
            <div class="atlas-checkboxes">
              ${thematicsHtml}
            </div>
          </div>
          
          <!-- Options -->
          <div class="atlas-section">
            <div class="atlas-section-title">⚙️ Options</div>
            <div class="atlas-row">
              <div class="atlas-field">
                <label>Format</label>
                <select id="atlas-format">
                  <option value="png" selected>PNG (images)</option>
                  <option value="pdf">PDF (documents)</option>
                </select>
              </div>
              <div class="atlas-field">
                <label>Masque hors ADM</label>
                <select id="atlas-mask">
                  <option value="none">Aucun</option>
                  <option value="context" selected>Contexte (45%)</option>
                  <option value="focus">Focus (85%)</option>
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
  }
  
  private collectConfig(): AtlasExportConfig {
    if (!this.overlay) return this.config;
    
    // Niveaux
    const levels = { adm1: false, adm2: false, adm3: false };
    this.overlay.querySelectorAll('input[name="level"]:checked').forEach((cb: any) => {
      levels[cb.value as keyof typeof levels] = true;
    });
    
    // Thématiques
    const thematics: string[] = [];
    this.overlay.querySelectorAll('input[name="thematic"]:checked').forEach((cb: any) => {
      thematics.push(cb.value);
    });
    
    // Options
    const format = (this.overlay.querySelector('#atlas-format') as HTMLSelectElement)?.value as 'png' | 'pdf';
    const maskMode = (this.overlay.querySelector('#atlas-mask') as HTMLSelectElement)?.value as 'none' | 'context' | 'focus';
    const includeStats = (this.overlay.querySelector('#atlas-stats') as HTMLInputElement)?.checked;
    const includeNeighbors = (this.overlay.querySelector('#atlas-neighbors') as HTMLInputElement)?.checked;
    
    return {
      levels,
      thematics,
      maskMode,
      format,
      quality: 'print',
      includeStats,
      includeNeighbors
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
    this.config = config;
    
    // Afficher la progression
    const progressDiv = this.overlay?.querySelector('#atlas-progress') as HTMLElement;
    const exportBtn = this.overlay?.querySelector('#atlas-export-btn') as HTMLButtonElement;
    if (progressDiv) progressDiv.style.display = 'block';
    if (exportBtn) exportBtn.disabled = true;
    
    this.updateProgress('Calcul du nombre d\'exports...', 0);
    
    // Appeler le callback
    if (this.onExportStart) {
      this.onExportStart(config);
    }
    
    // Pour l'instant, afficher un message informatif
    // L'export batch complet nécessite une implémentation backend
    setTimeout(() => {
      this.updateProgress('Export Atlas en cours de développement...', 50);
      
      setTimeout(() => {
        this.isExporting = false;
        if (exportBtn) exportBtn.disabled = false;
        
        alert(
          '📚 Export Atlas Complet\n\n' +
          'Cette fonctionnalité est en cours de développement.\n\n' +
          'Configuration sélectionnée :\n' +
          `- Niveaux : ${Object.entries(config.levels).filter(([,v]) => v).map(([k]) => k.toUpperCase()).join(', ')}\n` +
          `- Thématiques : ${config.thematics.length}\n` +
          `- Format : ${config.format.toUpperCase()}\n` +
          `- Masque : ${config.maskMode}\n\n` +
          'Pour l\'instant, utilisez "Export Pro" pour exporter une carte à la fois.'
        );
        
        this.close();
      }, 1500);
    }, 1000);
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
  onExportStart?: (config: AtlasExportConfig) => void
): ExportAtlasDialog {
  return new ExportAtlasDialog(onExportStart);
}
