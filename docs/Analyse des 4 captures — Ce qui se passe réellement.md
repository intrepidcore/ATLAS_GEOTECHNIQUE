## Analyse des 4 captures — Ce qui se passe réellement

**Image 1 (MSI buil­dé — atlas-pro, carte vide)** : La version packagée ne charge pas les données. La carte est vide, 0 mailles, 0 sondages.

**Images 2 & 3 (cargo tauri dev / npm run dev — carte chargée)** : Les versions de développement fonctionnent correctement avec les données.

**Image 4 (QGIS)** : C'est le modèle d'installateur que tu vises.

---

## Hypothèses sur l'écart dev vs MSI buildé

Il y a plusieurs causes probables, du plus au moins probable :

**Hypothèse 1 — La seed DB n'est pas embarquée dans le bundle MSI**

En dev (`cargo tauri dev`), le Desktop Tauri utilise la DB Docker qui tourne sur ta machine (`localhost:5432`). Quand tu buildes le MSI, l'app embarque son propre Postgres, mais le seed dump (`atlas_desktop_seed.dump`) doit être inclus dans les ressources Tauri. Si `tauri.conf.json` ne liste pas ce fichier dans `bundle.resources`, il n'est pas copié dans le package — la DB embarquée démarre vide.

Vérifier dans `apps/atlas-pro/src-tauri/tauri.conf.json` :

```json
{
  "tauri": {
    "bundle": {
      "resources": [
        "pg/**",
        "bin/**",
        "data/db/backups/atlas_desktop_seed.dump",
        "data/db/backups/atlas_desktop_seed.dump.manifest.json"
      ]
    }
  }
}
```

**Hypothèse 2 — Le binaire api-geo sidecar est absent ou périmé**

Le sidecar `bin/api-geo-x86_64-pc-windows-msvc.exe` dans le bundle MSI peut être absent ou être une version ancienne qui ne connaît pas les nouvelles routes/migrations. En dev, Tauri utilise le binaire compilé localement. Vérifier que `scripts/fetch-api-geo-artifact.ps1` a bien été exécuté avant `cargo tauri build`.

**Hypothèse 3 — `desktop_seed_state` indique que la DB est déjà initialisée**

Si tu as lancé `cargo tauri dev` avant de builder le MSI, la table `atlas.desktop_seed_state` peut avoir un enregistrement qui indique que la seed a déjà été appliquée. Quand l'app MSI démarre avec une DB vierge, elle regarde `desktop_seed_state`, ne trouve rien (table vide dans la DB embarquée fraîche) et devrait appliquer la seed — mais si la logique d'initialisation a un bug, elle peut skip.

**Hypothèse 4 — Variable DATABASE_URL différente entre dev et release**

En dev, `DATABASE_URL` pointe vers Docker. En release, elle est construite dynamiquement par `lib.rs` vers le Postgres embarqué. Si la construction de l'URL échoue silencieusement, l'API démarre mais ne peut pas se connecter à la DB.

---

## Sur le terminal qui s'ouvre

C'est le binaire `api-geo.exe` (le sidecar) qui ouvre une fenêtre console Windows. Par défaut, les exécutables Windows compilés sans le flag `windows_subsystem = "windows"` ouvrent une console. Dans `services/api-geo/src/main.rs` ou `Cargo.toml`, il faut ajouter :

```rust
// services/api-geo/src/main.rs — première ligne
#![windows_subsystem = "windows"]
```

Ou dans `Cargo.toml` du sidecar :

```toml
[[bin]]
name = "api-geo"
path = "src/main.rs"

[package.metadata.winres]
# Pas de console
```

---

## Roadmap complète — Installateur + Desktop

### BLOC INSTALL-1 — Créer l'installateur personnalisé Tauri (comme QGIS)

Tauri supporte nativement la personnalisation de l'installateur NSIS. C'est le chemin le plus propre — tu gardes l'installateur système Windows mais tu le personnalises complètement avec ton branding.

Dans `apps/atlas-pro/src-tauri/tauri.conf.json` :

