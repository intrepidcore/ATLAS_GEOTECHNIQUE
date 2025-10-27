# 🎯 Contexte Complet - Refonte Panneau Droit v3.0

**Date** : 27 octobre 2025  
**Version actuelle** : v2.0.1  
**Version cible** : v2.1.0 → v3.0  
**Estimation** : 12-16 heures

---

## 📊 SITUATION ACTUELLE

### ✅ Complété (v2.0.1)

**Panneau Gauche** :
- 4 onglets (Vue/Essais/Sondages/Classification)
- Badges IP/VBS intelligents
- Empty states contextuels
- Feature flags

**Backend** :
- SQL robuste (tri, dédoublonnage, protection)
- Classifications avec raison
- 5 index performance (-40% à -60%)
- Tests 100% passés

### ❌ À Faire

**Panneau Droit** :
- 6 sections plates, 21 boutons
- 6 filtres basiques seulement
- Recherche code maille uniquement
- Pas d'actions contextuelles
- Pas de raccourcis clavier

---

## 🏗️ ARCHITECTURE PROPOSÉE

```
┌─────────────────────────────┐
│ 🔍 RECHERCHE UNIFIÉE        │ Toujours visible
├─────────────────────────────┤
│ ▼ FILTRES               [3] │ Accordéon + badge
│   ├─ Géographiques          │
│   ├─ Données                │
│   ├─ Essais (NOUVEAU)       │
│   └─ Temporel (NOUVEAU)     │
├─────────────────────────────┤
│ ▼ SONDAGES                  │ Accordéon
│   ├─ + Nouveau ▼            │ Dropdown
│   └─ Actions groupées       │
├─────────────────────────────┤
│ ▼ ACTIONS MAILLE        [×] │ Contextuel
│   TG-0496-0212-01           │
│   3 sondages • 21 essais    │
├─────────────────────────────┤
│ ▼ EXPORT                    │ Accordéon
│   ├─ Configurateur          │
│   ├─ Rapides                │
│   └─ Historique             │
└─────────────────────────────┘
```

---

## 📋 DÉTAILS PAR SECTION

### 1. RECHERCHE UNIFIÉE

**Types** : Mailles, Sondages, Localités, ADM  
**Features** : Fuzzy search, suggestions temps réel, historique  
**Raccourci** : Ctrl+F

### 2. FILTRES (15+ filtres vs 6)

**Géographiques** :
- ADM1/2/3 (existant)
- Dessiner zone (nouveau)
- Rayon autour point (nouveau)

**Données** :
- Avec/sans données (existant)
- Min sondages (existant)
- Min essais (nouveau)
- Score qualité (nouveau)
- Real only (nouveau)

**Essais** (NOUVEAU) :
- Types : Atterberg, VBS, Granulo, Proctor, Gonflement
- Profondeur : min-max
- WL range : min-max
- VBS range : min-max
- Classification USCS : multi-select
- Classification AASHTO : multi-select

**Temporel** (NOUVEAU) :
- Périodes rapides : 7j, 30j, 3m, 6m, 1an
- Dates personnalisées : début-fin
- Année : dropdown
- Mois : dropdown

**Badges Actifs** :
- Affichage visuel
- Suppression rapide (×)
- Compteur sur header

**Presets** (NOUVEAU) :
- Sauvegarder config
- Charger preset
- 4 presets par défaut

### 3. SONDAGES

**Dropdown "Nouveau"** :
- Géotechnique
- GPS simple
- Import CSV
- Import Bulk

**Actions Groupées** (NOUVEAU) :
- Géocoder sélection
- Exporter sélection
- Assigner à maille
- Supprimer sélection

### 4. ACTIONS MAILLE (Contextuel)

**Affiché si** : Maille sélectionnée  
**Actions** :
- Recalculer IDW
- Voir géométrie
- Statistiques
- Centrer carte
- Voir voisines
- Exporter

### 5. EXPORT

