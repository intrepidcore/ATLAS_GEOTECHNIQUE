/**
 * Service API pour Atlas Colab
 * Gestion des missions terrain, étudiants et superviseurs
 */

import { API_BASE_URL } from './api';
import { tokenStorage } from './auth-api';

// ============================================================================
// Types
// ============================================================================

export interface MissionListItem {
  id: string;
  code: string;
  title: string;
  theme: string;
  status: string;
  maille_id: string | null;
  zone_label: string | null;
  commune: string | null;
  region: string | null;
  start_date: string | null;
  end_date: string | null;
  expected_sondages: number;
  supervisor_id: string | null;
  supervisor_name: string | null;
  assigned_students_count: number;
  linked_sondages_count: number;
  field_logs_count: number;
  documents_count: number;
  // Mission-driven operational status (computed by backend)
  operational_status: string;
  operational_reason: string | null;
  operational_issues?: OperationalIssue[];
  conflict_holder_email: string | null;
  conflict_holder_name: string | null;
  conflict_mission_id: string | null;
  created_at: string;
  updated_at: string;
}

export type OperationalIssueSeverity = 'warning' | 'blocked';
export type OperationalIssueScope = 'mission' | 'student' | 'maille' | 'assignment';

export interface OperationalAction {
  code: string;
  label: string;
  payload?: any;
}

export interface OperationalIssue {
  code: string;
  severity: OperationalIssueSeverity;
  scope: OperationalIssueScope;
  message: string;
  actions: OperationalAction[];
}

export interface MissionListResponse {
  missions: MissionListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface UnassignMissionMailleResponse {
  mission_id: string;
  ex_maille_code: string | null;
  status: string;
}

export interface ReassignMissionRequest {
  new_maille_id: string;
  student_id: string;
}

export interface ReassignMissionResponse {
  old_mission_id: string;
  new_mission_id: string;
  new_maille_id: string;
  status: string;
}

export interface MailleActiveMissionItem {
  mission_id: string;
  mission_code: string;
  student_id: string | null;
  student_name: string | null;
  assigned_at: string | null;
}

export interface MailleActiveMissionsResponse {
  maille_id: string;
  missions: MailleActiveMissionItem[];
}

export interface SupervisorSummary {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  specialite: string | null;
  institution: string | null;
  is_active: boolean;
}

export interface CreateSupervisorRequest {
  email: string;
  first_name: string;
  last_name: string;
  titre?: string;
  institution?: string;
  departement?: string;
  specialite?: string;
  telephone?: string;
  notes?: string;
}

export interface CreateSupervisorResponse {
  success: boolean;
  supervisor_id: string;
  user_id: string;
  temp_password: string;
}

export interface UpdateSupervisorRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  titre?: string;
  institution?: string;
  departement?: string;
  specialite?: string;
  telephone?: string;
  notes?: string;
  is_active?: boolean;
}

export interface UserSummary {
  id: string;
  username: string;
  email: string;
  full_name: string | null;
}

export interface AssignedStudent {
  assignment_id: string;
  student_id: string;
  user_id: string;
  username: string;
  full_name: string;
  matricule: string | null;
  promotion: string;
  role: string;
  assigned_at: string;
}

export interface LinkedSondage {
  link_id: string;
  sondage_id: string;
  sondage_code: string | null;
  role: string;
  linked_at: string;
}

export interface MissionDetail extends MissionListItem {
  description: string | null;
  objectifs: string | null;
  notes_internal: string | null;
  supervisor: SupervisorSummary | null;
  created_by: UserSummary | null;
  assigned_students: AssignedStudent[];
  linked_sondages: LinkedSondage[];
}

export interface MailleSuggestItem {
  id: string;
  code: string;
  adm1_name: string | null;
  adm2_name: string | null;
  adm3_name: string | null;
}

export const communesApi = {
  async suggest(q: string): Promise<string[]> {
    const params = new URLSearchParams();
    params.append('q', q);
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/communes/suggest?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suggestion communes');
    }

    return response.json();
  },
};

