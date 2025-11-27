PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "ALTER TABLE public.sondages SET SCHEMA atlas;"
ERROR:  relation "idx_sondages_date" already exists in schema "atlas"
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT indexname FROM pg_indexes WHERE schemaname = 'atlas' AND indexname LIKE '%sondages%' AND indexname NOT LIKE '%legacy%';"
             indexname
------------------------------------
 idx_sondages_geom
 idx_sondages_date
 sondages_non_geocodes_pkey
 sondages_non_geocodes_code_key
 idx_sondages_non_geocodes_code
 idx_sondages_non_geocodes_commune
 idx_sondages_non_geocodes_date
 idx_sondages_non_geocodes_localite
 idx_mv_mailles_geotech_n_sondages
(9 rows)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "ALTER INDEX atlas.idx_sondages_geom RENAME TO idx_sondages_legacy_geom; ALTER INDEX atlas.idx_sondages_date RENAME TO idx_sondages_legacy_date;"
ALTER INDEX
ALTER INDEX
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "ALTER TABLE public.sondages SET SCHEMA atlas;"                                                                                            
ALTER TABLE
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT tablename FROM pg_tables WHERE schemaname = 'atlas' AND tablename IN ('echantillons','essais_atterberg','essais_classif','essais_geotechniques','essais_physiques','essais_potentiel_gonflement','essais_proctor','essais_vbs','granulo_points','sondages') ORDER BY tablename;"
 tablename 
-----------
 sondages
(1 row)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT schemaname, tablename FROM pg_tables WHERE tablename IN ('echantillons','essais_atterberg','essais_classif','essais_geotechniques','essais_physiques','essais_potentiel_gonflement','essais_proctor','essais_vbs','granulo_points') ORDER BY tablename;"
 schemaname |          tablename
------------+-----------------------------
 public     | echantillons
 public     | essais_atterberg
 public     | essais_classif
 public     | essais_geotechniques
 public     | essais_physiques
 public     | essais_potentiel_gonflement
 public     | essais_proctor
 public     | essais_vbs
 public     | granulo_points
(9 rows)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "BEGIN; ALTER TABLE public.echantillons SET SCHEMA atlas; ALTER TABLE public.essais_atterberg SET SCHEMA atlas; ALTER TABLE public.essais_classif SET SCHEMA atlas; ALTER TABLE public.essais_geotechniques SET SCHEMA atlas; ALTER TABLE public.essais_physiques SET SCHEMA atlas; ALTER TABLE public.essais_potentiel_gonflement SET SCHEMA atlas; ALTER TABLE public.essais_proctor SET SCHEMA atlas; ALTER TABLE public.essais_vbs SET SCHEMA atlas; ALTER TABLE public.granulo_points SET SCHEMA atlas; COMMIT;"
BEGIN
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
ALTER TABLE
COMMIT
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT tablename FROM pg_tables WHERE schemaname = 'atlas' AND tablename IN ('echantillons','essais_atterberg','essais_classif','essais_geotechniques','essais_physiques','essais_potentiel_gonflement','essais_proctor','essais_vbs','granulo_points','sondages') ORDER BY tablename;"                                                                                         
          tablename                                                                                                
-----------------------------
 echantillons
 essais_atterberg
 essais_classif
 essais_geotechniques
 essais_physiques
 essais_potentiel_gonflement
 essais_proctor
 essais_vbs
 granulo_points
 sondages
(10 rows)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "CREATE VIEW public.sondages AS SELECT * FROM atlas.sondages; CREATE VIEW public.echantillons AS SELECT * FROM atlas.echantillons; CREATE VIEW public.essais_atterberg AS SELECT * FROM atlas.essais_atterberg; CREATE VIEW public.essais_classif AS SELECT * FROM atlas.essais_classif; CREATE VIEW public.essais_geotechniques AS SELECT * FROM atlas.essais_geotechniques; CREATE VIEW public.essais_physiques AS SELECT * FROM atlas.essais_physiques; CREATE VIEW public.essais_potentiel_gonflement AS SELECT * FROM atlas.essais_potentiel_gonflement; CREATE VIEW public.essais_proctor AS SELECT * FROM atlas.essais_proctor; CREATE VIEW public.essais_vbs AS SELECT * FROM atlas.essais_vbs; CREATE VIEW public.granulo_points AS SELECT * FROM atlas.granulo_points;"
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
CREATE VIEW
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT table_name, table_type FROM information_schema.tables WHERE table_schema = 'public' AND table_name IN ('sondages','echantillons','essais_atterberg','essais_vbs') ORDER BY table_name;"                                                               
    table_name    | table_type                                                                                     
