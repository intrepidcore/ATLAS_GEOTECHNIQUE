param(
    [Parameter(Mandatory = $true)]
    [string]$KeyPath,

    [Parameter(Mandatory = $false)]
    [SecureString]$Password,

    [Parameter(Mandatory = $false)]
    [switch]$RevealPassword
)

if (-not (Test-Path $KeyPath)) {
    Write-Error "Key file not found: $KeyPath"
    exit 1
}

$privateKey = Get-Content -Raw $KeyPath
$privateKey = $privateKey.Trim()

if (-not $privateKey) {
    Write-Error "Key file is empty: $KeyPath"
    exit 1
}

Write-Host "\n=== GitHub Secrets (Tauri Updater Signing) ===\n"
Write-Host "TAURI_SIGNING_PRIVATE_KEY:" -ForegroundColor Cyan
Write-Host $privateKey

Write-Host "\nTAURI_SIGNING_PRIVATE_KEY_PASSWORD:" -ForegroundColor Cyan
if ($null -eq $Password) {
    Write-Host ""
} elseif ($RevealPassword) {
    $plain = (New-Object System.Net.NetworkCredential('', $Password)).Password
    Write-Host $plain
} else {
    Write-Host "<hidden> (use -RevealPassword to print)"
}

Write-Host "\nNotes:" -ForegroundColor Yellow
Write-Host "- Ne commitez jamais la clé privée."
Write-Host "- Configurez ces valeurs dans GitHub -> Settings -> Secrets and variables -> Actions."
