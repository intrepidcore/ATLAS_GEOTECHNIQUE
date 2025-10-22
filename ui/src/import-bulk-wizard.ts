/**
 * Import Bulk Wizard - Version complète et avancée
 * 5 étapes: Upload → Mapping → Validation → Preview → Import
 */

export class ImportBulkWizard {
  private container: HTMLElement
  private apiUrl: string
  private currentStep: number = 0
  private file: File | null = null
  private columns: string[] = []
  private mapping: Record<string, string> = {}
  private data: any[] = []
  private onComplete: () => void

  private steps = [
    { id: 'upload', title: '📁 Chargement', description: 'Sélectionner votre fichier' },
    { id: 'mapping', title: '🗺️ Mapping', description: 'Associer les colonnes' },
    { id: 'validation', title: '✓ Validation', description: 'Vérifier les données' },
    { id: 'preview', title: '👁️ Aperçu', description: 'Prévisualiser l\'import' },
    { id: 'import', title: '⚙️ Import', description: 'Import en cours' }
  ]

  private requiredFields = ['code', 'lat', 'lon', 'depth_m']
  private optionalFields = [
    'date', 'source', 'passant_80um', 'passant_2mm', 'passant_20mm',
    'wl', 'wp', 'vbs', 'gamma_d_max', 'w_opt', 'proctor_type', 'eg',
    'laboratory', 'norm'
  ]

  constructor(containerId: string, apiUrl: string, onComplete: () => void) {
    const el = document.getElementById(containerId)
    if (!el) throw new Error(`Container #${containerId} not found`)
    
    this.container = el
    this.apiUrl = apiUrl
    this.onComplete = onComplete
    this.render()
  }

  private render() {
    this.container.innerHTML = `
      <div class="import-wizard">
        <div class="wizard-header">
          <h2>📥 Import Bulk - Wizard Complet</h2>
          <button class="btn-close" id="wizardClose">×</button>
        </div>

        <!-- Progress Bar -->
        <div class="wizard-progress">
          ${this.steps.map((step, i) => `
            <div class="progress-step ${i === this.currentStep ? 'active' : ''} ${i < this.currentStep ? 'completed' : ''}">
              <div class="step-number">${i + 1}</div>
              <div class="step-label">${step.title}</div>
            </div>
          `).join('')}
        </div>

        <!-- Step Content -->
        <div class="wizard-content" id="wizardContent"></div>

        <!-- Navigation -->
        <div class="wizard-footer">
          <button class="btn" id="wizardPrev" ${this.currentStep === 0 ? 'disabled' : ''}>
            ← Précédent
          </button>
          <button class="btn primary" id="wizardNext">
            ${this.currentStep === this.steps.length - 1 ? 'Terminer' : 'Suivant →'}
          </button>
        </div>
      </div>
    `

    this.renderStep()
    this.attachEventListeners()
  }

  private renderStep() {
    const content = document.getElementById('wizardContent')
    if (!content) return

    switch (this.currentStep) {
      case 0:
        content.innerHTML = this.renderUploadStep()
        this.attachUploadListeners()
        break
      case 1:
        content.innerHTML = this.renderMappingStep()
        this.attachMappingListeners()
        break
      case 2:
        content.innerHTML = this.renderValidationStep()
        break
      case 3:
        content.innerHTML = this.renderPreviewStep()
        break
      case 4:
        content.innerHTML = this.renderImportStep()
        this.startImport()
        break
    }
  }