------------------+------------                                                                                    
 echantillons     | VIEW                                                                                           
 essais_atterberg | VIEW                                                                                           
 essais_vbs       | VIEW
 sondages         | VIEW
(4 rows)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT COUNT(*) as public_count FROM public.sondages; SELECT COUNT(*) as atlas_count FROM atlas.sondages;"                                
 public_count 
--------------
          123
(1 row)

 atlas_count
-------------
         123
(1 row)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose up -d api-geo ui                                                   
[+] Running 3/3
 ✔ Container atlas-db       Healthy                                                                           0.5s 
 ✔ Container atlas-api-geo  Started                                                                           0.3s 
 ✔ Container atlas-ui       Started                                                                           0.3s 
PS C:\PROJET_ATLAS_MASTER\atlas> curl -s http://localhost:8000/health
{"status":"degraded","database":{"connected":true,"tables_ok":false,"missing_tables":["atlas.staging_info","atlas.backups"]},"version":"0.1.0"}
PS C:\PROJET_ATLAS_MASTER\atlas> curl -s "http://localhost:8000/sondages?limit=3" | ConvertFrom-Json | ConvertTo-Json -Depth 3
[
  {
    "id": "fc087fbf-28c1-484a-872a-942f63836727",
    "code": "Wom├® Ville",
    "localite": "Wom├® Ville",
    "adm3_id": 365,
    "adm3_name": "Wome",
    "geom": {
      "coordinates": [
        0.542637356,
        6.830945365
      ],
      "type": "Point"
    },
    "location_mode": "adm_random_cell",
    "is_geocoded": true,
    "source": "AMESSEFE Komi Yoan Freddy",
    "created_at": "2025-11-18T22:37:02.333467Z",
    "updated_at": "2025-11-22T10:36:38.898309Z",
    "geocoded_mode": "adm3",
    "geocoded_score": null
  },
  {
    "id": "2bc3c2a6-b208-457c-98cc-acb2fe1551a7",
    "code": "Wom├® (Cascade)",
    "localite": "Wom├® (Cascade)",
    "adm3_id": 365,
    "adm3_name": "Wome",
    "geom": {
      "coordinates": [
        0.560860132,
        6.828173109
      ],
      "type": "Point"
    },
    "location_mode": "adm_random_cell",
    "is_geocoded": true,
    "source": "AMESSEFE Komi Yoan Freddy",
    "created_at": "2025-11-18T22:37:02.333467Z",
    "updated_at": "2025-11-22T10:42:34.782712Z",
    "geocoded_mode": "adm3",
    "geocoded_score": null
  },
  {
    "id": "9965bbcf-a9c3-4775-8ae3-69cdff18324c",
    "code": "Sanfatoute",
    "localite": "Sanfatoute",
    "adm3_id": 302,
    "adm3_name": "Sanfatoute",
    "geom": {
      "coordinates": [
        0.287470987,
        11.032770167
      ],
      "type": "Point"
    },
    "location_mode": "adm_random_cell",
    "is_geocoded": true,
    "source": "AMESSEFE Komi Yoan Freddy",
    "created_at": "2025-11-18T22:37:02.333467Z",
    "updated_at": "2025-11-22T10:49:34.405438Z",
    "geocoded_mode": "adm3",
    "geocoded_score": null
  }
]
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db pg_dump -U atlas atlas_clean > backup_apres_migration_rbac_geotech.sql
PS C:\PROJET_ATLAS_MASTER\atlas> git status                                                                        
On branch feat/ui-v3.3-geocode-details                                                                             
Your branch is ahead of 'origin/feat/ui-v3.3-geocode-details' by 8 commits.
  (use "git push" to publish your local commits)

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        backup_apres_migration_rbac_geotech.sql
        backup_avant_migration_rbac.sql
        docs/PROMPT_OUT.md

nothing added to commit but untracked files present (use "git add" to track)
PS C:\PROJET_ATLAS_MASTER\atlas> git status
On branch feat/ui-v3.3-geocode-details
Your branch is ahead of 'origin/feat/ui-v3.3-geocode-details' by 8 commits.
  (use "git push" to publish your local commits)

