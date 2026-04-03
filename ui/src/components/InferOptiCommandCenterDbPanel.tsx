/**
 * Command Center Infer/Opti — onglet Gestionnaire BDD (React).
 * Pilotage Kriging, ML supervisé, jobs, sources IA/AG, pré-requis ML.
 */
import React, { useCallback, useEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { useAtlasTheme } from '@/contexts/ThemeContext'
import { cn } from '@/lib/utils'
import {
  classifyJobStatus,
  formatLogLineForHtml,
  isKrigingJob,
  jobTypeLabel,
  jobsToCsv,
  stringifyJobLogs,
} from '@/infer-opti/command-center-utils'
import '@/infer-opti/command-center.css'
import {
  Brain,
  CheckCircle,
  Clock,
  Cpu,
  Database,
  Download,
  FileText,
  Loader2,
  Map,
  MoreVertical,
  PlayCircle,
  RefreshCw,
  RotateCcw,
  XCircle,
} from 'lucide-react'
import { tokenStorage } from '@/services/auth-api'

type ActionKey = 'sources' | 'kriging' | 'train' | 'runOnce' | 'mlPrereqs'

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

export type InferOptiCommandCenterDbPanelProps = {
  apiBase: string
  hasJobsPermission: boolean
}

export function InferOptiCommandCenterDbPanel({ apiBase, hasJobsPermission }: InferOptiCommandCenterDbPanelProps) {
  const { theme } = useAtlasTheme()
  const isDark = theme === 'dark'

  const [logLines, setLogLines] = useState<string[]>([])
  const [jobs, setJobs] = useState<AiJobRow[]>([])
  const [busy, setBusy] = useState<ActionKey | null>(null)
  const [menuJobId, setMenuJobId] = useState<string | null>(null)
  const terminalRef = useRef<HTMLDivElement | null>(null)
  const initRef = useRef(false)
  const busyRef = useRef(false)

  useEffect(() => {
    busyRef.current = busy !== null
  }, [busy])

  const base = apiBase.replace(/\/$/, '')

  const appendLog = useCallback((message: string, level: 'INFO' | 'WARN' | 'ERROR' | 'ACTION') => {
    const ts = new Date().toISOString().slice(11, 19)
    setLogLines((prev) => [...prev, `[${ts}] [${level}] ${message}`])
  }, [])

  useEffect(() => {
    if (!terminalRef.current) return
    terminalRef.current.scrollTop = terminalRef.current.scrollHeight
  }, [logLines])

  useEffect(() => {
    const close = () => setMenuJobId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [])

  const callApi = useCallback(
    async (path: string, method: 'GET' | 'POST', body?: Record<string, unknown>) => {
      const token = tokenStorage.getAccessToken()
      if (!token) throw new Error('Session expirée : reconnectez-vous.')
      const res = await fetch(`${base}${path}`, {
        method,
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: method === 'POST' ? JSON.stringify(body ?? {}) : undefined,
      })
      const text = await res.text()
      let data: unknown = null
      try {
        data = text ? JSON.parse(text) : null
      } catch {
        data = text
      }
      if (!res.ok) {
        const msg =
          typeof data === 'object' && data && data !== null && 'error' in data
            ? String((data as { error?: string }).error)
            : text || `HTTP ${res.status}`
        throw new Error(msg)
      }
      return data
    },
    [base],
  )

  const refreshJobs = useCallback(async () => {
    if (!hasJobsPermission) {
      setJobs([])
      return
    }
    try {
      const data = (await callApi('/ai/jobs/recent', 'GET')) as { jobs?: unknown[] }
      const list = Array.isArray(data?.jobs) ? data.jobs : []
      setJobs(
        list.map((j: any) => ({
          id: String(j.id),
          model_target: String(j.model_target ?? ''),
          trigger_reason: String(j.trigger_reason ?? ''),
          status: String(j.status ?? ''),
          requested_at: String(j.requested_at ?? ''),
          requested_by: j.requested_by,
          started_at: j.started_at,
          finished_at: j.finished_at,
          logs: j.logs,
        })),
      )
    } catch (e: any) {
      appendLog(`Jobs — ${e?.message || e}`, 'WARN')
      setJobs([])
    }
  }, [appendLog, callApi, hasJobsPermission])

  useEffect(() => {
    if (initRef.current) return
    initRef.current = true
    appendLog('Prêt.', 'INFO')
    void refreshJobs()
    const id = setInterval(() => {
      if (document.visibilityState === 'visible' && !busyRef.current) void refreshJobs()
    }, 15_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const runAction = useCallback(
    async (key: ActionKey, label: string, path: string, method: 'POST', body?: Record<string, unknown>) => {
      if (busyRef.current) return
      busyRef.current = true
      setBusy(key)
      appendLog(`${label}…`, 'ACTION')
      try {
        const out = await callApi(path, method, body)
        appendLog(`${label} — OK`, 'INFO')
        const s = JSON.stringify(out)
        if (s && s !== '{}' && s !== 'null') appendLog(`Réponse : ${s.length > 500 ? s.slice(0, 500) + '…' : s}`, 'INFO')
      } catch (e: any) {
        appendLog(`${label} — ${e?.message || e}`, 'ERROR')
      } finally {
        busyRef.current = false
        setBusy(null)
        void refreshJobs()
      }
    },
    [appendLog, callApi, refreshJobs],
  )

  const replayJob = async (job: AiJobRow) => {
    appendLog(`Rejeu — ${job.model_target}`, 'ACTION')
    if (isKrigingJob(job.model_target)) {
      await runAction('kriging', 'Kriging (rejeu)', '/ai/kriging/recompute', 'POST', {})
    } else {
      await runAction('train', 'Train supervisé (rejeu)', '/ai/infer/train-supervised', 'POST', {})
    }
  }

  const disabledAll = busy !== null || !hasJobsPermission

  const pill = (status: string) => {
    const k = classifyJobStatus(status)
    if (k === 'success')
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-emerald-950 text-emerald-400">
          <CheckCircle className="h-3.5 w-3.5" /> Succès
        </span>
      )
    if (k === 'failed')
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-red-950 text-red-300">
          <XCircle className="h-3.5 w-3.5" /> Échec
        </span>
      )
    if (k === 'running')
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-blue-950 text-blue-300">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> En cours
        </span>
      )
    if (k === 'queued')
      return (
        <span className="inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold bg-amber-950 text-amber-200">
          <Clock className="h-3.5 w-3.5" /> En attente
        </span>
      )
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border',
          isDark ? 'border-slate-600 bg-slate-800 text-slate-300' : 'border-slate-300 bg-slate-100 text-slate-700',
        )}
      >
        {status || '—'}
      </span>
    )
  }

  const secBtn = cn(
    'border',
    isDark ? 'bg-[#1E293B] border-[#334155] text-slate-100 hover:bg-slate-800' : 'bg-white border-slate-300 text-slate-900 hover:bg-slate-50',
  )

  return (
    <div
      className={cn(
        'rounded-xl border shadow-sm overflow-hidden',
        isDark ? 'border-[#334155] bg-[#0F172A] text-slate-50' : 'border-slate-200 bg-slate-50 text-slate-900',
      )}
    >
      <div
        className={cn(
          'px-5 py-4 flex items-start justify-between gap-4 border-b',
          isDark ? 'border-[#334155]' : 'border-slate-200',
        )}
      >
        <div className="flex gap-3">
          <Cpu className={cn('h-7 w-7 shrink-0', isDark ? 'text-slate-400' : 'text-slate-600')} />
          <div>
            <h2 className="text-lg font-bold tracking-tight">INFER / OPTI</h2>
            <p className={cn('text-sm mt-1 max-w-xl', isDark ? 'text-slate-400' : 'text-slate-600')}>
              Pilotage complet IA : Kriging, régressions, ONNX, campagnes et modèles.
            </p>
          </div>
        </div>
        {busy ? (
          <div className={cn('flex items-center gap-2 text-sm shrink-0', isDark ? 'text-slate-400' : 'text-slate-600')}>
            <Loader2 className="h-4 w-4 animate-spin" />
            Exécution…
          </div>
        ) : null}
      </div>

      <div className={cn('p-5 space-y-5', isDark ? 'bg-[#0F172A]' : 'bg-slate-50')}>
        {!hasJobsPermission ? (
          <div
            className={cn(
              'rounded-lg border px-3 py-2 text-sm',
              isDark ? 'border-amber-700/50 bg-amber-950/20 text-amber-200' : 'border-amber-400 bg-amber-50 text-amber-950',
            )}
          >
            Permission <strong>colab.missions.read</strong> requise pour l’historique des jobs et les actions IA.
          </div>
        ) : null}

        <div className="space-y-4">
          <div>
            <span
              className={cn(
                'block text-xs font-semibold uppercase tracking-wider mb-2',
                isDark ? 'text-slate-400' : 'text-slate-500',
              )}
            >
              Préparation
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={disabledAll}
                variant="outline"
                className={secBtn}
                onClick={() => void runAction('sources', 'Recalcul sources', '/ai/recompute/sources', 'POST', {})}
              >
                {busy === 'sources' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Database className="h-4 w-4 mr-2" />}
                Recalcul sources
              </Button>
              <Button
                type="button"
                disabled={disabledAll}
                variant="outline"
                className={secBtn}
                onClick={() => void runAction('mlPrereqs', 'Pré-requis ML (refresh)', '/ai/ml/refresh-prereqs', 'POST', {})}
              >
                {busy === 'mlPrereqs' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <RefreshCw className="h-4 w-4 mr-2" />}
                Pré-requis ML
              </Button>
            </div>
          </div>

          <div>
            <span
              className={cn(
                'block text-xs font-semibold uppercase tracking-wider mb-2',
                isDark ? 'text-slate-400' : 'text-slate-500',
              )}
            >
              Modélisation &amp; IA
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={disabledAll}
                variant="outline"
                className={secBtn}
                onClick={() => void runAction('kriging', 'Kriging GP', '/ai/kriging/recompute', 'POST', {})}
              >
                {busy === 'kriging' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Map className="h-4 w-4 mr-2" />}
                Kriging
              </Button>
              <Button
                type="button"
                disabled={disabledAll}
                className="bg-blue-600 hover:bg-blue-700 text-white border-0"
                onClick={() => void runAction('train', 'Train supervisé', '/ai/infer/train-supervised', 'POST', {})}
              >
                {busy === 'train' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Brain className="h-4 w-4 mr-2" />}
                Train supervisé
              </Button>
            </div>
          </div>

          <div>
            <span
              className={cn(
                'block text-xs font-semibold uppercase tracking-wider mb-2',
                isDark ? 'text-slate-400' : 'text-slate-500',
              )}
            >
              Tests &amp; debug
            </span>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                disabled={disabledAll}
                variant="ghost"
                className={cn(
                  'border',
                  isDark ? 'border-[#334155] text-slate-100' : 'border-slate-300 text-slate-900',
                )}
                onClick={() => void runAction('runOnce', 'Run 1 job', '/ai/jobs/run-once', 'POST', { max_jobs: 1 })}
              >
                {busy === 'runOnce' ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <PlayCircle className="h-4 w-4 mr-2" />}
                Run 1 job
              </Button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <div className="lg:col-span-1 space-y-2">
            <div className={cn('text-xs font-semibold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
              Monitoring en direct
            </div>
            <div
              className={cn(
                'rounded-lg border overflow-hidden',
                isDark ? 'border-[#334155] bg-[#1E293B]' : 'border-slate-300 bg-white',
              )}
            >
              <div
                className={cn(
                  'px-3 py-2 text-[11px] font-semibold uppercase tracking-wider border-b',
                  isDark ? 'border-[#334155] bg-black text-slate-400' : 'border-slate-200 bg-slate-100 text-slate-600',
                )}
              >
                &gt;_ Terminal statut
              </div>
              <div ref={terminalRef} className="h-64 overflow-y-auto p-3 font-mono text-[11px] leading-relaxed bg-black text-slate-200">
                {logLines.map((line, i) => (
                  <div key={i} className="mb-0.5" dangerouslySetInnerHTML={{ __html: formatLogLineForHtml(line) }} />
                ))}
              </div>
            </div>
          </div>

          <div className="lg:col-span-2 space-y-2">
            <div className="flex items-center justify-between">
              <span className={cn('text-xs font-semibold uppercase tracking-wider', isDark ? 'text-slate-400' : 'text-slate-500')}>
                Historique des jobs
              </span>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy !== null || !hasJobsPermission}
                className={secBtn}
                onClick={() => void refreshJobs()}
              >
                <RefreshCw className="h-4 w-4 mr-1" />
                Rafraîchir
              </Button>
            </div>
            <div
              className={cn(
                'rounded-lg border overflow-auto max-h-80',
                isDark ? 'border-[#334155] bg-[#1E293B]' : 'border-slate-300 bg-white',
              )}
            >
              <table className="w-full text-xs">
                <thead
                  className={cn(
                    'sticky top-0 border-b',
                    isDark ? 'bg-[#1E293B] border-[#334155] text-slate-400' : 'bg-slate-100 border-slate-200 text-slate-600',
                  )}
                >
                  <tr className="text-left uppercase tracking-wide text-[11px]">
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Cible</th>
                    <th className="px-3 py-2">Statut</th>
                    <th className="px-3 py-2 w-10" aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {jobs.length === 0 ? (
                    <tr>
                      <td colSpan={4} className={cn('px-3 py-6 text-center', isDark ? 'text-slate-400' : 'text-slate-500')}>
                        {hasJobsPermission ? 'Aucun job chargé.' : '—'}
                      </td>
                    </tr>
                  ) : (
                    jobs.slice(0, 50).map((j) => (
                      <tr
                        key={j.id}
                        className={cn(
                          'border-t',
                          isDark ? 'border-[#334155] hover:bg-white/5' : 'border-slate-200 hover:bg-slate-50',
                        )}
                      >
                        <td className={cn('px-3 py-2', isDark ? 'text-slate-100' : 'text-slate-900')}>
                          {jobTypeLabel(j.model_target, j.trigger_reason)}
                        </td>
                        <td className={cn('px-3 py-2 font-mono text-[11px]', isDark ? 'text-slate-300' : 'text-slate-700')}>
                          {j.model_target || '—'}
                        </td>
                        <td className="px-3 py-2">{pill(j.status)}</td>
                        <td className="px-3 py-2 text-right relative">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className={isDark ? 'text-slate-400' : 'text-slate-600'}
                            onClick={(ev) => {
                              ev.stopPropagation()
                              setMenuJobId((id) => (id === j.id ? null : j.id))
                            }}
                          >
                            <MoreVertical className="h-4 w-4" />
                          </Button>
                          {menuJobId === j.id ? (
                            <div
                              className={cn(
                                'absolute right-2 top-9 z-20 min-w-[220px] rounded-lg border shadow-lg py-1',
                                isDark ? 'border-[#334155] bg-[#0F172A]' : 'border-slate-200 bg-white',
                              )}
                              onClick={(e) => e.stopPropagation()}
                            >
                              <button
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                                  isDark ? 'hover:bg-[#1E293B] text-slate-100' : 'hover:bg-slate-100 text-slate-900',
                                )}
                                onClick={() => {
                                  setMenuJobId(null)
                                  const t = stringifyJobLogs(j.logs)
                                  appendLog(`Logs job ${j.id}`, 'ACTION')
                                  t.split('\n').slice(0, 120).forEach((ln) => appendLog(ln, 'INFO'))
                                  if (t.split('\n').length > 120) appendLog('… (tronqué)', 'INFO')
                                }}
                              >
                                <FileText className="h-4 w-4" /> Voir les logs complets
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                                  isDark ? 'hover:bg-[#1E293B] text-slate-100' : 'hover:bg-slate-100 text-slate-900',
                                )}
                                onClick={() => {
                                  setMenuJobId(null)
                                  const csv = jobsToCsv([j as unknown as Record<string, unknown>])
                                  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
                                  const a = document.createElement('a')
                                  a.href = URL.createObjectURL(blob)
                                  a.download = `atlas-job-${j.id}.csv`
                                  a.click()
                                  URL.revokeObjectURL(a.href)
                                  appendLog(`Export CSV job ${j.id}`, 'INFO')
                                }}
                              >
                                <Download className="h-4 w-4" /> Exporter (CSV)
                              </button>
                              <button
                                type="button"
                                className={cn(
                                  'flex w-full items-center gap-2 px-3 py-2 text-left text-sm',
                                  isDark ? 'hover:bg-[#1E293B] text-slate-100' : 'hover:bg-slate-100 text-slate-900',
                                )}
                                onClick={() => {
                                  setMenuJobId(null)
                                  void replayJob(j)
                                }}
                              >
                                <RotateCcw className="h-4 w-4" /> Rejouer ce job
                              </button>
                            </div>
                          ) : null}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
