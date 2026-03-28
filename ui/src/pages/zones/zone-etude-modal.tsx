import React, { useEffect, useState } from 'react'
import { X } from 'lucide-react'

import { zonesEtudeApi, type ZoneEtude, type ZoneMaille } from '../../services/zones-etude-api'
import { ZoneEtudePanel } from '../../components/ZoneEtudePanel'
import { openCreateMissionModal } from '../../modal/react-modal-host'
import { downloadBlob } from '../../export/capture-utils'

function escapeCsvCell(v: any): string {
  const s = v == null ? '' : String(v)
  if (s.includes('"') || s.includes(',') || s.includes('\n') || s.includes('\r')) {
    return `"${s.replace(/"/g, '""')}"`
  }
  return s
}

export default function ZoneEtudeModal(props: {
  isOpen: boolean
  onClose: () => void
  zoneCode: string
}) {
  const { isOpen, onClose, zoneCode } = props

  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [zone, setZone] = useState<ZoneEtude | null>(null)
  const [mailles, setMailles] = useState<ZoneMaille[]>([])

  const handleClearMap = () => {
    ;(window as any).__atlasClearZoneEtudeOnMap?.()
  }

  useEffect(() => {
    if (!isOpen) return

    let cancelled = false
    setLoading(true)
    setError(null)

    ;(async () => {
      try {
        const zones = await zonesEtudeApi.listZones()
        const z = zones.find(x => x.code === zoneCode)
        if (!z) throw new Error(`Zone ${zoneCode} introuvable`)

        const zoneGeo = await zonesEtudeApi.getZoneGeojson(zoneCode)
        const m = await zonesEtudeApi.getZoneMailles(zoneCode)

        if (cancelled) return

        setZone(z)
        setMailles(m)

        ;(window as any).__atlasRenderZoneEtudeOnMap?.({
          zone: z,
          zoneGeojson: zoneGeo.geojson,
          mailles: m,
        })
      } catch (e: any) {
        if (cancelled) return
        setError(e?.message || 'Erreur chargement zone d’étude')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()

    return () => {
      cancelled = true
      handleClearMap()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, zoneCode])

  const onExportCsv = (rows: ZoneMaille[]) => {
    const header = [
      'maille_code',
      'pct_intersection',
      'priorite_recherche',
      'nb_sondages',
      'nb_essais_vbs',
      'vbs_moyen',
      'nb_essais_atterberg',
      'statut_donnees',
    ]

    const csv = [header.join(',')]
      .concat(
        rows.map(r =>
          [
            escapeCsvCell(r.maille_code),
            escapeCsvCell(r.pct_intersection),
            escapeCsvCell(r.priorite_recherche),
            escapeCsvCell(r.nb_sondages),
            escapeCsvCell(r.nb_essais_vbs),
            escapeCsvCell(r.vbs_moyen ?? ''),
            escapeCsvCell(r.nb_essais_atterberg),
            escapeCsvCell(r.statut_donnees),
          ].join(',')
        )
      )
      .join('\n')

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' })
    downloadBlob(blob, `atlas_zone_${zoneCode}_mailles.csv`)
  }

  const onExportGeoPackage = async () => {
    try {
      const blob = await zonesEtudeApi.exportZoneGeoPackage(zoneCode)
      const filename = `atlas_zone_${zoneCode}_export.gpkg.json`
      downloadBlob(blob, filename)
    } catch (e: any) {
      ;(window as any).toast?.(e?.message || 'Erreur export GeoPackage', 'err')
    }
  }

  const handleMailleClick = (mailleCode: string) => {
    ;(window as any).__atlasHighlightZoneMaille?.(mailleCode)
    openCreateMissionModal({
      mailleCode,
      onDone: () => {
        // pas de refresh automatique ici: garder l’état du panneau
      },
    })
  }

  const handleClose = () => {
    handleClearMap()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={handleClose} />

      <div className="relative z-[90] h-[90vh] w-full max-w-3xl overflow-hidden rounded-2xl bg-white shadow-xl dark:bg-slate-900 border border-slate-200 dark:border-slate-700">
        {loading ? (
          <div className="h-full flex items-center justify-center text-slate-600">
            Chargement...
          </div>
        ) : error ? (
          <div className="h-full p-4 text-red-700">
            <div className="font-semibold">Erreur</div>
            <div className="mt-2 text-sm">{error}</div>
          </div>
        ) : zone ? (
          <ZoneEtudePanel
            zone={zone}
            mailles={mailles}
            onClose={handleClose}
            onMailleClick={handleMailleClick}
            onExportCsv={onExportCsv}
            onExportGeoPackage={onExportGeoPackage}
          />
        ) : null}

        {/* bouton X redondant: gardé pour UX; le panel reçoit aussi onClose */}
        <button
          className="absolute top-3 right-3 rounded-md p-1 bg-white/80 hover:bg-white border border-slate-200"
          onClick={handleClose}
          aria-label="Fermer"
          type="button"
        >
          <X className="w-5 h-5" />
        </button>
      </div>
    </div>
  )
}

