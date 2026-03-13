# ADR-004 — Immutabilité du code maille (`atlas.mailles.code`)

- **Statut** : Accepté
- **Date** : 2026-03-13
- **Décideurs** : Équipe Atlas

---

## Contexte

Le code maille est référencé :

- dans des exports
- dans des URLs / filtres UI
- dans des logs
- parfois dans des fichiers externes (Excel, rapports)

Un changement de code après création casse la traçabilité et rend les audits impossibles.

---

## Décision

- `atlas.mailles.code` est **immuable** après création.
- La contrainte est appliquée par **trigger/contrainte DB** + **permissions** (rôles runtime en SELECT only sur `atlas.mailles`).

---

## Conséquences

- Les remappings legacy → nouveau doivent être modélisés via une table/vues de lookup, pas par update du code.
- Les migrations qui refondent une grille doivent créer un mapping (audit) plutôt que modifier silencieusement les codes.

---

## Alternatives rejetées

- Autoriser l’update du code : casse l’historique.
- Corriger “au cas par cas” dans l’UI : dette permanente.
- Maintenir plusieurs codes sans mapping officiel : incohérences garanties.
