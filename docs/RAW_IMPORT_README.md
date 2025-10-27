# Guide d'Import des Données RAW - Atlas Géotechnique v1.5.3

## 📋 Vue d'ensemble

Ce guide explique comment importer les **données RAW** (archives fidèles des mesures laboratoire) dans la base PostgreSQL `atlas_clean`.

### Nouveautés v1.5.3

- ✅ **3 nouvelles tables RAW** : `raw_lab_agt`, `raw_lab_ags`, `raw_lab_atterberg`
- ✅ **3 nouvelles feuilles Excel** : `agt_raw_long`, `ags_raw_long`, `atterberg_raw`
- ✅ **Import intégré** dans `02_import_excel.py` (pas de script séparé)
- ✅ **Rétro-compatible** : si les feuilles RAW sont absentes, l'import continue normalement

---

## 🗂️ Structure des Feuilles RAW

### 1. `agt_raw_long` - Analyse Granulométrique par Tamisage

**Colonnes obligatoires** :
```
code_site | depth_m | sieve_mm | mass_refus_cum_g | refus_cum_pct | passants_pct
```

**Exemple** :
```
KEVE-S1 | 1.5 | 16.0  | 0.0   | 0.00  | 100.00
KEVE-S1 | 1.5 | 12.5  | 11.1  | 0.41  | 99.59
KEVE-S1 | 1.5 | 10.0  | 41.7  | 1.55  | 98.45
```

**Contraintes** :
- `code_site` : doit exister dans la feuille `sondages`
- `depth_m` : nombre ≥ 0
- `sieve_mm` : nombre > 0
- `passants_pct` : [0, 100] (warnings si hors bornes, mais pas de blocage)

---

### 2. `ags_raw_long` - Analyse Granulométrique par Sédimentométrie

**Colonnes obligatoires** :
```
code_site | depth_m | sieve_mm | passants_pct
```

**Exemple** :
```
KEVE-S1 | 1.5 | 0.0703 | 57.42
KEVE-S1 | 1.5 | 0.0499 | 57.32
KEVE-S1 | 1.5 | 0.0354 | 53.31
```

**Contraintes** :
- Mêmes que AGT, mais sans colonnes de masse/refus

---

### 3. `atterberg_raw` - Essais Atterberg Détaillés

**Colonnes obligatoires** :
```
code_site | depth_m | test_type | tare_no | nb_coups | poids_total_humide_g | 
poids_total_sec_g | poids_tare_g | poids_eau_g | poids_sol_sec_g | teneur_eau_pct
```

**Exemple** :
```
KEVE-S1 | 1.0 | PL | 1 | NULL | 13.28 | 12.83 | 10.85 | 0.45 | 1.98 | 22.73
KEVE-S1 | 1.0 | LL | 1 | 12.1 | 55.04 | 48.55 | 33.90 | 6.49 | 14.65 | 44.30
```

**Contraintes** :
- `test_type` : `LL` (Limite de Liquidité) ou `PL` (Limite de Plasticité)
- `nb_coups` : obligatoire pour LL, NULL pour PL
- Toutes les masses en grammes, teneur_eau en %

---

## 🚀 Commandes d'Import

### 1️⃣ Dry-Run (Recommandé en premier)

Valide les données **sans écrire** en base :

```powershell
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --dry-run --import-raw yes
```

**Sortie attendue** :
```
📊 RAPPORT D'IMPORT
======================================================================
Mode DRY-RUN: Aucune donnée écrite en base

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
TOTAL                              348      0
```

---

### 2️⃣ Import Réel

Une fois le dry-run validé :

```powershell
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes
```

---

### 3️⃣ Import RAW Uniquement (Skip canoniques)

Si vous voulez **seulement** mettre à jour les tables RAW :

```powershell
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --raw-only
```

---

### 4️⃣ Désactiver l'Import RAW

Pour importer **sans** les tables RAW (comportement v1.5.2) :

```powershell
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw no
```

---

## 🔍 Vérifications SQL

### Compteurs de lignes

```sql
-- Vérifier que les données RAW sont bien importées
SELECT 
  'raw_lab_agt' AS table_name, COUNT(*) AS nb_lignes FROM raw_lab_agt
UNION ALL
SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL
SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg;
```

**Résultat attendu** :
```
table_name          | nb_lignes
--------------------+-----------
raw_lab_agt         | 220
raw_lab_ags         | 80
raw_lab_atterberg   | 48
```

---

### Vérifier les liens échantillons

```sql
-- Compter les lignes sans lien vers echantillons
SELECT 
  'AGT' AS table_name, 
  COUNT(*) FILTER (WHERE echantillon_id IS NULL) AS sans_lien,
  COUNT(*) AS total
FROM raw_lab_agt
UNION ALL
SELECT 'AGS', 
  COUNT(*) FILTER (WHERE echantillon_id IS NULL),
  COUNT(*)
FROM raw_lab_ags
UNION ALL
SELECT 'Atterberg', 
  COUNT(*) FILTER (WHERE echantillon_id IS NULL),
  COUNT(*)
FROM raw_lab_atterberg;
```

**Résultat attendu** : `sans_lien = 0` pour toutes les tables (après rétro-liaison).

---

### Inspecter une courbe granulo complète (AGT + AGS)

```sql
-- Vue fusionnée pour KEVE-S1 @ 1.5m
SELECT * 
FROM v_raw_lab_granulo
WHERE code_site = 'KEVE-S1' 
  AND depth_m = 1.5
ORDER BY sieve_mm DESC;
```

