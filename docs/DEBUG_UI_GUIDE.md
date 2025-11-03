# 🔍 Guide Debug UI - Pourquoi les Données n'Apparaissent Pas

**Problème** : Les données importées ne s'affichent pas dans la carte de l'interface utilisateur.

---

## 🎯 Top 5 Causes & Solutions

### 1️⃣ Tous les `geom` sont NULL et pas de "spread"
**Symptôme** : Aucune donnée visible sur la carte  
**Cause** : Les sondages n'ont pas de coordonnées GPS et la stratégie ADM3 spread n'est pas activée  
**Fix** :
```powershell
psql -U atlas -d atlas_clean -f create_spread_views.sql
```

### 2️⃣ Endpoint carte branché sur l'ancienne vue
**Symptôme** : Import réussi mais carte vide  
**Cause** : L'API pointe encore sur une vue obsolète  
**Fix** : Repointer l'endpoint sur `mv_mailles_geotech` (voir section C)

### 3️⃣ Vue matérialisée non rafraîchie
**Symptôme** : Nouvelles données invisibles après import  
**Cause** : La vue matérialisée n'a pas été rafraîchie  
**Fix** :
```powershell
psql -U atlas -d atlas_clean -f refresh_views.sql
```

### 4️⃣ Cache Frontend
**Symptôme** : Données visibles en SQL mais pas dans le navigateur  
**Cause** : Cache navigateur ou bundler  
**Fix** : Hard refresh (Ctrl+Shift+R) ou rebuild frontend

### 5️⃣ Champs de style non alignés
**Symptôme** : Carte affichée mais sans couleurs/données  
**Cause** : La couche lit des champs différents de ceux en SQL  
**Fix** : Vérifier que la couche lit `w_avg`, `ip_avg`, `vbs_avg`

---

## 🔍 A) Diagnostic Complet (5 Checks)

### Exécuter le Diagnostic

```powershell
psql -U atlas -d atlas_clean -f diagnostic_ui.sql
```

### Checks Manuels Rapides

```sql
-- 1) Données importées ?
SELECT count(*) FROM sondages;            -- attendu > 0
SELECT count(*) FROM echantillons;        -- attendu > 0
SELECT count(*) FROM essais_atterberg;    -- attendu >= 0
SELECT count(*) FROM essais_vbs;          -- attendu >= 0

-- 2) Les sondages ont-ils un geom ?
SELECT code, (geom IS NOT NULL) AS has_geom, adm3_code
FROM sondages
ORDER BY code;

-- 3) ADM3 renseigné ?
SELECT code, adm3_code FROM sondages WHERE adm3_code IS NULL;

-- 4) RAW (optionnel)
SELECT count(*) FROM raw_lab_agt;
SELECT count(*) FROM raw_lab_ags;
SELECT count(*) FROM raw_lab_atterberg;

-- 5) Mailles présentes
SELECT count(*) FROM mailles;  -- ~29407
```

### Interprétation

| Résultat | Signification | Action |
|----------|---------------|--------|
| `has_geom = false` partout | Aucun point GPS | Activer spread (section B) |
| `adm3_code IS NULL` | Impossible de spread | Ajouter ADM3 dans Excel |
| `count(*) = 0` | Pas de données | Vérifier l'import |

---

## 🌐 B) Stratégie ADM3 "Spread" (Phase 1)

### Concept

Pour les sites **sans coordonnées GPS** mais avec un **code ADM3**, on "diffuse" leurs données sur **toutes les mailles** de cette commune.

**Avantage** : Les données deviennent visibles immédiatement  
**Comportement** : Dès qu'un `geom` est renseigné, le sondage sort automatiquement du spread

### B.1 Créer les Vues Spread

```powershell
psql -U atlas -d atlas_clean -f create_spread_views.sql
```

**Ce script crée** :
1. `v_sondages_spread` - Sites sans geom dupliqués sur leurs mailles ADM3
2. `v_mailles_geotech` - Agrégation par maille (réel + spread)
3. `mv_mailles_geotech` - Version matérialisée (performance)
4. `mailles_geotechnique_stats` - Vue de compatibilité

