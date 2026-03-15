## Roadmap complète — De l'état actuel à la publication v1.0.0

### BLOC FIN — Stabilisation code (sprint 3-5 jours)

**FIN-1 — Finir le split `ColabPage.tsx`**

Extraire dans cet ordre avec `npm run build` + commit entre chaque :

- `CreateMissionModal` → `ui/src/pages/colab/create-mission-modal.tsx`
- `CreateStudentModal` → `ui/src/pages/colab/create-student-modal.tsx`
- `CreateSupervisorModal` → `ui/src/pages/colab/create-supervisor-modal.tsx`
- Sections d'onglets (tab panels Missions, Étudiants, Superviseurs) → `ui/src/pages/colab/tabs/`
- Objectif final : `ColabPage.tsx` < 400 lignes, ne contient que routing d'onglets + state global

**FIN-2 — Appliquer les migrations manquantes**

```powershell
# Migrations à appliquer dans l'ordre
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 `
  -f /docker-entrypoint-initdb.d/133_rbac_reassignment_permissions.sql
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 `
  -f /docker-entrypoint-initdb.d/135_data_change_log.sql
docker compose exec -T db psql -U atlas -d atlas_clean -v ON_ERROR_STOP=1 `
  -f /docker-entrypoint-initdb.d/136_subscription_plans.sql

# Vérifier
docker compose exec -T db psql -U atlas -d atlas_clean -c "
SELECT table_name FROM information_schema.tables 
WHERE table_schema='atlas' 
AND table_name IN ('subscription_plans','organizations','data_change_log')
ORDER BY table_name;"
```

**FIN-3 — Migration 135 : data_change_log + triggers**

```sql
-- db/migrations/135_data_change_log.sql
BEGIN;

CREATE TABLE IF NOT EXISTS atlas.data_change_log (
    id          BIGSERIAL PRIMARY KEY,
    table_name  TEXT NOT NULL,
    record_id   TEXT NOT NULL,
    action      TEXT NOT NULL CHECK (action IN ('INSERT','UPDATE','DELETE')),
    changed_by  UUID REFERENCES atlas.users(id) ON DELETE SET NULL,
    changed_at  TIMESTAMPTZ DEFAULT NOW(),
    old_values  JSONB,
    new_values  JSONB,
    change_reason TEXT
);

CREATE INDEX IF NOT EXISTS idx_dcl_table_record 
    ON atlas.data_change_log(table_name, record_id);
CREATE INDEX IF NOT EXISTS idx_dcl_changed_at 
    ON atlas.data_change_log(changed_at DESC);

CREATE OR REPLACE FUNCTION atlas.log_data_change()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO atlas.data_change_log(table_name, record_id, action, old_values, new_values)
    VALUES (
        TG_TABLE_NAME,
        COALESCE(NEW.id::text, OLD.id::text),
        TG_OP,
        CASE WHEN TG_OP != 'INSERT' THEN row_to_json(OLD)::jsonb ELSE NULL END,
        CASE WHEN TG_OP != 'DELETE' THEN row_to_json(NEW)::jsonb ELSE NULL END
    );
    RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

-- Triggers sur les tables critiques
DROP TRIGGER IF EXISTS log_missions_changes ON atlas.colab_missions;
CREATE TRIGGER log_missions_changes
    AFTER INSERT OR UPDATE OR DELETE ON atlas.colab_missions
    FOR EACH ROW EXECUTE FUNCTION atlas.log_data_change();

DROP TRIGGER IF EXISTS log_assignments_changes ON atlas.colab_mission_assignments;
CREATE TRIGGER log_assignments_changes
    AFTER INSERT OR UPDATE OR DELETE ON atlas.colab_mission_assignments
    FOR EACH ROW EXECUTE FUNCTION atlas.log_data_change();

DROP TRIGGER IF EXISTS log_maille_changes ON atlas.colab_maille_assignments;
CREATE TRIGGER log_maille_changes
    AFTER INSERT OR UPDATE OR DELETE ON atlas.colab_maille_assignments
    FOR EACH ROW EXECUTE FUNCTION atlas.log_data_change();

COMMIT;
```

**FIN-4 — Migration 136 : subscription_plans + organizations**

```sql
-- db/migrations/136_subscription_plans.sql
BEGIN;

CREATE TABLE IF NOT EXISTS atlas.subscription_plans (
    id                      TEXT PRIMARY KEY,
    name                    TEXT NOT NULL,
    price_monthly_usd       NUMERIC(10,2),
    price_annual_usd        NUMERIC(10,2),
    api_requests_per_month  INTEGER,
    max_team_members        INTEGER,
    features                JSONB NOT NULL DEFAULT '{}'
);

