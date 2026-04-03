/**
 * Utilitaires purs — Command Center Infer/Opti (tests unitaires ciblés).
 */

export type JobStatusKind = 'success' | 'failed' | 'running' | 'queued' | 'unknown'

export function classifyJobStatus(status: string): JobStatusKind {
  const s = (status || '').toLowerCase().trim()
  if (s === 'finished' || s === 'success' || s === 'succeeded' || s === 'done') return 'success'
  if (s === 'failed' || s === 'error') return 'failed'
  if (s === 'running' || s === 'in_progress') return 'running'
  if (s === 'queued' || s === 'pending' || s === 'waiting') return 'queued'
  return 'unknown'
}

export function jobTypeLabel(modelTarget: string, triggerReason: string): string {
  const t = (modelTarget || '').toLowerCase()
  const r = (triggerReason || '').toLowerCase()
  if (t.includes('kriging') || t === 'kriging') return 'Kriging'
  if (t === 'rga_predictor' || t.includes('supervised') || t.includes('infer') || t.includes('gb_v'))
    return 'Train IA'
  if (r.includes('run_once') || r.includes('queue')) return 'Run 1 job'
  if (!modelTarget && triggerReason) return triggerReason.slice(0, 32) || '—'
  return modelTarget || '—'
}

export function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/** Coloration basique des tags [INFO]/[WARN]/[ERROR]/[ACTION] après échappement HTML. */
export function formatLogLineForHtml(line: string): string {
  const esc = escapeHtml(line)
  return esc
    .replace(/\[INFO\]/gi, '<span class="infer-opti-cc-log-tag infer-opti-cc-log-info">[INFO]</span>')
    .replace(/\[WARN\]/gi, '<span class="infer-opti-cc-log-tag infer-opti-cc-log-warn">[WARN]</span>')
    .replace(/\[WARNING\]/gi, '<span class="infer-opti-cc-log-tag infer-opti-cc-log-warn">[WARNING]</span>')
    .replace(/\[ERROR\]/gi, '<span class="infer-opti-cc-log-tag infer-opti-cc-log-err">[ERROR]</span>')
    .replace(/\[ERR\]/gi, '<span class="infer-opti-cc-log-tag infer-opti-cc-log-err">[ERR]</span>')
    .replace(/\[ACTION\]/gi, '<span class="infer-opti-cc-log-tag infer-opti-cc-log-action">[ACTION]</span>')
}

export function stringifyJobLogs(logs: unknown): string {
  if (logs === null || logs === undefined) return ''
  try {
    return typeof logs === 'string' ? logs : JSON.stringify(logs, null, 2)
  } catch {
    return String(logs)
  }
}

/** Une ligne CSV par job (en-têtes séparés). */
export function jobsToCsv(jobs: Array<Record<string, unknown>>): string {
  const headers = [
    'id',
    'model_target',
    'trigger_reason',
    'status',
    'requested_at',
    'started_at',
    'finished_at',
  ]
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v)
    if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`
    return s
  }
  const lines = [headers.join(',')]
  for (const j of jobs) {
    lines.push(headers.map((h) => esc(j[h])).join(','))
  }
  return lines.join('\r\n')
}

export function isKrigingJob(modelTarget: string): boolean {
  const t = (modelTarget || '').toLowerCase()
  return t.includes('kriging') || t === 'kriging'
}
