# 🏗️ IMPLEMENTATION - Gestionnaire de Sondages v2

**Date de début** : 2025-11-21  
**Objectif** : Système de géocodage complet avec temps réel

---

## 📐 ARCHITECTURE GLOBALE

```
┌─────────────────────────────────────────────────────────────┐
│                    ATLAS GÉOTECHNIQUE                        │
├─────────────────────────────────────────────────────────────┤
│                                                               │
│  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐  │
│  │   UI/VITE    │◄──►│  API RUST    │◄──►│  POSTGRES    │  │
│  │              │    │              │    │              │  │
│  │ • Page       │    │ • REST       │    │ • sondages   │  │
│  │   /sondages  │    │ • WebSocket  │    │ • adm3       │  │
│  │ • Carte      │    │ • Géocodage  │    │ • geocode_   │  │
│  │   Leaflet    │    │ • Suggestions│    │   suggestions│  │
│  └──────────────┘    └──────────────┘    └──────────────┘  │
│         ▲                    ▲                               │
│         │                    │                               │
│         └────────────────────┘                               │
│              WebSocket /ws                                   │
│         (événements temps réel)                              │
└─────────────────────────────────────────────────────────────┘
```

---

## 🗄️ MODÈLE DE DONNÉES

### Table `public.sondages` (canonique)

```sql
-- Colonnes CANONIQUES (à utiliser)
id              UUID PRIMARY KEY
code            TEXT NOT NULL              -- Code sondage (code_site Excel)
localite_base   TEXT                       -- Localité brute Excel
localite_key    TEXT                       -- Localité normalisée (UPPER, sans accents)
adm3_id         INTEGER                    -- FK vers adm3
adm3_name       TEXT                       -- Nom ADM3
geom            GEOMETRY(Point, 4326)      -- Géométrie WGS84
location_mode   TEXT                       -- 'unknown', 'exact', 'centroid', 'adm3'
is_geocoded     BOOLEAN DEFAULT false      -- Statut géocodage
meta            JSONB                      -- Métadonnées diverses
date            DATE                       -- Date du sondage
source          TEXT                       -- Source/auteur
created_at      TIMESTAMPTZ
updated_at      TIMESTAMPTZ
deleted_at      TIMESTAMPTZ                -- Soft delete

-- Index
CREATE INDEX idx_sondages_code ON public.sondages(code);
CREATE INDEX idx_sondages_localite_key ON public.sondages(localite_key);
CREATE INDEX idx_sondages_adm3_id ON public.sondages(adm3_id);
CREATE INDEX idx_sondages_geom ON public.sondages USING GIST(geom);
CREATE INDEX idx_sondages_is_geocoded ON public.sondages(is_geocoded);
```

### Table `atlas.geocode_suggestions`

```sql
CREATE TABLE atlas.geocode_suggestions (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    sondage_id      UUID NOT NULL REFERENCES public.sondages(id),
    reason          TEXT NOT NULL,              -- 'adm3_from_excel', 'localite_match'
    status          TEXT NOT NULL DEFAULT 'pending', -- 'pending', 'done', 'rejected'
    payload         JSONB NOT NULL,             -- Données de la suggestion
    score           NUMERIC(5,2),               -- Score de confiance 0-100
    created_at      TIMESTAMPTZ DEFAULT now(),
    updated_at      TIMESTAMPTZ DEFAULT now()
);

-- Payload structure
{
    "adm3_id": "123",
    "adm3_name": "Lomé",
    "adm3_original_text": "LOME",
    "source": "adm3_from_excel",
    "score": 95.5
}
```

---

## 🔄 FLUX DE GÉOCODAGE

### Scénario 1 : Géocodage manuel ADM3

