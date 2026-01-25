-- Script généré automatiquement depuis atlas_export.xlsx
-- Date: 2025-11-07 09:28:23


-- Table: atlas.geocode_suggestions
CREATE TABLE IF NOT EXISTS atlas.geocode_suggestions (
    "id" TEXT,
    "sondage_id" TEXT,
    "reason" TEXT,
    "status" TEXT,
    "payload" TEXT,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);


-- Table: adm0_raw
CREATE TABLE IF NOT EXISTS adm0_raw (
    "gid" INTEGER,
    "shape_leng" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "adm0_fr" TEXT,
    "adm0_pcode" TEXT,
    "adm0_ref" DOUBLE PRECISION,
    "date" TIMESTAMP,
    "validon" TIMESTAMP,
    "validto" DOUBLE PRECISION,
    "geom" TEXT
);


-- Table: adm1
CREATE TABLE IF NOT EXISTS adm1 (
    "gid" INTEGER,
    "shape_leng" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "adm1_fr" TEXT,
    "adm1_pcode" TEXT,
    "adm1_ref" DOUBLE PRECISION,
    "adm1alt1fr" DOUBLE PRECISION,
    "adm1alt2fr" DOUBLE PRECISION,
    "adm0_fr" TEXT,
    "adm0_pcode" TEXT,
    "date" TIMESTAMP,
    "validon" TIMESTAMP,
    "validto" DOUBLE PRECISION,
    "geom" TEXT
);


-- Table: adm1_tg
CREATE TABLE IF NOT EXISTS adm1_tg (
    "id" TEXT,
    "code" TEXT,
    "name" TEXT,
    "geom" TEXT,
    "bbox" TEXT,
    "created_at" TIMESTAMP
);


-- Table: adm2
CREATE TABLE IF NOT EXISTS adm2 (
    "gid" INTEGER,
    "shape_leng" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "adm2_fr" TEXT,
    "adm2_pcode" TEXT,
    "adm2_ref" DOUBLE PRECISION,
    "adm2alt1fr" DOUBLE PRECISION,
    "adm2alt2fr" DOUBLE PRECISION,
    "adm1_fr" TEXT,
    "adm1_pcode" TEXT,
    "adm0_fr" TEXT,
    "adm0_pcode" TEXT,
    "date" TIMESTAMP,
    "validon" TIMESTAMP,
    "validto" DOUBLE PRECISION,
    "geom" TEXT
);


-- Table: adm2_tg
CREATE TABLE IF NOT EXISTS adm2_tg (
    "id" TEXT,
    "code" TEXT,
    "name" TEXT,
    "adm1_name" TEXT,
    "geom" TEXT,
    "bbox" TEXT,
    "created_at" TIMESTAMP
);


-- Table: adm3
CREATE TABLE IF NOT EXISTS adm3 (
    "gid" INTEGER,
    "shape_leng" DOUBLE PRECISION,
    "shape_area" DOUBLE PRECISION,
    "adm3_fr" TEXT,
    "adm3_pcode" TEXT,
    "adm3_ref" DOUBLE PRECISION,
    "adm3alt1fr" DOUBLE PRECISION,
    "adm3alt2fr" DOUBLE PRECISION,
    "adm2_fr" TEXT,
    "adm2_pcode" TEXT,
    "adm1_fr" TEXT,
    "adm1_pcode" TEXT,
    "adm0_fr" TEXT,
    "adm0_pcode" TEXT,
    "date" TIMESTAMP,
    "validon" TIMESTAMP,
    "validto" DOUBLE PRECISION,
    "geom" TEXT
);


-- Table: adm3_synonyms
CREATE TABLE IF NOT EXISTS adm3_synonyms (
    "alias_norm" TEXT,
    "adm3_code" TEXT
);


-- Table: adm3_tg
CREATE TABLE IF NOT EXISTS adm3_tg (
    "id" TEXT,
    "code" TEXT,
    "name" TEXT,
    "adm1_name" TEXT,
    "adm2_name" TEXT,
    "geom" TEXT,
    "bbox" TEXT,
    "created_at" TIMESTAMP
);


