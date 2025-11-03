# 🔧 SOLUTION - UI Vide (Aucune Donnée Affichée)

**Problème** : L'interface carte est vide, aucune donnée n'apparaît.

---

## 🎯 Diagnostic Rapide

### Étape 1 : PostgreSQL est-il démarré ?

```powershell
# Vérifier si PostgreSQL tourne
Get-Service -Name postgresql*

# OU
netstat -an | findstr :5432
```

**Si PostgreSQL n'est PAS démarré** :
```powershell
# Démarrer PostgreSQL (selon votre installation)
Start-Service postgresql-x64-14  # Adapter le nom du service

# OU si installé manuellement
pg_ctl -D "C:\Program Files\PostgreSQL\14\data" start
```

### Étape 2 : Test de Connexion

```powershell
python test_db_connection.py
```

**Résultat attendu** :
```
✓ Connexion réussie !
  PostgreSQL: PostgreSQL 14.x
  
Compteurs de tables:
  - sondages: X lignes
  - echantillons: X lignes
  ...
```

**Si échec** : PostgreSQL n'est pas accessible → Voir section "Démarrer PostgreSQL"

---

## 🚀 Solution Complète (Ordre d'Exécution)

### 1️⃣ Démarrer PostgreSQL

#### Windows (Service)
```powershell
# Lister les services PostgreSQL
Get-Service -Name postgresql*

# Démarrer le service
Start-Service postgresql-x64-14  # Adapter le nom
```

#### Windows (Manuel)
```powershell
# Trouver le répertoire data
$pgData = "C:\Program Files\PostgreSQL\14\data"  # Adapter

# Démarrer
pg_ctl -D $pgData start
```

#### Vérifier que ça tourne
```powershell
# Test port 5432
netstat -an | findstr :5432
# Devrait afficher: TCP    0.0.0.0:5432    0.0.0.0:0    LISTENING
```

---

### 2️⃣ Créer les Tables RAW (Si Pas Déjà Fait)

```powershell
# Trouver psql.exe
$psqlPath = "C:\Program Files\PostgreSQL\14\bin\psql.exe"  # Adapter

# Appliquer la migration
& $psqlPath -U atlas -d atlas_clean -f db\migrations\2024-10-raw-archive.sql

# OU si psql est dans le PATH
psql -U atlas -d atlas_clean -f db\migrations\2024-10-raw-archive.sql
```

**Mot de passe** : `atlas` (quand demandé)

---

### 3️⃣ Importer les Données

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes
```

**Résultat attendu** :
```
✅ Import terminé avec succès!

Table                     Lues     Créées   MAJ      Erreurs  Taux
----------------------------------------------------------------------
sondages                  3        3        0        0        100.0%
echantillons              9        9        0        0        100.0%
essais_atterberg          9        9        0        0        100.0%
essais_vbs                9        9        0        0        100.0%
raw_lab_agt               220      220      0        0        100.0%
raw_lab_ags               80       80       0        0        100.0%
raw_lab_atterberg         48       48       0        0        100.0%
----------------------------------------------------------------------
TOTAL                              378      0
```

---

### 4️⃣ Créer les Vues Spread (Pour Affichage UI)

```powershell
# Avec psql
psql -U atlas -d atlas_clean -f create_spread_views.sql

# OU avec Python (si psql pas accessible)
python -c "
import psycopg
conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean')
with open('create_spread_views.sql', 'r', encoding='utf-8') as f:
    conn.execute(f.read())
conn.commit()
print('✓ Vues créées')
"
```

---

### 5️⃣ Vérifier les Données en Base

```powershell
python test_db_connection.py
```

**Ou manuellement** :
```sql
-- Compteurs
SELECT COUNT(*) FROM sondages;           -- Devrait être 3
SELECT COUNT(*) FROM echantillons;        -- Devrait être 9
SELECT COUNT(*) FROM raw_lab_agt;         -- Devrait être 220

-- Vérifier geom et ADM3
SELECT code, (geom IS NOT NULL) AS has_geom, adm3_code 
FROM sondages;

