SELECT table_schema, table_name
FROM information_schema.tables
WHERE table_schema = 'atlas' AND table_name IN ('mailles', 'maille_28km');
