-- Migration 006: Création des tables ADM1/2/3 pour les divisions administratives du Togo
-- Version: 1.2.0
-- Date: 2025-10-17

-- ============================================================================
-- 1. Table ADM1 (Régions)
-- ============================================================================

CREATE TABLE IF NOT EXISTS adm1_tg (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL UNIQUE,
    name_en TEXT,
    code TEXT,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_adm1_tg_geom ON adm1_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm1_tg_name ON adm1_tg(name);

COMMENT ON TABLE adm1_tg IS 'Régions administratives du Togo (niveau 1)';

-- ============================================================================
-- 2. Table ADM2 (Préfectures)
-- ============================================================================

CREATE TABLE IF NOT EXISTS adm2_tg (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    code TEXT,
    adm1_name TEXT,
    adm1_code TEXT,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(name, adm1_name)
);

CREATE INDEX IF NOT EXISTS idx_adm2_tg_geom ON adm2_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm2_tg_name ON adm2_tg(name);
CREATE INDEX IF NOT EXISTS idx_adm2_tg_adm1 ON adm2_tg(adm1_name);

COMMENT ON TABLE adm2_tg IS 'Préfectures du Togo (niveau 2)';

-- ============================================================================
-- 3. Table ADM3 (Communes)
-- ============================================================================

CREATE TABLE IF NOT EXISTS adm3_tg (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    name_en TEXT,
    code TEXT,
    adm2_name TEXT,
    adm2_code TEXT,
    adm1_name TEXT,
    adm1_code TEXT,
    geom geometry(MultiPolygon, 4326) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(name, adm2_name, adm1_name)
);

CREATE INDEX IF NOT EXISTS idx_adm3_tg_geom ON adm3_tg USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_name ON adm3_tg(name);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_adm2 ON adm3_tg(adm2_name);
CREATE INDEX IF NOT EXISTS idx_adm3_tg_adm1 ON adm3_tg(adm1_name);

COMMENT ON TABLE adm3_tg IS 'Communes du Togo (niveau 3)';

-- ============================================================================
-- FIN MIGRATION 006
-- ============================================================================
