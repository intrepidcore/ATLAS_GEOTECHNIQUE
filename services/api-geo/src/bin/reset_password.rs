use anyhow::{anyhow, Context};
use api_geo::auth::{AuthConfig, PasswordHasher, SessionManager};
use sqlx::PgPool;

fn parse_arg_value(args: &[String], key: &str) -> Option<String> {
    args.iter()
        .position(|a| a == key)
        .and_then(|i| args.get(i + 1))
        .cloned()
}

fn has_flag(args: &[String], flag: &str) -> bool {
    args.iter().any(|a| a == flag)
}

fn print_usage() {
    eprintln!(
        "Usage: reset_password --email <email> [--password <password>] [--database-url <url>]\n\
        \n\
        Options:\n\
          --email      Email du compte à réinitialiser (ex: admin@atlas.local)\n\
          --password   Nouveau mot de passe (sinon demandé en interactif, masqué)\n\
          --database-url  URL de connexion Postgres (override DATABASE_URL)\n\
          --no-revoke  Ne pas révoquer les sessions existantes (par défaut: revoke)\n\
        \n\
        Env requis:\n\
          DATABASE_URL"
    );
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    let _ = dotenvy::dotenv();

    let args: Vec<String> = std::env::args().collect();
    if has_flag(&args, "-h") || has_flag(&args, "--help") {
        print_usage();
        return Ok(());
    }

    let email = parse_arg_value(&args, "--email").ok_or_else(|| {
        print_usage();
        anyhow!("Missing required argument: --email")
    })?;

    let password = match parse_arg_value(&args, "--password") {
        Some(p) => p,
        None => {
            let p1 = rpassword::prompt_password("Nouveau mot de passe: ")
                .context("Failed to read password")?;
            let p2 = rpassword::prompt_password("Confirmer le mot de passe: ")
                .context("Failed to read password confirmation")?;
            if p1 != p2 {
                return Err(anyhow!("Password confirmation does not match"));
            }
            p1
        }
    };

    let auth_config = AuthConfig::new();
    auth_config
        .validate()
        .map_err(|e| anyhow!("Invalid auth config: {e}"))?;

    let password_hasher = PasswordHasher::new(auth_config.clone());
    password_hasher
        .validate_password_strength(&password)
        .context("Weak password")?;

    let database_url = parse_arg_value(&args, "--database-url")
        .or_else(|| std::env::var("DATABASE_URL").ok())
        .ok_or_else(|| {
            print_usage();
            anyhow!("Missing database URL: provide --database-url or set DATABASE_URL")
        })?;

    let pool = PgPool::connect(&database_url)
        .await
        .context("Failed to connect to DB")?;

    let user_id: Option<uuid::Uuid> = sqlx::query_scalar(
        r#"SELECT id FROM atlas.users WHERE email = $1"#,
    )
    .bind(&email)
    .fetch_optional(&pool)
    .await
    .context("Failed to lookup user by email")?;

    let user_id = user_id.ok_or_else(|| anyhow!("User not found for email: {email}"))?;

    let new_hash = password_hasher
        .hash_password(&password)
        .context("Failed to hash password")?;

    sqlx::query(
        r#"
        UPDATE atlas.users
        SET password_hash = $1,
            password_changed_at = NOW(),
            failed_login_attempts = 0,
            locked_until = NULL,
            updated_at = NOW()
        WHERE id = $2
        "#,
    )
    .bind(&new_hash)
    .bind(user_id)
    .execute(&pool)
    .await
    .context("Failed to update password_hash")?;

    if !has_flag(&args, "--no-revoke") {
        let session_manager = SessionManager::new(pool.clone(), auth_config.clone());
        let _ = session_manager
            .revoke_all_sessions(user_id, "cli_password_reset", None, None)
            .await
            .context("Failed to revoke sessions")?;
    }

    println!("Password reset OK for {email}");
    Ok(())
}
