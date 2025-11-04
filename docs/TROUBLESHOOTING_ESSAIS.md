# Troubleshooting: Sondages avec 0 essais

## Problème

Certains sondages affichent **0 essais** dans l'interface malgré l'import de données.

**Exemple**: `GRANULO-PITIAH` affiche:
```json
{
  "atterberg": 0,
  "granulo": 0,
  "proctor": 0,
  "vbs": 0,
  "n_essais": 0
}
```

## Cause

Les essais ont été importés mais **ne sont pas liés au sondage** via `sondage_id`.

Le comptage `n_essais` est calculé dynamiquement:
```sql
(SELECT COUNT(*) FROM essais WHERE sondage_id = sondages.id AND deleted_at IS NULL) as n_essais
```

Si `sondage_id` est `NULL` ou incorrect, le comptage retourne 0.

## Diagnostic

### 1. Vérifier les essais orphelins

```sql
SELECT COUNT(*) 
FROM essais 
WHERE sondage_id IS NULL AND deleted_at IS NULL;
```

### 2. Vérifier un sondage spécifique

```sql
SELECT 
    s.id,
    s.code,
    COUNT(e.id) as n_essais_lies
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
WHERE s.code = 'GRANULO-PITIAH'
GROUP BY s.id, s.code;
```

### 3. Chercher les essais avec code similaire

```sql
SELECT 
    e.id,
    e.type_essai,
    e.code_sondage,
    e.sondage_id
FROM essais e
WHERE e.code_sondage LIKE '%PITIAH%'
LIMIT 10;
```

## Solution

### Option 1: Script automatique (recommandé)

```bash
cd scripts
python fix_essais_links.py
```

Ce script:
1. Trouve tous les essais orphelins (`sondage_id IS NULL`)
2. Cherche les correspondances par code exact
3. Si pas de correspondance exacte, utilise la similarité (pg_trgm)
4. Demande confirmation
5. Met à jour les liens

### Option 2: SQL manuel

```sql
-- Lier les essais par code exact
UPDATE essais e
SET sondage_id = s.id
FROM sondages s
WHERE e.sondage_id IS NULL
  AND e.deleted_at IS NULL
  AND s.deleted_at IS NULL
  AND UPPER(TRIM(e.code_sondage)) = UPPER(TRIM(s.code));
```

### Option 3: Cas par cas

```sql
-- Pour GRANULO-PITIAH spécifiquement
UPDATE essais
SET sondage_id = (SELECT id FROM sondages WHERE code = 'GRANULO-PITIAH')
WHERE code_sondage LIKE '%PITIAH%'
  AND sondage_id IS NULL;
```

## Prévention

### 1. Lors de l'import

Assurer que l'import wizard:
- Crée d'abord le sondage
- Récupère le `sondage_id`
- L'assigne à tous les essais

### 2. Validation

Ajouter une contrainte:
```sql
ALTER TABLE essais 
ADD CONSTRAINT essais_must_have_sondage 
CHECK (sondage_id IS NOT NULL);
```

⚠️ **Attention**: Cette contrainte empêchera l'import d'essais orphelins. À appliquer après avoir corrigé les données existantes.

## Vérification post-correction

```sql
-- Compter les essais par sondage
SELECT 
    s.code,
    COUNT(e.id) as n_essais,
    COUNT(DISTINCT e.type_essai) as n_types
FROM sondages s
LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
GROUP BY s.code
ORDER BY n_essais DESC
LIMIT 20;
```

## Suggestions ADM

Si vous avez seulement 6-7 suggestions au lieu de plus:

### Causes possibles:

1. **Suggestions déjà traitées**: Les suggestions acceptées/rejetées ne s'affichent plus par défaut
2. **Filtre actif**: Vérifier le filtre "En attente" / "Toutes"
3. **Sondages déjà géocodés**: Les sondages avec `is_geocoded=true` ne génèrent pas de suggestions

### Vérification:

```sql
-- Compter toutes les suggestions
SELECT status, COUNT(*) 
FROM geocoding_suggestions 
GROUP BY status;

-- Compter les sondages non géocodés
SELECT COUNT(*) 
FROM sondages 
WHERE (lat IS NULL OR lon IS NULL) 
  AND deleted_at IS NULL;
```

### Regénérer les suggestions:

```bash
# Appeler l'API de génération
curl -X POST http://localhost:3000/api/suggestions/generate
```

Ou via l'interface: Onglet "Suggestions ADM" → Bouton "Regénérer"
