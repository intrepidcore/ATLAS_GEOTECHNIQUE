param(
  [string]$RepoRoot = (Get-Location).Path,
  [string]$MsiPath = ''
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

if ((Test-Path $seedDump) -and (Test-Path $seedJson)) {
  try {
    $manifest = Get-Content $seedJson -Raw | ConvertFrom-Json
    $integrity = $manifest.integrity
    $expectedSha = if ($integrity -and $integrity.sha256) { $integrity.sha256 } else { $manifest.sha256 }
    $expectedSize = if ($integrity -and $integrity.size_bytes) { [int64]$integrity.size_bytes } else { [int64]$manifest.size_bytes }
    $actualSha = (Get-FileHash $seedDump -Algorithm SHA256).Hash.ToLower()
    $actualSize = (Get-Item $seedDump).Length
    Check 'seed sha256 matches manifest' ($expectedSha -and ($actualSha -eq ($expectedSha.ToString().ToLower()))) ("expected=" + $expectedSha + " actual=" + $actualSha)
    Check 'seed size matches manifest' ($expectedSize -gt 0 -and ($actualSize -eq $expectedSize)) ("expected=" + $expectedSize + " actual=" + $actualSize)
    $seedVersion = $null
    if ($manifest.identity -and $manifest.identity.seed_version) { $seedVersion = $manifest.identity.seed_version }
    elseif ($manifest.seed_version) { $seedVersion = $manifest.seed_version }
    Check 'seed_version present' (-not [string]::IsNullOrWhiteSpace([string]$seedVersion)) ("seed_version=" + [string]$seedVersion)
  } catch {
    Check 'seed manifest parseable' $false ($_.Exception.Message)
  }
}

$sidecar = Join-Path $RepoRoot 'apps\atlas-pro\src-tauri\bin\api-geo-x86_64-pc-windows-msvc.exe'
Check 'api-geo sidecar present' (Test-Path $sidecar) $sidecar
if (Test-Path $sidecar) {
  Check 'api-geo sidecar size > 5MB' ((Get-Item $sidecar).Length -gt 5MB) ("size=" + (Get-Item $sidecar).Length)
}

$resources = @()
try { $resources = @($conf.bundle.resources) } catch { $resources = @() }

$hasSeedDump = $resources -contains '../../../data/db/backups/atlas_desktop_seed.dump'
$hasSeedJson = $resources -contains '../../../data/db/backups/atlas_desktop_seed.dump.json'

$hasSidecar = ($resources -contains 'bin/api-geo-x86_64-pc-windows-msvc.exe') -or ($conf.bundle.externalBin -contains 'bin/api-geo')
$hasPg = $resources | Where-Object { $_ -eq 'pg/**' -or $_ -eq 'pg/**/*' }

Check 'bundle.resources includes seed dump' $hasSeedDump 'Expected ../../../data/db/backups/atlas_desktop_seed.dump'
Check 'bundle.resources includes seed dump json' $hasSeedJson 'Expected ../../../data/db/backups/atlas_desktop_seed.dump.json'
Check 'bundle includes api-geo sidecar' $hasSidecar 'Expected bin/api-geo-x86_64-pc-windows-msvc.exe or externalBin bin/api-geo'
Check 'bundle.resources includes pg runtime' ($null -ne $hasPg) 'Expected pg/**/*'

$pgCtl = Join-Path $RepoRoot 'apps\atlas-pro\src-tauri\pg\bin\pg_ctl.exe'
Check 'embedded pg runtime present' (Test-Path $pgCtl) $pgCtl

if (-not [string]::IsNullOrWhiteSpace($MsiPath)) {
  Check 'msi path present' (Test-Path $MsiPath) $MsiPath
  if (Test-Path $MsiPath) {
    $inspect = Join-Path $env:TEMP ('atlas_msi_inspect_' + [System.Guid]::NewGuid().ToString('N'))
    New-Item $inspect -ItemType Directory -Force | Out-Null
    try {
      Write-Host "Inspecting MSI via administrative install..." -ForegroundColor Cyan
      $p = Start-Process -FilePath "msiexec.exe" -ArgumentList @(
        "/a",
        (Resolve-Path $MsiPath).Path,
        "/qn",
        "TARGETDIR=$inspect"
      ) -Wait -PassThru
      Check 'msiexec /a succeeded' ($p.ExitCode -eq 0) ("exit=" + $p.ExitCode)

      $pgBins = @('pg_ctl.exe','postgres.exe','pg_restore.exe','initdb.exe')
      foreach ($bin in $pgBins) {
        $found = Get-ChildItem $inspect -Recurse -Filter $bin -ErrorAction SilentlyContinue | Select-Object -First 1
        Check ("msi contains " + $bin) ($null -ne $found) ($found.FullName)
      }

      $seed = Get-ChildItem $inspect -Recurse -Filter "atlas_desktop_seed.dump" -ErrorAction SilentlyContinue | Select-Object -First 1
      Check 'msi contains seed dump' ($null -ne $seed) ($seed.FullName)
      if ($null -ne $seed) {
        Check 'msi seed dump size > 10MB' ($seed.Length -gt 10MB) ("size=" + $seed.Length)
        $seedJson2 = Get-ChildItem $inspect -Recurse -Filter "atlas_desktop_seed.dump.json" -ErrorAction SilentlyContinue | Select-Object -First 1
        Check 'msi contains seed manifest json' ($null -ne $seedJson2) ($seedJson2.FullName)
      }
    } catch {
      Check 'msi inspection' $false ($_.Exception.Message)
    } finally {
      Remove-Item $inspect -Recurse -Force -ErrorAction SilentlyContinue
    }
  }
}

if ($script:failed -gt 0) {
  Write-Host "`n❌ $($script:failed) check(s) failed. Do not build MSI until fixed." -ForegroundColor Red
  exit 1
}

Write-Host "`n✅ Bundle inputs look OK." -ForegroundColor Green
