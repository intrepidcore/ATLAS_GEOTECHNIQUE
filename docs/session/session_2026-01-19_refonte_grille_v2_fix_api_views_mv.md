# Session 2026-01-19 — Refonte Grille V2 : Fix MV / Vues / Désynchro API

## Objectif du jour

Stabiliser la couche “applicative” après la refonte grille V2 :

- Corriger les **compteurs** (API/UI) qui montraient encore `29 407` mailles au lieu de `14 821`.
- Restaurer les **vues** qui ont été supprimées lors des migrations (CASCADE) et qui sont nécessaires à l’UI.
- Documenter le diagnostic : **l’API ne tape pas toujours `atlas.mailles`**, mais parfois des objets non qualifiés (schéma `public`).
- Préparer la suite : migration “fix applicatif” (ADM + vues 28km MultiPolygon + redirection `public.mailles`).

## Symptômes observés côté API/UI

- Le compteur de mailles affiché côté UI restait sur l’ancien chiffre `29 407`.
- Erreurs attendues (diagnostic en cours / à confirmer par logs):
  - `500 GET /coverage/mailles?grid=28km` (vues 28km / sérialisation)
  - Filtres ADM vides (`0` régions)
  - `404 GET /grid/TG-.../neighbors` (requête sur `public.mailles` legacy)

## Diagnostic principal : doublon `public.mailles` vs `atlas.mailles`

Constat DB :

- `atlas.mailles` (V2) = `14 821`
- `public.mailles` (legacy) = `29 407`
- `atlas.mailles_legacy_v1` = `29 407`

La vue matérialisée `atlas.mv_mailles_geotech` était définie historiquement avec :

- `FROM mailles m` (sans schéma)

Donc Postgres résolvait `mailles` vers **`public.mailles`** (schéma par défaut), ce qui expliquait :

- `REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;` ne changeait pas le count.

### Commandes de preuve

```sql
SELECT COUNT(*) AS n FROM atlas.mailles;        -- 14821
SELECT COUNT(*) AS n FROM public.mailles;       -- 29407
SELECT COUNT(*) AS n FROM atlas.mailles_legacy_v1; -- 29407
```

## Actions réalisées (implémentation)

### 1) Recréation de `atlas.mv_mailles_geotech` sur la grille V2

Migration créée :

- `atlas/migrations/109_fix_mv_mailles_geotech_schema.sql`

Objectif : forcer la MV à lire `atlas.mailles` (et les tables `atlas.*`), et non `public.mailles`.

Points d’adaptation nécessaires à la V2 :

- `atlas.mailles` ne possède pas `geom_4326` → remplacé par `ST_Transform(m.geom, 4326)`.
- `atlas.mailles` ne possède pas `adm1_name` / `adm3_name` → conservés mais mis à `NULL` (compat API/UI).

Exécution :

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/109_fix_mv_mailles_geotech_schema.sql
```

Vérif :

```sql
SELECT COUNT(*) FROM atlas.mv_mailles_geotech; -- 14821
SELECT COUNT(*) FROM mailles_geotechnique_stats_wgs84; -- 14821
```

### 2) Restauration des vues supprimées (CASCADE)

Lors du `DROP MATERIALIZED VIEW ... CASCADE` (migration 109), des vues dépendantes ont été supprimées.

Migration créée :

- `atlas/migrations/110_restore_views_after_grid_v2.sql`

Vues recréées :

- `atlas.v_mailles_with_location_counts`
- `mailles_geotechnique_stats_wgs84` (drop préalable pour éviter les erreurs de signature)
- `atlas.v_maille_28km_kpi`
- `atlas.v_maille_28km_map`
- `atlas.v_mailles_28km_clip`
- `atlas.v_coverage_mailles_28km_clip`
- `atlas.v_maille_dsm_2km`, `atlas.v_maille_dsm_2km_flat`
- `atlas.v_maille_dsm_28km`, `atlas.v_maille_dsm_28km_flat`

Exécution :

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/110_restore_views_after_grid_v2.sql
```

Vérif existence :

```sql
\dv atlas.v_maille_28km_kpi
```

## État actuel en fin de session

- Les **compteurs DB** sont cohérents sur `14821`.
- Les vues nécessaires à l’UI (KPI/clip/DSM/compat) sont restaurées.

## Suite immédiate (prévue)

Une migration “fix applicatif final” est nécessaire pour synchroniser l’API/UI :

