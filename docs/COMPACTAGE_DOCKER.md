Voici le **guide complet officiel** pour maintenir ton environnement **Docker + WSL** propre et léger sur Windows.  
Ce document regroupe **toutes les étapes** nécessaires pour :  
1️⃣ nettoyer les images et caches Docker,  
2️⃣ compacter les fichiers VHDX de Docker (`docker_data.vhdx`) et de WSL (`ext4.vhdx`),  
3️⃣ assurer un entretien périodique sans perte de données.

---

# 🧭 GUIDE COMPLET DE NETTOYAGE — Docker + WSL (Windows)

## 📌 Objectif

Réduire drastiquement l’espace disque utilisé par Docker Desktop et Ubuntu WSL, sans casser les projets existants (ex. **Atlas Géotechnique**).

---

## 🧰 1. Identifier les fichiers concernés

|Fichier|Contenu|Localisation typique|Taille courante|
|---|---|---|---|
|`docker_data.vhdx`|Images, conteneurs et volumes Docker|`C:\Users\<user>\AppData\Local\Docker\wsl\disk\docker_data.vhdx`|20 – 60 Go|
|`ext4.vhdx`|Système de fichiers Ubuntu/WSL (home, paquets, etc.)|`C:\Users\<user>\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu22.04LTS_...\LocalState\ext4.vhdx`|5 – 40 Go|

💡 Ces deux fichiers grandissent au fil du temps (builds, compilations, caches, etc.), mais **ne se réduisent pas automatiquement**.  
Le compactage manuel permet de récupérer plusieurs dizaines de Go.

---

## 🧹 2. Nettoyage Docker (PowerShell)

Ouvre **Windows PowerShell en mode Administrateur**  
et exécute les commandes suivantes :

### A) Vérifier l’état actuel

```powershell
docker system df
docker volume ls
docker images
```

### B) Stopper les services actifs

Depuis le dossier de ton projet :

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
docker compose down
```

### C) Supprimer les caches et images inutiles

```powershell
docker builder prune -a -f
docker image prune -a -f
docker system prune -a -f --volumes
```

🔹 Ces commandes sont **sans risque** si tu n’as pas de volumes persistants (vérifie avec `docker volume ls`).

---

## 💽 3. Compacter le disque Docker (`docker_data.vhdx`)

1. **Ferme Docker Desktop** complètement (clic droit → _Quitter_).
    
2. **Arrête WSL** :
    
    ```powershell
    wsl --shutdown
    ```
    
3. **Lance DiskPart** :
    
    ```powershell
    diskpart
    ```
    
4. Dans la console `DISKPART>` :
    
    ```plaintext
    select vdisk file="C:\Users\prota\AppData\Local\Docker\wsl\disk\docker_data.vhdx"
    attach vdisk readonly
    compact vdisk
    detach vdisk
    exit
    ```
    
5. **Vérifie la nouvelle taille** :
    
    ```powershell
    Get-Item "C:\Users\prota\AppData\Local\Docker\wsl\disk\docker_data.vhdx" | Select FullName,Length
    ```
    
    ➜ Résultat attendu : environ **4 Go** (au lieu de 50 Go !).
    

---

## 🧱 4. Compacter le disque Ubuntu WSL (`ext4.vhdx`)

1. Ferme **toutes** les fenêtres Ubuntu.
    
2. Ferme **Docker Desktop**.
    
3. Arrête WSL :
    
    ```powershell
    wsl --shutdown
    ```
    
4. Lance **DiskPart** :
    
    ```powershell
    diskpart
    ```
    
5. Dans la console :
    
    ```plaintext
    select vdisk file="C:\Users\prota\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\LocalState\ext4.vhdx"
    attach vdisk readonly
    compact vdisk
    detach vdisk
    exit
    ```
    
6. Vérifie :
    
    ```powershell
    Get-Item "C:\Users\prota\AppData\Local\Packages\CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\LocalState\ext4.vhdx" | Select FullName,Length
    ```
    
    ➜ Résultat attendu : taille réduite (souvent -50 % ou plus).
    

---

## 🧾 5. Redémarrage et vérification

Relance **Docker Desktop** depuis le menu Démarrer.  
Puis redémarre ton projet si besoin :

```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
docker compose up --build
```

Les images essentielles seront retéléchargées automatiquement.

---

## 🧰 6. Entretien périodique

### 🔄 Nettoyage mensuel

```powershell
docker system prune -a -f --volumes
```

### 🧠 Nettoyage Ubuntu

Depuis une session Ubuntu :

```bash
sudo apt autoremove
sudo apt clean
sudo journalctl --vacuum-time=3d
```

### 💽 Compactage trimestriel

Reprendre les deux procédures `diskpart → compact vdisk`.

---

## ⚡ 7. Script PowerShell automatique (optionnel)

Crée le fichier `C:\Scripts\compact-docker-wsl.ps1` :

```powershell
Write-Host "🔧 Fermeture de Docker Desktop..."
Stop-Process -Name "Docker Desktop" -Force -ErrorAction SilentlyContinue

Write-Host "⛔ Arrêt de WSL..."
wsl --shutdown

$dockerVhd = "$env:LOCALAPPDATA\Docker\wsl\disk\docker_data.vhdx"
$ubuntuVhd = "$env:LOCALAPPDATA\Packages\CanonicalGroupLimited.Ubuntu22.04LTS_79rhkp1fndgsc\LocalState\ext4.vhdx"

$script = @"
select vdisk file="$dockerVhd"
attach vdisk readonly
compact vdisk
detach vdisk
select vdisk file="$ubuntuVhd"
attach vdisk readonly
compact vdisk
detach vdisk
exit
"@

$temp = "$env:TEMP\compact.txt"
$script | Set-Content $temp

Write-Host "💽 Compactage en cours..."
diskpart /s $temp

Write-Host "✅ Compactage terminé. Redémarre Docker Desktop manuellement."
```

Exécute-le avec :

```powershell
powershell -ExecutionPolicy Bypass -File C:\Scripts\compact-docker-wsl.ps1
```

---

## 🎯 Résumé rapide

|Étape|Action|Outil|Résultat attendu|
|---|---|---|---|
|1|Nettoyer Docker (images & cache)|`docker system prune`|-20 à -30 Go|
|2|Compacter `docker_data.vhdx`|DiskPart|-40 Go|
|3|Compacter `ext4.vhdx`|DiskPart|-10 à -20 Go|
|4|Relancer Docker|Docker Desktop|Environnement stable et propre|

---

Souhaites-tu que je te génère ce guide en **PDF formaté (A4, avec encadrés et commandes stylées)** pour l’ajouter à ton _Atlas Géotechnique Toolkit_ ?