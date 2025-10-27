# ✅ Import Bulk Wizard v3.0 - XLSX Intégré

**Date:** 22 octobre 2025  
**Status:** ✅ XLSX complètement intégré dans le wizard unique

---

## 🎯 Problème Résolu

### Avant v3.0
```
❌ Détection XLSX → Modale "Rediriger vers import géotechnique"
❌ Clic OK → Rien ne se passe (route inexistante)
❌ Workflow cassé
```

### Après v3.0
```
✅ Détection XLSX → Toast informatif
✅ Workflow complet dans le même wizard
✅ 5 étapes fluides: Upload → Feuilles → (skip Mapping) → Aperçu → Import
✅ Aucune redirection, tout en interne
```

---

## 🏗️ Architecture Implémentée

### Types Ajoutés
```typescript
import * as XLSX from 'xlsx'

type ImportMode = 'csv' | 'xlsx'

type SheetRole =
  | 'sondages'
  | 'echantillons'
  | 'atterberg'
  | 'vbs'
  | 'proctor'
  | 'granulo_tamisage_large'
  | 'granulo_sedimento_large'

type XlsxSheets = Partial<Record<SheetRole, string>>
```

### État Étendu
```typescript
// Nouveaux champs dans ImportBulkWizard
private mode: ImportMode = 'csv'
private workbook: XLSX.WorkBook | null = null
private detectedSheets: string[] = []
private sheetMap: XlsxSheets = {}
private parsed: Partial<Record<SheetRole, any[]>> = {}
```

---

## 🔄 Workflow Complet

### Mode CSV (Inchangé)
```
Étape 0: Upload fichier CSV
Étape 1: Mapping colonnes
Étape 2: (skip)
Étape 3: Aperçu + Validation
Étape 4: Import
```

### Mode XLSX (Nouveau)
```
Étape 0: Upload fichier XLSX
         ↓
         Toast: "📊 Fichier XLSX détecté — import multi-feuilles activé"
         ↓
Étape 1: Sélection des feuilles
         - Auto-détection par heuristiques
         - Mapping manuel si nécessaire
         - Sondages obligatoire
         ↓
         Parse toutes les feuilles sélectionnées
         ↓
Étape 3: Aperçu multi-feuilles
         - Statistiques par type
         - 5 premières lignes par feuille
         - Compteurs globaux
         ↓
Étape 4: Import
         - Payload JSON unifié
         - POST /api/import/bulk
```

---

## 📝 Méthodes Ajoutées

### 1. showToast()
```typescript
private showToast(message: string) {
  const toast = document.createElement('div')
  toast.style.cssText = 'position: fixed; top: 20px; right: 20px; ...'
  toast.textContent = message
  document.body.appendChild(toast)
  setTimeout(() => toast.remove(), 5000)
}
```

### 2. autodetectSheetRoles()
```typescript
private autodetectSheetRoles(names: string[]): XlsxSheets {
  const find = (...aliases: string[]) =>
    names.find(n => aliases.some(a => n.toLowerCase().includes(a)))

  return {
    sondages: find('sond', 'sites', 'site', 'survey'),
    echantillons: find('echant', 'sample', 'prelevement'),
    atterberg: find('atter', 'wl', 'wp', 'ip', 'limite'),
    vbs: find('vbs', 'bleu', 'methylene'),
    proctor: find('proctor', 'gamma', 'wopt', 'compactage'),
    granulo_tamisage_large: find('granulo', 'tamis', 'tamisage', 'sieve'),
    granulo_sedimento_large: find('sedim', 'sedimenta', 'hydro'),
  }
}
```

### 3. renderXlsxSheetSelection()
```typescript
private renderXlsxSheetSelection(): string {
  // Affiche:
  // - Liste des feuilles détectées
  // - Dropdowns pour associer chaque rôle à une feuille
  // - Sondages marqué comme obligatoire (rouge)
  // - Autres optionnels (gris)
}
```

### 4. attachXlsxSheetListeners()
```typescript
private attachXlsxSheetListeners() {
  document.querySelectorAll('.sheet-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const role = (e.target as HTMLSelectElement).dataset.role as SheetRole
      const value = (e.target as HTMLSelectElement).value
      
      if (value) {
        this.sheetMap[role] = value
      } else {
        delete this.sheetMap[role]
      }
    })
  })
}
```

