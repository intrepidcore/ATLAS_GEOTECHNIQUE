// Import Wizard v2.3.0 - Composant complet 5 steps

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

export class ImportWizardV2 {
  private container: HTMLElement
  private apiUrl: string
  private currentStep: number = 1
  private session: ImportSession | null = null
  private file: File | null = null
  private mapping: Record<string, string> = {}
  private geometryConfig: any = {}
  private previewData: any = null

  constructor(containerId: string, apiUrl: string) {
    const el = document.getElementById(containerId)
    if (!el) throw new Error(`Container ${containerId} not found`)
    this.container = el
    this.apiUrl = apiUrl
  }

  public open() {
    console.log('[WIZARD] Ouverture Import Wizard v2.3.0')
    this.currentStep = 1
    this.render()
    this.container.style.display = 'block'
  }

  public close() {
    this.container.style.display = 'none'
    this.reset()
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
            ${this.currentStep > 1 ? '<button class="btn" id="wizardPrev">← Précédent</button>' : ''}
            <div style="flex:1"></div>
            ${this.currentStep < 5 ? '<button class="btn primary" id="wizardNext">Suivant →</button>' : ''}
            ${this.currentStep === 5 ? '<button class="btn primary" id="wizardImport">🚀 Importer</button>' : ''}
          </div>
        </div>
      </div>
    `

    this.attachEventListeners()
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
        <div class="progress-circle">${step.num}</div>
        <div class="progress-label">${step.label}</div>
      </div>
    `).join('<div class="progress-line"></div>')
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
                <option value="auto">Auto-détection</option>
                <option value=",">,  (virgule)</option>
                <option value=";">; (point-virgule)</option>
                <option value="\t">Tab</option>
              </select>
            </div>
            <div class="form-field">
              <label>Décimal</label>
              <select id="decimal">
                <option value=".">. (point)</option>
                <option value=",">, (virgule)</option>
              </select>
            </div>
            <div class="form-field">
              <label>Ignorer lignes</label>
              <input type="number" id="skipRows" value="0" min="0">
            </div>
          </div>
        </details>
      </div>
    `
  }

  // ============================================================================
  // STEP 2: Mapping & Presets
  // ============================================================================
  private renderStep2Mapping(): string {
    return `
      <div class="step-mapping">
        <div class="presets-section">
          <h4>🎯 Presets Atlas (1 clic)</h4>
          <div class="presets-grid">
            <button class="preset-btn active" data-preset="sondages">Sondages complets</button>
            <button class="preset-btn" data-preset="atterberg">Atterberg seul</button>
            <button class="preset-btn" data-preset="vbs">VBS seul</button>
            <button class="preset-btn" data-preset="custom">Custom</button>
          </div>
        </div>

        <div class="preview-section">
          <h4>📊 Aperçu fichier (5 premières lignes)</h4>
          <div class="table-container">
            <table class="preview-table">
              <thead>
                <tr>
                  <th>code_site</th>
                  <th>localite</th>
                  <th>lon</th>
                  <th>lat</th>
                  <th>wl</th>
                  <th>wp</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>S-001</td>
                  <td>Lomé</td>
                  <td>1.2345</td>
                  <td>6.123</td>
                  <td>45</td>
                  <td>22</td>
                </tr>
                <tr>
                  <td>S-002</td>
                  <td>Kara</td>
                  <td>1.1890</td>
                  <td>9.551</td>
                  <td>38</td>
                  <td>19</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="mapping-section">
          <h4>🔗 Correspondances</h4>
          <div class="mapping-table">
            ${this.renderMappingRows()}
          </div>
        </div>

        <div class="conflict-section">
          <h4>⚔️ Politique de conflit</h4>
          <div class="radio-group">
            <label>
              <input type="radio" name="conflict" value="skip"> 
              Skip (ignorer les doublons)
            </label>
            <label>
              <input type="radio" name="conflict" value="update" checked> 
              Update (MAJ si plus récent)
            </label>
            <label>
              <input type="radio" name="conflict" value="duplicate"> 
              Duplicate (créer doublon avec suffixe)
            </label>
          </div>
        </div>
      </div>
    `
  }

  private renderMappingRows(): string {
    const fields = [
      { atlas: 'Code sondage', file: 'code_site', type: '📝 Texte' },
      { atlas: 'Localité', file: 'localite', type: '📝 Texte' },
      { atlas: 'Date', file: 'date', type: '📅 Date' },
      { atlas: 'Longitude', file: 'lon', type: '🔢 Nombre' },
      { atlas: 'Latitude', file: 'lat', type: '🔢 Nombre' },
      { atlas: 'Profondeur (m)', file: 'depth_m', type: '🔢 Nombre' },
      { atlas: 'WL (%)', file: 'wl', type: '🔢 Nombre' },
      { atlas: 'WP (%)', file: 'wp', type: '🔢 Nombre' },
      { atlas: 'VBS', file: 'vbs', type: '🔢 Nombre' },
    ]

    return fields.map(f => `
      <div class="mapping-row">
        <div class="mapping-atlas">${f.atlas}</div>
        <div class="mapping-arrow">←</div>
        <select class="mapping-select" data-atlas="${f.atlas}">
          <option value="">— Non mappé —</option>
          <option value="${f.file}" selected>${f.file}</option>
        </select>
        <div class="mapping-type">${f.type}</div>
      </div>
    `).join('')
  }

  // ============================================================================
  // STEP 3: Géométrie & CRS
  // ============================================================================
  private renderStep3Geometry(): string {
    return `
      <div class="step-geometry">
        <div class="geometry-mode">
          <h4>🌍 Mode géométrique</h4>
          <div class="radio-group">
            <label>
              <input type="radio" name="geoMode" value="lonlat" checked>
              Point (Lon/Lat)
            </label>
            <label>
              <input type="radio" name="geoMode" value="xy">
              Point (X/Y)
            </label>
            <label>
              <input type="radio" name="geoMode" value="utm">
              Point (E/N - UTM)
            </label>
            <label>
              <input type="radio" name="geoMode" value="wkt">
              WKT/EWKT
            </label>
            <label>
              <input type="radio" name="geoMode" value="none">
              Pas de géométrie
            </label>
          </div>
        </div>

