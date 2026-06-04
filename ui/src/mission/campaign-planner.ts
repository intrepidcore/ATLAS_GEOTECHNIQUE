/**
 * Assistant optimisation campagne de reconnaissance (api-geo → api-opti).
 * Couche carte : mailles numérotées + surbrillance priorité.
 */
import L from 'leaflet'

export type CampaignMaille = {
  rank: number
  maille_id: string
  maille_code: string
  score_critique: number
  in_depression: boolean
  justification: string[]
}

export type CampaignApiResult = {
  ok?: boolean
  mailles_prioritaires?: CampaignMaille[]
  recommended_cells?: CampaignMaille[]
  score?: number[]
  method?: string
  model_version?: string
  best_fitness?: number | null
  metrics?: {
    pool_size?: number
    candidates_in_depression?: number
    mean_risque_score?: number
    budget_requested?: number
    budget_returned?: number
    best_fitness?: number | null
  }
  pool_size?: number
}

type PlannerOpts = {
  map: L.Map
  getApiBase: () => string
  getAccessToken: () => string | null | undefined
}

function headersJson(token?: string | null): HeadersInit {
  const h: Record<string, string> = { 'Content-Type': 'application/json' }
  if (token) h.Authorization = `Bearer ${token}`
  return h
}

function listFromResponse(data: CampaignApiResult): CampaignMaille[] {
  if (Array.isArray(data.mailles_prioritaires) && data.mailles_prioritaires.length)
    return data.mailles_prioritaires
  if (Array.isArray(data.recommended_cells)) return data.recommended_cells
  return []
}

