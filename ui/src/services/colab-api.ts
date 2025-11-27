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
  created_at: string;
  updated_at: string;
}

export interface MissionListResponse {
  missions: MissionListItem[];
  total: number;
  page: number;
  per_page: number;
  total_pages: number;
}

export interface SupervisorSummary {
  id: string;
  user_id: string;
  username: string;
  full_name: string;
  specialite: string | null;
  institution: string | null;
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

export interface CreateMissionRequest {
  code: string;
  title: string;
  theme: string;
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

export interface UpdateMissionRequest {
  title?: string;
  theme?: string;
  status?: string;
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

export interface ColabStats {
  total_missions: number;
  missions_by_status: { status: string; count: number }[];
  missions_by_theme: { theme: string; count: number }[];
  total_students: number;
  total_supervisors: number;
  total_field_logs: number;
  total_documents: number;
}

export interface Student {
  id: string;
  user_id: string;
  username: string;
  email: string;
  full_name: string;
  matricule: string | null;
  promotion: string;
  filiere: string | null;
  etablissement: string | null;
  niveau: string | null;
  is_active: boolean;
  active_missions: number;
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
    'Content-Type': 'application/json',
    ...(options.headers || {}),
  };
  
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
};

// ============================================================================
// API Étudiants
// ============================================================================

export const studentsApi = {
  /**
   * Liste des étudiants
   */
  async list(): Promise<{ students: Student[]; total: number }> {
    const response = await fetchWithAuth(`${API_BASE_URL}/colab/students`);
    
    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
      throw new Error(error.error || 'Erreur lors de la récupération des étudiants');
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
