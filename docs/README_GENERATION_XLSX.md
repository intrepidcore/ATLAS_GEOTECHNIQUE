# Génération du Fichier d'Import Géotechnique Atlas

## Description

Ce document explique comment générer le fichier `atlas_import_example.xlsx` conforme aux spécifications Atlas V3 pour l'import de données géotechniques.

## Fichiers

- **`generate_atlas_import.py`** : Script Python de génération du fichier Excel
- **`atlas_import_example.xlsx`** : Fichier Excel généré (sortie)
- **`corrections_report.md`** : Rapport des corrections appliquées
- **`SPECIFICATION_XLSX_IMPORT_COMPLET.md`** : Spécifications complètes du format

## Prérequis

```bash
pip install openpyxl
```

## Utilisation

### Générer le fichier Excel

```bash
cd c:\PROJET_ATLAS_MASTER\atlas
python generate_atlas_import.py
```

### Sortie

Le script génère :
1. **`atlas_import_example.xlsx`** - Classeur Excel avec 10 feuilles
2. **`corrections_report.md`** - Rapport des corrections appliquées

## Structure du Fichier Excel

Le fichier généré contient **10 feuilles** conformes aux spécifications Atlas V3 :

| Feuille | Statut | Lignes | Description |
|---------|--------|--------|-------------|
| **sondages** | ✅ Obligatoire | 3 | Sites de sondage (KEVE-S1, ASSA-S1, BADJA-S1) |
| **echantillons** | ✅ Obligatoire | 9 | Échantillons (3 sites × 3 profondeurs) |
| **atterberg** | ✅ Optionnel | 9 | Limites d'Atterberg (WL, WP) |
| **vbs** | ✅ Optionnel | 9 | Valeur au bleu de méthylène |
| **proctor** | 🔲 Vide | 0 | Essais Proctor (non disponible) |
| **granulo_tamisage_large** | ✅ Optionnel | 26 | Granulométrie par tamisage (format WIDE) |
| **granulo_sedimento_large** | ✅ Optionnel | 27 | Granulométrie par sédimentométrie (format WIDE) |
| **densite** | ✅ Optionnel | 9 | Densités apparente et absolue |
| **teneur_eau** | ✅ Optionnel | 9 | Teneurs en eau naturelle |
| **classification** | ✅ Optionnel | 9 | Classifications géotechniques (HRB, USCS, BM) |

## Données Sources

Les données ont été extraites manuellement des tableaux bruts fournis et incluent :

### Sites et Localités

| Code Site | Localité | Profondeurs |
|-----------|----------|-------------|
| `KEVE-S1` | Kévé | 1.0, 1.5, 2.0 m |
| `ASSA-S1` | Assahoun | 1.0, 1.5, 2.0 m |
| `BADJA-S1` | Badja | 1.0, 1.5, 2.0 m |

### Essais Disponibles

- **Atterberg** : 9 essais (WL, WP pour 3 sites × 3 profondeurs)
- **VBS** : 9 essais (valeur au bleu + classification)
- **Granulométrie tamisage** : 26 tamis (25 mm → 0.08 mm)
- **Granulométrie sédimentométrie** : Fractions fines < 0.08 mm
- **Densités** : ρd (apparente) et ρs (absolue)
- **Teneur en eau** : W naturelle + indice de gonflement Wi
- **Classifications** : HRB, USCS (Unified), Bleu de Méthylène

## Corrections Appliquées

Le script intègre des corrections pour garantir la cohérence des données :

### 1. Valeurs Aberrantes Granulo

| Localisation | Valeur Brute | Valeur Corrigée | Méthode |
|--------------|--------------|-----------------|---------|
| ASSA-S1@1.5, tamis 0.315mm | 422.43 | 42.43 | ÷10 |
| KEVE-S1@1, tamis 0.25mm | 7440 | 74.40 | ÷100 |
| KEVE-S1@1.5, tamis 4mm | 922.46 | 92.25 | ÷10 |

### 2. Monotonicité des Courbes Granulo

Toutes les séries granulométriques sont rendues **monotones croissantes** (% passants augmente quand le tamis diminue) via un algorithme de "running maximum".

### 3. Validation Atterberg

- **Règle** : WL ≥ WP (toujours vérifiée)
- **IP** : Calculé automatiquement côté base de données

### 4. Clamping des Pourcentages

Toutes les valeurs de pourcentage sont dans l'intervalle `[0, 100]`.

