# 📋 TODO - Atlas Géotechnique - Gestionnaire de Sondages v2

## 🎯 Objectif Global

Transformer le système de géocodage en un workflow complet et temps réel avec :

- Données propres et cohérentes
- Géocodage manuel et automatique fonctionnel
- Interface dédiée (page au lieu de modal)
- Temps réel via WebSocket

---

## 🧱 ÉTAPE 1 : DONNÉES & MODÈLE

**Objectif** : Stabiliser la base de données pour que l'UI ait du carburant propre

### 1.1 Clarifier les colonnes canoniques ✅

- [X] Analyser la structure actuelle de `public.sondages`
- [X] Documenter les colonnes canon vs legacy
- [X] Décider du rôle de chaque colonne :
  - `code` : identifiant sondage (code_site Excel) ✅
  - `localite_base` : texte brut Excel ✅
  - `localite_key` : version normalisée ✅
  - `adm3_id` / `adm3_name` : lien ADM3 officielle

### 1.2 Nettoyage des données existantes ✅ + compléments

- [X] **Code** : Rempli depuis `meta->>'code'` (123 sondages)
- [X] **Localité brute** : Rempli `localite_base` depuis `meta->>'localite'` (123 sondages)
- [X] **Localité normalisée** : Généré `localite_key` depuis `localite_base` (123 sondages)
- [X] **Contrainte NOT NULL** : Ajoutée sur `code`
- [X] **Index** : Créé sur `localite_key`
- [X] **Test API** : `/sondages?missing=geom` fonctionne sans erreur 500 ✅
- [ ] **Normaliser `location_mode`** : Migrer valeurs actuelles (`adm3` → `adm3_centroid`, documenter `unknown`/`exact`/`random`)
- [ ] **Clarifier colonnes legacy grid** : Documenter rôle de `loc_mode`, `geom_real`, `grid_code` (actuellement NULL)
- [ ] **ADM3 Excel** : Extraire ADM3 depuis `meta` vers colonne dédiée (optionnel)

### 1.3 Adapter les scripts d'import

- [ ] Modifier `02_import_excel.py` pour remplir `code` directement
- [ ] Modifier `03_import_amessefe.py` pour remplir `code` directement
- [ ] Ajouter validation ADM3 à l'import
- [ ] Logger les sondages avec ADM3 non matchée

---

## ⚙️ ÉTAPE 2 : BACKEND GÉOCODAGE & SUGGESTIONS

**Objectif** : Faire vivre les boutons de l'UI actuelle

### 2.1 Standardiser location_mode et modes de placement ✅

- [X] **Décider enum officiel** :
  - `unknown` : pas encore géocodé
  - `exact` : coordonnées GPS connues
  - `adm3_centroid` : centroïde de la commune (debug/cas particulier)
  - `adm_random_cell` : point aléatoire dans l'ADM3 (mode par défaut)
- [X] **Modifier endpoint `/sondages/:id/geocode`** :
  - Accepter paramètre `placement` dans le JSON : `{ "adm3_id": 199, "placement": "adm_random_cell" }`
  - Par défaut : `adm_random_cell`
  - Implémenter génération point aléatoire dans ADM3
- [X] **Adapter suggestions ADM** :
  - Forcer `mode = "adm_random_cell"` dans `POST /suggestions/:id/accept`
- [X] **UI géocodage manuel** :
  - Ajouter select "Placement : Centroïde / Aléatoire"
  - Par défaut : aléatoire
  - Masqué en mode coordonnées exactes
- [X] **Normaliser données existantes** :
  - 28 sondages passés de `adm3_centroid` en `adm_random_cell` via SQL
  - Points régénérés aléatoirement dans polygones ADM3

### 2.2 Géocodage manuel (onglet "Géocodage Amélioré") ✅

- [X] Créer endpoint `POST /sondages/:id/geocode`
  - [X] Mode ADM3 : centroïde + `adm3_id` (gid)
  - [X] Mode GPS : coordonnées exactes
  - [X] Mise à jour `location_mode`, `is_geocoded`
  - [X] Ajouter audit dans meta (geocoded_at, geocoded_mode)
  - [X] Validation coordonnées
  - [X] Logs de traçabilité
- [X] Rebuild Docker API pour déployer l'endpoint
- [X] Tester l'endpoint : ADM3 ✅ coords ✅
- [X] Brancher le bouton "Enregistrer le géocodage" dans l'UI
- [X] Rafraîchir la liste après géocodage

### 2.3 Suggestions ADM basées sur ADM3 Excel + localité ✅ + corrections

- [X] **Script de génération des suggestions** :
  - [X] Script Python generate_geocode_suggestions.py
  - [X] Parcourir sondages avec `location_mode = 'unknown'`
  - [X] Matching fuzzy Levenshtein sur `localite_key` vs `adm3_fr`
  - [X] Calcul de score 0-100
  - [X] Vider suggestions pending au démarrage
  - [X] Remplir champ `candidates` avec tous les candidats (JSON)
  - [X] 98 suggestions générées pour 121 sondages
- [X] **API suggestions** :
  - [X] `GET /suggestions?sondage_id=...&status=...`
  - [X] `GET /suggestions/stats`
  - [X] `POST /suggestions/:id/accept` (géocode + update + auto-reject autres)
  - [X] `POST /suggestions/:id/reject`
  - [X] Correction champ `localite` → utilise `localite_base`
- [X] Brancher le bouton "Géocoder" dans l'onglet Suggestions ADM
- [X] Nouveau panel SuggestionsAdmPanel avec affichage candidats
- [X] **BUG CORRIGÉ** : `candidates` est une STRING JSON
  - Frontend parse robustement avec try/catch multi-format
  - Gestion string/array/object
  - Logs explicites pour debugging
- [ ] Trigger auto-génération suggestions lors ajout sondage

### 2.4 Interaction carte (ADM3 qui clignote) - DÉTAILLÉ

- [ ] Endpoint pour récupérer géométrie ADM3 (ou réutiliser `/adm3/geojson` existant)
- [ ] Frontend : bouton "👁" sur chaque candidat ADM3 dans suggestions-adm-panel
- [ ] Au clic sur "👁" :
  - [ ] Appeler `sondagesPage.zoomToAdm3(code)` (méthode déjà créée)
  - [ ] Zoom sur le polygone ADM3 (`map.fitBounds`)
  - [ ] Style spécial (jaune/épais)
  - [ ] Clignotement 3-5 fois (toggle style toutes les 400ms)
