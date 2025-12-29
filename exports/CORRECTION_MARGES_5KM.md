# CORRECTION MARGES 5KM - RÈGLE MÉTIER IMPLÉMENTÉE

**Date**: 27/12/2025 15:00 UTC
**Objectif**: Resserrer Maritime et Plateaux avec règle métier ~5 km de marge minimale

---

## ✅ MODIFICATIONS IMPLÉMENTÉES

### Fichier Modifié
**`ui/src/export/bounds-optimizer.ts`**

### 1. Constantes (lignes 91-94)
```typescript
const MIN_CLEARANCE_KM = 5.0  // Objectif: ~5 km de marge
const MAX_CLEARANCE_KM = 8.0  // Tolérance haute
const KM_PER_DEG_LAT = 111.0  // Approximation sphérique
```

### 2. Interface BoundsMetrics Enrichie (lignes 54-60)
```typescript
margin_top_km: number
margin_bottom_km: number
margin_left_km: number
margin_right_km: number
margin_min_km: number
margin_max_km: number
```

### 3. Calcul Marges en km (lignes 266-277)
```typescript
const latMid = (bounds.north + bounds.south) / 2
const kmPerDegLon = KM_PER_DEG_LAT * Math.cos(latMid * Math.PI / 180)

const margin_top_km = (bounds.north - admBounds.north) * KM_PER_DEG_LAT
const margin_bottom_km = (admBounds.south - bounds.south) * KM_PER_DEG_LAT
const margin_left_km = (admBounds.west - bounds.west) * kmPerDegLon
const margin_right_km = (bounds.east - admBounds.east) * kmPerDegLon

const margin_min_km = Math.min(margin_top_km, margin_bottom_km, margin_left_km, margin_right_km)
const margin_max_km = Math.max(margin_top_km, margin_bottom_km, margin_left_km, margin_right_km)
```

### 4. Règle Métier Binary Search (lignes 179-193)
```typescript
const clearancePxOk = metrics.clear_min_px >= this.options.safePx
const marginKmOk = metrics.margin_min_km >= MIN_CLEARANCE_KM

if (clearancePxOk && marginKmOk) {
  bestMetrics = metrics
  shrinkMin = shrinkMid
  console.log(`✅ accept (px=${metrics.clear_min_px.toFixed(1)} km=${metrics.margin_min_km.toFixed(1)})`)
} else {
  shrinkMax = shrinkMid
  const reason = !clearancePxOk ? 
    `px too small (${metrics.clear_min_px.toFixed(1)} < ${this.options.safePx})` : 
    `km too small (${metrics.margin_min_km.toFixed(1)} < ${MIN_CLEARANCE_KM})`
  console.log(`❌ reject (${reason})`)
}
```

### 5. Logs Enrichis (lignes 481-490)
```typescript
console.log(`📍 MARGES EN KM (NOUVEAU):`)
console.log(`  margin_top=${metrics.margin_top_km.toFixed(1)}km margin_bottom=${metrics.margin_bottom_km.toFixed(1)}km`)
console.log(`  margin_left=${metrics.margin_left_km.toFixed(1)}km margin_right=${metrics.margin_right_km.toFixed(1)}km`)
console.log(`  margin_min=${metrics.margin_min_km.toFixed(1)}km margin_max=${metrics.margin_max_km.toFixed(1)}km`)
```

---

## 🎯 RÉSULTATS ATTENDUS

### Avant
```
Maritime: shrink=0.999 pad_max=17.7%  ← Trop d'océan
Plateaux: shrink=0.999 pad_max=16.8%  ← Trop de Togo
```

### Après
```
Maritime: shrink=0.92 margin_min=5.1km pad_max=6-8%
Plateaux: shrink=0.94 margin_min=5.2km pad_max=5-7%
```

---

## 🚀 COMMANDES TEST (POWERSHELL)

### 1. Compiler TypeScript
```powershell
cd C:\PROJET_ATLAS_MASTER\atlas\ui
npm run build
```

### 2. Migration SQL
```powershell
cd C:\PROJET_ATLAS_MASTER\atlas
psql -U postgres -d atlas_geotechnique -f db/migrations/007_enrichir_mailles_adm2_prefectures.sql
```

### 3. Déclencher Post-Traitement
```powershell
curl -X POST http://localhost:5173/export/post-process/adm1
```

### 4. Vérifier Vue Stats
```powershell
psql -U postgres -d atlas_geotechnique -c "SELECT COUNT(*) FROM atlas.v_pref_kpi;"
```

### 5. Vérifier Fichiers Stats
```powershell
dir exports\stats\
```

---

## 📊 CARTES À RE-EXPORTER (PRIORITÉ)

**Ordre de test**:
1. **Plateaux** - IP moyen (pire cas, pad_max=16.8%)
2. **Maritime** - IP moyen (2ème pire, pad_max=17.7%)
3. **Savanes** - IP moyen (vérifier stabilité)
4. **Kara** - IP moyen (vérifier stabilité)
5. **Centrale** - IP moyen (référence OK)

**Vérifier dans logs**:
- `margin_min_km ≈ 5-6 km` pour toutes les zones
- `pad_max < 10%` pour Maritime/Plateaux
- Logs itérations montrent rejets `km too small`

---

**IMPLÉMENTATION TERMINÉE - PRÊT POUR TEST**
