docker exec -i atlas-db psql -U atlas -d atlas_clean -c @"
DO `$`$
DECLARE v_sid uuid;
BEGIN
  SELECT id INTO v_sid FROM sondages WHERE code = 'ADOTE-OGARO';
  INSERT INTO essais_geotechniques (sondage_id, depth_m) VALUES (v_sid, 1.0), (v_sid, 1.5), (v_sid, 2.0);
  
  SELECT id INTO v_sid FROM sondages WHERE code = 'ADOTE-BATBOUGOU';
  INSERT INTO essais_geotechniques (sondage_id, depth_m) VALUES (v_sid, 1.0), (v_sid, 1.5), (v_sid, 2.0);
  
  SELECT id INTO v_sid FROM sondages WHERE code = 'ADOTE-NANOUSONGUE';
  INSERT INTO essais_geotechniques (sondage_id, depth_m) VALUES (v_sid, 1.0), (v_sid, 1.5), (v_sid, 2.0);
END `$`$;
"@
