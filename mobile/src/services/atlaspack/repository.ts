import * as Crypto from 'expo-crypto';
import { getDb } from '@/db/schema';

/** UUID v4 — remplace l'ancien `newClientId()` non-UUID pour tout objet
 * synchronisable (sondage, essai, pièce jointe, export, événement d'audit) :
 * condition nécessaire à un réimport idempotent côté serveur (exigence #4). */
export function newUuid(): string {
  return Crypto.randomUUID();
}

export interface AtlasPackMeta {
  packageId: string;
  operatorUserId: string;
  operatorEmail: string;
  formatVersion: number;
  schemaVersion: number;
  generatedAt: string;
  expiresAt: string;
  signingKeyId: string;
  passwordSaltB64: string;
  argon2MCost: number;
  argon2TCost: number;
  argon2PCost: number;
  argon2HashLen: number;
  missionIds: string[];
  dataBinPath: string;
  mbtilesPath: string | null;
  importedAt: string;
  lastUnlockedAt?: string | null;
}

/** Forme brute de la ligne SQLite — `SELECT *` retourne les noms de colonnes
 * TELS QUELS (snake_case), jamais convertis en camelCase automatiquement.
 * Un ancien code faisait `Omit<AtlasPackMeta, 'missionIds'> & {...}` en
 * réutilisant l'interface camelCase par erreur : `row.missionIds` valait
 * alors `undefined` (la vraie clé est `mission_ids`), et
 * `JSON.parse(undefined)` échoue avec "Unexpected character: u" (JS
 * convertit `undefined` en la CHAÎNE "undefined" avant de la parser) —
 * constaté en conditions réelles le 2026-08-31. Ne plus jamais réutiliser
 * une interface camelCase comme type de ligne SQLite brute.
 */
export interface AtlasPackMetaRow {
  package_id: string;
  operator_user_id: string;
  operator_email: string;
  format_version: number;
  schema_version: number;
  generated_at: string;
  expires_at: string;
  signing_key_id: string;
  password_salt_b64: string;
  argon2_m_cost: number;
  argon2_t_cost: number;
  argon2_p_cost: number;
  argon2_hash_len: number;
  mission_ids: string;
  data_bin_path: string;
  mbtiles_path: string | null;
  imported_at: string;
  last_unlocked_at: string | null;
}

export type AuditEventType =
  | 'login'
  | 'mission_opened'
  | 'gps_capture'
  | 'relocate_point'
  | 'sondage_updated'
  | 'lab_result_updated'
  | 'attachment_added'
  | 'attachment_removed'
  | 'validation'
  | 'export'
  | 'package_imported'
  | 'package_unloaded'
  | 'backup_created';

export interface AuditEvent {
  id: string;
  eventType: AuditEventType;
  occurredAt: string;
  operatorUserId: string | null;
  missionId: string | null;
  objectType: string | null;
  objectId: string | null;
  oldValues: unknown | null;
  newValues: unknown | null;
  metadata: unknown | null;
}

export interface LabResultDraft {
  id: string;
  missionId: string;
  sondageId: string;
  sampleCode: string;
  depthTopM: number;
  depthBottomM: number;
  sample: unknown;
  tests: unknown;
  status: 'draft' | 'complete';
  createdAt: string;
}

export interface AttachmentDraft {
  id: string;
  missionId: string | null;
  sondageId: string;
  kind: string;
  fileUri: string;
  fileName: string;
  contentType: string;
  caption: string | null;
  takenAt: string | null;
  createdAt: string;
}

export type ExportState = 'exported' | 'imported_hq';

export interface ExportLogEntry {
  id: string;
  missionIds: string[];
  generatedAt: string;
  fileUri: string;
  sizeBytes: number;
  sha256: string;
  state: ExportState;
  hqConfirmedAt: string | null;
}

