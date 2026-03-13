# ADR-001 — Source de vérité canonique du statut d’une maille

- **Statut** : Accepté
- **Date** : 2026-03-13
- **Décideurs** : Équipe Atlas

---

## Contexte

Le système Atlas manipule une grille de mailles (géométries) et des objets Colab (missions, assignations, étudiants).

Avant cette décision, le “statut d’une maille” (active / assignée / libre) était déduit de plusieurs sources possibles :

- `atlas.colab_mission_assignments` + `atlas.colab_missions.maille_id` (activité terrain via missions)
- `atlas.colab_maille_assignments` (attribution explicite maille → étudiant)
- des calculs ad hoc dans l’API/UI

Cette dispersion a produit des incohérences visibles, par exemple :

- “missions actives = 1” (correct) mais “mailles actives = 0” (faux)
- divergences de définitions entre pages et endpoints

---

## Décision

La vue SQL `atlas.v_maille_status` est **l’unique source de vérité** du statut d’une maille.

Règles principales :

- **Active** : la maille a au moins une mission active (via `colab_mission_assignments.unassigned_at IS NULL`).
- **Assigned** : la maille a une attribution explicite dans `colab_maille_assignments` (fonctionnalité possible même si table vide).
- **Free** : ni active ni assigned.

L’API doit lire la vue plutôt que recalculer la logique en Rust.

---

## Conséquences

- Les endpoints de couverture lisent `atlas.v_maille_status`.
- Les métriques “mailles actives” côté étudiants doivent être cohérentes avec la règle “mission active ⇒ maille active”.
- Toute évolution de la règle métier est centralisée : modification de la vue + mise à jour de `docs/REGLES_METIER.md`.

---

## Alternatives rejetées

- **Recalcul dans l’API** : duplication, drift, complexité.
- **Deux sources de vérité équivalentes** (missions vs assignments explicites) : divergence garantie.
- **Vue matérialisée** : complexité non justifiée à ce stade (refresh, invalidation).
