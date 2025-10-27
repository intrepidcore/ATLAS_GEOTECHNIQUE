# 🔧 Guide d'Extensibilité - Nouveaux Essais

## 📋 Philosophie d'Extension

### Principes Fondamentaux

1. **Contrat stable** : Ne jamais toucher au contrat existant (granulo, VBS, Atterberg, Proctor)
2. **Plugins d'essais** : Chaque essai = module autonome (front + back)
3. **Plan B générique** : Stockage "raw" en JSONB si plugin pas encore prêt

### Architecture Modulaire

```
Essai
├── Détection (aliases)
├── Mapping (colonnes)
├── Normalisation (transformation)
├── Validation (contraintes)
├── Persistance (DB)
└── Aperçu (UI)
```

---

## 🎯 Types & Contrat

### 1. TypeScript (Frontend)

#### Extension des Rôles

```typescript
type SheetRole =
  // ✅ Existants (ne pas toucher)
  | 'sondages'
  | 'echantillons'
  | 'atterberg'
  | 'vbs'
  | 'proctor'
  | 'granulo_tamisage_large'
  | 'granulo_sedimento_large'
  // 🆕 Nouveaux essais
  | 'densite'
  | 'teneur_eau'
  | 'classification';
```

#### Schéma de Mapping Générique

```typescript
type SheetMapping = Record<string, string | null>;
type XlsxMapping = Partial<Record<SheetRole, SheetMapping>>;
```

#### Registre de Détection

```typescript
const SHEET_ALIASES: Record<SheetRole, string[]> = {
  // ✅ Existants
  sondages: ['sondages', 'sites', 'boreholes'],
  echantillons: ['echantillons', 'samples'],
  atterberg: ['atterberg', 'wl_wp_ip'],
  vbs: ['vbs', 'bleu_methylene'],
  proctor: ['proctor'],
  granulo_tamisage_large: ['granulo_tamisage_large', 'agt'],
  granulo_sedimento_large: ['granulo_sedimento_large', 'ags'],
  
  // 🆕 Nouveaux
  densite: ['densite', 'densité', 'density'],
  teneur_eau: ['teneur_eau', 'water_content', 'w_naturel'],
  classification: ['classification', 'classement', 'hrb', 'uscs']
};
```

### 2. Contrat JSON (Backend)

```json
{
  "format": "xlsx",
  "structure": {
    "sheets": {
      "densite": "densite",
      "teneur_eau": "teneur_eau",
      "classification": "classification"
    }
  },
  "mapping": {
    "densite": {
      "code": "Localité/Cantons",
      "depth_m": "profondeur",
      "rho_d_app": "Densité Apparente",
      "rho_s_abs": "Densité Absolue"
    },
    "teneur_eau": {
      "code": "Localité/Cantons",
      "depth_m": "profondeur",
      "w": "Teneur en eau",
      "wi": "WI"
    },
    "classification": {
      "code": "Localité/Cantons",
      "depth_m": "Profondeur (m)",
      "hrb": "Classification HRB",
      "unified": "Classification unifiée",
      "bm": "Classification d'après le bleu de méthylène"
    }
  },
  "options": {
    "refresh_mv": true
  }
}
```

**Astuce** : Si une feuille existe mais n'est pas prête, omets-la du mapping. Le backend peut l'ignorer ou la stocker en "raw".

---

## 🎨 Frontend - Étapes pour Ajouter un Essai

### Étape 1 : Détection

Ajouter les alias dans `SHEET_ALIASES` :

```typescript
// ui/src/import-bulk-wizard_v3.ts
const SHEET_ALIASES: Record<SheetRole, string[]> = {
  // ... existants ...
  densite: ['densite', 'densité', 'density', 'rho'],
};
```

La détection automatique fera remonter la feuille à l'étape 2.

### Étape 2 : Mapping par Défaut

Dans `initializeXlsxMapping()` :

