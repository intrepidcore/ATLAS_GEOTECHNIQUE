# 📋 Import XLSX Géotechnique - Guide d'Utilisation

Ce dossier contient les outils pour générer et valider des templates d'import XLSX géotechnique pour Atlas.

---

## 📁 Fichiers Disponibles

### Scripts

| Fichier | Description | Usage |
|---------|-------------|-------|
| `make_atlas_import_template.py` | Génère template vide (10 feuilles) | `python make_atlas_import_template.py` |
| `../make_atlas_example_xlsx.py` | Génère exemple avec données | `python ../make_atlas_example_xlsx.py` |

### Documentation

| Fichier | Description | Public |
|---------|-------------|--------|
| `../SPECIFICATION_XLSX_IMPORT_COMPLET.md` | **Spécification technique complète** | Développeurs |
| `../EXEMPLE_XLSX_STRUCTURE_CORRIGE.md` | Guide utilisateur corrigé | Utilisateurs avancés |
| `../GUIDE_IMPORT_GEOTECHNIQUE.md` | Guide utilisateur simplifié | Tous utilisateurs |

---

## 🚀 Démarrage Rapide

### 1. Générer un Template Vide

```bash
cd C:\PROJET_ATLAS_MASTER\atlas\scripts
python make_atlas_import_template.py
```

**Résultat** : `atlas_import_template.xlsx` avec 10 feuilles vides (en-têtes + notes)

### 2. Générer un Exemple avec Données

```bash
cd C:\PROJET_ATLAS_MASTER\atlas
python make_atlas_example_xlsx.py
```

**Résultat** : `atlas_import_example.xlsx` avec données de démonstration (2 sondages, 6 échantillons, essais complets)

---

## 📊 Structure du Template

### Feuilles Implémentées ✅

| Feuille | Obligatoire | Description |
|---------|-------------|-------------|
| **sondages** | ✅ Oui | Sites de prélèvement + géolocalisation |
| **echantillons** | ✅ Oui | Échantillons par profondeur |
| **atterberg** | ❌ Non | Limites de liquidité/plasticité |
| **vbs** | ❌ Non | Valeur au Bleu de Méthylène |
| **proctor** | ❌ Non | Essais de compactage |
| **granulo_tamisage_large** | ❌ Non | Granulométrie tamisage (format wide) |
| **granulo_sedimento_large** | ❌ Non | Granulométrie sédimentométrie (format wide) |

### Feuilles Placeholder 🚧

| Feuille | Statut | Alternative |
|---------|--------|-------------|
| **densite** | Non implémenté | Utiliser `echantillons.rho_s_gcm3` |
| **teneur_eau** | Non implémenté | Utiliser `echantillons.water_content_w` |
| **classification** | Non implémenté | Calculée automatiquement |

---

## 🔑 Colonnes Clés (à retenir)

### Obligatoires

| Feuille | Colonnes Obligatoires |
|---------|----------------------|
| sondages | `code_site` |
| echantillons | `code_site`, `depth_m` |
| atterberg | `code_site`, `depth_m` |
| vbs | `code_site`, `depth_m`, `vbs` |
| proctor | `code_site`, `depth_m`, `proctor_type`, `gamma_d_max`, `w_opt` |

### Importantes

| Colonne | Type | Unité | Contrainte |
|---------|------|-------|------------|
| `code_site` | Texte | - | Unique, identifiant du sondage |
| `depth_m` | Nombre | m | > 0 |
| `wl`, `wp` | Nombre | % | 0-200, WL ≥ WP |
| `vbs` | Nombre | g/100g | 0-20 |
| `gamma_d_max` | Nombre | **kN/m³** | 10-30 (⚠️ pas g/cm³) |
| `proctor_type` | Texte | - | `"normal"` ou `"modifie"` |

---

## 📝 Règles Importantes

### 1. Noms de Colonnes

✅ **Utiliser les noms exacts** :
- `code_site` (pas `code`, `localite`, `site`)
- `depth_m` (pas `profondeur`, `prof`)
- `gamma_d_max` (pas `rho_d_max`)

⚠️ Insensible à la casse : `Code_Site` = `code_site` = `CODE_SITE`

### 2. Format Granulo Wide

**Pattern** : `code_site@depth_m`

✅ **Exemples valides** :
- `Sanfatoute@1`
- `Korbongou@1.5`
- `SiteA@2.0`