```
1. Utilisateur sélectionne sondage sans géométrie
2. Choisit "ADM3 (Commune)" dans le select
3. Sélectionne une commune dans la liste
4. Clique "Enregistrer le géocodage"
   ↓
5. Frontend → POST /sondages/:id/geocode { mode: "adm3", adm3_id: "..." }
   ↓
6. Backend :
   - Récupère centroïde de l'ADM3
   - UPDATE sondages SET geom = centroid, adm3_id = ..., location_mode = 'adm3', is_geocoded = true
   - Broadcast WebSocket : { event: "sondage.geocoded", data: { id, adm3_id } }
   ↓
7. Tous les clients reçoivent l'événement
   - Rafraîchissent la liste "Sans géométrie"
   - Mettent à jour les compteurs
   - Rafraîchissent la carte si nécessaire
```

### Scénario 2 : Géocodage via suggestions

```
1. Système génère suggestions basées sur :
   - ADM3 fournie dans Excel (meta->>'adm3_excel')
   - Localité (localite_key)
   - Matching fuzzy (Levenshtein)
   ↓
2. Utilisateur ouvre onglet "Suggestions ADM"
3. Voit liste de sondages avec candidats ADM3
4. Pour chaque candidat :
   - Clique "œil" → carte zoom + clignotement ADM3
   - Clique "Géocoder" → accepte la suggestion
   ↓
5. Frontend → POST /geocode/suggestions/:id/accept
   ↓
6. Backend :
   - Applique le géocodage (comme scénario 1)
   - Marque suggestion status = 'done'
   - Broadcast WebSocket
   ↓
7. Tous les clients se synchronisent
```

---

## 🛠️ IMPLÉMENTATION TECHNIQUE

### Phase 1 : Nettoyage des données

**Fichier** : `db/migrations/032_cleanup_sondages_codes.sql`

```sql
BEGIN;

-- 1. Remplir code depuis meta->>'code' quand disponible
UPDATE public.sondages
SET code = meta->>'code'
WHERE (code IS NULL OR code LIKE 'AUTO_%')
  AND meta->>'code' IS NOT NULL
  AND meta->>'code' != '';

-- 2. Remplir localite_base depuis meta->>'localite'
UPDATE public.sondages
SET localite_base = meta->>'localite'
WHERE localite_base IS NULL
  AND meta->>'localite' IS NOT NULL
  AND meta->>'localite' != '';

-- 3. Générer localite_key (normalisée)
UPDATE public.sondages
SET localite_key = UPPER(REGEXP_REPLACE(
    unaccent(localite_base), 
    '[^A-Z0-9]+', 
    '', 
    'g'
))
WHERE localite_base IS NOT NULL
  AND (localite_key IS NULL OR localite_key = '');

-- 4. Pour les orphelins : AUTO_<id>
UPDATE public.sondages
SET code = CONCAT('AUTO_', id::text)
WHERE code IS NULL;

-- 5. Contrainte NOT NULL
ALTER TABLE public.sondages
ALTER COLUMN code SET NOT NULL;

-- 6. Stats finales
SELECT 
    COUNT(*) as total,
    COUNT(*) FILTER (WHERE code LIKE 'AUTO_%') as auto_codes,
    COUNT(*) FILTER (WHERE localite_base IS NOT NULL) as with_localite,
    COUNT(*) FILTER (WHERE is_geocoded = true) as geocoded
FROM public.sondages;

COMMIT;
```

**Exécution** :
```bash
docker exec atlas-db psql -U atlas -d atlas_clean -f /migrations/032_cleanup_sondages_codes.sql
```

---

### Phase 2 : Backend - Endpoint géocodage manuel

**Fichier** : `services/api-geo/src/geocode_manual.rs`

