# 📋 Template - Ajouter un Nouvel Essai

Ce document est un guide pas-à-pas pour ajouter un nouvel essai géotechnique au système d'import.

---

## 🎯 Exemple : Densité

Nous allons implémenter l'essai **Densité** comme exemple complet.

---

## 📝 Étape 1 : Définition

### Informations de Base

- **Nom** : Densité
- **Rôle** : `densite`
- **Aliases** : `['densite', 'densité', 'density', 'rho']`
- **Type** : Essai simple (une ligne = une mesure)

### Colonnes Attendues

| Colonne | Type | Obligatoire | Unité | Contraintes |
|---------|------|-------------|-------|-------------|
| `code` | string | ✅ | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 |
| `rho_d_app` | float | ✅ | g/cm³ | 0 < x < 3 |
| `rho_s_abs` | float | ✅ | g/cm³ | 1 < x < 4 |
| `note` | string | ❌ | - | Remarques |

---

## 🎨 Étape 2 : Frontend

### 2.1 Ajouter le Type

**Fichier** : `ui/src/import-bulk-wizard_v3.ts`

```typescript
// Ligne ~15
type SheetRole =
  | 'sondages'
  | 'echantillons'
  | 'atterberg'
  | 'vbs'
  | 'proctor'
  | 'granulo_tamisage_large'
  | 'granulo_sedimento_large'
  | 'densite';  // 🆕 AJOUTER ICI
```

### 2.2 Ajouter les Aliases

```typescript
// Ligne ~300
private guessSheetsByRole(all: string[]): XlsxSheets {
  const f = (needle: string) =>
    all.find((n) => normHeader(n).includes(needle)) || null;

  return {
    sondages: f("sondage") || f("site") || f("survey") || undefined,
    echantillons: f("echantillon") || f("sample") || undefined,
    atterberg: f("atterberg") || f("wl") || f("ip") || undefined,
    vbs: f("vbs") || f("bleu") || undefined,
    proctor: f("proctor") || f("proctor_ie") || undefined,
    granulo_tamisage_large: f("granulo_tamisage_large") || f("granulo_tamisage") || undefined,
    granulo_sedimento_large: f("granulo_sedimento_large") || f("granulo_sedimento") || f("sedimento") || undefined,
    // 🆕 AJOUTER ICI
    densite: f("densite") || f("density") || f("rho") || undefined,
  };
}
```

### 2.3 Ajouter le Mapping par Défaut

```typescript
// Ligne ~350 (dans initializeXlsxMapping)
private initializeXlsxMapping() {
  // ... code existant ...
  
  // 🆕 AJOUTER À LA FIN
  const sDens = this.sheetsByRole.densite;
  this.xlsxMapping.densite = {
    code: pick(sDens, ["code", "code_site", "localite"]),
    depth_m: pick(sDens, ["depth_m", "profondeur_m", "z_m"]),
    rho_d_app: pick(sDens, ["rho_d_app", "densite_apparente", "gamma_d", "rho_d"]),
    rho_s_abs: pick(sDens, ["rho_s_abs", "densite_absolue", "gamma_s", "rho_s"]),
    note: pick(sDens, ["note", "remarque", "comment"]),
  };
}
```

### 2.4 Ajouter le Sélecteur de Feuille

```typescript
// Ligne ~400 (dans setupFormatStep)
private async setupFormatStep() {
  const roleToSel: Partial<Record<SheetRole, string>> = {
    sondages: "#sheet_sondages",
    echantillons: "#sheet_echantillons",
    atterberg: "#sheet_atterberg",
    vbs: "#sheet_vbs",
    proctor: "#sheet_proctor",
    granulo_tamisage_large: "#sheet_granulo_tamisage",
    granulo_sedimento_large: "#sheet_granulo_sedimento",
    // 🆕 AJOUTER ICI
    densite: "#sheet_densite",
  };
  
  // ... reste du code ...
}
```

### 2.5 Ajouter le HTML du Sélecteur

```typescript
// Ligne ~150 (dans mount(), section step-2)
<div class="form-group">
  <label>Granulo Sédimento</label>
  <select id="sheet_granulo_sedimento"></select>
</div>
<!-- 🆕 AJOUTER ICI -->
<div class="form-group">
  <label>Densité</label>
  <select id="sheet_densite"></select>
</div>
```