INSERT INTO atlas.subscription_plans VALUES
('free', 'Explorateur', 0, 0, 1000, 1,
 '{"exports_limited":true,"private_spaces":false,"data_contribution":false,"atlas_pro":false}'),
('pro', 'Ingénieur', 75, 720, 10000, 5,
 '{"exports_limited":false,"private_spaces":false,"data_contribution":false,"atlas_pro":true}'),
('org', 'Bureau', 200, 1920, 100000, 20,
 '{"exports_limited":false,"private_spaces":true,"data_contribution":true,"atlas_pro":true}'),
('institutional', 'Institutionnel', null, null, null, null,
 '{"exports_limited":false,"private_spaces":true,"data_contribution":true,"atlas_pro":true,"on_prem":true}')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS atlas.organizations (
    id                          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name                        TEXT NOT NULL,
    plan_id                     TEXT REFERENCES atlas.subscription_plans(id) DEFAULT 'free',
    plan_started_at             TIMESTAMPTZ DEFAULT NOW(),
    plan_expires_at             TIMESTAMPTZ,
    api_requests_used_this_month INTEGER DEFAULT 0,
    api_requests_reset_at       TIMESTAMPTZ DEFAULT date_trunc('month', NOW()) + INTERVAL '1 month',
    stripe_customer_id          TEXT,
    stripe_subscription_id      TEXT,
    is_active                   BOOLEAN DEFAULT TRUE,
    metadata                    JSONB DEFAULT '{}'
);

ALTER TABLE atlas.users
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES atlas.organizations(id);

CREATE INDEX IF NOT EXISTS idx_users_org ON atlas.users(organization_id);

COMMENT ON TABLE atlas.organizations IS
    'BM-PLAN-01 : Organisation cliente avec plan tarifaire.
     Un utilisateur sans organization_id est sur le plan Free individuel.';

COMMIT;
```

**FIN-5 — UI assignation rôle coordinator**

Ajouter dans la page d'administration utilisateurs (`/admin/users` ou équivalent) un sélecteur de rôle. Si cette page n'existe pas, ajouter une route simple dans le DB Manager existant :

```bash
# Endpoint à créer ou vérifier
POST /api/admin/users/:id/roles
Body: { "role_id": "coordinator" }

# Test immédiat
curl -X POST http://127.0.0.1:8000/api/admin/users/<UUID>/roles \
  -H "Authorization: Bearer $TOKEN_ADMIN" \
  -H "Content-Type: application/json" \
  -d '{"role_id":"coordinator"}'
```

**FIN-6 — Mettre à jour `verify-tauri-dev.ps1` pour le Desktop**

```powershell
# Ajouter dans scripts/verify-tauri-dev.ps1 les checks Desktop-spécifiques :

# Check sync_state table (SYNC-134)
$syncState = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
    "SELECT to_regclass('atlas.sync_state') IS NOT NULL;"
Check "SYNC-134 : table sync_state présente" ($syncState.Trim() -eq "t")

# Check data_change_log (FIN-3)
$dcl = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
    "SELECT to_regclass('atlas.data_change_log') IS NOT NULL;"
Check "FIN-3 : data_change_log présent" ($dcl.Trim() -eq "t")

# Check subscription_plans (FIN-4)
$plans = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
    "SELECT COUNT(*) FROM atlas.subscription_plans;"
Check "FIN-4 : plans tarifaires chargés" ([int]$plans.Trim() -ge 4)

# Check RBAC coordinator role
$coordinator = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
    "SELECT COUNT(*) FROM atlas.roles WHERE id='coordinator';"
Check "RBAC : rôle coordinator présent" ([int]$coordinator.Trim() -ge 1)

# Check audit trail triggers
$triggers = docker compose exec -T db psql -U atlas -d atlas_clean -tAc `
    "SELECT COUNT(*) FROM pg_trigger WHERE tgname LIKE 'log_%_changes';"
Check "FIN-3 : triggers audit trail actifs" ([int]$triggers.Trim() -ge 3)
```

---

### BLOC DOCS — Documentation publique

**DOCS-1 — `CHANGELOG.md` public**