```rust
use axum::{extract::{Path, State}, Json};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Deserialize)]
pub struct GeocodeManualRequest {
    pub mode: GeocodeMode,
}

#[derive(Debug, Deserialize)]
#[serde(tag = "mode", rename_all = "lowercase")]
pub enum GeocodeMode {
    Adm3 { adm3_id: i32 },
    Coords { lon: f64, lat: f64 },
}

#[derive(Debug, Serialize)]
pub struct GeocodeManualResponse {
    pub id: Uuid,
    pub code: String,
    pub location_mode: String,
    pub is_geocoded: bool,
}

pub async fn geocode_manual(
    State(state): State<AppState>,
    Path(id): Path<Uuid>,
    Json(payload): Json<GeocodeManualRequest>,
) -> Result<Json<GeocodeManualResponse>, (StatusCode, String)> {
    let pool = &state.pool;
    
    match payload.mode {
        GeocodeMode::Adm3 { adm3_id } => {
            // Géocodage par centroïde ADM3
            let result = sqlx::query_as::<_, (Uuid, String, String, bool)>(
                r#"
                UPDATE public.sondages s
                SET 
                    geom = ST_Centroid(a.geom),
                    adm3_id = $2,
                    adm3_name = a.name,
                    location_mode = 'adm3',
                    is_geocoded = true,
                    updated_at = now()
                FROM adm3 a
                WHERE a.id = $2 AND s.id = $1
                RETURNING s.id, s.code, s.location_mode, s.is_geocoded
                "#
            )
            .bind(id)
            .bind(adm3_id)
            .fetch_one(pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            
            // Broadcast WebSocket
            let _ = state.broadcast_tx.send(WsEvent {
                event: "sondage.geocoded".to_string(),
                data: serde_json::json!({
                    "id": result.0,
                    "code": result.1,
                    "adm3_id": adm3_id,
                }),
            });
            
            Ok(Json(GeocodeManualResponse {
                id: result.0,
                code: result.1,
                location_mode: result.2,
                is_geocoded: result.3,
            }))
        }
        
        GeocodeMode::Coords { lon, lat } => {
            // Géocodage par coordonnées exactes
            let result = sqlx::query_as::<_, (Uuid, String, String, bool)>(
                r#"
                UPDATE public.sondages
                SET 
                    geom = ST_SetSRID(ST_MakePoint($2, $3), 4326),
                    location_mode = 'exact',
                    is_geocoded = true,
                    updated_at = now()
                WHERE id = $1
                RETURNING id, code, location_mode, is_geocoded
                "#
            )
            .bind(id)
            .bind(lon)
            .bind(lat)
            .fetch_one(pool)
            .await
            .map_err(|e| (StatusCode::INTERNAL_SERVER_ERROR, e.to_string()))?;
            
            // Broadcast WebSocket
            let _ = state.broadcast_tx.send(WsEvent {
                event: "sondage.geocoded".to_string(),
                data: serde_json::json!({
                    "id": result.0,
                    "code": result.1,
                    "lon": lon,
                    "lat": lat,
                }),
            });
            
            Ok(Json(GeocodeManualResponse {
                id: result.0,
                code: result.1,
                location_mode: result.2,
                is_geocoded: result.3,
            }))
        }
    }
}
```

**Enregistrement route** dans `main.rs` :
```rust
.route("/sondages/:id/geocode", post(geocode_manual::geocode_manual))
```

---

### Phase 3 : Backend - WebSocket

**Fichier** : `services/api-geo/src/websocket.rs`

```rust
use axum::{
    extract::{ws::WebSocket, State, WebSocketUpgrade},
    response::Response,
};
use futures::{sink::SinkExt, stream::StreamExt};
use tokio::sync::broadcast;

#[derive(Clone, Debug, serde::Serialize)]
pub struct WsEvent {
    pub event: String,
    pub data: serde_json::Value,
}

pub async fn ws_handler(
    ws: WebSocketUpgrade,
    State(state): State<AppState>,
) -> Response {
    ws.on_upgrade(|socket| handle_socket(socket, state))
}

async fn handle_socket(socket: WebSocket, state: AppState) {
    let (mut sender, mut receiver) = socket.split();
    let mut rx = state.broadcast_tx.subscribe();
    
    // Task pour envoyer les événements broadcast
    let mut send_task = tokio::spawn(async move {
        while let Ok(event) = rx.recv().await {
            let json = serde_json::to_string(&event).unwrap();
            if sender.send(axum::extract::ws::Message::Text(json)).await.is_err() {
                break;
            }
        }
    });
    
    // Task pour recevoir (ping/pong)
    let mut recv_task = tokio::spawn(async move {
        while let Some(Ok(msg)) = receiver.next().await {
            if matches!(msg, axum::extract::ws::Message::Close(_)) {
                break;
            }
        }
    });
    
    // Attendre que l'une des tasks se termine
    tokio::select! {
        _ = (&mut send_task) => recv_task.abort(),
        _ = (&mut recv_task) => send_task.abort(),
    }
}
```

