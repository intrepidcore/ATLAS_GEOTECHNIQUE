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

### ✅ ROADMAP v3.9.3 - Cartes Thématiques Refactor (2025-11-26)

#### 🔧 Phase 1 : Vue matérialisée complète (Migration 044)

##### Problème identifié
- La vue `mailles_geotechnique_stats` utilisait l'ancienne table `essais_geotechniques`
- Les nouvelles tables source of truth (`essais_atterberg`, `essais_vbs`, etc.) n'étaient pas agrégées
- Résultat : cartes thématiques "belles mais fausses"

##### Solution implémentée
- [X] Nouvelle vue matérialisée `atlas.mv_mailles_geotech` avec agrégats complets
- [X] CTEs pour chaque type d'essai (Atterberg, VBS, Proctor, Gonflement, Granulo, Classif)
- [X] Vue de compatibilité `mailles_geotechnique_stats_wgs84` pour l'API existante
- [X] Fonction `refresh_mv_mailles_geotech()` pour rafraîchissement

##### Colonnes disponibles pour cartes thématiques
- **Instrumentation** : n_sondages, n_echantillons, n_essais_total, n_essais_* par type
- **Profondeur** : depth_min_m, depth_max_m, depth_mean_m
- **Atterberg** : wl_avg, wp_avg, ip_avg, ip_min, ip_max, ip_stddev
- **VBS** : vbs_avg, vbs_min, vbs_max, vbs_stddev + comptages par classe
- **Proctor** : gamma_d_max_avg, w_opt_avg
- **Gonflement** : eg_avg, eg_min, eg_max + comptages par classe
- **Granulo** : passant_80um_avg, passant_2mm_avg, passant_20mm_avg
- **Qualité** : has_data, has_exact_location, has_random_location

##### Résultats après migration
- 29407 mailles totales
- 106 mailles avec données
- 114 sondages, 306 échantillons, 991 essais
- API `/thematic/data` fonctionne avec tous les paramètres

#### 🔧 Phase 2 : UI Panneau Thématique v2.0

##### Refactorisation complète du panneau
Organisation en 4 blocs métier pour ingénieurs géotechniciens :

**Bloc A - Objectif métier**
- [X] Sélecteur d'objectif : Couverture, Argilosité, Gonflement, Compacité, Granulométrie, Personnalisé
- [X] Paramètres filtrés par objectif avec description et formule
- [X] Palette par défaut selon l'objectif

**Bloc B - Style & Classification**
- [X] Types de carte : Choroplèthe, Cercles proportionnels, Binaire
- [X] Méthodes : Quantiles, Intervalles égaux, Jenks, Seuils manuels
- [X] Nombre de classes (3-9)
- [X] Palettes avec preview
- [X] Slider opacité avec affichage %

**Bloc C - Filtres**
- [X] Filtres géographiques (ADM1/2/3)
- [X] Sondages minimum (échelle 1-5 pour n_sondages)
- [X] Checkbox "Exclure mailles sans données"
- [X] Filtres avancés repliables (profondeur min/max)

**Bloc D - Actions & Exports**
- [X] Boutons Appliquer / Auto-Zoom / Réinitialiser
- [X] Sauvegarde configuration
- [X] Export GeoJSON / PNG

##### Corrections apportées
- [X] Classification avec breaks par défaut pour n_sondages (1, 2, 3, 4, 5)
- [X] Légende avec contraste automatique du texte (noir/blanc selon luminosité)
- [X] Affichage du nom du paramètre et de l'unité dans la légende
- [X] Styles CSS complets pour le panneau et la légende

#### 🔧 Phase 2.1 : Corrections cartes thématiques (2025-11-26)

##### 1. Cercles proportionnels corrigés
- [X] Mailles en fond gris clair avec contour fin (couche polygonLayer)
- [X] Cercles L.circleMarker au centroïde de chaque maille (couche circleLayer)
- [X] Rayon proportionnel à √valeur (perception visuelle correcte)
- [X] Couleur issue de la palette de classification

##### 2. Carte binaire (présence/absence)
- [X] 2 classes uniquement : < seuil (gris) / ≥ seuil (vert)
- [X] Seuil par défaut = médiane (configurable via binary_threshold)
- [X] Méthode et nombre de classes grisés quand type = binary

##### 3. Cascade ADM1 → ADM2 → ADM3
- [X] ADM1 change → recharge ADM2 via API `/adm/adm2?adm1_code=`
- [X] ADM2 change → recharge ADM3 via API `/adm/adm3?adm2_code=`
- [X] Reset cascade si "toutes régions" sélectionné

##### 4. Algorithme de classes anti-dégénérées
- [X] Fonction `sanitizeBreaks()` : supprime doublons, arrondit à 1 décimale
- [X] Réduction automatique du nombre de classes si données concentrées
- [X] Labels lisibles : ≤ b0, b0-b1, ..., > bN
- [X] Log console si classes réduites

##### Fichiers modifiés
- `ui/src/thematic/thematic-types.ts` - Nouveaux types métier (ObjectifMetier, etc.)
- `ui/src/thematic/thematic-panel.ts` - Panneau refactorisé avec 4 blocs + cascade ADM
- `ui/src/thematic/thematic-maps.ts` - Cercles proportionnels, binaire, sanitizeBreaks
- `ui/index.html` - Styles CSS complets pour panneau v2.0

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

---

## 🔧 ROADMAP v3.0.1 - Corrections Export Rapide (2025-12-13)

**Objectif** : Corriger les problèmes identifiés lors des premiers tests de l'export rapide MVP.

---

### 🐛 Problèmes identifiés

