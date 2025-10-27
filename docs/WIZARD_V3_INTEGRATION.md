# 🚀 Wizard Import V3 - Guide d'Intégration

## ✨ Nouveautés V3

### Améliorations Majeures
- ✅ **Parsing ExcelJS robuste** : Utilise `cell.text` correctement
- ✅ **Auto-guess intelligent** : Détecte automatiquement les feuilles et colonnes
- ✅ **Mapping fiable** : Listes déroulantes alimentées dynamiquement
- ✅ **Aperçu multi-feuilles** : Visualisation avant import
- ✅ **6 variantes de schéma** : Teste automatiquement différents contrats backend
- ✅ **Badge V3** : Preuve visuelle de la version active
- ✅ **Logs clairs** : `[WZ3]` pour debug facile

### Variantes de Schéma Testées

1. **A_config_rootMapping** : `{format, structure:{sheets}, mapping, options}`
2. **B_config_structureHasMapping** : `{format, structure:{sheets, mapping}, options}`
3. **C_payload_rootMapping** : Même que A mais avec champ `payload`
4. **D_payload_structureHasMapping** : Même que B mais avec champ `payload`
5. **E_config_modeXlsx** : `{mode:'xlsx', structure, mapping, options}`
6. **F_config_modeXlsxGeotech** : `{mode:'xlsx_geotech', ...}`

Le wizard essaie chaque variante jusqu'à ce qu'une retourne 200 OK.

## 📋 Intégration

### Étape 1 : Fichier Créé

Le fichier `ui/src/import-bulk-wizard_v3.ts` est déjà créé et prêt.

### Étape 2 : Modifier main.ts

Remplacez l'import de l'ancien wizard par le V3 :

```typescript
// Ancien (à commenter ou supprimer)
// import { ImportBulkWizard } from './import-bulk-wizard'

// Nouveau
import { bootImportWizardV3 } from './import-bulk-wizard_v3'
```

Puis dans la section d'initialisation :

```typescript
// Ancien
// const importWizard = new ImportBulkWizard('importBulkWizard', API_GEO, () => {
//   console.log('[IMPORT] Import terminé, rechargement de la grille...')
//   loadGrid(false)
// })

// Nouveau
bootImportWizardV3(API_GEO)
```

### Étape 3 : Vérifier le HTML

Le wizard V3 attend cette structure HTML (à adapter si nécessaire) :

```html
<div id="importWizardRoot">
  <div class="import-wizard-title">Import Bulk - Wizard Complet</div>

  <!-- Étape 1 : Upload -->
  <section class="step-1">
    <input id="importFile" type="file" accept=".xlsx,.csv,.txt" />
  </section>

  <!-- Étape 2 : Sélection des feuilles -->
  <section class="step-2" style="display:none">
    <select id="formatSelect"></select>
    <select id="sheet_sondages"></select>
    <select id="sheet_echantillons"></select>
    <select id="sheet_atterberg"></select>
    <select id="sheet_vbs"></select>
    <select id="sheet_proctor"></select>
    <select id="sheet_granulo_tamisage"></select>
    <select id="sheet_granulo_sedimento"></select>
  </section>

  <!-- Étape 3 : Mapping -->
  <section class="step-3" style="display:none">
    <div id="map_sondages"></div>
    <div id="map_echantillons"></div>
    <div id="map_atterberg"></div>
    <div id="map_vbs"></div>
    <div id="map_proctor"></div>
    <div id="map_granulo_tamisage"></div>
    <div id="map_granulo_sedimento"></div>
  </section>

  <!-- Étape 4 : Aperçu -->
  <section class="step-4" style="display:none">
    <div id="previewRoot"></div>
  </section>

  <!-- Étape 5 : Résultat -->
  <section class="step-5" style="display:none">
    <div id="importProgressLog"></div>
    <div id="importResult"></div>
  </section>

  <!-- Navigation -->
  <button id="prevBtn">Précédent</button>
  <button id="nextBtn">Suivant</button>
</div>
```

### Étape 4 : Build et Deploy

```powershell
cd ui
npm run build
cd ..
.\deploy_dist.ps1
```

### Étape 5 : Test

1. Rafraîchir le navigateur (`Ctrl + Shift + R`)
2. Vérifier le badge **V3** dans le titre du wizard
3. Uploader un fichier XLSX
4. Observer les logs `[WZ3]` dans la console

## 🧪 Tests à Effectuer

