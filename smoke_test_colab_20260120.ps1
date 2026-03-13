# Smoke test Colab API 2026-01-20
# Objectif : vérifier création, désactivation, suppression (étudiants/superviseurs/missions/documents)

$ErrorActionPreference = "Stop"
$BASE = "http://localhost:8000"
$LOG = "$env:TEMP\colab_smoke_$(Get-Date -Format 'yyyyMMdd_HHmmss').json"

Write-Host "=== Smoke test Colab API ===" -ForegroundColor Cyan
Write-Host "Log : $LOG"

# Helper HTTP (compat Windows PowerShell) : curl.exe + parsing status
function Invoke-AtlasCurlJson($Method, $Path, $JsonBody) {
    $uri = "$BASE$Path"

    $tmpBodyFile = $null

    $curlArgs = @('-sS', '-X', $Method, $uri, '-w', "`n__STATUS__:%{http_code}`n")
    if ($TOKEN -and -not [string]::IsNullOrWhiteSpace($TOKEN)) {
        $curlArgs += @('-H', "Authorization: Bearer $TOKEN")
    }
    if ($JsonBody) {
        $tmpBodyFile = Join-Path $env:TEMP ("atlas_body_{0}.json" -f ([guid]::NewGuid().ToString('N')))
        [System.IO.File]::WriteAllText($tmpBodyFile, $JsonBody, (New-Object System.Text.UTF8Encoding($false)))
        $curlArgs += @('-H', 'Content-Type: application/json', '--data-binary', "@$tmpBodyFile")
    }

    $out = & curl.exe @curlArgs 2>&1

    if ($tmpBodyFile) {
        Remove-Item -Force -ErrorAction SilentlyContinue $tmpBodyFile
    }
    $outStr = ($out | Out-String)
    $parts = $outStr -split "`n__STATUS__:\s*"
    $body = $parts[0].Trim()
    $status = $null
    if ($parts.Length -ge 2) {
        $status = [int]($parts[1].Trim() -replace "\D", "")
    }

    $data = $null
    if ($body) {
        try { $data = $body | ConvertFrom-Json } catch { $data = $null }
    }

    return @{
        success = ($status -ge 200 -and $status -lt 300)
        status = $status
        data = $data
        raw = $body
    }
}

function Invoke-AtlasCurlUpload($Path, $MissionId, $Title, $DocumentType, $Description, $FilePath) {
    $uri = "$BASE$Path"
    $curlArgs = @(
        '-sS',
        '-X', 'POST',
        $uri,
        '-w', "`n__STATUS__:%{http_code}`n",
        '-F', "mission_id=$MissionId",
        '-F', "title=$Title",
        '-F', "document_type=$DocumentType",
        '-F', "description=$Description",
        '-F', "file=@$FilePath"
    )
    if ($TOKEN -and -not [string]::IsNullOrWhiteSpace($TOKEN)) {
        $curlArgs += @('-H', "Authorization: Bearer $TOKEN")
    }

    $out = & curl.exe @curlArgs 2>&1
    $outStr = ($out | Out-String)
    $parts = $outStr -split "`n__STATUS__:\s*"
    $body = $parts[0].Trim()
    $status = $null
    if ($parts.Length -ge 2) {
        $status = [int]($parts[1].Trim() -replace "\D", "")
    }

    $data = $null
    if ($body) {
        try { $data = $body | ConvertFrom-Json } catch { $data = $null }
    }

    return @{
        success = ($status -ge 200 -and $status -lt 300)
        status = $status
        data = $data
        raw = $body
    }
}

# 1) LOGIN
Write-Host "`n1) Login admin..." -ForegroundColor Yellow
$loginBody = (@{ email = "admin@atlas.local"; password = "Atlas2024!" } | ConvertTo-Json -Compress)
$login = Invoke-AtlasCurlJson 'POST' "/auth/login" $loginBody
if (-not $login.success) {
    Write-Host "Login KO : status=$($login.status)" -ForegroundColor Red
    Write-Host $login.raw
    Write-Error "Login failed";
    exit 1
}
$TOKEN = $login.data.access_token
Write-Host "Login OK"

