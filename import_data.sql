BEGIN;

-- Sondage TEST-7506-368
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7506-368', '2024-11-30', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(0.5988, 7.7326), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 84.8, 88.4, 66.3, 30.1, 7.12, 16.41, 27.0, 5.89, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 66.5, 86.4, 46.6, 35.2, 6.1, 15.65, 26.0, 7.24, NOW() FROM new_sondage
UNION ALL SELECT id, 4.7, 9.9, 65.3, 18.8, 13.9, 0.45, 20.63, 9.9, 0.17, NOW() FROM new_sondage
UNION ALL SELECT id, 9.1, 42.9, 91.6, 35.3, 28.5, 2.32, 18.46, 18.8, 1.48, NOW() FROM new_sondage
;

-- Sondage TEST-7356-472
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7356-472', '2025-03-15', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(0.704, 7.5019), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 78.5, 91.3, 54.5, 43.4, 2.75, 17.52, 20.3, 5.42, NOW() FROM new_sondage
UNION ALL SELECT id, 3.7, 48.4, 70.4, 32.2, 27.9, 1.77, 18.48, 13.0, 1.28, NOW() FROM new_sondage
UNION ALL SELECT id, 6.7, 2.4, 40.1, NULL, NULL, 0.32, 21.75, 7.4, 0.2, NOW() FROM new_sondage
UNION ALL SELECT id, 6.9, 19.8, 84.6, 24.9, 11.7, 0.87, 19.62, 9.2, 0.38, NOW() FROM new_sondage
UNION ALL SELECT id, 10.5, 41.5, 70.2, 44.6, 18.2, 2.33, 18.48, 16.0, 1.7, NOW() FROM new_sondage
UNION ALL SELECT id, 15.4, 5.1, 34.3, NULL, NULL, 0.13, 19.81, 7.9, 0.22, NOW() FROM new_sondage
UNION ALL SELECT id, 14.5, 60.3, 95.9, 57.2, 32.7, 5.73, 16.33, 21.5, 3.78, NOW() FROM new_sondage
UNION ALL SELECT id, 21.4, 25.6, 58.1, 28.5, 18.2, 0.11, 20.05, 10.1, 0.43, NOW() FROM new_sondage
;

-- Sondage TEST-3528-176
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-3528-176', '2024-02-20', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(0.9612, 6.7305), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 54.1, 84.7, 29.2, 15.2, 2.42, 18.53, 17.9, 1.6, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 94.4, 91.0, 61.8, 44.4, 7.59, 16.02, 18.2, 8.84, NOW() FROM new_sondage
UNION ALL SELECT id, 4.8, 66.9, 94.7, 44.8, 32.1, 7.57, 15.95, 20.6, 7.08, NOW() FROM new_sondage
UNION ALL SELECT id, 9.5, 15.5, 30.0, NULL, NULL, 0.14, 21.99, 7.1, 0.03, NOW() FROM new_sondage
;

-- Sondage TEST-8852-634
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8852-634', '2024-05-01', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.4146, 7.4246), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 91.0, 93.6, 88.1, 43.5, 3.58, 15.61, 26.9, 5.01, NOW() FROM new_sondage
UNION ALL SELECT id, 2.8, 22.4, 65.4, 17.8, 19.5, 0.98, 19.64, 12.2, 0.76, NOW() FROM new_sondage
UNION ALL SELECT id, 5.9, 5.9, 51.0, NULL, NULL, 0.25, 20.49, 6.9, 0.28, NOW() FROM new_sondage
UNION ALL SELECT id, 6.3, 71.3, 95.0, 86.9, 34.2, 7.82, 15.72, 22.5, 9.62, NOW() FROM new_sondage
UNION ALL SELECT id, 12.2, 10.7, 59.2, 27.8, 16.1, 0.47, 18.84, 10.8, 0.21, NOW() FROM new_sondage
UNION ALL SELECT id, 14.1, 54.3, 85.4, 34.0, 19.5, 2.83, 18.53, 14.7, 1.64, NOW() FROM new_sondage
UNION ALL SELECT id, 10.0, 15.7, 65.0, 18.9, 16.7, 0.7, 18.81, 9.3, 0.74, NOW() FROM new_sondage
;

-- Sondage TEST-4558-633
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4558-633', '2025-01-07', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.0127, 8.7813), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 1.2, 22.2, NULL, NULL, 0.39, 21.56, 9.5, 0.05, NOW() FROM new_sondage
UNION ALL SELECT id, 2.9, 38.7, 90.7, 38.5, 23.0, 1.69, 17.92, 19.0, 1.23, NOW() FROM new_sondage
UNION ALL SELECT id, 5.4, 11.4, 73.8, 26.2, 17.2, 0.38, 19.13, 11.5, 0.44, NOW() FROM new_sondage
UNION ALL SELECT id, 9.6, 48.6, 70.4, 25.3, 23.6, 1.33, 18.8, 14.3, 2.11, NOW() FROM new_sondage
UNION ALL SELECT id, 12.4, 55.6, 80.3, 35.9, 22.7, 1.63, 18.19, 13.3, 1.04, NOW() FROM new_sondage
UNION ALL SELECT id, 13.7, 64.1, 70.5, 38.2, 29.8, 2.66, 18.45, 17.8, 2.12, NOW() FROM new_sondage
UNION ALL SELECT id, 18.0, 22.7, 64.6, 17.0, 11.0, 0.69, 20.4, 10.6, 0.57, NOW() FROM new_sondage
UNION ALL SELECT id, 19.7, 36.2, 88.8, 37.1, 17.1, 1.08, 18.39, 13.7, 1.86, NOW() FROM new_sondage
;

-- Sondage TEST-2137-928
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-2137-928', '2024-11-08', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.1392, 7.0315), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 9.3, 59.6, NULL, NULL, 0.47, 19.15, 9.4, 0.08, NOW() FROM new_sondage
UNION ALL SELECT id, 3.1, 7.3, 52.4, 27.0, 11.1, 0.9, 18.7, 11.3, 0.55, NOW() FROM new_sondage
UNION ALL SELECT id, 5.4, 84.1, 86.2, 45.1, 36.2, 2.52, 17.39, 26.3, 7.86, NOW() FROM new_sondage
;