```typescript
private initializeXlsxMapping() {
  // ... existants ...
  
  // 🆕 Densité
  const sDens = this.sheetsByRole.densite;
  this.xlsxMapping.densite = {
    code: pick(sDens, ['code', 'code_site', 'localite']),
    depth_m: pick(sDens, ['depth_m', 'profondeur_m', 'z_m']),
    rho_d_app: pick(sDens, ['rho_d_app', 'densite_apparente', 'gamma_d']),
    rho_s_abs: pick(sDens, ['rho_s_abs', 'densite_absolue', 'gamma_s']),
  };
}
```

### Étape 3 : UI de Mapping

Ajouter dans `renderMappingStep()` :

```typescript
mountRole("densite", "#map_densite", [
  "code",
  "depth_m",
  "rho_d_app",
  "rho_s_abs"
]);
```

Et dans le HTML (méthode `mount()`) :

```html
<div class="form-group">
  <label>Densité</label>
  <select id="sheet_densite"></select>
</div>
```

### Étape 4 : Transformation

Implémenter `normalizeDensite()` :

```typescript
private normalizeDensite(rows: any[]): any[] {
  return rows.map(r => ({
    code: r.code,
    depth_m: parseFloat(r.depth_m),
    rho_d_app: parseFloat(r.rho_d_app),
    rho_s_abs: parseFloat(r.rho_s_abs),
    unit_rho: 'g/cm3',
    meta: { source: 'xlsx_import' }
  }));
}
```

### Étape 5 : Aperçu

Ajouter dans `renderPreviewStep()` :

```typescript
pushBlock("Densité", "densite", [
  "code",
  "depth_m",
  "rho_d_app",
  "rho_s_abs"
]);
```

---

## 🔧 Backend - Étapes pour Ajouter un Essai

### Étape 1 : Enum et Registre

```rust
// Étendre l'enum
pub enum TestType {
    Atterberg,
    Vbs,
    Proctor,
    GranuloTamisage,
    GranuloSedimento,
    // 🆕 Nouveaux
    Densite,
    TeneurEau,
    Classification,
}

// Registre des parseurs
lazy_static! {
    static ref PARSERS: HashMap<TestType, ParserFn> = {
        let mut m = HashMap::new();
        m.insert(TestType::Atterberg, parse_atterberg as ParserFn);
        m.insert(TestType::Vbs, parse_vbs as ParserFn);
        // ... existants ...
        m.insert(TestType::Densite, parse_densite as ParserFn);
        m.insert(TestType::TeneurEau, parse_teneur_eau as ParserFn);
        m.insert(TestType::Classification, parse_classification as ParserFn);
        m
    };
}
```

### Étape 2 : Parseur

```rust
fn parse_densite(
    structure: &Structure,
    mapping: &Mapping,
    file: &[u8]
) -> Result<Vec<ParsedRow>> {
    let sheet_name = structure.sheets.get("densite")?;
    let cols = mapping.get("densite")?;
    
    let rows = read_xlsx_sheet(file, sheet_name)?;
    
    rows.into_iter()
        .filter_map(|row| {
            Some(ParsedRow {
                code: row.get(cols.code?)?,
                depth_m: row.get(cols.depth_m?)?.parse().ok()?,
                params: vec![
                    ("rho_d_app", row.get(cols.rho_d_app?)?.parse().ok()?),
                    ("rho_s_abs", row.get(cols.rho_s_abs?)?.parse().ok()?),
                ],
                units: vec![("rho", "g/cm3")],
                meta: json!({"source": "xlsx_import"}),
            })
        })
        .collect()
}
```

### Étape 3 : Validation

```rust
fn validate_densite(row: &ParsedRow) -> Result<()> {
    for (key, val) in &row.params {
        match key.as_str() {
            "rho_d_app" => {
                if *val < 0.0 || *val > 3.0 {
                    return Err(anyhow!("rho_d_app hors bornes: {}", val));
                }
            }
            "rho_s_abs" => {
                if *val < 1.0 || *val > 4.0 {
                    return Err(anyhow!("rho_s_abs hors bornes: {}", val));
                }
            }
            _ => {}
        }
    }
    Ok(())
}
```