1. **Switch DB** : rediriger `public.mailles` vers `atlas.mailles` (rename table legacy + créer une vue `public.mailles`).
2. **ADM** : peupler `atlas.mailles.adm1_name/adm2_name/(adm3_name)` via jointure spatiale avec les tables admin.
3. **28km** : corriger `atlas.v_coverage_mailles_28km_clip` pour gérer `maille_28km.geom` en `MultiPolygon` (ST_Multi/MakeValid/SnapToGrid), afin d’éviter les erreurs 500 de sérialisation.

La migration proposée sera nommée :

- `atlas/migrations/111_fix_api_bindings.sql`

Et devra être suivie d’un redémarrage API (probable) :

```powershell
docker restart atlas-api-geo
```

## Implémentation : Migration 111 (fix applicatif)

Objectif : resynchroniser l'API/UI en corrigeant 3 points :

- Données ADM (filtres UI)
- Vue 28km clip (robuste MultiPolygon)
- Routage DB (API legacy qui tape `public.mailles`)

### Migration

- Fichier : `atlas/migrations/111_fix_api_bindings.sql`

### Commande exécutée

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/111_fix_api_bindings.sql
```

### Changements DB réalisés

1) **ADM**

- Ajout des colonnes manquantes si besoin : `adm1_name`, `adm3_name` sur `atlas.mailles`
- Remplissage par jointure spatiale sur les tables administratives du projet :
  - `public.adm1` (SRID 4326, champ `adm1_fr`)
  - `public.adm2` (SRID 4326, champ `adm2_fr`)
  - `public.adm3` (SRID 4326, champ `adm3_fr`)

La jointure utilise `ST_Intersects(ST_Transform(ST_Centroid(m.geom),4326), a.geom)`.

2) **28km clip**

- Recréation de `atlas.v_coverage_mailles_28km_clip` avec :
  - `ST_SnapToGrid(..., 0.001)`
  - `ST_MakeValid`
  - `ST_CollectionExtract(..., 3)`
  - `ST_Multi(...)`
  - sortie Geo en `4326` et typée `geometry(MultiPolygon,4326)`

3) **Switch API : `public.mailles`**

- Renommage : `public.mailles` → `public.mailles_legacy_v1_archive`
- Création d'une **vue** `public.mailles` qui pointe vers `atlas.mailles` (V2)
  - expose `geom` (25231) et `geom_4326` calculé via `ST_Transform`
  - expose les colonnes attendues historiquement (id text, stats text, adm* ...)

4) **Refresh**

- `REFRESH MATERIALIZED VIEW atlas.mv_mailles_geotech;`

### Vérifications post-migration 111

```sql
SELECT COUNT(*) AS n_total,
       COUNT(*) FILTER (WHERE adm1_name IS NOT NULL) AS n_adm1,
       COUNT(*) FILTER (WHERE adm2_name IS NOT NULL) AS n_adm2,
       COUNT(*) FILTER (WHERE adm3_name IS NOT NULL) AS n_adm3
FROM atlas.mailles;
```

Résultat : `14821` total, `14814` renseignées pour ADM1/ADM2/ADM3.

```sql
SELECT relkind FROM pg_class c
JOIN pg_namespace n ON n.oid=c.relnamespace
WHERE n.nspname='public' AND c.relname='mailles';
```

Résultat : `public.mailles` est bien une **vue**.

```sql
SELECT COUNT(*) AS n_public_mailles FROM public.mailles;
```

Résultat : `14821`.

```sql
SELECT GeometryType(geom) AS gt, COUNT(*)
FROM atlas.v_coverage_mailles_28km_clip
GROUP BY GeometryType(geom);
```

Résultat : `MULTIPOLYGON = 111`.

### Problèmes rencontrés / solutions durables

- **Désynchro schéma (`public` vs `atlas`)** : plusieurs objets historiques utilisent des noms non qualifiés (ex: `mailles`), entraînant la lecture de `public.mailles` (legacy).
  - Solution durable : le **switch DB** via la vue `public.mailles` assure la compat API sans recompiler.

## Implémentation : Migration 112 (Legacy Lookup performant)

Objectif : fournir une recherche “Ancien code → Nouveaux codes” sans calcul géométrique à chaque requête HTTP.

### Migration

- Fichier : `atlas/migrations/112_legacy_lookup_view.sql`

Principe :

- MV `atlas.mv_legacy_mapping` : pré-calcule intersections entre `public.mailles_legacy_v1_archive` et `atlas.mailles`.
- Filtrage du bruit : conservation uniquement si `intersect_area/old_area > 0.01`.
- Indexation B-Tree pour recherche instantanée.
- Vue API `atlas.v_api_legacy_lookup` (avec `match_type`).

### Commande exécutée

```powershell
docker exec -i atlas-db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 -f /docker-entrypoint-initdb.d/112_legacy_lookup_view.sql
```

### Vérifications post-migration 112

```sql
SELECT COUNT(*) AS n_pairs,
       COUNT(DISTINCT legacy_code) AS n_legacy,
       COUNT(DISTINCT new_code) AS n_new
