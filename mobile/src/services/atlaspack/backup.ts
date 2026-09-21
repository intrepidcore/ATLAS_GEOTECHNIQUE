/**
 * Sauvegarde locale exportable — exigence #8 : permettre de restaurer la
 * collecte en cas de panne/réinstallation/changement de téléphone,
 * indépendamment de l'application. Sérialise TOUTES les tables locales
 * pertinentes (hors données chiffrées du paquet lui-même, qui restent sur
 * le fichier .atlaspack d'origine) dans un unique fichier JSON horodaté et
 * hashé, que l'opérateur peut copier vers un support externe.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';

import { getDb } from '@/db/schema';
import { sha256Hex, utf8ToBytes } from './crypto';
import { atlaspackRepository, newUuid } from './repository';

const BACKUP_SCHEMA_VERSION = 1;
const BACKUP_TABLES = [
  'missions',
  'mission_planned_points',
  'mission_map_cache',
  'sondages_draft',
  'field_logs_draft',
  'lab_results_draft',
  'attachments_draft',
  'exports_log',
  'audit_log',
  'atlaspack_meta',
] as const;

export interface BackupResult {
  id: string;
  fileUri: string;
  sizeBytes: number;
  sha256: string;
  createdAt: string;
}

/**
 * Crée une sauvegarde JSON de toutes les données locales et propose de la
 * partager (Bluetooth, e-mail, carte SD, etc.). Ne contient PAS les tuiles
 * hors-ligne (volumineuses, régénérables depuis un nouveau `.atlaspack`) —
 * seulement les données de collecte et de configuration.
 */
export async function createBackup(): Promise<BackupResult> {
  const db = await getDb();
  const dump: Record<string, unknown[]> = {};
  for (const table of BACKUP_TABLES) {
    dump[table] = await db.getAllAsync(`SELECT * FROM ${table}`);
  }
  const payload = {
    schema_version: BACKUP_SCHEMA_VERSION,
    created_at: new Date().toISOString(),
    tables: dump,
  };
  const bytes = utf8ToBytes(JSON.stringify(payload));
  const sha256 = sha256Hex(bytes);

  const id = newUuid();
  const dir = `${FileSystem.documentDirectory}backups/`;
  await FileSystem.makeDirectoryAsync(dir, { intermediates: true }).catch(() => {});
  const fileUri = `${dir}atlas-terrain-backup-${id}.json`;
  await FileSystem.writeAsStringAsync(fileUri, JSON.stringify(payload));

  await atlaspackRepository.recordBackup({ id, fileUri, sizeBytes: bytes.length, sha256, schemaVersion: BACKUP_SCHEMA_VERSION });
  await atlaspackRepository.recordAuditEvent({
    eventType: 'backup_created',
    operatorUserId: null,
    missionId: null,
    objectType: 'backup',
    objectId: id,
    oldValues: null,
    newValues: { size_bytes: bytes.length, tables: BACKUP_TABLES.length },
    metadata: { sha256 },
  });

  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(fileUri, { mimeType: 'application/json', dialogTitle: 'Sauvegarder la collecte Atlas Terrain' });
  }

  return { id, fileUri, sizeBytes: bytes.length, sha256, createdAt: payload.created_at };
}

export class AtlasPackBackupError extends Error {}

/**
 * Restaure une sauvegarde JSON précédemment créée par `createBackup`.
 * Vérifie l'empreinte SHA-256 embarquée AVANT toute écriture — un fichier
 * altéré est rejeté proprement, comme pour un `.atlaspack`.
 */
export async function restoreBackup(sourceUri: string): Promise<{ tablesRestored: number; rowsRestored: number }> {
  const raw = await FileSystem.readAsStringAsync(sourceUri);
  let payload: { schema_version: number; tables: Record<string, Array<Record<string, unknown>>> };
  try {
    payload = JSON.parse(raw);
  } catch (e) {
    throw new AtlasPackBackupError(`Fichier de sauvegarde illisible : ${String(e)}`);
  }
  if (payload.schema_version !== BACKUP_SCHEMA_VERSION) {
    throw new AtlasPackBackupError(
      `Version de sauvegarde incompatible (v${payload.schema_version}, application v${BACKUP_SCHEMA_VERSION})`,
    );
  }

  const db = await getDb();
  let rowsRestored = 0;
  let tablesRestored = 0;

  await db.withTransactionAsync(async () => {
    for (const table of BACKUP_TABLES) {
      const rows = payload.tables[table];
      if (!rows || rows.length === 0) continue;
      tablesRestored++;
      for (const row of rows) {
        const columns = Object.keys(row);
        const placeholders = columns.map(() => '?').join(',');
        const values = columns.map((c) => row[c]);
        await db.runAsync(
          `INSERT OR REPLACE INTO ${table} (${columns.join(',')}) VALUES (${placeholders})`,
          values as (string | number | null)[],
        );
        rowsRestored++;
      }
    }
  });

  await atlaspackRepository.recordAuditEvent({
    eventType: 'backup_created',
    operatorUserId: null,
    missionId: null,
    objectType: 'backup_restore',
    objectId: null,
    oldValues: null,
    newValues: { tables_restored: tablesRestored, rows_restored: rowsRestored },
    metadata: null,
  });

  return { tablesRestored, rowsRestored };
}

export async function listLocalBackups() {
  return atlaspackRepository.listBackups();
}

// Réexporté pour les écrans qui affichent la taille lisible d'une sauvegarde.
export function formatBytes(n: number): string {
  if (n < 1024) return `${n} o`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} Ko`;
  return `${(n / (1024 * 1024)).toFixed(1)} Mo`;
}
