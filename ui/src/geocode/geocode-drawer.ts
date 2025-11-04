/**
 * Drawer de géocodage (modal latérale)
 * v2.5.0 - Phase UI-01
 */

import { SurveyToGeocode, GeocodePayload } from '../types/geocode'
import { geocodeSurvey } from './geocode-api'
import { toast } from '../ui/toast'

const TOGO_BBOX = {
  lat: { min: 5.8, max: 11.5 },
  lon: { min: -0.2, max: 1.9 },
}

export function createGeocodeDrawer(apiUrl: string) {
  let drawer: HTMLElement | null = null
  let currentSurvey: SurveyToGeocode | null = null
  let onSuccess: (() => void) | null = null
  
  function open(survey: SurveyToGeocode, successCallback: () => void) {
    currentSurvey = survey
    onSuccess = successCallback
    render()
  }
  
  function close() {
    if (drawer) {
      drawer.remove()
      drawer = null
    }
    currentSurvey = null
    onSuccess = null
  }
  
  function render() {
    if (!currentSurvey) return
    
    drawer = document.createElement('div')
    drawer.className = 'geocode-drawer'
    drawer.innerHTML = `
      <div class="drawer-overlay"></div>
      <div class="drawer-content">
        <div class="drawer-header">
          <h3>🗺️ Géocoder: ${currentSurvey.code}</h3>
          <button class="btn-close" aria-label="Fermer">×</button>
        </div>
        
        <div class="drawer-body">
          <div style="margin-bottom: 24px;">
            <label style="display: block; margin-bottom: 12px; font-weight: 600;">Mode de géocodage</label>
            
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <label class="radio-card">
                <input type="radio" name="geocode-mode" value="exact" checked />
                <div class="radio-card-content">
                  <strong>📍 Point exact (lat/lon)</strong>
                  <p>Saisir les coordonnées GPS précises</p>
                </div>
              </label>
              
              <label class="radio-card">
                <input type="radio" name="geocode-mode" value="adm" />
                <div class="radio-card-content">
                  <strong>🗺️ Zone administrative (ADM)</strong>
                  <p>Placer dans une maille aléatoire déterministe</p>
                </div>
              </label>
            </div>
          </div>
          
          <div id="exact-mode-fields" class="mode-fields">
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label for="geocode-lat" style="display: block; margin-bottom: 4px; font-weight: 500;">Latitude *</label>
                <input 
                  type="number" 
                  id="geocode-lat" 
                  step="0.000001" 
                  min="5.8" 
                  max="11.5"
                  placeholder="Ex: 6.1234"
                  style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                />
              </div>
              
              <div>
                <label for="geocode-lon" style="display: block; margin-bottom: 4px; font-weight: 500;">Longitude *</label>
                <input 
                  type="number" 
                  id="geocode-lon" 
                  step="0.000001" 
                  min="-0.2" 
                  max="1.9"
                  placeholder="Ex: 1.2345"
                  style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                />
              </div>
            </div>
          </div>
          
          <div id="adm-mode-fields" class="mode-fields" style="display: none;">
            <div style="display: flex; flex-direction: column; gap: 12px;">
              <div>
                <label for="geocode-adm-level" style="display: block; margin-bottom: 4px; font-weight: 500;">Niveau ADM *</label>
                <select id="geocode-adm-level" style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);">
                  <option value="ADM3">ADM3 (Canton)</option>
                  <option value="ADM2">ADM2 (Préfecture)</option>
                  <option value="ADM1">ADM1 (Région)</option>
                </select>
              </div>
              
              <div>
                <label for="geocode-adm-zone" style="display: block; margin-bottom: 4px; font-weight: 500;">Zone *</label>
                <select id="geocode-adm-zone" style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);">
                  <option value="">Sélectionner...</option>
                </select>
              </div>
              
              <div class="info-box">
                <strong>ℹ️ Mode ADM random cell</strong>
                <p>Le sondage sera placé dans une maille aléatoire déterministe de la zone sélectionnée.</p>
              </div>
            </div>
          </div>
        </div>
        
        <div class="drawer-footer">
          <button type="button" class="btn-secondary" id="btn-cancel">
            Annuler
          </button>
          <button type="button" class="btn-primary" id="btn-save">
            💾 Enregistrer
          </button>
        </div>
      </div>
    `
    
    document.body.appendChild(drawer)
    
    setupModeToggle()
    setupButtons()
    setupEscapeKey()
    
    drawer.querySelector<HTMLInputElement>('#geocode-lat')?.focus()
  }
  
  function setupModeToggle() {
    if (!drawer) return
    
    const radios = drawer.querySelectorAll('input[name="geocode-mode"]')
    const exactFields = drawer.querySelector('#exact-mode-fields') as HTMLElement
    const admFields = drawer.querySelector('#adm-mode-fields') as HTMLElement
    
    radios.forEach(radio => {
      radio.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement
        if (target.value === 'exact') {
          exactFields.style.display = 'block'
          admFields.style.display = 'none'
        } else {
          exactFields.style.display = 'none'
          admFields.style.display = 'block'
          loadAdmZones()
        }
      })
    })
  }
  
  function setupButtons() {
    if (!drawer) return
    
    drawer.querySelector('.btn-close')?.addEventListener('click', close)
    drawer.querySelector('#btn-cancel')?.addEventListener('click', close)
    drawer.querySelector('#btn-save')?.addEventListener('click', handleSave)
  }
  
  function setupEscapeKey() {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
      }
    }
    document.addEventListener('keydown', handler)
    
    // Cleanup sera fait dans close() via remove du drawer
    if (drawer) {
      drawer.addEventListener('remove', () => {
        document.removeEventListener('keydown', handler)
      })
    }
  }
  
  async function loadAdmZones() {
    if (!drawer) return
    
    const select = drawer.querySelector('#geocode-adm-zone') as HTMLSelectElement
    if (!select) return
    
    try {
      const response = await fetch(`${apiUrl}/adm3`)
      const zones = await response.json()
      
      select.innerHTML = '<option value="">Sélectionner...</option>'
      zones.forEach((zone: any) => {
        const option = document.createElement('option')
        option.value = zone.code
        option.textContent = `${zone.name} (${zone.prefecture})`
        select.appendChild(option)
      })
    } catch (e) {
      console.error('[GeocodeDrawer] Failed to load ADM zones:', e)
      toast.error('Erreur lors du chargement des zones ADM')
    }
  }
  
  function validateCoordinates(lat: number, lon: number): string | null {
    if (lat < TOGO_BBOX.lat.min || lat > TOGO_BBOX.lat.max) {
      return `Latitude hors limites (${TOGO_BBOX.lat.min} à ${TOGO_BBOX.lat.max})`
    }
    if (lon < TOGO_BBOX.lon.min || lon > TOGO_BBOX.lon.max) {
      return `Longitude hors limites (${TOGO_BBOX.lon.min} à ${TOGO_BBOX.lon.max})`
    }
    return null
  }
  
  async function handleSave() {
    if (!drawer || !currentSurvey) return
    
    const mode = drawer.querySelector<HTMLInputElement>('input[name="geocode-mode"]:checked')?.value
    
    let payload: GeocodePayload
    
    if (mode === 'exact') {
      const latInput = drawer.querySelector<HTMLInputElement>('#geocode-lat')!
      const lonInput = drawer.querySelector<HTMLInputElement>('#geocode-lon')!
      
      const lat = parseFloat(latInput.value)
      const lon = parseFloat(lonInput.value)
      
      if (isNaN(lat) || isNaN(lon)) {
        toast.error('Veuillez saisir des coordonnées valides')
        return
      }
      
      const error = validateCoordinates(lat, lon)
      if (error) {
        toast.error(error)
        return
      }
      
      payload = {
        survey_id: currentSurvey.id,
        method: 'exact',
        data: { latitude: lat, longitude: lon },
      }
    } else {
      const admCode = drawer.querySelector<HTMLSelectElement>('#geocode-adm-zone')!.value
      const admLevel = drawer.querySelector<HTMLSelectElement>('#geocode-adm-level')!.value as 'ADM1' | 'ADM2' | 'ADM3'
      
      if (!admCode) {
        toast.error('Veuillez sélectionner une zone')
        return
      }
      
      payload = {
        survey_id: currentSurvey.id,
        method: 'adm_random_cell',
        data: { adm_level: admLevel, adm_code: admCode },
      }
    }
    
    try {
      await geocodeSurvey(apiUrl, payload)
      console.log('[GeocodeDrawer] Survey geocoded:', currentSurvey.code)
      
      toast.success(`Sondage "${currentSurvey.code}" géocodé avec succès!`)
      
      if (onSuccess) {
        onSuccess()
      }
      
      close()
    } catch (e) {
      console.error('[GeocodeDrawer] Failed to geocode:', e)
      toast.error('Erreur lors du géocodage')
    }
  }
  
  return {
    open,
    close,
  }
}
