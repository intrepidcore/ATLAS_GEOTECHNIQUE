# Import Excel Étendu - Version 1.5.4

## 📋 Vue d'ensemble

Extension majeure du script `02_import_excel.py` pour supporter l'import complet de toutes les feuilles Excel géotechniques, incluant :

- ✅ **Teneur en eau** → `essais_physiques`
- ✅ **Classifications** (AASHTO, USCS, GTR) → `essais_classif`
- ✅ **Granulométrie** (points de courbes) → `granulo_points`
- ✅ **Import RAW** automatique (AGT, AGS, Atterberg)
- ✅ **Gestion de l'absence de Proctor**
- ✅ **Ignore la colonne `ip`** (calculée automatiquement)

## 🆕 Nouvelles fonctionnalités

### 1. Import Teneur en Eau (essais_physiques)

**Feuille Excel**: `teneur_eau`

**Colonnes supportées**:
- `code` ou `code_site` (requis)
- `depth_m` (requis)
- `rho_s_abs` ou `densite_absolue` (optionnel) - Densité absolue en g/cm³
- `w` ou `teneur_eau` (optionnel) - Teneur en eau en %
- `source` (optionnel)

**Exemple**:
```
code        | depth_m | rho_s_abs | w     | source
------------|---------|-----------|-------|------------------
NICABOU-01  | 1.0     | 2.606     | 14.79 | NICABOU Ninsao
NICABOU-01  | 1.5     | 2.562     | 16.21 | NICABOU Ninsao
```

**Mapping base de données**:
- Lié à `essais_geotechniques` via `(code, depth_m)`
- Insertion dans `essais_physiques` avec `essai_id`
- Upsert: mise à jour si l'essai existe déjà

### 2. Import Classifications (essais_classif)

**Feuille Excel**: `classification`

**Colonnes supportées**:
- `code` ou `code_site` (requis)
- `depth_m` (requis)
- `aashto` ou `hrb` (optionnel) - Classification AASHTO
- `uscs` ou `unified` (optionnel) - Classification USCS
- `gtr` (optionnel) - Classification GTR
- `reason` ou `note` (optionnel) - Justification
- `source` (optionnel)

**Exemple**:
```
code        | depth_m | aashto | uscs                      | reason
------------|---------|--------|---------------------------|------------------
NICABOU-01  | 1.0     | A-4    | Sol argileux peu plastique| WL=35, IP=12
NICABOU-01  | 1.5     | A-6    | Sol argileux peu plastique| WL=42, IP=18
```

**Mapping base de données**:
- Lié à `essais_geotechniques` via `(code, depth_m)`
- Une ligne par système de classification (AASHTO, USCS, GTR)
- Upsert par `(essai_id, systeme)`

### 3. Import Granulométrie (granulo_points)

**Feuilles Excel supportées**: `granulo`, `granulo_points`, `granulometrie`

**Colonnes supportées**:
- `code` ou `code_site` (requis)
- `depth_m` (requis)
- `sieve_mm` ou `tamis_mm` (requis) - Diamètre du tamis en mm
- `passing_pct` ou `passant_pct` (requis) - % passant (0-100)
- `method` ou `methode` (optionnel) - `tamisage` ou `sedimento`

**Exemple**:
```
code        | depth_m | sieve_mm | passing_pct | method
------------|---------|----------|-------------|----------
NICABOU-01  | 1.0     | 80.0     | 100.0       | tamisage
NICABOU-01  | 1.0     | 40.0     | 98.5        | tamisage
NICABOU-01  | 1.0     | 20.0     | 95.2        | tamisage
NICABOU-01  | 1.0     | 0.08     | 45.3        | sedimento
```

**Mapping base de données**:
- Lié à `echantillons` via `(code, depth_m)`
- Upsert par `(echantillon_id, method, sieve_mm)`
- Permet de construire des courbes granulométriques complètes

### 4. Gestion de la colonne `ip`

La colonne `ip` (Indice de Plasticité) dans la feuille `atterberg` est **automatiquement ignorée** car elle est calculée par la base de données :

```sql
ip = wl - wp  (si wl >= wp)
```

**Comportement**:
- Si la colonne `ip` existe dans Excel → supprimée avant import
- Message informatif dans les logs
- Aucune erreur générée

### 5. Gestion de l'absence de Proctor

Le script gère gracieusement l'absence de la feuille `proctor` :

```
⚠️  Feuille 'proctor' absente ou vide (OK)
```

Aucune erreur n'est levée, l'import continue normalement.

## 🔧 Utilisation

### Import standard (toutes les feuilles)

```powershell
cd atlas/scripts
python 02_import_excel.py `
    --file ../data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx `
    --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean"
```

### Mode dry-run (validation sans écriture)

