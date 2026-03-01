Ok, parfait, on va le faire proprement et durablement 😄

Tu as déjà le lien `https://docs.atlas-geotechnique.com/`, donc l’idée c’est :

1. choisir **un framework de documentation** moderne
    
2. le **déployer** sur un hébergeur (Netlify / GitHub Pages / Cloudflare…)
    
3. brancher ça avec ton bouton “Lire la documentation”.
    

---

## 1. Quel outil choisir ?

Pour ton profil (Rust + TS, tu aimes le Markdown, et tu bosses souvent en dark mode 😅), les deux gros candidats sont :

### Option A – **MkDocs + Material for MkDocs** (mon conseil pour toi)

- Tu écris tout en **Markdown**.
    
- Look très propre, “doc de pro”, sans trop de configuration. ([PyPI](https://pypi.org/project/mkdocs-material/?utm_source=chatgpt.com "mkdocs-material"))
    
- Recherche intégrée, dark mode, versioning possible.
    
- Stack Python → ça colle bien à ce que tu utilises déjà pour l’ETL.
    

### Option B – **Docusaurus** (si tu veux un site plus “marketing + blog”)

- Framework React/Node, sur lequel tu peux faire à la fois doc + blog + landing. ([GitHub](https://github.com/facebook/docusaurus?utm_source=chatgpt.com "facebook/docusaurus: Easy to maintain open source ..."))
    
- Plus lourd, plus puissant, mais un peu plus de configuration.
    

👉 **Pour Atlas Géotechnique**, je te recommande clairement : **MkDocs + Material**  
C’est ultra utilisé pour des docs d’API / de produits techniques.

---

## 2. Architecture que je te propose

On part sur un dépôt dédié **`atlas-docs`** (sur GitHub ou GitLab) :

```text
atlas-docs/
  mkdocs.yml              # config principale
  docs/
    index.md              # page d’accueil
    demarrage/
      installation.md
      connexion.md
    utilisateur/
      atlas_carte.md
      atlas_sondages.md
      atlas_export.md
    admin/
      config_env.md
      docker_deploy.md
    reference/
      api_geo.md
      schema_bdd.md
```

Plus tard, on pourra ajouter :

- `overrides/` pour customiser le thème
    
- `assets/` pour screenshots, logos, etc.
    

---

## 3. Étapes d’installation (comme un débutant, pas à pas)

### 3.1. Prérequis

Sur ta machine (Windows) tu dois avoir :

- **Python 3.10+** installé
    
- `pip` disponible dans le terminal
    
- `git` installé
    

### 3.2. Créer le projet de doc

Dans PowerShell :

```bash
# 1. Créer un nouveau dossier
mkdir C:\PROJET_ATLAS_MASTER\atlas-docs
cd C:\PROJET_ATLAS_MASTER\atlas-docs

# 2. Créer un environnement virtuel Python (propre)
python -m venv .venv

# 3. Activer l’environnement
.\.venv\Scripts\Activate.ps1

# 4. Installer MkDocs + Material
pip install mkdocs-material
```

Puis :

```bash
# 5. Initialiser un projet mkdocs de base
mkdocs new .
```

Ça va créer `mkdocs.yml` + `docs/index.md`.

### 3.3. Tester en local

Toujours dans l’environnement virtuel :

```bash
mkdocs serve
```

Tu ouvres le lien indiqué (souvent `http://127.0.0.1:8000`) → tu verras ta doc basique.

---

## 4. Configurer Material pour MkDocs

Dans `mkdocs.yml`, remplace le contenu par quelque chose comme :

```yaml
site_name: Atlas Géotechnique – Documentation
site_url: https://docs.atlas-geotechnique.com/

theme:
  name: material
  language: fr
  features:
    - navigation.sections
    - navigation.expand
    - search.highlight
    - search.suggest
    - content.code.copy
    - toc.integrate
  palette:
    - scheme: default
      primary: blue
      accent: indigo
    - scheme: slate
      primary: blue
      accent: indigo
      toggle:
        icon: material/weather-night
        name: Mode sombre

nav:
  - Accueil: index.md
  - Prise en main:
      - Installation: demarrage/installation.md
      - Connexion: demarrage/connexion.md
  - Guide utilisateur:
      - Carte & filtres: utilisateur/atlas_carte.md
      - Sondages: utilisateur/atlas_sondages.md
      - Exports Atlas & Pro: utilisateur/atlas_export.md
  - Administration:
      - Configuration Docker: admin/docker_deploy.md
      - Variables d’environnement: admin/config_env.md
  - Référence:
      - API Geo: reference/api_geo.md
      - Schéma BDD: reference/schema_bdd.md
```

Et tu crées les fichiers Markdown correspondants dans `docs/`.

---

## 5. Déploiement sur `https://docs.atlas-geotechnique.com/`

Là tu as deux options simples :

### Option 1 – **GitHub Pages + Cloudflare** (simple & gratuit)

1. Tu pousses `atlas-docs` sur GitHub.
    
2. Tu actives **GitHub Pages** sur la branche `gh-pages`.
    
3. Tu pointes ton domaine `docs.atlas-geotechnique.com` vers GitHub Pages (via DNS, souvent via Cloudflare ou ton registrar).
    
4. Dans ton dépôt, tu ajoutes une action GitHub :
    

```yaml
# .github/workflows/deploy-docs.yml
name: Deploy Docs

on:
  push:
    branches: [ main ]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-python@v5
        with:
          python-version: '3.x'
      - run: pip install mkdocs-material
      - run: mkdocs gh-deploy --force
```

À chaque push sur `main` → la doc est rebuild + publiée.

### Option 2 – **Netlify**

1. Tu connectes le dépôt `atlas-docs` à Netlify.
    
2. Build command : `mkdocs build`
    
3. Publish directory : `site`
    
4. Tu configures le domaine custom `docs.atlas-geotechnique.com` dans Netlify.
    

---

## 6. Intégration avec Atlas (bouton “Lire la documentation”)

Une fois le site en ligne :

- ton menu utilisateur a déjà le lien → il suffit juste de vérifier que l’URL est bien `https://docs.atlas-geotechnique.com/`
    
- tu peux aussi ajouter quelques **liens contextuels** dans l’UI :
    
    - icône `?` près d’“Export Atlas complet” qui pointe vers `.../utilisateur/atlas_export/`
        
    - icône `?` près de la carte thématique qui pointe vers la page “Carte & filtres”.
        

---

## 7. Et la vidéo “faire la doc comme un pro” ?

La plupart de ces vidéos utilisent justement :

- **MkDocs + Material**
    
- ou **Docusaurus**
    

et montrent comment avoir :

- recherche en plein texte,
    
- versioning (v2.4.0, v2.5.0 d’Atlas),
    
- dark mode,
    
- blocs “info / warning” en Markdown (`!!! info`, `!!! warning`).
    

Avec MkDocs Material tu as tout ça nativement.

---

Si tu veux, au prochain message je peux :

- te proposer **un squelette complet de sommaire** adapté à Atlas (toutes les pages utiles),
    
- et un exemple complet de page “Export Atlas complet” déjà rédigée en Markdown, que tu peux juste coller dans `docs/utilisateur/atlas_export.md`.