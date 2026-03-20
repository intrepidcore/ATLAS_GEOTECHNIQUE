param(
  [string]$Repo = 'prodeka/ATLAS_GEOTECHNIQUE',
  [int]$Limit = 10,
  [string]$Status = '',
  [int]$RunId = 0,
  [switch]$DownloadArtifacts,
  [string]$OutDir = './.ci-logs'
)

$ErrorActionPreference = 'Stop'

function Assert-Gh {
  $gh = Get-Command gh -ErrorAction SilentlyContinue
  if (-not $gh) {
    throw "GitHub CLI (gh) not found. Install: winget install GitHub.cli or choco install gh"
  }
}

function Ensure-OutDir([string]$dir) {
  if (-not (Test-Path $dir)) {
    New-Item -ItemType Directory -Path $dir | Out-Null
  }
}

Assert-Gh
Ensure-OutDir $OutDir

if ($RunId -eq 0) {
  $args = @('run','list','-R',$Repo,'-L',$Limit,'--json','databaseId,conclusion,status,headBranch,displayTitle,createdAt')
  if ($Status -ne '') {
    $args += @('--status',$Status)
  }

  $runsJson = & gh @args
  $runs = $runsJson | ConvertFrom-Json
  if (-not $runs -or $runs.Count -eq 0) {
    Write-Host "No runs found." -ForegroundColor Yellow
    exit 0
  }

  $RunId = [int]$runs[0].databaseId
  Write-Host "Using latest run: $RunId ($($runs[0].displayTitle))" -ForegroundColor Cyan
}

$logPath = Join-Path $OutDir "run_$RunId.log"
Write-Host "Downloading workflow log to $logPath" -ForegroundColor Cyan
& gh run view $RunId -R $Repo --log | Out-File -FilePath $logPath -Encoding utf8

Write-Host "Summary:" -ForegroundColor Cyan
Get-Content $logPath -Tail 60

if ($DownloadArtifacts) {
  $artifactDir = Join-Path $OutDir "run_$RunId.artifacts"
  Ensure-OutDir $artifactDir
  Write-Host "Downloading artifacts to $artifactDir" -ForegroundColor Cyan
  Push-Location $artifactDir
  try {
    & gh run download $RunId -R $Repo
  } finally {
    Pop-Location
  }
}
