
SELECT table_schema, table_name, table_type 
FROM information_schema.tables 
WHERE table_schema = 'atlas' AND table_name = 'sondages';
