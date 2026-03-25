// API client pour surveys canoniques (unifiés)

export interface SurveyCanon {
  id: string;
  code: string;
  localite_canon: string;
  localite: string | null;
  localite_key: string | null;
  source: string | null;
  adm3_id: number | null;
  adm3_name: string | null;
  adm2_name: string | null;
  adm1_name: string | null;
  geom: Record<string, unknown> | null;
  geom_geojson: Record<string, unknown> | null;
  location_mode: string | null;
  location_accuracy: string | null;
  is_geocoded: boolean;
  has_geom: boolean;
  has_adm3: boolean;
  date: string | null;
  date_sondage: string | null;
  operator: string | null;
  notes: string | null;
  comment: string | null;
  meta: string | null;
  nb_sondages_source: number;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface SurveyCanonStats {
  total: number;
  geocoded: number;
  with_geom: number;
  with_adm3: number;
}

export interface SurveyCanonQuery {
  limit?: number;
  offset?: number;
  search?: string;
  missing?: 'geom' | 'adm3';
}

// ============================================================================
// BASE API - Utilise le module centralisé api-base
// ============================================================================

import { buildApiUrl as buildUrl, API_BASE } from '../api-base'

console.log('[surveys-canon] ✓ API_BASE:', API_BASE)

// Alias pour compatibilité interne
const buildApiUrl = buildUrl

export async function apiGet<T>(path: string, params?: Record<string, any>): Promise<T> {
  let url = buildApiUrl(path);
  
  // Ajouter les query params si présents
  if (params && Object.keys(params).length > 0) {
    const searchParams = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null) {
        searchParams.set(k, String(v));
      }
    });
    const queryString = searchParams.toString();
    if (queryString) {
      url += '?' + queryString;
    }
  }
  
  console.debug('[API] GET', url);
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${url}`);
  }
  return res.json() as Promise<T>;
}

export async function apiPatch<T>(path: string, body: any): Promise<T> {
  const urlString = buildApiUrl(path);
  const res = await fetch(urlString, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HTTP ${res.status}: ${error}`);
  }
  return res.json() as Promise<T>;
}

export async function apiDelete(path: string): Promise<void> {
  const urlString = buildApiUrl(path);
  const res = await fetch(urlString, {
    method: 'DELETE',
  });
  if (!res.ok) {
    const error = await res.text();
    throw new Error(`HTTP ${res.status}: ${error}`);
  }
}

export async function listSurveysCanon(query?: SurveyCanonQuery): Promise<SurveyCanon[]> {
  return apiGet<SurveyCanon[]>('/surveys-canon', query);
}

export async function getSurveyCanon(id: string): Promise<SurveyCanon> {
  return apiGet<SurveyCanon>(`/surveys-canon/${id}`);
}

export async function resolveSurveyAlias(code: string): Promise<SurveyCanon> {
  return apiGet<SurveyCanon>('/surveys-canon/resolve', { search: code });
}

export async function getSurveyCanonStats(): Promise<SurveyCanonStats> {
  return apiGet<SurveyCanonStats>('/surveys-canon/stats');
}

// Helper pour déterminer le statut de localisation
export function getLocationStatus(survey: SurveyCanon): 'precise' | 'adm3' | 'missing' {
  if (survey.has_geom) return 'precise';
  if (survey.has_adm3) return 'adm3';
  return 'missing';
}

export function getLocationLabel(survey: SurveyCanon): string {
  const status = getLocationStatus(survey);
  switch (status) {
    case 'precise': return 'Précise';
    case 'adm3': return 'Par commune (ADM3)';
    case 'missing': return 'Manquante';
  }
}

// ============================================================================
// TYPES POUR GÉOCODAGE
// ============================================================================

export interface Adm3Candidate {
  adm3_id: number;
  gid: number;
  name: string;
  code: string | null;
  adm2_name: string | null;
  score: number;
}

export interface Adm3CandidatesResponse {
  survey_id: string;
  localite: string;
  candidates: Adm3Candidate[];
}

export interface UpdateGeometryPayload {
  mode: 'exact' | 'adm';
  geom?: { type: 'Point'; coordinates: [number, number] };
  adm3_id?: number;
}

// ============================================================================
// ENDPOINTS GÉOCODAGE
// ============================================================================

export async function getAdm3Candidates(surveyId: string): Promise<Adm3CandidatesResponse> {
  return apiGet<Adm3CandidatesResponse>(`/surveys-canon/${surveyId}/adm3-candidates`);
}

export async function updateSurveyGeometry(
  surveyId: string,
  payload: UpdateGeometryPayload
): Promise<SurveyCanon> {
  const urlString = buildApiUrl(`/surveys-canon/${surveyId}/geometry`);
  const response = await fetch(urlString, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  
  if (!response.ok) {
    const error = await response.text();
    throw new Error(`HTTP ${response.status}: ${error}`);
  }
  
  return response.json();
}
