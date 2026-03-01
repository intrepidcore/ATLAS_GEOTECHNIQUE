-- ============================================================================
-- Migration 004: Optimisations pour v1.3.0
-- Date: 2025-01-18
-- Description: Index et optimisations pour les nouvelles fonctionnalités
-- ============================================================================

-- 1. Index spatiaux pour les requêtes bbox
-- ============================================================================

-- Index GIST sur la géométrie des mailles (si pas déjà présent)
CREATE INDEX IF NOT EXISTS idx_mailles_geom_gist 
ON mailles USING GIST (geom);

-- Index GIST sur la géométrie des sondages
CREATE INDEX IF NOT EXISTS idx_sondages_geom_gist 
ON sondages USING GIST (geom);

-- Index pour les requêtes ST_Within (sondages dans mailles)
CREATE INDEX IF NOT EXISTS idx_sondages_geom_4326_gist 
ON sondages USING GIST (ST_Transform(geom, 4326));

-- 2. Index pour les filtres ADM
-- ============================================================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mailles' AND column_name = 'adm1_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_adm1_name ON mailles (adm1_name) WHERE adm1_name IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mailles' AND column_name = 'adm2_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_adm2_name ON mailles (adm2_name) WHERE adm2_name IS NOT NULL';
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mailles' AND column_name = 'adm3_name'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_adm3_name ON mailles (adm3_name) WHERE adm3_name IS NOT NULL';
  END IF;

  -- Index composite pour les filtres combinés (uniquement si les 3 colonnes existent)
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mailles' AND column_name IN ('adm1_name','adm2_name','adm3_name')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 3
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mailles_adm_composite ON mailles (adm1_name, adm2_name, adm3_name)';
  END IF;
END $$;

-- 3. Index pour les essais (profondeur et type)
-- ============================================================================

-- Index sur le type d'essai pour les filtres
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'essais' AND column_name = 'type'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_essais_type ON essais (type) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_essais_sondage_type_depth ON essais (sondage_id, type, depth_m) WHERE deleted_at IS NULL';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'essais' AND column_name = 'test_type'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_essais_type ON essais (test_type) WHERE deleted_at IS NULL';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_essais_sondage_type_depth ON essais (sondage_id, test_type, depth_m) WHERE deleted_at IS NULL';
  END IF;
END $$;

-- Index sur la profondeur pour les filtres de profondeur
CREATE INDEX IF NOT EXISTS idx_essais_depth_m 
ON essais (depth_m) 
WHERE deleted_at IS NULL;

-- 4. Index pour l'audit log
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_audit_log_entity 
ON audit_log (entity);

CREATE INDEX IF NOT EXISTS idx_audit_log_entity_id 
ON audit_log (entity_id);

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'created_at'
  ) THEN
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (created_at DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_entity_created ON audit_log (entity, created_at DESC)';
  ELSIF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'audit_log' AND column_name = 'ts'
  ) THEN
    -- Fallback pour les schémas qui utilisent ts (ex: bootstrap desktop)
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_created_at ON audit_log (ts DESC)';
    EXECUTE 'CREATE INDEX IF NOT EXISTS idx_audit_log_entity_created ON audit_log (entity, ts DESC)';
  END IF;
END $$;

-- 5. Index pour les sondages
-- ============================================================================

-- Index sur maille_code pour les jointures
CREATE INDEX IF NOT EXISTS idx_sondages_maille_code 
ON sondages (maille_code) 
WHERE deleted_at IS NULL;

-- Index sur deleted_at pour les soft deletes
CREATE INDEX IF NOT EXISTS idx_sondages_deleted_at 
ON sondages (deleted_at) 
WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_essais_deleted_at 
ON essais (deleted_at) 
WHERE deleted_at IS NULL;

-- 6. Statistiques et ANALYZE
-- ============================================================================

-- Mettre à jour les statistiques pour l'optimiseur
ANALYZE mailles;
ANALYZE sondages;
ANALYZE essais;
ANALYZE audit_log;

-- 7. Vues matérialisées pour les statistiques (optionnel)
-- ============================================================================

