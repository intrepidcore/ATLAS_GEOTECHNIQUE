# 🔧 Décisions Techniques - Import Bulk

**Date:** 19 octobre 2025  
**Version:** 1.0  
**Statut:** ✅ Validé pour implémentation

---

## ⚙️ Décisions Bloquantes (Prises)

### 1. Clé d'Unicité d'Import ✅

**Décision:** Option A (recommandée)

**Implémentation:**
```sql
-- Table imports
CREATE TABLE imports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  content_hash TEXT NOT NULL, -- SHA256 du fichier
  created_by TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  mapping_json JSONB NOT NULL, -- Configuration mapping utilisée
  geoloc_mode TEXT NOT NULL, -- centroid/unknown/random/maille
  seed INTEGER, -- Pour mode random
  status TEXT NOT NULL, -- pending/running/succeeded/failed/partial
  stats_json JSONB, -- {sondages: 12, essais: 36, warnings: 2, errors: 0}
  file_blob BYTEA -- Fichier brut sauvegardé
);

-- Table import_items (traçabilité ligne par ligne)
CREATE TABLE import_items (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES imports(id) ON DELETE CASCADE,
  row_idx INTEGER NOT NULL, -- Numéro de ligne dans le fichier source
  status TEXT NOT NULL, -- ok/warning/error
  error_msg TEXT,
  created_survey_id UUID REFERENCES sondages(id),
  created_tests_count INTEGER DEFAULT 0,
  raw_json JSONB, -- Ligne source brute
  fingerprint TEXT, -- hash(localite, date, type_essai, profondeur_m, valeur)
  UNIQUE(import_id, row_idx)
);

-- Index pour anti-doublon
CREATE INDEX idx_import_items_fingerprint ON import_items(fingerprint);
CREATE INDEX idx_import_items_import_id ON import_items(import_id);
```

**Fingerprint anti-doublon:**
```python
def compute_fingerprint(row):
    key = f"{row['localite']}|{row['date']}|{row['type_essai']}|{row['profondeur_m']}|{row['valeur']}"
    return hashlib.sha256(key.encode()).hexdigest()[:16]
```

### 2. Politique d'Unités ✅

**Décision:** Table de référence + conversion automatique

**Implémentation:**
```sql
CREATE TABLE test_type_defaults (
  type_essai TEXT PRIMARY KEY,
  default_unit TEXT NOT NULL,
  min_value NUMERIC,
  max_value NUMERIC,
  accepted_units TEXT[], -- Unités acceptées avec conversion
  converter_fn TEXT -- Nom de la fonction de conversion
);

INSERT INTO test_type_defaults VALUES
  ('Granulometrie', '%', 0, 100, ARRAY['%'], NULL),
  ('BleuMethylene_VBS', 'g/100g', 0, 15, ARRAY['g/100g'], NULL),
  ('Atterberg_WL', '%', 0, 100, ARRAY['%'], NULL),
  ('Atterberg_WP', '%', 0, 100, ARRAY['%'], NULL),
  ('Atterberg_IP', '%', 0, 100, ARRAY['%'], NULL),
  ('Proctor_gdmax', 't/m³', 1.5, 2.3, ARRAY['t/m³', 'g/cm³'], 'convert_density'),
  ('Proctor_wopt', '%', 5, 25, ARRAY['%'], NULL),
  ('qc', 'MPa', 0.1, 50, ARRAY['MPa', 'kPa'], 'convert_pressure');
```

**Fonction de conversion:**
```python
def convert_unit(value, from_unit, to_unit, type_essai):
    converters = {
        'convert_pressure': {
            ('kPa', 'MPa'): lambda x: x / 1000,
            ('MPa', 'kPa'): lambda x: x * 1000
        },
        'convert_density': {
            ('g/cm³', 't/m³'): lambda x: x,  # Équivalent
            ('t/m³', 'g/cm³'): lambda x: x
        }
    }
    # ...
```

**Politique:** Convertir automatiquement + warning si conversion

### 3. Asynchrone vs Synchrone ✅

**Décision:** Asynchrone obligatoire pour >1000 lignes

**Implémentation:**
```rust
// Backend Rust avec Tokio
#[derive(Debug, Serialize, Deserialize)]
pub struct ImportJob {
    pub id: Uuid,
    pub status: ImportStatus,
    pub progress: f32, // 0.0 - 1.0
    pub stats: ImportStats,
}

#[derive(Debug, Serialize, Deserialize)]
pub enum ImportStatus {
    Pending,
    Running,
    Succeeded,
    Failed,
    Partial,
    Cancelled,
}

// Endpoint
POST /api/v1/surveys/bulk-import/async
→ Returns: { job_id: "uuid", status: "pending" }

GET /api/v1/surveys/bulk-import/status/{job_id}
→ Returns: { status, progress, stats, logs }

POST /api/v1/surveys/bulk-import/cancel/{job_id}
→ Cancels the job
```

