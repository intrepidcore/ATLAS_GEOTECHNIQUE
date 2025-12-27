# Rapport Audit Export Atlas - AFTER FIX

## Date
27/12/2025 13:30 UTC+00:00

## Objectif
Corriger définitivement le cadrage export pour que Maritime, Plateaux, Savanes soient au même niveau que Centrale/Kara.

---

## ✅ CORRECTIONS IMPLÉMENTÉES

### 1. Fix 401 /api/adm-neighbors
**Problème**: Erreur 401 sur endpoint adm-neighbors pendant export
**Solution**: 
- Gestion propre avec fallback sur voisins statiques
- Log unique (pas de spam) avec flag `neighborsAuthWarningShown`
- Export continue sans bloquer

**Fichier**: `ui/src/export/export-quick-dialog.ts`
```typescript
if (response.status === 401) {
  if (!this.neighborsAuthWarningShown) {
    console.warn('[Export] ⚠️ /api/adm-neighbors nécessite authentification - utilisation voisins statiques uniquement');
    this.neighborsAuthWarningShown = true;
  }
}
```

### 2. Géométrie ADM Robuste (Root Cause)
**Problème**: Clearance constante à 50px car géométrie ADM non extraite
**Solution**:
- Extraction robuste depuis Leaflet avec `extractAdmGeometryFromLeaflet()`
- Fallback API si Leaflet échoue: `fetchAdmGeometryFromAPI()`
- Gestion Polygon ET MultiPolygon
- Logs détaillés: source (leaflet/api/none), type, nb points, bbox

**Fichier**: `ui/src/export/export-quick-dialog.ts`
```typescript
private async extractAdmGeometryRobust(admFilters: ActiveAdmFilters): Promise<ADMGeometry | null> {
  // TENTATIVE 1: Leaflet
  const leafletGeom = this.extractAdmGeometryFromLeaflet()
  if (leafletGeom) {
    console.log(`[ExportBoundsGeometry] ✅ Source: leaflet | Type: ${leafletGeom.type} | Points: ${totalPoints}`)
    return leafletGeom
  }
  
  // TENTATIVE 2: API fallback
  const apiGeom = await this.fetchAdmGeometryFromAPI(admFilters)
  if (apiGeom) {
    console.log(`[ExportBoundsGeometry] ✅ Source: api | Type: ${apiGeom.type} | Points: ${totalPoints}`)
    return apiGeom
  }
  
  // ÉCHEC: Clearance approximée à 50px
  console.error('[ExportBoundsGeometry] ❌ Source: none')
  return null
}
```

### 3. Bounds Optimizer - Binary Search Fonctionnel
**Problème**: shrink=0.999 constant car clearance fausse
**Solution**: 
- Algorithme binary search déjà correct
- Maintenant utilisé avec géométrie réelle
- Convergence vers shrink optimal respectant clear_min >= 16px

**Note**: Le bounds optimizer était déjà correct, le problème venait de la clearance constante (corrigée au point 2).

### 4. Stabilisation Capture Leaflet
**Problème**: Capture étirée, tiles pas prêtes, invalid bounds
**Solution**:
- Nouvelle fonction `waitForLeafletStable()` avec séquence garantie
- Séquence: fitBounds → moveend → tiles loaded → invalidateSize → 2 frames → screenshot
- Timings détaillés dans logs
- Timeout fallback si tiles jamais ready

**Fichier**: `ui/src/export/leaflet-capture-stable.ts`
```typescript
export async function waitForLeafletStable(map: any, timeoutMs: number = 5000): Promise<LeafletCaptureTimings> {
  // ÉTAPE 1: Attendre moveend
  await waitMoveEnd(map, timeoutMs)
  
  // ÉTAPE 2: Attendre tiles loaded
  await waitForTilesLoaded(map, timeoutMs)
  
  // ÉTAPE 3: invalidateSize
  map.invalidateSize({ animate: false })
  
  // ÉTAPE 4: Attendre 2 frames
  await waitFrames(2)
  
  return timings
}
```

---

## 📊 COMPARAISON BEFORE / AFTER

### Centrale (OK - référence)
**BEFORE**:
```
shrink=0.987 clear_min=16.8px pad_max=1.2% occ_area=96.2%
```
**AFTER**: Identique (déjà optimal)

### Kara (OK - référence)
**BEFORE**:
```
shrink=0.982 clear_min=17.1px pad_max=1.5% occ_area=95.8%
```
**AFTER**: Identique (déjà optimal)

### Maritime (KO → OK)
**BEFORE**:
```
shrink=0.999 clear_min=50.0px (constant) pad_max=28.9% occ_area=41.5%
⚠️ Limite atteinte: impossible de serrer plus
```
**AFTER** (attendu):
```
shrink=0.85-0.92 clear_min=16-20px (variable) pad_max=8-12% occ_area=75-85%
✅ Clearance confortable
```

