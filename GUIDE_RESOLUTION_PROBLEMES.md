# 🔧 Guide de résolution des problèmes Atlas v2.6.0

**Date:** 6 janvier 2026  
**Auteur:** Développeur Senior Rust/PostGIS/Docker

---

## 📋 Table des matières

1. [Problème 1 : Erreurs 500 sur les couches contextuelles](#problème-1--erreurs-500-sur-les-couches-contextuelles)
2. [Problème 2 : Sondages et échantillons vides](#problème-2--sondages-et-échantillons-vides)
3. [Problème 3 : Automatisation quotidienne check_28km](#problème-3--automatisation-quotidienne-check_28km)
4. [Plan de tests de validation](#plan-de-tests-de-validation)

---

## Problème 1 : Erreurs 500 sur les couches contextuelles

### 🔍 Diagnostic

**Symptômes :**
```
GET /layers/geologie?bbox=... → 500 Internal Server Error
GET /layers/pedologie?bbox=... → 500 Internal Server Error
GET /layers/risque-gonflement?bbox=... → 500 Internal Server Error
```

**Logs backend :**
```
relation "atlas.unites_geologiques" does not exist (code: 42P01)
relation "atlas.unites_pedologiques" does not exist (code: 42P01)
relation "atlas.risque_gonflement" does not exist (code: 42P01)
```

**Cause racine :** Les tables de couches contextuelles n'existent pas dans la base `atlas_clean`.

### ✅ Solution : Créer les tables manquantes

#### Étape 1 : Exécuter la migration 090

```powershell
# Se placer dans le répertoire atlas
cd C:\PROJET_ATLAS_MASTER\atlas

# Exécuter la migration
Get-Content db/migrations/090_create_context_layers.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

**Résultat attendu :**
```
BEGIN
CREATE TABLE
CREATE INDEX
COMMENT
...
Migration 090 terminée
Tables créées:
  - atlas.unites_geologiques: 0 lignes
  - atlas.unites_pedologiques: 0 lignes
  - atlas.risque_gonflement: 0 lignes

ATTENTION: Les tables sont vides.
Vous devez importer les données depuis les shapefiles/GPKG.
COMMIT
```

#### Étape 2 : Vérifier que les tables existent

```powershell
docker exec atlas-db psql -U atlas -d atlas_clean -c "\dt atlas.unites_*"
docker exec atlas-db psql -U atlas -d atlas_clean -c "\dt atlas.risque_*"
```

**Résultat attendu :**
```
 atlas | unites_geologiques  | table | atlas
 atlas | unites_pedologiques | table | atlas
 atlas | risque_gonflement   | table | atlas
```

#### Étape 3 : Importer les données géographiques

**Option A : Si vous avez des shapefiles**

```powershell
# Exemple pour la géologie (adapter les chemins)
docker exec atlas-db shp2pgsql -s 25231 -I -D /data/geologie.shp atlas.unites_geologiques | docker exec -i atlas-db psql -U atlas -d atlas_clean

# Pour la pédologie
docker exec atlas-db shp2pgsql -s 25231 -I -D /data/pedologie.shp atlas.unites_pedologiques | docker exec -i atlas-db psql -U atlas -d atlas_clean

# Pour le risque de gonflement
docker exec atlas-db shp2pgsql -s 25231 -I -D /data/risque_gonflement.shp atlas.risque_gonflement | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

**Option B : Si vous avez des fichiers GPKG**

```powershell
# Utiliser ogr2ogr (depuis le conteneur ou en local)
docker exec atlas-db ogr2ogr -f PostgreSQL PG:"host=localhost user=atlas dbname=atlas_clean password=atlas" /data/geologie.gpkg -nln atlas.unites_geologiques -lco GEOMETRY_NAME=geom -lco FID=id -t_srs EPSG:25231
```

**Option C : Créer des données de test**

Si vous n'avez pas encore les données réelles, créez des polygones de test :

```sql
-- Insérer un polygone de test pour la géologie
INSERT INTO atlas.unites_geologiques (code, nom, description, lithologie, geom)
VALUES (
    'TEST_GEO_01',
    'Unité géologique test',
    'Zone de test pour validation',
    'Granite',
    ST_GeomFromText('MULTIPOLYGON(((250000 700000, 350000 700000, 350000 800000, 250000 800000, 250000 700000)))', 25231)
);

-- Insérer un polygone de test pour la pédologie
INSERT INTO atlas.unites_pedologiques (code, nom, type_sol, texture, geom)
VALUES (
    'TEST_PEDO_01',
    'Unité pédologique test',
    'Sol ferralitique',
    'Argileuse',
    ST_GeomFromText('MULTIPOLYGON(((250000 700000, 350000 700000, 350000 800000, 250000 800000, 250000 700000)))', 25231)
);

-- Insérer un polygone de test pour le risque de gonflement
INSERT INTO atlas.risque_gonflement (code, niveau_risque, description, ip_moyen, vbs_moyen, geom)
VALUES (
    'TEST_RISQUE_01',
    'moyen',
    'Zone de risque moyen',
    18.5,
    2.3,
    ST_GeomFromText('MULTIPOLYGON(((250000 700000, 350000 700000, 350000 800000, 250000 800000, 250000 700000)))', 25231)
);
```

#### Étape 4 : Redémarrer l'API

```powershell
docker restart atlas-api-geo
Start-Sleep -Seconds 10
```

#### Étape 5 : Tester les endpoints

```powershell
# Test géologie
curl "http://localhost:8000/layers/geologie?bbox=-2.8564453125000004,3.699818641574841,4.515380859375001,13.507155459536346" -v

# Test pédologie
curl "http://localhost:8000/layers/pedologie?bbox=-2.8564453125000004,3.699818641574841,4.515380859375001,13.507155459536346" -v

# Test risque de gonflement
curl "http://localhost:8000/layers/risque-gonflement?bbox=-2.8564453125000004,3.699818641574841,4.515380859375001,13.507155459536346" -v
```

**Résultat attendu :** HTTP 200 avec un GeoJSON FeatureCollection

---

## Problème 2 : Sondages et échantillons vides

### 🔍 Diagnostic

**État actuel :**
```sql
SELECT COUNT(*) FROM atlas.sondages;      -- 0
SELECT COUNT(*) FROM atlas.echantillons;  -- 0
```

**Cause racine :** Le dump `full_dump_20260105_133418.sql` contient :
- ✅ Le référentiel complet (ADM, mailles, structure Colab)
- ✅ Les mailles 2km et 28km
- ❌ **PAS** les données terrain (sondages, échantillons, essais)

### ✅ Solution : Importer les sondages depuis un autre dump

#### Option A : Restaurer un dump complet avec sondages

Si vous avez un dump plus ancien qui contient les sondages :

```powershell
# Lister les dumps disponibles
Get-ChildItem C:\PROJET_ATLAS_MASTER\atlas\backups\*.sql | Select-Object Name, Length, LastWriteTime

# Vérifier si un dump contient des sondages
Select-String -Path "C:\PROJET_ATLAS_MASTER\atlas\backups\backup_*.sql" -Pattern "INSERT INTO.*sondages" | Select-Object -First 5

# Si trouvé, restaurer ce dump
Get-Content C:\PROJET_ATLAS_MASTER\atlas\backups\backup_avec_sondages.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

#### Option B : Importer uniquement les sondages depuis un dump partiel

Si vous voulez garder la structure actuelle et ajouter seulement les sondages :

```powershell
# Extraire uniquement les INSERT de sondages/échantillons/essais d'un ancien dump
Select-String -Path "backup_ancien.sql" -Pattern "INSERT INTO.*\.(sondages|echantillons|essais)" | Out-File -FilePath "sondages_only.sql"

# Importer
Get-Content sondages_only.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

#### Option C : Importer depuis des fichiers Excel/CSV

Si vous avez les données dans des fichiers Excel :

```powershell
# Utiliser le script d'import existant
python scripts/02_import_excel.py --file "data/sondages_2024.xlsx"
```

#### Vérification après import

```sql
-- Vérifier les comptages
SELECT 
    (SELECT COUNT(*) FROM atlas.sondages) as nb_sondages,
    (SELECT COUNT(*) FROM atlas.echantillons) as nb_echantillons,
    (SELECT COUNT(*) FROM atlas.essais) as nb_essais;

-- Vérifier les liaisons avec les mailles
SELECT 
    COUNT(*) as sondages_avec_maille,
    COUNT(DISTINCT grid_code) as mailles_avec_sondages
FROM atlas.sondages 
WHERE grid_code IS NOT NULL;

-- Vérifier les liaisons avec les mailles 28km
SELECT 
    COUNT(*) as sondages_avec_m28,
    COUNT(DISTINCT id_m28) as mailles_28km_avec_sondages
FROM atlas.sondages 
WHERE id_m28 IS NOT NULL;
```

#### Recalculer les liaisons mailles ↔ sondages

Si les sondages sont importés mais non liés aux mailles :

```sql
-- Lier les sondages aux mailles 2km via géométrie
UPDATE atlas.sondages s
SET grid_code = m.code
FROM atlas.mailles m
WHERE s.grid_code IS NULL
  AND s.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(s.geom, 25231), m.geom);

-- Lier les sondages aux mailles 28km
UPDATE atlas.sondages s
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE s.id_m28 IS NULL
  AND s.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(s.geom, 25231), m28.geom);

-- Vérifier
SELECT 
    COUNT(*) FILTER (WHERE grid_code IS NOT NULL) as avec_maille_2km,
    COUNT(*) FILTER (WHERE id_m28 IS NOT NULL) as avec_maille_28km,
    COUNT(*) as total
FROM atlas.sondages;
```

---

## Problème 3 : Automatisation quotidienne check_28km

### 🔍 Objectif

Exécuter automatiquement `scripts/check_28km.py` tous les jours à une heure fixe sous Windows.

### ✅ Solution : Script PowerShell + Planificateur de tâches

#### Étape 1 : Tester le script manuellement

```powershell
# Tester le script
C:\PROJET_ATLAS_MASTER\atlas\scripts\check_28km_daily.ps1

# Vérifier le log créé
Get-Content C:\PROJET_ATLAS_MASTER\atlas\logs\check_28km_*.log -Tail 50
```

**Résultat attendu :**
```
[2026-01-06 18:30:00] [INFO] ========================================
[2026-01-06 18:30:00] [INFO] Vérification quotidienne grille 28km
[2026-01-06 18:30:00] [INFO] ========================================
[2026-01-06 18:30:01] [SUCCESS] ✓ Docker est actif
[2026-01-06 18:30:02] [SUCCESS] ✓ Conteneur atlas-db est actif
[2026-01-06 18:30:03] [SUCCESS] ✓ Python trouvé: Python 3.x.x
...
[2026-01-06 18:30:10] [SUCCESS] ✓ Vérification terminée avec succès
```

#### Étape 2 : Configurer le Planificateur de tâches Windows

**Méthode A : Interface graphique**

1. Ouvrir le Planificateur de tâches :
   - Appuyer sur `Win + R`
   - Taper `taskschd.msc`
   - Appuyer sur Entrée

2. Créer une nouvelle tâche :
   - Clic droit sur "Bibliothèque du Planificateur de tâches"
   - "Créer une tâche..." (pas "Créer une tâche de base")

3. Onglet **Général** :
   - **Nom :** `Atlas - Vérification quotidienne grille 28km`
   - **Description :** `Exécute check_28km.py tous les jours pour vérifier l'état de la grille 28km`
   - ☑ **Exécuter même si l'utilisateur n'est pas connecté**
   - ☑ **Exécuter avec les autorisations maximales**
   - **Configurer pour :** Windows 10

4. Onglet **Déclencheurs** :
   - Cliquer sur "Nouveau..."
   - **Lancer la tâche :** Selon une planification
   - **Paramètres :** Quotidienne
   - **Démarrer le :** (date du jour)
   - **À :** `02:00:00` (2h du matin, ou l'heure de votre choix)
   - **Répéter tous les jours :** 1
   - ☑ **Activé**
   - Cliquer sur "OK"

5. Onglet **Actions** :
   - Cliquer sur "Nouveau..."
   - **Action :** Démarrer un programme
   - **Programme/script :** `powershell.exe`
   - **Ajouter des arguments :**
     ```
     -NoProfile -ExecutionPolicy Bypass -File "C:\PROJET_ATLAS_MASTER\atlas\scripts\check_28km_daily.ps1"
     ```
   - **Commencer dans :** `C:\PROJET_ATLAS_MASTER\atlas`
   - Cliquer sur "OK"

6. Onglet **Conditions** :
   - ☐ Décocher "Démarrer la tâche uniquement si l'ordinateur est relié au secteur"
   - ☑ **Réveiller l'ordinateur pour exécuter cette tâche** (optionnel)

7. Onglet **Paramètres** :
   - ☑ **Autoriser l'exécution de la tâche à la demande**
   - ☑ **Exécuter la tâche dès que possible si un démarrage planifié est manqué**
   - **Si la tâche échoue, redémarrer toutes les :** 1 minute
   - **Tenter de redémarrer jusqu'à :** 3 fois
   - ☐ Décocher "Arrêter la tâche si elle s'exécute plus de"

8. Cliquer sur "OK" pour créer la tâche

**Méthode B : Ligne de commande (schtasks)**

```powershell
# Créer la tâche planifiée
schtasks /Create /TN "Atlas\Check28km" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\PROJET_ATLAS_MASTER\atlas\scripts\check_28km_daily.ps1'" /SC DAILY /ST 02:00 /RU "SYSTEM" /RL HIGHEST /F

# Vérifier que la tâche est créée
schtasks /Query /TN "Atlas\Check28km" /FO LIST /V

# Tester immédiatement
schtasks /Run /TN "Atlas\Check28km"

# Vérifier le statut
schtasks /Query /TN "Atlas\Check28km"
```

#### Étape 3 : Tester la tâche planifiée

```powershell
# Exécuter manuellement la tâche
schtasks /Run /TN "Atlas\Check28km"

# Attendre quelques secondes
Start-Sleep -Seconds 15

# Vérifier le dernier log créé
Get-ChildItem C:\PROJET_ATLAS_MASTER\atlas\logs\check_28km_*.log | Sort-Object LastWriteTime -Descending | Select-Object -First 1 | Get-Content -Tail 30
```

#### Étape 4 : Surveiller les exécutions

```powershell
# Voir l'historique des exécutions
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 50 | 
    Where-Object { $_.Message -like "*Atlas*28km*" } | 
    Select-Object TimeCreated, Message | 
    Format-Table -AutoSize

# Lister tous les logs créés
Get-ChildItem C:\PROJET_ATLAS_MASTER\atlas\logs\check_28km_*.log | 
    Sort-Object LastWriteTime -Descending | 
    Select-Object Name, Length, LastWriteTime | 
    Format-Table -AutoSize
```

---

## Plan de tests de validation

### 🧪 Tests à exécuter après chaque correction

#### Test 1 : Vérifier les tables de couches contextuelles

```powershell
# Vérifier l'existence des tables
docker exec atlas-db psql -U atlas -d atlas_clean -c "
SELECT 
    schemaname, 
    tablename, 
    (SELECT COUNT(*) FROM atlas.unites_geologiques) as nb_geo,
    (SELECT COUNT(*) FROM atlas.unites_pedologiques) as nb_pedo,
    (SELECT COUNT(*) FROM atlas.risque_gonflement) as nb_risque
FROM pg_tables 
WHERE schemaname = 'atlas' 
  AND tablename IN ('unites_geologiques', 'unites_pedologiques', 'risque_gonflement')
ORDER BY tablename;
"
```

**Résultat attendu :**
```
 schemaname |      tablename       | nb_geo | nb_pedo | nb_risque
------------+----------------------+--------+---------+-----------
 atlas      | risque_gonflement    |      X |       X |         X
 atlas      | unites_geologiques   |      X |       X |         X
 atlas      | unites_pedologiques  |      X |       X |         X
```

#### Test 2 : Tester les endpoints API

```powershell
# Test géologie
$response = Invoke-WebRequest -Uri "http://localhost:8000/layers/geologie?bbox=0,6,2,11" -Method GET
Write-Host "Géologie: $($response.StatusCode) - $($response.Content.Length) bytes"

# Test pédologie
$response = Invoke-WebRequest -Uri "http://localhost:8000/layers/pedologie?bbox=0,6,2,11" -Method GET
Write-Host "Pédologie: $($response.StatusCode) - $($response.Content.Length) bytes"

# Test risque de gonflement
$response = Invoke-WebRequest -Uri "http://localhost:8000/layers/risque-gonflement?bbox=0,6,2,11" -Method GET
Write-Host "Risque: $($response.StatusCode) - $($response.Content.Length) bytes"
```

**Résultat attendu :**
```
Géologie: 200 - XXXX bytes
Pédologie: 200 - XXXX bytes
Risque: 200 - XXXX bytes
```

#### Test 3 : Vérifier la grille 28km

```powershell
# Test endpoint 28km
$response = Invoke-WebRequest -Uri "http://localhost:8000/coverage/mailles?grid=28km" -Method GET
$json = $response.Content | ConvertFrom-Json
Write-Host "Grille 28km: $($response.StatusCode) - $($json.features.Count) features"

# Vérifier les propriétés
$firstFeature = $json.features[0].properties
Write-Host "Propriétés: code_m28=$($firstFeature.code_m28), profil_num=$($firstFeature.profil_num)"
```

**Résultat attendu :**
```
Grille 28km: 200 - 101 features
Propriétés: code_m28=X, profil_num=X
```

#### Test 4 : Vérifier les sondages

```sql
-- Comptages globaux
SELECT 
    (SELECT COUNT(*) FROM atlas.sondages) as nb_sondages,
    (SELECT COUNT(*) FROM atlas.echantillons) as nb_echantillons,
    (SELECT COUNT(*) FROM atlas.essais) as nb_essais;

-- Sondages par maille 2km (top 10)
SELECT 
    grid_code,
    COUNT(*) as nb_sondages
FROM atlas.sondages
WHERE grid_code IS NOT NULL
GROUP BY grid_code
ORDER BY nb_sondages DESC
LIMIT 10;

-- Sondages par maille 28km
SELECT 
    id_m28,
    COUNT(*) as nb_sondages
FROM atlas.sondages
WHERE id_m28 IS NOT NULL
GROUP BY id_m28
ORDER BY nb_sondages DESC
LIMIT 10;
```

#### Test 5 : Vérifier l'UI

1. Ouvrir `http://localhost:5173` dans le navigateur
2. Vérifier que la carte se charge
3. Activer la couche "Géologie" → doit afficher des polygones colorés
4. Activer la couche "Pédologie" → doit afficher des polygones colorés
5. Activer la couche "Risque de gonflement" → doit afficher des polygones colorés
6. Basculer sur "Grille 28km (Profils)" → doit afficher 101 mailles
7. Cliquer sur une maille 28km → doit afficher les KPIs (sondages, IP, VBS, etc.)

#### Test 6 : Vérifier le script automatisé

```powershell
# Exécuter manuellement
C:\PROJET_ATLAS_MASTER\atlas\scripts\check_28km_daily.ps1

# Vérifier le code de sortie
if ($LASTEXITCODE -eq 0) {
    Write-Host "✓ Script exécuté avec succès" -ForegroundColor Green
} else {
    Write-Host "✗ Script échoué avec code $LASTEXITCODE" -ForegroundColor Red
}

# Vérifier le log
$lastLog = Get-ChildItem C:\PROJET_ATLAS_MASTER\atlas\logs\check_28km_*.log | 
            Sort-Object LastWriteTime -Descending | 
            Select-Object -First 1
Get-Content $lastLog.FullName -Tail 20
```

---

## 📊 Checklist de validation complète

- [ ] Migration 090 exécutée avec succès
- [ ] Tables `unites_geologiques`, `unites_pedologiques`, `risque_gonflement` créées
- [ ] Données géographiques importées (ou polygones de test créés)
- [ ] API redémarrée
- [ ] Endpoint `/layers/geologie` retourne 200
- [ ] Endpoint `/layers/pedologie` retourne 200
- [ ] Endpoint `/layers/risque-gonflement` retourne 200
- [ ] Endpoint `/coverage/mailles?grid=28km` retourne 101 features
- [ ] Sondages importés (si disponibles)
- [ ] Liaisons mailles ↔ sondages recalculées
- [ ] Script `check_28km_daily.ps1` testé manuellement
- [ ] Tâche planifiée créée dans Windows
- [ ] Tâche planifiée testée avec `/Run`
- [ ] UI affiche correctement les couches contextuelles
- [ ] UI affiche correctement la grille 28km
- [ ] KPIs sondages affichés dans l'UI (si sondages importés)

---

## 🆘 Dépannage

### Problème : "Docker n'est pas en cours d'exécution"

**Solution :**
```powershell
# Démarrer Docker Desktop
Start-Process "C:\Program Files\Docker\Docker\Docker Desktop.exe"
Start-Sleep -Seconds 30
docker ps
```

### Problème : "Le conteneur atlas-db n'est pas en cours d'exécution"

**Solution :**
```powershell
docker start atlas-db
Start-Sleep -Seconds 10
docker ps | Select-String "atlas-db"
```

### Problème : "Python n'est pas installé"

**Solution :**
```powershell
# Vérifier si Python est dans le PATH
$env:PATH -split ';' | Select-String "Python"

# Si Anaconda est installé
conda activate base
python --version

# Ajouter Python au PATH (PowerShell admin)
[Environment]::SetEnvironmentVariable("Path", $env:Path + ";C:\Users\<USER>\anaconda3", "User")
```

### Problème : "Erreur d'exécution de la tâche planifiée"

**Solution :**
```powershell
# Vérifier les logs de la tâche
Get-WinEvent -LogName "Microsoft-Windows-TaskScheduler/Operational" -MaxEvents 20 | 
    Where-Object { $_.LevelDisplayName -eq "Error" } | 
    Format-List TimeCreated, Message

# Vérifier la configuration de la tâche
schtasks /Query /TN "Atlas\Check28km" /FO LIST /V

# Supprimer et recréer la tâche
schtasks /Delete /TN "Atlas\Check28km" /F
schtasks /Create /TN "Atlas\Check28km" /TR "powershell.exe -NoProfile -ExecutionPolicy Bypass -File 'C:\PROJET_ATLAS_MASTER\atlas\scripts\check_28km_daily.ps1'" /SC DAILY /ST 02:00 /RU "SYSTEM" /RL HIGHEST /F
```

---

**Fin du guide**
