## Pourquoi “toutes les migrations” et pas “à partir de la migration actuelle” ?

Tu as raison sur l’objectif: **on ne devrait pas rejouer depuis le début** si la DB restaurée par le seed est *déjà* au bon niveau. En pratique, il y a 2 modèles possibles, et votre Desktop est actuellement à cheval entre les deux.

---

# 1) Deux modèles de migrations

## Modèle A — “Migrations incrémentales depuis zéro” (classique)
- Sur une DB vide, on applique **toutes** les migrations dans l’ordre.
- Ça marche partout, mais c’est lent et inutile si tu as déjà un seed “complet”.

## Modèle B — “Seed = baseline + migrations seulement après baseline” (ce que tu veux)
- Le seed représente un état de DB **déjà migré** jusqu’à une version donnée (ex: `max_migration_applied = 137`).
- Donc sur fresh install:
  - on `pg_restore` le seed
  - puis on n’applique **que** les migrations **> 137**
- C’est la meilleure approche pour le Desktop.

---

# 2) Pourquoi aujourd’hui ça rejoue “tout” ?

Parce que pour appliquer “seulement les nouvelles migrations”, il faut une information fiable qui dit :

- **quelles migrations sont déjà appliquées dans la DB locale**

Il y a typiquement 2 façons de le savoir :

- **(1) Une table de tracking dans la DB** (ex: `atlas.schema_migrations` ou `atlas.flyway_schema_history`)
- **(2) Un “baseline version”** fourni par le seed (manifest/table `desktop_seed_state`) et utilisé pour pré-marquer les migrations comme “déjà appliquées”.

### Ce qui se passe dans votre code
Vous avez déjà un mécanisme `atlas.desktop_seed_state` (dans [postgres.rs](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas_reclone/apps/atlas-pro/src-tauri/src/postgres.rs:0:0-0:0)) qui stocke :
- `seed_sha256`
- `max_migration_applied`

Mais si, après restauration du seed, **la table de tracking des migrations** n’est pas peuplée (ou pas utilisée comme “source d’autorité”), le runner Desktop se retrouve dans la situation :
- “je ne sais pas ce qui est déjà appliqué”
- donc il rejoue depuis la première migration (ou tente de les rejouer / revalider)

Ce n’est pas un “choix produit”, c’est une **conséquence technique** du fait que le baseline n’est pas utilisé pour *skipper* proprement.

---

# 3) Donc oui: on peut (et on devrait) démarrer “à partir de la dernière migration du seed”

Ta proposition est exactement ce qu’il faut faire, mais avec une précision importante :

- Il ne faut pas “prendre la migration actuelle du repo” comme point de départ.
- Il faut prendre la migration **max déjà appliquée dans le seed** (baseline), par exemple:
  - `desktop_seed_state.max_migration_applied`
  - ou `manifest.max_migration_applied`

Ensuite:
- DB locale fraîche: restore seed + appliquer migrations `> baseline`
- Upgrade user: appliquer migrations `> db_current`

---

# 4) Concrètement, la solution robuste à implémenter

## Solution recommandée (baseline propre)
- Lors de la génération du seed:
  - écrire dans le manifest `max_migration_applied = N`
  - et/ou dans la DB seedée `atlas.desktop_seed_state.max_migration_applied = N`

- Lors du bootstrap Desktop après `pg_restore`:
  - soit **le seed contient déjà** la table `atlas.schema_migrations` avec les entrées jusqu’à N (idéal)
  - soit le Desktop **pré-remplit** `atlas.schema_migrations` jusqu’à `N` (baseline)
  - puis applique seulement les migrations **strictement > N**

Cela évite exactement le problème que tu vois (`search_path`, “sondages n’existe pas”, etc.), parce que ces migrations historiques ne seraient **même pas rejouées** si le seed est déjà au-delà.

---

## Pourquoi malgré tout on veut garder les anciens fichiers de migrations dans le bundle ?
- Pour:
  - reconstruire une DB from-scratch (dev/debug)
  - vérifier la cohérence (checksums)
  - permettre un fallback si seed absent/corrompu
- Mais **on ne doit pas forcément les exécuter** sur une DB seedée.

---

# Où ça nous mène pour Atlas Desktop

- **Ton intuition est correcte**: sur Desktop, avec seed versionné, la stratégie optimale est:
  - `seed restore` + “apply only pending migrations after seed baseline”.

- L’erreur que tu as eue (`004_add_survey_management`) révèle que **le système actuel rejoue/valide des migrations qui devraient être considérées déjà-appliquées**.

Si tu veux, je peux maintenant:
- te montrer dans [postgres.rs](cci:7://file:///c:/PROJET_ATLAS_MASTER/atlas_reclone/apps/atlas-pro/src-tauri/src/postgres.rs:0:0-0:0) l’endroit exact où il choisit la liste des migrations à appliquer,
- et modifier le runner pour qu’il **baseline** à partir de `desktop_seed_state.max_migration_applied` / manifest et n’applique que les migrations supérieures.

Dis-moi juste ce que tu veux comme “source d’autorité” :
- **Option 1**: `atlas.desktop_seed_state` dans la DB seedée
- **Option 2**: le manifest JSON du seed (`max_migration_applied`)
- **Option 3**: les deux (avec validation croisée)