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
- [x] Analyser la structure actuelle de `public.sondages`
- [x] Documenter les colonnes canon vs legacy
- [x] Décider du rôle de chaque colonne :
  - `code` : identifiant sondage (code_site Excel) ✅
  - `localite_base` : texte brut Excel ✅
  - `localite_key` : version normalisée ✅
  - `adm3_id` / `adm3_name` : lien ADM3 officielle

### 1.2 Nettoyage des données existantes ✅ + compléments
- [x] **Code** : Rempli depuis `meta->>'code'` (123 sondages)
- [x] **Localité brute** : Rempli `localite_base` depuis `meta->>'localite'` (123 sondages)
- [x] **Localité normalisée** : Généré `localite_key` depuis `localite_base` (123 sondages)
- [x] **Contrainte NOT NULL** : Ajoutée sur `code`
- [x] **Index** : Créé sur `localite_key`
- [x] **Test API** : `/sondages?missing=geom` fonctionne sans erreur 500 ✅
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

### 2.1 Géocodage manuel (onglet "Géocodage Amélioré") ✅
- [x] Créer endpoint `POST /sondages/:id/geocode`
  - [x] Mode ADM3 : centroïde + `adm3_id` (gid)
  - [x] Mode GPS : coordonnées exactes
  - [x] Mise à jour `location_mode`, `is_geocoded`
  - [x] Ajouter audit dans meta (geocoded_at, geocoded_mode)
  - [x] Validation coordonnées
  - [x] Logs de traçabilité
- [x] Rebuild Docker API pour déployer l'endpoint
- [x] Tester l'endpoint : ADM3 ✅ coords ✅
- [x] Brancher le bouton "Enregistrer le géocodage" dans l'UI
- [x] Rafraîchir la liste après géocodage

### 2.2 Suggestions ADM basées sur ADM3 Excel + localité ✅
- [x] **Script de génération des suggestions** :
  - [x] Script Python generate_geocode_suggestions.py
  - [x] Parcourir sondages avec `location_mode = 'unknown'`
  - [x] Matching fuzzy Levenshtein sur `localite_key` vs `adm3_fr`
  - [x] Calcul de score 0-100
  - [x] Vider suggestions pending au démarrage
  - [x] Remplir champ `candidates` avec tous les candidats (JSON)
  - [x] 98 suggestions générées pour 121 sondages
- [x] **API suggestions** :
  - [x] `GET /suggestions?sondage_id=...&status=...` 
  - [x] `GET /suggestions/stats`
  - [x] `POST /suggestions/:id/accept` (géocode + update + auto-reject autres)
  - [x] `POST /suggestions/:id/reject`
  - [x] Correction champ `localite` → utilise `localite_base`
- [x] Brancher le bouton "Géocoder" dans l'onglet Suggestions ADM
- [x] Nouveau panel SuggestionsAdmPanel avec affichage candidats
- [ ] Trigger auto-génération suggestions lors ajout sondage

### 2.3 Interaction carte (ADM3 qui clignote) - DÉTAILLÉ
- [ ] Endpoint pour récupérer géométrie ADM3 (ou réutiliser `/adm3/geojson` existant)
- [ ] Frontend : bouton "👁" sur chaque candidat ADM3 dans suggestions-adm-panel
- [ ] Au clic sur "👁" :
  - [ ] Appeler `sondagesPage.zoomToAdm3(code)` (méthode déjà créée)
  - [ ] Zoom sur le polygone ADM3 (`map.fitBounds`)
  - [ ] Style spécial (jaune/épais)
  - [ ] Clignotement 3-5 fois (toggle style toutes les 400ms)
- [ ] Restaurer style original après animation

### 2.4 Propagation vers la grille (mailles) ✅
**Objectif** : Que le géocodage mette à jour les mailles et les stats de la carte principale

- [x] **Diagnostic SRID** : Identifier que `ST_Contains(maille_25231, sondage_4326)` ne matchait pas
- [x] **Correction vue matérialisée** : Ajout `ST_Transform(s.geom, 25231)` dans `atlas.mv_mailles_geotech`
- [x] **Résultat** : 6 mailles avec données détectées (Kovié, Badja, Kpimé, Sola, Kparatao, Adzakpa)
- [x] **Trigger automatique** : `trigger_refresh_mailles` existe et fonctionne (AFTER INSERT/UPDATE)
- [ ] **Remplir `geom_real` et `grid_code`** : Optionnel car la vue fonctionne maintenant avec `ST_Transform`
- [ ] **Normaliser `loc_mode`** : Dériver de `location_mode` si besoin pour compatibilité legacy

---

## 🧩 ÉTAPE 3 : REFACTOR UI (Modal → Page dédiée) 🔧 EN COURS
**Objectif** : Transformer le modal en vraie page avec carte intégrée

### 3.1 Layout plein écran du Gestionnaire de Sondages
- [x] Ajouter routing hash-based simple (`#/sondages`)
- [x] Créer composant `SondagesManagerPage`
- [x] Layout 3 colonnes : Sidebar | Contenu | Carte
- [ ] **PROBLÈME IDENTIFIÉ** : Bloc "Sondages sans géométrie" partagé par tous les onglets
- [ ] **Supprimer le bloc global** "Sélectionnez un sondage pour le géocoder" du layout parent
- [ ] **Vérifier hauteur** : `.tab-pane` doit occuper 100% du centre (pas de zone vide en bas)
- [ ] **Factoriser layout** : 1 onglet = 1 composant principal dans le centre

