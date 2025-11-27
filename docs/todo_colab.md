# Atlas Colab - TODO & Roadmap

> Document de suivi des tâches pour Atlas Colab, Atlas Lab et le système RBAC.
> Mis à jour automatiquement au fil de l'avancement.

---

## 📊 État Global

| Phase | Statut | Progression |
|-------|--------|-------------|
| Phase 0 - Cadrage & Préparation | ✅ Terminé | 100% |
| Phase 1 - RBAC + Auth + UI | ✅ Terminé | 100% |
| Phase 2 - Atlas Colab (Missions) | ✅ Terminé | 100% |
| Phase 3 - PWA Mobile Terrain | ✅ Terminé | 100% |
| Phase 4 - Collaboration | 🟡 Backend OK | 80% |
| Phase 5 - Q&A Knowledge Base | 🟡 UI Web OK | 70% |
| Phase 6 - Atlas Lab (Calculs) | 🔲 À faire | 0% |

### Détail Phase 4-5 restant à faire :
- [ ] UI commentaires dans détail mission (Web)
- [ ] Bloc Q&A dans détail mission PWA
- [ ] Notifications (badge cloche + onglet Activité PWA)
- [ ] Profil utilisateur avec badges/réputation
- [ ] Leaderboard page complète

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

## 🔄 Phase 2 - Atlas Colab (Missions & Terrain)

> En cours d'implémentation

### 2.1 - Modèle de données Colab ✅
- [x] Migration `db/migrations/060_colab_schema.sql`
- [x] Tables créées dans `atlas`:
  - [x] `colab_students` - Métadonnées étudiants
  - [x] `colab_supervisors` - Métadonnées encadreurs
  - [x] `colab_missions` - Missions terrain
  - [x] `colab_mission_assignments` - Affectations étudiants
  - [x] `colab_mission_sondages` - Liaison missions/sondages
  - [x] `colab_field_logs` - Journal de terrain
  - [x] `colab_documents` - Documents liés aux missions
- [x] Types ENUM:
  - `mission_theme` (stabilisation, synthese, reconnaissance, etude_detaillee, controle)
  - `mission_status` (draft, planned, in_progress, completed, cancelled, suspended)
  - `field_log_type` (note, incident, meteo, avancee, observation, probleme, decision)
  - `document_type` (rapport_intermediaire, rapport_final, fiche_terrain, etc.)
- [x] Vues:
  - `v_colab_missions_summary`
  - `v_colab_students`
  - `v_colab_supervisors`
- [x] Triggers `updated_at` automatiques

### 2.2 - Nouveaux rôles Colab ✅
- [x] Migration `db/migrations/061_colab_permissions.sql`
- [x] Rôle `student` (accès limité à ses missions)
- [x] Rôle `supervisor` (validation, encadrement)
- [x] 21 permissions Colab:
  - `colab.missions.read/create/update/delete/assign`
  - `colab.students.read/create/update/delete`
  - `colab.supervisors.read/create/update/delete`
  - `colab.field_logs.read/write/delete`
  - `colab.documents.read/upload/delete`
  - `colab.sondages.link/unlink`
- [x] Permissions assignées aux rôles existants (admin, data_manager, geo_analyst, editor, viewer)

### 2.3 - API Colab Backend ✅
- [x] Module `services/api-geo/src/colab/`:
  - [x] `mod.rs` - exports
  - [x] `types.rs` - DTOs (MissionListItem, MissionDetail, CreateMissionRequest, etc.)
  - [x] `routes.rs` - Handlers API
- [x] Routes implémentées:
  - [x] `GET /colab/missions` - Liste avec filtres et pagination
  - [x] `POST /colab/missions` - Créer une mission
  - [x] `GET /colab/missions/:id` - Détail mission
  - [x] `PUT /colab/missions/:id` - Mettre à jour
  - [x] `DELETE /colab/missions/:id` - Supprimer
  - [x] `GET /colab/missions/stats` - Statistiques
  - [x] `GET /colab/supervisors` - Liste superviseurs
  - [x] `GET /colab/students` - Liste étudiants
- [x] Middleware auth intégré

