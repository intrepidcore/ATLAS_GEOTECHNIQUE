/**
 * Service API pour l'import bulk de sondages
 */

const API_BASE = '/api/v1/surveys/bulk-import';

export interface ImportRequest {
  format: 'csv' | 'xlsx' | 'json';
  mapping: MappingConfig;
  geolocation: GeolocationConfig;
  save_file?: boolean;
}

export interface MappingConfig {
  structure: 'long' | 'large';
  localite?: string;
  code?: string;
  date?: string;
  source?: string;
  operator?: string;
  type_sol?: string;
  adm1?: string;
  adm2?: string;
  adm3?: string;
  maille_code?: string;
  type_essai?: string;
  profondeur_m?: string;
  valeur?: string;
  unite?: string;
  analyse_qualitative?: string;
  profondeur_cols?: string[];
}

export interface GeolocationConfig {
  mode: 'exact' | 'centroid' | 'random' | 'unknown' | 'maille';
  seed?: number;
  jitter_radius?: number;
}

export interface ImportResponse {
  job_id: string;
  status: ImportStatus;
  message: string;
}

export type ImportStatus = 'pending' | 'running' | 'succeeded' | 'failed' | 'partial' | 'cancelled';

export interface ImportJob {
  id: string;
  filename: string;
  size_bytes: number;
  status: ImportStatus;
  progress: number;
  stats: ImportStats;
  error_message?: string;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

export interface ImportStats {
  total_rows: number;
  valid_rows: number;
  sondages: number;
  essais: number;
  warnings: number;
  errors: number;
  succeeded: number;
}

export interface DryRunResult {
  stats: {
    total: number;
    ok: number;
    warnings: number;
    errors: number;
  };
  preview: PreviewRow[];
}

export interface PreviewRow {
  row_idx: number;
  localite?: string;
  code?: string;
  date?: string;
  longitude?: number;
  latitude?: number;
  status: 'ok' | 'warning' | 'error' | 'skipped';
  errors: string[];
  warnings: string[];
}

export interface MappingProfile {
  id: string;
  user_id?: string;
  name: string;
  description?: string;
  mapping: MappingConfig;
  created_at: string;
  updated_at?: string;
  last_used_at?: string;
  use_count: number;
}

export interface CreateMappingProfileRequest {
  user_id?: string;
  name: string;
  description?: string;
  mapping: MappingConfig;
}

/**
 * Service API Import Bulk
 */
export class ImportBulkAPI {
  /**
   * Dry-run : validation sans insertion
   */
  static async dryRun(file: File, config: Partial<ImportRequest>): Promise<DryRunResult> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('config', JSON.stringify(config));

    const response = await fetch(`${API_BASE}/dry-run`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Dry-run failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Lancer import asynchrone
   */
  static async startImport(file: File, config: ImportRequest): Promise<ImportResponse> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('config', JSON.stringify(config));

    const response = await fetch(`${API_BASE}/async`, {
      method: 'POST',
      body: formData,
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Import failed: ${error}`);
    }

    return response.json();
  }

  /**
   * Récupérer statut d'un job
   */
  static async getStatus(jobId: string): Promise<ImportJob> {
    const response = await fetch(`${API_BASE}/status/${jobId}`);

    if (!response.ok) {
      throw new Error(`Failed to get status: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Annuler un import
   */
  static async cancel(jobId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/cancel/${jobId}`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to cancel: ${response.statusText}`);
    }
  }

  /**
   * Télécharger rapport d'import
   */
  static async downloadReport(importId: string, format: 'json' | 'csv' = 'csv'): Promise<Blob> {
    const response = await fetch(`${API_BASE}/report/${importId}?format=${format}`);

    if (!response.ok) {
      throw new Error(`Failed to download report: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Télécharger template CSV
   */
  static async downloadTemplate(templateType: string): Promise<Blob> {
    const response = await fetch(`${API_BASE}/templates/${templateType}`);

    if (!response.ok) {
      throw new Error(`Failed to download template: ${response.statusText}`);
    }

    return response.blob();
  }

  /**
   * Lister profils mapping
   */
  static async listProfiles(userId?: string): Promise<MappingProfile[]> {
    const params = userId ? `?user_id=${userId}` : '';
    const response = await fetch(`${API_BASE}/profiles${params}`);

    if (!response.ok) {
      throw new Error(`Failed to list profiles: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Créer profil mapping
   */
  static async createProfile(req: CreateMappingProfileRequest): Promise<MappingProfile> {
    const response = await fetch(`${API_BASE}/profiles`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(req),
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Failed to create profile: ${error}`);
    }

    return response.json();
  }

  /**
   * Récupérer un profil
   */
  static async getProfile(profileId: string): Promise<MappingProfile> {
    const response = await fetch(`${API_BASE}/profiles/${profileId}`);

    if (!response.ok) {
      throw new Error(`Failed to get profile: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Utiliser un profil (tracker usage)
   */
  static async useProfile(profileId: string): Promise<void> {
    const response = await fetch(`${API_BASE}/profiles/${profileId}/use`, {
      method: 'POST',
    });

    if (!response.ok) {
      throw new Error(`Failed to use profile: ${response.statusText}`);
    }
  }

  /**
   * Détecter format fichier
   */
  static detectFormat(filename: string): 'csv' | 'xlsx' | 'json' {
    const ext = filename.split('.').pop()?.toLowerCase();
    if (ext === 'xlsx' || ext === 'xls') return 'xlsx';
    if (ext === 'json') return 'json';
    return 'csv';
  }

  /**
   * Détecter colonnes depuis preview
   */
  static async detectColumns(file: File): Promise<string[]> {
    // Lire premières lignes pour détecter colonnes
    const text = await file.slice(0, 1024).text();
    const lines = text.split('\n');

    if (lines.length === 0) return [];

    // Détecter séparateur CSV
    const firstLine = lines[0];
    const separators = [',', ';', '\t'];
    const separator = separators.find(sep => firstLine.includes(sep)) || ',';

    return firstLine.split(separator).map(col => col.trim().replace(/['"]/g, ''));
  }
}
