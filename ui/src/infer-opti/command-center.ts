/**
 * Command Center Infer/Opti — pilotage Kriging, sources, train, queue jobs.
 *
 * Smoke tests curl (BASE = URL api-geo, TOKEN = JWT) :
 *   curl -sS -H "Authorization: Bearer TOKEN" "${BASE}/ai/jobs/recent"
 *   curl -sS -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{}" "${BASE}/ai/recompute/sources"
 *   curl -sS -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{}" "${BASE}/ai/kriging/recompute"
 *   curl -sS -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{}" "${BASE}/ai/infer/train-supervised"
 *   curl -sS -H "Authorization: Bearer TOKEN" -H "Content-Type: application/json" -d "{\"max_jobs\":1}" "${BASE}/ai/jobs/run-once"
 */

import { tokenStorage } from '../services/auth-api'
import { icons } from '../icons/lucide-inline'
import './command-center.css'
import {
  classifyJobStatus,
  formatLogLineForHtml,
  isKrigingJob,
  jobTypeLabel,
  jobsToCsv,
  stringifyJobLogs,
} from './command-center-utils'

export type InferOptiCommandCenterOptions = {
  getApiBase: () => string
  canUseAiJobs: () => boolean
  openButtonId?: string
}

type AiJobRow = {
  id: string
  model_target: string
  trigger_reason: string
  status: string
  requested_at: string
  requested_by?: string | null
  started_at?: string | null
  finished_at?: string | null
  logs: unknown
}

type ActionKey = 'sources' | 'kriging' | 'train' | 'runOnce'

export function initInferOptiCommandCenter(opts: InferOptiCommandCenterOptions): void {
  const openId = opts.openButtonId ?? 'openInferOptiCommandCenter'
  const openBtn = document.getElementById(openId)
  if (!openBtn) {
    console.warn(`[InferOptiCC] Bouton #${openId} introuvable`)
    return
  }

  const cc = new InferOptiCommandCenter(opts)
  openBtn.addEventListener('click', () => cc.open())
}

class InferOptiCommandCenter {
  private opts: InferOptiCommandCenterOptions
  private root: HTMLElement | null = null
  private terminalEl: HTMLElement | null = null
  private tbodyEl: HTMLElement | null = null
  private refreshBtn: HTMLButtonElement | null = null
  private dropdown: HTMLElement | null = null
  private jobs: AiJobRow[] = []
  private busyAction: ActionKey | null = null
  private pollTimer: ReturnType<typeof setInterval> | null = null
  private menuJobId: string | null = null

  constructor(opts: InferOptiCommandCenterOptions) {
    this.opts = opts
  }

  open(): void {
    if (!this.root) this.mount()
    if (!this.root) return
    this.root.hidden = false
    if (this.terminalEl) this.terminalEl.innerHTML = ''
    this.log('Prêt.', 'INFO')
    if (!this.opts.canUseAiJobs()) {
      this.log('[WARN] Permission colab.missions.read absente — les appels API échoueront.', 'WARN')
    }
    void this.refreshJobs()
    this.startPoll()
  }

  private close(): void {
    if (this.root) this.root.hidden = true
    this.closeMenu()
    this.stopPoll()
  }

