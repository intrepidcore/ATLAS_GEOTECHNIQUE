# 🗺️ REFONTE UI GÉOCODAGE - Proposition

## 📊 Interface Actuelle (Analyse)

### Fonctionnalités Existantes
**Bouton** : `🗺️ Géocoder les sondages` (panneau latéral gauche)

**Workflow Actuel** :
1. Clic sur bouton → Modal overlay s'ouvre
2. Liste des sondages "ungeocode" (sans géométrie)
3. Pour chaque sondage : bouton `🗺️ Géocoder`
4. Formulaire avec 3 modes :
   - **📍 Coordonnées exactes** : Saisie lon/lat manuelle
   - **🎯 Centroïde ADM** : Sélection ADM1/2/3 → point au centre
   - **🎲 Point aléatoire ADM** : Sélection ADM1/2/3 → point random dans zone

**Points Forts** :
- ✅ Interface claire et intuitive
- ✅ 3 modes de géocodage flexibles
- ✅ Sélection ADM dynamique (chargement zones)
- ✅ Feedback immédiat (toast + reload grid)

**Points Faibles** :
- ❌ Pas de suggestions automatiques (matching ADM3)
- ❌ Pas de validation/rejet de suggestions
- ❌ Pas de vue d'ensemble des suggestions pending
- ❌ Saisie manuelle uniquement (pas de pré-remplissage intelligent)

---

## 🎯 Proposition de Refonte (Préservation + Extension)

### Architecture Proposée : 2 Onglets

```
┌─────────────────────────────────────────────────────────────┐
│  🗺️ Géocodage des Sondages                            [×]  │
├─────────────────────────────────────────────────────────────┤
│  [📍 Manuel]  [🤖 Suggestions]                              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Contenu selon onglet actif                                │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## 📍 Onglet 1 : "Manuel" (Fonctionnalités Actuelles Préservées)

**Identique à l'existant** avec améliorations mineures :

### Liste des Sondages Non-Géocodés
```
┌─────────────────────────────────────────────────────────┐
│ SOND-001                                    [🗺️ Géocoder]│
│ 📍 Région Maritime                                      │
│ 🧪 12 essai(s)                                          │
├─────────────────────────────────────────────────────────┤
│ SOND-002                                    [🗺️ Géocoder]│
│ 📍 ADM non spécifié                                     │
│ 🧪 8 essai(s)                                           │
└─────────────────────────────────────────────────────────┘
```

### Formulaire de Géocodage (Inchangé)
```
┌─────────────────────────────────────────────────────────┐
│ Géocoder: SOND-001                                      │
├─────────────────────────────────────────────────────────┤
│ Mode de géocodage:                                      │
│ [📍 Coordonnées exactes ▼]                              │
│                                                         │
│ Longitude:          Latitude:                          │
│ [1.084______]       [8.592______]                       │
│                                                         │
│ [✅ Géocoder]  [Annuler]                                │
└─────────────────────────────────────────────────────────┘
```

**Améliorations Mineures** :
- ✨ Afficher localité si disponible : `📍 Davie (Région Maritime)`
- ✨ Badge si suggestion disponible : `🤖 Suggestion disponible`
- ✨ Lien rapide vers onglet Suggestions

---

## 🤖 Onglet 2 : "Suggestions" (NOUVEAU)

### Vue d'Ensemble
```
┌─────────────────────────────────────────────────────────┐
│ 🤖 Suggestions Automatiques                             │
├─────────────────────────────────────────────────────────┤
│ Filtres:                                                │
│ [Tous ▼] [Toutes préfectures ▼] [Recherche...]         │
├─────────────────────────────────────────────────────────┤
│ 📊 Statistiques:                                        │
│ ✅ 1 Accepté  ⚠️ 6 En attente  ❌ 1 Sans suggestion    │
└─────────────────────────────────────────────────────────┘
```

### Liste des Suggestions (Statut : En Attente)
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ TEKPO - Tekpo                                        │
│ ├─ Top: Tchekpo (TG030709) - Yoto                      │
│ │  Score: 40% • Méthode: Candidat                      │
│ ├─ Autres candidats (1):                               │
│ │  • Dzrekpo (TG030604) - 27%                          │
│ └─ Actions:                                            │
│    [✅ Accepter]  [✏️ Modifier]  [❌ Rejeter]           │
├─────────────────────────────────────────────────────────┤
│ ⚠️ APEHEME - Apeheme                                    │
│ ├─ Top: Lavie/Apedome (TG041208) - Vo                  │
│ │  Score: 22% • Méthode: Candidat                      │
│ └─ Actions:                                            │
│    [✅ Accepter]  [✏️ Modifier]  [❌ Rejeter]           │
├─────────────────────────────────────────────────────────┤
│ ... (4 autres)                                          │
└─────────────────────────────────────────────────────────┘
```