export const regionsApi = {
  async suggest(q: string): Promise<string[]> {
    const params = new URLSearchParams();
    params.append('q', q);
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/regions/suggest?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suggestion régions');
    }

    return response.json();
  },
};

export interface ColabDocument {
  id: string;
  mission_id: string;
  uploaded_by: string;
  title: string;
  document_type: string;
  description: string | null;
  file_path: string;
  file_name: string;
  file_size_bytes: number | null;
  mime_type: string | null;
  sondage_id: string | null;
  version: number;
  is_current: boolean;
  uploaded_at: string;
  notes: string | null;
}

export interface ColabDocumentsListResponse {
  documents: ColabDocument[];
  total: number;
}

export interface UserSuggestItem {
  id: string;
  label: string;
}

export interface CreateMissionRequest {
  code: string;
  title: string;
  theme: string;
  maille_id?: string;
  zone_label?: string;
  commune?: string;
  region?: string;
  supervisor_id?: string;
  assigned_student_ids?: string[];
  expected_sondages?: number;
  start_date?: string;
  end_date?: string;
  description?: string;
  objectifs?: string;
  notes_internal?: string;
}

export interface UpdateMissionRequest {
  title?: string;
  theme?: string;
  status?: string;
  maille_id?: string;
  zone_label?: string;
  commune?: string;
  region?: string;
  supervisor_id?: string;
  expected_sondages?: number;
  start_date?: string;
  end_date?: string;
  description?: string;
  objectifs?: string;
  notes_internal?: string;
}

export interface MissionFilters {
  theme?: string;
  status?: string;
  commune?: string;
  region?: string;
  promotion?: string;
  supervisor_id?: string;
  search?: string;
  page?: number;
  per_page?: number;
}

export interface ResolveConflictRequest {
  action: string;
  payload?: any;
}

export interface ColabStats {
  total_missions: number;
  missions_by_status: { status: string; count: number }[];
  missions_by_theme: { theme: string; count: number }[];
  total_students: number;
  total_supervisors: number;
  total_field_logs: number;
  total_documents: number;
}

export type ExportFormat = 'csv' | 'json' | 'xlsx' | 'pdf' | 'geojson';

export type ExportDataSource =
  | 'missions'
  | 'students'
  | 'supervisors'
  | 'documents'
  | 'logs'
  | 'missions_students_supervisors'
  | 'missions_documents'
  | 'students_missions'
  | 'logs_missions';

export interface ExportDateRange {
  start: string;
  end: string;
}

export interface ExportFilters {
  date_range?: ExportDateRange;
  status?: string[];
  theme?: string[];
  region_id?: number;
  commune_id?: number;
  maille_id?: string;
  student_id?: string;
  supervisor_id?: string;
}

export interface ExportRequest {
  source: ExportDataSource;
  filters: ExportFilters;
  format: ExportFormat;
  template_id?: string | null;
  columns?: string[] | null;
  pdf_options?: {
    title?: string | null;
    orientation?: string | null;
  } | null;
}

export interface ExportTemplate {
  id: string;
  name: string;
  description: string | null;
  source: ExportDataSource;
  format: ExportFormat;
  template_sql: string | null;
  template_handlebars: string | null;
  created_by: string;
  created_at: string;
  updated_at: string;
  is_active: boolean;
}

export interface ListExportTemplatesResponse {
  templates: ExportTemplate[];
  total: number;
}

export interface CreateExportTemplateRequest {
  name: string;
  description?: string | null;
  source: ExportDataSource;
  format: ExportFormat;
  template_sql?: string | null;
  template_handlebars?: string | null;
}

export interface UpdateExportTemplateRequest {
  name?: string;
  description?: string | null;
  source?: ExportDataSource;
  format?: ExportFormat;
  template_sql?: string | null;
  template_handlebars?: string | null;
  is_active?: boolean;
}

