---
description: Session changelog raisonné — Finalisation docs (ADRs + contrat seed + règles métier + roadmap), implémentation des items roadmap bloquants (vues SQL, grants runtime, pool admin DB Manager), scripts seed contract (bash + PowerShell avec fallback Docker)
date: 2026-03-14
weekday: samedi
repo: atlas_reclone
service: services/api-geo
ui: ui (Vite)
stack: docker-compose (db postgis + api-geo + ui)
database: atlas_clean
branch: atlas_v2_clean
---

# Session — Changelog raisonné (très verbeux)

## 1) Date / méta

- **Date** : 2026-03-14 (**samedi**)
- **Contexte d’exécution** : Windows (PowerShell), repo `c:\PROJET_ATLAS_MASTER\atlas_reclone`
- **Branche** : `atlas_v2_clean`
- **Objectif de la session** : clôturer proprement la séquence “stabilisation maille status + contrat seed + DB hardening” avec :
  - une **documentation complète** (ADRs + contrat seed + règles métier + roadmap consolidée)
  - les **items bloquants roadmap** livrés côté code/migrations (vues, grants, pool admin)
  - des **scripts d’audit/validation/restore** utilisables sur Windows **même sans `psql` installé**, via un fallback `docker exec`

---

## 2) Contexte / symptômes qui ont déclenché le travail

### 2.1. “Contrat seed” manquant → restore imprévisible

Constat : en pratique, les restores “seed Desktop” ont tendance à échouer ou à dériver, pour 3 raisons récurrentes :

- le dump peut être **corrompu** (copie tronquée, mauvais fichier, etc.)
- incompatibilité d’outils (`pg_restore: unsupported version`) si le seed a été produit avec une autre version majeure
- risque de **restore destructif** si on écrase une DB déjà initialisée (erreur humaine, script trop permissif)

=> Besoin : formaliser un **contrat** (artefacts + hash + règles + procédures) et le traduire en scripts.

### 2.2. Roadmap “bloquants visibles” : 500 runtime + DB Manager trop puissant

Plusieurs points avaient été explicités comme bloquants dans la roadmap consolidée :

- **R-1** : endpoints Colab 500 si vue `atlas.v_colab_mission_attributions` absente.
- **R-3** : endpoints DB Manager 500 si le runtime user n’a pas les droits sur `public.*`.
- **E-1** : le DB Manager (`/db/*`) ne doit pas tourner avec les droits du runtime pool ; il faut un **pool admin séparé**, désactivé par défaut.

---

## 3) Principes et contraintes (choix de design)

### 3.1. Principe : “source de vérité canonique” via vues SQL

On a retenu une approche de canonisation : si plusieurs endpoints/UI ont besoin de la même logique JOIN + statut, on crée une vue stable et on la consomme.

Pourquoi :

- évite la duplication SQL dans le code Rust
- permet de corriger une fois, au niveau DB
- rend les invariants testables facilement via scripts (`psql -c "SELECT ..."`)

Références :

- Migration : `migrations/124_colab_attributions_view.sql`
- ADR “maille status canonique” : `docs/adr/ADR-001_canonical_maille_status_source_of_truth.md`

### 3.2. Principe : “least privilege” et séparation runtime vs admin

On a acté que :

- **le runtime pool** (`DATABASE_URL`) ne doit pas être un super user ni avoir des droits admin.
- les opérations sensibles (`/db/*`) doivent être réalisées via un **pool admin** (`DATABASE_URL_ADMIN`) et un **feature flag**.

Pourquoi :

- défense en profondeur
- moindre blast radius en cas de bug vulnérabilité côté API runtime
- exécution explicite : si un opérateur veut le DB Manager, il active volontairement `ENABLE_DB_MANAGER=true`

Référence ADR : `docs/adr/ADR-003_db_roles_least_privilege.md`

### 3.3. Principe : scripts cross-platform, Windows-first

Contrainte réelle : poste Windows sans WSL/bash, et `psql` parfois absent.

Choix : fournir :

- scripts bash (`.sh`) pour environnements Linux/CI
- scripts PowerShell (`.ps1`) pour Windows
- dans les `.ps1`, si `psql`/`pg_restore` manquent, fallback `docker exec` sur le conteneur DB

Pourquoi :

- évite de bloquer l’équipe sur l’outillage local
- rend les validations “contractuelles” ré-exécutables par n’importe qui

---

## 4) Changelog raisonné — livrables (docs, migrations, code, scripts)

### 4.1. Documentation — ADRs + contrat seed + règles métier + roadmap

#### 4.1.1. ADRs 001 → 004 (décisions structurantes)

Fichiers :

- `docs/adr/ADR-001_canonical_maille_status_source_of_truth.md`
- `docs/adr/ADR-002_seed_dump_format_and_versioning.md`
- `docs/adr/ADR-003_db_roles_least_privilege.md`
- `docs/adr/ADR-004_immutable_maille_code.md`

