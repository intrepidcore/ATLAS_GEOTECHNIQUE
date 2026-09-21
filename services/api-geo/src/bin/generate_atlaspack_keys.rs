//! Génère une paire de clés Ed25519 de signature `.atlaspack`.
//!
//! Usage :
//!   cargo run --bin generate_atlaspack_keys
//!
//! Affiche :
//!   - ATLASPACK_SIGNING_PRIVATE_KEY_B64 : à placer en variable d'environnement
//!     serveur (.env / secret Docker) — NE JAMAIS committer, NE JAMAIS
//!     embarquer dans l'app mobile.
//!   - ATLASPACK_PUBLIC_KEY_B64 (+ key_id) : à embarquer dans l'app mobile
//!     (mobile/app.json -> extra.atlasPackPublicKeyB64) pour la vérification
//!     de signature hors-ligne.
//!
//! Ne se connecte à AUCUNE base — génération pure, locale, hors-ligne.

use api_geo::atlaspack::crypto::AtlasPackSigningKeypair;

fn main() {
    let kp = AtlasPackSigningKeypair::generate();

    println!("Nouvelle paire de clés .atlaspack générée (Ed25519).\n");
    println!("key_id : {}\n", kp.key_id);
    println!("── Côté SERVEUR (variable d'environnement, JAMAIS dans git) ──");
    println!("ATLASPACK_SIGNING_PRIVATE_KEY_B64={}\n", kp.seed_b64());
    println!("── Côté MOBILE (app.json -> extra, valeur PUBLIQUE) ──");
    println!("ATLASPACK_PUBLIC_KEY_B64={}", kp.public_key_b64);
    println!("ATLASPACK_SIGNING_KEY_ID={}", kp.key_id);
}
