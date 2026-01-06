-- ============================================================================
-- Migration 080: Création de la maille 28km (Architecture Atlas) - VERSION CORRIGÉE
-- Description:
--   1. Création de la table atlas.maille_28km
--   2. Génération des mailles 28km alignées sur atlas.mailles (2km)
--   3. Ajout des profils et PK (comme dans la thèse)
--   4. Liaison avec atlas.mailles et atlas.sondages
--   5. CORRECTION: Utilise atlas.boundary_togo si disponible, sinon garde toutes les mailles
-- ============================================================================

BEGIN;

-- 1. Création de la table maille_28km
CREATE TABLE IF NOT EXISTS atlas.maille_28km (
    id_m28          serial PRIMARY KEY,
    code_m28        integer UNIQUE,
    profil_num      integer,
    pk_min_km       numeric(6,1),
    pk_max_km       numeric(6,1),
    geom            geometry(Polygon, 25231)
);

CREATE INDEX IF NOT EXISTS maille_28km_geom_idx ON atlas.maille_28km USING GIST (geom);
CREATE INDEX IF NOT EXISTS maille_28km_profil_idx ON atlas.maille_28km (profil_num);

COMMENT ON TABLE atlas.maille_28km IS 'Maille 28x28km pour analyse régionale (Architecture Atlas)';
COMMENT ON COLUMN atlas.maille_28km.profil_num IS 'Numéro de profil Sud-Nord (1..21)';

-- 2. Génération des mailles 28km
-- Supprimer les contraintes FK temporairement pour éviter CASCADE
ALTER TABLE atlas.mailles DROP CONSTRAINT IF EXISTS fk_mailles_maille28km;
ALTER TABLE atlas.sondages DROP CONSTRAINT IF EXISTS fk_sondage_maille28km;

TRUNCATE TABLE atlas.maille_28km;

WITH bounds AS (
    SELECT
        MIN(ST_XMin(geom)) AS xmin,
        MIN(ST_YMin(geom)) AS ymin
    FROM atlas.mailles
),
grille_index AS (
    SELECT
        m.id,
        m.geom,
        FLOOR((ST_XMin(m.geom) - b.xmin) / 28000.0)::int AS col28,
        FLOOR((ST_YMin(m.geom) - b.ymin) / 28000.0)::int AS row28
    FROM atlas.mailles m
    CROSS JOIN bounds b
),
mailles_28km_brut AS (
    SELECT
        row28,
        col28,
        ST_SetSRID(ST_Envelope(ST_Collect(geom)), 25231)::geometry(Polygon, 25231) AS geom
    FROM grille_index
    GROUP BY row28, col28
)
INSERT INTO atlas.maille_28km (geom)
SELECT geom
FROM mailles_28km_brut;

-- Filtrage par boundary_togo (si disponible) ou adm0_raw (fallback)
-- CORRECTION: Ne supprime que si la table boundary existe ET contient des données
DO $$
DECLARE
    v_has_boundary boolean;
    v_boundary_count int;
BEGIN
    -- Vérifier si atlas.boundary_togo existe
    SELECT EXISTS(
        SELECT 1 FROM information_schema.tables 
        WHERE table_schema='atlas' AND table_name='boundary_togo'
    ) INTO v_has_boundary;
    
    IF v_has_boundary THEN
        SELECT COUNT(*) INTO v_boundary_count FROM atlas.boundary_togo;
        
        IF v_boundary_count > 0 THEN
            -- Utiliser boundary_togo (déjà en SRID 25231)
            DELETE FROM atlas.maille_28km m
            WHERE NOT EXISTS (
                SELECT 1 FROM atlas.boundary_togo b
                WHERE ST_Intersects(m.geom, b.geom)
            );
            RAISE NOTICE 'Filtrage avec atlas.boundary_togo appliqué';
        ELSE
            RAISE NOTICE 'atlas.boundary_togo existe mais est vide - pas de filtrage';
        END IF;
    ELSE
        -- Fallback: essayer public.adm0_raw
        IF EXISTS(SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='adm0_raw') THEN
            SELECT COUNT(*) INTO v_boundary_count FROM public.adm0_raw;
            
            IF v_boundary_count > 0 THEN
                DELETE FROM atlas.maille_28km m
                WHERE NOT EXISTS (
                    SELECT 1 FROM public.adm0_raw a
                    WHERE ST_Intersects(m.geom, ST_Transform(a.geom, 25231))
                );
                RAISE NOTICE 'Filtrage avec public.adm0_raw appliqué';
            ELSE
                RAISE NOTICE 'public.adm0_raw existe mais est vide - pas de filtrage';
            END IF;
        ELSE
            RAISE NOTICE 'Aucune boundary disponible - toutes les mailles 28km conservées';
        END IF;
    END IF;
