
SELECT table_schema, table_name 
FROM information_schema.tables 
WHERE table_name IN ('v_samples_complete_v4', 'maille_2km') OR table_name LIKE 'v_samples%';
