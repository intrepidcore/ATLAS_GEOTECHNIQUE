# 🎛️ Système d'Import Géotechnique - Atlas

Architecture complète pour l'import de données géotechniques au format XLSX multi-feuilles.

## 🚀 Démarrage rapide

```bash
# 1. Générer le fichier exemple
python make_atlas_example_xlsx.py

# 2. Appliquer la migration SQL
psql -d atlas_db -f db/migrations/011_geotechnical_detailed_import.sql

# 3. Tester l'import
pwsh test_geotechnical_import.ps1

# 4. Ou via curl
curl -X POST http://localhost:3000/api/v1/surveys/bulk-import/geotechnical \
  -F "file=@atlas_import_example.xlsx" \
  -F "geolocation_mode=centroid"
```

---

## 📁 Architecture des fichiers

```
atlas/
├── make_atlas_example_xlsx.py          # Générateur de fichier exemple
├── atlas_import_example.xlsx           # Fichier exemple généré
├── test_geotechnical_import.ps1        # Script de test
├── GUIDE_IMPORT_GEOTECHNIQUE.md        # Documentation utilisateur
├── README_IMPORT_GEOTECHNIQUE.md       # Ce fichier
│
├── db/migrations/
│   └── 011_geotechnical_detailed_import.sql  # Migration SQL
│
├── services/api-geo/src/import_bulk/
│   ├── xlsx_parser.rs                  # Parser XLSX multi-feuilles
│   ├── geotechnical_importer.rs        # Importeur vers base de données
│   └── routes.rs                       # Route API /geotechnical
│
└── ui/src/
    ├── geotechnical-import-wizard.ts   # Interface utilisateur
    ├── services/geotechnical-import-api.ts
    └── styles/geotechnical-import.css
```

---

## 🗃️ Architecture de base de données

### Tables principales

```
sondages (sites)
  └── echantillons (profondeurs)
        ├── essais_atterberg (WL, WP, IP)
        ├── essais_vbs (VBS)
        ├── essais_proctor (γd max, w opt)
        └── granulo_points (courbes complètes)
```

### Synchronisation automatique

Les données détaillées sont **automatiquement synchronisées** vers `essais_geotechniques` (table legacy) via des triggers, pour assurer la compatibilité avec les cartes thématiques existantes.

```sql
echantillons + essais_* → essais_geotechniques → mailles_geotechnique_stats
```

### Vues et fonctions

- **`v_echantillons_complets`** : Vue complète avec tous les essais
- **`calculate_passant_synthetic()`** : Calcule passants 80µm, 2mm, 20mm depuis courbes
- **`sync_to_essais_geotechniques()`** : Trigger de synchronisation

---

## 🎯 Modes d'import supportés

### 1. XLSX multi-feuilles (recommandé)

**Avantages :**
- ✅ Format lisible par les labos
- ✅ Gère très bien la granulométrie "large" (profondeurs en colonnes)
- ✅ Plusieurs localités dans un seul fichier
- ✅ Validation automatique

**Feuilles :**
- `sondages` (requis)
- `echantillons` (requis)
- `atterberg`, `vbs`, `proctor` (optionnels)
- `granulo_tamisage_large`, `granulo_sedimento_large` (optionnels)

### 2. CSV "long" unifié (technique)

Un seul CSV normalisé (une ligne = 1 mesure). Parfait pour ETL/CSV out of lab.

**Format :**
```csv
code_site,localite,date,lat,lon,depth_m,test_type,measure,unit,value,method,source,laboratory,norm,comment
Sanfatoute,,2025-10-20,,,1.0,granulo,sieve_mm,mm,25,tamisage,Campagne,Labo Atlas,"NF EN 933-1",""
Sanfatoute,,2025-10-20,,,1.0,granulo,passing_pct,%,100,tamisage,Campagne,Labo Atlas,"NF EN 933-1",""
```

### 3. ZIP multi-CSV (souple)

Même structure que (2), mais 1 CSV par thème. Utile si les sources sont déjà séparées.

---

## 🧩 Format granulométrie "large"

### Principe

Les **profondeurs sont en colonnes**, les **tamis en lignes**. Idéal pour les feuilles de labo.

### Exemple

| sieve_mm | Sanfatoute@1 | Sanfatoute@1.5 | Korbongou@1 |
|----------|--------------|----------------|-------------|
| 25.0     | 100.00       | 100.00         | 100.00      |
| 20.0     | 100.00       | 100.00         | 97.55       |
| 0.08     | 82.81        | 77.50          | 66.74       |

### Transformation automatique

Le système détecte le format `code_site@profondeur` et transforme automatiquement en format "long" :

