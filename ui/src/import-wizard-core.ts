/**
 * @deprecated Ce fichier est EXPÉRIMENTAL et contient du code corrompu.
 * Utilisez import-wizard-v2.ts comme wizard canonique.
 * 
 * Import Wizard Core - Version réutilisable avec modes modal et embedded
 * STATUS: DEPRECATED - Ne pas utiliser en production
 */

interface ImportSession {
  id: string
  batch_id: string
  status: string
  upload_url: string
}

interface PreviewStats {
  total_rows: number
  to_create: number
  to_update: number
  to_skip: number
  errors: number
  warnings: number
}

interface ValidationError {
  row: number
  column: string | null
  code: string
  message: string
  severity: 'error' | 'warning'
  value: any
  hint: string | null
}

interface ValidationErrors {
  errors: ValidationError[]
}

export type WizardMode = 'modal' | 'embedded'

export class ImportWizardCore {
  private container: HTMLElement
  private apiUrl: string
  private mode: WizardMode
  private currentStep: number = 1
  private session: ImportSession | null = null
  private file: File | null = null
  private mapping: Record<string, string> = {}
  private geometryConfig: any = {}
  private previewData: any = null
  private onClose?: () => void

  constructor(containerId: string, apiUrl: string, mode: WizardMode = 'modal', onClose?: () => void) {
    const el = document.getElementById(containerId)
    if (!el) throw new Error(`Container ${containerId} not found`)
    this.container = el
    this.apiUrl = apiUrl
    this.mode = mode
    this.onClose = onClose
  }

  public open() {
    console.log(`[WIZARD CORE] Ouverture Import Wizard en mode ${this.mode}`)
    this.currentStep = 1
    this.render()
    if (this.mode === 'modal') {
      this.container.style.display = 'block'
    }
  }

  public close() {
    if (this.mode === 'modal') {
      this.container.style.display = 'none'
    } else {
      // En mode embedded, on vide juste le contenu
      this.container.innerHTML = ''
    }
    this.reset()
    if (this.onClose) {
      this.onClose()
    }
  }

  private reset() {
    this.currentStep = 1
    this.session = null
    this.file = null
    this.mapping = {}
    this.geometryConfig = {}
    this.previewData = null
  }

  private render() {
    if (this.mode === 'modal') {
      this.renderModal()
    } else {
      this.renderEmbedded()
    }
    this.attachEventListeners()
  }

  private renderModal() {
    this.container.innerHTML = `
      <div class="wizard-overlay">
        <div class="wizard-modal">
          <div class="wizard-header">
            <h2>📥 Import Wizard - Étape ${this.currentStep}/5</h2>
            <button class="wizard-close" id="wizardClose">×</button>
          </div>
          
          <div class="wizard-progress">
            ${this.renderProgress()}
          </div>
          
          <div class="wizard-content">
            ${this.renderStep()}
          </div>
          
          <div class="wizard-footer">
            ${this.renderFooter()}
          </div>
        </div>
      </div>
    `
  }

  private renderEmbedded() {
    this.container.innerHTML = `
      <div class="wizard-embedded">
        <div class="wizard-header-embedded">
          <h3>📥 Import de sondages géotechniques - Étape ${this.currentStep}/5</h3>
          <p class="wizard-subtitle">Importez vos sondages depuis Excel ou CSV avec validation automatique</p>
        </div>
        
        <div class="wizard-progress">
          ${this.renderProgress()}
        </div>
        
        <div class="wizard-content-embedded">
          ${this.renderStep()}
        </div>
        
        <div class="wizard-footer-embedded">
          ${this.renderFooter()}
        </div>
      </div>
    `
  }

  private renderProgress(): string {
    const steps = [
      { num: 1, label: 'Upload' },
      { num: 2, label: 'Mapping' },
      { num: 3, label: 'Géométrie' },
      { num: 4, label: 'Preview' },
      { num: 5, label: 'Import' }
    ]

    return steps.map(step => `
      <div class="progress-step ${step.num === this.currentStep ? 'active' : ''} ${step.num < this.currentStep ? 'completed' : ''}">
        <div class="step-number">${step.num}</div>
        <div class="step-label">${step.label}</div>
      </div>
    `).join('')
  }

