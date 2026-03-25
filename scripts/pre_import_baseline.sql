SELECT 
    'vbs' as essai_type,
    COUNT(*) as nb_essais,
    COUNT(DISTINCT s.maille_code) as nb_mailles_couvertes
FROM atlas.essais_vbs ev
JOIN atlas.echantillons e ON e.id = ev.echantillon_id
JOIN atlas.sondages s ON s.id = e.sondage_id
UNION ALL
SELECT 'atterberg_wl', COUNT(*), COUNT(DISTINCT s.maille_code)
FROM atlas.essais_atterberg ea
JOIN atlas.echantillons e ON e.id = ea.echantillon_id
JOIN atlas.sondages s ON s.id = e.sondage_id
UNION ALL
SELECT 'gonflement', COUNT(*), COUNT(DISTINCT s.maille_code)
FROM atlas.essais_potentiel_gonflement eg
JOIN atlas.echantillons e ON e.id = eg.echantillon_id
JOIN atlas.sondages s ON s.id = e.sondage_id;
