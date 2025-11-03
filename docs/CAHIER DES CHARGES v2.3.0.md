# 📋 CAHIER DES CHARGES v2.3.0
## Atlas Géotechnique - Import Wizard "QGIS-Level"

---

## 🎯 Vision & Objectifs

### Vision
Transformer l'import de données géotechniques en une expérience fluide, robuste et professionnelle, comparable aux outils SIG de référence (QGIS, ArcGIS), tout en restant simple et accessible.

### Objectifs Principaux
1. **Simplicité d'accès** : Boutons directs, pas de dépendances illogiques
2. **Robustesse** : Validation métier, dry-run, transactions atomiques
3. **Flexibilité** : Multi-formats, multi-CRS, presets intelligents
4. **Traçabilité** : Logs persistants, undo, audit trail
5. **Performance** : Streaming, chunks, indexation optimale

---

## 🏗️ Architecture Globale

### Composants Principaux

```
┌─────────────────────────────────────────────────────────┐
│                    PANNEAU DROIT                        │
├─────────────────────────────────────────────────────────┤
│  ✏️ Sondages                                         ▼ │
│                                                         │
│  [🧪 Nouveau Géotechnique]  ← Bouton direct           │
│  [📥 Import Wizard]          ← Bouton direct           │
│  [📋 Liste Sondages]                                   │
│  [🗺️ Géocoder]                                         │
│  [🤖 Suggestions]                                      │
└─────────────────────────────────────────────────────────┘
                          ↓
┌─────────────────────────────────────────────────────────┐
│              MODAL IMPORT WIZARD (Plein écran)          │
├─────────────────────────────────────────────────────────┤
│  Step 1: Upload    →  Step 2: Mapping  →               │
│  Step 3: Géométrie →  Step 4: Preview  →               │
│  Step 5: Import                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 📐 Spécifications Détaillées

### 1️⃣ **STEP 1 : Upload & Détection**

#### 1.1 Interface

```
┌────────────────────────────────────────────────────────┐
│  📥 Import Wizard - Étape 1/5 : Upload              × │
├────────────────────────────────────────────────────────┤
│                                                        │
│  ┌──────────────────────────────────────────────────┐ │
│  │  📁 Glissez-déposez votre fichier ici            │ │
│  │     ou cliquez pour parcourir                    │ │
│  │                                                   │ │
│  │  Formats acceptés : CSV, XLSX, XLS               │ │
│  │  Taille max : 50 MB                              │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  📦 Modèles disponibles :                             │
│  [📥 atlas_import_ready.xlsx]  [📥 CSV_Sondages]     │
│  [📥 CSV_Atterberg]  [📥 CSV_VBS]  [📥 Granulo]      │
│                                                        │
│  ⚙️ Options avancées                               ▼ │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Encodage      : [UTF-8 ▼] (auto-détecté)        │ │
│  │ Délimiteur    : [Auto ▼] (virgule, point-virgule)│ │
│  │ Décimal       : [. (point) ▼]                    │ │
│  │ Milliers      : [Aucun ▼]                        │ │
│  │ Ignorer lignes: [0] premières lignes            │ │
│  │ ☑ Réduire espaces multiples                     │ │
│  │ ☑ Champs vides → NULL                           │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  [Annuler]                          [Suivant →]       │
└────────────────────────────────────────────────────────┘
```

#### 1.2 Fonctionnalités

**Upload**
- Drag & drop + sélecteur fichier
- Extensions autorisées : `.csv`, `.xlsx`, `.xls`
- Taille max : 50 MB (configurable)
- Hash SHA-256 du fichier (idempotence)
- Détection MIME type

**Auto-détection**
- **Encodage** : UTF-8, ISO-8859-1, Windows-1252
- **Délimiteur** : `,` `;` `\t` `|` (fréquence)
- **Décimal** : `.` ou `,` (analyse colonnes numériques)
- **En-têtes** : Détection première ligne

**Modèles Téléchargeables**

| Modèle | Description | Colonnes |
|--------|-------------|----------|
| `atlas_import_ready.xlsx` | Multi-feuilles complet | Sondages, Échantillons, Atterberg, VBS, Granulo |
| `CSV_Sondages` | Sondages seuls | code_site, localite, date, lon, lat, adm3_code |
| `CSV_Atterberg` | Essais Atterberg | code_site, depth_m, wl, wp, ip |
| `CSV_VBS` | Essais VBS | code_site, depth_m, vbs |
| `Granulo_long` | Granulo format long | code_site, depth_m, tamis_mm, passant_pct |
| `Granulo_wide` | Granulo format large | code_site, depth_m, t_80, t_40, t_20... |

**Validation Upload**
- ✅ Fichier non vide
- ✅ Taille < limite
- ✅ Extension valide
- ✅ Lecture réussie (pas corrompu)
- ✅ Au moins 1 ligne de données

---

### 2️⃣ **STEP 2 : Mapping & Presets**

#### 2.1 Interface

```
┌────────────────────────────────────────────────────────┐
│  📥 Import Wizard - Étape 2/5 : Mapping             × │
├────────────────────────────────────────────────────────┤
│                                                        │
│  🎯 Presets Atlas (1 clic) :                          │
│  [Sondages complets] [Atterberg seul] [VBS seul]     │
│  [Granulo long] [Granulo wide] [Custom]               │
│                                                        │
│  📊 Aperçu fichier (5 premières lignes) :            │
│  ┌──────────────────────────────────────────────────┐ │
│  │ code_site │ localite │ lon    │ lat   │ wl │ wp │ │
│  │ S-001     │ Lomé     │ 1.2345 │ 6.123 │ 45 │ 22 │ │
│  │ S-002     │ Kara     │ 1.1890 │ 9.551 │ 38 │ 19 │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  🔗 Correspondances :                                 │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Champ Atlas          Colonne Fichier    Type     │ │
│  │ ─────────────────────────────────────────────    │ │
│  │ Code sondage    ←   [code_site ▼]      📝 Texte │ │
│  │ Localité        ←   [localite ▼]       📝 Texte │ │
│  │ Date            ←   [date ▼]           📅 Date  │ │
│  │ Longitude       ←   [lon ▼]            🔢 Nombre│ │
│  │ Latitude        ←   [lat ▼]            🔢 Nombre│ │
│  │ Profondeur (m)  ←   [depth_m ▼]        🔢 Nombre│ │
│  │ WL (%)          ←   [wl ▼]             🔢 Nombre│ │
│  │ WP (%)          ←   [wp ▼]             🔢 Nombre│ │
│  │ VBS             ←   [vbs ▼]            🔢 Nombre│ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  🔑 Clés d'unicité (évite doublons) :                │
│  Sondage      : ☑ code_site                          │
│  Échantillon  : ☑ code_site + depth_m                │
│  Essai        : ☑ code_site + depth_m + type_essai   │
│                                                        │
│  ⚔️ Politique de conflit :                            │
│  ○ Skip (ignorer)  ● Update (MAJ si plus récent)     │
│  ○ Duplicate (créer doublon avec suffixe)            │
│                                                        │
│  [← Précédent]                      [Suivant →]      │
└────────────────────────────────────────────────────────┘
```

#### 2.2 Presets Intelligents

**Preset "Sondages complets"**
```json
{
  "name": "Sondages complets",
  "mapping": {
    "code": ["code_site", "code_sondage", "site_code", "survey_code"],
    "localite": ["localite", "locality", "location", "lieu"],
    "date": ["date", "date_sondage", "survey_date"],
    "lon": ["lon", "longitude", "x", "est", "e"],
    "lat": ["lat", "latitude", "y", "nord", "n"],
    "source": ["source", "entreprise", "company", "labo"],
    "operator": ["operator", "operateur", "equipe", "team"],
    "adm3_code": ["adm3", "commune", "adm3_code"]
  },
  "keys": {
    "sondage": ["code"],
    "echantillon": ["code", "depth_m"],
    "essai": ["code", "depth_m", "type"]
  },
  "conflict_policy": "update"
}
```

**Inférence Automatique** (Regex)
```typescript
const inferenceRules = {
  lon: /^(lon|longitude|x|est|e|easting)$/i,
  lat: /^(lat|latitude|y|nord|n|northing)$/i,
  wl: /^(wl|limite.*liquid|liquid.*limit)$/i,
  wp: /^(wp|limite.*plastic|plastic.*limit)$/i,
  ip: /^(ip|indice.*plastic|plasticity.*index)$/i,
  vbs: /^(vbs|bleu|methylene)$/i,
  depth: /^(depth|prof|profondeur|z)$/i
}
```

#### 2.3 Types de Données

| Icône | Type | Validation | Format |
|-------|------|------------|--------|
| 📝 | Texte | Longueur max | Trim, normalize |
| 🔢 | Nombre | Range, décimal | Parse float/int |
| 📅 | Date | Format valide | YYYY-MM-DD, DD/MM/YYYY, ISO |
| ✅ | Booléen | true/false | 1/0, oui/non, true/false |
| 🌍 | Géométrie | WKT/EWKT | ST_GeomFromText |

---

### 3️⃣ **STEP 3 : Géométrie & CRS**

#### 3.1 Interface

```
┌────────────────────────────────────────────────────────┐
│  📥 Import Wizard - Étape 3/5 : Géométrie           × │
├────────────────────────────────────────────────────────┤
│                                                        │
│  🌍 Mode géométrique :                                │
│  ● Point (X/Y)                                        │
│  ○ Point (Lon/Lat)                                    │
│  ○ Point (E/N - UTM)                                  │
│  ○ WKT/EWKT                                           │
│  ○ Pas de géométrie                                   │
│                                                        │
│  📐 Système de coordonnées d'entrée :                 │
│  [EPSG:4326 - WGS 84 ▼]                              │
│  Rechercher : [UTM Zone 31N...]                       │
│                                                        │
│  ☑ Coordonnées en DMS (Degrés Minutes Secondes)      │
│                                                        │
│  🔄 Reprojection automatique :                        │
│  EPSG:4326 (WGS 84) → EPSG:25231 (UTM 31N Togo)     │
│                                                        │
│  🗺️ Aperçu (5 premiers points) :                     │
│  ┌──────────────────────────────────────────────────┐ │
│  │         [Mini-carte Leaflet]                     │ │
│  │  • S-001 (Lomé)   ✓ Dans limites Togo           │ │
│  │  • S-002 (Kara)   ✓ Dans limites Togo           │ │
│  │  • S-003 (Sokodé) ✓ Dans limites Togo           │ │
│  │  • S-004 (Dapaong)⚠️ Hors limites (vérifier)    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ⚠️ Validation géographique :                         │
│  ☑ Vérifier limites Togo (bbox)                      │
│  ☑ Rejeter coordonnées invalides (0,0 ou NULL)       │
│                                                        │
│  [← Précédent]                      [Suivant →]      │
└────────────────────────────────────────────────────────┘
```

#### 3.2 Systèmes de Coordonnées

**CRS Pré-configurés**

| EPSG | Nom | Usage |
|------|-----|-------|
| 4326 | WGS 84 | GPS, coordonnées géographiques |
| 25231 | UTM Zone 31N (Togo) | Stockage Atlas |
| 32631 | WGS 84 / UTM 31N | Alternative |
| 2043 | Abidjan 1987 / UTM 31N | Ancien système Togo |

**Reprojection**
```sql
-- Automatique via ST_Transform
ST_Transform(
  ST_SetSRID(ST_MakePoint(lon, lat), 4326),
  25231
)
```

**Validation Bbox Togo**
```typescript
const TOGO_BBOX = {
  minLon: -0.15, maxLon: 1.81,
  minLat: 6.10,  maxLat: 11.14
}
```

---

### 4️⃣ **STEP 4 : Preview & Validation**

#### 4.1 Interface

```
┌────────────────────────────────────────────────────────┐
│  📥 Import Wizard - Étape 4/5 : Preview & Validation× │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📊 Statistiques (Dry-run) :                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ✅ 45 sondages à créer                           │ │
│  │ 🔄 12 sondages à mettre à jour                   │ │
│  │ ⏭️  3 sondages ignorés (doublons)                │ │
│  │ ✅ 234 essais à créer                            │ │
│  │ ❌ 8 erreurs bloquantes                          │ │
│  │ ⚠️ 15 avertissements                             │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ❌ Erreurs (8) :                                     │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Ligne│Col    │Message              │Solution     │ │
│  │──────│───────│─────────────────────│─────────────│ │
│  │ 12   │wl     │WL=105 > 100%        │Corriger val │ │
│  │ 23   │wp     │WP=45 > WL=38        │WP ≤ WL      │ │
│  │ 34   │lon    │Hors limites Togo    │Vérifier GPS │ │
│  │ 45   │date   │Format invalide      │YYYY-MM-DD   │ │
│  │ 56   │code   │Code vide (requis)   │Renseigner   │ │
│  │ [📥 Exporter erreurs CSV]                        │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ⚠️ Avertissements (15) :                             │
│  • 5 sondages sans coordonnées (géocodage requis)    │
│  • 10 essais avec VBS=0 (vérifier)                   │
│                                                        │
│  📋 Aperçu données (50 premières lignes) :           │
│  ┌──────────────────────────────────────────────────┐ │
│  │ Code  │Localité│Lon   │Lat  │WL│WP│IP│Action    │ │
│  │───────│────────│──────│─────│──│──│──│──────────│ │
│  │✅S-001│Lomé    │1.234 │6.12 │45│22│23│Créer     │ │
│  │🔄S-002│Kara    │1.189 │9.55 │38│19│19│MAJ       │ │
│  │⏭️S-003│Sokodé  │1.145 │8.98 │42│20│22│Ignorer   │ │
│  │❌S-004│Dapaong │NULL  │NULL │50│25│25│Erreur    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  ☑ Recalculer KPI/IDW des mailles impactées          │
│                                                        │
│  [← Précédent]  [🔄 Re-valider]  [Importer →]       │
└────────────────────────────────────────────────────────┘
```

#### 4.2 Règles de Validation Métier

**Atterberg**
```typescript
const atterbergRules = {
  wl: { min: 0, max: 100, unit: '%' },
  wp: { min: 0, max: 100, unit: '%' },
  ip: { min: 0, max: 100, unit: '%' },
  // Relations
  wpLessThanWl: (wp, wl) => wp <= wl,
  ipEqualsWlMinusWp: (ip, wl, wp) => Math.abs(ip - (wl - wp)) < 1
}
```

**VBS**
```typescript
const vbsRules = {
  vbs: { min: 0, max: 50, unit: 'g/100g' }
}
```

**Granulométrie**
```typescript
const granuloRules = {
  monotone: (tamis) => {
    // Passants décroissants quand tamis croissants
    for (let i = 1; i < tamis.length; i++) {
      if (tamis[i].passant > tamis[i-1].passant) {
        return false
      }
    }
    return true
  },
  minPoints: 3 // Au moins 3 tamis pour calculer indices
}
```

**Géométrie**
```typescript
const geoRules = {
  togoBbox: (lon, lat) => 
    lon >= -0.15 && lon <= 1.81 &&
    lat >= 6.10 && lat <= 11.14,
  notNull: (lon, lat) => lon !== null && lat !== null,
  notZero: (lon, lat) => lon !== 0 || lat !== 0
}
```

#### 4.3 Tableau d'Erreurs

**Structure**
```typescript
interface ValidationError {
  row: number
  column: string
  code: string // 'WL_OUT_OF_RANGE', 'WP_GT_WL', etc.
  message: string
  severity: 'error' | 'warning'
  hint: string // Solution proposée
  value: any // Valeur problématique
}
```

**Export CSV Erreurs**
```csv
Ligne,Colonne,Code,Message,Sévérité,Valeur,Solution
12,wl,WL_OUT_OF_RANGE,WL=105 > 100%,error,105,Corriger la valeur (0-100)
23,wp,WP_GT_WL,WP=45 > WL=38,error,45,WP doit être ≤ WL
```

---

### 5️⃣ **STEP 5 : Import & Journal**

#### 5.1 Interface

```
┌────────────────────────────────────────────────────────┐
│  📥 Import Wizard - Étape 5/5 : Import              × │
├────────────────────────────────────────────────────────┤
│                                                        │
│  🚀 Import en cours...                                │
│                                                        │
│  ████████████████████░░░░░░░░  75% (180/240)         │
│                                                        │
│  📊 Progression :                                     │
│  ✅ 45 sondages créés                                 │
│  🔄 12 sondages mis à jour                            │
│  ✅ 180 essais créés (sur 234)                        │
│  ⏱️ Temps écoulé : 12s                                │
│  ⏱️ Temps restant : ~4s                               │
│                                                        │
│  📝 Logs en temps réel :                              │
│  ┌──────────────────────────────────────────────────┐ │
│  │ [14:23:45] Création sondage S-001...      ✓      │ │
│  │ [14:23:46] Création essai WL S-001 @ 1.5m ✓      │ │
│  │ [14:23:46] Création essai WP S-001 @ 1.5m ✓      │ │
│  │ [14:23:47] MAJ sondage S-002 (plus récent) ✓     │ │
│  │ [14:23:48] Recalcul IDW maille TG-0557-0167 ✓    │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  [Annuler l'import]                                   │
└────────────────────────────────────────────────────────┘
```

**Succès**
```
┌────────────────────────────────────────────────────────┐
│  ✅ Import terminé avec succès !                      │
├────────────────────────────────────────────────────────┤
│                                                        │
│  📊 Résumé :                                          │
│  ┌──────────────────────────────────────────────────┐ │
│  │ ✅ 45 sondages créés                             │ │
│  │ 🔄 12 sondages mis à jour                        │ │
│  │ ⏭️  3 sondages ignorés                           │ │
│  │ ✅ 234 essais créés                              │ │
│  │ 🔄 15 mailles recalculées                        │ │
│  │ ⏱️ Durée totale : 16s                            │ │
│  └──────────────────────────────────────────────────┘ │
│                                                        │
│  🔖 Batch ID : #IMP-20250129-142345                   │
│                                                        │
│  📥 Actions :                                         │
│  [📄 Télécharger rapport complet]                    │
│  [📊 Voir les données importées]                     │
│  [↩️ Annuler cet import (Undo)]                       │
│  [✕ Fermer]                                           │
└────────────────────────────────────────────────────────┘
```

#### 5.2 Système de Batch & Undo

**Batch ID**
```
Format: IMP-YYYYMMDD-HHMMSS
Exemple: IMP-20250129-142345
```

**Undo Mécanique**
```sql
-- Soft delete avec batch_id
UPDATE sondages 
SET deleted_at = now(), deleted_by_batch = 'IMP-20250129-142345'
WHERE created_by_batch = 'IMP-20250129-142345';

UPDATE essais_geotechniques
SET deleted_at = now(), deleted_by_batch = 'IMP-20250129-142345'
WHERE created_by_batch = 'IMP-20250129-142345';

-- Ou rollback complet si staging
DELETE FROM sondages WHERE batch_id = 'IMP-20250129-142345';
```

**Journal Persistant**
```typescript
interface ImportLog {
  id: string // UUID
  batch_id: string
  filename: string
  sha256: string
  user_id: string
  created_at: Date
  status: 'pending' | 'running' | 'completed' | 'failed' | 'undone'
  params: {
    mapping: object
    crs_in: string
    conflict_policy: string
    // ...
  }
  stats: {
    created: number
    updated: number
    skipped: number
    errors: number
  }
}
```

---

## 🔌 API Backend

### Endpoints

#### **POST /imports**
Créer une session d'import

**Request**
```json
{
  "filename": "sondages_2025.csv",
  "size": 1048576,
  "sha256": "a3f5b8c..."
}
```

**Response**
```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "batch_id": "IMP-20250129-142345",
  "status": "pending",
  "upload_url": "/imports/550e8400.../upload"
}
```

---

#### **POST /imports/{id}/preview**
Dry-run avec validation

**Request**
```json
{
  "mapping": {
    "code": "code_site",
    "lon": "longitude",
    "lat": "latitude",
    "wl": "wl",
    "wp": "wp"
  },
  "crs_in": "EPSG:4326",
  "decimal": ".",
  "thousands": "",
  "conflict_policy": "update",
  "encoding": "UTF-8",
  "delimiter": ","
}
```

**Response**
```json
{
  "stats": {
    "total_rows": 60,
    "to_create": 45,
    "to_update": 12,
    "to_skip": 3,
    "errors": 8,
    "warnings": 15
  },
  "sample_rows": [
    {
      "row": 1,
      "data": {"code": "S-001", "lon": 1.2345, "lat": 6.123},
      "action": "create",
      "status": "valid"
    }
  ],
  "errors": [
    {
      "row": 12,
      "column": "wl",
      "code": "WL_OUT_OF_RANGE",
      "message": "WL=105 > 100%",
      "severity": "error",
      "value": 105,
      "hint": "Corriger la valeur (0-100)"
    }
  ]
}
```

---

#### **POST /imports/{id}/commit**
Lancer l'import réel

**Request**
```json
{
  "recalculate_grids": true
}
```

**Response** (Stream SSE)
```
event: progress
data: {"current": 45, "total": 234, "message": "Création sondage S-001"}

