#!/usr/bin/env pwsh
# Prepare SQLx offline mode using Docker

$ErrorActionPreference = "Stop"

Write-Host "`nPreparing SQLx offline mode (via Docker)..." -ForegroundColor Cyan

# Ensure DB is running
Write-Host "1. Checking database..." -ForegroundColor Yellow
docker compose up -d db
Start-Sleep -Seconds 3

# Run cargo sqlx prepare inside a Rust container
Write-Host "`n2. Running cargo sqlx prepare..." -ForegroundColor Yellow
docker run --rm `
  --network atlas_atlas-net `
  -v "${PWD}/services/api-geo:/app" `
  -w /app `
  -e DATABASE_URL="postgresql://atlas:atlas@atlas-db:5432/atlas" `
  rust:1.86 `
  bash -c "cargo install sqlx-cli --no-default-features --features postgres && cargo sqlx prepare"

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ SQLx metadata generated in services/api-geo/.sqlx/" -ForegroundColor Green
    Write-Host "✓ Commit this directory to git for offline builds" -ForegroundColor Green
} else {
    Write-Host "`n❌ Failed to generate SQLx metadata" -ForegroundColor Red
    exit 1
}
