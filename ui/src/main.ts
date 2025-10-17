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
  setTimeout(() => el.style.display = 'none', 2500)
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
  return {
    color: has ? '#e85d68' : '#6b778c55',
    weight: has ? 1.2 : 0.5,
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
function onEachFeature(f: any, layer: any) {
  const p = f.properties || {}
  const title = `Code: ${p.code || '—'}${p.adm1_name ? `\nRégion: ${p.adm1_name}` : ''}${p.n_sondages != null ? `\nSondages: ${p.n_sondages}` : ''}`
  layer.bindTooltip(title, { sticky: true, opacity: 0.9 })
  layer.on({
    mouseover: highlightFeature,
    mouseout: resetHighlight,
    click: () => {
      codeInput.value = p.code || ''
      map.fitBounds(layer.getBounds(), { maxZoom: 14 })
      ;(document.getElementById('getBtn') as HTMLButtonElement).click()
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

// Auto-load grid on startup
loadGrid()