END $$;

-- Attribuer un code_m28 unique
WITH numbered AS (
    SELECT id_m28, ROW_NUMBER() OVER (ORDER BY ST_YMin(geom), ST_XMin(geom)) as rn
    FROM atlas.maille_28km
)
UPDATE atlas.maille_28km m
SET code_m28 = n.rn
FROM numbered n
WHERE m.id_m28 = n.id_m28;

-- 3. Calcul des profils et PK
WITH bounds AS (
    SELECT MIN(ST_YMin(geom)) AS ymin
    FROM atlas.maille_28km
),
profil_calc AS (
    SELECT
        id_m28,
        FLOOR((ST_YMin(geom) - b.ymin) / 28000.0)::int AS profil_row
    FROM atlas.maille_28km m
    CROSS JOIN bounds b
),
profil_num_calc AS (
    SELECT
        id_m28,
        (profil_row + 1) AS profil_num
    FROM profil_calc
)
UPDATE atlas.maille_28km m
SET profil_num = p.profil_num
FROM profil_num_calc p
WHERE m.id_m28 = p.id_m28;

-- Remplir les PK min/max
UPDATE atlas.maille_28km
SET
    pk_min_km = 28.0 * (profil_num - 1),
    pk_max_km = 28.0 * profil_num;

-- 4. Liaison avec atlas.mailles (2km)
ALTER TABLE atlas.mailles ADD COLUMN IF NOT EXISTS id_m28 integer;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_mailles_maille28km') THEN
        ALTER TABLE atlas.mailles
            ADD CONSTRAINT fk_mailles_maille28km
            FOREIGN KEY (id_m28)
            REFERENCES atlas.maille_28km(id_m28);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS mailles_id_m28_idx ON atlas.mailles(id_m28);

-- Mise à jour du lien 2km -> 28km
UPDATE atlas.mailles m2
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE ST_Intersects(ST_Centroid(m2.geom), m28.geom);

-- 5. Liaison avec atlas.sondages
ALTER TABLE atlas.sondages ADD COLUMN IF NOT EXISTS id_m28 integer;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'fk_sondage_maille28km') THEN
        ALTER TABLE atlas.sondages
            ADD CONSTRAINT fk_sondage_maille28km
            FOREIGN KEY (id_m28)
            REFERENCES atlas.maille_28km(id_m28);
    END IF;
END $$;

CREATE INDEX IF NOT EXISTS sondage_id_m28_idx ON atlas.sondages(id_m28);

-- Mise à jour via la maille 2km si disponible
UPDATE atlas.sondages s
SET id_m28 = m2.id_m28
FROM atlas.mailles m2
WHERE s.grid_code = m2.code
  AND m2.id_m28 IS NOT NULL;

-- Mise à jour spatiale pour ceux qui n'ont pas de lien via maille 2km
UPDATE atlas.sondages s
SET id_m28 = m28.id_m28
FROM atlas.maille_28km m28
WHERE s.id_m28 IS NULL
  AND s.geom IS NOT NULL
  AND ST_Intersects(ST_Transform(s.geom, 25231), m28.geom);

-- 6. Vérifications finales
DO $$
DECLARE
    v_count_m28 int;
    v_count_profils int;
    v_count_mailles_linked int;
    v_count_sondages_linked int;
BEGIN
    SELECT COUNT(*) INTO v_count_m28 FROM atlas.maille_28km;
    SELECT COUNT(DISTINCT profil_num) INTO v_count_profils FROM atlas.maille_28km;
    SELECT COUNT(*) INTO v_count_mailles_linked FROM atlas.mailles WHERE id_m28 IS NOT NULL;
    SELECT COUNT(*) INTO v_count_sondages_linked FROM atlas.sondages WHERE id_m28 IS NOT NULL;
    
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Migration 080 terminée avec succès';
    RAISE NOTICE '========================================';
    RAISE NOTICE 'Mailles 28km créées: %', v_count_m28;
    RAISE NOTICE 'Profils distincts: %', v_count_profils;
    RAISE NOTICE 'Mailles 2km liées: %', v_count_mailles_linked;
    RAISE NOTICE 'Sondages liés: %', v_count_sondages_linked;
    
    IF v_count_m28 = 0 THEN
        RAISE WARNING 'AUCUNE maille 28km créée - vérifier atlas.mailles';
    END IF;
END $$;

COMMIT;
