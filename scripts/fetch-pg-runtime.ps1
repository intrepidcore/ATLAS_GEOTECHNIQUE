param(
  [Parameter(Mandatory=$false)][string]$ZipPath = "",
  [Parameter(Mandatory=$false)][string]$SourceDir = "",
  [string]$DestDir = "./apps/atlas-pro/src-tauri/pg"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ZipPath) -and [string]::IsNullOrWhiteSpace($SourceDir)) {
  throw "Provide either -ZipPath <path-to-pg-runtime.zip> or -SourceDir <path-to-pg-runtime-folder>."
}

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

if (-not [string]::IsNullOrWhiteSpace($ZipPath)) {
  if (-not (Test-Path $ZipPath)) { throw "Zip not found: $ZipPath" }
  Write-Host "Extracting Postgres runtime from zip..." -ForegroundColor Cyan
  Expand-Archive -Force -Path $ZipPath -DestinationPath $DestDir
}

if (-not [string]::IsNullOrWhiteSpace($SourceDir)) {
  if (-not (Test-Path $SourceDir)) { throw "SourceDir not found: $SourceDir" }
  Write-Host "Copying Postgres runtime from folder..." -ForegroundColor Cyan
  robocopy "$SourceDir" "$DestDir" /E /R:1 /W:1 /COPY:DAT /DCOPY:DAT /XJ /NFL /NDL /NP | Out-Null
}

$pgCtl = Join-Path $DestDir "bin\pg_ctl.exe"
if (-not (Test-Path $pgCtl)) {
  throw "Runtime seems incomplete: missing $pgCtl"
}

Write-Host "✅ Postgres runtime ready at $DestDir" -ForegroundColor Green
