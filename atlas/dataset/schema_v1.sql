--
-- PostgreSQL database dump
--

\restrict sNu6ii7Q1JN2eJotES1BPvnUTFgmIPHMpfpxjGQWYL6Gs2F6t36QKnnIkMseSAv

-- Dumped from database version 17.0 (Debian 17.0-1.pgdg110+1)
-- Dumped by pg_dump version 17.8

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: atlas; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA atlas;


--
-- Name: atlas_ref; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA atlas_ref;


--
-- Name: SCHEMA atlas_ref; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA atlas_ref IS 'Donn├®es SIG de r├®f├®rence (routes, localit├®s, b├ótiments, hydro, admin)';


--
-- Name: atlas_terrain; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA atlas_terrain;


--
-- Name: SCHEMA atlas_terrain; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA atlas_terrain IS 'Corrections et ajouts terrain par les ├®tudiants';


--
-- Name: backup_20251110_192106_30ee61cb; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_192106_30ee61cb;


--
-- Name: backup_20251110_192111_6af88d05; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_192111_6af88d05;


--
-- Name: backup_20251110_192300_6add4eb4; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_192300_6add4eb4;


--
-- Name: backup_20251110_192305_fd008851; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_192305_fd008851;


--
-- Name: backup_20251110_195740_850c25c5; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_195740_850c25c5;


--
-- Name: backup_20251110_195744_31aea478; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_195744_31aea478;


--
-- Name: backup_20251110_222340_00ac3108; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_222340_00ac3108;


--
-- Name: backup_20251110_222340_28691973; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251110_222340_28691973;


--
-- Name: backup_20251112_165929_e990d5b5; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251112_165929_e990d5b5;


--
-- Name: backup_20251112_171741_824fb26f; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251112_171741_824fb26f;


--
-- Name: backup_20251112_172458_cf91b22c; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251112_172458_cf91b22c;


--
-- Name: backup_20251112_214033_a5411aae; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251112_214033_a5411aae;


--
-- Name: backup_20251113_082309_b95c64f6; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251113_082309_b95c64f6;


--
-- Name: backup_20251113_091240_d773a7a4; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251113_091240_d773a7a4;


--
-- Name: backup_20251113_122108_3fdb8b95; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251113_122108_3fdb8b95;


--
-- Name: backup_20251114_075857_91c7dabf; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA backup_20251114_075857_91c7dabf;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS '';


--
-- Name: topology; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA topology;


--
-- Name: SCHEMA topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA topology IS 'PostGIS Topology schema';


--
-- Name: pg_trgm; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;


--
-- Name: EXTENSION pg_trgm; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION pg_trgm IS 'text similarity measurement and index searching based on trigrams';


--
-- Name: postgis; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis WITH SCHEMA public;


--
-- Name: EXTENSION postgis; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis IS 'PostGIS geometry and geography spatial types and functions';


--
-- Name: postgis_raster; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_raster WITH SCHEMA public;


--
-- Name: EXTENSION postgis_raster; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_raster IS 'PostGIS raster types and functions';


--
-- Name: postgis_topology; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS postgis_topology WITH SCHEMA topology;


--
-- Name: EXTENSION postgis_topology; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION postgis_topology IS 'PostGIS topology spatial types and functions';


--
-- Name: unaccent; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA atlas;


--
-- Name: EXTENSION unaccent; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION unaccent IS 'text search dictionary that removes accents';


--
-- Name: uuid-ossp; Type: EXTENSION; Schema: -; Owner: -
--

CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA public;


--
-- Name: EXTENSION "uuid-ossp"; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON EXTENSION "uuid-ossp" IS 'generate universally unique identifiers (UUIDs)';


--
-- Name: analyse_qualitative_enum; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.analyse_qualitative_enum AS ENUM (
    'Faible',
    'Moyen',
    'Moyenne',
    'Fort',
    'Forte',
    'Très forte',
    'Elevé',
    'Très élevé',
    'Non gonflant',
    'Gonflant',
    'Peu gonflant',
    'Moyennement gonflant',
    'Très gonflant'
);


--
-- Name: comment_entity_type; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.comment_entity_type AS ENUM (
    'mission',
    'sondage',
    'essai',
    'document'
);


--
-- Name: document_type; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.document_type AS ENUM (
    'rapport_intermediaire',
    'rapport_final',
    'fiche_terrain',
    'annexe',
    'photo',
    'plan',
    'coupe_geologique',
    'resultats_essais',
    'autre'
);


--
-- Name: field_log_type; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.field_log_type AS ENUM (
    'note',
    'incident',
    'meteo',
    'avancee',
    'observation',
    'probleme',
    'decision'
);


--
-- Name: location_mode; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.location_mode AS ENUM (
    'unknown',
    'exact',
    'adm'
);


--
-- Name: methode_classification_enum; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.methode_classification_enum AS ENUM (
    'CHASSAGNEUX D. et al. ;1996',
    'Dakshanamurthy et Raman (1973)',
    'SEED H. (1962)',
    'VIJAYVERGIYA et GHAZZALY 1973',
    'Williams et Donaldson (1980)',
    'Chen (1988)',
    'Autre'
);


--
-- Name: mission_status; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.mission_status AS ENUM (
    'draft',
    'planned',
    'in_progress',
    'completed',
    'cancelled',
    'suspended'
);


--
-- Name: mission_theme; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.mission_theme AS ENUM (
    'stabilisation',
    'synthese',
    'reconnaissance',
    'etude_detaillee',
    'controle'
);


--
-- Name: notification_type; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.notification_type AS ENUM (
    'comment_mention',
    'comment_reply',
    'comment_entity',
    'status_change',
    'mission_assigned',
    'sondage_validated',
    'document_uploaded',
    'deadline_reminder'
);


--
-- Name: sondage_validation_status; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.sondage_validation_status AS ENUM (
    'draft_field',
    'pending_sync',
    'synced',
    'to_validate_lab',
    'validated',
    'integrated',
    'rejected'
);


--
-- Name: type_sol_enum; Type: TYPE; Schema: atlas; Owner: -
--

CREATE TYPE atlas.type_sol_enum AS ENUM (
    'Vertisols et Paravertisols',
    'Ferrugineux Tropicaux et Pseudogley',
    'Hydromorphes',
    'Faiblement Ferralitique',
    'Ferralitique Typique ou Modaux',
    'Ferrugineux Tropicaux Lessivés',
    'Autre'
);


--
-- Name: cleanup_expired_locks(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.cleanup_expired_locks() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    DELETE FROM atlas.staging_locks
    WHERE expires_at < now();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_expired_sessions(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.cleanup_expired_sessions() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    deleted_count INTEGER;
BEGIN
    UPDATE atlas.sessions
    SET is_active = FALSE, revoked_at = NOW(), revoked_reason = 'expired'
    WHERE is_active = TRUE AND expires_at < NOW();
    
    GET DIAGNOSTICS deleted_count = ROW_COUNT;
    RETURN deleted_count;
END;
$$;


--
-- Name: cleanup_old_backups(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.cleanup_old_backups() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    backup_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    FOR backup_record IN 
        SELECT backup_id, backup_schema
        FROM atlas.backup_metadata
        WHERE created_at < NOW() - INTERVAL '7 days'
    LOOP
        -- Supprimer le schéma de backup
        EXECUTE format('DROP SCHEMA IF EXISTS %I CASCADE', 
            backup_record.backup_schema);
        
        -- Supprimer les métadonnées
        DELETE FROM atlas.backup_metadata 
        WHERE backup_id = backup_record.backup_id;
        
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_backups(); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.cleanup_old_backups() IS 'Nettoie les backups de plus de 7 jours';


--
-- Name: cleanup_old_staging(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.cleanup_old_staging() RETURNS integer
    LANGUAGE plpgsql
    AS $$
DECLARE
    staging_record RECORD;
    deleted_count INTEGER := 0;
BEGIN
    FOR staging_record IN 
        SELECT staging_id, schema_name, staging_table_name
        FROM atlas.staging_metadata
        WHERE created_at < NOW() - INTERVAL '24 hours'
    LOOP
        -- Supprimer la table de staging
        EXECUTE format('DROP TABLE IF EXISTS %I.%I CASCADE', 
            staging_record.schema_name, 
            staging_record.staging_table_name);
        
        -- Supprimer les métadonnées
        DELETE FROM atlas.staging_metadata 
        WHERE staging_id = staging_record.staging_id;
        
        deleted_count := deleted_count + 1;
    END LOOP;
    
    RETURN deleted_count;
END;
$$;


--
-- Name: FUNCTION cleanup_old_staging(); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.cleanup_old_staging() IS 'Nettoie les tables de staging de plus de 24 heures';


--
-- Name: count_students_per_maille(uuid); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.count_students_per_maille(p_maille_id uuid) RETURNS integer
    LANGUAGE sql STABLE
    AS $$
    SELECT COUNT(*)::INTEGER
    FROM atlas.colab_maille_assignments
    WHERE maille_id = p_maille_id;
$$;


--
-- Name: FUNCTION count_students_per_maille(p_maille_id uuid); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.count_students_per_maille(p_maille_id uuid) IS 'Compte le nombre d''étudiants affectés à une maille donnée';


--
-- Name: geocode_sondage(uuid); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.geocode_sondage(p_sondage_id uuid) RETURNS void
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_geom geometry;
    v_geom_25231 geometry;
    v_maille_code text;
    v_adm1_name text;
    v_adm2_name text;
    v_adm3_id integer;
    v_adm3_name text;
BEGIN
    -- 1) Récupérer la géométrie du sondage
    SELECT geom INTO v_geom
    FROM atlas.sondages
    WHERE id = p_sondage_id AND deleted_at IS NULL;

    -- Si pas de géométrie, on ne fait rien
    IF v_geom IS NULL THEN
        RETURN;
    END IF;

    -- 2) Transformer en SRID 25231 pour les mailles
    v_geom_25231 := ST_Transform(v_geom, 25231);

    -- 3) Trouver la maille (point-in-polygon) - atlas.mailles SRID 25231
    SELECT m.code INTO v_maille_code
    FROM atlas.mailles m
    WHERE ST_Contains(m.geom, v_geom_25231)
    LIMIT 1;

    -- 4) Trouver ADM3 (canton) via atlas.adm3 - SRID 4326
    -- Cette table contient aussi adm2_fr et adm1_fr
    SELECT a.gid, a.adm3_fr, a.adm2_fr, a.adm1_fr 
    INTO v_adm3_id, v_adm3_name, v_adm2_name, v_adm1_name
    FROM atlas.adm3 a
    WHERE ST_Contains(a.geom, v_geom)
    LIMIT 1;

    -- 6) Mettre à jour le sondage
    UPDATE atlas.sondages
    SET 
        maille_code = COALESCE(v_maille_code, maille_code),
        adm1_name = COALESCE(v_adm1_name, adm1_name),
        adm2_name = COALESCE(v_adm2_name, adm2_name),
        adm3_id = COALESCE(v_adm3_id, adm3_id),
        adm3_name = COALESCE(v_adm3_name, adm3_name),
        updated_at = now()
    WHERE id = p_sondage_id;

    -- Log (optionnel, pour debug)
    -- RAISE NOTICE 'Geocoded sondage %: maille=%, adm3=%', p_sondage_id, v_maille_code, v_adm3_name;
END;
$$;


--
-- Name: FUNCTION geocode_sondage(p_sondage_id uuid); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.geocode_sondage(p_sondage_id uuid) IS 'G├®ocode un sondage : trouve la maille et les divisions administratives (ADM1/2/3) contenant le point.';


--
-- Name: get_adm_centroid(text, integer); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.get_adm_centroid(p_adm_level text, p_adm_gid integer) RETURNS public.geometry
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_geom geometry;
BEGIN
  CASE p_adm_level
    WHEN 'ADM1' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm1 WHERE gid = p_adm_gid;
    WHEN 'ADM2' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm2 WHERE gid = p_adm_gid;
    WHEN 'ADM3' THEN
      SELECT ST_Transform(ST_Centroid(geom), 25231) INTO v_geom
      FROM adm3 WHERE gid = p_adm_gid;
    ELSE
      RAISE EXCEPTION 'Invalid ADM level: %', p_adm_level;
  END CASE;
  
  RETURN v_geom;
END;
$$;


--
-- Name: FUNCTION get_adm_centroid(p_adm_level text, p_adm_gid integer); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.get_adm_centroid(p_adm_level text, p_adm_gid integer) IS 'Retourne le centro├»de (EPSG:25231) d''un polygone administratif (utilise gid)';


--
-- Name: get_adm_random_point(text, integer, text); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.get_adm_random_point(p_adm_level text, p_adm_gid integer, p_seed text) RETURNS public.geometry
    LANGUAGE plpgsql
    AS $$
DECLARE
  v_geom_4326 geometry;
  v_point geometry;
  v_bbox geometry;
  v_attempts INT := 0;
  v_max_attempts INT := 100;
  v_seed_hash FLOAT;
  v_rand_x FLOAT;
  v_rand_y FLOAT;
BEGIN
  CASE p_adm_level
    WHEN 'ADM1' THEN SELECT geom INTO v_geom_4326 FROM adm1 WHERE gid = p_adm_gid;
    WHEN 'ADM2' THEN SELECT geom INTO v_geom_4326 FROM adm2 WHERE gid = p_adm_gid;
    WHEN 'ADM3' THEN SELECT geom INTO v_geom_4326 FROM adm3 WHERE gid = p_adm_gid;
    ELSE RAISE EXCEPTION 'Invalid ADM level: %', p_adm_level;
  END CASE;
  
  IF v_geom_4326 IS NULL THEN
    RAISE EXCEPTION 'ADM geometry not found';
  END IF;
  
  v_seed_hash := (hashtext(p_seed)::bigint % 1000000) / 1000000.0;
  v_bbox := ST_Envelope(v_geom_4326);
  
  LOOP
    v_attempts := v_attempts + 1;
    IF v_attempts > v_max_attempts THEN
      RETURN ST_Transform(ST_Centroid(v_geom_4326), 25231);
    END IF;
    
    v_rand_x := MOD((v_seed_hash + v_attempts * 0.1)::numeric, 1.0);
    v_rand_y := MOD((v_seed_hash + v_attempts * 0.2)::numeric, 1.0);
    
    v_point := ST_SetSRID(
      ST_MakePoint(
        ST_XMin(v_bbox) + (ST_XMax(v_bbox) - ST_XMin(v_bbox)) * v_rand_x,
        ST_YMin(v_bbox) + (ST_YMax(v_bbox) - ST_YMin(v_bbox)) * v_rand_y
      ),
      4326
    );
    
    IF ST_Contains(v_geom_4326, v_point) THEN
      RETURN ST_Transform(v_point, 25231);
    END IF;
  END LOOP;
END;
$$;


--
-- Name: get_available_mailles_in_adm(text, text, integer); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.get_available_mailles_in_adm(p_adm_code text, p_adm_niveau text, p_max_students_per_maille integer DEFAULT 1) RETURNS TABLE(maille_id uuid, maille_code text, current_students integer, geom public.geometry)
    LANGUAGE sql STABLE
    AS $$
    WITH maille_counts AS (
        SELECT
            m.id,
            m.code,
            m.geom,
            COUNT(a.student_id) AS nb_students
        FROM atlas.mailles m
        LEFT JOIN atlas.colab_maille_assignments a ON a.maille_id = m.id
        WHERE 
            CASE 
                WHEN p_adm_niveau = 'ADM2' THEN 
                    -- Jointure spatiale avec public.adm2 (transformation 4326 -> 25231)
                    EXISTS (
                        SELECT 1 FROM public.adm2 adm2
                        WHERE adm2.adm2_pcode = p_adm_code
                        AND ST_Intersects(m.geom, ST_Transform(adm2.geom, 25231))
                    )
                WHEN p_adm_niveau = 'ADM3' THEN 
                    -- Jointure spatiale avec public.adm3 (transformation 4326 -> 25231)
                    EXISTS (
                        SELECT 1 FROM public.adm3 adm3
                        WHERE adm3.adm3_pcode = p_adm_code
                        AND ST_Intersects(m.geom, ST_Transform(adm3.geom, 25231))
                    )
                ELSE FALSE
            END
        GROUP BY m.id, m.code, m.geom
        HAVING COUNT(a.student_id) < p_max_students_per_maille
    )
    SELECT 
        id AS maille_id,
        code AS maille_code,
        nb_students::INTEGER AS current_students,
        geom
    FROM maille_counts
    ORDER BY nb_students, RANDOM();
$$;


--
-- Name: FUNCTION get_available_mailles_in_adm(p_adm_code text, p_adm_niveau text, p_max_students_per_maille integer); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.get_available_mailles_in_adm(p_adm_code text, p_adm_niveau text, p_max_students_per_maille integer) IS 'Retourne les mailles disponibles dans une zone ADM donnée (avec transformation SRID 4326->25231)';