```powershell
python 02_import_excel.py `
    --file ../data/xlsx/IMPORT/mon_fichier.xlsx `
    --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
    --dry-run
```

### Import sans tables RAW

```powershell
python 02_import_excel.py `
    --file mon_fichier.xlsx `
    --dsn "..." `
    --import-raw no
```

### Import UNIQUEMENT tables RAW

```powershell
python 02_import_excel.py `
    --file mon_fichier.xlsx `
    --dsn "..." `
    --raw-only
```

## 📊 Ordre d'import

L'import suit cet ordre pour respecter les dépendances :

1. **Sondages** (table parent)
2. **Échantillons** (lié aux sondages)
3. **Atterberg** (lié aux échantillons)
4. **VBS** (lié aux échantillons)
5. **Proctor** (lié aux échantillons, optionnel)
6. **Teneur en eau** → `essais_physiques` (lié aux essais_geotechniques)
7. **Classifications** → `essais_classif` (lié aux essais_geotechniques)
8. **Granulométrie** → `granulo_points` (lié aux échantillons)
9. **Tables RAW** (AGT, AGS, Atterberg détaillé)

## 🗄️ Migration de la base de données

### Problème actuel

La base de données actuelle utilise des types `TEXT` pour la plupart des colonnes, ce qui pose des problèmes :
- Pas de validation des valeurs numériques
- Impossibilité d'utiliser des opérations mathématiques
- Performances dégradées pour les requêtes

### Solution : Migration 020

Un script de migration SQL a été créé pour convertir les types :

**Fichier**: `db/migrations/020_upgrade_types_to_proper_schema.sql`

**Conversions appliquées**:
- `TEXT` → `UUID` pour les IDs
- `TEXT` → `NUMERIC` pour les valeurs numériques
- `TEXT` → `JSONB` pour les métadonnées
- `TEXT` → `TIMESTAMPTZ` pour les dates
- `TEXT` → `BOOLEAN` pour les flags

### Application de la migration

#### Option 1 : Script PowerShell automatisé (recommandé)

```powershell
cd atlas/scripts
.\apply_migration_020.ps1
```

**Fonctionnalités**:
- ✅ Backup automatique avant migration
- ✅ Validation des données
- ✅ Vérification post-migration
- ✅ Rollback possible

#### Option 2 : Mode dry-run (test)

```powershell
.\apply_migration_020.ps1 -DryRun
```

#### Option 3 : Manuel

```powershell
# Backup manuel
docker compose exec db pg_dump -U atlas atlas_clean > backup_pre_020.sql

# Appliquer la migration
docker compose exec -T db psql -U atlas -d atlas_clean < ../db/migrations/020_upgrade_types_to_proper_schema.sql
```

### Tables de backup créées

La migration crée automatiquement des tables de backup :
- `_backup_echantillons_pre_020`
- `_backup_essais_physiques_pre_020`
- `_backup_essais_classif_pre_020`
- `_backup_granulo_points_pre_020`
- `_backup_essais_geotechniques_pre_020`

**Suppression après validation** :

```sql
DROP TABLE _backup_echantillons_pre_020;
DROP TABLE _backup_essais_physiques_pre_020;
DROP TABLE _backup_essais_classif_pre_020;
DROP TABLE _backup_granulo_points_pre_020;
DROP TABLE _backup_essais_geotechniques_pre_020;
```

## 🧪 Tests

### 1. Test avec fichier NICABOU

```powershell
cd atlas/scripts
python 02_import_excel.py `
    --file ../data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx `
    --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
    --verbose
```

**Résultat attendu**:
```
📊 RAPPORT D'IMPORT
======================================================================
Table                     Lues     Créées   MAJ      Erreurs  Taux
----------------------------------------------------------------------
sondages                  3        3        0        0        100.0%
echantillons              9        9        0        0        100.0%
essais_atterberg          9        9        0        0        100.0%
essais_vbs                9        9        0        0        100.0%
essais_physiques          9        9        0        0        100.0%
essais_classif            18       18       0        0        100.0%
granulo_points            45       45       0        0        100.0%
----------------------------------------------------------------------
TOTAL                              102      0
```

### 2. Vérification des données

```sql
-- Vérifier teneur en eau
SELECT s.code, eg.depth_m, ep.densite_absolue_gcm3, ep.teneur_eau_pct
FROM essais_physiques ep
JOIN essais_geotechniques eg ON eg.id = ep.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NICABOU Ninsao Vianney'
ORDER BY s.code, eg.depth_m;

-- Vérifier classifications
SELECT s.code, eg.depth_m, ec.systeme, ec.classe
FROM essais_classif ec
JOIN essais_geotechniques eg ON eg.id = ec.essai_id
JOIN sondages s ON s.id = eg.sondage_id
WHERE s.source = 'NICABOU Ninsao Vianney'
ORDER BY s.code, eg.depth_m, ec.systeme;

-- Vérifier granulo
SELECT s.code, e.depth_m, gp.method, COUNT(*) as nb_points
FROM granulo_points gp
JOIN echantillons e ON e.id = gp.echantillon_id
JOIN sondages s ON s.id = e.sondage_id
WHERE s.source = 'NICABOU Ninsao Vianney'
GROUP BY s.code, e.depth_m, gp.method
ORDER BY s.code, e.depth_m, gp.method;
```

