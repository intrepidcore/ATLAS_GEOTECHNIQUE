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

pub mod types;
pub mod routes;
pub mod mobile;
pub mod comments;
pub mod qa;
pub mod email_worker;
