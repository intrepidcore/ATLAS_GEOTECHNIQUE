# INTÉGRATION COMPLÈTE - LOGS CONSOLE + SQL/PYTHON AUTOMATIQUE

**Date**: 27/12/2025 14:00 UTC
**Objectif**: Garantir capture logs console Atlas + automatiser SQL/Python lors exports ADM1

---

## ✅ PARTIE 1 - CAPTURE LOGS CONSOLE ATLAS

### Vérification Effectuée

**Tous les logs sont déjà capturés par console.log()** - Aucune modification nécessaire.

Les logs suivants sont visibles dans la console DevTools (F12):

```typescript
// PHASE 2 - Logs container et zoom
console.log(`[PHASE2][${admName}] Container AVANT: ${container.clientWidth}x${container.clientHeight}px`);
console.log(`[PHASE2][${admName}] Map size AVANT: ${map.getSize().x}x${map.getSize().y}px`);
console.log(`[PHASE2][${admName}] Map zoom AVANT: ${map.getZoom()}`);
console.log(`[PHASE2][${admName}] Container APRÈS: ${container.clientWidth}x${container.clientHeight}px`);
console.log(`[PHASE2][${admName}] Map zoom APRÈS fitBounds: ${map.getZoom()}`);

// PHASE 3 - Logs pan bias
console.log(`[PHASE3][${admName}] Padding: top=${pad_top_pct.toFixed(1)}% bottom=${pad_bottom_pct.toFixed(1)}%`);
console.log(`[PHASE3][${admName}] Applying panBy: [0, ${-deltaY}]px`);

// Logs géométrie
console.log('[ExportBoundsGeometry] Extraction géométrie ADM...');
console.log(`[ExportBoundsGeometry] ✅ Source: leaflet | Type: ${leafletGeom.type} | Points: ${totalPoints}`);

// Logs tiles
console.log(`[TILES][${admName}] ${tilesReady ? '✅ Loaded' : '⚠️ Timeout'} après ${tilesDuration.toFixed(0)}ms`);
```

### Comment Voir les Logs

1. Ouvrir Atlas UI: http://localhost:5173
2. Ouvrir Console DevTools: **F12** → onglet **Console**
3. Lancer un export (Export Rapide ou Export Atlas)
4. Observer les logs en temps réel avec préfixes:
   - `[PHASE2]` - Container size et zoom
   - `[PHASE3]` - Pan bias Maritime
   - `[ExportBoundsGeometry]` - Extraction géométrie
   - `[TILES]` - Chargement tuiles
   - `[Export][Bounds]` - Bounds optimizer

### Filtrage Console

Pour filtrer uniquement les logs export:
```
PHASE2 OR PHASE3 OR ExportBoundsGeometry OR TILES
```

---

## ✅ PARTIE 2 - AUTOMATISATION SQL/PYTHON LORS EXPORT ADM1

### Fichiers Créés

#### 1. Script Post-Traitement Python
**Fichier**: `api/routes/export_post_process.py` (NOUVEAU)

**Contenu**:
- Exécute migration SQL: `007_enrichir_mailles_adm2_prefectures.sql`
- Exécute script Python: `generate_stats_prefecture.py`
- Logs détaillés avec émojis
- Timeout 5min SQL + 10min Python
- Retourne success/failure

**Usage Standalone**:
```bash
cd C:\PROJET_ATLAS_MASTER\atlas
python api/routes/export_post_process.py
```

#### 2. Endpoint API Backend
**Fichier**: `api/routes/export_routes.py` (NOUVEAU)

**Endpoints**:
- `POST /export/post-process/adm1` - Lance post-traitement
- `GET /export/post-process/status` - Vérifie disponibilité

**Réponse Success**:
```json
{
  "success": true,
  "sql_migration": true,
  "python_stats": true,
  "message": "Post-traitement terminé",
  "details": {
    "stdout": "...",
    "stderr": ""
  }
}
```

#### 3. Intégration Frontend
**Fichier**: `ui/src/export/export-atlas-dialog.ts` (MODIFIÉ)

**Ligne 1920-1946**: Appel automatique après export ADM1

