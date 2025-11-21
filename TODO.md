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

### 1.2 Nettoyage des données existantes ✅
- [x] **Code** : Rempli depuis `meta->>'code'` (123 sondages)
- [x] **Localité brute** : Rempli `localite_base` depuis `meta->>'localite'` (123 sondages)
- [x] **Localité normalisée** : Généré `localite_key` depuis `localite_base` (123 sondages)
- [x] **Contrainte NOT NULL** : Ajoutée sur `code`
- [x] **Index** : Créé sur `localite_key`
- [x] **Test API** : `/sondages?missing=geom` fonctionne sans erreur 500 ✅
- [ ] **ADM3 Excel** : Extraire ADM3 depuis `meta` vers colonne dédiée (TODO)

### 1.3 Adapter les scripts d'import
- [ ] Modifier `02_import_excel.py` pour remplir `code` directement
- [ ] Modifier `03_import_amessefe.py` pour remplir `code` directement
- [ ] Ajouter validation ADM3 à l'import
- [ ] Logger les sondages avec ADM3 non matchée

---

## ⚙️ ÉTAPE 2 : BACKEND GÉOCODAGE & SUGGESTIONS
**Objectif** : Faire vivre les boutons de l'UI actuelle

### 2.1 Géocodage manuel (onglet "Géocodage Amélioré")
- [ ] Vérifier/créer endpoint `POST /sondages/:id/geocode`
  - [ ] Mode ADM3 : centroïde + `adm3_id`
  - [ ] Mode GPS : coordonnées exactes
  - [ ] Mise à jour `location_mode`, `is_geocoded`
  - [ ] Ajouter audit (qui a géocodé, quand, comment)
- [ ] Brancher le bouton "Enregistrer le géocodage" dans l'UI
- [ ] Rafraîchir la liste après géocodage
- [ ] Tester le workflow complet

### 2.2 Suggestions ADM basées sur ADM3 Excel + localité
- [ ] **Script de génération des suggestions** (NOUVEAU) :
  - [ ] Créer script Python/SQL pour générer suggestions
  - [ ] Parcourir sondages avec `location_mode = 'unknown'`
  - [ ] Extraire ADM3 depuis `meta->>'adm3_excel'` ou `prefecture_excel`
  - [ ] Matching fuzzy sur `localite_key` vs `adm3.name_normalized`
  - [ ] Calcul de score (Levenshtein, ILIKE)
  - [ ] Insertion dans `atlas.geocode_suggestions` avec score
- [ ] **API suggestions** :
  - [ ] `GET /geocode/suggestions/:sondage_id` (candidats pour un sondage)
  - [ ] `POST /geocode/suggestions/:id/accept` (appliquer suggestion)
  - [ ] `POST /geocode/suggestions/:id/reject` (rejeter suggestion)
- [ ] Brancher le bouton "Géocoder" dans l'onglet Suggestions ADM

### 2.3 Interaction carte (ADM3 qui clignote) - DÉTAILLÉ
- [ ] Endpoint pour récupérer géométrie ADM3
- [ ] Frontend : bouton "👁" sur chaque candidat ADM3
- [ ] Au clic sur "👁" :
  - [ ] Zoom sur le polygone ADM3 (`map.fitBounds`)
  - [ ] Style spécial (jaune/épais)
  - [ ] Clignotement 3-5 fois (toggle style toutes les 400ms)
- [ ] Restaurer style original après animation

---

## 🖥️ ÉTAPE 3 : REFACTOR UI (MODAL → PAGE)
**Objectif** : Page dédiée avec carte à droite

