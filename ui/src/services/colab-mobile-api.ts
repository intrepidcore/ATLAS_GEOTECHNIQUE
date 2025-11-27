/**
 * API Service pour Atlas Colab Mobile/PWA
 * 
 * Gestion des missions terrain, synchronisation offline, GPS et traces
 */

import { API_BASE_URL } from './api';

// ============================================================================
// Types
// ============================================================================

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

export interface TeamMember {
  user_id: string;
  username: string;
  email: string;
  role: string;
}

export interface MobileSondage {
  id: string;
  code_sondage: string | null;
  longitude: number | null;
  latitude: number | null;
  profondeur_atteinte: number | null;
  validation_status: string | null;
  created_at: string | null;
}

export interface BoundingBox {
  min_x: number;
  min_y: number;
  max_x: number;
  max_y: number;
  center_lon: number;
  center_lat: number;
}

export interface MobileMissionDetail {
  mission: MobileMission;
  supervisor_name: string | null;
  supervisor_email: string | null;
  team_members: TeamMember[];
  recent_sondages: MobileSondage[];
  bbox: BoundingBox | null;
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
  existing_sondages: SondageMarker[];
}

export interface CreateFieldSondageRequest {
  longitude: number;
  latitude: number;
  location_accuracy_m?: number;
  depth_m?: number;
  profile_description?: string;
  layers_count?: number;
  notes?: string;
  photo_ids?: string[];
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

export interface SyncResponse {
  results: SyncActionResult[];
  synced_count: number;
  failed_count: number;
}

export interface TrackPoint {
  longitude: number;
  latitude: number;
  altitude_m?: number;
  accuracy_m?: number;
  recorded_at: string;
}

// ============================================================================
// Helpers
// ============================================================================

function getAuthHeaders(): HeadersInit {
  const token = localStorage.getItem('atlas_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Erreur réseau' }));
    throw new Error(error.error || error.message || `Erreur ${response.status}`);
  }
  return response.json();
}

// ============================================================================
// API Mobile Missions
// ============================================================================

export const mobileApi = {
  /**
   * Récupérer mes missions assignées
   */
  async getMyMissions(): Promise<{ missions: MobileMission[]; count: number }> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/missions`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Récupérer le détail d'une mission
   */
  async getMissionDetail(missionId: string): Promise<MobileMissionDetail> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/missions/${missionId}`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Récupérer le contexte carte d'une mission
   */
  async getMapContext(missionId: string): Promise<MapContext> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/missions/${missionId}/map-context`, {
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },

  /**
   * Créer un sondage terrain
   */
  async createFieldSondage(
    missionId: string,
    data: CreateFieldSondageRequest
  ): Promise<{ id: string; code_sondage: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/missions/${missionId}/sondages`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify(data),
    });
    return handleResponse(response);
  },

  /**
   * Synchroniser les actions en attente
   */
  async sync(actions: SyncAction[]): Promise<SyncResponse> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/sync`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ actions }),
    });
    return handleResponse(response);
  },

  /**
   * Créer une trace GPS
   */
  async createTrack(missionId: string, name?: string): Promise<{ id: string; message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/tracks`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ mission_id: missionId, name }),
    });
    return handleResponse(response);
  },

  /**
   * Ajouter des points à une trace
   */
  async addTrackPoints(
    trackId: string,
    points: TrackPoint[]
  ): Promise<{ added: number; total_points: number }> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/tracks/${trackId}/points`, {
      method: 'POST',
      headers: getAuthHeaders(),
      body: JSON.stringify({ points }),
    });
    return handleResponse(response);
  },

  /**
   * Arrêter une trace
   */
  async stopTrack(trackId: string): Promise<{ message: string }> {
    const response = await fetch(`${API_BASE_URL}/colab/mobile/tracks/${trackId}/stop`, {
      method: 'POST',
      headers: getAuthHeaders(),
    });
    return handleResponse(response);
  },
};

// ============================================================================
// IndexedDB pour stockage offline
// ============================================================================

const DB_NAME = 'atlas_colab_offline';
const DB_VERSION = 1;

interface OfflineDB {
  missions: MobileMission[];
  pendingActions: SyncAction[];
  tracks: { id: string; points: TrackPoint[] }[];
}

let dbInstance: IDBDatabase | null = null;

async function openDB(): Promise<IDBDatabase> {
  if (dbInstance) return dbInstance;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => reject(request.error);
    request.onsuccess = () => {
      dbInstance = request.result;
      resolve(dbInstance);
    };

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;

      // Store pour les missions
      if (!db.objectStoreNames.contains('missions')) {
        db.createObjectStore('missions', { keyPath: 'id' });
      }

      // Store pour les actions en attente
      if (!db.objectStoreNames.contains('pendingActions')) {
        db.createObjectStore('pendingActions', { keyPath: 'client_id' });
      }

      // Store pour les brouillons de sondages
      if (!db.objectStoreNames.contains('draftSondages')) {
        db.createObjectStore('draftSondages', { keyPath: 'client_id' });
      }

      // Store pour les traces GPS
      if (!db.objectStoreNames.contains('tracks')) {
        db.createObjectStore('tracks', { keyPath: 'id' });
      }
    };
  });
}

export const offlineStorage = {
  /**
   * Sauvegarder les missions en local
   */
  async saveMissions(missions: MobileMission[]): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('missions', 'readwrite');
    const store = tx.objectStore('missions');

    // Vider et remplir
    store.clear();
    for (const mission of missions) {
      store.put(mission);
    }

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Récupérer les missions depuis le stockage local
   */
  async getMissions(): Promise<MobileMission[]> {
    const db = await openDB();
    const tx = db.transaction('missions', 'readonly');
    const store = tx.objectStore('missions');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Ajouter une action en attente de synchronisation
   */
  async addPendingAction(action: SyncAction): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    store.put(action);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Récupérer toutes les actions en attente
   */
  async getPendingActions(): Promise<SyncAction[]> {
    const db = await openDB();
    const tx = db.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');

    return new Promise((resolve, reject) => {
      const request = store.getAll();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },

  /**
   * Supprimer une action synchronisée
   */
  async removePendingAction(clientId: string): Promise<void> {
    const db = await openDB();
    const tx = db.transaction('pendingActions', 'readwrite');
    const store = tx.objectStore('pendingActions');
    store.delete(clientId);

    return new Promise((resolve, reject) => {
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
  },

  /**
   * Compter les actions en attente
   */
  async getPendingCount(): Promise<number> {
    const db = await openDB();
    const tx = db.transaction('pendingActions', 'readonly');
    const store = tx.objectStore('pendingActions');

    return new Promise((resolve, reject) => {
      const request = store.count();
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  },
};

// ============================================================================
// Service de synchronisation
// ============================================================================

export const syncService = {
  /**
   * Vérifier si on est en ligne
   */
  isOnline(): boolean {
    return navigator.onLine;
  },

  /**
   * Synchroniser toutes les actions en attente
   */
  async syncAll(): Promise<{ synced: number; failed: number; remaining: number }> {
    if (!this.isOnline()) {
      const remaining = await offlineStorage.getPendingCount();
      return { synced: 0, failed: 0, remaining };
    }

    const pendingActions = await offlineStorage.getPendingActions();
    if (pendingActions.length === 0) {
      return { synced: 0, failed: 0, remaining: 0 };
    }

    try {
      const response = await mobileApi.sync(pendingActions);

      // Supprimer les actions synchronisées avec succès
      for (const result of response.results) {
        if (result.success) {
          await offlineStorage.removePendingAction(result.client_id);
        }
      }

      const remaining = await offlineStorage.getPendingCount();
      return {
        synced: response.synced_count,
        failed: response.failed_count,
        remaining,
      };
    } catch (error) {
      console.error('Erreur synchronisation:', error);
      const remaining = await offlineStorage.getPendingCount();
      return { synced: 0, failed: pendingActions.length, remaining };
    }
  },

  /**
   * Créer un sondage (online ou offline)
   */
  async createSondage(
    missionId: string,
    data: CreateFieldSondageRequest
  ): Promise<{ id: string; offline: boolean }> {
    const clientId = `sondage-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    if (this.isOnline()) {
      try {
        const result = await mobileApi.createFieldSondage(missionId, data);
        return { id: result.id, offline: false };
      } catch (error) {
        // Fallback offline
        console.warn('Création online échouée, sauvegarde offline:', error);
      }
    }

    // Sauvegarder en local
    await offlineStorage.addPendingAction({
      client_id: clientId,
      action_type: 'create_sondage',
      payload: { mission_id: missionId, ...data },
    });

    return { id: clientId, offline: true };
  },
};

