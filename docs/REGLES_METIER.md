# Atlas Géotechnique – Règles métier (canon)

Ce document définit les règles métier **canon** (langage naturel) et leurs identifiants.
Les implémentations doivent référencer ces IDs.

## BM-01 — Statut "active" d’une maille

Une maille est **active** si elle a au moins **une mission active**.

Définition DB : une mission est active si `atlas.colab_mission_assignments.unassigned_at IS NULL`.

## BM-02 — Statut "assigned" (attribution explicite)

Une maille est **assigned** si elle est attribuée explicitement via `atlas.colab_maille_assignments`.

Note : cette table peut être vide (fonctionnalité de planification / réservation administrative).

## BM-03 — Mission "active"

Une mission est **active** si l’affectation étudiant↔mission est active :
`atlas.colab_mission_assignments.unassigned_at IS NULL`.

## BM-04 — Code maille immuable

`atlas.mailles.code` est immuable après création (trigger/contrainte côté DB).

## BM-05 — spatial_id

`atlas.mailles.spatial_id` est dérivé d’un géohash et stabilisé (fallback déterministe) pour éviter collisions.

## BM-06 — Remapping legacy → nouveau code

Le remapping legacy utilise une logique d’intersection géométrique (coverage %) avec fallback si nécessaire.

## BM-07 — Mailles actives d’un étudiant

Une “maille active” pour un étudiant signifie :

- l’étudiant a au moins une **mission active**
- et cette mission pointe vers une maille (`colab_missions.maille_id IS NOT NULL`)

Définition canonique (métrique) :

- `active_mailles = COUNT(DISTINCT colab_missions.maille_id)`
- restreint aux assignations actives : `colab_mission_assignments.unassigned_at IS NULL`

## BM-08 — Cohérence missions ↔ mailles

Une mission active doit pointer vers une maille (sauf cas explicitement documenté). En pratique :

- `colab_missions.deleted_at IS NULL`
- `colab_missions.maille_id IS NOT NULL` pour les missions opérationnelles

Si une mission est active mais sans maille, c’est un bug de données à corriger par audit/migration.

## BM-09 — Statut canonique d’une maille

Le statut d’une maille est défini par la vue canonique :

- `atlas.v_maille_status`

L’API/UI ne doit pas recalculer ce statut localement.

## BM-10 — Seed dump Desktop : format canonique

Le seed dump Desktop est au format `pg_dump -Fc` et restauré via `pg_restore`.

## BM-11 — Seed dump Desktop : intégrité

Chaque seed dump Desktop doit être accompagné d’un manifest contenant un hash (SHA256 minimum).
Le restore doit vérifier le hash avant d’appliquer le dump.

## BM-12 — Seed dump Desktop : non-destruction implicite

Le Desktop ne doit jamais écraser une base utilisateur existante implicitement.
Un restore “forcé” est un mode dev explicite (ex: `ATLAS_FORCE_SEED_RESTORE=1`).

## BM-13 — Validité géographique d’un rattachement mission → maille

Un rattachement `colab_missions.maille_id` est considéré **correct** si et seulement si :

1) Il respecte les règles d’intégrité (voir BM-08)
2) Il est **cohérent géographiquement** vis-à-vis d’une source de référence (géométrie de la maille legacy correspondante, ou bbox/coordonnées terrain)

Note :

- Un audit de type “FK non rompue / `maille_id` non NULL” ne prouve **pas** la validité géographique.
- La validité géographique nécessite une source de vérité spatiale (ex: table legacy `public.mailles_legacy_*` ou bounding boxes importées) et une vérification par intersection/containment.

## BM-14 — Précision géographique du rattachement par commune (ADM3) → centroïde → maille V2

Quand une mission est rattachée à une maille V2 via :

- `colab_missions.commune` → `public.adm3.adm3_fr`
- puis `ST_Transform(ST_Centroid(adm3.geom), 25231)`
- puis `ST_Contains(atlas.mailles.geom, point)`

alors la précision géographique est celle de la **commune (ADM3)** (ordre de grandeur km), pas celle d’une maille 2 km.

