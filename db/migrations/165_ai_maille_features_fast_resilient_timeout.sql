BEGIN;

CREATE OR REPLACE FUNCTION atlas.refresh_ai_maille_features_fast_resilient_for_codes(
  codes text[],
  mode text DEFAULT 'auto',
  full_timeout_ms integer DEFAULT 30000
)
RETURNS bigint
LANGUAGE plpgsql
AS $$
DECLARE
  n bigint;
  c text;
  m text;
  timeout_ms integer;
BEGIN
  n := 0;
  m := lower(COALESCE(mode, 'auto'));
  timeout_ms := GREATEST(COALESCE(full_timeout_ms, 30000), 1000);

  FOREACH c IN ARRAY codes LOOP
    IF c IS NULL OR length(trim(c)) = 0 THEN
      CONTINUE;
    END IF;

    IF m = 'lightweight' THEN
      n := n + atlas.refresh_ai_maille_features_fast_lightweight_for_code(c);
    ELSIF m = 'full' THEN
      PERFORM set_config('statement_timeout', timeout_ms::text || 'ms', true);
      n := n + atlas.refresh_ai_maille_features_fast_for_code(c);
      PERFORM set_config('statement_timeout', '0', true);
    ELSE
      BEGIN
        PERFORM set_config('statement_timeout', timeout_ms::text || 'ms', true);
        n := n + atlas.refresh_ai_maille_features_fast_for_code(c);
        PERFORM set_config('statement_timeout', '0', true);
      EXCEPTION
        WHEN query_canceled THEN
          PERFORM set_config('statement_timeout', '0', true);
          n := n + atlas.refresh_ai_maille_features_fast_lightweight_for_code(c);
        WHEN OTHERS THEN
          PERFORM set_config('statement_timeout', '0', true);
          n := n + atlas.refresh_ai_maille_features_fast_lightweight_for_code(c);
      END;
    END IF;
  END LOOP;

  RETURN n;
END;
$$;

COMMIT;
