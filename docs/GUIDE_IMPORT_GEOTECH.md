# 📘 Guide d'Import Géotechnique - Atlas

## 🎯 Objectif

Créer une base PostgreSQL/PostGIS propre (`atlas_clean`) avec le même schéma que la production, mais **sans données géotechniques**, puis importer vos vraies données de manière contrôlée.

---

## 📋 Tables Concernées

### Tables Géotechniques (à vider)
- `sondages` - Sondages géotechniques
- `essais_geotechniques` - Essais normalisés (ancienne structure)
- `echantillons` - Échantillons par profondeur
- `essais_atterberg` - Limites d'Atterberg (WL, WP, IP)
- `essais_vbs` - Valeur de Bleu de Méthylène
- `essais_proctor` - Essais Proctor (normal/modifié)
- `granulo_points` - Points de courbes granulométriques

### Tables d'Import (à vider)
- `imports`, `import_items`, `import_logs`
- `import_mapping_profiles`
- `test_type_defaults`

### Vues Matérialisées (à rafraîchir après import)
- `mailles_geotechnique_stats`

### Tables Référentielles (conservées)
- `mailles` - Grille géographique
- `adm_0`, `adm_2`, `adm_3` - Divisions administratives
- Autres tables de référence

---

## 🚀 Workflow Complet

### Étape 1: Cloner la Base Sans Données Géotech

#### Option A: Linux/Mac (Bash)

```bash
cd atlas/scripts
chmod +x 01_clone_database.sh

# Configurer les variables (ou éditer le script)
export PGHOST_SRC="localhost"
export PGPORT_SRC="5432"
export PGUSER_SRC="postgres"
export PGDB_SRC="atlas_prod"

export PGHOST_DST="localhost"
export PGPORT_DST="5432"
export PGUSER_DST="postgres"
export PGDB_DST="atlas_clean"

# Exécuter
./01_clone_database.sh
```

#### Option B: Windows (PowerShell)

```powershell
cd atlas\scripts

# Exécuter avec paramètres
.\01_clone_database.ps1 `
  -PgHostSrc "localhost" `
  -PgPortSrc 5432 `
  -PgUserSrc "postgres" `
  -PgDbSrc "atlas_prod" `
  -PgHostDst "localhost" `
  -PgPortDst 5432 `
  -PgUserDst "postgres" `
  -PgDbDst "atlas_clean"
```

#### Ce que fait le script:
1. ✅ Dump de `atlas_prod` avec `--exclude-table-data` sur les tables géotech
2. ✅ Création de `atlas_clean`
3. ✅ Activation des extensions PostGIS
4. ✅ Restore du schéma complet + données référentielles
5. ✅ Vérifications (compteurs tables)
6. ✅ Refresh de la vue matérialisée (vide)

---

### Étape 2: Pointer l'API vers la Nouvelle Base

Modifier votre fichier `.env` ou `docker-compose.yml`:

```bash
# Avant
DATABASE_URL=postgresql://user:pass@localhost:5432/atlas_prod

# Après
DATABASE_URL=postgresql://user:pass@localhost:5432/atlas_clean
```

Redémarrer l'API:

```bash
docker compose up -d --build api
# ou
docker compose restart api
```

Vérifier l'UI:
- ✅ Cartes affichées (mailles, ADM)
- ✅ Compteurs géotech à 0 (normal)

---

### Étape 3: Importer Vos Données

## 🔥 Méthode Recommandée: Excel → Script Python

### Prérequis

```bash
pip install pandas openpyxl psycopg[binary]
```

### Structure Excel Attendue

Créez un fichier `.xlsx` avec les feuilles suivantes (noms insensibles à la casse):

#### Feuille `sondages`
| code | localite | date | lat | lon | source |
|------|----------|------|-----|-----|--------|
| S001 | Dakar | 2024-01-15 | 14.6937 | -17.4441 | LBTP |
| S002 | Thiès | 2024-02-20 | 14.7886 | -16.9322 | LBTP |

**Colonnes:**
- `code` (obligatoire) - Identifiant unique du sondage
- `lat`, `lon` (obligatoires) - Coordonnées WGS84 (décimales)
- `date` - Date du sondage (YYYY-MM-DD)
- `localite` - Nom de la localité
- `source` - Source des données

#### Feuille `echantillons`
| code | depth_m | date | laboratory | rho_s_gcm3 | water_content_w | is_index |
|------|---------|------|------------|------------|-----------------|----------|
| S001 | 1.5 | 2024-01-15 | LBTP | 2.65 | 12.5 | 0.15 |
| S001 | 3.0 | 2024-01-15 | LBTP | 2.68 | 15.2 | 0.22 |

**Colonnes:**
- `code` (obligatoire) - Référence au sondage
- `depth_m` (obligatoire) - Profondeur en mètres (≥ 0)
- `date` - Date de prélèvement
- `laboratory` - Laboratoire
- `rho_s_gcm3` - Densité des solides (2.0-3.5 g/cm³)
- `water_content_w` - Teneur en eau (0-100%)
- `is_index` - Indice de gonflement (0-1)