### 5. parseSelectedSheets()
```typescript
private parseSelectedSheets() {
  // Vérifier que sondages est sélectionné
  if (!this.sheetMap.sondages) {
    alert('⚠️ La feuille "Sondages" est obligatoire')
    return false
  }

  // Parser chaque feuille avec XLSX.utils.sheet_to_json
  // Normaliser les en-têtes (lowercase, trim, replace spaces)
  // Sanitizer les cellules (CSV injection)
  
  this.parsed = { /* données par rôle */ }
  return true
}
```

### 6. renderXlsxPreview()
```typescript
private renderXlsxPreview(): string {
  // Affiche:
  // - Statistiques globales (total lignes)
  // - Compteurs par type (sondages, atterberg, vbs, etc.)
  // - Aperçu tableau (5 lignes) par feuille
  // - Message "✅ Prêt à importer"
}
```

### 7. getRoleLabel()
```typescript
private getRoleLabel(role: SheetRole): string {
  const labels: Record<SheetRole, string> = {
    sondages: 'Sondages',
    echantillons: 'Échantillons',
    atterberg: 'Atterberg',
    vbs: 'VBS',
    proctor: 'Proctor',
    granulo_tamisage_large: 'Granulo Tamisage',
    granulo_sedimento_large: 'Granulo Sédimentation',
  }
  return labels[role] || role
}
```

---

## 🔧 Méthodes Modifiées

### handleFile()
```typescript
// Avant: confirm() + redirection
if (isXLSX) {
  const useGeotechImport = confirm(...)
  if (useGeotechImport) {
    alert('🚀 Redirection...')  // ❌ Ne mène nulle part
    this.close()
    return
  }
}

// Après: lecture directe + toast
if (isXLSX) {
  this.showToast('📊 Fichier XLSX détecté — import multi-feuilles activé')
  
  const data = await file.arrayBuffer()
  this.workbook = XLSX.read(data, { type: 'array' })
  this.detectedSheets = this.workbook.SheetNames
  this.sheetMap = this.autodetectSheetRoles(this.detectedSheets)
  
  this.mode = 'xlsx'
  this.currentStep = 1  // Étape 2 = Sélection feuilles
  this.renderStep()
  return
}
```

### renderStep()
```typescript
case 1:
  if (this.mode === 'xlsx') {
    content.innerHTML = this.renderXlsxSheetSelection()
    this.attachXlsxSheetListeners()
  } else {
    content.innerHTML = this.renderMappingStep()
    this.attachMappingListeners()
  }
  break
```

### nextStep()
```typescript
// Étape 1: Mode XLSX = sélection des feuilles
if (this.currentStep === 1 && this.mode === 'xlsx') {
  if (!this.parseSelectedSheets()) {
    return
  }
  // Passer directement à l'aperçu (étape 3) pour XLSX
  this.currentStep = 3
  this.render()
  return
}

// Étape 3: Validation différente selon mode
if (this.currentStep === 3) {
  if (this.mode === 'csv') {
    const validation = this.validateAllData()
    // ... validation complète
  } else {
    // Mode XLSX: validation basique
    if (!this.parsed.sondages || this.parsed.sondages.length === 0) {
      alert('⛔ Aucune donnée dans la feuille Sondages')
      return
    }
  }
}
```

### renderPreviewStep()
```typescript
private renderPreviewStep(): string {
  if (this.mode === 'xlsx') {
    return this.renderXlsxPreview()
  }
  
  // ... aperçu CSV classique
}
```

### startImport()
```typescript
let payload: any

if (this.mode === 'xlsx') {
  // Mode XLSX: envoyer les données multi-feuilles
  payload = {
    mode: 'xlsx',
    ...this.parsed,  // sondages, echantillons, atterberg, vbs, etc.
    options: { refresh_mv: true }
  }
} else {
  // Mode CSV: transformer selon le mapping
  const transformedData = this.data.map(row => { /* ... */ })
  payload = {
    mode: 'csv',
    data: transformedData
  }
}

const response = await fetch(`${this.apiUrl}/import/bulk`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(payload)
})
```

---

## 📊 Payload API

### Mode CSV
```json
{
  "mode": "csv",
  "data": [
    { "code": "BULK-001", "lat": 6.1345, "lon": 1.2123, "depth_m": 5.0, ... }
  ]
}
```

