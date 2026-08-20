---
status: active
type: sdd
revision: V0.1
project: atlas / atlas-mobile
author: Serge TABE DJATO
tags: [atlas, mobile, sdd, react-native]
aliases: [SDD Atlas Mobile]
created: 2026-08-20
---

# SDD — Atlas Mobile V0.1

Document de conception logicielle de l'app terrain Atlas. Complète les décisions figées dans [ADR-MOBILE-001 à 005](adr/). Voir [Roadmap V0.1](ROADMAP_ATLAS_MOBILE_V0.1.md) pour l'état d'avancement.

## 1. Vue d'ensemble

```
┌─────────────────────────────┐        ┌──────────────────────────────┐
│   mobile/ (Expo, TS)         │        │  services/api-geo (Rust)      │
│                               │        │                                │
│  Écrans ──▶ RoleContext       │        │  colab::mobile (routes)       │
│    │           │              │  HTTPS │    │                          │
│    ▼           ▼              │◀──────▶│    ▼                          │
│  Repository (SQLite local)    │        │  atlas.colab_missions          │
│    │                          │        │  atlas.colab_mission_sondage_  │
│    ▼                          │        │    points                      │
│  SyncQueue ──▶ SyncService    │        │  atlas.sondages                │
│                (NetInfo)      │        │  atlas.colab_notifications     │
└─────────────────────────────┘        └──────────────────────────────┘
```

Principe directeur (ADR-MOBILE-002) : un écran ne parle jamais au réseau directement. Il lit/écrit le repository local ; le `SyncService` est seul responsable du dialogue réseau.

## 2. Arborescence du projet

```
mobile/
  app.json                 # config Expo (nom, icônes, permissions)
  eas.json                 # profils de build EAS (ADR-MOBILE-003)
  package.json
  tsconfig.json
  babel.config.js
  App.tsx                  # racine : providers + navigation
  src/
    api/
      client.ts            # fetch authentifié, refresh transparent
      auth.ts               # login/refresh/me (port de auth-api.ts)
      mobile.ts             # missions/map-context/sync/profile (port de colab-mobile-api.ts)
    db/
      schema.ts             # DDL SQLite + migrations locales
      repository.ts         # DAO missions/points/sondages/queue
    services/
      syncService.ts        # file de sync, back-off, écoute réseau
      locationService.ts    # GPS foreground + background task
      notificationService.ts# rappels locaux (expo-notifications)
      toleranceService.ts   # calcul distance/tolérance (haversine)
    context/
      AuthContext.tsx
      RoleContext.tsx        # ADR-MOBILE-005
      SyncStatusContext.tsx
    navigation/
      RootNavigator.tsx
      routes.ts              # déclaration de routes + permission requise
    screens/
      LoginScreen.tsx
      MissionsListScreen.tsx
      MissionDetailScreen.tsx
      MissionMapScreen.tsx
      SondageFormScreen.tsx
      ActivityScreen.tsx
      ProfileScreen.tsx
    components/
      SyncStatusBanner.tsx
      MissionCard.tsx
      StatusBadge.tsx
      TolerancePointMarker.tsx
      PrimaryButton.tsx / TextField.tsx / ...
    theme/
      tokens.ts              # couleurs/espacements = mêmes valeurs Tailwind que ui/
  __tests__/
    toleranceService.test.ts
    syncService.test.ts
    repository.test.ts
    screens/MissionsListScreen.test.tsx
```

## 3. Modèle de données local (SQLite)

```sql
CREATE TABLE missions (
  id TEXT PRIMARY KEY, code TEXT, title TEXT, theme TEXT, status TEXT,
  start_date TEXT, end_date TEXT, maille_id TEXT, maille_label TEXT,
  commune TEXT, region TEXT, expected_sondages INTEGER, completed_sondages INTEGER,
  percent_done REAL, tolerance_m INTEGER, synced_at TEXT
);

CREATE TABLE mission_planned_points (
  id TEXT PRIMARY KEY, mission_id TEXT, numero INTEGER, label TEXT,
  lat REAL, lon REAL, confirmed_sondage_id TEXT,
  FOREIGN KEY(mission_id) REFERENCES missions(id)
);

CREATE TABLE sondages_draft (
  client_id TEXT PRIMARY KEY, mission_id TEXT, planned_point_id TEXT,
  longitude REAL, latitude REAL, location_accuracy_m REAL,
  depth_m REAL, layers_count INTEGER, profile_description TEXT, notes TEXT,
  status TEXT,                     -- 'draft' | 'queued' | 'synced' | 'failed'
  server_id TEXT, created_at TEXT
);

CREATE TABLE sync_queue (
  client_id TEXT PRIMARY KEY, action_type TEXT, payload TEXT,
  attempts INTEGER DEFAULT 0, last_error TEXT, created_at TEXT
);

CREATE TABLE field_logs_draft (
  client_id TEXT PRIMARY KEY, mission_id TEXT, log_type TEXT,
  content TEXT, longitude REAL, latitude REAL, status TEXT, created_at TEXT
);

CREATE TABLE app_settings (
  key TEXT PRIMARY KEY, value TEXT   -- profil rôle en cache, dernière sync, etc.
);
```

Migration versionnée par `PRAGMA user_version` (cf. `db/schema.ts`).

## 4. Contrats API (backend existant + ajouts de ce chantier)