-- Sondage TEST-7695-317
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7695-317', '2025-06-11', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.3344, 10.8551), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 62.3, 93.9, 30.1, 15.3, 1.2, 17.8, 17.6, 1.24, NOW() FROM new_sondage
UNION ALL SELECT id, 3.2, 84.0, 92.4, 86.6, 45.2, 5.68, 15.75, 27.2, 10.35, NOW() FROM new_sondage
UNION ALL SELECT id, 5.4, 5.6, 75.4, 16.5, 18.1, 0.99, 18.61, 8.6, 0.52, NOW() FROM new_sondage
UNION ALL SELECT id, 8.3, 76.4, 92.6, 46.6, 48.5, 3.05, 15.63, 18.3, 2.31, NOW() FROM new_sondage
UNION ALL SELECT id, 8.9, 15.1, 62.2, 20.8, 18.9, 0.0, 19.87, 13.1, 0.11, NOW() FROM new_sondage
UNION ALL SELECT id, 8.5, 75.5, 89.5, 68.5, 23.3, 3.21, 15.68, 27.5, 4.8, NOW() FROM new_sondage
;

-- Sondage TEST-8857-316
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8857-316', '2023-10-27', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.3127, 7.1971), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 41.9, 85.9, 41.9, 19.3, 1.31, 18.36, 18.6, 2.1, NOW() FROM new_sondage
UNION ALL SELECT id, 3.3, 59.1, 93.5, 38.2, 20.7, 1.35, 18.19, 15.3, 2.68, NOW() FROM new_sondage
UNION ALL SELECT id, 6.6, 52.9, 72.8, 34.8, 28.3, 1.48, 17.11, 15.3, 1.9, NOW() FROM new_sondage
UNION ALL SELECT id, 8.1, 27.3, 58.4, 17.2, 11.8, 0.95, 20.03, 8.6, 0.75, NOW() FROM new_sondage
UNION ALL SELECT id, 8.3, 17.5, 22.2, NULL, NULL, 0.38, 19.82, 9.7, 0.22, NOW() FROM new_sondage
UNION ALL SELECT id, 13.4, 48.6, 73.2, 38.9, 20.7, 1.01, 18.35, 14.9, 2.28, NOW() FROM new_sondage
;

-- Sondage TEST-8317-625
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8317-625', '2023-11-01', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.3644, 6.4058), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 52.8, 84.4, 38.9, 29.2, 1.75, 18.31, 15.8, 1.46, NOW() FROM new_sondage
UNION ALL SELECT id, 3.0, 6.6, 82.9, 18.4, 10.7, 0.24, 18.95, 11.6, 0.45, NOW() FROM new_sondage
UNION ALL SELECT id, 6.5, 45.2, 89.9, 44.4, 24.9, 2.8, 18.67, 15.9, 2.25, NOW() FROM new_sondage
UNION ALL SELECT id, 6.3, 60.9, 92.8, 39.8, 25.9, 1.45, 18.78, 13.0, 1.37, NOW() FROM new_sondage
;

-- Sondage TEST-5332-804
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-5332-804', '2025-08-22', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(0.0093, 10.7627), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 61.3, 72.7, 25.7, 29.7, 1.44, 17.37, 19.5, 1.61, NOW() FROM new_sondage
UNION ALL SELECT id, 2.5, 37.2, 87.1, 34.5, 22.3, 1.72, 17.1, 14.4, 2.71, NOW() FROM new_sondage
UNION ALL SELECT id, 4.2, 83.3, 98.0, 80.0, 31.3, 5.5, 16.87, 20.9, 10.34, NOW() FROM new_sondage
UNION ALL SELECT id, 6.5, 91.5, 93.2, 53.0, 47.9, 7.52, 16.24, 19.2, 8.95, NOW() FROM new_sondage
UNION ALL SELECT id, 11.8, 68.0, 90.6, 89.9, 22.3, 4.79, 15.54, 25.7, 5.12, NOW() FROM new_sondage
UNION ALL SELECT id, 10.3, 29.7, 83.7, 16.5, 10.6, 0.79, 19.85, 13.0, 0.15, NOW() FROM new_sondage
UNION ALL SELECT id, 16.2, 28.2, 69.7, 25.6, 18.4, 0.59, 18.82, 9.8, 0.08, NOW() FROM new_sondage
UNION ALL SELECT id, 14.3, 38.7, 75.9, 37.1, 25.6, 1.96, 18.27, 19.6, 1.58, NOW() FROM new_sondage
;

-- Sondage TEST-4365-507
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4365-507', '2024-08-05', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(0.5322, 10.8135), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 8.0, 74.5, 16.3, 12.1, 0.78, 20.77, 10.3, 0.49, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 1.3, 51.8, NULL, NULL, 0.07, 21.53, 8.5, 0.08, NOW() FROM new_sondage
UNION ALL SELECT id, 4.4, 54.1, 90.3, 35.5, 27.6, 1.62, 18.65, 17.0, 1.0, NOW() FROM new_sondage
;

-- Sondage TEST-1192-416
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-1192-416', '2024-12-12', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(1.1249, 8.2218), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 19.2, 78.6, 15.7, 14.9, 0.83, 19.88, 10.6, 0.15, NOW() FROM new_sondage
UNION ALL SELECT id, 2.6, 6.0, 80.5, 28.6, 15.0, 0.93, 18.55, 10.6, 0.23, NOW() FROM new_sondage
UNION ALL SELECT id, 4.5, 89.3, 91.5, 52.4, 40.7, 4.6, 17.98, 26.7, 2.18, NOW() FROM new_sondage
UNION ALL SELECT id, 8.1, 28.8, 68.7, 15.5, 11.5, 0.17, 20.92, 11.0, 0.74, NOW() FROM new_sondage
UNION ALL SELECT id, 9.4, 19.4, 70.2, 20.7, 12.0, 0.36, 18.02, 13.1, 0.74, NOW() FROM new_sondage
UNION ALL SELECT id, 12.6, 12.9, 38.8, NULL, NULL, 0.45, 21.34, 6.6, 0.13, NOW() FROM new_sondage
UNION ALL SELECT id, 14.8, 14.5, 71.1, 29.7, 19.4, 0.17, 19.81, 10.9, 0.23, NOW() FROM new_sondage
UNION ALL SELECT id, 20.8, 19.9, 54.6, NULL, NULL, 0.07, 19.17, 9.3, 0.14, NOW() FROM new_sondage
;