FROM atlas.mv_legacy_mapping;
```

Résultat : `81226` paires, `29405` legacy codes, `14798` new codes.

Exemple :

```sql
SELECT new_code, coverage_pct, match_type
FROM atlas.v_api_legacy_lookup
WHERE legacy_code = 'TG-0857-0162-01'
ORDER BY rank ASC
LIMIT 5;
```

### Notes

- Cette MV peut être recalculée si on veut (ex: `REFRESH MATERIALIZED VIEW atlas.mv_legacy_mapping;`), mais l'objectif est de figer la correspondance historique.

## Implémentation : Workflow Legacy Lookup (API + UI)

Objectif : permettre aux utilisateurs de taper un ancien code de maille et être redirigé vers le nouveau code (Grille V2).

### 1) API Rust (`services/api-geo`)

**Fichiers modifiés :**
- `services/api-geo/src/routes.rs` : ajout du handler `legacy_lookup`
- `services/api-geo/src/main.rs` : ajout de la route `GET /search/legacy/:code`

**Handler `legacy_lookup` :**
- Lit depuis `atlas.v_api_legacy_lookup`
- Retourne les 5 meilleurs matches (triés par `rank`)
- Structure réponse : `[{ new_code, coverage_pct, match_type }, ...]`

**Route ajoutée :**
```rust
.route("/search/legacy/:code", get(routes::legacy_lookup))
```

### 2) Frontend (`ui/src/main.ts`)

**Fichier modifié :**
- `ui/src/main.ts` : modification du handler du bouton `getBtn` (recherche par code)

**Workflow implémenté :**
1. Si `GET /grid/:code` retourne `404`
2. Appel automatique à `GET /search/legacy/:code`
3. Si suggestions trouvées :
   - Affichage d'un toast : `Code obsolète: {old} → {new} ({coverage_pct}%)`
   - Confirmation `confirm()` pour basculer vers la nouvelle maille
   - Si confirmé : remplace le champ input et relance la recherche standard

**Extrait du code UI :**
```typescript
if (res.status === 404) {
  try {
    const legacyRes = await fetch(`${API_GEO}/search/legacy/${encodeURIComponent(code)}`)
    if (legacyRes.ok) {
      const suggestions = await legacyRes.json()
      const best = Array.isArray(suggestions) && suggestions.length > 0 ? suggestions[0] : null
      if (best?.new_code) {
        const pct = typeof best.coverage_pct === 'number' ? best.coverage_pct : null
        const pctStr = pct === null ? '' : ` (${pct.toFixed(1)}%)`
        const msg = `Code obsolète: ${code} → ${best.new_code}${pctStr}`
        toast(msg, 'err')
        const go = window.confirm(`${msg}\n\nAller à la nouvelle maille ?`)
        if (go) {
          codeInput.value = best.new_code
          document.getElementById('getBtn')!.click()
        }
        return
      }
    }
  } catch (e) {
    console.warn('[LegacyLookup] error', e)
  }
}
```

### 3) Déploiement

**API :**
```powershell
docker compose build api-geo
docker compose up -d api-geo
```

**UI :**
- Rebuild `ui/dist` requis pour que les changements soient servis par Nginx

### 4) Tests de validation

**API :**
```bash
curl http://localhost:8000/search/legacy/TG-0857-0162-01
```

**UI :**
1. Entrer un ancien code dans `codeInput`
2. Cliquer sur `GET`
3. Vérifier l'affichage de la suggestion et la possibilité de bascule

### 5) Statut

- ✅ Code API implémenté
- ✅ Code UI implémenté
- ⏳ Build/rebuild requis pour activation
- ✅ Workflow complet : standard → fallback legacy → redirection automatique

Ce workflow assure une transition transparente pour les utilisateurs habitués aux anciens codes de maille.

## Amélioration UX : Gestionnaire de sondages (Onglet Liste) — Empty state “Enabler”

Objectif : transformer le cas **"Aucun sondage trouvé"** en un flux utile.

### Constats

- La search bar de l'onglet Liste utilise `GET /sondages?search=...` (pas `grid_code`).
- Lorsqu'un utilisateur cherche un **code maille** (ex: `TG-0857-0162-01`) et qu'aucun sondage ne correspond, l'UI affichait seulement un état vide.

### Comportement implémenté

Dans `ui/src/sondages-list-panel.ts` :

1) Si la requête retourne `0` sondage et que la recherche ressemble à un **code maille** :

- Tentative de récupération de la maille via `GET /maille/:code`
- Affichage **in-page** d'une carte d'identité de la maille :
  - code maille
  - ADM (adm1/adm2/adm3 si disponibles)
  - centre WGS84 (calculé depuis le polygone) pour pré-remplir le formulaire
  - CTA : **"Créer un sondage ici"**

2) Si la maille n'existe pas (404) :

- Appel `GET /search/legacy/:code`
- Si match : récupération de `GET /maille/:new_code`
- Affichage **in-page** avec alerte orange :
  - ancien code barré
  - nouveau code + match (`match_type`, `coverage_pct`)
  - CTA : **"Créer un sondage ici"**
  - CTA : **"Basculer le filtre"** (met à jour `#/sondages?grid=new_code`)