# Détecter si les routes Colab sont sous /api ou non
Write-Host "`n1b) Détection préfixe API Colab..." -ForegroundColor Yellow
$API_PREFIX = "/api"
$probe = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/students" $null
if (-not $probe.success -and $probe.status -eq 404) {
    $API_PREFIX = ""
    $probe2 = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/students" $null
    if (-not $probe2.success -and $probe2.status -eq 404) {
        Write-Host "Préfixe Colab introuvable (404 sur /api/colab/* et /colab/*)." -ForegroundColor Red
        Write-Host "Réponse /api/colab/students: $($probe.raw)" -ForegroundColor DarkGray
        Write-Host "Réponse /colab/students: $($probe2.raw)" -ForegroundColor DarkGray
        Write-Error "Colab routes not found";
        exit 1
    }
}
Write-Host "Préfixe Colab détecté : '$API_PREFIX'" -ForegroundColor Green

# 2) CREATE STUDENT
Write-Host "`n2) Création étudiant..." -ForegroundColor Yellow
$phoneSuffix = (Get-Date -Format 'HHmmssfff')
$studentPhone = ("07{0}" -f $phoneSuffix.PadLeft(8, '0')).Substring(0, 10)
$supervisorPhone = ("06{0}" -f $phoneSuffix.PadLeft(8, '0')).Substring(0, 10)
$studentPayload = @{
    email = "smoke.student.$(Get-Date -Format 'yyyyMMdd_HHmmss')@example.test"
    first_name = "Smoke"
    last_name = "Student"
    telephone = $studentPhone
    age = 22
    promotion = "2025-2026"
} | ConvertTo-Json -Compress
$createStudent = Invoke-AtlasCurlJson 'POST' "$API_PREFIX/colab/students" $studentPayload
if (-not $createStudent.success) { Write-Error "Création étudiant échouée : $($createStudent.raw)"; exit 1 }
$STUDENT_ID = $createStudent.data.student_id
Write-Host "Étudiant créé : $STUDENT_ID"

# 3) CREATE SUPERVISOR
Write-Host "`n3) Création superviseur..." -ForegroundColor Yellow
$supervisorPayload = @{
    email = "smoke.supervisor.$(Get-Date -Format 'yyyyMMdd_HHmmss')@example.test"
    first_name = "Smoke"
    last_name = "Supervisor"
    telephone = $supervisorPhone
    institution = "Atlas Test"
} | ConvertTo-Json -Compress
$createSupervisor = Invoke-AtlasCurlJson 'POST' "$API_PREFIX/colab/supervisors" $supervisorPayload
if (-not $createSupervisor.success) { Write-Error "Création superviseur échouée : $($createSupervisor.raw)"; exit 1 }
$SUPERVISOR_ID = $createSupervisor.data.supervisor_id
Write-Host "Superviseur créé : $SUPERVISOR_ID"

# 4) CREATE MISSION
Write-Host "`n4) Création mission..." -ForegroundColor Yellow
$missionCode = "SMOKE-$(Get-Date -Format 'yyyyMMdd-HHmmss')"
$missionPayload = @{
    code = $missionCode
    title = "Smoke Mission $(Get-Date -Format 'yyyyMMdd_HHmmss')"
    theme = "synthese"
    description = "Mission de test"
    start_date = (Get-Date).ToString("yyyy-MM-dd")
    end_date = (Get-Date).AddDays(30).ToString("yyyy-MM-dd")
    assigned_student_ids = @($STUDENT_ID)
} | ConvertTo-Json -Compress
$createMission = Invoke-AtlasCurlJson 'POST' "$API_PREFIX/colab/missions" $missionPayload
if (-not $createMission.success) { Write-Error "Création mission échouée : $($createMission.raw)"; exit 1 }
$MISSION_ID = $createMission.data.id
Write-Host "Mission créée : $MISSION_ID"

# 5) VÉRIFIER LISTES AVANT ACTION
Write-Host "`n5) Listes avant actions..." -ForegroundColor Yellow
$studentsBefore = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/students" $null
$supervisorsBefore = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/supervisors" $null
$missionsBefore = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/missions" $null
$studentsBeforeTotal = if ($studentsBefore.data.total -ne $null) { $studentsBefore.data.total } else { @($studentsBefore.data.students).Count }
$supervisorsBeforeTotal = if ($supervisorsBefore.data.total -ne $null) { $supervisorsBefore.data.total } else { @($supervisorsBefore.data.supervisors).Count }
$missionsBeforeTotal = if ($missionsBefore.data.total -ne $null) { $missionsBefore.data.total } else { @($missionsBefore.data.missions).Count }
Write-Host "Étudiants avant : $studentsBeforeTotal"
Write-Host "Superviseurs avant : $supervisorsBeforeTotal"
Write-Host "Missions avant : $missionsBeforeTotal"

