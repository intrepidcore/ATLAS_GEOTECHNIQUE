---
description: SDD — Réattribution des mailles (missions Colab) + Vault Markdown en base
---

# SDD — Réattribution des mailles opérateurs + Vault des docs Markdown

## 1) Contexte

Deux problèmes opérationnels ont été identifiés :

1) Des rattachements mission → maille peuvent être **géographiquement imprécis** (fallback ADM3 centroïde) et doivent pouvoir être **corrigés** avec des informations terrain plus précises (coordonnées GPS).
2) Les décisions (ADR / règles métier / audits / sessions) sont critiques et doivent rester **retrouvables** même si l’accès Git n’est pas disponible.

Ce SDD spécifie une feature multi-couches (DB + API + UI + scripts) avec **traçabilité** et sans dette technique.

## 2) Objectifs

- Permettre à un coordinateur de :
  - désassigner une mission d’une maille (conserver l’historique)
  - réassigner une mission vers une autre maille (par sélection carte / code / résolution coordonnée)
- Maintenir un historique complet (audit) : aucune perte d’information.
- Importer les documents Markdown (`docs/**/*.md`) dans une table `atlas.docs_vault` avec un contrat d’intégrité (sha256).

## 3) Non-objectifs

- Reconstruire géométriquement la grille provisoire TG-00xx sans preuve externe (cf audit).
- Implémenter une modélisation “multi-opérateurs sur une même mission” ; on reste compatible avec le modèle actuel (missions + assignations).

## 4) Règles métier

### BM-15 — Désassignation de maille

Désassigner une maille d’une mission :

- La mission **reste** dans la base (historique conservé)
- On conserve la trace de l’ancienne maille :
  - `colab_missions.ex_maille_code` = `atlas.mailles.code` au moment de l’opération
- On rend la mission inactive opérationnellement :
  - `colab_missions.deleted_at = NOW()` (soft delete)

Conséquence : les triggers existants (unassign + sync maille assignments) libèrent la maille.

### BM-16 — Unicité mission active par opérateur par maille

Un opérateur (étudiant) ne doit pas avoir deux missions actives sur la même maille à un instant T.

Décision d’implémentation :

- Contrôle en **API transactionnelle** (pré-check) pour éviter d’introduire une contrainte DB qui pourrait casser des données existantes.

### BM-17 — Traçabilité de réattribution

Toute réattribution crée une **nouvelle mission** et référence l’ancienne via :

- `colab_missions.reassigned_from` (UUID vers `colab_missions.id`)

L’ancienne mission est soft-deleted (BM-15).

### BM-18 — Accès à la réattribution

La réattribution (désassigner / réassigner) est une opération critique.

- Seuls les profils `admin` et `coordinator` sont autorisés.
- Un `student` ne doit pas pouvoir modifier ses propres attributions.

La règle est implémentée via RBAC (permissions dédiées).

### BM-19 — Visibilité UI conditionnelle

L’UI n’affiche les contrôles de réattribution que si l’utilisateur courant a la permission correspondante.

Objectif : UX cohérente (ne pas afficher des actions qui vont 403).

### BM-20 — Protection API

Les endpoints sensibles doivent vérifier les permissions côté serveur (l’UI n’est pas une barrière de sécurité).
Les actions sensibles doivent être tracées dans `atlas.auth_audit_log`.

## 5) Contrat DB

### DB-131 — Support réattribution

- Ajout colonnes sur `atlas.colab_missions` :
  - `ex_maille_code TEXT` (trace de la maille au moment de la désassignation)
  - `reassigned_from UUID REFERENCES atlas.colab_missions(id)`
- Vue d’historique : `atlas.v_operator_mission_history`

Contraintes :

- Migrations **idempotentes** (`IF NOT EXISTS`).
- Pas de breaking change sur les triggers existants.

### DB-132 — Vault documents