Décisions couvertes :

- **ADR-001** : la vue `atlas.v_maille_status` est la source de vérité canonique.
- **ADR-002** : le seed est un `pg_dump -Fc` versionné + manifest SHA256.
- **ADR-003** : séparation runtime vs admin via `DATABASE_URL` / `DATABASE_URL_ADMIN`.
- **ADR-004** : immutabilité des codes maille (traçabilité / auditabilité).

Pourquoi c’est important :

- ces docs sont le “contrat” qui empêche les régressions silencieuses
- elles rendent explicites des choix qui étaient implicites (et donc fragiles)

#### 4.1.2. Contrat seed dump canonique

Fichier :

- `docs/CONTRAT_SEED_DUMP.md`

Points clés du contrat :

- dump `pg_dump -Fc` sans owner/privileges figés
- manifest adjacent : `data/db/backups/atlas_desktop_seed.dump.json`
- vérification SHA256 et size avant restore
- politique “ne jamais écraser implicitement” (guardrail)

#### 4.1.3. Règles métier (BM-07 → BM-12)

Fichier :

- `docs/REGLES_METIER.md`

Ajouts :

- règles explicitant les invariants (mailles actives, seed contract, etc.)
- historique de révisions (traçabilité doc)

#### 4.1.4. Roadmap consolidée

Fichier (consolidation “une seule source”) :

- `docs/ROADMAP COMPLÈTE ET DÉTAILLÉE 13-03-2026.MD`

Utilité :

- permet un pilotage “exécutable” : chaque item a directives + validations

---

### 4.2. Migrations — R-1 (vue attributions) + R-3 (grants public)

#### 4.2.1. R-1 — Vue canonique `atlas.v_colab_mission_attributions`

Fichier :

- `migrations/124_colab_attributions_view.sql`

Ce que la vue fait (résumé fonctionnel) :

- assemble Mission → Maille → Assignation active → Étudiant (user) → (optionnel) assignation maille → derniers logs notification
- expose des colonnes stables consommées par `/api/colab/attributions*`
- inclut les GRANT SELECT pour `atlas_app_user` et `atlas_readonly_user`

Pourquoi c’était un bloquant :

- sans cette vue, les endpoints Colab concernés peuvent 500 (relation inexistante)

Validation attendue :

- requête DB `SELECT COUNT(*) FROM atlas.v_colab_mission_attributions;`
- smoke test API `/api/colab/attributions?...` (200)

#### 4.2.2. R-3 — Grants runtime sur le schéma `public`

Fichier :

- `migrations/125_fix_app_user_grants_public.sql`

Ce que la migration fait :

- `GRANT USAGE ON SCHEMA public` + `GRANT SELECT ON ALL TABLES/SEQUENCES IN SCHEMA public`
- `ALTER DEFAULT PRIVILEGES ...` (pour éviter une régression sur nouvelles tables/seq)

Pourquoi :

- certains endpoints lisent des tables legacy/core en `public.*`
- le runtime role doit pouvoir faire du SELECT, sinon 500

---

### 4.3. Backend — DB Manager pool admin séparé (E-1)

#### 4.3.1. État applicatif enrichi (pool admin optionnel)

Fichier :

- `services/api-geo/src/state.rs`

Changement :

- ajout de `admin_pool: Option<PgPool>` dans `AppState`

Pourquoi :

- injection explicite dans les handlers `/db/*`
- empêche l’utilisation “accidentelle” du runtime pool pour l’admin

#### 4.3.2. Initialisation du pool admin conditionnelle

Fichier :

- `services/api-geo/src/main.rs`

Logique :

- lire `ENABLE_DB_MANAGER` (true/1) ; si false, `admin_pool=None`
- si true : exiger `DATABASE_URL_ADMIN`, se connecter, faire `SELECT 1` (health check)

Décision importante :

- **fail-fast** si `ENABLE_DB_MANAGER=true` mais `DATABASE_URL_ADMIN` manquant

#### 4.3.3. Tous les handlers `/db/*` exigent `admin_pool`

Fichier :

- `services/api-geo/src/db_manager/routes.rs`

Changement :

- création d’un helper `require_admin_pool()`
- chaque handler appelle `require_admin_pool(&state)?`
- si désactivé : réponse 503 avec payload JSON explicite (`DB_MANAGER_DISABLED`)

Pourquoi :

- comportement prévisible en prod
- surface d’attaque réduite

---

### 4.4. Scripts — seed contract (générer/valider/restaurer) + validations DB/métier

#### 4.4.1. Génération manifest SHA256

Fichier :

- `scripts/generate_seed_manifest.py`

Responsabilité :

- calcul SHA256 + size
- ajoute `git_commit` pour traçabilité
- écrit un JSON adjacent (par défaut `<dump>.json`)

Pourquoi :

- c’est la “preuve” que le dump restauré est bien celui attendu