-- Sondage TEST-3065-661
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-3065-661', '2024-10-06', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.44, 7.2807), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 22.0, 53.8, 21.0, 14.8, 0.34, 20.52, 8.4, 0.31, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 8.1, 35.9, NULL, NULL, 0.11, 19.19, 9.2, 0.15, NOW() FROM new_sondage
UNION ALL SELECT id, 5.5, 11.9, 80.6, 17.7, 13.0, 0.58, 18.45, 13.5, 0.7, NOW() FROM new_sondage
UNION ALL SELECT id, 9.7, 2.0, 51.2, NULL, NULL, 0.19, 19.55, 8.2, 0.1, NOW() FROM new_sondage
;

-- Sondage TEST-6021-305
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-6021-305', '2025-08-25', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(0.1322, 10.5232), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 7.8, 33.6, NULL, NULL, 0.42, 21.91, 6.1, 0.28, NOW() FROM new_sondage
UNION ALL SELECT id, 3.3, 8.9, 84.3, 15.2, 12.6, 0.73, 18.4, 11.8, 0.18, NOW() FROM new_sondage
UNION ALL SELECT id, 5.0, 2.5, 37.1, NULL, NULL, 0.26, 19.05, 9.7, 0.05, NOW() FROM new_sondage
UNION ALL SELECT id, 9.9, 85.8, 97.3, 85.3, 30.5, 6.31, 15.6, 25.3, 8.75, NOW() FROM new_sondage
UNION ALL SELECT id, 8.9, 73.5, 99.9, 72.6, 38.1, 3.65, 16.77, 18.4, 9.12, NOW() FROM new_sondage
;

-- Sondage TEST-5813-489
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-5813-489', '2025-03-29', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.3265, 9.1678), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 1.6, 45.7, NULL, NULL, 0.01, 21.11, 9.5, 0.24, NOW() FROM new_sondage
UNION ALL SELECT id, 2.6, 17.2, 72.8, 29.4, 10.5, 0.04, 19.9, 9.2, 0.38, NOW() FROM new_sondage
UNION ALL SELECT id, 5.1, 54.4, 91.9, 43.0, 25.2, 1.79, 17.53, 17.8, 0.76, NOW() FROM new_sondage
UNION ALL SELECT id, 9.7, 57.3, 76.4, 33.1, 16.5, 1.3, 18.37, 19.9, 2.18, NOW() FROM new_sondage
;

-- Sondage TEST-3291-806
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-3291-806', '2024-04-05', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.4435, 8.4061), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 49.7, 91.9, 28.0, 20.3, 1.92, 17.14, 18.4, 1.48, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 28.7, 80.9, 17.3, 19.8, 0.66, 18.79, 11.5, 0.35, NOW() FROM new_sondage
UNION ALL SELECT id, 6.6, 63.2, 73.2, 40.8, 22.4, 2.05, 17.96, 14.3, 1.0, NOW() FROM new_sondage
UNION ALL SELECT id, 7.3, 5.8, 57.9, NULL, NULL, 0.33, 21.84, 8.4, 0.22, NOW() FROM new_sondage
;

-- Sondage TEST-6976-793
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-6976-793', '2024-03-07', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(0.8957, 7.1787), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 14.5, 23.2, NULL, NULL, 0.1, 20.76, 7.1, 0.22, NOW() FROM new_sondage
UNION ALL SELECT id, 3.4, 27.1, 83.7, 19.3, 14.3, 0.98, 18.93, 12.5, 0.14, NOW() FROM new_sondage
UNION ALL SELECT id, 4.6, 19.3, 60.2, 20.2, 14.0, 0.39, 19.95, 10.9, 0.47, NOW() FROM new_sondage
UNION ALL SELECT id, 9.6, 37.0, 94.7, 33.8, 25.0, 2.65, 18.75, 19.9, 1.3, NOW() FROM new_sondage
;

-- Sondage TEST-2279-706
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-2279-706', '2025-05-14', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(1.4315, 6.0974), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 19.6, 53.9, NULL, NULL, 0.39, 19.81, 9.2, 0.14, NOW() FROM new_sondage
UNION ALL SELECT id, 2.8, 57.5, 82.0, 32.6, 23.9, 1.13, 17.99, 13.5, 0.75, NOW() FROM new_sondage
UNION ALL SELECT id, 6.1, 64.6, 78.4, 31.9, 27.2, 1.82, 17.22, 17.5, 2.09, NOW() FROM new_sondage
UNION ALL SELECT id, 8.6, 80.5, 93.0, 47.1, 34.4, 3.27, 16.42, 27.1, 4.51, NOW() FROM new_sondage
;

-- Sondage TEST-1930-448
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-1930-448', '2023-12-29', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(0.5284, 9.7653), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 9.3, 63.4, 29.8, 16.4, 0.43, 18.77, 9.3, 0.53, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 36.5, 81.6, 27.7, 17.4, 2.67, 18.19, 19.2, 1.45, NOW() FROM new_sondage
UNION ALL SELECT id, 4.2, 56.0, 77.9, 37.1, 15.2, 1.2, 17.94, 18.7, 2.23, NOW() FROM new_sondage
UNION ALL SELECT id, 9.7, 47.0, 86.6, 32.7, 18.6, 1.71, 17.34, 18.6, 1.95, NOW() FROM new_sondage
UNION ALL SELECT id, 12.4, 2.9, 30.2, NULL, NULL, 0.37, 19.28, 9.0, 0.06, NOW() FROM new_sondage
UNION ALL SELECT id, 13.8, 17.3, 81.6, 21.6, 19.8, 0.39, 20.35, 11.9, 0.22, NOW() FROM new_sondage
;

-- Sondage TEST-5762-302
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-5762-302', '2024-11-13', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.3076, 6.2451), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 11.6, 20.7, NULL, NULL, 0.5, 21.53, 7.1, 0.19, NOW() FROM new_sondage
UNION ALL SELECT id, 3.1, 70.5, 90.0, 56.5, 26.1, 6.72, 15.17, 18.6, 6.44, NOW() FROM new_sondage
UNION ALL SELECT id, 5.9, 7.1, 82.3, 17.1, 19.6, 0.87, 18.64, 8.8, 0.27, NOW() FROM new_sondage
UNION ALL SELECT id, 6.7, 23.6, 76.8, 16.4, 10.9, 0.63, 19.35, 9.4, 0.28, NOW() FROM new_sondage
UNION ALL SELECT id, 7.7, 67.0, 85.9, 72.9, 44.9, 6.43, 15.04, 20.5, 9.39, NOW() FROM new_sondage
UNION ALL SELECT id, 14.5, 29.4, 79.7, 19.3, 16.0, 0.59, 18.33, 12.6, 0.79, NOW() FROM new_sondage
UNION ALL SELECT id, 11.1, 9.2, 34.3, NULL, NULL, 0.38, 21.33, 8.4, 0.26, NOW() FROM new_sondage
;

