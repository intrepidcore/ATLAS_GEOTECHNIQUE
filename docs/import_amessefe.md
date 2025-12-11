# Import AMESSEFE - Documentation du workflow

## Contexte

Source de données : **AMESSEFE Komi Yoan Freddy**  
Opérateur : **Serge TABE DJATO**  
Profondeurs standard : **1.0m, 1.5m, 2.0m**

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
