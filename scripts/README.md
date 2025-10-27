# 📁 Scripts d'Import Géotechnique

Ce dossier contient les scripts pour cloner la base Atlas et importer des données géotechniques.

## 📜 Scripts Disponibles

### `01_clone_database.sh` / `01_clone_database.ps1`
**Clone la base PostgreSQL sans données géotechniques**

- Dump de la base source avec exclusion des données géotech
- Création d'une nouvelle base `atlas_clean`
- Restore du schéma complet + données référentielles
- Vérifications automatiques

**Usage:**
```bash
# Linux/Mac
./01_clone_database.sh

# Windows PowerShell
.\01_clone_database.ps1
```

### `02_import_excel.py`
**Import idempotent Excel → PostgreSQL**

- Lecture de fichiers `.xlsx` multi-feuilles
- Validation des données (types, plages, références)
- Import par UPSERT (idempotent)
- Rapport détaillé avec statistiques
- Mode `--dry-run` pour validation

**Usage:**
```bash
# Mode dry-run (validation)
python 02_import_excel.py --file data.xlsx --dsn "postgresql://..." --dry-run

# Import réel
python 02_import_excel.py --file data.xlsx --dsn "postgresql://..."

# Avec variable d'environnement
export DATABASE_URL="postgresql://..."
python 02_import_excel.py --file data.xlsx
```

**Dépendances:**
```bash
pip install pandas openpyxl psycopg[binary]
```

## 📊 Format Excel Attendu

Le fichier Excel doit contenir les feuilles suivantes (noms insensibles à la casse):

### Feuille `sondages`
| Colonne | Type | Obligatoire | Description |
|---------|------|-------------|-------------|
| code | TEXT | ✅ | Identifiant unique |
| lat | FLOAT | ✅ | Latitude WGS84 (-90 à 90) |
| lon | FLOAT | ✅ | Longitude WGS84 (-180 à 180) |
| date | DATE | ❌ | Date du sondage (YYYY-MM-DD) |
| localite | TEXT | ❌ | Nom de la localité |
| source | TEXT | ❌ | Source des données |

### Feuille `echantillons`
| Colonne | Type | Obligatoire | Description |
|---------|------|-------------|-------------|
| code | TEXT | ✅ | Référence au sondage |
| depth_m | FLOAT | ✅ | Profondeur (≥ 0) |
| date | DATE | ❌ | Date de prélèvement |
| laboratory | TEXT | ❌ | Laboratoire |
| rho_s_gcm3 | FLOAT | ❌ | Densité solides (2.0-3.5) |
| water_content_w | FLOAT | ❌ | Teneur en eau (0-100%) |
| is_index | FLOAT | ❌ | Indice gonflement (0-1) |

### Feuille `atterberg`
| Colonne | Type | Obligatoire | Description |
|---------|------|-------------|-------------|
| code | TEXT | ✅ | Référence au sondage |
| depth_m | FLOAT | ✅ | Profondeur |
| wl | FLOAT | ❌ | Limite liquidité (0-200%) |
| wp | FLOAT | ❌ | Limite plasticité (0-200%) |

*Note: IP calculé automatiquement (IP = WL - WP)*

### Feuille `vbs`
| Colonne | Type | Obligatoire | Description |
|---------|------|-------------|-------------|
| code | TEXT | ✅ | Référence au sondage |
| depth_m | FLOAT | ✅ | Profondeur |
| vbs | FLOAT | ✅ | Valeur de Bleu (0-20 g/100g) |
| commentaire | TEXT | ❌ | Observations |

### Feuille `proctor`
| Colonne | Type | Obligatoire | Description |
|---------|------|-------------|-------------|
| code | TEXT | ✅ | Référence au sondage |
| depth_m | FLOAT | ✅ | Profondeur |
| gamma_d_max | FLOAT | ✅ | Densité sèche max (10-30 kN/m³) |
| w_opt | FLOAT | ✅ | Teneur eau optimale (0-50%) |
| proctor_type | TEXT | ❌ | `normal` ou `modifie` |

## 🔄 Workflow Complet

```mermaid
graph TD
    A[Base Production] -->|01_clone_database| B[Base Clean]
    B --> C[Pointer API vers atlas_clean]
    C --> D[Préparer Excel]
    D --> E[Dry-run validation]
    E -->|OK| F[Import réel]
    E -->|Erreurs| D
    F --> G[Refresh MV]
    G --> H[Vérifications]
```

### Étapes:

1. **Clone de la base**
   ```bash
   ./01_clone_database.sh
   ```

2. **Configuration API**
   ```bash
   # .env
   DATABASE_URL=postgresql://user:pass@localhost/atlas_clean
   docker compose restart api
   ```

3. **Validation des données**
   ```bash
   python 02_import_excel.py --file data.xlsx --dsn "..." --dry-run
   ```

4. **Import**
   ```bash
   python 02_import_excel.py --file data.xlsx --dsn "..."
   ```

5. **Vérifications**
   ```sql
   SELECT COUNT(*) FROM sondages;
   SELECT COUNT(*) FROM echantillons;
   REFRESH MATERIALIZED VIEW mailles_geotechnique_stats;
   ```

## ⚠️ Points d'Attention

### Ordre d'Import
L'ordre est **critique** car les tables ont des clés étrangères:
1. ✅ Sondages (table racine)
2. ✅ Échantillons (référence sondages)
3. ✅ Essais (référencent échantillons)

Le script Python respecte automatiquement cet ordre.

### Idempotence
Tous les imports sont **idempotents** (UPSERT):
- Relancer le script ne crée pas de doublons
- Les données existantes sont mises à jour
- Clés de conflit: `(code)`, `(sondage_id, depth_m)`, etc.

### Validation
Le script valide automatiquement:
- ✅ Types de données
- ✅ Plages de valeurs (0-100% pour pourcentages, etc.)
- ✅ Références (sondage existe avant échantillon)
- ✅ Coordonnées géographiques
- ✅ Dates au format ISO

### Transactions
- Import dans une **transaction unique**
- En cas d'erreur: **ROLLBACK complet**
- Aucune donnée partielle en base

## 🐛 Dépannage

### Erreur: "Module pandas not found"
```bash
pip install pandas openpyxl psycopg[binary]
```

### Erreur: "Sondage introuvable"
Vérifier que la feuille `sondages` est importée en premier et contient le code référencé.

### Erreur: "Coordonnées invalides"
Vérifier que lat ∈ [-90, 90] et lon ∈ [-180, 180] (WGS84).

### Performance lente
Pour gros volumes (>10k lignes):
- Désactiver temporairement les triggers
- Utiliser `COPY` au lieu d'`INSERT`
- Augmenter `work_mem` PostgreSQL

### Voir les logs détaillés
```bash
python 02_import_excel.py --file data.xlsx --dsn "..." --verbose
```

## 📞 Support

Consultez le guide complet: `../GUIDE_IMPORT_GEOTECH.md`

---

**Dernière mise à jour:** 2024-10-24