/**
 * Convertit une ligne SQLite brute (snake_case) en `AtlasPackMeta`
 * (camelCase) — mapping EXPLICITE champ par champ, jamais de spread `{...row}`
 * qui laisserait passer les clés snake_case sans les renommer.
 */
export function rowToAtlasPackMeta(row: AtlasPackMetaRow): AtlasPackMeta {
  let missionIds: string[];
  try {
    const parsed = JSON.parse(row.mission_ids);
    if (!Array.isArray(parsed)) {
      throw new Error(`valeur JSON valide mais pas un tableau (type: ${typeof parsed})`);
    }
    missionIds = parsed;
  } catch (e) {
    const preview =
      row.mission_ids === null || row.mission_ids === undefined
        ? String(row.mission_ids)
        : `"${String(row.mission_ids).slice(0, 60)}"`;
    throw new Error(
      `mission_ids illisible pour le paquet ${row.package_id} — diag: valeur brute=${preview} ` +
        `err=${e instanceof Error ? e.message : String(e)}`,
    );
  }
  return {
    packageId: row.package_id,
    operatorUserId: row.operator_user_id,
    operatorEmail: row.operator_email,
    formatVersion: row.format_version,
    schemaVersion: row.schema_version,
    generatedAt: row.generated_at,
    expiresAt: row.expires_at,
    signingKeyId: row.signing_key_id,
    passwordSaltB64: row.password_salt_b64,
    argon2MCost: row.argon2_m_cost,
    argon2TCost: row.argon2_t_cost,
    argon2PCost: row.argon2_p_cost,
    argon2HashLen: row.argon2_hash_len,
    missionIds,
    dataBinPath: row.data_bin_path,
    mbtilesPath: row.mbtiles_path,
    importedAt: row.imported_at,
    lastUnlockedAt: row.last_unlocked_at,
  };
}