  private renderUploadStep(): string {
    return `
      <div class="wizard-step">
        <h3>📁 Étape 1: Chargement du fichier</h3>
        <p class="step-description">Sélectionnez un fichier CSV contenant vos données géotechniques</p>

        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">📄</div>
          <div class="upload-text">
            <strong>Glissez-déposez votre fichier ici</strong><br>
            ou cliquez pour sélectionner
          </div>
          <input type="file" id="fileInput" accept=".csv,.txt" style="display:none">
        </div>

        ${this.file ? `
          <div class="file-info">
            <div class="file-icon">✓</div>
            <div class="file-details">
              <strong>${this.file.name}</strong><br>
              <small>${(this.file.size / 1024).toFixed(1)} KB • ${this.columns.length} colonnes détectées</small>
            </div>
            <button class="btn-sm" id="clearFile">✕</button>
          </div>
        ` : ''}

        <div class="template-section">
          <h4>📋 Télécharger un modèle</h4>
          <div class="btn-group">
            <button class="btn-sm" id="downloadTemplate">📥 Modèle CSV complet</button>
            <button class="btn-sm" id="downloadMinimal">📥 Modèle minimal</button>
          </div>
        </div>

        <div class="format-info">
          <h4>ℹ️ Format attendu</h4>
          <div class="format-table">
            <div class="format-row">
              <strong>Colonnes obligatoires:</strong> ${this.requiredFields.join(', ')}
            </div>
            <div class="format-row">
              <strong>Colonnes optionnelles:</strong> ${this.optionalFields.slice(0, 5).join(', ')}...
            </div>
          </div>
        </div>
      </div>
    `
  }

  private renderMappingStep(): string {
    const allFields = [...this.requiredFields, ...this.optionalFields]
    
    return `
      <div class="wizard-step">
        <h3>🗺️ Étape 2: Mapping des colonnes</h3>
        <p class="step-description">Associez les colonnes de votre fichier aux champs de la base de données</p>

        <div class="mapping-grid">
          ${allFields.map(field => `
            <div class="mapping-row ${this.requiredFields.includes(field) ? 'required' : ''}">
              <div class="field-label">
                <strong>${field}</strong>
                ${this.requiredFields.includes(field) ? '<span class="badge-required">Requis</span>' : ''}
              </div>
              <select class="mapping-select" data-field="${field}">
                <option value="">-- Non mappé --</option>
                ${this.columns.map(col => `
                  <option value="${col}" ${this.mapping[field] === col ? 'selected' : ''}>
                    ${col}
                  </option>
                `).join('')}
              </select>
            </div>
          `).join('')}
        </div>

        <div class="mapping-stats">
          <div class="stat-card">
            <div class="stat-value">${Object.keys(this.mapping).length}</div>
            <div class="stat-label">Colonnes mappées</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${this.requiredFields.filter(f => this.mapping[f]).length}/${this.requiredFields.length}</div>
            <div class="stat-label">Champs requis</div>
          </div>
        </div>
      </div>
    `
  }

  private renderValidationStep(): string {
    const errors: string[] = []
    const warnings: string[] = []

    // Validate required fields
    this.requiredFields.forEach(field => {
      if (!this.mapping[field]) {
        errors.push(`Champ requis manquant: ${field}`)
      }
    })

    // Validate data
    if (this.data.length === 0) {
      errors.push('Aucune donnée à importer')
    }

    // Check for duplicates
    const codes = this.data.map(row => row[this.mapping['code']])
    const duplicates = codes.filter((code, index) => codes.indexOf(code) !== index)
    if (duplicates.length > 0) {
      warnings.push(`${duplicates.length} code(s) en double détecté(s)`)
    }

    return `
      <div class="wizard-step">
        <h3>✓ Étape 3: Validation</h3>
        <p class="step-description">Vérification de la cohérence des données</p>

        ${errors.length > 0 ? `
          <div class="validation-errors">
            <h4>❌ Erreurs (${errors.length})</h4>
            ${errors.map(err => `<div class="error-item">• ${err}</div>`).join('')}
          </div>
        ` : ''}

        ${warnings.length > 0 ? `
          <div class="validation-warnings">
            <h4>⚠️ Avertissements (${warnings.length})</h4>
            ${warnings.map(warn => `<div class="warning-item">• ${warn}</div>`).join('')}
          </div>
        ` : ''}

        ${errors.length === 0 && warnings.length === 0 ? `
          <div class="validation-success">
            <div class="success-icon">✓</div>
            <h4>Validation réussie !</h4>
            <p>${this.data.length} ligne(s) prête(s) à être importée(s)</p>
          </div>
        ` : ''}

        <div class="validation-stats">
          <div class="stat-card">
            <div class="stat-value">${this.data.length}</div>
            <div class="stat-label">Lignes totales</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${new Set(codes).size}</div>
            <div class="stat-label">Sondages uniques</div>
          </div>
          <div class="stat-card ${errors.length > 0 ? 'error' : 'success'}">
            <div class="stat-value">${errors.length}</div>
            <div class="stat-label">Erreurs</div>
          </div>
          <div class="stat-card ${warnings.length > 0 ? 'warning' : 'success'}">
            <div class="stat-value">${warnings.length}</div>
            <div class="stat-label">Avertissements</div>
          </div>
        </div>
      </div>
    `
  }