```json
{
  "tauri": {
    "bundle": {
      "windows": {
        "nsis": {
          "installMode": "perMachine",
          "languages": ["French"],
          "template": "installer/atlas-installer.nsi",
          "headerImage": "installer/assets/header.bmp",
          "sidebarImage": "installer/assets/sidebar.bmp",
          "license": "installer/LICENSE.rtf"
        },
        "wix": null
      }
    }
  }
}
```

Créer `apps/atlas-pro/src-tauri/installer/` avec :

```
installer/
├── atlas-installer.nsi    ← template NSIS personnalisé
├── assets/
│   ├── header.bmp         ← 150×57px — logo Atlas + titre
│   ├── sidebar.bmp        ← 164×314px — image latérale (carte Togo)
│   └── atlas-icon.ico
└── LICENSE.rtf
```

Le template NSIS minimal personnalisé :

```nsi
; atlas-installer.nsi — Template installateur Atlas Géotechnique
!define PRODUCT_NAME "Atlas Géotechnique"
!define PRODUCT_VERSION "1.0.1"
!define PRODUCT_PUBLISHER "Intrepid Core"
!define PRODUCT_WEB_SITE "https://intrepidcore.io"

; Splash screen personnalisé
Function .onInit
  ; Afficher logo pendant chargement
  InitPluginsDir
  File /oname=$PLUGINSDIR\splash.bmp "assets\splash.bmp"
  ; ... logique splash
FunctionEnd

; Pages personnalisées
Page custom WelcomePage
Page directory
Page instfiles
```

### BLOC INSTALL-2 — Splash screen au démarrage (comme QGIS)

Au lieu d'un terminal qui s'ouvre, afficher une fenêtre de démarrage élégante pendant que Postgres et api-geo s'initialisent.

Dans `apps/atlas-pro/src-tauri/src/lib.rs`, créer une fenêtre splash avant la fenêtre principale :

```rust
// Créer la fenêtre splash au démarrage
let splash_window = tauri::WebviewWindowBuilder::new(
    &app,
    "splash",
    tauri::WebviewUrl::App("splash.html".into()),
)
.title("Atlas Géotechnique — Démarrage")
.inner_size(480.0, 320.0)
.resizable(false)
.decorations(false)  // Sans bordure Windows
.center()
.build()?;

// Lancer l'initialisation en arrière-plan
// Envoyer des événements de progression à la splash window
// Quand terminé : fermer splash, ouvrir fenêtre principale
```

Créer `ui/src/splash.html` :

```html
<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      background: #1e1e2e;
      color: #e0e0e0;
      font-family: sans-serif;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      height: 100vh;
      margin: 0;
    }
    .logo { font-size: 24px; font-weight: bold; margin-bottom: 8px; }
    .version { color: #9ca3af; font-size: 12px; margin-bottom: 32px; }
    .progress-bar {
      width: 300px; height: 4px;
      background: #374151; border-radius: 2px; overflow: hidden;
    }
    .progress-fill {
      height: 100%; background: #9C27B0;
      transition: width 0.3s ease;
    }
    .status { margin-top: 12px; font-size: 12px; color: #6b7280; }
  </style>
</head>
<body>
  <div class="logo">🗺️ Atlas Géotechnique</div>
  <div class="version">v1.0.1 — Intrepid Core</div>
  <div class="progress-bar">
    <div class="progress-fill" id="progress" style="width: 0%"></div>
  </div>
  <div class="status" id="status">Démarrage...</div>

  <script>
    const { listen } = window.__TAURI__.event;
    
    listen('startup:progress', (event) => {
      const { percent, message } = event.payload;
      document.getElementById('progress').style.width = percent + '%';
      document.getElementById('status').textContent = message;
    });
  </script>
</body>
</html>
```

Dans `lib.rs`, émettre les événements de progression :

