// Panneau Droit v2.1.0 - Accordéons & Interactions

// Init accordéons
export function initAccordions() {
  const headers = document.querySelectorAll('.accordion-header')
  
  headers.forEach(header => {
    header.addEventListener('click', () => {
      const section = header.getAttribute('data-section')
      const content = document.getElementById(`${section}-content`)
      
      if (!content) return
      
      // Toggle
      header.classList.toggle('active')
      content.classList.toggle('open')
    })
  })
}

// Init dropdowns
export function initDropdowns() {
  const newSurveyBtn = document.getElementById('newSurveyBtn')
  const newSurveyMenu = document.getElementById('newSurveyMenu')
  
  if (newSurveyBtn && newSurveyMenu) {
    newSurveyBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      newSurveyMenu.classList.toggle('open')
    })
    
    // Actions dropdown
    newSurveyMenu.querySelectorAll('a').forEach(link => {
      link.addEventListener('click', (e) => {
        e.preventDefault()
        const action = link.getAttribute('data-action')
        handleDropdownAction(action)
        newSurveyMenu.classList.remove('open')
      })
    })
  }
  
  // Fermer au clic extérieur
  document.addEventListener('click', () => {
    document.querySelectorAll('.dropdown-menu.open').forEach(menu => {
      menu.classList.remove('open')
    })
  })
}

function handleDropdownAction(action: string | null) {
  switch (action) {
    case 'new-geotech':
      document.getElementById('newGeotechSurveyBtn')?.click()
      break
    case 'import-csv':
      document.getElementById('importCsvBtn')?.click()
      break
    case 'import-bulk':
      document.getElementById('importCsvBtn')?.click()
      break
  }
}

// Actions maille contextuelles
export function showMailleActions(code: string, nSondages: number, nEssais: number) {
  const section = document.getElementById('mailleActions')
  const codeEl = document.getElementById('mailleCode')
  const statsEl = document.getElementById('mailleStats')
  
  if (section && codeEl && statsEl) {
    section.style.display = 'block'
    codeEl.textContent = code
    statsEl.textContent = `${nSondages} sondages • ${nEssais} essais`
    
    // Ouvrir l'accordéon
    const header = section.querySelector('.accordion-header')
    const content = section.querySelector('.accordion-content')
    header?.classList.add('active')
    content?.classList.add('open')
  }
}

export function hideMailleActions() {
  const section = document.getElementById('mailleActions')
  if (section) {
    section.style.display = 'none'
  }
}

// Fermer actions maille
export function initCloseMailleActions() {
  const closeBtn = document.getElementById('closeMailleActions')
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.stopPropagation()
      hideMailleActions()
    })
  }
}

// Badges filtres actifs
let activeFilters: any[] = []

