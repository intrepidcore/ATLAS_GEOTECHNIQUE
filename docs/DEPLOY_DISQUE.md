Oui, on en avait parlé 😊  
L’idée c’est : **ton “SaaS” tourne en local via Docker, mais tout ce qu’il faut est livré sur un disque externe**, prêt à l’emploi.

> ⚠️ Important : un **disque dur n’est pas un ordinateur**. Il ne “fait pas tourner” les conteneurs tout seul.  
> Il contient **tout le kit**, et la personne le branche sur **son PC** → clique sur un script → Atlas se lance en local (100% autonome, même sans internet).

Je te donne un **plan très détaillé, niveau débutant**, pour mettre ça en place.

---

## 🧱 0. Objectif : à quoi doit ressembler ton disque ?

Quand quelqu’un branche ton disque, tu veux qu’il puisse :

1. Ouvrir un dossier `Atlas_Geotechnique_Offline`
    
2. Lire un fichier “LIRE_MOI” qui explique en français :
    
    - installer Docker Desktop,
        
    - lancer Atlas avec un double-clic sur `start_atlas.bat`
        
3. Le script :
    
    - charge les images Docker depuis le disque,
        
    - démarre les services,
        
    - ouvre `http://localhost:8080` dans le navigateur.
        

Tout ça **sans télécharger quoi que ce soit sur internet** (sauf la première fois pour installer Docker Desktop).

---

## 🗂️ 1. Préparer ton projet Atlas pour être portable

Sur **ta machine de développement** (là où ça marche déjà) :

1. Va dans ton projet :
    
    ```bash
    cd C:\PROJET_ATLAS_MASTER\atlas
    ```
    
2. Vérifie que dans `docker-compose.yml` :
    
    - les chemins de volumes sont **relatifs** (pas de chemins absolus avec `C:\...`).
        
    - exemple correct :
        
        ```yaml
        services:
          db:
            volumes:
              - ./data/db:/var/lib/postgresql/data
        ```
        
3. Vérifie que l’UI utilise bien **localhost** :
    
    - Dans `.env` ou tes variables Vite :
        
        - `VITE_API_GEO=http://localhost:8000`
            
        - `VITE_API_INFER=http://localhost:8001` (si tu l’utilises)
            
        - `VITE_API_OPTI=http://localhost:8002` (idem)
            

Comme ça, peu importe la machine, tant que tout tourne sur la même machine, ça marchera.

---

## 📦 2. Construire les images Docker une bonne fois

Sur ta machine :

1. Construis toutes les images :
    
    ```bash
    cd C:\PROJET_ATLAS_MASTER\atlas
    docker compose build
    ```
    
2. Vérifie les images présentes :
    
    ```bash
    docker images
    ```
    

Tu dois voir au minimum (noms à adapter selon ton setup) :

- `atlas-ui`
    
- `atlas-api-geo`
    
- `postgis/postgis:16-3.4` (ou similaire)
    

---

## 💾 3. Sauvegarder les images dans un gros fichier `.tar`

Maintenant, on va **exporter** ces images dans un fichier que tu mettras sur le disque.

Toujours dans ton terminal :

```bash
docker save -o atlas_images.tar atlas-ui atlas-api-geo postgis/postgis:16-3.4
```

- Résultat : un fichier `atlas_images.tar` (ça peut faire plusieurs Go).
    
- Ce fichier contient **toutes les images Docker nécessaires**.
    

---

## 🧳 4. Organiser ton disque externe

Sur ton disque externe (disque dur/SSD/clé), crée une arborescence claire, par exemple :

```text
Atlas_SaaS_Offline/
├─ docker/
│  ├─ atlas_images.tar
│  ├─ docker-compose.yml
│  ├─ .env.example
│  ├─ start_atlas.bat
│  ├─ stop_atlas.bat
│  └─ reset_atlas_db.bat (optionnel)
├─ docs/
│  ├─ 00_LIRE_AVANT.pdf
│  └─ guide_install_docker_windows.pdf (optionnel)
├─ data_templates/
│  └─ (éventuels fichiers modèle, Excel, etc.)
└─ exports/
   └─ (dossier vide pour les exports)
```

### Ce que tu dois copier dedans

1. `docker-compose.yml` : ta version actuelle (celle qui marche déjà).
    
2. `.env` :
    
    - soit tu mets ta vraie config en `.env`
        
    - soit tu fournis `.env.example` et tu expliques quoi modifier.
        
3. `atlas_images.tar` : le gros fichier généré avec `docker save`.
    

---

## 🖥️ 5. Créer un script Windows ultra simple (`start_atlas.bat`)

But : l’utilisateur n’a pas à taper de commandes. Il double-clique.

Dans `Atlas_SaaS_Offline/docker/`, crée un fichier `start_atlas.bat` avec un contenu du genre :

