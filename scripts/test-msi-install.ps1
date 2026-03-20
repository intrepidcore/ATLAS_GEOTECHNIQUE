# Requires -RunAsAdministrator
[CmdletBinding()]
param(
    [Parameter(Mandatory=$true)]
    [string]$MsiPath,
    
    [int]$StartupTimeoutSeconds = 120,
    [string]$ReportPath = "msi-test-report.json",
    [string]$LogDir = "msi-test-logs"
)

$ErrorActionPreference = "Stop"

$results = @{ 
    steps = @(); 
    passed = 0; 
    failed = 0;
    start_time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ");
    end_time = $null;
    msi_path = $MsiPath;
    overall_status = "pending"
}

function Step {
    param([string]$Name, [scriptblock]$Action, [bool]$Critical = $true)
    
    $step = @{ name = $Name; status = "pending"; duration_ms = 0; log = $null }
    $sw = [System.Diagnostics.Stopwatch]::StartNew()
    
    try {
        $output = & $Action 2>&1 | Out-String
        $step.status = "passed"
        $step.log = $output
        $results.passed++
        Write-Host "  ✅ $Name" -ForegroundColor Green
    } catch {
        $step.status = "failed"
        $step.error = $_.Exception.Message
        $step.log = $_.ScriptStackTrace
        $results.failed++
        Write-Host "  ❌ $Name : $($_.Exception.Message)" -ForegroundColor Red
        if ($Critical) { throw }
    } finally {
        $sw.Stop()
        $step.duration_ms = $sw.ElapsedMilliseconds
        $results.steps += $step
    }
}

function Test-FileLocked {
    param([string]$Path)
    try {
        $stream = [IO.File]::Open($Path, 'Open', 'ReadWrite', 'None')
        $stream.Close()
        return $false
    } catch {
        return $true
    }
}

# Ensure log directory exists
New-Item -ItemType Directory -Force -Path $LogDir | Out-Null
$installLog = Join-Path $LogDir "msi-install.log"
$appLog = Join-Path $LogDir "atlas-pro.log"

