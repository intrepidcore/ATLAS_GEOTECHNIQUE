// Module de formulaire géotechnique enrichi - v1.4.0
// Gestion de la saisie complète des essais et classifications

// ============================================================================
// Types et constantes
// ============================================================================

export const TYPES_SOL = [
  'Vertisols et Paravertisols',
  'Ferrugineux Tropicaux et Pseudogley',
  'Hydromorphes',
  'Faiblement Ferralitique',
  'Ferralitique Typique ou Modaux',
  'Ferrugineux Tropicaux Lessivés',
  'Autre'
] as const

export const ANALYSES_QUALITATIVES = [
  'Faible',
  'Moyen',
  'Moyenne',
  'Fort',
  'Forte',
  'Très forte',
  'Elevé',
  'Très élevé',
  'Non gonflant',
  'Gonflant',
  'Peu gonflant',
  'Moyennement gonflant',
  'Très gonflant'
] as const

export const METHODES_CLASSIFICATION = [
  'CHASSAGNEUX D. et al. ;1996',
  'Dakshanamurthy et Raman (1973)',
  'SEED H. (1962)',
  'VIJAYVERGIYA et GHAZZALY 1973',
  'Williams et Donaldson (1980)',
  'Chen (1988)',
  'Autre'
] as const

export const TYPES_ESSAIS = [
  { code: 'Granulometrie', nom: 'Granulométrie (% passant)', categorie: 'Granulometrie', unite: '%' },
  { code: 'BleuMethylene_VBS', nom: 'Valeur au bleu de méthylène (VBS)', categorie: 'Atterberg', unite: 'g/100g' },
  { code: 'Atterberg_WL', nom: 'Limite de liquidité (WL)', categorie: 'Atterberg', unite: '%' },
  { code: 'Atterberg_WP', nom: 'Limite de plasticité (WP)', categorie: 'Atterberg', unite: '%' },
  { code: 'Atterberg_IP', nom: 'Indice de plasticité (IP)', categorie: 'Atterberg', unite: '%' },
  { code: 'PotentielGonflement_eg', nom: 'Potentiel de gonflement (eg)', categorie: 'Gonflement', unite: '%' },
  { code: 'Analyse_Bleu', nom: 'Analyse qualitative VBS', categorie: 'Atterberg', unite: null },
  { code: 'Analyse_Atterberg', nom: 'Analyse qualitative Atterberg', categorie: 'Atterberg', unite: null },
  { code: 'Analyse_Gonflement', nom: 'Analyse qualitative gonflement', categorie: 'Gonflement', unite: null }
] as const

export interface MesureData {
  type: string
  valeur_numerique?: number
  valeur_qualitative?: string
  unit?: string
  meta?: { sieve_mm?: number }
}

export interface EssaiProfondeurData {
  profondeur_m: number
  mesures: MesureData[]
}

export interface ClassificationData {
  methode: string
  resultat: string
  notes?: string
}

export interface ClassificationProfondeurData {
  profondeur_m: number
  analyses: ClassificationData[]
}

export interface SurveyGeotechData {
  survey: {
    code?: string
    date?: string
    source?: string
    operator?: string
    notes?: string
    type_sol?: string
  }
  location?: { lon: number; lat: number }
  commune_id?: string
  use_commune_centroid?: boolean
  essais_par_profondeur: EssaiProfondeurData[]
  classifications_par_profondeur?: ClassificationProfondeurData[]
  snap_to_grid?: boolean
}

// ============================================================================
// Gestionnaire de formulaire
// ============================================================================

export class GeotechnicalFormManager {
  private profondeurs: Set<number> = new Set()
  private essaisData: Map<number, MesureData[]> = new Map()
  private classificationsData: Map<number, ClassificationData[]> = new Map()
  
  constructor(
    private apiGeoUrl: string,
    private onSuccess: (response: any) => void,
    private onError: (error: string) => void
  ) {}

  // Initialiser le formulaire dans un conteneur
  initForm(containerId: string) {
    const container = document.getElementById(containerId)
    if (!container) {
      console.error(`Container #${containerId} not found`)
      return
    }

    container.innerHTML = this.renderFormHTML()
    container.classList.add('active')
    this.attachEventListeners()
    
    // Fermer au clic sur l'overlay
    container.addEventListener('click', (e) => {
      if (e.target === container) {
        this.closeForm(containerId)
      }
    })
  }