```
Sanfatoute@1 + sieve_mm=25 + passing=100
  → code_site=Sanfatoute, depth_m=1.0, method=tamisage, sieve_mm=25, passing_pct=100
```

### Règles

- **Séparateur** : `@` entre code site et profondeur
- **Décimales** : virgule ou point acceptés (`1,5` ou `1.5`)
- **Lignes "Moyenne"** : ignorées automatiquement
- **Cellules vides** : pas de mesure pour ce tamis

---

## 🔧 API

### Endpoint principal

```
POST /api/v1/surveys/bulk-import/geotechnical
```

**Paramètres :**
- `file` (multipart) : Fichier XLSX
- `geolocation_mode` (string) : `exact` | `centroid` | `random` | `unknown`

**Réponse :**
```json
{
  "success": true,
  "stats": {
    "sondages_created": 2,
    "sondages_updated": 0,
    "echantillons_created": 6,
    "atterberg_created": 6,
    "vbs_created": 6,
    "proctor_created": 0,
    "granulo_points_created": 120,
    "errors": [],
    "warnings": []
  },
  "message": "Import réussi: 2 sondages, 6 échantillons, 12 essais"
}
```

### Modes de géolocalisation

| Mode | Description | Requis |
|------|-------------|--------|
| `exact` | Utilise lat/lon du fichier | Colonnes lat/lon remplies |
| `centroid` | Centre de la commune | Colonne adm3 remplie |
| `random` | Point aléatoire dans commune | Colonne adm3 remplie |
| `unknown` | Pas de géolocalisation | Rien |

---

## 🧪 Tests

### Test complet

```bash
pwsh test_geotechnical_import.ps1
```

### Test unitaire (Rust)

```bash
cd services/api-geo
cargo test geotechnical_import
```

### Test manuel (curl)

```bash
# Générer le fichier
python make_atlas_example_xlsx.py

# Importer
curl -X POST http://localhost:3000/api/v1/surveys/bulk-import/geotechnical \
  -F "file=@atlas_import_example.xlsx" \
  -F "geolocation_mode=centroid" \
  | jq .
```

### Vérification en base

```sql
-- Voir les échantillons importés
SELECT * FROM v_echantillons_complets;

-- Compter les points granulo
SELECT 
  s.code AS site,
  e.depth_m,
  COUNT(*) FILTER (WHERE method = 'tamisage') AS n_tamisage,
  COUNT(*) FILTER (WHERE method = 'sedimento') AS n_sedimento
FROM granulo_points gp
JOIN echantillons e ON gp.echantillon_id = e.id
JOIN sondages s ON e.sondage_id = s.id
GROUP BY s.code, e.depth_m
ORDER BY s.code, e.depth_m;

-- Refresh de la matview
REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats;
```

---

## 📊 Exploitation des données

### Courbes granulométriques

```sql
-- Courbe complète d'un échantillon
SELECT 
  method,
  sieve_mm,
  passing_pct
FROM granulo_points
WHERE echantillon_id = '<uuid>'
ORDER BY method, sieve_mm DESC;
```

### Classification des sols

```sql
-- Classification selon IP et VBS
SELECT 
  s.code,
  e.depth_m,
  att.ip_generated AS ip,
  vbs.vbs,
  CASE 
    WHEN att.ip_generated < 12 THEN 'Peu plastique'
    WHEN att.ip_generated < 25 THEN 'Moyennement plastique'
    WHEN att.ip_generated < 40 THEN 'Plastique'
    ELSE 'Très plastique'
  END AS classification_ip,
  CASE 
    WHEN vbs.vbs < 1.5 THEN 'Sol sableux'
    WHEN vbs.vbs < 2.5 THEN 'Sol limoneux'
    WHEN vbs.vbs < 6 THEN 'Sol limoneux argileux'
    WHEN vbs.vbs < 8 THEN 'Sol argileux'
    ELSE 'Sol très argileux'
  END AS classification_vbs
FROM echantillons e
JOIN sondages s ON e.sondage_id = s.id
LEFT JOIN essais_atterberg att ON att.echantillon_id = e.id
LEFT JOIN essais_vbs vbs ON vbs.echantillon_id = e.id
WHERE att.ip_generated IS NOT NULL OR vbs.vbs IS NOT NULL;
```

### Cartes thématiques

Les données sont automatiquement agrégées dans `mailles_geotechnique_stats` :

```sql
SELECT 
  code,
  n_sondages,
  n_essais_geo,
  passant_80um_avg,
  ip_avg,
  vbs_avg,
  eg_avg
FROM mailles_geotechnique_stats
WHERE n_sondages > 0
ORDER BY n_sondages DESC
LIMIT 10;
```

