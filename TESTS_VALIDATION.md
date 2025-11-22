# Tests de Validation - Gestionnaire de Sondages

## ✅ Tests Automatiques Effectués

### 1. Build & Compilation
- [x] **Backend Rust** : Build OK (api-geo)
- [x] **Frontend TypeScript** : Build OK (Vite)
- [x] **Migrations SQL** : Appliquées avec succès
  - Migration 034 : Correction SRID `mv_mailles_geotech`
  - Migration 035 : Normalisation `location_mode`

### 2. Base de Données
- [x] **SRID cohérent** : Vue transforme correctement 4326→25231
- [x] **Mailles avec données** : 6 mailles détectées (vs 0 avant)
- [x] **location_mode normalisé** : 
  - 117 `unknown`
  - 5 `adm3_centroid`
  - 1 `exact`
  - 0 valeurs invalides

### 3. API Backend
- [x] **GET /sondages/stats** : Répond correctement
  ```json
  {
    "total": 123,
    "geocoded": 6,
    "with_geom": 6,
    "with_adm3": 5,
    "missing_geom": 117,
    "missing_adm3": 118
  }
  ```
- [x] **GET /suggestions/stats** : Répond correctement
  ```json
  {
    "accepted": 3,
    "pending": 104,
    "rejected": 0,
    "total": 107
  }
  ```

---

## 🧪 Tests Manuels à Effectuer

### Test 1 : Page Gestionnaire Sondages
**URL** : `http://localhost:5173/#/sondages`

#### Onglet Géocodage Manuel
- [ ] Liste des sondages sans géométrie affichée
- [ ] Compteur correct (117 sondages)
- [ ] Sélection d'un sondage affiche les candidats ADM3
- [ ] Bouton "Enregistrer le géocodage" fonctionne
- [ ] Après géocodage : sondage disparaît de la liste
- [ ] Compteur se met à jour automatiquement

#### Onglet Suggestions ADM
- [ ] Liste des suggestions affichée (104 pending)
- [ ] Candidats ADM3 avec scores visibles
- [ ] Bouton 👁️ "Voir" zoom sur la carte ADM3
- [ ] Clignotement du polygone ADM3 (jaune, 2 secondes)
- [ ] Bouton "✅ Géocoder" accepte la suggestion
- [ ] Bouton "❌ Rejeter" rejette la suggestion
- [ ] Liste se rafraîchit automatiquement après action

#### Onglet Liste
- [ ] Tous les sondages affichés (123 total)
- [ ] Filtres fonctionnent (Tous / Géocodés / Non géocodés)
- [ ] Recherche fonctionne
- [ ] Stats affichées correctement (6 géocodés, 117 non géocodés)
- [ ] Cartes sondages affichent le bon statut et mode

#### Onglet Import
- [ ] Message explicatif affiché
- [ ] Bouton "Ouvrir l'Import Wizard" redirige vers carte principale

#### Carte ADM3 (colonne droite)
- [ ] Carte affichée avec couche ADM3
- [ ] Tooltips sur hover (nom commune + code)
- [ ] Zoom ADM3 fonctionne depuis suggestions

#### Navigation
- [ ] Bouton "Retour à la carte" fonctionne
- [ ] Hash URL change correctement (`/` ↔ `/sondages`)

---

### Test 2 : Carte Principale
**URL** : `http://localhost:5173/`

- [ ] **Stats mailles** : "Mailles avec données" = 6 (au lieu de 0)
- [ ] Mailles colorées sur la carte
- [ ] Modal "Gestionnaire Sondages" s'ouvre
- [ ] Bouton "🚀 Ouvrir en pleine page" fonctionne

---

### Test 3 : Temps Réel (WebSocket)

#### Test Multi-Onglets
1. Ouvrir 2 onglets navigateur sur `/#/sondages`
2. Dans onglet A : Géocoder un sondage
3. Vérifier dans onglet B :
   - [ ] Toast de notification apparaît
   - [ ] Liste "Sondages sans géométrie" se rafraîchit
   - [ ] Compteur se met à jour
   - [ ] Sondage géocodé disparaît de la liste

