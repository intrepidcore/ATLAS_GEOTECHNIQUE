# Import Manuel des Données - Scripts SQL

## 📋 Vue d'ensemble

Ces scripts permettent d'importer manuellement les données de Granulométrie, Bleu de Méthylène (VBS) et Atterberg qui n'ont pas été importées automatiquement.

## 📁 Scripts disponibles

### 1. `import_granulometrie.sql`
**Sondages concernés:** 4 sondages
- GRANULO-PITIAH
- GRANULO-SANFATOULE
- GRANULO-AKIÉ
- GRANULO-WOMÉ-ZONGO

**Données:** Pourcentage de passant à 3 profondeurs (1m, 1.5m, 2m)
**Total:** 12 essais (4 sondages × 3 profondeurs)

### 2. `import_bleu.sql`
**Sondages concernés:** 1 sondage
- BLEU-KOVIÉ

**Données:** Valeur au Bleu de Méthylène (VBS) à 3 profondeurs
**Total:** 3 essais

### 3. `import_limite_atterberg.sql`
**Sondages concernés:** À déterminer (12 localités disponibles)
**Données:** WL, WP, IP à 3 profondeurs par localité
**Total potentiel:** 108 essais (12 localités × 3 profondeurs × 3 paramètres)

**Note:** Ce script est un template car les sondages correspondants n'existent pas encore dans la base.

## 🚀 Utilisation

### Méthode 1: Via Docker (Recommandé)

```powershell
# 1. Import Granulométrie
Get-Content scripts/import_granulometrie.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean

# 2. Import Bleu
Get-Content scripts/import_bleu.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean

# 3. Import Atterberg (si sondages créés)
Get-Content scripts/import_limite_atterberg.sql | docker exec -i atlas-db psql -U atlas -d atlas_clean
```

### Méthode 2: Via psql direct

```bash
# Si psql est dans le PATH
psql -h localhost -U atlas -d atlas_clean -f scripts/import_granulometrie.sql
psql -h localhost -U atlas -d atlas_clean -f scripts/import_bleu.sql
psql -h localhost -U atlas -d atlas_clean -f scripts/import_limite_atterberg.sql
```

### Méthode 3: Copier-coller dans pgAdmin

1. Ouvrir pgAdmin
2. Se connecter à la base `atlas_clean`
3. Ouvrir Query Tool
4. Copier le contenu du script
5. Exécuter

## ✅ Vérification après import

```sql
-- Vérifier les essais importés
SELECT 
    s.code,
    s.source,
    COUNT(e.id) as n_essais,
    STRING_AGG(DISTINCT e.type_essai, ', ') as types_essais
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.source IN ('Granulométrie', 'bleu')
GROUP BY s.code, s.source
ORDER BY s.source, s.code;
```

**Résultat attendu:**
```
code                | source        | n_essais | types_essais
--------------------+---------------+----------+------------------
GRANULO-AKIÉ        | Granulométrie |        3 | granulo_passant
GRANULO-PITIAH      | Granulométrie |        3 | granulo_passant
GRANULO-SANFATOULE  | Granulométrie |        3 | granulo_passant
GRANULO-WOMÉ-ZONGO  | Granulométrie |        3 | granulo_passant
BLEU-KOVIÉ          | bleu          |        3 | BleuMethylene_VBS
```

## 📊 Types d'essais

### Granulométrie
- **Type:** `granulo_passant`
- **Unité:** `%` (pourcentage)
- **Description:** Pourcentage de matériau passant au tamis

### Bleu de Méthylène
- **Type:** `BleuMethylene_VBS`
- **Unité:** `g/100g`
- **Description:** Valeur au Bleu de Méthylène
- **Classification:**
  - < 1.5: Faible
  - 1.5-2.5: Faible
  - 2.5-6: Moyen
  - 6-8: Forte
  - \> 8: Très forte

### Atterberg
- **Types:** `Atterberg_WL`, `Atterberg_WP`, `Atterberg_IP`
- **Unité:** `%`
- **Description:**
  - WL: Limite de Liquidité
  - WP: Limite de Plasticité
  - IP: Indice de Plasticité (WL - WP)
- **Classification selon WL:**
  - < 35: Faible
  - 35-50: Moyen
  - \> 50: Elevé

## 🔍 Dépannage

### Erreur: "sondage not found"
Le sondage n'existe pas dans la base. Vérifier avec:
```sql
SELECT id, code FROM sondages WHERE code LIKE '%PITIAH%';
```

### Erreur: "duplicate key"
Les essais ont déjà été importés. Vérifier avec:
```sql
SELECT COUNT(*) FROM essais WHERE sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH');
```

### Supprimer les essais importés (si besoin)
```sql
-- ATTENTION: Ceci supprime définitivement les essais!
DELETE FROM essais 
WHERE sondage_id IN (
    SELECT id FROM sondages WHERE source IN ('Granulométrie', 'bleu')
);
```

## 📝 Prochaines étapes

1. ✅ Exécuter `import_granulometrie.sql`
2. ✅ Exécuter `import_bleu.sql`
3. ⏳ Créer les sondages pour les données Atterberg
4. ⏳ Adapter et exécuter `import_limite_atterberg.sql`

## 🔗 Fichiers sources

Les données proviennent de:
- `data/xlsx_convert/Granulométrie/Granulométrie_translated.json`
- `data/xlsx_convert/bleu/bleu_translated.json`
- `data/xlsx_convert/limite/limite_translated.json`