Untracked files:
  (use "git add <file>..." to include in what will be committed)
        backup_apres_migration_rbac_geotech.sql
        backup_avant_migration_rbac.sql
        docs/PROMPT_OUT.md
        docs/todo_colab.md

nothing added to commit but untracked files present (use "git add" to track)
PS C:\PROJET_ATLAS_MASTER\atlas> git add docs/todo_colab.md
warning: in the working copy of 'docs/todo_colab.md', CRLF will be replaced by LF the next time Git touches it
PS C:\PROJET_ATLAS_MASTER\atlas> git commit -m "docs: Ajout todo_colab.md - Roadmap Atlas Colab/Lab et suivi RBAC"
[feat/ui-v3.3-geocode-details 2577d9a] docs: Ajout todo_colab.md - Roadmap Atlas Colab/Lab et suivi RBAC
 1 file changed, 294 insertions(+)
 create mode 100644 docs/todo_colab.md
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT 'Tables RBAC' as category, COUNT(*) as count FROM pg_tables WHERE schemaname = 'atlas' AND tablename IN ('users','roles','permissions','user_roles','role_permissions','sessions') UNION ALL SELECT 'Tables Geotech', COUNT(*) FROM pg_tables WHERE schemaname = 'atlas' AND tablename IN ('sondages','echantillons','essais_atterberg','essais_vbs') UNION ALL SELECT 'Permissions', COUNT(*) FROM atlas.permissions UNION ALL SELECT 'Roles', COUNT(*) FROM atlas.roles UNION ALL SELECT 'Users', COUNT(*) FROM atlas.users;"
    category    | count 
----------------+-------
 Tables RBAC    |     6
 Tables Geotech |     4
 Permissions    |    39
 Roles          |     5
 Users          |     1
(5 rows)

PS C:\PROJET_ATLAS_MASTER\atlas> curl -s http://localhost:8000/users 2>&1                                          
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose logs --tail=50 api-geo 2>&1                                        
atlas-api-geo  | 2025-11-27T12:44:41.445715Z DEBUG request{method=GET uri=/healthz version=HTTP/1.1}: tower_http::trace::on_request: started processing request                                                                       
atlas-api-geo  | 2025-11-27T12:44:41.446223Z DEBUG request{method=GET uri=/healthz version=HTTP/1.1}: tower_http::trace::on_response: finished processing request latency=0 ms status=200                                             
atlas-api-geo  | 2025-11-27T12:45:04.969046Z DEBUG request{method=GET uri=/db/table/public/sondages/data?limit=100&offset=0 version=HTTP/1.1}: tower_http::trace::on_request: started processing request
atlas-api-geo  | 2025-11-27T12:45:04.969134Z DEBUG request{method=GET uri=/db/schema version=HTTP/1.1}: tower_http::trace::on_request: started processing request
atlas-api-geo  | 2025-11-27T12:45:04.969267Z DEBUG request{method=GET uri=/db/table/public/sondages version=HTTP/1.1}: tower_http::trace::on_request: started processing request
atlas-api-geo  | 2025-11-27T12:45:05.105956Z DEBUG request{method=GET uri=/db/table/public/sondages version=HTTP/1.1}: tower_http::trace::on_response: finished processing request latency=136 ms status=200
atlas-api-geo  | 2025-11-27T12:45:05.118531Z DEBUG request{method=GET uri=/db/table/public/sondages version=HTTP/1.1}: tower_http::trace::on_request: started processing request
atlas-api-geo  | 2025-11-27T12:45:05.151363Z DEBUG request{method=GET uri=/db/table/public/sondages version=HTTP/1.1}: tower_http::trace::on_response: finished 3512e87b7b8060749c8f1627db6beac4453e6506872a             0.0s 
 => => exporting config sha256:2475c597eabbb5479d2e3f662915841103e16baf9ae3d9403a086254181b5728               0.0s 
 => => exporting attestation manifest sha256:302604927f21b9a29c98616370f9176b7c32fa1eb6717caeaa6846a7d25b3db  0.0s 
 => => exporting manifest list sha256:8454e40e2b4f1e1767307e0ee1bf74cce69a7f3759893a860709668812584df3        0.0s 
 => => naming to docker.io/library/atlas-api-geo:latest                                                       0.0s 
 => => unpacking to docker.io/library/atlas-api-geo:latest                                                    0.1s 
 => resolving provenance for metadata file                                                                    0.0s 
