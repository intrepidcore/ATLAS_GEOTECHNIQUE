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
  synced_at?: string | null;
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
  notes?: string;
  point_name?: string;
  relocation_reason?: string;
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

export interface MobileNotification {
  id: string;
  notification_type: string;
  title: string;
  message: string | null;
  payload: Record<string, unknown>;
  mission_id: string | null;
  is_read: boolean;
  created_at: string;
}

export type LabJson = Record<string, unknown>;

export interface MobileLabResultInput {
  sondage_id: string;
  sample_code: string;
  depth_top_m: number;
  depth_bottom_m: number;
  sample: LabJson;
  tests: LabJson;
  status: 'draft' | 'complete';
}

export interface MobileLabResult extends MobileLabResultInput {
  id: string;
  mission_id: string;
  sondage_code: string | null;
  depth_m: number;
  horizon: string;
  created_at: string;
  updated_at: string;
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

  relocateSondagePoint: (missionId: string, pointId: string, data: CreateFieldSondageRequest) =>
    apiJson<ConfirmSondageResponse>(
      `/colab/mobile/missions/${missionId}/sondage-points/${pointId}/relocate`,
      { method: 'POST', body: JSON.stringify(data) }
    ),

  sync: (actions: SyncAction[]) =>
    apiJson<{ results: SyncActionResult[]; synced_count: number; failed_count: number }>(
      '/colab/mobile/sync',
      { method: 'POST', body: JSON.stringify({ actions }) }
    ),

  getProfile: () => apiJson<MobileProfile>('/colab/mobile/profile'),

  getNotifications: () => apiJson<{ notifications: MobileNotification[]; unread_count: number; total: number }>(
    '/colab/notifications?limit=50'
  ),

  markNotificationRead: (id: string) => apiJson<{ message: string }>(`/colab/notifications/${id}/read`, { method: 'POST' }),

  getLabResults: (missionId: string) =>
    apiJson<{ items: MobileLabResult[]; total: number }>(`/colab/missions/${missionId}/lab-results`),

  createLabResult: (missionId: string, data: MobileLabResultInput) =>
    apiJson<MobileLabResult>(`/colab/missions/${missionId}/lab-results`, {
      method: 'POST',
      body: JSON.stringify(data),
    }),

  registerPushToken: (expoToken: string, platform: 'ios' | 'android') =>
    apiJson<{ message: string }>('/colab/mobile/push-tokens', {
      method: 'POST',
      body: JSON.stringify({ expo_token: expoToken, platform }),
    }),
};