### Mode XLSX
```json
{
  "mode": "xlsx",
  "sondages": [
    { "code": "SITE-A", "date": "2025-01-10", "lat": 6.1345, "lon": 1.2123, ... }
  ],
  "echantillons": [
    { "code": "SITE-A", "depth_m": 2.0, "sample_id": "ECH-001", ... }
  ],
  "atterberg": [
    { "code": "SITE-A", "depth_m": 2.0, "wl": 45.5, "wp": 22.1, "ip": 23.4 }
  ],
  "vbs": [
    { "code": "SITE-A", "depth_m": 2.0, "vbs": 2.5 }
  ],
  "proctor": [
    { "code": "SITE-A", "depth_m": 2.0, "gamma_d_max": 18.5, "w_opt": 12.3, "proctor_type": "normal" }
  ],
  "granulo_tamisage_large": [
    { "code": "SITE-A", "depth_m": 2.0, "sieve_mm": 25, "passing_pct": 100 },
    { "code": "SITE-A", "depth_m": 2.0, "sieve_mm": 20, "passing_pct": 98.5 }
  ],
  "granulo_sedimento_large": [
    { "code": "SITE-A", "depth_m": 2.0, "size_mm": 0.08, "passing_pct": 45.2 }
  ],
  "options": { "refresh_mv": true }
}
```

---

## 🎨 Interface Utilisateur

### Étape 1 (Upload)
```
📁 Étape 1: Chargement du fichier

[Zone de drop]
Glissez-déposez votre fichier ici
ou cliquez pour sélectionner
Formats acceptés: CSV, XLSX

✓ atlas_import_example.xlsx
  2.5 MB • 7 feuilles détectées

📋 Télécharger un modèle
[📥 Modèle CSV] [📊 Modèle XLSX] [✨ Exemple XLSX complet]

ℹ️ Formats supportés
📄 CSV: Format simple, une ligne par essai
📊 XLSX multi-feuilles: Granulo complète, Atterberg, VBS, Proctor (recommandé)
```

### Étape 2 XLSX (Sélection Feuilles)
```
📊 Étape 2: Sélection des feuilles

📄 7 feuille(s) détectée(s): sondages, echantillons, atterberg, vbs, proctor, granulo_tamisage_large, granulo_sedimento_large

Sondages (obligatoire)      [sondages ▼]
Échantillons (optionnel)    [echantillons ▼]
Atterberg (WL/WP/IP)        [atterberg ▼]
Valeur de Bleu (VBS)        [vbs ▼]
Proctor (γdmax, wopt)       [proctor ▼]
Granulo tamisage            [granulo_tamisage_large ▼]
Granulo sédimentation       [granulo_sedimento_large ▼]

💡 Astuce:
La feuille "Sondages" est obligatoire. Les autres sont optionnelles selon vos données disponibles.

[← Précédent] [Suivant →]
```

### Étape 4 XLSX (Aperçu)
```
👁️ Étape 4: Aperçu XLSX Multi-Feuilles

[150]          [2]           [45]          [40]
Lignes totales  Sondages     Atterberg     VBS

📋 Sondages (2 ligne(s))
┌──────────┬────────────┬─────────┬─────────┬───────┐
│ code     │ date       │ lat     │ lon     │ ...   │
├──────────┼────────────┼─────────┼─────────┼───────┤
│ SITE-A   │ 2025-01-10 │ 6.1345  │ 1.2123  │ ...   │
│ SITE-B   │ 2025-01-11 │ 6.2456  │ 1.3234  │ ...   │
└──────────┴────────────┴─────────┴─────────┴───────┘

📋 Atterberg (45 ligne(s))
┌──────────┬──────────┬──────┬──────┬──────┐
│ code     │ depth_m  │ wl   │ wp   │ ip   │
├──────────┼──────────┼──────┼──────┼──────┤
│ SITE-A   │ 2.0      │ 45.5 │ 22.1 │ 23.4 │
│ SITE-A   │ 5.0      │ 38.2 │ 20.5 │ 17.7 │
│ ...      │ ...      │ ...  │ ...  │ ...  │
└──────────┴──────────┴──────┴──────┴──────┘
... et 40 autres ligne(s)

✅ Prêt à importer: 150 ligne(s) réparties sur 7 feuille(s).

[← Précédent] [Importer →]
```

---

## ✅ Avantages v3.0