| Priorité | Problème | Cause |
|----------|----------|-------|
| 🔴 Haute | Légende vide dans l'export | `getLegendHtml()` capture un div vide, pas les classes thématiques |
| 🔴 Haute | Couche thématique non visible | html2canvas ne capture pas correctement les layers Leaflet SVG/Canvas |
| 🟡 Moyenne | Grille de fond (mailles) visible | Surcharge visuelle, devrait être masquée pendant l'export |
| 🟡 Moyenne | Export QGIS échoue (500) | Colonne `geom_4326` inexistante côté backend |
| 🟢 Basse | Cartouche incomplet | Manque SCR des données (25231) et filtres ADM actifs |

---

### ✅ Corrections à implémenter

#### 3.0.1.1 Légende reconstruite depuis config thématique
- [X] Ne plus capturer le HTML de la légende existante
- [X] Récupérer `ThematicExportState` avec classes, couleurs, labels
- [X] Dessiner la légende programmatiquement dans le canvas d'export
- [X] Inclure : titre paramètre, unité, classes avec couleurs

#### 3.0.1.2 Masquer grille de fond pendant l'export
- [X] Avant capture : désactiver temporairement `gridLayer` (mailles sans données)
- [X] Après capture : restaurer l'état précédent
- [X] Option dans le dialogue : "Masquer grille de fond" (coché par défaut)

#### 3.0.1.3 Améliorer le cartouche
- [X] Ajouter "SCR des données : UTM 31N (EPSG:25231)"
- [X] Afficher les filtres ADM actifs si présents
- [X] Format : "Zone : Région Maritime / Préfecture de Zio"

#### 3.0.1.4 Calcul grille intelligent (nice step)
- [X] Fonction `niceStep(rawStep)` : normalise en 10^n × {1, 2, 5}
- [X] Cible 8-12 lignes de grille sur le côté le plus court
- [X] Exemples : 0.037° → 0.05°, 2300m → 2000m

#### 3.0.1.5 Correction export QGIS (backend)
- [X] Corriger requête SQL : `geom_4326` → `geom` (la vue utilise `geom` pas `geom_4326`)
- [X] Rebuild API Rust en release

---

#### 3.0.1.6 Capture couche thématique (Canvas Leaflet)
- [X] Fonction `prepareSvgForCapture()` pour forcer styles inline SVG
- [X] Gestion des Canvas Leaflet (preferCanvas: true)
- [ ] **À TESTER** : Vérifier si les polygones colorés sont maintenant capturés

---

### 🔧 CORRECTIONS v3.0.4 - ADM Centré + Grille Visible

#### 3.0.4.1 ADM centré en grand (Zone filtrée)
**Problème** : "Zone filtrée (Maritime)" utilise l'extent actuel de la carte, pas le bbox du polygone ADM.
**Solution** : Calculer le bbox du polygone ADM + marge 5-10%

- [X] Récupérer géométrie ADM via `getAdmOverlayBounds()` dans ThematicMapManager
- [X] Calculer bbox : `minX, minY, maxX, maxY`
- [X] Ajouter marge de confort :
  ```
  marginFactor = 0.08 (8%)
  minX' = minX - marginFactor * (maxX - minX)
  maxX' = maxX + marginFactor * (maxX - minX)
  (idem pour Y)
  ```
- [ ] Choisir orientation automatique :
  - ratio > 1.2 → paysage
  - ratio < 0.8 → portrait
- [X] Fixer cette extent pour l'export (ignorer zoom actuel)
- [ ] Ajouter dans cartouche : "Zone : Région Maritime (ADM1)"

#### 3.0.4.2 Améliorer visibilité grille de coordonnées
**Problème** : Les croix de grille sont très peu visibles sur le fond OSM.
**Solution** : Augmenter opacité et épaisseur

- [X] Couleur grille : `rgba(0,0,0,0.6)` au lieu de gris clair
- [X] Type Croix :
  - Longueur bras : 6px (au lieu de 4px)
  - Épaisseur : 1.5px
- [X] Type Continue :
  - Épaisseur : 0.7px à 300dpi
- [ ] Si "Masquer grille de fond" coché → augmenter opacité à 0.7

#### 3.0.4.3 Algorithme niceStep amélioré
**Problème** : Pas de grille pas toujours "propre" (0.10°, 0.20°, 0.50°)
**Solution** : Forcer les pas standards

- [ ] Pas autorisés pour 4326 : `[0.01, 0.02, 0.05, 0.10, 0.20, 0.50, 1.0]`
- [ ] Pas autorisés pour 25231 : `[100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000]`
- [ ] Viser 6-8 lignes par axe
- [ ] Aligner sur valeurs rondes : `x0 = floor(minX / step) * step`

#### 3.0.4.4 Cohérence pas X et Y
- [ ] Utiliser le même pas pour X et Y si possible
- [ ] Sinon, utiliser des pas du même ordre de grandeur

---

### 📁 Fichiers modifiés

- `ui/src/export/export-frame.ts` - Légende reconstruite, cartouche amélioré, hauteur augmentée
- `ui/src/export/grid-generator.ts` - Fonction niceStep()
- `ui/src/export/export-quick-dialog.ts` - Option masquer grille, gestion gridLayer
- `ui/src/export/capture-utils.ts` - prepareSvgForCapture() pour Canvas/SVG Leaflet
- `ui/src/thematic/thematic-panel.ts` - Passage ThematicExportState au dialogue
- `services/api-geo/src/thematic/export.rs` - Fix geom_4326 → geom

---

---

## 🗺️ ROADMAP v3.0 - Système d'Export Géoréférencé Pro

**Objectif** : Transformer Atlas Géotechnique en outil de production cartographique professionnel avec exports géoréférencés dignes de rapports d'ingénierie.

