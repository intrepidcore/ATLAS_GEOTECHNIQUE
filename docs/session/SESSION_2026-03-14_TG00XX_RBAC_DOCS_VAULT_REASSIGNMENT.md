---
description: Session changelog raisonné — Audit TG-00xx (G-10), contrat grid_registry TG00XX, docs_vault (import .md en DB avec sha256), support réattribution missions (DB-131) + endpoints API (unassign/reassign/list missions par maille)
date: 2026-03-14
weekday: samedi
repo: atlas_reclone
database: atlas_clean
branch: atlas_v2_clean
stack: docker-compose (db postgis + services/api-geo + ui)
---

# Session — Changelog raisonné (très verbeux)

## 1) Date / méta

- **Date** : 2026-03-14 (**samedi**)
- **Repo** : `c:\PROJET_ATLAS_MASTER\atlas_reclone`
- **Branche** : `atlas_v2_clean`
- **DB** : `atlas_clean` (PostGIS via Docker)
- **Objectif global** :
  - finaliser l’analyse de la grille legacy/provisoire `TG-00xx` ("third grid") et documenter les résultats
  - éviter la dette technique : formaliser des contrats (grid_registry, docs_vault, règles métier)
  - préparer un workflow propre de **réattribution** des missions lorsque des coordonnées terrain (GPS) seront disponibles

---

## 2) Contexte / pourquoi ce travail

### 2.1. Problème “TG-00xx” (third grid)

- Des exports missions Colab contiennent des `maille_code` de type `TG-00xx-00yy-01`.
- Ces codes ne correspondent pas à la grille V2 (2 km) reconstruite en EPSG:25231.
- Les missions ont néanmoins été rattachées à des mailles V2 (via un fallback), ce qui crée des **ambiguïtés géographiques**.

Objectif :

- **Identifier le mécanisme réel** de rattachement existant
- Tester de manière rigoureuse les hypothèses de reconstruction de la grille `TG-00xx`
- Formaliser une stratégie de migration et un état de vérité (audit)

### 2.2. Problème “réattribution” (workflow métier)

Le rattachement par fallback (ADM3→centroïde→maille V2) est acceptable comme **solution opérationnelle**, mais il est trop imprécis pour reconstruire 18/21 mailles distinctes "violettes" si plusieurs opérations se déroulent dans la même commune.

=> Besoin : une feature de **réattribution** (désassigner/réassigner) qui conserve l’historique et permet de corriger lorsque les coordonnées GPS sont connues.

### 2.3. Problème “mémoire des décisions”

Les décisions structurantes (ADR, règles métier, audit) sont aujourd’hui dans Git. Pour réduire le risque de perte d’information (accès Git indisponible / contexte équipe), il est utile d’avoir un **vault** des documents `.md` dans la DB.

---

## 3) Résultats d’analyse — G-10 (hypothèses alternatives TG-00xx)

### 3.1. Hypothèse A — encodage direct lon/lat via col/row (/100)

Test effectué sur les 21 missions `TG-00%` :

- `lon_direct = col_prov / 100`
- `lat_direct = row_prov / 100`

Résultat : écarts très importants :

- `ecart_lon ~ 0.66 → 0.74`
- `ecart_lat ~ 5.74 → 5.83`

=> **Hypothèse rejetée**.

### 3.2. Hypothèse B — step=0.001° (10× plus fin)

Test :

- `x0_001 = lon_v2 - col_prov*0.001`
- `y0_001 = lat_v2 - row_prov*0.001`

Résultat (21 lignes) :

- `x0_range = 0.1111`
- `y0_range = 0.1816`

=> L’origine reste trop variable. **Hypothèse rejetée**.

### 3.3. Conclusion (anti-dette)

- On ne fige pas de géométrie TG-00xx "source de vérité" sans référence externe.
- La seule stratégie raisonnable à ce stade est :
  - fallback ADM3-centroïde pour maintenir le système fonctionnel
  - traçabilité via `colab_maille_code_map`
  - réattribution via coordonnées GPS lorsqu’elles seront disponibles

Référence :

- `docs/audit/AUDIT_REMAPPING_2026-03-14.md`

---

## 4) Livrables DB — migrations et contrats

