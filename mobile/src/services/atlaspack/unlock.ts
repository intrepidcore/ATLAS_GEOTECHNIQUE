/**
 * Authentification hors-ligne : dérive Argon2id(mot de passe entré, sel du
 * manifeste), en déduit la clé de déchiffrement de `data.bin` (HKDF), et
 * tente le déchiffrement. Le succès du déchiffrement (tag Poly1305 valide)
 * EST la preuve que le mot de passe est correct — aucune comparaison de hash
 * séparée n'est nécessaire (cf. crypto.rs pour la justification complète).
 */
import * as FileSystem from 'expo-file-system';

import { computeArgon2Raw } from './argon2';
import { AtlasPackCryptoError, bytesToUtf8, decryptChacha20Poly1305, deriveDataKey, uuidToBytes } from './crypto';
import type { OperatorPayload } from './format';
import { atlaspackRepository, AtlasPackMeta } from './repository';
import { atlaspackSession } from './session';
import { repository as missionRepository } from '@/db/repository';
import type { MobileMission, MapContext } from '@/api/mobile';

export class AtlasPackUnlockError extends Error {}

async function readBase64AsBytes(uri: string): Promise<Uint8Array> {
  const b64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });
  const bin = globalThis.atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

function toMobileMission(m: OperatorPayload['missions'][number]): MobileMission {
  return {
    id: m.id,
    code: m.code,
    title: m.title,
    theme: m.theme,
    status: m.status,
    start_date: m.start_date,
    end_date: m.end_date,
    maille_id: m.maille_id,
    maille_label: m.maille_label,
    commune: m.commune,
    region: m.region,
    expected_sondages: m.expected_sondages,
    completed_sondages: m.existing_sondages.length,
    percent_done: m.expected_sondages > 0 ? Math.round((m.existing_sondages.length / m.expected_sondages) * 1000) / 10 : 0,
  };
}

function toMapContext(m: OperatorPayload['missions'][number]): MapContext {
  return {
    mission_id: m.id,
    maille_geojson: (m.maille_geojson as MapContext['maille_geojson']) ?? null,
    center_lon: m.center_lon,
    center_lat: m.center_lat,
    bbox: m.bbox
      ? { min_x: m.bbox[0], min_y: m.bbox[1], max_x: m.bbox[2], max_y: m.bbox[3], center_lon: m.center_lon ?? 0, center_lat: m.center_lat ?? 0 }
      : null,
    tolerance_m: m.tolerance_m,
    planned_points: m.planned_points,
    existing_sondages: m.existing_sondages,
  };
}

/**
 * Déverrouille le paquet actif avec `email` + `password`. En cas de succès :
 * décharge les missions/points/contexte carte dans les tables SQLite déjà
 * utilisées par le reste de l'application (MissionsListScreen etc. n'ont
 * besoin d'aucune modification), journalise l'événement, et garde la
 * matière première Argon2id en mémoire pour la session (export signé inclus).
 */
export async function unlockAtlasPack(email: string, password: string): Promise<OperatorPayload> {
  const meta = await atlaspackRepository.getPackageMetaByOperatorEmail(email);
  if (!meta) {
    throw new AtlasPackUnlockError("Aucun paquet importé pour cet email sur cet appareil");
  }
  if (new Date(meta.expiresAt).getTime() < Date.now()) {
    throw new AtlasPackUnlockError(`Paquet expiré le ${meta.expiresAt} — demandez un nouveau paquet au bureau`);
  }

  const rawArgon2Output = await computeArgon2Raw(password, {
    saltB64: meta.passwordSaltB64,
    mCostKib: meta.argon2MCost,
    tCost: meta.argon2TCost,
    pCost: meta.argon2PCost,
    hashLenBytes: meta.argon2HashLen,
  });

  const dataKey = deriveDataKey(rawArgon2Output, uuidToBytes(meta.packageId));
  const encrypted = await readBase64AsBytes(meta.dataBinPath);
  const rawHex = Array.from(rawArgon2Output.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const keyHex = Array.from(dataKey.slice(0, 8))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  const diagPrefix = `rawLen=${rawArgon2Output.length} rawStart=${rawHex} keyLen=${dataKey.length} keyStart=${keyHex} params=(m${meta.argon2MCost},t${meta.argon2TCost},p${meta.argon2PCost},h${meta.argon2HashLen})`;

  let payload: OperatorPayload;
  try {
    const plaintext = decryptChacha20Poly1305(dataKey, encrypted);
    const decoded = bytesToUtf8(plaintext);
    try {
      payload = JSON.parse(decoded);
    } catch (parseError) {
      // Déchiffrement réussi (le tag Poly1305 a validé) mais le résultat
      // n'est pas du JSON valide — diagnostic détaillé plutôt qu'un message
      // générique, pour identifier la cause exacte sans accès à un débogueur
      // sur l'appareil.
      const hexPreview = Array.from(plaintext.slice(0, 24))
        .map((b) => b.toString(16).padStart(2, '0'))
        .join(' ');
      throw new AtlasPackUnlockError(
        `JSON invalide après déchiffrement — diag: ${diagPrefix} encLen=${encrypted.length} ` +
          `plainLen=${plaintext.length} hexStart=[${hexPreview}] strStart="${decoded.slice(0, 80)}" ` +
          `err=${parseError instanceof Error ? parseError.message : String(parseError)}`,
      );
    }
  } catch (e) {
    if (e instanceof AtlasPackUnlockError) throw e;
    if (e instanceof AtlasPackCryptoError) {
      throw new AtlasPackUnlockError(`Mot de passe incorrect — diag: ${diagPrefix} encLen=${encrypted.length} (${e.message})`);
    }
    throw e;
  }

  if (payload.operator.email.toLowerCase() !== email.toLowerCase()) {
    // Ne devrait jamais arriver (le déchiffrement aurait échoué avant), mais
    // on ne fait confiance à aucune donnée client sans revérification.
    throw new AtlasPackUnlockError('Incohérence opérateur détectée — paquet rejeté');
  }

  await hydrateMissions(payload);

  atlaspackSession.set({
    packageId: meta.packageId,
    operatorUserId: payload.operator.user_id,
    operatorEmail: payload.operator.email,
    rawArgon2Output,
    payload,
    unlockedAt: new Date().toISOString(),
  });

  await atlaspackRepository.markUnlocked(meta.packageId);
  await atlaspackRepository.recordAuditEvent({
    eventType: 'login',
    operatorUserId: payload.operator.user_id,
    missionId: null,
    objectType: 'session',
    objectId: meta.packageId,
    oldValues: null,
    newValues: null,
    metadata: { missions_count: payload.missions.length },
  });

  return payload;
}

async function hydrateMissions(payload: OperatorPayload): Promise<void> {
  await missionRepository.saveMissions(payload.missions.map(toMobileMission));
  for (const m of payload.missions) {
    await missionRepository.saveMapContext(m.id, toMapContext(m));
  }
}

export function activePackageMeta(): Promise<AtlasPackMeta | null> {
  return atlaspackRepository.getActivePackageMeta();
}