--
-- Name: get_user_permissions(uuid); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.get_user_permissions(p_user_id uuid) RETURNS TABLE(permission_id character varying, resource character varying, action character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT DISTINCT p.id, p.resource, p.action
    FROM atlas.user_roles ur
    JOIN atlas.role_permissions rp ON ur.role_id = rp.role_id
    JOIN atlas.permissions p ON rp.permission_id = p.id
    WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$;


--
-- Name: get_user_roles(uuid); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.get_user_roles(p_user_id uuid) RETURNS TABLE(role_id character varying, role_name character varying)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT r.id, r.name
    FROM atlas.user_roles ur
    JOIN atlas.roles r ON ur.role_id = r.id
    WHERE ur.user_id = p_user_id
    AND (ur.expires_at IS NULL OR ur.expires_at > NOW());
END;
$$;


--
-- Name: log_auth_event(uuid, character varying, boolean, inet, text, jsonb); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.log_auth_event(p_user_id uuid, p_event_type character varying, p_success boolean, p_ip_address inet DEFAULT NULL::inet, p_user_agent text DEFAULT NULL::text, p_details jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO atlas.auth_audit_log (user_id, event_type, success, ip_address, user_agent, details)
    VALUES (p_user_id, p_event_type, p_success, p_ip_address, p_user_agent, p_details)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;


--
-- Name: norm(text); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.norm(s text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
BEGIN
    IF s IS NULL THEN
        RETURN '';
    END IF;
    
    -- Convertir en minuscules et supprimer les accents
    RETURN lower(unaccent(trim(s)));
END;
$$;


--
-- Name: norm_key(text); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.norm_key(s text) RETURNS text
    LANGUAGE plpgsql IMMUTABLE STRICT
    AS $$
BEGIN
    IF s IS NULL THEN
        RETURN '';
    END IF;
    
    -- Convertir en minuscules, supprimer accents et espaces
    RETURN lower(unaccent(regexp_replace(trim(s), '\s+', '', 'g')));
END;
$$;


--
-- Name: normalize_localite(text); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.normalize_localite(loc text) RETURNS text
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT lower(trim(unaccent(COALESCE(loc, ''))));
$$;


--
-- Name: prevent_audit_modification(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.prevent_audit_modification() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    RAISE EXCEPTION 'Modification interdite: la table audit_log est immuable';
    RETURN NULL;
END;
$$;


--
-- Name: rebuild_track_geometry(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.rebuild_track_geometry() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    UPDATE atlas.colab_tracks 
    SET 
        geom = (
            SELECT ST_MakeLine(geom ORDER BY sequence_num)
            FROM atlas.colab_track_points
            WHERE track_id = NEW.track_id
        ),
        points_count = (
            SELECT COUNT(*) FROM atlas.colab_track_points WHERE track_id = NEW.track_id
        ),
        total_distance_m = (
            SELECT ST_Length(ST_MakeLine(geom ORDER BY sequence_num)::geography)
            FROM atlas.colab_track_points
            WHERE track_id = NEW.track_id
        )
    WHERE id = NEW.track_id;
    
    RETURN NEW;
END;
$$;


--
-- Name: refresh_mailles_geotech(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.refresh_mailles_geotech() RETURNS trigger
    LANGUAGE plpgsql
    AS $$ BEGIN REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech; RETURN NULL; END; $$;


--
-- Name: refresh_sondages_unifies(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.refresh_sondages_unifies() RETURNS void
    LANGUAGE sql
    AS $$
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
$$;


--
-- Name: refresh_surveys(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.refresh_surveys() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_sondages_unifies;
  
  TRUNCATE atlas.surveys RESTART IDENTITY CASCADE;
  
  INSERT INTO atlas.surveys (
    id, code, localite_canon, localite, adm3_id, adm3_name, geom, 
    location_mode, is_geocoded, date, nb_sondages_source, created_at, updated_at
  )
  SELECT 
    id, code, localite_canon, localite, adm3_id, adm3_name, 
    CASE WHEN geom IS NOT NULL THEN ST_Transform(geom,4326) ELSE NULL END,
    location_mode::atlas.location_mode, is_geocoded, date, nb_sondages, created_at, updated_at
  FROM atlas.mv_sondages_unifies;
  
  TRUNCATE atlas.survey_aliases;
  
  INSERT INTO atlas.survey_aliases (survey_id, alias_code, source)
  SELECT id, unnest(alias_codes), 'legacy' 
  FROM atlas.mv_sondages_unifies
  ON CONFLICT (alias_code) DO NOTHING;
END; 
$$;


--
-- Name: tg_touch_updated_at(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.tg_touch_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END $$;


--
-- Name: track_changeset(text, text, jsonb, text); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.track_changeset(p_table_name text, p_operation text, p_changes jsonb, p_user text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql
    AS $$
DECLARE
    v_id UUID;
BEGIN
    INSERT INTO atlas.changesets (table_name, operation, changes, created_by)
    VALUES (p_table_name, p_operation, p_changes, p_user)
    RETURNING id INTO v_id;
    
    RETURN v_id;
END;
$$;


--
-- Name: FUNCTION track_changeset(p_table_name text, p_operation text, p_changes jsonb, p_user text); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.track_changeset(p_table_name text, p_operation text, p_changes jsonb, p_user text) IS 'Helper pour cr├®er un changeset';


--
-- Name: trg_geocode_sondage(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.trg_geocode_sondage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Ne géocoder que si la géométrie est présente et a changé
    IF NEW.geom IS NOT NULL THEN
        -- Sur INSERT ou si la géométrie a changé
        IF TG_OP = 'INSERT' OR (TG_OP = 'UPDATE' AND 
            (OLD.geom IS NULL OR NOT ST_Equals(OLD.geom, NEW.geom))) THEN
            PERFORM atlas.geocode_sondage(NEW.id);
        END IF;
    END IF;
    
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION trg_geocode_sondage(); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.trg_geocode_sondage() IS 'Trigger function pour g├®ocoder automatiquement les sondages lors de INSERT/UPDATE.';


--
-- Name: update_colab_updated_at(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.update_colab_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: update_maille_utm31_coords(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.update_maille_utm31_coords() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- Calculer les coordonnées UTM31 à partir de la géométrie
    NEW.xmin_utm31 := ST_XMin(ST_Transform(NEW.geom, 32631));
    NEW.xmax_utm31 := ST_XMax(ST_Transform(NEW.geom, 32631));
    NEW.ymin_utm31 := ST_YMin(ST_Transform(NEW.geom, 32631));
    NEW.ymax_utm31 := ST_YMax(ST_Transform(NEW.geom, 32631));
    NEW.xc_utm31 := ST_X(ST_Transform(ST_Centroid(NEW.geom), 32631));
    NEW.yc_utm31 := ST_Y(ST_Transform(ST_Centroid(NEW.geom), 32631));
    
    RETURN NEW;
END;
$$;


--
-- Name: FUNCTION update_maille_utm31_coords(); Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON FUNCTION atlas.update_maille_utm31_coords() IS 'Trigger function: Met à jour automatiquement les coordonnées UTM31 quand la géométrie change';


--
-- Name: update_question_answers_count(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.update_question_answers_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE atlas.colab_questions SET answers_count = answers_count + 1 WHERE id = NEW.question_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE atlas.colab_questions SET answers_count = answers_count - 1 WHERE id = OLD.question_id;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: update_tag_usage_count(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.update_tag_usage_count() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        UPDATE atlas.colab_tags SET usage_count = usage_count + 1 WHERE id = NEW.tag_id;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE atlas.colab_tags SET usage_count = usage_count - 1 WHERE id = OLD.tag_id;
    END IF;
    RETURN NULL;
END;
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: user_has_permission(uuid, character varying); Type: FUNCTION; Schema: atlas; Owner: -
--

CREATE FUNCTION atlas.user_has_permission(p_user_id uuid, p_permission_id character varying) RETURNS boolean
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1
        FROM atlas.user_roles ur
        JOIN atlas.role_permissions rp ON ur.role_id = rp.role_id
        WHERE ur.user_id = p_user_id
        AND rp.permission_id = p_permission_id
        AND (ur.expires_at IS NULL OR ur.expires_at > NOW())
    );
END;
$$;


--
-- Name: get_layer_stats(); Type: FUNCTION; Schema: atlas_ref; Owner: -
--

CREATE FUNCTION atlas_ref.get_layer_stats() RETURNS TABLE(layer_name text, feature_count bigint, last_import timestamp with time zone)
    LANGUAGE plpgsql
    AS $$
BEGIN
    RETURN QUERY
    SELECT 'routes'::TEXT, COUNT(*)::BIGINT, MAX(import_date) FROM atlas_ref.routes_25231
    UNION ALL
    SELECT 'localites_points', COUNT(*), MAX(import_date) FROM atlas_ref.localites_points_25231
    UNION ALL
    SELECT 'localites_polygons', COUNT(*), MAX(import_date) FROM atlas_ref.localites_polygons_25231
    UNION ALL
    SELECT 'batiments', COUNT(*), MAX(import_date) FROM atlas_ref.batiments_25231
    UNION ALL
    SELECT 'hydro_cours_eau', COUNT(*), MAX(import_date) FROM atlas_ref.hydro_cours_eau_25231
    UNION ALL
    SELECT 'hydro_surfaces', COUNT(*), MAX(import_date) FROM atlas_ref.hydro_surfaces_25231
    UNION ALL
    SELECT 'admin_limites', COUNT(*), MAX(import_date) FROM atlas_ref.admin_limites_25231;
END;
$$;


--
-- Name: FUNCTION get_layer_stats(); Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON FUNCTION atlas_ref.get_layer_stats() IS 'Retourne les statistiques des couches SIG';


--
-- Name: auto_accept_high_score_suggestions(double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_accept_high_score_suggestions(score_threshold double precision) RETURNS TABLE(suggestion_id text, sondage_id text, adm3_pcode text, score numeric)
    LANGUAGE plpgsql
    AS $$
DECLARE
    suggestion_rec RECORD;
    adm3_gid_val INTEGER;
    affected_count INTEGER := 0;
BEGIN
    -- Parcourir les suggestions avec score élevé
    FOR suggestion_rec IN
        SELECT
            gs.id,
            gs.entity_id,
            gs.top_code,
            gs.top_score
        FROM public.geocode_suggestions gs
        INNER JOIN atlas.sondages s ON s.id = gs.entity_id
        WHERE gs.status = 'pending'
          AND gs.top_score >= score_threshold
          AND s.geom IS NULL  -- Seulement les non géocodés
          AND s.deleted_at IS NULL
          AND gs.top_code IS NOT NULL
        ORDER BY gs.top_score DESC
    LOOP
        BEGIN
            -- Récupérer l'ADM3 gid depuis atlas.adm3
            SELECT a.gid INTO adm3_gid_val
            FROM atlas.adm3 a
            WHERE a.adm3_pcode = suggestion_rec.top_code;

            IF adm3_gid_val IS NULL THEN
                RAISE NOTICE 'ADM3 % not found for suggestion %', suggestion_rec.top_code, suggestion_rec.id;
                CONTINUE;
            END IF;

            -- Géocoder le sondage: assigner geom + location_mode
            -- Le trigger geocode_sondage remplira automatiquement maille_code, adm1/2/3
            UPDATE atlas.sondages s
            SET
                geom = public.random_point_in_polygon(a.geom),
                location_mode = 'adm_random_cell',
                updated_at = now(),
                meta = COALESCE(s.meta, '{}'::jsonb) || jsonb_build_object(
                    'geocoded_at', now()::text,
                    'geocoded_mode', 'auto_suggestion',
                    'geocoded_placement', 'adm_random_cell',
                    'geocoded_adm3_pcode', suggestion_rec.top_code,
                    'suggestion_id', suggestion_rec.id,
                    'auto_score', suggestion_rec.top_score
                )
            FROM atlas.adm3 a
            WHERE a.gid = adm3_gid_val
              AND s.id = suggestion_rec.entity_id;

            -- Marquer la suggestion comme acceptée
            UPDATE public.geocode_suggestions
            SET status = 'accepted',
                decided_at_ts = now()
            WHERE id = suggestion_rec.id;

            -- Rejeter les autres suggestions pending pour ce sondage
            UPDATE public.geocode_suggestions
            SET status = 'rejected',
                decided_at_ts = now()
            WHERE entity_id = suggestion_rec.entity_id
              AND id != suggestion_rec.id
              AND status = 'pending';

            affected_count := affected_count + 1;

            -- Retourner la ligne
            suggestion_id := suggestion_rec.id;
            sondage_id := suggestion_rec.entity_id;
            adm3_pcode := suggestion_rec.top_code;
            score := suggestion_rec.top_score;
            RETURN NEXT;

            RAISE NOTICE 'Auto-accepted suggestion % for sondage % (score: %)',
                suggestion_rec.id, suggestion_rec.entity_id, suggestion_rec.top_score;

        EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'Error processing suggestion %: %', suggestion_rec.id, SQLERRM;
            CONTINUE;
        END;
    END LOOP;

    RAISE NOTICE 'Auto-accepted % suggestions', affected_count;
END;
$$;


--
-- Name: FUNCTION auto_accept_high_score_suggestions(score_threshold double precision); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_accept_high_score_suggestions(score_threshold double precision) IS 'Accepte automatiquement les suggestions de g├®ocodage avec score >= threshold. Le trigger geocode_sondage remplit ensuite maille_code et ADM.';


--
-- Name: auto_geocode_sondage(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_geocode_sondage() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Seulement si pas de géométrie
  IF NEW.geom IS NULL THEN
    -- Si adm3_id présent, essayer centroïde
    IF NEW.adm3_id IS NOT NULL THEN
      BEGIN
        -- Utiliser fonction existante get_adm_centroid
        SELECT geom INTO NEW.geom 
        FROM adm3 
        WHERE gid = NEW.adm3_id;
        
        IF NEW.geom IS NOT NULL THEN
          NEW.location_mode := COALESCE(NEW.location_mode, 'centroid');
          RAISE NOTICE 'Géocodage ADM3 réussi pour sondage %', NEW.id;
        END IF;
        
      EXCEPTION WHEN others THEN
        -- En cas d'erreur, marquer comme unknown
        NEW.location_mode := COALESCE(NEW.location_mode, 'unknown');
        RAISE NOTICE 'Géocodage ADM3 échoué pour sondage %: %', NEW.id, SQLERRM;
      END;
    ELSE
      -- Pas d'ADM3, marquer comme unknown
      NEW.location_mode := COALESCE(NEW.location_mode, 'unknown');
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$;


--
-- Name: random_point_in_polygon(public.geometry); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.random_point_in_polygon(geom public.geometry) RETURNS public.geometry
    LANGUAGE plpgsql
    AS $$
DECLARE
  bbox geometry;
  random_point geometry;
  max_attempts integer := 1000;
  attempt integer := 0;
BEGIN
  -- Obtenir la bounding box du polygone
  bbox := ST_Envelope(geom);
  
  -- Essayer de générer un point aléatoire dans le polygone
  LOOP
    attempt := attempt + 1;
    
    -- Générer un point aléatoire dans la bounding box
    random_point := ST_SetSRID(
      ST_MakePoint(
        ST_XMin(bbox) + (ST_XMax(bbox) - ST_XMin(bbox)) * random(),
        ST_YMin(bbox) + (ST_YMax(bbox) - ST_YMin(bbox)) * random()
      ),
      ST_SRID(geom)
    );
    
    -- Vérifier si le point est dans le polygone
    IF ST_Contains(geom, random_point) THEN
      RETURN random_point;
    END IF;
    
    -- Éviter boucle infinie
    IF attempt >= max_attempts THEN
      -- Fallback: retourner le centroïde
      RAISE WARNING 'Could not generate random point after % attempts, returning centroid', max_attempts;
      RETURN ST_Centroid(geom);
    END IF;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION random_point_in_polygon(geom public.geometry); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.random_point_in_polygon(geom public.geometry) IS 'G├®n├¿re un point al├®atoire ├á l''int├®rieur d''un polygone.

Utilise une m├®thode de rejection sampling dans la bounding box.

Fallback sur le centro├»de apr├¿s 1000 tentatives.';


--
-- Name: refresh_mv_mailles_geotech(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_mv_mailles_geotech() RETURNS void
    LANGUAGE plpgsql
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
  RAISE NOTICE 'Vue matérialisée atlas.mv_mailles_geotech rafraîchie';
END;
$$;


--
-- Name: FUNCTION refresh_mv_mailles_geotech(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.refresh_mv_mailles_geotech() IS 'Rafra├«chit la vue mat├®rialis├®e des stats g├®otechniques (CONCURRENTLY pour ├®viter les locks)';


--
-- Name: run_auto_geocode_batch(double precision); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.run_auto_geocode_batch(score_threshold double precision DEFAULT 0.90) RETURNS json
    LANGUAGE plpgsql
    AS $$
DECLARE
    result_count INTEGER;
    results JSON;
BEGIN
    -- Exécuter l'auto-géocodage
    SELECT json_agg(row_to_json(t))
    INTO results
    FROM public.auto_accept_high_score_suggestions(score_threshold) t;
    
    GET DIAGNOSTICS result_count = ROW_COUNT;
    
    -- Rafraîchir la vue matérialisée des mailles
    REFRESH MATERIALIZED VIEW CONCURRENTLY atlas.mv_mailles_geotech;
    
    RAISE NOTICE 'Auto-geocoded % sondages, materialized view refreshed', result_count;
    
    RETURN json_build_object(
        'success', true,
        'count', result_count,
        'suggestions', COALESCE(results, '[]'::json)
    );
END;
$$;


--
-- Name: FUNCTION run_auto_geocode_batch(score_threshold double precision); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.run_auto_geocode_batch(score_threshold double precision) IS 'Ex├®cute un batch d''auto-g├®ocodage et rafra├«chit la vue mat├®rialis├®e.

Retourne un JSON avec le nombre de sondages g├®ocod├®s et la liste des suggestions accept├®es.';


--
-- Name: set_sondage_grid_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_sondage_grid_code() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Si la géométrie est définie, chercher la maille correspondante
  IF NEW.geom IS NOT NULL THEN
    SELECT code INTO NEW.grid_code
    FROM mailles
    WHERE ST_Contains(mailles.geom, ST_Transform(NEW.geom, 25231))
    LIMIT 1;
  ELSE
    NEW.grid_code := NULL;
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: update_essais_classif_timestamp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_essais_classif_timestamp() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_sondage_depth_range(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_sondage_depth_range() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Mettre à jour depth_min et depth_max du sondage concerné
  UPDATE sondages s
  SET depth_m_min = sub.depth_min,
      depth_m_max = sub.depth_max,
      updated_at = now()
  FROM (
      SELECT sondage_id,
             MIN(depth_m) AS depth_min,
             MAX(depth_m) AS depth_max
      FROM echantillons
      WHERE sondage_id = COALESCE(NEW.sondage_id, OLD.sondage_id)
      GROUP BY sondage_id
  ) AS sub
  WHERE s.id = sub.sondage_id;
  
  RETURN COALESCE(NEW, OLD);
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: _sqlx_migrations; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas._sqlx_migrations (
    version bigint NOT NULL,
    description text NOT NULL,
    installed_on timestamp with time zone DEFAULT now() NOT NULL,
    success boolean NOT NULL,
    checksum bytea NOT NULL,
    execution_time bigint NOT NULL
);


--
-- Name: adm1_tg; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.adm1_tg (
    id integer NOT NULL,
    name text NOT NULL,
    code text,
    geom public.geometry(MultiPolygon,4326),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: adm1_tg_id_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.adm1_tg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adm1_tg_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.adm1_tg_id_seq OWNED BY atlas.adm1_tg.id;


--
-- Name: adm2_tg; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.adm2_tg (
    id integer NOT NULL,
    name text NOT NULL,
    adm1_name text,
    code text,
    geom public.geometry(MultiPolygon,4326),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: adm2_tg_id_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.adm2_tg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adm2_tg_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.adm2_tg_id_seq OWNED BY atlas.adm2_tg.id;


--
-- Name: adm3; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.adm3 (
    gid integer NOT NULL,
    adm3_pcode text,
    adm3_fr text NOT NULL,
    adm2_pcode text,
    adm2_fr text,
    adm1_pcode text,
    adm1_fr text,
    adm0_fr text DEFAULT 'Togo'::text,
    geom public.geometry(MultiPolygon,4326),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: adm3_tg; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.adm3_tg (
    id integer NOT NULL,
    name text NOT NULL,
    adm2_name text,
    code text,
    geom public.geometry(MultiPolygon,4326),
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: adm3_tg_id_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.adm3_tg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adm3_tg_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.adm3_tg_id_seq OWNED BY atlas.adm3_tg.id;


--
-- Name: audit_log; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.audit_log (
    id text NOT NULL,
    table_name text NOT NULL,
    schema_name text NOT NULL,
    operation text NOT NULL,
    user_id text,
    sql_query text,
    rows_affected bigint DEFAULT 0,
    staging_id text,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT check_audit_created_at_not_future CHECK ((created_at <= now()))
);


--
-- Name: TABLE audit_log; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.audit_log IS 'Table d''audit immuable - Toute tentative de modification ou suppression sera rejet├®e';


--
-- Name: auth_audit_log; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.auth_audit_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    event_type character varying(50) NOT NULL,
    success boolean NOT NULL,
    ip_address inet,
    user_agent text,
    details jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE auth_audit_log; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.auth_audit_log IS 'Journal audit authentification';


--
-- Name: COLUMN auth_audit_log.event_type; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.auth_audit_log.event_type IS 'Type: login, logout, password_change, password_reset, token_refresh, etc.';


--
-- Name: backup_metadata; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.backup_metadata (
    backup_id text NOT NULL,
    backup_schema text NOT NULL,
    tables text[] NOT NULL,
    description text,
    size_bytes bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE backup_metadata; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.backup_metadata IS 'M├®tadonn├®es des points de restauration (backups)';


--
-- Name: boundary_togo; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.boundary_togo (
    id smallint DEFAULT 1 NOT NULL,
    geom public.geometry(MultiPolygon,25231) NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT boundary_togo_srid_chk CHECK ((public.st_srid(geom) = 25231))
);


--
-- Name: TABLE boundary_togo; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.boundary_togo IS 'Frontière nationale du Togo normalisée (SRID 25231)';


--
-- Name: changesets; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.changesets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    table_name text NOT NULL,
    operation text NOT NULL,
    changes jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by text,
    undone_at timestamp with time zone,
    CONSTRAINT changesets_operation_check CHECK ((operation = ANY (ARRAY['insert'::text, 'update'::text, 'delete'::text, 'ddl'::text]))),
    CONSTRAINT changesets_table_name_check CHECK ((table_name ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$'::text))
);


--
-- Name: TABLE changesets; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.changesets IS 'Historique des modifications pour undo/redo';


--
-- Name: COLUMN changesets.operation; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.changesets.operation IS 'Type d''op├®ration: insert, update, delete, ddl';


--
-- Name: COLUMN changesets.changes; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.changesets.changes IS 'D├®tails des modifications (format d├®pend de l''op├®ration)';


--
-- Name: COLUMN changesets.undone_at; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.changesets.undone_at IS 'Date d''annulation du changeset (NULL si non annul├®)';


--
-- Name: classifications; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.classifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sondage_id uuid NOT NULL,
    profondeur_m numeric NOT NULL,
    methode atlas.methode_classification_enum NOT NULL,
    resultat atlas.analyse_qualitative_enum NOT NULL,
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    deleted_at timestamp with time zone
);


--
-- Name: colab_answers; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    author_id uuid NOT NULL,
    body text NOT NULL,
    is_best boolean DEFAULT false,
    is_accepted boolean DEFAULT false,
    score integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_badges; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    name text NOT NULL,
    description text,
    icon text,
    category text,
    points integer DEFAULT 0,
    condition_type text,
    condition_value integer,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT colab_badges_category_check CHECK ((category = ANY (ARRAY['bronze'::text, 'silver'::text, 'gold'::text, 'platinum'::text])))
);


--
-- Name: colab_comment_mentions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_comment_mentions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    comment_id uuid NOT NULL,
    mentioned_user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_comments; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_comments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entity_type atlas.comment_entity_type NOT NULL,
    entity_id uuid NOT NULL,
    author_id uuid NOT NULL,
    content text NOT NULL,
    parent_comment_id uuid,
    is_edited boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_documents; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_documents (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    uploaded_by uuid NOT NULL,
    title character varying(300) NOT NULL,
    document_type atlas.document_type DEFAULT 'autre'::atlas.document_type NOT NULL,
    description text,
    file_path text NOT NULL,
    file_name character varying(300) NOT NULL,
    file_size_bytes bigint,
    mime_type character varying(100),
    sondage_id uuid,
    version integer DEFAULT 1,
    is_current boolean DEFAULT true,
    uploaded_at timestamp with time zone DEFAULT now(),
    notes text
);


--
-- Name: TABLE colab_documents; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_documents IS 'Documents li├®s aux missions Colab';


--
-- Name: COLUMN colab_documents.file_path; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_documents.file_path IS 'Chemin relatif dans le syst├¿me de stockage';


--
-- Name: colab_email_jobs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_email_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL
);


--
-- Name: colab_export_jobs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_export_jobs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    source text NOT NULL,
    format text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    started_at timestamp with time zone,
    finished_at timestamp with time zone,
    file_path text,
    file_size bigint,
    error text,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT colab_export_jobs_format_check CHECK ((format = ANY (ARRAY['csv'::text, 'json'::text, 'xlsx'::text, 'pdf'::text, 'geojson'::text]))),
    CONSTRAINT colab_export_jobs_source_check CHECK ((source = ANY (ARRAY['missions'::text, 'students'::text, 'supervisors'::text, 'documents'::text, 'logs'::text, 'missions_students_supervisors'::text, 'missions_documents'::text, 'students_missions'::text, 'logs_missions'::text]))),
    CONSTRAINT colab_export_jobs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'running'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: colab_export_logs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_export_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    job_id uuid NOT NULL,
    action text NOT NULL,
    actor text NOT NULL,
    "timestamp" timestamp with time zone DEFAULT now(),
    details jsonb,
    CONSTRAINT colab_export_logs_action_check CHECK ((action = ANY (ARRAY['created'::text, 'started'::text, 'completed'::text, 'failed'::text, 'downloaded'::text])))
);


--
-- Name: colab_export_schedules; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_export_schedules (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    source text NOT NULL,
    format text NOT NULL,
    filters jsonb DEFAULT '{}'::jsonb NOT NULL,
    template_id uuid,
    cron text NOT NULL,
    timezone text DEFAULT 'UTC'::text NOT NULL,
    next_run_at timestamp with time zone,
    last_run_at timestamp with time zone,
    destinations jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT colab_export_schedules_format_check CHECK ((format = ANY (ARRAY['csv'::text, 'json'::text, 'xlsx'::text, 'pdf'::text, 'geojson'::text]))),
    CONSTRAINT colab_export_schedules_source_check CHECK ((source = ANY (ARRAY['missions'::text, 'students'::text, 'supervisors'::text, 'documents'::text, 'logs'::text, 'missions_students_supervisors'::text, 'missions_documents'::text, 'students_missions'::text, 'logs_missions'::text])))
);


--
-- Name: colab_export_templates; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_export_templates (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    source text NOT NULL,
    format text NOT NULL,
    template_sql text,
    template_handlebars text,
    created_by text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    is_active boolean DEFAULT true,
    CONSTRAINT colab_export_templates_format_check CHECK ((format = ANY (ARRAY['csv'::text, 'json'::text, 'xlsx'::text, 'pdf'::text, 'geojson'::text]))),
    CONSTRAINT colab_export_templates_source_check CHECK ((source = ANY (ARRAY['missions'::text, 'students'::text, 'supervisors'::text, 'documents'::text, 'logs'::text, 'missions_students_supervisors'::text, 'missions_documents'::text, 'students_missions'::text, 'logs_missions'::text])))
);


--
-- Name: colab_field_logs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_field_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    author_id uuid NOT NULL,
    sondage_id uuid,
    echantillon_id uuid,
    log_type atlas.field_log_type DEFAULT 'note'::atlas.field_log_type NOT NULL,
    log_date timestamp with time zone DEFAULT now() NOT NULL,
    title character varying(200),
    content text NOT NULL,
    latitude double precision,
    longitude double precision,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE colab_field_logs; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_field_logs IS 'Journal de terrain des missions';


--
-- Name: COLUMN colab_field_logs.log_date; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_field_logs.log_date IS 'Date/heure effective du log sur le terrain';


--
-- Name: colab_field_sessions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_field_sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    ended_at timestamp with time zone,
    start_geom public.geometry(Point,4326),
    end_geom public.geometry(Point,4326),
    sondages_created integer DEFAULT 0,
    photos_taken integer DEFAULT 0,
    distance_walked_m real,
    device_info jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_maille_assignments; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_maille_assignments (
    assignment_id uuid DEFAULT gen_random_uuid() NOT NULL,
    maille_id uuid NOT NULL,
    adm_code_used text NOT NULL,
    pref_rank_used integer NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    notes text,
    student_id uuid NOT NULL,
    CONSTRAINT colab_maille_assignments_pref_rank_used_check CHECK ((pref_rank_used = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: TABLE colab_maille_assignments; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_maille_assignments IS 'Attribution des mailles nationales aux étudiants Colab';


--
-- Name: COLUMN colab_maille_assignments.pref_rank_used; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_maille_assignments.pref_rank_used IS 'Rang de préférence utilisé: 1=pref_1, 2=pref_2, 3=pref_3';


--
-- Name: colab_maille_notification_logs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_maille_notification_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    assignment_id uuid NOT NULL,
    email_job_id uuid,
    status text NOT NULL,
    options jsonb DEFAULT '{}'::jsonb NOT NULL,
    requested_by uuid,
    requested_at timestamp with time zone DEFAULT now() NOT NULL,
    sent_at timestamp with time zone,
    error text,
    CONSTRAINT colab_maille_notification_logs_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'sent'::text, 'failed'::text, 'skipped'::text])))
);


--
-- Name: colab_mission_assignments; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_mission_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    student_id uuid NOT NULL,
    role character varying(50) DEFAULT 'membre'::character varying NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    unassigned_at timestamp with time zone,
    notes text
);


--
-- Name: TABLE colab_mission_assignments; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_mission_assignments IS 'Affectations ├®tudiants aux missions';


--
-- Name: COLUMN colab_mission_assignments.role; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_mission_assignments.role IS 'R├┤le: chef_equipe, technicien, stagiaire, membre';


--
-- Name: colab_mission_sondages; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_mission_sondages (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    sondage_id uuid NOT NULL,
    role character varying(50) DEFAULT 'principal'::character varying,
    linked_at timestamp with time zone DEFAULT now(),
    linked_by uuid,
    notes text
);


--
-- Name: TABLE colab_mission_sondages; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_mission_sondages IS 'Liaison entre missions et sondages g├®otechniques';


--
-- Name: colab_missions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_missions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code character varying(50) NOT NULL,
    title character varying(200) NOT NULL,
    theme atlas.mission_theme DEFAULT 'reconnaissance'::atlas.mission_theme NOT NULL,
    maille_id uuid,
    zone_label character varying(200),
    commune character varying(100),
    region character varying(100),
    supervisor_id uuid,
    expected_sondages integer DEFAULT 0,
    start_date date,
    end_date date,
    status atlas.mission_status DEFAULT 'draft'::atlas.mission_status NOT NULL,
    description text,
    objectifs text,
    notes_internal text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE colab_missions; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_missions IS 'Missions terrain Atlas Colab';


--
-- Name: COLUMN colab_missions.code; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_missions.code IS 'Code unique de mission (ex: M-2025-LOME-001)';


--
-- Name: COLUMN colab_missions.expected_sondages; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_missions.expected_sondages IS 'Nombre de sondages attendus';


--
-- Name: COLUMN colab_missions.notes_internal; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_missions.notes_internal IS 'Notes internes non visibles par les ├®tudiants';


--
-- Name: colab_notifications; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    notification_type atlas.notification_type NOT NULL,
    title text NOT NULL,
    message text,
    payload jsonb DEFAULT '{}'::jsonb,
    mission_id uuid,
    sondage_id uuid,
    comment_id uuid,
    is_read boolean DEFAULT false,
    read_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_photos; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_photos (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid,
    sondage_id uuid,
    field_log_id uuid,
    uploaded_by uuid NOT NULL,
    filename text NOT NULL,
    original_filename text,
    mime_type text DEFAULT 'image/jpeg'::text,
    file_size_bytes integer,
    storage_path text,
    photo_type text,
    caption text,
    geom public.geometry(Point,4326),
    altitude_m real,
    exif_data jsonb,
    taken_at timestamp with time zone,
    sync_status text DEFAULT 'pending'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT colab_photos_photo_type_check CHECK ((photo_type = ANY (ARRAY['surface'::text, 'fouille'::text, 'detail'::text, 'panorama'::text, 'equipment'::text, 'other'::text]))),
    CONSTRAINT colab_photos_sync_status_check CHECK ((sync_status = ANY (ARRAY['pending'::text, 'uploading'::text, 'uploaded'::text, 'failed'::text])))
);


--
-- Name: colab_question_tags; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_question_tags (
    question_id uuid NOT NULL,
    tag_id uuid NOT NULL
);


--
-- Name: colab_questions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    title text NOT NULL,
    body text NOT NULL,
    author_id uuid NOT NULL,
    mission_id uuid,
    sondage_id uuid,
    maille_id uuid,
    essai_id uuid,
    is_closed boolean DEFAULT false,
    is_pinned boolean DEFAULT false,
    score integer DEFAULT 0,
    views_count integer DEFAULT 0,
    answers_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    closed_at timestamp with time zone,
    closed_by uuid
);


--
-- Name: colab_sondage_status_history; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_sondage_status_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sondage_id uuid NOT NULL,
    old_status atlas.sondage_validation_status,
    new_status atlas.sondage_validation_status NOT NULL,
    changed_by uuid NOT NULL,
    reason text,
    changed_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_student_prefs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_student_prefs (
    student_id text NOT NULL,
    user_id uuid,
    nom text NOT NULL,
    prenom text NOT NULL,
    telephone text,
    email text,
    adm_niveau text,
    adm_code_pref_1 text NOT NULL,
    adm_code_pref_2 text,
    adm_code_pref_3 text,
    commentaire text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT colab_student_prefs_adm_niveau_check CHECK ((adm_niveau = ANY (ARRAY['ADM2'::text, 'ADM3'::text])))
);


--
-- Name: TABLE colab_student_prefs; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_student_prefs IS 'Staging des préférences étudiants pour attribution des mailles Colab';


--
-- Name: COLUMN colab_student_prefs.adm_niveau; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_student_prefs.adm_niveau IS 'Niveau administratif souhaité: ADM2 (préfecture) ou ADM3 (commune)';


--
-- Name: COLUMN colab_student_prefs.adm_code_pref_1; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_student_prefs.adm_code_pref_1 IS 'Code ADM de la préférence 1 (obligatoire)';


--
-- Name: colab_students; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_students (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    matricule character varying(50),
    promotion character varying(20) NOT NULL,
    filiere character varying(100),
    etablissement character varying(200),
    niveau character varying(50),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE colab_students; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_students IS 'M├®tadonn├®es ├®tudiants pour Atlas Colab';


--
-- Name: COLUMN colab_students.promotion; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_students.promotion IS 'Ann├®e acad├®mique (ex: 2024-2025)';


--
-- Name: COLUMN colab_students.filiere; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_students.filiere IS 'Fili├¿re d''├®tudes';


--
-- Name: colab_supervisors; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_supervisors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    specialite character varying(100),
    institution character varying(200),
    titre character varying(100),
    departement character varying(200),
    telephone character varying(30),
    notes text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE colab_supervisors; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.colab_supervisors IS 'M├®tadonn├®es encadreurs pour Atlas Colab';


--
-- Name: COLUMN colab_supervisors.specialite; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.colab_supervisors.specialite IS 'Domaine d''expertise';


--
-- Name: colab_sync_queue; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_sync_queue (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    action_type text NOT NULL,
    client_id text NOT NULL,
    payload jsonb NOT NULL,
    status text DEFAULT 'pending'::text,
    error_message text,
    retry_count integer DEFAULT 0,
    result jsonb,
    created_at timestamp with time zone DEFAULT now(),
    processed_at timestamp with time zone,
    CONSTRAINT colab_sync_queue_action_type_check CHECK ((action_type = ANY (ARRAY['create_sondage'::text, 'update_sondage'::text, 'delete_sondage'::text, 'create_field_log'::text, 'update_field_log'::text, 'upload_photo'::text, 'update_position'::text]))),
    CONSTRAINT colab_sync_queue_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text])))
);


--
-- Name: colab_tags; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_tags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    description text,
    color text DEFAULT '#6B7280'::text,
    usage_count integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_track_points; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_track_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    track_id uuid NOT NULL,
    geom public.geometry(Point,4326) NOT NULL,
    altitude_m real,
    accuracy_m real,
    recorded_at timestamp with time zone NOT NULL,
    sequence_num integer NOT NULL
);


--
-- Name: colab_tracks; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_tracks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    mission_id uuid NOT NULL,
    user_id uuid NOT NULL,
    name text,
    started_at timestamp with time zone NOT NULL,
    ended_at timestamp with time zone,
    geom public.geometry(LineString,4326),
    total_distance_m real,
    total_duration_seconds integer,
    points_count integer DEFAULT 0,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_user_badges; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_user_badges (
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_user_stats; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_user_stats (
    user_id uuid NOT NULL,
    questions_count integer DEFAULT 0,
    answers_count integer DEFAULT 0,
    best_answers_count integer DEFAULT 0,
    accepted_answers_count integer DEFAULT 0,
    comments_count integer DEFAULT 0,
    reputation_points integer DEFAULT 0,
    badges jsonb DEFAULT '[]'::jsonb,
    last_question_at timestamp with time zone,
    last_answer_at timestamp with time zone,
    last_active_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: colab_votes; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.colab_votes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    target_type text NOT NULL,
    target_id uuid NOT NULL,
    vote_value smallint NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT colab_votes_target_type_check CHECK ((target_type = ANY (ARRAY['question'::text, 'answer'::text]))),
    CONSTRAINT colab_votes_vote_value_check CHECK ((vote_value = ANY (ARRAY['-1'::integer, 1])))
);


--
-- Name: column_ui_metadata; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.column_ui_metadata (
    id integer NOT NULL,
    schema_name text NOT NULL,
    table_name text NOT NULL,
    column_name text NOT NULL,
    ui_order integer,
    ui_visible boolean DEFAULT true,
    ui_label text,
    ui_unit text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE column_ui_metadata; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.column_ui_metadata IS 'M├®tadonn├®es UI pour personnaliser l''affichage des colonnes dans le gestionnaire';


--
-- Name: column_ui_metadata_id_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.column_ui_metadata_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: column_ui_metadata_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.column_ui_metadata_id_seq OWNED BY atlas.column_ui_metadata.id;


--
-- Name: country_tg; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.country_tg (
    id integer NOT NULL,
    name text DEFAULT 'Togo'::text NOT NULL,
    geom public.geometry(Polygon,4326) NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: country_tg_id_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.country_tg_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: country_tg_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.country_tg_id_seq OWNED BY atlas.country_tg.id;


--
-- Name: dataset_metadata; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.dataset_metadata (
    dataset_key text NOT NULL,
    version text NOT NULL,
    checksum_sha256 text NOT NULL,
    installed_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: dsm_cop30; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.dsm_cop30 (
    rid integer NOT NULL,
    rast public.raster,
    filename text,
    CONSTRAINT enforce_srid_rast CHECK ((public.st_srid(rast) = 25231))
);


--
-- Name: TABLE dsm_cop30; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.dsm_cop30 IS 'DSM COP30 - Modèle Numérique de Surface du Togo (SRID 25231)';


--
-- Name: COLUMN dsm_cop30.rid; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.dsm_cop30.rid IS 'Identifiant de tuile raster';


--
-- Name: COLUMN dsm_cop30.rast; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.dsm_cop30.rast IS 'Tuile raster (hauteur en mètres)';


--
-- Name: COLUMN dsm_cop30.filename; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.dsm_cop30.filename IS 'Nom du fichier source';


--
-- Name: dsm_cop30_rid_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.dsm_cop30_rid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: dsm_cop30_rid_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.dsm_cop30_rid_seq OWNED BY atlas.dsm_cop30.rid;


--
-- Name: echantillons; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.echantillons (
    laboratory text,
    norm text,
    is_index text,
    eg numeric,
    meta jsonb,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sondage_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    depth_m numeric(6,3),
    rho_s_gcm3 numeric,
    water_content_w numeric,
    date date
);


--
-- Name: essais; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais (
    id uuid NOT NULL,
    sondage_id uuid,
    type text NOT NULL,
    depth_m numeric,
    value numeric,
    unit text,
    meta jsonb DEFAULT '{}'::jsonb
);


--
-- Name: essais_atterberg; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_atterberg (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    echantillon_id uuid,
    meta jsonb,
    created_at timestamp with time zone,
    wl numeric,
    wp numeric,
    ip_generated numeric
);


--
-- Name: essais_classif; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_classif (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    essai_id uuid,
    systeme text,
    classe text,
    reason text,
    version text,
    computed boolean,
    source text,
    meta jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at timestamp with time zone,
    echantillon_id uuid,
    depth_m numeric(6,3),
    laboratory text,
    test_date date,
    hrb text,
    unified text,
    class_chassagneux text,
    class_daksha text,
    class_seed text,
    class_vijay text,
    type_sol text,
    cg numeric,
    cg_qual text
);


--
-- Name: TABLE essais_classif; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.essais_classif IS 'Table unifi├®e pour TOUTES les classifications g├®otechniques (HRB, Unified, normes AMESSEFE, potentiel de gonflement)';


--
-- Name: COLUMN essais_classif.echantillon_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.echantillon_id IS 'Cl├® ├®trang├¿re vers echantillons (1 classification par ├®chantillon)';


--
-- Name: COLUMN essais_classif.laboratory; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.laboratory IS 'Laboratoire ayant r├®alis├® l''essai (ex: FORMATEC)';


--
-- Name: COLUMN essais_classif.hrb; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.hrb IS 'Classification HRB (Highway Research Board) - imports classiques';


--
-- Name: COLUMN essais_classif.unified; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.unified IS 'Classification USCS (Unified Soil Classification System) - imports classiques';


--
-- Name: COLUMN essais_classif.class_chassagneux; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.class_chassagneux IS 'Classification CHASSAGNEUX D. et al. 1996 - donn├®es AMESSEFE';


--
-- Name: COLUMN essais_classif.class_daksha; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.class_daksha IS 'Classification Dakshanamurthy et Raman 1973 - donn├®es AMESSEFE';


--
-- Name: COLUMN essais_classif.class_seed; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.class_seed IS 'Classification SEED H. et al 1962 - donn├®es AMESSEFE';


--
-- Name: COLUMN essais_classif.class_vijay; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.class_vijay IS 'Classification VIJAYVERGIYA et GHAZZALY 1973 - donn├®es AMESSEFE';


--
-- Name: COLUMN essais_classif.type_sol; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.type_sol IS 'Type de sol (Vertisols, Ferrugineux, Hydromorphes, etc.)';


--
-- Name: COLUMN essais_classif.cg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.cg IS 'Potentiel de gonflement (cg) - valeur num├®rique';


--
-- Name: COLUMN essais_classif.cg_qual; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_classif.cg_qual IS 'Analyse qualitative du potentiel de gonflement (Faible/Moyen/├ëlev├®)';


--
-- Name: essais_geotechniques; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_geotechniques (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sondage_id uuid,
    depth_m numeric(6,3),
    passant_80um numeric,
    passant_2mm numeric,
    passant_20mm numeric,
    wl numeric,
    wp numeric,
    ip numeric,
    vbs numeric,
    gamma_d_max numeric,
    w_opt numeric,
    proctor_type text,
    eg numeric,
    test_date date,
    laboratory text,
    norm text,
    meta jsonb,
    created_at timestamp with time zone,
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at timestamp with time zone,
    echantillon_id uuid,
    cg numeric,
    cg_qual text,
    class_chassagneux text,
    class_daksha text,
    class_seed text,
    class_vijay text,
    type_sol text,
    vbs_qual text
);


--
-- Name: COLUMN essais_geotechniques.sondage_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.sondage_id IS '[LEGACY] Conserv├® pour compatibilit├®. Utiliser echantillon_id ├á la place.';


--
-- Name: COLUMN essais_geotechniques.depth_m; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.depth_m IS '[LEGACY] Conserv├® pour compatibilit├®. Utiliser echantillon.depth_m via echantillon_id.';


--
-- Name: COLUMN essais_geotechniques.echantillon_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.echantillon_id IS '[CANONICAL] Lien direct vers l''├®chantillon. 1 essai = 1 ├®chantillon.';


--
-- Name: COLUMN essais_geotechniques.cg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.cg IS 'Potentiel de gonflement (cg) - donn├®es AMESSEFE';


--
-- Name: COLUMN essais_geotechniques.cg_qual; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.cg_qual IS 'Analyse du potentiel de gonflement (Faible/Moyen/├ëlev├®) - donn├®es AMESSEFE';


--
-- Name: COLUMN essais_geotechniques.class_chassagneux; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.class_chassagneux IS 'Classification CHASSAGNEUX D. et al. 1996';


--
-- Name: COLUMN essais_geotechniques.class_daksha; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.class_daksha IS 'Classification Dakshanamurthy et Raman 1973';


--
-- Name: COLUMN essais_geotechniques.class_seed; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.class_seed IS 'Classification SEED H. et al 1962';


--
-- Name: COLUMN essais_geotechniques.class_vijay; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.class_vijay IS 'Classification VIJAYVERGIYA et GHAZZALY 1973';


--
-- Name: COLUMN essais_geotechniques.type_sol; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.type_sol IS 'Type de sol (Vertisols, Ferrugineux, etc.)';


--
-- Name: COLUMN essais_geotechniques.vbs_qual; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_geotechniques.vbs_qual IS 'Analyse qualitative VBS (Faible/Moyen/Forte/Tr├¿s forte)';


--
-- Name: essais_physiques; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_physiques (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    essai_id uuid,
    densite_apparente_gcm3 numeric,
    densite_absolue_gcm3 numeric,
    teneur_eau_pct numeric,
    source text,
    measured_at date,
    meta jsonb,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    created_by uuid,
    updated_by uuid,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at timestamp with time zone,
    echantillon_id uuid,
    w numeric,
    rho_s numeric,
    laboratory text
);


--
-- Name: essais_potentiel_gonflement; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_potentiel_gonflement (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    echantillon_id uuid NOT NULL,
    cg numeric,
    cg_qual text,
    type_sol text,
    meta jsonb,
    created_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    updated_at timestamp with time zone,
    updated_by uuid
);


--
-- Name: TABLE essais_potentiel_gonflement; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.essais_potentiel_gonflement IS 'Potentiel de gonflement des sols (AMESSEFE) - s├®par├® des classifications g├®otechniques';


--
-- Name: COLUMN essais_potentiel_gonflement.cg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_potentiel_gonflement.cg IS 'Coefficient de gonflement (valeur num├®rique)';


--
-- Name: COLUMN essais_potentiel_gonflement.cg_qual; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_potentiel_gonflement.cg_qual IS 'Qualificatif du potentiel: Faible / Moyen / Elev├®';


--
-- Name: COLUMN essais_potentiel_gonflement.type_sol; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.essais_potentiel_gonflement.type_sol IS 'Classification p├®dologique du sol (ex: Hydromorphes, Vertisols)';


--
-- Name: essais_proctor; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_proctor (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    echantillon_id uuid NOT NULL,
    proctor_type text NOT NULL,
    gamma_d_max numeric NOT NULL,
    w_opt numeric NOT NULL,
    meta jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT essais_proctor_gamma_d_max_check CHECK (((gamma_d_max >= (10)::numeric) AND (gamma_d_max <= (30)::numeric))),
    CONSTRAINT essais_proctor_proctor_type_check CHECK ((proctor_type = ANY (ARRAY['normal'::text, 'modifie'::text]))),
    CONSTRAINT essais_proctor_w_opt_check CHECK (((w_opt >= (0)::numeric) AND (w_opt <= (50)::numeric)))
);


--
-- Name: essais_vbs; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.essais_vbs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    echantillon_id uuid,
    commentaire text,
    meta jsonb,
    created_at timestamp with time zone,
    vbs numeric
);


--
-- Name: granulo_points; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.granulo_points (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    echantillon_id uuid,
    method text,
    meta jsonb,
    created_at timestamp with time zone,
    sieve_mm numeric,
    passing_pct numeric
);


--
-- Name: import_errors; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.import_errors (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    import_id uuid NOT NULL,
    row_no integer NOT NULL,
    column_name text,
    error_code text NOT NULL,
    message text NOT NULL,
    severity text NOT NULL,
    value text,
    hint text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT import_errors_severity_check CHECK ((severity = ANY (ARRAY['error'::text, 'warning'::text, 'info'::text])))
);


--
-- Name: TABLE import_errors; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.import_errors IS 'Erreurs d├®taill├®es pour chaque import';


--
-- Name: imports; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.imports (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    filename text NOT NULL,
    status text NOT NULL,
    total_rows integer DEFAULT 0 NOT NULL,
    processed_rows integer DEFAULT 0 NOT NULL,
    success_rows integer DEFAULT 0 NOT NULL,
    error_rows integer DEFAULT 0 NOT NULL,
    import_type text NOT NULL,
    metadata jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    started_at timestamp with time zone,
    completed_at timestamp with time zone,
    created_by text,
    error_message text,
    batch_id text,
    updated_at timestamp with time zone DEFAULT now(),
    sha256 text,
    params jsonb,
    stats jsonb,
    CONSTRAINT imports_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'processing'::text, 'completed'::text, 'failed'::text, 'cancelled'::text])))
);


--
-- Name: TABLE imports; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.imports IS 'Suivi des imports de donn├®es (CSV, Excel, etc.)';


--
-- Name: layer_style; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.layer_style (
    layer_id text NOT NULL,
    unit_code text NOT NULL,
    unit_label text NOT NULL,
    color_hex text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    is_default_on boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: maille_28km; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.maille_28km (
    id_m28 integer NOT NULL,
    code_m28 integer,
    profil_num integer,
    pk_min_km numeric(6,1),
    pk_max_km numeric(6,1),
    geom public.geometry(Polygon,25231),
    code_lisible text
);


--
-- Name: TABLE maille_28km; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.maille_28km IS 'Mailles 28km clippées à la frontière du Togo pour éviter les débordements sur les pays voisins (Migration 096)';


--
-- Name: COLUMN maille_28km.profil_num; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.maille_28km.profil_num IS 'Numéro de profil Sud-Nord (1..21)';


--
-- Name: maille_28km_id_m28_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.maille_28km_id_m28_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: maille_28km_id_m28_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.maille_28km_id_m28_seq OWNED BY atlas.maille_28km.id_m28;


--
-- Name: mailles; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.mailles (
    id uuid NOT NULL,
    geom public.geometry(Polygon,25231) NOT NULL,
    code text NOT NULL,
    stats jsonb DEFAULT '{}'::jsonb,
    updated_at timestamp with time zone DEFAULT now(),
    pref_code text,
    pref_name text,
    adm2_name text,
    id_m28 integer,
    xmin_utm31 double precision,
    xmax_utm31 double precision,
    ymin_utm31 double precision,
    ymax_utm31 double precision,
    xc_utm31 double precision,
    yc_utm31 double precision
);


--
-- Name: COLUMN mailles.xmin_utm31; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mailles.xmin_utm31 IS 'Coordonnée X minimale en UTM Zone 31N (EPSG:32631)';


--
-- Name: COLUMN mailles.xmax_utm31; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mailles.xmax_utm31 IS 'Coordonnée X maximale en UTM Zone 31N (EPSG:32631)';


--
-- Name: COLUMN mailles.ymin_utm31; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mailles.ymin_utm31 IS 'Coordonnée Y minimale en UTM Zone 31N (EPSG:32631)';


--
-- Name: COLUMN mailles.ymax_utm31; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mailles.ymax_utm31 IS 'Coordonnée Y maximale en UTM Zone 31N (EPSG:32631)';


--
-- Name: COLUMN mailles.xc_utm31; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mailles.xc_utm31 IS 'Coordonnée X du centre en UTM Zone 31N (EPSG:32631)';


--
-- Name: COLUMN mailles.yc_utm31; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mailles.yc_utm31 IS 'Coordonnée Y du centre en UTM Zone 31N (EPSG:32631)';


--
-- Name: sondages; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta jsonb,
    code text NOT NULL,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean GENERATED ALWAYS AS (((geom IS NOT NULL) OR (adm3_id IS NOT NULL))) STORED,
    validation_status atlas.sondage_validation_status DEFAULT 'synced'::atlas.sondage_validation_status,
    mission_id uuid,
    location_accuracy_m real,
    id_m28 integer
);


--
-- Name: COLUMN sondages.geom; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.geom IS 'LEGACY - utiliser geom_real. Ne plus utiliser.';


--
-- Name: COLUMN sondages.date_sondage; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.date_sondage IS 'LEGACY - remplac├® par "date" (DATE). Ne plus utiliser.';


--
-- Name: COLUMN sondages.source; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.source IS 'TEXT - source/auteur du sondage (NICABOU, BONOU, etc.)';


--
-- Name: COLUMN sondages.meta; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.meta IS 'JSONB canonique - contient code, localite, date, source, adm3_code, etc.';


--
-- Name: COLUMN sondages.code; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.code IS 'LEGACY - utiliser meta->>''code'' ├á la place. Ne plus utiliser.';


--
-- Name: COLUMN sondages.depth_m_min; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.depth_m_min IS 'Profondeur minimale des ├®chantillons (calcul├®e automatiquement depuis echantillons)';


--
-- Name: COLUMN sondages.depth_m_max; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.depth_m_max IS 'Profondeur maximale des ├®chantillons (calcul├®e automatiquement depuis echantillons)';


--
-- Name: COLUMN sondages.maille_code; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.maille_code IS 'OPTIONNEL - ancien code maille (remplac├® par grid_code)';


--
-- Name: COLUMN sondages.adm1_name; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.adm1_name IS 'LEGACY - utiliser JOIN avec adm1. Ne plus utiliser.';


--
-- Name: COLUMN sondages.adm2_name; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.adm2_name IS 'LEGACY - utiliser JOIN avec adm2. Ne plus utiliser.';


--
-- Name: COLUMN sondages.adm3_name; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.adm3_name IS 'LEGACY - utiliser JOIN avec adm3. Ne plus utiliser.';


--
-- Name: COLUMN sondages.comment; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.comment IS 'LEGACY - utiliser meta->>''comment'' si n├®cessaire. Ne plus utiliser.';


--
-- Name: COLUMN sondages.operator; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.operator IS 'Op├®rateur/technicien ayant r├®alis├® le sondage (ex: Serge TABE DJATO)';


--
-- Name: COLUMN sondages.notes; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.notes IS 'LEGACY - utiliser meta->>''notes'' si n├®cessaire. Ne plus utiliser.';


--
-- Name: COLUMN sondages.type_sol; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.type_sol IS 'LEGACY - utiliser meta->>''type_sol'' si n├®cessaire. Ne plus utiliser.';


--
-- Name: COLUMN sondages.location_mode; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.location_mode IS 'Mode de localisation du sondage:

- unknown: Position inconnue (d├®faut)

- exact: Coordonn├®es GPS exactes

- adm3_centroid: Centro├»de de la commune ADM3

- random: Position al├®atoire dans la commune

- adm_random_cell: Position al├®atoire legacy (ancien syst├¿me)';


--
-- Name: COLUMN sondages.adm1_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.adm1_id IS 'LEGACY - utiliser adm3_id et remonter via adm3.adm2_id. Ne plus utiliser.';


--
-- Name: COLUMN sondages.adm2_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.adm2_id IS 'LEGACY - utiliser adm3_id et remonter via adm3.adm2_id. Ne plus utiliser.';


--
-- Name: COLUMN sondages.import_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.import_id IS 'LEGACY - tra├ºabilit├® ancienne. Ne plus utiliser.';


--
-- Name: COLUMN sondages.import_row_idx; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.import_row_idx IS 'LEGACY - tra├ºabilit├® ancienne. Ne plus utiliser.';


--
-- Name: COLUMN sondages.loc_mode; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.loc_mode IS 'LEGACY - remplac├® par is_geocoded. Ne plus utiliser.';


--
-- Name: COLUMN sondages.geom_real; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.geom_real IS 'GEOMETRY - position finale valid├®e (EPSG:25231)';


--
-- Name: COLUMN sondages.grid_code; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.grid_code IS 'TEXT - code de la maille g├®ographique';


--
-- Name: COLUMN sondages.localite_base; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.localite_base IS 'TEXT - localit├® normalis├®e pour matching';


--
-- Name: COLUMN sondages.localite_key; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.localite_key IS 'TEXT - cl├® de recherche pour localit├®';


--
-- Name: COLUMN sondages.id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.id IS 'PK UUID - identifiant unique du sondage';


--
-- Name: COLUMN sondages.date; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.date IS 'DATE - date du sondage (source de v├®rit├®)';


--
-- Name: COLUMN sondages.created_at; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.created_at IS 'TIMESTAMPTZ - date de cr├®ation de l''enregistrement';


--
-- Name: COLUMN sondages.updated_at; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.updated_at IS 'TIMESTAMPTZ - date de derni├¿re modification';


--
-- Name: COLUMN sondages.deleted_at; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.deleted_at IS 'TIMESTAMPTZ - soft delete (NULL = actif)';


--
-- Name: COLUMN sondages.adm3_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.adm3_id IS 'INTEGER - FK vers adm3 (commune)';


--
-- Name: COLUMN sondages.is_geocoded; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages.is_geocoded IS 'BOOLEAN - indique si le g├®ocodage est valid├®';


--
-- Name: mailles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mailles (
    id text NOT NULL,
    geom public.geometry,
    code text,
    stats text,
    updated_at text,
    adm1_code text,
    adm1_name text,
    adm2_code text,
    adm2_name text,
    adm3_code text,
    adm3_name text,
    geom_4326 public.geometry
);


--
-- Name: mv_mailles_geotech; Type: MATERIALIZED VIEW; Schema: atlas; Owner: -
--

CREATE MATERIALIZED VIEW atlas.mv_mailles_geotech AS
 WITH maille_sondages AS (
         SELECT m.id AS maille_id,
            m.code,
            m.geom,
            m.geom_4326,
            m.adm1_name,
            m.adm2_name,
            m.adm3_name,
            s.id AS sondage_id,
            s.location_mode
           FROM (public.mailles m
             LEFT JOIN atlas.sondages s ON ((public.st_contains(m.geom, public.st_transform(s.geom, 25231)) AND (s.deleted_at IS NULL) AND (s.geom IS NOT NULL))))
        ), maille_echantillons AS (
         SELECT ms_1.maille_id,
            ms_1.sondage_id,
            e.id AS echantillon_id,
            e.depth_m
           FROM (maille_sondages ms_1
             LEFT JOIN atlas.echantillons e ON ((e.sondage_id = ms_1.sondage_id)))
        ), agg_atterberg AS (
         SELECT me_1.maille_id,
            count(ea.id) AS n_essais_atterberg,
            avg(ea.wl) AS wl_avg,
            min(ea.wl) AS wl_min,
            max(ea.wl) AS wl_max,
            avg(ea.wp) AS wp_avg,
            min(ea.wp) AS wp_min,
            max(ea.wp) AS wp_max,
            avg(ea.ip_generated) AS ip_avg,
            min(ea.ip_generated) AS ip_min,
            max(ea.ip_generated) AS ip_max,
            stddev(ea.ip_generated) AS ip_stddev
           FROM (maille_echantillons me_1
             LEFT JOIN atlas.essais_atterberg ea ON ((ea.echantillon_id = me_1.echantillon_id)))
          WHERE (ea.id IS NOT NULL)
          GROUP BY me_1.maille_id
        ), agg_vbs AS (
         SELECT me_1.maille_id,
            count(ev.id) AS n_essais_vbs,
            avg(ev.vbs) AS vbs_avg,
            min(ev.vbs) AS vbs_min,
            max(ev.vbs) AS vbs_max,
            stddev(ev.vbs) AS vbs_stddev,
            count(
                CASE
                    WHEN (ev.vbs < 0.1) THEN 1
                    ELSE NULL::integer
                END) AS n_vbs_insensible,
            count(
                CASE
                    WHEN ((ev.vbs >= 0.1) AND (ev.vbs < 1.5)) THEN 1
                    ELSE NULL::integer
                END) AS n_vbs_peu_sensible,
            count(
                CASE
                    WHEN ((ev.vbs >= 1.5) AND (ev.vbs < 2.5)) THEN 1
                    ELSE NULL::integer
                END) AS n_vbs_sensible,
            count(
                CASE
                    WHEN ((ev.vbs >= 2.5) AND (ev.vbs < (6)::numeric)) THEN 1
                    ELSE NULL::integer
                END) AS n_vbs_moyen_argileux,
            count(
                CASE
                    WHEN ((ev.vbs >= (6)::numeric) AND (ev.vbs < (8)::numeric)) THEN 1
                    ELSE NULL::integer
                END) AS n_vbs_argileux,
            count(
                CASE
                    WHEN (ev.vbs >= (8)::numeric) THEN 1
                    ELSE NULL::integer
                END) AS n_vbs_tres_argileux
           FROM (maille_echantillons me_1
             LEFT JOIN atlas.essais_vbs ev ON ((ev.echantillon_id = me_1.echantillon_id)))
          WHERE (ev.id IS NOT NULL)
          GROUP BY me_1.maille_id
        ), agg_proctor AS (
         SELECT me_1.maille_id,
            count(ep.id) AS n_essais_proctor,
            avg(ep.gamma_d_max) AS gamma_d_max_avg,
            min(ep.gamma_d_max) AS gamma_d_max_min,
            max(ep.gamma_d_max) AS gamma_d_max_max,
            avg(ep.w_opt) AS w_opt_avg,
            min(ep.w_opt) AS w_opt_min,
            max(ep.w_opt) AS w_opt_max
           FROM (maille_echantillons me_1
             LEFT JOIN atlas.essais_proctor ep ON ((ep.echantillon_id = me_1.echantillon_id)))
          WHERE (ep.id IS NOT NULL)
          GROUP BY me_1.maille_id
        ), agg_gonflement AS (
         SELECT me_1.maille_id,
            count(eg.id) AS n_essais_gonflement,
            avg(eg.cg) AS eg_avg,
            min(eg.cg) AS eg_min,
            max(eg.cg) AS eg_max,
            stddev(eg.cg) AS eg_stddev,
            count(
                CASE
                    WHEN (eg.cg < 0.5) THEN 1
                    ELSE NULL::integer
                END) AS n_eg_negligeable,
            count(
                CASE
                    WHEN ((eg.cg >= 0.5) AND (eg.cg < (2)::numeric)) THEN 1
                    ELSE NULL::integer
                END) AS n_eg_faible,
            count(
                CASE
                    WHEN ((eg.cg >= (2)::numeric) AND (eg.cg < (5)::numeric)) THEN 1
                    ELSE NULL::integer
                END) AS n_eg_moyen,
            count(
                CASE
                    WHEN ((eg.cg >= (5)::numeric) AND (eg.cg < (10)::numeric)) THEN 1
                    ELSE NULL::integer
                END) AS n_eg_fort,
            count(
                CASE
                    WHEN (eg.cg >= (10)::numeric) THEN 1
                    ELSE NULL::integer
                END) AS n_eg_tres_fort
           FROM (maille_echantillons me_1
             LEFT JOIN atlas.essais_potentiel_gonflement eg ON ((eg.echantillon_id = me_1.echantillon_id)))
          WHERE (eg.id IS NOT NULL)
          GROUP BY me_1.maille_id
        ), agg_granulo AS (
         SELECT me_1.maille_id,
            count(DISTINCT gp.echantillon_id) AS n_essais_granulo,
            avg(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 0.08)) AS passant_80um_avg,
            min(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 0.08)) AS passant_80um_min,
            max(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 0.08)) AS passant_80um_max,
            avg(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 2.0)) AS passant_2mm_avg,
            min(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 2.0)) AS passant_2mm_min,
            max(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 2.0)) AS passant_2mm_max,
            avg(gp.passing_pct) FILTER (WHERE (gp.sieve_mm = 20.0)) AS passant_20mm_avg
           FROM (maille_echantillons me_1
             LEFT JOIN atlas.granulo_points gp ON ((gp.echantillon_id = me_1.echantillon_id)))
          WHERE (gp.id IS NOT NULL)
          GROUP BY me_1.maille_id
        ), agg_classif AS (
         SELECT me_1.maille_id,
            count(ec.id) AS n_essais_classif,
            count(ec.hrb) AS n_classif_hrb,
            count(ec.unified) AS n_classif_unified,
            count(ec.class_chassagneux) AS n_classif_amessefe
           FROM (maille_echantillons me_1
             LEFT JOIN atlas.essais_classif ec ON ((ec.echantillon_id = me_1.echantillon_id)))
          WHERE (ec.id IS NOT NULL)
          GROUP BY me_1.maille_id
        )
 SELECT ms.maille_id AS id,
    ms.code,
    ms.geom,
    ms.geom_4326,
    public.st_simplify(ms.geom_4326, (0.001)::double precision) AS geom_simplified,
    ms.adm1_name,
    ms.adm2_name,
    ms.adm3_name,
    count(DISTINCT ms.sondage_id) FILTER (WHERE (ms.sondage_id IS NOT NULL)) AS n_sondages,
    count(DISTINCT me.echantillon_id) FILTER (WHERE (me.echantillon_id IS NOT NULL)) AS n_echantillons,
    COALESCE(aa.n_essais_atterberg, (0)::bigint) AS n_essais_atterberg,
    COALESCE(av.n_essais_vbs, (0)::bigint) AS n_essais_vbs,
    COALESCE(ap.n_essais_proctor, (0)::bigint) AS n_essais_proctor,
    COALESCE(ag.n_essais_gonflement, (0)::bigint) AS n_essais_gonflement,
    COALESCE(agr.n_essais_granulo, (0)::bigint) AS n_essais_granulo,
    COALESCE(ac.n_essais_classif, (0)::bigint) AS n_essais_classif,
    (((((COALESCE(aa.n_essais_atterberg, (0)::bigint) + COALESCE(av.n_essais_vbs, (0)::bigint)) + COALESCE(ap.n_essais_proctor, (0)::bigint)) + COALESCE(ag.n_essais_gonflement, (0)::bigint)) + COALESCE(agr.n_essais_granulo, (0)::bigint)) + COALESCE(ac.n_essais_classif, (0)::bigint)) AS n_essais_total,
    min(me.depth_m) AS depth_min_m,
    max(me.depth_m) AS depth_max_m,
    avg(me.depth_m) AS depth_mean_m,
    aa.wl_avg,
    aa.wl_min,
    aa.wl_max,
    aa.wp_avg,
    aa.wp_min,
    aa.wp_max,
    aa.ip_avg,
    aa.ip_min,
    aa.ip_max,
    aa.ip_stddev,
    av.vbs_avg,
    av.vbs_min,
    av.vbs_max,
    av.vbs_stddev,
    av.n_vbs_insensible,
    av.n_vbs_peu_sensible,
    av.n_vbs_sensible,
    av.n_vbs_moyen_argileux,
    av.n_vbs_argileux,
    av.n_vbs_tres_argileux,
    ap.gamma_d_max_avg,
    ap.gamma_d_max_min,
    ap.gamma_d_max_max,
    ap.w_opt_avg,
    ap.w_opt_min,
    ap.w_opt_max,
    ag.eg_avg,
    ag.eg_min,
    ag.eg_max,
    ag.eg_stddev,
    ag.n_eg_negligeable,
    ag.n_eg_faible,
    ag.n_eg_moyen,
    ag.n_eg_fort,
    ag.n_eg_tres_fort,
    agr.passant_80um_avg,
    agr.passant_80um_min,
    agr.passant_80um_max,
    agr.passant_2mm_avg,
    agr.passant_2mm_min,
    agr.passant_2mm_max,
    agr.passant_20mm_avg,
    ac.n_classif_hrb,
    ac.n_classif_unified,
    ac.n_classif_amessefe,
        CASE
            WHEN (count(DISTINCT ms.sondage_id) FILTER (WHERE (ms.sondage_id IS NOT NULL)) > 0) THEN true
            ELSE false
        END AS has_data,
        CASE
            WHEN (count(DISTINCT ms.sondage_id) FILTER (WHERE (ms.location_mode = 'exact'::text)) > 0) THEN true
            ELSE false
        END AS has_exact_location,
        CASE
            WHEN (count(DISTINCT ms.sondage_id) FILTER (WHERE (ms.location_mode = ANY (ARRAY['adm_random_cell'::text, 'random'::text]))) > 0) THEN true
            ELSE false
        END AS has_random_location
   FROM (((((((maille_sondages ms
     LEFT JOIN maille_echantillons me ON (((me.maille_id = ms.maille_id) AND (me.sondage_id = ms.sondage_id))))
     LEFT JOIN agg_atterberg aa ON ((aa.maille_id = ms.maille_id)))
     LEFT JOIN agg_vbs av ON ((av.maille_id = ms.maille_id)))
     LEFT JOIN agg_proctor ap ON ((ap.maille_id = ms.maille_id)))
     LEFT JOIN agg_gonflement ag ON ((ag.maille_id = ms.maille_id)))
     LEFT JOIN agg_granulo agr ON ((agr.maille_id = ms.maille_id)))
     LEFT JOIN agg_classif ac ON ((ac.maille_id = ms.maille_id)))
  GROUP BY ms.maille_id, ms.code, ms.geom, ms.geom_4326, ms.adm1_name, ms.adm2_name, ms.adm3_name, aa.n_essais_atterberg, aa.wl_avg, aa.wl_min, aa.wl_max, aa.wp_avg, aa.wp_min, aa.wp_max, aa.ip_avg, aa.ip_min, aa.ip_max, aa.ip_stddev, av.n_essais_vbs, av.vbs_avg, av.vbs_min, av.vbs_max, av.vbs_stddev, av.n_vbs_insensible, av.n_vbs_peu_sensible, av.n_vbs_sensible, av.n_vbs_moyen_argileux, av.n_vbs_argileux, av.n_vbs_tres_argileux, ap.n_essais_proctor, ap.gamma_d_max_avg, ap.gamma_d_max_min, ap.gamma_d_max_max, ap.w_opt_avg, ap.w_opt_min, ap.w_opt_max, ag.n_essais_gonflement, ag.eg_avg, ag.eg_min, ag.eg_max, ag.eg_stddev, ag.n_eg_negligeable, ag.n_eg_faible, ag.n_eg_moyen, ag.n_eg_fort, ag.n_eg_tres_fort, agr.n_essais_granulo, agr.passant_80um_avg, agr.passant_80um_min, agr.passant_80um_max, agr.passant_2mm_avg, agr.passant_2mm_min, agr.passant_2mm_max, agr.passant_20mm_avg, ac.n_essais_classif, ac.n_classif_hrb, ac.n_classif_unified, ac.n_classif_amessefe
  WITH NO DATA;


--
-- Name: MATERIALIZED VIEW mv_mailles_geotech; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON MATERIALIZED VIEW atlas.mv_mailles_geotech IS 'Vue mat├®rialis├®e compl├¿te des statistiques g├®otechniques par maille (2x2km).

Source of truth: essais_atterberg, essais_vbs, essais_proctor, essais_potentiel_gonflement, granulo_points, essais_classif.

Utilis├®e par: Stats globales, Vue maille, Cartes th├®matiques.';


--
-- Name: COLUMN mv_mailles_geotech.n_sondages; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.n_sondages IS 'Nombre de sondages g├®ocod├®s dans cette maille';


--
-- Name: COLUMN mv_mailles_geotech.n_echantillons; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.n_echantillons IS 'Nombre d''├®chantillons distincts';


--
-- Name: COLUMN mv_mailles_geotech.n_essais_total; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.n_essais_total IS 'Somme de tous les types d''essais';


--
-- Name: COLUMN mv_mailles_geotech.ip_avg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.ip_avg IS 'Indice de plasticit├® moyen (IP = WL - WP)';


--
-- Name: COLUMN mv_mailles_geotech.vbs_avg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.vbs_avg IS 'Valeur de Bleu moyenne (argilosit├®)';


--
-- Name: COLUMN mv_mailles_geotech.eg_avg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.eg_avg IS 'Potentiel de gonflement moyen';


--
-- Name: COLUMN mv_mailles_geotech.passant_80um_avg; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.passant_80um_avg IS 'Pourcentage passant 80┬Ám moyen (fines)';


--
-- Name: COLUMN mv_mailles_geotech.has_exact_location; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.has_exact_location IS 'true si au moins un sondage avec location_mode=exact';


--
-- Name: COLUMN mv_mailles_geotech.has_random_location; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.mv_mailles_geotech.has_random_location IS 'true si au moins un sondage avec location_mode=random ou adm_random_cell';


--
-- Name: risque_gonflement; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.risque_gonflement (
    ogc_fid integer NOT NULL,
    geom public.geometry(MultiPolygon,25231),
    type_sols character varying(254),
    type_sol character varying(254),
    risque_gonflement character varying(100),
    code character varying(50),
    libelle text,
    description text,
    niveau_risque character varying(50)
);


--
-- Name: unites_geologiques; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.unites_geologiques (
    ogc_fid integer NOT NULL,
    geom public.geometry(MultiPolygon,25231),
    id bigint,
    type_sols character varying(254),
    code character varying(50),
    libelle text,
    description text
);


--
-- Name: unites_pedologiques; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.unites_pedologiques (
    ogc_fid integer NOT NULL,
    geom public.geometry(MultiPolygon,25231),
    id bigint,
    type_sol character varying(254),
    code character varying(50),
    libelle text,
    description text
);


--
-- Name: v_mailles_context; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_mailles_context AS
 WITH geol_intersections AS (
         SELECT m_1.code,
            g.libelle AS geol_unit,
            public.st_area(public.st_intersection(m_1.geom, g.geom)) AS inter_area,
            row_number() OVER (PARTITION BY m_1.code ORDER BY (public.st_area(public.st_intersection(m_1.geom, g.geom))) DESC) AS rn
           FROM (atlas.mailles m_1
             JOIN atlas.unites_geologiques g ON (public.st_intersects(m_1.geom, g.geom)))
          WHERE (g.geom IS NOT NULL)
        ), geol_main AS (
         SELECT geol_intersections.code,
            geol_intersections.geol_unit
           FROM geol_intersections
          WHERE (geol_intersections.rn = 1)
        ), pedo_intersections AS (
         SELECT m_1.code,
            p.libelle AS pedo_unit,
            public.st_area(public.st_intersection(m_1.geom, p.geom)) AS inter_area,
            row_number() OVER (PARTITION BY m_1.code ORDER BY (public.st_area(public.st_intersection(m_1.geom, p.geom))) DESC) AS rn
           FROM (atlas.mailles m_1
             JOIN atlas.unites_pedologiques p ON (public.st_intersects(m_1.geom, p.geom)))
          WHERE (p.geom IS NOT NULL)
        ), pedo_main AS (
         SELECT pedo_intersections.code,
            pedo_intersections.pedo_unit
           FROM pedo_intersections
          WHERE (pedo_intersections.rn = 1)
        ), swelling_intersections AS (
         SELECT m_1.code,
            COALESCE(r.niveau_risque, r.risque_gonflement) AS swelling_class,
            public.st_area(public.st_intersection(m_1.geom, r.geom)) AS inter_area,
            row_number() OVER (PARTITION BY m_1.code ORDER BY (public.st_area(public.st_intersection(m_1.geom, r.geom))) DESC) AS rn
           FROM (atlas.mailles m_1
             JOIN atlas.risque_gonflement r ON (public.st_intersects(m_1.geom, r.geom)))
          WHERE (r.geom IS NOT NULL)
        ), swelling_main AS (
         SELECT swelling_intersections.code,
            swelling_intersections.swelling_class
           FROM swelling_intersections
          WHERE (swelling_intersections.rn = 1)
        )
 SELECT m.code,
    gm.geol_unit,
    pm.pedo_unit,
    sm.swelling_class
   FROM (((atlas.mailles m
     LEFT JOIN geol_main gm USING (code))
     LEFT JOIN pedo_main pm USING (code))
     LEFT JOIN swelling_main sm USING (code));


--
-- Name: VIEW v_mailles_context; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_mailles_context IS 'Vue calculant le contexte géologique/pédologique/gonflement dominant pour chaque maille 2km';


--
-- Name: v_mailles_with_location_counts; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_mailles_with_location_counts AS
 WITH location_counts AS (
         SELECT m.code,
            count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['exact'::text, 'gps'::text, 'manual'::text]))) AS n_sondages_exact,
            count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['adm_random_cell'::text, 'adm3'::text, 'adm2'::text, 'adm1'::text, 'random'::text]))) AS n_sondages_random
           FROM (atlas.mailles m
             LEFT JOIN atlas.sondages s ON ((public.st_contains(m.geom, public.st_transform(s.geom, 25231)) AND (s.deleted_at IS NULL) AND (s.geom IS NOT NULL))))
          GROUP BY m.code
        )
 SELECT mv.id,
    mv.code,
    mv.geom,
    mv.geom_4326,
    mv.geom_simplified,
    mv.adm1_name,
    mv.adm2_name,
    mv.adm3_name,
    mv.n_sondages,
    mv.n_echantillons,
    mv.n_essais_atterberg,
    mv.n_essais_vbs,
    mv.n_essais_proctor,
    mv.n_essais_gonflement,
    mv.n_essais_granulo,
    mv.n_essais_classif,
    mv.n_essais_total,
    mv.depth_min_m,
    mv.depth_max_m,
    mv.depth_mean_m,
    mv.wl_avg,
    mv.wl_min,
    mv.wl_max,
    mv.wp_avg,
    mv.wp_min,
    mv.wp_max,
    mv.ip_avg,
    mv.ip_min,
    mv.ip_max,
    mv.ip_stddev,
    mv.vbs_avg,
    mv.vbs_min,
    mv.vbs_max,
    mv.vbs_stddev,
    mv.n_vbs_insensible,
    mv.n_vbs_peu_sensible,
    mv.n_vbs_sensible,
    mv.n_vbs_moyen_argileux,
    mv.n_vbs_argileux,
    mv.n_vbs_tres_argileux,
    mv.gamma_d_max_avg,
    mv.gamma_d_max_min,
    mv.gamma_d_max_max,
    mv.w_opt_avg,
    mv.w_opt_min,
    mv.w_opt_max,
    mv.eg_avg,
    mv.eg_min,
    mv.eg_max,
    mv.eg_stddev,
    mv.n_eg_negligeable,
    mv.n_eg_faible,
    mv.n_eg_moyen,
    mv.n_eg_fort,
    mv.n_eg_tres_fort,
    mv.passant_80um_avg,
    mv.passant_80um_min,
    mv.passant_80um_max,
    mv.passant_2mm_avg,
    mv.passant_2mm_min,
    mv.passant_2mm_max,
    mv.passant_20mm_avg,
    mv.n_classif_hrb,
    mv.n_classif_unified,
    mv.n_classif_amessefe,
    mv.has_data,
    mv.has_exact_location,
    mv.has_random_location,
    (COALESCE(lc.n_sondages_exact, (0)::bigint))::integer AS n_sondages_exact,
    (COALESCE(lc.n_sondages_random, (0)::bigint))::integer AS n_sondages_random
   FROM (atlas.mv_mailles_geotech mv
     LEFT JOIN location_counts lc ON ((lc.code = mv.code)));