## 📝 Structure Excel attendue

### Feuilles obligatoires
- `sondages` - Informations sur les sondages
- `echantillons` - Échantillons prélevés

### Feuilles optionnelles (nouvelles)
- `atterberg` - Limites d'Atterberg (WL, WP)
- `vbs` - Valeur de Bleu
- `proctor` - Essais Proctor
- `teneur_eau` - Teneur en eau et densités
- `classification` - Classifications géotechniques
- `granulo` / `granulo_points` / `granulometrie` - Points granulo

### Feuilles RAW (optionnelles, v1.5.3)
- `agt_raw_long` - Granulométrie par tamisage (détaillé)
- `ags_raw_long` - Granulométrie par sédimentométrie (détaillé)
- `atterberg_raw` - Atterberg détaillé (par tare)

## ⚠️ Points d'attention

### 1. Dépendances entre tables

Les imports doivent respecter l'ordre car :
- `essais_physiques` et `essais_classif` nécessitent `essais_geotechniques`
- `essais_geotechniques` est créé automatiquement depuis `echantillons` + `atterberg`/`vbs`/`proctor`
- `granulo_points` nécessite `echantillons`

### 2. Gestion des doublons

Le script utilise des **UPSERT** (INSERT ... ON CONFLICT DO UPDATE) :
- `essais_physiques` : unique par `essai_id`
- `essais_classif` : unique par `(essai_id, systeme)`
- `granulo_points` : unique par `(echantillon_id, method, sieve_mm)`

### 3. Validation des valeurs

Le script valide automatiquement :
- Densités : 2.0 ≤ ρ ≤ 3.5 g/cm³
- Teneur en eau : 0 ≤ w ≤ 100 %
- Passants : 0 ≤ % ≤ 100
- Tamis : > 0 mm

### 4. Types TEXT actuels

**Avant migration 020** : Le script convertit les valeurs en TEXT pour compatibilité
**Après migration 020** : Les types sont corrects (NUMERIC, UUID, etc.)

## 🔄 Workflow complet

```mermaid
graph TD
    A[Préparer Excel] --> B[Dry-run validation]
    B --> C{Erreurs?}
    C -->|Oui| D[Corriger Excel]
    D --> B
    C -->|Non| E[Appliquer migration 020]
    E --> F[Import réel]
    F --> G[Vérifier données]
    G --> H{OK?}
    H -->|Non| I[Rollback backup]
    H -->|Oui| J[Supprimer backups]
```

## 📚 Références

- Script principal : `scripts/02_import_excel.py`
- Migration SQL : `db/migrations/020_upgrade_types_to_proper_schema.sql`
- Script PowerShell : `scripts/apply_migration_020.ps1`
- Extension RAW : `scripts/02_import_excel_RAW_EXTENSION.py`

## 🐛 Troubleshooting

### Erreur : "essai introuvable"

**Cause** : L'essai géotechnique n'existe pas pour ce `(code, depth_m)`

**Solution** : Vérifier que les feuilles `atterberg`, `vbs` ou `proctor` contiennent bien cet échantillon

### Erreur : "échantillon introuvable"

**Cause** : L'échantillon n'existe pas dans la table `echantillons`

**Solution** : Vérifier la feuille `echantillons` et que le `code` et `depth_m` correspondent

### Erreur de conversion de type

**Cause** : Valeur non numérique dans une colonne numérique

**Solution** : 
1. Utiliser `--dry-run` pour identifier les lignes problématiques
2. Corriger les valeurs dans Excel
3. Relancer l'import

### Migration 020 échoue

**Cause** : Valeurs TEXT non convertibles en NUMERIC/UUID

**Solution** :
1. Restaurer depuis le backup : `docker compose exec -T db psql -U atlas -d atlas_clean < backup_pre_020.sql`
2. Nettoyer les données invalides
3. Relancer la migration

## 📈 Améliorations futures

- [ ] Support des courbes Proctor complètes (points)
- [ ] Import des essais de gonflement détaillés
- [ ] Validation croisée WL/WP/IP
- [ ] Calcul automatique des classifications depuis granulo
- [ ] Export Excel depuis la base
- [ ] Interface web pour l'import

---

**Version** : 1.5.4  
**Date** : 2025-11-15  
**Auteur** : Atlas Team
