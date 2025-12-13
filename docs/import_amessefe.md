# Import AMESSEFE - Documentation du workflow

## Contexte

Source de données : **AMESSEFE Komi Yoan Freddy**  
Opérateur : **Serge TABE DJATO**  
Profondeurs standard : **1.0m, 1.5m, 2.0m**

---

## Spécification fonctionnelle de l'import

> Cette section définit ce que signifie "import conforme aux Excel d'origine".
> C'est la **référence** pour valider que l'import est correct.

### Fichiers sources

Les fichiers Excel bruts sont stockés dans `data/xlsx/amessefe_raw/` (NE JAMAIS MODIFIER).

| Fichier | Feuilles | Format |
|---------|----------|--------|
| `bleu.xlsx` | 6 feuilles (3-7 à 3-12) | Pivot : colonnes = profondeurs (1, 1.5, 2) |
| `limite.xlsx` | 6 feuilles (3-13 à 3-18) | Tabulaire : 1 ligne = 1 essai |
| `Granulométrie.xlsx` | 6 feuilles (3.1 à 3.6) | Pivot : colonnes = profondeurs |
| `classification.xlsx` | 6 feuilles (3-25 à 3-30) | Tabulaire : 1 ligne = 1 essai |
| `potentielle_de_gonflement.xlsx` | 6 feuilles (3-19 à 3-24) | Pivot : colonnes = profondeurs |

### Règles d'import par type d'essai

#### VBS (`bleu.xlsx` → `atlas.essais_vbs`)

**Structure Excel :** Format pivot
- Colonne `Localités` : nom de la localité
- Colonnes `1`, `1.5`, `2` : valeurs VBS aux profondeurs 1.0m, 1.5m, 2.0m

**Règle d'import :**
Pour chaque localité L et chaque profondeur d ∈ {1.0, 1.5, 2.0} :
- Si la cellule Excel[L, d] n'est pas vide →
  - Il doit exister **exactement 1 ligne** dans `atlas.essais_vbs` avec :
    - `echantillon_id` lié à un échantillon où :
      - `sondage.source` = 'AMESSEFE Komi Yoan Freddy'
      - `sondage.meta->>'localite'` = L (ou `localite_base` normalisé)
      - `echantillon.depth_m` = d
    - `vbs` = valeur Excel

**Comptage attendu :** ~75 localités × 3 profondeurs = ~225 VBS max (selon cellules non vides)

---

#### Limites d'Atterberg (`limite.xlsx` → `atlas.essais_geotechniques`)

**Structure Excel :** Format tabulaire
- Colonne `Localité` : nom
- Colonne `Profondeur` : profondeur en mètres
- Colonnes `Limite de liquidité (WL)`, `Limite de plasticité (WP)`, `Indice de plasticité (IP)`

**Règle d'import :**
Pour chaque ligne Excel avec (Localité=L, Profondeur=d, WL, WP, IP) :
- Il doit exister **exactement 1 ligne** dans `atlas.essais_geotechniques` avec :
  - `echantillon_id` lié au bon (sondage, profondeur)
  - `wl` = WL, `wp` = WP, `ip` = IP

**Comptage attendu :** 6 feuilles × 36 lignes = ~216 essais (selon données)

---

#### Granulométrie (`Granulométrie.xlsx` → `atlas.granulo_points`)

**Structure Excel :** Format pivot
- Colonne `Localités` : nom
- Colonnes `1`, `1.5`, `2` : % passant à 0.08mm aux profondeurs

**Règle d'import :**
Pour chaque localité L et profondeur d :
- Si la cellule Excel[L, d] n'est pas vide →
  - Il doit exister **1 ligne** dans `atlas.granulo_points` avec :
    - `echantillon_id` lié au bon (sondage, profondeur)
    - `sieve_mm` = 0.08
    - `passing_pct` = valeur Excel

**Note :** Ce fichier ne contient que le % passant à 0.08mm, pas la courbe complète.

---

#### Classification (`classification.xlsx` → `atlas.essais_classif`)

