$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'vbs_rk_h1', 'VBS Regression Kriging SCORPAN H1', 'g/100g', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'vbs_rk_h2', 'VBS Regression Kriging SCORPAN H2', 'g/100g', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'vbs_rk_h3', 'VBS Regression Kriging SCORPAN H3', 'g/100g', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'ip_rk_h1', 'IP Regression Kriging SCORPAN H1', 'kN/m2', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'ip_rk_h2', 'IP Regression Kriging SCORPAN H2', 'kN/m2', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'ip_rk_h3', 'IP Regression Kriging SCORPAN H3', 'kN/m2', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'wl_rk_h1', 'WL Regression Kriging SCORPAN H1', '%', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
INSERT INTO atlas.ai_parameter_catalog (id, parameter_id, parameter_name, unit, category, horizons, method_type)
VALUES (gen_random_uuid(), 'wp_rk_h1', 'WP Regression Kriging SCORPAN H1', '%', 'geotech', ARRAY['h1','h2','h3'], 'regression_kriging_scorpan')
ON CONFLICT (parameter_id) DO NOTHING;
SELECT COUNT(*) FROM atlas.ai_parameter_catalog WHERE parameter_id LIKE '%_rk_%';"