#### 4.4.2. Validation “DB minimale” (existence vues + compteurs)

Fichiers :

- `scripts/validate-db.sh`
- `scripts/validate-db.ps1`

Le `.ps1` inclut un fallback :

- si `psql` absent : `docker exec -i <container> psql ...`

Ce qui est vérifié :

- connexion DB (`SELECT 1`)
- présence `atlas.v_maille_status`
- présence `atlas.v_colab_mission_attributions`
- compteurs `atlas.mailles` + `atlas.colab_missions`

#### 4.4.3. Validation “métier” (invariants simples)

Fichiers :

- `scripts/validate_metier.sh`
- `scripts/validate_metier.ps1`

Vérifications :

- assignments actifs
- mailles actives via la vue canonique
- missions sans maille (devrait être 0, sinon investiguer)

#### 4.4.4. Restore durci (PowerShell) : hash + guardrail + fallback Docker

Fichier :

- `scripts/restore-db.ps1`

Comportements clés :

- si manifest `<dump>.json` présent : vérifie `size_bytes` + `sha256` avant de restaurer
- guardrail : si DB cible existe et `FORCE_RESTORE_DROP_DB != 1` ⇒ abort
- si `psql`/`pg_restore` absents : fallback docker

Pourquoi :

- on évite le restore “au petit bonheur”
- on évite l’écrasement accidentel

---

## 5) Commandes exécutées / à exécuter (audit trail)

> Note : la session a été conçue pour être rejouable. Les commandes ci-dessous sont celles attendues pour appliquer/valider dans un environnement Docker.

### 5.1. Appliquer migrations dans le conteneur DB

```powershell
# Appliquer la vue attributions
# (selon montage des migrations dans l’image, adapter le chemin si besoin)
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/124_colab_attributions_view.sql

# Appliquer les grants public
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/125_fix_app_user_grants_public.sql
```

### 5.2. Vérifier DB (vues + compteurs)

```powershell
# Si psql est installé localement
./scripts/validate-db.ps1

# Sinon, laisser le script basculer automatiquement sur docker exec
```

### 5.3. Vérifier métier (invariants)

```powershell
./scripts/validate_metier.ps1
```

### 5.4. Générer/mettre à jour le manifest seed (si dump présent)

```powershell
python .\scripts\generate_seed_manifest.py .\data\db\backups\atlas_desktop_seed.dump
```

### 5.5. Restore DB de test depuis dump (durci)

```powershell
# IMPORTANT: si la DB cible existe, il faut explicitement forcer
$env:FORCE_RESTORE_DROP_DB = '1'

.\scripts\restore-db.ps1 -BackupFile .\data\db\backups\atlas_desktop_seed.dump -TargetDb atlas_restore
```

---

## 6) Points d’attention / risques traités (et pourquoi c’est “anti-dette”)

### 6.1. Scripts Windows : éviter le faux négatif “psql absent”

Risque : l’équipe pense que les scripts ne fonctionnent pas alors qu’ils sont corrects, juste faute d’outil local.

Traitement : fallback Docker.

### 6.2. DB Manager : sécurité by default

Risque : une route admin exposée en prod par accident.

Traitement :

- `ENABLE_DB_MANAGER=false` par défaut
- 503 explicite si appelé
- `DATABASE_URL_ADMIN` séparée

### 6.3. R-1/R-3 : bloquants “visibles” éliminés

Risque : 500 en prod sur des endpoints utilisateurs.

Traitement :

- vue manquante : ajout migration 124
- grants public : migration 125

---

## 7) Références (docs & code) — index rapide

- **Roadmap canonique** : `docs/ROADMAP COMPLÈTE ET DÉTAILLÉE 13-03-2026.MD`
- **Contrat seed** : `docs/CONTRAT_SEED_DUMP.md`
- **Règles métier** : `docs/REGLES_METIER.md`
- **ADRs** : `docs/adr/ADR-001_*.md` → `ADR-004_*.md`
- **Migration R-1** : `migrations/124_colab_attributions_view.sql`
- **Migration R-3** : `migrations/125_fix_app_user_grants_public.sql`
- **Pool admin DB Manager** :
  - `services/api-geo/src/main.rs`
  - `services/api-geo/src/state.rs`
  - `services/api-geo/src/db_manager/routes.rs`
- **Scripts seed/validation/restore** : `scripts/*.sh` et `scripts/*.ps1`

---

## 8) Statut de fin de session (ce qui reste à faire)

- Il reste un **smoke test final** à faire sur une machine cible (ou dans l’environnement Docker) pour :
  - valider que `validate-db.ps1` et `validate_metier.ps1` passent
  - valider un `restore-db.ps1` sur une DB de test (`atlas_restore`) et confirmer que les invariants tiennent
  - optionnel : tester les endpoints API concernés (`/api/colab/attributions*`, `/api/db/*`) avec un token

Fin de session.
