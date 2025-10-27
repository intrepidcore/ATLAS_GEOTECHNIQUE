# 🔍 GUIDE DIAGNOSTIC UI - Rien ne s'affiche

**Problème** : L'UI est vide, aucune donnée n'apparaît sur la carte.

Suis les étapes **dans l'ordre** et note à quelle étape ça bloque.

---

## 📋 ÉTAPE 0 : Sanity Check - Import Réel Fait ?

**⚠️ IMPORTANT** : `--dry-run` ne fait que valider, il n'écrit RIEN en base !

### Test Rapide

```powershell
# Si PostgreSQL local Windows
psql -U atlas -d atlas_clean -c "SELECT count(*) FROM sondages; SELECT count(*) FROM echantillons;"

# OU avec Docker
docker compose exec db psql -U atlas -d atlas_clean -c "SELECT count(*) FROM sondages; SELECT count(*) FROM echantillons;"
```

**Résultat Attendu** :
```
 count 
-------
     3
(1 row)

 count 
-------
     9
(1 row)
```

### ❌ Si Résultat = 0

**Cause** : Import jamais fait ou fait en `--dry-run`

**Solution** : Refaire l'import SANS `--dry-run`

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes
```

---

## 📋 ÉTAPE 1 : Créer/Brancher les Vues (ADM3 Spread)

### Exécuter le Script SQL

```powershell
# Si PostgreSQL local
psql -U atlas -d atlas_clean -f fix_ui_vues_complete.sql

# OU avec Docker
docker compose exec db psql -U atlas -d atlas_clean -f fix_ui_vues_complete.sql
```

**Ce script crée** (idempotent) :
1. `v_sondages_spread` - Sites sans GPS dupliqués sur mailles ADM3
2. `v_mailles_geotech` - Agrégation par maille (réel + spread)
3. `mailles_geotechnique_stats` - Vue de compatibilité
4. `mv_mailles_geotech` - Vue matérialisée (performance)

### Refresh la Vue Matérialisée

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;
```

**OU via psql** :
```powershell
psql -U atlas -d atlas_clean -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;"
```

---

## 📋 ÉTAPE 2 : Test API Côté Serveur (Smoke Tests)

### Test 1 : Santé API

```bash
curl -s http://localhost:8080/api/health
```

**Attendu** : `{"status":"ok"}` ou similaire

### Test 2 : Endpoint Stats (Adapter au Vôtre)

Essayez ces 3 variantes :

```bash
# Variante 1
curl -s "http://localhost:8080/api/mailles/stats?limit=3"

# Variante 2
curl -s "http://localhost:8080/api/tiles/mailles_stats?limit=3"

# Variante 3
curl -s "http://localhost:8080/api/mailles_geotechnique_stats?limit=3"
```

### Interprétation Résultats

| Résultat | Signification | Action |
|----------|---------------|--------|
| **200 + JSON avec données** | ✅ OK | Passer à l'étape 3 |
| **200 + JSON vide `[]`** | ⚠️ Vues vides | Retour étape 0/1 |
| **404** | ❌ Endpoint inexistant | Vérifier route API |
| **500** | ❌ Erreur serveur | Voir logs (étape 2.1) |

### 2.1 : Voir les Logs API (Si Erreur 500)

```bash
# Avec Docker
docker compose logs -f api-geo

# OU si service nommé différemment
docker compose logs -f backend
docker compose logs -f api
```

**Cherchez** :
- Erreurs SQL (table inexistante, colonne manquante)
- Erreurs de connexion DB
- Stack traces

---

## 📋 ÉTAPE 3 : Rebuild/Restart Correct

**⚠️ IMPORTANT** : `restart` ne recharge PAS les variables d'environnement !

### Rebuild Complet

```bash
# Recréer l'API (recharge env + recompilation)
docker compose up -d --build api-geo

# Si service frontend distinct
docker compose up -d --build web

# OU tout reconstruire
docker compose up -d --build
```

### Vérifier Variables d'Environnement

```bash
# Vérifier que l'API lit bien atlas_clean
docker compose exec api-geo printenv | findstr DATABASE_URL

# OU
docker compose exec api-geo env | grep DATABASE
```

**Attendu** : `DATABASE_URL=postgresql://atlas:atlas@db:5432/atlas_clean`

---

## 📋 ÉTAPE 4 : Forcer l'UI à Recharger (Cache)

### Dans le Navigateur

1. **Hard Refresh** : `Ctrl + Shift + R` (Windows/Linux) ou `Cmd + Shift + R` (Mac)

2. **DevTools** :
   - Ouvrir DevTools (`F12`)
   - Onglet **Network**
   - Cocher **Disable cache**
   - Refresh (`F5`)

3. **Cache Busting** :
   - Si la map charge avec `?v=...`, incrémenter la version
   - Exemple : `?v=2` → `?v=3`

---

## 📋 ÉTAPE 5 : Check Scénario Spread (Voir Couleur Immédiate)

