import L from 'leaflet'

// Base URLs with runtime override support
const API_GEO = (import.meta.env.VITE_API_GEO ?? (window as any).__API_GEO__ ?? '') as string

const map = L.map('map', { preferCanvas: true }).setView([8.6195, 0.8248], 7)
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap'
}).addTo(map)

const codeInput = document.getElementById('codeInput') as HTMLInputElement
let gridLayer: L.GeoJSON<any> | null = null
let shapeLayer: L.GeoJSON<any> | null = null

// --- UI helpers ---
function toast(msg: string, kind: 'ok' | 'err' = 'ok') {
  const el = document.getElementById('toast')!
  el.textContent = msg
  el.className = `toast ${kind}`
  el.style.display = 'block'
  setTimeout(() => el.style.display = 'none', 5000)
}

function setStatus(text: string) {
  (document.getElementById('status')!).textContent = text
}

function setKpis(total: number, withData: number) {
  const k = document.getElementById('kpis')!
  k.innerHTML = `
    <div class="kpi"><span>Mailles</span><b>${total.toLocaleString()}</b></div>
    <div class="kpi"><span>Avec données</span><b>${withData.toLocaleString()}</b></div>
    <div class="kpi"><span>Sans données</span><b>${(total - withData).toLocaleString()}</b></div>
  `
  const b = document.getElementById('gridBadge')!
  b.innerHTML = `<span class="dot" style="background:${withData > 0 ? 'var(--ok)' : 'var(--warn)'}"></span> Grille`
}

// --- Leaflet styles ---
function styleFeature(f: any) {
  const has = !!f.properties?.has_data
  const zoom = map.getZoom()
  // Contours dynamiques selon le zoom
  const baseWeight = has ? 1.2 : 0.5
  const weight = zoom < 10 ? baseWeight : zoom < 12 ? baseWeight * 1.5 : baseWeight * 2
  
  return {
    color: has ? '#e85d68' : '#6b778c55',
    weight,
    fillColor: has ? '#e85d68' : '#cfd8e3',
    fillOpacity: has ? 0.35 : 0.06
  }
}

function highlightFeature(e: any) {
  e.target.setStyle({ weight: 2, color: '#e85d68' })
}

function resetHighlight(e: any) {
  if (gridLayer) gridLayer.resetStyle(e.target)
}

// --- Feature interactions ---
// Variable globale pour la maille sélectionnée
let selectedMailleLayer: any = null

function onEachFeature(f: any, layer: any) {
  const p = f.properties || {}
  const title = `Code: ${p.code || '—'}${p.adm1_name ? `\nRégion: ${p.adm1_name}` : ''}${p.n_sondages != null ? `\nSondages: ${p.n_sondages}` : ''}`
  layer.bindTooltip(title, { sticky: true, opacity: 0.9 })
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: () => {
      // Réinitialiser l'ancienne sélection
      if (selectedMailleLayer && gridLayer) {
        gridLayer.resetStyle(selectedMailleLayer)
      }
      
      // Mettre en évidence la nouvelle maille
      layer.setStyle({
        weight: 4,
        color: '#FFD700',
        fillOpacity: 0.4
      })
      selectedMailleLayer = layer
      
      // Zoomer uniquement (ne pas remplir le code automatiquement)
      map.fitBounds(layer.getBounds(), { maxZoom: 14 })
      
      // Toast de confirmation
      toast(`📍 Maille sélectionnée: ${p.code}`, 'ok')
    }
  })
}

// --- Grid loading ---
async function loadGrid() {
  if (!API_GEO) return
  setStatus('Chargement de la grille…')
  try {
    const res = await fetch(`${API_GEO}/coverage/mailles`)
    if (!res.ok) {
      toast(`HTTP ${res.status}`, 'err')
      setStatus('Erreur de chargement')
      return
    }
    const gj = await res.json()

    let withData = 0
    gj.features.forEach((f: any) => {
      if (f.properties?.has_data) withData++
    })

    setKpis(gj.features.length, withData)
    setStatus(`Grille chargée: ${gj.features.length.toLocaleString()} mailles (${withData} avec données)`)

    if (gridLayer) {
      map.removeLayer(gridLayer)
    }
    gridLayer = L.geoJSON(gj, {
      style: styleFeature,
      onEachFeature
    }).addTo(map)

    const bounds = gridLayer.getBounds()
    if (bounds.isValid()) map.fitBounds(bounds, { padding: [12, 12] })

    // Redessiner les mailles lors du zoom pour ajuster les contours
    map.on('zoomend', () => {
      if (gridLayer) {
        gridLayer.eachLayer((layer: any) => {
          const feature = layer.feature
          if (feature) {
            layer.setStyle(styleFeature(feature))
          }
        })
      }
    })

    buildAdmFilters(gj)
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur de chargement')
  }
}