event: progress
data: {"current": 180, "total": 234, "message": "Création essai WL S-001 @ 1.5m"}

event: complete
data: {"created": 45, "updated": 12, "skipped": 3, "errors": 0, "duration_ms": 16000}
```

---

#### **GET /imports/{id}/log**
Télécharger le rapport

**Response** (CSV)
```csv
Timestamp,Action,Entity,Code,Status,Message
2025-01-29 14:23:45,CREATE,sondage,S-001,success,Sondage créé
2025-01-29 14:23:46,CREATE,essai,S-001@1.5m WL,success,Essai créé
```

---

#### **POST /imports/{id}/undo**
Annuler un import

**Response**
```json
{
  "undone": {
    "sondages": 45,
    "essais": 

# 📋 CAHIER DES CHARGES v2.3.0
## Atlas Géotechnique - Import Wizard "QGIS-Level"

---

## 🎯 Vision

Transformer l'import de données géotechniques en une expérience fluide, robuste et professionnelle, comparable aux outils SIG de référence (QGIS), tout en restant simple.

---

## 🏗️ Architecture UI

### Panneau Droit Simplifié

```
┌─────────────────────────────────┐
│ ✏️ Sondages                  ▼ │
├─────────────────────────────────┤
│ [🧪 Nouveau Géotechnique]       │
│ [📥 Import Wizard]              │
│ [📋 Liste Sondages]             │
│ [🗺️ Géocoder]                   │
│ [🤖 Suggestions]                │
└─────────────────────────────────┘


**Changements** :
- ❌ Suppression dropdown "Nouveau ▼"
- ❌ Suppression drawer du bas (legacy)
- ✅ 2 boutons directs
- ✅ Modales plein écran

---

## 📐 Import Wizard - 5 Steps

### **Step 1 : Upload**

**UI** :
- Drag & drop + sélecteur fichier
- Formats : CSV, XLSX, XLS (max 50 MB)
- Modèles téléchargeables (6 presets)

**Options** :
- Encodage : UTF-8 (auto-détecté)
- Délimiteur : Auto (`,` `;` `\t`)
- Décimal : `.` ou `,`
- Ignorer N premières lignes
- Champs vides → NULL

**Validation** :
- Hash SHA-256 (idempotence)
- Taille, extension, lecture

---

### **Step 2 : Mapping**

**Presets 1-clic** :
1. Sondages complets
2. Atterberg seul
3. VBS seul
4. Granulo long
5. Granulo wide
6. Custom

**Inférence auto** (regex) :
- `lon|longitude|x|est` → Longitude
- `lat|latitude|y|nord` → Latitude
- `wl|limite.*liquid` → WL
- `depth|prof` → Profondeur

**Types** :
- 📝 Texte, 🔢 Nombre, 📅 Date, ✅ Bool, 🌍 Géométrie

**Clés unicité** :
- Sondage : `code_site`
- Échantillon : `code_site + depth_m`
- Essai : `code_site + depth_m + type`

**Politique conflit** :
- Skip / Update / Duplicate

---

### **Step 3 : Géométrie**

**Modes** :
- Point (X/Y, Lon/Lat, E/N)
- WKT/EWKT
- Pas de géométrie

**CRS** :
- Sélecteur EPSG (4326, 25231, 32631...)
- Auto-reprojection vers EPSG:25231
- Support DMS (Degrés Minutes Secondes)

**Validation** :
- Bbox Togo : lon[-0.15, 1.81], lat[6.10, 11.14]
- Rejeter (0,0) ou NULL

**Aperçu** :
- Mini-carte Leaflet (5 premiers points)

---

### **Step 4 : Preview & Validation**

**Dry-run** (aucun insert) :
- Stats : N créés, M MAJ, K ignorés, X erreurs
- Aperçu 50 lignes
- Tableau erreurs interactif

**Règles métier** :
- WL/WP : 0-100%, WP ≤ WL
- VBS ≥ 0
- Granulo monotone, ≥3 points
- Géométrie dans bbox

**Export erreurs CSV** :
```csv
Ligne,Colonne,Code,Message,Valeur,Solution
12,wl,WL_OUT_OF_RANGE,WL=105>100%,105,Corriger (0-100)
```

---

### **Step 5 : Import**

**Progress bar** :
- % complétion, temps écoulé/restant
- Logs temps réel

**Batch ID** :
- Format : `IMP-YYYYMMDD-HHMMSS`
- Traçabilité complète

**Post-import** :
- Rapport téléchargeable
- Undo (soft-delete par batch_id)
- Option recalcul KPI/IDW mailles

---

## 🔌 API Backend

### Endpoints

| Méthode | Route | Description |
|---------|-------|-------------|
| POST | `/imports` | Créer session |
| POST | `/imports/{id}/preview` | Dry-run + validation |
| POST | `/imports/{id}/commit` | Import réel (SSE) |
| GET | `/imports/{id}/log` | Télécharger rapport CSV |
| POST | `/imports/{id}/undo` | Annuler import |

### Base de Données

```sql
-- Table imports
CREATE TABLE imports (
  id UUID PRIMARY KEY,
  batch_id TEXT UNIQUE,
  filename TEXT,
  sha256 TEXT,
  user_id TEXT,
  status TEXT, -- pending|running|completed|failed|undone
  params JSONB,
  stats JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Table import_errors
CREATE TABLE import_errors (
  id UUID PRIMARY KEY,
  import_id UUID REFERENCES imports(id),
  row_no INT,
  column_name TEXT,
  error_code TEXT,
  message TEXT,
  severity TEXT, -- error|warning
  value TEXT,
  hint TEXT
);

-- Colonnes batch tracking
ALTER TABLE sondages ADD COLUMN created_by_batch TEXT;
ALTER TABLE sondages ADD COLUMN deleted_by_batch TEXT;
ALTER TABLE essais_geotechniques ADD COLUMN created_by_batch TEXT;
```

---

## ⚙️ Fonctionnalités Avancées

### Feature Flags

```typescript
const FEATURES = {
  advancedMapping: true,
  undoImport: true,
  multiSheetExcel: true,
  dmsCoordinates: true,
  granuloInference: false // v2.4.0
}
```

### Raccourcis Clavier

- `Ctrl+U` : Ouvrir Import Wizard
- `Ctrl+Enter` : Suivant
- `Escape` : Fermer modal

### Accessibilité

- Focus trap dans modales
- `aria-labels` sur tous les contrôles
- Contraste WCAG AA

---

## 📊 Métriques de Succès

| Métrique | Cible |
|----------|-------|
| Temps upload → import | < 30s (1000 lignes) |
| Taux erreurs détectées | > 95% |
| Satisfaction utilisateur | > 4/5 |
| Imports annulés (bugs) | < 5% |

---

## 🚀 Plan d'Implémentation

### Phase 1 : Nettoyage (2h)
- [ ] Supprimer dropdown + drawer legacy
- [ ] 2 boutons directs
- [ ] Composant Modal réutilisable

### Phase 2 : Steps 1-2 (4h)
- [ ] Upload + auto-détection
- [ ] Mapping + presets
- [ ] Inférence colonnes

### Phase 3 : Steps 3-4 (4h)
- [ ] Géométrie + CRS
- [ ] Preview + validation métier
- [ ] Tableau erreurs

### Phase 4 : Step 5 + API (4h)
- [ ] Import avec SSE
- [ ] Batch tracking
- [ ] Undo système

### Phase 5 : Polish (2h)
- [ ] Raccourcis clavier
- [ ] Animations
- [ ] Documentation

**Total estimé** : 16h

---

## ✅ Critères d'Acceptation

1. ✅ Clic "Import Wizard" → Modal s'ouvre
2. ✅ Upload CSV → Auto-détection encodage/délimiteur
3. ✅ Preset "Sondages complets" → Mapping automatique
4. ✅ Preview → Erreurs affichées avec solutions
5. ✅ Import → Progress bar + logs temps réel
6. ✅ Undo → Annulation complète en 1 clic
7. ✅ Pas de dépendance maille
8. ✅ Cohérence UI (modales partout)

---

**Version** : v2.3.0  
**Date** : 2025-01-29  
**Statut** : ✅ Validé, prêt pour implémentation