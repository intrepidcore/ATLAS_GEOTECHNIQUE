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
  point_name: string | null;
  relocation_reason: string | null;
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

export interface FieldLogDraft {
  client_id: string;
  mission_id: string;
  log_type: string;
  content: string;
  longitude: number | null;
  latitude: number | null;
  status: string;
  created_at: string;
}

export interface ExportDataSelection {
  missionIds: string[];
  includePlannedPoints: boolean;
  includeSondages: boolean;
  includeFieldLogs: boolean;
  includePendingQueue: boolean;
}

export interface FieldExportSnapshot {
  schema_version: 1;
  source: 'atlas-terrain';
  exported_at: string;
  missions: MobileMission[];
  planned_points: Array<PlannedPoint & { mission_id: string }>;
  sondages: SondageDraft[];
  field_logs: FieldLogDraft[];
  pending_queue: SyncQueueItem[];
}

function queueMissionId(item: SyncQueueItem): string | null {
  try {
    const payload = JSON.parse(item.payload) as { mission_id?: unknown };
    return typeof payload.mission_id === 'string' ? payload.mission_id : null;
  } catch {
    return null;
  }
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

  async getCachedMapContext(missionId: string): Promise<MapContext | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<{
      tolerance_m: number; maille_geojson: string | null;
      center_lon: number | null; center_lat: number | null;
      bbox_min_x: number | null; bbox_min_y: number | null;
      bbox_max_x: number | null; bbox_max_y: number | null;
    }>('SELECT * FROM mission_map_cache WHERE mission_id = ?', [missionId]);
    if (!row) return null;
    const plannedPoints = await this.getPlannedPoints(missionId);
    const hasBbox = row.bbox_min_x !== null && row.bbox_min_y !== null && row.bbox_max_x !== null && row.bbox_max_y !== null;
    return {
      mission_id: missionId,
      tolerance_m: row.tolerance_m,
      maille_geojson: row.maille_geojson ? JSON.parse(row.maille_geojson) : null,
      center_lon: row.center_lon,
      center_lat: row.center_lat,
      bbox: hasBbox ? {
        min_x: row.bbox_min_x!, min_y: row.bbox_min_y!, max_x: row.bbox_max_x!, max_y: row.bbox_max_y!,
        center_lon: row.center_lon ?? 0, center_lat: row.center_lat ?? 0,
      } : null,
      planned_points: plannedPoints,
      existing_sondages: [],
    };
  },

  async saveDraft(draft: SondageDraft): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO sondages_draft
       (client_id, mission_id, planned_point_id, longitude, latitude, location_accuracy_m,
        depth_m, layers_count, profile_description, notes, point_name, relocation_reason,
        status, server_id, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.client_id, draft.mission_id, draft.planned_point_id,
        draft.longitude, draft.latitude, draft.location_accuracy_m,
        draft.depth_m, draft.layers_count, draft.profile_description, draft.notes,
        draft.point_name, draft.relocation_reason,
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

  async getDraftsForMissions(missionIds: string[]): Promise<SondageDraft[]> {
    if (missionIds.length === 0) return [];
    const db = await getDb();
    const placeholders = missionIds.map(() => '?').join(',');
    return db.getAllAsync<SondageDraft>(
      `SELECT * FROM sondages_draft WHERE mission_id IN (${placeholders}) ORDER BY created_at DESC`,
      missionIds
    );
  },

  async getFieldLogsForMissions(missionIds: string[]): Promise<FieldLogDraft[]> {
    if (missionIds.length === 0) return [];
    const db = await getDb();
    const placeholders = missionIds.map(() => '?').join(',');
    return db.getAllAsync<FieldLogDraft>(
      `SELECT * FROM field_logs_draft WHERE mission_id IN (${placeholders}) ORDER BY created_at DESC`,
      missionIds
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

  async getExportSnapshot(selection: ExportDataSelection): Promise<FieldExportSnapshot> {
    const db = await getDb();
    const ids = [...new Set(selection.missionIds)].filter(Boolean);
    if (ids.length === 0) {
      return {
        schema_version: 1, source: 'atlas-terrain', exported_at: new Date().toISOString(), missions: [], planned_points: [],
        sondages: [], field_logs: [], pending_queue: [],
      };
    }
    const placeholders = ids.map(() => '?').join(',');
    const missions = await db.getAllAsync<MobileMission>(
      `SELECT * FROM missions WHERE id IN (${placeholders}) ORDER BY code`, ids
    );
    const plannedPoints = selection.includePlannedPoints
      ? await db.getAllAsync<Array<PlannedPoint & { mission_id: string }>[number]>(
        `SELECT mission_id, id, numero, label, lat, lon, confirmed_sondage_id
         FROM mission_planned_points WHERE mission_id IN (${placeholders}) ORDER BY mission_id, numero`, ids
      ) : [];
    const sondages = selection.includeSondages
      ? await db.getAllAsync<SondageDraft>(
        `SELECT * FROM sondages_draft WHERE mission_id IN (${placeholders}) ORDER BY created_at`, ids
      ) : [];
    const fieldLogs = selection.includeFieldLogs
      ? await db.getAllAsync<FieldLogDraft>(
        `SELECT * FROM field_logs_draft WHERE mission_id IN (${placeholders}) ORDER BY created_at`, ids
      ) : [];
    const queue = selection.includePendingQueue ? await this.getQueue(10000) : [];
    return {
      schema_version: 1,
      source: 'atlas-terrain',
      exported_at: new Date().toISOString(),
      missions,
      planned_points: plannedPoints,
      sondages,
      field_logs: fieldLogs,
      pending_queue: queue.filter((item) => {
        const missionId = queueMissionId(item);
        return missionId !== null && ids.includes(missionId);
      }),
    };
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