-- Sondage TEST-2420-928
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-2420-928', '2024-11-15', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.3693, 6.2348), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 77.5, 86.1, 75.8, 41.9, 3.73, 16.64, 20.1, 10.71, NOW() FROM new_sondage
UNION ALL SELECT id, 2.9, 82.1, 94.9, 58.4, 36.9, 6.32, 17.06, 23.3, 4.98, NOW() FROM new_sondage
UNION ALL SELECT id, 5.8, 66.3, 95.0, 52.3, 21.6, 7.85, 16.43, 18.1, 8.39, NOW() FROM new_sondage
UNION ALL SELECT id, 5.9, 4.4, 29.4, NULL, NULL, 0.29, 20.27, 9.3, 0.14, NOW() FROM new_sondage
;

-- Sondage TEST-8763-241
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8763-241', '2025-02-05', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.2286, 6.2032), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 84.1, 87.9, 55.2, 41.8, 7.77, 16.8, 26.3, 11.17, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 81.3, 91.7, 82.4, 28.7, 7.62, 15.41, 25.4, 9.61, NOW() FROM new_sondage
UNION ALL SELECT id, 5.5, 55.8, 83.0, 43.7, 29.0, 1.11, 17.45, 14.2, 0.68, NOW() FROM new_sondage
UNION ALL SELECT id, 9.1, 46.5, 93.6, 43.0, 23.5, 1.18, 17.36, 13.6, 1.62, NOW() FROM new_sondage
UNION ALL SELECT id, 12.5, 12.6, 57.6, 17.2, 15.7, 0.97, 20.56, 10.8, 0.18, NOW() FROM new_sondage
UNION ALL SELECT id, 12.1, 42.8, 89.8, 37.9, 19.4, 1.87, 18.52, 19.3, 2.09, NOW() FROM new_sondage
;

-- Sondage TEST-4780-713
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4780-713', '2025-08-31', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(0.9187, 8.1015), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 15.3, 50.4, 17.8, 19.4, 0.5, 18.4, 8.5, 0.01, NOW() FROM new_sondage
UNION ALL SELECT id, 3.2, 66.9, 100.0, 76.1, 36.5, 7.05, 15.1, 19.4, 10.19, NOW() FROM new_sondage
UNION ALL SELECT id, 5.8, 65.8, 96.2, 76.2, 22.6, 7.77, 17.89, 26.6, 5.43, NOW() FROM new_sondage
UNION ALL SELECT id, 8.0, 14.7, 59.8, NULL, NULL, 0.02, 21.7, 9.3, 0.05, NOW() FROM new_sondage
UNION ALL SELECT id, 11.7, 59.4, 70.5, 34.1, 29.7, 2.19, 18.23, 18.8, 1.12, NOW() FROM new_sondage
UNION ALL SELECT id, 13.7, 12.3, 63.9, 26.3, 16.6, 0.19, 19.2, 11.6, 0.69, NOW() FROM new_sondage
UNION ALL SELECT id, 17.0, 56.1, 86.8, 38.0, 29.9, 2.58, 18.81, 18.6, 0.58, NOW() FROM new_sondage
;

-- Sondage TEST-2523-412
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-2523-412', '2024-11-27', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.052, 7.7283), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 79.0, 96.6, 57.6, 32.5, 3.05, 15.24, 21.4, 4.52, NOW() FROM new_sondage
UNION ALL SELECT id, 4.0, 56.6, 75.3, 38.0, 25.9, 2.83, 17.45, 19.0, 1.45, NOW() FROM new_sondage
UNION ALL SELECT id, 5.2, 82.6, 99.8, 72.9, 33.6, 7.67, 16.73, 27.5, 6.05, NOW() FROM new_sondage
UNION ALL SELECT id, 8.9, 17.5, 39.8, NULL, NULL, 0.15, 19.42, 9.4, 0.04, NOW() FROM new_sondage
UNION ALL SELECT id, 10.0, 40.8, 89.2, 34.5, 16.4, 1.99, 17.37, 14.8, 2.65, NOW() FROM new_sondage
UNION ALL SELECT id, 13.0, 73.7, 86.6, 77.3, 20.2, 6.96, 15.82, 25.8, 10.51, NOW() FROM new_sondage
;

-- Sondage TEST-4639-934
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4639-934', '2025-06-16', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.1133, 6.047), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 15.7, 72.8, 21.9, 15.9, 0.15, 20.92, 12.9, 0.66, NOW() FROM new_sondage
UNION ALL SELECT id, 2.6, 21.0, 68.9, 28.0, 19.4, 0.5, 19.76, 8.3, 0.72, NOW() FROM new_sondage
UNION ALL SELECT id, 5.4, 64.5, 81.8, 37.9, 29.0, 2.66, 18.95, 19.2, 0.99, NOW() FROM new_sondage
UNION ALL SELECT id, 7.2, 67.2, 98.9, 44.2, 20.5, 4.26, 17.58, 23.9, 10.43, NOW() FROM new_sondage
UNION ALL SELECT id, 12.8, 11.6, 78.4, 16.5, 13.0, 0.16, 18.59, 11.2, 0.5, NOW() FROM new_sondage
;

-- Sondage TEST-8198-816
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8198-816', '2025-04-18', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.2765, 6.0532), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 16.9, 77.9, 27.6, 11.6, 0.25, 20.26, 12.9, 0.22, NOW() FROM new_sondage
UNION ALL SELECT id, 3.8, 15.8, 60.7, 23.5, 13.0, 0.21, 19.78, 13.2, 0.63, NOW() FROM new_sondage
UNION ALL SELECT id, 4.6, 38.0, 89.7, 39.2, 26.7, 2.3, 18.49, 19.1, 0.84, NOW() FROM new_sondage
UNION ALL SELECT id, 7.7, 19.3, 43.0, NULL, NULL, 0.47, 20.39, 9.2, 0.15, NOW() FROM new_sondage
UNION ALL SELECT id, 10.5, 11.5, 77.2, 24.1, 12.4, 0.89, 20.05, 13.8, 0.52, NOW() FROM new_sondage
UNION ALL SELECT id, 15.7, 38.3, 81.2, 33.2, 21.1, 2.12, 18.36, 17.0, 2.6, NOW() FROM new_sondage
UNION ALL SELECT id, 10.1, 57.1, 91.9, 43.3, 26.6, 1.93, 18.75, 18.0, 1.34, NOW() FROM new_sondage
UNION ALL SELECT id, 16.5, 2.9, 45.4, NULL, NULL, 0.23, 19.92, 8.5, 0.24, NOW() FROM new_sondage
;