### 2.6 Ajouter le Mapping UI

```typescript
// Ligne ~500 (dans renderMappingStep)
private async renderMappingStep() {
  // ... code existant ...
  
  // 🆕 AJOUTER À LA FIN
  mountRole("densite", "#map_densite", [
    "code",
    "depth_m",
    "rho_d_app",
    "rho_s_abs",
    "note"
  ]);
}
```

### 2.7 Ajouter le Container de Mapping

```typescript
// Ligne ~170 (dans mount(), section step-3)
<div id="map_granulo_sedimento"></div>
<!-- 🆕 AJOUTER ICI -->
<div id="map_densite"></div>
```

### 2.8 Ajouter l'Aperçu

```typescript
// Ligne ~550 (dans renderPreviewStep)
private async renderPreviewStep() {
  // ... code existant ...
  
  // 🆕 AJOUTER À LA FIN
  pushBlock("Densité", "densite", [
    "code",
    "depth_m",
    "rho_d_app",
    "rho_s_abs"
  ]);
}
```

---

## 🔧 Étape 3 : Backend (Rust)

### 3.1 Ajouter l'Enum

**Fichier** : `api/src/import/types.rs`

```rust
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TestType {
    Atterberg,
    Vbs,
    Proctor,
    GranuloTamisage,
    GranuloSedimento,
    // 🆕 AJOUTER ICI
    Densite,
}
```

### 3.2 Créer le Parseur

**Fichier** : `api/src/import/parsers/densite.rs`

```rust
use anyhow::{Context, Result};
use serde_json::json;

use crate::import::types::{ParsedRow, Structure, Mapping};

pub fn parse_densite(
    structure: &Structure,
    mapping: &Mapping,
    workbook: &calamine::Xlsx<_>
) -> Result<Vec<ParsedRow>> {
    // 1. Récupérer le nom de la feuille
    let sheet_name = structure.sheets.get("densite")
        .context("Feuille 'densite' non trouvée dans structure")?;
    
    // 2. Récupérer le mapping des colonnes
    let cols = mapping.get("densite")
        .context("Mapping 'densite' non trouvé")?;
    
    // 3. Lire la feuille
    let range = workbook.worksheet_range(sheet_name)
        .context("Impossible de lire la feuille")?;
    
    // 4. Parser les lignes
    let mut results = Vec::new();
    
    for (idx, row) in range.rows().enumerate().skip(1) { // Skip header
        // Extraire les valeurs
        let code = get_cell_string(row, cols.get("code"))?;
        let depth_m = get_cell_float(row, cols.get("depth_m"))?;
        let rho_d_app = get_cell_float(row, cols.get("rho_d_app"))?;
        let rho_s_abs = get_cell_float(row, cols.get("rho_s_abs"))?;
        let note = get_cell_string(row, cols.get("note")).ok();
        
        // Validation
        validate_densite(depth_m, rho_d_app, rho_s_abs)
            .with_context(|| format!("Ligne {}", idx + 2))?;
        
        // Créer le résultat
        results.push(ParsedRow {
            code,
            depth_m,
            test_type: "densite".to_string(),
            params: vec![
                ("rho_d_app".to_string(), rho_d_app),
                ("rho_s_abs".to_string(), rho_s_abs),
            ],
            units: vec![
                ("rho".to_string(), "g/cm3".to_string()),
            ],
            meta: json!({
                "note": note,
                "source": "xlsx_import"
            }),
        });
    }
    
    Ok(results)
}

fn validate_densite(depth_m: f64, rho_d_app: f64, rho_s_abs: f64) -> Result<()> {
    if depth_m < 0.0 {
        anyhow::bail!("depth_m doit être ≥ 0, reçu: {}", depth_m);
    }
    
    if rho_d_app <= 0.0 || rho_d_app >= 3.0 {
        anyhow::bail!("rho_d_app hors bornes [0, 3], reçu: {}", rho_d_app);
    }
    
    if rho_s_abs <= 1.0 || rho_s_abs >= 4.0 {
        anyhow::bail!("rho_s_abs hors bornes [1, 4], reçu: {}", rho_s_abs);
    }
    
    Ok(())
}
```

### 3.3 Enregistrer le Parseur

