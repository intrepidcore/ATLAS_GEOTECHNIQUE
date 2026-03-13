import { TabComponent } from '../types/tabs'

type TauriInvoke = <T>(cmd: string, args?: Record<string, unknown>) => Promise<T>

function getTauriInvoke(): TauriInvoke | null {
  const w = window as any
  const inv = w?.__TAURI__?.tauri?.invoke
  if (typeof inv === 'function') return inv as TauriInvoke
  return null
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

export function createTabDatabase(): TabComponent {
  let container: HTMLElement | null = null

  let busy = false
  let lastBackupPath: string | null = null
  let lastDiagnosticDir: string | null = null
  let lastResetQuarantine: string | null = null
  let restorePath = ''

  function mount(containerEl: HTMLElement) {
    container = containerEl
    render()
    wire()
  }

  function unmount() {
    if (container) container.innerHTML = ''
    container = null
  }

  function setBusy(v: boolean) {
    busy = v
    update()
  }

  function setStatus(kind: 'ok' | 'err' | 'info', msg: string) {
    const el = container?.querySelector('#db-status') as HTMLElement | null
    if (!el) return
    el.dataset.kind = kind
    el.innerHTML = escapeHtml(msg)
  }

  function update() {
    if (!container) return

    const inv = getTauriInvoke()
    const isDesktop = !!inv

    const hint = container.querySelector('#db-desktop-hint') as HTMLElement | null
    if (hint) {
      hint.style.display = isDesktop ? 'none' : 'block'
    }

    const btns = Array.from(container.querySelectorAll('button[data-action]')) as HTMLButtonElement[]
    for (const b of btns) {
      b.disabled = busy || !isDesktop
    }

    const restoreInput = container.querySelector('#db-restore-path') as HTMLInputElement | null
    if (restoreInput) {
      restoreInput.disabled = busy || !isDesktop
      restoreInput.value = restorePath
    }

    const fields: Array<[string, string | null]> = [
      ['#db-last-backup', lastBackupPath],
      ['#db-last-diagnostic', lastDiagnosticDir],
      ['#db-last-reset', lastResetQuarantine],
    ]

    for (const [sel, v] of fields) {
      const el = container.querySelector(sel) as HTMLElement | null
      if (el) el.textContent = v ?? '—'
    }
  }

  async function runAction<T>(label: string, fn: () => Promise<T>): Promise<T | null> {
    if (busy) return null

    const inv = getTauriInvoke()
    if (!inv) {
      setStatus('err', "Disponible uniquement dans l'application Desktop")
      return null
    }

    setBusy(true)
    setStatus('info', `${label}...`)
    try {
      const out = await fn()
      setStatus('ok', `${label}: OK`)
      return out
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      setStatus('err', `${label}: ${msg}`)
      return null
    } finally {
      setBusy(false)
      update()
    }
  }

  function wire() {
    if (!container) return

    const restoreInput = container.querySelector('#db-restore-path') as HTMLInputElement | null
    restoreInput?.addEventListener('input', () => {
      restorePath = restoreInput.value
    })

    const buttons = Array.from(container.querySelectorAll('button[data-action]')) as HTMLButtonElement[]
    for (const b of buttons) {
      b.addEventListener('click', async () => {
        const action = b.dataset.action
        if (!action) return

        if (action === 'integrity') {
          await runAction('Vérification intégrité', async () => {
            const inv = getTauriInvoke()!
            await inv<void>('db_integrity_check')
          })
        }

        if (action === 'backup') {
          const out = await runAction('Backup', async () => {
            const inv = getTauriInvoke()!
            return await inv<string>('db_backup')
          })
          if (typeof out === 'string') lastBackupPath = out
        }

        if (action === 'restore') {
          const dumpPath = restorePath.trim() || lastBackupPath
          if (!dumpPath) {
            setStatus('err', 'Chemin du dump requis (champ ou dernier backup)')
            return
          }

          const ok = window.confirm(`Restaurer la base depuis:\n${dumpPath}\n\nCette opération remplace la base existante.`)
          if (!ok) return

          await runAction('Restore', async () => {
            const inv = getTauriInvoke()!
            await inv<void>('db_restore', { dumpPath })
          })
        }

        if (action === 'reset') {
          const ok = window.confirm(
            'Réinitialiser la base (quarantaine du cluster PostgreSQL).\n\nAu prochain démarrage, un nouveau cluster sera créé.'
          )
          if (!ok) return

          const out = await runAction('Reset', async () => {
            const inv = getTauriInvoke()!
            return await inv<string>('db_reset')
          })
          if (typeof out === 'string') lastResetQuarantine = out
        }

        if (action === 'diagnostic') {
          const out = await runAction('Export diagnostic', async () => {
            const inv = getTauriInvoke()!
            return await inv<string>('diagnostic_export')
          })
          if (typeof out === 'string') lastDiagnosticDir = out
        }

        update()
      })
    }

    update()
  }

  function render() {
    if (!container) return

    container.innerHTML = `
      <div style="padding: 16px; display: flex; flex-direction: column; gap: 12px; color: var(--tab-text);">
        <div style="display: flex; align-items: baseline; justify-content: space-between; gap: 12px;">
          <div>
            <div style="font-size: 16px; font-weight: 700; color: var(--tab-text-primary);">Base de données</div>
            <div style="font-size: 12px; opacity: 0.8;">Sauvegarde, restauration, reset et diagnostic (Desktop)</div>
          </div>
          <div id="db-status" data-kind="info" style="font-size: 12px; opacity: 0.9;"></div>
        </div>

        <div id="db-desktop-hint" style="display: none; padding: 10px 12px; border: 1px solid rgba(255,255,255,0.12); border-radius: 8px; background: rgba(255,255,255,0.04);">
          Cette section est disponible uniquement dans l'application Desktop.
        </div>

        <div style="display: grid; grid-template-columns: 1fr; gap: 10px;">
          <div style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn-primary" data-action="integrity" style="padding: 10px 14px;">Vérifier intégrité</button>
            <button class="btn-primary" data-action="backup" style="padding: 10px 14px;">Backup</button>
            <button class="btn-primary" data-action="diagnostic" style="padding: 10px 14px;">Export diagnostic</button>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--tab-text-primary);">Restauration</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <input id="db-restore-path" type="text" placeholder="Chemin .dump (sinon utilise le dernier backup)" style="flex: 1; padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(255,255,255,0.12); background: rgba(0,0,0,0.15); color: var(--tab-text-primary);" />
              <button class="btn-primary" data-action="restore" style="padding: 10px 14px;">Restore</button>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--tab-text-primary);">Réinitialisation</div>
            <div style="display: flex; gap: 8px; align-items: center;">
              <button class="btn-primary" data-action="reset" style="padding: 10px 14px;">Reset DB</button>
              <div style="font-size: 12px; opacity: 0.85;">Quarantaine cluster: <span id="db-last-reset">—</span></div>
            </div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 6px;">
            <div style="font-size: 13px; font-weight: 600; color: var(--tab-text-primary);">Derniers chemins</div>
            <div style="display: grid; grid-template-columns: 120px 1fr; gap: 6px 10px; font-size: 12px; opacity: 0.9;">
              <div>Backup</div><div id="db-last-backup">—</div>
              <div>Diagnostic</div><div id="db-last-diagnostic">—</div>
            </div>
          </div>
        </div>
      </div>
    `

    setStatus('info', 'Prêt')
    update()
  }

  return {
    mount,
    unmount,
  }
}
