param(
  [Parameter(Mandatory=$false)][string]$ExePath = "",
  [Parameter(Mandatory=$false)][string]$SourceDir = "",
  [string]$DestDir = "./apps/atlas-pro/src-tauri/bin",
  [string]$DestName = "api-geo-x86_64-pc-windows-msvc.exe"
)

$ErrorActionPreference = "Stop"

if ([string]::IsNullOrWhiteSpace($ExePath) -and [string]::IsNullOrWhiteSpace($SourceDir)) {
  throw "Provide either -ExePath <path-to-api-geo.exe> or -SourceDir <folder-containing-api-geo.exe>."
}

New-Item -ItemType Directory -Force -Path $DestDir | Out-Null

$dest = Join-Path $DestDir $DestName

if (-not [string]::IsNullOrWhiteSpace($ExePath)) {
  if (-not (Test-Path $ExePath)) { throw "Exe not found: $ExePath" }
  Copy-Item -Force $ExePath $dest
}

if (-not [string]::IsNullOrWhiteSpace($SourceDir)) {
  if (-not (Test-Path $SourceDir)) { throw "SourceDir not found: $SourceDir" }
  $candidate = Join-Path $SourceDir $DestName
  if (-not (Test-Path $candidate)) {
    throw "Expected exe not found in SourceDir: $candidate"
  }
  Copy-Item -Force $candidate $dest
}

if (-not (Test-Path $dest)) {
  throw "Copy failed: missing $dest"
}

Write-Host "✅ api-geo sidecar ready at $dest" -ForegroundColor Green