-- Vue matérialisée pour les statistiques par maille
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'mailles' AND column_name IN ('code','adm1_name','adm2_name','adm3_name','geom')
    GROUP BY table_schema, table_name
    HAVING COUNT(*) = 5
  ) THEN
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'essais' AND column_name = 'type'
    ) THEN
      EXECUTE $sql$
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mailles_stats AS
        SELECT 
            m.code,
            m.adm1_name,
            m.adm2_name,
            m.adm3_name,
            COUNT(DISTINCT s.id) as n_sondages,
            COUNT(e.id) as n_essais,
            AVG(CASE WHEN e.type = 'SPT_N' THEN e.value::numeric ELSE NULL END) as spt_n_avg,
            AVG(CASE WHEN e.type = 'qc' THEN e.value::numeric ELSE NULL END) as qc_avg,
            COUNT(CASE WHEN e.depth_m >= 0 AND e.depth_m < 5 THEN 1 END) as n_depth_0_5,
            COUNT(CASE WHEN e.depth_m >= 5 AND e.depth_m < 10 THEN 1 END) as n_depth_5_10,
            COUNT(CASE WHEN e.depth_m >= 10 THEN 1 END) as n_depth_10plus,
            COUNT(CASE WHEN e.type = 'SPT_N' THEN 1 END) as n_spt_n,
            COUNT(CASE WHEN e.type = 'qc' THEN 1 END) as n_qc
        FROM mailles m
        LEFT JOIN sondages s ON ST_Within(s.geom, m.geom) AND s.deleted_at IS NULL
        LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
        GROUP BY m.code, m.adm1_name, m.adm2_name, m.adm3_name
      $sql$;
    ELSIF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'essais' AND column_name = 'test_type'
    ) THEN
      EXECUTE $sql$
        CREATE MATERIALIZED VIEW IF NOT EXISTS mv_mailles_stats AS
        SELECT 
            m.code,
            m.adm1_name,
            m.adm2_name,
            m.adm3_name,
            COUNT(DISTINCT s.id) as n_sondages,
            COUNT(e.id) as n_essais,
            AVG(CASE WHEN e.test_type = 'SPT_N' THEN e.value::numeric ELSE NULL END) as spt_n_avg,
            AVG(CASE WHEN e.test_type = 'qc' THEN e.value::numeric ELSE NULL END) as qc_avg,
            COUNT(CASE WHEN e.depth_m >= 0 AND e.depth_m < 5 THEN 1 END) as n_depth_0_5,
            COUNT(CASE WHEN e.depth_m >= 5 AND e.depth_m < 10 THEN 1 END) as n_depth_5_10,
            COUNT(CASE WHEN e.depth_m >= 10 THEN 1 END) as n_depth_10plus,
            COUNT(CASE WHEN e.test_type = 'SPT_N' THEN 1 END) as n_spt_n,
            COUNT(CASE WHEN e.test_type = 'qc' THEN 1 END) as n_qc
        FROM mailles m
        LEFT JOIN sondages s ON ST_Within(s.geom, m.geom) AND s.deleted_at IS NULL
        LEFT JOIN essais e ON e.sondage_id = s.id AND e.deleted_at IS NULL
        GROUP BY m.code, m.adm1_name, m.adm2_name, m.adm3_name
      $sql$;
    END IF;

    IF EXISTS (SELECT 1 FROM pg_class WHERE relname = 'mv_mailles_stats') THEN
      EXECUTE 'CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_mailles_stats_code ON mv_mailles_stats (code)';
      EXECUTE 'CREATE INDEX IF NOT EXISTS idx_mv_mailles_stats_adm1 ON mv_mailles_stats (adm1_name)';
    END IF;
  END IF;
END $$;

-- 8. Fonction pour rafraîchir les statistiques
-- ============================================================================

CREATE OR REPLACE FUNCTION refresh_mailles_stats()
RETURNS void AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_stats;
END;
$$ LANGUAGE plpgsql;

-- 9. Commentaires pour documentation
-- ============================================================================

COMMENT ON INDEX idx_mailles_geom_gist IS 'Index spatial GIST pour requêtes bbox sur mailles';
COMMENT ON INDEX idx_sondages_geom_gist IS 'Index spatial GIST pour requêtes spatiales sur sondages';
COMMENT ON INDEX idx_essais_type IS 'Index pour filtrage par type d''essai (SPT_N, qc)';
COMMENT ON INDEX idx_essais_depth_m IS 'Index pour filtrage par profondeur';
COMMENT ON INDEX idx_audit_log_created_at IS 'Index pour tri chronologique de l''historique';
COMMENT ON MATERIALIZED VIEW mv_mailles_stats IS 'Vue matérialisée des statistiques par maille pour performance';
COMMENT ON FUNCTION refresh_mailles_stats() IS 'Rafraîchit les statistiques matérialisées (à exécuter périodiquement)';

-- 10. Requêtes d'analyse de performance
-- ============================================================================

-- Pour analyser les performances, exécuter:
-- EXPLAIN ANALYZE SELECT ... FROM mailles WHERE ...;

-- Exemples de requêtes à analyser:

-- Requête bbox
-- EXPLAIN ANALYZE
-- SELECT * FROM mailles 
-- WHERE ST_Intersects(
--     ST_Transform(geom, 4326), 
--     ST_MakeEnvelope(0.5, 6.0, 1.5, 7.0, 4326)
-- );

-- Requête voisins
-- EXPLAIN ANALYZE
-- SELECT * FROM mailles
-- WHERE ST_DWithin(
--     ST_Transform(geom, 4326)::geography,
--     ST_SetSRID(ST_MakePoint(1.0, 6.0), 4326)::geography,
--     5000
-- );

-- Requête statistiques
-- EXPLAIN ANALYZE
-- SELECT 
--     m.code,
--     COUNT(DISTINCT s.id) as n_sondages,
--     AVG(CASE WHEN e.type = 'SPT_N' THEN e.value::numeric END) as spt_avg
-- FROM mailles m
-- LEFT JOIN sondages s ON ST_Within(s.geom, m.geom)
-- LEFT JOIN essais e ON e.sondage_id = s.id
-- GROUP BY m.code;

-- ============================================================================
-- Fin de la migration 004
-- ============================================================================

-- Pour appliquer cette migration:
-- psql -U postgres -d atlas_db -f 004_optimize_indexes_v1.3.0.sql

-- Pour vérifier les index:
-- SELECT schemaname, tablename, indexname, indexdef 
-- FROM pg_indexes 
-- WHERE tablename IN ('mailles', 'sondages', 'essais', 'audit_log')
-- ORDER BY tablename, indexname;

-- Pour voir la taille des index:
-- SELECT 
--     schemaname,
--     tablename,
--     indexname,
--     pg_size_pretty(pg_relation_size(indexrelid)) as index_size
-- FROM pg_stat_user_indexes
-- WHERE schemaname = 'public'
-- ORDER BY pg_relation_size(indexrelid) DESC;
