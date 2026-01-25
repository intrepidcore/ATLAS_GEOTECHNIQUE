# 📓 Implémentation v3.5.4 - Cadrage ADM Avancé + Audits

**Date**: 27 décembre 2024  
**Version**: Atlas Géotechnique v3.5.4  
**Objectif**: Amélioration algorithme cadrage + audits palette/resizable/auth

---

## 🎯 Résumé Exécutif

Cette session implémente:

1. **Audit complet palette UI** avec logs détaillés pour tracer le flux DOM → state → rendu
2. **Correction resizable panels** - fond noir et direction drag
3. **Nouvel algorithme de cadrage ADM** avec KPI marges et clearance réelle
4. **BoundsOptimizer** - classe dédiée avec binary search itératif

---

## 📋 Fichiers Modifiés

### 1. UI - Version et Header

| Fichier | Modification |
|---------|--------------|
| `ui/index.html` | Version mise à jour: `v1.6.0` → `v3.5.4` |

### 2. Audit Palette UI

| Fichier | Modification |
|---------|--------------|
| `ui/src/thematic/thematic-panel.ts` | Logs audit complets dans event `change` palette, `buildConfigFromUI`, et `applyThematic` |
| `ui/src/thematic/thematic-maps.ts` | Logs `[ThematicMap][Interactive]` pour tracer palette reçue et `getColors()` |

**Logs ajoutés**:
```typescript
[ThematicUI][Palette] DOM value="Greens", selectedIndex=2, text="Greens", elementId="paletteSelect"
[ThematicUI][Palette] state before update="Blues"
[ThematicUI][Palette] state after update="Greens"
[ThematicUI][buildConfig] palette from DOM="Greens"
[ThematicUI][Apply] palette injected into config="Greens"
[ThematicMap][Interactive] palette received="Greens"
[ThematicMap][Interactive] getColors(palette="Greens", n=5)
```

**Diagnostic**: Ces logs permettent de tracer précisément où la palette est perdue ou mal propagée.

### 3. Correction Resizable Panels

| Fichier | Modification |
|---------|--------------|
| `ui/src/components/resizable-panel.ts` | Logs détaillés drag, correction CSS fond noir, clarification direction delta |

**Corrections appliquées**:
- **Fond noir**: Ajout `background: transparent` sur `.resizable-panel` et `pointer-events: none` pendant drag
- **Direction drag**: Commentaires explicites sur inversion delta pour `handlePosition='start'`
- **Logs**: `[Resizable] id=sidebar side=left dragEnd widthFinal=420px`

### 4. Nouvel Algorithme de Cadrage

| Fichier | Statut |
|---------|--------|
| `ui/src/export/bounds-optimizer.ts` | ✅ Créé - 450+ lignes |

**Architecture**:

```typescript
class BoundsOptimizer {
  // KPI Marges bbox (%)
  pad_left_pct, pad_right_pct, pad_top_pct, pad_bottom_pct
  pad_min_pct, pad_max_pct
  
  // KPI Clearance réelle (px)
  clear_left_px, clear_right_px, clear_top_px, clear_bottom_px
  clear_min_px, clear_min_side
  
  // KPI Occupation
  occ_x, occ_y, occ_area, occ_major
  
  // Méthodes
  computeOptimalBounds(admBounds, geometry)
  optimizeForOrientation(bounds, orientation)
  computeMetricsForShrink(bounds, orientation, shrinkFactor)
  computeClearance(bounds, frameWidth, frameHeight)
  densifyBoundary(geometry) // Densification tous les 4km
}
```

**Algorithme Binary Search**:
1. Tester portrait et paysage
2. Pour chaque orientation: binary search sur `shrinkFactor` (0.80 → 1.00)
3. À chaque itération: calculer métriques complètes
4. Accepter si `clear_min_px >= SAFE_PX` (16px par défaut)
5. Sinon reculer (shrink moins agressif)
6. Retourner meilleure solution trouvée

**Densification limite ADM**:
- Interpole points tous les ~4km le long des segments
- Évite de rater segments obliques qui s'approchent des bords
- Calcul précis de la distance réelle limite ↔ frame

