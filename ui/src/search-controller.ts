export type SearchResultType =
  | 'maille_2km'
  | 'maille_28km'
  | 'adm1'
  | 'adm2'
  | 'adm3'
  | 'sondage'

export type SearchResult = {
  type: SearchResultType
  id: string | null
  code: string | null
  label: string
  bbox: [number, number, number, number] | null
  centroid: [number, number] | null
  has_geom: boolean
}

export type SearchControllerOptions = {
  apiBase: string
  inputId?: string
  minChars?: number
  debounceMs?: number
  limit?: number
  toast?: (msg: string, kind?: 'ok' | 'err') => void
  onSelect: (result: SearchResult) => void
}

type CacheEntry = {
  at: number
  items: SearchResult[]
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

function groupLabel(t: SearchResultType): string {
  switch (t) {
    case 'maille_2km':
      return 'Mailles 2km'
    case 'maille_28km':
      return 'Mailles 28km'
    case 'adm1':
      return 'ADM1'
    case 'adm2':
      return 'ADM2'
    case 'adm3':
      return 'ADM3'
    case 'sondage':
      return 'Sondages'
    default:
      return 'Résultats'
  }
}

function ensureDropdown(input: HTMLInputElement): HTMLElement {
  const id = `${input.id}-dropdown`
  let el = document.getElementById(id)
  if (el) return el

  el = document.createElement('div')
  el.id = id
  el.style.position = 'absolute'
  el.style.zIndex = '2500'
  el.style.background = 'var(--panel, #0b1220)'
  el.style.border = '1px solid #22304d'
  el.style.borderRadius = '8px'
  el.style.boxShadow = '0 10px 25px rgba(0,0,0,0.35)'
  el.style.overflow = 'hidden'
  el.style.display = 'none'
  el.style.maxHeight = '320px'
  el.style.overflowY = 'auto'
  document.body.appendChild(el)
  return el
}

function positionDropdown(input: HTMLInputElement, dropdown: HTMLElement): void {
  const r = input.getBoundingClientRect()
  dropdown.style.left = `${Math.round(r.left)}px`
  dropdown.style.top = `${Math.round(r.bottom + 6)}px`
  dropdown.style.width = `${Math.round(r.width)}px`
}

export function createSearchController(opts: SearchControllerOptions) {
  const inputId = opts.inputId ?? 'unifiedSearch'
  const minChars = opts.minChars ?? 2
  const debounceMs = opts.debounceMs ?? 200
  const limit = opts.limit ?? 20
  const toast = opts.toast

  const cache = new Map<string, CacheEntry>()
  const cacheTtlMs = 60_000

  const inputMaybe = document.getElementById(inputId) as HTMLInputElement | null
  if (!inputMaybe) {
    console.warn(`[SearchController] input #${inputId} not found`)
    return {
      destroy() {},
      focus() {},
    }
  }

  const input = inputMaybe

  const dropdown = ensureDropdown(input)

  let items: SearchResult[] = []
  let activeIndex = -1
  let debounceTimer: number | null = null
  let destroyed = false

  function hide() {
    dropdown.style.display = 'none'
    dropdown.innerHTML = ''
    items = []
    activeIndex = -1
  }

  function show() {
    positionDropdown(input, dropdown)
    dropdown.style.display = 'block'
  }

  function setActive(idx: number) {
    activeIndex = idx
    const rows = dropdown.querySelectorAll('[data-idx]')
    rows.forEach((n) => {
      const el = n as HTMLElement
      const i = Number(el.dataset.idx)
      if (i === activeIndex) {
        el.style.background = 'rgba(58,166,255,0.15)'
      } else {
        el.style.background = 'transparent'
      }
    })
  }

  function render(list: SearchResult[]) {
    items = list
    activeIndex = list.length > 0 ? 0 : -1

    if (list.length === 0) {
      dropdown.innerHTML = `<div style="padding:10px 12px;color:#8b9bb3;font-size:12px">Aucun résultat</div>`
      show()
      return
    }

    const byType = new Map<SearchResultType, SearchResult[]>()
    for (const it of list) {
      const arr = byType.get(it.type) ?? []
      arr.push(it)
      byType.set(it.type, arr)
    }

    let idx = 0
    let html = ''
    for (const [t, arr] of byType.entries()) {
      html += `<div style="padding:8px 12px;font-size:11px;color:#8b9bb3;background:rgba(255,255,255,0.03);border-bottom:1px solid rgba(34,48,77,0.6)">${escapeHtml(groupLabel(t))}</div>`
      for (const it of arr) {
        const disabled = it.has_geom ? '' : ' (localisation indisponible)'
        html += `<div data-idx="${idx}" style="padding:10px 12px;cursor:pointer;font-size:12px;color:var(--text,#e2e8f0);border-bottom:1px solid rgba(34,48,77,0.45)">
          <div style="display:flex;justify-content:space-between;gap:10px;align-items:center">
            <div style="flex:1;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(it.label)}</div>
            <div style="font-size:10px;color:#8b9bb3;white-space:nowrap">${escapeHtml(it.type)}${escapeHtml(disabled)}</div>
          </div>
        </div>`
        idx++
      }
    }

    dropdown.innerHTML = html
    const rowEls = dropdown.querySelectorAll('[data-idx]')
    rowEls.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        const i = Number((el as HTMLElement).dataset.idx)
        setActive(i)
      })
      el.addEventListener('mousedown', (e) => {
        e.preventDefault()
      })
      el.addEventListener('click', () => {
        const i = Number((el as HTMLElement).dataset.idx)
        const item = items[i]
        if (item) select(item)
      })
    })

    show()
    if (activeIndex >= 0) setActive(activeIndex)
  }

  async function fetchResults(q: string): Promise<SearchResult[]> {
    const key = q.toLowerCase()
    const now = Date.now()
    const cached = cache.get(key)
    if (cached && now - cached.at < cacheTtlMs) {
      return cached.items
    }

    const url = `${opts.apiBase}/search/unified?q=${encodeURIComponent(q)}&limit=${limit}`
    const res = await fetch(url)
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`)
    }

    const json = (await res.json()) as SearchResult[]
    cache.set(key, { at: now, items: json })
    return json
  }

  async function runSearch(q: string) {
    if (destroyed) return
    if (q.trim().length < minChars) {
      hide()
      return
    }

    try {
      const list = await fetchResults(q.trim())
      render(list)
    } catch (e: any) {
      console.error('[SearchController] search failed', e)
      hide()
      toast?.(`Recherche impossible (${e?.message || e})`, 'err')
    }
  }

  function select(result: SearchResult) {
    hide()
    input.value = result.code ?? result.label
    opts.onSelect(result)
  }

  function onInput() {
    if (debounceTimer !== null) {
      window.clearTimeout(debounceTimer)
    }
    debounceTimer = window.setTimeout(() => {
      debounceTimer = null
      void runSearch(input.value)
    }, debounceMs)
  }

  function onKeyDown(e: KeyboardEvent) {
    if (dropdown.style.display !== 'block') {
      if (e.key === 'Enter') {
        void runSearch(input.value)
      }
      return
    }

    if (e.key === 'Escape') {
      hide()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (items.length === 0) return
      setActive(Math.min(items.length - 1, activeIndex + 1))
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (items.length === 0) return
      setActive(Math.max(0, activeIndex - 1))
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const item = items[activeIndex]
      if (item) select(item)
    }
  }

  function onDocClick(e: MouseEvent) {
    if (!dropdown.contains(e.target as Node) && e.target !== input) {
      hide()
    }
  }

  function onResize() {
    if (dropdown.style.display === 'block') {
      positionDropdown(input, dropdown)
    }
  }

  input.addEventListener('input', onInput)
  input.addEventListener('keydown', onKeyDown)
  document.addEventListener('click', onDocClick)
  window.addEventListener('resize', onResize)

  function destroy() {
    destroyed = true
    input.removeEventListener('input', onInput)
    input.removeEventListener('keydown', onKeyDown)
    document.removeEventListener('click', onDocClick)
    window.removeEventListener('resize', onResize)
    hide()
  }

  function focus() {
    input.focus()
  }

  return { destroy, focus }
}
