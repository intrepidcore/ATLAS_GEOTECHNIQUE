
# ROADMAP COMPLÈTE ET DÉTAILLÉE

---

## BLOC R — Corrections bloquantes (bugs visibles)

### R-1 — Créer la vue `atlas.v_colab_mission_attributions`

**Contexte** : Les endpoints `/api/colab/attributions`, `/api/colab/attributions/notifications/history` et `/api/colab/notify/jobs` retournent 500 avec le message `relation "atlas.v_colab_mission_attributions" does not exist`. Cette vue n'a jamais été créée.

**Directives** :
- Créer la migration `124_colab_attributions_view.sql`
- La vue doit exposer : `attribution_id`, `student_id`, `student_name`, `mission_id`, `mission_title`, `maille_id`, `maille_code`, `assigned_at`, `unassigned_at`, `is_active` (calculé : `unassigned_at IS NULL`)
- Joindre `colab_mission_assignments`, `colab_missions`, `colab_students`, `users`, `mailles`
- Appliquer la migration via `docker compose exec -T db psql -U atlas -d atlas_clean -f /docker-entrypoint-initdb.d/124_colab_attributions_view.sql`
- Vérifier : `docker compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) FROM atlas.v_colab_mission_attributions;"`
- GRANT SELECT sur cette vue à `atlas_app_user` et `atlas_readonly_user`

**Validation** :
```bash
curl -s -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8000/api/colab/attributions?limit=10
# Attendu : 200 avec tableau JSON, pas 500
```

---

### R-2 — Corriger le champ `active_mailles` dans la liste étudiants

**Contexte** : L'UI affiche `Mailles actives = 0` pour tous les étudiants malgré 8 mailles actives en DB. Le patch précédent sur `GET /colab/students` a un bug de requête SQL (GROUP BY ou JOIN incorrect).

**Directives** :
- Ouvrir `services/api-geo/src/colab/routes.rs`, fonction `list_students`
- Localiser le calcul `active_mailles`
- Remplacer par la sous-requête canonique :
```sql
(
  SELECT COUNT(DISTINCT cm.maille_id)
  FROM atlas.colab_mission_assignments cma
  JOIN atlas.colab_missions cm ON cm.id = cma.mission_id
  WHERE cma.student_id = s.id
    AND cma.unassigned_at IS NULL
    AND cm.maille_id IS NOT NULL
) AS active_mailles
```
- Appliquer la même correction dans `get_student` (détail étudiant) et `list_student_duplicates`
- Vérifier que le résultat dans l'UI correspond aux 8 mailles actives distribuées entre les 21 étudiants (plusieurs étudiants partagent les mêmes mailles)

**Validation** :
```bash
curl -s -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8000/api/colab/students | python -c \
  "import sys,json; d=json.load(sys.stdin); 
   total=sum(s.get('active_mailles',0) for s in d.get('students',[])); 
   print('total active_mailles sum:', total)"
# Attendu : sum > 0 (les 21 assignments sur 8 mailles distinctes)
```

---

### R-3 — Corriger les permissions `atlas_app_user` sur `public.sondages` et tables système

**Contexte** : `GET /api/db/table/public/sondages/data` retourne 500. Le rôle `atlas_app_user` n'a pas les droits sur les tables du schéma `public`.

**Directives** :
- Créer la migration `125_fix_app_user_grants.sql`
- Ajouter : `GRANT SELECT ON ALL TABLES IN SCHEMA public TO atlas_app_user;`
- Pour le DB Manager, implémenter le pool admin séparé (voir E-1 plus bas)
- Appliquer et valider

**Validation** :
```bash
curl -s -H "Authorization: Bearer <token>" \
  "http://127.0.0.1:8000/api/db/table/public/sondages/data?limit=5"
# Attendu : 200 avec données ou tableau vide, pas 500
```

---

## BLOC M — Vérification complète du remapping mailles

### M-1 — Audit exhaustif du remapping étudiant → mission → maille

**Contexte** : Des étudiants ont été importés après une perte de DB alors que les codes mailles avaient changé. Un remapping a été tenté mais sa méthode et son efficacité sont incertaines. Il faut établir un état de vérité avant toute action corrective.

