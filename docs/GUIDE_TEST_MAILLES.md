# 🗺️ Guide de Test - Trouver des Mailles avec Données

## 🎯 Problème

Quand vous cliquez sur une maille dans l'UI et que le panneau gauche semble "vide", c'est probablement parce que **cette maille n'a pas d'essais réels** (spread-only ou vide).

## ✅ Solution : Trouver des Mailles avec Données

### Méthode 1 : Requête SQL Rapide

```sql
-- Top 10 mailles avec le plus d'essais
SELECT 
  m.code,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT e.id) AS n_essais
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) > 0
ORDER BY n_essais DESC
LIMIT 10;
```

**Exécution** :
```powershell
docker compose exec -T db psql -U atlas -d atlas -c "
SELECT m.code, COUNT(DISTINCT e.id) AS n_essais
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) > 0
ORDER BY n_essais DESC
LIMIT 10;
"
```

### Méthode 2 : Recherche par Nom de Site

Sites connus avec données :
- **APEHEME**
- **DZOGBECOPE**
- **TEKPO**
- **DAVIE** (spread-only - pour tester l'alerte)

```sql
SELECT 
  m.code,
  s.meta->>'code' AS site_code,
  COUNT(DISTINCT e.id) AS n_essais
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
WHERE s.meta->>'code' ILIKE '%APEHEME%'
   OR s.meta->>'code' ILIKE '%DZOGBECOPE%'
   OR s.meta->>'code' ILIKE '%TEKPO%'
GROUP BY m.code, s.meta->>'code'
ORDER BY n_essais DESC;
```

### Méthode 3 : Fichier SQL Complet

Utilisez le fichier `sql/find_mailles_with_data.sql` qui contient 6 requêtes :

1. Top 10 mailles avec le plus d'essais
2. Mailles avec essais réels (pas de spread)
3. Mailles avec essais complets (Atterberg + VBS + Granulo)
4. Mailles spread-only (pour tester l'alerte)
5. Recherche par nom de site
6. Statistiques par maille (pour debug)

```powershell
docker cp sql/find_mailles_with_data.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -f /tmp/find_mailles_with_data.sql
```

---

## 🧪 Test de l'UI

### 1. Trouver un Code de Maille

```powershell
# Exécuter la requête
docker compose exec -T db psql -U atlas -d atlas -t -c "
SELECT m.code
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY m.code
HAVING COUNT(DISTINCT e.id) > 5
ORDER BY COUNT(DISTINCT e.id) DESC
LIMIT 1;
"
```

**Exemple de résultat** : `TG-0703-0236-01`

### 2. Tester dans l'UI

#### Option A : Cliquer sur la Carte
1. Ouvrir http://localhost:3000
2. Zoomer sur la zone avec des mailles rouges (données)
3. Cliquer sur une maille rouge
4. Le panneau gauche doit afficher les 4 onglets avec données

#### Option B : Appel API Direct
```powershell
# Tester l'endpoint
Invoke-RestMethod http://localhost:8000/cells/TG-0703-0236-01/complete | ConvertTo-Json -Depth 3
```

**Vérifications** :
- `kpi.n_essais` > 0
- `samples[]` non vide
- `samples[0].atterberg` présent
- `samples[0].classif.uscs.class` et `.reason` présents

### 3. Vérifier les Onglets

#### Onglet "Vue d'ensemble"
- ✅ Graphiques Atterberg, VBS, Granulo
- ✅ Histogramme profondeur

#### Onglet "Essais détaillés"
- ✅ Accordéons par échantillon
- ✅ Badges IP (Faible/Moyen/Fort)
- ✅ Badges VBS (Faible/Moyen/Élevé)
- ✅ Classifications avec raison

#### Onglet "Sondages"
- ✅ Liste des sondages
- ✅ Badges GPS/Spread
- ✅ Nombre échantillons/essais

#### Onglet "Classification"
- ✅ Répartition USCS/AASHTO
- ✅ Statistiques par classe

---

## 🔍 Debugging

### Maille Semble Vide

**Symptôme** : Panneau gauche affiche "Aucun essai disponible"

**Causes possibles** :
1. Maille spread-only (pct_spread = 100%)
2. Maille sans données
3. Erreur de géométrie (sondages hors maille)

**Diagnostic** :
```sql
-- Statistiques de la maille
SELECT 
  m.code,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'real') AS n_real,
  COUNT(DISTINCT s.id) FILTER (WHERE s.location_mode = 'spread') AS n_spread,
  COUNT(DISTINCT e.id) AS n_essais
FROM mailles m
LEFT JOIN sondages s ON ST_Contains(m.geom, s.geom)
LEFT JOIN essais_geotechniques e ON e.sondage_id = s.id
WHERE m.code = 'TG-0496-0212-01'  -- Remplacer par votre code
GROUP BY m.code;
```

**Résultat attendu** :
- `n_essais > 0` → Maille avec données
- `n_essais = 0` et `n_spread > 0` → Maille spread-only
- `n_essais = 0` et `n_sondages = 0` → Maille vide

### Empty State Spread

**Symptôme** : Message "Ces valeurs proviennent d'une diffusion ADM3"

**C'est normal !** Cette maille n'a pas de sondages réels, seulement des valeurs diffusées.

**Pour voir les données** :
1. Aller dans l'onglet "Sondages"
2. Section "Sondages sources" affiche les sondages d'origine
3. Cliquer sur une autre maille avec `pct_spread < 100%`

### API Retourne Ancien Format

**Symptôme** : `classif.uscs` est un string au lieu de `{class, reason}`

**Solution** :
```powershell
# Vérifier que les nouvelles fonctions sont appliquées
docker compose exec -T db psql -U atlas -d atlas -c "
SELECT fn_classify_uscs(42, 20, 65, NULL, NULL, NULL);
"
```

**Résultat attendu** : `{"class": "CL", "reason": "..."}`

**Si ancien format** :
```powershell
# Réappliquer les fonctions
docker cp sql/fn_classify_uscs_v2.sql atlas-db:/tmp/
docker compose exec -T db psql -U atlas -d atlas -c "
DROP VIEW IF EXISTS v_samples_complete CASCADE;
DROP FUNCTION IF EXISTS fn_classify_uscs(numeric,numeric,numeric,numeric,numeric,numeric) CASCADE;
"
docker compose exec -T db psql -U atlas -d atlas -f /tmp/fn_classify_uscs_v2.sql
docker compose exec -T db psql -U atlas -d atlas -f /tmp/v_samples_complete_v2.sql

# Redémarrer API
docker compose restart api-geo
```

---

## 📊 Exemples de Résultats

### Maille avec Données Complètes

```json
{
  "kpi": {
    "n_sondages": 2,
    "n_echantillons": 5,
    "n_essais": 15,
    "pct_spread": 0.0
  },
  "samples": [
    {
      "depth_m": 1.0,
      "atterberg": {"wl": 42, "wp": 22, "ip": 20},
      "vbs": {"vbs": 1.8},
      "granulo": {
        "indices": {"d10": 0.09, "cu": 6.1, "cc": 1.07}
      },
      "classif": {
        "uscs": {"class": "CL", "reason": "Fines >50%, ..."},
        "aashto": {"class": "A-7-5", "reason": "Fines >35%, ..."}
      }
    }
  ]
}
```

### Maille Spread-Only

```json
{
  "kpi": {
    "n_sondages": 0,
    "n_echantillons": 0,
    "n_essais": 0,
    "pct_spread": 100.0
  },
  "samples": [],
  "source_surveys": [
    {
      "code_site": "APEHEME",
      "adm3_code": "TG030805"
    }
  ]
}
```

---

## 🎯 Checklist de Test

### Avant de Tester
- [ ] SQL appliqué (`fn_classify_uscs_v2`, `fn_classify_aashto_v2`, `v_samples_complete_v2`)
- [ ] UI buildée (`npm run build`)
- [ ] API redémarrée (`docker compose restart api-geo`)
- [ ] Cache navigateur vidé (Ctrl+Shift+R)

### Tests à Effectuer
- [ ] Maille avec données → Onglets remplis
- [ ] Maille spread-only → Empty state avec explication
- [ ] Maille vide → Empty state simple
- [ ] Badges IP/VBS affichés avec couleurs
- [ ] Classifications avec raison visible
- [ ] Sondages avec badges GPS/Spread
- [ ] Version badge = v2.0.1

### Résultats Attendus
- [ ] Onglet "Essais" : Accordéons par profondeur
- [ ] Badges intelligents : Vert/Orange/Rouge
- [ ] Classifications : `{class, reason}` affiché
- [ ] Empty states : Messages contextuels
- [ ] Performance : < 200ms pour /complete

---

## 📞 Support

### Requêtes Utiles

```powershell
# Nombre total de mailles avec données
docker compose exec -T db psql -U atlas -d atlas -c "
SELECT COUNT(DISTINCT m.code)
FROM mailles m
JOIN sondages s ON ST_Contains(m.geom, s.geom)
JOIN essais_geotechniques e ON e.sondage_id = s.id;
"

# Répartition Real vs Spread
docker compose exec -T db psql -U atlas -d atlas -c "
SELECT 
  s.location_mode,
  COUNT(DISTINCT s.id) AS n_sondages,
  COUNT(DISTINCT e.id) AS n_essais
FROM sondages s
LEFT JOIN essais_geotechniques e ON e.sondage_id = s.id
GROUP BY s.location_mode;
"
```

### Logs

```powershell
# API
docker compose logs api-geo --tail 50 -f

# UI (si service séparé)
docker compose logs ui --tail 50 -f

# DB
docker compose logs db --tail 50 -f
```

---

**Version** : v2.0.1  
**Date** : 27 octobre 2025  
**Statut** : ✅ Guide complet pour tests
