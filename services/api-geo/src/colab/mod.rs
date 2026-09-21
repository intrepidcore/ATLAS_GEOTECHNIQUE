//! Module Atlas Colab
//!
//! Gestion des missions terrain, étudiants, superviseurs et documents.
//!
//! ## Sous-modules
//! - `types` : DTOs et structures de données
//! - `routes` : Routes API principales (missions, superviseurs, étudiants)
//! - `mobile` : API mobile/PWA (mes missions, carte terrain, sync)
//! - `comments` : Commentaires, mentions et notifications
//! - `qa` : Questions/Réponses et gamification

pub mod app_download;
pub mod sondage_points;
pub mod credentials;
pub mod comments;
pub mod email_worker;
pub mod lab_results;
pub mod mobile;
pub mod qa;
pub mod routes;
pub mod types;
