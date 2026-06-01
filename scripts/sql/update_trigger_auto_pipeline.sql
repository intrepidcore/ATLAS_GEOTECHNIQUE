\set ON_ERROR_STOP 1
-- Migration : mise à jour du trigger auto-amélioration sur import sondage
-- Ajoute les job_types pour TOUS les paramètres et les nouveaux modèles
-- Règles : DB-11, BM-SYNC-05
-- Auteur : Intrepid Core Engineering

BEGIN;

-- Remplacer la fonction trigger pour inclure tous les paramètres + nouveaux modèles
CREATE OR REPLACE FUNCTION atlas.enqueue_ai_jobs_after_sondage_non_blocking()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
    v_n_vbs  integer := 0;
    v_n_ip   integer := 0;
    v_n_wl   integer := 0;
    v_n_wp   integer := 0;
    v_n_eg   integer := 0;
BEGIN
    BEGIN
        -- Compter les sondages disponibles par paramètre
        SELECT COUNT(DISTINCT s.id) INTO v_n_vbs
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_vbs ev ON ev.echantillon_id = e.id
        WHERE s.deleted_at IS NULL AND ev.vbs IS NOT NULL;

        SELECT COUNT(DISTINCT s.id) INTO v_n_ip
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
        WHERE s.deleted_at IS NULL
          AND COALESCE(ea.ip_generated, ea.wl - ea.wp) IS NOT NULL;

        SELECT COUNT(DISTINCT s.id) INTO v_n_wl
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
        WHERE s.deleted_at IS NULL AND ea.wl IS NOT NULL;

        SELECT COUNT(DISTINCT s.id) INTO v_n_wp
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_atterberg ea ON ea.echantillon_id = e.id
        WHERE s.deleted_at IS NULL AND ea.wp IS NOT NULL;

        SELECT COUNT(DISTINCT s.id) INTO v_n_eg
        FROM atlas.sondages s
        JOIN atlas.echantillons e ON e.sondage_id = s.id
        JOIN atlas.essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
        WHERE s.deleted_at IS NULL AND epg.cg IS NOT NULL;

        -- Seuil minimal : 10 sondages pour lancer les calculs
        IF v_n_vbs >= 10 THEN
            -- L1 : KED hiérarchique
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('vbs', 'run_ked',
                    jsonb_build_object('trigger','new_sondage','n',v_n_vbs,'kinds','vbs','hierarchical',true))
            ON CONFLICT DO NOTHING;
            -- L2 : RK SCORPAN
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('vbs', 'run_rk',
                    jsonb_build_object('trigger','new_sondage','n',v_n_vbs,'parameter','vbs'))
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_n_ip >= 10 THEN
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('ip', 'run_ked',
                    jsonb_build_object('trigger','new_sondage','n',v_n_ip,'kinds','ip','hierarchical',true))
            ON CONFLICT DO NOTHING;
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('ip', 'run_rk',
                    jsonb_build_object('trigger','new_sondage','n',v_n_ip,'parameter','ip'))
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_n_wl >= 10 THEN
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('wl', 'run_ked',
                    jsonb_build_object('trigger','new_sondage','n',v_n_wl,'kinds','wl','hierarchical',true))
            ON CONFLICT DO NOTHING;
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('wl', 'run_rk',
                    jsonb_build_object('trigger','new_sondage','n',v_n_wl,'parameter','wl'))
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_n_wp >= 10 THEN
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('wp', 'run_ked',
                    jsonb_build_object('trigger','new_sondage','n',v_n_wp,'kinds','wp','hierarchical',true))
            ON CONFLICT DO NOTHING;
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('wp', 'run_rk',
                    jsonb_build_object('trigger','new_sondage','n',v_n_wp,'parameter','wp'))
            ON CONFLICT DO NOTHING;
        END IF;

        IF v_n_eg >= 10 THEN
            -- L1 : KED hierarchique EG (supporte kinds=eg depuis 2026-06-01)
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('eg', 'run_ked',
                    jsonb_build_object('trigger','new_sondage','n',v_n_eg,'kinds','eg','hierarchical',true))
            ON CONFLICT DO NOTHING;
            -- L2 : RK SCORPAN
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('eg', 'run_rk',
                    jsonb_build_object('trigger','new_sondage','n',v_n_eg,'parameter','eg'))
            ON CONFLICT DO NOTHING;
        END IF;

        -- Fusion KED-RK (déclenché si VBS ET IP disponibles)
        IF v_n_vbs >= 10 AND v_n_ip >= 10 THEN
            INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
            VALUES ('all', 'run_fusion',
                    jsonb_build_object('trigger','new_sondage','params','vbs,ip,wl,wp,eg'))
            ON CONFLICT DO NOTHING;
        END IF;

        -- VfS spectral : re-extraire si nouveaux sondages géolocalisés
        INSERT INTO atlas.ai_job_queue(parameter_id, job_type, payload)
        VALUES ('vbs', 'run_vfs',
                jsonb_build_object('trigger','new_sondage','mode','all'))
        ON CONFLICT DO NOTHING;

    EXCEPTION WHEN OTHERS THEN
        -- Non-blocking : ne jamais casser la transaction d'import
        NULL;
    END;
    RETURN NEW;
END;
$$;

-- Validation
DO $$
BEGIN
    RAISE NOTICE 'Trigger auto-pipeline mis à jour : vbs/ip/wl/wp/eg + KED+RK+fusion+VfS';
END $$;

COMMIT;
