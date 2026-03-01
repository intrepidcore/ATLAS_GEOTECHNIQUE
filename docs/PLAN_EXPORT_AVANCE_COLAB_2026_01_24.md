# 🧭 Plan d’Export Avancé – Colab Studio
**Date : 2026-01-24**  
**Auteur : Cascade (Assistant IA)**  
**Statut : Approuvé pour implémentation complète (3 phases)**  

---

## 🎯 Vision Produit

Mettre en place un **système d’export robuste, extensible et traçable**, capable de :

- Transformer les données Colab en **livrables exploitables** (reporting, audit, supervision).
- Supporter des **volumes réels** et des **cas métier complexes**.
- Évoluer d’un **export manuel simple** vers une **chaîne automatisée et sécurisée**.

> L’export n’est pas un bouton : c’est un **pipeline de transformation de données**.

---

## 🎯 Objectifs Fonctionnels (Clarifiés)

1. **Exporter** toutes les données structurantes :
   - missions, étudiants, superviseurs
   - documents associés
   - logs et historiques
2. **Filtrer finement** (temps, statut, géographie, acteurs).
3. **Composer des exports croisés** (jointures métier).
4. **Générer plusieurs formats** selon l’usage (tableur, reporting, SIG).
5. **Tracer et sécuriser** chaque export (audit, permissions).
6. **Préparer l’automatisation**, sans la forcer dès le MVP.

---

## 🧩 Fonctionnalités — Version Consolidée

### 1️⃣ Interface d’Export (UI)

#### 📍 Point d’entrée
- Onglet global **“Exports”** dans Colab Studio.
- Accessible selon permissions.

#### 🧭 Wizard structuré (4 étapes)

**Étape 1 – Source**
- Missions
- Étudiants
- Superviseurs
- Documents
- Logs
- Exports croisés (avancé)

**Étape 2 – Filtres**
- Temporel : période, création, mise à jour
- Métier : statut, thème, type de mission
- Acteurs : étudiant, superviseur
- Géographique : région, commune, maille

**Étape 3 – Format & Template**
- Format cible
- Sélection du template
- Prévisualisation (optionnelle)

**Étape 4 – Destination**
- Téléchargement direct (MVP)
- (Phase 3) Email / stockage / planification

---

### 2️⃣ Formats & Templates (Hiérarchisés)

#### Formats supportés
| Format  | Usage                     |
| ------- | ------------------------- |
| CSV     | Traitement rapide / Excel |
| XLSX    | Reporting structuré       |
| JSON    | Interop / API             |
| PDF     | Rapport officiel          |
| GeoJSON | Analyse SIG               |

#### Templates
- Séparation stricte :
  - **données** (requêtes SQL)
  - **présentation** (template)
- Templates :
  - stockés en BDD **ou**
  - versionnés côté backend
- Moteur : Handlebars / Mustache

---

### 3️⃣ Filtres & Agrégations (Normalisés)

#### Filtres
- `date_range`
- `status[]`
- `theme[]`
- `region_id | commune_id | maille_id`
- `student_id | supervisor_id`

#### Agrégations
- Comptages (missions / documents)
- Groupements (par statut, par zone)
- Statistiques simples (min/max/avg si pertinent)

> Les agrégations sont côté backend, jamais en UI.

---

### 4️⃣ Exports Croisés (Valeur Métier Forte)

Exports pré-définis :
- Missions × Étudiants × Superviseurs
- Missions × Documents
- Étudiants × Missions assignées
- Logs × Missions (audit)

> Chaque export croisé = **une vue métier stable**, pas une requête bricolée.

---

### 5️⃣ Automatisation & Programmation (Phase 3)

- Planification via UI (CRON abstrait)
- Fréquences standards :
  - quotidien / hebdomadaire / mensuel
- Destinations :
  - Email
  - S3 / MinIO
- Webhook post-export (optionnel)

⚠️ Pas dans le MVP → **préparé dès la conception**

---

### 6️⃣ Sécurité, Permissions & Audit

#### Permissions
- `colab.export.read`
- `colab.export.create`
- `colab.export.schedule`
- (option) `colab.export.admin`

#### Audit & Logs
- Qui
- Quoi
- Quand
- Avec quels filtres
- Format généré
- Statut (succès / échec)

> Obligatoire dès le MVP

---

### 7️⃣ Performance & Scalabilité

- Exports **asynchrones**
- Jobs persistés en BDD
- Chunking automatique (>10k lignes)
- Pas de blocage API
- Suivi :
  - polling simple (MVP)
  - SSE / WebSocket (plus tard)

---

## 🏗️ Architecture Technique (Durcie)

### Backend (Rust / Axum)

#### Module
```
api-colab/src/export/
├── mod.rs
├── routes.rs
├── service.rs
├── jobs.rs
├── formats/
├── templates/
```