  private renderFooter(): string {
    return `
      ${this.currentStep > 1 ? '<button class="btn" id="wizardPrev">← Précédent</button>' : ''}
      <div style="flex:1"></div>
      ${this.currentStep < 5 ? '<button class="btn primary" id="wizardNext">Suivant →</button>' : ''}
      ${this.currentStep === 5 ? '<button class="btn primary" id="wizardImport">🚀 Importer</button>' : ''}
    `
  }

  private renderStep(): string {
    switch (this.currentStep) {
      case 1: return this.renderStep1Upload()
      case 2: return this.renderStep2Mapping()
      case 3: return this.renderStep3Geometry()
      case 4: return this.renderStep4Preview()
      case 5: return this.renderStep5Import()
      default: return ''
    }
  }

  // ============================================================================
  // STEP 1: Upload & Détection
  // ============================================================================
  private renderStep1Upload(): string {
    return `
      <div class="step-upload">
        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">📁</div>
          <h3>Glissez-déposez votre fichier ici</h3>
          <p>ou cliquez pour parcourir</p>
          <p class="upload-hint">Formats acceptés : CSV, XLSX, XLS (max 50 MB)</p>
          <input type="file" id="fileInput" accept=".csv,.xlsx,.xls" style="display:none">
        </div>

        ${this.file ? `
          <div class="file-info">
            <div class="file-name">📄 ${this.file.name}</div>
            <div class="file-size">${(this.file.size / 1024).toFixed(2)} KB</div>
          </div>
        ` : ''}

        <div class="templates-section">
          <h4>📦 Modèles disponibles</h4>
          <div class="templates-grid">
            <button class="template-btn" data-template="sondages">📥 Sondages complets</button>
            <button class="template-btn" data-template="atterberg">📥 Atterberg</button>
            <button class="template-btn" data-template="vbs">📥 VBS</button>
            <button class="template-btn" data-template="granulo">📥 Granulo</button>
          </div>
        </div>

        <details class="advanced-options">
          <summary>⚙️ Options avancées</summary>
          <div class="options-grid">
            <div class="form-field">
              <label>Encodage</label>
              <select id="encoding">
                <option value="UTF-8">UTF-8</option>
                <option value="ISO-8859-1">ISO-8859-1</option>
                <option value="Windows-1252">Windows-1252</option>
              </select>
            </div>
            <div class="form-field">
              <label>Délimiteur</label>
              <select id="delimiter">
                <option value=",">Virgule (,)</option>
                <option value=";">Point-virgule (;)</option>
                <option value="\t">Tabulation</option>
              </select>
            </div>
          </div>
        </details>
      </div>
    `
  }

  private renderStep2Mapping(): string {
    return `
      <div class="step-mapping">
        <h4>🔗 Correspondance des colonnes</h4>
        <p>Associez les colonnes de votre fichier aux champs Atlas</p>
        
        <div class="mapping-container">
          <div class="preset-buttons">
            <button class="preset-btn active" data-preset="sondages">Sondages simples</button>
            <button class="preset-btn" data-preset="complet">Sondages + Essais</button>
            <button class="preset-btn" data-preset="custom">Personnalisé</button>
          </div>
          
          <div class="mapping-grid">
            <!-- Mapping fields will be populated dynamically -->
          </div>
        </div>
      </div>
    `
  }

  private renderStep3Geometry(): string {
    return `
      <div class="step-geometry">
        <h4>🌍 Configuration géométrique</h4>
        <p>Définissez comment traiter les coordonnées géographiques</p>
        
        <div class="geometry-options">
          <div class="option-card">
            <input type="radio" id="geo-auto" name="geometry" value="auto" checked>
            <label for="geo-auto">
              <strong>Détection automatique</strong>
              <span>Atlas détecte automatiquement le format des coordonnées</span>
            </label>
          </div>
          
          <div class="option-card">
            <input type="radio" id="geo-decimal" name="geometry" value="decimal">
            <label for="geo-decimal">
              <strong>Coordonnées décimales</strong>
              <span>Format : 6.1234, 1.5678 (WGS84)</span>
            </label>
          </div>
          
          <div class="option-card">
            <input type="radio" id="geo-dms" name="geometry" value="dms">
            <label for="geo-dms">
              <strong>Degrés/Minutes/Secondes</strong>
              <span>Format : 6°12'34"N, 1°56'78"E</span>
            </label>
          </div>
        </div>
      </div>
    `
  }

