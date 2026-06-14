# Gestion de l'Espace Disque — Atlas Géotechnique du Togo
## Journal raisonné des opérations de récupération d'espace

**Rédigé le** : 2026-06-14  
**Contexte** : Disque C: à 0.2 GB libre sur 474 GB total. Analyse complète et nettoyage effectués.

---

## Pourquoi ce document existe

Un projet de cette nature — compilation Rust, images Docker multi-GB, seeds de base de données
géospatiale, modèles d'interpolation IA — génère naturellement des dizaines de gigaoctets
d'artefacts. Sans politique de nettoyage documentée, le disque se remplit de façon invisible :
les builds Docker accumulent des layers orphelins, les VHDX WSL2 grandissent mais ne rétrécissent
jamais automatiquement, les artefacts Rust target/ doublonnent sur Windows et WSL.

Ce document répond à deux questions :
1. **Qu'est-ce qui prend de la place et pourquoi ?**
2. **Quoi supprimer, quoi absolument garder, et comment récupérer l'espace proprement ?**

---

## 1. Cartographie de l'espace disque (état 2026-06-14)

```
C:\ — 474.2 GB utilisés / 0.2 GB libres
│
├── AppData\Local\Docker\wsl\           58 GB  ← VHDX Docker WSL2
│   └── disk\docker_data.vhdx           57.9 GB  (dont ~30 GB de "trous")
│
├── AppData\Local\Packages\             14 GB  ← Apps UWP Windows
│
├── PROJET_ATLAS_MASTER\atlas_reclone\  26.8 GB
│   ├── data\db\backups\                10.9 GB  (seeds dump v2+v3)
│   ├── services\api-geo\target\         9.2 GB  (Rust build artifacts)
│   ├── apps\atlas-pro\src-tauri\target\ 2.8 GB  (Rust build Tauri)
│   └── ressource\                       1.4 GB
│
├── Downloads\                          27.3 GB
│   ├── gemma-4-E4B-it-Q4_K_M.gguf      5.1 GB  (LLM local)
│   ├── mmproj-gemma-4-E4B-it-BF16.gguf 0.95 GB
│   ├── QGIS-OSGeo4W-3.34.15-1.msi      1.3 GB  (installeur déjà utilisé)
│   ├── srtm_clipped_utm30n.tif         0.72 GB
│   └── ... autres                       ~19 GB
│
└── Program Files\PostgreSQL\           11.6 GB  (PG natif, source de vérité api-geo)
```

---

## 2. Pourquoi Docker occupe-t-il autant d'espace et ne le libère pas ?

### Le mécanisme du VHDX

Docker sous WSL2 stocke toutes ses données (images, containers, volumes) dans un seul fichier :
`docker_data.vhdx`. Ce fichier est un **disque virtuel** Hyper-V.

**Le problème fondamental :** ce disque ne peut que grandir. Quand Docker supprime une image,
il marque les blocs comme "libres" dans le système de fichiers ext4 à l'intérieur du VHDX —
mais Windows ne sait pas que ces blocs sont libres. L'hyperviseur WSL2 voit un disque opaque
de 58 GB et ne peut pas lire son contenu pour en déduire l'occupation réelle.