```typescript
// POST-TRAITEMENT: Si export ADM1, lancer SQL + Python automatiquement
if (config?.levels?.adm1) {
  console.log('[Atlas] 🔄 Lancement post-traitement ADM1 (SQL + Python)...');
  this.progressModal?.log('info', 'POST-PROCESS', 'Lancement enrichissement préfectures...');
  
  try {
    const token = tokenStorage.getAccessToken();
    const response = await fetch(`${API_BASE_URL}/export/post-process/adm1`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { 'Authorization': `Bearer ${token}` } : {})
      }
    });
    
    if (response.ok) {
      const result = await response.json();
      console.log('[Atlas] ✅ Post-traitement terminé:', result);
      this.progressModal?.log('success', 'POST-PROCESS', 'Enrichissement préfectures terminé');
    } else {
      console.warn('[Atlas] ⚠️ Post-traitement échoué:', response.status);
      this.progressModal?.log('warning', 'POST-PROCESS', `Erreur ${response.status}`);
    }
  } catch (e) {
    console.warn('[Atlas] ⚠️ Post-traitement non disponible:', e);
    this.progressModal?.log('warning', 'POST-PROCESS', 'Service non disponible');
  }
}
```

---

## 🚀 WORKFLOW COMPLET

### 1. Export Atlas ADM1

```
Utilisateur → Export Atlas → Cocher ADM1 → Lancer Export
    ↓
Export 5 zones × N thématiques
    ↓
Génération ZIP
    ↓
AUTOMATIQUE: Appel POST /export/post-process/adm1
    ↓
Backend exécute export_post_process.py
    ↓
    ├─ ÉTAPE 1: Migration SQL (psql)
    │   └─ Enrichit mailles avec pref_code, pref_name
    │   └─ Crée vues v_maille_kpi_pref, v_pref_kpi
    │
    └─ ÉTAPE 2: Stats Python
        └─ Génère boxplots par préfecture (Eg, VBS, IP)
        └─ Génère choroplèthes par préfecture
        └─ Export HTML + PNG + SVG
        └─ Dossier: exports/stats/YYYYMMDD_HHMMSS/
    ↓
Logs dans console + modal progression
    ↓
FIN
```

### 2. Logs Console Attendus

```
[Atlas] Export Atlas démarré...
[PHASE2][Centrale] Container AVANT: 1200x850px
[PHASE2][Centrale] Map zoom AVANT: 7
[PHASE2][Centrale] Container APRÈS: 1200x1697px
[PHASE2][Centrale] Map zoom APRÈS fitBounds: 9
[ExportBoundsGeometry] ✅ Source: leaflet | Type: Polygon | Points: 189
[TILES][Centrale] ✅ Loaded après 305ms
...
[Atlas] ZIP généré, taille: 45.23 Mo
[Atlas] 🔄 Lancement post-traitement ADM1 (SQL + Python)...
[Atlas] ✅ Post-traitement terminé: {success: true, sql_migration: true, python_stats: true}
```

### 3. Logs Backend Attendus

```
[INFO] POST-TRAITEMENT ADM1 - Début
═══════════════════════════════════════════════════════════════════
ÉTAPE 1: Migration SQL - Enrichissement mailles → préfectures
═══════════════════════════════════════════════════════════════════
[INFO] Exécution: psql -h localhost -d atlas_geotechnique -f 007_enrichir_mailles_adm2_prefectures.sql
[INFO] ✅ Migration SQL terminée avec succès

═══════════════════════════════════════════════════════════════════
ÉTAPE 2: Python Stats - Boxplots + Choroplèthes par préfecture
═══════════════════════════════════════════════════════════════════
[INFO] Exécution: python generate_stats_prefecture.py
[INFO] ✅ Stats Python générées avec succès

█████████████████████████████████████████████████████████████████████
✅ POST-TRAITEMENT TERMINÉ AVEC SUCCÈS
█████████████████████████████████████████████████████████████████████
```

---

## 📋 CONFIGURATION BACKEND

### Prérequis

1. **PostgreSQL Client** (psql)
   ```bash
   # Vérifier installation
   psql --version
   ```

2. **Python + Dépendances**
   ```bash
   pip install psycopg2-binary pandas plotly kaleido
   ```

3. **Variables d'environnement** (optionnel)
   ```bash
   DB_HOST=localhost
   DB_PORT=5432
   DB_NAME=atlas_geotechnique
   DB_USER=postgres
   DB_PASSWORD=postgres
   ```

### Intégration API Backend

**Dans votre fichier principal API** (ex: `api/main.py`):

```python
from fastapi import FastAPI
from api.routes.export_routes import router as export_router

app = FastAPI()

# Inclure les routes export
app.include_router(export_router)
```

---

## ✅ TESTS VALIDATION