**Résultat attendu** : ~33 lignes (24 AGT + 9 AGS).

---

### Vérifier les mesures Atterberg détaillées

```sql
-- Toutes les mesures LL/PL pour KEVE-S1 @ 1m
SELECT 
  code_site, 
  depth_m, 
  test_type, 
  tare_no, 
  nb_coups, 
  teneur_eau_pct
FROM raw_lab_atterberg
WHERE code_site = 'KEVE-S1' 
  AND depth_m = 1.0
ORDER BY test_type, tare_no;
```

**Résultat attendu** : 6 lignes (2 PL + 4 LL).

---

## 🧪 Tests UI (Optionnel)

Si vous avez exposé des endpoints API pour les données RAW :

```bash
# Health check
curl -s http://localhost:8080/api/health | jq .

# Récupérer AGT RAW pour un échantillon
curl -s "http://localhost:8080/api/raw/agt?code_site=KEVE-S1&depth_m=1.5" | jq .

# Récupérer AGS RAW
curl -s "http://localhost:8080/api/raw/ags?code_site=KEVE-S1&depth_m=1.5" | jq .

# Récupérer Atterberg RAW
curl -s "http://localhost:8080/api/raw/atterberg?code_site=KEVE-S1&depth_m=1.0" | jq .
```

---

## ⚠️ Points d'Attention

### 1. Fidélité des Données RAW

Les tables RAW sont des **archives fidèles** :
- ❌ **Pas de correction** de monotonicité
- ❌ **Pas de suppression** de valeurs aberrantes
- ✅ **Conservation** des anomalies/bruit de mesure
- ✅ **Warnings** si % > 100, mais pas de blocage

### 2. Différence avec les Tables Canoniques

| Aspect | Tables RAW | Tables Canoniques (granulo_points) |
|--------|------------|-----------------------------------|
| **Format** | Long (1 ligne = 1 mesure) | Normalisé |
| **Corrections** | Aucune | Monotonicité, clamping |
| **Usage** | Archive, audit, traçabilité | API, cartes, analyses |
| **Feuilles Excel** | `*_raw_long`, `atterberg_raw` | `granulo_*_large`, `atterberg` |

### 3. Ordre d'Import

L'importeur respecte cet ordre :
1. **Sondages** → 2. **Échantillons** → 3. **Essais canoniques** (atterberg, vbs, granulo) →  
4. **Tables RAW** → 5. **Rétro-liaison** (mise à jour `echantillon_id`)

### 4. Idempotence

- **AGT/AGS** : UPSERT sur `(code_site, depth_m, sieve_mm)` → re-lancer l'import met à jour les valeurs
- **Atterberg RAW** : INSERT simple (pas d'UPSERT) → multiples mesures par test autorisées

---

## 📊 Exemple de Workflow Complet

```powershell
# 1. Appliquer la migration SQL (si pas déjà fait)
psql -U atlas -d atlas_clean -f db/migrations/2024-10-raw-archive.sql

# 2. Générer le fichier Excel avec données RAW
python generate_atlas_import.py

# 3. Dry-run pour valider
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --dry-run --import-raw yes

# 4. Import réel
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes

# 5. Vérifications SQL
psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FROM raw_lab_agt;"
psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FROM raw_lab_ags;"
psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FROM raw_lab_atterberg;"

# 6. Inspecter une courbe
psql -U atlas -d atlas_clean -c "
  SELECT * FROM v_raw_lab_granulo 
  WHERE code_site='KEVE-S1' AND depth_m=1.5 
  ORDER BY sieve_mm DESC;
"
```

---

## 🐛 Dépannage

### Erreur : "Feuille 'agt_raw_long' absente"

**Cause** : Fichier Excel généré avec une version < 1.5.3.

**Solution** : Régénérer le fichier :
```powershell
python generate_atlas_import.py
```

---

### Erreur : "Column 'echantillon_id' does not exist"

**Cause** : Migration SQL non appliquée.

**Solution** :
```powershell
psql -U atlas -d atlas_clean -f db/migrations/2024-10-raw-archive.sql
```

---

### Warning : "passants_pct > 100"

**Cause** : Valeur aberrante dans les données brutes.

**Action** : C'est un **warning**, pas une erreur. Les données sont archivées telles quelles. Vérifier la source si nécessaire.

---

### Aucune ligne dans `raw_lab_atterberg`

**Cause** : Feuille `atterberg_raw` vide ou mal formatée.

**Solution** : Vérifier que les en-têtes sont **exactement** :
```
code_site | depth_m | test_type | tare_no | nb_coups | poids_total_humide_g | ...
```

---

## 📚 Références

- **Migration SQL** : `db/migrations/2024-10-raw-archive.sql`
- **Script d'import** : `scripts/02_import_excel.py`
- **Générateur Excel** : `generate_atlas_import.py`
- **Schéma des tables** : Voir commentaires dans la migration SQL

---

## ✅ Checklist de Validation

- [ ] Migration SQL appliquée
- [ ] Fichier Excel généré avec v1.5.3
- [ ] Dry-run réussi sans erreurs
- [ ] Import réel réussi
- [ ] Compteurs SQL corrects (220 AGT, 80 AGS, 48 Atterberg)
- [ ] Tous les `echantillon_id` remplis (pas de NULL)
- [ ] Vue `v_raw_lab_granulo` fonctionnelle

---

**Version** : 1.5.3  
**Date** : 2025-10-24  
**Auteur** : Atlas Géotechnique Team
