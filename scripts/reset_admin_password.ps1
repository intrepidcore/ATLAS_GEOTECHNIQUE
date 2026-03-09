$ErrorActionPreference = 'Stop'

$ApiBase = if ($env:ATLAS_API_BASE) { $env:ATLAS_API_BASE.TrimEnd('/') } else { 'http://127.0.0.1:8001/api' }
$AdminEmail = if ($env:ATLAS_ADMIN_EMAIL) { $env:ATLAS_ADMIN_EMAIL } else { 'admin@atlas.local' }
$AdminUserId = if ($env:ATLAS_ADMIN_USER_ID) { $env:ATLAS_ADMIN_USER_ID } else { '00000000-0000-0000-0000-000000000001' }
$CurrentPassword = if ($env:ATLAS_ADMIN_CURRENT_PASSWORD) { $env:ATLAS_ADMIN_CURRENT_PASSWORD } else { 'Admin123!' }
$NewPassword = if ($env:ATLAS_ADMIN_NEW_PASSWORD) { $env:ATLAS_ADMIN_NEW_PASSWORD } else { 'Atlas2024!' }

$loginBody = @{ email = $AdminEmail; password = $CurrentPassword } | ConvertTo-Json
$loginResp = Invoke-WebRequest -Uri "$ApiBase/auth/login" -Method POST -Body $loginBody -ContentType 'application/json' -UseBasicParsing -TimeoutSec 15
$loginJson = $loginResp.Content | ConvertFrom-Json
$token = $loginJson.access_token

$resetBody = @{ new_password = $NewPassword; force_change = $false } | ConvertTo-Json
Invoke-WebRequest -Uri "$ApiBase/users/$AdminUserId/reset-password" -Method POST -Body $resetBody -ContentType 'application/json' -Headers @{ Authorization = "Bearer $token" } -UseBasicParsing -TimeoutSec 15 | Out-Null

$verifyBody = @{ email = $AdminEmail; password = $NewPassword } | ConvertTo-Json
$verifyResp = Invoke-WebRequest -Uri "$ApiBase/auth/login" -Method POST -Body $verifyBody -ContentType 'application/json' -UseBasicParsing -TimeoutSec 15

'OK'
"admin_password_updated_for=$AdminEmail"
"verify_login_status=$($verifyResp.StatusCode)"