#### Feuille `atterberg`
| code | depth_m | wl | wp |
|------|---------|----|----|
| S001 | 1.5 | 45.2 | 22.1 |
| S001 | 3.0 | 52.8 | 25.3 |

**Colonnes:**
- `code`, `depth_m` (obligatoires) - Référence à l'échantillon
- `wl` - Limite de liquidité (0-200%)
- `wp` - Limite de plasticité (0-200%)
- `ip` - Calculé automatiquement: IP = WL - WP

#### Feuille `vbs`
| code | depth_m | vbs | commentaire |
|------|---------|-----|-------------|
| S001 | 1.5 | 2.5 | Sol argileux |
| S001 | 3.0 | 4.2 | Argile gonflante |

**Colonnes:**
- `code`, `depth_m` (obligatoires)
- `vbs` (obligatoire) - Valeur de Bleu (0-20 g/100g)
- `commentaire` - Observations

#### Feuille `proctor`
| code | depth_m | gamma_d_max | w_opt | proctor_type |
|------|---------|-------------|-------|--------------|
| S001 | 1.5 | 18.5 | 12.5 | normal |
| S001 | 3.0 | 19.2 | 11.8 | modifie |

**Colonnes:**
- `code`, `depth_m` (obligatoires)
- `gamma_d_max` (obligatoire) - Densité sèche max (10-30 kN/m³)
- `w_opt` (obligatoire) - Teneur en eau optimale (0-50%)
- `proctor_type` - `normal` ou `modifie` (défaut: `normal`)

---

### Exécution de l'Import

#### Mode DRY-RUN (validation sans écriture)

```bash
python scripts/02_import_excel.py \
  --file data/mes_donnees.xlsx \
  --dsn "postgresql://user:pass@localhost:5432/atlas_clean" \
  --dry-run
```

✅ Vérifie:
- Structure du fichier Excel
- Validité des données (types, plages)
- Références (sondages → échantillons)
- Affiche un rapport détaillé

#### Import Réel

```bash
python scripts/02_import_excel.py \
  --file data/mes_donnees.xlsx \
  --dsn "postgresql://user:pass@localhost:5432/atlas_clean"
```

Ou avec variable d'environnement:

```bash
export DATABASE_URL="postgresql://user:pass@localhost:5432/atlas_clean"
python scripts/02_import_excel.py --file data/mes_donnees.xlsx
```

#### Mode Verbeux (debug)

```bash
python scripts/02_import_excel.py \
  --file data/mes_donnees.xlsx \
  --dsn "..." \
  --verbose
```

---

### Rapport d'Import

Le script affiche un rapport détaillé:

```
======================================================================
📊 RAPPORT D'IMPORT
======================================================================
Début: 2024-10-24 10:30:15
Fin: 2024-10-24 10:32:45 (durée: 150.3s)

Table                     Lues     Créées   MAJ      Erreurs  Taux    
----------------------------------------------------------------------
sondages                  150      145      5        0        100.0%
echantillons              450      442      8        0        100.0%
essais_atterberg          380      375      5        0        100.0%
essais_vbs                320      318      2        0        100.0%
essais_proctor            280      275      5        0        100.0%
----------------------------------------------------------------------
TOTAL                              1555     25

✅ Import terminé avec succès!
```

---

### Gestion des Erreurs

Le script est **idempotent** (peut être relancé sans risque):

- **UPSERT** sur toutes les tables
- Clés de conflit: `(code)`, `(sondage_id, depth_m)`, etc.
- En cas d'erreur: **ROLLBACK** complet (transaction atomique)
- Logs détaillés des erreurs par ligne

Erreurs courantes:

```
❌ ERREURS DÉTECTÉES:

  sondages:
    - Ligne 12: coordonnées invalides (lon hors plage)
    - Ligne 45: code manquant
  
  echantillons:
    - Ligne 78: sondage 'S999' introuvable
    - Ligne 102: depth_m invalide (négatif)
```

---

## 🔄 Workflow Alternatif: Texte Brut → CSV

Si vos données sont dans des tableaux texte bruts (copier-coller depuis Word, PDF, etc.):

### Prompt pour Claude

```
À partir de ce texte, génère des CSV par table (sondages, echantillons, atterberg, vbs, proctor) 
et les commandes COPY PostgreSQL associées.

Format attendu:
- sondages.csv: code,localite,date,lat,lon,source
- echantillons.csv: code,depth_m,date,laboratory,rho_s_gcm3,water_content_w,is_index
- atterberg.csv: code,depth_m,wl,wp
- vbs.csv: code,depth_m,vbs,commentaire
- proctor.csv: code,depth_m,gamma_d_max,w_opt,proctor_type

Fournis aussi les commandes COPY et les requêtes SQL de pivot si nécessaire.
N'exécute rien, affiche uniquement le plan.

[COLLER VOS DONNÉES ICI]
```

