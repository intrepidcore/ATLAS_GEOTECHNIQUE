//! Système de paquets opérateur hors-ligne `.atlaspack` / `.atlasreturn`.
//!
//! Workflow : Atlas Colab -> génération paquet signé/chiffré par opérateur
//! -> app mobile Atlas Terrain (100% hors-ligne) -> export terrain
//! -> réimport Atlas Colab.
//!
//! ## Sous-modules
//! - `crypto`        : Ed25519 (signature), ChaCha20-Poly1305 (chiffrement), HKDF
//! - `format`         : structures sérialisées `manifest.json` / `data.bin`
//! - `offline_tiles`  : constructeur MBTiles hors-ligne (OSM XYZ -> mbtiles)
//! - `config`         : configuration centralisée (expiration, marge, zoom, ...)
//! - `builder`        : assemble et signe un `.atlaspack` pour un opérateur donné
//! - `jobs`           : file de génération asynchrone (pattern `colab::email_worker`)
//! - `routes`         : endpoints Atlas Colab (génération, statut, téléchargement, réimport)
//! - `returns`        : réimport d'un `.atlasreturn` (idempotent, vérifié)

pub mod builder;
pub mod config;
pub mod crypto;
pub mod format;
pub mod jobs;
pub mod offline_tiles;
pub mod returns;
pub mod routes;
