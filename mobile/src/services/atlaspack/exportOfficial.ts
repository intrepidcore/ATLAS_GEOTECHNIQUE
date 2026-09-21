/**
 * Construit l'export terrain officiel `.atlasreturn` : `manifest.json` +
 * `manifest.mac` (HMAC, cf. crypto.ts) + `data.json` + `attachments/*`.
 * Contrepartie mobile de `services/api-geo/src/atlaspack/returns.rs`
 * (import_atlasreturn) — tout changement de format doit être répercuté des
 * deux côtés.
 */
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { zip } from 'react-native-zip-archive';

import { bytesToB64, deriveReturnMacKey, hmacSha256, sha256Hex, uuidToBytes, utf8ToBytes } from './crypto';
import {
  FORMAT_VERSION,
  ReturnData,
  ReturnManifest,
  RETURN_DATA_FILE,
  RETURN_MAC_FILE,
  RETURN_MANIFEST_FILE,
} from './format';
import { atlaspackRepository, newUuid } from './repository';
import { atlaspackSession } from './session';
import { repository as missionRepository } from '@/db/repository';

export class AtlasPackExportError extends Error {}

function b64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function computeRootHash(files: Record<string, { sha256: string; size_bytes: number }>): string {
  const hashes = Object.values(files)
    .map((f) => f.sha256)
    .sort();
  return sha256Hex(utf8ToBytes(hashes.join('')));
}

/**
 * Code lisible pour un sondage créé hors-ligne. Le `client_id` est un UUID :
 * exporté tel quel, il devenait le code affiché au bureau dans
 * `atlas.sondages.code`. On reprend ici la convention du serveur
 * (`S-AAAAMMJJ-XXXX`) de façon déterministe, pour qu'un même sondage
 * ré-exporté deux fois garde le même code.
 */
function offlineSondageCode(s: { client_id: string; created_at: string }): string {
  const d = new Date(s.created_at);
  const ymd = Number.isNaN(d.getTime())
    ? '00000000'
    : `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, '0')}${String(d.getUTCDate()).padStart(2, '0')}`;
  const suffix = s.client_id.replace(/[^0-9a-zA-Z]/g, '').slice(0, 4).toUpperCase();
  return `S-${ymd}-${suffix}`;
}

export interface ExportResult {
  exportId: string;
  fileUri: string;
  sizeBytes: number;
  sha256: string;
  missionsCount: number;
  sondagesCount: number;
}

/**
 * Construit et partage (feuille native Android) l'export officiel signé
 * pour `missionIds`. Nécessite une session déverrouillée (cf. unlock.ts) —
 * la même matière première Argon2id sert à signer l'export qu'à déverrouiller
 * le paquet, sans redemander le mot de passe (mise en cache mémoire uniquement).
 */
