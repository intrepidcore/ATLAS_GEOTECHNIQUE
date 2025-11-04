/**
 * Onglet "Nouveau Sondage Géotechnique"
 * v2.5.0 - Phase UI-01
 */

import { TabComponent } from '../types/tabs'
import { toast } from '../ui/toast'
import { bus } from '../utils/event-bus'

export function createTabNouveau(apiUrl: string): TabComponent {
  let container: HTMLElement | null = null
  let form: HTMLFormElement | null = null
  
  function mount(containerEl: HTMLElement) {
    container = containerEl
    render()
  }
  
  function unmount() {
    if (form) {
      form.removeEventListener('submit', handleSubmit)
    }
    if (container) {
      container.innerHTML = ''
    }
  }
  
  function render() {
    if (!container) return
    
    container.innerHTML = `
      <div class="tab-content-wrapper" style="padding: 24px; max-width: 800px;">
        <h3 style="margin-top: 0;">📝 Nouveau Sondage Géotechnique</h3>
        
        <form id="form-nouveau-sondage" style="display: flex; flex-direction: column; gap: 24px;">
          <fieldset style="border: 1px solid var(--tab-border); padding: 16px; border-radius: 8px;">
            <legend style="padding: 0 8px; font-weight: 600;">Informations de base</legend>
            
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label for="code-site" style="display: block; margin-bottom: 4px; font-weight: 500;">Code site *</label>
                <input 
                  type="text" 
                  id="code-site" 
                  name="code_site" 
                  required 
                  placeholder="Ex: TEKPO_S1"
                  autocomplete="off"
                  style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                />
              </div>
              
              <div>
                <label for="source" style="display: block; margin-bottom: 4px; font-weight: 500;">Source *</label>
                <input 
                  type="text" 
                  id="source" 
                  name="source" 
                  required 
                  placeholder="Ex: DAVIE, ETUDE_2024"
                  autocomplete="off"
                  style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                />
              </div>
              
              <div>
                <label for="date-sondage" style="display: block; margin-bottom: 4px; font-weight: 500;">Date</label>
                <input 
                  type="date" 
                  id="date-sondage" 
                  name="date"
                  style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                />
              </div>
            </div>
          </fieldset>
          
          <fieldset style="border: 1px solid var(--tab-border); padding: 16px; border-radius: 8px;">
            <legend style="padding: 0 8px; font-weight: 600;">Localisation</legend>
            
            <div style="display: flex; flex-direction: column; gap: 16px;">
              <div>
                <label style="display: block; margin-bottom: 8px; font-weight: 500;">Mode de localisation *</label>
                <div style="display: flex; flex-direction: column; gap: 8px;">
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="location_mode" value="exact" checked />
                    <span>Point exact (lat/lon)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 8px; cursor: pointer;">
                    <input type="radio" name="location_mode" value="adm" />
                    <span>Zone administrative (ADM)</span>
                  </label>
                </div>
              </div>
              
              <div id="exact-fields">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                  <div>
                    <label for="latitude" style="display: block; margin-bottom: 4px; font-weight: 500;">Latitude *</label>
                    <input 
                      type="number" 
                      id="latitude" 
                      name="latitude" 
                      step="0.000001"
                      min="6" 
                      max="12"
                      placeholder="Ex: 6.1234"
                      style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                    />
                  </div>
                  
                  <div>
                    <label for="longitude" style="display: block; margin-bottom: 4px; font-weight: 500;">Longitude *</label>
                    <input 
                      type="number" 
                      id="longitude" 
                      name="longitude" 
                      step="0.000001"
                      min="-1" 
                      max="2"
                      placeholder="Ex: 1.2345"
                      style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);"
                    />
                  </div>
                </div>
              </div>
              
              <div id="adm-fields" style="display: none;">
                <div style="display: flex; flex-direction: column; gap: 12px;">
                  <div>
                    <label for="adm-level" style="display: block; margin-bottom: 4px; font-weight: 500;">Niveau ADM *</label>
                    <select id="adm-level" name="adm_level" style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);">
                      <option value="ADM3">ADM3 (Canton)</option>
                      <option value="ADM2">ADM2 (Préfecture)</option>
                      <option value="ADM1">ADM1 (Région)</option>
                    </select>
                  </div>
                  
                  <div>
                    <label for="adm-zone" style="display: block; margin-bottom: 4px; font-weight: 500;">Zone *</label>
                    <select id="adm-zone" name="adm_code" style="width: 100%; padding: 8px 12px; background: var(--bg-input, #0b1220); border: 1px solid var(--tab-border); border-radius: 4px; color: var(--tab-text-primary);">
                      <option value="">Sélectionner...</option>
                    </select>
                  </div>
                </div>
              </div>
            </div>
          </fieldset>
          
          <div style="display: flex; gap: 12px; justify-content: flex-end;">
            <button type="button" class="btn-secondary" id="btn-cancel">
              Annuler
            </button>
            <button type="submit" class="btn-primary">
              💾 Créer le sondage
            </button>
          </div>
        </form>
      </div>
    `
    
    form = container.querySelector('#form-nouveau-sondage')
    if (form) {
      form.addEventListener('submit', handleSubmit)
    }
    
    setupLocationModeToggle()
    setupCancelButton()
  }
  
  function setupLocationModeToggle() {
    if (!container) return
    
    const radios = container.querySelectorAll('input[name="location_mode"]')
    const exactFields = container.querySelector('#exact-fields') as HTMLElement
    const admFields = container.querySelector('#adm-fields') as HTMLElement
    
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
  
  function setupCancelButton() {
    const btn = container?.querySelector('#btn-cancel')
    if (btn) {
      btn.addEventListener('click', () => {
        if (form) {
          form.reset()
        }
      })
    }
  }
  
  async function loadAdmZones() {
    const select = container?.querySelector('#adm-zone') as HTMLSelectElement
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
      console.error('[TabNouveau] Failed to load ADM zones:', e)
      toast.error('Erreur lors du chargement des zones ADM')
    }
  }
  
  async function handleSubmit(e: Event) {
    e.preventDefault()
    
    if (!form) return
    
    const formData = new FormData(form)
    const data: any = Object.fromEntries(formData.entries())
    
    if (!data.code_site || !data.source) {
      toast.error('Veuillez remplir tous les champs obligatoires')
      return
    }
    
    try {
      const response = await fetch(`${apiUrl}/surveys/geotech`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      })
      
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`)
      }
      
      const result = await response.json()
      console.log('[TabNouveau] Survey created:', result)
      
      form.reset()
      toast.success(`Sondage "${data.code_site}" créé avec succès!`)
      
      bus.emit('survey:created', { id: result.id })
      
    } catch (e) {
      console.error('[TabNouveau] Failed to create survey:', e)
      toast.error('Erreur lors de la création du sondage')
    }
  }
  
  return {
    mount,
    unmount,
  }
}