### 3.2 Onglet « Géocodage Manuel » 🔧
- [x] Réutiliser `GeocodeCanonPanel` dans la nouvelle page
- [ ] **Centrer la logique** : Liste sondages + panneau géocodage dans CE composant uniquement
- [ ] **Utiliser toute la hauteur** : Plus de zone tronquée en bas
- [ ] **Message vide** : Uniquement dans ce panneau quand aucun sondage sélectionné

### 3.3 Onglet « Suggestions ADM » 🔧
- [x] Créer `SuggestionsAdmPanel` avec affichage candidats
- [ ] **PROBLÈME** : Affiche encore le contenu du géocodage manuel au lieu des suggestions
- [ ] **Brancher correctement** : Monter `SuggestionsAdmPanel` quand onglet actif
- [ ] **Corriger bug JSON** : Erreur "Expected property name" lors du chargement `/suggestions/stats`
- [ ] **Nettoyer textes** : Supprimer références "géocodage manuel" dans cet onglet
- [ ] **Message dédié** : En cas d'erreur ou absence de suggestions

### 3.4 Onglet « Import » 🔧
- [ ] **PROBLÈME** : Affiche placeholder "Fonctionnalité en cours de développement"
- [ ] **Remplacer** : Intégrer le vrai Import Wizard bulk (déjà développé)
- [ ] **Intégration** : Ne plus ouvrir de modal, afficher dans le centre
- [ ] **Vérifier navigation** : Retour carte, gestion erreurs, toasts

### 3.5 Onglet « Liste » 🔧
- [ ] **PROBLÈME** : Affiche placeholder "Fonctionnalité en cours de développement"
- [ ] **Intégrer** : Vraie Liste de sondages (recherche + filtres, déjà développée)
- [ ] **Occuper tout le centre** : Pas seulement le bas
- [ ] **Option** : Lien vers géocodage d'un sondage depuis cette liste

### 3.6 Carte ADM3 intégrée ✅
- [x] Charger la couche ADM3 dans la carte de droite
- [x] Style des polygones (bordure bleue, fond transparent)
- [x] Tooltips sur hover (nom commune, code)
- [x] Méthode `zoomToAdm3(code)` pour interaction depuis les suggestions
- [ ] Bouton 👁 sur chaque suggestion pour appeler `zoomToAdm3()`

### 3.7 Nettoyage & cohérence
- [ ] **Supprimer placeholders** : "Fonctionnalité en cours de développement" obsolètes
- [ ] **Harmoniser messages** : Messages vides et toasts par onglet
- [ ] **Vérifier responsive** : Pas de zone tronquée, scroll fonctionnel

---

## 🔄 ÉTAPE 4 : TEMPS RÉEL WEBSOCKET (Backend)
**Objectif** : Synchronisation multi-utilisateurs

### 4.1 Définir les événements ✅
- [x] `sondage.created` (nouveau sondage)
- [x] `sondage.updated` (modification)
- [x] `sondage.geocoded` (géocodage réussi)
- [x] `sondage.deleted` (soft delete)
- [x] `suggestion.accepted` (suggestion acceptée)
- [x] `suggestion.rejected` (suggestion rejetée)

### 4.2 Backend Rust/Axum ✅
- [x] Module events.rs avec types WsEvent
- [x] Module websocket.rs avec handler
- [x] Endpoint `GET /ws` (WebSocket upgrade)
- [x] Broadcast channel dans AppState
- [x] Émission événements dans geocode_suggestions
- [x] Émission événements dans sondages_geocode

### 4.3 Frontend TS ✅ + compléments
- [x] Module `realtime.ts` :
  - [x] Connexion WebSocket
  - [x] Reconnexion automatique avec backoff exponentiel
  - [x] Système d'événements (on/off/emit)
  - [x] Méthode `disconnect()` pour nettoyage
  - [x] CustomEvent globaux pour compatibilité
- [x] Intégrer WebSocket côté frontend (Vite/TS)
  - [x] Connexion automatique au WebSocket dans main.ts
  - [x] Écoute des événements sondage.geocoded, suggestion.accepted/rejected
  - [x] Notifications toast pour les événements importants
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
- [x] **SRID cohérent** : Vue `mv_mailles_geotech` transforme correctement 4326→25231
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

### Phase 2 : Corrections UI (EN COURS)
4. 🔥 **Corriger layout page `/sondages`** :
   - Supprimer bloc global "Sondages sans géométrie"
   - Factoriser : 1 onglet = 1 composant
   - Éliminer zones vides en bas
5. 🔥 **Brancher onglets correctement** :
   - Suggestions ADM → afficher `SuggestionsAdmPanel` (pas géocodage manuel)
   - Import → intégrer Import Wizard (pas placeholder)
   - Liste → intégrer vraie liste sondages (pas placeholder)
6. 🔥 **Corriger bug JSON** : Onglet Suggestions ADM (parsing `/suggestions/stats`)

### Phase 3 : Normalisation & cohérence
7. ⏳ **Normaliser `location_mode`** : Migrer `adm3` → `adm3_centroid`
8. ⏳ **Documenter colonnes legacy** : `loc_mode`, `geom_real`, `grid_code`
9. ⏳ **Interaction carte** : Bouton 👁 + zoom ADM3

### Phase 4 : Temps réel & tests
10. ⏳ **Rafraîchissements auto** : Listes + compteurs via WebSocket
11. ⏳ **Tests multi-onglets** : Vérifier synchronisation
12. ⏳ **Adapter scripts import** : Remplir `code`, `localite_base`, etc.

---

**Dernière mise à jour** : 2025-11-22 06:50
**Statut global** : 🟢 Backend OK, DB corrigée ! → 🔧 UI en cours de correction (layout + onglets)
