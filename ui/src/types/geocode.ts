/**
 * Types pour le géocodage et les suggestions
 * v2.5.0 - Phase UI-01
 */

export interface SurveyToGeocode {
  id: string;
  code: string;
  source: string | null;
  location_mode: string | null;
  adm1_name: string | null;
  adm2_name: string | null;
  adm3_name: string | null;
  adm1_id: string | null;
  adm2_id: string | null;
  adm3_id: number | null;
  adm3_code: string | null;
  localite: string | null;
  localite_key: string | null;
  is_geocoded: boolean;
  geom: Record<string, unknown> | null;
  created_at: string;
  updated_at: string | null;
  deleted_at: string | null;
  meta: string | null;
  import_id: string | null;
  import_row_idx: string | null;
  created_by_batch: string | null;
  updated_by_batch: string | null;
  n_essais: number;
}

export type GeocodeMethod = 'exact' | 'adm_random_cell';

export interface GeocodePayload {
  survey_id: string;
  method: GeocodeMethod;
  data: ExactGeocodeData | AdmGeocodeData;
}

export interface ExactGeocodeData {
  latitude: number;
  longitude: number;
}

export interface AdmGeocodeData {
  adm_level: 'ADM1' | 'ADM2' | 'ADM3';
  adm_code: string;
}

export interface GeocodeSuggestion {
  id: string;
  sondage_id: string;
  code_site: string;
  localite: string;
  normalized_localite: string;
  status: 'pending' | 'accepted' | 'rejected';
  score_pct: number | null;
  method: 'synonym' | 'candidate' | null;
  top_candidate: SuggestionCandidate | null;
  other_candidates: SuggestionCandidate[];
  created_at: string;
  updated_at: string;
}

export interface SuggestionCandidate {
  adm3_code: string;
  adm3_name: string;
  prefecture: string;
  score_pct: number;
}

export interface GeocodeStats {
  total_surveys: number;
  without_geom: number;
  with_spread: number;
  suggestions_pending: number;
  suggestions_accepted: number;
  suggestions_rejected: number;
}