[+] Building 1/1
 ✔ atlas-api-geo  Built                                                                                       0.0s 
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose up -d api-geo
[+] Running 2/2
 ✔ Container atlas-db       Healthy                                                                           2.2s 
 ✔ Container atlas-api-geo  Started                                                                           2.5s 
PS C:\PROJET_ATLAS_MASTER\atlas> Start-Sleep -Seconds 3; curl -s http://localhost:8000/users 2>&1   
{"error":"Token manquant","error_code":"MISSING_TOKEN"}
PS C:\PROJET_ATLAS_MASTER\atlas> curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@atlas.local\",\"password\":\"admin123\"}' 2>&1
Missing request extension: Extension of type `axum::extract::connect_info::ConnectInfo<core::net::socket_addr::SocketAddr>` was not found. Perhaps you forgot to add it? See `axum::Extension`.
PS C:\PROJET_ATLAS_MASTER\atlas> cd 'c:\PROJET_ATLAS_MASTER\atlas\services\api-geo'                                
PS C:\PROJET_ATLAS_MASTER\atlas\services\api-geo> cargo check 2>&1 | Select-Object -First 50        
   Compiling api-geo v0.1.0 (C:\PROJET_ATLAS_MASTER\atlas\services\api-geo)
warning: unused imports: `IntoResponse`, `Json`, `StatusCode`, and `body::Body`
 --> src\auth\middleware.rs:3:5
  |
3 |     body::Body,
  |     ^^^^^^^^^^
4 |     extract::{Request, State},
5 |     http::{header::AUTHORIZATION, StatusCode},
  |                                   ^^^^^^^^^^
.toml ./                                                                   0.0s 
 => CACHED [builder 5/8] RUN mkdir -p src && echo "fn main(){}" > src/main.rs                                 0.0s 
 => CACHED [builder 6/8] RUN --mount=type=cache,target=/usr/local/cargo/registry     --mount=type=cache,targ  0.0s 
 => [builder 7/8] COPY . .                                                                                    0.1s 
 => [builder 8/8] RUN --mount=type=cache,target=/usr/local/cargo/registry     cargo build --release         135.2s 
 => CACHED [stage-1 2/4] RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates cu  0.0s 
 => CACHED [stage-1 3/4] WORKDIR /app                                                                         0.0s 
 => [stage-1 4/4] COPY --from=builder /app/target/release/api-geo /usr/local/bin/api-geo                      0.1s 
 => exporting to image                                                                                        0.9s 
 => => exporting layers                                                                                       0.7s 
 => => exporting manifest sha256:212e335aa343bac36ca9cb8b992fbd1beac068c5af1f7c02290d84fb055208c0             0.0s 
 => => exporting config sha256:2069497fc7fed232cc4d6ab91e12d419d833604c07a8930d020a16bc80e31580               0.0s 
 => => exporting attestation manifest sha256:f04d351638572d3a0a22113597d5eab5a0a0185b61977f991e1af8bf36afd71  0.0s 
 => => exporting manifest list sha256:0b48af02f1ed96ece8cc9a8c4ca36352e46a8fdecdd08ba6bb15b76315b35b57        0.0s 
 => => naming to docker.io/library/atlas-api-geo:latest                                                       0.0s 
 => => unpacking to docker.io/library/atlas-api-geo:latest                                                    0.1s 
 => resolving provenance for metadata file                                                                    0.0s 
[+] Building 1/1
 ✔ atlas-api-geo  Built                                                                                       0.0s 
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose up -d api-geo
[+] Running 2/2
 ✔ Container atlas-db       Healthy                                                                           2.1s 
 ✔ Container atlas-api-geo  Started                                                                           2.4s 
PS C:\PROJET_ATLAS_MASTER\atlas> Start-Sleep -Seconds 3; curl -s -X POST http://localhost:8000/auth/login -H "Content-Type: application/json" -d '{\"email\":\"admin@atlas.local\",\"password\":\"admin123\"}' 2>&1
Failed to parse the request body as JSON: key must be a string at line 1 column 2
PS C:\PROJET_ATLAS_MASTER\atlas> $body = '{"email":"admin@atlas.local","password":"admin123"}'; Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body $body
Invoke-RestMethod:                                                                                                 
{
  "error": "Identifiants invalides",
  "error_code": "INVALID_CREDENTIALS"
}
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT password_hash FROM atlas.users WHERE email = 'admin@atlas.local';"                                                                 
                                password_hash                                                                      