**Fichier** : `api/src/import/mod.rs`

```rust
mod parsers;
use parsers::{
    atterberg::parse_atterberg,
    vbs::parse_vbs,
    proctor::parse_proctor,
    // 🆕 AJOUTER ICI
    densite::parse_densite,
};

lazy_static! {
    static ref PARSERS: HashMap<TestType, ParserFn> = {
        let mut m = HashMap::new();
        m.insert(TestType::Atterberg, parse_atterberg as ParserFn);
        m.insert(TestType::Vbs, parse_vbs as ParserFn);
        m.insert(TestType::Proctor, parse_proctor as ParserFn);
        // 🆕 AJOUTER ICI
        m.insert(TestType::Densite, parse_densite as ParserFn);
        m
    };
}
```

### 3.4 Créer la Table (Option Normalisée)

**Fichier** : `migrations/YYYYMMDD_add_lab_results.sql`

```sql
-- Table déjà existante (normalisée)
-- Pas besoin de migration si on utilise lab_results

-- Juste ajouter un index si nécessaire
CREATE INDEX IF NOT EXISTS idx_lab_results_densite 
ON lab_results(sample_id) 
WHERE test_type = 'densite';
```

### 3.5 Implémenter la Persistance

**Fichier** : `api/src/import/persist.rs`

```rust
pub async fn persist_densite(
    pool: &PgPool,
    sample_id: i32,
    row: &ParsedRow
) -> Result<()> {
    for (param_key, value) in &row.params {
        sqlx::query!(
            r#"
            INSERT INTO lab_results (sample_id, test_type, param_key, value_num, unit, meta)
            VALUES ($1, $2, $3, $4, $5, $6)
            "#,
            sample_id,
            "densite",
            param_key,
            value,
            "g/cm3",
            row.meta
        )
        .execute(pool)
        .await?;
    }
    
    Ok(())
}
```

---

## 🧪 Étape 4 : Tests

### 4.1 Test Frontend

**Fichier** : `ui/tests/densite.test.ts`

```typescript
import { describe, it, expect } from 'vitest';
import { ImportBulkWizardV3 } from '../src/import-bulk-wizard_v3';

describe('Densité Import', () => {
  it('should detect densite sheet', () => {
    const sheets = ['sondages', 'densite', 'atterberg'];
    const wizard = new ImportBulkWizardV3(document.createElement('div'));
    const detected = wizard.guessSheetsByRole(sheets);
    
    expect(detected.densite).toBe('densite');
  });
  
  it('should map densite columns', () => {
    const headers = ['code', 'profondeur_m', 'densite_apparente', 'densite_absolue'];
    const mapping = wizard.initializeXlsxMapping();
    
    expect(mapping.densite.code).toBe('code');
    expect(mapping.densite.depth_m).toBe('profondeur_m');
    expect(mapping.densite.rho_d_app).toBe('densite_apparente');
    expect(mapping.densite.rho_s_abs).toBe('densite_absolue');
  });
});
```

### 4.2 Test Backend

**Fichier** : `api/tests/import_densite.rs`

```rust
#[tokio::test]
async fn test_parse_densite() {
    let xlsx_data = include_bytes!("fixtures/densite_test.xlsx");
    let workbook = open_workbook_from_bytes(xlsx_data).unwrap();
    
    let structure = Structure {
        sheets: [("densite", "densite")].iter().cloned().collect(),
    };
    
    let mapping = Mapping {
        densite: [
            ("code", "Code"),
            ("depth_m", "Profondeur"),
            ("rho_d_app", "Densité Apparente"),
            ("rho_s_abs", "Densité Absolue"),
        ].iter().cloned().collect(),
    };
    
    let results = parse_densite(&structure, &mapping, &workbook).unwrap();
    
    assert_eq!(results.len(), 2);
    assert_eq!(results[0].code, "S001");
    assert_eq!(results[0].depth_m, 2.5);
    assert_eq!(results[0].params.get("rho_d_app"), Some(&1.85));
    assert_eq!(results[0].params.get("rho_s_abs"), Some(&2.65));
}

#[tokio::test]
async fn test_validate_densite() {
    // Test valeurs valides
    assert!(validate_densite(2.5, 1.85, 2.65).is_ok());
    
    // Test depth_m négatif
    assert!(validate_densite(-1.0, 1.85, 2.65).is_err());
    
    // Test rho_d_app hors bornes
    assert!(validate_densite(2.5, 3.5, 2.65).is_err());
    
    // Test rho_s_abs hors bornes
    assert!(validate_densite(2.5, 1.85, 5.0).is_err());
}
```