--
-- Name: VIEW v_mailles_with_location_counts; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_mailles_with_location_counts IS 'Vue enrichie de mv_mailles_geotech avec compteurs de localisation exact/random';


--
-- Name: mailles_geotechnique_stats_wgs84; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.mailles_geotechnique_stats_wgs84 AS
 SELECT mg.id,
    mg.code,
    mg.geom,
    mg.geom_4326,
    mg.geom_simplified,
    mg.adm1_name,
    mg.adm2_name,
    mg.adm3_name,
    mg.n_sondages,
    mg.n_echantillons,
    mg.n_essais_atterberg,
    mg.n_essais_vbs,
    mg.n_essais_proctor,
    mg.n_essais_gonflement,
    mg.n_essais_granulo,
    mg.n_essais_classif,
    mg.n_essais_total,
    mg.depth_min_m,
    mg.depth_max_m,
    mg.depth_mean_m,
    mg.wl_avg,
    mg.wl_min,
    mg.wl_max,
    mg.wp_avg,
    mg.wp_min,
    mg.wp_max,
    mg.ip_avg,
    mg.ip_min,
    mg.ip_max,
    mg.ip_stddev,
    mg.vbs_avg,
    mg.vbs_min,
    mg.vbs_max,
    mg.vbs_stddev,
    mg.n_vbs_insensible,
    mg.n_vbs_peu_sensible,
    mg.n_vbs_sensible,
    mg.n_vbs_moyen_argileux,
    mg.n_vbs_argileux,
    mg.n_vbs_tres_argileux,
    mg.gamma_d_max_avg,
    mg.gamma_d_max_min,
    mg.gamma_d_max_max,
    mg.w_opt_avg,
    mg.w_opt_min,
    mg.w_opt_max,
    mg.eg_avg,
    mg.eg_min,
    mg.eg_max,
    mg.eg_stddev,
    mg.n_eg_negligeable,
    mg.n_eg_faible,
    mg.n_eg_moyen,
    mg.n_eg_fort,
    mg.n_eg_tres_fort,
    mg.passant_80um_avg,
    mg.passant_80um_min,
    mg.passant_80um_max,
    mg.passant_2mm_avg,
    mg.passant_2mm_min,
    mg.passant_2mm_max,
    mg.passant_20mm_avg,
    mg.n_classif_hrb,
    mg.n_classif_unified,
    mg.n_classif_amessefe,
    mg.has_data,
    mg.has_exact_location,
    mg.has_random_location,
    mg.n_sondages_exact,
    mg.n_sondages_random,
    ctx.geol_unit,
    ctx.pedo_unit,
    ctx.swelling_class
   FROM (atlas.v_mailles_with_location_counts mg
     LEFT JOIN atlas.v_mailles_context ctx ON ((ctx.code = mg.code)));