-- Sondage TEST-1547-807
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-1547-807', '2025-10-06', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.1115, 7.3211), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 50.3, 81.8, 28.2, 25.4, 1.37, 17.32, 19.3, 0.86, NOW() FROM new_sondage
UNION ALL SELECT id, 3.2, 5.6, 42.2, NULL, NULL, 0.21, 19.41, 6.2, 0.09, NOW() FROM new_sondage
UNION ALL SELECT id, 5.8, 54.3, 82.8, 36.8, 22.1, 1.13, 18.19, 16.8, 0.55, NOW() FROM new_sondage
UNION ALL SELECT id, 8.4, 38.8, 82.7, 27.9, 27.3, 2.19, 18.22, 15.0, 1.43, NOW() FROM new_sondage
UNION ALL SELECT id, 8.4, 78.5, 96.2, 83.5, 34.1, 2.58, 16.29, 25.1, 9.47, NOW() FROM new_sondage
;

-- Sondage TEST-4931-193
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4931-193', '2024-08-29', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.4129, 6.3002), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 12.8, 30.6, NULL, NULL, 0.5, 19.07, 6.4, 0.08, NOW() FROM new_sondage
UNION ALL SELECT id, 2.9, 51.3, 87.4, 27.5, 27.0, 2.29, 17.55, 15.1, 1.39, NOW() FROM new_sondage
UNION ALL SELECT id, 6.6, 17.2, 59.8, 15.8, 18.0, 0.68, 19.4, 11.3, 0.52, NOW() FROM new_sondage
UNION ALL SELECT id, 7.1, 49.2, 87.6, 43.4, 16.7, 2.14, 18.81, 14.2, 2.48, NOW() FROM new_sondage
;

-- Sondage TEST-1906-361
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-1906-361', '2025-04-06', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(1.0249, 6.187), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 62.6, 83.3, 32.7, 23.3, 2.04, 18.01, 19.4, 1.74, NOW() FROM new_sondage
UNION ALL SELECT id, 2.8, 14.8, 54.8, 25.5, 11.2, 0.86, 18.26, 11.1, 0.24, NOW() FROM new_sondage
UNION ALL SELECT id, 6.7, 49.6, 93.1, 44.4, 19.7, 1.83, 18.26, 17.0, 1.86, NOW() FROM new_sondage
UNION ALL SELECT id, 6.6, 28.1, 81.0, 26.8, 14.4, 1.0, 18.62, 12.0, 0.44, NOW() FROM new_sondage
UNION ALL SELECT id, 11.9, 57.3, 79.8, 29.7, 25.9, 1.53, 18.64, 14.3, 1.59, NOW() FROM new_sondage
;

-- Sondage TEST-7668-669
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7668-669', '2024-03-02', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(1.2648, 6.347), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 13.7, 76.7, 21.8, 11.4, 0.63, 19.29, 13.7, 0.53, NOW() FROM new_sondage
UNION ALL SELECT id, 3.7, 15.1, 62.5, 18.5, 12.8, 0.36, 19.02, 13.4, 0.42, NOW() FROM new_sondage
UNION ALL SELECT id, 4.6, 54.9, 83.9, 35.3, 18.0, 2.72, 17.38, 12.9, 1.27, NOW() FROM new_sondage
UNION ALL SELECT id, 6.8, 42.0, 76.3, 35.7, 16.5, 1.05, 17.52, 14.2, 2.31, NOW() FROM new_sondage
;

-- Sondage TEST-8336-240
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8336-240', '2024-12-08', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(0.9314, 9.2186), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 50.9, 80.7, 25.4, 20.5, 2.17, 17.25, 12.7, 2.78, NOW() FROM new_sondage
UNION ALL SELECT id, 3.1, 50.2, 74.3, 27.4, 29.3, 1.42, 18.85, 14.4, 1.61, NOW() FROM new_sondage
UNION ALL SELECT id, 5.7, 13.1, 41.8, NULL, NULL, 0.29, 19.76, 7.1, 0.29, NOW() FROM new_sondage
UNION ALL SELECT id, 8.7, 29.7, 59.5, 22.4, 16.2, 0.9, 18.26, 11.7, 0.78, NOW() FROM new_sondage
UNION ALL SELECT id, 9.1, 0.7, 20.8, NULL, NULL, 0.0, 21.81, 7.8, 0.03, NOW() FROM new_sondage
UNION ALL SELECT id, 14.4, 63.7, 96.9, 70.1, 49.0, 5.8, 15.12, 24.8, 9.73, NOW() FROM new_sondage
UNION ALL SELECT id, 16.3, 52.7, 79.2, 32.0, 23.6, 2.82, 17.53, 13.1, 0.94, NOW() FROM new_sondage
UNION ALL SELECT id, 16.0, 64.1, 88.1, 25.8, 20.9, 1.71, 17.64, 13.9, 1.46, NOW() FROM new_sondage
;

-- Sondage TEST-3821-569
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-3821-569', '2023-11-21', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.0255, 6.2912), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 39.2, 76.1, 34.3, 16.9, 1.31, 18.43, 12.4, 2.91, NOW() FROM new_sondage
UNION ALL SELECT id, 4.0, 7.0, 70.7, 21.1, 14.0, 0.11, 20.8, 12.3, 0.51, NOW() FROM new_sondage
UNION ALL SELECT id, 4.4, 86.8, 85.3, 62.1, 30.3, 2.97, 15.76, 25.1, 2.99, NOW() FROM new_sondage
UNION ALL SELECT id, 9.1, 5.2, 63.9, 26.2, 17.3, 0.85, 21.0, 9.0, 0.23, NOW() FROM new_sondage
;