### 4.3 Test E2E

**Fichier** : `e2e/import_densite.spec.ts`

```typescript
import { test, expect } from '@playwright/test';

test('Import densité complet', async ({ page }) => {
  await page.goto('http://localhost:8080');
  
  // Ouvrir le wizard
  await page.click('#importCsvBtn');
  
  // Upload fichier
  const fileInput = page.locator('#importFile');
  await fileInput.setInputFiles('fixtures/densite_test.xlsx');
  
  // Vérifier détection
  await expect(page.locator('#sheet_densite')).toContainText('densite');
  
  // Suivant
  await page.click('#nextBtn');
  
  // Vérifier mapping
  await expect(page.locator('#map_densite')).toBeVisible();
  
  // Suivant
  await page.click('#nextBtn');
  
  // Vérifier aperçu
  await expect(page.locator('.preview-block')).toContainText('Densité');
  
  // Lancer import
  await page.click('#nextBtn');
  
  // Vérifier succès
  await expect(page.locator('.ok')).toContainText('Import réussi');
});
```

---

## 📚 Étape 5 : Documentation

### 5.1 Mettre à Jour IMPORT_XLSX.md

```markdown
## Essais Supportés

### Densité

**Feuille** : `densite`, `densité`, `density`

**Colonnes** :
- `code` (obligatoire) : Code du sondage
- `depth_m` (obligatoire) : Profondeur en mètres
- `rho_d_app` (obligatoire) : Densité apparente en g/cm³
- `rho_s_abs` (obligatoire) : Densité absolue en g/cm³
- `note` (optionnel) : Remarques

**Contraintes** :
- `depth_m` ≥ 0
- `0 < rho_d_app < 3`
- `1 < rho_s_abs < 4`

**Exemple** :
| Code | Profondeur | Densité Apparente | Densité Absolue | Note |
|------|------------|-------------------|-----------------|------|
| S001 | 2.5 | 1.85 | 2.65 | RAS |
| S001 | 5.0 | 1.92 | 2.68 | |
```

---

## ✅ Checklist Finale

### Frontend
- [ ] Type `SheetRole` étendu
- [ ] Aliases ajoutés dans `guessSheetsByRole()`
- [ ] Mapping par défaut dans `initializeXlsxMapping()`
- [ ] Sélecteur HTML ajouté (step-2)
- [ ] Mapping UI ajouté (step-3)
- [ ] Aperçu ajouté (step-4)
- [ ] Tests unitaires passent

### Backend
- [ ] Enum `TestType` étendu
- [ ] Parseur créé (`parsers/densite.rs`)
- [ ] Validation implémentée
- [ ] Parseur enregistré dans `PARSERS`
- [ ] Persistance implémentée
- [ ] Migration SQL (si nécessaire)
- [ ] Tests unitaires passent

### Tests
- [ ] Tests frontend (détection, mapping)
- [ ] Tests backend (parse, validation)
- [ ] Test E2E complet
- [ ] Fixture XLSX créée

### Documentation
- [ ] `IMPORT_XLSX.md` mis à jour
- [ ] Exemple ajouté
- [ ] Contraintes documentées

### Déploiement
- [ ] Build frontend OK
- [ ] Build backend OK
- [ ] Migration exécutée
- [ ] Tests E2E en staging OK
- [ ] Logs observabilité OK

---

## 🎯 Résultat Attendu

Après avoir suivi ce template, vous devriez avoir :

1. ✅ Détection automatique de la feuille "densite"
2. ✅ Mapping automatique des colonnes
3. ✅ Aperçu des données avant import
4. ✅ Validation des contraintes
5. ✅ Persistance en base de données
6. ✅ Tests complets
7. ✅ Documentation à jour

**Temps estimé** : 2-4 heures pour un développeur familier avec le code

---

**Template Version** : 1.0  
**Date** : 24 octobre 2025  
**Statut** : ✅ Prêt à utiliser
