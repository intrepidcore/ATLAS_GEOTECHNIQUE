import { getDb } from './schema';
import type { MobileMission, MapContext, PlannedPoint } from '@/api/mobile';

// Génère un id local. Pas de dépendance uuid externe pour rester léger.
export function newClientId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export type SondageDraftStatus = 'draft' | 'queued' | 'synced' | 'failed';

export interface SondageDraft {
  client_id: string;
  mission_id: string;
  planned_point_id: string | null;
  longitude: number;
  latitude: number;
  location_accuracy_m: number | null;
  depth_m: number | null;
  layers_count: number | null;
  profile_description: string | null;
  notes: string | null;
  status: SondageDraftStatus;
  server_id: string | null;
  created_at: string;
}

export interface SyncQueueItem {
  client_id: string;
  action_type: string;
  payload: string;
  attempts: number;
  last_error: string | null;
  created_at: string;
}

export const repository = {
  async saveMissions(missions: MobileMission[]): Promise<void> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      for (const m of missions) {
        await db.runAsync(
          `INSERT OR REPLACE INTO missions
           (id, code, title, theme, status, start_date, end_date, maille_id, maille_label,
            commune, region, expected_sondages, completed_sondages, percent_done, synced_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            m.id, m.code, m.title, m.theme, m.status, m.start_date, m.end_date,
            m.maille_id, m.maille_label, m.commune, m.region,
            m.expected_sondages, m.completed_sondages, m.percent_done,
            new Date().toISOString(),
          ]
        );
      }
    });
  },

  async getMissions(): Promise<MobileMission[]> {
    const db = await getDb();
    return db.getAllAsync<MobileMission>(
      `SELECT * FROM missions ORDER BY
       CASE status WHEN 'in_progress' THEN 1 WHEN 'planned' THEN 2 WHEN 'draft' THEN 3 ELSE 4 END,
       start_date DESC`
    );
  },

  async getMission(id: string): Promise<MobileMission | null> {
    const db = await getDb();
    return db.getFirstAsync<MobileMission>('SELECT * FROM missions WHERE id = ?', [id]);
  },

  async saveMapContext(missionId: string, ctx: MapContext): Promise<void> {
    const db = await getDb();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `INSERT OR REPLACE INTO mission_map_cache
         (mission_id, tolerance_m, maille_geojson, center_lon, center_lat,
          bbox_min_x, bbox_min_y, bbox_max_x, bbox_max_y, cached_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          missionId, ctx.tolerance_m, JSON.stringify(ctx.maille_geojson),
          ctx.center_lon, ctx.center_lat,
          ctx.bbox?.min_x ?? null, ctx.bbox?.min_y ?? null,
          ctx.bbox?.max_x ?? null, ctx.bbox?.max_y ?? null,
          new Date().toISOString(),
        ]
      );
      await db.runAsync('DELETE FROM mission_planned_points WHERE mission_id = ?', [missionId]);
      for (const p of ctx.planned_points) {
        await db.runAsync(
          `INSERT INTO mission_planned_points (id, mission_id, numero, label, lat, lon, confirmed_sondage_id)
           VALUES (?, ?, ?, ?, ?, ?, ?)`,
          [p.id, missionId, p.numero, p.label, p.lat, p.lon, p.confirmed_sondage_id]
        );
      }
    });
  },

  async getPlannedPoints(missionId: string): Promise<PlannedPoint[]> {
    const db = await getDb();
    return db.getAllAsync<PlannedPoint>(
      'SELECT id, numero, label, lat, lon, confirmed_sondage_id FROM mission_planned_points WHERE mission_id = ? ORDER BY numero',
      [missionId]
    );
  },

  async getCachedTolerance(missionId: string): Promise<number | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ tolerance_m: number }>(
      'SELECT tolerance_m FROM mission_map_cache WHERE mission_id = ?',
      [missionId]
    );
    return row?.tolerance_m ?? null;
  },

  async saveDraft(draft: SondageDraft): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO sondages_draft
       (client_id, mission_id, planned_point_id, longitude, latitude, location_accuracy_m,
        depth_m, layers_count, profile_description, notes, status, server_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.client_id, draft.mission_id, draft.planned_point_id,
        draft.longitude, draft.latitude, draft.location_accuracy_m,
        draft.depth_m, draft.layers_count, draft.profile_description, draft.notes,
        draft.status, draft.server_id, draft.created_at,
      ]
    );
  },

  async markDraftSynced(clientId: string, serverId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE sondages_draft SET status = 'synced', server_id = ? WHERE client_id = ?",
      [serverId, clientId]
    );
  },

  async getDraftsForMission(missionId: string): Promise<SondageDraft[]> {
    const db = await getDb();
    return db.getAllAsync<SondageDraft>(
      'SELECT * FROM sondages_draft WHERE mission_id = ? ORDER BY created_at DESC',
      [missionId]
    );
  },

  async enqueue(clientId: string, actionType: string, payload: Record<string, unknown>): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT OR REPLACE INTO sync_queue (client_id, action_type, payload, attempts, last_error, created_at) VALUES (?, ?, ?, 0, NULL, ?)',
      [clientId, actionType, JSON.stringify(payload), new Date().toISOString()]
    );
  },

  async getQueue(limit = 20): Promise<SyncQueueItem[]> {
    const db = await getDb();
    return db.getAllAsync<SyncQueueItem>(
      'SELECT * FROM sync_queue ORDER BY created_at ASC LIMIT ?',
      [limit]
    );
  },

  async getQueueCount(): Promise<number> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ n: number }>('SELECT COUNT(*) as n FROM sync_queue');
    return row?.n ?? 0;
  },

  async removeFromQueue(clientId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('DELETE FROM sync_queue WHERE client_id = ?', [clientId]);
  },

  async markQueueFailure(clientId: string, error: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'UPDATE sync_queue SET attempts = attempts + 1, last_error = ? WHERE client_id = ?',
      [error, clientId]
    );
  },

  async setSetting(key: string, value: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('INSERT OR REPLACE INTO app_settings (key, value) VALUES (?, ?)', [key, value]);
  },

  async getSetting(key: string): Promise<string | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{ value: string }>('SELECT value FROM app_settings WHERE key = ?', [key]);
    return row?.value ?? null;
  },
};