**Structure Excel :** Format tabulaire
- Colonne `Localité` : nom
- Colonne `Profondeur` : profondeur
- Colonnes de classification :
  - `Classification CHASSAGNEUX D. et al. 1996` → `class_chassagneux`
  - `Classification Dakshanamurthy et Raman 1973` → `class_daksha`
  - `Classification SEED H. et al 1962` → `class_seed`
  - `Classification VIJAYVERGIYA et GHAZZALY 1973` → `class_vijay`
  - `Type de sol` → `type_sol`

**Règle d'import :**
Pour chaque ligne Excel :
- Il doit exister **exactement 1 ligne** dans `atlas.essais_classif` avec les valeurs correspondantes.

---

#### Potentiel de gonflement (`potentielle_de_gonflement.xlsx` → `atlas.essais_potentiel_gonflement`)

**Structure Excel :** Format pivot
- Colonne `Localité` : nom
- Colonnes `Potentiel gonflement (cg) 1m`, `... 1,5m`, `... 2m` : valeurs Cg
- Colonnes `Analyse 1m`, `... 1,5m`, `... 2m` : qualificatifs (Faible, Moyen, etc.)

**Règle d'import :**
Pour chaque localité L et profondeur d :
- Si la cellule Cg n'est pas vide →
  - Il doit exister **1 ligne** dans `atlas.essais_potentiel_gonflement` avec :
    - `cg` = valeur numérique
    - `cg_qual` = qualificatif de la colonne Analyse

---

### Contraintes d'intégrité

