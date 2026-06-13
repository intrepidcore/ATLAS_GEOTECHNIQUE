# Compilation offline — api-geo (sans réseau)

**Projet :** `services/api-geo`  
**Rust :** 1.94.0 | **Cargo :** 1.94.0  
**OS :** Windows 11, PowerShell

> **Contexte projet :** Voir aussi [`AUDIT_COLAB_STUDIO_2026-06-11.md`](audit/AUDIT_COLAB_STUDIO_2026-06-11.md) — audit complet DB/backend/frontend avec corrections appliquées (fixes Colab Studio, health check).

---

## Prérequis (vérifier avant build)

```powershell
rustc --version   # doit afficher 1.x.x
cargo --version
```

**Fichiers critiques à avoir localement :**

| Chemin | Rôle | Taille |
|--------|------|--------|
| `~/.cargo/registry/cache/` | Archives `.crate` — source des dépendances | ~73 MB |
| `~/.cargo/registry/index/` | Index versions crates.io | ~58 MB |
| `services/api-geo/.sqlx/` | Queries SQLx pré-compilées (10 fichiers) | ~7 KB |
| `services/api-geo/Cargo.lock` | Versions exactes verrouillées | ~111 KB |

> **Ne jamais supprimer** `registry/cache/` et `registry/index/` — sans eux, build offline impossible.

---

## Build debug (rapide, pour développement)

```powershell
Set-Location "C:\PROJET_ATLAS_MASTER\atlas_reclone\services\api-geo"

$env:SQLX_OFFLINE = "true"
$env:DATABASE_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"

cargo build --offline
```

- Durée : ~3 min 44 s (première fois) / ~30 s (incrémental)
- Binaire : `target/debug/api-geo.exe` (~44 MB)
- Espace requis : ~4 GB pour `target/`

---

## Build release (production)

```powershell
Set-Location "C:\PROJET_ATLAS_MASTER\atlas_reclone\services\api-geo"

$env:SQLX_OFFLINE = "true"
$env:DATABASE_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"

cargo build --release --offline
```

- Binaire : `target/release/api-geo.exe` (~15 MB optimisé)
- Espace requis : ~6-7 GB (debug + release)

---

## Nettoyage espace disque (ordre recommandé)

Quand espace < 3 GB libres :

```powershell
# 1. Sources extraites (~420 MB) — cargo les re-extrait depuis cache automatiquement
Remove-Item "$env:USERPROFILE\.cargo\registry\src" -Recurse -Force

# 2. Tout le target/ du projet (~4 GB) — reconstruit avec cargo build
Remove-Item "C:\PROJET_ATLAS_MASTER\atlas_reclone\services\api-geo\target" -Recurse -Force

# 3. Après build : supprimer incremental/ seul (~1 GB) sans perdre les .rlib compilés
Remove-Item "C:\PROJET_ATLAS_MASTER\atlas_reclone\services\api-geo\target\debug\incremental" -Recurse -Force
```

**Ne jamais supprimer :**
- `~/.cargo/registry/cache/` (archives .crate)
- `~/.cargo/registry/index/` (index)
- `~/.cargo/bin/` (outils installés : cargo-sqlx, etc.)
- `services/api-geo/.sqlx/` (queries pré-compilées)
- `services/api-geo/Cargo.lock`

---

## Pourquoi SQLX_OFFLINE=true ?

SQLx utilise deux modes :
- **Online** (défaut) : compile en vérifiant les queries SQL contre la DB → nécessite DB live
- **Offline** : utilise fichiers `.sqlx/*.json` pré-générés → aucune connexion DB requise

Le projet a 6 macros `query!` (nécessitent `.sqlx/`) + 454 appels `sqlx::query()` non-macro (runtime only, aucun fichier `.sqlx` requis).

Si `.sqlx/` incomplet → erreur compile. Régénérer avec DB connectée :
```powershell
# Avec DB disponible seulement
$env:DATABASE_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
cargo sqlx prepare -- --lib
# Commit les fichiers .sqlx/ générés
```

---

## Variables d'environnement

| Variable | Valeur | Obligatoire offline |
|----------|--------|-------------------|
| `SQLX_OFFLINE` | `true` | ✅ |
| `DATABASE_URL` | `postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean` | Facultatif si SQLX_OFFLINE=true |

---

## Dépannage

| Erreur | Cause | Fix |
|--------|-------|-----|
| `error: no such file: registry/src/...` | registry/src absent | Normal — cargo re-extrait auto depuis cache |
| `error: failed to fetch ...` | --offline mais crate absent du cache | La crate n'a jamais été téléchargée → connexion réseau nécessaire une fois |
| `error: failed to find data for query` | SQLX_OFFLINE=true mais hash absent dans .sqlx/ | Régénérer `.sqlx/` avec DB connectée |
| `error: unknown host` | DATABASE_URL mal formée | Vérifier port 5433 (pas 5432) |

---

*Généré 2026-06-11 — Atlas Géotechnique Togo*
