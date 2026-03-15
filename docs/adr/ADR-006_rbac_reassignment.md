---
description: ADR-006 — RBAC réattribution missions/mailles (unassign/reassign) + double barrière UI/API + audit trail
---

# ADR-006 — RBAC réattribution missions/mailles (unassign/reassign)

## 1) Statut

- **Statut** : Accepté
- **Date** : 2026-03-14

## 2) Contexte

La réattribution (désassigner une mission de sa maille, ou réassigner une mission vers une autre maille) est une opération :

- **critique métier** (impact direct sur qui travaille où)
- **sensible** (risque d’abus / erreurs / litiges terrain)
- **irréversible** au sens opérationnel (une fois une maille libérée et une mission soft-deleted, l’état effectif change).

L’UI ne doit jamais être considérée comme une barrière de sécurité. Toute action doit être validée côté serveur.

## 3) Décision

### 3.1. Principe

- **Les actions `unassign` et `reassign` sont restreintes** aux profils coordinateur/admin.
- L’UI n’affiche ces contrôles que si l’utilisateur dispose des permissions.
- L’API vérifie systématiquement les permissions et trace l’action.

### 3.2. Rôles et permissions

- Permissions introduites :
  - `colab.missions.reassign`
  - `colab.missions.unassign`
  - `colab.missions.manage`
  - `colab.mailles.view_active`

- Rôle `coordinator` (système) :
  - `colab.missions.reassign`
  - `colab.missions.unassign`
  - `colab.missions.manage`
  - `colab.mailles.view_active`

- Rôle `admin` :
  - reçoit toutes les permissions `colab.missions.*` et `colab.mailles.*`.

- Rôles `student`, `viewer`, `editor` :
  - reçoivent `colab.mailles.view_active`.

## 4) Motivation

- **Sécurité** : empêcher un opérateur de modifier ses propres attributions.
- **Traçabilité** : pouvoir répondre à « qui a réattribué quoi, quand et pourquoi ».
- **Zéro dette** : règles explicites (BM-18..BM-20) + migration idempotente + endpoints protégés.

## 5) Implémentation (références)

- **Migration** : `db/migrations/133_rbac_reassignment_permissions.sql`
- **API permission check** : `services/api-geo/src/auth/middleware.rs` (`require_permission_db`)
- **API endpoints** : `services/api-geo/src/colab/routes.rs`
  - `DELETE /colab/missions/:id/maille`
  - `POST /colab/missions/:id/reassign`
  - `GET /colab/mailles/:id/missions`
- **Audit log** : `services/api-geo/src/auth/types.rs` (`AuthEventType::MissionUnassign`, `MissionReassign`)
- **UI hook** : `ui/src/hooks/use-permissions.ts`
- **UI gating** :
  - `ui/src/pages/colab/mission-detail-modal.tsx`
  - `ui/src/main.ts` (menu contextuel carte)

## 6) Conséquences

- Un token JWT ancien (émis avant migration RBAC) ne doit pas bloquer à tort un coordinateur :
  - les endpoints sensibles s’appuient sur la **vérification DB**.
- Toute action sensible génère une ligne `atlas.auth_audit_log`.

## 7) Alternatives considérées

- **Admin only** : rejeté car opérationnellement le coordinateur doit pouvoir gérer les missions terrain.
- **UI only** : rejeté (non sécurisé).
- **JWT-only** : rejeté (tokens anciens / permissions non à jour).
