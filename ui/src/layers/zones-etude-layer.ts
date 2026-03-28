import L from 'leaflet'
import type { ZoneEtude, ZoneMaille } from '../services/zones-etude-api'

export const RISQUE_COLORS: Record<string, string> = {
  tres_fort: '#d32f2f',
  fort: '#f57c00',
  moyen: '#fbc02d',
  faible: '#388e3c',
}

export const PRIORITE_COLORS: Record<number, string> = {
  1: '#d32f2f',
  2: '#f57c00',
  3: '#fbc02d',
  4: '#66bb6a',
}

export function addZoneEtudeLayer(
  map: L.Map,
  zone: Pick<ZoneEtude, 'nom' | 'risque_rga' | 'nb_mailles_total' | 'nb_sondages_existants'>,
  geojson: GeoJSON.Geometry,
  opts: { pane?: string; visible?: boolean } = {}
): L.GeoJSON {
  const color = RISQUE_COLORS[String(zone.risque_rga)] || '#9c27b0'

  const layer = L.geoJSON(geojson as any, {
    pane: opts.pane,
    style: {
      color,
      weight: 2.5,
      opacity: 0.9,
      fillColor: color,
      fillOpacity: 0.08,
      dashArray: '6 4',
    },
    interactive: false,
  })

  layer.bindPopup(
    `<div style="min-width:200px">
      <strong>${zone.nom}</strong><br/>
      <span style="color:${color}">● Risque RGA : ${String(zone.risque_rga).replace('_', ' ')}</span><br/>
      <small>${zone.nb_mailles_total} mailles · ${zone.nb_sondages_existants} sondages</small>
    </div>`
  )

  if (opts.visible !== false) layer.addTo(map)
  return layer
}

export function addZoneMaillesLayer(
  map: L.Map,
  mailles: Array<Pick<ZoneMaille, 'maille_code' | 'priorite_recherche' | 'geojson'>>,
  opts: { pane?: string; visible?: boolean } = {}
): { layer: L.GeoJSON; byCode: Map<string, L.Path> } {
  const byCode = new Map<string, L.Path>()

  const features: GeoJSON.Feature[] = mailles.map(m => ({
    type: 'Feature',
    geometry: m.geojson as any,
    properties: { maille_code: m.maille_code, priorite_recherche: m.priorite_recherche },
  }))

  const layer = L.geoJSON(
    { type: 'FeatureCollection', features } as any,
    {
      pane: opts.pane,
      style: (feature: any) => {
        const pr = Number(feature?.properties?.priorite_recherche)
        const c = PRIORITE_COLORS[pr] || '#9c27b0'
        return { fillColor: c, fillOpacity: 0.35, color: c, weight: 1.5, opacity: 0.95 }
      },
      onEachFeature: (feature: any, l: any) => {
        const code = feature?.properties?.maille_code
        if (typeof code === 'string' && code) byCode.set(code, l as L.Path)
      },
      interactive: false,
    }
  )

  if (opts.visible !== false) layer.addTo(map)
  return { layer, byCode }
}