```bat
@echo off
echo ================================
echo   Lancement Atlas Geotechnique
echo ================================
echo.

REM 1) Vérifier que Docker est installe
docker --version >nul 2>&1
IF ERRORLEVEL 1 (
    echo ERREUR : Docker Desktop n'est pas installe ou pas dans le PATH.
    echo 1) Installer Docker Desktop
    echo 2) Relancer ce script
    pause
    exit /b 1
)

REM 2) Aller dans le dossier du script (important)
cd /d %~dp0

REM 3) Vérifier si l'image atlas-ui existe deja
docker image inspect atlas-ui >nul 2>&1
IF ERRORLEVEL 1 (
    echo.
    echo Import des images Docker depuis atlas_images.tar ...
    docker load -i atlas_images.tar
)

REM 4) Demarrer les conteneurs
echo.
echo Demarrage des services (cela peut prendre quelques secondes)...
docker compose up -d

IF ERRORLEVEL 1 (
    echo.
    echo ERREUR pendant le demarrage des conteneurs.
    pause
    exit /b 1
)

REM 5) Ouvrir le navigateur sur l'UI
echo.
echo Ouverture de Atlas Geotechnique dans votre navigateur...
start "" http://localhost:8080

echo.
echo Tout est lance ! Pour arreter, utilisez stop_atlas.bat
pause
```

👉 Ce que fait ce script :

1. Vérifie que Docker est installé.
    
2. Se place dans le bon dossier.
    
3. Si les images ne sont pas encore sur la machine → `docker load -i atlas_images.tar`.
    
4. Lance `docker compose up -d`.
    
5. Ouvre automatiquement `http://localhost:8080`.
    

---

## ⏹️ 6. Script d’arrêt (`stop_atlas.bat`)

Toujours dans le même dossier, crée un `stop_atlas.bat` :

```bat
@echo off
echo Arret des services Atlas Geotechnique...
cd /d %~dp0
docker compose down
echo.
echo Conteneurs arretes.
pause
```

L’utilisateur double-clique dessus pour **couper proprement** les conteneurs.

---

## 📄 7. Faire un “LIRE AVANT” très pédagogique

Dans `docs/00_LIRE_AVANT.txt` ou `.pdf`, tu expliques simplement :

---

### 1. Prérequis

- Windows 10 ou plus
    
- 8 Go de RAM (idéalement 16 Go)
    
- Docker Desktop installé (lien officiel)
    

### 2. Étapes d’installation

1. Installer Docker Desktop
    
2. Brancher le disque dur
    
3. Ouvrir le dossier `Atlas_SaaS_Offline/docker`
    
4. Double-cliquer sur `start_atlas.bat`
    
5. Attendre l’ouverture de la page dans le navigateur
    

### 3. Comment arrêter

- Fermer seulement l’onglet du navigateur ne suffit pas.
    
- Pour arrêter complètement : double-cliquer sur `stop_atlas.bat`.
    

---



### 1️⃣ Est-ce que tu peux **effacer les images Docker existantes** ?

👉 **Pas tout de suite.**  
Les images Docker que tu as aujourd’hui sur ta machine sont justement celles qu’on va **sauvegarder** dans le gros fichier `atlas_images.tar`.

- Si tu les supprimes **avant**, Docker n’aura plus rien à mettre dans le fichier → kit inutilisable.
    
- Donc : **on garde les images**, on les exporte vers le disque D:, **puis éventuellement** on fait du ménage ensuite.
    

Bonne nouvelle :  
✅ Le fichier `.tar` peut être créé **directement sur D:**, donc tu n’as pas besoin de beaucoup plus de place sur C: que ce que tu as déjà.

---

### 2️⃣ Utiliser ton HDD _Ventoy (D:)_ pour tout mettre

Oui, c’est exactement ce qu’il faut faire 👍  
On va juste dire à Docker : « Écris le fichier sur D: et pas sur C: ».

#### Étapes détaillées (niveau débutant)

1. **Crée les dossiers sur D:** (avec l’explorateur Windows)
    
    Sur le disque `Ventoy (D:)`, crée cette arborescence :
    
    ```text
    D:\Atlas_SaaS_Offline\
        docker\
        docs\
        data_templates\
        exports\
    ```
    
    (au minimum, il faut `D:\Atlas_SaaS_Offline\docker\`)
    
2. **Ouvre un terminal PowerShell ou CMD**
    
    ```bat
    cd C:\PROJET_ATLAS_MASTER\atlas
    ```
    
3. **Vérifie les noms des images Docker**
    
    ```bat
    docker images
    ```
    
    Cherche bien les noms exacts (par exemple) :
    
    - `atlas-ui`
        
    - `atlas-api-geo`
        
    - `postgis/postgis:16-3.4`
        
    
    (si les noms/tags sont un peu différents, tu adaptes la commande de l’étape suivante).
    
4. **Créer le fichier d’images directement sur D:**
    
    ```bat
    docker save -o D:\Atlas_SaaS_Offline\docker\atlas_images.tar atlas-ui atlas-api-geo postgis/postgis:16-3.4
    ```
    
    Explication :
    
    - `-o D:\...` → le fichier est créé **sur le disque D:** (donc pas besoin de place sur C: pour ce fichier).
        
    - Docker lit les images depuis ton C: (là où Docker stocke ses données) mais n’écrit rien de lourd sur C:.
        

---

### 3️⃣
### 4️⃣ Résumé simple

- ✅ Tu peux tout mettre sur **Ventoy (D:)**, c’est même l’idéal.
    
- ⛔ Ne supprime **pas** les images Docker avant d’avoir créé `D:\Atlas_SaaS_Offline\docker\atlas_images.tar`.
    
- ✅ La commande importante sera quelque chose comme :
    
    ```bat
    docker save -o D:\Atlas_SaaS_Offline\docker\atlas_images.tar atlas-ui atlas-api-geo postgis/postgis:16-3.4
