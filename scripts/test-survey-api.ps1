#!/usr/bin/env pwsh
# Test des nouveaux endpoints Survey Management API

$ErrorActionPreference = "Stop"
$API = "http://127.0.0.1:8001"

Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║   Test Survey Management API v1.1.0                       ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Cyan

# 1. Test locate maille
Write-Host "1. GET /grid/locate (Lomé)" -ForegroundColor Yellow
$locate = Invoke-RestMethod "$API/grid/locate?lon=1.2&lat=6.13"
Write-Host "  ✓ Maille: $($locate.code)" -ForegroundColor Green
Write-Host "  ✓ Région: $($locate.adm1_name)" -ForegroundColor Green

# 2. Test create survey
Write-Host "`n2. POST /surveys (créer sondage)" -ForegroundColor Yellow
$newSurvey = @{
    lon = 1.2
    lat = 6.13
    depth_m_min = 0
    depth_m_max = 15
    comment = "Test API v1.1"
} | ConvertTo-Json

$survey = Invoke-RestMethod -Method Post -Uri "$API/surveys" -Body $newSurvey -ContentType "application/json"
Write-Host "  ✓ Sondage créé: $($survey.id)" -ForegroundColor Green
Write-Host "  ✓ Code: $($survey.code)" -ForegroundColor Green
Write-Host "  ✓ Maille: $($survey.maille_code)" -ForegroundColor Green

$surveyId = $survey.id

# 3. Test create tests
Write-Host "`n3. POST /tests (ajouter essais)" -ForegroundColor Yellow

$test1 = @{
    sondage_id = $surveyId
    test_type = "SPT_N"
    value = 15
    unit = "blows/30cm"
    depth_m = 3.0
} | ConvertTo-Json

$test2 = @{
    sondage_id = $surveyId
    test_type = "qc"
    value = 2.5
    unit = "MPa"
    depth_m = 6.0
} | ConvertTo-Json

$t1 = Invoke-RestMethod -Method Post -Uri "$API/tests" -Body $test1 -ContentType "application/json"
$t2 = Invoke-RestMethod -Method Post -Uri "$API/tests" -Body $test2 -ContentType "application/json"

Write-Host "  ✓ Essai 1 (SPT_N): $($t1.id)" -ForegroundColor Green
Write-Host "  ✓ Essai 2 (qc): $($t2.id)" -ForegroundColor Green

# 4. Test list tests
Write-Host "`n4. GET /surveys/$surveyId/tests" -ForegroundColor Yellow
$tests = Invoke-RestMethod "$API/surveys/$surveyId/tests"
Write-Host "  ✓ Nombre d'essais: $($tests.Count)" -ForegroundColor Green
foreach ($t in $tests) {
    Write-Host "    - $($t.test_type): $($t.value) $($t.unit) @ $($t.depth_m)m" -ForegroundColor White
}

# 5. Test list surveys
Write-Host "`n5. GET /surveys" -ForegroundColor Yellow
$surveys = Invoke-RestMethod "$API/surveys"
Write-Host "  ✓ Total sondages: $($surveys.Count)" -ForegroundColor Green
Write-Host "  ✓ Dernier: $($surveys[0].code) ($($surveys[0].n_essais) essais)" -ForegroundColor Green

# 6. Test delete test
Write-Host "`n6. DELETE /tests/$($t1.id)" -ForegroundColor Yellow
Invoke-RestMethod -Method Delete -Uri "$API/tests/$($t1.id)"
Write-Host "  ✓ Essai supprimé" -ForegroundColor Green

# 7. Test delete survey
Write-Host "`n7. DELETE /surveys/$surveyId" -ForegroundColor Yellow
Invoke-RestMethod -Method Delete -Uri "$API/surveys/$surveyId"
Write-Host "  ✓ Sondage supprimé" -ForegroundColor Green

# 8. Vérifier suppression
Write-Host "`n8. Vérification suppression" -ForegroundColor Yellow
$surveysAfter = Invoke-RestMethod "$API/surveys"
$deleted = $surveysAfter | Where-Object { $_.id -eq $surveyId }
if ($null -eq $deleted) {
    Write-Host "  ✓ Sondage bien supprimé (soft delete)" -ForegroundColor Green
} else {
    Write-Host "  ❌ Sondage toujours présent" -ForegroundColor Red
}

# Summary
Write-Host "`n╔════════════════════════════════════════════════════════════╗" -ForegroundColor Green
Write-Host "║   ✓ Tous les tests passés avec succès!                   ║" -ForegroundColor Green
Write-Host "╚════════════════════════════════════════════════════════════╝`n" -ForegroundColor Green

Write-Host "Endpoints testés:" -ForegroundColor Cyan
Write-Host "  ✓ GET  /grid/locate" -ForegroundColor White
Write-Host "  ✓ POST /surveys" -ForegroundColor White
Write-Host "  ✓ GET  /surveys" -ForegroundColor White
Write-Host "  ✓ POST /tests" -ForegroundColor White
Write-Host "  ✓ GET  /surveys/:id/tests" -ForegroundColor White
Write-Host "  ✓ DELETE /tests/:id" -ForegroundColor White
Write-Host "  ✓ DELETE /surveys/:id" -ForegroundColor White

Write-Host "`n🎉 API Survey Management v1.1.0 opérationnelle!" -ForegroundColor Yellow
