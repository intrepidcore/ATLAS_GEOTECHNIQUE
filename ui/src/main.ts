import L from 'leaflet'

// Base URLs with runtime override support
const API_GEO = (import.meta.env.VITE_API_GEO ?? (window as any).__API_GEO__ ?? '') as string
const API_INFER = (import.meta.env.VITE_API_INFER ?? (window as any).__API_INFER__ ?? '') as string
const API_OPTI = (import.meta.env.VITE_API_OPTI ?? (window as any).__API_OPTI__ ?? '') as string

const map = L.map('map').setView([8.6195, 0.8248], 7) // Togo approx
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

// --- Coverage grid loading & interactions ---
async function loadCoverage() {
  if (!API_GEO) return
  if (statusEl) statusEl.textContent = 'Loading coverage…'
  try {
    const res = await fetch(`${API_GEO}/coverage/mailles`)
    const fc = await res.json()
    if (gridLayer) gridLayer.remove()
    gridLayer = L.geoJSON(fc, {
      style: (feat: any) => {
        const has = !!feat?.properties?.has_data
        return {
          color: has ? '#991b1b' : '#9ca3af',
          weight: has ? 1.5 : 1,
          fillColor: '#ef4444',
          fillOpacity: has ? 0.45 : 0.0,
        }
      },
      onEachFeature: (feature: any, layer: L.Layer) => {
        layer.on('click', () => {
          const c = (feature.properties as any)?.code
          if (c) {
            codeInput.value = c
            ;(document.getElementById('btn-grid') as HTMLButtonElement).click()
          }
        })
      }
    }).addTo(map)
    if (statusEl) statusEl.innerHTML = `<span style="background:#10b981;color:white;padding:2px 6px;border-radius:4px;margin-right:6px">OK</span> (${res.status})`
    const b = gridLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.1))
  } catch (e: any) {
    if (statusEl) statusEl.textContent = 'Error loading coverage'
  }
}

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

// Button: Zoom Togo (bounds of coverage)
;(document.getElementById('btn-zoom') as HTMLButtonElement).onclick = () => {
  if (gridLayer) {
    const b = gridLayer.getBounds()
    if (b.isValid()) map.fitBounds(b.pad(0.1))
  }
}

// Auto-load coverage on startup
loadCoverage()
