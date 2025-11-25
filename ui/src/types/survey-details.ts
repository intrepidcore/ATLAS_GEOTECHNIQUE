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
  classif: ClassifRow[];
  gonflement: GonflementRow[];
  physiques: PhysiquesRow[];
  proctor: ProctorRow[];
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
  rho_s_gcm3?: number | null;
  water_content_w?: number | null;
  date?: string | null;
}

export interface ClassifRow {
  id: string;
  depth_m: number;
  systeme?: string | null;
  classe?: string | null;
  hrb?: string | null;
  unified?: string | null;
  class_chassagneux?: string | null;
  class_daksha?: string | null;
  class_seed?: string | null;
  class_vijay?: string | null;
  type_sol?: string | null;
  cg?: number | null;
  cg_qual?: string | null;
  echantillon_id?: string;
}

export interface GonflementRow {
  id: string;
  depth_m: number;
  cg?: number | null;
  cg_qual?: string | null;
  type_sol?: string | null;
  echantillon_id?: string;
}

export interface PhysiquesRow {
  id: string;
  depth_m: number;
  densite_apparente_gcm3?: number | null;
  densite_absolue_gcm3?: number | null;
  teneur_eau_pct?: number | null;
  w?: number | null;
  rho_s?: number | null;
  laboratory?: string | null;
  measured_at?: string | null;
  echantillon_id?: string;
}

export interface ProctorRow {
  id: string;
  depth_m: number;
  rho_d_max?: number | null;
  w_opt?: number | null;
  laboratory?: string | null;
  test_date?: string | null;
  echantillon_id?: string;
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

export type GeocodeBadgeType = 'auto' | 'manual' | 'unknown';

export interface GeocodeBadgeResult {
  label: string;
  type: GeocodeBadgeType;
  score?: number;
}

/**
 * Calcule le badge de géocodage basé sur location_mode et geocoded_mode
 * Règles v3.3:
 * - AUTO: geocoded_mode='suggestion_accepted' avec score >= 0.8
 * - MANUEL: geocoded_mode in {'adm3', 'gps', 'manual_override'} ou location_mode='exact'
 * - UNKNOWN: sinon
 */
export function computeGeocodeBadge(
  locationMode: string,
  geocodedMode?: string | null,
  geocodedScore?: number | null
): GeocodeBadgeResult {
  // Priorité au geocoded_mode si disponible
  if (geocodedMode === 'suggestion_accepted') {
    const score = geocodedScore ?? 0;
    if (score >= 0.8) {
      return { label: 'AUTO', type: 'auto', score };
    }
    // Score faible = considéré comme manuel (validation humaine requise)
    return { label: 'AUTO (score faible)', type: 'auto', score };
  }
  
  if (geocodedMode === 'adm3' || geocodedMode === 'gps' || geocodedMode === 'manual_override') {
    return { label: 'MANUEL', type: 'manual' };
  }
  
  // Fallback sur location_mode
  if (locationMode === 'adm_random_cell') {
    return { label: 'AUTO', type: 'auto' };
  }
  if (locationMode === 'exact' || locationMode === 'gps') {
    return { label: 'MANUEL', type: 'manual' };
  }
  if (locationMode === 'adm3_centroid') {
    return { label: 'MANUEL', type: 'manual' };
  }
  
  return { label: 'INCONNU', type: 'unknown' };
}

/**
 * Version simplifiée pour la liste des sondages
 * Utilise les champs geocoded_mode et geocoded_score exposés par l'API
 * 
 * RÈGLES MÉTIER v3.3:
 * - AUTO: geocoded_mode='suggestion_accepted' avec score >= 80%
 * - MANUEL: geocoded_mode in {'adm3', 'gps', 'manual_override'} OU score < 80%
 * - UNKNOWN: non géocodé ou cas non couverts
 */
export function computeGeocodeBadgeFromSurvey(survey: {
  is_geocoded: boolean;
  location_mode?: string | null;
  geocoded_mode?: string | null;
  geocoded_score?: number | null;
  meta?: { geocoded_mode?: string } | null;
}): GeocodeBadgeType {
  if (!survey.is_geocoded) return 'unknown';
  
  // Utiliser les champs directs de l'API (prioritaire)
  const mode = survey.geocoded_mode ?? survey.meta?.geocoded_mode ?? null;
  const score = survey.geocoded_score ?? 0;
  
  // RÈGLE AUTO: suggestion acceptée avec score >= 80%
  if (mode === 'suggestion_accepted' && score >= 80) return 'auto';
  
  // RÈGLE MANUEL: modes manuels OU score faible
  if (mode === 'adm3' || mode === 'gps' || mode === 'manual_override') return 'manual';
  if (mode === 'suggestion_accepted' && score < 80) return 'manual'; // Score faible = validation humaine
  
  // Fallback sur location_mode (legacy)
  if (survey.location_mode === 'adm_random_cell') return 'auto';
  if (survey.location_mode === 'exact' || survey.location_mode === 'gps') return 'manual';
  if (survey.location_mode === 'adm3_centroid') return 'manual';
  
  return 'unknown';
}