**AppState** modifié :
```rust
pub struct AppState {
    pub pool: PgPool,
    pub broadcast_tx: broadcast::Sender<WsEvent>,
}

// Dans main.rs
let (broadcast_tx, _) = broadcast::channel::<WsEvent>(100);

let state = AppState {
    pool: pool.clone(),
    broadcast_tx,
};
```

---

### Phase 4 : Frontend - Module temps réel

**Fichier** : `ui/src/realtime.ts`

```typescript
type EventHandler = (data: any) => void;

class RealtimeClient {
  private ws: WebSocket | null = null;
  private handlers: Map<string, EventHandler[]> = new Map();
  private reconnectTimeout: number | null = null;
  private url: string;

  constructor(url: string) {
    this.url = url;
  }

  connect() {
    if (this.ws?.readyState === WebSocket.OPEN) return;

    this.ws = new WebSocket(this.url);

    this.ws.onopen = () => {
      console.log('[REALTIME] Connected');
      if (this.reconnectTimeout) {
        clearTimeout(this.reconnectTimeout);
        this.reconnectTimeout = null;
      }
    };

    this.ws.onmessage = (event) => {
      try {
        const { event: eventName, data } = JSON.parse(event.data);
        this.emit(eventName, data);
      } catch (e) {
        console.error('[REALTIME] Parse error:', e);
      }
    };

    this.ws.onclose = () => {
      console.log('[REALTIME] Disconnected, reconnecting...');
      this.reconnectTimeout = window.setTimeout(() => this.connect(), 3000);
    };

    this.ws.onerror = (error) => {
      console.error('[REALTIME] Error:', error);
    };
  }

  on(eventName: string, handler: EventHandler) {
    if (!this.handlers.has(eventName)) {
      this.handlers.set(eventName, []);
    }
    this.handlers.get(eventName)!.push(handler);
  }

  off(eventName: string, handler: EventHandler) {
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index > -1) handlers.splice(index, 1);
    }
  }

  private emit(eventName: string, data: any) {
    const handlers = this.handlers.get(eventName);
    if (handlers) {
      handlers.forEach(h => h(data));
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
    }
  }
}

// Singleton
let client: RealtimeClient | null = null;

export function connectRealtime(apiUrl: string) {
  if (!client) {
    const wsUrl = apiUrl.replace('http://', 'ws://').replace('https://', 'wss://') + '/ws';
    client = new RealtimeClient(wsUrl);
    client.connect();
  }
  return client;
}

export function onEvent(eventName: string, handler: EventHandler) {
  if (client) {
    client.on(eventName, handler);
  }
}

export function offEvent(eventName: string, handler: EventHandler) {
  if (client) {
    client.off(eventName, handler);
  }
}
```

**Intégration dans `main.ts`** :
```typescript
import { connectRealtime, onEvent } from './realtime';

// Après init de l'API
const realtimeClient = connectRealtime(API_GEO);

// Écouter les événements
onEvent('sondage.geocoded', (data) => {
  console.log('[REALTIME] Sondage géocodé:', data);
  // Rafraîchir les listes si nécessaire
  window.dispatchEvent(new CustomEvent('sondage-updated', { detail: data }));
});

onEvent('sondage.created', (data) => {
  console.log('[REALTIME] Nouveau sondage:', data);
  window.dispatchEvent(new CustomEvent('sondage-created', { detail: data }));
});
```

---

## 📊 MÉTRIQUES & MONITORING

### Logs à surveiller

```
[GEOCODE] Manual geocode: sondage_id=xxx, mode=adm3, adm3_id=123
[GEOCODE] Suggestion accepted: suggestion_id=xxx, sondage_id=yyy
[WEBSOCKET] Client connected: total=5
[WEBSOCKET] Event broadcast: event=sondage.geocoded, clients=5
```

### KPIs

