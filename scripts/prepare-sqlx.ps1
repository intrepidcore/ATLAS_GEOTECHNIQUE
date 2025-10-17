#!/usr/bin/env pwsh
# Prepare SQLx offline mode

$ErrorActionPreference = "Stop"

Write-Host "Preparing SQLx offline mode..." -ForegroundColor Cyan

# Set DATABASE_URL
$env:DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas"

# Navigate to api-geo
Set-Location services/api-geo

# Run cargo sqlx prepare
Write-Host "Running cargo sqlx prepare..." -ForegroundColor Yellow
cargo sqlx prepare --merged

Write-Host "✓ SQLx metadata generated in .sqlx/" -ForegroundColor Green
Write-Host "✓ Commit .sqlx/ to git for offline builds" -ForegroundColor Green
