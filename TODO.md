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
- [ ] Documenter les colonnes canon vs legacy
- [ ] Décider du rôle de chaque colonne :
  - `code` : identifiant sondage (code_site Excel)
  - `localite_base` : texte brut Excel
  - `localite_key` : version normalisée
  - `adm3_id` / `adm3_name` : lien ADM3 officielle

### 1.2 Nettoyage des données existantes
- [ ] **Code** : Remplir depuis `meta->>'code'`
  ```sql
  -- Remplacer AUTO_... par vrai code quand disponible
  UPDATE public.sondages SET code = meta->>'code' WHERE code LIKE 'AUTO_%' AND meta->>'code' IS NOT NULL;
  ```
- [ ] **Localité brute** : Remplir `localite_base` depuis `meta->>'localite'`
- [ ] **Localité normalisée** : Générer `localite_key` depuis `localite_base`
- [ ] **ADM3 Excel** : Extraire ADM3 depuis `meta` vers colonne dédiée
- [ ] **Contrainte NOT NULL** : Ajouter sur `code` après nettoyage

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
- [ ] Brancher le bouton "Enregistrer le géocodage" dans l'UI
- [ ] Rafraîchir la liste après géocodage

### 2.2 Suggestions ADM basées sur ADM3 Excel + localité
- [ ] **Génération des candidats** :
  - [ ] Job/endpoint pour calculer suggestions
  - [ ] Matching sur `localite_key` + `adm3_text_raw`
  - [ ] Calcul de score (Levenshtein, ILIKE)
  - [ ] Insertion dans `atlas.geocode_suggestions`
- [ ] **API suggestions** :
  - [ ] `GET /geocode/suggestions/:sondage_id` (candidats pour un sondage)
  - [ ] `POST /geocode/suggestions/:id/accept` (appliquer suggestion)
  - [ ] `POST /geocode/suggestions/:id/reject` (rejeter suggestion)
- [ ] Brancher le bouton "Géocoder" dans l'onglet Suggestions ADM

### 2.3 Interaction carte (ADM3 qui clignote)
- [ ] Endpoint pour récupérer géométrie ADM3
- [ ] Frontend : zoom + clignotement sur clic "œil"
- [ ] Animation : 4-5 clignotements avec style surligné

---

## 🖥️ ÉTAPE 3 : REFACTOR UI (MODAL → PAGE)
**Objectif** : Page dédiée avec carte à droite

### 3.1 Nouvelle route `/sondages`
- [ ] Créer route `/sondages` dans le router
- [ ] Extraire logique du modal dans `SondagesManagerPage`
- [ ] Layout 3 colonnes :
  - [ ] Gauche : sidebar onglets (réutiliser existant)
  - [ ] Centre : panneaux actuels (Liste, Géocodage, Suggestions)
  - [ ] Droite : carte Leaflet dédiée

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

### 4.1 Définir les événements
- [ ] `sondage.created`
- [ ] `sondage.updated`
- [ ] `sondage.geocoded`
- [ ] `sondage.deleted`
- [ ] `mailles.coverage_updated`

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
  - [ ] Système d'événements
- [ ] Intégration dans `main.ts`
- [ ] Rafraîchissement automatique :
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
2. 🔥 **Nettoyage données** (code, localite_base, ADM3)
3. 🔥 **Géocodage manuel fonctionnel**
4. 🔥 **Suggestions ADM fonctionnelles**
5. ⏳ **Refactor UI** (modal → page)
6. ⏳ **WebSocket temps réel**

---

**Dernière mise à jour** : 2025-11-21
**Statut global** : 🟡 En cours (Étape 1 - Données)