---

### 📋 Vue d'ensemble des 2 modules d'export

| Module | Objectif | Complexité | Priorité |
|--------|----------|------------|----------|
| **Export Rapide** | 1-2 clics pour image propre (mail, WhatsApp, rapport rapide) | Moyenne | P1 |
| **Mise en Page Avancée** | Page dédiée QGIS-like pour rapports pro | Haute | P2 |

---

### 🔹 MODULE 1 : Export Rapide ✅ IMPLÉMENTÉ (v3.0.1-v3.0.3)

**Route** : Bouton "Export Pro (PNG/PDF)" dans panneau Cartes Thématiques

**Status** : ✅ MVP Fonctionnel - En cours de stabilisation

---

#### 1.1 UI - Mini-dialogue d'export ✅

##### 1.1.1 Composant dialogue ✅
- [X] Créer composant `ExportQuickDialog` dans `ui/src/export/`
- [X] Bouton déclencheur "Export Pro (PNG/PDF)" dans panneau thématique
- [X] Modal léger avec formulaire compact
- [X] Fermeture : bouton X, clic extérieur, ESC

##### 1.1.2 Options du dialogue ✅
- [X] **Format** : Select `PNG` / `PDF`
- [X] **Qualité** : Select `Standard (web 72dpi)` / `Impression (300dpi)`
- [X] **Zone** :
  - [X] Radio `Vue actuelle` (défaut)
  - [X] Radio `Zone filtrée (ADM en cours)`
- [X] **Options checkboxes** :
  - [X] `[x] Inclure la légende` (défaut: coché)
  - [X] `[x] Afficher titre` (défaut: coché)
  - [X] `[ ] Afficher statistiques globales`

##### 1.1.3 Options grille & coordonnées ✅
- [X] **SCR / Coordonnées** :
  - [X] Select `WGS84 – EPSG:4326` / `UTM 31N – EPSG:25231`
- [X] **Grille** : Select
  - [X] `Croix` (défaut)
  - [X] `Continue`
  - [X] `Labels uniquement`
  - [X] `Aucune`
- [X] **Cadre** : Select
  - [X] `Simple` / `Double` / `Zébré` (style QGIS)
- [X] **Checkboxes** :
  - [X] `[x] Afficher coordonnées autour du cadre`
  - [X] `[x] Afficher barre d'échelle`
  - [X] `[x] Afficher SCR et sources`
  - [X] `[x] Masquer grille de fond (mailles)` ← v3.0.1

---

#### 1.2 Génération du canevas d'export ✅

##### 1.2.1 Structure HTML du canevas ✅
- [X] Classe `ExportFrame` dans `ui/src/export/export-frame.ts`
- [X] Structure Canvas avec layout calculé dynamiquement
- [X] Fond blanc, marges 15px
- [X] Cadre autour de la zone carte (simple/double/zébré)

##### 1.2.2 Titre automatique ✅
- [X] Générer titre depuis `ThematicExportState.parameterLabel`
- [X] Générer sous-titre depuis filtres ADM actifs
- [X] Police : titre 18px bold, sous-titre 12px regular

##### 1.2.3 Cartouche standardisé ✅
- [X] Position : bas droit, sous la carte
- [X] Contenu :
  - [X] `Source : Atlas Géotechnique v2.6.0`
  - [X] `Fond : © OpenStreetMap contributors`
  - [X] `SCR : WGS84 (EPSG:4326)` ou `UTM 31N (EPSG:25231)`
  - [X] `Données : UTM 31N (EPSG:25231)` ← v3.0.1
  - [X] `Date : JJ/MM/AAAA`
  - [X] Barre d'échelle graphique
  - [X] Flèche du Nord

##### 1.2.4 Légende reconstruite ✅ (v3.0.1)
- [X] Récupérer classes depuis `ThematicExportState.classes`
- [X] Dessiner légende programmatiquement (pas de capture HTML)
- [X] Titre = parameterLabel + unit
- [X] Boîtes de couleur + labels pour chaque classe

---

#### 1.3 Algorithme de grille automatique ✅

##### 1.3.1 Récupération de l'emprise ✅
- [X] Récupérer `bounds` depuis Leaflet (en 4326)
- [X] Calculer largeur/hauteur de l'emprise

##### 1.3.2 Calcul du pas de grille ✅ (v3.0.1)
- [X] Fonction `niceStep(rawStep)` : normalise en 10^n × {1, 2, 5}
- [X] `computeOptimalStep()` avec targetDivisions = 5
- [X] Liste des pas "propres" par SCR :
  - SCR mètres (25231) : `[100, 200, 250, 500, 1000, 2000, 5000, 10000, 20000, 50000]`
  - SCR degrés (4326) : `[0.001, 0.002, 0.005, 0.01, 0.02, 0.05, 0.1, 0.2, 0.5, 1]`
- [X] `adjustStepForMaxLines()` : max 10 lignes

##### 1.3.3 Génération des éléments de grille ✅
- [X] **Type Croix** : croix aux intersections
- [X] **Type Continue** : lignes complètes
- [X] **Type Labels uniquement** : pas de lignes
- [X] Fonctions `renderGrid()` dans `grid-generator.ts`

##### 1.3.4 Étiquettes de coordonnées ✅
- [X] Position : autour du cadre (4 côtés configurables)
- [X] Format selon SCR :
  - 25231 : `123 400 m`
  - 4326 : `6.234°E`, `1.207°N`

##### 1.3.5 Cadre de la carte ✅
- [X] **Simple** : rectangle 1px noir
- [X] **Double** : 2 rectangles
- [X] **Zébré** : alternance noir/blanc (style QGIS)

