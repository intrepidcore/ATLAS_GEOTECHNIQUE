
SELECT 
    table_schema, 
    table_name, 
    column_name, 
    data_type 
FROM information_schema.columns 
WHERE table_name IN ('mailles', 'adm0_raw', 'sondages')
ORDER BY table_name, ordinal_position;
