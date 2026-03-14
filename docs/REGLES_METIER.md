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

---

## Historique des révisions

- 2026-03-13 : ajout BM-07..BM-12 (missions/mailles étudiants + seed contract) et canonicalisation autour de `atlas.v_maille_status`.
- 2026-03-14 : ajout BM-13 (distinction intégrité référentielle vs validité géographique mission→maille).