# 6) DÉSACTIVER (PUT is_active=false)
Write-Host "`n6) Désactiver étudiant (PUT is_active=false)..." -ForegroundColor Yellow
$deactStudentBody = (@{ is_active = $false } | ConvertTo-Json -Compress)
$deactStudent = Invoke-AtlasCurlJson 'PUT' "$API_PREFIX/colab/students/$STUDENT_ID" $deactStudentBody
Write-Host "Désactiver étudiant : status=$($deactStudent.status) success=$($deactStudent.success)"

Write-Host "`n6b) Désactiver superviseur (PUT is_active=false)..." -ForegroundColor Yellow
$deactSupervisorBody = (@{ is_active = $false } | ConvertTo-Json -Compress)
$deactSupervisor = Invoke-AtlasCurlJson 'PUT' "$API_PREFIX/colab/supervisors/$SUPERVISOR_ID" $deactSupervisorBody
Write-Host "Désactiver superviseur : status=$($deactSupervisor.status) success=$($deactSupervisor.success)"

# 7) VÉRIFIER LISTES APRÈS DÉSACTIVATION
Write-Host "`n7) Listes après désactivation..." -ForegroundColor Yellow
$studentsAfterDeact = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/students" $null
$supervisorsAfterDeact = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/supervisors" $null
$studentsAfterDeactTotal = if ($studentsAfterDeact.data.total -ne $null) { $studentsAfterDeact.data.total } else { @($studentsAfterDeact.data.students).Count }
$supervisorsAfterDeactTotal = if ($supervisorsAfterDeact.data.total -ne $null) { $supervisorsAfterDeact.data.total } else { @($supervisorsAfterDeact.data.supervisors).Count }
Write-Host "Étudiants après désactivation : $studentsAfterDeactTotal"
Write-Host "Superviseurs après désactivation : $supervisorsAfterDeactTotal"

# 8) DOCUMENTS (upload + delete) AVANT suppression mission (sinon FK mission_id)
Write-Host "`n8) Upload document (avant suppression mission)..." -ForegroundColor Yellow
$docPath = "$PSScriptRoot\docs\RAPPORT_EXPORT_2024-12-16.pdf"
if (-not (Test-Path $docPath)) { Write-Error "Fichier $docPath introuvable"; exit 1 }
$docTitle = "Smoke Document $(Get-Date -Format 'yyyyMMdd_HHmmss')"
$uploadDoc = Invoke-AtlasCurlUpload "$API_PREFIX/colab/documents" $MISSION_ID $docTitle "autre" "Document de test" $docPath
Write-Host "Upload document : status=$($uploadDoc.status) success=$($uploadDoc.success)"
if ($uploadDoc.success) {
    $DOC_ID = $uploadDoc.data.id
    Write-Host "Document ID : $DOC_ID"
} else {
    Write-Host "Upload échoué : $($uploadDoc.raw)"
}

Write-Host "`n8b) Liste documents..." -ForegroundColor Yellow
$docsBefore = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/documents" $null
$docsBeforeTotal = if ($docsBefore.data.total -ne $null) { $docsBefore.data.total } else { @($docsBefore.data.documents).Count }
Write-Host "Documents avant suppression : $docsBeforeTotal"

if ($DOC_ID) {
    Write-Host "`n8c) Supprimer document..." -ForegroundColor Yellow
    $delDoc = Invoke-AtlasCurlJson 'DELETE' "$API_PREFIX/colab/documents/$DOC_ID" $null
    Write-Host "Supprimer document : status=$($delDoc.status) success=$($delDoc.success)"
}

Write-Host "`n8d) Liste documents après suppression..." -ForegroundColor Yellow
$docsAfter = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/documents" $null
$docsAfterTotal = if ($docsAfter.data.total -ne $null) { $docsAfter.data.total } else { @($docsAfter.data.documents).Count }
Write-Host "Documents après suppression : $docsAfterTotal"

# 9) SUPPRIMER (DELETE)
Write-Host "`n9) Supprimer mission (DELETE)..." -ForegroundColor Yellow
$delMission = Invoke-AtlasCurlJson 'DELETE' "$API_PREFIX/colab/missions/$MISSION_ID" $null
Write-Host "Supprimer mission : status=$($delMission.status) success=$($delMission.success)"

Write-Host "`n9b) Supprimer étudiant (DELETE)..." -ForegroundColor Yellow
$delStudent = Invoke-AtlasCurlJson 'DELETE' "$API_PREFIX/colab/students/$STUDENT_ID" $null
Write-Host "Supprimer étudiant : status=$($delStudent.status) success=$($delStudent.success)"