**Directives** :
- Exécuter les requêtes d'audit suivantes et noter chaque résultat :

```sql
-- 1. Missions sans maille
SELECT id, titre, created_at
FROM atlas.colab_missions
WHERE maille_id IS NULL;

-- 2. Missions avec maille invalide (FK orpheline)
SELECT cm.id, cm.titre, cm.maille_id
FROM atlas.colab_missions cm
LEFT JOIN atlas.mailles m ON m.id = cm.maille_id
WHERE cm.maille_id IS NOT NULL AND m.id IS NULL;

-- 3. État du mapping legacy
SELECT COUNT(*) AS total_legacy_map,
       COUNT(DISTINCT new_maille_id) AS distinct_new_mailles,
       COUNT(*) FILTER (WHERE new_maille_id IS NULL) AS unmapped
FROM atlas.legacy_maille_code_map;

-- 4. Missions reliées à une maille via legacy (cohérence)
SELECT cm.id, cm.titre,
       m.code AS current_code,
       lm.legacy_code
FROM atlas.colab_missions cm
JOIN atlas.mailles m ON m.id = cm.maille_id
LEFT JOIN atlas.legacy_maille_code_map lm ON lm.new_maille_id = m.id;

-- 5. Étudiants avec assignments actifs mais mission sans maille
SELECT DISTINCT u.username, cma.student_id::text
FROM atlas.colab_mission_assignments cma
JOIN atlas.colab_missions cm ON cm.id = cma.mission_id
JOIN atlas.colab_students cs ON cs.id = cma.student_id
JOIN atlas.users u ON u.id = cs.user_id
WHERE cma.unassigned_at IS NULL
  AND cm.maille_id IS NULL;
```

- Documenter les résultats dans `docs/audit/AUDIT_REMAPPING_2026-03-13.md`

---

### M-2 — Corriger les missions sans maille (si audit M-1 révèle des cas)

**Directives** (à appliquer seulement si M-1 révèle des missions sans `maille_id`) :
- Pour chaque mission sans maille, identifier la commune associée via `atlas.adm3`
- Assigner la maille par centroïde :
```sql
UPDATE atlas.colab_missions cm
SET maille_id = (
  SELECT m.id
  FROM atlas.mailles m
  JOIN atlas.adm3 a ON ST_Within(ST_Centroid(a.geom), m.geom)
  WHERE a.pcode = cm.commune_pcode
  LIMIT 1
)
WHERE cm.maille_id IS NULL
  AND cm.commune_pcode IS NOT NULL;
```
- Pour les missions sans commune : signalement manuel, ne pas assigner automatiquement
- Créer la migration `126_fix_missions_missing_maille.sql` avec cette correction
- Vérifier après : `SELECT COUNT(*) FROM atlas.colab_missions WHERE maille_id IS NULL;` → attendu : 0 ou nombre justifié

---

### M-3 — Vérifier la couverture du mapping legacy

**Directives** :
- Vérifier que `atlas.legacy_maille_code_map` couvre bien toutes les mailles actives :
```sql
-- Mailles actives sans correspondance legacy
SELECT m.code, m.id::text
FROM atlas.mailles m
JOIN atlas.colab_missions cm ON cm.maille_id = m.id
JOIN atlas.colab_mission_assignments cma ON cma.mission_id = cm.id
WHERE cma.unassigned_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM atlas.legacy_maille_code_map lm
    WHERE lm.new_maille_id = m.id
  );
```
- Si des mailles actives n'ont pas de correspondance legacy : les ajouter manuellement dans `legacy_maille_code_map` avec `mapping_method = 'manual'`
- Vérifier que `atlas.v_api_legacy_lookup` résout correctement les anciens codes

**Validation** :
```bash
# Tester la résolution d'un ancien code legacy
curl -s "http://127.0.0.1:8000/api/search/legacy/TG-XXXX"
# Attendu : 200 avec {id, code, spatial_id}
```

---

## BLOC C — Canonisation (suite)