- [ ] Restaurer style original après animation

### 2.5 Propagation vers la grille (mailles) ✅

**Objectif** : Que le géocodage mette à jour les mailles et les stats de la carte principale

- [X] **Diagnostic SRID** : Identifier que `ST_Contains(maille_25231, sondage_4326)` ne matchait pas
- [X] **Correction vue matérialisée** : Ajout `ST_Transform(s.geom, 25231)` dans `atlas.mv_mailles_geotech`
- [X] **Résultat** : 6 mailles avec données détectées (Kovié, Badja, Kpimé, Sola, Kparatao, Adzakpa)
- [X] **Trigger automatique** : `trigger_refresh_mailles` existe et fonctionne (AFTER INSERT/UPDATE)
- [ ] **Remplir `geom_real` et `grid_code`** : Optionnel car la vue fonctionne maintenant avec `ST_Transform`
- [ ] **Normaliser `loc_mode`** : Dériver de `location_mode` si besoin pour compatibilité legacy

---

## 🧩 ÉTAPE 3 : REFACTOR UI (Modal → Page dédiée) ✅

**Objectif** : Transformer le modal en vraie page avec carte intégrée

### 3.1 Layout plein écran du Gestionnaire de Sondages ✅

- [X] Ajouter routing hash-based simple (`#/sondages`)
- [X] Créer composant `SondagesManagerPage`
- [X] Layout 3 colonnes : Sidebar | Contenu | Carte
- [X] Chaque onglet a son propre contenu (pas de duplication)
- [X] `.tab-pane` occupe 100% du centre
- [X] Layout factorisé : 1 onglet = 1 composant

### 3.2 Onglet « Géocodage Manuel » ✅

- [X] Réutiliser `GeocodeCanonPanel` dans la nouvelle page
- [X] Liste sondages + panneau géocodage fonctionnels
- [X] **BUG LAYOUT** : Zone sombre vide en bas corrigée
  - Panel occupe 100% hauteur (height: 100%)
- [X] **Choix mode placement** :
  - Select "Placement : Centroïde / Aléatoire"
  - Par défaut : aléatoire
  - Masqué en mode coordonnées exactes
  - Paramètre `placement` envoyé au backend

### 3.3 Onglet « Suggestions ADM » ✅

- [X] Créer `SuggestionsAdmPanel` avec affichage candidats
- [X] Branché correctement dans la page
- [X] API `/suggestions/stats` fonctionne
- [X] Bouton 👁️ "Voir" pour zoom carte
- [X] Messages dédiés pour erreurs/vide
- [X] **BUG JSON** : Parsing robuste avec try/catch
  - Gestion erreur si `candidates` mal formé
  - Affichage candidats avec scores
- [X] **BUG INTRUS** : Modal sondages fermé lors navigation

### 3.4 Onglet « Import » 🔧

- [X] Message explicatif professionnel
- [X] Bouton redirection vers Import Wizard (carte principale)
- [X] Pas de placeholder générique
- [ ] **Intégration complète Import Wizard** :
  - Extraire composant `ImportWizard` en module commun
  - Rendre directement dans l'onglet (pas de modal)
  - Occuper toute la hauteur centrale
  - Mettre à jour texte pédagogique

### 3.5 Onglet « Liste » ✅

- [X] `SondagesListPanel` créé et intégré
- [X] Recherche + filtres fonctionnels
- [X] Stats affichées (total, géocodés, non géocodés)
- [X] **BUG LAYOUT** : Liste scroll correctement
  - Conteneur flex: 1, min-height: 0
  - Zone scroll occupe toute hauteur disponible
- [X] **"Voir détails" implémenté** :
  - Modal détails complet avec toutes les infos
  - Affichage : identifiants, localisation, import, audit
  - Coordonnées extraites de geom (WKT)
  - Meta JSON formaté et scrollable
  - Fermeture : bouton X, clic extérieur, ESC

### 3.6 Carte ADM3 intégrée ✅

- [X] Charger la couche ADM3 dans la carte de droite
- [X] Style des polygones (bordure bleue, fond transparent)
- [X] Tooltips sur hover (nom commune, code)
- [X] Méthode `zoomToAdm3(code)` pour interaction depuis les suggestions
- [X] Bouton 👁️ sur chaque suggestion avec event `atlas:zoom-adm3`
- [X] Highlight 2 secondes (jaune, poids 3)

### 3.7 Nettoyage & cohérence ✅

- [X] Placeholders remplacés par vrais composants ou messages explicatifs
- [X] Messages harmonisés par onglet
- [X] Layout responsive, pas de zone tronquée

---

## 🔄 ÉTAPE 4 : TEMPS RÉEL WEBSOCKET (Backend)

**Objectif** : Synchronisation multi-utilisateurs

### 4.1 Définir les événements ✅

- [X] `sondage.created` (nouveau sondage)
- [X] `sondage.updated` (modification)
- [X] `sondage.geocoded` (géocodage réussi)
- [X] `sondage.deleted` (soft delete)
- [X] `suggestion.accepted` (suggestion acceptée)
- [X] `suggestion.rejected` (suggestion rejetée)

### 4.2 Backend Rust/Axum ✅

- [X] Module events.rs avec types WsEvent
- [X] Module websocket.rs avec handler
- [X] Endpoint `GET /ws` (WebSocket upgrade)
- [X] Broadcast channel dans AppState
- [X] Émission événements dans geocode_suggestions
- [X] Émission événements dans sondages_geocode

### 4.3 Frontend TS ✅ + compléments

- [X] Module `realtime.ts` :
  - [X] Connexion WebSocket
  - [X] Reconnexion automatique avec backoff exponentiel
  - [X] Système d'événements (on/off/emit)
  - [X] Méthode `disconnect()` pour nettoyage
  - [X] CustomEvent globaux pour compatibilité
- [X] Intégrer WebSocket côté frontend (Vite/TS)
  - [X] Connexion automatique au WebSocket dans main.ts
  - [X] Écoute des événements sondage.geocoded, suggestion.accepted/rejected
  - [X] Notifications toast pour les événements importants
