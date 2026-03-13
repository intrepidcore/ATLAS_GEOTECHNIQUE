# Récupération des données géotechniques manquantes (audit incrémental)

## 1) Objectif

- Identifier **où** se trouvent (dans le repo) les données géotechniques manquantes observées en base.
- Qualifier chaque source en:
  - **Récupérable** (réimport direct, clés de jointure présentes)
  - **Récupérable sous conditions** (transformation nécessaire / mapping partiel)
  - **Non récupérable** (absence de clés, ambiguïtés irréconciliables)
- Proposer une procédure **incrémentale, reproductible**, avec validations, et sans action destructive non maîtrisée.

## 2) Constat DB (atlas_clean / schéma `atlas`)

### 2.1 Tables & volumes (constats principaux)

- `atlas.sondages`: 123 (dont géocodés 114)
- `atlas.echantillons`: 327
- `atlas.essais_atterberg`: 312
- `atlas.essais_vbs`: 535
- `atlas.granulo_points`: 1366
- `atlas.essais_potentiel_gonflement`: 228
- `atlas.essais_classif`: 250
- `atlas.essais_physiques`: 42
- **`atlas.essais_proctor`: 0**  ← manque critique
- `atlas.essais_geotechniques`: 0 (table agrégée/historique, pas alimentée dans cet état)

### 2.2 Implication

Les thématiques **Proctor** (`gamma_d_max`, `w_opt`) et tout calcul basé sur ces champs ne peuvent pas être produits.

## 3) Audit Excel “complétude localités” (résultat)

Un export d’audit a été généré (non versionné):

- `exports/audit_geotech_localites_matrix.xlsx`
  - `matrix_option1`: matrice minimaliste des flags (format type `thematic_maille_matrix_fixed.xlsx`)
  - `audit_option2`: version enrichie + `no_data_*` + stats géocodage
  - `missing_matrix`
  - `sondages`

## 4) Inventaire des sources dans le repo (focus Proctor)

### 4.1 Templates / spécifications (format attendu)

- `data/TEMPLATE_IMPORT_EXEMPLE.md`
  - Définit une feuille `proctor` attendue:
    - `code,depth_m,gamma_d_max,w_opt,proctor_type`
- `docs/SPECIFICATION_XLSX_IMPORT_COMPLET.md`
  - Confirme le modèle attendu (et clés):
    - Proctor: clé `(echantillon_id, proctor_type)`
    - Résolution via `(code_site, depth_m)`

### 4.2 Chaîne d’import existante (logiciel)

#### A) Import Python “XLSX → DB”

- `scripts/02_import_excel.py`
  - Contient `import_proctor()` et sait écrire dans `essais_proctor`.
  - Condition de réimport **stricte**:
    - Il faut des lignes avec `code_site` (ou `code`) + `depth_m` + `gamma_d_max` + `w_opt`.
    - Le tuple `(code_site, depth_m)` doit correspondre à un `echantillon_id` existant.

#### B) Pipeline “reimport_work” (Excel master → CSV → SQL)

- `reimport_work/atlas_import.xlsx`
  - Contient une sheet `public.essais_proctor` mais **0 lignes**.
- `reimport_work/csv_ready/essais_proctor.csv`
  - **Uniquement en-tête** (aucune donnée).
- `reimport_work/import_remaining_tables.sql`
  - A une étape `ESSAIS_PROCTOR` qui fait un `\copy /tmp/csv/essais_proctor.csv` → insert.
  - Mais puisque le CSV est vide, l’import ne peut pas remplir `essais_proctor`.

### 4.3 Données Proctor présentes dans `data/`

#### 4.3.1 Sources “matériaux” (non rattachées à sondage/échantillon)

- `data/xlsx/NABIYOU Warou.xlsx` (sheet: `Récap Proctor`)
  - Colonnes: `Matériaux`, `Gamma d`, `Wopt (%)`
  - **Pas de `code_site`, pas de `depth_m`**.
- `data/xlsx/TCHALA Komla Hyacinthe.xlsx`
  - Plusieurs sheets Proctor (optimum / essais / mélange)
  - Données au niveau **matériau** (ex: “Concassé de granite”, “Latérite améliorée...”) sans clé `code_site@depth_m`.

➡️ **Conclusion**: ces sources sont exploitables pour un référentiel “matériaux”, mais ne sont pas directement importables dans `atlas.essais_proctor` (modèle actuel).

#### 4.3.2 Sources “converties” `data/xlsx_convert/*/Sheet_1.csv`

- Exemples:
  - `data/xlsx_convert/GAMBAGA Inoussa/Sheet_1.csv`
  - `data/xlsx_convert/NABIYOU Warou/Sheet_1.csv`

Ces CSV contiennent des champs Proctor (`gamma_d_max`, `w_opt`, `proctor_type`) **mais**:
- la colonne `code` est vide / blanche sur les lignes porteuses de données.

➡️ **Conclusion**: données Proctor présentes, mais **non joignables** à un sondage/échantillon sans règle de mapping supplémentaire.

