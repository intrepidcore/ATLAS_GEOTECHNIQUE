//! Attribution de mots de passe aux opérateurs et transmission par mail.
//!
//! Le mot de passe d'un opérateur n'est pas seulement un identifiant de
//! connexion : le `.atlaspack` est chiffré à partir de son empreinte Argon2id.
//! Un même secret ouvre donc le compte en ligne et le paquet hors-ligne, ce
//! qui impose un ordre strict :
//!
//! 1. attribuer le nouveau mot de passe ;
//! 2. **régénérer le paquet** avec la nouvelle empreinte ;
//! 3. seulement ensuite, envoyer le mail qui porte le mot de passe ET le
//!    paquet.
//!
//! Inverser 2 et 3 livrerait à l'opérateur un paquet que son mot de passe
//! n'ouvre pas. La régénération étant asynchrone et longue (fond de carte),
//! le job d'envoi est créé en attente et n'est libéré qu'une fois les paquets
//! prêts.
//!
//! Les mots de passe en clair ne vivent que dans les paramètres du job, et
//! sont effacés par le worker dès la fin de l'envoi.

use axum::{extract::State, http::StatusCode, Json};
use rand::Rng;
use serde_json::json;
use sqlx::{PgPool, Row};
use std::collections::HashMap;
use std::time::Duration as StdDuration;
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::auth::password::PasswordHasher;
use crate::auth::session::SessionManager;
use crate::state::AppState;

type ApiResult<T> = Result<T, (StatusCode, Json<serde_json::Value>)>;

fn err(status: StatusCode, message: impl Into<String>) -> (StatusCode, Json<serde_json::Value>) {
    (status, Json(json!({ "error": message.into() })))
}

fn db_err(e: sqlx::Error) -> (StatusCode, Json<serde_json::Value>) {
    (
        StatusCode::INTERNAL_SERVER_ERROR,
        Json(json!({ "error": format!("Erreur DB: {e}") })),
    )
}

/// Alphabets sans caractères ambigus : ces mots de passe seront lus sur un
/// écran de téléphone, parfois recopiés à la main, parfois dictés au
/// téléphone. `O`/`0`, `l`/`1`/`I` en sont donc exclus.
const UPPER: &[u8] = b"ABCDEFGHJKLMNPQRSTUVWXYZ";
const LOWER: &[u8] = b"abcdefghijkmnpqrstuvwxyz";
const DIGIT: &[u8] = b"23456789";

/// Mot de passe aléatoire de la forme `Xxxx-9xxx-Xxx9`.
///
/// Trois groupes de quatre séparés par des tirets : lisible, dictable, et
/// satisfaisant la politique du serveur (longueur, majuscule, minuscule,
/// chiffre, caractère spécial — le tiret).
pub fn generate_password() -> String {
    let mut rng = rand::thread_rng();
    let pick = |rng: &mut rand::rngs::ThreadRng, set: &[u8]| set[rng.gen_range(0..set.len())] as char;

    let mut chars: Vec<char> = Vec::with_capacity(12);
    // Garantit au moins une majuscule, une minuscule et un chiffre.
    chars.push(pick(&mut rng, UPPER));
    chars.push(pick(&mut rng, LOWER));
    chars.push(pick(&mut rng, DIGIT));
    let all: Vec<u8> = UPPER.iter().chain(LOWER).chain(DIGIT).copied().collect();
    while chars.len() < 12 {
        chars.push(pick(&mut rng, &all));
    }
    // Mélange pour que les positions imposées ne soient pas prévisibles.
    for i in (1..chars.len()).rev() {
        chars.swap(i, rng.gen_range(0..=i));
    }

    let s: String = chars.into_iter().collect();
    format!("{}-{}-{}", &s[0..4], &s[4..8], &s[8..12])
}

#[derive(Debug, serde::Deserialize)]
pub struct ResetAndNotifyRequest {
    /// Opérateurs visés. Vide ou absent = tous ceux qui ont une mission active.
    #[serde(default)]
    pub student_ids: Vec<Uuid>,
    /// Envoyer le mail après régénération des paquets. `false` = attribuer les
    /// mots de passe sans rien envoyer.
    #[serde(default = "default_true")]
    pub notify: bool,
}

fn default_true() -> bool {
    true
}

struct Target {
    student_id: Uuid,
    user_id: Uuid,
    email: String,
    full_name: String,
    assignment_id: Uuid,
}