- Table `atlas.docs_vault` :
  - `path` (unique, chemin relatif repo)
  - `content`
  - `sha256` (hex)
  - `size_bytes`
  - `doc_type` (adr/audit/session/regles/roadmap/doc)
  - `git_commit`, `git_branch`
  - timestamps
- Index :
  - GIN full-text (`to_tsvector('french', content)`)
  - index sur `doc_type`
- Fonction `atlas.verify_docs_vault()` : recalcule sha256 et compare.

## 6) Contrat API

### DELETE `/api/colab/missions/:id/maille`

- But : désassigner la maille d’une mission avec historique.
- Comportement :
  - Récupère `mailles.code` courant si `maille_id` non NULL et le place dans `ex_maille_code`
  - Met `deleted_at = NOW()` (soft delete)
  - Idempotent : si déjà deleted, retourne NO_CONTENT

RBAC :

- Permission requise : `colab.missions.unassign`
- Audit : création d’un event `mission_unassign` dans `atlas.auth_audit_log`

### POST `/api/colab/missions/:id/reassign`

- Input :
  - `new_maille_id: UUID`
  - `student_id: UUID` (colab_students.id)
- Comportement :
  - Applique BM-16 (pas de doublon actif sur la maille)
  - Soft-delete mission source (BM-15)
  - Crée une nouvelle mission sur `new_maille_id`, `reassigned_from = old_id`
  - Crée l’assignation mission → student

RBAC :

- Permission requise : `colab.missions.reassign`
- Audit : création d’un event `mission_reassign` dans `atlas.auth_audit_log`

### GET `/api/colab/mailles/:maille_id/missions`

- Retourne la liste des missions actives sur une maille.
- Usage : panneau latéral carte / menu contextuel.

RBAC :

- Permission requise : `colab.mailles.view_active`
- Si l’utilisateur courant a le rôle `student`, la liste est filtrée à ses missions (BM-18).

## 6bis) Contrat RBAC (DB)

### Migration 133 — permissions et rôle coordinator

Fichier :

- `db/migrations/133_rbac_reassignment_permissions.sql`

Permissions :

- `colab.missions.reassign`
- `colab.missions.unassign`
- `colab.missions.manage`
- `colab.mailles.view_active`

Rôles :

- `admin` : toutes permissions `colab.missions.*` + `colab.mailles.*`
- `coordinator` : permissions de gestion/réattribution
- `student/viewer/editor` : `colab.mailles.view_active` uniquement

## 7) Contrat UI

### UI-CARTE — menu contextuel (clic droit) sur une maille

- Sur couche `/coverage/mailles`.
- Actions selon état :
  - Maille libre : “Créer une mission sur cette maille”
  - Maille occupée :
    - “Voir missions actives”
    - “Désassigner”
    - “Réassigner…”

### UI-COLAB — actions mission

- Sur mission active :
  - bouton “Désassigner maille”
  - bouton “Réassigner”
- Mode audit :
  - possibilité d’afficher historique (missions soft-deleted) et `ex_maille_code`.

## 8) Scripts

### DOCS-IMPORT

- Script `scripts/import-docs-to-vault.ps1`
  - Import idempotent (skip si sha identique)
  - `-VerifyOnly` pour vérifier intégrité en DB

## 9) Critères d’acceptation

- DB :
  - migrations 131/132 appliquées sans erreur
  - `atlas.verify_docs_vault()` renvoie uniquement OK après import
- API :
  - désassignation d’une mission libère la maille (sync existant)
  - réassignation crée une nouvelle mission + historique intact
  - un `student` reçoit 403 sur unassign/reassign et ne voit que ses missions sur GET maille missions
- UI :
  - menu contextuel sur maille permet l’opération sans rechargement complet
  - les boutons de réattribution ne sont visibles que pour `admin/coordinator`
- Qualité :
  - pas de rupture des flows existants (missions list/get/create/delete)
  - logs et erreurs API explicites