  private renderPreviewStep(): string {
    const previewData = this.data.slice(0, 10)
    
    return `
      <div class="wizard-step">
        <h3>👁️ Étape 4: Aperçu</h3>
        <p class="step-description">Prévisualisation des 10 premières lignes</p>

        <div class="preview-table-container">
          <table class="preview-table">
            <thead>
              <tr>
                ${this.requiredFields.map(field => `<th>${field}</th>`).join('')}
              </tr>
            </thead>
            <tbody>
              ${previewData.map(row => `
                <tr>
                  ${this.requiredFields.map(field => `
                    <td>${row[this.mapping[field]] || '-'}</td>
                  `).join('')}
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>

        <div class="preview-info">
          <p><strong>Note:</strong> Seules les 10 premières lignes sont affichées. ${this.data.length} ligne(s) seront importées au total.</p>
        </div>
      </div>
    `
  }

  private renderImportStep(): string {
    return `
      <div class="wizard-step">
        <h3>⚙️ Étape 5: Import en cours</h3>
        <p class="step-description">Importation des données dans la base</p>

        <div class="import-progress">
          <div class="progress-bar">
            <div class="progress-fill" id="progressFill" style="width: 0%"></div>
          </div>
          <div class="progress-text" id="progressText">0%</div>
        </div>

        <div class="import-log" id="importLog"></div>
      </div>
    `
  }

  private attachEventListeners() {
    document.getElementById('wizardClose')?.addEventListener('click', () => this.close())
    document.getElementById('wizardPrev')?.addEventListener('click', () => this.previousStep())
    document.getElementById('wizardNext')?.addEventListener('click', () => this.nextStep())
  }

  private attachUploadListeners() {
    const zone = document.getElementById('uploadZone')
    const input = document.getElementById('fileInput') as HTMLInputElement

    zone?.addEventListener('click', () => input?.click())
    
    zone?.addEventListener('dragover', (e) => {
      e.preventDefault()
      zone.classList.add('drag-over')
    })

    zone?.addEventListener('dragleave', () => {
      zone.classList.remove('drag-over')
    })

    zone?.addEventListener('drop', async (e) => {
      e.preventDefault()
      zone.classList.remove('drag-over')
      const files = e.dataTransfer?.files
      if (files && files[0]) {
        await this.handleFile(files[0])
      }
    })

    input?.addEventListener('change', async (e) => {
      const files = (e.target as HTMLInputElement).files
      if (files && files[0]) {
        await this.handleFile(files[0])
      }
    })

    document.getElementById('clearFile')?.addEventListener('click', () => {
      this.file = null
      this.columns = []
      this.data = []
      this.renderStep()
    })

    document.getElementById('downloadTemplate')?.addEventListener('click', () => this.downloadTemplate('full'))
    document.getElementById('downloadMinimal')?.addEventListener('click', () => this.downloadTemplate('minimal'))
  }

  private attachMappingListeners() {
    document.querySelectorAll('.mapping-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const field = (e.target as HTMLSelectElement).dataset.field!
        const value = (e.target as HTMLSelectElement).value
        
        if (value) {
          this.mapping[field] = value
        } else {
          delete this.mapping[field]
        }
        
        this.renderStep()
      })
    })
  }

  private async handleFile(file: File) {
    // Check size
    if (file.size > 50 * 1024 * 1024) {
      alert('Fichier trop volumineux (max 50 MB)')
      return
    }

    this.file = file

    try {
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      
      if (lines.length === 0) {
        throw new Error('Fichier vide')
      }

      // Detect separator
      const separator = this.detectSeparator(lines[0])
      
      // Parse header
      this.columns = lines[0].split(separator).map(c => c.trim().replace(/['"]/g, ''))
      
      // Parse data
      this.data = lines.slice(1).map(line => {
        const values = line.split(separator)
        const row: any = {}
        this.columns.forEach((col, i) => {
          row[col] = values[i]?.trim().replace(/['"]/g, '') || ''
        })
        return row
      })

      // Auto-mapping
      this.autoMap()
      
      this.renderStep()
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Erreur lors de la lecture du fichier')
    }
  }

  private detectSeparator(line: string): string {
    const separators = [',', ';', '\t', '|']
    const counts = separators.map(sep => line.split(sep).length)
    const maxIndex = counts.indexOf(Math.max(...counts))
    return separators[maxIndex]
  }

  private autoMap() {
    // Auto-map columns with exact or similar names
    const allFields = [...this.requiredFields, ...this.optionalFields]
    
    allFields.forEach(field => {
      const match = this.columns.find(col => 
        col.toLowerCase() === field.toLowerCase() ||
        col.toLowerCase().replace(/_/g, '') === field.toLowerCase().replace(/_/g, '')
      )
      
      if (match) {
        this.mapping[field] = match
      }
    })
  }

  private downloadTemplate(type: 'full' | 'minimal') {
    const fields = type === 'full' 
      ? [...this.requiredFields, ...this.optionalFields]
      : this.requiredFields

    const header = fields.join(',')
    const example = type === 'full'
      ? 'BULK-001,2025-01-10,Lab XYZ,6.1345,1.2123,5.0,45.5,85.2,20.0,38.2,22.1,2.5,18.5,12.3,normal,1.2,Lab A,NF P94-051'
      : 'BULK-001,6.1345,1.2123,5.0'

    const csv = `${header}\n${example}\n`
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `template_${type}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  private async startImport() {
    const progressFill = document.getElementById('progressFill')
    const progressText = document.getElementById('progressText')
    const log = document.getElementById('importLog')

    if (!progressFill || !progressText || !log) return

    // Transform data according to mapping
    const transformedData = this.data.map(row => {
      const transformed: any = {}
      Object.keys(this.mapping).forEach(field => {
        const column = this.mapping[field]
        transformed[field] = row[column]
      })
      return transformed
    })

    // Send to API
    try {
      const response = await fetch(`${this.apiUrl}/import/bulk`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: transformedData })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }

      const result = await response.json()

      // Simulate progress
      let progress = 0
      const interval = setInterval(() => {
        progress += 10
        progressFill.style.width = `${progress}%`
        progressText.textContent = `${progress}%`

        if (progress >= 100) {
          clearInterval(interval)
          log.innerHTML = `
            <div class="log-success">
              ✓ Import terminé avec succès !<br>
              ${result.imported || this.data.length} ligne(s) importée(s)
            </div>
          `
          
          setTimeout(() => {
            this.onComplete()
            this.close()
          }, 2000)
        }
      }, 200)

    } catch (error) {
      log.innerHTML = `
        <div class="log-error">
          ❌ Erreur lors de l'import: ${error}
        </div>
      `
    }
  }

  private nextStep() {
    // Validation before next
    if (this.currentStep === 0 && !this.file) {
      alert('Veuillez sélectionner un fichier')
      return
    }

    if (this.currentStep === 1) {
      const missingRequired = this.requiredFields.filter(f => !this.mapping[f])
      if (missingRequired.length > 0) {
        alert(`Champs requis manquants: ${missingRequired.join(', ')}`)
        return
      }
    }

    if (this.currentStep === 2) {
      // Check validation errors
      const errors = this.requiredFields.filter(f => !this.mapping[f])
      if (errors.length > 0) {
        alert('Veuillez corriger les erreurs avant de continuer')
        return
      }
    }

    if (this.currentStep < this.steps.length - 1) {
      this.currentStep++
      this.render()
    } else {
      this.onComplete()
      this.close()
    }
  }

  private previousStep() {
    if (this.currentStep > 0) {
      this.currentStep--
      this.render()
    }
  }

  private close() {
    this.container.innerHTML = ''
    this.container.style.display = 'none'
  }

  public open() {
    this.container.style.display = 'block'
    this.render()
  }
}