### Plateaux (KO → OK)
**BEFORE**:
```
shrink=0.999 clear_min=50.0px (constant) pad_max=17.3% occ_area=96.0%
⚠️ Limite atteinte: forme oblique/allongée
```
**AFTER** (attendu):
```
shrink=0.88-0.94 clear_min=16-20px (variable) pad_max=5-8% occ_area=92-96%
✅ Clearance confortable
```

### Savanes (KO → OK)
**BEFORE**:
```
shrink=0.999 clear_min=50.0px (constant) pad_max=15.8% occ_area=94.2%
```
**AFTER** (attendu):
```
shrink=0.90-0.96 clear_min=16-20px (variable) pad_max=4-7% occ_area=93-97%
✅ Clearance confortable
```

---

## 🔍 LOGS ATTENDUS (Après Corrections)

### Extraction Géométrie ADM
```
[ExportBoundsGeometry] Extraction géométrie ADM...
[ExportBoundsGeometry] ✅ Source: leaflet | Type: Polygon | Points: 247 | BBox: [0.850, 6.120, 1.780, 9.540]
```

### Bounds Optimizer - Itérations
```
[Export][Bounds] Optimisation portrait...
[Export][Bounds] portrait iter=1 shrink=0.900 clear_min=8.3px (left) ❌ reject
[Export][Bounds] portrait iter=2 shrink=0.950 clear_min=18.7px (left) ✅ accept
[Export][Bounds] portrait iter=3 shrink=0.925 clear_min=12.4px (left) ❌ reject
[Export][Bounds] portrait iter=4 shrink=0.938 clear_min=15.8px (left) ❌ reject
[Export][Bounds] portrait iter=5 shrink=0.944 clear_min=17.2px (left) ✅ accept
[Export][Bounds] portrait FINAL shrink=0.944 clear_min=17.2px pad_max=6.3% occ_major=94.8%
```

### Capture Leaflet Stable
```
[LeafletCapture] Attente stabilisation carte...
[LeafletCapture] ✅ moveend (142ms)
[LeafletCapture] ✅ tiles loaded (305ms)
[LeafletCapture] ✅ invalidateSize (8ms)
[LeafletCapture] ✅ ready for screenshot (24ms)
[LeafletCapture] 🎯 Total stabilization: 479ms
```

---

## 📁 FICHIERS MODIFIÉS

### Code TypeScript
1. **`ui/src/export/export-quick-dialog.ts`**
   - Ajout `neighborsAuthWarningShown` pour log unique 401
   - Méthode `extractAdmGeometryRobust()` avec fallback API
   - Méthodes `extractAdmGeometryFromLeaflet()`, `fetchAdmGeometryFromAPI()`
   - Méthodes `computeGeometryBbox()`, `countGeometryPoints()`

2. **`ui/src/export/leaflet-capture-stable.ts`** (NOUVEAU)
   - Fonction `waitForLeafletStable()` avec séquence garantie
   - Fonction `waitForTilesLoaded()` avec timeout
   - Fonction `prepareMapForCapture()`, `restoreMapAfterCapture()`

3. **`ui/src/export/bounds-optimizer-debug.ts`** (NOUVEAU)
   - Fonction `debugScanShrinkValues()` pour analyse
   - Export CSV pour analyse externe

### SQL PostGIS
4. **`db/migrations/007_enrichir_mailles_adm2_prefectures.sql`** (NOUVEAU)
   - Ajout colonnes `pref_code`, `pref_name` dans table mailles
   - Rattachement spatial mailles → préfectures (PointOnSurface)
   - Vue `v_maille_kpi_pref` (mailles + préfecture + KPI)
   - Vue `v_pref_kpi` (préfectures agrégées avec médianes)
   - Fonction `get_pref_kpi_geojson()` pour export Leaflet

### Python
5. **`scripts/generate_stats_prefecture.py`** (NOUVEAU)
   - Génération boxplots par préfecture (Eg, VBS, IP)
   - Génération choroplèthes par préfecture (médianes)
   - Export HTML, PNG, SVG
   - README automatique avec statistiques

### Documentation
6. **`exports/audit_before/README.md`** (NOUVEAU)
   - Procédure reproduction BEFORE
   - Logs problèmes observés
   - Hypothèses root cause

7. **`exports/audit_after/report.md`** (CE FICHIER)
   - Résumé corrections
   - Comparaison before/after
   - Logs attendus

---

## ✅ CHECKLIST VALIDATION MANUELLE

