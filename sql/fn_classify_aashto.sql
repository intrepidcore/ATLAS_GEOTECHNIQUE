-- Classification AASHTO (HRB) simplifiée
CREATE OR REPLACE FUNCTION fn_classify_aashto(
  wl NUMERIC,
  ip NUMERIC,
  fines_pct NUMERIC,  -- % passant 0.075mm (75µm)
  passant_2mm NUMERIC
)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
BEGIN
  -- Si pas assez de données
  IF fines_pct IS NULL THEN
    RETURN 'N/A';
  END IF;
  
  -- A-1: Matériaux granulaires (fines <= 35%)
  IF fines_pct <= 35 THEN
    IF fines_pct <= 15 THEN
      RETURN 'A-1-a';
    ELSE
      RETURN 'A-1-b';
    END IF;
  END IF;
  
  -- A-2: Matériaux granulaires avec fines (35% < fines <= 35%)
  IF fines_pct > 35 AND fines_pct <= 35 THEN
    IF ip IS NULL OR wl IS NULL THEN
      RETURN 'A-2';
    END IF;
    
    IF ip <= 10 THEN
      RETURN 'A-2-4';
    ELSE
      RETURN 'A-2-6';
    END IF;
  END IF;
  
  -- Sols fins (fines > 35%)
  IF fines_pct > 35 THEN
    IF wl IS NULL OR ip IS NULL THEN
      RETURN 'A-4/A-6/A-7';
    END IF;
    
    -- A-4: Sols limoneux (WL <= 40)
    IF wl <= 40 THEN
      RETURN 'A-4';
    END IF;
    
    -- A-5: Sols limoneux (WL > 40, IP <= 10)
    IF wl > 40 AND ip <= 10 THEN
      RETURN 'A-5';
    END IF;
    
    -- A-6: Sols argileux (WL <= 40, IP > 10)
    IF wl <= 40 AND ip > 10 THEN
      RETURN 'A-6';
    END IF;
    
    -- A-7: Sols argileux (WL > 40, IP > 10)
    IF wl > 40 AND ip > 10 THEN
      IF ip <= (wl - 30) THEN
        RETURN 'A-7-5';
      ELSE
        RETURN 'A-7-6';
      END IF;
    END IF;
  END IF;
  
  RETURN 'N/A';
END;
$$;