export function initCampaignPlanner(opts: PlannerOpts): void {
  const root = document.getElementById('campaignPlannerMount')
  if (!root) return

  root.innerHTML = `
    <div style="padding:12px;background:#0f172a;border-radius:12px;border:1px solid #1c2843">
      <div style="font-size:11px;color:#94a3b8;font-weight:600;letter-spacing:0.08em;text-transform:uppercase;margin-bottom:8px">
        Assistant campagne reconnaissance
      </div>
      <p style="margin:0 0 10px 0;font-size:11px;color:#94a3b8;line-height:1.45">
        Sélection sous contrainte budget ; contrainte dure « dépression géologique » (activée par défaut). Moteur : api-opti (AG ou heuristique).
      </p>
      <label class="sr-only" for="campaignZoneSelect">Zone d'étude</label>
      <select id="campaignZoneSelect" class="input" style="margin-bottom:8px">
        <option value="">Chargement zones…</option>
      </select>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
        <div>
          <label style="font-size:10px;color:var(--muted)">Budget sondages</label>
          <input id="campaignBudget" type="number" min="1" max="200" value="12" class="input" />
        </div>
        <div>
          <label style="font-size:10px;color:var(--muted)">Grille carte</label>
          <select id="campaignGrid" class="input">
            <option value="2km">2 km</option>
            <option value="28km">28 km</option>
          </select>
        </div>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:8px">
        <label style="font-size:11px;color:#cbd5e1;display:flex;gap:6px;align-items:center;cursor:pointer">
          <input type="checkbox" id="campaignDepressionHard" checked />
          Contrainte dépression (dur)
        </label>
      </div>
      <div style="display:flex;flex-wrap:wrap;gap:8px;margin-bottom:8px">
        <button type="button" class="btn" id="campaignRunSimple" style="flex:1;min-width:120px;font-size:12px">Classement rapide</button>
        <button type="button" class="btn primary" id="campaignRunGA" style="flex:1;min-width:120px;font-size:12px">Optimiser (AG)</button>
      </div>
      <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:11px;color:#94a3b8">
        <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
          <input type="checkbox" id="campaignShowOnMap" checked />
          Afficher sur la carte
        </label>
        <button type="button" class="btn-sm" id="campaignClearMap" style="margin-left:auto">Effacer couche</button>
      </div>
      <div id="campaignStatus" class="status" style="min-height:1.2em"></div>
      <div id="campaignMetrics" style="display:none;margin-top:10px;font-size:11px;color:#cbd5e1;line-height:1.5"></div>
      <div style="max-height:220px;overflow:auto;margin-top:10px;border:1px solid #1c2843;border-radius:8px">
        <table style="width:100%;border-collapse:collapse;font-size:11px">
          <thead style="position:sticky;top:0;background:#0a1018;z-index:1">
            <tr>
              <th style="text-align:left;padding:6px 8px;color:#94a3b8">#</th>
              <th style="text-align:left;padding:6px 8px;color:#94a3b8">Maille</th>
              <th style="text-align:right;padding:6px 8px;color:#94a3b8">Score</th>
            </tr>
          </thead>
          <tbody id="campaignTableBody"></tbody>
        </table>
      </div>
    </div>
  `

  const zoneEl = root.querySelector('#campaignZoneSelect') as HTMLSelectElement
  const budgetEl = root.querySelector('#campaignBudget') as HTMLInputElement
  const gridEl = root.querySelector('#campaignGrid') as HTMLSelectElement
  const depHardEl = root.querySelector('#campaignDepressionHard') as HTMLInputElement
  const statusEl = root.querySelector('#campaignStatus') as HTMLDivElement
  const metricsEl = root.querySelector('#campaignMetrics') as HTMLDivElement
  const tbody = root.querySelector('#campaignTableBody') as HTMLTableSectionElement
  const showMapEl = root.querySelector('#campaignShowOnMap') as HTMLInputElement

  const campaignLayer = L.layerGroup()
  campaignLayer.addTo(opts.map)
  ;(window as unknown as { atlasCampaignLayer?: L.LayerGroup }).atlasCampaignLayer = campaignLayer

  async function loadZones() {
    const api = opts.getApiBase()
    const token = opts.getAccessToken()
    try {
      const res = await fetch(`${api}/zones-etude`, { headers: headersJson(token) })
      if (!res.ok) throw new Error(`zones-etude ${res.status}`)
      const rows: Array<{ code?: string; nom?: string }> = await res.json()
      const pub = rows.filter((z) => z.code)
      zoneEl.innerHTML = ''
      const o0 = document.createElement('option')
      o0.value = ''
      o0.textContent = '— Zone —'
      zoneEl.appendChild(o0)
      for (const z of pub) {
        const o = document.createElement('option')
        o.value = z.code!
        o.textContent = `${z.code}${z.nom ? ' — ' + z.nom : ''}`
        zoneEl.appendChild(o)
      }
    } catch (e) {
      zoneEl.innerHTML = `<option value="">Erreur chargement zones</option>`
      statusEl.textContent = String((e as Error).message || e)
    }
  }

  function clearTable() {
    tbody.innerHTML = ''
    metricsEl.style.display = 'none'
    metricsEl.textContent = ''
  }

  function renderTable(data: CampaignApiResult) {
    const list = listFromResponse(data)
    tbody.innerHTML = ''
    for (const m of list) {
      const tr = document.createElement('tr')
      tr.style.borderBottom = '1px solid #1c284333'
      tr.innerHTML = `
        <td style="padding:6px 8px;font-weight:700;color:#a855f7">${m.rank}</td>
        <td style="padding:6px 8px">
          <div style="font-weight:600;color:#e2e8f0">${m.maille_code}</div>
          <div style="font-size:10px;color:#64748b;margin-top:2px">${(m.justification || []).slice(0, 2).join(' · ')}</div>
        </td>
        <td style="padding:6px 8px;text-align:right;color:#f4b740">${m.score_critique.toFixed(3)}</td>
      `
      tr.title = (m.justification || []).join('\n')
      tbody.appendChild(tr)
    }
    const met = data.metrics
    if (met) {
      metricsEl.style.display = 'block'
      metricsEl.innerHTML = `
        <div><strong>Pool</strong> : ${met.pool_size ?? data.pool_size ?? '—'} mailles candidates</div>
        <div><strong>En dépression</strong> : ${met.candidates_in_depression ?? '—'}</div>
        <div><strong>Risque moy.</strong> : ${met.mean_risque_score ?? '—'}</div>
        <div><strong>Méthode</strong> : ${data.method ?? '—'} ${data.model_version ? `(${data.model_version})` : ''}</div>
        ${data.best_fitness != null ? `<div><strong>Fitness AG</strong> : ${data.best_fitness}</div>` : ''}
      `
    }
  }

  async function overlayMailles(list: CampaignMaille[]) {
    campaignLayer.clearLayers()
    if (!showMapEl.checked) return
    const api = opts.getApiBase()
    const token = opts.getAccessToken()
    const grid = gridEl.value === '28km' ? '28km' : '2km'
    for (const m of list) {
      try {
        const res = await fetch(`${api}/maille/${encodeURIComponent(m.maille_code)}?grid=${grid}`, {
          headers: headersJson(token),
        })
        if (!res.ok) continue
        const feat = await res.json()
        const col = m.rank <= 3 ? '#ef476f' : m.rank <= 8 ? '#f4b740' : '#6366f1'
        const gj = L.geoJSON(feat as GeoJSON.Feature, {
          style: {
            color: col,
            weight: m.in_depression ? 3 : 2,
            fillColor: col,
            fillOpacity: 0.12,
          },
        })
        const center = gj.getBounds().getCenter()
        const icon = L.divIcon({
          className: 'campaign-mission-rank',
          html: `<span>${m.rank}</span>`,
          iconSize: [26, 26],
          iconAnchor: [13, 13],
        })
        L.marker(center, { icon })
          .bindTooltip(`${m.rank}. ${m.maille_code} — ${m.score_critique.toFixed(2)}`, { direction: 'top' })
          .addTo(campaignLayer)
        gj.addTo(campaignLayer)
      } catch {
        /* ignore missing geometry */
      }
    }
    if (list.length) {
      try {
        opts.map.fitBounds((campaignLayer as unknown as L.FeatureGroup).getBounds(), { padding: [24, 24], maxZoom: 12 })
      } catch {
        /* empty bounds */
      }
    }
  }

  async function run(mode: 'simple' | 'ga') {
    const zone = (zoneEl.value || '').trim()
    if (!zone) {
      statusEl.textContent = 'Choisissez une zone d’étude.'
      return
    }
    const n = Math.max(1, Math.min(200, parseInt(budgetEl.value || '12', 10) || 12))
    budgetEl.value = String(n)
    statusEl.textContent = mode === 'ga' ? 'Optimisation AG en cours…' : 'Classement heuristique…'
    clearTable()
    const api = opts.getApiBase()
    const token = opts.getAccessToken()
    const body = {
      zone,
      budget: n,
      objectif: 'gonflement',
      mode: 'exploration',
      depression_hard_constraint: depHardEl.checked,
    }
    const path = mode === 'ga' ? '/ai/opti/campaign' : '/ai/opti/campaign/simple'
    try {
      const res = await fetch(`${api}${path}`, {
        method: 'POST',
        headers: headersJson(token),
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as CampaignApiResult & { error?: string; detail?: string }
      if (!res.ok) {
        statusEl.textContent = data.detail || data.error || `HTTP ${res.status}`
        return
      }
      statusEl.textContent = `OK — ${listFromResponse(data).length} maille(s) proposée(s).`
      renderTable(data)
      await overlayMailles(listFromResponse(data))
    } catch (e) {
      statusEl.textContent = String((e as Error).message || e)
    }
  }

  root.querySelector('#campaignRunSimple')?.addEventListener('click', () => run('simple'))
  root.querySelector('#campaignRunGA')?.addEventListener('click', () => run('ga'))
  root.querySelector('#campaignClearMap')?.addEventListener('click', () => {
    campaignLayer.clearLayers()
    statusEl.textContent = 'Couche campagne effacée.'
  })

  void loadZones()
}
