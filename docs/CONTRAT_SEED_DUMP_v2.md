# Contrat technique — Seed Dump Desktop Atlas

## Version 2.0 — Mars 2026

Inspiré des pratiques : Supabase, PlanetScale, AWS RDS, Temporal.io

**Portée** : Ce contrat définit le cycle de vie complet du seed dump
utilisé par Atlas Pro Desktop (Tauri). Il est contraignant — tout
processus qui génère, distribue ou restaure ce dump doit s'y conformer.

**Niveau de classification** : INTERNE
Ce dump peut contenir des coordonnées GPS d'opérateurs terrain et des
données géotechniques sous licence. Il ne doit pas être distribué
publiquement. Voir section 9 pour la politique de distribution.

---

## 1) Artefacts canoniques

| Artefact | Chemin | Format | Versionnement |
| --- | --- | --- | --- |
| Dump | `data/db/backups/atlas_desktop_seed.dump` | `pg_dump -Fc` | Git LFS |
| Manifest | `data/db/backups/atlas_desktop_seed.dump.json` | JSON | Git normal |
| Signature | `data/db/backups/atlas_desktop_seed.dump.sig` | minisign | Git normal |

**Règle d'or** : le manifest et la signature sont toujours committé
avec le dump dans la même transaction Git. Un dump sans manifest
ou sans signature est invalide.

---

## 2) Schema manifest v2

Le manifest doit être valide selon ce schéma JSON strict.
Tout champ `required` manquant rend le manifest invalide.

```json
{
  "$schema": "https://atlas.intrepidcore.io/schemas/seed-manifest-v2.json",
  "schema_version": "2.0",

  "identity": {
    "seed_id": "atlas-seed-20260313-b07b917",
    "seed_version": "1.0.0",
    "environment": "production",
    "classification": "internal"
  },

  "source": {
    "created_at": "2026-03-13T14:32:00Z",
    "created_by": "serge.tabedjato",
    "git_commit": "b07b917",
    "git_branch": "atlas_v2_clean",
    "db_name": "atlas_clean",
    "format": "pg_dump -Fc --no-owner --no-privileges"
  },

  "integrity": {
    "sha256": "abc123...",
    "sha512": "def456...",
    "size_bytes": 6422528,
    "signed_by": "atlas-release-key-2026"
  },

  "compatibility": {
    "postgres_min_major": 16,
    "postgres_max_major": 17,
    "postgis_min_version": "3.4",
    "max_migration_applied": 136,
    "min_migration_applied": 1,
    "requires_extensions": ["postgis", "uuid-ossp", "pg_trgm"]
  },

  "contents": {
    "schemas": ["public", "atlas"],
    "tables_count": 47,
    "rows_estimate": {
      "atlas.mailles": 29407,
      "atlas.sondages": 114,
      "atlas.users": 0
    },
    "contains_pii": false,
    "contains_user_data": false,
    "geographic_scope": "TGO"
  },

  "retention": {
    "expires_at": "2027-03-13T00:00:00Z",
    "superseded_by": null,
    "keep_versions": 3
  },

  "invariants": [
    {
      "id": "INV-001",
      "description": "Toutes les mailles V2 présentes",
      "severity": "critical",
      "query": "SELECT COUNT(*) FROM atlas.mailles",
      "expected_min": 29407,
      "expected_max": 29407
    },
    {
      "id": "INV-002",
      "description": "Table desktop_seed_state présente",
      "severity": "critical",
      "query": "SELECT to_regclass('atlas.desktop_seed_state') IS NOT NULL",
      "expected_value": true
    },
    {
      "id": "INV-003",
      "description": "PostGIS opérationnel",
      "severity": "critical",
      "query": "SELECT ST_IsValid(ST_GeomFromText('POINT(0 0)'))",
      "expected_value": true
    },
    {
      "id": "INV-004",
      "description": "Grille couvre le territoire togolais",
      "severity": "high",
      "query": "SELECT COUNT(DISTINCT region) FROM atlas.v_maille_adm3 WHERE region IS NOT NULL",
      "expected_min": 5
    },
    {
      "id": "INV-005",
      "description": "Migration max appliquée",
      "severity": "high",
      "query": "SELECT max_migration_applied FROM atlas.desktop_seed_state ORDER BY created_at DESC LIMIT 1",
      "expected_min": 136
    },
    {
      "id": "INV-006",
      "description": "Aucun utilisateur dans le seed (sécurité)",
      "severity": "critical",
      "query": "SELECT COUNT(*) FROM atlas.users",
      "expected_max": 0
    }
  ]
}
```

