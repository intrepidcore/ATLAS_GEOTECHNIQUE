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

type InstallerPreflight = {
  needsReset: boolean
  hasQuarantine: boolean
  quarantineCount: number
  seedPresent?: boolean
  seedPath?: string | null
  seedBytes?: number
  seedManifestPresent?: boolean
  pgBinPresent?: boolean
  pgBinDir?: string | null
}

type BackupReport = {
  path: string
  bytes: number
  sha256: string
  manifestPath: string
}

type ResetReport = {
  outcome: string
  dataRoot: string
  markerRemoved: boolean
  quarantinePath?: string | null
  warnings: string[]
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

function getAppVersionGetter(): (() => Promise<string>) | null {
  const w = window as any
  const getter = w?.__TAURI__?.app?.getVersion
  if (typeof getter === 'function') return getter as () => Promise<string>
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
  const [appVersion, setAppVersion] = useState<string>('')
  const [resetting, setResetting] = useState(false)
  const [backingUp, setBackingUp] = useState(false)
  const [preflightNeedsReset, setPreflightNeedsReset] = useState(false)
  const [preflightQuarantineCount, setPreflightQuarantineCount] = useState(0)
  const [preflight, setPreflight] = useState<InstallerPreflight | null>(null)

  const [expertOpen, setExpertOpen] = useState(false)

  const [maintenanceOpen, setMaintenanceOpen] = useState(false)
  const [maintenanceBackupFirst, setMaintenanceBackupFirst] = useState(true)
  const [maintenanceBusy, setMaintenanceBusy] = useState(false)
  const [maintenanceResult, setMaintenanceResult] = useState<{ backup?: BackupReport; reset?: ResetReport } | null>(
    null
  )
  const [activeOp, setActiveOp] = useState<'install' | 'maintenance' | null>(null)

  const inv = useMemo(() => getTauriInvoke(), [])
  const dialogOpen = useMemo(() => getDialogOpen(), [])
  const getVersion = useMemo(() => getAppVersionGetter(), [])

  useEffect(() => {
    if (!getVersion) return
    getVersion()
      .then((v) => {
        if (typeof v === 'string') setAppVersion(v)
      })
      .catch(() => {})
  }, [getVersion])

  useEffect(() => {
    if (!inv) return
    if (installPath.trim()) return
    const defaultPath = 'C:\\Program Files\\IntrepidCore\\Atlas'
    setInstallPath(defaultPath)
    void checkSpace(defaultPath)
  }, [inv])

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
    if (!inv) return
    inv<InstallerPreflight>('installer_preflight')
      .then((res) => {
        setPreflight(res)
        setPreflightNeedsReset(!!res?.needsReset)
        setPreflightQuarantineCount(typeof res?.quarantineCount === 'number' ? res.quarantineCount : 0)
      })
      .catch(() => {})
  }, [inv])

  const refreshPreflight = async () => {
    if (!inv) return
    try {
      const res = await inv<InstallerPreflight>('installer_preflight')
      setPreflight(res)
      setPreflightNeedsReset(!!res?.needsReset)
      setPreflightQuarantineCount(typeof res?.quarantineCount === 'number' ? res.quarantineCount : 0)
    } catch {
    }
  }

  const backupLocalDb = async () => {
    if (!inv) return
    setFatal(null)
    setBackingUp(true)
    setActiveOp('maintenance')
    setStep('progress')
    setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: 'Sauvegarde base locale…' }])
    try {
      const rep = await inv<BackupReport>('installer_backup_local_db', { args: { stopAfter: true } })
      setMaintenanceResult((p) => ({ ...(p || {}), backup: rep }))
      setLogs((prev) => [
        ...prev,
        {
          ts: new Date().toLocaleTimeString(),
          message: `✅ Sauvegarde créée: ${rep.path} (${formatBytes(rep.bytes)})`,
        },
        { ts: new Date().toLocaleTimeString(), message: `sha256: ${rep.sha256}` },
        { ts: new Date().toLocaleTimeString(), message: `manifest: ${rep.manifestPath}` },
      ])
      await refreshPreflight()
    } catch (e: any) {
      setFatal(e?.message ? String(e.message) : String(e))
    } finally {
      setBackingUp(false)
      setActiveOp(null)
    }
  }

  useEffect(() => {
    const unlisten = listenInstallerProgress((ev) => {
      setProgress(ev)
      setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: `${ev.percent}% — ${ev.message}` }])
      if (ev.step === 'done' && ev.percent >= 100) {
        setRunning(false)
        setActiveOp(null)
        setStep('done')
      }
    })
    return () => {
      unlisten?.()
    }
  }, [])

  const requiredBytes = 2 * 1024 * 1024 * 1024

  const canOfferReset = useMemo(() => {
    if (preflightNeedsReset) return true
    const msg = (fatal || '').toLowerCase()
    return msg.includes('seed non appliqué') || msg.includes('seed non applique') || msg.includes('état partiel') || msg.includes('etat partiel')
  }, [fatal, preflightNeedsReset])

  const canInstallSimple = useMemo(() => {
    if (!inv) return false
    const seedOk = preflight?.seedPresent !== false
    const pgOk = preflight?.pgBinPresent !== false
    return seedOk && pgOk
  }, [inv, preflight])

  const showExpertLink = useMemo(() => {
    if (!inv) return false
    if (!canInstallSimple) return true
    if (canOfferReset) return true
    if (preflightQuarantineCount > 0) return true
    return false
  }, [inv, canInstallSimple, canOfferReset, preflightQuarantineCount])

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
      const available = await inv<number>('installer_check_free_space', { args: { path: p, requiredBytes } })
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

  const doResetLocalDb = async () => {
    if (!inv) return
    setFatal(null)
    setResetting(true)
    setActiveOp('maintenance')
    setStep('progress')
    setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: 'Réinitialisation base locale…' }])
    try {
      const rep = await inv<ResetReport>('installer_reset_local_db', { args: { alsoRemoveMarker: true } })
      setMaintenanceResult((p) => ({ ...(p || {}), reset: rep }))
      setLogs((prev) => [
        ...prev,
        {
          ts: new Date().toLocaleTimeString(),
          message: `✅ Reset: ${rep.outcome} (markerRemoved=${rep.markerRemoved ? 'oui' : 'non'})`,
        },
        {
          ts: new Date().toLocaleTimeString(),
          message: rep.quarantinePath ? `quarantaine: ${rep.quarantinePath}` : 'quarantaine: (aucune)',
        },
      ])
      if (Array.isArray(rep.warnings) && rep.warnings.length > 0) {
        setLogs((prev) => [...prev, ...rep.warnings.map((w) => ({ ts: new Date().toLocaleTimeString(), message: `⚠ ${w}` }))])
      }
      setProgress({ step: 'reset', message: 'Réinitialisation terminée', percent: 100 })
      setStep('welcome')
      await refreshPreflight()
    } catch (e: any) {
      setFatal(e?.message ? String(e.message) : String(e))
    } finally {
      setResetting(false)
      setActiveOp(null)
    }
  }

  const runMaintenancePlan = async () => {
    if (!inv) return
    setMaintenanceBusy(true)
    setMaintenanceResult(null)
    setLogs([])
    try {
      if (maintenanceBackupFirst) {
        await backupLocalDb()
      }
      await doResetLocalDb()
    } finally {
      setMaintenanceBusy(false)
      setMaintenanceOpen(false)
    }
  }

  const openDataDir = async () => {
    if (!inv) return
    try {
      await inv<void>('installer_open_data_dir')
    } catch (e: any) {
      setFatal(e?.message ? String(e.message) : String(e))
    }
  }

  const openBackupsDir = async () => {
    if (!inv) return
    try {
      await inv<void>('installer_open_backups_dir')
    } catch (e: any) {
      setFatal(e?.message ? String(e.message) : String(e))
    }
  }

  const cleanupQuarantines = async () => {
    if (!inv) return
    setFatal(null)
    setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: 'Nettoyage quarantaines…' }])
    try {
      const rep = await inv<{ deleted: string[]; kept: string[] }>('installer_cleanup_quarantines', { keepLatest: 1 })
      setLogs((prev) => [
        ...prev,
        { ts: new Date().toLocaleTimeString(), message: `✅ Quarantaines supprimées: ${(rep.deleted || []).length}` },
        { ts: new Date().toLocaleTimeString(), message: `Conservées: ${(rep.kept || []).length}` },
      ])
      await refreshPreflight()
    } catch (e: any) {
      setFatal(e?.message ? String(e.message) : String(e))
    }
  }

  const exportDiagnostic = async () => {
    if (!inv) return
    setFatal(null)
    setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: 'Export diagnostic…' }])
    try {
      const out = await inv<string>('diagnostic_export')
      setLogs((prev) => [...prev, { ts: new Date().toLocaleTimeString(), message: `✅ Diagnostic: ${out}` }])
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
    setActiveOp('install')
    setStep('progress')
    try {
      await inv<void>('installer_run', { args: { installDb: options.installDb } })
    } catch (e: any) {
      setRunning(false)
      setActiveOp(null)
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
          <div className="text-xs text-slate-500">{appVersion ? `v${appVersion}` : ''}</div>
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

          {!fatal && step === 'welcome' ? (
            <div className="mb-4 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
              {canInstallSimple ? (
                <span>Tout est prêt pour installer Atlas en mode hors-ligne.</span>
              ) : (
                <span>
                  Préparation incomplète. Ouvre les options avancées pour diagnostiquer et réparer si nécessaire.
                </span>
              )}
            </div>
          ) : null}

          {maintenanceOpen ? (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
              <div className="w-full max-w-xl rounded-xl bg-white p-5 shadow-lg">
                <div className="mb-3 text-lg font-semibold">Maintenance base locale</div>
                <div className="mb-4 text-sm text-slate-700">
                  Tu peux sauvegarder la base avant de la réinitialiser. La quarantaine est conservée si Windows empêche la suppression.
                </div>
                <label className="mb-4 flex items-start gap-3 rounded-md border p-3">
                  <input
                    type="checkbox"
                    checked={maintenanceBackupFirst}
                    onChange={(e) => setMaintenanceBackupFirst(e.target.checked)}
                    className="mt-1"
                  />
                  <div>
                    <div className="text-sm font-medium">Sauvegarder la base avant reset</div>
                    <div className="text-xs text-slate-600">Recommandé (tu peux décocher).</div>
                  </div>
                </label>
                <div className="flex items-center justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setMaintenanceOpen(false)}
                    disabled={maintenanceBusy}
                    className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Annuler
                  </button>
                  <button
                    type="button"
                    onClick={runMaintenancePlan}
                    disabled={maintenanceBusy || running}
                    className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                  >
                    {maintenanceBusy ? 'En cours…' : 'Lancer maintenance'}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          {step === 'welcome' ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold">Bienvenue</div>
              <div className="text-sm text-slate-600">
                Atlas s'installe en mode hors-ligne avec une base locale et des données embarquées.
              </div>
              {!inv ? (
                <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                  Mode web détecté: l'installation est disponible uniquement dans l'application Desktop.
                </div>
              ) : null}

              <div className="pt-2">
                <button
                  onClick={() => {
                    void runInstall()
                  }}
                  disabled={!inv || running || !canInstallSimple}
                  className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
                >
                  Installer Atlas
                </button>
              </div>

              {showExpertLink ? (
                <button
                  type="button"
                  onClick={() => setExpertOpen((v) => !v)}
                  className="text-left text-sm text-slate-600 underline"
                >
                  Problème ? Options avancées
                </button>
              ) : null}

              {expertOpen ? (
                <div className="rounded-lg border bg-white p-4">
                  <div className="mb-2 text-sm font-semibold text-slate-800">Options avancées</div>

                  {!fatal && preflightNeedsReset ? (
                    <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
                      Une base locale PostgreSQL existe déjà (tentative précédente). Une réinitialisation est recommandée.
                    </div>
                  ) : null}

                  {preflightQuarantineCount > 0 ? (
                    <div className="mb-3 rounded-md border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-700">
                      Quarantaines détectées: {preflightQuarantineCount}.
                    </div>
                  ) : null}

                  <div className="mb-3 grid gap-1 text-xs text-slate-600">
                    <div>
                      Seed: {preflight?.seedPresent ? '✅' : '❌'} {preflight?.seedBytes ? `(${formatBytes(preflight.seedBytes)})` : ''}
                    </div>
                    <div className="truncate">
                      Seed path: {typeof preflight?.seedPath === 'string' && preflight.seedPath.trim() ? preflight.seedPath : '(unknown)'}
                    </div>
                    <div>PostgreSQL runtime: {preflight?.pgBinPresent ? '✅' : '❌'}</div>
                    <div className="truncate">
                      PG bin dir: {typeof preflight?.pgBinDir === 'string' && preflight.pgBinDir.trim() ? preflight.pgBinDir : '(unknown)'}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      onClick={() => setMaintenanceOpen(true)}
                      disabled={!inv || maintenanceBusy || running}
                      type="button"
                      className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Maintenance DB (sauvegarde / reset)
                    </button>
                    <button
                      onClick={openDataDir}
                      disabled={!inv || maintenanceBusy || running}
                      type="button"
                      className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Ouvrir données
                    </button>
                    <button
                      onClick={openBackupsDir}
                      disabled={!inv || maintenanceBusy || running}
                      type="button"
                      className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Ouvrir backups
                    </button>
                    <button
                      onClick={cleanupQuarantines}
                      disabled={!inv || maintenanceBusy || running}
                      type="button"
                      className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Nettoyer quarantaines
                    </button>
                  </div>
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

              {fatal ? (
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={exportDiagnostic}
                    disabled={!inv || maintenanceBusy || running}
                    type="button"
                    className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Export diagnostic
                  </button>
                  {canOfferReset ? (
                    <button
                      onClick={() => setMaintenanceOpen(true)}
                      disabled={!inv || maintenanceBusy || running}
                      type="button"
                      className="rounded-md bg-red-600 px-3 py-2 text-sm font-semibold text-white hover:bg-red-500 disabled:opacity-50"
                    >
                      Réparer (maintenance DB)
                    </button>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}

          {step === 'done' ? (
            <div className="space-y-3">
              <div className="text-lg font-semibold">Fin</div>
              <div className="text-sm text-slate-600">Installation terminée. Tu peux lancer Atlas Géotechnique.</div>
              <div className="flex flex-wrap gap-2">
                <button
                  onClick={launch}
                  className="rounded-md bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
                >
                  Lancer Atlas Géotechnique
                </button>
                <button
                  onClick={exportDiagnostic}
                  disabled={!inv}
                  type="button"
                  className="rounded-md border bg-white px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                >
                  Export diagnostic
                </button>
              </div>
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
            {step !== 'welcome' && step !== 'summary' && step !== 'progress' && step !== 'done' ? (
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