### Détail Suggestion (Expandable)
```
┌─────────────────────────────────────────────────────────┐
│ ⚠️ KONSOGOU_T1 - Konsogou T1                   [Replier]│
├─────────────────────────────────────────────────────────┤
│ 📍 Localité saisie: "Konsogou T1"                      │
│ 🔍 Normalisation: "konsogou"                           │
│                                                         │
│ 🎯 Top Candidat (Score: 22%)                           │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Koumongou (TG051902)                              │ │
│ │ 📍 Préfecture: Oti-Sud                            │ │
│ │ 🔢 Méthode: Candidat (similarité trigrammes)      │ │
│ │ [✅ Accepter ce candidat]                         │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ 📋 Autres Candidats (4)                                │
│ ┌───────────────────────────────────────────────────┐ │
│ │ • Koutougou (TG020605) - Keran - 22%             │ │
│ │   [Sélectionner]                                  │ │
│ │ • Korbongou (TG051604) - Oti - 22%               │ │
│ │   [Sélectionner]                                  │ │
│ │ • Ogou (TG040907) - Ogou - 21%                    │ │
│ │   [Sélectionner]                                  │ │
│ │ • Bogou (TG051502) - Tone - 20%                   │ │
│ │   [Sélectionner]                                  │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ ✏️ Saisie Manuelle                                     │
│ ┌───────────────────────────────────────────────────┐ │
│ │ Niveau ADM: [ADM3 ▼]                              │ │
│ │ Zone: [Sélectionner... ▼]                         │ │
│ │ [💾 Enregistrer]                                  │ │
│ └───────────────────────────────────────────────────┘ │
│                                                         │
│ [❌ Rejeter toutes les suggestions]                    │
└─────────────────────────────────────────────────────────┘
```

### Liste des Suggestions Acceptées
```
┌─────────────────────────────────────────────────────────┐
│ ✅ DAVIE - Davie                                        │
│ ├─ Accepté: Davie (TG030805) - Zio                     │
│ │  Score: 100% • Méthode: Synonym (auto-validé)       │
│ └─ [🗑️ Annuler]                                        │
└─────────────────────────────────────────────────────────┘
```

### Liste Sans Suggestion
```
┌─────────────────────────────────────────────────────────┐
│ ❌ NASSABLE - Nassablé                                  │
│ ├─ Aucun canton similaire trouvé                       │
│ └─ [✏️ Géocoder manuellement]                          │
│    (Redirige vers onglet Manuel)                       │
└─────────────────────────────────────────────────────────┘
```

---

## 🔄 Workflow Complet

### Scénario 1 : Suggestion Auto-Acceptée (Davie)
1. Import sondage avec localité "Davie"
2. Système génère suggestion → `status: accepted` (score 100%, synonym)
3. Utilisateur ouvre onglet Suggestions
4. Voit "✅ DAVIE - Accepté automatiquement"
5. Clic sur "Appliquer les acceptés" (bouton global)
6. ADM3 écrit dans `sondages.meta->>'adm3_code'`
7. Sondage géocodé (centroid ou random selon config)

### Scénario 2 : Suggestion Pending (Tekpo)
1. Import sondage avec localité "Tekpo"
2. Système génère suggestion → `status: pending` (score 40%)
3. Utilisateur ouvre onglet Suggestions
4. Voit "⚠️ TEKPO" avec top candidat "Tchekpo (40%)"
5. **Option A** : Accepte le top → Clic "✅ Accepter"
6. **Option B** : Choisit autre candidat → Clic "Sélectionner" sur Dzrekpo
7. **Option C** : Saisie manuelle → Sélectionne ADM3 dans dropdown
8. **Option D** : Rejette → Clic "❌ Rejeter"
9. Si accepté → Clic "Appliquer les acceptés" → Géocodage

### Scénario 3 : Sans Suggestion (Nassablé)
1. Import sondage avec localité "Nassablé"
2. Système ne trouve rien (< 20% similarité)
3. Utilisateur ouvre onglet Suggestions
4. Voit "❌ NASSABLE - Aucun canton similaire"
5. Clic "✏️ Géocoder manuellement"
6. Redirigé vers onglet Manuel
7. Saisie manuelle (coords ou ADM)

---

## 🎨 Codes Couleur & Icônes

### Statuts
- ✅ **Accepted** : Vert `#0bb07b`
- ⚠️ **Pending** : Orange `#ff9f43`
- ❌ **No Match** : Rouge `#ff6b6b`
- 🤖 **Auto** : Bleu `#3aa6ff`

### Scores
- **90-100%** : Vert foncé (très sûr)
- **70-89%** : Vert clair (sûr)
- **50-69%** : Orange (moyen)
- **20-49%** : Rouge clair (faible)
- **< 20%** : Rouge (très faible)

