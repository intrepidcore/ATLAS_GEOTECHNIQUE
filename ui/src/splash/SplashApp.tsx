import React, { useEffect, useMemo, useState } from 'react'

type ProgressEvent = {
  step: string
  message: string
  percent: number
}

function listenEvent<T>(name: string, cb: (payload: T) => void): (() => void) | null {
  const w = window as any
  const listen = w?.__TAURI__?.event?.listen
  if (typeof listen !== 'function') return null
  let unlisten: any = null
  listen(name, (event: any) => {
    const payload = event?.payload
    if (payload) cb(payload as T)
  }).then((fn: any) => {
    unlisten = fn
  })
  return () => {
    if (typeof unlisten === 'function') unlisten()
  }
}

export function SplashApp() {
  const [progress, setProgress] = useState<ProgressEvent>({ step: 'start', message: 'Démarrage…', percent: 1 })
  const [fatal, setFatal] = useState<string | null>(null)
  const [logs, setLogs] = useState<Array<{ ts: string; msg: string }>>([])

  const percent = Math.max(0, Math.min(100, progress.percent ?? 0))

  const title = useMemo(() => {
    if (fatal) return 'Erreur au démarrage'
    if (percent >= 100) return 'Prêt'
    return 'Initialisation'
  }, [fatal, percent])

  useEffect(() => {
    const unlisten1 = listenEvent<ProgressEvent>('startup:progress', (ev) => {
      if (typeof ev.percent === 'number') {
        setProgress(ev)
        setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), msg: `${ev.percent}% — ${ev.message}` }])
      }
    })
    const unlisten2 = listenEvent<{ message: string }>('startup:error', (ev) => {
      const msg = (ev as any)?.message ? String((ev as any).message) : 'Erreur inconnue'
      setFatal(msg)
      setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), msg: `❌ ${msg}` }])
    })
    return () => {
      unlisten1?.()
      unlisten2?.()
    }
  }, [])

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <div className="mx-auto flex min-h-screen max-w-3xl flex-col justify-center px-6 py-12">
        <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-8 shadow-xl">
          <div className="text-sm text-slate-400">Atlas Géotechnique</div>
          <div className="mt-1 text-2xl font-semibold tracking-tight">{title}</div>

          <div className="mt-6">
            <div className="flex items-center justify-between text-xs text-slate-400">
              <div>{progress.step}</div>
              <div>{percent}%</div>
            </div>
            <div className="mt-2 h-3 w-full rounded-full bg-slate-800">
              <div
                className={`h-3 rounded-full ${fatal ? 'bg-red-500' : 'bg-blue-500'}`}
                style={{ width: `${percent}%` }}
              />
            </div>
            <div className="mt-3 text-sm text-slate-200">{fatal ? fatal : progress.message}</div>
          </div>

          <div className="mt-6 rounded-xl border border-slate-800 bg-slate-950/40 p-3">
            <div className="max-h-48 overflow-auto text-xs text-slate-300">
              {logs.length === 0 ? <div className="text-slate-500">En attente…</div> : null}
              {logs.map((l, idx) => (
                <div key={idx} className="whitespace-pre-wrap">
                  <span className="text-slate-500">[{l.ts}]</span> {l.msg}
                </div>
              ))}
            </div>
          </div>

          <div className="mt-4 text-xs text-slate-500">
            En cas d’échec, exporter un diagnostic depuis le menu Support (une fois l’app ouverte) ou consulter
            <span className="text-slate-300"> LOCALAPPDATA/IntrepidCore/Atlas/logs</span>.
          </div>
        </div>
      </div>
    </div>
  )
}
