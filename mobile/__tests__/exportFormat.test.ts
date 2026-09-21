import { serializeSnapshot, snapshotToCsv } from '@/services/exportFormat';
import type { FieldExportSnapshot } from '@/db/repository';

const snapshot: FieldExportSnapshot = {
  schema_version: 1,
  source: 'atlas-terrain',
  exported_at: '2026-08-27T10:00:00.000Z',
  missions: [{
    id: 'm1', code: 'M-001', title: 'Mission test', theme: 'Étude géotechnique', status: 'in_progress',
    start_date: null, end_date: null, maille_id: null, maille_label: 'TG-001', commune: 'Lomé',
    region: 'Maritime', expected_sondages: 1, completed_sondages: 0, percent_done: 0,
    synced_at: '2026-08-27T09:00:00.000Z',
  }],
  planned_points: [{ mission_id: 'm1', id: 'p1', numero: 1, label: 'Point 1', lat: 6.1, lon: 1.2, confirmed_sondage_id: null }],
  sondages: [],
  field_logs: [],
  pending_queue: [],
};

describe('exportFormat', () => {
  it('conserve la structure et les coordonnées en JSON', () => {
    const value = JSON.parse(serializeSnapshot(snapshot, 'json')) as FieldExportSnapshot;
    expect(value.missions[0].code).toBe('M-001');
    expect(value.planned_points[0].lat).toBe(6.1);
  });

  it('produit un CSV UTF-8 compatible tableur avec séparateur point-virgule', () => {
    const csv = snapshotToCsv(snapshot);
    expect(csv.charCodeAt(0)).toBe(0xfeff);
    expect(csv).toContain('"type_enregistrement";"mission_id"');
    expect(csv).toContain('point_previsionnel');
    expect(csv).toContain('6.1;1.2');
  });
});