$process = $null
try {
    # ─── PHASE 1 : Validation & Installation ─────────────────────────────────────
    Write-Host "`n📦 Phase 1 : Validation & Installation MSI" -ForegroundColor Cyan
    
    Step "MSI existe et est valide" {
        if (!(Test-Path $MsiPath)) { throw "MSI non trouvé : $MsiPath" }
        $size = (Get-Item $MsiPath).Length
        if ($size -lt 10MB) { throw "MSI trop petit : $([Math]::Round($size/1MB, 1)) MB" }
    }
    
    Step "Vérification lock fichier MSI" {
        if (Test-FileLocked -Path $MsiPath) {
            throw "Le fichier MSI est verrouillé (peut-être en cours d'utilisation)"
        }
    }
    
    Step "Installation silencieuse MSI" {
        $proc = Start-Process msiexec.exe `
            -ArgumentList "/i `"$MsiPath`" /qn /log `"$installLog`"" `
            -Wait -PassThru
        if ($proc.ExitCode -ne 0) { 
            throw "msiexec exit code: $($proc.ExitCode)"
        }
    }
    
    Step "Binaire installé présent" {
        $installDir = "$env:LOCALAPPDATA\IntrepidCore\Atlas"
        $exe = Join-Path $installDir "atlas-pro.exe"
        if (!(Test-Path $exe)) { throw "Binaire absent: $exe" }
    }

    # ─── PHASE 2 : Démarrage Application ─────────────────────────────────────────
    Write-Host "`n🚀 Phase 2 : Démarrage Application" -ForegroundColor Cyan
    
    Step "Lancement en mode smoke-test" {
        $env:ATLAS_SMOKE_TEST = "1"
        $env:ATLAS_LOG_LEVEL = "debug"
        
        $exePath = "$env:LOCALAPPDATA\IntrepidCore\Atlas\atlas-pro.exe"
        
        # Create log file for stdout/stderr
        $process = Start-Process $exePath `
            -ArgumentList "--smoke-test" `
            -PassThru `
            -RedirectStandardOutput $appLog `
            -RedirectStandardError $appLog
        
        Write-Host "    PID: $($process.Id)" -ForegroundColor Gray
    }
    
    Step "Attente healthz API" {
        $deadline = (Get-Date).AddSeconds($StartupTimeoutSeconds)
        $healthy = $false
        $lastError = $null
        
        while ((Get-Date) -lt $deadline) {
            try {
                $resp = Invoke-RestMethod "http://127.0.0.1:8000/healthz" `
                    -TimeoutSec 2 -ErrorAction SilentlyContinue
                if ($resp.status -eq "ok") {
                    $healthy = $true
                    break
                }
            } catch { 
                $lastError = $_
            }
            Start-Sleep -Seconds 2
            Write-Host "    ... attente healthz ($([Math]::Round((New-TimeSpan -Start (Get-Date) -End $deadline).TotalSeconds))s restantes)" -ForegroundColor Gray
        }
        
        if (!$healthy) { 
            throw "Timeout: API non disponible après $StartupTimeoutSeconds s. Dernier erreur: $lastError"
        }
    }

    # ─── PHASE 3 : Vérifications Données ─────────────────────────────────────────
    Write-Host "`n🔍 Phase 3 : Vérifications Données" -ForegroundColor Cyan
    
    Step "Authentification admin" {
        $resp = Invoke-RestMethod `
            -Method Post `
            -Uri "http://127.0.0.1:8000/api/auth/login" `
            -ContentType "application/json" `
            -Body '{"email":"admin@atlas.local","password":"Atlas2024!"}' `
            -TimeoutSec 10
        
        if (!$resp.access_token) { throw "Token d'accès vide" }
        $script:token = $resp.access_token
    }
    
    $headers = @{ Authorization = "Bearer $script:token" }
    
    Step "Vérification mailles (≥29407)" {
        $resp = Invoke-RestMethod `
            -Uri "http://127.0.0.1:8000/api/colab/mailles/stats" `
            -Headers $headers `
            -TimeoutSec 10
        
        if ($resp.total -lt 29407) { 
            throw "Mailles insuffisantes: $($resp.total) < 29407" 
        }
    }
    
    Step "Route /colab/students accessible" {
        Invoke-RestMethod `
            -Uri "http://127.0.0.1:8000/api/colab/students" `
            -Headers $headers `
            -TimeoutSec 10 | Out-Null
    }
    
    Step "Vérification PostGIS via API" {
        $resp = Invoke-RestMethod `
            -Uri "http://127.0.0.1:8000/api/colab/mailles?limit=1" `
            -Headers $headers `
            -TimeoutSec 10
        if (!$resp.data -or $resp.data.Count -eq 0) { 
            throw "Aucune maille retournée"
        }
    }
    
    Step "Endpoint /maille/{code} fonctionnel" {
        # Test avec une maille connue (Paris centre)
        $testCodes = @("75101", "75102", "75103")
        $found = $false
        foreach ($code in $testCodes) {
            try {
                $resp = Invoke-RestMethod `
                    -Uri "http://127.0.0.1:8000/api/colab/maille/$code" `
                    -Headers $headers `
                    -TimeoutSec 5 `
                    -ErrorAction SilentlyContinue
                if ($resp.code -eq $code) {
                    $found = $true
                    break
                }
            } catch { }
        }
        if (!$found) { throw "Endpoint /maille/{code} non fonctionnel pour les codes testés" }
    }

    $results.overall_status = "PASSED"
    Write-Host "`n✅ TOUTES LES VÉRIFICATIONS RÉUSSIES" -ForegroundColor Green

} catch {
    $results.overall_status = "FAILED"
    Write-Host "`n❌ TEST ÉCHOUÉ: $_" -ForegroundColor Red
} finally {
    # ─── CLEANUP ─────────────────────────────────────────────────────────────────
    Write-Host "`n🧹 Cleanup" -ForegroundColor Cyan
    
    if ($process -and !$process.HasExited) {
        Write-Host "  Arrêt processus PID $($process.Id)..." -ForegroundColor Gray
        Stop-Process -Id $process.Id -Force -ErrorAction SilentlyContinue
        Start-Sleep -Seconds 2
    }
    
    # Collect additional logs
    $installDir = "$env:LOCALAPPDATA\IntrepidCore\Atlas"
    $logSource = "$env:LOCALAPPDATA\IntrepidCore\Atlas\logs"
    if (Test-Path $logSource) {
        Copy-Item -Path $logSource -Destination $LogDir -Recurse -Force -ErrorAction SilentlyContinue
    }
    
    # Uninstall MSI
    Step "Désinstallation MSI" {
        $proc = Start-Process msiexec.exe `
            -ArgumentList "/x `"$MsiPath`" /qn" `
            -Wait -PassThru
        # Exit code 0 = success, 3010 = success reboot required
        if ($proc.ExitCode -ne 0 -and $proc.ExitCode -ne 3010) {
            throw "msiexec uninstall exit code: $($proc.ExitCode)"
        }
    } -Critical $false
    
    # Finalize report
    $results.end_time = (Get-Date -Format "yyyy-MM-ddTHH:mm:ssZ")
    $results | ConvertTo-Json -Depth 5 | Set-Content $ReportPath
    
    Write-Host "`n📄 Rapport: $ReportPath" -ForegroundColor Gray
    Write-Host "📁 Logs: $LogDir" -ForegroundColor Gray
    Write-Host "`n=== RÉSUMÉ ===" -ForegroundColor Cyan
    Write-Host "Status: $($results.overall_status)" -ForegroundColor $(if($results.overall_status -eq "PASSED"){"Green"}else{"Red"})
    Write-Host "Étapes réussies: $($results.passed) / $($results.passed + $results.failed)"
    
    if ($results.failed -gt 0) {
        exit 1
    }
}