export interface ExportSchedule {
  id: string;
  name: string;
  description: string | null;
  source: string;
  format: string;
  filters: any;
  template_id: string | null;
  cron: string;
  timezone: string;
  next_run_at: string | null;
  last_run_at: string | null;
  destinations: any;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface ListExportSchedulesResponse {
  schedules: ExportSchedule[];
  total: number;
}

export interface CreateExportScheduleRequest {
  name: string;
  description?: string | null;
  source: string;
  format: string;
  filters?: any;
  template_id?: string | null;
  cron: string;
  timezone?: string;
  destinations?: any;
}

export interface UpdateExportScheduleRequest {
  name?: string;
  description?: string | null;
  source?: string;
  format?: string;
  filters?: any;
  template_id?: string | null;
  cron?: string;
  timezone?: string;
  destinations?: any;
  is_active?: boolean;
}

export interface AttributionsSummary {
  total_missions: number;
  total_assignments: number;
  total_students: number;
  missions_with_student: number;
  pending_notifications: number;
}

export type AttributionNotificationStatus = 'sent' | 'pending' | 'failed' | 'never' | 'skipped' | 'unassigned';

export type AttributionStatus = 'unassigned' | 'assigned_not_notifiable' | 'notifiable' | 'notified' | 'error';

export interface AttributionItem {
  mission_id: string;
  mission_code: string;
  mission_title: string;
  mission_status: string;
  maille_id: string;
  maille_code: string;
  student_uuid: string | null;
  student_id: string | null;
  full_name: string | null;
  email: string | null;
  assignment_id: string | null;
  adm_code_used: string | null;
  pref_rank_used: number | null;
  assigned_at: string | null;

  notification_status: AttributionNotificationStatus;
  notification_requested_at: string | null;
  notification_sent_at: string | null;
  notification_error: string | null;

  attribution_status: AttributionStatus;
  status_reason: string | null;
}

export interface ListAttributionsResponse {
  items: AttributionItem[];
  total: number;
}

export interface EnqueueAttributionsNotificationsRequest {
  assignment_ids: string[];
  include_bbox?: boolean;
  include_instructions?: boolean;
}

export interface EnqueueAttributionsNotificationsResponse {
  success: boolean;
  job_id: string;
  count: number;
}

export interface AssignAttributionRequest {
  mission_id: string;
  student_id: string;
}

export interface AssignAttributionResponse {
  success: boolean;
  assignment_id: string;
}

export interface AttributionNotificationHistoryItem {
  id: string;
  assignment_id: string;
  email_job_id: string | null;
  status: string;
  options: any;
  requested_at: string;
  sent_at: string | null;
  error: string | null;
  student_id: string;
  full_name: string;
  email: string | null;
  maille_code: string;
}

export interface AttributionNotificationHistoryResponse {
  items: AttributionNotificationHistoryItem[];
  total: number;
}

export type ExportJobStatus = 'pending' | 'running' | 'completed' | 'failed';

export interface ExportJobResponse {
  job_id: string;
  status: ExportJobStatus;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  file_path: string | null;
  file_size: number | null;
  format: ExportFormat;
  source: ExportDataSource;
  error: string | null;
}

export type NotifyJobStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';

export interface NotifyJob {
  id: string;
  job_type: string;
  status: NotifyJobStatus;
  created_by: string | null;
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  error: string | null;
  params: any;
}

export interface CreateNotifyJobRequest {
  job_type?: string;
  params?: any;
}

export interface CreateNotifyJobResponse {
  job: NotifyJob;
}

export interface ListNotifyJobsResponse {
  jobs: NotifyJob[];
  total: number;
}

export interface GetNotifyJobResponse {
  job: NotifyJob;
  logs: Array<{
    level: 'info' | 'warn' | 'error';
    message: string;
    details: any;
    created_at: string;
  }>;
}

export interface Student {
  id: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  telephone?: string | null;
  deleted_at?: string | null;
  user_deleted_at?: string | null;
  matricule: string | null;
  promotion: string;
  filiere: string | null;
  etablissement: string | null;
  niveau: string | null;
  age?: number | null;
  is_active: boolean;
  active_missions: number;
  active_mailles: number;
}

export interface CreateStudentRequest {
  email: string;
  first_name: string;
  last_name: string;
  telephone?: string;
  matricule?: string;
  promotion: string;
  filiere?: string;
  etablissement?: string;
  niveau?: string;
  age?: number;
}

export interface CreateStudentResponse {
  success: boolean;
  student_id: string;
  user_id: string;
  temp_password: string;
}

export interface UpdateStudentRequest {
  email?: string;
  first_name?: string;
  last_name?: string;
  telephone?: string;
  matricule?: string;
  promotion?: string;
  filiere?: string;
  etablissement?: string;
  niveau?: string;
  age?: number;
  is_active?: boolean;
}

export interface StudentPrefs {
  student_id: string;
  adm_code_pref_1: string | null;
}

export interface UpdateStudentPrefsRequest {
  adm_code_pref_1?: string;
}

// ============================================================================
// Constantes
// ============================================================================

export const MISSION_THEMES = [
  { value: 'stabilisation', label: 'Stabilisation' },
  { value: 'synthese', label: 'Synthèse' },
  { value: 'reconnaissance', label: 'Reconnaissance' },
  { value: 'etude_detaillee', label: 'Étude détaillée' },
  { value: 'controle', label: 'Contrôle' },
];

export const MISSION_STATUSES = [
  { value: 'draft', label: 'Brouillon', color: 'bg-gray-100 text-gray-800' },
  { value: 'planned', label: 'Planifiée', color: 'bg-blue-100 text-blue-800' },
  { value: 'in_progress', label: 'En cours', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'completed', label: 'Terminée', color: 'bg-green-100 text-green-800' },
  { value: 'cancelled', label: 'Annulée', color: 'bg-red-100 text-red-800' },
  { value: 'suspended', label: 'Suspendue', color: 'bg-orange-100 text-orange-800' },
];

// ============================================================================
// Helper
// ============================================================================

async function fetchWithAuth(url: string, options: RequestInit = {}): Promise<Response> {
  const token = tokenStorage.getAccessToken();
  const headers: HeadersInit = {
    ...(options.headers || {}),
  };

  const hasContentTypeHeader =
    typeof (headers as any)?.get === 'function'
      ? (headers as any).get('Content-Type')
      : (headers as Record<string, string>)['Content-Type'];

  const isFormData = typeof FormData !== 'undefined' && options.body instanceof FormData;

  if (!hasContentTypeHeader && !isFormData) {
    (headers as Record<string, string>)['Content-Type'] = 'application/json';
  }
  
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }
  