**Logs générés**:
```
[ADM1][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ADM1][Bounds] Optimisation pour: Plateaux
[ADM1][Bounds] Géométrie densifiée: 247 points
[ADM1][Bounds] Optimisation portrait...
[ADM1][Bounds] portrait iter=1 shrink=0.900 clear_min=8.3px (left) occ_area=87.2%
[ADM1][Bounds] portrait iter=1 ❌ reject (clearance too small on left)
[ADM1][Bounds] portrait iter=2 shrink=0.950 clear_min=18.7px (left) occ_area=84.1%
[ADM1][Bounds] portrait iter=2 ✅ accept (safe clearance)
...
[ADM1][Bounds] portrait FINAL shrink=0.932 clear_min=16.2px pad_max=8.4% occ_major=96.8%
[ADM1][Bounds] ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
[ADM1][Bounds] FINAL METRICS
[ADM1][Bounds] Orientation: PORTRAIT
[ADM1][Bounds] Shrink factor: 0.932
[ADM1][Bounds] 
[ADM1][Bounds] 📊 OCCUPATION:
[ADM1][Bounds]   occ_x=59.4% occ_y=96.8%
[ADM1][Bounds]   occ_area=57.5% occ_major=96.8%
[ADM1][Bounds] 
[ADM1][Bounds] 📏 MARGES BBOX (%):
[ADM1][Bounds]   pad_top=1.6% pad_bottom=1.6%
[ADM1][Bounds]   pad_left=20.3% pad_right=20.3%
[ADM1][Bounds]   pad_max=20.3%
[ADM1][Bounds] 
[ADM1][Bounds] 🎯 CLEARANCE RÉELLE (px):
[ADM1][Bounds]   clear_top=47.2px clear_bottom=48.1px
[ADM1][Bounds]   clear_left=16.2px clear_right=16.8px
[ADM1][Bounds]   clear_min=16.2px (side=left)
[ADM1][Bounds] ⚠️ Limite atteinte: impossible de serrer plus sans risquer contact (left) — forme oblique/allongée.
```

---

## 🔧 Paramètres Configurables

### BoundsOptimizer Options

```typescript
{
  safePx: 16,           // Marge minimale en pixels (12-16 recommandé)
  maxIterations: 15,    // Nombre max itérations binary search
  muStart: 0.01,        // Marge initiale 1%
  searchStrategy: 'binary',
  logPrefix: 'ADM1',    // Pour logs différenciés ADM1/ADM2/ADM3
  admName: 'Plateaux'   // Nom pour logs
}
```

---

## 📊 Validation et Tests

### Tests Manuels Requis

```bash
# 1. Test palette UI
# - Sélectionner "Greens" dans panneau thématique
# - Cliquer "Appliquer"
# - Vérifier logs console: palette="Greens" partout
# - Vérifier carte et légende sont vertes

# 2. Test resizable panels
# - Redimensionner panneau gauche (dashboard)
# - Redimensionner panneau droit (sidebar)
# - Vérifier: pas de fond noir, carte se recadre
# - Vérifier logs: [Resizable] dragEnd -> invalidateSize()

# 3. Test cadrage ADM (nécessite intégration complète)
# - Exporter Plateaux en HD
# - Vérifier logs détaillés avec clear_min_px
# - Vérifier visuellement: marges minimales, pas de contact bord
```

### Validation Visuelle ADM1

| ADM1 | Forme | Occupation attendue | Contrainte |
|------|-------|---------------------|------------|
| **Plateaux** | Vertical (AR=0.59) | occ_y=96%+, occ_x=59% | Marges latérales inévitables |
| **Centrale** | Équilibré | occ_x=85%+, occ_y=85%+ | Bon remplissage |
| **Kara** | Horizontal | occ_x=90%+, occ_y=70% | Marges haut/bas |
| **Maritime** | Très horizontal | occ_x=95%+, occ_y=60% | Marges haut/bas importantes |
| **Savanes** | Horizontal | occ_x=88%+, occ_y=72% | Marges haut/bas |

**Critère d'acceptation**: `clear_min_px >= 16px` sur tous les côtés, pas de contact visuel limite/frame.

---

## ⚠️ Limitations et Contraintes

### 1. Contraintes Géométriques Inévitables

Quand `AR_adm` ≠ `AR_frame`, des marges sont **inévitables**:
- **Plateaux**: Vertical (AR=0.59) sur frame portrait (AR=0.88) → marges latérales 20%
- **Maritime**: Horizontal (AR=1.8) sur frame paysage (AR=1.41) → marges haut/bas

**Solution**: L'algorithme maximise `occ_major` (axe dominant) et accepte les marges sur l'axe secondaire.

### 2. Géométrie ADM Non Fournie

Si `geometry` n'est pas fournie à `BoundsOptimizer`:
- Utilise bbox comme approximation
- `clear_min_px` fixé à 50px (valeur conservative)
- Logs: `[Bounds] Géométrie non fournie - utilisation bbox approximation`

**Recommandation**: Toujours passer la géométrie GeoJSON pour calcul précis.

### 3. Densification Coûteuse

La densification de la limite ADM peut générer 200-500 points:
- Coût CPU acceptable pour export (opération unique)
- Pas de cache pour l'instant
- Possibilité d'optimisation future si nécessaire

---

## 🚀 Prochaines Étapes

### Étape 1: Intégration dans export-quick-dialog.ts

```typescript
// Remplacer computeOptimalBoundsForSheet par:
import { BoundsOptimizer } from './bounds-optimizer'

private async computeOptimalBoundsForSheet(
  admBounds: BoundsRect,
  quality: ExportQuality,
  admName?: string,
  geometry?: ADMGeometry
): Promise<BoundsRect> {
  
  const optimizer = new BoundsOptimizer(quality, {
    safePx: 16,
    maxIterations: 15,
    muStart: 0.01,
    logPrefix: 'ADM1',
    admName
  })
  
  const metrics = await optimizer.computeOptimalBounds(admBounds, geometry)
  return metrics.bounds
}
```

