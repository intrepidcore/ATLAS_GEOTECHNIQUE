/**
 * Primitives cryptographiques `.atlaspack` côté mobile — miroir exact de
 * services/api-geo/src/atlaspack/crypto.rs. AUCUNE primitive maison :
 * Ed25519 (@noble/curves, pure JS, audité), ChaCha20-Poly1305 et
 * HMAC-SHA256/HKDF-SHA256 (@noble/hashes + @noble/ciphers, pure JS — Hermes
 * n'exécute pas WebAssembly, donc les libs pures JS auditées type "noble"
 * sont le bon choix ici, pas de binding natif nécessaire pour ces trois-là).
 *
 * Argon2id est la seule primitive qui a besoin d'un binding natif
 * (mémoire-dur, une implémentation JS pure serait trop lente sur téléphone
 * pour un temps de connexion acceptable) : voir argon2.ts, qui utilise
 * react-native-argon2 (bindings vers l'implémentation C de référence
 * phc-winner-argon2 — vérifié bit-à-bit identique à la sortie du crate Rust
 * `argon2` côté serveur, cf. docs/mobile/ATLASPACK_SERVERLESS.md).
 */
import { ed25519 } from '@noble/curves/ed25519.js';
import { hkdf } from '@noble/hashes/hkdf.js';
import { hmac } from '@noble/hashes/hmac.js';
import { sha256 } from '@noble/hashes/sha2.js';
import { chacha20poly1305 } from '@noble/ciphers/chacha.js';

export const NONCE_LEN = 12;

export class AtlasPackCryptoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AtlasPackCryptoError';
  }
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = globalThis.atob ? globalThis.atob(b64) : base64DecodePolyfill(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}

// Hermes fournit atob/btoa depuis RN 0.74 — polyfill minimal de secours
// uniquement si absent (ancien moteur), pour ne jamais planter au démarrage.
function base64DecodePolyfill(b64: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
  const str = b64.replace(/[^A-Za-z0-9+/=]/g, '');
  let output = '';
  for (let i = 0; i < str.length; i += 4) {
    const enc1 = chars.indexOf(str.charAt(i));
    const enc2 = chars.indexOf(str.charAt(i + 1));
    const enc3 = chars.indexOf(str.charAt(i + 2));
    const enc4 = chars.indexOf(str.charAt(i + 3));
    const chr1 = (enc1 << 2) | (enc2 >> 4);
    const chr2 = ((enc2 & 15) << 4) | (enc3 >> 2);
    const chr3 = ((enc3 & 3) << 6) | enc4;
    output += String.fromCharCode(chr1);
    if (enc3 !== 64 && enc3 !== -1) output += String.fromCharCode(chr2);
    if (enc4 !== 64 && enc4 !== -1) output += String.fromCharCode(chr3);
  }
  return output;
}