-- Table: audit_log
CREATE TABLE IF NOT EXISTS audit_log (
    "id" TEXT,
    "ts" TIMESTAMP,
    "action" TEXT,
    "entity" TEXT,
    "entity_id" TEXT,
    "payload" TEXT,
    "user_id" TEXT,
    "location_mode" TEXT
);


-- Table: country_tg
CREATE TABLE IF NOT EXISTS country_tg (
    "id" INTEGER,
    "name" TEXT,
    "geom" TEXT,
    "created_at" TIMESTAMP
);


-- Table: echantillons
CREATE TABLE IF NOT EXISTS echantillons (
    "id" TEXT,
    "sondage_id" TEXT,
    "depth_m" DOUBLE PRECISION,
    "date" DOUBLE PRECISION,
    "laboratory" DOUBLE PRECISION,
    "norm" DOUBLE PRECISION,
    "rho_s_gcm3" DOUBLE PRECISION,
    "water_content_w" DOUBLE PRECISION,
    "is_index" DOUBLE PRECISION,
    "eg" DOUBLE PRECISION,
    "meta" TEXT,
    "created_at" TIMESTAMP,
    "updated_at" DOUBLE PRECISION
);


-- Table: essais_atterberg
CREATE TABLE IF NOT EXISTS essais_atterberg (
    "id" TEXT,
    "echantillon_id" TEXT,
    "wl" DOUBLE PRECISION,
    "wp" DOUBLE PRECISION,
    "ip_generated" DOUBLE PRECISION,
    "meta" TEXT,
    "created_at" TIMESTAMP
);


-- Table: essais_classif
CREATE TABLE IF NOT EXISTS essais_classif (
    "id" TEXT,
    "essai_id" TEXT,
    "systeme" TEXT,
    "classe" TEXT,
    "reason" DOUBLE PRECISION,
    "version" DOUBLE PRECISION,
    "computed" BOOLEAN,
    "source" DOUBLE PRECISION,
    "meta" TEXT,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,
    "created_by" DOUBLE PRECISION,
    "updated_by" DOUBLE PRECISION,
    "created_by_batch" DOUBLE PRECISION,
    "updated_by_batch" DOUBLE PRECISION,
    "deleted_by_batch" DOUBLE PRECISION,
    "deleted_at" DOUBLE PRECISION
);


-- Table: essais_geotechniques
CREATE TABLE IF NOT EXISTS essais_geotechniques (
    "id" TEXT,
    "sondage_id" TEXT,
    "depth_m" DOUBLE PRECISION,
    "passant_80um" DOUBLE PRECISION,
    "passant_2mm" DOUBLE PRECISION,
    "passant_20mm" DOUBLE PRECISION,
    "wl" DOUBLE PRECISION,
    "wp" DOUBLE PRECISION,
    "ip" DOUBLE PRECISION,
    "vbs" DOUBLE PRECISION,
    "gamma_d_max" DOUBLE PRECISION,
    "w_opt" DOUBLE PRECISION,
    "proctor_type" DOUBLE PRECISION,
    "eg" DOUBLE PRECISION,
    "test_date" DOUBLE PRECISION,
    "laboratory" DOUBLE PRECISION,
    "norm" DOUBLE PRECISION,
    "meta" TEXT,
    "created_at" TIMESTAMP,
    "created_by" DOUBLE PRECISION,
    "updated_at" DOUBLE PRECISION,
    "updated_by" DOUBLE PRECISION,
    "created_by_batch" DOUBLE PRECISION,
    "updated_by_batch" DOUBLE PRECISION,
    "deleted_by_batch" DOUBLE PRECISION,
    "deleted_at" DOUBLE PRECISION
);


