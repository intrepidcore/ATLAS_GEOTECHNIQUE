-- Vue complète des essais avec tous les champs et classifications v2
-- Utilise les fonctions améliorées avec raison
DROP VIEW IF EXISTS v_samples_complete;

CREATE VIEW v_samples_complete AS
SELECT 
  e.id,
  e.sondage_id,
  s.meta->>'code' AS sondage_code,
  s.location_mode,
  e.depth_m,
  e.meta,
  
  -- Atterberg
  CASE 
    WHEN e.wl IS NOT NULL OR e.wp IS NOT NULL THEN
      jsonb_build_object(
        'wl', e.wl,
        'wp', e.wp,
        'ip', e.ip,
        'zone', CASE 
          WHEN e.ip IS NULL OR e.wl IS NULL THEN NULL
          WHEN e.ip < 0.73 * (e.wl - 20) THEN 
            CASE WHEN e.wl < 50 THEN 'ML' ELSE 'MH' END
          ELSE 
            CASE WHEN e.wl < 50 THEN 'CL' ELSE 'CH' END
        END,
        'plasticite', CASE 
          WHEN e.ip IS NULL THEN NULL
          WHEN e.ip < 7 THEN 'Faible'
          WHEN e.ip < 17 THEN 'Moyenne'
          ELSE 'Élevée'
        END
      )
    ELSE NULL
  END AS atterberg,
  
  -- VBS
  CASE 
    WHEN e.vbs IS NOT NULL THEN
      jsonb_build_object(
        'vbs', e.vbs,
        'argilosite', CASE 
          WHEN e.vbs < 1.5 THEN 'Faible'
          WHEN e.vbs < 2.5 THEN 'Moyenne'
          WHEN e.vbs < 6 THEN 'Forte'
          ELSE 'Très forte'
        END
      )
    ELSE NULL
  END AS vbs,
  
  -- Granulométrie
  CASE 
    WHEN e.passant_80um IS NOT NULL OR e.passant_2mm IS NOT NULL THEN
      jsonb_build_object(
        'passant_80um', e.passant_80um,
        'passant_2mm', e.passant_2mm,
        'passant_20mm', e.passant_20mm,
        'indices', fn_granulo_indices(
          (SELECT jsonb_agg(jsonb_build_object('mm', sieve_mm, 'pct', percent_passing))
           FROM granulometrie_points gp
           WHERE gp.essai_id = e.id)
        ),
        'points', (SELECT jsonb_agg(jsonb_build_object('mm', sieve_mm, 'pct', percent_passing) ORDER BY sieve_mm DESC)
                   FROM granulometrie_points gp
                   WHERE gp.essai_id = e.id)
      )
    ELSE NULL
  END AS granulo,
  
  -- Proctor
  CASE 
    WHEN e.gamma_d_max IS NOT NULL THEN
      jsonb_build_object(
        'gamma_d_max', e.gamma_d_max,
        'w_opt', e.w_opt,
        'type', e.proctor_type
      )
    ELSE NULL
  END AS proctor,
  
  -- Gonflement
  CASE 
    WHEN e.eg IS NOT NULL THEN
      jsonb_build_object(
        'eg', e.eg,
        'risque', CASE 
          WHEN e.eg < 1 THEN 'Faible'
          WHEN e.eg < 2.5 THEN 'Moyen'
          ELSE 'Fort'
        END
      )
    ELSE NULL
  END AS swelling,
  
  -- Classifications avec raisons
  jsonb_build_object(
    'uscs', fn_classify_uscs(
      e.wl,
      e.ip,
      e.passant_80um,
      (fn_granulo_indices(
        (SELECT jsonb_agg(jsonb_build_object('mm', sieve_mm, 'pct', percent_passing))
         FROM granulometrie_points gp
         WHERE gp.essai_id = e.id)
      )->>'d10')::numeric,
      (fn_granulo_indices(
        (SELECT jsonb_agg(jsonb_build_object('mm', sieve_mm, 'pct', percent_passing))
         FROM granulometrie_points gp
         WHERE gp.essai_id = e.id)
      )->>'cu')::numeric,
      (fn_granulo_indices(
        (SELECT jsonb_agg(jsonb_build_object('mm', sieve_mm, 'pct', percent_passing))
         FROM granulometrie_points gp
         WHERE gp.essai_id = e.id)
      )->>'cc')::numeric
    ),
    'aashto', fn_classify_aashto(
      e.wl,
      e.ip,
      e.passant_80um,
      e.passant_2mm
    ),
    'gtr', CASE 
      WHEN e.passant_80um IS NULL THEN jsonb_build_object('class', 'N/A', 'reason', 'Pas de données granulo')
      WHEN e.passant_80um < 35 THEN jsonb_build_object('class', 'B', 'reason', 'Fines <35%')
      WHEN e.passant_80um < 70 THEN jsonb_build_object('class', 'B/A', 'reason', '35%≤Fines<70%')
      ELSE jsonb_build_object('class', 'A', 'reason', 'Fines ≥70%')
    END
  ) AS classif

FROM essais_geotechniques e
JOIN sondages s ON s.id = e.sondage_id;

-- Index pour performance
CREATE INDEX IF NOT EXISTS idx_essais_sondage ON essais_geotechniques(sondage_id);
CREATE INDEX IF NOT EXISTS idx_essais_depth ON essais_geotechniques(depth_m);
CREATE INDEX IF NOT EXISTS idx_essais_wl ON essais_geotechniques(wl) WHERE wl IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_essais_vbs ON essais_geotechniques(vbs) WHERE vbs IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_granulo_essai_sieve ON granulometrie_points(essai_id, sieve_mm);

-- Commentaires
COMMENT ON VIEW v_samples_complete IS 'Vue complète des essais avec classifications USCS/AASHTO/GTR incluant les raisons';
