-- Classification AASHTO (HRB) simplifiée avec raison
CREATE OR REPLACE FUNCTION fn_classify_aashto(
  wl NUMERIC,
  ip NUMERIC,
  fines_pct NUMERIC,
  passant_2mm NUMERIC
)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  class TEXT;
  reason TEXT;
BEGIN
  IF fines_pct IS NULL THEN
    RETURN jsonb_build_object('class', 'N/A', 'reason', 'Pas de données granulo');
  END IF;
  
  -- Matériaux granulaires (≤35% passant 0.075mm)
  IF fines_pct <= 35 THEN
    IF passant_2mm IS NOT NULL AND passant_2mm <= 50 THEN
      class := 'A-1-a';
      reason := 'Fines ≤35%, Passant 2mm ≤50%';
    ELSIF passant_2mm IS NOT NULL AND passant_2mm > 50 THEN
      class := 'A-1-b';
      reason := 'Fines ≤35%, Passant 2mm >50%';
    ELSIF fines_pct <= 15 THEN
      class := 'A-3';
      reason := 'Fines ≤15% (sable fin)';
    ELSE
      -- Fines entre 15 et 35%
      IF wl IS NULL OR ip IS NULL THEN
        class := 'A-2';
        reason := 'Fines 15-35%, Atterberg manquant';
      ELSIF ip <= 10 THEN
        IF wl <= 40 THEN
          class := 'A-2-4';
          reason := 'Fines 15-35%, IP≤10, WL≤40';
        ELSE
          class := 'A-2-5';
          reason := 'Fines 15-35%, IP≤10, WL>40';
        END IF;
      ELSE
        IF wl <= 40 THEN
          class := 'A-2-6';
          reason := 'Fines 15-35%, IP>10, WL≤40';
        ELSE
          class := 'A-2-7';
          reason := 'Fines 15-35%, IP>10, WL>40';
        END IF;
      END IF;
    END IF;
    
    RETURN jsonb_build_object('class', class, 'reason', reason);
  END IF;
  
  -- Matériaux limoneux-argileux (>35% passant 0.075mm)
  IF fines_pct > 35 THEN
    IF wl IS NULL OR ip IS NULL THEN
      class := 'A-4/A-6';
      reason := 'Fines >35%, Atterberg manquant';
      RETURN jsonb_build_object('class', class, 'reason', reason);
    END IF;
    
    IF wl <= 40 THEN
      IF ip <= 10 THEN
        class := 'A-4';
        reason := 'Fines >35%, WL≤40, IP≤10';
      ELSE
        class := 'A-6';
        reason := 'Fines >35%, WL≤40, IP>10';
      END IF;
    ELSE
      -- WL > 40
      IF ip <= 10 THEN
        class := 'A-5';
        reason := 'Fines >35%, WL>40, IP≤10';
      ELSE
        -- IP > 10 et WL > 40
        -- Distinguer A-7-5 et A-7-6 selon IP vs WL-30
        IF ip <= (wl - 30) THEN
          class := 'A-7-5';
          reason := 'Fines >35%, WL>40, IP>10, IP≤WL-30';
        ELSE
          class := 'A-7-6';
          reason := 'Fines >35%, WL>40, IP>10, IP>WL-30';
        END IF;
      END IF;
    END IF;
    
    RETURN jsonb_build_object('class', class, 'reason', reason);
  END IF;
  
  RETURN jsonb_build_object('class', 'N/A', 'reason', 'Cas non géré');
END;
$$;

-- Test
-- SELECT fn_classify_aashto(42, 20, 65, 95);
-- SELECT fn_classify_aashto(NULL, NULL, 8, 45);