/// POST /colab/students/reset-passwords-and-notify
pub async fn reset_passwords_and_notify(
    State(state): State<AppState>,
    auth: AuthUser,
    Json(request): Json<ResetAndNotifyRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    if !auth.has_permission("users.manage") {
        return Err(err(StatusCode::FORBIDDEN, "Permission users.manage requise"));
    }

    // Opérateurs avec une mission active ET une adresse réellement joignable.
    // Une adresse de remplissage (`@atlas-togo.edu`) ne mène nulle part :
    // attribuer un mot de passe qu'on ne peut pas transmettre couperait
    // l'opérateur de son compte comme de son paquet.
    let rows = sqlx::query(
        r#"
        SELECT DISTINCT ON (cs.id)
               cs.id   AS student_id,
               u.id    AS user_id,
               u.email AS email,
               TRIM(COALESCE(u.first_name,'') || ' ' || COALESCE(u.last_name,'')) AS full_name,
               a.id    AS assignment_id
        FROM atlas.colab_students cs
        JOIN atlas.users u ON u.id = cs.user_id AND u.deleted_at IS NULL
        JOIN atlas.colab_mission_assignments a ON a.student_id = cs.id AND a.unassigned_at IS NULL
        JOIN atlas.colab_missions m ON m.id = a.mission_id AND m.deleted_at IS NULL
        WHERE cs.deleted_at IS NULL
          AND u.email IS NOT NULL
          AND u.email <> ''
          AND u.email NOT ILIKE '%@atlas-togo.edu'
          AND ($1::uuid[] IS NULL OR cardinality($1::uuid[]) = 0 OR cs.id = ANY($1::uuid[]))
        ORDER BY cs.id, a.assigned_at DESC
        "#,
    )
    .bind(&request.student_ids)
    .fetch_all(&state.pool)
    .await
    .map_err(db_err)?;

    if rows.is_empty() {
        return Err(err(
            StatusCode::UNPROCESSABLE_ENTITY,
            "Aucun opérateur joignable avec une mission active.",
        ));
    }

    let targets: Vec<Target> = rows
        .iter()
        .map(|r| Target {
            student_id: r.get("student_id"),
            user_id: r.get("user_id"),
            email: r.get("email"),
            full_name: r.get("full_name"),
            assignment_id: r.get("assignment_id"),
        })
        .collect();

    // Le job est créé AVANT toute réinitialisation.
    //
    // L'ordre inverse a déjà coûté : l'insertion a échoué sur une contrainte
    // après que 27 mots de passe eurent été changés, et ces mots de passe —
    // qui n'existaient qu'en mémoire — ont été perdus. Les opérateurs se sont
    // retrouvés avec un secret que personne ne connaissait. Si la création du
    // job échoue maintenant, aucun compte n'a encore bougé.
    let job_id: Option<Uuid> = if request.notify {
        let id: Uuid = sqlx::query_scalar(
            r#"INSERT INTO atlas.colab_email_jobs (job_type, status, created_by, params)
               VALUES ('assignment_gmail', 'awaiting_approval', $1, '{}'::jsonb)
               RETURNING id"#,
        )
        .bind(auth.id)
        .fetch_one(&state.pool)
        .await
        .map_err(db_err)?;
        Some(id)
    } else {
        None
    };

    let hasher = PasswordHasher::new(state.auth_config.clone());
    let session_manager = SessionManager::new(state.pool.clone(), state.auth_config.clone());

    let mut passwords: HashMap<String, String> = HashMap::new();
    let mut done: Vec<serde_json::Value> = Vec::new();
    let mut failed: Vec<serde_json::Value> = Vec::new();

    for t in &targets {
        let password = generate_password();
        // Ceinture et bretelles : le mot de passe généré doit passer la même
        // politique que celui saisi à la main. Un générateur qui dérive et
        // produit un secret refusé casserait l'opération en silence.
        if let Err(e) = hasher.validate_password_strength(&password) {
            failed.push(json!({"email": t.email, "error": format!("mot de passe généré refusé: {e}")}));
            continue;
        }
        let hash = match hasher.hash_password(&password) {
            Ok(h) => h,
            Err(e) => {
                failed.push(json!({"email": t.email, "error": e.to_string()}));
                continue;
            }
        };

        if let Err(e) = sqlx::query(
            "UPDATE atlas.users
             SET password_hash = $1, password_changed_at = NOW(), updated_at = NOW(),
                 failed_login_attempts = 0, locked_until = NULL
             WHERE id = $2",
        )
        .bind(&hash)
        .bind(t.user_id)
        .execute(&state.pool)
        .await
        {
            failed.push(json!({"email": t.email, "error": format!("écriture du mot de passe: {e}")}));
            continue;
        }

        // Sessions révoquées : l'ancien mot de passe ne doit plus donner accès.
        if let Err(e) = session_manager
            .revoke_all_sessions(t.user_id, "bulk_password_reset", None, None)
            .await
        {
            tracing::warn!(error = %e, email = %t.email, "révocation des sessions incomplète");
        }

        // Régénération du paquet avec la nouvelle empreinte.
        crate::atlaspack::jobs::refresh_package_after_password_change(&state.pool, t.user_id).await;

        passwords.insert(t.assignment_id.to_string(), password);
        done.push(json!({"email": t.email, "name": t.full_name}));
    }

    if passwords.is_empty() {
        return Err(err(
            StatusCode::INTERNAL_SERVER_ERROR,
            "Aucun mot de passe n'a pu être attribué.",
        ));
    }

    if let Some(id) = job_id {
        let assignment_ids: Vec<String> = passwords.keys().cloned().collect();
        let params = json!({
            "assignment_ids": assignment_ids,
            // Persistés pour que la reprise après redémarrage sache qui attendre.
            "student_ids": targets.iter().map(|t| t.student_id.to_string()).collect::<Vec<_>>(),
            "options": {
                "include_bbox": true,
                "include_instructions": true,
                "include_pdf": true,
                "include_geojson": true,
                "include_atlaspack": true,
            },
            "passwords": passwords,
        });

        // Le job est créé INERTE puis libéré une fois les paquets régénérés.
        //
        // `status` porte une contrainte CHECK qui n'admet que pending, running,
        // completed, failed et cancelled — et la table appartient au rôle
        // `postgres`, que l'API n'a pas. On emprunte donc `cancelled`, qui ne
        // sera jamais consommé par le worker (il ne lit que `pending`), et on
        // marque l'intention dans `job_type`. La libération remet les deux
        // valeurs correctes d'un coup.
        // Les mots de passe rejoignent le job déjà créé : ils sont désormais
        // persistés, et survivent à un redémarrage de l'API pendant l'attente.
        sqlx::query("UPDATE atlas.colab_email_jobs SET params = $2 WHERE id = $1")
            .bind(id)
            .bind(&params)
            .execute(&state.pool)
            .await
            .map_err(db_err)?;

        let student_ids: Vec<Uuid> = targets.iter().map(|t| t.student_id).collect();
        let pool = state.pool.clone();
        tokio::spawn(async move {
            wait_for_packages(pool, id, student_ids).await;
        });
    }

    Ok(Json(json!({
        "attribues": done.len(),
        "operateurs": done,
        "echecs": failed,
        "ignores_sans_adresse": "les comptes @atlas-togo.edu sont exclus",
        "email_job_id": job_id,
        "email_status": if request.notify {
            "lot créé en attente de validation — aucun envoi ne partira sans approbation explicite"
        } else {
            "aucun envoi demandé"
        },
    })))
}

