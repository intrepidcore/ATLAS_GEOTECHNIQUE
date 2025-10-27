# Test du payload exact attendu par le backend
# Ce script teste différentes structures pour trouver celle qui fonctionne

$file = "C:\PROJET_ATLAS_MASTER\atlas\data\atlas_import_example.xlsx"

Write-Host "`n=== TEST 1: mapping DANS structure ===" -ForegroundColor Cyan
$config1 = @{
    format = "xlsx"
    structure = @{
        sheets = @{
            sondages = "sondages"
        }
        mapping = @{
            sondages = @{
                code = "code_site"
            }
        }
    }
    options = @{
        refresh_mv = $true
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Config 1: $config1"

# Test avec curl
curl.exe -i -X POST http://127.0.0.1:8080/api/import/bulk `
    -F "file=@$file;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
    -F "config=$config1;type=application/json"

Write-Host "`n`n=== TEST 2: mapping à la racine ===" -ForegroundColor Cyan
$config2 = @{
    format = "xlsx"
    structure = @{
        sheets = @{
            sondages = "sondages"
        }
    }
    mapping = @{
        sondages = @{
            code = "code_site"
        }
    }
    options = @{
        refresh_mv = $true
    }
} | ConvertTo-Json -Depth 10 -Compress

Write-Host "Config 2: $config2"

curl.exe -i -X POST http://127.0.0.1:8080/api/import/bulk `
    -F "file=@$file;type=application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
    -F "config=$config2;type=application/json"
