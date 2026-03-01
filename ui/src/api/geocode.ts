// API Client pour le géocodage - NOUVELLE VERSION
export type Suggestion = {
  id: string; // UUID maintenant
  sondage_id: string;
  reason: string;
  status: 'pending' | 'done' | 'rejected';
  payload: {
    code: string;
    source: string;
    adm3_id: string | null;
    adm3_name: string | null;
    localite_key: string;
    localite_base: string;
  };
  is_unnormalized: boolean;
  created_at: string;
  updated_at: string;
};

export type SondageWithoutGeometry = {
  id: string;
  code: string;
  localite: string | null;
  adm3_id: string | null;
  adm3_name: string | null;
  location_mode: string | null;
  created_at: string;
};

export type ManualGeocodeStats = {
  total_without_geom: number;
  total_geocoded: number;
  percent_done: number;
};

export type GeocodeStats = {
  total: number;
  accepted: number;
  pending: number;
  rejected: number;
  no_suggestion: number;
};

export type ApplyAcceptedResponse = {
  applied_count: number;
  refreshed: boolean;
};

// Helper pour construire les URLs API - utilise le module centralisé
import { buildApiUrl } from '../api-base'

function buildUrl(path: string): string {
  return buildApiUrl(path)
}

const BASE = '/api/geocode';

export async function getStats(): Promise<GeocodeStats> {
  const r = await fetch(buildUrl(`${BASE}/stats`));
  if (!r.ok) throw new Error('Failed to fetch stats');
  return r.json();
}

export async function listSuggestions(params?: {
  status?: string;
  reason?: string;
  limit?: number;
  offset?: number;
}): Promise<Suggestion[]> {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(buildUrl(`${BASE}/suggestions${q ? `?${q}` : ''}`));
  if (!r.ok) throw new Error('Failed to list suggestions');
  return r.json();
}

export async function accept(
  id: string,
  payload: { adm3_id?: string; lon?: number; lat?: number }
): Promise<Suggestion> {
  const r = await fetch(buildUrl(`${BASE}/suggestions/${id}/accept`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(error || 'Failed to accept suggestion');
  }
  return r.json();
}

export async function reject(id: string): Promise<Suggestion> {
  const r = await fetch(buildUrl(`${BASE}/suggestions/${id}/reject`), {
    method: 'POST',
  });
  if (!r.ok) throw new Error('Failed to reject suggestion');
  return r.json();
}

export async function applyAccepted(): Promise<ApplyAcceptedResponse> {
  const r = await fetch(buildUrl(`${BASE}/apply-accepted`), {
    method: 'POST',
  });
  if (!r.ok) throw new Error('Failed to apply accepted suggestions');
  return r.json();
}

// Backward compatibility - deprecated
export async function updateAdm3(id: string, adm3_id: string): Promise<Suggestion> {
  console.warn('updateAdm3 is deprecated, use accept() instead');
  return accept(id, { adm3_id });
}

// ============================================================================
// Manual Geocoding API
// ============================================================================

export async function listWithoutGeometry(params?: {
  limit?: number;
  offset?: number;
  search?: string;
}): Promise<SondageWithoutGeometry[]> {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(buildUrl(`${BASE}/manual${q ? `?${q}` : ''}`));
  if (!r.ok) throw new Error('Failed to list sondages without geometry');
  return r.json();
}

export async function updateGeometry(
  id: string,
  payload: {
    lon?: number;
    lat?: number;
    adm3_id?: string;
    location_mode: 'exact' | 'adm';
  }
): Promise<void> {
  const r = await fetch(buildUrl(`${BASE}/manual/${id}`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(error || 'Failed to update geometry');
  }
}

export async function getManualStats(): Promise<ManualGeocodeStats> {
  const r = await fetch(buildUrl(`${BASE}/manual/stats`));
  if (!r.ok) throw new Error('Failed to fetch manual geocode stats');
  return r.json();
}

// ============================================================================
// Nouvelle API Sondages & Suggestions (api-geo)
// ============================================================================

export type SondageGeocode = {
  id: string;
  code: string;
  localite: string | null;
  adm3_id: number | null;
  adm3_name: string | null;
  location_mode: string | null;
  is_geocoded: boolean;
};

export type GeocodeRequest = 
  | { mode: 'adm3'; adm3_id: number }
  | { mode: 'coords'; lon: number; lat: number };

export type SuggestionItem = {
  id: string;
  entity: string;
  entity_id: string;
  localite: string;
  adm2_code: string | null;
  candidates: string | null;
  top_code: string;
  top_score: string;
  top_method: string;
  status: 'pending' | 'accepted' | 'rejected';
  created_at: string;
  decided_at: string | null;
};

export type SuggestionStats = {
  total: number;
  pending: number;
  accepted: number;
  rejected: number;
};

/**
 * Géocoder un sondage (ADM3 ou coordonnées exactes)
 */
export async function geocodeSondageAdm3(
  sondageId: string, 
  adm3Gid: number, 
  placement: string = 'adm_random_cell'
): Promise<SondageGeocode> {
  const r = await fetch(buildUrl(`/sondages/${sondageId}/geocode`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'adm3', adm3_id: adm3Gid, placement }),
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(error || 'Failed to geocode with ADM3');
  }
  return r.json();
}

export async function geocodeSondageCoords(
  sondageId: string,
  lon: number,
  lat: number
): Promise<SondageGeocode> {
  const r = await fetch(buildUrl(`/sondages/${sondageId}/geocode`), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ mode: 'coords', lon, lat }),
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(error || 'Failed to geocode with coordinates');
  }
  return r.json();
}

/**
 * Lister les suggestions de géocodage
 */
export async function listGeocodeSuggestions(params?: {
  sondage_id?: string;
  status?: string;
  limit?: number;
}): Promise<SuggestionItem[]> {
  const q = new URLSearchParams(params as any).toString();
  const r = await fetch(buildUrl(`/suggestions${q ? `?${q}` : ''}`));
  if (!r.ok) throw new Error('Failed to list suggestions');
  return r.json();
}

/**
 * Statistiques des suggestions
 */
export async function getSuggestionStats(): Promise<SuggestionStats> {
  const r = await fetch(buildUrl('/suggestions/stats'));
  if (!r.ok) throw new Error('Failed to fetch suggestion stats');
  return r.json();
}

/**
 * Accepter une suggestion (géocode automatiquement le sondage)
 */
export async function acceptSuggestion(id: string): Promise<{ success: boolean; sondage_id: string; adm3_pcode: string }> {
  const r = await fetch(buildUrl(`/suggestions/${id}/accept`), {
    method: 'POST',
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(error || 'Failed to accept suggestion');
  }
  return r.json();
}

/**
 * Rejeter une suggestion
 */
export async function rejectSuggestion(id: string): Promise<{ success: boolean }> {
  const r = await fetch(buildUrl(`/suggestions/${id}/reject`), {
    method: 'POST',
  });
  if (!r.ok) {
    const error = await r.text();
    throw new Error(error || 'Failed to reject suggestion');
  }
  return r.json();
}
