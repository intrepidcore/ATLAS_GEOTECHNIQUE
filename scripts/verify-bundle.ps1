param(
  [string]$RepoRoot = (Get-Location).Path
)

$ErrorActionPreference = 'Stop'

function Check([string]$name, [bool]$ok, [string]$details = '') {
  if ($ok) {
    Write-Host "✅ $name" -ForegroundColor Green
  } else {
    Write-Host "❌ $name" -ForegroundColor Red
    if ($details) { Write-Host "   $details" -ForegroundColor DarkGray }
    $script:failed++
  }
}

$script:failed = 0

$tauriConf = Join-Path $RepoRoot 'apps\atlas-pro\src-tauri\tauri.conf.json'
Check 'tauri.conf.json present' (Test-Path $tauriConf) $tauriConf

$conf = Get-Content $tauriConf -Raw | ConvertFrom-Json

$seedDump = Join-Path $RepoRoot 'data\db\backups\atlas_desktop_seed.dump'
$seedJson = Join-Path $RepoRoot 'data\db\backups\atlas_desktop_seed.dump.json'

Check 'seed dump present' (Test-Path $seedDump) $seedDump
if (Test-Path $seedDump) {
  Check 'seed dump size > 10MB' ((Get-Item $seedDump).Length -gt 10MB) ("size=" + (Get-Item $seedDump).Length)
}
Check 'seed dump json present' (Test-Path $seedJson) $seedJson

$sidecar = Join-Path $RepoRoot 'apps\atlas-pro\src-tauri\bin\api-geo-x86_64-pc-windows-msvc.exe'
Check 'api-geo sidecar present' (Test-Path $sidecar) $sidecar
if (Test-Path $sidecar) {
  Check 'api-geo sidecar size > 5MB' ((Get-Item $sidecar).Length -gt 5MB) ("size=" + (Get-Item $sidecar).Length)
}

$resources = @()
try { $resources = @($conf.bundle.resources) } catch { $resources = @() }

$hasSeedDump = $resources -contains '../../../data/db/backups/atlas_desktop_seed.dump'
$hasSeedJson = $resources -contains '../../../data/db/backups/atlas_desktop_seed.dump.json'

Check 'bundle.resources includes seed dump' $hasSeedDump 'Expected ../../../data/db/backups/atlas_desktop_seed.dump'
Check 'bundle.resources includes seed dump json' $hasSeedJson 'Expected ../../../data/db/backups/atlas_desktop_seed.dump.json'

if ($script:failed -gt 0) {
  Write-Host "`n❌ $($script:failed) check(s) failed. Do not build MSI until fixed." -ForegroundColor Red
  exit 1
}

Write-Host "`n✅ Bundle inputs look OK." -ForegroundColor Green
