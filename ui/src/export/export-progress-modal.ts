/**
 * Export Progress Modal - Modal de progression verbose pour l'export Atlas
 * 
 * Affiche un terminal-like avec logs détaillés de chaque étape d'export.
 * Utile pour les développeurs et audits.
 * 
 * @version 3.5.0
 */

export interface ExportLogEntry {
  timestamp: Date;
  level: 'info' | 'success' | 'warning' | 'error' | 'debug' | 'step';
  category: string;
  message: string;
  data?: Record<string, any>;
}

export interface ExportProgressState {
  phase: 'idle' | 'preparing' | 'exporting' | 'finalizing' | 'complete' | 'error';
  totalMaps: number;
  completedMaps: number;
  currentAdm: string;
  currentThematic: string;
  currentStep: string;
  startTime: Date | null;
  errors: string[];
  warnings: string[];
}

export class ExportProgressModal {
  private overlay: HTMLElement | null = null;
  private logContainer: HTMLElement | null = null;
  private logs: ExportLogEntry[] = [];
  private state: ExportProgressState = {
    phase: 'idle',
    totalMaps: 0,
    completedMaps: 0,
    currentAdm: '',
    currentThematic: '',
    currentStep: '',
    startTime: null,
    errors: [],
    warnings: []
  };
  private autoScroll: boolean = true;
  private onClose?: () => void;

  constructor() {
    this.injectStyles();
  }

  /**
   * Ouvre le modal de progression
   */
  public open(totalMaps: number, onClose?: () => void): void {
    this.onClose = onClose;
    this.logs = [];
    this.state = {
      phase: 'preparing',
      totalMaps,
      completedMaps: 0,
      currentAdm: '',
      currentThematic: '',
      currentStep: 'Initialisation...',
      startTime: new Date(),
      errors: [],
      warnings: []
    };

    this.render();
    this.log('info', 'SYSTEM', `Export Atlas démarré - ${totalMaps} cartes à générer`);
    this.log('debug', 'SYSTEM', `Timestamp: ${this.state.startTime?.toISOString()}`);
  }

  /**
   * Ferme le modal
   */
  public close(): void {
    if (this.overlay) {
      this.overlay.remove();
      this.overlay = null;
      this.logContainer = null;
    }
    if (this.onClose) {
      this.onClose();
    }
  }

  /**
   * Ajoute une entrée de log
   */
  public log(
    level: ExportLogEntry['level'],
    category: string,
    message: string,
    data?: Record<string, any>
  ): void {
    const entry: ExportLogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data
    };
    this.logs.push(entry);
    this.appendLogEntry(entry);

