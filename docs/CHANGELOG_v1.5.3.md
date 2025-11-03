# Changelog v1.5.3 - Tables RAW Archive

**Date**: 2025-10-24  
**Version**: 1.5.3  
**Type**: Feature - Archive RAW des mesures laboratoire

---

## 🎯 Objectif

Ajouter des tables d'archivage **RAW** (fidèles aux mesures brutes) pour :
- Analyse Granulométrique par Tamisage (AGT)
- Analyse Granulométrique par Sédimentométrie (AGS)
- Essais Atterberg détaillés (par tare et nombre de coups)

**Principe** : Les tables RAW conservent les données **sans correction** (pas de monotonicité, pas de clamping), contrairement aux tables canoniques utilisées par l'API.

---

## 📦 Fichiers Modifiés/Créés

### Nouveaux Fichiers

1. **`db/migrations/2024-10-raw-archive.sql`** (164 lignes)
   - Création des 3 tables RAW
   - Type ENUM `atterberg_test_type` (LL/PL)
   - Index de performance
   - Vue fusionnée `v_raw_lab_granulo` (AGT + AGS)
   - Triggers `updated_at`

2. **`atterberg_raw_data.py`** (60 lignes)
   - Données Atterberg détaillées (48 mesures)
   - Importé par `generate_atlas_import.py`

3. **`docs/RAW_IMPORT_README.md`** (400+ lignes)
   - Guide complet d'utilisation
   - Commandes dry-run/import
   - Vérifications SQL
   - Troubleshooting

4. **`scripts/02_import_excel_RAW_EXTENSION.py`** (350+ lignes)
   - Code de référence pour les méthodes RAW
   - Instructions d'intégration

5. **`test_import_raw.ps1`** (100+ lignes)
   - Script de test automatisé
   - Vérifications pré-import
   - Dry-run + import réel interactif

6. **`CHANGELOG_v1.5.3.md`** (ce fichier)

### Fichiers Modifiés

1. **`generate_atlas_import.py`** (+380 lignes)
   - Import de `atterberg_raw_data`
   - Feuille 11: `agt_raw_long` (220 lignes de données)
   - Feuille 12: `ags_raw_long` (80 lignes)
   - Feuille 13: `atterberg_raw` (48 lignes)
   - Mise à jour du rapport de génération

2. **`scripts/02_import_excel.py`** (+290 lignes)
   - 3 nouvelles méthodes d'import RAW
   - Méthode `link_raw_to_echantillons()` (rétro-liaison)
   - Flags CLI : `--import-raw yes|no`, `--raw-only`
   - Orchestration dans `main()`
   - Rapport étendu

---

## 🗄️ Schéma des Tables RAW

### `raw_lab_agt` - Tamisage

```sql
CREATE TABLE raw_lab_agt (
  id                BIGSERIAL PRIMARY KEY,
  code_site         TEXT NOT NULL,
  depth_m           NUMERIC(5,2) NOT NULL,
  sieve_mm          NUMERIC(10,4) NOT NULL,
  mass_refus_cum_g  NUMERIC(14,3),
  refus_cum_pct     NUMERIC(7,3),
  passants_pct      NUMERIC(7,3),
  echantillon_id    BIGINT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code_site, depth_m, sieve_mm)
);
```

**Contrainte unique** : `(code_site, depth_m, sieve_mm)` → UPSERT possible

---

### `raw_lab_ags` - Sédimentométrie

```sql
CREATE TABLE raw_lab_ags (
  id                BIGSERIAL PRIMARY KEY,
  code_site         TEXT NOT NULL,
  depth_m           NUMERIC(5,2) NOT NULL,
  sieve_mm          NUMERIC(10,4) NOT NULL,
  passants_pct      NUMERIC(7,3) NOT NULL,
  echantillon_id    BIGINT,
  created_at        TIMESTAMPTZ DEFAULT now(),
  updated_at        TIMESTAMPTZ DEFAULT now(),
  UNIQUE (code_site, depth_m, sieve_mm)
);
```

**Contrainte unique** : `(code_site, depth_m, sieve_mm)` → UPSERT possible

---

### `raw_lab_atterberg` - Atterberg Détaillé

```sql
CREATE TABLE raw_lab_atterberg (
  id                   BIGSERIAL PRIMARY KEY,
  code_site            TEXT NOT NULL,
  depth_m              NUMERIC(5,2) NOT NULL,
  test_type            atterberg_test_type NOT NULL,  -- 'LL' ou 'PL'
  tare_no              INT,
  nb_coups             NUMERIC(6,2),
  poids_total_humide_g NUMERIC(10,2),
  poids_total_sec_g    NUMERIC(10,2),
  poids_tare_g         NUMERIC(10,2),
  poids_eau_g          NUMERIC(10,2),
  poids_sol_sec_g      NUMERIC(10,2),
  teneur_eau_pct       NUMERIC(7,3),
  echantillon_id       BIGINT,
  created_at           TIMESTAMPTZ DEFAULT now()
);
```

**Pas de contrainte unique** → Multiples mesures par test autorisées (INSERT simple)

---

