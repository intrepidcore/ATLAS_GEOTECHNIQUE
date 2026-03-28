import React, { useMemo, useState } from 'react'
import type { RisqueRga, ZoneEtude, ZoneMaille } from '../services/zones-etude-api'
import { Button } from '../pages/colab/ui'

const RISQUE_COLORS: Record<RisqueRga, string> = {
  tres_fort: '#d32f2f',
  fort: '#f57c00',
  moyen: '#fbc02d',
  faible: '#388e3c',
}

const PRIORITE_COLORS: Record<number, string> = {
  1: '#d32f2f',
  2: '#f57c00',
  3: '#fbc02d',
  4: '#66bb6a',
}

export type ZoneEtudeFilter = 'tous' | 'prio1' | 'sans_donnees'

export function ZoneEtudePanel(props: {
  zone: ZoneEtude
  mailles: ZoneMaille[]
  onMailleClick: (mailleCode: string) => void
  onClose: () => void
  onExportCsv: (mailles: ZoneMaille[]) => void
  onExportGeoPackage: () => void
}) {
  const { zone, mailles, onMailleClick, onClose, onExportCsv, onExportGeoPackage } = props

  const [filter, setFilter] = useState<ZoneEtudeFilter>('tous')

  const maillesFiltrees = useMemo(() => {
    if (filter === 'prio1') return mailles.filter(m => m.priorite_recherche === 1)
    if (filter === 'sans_donnees') return mailles.filter(m => m.statut_donnees === 'aucune_donnee')
    return mailles
  }, [filter, mailles])

  const stats = useMemo(() => {
    const total = mailles.length
    const avecSondages = mailles.filter(m => m.nb_sondages > 0).length
    const sansDonnees = mailles.filter(m => m.statut_donnees === 'aucune_donnee').length
    const prio1 = mailles.filter(m => m.priorite_recherche === 1).length
    return { total, avecSondages, sansDonnees, prio1 }
  }, [mailles])

  const coveragePct = stats.total > 0 ? Math.round((stats.avecSondages / stats.total) * 100) : 0
  const risqueColor = RISQUE_COLORS[zone.risque_rga]

  return (
    <div className="flex h-full flex-col">
      {/* En-tête */}
      <div className="flex items-start justify-between gap-4 border-b border-slate-200 p-4">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-semibold text-slate-900">{zone.nom}</h2>
          <div className="mt-1 flex items-center gap-2">
            <span className="inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold" style={{ background: risqueColor, color: 'white' }}>
              Risque RGA {zone.risque_rga.replace('_', ' ')}
            </span>
            <span className="text-xs text-slate-500">• {stats.total} mailles</span>
          </div>
        </div>
        <button onClick={onClose} className="rounded-md p-1 hover:bg-slate-100">
          ✕
        </button>
      </div>

      {/* Contenu scroll */}
      <div className="flex-1 overflow-y-auto p-4">
        {/* Infos géologiques */}
        <div className="space-y-2">
          {zone.description ? <p className="text-sm text-slate-700">{zone.description}</p> : null}
          {zone.mineraux_argileux?.length ? (
            <div className="flex flex-wrap gap-2">
              <span className="text-xs font-semibold text-slate-700">Minéraux argileux</span>
              {zone.mineraux_argileux.map(m => (
                <span key={m} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                  {m}
                </span>
              ))}
            </div>
          ) : null}
        </div>

        {/* Statistiques */}
        <div className="mt-4 grid grid-cols-4 gap-3">
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{stats.total}</div>
            <div className="text-xs text-slate-600">Mailles totales</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{stats.avecSondages}</div>
            <div className="text-xs text-slate-600">Avec sondages</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{stats.sansDonnees}</div>
            <div className="text-xs text-slate-600">Sans données</div>
          </div>
          <div className="rounded-lg border border-slate-200 bg-white p-3">
            <div className="text-2xl font-bold text-slate-900">{stats.prio1}</div>
            <div className="text-xs text-slate-600">Priorité 1</div>
          </div>
        </div>

        {/* Coverage bar */}
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-slate-600">
            <span>Couverture données</span>
            <span className="font-semibold">{coveragePct}%</span>
          </div>
          <div className="mt-2 h-2 w-full rounded-full bg-slate-100">
            <div className="h-2 rounded-full bg-blue-500" style={{ width: `${coveragePct}%` }} />
          </div>
        </div>

        {/* Filtres */}
        <div className="mt-4 flex flex-wrap gap-2">
          <Button variant={filter === 'tous' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('tous')}>
            Toutes ({stats.total})
          </Button>
          <Button variant={filter === 'prio1' ? 'primary' : 'outline'} size="sm" onClick={() => setFilter('prio1')}>
            Priorité 1 ({stats.prio1})
          </Button>
          <Button
            variant={filter === 'sans_donnees' ? 'primary' : 'outline'}
            size="sm"
            onClick={() => setFilter('sans_donnees')}
          >
            À investiguer ({stats.sansDonnees})
          </Button>
        </div>

        {/* Liste mailles */}
        <div className="mt-4 space-y-2">
          {maillesFiltrees.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50 p-3 text-sm text-slate-600">
              Aucune maille pour ce filtre.
            </div>
          ) : (
            maillesFiltrees.map(m => {
              const color = PRIORITE_COLORS[m.priorite_recherche] || '#9c27b0'
              const badgeText =
                m.statut_donnees === 'aucune_donnee'
                  ? '⚠ À investiguer'
                  : m.statut_donnees === 'partiellement_documente'
                    ? '◑ Partiel'
                    : m.statut_donnees === 'bien_documente'
                      ? '✓ Documenté'
                      : m.statut_donnees

              return (
                <button
                  key={m.id}
                  onClick={() => onMailleClick(m.maille_code)}
                  className="w-full rounded-xl border border-slate-200 bg-white p-3 text-left hover:bg-slate-50"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="truncate font-mono text-sm font-semibold text-slate-900">{m.maille_code}</div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-1">Priorité {m.priorite_recherche}</span>
                        <span className="rounded-md bg-slate-100 px-2 py-1">{Math.round(m.pct_intersection)}% zone</span>
                      </div>
                    </div>

                    <div className="shrink-0">
                      <span className="inline-flex rounded-full px-3 py-1 text-xs font-semibold" style={{ background: color, color: 'white' }}>
                        {badgeText}
                      </span>
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-600">
                    <span className="font-semibold">Sondages:</span> {m.nb_sondages} • <span className="font-semibold">VBS:</span> {m.nb_essais_vbs}
                    {m.vbs_moyen != null ? ` • Moy VBS: ${m.vbs_moyen.toFixed(1)}` : ''}
                    {' • '}
                    <span className="font-semibold">Atterberg:</span> {m.nb_essais_atterberg}
                  </div>
                </button>
              )
            })
          )}
        </div>
      </div>

      {/* Footer exports */}
      <div className="border-t border-slate-200 p-4">
        <div className="flex gap-2 flex-wrap">
          <Button variant="outline" size="sm" onClick={() => onExportCsv(maillesFiltrees)}>
            Exporter liste mailles (CSV)
          </Button>
          <Button variant="primary" size="sm" onClick={onExportGeoPackage}>
            Exporter GeoPackage
          </Button>
        </div>
      </div>
    </div>
  )
}

