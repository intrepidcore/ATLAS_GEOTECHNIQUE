# 📋 SPÉCIFICATION COMPLÈTE - IMPORT XLSX GÉOTECHNIQUE ATLAS

**Document de référence technique** pour l'import automatisé de données géotechniques multi-feuilles.

Ce document est **la source de vérité** basée sur l'analyse complète du code source (parser Rust + migrations SQL).

---

## 📚 Table des Matières

1. [Vue d'Ensemble](#vue-densemble)
2. [Architecture Système](#architecture-système)
3. [Spécification Feuilles](#spécification-feuilles)
4. [Format Wide (Granulo)](#format-wide-granulo)
5. [Validation & Contraintes](#validation--contraintes)
6. [Transformation & Synchronisation](#transformation--synchronisation)
7. [Exemples Complets](#exemples-complets)
8. [Annexes](#annexes)

---

## Vue d'Ensemble

### Classeur XLSX Multi-Feuilles

**Format** : Excel `.xlsx` avec **10 feuilles maximum** (7 implémentées, 3 placeholders)

**Architecture** :
```
atlas_import.xlsx
├── sondages ✅ (OBLIGATOIRE)
├── echantillons ✅ (OBLIGATOIRE)
├── atterberg ✅ (optionnel)
├── vbs ✅ (optionnel)
├── proctor ✅ (optionnel)
├── granulo_tamisage_large ✅ (optionnel, format wide)
├── granulo_sedimento_large ✅ (optionnel, format wide)
├── densite 🚧 (NON IMPLÉMENTÉ)
├── teneur_eau 🚧 (NON IMPLÉMENTÉ)
└── classification 🚧 (NON IMPLÉMENTÉ)
```

### Hiérarchie des Données

```
Sondage (site)
  └── Échantillon (profondeur)
        ├── Essai Atterberg (WL, WP → IP)
        ├── Essai VBS (argilosité)
        ├── Essai Proctor (compactage)
        └── Points Granulo (courbe complète)
              ├── Tamisage (> 80µm)
              └── Sédimentométrie (< 80µm)
```

### Clés Canoniques

| Entité | Clé Unique | Format |
|--------|------------|--------|
| Sondage | `code_site` | string, unique global |
| Échantillon | `(sondage_id, depth_m, date)` | composite |
| Atterberg | `echantillon_id` | UUID |
| VBS | `echantillon_id` | UUID |
| Proctor | `(echantillon_id, proctor_type)` | composite |
| Granulo Point | `(echantillon_id, method, sieve_mm)` | composite |

---

## Architecture Système

### Flux d'Import

```
1. Upload XLSX
   ↓
2. Parse multi-feuilles (xlsx_parser.rs)
   ↓
3. Validation (validator.rs)
   ↓
4. Transaction BEGIN
   ↓
5. Upsert sondages → UUID
   ↓
6. Insert échantillons → UUID
   ↓
7. Insert essais (Atterberg, VBS, Proctor)
   ↓
8. Transform granulo wide → long
   ↓
9. Insert granulo_points
   ↓
10. COMMIT
   ↓
11. Trigger sync → essais_geotechniques
   ↓
12. Refresh matview mailles_geotechnique_stats
```

### Fichiers Source

| Composant | Fichier | Rôle |
|-----------|---------|------|
| Parser XLSX | `xlsx_parser.rs` | Lit les feuilles Excel |
| Types | `types.rs` | Structures Rust |
| Importer | `geotechnical_importer.rs` | Orchestration import |
| Validator | `validator.rs` | Validation valeurs |
| Migration SQL | `011_geotechnical_detailed_import.sql` | Schéma DB |

---

## Spécification Feuilles

### 1. sondages ✅

**Nom exact** : `sondages` (snake_case, insensible à la casse lors du parsing)

#### Colonnes Obligatoires

| Colonne | Type | Contrainte |
|---------|------|------------|
| `code_site` | TEXT | NOT NULL, UNIQUE |

#### Colonnes Optionnelles

| Colonne | Type | Unité | Contrainte | Description |
|---------|------|-------|------------|-------------|
| `localite` | TEXT | - | - | Nom de la localité |
| `date` | TEXT/DATE | YYYY-MM-DD | - | Date du sondage |
| `lat` | NUMERIC | ° décimaux | 6.0 ≤ lat ≤ 11.5 | Latitude WGS84 (Togo) |
| `lon` | NUMERIC | ° décimaux | -1.0 ≤ lon ≤ 2.0 | Longitude WGS84 (Togo) |
| `adm1` | TEXT | - | - | Région |
| `adm2` | TEXT | - | - | Préfecture |
| `adm3` | TEXT | - | - | Commune |
| `source` | TEXT | - | - | Source/campagne |

#### Mapping Source ↔ Cible

```rust
SondageRow {
    code_site: String,           // get_string_cell(headers, "code_site")
    localite: Option<String>,    // get_string_cell(headers, "localite")
    date: Option<String>,        // get_string_cell(headers, "date")
    lat: Option<f64>,            // get_float_cell(headers, "lat")
    lon: Option<f64>,            // get_float_cell(headers, "lon")
    adm1: Option<String>,        // ...
    adm2: Option<String>,
    adm3: Option<String>,
    source: Option<String>,
}
```

#### Règles de Géolocalisation

| Mode | Colonnes Requises | Comportement |
|------|-------------------|--------------|
| `exact` | `lon`, `lat` | Utilise coordonnées fournies, erreur si hors Togo |
| `centroid` | `adm3` ou `adm2` | Positionne au centroïde de la commune/préfecture |
| `random` | `adm3` ou `adm2` | Point aléatoire dans le polygone ADM |
| `unknown` | `adm2` | Pas de géométrie, stocke uniquement ADM2 |

#### Validation

- `code_site` obligatoire, non vide, unique dans le fichier
- Si `lon`/`lat` fournis en mode `exact` : vérification plages Togo
- Si `date` fournie : parsing ISO 8601, avertissement si future ou < 1950

---

### 2. echantillons ✅

**Nom exact** : `echantillons`

#### Colonnes Obligatoires

| Colonne | Type | Contrainte |
|---------|------|------------|
| `code_site` | TEXT | FK → sondages.code |
| `depth_m` | NUMERIC | > 0 |

#### Colonnes Optionnelles

| Colonne | Type | Unité | Contrainte | Description |
|---------|------|-------|------------|-------------|
| `date` | TEXT/DATE | YYYY-MM-DD | - | Date de prélèvement |
| `laboratory` | TEXT | - | - | Nom du laboratoire |
| `norm` | TEXT | - | - | Norme (ex: NF P94-051) |
| `rho_s_gcm3` | NUMERIC | g/cm³ | 2.0 ≤ ρs ≤ 3.5 | Densité absolue des solides |
| `water_content_w` | NUMERIC | % | 0 ≤ w ≤ 100 | Teneur en eau naturelle |
| `is_index` | NUMERIC | - | 0 ≤ Is ≤ 1 | Indice de gonflement Is |
| `eg` | NUMERIC | % | 0 ≤ eg ≤ 50 | Gonflement œdométrique |
| `commentaire` | TEXT | - | - | Commentaire libre |

#### Mapping

```rust
EchantillonRow {
    code_site: String,                // obligatoire
    depth_m: f64,                     // obligatoire, > 0
    date: Option<String>,
    laboratory: Option<String>,
    norm: Option<String>,
    rho_s_gcm3: Option<f64>,          // CHECK (2.0, 3.5)
    water_content_w: Option<f64>,     // CHECK (0, 100)
    is_index: Option<f64>,            // CHECK (0, 1)
    eg: Option<f64>,                  // CHECK (0, 50)
    commentaire: Option<String>,
}
```

#### Contrainte d'Unicité

```sql
UNIQUE(sondage_id, depth_m, date)
```

**Upsert** : Si doublon → UPDATE des valeurs

#### Validation

- `code_site` doit exister dans feuille `sondages`
- `depth_m > 0`, avertissement si `depth_m > 50.0`
- Contraintes CHECK SQL sur toutes les plages

---

### 3. atterberg ✅

**Nom exact** : `atterberg`

#### Colonnes Obligatoires

| Colonne | Type | Contrainte |
|---------|------|------------|
| `code_site` | TEXT | FK via échantillon |
| `depth_m` | NUMERIC | FK via échantillon |

#### Colonnes Optionnelles (au moins une requise)

| Colonne | Type | Unité | Contrainte | Description |
|---------|------|-------|------------|-------------|
| `wl` | NUMERIC | % | 0 ≤ WL ≤ 200 | Limite de liquidité |
| `wp` | NUMERIC | % | 0 ≤ WP ≤ 200 | Limite de plasticité |

#### Calcul Automatique

```sql
ip_generated NUMERIC GENERATED ALWAYS AS (
  CASE
    WHEN wl IS NOT NULL AND wp IS NOT NULL AND wl >= wp
    THEN wl - wp
    ELSE NULL
  END
) STORED
```

**Stockage** : `ip_generated` calculé automatiquement par PostgreSQL

#### Mapping

```rust
AtterbergRow {
    code_site: String,
    depth_m: f64,
    wl: Option<f64>,    // CHECK (0, 200)
    wp: Option<f64>,    // CHECK (0, 200)
}
```

#### Contrainte d'Unicité

```sql
UNIQUE(echantillon_id)
```

**Un seul essai Atterberg par échantillon**

#### Validation

- Résolution `echantillon_id` via `(code_site, depth_m)`
- Si `wl` et `wp` renseignés : **ERREUR BLOQUANTE** si `wl < wp`
- Au moins `wl` ou `wp` doit être non NULL

---

### 4. vbs ✅

**Nom exact** : `vbs`

#### Colonnes Obligatoires

| Colonne | Type | Contrainte |
|---------|------|------------|
| `code_site` | TEXT | FK via échantillon |
| `depth_m` | NUMERIC | FK via échantillon |
| `vbs` | NUMERIC | 0 ≤ VBS ≤ 20 |

#### Colonnes Optionnelles

| Colonne | Type | Description |
|---------|------|-------------|
| `commentaire` | TEXT | Classification/remarques |

#### Mapping

```rust
VbsRow {
    code_site: String,
    depth_m: f64,
    vbs: f64,                    // CHECK (0, 20), obligatoire
    commentaire: Option<String>,
}
```

#### Contrainte d'Unicité

```sql
UNIQUE(echantillon_id)
```

#### Classification Automatique GTR

| Plage VBS | Classification |
|-----------|----------------|
| VBS < 0.1 | Sol insensible à l'eau |
| 0.1 ≤ VBS < 1.5 | Sol limoneux |
| 1.5 ≤ VBS < 2.5 | Sol limoneux plastique |
| 2.5 ≤ VBS < 6 | Sol argileux |
| VBS ≥ 6 | Sol très argileux |

#### Validation

- `vbs` obligatoire et dans [0, 20]
- Résolution `echantillon_id` via `(code_site, depth_m)`

---

### 5. proctor ✅

**Nom exact** : `proctor`

#### Colonnes Obligatoires

| Colonne | Type | Unité | Contrainte |
|---------|------|-------|------------|
| `code_site` | TEXT | - | FK via échantillon |
| `depth_m` | NUMERIC | m | FK via échantillon |
| `proctor_type` | TEXT | - | `'normal'` OU `'modifie'` |
| `gamma_d_max` | NUMERIC | kN/m³ | 10 ≤ γd ≤ 30 |
| `w_opt` | NUMERIC | % | 0 ≤ wopt ≤ 50 |

#### Mapping

```rust
ProctorRow {
    code_site: String,
    depth_m: f64,
    proctor_type: String,        // CHECK ('normal', 'modifie')
    gamma_d_max: f64,            // CHECK (10, 30)
    w_opt: f64,                  // CHECK (0, 50)
}
```

#### Contrainte d'Unicité

```sql
UNIQUE(echantillon_id, proctor_type)
```

**Permet 2 essais par échantillon** : 1 normal + 1 modifié

#### Validation

- `proctor_type` doit être **exactement** `"normal"` ou `"modifie"` (minuscule)
- `gamma_d_max` en **kN/m³** (pas g/cm³)
- Résolution `echantillon_id` via `(code_site, depth_m)`

---

### 6. granulo_tamisage_large ✅

**Nom exact** : `granulo_tamisage_large`

**Format** : Wide (matriciel)

#### Structure

**Ligne 1 (header)** :
```
| sieve_mm | code_site@depth_m | code_site@depth_m | ... |
```

**Lignes 2+ (data)** :
```
| 25.0  | 100.00 | 100.00 | ... |
| 20.0  | 99.50  | 100.00 | ... |
| ...   | ...    | ...    | ... |
| 0.08  | 82.81  | 77.50  | ... |
```

#### Colonnes

| Colonne | Type | Contrainte | Description |
|---------|------|------------|-------------|
| `sieve_mm` | NUMERIC | > 0 | Diamètre tamis (mm) |
| `<code_site>@<depth_m>` | NUMERIC | 0 ≤ pct ≤ 100 | % passant cumulé |

#### Pattern Série (series_pattern)

**Format** : `<code_site>@<depth_m>`

**Séparateur** : `@`

**Exemples** :
- `Sanfatoute@1`
- `Korbongou@1.5`
- `SiteA@2.0`

**Parsing** :
```rust
let parts: Vec<&str> = sample_key.split('@').collect();
let code_site = parts[0].to_string();
let depth_str = parts[1].replace(',', ".");  // Accepte virgule
let depth_m = depth_str.parse::<f64>()?;
```

#### Transformation Wide → Long

```rust
pub fn transform_large_to_long(large: &GranuloLargeSheet) -> Vec<GranuloPointRow> {
    let mut points = Vec::new();

    for (sample_key, passings) in &large.samples {
        // Parser "code_site@depth_m"
        let (code_site, depth_m) = parse_sample_key(sample_key)?;

        // Créer un point par tamis
        for (idx, &sieve) in large.sieve_mm.iter().enumerate() {
            if let Some(Some(passing)) = passings.get(idx) {
                points.push(GranuloPointRow {
                    code_site: code_site.clone(),
                    depth_m,
                    method: large.method.clone(),  // "tamisage"
                    sieve_mm: sieve,
                    passing_pct: *passing,
                });
            }
        }
    }

    points
}
```

#### Tamis Courants (AFNOR)

**Série principale** : 25, 20, 16, 12.5, 10, 8, 6.3, 5, 4, 3.15, 2.5, 2, 1.6, 1.25, 1, 0.8, 0.63, 0.5, 0.4, 0.315, 0.25, 0.2, 0.16, 0.125, 0.1, **0.08** (mm)

**Seuils clés** :
- **0.08 mm** (80 µm) : % fines (argiles + limons)
- **2 mm** : % sables
- **20 mm** : % graviers

#### Validation

- `sieve_mm > 0`
- `0 ≤ passing_pct ≤ 100`
- Cellules vides → ignorées (pas de point créé)
- Chaque `code_site@depth_m` doit correspondre à un échantillon existant

---

### 7. granulo_sedimento_large ✅

**Nom exact** : `granulo_sedimento_large`

**Format** : Identique à `granulo_tamisage_large`

#### Différences

| Paramètre | Valeur |
|-----------|--------|
| `method` | `"sedimento"` (fixé) |
| Tamis typiques | < 0.08 mm (fraction fine) |

#### Diamètres Équivalents Courants

0.0696, 0.0595, 0.0494, 0.0428, 0.0351, 0.0309, 0.0224, 0.0199, 0.0130, 0.0118, 0.0076, 0.0070, 0.0047, 0.0044, 0.0033, 0.0031, 0.0027, 0.0026, 0.0024, 0.0022, 0.0019, 0.0018, 0.0014, 0.0013 (mm)

**Granulométrie laser** : peut avoir des diamètres différents selon l'appareil

---

### 8. densite 🚧 NON IMPLÉMENTÉE

**Statut** : Feuille non parsée par `xlsx_parser.rs`

**Alternative** : Utiliser `echantillons.rho_s_gcm3`

---

### 9. teneur_eau 🚧 NON IMPLÉMENTÉE

**Statut** : Feuille non parsée par `xlsx_parser.rs`

**Alternative** : Utiliser `echantillons.water_content_w`

---

### 10. classification 🚧 NON IMPLÉMENTÉE

**Statut** : Feuille non parsée par `xlsx_parser.rs`

**Alternative** : Classifications dérivées automatiquement :
- **GTR (Bleu de Méthylène)** : depuis VBS
- **USCS** : depuis granulo + Atterberg
- **HRB/AASHTO** : depuis granulo + IP

---

## Format Wide (Granulo)

### Concept

**Wide** (large) : Profondeurs en colonnes, tamis en lignes

**Long** : Une ligne par mesure (format cible en base de données)

### Avantages Format Wide

| Aspect | Bénéfice |
|--------|----------|
| Saisie | Naturel pour les courbes granulo (lecture laboratoire) |
| Compacité | Moins de lignes dans le fichier Excel |
| Visualisation | Facile de comparer échantillons côte à côte |

### Transformation Automatique

**Trigger** : Lors de l'import, transformation automatique vers format long

**Exemple** :

**Wide (source)** :
```
sieve_mm | S001@1 | S001@2
---------|--------|--------
25       | 100.00 | 100.00
0.08     | 82.81  | 68.75
```

**Long (cible)** :
```sql
INSERT INTO granulo_points VALUES
  (uuid_s001_1m, 'tamisage', 25.0, 100.00),
  (uuid_s001_1m, 'tamisage', 0.08, 82.81),
  (uuid_s001_2m, 'tamisage', 25.0, 100.00),
  (uuid_s001_2m, 'tamisage', 0.08, 68.75);
```

**Résultat** : 4 lignes en base (2 tamis × 2 échantillons)

### Parsing du Pattern

```rust
// Colonne header: "Sanfatoute@1.5"
let parts: Vec<&str> = sample_key.split('@').collect();

if parts.len() != 2 {
    return Err("Format invalide, attendu: code_site@depth_m");
}

let code_site = parts[0].to_string();
let depth_str = parts[1].replace(',', ".");  // Virgule → point
let depth_m = depth_str.parse::<f64>()?;

// Vérifier existence échantillon
let echantillon_id = resolve_echantillon(code_site, depth_m)?;
```

---

## Validation & Contraintes

### Contraintes SQL (CHECK)

```sql
-- echantillons
rho_s_gcm3 >= 2.0 AND rho_s_gcm3 <= 3.5
water_content_w >= 0 AND water_content_w <= 100
is_index >= 0 AND is_index <= 1
eg >= 0 AND eg <= 50

-- essais_atterberg
wl >= 0 AND wl <= 200
wp >= 0 AND wp <= 200

-- essais_vbs
vbs >= 0 AND vbs <= 20

-- essais_proctor
proctor_type IN ('normal', 'modifie')
gamma_d_max >= 10 AND gamma_d_max <= 30
w_opt >= 0 AND w_opt <= 50

-- granulo_points
method IN ('tamisage', 'sedimento')
sieve_mm > 0
passing_pct >= 0 AND passing_pct <= 100
```

### Contraintes d'Unicité

```sql
-- sondages
UNIQUE(code)

-- echantillons
UNIQUE(sondage_id, depth_m, date)

-- essais_atterberg
UNIQUE(echantillon_id)

-- essais_vbs
UNIQUE(echantillon_id)

-- essais_proctor
UNIQUE(echantillon_id, proctor_type)

-- granulo_points
UNIQUE(echantillon_id, method, sieve_mm)
```

### Intégrité Référentielle

```sql
echantillons.sondage_id → sondages.id ON DELETE CASCADE
essais_atterberg.echantillon_id → echantillons.id ON DELETE CASCADE
essais_vbs.echantillon_id → echantillons.id ON DELETE CASCADE
essais_proctor.echantillon_id → echantillons.id ON DELETE CASCADE
granulo_points.echantillon_id → echantillons.id ON DELETE CASCADE
```

### Validation Cohérence Physique

| Test | Règle | Action si Violation |
|------|-------|---------------------|
| Atterberg | WL ≥ WP | ERREUR bloquante |
| Granulo | Passants monotones | AVERTISSEMENT |
| Profondeur | depth_m > 0 | ERREUR bloquante |
| Géolocalisation | Coordonnées dans Togo | ERREUR si mode=exact |

---

## Transformation & Synchronisation

### Synchronisation Automatique vers essais_geotechniques

**Mécanisme** : Triggers SQL après INSERT/UPDATE/DELETE

```sql
CREATE TRIGGER trg_sync_echantillon_to_eg
AFTER INSERT OR UPDATE ON echantillons
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

CREATE TRIGGER trg_sync_atterberg_to_eg
AFTER INSERT OR UPDATE OR DELETE ON essais_atterberg
FOR EACH ROW
EXECUTE FUNCTION sync_to_essais_geotechniques();

-- Idem pour vbs, proctor, granulo_points
```

**Fonction** : `sync_to_essais_geotechniques()`

**Rôle** : Maintenir compatibilité avec table historique `essais_geotechniques` (cartes thématiques)

### Calcul Passants Synthétiques

**Fonction** : `calculate_passant_synthetic(echantillon_id UUID)`

**Retour** : `(passant_80um, passant_2mm, passant_20mm)`

**Méthode** :
1. Recherche valeur exacte pour tamis cible
2. Si absent : interpolation linéaire entre tamis encadrants
3. Si tamis plus petit non disponible : prendre dernière valeur connue

**Exemples** :
```sql
-- Passant 80µm (0.08 mm)
SELECT calculate_passant_synthetic('<uuid>');
-- → (82.81, 95.09, 100.00)

-- Utilisation dans v_echantillons_complets
SELECT passant_80um, passant_2mm, passant_20mm
FROM v_echantillons_complets
WHERE echantillon_id = '<uuid>';
```

### Vue Matérialisée

**Nom** : `mailles_geotechnique_stats`

**Refresh** : Automatique via `refresh_queue`

**Contenu** : Agrégations par maille (IP moyen, VBS moyen, eg moyen, etc.)

---

## Exemples Complets

### Exemple Minimal (2 sondages, 3 échantillons)

#### sondages
```
code_site  | localite   | date       | adm3
-----------|------------|------------|--------
Sanfatoute | Sanfatoute | 2025-10-20 | Mandouri
Korbongou  | Korbongou  | 2025-10-21 | Kpendjal
```

#### echantillons
```
code_site  | depth_m | laboratory
-----------|---------|------------
Sanfatoute | 1.0     | Labo Atlas
Sanfatoute | 2.0     | Labo Atlas
Korbongou  | 1.0     | Labo Atlas
```

#### atterberg
```
code_site  | depth_m | wl    | wp
-----------|---------|-------|------
Sanfatoute | 1.0     | 57.57 | 25.06
Sanfatoute | 2.0     | 32.46 | 23.83
```

#### granulo_tamisage_large
```
sieve_mm | Sanfatoute@1 | Sanfatoute@2
---------|--------------|-------------
25       | 100.00       | 100.00
0.08     | 82.81        | 68.75
```

**Résultat Import** :
- 2 sondages créés
- 3 échantillons créés
- 2 essais Atterberg créés
- 4 points granulo créés (2 tamis × 2 échantillons Sanfatoute)

### Exemple Complet (tous essais)

Voir fichier : [atlas_import_example.xlsx](atlas_import_example.xlsx) (généré par `make_atlas_example_xlsx.py`)

---

## Annexes

### Codes d'Erreur

| Code | Message | Cause | Solution |
|------|---------|-------|----------|
| E001 | `code_site manquant ligne X` | Cellule vide | Remplir code_site |
| E002 | `depth_m manquant ligne X` | Profondeur absente | Ajouter depth_m |
| E003 | `Échantillon X@Y: sondage introuvable` | FK violation | Créer sondage dans feuille `sondages` |
| E004 | `Atterberg X@Y: échantillon introuvable` | FK violation | Créer échantillon dans feuille `echantillons` |
| E005 | `WL < WP` | Incohérence physique | Vérifier valeurs (WL doit être ≥ WP) |
| E006 | `Longitude hors du Togo: Z` | Coordonnée invalide | Vérifier lon ∈ [-1, 2] |
| E007 | `Latitude hors du Togo: Z` | Coordonnée invalide | Vérifier lat ∈ [6, 11.5] |
| E008 | `proctor_type invalide` | Valeur incorrecte | Utiliser `"normal"` ou `"modifie"` |

### Normalisation des En-Têtes

**Règle** : `header.to_lowercase()` lors du parsing

**Exemples acceptés** :
| Source | Normalisé |
|--------|-----------|
| `Code_Site` | `code_site` |
| `DEPTH_M` | `depth_m` |
| `WL` | `wl` |

### Séparateurs Décimaux

**Acceptés** : Point (`.`) et virgule (`,`)

**Normalisation** : `.replace(',', '.')`

**Exemples** :
- `1.5` et `1,5` → `1.5` ✅
- `82.81` et `82,81` → `82.81` ✅

### Formats de Date

**Format attendu** : ISO 8601 (`YYYY-MM-DD`)

**Parsing** : `NaiveDate::parse_from_str(date, "%Y-%m-%d")`

**Exemples** :
- `2025-10-20` ✅
- `20/10/2025` ❌ (non supporté)

### Références Code Source

| Composant | Fichier | Lignes Clés |
|-----------|---------|-------------|
| Parser XLSX | `services/api-geo/src/import_bulk/xlsx_parser.rs` | 96-529 |
| Structures | `services/api-geo/src/import_bulk/types.rs` | 22-90 |
| Importer | `services/api-geo/src/import_bulk/geotechnical_importer.rs` | 45-441 |
| Validator | `services/api-geo/src/import_bulk/validator.rs` | 81-122 |
| Migration | `db/migrations/011_geotechnical_detailed_import.sql` | 1-437 |

---

**Document Version** : 1.0
**Date** : 24 octobre 2025
**Auteur** : Analyse automatisée du code source Atlas
**Statut** : ✅ Validé conforme au code (commit actuel)
**Licence** : Projet Atlas