**Configurateur** (NOUVEAU) :
- Format : 7 formats (GeoJSON, CSV, Excel, PDF, GPKG, SHP, KML)
- Portée : Vue, Filtrés, Sélection, Maille, Tout
- Contenu : Mailles, Sondages, Échantillons, Essais
- Filtres : Appliquer ou non

**Exports Rapides** :
- GeoJSON, CSV, PDF, Excel (1 clic)

**Historique** (NOUVEAU) :
- Derniers exports
- Re-téléchargement
- Taille + date

---

## ⌨️ RACCOURCIS

- `Ctrl+F` : Recherche
- `Ctrl+N` : Nouveau sondage
- `Ctrl+E` : Export rapide
- `Ctrl+R` : Reset filtres
- `Escape` : Fermer modals

---

## 📊 COMPARAISON

| Métrique | Actuel | v3.0 | Gain |
|----------|--------|------|------|
| Sections | 6 plates | 5 accordéons | Organisation |
| Boutons | 21 visibles | ~8 contextuels | -62% |
| Filtres | 6 | 15+ | +150% |
| Recherche | Code maille | Multi-types | +300% |
| Export | 6 formats | 7 + config | +17% |
| Actions groupées | 0 | 4 | Nouveau |
| Raccourcis | 0 | 5 | Nouveau |

---

## 📁 FICHIERS À CRÉER

### TypeScript (5 fichiers, ~1250 lignes)
1. `ui/src/right-panel.ts` (500 lignes)
2. `ui/src/filters-manager.ts` (300 lignes)
3. `ui/src/search-unified.ts` (200 lignes)
4. `ui/src/export-configurator.ts` (250 lignes)

### CSS (1 fichier, ~200 lignes)
5. `ui/src/right-panel.css` (200 lignes)

### HTML (1 fichier modifié)
6. `ui/index.html` (section panneau droit, ~300 lignes)

**Total** : ~1750 lignes de code

---

## 🎯 PLAN D'IMPLÉMENTATION

### Phase 1 : Structure (4-5h)
1. HTML accordéons 5 sections
2. CSS accordéons + animations
3. JavaScript toggle accordéons
4. Badges compteurs

### Phase 2 : Filtres (3-4h)
1. Filtres Essais
2. Filtres Temporels
3. Badges actifs
4. Presets

### Phase 3 : Recherche & CRUD (2-3h)
1. Recherche unifiée
2. Suggestions temps réel
3. Dropdown "Nouveau"
4. Actions groupées

### Phase 4 : Export (2-3h)
1. Configurateur
2. Historique
3. Exports rapides

### Phase 5 : Finitions (1h)
1. Raccourcis clavier
2. Toast notifications
3. Progress bars
4. Tests

---

## 💡 RECOMMANDATION

**Option B : Implémentation Progressive**

**v2.1.0** (3-4h) - Immédiat :
- Accordéons + CSS
- Recherche unifiée basique
- Filtres Essais + Temporel
- Badges actifs
- Dropdown "Nouveau"
- Actions maille contextuelles
- Raccourcis clavier

**v2.2.0** (3-4h) - Après feedback :
- Suggestions temps réel
- Actions groupées
- Configurateur export
- Historique exports
- Presets filtres

**v3.0.0** (1h) - Polish :
- Tests complets
- Documentation
- Optimisations

---

## 📞 POUR REPRENDRE

**Commandes** :
```powershell
# Créer branche
git checkout -b feature/panneau-droit-v3

# Créer fichiers
New-Item ui/src/right-panel.ts
New-Item ui/src/filters-manager.ts
New-Item ui/src/search-unified.ts
New-Item ui/src/export-configurator.ts
New-Item ui/src/right-panel.css

# Build
cd ui
npm run build

# Test
npm run dev
```

**Documents de référence** :
- `PANNEAU_DROIT_V3_RESUME.md` : Résumé exécutif
- `DECISION_PANNEAU_DROIT.md` : Analyse options
- Ce fichier : Contexte complet

---

**Prêt pour implémentation !**
