-- Analyse etat VfS apres deduplication et prediction
SELECT
  SUM(CASE WHEN vbs_vfs_pred IS NULL THEN 1 ELSE 0 END) AS pred_null,
  SUM(CASE WHEN vbs_vfs_pred IS NOT NULL AND vbs_vfs_pred = 'NaN'::float THEN 1 ELSE 0 END) AS pred_nan_float,
  SUM(CASE WHEN vbs_vfs_pred IS NOT NULL AND vbs_vfs_pred != 'NaN'::float AND vbs_vfs_pred >= 0 THEN 1 ELSE 0 END) AS pred_valid,
  ROUND(AVG(CASE WHEN vbs_vfs_pred > 0 AND vbs_vfs_pred < 20 THEN vbs_vfs_pred END)::numeric,3) AS mean_vbs_valid,
  SUM(CASE WHEN clay_index IS NOT NULL AND clay_index = 'NaN'::float THEN 1 ELSE 0 END) AS clay_nan,
  SUM(CASE WHEN clay_index IS NOT NULL AND clay_index != 'NaN'::float THEN 1 ELSE 0 END) AS clay_valid,
  ROUND(AVG(CASE WHEN clay_index > 0 THEN clay_index END)::numeric,4) AS mean_clay
FROM atlas.maille_spectral_vfs;