---

## 🔄 Workflow complet

```mermaid
graph LR
    A[Fichier XLSX] --> B[Parser]
    B --> C[Validation]
    C --> D[Transformation Large→Long]
    D --> E[Import DB]
    E --> F[Sync essais_geotechniques]
    F --> G[Refresh MatView]
    G --> H[Cartes thématiques]
```

### Étapes détaillées

1. **Upload** : Fichier XLSX multi-feuilles
2. **Parsing** : Lecture avec `calamine` (Rust)
3. **Validation** : Contraintes métier (WL≥WP, VBS≤20, etc.)
4. **Transformation** : Format large → long pour granulo
5. **Import** : Transaction SQL (sondages → échantillons → essais)
6. **Synchronisation** : Triggers vers `essais_geotechniques`
7. **Agrégation** : Refresh de `mailles_geotechnique_stats`
8. **Visualisation** : Cartes thématiques mises à jour

---

## 💡 Bonnes pratiques

### Préparation des données

✅ **À faire :**
- Vérifier les codes sites uniques
- Utiliser le point `.` comme séparateur décimal
- Renseigner les métadonnées (labo, norme, date)
- Vérifier la cohérence (WL≥WP, passants décroissants)

❌ **À éviter :**
- Doublons de code_site
- Virgule comme séparateur décimal dans le fichier
- Lignes "Moyenne" ou "Total" dans les données
- Profondeurs négatives

### Performance

- **Grouper les imports** : plusieurs sites en une fois
- **Format large** : plus rapide pour courbes complètes
- **Refresh différé** : la matview se rafraîchit automatiquement

### Qualité

- **Validation amont** : vérifier le fichier avant import
- **Logs détaillés** : consulter errors et warnings
- **Vérification aval** : requêtes SQL de contrôle

---

## 🐛 Dépannage

### Erreur : "Fichier XLSX manquant"

**Cause :** Le fichier n'a pas été uploadé correctement.

**Solution :**
```bash
# Vérifier que le fichier existe
ls -la atlas_import_example.xlsx

# Tester avec curl
curl -X POST http://localhost:3000/api/v1/surveys/bulk-import/geotechnical \
  -F "file=@atlas_import_example.xlsx" \
  -F "geolocation_mode=centroid"
```

### Erreur : "Échantillon introuvable"

**Cause :** Un essai référence un échantillon qui n'existe pas.

**Solution :** Vérifier que tous les `(code_site, depth_m)` des essais existent dans la feuille `echantillons`.

### Erreur : "WL < WP"

**Cause :** Limites d'Atterberg incohérentes.

**Solution :** Vérifier que WL (limite de liquidité) ≥ WP (limite de plasticité).

### Warning : "Sondage introuvable"

**Cause :** Un échantillon référence un site qui n'existe pas.

**Solution :** Ajouter le site dans la feuille `sondages`.

---

## 📚 Documentation

- **Guide utilisateur** : `GUIDE_IMPORT_GEOTECHNIQUE.md`
- **Exemple complet** : `atlas_import_example.xlsx`
- **Script générateur** : `make_atlas_example_xlsx.py`
- **Migration SQL** : `db/migrations/011_geotechnical_detailed_import.sql`
- **API Rust** : `services/api-geo/src/import_bulk/`
- **UI TypeScript** : `ui/src/geotechnical-import-wizard.ts`

---

## 🎯 Roadmap

### v1.0 (actuel)
- ✅ Import XLSX multi-feuilles
- ✅ Format granulo "large"
- ✅ Synchronisation automatique
- ✅ Cartes thématiques

### v1.1 (futur)
- ⏳ Import CSV "long" unifié
- ⏳ Import ZIP multi-CSV
- ⏳ Validation côté client (xlsx.js)
- ⏳ Export courbes granulo (PDF/PNG)

### v1.2 (futur)
- ⏳ Import incrémental (mise à jour)
- ⏳ Historique des imports
- ⏳ Rollback d'import
- ⏳ API GraphQL

---

## 🤝 Contribution

Pour ajouter un nouveau type d'essai :

1. **Migration SQL** : Ajouter la table dans `011_geotechnical_detailed_import.sql`
2. **Parser Rust** : Ajouter la struct dans `xlsx_parser.rs`
3. **Importeur** : Ajouter la fonction d'insertion dans `geotechnical_importer.rs`
4. **UI** : Mettre à jour le wizard et les stats
5. **Documentation** : Mettre à jour le guide

---

## 📄 Licence

Projet Atlas - Système d'Information Géotechnique du Togo

---

**Version** : 1.0  
**Date** : 2025-10-22  
**Auteur** : Équipe Atlas
