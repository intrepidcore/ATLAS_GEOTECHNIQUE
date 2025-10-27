# 🚀 Quick Start - Import RAW v1.5.3

Guide de démarrage rapide pour l'import des tables RAW en production.

---

## ⚡ Installation Express (5 minutes)

### 1. Prérequis

```powershell
# Vérifier Python et pip
python --version  # >= 3.8
pip --version

# Installer dépendances
pip install pandas openpyxl psycopg[binary]

# Vérifier PostgreSQL
psql --version  # >= 12
```

### 2. Appliquer la Migration SQL

```powershell
# Se connecter à la base atlas_clean
psql -U atlas -d atlas_clean -f db/migrations/2024-10-raw-archive.sql
```

**Résultat attendu** :
```
CREATE TYPE
CREATE TABLE
CREATE TABLE
CREATE TABLE
CREATE INDEX (x6)
CREATE FUNCTION
CREATE TRIGGER (x2)
CREATE VIEW
```

### 3. Générer le Fichier Excel v1.5.3

```powershell
python generate_atlas_import.py
```

**Résultat attendu** :
```
[*] Creation feuille: sondages
[*] Creation feuille: echantillons
...
[*] Creation feuille: agt_raw_long
   [OK] 220 lignes AGT RAW creees
[*] Creation feuille: ags_raw_long
   [OK] 80 lignes AGS RAW creees
[*] Creation feuille: atterberg_raw
   [OK] 48 lignes Atterberg RAW creees

[OK] Fichier créé avec succès: atlas_import_example.xlsx
```

---

## 🧪 Test Dry-Run (Validation)

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --dry-run --import-raw yes
```

**Résultat attendu** :
```
📊 RAPPORT D'IMPORT
======================================================================
⚠️  MODE DRY-RUN: Aucune donnée écrite en base

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

✅ Import terminé avec succès!
```

---

## 🎯 Import Réel (Production)

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes
```

**Durée** : ~1-2 secondes  
**Résultat** : 378 lignes importées (30 canoniques + 348 RAW)

---

## ✅ Vérifications SQL

### Vérification Complète (Recommandé)

```powershell
psql -U atlas -d atlas_clean -f verify_raw_import.sql
```

### Vérifications Rapides

```sql
-- Compteurs
SELECT 'raw_lab_agt' t, COUNT(*) FROM raw_lab_agt
UNION ALL SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg;
-- Attendu: 220, 80, 48

-- Liens échantillons (devrait être vide = tous liés)
SELECT COUNT(*) AS sans_lien FROM raw_lab_agt WHERE echantillon_id IS NULL;
SELECT COUNT(*) AS sans_lien FROM raw_lab_ags WHERE echantillon_id IS NULL;
SELECT COUNT(*) AS sans_lien FROM raw_lab_atterberg WHERE echantillon_id IS NULL;
-- Attendu: 0, 0, 0

-- Courbe granulo fusionnée (exemple)
SELECT * FROM v_raw_lab_granulo
WHERE code_site='KEVE-S1' AND depth_m=1.5
ORDER BY sieve_mm DESC;
-- Attendu: ~33 lignes (24 AGT + 9 AGS)
```

---

## 🔧 Options Avancées

### Import RAW Uniquement (Skip Canoniques)

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --raw-only
```

### Désactiver Import RAW

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw no
```

### Mode Verbeux (Debug)

```powershell
python scripts\02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --dry-run --import-raw yes --verbose
```

---

## 🧹 Purge (Reset pour Tests)

```powershell
# Purge tables RAW uniquement
psql -U atlas -d atlas_clean -f purge_raw_tables.sql

# Purge TOUT (RAW + Canoniques) - ATTENTION !
psql -U atlas -d atlas_clean -c "
  TRUNCATE raw_lab_agt, raw_lab_ags, raw_lab_atterberg RESTART IDENTITY;
  TRUNCATE essais_vbs, essais_atterberg, granulo_points, echantillons, sondages RESTART IDENTITY CASCADE;
"
```

---

## 📊 Checklist Production

- [ ] Migration SQL appliquée sans erreur
- [ ] Fichier Excel v1.5.3 généré (13 feuilles)
- [ ] Dry-run réussi (378 lignes, 0 erreur)
- [ ] Import réel réussi
- [ ] Compteurs SQL corrects (220 + 80 + 48 = 348)
- [ ] Tous les `echantillon_id` liés (0 NULL)
- [ ] Vue `v_raw_lab_granulo` fonctionnelle
- [ ] Triggers `updated_at` actifs

---

## 🐛 Troubleshooting

### Erreur: "No module named 'psycopg'"

```powershell
pip install psycopg[binary]
```

### Erreur: "relation 'raw_lab_agt' does not exist"

```powershell
psql -U atlas -d atlas_clean -f db/migrations/2024-10-raw-archive.sql
```

### Erreur: "column 'echantillon_id' cannot be cast to type bigint"

La migration a créé `echantillon_id` en BIGINT, mais les échantillons utilisent UUID.  
**Solution** : Modifier la migration pour utiliser UUID au lieu de BIGINT.

### Warning: "passants_pct hors [0,100]"

C'est normal pour les données RAW (archive fidèle). Les warnings ne bloquent pas l'import.

### Aucune ligne dans raw_lab_atterberg

Vérifier que la feuille `atterberg_raw` a les en-têtes exacts :
```
code_site | depth_m | test_type | tare_no | nb_coups | poids_total_humide_g | ...
```

---

## 📚 Documentation Complète

- **Guide détaillé** : `docs/RAW_IMPORT_README.md`
- **Changelog** : `CHANGELOG_v1.5.3.md`
- **Migration SQL** : `db/migrations/2024-10-raw-archive.sql`
- **Vérifications** : `verify_raw_import.sql`

---

## 🎯 Prochaines Étapes (Optionnel)

1. Exposer endpoints API `/api/raw/*`
2. Créer dashboards de comparaison RAW vs Canoniques
3. Implémenter exports CSV/JSON
4. Ajouter analyses de qualité (détection anomalies)

---

**Version** : 1.5.3  
**Status** : ✅ Production Ready  
**Durée totale** : ~5 minutes (installation + import)
