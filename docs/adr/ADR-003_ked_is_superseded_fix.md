# ADR-003 — Fix is_superseded dans le script KED-Hiérarchique

- **Statut** : Accepté
- **Date** : 2026-06-08
- **Décideurs** : Équipe Atlas

---

## Contexte

Le script de production KED (`run_ked_vbs_ip_wl_wp_horizons.py`) **supprimait** (DELETE)
les valeurs précédentes avant chaque INSERT :

```python
cur.execute("DELETE FROM atlas.ai_interpolation_values WHERE parameter_id = %s", (param_id,))
```

Ce DELETE efface sans archiver : aucune trace des runs antérieurs dans la table
(traçabilité nulle). Tous les autres scripts du pipeline (RK, BLUP, dérivés)
implémentent le mécanisme correct : `UPDATE SET is_superseded=true` avant INSERT,
ce qui préserve l'historique complet pour audit et rollback.

### Impact mesuré avant correction (08-juin-2026)

| Paramètre | Valeurs actives (is_superseded=false) | Attendu (1 run actif) | Layers actifs simultanés |
|-----------|--------------------------------------|-----------------------|--------------------------|
| vbs_ked_h1 | 558 733 | ~29 407 | ~19 |
| ip_ked_h1  | ~520 000 | ~29 407 | ~18 |
| wl_ked_h1  | ~520 000 | ~29 407 | ~18 |
| wp_ked_h1  | ~530 000 | ~29 407 | ~18 |
| **Total DB** | **3 590 752** | **~160 000** | — |

Conséquence : une requête `WHERE is_superseded=false` sur les valeurs KED retourne
~19× plus de lignes qu'attendu. Les métriques LOO dans `ai_interpolation_runs` restent
correctes (elles référencent le `run_id` spécifique), mais toute requête sur les
**prédictions spatiales actives** retourne un résultat ambigu.

---

## Décision

Ajouter un `UPDATE … SET is_superseded=true` avant chaque INSERT dans
`run_ked_vbs_ip_wl_wp_horizons.py`, ciblant :
- le `parameter_id` courant
- `method = 'ked_hierarchical_5levels'`
- `is_superseded = false`

Pattern identique aux scripts RK (`atlas_regression_kriging_v2.py`, ligne ~340).

---

## Conséquences

- **Après le prochain run KED** : une seule couche active par paramètre/horizon.
- **Les 3,59M lignes actuellement actives** (is_superseded=false, KED) seront archivées
  lors du prochain run de chaque paramètre.
- **Aucun impact sur les métriques LOO** stockées dans `ai_interpolation_runs`.
- **Traçabilité complète rétablie** : cohérence avec ARCHITECTURE_PIPELINE_ML.md §132-141.

---

## Documentation connexe

- `ARCHITECTURE_PIPELINE_ML.md` lignes 89 et 132–141 : définition du mécanisme is_superseded
- ADR-002 : format seed dump (indépendant)
- `atlas_regression_kriging_v2.py` : implémentation de référence du pattern UPDATE→INSERT
