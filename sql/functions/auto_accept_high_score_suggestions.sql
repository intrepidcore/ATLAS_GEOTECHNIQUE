-- ============================================================================
-- FONCTION: auto_accept_high_score_suggestions
-- ============================================================================
-- Accepte automatiquement les suggestions de géocodage avec un score élevé
-- et assigne une géométrie aléatoire dans l'ADM3 correspondant.
--
-- Le trigger geocode_sondage se chargera ensuite de remplir maille_code
-- et les autres champs ADM.
--
-- Tables utilisées (uniformisées dans atlas.*):
--   - atlas.sondages
--   - atlas.adm3
--   - public.geocode_suggestions (table de travail)
-- ============================================================================

CREATE OR REPLACE FUNCTION public.auto_accept_high_score_suggestions(score_threshold double precision)
RETURNS TABLE(suggestion_id text, sondage_id text, adm3_pcode text, score numeric)
LANGUAGE plpgsql
AS $function$
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
$function$;

COMMENT ON FUNCTION public.auto_accept_high_score_suggestions(double precision) IS 
'Accepte automatiquement les suggestions de géocodage avec score >= threshold. Le trigger geocode_sondage remplit ensuite maille_code et ADM.';