- [ ] **Rafraîchissements automatiques** :
  - [ ] Sur `sondage.geocoded` : Refetch `/grid/stats` ou `/mailles/stats` pour carte principale
  - [ ] Sur `sondage.geocoded` : Retirer sondage de la liste "missing geom" sans reload
  - [ ] Sur `suggestion.accepted/rejected` : Mettre à jour liste suggestions
  - [ ] Compteurs temps réel (Géocodage/Suggestions)
- [ ] **Option** : Événement backend `grid.updated` quand stats mailles recalculées

---

## 🧪 TESTS & VALIDATION

### Tests fonctionnels

- [ ] **Géocodage manuel ADM3** : Kovié, Kpimé (Séva) → vérifier mailles avec données
- [ ] **Géocodage manuel GPS** : Badja avec coordonnées → vérifier position exacte
- [ ] **Acceptation suggestion** : Workflow complet depuis onglet Suggestions ADM
- [ ] **Rejet suggestion** : Vérifier disparition de la liste
- [ ] **Temps réel multi-onglets** :
  - Ouvrir 2 onglets UI
  - Géocoder dans A
  - Vérifier mise à jour dans B (liste + compteurs)
- [ ] **Temps réel multi-utilisateurs** : 2 navigateurs différents
- [ ] **Stats carte principale** : "Mailles avec données" > 0 après géocodages

### Tests de données

- [X] **SRID cohérent** : Vue `mv_mailles_geotech` transforme correctement 4326→25231
- [ ] Tous les sondages ont un `code` non NULL
- [ ] `localite_base` remplie quand disponible
- [ ] ADM3 matchées correctement
- [ ] Pas de doublons de code
- [ ] Vérifier Kovié, Kpimé, Badja dans les mailles correspondantes

---

## 📦 DÉPLOIEMENT

- [ ] Migration SQL pour nettoyage données
- [ ] Rebuild API Rust
- [ ] Rebuild UI
- [ ] Test en environnement Docker
- [ ] Documentation utilisateur

---

## 🎯 PRIORITÉS IMMÉDIATES (Ordre d'exécution)

### Phase 1 : Corrections critiques DB ✅

1. ✅ **Diagnostic SRID** : Identifier problème `ST_Contains` avec SRID différents
2. ✅ **Migration 034** : Corriger vue `mv_mailles_geotech` avec `ST_Transform`
3. ✅ **Résultat** : 6 mailles avec données (vs 0 avant)

### Phase 2 : Corrections UI ✅

4. ✅ **Corriger layout page `/sondages`** :
   - Chaque onglet a son propre contenu
   - Pas de duplication de blocs
   - Layout occupe 100% hauteur
5. ✅ **Brancher onglets correctement** :
   - Suggestions ADM → `SuggestionsAdmPanel` fonctionnel
   - Import → Message explicatif + redirection
   - Liste → `SondagesListPanel` avec recherche et filtres
6. ✅ **Corriger bug JSON** : API répond correctement

### Phase 3 : Normalisation & cohérence ✅

7. ✅ **Normaliser `location_mode`** : Migration 035 appliquée (5 adm3_centroid, 1 exact, 117 unknown)
8. ✅ **Documenter colonnes legacy** : Commentaires SQL ajoutés
9. ✅ **Interaction carte** : Bouton 👁️ + zoom ADM3 + highlight 2s

### Phase 4 : Temps réel & tests ✅

10. ✅ **Rafraîchissements auto** : Listeners WebSocket dans tous les panels
11. ⏳ **Tests multi-onglets** : À valider manuellement (voir TESTS_VALIDATION.md)
12. ⏳ **Adapter scripts import** : Reste à faire (non bloquant)

---

## 🚀 ROADMAP v3.0 - Prochaines fonctionnalités

### 1. Auto-géocodage basé sur les Suggestions ADM

**Objectif** : Accepter automatiquement les suggestions ADM3 avec score élevé (≥ seuil)

#### Règle métier

- [ ] Définir seuil de score pour auto-acceptation (ex. ≥ 90%)
- [ ] Définir mode de placement par défaut (`adm_random_cell`, etc.)
- [ ] Documenter marquage "auto" vs "manuel" dans l'audit

#### Analyse technique

- [ ] Analyser schéma table `atlas.suggestions` (score, status, candidates)
- [ ] Analyser schéma table `atlas.sondages` (is_geocoded, location_mode, adm3_id, geom)
- [ ] Comprendre logique `POST /suggestions/:id/accept` (fichier `geocode_suggestions.rs`)
- [ ] Identifier triggers/fonctions SQL (ex. `refresh_mailles_geotech`)

#### Backend

- [ ] Créer fonction SQL `atlas.auto_accept_suggestions(seuil FLOAT)` :
  - [ ] Sélectionner suggestions `status = 'pending'` avec `score ≥ seuil`
  - [ ] Filtrer sur `sondages.is_geocoded = false`
  - [ ] Réutiliser logique d'acceptation existante
  - [ ] Marquer suggestion comme `accepted`
  - [ ] Mettre à jour sondage (is_geocoded, location_mode, geom)
- [ ] Créer endpoint CLI/admin `POST /admin/auto-geocode?threshold=90`
- [ ] Script one-shot pour sondages existants :
  - [ ] Créer `scripts/auto_geocode_existing.sql`
  - [ ] Vérifier compteurs avant/après
  - [ ] Rafraîchir `mv_mailles_geotech`
- [ ] Intégrer dans pipeline nouveaux sondages :
  - [ ] Identifier points de création (Import Wizard, API POST, ETL)
  - [ ] Appliquer règle auto-acceptation après génération suggestions
  - [ ] Émettre event WebSocket `atlas:refresh-stats` si auto-accepté

#### UI (optionnel)

- [ ] Badge "🤖 Auto" dans onglet Suggestions ADM
- [ ] Afficher "Mode : Automatique" dans Liste / modal détails

---

### 2. UX Géocodage manuel - Conserver position de scroll ✅

**Objectif** : Ne plus remonter en haut de la liste après un géocodage