| Aspect | v2.0 | v3.0 |
|--------|------|------|
| **Workflow XLSX** | ❌ Cassé (redirection nulle part) | ✅ Complet en interne |
| **Nombre de wizards** | 2 (bulk + géotech) | 1 (unifié) |
| **Expérience utilisateur** | ❌ Confuse | ✅ Fluide |
| **Auto-détection feuilles** | ❌ | ✅ Heuristiques |
| **Aperçu multi-feuilles** | ❌ | ✅ Détaillé |
| **Payload unifié** | ❌ | ✅ JSON structuré |
| **Maintenance** | Complexe (2 wizards) | Simple (1 wizard) |

---

## 🧪 Tests à Effectuer

### Test 1: CSV Classique
```bash
1. Charger un CSV simple
2. Vérifier: mode='csv', étapes 0→1→2→3→4
3. Vérifier: mapping colonnes fonctionne
4. Vérifier: validation complète
5. Vérifier: payload mode='csv'
```

### Test 2: XLSX Multi-Feuilles
```bash
1. Charger atlas_import_example.xlsx
2. Vérifier: toast "📊 Fichier XLSX détecté"
3. Vérifier: mode='xlsx', étapes 0→1→3→4 (skip 2)
4. Vérifier: auto-détection des 7 feuilles
5. Vérifier: aperçu affiche toutes les feuilles
6. Vérifier: payload mode='xlsx' avec toutes les feuilles
```

### Test 3: XLSX Partiel
```bash
1. Charger XLSX avec seulement sondages + atterberg
2. Vérifier: sélection manuelle des feuilles
3. Vérifier: aperçu affiche seulement 2 feuilles
4. Vérifier: payload contient seulement sondages + atterberg
```

### Test 4: Validation
```bash
1. Charger XLSX sans feuille "sondages"
2. Vérifier: alerte "⚠️ La feuille Sondages est obligatoire"
3. Vérifier: import bloqué
```

---

## 📦 Dépendances

```json
{
  "dependencies": {
    "xlsx": "^0.18.5"
  }
}
```

```bash
npm install xlsx
```

---

## 🚀 Déploiement

```bash
# Frontend
cd ui
npm install
npm run build

# Backend (adapter l'endpoint /import/bulk)
cd services/api-geo
# Implémenter le switch mode='csv' | 'xlsx'
cargo build --release
```

---

## 📝 Backend TODO

### Endpoint à Adapter
```rust
POST /api/import/bulk

#[derive(Deserialize)]
struct BulkImportRequest {
  mode: Option<String>, // "csv" | "xlsx"
  
  // Mode CSV
  data: Option<Vec<CsvRow>>,
  
  // Mode XLSX
  sondages: Option<Vec<SondageIn>>,
  echantillons: Option<Vec<EchantillonIn>>,
  atterberg: Option<Vec<AtterbergIn>>,
  vbs: Option<Vec<VbsIn>>,
  proctor: Option<Vec<ProctorIn>>,
  granulo_tamisage_large: Option<Vec<GranuloRow>>,
  granulo_sedimento_large: Option<Vec<GranuloRow>>,
  
  options: Option<ImportOptions>,
}

async fn import_bulk(payload: Json<BulkImportRequest>) -> Result<Json<ImportResult>> {
  match payload.mode.as_deref() {
    Some("csv") => import_csv(payload.data),
    Some("xlsx") => import_xlsx_multisheet(payload),
    _ => Err("Mode inconnu")
  }
}
```

---

## ✅ Checklist Finale

- [x] Dépendance `xlsx` installée
- [x] Types `ImportMode`, `SheetRole`, `XlsxSheets` ajoutés
- [x] État étendu (workbook, detectedSheets, sheetMap, parsed)
- [x] `showToast()` implémenté
- [x] `autodetectSheetRoles()` implémenté
- [x] `renderXlsxSheetSelection()` implémenté
- [x] `attachXlsxSheetListeners()` implémenté
- [x] `parseSelectedSheets()` implémenté
- [x] `renderXlsxPreview()` implémenté
- [x] `getRoleLabel()` implémenté
- [x] `handleFile()` modifié (plus de redirection)
- [x] `renderStep()` modifié (switch mode)
- [x] `nextStep()` modifié (workflow XLSX)
- [x] `renderPreviewStep()` modifié (switch mode)
- [x] `startImport()` modifié (payload unifié)
- [x] Thème sombre préservé partout
- [x] Documentation complète

---

**🎉 Wizard v3.0 - XLSX Complètement Intégré !**

Plus de redirection, plus de workflow cassé. Un seul wizard, deux modes (CSV/XLSX), expérience fluide de bout en bout.
