-- Classification USCS simplifiée avec raison
CREATE OR REPLACE FUNCTION fn_classify_uscs(
  wl NUMERIC,
  ip NUMERIC,
  fines_pct NUMERIC,
  d10 NUMERIC,
  cu NUMERIC,
  cc NUMERIC
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
  
  -- Sols à grains fins (>50% passant 0.075mm = 80µm)
  IF fines_pct >= 50 THEN
    IF wl IS NULL OR ip IS NULL THEN
      RETURN jsonb_build_object('class', 'ML/CL', 'reason', 'Fines >50%, Atterberg manquant');
    END IF;
    
    -- Ligne A: IP = 0.73(WL - 20)
    IF ip < 0.73 * (wl - 20) THEN
      -- Sous la ligne A
      IF wl < 50 THEN
        class := 'ML';
        reason := 'Fines >50%, sous ligne A, WL<50';
      ELSE
        class := 'MH';
        reason := 'Fines >50%, sous ligne A, WL≥50';
      END IF;
    ELSE
      -- Au-dessus de la ligne A
      IF wl < 50 THEN
        class := 'CL';
        reason := 'Fines >50%, sur/au-dessus ligne A, WL<50';
      ELSE
        class := 'CH';
        reason := 'Fines >50%, sur/au-dessus ligne A, WL≥50';
      END IF;
    END IF;
    
    RETURN jsonb_build_object('class', class, 'reason', reason);
  END IF;
  
  -- Sols à grains grossiers (<50% passant 0.075mm)
  IF fines_pct < 50 THEN
    IF fines_pct < 5 THEN
      -- Sable propre
      IF cu IS NOT NULL AND cc IS NOT NULL THEN
        IF cu >= 6 AND cc >= 1 AND cc <= 3 THEN
          class := 'SW';
          reason := 'Fines <5%, Cu≥6, 1≤Cc≤3';
        ELSE
          class := 'SP';
          reason := 'Fines <5%, mal gradué';
        END IF;
      ELSE
        class := 'SP/SW';
        reason := 'Fines <5%, indices Cu/Cc manquants';
      END IF;
    ELSIF fines_pct >= 5 AND fines_pct < 12 THEN
      -- Sable avec fines (zone de transition)
      class := 'SM/SC';
      reason := '5%≤Fines<12% (zone transition)';
    ELSE
      -- Sable avec beaucoup de fines (12-50%)
      IF wl IS NOT NULL AND ip IS NOT NULL THEN
        IF ip < 0.73 * (wl - 20) THEN
          class := 'SM';
          reason := '12%≤Fines<50%, sous ligne A';
        ELSE
          class := 'SC';
          reason := '12%≤Fines<50%, sur/au-dessus ligne A';
        END IF;
      ELSE
        class := 'SM/SC';
        reason := '12%≤Fines<50%, Atterberg manquant';
      END IF;
    END IF;
    
    RETURN jsonb_build_object('class', class, 'reason', reason);
  END IF;
  
  RETURN jsonb_build_object('class', 'N/A', 'reason', 'Cas non géré');
END;
$$;

-- Test
-- SELECT fn_classify_uscs(42, 20, 65, NULL, NULL, NULL);
-- SELECT fn_classify_uscs(NULL, NULL, 3, 0.15, 8.5, 1.2);
