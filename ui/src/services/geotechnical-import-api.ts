/**
 * Service API pour l'import géotechnique XLSX multi-feuilles
 */

const API_BASE = '/api/v1/surveys/bulk-import';

export interface GeotechnicalImportRequest {
  file: File;
  geolocation_mode?: 'exact' | 'centroid' | 'random' | 'unknown';
}

export interface GeotechnicalImportStats {
  sondages_created: number;
  sondages_updated: number;
  echantillons_created: number;
  atterberg_created: number;
  vbs_created: number;
  proctor_created: number;
  granulo_points_created: number;
  errors: string[];
  warnings: string[];
}

export interface GeotechnicalImportResponse {
  success: boolean;
  stats: GeotechnicalImportStats;
  message: string;
}

/**
 * Importer un fichier XLSX géotechnique multi-feuilles
 */
export async function importGeotechnicalXlsx(
  request: GeotechnicalImportRequest
): Promise<GeotechnicalImportResponse> {
  const formData = new FormData();
  formData.append('file', request.file);
  formData.append('geolocation_mode', request.geolocation_mode || 'centroid');

  const response = await fetch(`${API_BASE}/geotechnical`, {
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
 * Télécharger le template Excel d'exemple
 */
export function downloadExampleTemplate(): void {
  // Pour l'instant, on redirige vers le script Python
  // En production, on pourrait servir le fichier directement
  window.open('/docs/atlas_import_example.xlsx', '_blank');
}

/**
 * Valider un fichier XLSX avant import
 */
export async function validateXlsxStructure(file: File): Promise<{
  valid: boolean;
  sheets: string[];
  errors: string[];
}> {
  // Lecture côté client pour validation rapide
  // TODO: implémenter avec une bibliothèque comme xlsx.js
  return {
    valid: true,
    sheets: [],
    errors: [],
  };
}
