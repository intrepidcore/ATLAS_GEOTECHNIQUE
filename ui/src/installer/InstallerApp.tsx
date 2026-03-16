import React, { useEffect, useMemo, useState } from 'react'

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

type InstallerStep = 'welcome' | 'path' | 'options' | 'summary' | 'progress' | 'done'

type InstallOptions = {
  installDb: boolean
  installExtraModules: boolean
}

type ProgressEvent = {
  step: string
  message: string
  percent: number
}

type DialogOpen = (options: {
  directory?: boolean
  multiple?: boolean
  title?: string
}) => Promise<string | string[] | null>

function getTauriInvoke(): TauriInvoke | null {
  const w = window as any
  const invV2 = w?.__TAURI__?.core?.invoke
  if (typeof invV2 === 'function') return invV2 as TauriInvoke
  const invV1 = w?.__TAURI__?.tauri?.invoke
  if (typeof invV1 === 'function') return invV1 as TauriInvoke
  return null
}

function getDialogOpen(): DialogOpen | null {
  const w = window as any
  const open = w?.__TAURI__?.dialog?.open
  if (typeof open === 'function') return open as DialogOpen
  return null
}

function listenInstallerProgress(cb: (ev: ProgressEvent) => void): (() => void) | null {
  const w = window as any
  const listen = w?.__TAURI__?.event?.listen
  if (typeof listen !== 'function') return null
  let unlisten: any = null
  listen('installer:progress', (event: any) => {
    const payload = event?.payload
    if (payload && typeof payload.percent === 'number') {
      cb(payload as ProgressEvent)
    }
  }).then((fn: any) => {
    unlisten = fn
  })
  return () => {
    if (typeof unlisten === 'function') unlisten()
  }
}

function formatBytes(bytes: number): string {
  const gb = bytes / (1024 * 1024 * 1024)
  if (gb >= 10) return `${Math.round(gb)} Go`
  return `${gb.toFixed(1)} Go`
}

