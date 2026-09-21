import type { FieldExportSnapshot } from '@/db/repository';

export type ExportFormat = 'json' | 'csv';

function safeCsvCell(value: unknown): string {
  if (value === null || value === undefined) return '';
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  let text = typeof value === 'string' ? value : JSON.stringify(value);
  if (/^[=+@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function snapshotToCsv(snapshot: FieldExportSnapshot): string {
  const headers = [
    'type_enregistrement', 'mission_id', 'identifiant', 'code_ou_libelle', 'statut',
    'latitude', 'longitude', 'profondeur_m', 'date_creation', 'donnees_json',
  ];
  const rows: unknown[][] = [];
  snapshot.missions.forEach((mission) => rows.push([
    'mission', mission.id, mission.id, mission.code || mission.title, mission.status,
    null, null, null, mission.synced_at, mission,
  ]));
  snapshot.planned_points.forEach((point) => rows.push([
    'point_previsionnel', point.mission_id, point.id, point.label || `Point ${point.numero}`,
    point.confirmed_sondage_id ? 'confirme' : 'a_realiser', point.lat, point.lon, null, null, point,
  ]));
  snapshot.sondages.forEach((sondage) => rows.push([
    'sondage', sondage.mission_id, sondage.client_id, sondage.server_id || sondage.client_id,
    sondage.status, sondage.latitude, sondage.longitude, sondage.depth_m, sondage.created_at, sondage,
  ]));
  snapshot.field_logs.forEach((log) => rows.push([
    'journal_terrain', log.mission_id, log.client_id, log.log_type, log.status,
    log.latitude, log.longitude, null, log.created_at, log,
  ]));
  snapshot.pending_queue.forEach((item) => {
    let payload: Record<string, unknown> = {};
    try { payload = JSON.parse(item.payload) as Record<string, unknown>; } catch { payload = { payload_brut: item.payload }; }
    rows.push([
      'file_synchronisation', payload.mission_id ?? null, item.client_id, item.action_type,
      item.last_error ? 'erreur' : 'en_attente', payload.latitude ?? null, payload.longitude ?? null,
      payload.depth_m ?? null, item.created_at, { ...item, payload },
    ]);
  });
  return `\uFEFF${[headers, ...rows].map((row) => row.map(safeCsvCell).join(';')).join('\r\n')}\r\n`;
}

export function serializeSnapshot(snapshot: FieldExportSnapshot, format: ExportFormat): string {
  return format === 'json' ? JSON.stringify(snapshot, null, 2) : snapshotToCsv(snapshot);
}