### 4.1. Migration 130 — enregistrement grille provisoire dans `atlas.grid_registry`

Fichier :

- `db/migrations/130_register_provisional_tg00xx_grid_registry.sql`

But :

- enregistrer `TG00XX_PROVISIONAL` avec statut `hypothesis_not_validated`.

Commande exécutée :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/130_register_provisional_tg00xx_grid_registry.sql
```

Vérification :

```sql
SELECT grid_id, srid, unit, step, algo, source_ref, params->>'status' AS status
FROM atlas.grid_registry
WHERE grid_id='TG00XX_PROVISIONAL';
```

### 4.2. Migration 131 — support réattribution missions (BM-15/BM-17)

Fichier :

- `db/migrations/131_mission_reassignment_support.sql`

Changements :

- `ALTER TABLE atlas.colab_missions ADD COLUMN ex_maille_code TEXT`
- `ALTER TABLE atlas.colab_missions ADD COLUMN reassigned_from UUID`
- FK `colab_missions_reassigned_from_fkey` (idempotent)
- Vue `atlas.v_operator_mission_history`

Commande exécutée :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/131_mission_reassignment_support.sql
```

### 4.3. Migration 132 — `atlas.docs_vault` + intégrité sha256

Fichier :

- `db/migrations/132_docs_vault.sql`

Changements :

- table `atlas.docs_vault` (`path`, `content`, `sha256`, `size_bytes`, `doc_type`, `git_commit`, `git_branch`, timestamps)
- index FTS gin `to_tsvector('french', content)`
- fonction `atlas.verify_docs_vault()`

Point d’attention :

- un bug initial dans `verify_docs_vault()` : `dv.content::bytea` provoquait `invalid input syntax for type bytea`.
- correction : `digest(convert_to(dv.content, 'UTF8'), 'sha256')`

Commande exécutée :

```bash
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/132_docs_vault.sql
```

---

## 5) Import docs → DB (vault)

### 5.1. Script d’import

Fichier :

- `scripts/import-docs-to-vault.ps1`

Fonctionnalités :

- calcule `sha256` + `size_bytes` côté PowerShell
- catégorise `doc_type` via le path (adr/audit/session/regles/roadmap/doc)
- upsert idempotent (`ON CONFLICT (path) DO UPDATE ...`)
- mode `-VerifyOnly` : appelle `atlas.verify_docs_vault()`.

### 5.2. Incident réel rencontré (Windows)

Symptôme :

- `7 erreurs d'import` alors que l’import fonctionnait pour la majorité des fichiers.

Cause :

- passage du SQL via `psql -c "..."` => limite de longueur d’arguments sur Windows pour les gros `.md`.

Fix :

- envoyer le SQL via **stdin** : `$sql | docker compose exec -T db psql ...`.

Commandes exécutées :

```powershell
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\import-docs-to-vault.ps1 -Force
pwsh -NoProfile -ExecutionPolicy Bypass -File .\scripts\import-docs-to-vault.ps1 -VerifyOnly
```

Résultat :

- `atlas.docs_vault` contient ~309 documents.
- la vérification renvoie `OK`.

---

## 6) Backend API — endpoints réattribution

### 6.1. Types

Fichier :

- `services/api-geo/src/colab/types.rs`

Ajouts :

- `ReassignMissionRequest`
- `UnassignMissionMailleResponse`
- `ReassignMissionResponse`
- `MailleActiveMissionsResponse`

### 6.2. Routes

Fichier :

- `services/api-geo/src/colab/routes.rs`

Ajouts :

- `DELETE /colab/missions/:id/maille` → `unassign_mission_maille`
- `POST /colab/missions/:id/reassign` → `reassign_mission`
- `GET /colab/mailles/:id/missions` → `get_maille_active_missions`

Points de design :

- transactions `sqlx`
- permissions alignées sur `colab.missions.update` / `colab.missions.read`
- idempotence sur l’unassign
- maintien de la cohérence via `SELECT atlas.sync_colab_maille_assignment_for_mission($1)`

Compilation (validation) :

```bash
cargo build
```

---

## 7) Cartographie DB — Users / Auth / RBAC (architecture)

### 7.1. “Noyau identités” (atlas.users)