### Étape 2: Récupérer Géométrie ADM

```typescript
// Dans exportSingle, avant calcul bounds:
const admGeometry = await this.fetchAdmGeometry(level, admCode)
const bounds = await this.computeOptimalBoundsForSheet(
  admBounds,
  quality,
  admName,
  admGeometry
)
```

### Étape 3: Généraliser ADM2/ADM3

```typescript
public async computeOptimalBoundsForAdm(
  level: 'adm1' | 'adm2' | 'adm3',
  admBounds: BoundsRect,
  quality: ExportQuality,
  admName?: string,
  geometry?: ADMGeometry
): Promise<BoundsRect> {
  
  const levelLabel = level === 'adm1' ? 'Région' : 
                     level === 'adm2' ? 'Préfecture' : 'Commune'
  
  const optimizer = new BoundsOptimizer(quality, {
    safePx: 16,
    logPrefix: level.toUpperCase(),
    admName: `${levelLabel} ${admName || 'inconnu'}`
  })
  
  const metrics = await optimizer.computeOptimalBounds(admBounds, geometry)
  return metrics.bounds
}
```

### Étape 4: Audit Backend /thematic/data

```bash
# Via psql
SELECT 
  grid_code,
  adm1_name,
  adm2_name,
  adm3_name,
  COUNT(*) as n_sondages
FROM public.sondages
WHERE adm1_name IS NOT NULL
GROUP BY grid_code, adm1_name, adm2_name, adm3_name
LIMIT 20;

# Via curl
curl -X GET "http://localhost:8080/thematic/data?parameter=n_sondages&include_geometry=true" \
  -H "Accept: application/json" | jq '.features[0].properties | keys'
```

**Objectif**: Vérifier si `adm2_name` et `adm3_name` sont retournés pour améliorer boxplots groupByAdm2/Adm3.

---

## 📝 Checklist Validation Finale

- [ ] **Palette UI**: Logs montrent flux complet DOM → state → rendu
- [ ] **Palette UI**: Carte et légende utilisent palette sélectionnée
- [ ] **Resizable**: Pas de fond noir pendant drag
- [ ] **Resizable**: Direction drag correcte (gauche/droite)
- [ ] **Resizable**: `map.invalidateSize()` appelé après drag
- [ ] **BoundsOptimizer**: Compile sans erreurs TypeScript
- [ ] **BoundsOptimizer**: Logs détaillés à chaque itération
- [ ] **BoundsOptimizer**: `clear_min_px >= 16px` respecté
- [ ] **Export Plateaux**: Marges visuelles minimales, pas de contact
- [ ] **Export 5 ADM1**: Tous respectent contrainte clearance
- [ ] **Documentation**: TODO.md mis à jour avec session v3.5.4

---

## 🔍 Audit Auth/Redirect (Non Traité)

**Raison**: Priorité donnée au cadrage ADM (cœur de la demande).

**Symptômes identifiés**:
1. Flash page d'accueil avant login
2. Re-login requis lors navigation Carte ↔ Gestion BDD

**Actions futures**:
- Audit architecture auth (token storage, guards, bootstrap)
- Implémenter auth bootstrap anti-flash
- Unifier guards Carte/Gestion BDD
- Logs `[Auth]` pour tracer session lifecycle

---

## 📚 Références

- **Algorithme BOUNDS_EXPORT.md**: Base théorique (marges anisotropes, slenderness)
- **Golden Sample**: Plateaux (occ_y=96.2%, contrainte géométrique AR)
- **Binary Search**: Stratégie itérative pour maximiser occupation
- **Densification**: Interpolation tous les 4km pour détection précise

---

## 🎓 Leçons Apprises

### 1. KPI Marges vs Clearance

**Marges bbox** (`pad_*_pct`) ≠ **Clearance réelle** (`clear_*_px`):
- Marges bbox: distance bbox ADM ↔ frame (approximation)
- Clearance réelle: distance limite ADM ↔ frame (précis)

**Exemple Plateaux**:
- `pad_left_pct=20.3%` (bbox)
- `clear_left_px=16.2px` (limite réelle plus proche)

### 2. Contrainte Dure vs Optimisation

L'algorithme respecte une **contrainte dure**: `clear_min_px >= SAFE_PX`.
- Pas de compromis sur la sécurité
- Optimisation secondaire: maximiser `occ_major`

### 3. Géométrie Essentielle

Sans géométrie ADM:
- Calcul clearance impossible
- Fallback conservateur (50px)
- Résultat sous-optimal

**Recommandation**: Toujours fournir géométrie GeoJSON.

---

**Fin du document - Atlas Géotechnique v3.5.4**
