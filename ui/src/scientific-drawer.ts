import { Chart, registerables } from 'chart.js'
import { getApiBase } from './api-base'
import { tokenStorage } from './services/auth-api'
import { parseKedApiParameterId } from './thematic/thematic-types'
import { getActiveThematicParameterId } from './thematic/thematic-parameter-context'

// Register chart types (safe if already registered elsewhere)
Chart.register(...registerables)

type ScientificTabId = 'eda' | 'corr' | 'variogram' | 'validation' | 'ml' | 'compare'

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
  }

  let activeTab: ScientificTabId = 'eda'
  let loaded: Record<ScientificTabId, boolean> = {
    eda: false,
    corr: false,
    variogram: false,
    validation: false,
    ml: false,
    compare: false,
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
    else if (tab === 'ml') setPanelStatus('ml', 'Prêt.')
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

  const loadValidation = async () => {
    const st = document.getElementById('scientificValidationStatus')
    const body = document.getElementById('scientificValidationBody')
    if (st) st.textContent = 'Chargement LOO / variogrammes…'
    try {
      const items = await fetchVariogramSummary()
      if (st) st.textContent = 'Prêt.'
      if (body) {
        if (items.length === 0) {
          body.innerHTML = '<p>Aucune entrée dans <code>ai_variograms</code> pour le moment.</p>'
        } else {
          const rows = items
            .slice(0, 80)
            .map((it) => {
              const hz = it.horizon == null ? '—' : String(it.horizon)
              const loo = it.loo_rmse == null ? '—' : Number(it.loo_rmse).toFixed(4)
              const blk = it.block_rmse == null ? '—' : Number(it.block_rmse).toFixed(4)
              const mt = it.model_type ?? '—'
              const pid = it.parameter_id ?? '—'
              return `<tr><td>${escapeHtml(pid)}</td><td>${escapeHtml(hz)}</td><td>${loo}</td><td>${blk}</td><td>${escapeHtml(mt)}</td></tr>`
            })
            .join('')
          body.innerHTML = `<table style="width:100%;border-collapse:collapse;font-size:11px">
<thead><tr style="text-align:left;border-bottom:1px solid var(--border)">
<th>parameter_id</th><th>horizon</th><th>loo_rmse</th><th>block_rmse</th><th>model</th>
</tr></thead><tbody>${rows}</tbody></table>`
        }
      }
    } catch (e) {
      if (body) body.innerHTML = `<p style="color:#f97316">${escapeHtml((e as Error).message || String(e))}</p>`
      if (st) st.textContent = 'Erreur chargement.'
    }
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

