/**
 * Plan de campagne terrain v2.0 — panneau droit unifié.
 * Presets d'objectif honnêtes (câblés sur CampaignWeights réels)
 * + mode expert (6 sliders de poids).
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

type CampaignWeights = {
  w_risque: number
  w_variance: number
  w_distance_sondage: number
  w_transition_geol: number
  w_infrastructure: number
  w_zone_coverage: number
}

type PlannerOpts = {
  map: L.Map
  getApiBase: () => string
  getAccessToken: () => string | null | undefined
}

/** 5 préréglages correspondant aux 6 poids réels de api-opti */
const PRESETS: Array<{ id: string; label: string; desc: string; weights: CampaignWeights }> = [
  {
    id: 'argilosite',
    label: 'Argilosité / gonflement',
    desc: 'Priorité aux zones à risque RGA élevé (VBS, IP, EG). Preset par défaut.',
    weights: { w_risque: 1.5, w_variance: 1.0, w_distance_sondage: 1.0, w_transition_geol: 1.0, w_infrastructure: 1.0, w_zone_coverage: 0.5 },
  },
  {
    id: 'krigeage',
    label: 'Réduction incertitude krigeage',
    desc: "Viser les mailles à σ²_K élevée — logique d'échantillonnage adaptatif (article §5).",
    weights: { w_risque: 1.0, w_variance: 1.8, w_distance_sondage: 1.2, w_transition_geol: 0.8, w_infrastructure: 0.8, w_zone_coverage: 0.5 },
  },
  {
    id: 'couverture',
    label: 'Couverture lacunaire',
    desc: 'Combler les zones sans sondage — maximise la distance aux sondages existants.',
    weights: { w_risque: 1.0, w_variance: 1.0, w_distance_sondage: 1.5, w_transition_geol: 0.8, w_infrastructure: 0.8, w_zone_coverage: 1.5 },
  },
  {
    id: 'logistique',
    label: 'Logistique / accessibilité',
    desc: 'Favorise les mailles accessibles (routes, infrastructure) — optimise la faisabilité terrain.',
    weights: { w_risque: 0.8, w_variance: 0.8, w_distance_sondage: 1.0, w_transition_geol: 0.8, w_infrastructure: 1.8, w_zone_coverage: 0.5 },
  },
  {
    id: 'equilibre',
    label: 'Équilibré',
    desc: 'Tous les poids à 1.0 — compromis général sans priorité particulière.',
    weights: { w_risque: 1.0, w_variance: 1.0, w_distance_sondage: 1.0, w_transition_geol: 1.0, w_infrastructure: 1.0, w_zone_coverage: 1.0 },
  },
]

