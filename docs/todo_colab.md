# Atlas Colab - TODO & Roadmap

> Document de suivi des tâches pour Atlas Colab, Atlas Lab et le système RBAC.
> Mis à jour automatiquement au fil de l'avancement.

---

## 📊 État Global

| Phase | Statut | Progression |
|-------|--------|-------------|
| Phase 0 - Cadrage & Préparation | ✅ Terminé | 100% |
| Phase 1 - RBAC + Auth + UI | ✅ Terminé | 100% |
| Phase 2 - Atlas Colab (Missions) | 🔲 À faire | 0% |
| Phase 3 - Atlas Lab (Calculs) | 🔲 À faire | 0% |

---

## ✅ Phase 0 - Cadrage & Préparation

### 0.0 - Snapshot Git
- [x] `git status` vérifié
- [x] Commit snapshot avant migration
- [x] Branche `feat/ui-v3.3-geocode-details` active

### 0.1 - Migration schéma `atlas`
- [x] Tables géotechniques migrées vers `atlas`:
  - [x] `sondages` (123 enregistrements)
  - [x] `echantillons`
  - [x] `essais_atterberg`
  - [x] `essais_classif`
  - [x] `essais_geotechniques`
  - [x] `essais_physiques`
  - [x] `essais_potentiel_gonflement`
  - [x] `essais_proctor`
  - [x] `essais_vbs`
  - [x] `granulo_points`
- [x] Vues de compatibilité créées dans `public`
- [x] Index legacy renommés (`sondages_legacy_pkey`, etc.)
- [x] Backups créés:
  - `backup_avant_migration_rbac.sql`
  - `backup_apres_migration_rbac_geotech.sql`

### 0.2 - Cadrage rôles & permissions
- [x] 5 rôles définis: `admin`, `editor`, `viewer`, `data_manager`, `geo_analyst`
- [x] 39 permissions définies couvrant:
  - Tables (read, write, delete, create, alter, drop)
  - Staging (create, read, update, commit, cancel, delete)
  - Schema (read, modify)
  - Users (read, create, update, delete, manage_roles)
  - Roles (read, create, update, delete, manage_permissions)
  - Audit (read, export)
  - Backup (create, restore, delete, schedule)
  - Import/Export
  - Geocoding
  - Thematic
  - System

### 0.3 - Choix techniques Auth/JWT
- [x] Bibliothèques Rust:
  - `jsonwebtoken` v9.3
  - `argon2` v0.5 (Argon2id)
  - `axum-extra` v0.9
  - `tower` v0.4
  - `validator` v0.16
- [x] Stratégie tokens:
  - Access token JWT (15-60 min configurable)
  - Refresh token en BDD (7-30 jours)
- [x] Claims JWT: `sub`, `username`, `email`, `roles`, `permissions`, `session_id`, `exp`, `iat`

### 0.4 - Spécification routes API
- [x] Routes auth définies:
  - `POST /auth/login`
  - `POST /auth/logout`
  - `POST /auth/refresh`
  - `GET /auth/me`
  - `POST /auth/change-password`
  - `POST /auth/forgot-password`
  - `POST /auth/reset-password`
  - `GET /auth/sessions`
  - `DELETE /auth/sessions/:id`
- [x] Routes users définies (`/users/*`)
- [x] Routes roles définies (`/roles/*`)
- [x] Routes permissions définies (`/permissions/*`)

---

## ✅ Phase 1 - RBAC + Auth + UI

### 1.1 - Migration SQL RBAC
- [x] Fichier: `db/migrations/050_rbac_complete.sql`
- [x] Tables créées dans `atlas`:
  - [x] `users` (avec password_hash Argon2id)
  - [x] `roles`
  - [x] `permissions`
  - [x] `user_roles`
  - [x] `role_permissions`
  - [x] `sessions`
  - [x] `password_reset_tokens`
  - [x] `auth_audit_log`
- [x] Données seed:
  - 39 permissions
  - 5 rôles avec permissions assignées
  - 1 utilisateur admin (`admin@atlas.local`)
- [x] Fonctions PostgreSQL:
  - `user_has_permission()`
  - `get_user_permissions()`
  - `get_user_roles()`
  - `cleanup_expired_sessions()`
  - `update_updated_at_column()`
  - `log_auth_event()`
- [x] Vues:
  - `v_users_with_roles`
  - `v_roles_with_permissions`

### 1.2 - Module `auth` (Rust)
- [x] Fichiers créés dans `services/api-geo/src/auth/`:
  - [x] `mod.rs` - exports
  - [x] `config.rs` - AuthConfig (JWT secret, TTLs, password policy)
  - [x] `error.rs` - AuthError enum avec codes HTTP
  - [x] `types.rs` - DTOs (LoginRequest, TokenResponse, etc.)
  - [x] `password.rs` - PasswordHasher (Argon2id)
  - [x] `jwt.rs` - JwtManager (génération, validation)
  - [x] `session.rs` - SessionManager (CRUD sessions)
  - [x] `middleware.rs` - Middlewares Axum
  - [x] `routes.rs` - Handlers API

### 1.3 - Module `users` (Rust)
- [x] Fichiers créés dans `services/api-geo/src/users/`:
  - [x] `mod.rs`
  - [x] `types.rs` - DTOs utilisateurs
  - [x] `routes.rs` - CRUD complet + gestion rôles

### 1.4 - Module `roles` (Rust)
- [x] Fichiers créés dans `services/api-geo/src/roles/`:
  - [x] `mod.rs`
  - [x] `types.rs` - DTOs rôles/permissions
  - [x] `routes.rs` - CRUD + gestion permissions

