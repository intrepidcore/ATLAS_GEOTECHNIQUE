# Roadmap – Moteur d’Export Hybride (Atlas Engine)

> **Phrase fondatrice** : *Atlas Engine HQ est un moteur de rendu déterministe, piloté par l’API Atlas, produisant des sorties cartographiques reproductibles.*

## 1. But & périmètre

**But** : ajouter un mode d’export “Haute Qualité (serveur)” capable de produire des **PDF vectoriels** (et/ou des PNG haute définition) de manière reproductible, sans dépendre du navigateur.

**Périmètre fonctionnel minimal (MVP)** :
- Export d’une carte thématique sur une zone (ADM / bbox / maille 28km).
- Sortie :
  - **PDF vectoriel** (prioritaire)
  - + option PNG 300 DPI (si besoin impression raster).
- Exécution **asynchrone** (job queue) avec suivi de statut.

**Hors périmètre MVP** :
- Refaire tout l’export Atlas complet en backend dès le début.
- Reproduire 100% des overlays UI (voisins, stats détaillées, etc.) dès V1.

## 2. Faisabilité (validation rapide)

Le plan est **faisable** dans ce repo :
- Le monorepo a déjà Docker Compose, PostGIS, et un service Rust `api-geo`.
- Le projet a déjà un pattern de **job queue asynchrone** (import bulk) côté Rust.
- Un dossier `atlas/QGIS/` existe et contient `QGIS.qgz` (base pour un projet QGIS).

### 2.1 Points à corriger dans l’objectif
- Un **PDF vectoriel** n’est pas “300 DPI” par nature. Le DPI s’applique surtout aux **raster** (PNG/JPEG) et aux éléments raster intégrés dans un PDF.
- Objectif conseillé :
  - **PDF vectoriel** (qualité impression, taille stable)
  - + **PNG 300 DPI** optionnel (si workflows spécifiques).

### 2.2 Risques principaux
- **Headless QGIS en Docker** : dépendances système (fonts, `QT_QPA_PLATFORM=offscreen`, accès DB, performance). Faisable, mais il faut une image/pin de version et un minimum d’observabilité.
- **Payload “filter_ids”** : peut devenir énorme (ADM1 × thématique) et exploser :
  - taille JSON, latence DB, `IN (...)` très long.
  - Optimisation recommandée : passer un **filtre SQL / stratégie de sélection** ou écrire la sélection dans une table temporaire/job.
- **Non-duplication logique** : éviter la logique métier dans QGIS est réaliste si :
  - le backend calcule la classification (classes, bornes) et fournit un champ “classe” ou une table de lookup.
  - QGIS ne fait que “rendre” une couche déjà prête.

## 3. Architecture cible (recommandée)

### 3.1 Services
- **api-geo (Rust / Axum)** :
  - endpoints `POST /export/hq`, `GET /export/hq/status/:job_id`, `GET /export/hq/download/:job_id`.
  - écrit les jobs + statut + résultats.
- **atlas-qgis-worker (Python/PyQGIS)** :
  - consomme les jobs, rend le layout, écrit le fichier, met à jour le job.

### 3.2 Job queue : DB vs mémoire
Le plan propose une queue DB (table `atlas.export_jobs`) : c’est **le bon choix** pour un moteur d’export.
- Avantage : résilient au redémarrage, partage multi-workers, historisation.
- Le repo a déjà une queue en mémoire (import bulk) : utile comme référence de design, mais **pas suffisante** pour des exports HQ.

### 3.3 Stockage résultats
- OK pour un **volume partagé** (ex: `./exports/hq:/data/exports`).
- Ajouter :
  - une convention de nommage robuste (basée sur `job_id`),
  - une couche “download” contrôlée par l’API (pas de lien direct vers un chemin disque).

## 4. Contrat d’interface (payload) – version améliorée

Objectif : payload stable, versionné, extensible.

### 4.1 Format recommandé
- Ajouter :
  - `payload_version`
  - `requested_by` (user id ou token subject)
  - `created_at`
  - `output` (format, options)
  - `selection` (comment on sélectionne les features)

Exemple :
```json
{
  "payload_version": "1.0",
  "job_id": "uuid-v4",
  "layout": {
    "project_path": "project/atlas_engine.qgz",
    "layout_name": "A4_Portrait_Scientific"
  },
  "map": {
    "target_layer": "atlas.mailles",
    "thematic_id": "ARGILE",
    "adm_level": "adm1",
    "adm_name": "Savanes",
    "extent_buffer_percent": 10
  },
  "selection": {
    "strategy": "query",
    "query_id": "export_query_123" 
  },
  "styling": {
    "qml": "styles/argile.qml",
    "legend_mode": "from_layout"
  },
  "output": {
    "format": "pdf",
    "filename": "atlas_ARGILE_Savanes.pdf"
  }
}
```

### 4.2 Stratégies de sélection (éviter `filter_ids` géant)
Prévoir au moins 2 stratégies :
- `ids` : OK pour petits ensembles (adm3) ; l’API fournit une liste d’IDs.
- `query` : l’API enregistre la sélection côté DB (table `export_job_items` ou vue matérialisée par job) et le worker ne reçoit qu’un identifiant.