-----------------------------------------------------------------------------                                      
 $argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQ$RdescudvJCsgt3ub+b+dWRWJTmaaJObG                                       
(1 row)

PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "UPDATE atlas.users SET password_hash = '\$argon2id\$v=19\$m=65536,t=3,p=4\$YWRtaW5zYWx0MTIzNA\$7Hy8JNj8ZkZvKxNxLxNxLxNxLxNxLxNxLxNxLxNxLxM' WHERE email = 'admin@atlas.local';"
UPDATE 1
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c ency=1 ms status=200
atlas-api-geo  | 2025-11-27T12:59:00.283030Z DEBUG request{method=GET uri=/healthz version=HTTP/1.1}: tower_http::trace::on_request: started processing request
atlas-api-geo  | 2025-11-27T12:59:00.283872Z DEBUG request{method=GET uri=/healthz version=HTTP/1.1}: tower_http::trace::on_response: finished processing request latency=0 ms status=200
PS C:\PROJET_ATLAS_MASTER\atlas> cd services/api-geo; cargo run --example generate_hash 2>&1 | Select-Object -First
 10
error: no example target named `generate_hash` in default-run packages
PS C:\PROJET_ATLAS_MASTER\atlas\services\api-geo> 

PS C:\PROJET_ATLAS_MASTER\atlas\services\api-geo> cd 'c:\PROJET_ATLAS_MASTER\atlas'     
PS C:\PROJET_ATLAS_MASTER\atlas> ^C
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "UPDATE atlas.users SET password_hash = '\$argon2id\$v=19\$m=65536,t=3,p=4\$Yhd1HdqszX1GzJXqFjXtQA\$saz+B+dQhWsVOLUvxtZINv9DIBjO39W2BekUOOnlitM' WHERE email = 'admin@atlas.local';"
UPDATE 1
PS C:\PROJET_ATLAS_MASTER\atlas> $body = '{"email":"admin@atlas.local","password":"Atlas2024!"}'; Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body $body
Invoke-RestMethod:                                                                                                 
{
  "error": "Erreur interne: Invalid hash format: password hash string missing field",
  "error_code": "INTERNAL_ERROR"
}
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT password_hash FROM atlas.users WHERE email = 'admin@atlas.local';"
                         password_hash
----------------------------------------------------------------
 \\=19\=65536,t=3,p=4\\+B+dQhWsVOLUvxtZINv9DIBjO39W2BekUOOnlitM
(1 row)

PS C:\PROJET_ATLAS_MASTER\atlas> echo "UPDATE atlas.users SET password_hash = E'\$argon2id\$v=19\$m=65536,t=3,p=4\$Yhd1HdqszX1GzJXqFjXtQA\$saz+B+dQhWsVOLUvxtZINv9DIBjO39W2BekUOOnlitM' WHERE email = 'admin@atlas.local';" | docker-compose exec -T db psql -U atlas -d atlas_clean
UPDATE 1
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT password_hash FROM atlas.users WHERE email = 'admin@atlas.local';"
                        password_hash
-------------------------------------------------------------
 \=19=65536,t=3,p=4\+B+dQhWsVOLUvxtZINv9DIBjO39W2BekUOOnlitM
(1 row)

PS C:\PROJET_ATLAS_MASTER\atlas> Get-Content update_admin_password.sql | docker-compose exec -T db psql -U atlas -d atlas_clean
UPDATE 1
PS C:\PROJET_ATLAS_MASTER\atlas> docker-compose exec -T db psql -U atlas -d atlas_clean -c "SELECT password_hash FROM atlas.users WHERE email = 'admin@atlas.local';"
                                           password_hash
---------------------------------------------------------------------------------------------------
 $argon2id$v=19$m=65536,t=3,p=4$Yhd1HdqszX1GzJXqFjXtQA$saz+B+dQhWsVOLUvxtZINv9DIBjO39W2BekUOOnlitM
(1 row)