-- Sondage TEST-1594-462
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-1594-462', '2025-06-21', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(1.3689, 7.1134), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 60.5, 91.1, 27.1, 16.7, 2.18, 17.7, 14.1, 0.82, NOW() FROM new_sondage
UNION ALL SELECT id, 3.0, 90.5, 96.9, 78.6, 24.1, 4.77, 17.14, 19.5, 9.95, NOW() FROM new_sondage
UNION ALL SELECT id, 5.4, 36.1, 78.2, 36.0, 25.1, 1.93, 17.37, 16.0, 2.61, NOW() FROM new_sondage
UNION ALL SELECT id, 9.9, 22.6, 55.9, 22.6, 11.3, 0.74, 19.98, 8.1, 0.39, NOW() FROM new_sondage
UNION ALL SELECT id, 10.8, 72.3, 97.5, 46.9, 45.9, 6.29, 17.79, 26.4, 3.9, NOW() FROM new_sondage
UNION ALL SELECT id, 9.6, 58.6, 72.6, 42.2, 23.8, 2.77, 18.95, 14.2, 2.2, NOW() FROM new_sondage
UNION ALL SELECT id, 15.8, 45.2, 94.7, 39.4, 30.0, 1.26, 17.4, 15.4, 1.39, NOW() FROM new_sondage
;

-- Sondage TEST-7947-449
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7947-449', '2025-05-22', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(1.1941, 7.7094), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 11.0, 38.2, NULL, NULL, 0.08, 19.18, 8.0, 0.03, NOW() FROM new_sondage
UNION ALL SELECT id, 3.1, 37.8, 90.4, 31.3, 16.4, 1.45, 17.44, 18.8, 1.81, NOW() FROM new_sondage
UNION ALL SELECT id, 5.0, 27.3, 68.5, 21.4, 19.7, 0.63, 20.06, 8.7, 0.42, NOW() FROM new_sondage
UNION ALL SELECT id, 9.9, 7.4, 56.3, 19.6, 19.7, 0.21, 20.77, 10.8, 0.21, NOW() FROM new_sondage
UNION ALL SELECT id, 12.7, 35.9, 71.6, 32.8, 29.6, 1.38, 18.97, 19.5, 0.51, NOW() FROM new_sondage
UNION ALL SELECT id, 9.8, 58.4, 71.8, 42.2, 20.0, 2.31, 18.69, 14.6, 1.94, NOW() FROM new_sondage
UNION ALL SELECT id, 14.0, 27.2, 55.0, 28.4, 15.8, 0.67, 20.87, 12.6, 0.07, NOW() FROM new_sondage
UNION ALL SELECT id, 15.2, 39.3, 87.2, 25.3, 29.4, 1.39, 17.3, 18.5, 2.34, NOW() FROM new_sondage
;

-- Sondage TEST-9300-122
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-9300-122', '2024-08-17', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(1.3171, 7.4655), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 46.3, 75.7, 32.7, 16.1, 2.98, 17.72, 14.4, 2.72, NOW() FROM new_sondage
UNION ALL SELECT id, 3.1, 83.8, 90.7, 41.7, 22.7, 6.43, 17.97, 20.8, 7.27, NOW() FROM new_sondage
UNION ALL SELECT id, 4.8, 12.9, 42.3, NULL, NULL, 0.5, 19.03, 6.2, 0.23, NOW() FROM new_sondage
UNION ALL SELECT id, 7.8, 77.7, 92.1, 51.3, 28.5, 7.69, 17.32, 24.8, 5.83, NOW() FROM new_sondage
;

-- Sondage TEST-4055-982
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4055-982', '2023-10-23', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(1.4256, 6.7225), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 11.9, 82.0, 21.1, 10.5, 0.94, 20.95, 13.3, 0.01, NOW() FROM new_sondage
UNION ALL SELECT id, 3.3, 91.4, 98.0, 57.5, 27.3, 6.03, 15.59, 26.4, 2.02, NOW() FROM new_sondage
UNION ALL SELECT id, 6.1, 77.8, 96.3, 40.0, 20.6, 7.73, 15.06, 27.7, 9.45, NOW() FROM new_sondage
UNION ALL SELECT id, 6.8, 39.9, 84.2, 35.1, 21.6, 2.44, 17.23, 17.1, 0.89, NOW() FROM new_sondage
UNION ALL SELECT id, 12.1, 69.9, 91.3, 41.1, 22.3, 7.08, 16.2, 24.9, 4.44, NOW() FROM new_sondage
UNION ALL SELECT id, 14.3, 44.6, 78.4, 40.3, 28.9, 1.02, 18.17, 13.3, 1.15, NOW() FROM new_sondage
;

-- Sondage TEST-7726-736
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7726-736', '2024-03-24', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(0.8099, 8.2134), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 11.9, 75.4, 23.6, 19.6, 0.34, 19.71, 13.6, 0.7, NOW() FROM new_sondage
UNION ALL SELECT id, 2.9, 17.7, 63.1, 16.5, 13.9, 0.78, 20.27, 10.0, 0.14, NOW() FROM new_sondage
UNION ALL SELECT id, 5.8, 11.0, 61.8, 20.7, 19.3, 0.2, 20.62, 11.9, 0.59, NOW() FROM new_sondage
UNION ALL SELECT id, 9.4, 25.8, 56.4, 15.7, 10.2, 0.94, 18.11, 12.1, 0.15, NOW() FROM new_sondage
UNION ALL SELECT id, 10.1, 50.4, 90.0, 27.5, 23.1, 2.57, 18.61, 19.6, 0.83, NOW() FROM new_sondage
UNION ALL SELECT id, 16.0, 6.2, 58.1, 27.3, 18.6, 0.46, 18.92, 9.8, 0.58, NOW() FROM new_sondage
UNION ALL SELECT id, 15.5, 25.6, 65.5, 21.4, 15.9, 0.94, 19.84, 9.3, 0.29, NOW() FROM new_sondage
UNION ALL SELECT id, 13.0, 81.6, 87.5, 87.6, 46.0, 4.57, 15.03, 27.4, 4.36, NOW() FROM new_sondage
;

-- Sondage TEST-7630-437
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7630-437', '2025-03-15', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.2288, 6.3446), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 54.3, 78.1, 28.3, 25.4, 1.78, 17.31, 18.6, 2.15, NOW() FROM new_sondage
UNION ALL SELECT id, 3.0, 10.3, 64.8, 17.1, 19.1, 0.22, 18.66, 12.3, 0.04, NOW() FROM new_sondage
UNION ALL SELECT id, 4.5, 35.3, 85.8, 42.5, 18.2, 1.07, 17.36, 16.7, 0.71, NOW() FROM new_sondage
UNION ALL SELECT id, 7.3, 13.9, 21.3, NULL, NULL, 0.18, 21.81, 9.9, 0.23, NOW() FROM new_sondage
UNION ALL SELECT id, 11.3, 70.0, 91.8, 57.7, 38.5, 3.3, 16.33, 21.0, 11.19, NOW() FROM new_sondage
UNION ALL SELECT id, 10.0, 4.3, 45.5, NULL, NULL, 0.49, 21.69, 7.9, 0.13, NOW() FROM new_sondage
;

