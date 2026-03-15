# Secrets GitHub Actions — Signature Updater Tauri

Ce dépôt publie les releases Desktop via `.github/workflows/release.yml`.
La signature des artefacts updater (fichiers `.sig`) nécessite une clé privée Minisign (ed25519) fournie via secrets GitHub.

## Secrets requis

Configurer dans GitHub :

`Settings -> Secrets and variables -> Actions -> New repository secret`

- `TAURI_SIGNING_PRIVATE_KEY`
  - **Valeur** : contenu complet du fichier de clé privée (une chaîne base64 sur 1 ligne)
- `TAURI_SIGNING_PRIVATE_KEY_PASSWORD`
  - **Valeur** : mot de passe associé à la clé privée (peut être vide si la clé n’est pas chiffrée)

## Génération de clé (une seule fois)

Sur ta machine (Windows) :

```powershell
cargo tauri signer generate -w "C:\Users\$env:USERNAME\AppData\Local\Atlas\tauri_signing_key" -p "<ton_mot_de_passe>" -f --ci
```

- La clé publique `*.pub` doit être copiée dans `apps/atlas-pro/src-tauri/tauri.conf.json` → `plugins.updater.pubkey`.
- La clé privée **ne doit jamais être commitée**.

## Export des valeurs à mettre dans les secrets

Utiliser le script : `scripts/export-tauri-signing-secrets.ps1`.

Exemple :

```powershell
.\scripts\export-tauri-signing-secrets.ps1 -KeyPath "C:\Users\$env:USERNAME\AppData\Local\Atlas\tauri_signing_key"
```

Le script affiche :
- la valeur à copier-coller dans `TAURI_SIGNING_PRIVATE_KEY`
- la valeur `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` (si fournie)

## Vérification

Une fois les secrets configurés :

- créer un tag `vX.Y.Z`
- pousser le tag

Le workflow `Release (Tauri)` doit :
- builder l’installer Windows
- uploader les assets dans GitHub Releases
- générer la signature `.sig`

