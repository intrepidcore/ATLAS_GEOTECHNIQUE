import React, { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { createRoot, type Root } from 'react-dom/client'

import { colabController } from '../colab/colab-controller'
import { mailleStateStore } from '../stores/maille-state-store'
import { bus } from '../utils/event-bus'
import { openCreateMissionModal, openTransferMissionModal } from './react-modal-host'

type OpenMailleDialogRequest = {
  mailleId: string
  mailleCode?: string
}

type MailleMissionItem = {
  mission_id?: string | number
  mission_code?: string
  student_name?: string
}

let container: HTMLDivElement | null = null
let root: Root | null = null
let openImpl: ((req: OpenMailleDialogRequest) => void) | null = null
let closeImpl: (() => void) | null = null

const Host: React.FC = () => {
  const [req, setReq] = useState<OpenMailleDialogRequest | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [missions, setMissions] = useState<MailleMissionItem[]>([])

  const close = useCallback(() => {
    console.log('[Colab][MailleDialog] close')
    setReq(null)
  }, [])

  const open = useCallback((r: OpenMailleDialogRequest) => {
    console.log('[Colab][MailleDialog] open', r)
    setReq(r)
  }, [])

  openImpl = open
  closeImpl = close

  useEffect(() => {
    if (!container) return
    container.style.pointerEvents = req ? 'auto' : 'none'
  }, [req])

  const load = useCallback(async () => {
    if (!req) return
    setError(null)
    setLoading(true)
    try {
      const data: any = await colabController.listActiveMissionsOnMaille(String(req.mailleId))
      const ms = Array.isArray(data?.missions) ? data.missions : []
      setMissions(ms)
    } catch (e: any) {
      setMissions([])
      setError(e?.message || 'Erreur chargement missions')
      console.warn('[Colab][MailleDialog] load missions failed', e)
    } finally {
      setLoading(false)
    }
  }, [req])

  const refreshMailleState = useCallback(async () => {
    if (!req) return
    try {
      const st = await colabController.getMailleState(String(req.mailleId))
      mailleStateStore.set(String(req.mailleId), { hasActiveMission: st.hasActiveMission, missionCount: st.missionCount })
      bus.emit('maille:update', { mailleId: String(req.mailleId) })
    } catch {
      // ignore
    }
  }, [req])

  useEffect(() => {
    if (!req) return
    void load()
    void refreshMailleState()
  }, [load, refreshMailleState, req])

  useEffect(() => {
    if (!req) return
    const onKeyDown = (ev: KeyboardEvent) => {
      if (ev.key === 'Escape') close()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [close, req])

  const title = useMemo(() => {
    if (!req) return ''
    const label = req.mailleCode ? `Maille ${req.mailleCode}` : `Maille ${req.mailleId}`
    return label
  }, [req])

  if (!req) return null

  return React.createElement(
    'div',
    { className: 'fixed inset-0 z-[9000] flex items-center justify-center' },
    React.createElement('div', {
      className: 'absolute inset-0 bg-black/50',
      onClick: () => close(),
    }),
    React.createElement(
      'div',
      {
        className:
          'relative w-[420px] max-w-[calc(100vw-24px)] max-h-[80vh] overflow-y-auto rounded-2xl border border-slate-700 bg-slate-900 text-slate-100 shadow-2xl',
        onMouseDown: (e: any) => e.stopPropagation(),
        onClick: (e: any) => e.stopPropagation(),
      },
      React.createElement(
        'div',
        { className: 'flex items-center justify-between gap-3 px-4 py-3 border-b border-slate-700' },
        React.createElement('div', { className: 'flex flex-col' },
          React.createElement('div', { className: 'font-semibold' }, title),
          React.createElement('div', { className: 'text-xs text-slate-400' }, 'Colab')
        ),
        React.createElement(
          'button',
          {
            className: 'btn secondary btn-sm',
            onClick: () => close(),
          },
          '✕',
        ),
      ),
      React.createElement(
        'div',
        { className: 'p-4 space-y-4' },
        error
          ? React.createElement(
              'div',
              { className: 'text-sm text-red-300 border border-red-900/50 bg-red-950/40 rounded-lg p-3' },
              error,
            )
          : null,

        React.createElement(
          'div',
          { className: 'space-y-2' },
          React.createElement('div', { className: 'text-xs font-semibold text-slate-300' }, 'Missions actives'),
          React.createElement(
            'div',
            { className: 'flex gap-2' },
            React.createElement(
              'button',
              {
                className: 'btn secondary btn-sm',
                onClick: () => void load(),
              },
              loading ? 'Chargement…' : 'Rafraîchir',
            ),
            React.createElement(
              'button',
              {
                className: 'btn secondary btn-sm',
                onClick: () => {
                  close()
                  queueMicrotask(() => {
                    openCreateMissionModal({
                      mailleCode: req.mailleCode,
                      onDone: () => {
                        void refreshMailleState()
                        void load()
                      },
                    })
                  })
                },
              },
              'Assigner',
            ),
          ),
          React.createElement(
            'div',
            { className: 'space-y-2 pt-2' },
            missions.length === 0 && !loading
              ? React.createElement('div', { className: 'text-sm text-slate-400' }, 'Aucune mission active')
              : null,
            ...missions.map((m: any) => {
              const id = m?.mission_id
              return React.createElement(
                'div',
                {
                  key: String(id ?? Math.random()),
                  className: 'flex items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-950/40 p-3',
                },
                React.createElement(
                  'div',
                  { className: 'min-w-0 flex flex-col gap-1' },
                  React.createElement(
                    'div',
                    { className: 'text-xs font-mono text-slate-200 truncate' },
                    m?.mission_code || '—',
                  ),
                  React.createElement(
                    'div',
                    { className: 'text-sm text-slate-300 truncate' },
                    m?.student_name || '—',
                  ),
                ),
                React.createElement(
                  'div',
                  { className: 'flex gap-2' },
                  id
                    ? React.createElement(
                        'button',
                        {
                          className: 'btn secondary btn-sm',
                          onClick: () => {
                            close()
                            queueMicrotask(() => {
                              openTransferMissionModal({
                                missionId: String(id),
                                onDone: () => {
                                  void refreshMailleState()
                                  void load()
                                },
                              })
                            })
                          },
                        },
                        'Transférer',
                      )
                    : null,
                  id
                    ? React.createElement(
                        'button',
                        {
                          className: 'btn danger btn-sm',
                          onClick: async () => {
                            try {
                              await colabController.unassignMissionMaille(String(id))
                              await refreshMailleState()
                              await load()
                            } catch (e: any) {
                              setError(e?.message || 'Erreur désassignation')
                            }
                          },
                        },
                        'Désassigner',
                      )
                    : null,
                ),
              )
            }),
          ),
        ),
      ),
    ),
  )
}

function ensureMounted() {
  if (container && root) return
  container = document.createElement('div')
  container.id = 'atlas-maille-dialog-host'
  container.style.position = 'fixed'
  container.style.inset = '0'
  container.style.zIndex = '9000'
  container.style.pointerEvents = 'none'
  document.body.appendChild(container)
  root = createRoot(container)
  root.render(React.createElement(Suspense, { fallback: null }, React.createElement(Host)))
  console.log('[Colab][MailleDialog] mounted')
}

export function openMailleDialog(opts: { mailleId: string; mailleCode?: string }) {
  ensureMounted()
  console.log('[Colab][MailleDialog] openMailleDialog', opts)
  openImpl?.({ mailleId: opts.mailleId, mailleCode: opts.mailleCode })
}

export function closeMailleDialog() {
  console.log('[Colab][MailleDialog] closeMailleDialog')
  closeImpl?.()
}
