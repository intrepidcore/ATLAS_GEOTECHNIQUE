SELECT column_name, data_type FROM information_schema.columns WHERE table_name='sondages' AND column_name LIKE '%adm%' OR column_name = 'location_mode';