**Pourquoi Microsoft n'a pas activé le trim automatique :**
WSL2 tourne dans une VM Hyper-V légère. Un *balloon driver* (mécanisme qui signale les pages
libres à l'hôte) existe pour la RAM mais pas pour le disque dans les versions antérieures à 2.4.
Chaque rebuild Docker, chaque `docker pull`, chaque `docker build` qui échoue à mi-chemin
laisse des blocs alloués dans le VHDX qui ne seront jamais récupérés sans intervention manuelle.

### Timeline de croissance sur ce projet

```
Déc 2025 : docker pull postgis, atlas-ui          →  +2 GB   VHDX ≈ 5 GB
Jan 2026 : premier build api-geo (rust:1.86)      →  +9 GB   VHDX ≈ 15 GB
Fév 2026 : atlas-qgis-worker (QGIS + Python)      → +11 GB   VHDX ≈ 27 GB
Mar 2026 : builds échoués printpdf × 5 tentatives →  +5 GB   VHDX ≈ 35 GB
Avr 2026 : lcpi-qgis-service (remplacé plus tard) →  +7 GB   VHDX ≈ 43 GB
Mai 2026 : rebuilds MCP playwright, tests          →  +3 GB   VHDX ≈ 48 GB
Jun 2026 : nouvelle version api-geo-builder        →  +5 GB   VHDX ≈ 57 GB
           → docker rmi de tout ça                →   0 GB   VHDX = 57 GB ← ratchet
```

**Conclusion :** 57 GB alloués, ~25 GB réellement utilisés. 32 GB de "trous" récupérables
uniquement via compaction explicite du VHDX.

---

## 3. Opération de nettoyage du 2026-06-14

### 3.1 Inventaire Docker avant nettoyage

```
Images (13 au total, 47.26 GB)     Containers (6)         Build cache
──────────────────────────────     ──────────────         ───────────
atlas-api-geo:latest    8.63 GB    atlas-api-geo   UP     Total    : 25.26 GB
atlas-qgis-worker      11.10 GB    atlas-db        UP     Reclaim  :  7.43 GB
atlas-api-infer         1.16 GB    atlas-api-opti  UP
atlas-api-opti          0.14 GB    atlas-api-infer UP
postgis/postgis:17-3.4  0.86 GB    atlas-qgis-wrk  UP
atlas-ui                0.08 GB    atlas-ui        EXITED ← stoppé depuis 4 jours
ubuntu:22.04            0.12 GB
alpine:latest           0.01 GB
atlas-api-geo-builder   2.33 GB  ← builder stage, inutile au runtime
api-geo-builder         2.29 GB  ← ancienne version, doublon du précédent
lcpi-qgis-service       6.71 GB  ← remplacé par atlas-qgis-worker
mcp/playwright ×2       2.86 GB  ← outil MCP non lié à Atlas
```

### 3.2 Raisonnement de tri

**Pourquoi supprimer les builder stages (`atlas-api-geo-builder`, `api-geo-builder`) ?**
Dans un Dockerfile multi-stage, le stage `builder` compile le code Rust et copie uniquement
le binaire vers l'image finale. Ce stage n'est nécessaire que pendant le `docker build`.
Une fois le binaire dans `atlas-api-geo:latest`, le builder est un artefact mort de 4.6 GB.
Il peut être regénéré en cas de nouveau build (qui, sans WiFi, se fait via WSL2 de toute façon).

**Pourquoi supprimer `lcpi-qgis-service` ?**
Cette image (6.71 GB) était l'implémentation initiale du worker QGIS. Elle a été remplacée
par `atlas-qgis-worker` (11.1 GB, plus complète). Aucun container ne l'utilise plus.
La garder n'apporte rien — elle ne peut pas être utilisée sans `docker-compose.yml` adapté.

**Pourquoi supprimer `mcp/playwright` ?**
Images téléchargées automatiquement par Claude Code pour ses outils MCP. Non liées au projet
Atlas. 2.86 GB pour un outil de test navigateur qui n'est pas dans notre pipeline.

**Pourquoi garder `atlas-ui` même si le container est stoppé ?**
L'image fait 79 MB et le container peut être redémarré via `docker compose up atlas-ui`.
La supprimer obligerait un `docker compose build atlas-ui` (2 min, mais nécessite les sources).

**Pourquoi ne pas faire `docker system prune -a` ?**
Cette commande supprimerait TOUTES les images non actives en ce moment, y compris `atlas-ui`
et `ubuntu:22.04`. Elle est dangereuse sans inventaire préalable car elle opère en bloc sans
discernement. Le nettoyage ciblé ci-dessus est chirurgical et réversible (les images supprimées
peuvent être reconstruites, contrairement aux volumes).

### 3.3 Commandes exécutées

```powershell
docker rm atlas-ui                              # container stoppé (94 MB layer)
docker rmi atlas-api-geo-builder:latest         # builder stage (2.33 GB)
docker rmi api-geo-builder:latest               # doublon ancien (2.29 GB)
docker rmi lcpi-qgis-service:latest             # remplacé (6.71 GB)
docker image prune -f --filter "reference=mcp/playwright"  # MCP (2.86 GB)
docker builder prune -f                         # cache BuildKit reclaimable (7.4 GB → 16.5 GB supprimés)
```

### 3.4 Résultat mesuré

```
                   Avant         Après        Gagné
Images Docker  :  47.26 GB  →  27.90 GB   = −19.36 GB
Build cache    :  25.26 GB  →   8.79 GB   = −16.47 GB
─────────────────────────────────────────────────────
Total Docker   :  72.52 GB  →  36.69 GB   = −35.83 GB
Disque C: libre:   0.20 GB  →   2.94 GB   = + 2.74 GB visible
```

**Pourquoi seulement +2.74 GB visible alors que 35 GB ont été supprimés ?**
Les données ont été effacées dans ext4 à l'intérieur du VHDX, mais Windows voit encore un
fichier de 57.89 GB. La compaction du VHDX (Optimize-VHD) est nécessaire pour que Windows
récupère physiquement ces blocs. Cette opération nécessite des droits administrateur.

---

## 4. Compaction du VHDX — Procédure (droits admin requis)

### Pourquoi les droits admin ?

`Optimize-VHD` fait partie du module PowerShell `Hyper-V` qui exige des privilèges élevés
car il interagit avec l'hyperviseur au niveau kernel. Sans admin, même avec le fichier ouvert,
Windows refuse de le monter en mode maintenance.

### Procédure

Un script prêt-à-l'emploi a été créé sur le Bureau :
```
C:\Users\Serge TABE DJATO\Desktop\COMPACT_DOCKER_VHDX_ADMIN.ps1
```

Utilisation :
```
1. Arrêter Docker Desktop
2. Clic droit sur le script → "Exécuter en tant qu'administrateur"
3. Attendre 5-15 min (57 GB à compacter)
4. Relancer Docker Desktop
5. docker compose up -d   (dans atlas_reclone/)
```

Gain attendu : **~30 GB** récupérés sur le disque physique.

### Alternative permanente — sparseVhd (configurée le 2026-06-14)

Fichier `C:\Users\Serge TABE DJATO\.wslconfig` mis à jour :
```ini
[wsl2]
autoMemoryReclaim=gradual    # libère la RAM WSL inutilisée progressivement

[experimental]
sparseVhd=true               # VHDX sparse : les blocs libérés sont rendus à Windows
                             # en temps réel, sans compaction manuelle
                             # Actif depuis WSL 2.4+ (version installée : 2.6.3)
```

Avec `sparseVhd=true`, chaque `docker rmi` futur libérera immédiatement l'espace sur le SSD.
Le VHDX ne gonflera plus de façon permanente. **Cette option ne s'applique qu'aux nouvelles
allocations** — les 57 GB existants nécessitent quand même la compaction one-shot.

---

## 5. Ce qu'il faut absolument ne pas supprimer

### 5.1 Docker — images nécessaires au runtime Atlas

| Image | Taille | Raison de conserver |
|-------|--------|---------------------|
| `atlas-api-geo:latest` | 8.63 GB | API principale — toute la logique métier |
| `atlas-qgis-worker:latest` | 11.1 GB | Worker géospatial — QGIS + Python + libs |
| `atlas-api-infer:latest` | 1.16 GB | Pipeline ML inférence |
| `atlas-api-opti:latest` | 140 MB | Pipeline optimisation |
| `postgis/postgis:17-3.4` | 857 MB | Base PostgreSQL + PostGIS |
| `atlas-ui:latest` | 79 MB | Frontend (rebuild 2 min, mais garder) |
| `ubuntu:22.04` | 119 MB | Base légère, utilisée pour builds ponctuels |
| `alpine:latest` | 13 MB | Base minimaliste |

**Ne jamais faire `docker volume prune`** — le volume `atlas_ml-pip-cache` contient le cache
pip des modèles ML Python. Le supprimer ne détruit pas les données, mais force un re-download
de tous les packages Python à chaque relance du pipeline infer/opti.

### 5.2 Rust / Cargo — builds offline

Voir le document [`COMPILATION_SANS_WIFI.md`](./COMPILATION_SANS_WIFI.md) §8 pour le détail
complet. Résumé :

**Dans WSL2 Ubuntu 22.04 :**
```
~/.rustup/toolchains/1.86.0-x86_64-unknown-linux-gnu/  ← compilateur Rust Linux
~/.cargo/registry/cache/                                ← crates téléchargées (offline)
~/api-geo-build/target/                                 ← cache build incrémental (OK supprimer)
```

**Sur Windows natif :**
```
C:\Users\…\.rustup\      ← toolchain MSVC (Tauri)
C:\Users\…\.cargo\registry\cache\  ← crates Windows offline
```

---

## 6. Politique de nettoyage recommandée

### Mensuel (5 min, sans admin)

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas_reclone

# 1. Lister ce qui n'est plus utilisé
docker images | grep -v "REPO\|atlas-api-geo\|atlas-qgis\|atlas-api-infer\|atlas-api-opti\|postgis\|atlas-ui\|ubuntu\|alpine"

# 2. Purger les images listées ci-dessus (adapter selon inventaire)
docker image prune -f              # images <none> (dangling)
docker builder prune -f            # cache BuildKit non référencé
docker container prune -f          # containers stoppés
```

### Trimestriel (15 min, avec admin)

```powershell
# 1. Nettoyage Docker (mensuel ci-dessus)
# 2. Compaction VHDX
# → Exécuter COMPACT_DOCKER_VHDX_ADMIN.ps1 en administrateur

# 3. Nettoyage artefacts Rust (seulement si WiFi disponible pour rebuild)
# cd services/api-geo && cargo clean           # libère 9 GB
# cd apps/atlas-pro/src-tauri && cargo clean   # libère 3 GB
```

### À ne jamais faire sans inventaire préalable

```powershell
docker system prune -a      # supprime TOUT sans discrimination
docker volume prune         # détruit les données ML pip cache
rm -rf ~/.cargo/registry    # rend le build impossible sans WiFi
wsl --unregister Ubuntu-22.04  # détruit l'environnement de build Linux
```

---

## 7. Historique des opérations

| Date | Opération | Espace libéré | Opérateur |
|------|-----------|--------------|-----------|
| 2026-06-14 | Suppression images orphelines Docker (builders, lcpi, playwright) | −19.4 GB images | Claude Code |
| 2026-06-14 | Purge cache BuildKit Docker | −16.5 GB cache | Claude Code |
| 2026-06-14 | Configuration `.wslconfig` sparseVhd=true | prévention future | Claude Code |
| 2026-06-14 | Compaction VHDX | ~30 GB attendus | **À FAIRE** (admin requis) |

---

*Document créé le 2026-06-14 — Politique de gestion disque pour Atlas Géotechnique du Togo*
*Prochaine révision recommandée : 2026-09-14 (trimestriel)*
