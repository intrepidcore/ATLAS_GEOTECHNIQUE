// API client pour les sondages individuels (géocodage unitaire)

import { apiGet, apiPatch } from './surveys-canon';
import type { Survey } from '../types/survey';

// ============================================================================
// TYPES
// ============================================================================

export type Sondage = Survey;

export interface SondagesStats {
  total: number;
  geocoded: number;
  with_geom: number;
  with_adm3: number;
  missing_geom: number;
  missing_adm3: number;
}

export interface Adm3Candidate {
  adm3_id: number;
  gid: number;
  name: string;
  code: string;
  adm2_name: string;
  score: number;
}

export interface Adm3CandidatesResponse {
  survey_id: string;
  localite: string | null;
  candidates: Adm3Candidate[];
}

export interface UpdateGeometryPayload {
  mode: 'exact' | 'adm';
  geom?: any;
  adm3_id?: number;
}

export interface LegacyLookupItem {
  new_code: string;
  coverage_pct: number;
  match_type: string;
}

export interface MailleFeature {
  type: 'Feature';
  geometry: {
    type: string;
    coordinates: any;
  };
  properties: Record<string, any>;
}

// ============================================================================
// API FUNCTIONS
// ============================================================================

/**
 * Liste les sondages avec pagination et filtres
 */
export async function listSondages(params?: {
  limit?: number;
  offset?: number;
  search?: string;
  missing?: 'geom' | 'adm3';
  grid_code?: string; // Filtre par code maille
}): Promise<Sondage[]> {
  return apiGet<Sondage[]>('/sondages', params);
}

/**
 * Récupère les statistiques globales des sondages
 */
export async function getSondagesStats(): Promise<SondagesStats> {
  return apiGet<SondagesStats>('/sondages/stats');
}

/**
 * Récupère un sondage par son ID
 */
export async function getSondage(id: string): Promise<Sondage> {
  return apiGet<Sondage>(`/sondages/${id}`);
}

/**
 * Récupère les candidats ADM3 pour un sondage
 */
export async function getAdm3Candidates(id: string): Promise<Adm3CandidatesResponse> {
  return apiGet<Adm3CandidatesResponse>(`/sondages/${id}/adm3-candidates`);
}

/**
 * Met à jour la géométrie d'un sondage (point exact ou ADM3)
 */
export async function updateSondageGeometry(
  id: string,
  payload: UpdateGeometryPayload
): Promise<Sondage> {
  console.log('[SONDAGES] updateSondageGeometry - ID:', id);
  console.log('[SONDAGES] updateSondageGeometry - Payload:', JSON.stringify(payload, null, 2));
  return apiPatch<Sondage>(`/sondages/${id}/geometry`, payload);
}

/**
 * Recherche legacy : ancien code maille -> nouveau code (Grille V2)
 */
export async function legacyLookupGridCode(code: string): Promise<LegacyLookupItem[]> {
  return apiGet<LegacyLookupItem[]>(`/search/legacy/${encodeURIComponent(code)}`);
}

/**
 * Récupère une maille GeoJSON par son code
 */
export async function getMailleFeature(code: string): Promise<MailleFeature> {
  return apiGet<MailleFeature>(`/maille/${encodeURIComponent(code)}`);
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Extrait la localité depuis le code (ex: "GRANULO-KOMAH" -> "KOMAH")
 */
export function extractLocaliteFromCode(code: string): string | null {
  if (!code) return null;
  const parts = code.split('-');
  if (parts.length < 2) return null;
  return parts[parts.length - 1];
}

/**
 * Formate le label de géocodage
 */
export function formatGeocodeLabel(sondage: Sondage): string {
  return sondage.is_geocoded ? 'Oui' : 'Non';
}

/**
 * Formate le mode de localisation
 */
export function formatLocationMode(mode: string | null): string {
  switch (mode) {
    case 'exact':
      return 'Point exact';
    case 'adm_random_cell':
      return 'Commune (ADM3)';
    case 'unknown':
    default:
      return 'Inconnu';
  }
}