1. **Unicité** : Pour un couple (localité, profondeur), il ne doit y avoir qu'UN seul essai de chaque type.
2. **Traçabilité** : Tous les essais doivent avoir `source = 'AMESSEFE Komi Yoan Freddy'`.
3. **Hiérarchie** : sondage → échantillon → essai (pas d'essai orphelin).
4. **Normalisation** : Les noms de localités sont normalisés via `scripts/utils/normalize.py`.

---

## Fichiers Excel sources

| Fichier | Contenu | Table cible |
|---------|---------|-------------|
| `bleu.xlsx` | Valeurs de bleu (VBS) | `atlas.essais_vbs` |
| `limite.xlsx` | Limites d'Atterberg (WL, WP, IP) | `atlas.essais_geotechniques` |
| `Granulométrie.xlsx` | % passant à 0.08mm | `atlas.granulo_points` |
| `classification.xlsx` | Classifications (Chassagneux, Daksha, Seed, Vijay) | `atlas.essais_classif` |
| `potentielle_de_gonflement.xlsx` | Potentiel de gonflement (Cg) | `atlas.essais_potentiel_gonflement` |

## Scripts

| Script | Description |
|--------|-------------|
| `scripts/04_import_amessefe_v2.py` | Import complet et idempotent |
| `scripts/audit_amessefe_import.py` | Audit de cohérence Excel vs DB |
| `sql/maintenance/reset_amessefe.sql` | Suppression propre des données AMESSEFE |

## Workflow complet

### 1. Backup (obligatoire avant toute modification)

```bash
docker exec atlas-db pg_dump -Fc -U atlas atlas_clean -f /tmp/atlas_backup_before_amessefe.dump
docker cp atlas-db:/tmp/atlas_backup_before_amessefe.dump ./backups/
```

### 2. Reset des données existantes (si ré-import)

```bash
docker cp sql/maintenance/reset_amessefe.sql atlas-db:/tmp/
docker exec -i atlas-db psql -U atlas atlas_clean -f /tmp/reset_amessefe.sql
```

### 3. Import

```bash
python scripts/04_import_amessefe_v2.py
```

Options :
- `--dry-run` : Mode test sans commit
- `--dsn` : DSN PostgreSQL personnalisé
- `--data-dir` : Répertoire des fichiers Excel

### 4. Audit de validation

```bash
python scripts/audit_amessefe_import.py
```

Le script retourne :
- **Exit code 0** : Toutes les données sont correctement importées
- **Exit code 1** : Des données sont manquantes

Le rapport JSON est sauvegardé dans `audit_amessefe_report.json`.

## Pipeline automatisé (one-liner)

```bash
# Reset + Import + Audit
docker exec -i atlas-db psql -U atlas atlas_clean -f /tmp/reset_amessefe.sql && \
python scripts/04_import_amessefe_v2.py && \
python scripts/audit_amessefe_import.py
```

## Statistiques attendues

| Type | Localités | Essais |
|------|-----------|--------|
| VBS | 12 | 36 |
| Limites | 12 | 36 |
| Granulo | 76 | 226 |
| Classification | 12 | 36 |
| Gonflement | 12 | 36 |

**Total localités uniques : 78**

## Schéma de données

```
atlas.sondages (source='AMESSEFE Komi Yoan Freddy')
    └── atlas.echantillons (3 par sondage : 1m, 1.5m, 2m)
        ├── atlas.essais_vbs
        ├── atlas.essais_geotechniques (WL, WP, IP)
        ├── atlas.granulo_points (% passant 0.08mm)
        ├── atlas.essais_classif
        └── atlas.essais_potentiel_gonflement
```

## Pipeline de contrôle qualité

### Workflow recommandé

```bash
# 1. Import des données
python scripts/04_import_amessefe_v2.py

# 2. Audit comparatif Excel ↔ DB
python scripts/build_amessefe_summary_xlsx_v2.py

# 3. Vérifier le fichier Excel généré
#    → data/xlsx/audit_amessefe_essais_comparatif.xlsx
#    → Feuille "actions" : localités nécessitant une action

# 4. (Optionnel) Réparer les essais manquants
python scripts/fix_amessefe_missing_essais.py --dry-run  # Test
python scripts/fix_amessefe_missing_essais.py            # Appliquer

# 5. Relancer l'audit pour confirmer
python scripts/build_amessefe_summary_xlsx_v2.py
```

### Scripts de contrôle qualité

| Script | Description |
|--------|-------------|
| `scripts/build_amessefe_summary_xlsx.py` | Audit Excel seul (résumé par localité) |
| `scripts/build_amessefe_summary_xlsx_v2.py` | Audit comparatif Excel ↔ DB |
| `scripts/fix_amessefe_missing_essais.py` | Réparation ciblée des essais manquants |
| `scripts/utils/normalize.py` | Module de normalisation des localités |

### Actions suggérées (feuille "actions")

| Action | Signification | À faire |
|--------|---------------|---------|
| `OK` | Données synchronisées | Rien |
| `CREER_SONDAGE` | Localité Excel sans sondage DB | Relancer l'import |
| `IMPORTER_ESSAIS` | Sondage existe, essais manquants | Utiliser fix_amessefe_missing_essais.py |
| `VERIFIER_ORPHELIN` | Sondage DB sans données Excel | Vérifier la source |
| `VERIFIER_SURPLUS` | DB a plus d'essais que Excel | Possible doublon |
| `VERIFIER_MIXTE` | Certains essais manquants, d'autres en surplus | Analyse manuelle |

## Historique des corrections

### v2.1 (2025-12-11)
- ✅ Module de normalisation centralisé (`scripts/utils/normalize.py`)
- ✅ Audit comparatif v2.1 avec colonne `action_suggeree`
- ✅ Feuille "actions" dans l'Excel d'audit
- ✅ Script de réparation ciblé `fix_amessefe_missing_essais.py`
- ✅ Résolution des alias de localités (espaces, parenthèses)

### v2 (2025-12-09)
- ✅ Ajout import `limite.xlsx` (manquant en v1)
- ✅ Correction bug `updated_at` sur `granulo_points`
- ✅ Utilisation du schéma `atlas.` explicite
- ✅ Script idempotent avec `ON CONFLICT`
- ✅ Script d'audit avec exit code

### v1 (original)
- ❌ Import limites manquant
- ❌ Erreur `updated_at` cassant l'import granulo