/// Reprend au démarrage les envois d'identifiants laissés en attente.
///
/// La surveillance vit dans une tâche du processus : un redémarrage de l'API
/// la tue, et le job reste indéfiniment en attente avec les mots de passe
/// dedans — c'est exactement ce qui est arrivé, l'envoi n'est jamais parti
/// malgré des paquets prêts. Les paramètres du job suffisent à reconstituer la
/// liste des opérateurs : on relance donc une surveillance par job en attente.
pub async fn resume_pending_credential_jobs(pool: PgPool) {
    let rows = match sqlx::query(
        "SELECT id, params FROM atlas.colab_email_jobs
         WHERE status = 'awaiting_approval'",
    )
    .fetch_all(&pool)
    .await
    {
        Ok(r) => r,
        Err(e) => {
            tracing::error!(error = %e, "reprise des envois d'identifiants en attente");
            return;
        }
    };

    for row in rows {
        let job_id: Uuid = match row.try_get("id") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let params: serde_json::Value = match row.try_get("params") {
            Ok(v) => v,
            Err(_) => continue,
        };
        let student_ids: Vec<Uuid> = params["student_ids"]
            .as_array()
            .map(|a| {
                a.iter()
                    .filter_map(|v| v.as_str().and_then(|s| s.parse().ok()))
                    .collect()
            })
            .unwrap_or_default();
        if student_ids.is_empty() {
            continue;
        }
        tracing::warn!(%job_id, operateurs = student_ids.len(), "envoi d'identifiants repris après redémarrage");
        let pool = pool.clone();
        tokio::spawn(async move {
            wait_for_packages(pool, job_id, student_ids).await;
        });
    }
}

