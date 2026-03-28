# Ressources SIG Atlas (Bloc B — traçabilité)

## Tables cibles (PostGIS, SRID 25231)

| Jeu | Table `atlas.*` | Script |
|-----|-----------------|--------|
| Unités géologiques | `unites_geologiques` | `scripts/import_resource_layers.py` |
| Unités pédologiques | `unites_pedologiques` | idem |
| Risque gonflement | `risque_gonflement` | idem (GPKG/SHP selon colonnes) |
| Hydrogéologie | `hydrogeologie` | idem (`ressource/Togo/Togo_HG.shp` si binaires présents) |

## Dossier `ressource/`

- Les métadonnées (`.prj`, `.cpg`, QML) peuvent être versionnées sans les binaires lourds (`.shp`, `.shx`, `.dbf`).
- **Recommandation long terme** : artefacts binaires dans un dépôt d’assets ou LFS + entrée dans le manifest seed (voir `CONTRAT_SEED_DUMP*.md`).

## Contexte par maille

Après import des couches, exécuter :

```sql
SELECT atlas.refresh_ai_context_features_maille();
```

Les features sont lues par `atlas.ai_context_features_maille` et par le pipeline supervisé (`supervised_rga_train_infer.py`, modèle `supervised_ml_gb_v2_context`).

## Vérifications rapides

```sql
SELECT COUNT(*) FROM atlas.unites_geologiques;
SELECT COUNT(*) FROM atlas.unites_pedologiques;
SELECT COUNT(*) FROM atlas.risque_gonflement;
SELECT COUNT(*) FROM atlas.hydrogeologie;
```