  return fetch(url, { ...options, headers });
}

// ============================================================================
// API Missions
// ============================================================================

export const missionsApi = {
  /**
   * Liste des missions avec filtres et pagination
   */
  async list(filters: MissionFilters = {}): Promise<MissionListResponse> {
    const params = new URLSearchParams();
    if (filters.theme) params.append('theme', filters.theme);
    if (filters.status) params.append('status', filters.status);
    if (filters.commune) params.append('commune', filters.commune);
    if (filters.region) params.append('region', filters.region);
    if (filters.search) params.append('search', filters.search);
    if (filters.supervisor_id) params.append('supervisor_id', filters.supervisor_id);
    if (filters.page) params.append('page', filters.page.toString());
    if (filters.per_page) params.append('per_page', filters.per_page.toString());

    const url = `${API_BASE_URL}/colab/missions${params.toString() ? '?' + params.toString() : ''}`;
    const response = await fetchWithAuth(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des missions');
    }
    
    return response.json();
  },

  /**
   * Désassigner la maille d'une mission (soft-delete + ex_maille_code)
   */
  async unassignMaille(id: string): Promise<UnassignMissionMailleResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/${id}/maille`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la désassignation');
    }

    return response.json();
  },

  /**
   * Réassigner une mission vers une autre maille (crée une nouvelle mission)
   */
  async reassign(id: string, input: ReassignMissionRequest): Promise<ReassignMissionResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/${id}/reassign`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la réattribution');
    }

    return response.json();
  },

  /**
   * Lister les missions actives sur une maille (panneau carte)
   */
  async listMailleMissions(mailleId: string): Promise<MailleActiveMissionsResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/mailles/${mailleId}/missions`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération');
    }

    return response.json();
  },

  /**
   * Détail d'une mission
   */
  async get(id: string): Promise<MissionDetail> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/${id}`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération de la mission');
    }
    
    return response.json();
  },

  /**
   * Créer une mission
   */
  async create(data: CreateMissionRequest): Promise<MissionListItem> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la création de la mission');
    }
    
    return response.json();
  },

  /**
   * Mettre à jour une mission
   */
  async update(id: string, data: UpdateMissionRequest): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la mise à jour de la mission');
    }
    
    return response.json();
  },

  /**
   * Supprimer une mission
   */
  async delete(id: string): Promise<{ success: boolean; deleted: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/${id}`, {
      method: 'DELETE',
    });
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suppression de la mission');
    }
    
    return response.json();
  },

  async resolveConflict(id: string, input: ResolveConflictRequest): Promise<any> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/${id}/resolve-conflict`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la résolution');
    }

    return response.json();
  },

  /**
   * Statistiques Colab
   */
  async getStats(): Promise<ColabStats> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/missions/stats`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des statistiques');
    }
    
    return response.json();
  },
};

export const documentsApi = {
  async list(params?: { mission_id?: string; sondage_id?: string; document_type?: string }): Promise<ColabDocumentsListResponse> {
    const search = new URLSearchParams();
    if (params?.mission_id) search.set('mission_id', params.mission_id);
    if (params?.sondage_id) search.set('sondage_id', params.sondage_id);
    if (params?.document_type) search.set('document_type', params.document_type);

    const url = `${API_BASE_URL}/colab/documents${search.toString() ? `?${search.toString()}` : ''}`;
    const response = await fetchWithAuth(url);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des documents');
    }

    return response.json();
  },

  async upload(input: {
    mission_id: string;
    title: string;
    document_type: string;
    file: File;
    description?: string;
    sondage_id?: string;
    notes?: string;
  }): Promise<ColabDocument> {
    const form = new FormData();
    form.append('mission_id', input.mission_id);
    form.append('title', input.title);
    form.append('document_type', input.document_type);
    if (input.description) form.append('description', input.description);
    if (input.sondage_id) form.append('sondage_id', input.sondage_id);
    if (input.notes) form.append('notes', input.notes);
    form.append('file', input.file);

    const response = await fetchWithAuth(`${API_BASE_URL}/colab/documents`, {
      method: 'POST',
      body: form,
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de l'upload du document");
    }

    return response.json();
  },

  async download(documentId: string): Promise<Blob> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/documents/${documentId}/download`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors du téléchargement');
    }

    return response.blob();
  },

  async delete(documentId: string): Promise<{ success: boolean; document_id: string; deleted: boolean }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/documents/${documentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suppression du document');
    }

    return response.json();
  },
};

