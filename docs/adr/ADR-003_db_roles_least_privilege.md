# ADR-003 — Rôles PostgreSQL : least privilege (séparation runtime vs admin)

- **Statut** : Accepté
- **Date** : 2026-03-13
- **Décideurs** : Équipe Atlas

---

## Contexte

L’API runtime ne doit pas posséder des droits permettant de modifier des objets cœur (mailles, migrations, etc.).

Les endpoints “DB manager” (`/db/*`) ont besoin de droits plus élevés (inspection, exports, éventuellement DDL), mais ne doivent pas être exposés par défaut.

---

## Décision

- Le pool principal (`DATABASE_URL`) utilise un rôle runtime à privilèges minimaux (lecture/écriture limitée aux tables applicatives nécessaires).
- Les opérations admin utilisent un **pool séparé** (`DATABASE_URL_ADMIN`), activé uniquement si explicitement autorisé (`ENABLE_DB_MANAGER=true`).

---

## Conséquences

- Défense en profondeur : une vulnérabilité applicative sur l’API runtime ne donne pas automatiquement accès au DDL.
- Les permissions deviennent testables et auditées.
- Les routes `/db/*` doivent refuser proprement (503) si désactivées.

---

## Alternatives rejetées

- Un seul rôle “owner” partout : trop risqué.
- Donner des droits admin au runtime : dette sécurité immédiate.
- Exposer `/db/*` sans feature flag : risque d’exposition en production.