        <div class="crs-section">
          <h4>📐 Système de coordonnées d'entrée</h4>
          <select id="crsInput" class="input">
            <option value="EPSG:4326" selected>EPSG:4326 - WGS 84</option>
            <option value="EPSG:25231">EPSG:25231 - UTM Zone 31N (Togo)</option>
            <option value="EPSG:32631">EPSG:32631 - WGS 84 / UTM 31N</option>
            <option value="EPSG:2043">EPSG:2043 - Abidjan 1987 / UTM 31N</option>
          </select>
          
          <div class="crs-info">
            <p>🔄 Reprojection automatique vers EPSG:25231 (UTM 31N Togo)</p>
          </div>
        </div>

        <div class="validation-section">
          <h4>⚠️ Validation géographique</h4>
          <label class="checkbox-label">
            <input type="checkbox" id="validateBbox" checked>
            Vérifier limites Togo (bbox)
          </label>
          <label class="checkbox-label">
            <input type="checkbox" id="rejectInvalid" checked>
            Rejeter coordonnées invalides (0,0 ou NULL)
          </label>
        </div>

        <div class="map-preview">
          <h4>🗺️ Aperçu (5 premiers points)</h4>
          <div id="previewMap" style="height:300px;background:#0f172a;border-radius:8px;display:flex;align-items:center;justify-content:center;color:var(--muted)">
            Carte de prévisualisation (à implémenter avec Leaflet)
          </div>
        </div>
      </div>
    `
  }

  // ============================================================================
  // STEP 4: Preview & Validation
  // ============================================================================
  private renderStep4Preview(): string {
    return `
      <div class="step-preview">
        <div class="stats-section">
          <h4>📊 Statistiques (Dry-run)</h4>
          <div class="stats-grid">
            <div class="stat-card success">
              <div class="stat-value">45</div>
              <div class="stat-label">✅ À créer</div>
            </div>
            <div class="stat-card info">
              <div class="stat-value">12</div>
              <div class="stat-label">🔄 À mettre à jour</div>
            </div>
            <div class="stat-card warning">
              <div class="stat-value">3</div>
              <div class="stat-label">⏭️ Ignorés</div>
            </div>
            <div class="stat-card error">
              <div class="stat-value">8</div>
              <div class="stat-label">❌ Erreurs</div>
            </div>
          </div>
        </div>

        <div class="errors-section">
          <h4>❌ Erreurs (8)</h4>
          <div class="errors-table">
            <table>
              <thead>
                <tr>
                  <th>Ligne</th>
                  <th>Colonne</th>
                  <th>Message</th>
                  <th>Solution</th>
                </tr>
              </thead>
              <tbody>
                <tr class="error-row">
                  <td>12</td>
                  <td>wl</td>
                  <td>WL=105 > 100%</td>
                  <td>Corriger valeur (0-100)</td>
                </tr>
                <tr class="error-row">
                  <td>23</td>
                  <td>wp</td>
                  <td>WP=45 > WL=38</td>
                  <td>WP doit être ≤ WL</td>
                </tr>
                <tr class="error-row">
                  <td>34</td>
                  <td>lon</td>
                  <td>Hors limites Togo</td>
                  <td>Vérifier GPS</td>
                </tr>
              </tbody>
            </table>
          </div>
          <button class="btn" id="exportErrors">📥 Exporter erreurs CSV</button>
        </div>

        <div class="warnings-section">
          <h4>⚠️ Avertissements (15)</h4>
          <ul class="warnings-list">
            <li>5 sondages sans coordonnées (géocodage requis)</li>
            <li>10 essais avec VBS=0 (vérifier)</li>
          </ul>
        </div>

