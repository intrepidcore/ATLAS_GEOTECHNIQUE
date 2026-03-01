-- Migration 104: Création du catalogue de styles pour couches contextuelles
-- Permet de gérer les couleurs et labels depuis la BDD (comme QGIS)

BEGIN;

-- Table principale des styles par couche
CREATE TABLE IF NOT EXISTS atlas.layer_style (
    layer_id       text NOT NULL,       -- 'geologie' | 'pedologie' | 'risque'
    unit_code      text NOT NULL,       -- code provenant de la couche
    unit_label     text NOT NULL,       -- libellé lisible
    color_hex      text NOT NULL,       -- '#fef0d9' etc.
    sort_order     integer NOT NULL DEFAULT 0,
    is_default_on  boolean NOT NULL DEFAULT true,
    created_at     timestamptz DEFAULT now(),
    PRIMARY KEY (layer_id, unit_code)
);

-- Index pour recherches rapides
CREATE INDEX IF NOT EXISTS idx_layer_style_layer_id ON atlas.layer_style(layer_id);

-- Vider les anciennes données si existantes (pour re-exécution)
DELETE FROM atlas.layer_style WHERE layer_id IN ('geologie', 'pedologie', 'risque');

-- ============================================
-- GÉOLOGIE - 21 unités avec palette terre/roche
-- ============================================
INSERT INTO atlas.layer_style (layer_id, unit_code, unit_label, color_hex, sort_order) VALUES
-- Bassin des Volta (marrons/oranges)
('geologie', 'VOLTA_GANDO', 'Bassin des Volta Grès de Gando', '#fef0d9', 1),
('geologie', 'VOLTA_MANGO', 'Bassin des Volta Shales de Mango', '#fdcc8a', 2),
('geologie', 'VOLTA_SILEX', 'Bassin des Volta Silexites', '#fc8d59', 3),
-- Chaîne Dahomeyides (verts/bruns)
('geologie', 'DAHOM_KABYE', 'Chaîne Dahomeyides Complexe de l''Axe Kabyè-Sotouboua-Agou', '#91cf60', 4),
('geologie', 'DAHOM_KABYE2', 'Chaîne Dahomeyides Complexe de l''Azé Kabyè-Sotouboua-Agou', '#91cf60', 5),
('geologie', 'DAHOM_BASSAR', 'Chaîne Dahomeyides Grès de Bassar', '#d9ef8b', 6),
('geologie', 'DAHOM_COLLINES', 'Chaîne Dahomeyides Gres des Collines', '#a6d96a', 7),
('geologie', 'DAHOM_ATACORA_M', 'Chaîne Dahomeyides Micaschistes de Atacora', '#66bd63', 8),
('geologie', 'DAHOM_ATACORA_Q', 'Chaîne Dahomeyides Quartzites de l''Atacora', '#1a9850', 9),
('geologie', 'DAHOM_KANTE', 'Chaîne Dahomeyides Schistes de Kanté', '#006837', 10),
('geologie', 'DAHOM_BASSAR_SH', 'Chaîne Dahomeyides Shales de Bassar', '#4d9221', 11),
-- Mésozoïque-Cénozoïque (bleus/gris)
('geologie', 'MESO_ALLUV', 'Mésozoïque-Cénozoïque Alluvionnaires', '#c6dbef', 12),
('geologie', 'MESO_CUIR', 'Mésozoïque-Cénozoïque Cuirasses', '#9ecae1', 13),
('geologie', 'MESO_BASTOGO', 'Mésozoïque-Cénozoïque Sédimentaire du Bas Togo', '#6baed6', 14),
('geologie', 'MESO_PETITES', 'Mésozoïque-Cénozoïque Unités peu étendues', '#4292c6', 15),
-- Plaine Benino-Togolaise (roses/violets)
('geologie', 'PLAINE_GNEISS', 'Plaine Benino-Togolaise Gneiss de la Plaine Benino-Togolaise', '#f1b6da', 16),
('geologie', 'PLAINE_GRANIT', 'Plaine Benino-Togolaise Granites et granodiorites de la Plaine Benino-Togolaise', '#de77ae', 17),
('geologie', 'PLAINE_META', 'Plaine Benino-Togolaise Metadiorites - Metatonalites', '#c51b7d', 18),
('geologie', 'PLAINE_ORTHO', 'Plaine Benino-Togolaise Orthogneiss de Kara', '#8e0152', 19),
-- Zone Nord Dapaong (jaunes)
('geologie', 'DAPAONG_GRAN', 'Zone Nord Dapaong Granodiorites Dapaong', '#ffffb2', 20),
('geologie', 'DAPAONG_MIGM', 'Zone Nord Dapaong Migmatites Dapaong', '#fed976', 21);