// --- ADM filters ---
let allFeatures: any[] = []

function buildAdmFilters(gj: any) {
  allFeatures = gj.features
  
  // Build ADM1 (régions)
  const adm1Select = document.getElementById('filterAdm1') as HTMLSelectElement
  const adm1Set = new Set<string>()
  allFeatures.forEach((f: any) => {
    if (f.properties?.adm1_name) adm1Set.add(f.properties.adm1_name)
  })
  ;[...adm1Set].sort().forEach(v => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    adm1Select.appendChild(opt)
  })

  // Build ADM2 (préfectures)
  const adm2Select = document.getElementById('filterAdm2') as HTMLSelectElement
  const adm2Set = new Set<string>()
  allFeatures.forEach((f: any) => {
    if (f.properties?.adm2_name) adm2Set.add(f.properties.adm2_name)
  })
  ;[...adm2Set].sort().forEach(v => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    adm2Select.appendChild(opt)
  })

  // Build ADM3 (communes)
  const adm3Select = document.getElementById('filterAdm3') as HTMLSelectElement
  const adm3Set = new Set<string>()
  allFeatures.forEach((f: any) => {
    if (f.properties?.adm3_name) adm3Set.add(f.properties.adm3_name)
  })
  ;[...adm3Set].sort().forEach(v => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    adm3Select.appendChild(opt)
  })

  // Attach change handlers
  adm1Select.onchange = () => applyFilters()
  adm2Select.onchange = () => applyFilters()
  adm3Select.onchange = () => applyFilters()

  // Attach data filter handlers
  document.getElementById('filterHasData')!.addEventListener('change', () => applyFilters())
  document.getElementById('filterNoData')!.addEventListener('change', () => applyFilters())
  document.getElementById('filterMinSondages')!.addEventListener('input', () => applyFilters())

  // Reset button
  document.getElementById('resetFilters')!.addEventListener('click', () => {
    adm1Select.value = ''
    adm2Select.value = ''
    adm3Select.value = ''
    ;(document.getElementById('filterHasData') as HTMLInputElement).checked = true
    ;(document.getElementById('filterNoData') as HTMLInputElement).checked = true
    ;(document.getElementById('filterMinSondages') as HTMLInputElement).value = '0'
    applyFilters()
  })

  // Initial stats
  updateFilterStats()
}

function applyFilters() {
  const adm1 = (document.getElementById('filterAdm1') as HTMLSelectElement).value
  const adm2 = (document.getElementById('filterAdm2') as HTMLSelectElement).value
  const adm3 = (document.getElementById('filterAdm3') as HTMLSelectElement).value
  const showHasData = (document.getElementById('filterHasData') as HTMLInputElement).checked
  const showNoData = (document.getElementById('filterNoData') as HTMLInputElement).checked
  const minSondages = parseInt((document.getElementById('filterMinSondages') as HTMLInputElement).value) || 0

  if (!gridLayer) return

  gridLayer.eachLayer((layer: any) => {
    const prop = layer.feature.properties
    const matchAdm1 = !adm1 || prop.adm1_name === adm1
    const matchAdm2 = !adm2 || prop.adm2_name === adm2
    const matchAdm3 = !adm3 || prop.adm3_name === adm3
    const matchData = (prop.has_data && showHasData) || (!prop.has_data && showNoData)
    const matchMinSondages = (prop.n_sondages || 0) >= minSondages
    const show = matchAdm1 && matchAdm2 && matchAdm3 && matchData && matchMinSondages
    layer.setStyle({ 
      opacity: show ? 1 : 0, 
      fillOpacity: show ? (prop.has_data ? 0.35 : 0.06) : 0 
    })
  })

  updateFilterStats()
}

function updateFilterStats() {
  const adm1 = (document.getElementById('filterAdm1') as HTMLSelectElement).value
  const adm2 = (document.getElementById('filterAdm2') as HTMLSelectElement).value
  const adm3 = (document.getElementById('filterAdm3') as HTMLSelectElement).value
  const showHasData = (document.getElementById('filterHasData') as HTMLInputElement).checked
  const showNoData = (document.getElementById('filterNoData') as HTMLInputElement).checked
  const minSondages = parseInt((document.getElementById('filterMinSondages') as HTMLInputElement).value) || 0

  const filtered = allFeatures.filter((f: any) => {
    const prop = f.properties
    const matchAdm1 = !adm1 || prop.adm1_name === adm1
    const matchAdm2 = !adm2 || prop.adm2_name === adm2
    const matchAdm3 = !adm3 || prop.adm3_name === adm3
    const matchData = (prop.has_data && showHasData) || (!prop.has_data && showNoData)
    const matchMinSondages = (prop.n_sondages || 0) >= minSondages
    return matchAdm1 && matchAdm2 && matchAdm3 && matchData && matchMinSondages
  })

  let withData = 0
  let totalSondages = 0
  let totalEssais = 0

  filtered.forEach((f: any) => {
    if (f.properties?.has_data) withData++
    totalSondages += f.properties?.n_sondages || 0
    totalEssais += f.properties?.n_essais || 0
  })

  document.getElementById('statVisible')!.textContent = filtered.length.toLocaleString()
  document.getElementById('statWithData')!.textContent = withData.toLocaleString()
  document.getElementById('statSondages')!.textContent = totalSondages.toLocaleString()
  document.getElementById('statEssais')!.textContent = totalEssais.toLocaleString()
}