### C-3b — Aligner `GET /api/colab/students/:id/stats` sur la vue canonique

**Directives** :
- Créer l'endpoint `GET /api/colab/students/:id/stats` dans `colab/routes.rs`
- Retourner :
```json
{
  "student_id": "...",
  "active_missions": 1,
  "active_mailles": 1,
  "mailles_detail": [
    {"maille_id": "...", "maille_code": "...", "spatial_id": "...", "mission_title": "..."}
  ]
}
```
- La source pour `active_mailles` est `atlas.v_maille_status WHERE responsible_student_id = :id AND maille_status = 'active'`
- Ajouter la route dans `main.rs`

**Validation** :
```bash
curl -s -H "Authorization: Bearer <token>" \
  http://127.0.0.1:8000/api/colab/students/<uuid>/stats
# Attendu : 200 avec active_mailles cohérent avec l'UI
```

---

### C-4 — Documenter et contraindre `colab_maille_assignments`

**Directives** :
- Créer la migration `127_colab_maille_assignments_constraints.sql`
- Ajouter si absent : `UNIQUE(maille_id)` (une maille ne peut avoir qu'une attribution explicite)
- Ajouter commentaire SQL : `COMMENT ON TABLE atlas.colab_maille_assignments IS 'BM-02: Attribution administrative explicite. Vide en phase courante (planification future).';`
- Mettre à jour `docs/REGLES_METIER.md` section BM-02

---

### C-5 — Finir le split de `ColabPage.tsx`

**Directives** :
- Extraire dans `ui/src/pages/colab/` dans cet ordre, avec `npm run build` + commit entre chaque :
  1. `upload-document-modal.tsx` (extrait de `UploadDocumentModal`)
  2. `student-detail-modal.tsx` (extrait de `StudentDetailModal`)
  3. `supervisor-detail-modal.tsx` (extrait de `SupervisorDetailModal`)
  4. `create-mission-modal.tsx` (extrait de `CreateMissionModal`)
  5. `create-student-modal.tsx` (extrait de `CreateStudentModal`)
  6. `create-supervisor-modal.tsx` (extrait de `CreateSupervisorModal`)
- Objectif final : `ColabPage.tsx` < 400 lignes, ne contient que routing d'onglets + state global + appels data

---

## BLOC E — Sécurité DB (finalisation)

### E-1 — Pool admin séparé pour `/db/*`

**Directives** :
- Dans `services/api-geo/src/main.rs`, créer un second `PgPool` :
```rust
let admin_pool = if std::env::var("ENABLE_DB_MANAGER").unwrap_or_default() == "true" {
    let url = std::env::var("DATABASE_URL_ADMIN")
        .expect("DATABASE_URL_ADMIN requis si ENABLE_DB_MANAGER=true");
    Some(PgPool::connect(&url).await?)
} else {
    None
};
```
- Injecter `admin_pool` uniquement sur les routes `/db/*`
- Si `admin_pool` est `None` et qu'une route `/db/*` est appelée → retourner 503 avec message `{"error": "DB Manager désactivé en production"}`
- Ajouter dans `.env.example` : `DATABASE_URL_ADMIN=postgres://atlas_etl_user:${ATLAS_DB_ETL_PASSWORD}@db:5432/atlas_clean` et `ENABLE_DB_MANAGER=false`

**Validation** :
```bash
# Sans ENABLE_DB_MANAGER
curl -s "http://127.0.0.1:8000/api/db/table/public/sondages/data"
# Attendu : 503

# Avec ENABLE_DB_MANAGER=true et DATABASE_URL_ADMIN configuré
curl -s "http://127.0.0.1:8000/api/db/table/public/sondages/data?limit=5"
# Attendu : 200
```

---

## BLOC D — Contrat seed dump (implémentation)

### D-1 — Script `generate_seed_manifest.py`

**Directives** :
- Créer `scripts/generate_seed_manifest.py`
- Arguments : `--dump <path>` `--git-commit <hash>` `--max-migration <int>`
- Calculer SHA256 du dump
- Interroger le container DB pour `pg_dump --version`, `postgis_full_version()`
- Écrire le manifest JSON à `<dump>.manifest.json`

---

### D-2 — Script `validate-dump.sh`

**Directives** :
- Créer `scripts/validate-dump.sh`
- Vérifier présence manifest
- Recalculer SHA256 et comparer à `manifest.dump.sha256`
- Vérifier `manifest.engine.postgres_target_major` == version cible
- Afficher résultat structuré : ✅ ou ❌ par vérification

---

### D-3 — Script `validate-db.sh`

**Directives** :
- Créer `scripts/validate-db.sh`
- Exécuter les invariants BM-04, BM-05 + :
  - `atlas.mailles` : COUNT >= 29000
  - `atlas.v_maille_status` : accessible sans erreur
  - `atlas.legacy_maille_code_map` : COUNT >= 29000
  - `atlas.colab_missions WHERE maille_id IS NULL` : COUNT = 0

---

### D-4 — Implémenter vérification SHA256 dans `restore-db.sh`

**Directives** :
- Modifier `scripts/restore-db.sh`
- Avant `pg_restore`, calculer `sha256sum <dump>` et comparer au manifest
- Abort avec `exit 1` et message clair si mismatch

---

### D-5 — Remplacer `database_looks_initialized()` dans `postgres.rs`

**Directives** :
- Créer la migration `128_desktop_state_table.sql` :
```sql
CREATE TABLE IF NOT EXISTS atlas.desktop_state (
  id SERIAL PRIMARY KEY,
  seed_sha256 TEXT NOT NULL,
  max_migration_applied INTEGER NOT NULL,
  applied_at TIMESTAMPTZ DEFAULT NOW()
);
```
- Dans `apps/atlas-pro/src-tauri/src/postgres.rs`, remplacer l'heuristique `public.sondages` par :
```rust
async fn is_initialized(pool: &PgPool, seed_sha256: &str) -> bool {
    sqlx::query_scalar::<_, bool>(
        "SELECT EXISTS(SELECT 1 FROM atlas.desktop_state WHERE seed_sha256 = $1)"
    )
    .bind(seed_sha256)
    .fetch_one(pool).await
    .unwrap_or(false)
}
```

---

## BLOC F — Documentation finale

### F-1 — Écrire les 4 ADR

Créer dans `docs/adr/` les fichiers :
- `ADR-001_canonical_maille_status.md` (contenu ci-dessus)
- `ADR-002_seed_dump_versioning.md` (contenu ci-dessus)
- `ADR-003_db_roles_least_privilege.md` (contenu ci-dessus)
- `ADR-004_immutable_maille_code.md` : documenter le trigger + droits SQL + raison métier

---

### F-2 — Finaliser `docs/REGLES_METIER.md`

Compléter avec BM-07 à BM-12 tels que définis dans le Document 4 ci-dessus. Ajouter une section "Historique des révisions" en fin de fichier.

---

### F-3 — Écrire `docs/CONTRAT_SEED_DUMP.md`

Contenu défini dans le Document 5 ci-dessus. Ajouter la section "Historique des seeds" avec une ligne par dump généré : date, git commit, max_migration, SHA256.

---

### F-4 — Script `scripts/validate_metier.sh`

**Directives** :
- Créer un script bash qui teste BM-01 à BM-08 via psql
- Chaque test retourne ✅ ou ❌
- Exit code 0 si tout passe, 1 sinon
- À exécuter après chaque déploiement ou restore

---

## 💡 Bonne pratique supplémentaire

Sur la question "j'aurais pu éviter ça avec des contrats clairs dès le début" : tu as raison, et la leçon structurelle est celle-ci. Dans tout projet géospatial avec des données métier critiques (mailles, attributions, étudiants), la règle d'or est d'écrire l'ADR **avant** d'écrire la migration, pas après. L'ADR coûte 15 minutes et économise des heures de débogage. Pour Atlas, adopte ce réflexe : nouvelle règle métier → ADR d'abord → migration ensuite → test de régression. C'est ce que font les équipes qui ne passent pas leurs sessions à réparer des incohérences héritées.