```rust
// Étapes de démarrage avec messages visibles
emit_startup_progress(&app, 10, "Démarrage de PostgreSQL...").await;
start_postgres(&data_dir).await?;

emit_startup_progress(&app, 40, "Vérification de la base de données...").await;
check_and_migrate_db(&pool).await?;

emit_startup_progress(&app, 70, "Démarrage de l'API...").await;
start_api_sidecar(&app).await?;

emit_startup_progress(&app, 100, "Prêt !").await;
// Fermer splash, ouvrir fenêtre principale
```

### BLOC INSTALL-3 — Supprimer le terminal api-geo

```rust
// services/api-geo/src/main.rs
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]
// Uniquement en release — en dev le terminal reste utile pour les logs
```

### BLOC DESKTOP-1 — Diagnostiquer et fixer l'écart dev vs MSI

Étapes dans l'ordre :

```powershell
# 1. Vérifier que le seed dump est dans les resources du bundle
# Dans tauri.conf.json chercher bundle.resources

# 2. Vérifier que le sidecar est à jour avant le build
.\scripts\fetch-api-geo-artifact.ps1
# Puis vérifier la date du fichier
Get-Item apps/atlas-pro/src-tauri/bin/api-geo-x86_64-pc-windows-msvc.exe | 
  Select-Object Name, LastWriteTime, Length

# 3. Installer le MSI sur une machine virtuelle ou un compte Windows séparé
# (pas sur ta machine de dev qui a Docker + les configs)
# Vérifier les logs dans :
# C:\Users\<user>\AppData\Local\IntrepidCore\Atlas\logs\

# 4. Ajouter des logs de démarrage détaillés dans lib.rs
# Pour tracer exactement où le démarrage échoue en mode release
```

### BLOC DESKTOP-2 — Pipeline observable au démarrage (vision QGIS)

Transformer le démarrage en pipeline à étapes visibles dans la splash :

```
[1/5] ████░░░░ Démarrage PostgreSQL...       (10%)
[2/5] ████████ Base de données OK            (40%)
[3/5] ██████░░ Application des migrations... (60%)
[4/5] ████████ API géotechnique démarrée     (80%)
[5/5] ████████ Atlas Géotechnique prêt !    (100%)
```

Chaque étape a : une icône (✅/⏳/❌), un message, et une durée affichée. Si une étape échoue, la splash affiche l'erreur avec un bouton "Voir les logs" et "Réessayer" — exactement comme QGIS ou AutoCAD lors de l'initialisation des plugins.

---

## Ce que je pense de tes implémentations

**Sur l'installateur personnalisé :** Tu as raison de viser le modèle QGIS. La confusion actuelle (installateur Windows standard + "installateur" applicatif dans l'UI) est source de friction pour les utilisateurs. Le chemin propre est d'utiliser NSIS personnalisé pour l'installation système, et l'installateur UI pour le provisioning métier (DB, seed, migrations). Ce sont deux choses différentes qui ne doivent pas se marcher dessus.

**Sur le terminal :** C'est un oubli classique. `windows_subsystem = "windows"` est la règle standard pour tout exécutable Windows destiné à des utilisateurs finaux. En développement tu veux voir les logs, en production jamais.

**Sur l'écart dev vs MSI :** C'est le problème de fond le plus important. Une application qui fonctionne en dev mais pas en production signifie que l'environnement de build n'est pas reproducible. Le script `verify-tauri-dev.ps1` que tu as construit vérifie l'environnement Docker, mais pas l'environnement standalone du MSI. Il te faut un script équivalent qui vérifie le bundle buildé.

---

## 💡 Bonne pratique supplémentaire

Pour le contexte togolais — une installation sur machine client sans connexion internet permanente — la splash screen de démarrage n'est pas un luxe UX, c'est une nécessité fonctionnelle. Sans elle, un utilisateur qui voit une fenêtre noire pendant 15 secondes pendant que Postgres démarre va penser que l'app est cassée et la fermer. QGIS et ArcGIS l'ont compris depuis longtemps : le démarrage lent est acceptable si l'utilisateur voit que quelque chose se passe. C'est ce que les psychologues UX appellent la "perceived performance" — ce qui compte n'est pas la durée réelle mais la durée perçue avec feedback.