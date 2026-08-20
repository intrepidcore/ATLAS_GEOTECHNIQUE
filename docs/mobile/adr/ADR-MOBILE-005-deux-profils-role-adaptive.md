# ADR-MOBILE-005 — Deux profils (étudiant/superviseur) sans duplication de code
**Date : Août 2026**
**Statut : Accepté**
**Auteur : Serge TABE DJATO — intrepidcore**

---

## Contexte

L'app mobile sert deux profils métier distincts, déjà modélisés côté backend (`atlas.colab_students`, `atlas.colab_supervisors`, rôles applicatifs génériques `atlas.roles`/`user_roles`) : l'étudiant qui exécute le terrain (confirme des points, remplit des fiches), et le superviseur qui pilote (voit l'avancement de son équipe, pas d'écran de saisie terrain). Le porteur du produit demande une UI "logique et cohérente" adaptée aux deux, sans dire "fais deux apps".

## Décision

**Une seule base de code, un seul binaire, adaptation par rôle résolu au runtime depuis le profil serveur — jamais un `if (student)` dispersé dans chaque écran.**

- Nouvel endpoint `GET /colab/mobile/profile` renvoie le profil connecté enrichi : `role` (`student` | `supervisor` | les deux si applicable), `permissions` (liste de capacités, ex. `sondage.create`, `mission.team_overview`), et les infos de contact standard. Résolu côté serveur à partir des tables déjà existantes (`colab_students`/`colab_supervisors`/permissions RBAC) — jamais une liste de rôles codée en dur côté app.
- Côté app, un `RoleContext` (React Context) charge ce profil une fois après login, l'écrit en cache local (SQLite `app_settings`) pour fonctionner offline, et expose des hooks (`usePermission('sondage.create')`) consommés par les écrans et la navigation.
- La navigation (React Navigation, tabs) est **composée dynamiquement** à partir d'une déclaration de routes annotées par permission requise — pas deux arborescences de navigation dupliquées. Un superviseur voit un onglet "Équipe" que l'étudiant n'a pas ; l'étudiant voit "Nouveau sondage" que le superviseur (sans droit `sondage.create`) n'a pas. Le composant d'écran carte est partagé par les deux profils, seul le bouton d'action en bas change selon la permission.
- Aucun écran ne duplique de logique métier par rôle : la différence est uniquement "quels écrans/actions sont visibles", jamais "deux implémentations de la même fonctionnalité".

## Alternatives considérées

**Deux apps Expo distinctes (student-app / supervisor-app).** Rejeté : duplique la maintenance (deux pipelines CI, deux stores, deux versions à garder synchronisées) pour un besoin qui est en réalité un sous-ensemble d'écrans, pas un produit différent. Un même utilisateur peut aussi cumuler les deux rôles (ex. un encadrant qui va aussi sur le terrain) — deux apps rendrait ce cas impossible sans réinstaller.

**Rôle déterminé uniquement côté client (décodage du JWT, mapping en dur `role → écrans`).** Rejeté : duplique une logique de permission qui existe déjà côté backend (RBAC `atlas.roles`/`role_permissions`), créant deux sources de vérité vouées à diverger. Le endpoint `/colab/mobile/profile` centralise la résolution.

**Feature flags codés en dur par identifiant utilisateur.** Rejeté explicitement par consigne du porteur de produit ("les paramètres ne doivent pas être codés en dur") — toute variation de comportement par profil doit être pilotée par des données serveur avec valeur par défaut sensée, pas par des tests d'identité en dur dans le code.

## Conséquences

- Ajouter un nouveau profil (ex. "chef d'équipe" à mi-chemin) ne demande qu'une nouvelle permission côté backend + une entrée de navigation annotée, pas une nouvelle app.
- Le contrat `GET /colab/mobile/profile` devient une dépendance stable ; tout changement de shape doit être versionné avec prudence (les clients mobiles ne se mettent pas à jour aussi vite qu'un site web).

## Révision prévue

Si un profil "invité en lecture seule" (ex. bailleur de fonds consultant l'avancement) apparaît, vérifier que le modèle de permissions actuel le couvre sans étendre le schéma de rôles backend au-delà du nécessaire.
