/**
 * Client API pour le géocodage
 * v2.5.0 - Phase UI-01
 */

import { httpJSON } from '../utils/http'
import { 
  SurveyToGeocode, 
  GeocodePayload, 
  GeocodeSuggestion, 
  GeocodeStats 
} from '../types/geocode'

export async function fetchSurveysWithoutGeom(apiUrl: string): Promise<SurveyToGeocode[]> {
  return httpJSON(`${apiUrl}/surveys/ungeocode`)
}

export async function geocodeSurvey(apiUrl: string, payload: GeocodePayload): Promise<void> {
  await httpJSON(`${apiUrl}/surveys/${payload.survey_id}/geocode`, {
    method: 'POST',
    body: JSON.stringify({
      method: payload.method,
      ...payload.data,
    }),
  })
}

export async function fetchSuggestions(apiUrl: string): Promise<GeocodeSuggestion[]> {
  return httpJSON(`${apiUrl}/geocode/suggestions`, {
    method: 'POST',
    body: JSON.stringify({ status: 'pending' }),
  })
}

export async function acceptSuggestion(apiUrl: string, id: string): Promise<void> {
  await httpJSON(`${apiUrl}/geocode/suggestions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'accepted' }),
  })
}

export async function rejectSuggestion(apiUrl: string, id: string): Promise<void> {
  await httpJSON(`${apiUrl}/geocode/suggestions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'rejected' }),
  })
}

export async function modifySuggestion(apiUrl: string, id: string, adm3Code: string): Promise<void> {
  await httpJSON(`${apiUrl}/geocode/suggestions/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ 
      status: 'accepted',
      adm3_code_override: adm3Code,
    }),
  })
}

export async function applyAcceptedSuggestions(apiUrl: string): Promise<{ updated: number }> {
  return httpJSON(`${apiUrl}/geocode/apply-accepted`, {
    method: 'POST',
  })
}

export async function fetchGeocodeStats(apiUrl: string): Promise<GeocodeStats> {
  return httpJSON(`${apiUrl}/geocode/stats`)
}