-- Vérifier vue spread
SELECT COUNT(*) FROM mv_mailles_geotech;  -- Devrait être > 0
```

---

### 6️⃣ Vérifier l'API Backend

#### Test Santé API
```powershell
curl http://localhost:8080/api/health
```

#### Test Endpoint Mailles
```powershell
curl "http://localhost:8080/api/mailles/stats?limit=5"
```

**Si l'API ne répond pas** :
- Démarrer le serveur backend
- Vérifier les logs du serveur
- Vérifier que l'API pointe sur `mv_mailles_geotech`

---

### 7️⃣ Vider le Cache Frontend

```
1. Dans le navigateur : Ctrl + Shift + R (hard refresh)
2. Vider le cache complet du navigateur
3. Si bundler (Vite/Webpack) : npm run build
```

---

## 🔍 Checklist de Diagnostic

- [ ] PostgreSQL est démarré (port 5432 écoute)
- [ ] Test connexion réussi (`test_db_connection.py`)
- [ ] Tables RAW créées (migration appliquée)
- [ ] Données importées (378 lignes)
- [ ] Vues spread créées (`mv_mailles_geotech` existe)
- [ ] Vue matérialisée a des données (COUNT > 0)
- [ ] API backend démarrée
- [ ] API répond sur `/api/health`
- [ ] Endpoint `/api/mailles/stats` retourne des données
- [ ] Cache navigateur vidé

---

## 🐛 Problèmes Courants

### Problème 1 : "KeyboardInterrupt" lors de l'import

**Cause** : PostgreSQL ne répond pas  
**Solution** : Démarrer PostgreSQL (voir étape 1)

### Problème 2 : "relation 'raw_lab_agt' does not exist"

**Cause** : Migration SQL pas appliquée  
**Solution** : Exécuter `db\migrations\2024-10-raw-archive.sql`

### Problème 3 : "relation 'mv_mailles_geotech' does not exist"

**Cause** : Vues spread pas créées  
**Solution** : Exécuter `create_spread_views.sql`

### Problème 4 : Données importées mais UI vide

**Causes possibles** :
1. **Tous les `geom` sont NULL** → Activer spread (étape 4)
2. **API ne pointe pas sur `mv_mailles_geotech`** → Modifier l'endpoint API
3. **Vue matérialisée pas rafraîchie** → `REFRESH MATERIALIZED VIEW mv_mailles_geotech`
4. **Cache frontend** → Ctrl+Shift+R

### Problème 5 : psql.exe introuvable

**Solution** : Ajouter PostgreSQL au PATH ou utiliser le chemin complet :
```powershell
$env:PATH += ";C:\Program Files\PostgreSQL\14\bin"
```

---

## 📝 Script Complet Automatisé

```powershell
# 1. Test PostgreSQL
Write-Host "Test PostgreSQL..." -ForegroundColor Yellow
python test_db_connection.py

if ($LASTEXITCODE -ne 0) {
    Write-Host "PostgreSQL non accessible - Démarrer le service" -ForegroundColor Red
    Start-Service postgresql-x64-14  # Adapter
    Start-Sleep -Seconds 3
}

# 2. Import données
Write-Host "`nImport données..." -ForegroundColor Yellow
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes

# 3. Créer vues spread (si pas déjà fait)
Write-Host "`nCréation vues spread..." -ForegroundColor Yellow
psql -U atlas -d atlas_clean -f create_spread_views.sql

# 4. Refresh vues
Write-Host "`nRefresh vues..." -ForegroundColor Yellow
psql -U atlas -d atlas_clean -f refresh_views.sql

# 5. Vérifications
Write-Host "`nVérifications..." -ForegroundColor Yellow
python test_db_connection.py

Write-Host "`n✓ Terminé ! Rafraîchir le navigateur (Ctrl+Shift+R)" -ForegroundColor Green
```

---

## 🎯 Résultat Attendu

Après avoir suivi ces étapes :

1. **Base de données** : 378 lignes importées
2. **Vues spread** : `mv_mailles_geotech` avec données
3. **API** : Répond avec GeoJSON
4. **UI** : Carte affiche les mailles colorées selon les données

---

## 📞 Support

Si le problème persiste après avoir suivi toutes les étapes :

1. Vérifier les logs du serveur backend
2. Vérifier la console navigateur (F12)
3. Tester l'API manuellement avec curl
4. Vérifier que l'endpoint API lit bien `mv_mailles_geotech`

---

**Version** : 1.5.3  
**Date** : 2025-10-24