Si vos sondages n'ont **pas de GPS**, utilisez le spread ADM3 :

### 5.1 : Simuler Sondage Sans GPS

```sql
-- Retirer le GPS d'un sondage (pour tester spread)
UPDATE sondages SET geom = NULL WHERE code = 'KEVE-S1';
```

### 5.2 : S'assurer que ADM3 est Rempli

```sql
-- Remplir adm3_code automatiquement (si localite correspond)
UPDATE sondages s
SET adm3_code = a.code
FROM adm3 a
WHERE s.code = 'KEVE-S1' 
  AND s.adm3_code IS NULL
  AND unaccent(lower(s.localite)) = unaccent(lower(a.name));
```

### 5.3 : Refresh Vue

```sql
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;
```

**Résultat** : Les mailles de l'ADM3 devraient "prendre la couleur" (via spread)

**Note** : Quand vous remettrez un point GPS (`geom`), la diffusion disparaît automatiquement.

---

## 📋 ÉTAPE 6 : Checklist "Rien n'Apparaît" (Top 6 Causes)

| # | Cause | Fix |
|---|-------|-----|
| 1 | **Import jamais fait** (dry-run seulement) | Refaire SANS `--dry-run` |
| 2 | **Vues non créées / non rafraîchies** | Étape 1 + `REFRESH MATERIALIZED VIEW` |
| 3 | **Endpoint API pointe ancienne vue** | Créer `mailles_geotechnique_stats` (compat) |
| 4 | **API non reconstruite** | `docker compose up -d --build api-geo` |
| 5 | **Cache navigateur** | Hard refresh / `?v=...` |
| 6 | **CORS/erreurs runtime** | `docker compose logs -f api-geo` + console navigateur |

---

## 📋 ÉTAPE 7 : Round-Trip Propre (Validation Bout en Bout)

### Script Complet

```powershell
# 1. Import réel
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes

# 2. Créer vues (si pas déjà fait)
psql -U atlas -d atlas_clean -f fix_ui_vues_complete.sql

# 3. Refresh vues
psql -U atlas -d atlas_clean -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;"

# 4. Rebuild API + web
docker compose up -d --build api-geo web

# 5. Tests API
curl -s "http://localhost:8080/api/mailles/stats?limit=3" | jq .

# 6. Ouvrir la carte et hard refresh (Ctrl+Shift+R)
```

---

## 📊 LOG À FOURNIR (Si Ça Bloque)

Si rien ne fonctionne après toutes les étapes, fournissez ces 4 éléments :

### 1. Sortie ÉTAPE 0 (Compteurs)

```powershell
psql -U atlas -d atlas_clean -c "SELECT count(*) FROM sondages; SELECT count(*) FROM echantillons;"
```

### 2. Sortie REFRESH (Erreur ?)

```powershell
psql -U atlas -d atlas_clean -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;"
```

### 3. Logs API (10-15 lignes autour erreur)

```bash
docker compose logs -f api-geo | tail -20
```

### 4. URL Exacte Appelée par la Carte

- Ouvrir DevTools (`F12`)
- Onglet **Network**
- Filtrer par `XHR` ou `Fetch`
- Copier l'URL complète (ex: `http://localhost:8080/api/mailles/stats?bbox=...`)

---

## 🎯 Diagnostic Automatique

### Script SQL Complet

```powershell
psql -U atlas -d atlas_clean -f diagnostic_ui_complet.sql
```

Ce script affiche :
- ✅ Compteurs de tables
- ✅ État géométrie/ADM3
- ✅ Vues existantes
- ✅ Exemple de données
- ✅ Résumé diagnostic avec actions recommandées

---

## 🔧 Commandes Rapides (Copier-Coller)

### Tout Recréer de Zéro

```powershell
# 1. Purge (ATTENTION : supprime tout)
psql -U atlas -d atlas_clean -c "TRUNCATE sondages, echantillons, essais_atterberg, essais_vbs, raw_lab_agt, raw_lab_ags, raw_lab_atterberg RESTART IDENTITY CASCADE;"

# 2. Import
python scripts\02_import_excel.py --file atlas_import_example.xlsx --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" --import-raw yes

# 3. Vues
psql -U atlas -d atlas_clean -f fix_ui_vues_complete.sql
psql -U atlas -d atlas_clean -c "REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech;"

# 4. Rebuild
docker compose up -d --build

# 5. Test
curl -s "http://localhost:8080/api/mailles/stats?limit=3"
```

---

## 📞 Support

Si le problème persiste :

1. Exécuter `diagnostic_ui_complet.sql`
2. Fournir les 4 éléments de log (section "LOG À FOURNIR")
3. Vérifier console navigateur (F12 → Console)
4. Vérifier que l'API pointe sur `mv_mailles_geotech` ou `mailles_geotechnique_stats`

---

**Version** : 1.5.3  
**Date** : 2025-10-26  
**Status** : Guide Diagnostic Complet
