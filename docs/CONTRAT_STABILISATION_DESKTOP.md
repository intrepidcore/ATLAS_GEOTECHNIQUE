# Contrat de stabilisation Desktop (MSI / Startup / DB)

Ce document définit **les règles non négociables** pour éviter toute dette technique sur le Desktop Tauri (MSI), son démarrage, et la couche base de données.

**Objectif** : un Desktop installable via MSI qui démarre de manière **observable** et **déterministe**, avec une base locale cohérente (seed + migrations) et des tests automatisés.

---

## Portée

- Desktop : `apps/atlas-pro/src-tauri/`
- DB migrations : `db/migrations/` (et `migrations/` si présent)
- Seed & cohérence : `atlas.desktop_seed_state` + `atlas.schema_migrations`
- Validation migrations : `scripts/validate_migrations.py`
- Outils Windows dev : `scripts/dev/Stop-AtlasProcesses.ps1`
- Smoke-test : mode `ATLAS_SMOKE_TEST=1`
- CI MSI : `.github/workflows/msi-test.yml` + `scripts/test-msi-install.ps1`

---

# Problème 1 — Migrations non idempotentes (DB-01)

## Cause racine

Une migration **idempotente** peut être exécutée N fois avec le même résultat.

Une migration qui échoue parce que « la colonne existe déjà » ou « la contrainte existe déjà » n’est pas idempotente. Or la ré-exécution arrive en pratique :

- smoke-test sur DB partiellement initialisée
- redémarrage/rollback incomplet
- DB locale “driftée” chez un utilisateur
- restauration partielle + reprise

## Solution robuste

### Niveau 1 — Guard systématique sur chaque opération DDL

#### Colonnes / tables / index

```sql
-- ❌ Fragile
ALTER TABLE atlas.colab_missions ADD COLUMN ex_maille_code TEXT;

-- ✅ Idempotent
ALTER TABLE atlas.colab_missions
  ADD COLUMN IF NOT EXISTS ex_maille_code TEXT;

-- ❌ Fragile
CREATE INDEX idx_missions_maille ON atlas.colab_missions(maille_id);

-- ✅ Idempotent
CREATE INDEX IF NOT EXISTS idx_missions_maille
  ON atlas.colab_missions(maille_id);
```

#### Types enum

```sql
-- ❌ Fragile
CREATE TYPE atlas.mission_status AS ENUM ('active', 'closed');

-- ✅ Idempotent
DO $$ BEGIN
  CREATE TYPE atlas.mission_status AS ENUM ('active', 'closed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

#### Contraintes

PostgreSQL ne supporte pas `ADD CONSTRAINT IF NOT EXISTS` dans tous les cas.

Le pattern robuste est un guard via `pg_constraint` :

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'check_depth_order'
      AND conrelid = 'sondages'::regclass
  ) THEN
    ALTER TABLE sondages
      ADD CONSTRAINT check_depth_order CHECK (...);
  END IF;
END $$;
```

### Niveau 2 — Table de suivi des migrations + vérification checksum

Le projet maintient une table de suivi **checksumée** :

- `atlas.schema_migrations`
  - identifiant migration (nom de fichier)
  - checksum SHA256
  - timing d’exécution

Cette table sert à détecter :

- une migration modifiée après application
- une divergence entre DB et repo (drift)

### Niveau 3 — Validation avant merge (CI)

Le repo utilise un validateur :

- `scripts/validate_migrations.py`

Caractéristiques :

- applique toutes les migrations sur une DB de test
- rejoue une seconde fois (replay) pour imposer l’idempotence
- refuse toute divergence de checksum

**Règle de sécurité** : ce validateur doit tourner sur une DB **fraîche**.

Le script échoue explicitement si `atlas.schema_migrations` n’est pas vide.

## Bonne pratique [DB-01]

- **Règle absolue** : *toute migration est idempotente, ou elle n’est pas mergée.*
- **Enforcement** : CI exécute `scripts/validate_migrations.py` sur une DB neuve.

---

# Problème 2 — Seed/schema mismatch silencieux (DB-02)

## Cause racine

Un mismatch seed/schema (hash seed différent, ou version attendue ≠ version DB) qui ne bloque pas le démarrage est un incident latent.

Le pire état :

- le système sait qu’il y a un problème
- mais il continue