- Nombre de sondages géocodés / jour
- Taux d'acceptation des suggestions
- Temps moyen de géocodage manuel
- Nombre de clients WebSocket connectés

---

## 🧪 TESTS

### Tests unitaires backend

```rust
#[tokio::test]
async fn test_geocode_manual_adm3() {
    // Créer sondage test
    // Appeler geocode_manual avec adm3_id
    // Vérifier geom, adm3_id, location_mode, is_geocoded
}

#[tokio::test]
async fn test_geocode_manual_coords() {
    // Créer sondage test
    // Appeler geocode_manual avec lon/lat
    // Vérifier geom, location_mode
}
```

### Tests E2E frontend

```typescript
describe('Géocodage manuel', () => {
  it('devrait géocoder un sondage par ADM3', async () => {
    // Sélectionner sondage sans géométrie
    // Choisir mode ADM3
    // Sélectionner commune
    // Cliquer "Enregistrer"
    // Vérifier que le sondage disparaît de la liste
  });
});
```

---

## 📅 PLANNING

| Phase | Durée estimée | Statut |
|-------|---------------|--------|
| 1. Nettoyage données | 1h | 🔵 À faire |
| 2. Backend géocodage | 2h | 🔵 À faire |
| 3. Backend WebSocket | 1h | 🔵 À faire |
| 4. Frontend temps réel | 1h | 🔵 À faire |
| 5. Tests & validation | 2h | 🔵 À faire |
| 6. Refactor UI (page) | 3h | 🔵 À faire |
| **TOTAL** | **10h** | |

---

**Dernière mise à jour** : 2025-11-21  
**Responsable** : Équipe Atlas  
**Statut** : 🟡 En cours d'implémentation
Globalement ton plan est **très solide** : on n’est plus dans le flou, mais dans quelque chose que tu pourrais réellement implémenter.
Je dirais qu’il est **“complet à 80-90 %”** pour une v2, et qu’il manque surtout quelques **précisions** et **garde-fous** plutôt que des gros morceaux.

Je te propose des améliorations **ciblées**, sans casser ce que tu as déjà écrit.

---

## 1️⃣ Ce qui est déjà très bien (et que je garderais)

* ✅ **Architecture générale** UI ↔ API Rust ↔ Postgres + WebSocket : c’est propre et réaliste.
* ✅ **Table `public.sondages` canonique** avec `code`, `localite_base`, `localite_key`, `adm3_id`, `geom`, `location_mode`, `is_geocoded`, `meta`, etc. → ça colle bien à ton usage géotechnique.
* ✅ **Table `atlas.geocode_suggestions`** avec `reason`, `score`, `payload` → très bien pour les suggestions multiples avec pourcentage de confiance.
* ✅ **Deux scénarios de géocodage** clairs :

  * Géocodage manuel ADM3 / coordonnées,
  * Géocodage via suggestions.
* ✅ **Nettoyage des données** (remonter `code` et `localite_base` depuis `meta` + générer `localite_key`).
* ✅ **WebSocket** basé sur `tokio::sync::broadcast` + client unique côté UI → parfait pour un déploiement local/mono-instance.
* ✅ **Temps réel** pensé dès maintenant (événement `sondage.geocoded` etc.), ce qui respecte ton idée initiale “mise à jour auto depuis n’importe quelle machine”.

Donc on ne va pas tout changer. On améliore.

---

## 2️⃣ Améliorations côté données / modèle

### 2.1. Bien fixer **où** est la table canonique

Dans la réalité de ton Atlas :

* tu as déjà `public.sondages` **et** des tables/vues dans le schéma `atlas` (`v_sondages_unifies`, etc.) ;
* l’API actuelle tape sur `public.sondages`.

👉 Ton plan suppose que **`public.sondages` devient bien la table canonique** pour le gestionnaire de sondages.
C’est OK, mais **écris-le noir sur blanc** dans la doc, et vérifie que :

* toutes les nouvelles requêtes Rust utilisent **bien `public.sondages`** (pas `atlas.surveys`) ;
* les vues type `v_sondages_unifies` sont rafraîchies à partir de cette table (ce que fait déjà ton SQL de refresh).

