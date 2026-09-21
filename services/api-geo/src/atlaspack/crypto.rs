//! Primitives cryptographiques du système `.atlaspack`.
//!
//! Aucune primitive maison : Ed25519 (signature), ChaCha20-Poly1305 (AEAD),
//! HKDF-SHA256 (RFC 5869), Argon2id (déjà utilisé pour les mots de passe,
//! réutilisé ici comme KDF déterministe — cf. commentaire sur
//! `derive_data_key_from_password`). Toutes ces crates sont maintenues par
//! RustCrypto / dalek-cryptography.

use base64::{engine::general_purpose::STANDARD as B64, Engine as _};
use chacha20poly1305::{
    aead::{Aead, KeyInit},
    ChaCha20Poly1305, Nonce,
};
use ed25519_dalek::{Signature, Signer, SigningKey, Verifier, VerifyingKey};
use hkdf::Hkdf;
use hmac::{Hmac, Mac};
use rand::RngCore;
use sha2::{Digest, Sha256};

type HmacSha256 = Hmac<Sha256>;

pub const NONCE_LEN: usize = 12;

#[derive(Debug, thiserror::Error)]
pub enum CryptoError {
    #[error("clé de signature .atlaspack absente ou invalide (ATLASPACK_SIGNING_PRIVATE_KEY_B64) : {0}")]
    KeyLoad(String),
    #[error("échec du chiffrement du paquet")]
    Encrypt,
    #[error("échec du déchiffrement — paquet corrompu, mot de passe incorrect, ou modifié")]
    Decrypt,
    #[error("signature invalide")]
    InvalidSignature,
}

/// Trousseau de signature .atlaspack, chargé une fois au démarrage du serveur.
/// La clé privée ne quitte jamais ce process : l'app mobile ne reçoit que
/// `public_key_b64` (embarquée à la compilation, cf. docs/mobile).
#[derive(Clone)]
pub struct AtlasPackSigningKeypair {
    signing_key: SigningKey,
    pub key_id: String,
    pub public_key_b64: String,
}

impl AtlasPackSigningKeypair {
    /// Charge la paire depuis `ATLASPACK_SIGNING_PRIVATE_KEY_B64` (seed Ed25519
    /// 32 octets, base64 standard). Générée une seule fois par
    /// `cargo run --bin generate_atlaspack_keys` puis stockée en variable
    /// d'environnement / secret — jamais dans le dépôt git.
    pub fn from_env() -> Result<Self, CryptoError> {
        let b64 = std::env::var("ATLASPACK_SIGNING_PRIVATE_KEY_B64")
            .map_err(|_| CryptoError::KeyLoad("variable d'environnement absente".into()))?;
        Self::from_seed_b64(&b64)
    }

    pub fn from_seed_b64(b64: &str) -> Result<Self, CryptoError> {
        let seed_bytes = B64
            .decode(b64.trim())
            .map_err(|e| CryptoError::KeyLoad(format!("base64 invalide: {e}")))?;
        let seed: [u8; 32] = seed_bytes
            .try_into()
            .map_err(|_| CryptoError::KeyLoad("la seed doit faire exactement 32 octets".into()))?;
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        let key_id = key_id_for(&verifying_key);
        let public_key_b64 = B64.encode(verifying_key.to_bytes());
        Ok(Self {
            signing_key,
            key_id,
            public_key_b64,
        })
    }

    /// Génère une nouvelle paire (utilisé uniquement par le binaire de génération de clés).
    pub fn generate() -> Self {
        let mut seed = [0u8; 32];
        rand::rngs::OsRng.fill_bytes(&mut seed);
        let signing_key = SigningKey::from_bytes(&seed);
        let verifying_key = signing_key.verifying_key();
        let key_id = key_id_for(&verifying_key);
        let public_key_b64 = B64.encode(verifying_key.to_bytes());
        Self {
            signing_key,
            key_id,
            public_key_b64,
        }
    }

    pub fn seed_b64(&self) -> String {
        B64.encode(self.signing_key.to_bytes())
    }

    pub fn sign(&self, message: &[u8]) -> [u8; 64] {
        self.signing_key.sign(message).to_bytes()
    }
}

/// Fingerprint public stable d'une clé (16 hex chars = 8 octets de sha256(pubkey)).
/// Sert d'identifiant de rotation : `manifest.signing_key_id` référence celui-ci,
/// jamais la clé elle-même.
pub fn key_id_for(verifying_key: &VerifyingKey) -> String {
    let mut h = Sha256::new();
    h.update(verifying_key.to_bytes());
    let digest = h.finalize();
    to_hex(&digest[..8])
}

fn to_hex(bytes: &[u8]) -> String {
    bytes.iter().map(|b| format!("{:02x}", b)).collect()
}

