# ⚡ Quick Start - Import Géotechnique

Guide rapide pour cloner la base et importer vos données en **5 étapes**.

---

## 📋 Prérequis

```bash
# PostgreSQL client tools
pg_dump --version
psql --version

# Python 3.8+
python --version

# Dépendances Python
pip install pandas openpyxl psycopg[binary]
```

---

## 🚀 5 Étapes Rapides

### 1️⃣ Cloner la Base (5 min)

**Windows:**
```powershell
cd atlas\scripts
.\01_clone_database.ps1
```

**Linux/Mac:**
```bash
cd atlas/scripts
chmod +x 01_clone_database.sh
./01_clone_database.sh
```

✅ **Résultat:** Base `atlas_clean` créée avec schéma complet, tables géotech vides.

---

### 2️⃣ Pointer l'API (1 min)

Modifier `.env`:
```bash
DATABASE_URL=postgresql://user:pass@localhost:5432/atlas_clean
```

Redémarrer:
```bash
docker compose restart api
```

✅ **Vérifier:** UI affiche cartes, compteurs géotech à 0.

---

### 3️⃣ Préparer Excel (10-30 min)

Créer `mes_donnees.xlsx` avec 5 feuilles:

| Feuille | Colonnes Obligatoires | Exemple |
|---------|----------------------|---------|
| **sondages** | `code`, `lat`, `lon` | S001, 14.6937, -17.4441 |
| **echantillons** | `code`, `depth_m` | S001, 1.5 |
| **atterberg** | `code`, `depth_m` | S001, 1.5, 45.2, 22.1 |
| **vbs** | `code`, `depth_m`, `vbs` | S001, 1.5, 2.5 |
| **proctor** | `code`, `depth_m`, `gamma_d_max`, `w_opt` | S001, 1.5, 18.5, 12.5 |

📄 **Template complet:** `data/TEMPLATE_IMPORT_EXEMPLE.md`

---

### 4️⃣ Valider (Dry-Run) (1 min)

```bash
cd atlas/scripts

python 02_import_excel.py \
  --file ../data/mes_donnees.xlsx \
  --dsn "postgresql://user:pass@localhost:5432/atlas_clean" \
  --dry-run
```

✅ **Vérifier:** Rapport sans erreurs, compteurs corrects.

---

### 5️⃣ Importer (2-10 min)

```bash
python 02_import_excel.py \
  --file ../data/mes_donnees.xlsx \
  --dsn "postgresql://user:pass@localhost:5432/atlas_clean"
```

✅ **Résultat:** Données importées, vue matérialisée rafraîchie.

---

## ✅ Vérifications Post-Import

### Dans PostgreSQL

```sql
-- Compteurs
SELECT 'sondages' as table, COUNT(*) FROM sondages
UNION ALL SELECT 'echantillons', COUNT(*) FROM echantillons
UNION ALL SELECT 'atterberg', COUNT(*) FROM essais_atterberg
UNION ALL SELECT 'vbs', COUNT(*) FROM essais_vbs
UNION ALL SELECT 'proctor', COUNT(*) FROM essais_proctor;

-- Vue matérialisée
SELECT 
    COUNT(*) as mailles_total,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages
FROM mailles_geotechnique_stats;
```

### Dans l'UI

- ✅ Carte des sondages affichée
- ✅ Cartes thématiques (WL, VBS, etc.) avec couleurs
- ✅ Statistiques par maille
- ✅ Filtres fonctionnels

---

## 🎯 Exemple Complet (Ligne de Commande)

```bash
# 1. Clone
cd atlas/scripts
./01_clone_database.sh

# 2. Config API
echo "DATABASE_URL=postgresql://atlas:password@localhost:5432/atlas_clean" > ../.env
docker compose restart api

# 3. Préparer données (Excel)
# ... créer mes_donnees.xlsx ...

# 4. Dry-run
python 02_import_excel.py --file ../data/mes_donnees.xlsx --dsn "postgresql://atlas:password@localhost:5432/atlas_clean" --dry-run

# 5. Import
python 02_import_excel.py --file ../data/mes_donnees.xlsx --dsn "postgresql://atlas:password@localhost:5432/atlas_clean"

# 6. Vérifier
psql -d atlas_clean -c "SELECT COUNT(*) FROM sondages;"
```

---

## 🐛 Dépannage Rapide

| Problème | Solution |
|----------|----------|
| **"Module pandas not found"** | `pip install pandas openpyxl psycopg[binary]` |
| **"Sondage introuvable"** | Vérifier ordre: sondages → échantillons → essais |
| **"Coordonnées invalides"** | Vérifier lat ∈ [-90,90], lon ∈ [-180,180] (WGS84) |
| **"Extension PostGIS"** | `psql -d atlas_clean -c "CREATE EXTENSION postgis;"` |
| **Import lent** | Utiliser `--verbose` pour voir progression |

---

## 📚 Documentation Complète

- **Guide détaillé:** `GUIDE_IMPORT_GEOTECH.md`
- **Scripts:** `scripts/README.md`
- **Template Excel:** `data/TEMPLATE_IMPORT_EXEMPLE.md`

---

## 🔄 Workflow Visuel

```
┌─────────────────┐
│  Base Prod      │
│  (atlas_prod)   │
└────────┬────────┘
         │ 01_clone_database
         ▼
┌─────────────────┐
│  Base Clean     │
│  (atlas_clean)  │◄─── Pointer API
└────────┬────────┘
         │
         │ Préparer Excel
         │
         ▼
┌─────────────────┐
│  mes_donnees    │
│     .xlsx       │
└────────┬────────┘
         │ 02_import_excel --dry-run
         │
         ▼
┌─────────────────┐
│  Validation     │
│  (rapport)      │
└────────┬────────┘
         │ OK ?
         ▼
┌─────────────────┐
│  Import Réel    │
│  (UPSERT)       │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│  Refresh MV     │
│  Vérifications  │
└─────────────────┘
```

---

## 💡 Astuces

### Variable d'Environnement

```bash
# Définir une fois
export DATABASE_URL="postgresql://user:pass@localhost:5432/atlas_clean"

# Utiliser partout
python 02_import_excel.py --file data.xlsx
psql $DATABASE_URL -c "SELECT COUNT(*) FROM sondages;"
```

### Import Incrémental

Le script est **idempotent** → vous pouvez:
- Ajouter de nouveaux sondages
- Mettre à jour des données existantes
- Relancer sans risque de doublons

```bash
# Import initial
python 02_import_excel.py --file batch1.xlsx --dsn "..."

# Ajout de nouvelles données (plus tard)
python 02_import_excel.py --file batch2.xlsx --dsn "..."
```

### Backup Avant Import

```bash
# Backup
pg_dump -Fc atlas_clean > backup_avant_import.dump

# Import
python 02_import_excel.py --file data.xlsx --dsn "..."

# Restaurer si problème
pg_restore -d atlas_clean backup_avant_import.dump
```

---

## 📊 Rapport d'Import Exemple

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

## 🎓 Prochaines Étapes

Après import réussi:

1. **Analyser les données**
   - Cartes thématiques
   - Statistiques par région
   - Identification zones à risque

2. **Exporter des rapports**
   - PDF par sondage
   - Synthèses par maille
   - Cartes pour présentations

3. **Intégrer nouveaux sondages**
   - Import incrémental
   - Mise à jour continue

---

**Temps total estimé:** 20-45 minutes (selon volume de données)

**Besoin d'aide ?** Consultez `GUIDE_IMPORT_GEOTECH.md` 📘