```markdown
# Changelog — Atlas Géotechnique

## [1.0.0] — 2026-03-XX — Première release publique

### Fonctionnalités principales
- Carte interactive des 29 407 mailles géotechniques du Togo (EPSG:25231)
- Données géotechniques : sondages, essais Atterberg, VBS, granulométrie, Proctor
- Atlas Colab : gestion des missions terrain et des opérateurs
- Système de permissions RBAC (admin, coordinateur, opérateur)
- Application Desktop offline-first (Windows, Linux)
- API REST complète avec authentification JWT
- Exports PDF, GeoPackage, CSV

### Infrastructure
- Grille 2km × 2km axis-aligned, topologie parfaite, 29 407 mailles
- Remapping legacy complet (29 407 correspondances par intersection géométrique)
- Auto-update via GitHub Releases (signature ed25519)
- Base de données PostgreSQL/PostGIS embarquée

### Sécurité
- Authentification Argon2id, sessions révocables
- RBAC : rôles et permissions granulaires
- Audit trail complet sur les opérations critiques
- Chiffrement des communications (HTTPS/TLS)
```

**DOCS-2 — `README.md` public**

Le README public doit inclure : une capture d'écran de la carte, les prérequis système, les instructions d'installation, un lien vers la documentation, et les informations de contact pour le tier Institutionnel.

**DOCS-3 — Import docs_vault post-stabilisation**

```powershell
# Après toutes les modifications de docs
.\scripts\import-docs-to-vault.ps1 -Force
.\scripts\import-docs-to-vault.ps1 -VerifyOnly
# Attendu : 0 ❌
```

---

### BLOC SEED — Regénération seed post-migrations

**SEED-1 — Regénérer le dump après toutes les migrations**

```powershell
# Regénérer après FIN-2 à FIN-4
docker compose exec -T db pg_dump -U atlas -d atlas_clean `
  -Fc --no-owner --no-acl `
  > data/db/backups/atlas_desktop_seed.dump

python scripts/generate_seed_manifest.py `
  --dump data/db/backups/atlas_desktop_seed.dump `
  --git-commit (git rev-parse --short HEAD) `
  --max-migration 136
```

**SEED-2 — Valider le dump**

```powershell
.\scripts\validate-dump.ps1 data/db/backups/atlas_desktop_seed.dump
# Attendu : ✅ SHA256 cohérent, ✅ format custom, ✅ version PG compatible
```

---

### BLOC PUBLISH — Pipeline de publication

**PUBLISH-1 — Générer les clés Tauri ed25519**

```bash
# Une seule fois, à faire maintenant
cargo tauri signer generate -w ~/.tauri/atlas_signing_key

# Sortie :
# Private key: ~/.tauri/atlas_signing_key
# Public key: dW50cnVzdGVkIGNvb...  ← copier dans tauri.conf.json
```

Stocker la clé privée dans GitHub Secrets :

- `Settings → Secrets → Actions → New repository secret`
- Nom : `TAURI_PRIVATE_KEY` → valeur : contenu du fichier clé privée
- Nom : `TAURI_KEY_PASSWORD` → valeur : mot de passe choisi

**PUBLISH-2 — Configurer `tauri.conf.json`**

```json
{
  "package": {
    "productName": "Atlas Géotechnique",
    "version": "1.0.0"
  },
  "tauri": {
    "updater": {
      "active": true,
      "endpoints": [
        "https://github.com/TON_USER/ATLAS_REPO/releases/latest/download/latest.json"
      ],
      "dialog": true,
      "pubkey": "dW50cnVzdGVkIGNvb..."
    },
    "bundle": {
      "identifier": "com.atlas.geotechnique",
      "icon": ["icons/32x32.png", "icons/128x128.png", "icons/icon.ico"],
      "windows": {
        "wix": { "language": "fr-FR" },
        "nsis": { "installMode": "perMachine" }
      }
    }
  }
}
```

**PUBLISH-3 — Créer `.github/workflows/release.yml`**

Le workflow complet présenté dans la session précédente. Vérifier que le chemin vers le projet Tauri est correct (`apps/atlas-pro/src-tauri`).

**PUBLISH-4 — Nettoyer le versionnement git**

```bash
# Vérifier l'état actuel
git log --oneline -10
git tag -l

# Créer le tag v1.0.0 propre sur le commit de stabilisation
git tag -a v1.0.0 -m "Atlas Géotechnique v1.0.0 — Première release publique"

# NE PAS supprimer les anciens tags (historique de développement)
# Pousser uniquement le nouveau tag
git push origin v1.0.0
```

**PUBLISH-5 — Premier build de test local**

```bash
# Avant de pousser le tag, tester le build localement
cd apps/atlas-pro
cargo tauri build