### B.2 Vérifier la Création

```sql
-- Compteurs
SELECT 'v_sondages_spread' AS vue, COUNT(*) FROM v_sondages_spread
UNION ALL
SELECT 'mv_mailles_geotech', COUNT(*) FROM mv_mailles_geotech;

-- Exemple de données
SELECT maille_id, w_avg, ip_avg, vbs_avg, n, has_spread
FROM mv_mailles_geotech
LIMIT 5;
```

### B.3 Rafraîchir Après Chaque Import

```powershell
# Après chaque import de données
psql -U atlas -d atlas_clean -f refresh_views.sql
```

Ou manuellement :
```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;
```

---

## 🔌 C) Brancher l'API sur les Nouvelles Vues

### C.1 Identifier l'Endpoint Carte

Exemples d'endpoints possibles :
- `/api/tiles/mailles_stats`
- `/api/mailles/stats`
- `/api/v1/geotechnique/mailles`

### C.2 Modifier la Requête SQL

**Avant** (ancienne vue) :
```sql
SELECT m.geom, s.*
FROM mailles m
LEFT JOIN mailles_geotechnique_stats s ON s.maille_id = m.id;
```

**Après** (nouvelle vue) :
```sql
SELECT m.geom, s.*
FROM mailles m
LEFT JOIN mv_mailles_geotech s ON s.maille_id = m.id;
```

### C.3 Exemple selon Stack

#### Node.js / Express

```javascript
// routes/mailles.js
router.get('/api/mailles/stats', async (req, res) => {
  const result = await pool.query(`
    SELECT 
      m.id,
      ST_AsGeoJSON(m.geom)::json AS geometry,
      s.w_avg,
      s.ip_avg,
      s.vbs_avg,
      s.n AS nb_echantillons,
      s.has_spread
    FROM mailles m
    LEFT JOIN mv_mailles_geotech s ON s.maille_id = m.id
    WHERE s.maille_id IS NOT NULL
  `);
  
  res.json({
    type: 'FeatureCollection',
    features: result.rows.map(row => ({
      type: 'Feature',
      geometry: row.geometry,
      properties: {
        w_avg: row.w_avg,
        ip_avg: row.ip_avg,
        vbs_avg: row.vbs_avg,
        nb_echantillons: row.nb_echantillons,
        has_spread: row.has_spread
      }
    }))
  });
});
```

#### Python / FastAPI

```python
# routes/mailles.py
@router.get("/api/mailles/stats")
async def get_mailles_stats(db: Session = Depends(get_db)):
    query = """
        SELECT 
            m.id,
            ST_AsGeoJSON(m.geom)::json AS geometry,
            s.w_avg,
            s.ip_avg,
            s.vbs_avg,
            s.n AS nb_echantillons,
            s.has_spread
        FROM mailles m
        LEFT JOIN mv_mailles_geotech s ON s.maille_id = m.id
        WHERE s.maille_id IS NOT NULL
    """
    
    result = db.execute(text(query))
    
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "geometry": row.geometry,
                "properties": {
                    "w_avg": row.w_avg,
                    "ip_avg": row.ip_avg,
                    "vbs_avg": row.vbs_avg,
                    "nb_echantillons": row.nb_echantillons,
                    "has_spread": row.has_spread
                }
            }
            for row in result
        ]
    }
```

### C.4 Vue de Compatibilité (Alternative)

Si vous ne voulez pas modifier l'API, créez une synonymie :

```sql
DROP VIEW IF EXISTS mailles_geotechnique_stats CASCADE;
CREATE VIEW mailles_geotechnique_stats AS
SELECT * FROM v_mailles_geotech;
```

L'API continuera de fonctionner sans modification.

---

## 🎨 D) Frontend - Configuration Couche

### D.1 Vérifier les Champs

La configuration de la couche doit lire les bons champs :

```javascript
// config/layers.js
{
  id: 'mailles-geotech',
  source: {
    type: 'geojson',
    data: '/api/mailles/stats'
  },
  paint: {
    'fill-color': [
      'interpolate',
      ['linear'],
      ['get', 'w_avg'],  // ⚠️ Doit correspondre au champ SQL
      0, '#ffffcc',
      10, '#a1dab4',
      20, '#41b6c4',
      30, '#225ea8'
    ],
    'fill-opacity': 0.7
  }
}
```

