/**
 * Types pour les détails de sondage - Cohérents avec l'API /sondages/:id/details
 */

export interface SurveyDetails {
  id: string;
  code: string;
  localite: string;

  adm3_id: number | null;
  adm3_name: string | null;

  is_geocoded: boolean;
  location_mode: string;
  meta?: {
    geocoded_mode?: string;
    [k: string]: any;
  };

  source: string;
  created_at: string;
  updated_at: string;

  coordinates?: { lat: number; lon: number };
  geom?: { type: string; coordinates: [number, number] };

  atterberg: AtterbergRow[];
  vbs: VbsRow[];
  granulometrie: GranuloSerie[];
  echantillons: EchantillonRow[];
}

export interface AtterbergRow {
  depth_m: number;
  wl?: number | null;
  wp?: number | null;
  ip?: number | null;
  echantillon_id?: string;
}

export interface VbsRow {
  depth_m: number;
  vbs?: number | null;
  echantillon_id?: string;
}

export interface GranuloPoint {
  sieve_mm: number;
  passing_pct: number;
}

export interface GranuloSerie {
  depth_m: number;
  method?: string | null;
  echantillon_id?: string;
  points: GranuloPoint[];
}

export interface EchantillonRow {
  id: string;
  depth_m: number;
  laboratory?: string | null;
  norm?: string | null;
  water_content_w?: number | null;
  rho_s_gcm3?: number | null;
}

/**
 * Utilitaire pour dédupliquer par profondeur
 */
export function dedupeByDepth<T extends { depth_m: number }>(rows: T[]): T[] {
  const map = new Map<number, T>();
  for (const r of rows) {
    if (!map.has(r.depth_m)) map.set(r.depth_m, r);
  }
  return [...map.values()].sort((a, b) => a.depth_m - b.depth_m);
}

/**
 * Calcule le badge de géocodage basé sur location_mode et geocoded_mode
 */
export function computeGeocodeBadge(locationMode: string, geocodedMode?: string): { label: string; type: 'auto' | 'manual' | 'unknown' } {
  // Priorité au geocoded_mode si disponible
  if (geocodedMode === 'suggestion_accepted') {
    return { label: 'AUTO (suggestion)', type: 'auto' };
  }
  if (geocodedMode === 'adm3') {
    return { label: 'MANUEL (ADM3)', type: 'manual' };
  }
  
  // Fallback sur location_mode
  if (locationMode === 'adm_random_cell') {
    return { label: 'AUTO', type: 'auto' };
  }
  if (locationMode === 'exact' || locationMode === 'gps') {
    return { label: 'MANUEL', type: 'manual' };
  }
  if (locationMode === 'adm3_centroid') {
    return { label: 'MANUEL (centroïde)', type: 'manual' };
  }
  
  return { label: 'INCONNU', type: 'unknown' };
}
