BEGIN;

-- Bloc C — Pipeline unique : DSM cache → features rapides → contexte IA (pour ML stable).

CREATE OR REPLACE FUNCTION atlas.refresh_atlas_ml_prereqs()
RETURNS jsonb
LANGUAGE plpgsql
VOLATILE
AS $$
DECLARE
  dsm_n bigint;
  feat_n bigint;
  ctx_n integer;
BEGIN
  SELECT atlas.refresh_dsm_maille_flat_cache() INTO dsm_n;
  SELECT atlas.refresh_ai_maille_features_fast() INTO feat_n;
  SELECT atlas.refresh_ai_context_features_maille() INTO ctx_n;

  RETURN jsonb_build_object(
    'dsm_cache_rows_upserted', dsm_n,
    'ai_maille_features_fast_rows_upserted', feat_n,
    'ai_context_features_mailles_refreshed', ctx_n,
    'ok', true
  );
END;
$$;

COMMENT ON FUNCTION atlas.refresh_atlas_ml_prereqs() IS
  'Rafraîchit DSM matérialisé, cache ai_maille_features_fast et features contextuelles par maille (ordre optimisé).';

COMMIT;