// ============================================================================
// Helpers GPS
// ============================================================================

export interface GPSPosition {
  longitude: number;
  latitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

export const gpsService = {
  /**
   * Obtenir la position actuelle
   */
  getCurrentPosition(options?: PositionOptions): Promise<GPSPosition> {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('Géolocalisation non supportée'));
        return;
      }

      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            longitude: position.coords.longitude,
            latitude: position.coords.latitude,
            accuracy: position.coords.accuracy,
            altitude: position.coords.altitude,
            timestamp: position.timestamp,
          });
        },
        (error) => {
          reject(new Error(getGPSErrorMessage(error)));
        },
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 0,
          ...options,
        }
      );
    });
  },

  /**
   * Surveiller la position en continu
   */
  watchPosition(
    onPosition: (pos: GPSPosition) => void,
    onError: (error: Error) => void,
    options?: PositionOptions
  ): number {
    if (!navigator.geolocation) {
      onError(new Error('Géolocalisation non supportée'));
      return -1;
    }

    return navigator.geolocation.watchPosition(
      (position) => {
        onPosition({
          longitude: position.coords.longitude,
          latitude: position.coords.latitude,
          accuracy: position.coords.accuracy,
          altitude: position.coords.altitude,
          timestamp: position.timestamp,
        });
      },
      (error) => {
        onError(new Error(getGPSErrorMessage(error)));
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000,
        ...options,
      }
    );
  },

  /**
   * Arrêter la surveillance
   */
  clearWatch(watchId: number): void {
    if (watchId >= 0) {
      navigator.geolocation.clearWatch(watchId);
    }
  },
};

function getGPSErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Permission de géolocalisation refusée';
    case error.POSITION_UNAVAILABLE:
      return 'Position non disponible';
    case error.TIMEOUT:
      return 'Délai de géolocalisation dépassé';
    default:
      return 'Erreur de géolocalisation';
  }
}

// ============================================================================
// Export par défaut
// ============================================================================

export default {
  mobile: mobileApi,
  offline: offlineStorage,
  sync: syncService,
  gps: gpsService,
};