// ============================================================================
// API Superviseurs
// ============================================================================

export const supervisorsApi = {
  /**
   * Liste des superviseurs
   */
  async list(): Promise<SupervisorSummary[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/supervisors`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des superviseurs');
    }
    
    return response.json();
  },

  async get(id: string): Promise<{
    id: string;
    user_id: string;
    username: string;
    email: string;
    full_name: string;
    telephone?: string | null;
    is_active: boolean;
    specialite?: string | null;
    institution?: string | null;
    titre?: string | null;
    departement?: string | null;
    notes?: string | null;
  }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/supervisors/${id}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération du superviseur');
    }

    return response.json();
  },

  /**
   * Créer un superviseur
   */
  async create(data: CreateSupervisorRequest): Promise<CreateSupervisorResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/supervisors`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la création du superviseur');
    }

    return response.json();
  },

  /**
   * Suggérer des superviseurs (autocomplétion)
   */
  async suggest(q: string): Promise<UserSuggestItem[]> {
    const params = new URLSearchParams();
    params.append('q', q);
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/supervisors/suggest?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suggestion superviseurs');
    }

    return response.json();
  },

  async update(id: string, data: UpdateSupervisorRequest): Promise<{ success: boolean; supervisor_id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/supervisors/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la mise à jour du superviseur');
    }

    return response.json();
  },

  async delete(id: string): Promise<{ success: boolean; supervisor_id: string; deactivated: boolean }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/supervisors/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suppression du superviseur');
    }

    return response.json();
  },
};