/// Vérifie une signature Ed25519 détachée avec la clé publique embarquée côté
/// mobile (fournie explicitement — jamais lue depuis le paquet lui-même : un
/// paquet ne doit jamais pouvoir attester de sa propre authenticité).
pub fn verify_signature(
    public_key_b64: &str,
    message: &[u8],
    signature_bytes: &[u8],
) -> Result<(), CryptoError> {
    let pk_bytes = B64
        .decode(public_key_b64.trim())
        .map_err(|_| CryptoError::InvalidSignature)?;
    let pk_arr: [u8; 32] = pk_bytes
        .try_into()
        .map_err(|_| CryptoError::InvalidSignature)?;
    let verifying_key =
        VerifyingKey::from_bytes(&pk_arr).map_err(|_| CryptoError::InvalidSignature)?;
    let sig_arr: [u8; 64] = signature_bytes
        .try_into()
        .map_err(|_| CryptoError::InvalidSignature)?;
    let signature = Signature::from_bytes(&sig_arr);
    verifying_key
        .verify(message, &signature)
        .map_err(|_| CryptoError::InvalidSignature)
}

pub fn sha256_hex(bytes: &[u8]) -> String {
    let mut h = Sha256::new();
    h.update(bytes);
    format!("{:x}", h.finalize())
}

/// Dérive la clé de chiffrement des données (`data.bin`) à partir de la sortie
/// brute Argon2id du mot de passe de l'opérateur (32 octets), via
/// HKDF-SHA256 (RFC 5869) avec le package_id comme sel et un `info` de
/// séparation de domaine. Le mobile reproduit exactement ce calcul hors-ligne
/// (même sortie Argon2id que celle déjà stockée côté serveur, car même
/// mot de passe + même sel + mêmes paramètres — ni le serveur ni le mobile
/// n'ont besoin de transmettre une clé : elle est reconstruite localement).
pub fn derive_data_key(argon2_raw_output: &[u8], package_id: &uuid::Uuid) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(package_id.as_bytes()), argon2_raw_output);
    let mut okm = [0u8; 32];
    hk.expand(b"atlas-pack-data-v1", &mut okm)
        .expect("32 octets est une longueur valide pour HKDF-SHA256");
    okm
}

/// Dérive la clé HMAC de contrôle d'intégrité d'un `.atlasreturn`, à partir
/// de la MÊME sortie brute Argon2id (mobile : recalculée hors-ligne au
/// moment de l'export ; serveur : relue depuis `atlas.users.password_hash`
/// au moment du réimport). Sépare le domaine de `derive_data_key` via un
/// `info` HKDF distinct — même mécanisme, deux usages non interchangeables.
///
/// Limite connue : si le mot de passe de l'opérateur change entre l'émission
/// du `.atlaspack` et le réimport du `.atlasreturn`, la sortie Argon2id change
/// aussi (nouveau sel) et cette vérification échouera légitimement — le
/// réimport doit alors être validé manuellement (cf. `atlaspack_returns.status = 'rejected'`).
pub fn derive_return_mac_key(argon2_raw_output: &[u8], export_id: &uuid::Uuid) -> [u8; 32] {
    let hk = Hkdf::<Sha256>::new(Some(export_id.as_bytes()), argon2_raw_output);
    let mut okm = [0u8; 32];
    hk.expand(b"atlas-pack-return-mac-v1", &mut okm)
        .expect("32 octets est une longueur valide pour HKDF-SHA256");
    okm
}

pub fn hmac_sha256(key: &[u8; 32], message: &[u8]) -> [u8; 32] {
    let mut mac =
        <HmacSha256 as Mac>::new_from_slice(key).expect("HMAC-SHA256 accepte toute longueur de clé");
    mac.update(message);
    mac.finalize().into_bytes().into()
}

pub fn verify_hmac_sha256(key: &[u8; 32], message: &[u8], tag: &[u8]) -> bool {
    let mut mac = match <HmacSha256 as Mac>::new_from_slice(key) {
        Ok(m) => m,
        Err(_) => return false,
    };
    mac.update(message);
    mac.verify_slice(tag).is_ok()
}

/// Chiffre `plaintext` avec ChaCha20-Poly1305 (IETF, nonce 96 bits aléatoire).
/// Sortie : `nonce (12) || ciphertext+tag`.
pub fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> Result<Vec<u8>, CryptoError> {
    let cipher = ChaCha20Poly1305::new(key.into());
    let mut nonce_bytes = [0u8; NONCE_LEN];
    rand::rngs::OsRng.fill_bytes(&mut nonce_bytes);
    let nonce = Nonce::from_slice(&nonce_bytes);
    let ciphertext = cipher
        .encrypt(nonce, plaintext)
        .map_err(|_| CryptoError::Encrypt)?;
    let mut out = Vec::with_capacity(NONCE_LEN + ciphertext.len());
    out.extend_from_slice(&nonce_bytes);
    out.extend_from_slice(&ciphertext);
    Ok(out)
}

