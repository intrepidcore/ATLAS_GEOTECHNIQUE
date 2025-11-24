-- Migration 036: Auto-géocodage basé sur les suggestions ADM3
-- Accepte automatiquement les suggestions avec un score élevé

-- Fonction pour auto-accepter les suggestions avec score >= seuil
CREATE OR REPLACE FUNCTION public.auto_accept_high_score_suggestions(
    score_threshold FLOAT DEFAULT 0.90
) RETURNS TABLE (
    suggestion_id TEXT,
    sondage_id TEXT,
    adm3_pcode TEXT,
    score FLOAT
) AS $$
DECLARE
    suggestion_rec RECORD;
    adm3_gid_val INTEGER;
    affected_count INTEGER := 0;
BEGIN
    -- Boucle sur toutes les suggestions pending avec score >= seuil
    FOR suggestion_rec IN 
        SELECT 
            gs.id,
            gs.entity_id,
            gs.top_code,
            gs.top_score
        FROM public.geocode_suggestions gs
        INNER JOIN public.sondages s ON s.id = gs.entity_id::uuid
        WHERE gs.status = 'pending'
          AND gs.top_score >= score_threshold
          AND s.geom IS NULL  -- Seulement les non géocodés
          AND gs.top_code IS NOT NULL
        ORDER BY gs.top_score DESC
    LOOP
        -- Récupérer le gid de l'ADM3
        BEGIN
            SELECT gid INTO adm3_gid_val
            FROM adm3
            WHERE adm3_pcode = suggestion_rec.top_code;
            
            IF adm3_gid_val IS NULL THEN
                RAISE NOTICE 'ADM3 % not found for suggestion %', suggestion_rec.top_code, suggestion_rec.id;
                CONTINUE;
            END IF;
            
            -- Géocoder le sondage
            UPDATE public.sondages s
            SET 
                geom = public.random_point_in_polygon(a.geom),
                adm3_id = adm3_gid_val,
                adm3_name = a.adm3_fr,
                location_mode = 'adm_random_cell',
                updated_at = now(),
                meta = COALESCE(meta, '{}'::jsonb) || jsonb_build_object(
                    'geocoded_at', now()::text,
                    'geocoded_mode', 'auto_suggestion',
                    'geocoded_placement', 'adm_random_cell',
                    'geocoded_adm3_pcode', suggestion_rec.top_code,
                    'suggestion_id', suggestion_rec.id,
                    'auto_score', suggestion_rec.top_score
                )
            FROM adm3 a
            WHERE a.gid = adm3_gid_val 
              AND s.id = suggestion_rec.entity_id::uuid;
            
            -- Marquer la suggestion comme acceptée
            UPDATE public.geocode_suggestions
            SET status = 'accepted', 
                decided_at = now()::text
            WHERE id = suggestion_rec.id;
            
            -- Rejeter les autres suggestions pending pour ce sondage
            UPDATE public.geocode_suggestions
            SET status = 'rejected',
                decided_at = now()::text
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
    
    RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.auto_accept_high_score_suggestions IS 
'Auto-accepte les suggestions ADM3 avec un score >= seuil (défaut 90%). 
Géocode les sondages avec placement aléatoire dans la cellule ADM3.
Retourne la liste des suggestions acceptées.';

-- Fonction wrapper pour exécuter l'auto-géocodage et rafraîchir la vue matérialisée
CREATE OR REPLACE FUNCTION public.run_auto_geocode_batch(
    score_threshold FLOAT DEFAULT 0.90
) RETURNS JSON AS $$
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
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION public.run_auto_geocode_batch IS 
'Exécute un batch d''auto-géocodage et rafraîchit la vue matérialisée.
Retourne un JSON avec le nombre de sondages géocodés et la liste des suggestions acceptées.';