// ============================================================================
// API Étudiants
// ============================================================================

export const studentsApi = {
  /**
   * Liste des étudiants
   */
  async list(params?: { include_deleted?: boolean; include_inactive?: boolean; audit_mode?: boolean }): Promise<{ students: Student[]; total: number }> {
    const search = new URLSearchParams();
    if (params?.audit_mode) search.set('audit_mode', 'true');
    if (params?.include_deleted) search.set('include_deleted', 'true');
    if (params?.include_inactive) search.set('include_inactive', 'true');
    const url = `${API_BASE_URL}/colab/students${search.toString() ? `?${search.toString()}` : ''}`;
    const response = await fetchWithAuth(url);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des étudiants');
    }
    
    return response.json();
  },

  async listDuplicates(): Promise<Array<{ telephone: string; students: Student[] }>> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/duplicates`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des doublons');
    }

    return response.json();
  },

  async get(id: string): Promise<Student> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/${id}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de la récupération de l'étudiant");
    }

    return response.json();
  },

  /**
   * Créer un étudiant
   */
  async create(data: CreateStudentRequest): Promise<CreateStudentResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students`, {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      const e = new Error(error.error || "Erreur lors de la création de l'étudiant");
      (e as any).payload = error;
      throw e;
    }

    return response.json();
  },

  async suggest(q: string): Promise<UserSuggestItem[]> {
    const params = new URLSearchParams();
    params.append('q', q);
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/suggest?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suggestion étudiants');
    }

    return response.json();
  },

  async update(id: string, data: UpdateStudentRequest): Promise<{ success: boolean; student_id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de la mise à jour de l'étudiant");
    }

    return response.json();
  },

  async getPrefs(studentId: string): Promise<StudentPrefs> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/${studentId}/prefs`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des préférences');
    }

    return response.json();
  },

  async updatePrefs(studentId: string, data: UpdateStudentPrefsRequest): Promise<{ success: boolean; student_id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/${studentId}/prefs`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la mise à jour des préférences');
    }

    return response.json();
  },

  async delete(id: string): Promise<{ success: boolean; student_id: string; deactivated: boolean }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de la suppression de l'étudiant");
    }

    return response.json();
  },
};

export const maillesApi = {
  async suggest(q: string): Promise<MailleSuggestItem[]> {
    const params = new URLSearchParams();
    params.append('q', q);
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/mailles/suggest?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la suggestion mailles');
    }

    return response.json();
  },

  async resolve(input: { lat: number; lon: number }): Promise<MailleSuggestItem> {
    const params = new URLSearchParams();
    params.append('lat', String(input.lat));
    params.append('lon', String(input.lon));
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/mailles/resolve?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la résolution de la maille');
    }

    return response.json();
  },
};

export const exportsApi = {
  async create(request: ExportRequest): Promise<ExportJobResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de la création de l'export");
    }

    return response.json();
  },

  async getJob(jobId: string): Promise<ExportJobResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/jobs/${jobId}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération du job');
    }

    return response.json();
  },

  async history(): Promise<ExportJobResponse[]> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/history`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de la récupération de l'historique");
    }

    return response.json();
  },

  async download(jobId: string): Promise<Blob> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/download/${jobId}`, {
      method: 'GET',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors du téléchargement');
    }

    return response.blob();
  },
};