PS C:\PROJET_ATLAS_MASTER\atlas> $body = '{"email":"admin@atlas.local","password":"Atlas2024!"}'; Invoke-RestMethod -Uri "http://localhost:8000/auth/login" -Method POST -ContentType "application/json" -Body $body | ConvertTo-Json
{
  "access_token": "eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9.eyJzdWIiOiIwMDAwMDAwMC0wMDAwLTAwMDAtMDAwMC0wMDAwMDAwMDAwMDEiLCJlbWFpbCI6ImFkbWluQGF0bGFzLmxvY2FsIiwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGVzIjpbImFkbWluIl0sInBlcm1pc3Npb25zIjpbImF1ZGl0LmV4cG9ydCIsImF1ZGl0LnJlYWQiLCJiYWNrdXAuY3JlYXRlIiwiYmFja3VwLmRlbGV0ZSIsImJhY2t1cC5saXN0IiwiYmFja3VwLnJlc3RvcmUiLCJleHBvcnQuZXhlY3V0ZSIsImdlb2NvZGluZy5hcHByb3ZlIiwiZ2VvY29kaW5nLmV4ZWN1dGUiLCJnZW9jb2RpbmcucmVhZCIsImltcG9ydC5leGVjdXRlIiwicm9sZXMuYXNzaWduIiwicm9sZXMuY3JlYXRlIiwicm9sZXMuZGVsZXRlIiwicm9sZXMubWFuYWdlIiwicm9sZXMucmVhZCIsInJvbGVzLnVwZGF0ZSIsInNjaGVtYS5kcm9wIiwic2NoZW1hLm1vZGlmeSIsInNjaGVtYS5yZWFkIiwic3RhZ2luZy5jYW5jZWwiLCJzdGFnaW5nLmNvbW1pdCIsInN0YWdpbmcuY3JlYXRlIiwic3RhZ2luZy5wcmV2aWV3Iiwic3lzdGVtLmFkbWluIiwic3lzdGVtLmxvZ3MiLCJzeXN0ZW0ubWV0cmljcyIsInRhYmxlcy5jcmVhdGUiLCJ0YWJsZXMuZGVsZXRlIiwidGFibGVzLnJlYWQiLCJ0YWJsZXMud3JpdGUiLCJ0aGVtYXRpYy5jcmVhdGUiLCJ0aGVtYXRpYy5kZWxldGUiLCJ0aGVtYXRpYy5yZWFkIiwidXNlcnMuY3JlYXRlIiwidXNlcnMuZGVsZXRlIiwidXNlcnMubWFuYWdlIiwidXNlcnMucmVhZCIsInVzZXJzLnVwZGF0ZSJdLCJzaWQiOiI5ZGU1NzEyYS0yYjE3LTRjMGUtYjhjMC1iZTg3NTI2YWM0NTkiLCJpYXQiOjE3NjQyNDg1MTMsImV4cCI6MTc2NDI1MjExMywibmJmIjoxNzY0MjQ4NTEzLCJpc3MiOiJhdGxhcy1hcGkiLCJhdWQiOiJhdGxhcy11aSIsImp0aSI6IjI1MDYyN2VlLWY0Y2UtNDkzMS04NzhjLTI2Nzc5ZTg1ZmRkMiJ9.cVcmHGXo_mrChEMzLIZrU08HNILtc_EDzaKo8x9KGDg",
  "refresh_token": "i27Icfe0oKS9U_yy7alJXJlYxT7RU58Pj0Rsz8lClrA",
  "token_type": "Bearer",
  "expires_in": 3600,
  "user": {
    "id": "00000000-0000-0000-0000-000000000001",
    "email": "admin@atlas.local",
    "username": "admin",
    "first_name": "System",
    "last_name": "Administrator",
    "avatar_url": null,
    "roles": [
      "admin"
    ],
    "permissions": [
      "audit.export",
      "audit.read",
      "backup.create",
      "backup.delete",
      "backup.list",
      "backup.restore",
      "export.execute",
      "geocoding.approve",
      "geocoding.execute",
      "geocoding.read",
      "import.execute",
      "roles.assign",
      "roles.create",
      "roles.delete",
      "roles.manage",
      "roles.read",
      "roles.update",
      "schema.drop",
      "schema.modify",
      "schema.read",
      "staging.cancel",
      "staging.commit",
      "staging.create",
      "staging.preview",
      "system.admin",
      "system.logs",
      "system.metrics",
      "tables.create",
      "tables.delete",
      "tables.read",
      "tables.write",
      "thematic.create",
      "thematic.delete",
      "thematic.read",
      "users.create",
      "users.delete",
      "users.manage",
      "users.read",
      "users.update"
    ]
  }
}
PS C:\PROJET_ATLAS_MASTER\atlas> 