export const atlaspackRepository = {
  async saveImportedPackage(meta: AtlasPackMeta): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO atlaspack_meta
       (package_id, operator_user_id, operator_email, format_version, schema_version,
        generated_at, expires_at, signing_key_id, password_salt_b64, argon2_m_cost,
        argon2_t_cost, argon2_p_cost, argon2_hash_len, mission_ids, data_bin_path, mbtiles_path, imported_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        meta.packageId, meta.operatorUserId, meta.operatorEmail, meta.formatVersion, meta.schemaVersion,
        meta.generatedAt, meta.expiresAt, meta.signingKeyId, meta.passwordSaltB64, meta.argon2MCost,
        meta.argon2TCost, meta.argon2PCost, meta.argon2HashLen, JSON.stringify(meta.missionIds),
        meta.dataBinPath, meta.mbtilesPath, meta.importedAt,
      ],
    );
    await this.recordAuditEvent({
      eventType: 'package_imported',
      operatorUserId: meta.operatorUserId,
      missionId: null,
      objectType: 'atlaspack',
      objectId: meta.packageId,
      oldValues: null,
      newValues: { mission_count: meta.missionIds.length },
      metadata: { signing_key_id: meta.signingKeyId },
    });
  },

  /** Le paquet le plus récemment importé — l'app n'en garde qu'un actif à la fois. */
  async getActivePackageMeta(): Promise<AtlasPackMeta | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<AtlasPackMetaRow>(
      'SELECT * FROM atlaspack_meta ORDER BY imported_at DESC LIMIT 1',
    );
    if (!row) return null;
    return rowToAtlasPackMeta(row);
  },

  async getPackageMetaByOperatorEmail(email: string): Promise<AtlasPackMeta | null> {
    const db = await getDb();
    const row = await db.getFirstAsync<AtlasPackMetaRow>(
      'SELECT * FROM atlaspack_meta WHERE lower(operator_email) = lower(?) ORDER BY imported_at DESC LIMIT 1',
      [email],
    );
    if (!row) return null;
    return rowToAtlasPackMeta(row);
  },

  async markUnlocked(packageId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync('UPDATE atlaspack_meta SET last_unlocked_at = ? WHERE package_id = ?', [
      new Date().toISOString(),
      packageId,
    ]);
  },

  // ── Journal d'audit ─────────────────────────────────────────────────────

  async recordAuditEvent(event: Omit<AuditEvent, 'id' | 'occurredAt'>): Promise<string> {
    const db = await getDb();
    const id = newUuid();
    const occurredAt = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO audit_log (id, event_type, occurred_at, operator_user_id, mission_id, object_type, object_id, old_values, new_values, metadata)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        id, event.eventType, occurredAt, event.operatorUserId, event.missionId,
        event.objectType, event.objectId,
        event.oldValues !== null && event.oldValues !== undefined ? JSON.stringify(event.oldValues) : null,
        event.newValues !== null && event.newValues !== undefined ? JSON.stringify(event.newValues) : null,
        event.metadata !== null && event.metadata !== undefined ? JSON.stringify(event.metadata) : null,
      ],
    );
    return id;
  },

  async listAuditLog(limit = 200): Promise<AuditEvent[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string; event_type: AuditEventType; occurred_at: string; operator_user_id: string | null;
      mission_id: string | null; object_type: string | null; object_id: string | null;
      old_values: string | null; new_values: string | null; metadata: string | null;
    }>('SELECT * FROM audit_log ORDER BY occurred_at DESC LIMIT ?', [limit]);
    return rows.map((r) => ({
      id: r.id,
      eventType: r.event_type,
      occurredAt: r.occurred_at,
      operatorUserId: r.operator_user_id,
      missionId: r.mission_id,
      objectType: r.object_type,
      objectId: r.object_id,
      oldValues: r.old_values ? JSON.parse(r.old_values) : null,
      newValues: r.new_values ? JSON.parse(r.new_values) : null,
      metadata: r.metadata ? JSON.parse(r.metadata) : null,
    }));
  },

  // ── Résultats de laboratoire (hors-ligne) ───────────────────────────────

  async saveLabResultDraft(draft: LabResultDraft): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO lab_results_draft (id, mission_id, sondage_id, sample_code, depth_top_m, depth_bottom_m, sample, tests, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.id, draft.missionId, draft.sondageId, draft.sampleCode, draft.depthTopM, draft.depthBottomM,
        JSON.stringify(draft.sample), JSON.stringify(draft.tests), draft.status, draft.createdAt,
      ],
    );
  },

  async listLabResultsForMission(missionId: string): Promise<LabResultDraft[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string; mission_id: string; sondage_id: string; sample_code: string;
      depth_top_m: number; depth_bottom_m: number; sample: string; tests: string;
      status: 'draft' | 'complete'; created_at: string;
    }>('SELECT * FROM lab_results_draft WHERE mission_id = ? ORDER BY created_at DESC', [missionId]);
    return rows.map((r) => ({
      id: r.id, missionId: r.mission_id, sondageId: r.sondage_id, sampleCode: r.sample_code,
      depthTopM: r.depth_top_m, depthBottomM: r.depth_bottom_m,
      sample: JSON.parse(r.sample), tests: JSON.parse(r.tests), status: r.status, createdAt: r.created_at,
    }));
  },

  // ── Pièces jointes ───────────────────────────────────────────────────────

  async saveAttachmentDraft(draft: AttachmentDraft): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT OR REPLACE INTO attachments_draft (id, mission_id, sondage_id, kind, file_uri, file_name, content_type, caption, taken_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        draft.id, draft.missionId, draft.sondageId, draft.kind, draft.fileUri, draft.fileName,
        draft.contentType, draft.caption, draft.takenAt, draft.createdAt,
      ],
    );
  },

  async listAttachmentsForSondage(sondageId: string): Promise<AttachmentDraft[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string; mission_id: string | null; sondage_id: string; kind: string; file_uri: string;
      file_name: string; content_type: string; caption: string | null; taken_at: string | null; created_at: string;
    }>('SELECT * FROM attachments_draft WHERE sondage_id = ? ORDER BY created_at', [sondageId]);
    return rows.map((r) => ({
      id: r.id, missionId: r.mission_id, sondageId: r.sondage_id, kind: r.kind, fileUri: r.file_uri,
      fileName: r.file_name, contentType: r.content_type, caption: r.caption, takenAt: r.taken_at, createdAt: r.created_at,
    }));
  },

  async listAttachmentsForMissions(missionIds: string[]): Promise<AttachmentDraft[]> {
    if (missionIds.length === 0) return [];
    const db = await getDb();
    const placeholders = missionIds.map(() => '?').join(',');
    const rows = await db.getAllAsync<{
      id: string; mission_id: string | null; sondage_id: string; kind: string; file_uri: string;
      file_name: string; content_type: string; caption: string | null; taken_at: string | null; created_at: string;
    }>(`SELECT * FROM attachments_draft WHERE mission_id IN (${placeholders}) ORDER BY created_at`, missionIds);
    return rows.map((r) => ({
      id: r.id, missionId: r.mission_id, sondageId: r.sondage_id, kind: r.kind, fileUri: r.file_uri,
      fileName: r.file_name, contentType: r.content_type, caption: r.caption, takenAt: r.taken_at, createdAt: r.created_at,
    }));
  },

  // ── États d'export (exigence #9 : Non exporté / Exporté / Importé au bureau) ─

  async recordExport(entry: Omit<ExportLogEntry, 'state' | 'hqConfirmedAt'>): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      `INSERT INTO exports_log (id, mission_ids, generated_at, file_uri, size_bytes, sha256, state)
       VALUES (?, ?, ?, ?, ?, ?, 'exported')`,
      [entry.id, JSON.stringify(entry.missionIds), entry.generatedAt, entry.fileUri, entry.sizeBytes, entry.sha256],
    );
  },

  /**
   * Marque comme remontées toutes les saisies des missions exportées.
   *
   * Sans cette marque, rien ne distingue une fiche déjà partie au bureau
   * d'une fiche encore locale — et le déchargement d'un paquet ne pourrait
   * pas refuser d'effacer du travail de terrain.
   */
  async markExported(missionIds: string[], exportedAt: string): Promise<void> {
    if (missionIds.length === 0) return;
    const db = await getDb();
    const holes = missionIds.map(() => '?').join(',');
    for (const table of ['sondages_draft', 'lab_results_draft', 'attachments_draft', 'field_logs_draft']) {
      await db.runAsync(
        `UPDATE ${table} SET exported_at = ? WHERE exported_at IS NULL AND mission_id IN (${holes})`,
        [exportedAt, ...missionIds],
      );
    }
  },

  /** Saisies encore locales, par nature. Un total > 0 interdit le déchargement. */
  async countPendingFieldData(): Promise<{
    sondages: number;
    labResults: number;
    attachments: number;
    fieldLogs: number;
    total: number;
  }> {
    const db = await getDb();
    const count = async (table: string): Promise<number> => {
      const row = await db.getFirstAsync<{ n: number }>(
        `SELECT COUNT(*) AS n FROM ${table} WHERE exported_at IS NULL`,
      );
      return row?.n ?? 0;
    };
    const sondages = await count('sondages_draft');
    const labResults = await count('lab_results_draft');
    const attachments = await count('attachments_draft');
    const fieldLogs = await count('field_logs_draft');
    return {
      sondages,
      labResults,
      attachments,
      fieldLogs,
      total: sondages + labResults + attachments + fieldLogs,
    };
  },

  /**
   * Décharge le paquet actif et efface les données de mission qu'il portait.
   *
   * Refuse tant qu'il reste une saisie non exportée : le déchargement est
   * irréversible et le terrain ne se refait pas. L'opérateur doit d'abord
   * produire son `.atlasreturn`.
   */
  async unloadActivePackage(): Promise<{ unloaded: boolean; pendingTotal: number }> {
    const pending = await this.countPendingFieldData();
    if (pending.total > 0) {
      return { unloaded: false, pendingTotal: pending.total };
    }
    const meta = await this.getActivePackageMeta();
    const db = await getDb();
    await db.execAsync(`
      DELETE FROM sondages_draft;
      DELETE FROM lab_results_draft;
      DELETE FROM attachments_draft;
      DELETE FROM field_logs_draft;
      DELETE FROM sync_queue;
      DELETE FROM mission_planned_points;
      DELETE FROM mission_map_cache;
      DELETE FROM missions;
      DELETE FROM atlaspack_meta;
    `);
    if (meta) {
      await this.recordAuditEvent({
        eventType: 'package_unloaded',
        operatorUserId: meta.operatorUserId,
        missionId: null,
        objectType: 'atlaspack',
        objectId: meta.packageId,
        oldValues: null,
        newValues: { operator_email: meta.operatorEmail },
        metadata: { missions: meta.missionIds.length },
      });
    }
    return { unloaded: true, pendingTotal: 0 };
  },

  /** Transition exported -> imported_hq UNIQUEMENT (jamais en arrière) — appelée
   * après confirmation opportuniste auprès du serveur (jamais requise pour le workflow). */
  async confirmHqImport(exportId: string): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      "UPDATE exports_log SET state = 'imported_hq', hq_confirmed_at = ? WHERE id = ? AND state = 'exported'",
      [new Date().toISOString(), exportId],
    );
  },

  async listExports(): Promise<ExportLogEntry[]> {
    const db = await getDb();
    const rows = await db.getAllAsync<{
      id: string; mission_ids: string; generated_at: string; file_uri: string;
      size_bytes: number; sha256: string; state: ExportState; hq_confirmed_at: string | null;
    }>('SELECT * FROM exports_log ORDER BY generated_at DESC');
    return rows.map((r) => ({
      id: r.id, missionIds: JSON.parse(r.mission_ids), generatedAt: r.generated_at, fileUri: r.file_uri,
      sizeBytes: r.size_bytes, sha256: r.sha256, state: r.state, hqConfirmedAt: r.hq_confirmed_at,
    }));
  },

  /** État affiché pour une mission : le plus avancé parmi ses exports connus,
   * ou "not_exported" si elle n'apparaît dans aucun export enregistré. */
  async getMissionExportState(missionId: string): Promise<'not_exported' | ExportState> {
    const exports = await this.listExports();
    const relevant = exports.filter((e) => e.missionIds.includes(missionId));
    if (relevant.length === 0) return 'not_exported';
    return relevant.some((e) => e.state === 'imported_hq') ? 'imported_hq' : 'exported';
  },

  // ── Sauvegarde locale ────────────────────────────────────────────────────

  async recordBackup(entry: { id: string; fileUri: string; sizeBytes: number; sha256: string; schemaVersion: number }): Promise<void> {
    const db = await getDb();
    await db.runAsync(
      'INSERT INTO backups_log (id, created_at, file_uri, size_bytes, sha256, schema_version) VALUES (?, ?, ?, ?, ?, ?)',
      [entry.id, new Date().toISOString(), entry.fileUri, entry.sizeBytes, entry.sha256, entry.schemaVersion],
    );
  },

  async listBackups(): Promise<Array<{ id: string; createdAt: string; fileUri: string; sizeBytes: number; sha256: string }>> {
    const db = await getDb();
    const rows = await db.getAllAsync<{ id: string; created_at: string; file_uri: string; size_bytes: number; sha256: string }>(
      'SELECT * FROM backups_log ORDER BY created_at DESC',
    );
    return rows.map((r) => ({ id: r.id, createdAt: r.created_at, fileUri: r.file_uri, sizeBytes: r.size_bytes, sha256: r.sha256 }));
  },
};