// --- Button handlers ---
document.getElementById('getBtn')!.addEventListener('click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  setStatus('Requête en cours…')
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}`)
    const out = document.getElementById('json')!
    if (!res.ok) {
      out.textContent = JSON.stringify({ status: res.status, error: await res.text() }, null, 2)
      toast('Erreur GET', 'err')
      setStatus('Erreur')
      return
    }
    const data = await res.json()
    out.textContent = JSON.stringify(data, null, 2)
    toast('OK')
    setStatus('OK')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur')
  }
})

document.getElementById('recomputeBtn')!.addEventListener('click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  setStatus('Recalcul IDW…')
  try {
    const res = await fetch(`${API_GEO}/grid/recompute/${encodeURIComponent(code)}`, { method: 'POST' })
    const out = document.getElementById('json')!
    if (!res.ok) {
      out.textContent = JSON.stringify({ status: res.status, error: await res.text() }, null, 2)
      toast('Erreur compute', 'err')
      setStatus('Erreur')
      return
    }
    const data = await res.json()
    out.textContent = JSON.stringify(data, null, 2)
    toast('Recalcul OK')
    setStatus('OK')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur')
  }
})

document.getElementById('shapeBtn')!.addEventListener('click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}/shape`)
    if (!res.ok) {
      toast('Erreur shape', 'err')
      return
    }
    const gj = await res.json()
    ;(document.getElementById('json')!).textContent = JSON.stringify(gj, null, 2)
    
    if (shapeLayer) shapeLayer.remove()
    shapeLayer = L.geoJSON(gj, { style: { color: '#3aa6ff', weight: 2, fillOpacity: 0.1 } }).addTo(map)
    const b = shapeLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.2))
    toast('Shape chargée')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// --- Export functions ---
async function getCurrentGridData() {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code de maille', 'err')
    return null
  }
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}`)
    if (!res.ok) return null
    return await res.json()
  } catch {
    return null
  }
}

function downloadFile(content: string, filename: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

document.getElementById('exportGeoJSON')!.addEventListener('click', async () => {
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}/shape`)
    if (!res.ok) {
      toast('Export impossible', 'err')
      return
    }
    const gj = await res.json()
    downloadFile(JSON.stringify(gj, null, 2), `${code}.geojson`, 'application/geo+json')
    toast('GeoJSON exporté')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

document.getElementById('exportMarkdown')!.addEventListener('click', async () => {
  const data = await getCurrentGridData()
  if (!data) {
    toast('Impossible de récupérer les données', 'err')
    return
  }
  
  const code = data.code
  const md = `# Maille ${code}

## Informations générales

- **Code**: ${code}
- **BBox**: [${data.bbox.map((v: number) => v.toFixed(6)).join(', ')}]
- **Région**: ${data.adm1_name || 'N/A'}
- **Préfecture**: ${data.adm2_name || 'N/A'}
- **Commune**: ${data.adm3_name || 'N/A'}

## Statistiques

- **Sondages**: ${data.summary?.n_sondages || 0}
- **Essais**: ${data.summary?.n_essais || 0}

### Répartition par type d'essai

${Object.entries(data.summary?.by_type || {}).map(([type, count]) => `- **${type}**: ${count}`).join('\\n')}

## IDW (Inverse Distance Weighting)

${data.stats?.idw ? `- **Type**: ${data.stats.idw.type}
- **Valeur**: ${data.stats.idw.value.toFixed(2)}
- **Puissance**: ${data.stats.idw.p}
- **Échantillons**: ${data.stats.samples}` : '_Pas de données IDW disponibles_'}

---

_Généré le ${new Date().toLocaleString('fr-FR')}_
`
  
  downloadFile(md, `${code}.md`, 'text/markdown')
  toast('Markdown exporté')
})

