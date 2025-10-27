# ✅ Implémentation - Nouveaux Essais

## 🎯 Objectif

Ajouter 3 nouveaux types d'essais au Wizard Import V3 :
1. **Densité** (`densite`)
2. **Teneur en Eau** (`teneur_eau`)
3. **Classification** (`classification`)

---

## ✅ Frontend - Implémenté

### 1. Types Étendus

```typescript
type SheetRole =
  | "sondages"
  | "echantillons"
  | "atterberg"
  | "vbs"
  | "proctor"
  | "granulo_tamisage_large"
  | "granulo_sedimento_large"
  // 🆕 Nouveaux essais
  | "densite"
  | "teneur_eau"
  | "classification";
```

### 2. Détection Automatique (Aliases)

```typescript
densite: f("densite") || f("density") || f("rho") || undefined,
teneur_eau: f("teneur_eau") || f("water_content") || f("w_naturel") || undefined,
classification: f("classification") || f("classement") || f("hrb") || f("uscs") || undefined,
```

### 3. Mapping par Défaut

#### Densité
```typescript
densite: {
  code: ["code", "code_site", "localite"],
  depth_m: ["depth_m", "profondeur_m", "z_m"],
  rho_d_app: ["rho_d_app", "densite_apparente", "gamma_d", "rho_d"],
  rho_s_abs: ["rho_s_abs", "densite_absolue", "gamma_s", "rho_s"],
  note: ["note", "remarque", "comment"],
}
```

#### Teneur en Eau
```typescript
teneur_eau: {
  code: ["code", "code_site", "localite"],
  depth_m: ["depth_m", "profondeur_m", "z_m"],
  w: ["w", "teneur_eau", "water_content", "wc"],
  wi: ["wi", "w_i", "indice_plasticite"],
  note: ["note", "remarque", "comment"],
}
```

#### Classification
```typescript
classification: {
  code: ["code", "code_site", "localite"],
  depth_m: ["depth_m", "profondeur_m", "z_m"],
  hrb: ["hrb", "classification_hrb", "aashto"],
  unified: ["unified", "uscs", "classification_unifiee"],
  bm: ["bm", "bleu_methylene", "classification_bm"],
  note: ["note", "remarque", "comment"],
}
```

### 4. UI - Sélecteurs de Feuilles

```html
<!-- Étape 2 -->
<div class="form-group">
  <label>Densité</label>
  <select id="sheet_densite"></select>
</div>
<div class="form-group">
  <label>Teneur en Eau</label>
  <select id="sheet_teneur_eau"></select>
</div>
<div class="form-group">
  <label>Classification</label>
  <select id="sheet_classification"></select>
</div>
```

### 5. UI - Containers de Mapping

```html
<!-- Étape 3 -->
<div id="map_densite"></div>
<div id="map_teneur_eau"></div>
<div id="map_classification"></div>
```

### 6. Mapping UI

```typescript
mountRole("densite", "#map_densite", [
  "code", "depth_m", "rho_d_app", "rho_s_abs", "note"
]);

mountRole("teneur_eau", "#map_teneur_eau", [
  "code", "depth_m", "w", "wi", "note"
]);

mountRole("classification", "#map_classification", [
  "code", "depth_m", "hrb", "unified", "bm", "note"
]);
```

### 7. Aperçu

```typescript
pushBlock("Densité", "densite", [
  "code", "depth_m", "rho_d_app", "rho_s_abs"
]);

pushBlock("Teneur en Eau", "teneur_eau", [
  "code", "depth_m", "w", "wi"
]);

pushBlock("Classification", "classification", [
  "code", "depth_m", "hrb", "unified", "bm"
]);
```

---

## 📊 Structure XLSX Attendue

### Feuille "densite"

| Colonne | Type | Obligatoire | Unité | Contraintes |
|---------|------|-------------|-------|-------------|
| `code` | string | ✅ | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 |
| `rho_d_app` | float | ✅ | g/cm³ | 0 < x < 3 |
| `rho_s_abs` | float | ✅ | g/cm³ | 1 < x < 4 |
| `note` | string | ❌ | - | Remarques |

**Exemple** :
| code | depth_m | rho_d_app | rho_s_abs | note |
|------|---------|-----------|-----------|------|
| S001 | 2.5 | 1.85 | 2.65 | RAS |
| S001 | 5.0 | 1.92 | 2.68 | |

### Feuille "teneur_eau"

| Colonne | Type | Obligatoire | Unité | Contraintes |
|---------|------|-------------|-------|-------------|
| `code` | string | ✅ | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 |
| `w` | float | ✅ | % | 0 ≤ x ≤ 100 |
| `wi` | float | ❌ | % | 0 ≤ x ≤ 100 |
| `note` | string | ❌ | - | Remarques |

**Exemple** :
| code | depth_m | w | wi | note |
|------|---------|---|-------|------|
| S001 | 2.5 | 15.2 | 12.5 | |
| S001 | 5.0 | 18.7 | 14.2 | Humide |

### Feuille "classification"

| Colonne | Type | Obligatoire | Unité | Contraintes |
|---------|------|-------------|-------|-------------|
| `code` | string | ✅ | - | Code du sondage |
| `depth_m` | float | ✅ | m | ≥ 0 |
| `hrb` | string | ❌ | - | Classification HRB/AASHTO |
| `unified` | string | ❌ | - | Classification USCS |
| `bm` | string | ❌ | - | Classification Bleu de Méthylène |
| `note` | string | ❌ | - | Remarques |

**Exemple** :
| code | depth_m | hrb | unified | bm | note |
|------|---------|-----|---------|-------|------|
| S001 | 2.5 | A-2-4 | SM | A2 | |
| S001 | 5.0 | A-7-6 | CH | A4 | Argile |

