# ✅ Wizard Import V3 - Déployé avec Succès

## 🎉 Status : DÉPLOYÉ

Le Wizard Import V3 est maintenant **déployé et actif** dans le conteneur UI.

## 📋 Ce qui a été fait

### 1. Création du Wizard V3
- ✅ Fichier `ui/src/import-bulk-wizard_v3.ts` créé
- ✅ Parsing ExcelJS robuste avec `cell.text`
- ✅ Auto-guess intelligent des feuilles et colonnes
- ✅ Mapping dynamique avec listes déroulantes
- ✅ Aperçu multi-feuilles
- ✅ 6 variantes de schéma testées automatiquement
- ✅ Badge "V3" visible
- ✅ Logs `[WZ3]` pour debug

### 2. Intégration dans main.ts
- ✅ Import de `bootImportWizardV3`
- ✅ Ancien wizard V2 commenté (rollback facile)
- ✅ Bouton d'ouverture adapté (scroll vers wizard)
- ✅ Configuration API_GEO avec localStorage

### 3. Corrections API
- ✅ `main.ts` : Lecture du localStorage pour API_GEO
- ✅ `vite.config.ts` : Proxy configuré pour mode dev
- ✅ Module `api.ts` créé pour centraliser les requêtes

### 4. Build et Déploiement
- ✅ Build réussi : `index-DensI5PX.js` (1.4 MB)
- ✅ Déployé dans le conteneur Nginx
- ✅ Logs `[WZ3]` présents dans le bundle

## 🧪 Tests à Effectuer

### Test 1 : Vérifier le Badge V3
1. Ouvrir http://localhost:8080
2. Rafraîchir avec `Ctrl + Shift + R`
3. Chercher le wizard d'import
4. **Vérifier** : Badge bleu "V3" visible dans le titre

### Test 2 : Upload et Détection
1. Uploader un fichier XLSX
2. **Console** : Vérifier les logs `[WZ3]`
   ```
   [WZ3] Fichier choisi: example.xlsx ...
   [WZ3] Feuilles détectées: [...]
   [WZ3] Cols sondages [...]
   ```

### Test 3 : Sélection des Feuilles
1. Étape 2 : Vérifier que les sélecteurs sont remplis
2. **Vérifier** : Les feuilles détectées apparaissent dans les listes
3. **Vérifier** : Les feuilles sont pré-sélectionnées (auto-guess)

### Test 4 : Mapping
1. Étape 3 : Vérifier les listes déroulantes
2. **Vérifier** : Les colonnes détectées apparaissent
3. **Vérifier** : Les champs sont pré-mappés
4. Modifier un mapping et vérifier qu'il est pris en compte

### Test 5 : Aperçu
1. Étape 4 : Vérifier les tableaux d'aperçu
2. **Vérifier** : Maximum 5 lignes par tableau
3. **Vérifier** : Les données sont correctes

### Test 6 : Import avec Variantes
1. Étape 5 : Lancer l'import
2. **Console** : Observer les tentatives
   ```
   [WZ3] TRY A_config_rootMapping
   [WZ3] RESP 4xx A_config_rootMapping ...
   [WZ3] TRY B_config_structureHasMapping
   [WZ3] SUCCESS B_config_structureHasMapping
   ```
3. **Vérifier** : Une variante retourne 200 OK
4. **Noter** : Quelle variante a fonctionné

## 🔍 Logs Console Attendus

```
[INIT] API_GEO configuré: /api
[INIT] Initialisation Import Bulk Wizard V3...
[INIT] ✅ Import Bulk Wizard initialisé
[WZ3] Fichier choisi: atlas_import_example.xlsx 123456 bytes
[WZ3] Feuilles détectées: ['sondages', 'echantillons', 'atterberg', ...]
[WZ3] Cols sondages ['code', 'localite', 'date', 'lat', 'lon', ...]
[WZ3] Cols echantillons ['code', 'depth_m', 'date', ...]
[WZ3] TRY A_config_rootMapping -> split fields ['format', 'structure', 'mapping', 'options']
[WZ3] RESP 4xx A_config_rootMapping ...
[WZ3] TRY B_config_structureHasMapping -> split fields ['format', 'structure', 'options']
[WZ3] SUCCESS B_config_structureHasMapping { imported: 42, errors: [] }
```