### 2.2. `code` : contraintes + sémantique

Tu proposes `code TEXT NOT NULL`.
Je te suggère :

* ajouter **une contrainte de quasi-unicité** :

  * soit `UNIQUE (code)` si tu veux un code global,
  * soit `UNIQUE (code, source)` si tu peux avoir le même code dans deux campagnes différentes.
* garder la convention `AUTO_<uuid>` uniquement pour les codes orphelins – ce que tu fais déjà dans le script 👍

Ça te donne :

```sql
ALTER TABLE public.sondages
ADD CONSTRAINT sondages_code_source_uniq UNIQUE (code, source);
```

### 2.3. `location_mode` : clarifier les valeurs

Plutôt que `TEXT` libre, je te conseille de **fixer un petit vocabulaire** (même si tu ne crées pas encore un type enum Postgres) :

* `'unknown'`
* `'exact_gps'` (coords exactes)
* `'adm3_centroid'`
* éventuellement plus tard `'localite_centroid'`

Et de l’utiliser **partout** (backend + DB) pour éviter les typos.

---

## 3️⃣ Améliorations backend géocodage / suggestions

### 3.1. Endpoint `/sondages/:id/geocode`

Ton Rust est déjà bien structuré. Je proposerais juste :

1. **Gérer ADM3 manquante ou incohérente**

   * Si l’`adm3_id` n’existe pas → retourner un `400` clair (`"ADM3 introuvable"`).

2. **Pour les coords**, essayer de **déduire l’ADM3** :

   ```sql
   SELECT id, name
   FROM adm3
   WHERE ST_Contains(geom, ST_SetSRID(ST_MakePoint($lon, $lat), 4326))
   LIMIT 1;
   ```

   et si trouvé → remplir `adm3_id`, `adm3_name` en plus de `geom`.

3. **Audit** : tu as déjà des tables `audit_log`.
   Ajoute un petit log à chaque géocodage :

   ```sql
   INSERT INTO atlas.audit_log (entity, entity_id, action, details, created_at)
   VALUES ('sondage', $id, 'geocode', json_build_object(...), now());
   ```

   Ça te sera utile pour retracer qui a géocodé quoi.

### 3.2. Génération des suggestions (pièce un peu manquante)

Ta spec décrit bien la **table `geocode_suggestions`**, mais pas **qui la remplit**.

Je te propose d’ajouter une petite phase “2b – Script de génération des suggestions” :

* un script Python ou SQL qui :

  1. parcourt les sondages avec `location_mode = 'unknown'`,
  2. regarde dans `meta` si tu as un champ type `adm3_excel` ou `prefecture_excel`,
  3. tente des matches :

     * match direct sur un code ADM3,
     * match fuzzy sur `localite_key` vs `adm3.name_normalized`,
  4. crée 1..N suggestions dans `atlas.geocode_suggestions` avec un `score`.

Ça permet de concrétiser ce que tu décris :

> "parfois l’ADM3 de la fiche Excel est fausse → on propose des candidats avec probabilité".

---

## 4️⃣ Améliorations UI / UX (gestionnaire & carte ADM3)

### 4.1. Passage du modal → page `/sondages`

Ton planning mentionne “Refactor UI (page) : 3h”, mais sans détail.

Je formaliserais un peu :

* **Nouvelle route** (ex. via hash) : `#/sondages`
* Quand on clique sur le bouton “Sondages” dans la UI principale :

  * au lieu d’ouvrir un modal, on change juste d’URL → on affiche **la page Gestionnaire**.
* Layout de la page `/sondages` :

  * **Colonne gauche (inchangée)** : les onglets “Nouveau”, “Import Wizard”, “Liste”, “Géocodage amélioré”, “Suggestions ADM”.
  * **Centre** : tu réutilises **exactement** les panneaux actuels du modal (pas de redesign).
  * **Droite** : une **carte Leaflet dédiée**, avec :

    * couche ADM3 (polygones),
    * éventuellement un fond OSM plus léger,
    * synchronisation avec le panneau central.

### 4.2. Eye icon / highlight ADM3

