import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';

export interface GPSPosition {
  longitude: number;
  latitude: number;
  accuracy: number;
  altitude: number | null;
  timestamp: number;
}

const BACKGROUND_TASK = 'atlas-mission-tracking';

function toGPSPosition(loc: Location.LocationObject): GPSPosition {
  return {
    longitude: loc.coords.longitude,
    latitude: loc.coords.latitude,
    accuracy: loc.coords.accuracy ?? 0,
    altitude: loc.coords.altitude,
    timestamp: loc.timestamp,
  };
}

export const locationService = {
  async requestForegroundPermission(): Promise<boolean> {
    const { status } = await Location.requestForegroundPermissionsAsync();
    return status === 'granted';
  },

  async requestBackgroundPermission(): Promise<boolean> {
    const { status } = await Location.requestBackgroundPermissionsAsync();
    return status === 'granted';
  },

  async getCurrentPosition(): Promise<GPSPosition> {
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
    return toGPSPosition(loc);
  },

  watchPosition(onPosition: (pos: GPSPosition) => void): Promise<Location.LocationSubscription> {
    // distanceInterval : ne remonte que sur déplacement significatif, pas de
    // polling à fréquence fixe — objectif explicite d'économie batterie.
    return Location.watchPositionAsync(
      { accuracy: Location.Accuracy.Balanced, distanceInterval: 5, timeInterval: 4000 },
      (loc) => onPosition(toGPSPosition(loc))
    );
  },

  // Trace en tâche de fond, active seulement pendant une mission démarrée
  // explicitement — jamais en permanence dès l'installation (SDD §6).
  async startBackgroundTracking(): Promise<void> {
    const granted = await this.requestBackgroundPermission();
    if (!granted) throw new Error('Permission de localisation en arrière-plan refusée');
    const already = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK).catch(() => false);
    if (already) return;
    await Location.startLocationUpdatesAsync(BACKGROUND_TASK, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 15,
      deferredUpdatesInterval: 15000,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Atlas Terrain — trace active',
        notificationBody: 'Suivi de votre trajet pendant la mission en cours.',
      },
    });
  },

  async stopBackgroundTracking(): Promise<void> {
    const started = await Location.hasStartedLocationUpdatesAsync(BACKGROUND_TASK).catch(() => false);
    if (started) await Location.stopLocationUpdatesAsync(BACKGROUND_TASK);
  },

  registerBackgroundTask(onPoints: (positions: GPSPosition[]) => void): void {
    if (TaskManager.isTaskDefined(BACKGROUND_TASK)) return;
    TaskManager.defineTask(BACKGROUND_TASK, ({ data, error }) => {
      if (error || !data) return;
      const { locations } = data as { locations: Location.LocationObject[] };
      onPoints(locations.map(toGPSPosition));
    });
  },
};