## 5. Table jobs – modèle recommandé

### 5.1 Table principale
```sql
CREATE TABLE atlas.export_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'PENDING',
  payload jsonb NOT NULL,
  progress int NOT NULL DEFAULT 0,
  error_message text,
  result_path text,
  result_mime text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX ON atlas.export_jobs (status, created_at);
```

### 5.2 Table items (optionnelle mais fortement conseillée)
Pour éviter un payload énorme :
```sql
CREATE TABLE atlas.export_job_items (
  job_id uuid REFERENCES atlas.export_jobs(id) ON DELETE CASCADE,
  feature_id bigint NOT NULL,
  class_id int,
  value numeric,
  PRIMARY KEY (job_id, feature_id)
);

CREATE INDEX ON atlas.export_job_items (job_id);
```

## 6. Worker PyQGIS – comportement (sans détails d’implémentation)

- Loop : récupère 1 job `PENDING` via verrouillage (`FOR UPDATE SKIP LOCKED`).
- Passe `PROCESSING`, met à jour `progress`.
- Charge le projet QGIS (`.qgz`) et le layout.
- Applique :
  - sélection (via subset string ou jointure sur `export_job_items`),
  - variables de layout (titre, sous-titre, date, sources),
  - extent/zoom + buffer.
- Exporte en PDF/PNG.
- Sauvegarde le résultat sur volume partagé.
- Passe `COMPLETED` + renseigne `result_path`.

### 6.1 Progression (étapes, pas % continu)
QGIS ne fournit pas facilement un % réel. Prévoir une progression par étapes :
- 10 % = job pris
- 30 % = projet QGIS chargé
- 70 % = export en cours
- 100 % = terminé

Cette granularité suffit pour l’UX et évite de surcharger le worker.

## 7. Docker / Déploiement

### 7.1 docker-compose
Le repo a déjà `docker-compose.yml`. Ajouter un service `atlas-qgis-worker` en s’alignant sur le réseau `atlas-net` et les variables `.env`.

Recommandations :
- **Pinner la version** de QGIS (éviter `latest`).
- Installer/embarquer les **fonts** nécessaires au rendu.
- Conserver `QT_QPA_PLATFORM=offscreen`.

### 7.2 Règle sur les projets QGIS (.qgz)
Pour éviter une explosion de projets :
- **Option 1 (recommandée)** : 1 projet QGIS maître, styles chargés dynamiquement (`qml`).
- **Option 2** : quelques projets figés (par grille / par layout).
- À exclure : 1 .qgz par thématique × grille × format.

### 7.3 Observabilité minimale
- Logs worker structurés (job_id, durée, étape).
- Endpoint status côté API.
- Une métrique simple : nombre de jobs PENDING/RUNNING/FAILED.

## 8. API Rust (api-geo) – endpoints

### 8.1 `POST /export/hq`
- Valide la requête.
- Construit payload.
- Insère job en DB.
- Retourne `{ job_id, status }`.

### 8.2 `GET /export/hq/status/:job_id`
- Retourne status + progress + message.

### 8.3 `GET /export/hq/download/:job_id`
- Vérifie droits + `COMPLETED`.
- Stream le fichier (pas d’accès direct au FS depuis l’UI).

## 9. UI – intégration progressive

### 9.1 Hiérarchie Web vs HQ
- **Mode Web (Rapide)** : outil d’exploration et de prévisualisation.
- **Mode HQ (Impression)** : sortie de référence pour diffusion et archivage.

### 9.2 Intégration UI
- Ajouter un toggle :
  - “Web (Rapide)” (moteur actuel)
  - “Impression (HQ)” (serveur)
- En mode HQ :
  - lancement `POST /export/hq`
  - polling status
  - bouton “Télécharger” quand `COMPLETED`.

## 10. Sécurité & nettoyage

- Associer chaque job à un utilisateur (ou token subject) : `requested_by`.
- Filtrer accès download par ownership.
- Nettoyage :
  - tâche planifiée (cron) pour supprimer résultats > X jours
  - et/ou suppression DB + fichiers.

## 11. Plan d’exécution (milestones)

### Milestone A – Spécification (1-2 jours)
- Payload versionné.
- Schéma DB.
- Layout QGIS (A4) validé manuellement.

### Milestone B – MVP Worker (3-5 jours)
- Worker consomme un job et produit un PDF simple correct.

### Milestone C – API + UI (3-5 jours)
- Endpoints + polling UI + téléchargement.

### Milestone D – Robustesse (2-4 jours)
- Gestion erreurs, retry, timeouts.
- Nettoyage.
- Logs/monitoring.

## 12. Critères d’acceptation MVP
- Un export HQ produit un PDF lisible, cohérent et reproductible.
- Le job survit à un redémarrage (statut en DB).
- UI : l’utilisateur voit un statut et peut télécharger le résultat.