### Navigation “Créer un sondage ici” (pré-remplissage)

- Le panneau Liste émet un `CustomEvent('navigate:create-sondage', { gridCode, center })`
- `ui/src/pages/sondages-manager-page.ts` écoute cet événement :
  - bascule sur l'onglet `nouveau`
  - pré-remplit :
    - code maille affiché (`gt-maille-code` + `gt-selected-maille`)
    - longitude/latitude (`gt-lon`, `gt-lat`) si centre disponible

### Notes

- On privilégie l'affichage **in-page** (pas de toast éphémère) pour les cas legacy.
- Le flux `gridCodeFilter` (via `#/sondages?grid=...`) conserve une confirmation simple pour bascule legacy → nouveau code.

---

## Atlas Auth / JWT — Compte admin par défaut (pour tests API)

### Où sont les identifiants admin ?

Ils sont seedés dans la migration :

- `atlas/db/migrations/050_rbac_complete.sql`

Ligne “Créer l'utilisateur admin par défaut”:

- Email : `admin@atlas.local`
- Username : `admin`
- Mot de passe (dev) : `Atlas2024!`

### Obtenir un JWT (access_token)

L'API expose :

- `POST http://localhost:8000/auth/login`

Body attendu :

```json
{
  "email": "admin@atlas.local",
  "password": "Atlas2024!"
}
```

La réponse contient `access_token` (Bearer) à utiliser dans :

- `Authorization: Bearer <access_token>`

Ensuite, on peut tester les endpoints Colab protégés :

- `GET /colab/mailles/suggest?q=...`
- `GET /colab/students/suggest?q=...`
- `GET /colab/supervisors/suggest?q=...`

### Dump SQL avant tests d'écriture

Dump **plain SQL** réalisé avant les tests Colab :

- `atlas/backups/pre_colab_tests_20260119_125705.sql`

### Tests Colab (API) + correctif durable

1) **Bug détecté**

- `POST /colab/supervisors` échouait avec :
  - `violates check constraint "username_format"`
- Cause : génération de `username` depuis le préfixe email sans sanitization (ex: présence de `.`).

2) **Fix durable appliqué (backend Rust)**

- Fichier : `atlas/services/api-geo/src/colab/routes.rs`
- Ajout d'un helper `ensure_unique_username()` + sanitization (caractères autorisés : `[a-zA-Z0-9_-]`, longueur 3-50)
- Application dans :
  - `create_student` ✅
  - `create_supervisor` ✅

3) **Résultats tests après fix**

- `POST /colab/supervisors` ✅ (création ok, retour `temp_password`)
- `POST /colab/missions` ✅ avec :
  - `supervisor_id` non-null
  - `assigned_student_ids` (2 étudiants)
- Vérification via `GET /colab/missions?search=...` ✅

---

## Session 2026-01-19 partie 2 — Refonte Colab Studio UI & API (Phase 3 UX + Phase 4 Documents)

### Objectif du jour

Refactoriser l'interface Colab Studio pour utiliser des onglets (Missions, Étudiants, Superviseurs, Documents) avec un bouton global '+' pour créer des éléments. Implémenter les améliorations UX demandées et la gestion complète des documents.

### Phase 3 UX Corrections (terminées ✅)

