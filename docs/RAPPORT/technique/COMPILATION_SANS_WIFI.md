# Guide de Compilation api-geo Sans Accès Internet
## Atlas Géotechnique du Togo — Documentation Technique

**Rédigé le** : 2026-06-05  
**Contexte** : Déploiement d'un correctif critique (sondages.rs — bug Proctor + ajout CBR/pressiomètre/pénétromètre) avec mobile data limitée, impossible de télécharger les images Docker manquantes (~200 MB de rust:1.86).  
**Résultat** : Succès via compilation native Linux dans WSL2 Ubuntu 22.04.

---

## 1. Problème Initial

Le binaire `api-geo` est compilé via Docker BuildKit (image `rust:1.86` en stage builder). Après modification du code Rust, le rebuild Docker `docker compose build api-geo` échoue car les layers de `rust:1.86` ne sont pas entièrement en cache local :

```
#11 52.36 error: failed to copy: httpReadSeeker: failed open: failed to do request:
Get "https://production.cloudfront.docker.com/...": net/http: TLS handshake timeout
→ failed to solve: failed to compute cache key: failed to copy
```

Les ~200 MB de layers manquants nécessitent du WiFi. Cette situation se produit quand :
- Le container a été construit il y a longtemps et les layers Docker BuildKit ont expiré
- On est sur mobile data (coût prohibitif)
- Docker Desktop a planté (crash GPU) et a perdu une partie de son cache

---

## 2. Méthodes Essayées (Chronologie)

### Tentative 1 — Docker Build avec cache ❌

```powershell
Set-Location "C:\PROJET_ATLAS_MASTER\atlas_reclone"
docker compose build --no-cache=false api-geo
```

**Résultat** : TLS timeout sur layer sha256:63964a8... (199.44 MB manquants).  
**Pourquoi ça échoue** : BuildKit doit valider les layers contre Docker Hub même pour ceux partiellement cachés. Sans WiFi, impossible.

---

### Tentative 2 — Cross-compilation Windows → Linux (MSVC → x86_64-unknown-linux-gnu) ❌

Rust 1.94 est installé nativement sur Windows (MSVC toolchain). L'idée : compiler pour Linux depuis Windows.

```powershell
rustup target add x86_64-unknown-linux-gnu

# Créer un wrapper .bat pour utiliser le GCC de WSL2 comme linker
@'
@echo off
wsl -d Ubuntu-22.04 -- x86_64-linux-gnu-gcc %*
'@ | Set-Content "tools\x86_64-linux-gnu-gcc.bat"

# Configurer .cargo/config.toml
[target.x86_64-unknown-linux-gnu]
linker = "C:/...tools/x86_64-linux-gnu-gcc.bat"
```

**Résultat** : La crate `ring` (cryptographie) cherche `x86_64-linux-gnu-gcc` comme **compilateur C natif** sur le PATH, pas seulement comme linker. Le wrapper `.bat` ne fonctionnait pas car `cc-rs` passe des **chemins Windows** (`C:\PROJET_ATLAS_MASTER\...`) à gcc, qui est un binaire Linux (WSL2) ne comprenant pas ces chemins.

Erreur spécifique :
```
error occurred in cc-rs: failed to find tool "x86_64-linux-gnu-gcc": program not found
# Puis après installation du wrapper :
cc1: fatal error: zstd/lib/legacy\zstd_v06.c: No such file or directory
```

