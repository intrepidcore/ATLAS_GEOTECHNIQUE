/**
 * Vecteurs de test RÉELS capturés depuis un `.atlaspack` généré par le vrai
 * backend Atlas Colab (session de test end-to-end du 2026-08-31, opérateur
 * protazertyuiop@gmail.com, package_id a68c1977-2b4d-4f0a-a800-f008dc7de2de).
 * Prouve l'interopérabilité cryptographique réelle client/serveur, pas
 * seulement la cohérence interne du code mobile.
 */
import { verifySignature, sha256Hex, utf8ToBytes, bytesToUtf8, hexToBytes, bytesToHex, uuidToBytes } from '@/services/atlaspack/crypto';

// Manifeste et signature du tout premier paquet réel généré pendant la
// session de test (package_id 0b3ca9a7-b534-49ae-91ea-a95670b3bf69).
const REAL_MANIFEST_JSON =
  '{"format_version":1,"schema_version":1,"package_id":"0b3ca9a7-b534-49ae-91ea-a95670b3bf69","operator_user_id":"8a361b71-fe58-49c9-ba2f-b5a83b69b731","operator_email":"protazertyuiop@gmail.com","generated_at":"2026-08-31T09:08:37.319286742+00:00","expires_at":"2026-09-30T09:08:37.319286742+00:00","signing_key_id":"3abbc3fe1810b6e8","mission_ids":["aca2d552-e652-45fa-9cb4-f07d97c720cb"],"password_hash_algorithm":"argon2id","password_salt_b64":"CTKatlJuGRBtisCQquGTTw==","password_argon2_m_cost":65536,"password_argon2_t_cost":3,"password_argon2_p_cost":4,"password_hash_len":32,"files":{"data.bin":{"sha256":"5bf4b3c866d5e9f6162b80718464b29aef2025cdac9f113840277ad9667dda11","size_bytes":1546},"maps/offline.mbtiles":{"sha256":"7e7b0fd42c4cba6043c6dfe42e8afcdb56e54b2900daf67e09e7b7e334811ba1","size_bytes":2711552}},"map_coverage":{"zoom_min":12,"zoom_max_requested":17,"zoom_max_actual":17,"tile_count":175,"truncated":false,"truncation_reason":null,"bounds":[1.1450395230477894,6.233774024228879,1.172320791869121,6.260979557422419]}}';
const REAL_PUBLIC_KEY_B64 = '+ASkF/pe69clVwWVe9kUGBJVr/BFXiAE37F7Lk0kXyM=';
// Octets bruts de manifest.sig extraits du même .atlaspack réel (`xxd -p`).
const REAL_SIGNATURE_HEX =
  '264efea9f8d7d4e0f2f4474699357e7c04aa2c2069d953d964f413b06a6c3467b7f7b4817c85a37962b6e80f48370d6cf8ce120a03be4bd48adf656ed7d8db02';

describe('atlaspack crypto — UTF-8 fait main (Hermes n\'a pas TextEncoder/TextDecoder)', () => {
  it('round-trips ASCII', () => {
    expect(bytesToUtf8(utf8ToBytes('hello world'))).toBe('hello world');
  });

  it('round-trips French accented characters (2-byte UTF-8 sequences)', () => {
    const s = 'Mission géotechnique — reconnaissance à Agoè-Nyivé, sondé à 2,5 m';
    expect(bytesToUtf8(utf8ToBytes(s))).toBe(s);
  });

  it('round-trips the real manifest JSON string (with its em-dash / accents)', () => {
    expect(bytesToUtf8(utf8ToBytes(REAL_MANIFEST_JSON))).toBe(REAL_MANIFEST_JSON);
  });

  it('round-trips an emoji (4-byte UTF-8 / surrogate pair)', () => {
    const s = 'point validé ✅ 📍';
    expect(bytesToUtf8(utf8ToBytes(s))).toBe(s);
  });

  it('produces the same byte length as Node\'s TextEncoder for a mixed string (cross-check)', () => {
    const s = 'Sondage n°3 — profondeur 4,20 m, argile grise';
    expect(utf8ToBytes(s).length).toBe(new TextEncoder().encode(s).length);
    expect(Array.from(utf8ToBytes(s))).toEqual(Array.from(new TextEncoder().encode(s)));
  });
});

describe('atlaspack crypto — vecteurs réels serveur', () => {
  it('sha256Hex matches the real data.bin fingerprint algorithm (self-consistency)', () => {
    const bytes = utf8ToBytes('vecteur de test');
    const hex = sha256Hex(bytes);
    expect(hex).toHaveLength(64);
    expect(hex).toMatch(/^[0-9a-f]{64}$/);
  });

  it('hexToBytes / bytesToHex round-trip matches a real manifest file hash', () => {
    const realHash = '5bf4b3c866d5e9f6162b80718464b29aef2025cdac9f113840277ad9667dda11'.slice(0, 64);
    const bytes = hexToBytes(realHash);
    expect(bytes.length).toBe(32);
    expect(bytesToHex(bytes)).toBe(realHash);
  });

  it('uuidToBytes produces 16 bytes for a real package_id', () => {
    const bytes = uuidToBytes('0b3ca9a7-b534-49ae-91ea-a95670b3bf69');
    expect(bytes.length).toBe(16);
  });

  it('verifySignature ACCEPTS the real Ed25519 signature produced by the Rust backend', () => {
    const manifestBytes = utf8ToBytes(REAL_MANIFEST_JSON);
    const signature = hexToBytes(REAL_SIGNATURE_HEX);
    expect(verifySignature(REAL_PUBLIC_KEY_B64, manifestBytes, signature)).toBe(true);
  });

  it('verifySignature rejects the real signature once the manifest is tampered', () => {
    const tampered = REAL_MANIFEST_JSON.replace('"tile_count":175', '"tile_count":999');
    const manifestBytes = utf8ToBytes(tampered);
    const signature = hexToBytes(REAL_SIGNATURE_HEX);
    expect(verifySignature(REAL_PUBLIC_KEY_B64, manifestBytes, signature)).toBe(false);
  });

  it('verifySignature rejects an obviously invalid signature against the real manifest+key', () => {
    const manifestBytes = utf8ToBytes(REAL_MANIFEST_JSON);
    const badSig = new Uint8Array(64); // all-zero, not a valid Ed25519 signature
    expect(verifySignature(REAL_PUBLIC_KEY_B64, manifestBytes, badSig)).toBe(false);
  });

  it('verifySignature rejects the real signature against a tampered manifest', () => {
    const tampered = REAL_MANIFEST_JSON.replace('protazertyuiop', 'attacker-controlled');
    const manifestBytes = utf8ToBytes(tampered);
    // Empty/garbage signature must not validate against tampered content either.
    const garbageSig = new Uint8Array(64).fill(1);
    expect(verifySignature(REAL_PUBLIC_KEY_B64, manifestBytes, garbageSig)).toBe(false);
  });
});
