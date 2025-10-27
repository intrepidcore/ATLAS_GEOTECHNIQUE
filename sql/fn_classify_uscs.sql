-- Classification USCS simplifiée
CREATE OR REPLACE FUNCTION fn_classify_uscs(
  wl NUMERIC,
  ip NUMERIC,
  fines_pct NUMERIC,
  d10 NUMERIC,
  cu NUMERIC,
  cc NUMERIC
)
RETURNS JSONB AS $$
LANGUAGE plpgsql
AS $$
DECLARE
  result JSONB;
BEGIN
  IF fines_pct IS NULL THEN
    RETURN 'N/A';
  END IF;
  
  -- Sols à grains fins (>50% passant 0.075mm)
  IF fines_pct >= 50 THEN
    IF wl IS NULL OR ip IS NULL THEN
      RETURN 'ML/CL';  -- Indéterminé
    END IF;
    
    -- Ligne A: IP = 0.73(WL - 20)
    IF ip < 0.73 * (wl - 20) THEN
      -- Sous la ligne A
      IF wl < 50 THEN
        RETURN 'ML';  -- Limon peu plastique
      ELSE
        RETURN 'MH';  -- Limon très plastique
      END IF;
    ELSE
      -- Au-dessus de la ligne A
      IF wl < 50 THEN
        RETURN 'CL';  -- Argile peu plastique
      ELSE
        RETURN 'CH';  -- Argile très plastique
      END IF;
    END IF;
  END IF;
  
  -- Sols à grains grossiers (<50% passant 0.075mm)
  IF fines_pct < 50 THEN
    -- Sables (>50% passant 4.75mm)
    -- Graviers (<50% passant 4.75mm)
    -- Simplifié: on suppose sable si fines < 50%
    
    IF fines_pct < 5 THEN
      -- Sable propre
      IF cu IS NOT NULL AND cc IS NOT NULL THEN
        IF cu >= 6 AND cc >= 1 AND cc <= 3 THEN
          RETURN 'SW';  -- Sable bien gradué
        ELSE
          RETURN 'SP';  -- Sable mal gradué
        END IF;
      ELSE
        RETURN 'SP/SW';
      END IF;
    ELSIF fines_pct >= 5 AND fines_pct < 12 THEN
      -- Sable avec fines
      RETURN 'SM/SC';
    ELSE
      -- Sable avec beaucoup de fines
      IF wl IS NOT NULL AND ip IS NOT NULL THEN
        IF ip < 0.73 * (wl - 20) THEN
          RETURN 'SM';  -- Sable limoneux
        ELSE
          RETURN 'SC';  -- Sable argileux
        END IF;
      ELSE
        RETURN 'SM/SC';
      END IF;
    END IF;
  END IF;
  
  RETURN 'N/A';
END;
$$;
