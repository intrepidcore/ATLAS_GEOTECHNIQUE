// Module pour gérer le géocodage des sondages
// Permet de lister et géocoder les sondages en modes "unknown", "centroid" et "random"

export class GeocodeManager {
  constructor(private apiUrl: string) {}
  
  async listUngeocoded(): Promise<any[]> {
    const res = await fetch(`${this.apiUrl}/surveys/ungeocode`)
    if (!res.ok) throw new Error('Failed to load ungeocode surveys')
    return res.json()
  }
  
  async geocode(surveyId: string, mode: 'coords' | 'adm', data: any): Promise<any> {
    const payload = mode === 'coords'
      ? { lon: data.lon, lat: data.lat }
      : { 
          location_mode: data.location_mode,
          adm_level: data.adm_level,
          adm_id: parseInt(data.adm_id)
        }
    
    const res = await fetch(`${this.apiUrl}/surveys/${surveyId}/geocode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      const error = await res.json()
      throw new Error(error.error || 'Geocoding failed')
    }
    return res.json()
  }
  
  renderUI(containerId: string, onSuccess: (result: any) => void, onError: (error: string) => void) {
    const container = document.getElementById(containerId)
    if (!container) {
      console.error(`Container #${containerId} not found`)
      return
    }
    
    container.innerHTML = `
      <div class="geocode-manager" style="padding: 20px; background: #111a2a; border-radius: 8px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
          <h2 style="margin: 0; color: #ecf2f8;">🗺️ Géocodage des Sondages</h2>
          <button id="geocode-close" style="background: transparent; border: none; color: #8aa0b5; font-size: 32px; cursor: pointer;">&times;</button>
        </div>
        
        <div id="geocode-list" style="margin-top: 20px;">
          <p style="color: #8aa0b5;">Chargement...</p>
        </div>
      </div>
    `
    
    container.classList.add('active')
    
    // Bouton fermer
    const closeBtn = document.getElementById('geocode-close')
    closeBtn?.addEventListener('click', () => {
      container.classList.remove('active')
      setTimeout(() => container.innerHTML = '', 300)
    })
    
    // Charger la liste
    this.loadAndRenderList(onSuccess, onError)
  }
  
