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
