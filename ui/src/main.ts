import L from 'leaflet'

// Base URLs with runtime override support
const API_GEO = (import.meta.env.VITE_API_GEO ?? (window as any).__API_GEO__ ?? '') as string
const API_INFER = (import.meta.env.VITE_API_INFER ?? (window as any).__API_INFER__ ?? '') as string
const API_OPTI = (import.meta.env.VITE_API_OPTI ?? (window as any).__API_OPTI__ ?? '') as string

const map = L.map('map', { preferCanvas: true }).setView([8.6195, 0.8248], 7) // Togo approx
L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  maxZoom: 18,
  attribution: '&copy; OpenStreetMap'
}).addTo(map)

const output = document.getElementById('output') as HTMLPreElement
const codeInput = document.getElementById('grid-code') as HTMLInputElement
const info = document.getElementById('info') as HTMLDivElement
const statusEl = document.getElementById('status') as HTMLDivElement | null
let bboxLayer: L.Rectangle | null = null
let gridLayer: L.GeoJSON<any> | null = null
let shapeLayer: L.GeoJSON<any> | null = null

function show(o: any) {
  output.textContent = JSON.stringify(o, null, 2)
}

async function call(url: string, opts?: RequestInit) {
  if (statusEl) statusEl.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid #9ca3af;border-top-color:#111;border-radius:50%;animation:spin 1s linear infinite;margin-right:6px"></span>Loading…'
  try {
    const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json' } })
    const text = await res.text()
    let data: any = {}
    try { data = text ? JSON.parse(text) : {} } catch { data = { raw: text } }
    if (statusEl) statusEl.innerHTML = res.ok
      ? `<span style="background:#10b981;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">OK</span> (${res.status})`
      : `<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">Error</span> (${res.status})`
    if (!res.ok) {
      show({ status: res.status, error: data?.error ?? text ?? res.statusText })
      return
    }
    show({ status: res.status, data })
    // if grid payload, render info
    if (data && data.bbox && Array.isArray(data.bbox) && data.bbox.length === 4) {
      const [xmin, ymin, xmax, ymax] = data.bbox as [number, number, number, number]
      // draw bbox in 4326
      if (bboxLayer) bboxLayer.remove()
      const bounds = L.latLngBounds([ymin, xmin], [ymax, xmax])
      bboxLayer = L.rectangle(bounds, { color: '#ef4444', weight: 2 })
      bboxLayer.addTo(map)
      map.fitBounds(bounds.pad(0.25))
      const nSond = data.summary?.n_sondages ?? 0
      const nEss = data.summary?.n_essais ?? 0
      const idwVal = data.stats?.idw?.value
      info.innerHTML = `
        <strong>Code:</strong> ${data.code}<br/>
        <strong>BBox:</strong> [${xmin.toFixed(5)}, ${ymin.toFixed(5)}, ${xmax.toFixed(5)}, ${ymax.toFixed(5)}]<br/>
        <strong>Comptes:</strong> sondages=${nSond}, essais=${nEss}<br/>
        <strong>IDW (SPT_N, p=2):</strong> ${idwVal !== undefined ? Number(idwVal).toFixed(2) : '—'}
      `
    }
  } catch (e: any) {
    if (statusEl) statusEl.innerHTML = `<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">Error</span> Network error`
    show({ error: e?.message ?? String(e) })
  }
}

(document.getElementById('btn-grid') as HTMLButtonElement).onclick = () => {
  if (!API_GEO) return bannerMissing()
  call(`${API_GEO}/grid/${encodeURIComponent(codeInput.value)}`)
}

(document.getElementById('btn-recompute') as HTMLButtonElement).onclick = () => {
  if (!API_GEO) return bannerMissing()
  call(`${API_GEO}/grid/recompute/${encodeURIComponent(codeInput.value)}`, { method: 'POST' })
}

(document.getElementById('btn-predict') as HTMLButtonElement).onclick = () => {
  if (!API_INFER) return bannerMissing('INFER')
  call(`${API_INFER}/predict`, { method: 'POST', body: JSON.stringify({ features: [1,2,3] }) })
}

(document.getElementById('btn-pareto') as HTMLButtonElement).onclick = () => {
  if (!API_OPTI) return bannerMissing('OPTI')
  call(`${API_OPTI}/pareto`, { method: 'POST', body: JSON.stringify({ scenario: { k: 1 } }) })
}

function bannerMissing(kind: 'GEO' | 'INFER' | 'OPTI' | undefined = 'GEO') {
  const id = 'banner'
  let b = document.getElementById(id)
  if (!b) {
    b = document.createElement('div')
    b.id = id
    b.style.background = '#fde68a'
    b.style.color = '#7c2d12'
    b.style.padding = '8px'
    b.style.margin = '8px 0'
    b.style.border = '1px solid #f59e0b'
    document.body.prepend(b)
  }
  const which = kind ?? 'GEO'
  const varName = which === 'GEO' ? 'VITE_API_GEO' : which === 'INFER' ? 'VITE_API_INFER' : 'VITE_API_OPTI'
  b.textContent = `API base URL is not configured. Set ${varName} in ui/.env.production and rebuild.`
}

// Show initial banner if main GEO endpoint missing
if (!API_GEO) {
  bannerMissing('GEO')
}

// --- Coverage grid loading & interactions with viewport filtering ---
type BBox = [number, number, number, number] // [minX, minY, maxX, maxY]
let gridFeatures: any[] = []