Résultat : incident détecté par l’utilisateur, pas par le système.

## Solution robuste

### Niveau 1 — Classification des mismatches par sévérité

Implémenté côté Desktop :

- `apps/atlas-pro/src-tauri/src/postgres.rs`
- `SeedMismatch`

Variants :

- `IntegrityViolation` : SHA256 attendu ≠ actuel
- `SchemaMismatch` : version/migration max attendue ≠ DB
- `InvariantViolation` : invariant métier échoué

### Niveau 2 — Politique de réponse

- **Fatal** : bloque le démarrage
  - en smoke-test : exit code explicite
  - en prod : message UI + logs incident
- **Non-fatal** : autorisé *uniquement* si justification explicite (ex : schema en retard qui va être migré)

## Bonne pratique [DB-02]

- **Règle** : *tout mismatch est soit fatal (bloque), soit explicitement accepté et loggué.*
- Il n’y a pas de “continue silently”.

---

# Problème 3 — Build Windows bloqué par lock sur .exe (DEV-01)

## Cause racine

Windows verrouille les exécutables en cours d’exécution.

Le problème n’est pas le lock : c’est l’absence d’un process systématique qui libère les verrous avant build.

## Solution robuste

### Niveau 1 — Script pre-build

- `scripts/dev/Stop-AtlasProcesses.ps1`

Ce script arrête :

- `atlas-pro`
- `api-geo`
- postgres embarqué si présent

### Niveau 2 — Intégration workflow dev/build

Le `Makefile` racine expose :

- `stop-atlas`
- `tauri-dev` (dépend de `stop-atlas`)
- `tauri-build` (dépend de `stop-atlas`)

## Bonne pratique [DEV-01]

- **Règle** : le workflow local est scripté. Personne ne doit avoir à « penser » à fermer des processus.

---

# Problème 4 — Smoke-test instable (TEST-01)

## Cause racine

Un smoke-test qui dépend d’un état laissé par un run précédent n’est pas un test : c’est une séquence fragile.

## Solution robuste

### Niveau 1 — Isolation forte

En `ATLAS_SMOKE_TEST=1`, le Desktop force :

- `ATLAS_DATA_DIR` unique
- `DB_NAME` unique

### Niveau 2 — Cleanup garanti

Le run smoke-test assure :

- stop du Postgres embarqué
- suppression du répertoire data temporaire

### Niveau 3 — Exit codes explicites

Les familles d’erreur ont des exit codes distincts (contrat CI), afin que l’automatisation puisse classifier les échecs sans lire tous les logs.

## Bonne pratique [TEST-01]

- **Règle** : chaque test crée et détruit son environnement.
- Un test doit pouvoir être lancé 2 fois de suite avec le même résultat.

---

# Problème 5 — Automatisation MSI (DESKTOP-4)

## Objectif

Valider automatiquement, sur Windows, le cycle :

- install MSI
- démarrage Desktop + seed/migrations
- health check API
- vérifications fonctionnelles minimales
- uninstall MSI
- collecte logs

## Implémentation

- Script : `scripts/test-msi-install.ps1`
- Workflow : `.github/workflows/msi-test.yml`

Le workflow :

1. build MSI
2. exécute le test sur un runner Windows **self-hosted**
3. upload un rapport JSON + logs

## Bonne pratique [DESKTOP-4]

- Le test MSI doit tourner sur une machine la plus proche possible d’un poste utilisateur (pas d’hypothèses implicites).

---

# Enforcement : ce qui est interdit (anti dette technique)

- Modifier une migration déjà publiée sans mécanisme de compatibilité : interdit.
- Ajouter une migration non idempotente : interdit.
- Continuer après un mismatch fatal : interdit.
- Laisser un test flaky en CI : interdit.
- Pusher des fichiers >100MB dans GitHub : interdit.

---

# Références (code réel)

- `scripts/validate_migrations.py`
- `db/migrations/004_add_survey_management.sql`
- `db/migrations/004_optimize_indexes_v1.3.0.sql`
- `scripts/dev/Stop-AtlasProcesses.ps1`
- `scripts/test-msi-install.ps1`
- `.github/workflows/msi-test.yml`
- `apps/atlas-pro/src-tauri/src/postgres.rs`
- `apps/atlas-pro/src-tauri/src/lib.rs`