/// Déchiffre une sortie de [`encrypt`]. Utilisé côté serveur uniquement pour
/// l'auto-vérification post-génération (le déchiffrement réel a lieu sur le
/// mobile, en Rust ici juste pour les tests d'intégration bout-en-bout).
pub fn decrypt(key: &[u8; 32], data: &[u8]) -> Result<Vec<u8>, CryptoError> {
    if data.len() < NONCE_LEN {
        return Err(CryptoError::Decrypt);
    }
    let (nonce_bytes, ciphertext) = data.split_at(NONCE_LEN);
    let cipher = ChaCha20Poly1305::new(key.into());
    let nonce = Nonce::from_slice(nonce_bytes);
    cipher
        .decrypt(nonce, ciphertext)
        .map_err(|_| CryptoError::Decrypt)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn sign_and_verify_roundtrip() {
        let kp = AtlasPackSigningKeypair::generate();
        let msg = b"manifest canonique de test";
        let sig = kp.sign(msg);
        assert!(verify_signature(&kp.public_key_b64, msg, &sig).is_ok());
    }

    #[test]
    fn verify_rejects_tampered_message() {
        let kp = AtlasPackSigningKeypair::generate();
        let sig = kp.sign(b"original");
        assert!(verify_signature(&kp.public_key_b64, b"modifie", &sig).is_err());
    }

    #[test]
    fn verify_rejects_wrong_key() {
        let kp1 = AtlasPackSigningKeypair::generate();
        let kp2 = AtlasPackSigningKeypair::generate();
        let sig = kp1.sign(b"message");
        assert!(verify_signature(&kp2.public_key_b64, b"message", &sig).is_err());
    }

    #[test]
    fn seed_roundtrip_preserves_key_id() {
        let kp1 = AtlasPackSigningKeypair::generate();
        let kp2 = AtlasPackSigningKeypair::from_seed_b64(&kp1.seed_b64()).unwrap();
        assert_eq!(kp1.key_id, kp2.key_id);
        assert_eq!(kp1.public_key_b64, kp2.public_key_b64);
    }

    #[test]
    fn encrypt_decrypt_roundtrip() {
        let key = [7u8; 32];
        let plaintext = b"donnees operateur sensibles";
        let ciphertext = encrypt(&key, plaintext).unwrap();
        assert_ne!(&ciphertext[NONCE_LEN..], plaintext.as_slice());
        let decrypted = decrypt(&key, &ciphertext).unwrap();
        assert_eq!(decrypted, plaintext);
    }

    #[test]
    fn decrypt_rejects_tampered_ciphertext() {
        let key = [7u8; 32];
        let mut ciphertext = encrypt(&key, b"donnees").unwrap();
        let last = ciphertext.len() - 1;
        ciphertext[last] ^= 0xFF;
        assert!(decrypt(&key, &ciphertext).is_err());
    }

    #[test]
    fn decrypt_rejects_wrong_key() {
        let ciphertext = encrypt(&[1u8; 32], b"donnees").unwrap();
        assert!(decrypt(&[2u8; 32], &ciphertext).is_err());
    }

    #[test]
    fn derive_data_key_is_deterministic_given_same_inputs() {
        let raw = [42u8; 32];
        let package_id = uuid::Uuid::new_v4();
        let k1 = derive_data_key(&raw, &package_id);
        let k2 = derive_data_key(&raw, &package_id);
        assert_eq!(k1, k2);
    }

    #[test]
    fn hmac_verifies_matching_key_and_message() {
        let key = [9u8; 32];
        let tag = hmac_sha256(&key, b"manifeste de retour");
        assert!(verify_hmac_sha256(&key, b"manifeste de retour", &tag));
    }

    #[test]
    fn hmac_rejects_tampered_message() {
        let key = [9u8; 32];
        let tag = hmac_sha256(&key, b"original");
        assert!(!verify_hmac_sha256(&key, b"modifie", &tag));
    }

    #[test]
    fn hmac_rejects_wrong_key() {
        let tag = hmac_sha256(&[1u8; 32], b"message");
        assert!(!verify_hmac_sha256(&[2u8; 32], b"message", &tag));
    }

    #[test]
    fn derive_data_key_differs_per_package() {
        let raw = [42u8; 32];
        let k1 = derive_data_key(&raw, &uuid::Uuid::new_v4());
        let k2 = derive_data_key(&raw, &uuid::Uuid::new_v4());
        assert_ne!(k1, k2);
    }
}