---

## 🧪 Tests à Effectuer

### Test 1 : Détection
- [ ] Créer un fichier XLSX avec feuilles "densite", "teneur_eau", "classification"
- [ ] Uploader dans le wizard
- [ ] Vérifier que les feuilles sont détectées
- [ ] Console affiche `[WZ3] Feuilles détectées: [..., 'densite', 'teneur_eau', 'classification']`

### Test 2 : Sélection
- [ ] Étape 2 : Vérifier que les 3 nouveaux sélecteurs sont présents
- [ ] Vérifier que les feuilles sont pré-sélectionnées
- [ ] Modifier une sélection

### Test 3 : Mapping
- [ ] Étape 3 : Vérifier que les 3 sections de mapping apparaissent
- [ ] Vérifier que les colonnes sont détectées
- [ ] Vérifier que les champs sont pré-mappés
- [ ] Modifier un mapping

### Test 4 : Aperçu
- [ ] Étape 4 : Vérifier que les 3 tableaux d'aperçu s'affichent
- [ ] Vérifier que les données sont correctes
- [ ] Maximum 5 lignes par tableau

### Test 5 : Import
- [ ] Étape 5 : Lancer l'import
- [ ] Observer les tentatives de variantes
- [ ] Noter quelle variante fonctionne
- [ ] Vérifier le résultat JSON

---

## ⏭️ Prochaines Étapes

### Backend (À Implémenter)

#### 1. Enum TestType
```rust
pub enum TestType {
    Atterberg,
    Vbs,
    Proctor,
    GranuloTamisage,
    GranuloSedimento,
    // 🆕 À ajouter
    Densite,
    TeneurEau,
    Classification,
}
```

#### 2. Parseurs
- `api/src/import/parsers/densite.rs`
- `api/src/import/parsers/teneur_eau.rs`
- `api/src/import/parsers/classification.rs`

#### 3. Validation
```rust
fn validate_densite(depth_m: f64, rho_d_app: f64, rho_s_abs: f64) -> Result<()> {
    if depth_m < 0.0 {
        bail!("depth_m doit être ≥ 0");
    }
    if rho_d_app <= 0.0 || rho_d_app >= 3.0 {
        bail!("rho_d_app hors bornes [0, 3]");
    }
    if rho_s_abs <= 1.0 || rho_s_abs >= 4.0 {
        bail!("rho_s_abs hors bornes [1, 4]");
    }
    Ok(())
}
```

#### 4. Persistance
Option recommandée : Table normalisée `lab_results`

```sql
-- Densité → 2 lignes
INSERT INTO lab_results (sample_id, test_type, param_key, value_num, unit, meta)
VALUES 
  (123, 'densite', 'rho_d_app', 1.85, 'g/cm3', '{}'),
  (123, 'densite', 'rho_s_abs', 2.65, 'g/cm3', '{}');
```

#### 5. Enregistrement
```rust
lazy_static! {
    static ref PARSERS: HashMap<TestType, ParserFn> = {
        let mut m = HashMap::new();
        // ... existants
        m.insert(TestType::Densite, parse_densite as ParserFn);
        m.insert(TestType::TeneurEau, parse_teneur_eau as ParserFn);
        m.insert(TestType::Classification, parse_classification as ParserFn);
        m
    };
}
```

---

## 📝 Fichiers Modifiés

### Frontend
- ✅ `ui/src/import-bulk-wizard_v3.ts` (modifié)
  - Types étendus
  - Détection automatique
  - Mapping par défaut
  - UI complète
  - Aperçu

### Backend (À Faire)
- ⏳ `api/src/import/types.rs` (à modifier)
- ⏳ `api/src/import/parsers/densite.rs` (à créer)
- ⏳ `api/src/import/parsers/teneur_eau.rs` (à créer)
- ⏳ `api/src/import/parsers/classification.rs` (à créer)
- ⏳ `api/src/import/mod.rs` (à modifier)
- ⏳ `api/src/import/persist.rs` (à modifier)

---

## 🎯 Status

### ✅ Complété
- [x] Types frontend
- [x] Détection automatique
- [x] Mapping par défaut
- [x] UI sélecteurs
- [x] UI mapping
- [x] Aperçu
- [x] Build réussi
- [x] Déploiement OK

### ⏳ En Attente
- [ ] Backend enum
- [ ] Backend parseurs
- [ ] Backend validation
- [ ] Backend persistance
- [ ] Tests unitaires backend
- [ ] Tests E2E
- [ ] Documentation API

### 🧪 À Tester
- [ ] Upload fichier XLSX avec nouveaux essais
- [ ] Détection des feuilles
- [ ] Mapping automatique
- [ ] Aperçu des données
- [ ] Import (nécessite backend)

---

## 📊 Métriques

- **Lignes ajoutées** : ~150
- **Nouveaux essais** : 3
- **Colonnes totales** : 15
- **Temps implémentation** : ~30 minutes
- **Build** : ✅ Réussi (6.55s)
- **Déploiement** : ✅ OK

---

## 💡 Notes

### Fallback "Raw"
Si le backend n'est pas encore prêt, les données seront stockées en "raw" (JSONB) sans être perdues. Elles pourront être retraitées plus tard.

### Extensibilité
L'ajout d'un nouvel essai suit maintenant un pattern clair :
1. Ajouter le type
2. Ajouter les aliases
3. Ajouter le mapping
4. Ajouter l'UI
5. Ajouter l'aperçu

**Temps estimé par essai** : 10-15 minutes

---

**Date** : 24 octobre 2025  
**Version** : V3.1  
**Statut** : ✅ Frontend déployé, Backend en attente  
**Prochaine action** : Tester avec fichier XLSX réel