### D.2 Vider le Cache

```bash
# Hard refresh navigateur
Ctrl + Shift + R  (Windows/Linux)
Cmd + Shift + R   (Mac)

# Rebuild frontend (si bundler)
npm run build
# ou
yarn build
```

---

## 🧪 E) Tests API Rapides

### E.1 Santé de l'API

```bash
curl -s http://localhost:8080/api/health | jq .
```

### E.2 Stats par Maille (JSON)

```bash
curl -s "http://localhost:8080/api/mailles/stats?limit=5" | jq .
```

### E.3 Endpoint Debug (si exposé)

```bash
curl -s http://localhost:8080/api/v1/debug/spread-summary | jq .
```

---

## 🔄 F) Round-Trip Complet (Checklist)

### 1. Import Données

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes
```

### 2. Refresh Vues

```powershell
psql -U atlas -d atlas_clean -f refresh_views.sql
```

### 3. Vérifier Cartes

- [ ] Les mailles des ADM3 concernés "prennent la couleur"
- [ ] Si `geom=NULL`, la diffusion ADM3 remplit toutes les mailles
- [ ] Si `geom` renseigné, seule la maille du point garde la valeur

### 4. Tests API

```bash
# Compteur de mailles avec stats
curl -s "http://localhost:8080/api/mailles/stats" | jq '.features | length'

# Exemple de propriétés
curl -s "http://localhost:8080/api/mailles/stats?limit=1" | jq '.features[0].properties'
```

---

## 🧹 G) Purge (Reset pour Tests)

### Purge Tables RAW Uniquement

```powershell
psql -U atlas -d atlas_clean -f purge_raw_tables.sql
```

### Purge TOUT (RAW + Canoniques) ⚠️

```sql
TRUNCATE raw_lab_agt, raw_lab_ags, raw_lab_atterberg RESTART IDENTITY;
TRUNCATE essais_vbs, essais_atterberg, granulo_points, echantillons, sondages RESTART IDENTITY CASCADE;
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;
```

---

## 📊 H) Workflow Complet Recommandé

```mermaid
graph TD
    A[Import Excel] --> B[Refresh Vues]
    B --> C{Données Visibles?}
    C -->|Non| D[Diagnostic SQL]
    D --> E{geom NULL?}
    E -->|Oui| F[Créer Vues Spread]
    E -->|Non| G[Vérifier API]
    F --> H[Refresh Vues]
    G --> H
    H --> I[Vider Cache FE]
    I --> J[Tester Carte]
    C -->|Oui| J
```

---

## 🎯 Checklist Finale

- [ ] Diagnostic SQL exécuté (`diagnostic_ui.sql`)
- [ ] Vues spread créées (`create_spread_views.sql`)
- [ ] Vue matérialisée rafraîchie (`refresh_views.sql`)
- [ ] API pointe sur `mv_mailles_geotech`
- [ ] Champs frontend alignés (`w_avg`, `ip_avg`, `vbs_avg`)
- [ ] Cache navigateur vidé (Ctrl+Shift+R)
- [ ] Tests API réussis (curl)
- [ ] Carte affiche les données ✅

---

## 📞 Support

### Scripts Disponibles

| Script | Usage |
|--------|-------|
| `diagnostic_ui.sql` | Diagnostic complet (5 checks) |
| `create_spread_views.sql` | Créer vues spread ADM3 |
| `refresh_views.sql` | Rafraîchir vues matérialisées |
| `purge_raw_tables.sql` | Purge tables RAW |

### Documentation

- **Quick Start** : `QUICKSTART_v1.5.3.md`
- **Guide détaillé** : `docs/RAW_IMPORT_README.md`
- **Production Ready** : `PRODUCTION_READY_v1.5.3.md`

---

**Version** : 1.5.3  
**Status** : Debug Guide Complet  
**Dernière MAJ** : 2025-10-24