-- Sondage TEST-4573-757
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4573-757', '2023-12-06', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.2805, 6.1119), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 61.4, 94.7, 63.9, 29.2, 4.56, 17.29, 20.7, 7.25, NOW() FROM new_sondage
UNION ALL SELECT id, 3.6, 9.7, 71.5, 17.9, 15.1, 0.35, 20.04, 10.3, 0.35, NOW() FROM new_sondage
UNION ALL SELECT id, 6.7, 28.9, 51.4, 24.1, 12.0, 0.09, 19.21, 11.7, 0.69, NOW() FROM new_sondage
;

-- Sondage TEST-3430-770
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-3430-770', '2025-07-05', 'Lab B - Kara', ST_Transform(ST_SetSRID(ST_MakePoint(0.5317, 9.6744), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 6.0, 45.4, NULL, NULL, 0.08, 20.61, 9.2, 0.11, NOW() FROM new_sondage
UNION ALL SELECT id, 3.9, 18.9, 84.8, 28.9, 18.4, 0.34, 20.85, 14.0, 0.78, NOW() FROM new_sondage
UNION ALL SELECT id, 5.5, 35.7, 79.4, 25.0, 25.6, 2.87, 17.27, 15.1, 1.74, NOW() FROM new_sondage
UNION ALL SELECT id, 7.6, 82.8, 86.5, 61.6, 44.7, 5.58, 15.87, 24.1, 4.75, NOW() FROM new_sondage
UNION ALL SELECT id, 7.3, 20.3, 73.5, 19.5, 19.9, 0.76, 18.83, 12.8, 0.22, NOW() FROM new_sondage
UNION ALL SELECT id, 14.3, 83.1, 87.5, 54.5, 46.6, 4.39, 17.14, 27.8, 4.98, NOW() FROM new_sondage
UNION ALL SELECT id, 18.9, 9.3, 62.8, 24.9, 12.5, 0.4, 19.12, 13.2, 0.5, NOW() FROM new_sondage
;

-- Sondage TEST-2596-989
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-2596-989', '2024-02-08', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.1736, 8.6122), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 48.9, 89.9, 38.5, 27.2, 1.53, 17.54, 12.5, 1.59, NOW() FROM new_sondage
UNION ALL SELECT id, 3.8, 26.8, 77.7, 27.3, 12.8, 0.85, 19.54, 10.0, 0.21, NOW() FROM new_sondage
UNION ALL SELECT id, 6.3, 26.1, 70.1, 15.6, 17.7, 0.33, 19.68, 10.1, 0.74, NOW() FROM new_sondage
UNION ALL SELECT id, 7.4, 72.2, 88.6, 79.6, 21.9, 2.89, 16.93, 20.9, 9.89, NOW() FROM new_sondage
;

-- Sondage TEST-8906-331
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8906-331', '2025-05-30', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(0.9663, 7.3724), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 77.2, 97.4, 60.3, 38.9, 7.43, 15.76, 23.1, 7.54, NOW() FROM new_sondage
UNION ALL SELECT id, 3.4, 22.0, 59.4, 18.9, 13.2, 0.88, 19.24, 10.0, 0.11, NOW() FROM new_sondage
UNION ALL SELECT id, 5.0, 29.0, 82.0, 16.7, 18.8, 0.15, 18.08, 8.4, 0.64, NOW() FROM new_sondage
;

-- Sondage TEST-7722-709
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7722-709', '2024-06-26', 'Lab E - Dapaong', ST_Transform(ST_SetSRID(ST_MakePoint(1.1277, 9.1158), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 71.5, 86.0, 46.0, 30.8, 7.77, 15.52, 27.3, 4.44, NOW() FROM new_sondage
UNION ALL SELECT id, 3.9, 47.6, 86.8, 31.4, 24.9, 2.24, 18.0, 15.4, 0.71, NOW() FROM new_sondage
UNION ALL SELECT id, 5.8, 54.1, 76.9, 26.8, 26.3, 2.28, 17.38, 16.7, 0.79, NOW() FROM new_sondage
;

-- Sondage TEST-4523-894
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4523-894', '2023-12-04', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(0.2324, 10.0682), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 55.3, 78.9, 42.4, 17.4, 2.56, 18.75, 13.1, 2.64, NOW() FROM new_sondage
UNION ALL SELECT id, 2.6, 57.1, 74.2, 31.5, 28.4, 2.23, 17.62, 14.2, 1.83, NOW() FROM new_sondage
UNION ALL SELECT id, 4.4, 63.1, 88.2, 27.8, 19.2, 1.12, 18.23, 12.1, 2.44, NOW() FROM new_sondage
UNION ALL SELECT id, 7.8, 35.2, 87.6, 26.6, 25.9, 2.56, 18.87, 18.3, 1.58, NOW() FROM new_sondage
UNION ALL SELECT id, 7.5, 11.6, 52.0, 28.2, 10.6, 0.51, 19.21, 12.5, 0.79, NOW() FROM new_sondage
UNION ALL SELECT id, 11.2, 15.5, 53.6, NULL, NULL, 0.44, 20.09, 7.7, 0.3, NOW() FROM new_sondage
;

-- Sondage TEST-8413-109
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-8413-109', '2023-12-10', 'Lab D - Atakpamé', ST_Transform(ST_SetSRID(ST_MakePoint(1.1647, 6.411), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 73.9, 96.5, 55.3, 49.5, 6.51, 15.08, 26.5, 11.5, NOW() FROM new_sondage
UNION ALL SELECT id, 3.4, 52.8, 80.8, 32.3, 18.2, 2.67, 17.26, 16.3, 1.03, NOW() FROM new_sondage
UNION ALL SELECT id, 6.6, 12.4, 71.9, 19.9, 11.0, 0.37, 19.02, 10.6, 0.51, NOW() FROM new_sondage
;

