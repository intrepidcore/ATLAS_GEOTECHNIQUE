-- Fonction pour calculer D10, D30, D60, Cu, Cc depuis une courbe granulométrique
CREATE OR REPLACE FUNCTION fn_granulo_indices(points JSONB)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
DECLARE
  d10 NUMERIC;
  d30 NUMERIC;
  d60 NUMERIC;
  cu NUMERIC;
  cc NUMERIC;
  point JSONB;
  sieve_mm NUMERIC;
  percent_passing NUMERIC;
  prev_sieve NUMERIC;
  prev_pct NUMERIC;
  target_pct NUMERIC;
  sorted_points JSONB;
  nb_points INT;
  result JSONB;
BEGIN
  -- Si pas de points, retourner NULL
  IF points IS NULL OR jsonb_array_length(points) = 0 THEN
    RETURN NULL;
  END IF;
  
  -- Tri et dédoublonnage des points par tamis (décroissant)
  -- Normalisation des tamis (arrondi à 4 décimales pour gérer 0.063 vs 0.0625)
  WITH normalized AS (
    SELECT DISTINCT
      ROUND((p->>'mm')::NUMERIC, 4) AS mm,
      (p->>'pct')::NUMERIC AS pct
    FROM jsonb_array_elements(points) AS p
    WHERE (p->>'mm') IS NOT NULL 
      AND (p->>'pct') IS NOT NULL
      AND (p->>'pct')::NUMERIC >= 0 
      AND (p->>'pct')::NUMERIC <= 100
  ),
  sorted AS (
    SELECT mm, pct
    FROM normalized
    ORDER BY mm DESC
  )
  SELECT jsonb_agg(jsonb_build_object('mm', mm, 'pct', pct))
  INTO sorted_points
  FROM sorted;
  
  -- Vérifier qu'on a au moins 3 points distincts
  nb_points := jsonb_array_length(sorted_points);
  IF nb_points < 3 THEN
    RETURN jsonb_build_object(
      'd10', NULL,
      'd30', NULL,
      'd60', NULL,
      'cu', NULL,
      'cc', NULL,
      'error', 'Insufficient points (< 3)'
    );
  END IF;
  
  -- Remplacer points par sorted_points pour la suite
  points := sorted_points;
  
  -- Trier les points par mm (croissant)
  sorted_points := (
    SELECT jsonb_agg(elem ORDER BY (elem->>'mm')::numeric)
    FROM jsonb_array_elements(points) elem
  );
  -- Interpolation log-linéaire pour trouver D10, D30, D60
  -- D10 = diamètre pour lequel 10% passe
  d10 := (
    SELECT 
      CASE 
        WHEN MIN((elem->>'pct')::numeric) > 10 THEN (SELECT (elem->>'mm')::numeric FROM jsonb_array_elements(sorted_points) elem ORDER BY (elem->>'mm')::numeric LIMIT 1)
        WHEN MAX((elem->>'pct')::numeric) < 10 THEN (SELECT (elem->>'mm')::numeric FROM jsonb_array_elements(sorted_points) elem ORDER BY (elem->>'mm')::numeric DESC LIMIT 1)
        ELSE (
          SELECT 
            exp(
              ln((p1->>'mm')::numeric) + 
              (10 - (p1->>'pct')::numeric) * 
              (ln((p2->>'mm')::numeric) - ln((p1->>'mm')::numeric)) / 
              ((p2->>'pct')::numeric - (p1->>'pct')::numeric)
            )
          FROM (
            SELECT 
              elem AS p1,
              LEAD(elem) OVER (ORDER BY (elem->>'mm')::numeric) AS p2
            FROM jsonb_array_elements(sorted_points) elem
          ) pairs
          WHERE (p1->>'pct')::numeric <= 10 AND (p2->>'pct')::numeric >= 10
          LIMIT 1
        )
      END
    FROM jsonb_array_elements(sorted_points) elem
  );
  
  -- D30
  d30 := (
    SELECT 
      CASE 
        WHEN MIN((elem->>'pct')::numeric) > 30 THEN (SELECT (elem->>'mm')::numeric FROM jsonb_array_elements(sorted_points) elem ORDER BY (elem->>'mm')::numeric LIMIT 1)
        WHEN MAX((elem->>'pct')::numeric) < 30 THEN (SELECT (elem->>'mm')::numeric FROM jsonb_array_elements(sorted_points) elem ORDER BY (elem->>'mm')::numeric DESC LIMIT 1)
        ELSE (
          SELECT 
            exp(
              ln((p1->>'mm')::numeric) + 
              (30 - (p1->>'pct')::numeric) * 
              (ln((p2->>'mm')::numeric) - ln((p1->>'mm')::numeric)) / 
              ((p2->>'pct')::numeric - (p1->>'pct')::numeric)
            )
          FROM (
            SELECT 
              elem AS p1,
              LEAD(elem) OVER (ORDER BY (elem->>'mm')::numeric) AS p2
            FROM jsonb_array_elements(sorted_points) elem
          ) pairs
          WHERE (p1->>'pct')::numeric <= 30 AND (p2->>'pct')::numeric >= 30
          LIMIT 1
        )
      END
    FROM jsonb_array_elements(sorted_points) elem
  );
  
  -- D60
  d60 := (
    SELECT 
      CASE 
        WHEN MIN((elem->>'pct')::numeric) > 60 THEN (SELECT (elem->>'mm')::numeric FROM jsonb_array_elements(sorted_points) elem ORDER BY (elem->>'mm')::numeric LIMIT 1)
        WHEN MAX((elem->>'pct')::numeric) < 60 THEN (SELECT (elem->>'mm')::numeric FROM jsonb_array_elements(sorted_points) elem ORDER BY (elem->>'mm')::numeric DESC LIMIT 1)
        ELSE (
          SELECT 
            exp(
              ln((p1->>'mm')::numeric) + 
              (60 - (p1->>'pct')::numeric) * 
              (ln((p2->>'mm')::numeric) - ln((p1->>'mm')::numeric)) / 
              ((p2->>'pct')::numeric - (p1->>'pct')::numeric)
            )
          FROM (
            SELECT 
              elem AS p1,
              LEAD(elem) OVER (ORDER BY (elem->>'mm')::numeric) AS p2
            FROM jsonb_array_elements(sorted_points) elem
          ) pairs
          WHERE (p1->>'pct')::numeric <= 60 AND (p2->>'pct')::numeric >= 60
          LIMIT 1
        )
      END
    FROM jsonb_array_elements(sorted_points) elem
  );
  
  -- Calcul Cu et Cc avec protection division par zéro
  IF d10 IS NOT NULL AND d60 IS NOT NULL THEN
    cu := d60 / NULLIF(d10, 0);
  END IF;
  
  IF d10 IS NOT NULL AND d30 IS NOT NULL AND d60 IS NOT NULL THEN
    cc := (d30 * d30) / NULLIF(d10 * d60, 0);
  END IF;
  
  -- Construire le résultat
  result := jsonb_build_object(
    'd10', d10,
    'd30', d30,
    'd60', d60,
    'cu', cu,
    'cc', cc
  );
  
  RETURN result;
END;
$$;

-- Test
-- SELECT fn_granulo_indices('[
--   {"mm": 2, "pct": 98},
--   {"mm": 0.5, "pct": 80},
--   {"mm": 0.25, "pct": 65},
--   {"mm": 0.125, "pct": 45},
--   {"mm": 0.063, "pct": 12}
-- ]'::jsonb);