## Format WIDE (Granulométrie)

Les feuilles `granulo_tamisage_large` et `granulo_sedimento_large` utilisent le **format WIDE** :

### Structure

```
sieve_mm | ASSA-S1@1 | ASSA-S1@1.5 | ASSA-S1@2 | BADJA-S1@1 | ...
---------|-----------|-------------|-----------|------------|----
25.0     | 100.00    | 100.00      | 100.00    | 100.00     | ...
20.0     | 100.00    | 100.00      | 100.00    | 100.00     | ...
0.08     | 43.30     | 25.70       | 24.02     | 48.54      | ...
```

### Pattern Série

**Format** : `<code_site>@<depth_m>`

**Exemples** :
- `KEVE-S1@1` → Site Kévé, profondeur 1.0 m
- `ASSA-S1@1.5` → Site Assahoun, profondeur 1.5 m
- `BADJA-S1@2` → Site Badja, profondeur 2.0 m

## Import dans Atlas

### Workflow

1. **Générer le fichier** : `python generate_atlas_import.py`
2. **Ouvrir Atlas** : http://localhost:3000
3. **Wizard d'import** : Onglet "Import Géotechnique"
4. **Upload** : Sélectionner `atlas_import_example.xlsx`
5. **Validation** : Le wizard valide automatiquement la structure
6. **Import** : Cliquer sur "Importer"

### Logs d'Import

Le backend Rust affiche les logs détaillés :
```
[*] Creation feuille: sondages
   [OK] 3 sondages crees
[*] Creation feuille: echantillons
   [OK] 9 echantillons crees
...
```

### Résultat Attendu

Après import :
- **3 sondages** dans la table `sondages`
- **9 échantillons** dans la table `echantillons`
- **9 essais Atterberg** dans `essais_atterberg`
- **9 essais VBS** dans `essais_vbs`
- **~234 points granulo** dans `granulo_points` (26 tamis × 9 séries)

## Validation Finale

### Checks Automatiques

Le script valide automatiquement :

✅ Noms de feuilles exacts (snake_case)
✅ Colonnes obligatoires présentes
✅ Format WIDE respecté (header `site@depth`)
✅ WL ≥ WP (Atterberg)
✅ Pourcentages dans [0, 100]
✅ Profondeurs > 0
✅ VBS dans [0, 20]

### Vérification Manuelle

Ouvrez le fichier Excel et vérifiez :
1. **Onglets** : 10 feuilles présentes
2. **sondages** : 3 lignes (KEVE-S1, ASSA-S1, BADJA-S1)
3. **granulo_tamisage_large** : Header avec pattern `SITE@depth`
4. **atterberg** : 9 lignes, WL > WP pour toutes

## Dépannage

### Erreur : "Module 'openpyxl' not found"

```bash
pip install openpyxl
```

### Erreur : "UnicodeEncodeError"

Le script a été nettoyé des emojis. Si l'erreur persiste, exécuter :

```bash
python -c "import sys; print(sys.stdout.encoding)"
```

Si l'encodage n'est pas UTF-8, ajouter au début du script :
```python
import sys
import io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
```

### Valeurs Granulo Aberrantes

Le script applique déjà des corrections automatiques. Si vous identifiez d'autres anomalies :

1. Ouvrir `generate_atlas_import.py`
2. Modifier le tableau `granulo_tamisage` (ligne ~132)
3. Réexécuter le script

## Références

- **Spécifications complètes** : [SPECIFICATION_XLSX_IMPORT_COMPLET.md](SPECIFICATION_XLSX_IMPORT_COMPLET.md)
- **Migration SQL** : `db/migrations/011_geotechnical_detailed_import.sql`
- **Parser Rust** : `services/api-geo/src/import_bulk/xlsx_parser.rs`
- **Guide utilisateur** : [GUIDE_IMPORT_GEOTECHNIQUE.md](GUIDE_IMPORT_GEOTECHNIQUE.md)

## Contact & Support

Pour toute question ou anomalie détectée, consulter :
- Documentation technique : `SPECIFICATION_XLSX_IMPORT_COMPLET.md`
- Logs d'import : Console du backend Rust
- Validation SQL : Contraintes CHECK dans la migration 011

---

**Version** : 1.0
**Date** : 24 octobre 2025
**Auteur** : Équipe Atlas
**Statut** : ✅ Production Ready
