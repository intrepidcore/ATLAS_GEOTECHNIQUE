param(
    [string]$DocsDir = "docs",
    [switch]$VerifyOnly,
    [switch]$Force
)

$ErrorActionPreference = "Stop"

function Get-SHA256Hash([string]$text) {
    $bytes = [System.Text.Encoding]::UTF8.GetBytes($text)
    $hash = [System.Security.Cryptography.SHA256]::Create()
    return [BitConverter]::ToString($hash.ComputeHash($bytes)).Replace("-", "").ToLowerInvariant()
}

function DbQuery([string]$sql) {
    docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -tAc $sql
}

function DbExec([string]$sql) {
    $out = $sql | & docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw ($out | Out-String)
    }
    return $out
}

if ($VerifyOnly) {
    Write-Host "`n=== Vérification intégrité atlas.docs_vault ===`n"
    DbQuery "SELECT path || ' | ' || status || ' | ' || detail FROM atlas.verify_docs_vault() ORDER BY status, path;" | ForEach-Object { Write-Host $_ }
    exit 0
}

$commit = "unknown"
$branch = "unknown"
try { $commit = (git rev-parse --short HEAD) } catch {}
try { $branch = (git rev-parse --abbrev-ref HEAD) } catch {}

Write-Host "`n=== Import docs → atlas.docs_vault ===`n"
Write-Host "Branch: $branch | Commit: $commit`n"

$errors = 0

Get-ChildItem -Path $DocsDir -Recurse -Filter "*.md" | ForEach-Object {
    $full = $_.FullName
    $path = $full.Replace((Get-Location).Path + "\", "").Replace("\", "/")

    $content = Get-Content -LiteralPath $full -Raw -Encoding UTF8
    if (-not $content) { return }

    $sha256 = Get-SHA256Hash $content
    $sizeBytes = [System.Text.Encoding]::UTF8.GetByteCount($content)

    $docType = if ($path -match "/adr/" -or $path -match "ADR_") { "adr" }
               elseif ($path -match "/audit/") { "audit" }
               elseif ($path -match "/session/") { "session" }
               elseif ($path -match "REGLES_METIER") { "regles" }
               elseif ($path -match "ROADMAP") { "roadmap" }
               else { "doc" }

    $existingSha = ""
    try { $existingSha = (DbQuery "SELECT sha256 FROM atlas.docs_vault WHERE path='${path}';").Trim() } catch { $existingSha = "" }

    if (-not $Force -and $existingSha -and $existingSha -eq $sha256) {
        Write-Host "⏭  $path (inchangé)"
        return
    }

    $contentEscaped = $content.Replace("'", "''")

    $sql = @"
INSERT INTO atlas.docs_vault (
  path,
  content,
  sha256,
  size_bytes,
  doc_type,
  git_commit,
  git_branch,
  imported_at,
  updated_at,
  verified_at,
  verify_ok
)
VALUES (
  '$path',
  '$contentEscaped',
  '$sha256',
  $sizeBytes,
  '$docType',
  '$commit',
  '$branch',
  NOW(),
  NOW(),
  NOW(),
  TRUE
)
ON CONFLICT (path) DO UPDATE SET
  content = EXCLUDED.content,
  sha256 = EXCLUDED.sha256,
  size_bytes = EXCLUDED.size_bytes,
  doc_type = EXCLUDED.doc_type,
  git_commit = EXCLUDED.git_commit,
  git_branch = EXCLUDED.git_branch,
  updated_at = NOW(),
  verified_at = NOW(),
  verify_ok = TRUE;
"@

    try {
        DbExec $sql | Out-Null
        Write-Host "✅ $path ($docType, $sizeBytes bytes, sha256=$($sha256.Substring(0,8))...)"
    } catch {
        Write-Host "❌ $path"
        $msg = $_.Exception.Message
        if ($msg) {
            Write-Host "   → $msg"
        }
        $errors++
    }
}

Write-Host "`n=== Résumé ===`n"
try {
    $count = (DbQuery "SELECT COUNT(*) FROM atlas.docs_vault;").Trim()
    Write-Host "Total en vault : $count documents"
    DbQuery "SELECT doc_type || ' | ' || COUNT(*) FROM atlas.docs_vault GROUP BY doc_type ORDER BY doc_type;" | ForEach-Object { Write-Host $_ }
} catch {
    Write-Host "WARN: impossible de lire le résumé docs_vault"
}

if ($errors -gt 0) {
    Write-Host "`n❌ $errors erreurs d'import"
    exit 1
}

Write-Host "`n✅ Import terminé sans erreur"
exit 0
