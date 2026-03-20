# CI — Récupérer les logs GitHub Actions depuis le terminal

Objectif : éviter de cliquer dans l’UI GitHub pour diagnostiquer les échecs CI.

Ce repo fournit 2 approches complémentaires :

- **Logs natifs Actions via `gh run view --log`** (toujours disponible)
- **Artifacts de logs** uploadés automatiquement par les workflows (pratique pour garder des fichiers structurés par job)

## 1) Prérequis

### 1.1 Installer GitHub CLI (`gh`)

Windows (winget) :

```powershell
winget install GitHub.cli
```

Windows (chocolatey) :

```powershell
choco install gh
```

### 1.2 Authentification

```powershell
gh auth login
```

Optionnel :

```powershell
gh auth status
```

## 2) Récupérer rapidement les logs (sans artifacts)

Lister les derniers runs :

```powershell
gh run list -R prodeka/ATLAS_GEOTECHNIQUE -L 10
```

Afficher les logs d’un run (id) dans le terminal :

```powershell
gh run view 23328404936 -R prodeka/ATLAS_GEOTECHNIQUE --log
```

Sauver les logs dans un fichier :

```powershell
gh run view 23328404936 -R prodeka/ATLAS_GEOTECHNIQUE --log > workflow_23328404936.log
```

## 3) Télécharger les artifacts (logs structurés, rapports)

Si les workflows uploadent des artifacts :

```powershell
gh run download 23328404936 -R prodeka/ATLAS_GEOTECHNIQUE
```

## 4) Script automatisé dans le repo

Le repo inclut :

- `scripts/gh/Get-GitHubActionsLogs.ps1`

Exemples :

### 4.1 Télécharger le dernier run (quel qu’il soit)

```powershell
pwsh ./scripts/gh/Get-GitHubActionsLogs.ps1 -Repo prodeka/ATLAS_GEOTECHNIQUE
```

### 4.2 Télécharger le dernier run en échec

```powershell
pwsh ./scripts/gh/Get-GitHubActionsLogs.ps1 -Repo prodeka/ATLAS_GEOTECHNIQUE -Status failure
```

### 4.3 Choisir un run précis et télécharger aussi les artifacts

```powershell
pwsh ./scripts/gh/Get-GitHubActionsLogs.ps1 -Repo prodeka/ATLAS_GEOTECHNIQUE -RunId 23328404936 -DownloadArtifacts
```

Les sorties sont stockées dans `./.ci-logs/` (par défaut).

## 5) Ce qui est maintenant auto-upload dans CI

Le workflow `CI` (`.github/workflows/ci.yml`) upload maintenant automatiquement :

- `ci-logs-rust-<svc>` : logs `fmt/clippy/check/test/sqlx` par service (`api-geo`, `api-infer`, `api-opti`)
- `ci-logs-ui` : logs `build` + `bundle-size` (+ lint si présent)

Cela permet un diagnostic offline rapide via `gh run download`.