--
-- Name: VIEW mailles_geotechnique_stats_wgs84; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.mailles_geotechnique_stats_wgs84 IS 'Vue principale pour l''API - mailles 2km avec stats géotechniques + contexte géologique/pédologique/gonflement';


--
-- Name: password_reset_tokens; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.password_reset_tokens (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    expires_at timestamp with time zone NOT NULL,
    used_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    ip_address inet
);


--
-- Name: TABLE password_reset_tokens; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.password_reset_tokens IS 'Tokens de r├®initialisation mot de passe';


--
-- Name: permissions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.permissions (
    id character varying(100) NOT NULL,
    resource character varying(50) NOT NULL,
    action character varying(50) NOT NULL,
    description text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE permissions; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.permissions IS 'Permissions granulaires du syst├¿me RBAC';


--
-- Name: COLUMN permissions.id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.permissions.id IS 'Identifiant unique (format: resource.action)';


--
-- Name: COLUMN permissions.resource; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.permissions.resource IS 'Ressource concern├®e (tables, staging, schema, etc.)';


--
-- Name: COLUMN permissions.action; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.permissions.action IS 'Action autoris├®e (read, write, delete, etc.)';


--
-- Name: recent_changesets; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.recent_changesets AS
 SELECT id,
    table_name,
    operation,
    created_at,
    created_by,
    (undone_at IS NOT NULL) AS is_undone,
        CASE
            WHEN (undone_at IS NOT NULL) THEN 'undone'::text
            WHEN (created_at > (now() - '01:00:00'::interval)) THEN 'recent'::text
            ELSE 'old'::text
        END AS status
   FROM atlas.changesets
  ORDER BY created_at DESC
 LIMIT 100;


--
-- Name: VIEW recent_changesets; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.recent_changesets IS 'Vue des 100 derniers changesets';


--
-- Name: risque_gonflement_ogc_fid_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.risque_gonflement_ogc_fid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: risque_gonflement_ogc_fid_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.risque_gonflement_ogc_fid_seq OWNED BY atlas.risque_gonflement.ogc_fid;


--
-- Name: role_permissions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.role_permissions (
    role_id character varying(50) NOT NULL,
    permission_id character varying(100) NOT NULL,
    granted_at timestamp with time zone DEFAULT now(),
    granted_by uuid
);


--
-- Name: TABLE role_permissions; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.role_permissions IS 'Association r├┤les-permissions';


--
-- Name: roles; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.roles (
    id character varying(50) NOT NULL,
    name character varying(100) NOT NULL,
    description text,
    is_system boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE roles; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.roles IS 'R├┤les du syst├¿me RBAC';


--
-- Name: COLUMN roles.is_system; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.roles.is_system IS 'R├┤le syst├¿me non supprimable (admin, editor, viewer)';


--
-- Name: sessions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.sessions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    token_hash character varying(64) NOT NULL,
    refresh_token_hash character varying(64),
    user_agent text,
    ip_address inet,
    device_info jsonb,
    is_active boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    refresh_expires_at timestamp with time zone,
    last_activity_at timestamp with time zone DEFAULT now(),
    revoked_at timestamp with time zone,
    revoked_reason character varying(100)
);


--
-- Name: TABLE sessions; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.sessions IS 'Sessions utilisateur actives';


--
-- Name: COLUMN sessions.token_hash; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sessions.token_hash IS 'Hash SHA-256 du JWT access token';


--
-- Name: COLUMN sessions.refresh_token_hash; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sessions.refresh_token_hash IS 'Hash SHA-256 du refresh token';


--
-- Name: sondages_legacy_20251117; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.sondages_legacy_20251117 (
    id uuid NOT NULL,
    geom public.geometry(Point,25231) NOT NULL,
    date_sondage date,
    source text,
    meta jsonb DEFAULT '{}'::jsonb
);


--
-- Name: sondages_non_geocodes; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.sondages_non_geocodes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code text NOT NULL,
    adm1 text,
    adm2 text,
    adm3 text,
    commune_id integer,
    localite text,
    date_sondage date,
    profondeur_m numeric(10,2),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    metadata jsonb
);


--
-- Name: TABLE sondages_non_geocodes; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.sondages_non_geocodes IS 'Sondages en attente de g├®ocodage';


--
-- Name: COLUMN sondages_non_geocodes.adm1; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages_non_geocodes.adm1 IS 'Division administrative niveau 1 (pas "adm1_name")';


--
-- Name: COLUMN sondages_non_geocodes.adm2; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages_non_geocodes.adm2 IS 'Division administrative niveau 2 (pas "adm2_name")';


--
-- Name: COLUMN sondages_non_geocodes.adm3; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages_non_geocodes.adm3 IS 'Division administrative niveau 3 (pas "adm3_name")';


--
-- Name: COLUMN sondages_non_geocodes.localite; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages_non_geocodes.localite IS 'Localit├® du sondage (utilis├® comme "source")';


--
-- Name: COLUMN sondages_non_geocodes.date_sondage; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.sondages_non_geocodes.date_sondage IS 'Date du sondage (pas "date")';


--
-- Name: staging_locks; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_locks (
    table_name text NOT NULL,
    locked_by text NOT NULL,
    user_email text,
    locked_at timestamp with time zone DEFAULT now(),
    expires_at timestamp with time zone NOT NULL,
    staging_id text,
    reason text
);


--
-- Name: TABLE staging_locks; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.staging_locks IS 'Verrouillage des tables en cours d''├®dition pour ├®viter conflits';


--
-- Name: COLUMN staging_locks.table_name; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.staging_locks.table_name IS 'Nom complet de la table (schema.table)';


--
-- Name: COLUMN staging_locks.locked_by; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.staging_locks.locked_by IS 'Identifiant utilisateur';


--
-- Name: COLUMN staging_locks.expires_at; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.staging_locks.expires_at IS 'Date d''expiration du lock (d├®faut 15 min)';


--
-- Name: COLUMN staging_locks.staging_id; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.staging_locks.staging_id IS 'ID du staging associ├®';


--
-- Name: staging_metadata; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_metadata (
    staging_id text NOT NULL,
    table_name text NOT NULL,
    schema_name text NOT NULL,
    staging_table_name text NOT NULL,
    reason text,
    operations_count bigint DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE staging_metadata; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.staging_metadata IS 'M├®tadonn├®es des tables de staging pour les modifications en attente';


--
-- Name: staging_test_staging_commit_0ed8a364eae9428a8e3031c96fc9bbf8; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_commit_0ed8a364eae9428a8e3031c96fc9bbf8 (
    id integer NOT NULL,
    name text NOT NULL,
    value integer,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_commit_4f73d120_7047_4565_a744_142b3bc29fd; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_commit_4f73d120_7047_4565_a744_142b3bc29fd (
    id integer NOT NULL,
    name text NOT NULL,
    value integer,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_commit_82449d2b5ef4471abda4ccf80cb46d98; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_commit_82449d2b5ef4471abda4ccf80cb46d98 (
    id integer NOT NULL,
    name text NOT NULL,
    value integer,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_commit_9aabfebb_e76a_4ec3_bff6_71b7de7b0c4; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_commit_9aabfebb_e76a_4ec3_bff6_71b7de7b0c4 (
    id integer NOT NULL,
    name text NOT NULL,
    value integer,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_commit_b6eda30a9c0f4e08b8f1203f212186b7; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_commit_b6eda30a9c0f4e08b8f1203f212186b7 (
    id integer NOT NULL,
    name text NOT NULL,
    value integer,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_commit_ef9e5cc5_4c89_4452_a21f_6dea323e514; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_commit_ef9e5cc5_4c89_4452_a21f_6dea323e514 (
    id integer NOT NULL,
    name text NOT NULL,
    value integer,
    _staging_op character varying(10)
);


--
-- Name: test_staging_rollback; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.test_staging_rollback (
    id integer NOT NULL,
    code text NOT NULL,
    name text
);


--
-- Name: test_staging_rollback_id_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.test_staging_rollback_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: test_staging_rollback_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.test_staging_rollback_id_seq OWNED BY atlas.test_staging_rollback.id;


--
-- Name: staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489bffcd; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489bffcd (
    id integer DEFAULT nextval('atlas.test_staging_rollback_id_seq'::regclass) NOT NULL,
    code text NOT NULL,
    name text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf0fafe; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf0fafe (
    id integer NOT NULL,
    code text NOT NULL,
    name text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_simple_95ce013a94964905963323b6ed776d00; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_simple_95ce013a94964905963323b6ed776d00 (
    id integer NOT NULL,
    code text NOT NULL,
    name text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_validation_35427a5d8c614ee2a6d465867417477; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_validation_35427a5d8c614ee2a6d465867417477 (
    id integer NOT NULL,
    required_field text NOT NULL,
    optional_field text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_validation_588b08c858c04fd5969ad7455444245; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_validation_588b08c858c04fd5969ad7455444245 (
    id integer NOT NULL,
    required_field text NOT NULL,
    optional_field text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_validation_62ba95fe_5606_40e3_b9b7_9f53972; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_validation_62ba95fe_5606_40e3_b9b7_9f53972 (
    id integer NOT NULL,
    required_field text NOT NULL,
    optional_field text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_validation_aa5fa5f42afe4f358a1c6674f5ca8ac; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_validation_aa5fa5f42afe4f358a1c6674f5ca8ac (
    id integer NOT NULL,
    required_field text NOT NULL,
    optional_field text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_validation_c3c5d24d_503f_470d_a9a5_3f7a834; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_validation_c3c5d24d_503f_470d_a9a5_3f7a834 (
    id integer NOT NULL,
    required_field text NOT NULL,
    optional_field text,
    _staging_op character varying(10)
);


--
-- Name: staging_test_staging_validation_c7876d39_7d1e_4bc5_8e94_29278d7; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.staging_test_staging_validation_c7876d39_7d1e_4bc5_8e94_29278d7 (
    id integer NOT NULL,
    required_field text NOT NULL,
    optional_field text,
    _staging_op character varying(10)
);


--
-- Name: survey_aliases; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.survey_aliases (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    alias_code text NOT NULL,
    source text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: survey_tests; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.survey_tests (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    survey_id uuid NOT NULL,
    test_type text NOT NULL,
    raw_source_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: surveys; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.surveys (
    id uuid,
    code text,
    localite_canon text,
    localite text,
    source text,
    localite_key text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    adm3_id integer,
    geom public.geometry,
    geom_geojson jsonb,
    location_mode text,
    location_accuracy text,
    is_geocoded boolean,
    has_geom boolean,
    has_adm3 boolean,
    date date,
    date_sondage text,
    operator text,
    notes text,
    comment text,
    meta text,
    nb_sondages_source integer,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone
);


--
-- Name: table_versions; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.table_versions (
    version integer NOT NULL,
    table_name text NOT NULL,
    schema_snapshot jsonb NOT NULL,
    row_count bigint DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    description text,
    CONSTRAINT table_versions_table_name_check CHECK ((table_name ~ '^[a-z_][a-z0-9_]*\.[a-z_][a-z0-9_]*$'::text))
);


--
-- Name: TABLE table_versions; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.table_versions IS 'Versions/snapshots des sch├®mas de tables';


--
-- Name: COLUMN table_versions.schema_snapshot; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.table_versions.schema_snapshot IS 'Snapshot du sch├®ma de la table (colonnes, types, contraintes)';


--
-- Name: COLUMN table_versions.row_count; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.table_versions.row_count IS 'Nombre de lignes au moment du snapshot';


--
-- Name: table_versions_version_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.table_versions_version_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: table_versions_version_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.table_versions_version_seq OWNED BY atlas.table_versions.version;


--
-- Name: unites_geologiques_ogc_fid_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.unites_geologiques_ogc_fid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unites_geologiques_ogc_fid_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.unites_geologiques_ogc_fid_seq OWNED BY atlas.unites_geologiques.ogc_fid;


--
-- Name: unites_pedologiques_ogc_fid_seq; Type: SEQUENCE; Schema: atlas; Owner: -
--

CREATE SEQUENCE atlas.unites_pedologiques_ogc_fid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: unites_pedologiques_ogc_fid_seq; Type: SEQUENCE OWNED BY; Schema: atlas; Owner: -
--

ALTER SEQUENCE atlas.unites_pedologiques_ogc_fid_seq OWNED BY atlas.unites_pedologiques.ogc_fid;


--
-- Name: user_roles; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.user_roles (
    user_id uuid NOT NULL,
    role_id character varying(50) NOT NULL,
    assigned_at timestamp with time zone DEFAULT now(),
    assigned_by uuid,
    expires_at timestamp with time zone
);


--
-- Name: TABLE user_roles; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.user_roles IS 'Association utilisateurs-r├┤les';


--
-- Name: COLUMN user_roles.expires_at; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.user_roles.expires_at IS 'Date expiration du r├┤le (NULL = permanent)';


--
-- Name: users; Type: TABLE; Schema: atlas; Owner: -
--

CREATE TABLE atlas.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email character varying(255) NOT NULL,
    username character varying(100) NOT NULL,
    password_hash character varying(255) NOT NULL,
    first_name character varying(100),
    last_name character varying(100),
    avatar_url text,
    is_active boolean DEFAULT true,
    is_verified boolean DEFAULT false,
    failed_login_attempts integer DEFAULT 0,
    locked_until timestamp with time zone,
    last_login_at timestamp with time zone,
    last_login_ip inet,
    password_changed_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    created_by uuid,
    deleted_at timestamp with time zone,
    CONSTRAINT email_format CHECK (((email)::text ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'::text)),
    CONSTRAINT username_format CHECK (((username)::text ~* '^[a-zA-Z0-9_-]{3,50}$'::text))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TABLE atlas.users IS 'Utilisateurs du syst├¿me';


--
-- Name: COLUMN users.password_hash; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.users.password_hash IS 'Hash Argon2id du mot de passe';


--
-- Name: COLUMN users.failed_login_attempts; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.users.failed_login_attempts IS 'Compteur tentatives ├®chou├®es (reset apr├¿s succ├¿s)';


--
-- Name: COLUMN users.locked_until; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON COLUMN atlas.users.locked_until IS 'Compte verrouill├® jusqu''├á cette date';


--
-- Name: v_active_staging; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_active_staging AS
 SELECT staging_id,
    schema_name,
    table_name,
    staging_table_name,
    reason,
    operations_count,
    created_at,
    (EXTRACT(epoch FROM (now() - created_at)) / (3600)::numeric) AS age_hours,
    pg_size_pretty(pg_total_relation_size((((schema_name || '.'::text) || staging_table_name))::regclass)) AS size
   FROM atlas.staging_metadata s
  ORDER BY created_at DESC;


--
-- Name: VIEW v_active_staging; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_active_staging IS 'Vue des staging actifs avec leur ├óge et taille';


--
-- Name: essais_atterberg; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_atterberg AS
 SELECT id,
    echantillon_id,
    meta,
    created_at,
    wl,
    wp,
    ip_generated
   FROM atlas.essais_atterberg;


--
-- Name: essais_geotechniques; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_geotechniques AS
 SELECT id,
    sondage_id,
    depth_m,
    passant_80um,
    passant_2mm,
    passant_20mm,
    wl,
    wp,
    ip,
    vbs,
    gamma_d_max,
    w_opt,
    proctor_type,
    eg,
    test_date,
    laboratory,
    norm,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by,
    created_by_batch,
    updated_by_batch,
    deleted_by_batch,
    deleted_at,
    echantillon_id,
    cg,
    cg_qual,
    class_chassagneux,
    class_daksha,
    class_seed,
    class_vijay,
    type_sol,
    vbs_qual
   FROM atlas.essais_geotechniques;


--
-- Name: essais_vbs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_vbs AS
 SELECT id,
    echantillon_id,
    commentaire,
    meta,
    created_at,
    vbs
   FROM atlas.essais_vbs;


--
-- Name: sondages; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.sondages AS
 SELECT geom,
    date_sondage,
    source,
    meta,
    code,
    depth_m_min,
    depth_m_max,
    maille_code,
    adm1_name,
    adm2_name,
    adm3_name,
    comment,
    location_accuracy,
    operator,
    notes,
    type_sol,
    location_mode,
    adm1_id,
    adm2_id,
    import_id,
    import_row_idx,
    loc_mode,
    geom_real,
    created_by_batch,
    updated_by_batch,
    deleted_by_batch,
    grid_code,
    localite_base,
    localite_key,
    localite,
    id,
    date,
    created_at,
    updated_at,
    deleted_at,
    adm3_id,
    is_geocoded
   FROM atlas.sondages;


--
-- Name: v_maille_kpi_adm2; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_kpi_adm2 AS
 SELECT m.id AS maille_id,
    m.code AS maille_code,
    m.adm2_name,
    count(DISTINCT s.id) AS n_sondages,
    count(DISTINCT eg.id) AS n_essais_eg,
    count(DISTINCT vbs.id) AS n_essais_vbs,
    count(DISTINCT att.id) AS n_essais_atterberg,
    avg(eg.eg) AS eg_avg,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((eg.eg)::double precision)) AS eg_med,
    min(eg.eg) AS eg_min,
    max(eg.eg) AS eg_max,
    stddev(eg.eg) AS eg_std,
    avg(vbs.vbs) AS vbs_avg,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((vbs.vbs)::double precision)) AS vbs_med,
    min(vbs.vbs) AS vbs_min,
    max(vbs.vbs) AS vbs_max,
    stddev(vbs.vbs) AS vbs_std,
    avg(att.ip_generated) AS ip_avg,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((att.ip_generated)::double precision)) AS ip_med,
    min(att.ip_generated) AS ip_min,
    max(att.ip_generated) AS ip_max,
    stddev(att.ip_generated) AS ip_std,
    avg(att.wl) AS wl_avg,
    avg(att.wp) AS wp_avg
   FROM ((((atlas.mailles m
     LEFT JOIN public.sondages s ON (public.st_contains(m.geom, s.geom)))
     LEFT JOIN public.essais_geotechniques eg ON ((s.id = eg.sondage_id)))
     LEFT JOIN public.essais_vbs vbs ON ((eg.echantillon_id = vbs.echantillon_id)))
     LEFT JOIN public.essais_atterberg att ON ((eg.echantillon_id = att.echantillon_id)))
  GROUP BY m.id, m.code, m.adm2_name;


--
-- Name: VIEW v_maille_kpi_adm2; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_maille_kpi_adm2 IS 'Vue des mailles avec KPI g├â┬®otechniques agr├â┬®g├â┬®s par pr├â┬®fecture (ADM2)';


--
-- Name: v_adm2_kpi; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_adm2_kpi AS
 SELECT adm2_name,
    count(*) AS n_mailles_total,
    count(*) FILTER (WHERE (n_sondages > 0)) AS n_mailles_avec_donnees,
    round((((count(*) FILTER (WHERE (n_sondages > 0)))::numeric * 100.0) / (count(*))::numeric), 1) AS couverture_pct,
    sum(n_sondages) AS n_sondages_total,
    sum(n_essais_eg) AS n_essais_eg_total,
    sum(n_essais_vbs) AS n_essais_vbs_total,
    sum(n_essais_atterberg) AS n_essais_atterberg_total,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((eg_avg)::double precision)) AS eg_med,
    avg(eg_avg) AS eg_avg,
    stddev(eg_avg) AS eg_std,
    min(eg_avg) AS eg_min,
    max(eg_avg) AS eg_max,
    percentile_cont((0.1)::double precision) WITHIN GROUP (ORDER BY ((eg_avg)::double precision)) AS eg_p10,
    percentile_cont((0.9)::double precision) WITHIN GROUP (ORDER BY ((eg_avg)::double precision)) AS eg_p90,
    percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((eg_avg)::double precision)) AS eg_q1,
    percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((eg_avg)::double precision)) AS eg_q3,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((vbs_avg)::double precision)) AS vbs_med,
    avg(vbs_avg) AS vbs_avg,
    stddev(vbs_avg) AS vbs_std,
    min(vbs_avg) AS vbs_min,
    max(vbs_avg) AS vbs_max,
    percentile_cont((0.1)::double precision) WITHIN GROUP (ORDER BY ((vbs_avg)::double precision)) AS vbs_p10,
    percentile_cont((0.9)::double precision) WITHIN GROUP (ORDER BY ((vbs_avg)::double precision)) AS vbs_p90,
    percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((vbs_avg)::double precision)) AS vbs_q1,
    percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((vbs_avg)::double precision)) AS vbs_q3,
    percentile_cont((0.5)::double precision) WITHIN GROUP (ORDER BY ((ip_avg)::double precision)) AS ip_med,
    avg(ip_avg) AS ip_avg,
    stddev(ip_avg) AS ip_std,
    min(ip_avg) AS ip_min,
    max(ip_avg) AS ip_max,
    percentile_cont((0.1)::double precision) WITHIN GROUP (ORDER BY ((ip_avg)::double precision)) AS ip_p10,
    percentile_cont((0.9)::double precision) WITHIN GROUP (ORDER BY ((ip_avg)::double precision)) AS ip_p90,
    percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((ip_avg)::double precision)) AS ip_q1,
    percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((ip_avg)::double precision)) AS ip_q3,
    avg(wl_avg) AS wl_avg,
    avg(wp_avg) AS wp_avg
   FROM atlas.v_maille_kpi_adm2
  WHERE (adm2_name IS NOT NULL)
  GROUP BY adm2_name
  ORDER BY (count(*) FILTER (WHERE (n_sondages > 0))) DESC;


--
-- Name: VIEW v_adm2_kpi; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_adm2_kpi IS 'Vue des KPI g├â┬®otechniques agr├â┬®g├â┬®s par pr├â┬®fecture (ADM2) avec statistiques robustes';


--
-- Name: v_audit_stats; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_audit_stats AS
 SELECT schema_name,
    table_name,
    operation,
    count(*) AS operation_count,
    sum(rows_affected) AS total_rows_affected,
    max(created_at) AS last_operation,
    count(DISTINCT user_id) AS unique_users
   FROM atlas.audit_log
  GROUP BY schema_name, table_name, operation;


--
-- Name: VIEW v_audit_stats; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_audit_stats IS 'Statistiques agr├®g├®es des op├®rations d''audit par table et op├®ration';


--
-- Name: v_colab_answers; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_answers AS
 SELECT a.id,
    a.question_id,
    a.body,
    a.author_id,
    u.username AS author_username,
    a.is_best,
    a.is_accepted,
    a.score,
    a.created_at,
    a.updated_at,
    us.reputation_points AS author_reputation
   FROM ((atlas.colab_answers a
     JOIN atlas.users u ON ((a.author_id = u.id)))
     LEFT JOIN atlas.colab_user_stats us ON ((a.author_id = us.user_id)));


--
-- Name: v_colab_assignments_by_adm; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_assignments_by_adm AS
 SELECT a.adm_code_used,
    sp.adm_niveau,
    count(DISTINCT a.student_id) AS nb_etudiants,
    count(DISTINCT a.maille_id) AS nb_mailles_attribuees,
    min(a.assigned_at) AS first_assignment,
    max(a.assigned_at) AS last_assignment
   FROM ((atlas.colab_maille_assignments a
     JOIN atlas.colab_students cs ON ((cs.id = a.student_id)))
     JOIN atlas.colab_student_prefs sp ON ((sp.student_id = (cs.matricule)::text)))
  GROUP BY a.adm_code_used, sp.adm_niveau
  ORDER BY sp.adm_niveau, (count(DISTINCT a.student_id)) DESC;


--
-- Name: v_colab_comments; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_comments AS
 SELECT c.id,
    c.entity_type,
    c.entity_id,
    c.content,
    c.parent_comment_id,
    c.is_edited,
    c.created_at,
    c.updated_at,
    c.author_id,
    u.username AS author_username,
    u.email AS author_email,
    ( SELECT count(*) AS count
           FROM atlas.colab_comments r
          WHERE (r.parent_comment_id = c.id)) AS replies_count
   FROM (atlas.colab_comments c
     JOIN atlas.users u ON ((c.author_id = u.id)));


--
-- Name: v_colab_leaderboard; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_leaderboard AS
 SELECT us.user_id,
    u.username,
    u.email,
    us.reputation_points,
    us.questions_count,
    us.answers_count,
    us.best_answers_count,
    us.last_active_at,
    ( SELECT count(*) AS count
           FROM atlas.colab_user_badges ub
          WHERE (ub.user_id = us.user_id)) AS badges_count
   FROM (atlas.colab_user_stats us
     JOIN atlas.users u ON ((us.user_id = u.id)))
  ORDER BY us.reputation_points DESC;


--
-- Name: v_colab_maille_assignment_details; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_maille_assignment_details AS
 SELECT a.assignment_id,
    a.student_id,
    sp.nom,
    sp.prenom,
    ((sp.nom || ' '::text) || sp.prenom) AS full_name,
    sp.telephone,
    sp.email,
    sp.adm_niveau,
    sp.adm_code_pref_1,
    sp.adm_code_pref_2,
    sp.adm_code_pref_3,
    a.adm_code_used,
    a.pref_rank_used,
    a.assigned_at,
    m.id AS maille_id,
    m.code AS maille_code,
    m.pref_code AS maille_pref_code,
    m.pref_name AS maille_pref_name,
    m.adm2_name AS maille_adm2_name,
    m.geom,
    public.st_xmin((m.geom)::public.box3d) AS bbox_xmin,
    public.st_ymin((m.geom)::public.box3d) AS bbox_ymin,
    public.st_xmax((m.geom)::public.box3d) AS bbox_xmax,
    public.st_ymax((m.geom)::public.box3d) AS bbox_ymax,
    public.st_x(public.st_centroid(m.geom)) AS centroid_x,
    public.st_y(public.st_centroid(m.geom)) AS centroid_y,
    (public.st_area(m.geom) / (1000000.0)::double precision) AS area_km2,
    sp.user_id,
    u.username,
    u.first_name AS user_first_name,
    u.last_name AS user_last_name
   FROM ((((atlas.colab_maille_assignments a
     JOIN atlas.colab_students cs ON ((cs.id = a.student_id)))
     JOIN atlas.colab_student_prefs sp ON ((sp.student_id = (cs.matricule)::text)))
     JOIN atlas.mailles m ON ((m.id = a.maille_id)))
     LEFT JOIN atlas.users u ON ((sp.user_id = u.id)));


--
-- Name: v_colab_maille_notification_latest; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_maille_notification_latest AS
 SELECT DISTINCT ON (assignment_id) assignment_id,
    status,
    requested_at,
    sent_at,
    error,
    options,
    email_job_id
   FROM atlas.colab_maille_notification_logs l
  ORDER BY assignment_id, requested_at DESC;


--
-- Name: v_colab_missions_summary; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_missions_summary AS
 SELECT m.id,
    m.code,
    m.title,
    (m.theme)::text AS theme,
    (m.status)::text AS status,
    m.maille_id,
    m.zone_label,
    m.commune,
    m.region,
    m.start_date,
    m.end_date,
    m.expected_sondages,
    m.description,
    m.created_at,
    m.updated_at,
    s.id AS supervisor_id,
    u_sup.username AS supervisor_username,
    (((u_sup.first_name)::text || ' '::text) || (u_sup.last_name)::text) AS supervisor_name,
    sup.specialite AS supervisor_specialite,
    u_creator.username AS created_by_username,
    ( SELECT count(*) AS count
           FROM atlas.colab_mission_assignments a
          WHERE ((a.mission_id = m.id) AND (a.unassigned_at IS NULL))) AS assigned_students_count,
    ( SELECT count(*) AS count
           FROM atlas.colab_mission_sondages ms
          WHERE (ms.mission_id = m.id)) AS linked_sondages_count,
    ( SELECT count(*) AS count
           FROM atlas.colab_field_logs fl
          WHERE (fl.mission_id = m.id)) AS field_logs_count,
    ( SELECT count(*) AS count
           FROM atlas.colab_documents d
          WHERE ((d.mission_id = m.id) AND (d.is_current = true))) AS documents_count
   FROM ((((atlas.colab_missions m
     LEFT JOIN atlas.colab_supervisors s ON ((m.supervisor_id = s.id)))
     LEFT JOIN atlas.users u_sup ON ((s.user_id = u_sup.id)))
     LEFT JOIN atlas.colab_supervisors sup ON ((s.id = sup.id)))
     LEFT JOIN atlas.users u_creator ON ((m.created_by = u_creator.id)));


--
-- Name: VIEW v_colab_missions_summary; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_colab_missions_summary IS 'Vue r├®sum├®e des missions avec statistiques';


--
-- Name: v_colab_questions; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_questions AS
 SELECT q.id,
    q.title,
    q.body,
    q.author_id,
    u.username AS author_username,
    q.mission_id,
    m.title AS mission_title,
    q.is_closed,
    q.is_pinned,
    q.score,
    q.views_count,
    q.answers_count,
    q.created_at,
    q.updated_at,
    ( SELECT array_agg(t.name) AS array_agg
           FROM (atlas.colab_question_tags qt
             JOIN atlas.colab_tags t ON ((qt.tag_id = t.id)))
          WHERE (qt.question_id = q.id)) AS tags,
    (EXISTS ( SELECT 1
           FROM atlas.colab_answers a
          WHERE ((a.question_id = q.id) AND (a.is_best = true)))) AS has_best_answer
   FROM ((atlas.colab_questions q
     JOIN atlas.users u ON ((q.author_id = u.id)))
     LEFT JOIN atlas.colab_missions m ON ((q.mission_id = m.id)));


--
-- Name: v_colab_students; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_students AS
 SELECT s.id,
    s.user_id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    (((u.first_name)::text || ' '::text) || (u.last_name)::text) AS full_name,
    s.matricule,
    s.promotion,
    s.filiere,
    s.etablissement,
    s.niveau,
    s.notes,
    s.created_at,
    u.is_active,
    ( SELECT count(*) AS count
           FROM atlas.colab_mission_assignments a
          WHERE ((a.student_id = s.id) AND (a.unassigned_at IS NULL))) AS active_missions_count
   FROM (atlas.colab_students s
     JOIN atlas.users u ON ((s.user_id = u.id)));


--
-- Name: VIEW v_colab_students; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_colab_students IS 'Vue ├®tudiants avec infos utilisateur';


--
-- Name: v_colab_students_without_maille; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_students_without_maille AS
 SELECT sp.student_id,
    sp.nom,
    sp.prenom,
    sp.email,
    sp.telephone,
    sp.adm_niveau,
    sp.adm_code_pref_1,
    sp.adm_code_pref_2,
    sp.adm_code_pref_3,
    sp.commentaire,
    sp.created_at,
    sp.updated_at
   FROM ((atlas.colab_student_prefs sp
     LEFT JOIN atlas.colab_students cs ON (((cs.matricule)::text = sp.student_id)))
     LEFT JOIN atlas.colab_maille_assignments a ON ((a.student_id = cs.id)))
  WHERE (a.assignment_id IS NULL);


--
-- Name: v_colab_supervisors; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_supervisors AS
 SELECT s.id,
    s.user_id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    (((((s.titre)::text || ' '::text) || (u.first_name)::text) || ' '::text) || (u.last_name)::text) AS full_name_with_title,
    s.specialite,
    s.institution,
    s.titre,
    s.departement,
    s.telephone,
    s.notes,
    s.created_at,
    u.is_active,
    ( SELECT count(*) AS count
           FROM atlas.colab_missions m
          WHERE (m.supervisor_id = s.id)) AS missions_count
   FROM (atlas.colab_supervisors s
     JOIN atlas.users u ON ((s.user_id = u.id)));


--
-- Name: VIEW v_colab_supervisors; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_colab_supervisors IS 'Vue superviseurs avec infos utilisateur';


--
-- Name: v_colab_unread_notifications; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_colab_unread_notifications AS
 SELECT n.id,
    n.user_id,
    n.notification_type,
    n.title,
    n.message,
    n.payload,
    n.mission_id,
    n.sondage_id,
    n.comment_id,
    n.is_read,
    n.read_at,
    n.created_at,
    u.username,
    u.email
   FROM (atlas.colab_notifications n
     JOIN atlas.users u ON ((n.user_id = u.id)))
  WHERE (n.is_read = false)
  ORDER BY n.created_at DESC;


--
-- Name: v_coverage_mailles_28km; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_coverage_mailles_28km AS
 SELECT m28.id_m28,
    m28.code_m28,
    m28.code_lisible,
    m28.profil_num,
    m28.geom,
    COALESCE(stats.n_sondages, (0)::bigint) AS n_sondages,
    COALESCE(stats.n_sondages_exact, (0)::bigint) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, (0)::bigint) AS n_sondages_random,
    COALESCE(stats.n_echantillons, (0)::bigint) AS n_echantillons,
    0 AS n_essais,
    COALESCE(stats.n_mailles_2km, (0)::bigint) AS n_mailles_2km,
    COALESCE(stats.n_mailles_2km_with_data, (0)::bigint) AS n_mailles_2km_with_data
   FROM (atlas.maille_28km m28
     LEFT JOIN LATERAL ( SELECT count(DISTINCT s.id) AS n_sondages,
            count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['exact'::text, 'gps'::text, 'manual'::text]))) AS n_sondages_exact,
            count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['adm_random_cell'::text, 'adm3'::text, 'adm2'::text, 'adm1'::text, 'random'::text]))) AS n_sondages_random,
            count(DISTINCT e.id) AS n_echantillons,
            count(DISTINCT m2.code) AS n_mailles_2km,
            count(DISTINCT m2.code) FILTER (WHERE (s.grid_code = m2.code)) AS n_mailles_2km_with_data
           FROM ((atlas.mailles m2
             LEFT JOIN atlas.sondages s ON ((s.grid_code = m2.code)))
             LEFT JOIN atlas.echantillons e ON ((e.sondage_id = s.id)))
          WHERE (m2.id_m28 = m28.id_m28)) stats ON (true));


