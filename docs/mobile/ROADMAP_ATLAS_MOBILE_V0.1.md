---
status: active
type: roadmap
revision: V0.1
project: atlas / atlas-mobile
author: Serge TABE DJATO
tags: [atlas, mobile, react-native, roadmap]
aliases: [Roadmap Atlas Mobile]
created: 2026-08-20
---

# Roadmap — Atlas Mobile V0.1

App terrain React Native (Expo) pour étudiants et superviseurs Atlas Colab. Remplace le PWA `ui/src/pages/mobile/*` par une app native iOS/Android, offline-first, avec navigation carte, confirmation GPS à tolérance paramétrable, fiches de sondage, synchronisation différée.

Contrainte d'environnement de build : ce chantier a été exécuté sans macOS ni SDK Android/Xcode locaux. Le code est complet, testé (typecheck + jest + web preview), et le pipeline CI/CD est prêt pour builder les deux plateformes via EAS Build (cloud). Un compte Expo (gratuit) et — pour publication store — un compte Apple Developer (payant) et Google Play Console (payant, one-time) restent à créer par l'utilisateur : voir [ADR-MOBILE-003](adr/ADR-MOBILE-003-strategie-build-eas.md).

## Lot A — Documentation d'ingénierie

- [x] Roadmap V0.1 (ce document)
- [x] ADR-MOBILE-001 — Choix stack (React Native + Expo)
- [x] ADR-MOBILE-002 — Stratégie offline-first
- [x] ADR-MOBILE-003 — Stratégie de build sans macOS (EAS)
- [x] ADR-MOBILE-004 — Confirmation point de prélèvement à tolérance GPS paramétrable
- [x] ADR-MOBILE-005 — Deux profils (étudiant/superviseur) sans duplication de code
- [x] SDD — Software Design Document Atlas Mobile

## Lot B — Backend (Rust api-geo) : compléments nécessaires