Table : `atlas.users`

- identité : `id uuid`
- login : `email`, `username`, `password_hash`
- état : `is_active`, `is_verified`, `locked_until`, `failed_login_attempts`, `deleted_at`
- audit : `last_login_at`, `last_login_ip`, `password_changed_at`, `created_at`, `updated_at`

Soft delete : `deleted_at` (indexé).

### 7.2. Sessions (JWT) — `atlas.sessions`

Table : `atlas.sessions`

- `token_hash` et `refresh_token_hash` = sha256 des tokens
- `is_active`, `expires_at`, `revoked_at`, `revoked_reason`
- `last_activity_at`, `device_info`

FK : `sessions.user_id → users.id` (CASCADE).

### 7.3. RBAC (rôles / permissions)

Tables :

- `atlas.roles (id, name, is_system, ...)`
- `atlas.permissions (id=resource.action, resource, action, ...)`
- `atlas.user_roles (user_id, role_id, expires_at, assigned_by, ...)`
- `atlas.role_permissions (role_id, permission_id, granted_by, ...)`

Vues :

- `atlas.v_users_with_roles` : agrège les rôles actifs (`expires_at IS NULL OR expires_at > now()`) en JSON.
- `atlas.v_roles_with_permissions` : agrège les permissions d’un rôle en JSON.

### 7.4. Audit auth

Table : `atlas.auth_audit_log`

- `event_type` (login/logout/password_reset/token_refresh...)
- `success` + `details jsonb`
- `user_id` nullable (ON DELETE SET NULL)

### 7.5. Reset password

Table : `atlas.password_reset_tokens`

- `token_hash` sha256
- `expires_at`, `used_at`
- FK `user_id` (CASCADE)

### 7.6. “Personas” Colab (extensions autour de users)

- `atlas.colab_students (id uuid, user_id uuid unique, matricule/promotion..., deleted_at)`
- `atlas.colab_supervisors (id uuid, user_id uuid unique, meta..., deleted_at)`
- `atlas.colab_student_prefs (student_id text pk, user_id uuid nullable)`

Important : on observe deux identifiants distincts côté Colab :

- `colab_students.id` = UUID (référence DB)
- `colab_student_prefs.student_id` = TEXT (souvent matricule) utilisé par certaines tables historiques.

### 7.7. Dépendances / cascade (résumé)

Diagramme textuel :

```
users
  ├─ sessions (auth runtime)
  ├─ user_roles ──> roles ── role_permissions ──> permissions
  ├─ password_reset_tokens
  ├─ auth_audit_log
  ├─ colab_students ──> colab_mission_assignments ──> colab_missions
  ├─ colab_supervisors ──> colab_missions
  └─ (beaucoup d’objets colab_* où users.id est author/uploaded_by/etc.)
```

Invariants importants :

- `users.email` unique, `users.username` unique + contraintes regex.
- `user_roles` PK composite (`user_id`, `role_id`).
- `sessions.token_hash` unique + `refresh_token_hash` unique.

---

## 8) Fichiers modifiés / ajoutés (index)

- `docs/audit/AUDIT_REMAPPING_2026-03-14.md` (ajout G-10 + conclusions)
- `docs/SDD_MISSION_REASSIGNMENT_AND_DOCS_VAULT.md`
- `db/migrations/131_mission_reassignment_support.sql`
- `db/migrations/132_docs_vault.sql`
- `scripts/import-docs-to-vault.ps1`
- `services/api-geo/src/colab/types.rs`
- `services/api-geo/src/colab/routes.rs`
- `ui/src/services/colab-api.ts` (client API reassign/unassign)

---

## 9) Statut de fin de session

Fait :

- Hypothèses alternatives G-10 testées et documentées
- Grille TG-00xx enregistrée dans `grid_registry` (statut hypothèse)
- `docs_vault` en DB + import `.md` + verify sha256
- Support DB réattribution + endpoints API

Reste à faire (prochaine session) :

- brancher l’UI (Colab + carte) sur les endpoints nouvellement créés
- exécuter un dump seed selon contrat + exécuter `scripts/verify-tauri-dev.ps1`
- commit + push du lot de changements

Fin de session.