**Frontend:**
```typescript
// Polling toutes les 2 secondes
async function pollImportStatus(jobId: string) {
  const interval = setInterval(async () => {
    const status = await fetch(`/api/v1/surveys/bulk-import/status/${jobId}`)
    updateProgressBar(status.progress)
    if (status.status !== 'running') {
      clearInterval(interval)
      showResults(status)
    }
  }, 2000)
}
```

### 4. Stratégie "unknown / centroid / random" ✅

**Décision:** ADM2 minimum obligatoire pour mode "unknown"

**Règles:**
- **Mode `exact`:** lon/lat obligatoires
- **Mode `centroid`:** ADM3 recommandé, ADM2 minimum
- **Mode `random`:** ADM3 recommandé, ADM2 minimum
- **Mode `unknown`:** ADM2 **obligatoire**, ADM3 recommandé
- **Mode `maille`:** Code maille valide obligatoire

**Validation:**
```python
def validate_geolocation(mode, row):
    if mode == 'exact':
        if not (row.get('lon') and row.get('lat')):
            return Error("Coordonnées lon/lat obligatoires pour mode 'exact'")
    
    elif mode in ['centroid', 'random']:
        if not row.get('adm3') and not row.get('adm2'):
            return Error(f"ADM2 minimum requis pour mode '{mode}'")
    
    elif mode == 'unknown':
        if not row.get('adm2'):
            return Error("ADM2 obligatoire pour mode 'unknown'")
    
    elif mode == 'maille':
        if not row.get('maille_code'):
            return Error("Code maille obligatoire pour mode 'maille'")
    
    return Ok()
```

### 5. Gestion des Collisions Toponymiques ✅

**Décision:** Confirmation utilisateur si score < 0.85 ou multiple matches

**Implémentation:**
```python
def match_adm3(localite: str, adm2_hint: str = None):
    # 1. Recherche exacte
    exact = db.query("SELECT * FROM adm3 WHERE unaccent(lower(name)) = unaccent(lower($1))", localite)
    if len(exact) == 1:
        return Match(exact[0], score=1.0, confidence='high')
    
    # 2. Fuzzy search
    fuzzy = db.query("""
        SELECT *, similarity(name, $1) as score
        FROM adm3
        WHERE similarity(name, $1) > 0.75
        ORDER BY score DESC
        LIMIT 5
    """, localite)
    
    # 3. Filtrer par ADM2 si fourni
    if adm2_hint:
        fuzzy = [f for f in fuzzy if f.adm2_name == adm2_hint]
    
    # 4. Décision
    if len(fuzzy) == 0:
        return NoMatch()
    elif len(fuzzy) == 1 and fuzzy[0].score >= 0.85:
        return Match(fuzzy[0], score=fuzzy[0].score, confidence='medium')
    else:
        # Multiple matches ou score faible → confirmation utilisateur
        return AmbiguousMatch(fuzzy, requires_confirmation=True)
```

**UI Confirmation:**
```
┌─────────────────────────────────────────────────┐
│  ⚠️ Correspondance Ambiguë                      │
├─────────────────────────────────────────────────┤
│  Localité: "Sotouboa" (ligne 5)                │
│                                                  │
│  Correspondances trouvées:                      │
│  ○ Sotouboua (Tchaoudjo) - Score: 0.92         │
│  ○ Sotouboua (Centrale) - Score: 0.89          │
│                                                  │
│  [Choisir] [Ignorer cette ligne] [Tout ignorer] │
└─────────────────────────────────────────────────┘
```

---

## 🚀 Quick Wins Implémentés

### 1. Mode Dry-Run ✅

**Endpoint:**
```
POST /api/v1/surveys/bulk-import/dry-run
```

**Réponse:**
```json
{
  "valid": true,
  "stats": {
    "total_rows": 36,
    "valid_rows": 34,
    "warnings": 2,
    "errors": 0
  },
  "preview": [
    {
      "row": 1,
      "localite": "Adjengré",
      "adm3_matched": "Sotouboua",
      "match_score": 0.95,
      "tests_count": 3,
      "status": "ok"
    }
  ],
  "warnings": [
    {
      "row": 5,
      "message": "Valeur hors plage: Granulometrie = 105% (max 100%)"
    }
  ],
  "errors": []
}
```

### 2. Templates Téléchargeables ✅

**Fichiers générés:**
- `template_granulometrie.csv`
- `template_vbs.csv`
- `template_atterberg.csv`
- `template_multi_essais.csv`

**Endpoint:**
```
GET /api/v1/surveys/bulk-import/templates/{type}
```

### 3. Profils de Mapping ✅

**Table:**
```sql
CREATE TABLE import_mapping_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT,
  name TEXT NOT NULL,
  description TEXT,
  mapping_json JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  last_used_at TIMESTAMPTZ
);
```