-- ============================================
-- PÉDOLOGIE - 13 types de sols avec palette sols
-- ============================================
INSERT INTO atlas.layer_style (layer_id, unit_code, unit_label, color_hex, sort_order) VALUES
-- Sols ferralitiques (roses/rouges)
('pedologie', 'FERRA_INDUR', 'Sols ferralitiques indurés', '#ff6b6b', 1),
('pedologie', 'FERRA_NON', 'Sols ferralitiques non indurés', '#ee5a5a', 2),
-- Sols ferrugineux (oranges/jaunes)  
('pedologie', 'FERRU_FAIBLE_COND', 'Sols ferrugineux tropicaux lessivés sur faible profondeur conditionés', '#ffa94d', 3),
('pedologie', 'FERRU_FAIBLE_HYDRO', 'Sols ferrugineux tropicaux lessivés sur faible profondeur hydromorphes', '#ffc078', 4),
('pedologie', 'FERRU_FAIBLE_INDUR', 'Sols ferrugineux tropicaux lessivés sur faible profondeur indurés', '#ffe066', 5),
('pedologie', 'FERRU_GRANDE_CONCR', 'Sols ferrugineux tropicaux lessivés sur grande profondeur concrétionnés', '#ffd43b', 6),
-- Sols hydromorphes (bleus)
('pedologie', 'HYDRO_GLEY_SALE', 'Sols hydromorphes humifères à gley, salés', '#4dabf7', 7),
('pedologie', 'HYDRO_GLEY', 'Sols hydromorphes peu humifères à gley', '#74c0fc', 8),
-- Sols peu évolués (gris/beiges)
('pedologie', 'PEU_APPORT', 'Sols peu évolués d''apport', '#ced4da', 9),
('pedologie', 'PEU_EROSION', 'Sol peu évolués d''érosion', '#adb5bd', 10),
('pedologie', 'PEU_EROSION2', 'Sols peu évolués d''érrosion', '#adb5bd', 11),
-- Vertisols (verts)
('pedologie', 'VERTI', 'Vertisols et sols à caractères vertiques', '#69db7c', 12);

-- ============================================
-- RISQUE DE GONFLEMENT - 5 niveaux avec gradient
-- ============================================
INSERT INTO atlas.layer_style (layer_id, unit_code, unit_label, color_hex, sort_order) VALUES
('risque', 'TRES_FAIBLE', 'Risque Très Faible', '#d4edda', 1),
('risque', 'FAIBLE', 'Risque Faible', '#fff3cd', 2),
('risque', 'MOYEN', 'Risque Moyen', '#ffeeba', 3),
('risque', 'ELEVE', 'Risque Élevé', '#f5c6cb', 4),
('risque', 'TRES_ELEVE', 'Risque Très Élevé', '#f8d7da', 5);

-- Créer une vue pour mapper les libellés vers les codes
CREATE OR REPLACE VIEW atlas.v_geologie_style_map AS
SELECT 
    ls.unit_code,
    ls.unit_label,
    ls.color_hex,
    ls.sort_order
FROM atlas.layer_style ls
WHERE ls.layer_id = 'geologie'
ORDER BY ls.sort_order;

CREATE OR REPLACE VIEW atlas.v_pedologie_style_map AS
SELECT 
    ls.unit_code,
    ls.unit_label,
    ls.color_hex,
    ls.sort_order
FROM atlas.layer_style ls
WHERE ls.layer_id = 'pedologie'
ORDER BY ls.sort_order;

CREATE OR REPLACE VIEW atlas.v_risque_style_map AS
SELECT 
    ls.unit_code,
    ls.unit_label,
    ls.color_hex,
    ls.sort_order
FROM atlas.layer_style ls
WHERE ls.layer_id = 'risque'
ORDER BY ls.sort_order;

COMMIT;

-- Vérification
SELECT layer_id, COUNT(*) as nb_styles FROM atlas.layer_style GROUP BY layer_id ORDER BY layer_id;