#### 1) Simplification CreateMissionModal
- **Suppression champ Code**: Le champ `code*` a été retiré de l'UI côté utilisateur
- **Suppression superviseur**: Le dropdown superviseur a été retiré du modal de création
- **Auto-génération code**: Le code est maintenant généré automatiquement côté backend lors de la soumission
- **Validation bouton**: Le bouton "Créer" ne dépend plus de `form.code` mais seulement du titre

#### 2) MissionDetailModal implémenté
- **Composant complet**: Modal détaillé pour afficher les informations complètes d'une mission
- **Trigger au clic**: Cliquer sur une mission ouvre maintenant ce modal au lieu de naviguer
- **Actions incluses**: 
  - Mise à jour du statut de mission
  - Bouton "Documents" pour basculer vers l'onglet Documents avec filtre mission pré-rempli
- **Intégration**: Le modal est branché dans `ColabPage.tsx` avec états `selectedMissionId` et `showMissionDetailModal`

#### 3) UX Étudiants/Superviseurs
- **UpdateStudentModal/UpdateSupervisorModal**: Modification des champs email/prénom/nom possible
- **Reset password**: Intégration avec `usersApi.resetPassword()` dans les modales de modification
- **Badges Actif/Inactif**: Affichage visuel de l'état avec couleurs appropriées
- **Toggle Désactiver/Réactiver**: Boutons dynamiques selon l'état actuel
- **Backend alignment**: `UpdateStudentRequest` et `UpdateSupervisorRequest` alignés avec le backend

#### 4) UX Création comptes
- **Mot de passe temporaire**: Affichage après création avec bouton "Copier"
- **Actions post-création**: 
  - "Fermer" (reset + close)
  - "Ajouter un autre" (reset sans fermer)
- **Auto-refresh**: La liste se rafraîchit automatiquement après création

#### 5) Backend fixes critiques
- **SupervisorSummary**: Ajout du champ `is_active` pour supporter la réactivation
- **list_supervisors**: Modifié pour inclure les superviseurs inactifs et retourner `is_active`
- **get_mission**: Correction pour inclure `is_active` dans la construction du superviseur

### Phase 4 Documents (terminée ✅)

#### Backend Rust
- **Nouveaux handlers**:
  - `list_documents`: GET /colab/documents avec filtres mission_id, sondage_id, document_type
  - `upload_document`: POST /colab/documents (multipart) avec stockage fichiers
  - `download_document`: GET /colab/documents/:id/download
  - `delete_document`: DELETE /colab/documents/:id (soft delete)
- **Stockage fichiers**: `./data/colab_documents` avec UUID préfixé
- **Types ajoutés**: `ColabDocument` et `ColabDocumentsListResponse`
- **Routes enregistrées**: Dans `colab_routes()` avec les 4 endpoints

#### Frontend React
- **documentsApi**: Client API complet dans `colab-api.ts` (lignes 418-492)
  - `list(params)` avec filtres
  - `upload(input)` multipart FormData
  - `download(documentId)` retourne Blob
  - `delete(documentId)` soft delete
- **UploadDocumentModal**: Modal complet pour l'upload (lignes 218-353)
- **Onglet Documents**: Interface complète (lignes 2250-2381)
  - Liste avec tableau (titre, type, fichier, date, actions)
  - Filtres mission_id (texte UUID) et type (dropdown)
  - Actions Télécharger/Supprimer pour chaque document
  - Intégration avec MissionDetailModal via `onGoToDocuments`

#### Intégrations UX
- **Navigation**: Bouton "Documents" dans MissionDetailModal bascule vers onglet Documents
- **Filtre automatique**: `setDocumentsMissionId(missionId)` pré-remplit le filtre mission
- **Refresh automatique**: `loadData()` appelé après upload/delete

### Fichiers modifiés
- `atlas/ui/src/services/colab-api.ts`: Ajout documentsApi + types (+75 lignes)
- `atlas/ui/src/pages/ColabPage.tsx`: Ajout MissionDetailModal, UploadDocumentModal, onglet Documents (+400 lignes)
- `atlas/services/api-geo/src/colab/routes.rs`: Ajout handlers documents (+280 lignes)
- `atlas/services/api-geo/src/colab/types.rs`: Ajout types documents (+25 lignes)

### Build status
- ✅ Frontend: `npm run build` (warnings chunk size mais OK)
- ✅ Backend: `cargo build` (warnings unused functions mais OK)

### Prochaine étape
- **Smoke test manuel** de toutes les fonctionnalités (missions, étudiants, superviseurs, documents)
