# 🗺️ Atlas Géotechnique

![Version](https://img.shields.io/badge/version-1.0.2-blue.svg)
![License](https://img.shields.io/badge/license-MIT-green.svg)
![Rust](https://img.shields.io/badge/Rust-1.80-orange.svg)
![React](https://img.shields.io/badge/React-18-blue.svg)

**Atlas Géotechnique** est une plateforme complète et intégrée d'intelligence géospatiale, dédiée à la collecte structurée, la validation et l'exploitation des données de sols.

Conçu pour remplacer les archives papier sporadiques, l'Atlas unifie les essais laboratoires et les forages in-situ dans une base de données PostGIS centralisée de haute précision, complétée d'un écosystème d'applications interactives.

---

## 🌟 L'Écosystème Atlas

L'Atlas n'est pas qu'une simple base de données ; c'est une suite d'applications spécialisées :

1. **`api-geo` (Le Noyau)** : Une API RESTful ultra-performante codée en Rust (Axum), gérant le requêtage spatial, la validation de données et les calculs d'interpolation (IDW) à la volée.
2. **`atlas-pro` (Desktop MSI)** : Une application native (Tauri v2) pour les professionnels de l'ingénierie. Embarque son propre runtime PostgreSQL/PostGIS pour un mode *Offline First* sans concession sur la puissance d'analyse.
3. **`Colab Mobile` (PWA)** : Application terrain pour les techniciens de chantier. Permet la saisie géolocalisée immédiate, la remontée de logs de sols et un cache local intelligent via ServiceWorkers.
4. **`Colab Studio` (Backoffice)** : Portail web RBAC (Role-Based Access Control) pour l'approbation asynchrone des données (Staging -> Production) et l'administration institutionnelle.

---

## 🛠 Architecture & Stack Technique

L'Atlas repose sur une architecture moderne de type Monorepo :

- **Backend (API)** : Rust, Axum, SQLx, Tokio.
- **Base de données** : PostgreSQL 15+, PostGIS 3.4+.
- **Frontend (Web/Mobile)** : React 18, Vite, Tailwind CSS, Leaflet, Turf.js.
- **Desktop** : Tauri 2.0.
- **Data Engineering (ETL)** : Python, Pandas, GeoPandas, SQLAlchemy.

## 📊 Interpolation et Rendu Maillé

Les zones sans forage connu bénéficient d'un modèle d'interpolation **IDW (Inverse Distance Weighting)** qui génère une prédiction continue des indices clés du sol (VBS, Indice de Plasticité, Limites d'Atterberg, Gonflement) projetée sur une grille hexagonale ou carrée (2×2 km).

Pour plus de détails : [Consulter le document Sources & Méthodologie](./docs/public/SOURCES_METHODOLOGIE.md)

---

## 🚀 Démarrage Rapide (Développement)

Si vous souhaitez contribuer ou compiler l'Atlas localement depuis les sources :

### Prérequis
- `Node.js` v20+
- `Rust` stable
- `Docker` et `Docker Compose`

### Installation

1. **Cloner le projet**
   ```bash
   git clone https://github.com/intrepidcore/atlas-geotechnique.git
   cd atlas-geotechnique
   ```

2. **Démarrer la base de données (PostGIS)**
   ```bash
   docker-compose up -d db
   ```

3. **Restaurer la base de données fictive (Seed locale)**
   Si vous disposez d'un seed dump, restaurez-le, ou utilisez la commande ETL pour générer un jeu de test :
   ```bash
   # Depuis la racine, exécuter l'ETL (nécessite Python)
   cd etl
   pip install -r requirements.txt
   python cli.py load-sample-extended
   ```

4. **Lancer l'API**
   ```bash
   cd services/api-geo
   cp .env.example .env # Puis ajuster la variable DATABASE_URL si besoin
   cargo run
   ```

5. **Lancer le Frontend Web**
   ```bash
   cd ui
   npm install
   npm run dev
   ```
   Rendez-vous sur [http://localhost:1420](http://localhost:1420)

---

## 📦 Télécharger l'Application Locale (Atlas Pro)

Pour les ingénieurs pratiquants et les BET (Bureaux d'Études Techniques), l'application Desktop **Atlas Pro** est la méthode recommandée pour une exploitation performante et hors-ligne.

- [📥 Télécharger Atlas Pro v1.0.2 (MSI Windows 10/11)](https://github.com/intrepidcore/atlas-geotechnique/releases/latest)

> L'installateur pèse environ `70 Mo` (inclut l'environnement PostgreSQL local + seed database compressé).

---

## 📄 Licence
Propriété de IntrepidCore. Développé pour la modernisation de la géotechnique. Code en double licence (MIT Core / Private Apps).
