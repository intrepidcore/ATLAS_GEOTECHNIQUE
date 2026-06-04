import { Chart, registerables } from 'chart.js'
import { getApiBase } from './api-base'
import { tokenStorage } from './services/auth-api'
import { parseKedApiParameterId } from './thematic/thematic-types'
import { getActiveThematicParameterId } from './thematic/thematic-parameter-context'

// Register chart types (safe if already registered elsewhere)
Chart.register(...registerables)

type ScientificTabId = 'eda' | 'corr' | 'variogram' | 'validation' | 'ml' | 'compare' | 'viz3d'

type ThematicFeature = {
  properties?: {
    value?: unknown
    code?: unknown
    cell_id?: unknown
    grid_id?: unknown
    maille_code?: unknown
  }
  geometry?: any
}

function getKey(p: any): string | null {
  const k =
    p?.cell_id ??
    p?.code ??
    p?.grid_id ??
    p?.maille_code ??
    p?.id ??
    null
  if (k === null || k === undefined || k === '') return null
  return String(k)
}

function pearsonCorrelation(xs: number[], ys: number[]): number | null {
  const n = Math.min(xs.length, ys.length)
  if (n < 2) return null
  let sumX = 0
  let sumY = 0
  let sumXX = 0
  let sumYY = 0
  let sumXY = 0

  for (let i = 0; i < n; i++) {
    const x = xs[i]!
    const y = ys[i]!
    sumX += x
    sumY += y
    sumXX += x * x
    sumYY += y * y
    sumXY += x * y
  }

  const numerator = n * sumXY - sumX * sumY
  const denomPart1 = n * sumXX - sumX * sumX
  const denomPart2 = n * sumYY - sumY * sumY
  const denom = Math.sqrt(denomPart1 * denomPart2)
  if (!Number.isFinite(denom) || denom === 0) return null
  return numerator / denom
}

function haversineKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371 // Earth radius (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) * Math.sin(dLon / 2)
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  return R * c
}

function polygonOrMultiBbox(geom: any): { minLon: number; minLat: number; maxLon: number; maxLat: number } | null {
  if (!geom) return null
  const type = geom.type
  const coords = geom.coordinates
  if (!coords) return null

  let minLon = Number.POSITIVE_INFINITY
  let minLat = Number.POSITIVE_INFINITY
  let maxLon = Number.NEGATIVE_INFINITY
  let maxLat = Number.NEGATIVE_INFINITY

  // GeoJSON Polygon: coordinates = [ring][point][lon,lat]
  // MultiPolygon: coordinates = [polygon][ring][point][lon,lat]
  const visit = (point: any) => {
    if (!Array.isArray(point) || point.length < 2) return
    const lon = Number(point[0])
    const lat = Number(point[1])
    if (!Number.isFinite(lon) || !Number.isFinite(lat)) return
    minLon = Math.min(minLon, lon)
    minLat = Math.min(minLat, lat)
    maxLon = Math.max(maxLon, lon)
    maxLat = Math.max(maxLat, lat)
  }

  if (type === 'Polygon') {
    for (const ring of coords) for (const pt of ring) visit(pt)
  } else if (type === 'MultiPolygon') {
    for (const poly of coords) for (const ring of poly) for (const pt of ring) visit(pt)
  } else {
    // Best-effort: handle already-point like structures
    if (Array.isArray(coords) && coords.length >= 2 && typeof coords[0] === 'number') visit(coords)
  }

  if (!Number.isFinite(minLon) || !Number.isFinite(minLat)) return null
  return { minLon, minLat, maxLon, maxLat }
}

function centroidFromGeometry(geom: any): { lat: number; lon: number } | null {
  const bbox = polygonOrMultiBbox(geom)
  if (!bbox) return null
  return {
    lon: (bbox.minLon + bbox.maxLon) / 2,
    lat: (bbox.minLat + bbox.maxLat) / 2,
  }
}

function computeHistogram(values: number[], binCount: number) {
  const clean = values.filter((v) => Number.isFinite(v))
  if (clean.length === 0) return null
  const min = Math.min(...clean)
  const max = Math.max(...clean)
  if (!Number.isFinite(min) || !Number.isFinite(max)) return null

  const bins = new Array(binCount).fill(0)
  const binWidth = max === min ? 1 : (max - min) / binCount

  for (const v of clean) {
    const idx = max === min ? 0 : Math.min(binCount - 1, Math.floor((v - min) / binWidth))
    if (idx >= 0 && idx < binCount) bins[idx]++
  }

  const labels = bins.map((_, i) => {
    const a = min + i * binWidth
    const b = a + binWidth
    return `${a.toFixed(2)}-${b.toFixed(2)}`
  })

  return { min, max, bins, labels }
}

function safeNumber(v: any): number | null {
  const n = typeof v === 'number' ? v : Number(v)
  if (!Number.isFinite(n)) return null
  return n
}

/** Deuxième couche EDA / corrélations : VBS ↔ IP même horizon lorsque c’est pertinent. */
function inferEdaPairIds(pid: string): { a: string; b: string } {
  const p = parseKedApiParameterId(pid)
  if (p) {
    const h = p.horizon.toLowerCase()
    if (p.baseId === 'vbs') return { a: pid, b: `ip_ked_${h}` }
    if (p.baseId === 'ip') return { a: `vbs_ked_${h}`, b: pid }
    return { a: pid, b: `vbs_ked_${h}` }
  }
  if (pid === 'kriging_vbs' || pid === 'kriging_ip') return { a: 'kriging_vbs', b: 'kriging_ip' }
  return { a: pid, b: 'kriging_ip' }
}

type VariogramSummaryItem = {
  parameter_id?: string
  horizon?: string | null
  loo_rmse?: number | null
  block_rmse?: number | null
  model_type?: string | null
}