---

#### 1.4 Capture et téléchargement ✅

##### 1.4.1 Mode capture frontend ✅
- [X] `captureLeafletMap()` dans `capture-utils.ts`
- [X] Masquer contrôles Leaflet, panneaux, modals
- [X] `waitForTilesLoaded()` : attendre chargement tuiles
- [X] `prepareSvgForCapture()` : forcer styles inline SVG/Canvas ← v3.0.3

##### 1.4.2 Génération PNG ✅
- [X] html2canvas via CDN
- [X] Options : `scale: 1|3`, `useCORS: true`, `backgroundColor: '#ffffff'`
- [X] `downloadDataURL()` pour téléchargement
- [X] Nom fichier : `atlas_<theme>_<zone>_<date>.png`

##### 1.4.3 Génération PDF simple ✅
- [X] jsPDF via CDN
- [X] `generatePdf()` : PNG → PDF A4/A3
- [X] Centrage automatique dans la page
- [X] Métadonnées PDF (titre, auteur)

##### 1.4.4 Gestion CORS tuiles ✅
- [X] `useCORS: true` dans html2canvas
- [X] Tileserver local NextGIS disponible

##### 1.4.5 Problèmes connus 🔧
- [ ] **Couche thématique non capturée** : html2canvas ne capture pas toujours les Canvas Leaflet (preferCanvas: true)
  - Solution potentielle : leaflet-image ou capture directe du Canvas

---

### 🔹 MODULE 2 : Mise en Page Avancée (QGIS-like)

**Route** : `/print-layout` (page dédiée)

---

#### 2.1 Navigation et structure de page

##### 2.1.1 Accès à la page
- [ ] Bouton "Mise en page avancée (QGIS)" dans panneau Exports
- [ ] Route `#/print-layout` dans le router
- [ ] Créer composant `PrintLayoutPage` dans `ui/src/print-layout/`

##### 2.1.2 Layout 3 colonnes
- [ ] **Colonne gauche (300px)** : Paramètres
- [ ] **Zone centrale (flex)** : Canevas WYSIWYG
- [ ] **Colonne droite (200px)** : Actions
- [ ] Header avec bouton retour vers carte principale

---

#### 2.2 Colonne gauche - Paramètres

##### 2.2.1 Bloc "Mise en page"
- [ ] **Format** : Select `A4` / `A3`
- [ ] **Orientation** : Radio `Portrait` / `Paysage`
- [ ] **Marges** : Input numérique (mm), défaut 10mm
- [ ] Preview dimensions en pixels

##### 2.2.2 Bloc "Zone d'export" (CRITIQUE)
- [ ] **Mode** : Select
  - [ ] `Vue actuelle` (viewport Leaflet)
  - [ ] `ADM1 (Région)` → dropdown régions
  - [ ] `ADM2 (Préfecture)` → dropdown préfectures (filtré par ADM1)
  - [ ] `ADM3 (Commune)` → dropdown communes (filtré par ADM2)
  - [ ] `Rectangle manuel` → outil de dessin sur carte
- [ ] **Cascade ADM** :
  - [ ] ADM1 sélectionné → charger ADM2 via API
  - [ ] ADM2 sélectionné → charger ADM3 via API
- [ ] **Buffer automatique** : Input (km), défaut 2km
  - [ ] Ajoute marge autour de l'ADM pour contexte
- [ ] **Afficher contour ADM** : Checkbox
  - [ ] Trace le polygone ADM en trait fort sur la carte

##### 2.2.3 Bloc "Contenu cartographique"
- [ ] **Thématique** : Select (liste des couches existantes)
  - [ ] Nombre de sondages
  - [ ] VBS moyenne
  - [ ] IP moyen
  - [ ] Profondeur max
  - [ ] etc.
- [ ] **Fond de carte** : Select
  - [ ] OSM Standard
  - [ ] OSM Gris (désaturé)
  - [ ] Fond topographique (NextGIS)
  - [ ] Aucun (blanc)

##### 2.2.4 Bloc "Grille & Coordonnées"
- [ ] **Type de grille** : Select
  - [ ] `Aucune`
  - [ ] `Croix` (défaut)
  - [ ] `Continue`
  - [ ] `Symboles`
  - [ ] `Cadre et coordonnées uniquement`
- [ ] **Mode densité** : Select
  - [ ] `Dense` (targetDiv = 7)
  - [ ] `Normal` (targetDiv = 5, défaut)
  - [ ] `Rare` (targetDiv = 3)
- [ ] **Pas personnalisé** : Inputs X/Y (optionnel, override auto)
- [ ] **SCR affiché** : Select
  - [ ] `WGS84 – EPSG:4326`
  - [ ] `Grille nationale – EPSG:25231`
- [ ] **Format coordonnées** : Select
  - [ ] `Décimal` (ex: 6.234)
  - [ ] `Décimal avec suffixe` (ex: 6.234°E)
  - [ ] `Degrés Minutes Secondes`
- [ ] **Côtés visibles** : Multi-select
  - [ ] Gauche, Droite, Haut, Bas
  - [ ] `Tout afficher` / `Extrémités seulement`

##### 2.2.5 Bloc "Cadre"
- [ ] **Style** : Select `Sans` / `Simple` / `Double` / `Zébré`
- [ ] **Épaisseur** : Input (mm)
- [ ] **Couleur** : Color picker