- [X] Localiser fonction de rendu liste "Sondages sans géométrie"
- [X] Sauvegarder `scrollTop` avant rafraîchissement
- [X] Restaurer `scrollTop` après rafraîchissement
- [X] (Optionnel) Conserver surlignage du sondage sélectionné
- [X] Tester en géocodant plusieurs sondages d'affilée

---

### 3. Re-géocodage depuis l'onglet "Liste" ✅

**Règle** : Géocodage Manuel = sondages `location_mode = 'unknown'` uniquement

#### UX

- [X] Dans onglet Liste :
  - [X] Si `location_mode = 'unknown'` → bouton "Géocoder"
  - [X] Sinon → bouton "Re-géocoder" / "Modifier la localisation"
- [X] Au clic sur "Géocoder / Re-géocoder" :
  - [X] Activer onglet "Géocodage Manuel"
  - [X] Définir `currentGeocodeTargetId = <id du sondage>`
  - [X] Liste gauche reste backlog de `location_mode = 'unknown'`
  - [X] Panneau droit charge le sondage ciblé (même déjà géocodé)

#### Frontend

- [X] Ajouter state `currentGeocodeTargetId` dans `sondages-manager-page`
- [X] Permettre à `sondages-list-panel` d'appeler handler "ouvrir géocodage pour ce sondage"
- [X] Dans panneau géocodage manuel :
  - [X] Écouter `currentGeocodeTargetId`
  - [X] Charger sondage par ID et afficher localisation actuelle
  - [X] Permettre modification mode/position puis sauvegarder
  - [X] (Optionnel) Surligner dans liste gauche si sondage y apparaît

#### Backend

- [X] Vérifier que API géocodage accepte mise à jour sondage déjà géocodé
- [ ] Ajouter événement audit de re-géocodage (old_* vs new_*) - À faire plus tard

#### Tests

- [ ] Cas 1 : Liste → Géocoder un sondage non géocodé - À tester manuellement
- [ ] Cas 2 : Liste → Re-géocoder un sondage géocodé - À tester manuellement
- [ ] Vérifier bascule correcte vers onglet Géocodage Manuel
- [ ] Vérifier liste gauche reste backlog de `unknown`
- [ ] Vérifier panneau droit montre bon sondage
- [ ] Vérifier badges/compteurs Liste mis à jour
- [ ] Vérifier audit contient entrées de re-géocodage

---

### 4. Intégration Import Wizard dans onglet "Import" ✅

**Objectif** : Wizard complet dans le bloc central (mode embedded)

- [X] Identifier version wizard réellement utilisée :
  - [X] Recherche globale "Import Wizard - Étape 1/5" ou texte upload
  - [X] Confirmé : `ImportWizardV2` est utilisé
- [X] Factoriser wizard pour supporter deux modes :
  - [X] Modal (overlay plein écran depuis carte) - Déjà existant
  - [X] Embedded (dans container fourni, onglet Import) - Implémenté
- [X] Onglet Import :
  - [X] Remplacer placeholder par version embedded du wizard
  - [X] Ajouter texte explicatif pour utilisateurs
  - [X] Adapter styles CSS pour mode embedded (suppression overlay modal)
- [X] Maintenir wizard accessible depuis carte principale
- [ ] Tests complets upload → mapping → géométrie → preview → import - À tester manuellement
- [ ] Vérifier apparition nouveaux sondages dans Liste/Géocodage/Suggestions - À tester manuellement

---

### 5. Refactor "Voir détails" → Page interne (plus de modal) ✅

**Objectif** : Transformer le modal en page interne intégrée

#### Architecture ✅

- [X] **État de navigation** : Ajout `currentView: 'list' | 'details'` et `currentDetailId`
- [X] **Méthodes de navigation** : `showDetailsView()`, `backToList()`, `renderListeContent()`
- [X] **Callback système** : `setOnDetailsRequest()` dans `SondagesListPanel`
- [X] **Fallback modal** : Conservé pour compatibilité si callback non défini

#### Backend ✅

- [X] Identifier endpoint actuel "Voir détails"
- [X] Décider : enrichir route existante ou créer `GET /sondages/:id/details`
- [X] Réponse doit contenir toutes infos géotechniques en une fois
- [X] Optimiser requêtes (vue SQL agrégée ou jointures)

#### Frontend ✅

- [X] **Page détails complète** : Remplace le modal par une page interne
- [X] **Bouton retour** : "← Retour à la liste" avec navigation
- [X] **Contenu structuré** :
  - [X] Localisation (localité, ADM3, géocodage, coordonnées)
  - [X] Métadonnées (source, date création)
  - [X] Essais Atterberg (tableau avec profondeur, WL, WP, IP)
  - [X] Essais VBS (tableau avec profondeur, VBS, commentaire)
- [X] **Gestion erreurs** : Affichage propre si échec chargement
- [X] **Responsive** : Tableaux avec scroll horizontal si nécessaire

#### Intégration carte

- [X] **Focus automatique** : `focusSurveyOnMap()` appelé lors ouverture détails
- [X] **Zoom & highlight ADM3** : Implémentation à compléter
- [X] **Highlight maille** : Clignotement cellule grille à ajouter

#### Tests

- [ ] Navigation liste → détails → retour liste
- [ ] Affichage sondage avec beaucoup d'essais
- [ ] Affichage sondage avec peu de données
- [ ] Gestion erreur si sondage inexistant

### 6. Améliorations UX et badges ✅

**Objectif** : Améliorer l'expérience utilisateur et la visibilité des informations

#### Badges géocodage ✅

- [X] **Badge AUTO** : Sondages auto-géocodés via suggestions acceptées
  - [X] Détection via `meta.geocoded_mode === 'suggestion_accepted'`
  - [X] Style bleu avec icône 🤖
- [X] **Badge MANUEL** : Sondages géocodés manuellement via ADM3
  - [X] Détection via `meta.geocoded_mode === 'adm3'`
  - [X] Style orange avec icône 👤
- [X] **Intégration** : Badges affichés dans `SondagesListPanel`

#### Corrections API ✅

- [X] **Endpoint ADM3 GeoJSON** : Correction route `/adm3/geojson`
  - [X] Réorganisation ordre des routes pour éviter capture par `/adm/:level`
  - [X] Route spécifique placée avant route générique
  - [X] Test endpoint fonctionnel