/// Attend que tous les paquets des opérateurs visés soient régénérés.
///
/// **Ne déclenche aucun envoi.** Le job reste en `awaiting_approval` : c'est un
/// administrateur qui décide, par `POST /colab/email-jobs/:id/approve`. Une
/// libération automatique enverrait des identifiants à des personnes réelles
/// sans qu'aucune main humaine n'ait validé le lot — sans fenêtre pour
/// rattraper une maille erronée ou une attribution douteuse.
///
/// Cette tâche ne sert donc qu'à journaliser l'état de préparation.
async fn wait_for_packages(pool: PgPool, job_id: Uuid, student_ids: Vec<Uuid>) {
    for _ in 0..240 {
        tokio::time::sleep(StdDuration::from_secs(15)).await;
        match packages_ready(&pool, &student_ids).await {
            Ok((ready, total)) if ready == total => {
                tracing::info!(
                    %job_id, operateurs = total,
                    "paquets régénérés — l'envoi des identifiants attend une validation humaine"
                );
                return;
            }
            Ok((ready, total)) => {
                tracing::debug!(%job_id, ready, total, "attente des paquets");
            }
            Err(e) => tracing::error!(error = %e, %job_id, "vérification des paquets"),
        }
    }
    tracing::warn!(%job_id, "paquets toujours incomplets — le lot reste en attente de validation");
}

/// Combien de paquets sont prêts sur le total attendu.
async fn packages_ready(pool: &PgPool, student_ids: &[Uuid]) -> Result<(i64, i64), sqlx::Error> {
    let ready: i64 = sqlx::query_scalar(
        "SELECT COUNT(DISTINCT student_id) FROM atlas.atlaspack_packages
         WHERE student_id = ANY($1) AND status = 'ready'",
    )
    .bind(student_ids)
    .fetch_one(pool)
    .await?;
    Ok((ready, student_ids.len() as i64))
}

#[derive(Debug, serde::Deserialize)]
pub struct ApproveRequest {
    /// Reprise explicite du nombre de destinataires, tel qu'affiché à
    /// l'administrateur. Un écart interrompt : le lot a changé depuis qu'il
    /// l'a consulté.
    pub expected_recipients: usize,
}

/// POST /colab/email-jobs/:id/approve — validation humaine avant envoi.
pub async fn approve_email_job(
    State(state): State<AppState>,
    auth: AuthUser,
    axum::extract::Path(job_id): axum::extract::Path<Uuid>,
    Json(request): Json<ApproveRequest>,
) -> ApiResult<Json<serde_json::Value>> {
    if !auth.has_permission("users.manage") {
        return Err(err(StatusCode::FORBIDDEN, "Permission users.manage requise"));
    }

    let row = sqlx::query(
        "SELECT status, params FROM atlas.colab_email_jobs WHERE id = $1",
    )
    .bind(job_id)
    .fetch_optional(&state.pool)
    .await
    .map_err(db_err)?
    .ok_or_else(|| err(StatusCode::NOT_FOUND, "Lot d'envoi introuvable"))?;

    let status: String = row.get("status");
    if status != "awaiting_approval" {
        return Err(err(
            StatusCode::CONFLICT,
            format!("Ce lot est en statut « {status} » : seul un lot en attente de validation peut être envoyé."),
        ));
    }

    let params: serde_json::Value = row.get("params");
    let recipients = params["assignment_ids"].as_array().map(|a| a.len()).unwrap_or(0);
    if recipients != request.expected_recipients {
        return Err(err(
            StatusCode::CONFLICT,
            format!(
                "Le lot contient {recipients} destinataire(s), vous en avez validé {}. Rechargez avant de confirmer.",
                request.expected_recipients
            ),
        ));
    }

    let student_ids: Vec<Uuid> = params["student_ids"]
        .as_array()
        .map(|a| a.iter().filter_map(|v| v.as_str().and_then(|s| s.parse().ok())).collect())
        .unwrap_or_default();
    let (ready, total) = packages_ready(&state.pool, &student_ids).await.map_err(db_err)?;
    if ready < total {
        return Err(err(
            StatusCode::CONFLICT,
            format!(
                "{ready}/{total} paquets .atlaspack sont prêts. Envoyer maintenant livrerait un mot de passe sans le paquet qu'il ouvre."
            ),
        ));
    }

    sqlx::query(
        "UPDATE atlas.colab_email_jobs
         SET status = 'pending',
             params = params || jsonb_build_object('approved_by', $2::text, 'approved_at', NOW()::text)
         WHERE id = $1 AND status = 'awaiting_approval'",
    )
    .bind(job_id)
    .bind(auth.id.to_string())
    .execute(&state.pool)
    .await
    .map_err(db_err)?;

    tracing::warn!(%job_id, approuve_par = %auth.id, destinataires = recipients, "envoi d'identifiants validé");

    Ok(Json(json!({
        "job_id": job_id,
        "status": "pending",
        "destinataires": recipients,
        "message": "Lot validé — l'envoi part maintenant.",
    })))
}
