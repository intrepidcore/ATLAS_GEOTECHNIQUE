# audit_sondages.ps1
# Usage: .\audit_sondages.ps1
# Produira un dossier ./audit_output avec JSON/CSV et un rapport sommaire.

$OutDir = Join-Path -Path (Get-Location) -ChildPath "audit_output"
New-Item -ItemType Directory -Path $OutDir -Force | Out-Null

# 1) DB: list columns (public.sondages) and sample first row
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='public' AND table_name='sondages' ORDER BY ordinal_position;" > "$OutDir\db_sondages_columns.txt"
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT * FROM public.sondages ORDER BY created_at NULLS LAST LIMIT 1;" -A -F"," > "$OutDir\db_sondages_sample_row.csv"

# 2) DB: atlas.surveys columns and sample
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema='atlas' AND table_name='surveys' ORDER BY ordinal_position;" > "$OutDir\atlas_surveys_columns.txt"
docker exec atlas-db psql -U atlas -d atlas_clean -c "SELECT * FROM atlas.surveys ORDER BY created_at NULLS LAST LIMIT 1;" -A -F"," > "$OutDir\atlas_surveys_sample_row.csv"

# 3) API: /surveys (first 200) and /surveys-canon (first 200)
Invoke-RestMethod -Uri "http://localhost:8000/surveys?limit=200" -OutFile "$OutDir\api_surveys.json" -ErrorAction Stop
Invoke-RestMethod -Uri "http://localhost:8000/surveys-canon?limit=200" -OutFile "$OutDir\api_surveys_canon.json" -ErrorAction Stop

# 4) Extract fields from first API object for quick comparison
(Get-Content "$OutDir\api_surveys.json" -Raw | ConvertFrom-Json | Select-Object -First 1).psobject.Properties.Name | Out-File "$OutDir\api_surveys_fields.txt"
(Get-Content "$OutDir\api_surveys_canon.json" -Raw | ConvertFrom-Json | Select-Object -First 1).psobject.Properties.Name | Out-File "$OutDir\api_surveys_canon_fields.txt"

# 5) Try to find TypeScript 'interface Survey' in UI source (best-effort)
$uiPaths = @(
  "$PWD\services\ui\src",
  "$PWD\ui\src",
  "$PWD\services\atlas-ui\src",
  "$PWD\frontend\src"
)
$found = $false
foreach ($p in $uiPaths) {
  if (Test-Path $p) {
    Write-Host "Searching $p for interface Survey..."
    $match = Select-String -Path "$p\**\*.ts" -Pattern "interface\s+Survey" -SimpleMatch -ErrorAction SilentlyContinue
    if ($match) {
      $match.Path | Select-Object -Unique | Out-File "$OutDir\ui_survey_interface_paths.txt"
      $found = $true
    }
  }
}
if (-not $found) { "No TS interface Survey found in common paths. You can edit the search paths inside the script." | Out-File "$OutDir\ui_survey_interface_paths.txt" }

# 6) Run Python comparator (compare_schema.py must be present)
python .\compare_schema.py $OutDir

Write-Host "Audit finished. Outputs in $OutDir"