document.getElementById('exportPDF')!.addEventListener('click', async () => {
  const data = await getCurrentGridData()
  if (!data) {
    toast('Impossible de récupérer les données', 'err')
    return
  }
  
  // Génération PDF simple (HTML to PDF via print)
  const code = data.code
  const printWindow = window.open('', '_blank')
  if (!printWindow) {
    toast('Popup bloquée', 'err')
    return
  }
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>Maille ${code}</title>
      <style>
        body { font-family: Arial, sans-serif; padding: 20px; }
        h1 { color: #0b1220; }
        h2 { color: #3aa6ff; margin-top: 20px; }
        table { border-collapse: collapse; width: 100%; margin: 10px 0; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>Maille ${code}</h1>
      <h2>Informations générales</h2>
      <table>
        <tr><th>Code</th><td>${code}</td></tr>
        <tr><th>Région</th><td>${data.adm1_name || 'N/A'}</td></tr>
        <tr><th>Préfecture</th><td>${data.adm2_name || 'N/A'}</td></tr>
        <tr><th>Commune</th><td>${data.adm3_name || 'N/A'}</td></tr>
      </table>
      
      <h2>Statistiques</h2>
      <table>
        <tr><th>Sondages</th><td>${data.summary?.n_sondages || 0}</td></tr>
        <tr><th>Essais</th><td>${data.summary?.n_essais || 0}</td></tr>
      </table>
      
      ${data.stats?.idw ? `
      <h2>IDW</h2>
      <table>
        <tr><th>Type</th><td>${data.stats.idw.type}</td></tr>
        <tr><th>Valeur</th><td>${data.stats.idw.value.toFixed(2)}</td></tr>
        <tr><th>Échantillons</th><td>${data.stats.samples}</td></tr>
      </table>
      ` : '<p><em>Pas de données IDW disponibles</em></p>'}
      
      <p style="margin-top: 30px; font-size: 12px; color: #666;">
        Généré le ${new Date().toLocaleString('fr-FR')}
      </p>
    </body>
    </html>
  `)
  
  printWindow.document.close()
  setTimeout(() => {
    printWindow.print()
    toast('PDF généré (impression)')
  }, 500)
})

document.getElementById('exportAll')!.addEventListener('click', async () => {
  toast('Export complet en cours...', 'ok')
  // Pour un vrai export ZIP, il faudrait une bibliothèque comme JSZip
  // Pour l'instant, on exporte séquentiellement
  const code = codeInput.value.trim()
  if (!code) {
    toast('Entrez un code', 'err')
    return
  }
  
  // Export GeoJSON
  document.getElementById('exportGeoJSON')!.dispatchEvent(new Event('click'))
  await new Promise(resolve => setTimeout(resolve, 500))
  
  // Export Markdown
  document.getElementById('exportMarkdown')!.dispatchEvent(new Event('click'))
  await new Promise(resolve => setTimeout(resolve, 500))
  
  toast('Exports terminés (GeoJSON + MD)')
})

document.getElementById('zoomTgBtn')!.addEventListener('click', () => {
  if (gridLayer) {
    const b = gridLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.1))
  } else {
    map.fitBounds([[6.1, 0.7], [11.2, 1.8]])
  }
})

// --- Survey Management v1.2.0 ---
const surveyDrawer = document.getElementById('surveyDrawer')!
const drawerTitle = document.getElementById('drawerTitle')!
const surveyForm = document.getElementById('surveyForm')!
const surveyListView = document.getElementById('surveyListView')!
let currentSurveyId: string | null = null
let surveyMarkers: L.Marker[] = []
let highlightedLayer: any = null

// État global pour le nouveau formulaire
let tests: Array<{type: string, value: number, depth_m: number}> = []
let selectedAdm1 = '', selectedAdm2 = '', selectedAdm3 = ''

// Highlight maille avec animation
function highlightMaille(lat: number, lon: number) {
  if (!gridLayer) return
  
  // Trouver la maille contenant le point
  let targetLayer: any = null
  gridLayer.eachLayer((layer: any) => {
    const bounds = layer.getBounds()
    if (bounds.contains([lat, lon])) {
      targetLayer = layer
    }
  })
  
  if (!targetLayer) return
  
  // Retirer ancien highlight
  if (highlightedLayer) {
    gridLayer.resetStyle(highlightedLayer)
  }
  
  // Appliquer animation
  targetLayer.setStyle({
    color: '#3aa6ff',
    weight: 3,
    fillOpacity: 0.3
  })
  
  // Animer 5 fois
  let count = 0
  const interval = setInterval(() => {
    if (count >= 10) {
      clearInterval(interval)
      gridLayer.resetStyle(targetLayer)
      highlightedLayer = null
      return
    }
    
    if (count % 2 === 0) {
      targetLayer.setStyle({
        color: '#ff3a6f',
        weight: 5,
        fillOpacity: 0.6
      })
    } else {
      targetLayer.setStyle({
        color: '#3aa6ff',
        weight: 3,
        fillOpacity: 0.3
      })
    }
    count++
  }, 300)
  
  highlightedLayer = targetLayer
}

function openDrawer(mode: 'create' | 'list' | 'import') {
  surveyDrawer.classList.add('open')
  const importView = document.getElementById('importCsvView')!
  
  if (mode === 'create') {
    drawerTitle.textContent = 'Nouveau sondage'
    surveyForm.style.display = 'block'
    surveyListView.style.display = 'none'
    importView.style.display = 'none'
    resetSurveyForm()
  } else if (mode === 'import') {
    drawerTitle.textContent = '📥 Import CSV/Bulk'
    surveyForm.style.display = 'none'
    surveyListView.style.display = 'none'
    importView.style.display = 'block'
  } else {
    drawerTitle.textContent = 'Liste des sondages'
    surveyForm.style.display = 'none'
    surveyListView.style.display = 'block'
    importView.style.display = 'none'
    loadSurveyList()
  }
}

function closeDrawer() {
  surveyDrawer.classList.remove('open')
  currentSurveyId = null
}

function resetSurveyForm() {
  ;(document.getElementById('surveyCode') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyDate') as HTMLInputElement).value = ''
  ;(document.getElementById('surveySource') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyOperator') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyLon') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyLat') as HTMLInputElement).value = ''
  ;(document.getElementById('surveyNotes') as HTMLTextAreaElement).value = ''
  ;(document.getElementById('locationMode') as HTMLSelectElement).value = 'exact'
  tests = []
  selectedAdm1 = ''
  selectedAdm2 = ''
  selectedAdm3 = ''
  renderTestsTable()
  updateSummary()
  toggleLocationSections()
  currentSurveyId = null
}

// Toggle sections selon mode de localisation
function toggleLocationSections() {
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  document.getElementById('coordsSection')!.style.display = mode === 'exact' ? 'block' : 'none'
  document.getElementById('admSection')!.style.display = mode !== 'exact' ? 'block' : 'none'
  document.getElementById('centroidOption')!.style.display = mode === 'centroid' ? 'block' : 'none'
}

// Charger ADM1
async function loadAdm1() {
  try {
    const res = await fetch(`${API_GEO}/adm1`)
    if (!res.ok) return
    const zones = await res.json()
    const select = document.getElementById('selectAdm1') as HTMLSelectElement
    select.innerHTML = '<option value="">— Sélectionner —</option>'
    zones.forEach((z: any) => {
      const opt = document.createElement('option')
      opt.value = z.name
      opt.textContent = z.name
      select.appendChild(opt)
    })
  } catch (e) {
    console.error('Erreur chargement ADM1:', e)
  }
}

// Render tests table
function renderTestsTable() {
  const tbody = document.getElementById('testsTableBody')!
  if (tests.length === 0) {
    tbody.innerHTML = '<tr><td colspan="4" style="text-align:center;color:var(--muted);padding:12px">Aucun essai</td></tr>'
  } else {
    tbody.innerHTML = tests.map((t, i) => `
      <tr style="border:1px solid #22304d">
        <td style="padding:8px">${t.type}</td>
        <td style="padding:8px">${t.value}</td>
        <td style="padding:8px">${t.depth_m}</td>
        <td style="padding:8px;text-align:center">
          <button onclick="window.deleteTest(${i})" style="background:transparent;border:1px solid #6b1b2c;color:var(--err);padding:4px 8px;font-size:11px;cursor:pointer;border-radius:4px">🗑️</button>
        </td>
      </tr>
    `).join('')
  }
  updateSummary()
}

// Fonction globale pour supprimer un essai
(window as any).deleteTest = (index: number) => {
  tests.splice(index, 1)
  renderTestsTable()
}

// Mettre à jour le résumé
function updateSummary() {
  document.getElementById('summaryAdm1')!.textContent = selectedAdm1 || '—'
  document.getElementById('summaryAdm2')!.textContent = selectedAdm2 || '—'
  document.getElementById('summaryAdm3')!.textContent = selectedAdm3 || '—'
  document.getElementById('summaryTests')!.textContent = tests.length.toString()
  
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  const alerts = document.getElementById('summaryAlerts')!
  
  if (mode === 'exact') {
    const lon = parseFloat((document.getElementById('surveyLon') as HTMLInputElement).value)
    const lat = parseFloat((document.getElementById('surveyLat') as HTMLInputElement).value)
    if (!isNaN(lon) && !isNaN(lat)) {
      // Localiser la maille
      fetch(`${API_GEO}/grid/locate?lon=${lon}&lat=${lat}`)
        .then(r => r.json())
        .then(data => {
          document.getElementById('summaryMaille')!.textContent = data.code || '—'
          selectedAdm1 = data.adm1_name || ''
          selectedAdm2 = data.adm2_name || ''
          selectedAdm3 = data.adm3_name || ''
          document.getElementById('summaryAdm1')!.textContent = selectedAdm1 || '—'
          document.getElementById('summaryAdm2')!.textContent = selectedAdm2 || '—'
          document.getElementById('summaryAdm3')!.textContent = selectedAdm3 || '—'
          alerts.innerHTML = ''
        })
        .catch(() => {
          document.getElementById('summaryMaille')!.textContent = '—'
          alerts.innerHTML = '<div style="color:var(--err)">⚠️ Point hors grille</div>'
        })
    }
  } else {
    document.getElementById('summaryMaille')!.textContent = mode === 'unknown' ? 'N/A' : '(calculé après création)'
    alerts.innerHTML = mode === 'unknown' ? '<div style="color:var(--warn)">ℹ️ Sondage sans coordonnées</div>' : ''
  }
}

// Create survey v1.2.0
document.getElementById('saveSurveyBtn')!.addEventListener('click', async () => {
  const mode = (document.getElementById('locationMode') as HTMLSelectElement).value
  const code = (document.getElementById('surveyCode') as HTMLInputElement).value.trim()
  const date = (document.getElementById('surveyDate') as HTMLInputElement).value
  const source = (document.getElementById('surveySource') as HTMLInputElement).value.trim()
  const operator = (document.getElementById('surveyOperator') as HTMLInputElement).value
  const notes = (document.getElementById('surveyNotes') as HTMLTextAreaElement).value
  
  // Validation champs obligatoires
  const errors: string[] = []
  if (!code) errors.push('Code sondage')
  if (!source) errors.push('Source')
  if (tests.length === 0) errors.push('Au moins 1 essai')
  
  if (errors.length > 0) {
    toast(`❌ Champs obligatoires manquants: ${errors.join(', ')}`, 'err')
    return
  }
  
  // Construire le payload
  let payload: any = {
    survey: { code, date, source, operator, notes },
    tests,
    snap_to_grid: true
  }
  
  if (mode === 'exact') {
    const lon = parseFloat((document.getElementById('surveyLon') as HTMLInputElement).value)
    const lat = parseFloat((document.getElementById('surveyLat') as HTMLInputElement).value)
    if (isNaN(lon) || isNaN(lat)) {
      toast('Coordonnées requises', 'err')
      return
    }
    payload.location = { lon, lat }
  } else if (mode === 'centroid') {
    const adm3 = (document.getElementById('selectAdm3') as HTMLSelectElement).value
    if (!adm3) {
      toast('Sélectionner une commune', 'err')
      return
    }
    payload.commune_id = `ADM3-${adm3}`
    payload.use_commune_centroid = (document.getElementById('useCentroid') as HTMLInputElement).checked
  }
  // mode 'unknown': pas de location ni commune_id
  
  try {
    const res = await fetch(`${API_GEO}/surveys`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
    
    if (!res.ok) {
      const err = await res.json()
      toast(`Erreur: ${err.error}`, 'err')
      return
    }
    
    const data = await res.json()
    toast(`✅ Sondage créé: ${data.sondage_id.substring(0, 8)}... (${data.essais_count} essais, maille: ${data.maille_code || 'N/A'})`)
    
    // NE PAS fermer le drawer, juste réinitialiser le formulaire
    resetSurveyForm()
    loadGrid()
    
    // Message de confirmation convivial
    const summaryDiv = document.getElementById('surveySummary')!
    summaryDiv.innerHTML = `
      <div style="background: var(--ok); color: white; padding: 12px; border-radius: 6px; margin-top: 12px;">
        <div style="font-weight: bold; margin-bottom: 6px;">✅ Sondage enregistré avec succès !</div>
        <div style="font-size: 0.9em; opacity: 0.9;">
          ID: ${data.sondage_id.substring(0, 13)}...<br>
          Maille: ${data.maille_code || 'N/A'}<br>
          Essais: ${data.essais_count}
        </div>
      </div>
    `
    setTimeout(() => updateSummary(), 3000)
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

document.getElementById('cancelSurveyBtn')!.addEventListener('click', closeDrawer)
document.getElementById('closeDrawer')!.addEventListener('click', closeDrawer)

// Event listeners pour le formulaire
document.getElementById('locationMode')!.addEventListener('change', () => {
  toggleLocationSections()
  updateSummary()
})

document.getElementById('surveyLon')!.addEventListener('input', updateSummary)
document.getElementById('surveyLat')!.addEventListener('input', updateSummary)

// Cascade ADM2
document.getElementById('selectAdm1')!.addEventListener('change', async (e) => {
  const adm1 = (e.target as HTMLSelectElement).value
  selectedAdm1 = adm1
  selectedAdm2 = ''
  selectedAdm3 = ''
  
  if (!adm1) {
    ;(document.getElementById('selectAdm2') as HTMLSelectElement).innerHTML = '<option value="">— Sélectionner —</option>'
    ;(document.getElementById('selectAdm3') as HTMLSelectElement).innerHTML = '<option value="">— Sélectionner —</option>'
    updateSummary()
    return
  }
  
  try {
    const res = await fetch(`${API_GEO}/adm2?adm1=${encodeURIComponent(adm1)}`)
    if (!res.ok) return
    const zones = await res.json()
    const select = document.getElementById('selectAdm2') as HTMLSelectElement
    select.innerHTML = '<option value="">— Sélectionner —</option>'
    zones.forEach((z: any) => {
      const opt = document.createElement('option')
      opt.value = z.name
      opt.textContent = z.name
      select.appendChild(opt)
    })
  } catch (e) {
    console.error('Erreur chargement ADM2:', e)
  }
  
  updateSummary()
})

// Cascade ADM3
document.getElementById('selectAdm2')!.addEventListener('change', async (e) => {
  const adm2 = (e.target as HTMLSelectElement).value
  selectedAdm2 = adm2
  selectedAdm3 = ''
  
  if (!adm2) {
    ;(document.getElementById('selectAdm3') as HTMLSelectElement).innerHTML = '<option value="">— Sélectionner —</option>'
    updateSummary()
    return
  }
  
  try {
    const res = await fetch(`${API_GEO}/adm3?adm2=${encodeURIComponent(adm2)}`)
    if (!res.ok) return
    const zones = await res.json()
    const select = document.getElementById('selectAdm3') as HTMLSelectElement
    select.innerHTML = '<option value="">— Sélectionner —</option>'
    zones.forEach((z: any) => {
      const opt = document.createElement('option')
      opt.value = z.name
      opt.textContent = z.name
      select.appendChild(opt)
    })
  } catch (e) {
    console.error('Erreur chargement ADM3:', e)
  }
  
  updateSummary()
})

document.getElementById('selectAdm3')!.addEventListener('change', (e) => {
  selectedAdm3 = (e.target as HTMLSelectElement).value
  updateSummary()
})

// Ajouter essai
document.getElementById('addTestBtn')!.addEventListener('click', () => {
  const type = prompt('Type (SPT_N ou qc):')
  if (!type) return
  
  const valueStr = prompt('Valeur:')
  if (!valueStr) return
  const value = parseFloat(valueStr)
  
  const depthStr = prompt('Profondeur (m):')
  if (!depthStr) return
  const depth_m = parseFloat(depthStr)
  
  // Validation
  if (type === 'SPT_N' && (value < 0 || value > 100 || value % 1 !== 0)) {
    toast('SPT_N invalide (entier 0-100)', 'err')
    return
  }
  if (type === 'qc' && (value < 0.1 || value > 50)) {
    toast('qc invalide (0.1-50 MPa)', 'err')
    return
  }
  if (depth_m < 0.5 || depth_m > 60) {
    toast('Profondeur invalide (0.5-60 m)', 'err')
    return
  }
  
  tests.push({type, value, depth_m})
  renderTestsTable()
})

// Open drawer for new survey
document.getElementById('newSurveyBtn')!.addEventListener('click', () => {
  openDrawer('create')
  loadAdm1()
})

// Open drawer for survey list
document.getElementById('listSurveysBtn')!.addEventListener('click', () => openDrawer('list'))

// Open drawer for CSV import
document.getElementById('importCsvBtn')!.addEventListener('click', () => openDrawer('import'))

// Cancel import
document.getElementById('cancelImportBtn')!.addEventListener('click', closeDrawer)

// Process CSV import
document.getElementById('processCsvBtn')!.addEventListener('click', async () => {
  const csvText = (document.getElementById('csvInput') as HTMLTextAreaElement).value.trim()
  if (!csvText) {
    toast('Veuillez saisir des données CSV', 'err')
    return
  }
  
  // Parser CSV
  const lines = csvText.split('\n').filter(l => l.trim())
  if (lines.length < 2) {
    toast('CSV invalide (minimum 2 lignes)', 'err')
    return
  }
  
  const headers = lines[0].split(',')
  const rows = []
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',')
    const row: any = {}
    headers.forEach((h, idx) => {
      row[h.trim()] = values[idx]?.trim()
    })
    rows.push({
      code: row.code,
      date: row.date,
      source: row.source,
      operator: row.operator,
      lat: parseFloat(row.lat),
      lon: parseFloat(row.lon),
      test_type: row.test_type,
      test_value: parseFloat(row.test_value),
      test_depth_m: parseFloat(row.test_depth_m),
      notes: row.notes
    })
  }
  
  try {
    const res = await fetch(`${API_GEO}/surveys/bulk`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ rows })
    })
    
    if (!res.ok) {
      toast('Erreur import', 'err')
      return
    }
    
    const data = await res.json()
    const resultsDiv = document.getElementById('importResults')!
    resultsDiv.innerHTML = `
      <div style="background: var(--ok); color: white; padding: 12px; border-radius: 6px;">
        <div style="font-weight: bold;">✅ Import terminé !</div>
        <div style="margin-top: 8px;">
          Créés: ${data.created}<br>
          Rejetés: ${data.rejected}
        </div>
      </div>
    `
    
    if (data.errors && data.errors.length > 0) {
      resultsDiv.innerHTML += `
        <div style="background: var(--err); color: white; padding: 12px; border-radius: 6px; margin-top: 8px; max-height: 200px; overflow-y: auto;">
          <div style="font-weight: bold;">Erreurs:</div>
          ${data.errors.map((e: any) => `<div style="margin-top: 4px; font-size: 12px;">Ligne ${e.row}: ${e.error}</div>`).join('')}
        </div>
      `
    }
    
    toast(`✅ Import: ${data.created} créés, ${data.rejected} rejetés`)
    loadGrid()
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
})

// Load survey list
async function loadSurveyList() {
  try {
    const res = await fetch(`${API_GEO}/surveys`)
    if (!res.ok) {
      toast('Erreur chargement sondages', 'err')
      return
    }
    const surveys = await res.json()
    renderSurveyList(surveys)
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
}

function renderSurveyList(surveys: any[]) {
  const list = document.getElementById('surveyList')!
  if (surveys.length === 0) {
    list.innerHTML = '<p style="color:var(--muted);text-align:center;padding:20px">Aucun sondage</p>'
    return
  }

  list.innerHTML = surveys.map(s => {
    const code = s.code || `Sondage-${s.id?.substring(0, 8) || '?'}`
    const maille = s.maille_code || ''
    const lon = (typeof s.lon === 'number' && !isNaN(s.lon)) ? s.lon.toFixed(4) : '—'
    const lat = (typeof s.lat === 'number' && !isNaN(s.lat)) ? s.lat.toFixed(4) : '—'
    const depthMin = (typeof s.depth_m_min === 'number' && !isNaN(s.depth_m_min)) ? s.depth_m_min.toFixed(1) : '0.0'
    const depthMax = (typeof s.depth_m_max === 'number' && !isNaN(s.depth_m_max)) ? s.depth_m_max.toFixed(1) : '10.0'
    const region = s.adm1_name || ''
    
    return `
      <div class="survey-card" data-id="${s.id}">
        <div class="survey-card-header">
          <div class="survey-card-code">${code}</div>
          <div style="font-size:11px;color:var(--muted)">${maille}</div>
        </div>
        <div class="survey-card-meta">
          📍 ${lon}, ${lat}<br>
          📏 ${depthMin}-${depthMax}m<br>
          ${region ? `📌 ${region}` : ''}
        </div>
      </div>
    `
  }).join('')

  // Click to view on map
  list.querySelectorAll('.survey-card').forEach(card => {
    card.addEventListener('click', () => {
      const survey = surveys.find(s => s.id === card.getAttribute('data-id'))
      if (survey && survey.lat && survey.lon) {
        // Zoom et highlight
        map.setView([survey.lat, survey.lon], 15)
        highlightMaille(survey.lat, survey.lon)
        
        // Ajouter marqueur temporaire pulsant
        const tempMarker = L.circleMarker([survey.lat, survey.lon], {
          radius: 8,
          color: '#ff3a6f',
          fillColor: '#ff3a6f',
          fillOpacity: 0.8,
          weight: 3,
          className: 'survey-marker-pulse'
        }).addTo(map)
        
        tempMarker.bindPopup(`<b>${survey.code}</b><br>📏 ${survey.depth_m_min || 0}-${survey.depth_m_max || 0}m<br>📌 ${survey.adm1_name || 'N/A'}`).openPopup()
        
        // Retirer après 5s
        setTimeout(() => {
          map.removeLayer(tempMarker)
        }, 5000)
        
        toast(`📍 ${survey.code}`)
      }
    })
  })
}

// Search surveys
document.getElementById('searchSurveys')!.addEventListener('input', (e) => {
  const query = (e.target as HTMLInputElement).value.toLowerCase()
  document.querySelectorAll('.survey-card').forEach(card => {
    const text = card.textContent?.toLowerCase() || ''
    ;(card as HTMLElement).style.display = text.includes(query) ? 'block' : 'none'
  })
})

// Map click to create survey
map.on('click', (e: L.LeafletMouseEvent) => {
  if (surveyDrawer.classList.contains('open') && surveyForm.style.display !== 'none') {
    ;(document.getElementById('surveyLon') as HTMLInputElement).value = e.latlng.lng.toFixed(6)
    ;(document.getElementById('surveyLat') as HTMLInputElement).value = e.latlng.lat.toFixed(6)
    toast('Coordonnées remplies depuis la carte')
  }
})

// Auto-load grid on startup
loadGrid()

// Initialiser la table des tests
renderTestsTable()
