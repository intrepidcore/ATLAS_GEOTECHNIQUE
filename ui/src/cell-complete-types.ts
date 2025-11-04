// Types pour /cells/{code}/complete enrichi (v2.4.0)

export type Physiques = {
  densite_absolue_gcm3?: number
  teneur_eau_pct?: number
  source?: string
}

export type ClassifItem = { 
  class: string
  reason?: string 
}

export type Classif = { 
  aashto?: ClassifItem[]
  uscs?: ClassifItem[]
  gtr?: ClassifItem[] 
}

export type SampleOut = {
  id: string
  depth_m: number
  wl?: number
  wp?: number
  ip?: number
  vbs?: number
  physiques?: Physiques
  classif?: Classif
  atterberg?: any
  granulo?: any
  proctor?: any
  swelling?: any
}

export type SurveyOut = {
  id: string
  code_site?: string
  mode: string
  location_mode?: string
  date?: string
  adm3_code?: string
  samples?: number
  tests?: number
  grid_code?: string
  badge?: string // "ADM random cell"
}

export type CellCompleteOut = {
  kpi: { 
    n_sondages: number
    n_echantillons: number
    updated_at: string 
  }
  samples: SampleOut[]
  surveys: SurveyOut[]
  overview?: any
  source_surveys?: SurveyOut[]
}

// Fonctions de rendu
export function renderPhysiques(container: HTMLElement, samples: SampleOut[]) {
  const list = samples
    .filter(s => s.physiques && (s.physiques!.densite_absolue_gcm3 != null || s.physiques!.teneur_eau_pct != null))
    .map(s => {
      const p = s.physiques!
      const dens = p.densite_absolue_gcm3 != null ? `${p.densite_absolue_gcm3.toFixed(2)} g/cm³` : '—'
      const ten = p.teneur_eau_pct != null ? `${p.teneur_eau_pct.toFixed(2)} %` : '—'
      return `<li><strong>${s.depth_m.toFixed(2)} m</strong> — ρ<sub>s</sub> ${dens}, w ${ten}${p.source ? ` <em>(${p.source})</em>` : ''}</li>`
    }).join('')
  container.innerHTML = list ? `<ul class="list">${list}</ul>` : `<div class="empty">Aucune donnée physique</div>`
}

export function renderClassif(container: HTMLElement, samples: SampleOut[]) {
  const rows = samples.map(s => {
    const c = s.classif
    if (!c) return ''
    const sec = (label: string, arr?: ClassifItem[]) =>
      arr && arr.length ? `<div class="chipline"><span class="chip chip-${label.toLowerCase()}">${label}</span> ${arr.map(x => `<span class="pill" title="${x.reason ?? ''}">${x.class}</span>`).join(' ')}</div>` : ''
    return `<div class="sample-row">
      <div class="depth">${s.depth_m.toFixed(2)} m</div>
      <div class="classes">
        ${sec('AASHTO', c.aashto)}
        ${sec('USCS', c.uscs)}
        ${sec('GTR', c.gtr)}
      </div>
    </div>`
  }).join('')
  container.innerHTML = rows || `<div class="empty">Aucune classification</div>`
}

export function renderSurveys(container: HTMLElement, surveys: SurveyOut[]) {
  const rows = surveys.map(s => {
    const badge = s.badge ? `<span class="badge-adm">${s.badge}</span>` : ''
    const code = s.code_site || 'N/A'
    const mode = s.mode || s.location_mode || 'unknown'
    return `<li><strong>${code}</strong> • <code>${mode}</code>${badge ? ' ' + badge : ''}</li>`
  }).join('')
  container.innerHTML = rows ? `<ul class="list">${rows}</ul>` : `<div class="empty">Aucun sondage</div>`
}