    if (level === 'error') {
      this.state.errors.push(message);
    } else if (level === 'warning') {
      this.state.warnings.push(message);
    }
  }

  /**
   * Met à jour la progression
   */
  public updateProgress(
    completedMaps: number,
    currentAdm: string,
    currentThematic: string,
    currentStep: string
  ): void {
    this.state.completedMaps = completedMaps;
    this.state.currentAdm = currentAdm;
    this.state.currentThematic = currentThematic;
    this.state.currentStep = currentStep;
    this.updateProgressUI();
  }

  /**
   * Marque le début d'une nouvelle carte
   */
  public startMap(admLevel: string, admName: string, thematicId: string, mapIndex: number): void {
    this.log('step', 'MAP', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.log('step', 'MAP', `📍 Carte ${mapIndex + 1}/${this.state.totalMaps}: ${admName} (${admLevel}) - ${thematicId}`);
    this.state.currentAdm = admName;
    this.state.currentThematic = thematicId;
  }

  /**
   * Marque la fin d'une carte (succès)
   */
  public endMapSuccess(admName: string, thematicId: string, durationMs: number, sizeBytes: number): void {
    const sizeMB = (sizeBytes / 1024 / 1024).toFixed(2);
    this.log('success', 'MAP', `✅ ${admName}/${thematicId} - ${durationMs}ms - ${sizeMB} Mo`);
    this.state.completedMaps++;
    this.updateProgressUI();
  }

  /**
   * Marque la fin d'une carte (échec)
   */
  public endMapError(admName: string, thematicId: string, error: string): void {
    this.log('error', 'MAP', `❌ ${admName}/${thematicId} - ERREUR: ${error}`);
    this.state.completedMaps++;
    this.updateProgressUI();
  }

  /**
   * Log d'une étape spécifique de l'export
   */
  public logStep(step: string, details?: Record<string, any>): void {
    this.state.currentStep = step;
    this.log('info', 'STEP', `  → ${step}`, details);
    this.updateProgressUI();
  }

  /**
   * Marque la phase de finalisation
   */
  public startFinalization(): void {
    this.state.phase = 'finalizing';
    this.log('step', 'FINAL', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.log('info', 'FINAL', '📦 Finalisation de l\'export...');
    this.updateProgressUI();
  }

  /**
   * Marque l'export comme terminé
   */
  public complete(zipSizeMB: number): void {
    this.state.phase = 'complete';
    const duration = this.state.startTime 
      ? Math.round((Date.now() - this.state.startTime.getTime()) / 1000)
      : 0;
    
    this.log('step', 'DONE', `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    this.log('success', 'DONE', `🎉 EXPORT TERMINÉ`);
    this.log('info', 'STATS', `  📊 Cartes générées: ${this.state.completedMaps}/${this.state.totalMaps}`);
    this.log('info', 'STATS', `  ⏱️ Durée totale: ${duration}s`);
    this.log('info', 'STATS', `  📦 Taille ZIP: ${zipSizeMB.toFixed(2)} Mo`);
    
    if (this.state.errors.length > 0) {
      this.log('warning', 'STATS', `  ⚠️ Erreurs: ${this.state.errors.length}`);
    }
    if (this.state.warnings.length > 0) {
      this.log('warning', 'STATS', `  ⚠️ Avertissements: ${this.state.warnings.length}`);
    }

    this.updateProgressUI();
    this.showCloseButton();
  }

  /**
   * Marque l'export comme échoué
   */
  public fail(error: string): void {
    this.state.phase = 'error';
    this.log('error', 'FATAL', `💥 EXPORT ÉCHOUÉ: ${error}`);
    this.updateProgressUI();
    this.showCloseButton();
  }

  // ============================================================================
  // Méthodes privées
  // ============================================================================

  private render(): void {
    // Supprimer l'ancien overlay s'il existe
    if (this.overlay) {
      this.overlay.remove();
    }

    this.overlay = document.createElement('div');
    this.overlay.className = 'export-progress-overlay';
    this.overlay.innerHTML = `
      <div class="export-progress-modal">
        <div class="export-progress-header">
          <div class="export-progress-title">
            <span class="terminal-icon">⬛</span>
            Export Atlas - Console
          </div>
          <div class="export-progress-controls">
            <label class="auto-scroll-toggle">
              <input type="checkbox" id="auto-scroll" checked>
              <span>Auto-scroll</span>
            </label>
            <button class="btn-copy" title="Copier les logs">📋</button>
            <button class="btn-close" title="Fermer" style="display: none;">✕</button>
          </div>
        </div>
        
        <div class="export-progress-status">
          <div class="status-bar">
            <div class="status-phase" id="status-phase">⏳ Préparation...</div>
            <div class="status-progress" id="status-progress">0/${this.state.totalMaps}</div>
          </div>
          <div class="progress-bar-container">
            <div class="progress-bar-fill" id="progress-bar-fill" style="width: 0%"></div>
          </div>
          <div class="status-current" id="status-current">
            <span class="current-adm"></span>
            <span class="current-thematic"></span>
            <span class="current-step"></span>
          </div>
        </div>
        
        <div class="export-progress-terminal" id="log-container">
          <div class="terminal-welcome">
            ╔══════════════════════════════════════════════════════════════╗
            ║           ATLAS GÉOTECHNIQUE - EXPORT CONSOLE                ║
            ║                     Version 3.5.0                            ║
            ╚══════════════════════════════════════════════════════════════╝
          </div>
        </div>
        
        <div class="export-progress-footer">
          <div class="footer-stats">
            <span class="stat-errors" id="stat-errors">❌ 0 erreurs</span>
            <span class="stat-warnings" id="stat-warnings">⚠️ 0 avertissements</span>
          </div>
          <div class="footer-time" id="footer-time">00:00</div>
        </div>
      </div>
    `;

    document.body.appendChild(this.overlay);
    this.logContainer = this.overlay.querySelector('#log-container');

    // Event listeners
    const autoScrollCheckbox = this.overlay.querySelector('#auto-scroll') as HTMLInputElement;
    autoScrollCheckbox?.addEventListener('change', () => {
      this.autoScroll = autoScrollCheckbox.checked;
    });

    const copyBtn = this.overlay.querySelector('.btn-copy');
    copyBtn?.addEventListener('click', () => this.copyLogs());

    const closeBtn = this.overlay.querySelector('.btn-close');
    closeBtn?.addEventListener('click', () => this.close());

    // Timer update
    this.startTimer();
  }

  private appendLogEntry(entry: ExportLogEntry): void {
    if (!this.logContainer) return;

    const line = document.createElement('div');
    line.className = `log-line log-${entry.level}`;
    
    const time = entry.timestamp.toLocaleTimeString('fr-FR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit'
    }) + '.' + entry.timestamp.getMilliseconds().toString().padStart(3, '0');

    const levelIcon = {
      'info': 'ℹ️',
      'success': '✅',
      'warning': '⚠️',
      'error': '❌',
      'debug': '🔧',
      'step': '📌'
    }[entry.level];

    line.innerHTML = `
      <span class="log-time">${time}</span>
      <span class="log-level">${levelIcon}</span>
      <span class="log-category">[${entry.category}]</span>
      <span class="log-message">${this.escapeHtml(entry.message)}</span>
      ${entry.data ? `<span class="log-data">${JSON.stringify(entry.data)}</span>` : ''}
    `;

    this.logContainer.appendChild(line);

    if (this.autoScroll) {
      this.logContainer.scrollTop = this.logContainer.scrollHeight;
    }
  }

  private updateProgressUI(): void {
    if (!this.overlay) return;

    const phaseEl = this.overlay.querySelector('#status-phase');
    const progressEl = this.overlay.querySelector('#status-progress');
    const progressBar = this.overlay.querySelector('#progress-bar-fill') as HTMLElement;
    const currentEl = this.overlay.querySelector('#status-current');
    const errorsEl = this.overlay.querySelector('#stat-errors');
    const warningsEl = this.overlay.querySelector('#stat-warnings');

    const phaseText = {
      'idle': '⏸️ En attente',
      'preparing': '⏳ Préparation...',
      'exporting': '🖼️ Export en cours...',
      'finalizing': '📦 Finalisation...',
      'complete': '✅ Terminé',
      'error': '❌ Erreur'
    }[this.state.phase];

    if (phaseEl) phaseEl.textContent = phaseText;
    if (progressEl) progressEl.textContent = `${this.state.completedMaps}/${this.state.totalMaps}`;
    
    const percent = this.state.totalMaps > 0 
      ? (this.state.completedMaps / this.state.totalMaps) * 100 
      : 0;
    if (progressBar) progressBar.style.width = `${percent}%`;

    if (currentEl) {
      currentEl.innerHTML = `
        <span class="current-adm">${this.state.currentAdm ? `📍 ${this.state.currentAdm}` : ''}</span>
        <span class="current-thematic">${this.state.currentThematic ? `📊 ${this.state.currentThematic}` : ''}</span>
        <span class="current-step">${this.state.currentStep}</span>
      `;
    }

    if (errorsEl) {
      errorsEl.textContent = `❌ ${this.state.errors.length} erreur${this.state.errors.length > 1 ? 's' : ''}`;
      errorsEl.classList.toggle('has-errors', this.state.errors.length > 0);
    }
    if (warningsEl) {
      warningsEl.textContent = `⚠️ ${this.state.warnings.length} avertissement${this.state.warnings.length > 1 ? 's' : ''}`;
      warningsEl.classList.toggle('has-warnings', this.state.warnings.length > 0);
    }
  }

  private showCloseButton(): void {
    if (!this.overlay) return;
    const closeBtn = this.overlay.querySelector('.btn-close') as HTMLElement;
    if (closeBtn) closeBtn.style.display = 'block';
  }

  private startTimer(): void {
    const timerEl = this.overlay?.querySelector('#footer-time');
    if (!timerEl || !this.state.startTime) return;

    const updateTimer = () => {
      if (!this.state.startTime || !this.overlay) return;
      const elapsed = Math.floor((Date.now() - this.state.startTime.getTime()) / 1000);
      const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
      const seconds = (elapsed % 60).toString().padStart(2, '0');
      timerEl.textContent = `${minutes}:${seconds}`;
      
      if (this.state.phase !== 'complete' && this.state.phase !== 'error') {
        requestAnimationFrame(updateTimer);
      }
    };
    updateTimer();
  }

  private copyLogs(): void {
    const logText = this.logs.map(entry => {
      const time = entry.timestamp.toISOString();
      return `[${time}] [${entry.level.toUpperCase()}] [${entry.category}] ${entry.message}${entry.data ? ' ' + JSON.stringify(entry.data) : ''}`;
    }).join('\n');

    navigator.clipboard.writeText(logText).then(() => {
      this.log('info', 'SYSTEM', '📋 Logs copiés dans le presse-papiers');
    }).catch(err => {
      this.log('error', 'SYSTEM', `Erreur copie: ${err.message}`);
    });
  }

  private escapeHtml(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  private injectStyles(): void {
    if (document.getElementById('export-progress-modal-styles')) return;

    const style = document.createElement('style');
    style.id = 'export-progress-modal-styles';
    style.textContent = `
      .export-progress-overlay {
        position: fixed;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(0, 0, 0, 0.85);
        z-index: 10001;
        display: flex;
        align-items: center;
        justify-content: center;
        backdrop-filter: blur(4px);
      }

      .export-progress-modal {
        width: 90%;
        max-width: 900px;
        height: 80vh;
        max-height: 700px;
        background: #1e1e1e;
        border-radius: 8px;
        display: flex;
        flex-direction: column;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
        border: 1px solid #333;
        overflow: hidden;
      }

      .export-progress-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px 16px;
        background: #2d2d2d;
        border-bottom: 1px solid #404040;
      }

      .export-progress-title {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 14px;
        font-weight: 600;
        color: #e0e0e0;
        display: flex;
        align-items: center;
        gap: 8px;
      }

      .terminal-icon {
        font-size: 12px;
      }

      .export-progress-controls {
        display: flex;
        align-items: center;
        gap: 12px;
      }

      .auto-scroll-toggle {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 12px;
        color: #888;
        cursor: pointer;
      }

      .auto-scroll-toggle input {
        cursor: pointer;
      }

      .btn-copy, .btn-close {
        background: transparent;
        border: 1px solid #555;
        color: #888;
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 12px;
        transition: all 0.2s;
      }

      .btn-copy:hover, .btn-close:hover {
        background: #404040;
        color: #fff;
        border-color: #666;
      }

      .export-progress-status {
        padding: 12px 16px;
        background: #252525;
        border-bottom: 1px solid #333;
      }

      .status-bar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 8px;
      }

      .status-phase {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        color: #4fc3f7;
      }

      .status-progress {
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 13px;
        color: #81c784;
        font-weight: 600;
      }

      .progress-bar-container {
        height: 6px;
        background: #333;
        border-radius: 3px;
        overflow: hidden;
        margin-bottom: 8px;
      }

      .progress-bar-fill {
        height: 100%;
        background: linear-gradient(90deg, #4fc3f7, #81c784);
        transition: width 0.3s ease;
      }

      .status-current {
        display: flex;
        gap: 16px;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 11px;
        color: #888;
      }

      .current-adm { color: #ffb74d; }
      .current-thematic { color: #ba68c8; }
      .current-step { color: #90a4ae; }

      .export-progress-terminal {
        flex: 1;
        overflow-y: auto;
        padding: 12px 16px;
        font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
        font-size: 12px;
        line-height: 1.6;
        background: #1a1a1a;
      }

      .terminal-welcome {
        color: #4fc3f7;
        white-space: pre;
        margin-bottom: 12px;
        font-size: 11px;
      }

      .log-line {
        display: flex;
        gap: 8px;
        padding: 2px 0;
        border-bottom: 1px solid #252525;
      }

      .log-time {
        color: #666;
        min-width: 100px;
      }

      .log-level {
        min-width: 20px;
      }

      .log-category {
        color: #888;
        min-width: 80px;
      }

      .log-message {
        color: #e0e0e0;
        flex: 1;
        word-break: break-word;
      }

      .log-data {
        color: #666;
        font-size: 10px;
        max-width: 200px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .log-info .log-message { color: #e0e0e0; }
      .log-success .log-message { color: #81c784; }
      .log-warning .log-message { color: #ffb74d; }
      .log-error .log-message { color: #e57373; }
      .log-debug .log-message { color: #90a4ae; }
      .log-step .log-message { color: #4fc3f7; font-weight: 600; }

      .export-progress-footer {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 10px 16px;
        background: #2d2d2d;
        border-top: 1px solid #404040;
        font-family: 'Consolas', 'Monaco', monospace;
        font-size: 11px;
      }

      .footer-stats {
        display: flex;
        gap: 16px;
      }

      .stat-errors { color: #888; }
      .stat-errors.has-errors { color: #e57373; }
      .stat-warnings { color: #888; }
      .stat-warnings.has-warnings { color: #ffb74d; }

      .footer-time {
        color: #4fc3f7;
        font-weight: 600;
      }

      /* Scrollbar styling */
      .export-progress-terminal::-webkit-scrollbar {
        width: 8px;
      }
      .export-progress-terminal::-webkit-scrollbar-track {
        background: #1a1a1a;
      }
      .export-progress-terminal::-webkit-scrollbar-thumb {
        background: #444;
        border-radius: 4px;
      }
      .export-progress-terminal::-webkit-scrollbar-thumb:hover {
        background: #555;
      }
    `;
    document.head.appendChild(style);
  }
}

// Singleton instance
let progressModalInstance: ExportProgressModal | null = null;

export function getExportProgressModal(): ExportProgressModal {
  if (!progressModalInstance) {
    progressModalInstance = new ExportProgressModal();
  }
  return progressModalInstance;
}