### 1.5 - Mise à jour `rbac.rs`
- [x] Extraction utilisateur depuis JWT (`AuthUser`)
- [x] Fallback headers legacy (`X-User-Role`, `X-User-Name`)
- [x] Fonction `extract_user_from_request()` mise à jour
- [x] Middlewares permission-based

### 1.6 - Branchement middlewares `main.rs`
- [x] Import modules `auth`, `users`, `roles`
- [x] Routes `/auth/*` configurées
- [x] Routes `/users/*` avec middleware admin
- [x] Routes `/roles/*` avec middleware admin
- [x] Routes `/permissions/*` configurées
- [x] `AuthConfig` ajouté à `AppState`

### 1.7 - Frontend `RBACManager.tsx`
- [x] Service API créé: `ui/src/services/auth-api.ts`
  - [x] `authApi` (login, logout, refresh, sessions)
  - [x] `usersApi` (CRUD, assign roles)
  - [x] `rolesApi` (CRUD, permissions)
  - [x] `permissionsApi` (list, grouped)
  - [x] `tokenStorage` (localStorage)
- [x] Composant mis à jour:
  - [x] Appels API réels (plus de mock)
  - [x] Gestion loading/error states
  - [x] CRUD users fonctionnel
  - [x] CRUD roles fonctionnel
  - [x] Affichage permissions groupées
  - [x] Formulaire de login intégré
  - [x] Affichage utilisateur connecté + logout

### 1.8 - Tests & Validation
- [x] Compilation Rust OK (`cargo check`)
- [x] API `/health` répond
- [x] API `/sondages` fonctionne avec données migrées
- [x] Commit RBAC effectué

---

## 🔲 Phase 2 - Atlas Colab (Missions & Terrain)

> À implémenter après validation Phase 1

### 2.1 - Modèle de données Colab
- [ ] Table `atlas.missions`
  - id, titre, description, zone_geom, date_debut, date_fin
  - statut (draft, active, completed, archived)
  - created_by, assigned_to (users)
- [ ] Table `atlas.mission_sondages`
  - mission_id, sondage_id, ordre, statut
- [ ] Table `atlas.mission_members`
  - mission_id, user_id, role (leader, member, observer)
- [ ] Table `atlas.sondages_raw` (données terrain brutes)
  - Avant validation/géocodage
- [ ] Table `atlas.mission_logs`
  - Historique des actions sur missions

### 2.2 - Nouveaux rôles Colab
- [ ] Rôle `student` (accès limité à ses missions)
- [ ] Rôle `supervisor` (validation, encadrement)
- [ ] Permissions Colab:
  - `colab.missions.read`
  - `colab.missions.create`
  - `colab.missions.manage`
  - `colab.sondages.read`
  - `colab.sondages.edit`
  - `colab.sondages.validate`

### 2.3 - API Colab Backend
- [ ] Routes `/missions/*`
- [ ] Routes `/missions/:id/sondages/*`
- [ ] Routes `/missions/:id/members/*`
- [ ] Workflow validation sondages

### 2.4 - UI Colab
- [ ] Page liste missions
- [ ] Page détail mission
- [ ] Formulaire saisie sondage terrain
- [ ] Interface validation encadrant
- [ ] Dashboard progression

### 2.5 - PWA Mobile
- [ ] Service Worker
- [ ] Mode offline
- [ ] Sync background
- [ ] Géolocalisation

---

## 🔲 Phase 3 - Atlas Lab (Calculs & Synthèses)

> À implémenter après Phase 2

### 3.1 - Moteur de calcul
- [ ] Calculs Atterberg (IP, IL, IC)
- [ ] Classification GTR
- [ ] Calculs Proctor
- [ ] Synthèses par maille/zone

### 3.2 - Rapports automatiques
- [ ] Génération PDF
- [ ] Export Excel
- [ ] Graphiques statistiques

### 3.3 - Intégration cartes thématiques
- [ ] Couches calculées
- [ ] Interpolation spatiale

---

## 🔧 Points d'attention / Améliorations

### Priorité Haute
- [ ] **Healthcheck**: Mettre à jour pour tester `staging_metadata` et `backup_metadata` au lieu de `staging_info` et `backups`
- [ ] **Admin password**: Changer le mot de passe de `admin@atlas.local` en production

### Priorité Moyenne
- [ ] **Nettoyage legacy**: Supprimer/renommer les tables `sondages_legacy_20251117` et index associés
- [ ] **Search path**: Configurer `ALTER ROLE atlas SET search_path = 'atlas', 'public'`
- [ ] **Code update**: Remplacer `public.*` par `atlas.*` dans le code Rust

### Priorité Basse
- [ ] **CRLF/LF**: Configurer `.gitattributes` si nécessaire
- [ ] **Warnings Rust**: Nettoyer les imports inutilisés

---

## 📝 Historique des commits

| Date | Commit | Description |
|------|--------|-------------|
| 2025-11-27 | `28fb107` | feat(rbac): Implémentation complète RBAC - JWT, users, roles, permissions |

---

## 📚 Fichiers clés

### Backend (Rust)
- `services/api-geo/src/auth/` - Module authentification
- `services/api-geo/src/users/` - Module utilisateurs
- `services/api-geo/src/roles/` - Module rôles
- `services/api-geo/src/rbac.rs` - Middlewares RBAC
- `services/api-geo/src/main.rs` - Configuration routes

### Frontend (React/TypeScript)
- `ui/src/services/auth-api.ts` - Services API auth/RBAC
- `ui/src/components/RBACManager.tsx` - Interface gestion RBAC

### Base de données
- `db/migrations/050_rbac_complete.sql` - Migration RBAC

### Configuration
- `.env` - Variables environnement
- `services/api-geo/.env` - Config API (JWT_SECRET, etc.)

---

*Dernière mise à jour: 2025-11-27 12:44 UTC*
