/**
 * Import Bulk Wizard - Version complète et avancée
 * Support CSV et XLSX (multi-feuilles)
 * 5 étapes: Upload → Format → Mapping → Preview → Import
 */

import * as ExcelJS from 'exceljs'

type ImportMode = 'csv' | 'xlsx_geotech'

type SheetRole =
  | 'sondages'
  | 'echantillons'
  | 'atterberg'
  | 'vbs'
  | 'proctor'
  | 'granulo_tamisage_large'
  | 'granulo_sedimento_large'

type XlsxSheets = Partial<Record<SheetRole, string>>

// Types pour le mapping XLSX (structure imbriquée)
type SheetMapping = Record<string, string | null>
type XlsxMapping = Partial<Record<SheetRole, SheetMapping>>

export class ImportBulkWizard {
  private container: HTMLElement
  private apiUrl: string
  private currentStep: number = 0
  private file: File | null = null
  private columns: string[] = []
  private mapping: Record<string, string> = {}  // Pour CSV
  private xlsxMapping: XlsxMapping = {}  // Pour XLSX
  private data: any[] = []
  private onComplete: () => void
  
  // XLSX specific
  private mode: ImportMode = 'csv'
  private workbook: ExcelJS.Workbook | null = null
  private detectedSheets: string[] = []
  private sheetMap: XlsxSheets = {}
  private parsed: Partial<Record<SheetRole, any[]>> = {}
  private columnsBySheet: Record<string, string[]> = {}  // En-têtes par feuille

  private steps = [
    { id: 'upload', title: '📁 Fichier', description: 'CSV ou XLSX' },
    { id: 'format', title: '📊 Format', description: 'Type d\'import' },
    { id: 'mapping', title: '🗺️ Mapping', description: 'Colonnes' },
    { id: 'preview', title: '👁️ Aperçu', description: 'Validation' },
    { id: 'import', title: '⚙️ Import', description: 'En cours' }
  ]

  private requiredFields = ['code', 'lat', 'lon', 'depth_m']
  private optionalFields = [
    'date', 'source', 'passant_80um', 'passant_2mm', 'passant_20mm',
    'wl', 'wp', 'ip', 'vbs', 'gamma_d_max', 'w_opt', 'proctor_type', 'eg',
    'laboratory', 'norm', 'comment'
  ]
  
  // Validation bounds
  private validationRules = {
    lat: { min: -90, max: 90 },
    lon: { min: -180, max: 180 },
    depth_m: { min: 0, max: 1000 },
    passant_80um: { min: 0, max: 100 },
    passant_2mm: { min: 0, max: 100 },
    passant_20mm: { min: 0, max: 100 },
    wl: { min: 0, max: 100 },
    wp: { min: 0, max: 100 },
    ip: { min: 0, max: 100 },
    vbs: { min: 0, max: 20 },
    gamma_d_max: { min: 12, max: 24 },
    w_opt: { min: 0, max: 40 },
    eg: { min: 0, max: 100 }
  }

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
        if (this.mode === 'xlsx_geotech') {
          content.innerHTML = this.renderXlsxSheetSelection()
          this.attachXlsxSheetListeners()
        } else {
          content.innerHTML = this.renderMappingStep()
          this.attachMappingListeners()
        }
        break
      case 2:
        content.innerHTML = this.renderMappingStep()
        this.attachMappingListeners()
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
        <p class="step-description">Sélectionnez un fichier CSV ou XLSX contenant vos données géotechniques</p>

        <div class="upload-zone" id="uploadZone">
          <div class="upload-icon">📄</div>
          <div class="upload-text">
            <strong>Glissez-déposez votre fichier ici</strong><br>
            ou cliquez pour sélectionner<br>
            <small style="color: #94a3b8; margin-top: 0.5rem; display: block;">Formats acceptés: CSV, XLSX</small>
          </div>
          <input type="file" id="fileInput" 
                 accept=".csv,.txt,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel,text/csv,text/plain" 
                 style="display:none">
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
            <button class="btn-sm" id="downloadCSVTemplate">📥 Modèle CSV</button>
            <button class="btn-sm" id="downloadXLSXTemplate">📊 Modèle XLSX (multi-feuilles)</button>
            <button class="btn-sm" id="downloadXLSXExample">✨ Exemple XLSX complet</button>
          </div>
          <p style="color: #94a3b8; font-size: 0.85rem; margin-top: 0.5rem;">
            💡 Le format XLSX multi-feuilles permet d'importer granulométrie complète, Atterberg, VBS, Proctor...
          </p>
        </div>

        <div class="format-info">
          <h4>ℹ️ Formats supportés</h4>
          <div class="format-table">
            <div class="format-row">
              <strong>📄 CSV:</strong> Format simple, une ligne par essai
            </div>
            <div class="format-row">
              <strong>📊 XLSX multi-feuilles:</strong> Granulo complète, Atterberg, VBS, Proctor (recommandé)
            </div>
            <div class="format-row" style="margin-top: 0.5rem; padding-top: 0.5rem; border-top: 1px solid #334155;">
              <strong>Colonnes CSV obligatoires:</strong> <code style="background: #1e293b; padding: 0.125rem 0.375rem; border-radius: 3px; color: #94a3b8;">${this.requiredFields.join(', ')}</code>
            </div>
          </div>
        </div>
      </div>
    `
  }

  private renderXlsxSheetSelection(): string {
    const sheetRoles: SheetRole[] = [
      'sondages',
      'echantillons',
      'atterberg',
      'vbs',
      'proctor',
      'granulo_tamisage_large',
      'granulo_sedimento_large'
    ]

    const labelMap: Record<SheetRole, string> = {
      sondages: 'Sondages (obligatoire)',
      echantillons: 'Échantillons (optionnel)',
      atterberg: 'Atterberg (WL/WP/IP)',
      vbs: 'Valeur de Bleu (VBS)',
      proctor: 'Proctor (γdmax, wopt)',
      granulo_tamisage_large: 'Granulo tamisage',
      granulo_sedimento_large: 'Granulo sédimentation',
    }

    return `
      <div class="wizard-step">
        <h3>📊 Étape 2: Sélection des feuilles</h3>
        <p class="step-description">Associez chaque type de données à une feuille de votre fichier Excel</p>

