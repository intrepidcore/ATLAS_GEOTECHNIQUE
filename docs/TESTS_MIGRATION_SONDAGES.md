# Guide de Tests - Migration Sondages UI

**URL**: http://localhost:3000  
**Branche**: `feat/sondages-api-ui`

---

## 🧪 Checklist de Tests

### 1. Onglet "Liste des Sondages"

#### Test 1.1: Affichage de la liste
- [ ] Ouvrir le modal "Gestionnaire de Sondages"
- [ ] Aller dans l'onglet "Liste des Sondages"
- [ ] **Vérifier**: La liste affiche **230 sondages** (pas 1 localité)
- [ ] **Vérifier**: Chaque ligne affiche:
  - Code (ex: `GRANULO-ANIE`)
  - Village (ex: `ANIE`)
  - Label **"Géocodé : Oui/Non"**
- [ ] **Vérifier**: Pas de badge "X sondages"

#### Test 1.2: Détails d'un sondage
- [ ] Cliquer sur un sondage dans la liste
- [ ] **Vérifier**: Le panneau de droite affiche:
  - Métadonnées (Village, Code, Commune, Géocodé, Géométrie, Mode, Date)
  - Statistiques (Source, Créé le, Mis à jour)
  - Section **"Objet sondage (JSON)"** (pas "canonique")
- [ ] **Vérifier**: Le JSON contient les champs:
  - `id` (UUID)
  - `code`
  - `localite`
  - `is_geocoded`
  - `geom`
  - `adm3_id`

---

### 2. Onglet "Géocodage Amélioré"

#### Test 2.1: Affichage initial
- [ ] Aller dans l'onglet "Géocodage Amélioré"
- [ ] **Vérifier**: Titre = **"Sondages sans géométrie"**
- [ ] **Vérifier**: Badge affiche **"229"** (pas 1)
- [ ] **Vérifier**: Barre de progression montre 1/230 (0.4%)

#### Test 2.2: Sélection d'un sondage
- [ ] Cliquer sur un sondage dans la liste de gauche
- [ ] **Vérifier**: Le panneau de droite affiche:
  - Nom du sondage
  - Métadonnées (Code, Village, Commune, Mode)
  - Section "Géocodage" avec:
    - Select "Mode de géocodage" (ADM3 par défaut)
    - Suggestions ADM3 (si disponibles)
    - Select manuel des communes

#### Test 2.3: Suggestions ADM3
- [ ] Sélectionner un sondage qui a des suggestions (ex: ANIE)
- [ ] **Vérifier**: Bloc "💡 Suggestions" apparaît
- [ ] **Vérifier**: Chaque suggestion affiche:
  - Nom de la commune
  - Code ADM2
  - Score de similarité (ex: 100%)
- [ ] **Cliquer** sur une suggestion (carte avec score)
- [ ] **Vérifier**: Le select "Ou choisir manuellement" est pré-rempli avec la commune
- [ ] **Vérifier**: Pas d'alert bloquant

#### Test 2.4: Géocodage ADM3
- [ ] Avec une commune sélectionnée (manuellement ou via suggestion)
- [ ] Cliquer sur "💾 Enregistrer le géocodage"
- [ ] **Vérifier**: Toast vert apparaît: "✅ Sondage ... géocodé avec ADM3: ..."
- [ ] **Vérifier**: Le sondage disparaît de la liste (filtre "Sans géométrie")
- [ ] **Vérifier**: Le badge décrémente immédiatement (229 → 228)
- [ ] **Vérifier**: Pas d'alert bloquant

#### Test 2.5: Géocodage Coordonnées Exactes
- [ ] Sélectionner un sondage
- [ ] Changer le mode vers "Coordonnées exactes"
- [ ] **Vérifier**: Les champs Latitude/Longitude apparaissent
- [ ] Saisir des coordonnées valides (ex: lat=6.5, lon=1.2)
- [ ] Cliquer "Enregistrer"
- [ ] **Vérifier**: Toast vert avec coordonnées
- [ ] **Vérifier**: Badge décrémente
- [ ] **Vérifier**: Pas d'alert bloquant

#### Test 2.6: Validation des erreurs
- [ ] Sélectionner un sondage en mode ADM3
- [ ] Ne rien sélectionner dans le select
- [ ] Cliquer "Enregistrer"
- [ ] **Vérifier**: Toast rouge: "❌ Veuillez sélectionner une commune"
- [ ] **Vérifier**: Pas d'alert bloquant

---

### 3. Onglet "Suggestions ADM"

#### Test 3.1: KPI
- [ ] Aller dans l'onglet "Suggestions ADM"
- [ ] **Vérifier**: Les 4 KPI affichent:
  - Géocodés: 1
  - Sans géométrie: 229
  - Sans ADM3: 230
  - **Total sondages: 230** (pas "villages")