  private async loadAndRenderList(onSuccess: (result: any) => void, onError: (error: string) => void) {
    const listDiv = document.getElementById('geocode-list')
    if (!listDiv) return
    
    try {
      const surveys = await this.listUngeocoded()
      
      if (surveys.length === 0) {
        listDiv.innerHTML = `
          <div style="text-align: center; padding: 40px; color: #8aa0b5;">
            <p style="font-size: 18px;">✅ Aucun sondage en attente de géocodage</p>
          </div>
        `
        return
      }
      
      listDiv.innerHTML = surveys.map(s => `
        <div class="geocode-item" style="background: #0f172a; padding: 16px; border-radius: 6px; margin-bottom: 12px; border: 1px solid #22304d;">
          <div style="display: flex; justify-content: space-between; align-items: start;">
            <div>
              <h4 style="margin: 0 0 8px 0; color: #ecf2f8;">${s.code}</h4>
              <p style="margin: 4px 0; color: #8aa0b5; font-size: 13px;">
                📍 ${s.adm1_name || s.adm2_name || s.adm3_name || 'ADM non spécifié'}
              </p>
              <p style="margin: 4px 0; color: #8aa0b5; font-size: 13px;">
                🧪 ${s.n_essais} essai(s)
              </p>
            </div>
            <button 
              class="geocode-btn" 
              data-id="${s.id}" 
              data-code="${s.code}"
              style="padding: 8px 16px; background: #3aa6ff; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-size: 13px;"
            >
              🗺️ Géocoder
            </button>
          </div>
        </div>
      `).join('')
      
      // Attacher les event listeners
      document.querySelectorAll('.geocode-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
          const target = e.target as HTMLButtonElement
          const surveyId = target.dataset.id!
          const surveyCode = target.dataset.code!
          this.showGeocodeForm(surveyId, surveyCode, onSuccess, onError)
        })
      })
      
    } catch (error: any) {
      listDiv.innerHTML = `
        <div style="padding: 20px; background: #3d1f1f; border-radius: 6px; color: #ff6b6b;">
          ❌ Erreur: ${error.message}
        </div>
      `
    }
  }
  
  private showGeocodeForm(surveyId: string, surveyCode: string, onSuccess: (result: any) => void, onError: (error: string) => void) {
    const listDiv = document.getElementById('geocode-list')
    if (!listDiv) return
    
    listDiv.innerHTML = `
      <div style="background: #0f172a; padding: 20px; border-radius: 6px; border: 1px solid #22304d;">
        <h3 style="margin: 0 0 16px 0; color: #ecf2f8;">Géocoder: ${surveyCode}</h3>
        
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: #8aa0b5; font-size: 13px;">Mode de géocodage</label>
          <select id="geocode-mode" style="width: 100%; padding: 10px; background: #0b1220; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px;">
            <option value="coords">📍 Coordonnées exactes</option>
            <option value="centroid">🎯 Centroïde ADM</option>
            <option value="random">🎲 Point aléatoire ADM</option>
          </select>
        </div>
        
        <div id="geocode-coords-section">
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; color: #8aa0b5; font-size: 13px;">Longitude</label>
              <input type="number" id="geocode-lon" step="0.000001" placeholder="Ex: 1.084" style="width: 100%; padding: 10px; background: #0b1220; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px;">
            </div>
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; color: #8aa0b5; font-size: 13px;">Latitude</label>
              <input type="number" id="geocode-lat" step="0.000001" placeholder="Ex: 8.592" style="width: 100%; padding: 10px; background: #0b1220; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px;">
            </div>
          </div>
        </div>
        
        <div id="geocode-adm-section" style="display: none;">
          <div style="display: flex; gap: 12px; margin-bottom: 16px;">
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; color: #8aa0b5; font-size: 13px;">Niveau ADM</label>
              <select id="geocode-adm-level" style="width: 100%; padding: 10px; background: #0b1220; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px;">
                <option value="">-- Sélectionner --</option>
                <option value="ADM1">Région (ADM1)</option>
                <option value="ADM2">Préfecture (ADM2)</option>
                <option value="ADM3">Commune (ADM3)</option>
              </select>
            </div>
            <div style="flex: 1;">
              <label style="display: block; margin-bottom: 8px; color: #8aa0b5; font-size: 13px;">Zone ADM</label>
              <select id="geocode-adm-id" style="width: 100%; padding: 10px; background: #0b1220; color: #ecf2f8; border: 1px solid #22304d; border-radius: 4px;">
                <option value="">-- Sélectionner le niveau d'abord --</option>
              </select>
            </div>
          </div>
        </div>
        
        <div style="display: flex; gap: 12px;">
          <button id="geocode-submit" style="flex: 1; padding: 12px; background: #0bb07b; border: none; border-radius: 4px; color: #fff; cursor: pointer; font-weight: 600;">
            ✅ Géocoder
          </button>
          <button id="geocode-cancel" style="flex: 1; padding: 12px; background: #3d3d3d; border: none; border-radius: 4px; color: #fff; cursor: pointer;">
            Annuler
          </button>
        </div>
      </div>
    `
    
    // Event listeners
    const modeSelect = document.getElementById('geocode-mode') as HTMLSelectElement
    const coordsSection = document.getElementById('geocode-coords-section')
    const admSection = document.getElementById('geocode-adm-section')
    
    modeSelect?.addEventListener('change', () => {
      const mode = modeSelect.value
      if (coordsSection) coordsSection.style.display = mode === 'coords' ? 'block' : 'none'
      if (admSection) admSection.style.display = mode !== 'coords' ? 'block' : 'none'
    })
    
    // Charger les zones ADM
    const admLevelSelect = document.getElementById('geocode-adm-level') as HTMLSelectElement
    admLevelSelect?.addEventListener('change', async () => {
      const level = admLevelSelect.value
      const admIdSelect = document.getElementById('geocode-adm-id') as HTMLSelectElement
      
      if (!level || !admIdSelect) return
      
      admIdSelect.innerHTML = '<option value="">Chargement...</option>'
      
      try {
        const res = await fetch(`${this.apiUrl}/adm/${level.toLowerCase()}`)
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
    
    // Submit
    const submitBtn = document.getElementById('geocode-submit')
    submitBtn?.addEventListener('click', async () => {
      const mode = (document.getElementById('geocode-mode') as HTMLSelectElement).value
      
      try {
        let result
        if (mode === 'coords') {
          const lon = parseFloat((document.getElementById('geocode-lon') as HTMLInputElement).value)
          const lat = parseFloat((document.getElementById('geocode-lat') as HTMLInputElement).value)
          
          if (isNaN(lon) || isNaN(lat)) {
            onError('Coordonnées invalides')
            return
          }
          
          result = await this.geocode(surveyId, 'coords', { lon, lat })
        } else {
          const admLevel = (document.getElementById('geocode-adm-level') as HTMLSelectElement).value
          const admId = (document.getElementById('geocode-adm-id') as HTMLSelectElement).value
          
          if (!admLevel || !admId) {
            onError('Veuillez sélectionner un niveau ADM et une zone')
            return
          }
          
          result = await this.geocode(surveyId, 'adm', {
            location_mode: mode,
            adm_level: admLevel,
            adm_id: admId
          })
        }
        
        onSuccess(result)
        this.loadAndRenderList(onSuccess, onError)
      } catch (error: any) {
        onError(error.message)
      }
    })
    
    // Cancel
    const cancelBtn = document.getElementById('geocode-cancel')
    cancelBtn?.addEventListener('click', () => {
      this.loadAndRenderList(onSuccess, onError)
    })
  }
}