##### 2.2.6 Bloc "Éléments cartographiques"
- [ ] Checkboxes avec positionnement :
  - [ ] `[x] Légende du thème actif` → Position: Select (HG, HD, BG, BD)
  - [ ] `[x] Barre d'échelle` → Position: Select
  - [ ] `[x] Flèche du Nord` → Position: Select
  - [ ] `[x] SCR / système de coordonnées`
  - [ ] `[ ] Logo organisation` → Upload ou défaut Atlas
  - [ ] `[ ] Graticule` (pour grandes zones)
  - [ ] `[ ] Cadre texte libre` → Textarea

##### 2.2.7 Bloc "Cartouche & Titre"
- [ ] **Titre principal** : Input texte
  - [ ] Pré-rempli : `Carte – <nom thématique>`
- [ ] **Sous-titre** : Input texte
  - [ ] Pré-rempli : `<Zone ADM> · Campagnes 2010–2024`
- [ ] **Auteur / Organisme** : Input (optionnel)
- [ ] **Sources** : Textarea
  - [ ] Pré-rempli : `Atlas Géotechnique v2.6.0 / Campagne AMESSEFE`
- [ ] **Date** : Auto (éditable)

##### 2.2.8 Bloc "Statistiques géotechniques"
- [ ] Checkboxes pour inclure dans l'export :
  - [ ] `[ ] Nombre de sondages`
  - [ ] `[ ] Profondeur min / moy / max`
  - [ ] `[ ] VBS moyenne ± écart-type`
  - [ ] `[ ] IP moyenne ± écart-type`
  - [ ] `[ ] % sols argileux (IP > 15, VBS > 3)`
  - [ ] `[ ] # essais par type (Atterberg, VBS, Proctor, etc.)`
- [ ] Ces stats sont calculées via API backend pour la zone sélectionnée

---

#### 2.3 Zone centrale - Canevas WYSIWYG

##### 2.3.1 Rendu du canevas
- [ ] Rectangle représentant la page (A4/A3, portrait/paysage)
- [ ] Échelle de visualisation ajustable (zoom canevas)
- [ ] Fond blanc avec ombre portée
- [ ] Marges visualisées (lignes pointillées)

##### 2.3.2 Zones du canevas
- [ ] **Zone carte** : ~70% de la hauteur
  - [ ] Carte Leaflet embarquée
  - [ ] Grille et coordonnées superposées
  - [ ] Cadre selon style choisi
- [ ] **Zone cartouche** : bas droit
  - [ ] Titre, sous-titre, sources, date
  - [ ] Logo, échelle, nord
- [ ] **Zone stats** : bas gauche (si activé)
  - [ ] Tableau des KPI géotechniques
- [ ] **Zone légende** : position configurable

##### 2.3.3 Interactions canevas
- [ ] Drag & drop pour repositionner éléments (optionnel v2)
- [ ] Resize des zones (optionnel v2)
- [ ] Preview temps réel des modifications

---

#### 2.4 Colonne droite - Actions

##### 2.4.1 Boutons d'export
- [ ] **Exporter en PNG** : Bouton principal
- [ ] **Exporter en PDF** : Bouton principal
- [ ] **DPI simulé** : Select `150` / `300` / `600`

##### 2.4.2 Gestion des modèles
- [ ] **Enregistrer ce modèle** : Bouton
  - [ ] Nom du modèle : Input
  - [ ] Sauvegarde JSON des paramètres en BDD
- [ ] **Charger un modèle** : Select
  - [ ] Liste des modèles sauvegardés
  - [ ] Applique tous les paramètres

##### 2.4.3 Actions secondaires
- [ ] **Réinitialiser** : Remet valeurs par défaut
- [ ] **Aperçu plein écran** : Ouvre preview dans nouvel onglet

---

#### 2.5 Backend - API Export

##### 2.5.1 Endpoint `/export/context`
- [ ] Créer route `GET /export/context?adm_level=3&adm_id=199`
- [ ] Retourne :
  ```json
  {
    "bbox": [minX, minY, maxX, maxY],
    "geometry": { "type": "Polygon", "coordinates": [...] },
    "name": "Kovié",
    "code": "TG-MAR-ZIO-KOV",
    "surface_km2": 45.2,
    "path": "Maritime > Zio > Kovié"
  }
  ```
- [ ] Récupérer polygone depuis PostGIS
- [ ] Simplifier géométrie pour affichage (ST_Simplify)

##### 2.5.2 Endpoint `/export/stats`
- [ ] Créer route `GET /export/stats?adm_level=3&adm_id=199` ou `?bbox=...`
- [ ] Retourne stats géotechniques pour la zone :
  ```json
  {
    "n_sondages": 12,
    "n_echantillons": 45,
    "n_essais": 156,
    "depth_min": 0.5,
    "depth_max": 8.0,
    "depth_mean": 2.3,
    "vbs_mean": 4.2,
    "vbs_stddev": 1.8,
    "ip_mean": 22.5,
    "ip_stddev": 8.3,
    "pct_argileux": 65.0,
    "essais_par_type": {
      "atterberg": 34,
      "vbs": 45,
      "proctor": 12,
      ...
    }
  }
  ```
- [ ] Requêtes SQL avec `ST_Within` ou `ST_Intersects` sur la zone

##### 2.5.3 Endpoint `/export/templates`
- [ ] `GET /export/templates` : Liste des modèles sauvegardés
- [ ] `POST /export/templates` : Créer un modèle (JSON params)
- [ ] `DELETE /export/templates/:id` : Supprimer un modèle
- [ ] Table `atlas.export_templates` :
  ```sql
  CREATE TABLE atlas.export_templates (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    params JSONB NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```

---

### 🔹 MODULE 3 : Délimitation par ADM (Clé géotechnique)

---

#### 3.1 Synchronisation filtres UI