  private closeForm(containerId: string) {
    const container = document.getElementById(containerId)
    if (container) {
      container.classList.remove('active')
      setTimeout(() => container.innerHTML = '', 300)
    }
  }

  private renderFormHTML(): string {
    return `
      <div class="geotech-form">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 24px;">
          <h2 style="margin: 0;">🧪 Nouveau Sondage Géotechnique</h2>
          <button id="gt-close" style="background: transparent; border: none; color: #8aa0b5; font-size: 32px; cursor: pointer; line-height: 1;">&times;</button>
        </div>
        
        <!-- Partie 1: Informations générales -->
        <div class="form-section">
          <h3>1. Informations Générales</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="gt-code">Code Sondage</label>
              <input type="text" id="gt-code" placeholder="Ex: SND-ADJ-2024-001">
            </div>
            <div class="form-group">
              <label for="gt-date">Date</label>
              <input type="date" id="gt-date">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="gt-type-sol">Type de Sol</label>
              <select id="gt-type-sol">
                <option value="">-- Sélectionner --</option>
                ${TYPES_SOL.map(t => `<option value="${t}">${t}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label for="gt-source">Source</label>
              <input type="text" id="gt-source" placeholder="Ex: Laboratoire X">
            </div>
          </div>
          
          <div class="form-row">
            <div class="form-group">
              <label for="gt-operator">Opérateur</label>
              <input type="text" id="gt-operator" placeholder="Nom de l'opérateur">
            </div>
            <div class="form-group">
              <label for="gt-notes">Notes</label>
              <textarea id="gt-notes" rows="2" placeholder="Notes additionnelles"></textarea>
            </div>
          </div>
        </div>

        <!-- Partie 1.5: Mode de Localisation -->
        <div class="form-section">
          <h3>1.5 Mode de Localisation</h3>
          
          <div class="form-row">
            <div class="form-group">
              <label for="gt-location-mode">Mode <span style="color:#ff4444;">*</span></label>
              <select id="gt-location-mode" required>
                <option value="exact">📍 Coordonnées exactes (GPS)</option>
                <option value="unknown">❓ Position inconnue (ADM uniquement)</option>
                <option value="centroid">🎯 Centroïde de la zone ADM</option>
                <option value="random">🎲 Point aléatoire dans la zone ADM</option>
              </select>
            </div>
          </div>
          
          <!-- Sélection ADM (visible si mode != exact) -->
          <div id="gt-adm-section" style="display: none;">
            <div class="form-row">
              <div class="form-group">
                <label for="gt-adm-level">Niveau ADM <span style="color:#ff4444;">*</span></label>
                <select id="gt-adm-level">
                  <option value="">-- Sélectionner --</option>
                  <option value="ADM1">Région (ADM1)</option>
                  <option value="ADM2">Préfecture (ADM2)</option>
                  <option value="ADM3">Commune (ADM3)</option>
                </select>
              </div>
              <div class="form-group">
                <label for="gt-adm-id">Zone ADM <span style="color:#ff4444;">*</span></label>
                <select id="gt-adm-id">
                  <option value="">-- Sélectionner le niveau d'abord --</option>
                </select>
              </div>
            </div>
            
            <div class="alert alert-info" id="gt-location-warning" style="display: none; padding: 12px; background: #1e3a5f; border-left: 4px solid #3aa6ff; border-radius: 4px; margin-top: 12px;">
              <strong style="color: #3aa6ff;">ℹ️ Information :</strong>
              <span id="gt-location-warning-text" style="color: #c9d7e3; margin-left: 8px;"></span>
            </div>
          </div>
        </div>

        <!-- Partie 2: Localisation -->
        <div class="form-section" id="gt-localisation-section">
          <h3>2. Localisation</h3>
          <div style="margin-bottom: 12px;">
            <button type="button" id="gt-select-on-map" class="btn-secondary" style="width: 100%;">
              🗺️ Sélectionner une maille sur la carte
            </button>
            <div id="gt-selected-maille" style="margin-top: 8px; padding: 8px; background: #0b1220; border-radius: 4px; display: none;">
              <strong style="color: #3aa6ff;">Maille sélectionnée:</strong> <span id="gt-maille-code"></span>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label for="gt-lon">Longitude</label>
              <input type="number" id="gt-lon" step="0.000001" placeholder="Ex: 1.084">
            </div>
            <div class="form-group">
              <label for="gt-lat">Latitude</label>
              <input type="number" id="gt-lat" step="0.000001" placeholder="Ex: 8.592">
            </div>
          </div>
        </div>

        <!-- Partie 3: Gestion des profondeurs -->
        <div class="form-section">
          <h3>3. Profondeurs</h3>
          <div class="form-row">
            <div class="form-group">
              <label for="gt-profondeur">Ajouter une profondeur (m)</label>
              <input type="number" id="gt-profondeur" step="0.1" min="0" placeholder="Ex: 1.0">
            </div>
            <button type="button" id="gt-add-profondeur" class="btn-secondary">Ajouter</button>
          </div>
          <div id="gt-profondeurs-list" class="profondeurs-list"></div>
        </div>

        <!-- Partie 4: Saisie des essais (onglets dynamiques) -->
        <div class="form-section" id="gt-essais-section" style="display: none;">
          <h3>4. Essais par Profondeur</h3>
          <div id="gt-essais-tabs" class="tabs"></div>
          <div id="gt-essais-content" class="tabs-content"></div>
        </div>

        <!-- Partie 5: Classifications -->
        <div class="form-section" id="gt-classifications-section" style="display: none;">
          <h3>5. Classifications Géotechniques</h3>
          <div id="gt-classifications-tabs" class="tabs"></div>
          <div id="gt-classifications-content" class="tabs-content"></div>
        </div>

        <!-- Actions -->
        <div class="form-actions">
          <button type="button" id="gt-submit" class="btn-primary">Enregistrer le Sondage</button>
          <button type="button" id="gt-reset" class="btn-secondary">Réinitialiser</button>
        </div>
      </div>
    `
  }

  private attachEventListeners() {
    // Bouton fermer
    const closeBtn = document.getElementById('gt-close')
    closeBtn?.addEventListener('click', () => this.closeForm('geotechFormContainer'))
    
    // Mode de localisation
    const locationModeSelect = document.getElementById('gt-location-mode') as HTMLSelectElement
    locationModeSelect?.addEventListener('change', () => {
      const mode = locationModeSelect.value
      const admSection = document.getElementById('gt-adm-section')
      const locSection = document.getElementById('gt-localisation-section')
      const warning = document.getElementById('gt-location-warning')
      const warningText = document.getElementById('gt-location-warning-text')
      
      if (mode === 'exact') {
        // Mode exact: afficher lon/lat, masquer ADM
        if (admSection) admSection.style.display = 'none'
        if (locSection) locSection.style.display = 'block'
        if (warning) warning.style.display = 'none'
      } else {
        // Autres modes: afficher ADM
        if (admSection) admSection.style.display = 'block'
        if (locSection) locSection.style.display = mode === 'unknown' ? 'none' : 'block'
        if (warning) warning.style.display = 'block'
        
        // Messages d'avertissement
        const messages: Record<string, string> = {
          unknown: 'Le sondage sera créé sans coordonnées. Vous pourrez le géocoder ultérieurement.',
          centroid: 'Le sondage sera placé au centroïde de la zone ADM. Vous pourrez le géocoder avec des coordonnées exactes ultérieurement.',
          random: 'Le sondage sera placé aléatoirement dans la zone ADM. Vous pourrez le géocoder avec des coordonnées exactes ultérieurement.'
        }
        if (warningText) warningText.textContent = messages[mode] || ''
      }
    })
    
    // Charger les zones ADM selon le niveau
    const admLevelSelect = document.getElementById('gt-adm-level') as HTMLSelectElement
    admLevelSelect?.addEventListener('change', async () => {
      const level = admLevelSelect.value
      const admIdSelect = document.getElementById('gt-adm-id') as HTMLSelectElement
      
      if (!level || !admIdSelect) return
      
      admIdSelect.innerHTML = '<option value="">Chargement...</option>'
      
      try {
        const res = await fetch(`${this.apiGeoUrl}/adm/${level.toLowerCase()}`)
        if (!res.ok) throw new Error('Failed to load ADM zones')
        
        const zones = await res.json()
        admIdSelect.innerHTML = '<option value="">-- Sélectionner --</option>'
        zones.forEach((zone: any) => {
          const option = document.createElement('option')
          option.value = zone.id.toString()
          option.textContent = zone.name
          admIdSelect.appendChild(option)
        })
      } catch (e) {
        console.error('Failed to load ADM zones:', e)
        admIdSelect.innerHTML = '<option value="">Erreur de chargement</option>'
      }
    })
    
    // Sélectionner sur la carte
    const selectMapBtn = document.getElementById('gt-select-on-map')
    selectMapBtn?.addEventListener('click', () => {
      // Fermer temporairement le modal
      const container = document.getElementById('geotechFormContainer')
      if (container) {
        container.classList.remove('active')
      }
      
      // Afficher un message d'instruction
      const toast = document.getElementById('toast')
      if (toast) {
        toast.textContent = '🗺️ Cliquez sur une maille de la carte pour la sélectionner'
        toast.className = 'toast ok'
        toast.style.display = 'block'
        setTimeout(() => toast.style.display = 'none', 5000)
      }
      
      // Stocker un flag pour rouvrir le formulaire après sélection
      sessionStorage.setItem('geotechFormPending', 'true')
    })
    
    // Ajouter profondeur
    const addBtn = document.getElementById('gt-add-profondeur')
    addBtn?.addEventListener('click', () => this.addProfondeur())

    // Submit
    const submitBtn = document.getElementById('gt-submit')
    submitBtn?.addEventListener('click', () => this.submitForm())

    // Reset
    const resetBtn = document.getElementById('gt-reset')
    resetBtn?.addEventListener('click', () => this.resetForm())
  }

  private addProfondeur() {
    const input = document.getElementById('gt-profondeur') as HTMLInputElement
    const profondeur = parseFloat(input.value)

    if (isNaN(profondeur) || profondeur < 0) {
      alert('Profondeur invalide')
      return
    }

    if (this.profondeurs.has(profondeur)) {
      alert('Cette profondeur existe déjà')
      return
    }

    this.profondeurs.add(profondeur)
    this.essaisData.set(profondeur, [])
    this.classificationsData.set(profondeur, [])

    this.renderProfondeursList()
    this.renderEssaisTabs()
    this.renderClassificationsTabs()

    input.value = ''

    // Afficher les sections
    const essaisSection = document.getElementById('gt-essais-section')
    const classifSection = document.getElementById('gt-classifications-section')
    if (essaisSection) essaisSection.style.display = 'block'
    if (classifSection) classifSection.style.display = 'block'
  }

  private renderProfondeursList() {
    const container = document.getElementById('gt-profondeurs-list')
    if (!container) return

    const sorted = Array.from(this.profondeurs).sort((a, b) => a - b)
    container.innerHTML = sorted.map(p => `
      <div class="profondeur-item">
        <span>${p} m</span>
        <button type="button" class="btn-remove" data-profondeur="${p}">×</button>
      </div>
    `).join('')

    // Attacher événements de suppression
    container.querySelectorAll('.btn-remove').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const prof = parseFloat((e.target as HTMLElement).dataset.profondeur || '0')
        this.removeProfondeur(prof)
      })
    })
  }

  private removeProfondeur(profondeur: number) {
    this.profondeurs.delete(profondeur)
    this.essaisData.delete(profondeur)
    this.classificationsData.delete(profondeur)

    this.renderProfondeursList()
    this.renderEssaisTabs()
    this.renderClassificationsTabs()

    if (this.profondeurs.size === 0) {
      const essaisSection = document.getElementById('gt-essais-section')
      const classifSection = document.getElementById('gt-classifications-section')
      if (essaisSection) essaisSection.style.display = 'none'
      if (classifSection) classifSection.style.display = 'none'
    }
  }

  private renderEssaisTabs() {
    const tabsContainer = document.getElementById('gt-essais-tabs')
    const contentContainer = document.getElementById('gt-essais-content')
    if (!tabsContainer || !contentContainer) return

    const sorted = Array.from(this.profondeurs).sort((a, b) => a - b)

    // Onglets
    tabsContainer.innerHTML = sorted.map((p, i) => `
      <button type="button" class="tab ${i === 0 ? 'active' : ''}" data-tab="essais-${p}">
        ${p} m
      </button>
    `).join('')

    // Contenu
    contentContainer.innerHTML = sorted.map((p, i) => `
      <div class="tab-pane ${i === 0 ? 'active' : ''}" id="essais-${p}">
        ${this.renderEssaisForm(p)}
      </div>
    `).join('')

    // Événements onglets
    tabsContainer.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).dataset.tab
        this.switchTab('essais', target || '')
      })
    })

    // Événements formulaires
    this.attachEssaisFormListeners()
  }

  private renderEssaisForm(profondeur: number): string {
    return `
      <div class="essais-form">
        <h4>Essais à ${profondeur} m</h4>
        
        ${TYPES_ESSAIS.map(essai => {
          const isQualitative = essai.unite === null
          return `
            <div class="form-group essai-group">
              <label>${essai.nom}</label>
              ${isQualitative ? `
                <select class="essai-input" data-profondeur="${profondeur}" data-type="${essai.code}" data-field="qualitative">
                  <option value="">-- Non renseigné --</option>
                  ${ANALYSES_QUALITATIVES.map(a => `<option value="${a}">${a}</option>`).join('')}
                </select>
              ` : `
                <div class="input-with-unit">
                  <input type="number" step="0.01" class="essai-input" 
                         data-profondeur="${profondeur}" 
                         data-type="${essai.code}" 
                         data-field="numerique"
                         placeholder="Valeur">
                  <span class="unit">${essai.unite}</span>
                </div>
                ${essai.code === 'Granulometrie' ? `
                  <input type="number" step="0.01" class="essai-meta" 
                         data-profondeur="${profondeur}" 
                         data-type="${essai.code}"
                         placeholder="Tamis (mm)" value="0.08">
                ` : ''}
              `}
            </div>
          `
        }).join('')}
      </div>
    `
  }

  private attachEssaisFormListeners() {
    document.querySelectorAll('.essai-input').forEach(input => {
      input.addEventListener('change', (e) => {
        const el = e.target as HTMLInputElement
        const profondeur = parseFloat(el.dataset.profondeur || '0')
        const type = el.dataset.type || ''
        const field = el.dataset.field || ''
        
        this.updateEssaiData(profondeur, type, field, el.value)
      })
    })
  }

  private updateEssaiData(profondeur: number, type: string, field: string, value: string) {
    const essais = this.essaisData.get(profondeur) || []
    
    // Trouver ou créer l'essai
    let essai = essais.find(e => e.type === type)
    if (!essai) {
      essai = { type }
      essais.push(essai)
    }

    // Mettre à jour la valeur
    if (field === 'numerique') {
      essai.valeur_numerique = value ? parseFloat(value) : undefined
    } else if (field === 'qualitative') {
      essai.valeur_qualitative = value || undefined
    }

    // Gérer meta pour granulométrie
    if (type === 'Granulometrie') {
      const metaInput = document.querySelector(
        `.essai-meta[data-profondeur="${profondeur}"][data-type="${type}"]`
      ) as HTMLInputElement
      if (metaInput && metaInput.value) {
        essai.meta = { sieve_mm: parseFloat(metaInput.value) }
      }
    }

    this.essaisData.set(profondeur, essais)
  }

  private renderClassificationsTabs() {
    const tabsContainer = document.getElementById('gt-classifications-tabs')
    const contentContainer = document.getElementById('gt-classifications-content')
    if (!tabsContainer || !contentContainer) return

    const sorted = Array.from(this.profondeurs).sort((a, b) => a - b)

    tabsContainer.innerHTML = sorted.map((p, i) => `
      <button type="button" class="tab ${i === 0 ? 'active' : ''}" data-tab="classif-${p}">
        ${p} m
      </button>
    `).join('')

    contentContainer.innerHTML = sorted.map((p, i) => `
      <div class="tab-pane ${i === 0 ? 'active' : ''}" id="classif-${p}">
        ${this.renderClassificationsForm(p)}
      </div>
    `).join('')

    tabsContainer.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', (e) => {
        const target = (e.target as HTMLElement).dataset.tab
        this.switchTab('classif', target || '')
      })
    })

    this.attachClassificationsFormListeners()
  }

  private renderClassificationsForm(profondeur: number): string {
    const classifications = this.classificationsData.get(profondeur) || []
    
    return `
      <div class="classifications-form">
        <h4>Classifications à ${profondeur} m</h4>
        
        <div id="classif-list-${profondeur}">
          ${classifications.map((c, i) => `
            <div class="classification-item">
              <select class="classif-methode" data-profondeur="${profondeur}" data-index="${i}">
                ${METHODES_CLASSIFICATION.map(m => 
                  `<option value="${m}" ${c.methode === m ? 'selected' : ''}>${m}</option>`
                ).join('')}
              </select>
              <select class="classif-resultat" data-profondeur="${profondeur}" data-index="${i}">
                ${ANALYSES_QUALITATIVES.map(a => 
                  `<option value="${a}" ${c.resultat === a ? 'selected' : ''}>${a}</option>`
                ).join('')}
              </select>
              <button type="button" class="btn-remove-classif" data-profondeur="${profondeur}" data-index="${i}">×</button>
            </div>
          `).join('')}
        </div>
        
        <button type="button" class="btn-add-classif" data-profondeur="${profondeur}">
          + Ajouter une classification
        </button>
      </div>
    `
  }

  private attachClassificationsFormListeners() {
    // Ajouter classification
    document.querySelectorAll('.btn-add-classif').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const profondeur = parseFloat((e.target as HTMLElement).dataset.profondeur || '0')
        this.addClassification(profondeur)
      })
    })

    // Supprimer classification
    document.querySelectorAll('.btn-remove-classif').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const el = e.target as HTMLElement
        const profondeur = parseFloat(el.dataset.profondeur || '0')
        const index = parseInt(el.dataset.index || '0')
        this.removeClassification(profondeur, index)
      })
    })

    // Changements de valeurs
    document.querySelectorAll('.classif-methode, .classif-resultat').forEach(select => {
      select.addEventListener('change', (e) => {
        const el = e.target as HTMLSelectElement
        const profondeur = parseFloat(el.dataset.profondeur || '0')
        const index = parseInt(el.dataset.index || '0')
        this.updateClassification(profondeur, index)
      })
    })
  }

  private addClassification(profondeur: number) {
    const classifications = this.classificationsData.get(profondeur) || []
    classifications.push({
      methode: METHODES_CLASSIFICATION[0],
      resultat: ANALYSES_QUALITATIVES[0]
    })
    this.classificationsData.set(profondeur, classifications)
    this.renderClassificationsTabs()
  }

  private removeClassification(profondeur: number, index: number) {
    const classifications = this.classificationsData.get(profondeur) || []
    classifications.splice(index, 1)
    this.classificationsData.set(profondeur, classifications)
    this.renderClassificationsTabs()
  }

  private updateClassification(profondeur: number, index: number) {
    const classifications = this.classificationsData.get(profondeur) || []
    const methodeSelect = document.querySelector(
      `.classif-methode[data-profondeur="${profondeur}"][data-index="${index}"]`
    ) as HTMLSelectElement
    const resultatSelect = document.querySelector(
      `.classif-resultat[data-profondeur="${profondeur}"][data-index="${index}"]`
    ) as HTMLSelectElement

    if (methodeSelect && resultatSelect && classifications[index]) {
      classifications[index].methode = methodeSelect.value
      classifications[index].resultat = resultatSelect.value
    }
  }

  private switchTab(prefix: string, targetId: string) {
    // Désactiver tous les onglets et panneaux
    document.querySelectorAll(`#gt-${prefix}-tabs .tab`).forEach(tab => {
      tab.classList.remove('active')
    })
    document.querySelectorAll(`#gt-${prefix}-content .tab-pane`).forEach(pane => {
      pane.classList.remove('active')
    })

    // Activer le bon onglet et panneau
    const tab = document.querySelector(`[data-tab="${targetId}"]`)
    const pane = document.getElementById(targetId)
    if (tab) tab.classList.add('active')
    if (pane) pane.classList.add('active')
  }

  private async submitForm() {
    // Récupérer les données du formulaire
    const code = (document.getElementById('gt-code') as HTMLInputElement)?.value
    const date = (document.getElementById('gt-date') as HTMLInputElement)?.value
    const typeSol = (document.getElementById('gt-type-sol') as HTMLSelectElement)?.value
    const source = (document.getElementById('gt-source') as HTMLInputElement)?.value
    const operator = (document.getElementById('gt-operator') as HTMLInputElement)?.value
    const notes = (document.getElementById('gt-notes') as HTMLTextAreaElement)?.value
    const locationMode = (document.getElementById('gt-location-mode') as HTMLSelectElement)?.value || 'exact'
    const lon = parseFloat((document.getElementById('gt-lon') as HTMLInputElement)?.value)
    const lat = parseFloat((document.getElementById('gt-lat') as HTMLInputElement)?.value)

    // Validation
    if (this.profondeurs.size === 0) {
      this.onError('Au moins une profondeur avec essais est requise')
      return
    }
    
    // Validation ADM si mode != exact
    if (locationMode !== 'exact') {
      const admLevel = (document.getElementById('gt-adm-level') as HTMLSelectElement)?.value
      const admId = (document.getElementById('gt-adm-id') as HTMLSelectElement)?.value
      
      if (!admLevel || !admId) {
        this.onError('Veuillez sélectionner un niveau ADM et une zone')
        return
      }
    }

    // Construire le payload
    const essais_par_profondeur: EssaiProfondeurData[] = []
    this.essaisData.forEach((mesures, profondeur) => {
      // Filtrer les mesures vides
      const mesuresValides = mesures.filter(m =>
        m.valeur_numerique !== undefined || m.valeur_qualitative !== undefined
      )
      if (mesuresValides.length > 0) {
        essais_par_profondeur.push({
          profondeur_m: profondeur,
          mesures: mesuresValides
        })
      }
    })

    // Vérifier qu'il y a au moins un essai avec des mesures valides
    if (essais_par_profondeur.length === 0) {
      this.onError('Au moins un essai avec des mesures valides est requis')
      return
    }

    const classifications_par_profondeur: ClassificationProfondeurData[] = []
    this.classificationsData.forEach((analyses, profondeur) => {
      if (analyses.length > 0) {
        classifications_par_profondeur.push({
          profondeur_m: profondeur,
          analyses
        })
      }
    })

    const payload: SurveyGeotechData = {
      survey: {
        code: code || undefined,
        date: date || undefined,
        source: source || undefined,
        operator: operator || undefined,
        notes: notes || undefined,
        type_sol: typeSol
      },
      essais_par_profondeur,
      snap_to_grid: true
    }

    if (!isNaN(lon) && !isNaN(lat)) {
      payload.location = { lon, lat }
    }

    if (classifications_par_profondeur.length > 0) {
      payload.classifications_par_profondeur = classifications_par_profondeur
    }

    console.log('[GeotechForm] Payload:', payload)

    // Construire les tests au format v2 (plat)
    const tests: any[] = []
    essais_par_profondeur.forEach(ep => {
      ep.mesures.forEach(m => {
        if (m.valeur_numerique !== undefined) {
          tests.push({
            type: m.type,
            value: m.valeur_numerique,
            depth_m: ep.profondeur_m
          })
        }
      })
    })
    
    // Construire le payload v2 unifié
    const v2Payload: any = {
      survey: {
        code: code || undefined,
        date: date || undefined,
        source: source || undefined,
        operator: operator || undefined,
        notes: notes || undefined
      },
      tests
    }
    
    // Ajouter localisation selon le mode
    if (locationMode === 'exact') {
      // Mode exact: coordonnées GPS
      if (!isNaN(lon) && !isNaN(lat)) {
        v2Payload.location = { lon, lat }
      }
    } else {
      // Mode centroid: utiliser commune_id
      const admLevel = (document.getElementById('gt-adm-level') as HTMLSelectElement)?.value
      const admSelect = document.getElementById('gt-adm-id') as HTMLSelectElement
      const admCode = admSelect?.value
      
      if (admCode) {
        v2Payload.commune_id = admCode
        v2Payload.use_commune_centroid = true
      }
    }
    
    console.log('[GeotechForm] V2 Payload:', v2Payload)

    // Envoyer à l'API v2
    try {
      const response = await fetch(`${this.apiGeoUrl}/surveys`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(v2Payload)
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Erreur serveur')
      }

      const result = await response.json()
      this.onSuccess(result)
      this.resetForm()
    } catch (error: any) {
      this.onError(error.message || 'Erreur réseau')
    }
  }

  private resetForm() {
    this.profondeurs.clear()
    this.essaisData.clear()
    this.classificationsData.clear()

    // Réinitialiser les champs
    const inputs = ['gt-code', 'gt-date', 'gt-type-sol', 'gt-source', 'gt-operator', 'gt-notes', 'gt-lon', 'gt-lat']
    inputs.forEach(id => {
      const el = document.getElementById(id) as HTMLInputElement
      if (el) el.value = ''
    })

    this.renderProfondeursList()
    this.renderEssaisTabs()
    this.renderClassificationsTabs()

    const essaisSection = document.getElementById('gt-essais-section')
    const classifSection = document.getElementById('gt-classifications-section')
    if (essaisSection) essaisSection.style.display = 'none'
    if (classifSection) classifSection.style.display = 'none'
  }
}
