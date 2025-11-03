param([string]$file)

$dsn = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

Write-Host "Import de: $file" -ForegroundColor Cyan
python scripts\02_import_excel.py --file $file --dsn $dsn --import-raw yes
