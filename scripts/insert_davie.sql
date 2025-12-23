INSERT INTO atlas.sondages (code, localite, source, meta) 
VALUES ('DAVIE', 'Davié', 'NICABOU Ninsao Vianney', '{"localite": "Davié"}')
ON CONFLICT DO NOTHING;

SELECT code, id, localite, is_geocoded, adm3_id 
FROM atlas.sondages 
WHERE code = 'DAVIE';
