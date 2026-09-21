import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { repository, type ExportDataSelection } from '@/db/repository';
import { serializeSnapshot, type ExportFormat } from './exportFormat';

export interface ExportResult {
  uri: string;
  recordCount: number;
}

export async function exportAndShareFieldData(
  selection: ExportDataSelection,
  format: ExportFormat,
): Promise<ExportResult> {
  const snapshot = await repository.getExportSnapshot(selection);
  const recordCount = snapshot.missions.length + snapshot.planned_points.length
    + snapshot.sondages.length + snapshot.field_logs.length + snapshot.pending_queue.length;
  if (recordCount === 0) throw new Error('Aucune donnée locale ne correspond à cette sélection.');
  if (!FileSystem.cacheDirectory) throw new Error('Le stockage temporaire est indisponible sur cet appareil.');
  if (!(await Sharing.isAvailableAsync())) throw new Error('Le partage de fichiers est indisponible sur cet appareil.');

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = format === 'json' ? 'json' : 'csv';
  const uri = `${FileSystem.cacheDirectory}atlas-terrain-export-${stamp}.${extension}`;
  await FileSystem.writeAsStringAsync(uri, serializeSnapshot(snapshot, format), {
    encoding: FileSystem.EncodingType.UTF8,
  });
  await Sharing.shareAsync(uri, {
    dialogTitle: 'Envoyer les données Atlas Terrain',
    mimeType: format === 'json' ? 'application/json' : 'text/csv',
    UTI: format === 'json' ? 'public.json' : 'public.comma-separated-values-text',
  });
  return { uri, recordCount };
}
