param(
  [string]$BaseUrl = "http://127.0.0.1:8000",
  [string]$RepoRoot = (Resolve-Path "$PSScriptRoot\.."),
  [string]$SrcRoot = "$RepoRoot\services\api-geo\src"
)

$ErrorActionPreference = "Stop"

function Get-RouteStringsFromRustFile {
  param([string]$FilePath)

  $content = Get-Content -Raw -LiteralPath $FilePath

  $routes = @()
  $routes += ([regex]::Matches($content, '\.route\(\s*"(?<path>/[^"]+)"', [System.Text.RegularExpressions.RegexOptions]::Multiline) | ForEach-Object { $_.Groups['path'].Value })

  return $routes
}

function Get-EffectivePaths {
  param(
    [string]$FilePath,
    [string[]]$Paths
  )

  $fileName = [System.IO.Path]::GetFileName($FilePath)

  $prefix = ""
  switch -Regex ($fileName) {
    '^colab_stub\.rs$' { $prefix = "/colab"; break }
    '^db_api\.rs$' { $prefix = "/db"; break }
    '^auth_dev\.rs$' { $prefix = "/auth"; break }
    default { $prefix = ""; break }
  }

  $out = @()
  foreach ($p in $Paths) {
    if ([string]::IsNullOrWhiteSpace($p)) { continue }

    if ($prefix -ne "" -and $p.StartsWith("/")) {
      $out += ($prefix + $p)
    } else {
      $out += $p
    }
  }

  return $out
}

function Normalize-TestPath {
  param([string]$Path)

  $missionId = "3c04de3a-3d6a-44af-b25f-daca5317c66d"
  $studentId = "3c60d56e-07fa-4b7f-b827-f29e0e4b7a1b"

  $p = $Path

  $p = $p -replace ':mission_id', $missionId
  $p = $p -replace ':sondage_id', $missionId
  $p = $p -replace ':student_id', $studentId
  $p = $p -replace ':supervisor_id', $missionId

  $p = $p -replace ':id', $missionId
  $p = $p -replace ':code', 'TG-0001'
  $p = $p -replace ':level', '3'

  $p = $p -replace ':schema', 'atlas'
  $p = $p -replace ':table', 'users'
  $p = $p -replace ':job_id', 'job'
  $p = $p -replace ':profile_id', 'profile'
  $p = $p -replace ':import_id', 'import'
  $p = $p -replace ':template_type', 'default'

  return $p
}

function Invoke-RouteProbe {
  param(
    [string]$Method,
    [string]$Url
  )

  try {
    $resp = Invoke-WebRequest -Method $Method -Uri $Url -TimeoutSec 20 -ErrorAction Stop
    $body = ""
    if ($null -ne $resp -and $null -ne $resp.Content) { $body = [string]$resp.Content }
    return [pscustomobject]@{ Status = [int]$resp.StatusCode; Body = $body }
  } catch {
    $ex = $_.Exception
    if ($ex -is [System.Net.WebException] -and $null -ne $ex.Response) {
      try {
        $resp = [System.Net.HttpWebResponse]$ex.Response
        $status = [int]$resp.StatusCode
        $stream = $resp.GetResponseStream()
        $reader = New-Object System.IO.StreamReader($stream)
        $body = $reader.ReadToEnd()
        $reader.Close()
        return [pscustomobject]@{ Status = $status; Body = $body }
      } catch {
        $msg = ""
        if ($null -ne $ex -and $null -ne $ex.Message) { $msg = [string]$ex.Message }
        return [pscustomobject]@{ Status = 0; Body = $msg }
      }
    }

    $msg = ""
    if ($null -ne $ex -and $null -ne $ex.Message) { $msg = [string]$ex.Message }
    return [pscustomobject]@{ Status = 0; Body = $msg }
  }
}

function Test-Route {
  param(
    [string]$Path
  )

  $url = "$BaseUrl$Path"

  $resp = Invoke-RouteProbe -Method "GET" -Url $url

  if ($resp.Status -eq 404) {
    $opt = Invoke-RouteProbe -Method "OPTIONS" -Url $url
    if ($opt.Status -ne 404 -and $opt.Status -ne 0) {
      return [pscustomobject]@{ Path = $Path; Status = 405; Body = "" }
    }
  }

  return [pscustomobject]@{ Path = $Path; Status = $resp.Status; Body = $resp.Body }
}

function Is-OkStatus {
  param([int]$Status)

  if ($Status -ge 200 -and $Status -lt 300) { return $true }
  if ($Status -eq 400 -or $Status -eq 401 -or $Status -eq 403 -or $Status -eq 405) { return $true }

  return $false
}

Write-Host "Scanning Rust routes under: $SrcRoot"

$rustFiles = Get-ChildItem -LiteralPath $SrcRoot -Recurse -File -Filter "*.rs"

$allPaths = New-Object System.Collections.Generic.HashSet[string]

foreach ($f in $rustFiles) {
  $raw = Get-RouteStringsFromRustFile -FilePath $f.FullName
  if ($raw.Count -eq 0) { continue }

  $effective = Get-EffectivePaths -FilePath $f.FullName -Paths $raw

  foreach ($p in $effective) {
    if (-not $p.StartsWith("/")) { continue }
    $null = $allPaths.Add($p)
  }
}

$paths = $allPaths | Sort-Object

Write-Host "Discovered paths: $($paths.Count)"

$failed = @()

foreach ($p0 in $paths) {
  $p = Normalize-TestPath -Path $p0

  $res = Test-Route -Path $p

  if (-not (Is-OkStatus -Status $res.Status)) {
    Write-Host "FAIL $($res.Path) -> $($res.Status)"
    if (-not [string]::IsNullOrWhiteSpace($res.Body)) {
      Write-Host $res.Body
    }
    $failed += $res
  }
}

Write-Host ""
Write-Host "Summary"
Write-Host "- Total routes: $($paths.Count)"
Write-Host "- Failures (404/5xx/0): $($failed.Count)"

if ($failed.Count -gt 0) {
  Write-Host ""
  Write-Host "Failed routes:"
  foreach ($f in $failed) {
    Write-Host "$($f.Path) -> $($f.Status)"
  }
  exit 1
}

exit 0