### Étape 4 : Persistance (2 Options)

#### Option A : Table Normalisée (Recommandé)

```sql
-- Table unique pour tous les essais
CREATE TABLE lab_results (
    id SERIAL PRIMARY KEY,
    sample_id INTEGER REFERENCES samples(id),
    test_type VARCHAR(50) NOT NULL,
    param_key VARCHAR(100) NOT NULL,
    value_num NUMERIC,
    value_text TEXT,
    unit VARCHAR(20),
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index
CREATE INDEX idx_lab_results_sample ON lab_results(sample_id);
CREATE INDEX idx_lab_results_type ON lab_results(test_type);
CREATE INDEX idx_lab_results_param ON lab_results(param_key);
```

**Insertion** :
```rust
// Densité → 2 lignes
insert_lab_result(sample_id, "densite", "rho_d_app", 1.85, "g/cm3", meta);
insert_lab_result(sample_id, "densite", "rho_s_abs", 2.65, "g/cm3", meta);
```

#### Option B : Table Spécifique

```sql
CREATE TABLE lab_densite (
    id SERIAL PRIMARY KEY,
    sample_id INTEGER REFERENCES samples(id),
    rho_d_app NUMERIC CHECK (rho_d_app BETWEEN 0 AND 3),
    rho_s_abs NUMERIC CHECK (rho_s_abs BETWEEN 1 AND 4),
    unit_rho VARCHAR(20) DEFAULT 'g/cm3',
    meta JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

### Étape 5 : Fallback "Raw"

Si l'essai n'a pas encore de parseur :

```rust
fn store_raw_sheet(
    file: &[u8],
    sheet_name: &str,
    meta: &serde_json::Value
) -> Result<()> {
    sqlx::query!(
        r#"
        INSERT INTO raw_ingest (sheet_name, blob_data, meta, status)
        VALUES ($1, $2, $3, 'pending')
        "#,
        sheet_name,
        file,
        meta
    )
    .execute(&pool)
    .await?;
    
    warn!("Feuille '{}' stockée en raw (parseur non implémenté)", sheet_name);
    Ok(())
}
```

### Étape 6 : MV & Agrégats

```sql
-- Vue matérialisée pour KPIs
CREATE MATERIALIZED VIEW mv_densite_stats AS
SELECT
    s.maille_id,
    AVG(lr.value_num) FILTER (WHERE lr.param_key = 'rho_d_app') as avg_rho_d,
    AVG(lr.value_num) FILTER (WHERE lr.param_key = 'rho_s_abs') as avg_rho_s,
    COUNT(*) as n_tests
FROM lab_results lr
JOIN samples s ON s.id = lr.sample_id
WHERE lr.test_type = 'densite'
GROUP BY s.maille_id;