export async function buildAndShareOfficialExport(missionIds: string[]): Promise<ExportResult> {
  const session = atlaspackSession.get();
  if (!session) {
    throw new AtlasPackExportError('Session verrouillée — reconnectez-vous avant d\'exporter');
  }
  if (missionIds.length === 0) {
    throw new AtlasPackExportError('Aucune mission sélectionnée pour cet export');
  }

  const exportId = newUuid();
  const staging = `${FileSystem.cacheDirectory}atlasreturn-staging-${exportId}/`;
  const attachmentsDir = `${staging}attachments/`;

  try {
    await FileSystem.makeDirectoryAsync(attachmentsDir, { intermediates: true });

    const sondages = await missionRepository.getDraftsForMissions(missionIds);
    const fieldLogs = await missionRepository.getFieldLogsForMissions(missionIds);
    const labResultsRaw = (
      await Promise.all(missionIds.map((id) => atlaspackRepository.listLabResultsForMission(id)))
    ).flat();
    const attachmentsRaw = await atlaspackRepository.listAttachmentsForMissions(missionIds);

    const data: ReturnData = {
      schema_version: 1,
      sondages: sondages.map((s) => ({
        // `server_id` en priorité : un sondage déjà synchronisé en ligne existe
        // au bureau sous l'identifiant attribué par le serveur, PAS sous son
        // `client_id`. L'exporter sous le client_id créait une seconde ligne
        // dans atlas.sondages (l'INSERT est idempotent sur l'id, donc deux ids
        // distincts = deux sondages) : le même point terrain comptait double.
        id: s.server_id ?? s.client_id,
        mission_id: s.mission_id,
        planned_point_id: s.planned_point_id,
        code: offlineSondageCode(s),
        longitude: s.longitude,
        latitude: s.latitude,
        location_accuracy_m: s.location_accuracy_m,
        depth_m: s.depth_m,
        layers_count: s.layers_count,
        profile_description: s.profile_description,
        notes: s.notes,
        point_name: s.point_name,
        relocation_reason: s.relocation_reason,
        created_at: s.created_at,
      })),
      lab_results: labResultsRaw.map((lr) => ({
        id: lr.id,
        mission_id: lr.missionId,
        sondage_id: lr.sondageId,
        sample_code: lr.sampleCode,
        depth_top_m: lr.depthTopM,
        depth_bottom_m: lr.depthBottomM,
        sample: lr.sample,
        tests: lr.tests,
        status: lr.status,
        created_at: lr.createdAt,
      })),
      field_logs: fieldLogs.map((log) => ({
        id: log.client_id,
        mission_id: log.mission_id,
        log_type: log.log_type,
        content: log.content,
        longitude: log.longitude,
        latitude: log.latitude,
        created_at: log.created_at,
      })),
      attachments: attachmentsRaw.map((a) => {
        const ext = a.fileName.split('.').pop() || 'bin';
        return {
          id: a.id,
          sondage_id: a.sondageId,
          mission_id: a.missionId,
          kind: a.kind,
          file_name: a.fileName,
          content_type: a.contentType,
          caption: a.caption,
          taken_at: a.takenAt,
          archive_path: `attachments/${a.id}.${ext}`,
          sha256: '',
          size_bytes: 0,
        };
      }),
      audit_events: (await atlaspackRepository.listAuditLog(5000))
        .filter((e) => e.missionId === null || missionIds.includes(e.missionId))
        .map((e) => ({
          id: e.id,
          mission_id: e.missionId,
          event_type: e.eventType,
          occurred_at: e.occurredAt,
          object_type: e.objectType,
          object_id: e.objectId,
          old_values: e.oldValues,
          new_values: e.newValues,
          metadata: e.metadata,
        })),
    };

    // Copie les pièces jointes dans le staging + calcule leurs empreintes réelles.
    for (let i = 0; i < attachmentsRaw.length; i++) {
      const a = attachmentsRaw[i];
      const entry = data.attachments[i];
      const destPath = `${staging}${entry.archive_path}`;
      await FileSystem.copyAsync({ from: a.fileUri, to: destPath });
      const b64 = await FileSystem.readAsStringAsync(destPath, { encoding: FileSystem.EncodingType.Base64 });
      const bytes = b64ToBytes(b64);
      entry.sha256 = sha256Hex(bytes);
      entry.size_bytes = bytes.length;
    }

    const dataBytes = utf8ToBytes(JSON.stringify(data));
    const dataPath = `${staging}${RETURN_DATA_FILE}`;
    await FileSystem.writeAsStringAsync(dataPath, bytesToB64(dataBytes), { encoding: FileSystem.EncodingType.Base64 });

    const files: Record<string, { sha256: string; size_bytes: number }> = {
      [RETURN_DATA_FILE]: { sha256: sha256Hex(dataBytes), size_bytes: dataBytes.length },
    };
    for (const a of data.attachments) {
      files[a.archive_path] = { sha256: a.sha256, size_bytes: a.size_bytes };
    }

    const manifest: ReturnManifest = {
      format_version: FORMAT_VERSION,
      export_id: exportId,
      package_id: session.packageId,
      operator_user_id: session.operatorUserId,
      operator_email: session.operatorEmail,
      generated_at: new Date().toISOString(),
      missions_count: missionIds.length,
      sondages_count: data.sondages.length,
      essais_count: data.lab_results.length,
      resultats_count: data.lab_results.length,
      attachments_count: data.attachments.length,
      size_bytes: dataBytes.length,
      sha256: '',
      files,
    };
    manifest.sha256 = computeRootHash(files);

    const manifestBytes = utf8ToBytes(JSON.stringify(manifest));
    const manifestPath = `${staging}${RETURN_MANIFEST_FILE}`;
    await FileSystem.writeAsStringAsync(manifestPath, bytesToB64(manifestBytes), { encoding: FileSystem.EncodingType.Base64 });

    const macKey = deriveReturnMacKey(session.rawArgon2Output, uuidToBytes(exportId));
    const mac = hmacSha256(macKey, manifestBytes);
    const macPath = `${staging}${RETURN_MAC_FILE}`;
    await FileSystem.writeAsStringAsync(macPath, bytesToB64(mac), { encoding: FileSystem.EncodingType.Base64 });

    const exportsRoot = `${FileSystem.documentDirectory}atlasreturn/`;
    await FileSystem.makeDirectoryAsync(exportsRoot, { intermediates: true }).catch(() => {});
    const finalZipPath = `${exportsRoot}atlas-terrain-${exportId}.atlasreturn`;
    await zip(staging, finalZipPath);

    const zipInfo = await FileSystem.getInfoAsync(finalZipPath, { size: true });
    const zipB64 = await FileSystem.readAsStringAsync(finalZipPath, { encoding: FileSystem.EncodingType.Base64 });
    const zipSha256 = sha256Hex(b64ToBytes(zipB64));
    const sizeBytes = zipInfo.exists ? zipInfo.size : zipB64.length;

    await atlaspackRepository.recordExport({
      id: exportId,
      missionIds,
      generatedAt: manifest.generated_at,
      fileUri: finalZipPath,
      sizeBytes,
      sha256: zipSha256,
    });
    // Les saisies parties dans ce .atlasreturn ne bloquent plus le
    // déchargement du paquet.
    await atlaspackRepository.markExported(missionIds, manifest.generated_at);
    await atlaspackRepository.recordAuditEvent({
      eventType: 'export',
      operatorUserId: session.operatorUserId,
      missionId: null,
      objectType: 'atlasreturn',
      objectId: exportId,
      oldValues: null,
      newValues: { missions: missionIds, sondages: data.sondages.length },
      metadata: { sha256: zipSha256, size_bytes: sizeBytes },
    });

    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(finalZipPath, {
        mimeType: 'application/octet-stream',
        dialogTitle: 'Envoyer la collecte terrain au bureau Atlas Colab',
      });
    }

    return {
      exportId,
      fileUri: finalZipPath,
      sizeBytes,
      sha256: zipSha256,
      missionsCount: missionIds.length,
      sondagesCount: data.sondages.length,
    };
  } finally {
    await FileSystem.deleteAsync(staging, { idempotent: true }).catch(() => {});
  }
}
