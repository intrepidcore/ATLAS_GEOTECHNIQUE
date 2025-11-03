-- Créer la table grid si elle n'existe pas
CREATE TABLE IF NOT EXISTS grid (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(50) UNIQUE NOT NULL,
    geom GEOMETRY(Polygon, 4326) NOT NULL,
    adm1_name VARCHAR(100),
    adm2_name VARCHAR(100),
    adm3_name VARCHAR(100),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ,
    deleted_at TIMESTAMPTZ
);

-- Index spatial
CREATE INDEX IF NOT EXISTS idx_grid_geom ON grid USING GIST(geom);
CREATE INDEX IF NOT EXISTS idx_grid_code ON grid(code);

-- Générer une grille de test si vide (mailles de 0.1° x 0.1°)
INSERT INTO grid (code, geom, adm1_name)
SELECT 
    format('TG-%s%s-%s%s', 
        LPAD(CAST(floor((lon + 180) * 10) AS TEXT), 4, '0'),
        LPAD(CAST(floor((lat + 90) * 10) AS TEXT), 4, '0'),
        LPAD(CAST(floor((lon + 180) * 10 + 1) AS TEXT), 4, '0'),
        LPAD(CAST(floor((lat + 90) * 10 + 1) AS TEXT), 4, '0')
    ) as code,
    ST_MakeEnvelope(lon, lat, lon + 0.1, lat + 0.1, 4326) as geom,
    CASE 
        WHEN lat BETWEEN 6.0 AND 6.5 THEN 'Maritime'
        WHEN lat BETWEEN 6.5 AND 7.5 THEN 'Plateaux'
        WHEN lat BETWEEN 7.5 AND 8.5 THEN 'Centrale'
        WHEN lat BETWEEN 8.5 AND 9.5 THEN 'Kara'
        WHEN lat BETWEEN 9.5 AND 11.0 THEN 'Savanes'
    END as adm1_name
FROM generate_series(0.0, 1.5, 0.1) as lon,
     generate_series(6.0, 11.0, 0.1) as lat
WHERE NOT EXISTS (SELECT 1 FROM grid LIMIT 1);

-- Maintenant créer la vue matérialisée
DROP MATERIALIZED VIEW IF EXISTS grid_stats_geotechnical CASCADE;

CREATE MATERIALIZED VIEW grid_stats_geotechnical AS
SELECT 
    g.id as grid_id,
    g.code as grid_code,
    g.geom,
    
    -- Compteurs
    COUNT(DISTINCT s.id) as n_sondages,
    COUNT(eg.id) as n_essais_geo,
    
    -- Granulométrie - Passant 80µm
    AVG(eg.passant_80um) as passant_80um_avg,
    STDDEV(eg.passant_80um) as passant_80um_stddev,
    MIN(eg.passant_80um) as passant_80um_min,
    MAX(eg.passant_80um) as passant_80um_max,
    
    -- Granulométrie - Passant 2mm
    AVG(eg.passant_2mm) as passant_2mm_avg,
    STDDEV(eg.passant_2mm) as passant_2mm_stddev,
    MIN(eg.passant_2mm) as passant_2mm_min,
    MAX(eg.passant_2mm) as passant_2mm_max,
    
    -- Granulométrie - Passant 20mm
    AVG(eg.passant_20mm) as passant_20mm_avg,
    STDDEV(eg.passant_20mm) as passant_20mm_stddev,
    MIN(eg.passant_20mm) as passant_20mm_min,
    MAX(eg.passant_20mm) as passant_20mm_max,
    
    -- Atterberg - WL
    AVG(eg.wl) as wl_avg,
    STDDEV(eg.wl) as wl_stddev,
    MIN(eg.wl) as wl_min,
    MAX(eg.wl) as wl_max,
    
    -- Atterberg - WP
    AVG(eg.wp) as wp_avg,
    STDDEV(eg.wp) as wp_stddev,
    MIN(eg.wp) as wp_min,
    MAX(eg.wp) as wp_max,
    
    -- Atterberg - IP (calculé)
    AVG(eg.wl - eg.wp) as ip_avg,
    STDDEV(eg.wl - eg.wp) as ip_stddev,
    MIN(eg.wl - eg.wp) as ip_min,
    MAX(eg.wl - eg.wp) as ip_max,
    
    -- VBS
    AVG(eg.vbs) as vbs_avg,
    STDDEV(eg.vbs) as vbs_stddev,
    MIN(eg.vbs) as vbs_min,
    MAX(eg.vbs) as vbs_max,
    
    -- Proctor - Gamma d max
    AVG(eg.gamma_d_max) as gamma_d_max_avg,
    STDDEV(eg.gamma_d_max) as gamma_d_max_stddev,
    MIN(eg.gamma_d_max) as gamma_d_max_min,
    MAX(eg.gamma_d_max) as gamma_d_max_max,
    
    -- Proctor - W opt
    AVG(eg.w_opt) as w_opt_avg,
    STDDEV(eg.w_opt) as w_opt_stddev,
    MIN(eg.w_opt) as w_opt_min,
    MAX(eg.w_opt) as w_opt_max,
    
    -- Gonflement - Eg
    AVG(eg.eg) as eg_avg,
    STDDEV(eg.eg) as eg_stddev,
    MIN(eg.eg) as eg_min,
    MAX(eg.eg) as eg_max
    
FROM grid g
LEFT JOIN sondages s ON ST_Intersects(g.geom, s.geom) AND s.deleted_at IS NULL
LEFT JOIN essais_geotechniques eg ON eg.sondage_id = s.id
GROUP BY g.id, g.code, g.geom;

-- Index pour performance
CREATE INDEX idx_grid_stats_geo_grid_id ON grid_stats_geotechnical(grid_id);
CREATE INDEX idx_grid_stats_geo_geom ON grid_stats_geotechnical USING GIST(geom);

-- Statistiques
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais
FROM grid_stats_geotechnical;
