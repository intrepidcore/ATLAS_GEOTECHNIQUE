import { apiJson } from './client';

export interface MobileMission {
  id: string;
  code: string;
  title: string;
  theme: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
  maille_id: string | null;
  maille_label: string | null;
  commune: string | null;
  region: string | null;
  expected_sondages: number;
  completed_sondages: number;
  percent_done: number;
}

export interface BoundingBox {
  min_x: number; min_y: number; max_x: number; max_y: number;
  center_lon: number; center_lat: number;
}

export interface PlannedPoint {
  id: string;
  numero: number;
  label: string | null;
  lat: number;
  lon: number;
  confirmed_sondage_id: string | null;
}

export interface SondageMarker {
  id: string;
  code: string | null;
  longitude: number;
  latitude: number;
  status: string | null;
}

export interface MapContext {
  mission_id: string;
  maille_geojson: GeoJSON.Geometry | null;
  center_lon: number | null;
  center_lat: number | null;
  bbox: BoundingBox | null;
  tolerance_m: number;
  planned_points: PlannedPoint[];
  existing_sondages: SondageMarker[];
}

export interface MobileMissionDetail {
  mission: MobileMission;
  supervisor_name: string | null;
  supervisor_email: string | null;
  team_members: { user_id: string; username: string; email: string; role: string }[];
  recent_sondages: {
    id: string; code_sondage: string | null; longitude: number | null; latitude: number | null;
    profondeur_atteinte: number | null; validation_status: string | null; created_at: string | null;
  }[];
  bbox: BoundingBox | null;
}

export interface CreateFieldSondageRequest {
  longitude: number;
  latitude: number;
  location_accuracy_m?: number;
  depth_m?: number;
  profile_description?: string;
  layers_count?: number;
  notes?: string;
}

export interface ConfirmSondageResponse {
  id: string | null;
  code_sondage: string | null;
  distance_m: number;
  tolerance_m: number;
  within_tolerance: boolean;
  message: string;
}

export interface MobileProfile {
  user_id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  roles: string[];
  permissions: string[];
  is_student: boolean;
  is_supervisor: boolean;
}

export interface SyncAction {
  client_id: string;
  action_type: string;
  payload: Record<string, unknown>;
}

export interface SyncActionResult {
  client_id: string;
  success: boolean;
  server_id: string | null;
  error: string | null;
}

export const mobileApi = {
  getMyMissions: () => apiJson<{ missions: MobileMission[]; count: number }>('/colab/mobile/missions'),

  getMissionDetail: (missionId: string) =>
    apiJson<MobileMissionDetail>(`/colab/mobile/missions/${missionId}`),

  getMapContext: (missionId: string) =>
    apiJson<MapContext>(`/colab/mobile/missions/${missionId}/map-context`),

  createFieldSondage: (missionId: string, data: CreateFieldSondageRequest) =>
    apiJson<{ id: string; code_sondage: string; message: string }>(
      `/colab/mobile/missions/${missionId}/sondages`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  confirmSondagePoint: (missionId: string, pointId: string, data: CreateFieldSondageRequest) =>
    apiJson<ConfirmSondageResponse>(
      `/colab/mobile/missions/${missionId}/sondage-points/${pointId}/confirm`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  sync: (actions: SyncAction[]) =>
    apiJson<{ results: SyncActionResult[]; synced_count: number; failed_count: number }>(
      '/colab/mobile/sync',
      { method: 'POST', body: JSON.stringify({ actions }) }
    ),

  getProfile: () => apiJson<MobileProfile>('/colab/mobile/profile'),

  registerPushToken: (expoToken: string, platform: 'ios' | 'android') =>
    apiJson<{ message: string }>('/colab/mobile/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ expo_token: expoToken, platform }),
    }),
};