-- Table: essais_physiques
CREATE TABLE IF NOT EXISTS essais_physiques (
    "id" TEXT,
    "essai_id" TEXT,
    "densite_apparente_gcm3" DOUBLE PRECISION,
    "densite_absolue_gcm3" DOUBLE PRECISION,
    "teneur_eau_pct" DOUBLE PRECISION,
    "source" DOUBLE PRECISION,
    "measured_at" DOUBLE PRECISION,
    "meta" TEXT,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,
    "created_by" DOUBLE PRECISION,
    "updated_by" DOUBLE PRECISION,
    "created_by_batch" DOUBLE PRECISION,
    "updated_by_batch" DOUBLE PRECISION,
    "deleted_by_batch" DOUBLE PRECISION,
    "deleted_at" DOUBLE PRECISION
);


-- Table: essais_vbs
CREATE TABLE IF NOT EXISTS essais_vbs (
    "id" TEXT,
    "echantillon_id" TEXT,
    "vbs" DOUBLE PRECISION,
    "commentaire" TEXT,
    "meta" TEXT,
    "created_at" TIMESTAMP
);


-- Table: geocode_suggestions
CREATE TABLE IF NOT EXISTS geocode_suggestions (
    "id" INTEGER,
    "entity" TEXT,
    "entity_id" TEXT,
    "localite" TEXT,
    "adm2_code" DOUBLE PRECISION,
    "candidates" TEXT,
    "top_code" TEXT,
    "top_score" DOUBLE PRECISION,
    "top_method" TEXT,
    "status" TEXT,
    "created_at" TIMESTAMP,
    "decided_at" DOUBLE PRECISION
);


-- Table: granulo_points
CREATE TABLE IF NOT EXISTS granulo_points (
    "id" TEXT,
    "echantillon_id" TEXT,
    "method" TEXT,
    "sieve_mm" INTEGER,
    "passing_pct" DOUBLE PRECISION,
    "meta" TEXT,
    "created_at" TIMESTAMP
);


-- Table: granulometrie_points
CREATE TABLE IF NOT EXISTS granulometrie_points (
    "id" TEXT,
    "essai_id" TEXT,
    "sieve_mm" DOUBLE PRECISION,
    "percent_passing" DOUBLE PRECISION,
    "created_at" TIMESTAMP,
    "methode" TEXT,
    "meta" TEXT,
    "created_by_batch" TEXT,
    "deleted_by_batch" DOUBLE PRECISION,
    "deleted_at" DOUBLE PRECISION
);


-- Table: grid
CREATE TABLE IF NOT EXISTS grid (
    "id" TEXT,
    "code" TEXT,
    "geom" TEXT,
    "adm1_name" TEXT,
    "adm2_name" DOUBLE PRECISION,
    "adm3_name" DOUBLE PRECISION,
    "created_at" TIMESTAMP,
    "updated_at" DOUBLE PRECISION,
    "deleted_at" DOUBLE PRECISION,
    "geom_4326" TEXT
);


-- Table: mailles
CREATE TABLE IF NOT EXISTS mailles (
    "id" TEXT,
    "geom" TEXT,
    "code" TEXT,
    "stats" TEXT,
    "updated_at" TIMESTAMP,
    "adm1_code" TEXT,
    "adm1_name" TEXT,
    "adm2_code" TEXT,
    "adm2_name" TEXT,
    "adm3_code" TEXT,
    "adm3_name" TEXT,
    "geom_4326" TEXT
);


-- Table: raw_lab_ags
CREATE TABLE IF NOT EXISTS raw_lab_ags (
    "id" INTEGER,
    "code_site" TEXT,
    "depth_m" INTEGER,
    "sieve_mm" DOUBLE PRECISION,
    "passants_pct" DOUBLE PRECISION,
    "echantillon_id" TEXT,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);