**Règle INV-006 expliquée** : le seed ne doit jamais contenir de comptes utilisateurs. L'admin par défaut est créé au premier démarrage par `lib.rs`, pas depuis le seed. Cela évite de distribuer des credentials dans le bundle MSI.

---

## 3) Versionnement sémantique du seed

Le seed suit un versionnement indépendant du code :

```text
MAJOR.MINOR.PATCH

MAJOR : changement incompatible de schéma (ex: 136 → 200)
MINOR : ajout de données (nouvelles mailles, nouveaux sondages)
PATCH : correction de données existantes
```

Règle de nommage du seed_id :

```text
atlas-seed-{date}-{git_short}[-{patch}]

Exemples :
  atlas-seed-20260313-b07b917      ← première version du jour
  atlas-seed-20260313-b07b917-p1   ← patch le même jour
  atlas-seed-20260401-3f9a2cd      ← nouvelle version
```

### Principe

Chaque seed a une version SemVer indépendante du code de l'application.
Un seed n'est JAMAIS écrasé — il est archivé avant d'être remplacé.

### Incrémentation

MAJOR : changement incompatible de schéma (ex: migration 136 → 200)
MINOR : ajout de données (nouvelles mailles, nouveaux sondages)
PATCH : correction de données existantes

### Rétention locale

- 3 dernières versions conservées dans data/db/backups/versions/
- Les versions plus anciennes sont supprimées automatiquement
- Le seed courant (atlas_desktop_seed.dump) pointe toujours vers la dernière version

### Historique obligatoire dans le manifest

Le champ identity.seed_version doit être incrémenté à chaque génération.
Le champ retention.superseded_by doit pointer vers le seed qui remplace celui-ci.

---

## 4) Politique de restore — Matrice de décision

Les géants de la tech (AWS RDS, Supabase) documentent explicitement chaque cas possible. Voici la matrice pour Atlas Desktop :

|État DB|Seed disponible|FORCE_RESTORE|Action|
|---|---|---|---|
|Vide (pas de schema atlas)|✅|N/A|✅ Restore automatique|
|Seedée, même version|✅|Non|⏭️ Skip (déjà à jour)|
|Seedée, version différente|✅|Non|⚠️ Log warning, skip|
|Seedée, version différente|✅|Oui|🔄 Snapshot + restore|
|Corrompue|✅|N/A|🔄 Restore après confirmation user|
|Vide|❌|N/A|❌ Erreur fatale — afficher message d'aide|
|Seedée|❌|N/A|✅ Utiliser la DB existante|

**Règle critique** : avant tout restore sur une DB non vide, créer un snapshot automatique :

```text
data/db/snapshots/pre-restore-{timestamp}.dump
```

Ce snapshot est conservé 48h puis supprimé automatiquement.

---

## 5) Procédure de rollback

Ce que les géants font que la plupart des projets ne font pas : documenter explicitement ce qui se passe quand le restore échoue.

### Cas 1 — Restore interrompu (coupure de courant, kill process)

La DB peut être dans un état partiellement restauré. `pg_restore` avec `--clean --if-exists` est conçu pour être réexécuté en toute sécurité — la prochaine tentative repart de zéro sur les tables.

Action automatique dans `lib.rs` :

```rust
// Si restore échoue → marquer la DB comme invalide
// L'app affiche "Base de données endommagée. 
//  Cliquez pour réinitialiser."
// Ne jamais laisser l'app démarrer sur une DB partiellement restaurée
```

### Cas 2 — SHA256 ne correspond pas

Le fichier est corrompu ou a été modifié. Action : refus catégorique du restore, message explicite à l'utilisateur, log de l'incident dans `atlas.desktop_seed_state`.

### Cas 3 — Version Postgres incompatible

`pg_restore` va échouer proprement sans corrompre la DB. Action : message d'erreur avec la version attendue et la version installée.

---

## 6) Signature cryptographique (authenticité)

Le SHA256 vérifie l'intégrité mais pas l'authenticité. La signature vérifie que le dump vient bien d'IntrepidCore.

Génération lors de la release (dans GitHub Actions) :