# Vérifier le binaire généré
ls target/release/bundle/msi/
ls target/release/bundle/nsis/
```

**PUBLISH-6 — Pousser et vérifier le pipeline**

```bash
# Pousser le tag (déclenche GitHub Actions)
git push origin v1.0.0

# Surveiller dans GitHub → Actions → Release Atlas
# Durée estimée : 20-40 minutes (compilation Rust + bundling)
```

**PUBLISH-7 — Vérifier la release GitHub**

Après le pipeline :

- `releases/latest/download/latest.json` doit être accessible
- Le `.msi` signé doit être présent
- La signature `.sig` doit être incluse

**PUBLISH-8 — Test end-to-end de l'auto-update**

```
1. Installer Atlas v1.0.0 depuis le .msi
2. Changer version dans tauri.conf.json → 1.0.1
3. Ajouter un changement mineur visible dans l'UI
4. git tag -a v1.0.1 && git push origin v1.0.1
5. Attendre le build GitHub Actions
6. Ouvrir Atlas v1.0.0 → vérifier notification "v1.0.1 disponible"
7. Cliquer "Mettre à jour" → vérifier installation automatique + redémarrage
```

---

### BLOC LANDING — Présence web minimale

**LANDING-1 — Domaine et hébergement**

Enregistrer `atlas-geo.tg` ou `atlas-geotechnique.com`. Pour l'hébergement, une page statique sur GitHub Pages suffit pour commencer (gratuit, déployé automatiquement depuis le repo).

**LANDING-2 — Contenu minimal de la landing page**

La page doit contenir dans cet ordre : accroche ("Les données géotechniques du Togo, enfin structurées"), capture d'écran de la carte, les 4 tiers de pricing avec un tableau comparatif, bouton de téléchargement de l'application Desktop, formulaire de contact pour le tier Institutionnel.

**LANDING-3 — Politique de confidentialité et CGU**

Indispensable pour les clients institutionnels. Un document simple en français couvrant : quelles données sont collectées, où elles sont stockées, les droits des utilisateurs.

---

### Tableau de bord complet

|Bloc|Item|Statut|Priorité|
|---|---|---|---|
|FIN|Split ColabPage.tsx < 400 lignes|⚠️ En cours|Haute|
|FIN|Migration 133 RBAC|✅ Fait|—|
|FIN|Migration 134 sync_state|✅ Fait|—|
|FIN|Migration 135 data_change_log|🔴 À faire|Haute|
|FIN|Migration 136 subscription_plans|🔴 À faire|Haute|
|FIN|UI assignation rôle coordinator|🔴 À faire|Moyenne|
|FIN|verify-tauri-dev.ps1 mis à jour|🔴 À faire|Moyenne|
|FIN|Test sur version Desktop Tauri|🔴 À faire|Haute|
|DOCS|CHANGELOG.md public|🔴 À faire|Haute|
|DOCS|README.md public|🔴 À faire|Haute|
|DOCS|Import docs_vault final|🔴 À faire|Basse|
|SEED|Regénération dump post-migrations|🔴 À faire|Haute|
|SEED|Validation dump|🔴 À faire|Haute|
|PUBLISH|Clés ed25519 Tauri|🔴 À faire|Critique|
|PUBLISH|tauri.conf.json version 1.0.0|🔴 À faire|Critique|
|PUBLISH|GitHub Actions release.yml|🔴 À faire|Critique|
|PUBLISH|Git tag v1.0.0 propre|🔴 À faire|Critique|
|PUBLISH|Build local test|🔴 À faire|Critique|
|PUBLISH|Test auto-update v1.0.0 → v1.0.1|🔴 À faire|Critique|
|LANDING|Domaine + hébergement|🔴 À faire|Haute|
|LANDING|Landing page pricing|🔴 À faire|Haute|
|LANDING|CGU + politique confidentialité|🔴 À faire|Moyenne|

---

## 💡 Bonne pratique supplémentaire

Pour la publication d'un logiciel géotechnique dans le contexte ouest-africain, le facteur de confiance le plus important n'est pas le prix ni les features — c'est la **provenance et la légitimité des données**. Avant de lancer, prépare un document d'une page intitulé "Sources et méthodologie des données Atlas" qui explique d'où viennent les sondages, comment la grille a été construite, et quelle est la précision des données. Les ingénieurs et les bailleurs demandent systématiquement ce document avant tout achat. C'est l'équivalent des métadonnées ISO 19115 pour un produit géospatial commercial.