-- 0A: Tables impliquées dans SCORPAN/RK
SELECT
    t.table_schema,
    t.table_name,
    c.column_name,
    c.data_type,
    c.udt_name,
    c.is_nullable,
    c.column_default
FROM information_schema.tables t
JOIN information_schema.columns c
    ON c.table_schema = t.table_schema
    AND c.table_name = t.table_name
WHERE t.table_schema = 'atlas'
    AND t.table_name IN (
        'mailles',
        'ai_context_features_maille',
        'maille_climate_features',
        'ai_interpolation_values',
        'ai_interpolation_runs',
        'ai_variograms',
        'ai_parameter_catalog',
        'v_scorpan_features',
        'worldclim_prec',
        'worldclim_bio',
        'essais_geotechniques',
        'essais_vbs',
        'essais_atterberg',
        'essais_physiques',
        'essais_potentiel_gonflement',
        'sondages',
        'echantillons'
    )
ORDER BY t.table_name, c.ordinal_position;