use anyhow::Context;
use serde::Deserialize;
use sha2::{Digest, Sha256};
use sqlx::{PgPool, Row};

const DATASET_SQL: &str = include_str!("../../../dataset/dataset_v1.sql");
const DATASET_MANIFEST_JSON: &str = include_str!("../../../dataset/DATASET_MANIFEST.json");

#[derive(Debug, Deserialize)]
struct Manifest {
    version: String,
    dataset: ManifestDataset,
    schema: ManifestSchema,
    created_at: String,
    compatible_schema: String,
}

#[derive(Debug, Deserialize)]
struct ManifestDataset {
    file: String,
    sha256: String,
}

#[derive(Debug, Deserialize)]
struct ManifestSchema {
    sha256: String,
}

pub async fn ensure_dataset_applied(pool: &PgPool) -> anyhow::Result<()> {
    let manifest: Manifest = serde_json::from_str(DATASET_MANIFEST_JSON)
        .context("Invalid dataset/DATASET_MANIFEST.json")?;

    let desktop_mode = std::env::var("ATLAS_DESKTOP")
        .map(|v| v.trim() == "1" || v.trim().eq_ignore_ascii_case("true"))
        .unwrap_or(false);

    let dataset_sha256 = sha256_hex(DATASET_SQL.as_bytes());
    if !eq_hex(&dataset_sha256, &manifest.dataset.sha256) {
        anyhow::bail!(
            "Dataset SQL sha256 mismatch: manifest={}, embedded={}",
            manifest.dataset.sha256,
            dataset_sha256
        );
    }

    let current_schema_sha256 = compute_schema_hash(pool).await?;
    if !eq_hex(&current_schema_sha256, &manifest.schema.sha256) {
        if desktop_mode {
            tracing::warn!(
                manifest = %manifest.schema.sha256,
                current_db = %current_schema_sha256,
                "Schema sha256 mismatch (desktop mode): continuing"
            );
            return Ok(());
        } else {
            anyhow::bail!(
                "Schema sha256 mismatch: manifest={}, current_db={}",
                manifest.schema.sha256,
                current_schema_sha256
            );
        }
    }

    ensure_metadata_table(pool).await?;

    let existing = sqlx::query(
        r#"
        SELECT dataset_version, dataset_sha256, schema_sha256
        FROM atlas.dataset_metadata
        ORDER BY applied_at DESC
        LIMIT 1
        "#,
    )
    .fetch_optional(pool)
    .await?;

    if let Some(row) = existing {
        let v: String = row.try_get("dataset_version")?;
        let d: String = row.try_get("dataset_sha256")?;
        let s: String = row.try_get("schema_sha256")?;

        if v == manifest.version && eq_hex(&d, &manifest.dataset.sha256) && eq_hex(&s, &manifest.schema.sha256) {
            tracing::info!(
                "Dataset already applied (version={}, created_at={})",
                manifest.version,
                manifest.created_at
            );
            return Ok(());
        }

        anyhow::bail!(
            "Dataset already applied but does not match current manifest: existing_version={}, manifest_version={}",
            v,
            manifest.version
        );
    }

    tracing::info!(
        "Applying dataset (version={}, file={}, created_at={})",
        manifest.version,
        manifest.dataset.file,
        manifest.created_at
    );

    sqlx::raw_sql(DATASET_SQL)
        .execute(pool)
        .await
        .context("Failed to apply dataset SQL")?;

    sqlx::query(
        r#"
        INSERT INTO atlas.dataset_metadata (
            dataset_version,
            dataset_sha256,
            schema_sha256,
            manifest_created_at,
            compatible_schema
        ) VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(&manifest.version)
    .bind(&manifest.dataset.sha256)
    .bind(&manifest.schema.sha256)
    .bind(&manifest.created_at)
    .bind(&manifest.compatible_schema)
    .execute(pool)
    .await?;

    tracing::info!("✅ Dataset applied successfully");
    Ok(())
}

async fn ensure_metadata_table(pool: &PgPool) -> anyhow::Result<()> {
    sqlx::query("CREATE SCHEMA IF NOT EXISTS atlas")
        .execute(pool)
        .await?;

    sqlx::query(
        r#"
        CREATE TABLE IF NOT EXISTS atlas.dataset_metadata (
            id bigserial PRIMARY KEY,
            dataset_version text NOT NULL,
            dataset_sha256 text NOT NULL,
            schema_sha256 text NOT NULL,
            manifest_created_at text NOT NULL,
            compatible_schema text NOT NULL,
            applied_at timestamptz NOT NULL DEFAULT now()
        )
        "#,
    )
    .execute(pool)
    .await?;

    Ok(())
}

async fn compute_schema_hash(pool: &PgPool) -> anyhow::Result<String> {
    let rows = sqlx::query(
        r#"
        SELECT
            table_schema,
            table_name,
            column_name,
            data_type,
            COALESCE(character_maximum_length::text, '') AS char_len,
            COALESCE(numeric_precision::text, '') AS num_precision,
            COALESCE(numeric_scale::text, '') AS num_scale,
            ordinal_position
        FROM information_schema.columns
        WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
        ORDER BY table_schema, table_name, ordinal_position
        "#,
    )
    .fetch_all(pool)
    .await?;

    let mut hasher = Sha256::new();
    for row in rows {
        let table_schema: String = row.try_get("table_schema")?;
        let table_name: String = row.try_get("table_name")?;
        let column_name: String = row.try_get("column_name")?;
        let data_type: String = row.try_get("data_type")?;
        let char_len: String = row.try_get("char_len")?;
        let num_precision: String = row.try_get("num_precision")?;
        let num_scale: String = row.try_get("num_scale")?;

        hasher.update(table_schema.as_bytes());
        hasher.update(b".");
        hasher.update(table_name.as_bytes());
        hasher.update(b".");
        hasher.update(column_name.as_bytes());
        hasher.update(b":");
        hasher.update(data_type.as_bytes());
        hasher.update(b":");
        hasher.update(char_len.as_bytes());
        hasher.update(b":");
        hasher.update(num_precision.as_bytes());
        hasher.update(b":");
        hasher.update(num_scale.as_bytes());
        hasher.update(b"\n");
    }

    let digest = hasher.finalize();
    Ok(bytes_to_hex_lower(&digest))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let mut hasher = Sha256::new();
    hasher.update(bytes);
    bytes_to_hex_lower(&hasher.finalize())
}

fn bytes_to_hex_lower(bytes: &[u8]) -> String {
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

fn eq_hex(a: &str, b: &str) -> bool {
    a.trim().eq_ignore_ascii_case(b.trim())
}