### Test 1 : Détection des Feuilles
- [ ] Upload d'un fichier XLSX
- [ ] Console affiche `[WZ3] Feuilles détectées: [...]`
- [ ] Les sélecteurs de l'étape 2 sont remplis
- [ ] Les feuilles sont auto-détectées (ex: "sondages" → sondages)

### Test 2 : Extraction des Colonnes
- [ ] Console affiche `[WZ3] Cols [nom_feuille] [...]`
- [ ] Les colonnes contiennent les en-têtes normalisés
- [ ] Le caractère `@` est préservé pour granulo

### Test 3 : Mapping Automatique
- [ ] Étape 3 : Les listes déroulantes sont remplies
- [ ] Les champs sont pré-sélectionnés (auto-guess)
- [ ] Modification d'un mapping fonctionne

### Test 4 : Aperçu
- [ ] Étape 4 : Les tableaux d'aperçu s'affichent
- [ ] Maximum 5 lignes par tableau
- [ ] Les données sont correctes

### Test 5 : Import avec Fallbacks
- [ ] Étape 5 : Le message "Essai [variante]..." s'affiche
- [ ] Console affiche `[WZ3] TRY [variante]`
- [ ] Une variante retourne 200 OK
- [ ] Console affiche `[WZ3] SUCCESS [variante]`
- [ ] Le résultat JSON s'affiche

### Test 6 : Gestion d'Erreurs
- [ ] Si toutes les variantes échouent, message d'erreur clair
- [ ] Les logs montrent les réponses 4xx du serveur
- [ ] Le message indique quelle variante a échoué et pourquoi

## 🔍 Debugging

### Logs Console Attendus

```
[WZ3] Fichier choisi: atlas_import_example.xlsx 123456 bytes
[WZ3] Feuilles détectées: ['sondages', 'echantillons', 'atterberg', ...]
[WZ3] Cols sondages ['code', 'localite', 'date', 'lat', 'lon', ...]
[WZ3] Cols echantillons ['code', 'depth_m', 'date', ...]
[WZ3] TRY A_config_rootMapping -> split fields ['format', 'structure', 'mapping', 'options']
[WZ3] RESP 4xx A_config_rootMapping missing field 'mapping'
[WZ3] TRY B_config_structureHasMapping -> split fields ['format', 'structure', 'options']
[WZ3] SUCCESS B_config_structureHasMapping { imported: 42, errors: [] }
```

### Problèmes Courants

**Problème** : Badge V3 n'apparaît pas
**Cause** : L'élément `.import-wizard-title` n'existe pas
**Solution** : Vérifier le HTML ou adapter le sélecteur

**Problème** : Listes déroulantes vides
**Cause** : Les colonnes ne sont pas détectées
**Solution** : Vérifier les logs `[WZ3] Cols` et la méthode `extractHeaders()`

**Problème** : Toutes les variantes échouent
**Cause** : Le contrat backend ne correspond à aucune variante
**Solution** : Analyser les logs `[WZ3] RESP 4xx` et ajouter une nouvelle variante

## 📊 Comparaison V2 vs V3

| Fonctionnalité | V2 | V3 |
|----------------|----|----|
| Parsing ExcelJS | ❌ Utilise `cell.value` | ✅ Utilise `cell.text` |
| Auto-guess | ⚠️ Partiel | ✅ Complet |
| Mapping dynamique | ❌ Statique | ✅ Listes déroulantes |
| Aperçu | ⚠️ Limité | ✅ Multi-feuilles |
| Variantes schéma | ⚠️ 4 variantes | ✅ 6 variantes |
| Logs | `[WZ]` | `[WZ3]` |
| Badge version | ❌ | ✅ |
| Gestion erreurs | ⚠️ Basique | ✅ Détaillée |

## 🚀 Prochaines Étapes

1. **Intégrer** : Modifier `main.ts` pour utiliser V3
2. **Tester** : Uploader un fichier XLSX réel
3. **Analyser** : Noter quelle variante fonctionne
4. **Documenter** : Mettre à jour le contrat backend
5. **Optimiser** : Supprimer les variantes inutiles

## 💡 Conseils

- **Gardez V2** : Commentez l'ancien code au lieu de le supprimer (rollback facile)
- **Logs** : Filtrez sur `[WZ3]` dans la console pour isoler les logs du wizard
- **Backend** : Consultez `docker compose logs api-geo` pour voir les erreurs côté serveur
- **Variantes** : Une fois que vous savez quelle variante fonctionne, vous pouvez simplifier le code

---

**Status** : ✅ V3 créé et prêt à intégrer
**Prochaine action** : Modifier `main.ts` et tester