-- Table: raw_lab_agt
CREATE TABLE IF NOT EXISTS raw_lab_agt (
    "id" INTEGER,
    "code_site" TEXT,
    "depth_m" INTEGER,
    "sieve_mm" DOUBLE PRECISION,
    "mass_refus_cum_g" DOUBLE PRECISION,
    "refus_cum_pct" DOUBLE PRECISION,
    "passants_pct" DOUBLE PRECISION,
    "echantillon_id" TEXT,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP
);


-- Table: raw_lab_atterberg
CREATE TABLE IF NOT EXISTS raw_lab_atterberg (
    "id" INTEGER,
    "code_site" TEXT,
    "depth_m" DOUBLE PRECISION,
    "test_type" TEXT,
    "tare_no" INTEGER,
    "nb_coups" INTEGER,
    "poids_total_humide_g" DOUBLE PRECISION,
    "poids_total_sec_g" DOUBLE PRECISION,
    "poids_tare_g" INTEGER,
    "poids_eau_g" DOUBLE PRECISION,
    "poids_sol_sec_g" DOUBLE PRECISION,
    "teneur_eau_pct" DOUBLE PRECISION,
    "echantillon_id" TEXT,
    "created_at" TIMESTAMP
);


-- Table: ref_types_essais
CREATE TABLE IF NOT EXISTS ref_types_essais (
    "code" TEXT,
    "nom_fr" TEXT,
    "nom_en" TEXT,
    "categorie" TEXT,
    "unite_defaut" TEXT,
    "description" DOUBLE PRECISION,
    "ordre_affichage" INTEGER
);


-- Table: refresh_queue
CREATE TABLE IF NOT EXISTS refresh_queue (
    "id" INTEGER,
    "object" TEXT,
    "reason" TEXT,
    "created_at" TIMESTAMP
);


-- Table: sondages
CREATE TABLE IF NOT EXISTS sondages (
    "id" TEXT,
    "geom" DOUBLE PRECISION,
    "date_sondage" DOUBLE PRECISION,
    "source" TEXT,
    "meta" TEXT,
    "code" TEXT,
    "depth_m_min" DOUBLE PRECISION,
    "depth_m_max" DOUBLE PRECISION,
    "maille_code" DOUBLE PRECISION,
    "adm1_name" TEXT,
    "adm2_name" TEXT,
    "adm3_name" TEXT,
    "comment" DOUBLE PRECISION,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,
    "deleted_at" DOUBLE PRECISION,
    "location_accuracy" TEXT,
    "is_geocoded" BOOLEAN,
    "date" DOUBLE PRECISION,
    "operator" DOUBLE PRECISION,
    "notes" DOUBLE PRECISION,
    "type_sol" DOUBLE PRECISION,
    "location_mode" TEXT,
    "adm1_id" DOUBLE PRECISION,
    "adm2_id" DOUBLE PRECISION,
    "adm3_id" DOUBLE PRECISION,
    "import_id" DOUBLE PRECISION,
    "import_row_idx" DOUBLE PRECISION,
    "loc_mode" TEXT,
    "geom_real" DOUBLE PRECISION,
    "created_by_batch" TEXT,
    "updated_by_batch" DOUBLE PRECISION,
    "deleted_by_batch" DOUBLE PRECISION,
    "grid_code" DOUBLE PRECISION,
    "localite_base" TEXT,
    "localite_key" TEXT
);


-- Table: spatial_ref_sys
CREATE TABLE IF NOT EXISTS spatial_ref_sys (
    "srid" INTEGER,
    "auth_name" TEXT,
    "auth_srid" INTEGER,
    "srtext" TEXT,
    "proj4text" TEXT
);


-- Table: thematic_configs
CREATE TABLE IF NOT EXISTS thematic_configs (
    "id" TEXT,
    "name" TEXT,
    "description" TEXT,
    "map_type" TEXT,
    "parameter" TEXT,
    "config" TEXT,
    "is_public" BOOLEAN,
    "created_by" DOUBLE PRECISION,
    "created_at" TIMESTAMP,
    "updated_at" TIMESTAMP,
    "usage_count" INTEGER,
    "last_used_at" DOUBLE PRECISION
);
