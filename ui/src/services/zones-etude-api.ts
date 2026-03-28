import { apiGet, apiUrl } from '../api'

export type RisqueRga = 'faible' | 'moyen' | 'fort' | 'tres_fort'

export interface ZoneEtude {
  id: string
  code: string
  nom: string
  description?: string | null
  type_zone: string
  risque_rga: RisqueRga
  type_sol_principal?: string | null
  mineraux_argileux?: string[] | null
  altitude_moyenne_m?: number | null
  source_donnees?: string | null

  nb_mailles_total: number
  nb_mailles_prio1: number
  nb_sondages_existants: number

  centroid_lon: number
  centroid_lat: number
}

export interface ZoneMaille {
  id: string
  maille_code: string
  pct_intersection: number
  priorite_recherche: number
  geojson: GeoJSON.Geometry

  nb_sondages: number
  nb_essais_vbs: number
  nb_essais_atterberg: number
  vbs_moyen?: number | null
  statut_donnees: 'aucune_donnee' | 'bien_documente' | 'partiellement_documente' | 'non_documente'
}

export const zonesEtudeApi = {
  async listZones(): Promise<ZoneEtude[]> {
    return apiGet<ZoneEtude[]>('/zones-etude')
  },

  async getZoneGeojson(code: string): Promise<{ geojson: GeoJSON.Geometry }> {
    return apiGet<{ geojson: GeoJSON.Geometry }>(`/zones-etude/${encodeURIComponent(code)}/geojson`)
  },

  async getZoneMailles(code: string, limit = 1000): Promise<ZoneMaille[]> {
    const url = apiUrl(`/zones-etude/${encodeURIComponent(code)}/mailles?limit=${encodeURIComponent(String(limit))}`)
    const res = await fetch(url)
    if (!res.ok) {
      const err = await res.json().catch(() => ({}))
      throw new Error(err.error || `Erreur zones-etude mailles (${res.status})`)
    }
    return res.json()
  },

  async exportZoneGeoPackage(code: string): Promise<Blob> {
    const url = apiUrl(`/exports/geopackage/zone/${encodeURIComponent(code)}`)
    const res = await fetch(url)
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(text || `Erreur export gpkg zone (${res.status})`)
    }
    return res.blob()
  }
}

