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
  showEmptyCells: boolean;
  onlyAdmCells: boolean;
}

export interface AtlasExportCallbacks {
  getAdmList: (level: 'adm1' | 'adm2' | 'adm3') => Promise<Array<{ code: string; name: string }>>;
  exportSingleMap: (admLevel: string, admName: string, thematicId: string, config: AtlasExportConfig) => Promise<Blob | null>;
  // Callback pour changer la thématique et le filtre ADM sur la carte
  setThematicAndAdm: (thematicId: string, admLevel: string, admName: string) => Promise<void>;
  // Callback pour capturer la carte actuelle
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
  { id: 'vbs_avg', label: 'VBS moyen (argilosité)' },
  { id: 'ip_avg', label: 'IP moyen (plasticité)' },
  { id: 'wl_avg', label: 'Limite de liquidité (WL)' },
  { id: 'wp_avg', label: 'Limite de plasticité (WP)' },
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
  private callbacks?: AtlasExportCallbacks;
  private onExportStart?: (config: AtlasExportConfig) => void;
  private abortRequested: boolean = false;
  
  constructor(onExportStart?: (config: AtlasExportConfig) => void, callbacks?: AtlasExportCallbacks) {
    this.onExportStart = onExportStart;
    this.callbacks = callbacks;
    this.config = {
      levels: { adm1: true, adm2: true, adm3: true },
      thematics: AVAILABLE_THEMATICS.map(t => t.id),
      maskMode: 'context',
      format: 'png',
      quality: 'print',
      includeStats: true,
      includeNeighbors: true,
      showEmptyCells: false,
      onlyAdmCells: true
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
    const showEmptyCells = (this.overlay.querySelector('#atlas-show-empty-cells') as HTMLInputElement)?.checked;
    const onlyAdmCells = (this.overlay.querySelector('#atlas-only-adm-cells') as HTMLInputElement)?.checked;
    
    return {
      levels,
      thematics,
      maskMode,
      format,
      quality: 'print',
      includeStats,
      includeNeighbors,
      showEmptyCells,
      onlyAdmCells
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
        closeBtn.textContent = '×';
        closeBtn.onclick = () => this.close();
      }
    }
  }
  
  /**
   * Exécute l'export batch séquentiel
   */
  private async runBatchExport(config: AtlasExportConfig): Promise<void> {
    // Calculer le nombre total d'exports
    const levels: Array<'adm1' | 'adm2' | 'adm3'> = [];
    if (config.levels.adm1) levels.push('adm1');
    if (config.levels.adm2) levels.push('adm2');
    if (config.levels.adm3) levels.push('adm3');
    
    // Récupérer les listes ADM
    this.updateProgress('Récupération des zones administratives...', 5);
    
    const admLists: Record<string, Array<{ code: string; name: string }>> = {};
    
    for (const level of levels) {
      if (this.abortRequested) {
        this.updateProgress('Export annulé', 0);
        return;
      }
      
      try {
        const response = await fetch(`http://localhost:8000/${level}`);
        if (response.ok) {
          const allAdms = await response.json();
          // Filtrer les ADM qui ont au moins une maille avec données
          const admsWithData = await this.filterAdmsWithData(allAdms, level);
          admLists[level] = admsWithData;
          console.log(`[Atlas] ${level}: ${admsWithData.length}/${allAdms.length} ADM avec données`);
        } else {
          admLists[level] = [];
        }
      } catch (e) {
        console.warn(`[Atlas] Impossible de charger ${level}:`, e);
        admLists[level] = [];
      }
    }
    
    // Calculer le total
    let totalExports = 0;
    for (const level of levels) {
      totalExports += (admLists[level]?.length || 0) * config.thematics.length;
    }
    
    if (totalExports === 0) {
      alert('Aucune zone administrative trouvée pour les niveaux sélectionnés.');
      return;
    }
    
    // Confirmation
    const confirmMsg = `Vous allez générer ${totalExports} cartes:\n\n` +
      levels.map(l => `- ${l.toUpperCase()}: ${admLists[l]?.length || 0} zones`).join('\n') +
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
      const admList = admLists[level] || [];
      
      for (const adm of admList) {
        for (const thematicId of config.thematics) {
          if (this.abortRequested) {
            this.updateProgress(`Export annulé (${current}/${totalExports} complétés)`, (current / totalExports) * 100);
            await this.finalizeExport(zip, results, current, totalExports);
            return;
          }
          
          current++;
          const percent = (current / totalExports) * 100;
          const thematicLabel = AVAILABLE_THEMATICS.find(t => t.id === thematicId)?.label || thematicId;
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
              // Attendre le rendu (optimisé: 800ms au lieu de 1500ms)
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
  
  /**
   * Sanitize filename for ZIP
   */
  private sanitizeFilename(name: string): string {
    return name
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_\-\/\.]/g, '_')
      .replace(/_+/g, '_');
  }
  
  /**
   * Finalise l'export et télécharge le ZIP
   */
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
          version: '3.0.5',
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
  
  /**
   * Affiche les résultats de l'export
   */
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
   * Filtre les ADM qui ont au moins une maille avec données
   */
  private async filterAdmsWithData(
    adms: Array<{ code: string; name: string }>,
    level: string
  ): Promise<Array<{ code: string; name: string }>> {
    try {
      // Récupérer les mailles avec données
      const response = await fetch('http://localhost:8000/coverage/mailles');
      if (!response.ok) return adms; // En cas d'erreur, retourner tous les ADM
      
      const geojson = await response.json();
      const features = geojson.features || [];
      
      // Créer un Set des ADM qui ont des mailles avec données
      const admsWithData = new Set<string>();
      
      for (const f of features) {
        const props = f.properties || {};
        const hasData = props.has_data || props.n_sondages > 0;
        if (!hasData) continue;
        
        // Ajouter les noms ADM correspondants
        if (level === 'adm1' && props.adm1_name) {
          admsWithData.add(props.adm1_name);
        } else if (level === 'adm2' && props.adm2_name) {
          admsWithData.add(props.adm2_name);
        } else if (level === 'adm3' && props.adm3_name) {
          admsWithData.add(props.adm3_name);
        }
      }
      
      // Filtrer les ADM
      return adms.filter(adm => admsWithData.has(adm.name));
    } catch (e) {
      console.warn('[Atlas] Erreur filtrage ADM avec données:', e);
      return adms; // En cas d'erreur, retourner tous les ADM
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