### Test 1: Logs Console Visibles

1. Ouvrir UI + Console DevTools (F12)
2. Export Rapide → Plateaux → vbs_avg
3. **Vérifier console**:
   - `[PHASE2][Plateaux] Container AVANT: ...`
   - `[PHASE2][Plateaux] Map zoom APRÈS fitBounds: 9`
   - `[ExportBoundsGeometry] ✅ Source: leaflet`
   - `[TILES][Plateaux] ✅ Loaded après XXXms`

**Résultat attendu**: Tous les logs visibles en temps réel

### Test 2: Post-Traitement Automatique

1. Export Atlas → Cocher ADM1 uniquement → 1 thématique (vbs_avg)
2. Lancer export
3. Attendre fin export + ZIP téléchargé
4. **Vérifier console**:
   - `[Atlas] 🔄 Lancement post-traitement ADM1 (SQL + Python)...`
   - `[Atlas] ✅ Post-traitement terminé: {success: true, ...}`
5. **Vérifier modal progression**:
   - Ligne "POST-PROCESS: Lancement enrichissement préfectures..."
   - Ligne "POST-PROCESS: Enrichissement préfectures terminé" (vert)

**Résultat attendu**: Post-traitement exécuté automatiquement

### Test 3: Vérifier Résultats SQL/Python

1. Après export ADM1, vérifier base de données:
   ```sql
   SELECT COUNT(*) FROM atlas.mailles WHERE pref_name IS NOT NULL;
   SELECT * FROM atlas.v_pref_kpi LIMIT 5;
   ```

2. Vérifier dossier exports:
   ```bash
   dir exports\stats\
   # Doit contenir dossier YYYYMMDD_HHMMSS avec boxplots/ et choropleths/
   ```

**Résultat attendu**: Mailles enrichies + stats générées

### Test 4: Fallback Gracieux

1. Arrêter backend API
2. Export Atlas ADM1
3. **Vérifier console**:
   - `[Atlas] ⚠️ Post-traitement non disponible: ...`
   - Export continue normalement (pas de blocage)

**Résultat attendu**: Export fonctionne même si post-traitement échoue

---

## 📁 FICHIERS MODIFIÉS/CRÉÉS (RÉCAPITULATIF)

### Créés
1. `api/routes/export_post_process.py` - Script post-traitement
2. `api/routes/export_routes.py` - Endpoints API
3. `exports/INTEGRATION_COMPLETE_LOGS_SQL_PYTHON.md` - Ce document

### Modifiés
4. `ui/src/export/export-atlas-dialog.ts` - Appel automatique post-traitement (lignes 1920-1946)

### Déjà Existants (Sessions Précédentes)
5. `db/migrations/007_enrichir_mailles_adm2_prefectures.sql` - Migration SQL
6. `scripts/generate_stats_prefecture.py` - Stats Python
7. `ui/src/export/export-quick-dialog.ts` - Logs PHASE2/PHASE3 (lignes 619-701, 2621-2647)

---

## 🎯 RÉSUMÉ FINAL

### ✅ Logs Console Atlas
- **Statut**: DÉJÀ FONCTIONNEL
- **Preuve**: Tous les `console.log()` présents dans le code
- **Action**: Ouvrir DevTools (F12) pour voir les logs

### ✅ Automatisation SQL/Python
- **Statut**: IMPLÉMENTÉ
- **Déclencheur**: Export Atlas avec ADM1 coché
- **Exécution**: Automatique après génération ZIP
- **Fallback**: Gracieux si service indisponible

### ✅ Intégration Complète
- **Frontend**: Appel POST /export/post-process/adm1
- **Backend**: Endpoint API + script Python
- **Logs**: Console + modal progression
- **Résultats**: Mailles enrichies + stats préfectures

---

## 🚀 COMMANDES RAPIDES

```bash
# 1. Tester post-traitement standalone
cd C:\PROJET_ATLAS_MASTER\atlas
python api/routes/export_post_process.py

# 2. Vérifier status API
curl http://localhost:8000/export/post-process/status

# 3. Déclencher manuellement
curl -X POST http://localhost:8000/export/post-process/adm1

# 4. Vérifier résultats SQL
psql -U postgres -d atlas_geotechnique -c "SELECT COUNT(*) FROM atlas.v_pref_kpi;"

# 5. Vérifier résultats Python
dir exports\stats\
```

---

**MISSION COMPLÈTE - LOGS + SQL/PYTHON AUTOMATISÉS**
