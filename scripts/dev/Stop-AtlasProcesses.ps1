[CmdletBinding()]
param(
    [switch]$Force,
    [switch]$Quiet
)

$ErrorActionPreference = "Stop"

$processes = @(
    "atlas-pro",
    "api-geo",
    "postgres"
)

$killed = 0
foreach ($proc in $processes) {
    $running = Get-Process -Name $proc -ErrorAction SilentlyContinue
    if (!$running) { continue }

    foreach ($p in $running) {
        if (!$Force) {
            $confirm = Read-Host "Fermer '$proc' (PID $($p.Id)) ? [Y/n]"
            if ($confirm -eq 'n') { continue }
        }

        try {
            $p.CloseMainWindow() | Out-Null
        } catch { }

        Start-Sleep -Milliseconds 500

        $still = Get-Process -Id $p.Id -ErrorAction SilentlyContinue
        if ($still) {
            Stop-Process -Id $p.Id -Force -ErrorAction SilentlyContinue
            if (!$Quiet) { Write-Host "$proc tué (forcé)" }
        } else {
            if (!$Quiet) { Write-Host "$proc fermé" }
        }
        $killed++
    }
}

if ($killed -eq 0 -and !$Quiet) {
    Write-Host "Aucun processus Atlas en cours"
}
