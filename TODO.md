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
- [ ] **Zoom & highlight ADM3** : Implémentation à compléter
- [ ] **Highlight maille** : Clignotement cellule grille à ajouter

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

#### 🔧 Chantier 1 : Nettoyer le panneau "Statistiques (filtrées)" ⏳

##### 1.1 Répartition des essais
- [ ] Retirer "Physiques" de l'affichage (garder en API)
- [ ] Afficher uniquement : Atterberg | VBS | Classif
- [ ] Barre colorée avec 3 segments seulement

##### 1.2 Profondeurs d'investigation (global)
- [ ] Renommer en **"📏 Profondeurs d'investigation (global – filtres ADM)"**
- [ ] Garder histogramme global Chart.js
- [ ] Ajouter sous-titre : "Calculé sur X échantillons filtrés"

##### 1.3 Indicateur d'argilosité (global)
- [ ] Renommer en **"💧 Indicateur d'argilosité (global – filtres ADM)"**
- [ ] Conserver phrase d'interprétation
- [ ] Ajouter sous-titre : "Calculé sur X échantillons / Y essais filtrés"

##### 1.4 Légende – adapter aux vraies couleurs
- [ ] Remplacer légende actuelle par 3 lignes :
  - `mailles avec sondages (localisation exacte)` → couleur has_exact
  - `mailles avec sondages (ADM / random cell)` → couleur has_random
  - `mailles sans sondages` → couleur no-data

---

#### 🧱 Chantier 2 : Nouvelle structure fiche maille (sans onglets) ⏳

##### 2.0 État initial
- [ ] Message "Cliquez sur une maille pour afficher la fiche géotechnique" quand aucune maille sélectionnée

##### 2.1 En-tête – Identité maille
- [ ] Code maille (badge)
- [ ] Chemin ADM : `Région > Préfecture > Commune`
- [ ] Badge données : `avec données` / `sans données`
- [ ] Badge localisation : `exact` / `adm_random_cell`

##### 2.2 Instrumentation (KPI)
- [ ] 4 KPI : Sondages | Échantillons | Essais | (retirer % spread si = 0)
- [ ] Ligne résumé : "Données issues de X sondage(s), Y échantillon(s), Z essai(s)"

##### 2.3 Profondeur d'investigation – maille
- [ ] Calculer min/max/moy depuis `samples[]` ou `overview.depth_hist`
- [ ] Mini histogramme local (0-3 / 3-6 / 6-10 / >10m)
- [ ] Backend : ajouter `depth_stats_cell` dans `/cells/{code}/complete`

##### 2.4 Essais par type – maille
- [ ] Compteurs dérivés de `samples[]` :
  - Atterberg : count(sample.atterberg != null)
  - VBS : count(sample.vbs != null)
  - Classif : count(sample.classif != null)
  - Proctor / Granulo / Gonflement : plus tard
- [ ] Affichage : `Atterberg: 0 | VBS: 3 | Classif: 0` (0 en gris/italic)

##### 2.5 Indicateurs d'argilosité – maille
- [ ] Calculer VBS_moy depuis `overview.vbs[]`
- [ ] Calculer % argileux (VBS > 2.5) pour la maille
- [ ] IP_moy si Atterberg disponible
- [ ] Backend : ajouter `argilosite_cell` dans `/cells/{code}/complete`

##### 2.6 Liste des sondages de la maille
- [ ] Afficher depuis `surveys[]` :
  - code_site
  - mode (exact / adm_random_cell)
  - samples count
  - tests count

##### 2.7 Échantillons & essais (bloc repliable)
- [ ] Tableau : Profondeur | VBS | IP | remarques
- [ ] Section repliable (fermée par défaut)

##### 2.8 Mailles voisines (optionnel)
- [ ] Garder bloc existant, re-stylé
- [ ] Format : `↑ TG-xxxx à 1.2 km – Sondages: 1, Essais: 9`

---

#### 🧠 Chantier 3 : Synthèse automatique TOUJOURS présente ⏳

**Objectif** : Ne plus jamais afficher "Pas encore de synthèse disponible"

##### 3.1 Logique 3 niveaux dans `cell-summary.ts`
- [ ] **Niveau 3 – Complet** (profondeur + VBS_moy ou IP_moy) :
  > "Maille instrumentée : 1 sondage, 3 échantillons, 9 essais VBS.
  > Investigations entre 1 et 2 m (moy. 1.5 m). Sols globalement argileux (VBS moyen 4.3 g/100g) – plasticité moyenne à élevée."

- [ ] **Niveau 2 – Intermédiaire** (profondeur OU argilosité) :
  > "Maille instrumentée : 1 sondage, 3 échantillons, 9 essais.
  > Profondeurs d'investigation : 1–2 m, maille peu explorée en profondeur."

- [ ] **Niveau 1 – Minimal** (seulement KPI) :
  > "Maille instrumentée : 1 sondage, 3 échantillons, 9 essais.
  > Pas encore d'indicateurs synthétiques (VBS, limites d'Atterberg, etc.)."

##### 3.2 Implémentation
- [ ] Modifier `buildCellSummary()` pour ne jamais retourner null
- [ ] Commencer par niveau 3, descendre si données manquantes
- [ ] Retirer message "Pas encore de synthèse…" de l'UI

---

#### 🗄️ Chantier 4 : Backend – ajustements minimum ⏳

##### 4.1 `/cells/{code}/complete` – enrichir réponse
- [ ] Ajouter `depth_stats_cell` : { min_m, max_m, moy_m }
- [ ] Ajouter `argilosite_cell` : { vbs_moyen, pct_argileux, ip_moyen }
- [ ] Calculer en Rust depuis données existantes (pas de nouvelle vue SQL)

##### 4.2 `/stats/global` – RAS
- [X] Déjà OK : compteurs, histogramme, argilosité
- [ ] Juste s'assurer que les labels UI mentionnent "(global)"

##### 4.3 Légende
- [ ] Pas de changement backend, uniquement UI

---

#### ✅ Résumé actions concrètes

| Priorité | Action | Fichier(s) |
|----------|--------|------------|
| 1 | Retirer "Physiques" de répartition essais | `index.html`, `global-stats.ts` |
| 2 | Renommer titres avec "(global – filtres ADM)" | `index.html` |
| 3 | Adapter légende 3 couleurs | `index.html`, `main.ts` |
| 4 | Supprimer onglets fiche maille | `index.html`, `main.ts` |
| 5 | Créer nouvelle structure fiche maille | `main.ts` |
| 6 | Backend : ajouter `depth_stats_cell` + `argilosite_cell` | `cells_labs.rs` |
| 7 | Synthèse 3 niveaux (jamais null) | `cell-summary.ts` |
| 8 | Retirer % spread si = 0 | `main.ts` |

---

#### Note sur % SPREAD

Le KPI "% spread" représente la part de données "diffusées/virtuelles" dans une maille.
- **Aujourd'hui** : toutes les données viennent de sondages réels → % spread = 0% partout
- **Action** : masquer ce KPI tant que `nb_sondages_spread = 0`
- **Plus tard** : réactiver quand pipeline de diffusion ADM3/IA sera en place

---

**Dernière mise à jour** : 2025-11-25 21:15
**Statut global** : 🚀 v3.6.0 - Panneau ingénieur en cours (4 chantiers définis)