const WEIGHT_LABELS: Record<keyof CampaignWeights, string> = {
  w_risque:           'Risque / argilosité',
  w_variance:         'Incertitude krigeage',
  w_distance_sondage: 'Éloignement sondages',
  w_transition_geol:  'Transition géologique',
  w_infrastructure:   'Accessibilité terrain',
  w_zone_coverage:    'Couverture zone',
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
  const rootEl = document.getElementById('campaignPlannerMount')
  if (!rootEl) return
  const root: HTMLElement = rootEl

  const weightSliderKeys = Object.keys(WEIGHT_LABELS) as Array<keyof CampaignWeights>

  root.innerHTML = `
<div style="font-family:system-ui,-apple-system,sans-serif">

  <!-- En-tête -->
  <div style="padding:14px 16px 10px;background:#0a1018;border-bottom:1px solid #1c2843">
    <div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:.1em;text-transform:uppercase;margin-bottom:4px">Plan de campagne terrain</div>
    <p style="margin:0;font-size:11px;color:#94a3b8;line-height:1.45">Sélection sous contrainte budget. Moteur : api-opti (AG ou heuristique).</p>
  </div>

  <!-- Section A : Cadrage -->
  <div style="padding:12px 14px;border-bottom:1px solid #1c284344">
    <div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Cadrage</div>

    <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:3px" for="cpZone">Zone d'étude</label>
    <select id="cpZone" class="cp-input" style="margin-bottom:8px"><option value="">Chargement…</option></select>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <div>
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:3px" for="cpGrid">Grille carte</label>
        <select id="cpGrid" class="cp-input"><option value="2km">2 km</option><option value="28km">28 km</option></select>
      </div>
      <div>
        <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:3px" for="cpBudget">Budget sondages</label>
        <input id="cpBudget" type="number" min="1" max="200" value="12" class="cp-input" />
      </div>
    </div>

    <label style="font-size:11px;color:#94a3b8;display:block;margin-bottom:3px" for="cpPreset">Objectif de la campagne</label>
    <select id="cpPreset" class="cp-input" style="margin-bottom:6px">
      ${PRESETS.map(p => `<option value="${p.id}">${p.label}</option>`).join('')}
    </select>
    <div id="cpPresetDesc" style="font-size:10px;color:#64748b;line-height:1.4;padding:5px 8px;background:#0a1018;border-radius:5px;border:1px solid #1c2843"></div>
  </div>

  <!-- Section B : Contraintes & Expert -->
  <div style="padding:12px 14px;border-bottom:1px solid #1c284344">
    <div style="font-size:10px;color:#64748b;font-weight:700;letter-spacing:.08em;text-transform:uppercase;margin-bottom:8px">Contraintes</div>

    <label style="font-size:11px;color:#e2e8f0;display:flex;gap:8px;align-items:center;cursor:pointer;margin-bottom:10px">
      <input type="checkbox" id="cpDepHard" checked style="width:14px;height:14px;accent-color:#3b82f6" />
      Dépression géologique (contrainte dure)
    </label>

    <label style="font-size:11px;display:flex;gap:8px;align-items:center;cursor:pointer">
      <input type="checkbox" id="cpExpert" style="width:14px;height:14px;accent-color:#a855f7" />
      <span style="color:#a855f7;font-weight:600">Mode expert — ajuster les poids</span>
    </label>

    <div id="cpWeights" style="display:none;margin-top:10px;padding:10px;background:#0a1018;border-radius:6px;border:1px solid #1c2843">
      ${weightSliderKeys.map(k => `
        <div style="margin-bottom:8px">
          <div style="display:flex;justify-content:space-between;font-size:10px;color:#94a3b8;margin-bottom:3px">
            <span>${WEIGHT_LABELS[k]}</span>
            <span id="cpW_${k}_val" style="font-variant-numeric:tabular-nums;color:#e2e8f0;font-weight:600">1.0</span>
          </div>
          <input type="range" id="cpW_${k}" min="0" max="2" step="0.1" value="1.0"
            style="width:100%;height:3px;accent-color:#a855f7;cursor:pointer" />
        </div>
      `).join('')}
    </div>
  </div>

  <!-- Section C : Exécution & Résultats -->
  <div style="padding:12px 14px">
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:8px">
      <button type="button" id="cpRunSimple" class="cp-btn">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>
        Rapide
      </button>
      <button type="button" id="cpRunGA" class="cp-btn cp-btn--primary">
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41"/></svg>
        Optimiser (AG)
      </button>
    </div>

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;font-size:11px;color:#94a3b8">
      <label style="display:flex;gap:6px;align-items:center;cursor:pointer">
        <input type="checkbox" id="cpShowMap" checked style="width:12px;height:12px;accent-color:#3b82f6" />
        Afficher sur la carte
      </label>
      <button type="button" id="cpClearMap" style="margin-left:auto;background:transparent;border:1px solid #22304d;border-radius:4px;color:#64748b;font-size:10px;padding:3px 8px;cursor:pointer;transition:border-color .15s">Effacer</button>
    </div>

    <div id="cpStatus" style="min-height:1.4em;font-size:11px;color:#94a3b8;margin-bottom:6px"></div>
    <div id="cpMetrics" style="display:none;font-size:11px;color:#cbd5e1;line-height:1.6;margin-bottom:8px;padding:8px;background:#0a1018;border-radius:6px;border:1px solid #1c2843"></div>

    <div style="border:1px solid #1c2843;border-radius:8px;overflow:hidden;max-height:220px;overflow-y:auto">
      <table style="width:100%;border-collapse:collapse;font-size:11px">
        <thead style="position:sticky;top:0;background:#0a1018;z-index:1">
          <tr>
            <th style="text-align:left;padding:6px 8px;color:#64748b;font-weight:600">#</th>
            <th style="text-align:left;padding:6px 8px;color:#64748b;font-weight:600">Maille</th>
            <th style="text-align:right;padding:6px 8px;color:#64748b;font-weight:600">Score</th>
          </tr>
        </thead>
        <tbody id="cpTableBody"></tbody>
      </table>
    </div>
  </div>
</div>

<style>
.cp-input{width:100%;padding:8px 10px;background:#0f1e30;border:1px solid #22304d;border-radius:7px;color:#e2e8f0;font-size:12px;font-family:inherit;transition:border-color .15s;display:block}
.cp-input:focus{outline:none;border-color:#3b82f6;box-shadow:0 0 0 2px rgba(59,130,246,.2)}
select.cp-input{appearance:none;background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%2394A3B8' stroke-width='2'%3E%3Cpath d='m6 9 6 6 6-6'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 10px center;padding-right:30px}
.cp-btn{display:flex;align-items:center;justify-content:center;gap:5px;padding:9px 12px;background:#0f1e30;border:1px solid #22304d;border-radius:7px;color:#e2e8f0;font-size:12px;font-weight:600;font-family:inherit;cursor:pointer;transition:border-color .15s,background .15s}
.cp-btn:hover{border-color:#3b82f6;background:#1e3a5f}
.cp-btn--primary{background:#1d4ed8;border-color:#2563eb;color:#f0f9ff}
.cp-btn--primary:hover{background:#2563eb;border-color:#60a5fa}
.cp-btn:disabled{opacity:.45;cursor:not-allowed}
</style>
`

  // ── Références DOM ──────────────────────────────────────────────────────
  const zoneEl     = root.querySelector<HTMLSelectElement>('#cpZone')!
  const budgetEl   = root.querySelector<HTMLInputElement>('#cpBudget')!
  const gridEl     = root.querySelector<HTMLSelectElement>('#cpGrid')!
  const depHardEl  = root.querySelector<HTMLInputElement>('#cpDepHard')!
  const presetEl   = root.querySelector<HTMLSelectElement>('#cpPreset')!
  const presetDesc = root.querySelector<HTMLDivElement>('#cpPresetDesc')!
  const expertEl   = root.querySelector<HTMLInputElement>('#cpExpert')!
  const weightsEl  = root.querySelector<HTMLDivElement>('#cpWeights')!
  const statusEl   = root.querySelector<HTMLDivElement>('#cpStatus')!
  const metricsEl  = root.querySelector<HTMLDivElement>('#cpMetrics')!
  const tbody      = root.querySelector<HTMLTableSectionElement>('#cpTableBody')!

  // ── Couche Leaflet ─────────────────────────────────────────────────────
  const campaignLayer = L.layerGroup()
  campaignLayer.addTo(opts.map)
  ;(window as unknown as { atlasCampaignLayer?: L.LayerGroup }).atlasCampaignLayer = campaignLayer

  // ── Presets ────────────────────────────────────────────────────────────
  function currentPreset() {
    return PRESETS.find(p => p.id === presetEl.value) ?? PRESETS[0]
  }

  function syncPresetDesc() {
    presetDesc.textContent = currentPreset().desc
  }

  function applyPresetToSliders() {
    const w = currentPreset().weights
    weightSliderKeys.forEach(k => {
      const s = root.querySelector<HTMLInputElement>(`#cpW_${k}`)
      const v = root.querySelector<HTMLElement>(`#cpW_${k}_val`)
      if (s) s.value = String(w[k])
      if (v) v.textContent = w[k].toFixed(1)
    })
  }

  function readSlidersAsWeights(): CampaignWeights {
    return Object.fromEntries(
      weightSliderKeys.map(k => {
        const raw = parseFloat(root.querySelector<HTMLInputElement>(`#cpW_${k}`)?.value ?? '1')
        return [k, isNaN(raw) ? 1 : raw]
      })
    ) as CampaignWeights
  }

  // Init
  syncPresetDesc()
  applyPresetToSliders()

  presetEl.addEventListener('change', () => {
    syncPresetDesc()
    if (!expertEl.checked) applyPresetToSliders()
  })

  expertEl.addEventListener('change', () => {
    weightsEl.style.display = expertEl.checked ? 'block' : 'none'
    if (expertEl.checked) applyPresetToSliders()
  })

  weightSliderKeys.forEach(k => {
    root.querySelector<HTMLInputElement>(`#cpW_${k}`)?.addEventListener('input', e => {
      const v = parseFloat((e.target as HTMLInputElement).value)
      const el = root.querySelector<HTMLElement>(`#cpW_${k}_val`)
      if (el) el.textContent = v.toFixed(1)
    })
  })

  // ── Zones ──────────────────────────────────────────────────────────────
  async function loadZones(): Promise<void> {
    const api   = opts.getApiBase()
    const token = opts.getAccessToken()
    try {
      const res  = await fetch(`${api}/zones-etude`, { headers: headersJson(token) })
      if (!res.ok) throw new Error(`zones-etude ${res.status}`)
      const rows: Array<{ code?: string; nom?: string }> = await res.json()
      zoneEl.innerHTML = ''
      const o0 = document.createElement('option')
      o0.value = ''
      o0.textContent = '— Zone —'
      zoneEl.appendChild(o0)
      for (const z of rows.filter(z => z.code)) {
        const o = document.createElement('option')
        o.value = z.code!
        o.textContent = `${z.code}${z.nom ? ' — ' + z.nom : ''}`
        zoneEl.appendChild(o)
      }
    } catch (e) {
      zoneEl.innerHTML = '<option value="">Erreur chargement zones</option>'
      statusEl.textContent = String((e as Error).message || e)
    }
  }

  // ── Table ──────────────────────────────────────────────────────────────
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
      tr.style.borderBottom = '1px solid #1c284322'
      tr.innerHTML = `
        <td style="padding:5px 8px;font-weight:700;color:#a855f7">${m.rank}</td>
        <td style="padding:5px 8px">
          <div style="font-weight:600;color:#e2e8f0">${m.maille_code}</div>
          <div style="font-size:9px;color:#475569;margin-top:1px">${(m.justification || []).slice(0, 2).join(' · ')}</div>
        </td>
        <td style="padding:5px 8px;text-align:right;color:#f4b740;font-variant-numeric:tabular-nums">${m.score_critique.toFixed(3)}</td>
      `
      tr.title = (m.justification || []).join('\n')
      tbody.appendChild(tr)
    }
    const met = data.metrics
    if (met) {
      metricsEl.style.display = 'block'
      metricsEl.innerHTML = `
        <div><strong>Pool</strong> : ${met.pool_size ?? data.pool_size ?? '—'} candidates</div>
        <div><strong>En dépression</strong> : ${met.candidates_in_depression ?? '—'}</div>
        <div><strong>Risque moy.</strong> : ${typeof met.mean_risque_score === 'number' ? met.mean_risque_score.toFixed(3) : '—'}</div>
        <div><strong>Méthode</strong> : ${data.method ?? '—'}${data.model_version ? ` (${data.model_version})` : ''}</div>
        ${data.best_fitness != null ? `<div><strong>Fitness AG</strong> : ${data.best_fitness}</div>` : ''}
      `
    }
  }

  // ── Overlay carte ──────────────────────────────────────────────────────
  async function overlayMailles(list: CampaignMaille[]) {
    campaignLayer.clearLayers()
    const showMapEl = root.querySelector<HTMLInputElement>('#cpShowMap')
    if (!showMapEl?.checked) return
    const api   = opts.getApiBase()
    const token = opts.getAccessToken()
    const grid  = gridEl.value === '28km' ? '28km' : '2km'
    for (const m of list) {
      try {
        const res = await fetch(`${api}/maille/${encodeURIComponent(m.maille_code)}?grid=${grid}`, {
          headers: headersJson(token),
        })
        if (!res.ok) continue
        const feat = await res.json()
        const col  = m.rank <= 3 ? '#ef476f' : m.rank <= 8 ? '#f4b740' : '#6366f1'
        const gj   = L.geoJSON(feat as GeoJSON.Feature, {
          style: { color: col, weight: m.in_depression ? 3 : 2, fillColor: col, fillOpacity: 0.13 },
        })
        const center = gj.getBounds().getCenter()
        L.marker(center, {
          icon: L.divIcon({
            className: 'campaign-mission-rank',
            html: `<span>${m.rank}</span>`,
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          }),
        })
          .bindTooltip(`${m.rank}. ${m.maille_code} — ${m.score_critique.toFixed(2)}`, { direction: 'top' })
          .addTo(campaignLayer)
        gj.addTo(campaignLayer)
      } catch { /* geometry manquante */ }
    }
    if (list.length) {
      try {
        opts.map.fitBounds((campaignLayer as unknown as L.FeatureGroup).getBounds(), { padding: [24, 24], maxZoom: 12 })
      } catch { /* bounds vides */ }
    }
  }

  // ── Run ────────────────────────────────────────────────────────────────
  async function run(mode: 'simple' | 'ga') {
    const zone = (zoneEl.value || '').trim()
    if (!zone) {
      statusEl.style.color = '#f4b740'
      statusEl.textContent = "Choisissez une zone d'étude."
      return
    }
    const n = Math.max(1, Math.min(200, parseInt(budgetEl.value || '12', 10) || 12))
    budgetEl.value = String(n)

    const runSimpleBtn = root.querySelector<HTMLButtonElement>('#cpRunSimple')
    const runGaBtn     = root.querySelector<HTMLButtonElement>('#cpRunGA')
    if (runSimpleBtn) runSimpleBtn.disabled = true
    if (runGaBtn)     runGaBtn.disabled     = true

    statusEl.style.color = '#94a3b8'
    statusEl.textContent = mode === 'ga' ? 'Optimisation AG en cours…' : 'Classement heuristique…'
    clearTable()

    const api     = opts.getApiBase()
    const token   = opts.getAccessToken()
    const weights = expertEl.checked ? readSlidersAsWeights() : currentPreset().weights

    const body = {
      zone,
      budget: n,
      objectif: currentPreset().id === 'argilosite' ? 'gonflement' : currentPreset().id,
      mode: 'exploration',
      depression_hard_constraint: depHardEl.checked,
      weights,
    }

    const path = mode === 'ga' ? '/ai/opti/campaign' : '/ai/opti/campaign/simple'
    try {
      const res  = await fetch(`${api}${path}`, {
        method: 'POST',
        headers: headersJson(token),
        body: JSON.stringify(body),
      })
      const data = (await res.json().catch(() => ({}))) as CampaignApiResult & { error?: string; detail?: string }
      if (!res.ok) {
        statusEl.style.color = '#ef476f'
        statusEl.textContent = data.detail || data.error || `HTTP ${res.status}`
        return
      }
      const list = listFromResponse(data)
      statusEl.style.color = '#0bb07b'
      statusEl.textContent = `OK — ${list.length} maille(s) proposée(s).`
      renderTable(data)
      await overlayMailles(list)
    } catch (e) {
      statusEl.style.color = '#ef476f'
      statusEl.textContent = String((e as Error).message || e)
    } finally {
      if (runSimpleBtn) runSimpleBtn.disabled = false
      if (runGaBtn)     runGaBtn.disabled     = false
    }
  }

  // ── Listeners ──────────────────────────────────────────────────────────
  root.querySelector('#cpRunSimple')?.addEventListener('click', () => void run('simple'))
  root.querySelector('#cpRunGA')?.addEventListener('click',     () => void run('ga'))
  root.querySelector('#cpClearMap')?.addEventListener('click', () => {
    campaignLayer.clearLayers()
    statusEl.style.color = '#94a3b8'
    statusEl.textContent = 'Couche effacée.'
  })

  void loadZones()
}