Claude générera:
1. ✅ CSV propres par table
2. ✅ Commandes `COPY` PostgreSQL
3. ✅ Requêtes SQL de normalisation/pivot

Vous exécutez ensuite manuellement:

```bash
psql -h localhost -U postgres -d atlas_clean

\copy sondages (geom, date_sondage, source, meta) FROM 'sondages.csv' CSV HEADER;
\copy echantillons (...) FROM 'echantillons.csv' CSV HEADER;
-- etc.
```

---

## ✅ Vérifications Post-Import

### 1. Compteurs

```sql
-- Tables référentielles (doivent avoir des données)
SELECT 'mailles' as table_name, COUNT(*) FROM mailles
UNION ALL SELECT 'adm_0', COUNT(*) FROM adm_0
UNION ALL SELECT 'adm_2', COUNT(*) FROM adm_2
UNION ALL SELECT 'adm_3', COUNT(*) FROM adm_3;

-- Tables géotechniques (nouvelles données)
SELECT 'sondages' as table_name, COUNT(*) FROM sondages
UNION ALL SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL SELECT 'essais_atterberg', COUNT(*) FROM essais_atterberg
UNION ALL SELECT 'essais_vbs', COUNT(*) FROM essais_vbs
UNION ALL SELECT 'essais_proctor', COUNT(*) FROM essais_proctor;
```

### 2. Refresh Vue Matérialisée

```sql
REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;

-- Vérifier
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais
FROM mailles_geotechnique_stats;
```

### 3. Intégrité Référentielle

```sql
-- Échantillons orphelins (ne devrait rien retourner)
SELECT e.* FROM echantillons e
LEFT JOIN sondages s ON e.sondage_id = s.id
WHERE s.id IS NULL;

-- Essais orphelins
SELECT a.* FROM essais_atterberg a
LEFT JOIN echantillons e ON a.echantillon_id = e.id
WHERE e.id IS NULL;
```

### 4. Vérifier l'UI

- ✅ Carte des sondages affichée
- ✅ Cartes thématiques (WL, VBS, etc.) avec données
- ✅ Statistiques par maille
- ✅ Filtres fonctionnels

---

## 🛠️ Dépannage

### Erreur: "Extension PostGIS introuvable"

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
CREATE EXTENSION IF NOT EXISTS postgis_topology;
```

### Erreur: "Relation sondages n'existe pas"

Vérifier que le restore s'est bien passé:

```bash
psql -d atlas_clean -c "\dt"
```

Si tables manquantes, relancer le script de clone.

### Erreur: "Sondage introuvable" lors de l'import échantillons

Les sondages doivent être importés **avant** les échantillons.
Ordre obligatoire:
1. Sondages
2. Échantillons
3. Essais (Atterberg, VBS, Proctor)

### Performance: Import lent

- Désactiver temporairement les triggers:
  ```sql
  ALTER TABLE echantillons DISABLE TRIGGER ALL;
  -- import
  ALTER TABLE echantillons ENABLE TRIGGER ALL;
  ```

- Utiliser `COPY` au lieu d'`INSERT` pour gros volumes (>10k lignes)

---

## 📊 Statistiques & Monitoring

### Taille de la base

```sql
SELECT 
    pg_size_pretty(pg_database_size('atlas_clean')) as db_size,
    pg_size_pretty(pg_total_relation_size('sondages')) as sondages_size,
    pg_size_pretty(pg_total_relation_size('echantillons')) as echantillons_size,
    pg_size_pretty(pg_total_relation_size('mailles_geotechnique_stats')) as mv_size;
```

### Dernières modifications

```sql
SELECT 
    schemaname, 
    tablename, 
    last_vacuum, 
    last_autovacuum, 
    last_analyze
FROM pg_stat_user_tables
WHERE schemaname = 'public'
ORDER BY last_analyze DESC NULLS LAST;
```

---

## 🔐 Sécurité & Backup

### Backup de atlas_clean

```bash
pg_dump -h localhost -U postgres -d atlas_clean \
  -Fc -f /backups/atlas_clean_$(date +%Y%m%d).dump
```

### Restaurer un backup

```bash
pg_restore -h localhost -U postgres -d atlas_clean_restore \
  --no-owner --no-privileges /backups/atlas_clean_20241024.dump
```

---

## 📞 Support

En cas de problème:

1. ✅ Vérifier les logs du script Python
2. ✅ Tester en mode `--dry-run`
3. ✅ Vérifier les contraintes de clés étrangères
4. ✅ Consulter les logs PostgreSQL: `/var/log/postgresql/`

---

## 🎓 Ressources

- [PostGIS Documentation](https://postgis.net/documentation/)
- [psycopg3 Documentation](https://www.psycopg.org/psycopg3/docs/)
- [Pandas Documentation](https://pandas.pydata.org/docs/)

---

**Dernière mise à jour:** 2024-10-24
