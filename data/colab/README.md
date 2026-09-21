# Données Colab - Attribution des Mailles

Ce répertoire contient les fichiers Excel pour l'attribution automatique des mailles aux étudiants.

## 📁 Fichiers

- `TEMPLATE_etudiants_preferences.xlsx` : Template avec exemples
- `etudiants_colab.xlsx` : Fichier de production (à créer)

## 🚀 Utilisation rapide

### 1. Créer le fichier Excel

```powershell
# Générer le template avec exemples
cd C:\PROJET_ATLAS_MASTER\atlas
poetry run python scripts/create_excel_template.py
```

### 2. Remplir les données

Ouvrir `TEMPLATE_etudiants_preferences.xlsx` et :
- Remplacer les exemples par les vraies données
- Sauvegarder sous `etudiants_colab.xlsx`

### 3. Tester

```powershell
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run true
```

### 4. Exécuter

```powershell
poetry run python scripts/colab_assign_mailles_from_excel.py `
  --input data/colab/etudiants_colab.xlsx `
  --dry-run false
```

## 📋 Format des colonnes

| Colonne | Obligatoire | Format | Exemple |
|---------|-------------|--------|---------|
| `student_id` | ✅ | Texte unique | `ETU2025001` |
| `nom` | ✅ | Texte | `KOUASSI` |
| `prenom` | ✅ | Texte | `Jean` |
| `telephone` | ❌ | Texte | `+228 90 12 34 56` |
| `email` | ✅ | Email | `jean@example.tg` |
| `adm_niveau` | ✅ | `ADM2` ou `ADM3` | `ADM2` |
| `adm_code_pref_1` | ✅ | Code ADM | `TG-M` |
| `adm_code_pref_2` | ❌ | Code ADM | `TG-K` |
| `adm_code_pref_3` | ❌ | Code ADM | `TG-C` |
| `commentaire` | ❌ | Texte libre | `Préfère côte` |

## 📚 Documentation complète

Voir `docs/COLAB_MAILLE_ASSIGNMENT.md`