-- Refresh après import
REFRESH MATERIALIZED VIEW CONCURRENTLY mv_densite_stats;
```

---

## 📊 Données Non Implémentées Aujourd'hui

### Essais à Ajouter

| Essai | Rôle | Colonnes Clés | Unités |
|-------|------|---------------|--------|
| **Densité** | `densite` | `code`, `depth_m`, `rho_d_app`, `rho_s_abs` | g/cm³ |
| **Teneur en eau** | `teneur_eau` | `code`, `depth_m`, `w`, `wi`, `note` | % |
| **Classification** | `classification` | `code`, `depth_m`, `hrb`, `unified`, `bm`, `note` | - |
| **Atterberg détaillé** | `atterberg_raw` | `code`, `depth_m`, `tare`, `poids_humide`, `poids_sec`, `coups` | g, - |

### Stratégie d'Implémentation

1. **Aujourd'hui** : Inclure les feuilles dans le XLSX
2. **Détection** : Le front les détecte et affiche en aperçu
3. **Stockage** :
   - Si plugin dispo → import normal
   - Sinon → stockage "raw" en JSONB
4. **Plus tard** : Implémenter le plugin quand nécessaire

**Aucune donnée perdue !**

---

## ✅ Checklist PR (Toujours la Même)

### Frontend
- [ ] Alias de détection ajoutés dans `SHEET_ALIASES`
- [ ] Mapping par défaut dans `initializeXlsxMapping()`
- [ ] UI step 3 (sélecteurs de colonnes)
- [ ] `normalize<Essai>()` avec unités explicites
- [ ] Aperçu step 4 OK

### Backend
- [ ] Enum `TestType` étendu
- [ ] Parseur `parse_<essai>()` implémenté
- [ ] Validation avec contraintes (Zod/serde)
- [ ] Persistance (normalisée ou spécifique)
- [ ] Migrations SQL
- [ ] MV & agrégats si nécessaire

### Tests
- [ ] Tests unitaires front (parse)
- [ ] Tests unitaires back (parse + validation)
- [ ] Tests contraintes DB
- [ ] E2E de base (1 feuille → N lignes créées)

### Documentation
- [ ] `IMPORT_XLSX.md` mis à jour
- [ ] Feature flag si nécessaire
- [ ] Logs d'observabilité

---

## 🚀 Option "Générique" pour Accélérer

### Ingest Générique

```typescript
// Frontend
type SheetRole = ... | 'generic_table';

// Mapping illimité
mapping.generic_table = {
  key1: "Colonne A",
  key2: "Colonne B",
  // ... autant que nécessaire
};
```

```rust
// Backend
fn parse_generic(mapping: &HashMap<String, String>, rows: &[Row]) -> Vec<ParsedRow> {
    rows.iter().map(|row| {
        let params = mapping.iter()
            .filter_map(|(key, col)| {
                row.get(col).and_then(|v| parse_value(v)).map(|v| (key.clone(), v))
            })
            .collect();
        
        ParsedRow { params, meta: json!({"type": "generic"}), ..Default::default() }
    }).collect()
}
```

**Stockage** : Directement dans `lab_results` avec `test_type='generic'`

**Avantage** : Héberger temporairement des essais exotiques sans créer de plugin

---

## 📝 Prompt de Création de Classeur XLSX

```
Tu es assistant data pour géotechnique. Je veux un classeur XLSX multi-feuilles 
adapté à un import automatisé. Chaque feuille correspond à un rôle :
- sondages, echantillons, atterberg, vbs, proctor
- granulo_tamisage_large, granulo_sedimento_large
- densite, teneur_eau, classification

Pour chaque feuille :
1. Nom exact (snake_case)
2. Colonnes obligatoires (clés canoniques : code, depth_m, etc.)
3. Colonnes optionnelles
4. Unités attendues et contraintes (ex : % ∈ [0,100])
5. Structure séries "wide" (granulo : sieve_key, series_pattern='@')
6. Règles de mapping (colonnes source ↔ clés cibles)
7. Alias de feuilles acceptés
8. Section "validation" (qualité minimale)

Ne fournis AUCUN exemple de valeur, seulement la structure et les règles.
```

---

## 🎯 Conclusion

### Avantages de cette Architecture

1. **Extensible** : Ajouter un essai = routine de quelques fichiers
2. **Robuste** : Contrat stable, pas de régression
3. **Flexible** : Fallback "raw" pour essais non prêts
4. **Traçable** : Logs et observabilité à chaque étape
5. **Testable** : Tests unitaires et E2E systématiques

### Workflow d'Ajout

```
1. Définir le rôle et les alias
2. Implémenter le mapping par défaut
3. Créer le parseur backend
4. Ajouter la validation
5. Configurer la persistance
6. Tester (unit + E2E)
7. Documenter
8. Déployer
```

### Prochains Essais à Implémenter

1. **Densité** (priorité haute)
2. **Teneur en eau** (priorité haute)
3. **Classification** (priorité moyenne)
4. **Atterberg détaillé** (priorité basse)

---

**Date** : 24 octobre 2025  
**Version** : 1.0  
**Statut** : ✅ Prêt pour implémentation
