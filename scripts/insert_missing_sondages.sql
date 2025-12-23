-- Insert missing sondages for NICABOU source
INSERT INTO atlas.sondages (code, localite, source, meta) 
VALUES 
  ('DAVIE', 'Davié', 'NICABOU Ninsao Vianney', '{"localite": "Davié"}'),
  ('DZOGBECOPE', 'Dzogbécopé', 'NICABOU Ninsao Vianney', '{"localite": "Dzogbécopé"}'),
  ('APEHEME', 'Apéhémé', 'NICABOU Ninsao Vianney', '{"localite": "Apéhémé"}')
ON CONFLICT DO NOTHING;

-- Show inserted sondages
SELECT code, id, localite, source, is_geocoded, adm3_id 
FROM atlas.sondages 
WHERE code IN ('DAVIE', 'DZOGBECOPE', 'APEHEME');
