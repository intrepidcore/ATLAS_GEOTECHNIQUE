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

## Historique des corrections

### v2 (2025-12-09)
- ✅ Ajout import `limite.xlsx` (manquant en v1)
- ✅ Correction bug `updated_at` sur `granulo_points`
- ✅ Utilisation du schéma `atlas.` explicite
- ✅ Script idempotent avec `ON CONFLICT`
- ✅ Script d'audit avec exit code

### v1 (original)
- ❌ Import limites manquant
- ❌ Erreur `updated_at` cassant l'import granulo