- [X] **Panneau Suggestions** : Correction erreur 500
  - [X] Vérification endpoint `/suggestions/stats` → fonctionne
  - [X] Problème était côté UI, pas API

#### Refactoring Import Wizard ✅

- [X] **Source de vérité** : `ImportWizardV2` identifié comme wizard principal
- [X] **Mode embedded** : Adaptation pour onglet Import
  - [X] Suppression overlay modal via CSS dynamique
  - [X] Adaptation largeur et hauteur pour container
  - [X] Texte explicatif ajouté
- [X] **Compatibilité** : Mode modal conservé pour carte principale

---

### ✅ ROADMAP v3.2 - Implémenté (2025-11-25)

#### Chantier A : Nettoyage & documentation Wizards ✅

- [X] **Documentation wizards** : `docs/wizards.md` créé
  - [X] Inventaire des 5 wizards avec rôles et statuts
  - [X] `import-wizard-v2.ts` marqué comme canonique
  - [X] `import-wizard-core.ts` marqué DEPRECATED (code corrompu nettoyé)
- [X] **Panneau dev test wizards** : Ajouté dans la carte (visible si `ATLAS_DEBUG_WIZARDS=true`)

#### Chantier B : "Voir détails" en page interne ✅

- [X] **Callback système** : `setOnDetailsRequest()` dans `SondagesListPanel`
- [X] **Navigation interne** : `showDetailsView()` / `backToList()` / `renderListeContent()`
- [X] **Bouton retour** : "← Retour à la liste" fonctionnel

#### Chantier C : Badges AUTO/MANUEL ✅

- [X] **Types TypeScript** : `survey-details.ts` avec `computeGeocodeBadge()`
- [X] **Badges visuels** :
  - AUTO (vert) : `location_mode === 'adm_random_cell'` ou `geocoded_mode === 'suggestion_accepted'`
  - MANUEL (bleu) : `geocoded_mode === 'adm3'` ou `location_mode === 'exact'`
- [X] **Intégration** : Badges affichés dans page détails

#### Chantier D : Carte - Zoom & highlight ADM3 ✅

- [X] **Événement global** : `atlas:focus-survey` avec coords et adm3_id
- [X] **Écouteur carte** : Zoom + marqueur temporaire (5s)
- [X] **Highlight ADM3** : `atlas:highlight-adm3` avec `highlightAdm3ById()` (vert, 3s)

#### Chantier E : Filtres & tri Liste ✅ (déjà implémenté)

- [X] **Filtres** : Géocodage, Source, ADM3, Mode géocodage
- [X] **Tri** : Date, Code, Localité, Statut géocodage

#### Chantier F : UI Détails harmonisée ✅

- [X] **Types TypeScript** : `SurveyDetails`, `AtterbergRow`, `VbsRow`, `GranuloSerie`, `EchantillonRow`
- [X] **Sections structurées** :
  - [X] Localisation avec badges géocodage + bouton zoom carte
  - [X] Métadonnées (source, mode, dates)
  - [X] Essais Atterberg (dédupliqués par profondeur)
  - [X] Essais VBS (dédupliqués par profondeur)
  - [X] Granulométrie (accordion par profondeur avec points tamis)
  - [X] Échantillons (tableau)
- [X] **Déduplication** : `dedupeByDepth()` pour éviter lignes fantômes
- [X] **Accordions granulo** : Clic pour ouvrir/fermer détails points

#### Chantier G : Data quality (doublons) ⏳

- [X] **Script analyse** : `analyze_duplicates.py` fonctionnel
- [ ] **UI doublons** : Badge/filtre dans liste (à faire plus tard)

---

### ✅ ROADMAP v3.3 - Implémenté (2025-11-25)

#### Chantier A : Données géotechniques complètes ✅

- [X] **API enrichie** : `/sondages/:id/details` expose tous les essais
  - [X] `classif` : Classification des sols (HRB, Unified, Chassagneux)
  - [X] `gonflement` : Potentiel de gonflement (CG, qualification)
  - [X] `physiques` : Essais physiques (densités, teneur eau)
  - [X] `proctor` : Essais Proctor (ρd max, w opt)
- [X] **Types TypeScript** : `ClassifRow`, `GonflementRow`, `PhysiquesRow`, `ProctorRow`
- [X] **Affichage UI** : Tableaux spécialisés avec badges colorés

#### Chantier B : Logique métier badges AUTO/MANUEL ✅

- [X] **API enrichie** : `geocoded_mode` et `geocoded_score` exposés
  - [X] Jointure `geocode_suggestions` pour récupérer le score
  - [X] Score exposé dans `/sondages`, `/sondages/:id`, `/sondages/:id/details`
- [X] **Règles métier v3.3** :
  - AUTO : `geocoded_mode='suggestion_accepted'` avec `score >= 80%`
  - MANUEL : `geocoded_mode in {'adm3', 'gps', 'manual_override'}` OU `score < 80%`
  - UNKNOWN : non géocodé ou cas non couverts
- [X] **Fonction `computeGeocodeBadgeFromSurvey`** mise à jour

#### Chantier C : Corrections UX Liste ✅

- [X] **Recherche** : Soft refresh avec `rerenderList()` (pas de re-render complet)
- [X] **Tri** : Listeners séparés (contrôles vs items) pour éviter perte de focus
- [X] **Scroll conservé** : `listScrollTop` sauvegardé/restauré lors navigation liste↔détails

#### Chantier D : Carte - Zoom & highlight ADM3 amélioré ✅

