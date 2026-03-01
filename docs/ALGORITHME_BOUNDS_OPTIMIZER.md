# ALGORITHME BOUNDS OPTIMIZER - DOCUMENTATION TECHNIQUE DÉTAILLÉE

**Version**: 3.5.4  
**Fichier source**: `ui/src/export/bounds-optimizer.ts`  
**Auteur**: Atlas Géotechnique  
**Date**: 27 décembre 2025

---

## TABLE DES MATIÈRES

1. [Vue d'ensemble](#vue-densemble)
2. [Constantes et paramètres](#constantes-et-paramètres)
3. [Types et interfaces](#types-et-interfaces)
4. [Architecture de la classe](#architecture-de-la-classe)
5. [Algorithme principal](#algorithme-principal)
6. [Recherche binaire](#recherche-binaire)
7. [Calcul des métriques](#calcul-des-métriques)
8. [Calcul de la clearance réelle](#calcul-de-la-clearance-réelle)
9. [Densification de la géométrie](#densification-de-la-géométrie)
10. [Règle métier des marges en km](#règle-métier-des-marges-en-km)
11. [Exemples de logs](#exemples-de-logs)

---

## 1. VUE D'ENSEMBLE

### Objectif

L'algorithme **BoundsOptimizer** calcule le cadrage optimal d'une zone administrative (ADM1/ADM2/ADM3) pour l'export cartographique A4, en maximisant l'occupation de la page tout en respectant des contraintes de sécurité.

### Problème résolu

Lors de l'export d'une carte thématique pour une zone ADM:
- La zone peut avoir une forme irrégulière (côtière, allongée, oblique)
- Le format A4 impose un ratio fixe (portrait 0.877 ou paysage 2.036)
- Il faut éviter que la géométrie touche les bords du cadre (risque de coupure)
- Il faut minimiser les marges vides (océan, pays voisins)

### Solution

1. **Densification de la géométrie**: Convertir le polygone ADM en ~800 points espacés de 4 km
2. **Recherche binaire**: Tester différents niveaux de zoom (shrink factor 0.80 → 1.00)
3. **Double contrainte**: Vérifier à la fois la clearance en pixels ET la marge en kilomètres
4. **Optimisation bi-orientation**: Tester portrait et paysage, choisir la meilleure occupation

---

## 2. CONSTANTES ET PARAMÈTRES

### Constantes globales

```typescript
const MIN_CLEARANCE_KM = 5.0   // Marge minimale en km (règle métier)
const MAX_CLEARANCE_KM = 8.0   // Tolérance haute (non utilisée actuellement)
const KM_PER_DEG_LAT = 111.0   // Approximation sphérique (1° lat ≈ 111 km)
```

### Options par défaut

```typescript
const DEFAULT_OPTIONS: OptimizationOptions = {
  safePx: 16,              // Marge minimale en pixels (sécurité visuelle)
  maxIterations: 15,       // Nombre max d'itérations binary search
  muStart: 0.01,           // Marge initiale (1% de la bbox ADM)
  searchStrategy: 'binary', // Stratégie de recherche (seule implémentée)
  logPrefix: 'ADM'         // Préfixe des logs console
}
```

### Paramètres de qualité

```typescript
const QUALITY_SETTINGS = {
  low: { dpi: 150 },    // Basse résolution (rapide)
  hd: { dpi: 300 },     // Haute résolution (défaut)
  ultra: { dpi: 600 }   // Ultra haute résolution (lent)
}
```

**Impact du DPI**: Plus le DPI est élevé, plus la résolution pixel est grande, donc plus la clearance en pixels est stricte.

---

## 3. TYPES ET INTERFACES

### BoundsRect

Rectangle géographique en degrés décimaux:

```typescript
interface BoundsRect {
  north: number  // Latitude nord (ex: 11.138)
  south: number  // Latitude sud (ex: 6.088)
  east: number   // Longitude est (ex: 1.809)
  west: number   // Longitude ouest (ex: -0.149)
}
```

### BoundsMetrics

Résultat complet de l'optimisation avec 20+ métriques:

```typescript
interface BoundsMetrics {
  bounds: BoundsRect           // Bounds finales optimisées
  
  // KPI marges bbox (en %)
  pad_left_pct: number         // Marge gauche (0.0 → 1.0)
  pad_right_pct: number        // Marge droite
  pad_top_pct: number          // Marge haute
  pad_bottom_pct: number       // Marge basse
  pad_min_pct: number          // Marge minimale
  pad_max_pct: number          // Marge maximale (KPI principal)
  
  // KPI clearance réelle (en pixels)
  clear_left_px: number        // Distance géométrie ↔ bord gauche
  clear_right_px: number       // Distance géométrie ↔ bord droit
  clear_top_px: number         // Distance géométrie ↔ bord haut
  clear_bottom_px: number      // Distance géométrie ↔ bord bas
  clear_min_px: number         // Clearance minimale (KPI sécurité)
  clear_min_side: string       // Côté critique ('left'|'right'|'top'|'bottom')
  
  // KPI marges en km (NOUVEAU v3.5.4)
  margin_top_km: number        // Marge haute en km
  margin_bottom_km: number     // Marge basse en km
  margin_left_km: number       // Marge gauche en km
  margin_right_km: number      // Marge droite en km
  margin_min_km: number        // Marge minimale en km (règle métier)
  margin_max_km: number        // Marge maximale en km
  
  // KPI occupation
  occ_x: number                // Occupation horizontale (0.0 → 1.0)
  occ_y: number                // Occupation verticale
  occ_area: number             // Occupation surfacique (KPI principal)
  occ_major: number            // Occupation axe majeur
  
  // Métadonnées
  orientation: string          // 'portrait' | 'landscape'
  shrinkFactor: number         // Facteur de rétrécissement appliqué (0.80 → 1.00)
}
```

### ADMGeometry

Géométrie GeoJSON de la zone ADM:

```typescript
interface ADMGeometry {
  type: 'Polygon' | 'MultiPolygon'
  coordinates: any  // Format GeoJSON standard
}
```

---

## 4. ARCHITECTURE DE LA CLASSE

### Propriétés privées

```typescript
class BoundsOptimizer {
  private options: OptimizationOptions          // Configuration
  private quality: ExportQuality                // 'low' | 'hd' | 'ultra'
  private admGeometry: ADMGeometry | null       // Géométrie source
  private densifiedBoundary: Array<{lat, lng}>  // Points densifiés (~800)
}
```

### Méthodes publiques

```typescript
public async computeOptimalBounds(
  admBounds: BoundsRect,
  geometry?: ADMGeometry
): Promise<BoundsMetrics>
```

**Point d'entrée principal** - Orchestre l'optimisation complète.

### Méthodes privées

1. `optimizeForOrientation()` - Recherche binaire pour une orientation
2. `computeMetricsForShrink()` - Calcule toutes les métriques pour un shrink donné
3. `computeClearance()` - Calcule la clearance réelle en pixels
4. `densifyBoundary()` - Densifie la géométrie ADM
5. `logFinalMetrics()` - Affiche les métriques finales

---

## 5. ALGORITHME PRINCIPAL

### Workflow global

```
computeOptimalBounds(admBounds, geometry)
│
├─ 1. Densification géométrie
│    └─ densifyBoundary() → ~800 points espacés de 4 km
│
├─ 2. Optimisation portrait
│    └─ optimizeForOrientation('portrait')
│         └─ Binary search shrink ∈ [0.80, 1.00]
│              └─ computeMetricsForShrink(shrink)
│                   ├─ Calcul bounds
│                   ├─ Calcul marges %
│                   ├─ Calcul marges km
│                   ├─ Calcul clearance px
│                   └─ Calcul occupation
│
├─ 3. Optimisation paysage
│    └─ optimizeForOrientation('landscape')
│         └─ [même processus]
│
├─ 4. Sélection meilleure orientation
│    └─ max(occ_area_portrait, occ_area_paysage)
│
└─ 5. Logs et retour
     └─ logFinalMetrics(best)
```

### Code source simplifié

```typescript
public async computeOptimalBounds(
  admBounds: BoundsRect,
  geometry?: ADMGeometry
): Promise<BoundsMetrics> {
  
  // 1. Densifier la géométrie
  if (geometry) {
    this.admGeometry = geometry
    this.densifiedBoundary = this.densifyBoundary(geometry)
    // Résultat: ~800 points espacés de 4 km
  }
  
  // 2. Optimiser les deux orientations
  const portraitMetrics = await this.optimizeForOrientation(admBounds, 'portrait')
  const landscapeMetrics = await this.optimizeForOrientation(admBounds, 'landscape')
  
  // 3. Choisir la meilleure (occupation maximale)
  const best = portraitMetrics.occ_area >= landscapeMetrics.occ_area 
    ? portraitMetrics 
    : landscapeMetrics
  
  // 4. Logger et retourner
  this.logFinalMetrics(best)
  return best
}
```

---

## 6. RECHERCHE BINAIRE

### Principe

L'algorithme cherche le **shrink factor optimal** qui maximise l'occupation tout en respectant les contraintes de sécurité.

**Shrink factor** (μ_shrink):
- `1.00` = marge initiale complète (1% de la bbox ADM)
- `0.80` = marge réduite à 80% (zoom maximal)
- Plus le shrink est petit, plus on zoome (moins de marge)

### Intervalle de recherche

```
shrinkMin = 0.80  (zoom maximal, risque de toucher les bords)
shrinkMax = 1.00  (marge initiale, sûr mais peu optimal)
```

### Itérations

À chaque itération:

```typescript
iteration++
shrinkMid = (shrinkMin + shrinkMax) / 2

metrics = computeMetricsForShrink(admBounds, orientation, shrinkMid)

// Double contrainte (RÈGLE MÉTIER v3.5.4)
clearancePxOk = metrics.clear_min_px >= safePx        // Ex: >= 16px
marginKmOk = metrics.margin_min_km >= MIN_CLEARANCE_KM // Ex: >= 5km

if (clearancePxOk && marginKmOk) {
  // ✅ Acceptable - essayer de serrer plus
  bestMetrics = metrics
  shrinkMin = shrinkMid  // Réduire l'intervalle vers le bas
} else {
  // ❌ Trop serré - reculer
  shrinkMax = shrinkMid  // Réduire l'intervalle vers le haut
}
```

### Condition d'arrêt

```typescript
while (iteration < maxIterations && (shrinkMax - shrinkMin) > 0.001) {
  // ...
}
```

**Arrêt si**:
- 15 itérations atteintes (maxIterations)
- OU intervalle < 0.001 (convergence)

### Fallback

Si aucune solution n'est trouvée (toutes les tentatives rejetées):

```typescript
if (!bestMetrics) {
  bestMetrics = computeMetricsForShrink(admBounds, orientation, 1.0)
  // Utiliser shrink=1.0 (marge initiale complète)
}
```

---

## 7. CALCUL DES MÉTRIQUES

### Étape 1: Dimensions ADM en km

```typescript
const admWidthDeg = admBounds.east - admBounds.west   // Ex: 1.958°
const admHeightDeg = admBounds.north - admBounds.south // Ex: 5.050°
const centerLat = (admBounds.north + admBounds.south) / 2
const centerLng = (admBounds.east + admBounds.west) / 2

// Correction latitude pour longitude
const cosLat = Math.cos(centerLat * Math.PI / 180)

// Conversion en km
const W0_km = admWidthDeg * 111 * cosLat  // Largeur ADM en km
const H0_km = admHeightDeg * 111          // Hauteur ADM en km
```

**Pourquoi `cosLat`?**  
À l'équateur, 1° de longitude = 111 km.  
À 45° de latitude, 1° de longitude ≈ 78 km (111 × cos(45°)).  
La correction `cosLat` ajuste la conversion pour la latitude de la zone.

### Étape 2: Application de la marge initiale

```typescript
const mu = muStart * shrinkFactor  // Ex: 0.01 * 0.92 = 0.0092
const W1 = admWidthDeg * (1 + 2 * mu)  // Ajouter marge gauche + droite
const H1 = admHeightDeg * (1 + 2 * mu) // Ajouter marge haut + bas
```

**Exemple numérique**:
- `admWidthDeg = 1.958°`
- `muStart = 0.01` (1%)
- `shrinkFactor = 0.92`
- `mu = 0.0092`
- `W1 = 1.958 * (1 + 2*0.0092) = 1.994°`

### Étape 3: Ajustement au ratio A4

Le format A4 impose un ratio fixe:
- **Portrait**: `AR_frame = 0.8771` (largeur/hauteur)
- **Paysage**: `AR_frame = 2.0360`

```typescript
const layout = getA4Layout(dpi, orientation)
const AR_frame = layout.targetAspectRatio  // Ex: 0.8771 pour portrait

const W1_km = W1 * 111 * cosLat
const H1_km = H1 * 111
const AR_1 = W1_km / H1_km  // Ratio actuel de la zone avec marge

let W2 = W1, H2 = H1

if (AR_1 > AR_frame) {
  // Zone trop large → augmenter hauteur
  H2 = (W1_km / AR_frame) / 111
} else if (AR_1 < AR_frame) {
  // Zone trop haute → augmenter largeur
  W2 = (H1_km * AR_frame) / (111 * cosLat)
}
```

**Exemple**:
- Zone Maritime: `AR_1 = 0.65` (plus haute que large)
- Format portrait: `AR_frame = 0.8771`
- `AR_1 < AR_frame` → augmenter largeur
- Résultat: bandes latérales ajoutées

### Étape 4: Bounds finales

```typescript
const halfW2 = W2 / 2
const halfH2 = H2 / 2

const bounds: BoundsRect = {
  west: centerLng - halfW2,
  east: centerLng + halfW2,
  south: centerLat - halfH2,
  north: centerLat + halfH2
}
```

### Étape 5: Calcul des marges bbox (%)

```typescript
const frameWidthDeg = bounds.east - bounds.west
const frameHeightDeg = bounds.north - bounds.south

const pad_left_pct = (admBounds.west - bounds.west) / frameWidthDeg
const pad_right_pct = (bounds.east - admBounds.east) / frameWidthDeg
const pad_top_pct = (bounds.north - admBounds.north) / frameHeightDeg
const pad_bottom_pct = (admBounds.south - bounds.south) / frameHeightDeg

const pad_max_pct = Math.max(pad_left_pct, pad_right_pct, pad_top_pct, pad_bottom_pct)
```

**Interprétation**:
- `pad_left_pct = 0.168` → 16.8% de marge à gauche
- `pad_max_pct = 0.168` → marge maximale de 16.8%

### Étape 6: Calcul des marges en km (NOUVEAU v3.5.4)

```typescript
const latMid = (bounds.north + bounds.south) / 2
const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(latMid * Math.PI / 180)

const margin_top_km = (bounds.north - admBounds.north) * KM_PER_DEG_LAT
const margin_bottom_km = (admBounds.south - bounds.south) * KM_PER_DEG_LAT
const margin_left_km = (admBounds.west - bounds.west) * kmPerDegLon
const margin_right_km = (bounds.east - admBounds.east) * kmPerDegLon

const margin_min_km = Math.min(margin_top_km, margin_bottom_km, margin_left_km, margin_right_km)
```

**Exemple numérique**:
- `bounds.north = 8.600°`, `admBounds.north = 8.478°`
- `margin_top_km = (8.600 - 8.478) * 111 = 13.5 km`

### Étape 7: Calcul de la clearance (px)

```typescript
const clearance = this.computeClearance(bounds, layout.mapArea.width, layout.mapArea.height)
// Voir section 8 pour détails
```

### Étape 8: Calcul de l'occupation

```typescript
const finalWidthKm = frameWidthDeg * 111 * cosLat
const finalHeightKm = frameHeightDeg * 111

const occ_x = W0_km / finalWidthKm      // Occupation horizontale
const occ_y = H0_km / finalHeightKm     // Occupation verticale
const occ_area = (W0_km * H0_km) / (finalWidthKm * finalHeightKm)  // Occupation surfacique
const occ_major = Math.max(occ_x, occ_y) // Occupation axe majeur
```

**Interprétation**:
- `occ_area = 0.651` → la zone ADM occupe 65.1% de la surface du cadre
- `occ_major = 0.980` → l'axe majeur occupe 98% (zone bien ajustée sur un axe)

---

## 8. CALCUL DE LA CLEARANCE RÉELLE

### Objectif

Calculer la **distance minimale en pixels** entre la géométrie ADM densifiée et les bords du cadre.

### Cas 1: Sans géométrie (fallback)

Si aucune géométrie n'est fournie:

```typescript
if (this.densifiedBoundary.length === 0) {
  return {
    clear_left_px: 50,
    clear_right_px: 50,
    clear_top_px: 50,
    clear_bottom_px: 50,
    clear_min_px: 50,
    clear_min_side: 'left'
  }
}
```

**Valeur conservative**: 50px sur tous les côtés.

### Cas 2: Avec géométrie densifiée (précis)

```typescript
const frameWidthDeg = bounds.east - bounds.west
const frameHeightDeg = bounds.north - bounds.south

// Conversion degrés → pixels
const pxPerDegLng = frameWidthPx / frameWidthDeg
const pxPerDegLat = frameHeightPx / frameHeightDeg

let minLeft = Infinity
let minRight = Infinity
let minTop = Infinity
let minBottom = Infinity

// Parcourir tous les points densifiés (~800)
for (const point of this.densifiedBoundary) {
  // Convertir coordonnées géographiques → pixels dans le frame
  const x = (point.lng - bounds.west) * pxPerDegLng
  const y = (bounds.north - point.lat) * pxPerDegLat  // Inverser Y (nord en haut)
  
  // Distance aux 4 bords
  const distLeft = x
  const distRight = frameWidthPx - x
  const distTop = y
  const distBottom = frameHeightPx - y
  
  // Garder le minimum pour chaque côté
  minLeft = Math.min(minLeft, distLeft)
  minRight = Math.min(minRight, distRight)
  minTop = Math.min(minTop, distTop)
  minBottom = Math.min(minBottom, distBottom)
}

// Trouver le côté critique (clearance minimale)
const clearances = { left: minLeft, right: minRight, top: minTop, bottom: minBottom }
const minEntry = Object.entries(clearances).reduce((min, [side, val]) => 
  val < min[1] ? [side, val] : min
, ['left', minLeft])

return {
  clear_left_px: minLeft,
  clear_right_px: minRight,
  clear_top_px: minTop,
  clear_bottom_px: minBottom,
  clear_min_px: minEntry[1],
  clear_min_side: minEntry[0]
}
```

### Exemple numérique

**Configuration**:
- Frame: 2362px × 2693px (A4 portrait 300 DPI)
- Bounds: [0.330°W, 1.809°E, 6.088°S, 8.600°N]
- Point critique: `{lat: 8.478, lng: 1.677}`

**Calcul**:
```
frameWidthDeg = 1.809 - (-0.330) = 2.139°
frameHeightDeg = 8.600 - 6.088 = 2.512°

pxPerDegLng = 2362 / 2.139 = 1104.3 px/°
pxPerDegLat = 2693 / 2.512 = 1072.1 px/°

x = (1.677 - (-0.330)) * 1104.3 = 2217.3 px
y = (8.600 - 8.478) * 1072.1 = 130.8 px

distLeft = 2217.3 px
distRight = 2362 - 2217.3 = 144.7 px
distTop = 130.8 px
distBottom = 2693 - 130.8 = 2562.2 px

clear_min_px = 130.8 px (côté top)
```

---

## 9. DENSIFICATION DE LA GÉOMÉTRIE

### Objectif

Convertir le polygone ADM (quelques dizaines de points) en un polygone densifié (~800 points espacés de 4 km) pour un calcul précis de la clearance.

### Algorithme

```typescript
private densifyBoundary(geometry: ADMGeometry): Array<{ lat: number; lng: number }> {
  const points: Array<{ lat: number; lng: number }> = []
  const targetSpacingKm = 4  // Espacement cible en km
  
  const processRing = (ring: number[][]) => {
    for (let i = 0; i < ring.length - 1; i++) {
      const [lng1, lat1] = ring[i]
      const [lng2, lat2] = ring[i + 1]
      
      // Distance approximative en km (formule euclidienne simplifiée)
      const dlng = lng2 - lng1
      const dlat = lat2 - lat1
      const distKm = Math.sqrt(dlng * dlng * 111 * 111 + dlat * dlat * 111 * 111)
      
      // Nombre de segments à créer
      const nSegments = Math.max(1, Math.ceil(distKm / targetSpacingKm))
      
      // Interpolation linéaire
      for (let j = 0; j < nSegments; j++) {
        const t = j / nSegments  // Paramètre d'interpolation [0, 1]
        points.push({
          lng: lng1 + t * dlng,
          lat: lat1 + t * dlat
        })
      }
    }
  }
  
  if (geometry.type === 'Polygon') {
    processRing(geometry.coordinates[0])  // Ring extérieur seulement
  } else if (geometry.type === 'MultiPolygon') {
    processRing(geometry.coordinates[0][0])  // Premier polygone, ring extérieur
  }
  
  return points
}
```

### Exemple

**Entrée**: Polygone Plateaux avec 761 points originaux

**Segment exemple**:
- Point A: `[1.677, 8.478]`
- Point B: `[1.685, 8.512]`
- Distance: `√((0.008*111)² + (0.034*111)²) = 3.9 km`
- nSegments: `ceil(3.9 / 4) = 1`
- Résultat: 1 point interpolé

**Sortie**: 780 points densifiés (espacement ~4 km)

### Pourquoi 4 km?

- **Trop dense** (1 km): Calcul lent, pas de gain de précision
- **Trop espacé** (10 km): Risque de manquer des détails (caps, baies)
- **4 km**: Bon compromis précision/performance

---

## 10. RÈGLE MÉTIER DES MARGES EN KM

### Motivation

**Problème observé** (avant v3.5.4):
- Maritime: `shrink=0.999`, `pad_max=17.7%` → beaucoup d'océan
- Plateaux: `shrink=0.999`, `pad_max=16.8%` → beaucoup de Togo/Ghana

**Cause**: L'algorithme acceptait les candidats si `clear_min_px >= 16px`, sans vérifier la distance réelle en kilomètres.

**Conséquence**: Pour les zones côtières ou frontalières, la clearance en pixels était respectée, mais la marge géographique était excessive (15-20 km au lieu de 5 km).

### Solution (v3.5.4)

Ajouter une **double contrainte** dans la recherche binaire:

```typescript
// RÈGLE MÉTIER: Vérifier clearance px ET marge km
const clearancePxOk = metrics.clear_min_px >= this.options.safePx        // Ex: >= 16px
const marginKmOk = metrics.margin_min_km >= MIN_CLEARANCE_KM             // Ex: >= 5km

if (clearancePxOk && marginKmOk) {
  // ✅ Acceptable
  bestMetrics = metrics
  shrinkMin = shrinkMid
} else {
  // ❌ Rejeté
  shrinkMax = shrinkMid
  const reason = !clearancePxOk 
    ? `px too small (${metrics.clear_min_px.toFixed(1)} < ${this.options.safePx})`
    : `km too small (${metrics.margin_min_km.toFixed(1)} < ${MIN_CLEARANCE_KM})`
}
```

### Calcul des marges en km

```typescript
// Latitude médiane pour correction longitude
const latMid = (bounds.north + bounds.south) / 2
const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(latMid * Math.PI / 180)

// Distance entre bbox carte et bbox ADM en km
const margin_top_km = (bounds.north - admBounds.north) * KM_PER_DEG_LAT
const margin_bottom_km = (admBounds.south - bounds.south) * KM_PER_DEG_LAT
const margin_left_km = (admBounds.west - bounds.west) * kmPerDegLon
const margin_right_km = (bounds.east - admBounds.east) * kmPerDegLon

const margin_min_km = Math.min(margin_top_km, margin_bottom_km, margin_left_km, margin_right_km)
```

### Résultats attendus

**Avant** (v3.5.3):
```
Maritime: shrink=0.999, pad_max=17.7%, margin_min≈18km
Plateaux: shrink=0.999, pad_max=16.8%, margin_min≈15km
```

**Après** (v3.5.4):
```
Maritime: shrink=0.92, pad_max=6-8%, margin_min≈5.1km
Plateaux: shrink=0.94, pad_max=5-7%, margin_min≈5.2km
```

---

## 11. EXEMPLES DE LOGS

### Exemple 1: Plateaux (avant v3.5.4)

```
[Export][Bounds] Optimisation pour: Plateaux
[Export][Bounds] Géométrie densifiée: 780 points
[Export][Bounds] Optimisation portrait...
[Export][Bounds] portrait iter=1 shrink=0.900 clear_min=23.8px (top) occ_area=65.3%
[Export][Bounds] portrait iter=1 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=2 shrink=0.950 clear_min=25.1px (top) occ_area=65.2%
[Export][Bounds] portrait iter=2 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=3 shrink=0.975 clear_min=25.8px (top) occ_area=65.2%
[Export][Bounds] portrait iter=3 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=4 shrink=0.988 clear_min=26.1px (top) occ_area=65.1%
[Export][Bounds] portrait iter=4 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=5 shrink=0.994 clear_min=26.2px (top) occ_area=65.1%
[Export][Bounds] portrait iter=5 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=6 shrink=0.997 clear_min=26.3px (top) occ_area=65.1%
[Export][Bounds] portrait iter=6 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=7 shrink=0.998 clear_min=26.3px (top) occ_area=65.1%
[Export][Bounds] portrait iter=7 ✅ accept (safe clearance)
[Export][Bounds] portrait iter=8 shrink=0.999 clear_min=26.4px (top) occ_area=65.1%
[Export][Bounds] portrait iter=8 ✅ accept (safe clearance)
[Export][Bounds] portrait FINAL shrink=0.999 clear_min=26.4px pad_max=16.8% occ_major=98.0%

[Export][Bounds] FINAL METRICS
[Export][Bounds] Orientation: PORTRAIT
[Export][Bounds] Shrink factor: 0.999
[Export][Bounds] 📊 OCCUPATION:
[Export][Bounds]   occ_x=66.4% occ_y=98.0%
[Export][Bounds]   occ_area=65.1% occ_major=98.0%
[Export][Bounds] 📏 MARGES BBOX (%):
[Export][Bounds]   pad_top=1.0% pad_bottom=1.0%
[Export][Bounds]   pad_left=16.8% pad_right=16.8%
[Export][Bounds]   pad_max=16.8%
[Export][Bounds] 🎯 CLEARANCE RÉELLE (px):
[Export][Bounds]   clear_top=26.4px clear_bottom=26.4px
[Export][Bounds]   clear_left=396.9px clear_right=396.9px
[Export][Bounds]   clear_min=26.4px (side=top)
```

**Problème**: `shrink=0.999` → algorithme n'a presque pas serré, `pad_max=16.8%` trop élevé.

### Exemple 2: Plateaux (après v3.5.4, attendu)

```
[Export][Bounds] Optimisation pour: Plateaux
[Export][Bounds] Géométrie densifiée: 780 points
[Export][Bounds] Optimisation portrait...
[Export][Bounds] portrait iter=1 shrink=0.900 clear_min=23.8px (top) margin_min=4.2km occ_area=65.3%
[Export][Bounds] portrait iter=1 ❌ reject (km too small (4.2 < 5))
[Export][Bounds] portrait iter=2 shrink=0.950 clear_min=25.1px (top) margin_min=6.8km occ_area=65.2%
[Export][Bounds] portrait iter=2 ✅ accept (px=25.1 km=6.8)
[Export][Bounds] portrait iter=3 shrink=0.925 clear_min=24.4px (top) margin_min=5.3km occ_area=65.3%
[Export][Bounds] portrait iter=3 ✅ accept (px=24.4 km=5.3)
[Export][Bounds] portrait iter=4 shrink=0.912 clear_min=23.7px (top) margin_min=4.9km occ_area=65.3%
[Export][Bounds] portrait iter=4 ❌ reject (km too small (4.9 < 5))
[Export][Bounds] portrait iter=5 shrink=0.918 clear_min=24.0px (top) margin_min=5.1km occ_area=65.3%
[Export][Bounds] portrait iter=5 ✅ accept (px=24.0 km=5.1)
[Export][Bounds] portrait FINAL shrink=0.918 clear_min=24.0px margin_min=5.1km pad_max=6.3%

[Export][Bounds] FINAL METRICS
[Export][Bounds] Orientation: PORTRAIT
[Export][Bounds] Shrink factor: 0.918
[Export][Bounds] 📊 OCCUPATION:
[Export][Bounds]   occ_x=66.4% occ_y=98.0%
[Export][Bounds]   occ_area=65.1% occ_major=98.0%
[Export][Bounds] 📏 MARGES BBOX (%):
[Export][Bounds]   pad_top=1.0% pad_bottom=1.0%
[Export][Bounds]   pad_left=6.3% pad_right=6.3%
[Export][Bounds]   pad_max=6.3%
[Export][Bounds] 🎯 CLEARANCE RÉELLE (px):
[Export][Bounds]   clear_top=24.0px clear_bottom=24.0px
[Export][Bounds]   clear_left=148.7px clear_right=148.7px
[Export][Bounds]   clear_min=24.0px (side=top)
[Export][Bounds] 📍 MARGES EN KM (NOUVEAU):
[Export][Bounds]   margin_top=7.2km margin_bottom=5.1km
[Export][Bounds]   margin_left=8.4km margin_right=6.7km
[Export][Bounds]   margin_min=5.1km margin_max=8.4km
[Export][Bounds] ⚠️ Limite atteinte: marge minimale ~5km respectée
```

**Amélioration**:
- `shrink=0.918` (au lieu de 0.999) → zoom plus serré
- `pad_max=6.3%` (au lieu de 16.8%) → marges réduites de 62%
- `margin_min=5.1km` → règle métier respectée

---

## RÉSUMÉ TECHNIQUE

### Points clés de l'algorithme

1. **Densification géométrique**: 761 points → 780 points (espacement 4 km)
2. **Recherche binaire**: 15 itérations max, convergence < 0.001
3. **Double contrainte**: clearance px ≥ 16px ET marge km ≥ 5km
4. **Bi-orientation**: Teste portrait et paysage, choisit max(occ_area)
5. **Correction latitude**: Conversion degrés → km avec `cos(lat)`

### Complexité

- **Temps**: O(n × log(1/ε)) où n = nombre de points densifiés (~800), ε = précision (0.001)
- **Espace**: O(n) pour stocker les points densifiés
- **Itérations**: ~8-12 itérations en pratique

### Limites connues

1. **Approximation sphérique**: Utilise 111 km/° au lieu du modèle ellipsoïde WGS84
2. **Interpolation linéaire**: La densification ne suit pas les courbes géodésiques
3. **Ring extérieur seulement**: Ignore les trous (enclaves) dans les polygones
4. **Pas de buffer**: Ne prend pas en compte les mailles de données (uniquement ADM)

### Améliorations futures possibles

1. Ajouter un buffer des mailles de données à la géométrie ADM
2. Utiliser une interpolation géodésique (great circle) au lieu de linéaire
3. Implémenter une stratégie de recherche gradient descent en complément
4. Ajouter un paramètre `TARGET_CLEARANCE_KM` configurable par zone
5. Optimiser la densification (quadtree spatial pour réduire les points)

---

**FIN DE LA DOCUMENTATION TECHNIQUE**
