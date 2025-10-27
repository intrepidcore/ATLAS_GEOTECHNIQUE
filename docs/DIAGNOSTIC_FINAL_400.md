# 🔴 Diagnostic Final - Erreurs 400 en Boucle

## 📊 Résumé des Tests

### Tests Effectués avec curl
| Test | Structure JSON | Résultat |
|------|----------------|----------|
| 1 | `{format, structure: {sheets, mapping}}` | ❌ `missing field 'mapping'` |
| 2 | `{format, structure: {sheets}, mapping}` | ❌ `missing field 'structure'` |
| 3 | `{structure: {sheets, mapping}, options}` | ❌ `missing field 'format'` |
| 4 | `{format: 'xlsx_geotech', ...}` | ❌ `unknown variant` |
| 5 | `{format: 'xlsx', structure: {sheets, mapping}}` | ❌ `missing field 'mapping'` |
| 6 | `{format: 'xlsx', structure: {sheets}, mapping}` | ❌ `missing field 'structure'` |

## 🔍 Analyse

### Problème Racine
Le contrat backend est **ambigu** ou **incohérent**. Les erreurs alternent :
- Quand `mapping` est dans `structure` → `missing field 'mapping'` (attend à la racine)
- Quand `mapping` est à la racine → `missing field 'structure'` (attend dans structure)

### Corrections Appliquées Côté Frontend
1. ✅ **Extraction des en-têtes** avec `extractHeaders()` utilisant `cell.text`
2. ✅ **FormData correct** avec fichier + config JSON
3. ✅ **Format enum** changé de `xlsx_geotech` à `xlsx`
4. ❌ **Structure JSON** : impossible de trouver la bonne combinaison

## 🎯 Solutions Possibles

### Option 1 : Clarifier le Contrat Backend
Le backend doit documenter **exactement** la structure attendue :
```rust
// Exemple de structure Rust attendue
#[derive(Deserialize)]
struct ImportConfig {
    format: ImportFormat,  // csv | xlsx | json
    structure: Structure,  // {sheets: {...}}
    mapping: Mapping,      // {sondages: {...}, ...}
    options: Options,      // {refresh_mv: bool}
}
```

### Option 2 : Réécriture Wizard v3 (Recommandé)
Repartir sur une base propre avec :
- Contrat backend clairement documenté et testé
- Types TypeScript stricts correspondant au backend
- Tests unitaires pour la construction du payload
- Validation côté frontend avant envoi

## 📝 Recommandations

### Immédiat
1. **Documenter le contrat backend** dans un fichier `API_CONTRACT.md`
2. **Ajouter un endpoint de test** `/api/import/validate-config` qui retourne la structure attendue
3. **Logger côté backend** la structure reçue pour debug

### Court Terme
1. **Réécrire le wizard v3** avec architecture claire
2. **Tests end-to-end** automatisés
3. **Documentation utilisateur** avec exemples de fichiers

## 🔧 Contrat Proposé (À Valider)

```json
{
  "format": "xlsx",
  "structure": {
    "sheets": {
      "sondages": "sondages",
      ...
    }
  },
  "mapping": {
    "sondages": {
      "code": "code_site",
      ...
    },
    ...
  },
  "options": {
    "refresh_mv": true
  }
}
```

**OU**

```json
{
  "format": "xlsx",
  "structure": {
    "sheets": {...},
    "mapping": {...}
  },
  "options": {...}
}
```

**Le backend DOIT choisir UNE structure et s'y tenir !**

## ✅ Ce Qui Fonctionne

1. ✅ Détection XLSX et chargement ExcelJS
2. ✅ Extraction des en-têtes (console montre les colonnes)
3. ✅ FormData multipart correctement formé
4. ✅ Fichier XLSX envoyé au backend
5. ❌ Structure JSON du config → **BLOQUANT**

## 🚀 Prochaines Étapes

1. **Vérifier les logs backend** pour voir exactement ce qui est reçu
2. **Documenter le contrat** dans le code Rust
3. **Tester avec Postman/Insomnia** pour isoler le problème
4. **Décider** : corriger le backend OU adapter le frontend

---

**Conclusion :** Le wizard frontend est fonctionnel jusqu'à l'envoi. Le blocage est au niveau du **contrat d'API non clarifié**.