-- Sondage TEST-4097-509
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-4097-509', '2025-01-25', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(0.7398, 7.5376), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 71.0, 92.1, 69.6, 32.3, 3.51, 15.4, 19.8, 2.22, NOW() FROM new_sondage
UNION ALL SELECT id, 3.9, 52.3, 74.0, 33.1, 21.7, 2.61, 18.65, 16.5, 1.43, NOW() FROM new_sondage
UNION ALL SELECT id, 6.9, 29.1, 53.1, 18.1, 12.5, 0.13, 20.77, 10.8, 0.49, NOW() FROM new_sondage
UNION ALL SELECT id, 9.6, 68.5, 90.8, 88.5, 20.4, 5.25, 17.89, 23.5, 7.41, NOW() FROM new_sondage
UNION ALL SELECT id, 12.2, 13.5, 72.7, 17.2, 14.9, 0.33, 18.65, 11.1, 0.75, NOW() FROM new_sondage
UNION ALL SELECT id, 15.2, 13.0, 64.0, 22.7, 12.6, 0.55, 18.86, 13.1, 0.21, NOW() FROM new_sondage
UNION ALL SELECT id, 10.6, 19.3, 43.3, NULL, NULL, 0.32, 21.53, 6.8, 0.19, NOW() FROM new_sondage
;

-- Sondage TEST-1274-761
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-1274-761', '2023-12-25', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.394, 6.0172), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 39.1, 73.0, 41.8, 28.1, 2.38, 17.7, 14.6, 1.63, NOW() FROM new_sondage
UNION ALL SELECT id, 3.8, 21.5, 50.9, 20.6, 13.3, 0.2, 20.81, 10.4, 0.69, NOW() FROM new_sondage
UNION ALL SELECT id, 7.0, 26.5, 52.0, 15.4, 10.9, 0.69, 19.81, 12.7, 0.56, NOW() FROM new_sondage
UNION ALL SELECT id, 9.0, 41.3, 74.8, 43.5, 22.6, 1.69, 18.49, 15.7, 0.99, NOW() FROM new_sondage
UNION ALL SELECT id, 10.9, 66.8, 90.4, 48.1, 29.6, 5.01, 17.92, 21.7, 9.76, NOW() FROM new_sondage
UNION ALL SELECT id, 9.3, 27.1, 68.2, 21.7, 12.2, 0.47, 19.22, 8.8, 0.35, NOW() FROM new_sondage
UNION ALL SELECT id, 18.2, 0.1, 31.0, NULL, NULL, 0.03, 19.43, 6.4, 0.06, NOW() FROM new_sondage
UNION ALL SELECT id, 16.0, 11.6, 64.9, 26.0, 17.3, 0.39, 20.13, 11.4, 0.45, NOW() FROM new_sondage
;

-- Sondage TEST-6789-920
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-6789-920', '2024-03-10', 'Lab C - Sokodé', ST_Transform(ST_SetSRID(ST_MakePoint(1.0229, 6.7328), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 20.6, 61.1, 26.7, 11.7, 0.74, 19.77, 12.4, 0.09, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 89.9, 86.9, 80.8, 31.0, 5.29, 16.62, 25.7, 4.57, NOW() FROM new_sondage
UNION ALL SELECT id, 4.7, 17.7, 63.0, 15.3, 15.6, 0.84, 20.66, 11.1, 0.11, NOW() FROM new_sondage
UNION ALL SELECT id, 8.3, 0.5, 37.6, NULL, NULL, 0.36, 19.85, 7.6, 0.19, NOW() FROM new_sondage
UNION ALL SELECT id, 12.8, 17.4, 56.8, NULL, NULL, 0.18, 21.11, 8.1, 0.14, NOW() FROM new_sondage
UNION ALL SELECT id, 11.1, 39.1, 91.4, 39.6, 28.0, 1.53, 17.7, 15.8, 1.76, NOW() FROM new_sondage
;

-- Sondage TEST-7423-533
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-7423-533', '2024-07-21', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(1.3565, 7.9661), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 19.1, 62.8, 28.8, 19.5, 0.3, 18.68, 10.0, 0.44, NOW() FROM new_sondage
UNION ALL SELECT id, 3.5, 8.0, 70.3, 27.5, 15.2, 0.7, 18.08, 13.7, 0.45, NOW() FROM new_sondage
UNION ALL SELECT id, 5.5, 16.1, 60.7, 23.8, 15.6, 0.71, 20.82, 9.0, 0.76, NOW() FROM new_sondage
UNION ALL SELECT id, 8.6, 35.5, 87.5, 42.8, 23.9, 2.34, 18.77, 13.4, 2.74, NOW() FROM new_sondage
UNION ALL SELECT id, 12.3, 29.6, 80.2, 27.0, 17.7, 0.35, 18.7, 8.0, 0.73, NOW() FROM new_sondage
;

-- Sondage TEST-5455-369
WITH new_sondage AS (
  INSERT INTO sondages (code, date, source, geom, created_at)
  VALUES ('TEST-5455-369', '2024-08-19', 'Lab A - Lomé', ST_Transform(ST_SetSRID(ST_MakePoint(0.6424, 9.1922), 4326), 25231), NOW())
  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
  RETURNING id
)
INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)
SELECT id, 1.0, 42.9, 81.4, 40.9, 26.0, 2.35, 18.22, 14.7, 0.69, NOW() FROM new_sondage
UNION ALL SELECT id, 2.8, 76.7, 99.9, 69.5, 26.5, 4.01, 16.09, 21.7, 7.59, NOW() FROM new_sondage
UNION ALL SELECT id, 4.1, 3.8, 53.8, NULL, NULL, 0.05, 20.04, 9.1, 0.21, NOW() FROM new_sondage
UNION ALL SELECT id, 8.0, 40.8, 88.0, 29.6, 16.5, 1.02, 17.97, 18.4, 1.05, NOW() FROM new_sondage
UNION ALL SELECT id, 11.9, 52.5, 85.9, 41.9, 29.0, 2.31, 17.65, 13.6, 1.49, NOW() FROM new_sondage
UNION ALL SELECT id, 14.7, 54.5, 85.2, 36.2, 24.5, 2.65, 18.24, 19.0, 1.34, NOW() FROM new_sondage
UNION ALL SELECT id, 16.6, 47.0, 70.0, 31.6, 18.0, 2.96, 17.26, 15.3, 1.56, NOW() FROM new_sondage
UNION ALL SELECT id, 21.8, 60.6, 82.2, 31.4, 24.6, 2.32, 18.9, 16.6, 2.02, NOW() FROM new_sondage
;

COMMIT;

REFRESH MATERIALIZED VIEW grid_stats_geotechnical;

SELECT COUNT(*) as mailles_avec_donnees FROM grid_stats_geotechnical WHERE n_sondages > 0;