#### 4.3.3 Les fichiers `data/xlsx/RAW/atlas_import_*.xlsx`

- Ces fichiers ont une sheet `proctor` (format canonique), mais elle est **vide**.
- Cause identifiée:
  - `scripts/canonize_xlsx_to_atlas_import.py` crée la feuille `proctor` mais ne parse pas/ajoute les données Proctor.

➡️ **Conclusion**: le pipeline de canonisation a “perdu” Proctor par conception.

## 5) Récupérabilité (classification)

### 5.1 Récupérable immédiatement

- **Aucune source Proctor** trouvée dans le repo au format joignable `code_site + depth_m` pour les sondages existants.

### 5.2 Récupérable sous conditions

#### Option R1: récupérer Proctor au niveau “matériau” (changement de modèle)

- Créer une structure dédiée (ex: table `proctor_materiaux` ou attributs “matériau” non liés à sondages).
- Avantage:
  - exploite des données déjà présentes (TCHALA/NABIYOU)
- Inconvénient:
  - **ne répond pas** au besoin “par localité / par sondage / par profondeur”
  - implique évolution modèle + UI/API

#### Option R2: reconstruire une clé `code_site, depth_m` (règles métier à définir)

- On pourrait tenter un mapping en utilisant:
  - `source` (nom étudiant) + localités / campagnes,
  - et supposer que les lignes de `Sheet_1.csv` se rapportent à un sondage spécifique.
- Mais aujourd’hui, sans un identifiant stable (code) dans ces CSV, le mapping serait **heuristique** (risque de dette technique / erreurs).

### 5.3 Non récupérable (dans l’état actuel du repo)

- Importer Proctor dans `atlas.essais_proctor` **sans** `code_site@depth_m` est non fiable.
- Les feuilles Proctor “matériaux” ne permettent pas d’assigner une profondeur/sondage.

## 6) Plan incrémental recommandé

### Étape 0 — Sécurité

- Conserver le dump DB:
  - `backup/atlas_clean_20260303_115242.dump`

### Étape 1 — Prouver la récupérabilité Proctor (objectif: trouver une source joignable)

1. Chercher dans `data/xlsx/IMPORT/` et autres répertoires si un fichier “atlas_import” contient:
   - `proctor` non vide
   - et colonnes `code_site, depth_m, gamma_d_max, w_opt`
2. Chercher hors `data/`:
   - `sql/import_amessefe_full.sql` / `sql/imports_projects/*.sql`
   - exports historiques (si présents dans le workspace)

**Critère de succès**: obtenir un dataset Proctor avec `code_site` correspondant à `atlas.sondages.code` et `depth_m` correspondant à `atlas.echantillons.depth_m`.

### Étape 2 — Réimport Proctor (si source joignable trouvée)

- Générer un classeur `atlas_import_proctor_patch.xlsx` minimal avec:
  - `sondages` (facultatif si déjà en base)
  - `echantillons` (facultatif si déjà en base)
  - `proctor` rempli

- Lancer:
  - `python scripts/02_import_excel.py --file <...> --dsn <...> --dry-run` (validation)
  - puis sans `--dry-run`

### Étape 3 — Vérifications post-réinsertion

- Comptage:
  - `SELECT COUNT(*) FROM atlas.essais_proctor;`
- Recalcul/refresh si nécessaire:
  - vérifier triggers `sync_to_essais_geotechniques` (si activés)
  - rafraîchir les vues matérialisées si le pipeline l’exige

### Étape 4 — Si aucune source joignable n’existe (décision produit)

Choisir entre:
- (D1) accepter que Proctor n’existe pas (désactiver thématiques Proctor)
- (D2) introduire un modèle “matériaux” (sans localisation)
- (D3) relancer une collecte / saisie Proctor structurée (par sondage/profondeur)

## 7) Décisions propres (anti-dette technique)

- Ne pas “inventer” des `depth_m` ou des associations sondage↔Proctor sans règle métier validée.
- Ne pas insérer des Proctor “matériaux” dans `essais_proctor` si l’UI/cartographie l’interprète comme des résultats localisés.
- Privilégier des imports **idempotents** (`02_import_excel.py`) et des validations systématiques (dry-run, contrôles FK).

---

## Annexe A — Cause racine probable de la perte Proctor

- `scripts/canonize_xlsx_to_atlas_import.py`:
  - parse granulo/atterberg/vbs
  - crée la feuille `proctor` **mais ne la remplit jamais**

Conséquence:
- Les fichiers `data/xlsx/RAW/atlas_import_*.xlsx` ont `proctor` vide
- Les pipelines basés sur ces fichiers n’importent jamais Proctor

---

## Annexe B — Éléments à investiguer ensuite (au-delà de Proctor)

- Vérifier si d’autres types existent sous forme “matériaux” (ex: densité apparente) et s’ils doivent être modélisés.
- Vérifier la cohérence unités:
  - `gamma_d_max` attendu en kN/m³ (10–30)
  - certaines sources semblent en g/cm³ (≈ 2.1) → nécessite conversion avant import.
