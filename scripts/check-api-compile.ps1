#!/usr/bin/env pwsh
# Check API compilation before Docker build

$ErrorActionPreference = "Stop"

Write-Host "Checking API Rust compilation..." -ForegroundColor Cyan

docker run --rm `
  -v "${PWD}/services/api-geo:/app" `
  -w /app `
  rust:1.86 `
  cargo check --release

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n✓ Compilation OK - prêt pour Docker build" -ForegroundColor Green
} else {
    Write-Host "`n❌ Erreurs de compilation détectées" -ForegroundColor Red
    exit 1
}