Write-Host "`n9c) Supprimer superviseur (DELETE)..." -ForegroundColor Yellow
$delSupervisor = Invoke-AtlasCurlJson 'DELETE' "$API_PREFIX/colab/supervisors/$SUPERVISOR_ID" $null
Write-Host "Supprimer superviseur : status=$($delSupervisor.status) success=$($delSupervisor.success)"

# 10) VÉRIFIER LISTES APRÈS SUPPRESSION + présence des IDs
Write-Host "`n10) Listes après suppression..." -ForegroundColor Yellow
$studentsAfterDelete = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/students" $null
$supervisorsAfterDelete = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/supervisors" $null
$missionsAfterDelete = Invoke-AtlasCurlJson 'GET' "$API_PREFIX/colab/missions" $null
$studentsAfterDeleteTotal = if ($studentsAfterDelete.data.total -ne $null) { $studentsAfterDelete.data.total } else { @($studentsAfterDelete.data.students).Count }
$supervisorsAfterDeleteTotal = if ($supervisorsAfterDelete.data.total -ne $null) { $supervisorsAfterDelete.data.total } else { @($supervisorsAfterDelete.data.supervisors).Count }
$missionsAfterDeleteTotal = if ($missionsAfterDelete.data.total -ne $null) { $missionsAfterDelete.data.total } else { @($missionsAfterDelete.data.missions).Count }
Write-Host "Étudiants après suppression : $studentsAfterDeleteTotal"
Write-Host "Superviseurs après suppression : $supervisorsAfterDeleteTotal"
Write-Host "Missions après suppression : $missionsAfterDeleteTotal"

$studentStillListed = $false
if ($studentsAfterDelete.data -and $studentsAfterDelete.data.students) {
    $studentStillListed = @($studentsAfterDelete.data.students | Where-Object { $_.id -eq $STUDENT_ID }).Count -gt 0
}
$supervisorStillListed = $false
if ($supervisorsAfterDelete.data) {
    $supList = $supervisorsAfterDelete.data
    if ($supList -is [System.Collections.IEnumerable]) {
        $supervisorStillListed = @($supList | Where-Object { $_.id -eq $SUPERVISOR_ID }).Count -gt 0
    }
}
Write-Host "Étudiant supprimé encore présent dans la liste ? $studentStillListed" -ForegroundColor Yellow
Write-Host "Superviseur supprimé encore présent dans la liste ? $supervisorStillListed" -ForegroundColor Yellow

# 14) LOG FINAL
$logObj = @{
    timestamp = (Get-Date -Format "yyyy-MM-dd HH:mm:ss")
    login = $login
    create_student = $createStudent
    create_supervisor = $createSupervisor
    create_mission = $createMission
    lists_before = @{ students=$studentsBeforeTotal; supervisors=$supervisorsBeforeTotal; missions=$missionsBeforeTotal }
    deactivate_student = $deactStudent
    deactivate_supervisor = $deactSupervisor
    lists_after_deactivate = @{ students=$studentsAfterDeactTotal; supervisors=$supervisorsAfterDeactTotal }
    upload_document = $uploadDoc
    document_id = $DOC_ID
    delete_document = $delDoc
    lists_documents = @{ before=$docsBeforeTotal; after=$docsAfterTotal }
    delete_student = $delStudent
    delete_supervisor = $delSupervisor
    delete_mission = $delMission
    lists_after_delete = @{ students=$studentsAfterDeleteTotal; supervisors=$supervisorsAfterDeleteTotal; missions=$missionsAfterDeleteTotal }
    checks = @{ student_still_listed = $studentStillListed; supervisor_still_listed = $supervisorStillListed }
}
$logObj | ConvertTo-Json -Depth 10 | Set-Content -Path $LOG -Encoding UTF8
Write-Host "`nLog écrit dans : $LOG" -ForegroundColor Green

# 15) RÉSUMÉ
Write-Host "`n=== RÉSUMÉ ===" -ForegroundColor Cyan
Write-Host "Création étudiant/superviseur/mission : OK"
Write-Host "Désactivation étudiant/superviseur : status=$($deactStudent.status)/$($deactSupervisor.status)"
Write-Host "Suppression étudiant/superviseur/mission : status=$($delStudent.status)/$($delSupervisor.status)/$($delMission.status)"
Write-Host "Upload document : status=$($uploadDoc.status) id=$DOC_ID"
Write-Host "Suppression document : status=$($delDoc.status)"
Write-Host "Log : $LOG"