export const templatesApi = {
  async list(params?: { include_inactive?: boolean; source?: string; format?: string }): Promise<ListExportTemplatesResponse> {
    const search = new URLSearchParams();
    if (params?.include_inactive) search.append('include_inactive', 'true');
    if (params?.source) search.append('source', params.source);
    if (params?.format) search.append('format', params.format);

    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/templates${search.toString() ? `?${search.toString()}` : ''}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des templates');
    }

    return response.json();
  },

  async get(id: string): Promise<ExportTemplate> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/templates/${id}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération du template');
    }

    return response.json();
  },

  async create(input: CreateExportTemplateRequest): Promise<ExportTemplate> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/templates`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la création du template');
    }

    return response.json();
  },

  async update(id: string, input: UpdateExportTemplateRequest): Promise<ExportTemplate> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la mise à jour du template');
    }

    return response.json();
  },

  async deactivate(id: string): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/templates/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la désactivation du template');
    }

    return response.json();
  },
};

export const notifyApi = {
  async create(request: CreateNotifyJobRequest = {}): Promise<CreateNotifyJobResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/notify/jobs`, {
      method: 'POST',
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la création du job de notification');
    }

    return response.json();
  },

  async list(limit = 50): Promise<ListNotifyJobsResponse> {
    const params = new URLSearchParams();
    params.append('limit', String(limit));
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/notify/jobs?${params.toString()}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des jobs de notification');
    }

    return response.json();
  },

  async get(id: string): Promise<GetNotifyJobResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/notify/jobs/${id}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération du job de notification');
    }

    return response.json();
  },

  async cancel(id: string): Promise<{ success: boolean; job_id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/notify/jobs/${id}/cancel`, {
      method: 'POST',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de l’annulation du job');
    }

    return response.json();
  },
};

export const schedulesApi = {
  async list(params?: { include_inactive?: boolean; limit?: number }): Promise<ListExportSchedulesResponse> {
    const search = new URLSearchParams();
    if (params?.include_inactive) search.append('include_inactive', 'true');
    if (params?.limit) search.append('limit', String(params.limit));

    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/schedules${search.toString() ? `?${search.toString()}` : ''}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des schedules');
    }

    return response.json();
  },

  async create(input: CreateExportScheduleRequest): Promise<ExportSchedule> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/schedules`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la création du schedule');
    }

    return response.json();
  },

  async update(id: string, input: UpdateExportScheduleRequest): Promise<ExportSchedule> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la mise à jour du schedule');
    }

    return response.json();
  },

  async deactivate(id: string): Promise<{ success: boolean; id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/export/schedules/${id}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la désactivation du schedule');
    }

    return response.json();
  },
};

export const attributionsApi = {
  async summary(): Promise<AttributionsSummary> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/attributions/summary`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération du résumé');
    }

    return response.json();
  },

  async list(params?: { student?: string; notif_status?: string; limit?: number }): Promise<ListAttributionsResponse> {
    const search = new URLSearchParams();
    if (params?.student) search.append('student', params.student);
    if (params?.notif_status) search.append('notif_status', params.notif_status);
    if (params?.limit) search.append('limit', String(params.limit));

    const response = await fetchWithAuth(`${API_BASE_URL}/colab/attributions${search.toString() ? `?${search.toString()}` : ''}`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des attributions');
    }

    return response.json();
  },

  async enqueueNotifications(input: EnqueueAttributionsNotificationsRequest): Promise<EnqueueAttributionsNotificationsResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/attributions/notify`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de l’enregistrement des notifications');
    }

    return response.json();
  },

  async assign(input: AssignAttributionRequest): Promise<AssignAttributionResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/assign`, {
      method: 'POST',
      body: JSON.stringify(input),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de l’attribution');
    }

    return response.json();
  },

  async unassign(assignmentId: string): Promise<{ success: boolean; assignment_id: string }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/assign/${assignmentId}`, {
      method: 'DELETE',
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || "Erreur lors de la désattribution");
    }

    return response.json();
  },

  async history(): Promise<AttributionNotificationHistoryResponse> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/attributions/notifications/history`);

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération de l’historique');
    }

    return response.json();
  },
};

// ============================================================================
// Helpers
// ============================================================================

export function getStatusLabel(status: string): string {
  return MISSION_STATUSES.find(s => s.value === status)?.label || status;
}

export function getStatusColor(status: string): string {
  return MISSION_STATUSES.find(s => s.value === status)?.color || 'bg-gray-100 text-gray-800';
}

export function getThemeLabel(theme: string): string {
  return MISSION_THEMES.find(t => t.value === theme)?.label || theme;
}

export function formatDate(dateString: string | null): string {
  if (!dateString) return '-';
  return new Date(dateString).toLocaleDateString('fr-FR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}