#### Test 3.2: Liste des suggestions
- [ ] **Vérifier**: La liste affiche des sondages individuels
- [ ] **Vérifier**: Chaque carte affiche:
  - Nom du village
  - Code du sondage
  - Commune (ou "—")
  - Badges "Sans géométrie" et/ou "Sans ADM3"
- [ ] **Vérifier**: **Pas de pilule "unknown"** dans la liste

#### Test 3.3: Filtres
- [ ] Cliquer sur "Sans géométrie (229)"
- [ ] **Vérifier**: Liste filtrée sur sondages sans geom
- [ ] Cliquer sur "Sans ADM3 (230)"
- [ ] **Vérifier**: Liste filtrée sur sondages sans adm3
- [ ] Cliquer sur "Tous (230)"
- [ ] **Vérifier**: Liste complète

---

### 4. Console Navigateur

#### Test 4.1: Logs
- [ ] Ouvrir la console (F12)
- [ ] Naviguer dans les onglets
- [ ] **Vérifier**: Les logs affichent:
  - `[SONDAGES]` (pas `[SUGGESTIONS_CANON]`)
  - `Panel suggestions chargé avec sondages individuels`
- [ ] **Vérifier**: Pas d'erreurs JavaScript

#### Test 4.2: Requêtes réseau
- [ ] Onglet Network (F12)
- [ ] Rafraîchir la page
- [ ] **Vérifier**: Requêtes vers:
  - `GET /sondages?limit=...`
  - `GET /sondages/stats`
  - `GET /sondages/:id`
  - `PATCH /sondages/:id/geometry`
- [ ] **Vérifier**: Pas de requêtes vers `/surveys-canon`

---

### 5. Tests API Directs

#### Test 5.1: Stats
```bash
curl http://localhost:8000/sondages/stats
```
**Attendu**:
```json
{
  "total": 230,
  "geocoded": 1,
  "with_geom": 1,
  "with_adm3": 0,
  "missing_geom": 229,
  "missing_adm3": 230
}
```

#### Test 5.2: Liste
```bash
curl "http://localhost:8000/sondages?limit=3"
```
**Attendu**: Array de 3 sondages avec champs `id`, `code`, `localite`, `is_geocoded`, etc.

#### Test 5.3: Détails
```bash
curl http://localhost:8000/sondages/<UUID>
```
**Attendu**: Objet sondage complet

#### Test 5.4: Suggestions ADM3
```bash
curl http://localhost:8000/sondages/<UUID>/adm3-candidates
```
**Attendu**:
```json
{
  "survey_id": "...",
  "localite": "ANIE",
  "candidates": [
    {
      "adm3_id": 123,
      "gid": 123,
      "name": "ANIE",
      "code": "...",
      "adm2_name": "...",
      "score": 1.0
    }
  ]
}
```

#### Test 5.5: PATCH Géométrie
```bash
curl -X PATCH http://localhost:8000/sondages/<UUID>/geometry \
  -H "Content-Type: application/json" \
  -d '{"mode":"adm","adm3_id":123}'
```
**Attendu**: Objet sondage mis à jour avec `adm3_id` et `is_geocoded=true`

---

## ✅ Résultat Attendu

Tous les tests doivent passer avec:
- ✅ 230 sondages affichés (pas 1 localité)
- ✅ Label "Géocodé : Oui/Non" présent
- ✅ KPI "Total sondages" (pas "villages")
- ✅ Pas de badge "X sondages" dans la liste
- ✅ Pas de pilule "unknown" dans la liste
- ✅ Toast non-bloquant (pas d'`alert()`)
- ✅ Clic suggestion → pré-sélection ADM3
- ✅ Badge décrémente immédiatement après géocodage
- ✅ Titre JSON: "Objet sondage"
- ✅ Logs: "[SONDAGES]"
- ✅ Requêtes API vers `/sondages` uniquement

---

## 🐛 Problèmes Connus Résolus

1. ~~"Total villages" au lieu de "Total sondages"~~ → ✅ Corrigé
2. ~~Pilule "unknown" dans la liste~~ → ✅ Retirée
3. ~~Alert bloquant "Veuillez sélectionner une commune"~~ → ✅ Toast
4. ~~Clic suggestion ne pré-sélectionne pas le select~~ → ✅ Corrigé
5. ~~Badge ne décrémente pas immédiatement~~ → ✅ Refresh stats après PATCH
6. ~~Titre "Objet canonique"~~ → ✅ "Objet sondage"
7. ~~Logs "[SUGGESTIONS_CANON]"~~ → ✅ "[SONDAGES]"

---

## 📞 Support

En cas de problème:
1. Vérifier les logs console (F12)
2. Vérifier les requêtes réseau
3. Vérifier l'état de l'API: `curl http://localhost:8000/sondages/stats`
4. Redémarrer les services: `docker compose restart api-geo ui`
