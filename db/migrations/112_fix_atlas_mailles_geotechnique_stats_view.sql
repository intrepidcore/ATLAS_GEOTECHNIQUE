-- Fix: atlas.mailles_geotechnique_stats_wgs84 must expose n_essais_geo expected by api-geo thematic endpoints.
-- Root cause: view in schema atlas was restored without alias, while public.mailles_geotechnique_stats_wgs84 had it.

CREATE OR REPLACE VIEW atlas.mailles_geotechnique_stats_wgs84 AS
SELECT
    mg.*,
    ctx.geol_unit,
    ctx.pedo_unit,
    ctx.swelling_class,
    mg.n_essais_total AS n_essais_geo
FROM atlas.v_mailles_with_location_counts mg
LEFT JOIN atlas.v_mailles_context ctx ON ctx.code = mg.code;
