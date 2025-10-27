# 🚀 Plan d'Améliorations Atlas v1.3.1

## 📋 Modifications Demandées

### 1. ❌ Désactiver le Chargement Paresseux
**Fichier**: `ui/src/main.ts`
- Supprimer le chargement par bbox
- Charger toutes les mailles au démarrage
- Ligne à modifier: `loadGrid()` au lieu de `loadGridByBbox()`

### 2. 🎯 Transformer la Colonne Gauche en Fiche Géotechnique
**Fichiers**: `ui/index.html`, `ui/src/main.ts`, `ui/src/style.css`

**Structure de la fiche**:
```
┌─────────────────────────────────────┐
│ Code: TG-0493-0212-01               │
│ Maritime > Agoe-Nyivé > Adetikopé   │
│ État: ✅ avec données                │
│ [Recalculer] [GeoJSON] [+ Sondage] │
├─────────────────────────────────────┤
│ ┌──────────┬──────────┐             │
│ │ Sondages │    5     │             │
│ │ Essais   │   13     │             │
│ ├──────────┼──────────┤             │
│ │ IDW N    │  23.7    │             │
│ │ Prof(m)  │ 1.0–12   │             │
│ └──────────┴──────────┘             │
├─────────────────────────────────────┤
│ 📊 SPT_N vs Profondeur [chart]      │
│ 📊 qc vs Profondeur [chart]         │
│ 📊 Histogramme Profondeur [chart]   │
├─────────────────────────────────────┤
│ 📋 Sondages (5)                     │
│ ▼ S-2025-001 (📍 coordonnées)       │
│   Type  | Valeur | Z(m) | Date      │
│   SPT_N |   18   | 6.0  | 2024-12   │
│   [Éditer] [Supprimer] [Localiser] │
│                                     │
│ ▼ S-2025-002 (🏷 ADM-only)          │
│   ...                               │
└─────────────────────────────────────┘
```

**Nouveau endpoint API nécessaire**:
```rust
GET /grid/{code}/details
Response: {
  code: string,
  adm: { adm1, adm2, adm3 },
  kpi: {
    sondages: number,
    essais: number,
    idw_spt_n: number | null,
    zmin: number | null,
    zmax: number | null,
    updated_at: string
  },
  sondages: [{
    id: string,
    has_coords: boolean,
    lon: number | null,
    lat: number | null,
    source: string | null,
    date: string | null,
    essais: [{
      type: "SPT_N" | "qc",
      value: number,
      unit: string,
      depth_m: number,
      date: string | null
    }]
  }]
}
```

### 3. 📜 Corriger le Scroll du Panneau Droit
**Fichier**: `ui/src/style.css`
- Le panneau droit doit avoir son propre scroll
- Ne pas faire défiler toute la page
- Ajouter `overflow-y: auto` et `max-height: calc(100vh - 60px)`

### 4. ⏱️ Augmenter la Durée des Toasts et Highlights
**Fichier**: `ui/src/main.ts`
- Toasts: 3s → 5s ✅ (déjà fait ligne 22)
- Highlights mailles: maintenir 5s avant reset
- Ajouter un timer pour réinitialiser le style après 5s

### 5. 🔧 Corriger les Boutons d'Export
**Fichier**: `ui/src/main.ts`
- Export Sondages (CSV/Bulk)
- Export GeoJSON
- Export Markdown
- GeoPackage
- PDF Professionnel

### 6. 📊 Ajouter les Graphiques Miniatures
**Fichiers**: `ui/index.html`, `ui/src/main.ts`
- Utiliser Chart.js (ajouter dépendance)
- 3 mini-charts:
  1. SPT_N vs Profondeur (scatter)
  2. qc vs Profondeur (scatter)
  3. Histogramme Profondeur (bar)

### 7. 🎨 Contours Dynamiques selon le Zoom
**Fichier**: `ui/src/main.ts`
- ✅ Déjà implémenté (lignes 44-46)
- Vérifier que ça fonctionne bien

### 8. ✏️ CRUD Complet
**Fichiers**: `ui/index.html`, `ui/src/main.ts`
- Create: ✅ Déjà implémenté
- Read: ✅ Déjà implémenté
- Update: À implémenter (modal d'édition)
- Delete: À implémenter (confirmation + API call)

---

## 🎯 Ordre d'Implémentation

### Phase 1: Corrections Rapides (30 min)
1. ✅ Désactiver chargement paresseux
2. ✅ Corriger scroll panneau droit
3. ✅ Augmenter durée highlights
4. ✅ Corriger boutons export

### Phase 2: Backend API (1h)
5. Créer endpoint `/grid/{code}/details`
6. Tester avec curl/Postman

### Phase 3: Fiche Géotechnique (2h)
7. Restructurer HTML colonne gauche
8. Implémenter `loadMailleDetails(code)`
9. Afficher KPIs
10. Lister sondages (accordéon)

### Phase 4: Graphiques (1h)
11. Ajouter Chart.js
12. Créer mini-charts
13. Intégrer dans la fiche

### Phase 5: CRUD (1h)
14. Modal édition sondage
15. Bouton suppression avec confirmation
16. Tests

---

## 📦 Dépendances à Ajouter

```bash
cd ui
npm install chart.js
```

---

## 🔄 Modifications Prioritaires MAINTENANT

1. **Désactiver chargement paresseux** (1 ligne)
2. **Corriger scroll panneau** (CSS)
3. **Augmenter highlights** (quelques lignes)
4. **Corriger exports** (vérifier event listeners)

Commençons par ces 4 points !