❌ **Exemples invalides** :
- `Sanfatoute_1` (mauvais séparateur)
- `Sanfatoute-1` (mauvais séparateur)
- `Sanfatoute` (profondeur manquante)

### 3. Cohérence des Données

✅ **Vérifier avant import** :
- Tous les `code_site` des essais existent dans `sondages`
- Tous les couples `(code_site, depth_m)` des essais existent dans `echantillons`
- `WL ≥ WP` (Atterberg)
- `proctor_type` exactement `"normal"` ou `"modifie"`

---

## 🎯 Workflow Recommandé

### Étape 1 : Préparer le Fichier

```bash
# Générer template vide
python make_atlas_import_template.py

# OU utiliser exemple comme base
python ../make_atlas_example_xlsx.py
```

### Étape 2 : Remplir les Données

1. Ouvrir `atlas_import_template.xlsx` dans Excel
2. Remplir **obligatoirement** :
   - Feuille `sondages` (au moins `code_site`)
   - Feuille `echantillons` (au moins `code_site`, `depth_m`)
3. Ajouter essais optionnels selon besoins
4. Sauvegarder

### Étape 3 : Importer

#### Via API (recommandé)

```bash
curl -X POST http://localhost:3000/api/v1/surveys/bulk-import/geotechnical \
  -F "file=@atlas_import_template.xlsx" \
  -F "geolocation_mode=centroid"
```

**Modes géolocalisation** :
- `exact` : utilise lon/lat du fichier (obligatoires)
- `centroid` : centre de la commune ADM3
- `random` : point aléatoire dans ADM3
- `unknown` : pas de géométrie

#### Via Interface Web

1. Aller dans **Import** → **Géotechnique**
2. Glisser-déposer le fichier `.xlsx`
3. Choisir mode géolocalisation
4. Cliquer **Lancer l'import**

### Étape 4 : Vérifier

```bash
# Voir résultat
curl http://localhost:3000/api/v1/surveys?limit=10

# Statistiques
curl http://localhost:3000/api/v1/mailles/geotechnique/stats
```

---

## ⚠️ Erreurs Courantes

| Erreur | Cause Probable | Solution |
|--------|----------------|----------|
| `code_site manquant ligne X` | Cellule vide | Remplir le code du site |
| `Échantillon X@Y: sondage introuvable` | Ordre des feuilles | Créer sondage **avant** échantillon |
| `WL < WP` | Valeurs inversées | Vérifier Atterberg (WL doit être ≥ WP) |
| `gamma_d_max hors limites` | Unité incorrecte | Utiliser kN/m³, pas g/cm³ |
| `proctor_type invalide` | Faute de frappe | Exactement `"normal"` ou `"modifie"` |

---

## 📚 Documentation Complète

Pour plus de détails, consulter :

### Utilisateurs
- [GUIDE_IMPORT_GEOTECHNIQUE.md](GUIDE_IMPORT_GEOTECHNIQUE.md) - Guide simplifié
- [EXEMPLE_XLSX_STRUCTURE_CORRIGE.md](EXEMPLE_XLSX_STRUCTURE_CORRIGE.md) - Guide avancé

### Développeurs
- [SPECIFICATION_XLSX_IMPORT_COMPLET.md](SPECIFICATION_XLSX_IMPORT_COMPLET.md) - Spécification technique complète
- [Code source](../services/api-geo/src/import_bulk/) - Parser Rust

---

## 💡 Astuces

### Performance

- **Limite recommandée** : ~10 000 lignes par feuille
- **Taille fichier** : < 10 MB

### Qualité

- **Backup** : Toujours garder copie originale avant modification
- **Incrémental** : Commencer petit (1-2 sondages), puis augmenter
- **Validation** : Utiliser endpoint `/dry-run` pour tester avant import réel

### Granulométrie

- **Format wide** : Plus pratique pour saisie laboratoire
- **Tamis clés** : 0.08 mm (fines), 2 mm (sables), 20 mm (graviers)
- **Cellules vides** : OK, ignorées lors du parsing

---

## 🆘 Support

### Documentation API

```bash
# Swagger UI
http://localhost:3000/api/v1/docs
```

### Issues GitHub

[github.com/atlas/issues](https://github.com/atlas/issues)

### Exemples

- `atlas_import_template.xlsx` - Template vide
- `atlas_import_example.xlsx` - Exemple avec données

---

**Version** : 1.0
**Date** : 24 octobre 2025
**Projet** : Atlas Géotechnique
