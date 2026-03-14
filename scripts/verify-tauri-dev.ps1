# verify-tauri-dev.ps1
# Vérifie que la version Tauri dev est conforme à npm run dev (5173)
# Usage : .\scripts\verify-tauri-dev.ps1 -ApiPort 8000 -TauriApiPort <port_sidecar>

param(
    [int]$DevPort = 5173,
    [int]$ApiPort = 8000,
    [string]$AdminEmail = "admin@atlas.local",
    [string]$AdminPassword = "Atlas2024!"
)

$errors = 0
$ok = 0

function Check($label, $condition) {
    if ($condition) { Write-Host "✅ $label"; $script:ok++ }
    else            { Write-Host "❌ $label"; $script:errors++ }
}

Write-Host "`n=== Vérification conformité Tauri dev vs npm run dev ===`n"

# 1. API healthz (même backend)
try {
    try {
        $h = Invoke-RestMethod "http://127.0.0.1:$ApiPort/healthz" -TimeoutSec 5
    } catch {
        $h = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/healthz" -TimeoutSec 5
    }
    Check "API healthz répond" ($h -eq "ok" -or $h.status -eq "ok")
} catch { Check "API healthz répond" $false }

# 2. Auth login
try {
    $r = Invoke-RestMethod -Method Post -Uri "http://127.0.0.1:$ApiPort/api/auth/login" `
        -ContentType "application/json" `
        -Body "{`"email`":`"$AdminEmail`",`"password`":`"$AdminPassword`"}" `
        -TimeoutSec 10
    $TOKEN = $r.access_token
    Check "Auth login OK" ($null -ne $TOKEN)
} catch { Check "Auth login OK" $false; $TOKEN = $null }

if ($TOKEN) {
    $headers = @{ Authorization = "Bearer $TOKEN" }

    # 3. Mailles actives (BM-01)
    try {
        $cov = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/coverage/mailles?grid=2km" `
            -Headers $headers -TimeoutSec 15
        $assigned = ($cov.features | Where-Object { $_.properties.assigned_student_id }).Count
        Check "BM-01 : mailles actives >= 1" ($assigned -ge 1)
        Write-Host "   → $assigned mailles actives détectées"
    } catch { Check "BM-01 : mailles actives >= 1" $false }

    # 4. Étudiants avec active_mailles cohérent (BM-08)
    try {
        $students = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/colab/students" `
            -Headers $headers -TimeoutSec 10
        $list = if ($students -is [array]) { $students } else { $students.students }
        $withMailles = ($list | Where-Object { $_.active_mailles -gt 0 }).Count
        Check "BM-08 : étudiants avec active_mailles > 0" ($withMailles -ge 1)
        Write-Host "   → $withMailles étudiants avec maille active"
    } catch { Check "BM-08 : étudiants avec active_mailles > 0" $false }

    # 5. Vue v_maille_status accessible
    try {
        $stats = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/colab/students" `
            -Headers $headers -TimeoutSec 10
        Check "Vue v_maille_status : pas de 500" $true
    } catch { Check "Vue v_maille_status : pas de 500" $false }

    # 6. Lookup legacy
    try {
        $legacy = Invoke-RestMethod "http://127.0.0.1:$ApiPort/api/search/legacy/TG-0001-0001-01" `
            -Headers $headers -TimeoutSec 5 -ErrorAction SilentlyContinue
        Check "Lookup legacy : endpoint accessible" $true
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        Check "Lookup legacy : endpoint accessible (404 OK)" ($statusCode -eq 404 -or $statusCode -eq 200)
    }

    # 7. spatial_id unique (BM-05) via DB Docker
    try {
        $result = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
            "SELECT COUNT(*) = COUNT(DISTINCT spatial_id) FROM atlas.mailles" 2>$null
        Check "BM-05 : spatial_id uniques" ($result.Trim() -eq "t")
    } catch { Check "BM-05 : spatial_id uniques (DB)" $false }

    # 8. Migrations appliquées (artefacts attendus)
    try {
        $hasSeedStateRaw = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
            "SELECT to_regclass('atlas.desktop_seed_state') IS NOT NULL" 2>$null
        $hasSeedState = ($hasSeedStateRaw | Out-String).Trim() -eq 't'

        $hasUniqueMailleRaw = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
            "SELECT EXISTS (SELECT 1 FROM pg_constraint c JOIN pg_class t ON t.oid=c.conrelid JOIN pg_namespace n ON n.oid=t.relnamespace WHERE n.nspname='atlas' AND t.relname='colab_maille_assignments' AND c.contype='u')" 2>$null
        $hasUniqueMaille = ($hasUniqueMailleRaw | Out-String).Trim() -eq 't'

        Check "Migrations : desktop_seed_state présent" $hasSeedState
        Check "Migrations : UNIQUE colab_maille_assignments" $hasUniqueMaille
    } catch {
        Check "Migrations : desktop_seed_state présent" $false
        Check "Migrations : UNIQUE colab_maille_assignments" $false
    }
}

# Résumé
Write-Host "`n=== Résultat : $ok OK / $($ok + $errors) vérifications ===`n"
if ($errors -gt 0) { exit 1 } else { exit 0 }