function bboxOfGeom(geom: any): BBox {
  const upd = (b: BBox, x: number, y: number): BBox => [
    Math.min(b[0], x),
    Math.min(b[1], y),
    Math.max(b[2], x),
    Math.max(b[3], y),
  ]
  const walk = (coords: any, b: BBox): BBox => {
    if (typeof coords[0] === 'number') return upd(b, coords[0], coords[1])
    for (const c of coords) b = walk(c, b)
    return b
  }
  return walk(geom.coordinates, [Infinity, Infinity, -Infinity, -Infinity])
}

function intersects(b: BBox, view: L.LatLngBounds): boolean {
  return (
    b[2] >= view.getWest() &&
    b[0] <= view.getEast() &&
    b[3] >= view.getSouth() &&
    b[1] <= view.getNorth()
  )
}

function setStatus(msg: string) {
  if (statusEl) statusEl.textContent = msg
}

function renderGrid() {
  if (!gridFeatures.length) return
  const view = map.getBounds()

  // Sous-ensemble des features visibles
  const subset = []
  for (const f of gridFeatures) {
    const bb = f.properties.__bbox as BBox
    if (intersects(bb, view)) subset.push(f)
    if (subset.length > 2500) break // garde-fou perf
  }

  if (gridLayer) gridLayer.clearLayers()
  if (!gridLayer) {
    gridLayer = L.geoJSON(null, {
      style: (feat: any) => {
        const has = !!feat?.properties?.has_data
        return {
          color: has ? '#cc0000' : '#666',
          weight: has ? 1.0 : 0.5,
          opacity: has ? 0.9 : 0.4,
          fillOpacity: has ? 0.35 : 0.0,
        }
      },
      onEachFeature: (feat: any, layer: L.Layer) => {
        layer.on('click', () => {
          const code = feat?.properties?.code
          if (code && codeInput) {
            codeInput.value = code
            ;(document.getElementById('btn-grid') as HTMLButtonElement).click()
          }
        })
      }
    }).addTo(map)
  }

  gridLayer.addData({ type: 'FeatureCollection', features: subset })
  setStatus(`Grille: ${subset.length} mailles visibles / ${gridFeatures.length}`)
}

async function loadCoverage() {
  if (!API_GEO) return
  setStatus('Chargement des mailles…')
  try {
    const res = await fetch(`${API_GEO}/coverage/mailles`)
    if (!res.ok) {
      setStatus(`Erreur chargement (${res.status})`)
      return
    }
    const fc = await res.json()
    gridFeatures = (fc.features ?? []).map((f: any) => {
      // calcule et mémorise un bbox pour filtre rapide
      f.properties = f.properties ?? {}
      f.properties.__bbox = bboxOfGeom(f.geometry)
      return f
    })
    setStatus(`Grille chargée (${gridFeatures.length} mailles)`)
    renderGrid()
  } catch (e: any) {
    setStatus(`Erreur: ${String(e)}`)
  }
}

// Re-render grid on map move/zoom
map.on('moveend', () => renderGrid())

// Button: GET /grid/{code}/shape
;(document.getElementById('btn-shape') as HTMLButtonElement).onclick = async () => {
  if (!API_GEO) return bannerMissing()
  if (statusEl) statusEl.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid #9ca3af;border-top-color:#111;border-radius:50%;animation:spin 1s linear infinite;margin-right:6px"></span>Loading shape…'
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(codeInput.value)}/shape`)
    const feat = await res.json()
    if (shapeLayer) shapeLayer.remove()
    shapeLayer = L.geoJSON(feat, { style: { color: '#2563eb', weight: 2, fillOpacity: 0.1 } }).addTo(map)
    const b = shapeLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.2))
    if (statusEl) statusEl.innerHTML = `<span style="background:#10b981;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">OK</span> (${res.status})`
    show({ status: res.status, data: feat })
  } catch (e: any) {
    if (statusEl) statusEl.innerHTML = `<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">Error</span> loading shape`
    show({ error: e?.message ?? String(e) })
  }
}

// Button: Export GeoJSON
;(document.getElementById('btn-export') as HTMLButtonElement).onclick = async () => {
  if (!API_GEO) return bannerMissing()
  const code = codeInput.value
  if (!code) {
    if (statusEl) statusEl.innerHTML = `<span style="background:#f59e0b;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">Warning</span> Code maille requis`
    return
  }
  if (statusEl) statusEl.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid #9ca3af;border-top-color:#111;border-radius:50%;animation:spin 1s linear infinite;margin-right:6px"></span>Exporting…'
  try {
    const res = await fetch(`${API_GEO}/grid/${encodeURIComponent(code)}/shape`)
    if (!res.ok) {
      if (statusEl) statusEl.innerHTML = `<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">Error</span> (${res.status})`
      show({ status: res.status, error: 'Failed to fetch shape' })
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
    if (statusEl) statusEl.innerHTML = `<span style="background:#10b981;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">OK</span> Exported ${code}.geojson`
  } catch (e: any) {
    if (statusEl) statusEl.innerHTML = `<span style="background:#ef4444;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">Error</span> Export failed`
    show({ error: e?.message ?? String(e) })
  }
}

// Button: Zoom Togo (bounds of coverage)
;(document.getElementById('btn-zoom') as HTMLButtonElement).onclick = () => {
  if (gridLayer) {
    const b = gridLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.1))
  }
}

// Auto-load coverage on startup
loadCoverage()