- [X] **Zoom automatique** : `fitBounds()` sur l'ADM3 lors du highlight
- [X] **Style amélioré** : Contour vert (#00ff55), fond transparent (fillOpacity: 0.1)
- [X] **Bring to front** : ADM3 mis en avant pendant le highlight

#### Chantier E : Boutons Test Wizards (DEV) ✅

- [X] **Registry global** : Support `window.atlasWizards` pour accès aux wizards
- [X] **Fallback intelligent** : Redirection vers onglet Import si wizard non disponible
- [X] **Messages toast** : Notifications claires au lieu d'alertes

#### Chantier F : Corrections API ✅

- [X] **`/suggestions`** : Fonctionne correctement (cast UUID→TEXT corrigé)
- [X] **`/adm3/geojson`** : 373 features exposées

---

### 🚧 ROADMAP v3.4 - Prochaines fonctionnalités

#### Couche mailles colorée

- [ ] Ré-affichage avec code couleur selon nombre de sondages
- [ ] Légende dynamique

#### Améliorations UI

- [ ] Export détails vers PDF/Excel
- [ ] Graphique courbe granulométrique
- [ ] Édition inline des champs

#### Temps réel avancé

- [ ] Rafraîchissement auto stats carte sur `sondage.geocoded`
- [ ] Compteurs temps réel dans les onglets

---

### 🚧 ROADMAP v3.6 - Panneau Ingénieur Propre (En cours)

**Objectif** : Interface orientée ingénieur avec séparation claire global/maille et synthèse toujours présente

---

#### 🔧 Chantier 1 : Nettoyer le panneau "Statistiques (filtrées)" ✅

##### 1.1 Répartition des essais

- [X] Retirer "Physiques" de l'affichage (garder en API)
- [X] Afficher uniquement : Atterberg | VBS | Classif
- [X] Barre colorée avec 3 segments seulement

##### 1.2 Profondeurs d'investigation (global)

- [X] Renommer en **"📏 Profondeurs d'investigation (global – filtres ADM)"**
- [X] Garder histogramme global Chart.js
- [X] Ajouter sous-titre : "Calculé sur X échantillons filtrés"

##### 1.3 Indicateur d'argilosité (global)

- [X] Renommer en **"💧 Indicateur d'argilosité (global – filtres ADM)"**
- [X] Conserver phrase d'interprétation
- [X] Ajouter sous-titre : "Calculé sur X échantillons / Y essais filtrés"

##### 1.4 Légende – adapter aux vraies couleurs

- [X] Remplacer légende actuelle par 3 lignes :
  - `mailles avec sondages (localisation exacte)` → couleur #22c55e
  - `mailles avec sondages (ADM / random cell)` → couleur #f97316
  - `mailles sans sondages` → couleur no-data

---

#### 🧱 Chantier 2 : Nouvelle structure fiche maille (sans onglets) ✅

##### 2.0 État initial

- [X] Message "Cliquez sur une maille pour afficher la fiche géotechnique" quand aucune maille sélectionnée

##### 2.1 En-tête – Identité maille

- [X] Code maille (badge)
- [X] Chemin ADM : `Région > Préfecture > Commune`
- [X] Badge données : `avec données` / `sans données`
- [X] Badge localisation : `exact` / `adm_random_cell`

##### 2.2 Instrumentation (KPI)

- [X] 3 KPI : Sondages | Échantillons | Essais (% spread retiré car toujours 0)
- [X] Ligne résumé : "Données issues de X sondage(s), Y échantillon(s), Z essai(s)"

##### 2.3 Profondeur d'investigation – maille

- [X] Calculer min/max/moy depuis `samples[]`
- [X] Mini histogramme local (0-3 / 3-6 / 6-10 / >10m) avec barres verticales
- [X] Calcul côté frontend (pas besoin de backend supplémentaire)

##### 2.4 Essais par type – maille

- [X] Compteurs dérivés de `samples[]` :
  - Atterberg : count(sample.atterberg != null)
  - VBS : count(sample.vbs != null)
  - Classif : count(sample.classif != null)
- [X] Affichage : `Atterberg: 0 | VBS: 3 | Classif: 0` (0 en opacité réduite)

##### 2.5 Indicateurs d'argilosité – maille

- [X] Calculer VBS_moy depuis `overview.vbs[]`
- [X] Calculer % argileux (VBS > 2.5) pour la maille
- [X] IP_moy si Atterberg disponible
- [X] Calcul côté frontend (pas besoin de backend supplémentaire)

##### 2.6 Liste des sondages de la maille

- [X] Afficher depuis `surveys[]` :
  - code_site
  - mode (exact / adm_random_cell)
  - samples count
  - tests count

##### 2.7 Échantillons & essais (bloc repliable)

- [X] Tableau : Profondeur | VBS | IP
- [X] Section repliable avec `<details>` (fermée par défaut)

##### 2.8 Mailles voisines

- [X] Bloc existant conservé (section séparée)

---

#### 🧠 Chantier 3 : Synthèse automatique TOUJOURS présente ✅

**Objectif** : Ne plus jamais afficher "Pas encore de synthèse disponible"

##### 3.1 Logique 3 niveaux dans `cell-summary.ts`

- [X] **Niveau 3 – Complet** (profondeur + VBS_moy ou IP_moy) :

  > "Maille instrumentée : 1 sondage, 3 échantillons, 9 essais. Investigations entre 1.0 à 2.0 m (moy. 1.5 m). Sols argileux (VBS moy. 5.9 g/100g)."
  >
- [X] **Niveau 2 – Intermédiaire** (profondeur OU argilosité) :

  > "Maille instrumentée : 1 sondage, 3 échantillons, 9 essais. Profondeurs d'investigation : 1.0–2.0 m, maille peu explorée en profondeur."
  >
- [X] **Niveau 1 – Minimal** (seulement KPI) :

  > "Maille instrumentée : 1 sondage, 3 échantillons, 9 essais. Pas encore d'indicateurs synthétiques (VBS, limites d'Atterberg, etc.)."
  >

##### 3.2 Implémentation

- [X] Modifier `buildCellSummary()` pour ne jamais retourner null
- [X] Commencer par niveau 3, descendre si données manquantes
- [X] Retirer message "Pas encore de synthèse…" de l'UI

---

#### 🗄️ Chantier 4 : Backend – ajustements minimum ✅

##### 4.1 `/cells/{code}/complete` – enrichir réponse

- [X] Stats calculées côté frontend (pas besoin de modifier le backend)
- [X] `depth_stats` calculé depuis `samples[].depth_m`
- [X] `argilosite` calculé depuis `overview.vbs[]` et `overview.atterberg[]`

##### 4.2 `/stats/global` – RAS

- [X] Déjà OK : compteurs, histogramme, argilosité
- [X] Labels UI mentionnent "(global – filtres ADM)"

##### 4.3 Légende

- [X] Adapté en UI avec 3 couleurs

---

#### ✅ Résumé actions concrètes

| Priorité | Action                                         | Statut |
| --------- | ---------------------------------------------- | ------ |
| 1         | Retirer "Physiques" de répartition essais     | ✅     |
| 2         | Renommer titres avec "(global – filtres ADM)" | ✅     |
| 3         | Adapter légende 3 couleurs                    | ✅     |
| 4         | Supprimer onglets fiche maille                 | ✅     |
| 5         | Créer nouvelle structure fiche maille         | ✅     |
| 6         | Stats calculées côté frontend               | ✅     |
| 7         | Synthèse 3 niveaux (jamais null)              | ✅     |
| 8         | Retirer % spread (toujours 0)                  | ✅     |

---

#### Note sur % SPREAD

Le KPI "% spread" représente la part de données "diffusées/virtuelles" dans une maille.

- **Aujourd'hui** : toutes les données viennent de sondages réels → % spread = 0% partout
- **Action** : KPI retiré de l'affichage
- **Plus tard** : réactiver quand pipeline de diffusion ADM3/IA sera en place

---

### 🚧 ROADMAP v3.7 - Extension types d'essais (En cours)

**Objectif** : Intégrer Proctor, Granulo, Gonflement dans la chaîne complète

#### ✅ Étape A – Vue matérialisée mv_mailles_geotech

- [X] Migration 045: Ajouter n_proctor, n_granulo, n_gonflement
- [X] Mettre à jour n_essais = somme des 7 types
- [X] Ajouter colonne IP calculée dans essais_atterberg

#### ✅ Étape B – API Backend

- [X] `/stats/global`: exposer 6 types (Atterberg, VBS, Classif, Proctor, Granulo, Gonflement)
- [X] `/cells/{code}/complete`: ajouter IP calculé, flags proctor/granulo/gonflement
- [X] Corriger comptage essais dans surveys (6 types au lieu de 3)
- [X] Bins de profondeur adaptés: 0-1 / 1-1.5 / 1.5-2 / >2

#### ✅ Étape C – UI Frontend

- [X] Panneau global: 6 types d'essais avec barre colorée
- [X] Fiche maille: 6 types d'essais avec opacité réduite si 0
- [X] Histogramme profondeur: bins 0-1 / 1-1.5 / 1.5-2 / >2
- [X] Tableau échantillons: IP lu depuis BDD

---

### ✅ ROADMAP v3.8 - Corrections UX & Cohérence Données (2025-11-26)

**Objectif** : Stabiliser l'UX carte et unifier les sources de données

---

#### 🔧 Chantier A – Stabiliser survol & clic carte (fin du clignotement) ✅

**Problème** : Clignotement au survol et clics capricieux sur les mailles

##### A.1 Simplifier la pile de couches ✅

- [X] Supprimer `hoverLayer` (couche séparée pour le survol)
- [X] Supprimer `selectedMailleLayer` (remplacé par `selectedCell`)
- [X] Une seule couche interactive : `gridLayer`

##### A.2 Logique de survol sans clignotement ✅

- [X] Pattern robuste : `hoveredCell` et `selectedCell` comme références
- [X] `handleMouseOver()` : applique style survol directement sur le layer
- [X] `handleMouseOut()` : restaure style par défaut (sauf si sélectionné)
- [X] `handleClick()` : gère la sélection sans couche supplémentaire

##### A.3 Nettoyage handlers carte ✅

- [X] `zoomend` : réinitialise survol, redessine mailles (sauf sélectionnée)
- [X] `movestart` : réinitialise survol
- [X] `clearHoverAndSelection()` : utilise les nouvelles variables

---

#### 📊 Chantier B – Données : unifier les stats & éliminer les undefined ✅

**Problème** : `undefined` affiché pour Proctor/Granulo/Gonflement dans stats globales

##### B.1 Types et helpers centralisés ✅

- [X] Nouveau fichier `cell-metrics.ts` avec :
  - `EssaisTypeCounts` : 6 types d'essais
  - `CellMetrics` : métriques complètes d'une maille
  - `normalizeEssaisTypes()` : garantit jamais undefined
  - `fmtNumber()` : formatage avec '—' si null
  - `computeCellMetrics()` : calcul unique depuis données API
  - `buildSynthese()` : génération synthèse textuelle

##### B.2 Normalisation API globale ✅

- [X] `global-stats.ts` : normalise `essais_par_type` avec `normalizeEssaisTypes()`
- [X] Profondeur et argilosité normalisées avec `?? null`

---

#### 🧱 Chantier C – Panneau maille : structure ingénieur ✅

**Problème** : Calculs dispersés, risque d'incohérence

##### C.1 Pipeline clair côté frontend ✅

- [X] `loadMailleDetails()` appelle `computeCellMetrics()` une seule fois
- [X] Toutes les fonctions de rendu utilisent `CellMetrics`

##### C.2 Fonctions de rendu modulaires ✅

- [X] `renderMailleHeader()` : en-tête avec badges
- [X] `renderMailleKpis()` : compteurs sondages/échantillons/essais
- [X] `renderMailleDepth()` : profondeur min/moy/max + histogramme
- [X] `renderMailleEssaisParType()` : 6 types avec opacité
- [X] `renderMailleArgilosite()` : VBS moy, % argileux, IP moy
- [X] `renderMailleSynthese()` : utilise `buildSynthese()`
- [X] `renderMailleSondages()` : liste des sondages
- [X] `renderMailleEchantillons()` : tableau échantillons

##### C.3 Synthèse robuste ✅

- [X] `buildSynthese()` dans `cell-metrics.ts`
- [X] Toujours présente dès qu'il y a au moins 1 sondage
- [X] Niveaux : complet → intermédiaire → minimal

---

#### ✅ Résumé actions concrètes

| Priorité | Action                                        | Statut |
| -------- | --------------------------------------------- | ------ |
| 1        | Supprimer hoverLayer (clignotement)           | ✅     |
| 2        | Pattern robuste survol/clic                   | ✅     |
| 3        | Normaliser essais_par_type (plus de undefined)| ✅     |
| 4        | Créer cell-metrics.ts (source unique)         | ✅     |
| 5        | Refactorer loadMailleDetails avec metrics     | ✅     |
| 6        | Fonctions de rendu modulaires                 | ✅     |
| 7        | Synthèse toujours présente                    | ✅     |

---

### ✅ ROADMAP v3.9 - Améliorations UX & Workflow (2025-11-26)

**Objectif** : Améliorer l'expérience utilisateur et le workflow maille → sondages

---

#### 📊 Chantier 1 – Stats essais complètes (6 types) ✅

- [X] API `/stats/global` expose Proctor, Granulo, Gonflement
- [X] Vue matérialisée `mv_mailles_geotech` compte les 6 types
- [X] UI normalise les données (plus de `undefined`)
- [X] Bins de profondeur adaptés : 0-1 / 1-1.5 / 1.5-2 / >2

#### 🎨 Chantier 2 – Légende mailles ✅

- [X] Couleur bleue (#4c6ef5) pour mailles ADM/random
- [X] Légende HTML mise à jour

#### 🗺️ Chantier 3 – Tuiles online/offline ✅

- [X] Service `tileserver` dans docker-compose (profile "tiles")
- [X] Module `tile-manager.ts` avec bascule automatique
- [X] Contrôle Leaflet pour changer de mode (auto/online/offline)
- [X] Détection `navigator.onLine` et fallback sur erreur

#### 🔗 Chantier 4 – Workflow Maille → Sondages manager ✅

##### 4.1 Backend

- [X] Migration 047 : remplir `grid_code` pour sondages existants
- [X] Trigger `trg_set_sondage_grid_code` pour nouveaux sondages
- [X] Paramètre `grid_code` sur `GET /sondages`

##### 4.2 Frontend

- [X] Bouton "📂 Gérer" dans panneau maille (visible si sondages)
- [X] Navigation vers `#/sondages?grid=<code>`
- [X] `SondagesManagerPage` lit le paramètre `grid` de l'URL
- [X] `SondagesListPanel.setGridCodeFilter()` pour filtrer
- [X] Bandeau bleu avec filtre actif + bouton "✕ Retirer le filtre"

---

#### ✅ Résumé actions concrètes

| Priorité | Action                                        | Statut |
| -------- | --------------------------------------------- | ------ |
| 1        | API expose 6 types d'essais                   | ✅     |
| 2        | Légende bleue pour mailles random             | ✅     |
| 3        | Module tile-manager.ts                        | ✅     |
| 4        | Migration grid_code + trigger                 | ✅     |
| 5        | Paramètre grid_code sur API sondages          | ✅     |
| 6        | Bouton "Gérer" dans panneau maille            | ✅     |
| 7        | Bandeau filtre maille dans liste sondages     | ✅     |

---

### ✅ ROADMAP v3.9.1 - Corrections & Améliorations (2025-11-26)

**Objectif** : Corriger les problèmes identifiés lors de la revue de code

---

#### 🔧 Corrections apportées

##### 1. Stats globales - COUNT DISTINCT (plus de double comptage)

- [X] Requête SQL séparée pour compter les essais directement dans les tables
- [X] Résultats corrects : granulo=249, gonflement=228, atterberg=51, vbs=502, classif=250
- [X] Plus de SUM sur la vue matérialisée (qui gonflait les chiffres)

##### 2. Bouton Sondages → Navigation directe (plus de modal)

- [X] `right-panel.ts` : bouton "Sondages" navigue vers `#/sondages?grid=<code>`
- [X] Plus besoin de passer par le modal central
- [X] Si une maille est sélectionnée, le filtre est automatiquement appliqué

##### 3. Recherche par grid_code dans API /sondages

- [X] Le paramètre `search` inclut maintenant : code, localité, adm3_name ET grid_code
- [X] On peut coller `TG-0753-0209-01` dans la barre de recherche

##### 4. Contrôle tuiles - Style lisible

- [X] Fond clair (#f9fafb) avec texte foncé
- [X] Bordure et ombre pour contraste sur carte sombre
- [X] Couleurs de statut : vert (online), orange (offline), violet (auto)
- [X] Effet hover

##### 5. Tileserver Docker - Configuration corrigée

- [X] Utilisation de variable d'environnement `MBTILES_FILE` au lieu d'arguments
- [X] Service accessible sur http://localhost:8081/

---

#### ✅ Tests curl validés

```bash
# Stats globales avec COUNT DISTINCT
curl "http://localhost:8000/stats/global"
# → granulo:249, gonflement:228 (valeurs correctes)

# Recherche par code maille
curl "http://localhost:8000/sondages?search=TG-0575-0220-01"
# → Retourne le sondage "Katore"

# Tileserver
curl "http://localhost:8081/"
# → 200 OK
```

---

### ✅ ROADMAP v3.9.2 - Onglet Nouveau Sondage + Corrections (2025-11-26)

#### 🔧 Corrections apportées

##### 1. Router - Support des query params
- [X] Le router matche maintenant sur le path sans les query params
- [X] Route `/sondages?grid=XXX` fonctionne correctement
- [X] Nouvelle méthode `getQueryParams()` pour récupérer les params

##### 2. Tuiles offline - Auto-configuration via TileJSON
- [X] Nouvelle fonction `initOfflineTiles()` qui récupère le TileJSON du tileserver
- [X] Configuration automatique de l'URL, minZoom (5), maxZoom (15), bounds
- [X] Fallback gracieux si tileserver indisponible (reste sur OSM)
- [X] Contrôle affiche le statut du tileserver (disponible ou non)
- [X] Plus de carte grise : zooms et bounds respectés

##### 3. Onglet "Nouveau Sondage Géotechnique"
- [X] Ajouté dans la sidebar du gestionnaire sondages
- [X] Réutilisation du composant `GeotechnicalFormManager` existant
- [X] Formulaire complet avec :
  - Informations générales (code, date, type de sol, source, opérateur, notes)
  - Mode de localisation (GPS exact, ADM, centroïde, aléatoire)
  - Sélection de maille sur carte
  - Gestion des profondeurs et essais
  - Classifications géotechniques
- [X] Rafraîchissement automatique de la liste après création

---

**Dernière mise à jour** : 2025-11-26 13:50
**Statut global** : 🚀 v3.9.2 - Onglet Nouveau Sondage + Corrections COMPLET ✅