### 2.4 - UI Colab ✅
- [x] Service API: `ui/src/services/colab-api.ts`
  - [x] `missionsApi` (list, get, create, update, delete, getStats)
  - [x] `supervisorsApi` (list)
  - [x] `studentsApi` (list)
  - [x] Helpers (getStatusLabel, getStatusColor, getThemeLabel, formatDate)
- [x] Page Colab: `ui/src/pages/ColabPage.tsx`
  - [x] Liste missions avec cards
  - [x] Filtres (thème, statut, commune, région, recherche)
  - [x] Pagination
  - [x] Statistiques dashboard
  - [x] Modal création mission
- [x] Intégration dans App.tsx:
  - [x] Onglet "Colab Studio" dans la navigation
  - [x] Import et rendu de ColabPage

### 2.5 - Complété ✅
- [x] Page détail mission (via ColabPage)
- [x] Affectation étudiants aux missions (tables créées)
- [x] Liaison sondages aux missions (colab_mission_sondages)
- [x] Journal de terrain (colab_field_logs)
- [x] Upload documents (colab_documents table)
- [x] PWA Mobile (Phase 3)

---

## ✅ Phase 3 - PWA Mobile Terrain

### 3.1 - Backend API Mobile ✅
- [x] Migration `db/migrations/064_colab_mobile_sync.sql`
- [x] Tables créées:
  - `colab_sync_queue` - Queue de synchronisation
  - `colab_tracks` - Traces GPS
  - `colab_track_points` - Points de trace
  - `colab_photos` - Photos terrain
  - `colab_field_sessions` - Sessions de travail
- [x] Module Rust `services/api-geo/src/colab/mobile.rs`
- [x] Endpoints implémentés:
  - `GET /colab/mobile/missions` - Mes missions
  - `GET /colab/mobile/missions/:id` - Détail mission
  - `GET /colab/mobile/missions/:id/map-context` - Contexte carte
  - `POST /colab/mobile/missions/:id/sondages` - Créer sondage terrain
  - `POST /colab/mobile/sync` - Synchronisation batch
  - `POST /colab/mobile/tracks` - Créer trace GPS
  - `POST /colab/mobile/tracks/:id/points` - Ajouter points
  - `POST /colab/mobile/tracks/:id/stop` - Arrêter trace

### 3.2 - PWA Setup ✅
- [x] Manifest `ui/public/manifest.webmanifest`
- [x] Configuration PWA (name, icons, start_url, display)
- [x] Installation react-router-dom
- [x] Installation @turf/turf pour géométrie

### 3.3 - Frontend Mobile ✅
- [x] Service API `ui/src/services/colab-mobile-api.ts`
  - mobileApi (missions, sync, tracks)
  - offlineStorage (IndexedDB)
  - syncService (online/offline)
  - gpsService (geolocation)
- [x] Pages mobiles:
  - `ColabMobileMissionsPage.tsx` - Liste mes missions
  - `ColabMobileMissionDetailPage.tsx` - Détail mission
  - `ColabMobileMissionMapPage.tsx` - Carte terrain avec GPS
  - `ColabMobileNewSondagePage.tsx` - Formulaire sondage

### 3.4 - GPS & Géolocalisation ✅
- [x] Geolocation API (getCurrentPosition, watchPosition)
- [x] Leaflet pour carte terrain
- [x] Turf.js pour détection entrée/sortie maille
- [x] Affichage précision GPS
- [x] Marqueurs sondages existants

---

## ✅ Phase 4 - Collaboration

### 4.1 - Modèle de données ✅
- [x] Migration `db/migrations/062_colab_collaboration.sql`
- [x] Tables créées:
  - `colab_comments` - Commentaires sur entités
  - `colab_comment_mentions` - Mentions @username
  - `colab_notifications` - Notifications utilisateur
  - `colab_sondage_status_history` - Historique statuts
- [x] Types ENUM:
  - `comment_entity_type` (mission, sondage, essai, document)
  - `notification_type` (mention, reply, status_change, etc.)
  - `sondage_validation_status` (draft_field, to_validate_lab, validated, integrated)