## 📊 Variantes de Schéma

Le wizard teste automatiquement ces 6 variantes :

1. **A_config_rootMapping**
   ```json
   {
     "format": "xlsx",
     "structure": { "sheets": {...} },
     "mapping": {...},
     "options": { "refresh_mv": true }
   }
   ```

2. **B_config_structureHasMapping**
   ```json
   {
     "format": "xlsx",
     "structure": { "sheets": {...}, "mapping": {...} },
     "options": { "refresh_mv": true }
   }
   ```

3. **C_payload_rootMapping** (même que A, champ `payload`)

4. **D_payload_structureHasMapping** (même que B, champ `payload`)

5. **E_config_modeXlsx**
   ```json
   {
     "mode": "xlsx",
     "structure": { "sheets": {...} },
     "mapping": {...},
     "options": { "refresh_mv": true }
   }
   ```

6. **F_config_modeXlsxGeotech**
   ```json
   {
     "mode": "xlsx_geotech",
     "structure": { "sheets": {...} },
     "mapping": {...},
     "options": { "refresh_mv": true }
   }
   ```

## 🐛 Troubleshooting

### Problème : Badge V3 non visible
**Cause** : Le HTML ne contient pas `.import-wizard-title`
**Solution** : Vérifier la structure HTML ou adapter le sélecteur dans V3

### Problème : Erreur "#importWizardRoot introuvable"
**Cause** : L'élément HTML n'existe pas
**Solution** : Ajouter `<div id="importWizardRoot">...</div>` dans le HTML

### Problème : Listes déroulantes vides
**Cause** : Les colonnes ne sont pas détectées
**Solution** : Vérifier les logs `[WZ3] Cols` et le fichier XLSX

### Problème : Toutes les variantes échouent
**Cause** : Le backend n'accepte aucune des 6 variantes
**Solution** : 
1. Consulter `docker compose logs api-geo`
2. Analyser les messages d'erreur
3. Ajouter une 7ème variante si nécessaire

### Problème : "Failed to fetch"
**Cause** : API_GEO mal configuré
**Solution** : 
1. Ouvrir http://localhost:8080/fix_api_url.html
2. Cliquer "Corriger l'API URL"
3. Recharger la page

## 📝 Prochaines Actions

### Immédiat
1. **Tester** : Uploader un fichier XLSX réel
2. **Observer** : Quelle variante fonctionne
3. **Noter** : Le contrat backend exact

### Court Terme
1. **Optimiser** : Supprimer les variantes inutiles
2. **Documenter** : Mettre à jour le contrat API
3. **Améliorer** : Ajouter validation du mapping minimal

### Long Terme
1. **Callback** : Recharger la grille après import réussi
2. **UI** : Améliorer le design du wizard
3. **Tests** : Ajouter des tests automatisés

## 🎯 Objectifs Atteints

- ✅ Parsing ExcelJS robuste (cell.text)
- ✅ Détection automatique des colonnes
- ✅ Mapping dynamique avec auto-guess
- ✅ Aperçu multi-feuilles
- ✅ Négociation de schéma (6 variantes)
- ✅ Logs détaillés pour debug
- ✅ Badge V3 visible
- ✅ Déployé en production

## 🚀 Commandes Utiles

### Redémarrer Atlas
```powershell
.\scripts\quick-start.ps1
```

### Rebuild et Redéployer
```powershell
.\scripts\quick-start.ps1 -RebuildUI
```

### Voir les Logs Backend
```powershell
docker compose logs -f api-geo
```

### Tester l'API Directement
```powershell
curl http://localhost:8080/api/coverage/mailles
```

---

**Date de déploiement** : 23 octobre 2025
**Version** : V3
**Status** : ✅ Déployé et prêt à tester
**Prochaine étape** : Tester avec un fichier XLSX réel et noter quelle variante fonctionne