**Pourquoi ça échoue** : Incompatibilité fondamentale entre chemins Windows (`\`) passés comme arguments au GCC Linux. La crate `zstd-sys` compile du C avec des chemins relatifs Windows qui deviennent invalides côté Linux.

---

### Tentative 3 — WSL2 Build depuis /mnt/c/ (Windows FS via 9P) ❌ (partiel)

```bash
wsl -d Ubuntu-22.04 -- bash -c "
  source /root/.cargo/env
  cd /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/services/api-geo
  SQLX_OFFLINE=true cargo build --release
"
```

**Résultats** :
1. Échec initial : `libc6-dev` non installé → `cannot find Scrt1.o`
2. Après installation `libc6-dev` : la compilation démarre mais est **10-20× plus lente** que sur FS natif Linux
3. Raison de la lenteur : WSL2 accède aux fichiers Windows via le protocole 9P (Plan 9 filesystem) — chaque `open()`, `stat()`, `read()` sur les sources Rust passe par une couche de traduction kernel → user-space → kernel. Rust compile des milliers de fichiers, chaque syscall est amplifié.

**Status** : Aurait probablement réussi après 45-60 minutes, mais remplacé par la méthode 4.

---

### Tentative 4 — WSL2 Build sur FS Linux Natif ✅ (SOLUTION)

**Principe** : Copier les sources du projet dans le FS Linux natif WSL2 (`~/api-geo-build`), compiler là, puis copier le binaire dans le container Docker.

Le FS natif WSL2 est un ext4 dans `docker_data.vhdx` — les I/O sont ~10-20× plus rapides que depuis `/mnt/c/`.

---

## 3. Prérequis — Installation One-Time dans WSL2 Ubuntu 22.04

À faire **une seule fois** par machine :

```bash
# 1. Démarrer WSL2 Ubuntu 22.04
wsl -d Ubuntu-22.04

# 2. Réparer les dépendances cassées (si gcc partiel de tentative précédente)
apt --fix-broken install -y
# → installe linux-libc-dev, complète libc6-dev

# 3. Installer Rust 1.86 (si pas déjà là)
curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.86.0
# → ~100-150 MB (one-time download)

# 4. Vérifier
source /root/.cargo/env
cargo --version  # → cargo 1.86.0
rustc --version  # → rustc 1.86.0
ls /usr/lib/x86_64-linux-gnu/Scrt1.o  # doit exister
```

**Packages Linux requis** (installés automatiquement par apt) :
- `libc6-dev` — fichiers de développement C (Scrt1.o, crti.o)
- `linux-libc-dev` — en-têtes kernel Linux
- `gcc` / `gcc-11` — compilateur C natif (nécessaire pour les crates avec code C : ring, zstd-sys, etc.)

---

## 4. Procédure de Build (à répéter à chaque modification du code Rust)

### Étape 1 — Copier les sources dans WSL2

```powershell
# Depuis PowerShell Windows
$script = @'
#!/bin/bash
source /root/.cargo/env

# Créer le répertoire de build dans le FS Linux natif
mkdir -p ~/api-geo-build

# Copier uniquement les fichiers nécessaires (src, Cargo.toml/lock, .sqlx)
cp -r /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/services/api-geo/src ~/api-geo-build/
cp /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/services/api-geo/Cargo.toml ~/api-geo-build/
cp /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/services/api-geo/Cargo.lock ~/api-geo-build/
cp -r /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone/services/api-geo/.sqlx ~/api-geo-build/ 2>/dev/null || true

echo "Sources copiées dans ~/api-geo-build/"
'@
$script | wsl -d Ubuntu-22.04 -- bash
```

**Note** : Le dossier `target/` n'est PAS copié (il serait recréé). Seul `src/`, `Cargo.toml`, `Cargo.lock` et `.sqlx/` sont nécessaires.

---

### Étape 2 — Compiler

```powershell
# Depuis PowerShell Windows — Heredoc pour éviter l'interpolation des $ par PowerShell
$script = @'
#!/bin/bash
source /root/.cargo/env
cd ~/api-geo-build

# Récupérer le git hash depuis le projet Windows (pour les métadonnées de version)
GIT_HASH=$(git -C /mnt/c/PROJET_ATLAS_MASTER/atlas_reclone rev-parse --short HEAD 2>/dev/null || echo "wsl2-offline-build")
BUILD_TIME=$(date -u +%Y-%m-%dT%H:%M:%SZ)

echo "Compilation api-geo..."
echo "GIT_HASH=$GIT_HASH  BUILD_TIME=$BUILD_TIME"

export GIT_HASH BUILD_TIME SQLX_OFFLINE=true
cargo build --release 2>&1 | grep -E "^error|Compiling api-geo|Finished"

# Vérifier le binaire
ls -la ~/api-geo-build/target/release/api-geo && echo "✅ BUILD SUCCÈS" || echo "❌ BUILD ÉCHOUÉ"
'@
$script | wsl -d Ubuntu-22.04 -- bash
```

**Variables d'environnement critiques** :
| Variable | Valeur | Raison |
|----------|--------|--------|
| `SQLX_OFFLINE=true` | true | Désactive la vérification compile-time sqlx contre la DB |
| `GIT_HASH` | hash git | Utilisé dans `version.rs` avec `env!("GIT_HASH")` |
| `BUILD_TIME` | ISO date | Utilisé dans `version.rs` avec `env!("BUILD_TIME")` |

**Temps de compilation** :
- Premier build (aucun cache) : ~15-20 minutes (450+ crates)
- Builds suivants (cache `~/.cargo/registry` + `target/`) : ~1-2 minutes (seulement les crates modifiées)

---

### Étape 3 — Déployer dans le container Docker

```powershell
# Le FS WSL2 est accessible depuis Windows à ce chemin UNC :
$wsl2Binary = "\\wsl.localhost\Ubuntu-22.04\root\api-geo-build\target\release\api-geo"

# Vérifier que le binaire existe
if (Test-Path $wsl2Binary) {
    $size = (Get-Item $wsl2Binary).Length
    Write-Output "Binaire trouvé : $([math]::Round($size/1MB, 1)) MB"
    
    # Copier dans le container (nom temporaire pour éviter le remplacement à chaud)
    docker cp $wsl2Binary atlas-api-geo:/usr/local/bin/api-geo-new
    
    # Remplacer le binaire de façon atomique
    docker exec atlas-api-geo chmod +x /usr/local/bin/api-geo-new
    docker exec atlas-api-geo mv /usr/local/bin/api-geo-new /usr/local/bin/api-geo
    
    # Redémarrer le container (pas rebuild — seulement restart)
    docker restart atlas-api-geo
    
    # Vérifier le démarrage
    Start-Sleep -Seconds 4
    docker logs atlas-api-geo --tail 5
} else {
    Write-Error "Binaire introuvable — vérifier l'étape 2"
}
```

---

## 5. Diagnostic des Erreurs Courantes

### `cannot find Scrt1.o`
```bash
apt --fix-broken install -y   # répare libc6-dev
# puis :
ls /usr/lib/x86_64-linux-gnu/Scrt1.o  # doit exister
```

### `environment variable GIT_HASH not defined at compile time`
La variable `GIT_HASH` n'est pas exportée avant `cargo build`. Utiliser obligatoirement le heredoc PowerShell (ci-dessus) pour éviter que PowerShell n'intercepte les `$`.

### `error[E0425]: cannot find function rho_d_max` ou équivalent
Les `.sqlx/` offline query descriptors sont périmés après modification des requêtes SQL. Pour les `query!()` macros (compile-time) : relancer `cargo sqlx prepare` depuis un environnement avec accès DB. Pour les `query_scalar()` runtime (utilisées dans sondages.rs) : pas de problème, SQLX_OFFLINE n'impacte que les macros.

### Build très lent (> 30 minutes)
Probablement en train de construire depuis `/mnt/c/` (Windows FS via 9P). Vérifier que `cd ~/api-geo-build` est bien exécuté avant `cargo build`.

---

## 6. Résumé Exécutif — Pourquoi cette méthode fonctionne

| Contrainte | Solution |
|------------|----------|
| Pas de WiFi pour `rust:1.86` Docker | Build sans Docker — Rust installé dans WSL2 |
| Cross-compile Windows→Linux impossible (paths `\`) | Build natif Linux dans WSL2 |
| FS Windows `/mnt/c/` trop lent (9P) | Copier sources dans `~/` (ext4 natif WSL2) |
| Variables d'env `$` interceptées par PowerShell | Heredoc `@'...'@` avec `wsl -- bash` |
| SQLX_OFFLINE ne couvre pas les requêtes runtime | `query_scalar()` (pas `query_scalar!()`) — pas de problème |

**Consommation data réseau** : 0 MB Docker Hub. L'installation initiale de Rust dans WSL2 coûte ~100-150 MB (one-time). Chaque build suivant : 0 MB réseau si `~/.cargo/registry` est conservé dans WSL2.

---

## 7. Procédure de Vérification Post-Déploiement

```powershell
# Vérifier que l'API est opérationnelle
docker logs atlas-api-geo --tail 5
# Attendu :
#   ✅ DB connectée avec succès
#   ✅ Router configuré avec toutes routes
#   listening on 0.0.0.0:8000

# Tester l'endpoint qui a été corrigé
$token = (Invoke-RestMethod -Method POST -Uri "http://localhost:8000/auth/login" `
    -ContentType "application/json" `
    -Body '{"email":"protazertyuiop@gmail.com","password":"atlas"}').token

# Vérifier qu'un sondage avec CBR retourne bien les données CBR
$details = Invoke-RestMethod -Uri "http://localhost:8000/sondages/4316ed39-d726-4e17-b0c8-3699b0f10bbd/details" `
    -Headers @{"Authorization"="Bearer $token"}

Write-Output "Proctor: $($details.proctor.Count) | CBR: $($details.cbr.Count) | Pressiomètre: $($details.pressiometre.Count)"
# Attendu : Proctor: 1 | CBR: 1 | Pressiomètre: 0
```

---

*Document créé le 2026-06-05 — Contexte : correctif critique sondages.rs (Proctor gamma_d_max + CBR + pressiomètre + pénétromètre)*  
*Méthode : WSL2 Ubuntu 22.04 + Rust 1.86 natif + build sur FS ext4 natif → docker cp + restart*