export function hexToBytes(hex: string): Uint8Array {
  const clean = hex.trim();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

export function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

export function bytesToB64(bytes: Uint8Array): string {
  let bin = '';
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  // `Buffer` n'existe pas sous Hermes (Node uniquement) — même repli que
  // base64DecodePolyfill ci-dessus si `btoa` venait à manquer un jour.
  return globalThis.btoa ? globalThis.btoa(bin) : base64EncodePolyfill(bin);
}

function base64EncodePolyfill(bin: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
  let output = '';
  for (let i = 0; i < bin.length; i += 3) {
    const b1 = bin.charCodeAt(i);
    const b2 = i + 1 < bin.length ? bin.charCodeAt(i + 1) : NaN;
    const b3 = i + 2 < bin.length ? bin.charCodeAt(i + 2) : NaN;
    output += chars[b1 >> 2];
    output += chars[((b1 & 3) << 4) | (isNaN(b2) ? 0 : b2 >> 4)];
    output += isNaN(b2) ? '=' : chars[((b2 & 15) << 2) | (isNaN(b3) ? 0 : b3 >> 6)];
    output += isNaN(b3) ? '=' : chars[b3 & 63];
  }
  return output;
}

export function b64ToBytesPublic(b64: string): Uint8Array {
  return b64ToBytes(b64);
}

export function sha256Hex(bytes: Uint8Array): string {
  return bytesToHex(sha256(bytes));
}

/**
 * Encodage/décodage UTF-8 écrits à la main : Hermes (moteur JS de React
 * Native) n'expose PAS `TextEncoder`/`TextDecoder` globalement, contrairement
 * à Node/aux navigateurs — utiliser ces globals plante au runtime sur
 * téléphone alors que ça passe en test Jest/Node (constaté en conditions
 * réelles le 2026-08-31). Algorithme UTF-8 standard, pas une primitive
 * cryptographique — sûr à réimplémenter.
 */
export function utf8ToBytes(s: string): Uint8Array {
  const bytes: number[] = [];
  for (let i = 0; i < s.length; i++) {
    const code = s.codePointAt(i) as number;
    if (code > 0xffff) i++; // seconde moitié d'une paire de substituts déjà consommée
    if (code < 0x80) {
      bytes.push(code);
    } else if (code < 0x800) {
      bytes.push(0xc0 | (code >> 6), 0x80 | (code & 0x3f));
    } else if (code < 0x10000) {
      bytes.push(0xe0 | (code >> 12), 0x80 | ((code >> 6) & 0x3f), 0x80 | (code & 0x3f));
    } else {
      bytes.push(
        0xf0 | (code >> 18),
        0x80 | ((code >> 12) & 0x3f),
        0x80 | ((code >> 6) & 0x3f),
        0x80 | (code & 0x3f),
      );
    }
  }
  return new Uint8Array(bytes);
}

export function bytesToUtf8(bytes: Uint8Array): string {
  let result = '';
  let i = 0;
  while (i < bytes.length) {
    const b1 = bytes[i++];
    if (b1 < 0x80) {
      result += String.fromCharCode(b1);
    } else if ((b1 & 0xe0) === 0xc0) {
      const b2 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x1f) << 6) | (b2 & 0x3f));
    } else if ((b1 & 0xf0) === 0xe0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      result += String.fromCharCode(((b1 & 0x0f) << 12) | ((b2 & 0x3f) << 6) | (b3 & 0x3f));
    } else if ((b1 & 0xf8) === 0xf0) {
      const b2 = bytes[i++];
      const b3 = bytes[i++];
      const b4 = bytes[i++];
      let codepoint = ((b1 & 0x07) << 18) | ((b2 & 0x3f) << 12) | ((b3 & 0x3f) << 6) | (b4 & 0x3f);
      codepoint -= 0x10000;
      result += String.fromCharCode(0xd800 + (codepoint >> 10), 0xdc00 + (codepoint & 0x3ff));
    } else {
      i++; // octet invalide isolé : ignoré plutôt que de faire planter le décodage
    }
  }
  return result;
}

/**
 * Vérifie une signature Ed25519 détachée. `publicKeyB64` DOIT provenir de la
 * configuration embarquée à la compilation de l'app (jamais du paquet
 * lui-même) — cf. app.json -> extra.atlasPackPublicKeyB64.
 */
export function verifySignature(publicKeyB64: string, message: Uint8Array, signature: Uint8Array): boolean {
  try {
    return ed25519.verify(signature, message, b64ToBytes(publicKeyB64));
  } catch {
    return false;
  }
}

/**
 * HKDF-SHA256 (RFC 5869) — identique à `crypto::derive_data_key` côté Rust :
 * salt = package_id (16 octets bruts de l'UUID), info = domaine de séparation.
 */
export function deriveDataKey(rawArgon2Output: Uint8Array, packageIdBytes: Uint8Array): Uint8Array {
  return hkdf(sha256, rawArgon2Output, packageIdBytes, utf8ToBytes('atlas-pack-data-v1'), 32);
}

export function deriveReturnMacKey(rawArgon2Output: Uint8Array, exportIdBytes: Uint8Array): Uint8Array {
  return hkdf(sha256, rawArgon2Output, exportIdBytes, utf8ToBytes('atlas-pack-return-mac-v1'), 32);
}

export function hmacSha256(key: Uint8Array, message: Uint8Array): Uint8Array {
  return hmac(sha256, key, message);
}

/**
 * Déchiffre une sortie de `crypto::encrypt` côté Rust :
 * `nonce (12 octets) || ciphertext+tag`.
 */
export function decryptChacha20Poly1305(key: Uint8Array, data: Uint8Array): Uint8Array {
  if (data.length < NONCE_LEN) {
    throw new AtlasPackCryptoError('paquet corrompu : data.bin trop court');
  }
  const nonce = data.slice(0, NONCE_LEN);
  const ciphertext = data.slice(NONCE_LEN);
  try {
    return chacha20poly1305(key, nonce).decrypt(ciphertext);
  } catch {
    throw new AtlasPackCryptoError(
      'déchiffrement impossible — mot de passe incorrect, ou fichier corrompu/altéré',
    );
  }
}

/** UUID v4 (16 octets) -> bytes bruts, pour servir de sel HKDF (identique au `Uuid::as_bytes()` Rust). */
export function uuidToBytes(uuid: string): Uint8Array {
  const hex = uuid.replace(/-/g, '');
  if (hex.length !== 32) {
    throw new AtlasPackCryptoError(`UUID invalide: ${uuid}`);
  }
  return hexToBytes(hex);
}