  private renderStep4Preview(): string {
    return `
      <div class="step-preview">
        <h4>👀 Aperçu et validation</h4>
        <p>Vérifiez les données avant l'import final</p>
        
        <div class="preview-stats">
          <div class="stat-card success">
            <div class="stat-number">0</div>
            <div class="stat-label">À créer</div>
          </div>
          <div class="stat-card warning">
            <div class="stat-number">0</div>
            <div class="stat-label">À mettre à jour</div>
          </div>
          <div class="stat-card error">
            <div class="stat-number">0</div>
            <div class="stat-label">Erreurs</div>
          </div>
        </div>
        
        <div class="preview-table">
          <!-- Preview data will be populated dynamically -->
        </div>
        
        <div class="actions-section">
          <button class="btn" id="exportErrors">📄 Exporter les erreurs</button>
        </div>
      </div>
    `
  }

  private renderStep5Import(): string {
    return `
      <div class="step-import">
        <h4>🚀 Import en cours...</h4>
        
        <div class="import-progress">
          <div class="progress-bar">
            <div class="progress-fill" style="width: 0%"></div>
          </div>
          <div class="progress-text">Préparation...</div>
        </div>
        
        <div class="import-results" style="display: none;">
          <div class="result-success">
            <h4>✅ Import terminé avec succès !</h4>
            <div class="result-stats">
              <div class="result-item">
                <span class="result-number" id="importedCount">0</span>
                <span class="result-label">sondages importés</span>
              </div>
              <div class="result-item">
                <span class="result-number" id="geocodedCount">0</span>
                <span class="result-label">auto-géocodés</span>
              </div>
            </div>
            
            <div class="result-actions">
              <button class="btn primary" id="viewImported">📋 Voir les sondages importés</button>
              <button class="btn" id="undoImport">↶ Annuler l'import</button>
            </div>
          </div>
        </div>
      </div>
    `
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================
  private attachEventListeners() {
    // Close button (modal only)
    if (this.mode === 'modal') {
      const closeBtn = document.getElementById('wizardClose')
      if (closeBtn) {
        closeBtn.addEventListener('click', () => this.close())
      }
    }

    // Navigation buttons
    const prevBtn = document.getElementById('wizardPrev')
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousStep())
    }