Conséquence : plusieurs missions appartenant à la même commune peuvent pointer vers la même maille V2.
Ce rattachement est acceptable comme **fallback** (données terrain insuffisantes) mais ne remplace pas un rattachement basé sur une géométrie legacy, un code maille fiable ou des coordonnées terrain.

## BM-SYNC-01 — Offline-first : la base locale est source de vérité opérationnelle

L’application Desktop fonctionne en mode **offline-first** : la base PostgreSQL locale est la source de vérité pour l’exécution (UI + API embarquée).

- Un check d’update ou de sync ne doit jamais bloquer l’application en démarrage (best-effort).
- Les erreurs réseau ne doivent jamais corrompre l’état local.

## BM-SYNC-02 — Non-destruction implicite (sync/update)

Une opération d’update ou de sync ne doit jamais écraser ou supprimer des données utilisateur implicitement.

- Toute action destructrice doit être un mode explicite (opt-in) et tracée.
- Les migrations DB doivent être transactionnelles et réversibles (via backup/restore) lorsque possible.

## BM-SYNC-03 — Traçabilité des checks et des syncs

Chaque check d’update et chaque opération de sync doit être tracé en base.

- `atlas.update_check_log` : historique des checks, compat schéma, erreurs, url.
- `atlas.sync_state` : état machine des opérations (type, direction, status, erreurs).

## BM-SYNC-04 — Compatibilité schéma avant update/apply

Avant d’appliquer un update (ou un bundle de sync), l’application doit vérifier la compatibilité de schéma.

- Un update peut exiger une version minimale de schéma (`min_schema_required`).
- Si la base locale est en dessous, l’update est refusée (grâce à un message explicite) et l’événement est tracé.

## BM-SYNC-05 — Idempotence et reprise après incident

Les opérations de sync/update doivent être **idempotentes** et reprendre proprement après crash.

- Un même bundle ne doit pas être appliqué deux fois (hash/version/bundle_id).
- Les états `pending/running/success/failed/skipped` permettent de diagnostiquer et relancer.

## BM-18 — Accès à la réattribution

La réattribution (désassigner/réassigner une maille, supprimer des missions dans le cadre du workflow réattribution) est une opération critique.

- Seuls les utilisateurs disposant du rôle `admin` ou `coordinator` peuvent exécuter ces actions.
- Un opérateur terrain (`student`) peut uniquement consulter ses propres missions.

Décision RBAC : ces actions sont contrôlées via permissions dédiées (`colab.missions.unassign`, `colab.missions.reassign`, `colab.missions.manage`).

## BM-19 — Visibilité UI conditionnelle

Les contrôles UI de réattribution (boutons dans Colab, menu contextuel carte, écrans d'édition) ne sont rendus que si l'utilisateur courant dispose des permissions nécessaires.

- Exemple : le menu de désassignation doit être masqué si `colab.missions.unassign` n'est pas présent.

Note : ce gating est une aide UX, pas une barrière de sécurité.

## BM-20 — Protection API et traçabilité

Les endpoints sensibles doivent être protégés côté serveur **indépendamment** de l'UI.

- `DELETE /api/colab/missions/:id/maille` exige `colab.missions.unassign`
- `POST /api/colab/missions/:id/reassign` exige `colab.missions.reassign`
- `GET /api/colab/mailles/:id/missions` exige `colab.mailles.view_active` et, si l'utilisateur est `student`, la liste est filtrée à ses missions.

Toute action sensible de réattribution doit être tracée dans `atlas.auth_audit_log` avec un `details` JSON.

---

## Historique des révisions

- 2026-03-13 : ajout BM-07..BM-12 (missions/mailles étudiants + seed contract) et canonicalisation autour de `atlas.v_maille_status`.
- 2026-03-14 : ajout BM-13 (distinction intégrité référentielle vs validité géographique mission→maille).
- 2026-03-14 : ajout BM-18..BM-20 (RBAC réattribution + gating UI + protection API + audit trail).