--
-- Name: VIEW v_coverage_mailles_28km; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_coverage_mailles_28km IS 'Vue de couverture mailles 28km avec compteurs exact/random et code lisible. Utilisée par l''API pour affichage carte et recherche.';


--
-- Name: adm0_raw; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm0_raw (
    ogc_fid integer NOT NULL,
    shape_leng numeric(18,11),
    shape_area numeric(18,11),
    adm0_fr character varying(50),
    adm0_pcode character varying(50),
    adm0_ref character varying(50),
    date date,
    validon date,
    validto date,
    geom public.geometry(Polygon,4326)
);


--
-- Name: v_coverage_mailles_28km_clip; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_coverage_mailles_28km_clip AS
 WITH togo_boundary AS (
         SELECT public.st_transform(public.st_union(adm0_raw.geom), 25231) AS geom
           FROM public.adm0_raw
         LIMIT 1
        ), base AS (
         SELECT m28.id_m28,
            m28.code_m28,
            m28.code_lisible,
            m28.profil_num,
                CASE
                    WHEN (tb.geom IS NOT NULL) THEN public.st_intersection(m28.geom, tb.geom)
                    ELSE m28.geom
                END AS geom
           FROM (atlas.maille_28km m28
             CROSS JOIN togo_boundary tb)
          WHERE public.st_intersects(m28.geom, tb.geom)
        )
 SELECT b.id_m28,
    b.code_m28,
    b.code_lisible,
    b.profil_num,
    b.geom,
    COALESCE(stats.n_sondages, (0)::bigint) AS n_sondages,
    COALESCE(stats.n_sondages_exact, (0)::bigint) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, (0)::bigint) AS n_sondages_random,
    COALESCE(stats.n_echantillons, (0)::bigint) AS n_echantillons,
    0 AS n_essais,
    COALESCE(stats.n_mailles_2km, (0)::bigint) AS n_mailles_2km,
    COALESCE(stats.n_mailles_2km_with_data, (0)::bigint) AS n_mailles_2km_with_data
   FROM (base b
     LEFT JOIN LATERAL ( SELECT count(DISTINCT s.id) AS n_sondages,
            count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['exact'::text, 'gps'::text, 'manual'::text]))) AS n_sondages_exact,
            count(DISTINCT s.id) FILTER (WHERE (s.location_mode = ANY (ARRAY['adm_random_cell'::text, 'adm3'::text, 'adm2'::text, 'adm1'::text, 'random'::text]))) AS n_sondages_random,
            count(DISTINCT e.id) AS n_echantillons,
            count(DISTINCT m2.code) AS n_mailles_2km,
            count(DISTINCT m2.code) FILTER (WHERE (s.grid_code = m2.code)) AS n_mailles_2km_with_data
           FROM ((atlas.mailles m2
             LEFT JOIN atlas.sondages s ON ((s.grid_code = m2.code)))
             LEFT JOIN atlas.echantillons e ON ((e.sondage_id = s.id)))
          WHERE (m2.id_m28 = b.id_m28)) stats ON (true));


--
-- Name: VIEW v_coverage_mailles_28km_clip; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_coverage_mailles_28km_clip IS 'Vue de couverture 28km avec geom clipée (ADM0) et colonnes compatibles API';


--
-- Name: v_coverage_mailles_2km; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_coverage_mailles_2km AS
 SELECT m.code,
    public.st_transform(m.geom, 4326) AS geom,
    COALESCE(stats.n_sondages, (0)::bigint) AS n_sondages,
    COALESCE(stats.n_sondages_exact, (0)::bigint) AS n_sondages_exact,
    COALESCE(stats.n_sondages_random, (0)::bigint) AS n_sondages_random,
    COALESCE(stats.n_echantillons, (0)::bigint) AS n_echantillons,
    m.pref_code,
    m.pref_name,
    m.adm2_name,
    m.id_m28
   FROM (atlas.mailles m
     LEFT JOIN ( SELECT s.maille_code,
            count(DISTINCT s.id) AS n_sondages,
            sum(
                CASE
                    WHEN (s.location_mode = 'exact'::text) THEN 1
                    ELSE 0
                END) AS n_sondages_exact,
            sum(
                CASE
                    WHEN (s.location_mode = ANY (ARRAY['adm_random_cell'::text, 'adm_spread'::text])) THEN 1
                    ELSE 0
                END) AS n_sondages_random,
            count(DISTINCT e.id) AS n_echantillons
           FROM (atlas.sondages s
             LEFT JOIN atlas.echantillons e ON ((e.sondage_id = s.id)))
          WHERE (s.maille_code IS NOT NULL)
          GROUP BY s.maille_code) stats ON ((stats.maille_code = m.code)));


--
-- Name: VIEW v_coverage_mailles_2km; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_coverage_mailles_2km IS 'Vue de couverture mailles 2km avec compteurs exact/random pour couleurs unifiées (vert=exact dominant, bleu=random dominant, gris=sans données)';


--
-- Name: v_echantillons_essais; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_echantillons_essais AS
 SELECT s.id AS sondage_id,
    e.id AS echantillon_id,
    (s.meta ->> 'code'::text) AS code_site,
    (s.meta ->> 'localite'::text) AS localite,
    e.depth_m,
    at.wl,
    at.wp,
    at.ip_generated AS ip,
    v.vbs,
    c.hrb,
    c.unified,
    c.class_chassagneux,
    c.class_daksha,
    c.class_seed,
    c.class_vijay,
    epg.cg AS potentiel_gonflement,
    epg.cg_qual AS gonflement_qual,
    epg.type_sol,
    p.w AS teneur_eau,
    p.rho_s AS masse_volumique,
    pr.gamma_d_max,
    pr.w_opt,
    pr.proctor_type,
    ( SELECT granulo_points.passing_pct
           FROM atlas.granulo_points
          WHERE ((granulo_points.echantillon_id = e.id) AND (granulo_points.sieve_mm = 0.08))
         LIMIT 1) AS passant_80um,
    ( SELECT granulo_points.passing_pct
           FROM atlas.granulo_points
          WHERE ((granulo_points.echantillon_id = e.id) AND (granulo_points.sieve_mm = 2.0))
         LIMIT 1) AS passant_2mm,
    ( SELECT granulo_points.passing_pct
           FROM atlas.granulo_points
          WHERE ((granulo_points.echantillon_id = e.id) AND (granulo_points.sieve_mm = 20.0))
         LIMIT 1) AS passant_20mm,
    s.source,
    s.operator,
    e.laboratory,
    e.date AS test_date,
    s.depth_m_min,
    s.depth_m_max,
    e.created_at,
    e.updated_at
   FROM (((((((atlas.echantillons e
     JOIN atlas.sondages s ON ((e.sondage_id = s.id)))
     LEFT JOIN atlas.essais_atterberg at ON ((at.echantillon_id = e.id)))
     LEFT JOIN atlas.essais_vbs v ON ((v.echantillon_id = e.id)))
     LEFT JOIN atlas.essais_classif c ON ((c.echantillon_id = e.id)))
     LEFT JOIN atlas.essais_physiques p ON ((p.echantillon_id = e.id)))
     LEFT JOIN atlas.essais_proctor pr ON ((pr.echantillon_id = e.id)))
     LEFT JOIN atlas.essais_potentiel_gonflement epg ON ((epg.echantillon_id = e.id)))
  WHERE ((s.meta ->> 'code'::text) IS NOT NULL)
  ORDER BY (s.meta ->> 'code'::text), e.depth_m;


--
-- Name: VIEW v_echantillons_essais; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_echantillons_essais IS 'Vue consolid├®e de TOUS les essais g├®otechniques par ├®chantillon. 

Source of truth: essais_atterberg, essais_vbs, essais_classif, essais_physiques, essais_proctor, essais_potentiel_gonflement, granulo_points.

Cette vue remplace essais_geotechniques comme tableau de bord.';


--
-- Name: v_essais_summary; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_essais_summary AS
 SELECT code_site,
    localite,
    count(DISTINCT echantillon_id) AS nb_echantillons,
    count(DISTINCT depth_m) AS nb_profondeurs,
    count(wl) AS nb_atterberg,
    count(vbs) AS nb_vbs,
    count(hrb) AS nb_classif_hrb,
    count(class_chassagneux) AS nb_classif_amessefe,
    count(teneur_eau) AS nb_teneur_eau,
    count(gamma_d_max) AS nb_proctor,
    count(passant_80um) AS nb_granulo,
    count(potentiel_gonflement) AS nb_potentiel_gonflement,
    min(depth_m) AS depth_min,
    max(depth_m) AS depth_max,
    source,
    operator,
    laboratory
   FROM atlas.v_echantillons_essais
  GROUP BY code_site, localite, source, operator, laboratory
  ORDER BY code_site;


--
-- Name: VIEW v_essais_summary; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_essais_summary IS 'Vue r├®sum├®e : nombre d''essais par sondage et par type';


--
-- Name: v_geologie_style_map; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_geologie_style_map AS
 SELECT unit_code,
    unit_label,
    color_hex,
    sort_order
   FROM atlas.layer_style ls
  WHERE (layer_id = 'geologie'::text)
  ORDER BY sort_order;


--
-- Name: v_maille_28km_kpi; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_28km_kpi AS
 WITH sond_m28 AS (
         SELECT s.id AS id_sondage,
            COALESCE(m2.id_m28, m28_1.id_m28) AS id_m28
           FROM ((atlas.sondages s
             LEFT JOIN atlas.mailles m2 ON ((s.grid_code = m2.code)))
             LEFT JOIN atlas.maille_28km m28_1 ON (((m2.id_m28 IS NULL) AND (s.geom IS NOT NULL) AND public.st_intersects(public.st_transform(s.geom, 25231), m28_1.geom))))
          WHERE (COALESCE(m2.id_m28, m28_1.id_m28) IS NOT NULL)
        ), obs AS (
         SELECT sm28.id_m28,
            sm28.id_sondage,
            eg.ip,
            eg.vbs,
            eg.eg
           FROM (sond_m28 sm28
             LEFT JOIN atlas.essais_geotechniques eg ON ((eg.sondage_id = sm28.id_sondage)))
        )
 SELECT m28.id_m28,
    m28.code_m28,
    m28.profil_num,
    m28.pk_min_km,
    m28.pk_max_km,
    m28.geom,
    (public.st_area(m28.geom) / (1000000.0)::double precision) AS area_km2,
    count(DISTINCT obs.id_sondage) AS n_sondages,
    count(*) FILTER (WHERE (obs.ip IS NOT NULL)) AS n_ip,
    count(*) FILTER (WHERE (obs.vbs IS NOT NULL)) AS n_vbs,
    count(*) FILTER (WHERE (obs.eg IS NOT NULL)) AS n_eg,
    avg(obs.ip) FILTER (WHERE (obs.ip IS NOT NULL)) AS ip_avg,
    avg(obs.vbs) FILTER (WHERE (obs.vbs IS NOT NULL)) AS vbs_avg,
    avg(obs.eg) FILTER (WHERE (obs.eg IS NOT NULL)) AS eg_avg,
    percentile_cont((0.50)::double precision) WITHIN GROUP (ORDER BY ((obs.ip)::double precision)) FILTER (WHERE (obs.ip IS NOT NULL)) AS ip_median,
    percentile_cont((0.25)::double precision) WITHIN GROUP (ORDER BY ((obs.ip)::double precision)) FILTER (WHERE (obs.ip IS NOT NULL)) AS ip_p25,
    percentile_cont((0.75)::double precision) WITHIN GROUP (ORDER BY ((obs.ip)::double precision)) FILTER (WHERE (obs.ip IS NOT NULL)) AS ip_p75,
        CASE
            WHEN (count(*) FILTER (WHERE (obs.ip IS NOT NULL)) = 0) THEN NULL::numeric
            ELSE ((100.0 * (count(*) FILTER (WHERE ((obs.ip IS NOT NULL) AND (obs.ip >= (17)::numeric))))::numeric) / (count(*) FILTER (WHERE (obs.ip IS NOT NULL)))::numeric)
        END AS pct_plastiques_ip17,
        CASE
            WHEN (count(DISTINCT obs.id_sondage) > 0) THEN true
            ELSE false
        END AS has_data,
        CASE
            WHEN (public.st_area(m28.geom) = (0)::double precision) THEN NULL::double precision
            ELSE ((count(DISTINCT obs.id_sondage))::double precision / (public.st_area(m28.geom) / (1000000.0)::double precision))
        END AS sondages_per_km2
   FROM (atlas.maille_28km m28
     LEFT JOIN obs ON ((obs.id_m28 = m28.id_m28)))
  GROUP BY m28.id_m28, m28.code_m28, m28.profil_num, m28.pk_min_km, m28.pk_max_km, m28.geom;


--
-- Name: VIEW v_maille_28km_kpi; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_maille_28km_kpi IS 'Vue KPI agrégée par maille 28km';


--
-- Name: v_mailles_28km_clip; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_mailles_28km_clip AS
 WITH togo_boundary AS (
         SELECT public.st_transform(public.st_union(adm0_raw.geom), 25231) AS geom
           FROM public.adm0_raw
         LIMIT 1
        )
 SELECT m.id_m28,
    m.code_m28,
    m.code_lisible,
    m.profil_num,
    m.pk_min_km,
    m.pk_max_km,
        CASE
            WHEN (tb.geom IS NOT NULL) THEN public.st_intersection(m.geom, tb.geom)
            ELSE m.geom
        END AS geom
   FROM (atlas.maille_28km m
     CROSS JOIN togo_boundary tb)
  WHERE public.st_intersects(m.geom, tb.geom);


--
-- Name: VIEW v_mailles_28km_clip; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_mailles_28km_clip IS 'Vue des mailles 28km clipées à la frontière du Togo (ADM0). Utiliser cette vue pour l''affichage cartographique.';


--
-- Name: v_maille_28km_map; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_28km_map AS
 SELECT id_m28,
    code_m28,
    profil_num,
    pk_min_km,
    pk_max_km,
    geom
   FROM atlas.v_mailles_28km_clip;


--
-- Name: v_maille_dsm_28km; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_dsm_28km AS
 SELECT m.id_m28,
    m.code_m28,
    m.profil_num,
    public.st_summarystatsagg(public.st_clip(r.rast, m.geom), 1, true) AS stats
   FROM (atlas.maille_28km m
     LEFT JOIN atlas.dsm_cop30 r ON (public.st_intersects(m.geom, public.st_convexhull(r.rast))))
  GROUP BY m.id_m28, m.code_m28, m.profil_num;


--
-- Name: VIEW v_maille_dsm_28km; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_maille_dsm_28km IS 'Statistiques DSM COP30 agrégées par maille 28km';


--
-- Name: v_maille_dsm_28km_flat; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_dsm_28km_flat AS
 SELECT id_m28,
    code_m28,
    profil_num,
    round(((stats).count)::numeric, 0) AS nb_pixels,
    round(((stats).mean)::numeric, 1) AS altitude_mean,
    round(((stats).min)::numeric, 1) AS altitude_min,
    round(((stats).max)::numeric, 1) AS altitude_max,
    round(((stats).stddev)::numeric, 1) AS altitude_stddev,
    round((((stats).max - (stats).min))::numeric, 1) AS altitude_range
   FROM atlas.v_maille_dsm_28km m
  WHERE (((stats).count > 0) AND ((stats).mean > ('-100'::integer)::double precision) AND ((stats).mean < (1000)::double precision) AND ((stats).min > ('-100'::integer)::double precision) AND ((stats).max < (1000)::double precision));


--
-- Name: VIEW v_maille_dsm_28km_flat; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_maille_dsm_28km_flat IS 'Statistiques DSM COP30 par maille 28km (valeurs NoData filtrées)';


--
-- Name: v_maille_dsm_2km; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_dsm_2km AS
 SELECT m.id,
    m.code,
    public.st_summarystatsagg(public.st_clip(r.rast, m.geom), 1, true) AS stats
   FROM (atlas.mailles m
     LEFT JOIN atlas.dsm_cop30 r ON (public.st_intersects(m.geom, public.st_convexhull(r.rast))))
  GROUP BY m.id, m.code;


--
-- Name: VIEW v_maille_dsm_2km; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_maille_dsm_2km IS 'Statistiques DSM COP30 agrégées par maille 2km';


--
-- Name: v_maille_dsm_2km_flat; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_maille_dsm_2km_flat AS
 SELECT id,
    code,
    round(((stats).count)::numeric, 0) AS nb_pixels,
    round(((stats).mean)::numeric, 1) AS altitude_mean,
    round(((stats).min)::numeric, 1) AS altitude_min,
    round(((stats).max)::numeric, 1) AS altitude_max,
    round(((stats).stddev)::numeric, 1) AS altitude_stddev,
    round((((stats).max - (stats).min))::numeric, 1) AS altitude_range
   FROM atlas.v_maille_dsm_2km m
  WHERE (((stats).count > 0) AND ((stats).mean > ('-100'::integer)::double precision) AND ((stats).mean < (1000)::double precision) AND ((stats).min > ('-100'::integer)::double precision) AND ((stats).max < (1000)::double precision));


--
-- Name: VIEW v_maille_dsm_2km_flat; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_maille_dsm_2km_flat IS 'Statistiques DSM COP30 par maille 2km (valeurs NoData filtrées)';


--
-- Name: v_pedologie_style_map; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_pedologie_style_map AS
 SELECT unit_code,
    unit_label,
    color_hex,
    sort_order
   FROM atlas.layer_style ls
  WHERE (layer_id = 'pedologie'::text)
  ORDER BY sort_order;


--
-- Name: v_risque_style_map; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_risque_style_map AS
 SELECT unit_code,
    unit_label,
    color_hex,
    sort_order
   FROM atlas.layer_style ls
  WHERE (layer_id = 'risque'::text)
  ORDER BY sort_order;


--
-- Name: v_roles_with_permissions; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_roles_with_permissions AS
SELECT
    NULL::character varying(50) AS id,
    NULL::character varying(100) AS name,
    NULL::text AS description,
    NULL::boolean AS is_system,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::json AS permissions;


--
-- Name: v_sondages_clean; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_sondages_clean AS
 SELECT id,
    geom_real AS geom,
    date,
    source,
    (meta ->> 'code'::text) AS code,
    (meta ->> 'localite'::text) AS localite,
    (meta ->> 'adm3_code'::text) AS adm3_code,
    grid_code,
    adm3_id,
    is_geocoded,
    created_at,
    updated_at,
    deleted_at
   FROM atlas.sondages
  WHERE (deleted_at IS NULL);


--
-- Name: VIEW v_sondages_clean; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_sondages_clean IS 'Vue propre des sondages sans colonnes legacy - ├á utiliser dans QGIS/UI';


--
-- Name: v_sondages_profondeurs; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_sondages_profondeurs AS
 SELECT s.id,
    (s.meta ->> 'code'::text) AS code_site,
    (s.meta ->> 'localite'::text) AS localite,
    s.source,
    s.operator,
    s.depth_m_min,
    s.depth_m_max,
    count(e.id) AS nb_echantillons,
    array_agg(DISTINCT e.depth_m ORDER BY e.depth_m) AS profondeurs,
    s.created_at,
    s.updated_at
   FROM (atlas.sondages s
     LEFT JOIN atlas.echantillons e ON ((e.sondage_id = s.id)))
  WHERE ((s.meta ->> 'code'::text) IS NOT NULL)
  GROUP BY s.id, s.meta, s.source, s.operator, s.depth_m_min, s.depth_m_max, s.created_at, s.updated_at
  ORDER BY (s.meta ->> 'code'::text);


--
-- Name: VIEW v_sondages_profondeurs; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON VIEW atlas.v_sondages_profondeurs IS 'Vue de contr├┤le : sondages avec leurs profondeurs min/max et liste des ├®chantillons';


--
-- Name: v_sondages_unifies; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_sondages_unifies AS
 WITH base AS (
         SELECT s.geom,
            s.date_sondage,
            s.source,
            s.meta,
            s.code,
            s.depth_m_min,
            s.depth_m_max,
            s.maille_code,
            s.adm1_name,
            s.adm2_name,
            s.adm3_name,
            s.comment,
            s.location_accuracy,
            s.operator,
            s.notes,
            s.type_sol,
            s.location_mode,
            s.adm1_id,
            s.adm2_id,
            s.import_id,
            s.import_row_idx,
            s.loc_mode,
            s.geom_real,
            s.created_by_batch,
            s.updated_by_batch,
            s.deleted_by_batch,
            s.grid_code,
            s.localite_base,
            s.localite_key,
            s.localite,
            s.id,
            s.date,
            s.created_at,
            s.updated_at,
            s.deleted_at,
            s.adm3_id,
            s.is_geocoded,
            atlas.normalize_localite(COALESCE(s.localite, s.adm3_name)) AS localite_canon
           FROM atlas.sondages s
          WHERE (COALESCE(s.localite, s.adm3_name) IS NOT NULL)
        ), grp AS (
         SELECT base.localite_canon,
            (array_agg(base.id ORDER BY base.created_at))[1] AS survey_id_canon,
            (array_agg(base.code ORDER BY base.created_at))[1] AS code_canon
           FROM base
          GROUP BY base.localite_canon
        )
 SELECT g.survey_id_canon AS id,
    g.code_canon AS code,
    b.localite_canon,
    (array_agg(b.adm3_id ORDER BY b.created_at) FILTER (WHERE (b.adm3_id IS NOT NULL)))[1] AS adm3_id,
    max(b.adm3_name) AS adm3_name,
    max(b.localite) AS localite,
    (array_agg(b.geom ORDER BY b.created_at) FILTER (WHERE (b.geom IS NOT NULL)))[1] AS geom,
    ((array_agg(b.geom ORDER BY b.created_at) FILTER (WHERE (b.geom IS NOT NULL)))[1] IS NOT NULL) AS has_geom,
    ((array_agg(b.adm3_id ORDER BY b.created_at) FILTER (WHERE (b.adm3_id IS NOT NULL)))[1] IS NOT NULL) AS has_adm3,
    bool_or(b.is_geocoded) AS is_geocoded,
    max(b.location_mode) AS location_mode,
    max(b.date) AS date,
    min(b.created_at) AS created_at,
    max(b.updated_at) AS updated_at,
    count(*) AS nb_sondages,
    array_agg(DISTINCT b.id) AS source_survey_ids,
    array_agg(DISTINCT b.code) AS alias_codes
   FROM (base b
     JOIN grp g ON ((g.localite_canon = b.localite_canon)))
  GROUP BY g.survey_id_canon, g.code_canon, b.localite_canon;


--
-- Name: v_users_with_roles; Type: VIEW; Schema: atlas; Owner: -
--

CREATE VIEW atlas.v_users_with_roles AS
SELECT
    NULL::uuid AS id,
    NULL::character varying(255) AS email,
    NULL::character varying(100) AS username,
    NULL::character varying(100) AS first_name,
    NULL::character varying(100) AS last_name,
    NULL::text AS avatar_url,
    NULL::boolean AS is_active,
    NULL::boolean AS is_verified,
    NULL::timestamp with time zone AS last_login_at,
    NULL::timestamp with time zone AS created_at,
    NULL::timestamp with time zone AS updated_at,
    NULL::json AS roles;


--
-- Name: admin_limites_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.admin_limites_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    name_fr text,
    admin_level integer,
    boundary text,
    ref text,
    population integer,
    area_km2 numeric(12,4),
    parent_id integer,
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(MultiPolygon,25231) NOT NULL
);


--
-- Name: TABLE admin_limites_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.admin_limites_25231 IS 'Limites administratives du Togo';


--
-- Name: admin_limites_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.admin_limites_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: admin_limites_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.admin_limites_25231_id_seq OWNED BY atlas_ref.admin_limites_25231.id;


--
-- Name: batiments_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.batiments_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    building text,
    building_levels integer,
    height numeric(6,2),
    amenity text,
    area_m2 numeric(12,2),
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(MultiPolygon,25231) NOT NULL
);


--
-- Name: TABLE batiments_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.batiments_25231 IS 'B├ótiments du Togo';


--
-- Name: batiments_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.batiments_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: batiments_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.batiments_25231_id_seq OWNED BY atlas_ref.batiments_25231.id;


--
-- Name: hydro_cours_eau_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.hydro_cours_eau_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    name_fr text,
    waterway text,
    width numeric(6,2),
    intermittent boolean DEFAULT false,
    seasonal boolean DEFAULT false,
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(MultiLineString,25231) NOT NULL
);


--
-- Name: TABLE hydro_cours_eau_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.hydro_cours_eau_25231 IS 'Cours d''eau du Togo (rivi├¿res, ruisseaux)';


--
-- Name: hydro_cours_eau_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.hydro_cours_eau_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hydro_cours_eau_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.hydro_cours_eau_25231_id_seq OWNED BY atlas_ref.hydro_cours_eau_25231.id;


--
-- Name: hydro_surfaces_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.hydro_surfaces_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    name_fr text,
    water text,
    natural_type text,
    intermittent boolean DEFAULT false,
    area_km2 numeric(10,4),
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(MultiPolygon,25231) NOT NULL
);


--
-- Name: TABLE hydro_surfaces_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.hydro_surfaces_25231 IS 'Plans d''eau du Togo (lacs, mares, r├®servoirs)';


--
-- Name: hydro_surfaces_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.hydro_surfaces_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: hydro_surfaces_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.hydro_surfaces_25231_id_seq OWNED BY atlas_ref.hydro_surfaces_25231.id;


--
-- Name: localites_points_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.localites_points_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    name_fr text,
    place text,
    population integer,
    is_capital boolean DEFAULT false,
    admin_level integer,
    adm1_code text,
    adm2_code text,
    adm3_code text,
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(Point,25231) NOT NULL
);


--
-- Name: TABLE localites_points_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.localites_points_25231 IS 'Localit├®s ponctuelles (villages, villes) du Togo';


--
-- Name: localites_points_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.localites_points_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: localites_points_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.localites_points_25231_id_seq OWNED BY atlas_ref.localites_points_25231.id;


--
-- Name: localites_polygons_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.localites_polygons_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    name_fr text,
    place text,
    landuse text,
    population integer,
    area_km2 numeric(10,4),
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(MultiPolygon,25231) NOT NULL
);


--
-- Name: TABLE localites_polygons_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.localites_polygons_25231 IS 'Emprises urbaines du Togo';


--
-- Name: localites_polygons_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.localites_polygons_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: localites_polygons_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.localites_polygons_25231_id_seq OWNED BY atlas_ref.localites_polygons_25231.id;


--
-- Name: routes_25231; Type: TABLE; Schema: atlas_ref; Owner: -
--

CREATE TABLE atlas_ref.routes_25231 (
    id integer NOT NULL,
    osm_id bigint,
    name text,
    name_fr text,
    highway text,
    surface text,
    width numeric(5,2),
    lanes integer,
    oneway boolean DEFAULT false,
    bridge boolean DEFAULT false,
    tunnel boolean DEFAULT false,
    ref text,
    source text DEFAULT 'nextgis'::text,
    import_date timestamp with time zone DEFAULT now(),
    geom public.geometry(MultiLineString,25231) NOT NULL
);


--
-- Name: TABLE routes_25231; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON TABLE atlas_ref.routes_25231 IS 'Routes et pistes du Togo (EPSG:25231)';


--
-- Name: routes_25231_id_seq; Type: SEQUENCE; Schema: atlas_ref; Owner: -
--

CREATE SEQUENCE atlas_ref.routes_25231_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: routes_25231_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_ref; Owner: -
--

ALTER SEQUENCE atlas_ref.routes_25231_id_seq OWNED BY atlas_ref.routes_25231.id;


--
-- Name: v_admin_atlas; Type: VIEW; Schema: atlas_ref; Owner: -
--

CREATE VIEW atlas_ref.v_admin_atlas AS
 SELECT id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    admin_level,
    ref AS code,
    population,
    area_km2,
    (public.st_asgeojson(geom))::jsonb AS geometry,
    geom
   FROM atlas_ref.admin_limites_25231;


--
-- Name: VIEW v_admin_atlas; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON VIEW atlas_ref.v_admin_atlas IS 'Vue des limites administratives pour l''API Atlas';


--
-- Name: v_batiments_atlas; Type: VIEW; Schema: atlas_ref; Owner: -
--

CREATE VIEW atlas_ref.v_batiments_atlas AS
 SELECT id,
    osm_id,
    name,
    building AS type,
    building_levels AS levels,
    amenity,
    area_m2,
    (public.st_asgeojson(geom))::jsonb AS geometry,
    geom
   FROM atlas_ref.batiments_25231;


--
-- Name: VIEW v_batiments_atlas; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON VIEW atlas_ref.v_batiments_atlas IS 'Vue des b├ótiments pour l''API Atlas';


--
-- Name: v_hydro_atlas; Type: VIEW; Schema: atlas_ref; Owner: -
--

CREATE VIEW atlas_ref.v_hydro_atlas AS
 SELECT 'cours_eau'::text AS layer,
    hydro_cours_eau_25231.id,
    hydro_cours_eau_25231.osm_id,
    hydro_cours_eau_25231.name,
    COALESCE(hydro_cours_eau_25231.name_fr, hydro_cours_eau_25231.name) AS display_name,
    hydro_cours_eau_25231.waterway AS type,
    hydro_cours_eau_25231.intermittent,
    (public.st_asgeojson(hydro_cours_eau_25231.geom))::jsonb AS geometry,
    hydro_cours_eau_25231.geom
   FROM atlas_ref.hydro_cours_eau_25231
UNION ALL
 SELECT 'surface'::text AS layer,
    hydro_surfaces_25231.id,
    hydro_surfaces_25231.osm_id,
    hydro_surfaces_25231.name,
    COALESCE(hydro_surfaces_25231.name_fr, hydro_surfaces_25231.name) AS display_name,
    hydro_surfaces_25231.water AS type,
    hydro_surfaces_25231.intermittent,
    (public.st_asgeojson(hydro_surfaces_25231.geom))::jsonb AS geometry,
    hydro_surfaces_25231.geom
   FROM atlas_ref.hydro_surfaces_25231;


--
-- Name: VIEW v_hydro_atlas; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON VIEW atlas_ref.v_hydro_atlas IS 'Vue de l''hydrographie pour l''API Atlas';