```bash
# Utiliser minisign (même outil que Tauri pour les binaires)
minisign -S -s ~/.minisign/atlas-release.key \
  -m data/db/backups/atlas_desktop_seed.dump \
  -x data/db/backups/atlas_desktop_seed.dump.sig
```

Vérification avant restore (dans `lib.rs`) :

```rust
// La clé publique est hardcodée dans le binaire
// (comme la pubkey Tauri pour l'updater)
const SEED_PUBLIC_KEY: &str = "RWS...";

fn verify_seed_signature(dump_path: &Path, sig_path: &Path) -> Result<()> {
    // Vérifier avec minisign-rs ou implémentation manuelle ed25519
    // Si signature invalide → refus catégorique
}
```

---

## 7) Tests automatisés du contrat (CI)

Un contrat non testé est une intention, pas un contrat.

### 7.1 Test de restore complète (smoke test CI)

Exécuté à chaque commit dans `ci.yml` :

```yaml
- name: Smoke test seed restore
  run: |
    # Restore sur DB vierge
    pg_restore -h localhost -U atlas -d atlas_test \
      --no-owner --no-acl \
      data/db/backups/atlas_desktop_seed.dump
    
    # Vérifier tous les invariants du manifest
    python scripts/verify_invariants.py \
      --manifest data/db/backups/atlas_desktop_seed.dump.json \
      --db-url "postgres://atlas:test@localhost/atlas_test"
```

### 7.2 Script de vérification des invariants

`scripts/verify_invariants.py` :

```python
import json, psycopg2, sys

def verify_invariants(manifest_path: str, db_url: str) -> bool:
    with open(manifest_path) as f:
        manifest = json.load(f)
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    failures = []
    for inv in manifest["invariants"]:
        cursor.execute(inv["query"])
        result = cursor.fetchone()[0]
        
        passed = True
        if "expected_min" in inv and result < inv["expected_min"]:
            passed = False
        if "expected_max" in inv and result > inv["expected_max"]:
            passed = False
        if "expected_value" in inv and result != inv["expected_value"]:
            passed = False
        
        status = "✅" if passed else "❌"
        print(f"{status} [{inv['id']}] {inv['description']}: {result}")
        
        if not passed and inv["severity"] == "critical":
            failures.append(inv["id"])
    
    if failures:
        print(f"\n❌ {len(failures)} invariant(s) critiques échoués: {failures}")
        return False
    
    print("\n✅ Tous les invariants validés")
    return True

if __name__ == "__main__":
    success = verify_invariants(sys.argv[1], sys.argv[2])
    sys.exit(0 if success else 1)
```

---

## 8) Politique de rétention

|Type|Conservation|Stockage|Suppression|
|---|---|---|---|
|Seed production actuel|Indéfini|Git LFS + GitHub|Manuelle uniquement|
|Seeds précédents|3 versions|Git LFS|Automatique post-supersession|
|Snapshots pre-restore|48h|Local Desktop|Automatique|
|Snapshots manuels|30 jours|Local Desktop|Automatique|

Règle : jamais moins de 1 seed valide disponible en production.

---

## 9) Classification et politique de distribution

|Audience|Accès seed|Conditions|
|---|---|---|
|Développeurs IntrepidCore|✅ Complet|Git LFS accès|
|Clients Pro/Organisation|✅ Via MSI uniquement|Seed embarqué dans le bundle|
|Clients Free|❌|Pas d'accès Desktop|
|Public|❌|Jamais distribué directement|

Le seed ne contient pas de données utilisateurs (`INV-006`), mais contient des données géotechniques dont IntrepidCore détient les droits. La distribution non autorisée viole les CGU.

---

## 10) Historique des seeds

|Version|Date|Commit|Max migration|SHA256 (8 premiers)|Supersédé par|
|---|---|---|---|---|---|
|1.0.0|2026-03-13|b07b917|136|abc12345|—|

---

## 11) Checklist de release (obligatoire avant chaque publish)

À exécuter via `scripts/verify-bundle.ps1` :

```text
□ SHA256 recalculé et correspond au manifest
□ Signature vérifiée avec la clé publique release
□ Tous les invariants passent sur une DB vierge
□ Version Postgres compatible avec la cible de déploiement
□ INV-006 : aucun utilisateur dans le seed
□ seed_id unique et non présent dans l'historique
□ manifest committé dans le même commit que le dump
□ Git LFS : vérifier que le dump est bien stocké en LFS (pas inline)
□ Bundle MSI : vérifier que le dump est dans bundle.resources
```
