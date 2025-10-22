/**
 * Wizard d'import géotechnique XLSX multi-feuilles
 * Format simplifié pour import rapide
 */

import { importGeotechnicalXlsx, GeotechnicalImportResponse } from './services/geotechnical-import-api';

export class GeotechnicalImportWizard {
  private container: HTMLElement;
  private file: File | null = null;
  private geolocMode: string = 'centroid';
  private onComplete: (result: GeotechnicalImportResponse) => void;

  constructor(containerId: string, onComplete: (result: GeotechnicalImportResponse) => void) {
    const el = document.getElementById(containerId);
    if (!el) throw new Error(`Container #${containerId} not found`);
    
    this.container = el;
    this.onComplete = onComplete;
    this.render();
  }

  private render() {
    this.container.innerHTML = `
      <div class="geotechnical-import-wizard">
        <div class="wizard-header">
          <h2>📊 Import Géotechnique XLSX</h2>
          <p class="subtitle">Format multi-feuilles (granulo, Atterberg, VBS, Proctor...)</p>
          <button class="btn-close" id="wizardClose">×</button>
        </div>

        <div class="wizard-content">
          <!-- Upload Section -->
          <div class="upload-section">
            <h3>1️⃣ Fichier Excel</h3>
            <div class="upload-zone" id="uploadZone">
              <div class="upload-icon">📄</div>
              <div class="upload-text">
                <strong>Glissez-déposez votre fichier XLSX ici</strong><br>
                ou cliquez pour sélectionner
              </div>
              <input type="file" id="fileInput" accept=".xlsx" style="display:none">
            </div>
            
            ${this.file ? `
              <div class="file-info">
                <div class="file-icon">✓</div>
                <div class="file-details">
                  <strong>${this.file.name}</strong><br>
                  <small>${(this.file.size / 1024).toFixed(1)} KB</small>
                </div>
                <button class="btn-sm" id="clearFile">✕</button>
              </div>
            ` : ''}
            
            <div class="template-download">
              <a href="#" id="downloadTemplate" class="btn-link">
                📥 Télécharger le template Excel d'exemple
              </a>
            </div>
          </div>

          <!-- Geolocation Mode -->
          <div class="geoloc-section">
            <h3>2️⃣ Mode de géolocalisation</h3>
            <p class="help-text">Comment positionner les sondages sans coordonnées GPS ?</p>
            
            <div class="radio-group">
              <label class="radio-option ${this.geolocMode === 'centroid' ? 'selected' : ''}">
                <input type="radio" name="geolocMode" value="centroid" ${this.geolocMode === 'centroid' ? 'checked' : ''}>
                <div class="radio-content">
                  <strong>🎯 Centroïde ADM</strong>
                  <p>Positionner au centre de la commune (recommandé)</p>
                </div>
              </label>
              
              <label class="radio-option ${this.geolocMode === 'random' ? 'selected' : ''}">
                <input type="radio" name="geolocMode" value="random" ${this.geolocMode === 'random' ? 'checked' : ''}>
                <div class="radio-content">
                  <strong>🎲 Aléatoire dans ADM</strong>
                  <p>Point aléatoire dans les limites de la commune</p>
                </div>
              </label>
              
              <label class="radio-option ${this.geolocMode === 'exact' ? 'selected' : ''}">
                <input type="radio" name="geolocMode" value="exact" ${this.geolocMode === 'exact' ? 'checked' : ''}>
                <div class="radio-content">
                  <strong>📍 Coordonnées exactes</strong>
                  <p>Utiliser lat/lon du fichier (requis dans feuille sondages)</p>
                </div>
              </label>
              
              <label class="radio-option ${this.geolocMode === 'unknown' ? 'selected' : ''}">
                <input type="radio" name="geolocMode" value="unknown" ${this.geolocMode === 'unknown' ? 'checked' : ''}>
                <div class="radio-content">
                  <strong>❓ Position inconnue</strong>
                  <p>Importer sans géolocalisation</p>
                </div>
              </label>
            </div>
          </div>

          <!-- Format Info -->
          <div class="format-info">
            <h3>ℹ️ Format attendu</h3>
            <div class="format-details">
              <div class="format-item">
                <strong>Feuilles requises :</strong>
                <ul>
                  <li><code>sondages</code> - Sites de prélèvement</li>
                  <li><code>echantillons</code> - Échantillons par profondeur</li>
                </ul>
              </div>
              <div class="format-item">
                <strong>Feuilles optionnelles :</strong>
                <ul>
                  <li><code>atterberg</code> - Limites WL/WP</li>
                  <li><code>vbs</code> - Valeur de Bleu</li>
                  <li><code>proctor</code> - Essais Proctor</li>
                  <li><code>granulo_tamisage_large</code> - Courbes granulo (format large)</li>
                  <li><code>granulo_sedimento_large</code> - Sédimentométrie (format large)</li>
                </ul>
              </div>
              <div class="format-item">
                <strong>Format granulo "large" :</strong>
                <p>Colonnes = <code>code_site@profondeur</code> (ex: <code>Sanfatoute@1.5</code>)</p>
                <p>Lignes = tamis en mm (0.08 = 80µm)</p>
              </div>
            </div>
          </div>

          <!-- Progress -->
          <div class="progress-section" id="progressSection" style="display:none">
            <div class="progress-bar">
              <div class="progress-fill" id="progressFill"></div>
            </div>
            <div class="progress-text" id="progressText">Import en cours...</div>
          </div>

          <!-- Results -->
          <div class="results-section" id="resultsSection" style="display:none"></div>
        </div>

        <div class="wizard-footer">
          <button class="btn" id="btnCancel">Annuler</button>
          <button class="btn primary" id="btnImport" ${!this.file ? 'disabled' : ''}>
            🚀 Lancer l'import
          </button>
        </div>
      </div>
    `;

    this.attachEventListeners();
  }