| Méthode | Route | État |
|---|---|---|
| POST | `/auth/login` | existant, réutilisé tel quel |
| POST | `/auth/refresh` | existant, réutilisé tel quel |
| GET | `/colab/mobile/missions` | existant, réutilisé tel quel |
| GET | `/colab/mobile/missions/:id` | existant, réutilisé tel quel |
| GET | `/colab/mobile/missions/:id/map-context` | **étendu** : `+planned_points[]`, `+tolerance_m` |
| POST | `/colab/mobile/missions/:id/sondages` | existant, réutilisé tel quel |
| POST | `/colab/mobile/missions/:id/sondage-points/:point_id/confirm` | **nouveau** (ADR-MOBILE-004) |
| POST | `/colab/mobile/sync` | existant, réutilisé tel quel |
| POST | `/colab/mobile/tracks`, `/tracks/:id/points`, `/tracks/:id/stop` | existant, réutilisé tel quel |
| GET | `/colab/mobile/profile` | **nouveau** (ADR-MOBILE-005) |
| POST | `/colab/mobile/push-tokens` | **nouveau** (préparation push V0.2) |

### `GET /colab/mobile/missions/:id/map-context` (étendu)

```jsonc
{
  "mission_id": "uuid",
  "maille_geojson": { "type": "Polygon", "coordinates": [...] },
  "center_lon": 1.23, "center_lat": 6.17,
  "bbox": { "min_x": ..., "max_x": ..., ... },
  "tolerance_m": 15,
  "planned_points": [
    { "id": "uuid", "numero": 1, "label": "S1", "lat": 6.171, "lon": 1.228, "confirmed_sondage_id": null }
  ],
  "existing_sondages": [ { "id": "uuid", "code": "S-...", "longitude": ..., "latitude": ..., "status": "validated" } ]
}
```

### `POST /colab/mobile/missions/:id/sondage-points/:point_id/confirm`

Requête : `{ longitude, latitude, location_accuracy_m?, depth_m?, layers_count?, profile_description?, notes? }`
Réponse succès (`201`) : `{ id, code_sondage, distance_m, tolerance_m, message }`
Réponse hors tolérance (`422`) : `{ error: "Hors tolérance", distance_m, tolerance_m }` — le serveur refuse, l'app propose alors "Enregistrer comme sondage libre" (hors point prévu) plutôt que de bloquer l'opérateur.

### `GET /colab/mobile/profile`

```jsonc
{ "user_id": "uuid", "role": ["student"], "first_name": "...", "last_name": "...",
  "permissions": ["sondage.create", "mission.view_own"] }
```

## 5. Flux de synchronisation

```
[Écran] écrit repository.saveDraft() ──▶ SQLite (status=draft)
                                          │
                              repository.enqueue() ──▶ sync_queue (status=queued)
                                          │
NetInfo "online" OU retour au premier plan OU pull-to-refresh
                                          │
                                          ▼
                        SyncService.flush()
                          for batch in sync_queue (par lots de 20) :
                            POST /colab/mobile/sync { actions: [...] }
                            pour chaque résultat :
                              success  → repository.markSynced(client_id, server_id)
                              failed   → attempts++, back-off (2^attempts s, max 5 min)
```

Le bandeau global (`SyncStatusBanner`) reflète l'état agrégé : `à jour` / `N en attente` / `hors-ligne` / `erreur (voir détail)`.

## 6. Suivi GPS en arrière-plan

`expo-location` en mode `Location.startLocationUpdatesAsync` avec `accuracy: Balanced`, `deferredUpdatesInterval` et `distanceInterval` réglés pour ne remonter un point que sur déplacement significatif (pas de polling à fréquence fixe) — objectif explicite du porteur de produit : pas de surconsommation batterie. Le suivi n'est actif que pendant une mission "en cours" démarrée explicitement par l'utilisateur (bouton "Démarrer trace"), jamais en permanence en tâche de fond dès l'installation.

## 7. Sécurité

- Token JWT + refresh token stockés via `expo-secure-store` (Keychain iOS / Keystore Android), jamais AsyncStorage en clair.
- Toute requête authentifiée passe par `api/client.ts`, seul point d'injection du header `Authorization`, avec retry-on-401 identique au comportement web (`fetchWithAuth`).
- La tolérance GPS est revalidée côté serveur (ADR-MOBILE-004) — le client n'est jamais source de vérité pour une donnée qui a valeur de preuve terrain.

## 8. Design système (cohérence avec `ui/`)

`ui/` n'a pas de palette Tailwind custom (`tailwind.config.js` utilise le thème par défaut). `mobile/src/theme/tokens.ts` réexporte donc les mêmes valeurs par défaut Tailwind utilisées telles quelles dans le PWA (`blue-600 #2563eb`, `gray-50 #f9fafb`, `green-500 #22c55e`, `yellow-500 #eab308`, `red-500 #ef4444`, rayon `rounded-xl` = 12px), consommées via des styles React Native inline (`StyleSheet`/objets `style`) plutôt que NativeWind : la tentative NativeWind cassait la transformation Babel des tests Jest (conflit PostCSS async) pour un bénéfice nul ici — aucun composant n'utilisait de syntaxe `className`, seulement des tokens. Retiré avant de laisser une dépendance inutilisée. Icônes `lucide-react-native` (même set que `lucide-react` côté web).

## 9. Tests

- **Unitaires** : `toleranceService` (calcul haversine vs cas limites), `syncService` (back-off, idempotence), `repository` (CRUD SQLite en mémoire).
- **Rendu** : écrans clés avec mocks de repository/API (`@testing-library/react-native`).
- **Backend** : test Rust du calcul de distance/tolérance de `confirm_sondage_point`.

## 10. Ce que ce document ne couvre pas (backlog explicite)

Push notifications distantes réelles, fiches de sondage labo complètes, cartes régionales pré-téléchargées — voir section "Hors périmètre V0.1" de la roadmap.
