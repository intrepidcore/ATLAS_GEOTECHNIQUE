-- Migration 015: Vue v_samples_complete_v3 avec physiques + classifications
-- Date: 2025-11-03

CREATE OR REPLACE VIEW v_samples_complete_v3 AS
SELECT 
    s.id AS sondage_id,
    s.code AS sondage_code,
    s.source,
    s.date AS sondage_date,
    s.grid_code,
    s.location_mode,
    s.location_accuracy,
    ST_X(ST_Transform(s.geom, 4326)) AS lon,
    ST_Y(ST_Transform(s.geom, 4326)) AS lat,
    
    eg.id AS essai_id,
    eg.depth_m,
    eg.wl,
    eg.wp,
    eg.ip,
    eg.vbs,
    eg.gamma_d_max,
    eg.w_opt,
    eg.proctor_type,
    eg.eg,
    eg.passant_80um,
    eg.passant_2mm,
    eg.passant_20mm,
    eg.test_date,
    eg.laboratory,
    eg.norm,
    eg.meta AS essai_meta,
    
    -- Physiques (densités, teneur eau)
    ep.densite_apparente_gcm3,
    ep.densite_absolue_gcm3,
    ep.teneur_eau_pct,
    ep.meta AS physiques_meta,
    
    -- Classifications (agrégées en JSONB)
    (
        SELECT jsonb_object_agg(ec.systeme, jsonb_build_object(
            'classe', ec.classe,
            'reason', ec.reason,
            'version', ec.version,
            'computed', ec.computed
        ))
        FROM essais_classif ec
        WHERE ec.essai_id = eg.id
          AND ec.deleted_at IS NULL
    ) AS classifications,
    
    -- Granulométrie (points agrégés)
    (
        SELECT jsonb_agg(jsonb_build_object(
            'tamis_mm', gp.sieve_mm,
            'passant_pct', gp.percent_passing,
            'methode', gp.methode
        ) ORDER BY gp.sieve_mm DESC)
        FROM granulometrie_points gp
        WHERE gp.essai_id = eg.id
          AND gp.deleted_at IS NULL
    ) AS granulo_points,
    
    eg.created_at,
    eg.updated_at

FROM sondages s
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
LEFT JOIN essais_physiques ep ON ep.essai_id = eg.id AND ep.deleted_at IS NULL
WHERE s.deleted_at IS NULL
  AND (eg.id IS NULL OR eg.deleted_at IS NULL);

COMMENT ON VIEW v_samples_complete_v3 IS 'Vue complète des échantillons avec physiques, classifications et granulométrie';

RAISE NOTICE 'Migration 015 terminée: vue v_samples_complete_v3 créée';