async function fetchVariogramSummary(): Promise<VariogramSummaryItem[]> {
  const apiBase = getApiBase()
  const token = tokenStorage.getAccessToken?.()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`
  const res = await fetch(`${apiBase}/ai/variograms/summary`, { headers: Object.keys(headers).length ? headers : undefined })
  if (!res.ok) throw new Error(`variograms summary (${res.status})`)
  const data = (await res.json()) as { items?: VariogramSummaryItem[] }
  return Array.isArray(data.items) ? data.items : []
}

async function fetchVariogramSvgFromApi(
  parameterId: string,
  horizon: string,
  timeoutMs = 5000,
): Promise<{ svg: string; cached: boolean; rows: number }> {
  const apiBase = getApiBase()
  const token = tokenStorage.getAccessToken?.()
  if (!token) throw new Error('missing auth token')

  const controller = new AbortController()
  const timer = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(`${apiBase}/ai/plots/variogram`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ parameter_id: parameterId, horizon }),
      signal: controller.signal,
    })
    if (res.status === 404) {
      throw new Error('Aucun variogramme calculé pour ce paramètre')
    }
    if (!res.ok) {
      throw new Error(`variogram endpoint failed (${res.status})`)
    }
    const data = (await res.json()) as { svg?: string; cached?: boolean; rows?: number }
    if (!data.svg || typeof data.svg !== 'string') throw new Error('invalid svg payload')
    return {
      svg: data.svg,
      cached: Boolean(data.cached),
      rows: Number(data.rows ?? 0),
    }
  } finally {
    window.clearTimeout(timer)
  }
}

async function renderSvgIntoCanvas(canvas: HTMLCanvasElement, svg: string): Promise<void> {
  const ctx = canvas.getContext('2d')
  if (!ctx) return
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        const dpr = window.devicePixelRatio || 1
        const w = Math.max(1, canvas.clientWidth || 900)
        const h = Math.max(1, canvas.clientHeight || 300)
        canvas.width = Math.floor(w * dpr)
        canvas.height = Math.floor(h * dpr)
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
        ctx.clearRect(0, 0, w, h)
        ctx.drawImage(img, 0, 0, w, h)
        resolve()
      }
      img.onerror = () => reject(new Error('failed to render svg'))
      img.src = url
    })
  } finally {
    URL.revokeObjectURL(url)
  }
}

async function fetchThematicData(
  parameter: string,
  opts: { includeGeometry: boolean; grid?: string; minSondages?: number },
) {
  const apiBase = getApiBase()
  const params = new URLSearchParams()
  params.set('parameter', parameter)
  params.set('include_geometry', opts.includeGeometry ? 'true' : 'false')
  if (opts.grid) params.set('grid', opts.grid)
  if (opts.minSondages !== undefined) params.set('min_sondages', String(opts.minSondages))

  const token = tokenStorage.getAccessToken?.()
  const headers: Record<string, string> = {}
  if (token) headers['Authorization'] = `Bearer ${token}`

  const url = `${apiBase}/thematic/data?${params}`
  const res = await fetch(url, { headers: token ? headers : undefined })
  if (!res.ok) throw new Error(`API thematic/data failed (${res.status})`)
  return (await res.json()) as { features: ThematicFeature[]; statistics?: any }
}

export function initScientificDrawer(): void {
  const drawer = document.getElementById('scientificDrawer')
  const openBtn = document.getElementById('openScientificDrawerBtn')
  const closeBtn = document.getElementById('closeScientificDrawerBtn')

  if (!drawer || !openBtn || !closeBtn) return

  const tabButtons = Array.from(drawer.querySelectorAll<HTMLButtonElement>('.s-tab'))
  const panelIds: Record<ScientificTabId, string> = {
    eda: 'scientificPanel-eda',
    corr: 'scientificPanel-corr',
    variogram: 'scientificPanel-variogram',
    validation: 'scientificPanel-validation',
    ml: 'scientificPanel-ml',
    compare: 'scientificPanel-compare',
    viz3d: 'scientificPanel-viz3d',
  }

  let activeTab: ScientificTabId = 'eda'
  let loaded: Record<ScientificTabId, boolean> = {
    eda: false,
    corr: false,
    variogram: false,
    validation: false,
    ml: false,
    compare: false,
    viz3d: false,
  }

  let chartEdaVbs: Chart | null = null
  let chartEdaIp: Chart | null = null
  let chartCorrScatter: Chart | null = null
  let chartVariogram: Chart | null = null
  let chartCompare: Chart | null = null

  const invalidateLeafletMapSize = () => {
    const mapInstance = (window as any).leafletMap || (window as any).map
    if (mapInstance && typeof mapInstance.invalidateSize === 'function') {
      setTimeout(() => {
        try {
          mapInstance.invalidateSize({ animate: false })
        } catch {
          // best-effort
        }
      }, 300)
    }
  }

  const setStatus = (id: string, msg: string) => {
    const el = document.getElementById(id)
    if (el) el.textContent = msg
  }

  const setPanelStatus = (tab: ScientificTabId, msg: string) => {
    const map: Partial<Record<ScientificTabId, string>> = {
      eda: 'scientificEdaStatus',
      corr: 'scientificCorrStatus',
      variogram: 'scientificVarStatus',
      validation: 'scientificValidationStatus',
      compare: 'scientificCompareStatus',
      ml: 'scientificEdaStatus',
    }
    const id = map[tab]
    if (id) setStatus(id, msg)
  }

  const open = () => {
    drawer.classList.add('open')
    drawer.setAttribute('aria-hidden', 'false')
    document.body.classList.add('scientific-open')
    invalidateLeafletMapSize()
    // Default tab load
    void loadIfNeeded('eda')
  }

  const close = () => {
    drawer.classList.remove('open')
    drawer.setAttribute('aria-hidden', 'true')
    document.body.classList.remove('scientific-open')
    invalidateLeafletMapSize()
  }

  const setActive = (tab: ScientificTabId) => {
    activeTab = tab
    for (const btn of tabButtons) {
      const id = btn.getAttribute('data-s-tab') as ScientificTabId
      btn.classList.toggle('active', id === tab)
    }
    for (const [k, pid] of Object.entries(panelIds)) {
      const el = document.getElementById(pid)
      if (!el) continue
      el.classList.toggle('active', k === tab)
    }
    void loadIfNeeded(tab)
  }

  const resetDynamicTabs = () => {
    loaded.eda = false
    loaded.corr = false
    loaded.variogram = false
    loaded.validation = false
    loaded.compare = false
    // ml + viz3d ne dépendent pas du paramètre actif — pas de reset
  }

  window.addEventListener('atlas-thematic-parameter-changed', () => {
    resetDynamicTabs()
    if (drawer.classList.contains('open')) {
      void loadIfNeeded(activeTab, true)
    }
  })

  const loadIfNeeded = async (tab: ScientificTabId, force = false) => {
    if (!force && loaded[tab]) return
    loaded[tab] = true
    if (tab === 'eda') await loadEda()
    else if (tab === 'corr') await loadCorrelation()
    else if (tab === 'variogram') await loadVariogram()
    else if (tab === 'validation') await loadValidation()
    else if (tab === 'compare') await loadCompare()
    else if (tab === 'ml') await loadMlPanel()
    else if (tab === 'viz3d') await loadViz3dPanel()
  }

  const loadEda = async () => {
    setStatus('scientificEdaStatus', 'Chargement EDA…')
    const active = getActiveThematicParameterId()
    const { a, b } = inferEdaPairIds(active)
    const titleA = document.getElementById('scientificEdaTitleA')
    const titleB = document.getElementById('scientificEdaTitleB')
    if (titleA) titleA.textContent = `Histogramme (${a})`
    if (titleB) titleB.textContent = `Histogramme (${b})`

    const first = await fetchThematicData(a, { includeGeometry: false, grid: '2km', minSondages: 1 })
    const second = await fetchThematicData(b, { includeGeometry: false, grid: '2km', minSondages: 1 })

    const vbsValues = (first.features || [])
      .map((f) => safeNumber(f.properties?.value))
      .filter((v): v is number => v !== null)
    const ipValues = (second.features || [])
      .map((f) => safeNumber(f.properties?.value))
      .filter((v): v is number => v !== null)

    const renderHist = (canvasId: string, values: number[], label: string, chartRefSetter: (c: Chart | null) => void) => {
      const canvas = document.getElementById(canvasId) as HTMLCanvasElement | null
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const hist = computeHistogram(values, 18)
      if (!hist) return

      const data = hist.bins
      const labels = hist.labels

      const config = {
        type: 'bar' as const,
        data: {
          labels,
          datasets: [
            {
              label,
              data,
              backgroundColor: '#2563EB66',
              borderColor: '#2563EB',
              borderWidth: 1,
            },
          ],
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: { enabled: true },
          },
          scales: {
            x: { ticks: { maxRotation: 0, autoSkip: true }, grid: { display: false } },
            y: { beginAtZero: true },
          },
        },
      }

      // Destroy previous to avoid stacking canvases
      if (canvasId === 'scientificChartEdaVbs' && chartEdaVbs) chartEdaVbs.destroy()
      if (canvasId === 'scientificChartEdaIp' && chartEdaIp) chartEdaIp.destroy()
      const chart = new Chart(ctx, config)
      chartRefSetter(chart)
    }

      renderHist('scientificChartEdaVbs', vbsValues, a, (c) => {
      chartEdaVbs = c
    })
    renderHist('scientificChartEdaIp', ipValues, b, (c) => {
      chartEdaIp = c
    })

    const statsText = (() => {
      const stats = (vals: number[]) => {
        const n = vals.length
        if (n === 0) return null
        const min = Math.min(...vals)
        const max = Math.max(...vals)
        const mean = vals.reduce((a, b) => a + b, 0) / n
        return { n, min, max, mean }
      }
      const sv = stats(vbsValues)
      const si = stats(ipValues)
      if (!sv || !si) return 'EDA: pas assez de valeurs.'
      return `${a}: n=${sv.n} min=${sv.min.toFixed(2)} max=${sv.max.toFixed(2)} mean=${sv.mean.toFixed(2)} | ${b}: n=${si.n} min=${si.min.toFixed(2)} max=${si.max.toFixed(2)} mean=${si.mean.toFixed(2)}`
    })()

    const sEl = document.getElementById('scientificEdaStats')
    if (sEl) sEl.textContent = statsText

    setStatus('scientificEdaStatus', 'Prêt.')
  }

  const loadCorrelation = async () => {
    setStatus('scientificCorrStatus', 'Chargement corrélations…')
    const active = getActiveThematicParameterId()
    const { a, b } = inferEdaPairIds(active)
    const vbs = await fetchThematicData(a, { includeGeometry: false, grid: '2km', minSondages: 1 })
    const ip = await fetchThematicData(b, { includeGeometry: false, grid: '2km', minSondages: 1 })

    const vbsMap = new Map<string, number>()
    for (const f of vbs.features || []) {
      const p: any = f.properties || {}
      const key = getKey(p)
      const val = safeNumber(p.value)
      if (!key || val === null) continue
      vbsMap.set(key, val)
    }

    const xs: number[] = []
    const ys: number[] = []
    for (const f of ip.features || []) {
      const p: any = f.properties || {}
      const key = getKey(p)
      const valIp = safeNumber(p.value)
      if (!key || valIp === null) continue
      const valVbs = vbsMap.get(key)
      if (valVbs === undefined) continue
      xs.push(valVbs)
      ys.push(valIp)
    }

    const r = pearsonCorrelation(xs, ys)

    // Scatter sample (limit for performance)
    const maxPoints = 1200
    const step = xs.length > maxPoints ? Math.ceil(xs.length / maxPoints) : 1
    const points = xs
      .filter((_, i) => i % step === 0)
      .map((x, idx) => {
        const i = idx * step
        return { x, y: ys[i] }
      })

    const canvas = document.getElementById('scientificChartCorrScatter') as HTMLCanvasElement | null
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (chartCorrScatter) chartCorrScatter.destroy()

    chartCorrScatter = new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: `${a} vs ${b}`,
            data: points,
            pointRadius: 2,
            pointBackgroundColor: '#2563EB',
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: a }, grid: { color: '#0f172a20' } },
          y: { title: { display: true, text: b }, grid: { color: '#0f172a20' } },
        },
      },
    })

    const sEl = document.getElementById('scientificCorrStats')
    if (sEl) sEl.textContent = `Paires: ${xs.length} | Pearson r: ${r === null ? '—' : r.toFixed(3)}`
    setStatus('scientificCorrStatus', 'Prêt.')
  }

  const resolveActiveKedParam = (): { parameterId: string; horizon: string } => {
    const pid = getActiveThematicParameterId().trim()
    const hm = pid.match(/_h([123])$/i)
    const horizon = hm ? `H${hm[1]}` : 'H1'
    if (pid && (/_ked_h[123]$/i.test(pid) || /^ip_derived_h[123]$/i.test(pid) || /^eg_ked_h[123]$/i.test(pid))) {
      return { parameterId: pid, horizon }
    }
    if (pid && (pid === 'kriging_vbs' || pid === 'kriging_ip')) {
      return { parameterId: pid === 'kriging_vbs' ? 'vbs_ked_h2' : 'ip_derived_h2', horizon: 'H2' }
    }
    return { parameterId: 'eg_ked_h1', horizon: 'H1' }
  }

  const loadVariogram = async () => {
    setStatus('scientificVarStatus', 'Chargement variogramme…')
    const canvas = document.getElementById('scientificChartVariogram') as HTMLCanvasElement | null
    if (!canvas) return
    const nEl = document.getElementById('scientificVarNotes')

    const { parameterId: activePid, horizon: activeHz } = resolveActiveKedParam()

    // Preferred path (P7): backend Python endpoint with cache.
    try {
      const payload = await fetchVariogramSvgFromApi(activePid, activeHz, 8000)
      if (chartVariogram) {
        chartVariogram.destroy()
        chartVariogram = null
      }
      await renderSvgIntoCanvas(canvas, payload.svg)
      if (nEl) {
        nEl.textContent = `Variogramme backend (Python) — cache=${payload.cached ? 'hit' : 'miss'}, rows=${payload.rows}.`
      }
      setStatus('scientificVarStatus', 'Prêt.')
      return
    } catch (e) {
      // Fallback path mandated by roadmap: keep JS approximation available.
      if (nEl) {
        nEl.textContent = `Fallback JS activé (${(e as Error)?.message || 'endpoint indisponible'}).`
      }
    }

    setStatus('scientificVarStatus', 'Chargement variogramme (fallback JS)…')
    const fbPid = resolveActiveKedParam().parameterId
    const vbs = await fetchThematicData(fbPid, { includeGeometry: true, grid: '2km', minSondages: 1 })
    const features = vbs.features || []

    const points: Array<{ lat: number; lon: number; z: number }> = []
    for (const f of features as any[]) {
      const val = safeNumber(f?.properties?.value)
      if (val === null) continue
      const centroid = centroidFromGeometry(f.geometry)
      if (!centroid) continue
      points.push({ lat: centroid.lat, lon: centroid.lon, z: val })
    }

    if (points.length < 30) {
      const nEl = document.getElementById('scientificVarNotes')
      if (nEl) nEl.textContent = 'Variogramme: pas assez de points (>= 30 souhaités).'
      setStatus('scientificVarStatus', 'Prêt.')
      return
    }

    const sampleN = Math.min(220, points.length)
    const sampled: Array<{ lat: number; lon: number; z: number }> = []
    // reservoir sample-ish
    const idxs = new Set<number>()
    while (idxs.size < sampleN) idxs.add(Math.floor(Math.random() * points.length))
    for (const i of idxs) sampled.push(points[i]!)

    // Approximate max distance from bbox corners
    let minLat = Number.POSITIVE_INFINITY
    let maxLat = Number.NEGATIVE_INFINITY
    let minLon = Number.POSITIVE_INFINITY
    let maxLon = Number.NEGATIVE_INFINITY
    for (const p of sampled) {
      minLat = Math.min(minLat, p.lat)
      maxLat = Math.max(maxLat, p.lat)
      minLon = Math.min(minLon, p.lon)
      maxLon = Math.max(maxLon, p.lon)
    }
    const approxMaxDist = haversineKm(minLat, minLon, maxLat, maxLon)
    const maxDist = Math.max(approxMaxDist, 0.01)

    const nBins = 12
    const binWidth = maxDist / nBins
    const sums = new Array(nBins).fill(0)
    const counts = new Array(nBins).fill(0)

    for (let i = 0; i < sampled.length; i++) {
      for (let j = i + 1; j < sampled.length; j++) {
        const a = sampled[i]!
        const b = sampled[j]!
        const dist = haversineKm(a.lat, a.lon, b.lat, b.lon)
        const semivar = 0.5 * (a.z - b.z) * (a.z - b.z)
        const idx = Math.min(nBins - 1, Math.floor(dist / binWidth))
        if (idx < 0) continue
        sums[idx] += semivar
        counts[idx] += 1
      }
    }

    const xs: number[] = []
    const ys: number[] = []
    for (let i = 0; i < nBins; i++) {
      if (counts[i] === 0) continue
      const center = (i + 0.5) * binWidth
      xs.push(center)
      ys.push(sums[i] / counts[i]!)
    }

    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    if (chartVariogram) chartVariogram.destroy()

    chartVariogram = new Chart(ctx, {
      type: 'line',
      data: {
        labels: xs.map((d) => d.toFixed(1)),
        datasets: [
          {
            label: 'Semivariance (approx.)',
            data: ys,
            borderColor: '#2563EB',
            backgroundColor: '#2563EB33',
            pointRadius: 3,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
          x: { title: { display: true, text: 'Lag distance (km)' } },
          y: { title: { display: true, text: 'γ(h) = 0.5*(z-z)^2' } },
        },
      },
    })

    if (nEl) {
      nEl.textContent =
        'Variogramme expérimental approx.: centroids bbox, échantillonnage et binning côté client (non substitut aux variogrammes Python).'
    }
    setStatus('scientificVarStatus', 'Prêt.')
  }

  // Bloc 5 — Tableau métriques live depuis /ai/models/status (ARCH-01, 0 hardcode)
  const loadValidation = async () => {
    const st = document.getElementById('scientificValidationStatus')
    const body = document.getElementById('scientificValidationBody')
    if (st) st.textContent = 'Chargement métriques…'
    try {
      const apiBase = getApiBase()
      const token = tokenStorage.getAccessToken?.()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const resp = await fetch(`${apiBase}/ai/models/status`, { headers })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as { models: MlModelStatus[] }
      if (st) st.textContent = `${data.models.filter(m => m.status === 'ready').length}/${data.models.length} modèles prêts`
      if (body) body.innerHTML = renderMetricsTable(data.models)
      if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
    } catch (e) {
      if (body) body.innerHTML = `<p style="color:#f97316">${escapeHtml((e as Error).message || String(e))}</p>`
      if (st) st.textContent = 'Erreur chargement.'
    }
  }

  function renderMetricsTable(models: MlModelStatus[]): string {
    const paramLabels: Record<string, string> = {
      vbs_ked_h1: 'VBS KED H1', vbs_ked_h2: 'VBS KED H2', vbs_ked_h3: 'VBS KED H3',
      ip_ked_h1: 'IP KED H1', ip_ked_h2: 'IP KED H2', ip_ked_h3: 'IP KED H3',
      eg_ked_h1: 'EG KED H1', eg_ked_h2: 'EG KED H2', eg_ked_h3: 'EG KED H3',
      wl_ked_h1: 'WL KED H1', wl_ked_h2: 'WL KED H2', wl_ked_h3: 'WL KED H3',
      wp_ked_h1: 'WP KED H1', wp_ked_h2: 'WP KED H2', wp_ked_h3: 'WP KED H3',
    }

    const sections = models.map(model => {
      const metricEntries = Object.entries(model.metrics ?? {})
      if (metricEntries.length === 0) {
        return `<div style="margin-bottom:16px">
          <h5 style="margin:0 0 6px;font-size:12px;color:#94a3b8">
            <i data-lucide="cpu" style="width:12px;height:12px"></i> ${escapeHtml(model.label)}
            <code style="font-size:10px;color:#475569;margin-left:6px">${escapeHtml(model.method_db)}</code>
          </h5>
          <p style="font-size:11px;color:#475569;margin:0">Métriques non disponibles (${escapeHtml(model.status)})</p>
        </div>`
      }

      const rows = metricEntries.map(([key, val]) => {
        const label = paramLabels[key] ?? key
        let display = '—'
        if (val != null && typeof val === 'object' && 'loo_rmse' in val) {
          display = (val as any).loo_rmse != null ? Number((val as any).loo_rmse).toFixed(4) : '—'
        } else if (typeof val === 'number') {
          display = val.toFixed(4)
        } else if (val != null) {
          display = String(val)
        }
        return `<tr>
          <td style="padding:3px 6px;font-size:11px;color:#e2e8f0">${escapeHtml(label)}</td>
          <td style="padding:3px 6px;font-size:11px;text-align:right;color:#93c5fd;font-family:monospace">${display}</td>
        </tr>`
      }).join('')

      return `<div style="margin-bottom:16px">
        <h5 style="margin:0 0 6px;font-size:12px;color:#94a3b8;display:flex;align-items:center;gap:6px">
          <i data-lucide="cpu" style="width:12px;height:12px"></i>
          ${escapeHtml(model.label)}
          <code style="font-size:10px;color:#475569">${escapeHtml(model.method_db)}</code>
          <span style="font-size:10px;color:#64748b">${model.n_mailles.toLocaleString('fr-FR')} mailles</span>
        </h5>
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead><tr style="border-bottom:1px solid #1e3a5f;color:#475569">
            <th style="padding:3px 6px;text-align:left">Paramètre</th>
            <th style="padding:3px 6px;text-align:right">LOO-RMSE</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`
    })

    return `<div style="max-height:50vh;overflow-y:auto;padding-right:4px">${sections.join('<hr style="border-color:#1e3a5f;margin:8px 0">')}</div>`
  }

  const loadCompare = async () => {
    setStatus('scientificCompareStatus', 'Chargement comparaison…')
    const notes = document.getElementById('scientificCompareNotes')
    try {
      const items = await fetchVariogramSummary()
      const byModel = new Map<string, number[]>()
      for (const it of items) {
        const m = (it.model_type || 'unknown').trim()
        if (!it.loo_rmse || !Number.isFinite(it.loo_rmse)) continue
        if (!byModel.has(m)) byModel.set(m, [])
        byModel.get(m)!.push(it.loo_rmse)
      }
      const labels = Array.from(byModel.keys()).sort()
      const avgs = labels.map((k) => {
        const xs = byModel.get(k)!
        return xs.reduce((a, b) => a + b, 0) / xs.length
      })
      const canvas = document.getElementById('scientificChartCompare') as HTMLCanvasElement | null
      if (canvas) {
        const ctx = canvas.getContext('2d')
        if (ctx) {
          if (chartCompare) chartCompare.destroy()
          chartCompare = new Chart(ctx, {
            type: 'bar',
            data: {
              labels,
              datasets: [
                {
                  label: 'LOO RMSE moyen (par type de modèle)',
                  data: avgs,
                  backgroundColor: '#2563EB66',
                  borderColor: '#2563EB',
                  borderWidth: 1,
                },
              ],
            },
            options: {
              responsive: true,
              maintainAspectRatio: false,
              plugins: { legend: { display: false } },
              scales: {
                y: { beginAtZero: true, title: { display: true, text: 'RMSE' } },
                x: { ticks: { maxRotation: 45, minRotation: 25 } },
              },
            },
          })
        }
      }
      if (notes) {
        notes.textContent =
          labels.length === 0
            ? 'Pas assez de métriques LOO par model_type pour un graphique.'
            : 'Basé sur GET /ai/variograms/summary — moyenne simple des LOO RMSE par model_type (aperçu jury).'
      }
      setStatus('scientificCompareStatus', 'Prêt.')
    } catch (e) {
      if (notes) notes.textContent = (e as Error).message || String(e)
      setStatus('scientificCompareStatus', 'Erreur.')
    }
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ONGLET ML — Pipeline de calcul L1-L4 (ARCH-01 + ARCH-02)
  // ═══════════════════════════════════════════════════════════════════════

  interface MlModelStatus {
    id: string
    label: string
    method_db: string
    status: string
    n_params: number
    n_mailles: number
    metrics: Record<string, any>
    warnings: string[]
    last_run_at?: string
  }

  interface MlJobStatus {
    id: string
    status: string
    logs?: string
    progress_pct?: number
    error_message?: string
  }

  let mlJobPollingInterval: ReturnType<typeof setInterval> | null = null

  async function loadMlPanel(): Promise<void> {
    const panel = document.getElementById('scientificPanel-ml')
    if (!panel) return
    panel.innerHTML = buildMlPanelSkeleton()
    if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()

    document.getElementById('mlRefreshBtn')?.addEventListener('click', () => void refreshMlPanel())

    panel.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('[data-action="recompute"]')
      if (btn) void handleRecomputeClick(btn.dataset.model ?? '')
    })

    await refreshMlPanel()
  }

  async function refreshMlPanel(): Promise<void> {
    const panel = document.getElementById('scientificPanel-ml')
    if (!panel) return
    const errEl = panel.querySelector<HTMLElement>('#mlStatusError')

    try {
      const apiBase = getApiBase()
      const token = tokenStorage.getAccessToken?.()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
      const resp = await fetch(`${apiBase}/ai/models/status`, { headers })
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`)
      const data = (await resp.json()) as { models: MlModelStatus[] }
      renderMlTable(panel, data.models)
      if (errEl) errEl.style.display = 'none'
      if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
    } catch (err) {
      if (errEl) {
        errEl.textContent = `Impossible de charger le statut des modèles: ${(err as Error).message}`
        errEl.style.display = 'block'
      }
    }
  }

  function renderMlTable(panel: HTMLElement, models: MlModelStatus[]): void {
    const tbody = panel.querySelector<HTMLElement>('#mlModelsBody')
    if (!tbody) return

    const statusBadge: Record<string, string> = {
      ready:        '<span class="badge badge--ready" style="background:#166534;color:#bbf7d0;padding:2px 6px;border-radius:4px;font-size:10px">Prêt</span>',
      partial:      '<span class="badge badge--partial" style="background:#78350f;color:#fde68a;padding:2px 6px;border-radius:4px;font-size:10px">Partiel</span>',
      not_computed: '<span class="badge badge--pending" style="background:#1e3a5f;color:#93c5fd;padding:2px 6px;border-radius:4px;font-size:10px">Non calculé</span>',
      running:      '<span class="badge badge--running" style="background:#1e293b;color:#f59e0b;padding:2px 6px;border-radius:4px;font-size:10px;animation:pulse 1s infinite">En cours</span>',
    }

    tbody.innerHTML = models.map(model => {
      // ARCH-01 : valeurs depuis model.metrics (API), aucun hardcode
      const rmseRaw = model.metrics?.['vbs_ked_h1']?.loo_rmse
        ?? model.metrics?.['vbs_h1']?.loo_rmse
        ?? model.metrics?.['variance_reduction_pct']
      let rmseCell = '—'
      if (rmseRaw != null) {
        rmseCell = typeof rmseRaw === 'number'
          ? (model.id === 'L2b_BLUP' ? `σ²↓${rmseRaw.toFixed(1)}%` : rmseRaw.toFixed(2))
          : String(rmseRaw)
      }

      const badge = statusBadge[model.status] ?? '<span style="font-size:10px;color:#94a3b8">—</span>'
      const lastRun = model.last_run_at ? new Date(model.last_run_at).toLocaleDateString('fr-FR') : '—'
      const warn = model.warnings?.length
        ? `<div style="font-size:10px;color:#f59e0b;margin-top:2px"><i data-lucide="alert-triangle" style="width:10px;height:10px"></i> ${escapeHtml(model.warnings[0] ?? '')}</div>`
        : ''

      return `<tr data-model-id="${escapeHtml(model.id)}">
        <td style="padding:6px 8px">
          <strong style="font-size:12px">${escapeHtml(model.label)}</strong>
          <code style="display:block;font-size:10px;color:#64748b;margin-top:2px">${escapeHtml(model.method_db)}</code>
          ${warn}
        </td>
        <td style="padding:6px 8px;text-align:center">${badge}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px">${model.n_params ?? '—'}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px">${(model.n_mailles ?? 0).toLocaleString('fr-FR')}</td>
        <td style="padding:6px 8px;text-align:right;font-size:12px;color:#94a3b8">${rmseCell}</td>
        <td style="padding:6px 8px;text-align:center;font-size:10px;color:#64748b">${lastRun}</td>
        <td style="padding:6px 8px;text-align:center">
          <button class="btn-sm" data-action="recompute" data-model="${escapeHtml(model.id)}"
            ${model.status === 'running' ? 'disabled' : ''}
            style="font-size:10px;padding:3px 8px;border:1px solid #334155;border-radius:4px;background:#1e293b;color:#e2e8f0;cursor:pointer">
            <i data-lucide="refresh-cw" style="width:10px;height:10px;vertical-align:middle"></i>
            ${model.status === 'not_computed' ? 'Calculer' : 'Recalculer'}
          </button>
        </td>
      </tr>`
    }).join('')
  }

  function buildMlPanelSkeleton(): string {
    return `<div class="ml-jobs-panel" style="font-size:12px">
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:10px">
        <h4 style="margin:0;font-size:13px;display:flex;align-items:center;gap:6px">
          <i data-lucide="cpu" style="width:14px;height:14px"></i> Pipeline L1–L4
        </h4>
        <button id="mlRefreshBtn" style="font-size:11px;padding:3px 8px;border:1px solid #334155;border-radius:4px;background:#1e293b;color:#94a3b8;cursor:pointer">
          <i data-lucide="refresh-cw" style="width:10px;height:10px;vertical-align:middle"></i> Rafraîchir
        </button>
      </div>

      <p id="mlStatusError" style="color:#f87171;font-size:11px;display:none;margin-bottom:8px"></p>

      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead>
            <tr style="border-bottom:1px solid #334155;color:#64748b;text-align:left">
              <th style="padding:4px 8px">Modèle</th>
              <th style="padding:4px 8px;text-align:center">Statut</th>
              <th style="padding:4px 8px;text-align:right">Params</th>
              <th style="padding:4px 8px;text-align:right">Mailles</th>
              <th style="padding:4px 8px;text-align:right">Métrique</th>
              <th style="padding:4px 8px;text-align:center">Dernier run</th>
              <th style="padding:4px 8px;text-align:center">Action</th>
            </tr>
          </thead>
          <tbody id="mlModelsBody">
            <tr><td colspan="7" style="padding:12px;text-align:center;color:#64748b">Chargement...</td></tr>
          </tbody>
        </table>
      </div>

      <div id="mlJobConsole" style="display:none;margin-top:12px;background:#0a0f1a;border-radius:6px;border:1px solid #1e3a5f">
        <div style="display:flex;align-items:center;justify-content:space-between;padding:6px 10px;border-bottom:1px solid #1e3a5f">
          <span style="font-size:11px;display:flex;align-items:center;gap:6px">
            <i data-lucide="terminal" style="width:12px;height:12px"></i>
            <span id="consoleJobLabel">Job en cours...</span>
          </span>
          <button id="consoleCancelBtn" style="font-size:10px;padding:2px 6px;border:1px solid #ef4444;border-radius:4px;background:transparent;color:#ef4444;cursor:pointer">
            <i data-lucide="x-circle" style="width:10px;height:10px"></i> Annuler
          </button>
        </div>
        <pre id="consoleOutput" style="margin:0;padding:8px 10px;font-size:10px;color:#94a3b8;max-height:150px;overflow-y:auto;white-space:pre-wrap">En attente...</pre>
        <div style="padding:4px 10px 6px;background:#0f172a">
          <div style="background:#1e3a5f;border-radius:2px;height:4px;overflow:hidden">
            <div id="progressFill" style="width:0%;height:100%;background:#3b82f6;transition:width 0.3s"></div>
          </div>
          <span id="progressEta" style="font-size:9px;color:#64748b;margin-top:2px;display:block"></span>
        </div>
      </div>
    </div>`
  }

  async function handleRecomputeClick(modelId: string): Promise<void> {
    const jobTypeMap: Record<string, string> = {
      L1_KED_H: 'ked_recompute',
      L2a_RK:   'rk_recompute',
      L2b_BLUP: 'blup_recompute',
      L3_VFS:   'vfs_extract',
      L4_MTGP:  'mtgp_recompute',
    }
    const jobType = jobTypeMap[modelId]
    if (!jobType) return

    try {
      const apiBase = getApiBase()
      const token = tokenStorage.getAccessToken?.()
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      }
      const resp = await fetch(`${apiBase}/ai/jobs/enqueue`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ job_type: jobType, requested_by: 'expert-panel' }),
      })
      if (!resp.ok) {
        const txt = await resp.text().catch(() => '')
        throw new Error(`HTTP ${resp.status} ${txt}`)
      }
      const { job_id } = (await resp.json()) as { job_id: string }

      // Affiche la console et commence le polling
      showJobConsole(modelId)
      startJobPolling(job_id)
    } catch (err) {
      const errEl = document.getElementById('mlStatusError')
      if (errEl) {
        errEl.textContent = `Impossible d'enqueuer le job : ${(err as Error).message}`
        errEl.style.display = 'block'
      }
    }
  }

  function showJobConsole(modelId: string): void {
    const console = document.getElementById('mlJobConsole')
    const label = document.getElementById('consoleJobLabel')
    const output = document.getElementById('consoleOutput')
    const progress = document.getElementById('progressFill')
    if (console) console.style.display = 'block'
    if (label) label.textContent = `Job ${modelId} en cours...`
    if (output) output.textContent = 'En attente de démarrage...'
    if (progress) progress.style.width = '0%'

    document.getElementById('consoleCancelBtn')?.addEventListener('click', async () => {
      if (mlJobPollingInterval) clearInterval(mlJobPollingInterval)
      if (console) console.style.display = 'none'
      await refreshMlPanel()
    }, { once: true })
  }

  function startJobPolling(jobId: string): void {
    if (mlJobPollingInterval) clearInterval(mlJobPollingInterval)

    let lastLogLength = 0
    mlJobPollingInterval = setInterval(async () => {
      try {
        const apiBase = getApiBase()
        const token = tokenStorage.getAccessToken?.()
        const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
        const resp = await fetch(`${apiBase}/ai/jobs/${jobId}`, { headers })
        if (!resp.ok) return
        const job = (await resp.json()) as MlJobStatus

        // Append new log lines
        const output = document.getElementById('consoleOutput')
        if (output && job.logs && job.logs.length > lastLogLength) {
          output.textContent = job.logs
          lastLogLength = job.logs.length
          output.scrollTop = output.scrollHeight
        }

        const fill = document.getElementById('progressFill')
        if (fill && job.progress_pct != null) {
          fill.style.width = `${job.progress_pct}%`
        }

        const eta = document.getElementById('progressEta')
        if (eta && job.progress_pct != null) {
          eta.textContent = `${job.progress_pct}%`
        }

        if (['done', 'failed', 'cancelled'].includes(job.status)) {
          clearInterval(mlJobPollingInterval!)
          mlJobPollingInterval = null
          const console = document.getElementById('mlJobConsole')
          if (console) setTimeout(() => { console.style.display = 'none' }, 3000)
          await refreshMlPanel()
        }
      } catch {
        // Silencieux — retry au prochain tick
      }
    }, 3000)
  }

  // ═══════════════════════════════════════════════════════════════════════
  // ONGLET VIZ3D — Visualisations 3D (ARCH-01 + ARCH-02 + ARCH-03)
  // ═══════════════════════════════════════════════════════════════════════

  let viz3dJobPollingInterval: ReturnType<typeof setInterval> | null = null

  async function loadViz3dPanel(): Promise<void> {
    const panel = document.getElementById('scientificPanel-viz3d')
    if (!panel) return
    panel.innerHTML = buildViz3dPanel()
    if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()

    document.getElementById('viz3dGenerate')?.addEventListener('click', () => {
      const param = (document.getElementById('viz3dParam') as HTMLSelectElement)?.value ?? 'vbs'
      const arch = (panel.querySelector<HTMLInputElement>('input[name="archetype"]:checked'))?.value ?? 'A'
      void generateViz3d(param, arch)
    })

    panel.querySelectorAll<HTMLElement>('.arch-option').forEach(opt => {
      opt.addEventListener('click', () => {
        panel.querySelectorAll('.arch-option').forEach(o => o.classList.remove('active'))
        opt.classList.add('active')
        const arch = opt.dataset.arch ?? 'A'
        const fence = document.getElementById('fenceControls')
        if (fence) fence.hidden = arch !== 'C'
      })
    })

    document.getElementById('fenceDrawMode')?.addEventListener('click', () => {
      if (typeof (window as any).enableFenceDrawMode === 'function') {
        (window as any).enableFenceDrawMode()
      }
    })
  }

  function buildViz3dPanel(): string {
    return `<div style="font-size:12px">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:10px;align-items:flex-end">
        <div>
          <div style="font-size:10px;color:#64748b;margin-bottom:4px">PARAMÈTRE</div>
          <select id="viz3dParam" style="background:#1e293b;border:1px solid #334155;border-radius:4px;color:#e2e8f0;padding:4px 8px;font-size:12px">
            <optgroup label="Argilosité / Plasticité">
              <option value="vbs">VBS (g/100g)</option>
              <option value="ip">IP (%)</option>
              <option value="wl">WL (%)</option>
              <option value="wp">WP (%)</option>
              <option value="eg">Eg (%)</option>
            </optgroup>
            <optgroup label="Portance / Compactage">
              <option value="cbr_95">CBR 95% (%)</option>
              <option value="gamma_d">γd max (t/m³)</option>
              <option value="w_opt">wopt (%)</option>
            </optgroup>
            <optgroup label="In-situ">
              <option value="rd_mpa">Rd (MPa)</option>
            </optgroup>
          </select>
        </div>
        <div>
          <div style="font-size:10px;color:#64748b;margin-bottom:4px">TYPE DE VUE</div>
          <div style="display:flex;gap:6px">
            ${[
              { arch: 'A', icon: 'box', label: 'Cube 3D', sub: 'Plotly interactif' },
              { arch: 'B', icon: 'columns-2', label: 'Strati H1-H3', sub: 'Colonnes PNG' },
              { arch: 'C', icon: 'scissors', label: 'Fence', sub: 'Section SVG' },
              { arch: 'D', icon: 'layers', label: 'Isovaleurs', sub: 'Surfaces PNG' },
            ].map((a, i) => `
              <label class="arch-option ${i === 0 ? 'active' : ''}" data-arch="${a.arch}"
                style="display:flex;flex-direction:column;align-items:center;gap:2px;padding:6px 10px;background:${i === 0 ? '#1e3a5f' : '#1e293b'};border:1px solid ${i === 0 ? '#3b82f6' : '#334155'};border-radius:6px;cursor:pointer;font-size:10px;color:#e2e8f0;min-width:68px;text-align:center">
                <i data-lucide="${a.icon}" style="width:14px;height:14px"></i>
                <span style="font-weight:600">${a.label}</span>
                <span style="color:#64748b">${a.sub}</span>
                <input type="radio" name="archetype" value="${a.arch}" ${i === 0 ? 'checked' : ''} hidden>
              </label>`).join('')}
          </div>
        </div>
        <div style="display:flex;gap:6px">
          <button id="viz3dGenerate" style="padding:6px 14px;background:#3b82f6;border:none;border-radius:4px;color:#fff;font-size:12px;cursor:pointer;display:flex;align-items:center;gap:4px">
            <i data-lucide="play" style="width:12px;height:12px"></i> Afficher
          </button>
        </div>
      </div>

      <div id="fenceControls" hidden style="background:#0f172a;border:1px solid #1e3a5f;border-radius:6px;padding:10px;margin-bottom:10px;font-size:11px">
        <div style="display:flex;gap:16px;flex-wrap:wrap;margin-bottom:8px">
          <div>
            <div style="color:#64748b;margin-bottom:4px">Point A</div>
            <label>Lon <input type="number" id="fenceLon1" step="0.001" placeholder="ex: 0.845"
              style="width:80px;background:#1e293b;border:1px solid #334155;border-radius:3px;color:#e2e8f0;padding:2px 4px"></label>
            <label style="margin-left:6px">Lat <input type="number" id="fenceLat1" step="0.001" placeholder="ex: 9.234"
              style="width:80px;background:#1e293b;border:1px solid #334155;border-radius:3px;color:#e2e8f0;padding:2px 4px"></label>
          </div>
          <div>
            <div style="color:#64748b;margin-bottom:4px">Point B</div>
            <label>Lon <input type="number" id="fenceLon2" step="0.001" placeholder="ex: 1.124"
              style="width:80px;background:#1e293b;border:1px solid #334155;border-radius:3px;color:#e2e8f0;padding:2px 4px"></label>
            <label style="margin-left:6px">Lat <input type="number" id="fenceLat2" step="0.001" placeholder="ex: 8.512"
              style="width:80px;background:#1e293b;border:1px solid #334155;border-radius:3px;color:#e2e8f0;padding:2px 4px"></label>
          </div>
          <div>
            <div style="color:#64748b;margin-bottom:4px">Points coupe</div>
            <input type="number" id="fenceNPoints" value="100" min="20" max="500"
              style="width:60px;background:#1e293b;border:1px solid #334155;border-radius:3px;color:#e2e8f0;padding:2px 4px">
          </div>
        </div>
        <button id="fenceDrawMode" style="padding:4px 10px;border:1px solid #334155;border-radius:4px;background:#1e293b;color:#94a3b8;font-size:11px;cursor:pointer;display:flex;align-items:center;gap:4px">
          <i data-lucide="pencil" style="width:10px;height:10px"></i> Tracer sur la carte
        </button>
      </div>

      <div id="viz3dOutput" style="min-height:200px;background:#0a0f1a;border:1px solid #1e3a5f;border-radius:6px;display:flex;align-items:center;justify-content:center">
        <div style="text-align:center;color:#475569;font-size:12px;padding:20px">
          <i data-lucide="image" style="width:24px;height:24px;display:block;margin:0 auto 8px"></i>
          Sélectionnez un paramètre et un type de vue, puis cliquez "Afficher"
        </div>
      </div>
    </div>`
  }

  async function generateViz3d(param: string, arch: string): Promise<void> {
    const output = document.getElementById('viz3dOutput')
    if (!output) return
    output.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">
      <i data-lucide="loader-2" style="width:20px;height:20px;display:block;margin:0 auto 8px;animation:spin 1s linear infinite"></i>
      Chargement...
    </div>`
    if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()

    try {
      if (arch === 'A') {
        const htmlUrl = `/exports/3d/${param}_A_cube_plotly.html`
        output.innerHTML = `<iframe src="${htmlUrl}" style="width:100%;height:420px;border:none;border-radius:4px"
          title="Cube 3D ${param.toUpperCase()}"></iframe>`
        return
      }

      // ARCH-03 : backend décide si cache existe, jamais de HEAD depuis le front
      const apiBase = getApiBase()
      const token = tokenStorage.getAccessToken?.()
      const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}

      let url = `${apiBase}/ai/3d/asset?param=${encodeURIComponent(param)}&archetype=${encodeURIComponent(arch)}`
      if (arch === 'C') {
        const lon1 = (document.getElementById('fenceLon1') as HTMLInputElement)?.value
        const lat1 = (document.getElementById('fenceLat1') as HTMLInputElement)?.value
        const lon2 = (document.getElementById('fenceLon2') as HTMLInputElement)?.value
        const lat2 = (document.getElementById('fenceLat2') as HTMLInputElement)?.value
        const npts = (document.getElementById('fenceNPoints') as HTMLInputElement)?.value ?? '100'
        if (lon1 && lat1 && lon2 && lat2) {
          url += `&lon1=${lon1}&lat1=${lat1}&lon2=${lon2}&lat2=${lat2}&n_points=${npts}`
        }
      }

      const assetResp = await fetch(url, { headers })
      if (!assetResp.ok) throw new Error(`HTTP ${assetResp.status}`)
      const asset = (await assetResp.json()) as { cached: boolean; url?: string; job_id?: string }

      if (asset.cached && asset.url) {
        renderViz3dAsset(output, asset.url, param, arch)
        return
      }

      if (asset.job_id) {
        output.innerHTML = `<div style="text-align:center;padding:20px;color:#94a3b8;font-size:12px">
          <i data-lucide="cpu" style="width:16px;height:16px;display:block;margin:0 auto 8px"></i>
          Génération en cours (30–90 s)…
          <progress id="viz3dProgress" value="0" max="100" style="display:block;width:80%;margin:8px auto"></progress>
        </div>`
        if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
        await pollViz3dJob(asset.job_id, output, param, arch)
      }
    } catch (err) {
      output.innerHTML = `<div style="padding:16px;color:#f87171;font-size:12px">
        <i data-lucide="alert-circle" style="width:14px;height:14px"></i>
        Erreur: ${escapeHtml(String(err))}
      </div>`
      if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
    }
  }

  function renderViz3dAsset(container: HTMLElement, url: string, param: string, arch: string): void {
    const archLabel: Record<string, string> = {
      B: 'Cartes stratigraphiques H1/H2/H3',
      C: 'Coupe transversale (Fence)',
      D: 'Isovaleurs',
    }
    container.innerHTML = `
      <div style="padding:10px">
        <img src="${url}" alt="${param.toUpperCase()} — ${archLabel[arch] ?? arch}"
          style="max-width:100%;border-radius:4px;cursor:zoom-in"
          onclick="this.style.maxWidth = this.style.maxWidth === '100%' ? 'none' : '100%'">
        <div style="display:flex;justify-content:flex-end;margin-top:6px">
          <a href="${url}" download style="font-size:11px;color:#3b82f6;text-decoration:none;display:flex;align-items:center;gap:4px">
            <i data-lucide="download" style="width:12px;height:12px"></i> PNG 300dpi
          </a>
        </div>
      </div>`
    if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
  }

  async function pollViz3dJob(jobId: string, container: HTMLElement, param: string, arch: string): Promise<void> {
    if (viz3dJobPollingInterval) clearInterval(viz3dJobPollingInterval)
    return new Promise<void>((resolve) => {
      viz3dJobPollingInterval = setInterval(async () => {
        try {
          const apiBase = getApiBase()
          const token = tokenStorage.getAccessToken?.()
          const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {}
          const resp = await fetch(`${apiBase}/ai/jobs/${jobId}`, { headers })
          if (!resp.ok) return
          const job = (await resp.json()) as MlJobStatus & { result_url?: string; result_svg?: string }

          const progress = container.querySelector<HTMLProgressElement>('#viz3dProgress')
          if (progress && job.progress_pct != null) progress.value = job.progress_pct

          if (job.status === 'done') {
            clearInterval(viz3dJobPollingInterval!)
            viz3dJobPollingInterval = null
            if (arch === 'C' && job.result_svg) {
              container.innerHTML = `
                <div id="fenceSvgWrap" style="overflow:auto;max-height:420px;padding:10px">${job.result_svg}</div>
                <div style="padding:6px 10px;display:flex;justify-content:flex-end">
                  <button onclick="(window as any).exportSvgToPng?.('fenceSvgWrap','${param}_fence')"
                    style="font-size:11px;padding:3px 8px;border:1px solid #334155;border-radius:4px;background:#1e293b;color:#94a3b8;cursor:pointer">
                    <i data-lucide="download" style="width:10px;height:10px"></i> Exporter PNG
                  </button>
                </div>`
              if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
            } else if (job.result_url) {
              renderViz3dAsset(container, job.result_url, param, arch)
            }
            resolve()
          } else if (['failed', 'cancelled'].includes(job.status)) {
            clearInterval(viz3dJobPollingInterval!)
            viz3dJobPollingInterval = null
            container.innerHTML = `<div style="padding:16px;color:#f87171;font-size:12px">
              <i data-lucide="x-circle" style="width:14px;height:14px"></i>
              Job ${escapeHtml(job.status)}${job.error_message ? ': ' + escapeHtml(job.error_message) : ''}
            </div>`
            if (typeof (window as any).lucide !== 'undefined') (window as any).lucide.createIcons()
            resolve()
          }
        } catch { /* retry */ }
      }, 3000)
    })
  }

  function escapeHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  }

  // Bind open/close + tabs
  openBtn.addEventListener('click', (e) => {
    e.preventDefault()
    open()
  })
  closeBtn.addEventListener('click', (e) => {
    e.preventDefault()
    close()
  })

  drawer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement
    if (target && target === drawer) close()
  })

  for (const btn of tabButtons) {
    btn.addEventListener('click', () => {
      const tab = (btn.getAttribute('data-s-tab') || 'eda') as ScientificTabId
      setActive(tab)
    })
  }
}