        <div class="sheet-info" style="background: #1e293b; padding: 0.75rem; border-radius: 4px; margin-bottom: 1rem; color: #94a3b8;">
          <strong>📄 ${this.detectedSheets.length} feuille(s) détectée(s):</strong> ${this.detectedSheets.join(', ')}
        </div>

        <div class="sheet-mapping" style="display: flex; flex-direction: column; gap: 0.75rem;">
          ${sheetRoles.map(role => `
            <div class="mapping-row" style="display: flex; align-items: center; gap: 1rem;">
              <label style="min-width: 220px; color: ${role === 'sondages' ? '#ef4444' : '#94a3b8'};">
                ${labelMap[role]}
              </label>
              <select 
                class="sheet-select" 
                data-role="${role}"
                style="flex: 1; padding: 0.5rem; background: #1e293b; border: 1px solid #334155; border-radius: 4px; color: #e2e8f0;"
              >
                <option value="">— aucune —</option>
                ${this.detectedSheets.map(sheet => `
                  <option value="${sheet}" ${this.sheetMap[role] === sheet ? 'selected' : ''}>
                    ${sheet}
                  </option>
                `).join('')}
              </select>
            </div>
          `).join('')}
        </div>

        <div class="sheet-stats" style="margin-top: 1.5rem; padding: 0.75rem; background: #1e293b; border-radius: 4px; border-left: 4px solid #3b82f6;">
          <strong style="color: #94a3b8;">💡 Astuce:</strong>
          <p style="margin: 0.5rem 0 0 0; color: #94a3b8; font-size: 0.9rem;">
            La feuille "Sondages" est obligatoire. Les autres sont optionnelles selon vos données disponibles.
          </p>
        </div>
      </div>
    `
  }

  private attachXlsxSheetListeners() {
    document.querySelectorAll('.sheet-select').forEach(select => {
      select.addEventListener('change', (e) => {
        const role = (e.target as HTMLSelectElement).dataset.role as SheetRole
        const value = (e.target as HTMLSelectElement).value
        
        if (value) {
          this.sheetMap[role] = value
        } else {
          delete this.sheetMap[role]
        }
      })
    })
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
    if (this.mode === 'xlsx_geotech') {
      return this.renderXlsxPreview()
    }
    
    const preview = this.data.slice(0, 10)
    const mappedFields = Object.keys(this.mapping)
    
    // Validation complète
    const validation = this.validateAllData()

    return `
      <div class="wizard-step">
        <h3>👁️ Étape 4: Aperçu et Validation</h3>
        <p class="step-description">Vérifiez les données avant l'import final</p>

        <!-- Résumé -->
        <div class="preview-stats">
          <div class="stat-card">
            <div class="stat-value">${validation.summary.total_rows}</div>
            <div class="stat-label">Lignes totales</div>
          </div>
          <div class="stat-card">
            <div class="stat-value">${validation.summary.unique_codes}</div>
            <div class="stat-label">Sondages uniques</div>
          </div>
          <div class="stat-card ${validation.summary.has_atterberg > 0 ? 'stat-success' : ''}">
            <div class="stat-value">${validation.summary.has_atterberg}</div>
            <div class="stat-label">Atterberg</div>
          </div>
          <div class="stat-card ${validation.summary.has_vbs > 0 ? 'stat-success' : ''}">
            <div class="stat-value">${validation.summary.has_vbs}</div>
            <div class="stat-label">VBS</div>
          </div>
          <div class="stat-card ${validation.summary.has_proctor > 0 ? 'stat-success' : ''}">
            <div class="stat-value">${validation.summary.has_proctor}</div>
            <div class="stat-label">Proctor</div>
          </div>
          <div class="stat-card ${validation.summary.has_granulo > 0 ? 'stat-success' : ''}">
            <div class="stat-value">${validation.summary.has_granulo}</div>
            <div class="stat-label">Granulo</div>
          </div>
        </div>