##### 3.1.1 Filtres d'affichage vs Zone d'export
- [ ] Clarifier dans l'UI :
  - **Filtres d'affichage** : ce qui apparaît sur la carte (panneau droit actuel)
  - **Zone d'export** : ce qui définit la fenêtre + les stats (module export)
- [ ] Par défaut : Zone d'export = filtres ADM actifs
- [ ] Option de découplage dans mise en page avancée

##### 3.1.2 Réutilisation des sélecteurs ADM
- [ ] Extraire composant `AdmSelector` réutilisable
- [ ] Props : `level`, `parentCode`, `onChange`
- [ ] Cascade automatique ADM1 → ADM2 → ADM3
- [ ] Utiliser dans : panneau filtres, export rapide, mise en page avancée

---

#### 3.2 Affichage du contour ADM

##### 3.2.1 Contour sur la carte exportée
- [ ] Récupérer géométrie ADM via `/export/context`
- [ ] Tracer polygone avec style fort :
  - [ ] Couleur : violet foncé (#6b21a8) ou configurable
  - [ ] Épaisseur : 3px
  - [ ] Style : trait plein
- [ ] Option : remplissage semi-transparent (10% opacité)

##### 3.2.2 Option "Mailles voisines"
- [ ] Checkbox "Afficher mailles voisines hors ADM"
- [ ] Si activé :
  - [ ] Mailles dans l'ADM : couleur normale
  - [ ] Mailles hors ADM (dans bbox) : gris clair (#e5e7eb)
  - [ ] Permet de garder le contexte spatial

---

### 🔹 MODULE 4 : Génération PNG/PDF (Technique)

---

#### 4.1 Stratégie PNG

##### 4.1.1 Librairie de capture
- [ ] Évaluer `html2canvas` vs `dom-to-image-more`
- [ ] Installer la librairie choisie
- [ ] Créer wrapper `captureElement(element, options)`

##### 4.1.2 Gestion haute résolution
- [ ] Option `scale` pour simuler DPI :
  - 72 dpi (web) : scale = 1
  - 150 dpi : scale = 2
  - 300 dpi : scale = 4
- [ ] Attention à la mémoire pour grandes images

##### 4.1.3 Gestion CORS tuiles
- [ ] Détecter erreurs CORS lors de la capture
- [ ] Solutions :
  - [ ] Proxy backend pour tuiles externes
  - [ ] Utiliser tileserver local (NextGIS)
  - [ ] Fallback : fond blanc + message warning
- [ ] Documenter les limitations

---

#### 4.2 Stratégie PDF

##### 4.2.1 PDF côté client (simple)
- [ ] Utiliser `jsPDF`
- [ ] Workflow :
  1. Générer PNG haute résolution
  2. Créer document PDF (A4/A3)
  3. Insérer image centrée
  4. Ajouter métadonnées
- [ ] Limites : pas de vectoriel, taille fichier importante

##### 4.2.2 PDF côté serveur (pro - optionnel v2)
- [ ] Service Node.js avec Puppeteer/Playwright
- [ ] Workflow :
  1. Frontend envoie JSON layout au backend
  2. Backend charge page spéciale `print.html`
  3. Injecte les paramètres
  4. `page.pdf()` génère PDF vectoriel
- [ ] Avantages : PDF propre, texte sélectionnable, petite taille

##### 4.2.3 Endpoint backend PDF (optionnel v2)
- [ ] `POST /export/pdf`
- [ ] Body : JSON avec tous les paramètres de mise en page
- [ ] Retourne : fichier PDF binaire
- [ ] Service séparé (container Node.js avec Puppeteer)

---

### 🔹 MODULE 5 : Géoréférencement Avancé (Phase 2)

---

#### 5.1 World File (PNG géoréférencé)

##### 5.1.1 Génération du world file
- [ ] À côté de `map.png`, générer `map.pgw` :
  ```
  <taille pixel X>
  0
  0
  <taille pixel Y négatif>
  <coord X centre pixel haut-gauche>
  <coord Y centre pixel haut-gauche>
  ```
- [ ] Calculer depuis bbox et dimensions image

##### 5.1.2 Fichier PRJ
- [ ] Générer `map.prj` avec définition WKT du SCR
- [ ] Templates pour EPSG:4326 et EPSG:25231

##### 5.1.3 Export ZIP
- [ ] Bouton "Télécharger PNG géoréférencé"
- [ ] Crée ZIP contenant : `map.png`, `map.pgw`, `map.prj`
- [ ] Utilisable directement dans QGIS/ArcGIS

---

#### 5.2 GeoPDF (optionnel - complexe)

##### 5.2.1 Recherche
- [ ] Étudier format GeoPDF (structure ISO 32000)
- [ ] Évaluer librairies : GDAL, reportlab, etc.
- [ ] Décider si faisable côté backend Python/Node

##### 5.2.2 Implémentation (si faisable)
- [ ] Service backend dédié
- [ ] Génération PDF avec métadonnées géospatiales
- [ ] Test ouverture dans Acrobat / QGIS

---

### 🔹 MODULE 6 : Éléments Cartographiques Pro

---

#### 6.1 Barre d'échelle graphique

##### 6.1.1 Calcul de l'échelle
- [ ] Récupérer échelle depuis Leaflet (`map.getZoom()`, `map.getBounds()`)
- [ ] Calculer distance réelle pour largeur donnée (ex: 100px)
- [ ] Arrondir à valeur "propre" (1km, 2km, 5km, 10km, etc.)

##### 6.1.2 Rendu de la barre
- [ ] Barre horizontale avec graduations
- [ ] Label : `0 ──── 5 km`
- [ ] Style : trait noir 2px, fond blanc semi-transparent
- [ ] Position configurable

---

#### 6.2 Flèche du Nord

##### 6.2.1 Design
- [ ] SVG flèche simple (style classique)
- [ ] Lettre "N" au-dessus
- [ ] Taille : 30-50px

##### 6.2.2 Intégration
- [ ] Position configurable (défaut: haut droit)
- [ ] Rotation si carte non orientée nord (rare)

---

#### 6.3 Graticule (grandes zones)

##### 6.3.1 Quand l'afficher
- [ ] Option activable pour zones > 100km
- [ ] Utile pour cartes régionales/nationales

##### 6.3.2 Rendu
- [ ] Lignes de latitude/longitude
- [ ] Labels aux intersections avec le cadre
- [ ] Style : trait fin pointillé

---

### 📊 Résumé des fichiers à créer

| Fichier | Description |
|---------|-------------|
| `ui/src/export/export-quick-dialog.ts` | Dialogue export rapide |
| `ui/src/export/export-frame.ts` | Canevas d'export avec grille |
| `ui/src/export/grid-generator.ts` | Algorithme de grille automatique |
| `ui/src/export/capture-utils.ts` | Utilitaires html2canvas/jsPDF |
| `ui/src/print-layout/print-layout-page.ts` | Page mise en page avancée |
| `ui/src/print-layout/layout-canvas.ts` | Canevas WYSIWYG |
| `ui/src/print-layout/layout-params.ts` | Panneau paramètres |
| `ui/src/components/adm-selector.ts` | Sélecteur ADM réutilisable |
| `api/src/routes/export.rs` | Routes API export |
| `migrations/050_export_templates.sql` | Table modèles d'export |

---

### 📅 Planning suggéré

| Phase | Contenu | Durée estimée |
|-------|---------|---------------|
| **Phase 1** | Export rapide PNG (sans grille) | 2-3 jours |
| **Phase 2** | Grille automatique + coordonnées | 2-3 jours |
| **Phase 3** | Export rapide PDF + cartouche | 1-2 jours |
| **Phase 4** | Page mise en page avancée (structure) | 3-4 jours |
| **Phase 5** | Paramètres complets + WYSIWYG | 3-4 jours |
| **Phase 6** | API backend stats/context | 2-3 jours |
| **Phase 7** | World file + ZIP géoréférencé | 1-2 jours |
| **Phase 8** | Tests, polish, documentation | 2-3 jours |

**Total estimé** : 16-24 jours de développement

---

### ✅ Critères de validation

- [ ] Export rapide PNG fonctionne en 2 clics
- [ ] Grille et coordonnées lisibles et correctes
- [ ] PDF A4 propre avec cartouche complet
- [ ] Mise en page avancée permet de choisir une ADM3 spécifique
- [ ] Stats géotechniques calculées pour la zone exportée
- [ ] World file permet d'ouvrir le PNG dans QGIS avec géoréférencement correct
- [ ] Modèles d'export sauvegardables et réutilisables
- [ ] Documentation utilisateur complète

---

**Dernière mise à jour** : 2025-12-14 09:30
**Statut global** : 🚀 v3.9.2 - Onglet Nouveau Sondage + Corrections COMPLET ✅ | v3.0.5 Export Géoréférencé Pro - EN COURS

---

## 🗺️ ROADMAP v3.0.5 - Export Atlas Complet + ADM Limitrophes

### 📋 Nouvelles fonctionnalités à implémenter

---

### 3.0.5.1 Statistiques dans l'export ✅ IMPLÉMENTÉ
**Problème** : Case "Statistiques" cochée mais rien ne s'affiche
**Solution** : Implémenter `buildExportStats()` pour chaque thématique

- [X] Créer fonction `buildExportStats(parameterId, features, classes, zoneMeta)` → `export-stats.ts`
- [X] Stats pour `n_sondages` :
  - N_sondages total
  - N_mailles avec données / N_mailles total
  - Couverture %
- [X] Stats pour `vbs_moy` :
  - VBS moyen, min, max
  - % mailles "très argileux"
- [X] Afficher bloc stats à droite de la légende → `drawStats()`
- [X] Hauteur dynamique selon nombre de lignes

---

### 3.0.5.2 ADM Limitrophes (labels sur les bords) ✅ IMPLÉMENTÉ
**Objectif** : Afficher les noms des ADM/pays qui bordent l'ADM exportée

#### Backend - Endpoint `/adm-neighbors`
- [X] Créer endpoint `GET /adm-neighbors?level=adm1&name=Maritime` → `adm_neighbors.rs`
- [X] Requête PostGIS `ST_Touches(geom, geom_cible)` pour voisins
- [X] Calculer point de label sur frontière commune
- [X] Calculer direction (N/S/E/O) depuis centroïde
- [X] Formater labels :
  - ADM1 : "Région ..."
  - ADM2 : "Préfecture de ..."
  - ADM3 : "Commune de ..."
  - Pays : juste le nom (Ghana, Bénin, Burkina Faso)

#### Frontend - Dessin des labels
- [X] `fetchAdmNeighbors()` dans export-quick-dialog.ts
- [X] `drawNeighborLabels()` dans export-frame.ts
- [X] Gestion anti-collision (max 3 labels par côté)
- [X] Style : police 9pt, gris #555555

---

### 3.0.5.3 Masque hors ADM (focus/contexte) ✅ IMPLÉMENTÉ
**Objectif** : Griser/blanchir ce qui est en dehors de l'ADM

- [X] Option "Masque hors ADM" dans Export Pro (select: none/context/focus)
- [X] Deux modes :
  - **Focus** : opacité 85% (ADM très visible, contexte presque invisible)
  - **Contexte léger** : opacité 45% (ADM visible, contexte perceptible)
- [X] `getAdmPolygonCoords()` dans ThematicMapManager
- [X] `drawAdmMask()` dans export-frame.ts avec fill 'evenodd'

---

### 3.0.5.4 Grille continue plus visible ✅ IMPLÉMENTÉ
**Problème** : Opacité grille trop faible
**Solution** : Augmenter opacité à 0.6-0.7

- [X] Grille continue : opacité 0.6 (au lieu de 0.4)
- [X] Épaisseur : 1.0px (au lieu de 0.7px)
- [X] Couleur : noir pur avec opacité

---

### 3.0.5.5 Export Atlas Complet (batch automatique) ✅ IMPLÉMENTÉ
**Objectif** : Un clic pour exporter TOUTES les cartes thématiques du Togo

#### UI - Bouton et dialogue
- [X] Ajouter bouton "📚 Export Atlas complet" dans panneau thématique
- [X] Dialogue de configuration :
  - Niveaux : [x] ADM3, [x] ADM2, [x] ADM1
  - Thématiques : [x] Toutes ou liste à cocher
  - Mode : ( ) Focus / (•) Contexte léger
  - Format : (•) PNG / ( ) PDF
- [X] Bouton "Lancer l'export Atlas"
- [X] Barre de progression avec annulation
- [X] Récupération automatique des listes ADM via API

#### Backend - Job batch
- [ ] Endpoint `POST /thematic/export/atlas` (optionnel - frontend fait le batch)
- [X] Lister ADM3/ADM2/ADM1 via endpoints existants
- [X] Boucle séquentielle frontend avec progression
- [X] Arborescence de sortie ZIP avec JSZip
- [X] Fichier index.json avec métadonnées

#### Config par défaut "Atlas"
- [X] Format : PNG 300dpi
- [X] Zone : ADM + marge 2%
- [X] Grille : Continue, opacité 0.6
- [X] Cadre : Zébré
- [X] Légende : auto
- [X] Stats : incluses
- [X] Masque : mode contexte léger (opacité 0.45)

---

## 🚀 v3.1 - Moteur d'Export Atlas Géotechnique Pro

### 3.1.0 Statistiques enrichies ✅ IMPLÉMENTÉ
**Objectif** : Stats vraiment utiles pour l'ingénieur

#### Backend (api-geo)
- [X] Ajouter `count_total` : nb mailles totales dans la zone
- [X] Ajouter `sum` : somme des valeurs pour densité
- [X] Ajouter `parent_context` : contexte parent pour comparaisons multi-niveaux
  - `level` : adm0/adm1/adm2
  - `parent_name` : nom du parent
  - `parent_sum` : total sondages parent
  - `parent_cells` : total mailles parent

#### Frontend (export-stats.ts)
- [X] Interface `ApiStatistics` avec nouveaux champs
- [X] Interface `ParentContext` pour comparaisons
- [X] Fonctions stats enrichies par thématique
- [X] Calcul couverture correct : `count / count_total`
- [X] Contexte multi-niveaux : part régionale/nationale

---

### 3.1.1 Cadrage dynamique ✅ IMPLÉMENTÉ
**Objectif** : Zone carte adaptée au ratio de l'ADM

- [X] Fonction `computeOptimalMapDimensions(admRatio, dpi, orientation)`
- [X] Dimensions A4 selon DPI (72, 150, 300)
- [X] Carte maximise l'espace disponible sur la page
- [X] Centrage automatique de la carte

---

### 3.1.2 Masque hors ADM - 4 modes ✅ IMPLÉMENTÉ
**Objectif** : Contrôle fin de l'atténuation hors zone

- [X] Mode "Aucun" : pas de masque
- [X] Mode "Contexte léger" : 45% opacité
- [X] Mode "Focus fort" : 85% opacité
- [X] Mode "Découpage strict" : 100% opacité (clip)

---

### 3.1.3 ADM/Pays limitrophes ✅ IMPLÉMENTÉ
**Objectif** : Labels des zones voisines sur les bords

- [X] Checkbox "Afficher ADM/pays limitrophes" dans dialogue
- [X] Voisins externes statiques (Ghana, Bénin, Golfe, Burkina)
- [X] Fallback API pour voisins internes
- [X] Labels avec halo blanc et police italique

---

### 3.1.4 À FAIRE - Prochaines étapes

#### Grille mailles avec/sans données
- [ ] Option "Afficher mailles sans données" dans dialogue
- [ ] Requête API pour récupérer toutes les mailles de l'ADM
- [ ] Style différencié : mailles vides en gris clair

#### Amélioration cadrage
- [ ] Utiliser `computeOptimalMapDimensions` dans le flux d'export
- [ ] Orientation auto (portrait/paysage) selon ratio ADM

#### Export Atlas complet
- [ ] Rebrancher avec nouvelles stats enrichies
- [ ] Utiliser masque et cadrage dynamique
- [ ] Arborescence : `atlas/{parameter}/{level}/ADM_CODE.png`

---

### 📁 Fichiers modifiés v3.1

| Fichier | Modifications |
|---------|---------------|
| `services/api-geo/src/thematic/types.rs` | + Statistics enrichies, ParentContext |
| `services/api-geo/src/thematic/statistics.rs` | + calculate_statistics_extended() |
| `services/api-geo/src/thematic/routes.rs` | + calculate_count_total(), calculate_parent_context() |
| `ui/src/export/export-stats.ts` | Refacto complète avec ApiStatistics |
| `ui/src/export/export-frame.ts` | + computeOptimalMapDimensions(), masque 4 modes |
| `ui/src/export/export-quick-dialog.ts` | + checkbox voisins, select masque 4 modes |
