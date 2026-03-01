# 📋 DIAGNOSTIC ET PLAN D'ACTION – Atlas Géotechnique

Après analyse approfondie de l'architecture actuelle, voici mon diagnostic structuré selon les 5 axes demandés.

---

## 🧩 A. Architecture & Mise à l'échelle des Cartes

### Diagnostic

**Chaîne de capture actuelle :**
```
BBox ADM → computeOptimalBoundsForSheet() → fitBounds() → resize container → 
html2canvas capture → ExportFrame.drawMapImage() → letterbox → A4 canvas
```

**Fichiers clés :**
- `@c:\PROJET_ATLAS_MASTER\atlas\ui\src\export\export-frame.ts:151-194` : [getA4Layout()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:142:0-193:1) – source de vérité pour dimensions A4
- `@c:\PROJET_ATLAS_MASTER\atlas\ui\src\export\export-quick-dialog.ts:582-634` : calcul du bbox optimal et redimensionnement container
- `@c:\PROJET_ATLAS_MASTER\atlas\ui\src\export\export-frame.ts:483-534` : [drawMapImage()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:478:2-533:3) avec letterbox

**Problèmes identifiés :**

1. **Ratio incohérent entre régions** : 
   - La fonction [computeOptimalBoundsForSheet()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-quick-dialog.ts:2279:2-2377:3) (ligne ~582) calcule un bbox avec marge, mais le ratio géographique de l'ADM (largeur/hauteur en degrés) n'est pas corrigé par la latitude (projection Mercator).
   - Résultat : Maritime (allongée E-O) déborde, Plateaux (allongée N-S) a trop de marge.

2. **Décalage tuile/masque ADM** :
   - Le masque est dessiné via [drawAdmMask()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:535:2-631:3) (lignes 542-632) en convertissant lng/lat → pixels avec la bbox.
   - Si le `fitBounds()` Leaflet ne correspond pas exactement au bbox calculé (padding, maxZoom), le masque est décalé.

3. **Marges hard-codées** :
   - `LAYOUT_MM` définit des marges fixes (5mm), mais le padding géographique autour de l'ADM est calculé séparément dans [computeOptimalBoundsForSheet()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-quick-dialog.ts:2279:2-2377:3).

### Actions concrètes

| Action | Fichier | Description |
|--------|---------|-------------|
| **A1** | [export-quick-dialog.ts](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-quick-dialog.ts:0:0-0:0) | Créer `computeTightBoundsWithMargin(admBounds, marginPercent, targetAR)` qui : (1) corrige le ratio par cos(lat), (2) ajoute une marge % configurable, (3) ajuste pour matcher l'AR cible de la zone carte A4 |
| **A2** | [export-quick-dialog.ts](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-quick-dialog.ts:0:0-0:0) | Après `fitBounds()`, récupérer les bounds effectifs de Leaflet et les utiliser pour le masque (pas le bbox calculé) |
| **A3** | `export-types.ts` | Ajouter `marginPercent: number` (défaut 5%) dans `ExportOptions` |
| **A4** | [export-frame.ts](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:0:0-0:0) | Dans [drawMapImage()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:478:2-533:3), supprimer le letterbox si l'AR est déjà correct (éviter les bandes blanches) |

**Stratégie de correction :**
```typescript
// Pseudo-code pour A1
function computeTightBoundsWithMargin(
  admBounds: LatLngBounds,
  marginPercent: number = 0.05,
  targetAR: number
): LatLngBounds {
  const centerLat = (admBounds.north + admBounds.south) / 2;
  const cosLat = Math.cos(centerLat * Math.PI / 180);
  
  // Dimensions corrigées en "unités visuelles"
  const geoWidth = (admBounds.east - admBounds.west) * cosLat;
  const geoHeight = admBounds.north - admBounds.south;
  const admAR = geoWidth / geoHeight;
  
  // Ajuster pour matcher targetAR
  if (admAR > targetAR) {
    // ADM plus large → étendre en hauteur
    const newHeight = geoWidth / targetAR;
    // ... expand north/south
  } else {
    // ADM plus haute → étendre en largeur
    const newWidth = geoHeight * targetAR;
    // ... expand east/west (divisé par cosLat)
  }
  
  // Ajouter marge %
  return expandedBounds.pad(marginPercent);
}
```

---

## 🎨 B. Palettes de Couleurs par Thématique

### Diagnostic