  private attachEventListeners() {
    // Close
    const btnClose = document.getElementById('wizardClose');
    btnClose?.addEventListener('click', () => this.close());

    const btnCancel = document.getElementById('btnCancel');
    btnCancel?.addEventListener('click', () => this.close());

    // File upload
    const uploadZone = document.getElementById('uploadZone');
    const fileInput = document.getElementById('fileInput') as HTMLInputElement;

    uploadZone?.addEventListener('click', () => fileInput?.click());

    uploadZone?.addEventListener('dragover', (e) => {
      e.preventDefault();
      uploadZone.classList.add('dragover');
    });

    uploadZone?.addEventListener('dragleave', () => {
      uploadZone.classList.remove('dragover');
    });

    uploadZone?.addEventListener('drop', (e) => {
      e.preventDefault();
      uploadZone.classList.remove('dragover');
      const files = e.dataTransfer?.files;
      if (files && files.length > 0) {
        this.handleFileSelect(files[0]);
      }
    });

    fileInput?.addEventListener('change', (e) => {
      const target = e.target as HTMLInputElement;
      if (target.files && target.files.length > 0) {
        this.handleFileSelect(target.files[0]);
      }
    });

    // Clear file
    const btnClear = document.getElementById('clearFile');
    btnClear?.addEventListener('click', (e) => {
      e.stopPropagation();
      this.file = null;
      this.render();
    });

    // Download template
    const btnTemplate = document.getElementById('downloadTemplate');
    btnTemplate?.addEventListener('click', (e) => {
      e.preventDefault();
      this.downloadTemplate();
    });

    // Geoloc mode
    const radioButtons = document.querySelectorAll('input[name="geolocMode"]');
    radioButtons.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        this.geolocMode = target.value;
        this.render();
      });
    });

    // Import button
    const btnImport = document.getElementById('btnImport');
    btnImport?.addEventListener('click', () => this.startImport());
  }

  private handleFileSelect(file: File) {
    if (!file.name.endsWith('.xlsx')) {
      alert('Veuillez sélectionner un fichier .xlsx');
      return;
    }
    this.file = file;
    this.render();
  }

  private downloadTemplate() {
    // Créer un lien vers le script Python ou le fichier généré
    alert('Exécutez le script: python make_atlas_example_xlsx.py\nPuis ouvrez atlas_import_example.xlsx');
  }

  private async startImport() {
    if (!this.file) return;

    const progressSection = document.getElementById('progressSection');
    const resultsSection = document.getElementById('resultsSection');
    const btnImport = document.getElementById('btnImport') as HTMLButtonElement;

    progressSection!.style.display = 'block';
    resultsSection!.style.display = 'none';
    btnImport.disabled = true;

    try {
      const result = await importGeotechnicalXlsx({
        file: this.file,
        geolocation_mode: this.geolocMode as any,
      });

      this.showResults(result);
      this.onComplete(result);
    } catch (error) {
      this.showError(error as Error);
    } finally {
      progressSection!.style.display = 'none';
      btnImport.disabled = false;
    }
  }

  private showResults(result: GeotechnicalImportResponse) {
    const resultsSection = document.getElementById('resultsSection');
    if (!resultsSection) return;

    const stats = result.stats;
    const hasErrors = stats.errors.length > 0;
    const hasWarnings = stats.warnings.length > 0;

    resultsSection.innerHTML = `
      <div class="results ${hasErrors ? 'has-errors' : 'success'}">
        <div class="results-header">
          <div class="results-icon">${hasErrors ? '⚠️' : '✅'}</div>
          <h3>${result.message}</h3>
        </div>

        <div class="stats-grid">
          <div class="stat-card">
            <div class="stat-value">${stats.sondages_created + stats.sondages_updated}</div>
            <div class="stat-label">Sondages</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.echantillons_created}</div>
            <div class="stat-label">Échantillons</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.atterberg_created}</div>
            <div class="stat-label">Atterberg</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.vbs_created}</div>
            <div class="stat-label">VBS</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.proctor_created}</div>
            <div class="stat-label">Proctor</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${stats.granulo_points_created}</div>
            <div class="stat-label">Points granulo</div>
          </div>
        </div>

        ${hasWarnings ? `
          <div class="warnings-section">
            <h4>⚠️ Avertissements (${stats.warnings.length})</h4>
            <ul>
              ${stats.warnings.slice(0, 10).map(w => `<li>${w}</li>`).join('')}
              ${stats.warnings.length > 10 ? `<li>... et ${stats.warnings.length - 10} autres</li>` : ''}
            </ul>
          </div>
        ` : ''}

        ${hasErrors ? `
          <div class="errors-section">
            <h4>❌ Erreurs (${stats.errors.length})</h4>
            <ul>
              ${stats.errors.slice(0, 10).map(e => `<li>${e}</li>`).join('')}
              ${stats.errors.length > 10 ? `<li>... et ${stats.errors.length - 10} autres</li>` : ''}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    resultsSection.style.display = 'block';
  }

  private showError(error: Error) {
    const resultsSection = document.getElementById('resultsSection');
    if (!resultsSection) return;

    resultsSection.innerHTML = `
      <div class="results has-errors">
        <div class="results-header">
          <div class="results-icon">❌</div>
          <h3>Erreur d'import</h3>
        </div>
        <div class="error-message">
          <p>${error.message}</p>
        </div>
      </div>
    `;

    resultsSection.style.display = 'block';
  }

  private close() {
    this.container.innerHTML = '';
  }
}