### 3.1 Nouvelle route `/sondages` - PRÉCISÉ
- [ ] Créer route hash `#/sondages` (ou route normale)
- [ ] Bouton "Sondages" → navigation vers `/sondages` (pas modal)
- [ ] Extraire logique du modal dans `SondagesManagerPage`
- [ ] Layout 3 colonnes :
  - [ ] Gauche : sidebar onglets INCHANGÉE (Nouveau, Import, Liste, Géocodage, Suggestions)
  - [ ] Centre : panneaux actuels RÉUTILISÉS (pas de redesign)
  - [ ] Droite : carte Leaflet dédiée avec :
    - [ ] Couche ADM3 (polygones)
    - [ ] Fond OSM léger
    - [ ] Synchronisation avec panneau central

### 3.2 Réutiliser le centre existant
- [ ] Composant `SondagesManagerLayout`
- [ ] Garder le même look & feel
- [ ] Adapter les largeurs pour la nouvelle page

### 3.3 Intégrer la carte à droite
- [ ] Carte Leaflet avec couches ADM3 + mailles
- [ ] Synchronisation avec sondage sélectionné
- [ ] Clic sur carte pour géocodage GPS
- [ ] Zoom/highlight sur ADM3 suggérée

---

## 🔄 ÉTAPE 4 : TEMPS RÉEL WEBSOCKET
**Objectif** : Synchronisation multi-utilisateurs

### 4.1 Définir les événements - DÉTAILLÉ
- [ ] `sondage.created` (nouveau sondage)
- [ ] `sondage.updated` (modification)
- [ ] `sondage.geocoded` (géocodage réussi) ← PRIORITAIRE
- [ ] `sondage.deleted` (soft delete)
- [ ] `mailles.coverage_updated` (plus tard)
- [ ] Documenter payload de chaque événement

### 4.2 Backend Rust/Axum
- [ ] Endpoint `GET /ws` (WebSocket upgrade)
- [ ] Canal broadcast partagé dans `AppState`
- [ ] Émettre événements depuis handlers :
  - [ ] `POST /sondages`
  - [ ] `POST /sondages/:id/geocode`
  - [ ] `POST /geocode/suggestions/:id/accept`

### 4.3 Frontend TS
- [ ] Module `realtime.ts` :
  - [ ] Connexion WebSocket
  - [ ] Reconnexion automatique
  - [ ] Système d'événements (on/off/emit)
  - [ ] Méthode `disconnect()` pour nettoyage
- [ ] Intégration dans `main.ts`
- [ ] Rafraîchissement automatique :
  - [ ] Sur `sondage.geocoded` :
    - [ ] MAJ compteur "Sans géométrie"
    - [ ] Recharger liste si onglet ouvert
  - [ ] Carte principale (mailles)
  - [ ] Liste sondages
  - [ ] Compteurs Géocodage/Suggestions

---

## 🧪 TESTS & VALIDATION

### Tests fonctionnels
- [ ] Géocodage manuel ADM3
- [ ] Géocodage manuel GPS
- [ ] Acceptation suggestion
- [ ] Rejet suggestion
- [ ] Temps réel multi-onglets
- [ ] Temps réel multi-utilisateurs

### Tests de données
- [ ] Tous les sondages ont un `code` non NULL
- [ ] `localite_base` remplie quand disponible
- [ ] ADM3 matchées correctement
- [ ] Pas de doublons de code

---

## 📦 DÉPLOIEMENT

- [ ] Migration SQL pour nettoyage données
- [ ] Rebuild API Rust
- [ ] Rebuild UI
- [ ] Test en environnement Docker
- [ ] Documentation utilisateur

---

## 🎯 PRIORITÉS IMMÉDIATES

1. ✅ **Dump de la base** (backup avant modifications)
2. ✅ **Nettoyage données** (code, localite_base, localite_key) - TERMINÉ !
3. 🔥 **Géocodage manuel fonctionnel** - EN COURS
4. 🔥 **Suggestions ADM fonctionnelles**
5. ⏳ **Refactor UI** (modal → page)
6. ⏳ **WebSocket temps réel**

---

**Dernière mise à jour** : 2025-11-21 16:00
**Statut global** : 🟢 Étape 1 terminée ! → Étape 2 en cours