Tu en parles dans ton message, le plan ne le détaille pas.
J’ajouterais clairement :

* Dans l’onglet **Suggestions ADM** :

  * chaque candidat ADM3 a un bouton “👁”,
  * au clic :

    * on zoome sur le polygone ADM3,
    * on applique un style spécial (jaune/épais),
    * on le fait “clignoter” 3–5 fois via `setTimeout` (toggle entre style normal / surligné).

Pseudo-code Leaflet :

```ts
function highlightAdm3(adm3Id: number) {
  const layer = adm3LayerById[adm3Id];
  if (!layer) return;

  map.fitBounds(layer.getBounds());

  let count = 0;
  const originalStyle = {...};
  const highlightStyle = {...};

  const interval = setInterval(() => {
    if (count >= 5) {
      layer.setStyle(originalStyle);
      clearInterval(interval);
      return;
    }
    layer.setStyle(count % 2 === 0 ? highlightStyle : originalStyle);
    count++;
  }, 400);
}
```

---

## 5️⃣ WebSocket / Temps réel : deux petits plus

Ton design est bon, je rajouterais juste :

1. **Événements distincts**
   Documenter 3-4 types :

   * `sondage.created`
   * `sondage.updated`
   * `sondage.geocoded`
   * plus tard `mailles.coverage_updated`

   Et dans l’UI, tu peux décider :

   * sur `sondage.geocoded` :

     * MAJ du compteur “Sans géométrie”,
     * si l’onglet “Géocodage amélioré” ou “Suggestions ADM” est ouvert → rechargement léger.

2. **Déconnexion propre**
   Dans `realtime.ts`, quand tu quittes la page `/sondages`, tu peux appeler `disconnect()` si tu veux limiter le bruit.
   (Ce n’est pas obligatoire pour une v2 locale, mais propre.)

---

## 6️⃣ Roadmap ajustée (version finale)

Je te propose juste de reformuler ton planning avec ces ajouts :

1. **Phase 1 – Données & migration**

   * Nettoyer `public.sondages` (code, localite_base, localite_key).
   * Ajouter contraintes (`NOT NULL`, `UNIQUE (code, source)` si tu la veux).
   * Vérifier que les vues unifiées sont OK.

2. **Phase 2 – Géocodage manuel (backend + UI)**

   * Implémenter `/sondages/:id/geocode` (ADM3 + coords).
   * Brancher le bouton “Enregistrer le géocodage” dans **Géocodage Amélioré**.
   * Ajouter audit.

3. **Phase 3 – Suggestions ADM**

   * Créer script de génération de `geocode_suggestions` (meta Excel + fuzzy).
   * Brancher `/geocode/suggestions/:id/accept` + rejet.
   * Connecter le bouton “Géocoder” de l’onglet Suggestions ADM.
   * Implémenter l’“œil” + highlight de l’ADM3 sur la carte.

4. **Phase 4 – Temps réel WebSocket**

   * Endpoint `/ws` + `WsEvent`.
   * Envoi d’events depuis les handlers (create / geocode).
   * Module `realtime.ts` + rafraîchissement des listes / carte.

5. **Phase 5 – Refactor UI /sondages**

   * Créer la page `/sondages` avec le même layout que le modal.
   * Déplacer les panneaux centraux existants vers cette page.
   * Ajouter la carte ADM3 à droite.

---

🎯 **Conclusion courte**

* Ton plan n’est pas “faux” ni à réécrire : il est déjà **très bon** pour une v2.
* Les améliorations que je propose :

  * préciser la **source canonique** (`public.sondages`),
  * verrouiller quelques détails de **données** (contrainte, vocabulaires),
  * documenter **qui génère les suggestions**,
  * détailler un peu plus la **page `/sondages`** et l’interaction avec la carte,
  * raffiner légèrement le **WebSocket**.

Si tu veux, je peux te faire **la prochaine fois** :

* soit le SQL de migration complet adapté à ton schéma actuel,
* soit le squelette TypeScript exact de la page `/sondages` (avec les onglets à gauche, centre existant, map à droite).