**UI:**
```
┌─────────────────────────────────────────────────┐
│  Profils de Mapping Sauvegardés                 │
│  ○ Granulo LNBTP (utilisé il y a 2 jours)      │
│  ○ VBS Standard (utilisé il y a 1 semaine)     │
│  [+ Nouveau profil]                             │
└─────────────────────────────────────────────────┘
```

### 4. Badge "⚑ à géocoder" ✅

**UI:**
```html
<div class="badge-geocode">
  ⚑ 156 sondages à géocoder
</div>
```

**Partout:**
- Header (compteur global)
- Liste sondages (filtre rapide)
- Stats maille
- Dashboard KPI

### 5. Déterminisme Points Aléatoires ✅

**Implémentation:**
```python
def generate_random_point(adm3_geom, code, seed=42):
    # Hash déterministe
    hash_input = f"{code}|{seed}|{adm3.id}"
    hash_value = int(hashlib.sha256(hash_input.encode()).hexdigest()[:8], 16)
    
    # Seed numpy
    np.random.seed(hash_value % (2**32))
    
    # Point aléatoire dans polygone
    point = generate_point_in_polygon(adm3_geom)
    return point
```

---

## 🧱 Modèle de Données Complet

### Modifications Tables Existantes

```sql
-- Table sondages (ajouts)
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES imports(id);
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS import_row_idx INTEGER;
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS location_mode TEXT; -- Déjà existant
ALTER TABLE sondages ADD COLUMN IF NOT EXISTS location_accuracy TEXT; -- Déjà existant

-- Table essais (ajouts)
ALTER TABLE essais ADD COLUMN IF NOT EXISTS is_from_import BOOLEAN DEFAULT false;
ALTER TABLE essais ADD COLUMN IF NOT EXISTS import_id UUID REFERENCES imports(id);

-- Index
CREATE INDEX IF NOT EXISTS idx_sondages_import_id ON sondages(import_id);
CREATE INDEX IF NOT EXISTS idx_essais_import_id ON essais(import_id);
CREATE INDEX IF NOT EXISTS idx_sondages_location_mode ON sondages(location_mode);
```

### Nouvelles Tables

```sql
-- Table imports (déjà définie ci-dessus)
-- Table import_items (déjà définie ci-dessus)
-- Table test_type_defaults (déjà définie ci-dessus)
-- Table import_mapping_profiles (déjà définie ci-dessus)

-- Table import_logs (observabilité)
CREATE TABLE import_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  import_id UUID REFERENCES imports(id) ON DELETE CASCADE,
  level TEXT NOT NULL, -- info/warning/error
  message TEXT NOT NULL,
  context_json JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_import_logs_import_id ON import_logs(import_id);
CREATE INDEX idx_import_logs_level ON import_logs(level);
```

---

## 📈 Observabilité & Tests

### Logs Structurés

```python
import structlog

logger = structlog.get_logger()

logger.info("import_started", 
    import_id=import_id,
    filename=filename,
    rows=total_rows,
    mode=geoloc_mode)

logger.warning("adm_match_ambiguous",
    import_id=import_id,
    row=row_idx,
    localite=localite,
    matches=matches,
    scores=[m.score for m in matches])

logger.error("import_failed",
    import_id=import_id,
    error=str(e),
    traceback=traceback.format_exc())
```

### Export Rapport d'Import

**Endpoint:**
```
GET /api/v1/surveys/bulk-import/report/{import_id}?format=csv
```

**Format CSV:**
```csv
row,status,localite,adm3_matched,match_score,tests_created,warnings,errors
1,ok,Adjengré,Sotouboua,0.95,3,,
2,ok,Agotivé,Tchaoudjo,1.0,3,,
5,warning,Anié,Anié,0.82,3,"Valeur hors plage: 105%",
```

### Tests Automatisés

```python
# tests/test_import_bulk.py

def test_large_to_long_conversion():
    """Test conversion format Large → Long"""
    input_data = {
        'localite': 'Adjengré',
        '1': 77.73,
        '1.5': 81.8,
        '2': 74.85
    }
    result = convert_large_to_long(input_data, 'Granulometrie')
    assert len(result) == 3
    assert result[0]['profondeur_m'] == 1.0
    assert result[0]['valeur'] == 77.73

def test_adm_fuzzy_matching():
    """Test fuzzy matching avec accents"""
    matches = match_adm3("Sotouboa")  # Faute de frappe
    assert len(matches) > 0
    assert matches[0].name == "Sotouboua"
    assert matches[0].score > 0.85

def test_50k_lines_csv():
    """Test import 50k lignes CSV ISO-8859-1"""
    # Générer CSV 50k lignes
    # Importer
    # Vérifier performance < 60s
    pass

def test_idempotence():
    """Test rejouer le même fichier"""
    # Import 1
    result1 = import_file(file)
    # Import 2 (même fichier)
    result2 = import_file(file)
    # Vérifier: aucun doublon créé
    assert result2.duplicates == result1.total_rows
```

---

**✅ Décisions techniques validées et prêtes pour implémentation !**
