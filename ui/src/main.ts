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

    buildAdmFilter(gj)
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
    setStatus('Erreur de chargement')
  }
}

// --- ADM filter ---
function buildAdmFilter(gj: any) {
  const s = document.getElementById('filterAdm') as HTMLSelectElement
  const set = new Set<string>()
  gj.features.forEach((f: any) => {
    if (f.properties?.adm1_name) set.add(f.properties.adm1_name)
  })
  ;[...set].sort().forEach(v => {
    const opt = document.createElement('option')
    opt.value = v
    opt.textContent = v
    s.appendChild(opt)
  })
  s.onchange = () => {
    const v = s.value
    if (!gridLayer) return
    gridLayer.eachLayer((layer: any) => {
      const prop = layer.feature.properties
      const show = !v || prop.adm1_name === v
      layer.setStyle({ opacity: show ? 1 : 0, fillOpacity: show ? (prop.has_data ? 0.35 : 0.06) : 0 })
    })
  }
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

document.getElementById('exportBtn')!.addEventListener('click', async () => {
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
    const blob = new Blob([JSON.stringify(gj, null, 2)], { type: 'application/geo+json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${code}.geojson`
    a.click()
    URL.revokeObjectURL(url)
    toast('Exporté')
  } catch (e: any) {
    toast(`Erreur: ${e.message}`, 'err')
  }
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