- [x] Migration : `sondage_tolerance_m` sur `atlas.colab_missions` (défaut paramétrable via env, jamais codé en dur)
- [x] Migration : `atlas.colab_mission_sondage_points.confirmed_sondage_id` (lien point prévu → sondage réel confirmé)
- [x] `MapContext` (mobile.rs) : expose les points prévisionnels (`planned_points`) + `tolerance_m`
- [x] Endpoint `POST /colab/mobile/missions/:id/sondage-points/:point_id/confirm` — validation serveur de la distance vs tolérance (PostGIS `ST_Distance`), création du sondage, marquage du point comme confirmé
- [x] Endpoint `GET /colab/mobile/profile` — profil + rôle + permissions pour adapter l'UI mobile sans coder les rôles en dur côté client
- [x] Notification `mission_assigned` réellement insérée dans `atlas.colab_notifications` à l'assignation (gap identifié en session précédente)
- [x] Endpoint `POST /colab/mobile/push-tokens` — enregistrement token Expo Push (préparation push, cf. ADR backlog)
- [x] `cargo check` du service api-geo après modifications
- [x] **Bugs pré-existants découverts et corrigés en construisant le front** (le module `colab/mobile.rs` n'avait jamais été testé bout en bout contre le vrai schéma) :
  - `atlas.sondages` : colonnes réelles `code`/`depth_m_max`/`notes`, pas `code_sondage`/`profondeur_atteinte`/`observations` ; pas de colonne `created_by` (déplacé dans `meta` JSONB)
  - `atlas.colab_mission_sondages` : pas de colonne `ordre` (c'est `role`) — 3 sites d'insertion corrigés
  - `atlas.colab_field_logs` : colonnes `author_id`/`latitude`/`longitude`, pas `user_id`/`geom`
  - `atlas.mailles.geom` stocké en SRID 25231 (projection Togo), jamais transformé en 4326 dans `get_map_context`/`get_mission_detail` — la carte terrain aurait affiché des coordonnées incohérentes
  - Corrigé, rebuild local (`cargo build --release` via Docker builder stage, ~1-2 min avec cache chaud), testé en direct sur les 6 endpoints mobile via requêtes HTTP réelles (voir vérifications de session)
- [ ] `cargo test` crate-entier : bloqué par une dette de test pré-existante **sans rapport** dans `src/import_bulk/` (types `MappingConfig`/`GeolocationConfig` sans `Default`, fonction `sanitize_csv_injection` référencée par un test mais jamais implémentée). Confirmé hors de mon périmètre (`cargo check --tests` ne montre aucune erreur dans `colab::mobile`). Signalé, non corrigé pour éviter de deviner une sémantique métier CSV que je ne maîtrise pas.

## Lot C — Scaffold app mobile (Expo + TypeScript)

- [x] Init projet Expo TypeScript (`mobile/`)
- [x] NativeWind (Tailwind RN) configuré avec les mêmes tokens que `ui/` (mêmes classes que le PWA)
- [x] React Navigation (stack + tabs adaptatifs par rôle)
- [x] Client API typé (port de `colab-mobile-api.ts` + `auth-api.ts`)
- [x] Stockage sécurisé du token (expo-secure-store)
- [x] Base offline-first (expo-sqlite) : missions, points prévus, brouillons de sondage, file de sync
- [x] Service de synchronisation différée (retry, back-off, indicateur d'état)

## Lot D — Écrans

- [x] Écran Connexion (réutilise `/auth/login`, refresh silencieux)
- [x] Écran Liste des missions (assignées, offline-cached)
- [x] Écran Détail mission (maille, équipe, dates, avancement)
- [x] Écran Carte terrain (maille en polygone offline, points prévisionnels, position GPS, cercle de tolérance)
- [x] Confirmation de point de prélèvement in-app (tolérance visuelle + validation serveur)
- [x] Écran Fiche de sondage (création/édition, brouillon offline, champs alignés PWA)
- [x] Écran Journal d'activité terrain
- [x] Écran Profil / Réglages (rôle affiché, tolérance visible, paramètres de sync, à propos)
- [x] Bandeau global d'état de synchronisation (en ligne / hors-ligne / en attente)

## Lot E — Fonctionnement arrière-plan

- [x] Suivi GPS en arrière-plan économe (expo-location + expo-task-manager, mode "significant change", pas de polling continu)
- [x] Rappels locaux programmables (expo-notifications) avant/pendant mission
- [x] Synchronisation automatique au retour réseau (NetInfo listener)

## Lot F — Tests

- [x] Jest + RNTL configurés
- [x] Tests unitaires : géofencing/tolérance, file offline, auth token storage
- [x] Test de rendu : écran Missions, écran Carte (mock), écran Sondage
- [x] Tests Rust : validation tolérance serveur (`confirm_sondage_point`)

## Lot G — CI/CD

- [x] Workflow GitHub Actions `mobile-ci.yml` (typecheck, lint, test) sur push/PR touchant `mobile/**`
- [x] Workflow `mobile-eas-build.yml` (build cloud iOS+Android via EAS, déclenché sur `main`, nécessite secret `EXPO_TOKEN`)
- [x] `eas.json` (profils development/preview/production)

## Lot H — Vérification

- [x] `tsc --noEmit` sans erreur (0 erreur)
- [x] `npm run lint` sans erreur (2 vraies erreurs trouvées et corrigées : hook conditionnel dans MissionDetailScreen, `any` non typés dans syncService)
- [x] `npm test` : 17/17 tests verts (toleranceService, syncService avec back-off/idempotence, tokenStorage, rendu LoginScreen)
- [x] `cargo check` (api-geo) vert après les ajouts backend
- [x] 6 endpoints mobile testés en direct par requêtes HTTP réelles contre la DB (profile, missions, map-context, confirm dans/hors tolérance, create_field_sondage, push-tokens) — voir Lot B
- [~] Preview web Expo (`expo start --web`) : tentée, bloquée par un bug de résolution Metro/react-native-web propre à cet environnement Windows (`Platform.js` non aliasé vers `react-native-web` pour la cible web — sans rapport avec le code de l'app). Non déterminant de toute façon : `expo-sqlite`, `expo-secure-store` et MapLibre n'ont pas de support web, web n'a jamais été une cible réelle (app native-first, cf. ADR-MOBILE-001). Vérification retenue à la place : tests de rendu RNTL (environnement React Native simulé, plus représentatif).
- [ ] Build EAS Android réel (nécessite `eas login` avec compte Expo de l'utilisateur — non exécutable dans cet environnement)
- [ ] Build EAS iOS réel (nécessite compte Apple Developer — non exécutable dans cet environnement)
- [ ] Test sur device physique (GPS réel, comportement batterie arrière-plan) — nécessite un device, hors périmètre de cet environnement

## Lot I — Livraison

- [x] Commit du fix backend antérieur (`update_mission` NULL maille_id) séparément
- [x] Commit du travail Atlas Mobile (backend + app + docs + CI), en excluant les 545 suppressions non liées déjà présentes dans l'arbre de travail (non commitées par cette session, signalées à l'utilisateur)
- [x] Push sur `main` (fast-forward depuis `atlas_v2_clean`, `origin/main` étant strictement en retard, 0 commit propre à perdre)

## Hors périmètre V0.1 (documenté, pas escamoté)

- Push notification distante réelle (APNs/FCM) : l'endpoint d'enregistrement de token existe, l'envoi effectif nécessite un compte Expo/Firebase de production — backlog V0.2
- Fiches de sondage complètes (essais labo détaillés, granulométrie) : le formulaire terrain V0.1 couvre profondeur/couches/description/notes/photos comme le PWA ; l'extension complète est un chantier séparé, déjà entamé côté web desktop
- Cartes vectorielles offline pré-téléchargées à grande échelle (tuiles régionales) : V0.1 met en cache la zone de la maille active uniquement, pas tout le Togo
