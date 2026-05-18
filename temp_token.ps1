$body = @{email='admin@atlas.local';password='Atlas2024!'} | ConvertTo-Json
$r = Invoke-RestMethod http://127.0.0.1:8000/api/auth/login -Method POST -ContentType 'application/json' -Body $body
$r.access_token | Out-File token.tmp -NoNewline
Write-Output "Token OK: $($r.access_token.Substring(0,20))..."
Write-Output "Full token length: $($r.access_token.Length)"