#### Test Suggestions
1. Ouvrir 2 onglets sur onglet "Suggestions ADM"
2. Dans onglet A : Accepter une suggestion
3. Vérifier dans onglet B :
   - [ ] Toast de notification
   - [ ] Suggestion disparaît de la liste
   - [ ] Compteur se met à jour

---

### Test 4 : Workflow Complet

#### Scénario : Géocodage d'un nouveau sondage
1. [ ] Aller sur page `/sondages`
2. [ ] Onglet "Géocodage Manuel"
3. [ ] Sélectionner un sondage (ex: "Agbélouvé")
4. [ ] Voir les candidats ADM3 proposés
5. [ ] Sélectionner le bon candidat
6. [ ] Cliquer "Enregistrer le géocodage"
7. [ ] Vérifier :
   - Toast de succès
   - Sondage disparaît de la liste
   - Compteur mis à jour
8. [ ] Aller sur onglet "Liste"
9. [ ] Filtrer "Géocodés"
10. [ ] Vérifier que le sondage apparaît avec statut "GÉOCODÉ"
11. [ ] Retourner à la carte principale
12. [ ] Vérifier que "Mailles avec données" a augmenté

#### Scénario : Suggestion automatique
1. [ ] Onglet "Suggestions ADM"
2. [ ] Sélectionner une suggestion avec score > 90%
3. [ ] Cliquer sur 👁️ "Voir" pour visualiser sur la carte
4. [ ] Vérifier le zoom et le clignotement
5. [ ] Cliquer "✅ Géocoder"
6. [ ] Vérifier :
   - Toast de succès
   - Suggestion disparaît
   - Compteur mis à jour
7. [ ] Aller sur onglet "Géocodage Manuel"
8. [ ] Vérifier que le sondage a disparu de la liste

---

## 📊 Résultats Attendus

### Base de Données
- **Sondages géocodés** : Augmentation progressive
- **location_mode** : Toujours `adm3_centroid`, `exact`, ou `unknown`
- **Mailles avec données** : Augmente avec chaque géocodage
- **Suggestions pending** : Diminue avec acceptations/rejets

### Performance
- **Chargement page** : < 2 secondes
- **Rafraîchissement après géocodage** : < 1 seconde
- **WebSocket latence** : < 500ms

### UX
- **Pas de zone vide** : Layout occupe 100% de la hauteur
- **Pas de duplication** : Chaque onglet affiche son contenu unique
- **Messages clairs** : Toasts informatifs
- **Navigation fluide** : Transitions sans erreur

---

## 🐛 Bugs Connus à Vérifier

### Critiques (bloquants)
- [ ] ~~Bug JSON parsing dans suggestions~~ → Devrait être corrigé
- [ ] ~~Onglets affichent mauvais contenu~~ → Devrait être corrigé
- [ ] ~~Mailles avec données = 0~~ → ✅ CORRIGÉ (migration 034)

### Mineurs (non bloquants)
- [ ] Import Wizard pas intégré (placeholder avec redirection)
- [ ] Détails sondage pas implémenté (bouton "Voir détails")
- [ ] Navigation depuis Liste vers Géocodage pas implémentée

---

## ✅ Checklist Finale

Avant de considérer la fonctionnalité comme complète :

- [ ] Tous les tests manuels passent
- [ ] Aucune erreur console navigateur
- [ ] Aucune erreur logs backend
- [ ] WebSocket fonctionne en temps réel
- [ ] Stats mailles correctes
- [ ] location_mode cohérent partout
- [ ] Documentation à jour (TODO.md)
- [ ] Commit final avec message descriptif

---

**Date** : 2025-11-22  
**Version** : v2.8.0  
**Testeur** : _À compléter_