  private mount(): void {
    const overlay = document.createElement('div')
    overlay.className = 'infer-opti-cc-overlay'
    overlay.setAttribute('role', 'dialog')
    overlay.setAttribute('aria-modal', 'true')
    overlay.setAttribute('aria-labelledby', 'inferOptiCcHeading')
    overlay.hidden = true
    overlay.innerHTML = this.template()
    document.body.appendChild(overlay)
    this.root = overlay
    overlay.querySelector('.infer-opti-cc-panel')?.addEventListener('click', (e) => e.stopPropagation())

    this.terminalEl = overlay.querySelector('#inferOptiCcTerminal')
    this.tbodyEl = overlay.querySelector('#inferOptiCcJobsBody')
    this.refreshBtn = overlay.querySelector('#inferOptiCcRefresh') as HTMLButtonElement | null
    this.dropdown = overlay.querySelector('#inferOptiCcDropdown') as HTMLElement | null

    overlay.querySelector('#inferOptiCcClose')?.addEventListener('click', () => this.close())
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) this.close()
    })

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.root && !this.root.hidden) {
        if (this.dropdown && !this.dropdown.hidden) {
          this.closeMenu()
          return
        }
        this.close()
      }
    })

    this.bindAction('inferOptiCcSources', 'sources', '/ai/recompute/sources', 'POST', {})
    this.bindAction('inferOptiCcKriging', 'kriging', '/ai/kriging/recompute', 'POST', {})
    this.bindAction('inferOptiCcTrain', 'train', '/ai/infer/train-supervised', 'POST', {})
    this.bindAction('inferOptiCcRunOnce', 'runOnce', '/ai/jobs/run-once', 'POST', { max_jobs: 1 })

    this.refreshBtn?.addEventListener('click', () => void this.refreshJobs())

    overlay.querySelector('#inferOptiCcDropdown')?.addEventListener('click', (e) => e.stopPropagation())
    document.addEventListener('click', () => this.closeMenu())
  }

  private template(): string {
    const cpu = icons.cpu()
    const db = icons.database()
    const map = icons.map()
    const brain = icons.brain()
    const play = icons.playCircle()
    const refresh = icons.refreshCw()

    return `
      <div class="infer-opti-cc-panel">
        <header class="infer-opti-cc-head">
          <div class="infer-opti-cc-title-row">
            ${cpu}
            <div class="infer-opti-cc-title-text">
              <h1 id="inferOptiCcHeading">INFER / OPTI</h1>
              <p>Pilotage complet IA : Kriging, régressions, ONNX, campagnes et modèles.</p>
            </div>
          </div>
          <button type="button" class="infer-opti-cc-close" id="inferOptiCcClose" aria-label="Fermer">×</button>
        </header>
        <div class="infer-opti-cc-body">
          <div class="infer-opti-cc-perm-warn" id="inferOptiCcPermWarn" hidden>
            Sans la permission <strong>colab.missions.read</strong>, l’historique des jobs et les actions IA renverront une erreur 403.
          </div>

          <section class="infer-opti-cc-actions">
            <div class="infer-opti-cc-action-zone">
              <span class="infer-opti-cc-zone-label">Préparation</span>
              <div class="infer-opti-cc-btn-row">
                <button type="button" class="infer-opti-cc-btn infer-opti-cc-btn--secondary" data-cc-btn="sources" id="inferOptiCcSources">
                  ${db}
                  Recalcul sources
                </button>
              </div>
            </div>
            <div class="infer-opti-cc-action-zone">
              <span class="infer-opti-cc-zone-label">Modélisation &amp; IA</span>
              <div class="infer-opti-cc-btn-row">
                <button type="button" class="infer-opti-cc-btn infer-opti-cc-btn--secondary" data-cc-btn="kriging" id="inferOptiCcKriging">
                  ${map}
                  Kriging
                </button>
                <button type="button" class="infer-opti-cc-btn infer-opti-cc-btn--primary" data-cc-btn="train" id="inferOptiCcTrain">
                  ${brain}
                  Train supervisé
                </button>
              </div>
            </div>
            <div class="infer-opti-cc-action-zone">
              <span class="infer-opti-cc-zone-label">Tests &amp; debug</span>
              <div class="infer-opti-cc-btn-row">
                <button type="button" class="infer-opti-cc-btn infer-opti-cc-btn--ghost" data-cc-btn="runOnce" id="inferOptiCcRunOnce">
                  ${play}
                  Run 1 job
                </button>
              </div>
            </div>
          </section>

          <div class="infer-opti-cc-split">
            <div>
              <div class="infer-opti-cc-col-head">
                <span class="infer-opti-cc-col-title">Monitoring en direct</span>
              </div>
              <div class="infer-opti-cc-terminal-wrap">
                <div class="infer-opti-cc-terminal-bar">&gt;_ Terminal statut</div>
                <pre class="infer-opti-cc-terminal" id="inferOptiCcTerminal"></pre>
              </div>
            </div>
            <div>
              <div class="infer-opti-cc-col-head">
                <span class="infer-opti-cc-col-title">Historique des jobs</span>
                <button type="button" class="infer-opti-cc-refresh" id="inferOptiCcRefresh">
                  ${refresh}
                  Rafraîchir
                </button>
              </div>
              <div class="infer-opti-cc-table-wrap">
                <table class="infer-opti-cc-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Cible</th>
                      <th>Statut</th>
                      <th class="infer-opti-cc-table-actions" aria-label="Actions"> </th>
                    </tr>
                  </thead>
                  <tbody id="inferOptiCcJobsBody"></tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      </div>
      <div class="infer-opti-cc-dropdown" id="inferOptiCcDropdown" hidden></div>
    `
  }

  private bindAction(
    elId: string,
    key: ActionKey,
    path: string,
    method: 'GET' | 'POST',
    body: Record<string, unknown> | null
  ): void {
    const el = document.getElementById(elId)
    if (!el) return
    el.addEventListener('click', () => {
      const labels: Record<ActionKey, string> = {
        sources: 'Recalcul sources',
        kriging: 'Kriging',
        train: 'Train supervisé',
        runOnce: 'Run 1 job',
      }
      void this.runAction(key, labels[key], path, method, body)
    })
  }

  private setBusy(action: ActionKey | null): void {
    this.busyAction = action
    const root = this.root
    if (!root) return
    const keys: ActionKey[] = ['sources', 'kriging', 'train', 'runOnce']
    for (const k of keys) {
      const btn = root.querySelector(`[data-cc-btn="${k}"]`) as HTMLButtonElement | null
      if (!btn) continue
      if (action === k) {
        btn.disabled = true
        btn.innerHTML = `${icons.loader2({ className: 'infer-opti-cc-spin' })} ${this.actionLabel(k)}`
      } else {
        btn.disabled = action !== null
        if (!action) this.restoreButtonContent(btn, k)
      }
    }
    if (this.refreshBtn) this.refreshBtn.disabled = action !== null
  }

  private actionLabel(k: ActionKey): string {
    const m: Record<ActionKey, string> = {
      sources: 'Recalcul sources',
      kriging: 'Kriging',
      train: 'Train supervisé',
      runOnce: 'Run 1 job',
    }
    return m[k]
  }

  private restoreButtonContent(btn: HTMLButtonElement, k: ActionKey): void {
    const icon =
      k === 'sources'
        ? icons.database()
        : k === 'kriging'
          ? icons.map()
          : k === 'train'
            ? icons.brain()
            : icons.playCircle()
    btn.innerHTML = `${icon} ${this.actionLabel(k)}`
  }

  private async runAction(
    key: ActionKey,
    label: string,
    path: string,
    method: 'GET' | 'POST',
    body: Record<string, unknown> | null
  ): Promise<void> {
    if (this.busyAction) return
    const token = tokenStorage.getAccessToken?.()
    if (!token) {
      this.log('[ERROR] Session expirée : reconnectez-vous.', 'ERROR')
      return
    }
    this.log(`[ACTION] ${label}…`, 'ACTION')
    this.setBusy(key)
    const base = this.opts.getApiBase().replace(/\/$/, '')
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: method === 'POST' && body != null ? JSON.stringify(body) : undefined,
      })
      const txt = await res.text()
      let data: unknown = null
      try {
        data = txt ? JSON.parse(txt) : null
      } catch {
        data = txt
      }
      if (!res.ok) {
        const msg = typeof data === 'object' && data && 'error' in data ? String((data as any).error) : txt || res.statusText
        this.log(`[ERROR] ${label} — HTTP ${res.status} ${msg}`, 'ERROR')
      } else {
        this.log(`[INFO] ${label} — OK`, 'INFO')
        const summary = typeof data === 'object' && data ? JSON.stringify(data).slice(0, 400) : String(data)
        if (summary && summary !== '{}') this.log(`[INFO] Réponse : ${summary}${summary.length >= 400 ? '…' : ''}`, 'INFO')
      }
    } catch (e: any) {
      this.log(`[ERROR] ${label} — ${e?.message || e}`, 'ERROR')
    } finally {
      this.setBusy(null)
      void this.refreshJobs()
    }
  }

  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'ACTION'): void {
    if (!this.terminalEl) return
    const ts = new Date().toISOString().slice(11, 19)
    const line = `[${ts}] [${level}] ${message}`
    const span = document.createElement('span')
    span.className = 'infer-opti-cc-log-line'
    span.innerHTML = formatLogLineForHtml(line)
    this.terminalEl.appendChild(span)
    this.terminalEl.scrollTop = this.terminalEl.scrollHeight
  }

  private updatePermBanner(): void {
    const w = this.root?.querySelector('#inferOptiCcPermWarn') as HTMLElement | null
    if (w) w.hidden = this.opts.canUseAiJobs()
  }

  private async refreshJobs(): Promise<void> {
    this.updatePermBanner()
    if (!this.tbodyEl || !this.opts.canUseAiJobs()) {
      if (this.tbodyEl) {
        this.tbodyEl.innerHTML =
          '<tr><td colspan="4" style="color:#94a3b8;padding:16px">Permission insuffisante pour charger les jobs.</td></tr>'
      }
      return
    }
    const token = tokenStorage.getAccessToken?.()
    if (!token) return
    const base = this.opts.getApiBase().replace(/\/$/, '')
    const spinCls = 'infer-opti-cc-spin'
    if (this.refreshBtn && !this.busyAction) {
      this.refreshBtn.innerHTML = `${icons.refreshCw({ className: spinCls })} Rafraîchir`
      this.refreshBtn.disabled = true
    }
    try {
      const res = await fetch(`${base}/ai/jobs/recent`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        this.log(`[WARN] Jobs — HTTP ${res.status} ${(data as any)?.error || ''}`.trim(), 'WARN')
        this.jobs = []
      } else {
        const list = Array.isArray((data as any)?.jobs) ? (data as any).jobs : []
        this.jobs = list.map((j: any) => ({
          id: String(j.id),
          model_target: String(j.model_target ?? ''),
          trigger_reason: String(j.trigger_reason ?? ''),
          status: String(j.status ?? ''),
          requested_at: String(j.requested_at ?? ''),
          requested_by: j.requested_by,
          started_at: j.started_at,
          finished_at: j.finished_at,
          logs: j.logs,
        }))
      }
    } catch (e: any) {
      this.log(`[WARN] Jobs — ${e?.message || e}`, 'WARN')
      this.jobs = []
    }
    this.renderTable()
    if (this.refreshBtn) {
      this.refreshBtn.disabled = this.busyAction !== null
      this.refreshBtn.innerHTML = `${icons.refreshCw()} Rafraîchir`
    }
  }

  private renderTable(): void {
    if (!this.tbodyEl) return
    if (this.jobs.length === 0) {
      this.tbodyEl.innerHTML =
        '<tr><td colspan="4" style="color:#94a3b8;padding:16px">Aucun job chargé.</td></tr>'
      return
    }
    this.tbodyEl.innerHTML = ''
    for (const j of this.jobs.slice(0, 50)) {
      const tr = document.createElement('tr')
      const type = jobTypeLabel(j.model_target, j.trigger_reason)
      const pill = this.statusPill(j.status)
      tr.innerHTML = `
        <td>${type}</td>
        <td>${this.escape(j.model_target || '—')}</td>
        <td>${pill}</td>
        <td class="infer-opti-cc-table-actions">
          <button type="button" class="infer-opti-cc-menu-btn" data-job-menu="${j.id}" aria-label="Menu actions">
            ${icons.moreVertical()}
          </button>
        </td>
      `
      this.tbodyEl.appendChild(tr)
    }
    this.tbodyEl.querySelectorAll('[data-job-menu]').forEach((btn) => {
      btn.addEventListener('click', (ev) => {
        ev.stopPropagation()
        const id = (btn as HTMLElement).getAttribute('data-job-menu')
        if (id) this.openMenuForJob(id, btn as HTMLElement)
      })
    })
  }

  private escape(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;')
  }

  private statusPill(status: string): string {
    const k = classifyJobStatus(status)
    const check = icons.checkCircle()
    const xc = icons.xCircle()
    const ld = icons.loader2({ className: 'infer-opti-cc-spin' })
    if (k === 'success')
      return `<span class="infer-opti-cc-pill infer-opti-cc-pill--ok">${check} Succès</span>`
    if (k === 'failed')
      return `<span class="infer-opti-cc-pill infer-opti-cc-pill--err">${xc} Échec</span>`
    if (k === 'running')
      return `<span class="infer-opti-cc-pill infer-opti-cc-pill--run">${ld} En cours</span>`
    if (k === 'queued')
      return `<span class="infer-opti-cc-pill infer-opti-cc-pill--queue">${icons.clock()} En attente</span>`
    return `<span class="infer-opti-cc-pill infer-opti-cc-pill--unk">${this.escape(status || '—')}</span>`
  }

  private openMenuForJob(jobId: string, anchor: HTMLElement): void {
    if (!this.dropdown) return
    const job = this.jobs.find((j) => j.id === jobId)
    if (!job) return
    this.menuJobId = jobId
    this.dropdown.hidden = false
    this.dropdown.innerHTML = `
      <button type="button" data-menu="logs">${icons.fileText()} Voir les logs complets</button>
      <button type="button" data-menu="csv">${icons.download()} Exporter les résultats (CSV)</button>
      <button type="button" data-menu="replay">${icons.rotateCcw()} Rejouer ce job</button>
    `
    const r = anchor.getBoundingClientRect()
    this.dropdown.style.top = `${r.bottom + 4}px`
    this.dropdown.style.left = `${Math.min(r.left, window.innerWidth - 240)}px`

    this.dropdown.querySelector('[data-menu="logs"]')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closeMenu()
      const text = stringifyJobLogs(job.logs)
      this.log(`[ACTION] Logs job ${job.id}`, 'ACTION')
      text.split('\n').slice(0, 200).forEach((line) => this.log(line, 'INFO'))
      if (text.split('\n').length > 200) this.log('[INFO] … (tronqué à 200 lignes)', 'INFO')
    })
    this.dropdown.querySelector('[data-menu="csv"]')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closeMenu()
      const csv = jobsToCsv([job as unknown as Record<string, unknown>])
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
      const a = document.createElement('a')
      a.href = URL.createObjectURL(blob)
      a.download = `atlas-job-${job.id}.csv`
      a.click()
      URL.revokeObjectURL(a.href)
      this.log(`[INFO] Export CSV job ${job.id}`, 'INFO')
    })
    this.dropdown.querySelector('[data-menu="replay"]')?.addEventListener('click', (e) => {
      e.stopPropagation()
      this.closeMenu()
      void this.replayJob(job)
    })
  }

  private closeMenu(): void {
    if (this.dropdown) this.dropdown.hidden = true
    this.menuJobId = null
  }

  private async replayJob(job: AiJobRow): Promise<void> {
    this.log(`[ACTION] Rejeu — ${job.model_target}`, 'ACTION')
    if (isKrigingJob(job.model_target)) {
      await this.runAction('kriging', 'Kriging (rejeu)', '/ai/kriging/recompute', 'POST', {})
    } else {
      await this.runAction('train', 'Train supervisé (rejeu)', '/ai/infer/train-supervised', 'POST', {})
    }
  }

  private startPoll(): void {
    this.stopPoll()
    this.pollTimer = setInterval(() => {
      if (this.root && !this.root.hidden && !this.busyAction) void this.refreshJobs()
    }, 15000)
  }

  private stopPoll(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer)
      this.pollTimer = null
    }
  }
}
