# Auto-géocodage des sondages

## Principe

Chaque sondage avec une géométrie (`geom`) est automatiquement géocodé via un **trigger PostgreSQL**. Le géocodage remplit :

| Champ | Source | Description |
|-------|--------|-------------|
| `maille_code` | `public.mailles` | Code de la maille géotechnique (SRID 25231) |
| `adm1_name` | `atlas.adm1_tg` | Région (niveau 1) |
| `adm2_name` | `atlas.adm3_tg.adm2_name` | Préfecture (niveau 2) |
| `adm3_id` | `atlas.adm3_tg` | ID du canton (niveau 3) |
| `adm3_name` | `atlas.adm3_tg` | Nom du canton |

## Fonctionnement

### Trigger automatique

Le trigger `trg_sondage_geocode` s'exécute automatiquement :
- **AFTER INSERT** : tout nouveau sondage avec géométrie
- **AFTER UPDATE OF geom** : si la géométrie change

```sql
-- Le trigger appelle cette fonction
SELECT atlas.geocode_sondage(NEW.id);
```

### Fonction de géocodage

```sql
-- Géocoder un sondage spécifique
SELECT atlas.geocode_sondage('uuid-du-sondage');
```

La fonction :
1. Récupère la géométrie du sondage (SRID 4326)
2. Transforme en SRID 25231 pour les mailles
3. Trouve la maille par `ST_Contains`
4. Trouve ADM3/ADM2/ADM1 par `ST_Contains`
5. Met à jour le sondage

## Rattrapage manuel

Pour géocoder tous les sondages non géocodés :

```sql
-- Géocoder tous les sondages avec géométrie mais sans maille
SELECT atlas.geocode_sondage(id) 
FROM atlas.sondages 
WHERE geom IS NOT NULL 
  AND deleted_at IS NULL 
  AND maille_code IS NULL;
```

Pour forcer le re-géocodage de tous les sondages :

```sql
-- Re-géocoder tous les sondages avec géométrie
SELECT atlas.geocode_sondage(id) 
FROM atlas.sondages 
WHERE geom IS NOT NULL 
  AND deleted_at IS NULL;
```

## Fichiers

| Fichier | Description |
|---------|-------------|
| `sql/functions/geocode_sondage.sql` | Fonction + trigger |

## SRID

- `atlas.sondages.geom` : **4326** (WGS84)
- `public.mailles.geom` : **25231** (UTM 31N Togo)
- `atlas.adm*_tg.geom` : **4326** (WGS84)

La fonction gère automatiquement la transformation de coordonnées.

## Statistiques actuelles

```sql
SELECT 
    COUNT(*) as total,
    COUNT(CASE WHEN geom IS NOT NULL THEN 1 END) as avec_geom,
    COUNT(CASE WHEN maille_code IS NOT NULL THEN 1 END) as avec_maille,
    COUNT(CASE WHEN adm3_id IS NOT NULL THEN 1 END) as avec_adm3
FROM atlas.sondages 
WHERE deleted_at IS NULL;
```