- [x] Colonnes ajoutées à sondages: validation_status, mission_id, location_mode

### 4.2 - Backend API ✅
- [x] Module Rust `services/api-geo/src/colab/comments.rs`
- [x] Endpoints commentaires:
  - `GET /colab/comments` - Liste avec filtres
  - `POST /colab/comments` - Créer (avec parsing @mentions)
  - `DELETE /colab/comments/:id` - Supprimer
  - `GET /colab/comments/:id/replies` - Réponses
- [x] Endpoints notifications:
  - `GET /colab/notifications` - Mes notifications
  - `POST /colab/notifications/:id/read` - Marquer lu
  - `POST /colab/notifications/read-all` - Tout marquer lu

### 4.3 - Frontend ✅
- [x] Service API `ui/src/services/colab-collab-api.ts`
  - commentsApi (list, create, delete, getReplies)
  - notificationsApi (list, markRead, markAllRead)
  - Helpers (formatRelativeTime, notificationTypeLabels)

---

## ✅ Phase 5 - Q&A Knowledge Base

### 5.1 - Modèle de données ✅
- [x] Migration `db/migrations/063_colab_qa.sql`
- [x] Tables créées:
  - `colab_tags` - Tags thématiques (12 tags initiaux)
  - `colab_questions` - Questions
  - `colab_question_tags` - Relation N:N
  - `colab_answers` - Réponses
  - `colab_votes` - Votes (+1/-1)
  - `colab_user_stats` - Statistiques utilisateur
  - `colab_badges` - Définition badges (8 badges)
  - `colab_user_badges` - Badges attribués
- [x] Triggers:
  - Compteur réponses automatique
  - Compteur utilisation tags
- [x] Vues:
  - `v_colab_questions` - Questions avec infos
  - `v_colab_answers` - Réponses avec réputation
  - `v_colab_leaderboard` - Classement

### 5.2 - Backend API ✅
- [x] Module Rust `services/api-geo/src/colab/qa.rs`
- [x] Endpoints questions:
  - `GET /colab/questions` - Liste avec filtres
  - `GET /colab/questions/:id` - Détail + réponses
  - `POST /colab/questions` - Créer
  - `PUT /colab/questions/:id` - Modifier
  - `POST /colab/questions/:id/close` - Fermer
  - `POST /colab/questions/:id/vote` - Voter
  - `POST /colab/questions/:id/answers` - Répondre
- [x] Endpoints réponses:
  - `POST /colab/answers/:id/vote` - Voter
  - `POST /colab/answers/:id/mark-best` - Meilleure réponse
- [x] Endpoints gamification:
  - `GET /colab/tags` - Liste tags
  - `GET /colab/leaderboard` - Classement
  - `GET /colab/users/:id/stats` - Stats + badges

### 5.3 - Frontend ✅
- [x] Service API `ui/src/services/colab-collab-api.ts`
  - questionsApi (list, get, create, vote, close)
  - answersApi (create, vote, markBest)
  - tagsApi (list)
  - leaderboardApi (get, getUserStats)
  - Helpers (badgeCategoryColors)

---

## 🔲 Phase 6 - Atlas Lab (Calculs & Synthèses)

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
- `services/api-geo/src/colab/` - Module Atlas Colab
- `services/api-geo/src/rbac.rs` - Middlewares RBAC
- `services/api-geo/src/main.rs` - Configuration routes

### Frontend (React/TypeScript)
- `ui/src/services/auth-api.ts` - Services API auth/RBAC
- `ui/src/services/colab-api.ts` - Services API Colab
- `ui/src/components/RBACManager.tsx` - Interface gestion RBAC
- `ui/src/pages/ColabPage.tsx` - Page Atlas Colab Studio

### Base de données
- `db/migrations/050_rbac_complete.sql` - Migration RBAC
- `db/migrations/060_colab_schema.sql` - Tables Colab
- `db/migrations/061_colab_permissions.sql` - Permissions Colab

### Configuration
- `.env` - Variables environnement
- `services/api-geo/.env` - Config API (JWT_SECRET, etc.)

---

*Dernière mise à jour: 2025-11-27 14:00 UTC*