#### Routes clés
- `POST /colab/export` – lancer un export
- `GET /colab/export/jobs/:id` – état du job
- `GET /colab/export/download/:id` – téléchargement
- `GET /colab/export/history` – historique
- `POST /colab/export/schedule` – programmer un export récurrent

#### Tables
- `colab_export_jobs` – jobs async (id, source, filtres, format, statut, created_at, started_at, finished_at, file_path, error)
- `colab_export_logs` – audit (qui, quand, quoi, filtres, format, statut)
- `colab_export_templates` – templates (id, nom, source, format, template_sql, template_handlebars, created_by, created_at)

---

### Frontend (React / TS)

- `ExportPage` – page principale avec wizard
- `ExportWizard` – composant wizard (4 étapes)
- `FilterPanel` – panneau de filtres
- `TemplateSelector` – sélecteur de templates
- `JobStatusPanel` – suivi des jobs

State :
- react-query (jobs)
- react-hook-form (wizard)

---

## 📦 Phasage Réaliste

### 🔹 Phase 1 — MVP (fondation) – 4–5 jours
- Wizard simple (source → filtres → format → téléchargement)
- CSV / JSON / XLSX
- Export async
- Logs & permissions
- Download direct

> Indispensable, rien de plus

### 🔹 Phase 2 — Métier – 3–4 jours
- Exports croisés
- Templates
- PDF
- Historique consultable

### 🔹 Phase 3 — Automatisation – 2–3 jours
- CRON UI
- Email
- S3 / MinIO
- Webhooks

---

## ⚠️ Points de Vigilance (Très Important)

- ❌ Ne jamais générer l’export côté frontend
- ❌ Ne jamais reconstruire la logique métier en JS
- ✅ Le backend est la **seule source de vérité**
- ✅ Chaque export est un **artefact traçable**

---

## 🛠️ Outils & Libs Suggérées

### Rust
- `tokio` + `sqlx` pour jobs async
- `csv` / `serde_json` pour génération
- `xlsxwriter` (via `rust_xlsxwriter`)
- `handlebars` pour templates
- `lettre` pour email
- `aws-sdk-s3` si S3/MinIO
- `chrono` pour timestamps
- `uuid` pour IDs de jobs

### Frontend
- `react-pdf` pour aperçu PDF ?
- `react-hook-form` pour wizard
- `date-fns` pour périodes
- `@tanstack/react-query` pour état des jobs
- `lucide-react` pour icônes

---

## 🎯 Prochaine Étape Conseillée

Avant de coder :
1. Lister **les 5 exports réellement utiles**
2. Identifier **le volume max réaliste**
3. Valider **les formats prioritaires**

---

## 📋 Checklist d’Implémentation (par phase)

### Phase 1 – MVP
- [ ] Backend : module `export` + routes + tables
- [ ] Backend : service async + jobs
- [ ] Backend : formats CSV, JSON, XLSX
- [ ] Frontend : page Export + wizard 4 étapes
- [ ] Frontend : état jobs (polling)
- [ ] Permissions `colab.export.read` / `colab.export.create`
- [ ] Logs dans `colab_export_logs`
- [ ] Tests manuels : wizard → job → download

### Phase 2 – Métier
- [ ] Backend : exports croisés (vues SQL)
- [ ] Backend : templates (BDD + Handlebars)
- [ ] Backend : PDF (via `lopdf` ou similar)
- [ ] Frontend : sélecteur templates
- [ ] Frontend : historique exports
- [ ] Tests manuels : exports croisés + PDF

### Phase 3 – Automatisation
- [ ] Backend : CRON (tables + job scheduler)
- [ ] Backend : email (`lettre`)
- [ ] Backend : S3/MinIO (`aws-sdk-s3`)
- [ ] Frontend : UI planification
- [ ] Frontend : configuration destinations
- [ ] Tests manuels : CRON + email + S3

---

## 📄 Références & Règles Applicables

- `@[atlas/docs/REGLE_BONNE_PRATIQUE_MEMOIRE.MD]` : règles globales du projet
- `[API-01]` Endpoints documentés et testables
- `[API-02]` Paramètres explicites
- `[API-03]` Erreurs structurées
- `[API-04]` Réutiliser les vues
- `[DB-10]` Inspecter avant migration
- `[DB-11]` Migration = script autonome et idempotent
- `[DB-12]` Ne pas casser les tables cœur
- `[DB-20]` Index pour filtres fréquents
- `[DB-21]` Tester agrégations clés
- `[SEC-01]` Validation paramètres API
- `[SEC-02]` Injection SQL impossible
- `[SEC-03]` Limites de résultats
- `[PERF-01]` Chargement paresseux
- `[PERF-02]` Agrégations côté backend
- `[PERF-03]` Debounce sur recherche/filtres
- `[UX-04]` Feedback visuel immédiat

---

**Approuvé pour implémentation complète – 3 phases.**  
Commencer Phase 1 immédiatement.
