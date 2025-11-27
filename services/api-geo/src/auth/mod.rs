// Module d'authentification et autorisation
// Gestion JWT, sessions, hashing de mots de passe

pub mod config;
pub mod error;
pub mod jwt;
pub mod middleware;
pub mod password;
pub mod routes;
pub mod session;
pub mod types;

pub use config::AuthConfig;
pub use error::AuthError;
pub use jwt::{Claims, JwtManager};
pub use middleware::{auth_middleware, optional_auth_middleware, AuthUser};
pub use password::PasswordHasher;
pub use session::SessionManager;
pub use types::*;