export function updateFilterBadges() {
  const container = document.getElementById('activeFilters')
  const countEl = document.getElementById('filterCount')
  
  if (!container || !countEl) return
  
  // Collecter filtres actifs
  activeFilters = []
  
  // ADM
  const adm1 = (document.getElementById('filterAdm1') as HTMLSelectElement)?.value
  if (adm1) activeFilters.push({ id: 'adm1', label: `ADM1: ${adm1}` })
  
  // Min sondages
  const minSondages = parseInt((document.getElementById('filterMinSondages') as HTMLInputElement)?.value || '0')
  if (minSondages > 0) activeFilters.push({ id: 'minSondages', label: `Min ${minSondages} sondages` })
  
  // Min essais
  const minEssais = parseInt((document.getElementById('filterMinEssais') as HTMLInputElement)?.value || '0')
  if (minEssais > 0) activeFilters.push({ id: 'minEssais', label: `Min ${minEssais} essais` })
  
  // Profondeur
  const depthMin = (document.getElementById('filterDepthMin') as HTMLInputElement)?.value
  const depthMax = (document.getElementById('filterDepthMax') as HTMLInputElement)?.value
  if (depthMin || depthMax) {
    activeFilters.push({ id: 'depth', label: `Prof: ${depthMin || '0'}-${depthMax || '∞'}m` })
  }
  
  // WL
  const wlMin = (document.getElementById('filterWLMin') as HTMLInputElement)?.value
  const wlMax = (document.getElementById('filterWLMax') as HTMLInputElement)?.value
  if (wlMin || wlMax) {
    activeFilters.push({ id: 'wl', label: `WL: ${wlMin || '0'}-${wlMax || '∞'}` })
  }
  
  // Période
  const period = (document.getElementById('filterPeriod') as HTMLSelectElement)?.value
  if (period) {
    const labels: any = { '30d': '30 jours', '3m': '3 mois', '6m': '6 mois', '1y': '1 an' }
    activeFilters.push({ id: 'period', label: labels[period] || period })
  }
  
  // Afficher
  if (activeFilters.length === 0) {
    container.style.display = 'none'
    countEl.textContent = '0'
    return
  }
  
  container.style.display = 'flex'
  countEl.textContent = activeFilters.length.toString()
  
  container.innerHTML = activeFilters.map(f => `
    <div class="filter-badge" data-filter="${f.id}">
      ${f.label}
      <span class="badge-remove" onclick="window.removeFilter('${f.id}')">×</span>
    </div>
  `).join('')
}

// Supprimer un filtre
;(window as any).removeFilter = function(filterId: string) {
  switch (filterId) {
    case 'adm1':
      (document.getElementById('filterAdm1') as HTMLSelectElement).value = ''
      break
    case 'minSondages':
      (document.getElementById('filterMinSondages') as HTMLInputElement).value = '0'
      break
    case 'minEssais':
      (document.getElementById('filterMinEssais') as HTMLInputElement).value = '0'
      break
    case 'depth':
      (document.getElementById('filterDepthMin') as HTMLInputElement).value = ''
      ;(document.getElementById('filterDepthMax') as HTMLInputElement).value = ''
      break
    case 'wl':
      (document.getElementById('filterWLMin') as HTMLInputElement).value = ''
      ;(document.getElementById('filterWLMax') as HTMLInputElement).value = ''
      break
    case 'period':
      (document.getElementById('filterPeriod') as HTMLSelectElement).value = ''
      break
  }
  updateFilterBadges()
  // Trigger filter change
  document.getElementById('filterAdm1')?.dispatchEvent(new Event('change'))
}

// Raccourcis clavier
export function initKeyboardShortcuts() {
  document.addEventListener('keydown', (e) => {
    // Ctrl+F : Recherche
    if (e.ctrlKey && e.key === 'f') {
      e.preventDefault()
      document.getElementById('unifiedSearch')?.focus()
    }
    
    // Ctrl+N : Nouveau sondage
    if (e.ctrlKey && e.key === 'n') {
      e.preventDefault()
      document.getElementById('newSurveyBtn')?.click()
    }
    
    // Ctrl+E : Export rapide
    if (e.ctrlKey && e.key === 'e') {
      e.preventDefault()
      document.getElementById('exportGeoJSON')?.click()
    }
    
    // Ctrl+R : Reset filtres
    if (e.ctrlKey && e.key === 'r') {
      e.preventDefault()
      document.getElementById('resetFilters')?.click()
    }
    
    // Escape : Fermer tout
    if (e.key === 'Escape') {
      document.querySelectorAll('.dropdown-menu.open').forEach(m => m.classList.remove('open'))
    }
  })
}

// Init listeners filtres
export function initFilterListeners() {
  const filterIds = [
    'filterAdm1', 'filterAdm2', 'filterAdm3',
    'filterMinSondages', 'filterMinEssais',
    'filterDepthMin', 'filterDepthMax',
    'filterWLMin', 'filterWLMax',
    'filterPeriod'
  ]
  
  filterIds.forEach(id => {
    const el = document.getElementById(id)
    if (el) {
      el.addEventListener('change', updateFilterBadges)
      el.addEventListener('input', updateFilterBadges)
    }
  })
}