**Situation actuelle :**
- Les palettes sont définies en dur dans `@c:\PROJET_ATLAS_MASTER\atlas\ui\src\thematic\thematic-maps.ts:347-356` (objet `palettes`)
- Chaque paramètre a une `defaultPalette` dans `thematic-types.ts`
- L'utilisateur peut choisir via le panneau, mais il n'y a pas de **mapping thématique → palette** centralisé

**Palettes disponibles** (d'après la capture) : Blues, BrBG, BuGn, BuPu, Cividis, GnBu, Greens, Greys, Inferno, Magma, Mako, OrRd, Oranges, PRGn, PiYG, Plasma, PuBu, PuBuGn, PuOr, PuRd, Purples, RdBu, RdGy, RdPu, RdYlBu, RdYlGn, Reds, Rocket, Spectral, Turbo, Viridis, YlGn, YlGnBu, YlOrBr, YlOrRd

### Design proposé

**Mapping thématique → palette :**

| Thématique | Palette recommandée | Justification |
|------------|---------------------|---------------|
| [vbs_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/adm1/vbs_avg:0:0-0:0) | **OrRd** ou **YlOrRd** | Risque argileux (chaud) |
| [ip_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/adm1/ip_avg:0:0-0:0) | **PuRd** ou **RdPu** | Plasticité (mauve/rose) |
| `eg_avg` | **Blues** ou **PuBu** | Gonflement (bleu) |
| [passant_80um_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/adm1/passant_80um_avg:0:0-0:0) | **BrBG** | Fines vs sables (divergent) |
| [passant_2mm_avg](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/adm1/passant_2mm_avg:0:0-0:0) | **YlGnBu** | Granulométrie |
| [n_sondages](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/adm1/n_sondages:0:0-0:0) | **Greens** | Densité de données |
| `gamma_d_max_avg` | **Oranges** | Compacité |
| `w_opt_avg` | **Blues** | Teneur en eau |

### Actions concrètes

| Action | Fichier | Description |
|--------|---------|-------------|
| **B1** | `thematic-types.ts` | Créer `THEMATIC_PALETTE_MAP: Record<string, { palette: string; reversed?: boolean }>` |
| **B2** | [thematic-maps.ts](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/thematic/thematic-maps.ts:0:0-0:0) | Modifier [getColors()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/thematic/thematic-maps.ts:343:2-367:3) pour lire depuis `THEMATIC_PALETTE_MAP` si aucune palette n'est spécifiée |
| **B3** | [export-frame.ts](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:0:0-0:0) | Dans [drawLegend()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:1215:2-1366:3) et [drawColoredCells()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:1058:2-1176:3), utiliser la même source de palettes |
| **B4** | [thematic-panel.ts](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/thematic/thematic-panel.ts:0:0-0:0) | Pré-sélectionner la palette recommandée quand on change de paramètre |

**Structure de configuration :**
```typescript
// thematic-types.ts
export const THEMATIC_PALETTE_MAP: Record<string, {
  palette: string;
  reversed?: boolean;
  diverging?: boolean;
  midpoint?: number;
}> = {
  'vbs_avg': { palette: 'YlOrRd' },
  'ip_avg': { palette: 'PuRd' },
  'eg_avg': { palette: 'Blues' },
  'passant_80um_avg': { palette: 'BrBG', diverging: true, midpoint: 50 },
  'passant_2mm_avg': { palette: 'YlGnBu' },
  'n_sondages': { palette: 'Greens' },
  'gamma_d_max_avg': { palette: 'Oranges' },
  'w_opt_avg': { palette: 'Blues' }
};
```

---

## 📊 C. Amélioration des Graphes Statistiques

### Analyse critique des graphes actuels

**Boxplots :**
- ✅ Titre clair, axe Y lisible
- ❌ Un seul groupe "Inconnu (n=xx)" → pas informatif pour "par préfecture"
- ❌ Unités absentes sur l'axe Y
- ❌ Rectangle rouge plein → visuellement lourd

**Histogrammes :**
- ✅ Forme de distribution visible, légende avec n/moy/min/max
- ❌ Axe X sans unité ("Valeur" trop générique)
- ❌ Pas de lignes verticales pour les seuils de classes
- ❌ Palette brute (rouge plein + bord bleu)

**Scatterplots :**
- ✅ R² et n affichés, droite de régression
- ❌ Unités absentes sur les axes
- ❌ Pas de corrélation r ni p-value
- ❌ Points tous identiques (pas de distinction par zone/classe)

### Guidelines visuelles "Style Atlas"

| Élément | Spécification |
|---------|---------------|
| **Police** | Arial/Helvetica, titre 14pt bold, axes 11pt |
| **Fond** | Gris très clair (#f8f9fa), grille fine (#e0e0e0) |
| **Couleurs** | Cohérentes avec la thématique (même palette que carte) |
| **Footer** | `n = X | moy = Y.YY unité | médiane = Z.ZZ | Q1–Q3 = A–B | min = C | max = D` |
| **Seuils** | Lignes verticales pointillées sur histogrammes aux breaks de classification |

### Actions concrètes

| Action | Fichier | Description |
|--------|---------|-------------|
| **C1** | Nouveau `chart-config.ts` | Créer configuration centralisée des styles de graphes |
| **C2** | Backend (Rust/Python) | Modifier la génération des graphes pour : (1) ajouter unités aux axes, (2) afficher r et p-value, (3) utiliser palette thématique |
| **C3** | Backend | Boxplots multi-préfectures : grouper par ADM2 au lieu d'un seul groupe |
| **C4** | Backend | Histogrammes : ajouter lignes verticales aux seuils de classes |
| **C5** | Export | Filtrer les mailles avec `n_sondages >= 2` pour les graphes de corrélation |

**Colonnes à utiliser :**
- Boxplots : `grid_*.geojson` → `properties.value`, groupé par `properties.adm2`
- Histogrammes : `grid_*.geojson` → `properties.value`
- Scatterplots : jointure entre `grid_vbs_avg.geojson`, `grid_ip_avg.geojson`, `grid_passant_80um_avg.geojson` sur `grid_id`

---

## 📁 D. Export des Données – Fichier Excel Unique

### Objectif

Générer `atlas_geotechnique_donnees_analyse.xlsx` avec une feuille par dataset :

| Feuille | Source | Colonnes clés |
|---------|--------|---------------|
| `grille_nationale` | `referentiels/grille_nationale.geojson` | code, geometry (WKT), adm1, adm2, adm3 |
| [adm1](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/adm1:0:0-0:0) | `referentiels/adm1.geojson` | name, geometry |
| `adm2` | `referentiels/adm2.geojson` | name, adm1, geometry |
| `grid_vbs_avg` | `donnees_agregees/grid_vbs_avg.geojson` | grid_id, value, n_sondages, n_essais |
| `grid_ip_avg` | idem | idem |
| `grid_eg_avg` | idem | idem |
| `grid_passant_80um_avg` | idem | idem |
| `grid_passant_2mm_avg` | idem | idem |
| `sondages` | [donnees_brutes/sondages.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/sondages.csv:0:0-0:0) | toutes colonnes |
| `essais_atterberg` | [donnees_brutes/essais_atterberg.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_atterberg.csv:0:0-0:0) | toutes colonnes |
| `essais_vbs` | [donnees_brutes/essais_vbs.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_vbs.csv:0:0-0:0) | toutes colonnes |
| `essais_granulo` | [donnees_brutes/essais_granulo.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_granulo.csv:0:0-0:0) | toutes colonnes |
| `essais_proctor` | [donnees_brutes/essais_proctor.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/essais_proctor.csv:0:0-0:0) | toutes colonnes (même si vide) |

### Actions concrètes

| Action | Fichier | Description |
|--------|---------|-------------|
| **D1** | Nouveau `export-excel.ts` (UI) | Créer module utilisant `xlsx` (SheetJS) pour générer le fichier Excel côté client |
| **D2** | `export-atlas-dialog.ts` | Ajouter checkbox "Inclure fichier Excel d'analyse" |
| **D3** | `capture-utils.ts` | Dans `generateZipWithMetadata()`, ajouter le fichier Excel au ZIP |
| **D4** | `export-excel.ts` | Fonction `generateAnalysisExcel(datasets: Map<string, any[]>): Blob` |

**Implémentation suggérée :**
```typescript
// export-excel.ts
import * as XLSX from 'xlsx';

export async function generateAnalysisExcel(
  geojsonFiles: Map<string, GeoJSON.FeatureCollection>,
  csvFiles: Map<string, string>
): Promise<Blob> {
  const workbook = XLSX.utils.book_new();
  
  // GeoJSON → feuilles (sans geometry pour alléger)
  for (const [name, geojson] of geojsonFiles) {
    const rows = geojson.features.map(f => ({
      ...f.properties,
      // Optionnel: geometry_wkt: toWKT(f.geometry)
    }));
    const sheet = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  
  // CSV → feuilles
  for (const [name, csvContent] of csvFiles) {
    const sheet = XLSX.utils.aoa_to_sheet(parseCSV(csvContent));
    XLSX.utils.book_append_sheet(workbook, sheet, name);
  }
  
  const buffer = XLSX.write(workbook, { type: 'array', bookType: 'xlsx' });
  return new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
}
```

---

## 🧾 E. Application du Rapport d'Audit

### E1. Axe Performance / Taille

**Problème :** PNG ~15.5 Mo/image, 521 Mo total

| Solution | Impact | Implémentation |
|----------|--------|----------------|
| **Compression PNG optimisée** | -30 à -50% | Utiliser `pngquant` ou `optipng` en post-traitement |
| **Format WebP** | -60 à -80% | Proposer option WebP (support navigateurs modernes) |
| **JPEG pour fond de carte** | -70% | Séparer fond (JPEG) et overlay (PNG transparent) |
| **Métadonnées DPI** | Aucun sur taille | Corriger dans [canvas.toBlob()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:1712:2-1726:3) avec chunk pHYs |

**Action E1 :** Dans `@c:\PROJET_ATLAS_MASTER\atlas\ui\src\export\export-frame.ts`, modifier [getCanvas()](cci:1://file:///c:/PROJET_ATLAS_MASTER/atlas/ui/src/export/export-frame.ts:1691:2-1696:3) ou la génération du blob pour injecter les métadonnées DPI :

```typescript
// Utiliser une lib comme 'png-metadata' ou encoder manuellement le chunk pHYs
// pHYs chunk: pixels per unit X, pixels per unit Y, unit (1 = meter)
// 300 DPI = 11811 pixels/meter
```

### E2. Axe Pertinence des Thématiques

**Problème :** Proctor (gamma_d_max, w_opt) échoue systématiquement

| Action | Description |
|--------|-------------|
| **E2a** | Avant export, vérifier si `grid_*.geojson` a des features. Si vide, skip avec message |
| **E2b** | Dans l'UI, griser les thématiques sans données |
| **E2c** | Dans [index.json](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%285%29/index.json:0:0-0:0), ajouter `skipped: [{ thematic: 'gamma_d_max_avg', reason: 'no_data' }]` |

### E3. Axe Métadonnées & Légendes

**Problème :** `legends` vide dans `metadata.json` et `README.md`

**Action E3 :** Dans le code d'export, après génération de chaque carte, récupérer la classification utilisée et l'écrire :

```typescript
// Dans export-atlas-dialog.ts ou capture-utils.ts
metadata.legends[thematic] = {
  classes: classification.labels.map((label, i) => ({
    label,
    min: i === 0 ? null : classification.breaks[i-1],
    max: classification.breaks[i] ?? null,
    color: classification.colors[i],
    count: classUsageCount.get(i) || 0
  })),
  unit: legendData.unit,
  method: classification.method
};
```

### E4. Axe Qualité des Données Brutes

**Problème :** Champs vides dans [sondages.csv](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas/atlas_geotechnique_2025-12-22%20%284%29/donnees_analyse/donnees_brutes/sondages.csv:0:0-0:0), `sondage_id` manquant dans essais

**Contrôles QA à implémenter :**

| Contrôle | Seuil d'alerte | Action |
|----------|----------------|--------|
| % coordonnées x,y vides | > 10% | ⚠️ Warning dans README |
| % sondage_id manquant dans essais | > 5% | ⚠️ Warning |
| Cohérence sondage ↔ essais | Essais orphelins | 🔴 Erreur |
| Valeurs hors plage (IP < 0, VBS < 0) | Toute occurrence | 🔴 Erreur |

**Action E4 :** Créer un onglet `_QA_SUMMARY` dans l'Excel avec :
- Taux de complétude par colonne
- Nombre de valeurs aberrantes
- Liens sondages ↔ essais manquants

---

## 📋 Résumé des Priorités

| Priorité | Section | Action clé |
|----------|---------|------------|
| 🔴 Haute | A | Corriger `computeTightBoundsWithMargin()` pour ratio cohérent |
| 🔴 Haute | E1 | Corriger métadonnées DPI (96 → 300) |
| 🔴 Haute | E2 | Skip thématiques sans données |
| 🟠 Moyenne | B | Implémenter `THEMATIC_PALETTE_MAP` |
| 🟠 Moyenne | C | Améliorer graphes (unités, multi-préfectures) |
| 🟠 Moyenne | D | Générer Excel d'analyse |
| 🟠 Moyenne | E3 | Remplir légendes dans metadata.json |
| 🟢 Basse | E4 | Contrôles QA dans Excel |

---

Souhaites-tu que je commence l'implémentation d'une section spécifique ? Je recommande de commencer par **A1** (correction du ratio) et **E2** (skip thématiques vides) car ce sont les problèmes les plus visibles.