    const nextBtn = document.getElementById('wizardNext')
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextStep())
    }

    const importBtn = document.getElementById('wizardImport')
    if (importBtn) {
      importBtn.addEventListener('click', () => this.doImport())
    }

    // Step-specific listeners
    this.attachStepListeners()
  }

  private attachStepListeners() {
    switch (this.currentStep) {
      case 1: this.attachStep1Listeners(); break
      case 2: this.attachStep2Listeners(); break
      case 3: this.attachStep3Listeners(); break
      case 4: this.attachStep4Listeners(); break
      case 5: this.attachStep5Listeners(); break
    }
  }

  private attachStep1Listeners() {
    const uploadZone = document.getElementById('uploadZone')
    const fileInput = document.getElementById('fileInput') as HTMLInputElement

    if (uploadZone && fileInput) {
      uploadZone.addEventListener('click', () => fileInput.click())
      
      fileInput.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement
        if (target.files && target.files[0]) {
          this.file = target.files[0]
          this.render()
        }
      })

      // Drag & drop
      uploadZone.addEventListener('dragover', (e) => {
        e.preventDefault()
        uploadZone.classList.add('dragover')
      })

      uploadZone.addEventListener('dragleave', () => {
        uploadZone.classList.remove('dragover')
      })

      uploadZone.addEventListener('drop', (e) => {
        e.preventDefault()
        uploadZone.classList.remove('dragover')
        if (e.dataTransfer && e.dataTransfer.files[0]) {
          this.file = e.dataTransfer.files[0]
          this.render()
        }
      })
    }

    // Template buttons
    document.querySelectorAll('.template-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const template = (e.target as HTMLElement).dataset.template
        this.applyTemplate(template)
      })
    })
  }

  private attachStep2Listeners() {
    // Preset buttons
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'))
        ;(e.target as HTMLElement).classList.add('active')
      })
    })
  }

  private attachStep3Listeners() {
    // Geometry options already handled by radio inputs
  }

  private attachStep4Listeners() {
    const exportBtn = document.getElementById('exportErrors')
    if (exportBtn) {
      exportBtn.addEventListener('click', () => this.exportErrors())
    }
  }

  private attachStep5Listeners() {
    const undoBtn = document.getElementById('undoImport')
    if (undoBtn) {
      undoBtn.addEventListener('click', () => this.undoImport())
    }

    const viewBtn = document.getElementById('viewImported')
    if (viewBtn) {
      viewBtn.addEventListener('click', () => this.viewImportedSurveys())
    }
  }

  // ============================================================================
  // Navigation Methods
  // ============================================================================
  private nextStep() {
    if (this.currentStep < 5) {
      this.currentStep++
      this.render()
    }
  }

  private previousStep() {
    if (this.currentStep > 1) {
      this.currentStep--
      this.render()
    }
  }

  // ============================================================================
  // Import Logic
  // ============================================================================
  private async doImport() {
    if (!this.session || !this.previewData) {
      console.error('[WIZARD] Session ou preview manquant pour import')
      return
    }

    try {
      console.log('[WIZARD] Démarrage import...')
      
      // 1. Lancer l'import
      const importResponse = await fetch(`${this.apiUrl}/imports/${this.session.id}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          mapping: this.mapping,
          geometry_config: this.geometryConfig
        })
      })

      if (!importResponse.ok) {
        throw new Error('Erreur lors de l\'import')
      }

      const importResult = await importResponse.json()
      console.log('[WIZARD] Import terminé:', importResult)

      // 2. Déclencher auto-géocodage si des sondages ont été créés
      let autoGeocoded = 0
      if (importResult.created > 0) {
        console.log('[WIZARD] Déclenchement auto-géocodage pour nouveaux sondages...')
        
        try {
          const autoGeocodeResponse = await fetch(`${this.apiUrl}/suggestions/auto-geocode?threshold=85`, {
            method: 'POST'
          })
          
          if (autoGeocodeResponse.ok) {
            const autoResult = await autoGeocodeResponse.json()
            console.log('[WIZARD] Auto-géocodage terminé:', autoResult)
            autoGeocoded = autoResult.processed || 0
          } else {
            console.warn('[WIZARD] Auto-géocodage échoué, mais import réussi')
          }
        } catch (autoError) {
          console.warn('[WIZARD] Erreur auto-géocodage:', autoError)
        }
      }

      // 3. Afficher les résultats
      this.showImportResults(importResult.created, autoGeocoded)

    } catch (error) {
      console.error('[WIZARD] Erreur import:', error)
      alert(`Erreur lors de l'import: ${error}`)
    }
  }

  private showImportResults(imported: number, geocoded: number) {
    const importedEl = document.getElementById('importedCount')
    const geocodedEl = document.getElementById('geocodedCount')
    const resultsEl = document.querySelector('.import-results') as HTMLElement
    const progressEl = document.querySelector('.import-progress') as HTMLElement

    if (importedEl) importedEl.textContent = imported.toString()
    if (geocodedEl) geocodedEl.textContent = geocoded.toString()
    
    if (progressEl) progressEl.style.display = 'none'
    if (resultsEl) resultsEl.style.display = 'block'
  }

  private async undoImport() {
    if (!this.session) return
    
    try {
      const response = await fetch(`${this.apiUrl}/imports/${this.session.id}/undo`, {
        method: 'POST'
      })
      
      if (response.ok) {
        alert('Import annulé avec succès')
        this.close()
      } else {
        alert('Erreur lors de l\'annulation')
      }
    } catch (error) {
      console.error('[WIZARD] Erreur annulation:', error)
      alert('Erreur lors de l\'annulation')
    }
  }

  private exportErrors() {
    // Export validation errors as CSV
    console.log('[WIZARD] Export des erreurs')
  }

  private applyTemplate(template: string | undefined) {
    console.log('[WIZARD] Application du template:', template)
    // Apply predefined mapping based on template
  }

  private viewImportedSurveys() {
    // Navigate to surveys list with filter for recently imported
    console.log('[WIZARD] Navigation vers les sondages importés')
    this.close()
    
    // Dispatch event to parent to switch to surveys list
    window.dispatchEvent(new CustomEvent('wizard-view-imported', {
      detail: { sessionId: this.session?.id }
    }))
  }
}
// FIN DE CLASSE - Code corrompu supprimé
