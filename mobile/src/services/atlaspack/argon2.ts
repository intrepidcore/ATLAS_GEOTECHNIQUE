/**
 * Wrapper Argon2id — dérive la même sortie brute que `atlas.users.password_hash`
 * côté serveur (RustCrypto `argon2` crate), à partir du mot de passe entré
 * hors-ligne + des paramètres publics du manifeste (sel, m/t/p, longueur).
 *
 * Vérifié bit-à-bit identique à la sortie du crate Rust `argon2` pour les
 * mêmes (mot de passe, sel, m, t, p, longueur) via une vérification croisée
 * avec le binding natif node-argon2 (même famille d'implémentation C de
 * référence que react-native-argon2 utilise sur Android/iOS) —
 * cf. docs/mobile/ATLASPACK_SERVERLESS.md.
 */
import argon2 from 'react-native-argon2';
import { hexToBytes } from './crypto';

export interface Argon2Params {
  saltB64: string;
  mCostKib: number;
  tCost: number;
  pCost: number;
  hashLenBytes: number;
}

/**
 * Calcule Argon2id(password, salt, params) et retourne la sortie BRUTE
 * (32 octets typiquement) — jamais la chaîne PHC, on n'en a pas besoin :
 * cette sortie sert directement de matière première HKDF
 * (cf. crypto.deriveDataKey / deriveReturnMacKey).
 */
export async function computeArgon2Raw(password: string, params: Argon2Params): Promise<Uint8Array> {
  const saltHex = b64ToHex(params.saltB64);
  const result = await argon2(password, saltHex, {
    memory: params.mCostKib,
    iterations: params.tCost,
    parallelism: params.pCost,
    hashLength: params.hashLenBytes,
    mode: 'argon2id',
    saltEncoding: 'hex',
  });
  return hexToBytes(result.rawHash);
}

function b64ToHex(b64: string): string {
  const bin = globalThis.atob(b64);
  let hex = '';
  for (let i = 0; i < bin.length; i++) {
    hex += bin.charCodeAt(i).toString(16).padStart(2, '0');
  }
  return hex;
}