export function InstallerApp() {
  const [step, setStep] = useState<InstallerStep>('welcome')
  const [installPath, setInstallPath] = useState('')
  const [freeSpaceBytes, setFreeSpaceBytes] = useState<number | null>(null)
  const [freeSpaceError, setFreeSpaceError] = useState<string | null>(null)
  const [options, setOptions] = useState<InstallOptions>({
    installDb: true,
    installExtraModules: false,
  })
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState<ProgressEvent>({ step: 'start', message: '', percent: 0 })
  const [logs, setLogs] = useState<Array<{ ts: string; message: string }>>([])
  const [fatal, setFatal] = useState<string | null>(null)

  const inv = useMemo(() => getTauriInvoke(), [])
  const dialogOpen = useMemo(() => getDialogOpen(), [])

  useEffect(() => {
    if (!inv) return
    inv<boolean>('installer_is_installed')
      .then((installed) => {
        if (installed) {
          setStep('done')
          setProgress({ step: 'done', message: 'Déjà installé', percent: 100 })
        }
      })
      .catch(() => {})
  }, [inv])

  useEffect(() => {
    const unlisten = listenInstallerProgress((ev) => {
      setProgress(ev)
      setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: `${ev.percent}% — ${ev.message}` }])
      if (ev.percent >= 100) {
        setRunning(false)
        setStep('done')
      }
    })
    return () => {
      unlisten?.()
    }
  }, [])

  const requiredBytes = 2 * 1024 * 1024 * 1024

  const checkSpace = async (path: string) => {
    if (!inv) return
    const p = path.trim()
    if (!p) {
      setFreeSpaceBytes(null)
      setFreeSpaceError(null)
      return
    }
    try {
      setFreeSpaceError(null)
      const available = await inv<number>('installer_check_free_space', { path: p, requiredBytes })
      setFreeSpaceBytes(available)
    } catch (e: any) {
      setFreeSpaceBytes(null)
      setFreeSpaceError(e?.message ? String(e.message) : String(e))
    }
  }

  const browseInstallDir = async () => {
    if (!dialogOpen) {
      setFatal('Sélecteur de dossier indisponible (plugin dialog).')
      return
    }
    setFatal(null)
    try {
      const selected = await dialogOpen({
        directory: true,
        multiple: false,
        title: "Choisir le dossier d'installation",
      })
      const value = Array.isArray(selected) ? selected[0] : selected
      if (typeof value === 'string' && value.trim() !== '') {
        setInstallPath(value)
        await checkSpace(value)
      }
    } catch (e: any) {
      setFatal(e?.message ? String(e.message) : String(e))
    }
  }

  const canGoNext = () => {
    if (step === 'path') {
      if (!installPath.trim()) return false
      if (freeSpaceError) return false
      if (typeof freeSpaceBytes === 'number' && freeSpaceBytes < requiredBytes) return false
    }
    return true
  }

  const next = () => {
    const order: InstallerStep[] = ['welcome', 'path', 'options', 'summary', 'progress', 'done']
    const idx = order.indexOf(step)
    const nextStep = order[Math.min(idx + 1, order.length - 1)]
    setStep(nextStep)
  }

  const back = () => {
    const order: InstallerStep[] = ['welcome', 'path', 'options', 'summary', 'progress', 'done']
    const idx = order.indexOf(step)
    const prevStep = order[Math.max(idx - 1, 0)]
    setStep(prevStep)
  }

  const runInstall = async () => {
    if (!inv) {
      setFatal("Tauri indisponible. L'installateur doit être lancé depuis l'application Desktop.")
      return
    }
    setFatal(null)
    setLogs([])
    setRunning(true)
    setStep('progress')
    try {
      await inv<void>('installer_run', {
        installDb: options.installDb,
      })
    } catch (e: any) {
      setRunning(false)
      setFatal(e?.message ? String(e.message) : String(e))
    }
  }

  const launch = () => {
    window.location.href = '/'
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm text-slate-500">Atlas Géotechnique</div>
            <div className="text-2xl font-semibold tracking-tight">Installateur</div>
          </div>
          <div className="text-xs text-slate-500">v1.0.1</div>
        </div>

        <div className="mt-6 rounded-xl border bg-white p-6 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="text-sm font-medium text-slate-700">Étape</div>
            <div className="text-sm text-slate-500">{step}</div>
          </div>

          {fatal ? (
            <div className="mb-4 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {fatal}
            </div>
          ) : null}

          {step === 'welcome' ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold">Bienvenue</div>
              <div className="text-sm text-slate-600">
                Cet assistant installe Atlas Géotechnique et, si sélectionné, initialise PostgreSQL/PostGIS embarqué,
                restaure le dataset et démarre les services.
              </div>
              {!inv ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Mode web détecté: l'installation est disponible uniquement dans l'application Desktop.
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 'path' ? (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Choix du dossier d'installation</div>
              <div className="text-sm text-slate-600">
                Indique le dossier cible. Espace requis: {formatBytes(requiredBytes)}.
              </div>
              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700">Dossier</label>
                <div className="flex gap-2">
                  <input
                    value={installPath}
                    onChange={(e) => {
                      setInstallPath(e.target.value)
                    }}
                    onBlur={() => checkSpace(installPath)}
                    placeholder="Ex: C:\\Program Files\\IntrepidCore\\Atlas"
                    className="w-full rounded-md border px-3 py-2 text-sm"
                  />
                  <button
                    onClick={browseInstallDir}
                    type="button"
                    className="whitespace-nowrap rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50"
                  >
                    Parcourir
                  </button>
                </div>
                {typeof freeSpaceBytes === 'number' ? (
                  <div className="text-sm text-slate-700">Espace disponible: {formatBytes(freeSpaceBytes)}</div>
                ) : null}
                {freeSpaceError ? (
                  <div className="text-sm text-red-700">{freeSpaceError}</div>
                ) : null}
                <button
                  onClick={() => checkSpace(installPath)}
                  className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800"
                >
                  Vérifier espace
                </button>
              </div>
            </div>
          ) : null}

          {step === 'options' ? (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Options d'installation</div>
              <label className="flex items-start gap-3 rounded-md border p-3">
                <input
                  type="checkbox"
                  checked={options.installDb}
                  onChange={(e) => setOptions((p) => ({ ...p, installDb: e.target.checked }))}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Installer DB intégrée (PostgreSQL + PostGIS)</div>
                  <div className="text-xs text-slate-600">
                    Initialise la base, restaure le dataset et applique les migrations.
                  </div>
                </div>
              </label>
              <label className="flex items-start gap-3 rounded-md border p-3">
                <input
                  type="checkbox"
                  checked={options.installExtraModules}
                  onChange={(e) => setOptions((p) => ({ ...p, installExtraModules: e.target.checked }))}
                  className="mt-1"
                />
                <div>
                  <div className="text-sm font-medium">Installer modules supplémentaires</div>
                  <div className="text-xs text-slate-600">Option réservée aux futures releases.</div>
                </div>
              </label>
            </div>
          ) : null}

          {step === 'summary' ? (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Résumé</div>
              <div className="grid gap-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-slate-600">Chemin</span>
                  <span className="font-medium">{installPath || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">DB intégrée</span>
                  <span className="font-medium">{options.installDb ? 'Oui' : 'Non'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-600">Modules supplémentaires</span>
                  <span className="font-medium">{options.installExtraModules ? 'Oui' : 'Non'}</span>
                </div>
              </div>
              <button
                onClick={runInstall}
                disabled={running}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
              >
                Installer
              </button>
            </div>
          ) : null}

          {step === 'progress' ? (
            <div className="space-y-4">
              <div className="text-lg font-semibold">Progression</div>
              <div className="h-2 w-full overflow-hidden rounded bg-slate-100">
                <div
                  className="h-2 bg-blue-600 transition-all"
                  style={{ width: `${Math.max(0, Math.min(100, progress.percent))}%` }}
                />
              </div>
              <div className="text-sm text-slate-700">Étape actuelle: {progress.message || '—'}</div>
              <div className="max-h-56 overflow-auto rounded-md border bg-slate-50 p-3 text-xs text-slate-700">
                {logs.length === 0 ? <div className="text-slate-500">En attente...</div> : null}
                {logs.map((l, idx) => (
                  <div key={idx} className="font-mono">
                    [{l.ts}] {l.message}
                  </div>
                ))}
              </div>
              {fatal ? (
                <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
                  {fatal}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 'done' ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold">Fin</div>
              <div className="text-sm text-slate-600">Installation terminée. Tu peux lancer Atlas Géotechnique.</div>
              <button
                onClick={launch}
                className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
              >
                Lancer Atlas Géotechnique
              </button>
            </div>
          ) : null}

          <div className="mt-8 flex items-center justify-between">
            <button
              onClick={back}
              disabled={step === 'welcome' || step === 'progress' || running}
              className="rounded-md border px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            >
              Retour
            </button>
            {step !== 'summary' && step !== 'progress' && step !== 'done' ? (
              <button
                onClick={next}
                disabled={!canGoNext() || running}
                className="rounded-md bg-slate-900 px-3 py-2 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50"
              >
                Suivant
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  )
}