--
-- Name: v_localites_atlas; Type: VIEW; Schema: atlas_ref; Owner: -
--

CREATE VIEW atlas_ref.v_localites_atlas AS
 SELECT id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    place AS type,
    population,
    is_capital,
    adm1_code,
    adm2_code,
    adm3_code,
    (public.st_asgeojson(geom))::jsonb AS geometry,
    geom
   FROM atlas_ref.localites_points_25231;


--
-- Name: VIEW v_localites_atlas; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON VIEW atlas_ref.v_localites_atlas IS 'Vue des localit├®s pour l''API Atlas';


--
-- Name: v_routes_atlas; Type: VIEW; Schema: atlas_ref; Owner: -
--

CREATE VIEW atlas_ref.v_routes_atlas AS
 SELECT id,
    osm_id,
    name,
    COALESCE(name_fr, name) AS display_name,
    highway,
    surface,
    ref,
    (public.st_asgeojson(geom))::jsonb AS geometry,
    geom
   FROM atlas_ref.routes_25231;


--
-- Name: VIEW v_routes_atlas; Type: COMMENT; Schema: atlas_ref; Owner: -
--

COMMENT ON VIEW atlas_ref.v_routes_atlas IS 'Vue des routes pour l''API Atlas';


--
-- Name: poi_terrain; Type: TABLE; Schema: atlas_terrain; Owner: -
--

CREATE TABLE atlas_terrain.poi_terrain (
    id integer NOT NULL,
    name text NOT NULL,
    category text,
    description text,
    photo_url text,
    submitted_by uuid,
    submitted_at timestamp with time zone DEFAULT now(),
    validated boolean DEFAULT false,
    validated_by uuid,
    validated_at timestamp with time zone,
    geom public.geometry(Point,25231) NOT NULL
);


--
-- Name: TABLE poi_terrain; Type: COMMENT; Schema: atlas_terrain; Owner: -
--

COMMENT ON TABLE atlas_terrain.poi_terrain IS 'Points d''int├®r├¬t collect├®s sur le terrain';


--
-- Name: poi_terrain_id_seq; Type: SEQUENCE; Schema: atlas_terrain; Owner: -
--

CREATE SEQUENCE atlas_terrain.poi_terrain_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: poi_terrain_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_terrain; Owner: -
--

ALTER SEQUENCE atlas_terrain.poi_terrain_id_seq OWNED BY atlas_terrain.poi_terrain.id;


--
-- Name: routes_corrections; Type: TABLE; Schema: atlas_terrain; Owner: -
--

CREATE TABLE atlas_terrain.routes_corrections (
    id integer NOT NULL,
    route_ref_id integer,
    correction_type text NOT NULL,
    name text,
    highway text,
    surface text,
    comment text,
    submitted_by uuid,
    submitted_at timestamp with time zone DEFAULT now(),
    validated boolean DEFAULT false,
    validated_by uuid,
    validated_at timestamp with time zone,
    geom public.geometry(MultiLineString,25231)
);


--
-- Name: TABLE routes_corrections; Type: COMMENT; Schema: atlas_terrain; Owner: -
--

COMMENT ON TABLE atlas_terrain.routes_corrections IS 'Corrections de routes soumises par les ├®tudiants';


--
-- Name: routes_corrections_id_seq; Type: SEQUENCE; Schema: atlas_terrain; Owner: -
--

CREATE SEQUENCE atlas_terrain.routes_corrections_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: routes_corrections_id_seq; Type: SEQUENCE OWNED BY; Schema: atlas_terrain; Owner: -
--

ALTER SEQUENCE atlas_terrain.routes_corrections_id_seq OWNED BY atlas_terrain.routes_corrections.id;


--
-- Name: test_staging_commit; Type: TABLE; Schema: backup_20251110_192106_30ee61cb; Owner: -
--

CREATE TABLE backup_20251110_192106_30ee61cb.test_staging_commit (
    id integer,
    name text,
    value integer
);


--
-- Name: test_staging_simple; Type: TABLE; Schema: backup_20251110_192111_6af88d05; Owner: -
--

CREATE TABLE backup_20251110_192111_6af88d05.test_staging_simple (
    id integer,
    code text,
    name text
);


--
-- Name: test_staging_commit; Type: TABLE; Schema: backup_20251110_192300_6add4eb4; Owner: -
--

CREATE TABLE backup_20251110_192300_6add4eb4.test_staging_commit (
    id integer,
    name text,
    value integer
);


--
-- Name: test_staging_simple; Type: TABLE; Schema: backup_20251110_192305_fd008851; Owner: -
--

CREATE TABLE backup_20251110_192305_fd008851.test_staging_simple (
    id integer,
    code text,
    name text
);


--
-- Name: test_staging_commit; Type: TABLE; Schema: backup_20251110_195740_850c25c5; Owner: -
--

CREATE TABLE backup_20251110_195740_850c25c5.test_staging_commit (
    id integer,
    name text,
    value integer
);


--
-- Name: test_staging_simple; Type: TABLE; Schema: backup_20251110_195744_31aea478; Owner: -
--

CREATE TABLE backup_20251110_195744_31aea478.test_staging_simple (
    id integer,
    code text,
    name text
);


--
-- Name: test_staging_commit; Type: TABLE; Schema: backup_20251110_222340_00ac3108; Owner: -
--

CREATE TABLE backup_20251110_222340_00ac3108.test_staging_commit (
    id integer,
    name text,
    value integer
);


--
-- Name: test_staging_simple; Type: TABLE; Schema: backup_20251110_222340_28691973; Owner: -
--

