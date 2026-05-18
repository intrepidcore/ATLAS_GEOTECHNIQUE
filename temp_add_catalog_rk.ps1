$env:PGPASSWORD = 'postgres'
& "C:\Program Files\PostgreSQL\17\bin\psql.exe" -U postgres -h 127.0.0.1 -p 5433 -d atlas_clean -c "
INSERT INTO atlas.ai_parameter_catalog (parameter_id, category, source, unit, interpolation_enabled, prediction_enabled, is_active, updated_at, depth_stratified, is_derived)
VALUES
  ('vbs_rk_h2', 'geotech', 'interpolation', 'g/100g', true, true, true, now(), true, true),
  ('vbs_rk_h3', 'geotech', 'interpolation', 'g/100g', true, true, true, now(), true, true),
  ('ip_rk_h2', 'geotech', 'interpolation', 'kN/m2', true, true, true, now(), true, true),
  ('ip_rk_h3', 'geotech', 'interpolation', 'kN/m2', true, true, true, now(), true, true),
  ('wl_rk_h2', 'geotech', 'interpolation', '%', true, true, true, now(), true, true),
  ('wl_rk_h3', 'geotech', 'interpolation', '%', true, true, true, now(), true, true),
  ('wp_rk_h2', 'geotech', 'interpolation', '%', true, true, true, now(), true, true),
  ('wp_rk_h3', 'geotech', 'interpolation', '%', true, true, true, now(), true, true),
  ('eg_rk_h1', 'geotech', 'interpolation', '%', true, true, true, now(), true, true),
  ('eg_rk_h2', 'geotech', 'interpolation', '%', true, true, true, now(), true, true),
  ('eg_rk_h3', 'geotech', 'interpolation', '%', true, true, true, now(), true, true)
ON CONFLICT (parameter_id) DO NOTHING;
SELECT parameter_id FROM atlas.ai_parameter_catalog WHERE parameter_id LIKE '%_rk_%' ORDER BY parameter_id;"