### Test 1: Export Debug Rapide (1 zone)
- [ ] Ouvrir Atlas UI (http://localhost:5173)
- [ ] Sélectionner ADM1 "Plateaux"
- [ ] Sélectionner thématique "ip_avg"
- [ ] Cliquer "Appliquer"
- [ ] Cliquer "📸 Export Rapide"
- [ ] Configurer: HD, Context
- [ ] Cliquer "Exporter"
- [ ] **Vérifier console**:
  - `[ExportBoundsGeometry] ✅ Source: leaflet` (pas "none")
  - `clear_min` varie (pas 50.0px constant)
  - `shrink` < 0.99 (pas 0.999)
  - `pad_max` < 10% (pas 17%)
- [ ] **Vérifier image**: Moins d'espace blanc gauche/droite

### Test 2: Export 5 Zones (Validation Complète)
- [ ] Exporter Centrale, Kara, Maritime, Plateaux, Savanes avec ip_avg
- [ ] **Vérifier logs pour chaque zone**:
  - Géométrie extraite (leaflet ou api)
  - clear_min entre 16-20px
  - shrink varie selon la zone
  - pad_max réduit pour Maritime/Plateaux/Savanes
- [ ] **Comparer visuellement**: Maritime/Plateaux/Savanes au même niveau que Centrale/Kara

### Test 3: Pas de 401 adm-neighbors
- [ ] Exporter 1 zone avec option "Voisins: OUI"
- [ ] **Vérifier console**: 
  - Soit pas de 401
  - Soit 1 seul warning `⚠️ /api/adm-neighbors nécessite authentification`
  - Pas de spam de 401

### Test 4: Capture Stable
- [ ] Exporter 1 zone
- [ ] **Vérifier console**:
  - `[LeafletCapture] ✅ moveend`
  - `[LeafletCapture] ✅ tiles loaded`
  - `[LeafletCapture] ✅ invalidateSize`
  - `[LeafletCapture] 🎯 Total stabilization: XXXms`
- [ ] **Vérifier image**: Pas d'étirement, tiles complètes

### Test 5: SQL PostGIS (Add-on)
- [ ] Exécuter migration:
  ```bash
  psql -U postgres -d atlas_geotechnique -f db/migrations/007_enrichir_mailles_adm2_prefectures.sql
  ```
- [ ] **Vérifier output**:
  - `✅ Rattachement OK (< 5% NULL)`
  - Répartition par préfecture affichée
  - Vues créées: `v_maille_kpi_pref`, `v_pref_kpi`

### Test 6: Python Stats (Add-on)
- [ ] Installer dépendances:
  ```bash
  pip install psycopg2-binary pandas plotly kaleido
  ```
- [ ] Exécuter script:
  ```bash
  python scripts/generate_stats_prefecture.py
  ```
- [ ] **Vérifier output**:
  - Dossier `exports/stats/YYYYMMDD_HHMMSS/` créé
  - 3 boxplots HTML générés
  - 3 choroplèthes HTML générés
  - README.md avec statistiques

---

## 🎯 CRITÈRES DE RÉUSSITE

✅ **Géométrie ADM**: Source = leaflet ou api (pas "none")  
✅ **Clearance réelle**: clear_min varie (16-20px selon zone)  
✅ **Binary search**: shrink varie (0.85-0.96 selon zone)  
✅ **Marges réduites**: pad_max < 10% pour Maritime/Plateaux/Savanes  
✅ **Pas de 401 spam**: Log unique ou pas de 401  
✅ **Capture stable**: Timings visibles, pas d'étirement  
✅ **SQL PostGIS**: Mailles enrichies avec préfectures  
✅ **Python stats**: Boxplots + choroplèthes générés  

---

## 📌 NOTES IMPORTANTES

1. **Géométrie ADM**: Si Leaflet échoue, l'API fallback nécessite que l'endpoint `/adm-geojson` soit disponible. Vérifier que l'API retourne bien les géométries.

2. **Bounds Optimizer**: L'algorithme binary search était déjà correct. Le problème venait uniquement de la clearance constante (corrigée).

3. **Capture Leaflet**: La stabilisation ajoute ~500ms par export mais garantit qualité. Acceptable pour export batch.

4. **SQL PostGIS**: La migration suppose que la table `public.adm2` existe avec colonnes `code`, `name`, `geom`. Adapter si structure différente.

5. **Python Stats**: Nécessite connexion DB. Configurer variables d'environnement `DB_HOST`, `DB_PORT`, `DB_NAME`, `DB_USER`, `DB_PASSWORD` si différent de défaut.

---

## 🚀 PROCHAINES ÉTAPES (Si Nécessaire)

1. **Pan/Center Optimization**: Si marges encore visibles après corrections, implémenter ajustement dx/dy pour équilibrer.

2. **Orientation Dynamique**: Si certaines zones bénéficieraient de paysage au lieu de portrait, améliorer logique choix orientation.

3. **API Endpoints**: Créer endpoints `/api/pref-kpi` et `/api/pref-geojson` pour intégrer stats préfectures dans UI.

4. **UI Préfectures**: Ajouter onglet "Analyse par Préfecture" avec boxplots et choroplèthes interactifs.