CREATE TABLE backup_20251110_222340_28691973.test_staging_simple (
    id integer,
    code text,
    name text
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251112_165929_e990d5b5; Owner: -
--

CREATE TABLE backup_20251112_165929_e990d5b5.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251112_171741_824fb26f; Owner: -
--

CREATE TABLE backup_20251112_171741_824fb26f.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251112_172458_cf91b22c; Owner: -
--

CREATE TABLE backup_20251112_172458_cf91b22c.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251112_214033_a5411aae; Owner: -
--

CREATE TABLE backup_20251112_214033_a5411aae.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251113_082309_b95c64f6; Owner: -
--

CREATE TABLE backup_20251113_082309_b95c64f6.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251113_091240_d773a7a4; Owner: -
--

CREATE TABLE backup_20251113_091240_d773a7a4.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: sondages; Type: TABLE; Schema: backup_20251113_122108_3fdb8b95; Owner: -
--

CREATE TABLE backup_20251113_122108_3fdb8b95.sondages (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid,
    date date,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean
);


--
-- Name: adm3_tg; Type: TABLE; Schema: backup_20251114_075857_91c7dabf; Owner: -
--

CREATE TABLE backup_20251114_075857_91c7dabf.adm3_tg (
    id text,
    code text,
    name text,
    adm1_name text,
    adm2_name text,
    geom public.geometry,
    bbox text,
    created_at text
);


--
-- Name: _backup_echantillons_pre_020; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_echantillons_pre_020 (
    laboratory text,
    norm text,
    is_index text,
    eg text,
    meta text,
    id uuid,
    sondage_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone,
    depth_m numeric,
    rho_s_gcm3 numeric,
    water_content_w numeric,
    date date
);


--
-- Name: _backup_essais_classif_pre_020; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_essais_classif_pre_020 (
    id text,
    essai_id text,
    systeme text,
    classe text,
    reason text,
    version text,
    computed text,
    source text,
    meta text,
    created_at text,
    updated_at text,
    created_by text,
    updated_by text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at text
);


--
-- Name: _backup_essais_geotechniques_pre_020; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_essais_geotechniques_pre_020 (
    id text,
    sondage_id text,
    depth_m text,
    passant_80um text,
    passant_2mm text,
    passant_20mm text,
    wl text,
    wp text,
    ip text,
    vbs text,
    gamma_d_max text,
    w_opt text,
    proctor_type text,
    eg text,
    test_date text,
    laboratory text,
    norm text,
    meta text,
    created_at text,
    created_by text,
    updated_at text,
    updated_by text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at text
);


--
-- Name: _backup_essais_physiques_pre_020; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_essais_physiques_pre_020 (
    id text,
    essai_id text,
    densite_apparente_gcm3 text,
    densite_absolue_gcm3 text,
    teneur_eau_pct text,
    source text,
    measured_at text,
    meta text,
    created_at text,
    updated_at text,
    created_by text,
    updated_by text,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    deleted_at text
);


--
-- Name: _backup_granulo_points_pre_020; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public._backup_granulo_points_pre_020 (
    id text,
    echantillon_id text,
    method text,
    meta text,
    created_at text,
    sieve_mm numeric,
    passing_pct numeric
);


--
-- Name: adm0_raw_ogc_fid_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.adm0_raw_ogc_fid_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: adm0_raw_ogc_fid_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.adm0_raw_ogc_fid_seq OWNED BY public.adm0_raw.ogc_fid;


--
-- Name: adm1; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm1 (
    gid text,
    shape_leng text,
    shape_area text,
    adm1_fr text,
    adm1_pcode text,
    adm1_ref text,
    adm1alt1fr text,
    adm1alt2fr text,
    adm0_fr text,
    adm0_pcode text,
    date text,
    validon text,
    validto text,
    geom public.geometry
);


--
-- Name: adm1_tg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm1_tg (
    id text NOT NULL,
    code text,
    name text,
    geom public.geometry,
    bbox text,
    created_at text
);


--
-- Name: adm2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm2 (
    gid text,
    shape_leng text,
    shape_area text,
    adm2_fr text,
    adm2_pcode text,
    adm2_ref text,
    adm2alt1fr text,
    adm2alt2fr text,
    adm1_fr text,
    adm1_pcode text,
    adm0_fr text,
    adm0_pcode text,
    date text,
    validon text,
    validto text,
    geom public.geometry
);


--
-- Name: adm2_tg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm2_tg (
    id text NOT NULL,
    code text,
    name text,
    adm1_name text,
    geom public.geometry,
    bbox text,
    created_at text
);


--
-- Name: adm3; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm3 (
    shape_leng text,
    shape_area text,
    adm3_fr text,
    adm3_pcode text,
    adm3_ref text,
    adm3alt1fr text,
    adm3alt2fr text,
    adm2_fr text,
    adm2_pcode text,
    adm1_fr text,
    adm1_pcode text,
    adm0_fr text,
    adm0_pcode text,
    date text,
    validon text,
    validto text,
    geom public.geometry,
    gid integer NOT NULL
);


--
-- Name: adm3_compat; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.adm3_compat AS
 SELECT gid,
    adm3_pcode,
    adm3_fr,
    adm2_pcode,
    adm2_fr,
    adm1_pcode,
    adm1_fr,
    adm0_fr,
    geom,
    created_at
   FROM atlas.adm3;


--
-- Name: VIEW adm3_compat; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.adm3_compat IS 'Vue de compatibilit├® vers atlas.adm3 - utiliser atlas.adm3 directement';


--
-- Name: adm3_synonyms; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm3_synonyms (
    alias_norm text,
    adm3_code text
);


--
-- Name: adm3_tg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.adm3_tg (
    id text NOT NULL,
    code text,
    name text,
    adm1_name text,
    adm2_name text,
    geom public.geometry,
    bbox text,
    created_at text
);


--
-- Name: audit_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.audit_log (
    id text NOT NULL,
    ts text,
    action text,
    entity text,
    entity_id text,
    payload text,
    user_id text,
    location_mode text
);


--
-- Name: country_tg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.country_tg (
    id text NOT NULL,
    name text,
    geom public.geometry,
    created_at text
);


--
-- Name: echantillons; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.echantillons AS
 SELECT laboratory,
    norm,
    is_index,
    eg,
    meta,
    id,
    sondage_id,
    created_at,
    updated_at,
    depth_m,
    rho_s_gcm3,
    water_content_w,
    date
   FROM atlas.echantillons;


--
-- Name: essais_classif; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_classif AS
 SELECT id,
    essai_id,
    systeme,
    classe,
    reason,
    version,
    computed,
    source,
    meta,
    created_at,
    updated_at,
    created_by,
    updated_by,
    created_by_batch,
    updated_by_batch,
    deleted_by_batch,
    deleted_at,
    echantillon_id,
    depth_m,
    laboratory,
    test_date,
    hrb,
    unified,
    class_chassagneux,
    class_daksha,
    class_seed,
    class_vijay,
    type_sol,
    cg,
    cg_qual
   FROM atlas.essais_classif;


--
-- Name: essais_physiques; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_physiques AS
 SELECT id,
    essai_id,
    densite_apparente_gcm3,
    densite_absolue_gcm3,
    teneur_eau_pct,
    source,
    measured_at,
    meta,
    created_at,
    updated_at,
    created_by,
    updated_by,
    created_by_batch,
    updated_by_batch,
    deleted_by_batch,
    deleted_at,
    echantillon_id,
    w,
    rho_s,
    laboratory
   FROM atlas.essais_physiques;


--
-- Name: essais_potentiel_gonflement; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_potentiel_gonflement AS
 SELECT id,
    echantillon_id,
    cg,
    cg_qual,
    type_sol,
    meta,
    created_at,
    created_by,
    updated_at,
    updated_by
   FROM atlas.essais_potentiel_gonflement;


--
-- Name: essais_proctor; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.essais_proctor AS
 SELECT id,
    echantillon_id,
    proctor_type,
    gamma_d_max,
    w_opt,
    meta,
    created_at
   FROM atlas.essais_proctor;


--
-- Name: geocode_suggestions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.geocode_suggestions (
    id text NOT NULL,
    entity text,
    localite text,
    adm2_code text,
    candidates text,
    top_code text,
    top_method text,
    status text,
    created_at text,
    decided_at text,
    top_score numeric(5,2),
    entity_id uuid,
    created_at_ts timestamp with time zone DEFAULT now(),
    decided_at_ts timestamp with time zone
);


--
-- Name: granulo_points; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.granulo_points AS
 SELECT id,
    echantillon_id,
    method,
    meta,
    created_at,
    sieve_mm,
    passing_pct
   FROM atlas.granulo_points;


--
-- Name: grid; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.grid (
    id text NOT NULL,
    code text,
    geom public.geometry,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    created_at text,
    updated_at text,
    deleted_at text,
    geom_4326 public.geometry
);


--
-- Name: mailles_geotechnique_stats_wgs84; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.mailles_geotechnique_stats_wgs84 AS
 SELECT id,
    code,
    geom_4326 AS geom,
    geom_simplified,
    adm1_name,
    adm2_name,
    adm3_name,
    n_sondages,
    n_sondages_exact,
    n_sondages_random,
    n_echantillons,
    n_essais_total AS n_essais_geo,
    has_data,
    has_exact_location,
    has_random_location,
    wl_avg,
    wp_avg,
    ip_avg,
    ip_stddev,
    ip_min,
    ip_max,
    vbs_avg,
    vbs_stddev,
    vbs_min,
    vbs_max,
    gamma_d_max_avg,
    gamma_d_max_min AS gamma_d_max_stddev,
    w_opt_avg,
    w_opt_min AS w_opt_stddev,
    eg_avg,
    eg_stddev,
    eg_min,
    eg_max,
    passant_80um_avg,
    passant_2mm_avg,
    passant_20mm_avg,
    n_vbs_insensible,
    n_vbs_peu_sensible,
    n_vbs_sensible,
    n_vbs_moyen_argileux,
    n_vbs_argileux,
    n_vbs_tres_argileux,
    n_eg_negligeable,
    n_eg_faible,
    n_eg_moyen,
    n_eg_fort,
    n_eg_tres_fort
   FROM atlas.v_mailles_with_location_counts;


--
-- Name: VIEW mailles_geotechnique_stats_wgs84; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.mailles_geotechnique_stats_wgs84 IS 'Vue de compatibilité API avec compteurs de localisation pour le frontend';


--
-- Name: raw_lab_ags; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_lab_ags (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_site text,
    depth_m numeric(6,3),
    sieve_mm numeric,
    passants_pct numeric,
    echantillon_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: raw_lab_agt; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_lab_agt (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_site text,
    depth_m numeric(6,3),
    sieve_mm numeric,
    mass_refus_cum_g numeric,
    refus_cum_pct numeric,
    passants_pct numeric,
    echantillon_id uuid,
    created_at timestamp with time zone,
    updated_at timestamp with time zone
);


--
-- Name: raw_lab_atterberg; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.raw_lab_atterberg (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    code_site text,
    depth_m numeric(6,3),
    test_type text,
    tare_no text,
    nb_coups integer,
    poids_total_humide_g numeric,
    poids_total_sec_g numeric,
    poids_tare_g numeric,
    poids_eau_g numeric,
    poids_sol_sec_g numeric,
    teneur_eau_pct numeric,
    echantillon_id uuid,
    created_at timestamp with time zone
);


--
-- Name: ref_types_essais; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ref_types_essais (
    code text,
    nom_fr text,
    nom_en text,
    categorie text,
    unite_defaut text,
    description text,
    ordre_affichage text
);


--
-- Name: refresh_queue; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.refresh_queue (
    id text NOT NULL,
    object text,
    reason text,
    created_at text
);


--
-- Name: sondages_backup_20251107; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.sondages_backup_20251107 (
    id text,
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    created_at text,
    updated_at text,
    deleted_at text,
    location_accuracy text,
    date text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    adm3_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    is_geocoded boolean,
    localite text
);


--
-- Name: staging_adm3_tg_2341a12f1d5642f5a93c72089c50f209; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_adm3_tg_2341a12f1d5642f5a93c72089c50f209 (
    id text NOT NULL,
    code text,
    name text,
    adm1_name text,
    adm2_name text,
    geom public.geometry,
    bbox text,
    created_at text,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_1545961f5e9145519178aed3cfb06dc2; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_1545961f5e9145519178aed3cfb06dc2 (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_170996acc52a4d289130f85a30877f2f; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_170996acc52a4d289130f85a30877f2f (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_479a3497d4444ea0998dcf33cff5b5e4; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_479a3497d4444ea0998dcf33cff5b5e4 (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_4fee78f169f0477a864b5cbc35111578; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_4fee78f169f0477a864b5cbc35111578 (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_6ec80c85913a4cb1bd82066a59babdc6; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_6ec80c85913a4cb1bd82066a59babdc6 (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_75907cf9329d41c585a1ab3d76b76644; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_75907cf9329d41c585a1ab3d76b76644 (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: staging_sondages_d40623e2797e4b54894a5834dab67f22; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.staging_sondages_d40623e2797e4b54894a5834dab67f22 (
    geom public.geometry,
    date_sondage text,
    source text,
    meta text,
    code text,
    depth_m_min text,
    depth_m_max text,
    maille_code text,
    adm1_name text,
    adm2_name text,
    adm3_name text,
    comment text,
    location_accuracy text,
    operator text,
    notes text,
    type_sol text,
    location_mode text,
    adm1_id text,
    adm2_id text,
    import_id text,
    import_row_idx text,
    loc_mode text,
    geom_real public.geometry,
    created_by_batch text,
    updated_by_batch text,
    deleted_by_batch text,
    grid_code text,
    localite_base text,
    localite_key text,
    localite text,
    id uuid NOT NULL,
    date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone,
    deleted_at timestamp with time zone,
    adm3_id integer,
    is_geocoded boolean,
    _staging_op character varying(10)
);


--
-- Name: thematic_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.thematic_configs (
    id text NOT NULL,
    name text,
    description text,
    map_type text,
    parameter text,
    config text,
    is_public text,
    created_by text,
    created_at text,
    updated_at text,
    usage_count text,
    last_used_at text
);


--
-- Name: adm1_tg id; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm1_tg ALTER COLUMN id SET DEFAULT nextval('atlas.adm1_tg_id_seq'::regclass);


--
-- Name: adm2_tg id; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm2_tg ALTER COLUMN id SET DEFAULT nextval('atlas.adm2_tg_id_seq'::regclass);


--
-- Name: adm3_tg id; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm3_tg ALTER COLUMN id SET DEFAULT nextval('atlas.adm3_tg_id_seq'::regclass);


--
-- Name: column_ui_metadata id; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.column_ui_metadata ALTER COLUMN id SET DEFAULT nextval('atlas.column_ui_metadata_id_seq'::regclass);


--
-- Name: country_tg id; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.country_tg ALTER COLUMN id SET DEFAULT nextval('atlas.country_tg_id_seq'::regclass);


--
-- Name: dsm_cop30 rid; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.dsm_cop30 ALTER COLUMN rid SET DEFAULT nextval('atlas.dsm_cop30_rid_seq'::regclass);


--
-- Name: maille_28km id_m28; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.maille_28km ALTER COLUMN id_m28 SET DEFAULT nextval('atlas.maille_28km_id_m28_seq'::regclass);


--
-- Name: risque_gonflement ogc_fid; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.risque_gonflement ALTER COLUMN ogc_fid SET DEFAULT nextval('atlas.risque_gonflement_ogc_fid_seq'::regclass);


--
-- Name: table_versions version; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.table_versions ALTER COLUMN version SET DEFAULT nextval('atlas.table_versions_version_seq'::regclass);


--
-- Name: test_staging_rollback id; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.test_staging_rollback ALTER COLUMN id SET DEFAULT nextval('atlas.test_staging_rollback_id_seq'::regclass);


--
-- Name: unites_geologiques ogc_fid; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.unites_geologiques ALTER COLUMN ogc_fid SET DEFAULT nextval('atlas.unites_geologiques_ogc_fid_seq'::regclass);


--
-- Name: unites_pedologiques ogc_fid; Type: DEFAULT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.unites_pedologiques ALTER COLUMN ogc_fid SET DEFAULT nextval('atlas.unites_pedologiques_ogc_fid_seq'::regclass);


--
-- Name: admin_limites_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.admin_limites_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.admin_limites_25231_id_seq'::regclass);


--
-- Name: batiments_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.batiments_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.batiments_25231_id_seq'::regclass);


--
-- Name: hydro_cours_eau_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.hydro_cours_eau_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.hydro_cours_eau_25231_id_seq'::regclass);


--
-- Name: hydro_surfaces_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.hydro_surfaces_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.hydro_surfaces_25231_id_seq'::regclass);


--
-- Name: localites_points_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.localites_points_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.localites_points_25231_id_seq'::regclass);


--
-- Name: localites_polygons_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.localites_polygons_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.localites_polygons_25231_id_seq'::regclass);


--
-- Name: routes_25231 id; Type: DEFAULT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.routes_25231 ALTER COLUMN id SET DEFAULT nextval('atlas_ref.routes_25231_id_seq'::regclass);


--
-- Name: poi_terrain id; Type: DEFAULT; Schema: atlas_terrain; Owner: -
--

ALTER TABLE ONLY atlas_terrain.poi_terrain ALTER COLUMN id SET DEFAULT nextval('atlas_terrain.poi_terrain_id_seq'::regclass);


--
-- Name: routes_corrections id; Type: DEFAULT; Schema: atlas_terrain; Owner: -
--

ALTER TABLE ONLY atlas_terrain.routes_corrections ALTER COLUMN id SET DEFAULT nextval('atlas_terrain.routes_corrections_id_seq'::regclass);


--
-- Name: adm0_raw ogc_fid; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adm0_raw ALTER COLUMN ogc_fid SET DEFAULT nextval('public.adm0_raw_ogc_fid_seq'::regclass);


--
-- Name: _sqlx_migrations _sqlx_migrations_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas._sqlx_migrations
    ADD CONSTRAINT _sqlx_migrations_pkey PRIMARY KEY (version);


--
-- Name: adm1_tg adm1_tg_name_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm1_tg
    ADD CONSTRAINT adm1_tg_name_key UNIQUE (name);


--
-- Name: adm1_tg adm1_tg_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm1_tg
    ADD CONSTRAINT adm1_tg_pkey PRIMARY KEY (id);


--
-- Name: adm2_tg adm2_tg_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm2_tg
    ADD CONSTRAINT adm2_tg_pkey PRIMARY KEY (id);


--
-- Name: adm3 adm3_adm3_pcode_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm3
    ADD CONSTRAINT adm3_adm3_pcode_key UNIQUE (adm3_pcode);


--
-- Name: adm3 adm3_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm3
    ADD CONSTRAINT adm3_pkey PRIMARY KEY (gid);


--
-- Name: adm3_tg adm3_tg_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.adm3_tg
    ADD CONSTRAINT adm3_tg_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: auth_audit_log auth_audit_log_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.auth_audit_log
    ADD CONSTRAINT auth_audit_log_pkey PRIMARY KEY (id);


--
-- Name: backup_metadata backup_metadata_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.backup_metadata
    ADD CONSTRAINT backup_metadata_pkey PRIMARY KEY (backup_id);


--
-- Name: boundary_togo boundary_togo_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.boundary_togo
    ADD CONSTRAINT boundary_togo_pkey PRIMARY KEY (id);


--
-- Name: changesets changesets_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.changesets
    ADD CONSTRAINT changesets_pkey PRIMARY KEY (id);


--
-- Name: classifications classifications_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.classifications
    ADD CONSTRAINT classifications_pkey PRIMARY KEY (id);


--
-- Name: colab_answers colab_answers_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_answers
    ADD CONSTRAINT colab_answers_pkey PRIMARY KEY (id);


--
-- Name: colab_badges colab_badges_code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_badges
    ADD CONSTRAINT colab_badges_code_key UNIQUE (code);


--
-- Name: colab_badges colab_badges_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_badges
    ADD CONSTRAINT colab_badges_pkey PRIMARY KEY (id);


--
-- Name: colab_comment_mentions colab_comment_mentions_comment_id_mentioned_user_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comment_mentions
    ADD CONSTRAINT colab_comment_mentions_comment_id_mentioned_user_id_key UNIQUE (comment_id, mentioned_user_id);


--
-- Name: colab_comment_mentions colab_comment_mentions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comment_mentions
    ADD CONSTRAINT colab_comment_mentions_pkey PRIMARY KEY (id);


--
-- Name: colab_comments colab_comments_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comments
    ADD CONSTRAINT colab_comments_pkey PRIMARY KEY (id);


--
-- Name: colab_documents colab_documents_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_documents
    ADD CONSTRAINT colab_documents_pkey PRIMARY KEY (id);


--
-- Name: colab_email_jobs colab_email_jobs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_email_jobs
    ADD CONSTRAINT colab_email_jobs_pkey PRIMARY KEY (id);


--
-- Name: colab_export_jobs colab_export_jobs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_jobs
    ADD CONSTRAINT colab_export_jobs_pkey PRIMARY KEY (id);


--
-- Name: colab_export_logs colab_export_logs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_logs
    ADD CONSTRAINT colab_export_logs_pkey PRIMARY KEY (id);


--
-- Name: colab_export_schedules colab_export_schedules_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_schedules
    ADD CONSTRAINT colab_export_schedules_pkey PRIMARY KEY (id);


--
-- Name: colab_export_templates colab_export_templates_name_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_templates
    ADD CONSTRAINT colab_export_templates_name_key UNIQUE (name);


--
-- Name: colab_export_templates colab_export_templates_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_templates
    ADD CONSTRAINT colab_export_templates_pkey PRIMARY KEY (id);


--
-- Name: colab_field_logs colab_field_logs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_logs
    ADD CONSTRAINT colab_field_logs_pkey PRIMARY KEY (id);


--
-- Name: colab_field_sessions colab_field_sessions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_sessions
    ADD CONSTRAINT colab_field_sessions_pkey PRIMARY KEY (id);


--
-- Name: colab_maille_assignments colab_maille_assignments_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_assignments
    ADD CONSTRAINT colab_maille_assignments_pkey PRIMARY KEY (assignment_id);


--
-- Name: colab_maille_notification_logs colab_maille_notification_logs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_notification_logs
    ADD CONSTRAINT colab_maille_notification_logs_pkey PRIMARY KEY (id);


--
-- Name: colab_mission_assignments colab_mission_assignments_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_assignments
    ADD CONSTRAINT colab_mission_assignments_pkey PRIMARY KEY (id);


--
-- Name: colab_mission_sondages colab_mission_sondages_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_sondages
    ADD CONSTRAINT colab_mission_sondages_pkey PRIMARY KEY (id);


--
-- Name: colab_missions colab_missions_code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_missions
    ADD CONSTRAINT colab_missions_code_key UNIQUE (code);


--
-- Name: colab_missions colab_missions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_missions
    ADD CONSTRAINT colab_missions_pkey PRIMARY KEY (id);


--
-- Name: colab_notifications colab_notifications_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_notifications
    ADD CONSTRAINT colab_notifications_pkey PRIMARY KEY (id);


--
-- Name: colab_photos colab_photos_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_photos
    ADD CONSTRAINT colab_photos_pkey PRIMARY KEY (id);


--
-- Name: colab_question_tags colab_question_tags_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_question_tags
    ADD CONSTRAINT colab_question_tags_pkey PRIMARY KEY (question_id, tag_id);


--
-- Name: colab_questions colab_questions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_questions
    ADD CONSTRAINT colab_questions_pkey PRIMARY KEY (id);


--
-- Name: colab_sondage_status_history colab_sondage_status_history_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_sondage_status_history
    ADD CONSTRAINT colab_sondage_status_history_pkey PRIMARY KEY (id);


--
-- Name: colab_student_prefs colab_student_prefs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_student_prefs
    ADD CONSTRAINT colab_student_prefs_pkey PRIMARY KEY (student_id);


--
-- Name: colab_students colab_students_matricule_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_students
    ADD CONSTRAINT colab_students_matricule_key UNIQUE (matricule);


--
-- Name: colab_students colab_students_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_students
    ADD CONSTRAINT colab_students_pkey PRIMARY KEY (id);


--
-- Name: colab_students colab_students_user_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_students
    ADD CONSTRAINT colab_students_user_id_key UNIQUE (user_id);


--
-- Name: colab_supervisors colab_supervisors_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_supervisors
    ADD CONSTRAINT colab_supervisors_pkey PRIMARY KEY (id);


--
-- Name: colab_supervisors colab_supervisors_user_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_supervisors
    ADD CONSTRAINT colab_supervisors_user_id_key UNIQUE (user_id);


--
-- Name: colab_sync_queue colab_sync_queue_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_sync_queue
    ADD CONSTRAINT colab_sync_queue_pkey PRIMARY KEY (id);


--
-- Name: colab_sync_queue colab_sync_queue_user_id_client_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_sync_queue
    ADD CONSTRAINT colab_sync_queue_user_id_client_id_key UNIQUE (user_id, client_id);


--
-- Name: colab_tags colab_tags_name_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_tags
    ADD CONSTRAINT colab_tags_name_key UNIQUE (name);


--
-- Name: colab_tags colab_tags_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_tags
    ADD CONSTRAINT colab_tags_pkey PRIMARY KEY (id);


--
-- Name: colab_tags colab_tags_slug_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_tags
    ADD CONSTRAINT colab_tags_slug_key UNIQUE (slug);


--
-- Name: colab_track_points colab_track_points_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_track_points
    ADD CONSTRAINT colab_track_points_pkey PRIMARY KEY (id);


--
-- Name: colab_tracks colab_tracks_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_tracks
    ADD CONSTRAINT colab_tracks_pkey PRIMARY KEY (id);


--
-- Name: colab_user_badges colab_user_badges_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_user_badges
    ADD CONSTRAINT colab_user_badges_pkey PRIMARY KEY (user_id, badge_id);


--
-- Name: colab_user_stats colab_user_stats_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_user_stats
    ADD CONSTRAINT colab_user_stats_pkey PRIMARY KEY (user_id);


--
-- Name: colab_votes colab_votes_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_votes
    ADD CONSTRAINT colab_votes_pkey PRIMARY KEY (id);


--
-- Name: colab_votes colab_votes_user_id_target_type_target_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_votes
    ADD CONSTRAINT colab_votes_user_id_target_type_target_id_key UNIQUE (user_id, target_type, target_id);


--
-- Name: column_ui_metadata column_ui_metadata_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.column_ui_metadata
    ADD CONSTRAINT column_ui_metadata_pkey PRIMARY KEY (id);


--
-- Name: column_ui_metadata column_ui_metadata_schema_name_table_name_column_name_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.column_ui_metadata
    ADD CONSTRAINT column_ui_metadata_schema_name_table_name_column_name_key UNIQUE (schema_name, table_name, column_name);


--
-- Name: country_tg country_tg_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.country_tg
    ADD CONSTRAINT country_tg_pkey PRIMARY KEY (id);


--
-- Name: dataset_metadata dataset_metadata_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.dataset_metadata
    ADD CONSTRAINT dataset_metadata_pkey PRIMARY KEY (dataset_key);


--
-- Name: dsm_cop30 dsm_cop30_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.dsm_cop30
    ADD CONSTRAINT dsm_cop30_pkey PRIMARY KEY (rid);


--
-- Name: echantillons echantillons_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.echantillons
    ADD CONSTRAINT echantillons_pkey PRIMARY KEY (id);


--
-- Name: essais_atterberg essais_atterberg_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_atterberg
    ADD CONSTRAINT essais_atterberg_pkey PRIMARY KEY (id);


--
-- Name: essais_classif essais_classif_echantillon_unique; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_classif
    ADD CONSTRAINT essais_classif_echantillon_unique UNIQUE (echantillon_id);


--
-- Name: essais_classif essais_classif_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_classif
    ADD CONSTRAINT essais_classif_pkey PRIMARY KEY (id);


--
-- Name: essais_geotechniques essais_geotechniques_echantillon_unique; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_echantillon_unique UNIQUE (echantillon_id);


--
-- Name: essais_geotechniques essais_geotechniques_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_pkey PRIMARY KEY (id);


--
-- Name: essais_physiques essais_physiques_echantillon_unique; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_physiques
    ADD CONSTRAINT essais_physiques_echantillon_unique UNIQUE (echantillon_id);


--
-- Name: essais_physiques essais_physiques_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_physiques
    ADD CONSTRAINT essais_physiques_pkey PRIMARY KEY (id);


--
-- Name: essais essais_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais
    ADD CONSTRAINT essais_pkey PRIMARY KEY (id);


--
-- Name: essais_potentiel_gonflement essais_potentiel_gonflement_echantillon_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_potentiel_gonflement
    ADD CONSTRAINT essais_potentiel_gonflement_echantillon_id_key UNIQUE (echantillon_id);


--
-- Name: essais_potentiel_gonflement essais_potentiel_gonflement_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_potentiel_gonflement
    ADD CONSTRAINT essais_potentiel_gonflement_pkey PRIMARY KEY (id);


--
-- Name: essais_proctor essais_proctor_echantillon_id_proctor_type_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_proctor
    ADD CONSTRAINT essais_proctor_echantillon_id_proctor_type_key UNIQUE (echantillon_id, proctor_type);


--
-- Name: essais_proctor essais_proctor_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_proctor
    ADD CONSTRAINT essais_proctor_pkey PRIMARY KEY (id);


--
-- Name: essais_vbs essais_vbs_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_vbs
    ADD CONSTRAINT essais_vbs_pkey PRIMARY KEY (id);


--
-- Name: granulo_points granulo_points_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.granulo_points
    ADD CONSTRAINT granulo_points_pkey PRIMARY KEY (id);


--
-- Name: import_errors import_errors_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.import_errors
    ADD CONSTRAINT import_errors_pkey PRIMARY KEY (id);


--
-- Name: imports imports_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.imports
    ADD CONSTRAINT imports_pkey PRIMARY KEY (id);


--
-- Name: layer_style layer_style_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.layer_style
    ADD CONSTRAINT layer_style_pkey PRIMARY KEY (layer_id, unit_code);


--
-- Name: maille_28km maille_28km_code_m28_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.maille_28km
    ADD CONSTRAINT maille_28km_code_m28_key UNIQUE (code_m28);


--
-- Name: maille_28km maille_28km_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.maille_28km
    ADD CONSTRAINT maille_28km_pkey PRIMARY KEY (id_m28);


--
-- Name: mailles mailles_code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.mailles
    ADD CONSTRAINT mailles_code_key UNIQUE (code);


--
-- Name: mailles mailles_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.mailles
    ADD CONSTRAINT mailles_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_pkey PRIMARY KEY (id);


--
-- Name: password_reset_tokens password_reset_tokens_token_hash_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_token_hash_key UNIQUE (token_hash);


--
-- Name: permissions permissions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.permissions
    ADD CONSTRAINT permissions_pkey PRIMARY KEY (id);


--
-- Name: permissions permissions_resource_action_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.permissions
    ADD CONSTRAINT permissions_resource_action_key UNIQUE (resource, action);


--
-- Name: risque_gonflement risque_gonflement_pk; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.risque_gonflement
    ADD CONSTRAINT risque_gonflement_pk PRIMARY KEY (ogc_fid);


--
-- Name: role_permissions role_permissions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.role_permissions
    ADD CONSTRAINT role_permissions_pkey PRIMARY KEY (role_id, permission_id);


--
-- Name: roles roles_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.roles
    ADD CONSTRAINT roles_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sessions
    ADD CONSTRAINT sessions_pkey PRIMARY KEY (id);


--
-- Name: sessions sessions_refresh_token_hash_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sessions
    ADD CONSTRAINT sessions_refresh_token_hash_key UNIQUE (refresh_token_hash);


--
-- Name: sessions sessions_token_hash_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sessions
    ADD CONSTRAINT sessions_token_hash_key UNIQUE (token_hash);


--
-- Name: sondages_legacy_20251117 sondages_legacy_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages_legacy_20251117
    ADD CONSTRAINT sondages_legacy_pkey PRIMARY KEY (id);


--
-- Name: sondages_non_geocodes sondages_non_geocodes_code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages_non_geocodes
    ADD CONSTRAINT sondages_non_geocodes_code_key UNIQUE (code);


--
-- Name: sondages_non_geocodes sondages_non_geocodes_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages_non_geocodes
    ADD CONSTRAINT sondages_non_geocodes_pkey PRIMARY KEY (id);


--
-- Name: sondages sondages_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages
    ADD CONSTRAINT sondages_pkey PRIMARY KEY (id);


--
-- Name: staging_locks staging_locks_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_locks
    ADD CONSTRAINT staging_locks_pkey PRIMARY KEY (table_name);


--
-- Name: staging_metadata staging_metadata_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_metadata
    ADD CONSTRAINT staging_metadata_pkey PRIMARY KEY (staging_id);


--
-- Name: staging_test_staging_commit_4f73d120_7047_4565_a744_142b3bc29fd staging_test_staging_commit_4f73d120_7047_4565_a744_142b3b_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_commit_4f73d120_7047_4565_a744_142b3bc29fd
    ADD CONSTRAINT staging_test_staging_commit_4f73d120_7047_4565_a744_142b3b_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_commit_9aabfebb_e76a_4ec3_bff6_71b7de7b0c4 staging_test_staging_commit_9aabfebb_e76a_4ec3_bff6_71b7de_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_commit_9aabfebb_e76a_4ec3_bff6_71b7de7b0c4
    ADD CONSTRAINT staging_test_staging_commit_9aabfebb_e76a_4ec3_bff6_71b7de_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_commit_ef9e5cc5_4c89_4452_a21f_6dea323e514 staging_test_staging_commit_ef9e5cc5_4c89_4452_a21f_6dea32_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_commit_ef9e5cc5_4c89_4452_a21f_6dea323e514
    ADD CONSTRAINT staging_test_staging_commit_ef9e5cc5_4c89_4452_a21f_6dea32_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489bffcd staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08__code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489bffcd
    ADD CONSTRAINT staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08__code_key UNIQUE (code);


--
-- Name: staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489bffcd staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489bffcd
    ADD CONSTRAINT staging_test_staging_rollback_80f299e5_ff7a_4e69_8f08_e489_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf0fafe staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee__code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf0fafe
    ADD CONSTRAINT staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee__code_key UNIQUE (code);


--
-- Name: staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf0fafe staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf0fafe
    ADD CONSTRAINT staging_test_staging_rollback_b9ea4131_07ae_4511_a1ee_f5cf_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_validation_62ba95fe_5606_40e3_b9b7_9f53972 staging_test_staging_validation_62ba95fe_5606_40e3_b9b7_9f_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_validation_62ba95fe_5606_40e3_b9b7_9f53972
    ADD CONSTRAINT staging_test_staging_validation_62ba95fe_5606_40e3_b9b7_9f_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_validation_c3c5d24d_503f_470d_a9a5_3f7a834 staging_test_staging_validation_c3c5d24d_503f_470d_a9a5_3f_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_validation_c3c5d24d_503f_470d_a9a5_3f7a834
    ADD CONSTRAINT staging_test_staging_validation_c3c5d24d_503f_470d_a9a5_3f_pkey PRIMARY KEY (id);


--
-- Name: staging_test_staging_validation_c7876d39_7d1e_4bc5_8e94_29278d7 staging_test_staging_validation_c7876d39_7d1e_4bc5_8e94_29_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.staging_test_staging_validation_c7876d39_7d1e_4bc5_8e94_29278d7
    ADD CONSTRAINT staging_test_staging_validation_c7876d39_7d1e_4bc5_8e94_29_pkey PRIMARY KEY (id);


--
-- Name: survey_aliases survey_aliases_alias_code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.survey_aliases
    ADD CONSTRAINT survey_aliases_alias_code_key UNIQUE (alias_code);


--
-- Name: survey_aliases survey_aliases_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.survey_aliases
    ADD CONSTRAINT survey_aliases_pkey PRIMARY KEY (id);


--
-- Name: survey_tests survey_tests_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.survey_tests
    ADD CONSTRAINT survey_tests_pkey PRIMARY KEY (id);


--
-- Name: survey_tests survey_tests_survey_id_test_type_raw_source_id_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.survey_tests
    ADD CONSTRAINT survey_tests_survey_id_test_type_raw_source_id_key UNIQUE (survey_id, test_type, raw_source_id);


--
-- Name: table_versions table_versions_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.table_versions
    ADD CONSTRAINT table_versions_pkey PRIMARY KEY (version);


--
-- Name: test_staging_rollback test_staging_rollback_code_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.test_staging_rollback
    ADD CONSTRAINT test_staging_rollback_code_key UNIQUE (code);


--
-- Name: test_staging_rollback test_staging_rollback_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.test_staging_rollback
    ADD CONSTRAINT test_staging_rollback_pkey PRIMARY KEY (id);


--
-- Name: colab_mission_assignments unique_active_assignment; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_assignments
    ADD CONSTRAINT unique_active_assignment UNIQUE (mission_id, student_id, unassigned_at);


--
-- Name: classifications unique_classification; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.classifications
    ADD CONSTRAINT unique_classification UNIQUE (sondage_id, profondeur_m, methode);


--
-- Name: colab_mission_sondages unique_mission_sondage; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_sondages
    ADD CONSTRAINT unique_mission_sondage UNIQUE (mission_id, sondage_id);


--
-- Name: unites_geologiques unites_geologiques_pk; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.unites_geologiques
    ADD CONSTRAINT unites_geologiques_pk PRIMARY KEY (ogc_fid);


--
-- Name: unites_pedologiques unites_pedologiques_pk; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.unites_pedologiques
    ADD CONSTRAINT unites_pedologiques_pk PRIMARY KEY (ogc_fid);


--
-- Name: user_roles user_roles_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.user_roles
    ADD CONSTRAINT user_roles_pkey PRIMARY KEY (user_id, role_id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: users users_username_key; Type: CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- Name: admin_limites_25231 admin_limites_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.admin_limites_25231
    ADD CONSTRAINT admin_limites_25231_pkey PRIMARY KEY (id);


--
-- Name: batiments_25231 batiments_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.batiments_25231
    ADD CONSTRAINT batiments_25231_pkey PRIMARY KEY (id);


--
-- Name: hydro_cours_eau_25231 hydro_cours_eau_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.hydro_cours_eau_25231
    ADD CONSTRAINT hydro_cours_eau_25231_pkey PRIMARY KEY (id);


--
-- Name: hydro_surfaces_25231 hydro_surfaces_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.hydro_surfaces_25231
    ADD CONSTRAINT hydro_surfaces_25231_pkey PRIMARY KEY (id);


--
-- Name: localites_points_25231 localites_points_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.localites_points_25231
    ADD CONSTRAINT localites_points_25231_pkey PRIMARY KEY (id);


--
-- Name: localites_polygons_25231 localites_polygons_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.localites_polygons_25231
    ADD CONSTRAINT localites_polygons_25231_pkey PRIMARY KEY (id);


--
-- Name: routes_25231 routes_25231_pkey; Type: CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.routes_25231
    ADD CONSTRAINT routes_25231_pkey PRIMARY KEY (id);


--
-- Name: poi_terrain poi_terrain_pkey; Type: CONSTRAINT; Schema: atlas_terrain; Owner: -
--

ALTER TABLE ONLY atlas_terrain.poi_terrain
    ADD CONSTRAINT poi_terrain_pkey PRIMARY KEY (id);


--
-- Name: routes_corrections routes_corrections_pkey; Type: CONSTRAINT; Schema: atlas_terrain; Owner: -
--

ALTER TABLE ONLY atlas_terrain.routes_corrections
    ADD CONSTRAINT routes_corrections_pkey PRIMARY KEY (id);


--
-- Name: adm0_raw adm0_raw_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adm0_raw
    ADD CONSTRAINT adm0_raw_pkey PRIMARY KEY (ogc_fid);


--
-- Name: adm1_tg adm1_tg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adm1_tg
    ADD CONSTRAINT adm1_tg_pkey PRIMARY KEY (id);


--
-- Name: adm2_tg adm2_tg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adm2_tg
    ADD CONSTRAINT adm2_tg_pkey PRIMARY KEY (id);


--
-- Name: adm3 adm3_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adm3
    ADD CONSTRAINT adm3_pkey PRIMARY KEY (gid);


--
-- Name: adm3_tg adm3_tg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.adm3_tg
    ADD CONSTRAINT adm3_tg_pkey PRIMARY KEY (id);


--
-- Name: audit_log audit_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.audit_log
    ADD CONSTRAINT audit_log_pkey PRIMARY KEY (id);


--
-- Name: country_tg country_tg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.country_tg
    ADD CONSTRAINT country_tg_pkey PRIMARY KEY (id);


--
-- Name: geocode_suggestions geocode_suggestions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.geocode_suggestions
    ADD CONSTRAINT geocode_suggestions_pkey PRIMARY KEY (id);


--
-- Name: grid grid_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.grid
    ADD CONSTRAINT grid_pkey PRIMARY KEY (id);


--
-- Name: mailles mailles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mailles
    ADD CONSTRAINT mailles_pkey PRIMARY KEY (id);


--
-- Name: raw_lab_ags raw_lab_ags_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_lab_ags
    ADD CONSTRAINT raw_lab_ags_pkey PRIMARY KEY (id);


--
-- Name: raw_lab_agt raw_lab_agt_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_lab_agt
    ADD CONSTRAINT raw_lab_agt_pkey PRIMARY KEY (id);


--
-- Name: raw_lab_atterberg raw_lab_atterberg_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.raw_lab_atterberg
    ADD CONSTRAINT raw_lab_atterberg_pkey PRIMARY KEY (id);


--
-- Name: refresh_queue refresh_queue_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.refresh_queue
    ADD CONSTRAINT refresh_queue_pkey PRIMARY KEY (id);


--
-- Name: thematic_configs thematic_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.thematic_configs
    ADD CONSTRAINT thematic_configs_pkey PRIMARY KEY (id);


--
-- Name: boundary_togo_geom_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX boundary_togo_geom_idx ON atlas.boundary_togo USING gist (geom);


--
-- Name: colab_maille_assignments_maille_uidx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX colab_maille_assignments_maille_uidx ON atlas.colab_maille_assignments USING btree (maille_id);


--
-- Name: dsm_cop30_rast_st_convexhull_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX dsm_cop30_rast_st_convexhull_idx ON atlas.dsm_cop30 USING gist (public.st_convexhull(rast));


--
-- Name: echantillons_sondage_depth_date_unique; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX echantillons_sondage_depth_date_unique ON atlas.echantillons USING btree (sondage_id, depth_m, date);


--
-- Name: essais_atterberg_echantillon_unique; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX essais_atterberg_echantillon_unique ON atlas.essais_atterberg USING btree (echantillon_id);


--
-- Name: essais_vbs_echantillon_unique; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX essais_vbs_echantillon_unique ON atlas.essais_vbs USING btree (echantillon_id);


--
-- Name: granulo_points_ech_method_sieve_unique; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX granulo_points_ech_method_sieve_unique ON atlas.granulo_points USING btree (echantillon_id, method, sieve_mm);


--
-- Name: idx_adm1_tg_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_adm1_tg_geom ON atlas.adm1_tg USING gist (geom);


--
-- Name: idx_adm2_tg_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_adm2_tg_geom ON atlas.adm2_tg USING gist (geom);


--
-- Name: idx_adm3_tg_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_adm3_tg_geom ON atlas.adm3_tg USING gist (geom);


--
-- Name: idx_atlas_adm3_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_adm3_geom ON atlas.adm3 USING gist (geom);


--
-- Name: idx_atlas_adm3_pcode; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_adm3_pcode ON atlas.adm3 USING btree (adm3_pcode);


--
-- Name: idx_atlas_surveys_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_surveys_code ON atlas.surveys USING btree (code);


--
-- Name: idx_atlas_surveys_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_surveys_created_at ON atlas.surveys USING btree (created_at);


--
-- Name: idx_atlas_surveys_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_surveys_geom ON atlas.surveys USING gist (geom);


--
-- Name: idx_atlas_surveys_localite; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_surveys_localite ON atlas.surveys USING btree (localite_canon);


--
-- Name: idx_atlas_surveys_source; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_atlas_surveys_source ON atlas.surveys USING btree (source);


--
-- Name: idx_audit_log_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_audit_log_created ON atlas.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_audit_log_created_at ON atlas.audit_log USING btree (created_at DESC);


--
-- Name: idx_audit_log_operation; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_audit_log_operation ON atlas.audit_log USING btree (operation);


--
-- Name: idx_audit_log_table; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_audit_log_table ON atlas.audit_log USING btree (schema_name, table_name);


--
-- Name: idx_audit_log_table_name; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_audit_log_table_name ON atlas.audit_log USING btree (table_name);


--
-- Name: idx_audit_log_user; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_audit_log_user ON atlas.audit_log USING btree (user_id) WHERE (user_id IS NOT NULL);


--
-- Name: idx_auth_audit_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_auth_audit_created_at ON atlas.auth_audit_log USING btree (created_at);


--
-- Name: idx_auth_audit_event_type; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_auth_audit_event_type ON atlas.auth_audit_log USING btree (event_type);


--
-- Name: idx_auth_audit_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_auth_audit_user_id ON atlas.auth_audit_log USING btree (user_id);


--
-- Name: idx_backup_metadata_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_backup_metadata_created ON atlas.backup_metadata USING btree (created_at DESC);


--
-- Name: idx_changesets_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_changesets_created_at ON atlas.changesets USING btree (created_at DESC);


--
-- Name: idx_changesets_table_name; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_changesets_table_name ON atlas.changesets USING btree (table_name);


--
-- Name: idx_changesets_undone_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_changesets_undone_at ON atlas.changesets USING btree (undone_at) WHERE (undone_at IS NOT NULL);


--
-- Name: idx_classifications_methode; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_classifications_methode ON atlas.classifications USING btree (methode);


--
-- Name: idx_classifications_profondeur; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_classifications_profondeur ON atlas.classifications USING btree (profondeur_m);


--
-- Name: idx_classifications_sondage_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_classifications_sondage_id ON atlas.classifications USING btree (sondage_id);


--
-- Name: idx_colab_answers_author; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_answers_author ON atlas.colab_answers USING btree (author_id);


--
-- Name: idx_colab_answers_best; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_answers_best ON atlas.colab_answers USING btree (question_id, is_best) WHERE (is_best = true);


--
-- Name: idx_colab_answers_question; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_answers_question ON atlas.colab_answers USING btree (question_id);


--
-- Name: idx_colab_assignments_active; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_assignments_active ON atlas.colab_mission_assignments USING btree (mission_id) WHERE (unassigned_at IS NULL);


--
-- Name: idx_colab_assignments_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_assignments_mission ON atlas.colab_mission_assignments USING btree (mission_id);


--
-- Name: idx_colab_assignments_student; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_assignments_student ON atlas.colab_mission_assignments USING btree (student_id);


--
-- Name: idx_colab_comments_author; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_comments_author ON atlas.colab_comments USING btree (author_id);


--
-- Name: idx_colab_comments_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_comments_created ON atlas.colab_comments USING btree (created_at DESC);


--
-- Name: idx_colab_comments_entity; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_comments_entity ON atlas.colab_comments USING btree (entity_type, entity_id);


--
-- Name: idx_colab_comments_parent; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_comments_parent ON atlas.colab_comments USING btree (parent_comment_id);


--
-- Name: idx_colab_documents_current; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_documents_current ON atlas.colab_documents USING btree (mission_id) WHERE (is_current = true);


--
-- Name: idx_colab_documents_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_documents_mission ON atlas.colab_documents USING btree (mission_id);


--
-- Name: idx_colab_documents_sondage; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_documents_sondage ON atlas.colab_documents USING btree (sondage_id);


--
-- Name: idx_colab_documents_type; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_documents_type ON atlas.colab_documents USING btree (document_type);


--
-- Name: idx_colab_documents_uploaded_by; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_documents_uploaded_by ON atlas.colab_documents USING btree (uploaded_by);


--
-- Name: idx_colab_export_jobs_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_jobs_created_at ON atlas.colab_export_jobs USING btree (created_at DESC);


--
-- Name: idx_colab_export_jobs_created_by; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_jobs_created_by ON atlas.colab_export_jobs USING btree (created_by);


--
-- Name: idx_colab_export_jobs_status; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_jobs_status ON atlas.colab_export_jobs USING btree (status);


--
-- Name: idx_colab_export_logs_actor; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_logs_actor ON atlas.colab_export_logs USING btree (actor);


--
-- Name: idx_colab_export_logs_job_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_logs_job_id ON atlas.colab_export_logs USING btree (job_id);


--
-- Name: idx_colab_export_logs_timestamp; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_logs_timestamp ON atlas.colab_export_logs USING btree ("timestamp" DESC);


--
-- Name: idx_colab_export_schedules_active; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_schedules_active ON atlas.colab_export_schedules USING btree (is_active);


--
-- Name: idx_colab_export_schedules_next_run; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_schedules_next_run ON atlas.colab_export_schedules USING btree (next_run_at);


--
-- Name: idx_colab_export_templates_active; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_templates_active ON atlas.colab_export_templates USING btree (is_active);


--
-- Name: idx_colab_export_templates_format; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_templates_format ON atlas.colab_export_templates USING btree (format);


--
-- Name: idx_colab_export_templates_source; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_export_templates_source ON atlas.colab_export_templates USING btree (source);


--
-- Name: idx_colab_field_logs_author; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_field_logs_author ON atlas.colab_field_logs USING btree (author_id);


--
-- Name: idx_colab_field_logs_date; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_field_logs_date ON atlas.colab_field_logs USING btree (log_date);


--
-- Name: idx_colab_field_logs_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_field_logs_mission ON atlas.colab_field_logs USING btree (mission_id);


--
-- Name: idx_colab_field_logs_sondage; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_field_logs_sondage ON atlas.colab_field_logs USING btree (sondage_id);


--
-- Name: idx_colab_field_logs_type; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_field_logs_type ON atlas.colab_field_logs USING btree (log_type);


--
-- Name: idx_colab_maille_assignments_adm_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_maille_assignments_adm_code ON atlas.colab_maille_assignments USING btree (adm_code_used);


--
-- Name: idx_colab_maille_assignments_maille; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_maille_assignments_maille ON atlas.colab_maille_assignments USING btree (maille_id);


--
-- Name: idx_colab_maille_notif_logs_assignment; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_maille_notif_logs_assignment ON atlas.colab_maille_notification_logs USING btree (assignment_id, requested_at DESC);


--
-- Name: idx_colab_maille_notif_logs_job; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_maille_notif_logs_job ON atlas.colab_maille_notification_logs USING btree (email_job_id);


--
-- Name: idx_colab_mentions_user; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_mentions_user ON atlas.colab_comment_mentions USING btree (mentioned_user_id);


--
-- Name: idx_colab_mission_sondages_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_mission_sondages_mission ON atlas.colab_mission_sondages USING btree (mission_id);


--
-- Name: idx_colab_mission_sondages_sondage; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_mission_sondages_sondage ON atlas.colab_mission_sondages USING btree (sondage_id);


--
-- Name: idx_colab_missions_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_code ON atlas.colab_missions USING btree (code);


--
-- Name: idx_colab_missions_created_by; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_created_by ON atlas.colab_missions USING btree (created_by);


--
-- Name: idx_colab_missions_dates; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_dates ON atlas.colab_missions USING btree (start_date, end_date);


--
-- Name: idx_colab_missions_maille_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_maille_id ON atlas.colab_missions USING btree (maille_id);


--
-- Name: idx_colab_missions_status; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_status ON atlas.colab_missions USING btree (status);


--
-- Name: idx_colab_missions_supervisor_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_supervisor_id ON atlas.colab_missions USING btree (supervisor_id);


--
-- Name: idx_colab_missions_theme; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_missions_theme ON atlas.colab_missions USING btree (theme);


--
-- Name: idx_colab_notifications_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_notifications_created ON atlas.colab_notifications USING btree (created_at DESC);


--
-- Name: idx_colab_notifications_user; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_notifications_user ON atlas.colab_notifications USING btree (user_id, is_read);


--
-- Name: idx_colab_photos_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_photos_geom ON atlas.colab_photos USING gist (geom);


--
-- Name: idx_colab_photos_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_photos_mission ON atlas.colab_photos USING btree (mission_id);


--
-- Name: idx_colab_photos_sondage; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_photos_sondage ON atlas.colab_photos USING btree (sondage_id);


--
-- Name: idx_colab_questions_author; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_questions_author ON atlas.colab_questions USING btree (author_id);


--
-- Name: idx_colab_questions_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_questions_created ON atlas.colab_questions USING btree (created_at DESC);


--
-- Name: idx_colab_questions_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_questions_mission ON atlas.colab_questions USING btree (mission_id);


--
-- Name: idx_colab_questions_score; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_questions_score ON atlas.colab_questions USING btree (score DESC);


--
-- Name: idx_colab_questions_search; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_questions_search ON atlas.colab_questions USING gin (to_tsvector('french'::regconfig, ((title || ' '::text) || body)));


--
-- Name: idx_colab_student_prefs_adm_niveau; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_student_prefs_adm_niveau ON atlas.colab_student_prefs USING btree (adm_niveau);


--
-- Name: idx_colab_student_prefs_email; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_student_prefs_email ON atlas.colab_student_prefs USING btree (email);


--
-- Name: idx_colab_student_prefs_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_student_prefs_user_id ON atlas.colab_student_prefs USING btree (user_id);


--
-- Name: idx_colab_students_etablissement; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_students_etablissement ON atlas.colab_students USING btree (etablissement);


--
-- Name: idx_colab_students_promotion; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_students_promotion ON atlas.colab_students USING btree (promotion);


--
-- Name: idx_colab_students_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_students_user_id ON atlas.colab_students USING btree (user_id);


--
-- Name: idx_colab_supervisors_institution; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_supervisors_institution ON atlas.colab_supervisors USING btree (institution);


--
-- Name: idx_colab_supervisors_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_supervisors_user_id ON atlas.colab_supervisors USING btree (user_id);


--
-- Name: idx_colab_tracks_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_tracks_geom ON atlas.colab_tracks USING gist (geom);


--
-- Name: idx_colab_tracks_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_tracks_mission ON atlas.colab_tracks USING btree (mission_id);


--
-- Name: idx_colab_tracks_user; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_tracks_user ON atlas.colab_tracks USING btree (user_id);


--
-- Name: idx_colab_votes_target; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_colab_votes_target ON atlas.colab_votes USING btree (target_type, target_id);


--
-- Name: idx_column_ui_metadata_table; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_column_ui_metadata_table ON atlas.column_ui_metadata USING btree (schema_name, table_name);


--
-- Name: idx_country_tg_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_country_tg_geom ON atlas.country_tg USING gist (geom);


--
-- Name: idx_echantillons_sondage_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_echantillons_sondage_id ON atlas.echantillons USING btree (sondage_id);


--
-- Name: idx_essais_classif_echantillon; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_essais_classif_echantillon ON atlas.essais_classif USING btree (echantillon_id);


--
-- Name: idx_essais_geo_echantillon; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_essais_geo_echantillon ON atlas.essais_geotechniques USING btree (echantillon_id);


--
-- Name: idx_essais_geo_sondage_depth; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_essais_geo_sondage_depth ON atlas.essais_geotechniques USING btree (sondage_id, depth_m);


--
-- Name: idx_essais_sondage; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_essais_sondage ON atlas.essais USING btree (sondage_id);


--
-- Name: idx_essais_type; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_essais_type ON atlas.essais USING btree (type);


--
-- Name: idx_field_sessions_active; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_field_sessions_active ON atlas.colab_field_sessions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_field_sessions_mission; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_field_sessions_mission ON atlas.colab_field_sessions USING btree (mission_id);


--
-- Name: idx_field_sessions_user; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_field_sessions_user ON atlas.colab_field_sessions USING btree (user_id);


--
-- Name: idx_import_errors_import_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_import_errors_import_id ON atlas.import_errors USING btree (import_id);


--
-- Name: idx_import_errors_severity; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_import_errors_severity ON atlas.import_errors USING btree (severity);


--
-- Name: idx_imports_batch_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_imports_batch_id ON atlas.imports USING btree (batch_id);


--
-- Name: idx_imports_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_imports_created_at ON atlas.imports USING btree (created_at DESC);


--
-- Name: idx_imports_status; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_imports_status ON atlas.imports USING btree (status);


--
-- Name: idx_layer_style_layer_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_layer_style_layer_id ON atlas.layer_style USING btree (layer_id);


--
-- Name: idx_maille_28km_code_lisible; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_maille_28km_code_lisible ON atlas.maille_28km USING btree (code_lisible);


--
-- Name: idx_mailles_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mailles_code ON atlas.mailles USING btree (code);


--
-- Name: idx_mailles_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mailles_geom ON atlas.mailles USING gist (geom);


--
-- Name: idx_mailles_utm31_bbox; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mailles_utm31_bbox ON atlas.mailles USING btree (xmin_utm31, xmax_utm31, ymin_utm31, ymax_utm31);


--
-- Name: idx_mv_mailles_geotech_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_code ON atlas.mv_mailles_geotech USING btree (code);


--
-- Name: idx_mv_mailles_geotech_eg_avg; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_eg_avg ON atlas.mv_mailles_geotech USING btree (eg_avg) WHERE (eg_avg IS NOT NULL);


--
-- Name: idx_mv_mailles_geotech_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_geom ON atlas.mv_mailles_geotech USING gist (geom);


--
-- Name: idx_mv_mailles_geotech_geom_4326; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_geom_4326 ON atlas.mv_mailles_geotech USING gist (geom_4326);


--
-- Name: idx_mv_mailles_geotech_has_data; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_has_data ON atlas.mv_mailles_geotech USING btree (has_data) WHERE (has_data = true);


--
-- Name: idx_mv_mailles_geotech_ip_avg; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_ip_avg ON atlas.mv_mailles_geotech USING btree (ip_avg) WHERE (ip_avg IS NOT NULL);


--
-- Name: idx_mv_mailles_geotech_n_sondages; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_n_sondages ON atlas.mv_mailles_geotech USING btree (n_sondages) WHERE (n_sondages > 0);


--
-- Name: idx_mv_mailles_geotech_vbs_avg; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_mv_mailles_geotech_vbs_avg ON atlas.mv_mailles_geotech USING btree (vbs_avg) WHERE (vbs_avg IS NOT NULL);


--
-- Name: idx_password_reset_token_hash; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_password_reset_token_hash ON atlas.password_reset_tokens USING btree (token_hash);


--
-- Name: idx_password_reset_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_password_reset_user_id ON atlas.password_reset_tokens USING btree (user_id);


--
-- Name: idx_potentiel_gonflement_cg_qual; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_potentiel_gonflement_cg_qual ON atlas.essais_potentiel_gonflement USING btree (cg_qual);


--
-- Name: idx_potentiel_gonflement_echantillon; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_potentiel_gonflement_echantillon ON atlas.essais_potentiel_gonflement USING btree (echantillon_id);


--
-- Name: idx_question_tags_tag; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_question_tags_tag ON atlas.colab_question_tags USING btree (tag_id);


--
-- Name: idx_sessions_expires_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sessions_expires_at ON atlas.sessions USING btree (expires_at);


--
-- Name: idx_sessions_is_active; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sessions_is_active ON atlas.sessions USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_sessions_token_hash; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sessions_token_hash ON atlas.sessions USING btree (token_hash);


--
-- Name: idx_sessions_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sessions_user_id ON atlas.sessions USING btree (user_id);


--
-- Name: idx_sondage_status_history; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondage_status_history ON atlas.colab_sondage_status_history USING btree (sondage_id, changed_at DESC);


--
-- Name: idx_sondages_adm3_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_adm3_id ON atlas.sondages USING btree (adm3_id);


--
-- Name: idx_sondages_amessefe_unique; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX idx_sondages_amessefe_unique ON atlas.sondages USING btree (((meta ->> 'localite'::text)), source) WHERE (source = 'AMESSEFE Komi Yoan Freddy'::text);


--
-- Name: INDEX idx_sondages_amessefe_unique; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON INDEX atlas.idx_sondages_amessefe_unique IS 'Garantit qu''une localité AMESSEFE n''a qu''un seul sondage. Permet l''idempotence des imports.';


--
-- Name: idx_sondages_date; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_date ON atlas.sondages USING btree (date);


--
-- Name: idx_sondages_deleted_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_deleted_at ON atlas.sondages USING btree (deleted_at) WHERE (deleted_at IS NOT NULL);


--
-- Name: idx_sondages_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_geom ON atlas.sondages USING gist (geom);


--
-- Name: idx_sondages_geom_real_gist; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_geom_real_gist ON atlas.sondages USING gist (geom_real);


--
-- Name: idx_sondages_grid_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_grid_code ON atlas.sondages USING btree (grid_code);


--
-- Name: idx_sondages_is_geocoded_v2; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_is_geocoded_v2 ON atlas.sondages USING btree (is_geocoded) WHERE (deleted_at IS NULL);


--
-- Name: idx_sondages_legacy_date; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_legacy_date ON atlas.sondages_legacy_20251117 USING btree (date_sondage);


--
-- Name: idx_sondages_legacy_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_legacy_geom ON atlas.sondages_legacy_20251117 USING gist (geom);


--
-- Name: idx_sondages_localite_key; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_localite_key ON atlas.sondages USING btree (localite_key) WHERE (localite_key IS NOT NULL);


--
-- Name: idx_sondages_maille_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_maille_code ON atlas.sondages USING btree (maille_code) WHERE (maille_code IS NOT NULL);


--
-- Name: idx_sondages_meta_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_meta_code ON atlas.sondages USING btree (((meta ->> 'code'::text)));


--
-- Name: idx_sondages_meta_localite; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_meta_localite ON atlas.sondages USING btree (((meta ->> 'localite'::text)));


--
-- Name: idx_sondages_non_geocodes_code; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_non_geocodes_code ON atlas.sondages_non_geocodes USING btree (code);


--
-- Name: idx_sondages_non_geocodes_commune; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_non_geocodes_commune ON atlas.sondages_non_geocodes USING btree (commune_id);


--
-- Name: idx_sondages_non_geocodes_date; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_non_geocodes_date ON atlas.sondages_non_geocodes USING btree (date_sondage);


--
-- Name: idx_sondages_non_geocodes_localite; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sondages_non_geocodes_localite ON atlas.sondages_non_geocodes USING btree (localite);


--
-- Name: idx_staging_locks_expires; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_staging_locks_expires ON atlas.staging_locks USING btree (expires_at);


--
-- Name: idx_staging_metadata_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_staging_metadata_created ON atlas.staging_metadata USING btree (created_at DESC);


--
-- Name: idx_staging_metadata_table; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_staging_metadata_table ON atlas.staging_metadata USING btree (schema_name, table_name);


--
-- Name: idx_sync_queue_created; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sync_queue_created ON atlas.colab_sync_queue USING btree (created_at);


--
-- Name: idx_sync_queue_user_status; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_sync_queue_user_status ON atlas.colab_sync_queue USING btree (user_id, status);


--
-- Name: idx_table_versions_created_at; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_table_versions_created_at ON atlas.table_versions USING btree (created_at DESC);


--
-- Name: idx_table_versions_table_name; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_table_versions_table_name ON atlas.table_versions USING btree (table_name);


--
-- Name: idx_track_points_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_track_points_geom ON atlas.colab_track_points USING gist (geom);


--
-- Name: idx_track_points_track; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_track_points_track ON atlas.colab_track_points USING btree (track_id, sequence_num);


--
-- Name: idx_user_roles_role_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_user_roles_role_id ON atlas.user_roles USING btree (role_id);


--
-- Name: idx_user_roles_user_id; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_user_roles_user_id ON atlas.user_roles USING btree (user_id);


--
-- Name: idx_users_email; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_users_email ON atlas.users USING btree (email);


--
-- Name: idx_users_is_active; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_users_is_active ON atlas.users USING btree (is_active) WHERE (is_active = true);


--
-- Name: idx_users_username; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_users_username ON atlas.users USING btree (username);


--
-- Name: idx_v_mailles_28km_clip_geom; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX idx_v_mailles_28km_clip_geom ON atlas.maille_28km USING gist (geom);


--
-- Name: ix_survey_tests_survey; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX ix_survey_tests_survey ON atlas.survey_tests USING btree (survey_id);


--
-- Name: ix_survey_tests_type; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX ix_survey_tests_type ON atlas.survey_tests USING btree (test_type);


--
-- Name: maille_28km_geom_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX maille_28km_geom_idx ON atlas.maille_28km USING gist (geom);


--
-- Name: maille_28km_profil_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX maille_28km_profil_idx ON atlas.maille_28km USING btree (profil_num);


--
-- Name: mailles_id_m28_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX mailles_id_m28_idx ON atlas.mailles USING btree (id_m28);


--
-- Name: mv_mailles_geotech_id_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE UNIQUE INDEX mv_mailles_geotech_id_idx ON atlas.mv_mailles_geotech USING btree (id);


--
-- Name: risque_gonflement_geom_geom_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX risque_gonflement_geom_geom_idx ON atlas.risque_gonflement USING gist (geom);


--
-- Name: sondage_id_m28_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX sondage_id_m28_idx ON atlas.sondages USING btree (id_m28);


--
-- Name: survey_aliases_survey_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX survey_aliases_survey_idx ON atlas.survey_aliases USING btree (survey_id);


--
-- Name: unites_geologiques_geom_geom_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX unites_geologiques_geom_geom_idx ON atlas.unites_geologiques USING gist (geom);


--
-- Name: unites_pedologiques_geom_geom_idx; Type: INDEX; Schema: atlas; Owner: -
--

CREATE INDEX unites_pedologiques_geom_geom_idx ON atlas.unites_pedologiques USING gist (geom);


--
-- Name: admin_limites_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX admin_limites_25231_geom_idx ON atlas_ref.admin_limites_25231 USING gist (geom);


--
-- Name: admin_limites_25231_level_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX admin_limites_25231_level_idx ON atlas_ref.admin_limites_25231 USING btree (admin_level);


--
-- Name: batiments_25231_building_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX batiments_25231_building_idx ON atlas_ref.batiments_25231 USING btree (building);


--
-- Name: batiments_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX batiments_25231_geom_idx ON atlas_ref.batiments_25231 USING gist (geom);


--
-- Name: hydro_cours_eau_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX hydro_cours_eau_25231_geom_idx ON atlas_ref.hydro_cours_eau_25231 USING gist (geom);


--
-- Name: hydro_surfaces_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX hydro_surfaces_25231_geom_idx ON atlas_ref.hydro_surfaces_25231 USING gist (geom);


--
-- Name: localites_points_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX localites_points_25231_geom_idx ON atlas_ref.localites_points_25231 USING gist (geom);


--
-- Name: localites_points_25231_place_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX localites_points_25231_place_idx ON atlas_ref.localites_points_25231 USING btree (place);


--
-- Name: localites_polygons_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX localites_polygons_25231_geom_idx ON atlas_ref.localites_polygons_25231 USING gist (geom);


--
-- Name: routes_25231_geom_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX routes_25231_geom_idx ON atlas_ref.routes_25231 USING gist (geom);


--
-- Name: routes_25231_highway_idx; Type: INDEX; Schema: atlas_ref; Owner: -
--

CREATE INDEX routes_25231_highway_idx ON atlas_ref.routes_25231 USING btree (highway);


--
-- Name: poi_terrain_geom_idx; Type: INDEX; Schema: atlas_terrain; Owner: -
--

CREATE INDEX poi_terrain_geom_idx ON atlas_terrain.poi_terrain USING gist (geom);


--
-- Name: routes_corrections_geom_idx; Type: INDEX; Schema: atlas_terrain; Owner: -
--

CREATE INDEX routes_corrections_geom_idx ON atlas_terrain.routes_corrections USING gist (geom);


--
-- Name: adm0_raw_geom_geom_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX adm0_raw_geom_geom_idx ON public.adm0_raw USING gist (geom);


--
-- Name: idx_adm2_geom; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adm2_geom ON public.adm2 USING gist (geom);


--
-- Name: idx_adm3_adm2_fr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adm3_adm2_fr ON public.adm3 USING btree (adm2_fr);


--
-- Name: idx_adm3_adm3_fr; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adm3_adm3_fr ON public.adm3 USING btree (adm3_fr);


--
-- Name: idx_adm3_adm3_pcode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_adm3_adm3_pcode ON public.adm3 USING btree (adm3_pcode);


--
-- Name: idx_geocode_suggestions_auto_geocode; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocode_suggestions_auto_geocode ON public.geocode_suggestions USING btree (status, top_score DESC, entity_id) WHERE ((status = 'pending'::text) AND (top_score IS NOT NULL) AND (entity_id IS NOT NULL));


--
-- Name: idx_geocode_suggestions_entity_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocode_suggestions_entity_id ON public.geocode_suggestions USING btree (entity_id) WHERE (entity_id IS NOT NULL);


--
-- Name: idx_geocode_suggestions_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocode_suggestions_status ON public.geocode_suggestions USING btree (status);


--
-- Name: idx_geocode_suggestions_top_score; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_geocode_suggestions_top_score ON public.geocode_suggestions USING btree (top_score DESC) WHERE (top_score IS NOT NULL);


--
-- Name: raw_lab_ags_code_depth_sieve_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raw_lab_ags_code_depth_sieve_unique ON public.raw_lab_ags USING btree (code_site, depth_m, sieve_mm);


--
-- Name: raw_lab_agt_code_depth_sieve_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX raw_lab_agt_code_depth_sieve_unique ON public.raw_lab_agt USING btree (code_site, depth_m, sieve_mm);


--
-- Name: v_roles_with_permissions _RETURN; Type: RULE; Schema: atlas; Owner: -
--

CREATE OR REPLACE VIEW atlas.v_roles_with_permissions AS
 SELECT r.id,
    r.name,
    r.description,
    r.is_system,
    r.created_at,
    r.updated_at,
    COALESCE(json_agg(json_build_object('id', p.id, 'resource', p.resource, 'action', p.action, 'description', p.description)) FILTER (WHERE (p.id IS NOT NULL)), '[]'::json) AS permissions
   FROM ((atlas.roles r
     LEFT JOIN atlas.role_permissions rp ON (((r.id)::text = (rp.role_id)::text)))
     LEFT JOIN atlas.permissions p ON (((rp.permission_id)::text = (p.id)::text)))
  GROUP BY r.id;


--
-- Name: v_users_with_roles _RETURN; Type: RULE; Schema: atlas; Owner: -
--

CREATE OR REPLACE VIEW atlas.v_users_with_roles AS
 SELECT u.id,
    u.email,
    u.username,
    u.first_name,
    u.last_name,
    u.avatar_url,
    u.is_active,
    u.is_verified,
    u.last_login_at,
    u.created_at,
    u.updated_at,
    COALESCE(json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE (r.id IS NOT NULL)), '[]'::json) AS roles
   FROM ((atlas.users u
     LEFT JOIN atlas.user_roles ur ON (((u.id = ur.user_id) AND ((ur.expires_at IS NULL) OR (ur.expires_at > now())))))
     LEFT JOIN atlas.roles r ON (((ur.role_id)::text = (r.id)::text)))
  GROUP BY u.id;


--
-- Name: audit_log prevent_audit_delete; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER prevent_audit_delete BEFORE DELETE ON atlas.audit_log FOR EACH ROW EXECUTE FUNCTION atlas.prevent_audit_modification();


--
-- Name: TRIGGER prevent_audit_delete ON audit_log; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TRIGGER prevent_audit_delete ON atlas.audit_log IS 'Empêche toute suppression des enregistrements d''audit';


--
-- Name: audit_log prevent_audit_update; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER prevent_audit_update BEFORE UPDATE ON atlas.audit_log FOR EACH ROW EXECUTE FUNCTION atlas.prevent_audit_modification();


--
-- Name: TRIGGER prevent_audit_update ON audit_log; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TRIGGER prevent_audit_update ON atlas.audit_log IS 'Empêche toute modification des enregistrements d''audit';


--
-- Name: colab_track_points rebuild_track_on_point_insert; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER rebuild_track_on_point_insert AFTER INSERT ON atlas.colab_track_points FOR EACH ROW EXECUTE FUNCTION atlas.rebuild_track_geometry();


--
-- Name: colab_answers set_updated_at_colab_answers; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER set_updated_at_colab_answers BEFORE UPDATE ON atlas.colab_answers FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: colab_comments set_updated_at_colab_comments; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER set_updated_at_colab_comments BEFORE UPDATE ON atlas.colab_comments FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: colab_questions set_updated_at_colab_questions; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER set_updated_at_colab_questions BEFORE UPDATE ON atlas.colab_questions FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: colab_tracks set_updated_at_colab_tracks; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER set_updated_at_colab_tracks BEFORE UPDATE ON atlas.colab_tracks FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: colab_user_stats set_updated_at_colab_user_stats; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER set_updated_at_colab_user_stats BEFORE UPDATE ON atlas.colab_user_stats FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: essais_classif trg_essais_classif_updated; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trg_essais_classif_updated BEFORE UPDATE ON atlas.essais_classif FOR EACH ROW EXECUTE FUNCTION public.update_essais_classif_timestamp();


--
-- Name: sondages trg_set_sondage_grid_code; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trg_set_sondage_grid_code BEFORE INSERT OR UPDATE OF geom ON atlas.sondages FOR EACH ROW EXECUTE FUNCTION public.set_sondage_grid_code();


--
-- Name: sondages trg_sondage_geocode; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trg_sondage_geocode AFTER INSERT OR UPDATE OF geom ON atlas.sondages FOR EACH ROW EXECUTE FUNCTION atlas.trg_geocode_sondage();


--
-- Name: TRIGGER trg_sondage_geocode ON sondages; Type: COMMENT; Schema: atlas; Owner: -
--

COMMENT ON TRIGGER trg_sondage_geocode ON atlas.sondages IS 'G├®ocode automatiquement les sondages lors de l''insertion ou modification de la g├®om├®trie.';


--
-- Name: mailles trg_update_maille_utm31_coords; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trg_update_maille_utm31_coords BEFORE INSERT OR UPDATE OF geom ON atlas.mailles FOR EACH ROW EXECUTE FUNCTION atlas.update_maille_utm31_coords();


--
-- Name: echantillons trg_update_sondage_depth_range; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trg_update_sondage_depth_range AFTER INSERT OR DELETE OR UPDATE ON atlas.echantillons FOR EACH ROW EXECUTE FUNCTION public.update_sondage_depth_range();


--
-- Name: sondages trigger_auto_geocode; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trigger_auto_geocode BEFORE INSERT OR UPDATE ON atlas.sondages FOR EACH ROW EXECUTE FUNCTION public.auto_geocode_sondage();


--
-- Name: sondages trigger_refresh_mailles; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER trigger_refresh_mailles AFTER INSERT OR UPDATE ON atlas.sondages FOR EACH STATEMENT EXECUTE FUNCTION atlas.refresh_mailles_geotech();


--
-- Name: colab_answers update_answers_count; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_answers_count AFTER INSERT OR DELETE ON atlas.colab_answers FOR EACH ROW EXECUTE FUNCTION atlas.update_question_answers_count();


--
-- Name: colab_field_logs update_colab_field_logs_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_colab_field_logs_updated_at BEFORE UPDATE ON atlas.colab_field_logs FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();


--
-- Name: colab_missions update_colab_missions_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_colab_missions_updated_at BEFORE UPDATE ON atlas.colab_missions FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();


--
-- Name: colab_student_prefs update_colab_student_prefs_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_colab_student_prefs_updated_at BEFORE UPDATE ON atlas.colab_student_prefs FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();


--
-- Name: colab_students update_colab_students_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_colab_students_updated_at BEFORE UPDATE ON atlas.colab_students FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();


--
-- Name: colab_supervisors update_colab_supervisors_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_colab_supervisors_updated_at BEFORE UPDATE ON atlas.colab_supervisors FOR EACH ROW EXECUTE FUNCTION atlas.update_colab_updated_at();


--
-- Name: column_ui_metadata update_column_ui_metadata_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_column_ui_metadata_updated_at BEFORE UPDATE ON atlas.column_ui_metadata FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: imports update_imports_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_imports_updated_at BEFORE UPDATE ON atlas.imports FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: roles update_roles_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_roles_updated_at BEFORE UPDATE ON atlas.roles FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: sondages_non_geocodes update_sondages_non_geocodes_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_sondages_non_geocodes_updated_at BEFORE UPDATE ON atlas.sondages_non_geocodes FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: staging_metadata update_staging_metadata_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_staging_metadata_updated_at BEFORE UPDATE ON atlas.staging_metadata FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: colab_question_tags update_tag_usage; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_tag_usage AFTER INSERT OR DELETE ON atlas.colab_question_tags FOR EACH ROW EXECUTE FUNCTION atlas.update_tag_usage_count();


--
-- Name: users update_users_updated_at; Type: TRIGGER; Schema: atlas; Owner: -
--

CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON atlas.users FOR EACH ROW EXECUTE FUNCTION atlas.update_updated_at_column();


--
-- Name: auth_audit_log auth_audit_log_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.auth_audit_log
    ADD CONSTRAINT auth_audit_log_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE SET NULL;


--
-- Name: classifications classifications_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.classifications
    ADD CONSTRAINT classifications_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages(id) ON DELETE CASCADE;


--
-- Name: colab_answers colab_answers_author_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_answers
    ADD CONSTRAINT colab_answers_author_id_fkey FOREIGN KEY (author_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_answers colab_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_answers
    ADD CONSTRAINT colab_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES atlas.colab_questions(id) ON DELETE CASCADE;


--
-- Name: colab_comment_mentions colab_comment_mentions_comment_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comment_mentions
    ADD CONSTRAINT colab_comment_mentions_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES atlas.colab_comments(id) ON DELETE CASCADE;


--
-- Name: colab_comment_mentions colab_comment_mentions_mentioned_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comment_mentions
    ADD CONSTRAINT colab_comment_mentions_mentioned_user_id_fkey FOREIGN KEY (mentioned_user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_comments colab_comments_author_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comments
    ADD CONSTRAINT colab_comments_author_id_fkey FOREIGN KEY (author_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_comments colab_comments_parent_comment_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_comments
    ADD CONSTRAINT colab_comments_parent_comment_id_fkey FOREIGN KEY (parent_comment_id) REFERENCES atlas.colab_comments(id) ON DELETE CASCADE;


--
-- Name: colab_documents colab_documents_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_documents
    ADD CONSTRAINT colab_documents_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_documents colab_documents_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_documents
    ADD CONSTRAINT colab_documents_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages(id) ON DELETE SET NULL;


--
-- Name: colab_documents colab_documents_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_documents
    ADD CONSTRAINT colab_documents_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_export_logs colab_export_logs_job_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_logs
    ADD CONSTRAINT colab_export_logs_job_id_fkey FOREIGN KEY (job_id) REFERENCES atlas.colab_export_jobs(id) ON DELETE CASCADE;


--
-- Name: colab_export_schedules colab_export_schedules_template_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_export_schedules
    ADD CONSTRAINT colab_export_schedules_template_id_fkey FOREIGN KEY (template_id) REFERENCES atlas.colab_export_templates(id) ON DELETE SET NULL;


--
-- Name: colab_field_logs colab_field_logs_author_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_logs
    ADD CONSTRAINT colab_field_logs_author_id_fkey FOREIGN KEY (author_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_field_logs colab_field_logs_echantillon_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_logs
    ADD CONSTRAINT colab_field_logs_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE SET NULL;


--
-- Name: colab_field_logs colab_field_logs_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_logs
    ADD CONSTRAINT colab_field_logs_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_field_logs colab_field_logs_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_logs
    ADD CONSTRAINT colab_field_logs_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages(id) ON DELETE SET NULL;


--
-- Name: colab_field_sessions colab_field_sessions_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_sessions
    ADD CONSTRAINT colab_field_sessions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_field_sessions colab_field_sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_field_sessions
    ADD CONSTRAINT colab_field_sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_maille_notification_logs colab_maille_notification_logs_assignment_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_notification_logs
    ADD CONSTRAINT colab_maille_notification_logs_assignment_id_fkey FOREIGN KEY (assignment_id) REFERENCES atlas.colab_maille_assignments(assignment_id) ON DELETE CASCADE;


--
-- Name: colab_maille_notification_logs colab_maille_notification_logs_email_job_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_notification_logs
    ADD CONSTRAINT colab_maille_notification_logs_email_job_id_fkey FOREIGN KEY (email_job_id) REFERENCES atlas.colab_email_jobs(id) ON DELETE SET NULL;


--
-- Name: colab_maille_notification_logs colab_maille_notification_logs_requested_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_notification_logs
    ADD CONSTRAINT colab_maille_notification_logs_requested_by_fkey FOREIGN KEY (requested_by) REFERENCES atlas.users(id) ON DELETE SET NULL;


--
-- Name: colab_mission_assignments colab_mission_assignments_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_assignments
    ADD CONSTRAINT colab_mission_assignments_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_mission_assignments colab_mission_assignments_student_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_assignments
    ADD CONSTRAINT colab_mission_assignments_student_id_fkey FOREIGN KEY (student_id) REFERENCES atlas.colab_students(id) ON DELETE CASCADE;


--
-- Name: colab_mission_sondages colab_mission_sondages_linked_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_sondages
    ADD CONSTRAINT colab_mission_sondages_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES atlas.users(id) ON DELETE SET NULL;


--
-- Name: colab_mission_sondages colab_mission_sondages_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_sondages
    ADD CONSTRAINT colab_mission_sondages_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_mission_sondages colab_mission_sondages_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_mission_sondages
    ADD CONSTRAINT colab_mission_sondages_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages(id) ON DELETE CASCADE;


--
-- Name: colab_missions colab_missions_created_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_missions
    ADD CONSTRAINT colab_missions_created_by_fkey FOREIGN KEY (created_by) REFERENCES atlas.users(id) ON DELETE SET NULL;


--
-- Name: colab_missions colab_missions_maille_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_missions
    ADD CONSTRAINT colab_missions_maille_id_fkey FOREIGN KEY (maille_id) REFERENCES atlas.mailles(id) ON DELETE SET NULL;


--
-- Name: colab_missions colab_missions_supervisor_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_missions
    ADD CONSTRAINT colab_missions_supervisor_id_fkey FOREIGN KEY (supervisor_id) REFERENCES atlas.colab_supervisors(id) ON DELETE SET NULL;


--
-- Name: colab_notifications colab_notifications_comment_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_notifications
    ADD CONSTRAINT colab_notifications_comment_id_fkey FOREIGN KEY (comment_id) REFERENCES atlas.colab_comments(id) ON DELETE CASCADE;


--
-- Name: colab_notifications colab_notifications_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_notifications
    ADD CONSTRAINT colab_notifications_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_notifications colab_notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_notifications
    ADD CONSTRAINT colab_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_photos colab_photos_field_log_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_photos
    ADD CONSTRAINT colab_photos_field_log_id_fkey FOREIGN KEY (field_log_id) REFERENCES atlas.colab_field_logs(id) ON DELETE SET NULL;


--
-- Name: colab_photos colab_photos_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_photos
    ADD CONSTRAINT colab_photos_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE SET NULL;


--
-- Name: colab_photos colab_photos_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_photos
    ADD CONSTRAINT colab_photos_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES atlas.users(id);


--
-- Name: colab_question_tags colab_question_tags_question_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_question_tags
    ADD CONSTRAINT colab_question_tags_question_id_fkey FOREIGN KEY (question_id) REFERENCES atlas.colab_questions(id) ON DELETE CASCADE;


--
-- Name: colab_question_tags colab_question_tags_tag_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_question_tags
    ADD CONSTRAINT colab_question_tags_tag_id_fkey FOREIGN KEY (tag_id) REFERENCES atlas.colab_tags(id) ON DELETE CASCADE;


--
-- Name: colab_questions colab_questions_author_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_questions
    ADD CONSTRAINT colab_questions_author_id_fkey FOREIGN KEY (author_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_questions colab_questions_closed_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_questions
    ADD CONSTRAINT colab_questions_closed_by_fkey FOREIGN KEY (closed_by) REFERENCES atlas.users(id);


--
-- Name: colab_questions colab_questions_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_questions
    ADD CONSTRAINT colab_questions_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE SET NULL;


--
-- Name: colab_sondage_status_history colab_sondage_status_history_changed_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_sondage_status_history
    ADD CONSTRAINT colab_sondage_status_history_changed_by_fkey FOREIGN KEY (changed_by) REFERENCES atlas.users(id);


--
-- Name: colab_students colab_students_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_students
    ADD CONSTRAINT colab_students_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_supervisors colab_supervisors_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_supervisors
    ADD CONSTRAINT colab_supervisors_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_sync_queue colab_sync_queue_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_sync_queue
    ADD CONSTRAINT colab_sync_queue_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_track_points colab_track_points_track_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_track_points
    ADD CONSTRAINT colab_track_points_track_id_fkey FOREIGN KEY (track_id) REFERENCES atlas.colab_tracks(id) ON DELETE CASCADE;


--
-- Name: colab_tracks colab_tracks_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_tracks
    ADD CONSTRAINT colab_tracks_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE CASCADE;


--
-- Name: colab_tracks colab_tracks_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_tracks
    ADD CONSTRAINT colab_tracks_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_user_badges colab_user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_user_badges
    ADD CONSTRAINT colab_user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES atlas.colab_badges(id) ON DELETE CASCADE;


--
-- Name: colab_user_badges colab_user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_user_badges
    ADD CONSTRAINT colab_user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_user_stats colab_user_stats_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_user_stats
    ADD CONSTRAINT colab_user_stats_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: colab_votes colab_votes_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_votes
    ADD CONSTRAINT colab_votes_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: echantillons echantillons_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.echantillons
    ADD CONSTRAINT echantillons_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages(id) ON DELETE CASCADE;


--
-- Name: essais_classif essais_classif_echantillon_fk; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_classif
    ADD CONSTRAINT essais_classif_echantillon_fk FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE CASCADE;


--
-- Name: essais_classif essais_classif_essai_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_classif
    ADD CONSTRAINT essais_classif_essai_id_fkey FOREIGN KEY (essai_id) REFERENCES atlas.essais_geotechniques(id) ON DELETE CASCADE;


--
-- Name: essais_geotechniques essais_geotechniques_echantillon_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE CASCADE;


--
-- Name: essais_geotechniques essais_geotechniques_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_geotechniques
    ADD CONSTRAINT essais_geotechniques_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages(id) ON DELETE CASCADE;


--
-- Name: essais_physiques essais_physiques_echantillon_fk; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_physiques
    ADD CONSTRAINT essais_physiques_echantillon_fk FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE CASCADE;


--
-- Name: essais_physiques essais_physiques_essai_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_physiques
    ADD CONSTRAINT essais_physiques_essai_id_fkey FOREIGN KEY (essai_id) REFERENCES atlas.essais_geotechniques(id) ON DELETE CASCADE;


--
-- Name: essais_potentiel_gonflement essais_potentiel_gonflement_echantillon_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_potentiel_gonflement
    ADD CONSTRAINT essais_potentiel_gonflement_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE CASCADE;


--
-- Name: essais_proctor essais_proctor_echantillon_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais_proctor
    ADD CONSTRAINT essais_proctor_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE CASCADE;


--
-- Name: essais essais_sondage_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.essais
    ADD CONSTRAINT essais_sondage_id_fkey FOREIGN KEY (sondage_id) REFERENCES atlas.sondages_legacy_20251117(id) ON DELETE CASCADE;


--
-- Name: colab_maille_assignments fk_colab_maille_assignments_assigned_by; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_assignments
    ADD CONSTRAINT fk_colab_maille_assignments_assigned_by FOREIGN KEY (assigned_by) REFERENCES atlas.users(id) ON DELETE SET NULL;


--
-- Name: colab_maille_assignments fk_colab_maille_assignments_maille; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_assignments
    ADD CONSTRAINT fk_colab_maille_assignments_maille FOREIGN KEY (maille_id) REFERENCES atlas.mailles(id) ON DELETE CASCADE;


--
-- Name: colab_maille_assignments fk_colab_maille_assignments_student; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_maille_assignments
    ADD CONSTRAINT fk_colab_maille_assignments_student FOREIGN KEY (student_id) REFERENCES atlas.colab_students(id) ON DELETE CASCADE;


--
-- Name: colab_student_prefs fk_colab_student_prefs_user; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.colab_student_prefs
    ADD CONSTRAINT fk_colab_student_prefs_user FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE SET NULL;


--
-- Name: mailles fk_mailles_maille28km; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.mailles
    ADD CONSTRAINT fk_mailles_maille28km FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);


--
-- Name: sondages fk_sondage_maille28km; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages
    ADD CONSTRAINT fk_sondage_maille28km FOREIGN KEY (id_m28) REFERENCES atlas.maille_28km(id_m28);


--
-- Name: sondages fk_sondages_adm3; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages
    ADD CONSTRAINT fk_sondages_adm3 FOREIGN KEY (adm3_id) REFERENCES atlas.adm3(gid) ON DELETE SET NULL;


--
-- Name: granulo_points granulo_points_echantillon_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.granulo_points
    ADD CONSTRAINT granulo_points_echantillon_id_fkey FOREIGN KEY (echantillon_id) REFERENCES atlas.echantillons(id) ON DELETE CASCADE;


--
-- Name: import_errors import_errors_import_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.import_errors
    ADD CONSTRAINT import_errors_import_id_fkey FOREIGN KEY (import_id) REFERENCES atlas.imports(id) ON DELETE CASCADE;


--
-- Name: password_reset_tokens password_reset_tokens_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.password_reset_tokens
    ADD CONSTRAINT password_reset_tokens_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_permission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.role_permissions
    ADD CONSTRAINT role_permissions_permission_id_fkey FOREIGN KEY (permission_id) REFERENCES atlas.permissions(id) ON DELETE CASCADE;


--
-- Name: role_permissions role_permissions_role_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.role_permissions
    ADD CONSTRAINT role_permissions_role_id_fkey FOREIGN KEY (role_id) REFERENCES atlas.roles(id) ON DELETE CASCADE;


--
-- Name: sessions sessions_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sessions
    ADD CONSTRAINT sessions_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: sondages sondages_mission_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.sondages
    ADD CONSTRAINT sondages_mission_id_fkey FOREIGN KEY (mission_id) REFERENCES atlas.colab_missions(id) ON DELETE SET NULL;


--
-- Name: user_roles user_roles_assigned_by_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.user_roles
    ADD CONSTRAINT user_roles_assigned_by_fkey FOREIGN KEY (assigned_by) REFERENCES atlas.users(id);


--
-- Name: user_roles user_roles_role_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.user_roles
    ADD CONSTRAINT user_roles_role_id_fkey FOREIGN KEY (role_id) REFERENCES atlas.roles(id) ON DELETE CASCADE;


--
-- Name: user_roles user_roles_user_id_fkey; Type: FK CONSTRAINT; Schema: atlas; Owner: -
--

ALTER TABLE ONLY atlas.user_roles
    ADD CONSTRAINT user_roles_user_id_fkey FOREIGN KEY (user_id) REFERENCES atlas.users(id) ON DELETE CASCADE;


--
-- Name: admin_limites_25231 admin_limites_25231_parent_id_fkey; Type: FK CONSTRAINT; Schema: atlas_ref; Owner: -
--

ALTER TABLE ONLY atlas_ref.admin_limites_25231
    ADD CONSTRAINT admin_limites_25231_parent_id_fkey FOREIGN KEY (parent_id) REFERENCES atlas_ref.admin_limites_25231(id);


--
-- Name: routes_corrections routes_corrections_route_ref_id_fkey; Type: FK CONSTRAINT; Schema: atlas_terrain; Owner: -
--

ALTER TABLE ONLY atlas_terrain.routes_corrections
    ADD CONSTRAINT routes_corrections_route_ref_id_fkey FOREIGN KEY (route_ref_id) REFERENCES atlas_ref.routes_25231(id);


--
-- PostgreSQL database dump complete
--

\unrestrict sNu6ii7Q1JN2eJotES1BPvnUTFgmIPHMpfpxjGQWYL6Gs2F6t36QKnnIkMseSAv