## 📊 Données Importées (Exemple)

| Table | Nb Lignes | Sites | Profondeurs |
|-------|-----------|-------|-------------|
| `raw_lab_agt` | 220 | KEVE-S1, ASSA-S1, BADJA-S1 | 1m, 1.5m, 2m |
| `raw_lab_ags` | 80 | KEVE-S1, ASSA-S1, BADJA-S1 | 1m, 1.5m, 2m |
| `raw_lab_atterberg` | 48 | KEVE-S1, ASSA-S1, BADJA-S1 | 1m, 1.5m, 2m |
| **TOTAL** | **348** | **3 sites** | **9 échantillons** |

---

## 🚀 Utilisation

### 1. Appliquer la Migration SQL

```powershell
psql -U atlas -d atlas_clean -f db/migrations/2024-10-raw-archive.sql
```

### 2. Générer le Fichier Excel v1.5.3

```powershell
python generate_atlas_import.py
```

**Résultat** : `atlas_import_example.xlsx` avec 13 feuilles (10 canoniques + 3 RAW)

### 3. Import Dry-Run

```powershell
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --dry-run --import-raw yes
```

### 4. Import Réel

```powershell
python scripts/02_import_excel.py `
  --file atlas_import_example.xlsx `
  --dsn "postgresql://atlas:atlas@localhost:5432/atlas_clean" `
  --import-raw yes
```

### 5. Vérifications SQL

```sql
-- Compteurs
SELECT 'raw_lab_agt' AS table_name, COUNT(*) FROM raw_lab_agt
UNION ALL
SELECT 'raw_lab_ags', COUNT(*) FROM raw_lab_ags
UNION ALL
SELECT 'raw_lab_atterberg', COUNT(*) FROM raw_lab_atterberg;

-- Courbe granulo complète (AGT + AGS)
SELECT * FROM v_raw_lab_granulo
WHERE code_site = 'KEVE-S1' AND depth_m = 1.5
ORDER BY sieve_mm DESC;
```

---

## 🔧 Nouvelles Options CLI

### `--import-raw yes|no`

Contrôle l'import des tables RAW (défaut: `yes`)

```powershell
# Importer SANS les tables RAW (comportement v1.5.2)
python scripts/02_import_excel.py --file data.xlsx --dsn "..." --import-raw no
```

### `--raw-only`

Importer **UNIQUEMENT** les tables RAW (skip canoniques)

```powershell
python scripts/02_import_excel.py --file data.xlsx --dsn "..." --raw-only
```

---

## ✅ Compatibilité Ascendante

- ✅ Si les feuilles RAW sont **absentes** du fichier Excel → import continue normalement
- ✅ Fichiers Excel v1.5.2 et antérieurs → 100% compatibles
- ✅ Flag `--import-raw no` → désactive complètement l'import RAW
- ✅ Pas de modification des tables canoniques existantes

---

## 🧪 Tests Effectués

1. ✅ Génération Excel avec 348 lignes RAW
2. ✅ Migration SQL appliquée sans erreur
3. ✅ Dry-run réussi (validation sans écriture)
4. ✅ Import réel réussi
5. ✅ Rétro-liaison `echantillon_id` fonctionnelle
6. ✅ Vue `v_raw_lab_granulo` opérationnelle
7. ✅ Triggers `updated_at` actifs

---

## 📝 Notes Techniques

### Différences RAW vs Canoniques

| Aspect | Tables RAW | Tables Canoniques |
|--------|------------|-------------------|
| **Corrections** | Aucune | Monotonicité, clamping |
| **Format** | Long (1 ligne = 1 mesure) | Wide ou normalisé |
| **Objectif** | Archive, audit, traçabilité | API, cartes, analyses |
| **Warnings** | Acceptés (% > 100) | Bloquants |

### Ordre d'Import

1. Sondages
2. Échantillons
3. Essais canoniques (atterberg, vbs, proctor, granulo)
4. **Tables RAW** (si `--import-raw yes`)
5. **Rétro-liaison** (mise à jour `echantillon_id`)

### Idempotence

- **AGT/AGS** : UPSERT sur `(code_site, depth_m, sieve_mm)` → re-import met à jour
- **Atterberg RAW** : INSERT simple → multiples mesures autorisées

---

## 🐛 Problèmes Connus

Aucun problème connu à ce jour.

---

## 📚 Documentation

- **Guide complet** : `docs/RAW_IMPORT_README.md`
- **Migration SQL** : `db/migrations/2024-10-raw-archive.sql`
- **Script de test** : `test_import_raw.ps1`

---

## 👥 Contributeurs

- **Équipe Atlas Géotechnique**
- **Date de release** : 2025-10-24

---

## 🔜 Prochaines Étapes (Optionnel)

1. Exposer des endpoints API pour les données RAW
2. Créer des vues/graphiques de comparaison RAW vs Canoniques
3. Ajouter des exports CSV/JSON des tables RAW
4. Implémenter des analyses de qualité (détection d'anomalies)

---

**Version** : 1.5.3  
**Status** : ✅ Production Ready  
**Breaking Changes** : Aucun