### Méthodes
- 🏷️ **Synonym** : Badge violet
- 🔤 **Trigram+Tokens** : Badge bleu
- 🔍 **Trigram** : Badge cyan
- 📝 **Tokens** : Badge jaune
- 🎯 **Candidate** : Badge gris

---

## 🔧 Actions Globales (Barre du Haut)

```
┌─────────────────────────────────────────────────────────┐
│ [🔄 Régénérer suggestions] [✅ Appliquer acceptés (1)]  │
│ [📥 Exporter CSV] [⚙️ Paramètres]                       │
└─────────────────────────────────────────────────────────┘
```

### Boutons
- **🔄 Régénérer suggestions** : Re-lance `step1_generate_suggestions.sql`
- **✅ Appliquer acceptés (N)** : Lance `step2_apply_accepted_suggestions.sql`
- **📥 Exporter CSV** : Export liste suggestions pour revue externe
- **⚙️ Paramètres** : Seuils de confiance, modes de géocodage par défaut

---

## 📱 Responsive & UX

### Mobile
- Onglets en dropdown sur petit écran
- Liste suggestions en cards empilées
- Actions en menu contextuel (...)

### Accessibilité
- Raccourcis clavier : `Tab`, `Enter`, `Esc`
- ARIA labels sur tous les boutons
- Indicateurs visuels clairs (couleurs + icônes + texte)

### Performance
- Pagination (20 suggestions par page)
- Lazy loading des candidats (expand on demand)
- Debounce sur recherche/filtres

---

## 🔌 Endpoints API Nécessaires

### Existants (à conserver)
```
GET  /surveys/ungeocode
POST /surveys/{id}/geocode
GET  /adm/{level}
```

### Nouveaux (à créer)
```
GET  /geocode/suggestions?status={pending|accepted|rejected}
POST /geocode/suggestions/{id}/accept
POST /geocode/suggestions/{id}/reject
POST /geocode/suggestions/{id}/update {adm3_code}
POST /geocode/suggestions/apply-accepted
POST /geocode/suggestions/regenerate
GET  /geocode/stats
```

---

## 📊 Tableau Comparatif

| Fonctionnalité | Actuel | Proposé |
|----------------|--------|---------|
| **Géocodage manuel coords** | ✅ | ✅ Préservé |
| **Géocodage centroid ADM** | ✅ | ✅ Préservé |
| **Géocodage random ADM** | ✅ | ✅ Préservé |
| **Liste sondages non-géocodés** | ✅ | ✅ Préservé |
| **Suggestions automatiques** | ❌ | ✅ **NOUVEAU** |
| **Validation suggestions** | ❌ | ✅ **NOUVEAU** |
| **Choix parmi candidats** | ❌ | ✅ **NOUVEAU** |
| **Vue d'ensemble statuts** | ❌ | ✅ **NOUVEAU** |
| **Filtres & recherche** | ❌ | ✅ **NOUVEAU** |
| **Export suggestions** | ❌ | ✅ **NOUVEAU** |
| **Paramètres seuils** | ❌ | ✅ **NOUVEAU** |

---

## 🚀 Plan d'Implémentation

### Phase 1 : Backend (Priorité)
1. ✅ Fonctions SQL matching strict (FAIT)
2. ✅ Table `geocode_suggestions` (FAIT)
3. ⏳ Endpoints API Rust (À FAIRE)
4. ⏳ Tests unitaires endpoints

### Phase 2 : Frontend (Après Backend)
1. ⏳ Refonte `geocode-manager.ts` avec onglets
2. ⏳ Composant `SuggestionCard`
3. ⏳ Composant `SuggestionDetail`
4. ⏳ Intégration API calls
5. ⏳ Tests E2E

### Phase 3 : Polish & Docs
1. ⏳ Documentation utilisateur
2. ⏳ Vidéo démo
3. ⏳ Migration données existantes

---

## 💡 Recommandations

### Court Terme
1. **Implémenter onglet Suggestions** en priorité
2. **Garder onglet Manuel** identique (zéro régression)
3. **Tester avec les 8 sondages actuels** avant production

### Moyen Terme
1. **Enrichir `adm3_synonyms`** au fur et à mesure des validations
2. **Monitorer taux d'acceptation** (objectif > 50%)
3. **Ajuster seuils** si trop de pending ou trop de faux positifs

### Long Terme
1. **Machine Learning** : Apprendre des validations manuelles
2. **Géocodage inversé** : Proposer ADM depuis coords GPS
3. **Batch validation** : Accepter/rejeter en masse

---

**Proposition créée le** : 2025-10-26  
**Auteur** : Cascade AI  
**Statut** : 📋 Proposition - En attente validation