        <div class="data-preview">
          <h4>📋 Aperçu données (50 premières lignes)</h4>
          <div class="table-container">
            <table class="preview-table">
              <thead>
                <tr>
                  <th>Code</th>
                  <th>Localité</th>
                  <th>Lon</th>
                  <th>Lat</th>
                  <th>WL</th>
                  <th>WP</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                <tr class="row-create">
                  <td>✅ S-001</td>
                  <td>Lomé</td>
                  <td>1.234</td>
                  <td>6.12</td>
                  <td>45</td>
                  <td>22</td>
                  <td><span class="badge badge-success">Créer</span></td>
                </tr>
                <tr class="row-update">
                  <td>🔄 S-002</td>
                  <td>Kara</td>
                  <td>1.189</td>
                  <td>9.55</td>
                  <td>38</td>
                  <td>19</td>
                  <td><span class="badge badge-info">MAJ</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <div class="recalc-section">
          <label class="checkbox-label">
            <input type="checkbox" id="recalcGrids" checked>
            Recalculer KPI/IDW des mailles impactées
          </label>
        </div>
      </div>
    `
  }

  // ============================================================================
  // STEP 5: Import & Journal
  // ============================================================================
  private renderStep5Import(): string {
    return `
      <div class="step-import">
        <div class="import-progress">
          <h4>🚀 Import en cours...</h4>
          <div class="progress-bar">
            <div class="progress-fill" style="width:75%"></div>
          </div>
          <div class="progress-text">75% (180/240)</div>
        </div>

        <div class="import-stats">
          <div class="stat-line">✅ 45 sondages créés</div>
          <div class="stat-line">🔄 12 sondages mis à jour</div>
          <div class="stat-line">✅ 180 essais créés (sur 234)</div>
          <div class="stat-line">⏱️ Temps écoulé : 12s</div>
          <div class="stat-line">⏱️ Temps restant : ~4s</div>
        </div>

        <div class="import-logs">
          <h4>📝 Logs en temps réel</h4>
          <div class="logs-container">
            <div class="log-line">[14:23:45] Création sondage S-001... ✓</div>
            <div class="log-line">[14:23:46] Création essai WL S-001 @ 1.5m ✓</div>
            <div class="log-line">[14:23:46] Création essai WP S-001 @ 1.5m ✓</div>
            <div class="log-line">[14:23:47] MAJ sondage S-002 (plus récent) ✓</div>
            <div class="log-line">[14:23:48] Recalcul IDW maille TG-0557-0167 ✓</div>
          </div>
        </div>

        <div class="import-success" style="display:none">
          <div class="success-icon">✅</div>
          <h3>Import terminé avec succès !</h3>
          
          <div class="summary-box">
            <h4>📊 Résumé</h4>
            <div class="summary-stats">
              <div>✅ 45 sondages créés</div>
              <div>🔄 12 sondages mis à jour</div>
              <div>⏭️ 3 sondages ignorés</div>
              <div>✅ 234 essais créés</div>
              <div>🔄 15 mailles recalculées</div>
              <div>⏱️ Durée totale : 16s</div>
            </div>
          </div>

          <div class="batch-id">
            <strong>🔖 Batch ID :</strong> #IMP-20251103-142345
          </div>

          <div class="actions-section">
            <button class="btn" id="downloadReport">📄 Télécharger rapport complet</button>
            <button class="btn" id="viewData">📊 Voir les données importées</button>
            <button class="btn" id="undoImport">↩️ Annuler cet import (Undo)</button>
          </div>
        </div>
      </div>
    `
  }

  // ============================================================================
  // Event Listeners
  // ============================================================================
  private attachEventListeners() {
    // Close
    const closeBtn = document.getElementById('wizardClose')
    if (closeBtn) {
      closeBtn.addEventListener('click', () => this.close())
    }

    // Navigation
    const prevBtn = document.getElementById('wizardPrev')
    if (prevBtn) {
      prevBtn.addEventListener('click', () => this.previousStep())
    }

    const nextBtn = document.getElementById('wizardNext')
    if (nextBtn) {
      nextBtn.addEventListener('click', () => this.nextStep())
    }

    // Step 1: Upload
    if (this.currentStep === 1) {
      this.attachStep1Listeners()
    }

    // Step 2: Mapping
    if (this.currentStep === 2) {
      this.attachStep2Listeners()
    }

    // Step 4: Preview
    if (this.currentStep === 4) {
      this.attachStep4Listeners()
    }

    // Step 5: Import
    if (this.currentStep === 5) {
      this.attachStep5Listeners()
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
  }

  private attachStep2Listeners() {
    // Presets
    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        document.querySelectorAll('.preset-btn').forEach(b => b.classList.remove('active'))
        ;(e.target as HTMLElement).classList.add('active')
      })
    })
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
  }

  private async nextStep() {
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

  private async exportErrors() {
    console.log('[WIZARD] Export erreurs CSV')
    // TODO: Implémenter export
  }

  private async undoImport() {
    if (!this.session) return
    
    try {
      const response = await fetch(`${this.apiUrl}/imports/${this.session.id}/undo`, {
        method: 'POST'
      })
      
      if (response.ok) {
        alert('Import annulé avec succès!')
        this.close()
      }
    } catch (error) {
      console.error('[WIZARD] Erreur undo:', error)
    }
  }
}