        <!-- Erreurs -->
        ${validation.errors.length > 0 ? `
          <div class="validation-errors">
            <h4 style="color: #ef4444; margin: 0 0 0.5rem 0;">❌ ${validation.errors.length} Erreur(s)</h4>
            <div style="max-height: 200px; overflow-y: auto; background: #1e293b; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; color: #fca5a5;">
              ${validation.errors.slice(0, 20).map(e => `<div>• ${e}</div>`).join('')}
              ${validation.errors.length > 20 ? `<div style="margin-top: 0.5rem; font-style: italic;">... et ${validation.errors.length - 20} autres erreurs</div>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Warnings -->
        ${validation.warnings.length > 0 ? `
          <div class="validation-warnings" style="margin-top: 1rem;">
            <h4 style="color: #f59e0b; margin: 0 0 0.5rem 0;">⚠️ ${validation.warnings.length} Avertissement(s)</h4>
            <div style="max-height: 150px; overflow-y: auto; background: #1e293b; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; color: #fcd34d;">
              ${validation.warnings.slice(0, 10).map(w => `<div>• ${w}</div>`).join('')}
              ${validation.warnings.length > 10 ? `<div style="margin-top: 0.5rem; font-style: italic;">... et ${validation.warnings.length - 10} autres avertissements</div>` : ''}
            </div>
          </div>
        ` : ''}

        <!-- Aperçu tableau -->
        <div class="preview-table" style="margin-top: 1.5rem;">
          <h4 style="margin: 0 0 0.5rem 0;">📋 Aperçu (10 premières lignes)</h4>
          <div style="overflow-x: auto;">
            <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
              <thead>
                <tr style="background: #1e293b;">
                  ${mappedFields.map(field => `<th style="padding: 0.5rem; text-align: left; border: 1px solid #334155; color: #94a3b8;">${field}</th>`).join('')}
                </tr>
              </thead>
              <tbody>
                ${preview.map(row => `
                  <tr style="border-bottom: 1px solid #334155;">
                    ${mappedFields.map(field => `<td style="padding: 0.5rem; border: 1px solid #334155; color: #1e293b;">${row[this.mapping[field]] || '-'}</td>`).join('')}
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>

        ${validation.errors.length > 0 ? `
          <div class="preview-info" style="margin-top: 1rem; padding: 0.75rem; background: #7f1d1d; border-left: 4px solid #ef4444; border-radius: 4px; color: #fca5a5;">
            <strong>⛔ Import bloqué:</strong> Corrigez les erreurs avant de continuer.
          </div>
        ` : `
          <div class="preview-info" style="margin-top: 1rem; padding: 0.75rem; background: #1e293b; border-left: 4px solid #10b981; border-radius: 4px; color: #94a3b8;">
            <strong>✅ Prêt à importer:</strong> ${validation.summary.total_rows} ligne(s) seront importées.
            ${validation.warnings.length > 0 ? `<br><small>⚠️ ${validation.warnings.length} avertissement(s) à vérifier.</small>` : ''}
          </div>
        `}
      </div>
    `
  }

  private renderXlsxPreview(): string {
    const stats: any = {}
    let totalRows = 0
    
    Object.entries(this.parsed).forEach(([role, rows]) => {
      if (rows) {
        stats[role] = rows.length
        totalRows += rows.length
      }
    })

    return `
      <div class="wizard-step">
        <h3>👁️ Étape 4: Aperçu XLSX Multi-Feuilles</h3>
        <p class="step-description">Vérifiez les données détectées avant l'import final</p>

        <!-- Statistiques globales -->
        <div class="preview-stats" style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 1.5rem;">
          <div class="stat-card" style="background: #1e293b; padding: 1rem; border-radius: 8px; text-align: center;">
            <div class="stat-value" style="font-size: 2rem; font-weight: bold; color: #3b82f6;">${totalRows}</div>
            <div class="stat-label" style="color: #94a3b8; font-size: 0.9rem;">Lignes totales</div>
          </div>
          ${Object.entries(stats).map(([role, count]) => `
            <div class="stat-card" style="background: #1e293b; padding: 1rem; border-radius: 8px; text-align: center;">
              <div class="stat-value" style="font-size: 1.5rem; font-weight: bold; color: #10b981;">${count}</div>
              <div class="stat-label" style="color: #94a3b8; font-size: 0.85rem;">${this.getRoleLabel(role as SheetRole)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Aperçu par feuille -->
        ${Object.entries(this.parsed).map(([role, rows]) => {
          if (!rows || rows.length === 0) return ''
          const preview = rows.slice(0, 5)
          const columns = Object.keys(preview[0] || {})
          
          return `
            <div class="sheet-preview" style="margin-bottom: 1.5rem;">
              <h4 style="color: #94a3b8; margin: 0 0 0.5rem 0;">
                📋 ${this.getRoleLabel(role as SheetRole)} (${rows.length} ligne(s))
              </h4>
              <div style="overflow-x: auto; max-height: 300px; overflow-y: auto;">
                <table style="width: 100%; border-collapse: collapse; font-size: 0.85rem;">
                  <thead style="position: sticky; top: 0; background: #1e293b;">
                    <tr>
                      ${columns.map(col => `
                        <th style="padding: 0.5rem; text-align: left; border: 1px solid #334155; color: #94a3b8; white-space: nowrap;">
                          ${col}
                        </th>
                      `).join('')}
                    </tr>
                  </thead>
                  <tbody>
                    ${preview.map(row => `
                      <tr style="border-bottom: 1px solid #334155;">
                        ${columns.map(col => `
                          <td style="padding: 0.5rem; border: 1px solid #334155; white-space: nowrap; color: #1e293b;">
                            ${row[col] || '-'}
                          </td>
                        `).join('')}
                      </tr>
                    `).join('')}
                  </tbody>
                </table>
              </div>
              ${rows.length > 5 ? `
                <p style="color: #94a3b8; font-size: 0.85rem; margin: 0.5rem 0 0 0; font-style: italic;">
                  ... et ${rows.length - 5} autres ligne(s)
                </p>
              ` : ''}
            </div>
          `
        }).join('')}

        <div class="preview-info" style="margin-top: 1rem; padding: 0.75rem; background: #1e293b; border-left: 4px solid #10b981; border-radius: 4px; color: #94a3b8;">
          <strong>✅ Prêt à importer:</strong> ${totalRows} ligne(s) réparties sur ${Object.keys(stats).length} feuille(s).
        </div>
      </div>
    `
  }

  private getRoleLabel(role: SheetRole): string {
    const labels: Record<SheetRole, string> = {
      sondages: 'Sondages',
      echantillons: 'Échantillons',
      atterberg: 'Atterberg',
      vbs: 'VBS',
      proctor: 'Proctor',
      granulo_tamisage_large: 'Granulo Tamisage',
      granulo_sedimento_large: 'Granulo Sédimentation',
    }
    return labels[role] || role
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

    document.getElementById('downloadCSVTemplate')?.addEventListener('click', () => this.downloadTemplate('csv'))
    document.getElementById('downloadXLSXTemplate')?.addEventListener('click', () => this.downloadTemplate('xlsx'))
    document.getElementById('downloadXLSXExample')?.addEventListener('click', () => this.downloadXLSXExample())
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
      alert('⚠️ Fichier trop volumineux (max 50 MB)\n\nPour les imports massifs, contactez l\'administrateur.')
      return
    }

    this.file = file

    try {
      // Détection XLSX robuste (MIME + extension)
      const isXLSX = file.type === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        || file.type === 'application/vnd.ms-excel'
        || /\.xlsx$/i.test(file.name)
      
      if (isXLSX) {
        // Mode XLSX: lire le classeur et détecter les feuilles (ExcelJS)
        // Pas de confirm(), on charge directement
        
        const buffer = await file.arrayBuffer()
        this.workbook = new ExcelJS.Workbook()
        await this.workbook.xlsx.load(buffer)
        
        // Récupérer les noms des feuilles
        this.detectedSheets = this.workbook.worksheets.map(ws => ws.name)
        
        // CRITIQUE : Extraire les en-têtes de chaque feuille
        this.extractHeaders(this.workbook)
        
        // Auto-détection des rôles par heuristiques
        this.sheetMap = this.autodetectSheetRoles(this.detectedSheets)
        
        // Initialiser le mapping XLSX avec les valeurs par défaut
        this.initializeXlsxMapping()
        
        // Afficher un message informatif dans l'UI (pas de toast bloquant)
        this.showToast('📊 Fichier XLSX détecté — import multi-feuilles activé')
        
        this.mode = 'xlsx_geotech'
        this.currentStep = 1 // Étape 2 = Format/Feuilles
        this.renderStep()
        return
      }
      
      // Mode CSV classique
      this.mode = 'csv'
      const text = await file.text()
      const lines = text.split('\n').filter(l => l.trim())
      
      if (lines.length === 0) {
        throw new Error('Fichier vide')
      }

      // Detect separator
      const separator = this.detectSeparator(lines[0])
      
      // Parse header
      this.columns = lines[0].split(separator).map(c => c.trim().replace(/['"]/g, ''))
      
      // Parse data avec sanitization
      this.data = lines.slice(1).map(line => {
        const values = line.split(separator)
        const row: any = {}
        this.columns.forEach((col, i) => {
          const rawValue = values[i]?.trim().replace(/['"]/g, '') || ''
          row[col] = this.sanitizeCSVCell(rawValue)
        })
        return row
      })

      // Auto-mapping
      this.autoMap()
      
      this.renderStep()
    } catch (error) {
      console.error('Error reading file:', error)
      alert('Erreur lors de la lecture du fichier: ' + (error as Error).message)
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

  private downloadTemplate(type: 'csv' | 'xlsx') {
    if (type === 'csv') {
      const fields = [...this.requiredFields, ...this.optionalFields]
      const header = fields.join(',')
      const example = 'BULK-001,2025-01-10,Lab XYZ,6.1345,1.2123,5.0,45.5,85.2,20.0,38.2,22.1,2.5,18.5,12.3,normal,1.2,Lab A,NF P94-051'

      const csv = `${header}\n${example}\n`
      const blob = new Blob([csv], { type: 'text/csv' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = 'template_atlas_import.csv'
      a.click()
      URL.revokeObjectURL(url)
    } else {
      // Pour XLSX, rediriger vers la documentation
      alert('Pour le template XLSX multi-feuilles, veuillez:\n\n1. Exécuter: python make_atlas_example_xlsx.py\n2. Ou télécharger l\'exemple complet ci-dessous')
    }
  }

  private downloadXLSXExample() {
    // Informer l'utilisateur sur comment générer le fichier exemple
    const message = `
📊 Fichier Excel Exemple

Pour générer le fichier atlas_import_example.xlsx:

1. Ouvrir un terminal dans le dossier atlas/
2. Exécuter: python make_atlas_example_xlsx.py
3. Le fichier atlas_import_example.xlsx sera créé

Le fichier contient:
✅ Feuille sondages (2 sites)
✅ Feuille echantillons (6 échantillons)
✅ Feuille atterberg (WL/WP)
✅ Feuille vbs (Valeur de Bleu)
✅ Feuille proctor (structure)
✅ Feuille granulo_tamisage_large (26 tamis)
✅ Feuille granulo_sedimento_large (24 tamis)

Documentation complète: GUIDE_IMPORT_GEOTECHNIQUE.md
    `.trim()
    
    alert(message)
  }

  private async startImport() {
    const progressFill = document.getElementById('progressFill')
    const progressText = document.getElementById('progressText')
    const log = document.getElementById('importLog')

    if (!progressFill || !progressText || !log) return

    let payload: any

    if (this.mode === 'xlsx_geotech') {
      // Mode XLSX: envoyer les données multi-feuilles
      payload = {
        mode: 'xlsx_geotech',
        ...this.parsed,
        options: { refresh_mv: true }
      }
    } else {
      // Mode CSV: transformer selon le mapping
      const transformedData = this.data.map(row => {
        const transformed: any = {}
        Object.keys(this.mapping).forEach(field => {
          const column = this.mapping[field]
          transformed[field] = row[column]
        })
        return transformed
      })
      
      payload = {
        mode: 'csv',
        data: transformedData
      }
    }

    // Send to API
    try {
      console.log('[IMPORT] Mode:', this.mode)
      console.log('[IMPORT] Payload:', payload)
      
      let response: Response
      
      if (this.mode === 'xlsx_geotech') {
        // Mode XLSX: envoyer le fichier brut en multipart/form-data
        if (!this.file) {
          throw new Error('Fichier non disponible')
        }
        
        // SOLUTION DÉFINITIVE : structure contient sheets ET mapping
        const structure = {
          sheets: {
            sondages: 'sondages',
            echantillons: 'echantillons',
            atterberg: 'atterberg',
            vbs: 'vbs',
            proctor: 'proctor',
            granulo_tamisage_large: 'granulo_tamisage_large',
            granulo_sedimento_large: 'granulo_sedimento_large'
          },
          mapping: {
            sondages: {
              code: 'code_site',
              localite: 'localite',
              date: 'date',
              source: 'source',
              lat: 'lat',
              lon: 'lon'
            },
            echantillons: {
              code: 'code_site',
              depth_m: 'depth_m',
              date: 'date',
              laboratory: 'laboratory',
              rho_s_gcm3: 'rho_s_gcm3',
              water_content_w: 'water_content_w',
              is_index: 'is_index'
            },
            atterberg: {
              code: 'code_site',
              depth_m: 'depth_m',
              wl: 'wl',
              wp: 'wp'
            },
            vbs: {
              code: 'code_site',
              depth_m: 'depth_m',
              vbs: 'vbs',
              commentaire: 'commentaire'
            },
            proctor: {
              code: 'code_site',
              depth_m: 'depth_m',
              rho_d_max: 'rho_d_max',
              w_opt: 'w_opt'
            },
            granulo_tamisage_large: {
              sieve_key: 'sieve_mm',
              series_pattern: '@',
              value_semantics: 'passant_%'
            },
            granulo_sedimento_large: {
              sieve_key: 'sieve_mm',
              series_pattern: '@',
              value_semantics: 'passant_%'
            }
          }
        }
        
        // Payload final : format + structure (qui contient sheets + mapping) + options
        const requestPayload = {
          format: 'xlsx',
          structure,  // structure contient sheets ET mapping
          options: { refresh_mv: true }
        }
        
        // Envoi avec fallbacks pour supporter tous les contrats backend
        console.log('[IMPORT] Envoi fichier XLSX:', this.file.name, this.file.size, 'bytes')
        const result = await this.postWithFallbacks()
        
        if (!result.ok) {
          throw new Error(`Import échoué: ${result.text}`)
        }
        
        console.log('[IMPORT] Succès:', result.text)
        response = { ok: true, json: async () => JSON.parse(result.text) } as Response
      } else {
        // Mode CSV: envoyer les données JSON
        console.log('[IMPORT] Envoi données CSV JSON')
        
        response = await fetch(`${this.apiUrl}/import/bulk`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        })
      }

      if (!response.ok) {
        const errorText = await response.text()
        console.error('[IMPORT] Erreur HTTP:', response.status, errorText)
        throw new Error(`HTTP ${response.status}: ${errorText}`)
      }

      const result = await response.json()
      console.log('[IMPORT] Résultat:', result)

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

  private parseSelectedSheets() {
    if (!this.workbook) {
      alert('⚠️ Aucun classeur chargé')
      return false
    }

    // Vérifier que sondages est sélectionné
    if (!this.sheetMap.sondages) {
      alert('⚠️ La feuille "Sondages" est obligatoire')
      return false
    }

    this.parsed = {}
    
    // Parser chaque feuille sélectionnée
    Object.entries(this.sheetMap).forEach(([role, sheetName]) => {
      if (!sheetName || !this.workbook) return
      
      const worksheet = this.workbook.getWorksheet(sheetName)
      if (!worksheet) return
      
      // Extraire les données avec ExcelJS
      const rows: any[] = []
      const headers: string[] = []
      
      worksheet.eachRow((row, rowNumber) => {
        if (rowNumber === 1) {
          // Première ligne = en-têtes
          row.eachCell((cell, colNumber) => {
            headers[colNumber - 1] = String(cell.value || '').toLowerCase().trim().replace(/\s+/g, '_')
          })
        } else {
          // Lignes de données
          const rowData: any = {}
          row.eachCell((cell, colNumber) => {
            const header = headers[colNumber - 1]
            if (header) {
              let value = cell.value
              
              // Gérer les dates Excel
              if (cell.type === ExcelJS.ValueType.Date && value instanceof Date) {
                value = value.toISOString().split('T')[0] // Format YYYY-MM-DD
              }
              
              rowData[header] = this.sanitizeCSVCell(String(value || ''))
            }
          })
          
          // N'ajouter que les lignes non vides
          if (Object.keys(rowData).length > 0) {
            rows.push(rowData)
          }
        }
      })
      
      this.parsed[role as SheetRole] = rows
    })

    return true
  }

  private nextStep() {
    // Validation before next
    if (this.currentStep === 0 && !this.file) {
      alert('⚠️ Veuillez sélectionner un fichier')
      return
    }

    // Étape 1: Mode XLSX = sélection des feuilles
    if (this.currentStep === 1 && this.mode === 'xlsx_geotech') {
      if (!this.parseSelectedSheets()) {
        return
      }
      // Passer directement à l'aperçu (étape 3) pour XLSX
      this.currentStep = 3
      this.render()
      return
    }

    // Étape 1: Mode CSV = mapping
    if (this.currentStep === 1 && this.mode === 'csv') {
      const missingRequired = this.requiredFields.filter(f => !this.mapping[f])
      if (missingRequired.length > 0) {
        alert(`⚠️ Champs requis manquants:\n\n${missingRequired.join(', ')}`)
        return
      }
    }

    if (this.currentStep === 2) {
      // Check validation errors
      const errors = this.requiredFields.filter(f => !this.mapping[f])
      if (errors.length > 0) {
        alert('⚠️ Veuillez corriger les erreurs avant de continuer')
        return
      }
    }

    if (this.currentStep === 3) {
      // Bloquer si erreurs de validation
      if (this.mode === 'csv') {
        const validation = this.validateAllData()
        if (validation.errors.length > 0) {
          alert(`⛔ Import bloqué!\n\n${validation.errors.length} erreur(s) détectée(s).\n\nCorrigez les erreurs dans votre fichier et réessayez.`)
          return
        }
        
        // Confirmer si warnings
        if (validation.warnings.length > 0) {
          const proceed = confirm(
            `⚠️ ${validation.warnings.length} avertissement(s) détecté(s).\n\n` +
            `Voulez-vous continuer l'import malgré tout?\n\n` +
            `(Consultez l'aperçu pour plus de détails)`
          )
          if (!proceed) return
        }
      } else {
        // Mode XLSX: validation basique
        if (!this.parsed.sondages || this.parsed.sondages.length === 0) {
          alert('⛔ Aucune donnée dans la feuille Sondages')
          return
        }
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

  private showToast(message: string) {
    // Simple toast notification
    const toast = document.createElement('div')
    toast.style.cssText = 'position: fixed; top: 20px; right: 20px; background: #1e293b; color: #94a3b8; padding: 1rem 1.5rem; border-radius: 8px; box-shadow: 0 4px 12px rgba(0,0,0,0.3); z-index: 10000; border-left: 4px solid #3b82f6;'
    toast.textContent = message
    document.body.appendChild(toast)
    setTimeout(() => toast.remove(), 5000)
  }

  private autodetectSheetRoles(names: string[]): XlsxSheets {
    const find = (...aliases: string[]) =>
      names.find(n => aliases.some(a => n.toLowerCase().includes(a)))

    return {
      sondages: find('sond', 'sites', 'site', 'survey'),
      echantillons: find('echant', 'sample', 'prelevement'),
      atterberg: find('atter', 'wl', 'wp', 'ip', 'limite'),
      vbs: find('vbs', 'bleu', 'methylene'),
      proctor: find('proctor', 'gamma', 'wopt', 'compactage'),
      granulo_tamisage_large: find('granulo', 'tamis', 'tamisage', 'sieve'),
      granulo_sedimento_large: find('sedim', 'sedimenta', 'hydro'),
    }
  }

  /**
   * Initialise le mapping XLSX avec détection automatique des colonnes
   */
  private initializeXlsxMapping(): void {
    const col = this.columnsBySheet
    
    // Fonction helper pour chercher une colonne dans une feuille
    const pick = (sheet: string | undefined, name: string): string | null => {
      if (!sheet || !col[sheet]) return null
      return col[sheet].includes(name) ? name : null
    }

    const s = this.sheetMap

    this.xlsxMapping = {
      sondages: {
        code: pick(s.sondages, 'code_site') ?? pick(s.sondages, 'code') ?? null,
        localite: pick(s.sondages, 'localite'),
        date: pick(s.sondages, 'date'),
        lat: pick(s.sondages, 'lat'),
        lon: pick(s.sondages, 'lon'),
        source: pick(s.sondages, 'source'),
        adm1: pick(s.sondages, 'adm1'),
        adm2: pick(s.sondages, 'adm2'),
        adm3: pick(s.sondages, 'adm3')
      },
      echantillons: {
        code: pick(s.echantillons, 'code_site') ?? pick(s.echantillons, 'code') ?? null,
        depth_m: pick(s.echantillons, 'depth_m'),
        date: pick(s.echantillons, 'date'),
        laboratory: pick(s.echantillons, 'laboratory'),
        rho_s_gcm3: pick(s.echantillons, 'rho_s_gcm3'),
        water_content_w: pick(s.echantillons, 'water_content_w'),
        is_index: pick(s.echantillons, 'is_index'),
        commentaire: pick(s.echantillons, 'commentaire')
      },
      atterberg: {
        code: pick(s.atterberg, 'code_site') ?? pick(s.atterberg, 'code') ?? null,
        depth_m: pick(s.atterberg, 'depth_m'),
        wl: pick(s.atterberg, 'wl'),
        wp: pick(s.atterberg, 'wp')
      },
      vbs: {
        code: pick(s.vbs, 'code_site') ?? pick(s.vbs, 'code') ?? null,
        depth_m: pick(s.vbs, 'depth_m'),
        vbs: pick(s.vbs, 'vbs'),
        commentaire: pick(s.vbs, 'commentaire')
      },
      proctor: {
        code: pick(s.proctor, 'code_site') ?? pick(s.proctor, 'code') ?? null,
        depth_m: pick(s.proctor, 'depth_m'),
        rho_d_max: pick(s.proctor, 'rho_d_max'),
        w_opt: pick(s.proctor, 'w_opt'),
        proctor_type: pick(s.proctor, 'proctor_type')
      },
      granulo_tamisage_large: {
        sieve_key: 'sieve_mm',
        series_pattern: '@',
        value_semantics: 'passant_%'
      },
      granulo_sedimento_large: {
        sieve_key: 'sieve_mm',
        series_pattern: '@',
        value_semantics: 'passant_%'
      }
    }

    console.log('[WZ] Mapping XLSX initialisé:', this.xlsxMapping)
  }

  /**
   * CRITIQUE : Extraire les en-têtes de chaque feuille Excel
   * Utilise cell.text pour obtenir le texte lisible (pas cell.value)
   */
  private extractHeaders(workbook: ExcelJS.Workbook): void {
    this.columnsBySheet = {}

    for (const ws of workbook.worksheets) {
      // Ignorer les feuilles vides
      if (!ws || ws.rowCount === 0) {
        this.columnsBySheet[ws.name] = []
        continue
      }

      const headers: string[] = []
      const headerRow = ws.getRow(1)

      // Utiliser cell.text pour obtenir le texte lisible
      for (let c = 1; c <= headerRow.cellCount; c++) {
        const cell = headerRow.getCell(c)
        const raw = (cell.text ?? '').trim()
        
        if (!raw) continue

        // Normalisation douce : garder @ et . pour les colonnes granulo
        const key = raw
          .replace(/\s+/g, '_')      // espaces → underscore
          .replace(/[;,:]/g, '_')    // ponctuation fréquente
          .toLowerCase()             // tout en minuscule

        headers.push(key)
      }

      this.columnsBySheet[ws.name] = headers
    }

    // Log pour debug
    console.log('[WZ] HEADERS PAR FEUILLE =', this.columnsBySheet)
    
    // Afficher le nombre total de colonnes détectées
    const totalCols = Object.values(this.columnsBySheet).reduce((sum, cols) => sum + cols.length, 0)
    console.log(`[WZ] Total: ${totalCols} colonnes détectées dans ${Object.keys(this.columnsBySheet).length} feuilles`)
  }

  /**
   * Vérifie que le mapping minimal est présent (sondages requis)
   */
  private hasMinimalMapping(): boolean {
    const s = this.xlsxMapping?.sondages || {}
    return !!(s.code && s.localite && s.date && s.lat && s.lon)
  }

  /**
   * Construction commune du payload (structure + mapping + options)
   */
  private buildCommon() {
    const structure = {
      sheets: {
        sondages: this.sheetMap.sondages || 'sondages',
        echantillons: this.sheetMap.echantillons || 'echantillons',
        atterberg: this.sheetMap.atterberg || 'atterberg',
        vbs: this.sheetMap.vbs || 'vbs',
        proctor: this.sheetMap.proctor || 'proctor',
        granulo_tamisage_large: this.sheetMap.granulo_tamisage_large || 'granulo_tamisage_large',
        granulo_sedimento_large: this.sheetMap.granulo_sedimento_large || 'granulo_sedimento_large'
      }
    }

    // Utiliser le mapping XLSX initialisé (peut être modifié par l'utilisateur à l'étape 3)
    const mapping = this.xlsxMapping

    const options = { refresh_mv: true }

    return { structure, mapping, options }
  }

  /**
   * Génère les 2 variantes de payload (A et B)
   */
  private buildConfigVariants() {
    const { structure, mapping, options } = this.buildCommon()

    // Variante A: mapping au top-level
    const A = {
      format: 'xlsx',
      structure,
      mapping,
      options
    }

    // Variante B: mapping imbriqué dans structure
    const B = {
      format: 'xlsx',
      structure: { ...structure, mapping },
      options
    }

    return { A, B }
  }

  /**
   * Envoie une variante de payload (3 modes: config, payload, ou champs séparés)
   */
  private async sendMultipart(variant: any, jsonField: 'config' | 'payload' | null): Promise<{ok: boolean, status: number, text: string}> {
    const fd = new FormData()
    fd.append('file', this.file!)

    if (jsonField) {
      // Mode A/B: tout dans un seul champ JSON
      fd.append(jsonField, JSON.stringify(variant))
    } else {
      // Mode C: champs séparés (certains backends attendent ça)
      fd.append('format', 'xlsx')
      fd.append('structure', JSON.stringify(variant.structure))
      if (variant.mapping) fd.append('mapping', JSON.stringify(variant.mapping))
      if (variant.options) fd.append('options', JSON.stringify(variant.options))
    }

    const res = await fetch(`${this.apiUrl}/import/bulk`, { method: 'POST', body: fd })
    const text = await res.text().catch(() => '')
    console.log('[WZ] RESP', res.status, text.substring(0, 200))

    return { ok: res.ok, status: res.status, text }
  }

  /**
   * Essaie successivement toutes les variantes jusqu'à succès (6 combinaisons)
   */
  private async postWithFallbacks(): Promise<{ok: boolean, status: number, text: string}> {
    const { A, B } = this.buildConfigVariants()

    const tries: Array<[any, 'config' | 'payload' | null, string]> = [
      [A, 'config',  'A as config'],
      [B, 'config',  'B as config'],
      [A, 'payload', 'A as payload'],
      [B, 'payload', 'B as payload'],
      [A, null,      'A split fields'],
      [B, null,      'B split fields']
    ]

    for (const [v, field, tag] of tries) {
      console.log('[WZ] TRY', tag, v)
      const r = await this.sendMultipart(v, field)
      if (r.ok) {
        console.log('[WZ] ✅ SUCCESS with', tag)
        return r
      }
    }

    throw new Error('Import échoué après 6 variantes. Voir console pour les détails serveur.')
  }

  private sanitizeCSVCell(value: string): string {
    // Neutraliser les formules Excel (CSV injection)
    if (!value) return value
    const dangerous = /^[=+\-@]/
    if (dangerous.test(value.trim())) {
      return "'" + value  // Préfixer avec apostrophe
    }
    return value
  }

  private validateRow(row: any, rowIndex: number): { errors: string[], warnings: string[] } {
    const errors: string[] = []
    const warnings: string[] = []

    // Validation géocodage
    const lat = parseFloat(row[this.mapping['lat']])
    const lon = parseFloat(row[this.mapping['lon']])
    
    if (isNaN(lat) || lat < -90 || lat > 90) {
      errors.push(`Ligne ${rowIndex}: latitude invalide (${row[this.mapping['lat']]})`)
    }
    if (isNaN(lon) || lon < -180 || lon > 180) {
      errors.push(`Ligne ${rowIndex}: longitude invalide (${row[this.mapping['lon']]})`)
    }

    // Validation profondeur
    const depth = parseFloat(row[this.mapping['depth_m']])
    if (isNaN(depth) || depth < 0) {
      errors.push(`Ligne ${rowIndex}: profondeur invalide (${row[this.mapping['depth_m']]})`)
    }

    // Validation Atterberg (wl >= wp)
    if (this.mapping['wl'] && this.mapping['wp']) {
      const wl = parseFloat(row[this.mapping['wl']])
      const wp = parseFloat(row[this.mapping['wp']])
      if (!isNaN(wl) && !isNaN(wp) && wl < wp) {
        errors.push(`Ligne ${rowIndex}: WL (${wl}) < WP (${wp})`)
      }
      // Calculer IP si manquant
      if (!isNaN(wl) && !isNaN(wp) && !row[this.mapping['ip']]) {
        row[this.mapping['ip']] = (wl - wp).toFixed(1)
      }
    }

    // Validation passants (monotonie)
    const passants = ['passant_80um', 'passant_2mm', 'passant_20mm']
      .filter(p => this.mapping[p])
      .map(p => ({ name: p, value: parseFloat(row[this.mapping[p]]) }))
      .filter(p => !isNaN(p.value))

    for (let i = 1; i < passants.length; i++) {
      if (passants[i].value < passants[i-1].value) {
        warnings.push(`Ligne ${rowIndex}: passants non monotones (${passants[i-1].name}=${passants[i-1].value} > ${passants[i].name}=${passants[i].value})`)
      }
    }

    // Validation bornes
    Object.entries(this.validationRules).forEach(([field, bounds]) => {
      if (this.mapping[field]) {
        const value = parseFloat(row[this.mapping[field]])
        if (!isNaN(value) && (value < bounds.min || value > bounds.max)) {
          warnings.push(`Ligne ${rowIndex}: ${field}=${value} hors bornes [${bounds.min}, ${bounds.max}]`)
        }
      }
    })

    return { errors, warnings }
  }

  private validateAllData(): { errors: string[], warnings: string[], summary: any } {
    const allErrors: string[] = []
    const allWarnings: string[] = []
    
    // Limiter à 100 erreurs max
    let errorCount = 0
    const MAX_ERRORS = 100

    this.data.forEach((row, index) => {
      if (errorCount >= MAX_ERRORS) return
      
      const { errors, warnings } = this.validateRow(row, index + 2) // +2 car ligne 1 = header
      allErrors.push(...errors)
      allWarnings.push(...warnings)
      errorCount += errors.length
    })

    if (errorCount >= MAX_ERRORS) {
      allErrors.push(`⚠️ Plus de ${MAX_ERRORS} erreurs détectées. Validation arrêtée.`)
    }

    // Calculer le résumé
    const summary = {
      total_rows: this.data.length,
      unique_codes: new Set(this.data.map(r => r[this.mapping['code']])).size,
      has_atterberg: this.data.filter(r => r[this.mapping['wl']] || r[this.mapping['wp']]).length,
      has_vbs: this.data.filter(r => r[this.mapping['vbs']]).length,
      has_proctor: this.data.filter(r => r[this.mapping['gamma_d_max']]).length,
      has_granulo: this.data.filter(r => r[this.mapping['passant_80um']] || r[this.mapping['passant_2mm']]).length
    }

    return { errors: allErrors, warnings: allWarnings, summary }
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
