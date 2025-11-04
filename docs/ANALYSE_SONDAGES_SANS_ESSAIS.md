# Analyse: Sondages sans essais

## 📊 Statistiques globales

```sql
Total sondages: 123
Avec essais:    106 (86%)
Sans essais:    17 (14%)
```

## 🔍 Sondages sans essais (17)

### 1. GRANULO-* (4 sondages) - Créés le 2025-11-04 09:43
- GRANULO-PITIAH
- GRANULO-WOMÉ-ZONGO
- GRANULO-AKIÉ
- GRANULO-SANFATOULE
- **Source**: Granulométrie
- **Problème**: Aucun essai de type "granulo" dans toute la base!

### 2. BLEU-KOVIÉ (1 sondage) - Créé le 2025-11-04 05:23
- **Source**: bleu
- **Problème**: Import incomplet

### 3. ADOTE-* (3 sondages) - Créés le 2025-11-03 16:52
- ADOTE-OGARO
- ADOTE-BATBOUGOU
- ADOTE-NANOUSONGUE
- **Source**: ADOTE Adote emmanuel
- **Problème**: Import incomplet

### 4. GAMBAGA-INOUSSA-* (5 sondages) - Créés le 2025-11-03 16:20
- GAMBAGA-INOUSSA-2.57
- GAMBAGA-INOUSSA-2.51
- GAMBAGA-INOUSSA-2.63
- GAMBAGA-INOUSSA-2.39
- GAMBAGA-INOUSSA-2.47
- **Source**: GAMBAGA Inoussa
- **Problème**: Import incomplet
- **Note**: D'autres sondages GAMBAGA-INOUSSA ont des essais (ex: GAMBAGA-INOUSSA-KORBONGOU)

### 5. S-20251026-* (4 sondages) - Créés le 2025-10-26 17:55
- S-20251026-001
- S-20251026-002
- S-20251026-003
- S-20251026-004
- **Source**: NICABOU Ninsao Vianney
- **Problème**: Import incomplet

## 🧪 Types d'essais dans la base

```sql
type_essai           | n_essais
---------------------+----------
BleuMethylene_VBS    |      288
Atterberg_WP         |       94
Atterberg_WL         |       94
```

**❌ Aucun essai de type "granulo" dans la base!**

## 🎯 Cause racine

### Pour GRANULO-PITIAH et les 3 autres:

1. **L'import a créé les sondages** (métadonnées: code, source, date)
2. **Mais n'a PAS importé les essais de granulométrie**

### Causes possibles:

1. **Fichier source incomplet**:
   - Le fichier Excel ne contenait que les métadonnées
   - Pas de feuille "Granulo" ou feuille vide

2. **Import Wizard**:
   - L'import wizard n'a pas traité la feuille "Granulo"
   - Ou la feuille n'était pas mappée correctement

3. **Type d'essai non supporté**:
   - Le type "granulo" n'est peut-être pas géré par l'import
   - Seuls Atterberg et VBS sont importés

## ✅ Solution

### Option 1: Réimporter avec les essais
```bash
# Via l'Import Wizard
1. Ouvrir le modal Sondages
2. Onglet "Import Wizard"
3. Sélectionner le fichier source avec les essais de granulométrie
4. Mapper la feuille "Granulo" correctement
5. Importer
```

### Option 2: Créer les essais manuellement
```sql
-- Exemple pour GRANULO-PITIAH
INSERT INTO essais (sondage_id, type_essai, valeur_numerique, unit, depth_m)
VALUES 
  ('34111022-7dbc-430c-9bda-a544c3bf5877', 'granulo_passant_80um', 45.2, '%', 0.5),
  ('34111022-7dbc-430c-9bda-a544c3bf5877', 'granulo_passant_2mm', 78.5, '%', 0.5),
  -- etc.
;
```

### Option 3: Vérifier le fichier source
```bash
# Ouvrir le fichier Excel original
# Vérifier si la feuille "Granulo" existe et contient des données
# Si oui, réimporter
# Si non, demander le fichier complet
```

## 📝 Recommandations

1. **Ajouter une validation** dans l'Import Wizard:
   - Avertir si un sondage est créé sans essais
   - Afficher un résumé: "X sondages créés, Y essais importés"

2. **Ajouter un indicateur visuel** dans l'UI:
   - Badge "⚠️ Sans essais" pour les sondages sans données
   - Filtrer par "Avec essais" / "Sans essais"

3. **Documenter les types d'essais supportés**:
   - Atterberg (WL, WP, IP)
   - VBS (Bleu de Méthylène)
   - Granulo (passant 80µm, 2mm, 20mm, etc.)
   - Proctor
   - SPT, CPT, etc.

## 🔗 Liens utiles

- Script de diagnostic: `scripts/fix_essais_links.sql`
- Import Wizard: Modal Sondages → Onglet "Import"
- API essais: POST `/api/tests`
