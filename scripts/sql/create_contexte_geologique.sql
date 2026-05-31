\set ON_ERROR_STOP 1
-- Migration : vue matérialisée atlas.v_contexte_geologique (5 niveaux)
-- Règles : DB-11 (atomique, idempotent), BM-SYNC-05, DB-24
-- Auteur : Intrepid Core Engineering
-- Correction v2 : LATERAL subqueries pour garantir 1 ligne par maille
--   (les LEFT JOIN directs créaient des doublons quand un centroïde
--    tombait sur la frontière de plusieurs polygones)

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS atlas.v_contexte_geologique;

CREATE MATERIALIZED VIEW atlas.v_contexte_geologique AS
SELECT
    m.code          AS maille_code,
    m.id::text      AS maille_id,

    -- Niveau 1 : zone géologique spéciale — LATERAL garantit 1 résultat max
    z.id::text                            AS zone_speciale_id,
    COALESCE(z.nom, 'NATIONAL')           AS zone_speciale,

    -- Niveau 2 : pédologie FAO/IRD
    COALESCE(up.type_sol, 'INCONNU')      AS type_pedologique,

    -- Niveau 3 : risque RGA Chassagneux
    COALESCE(rg.niveau_risque, 'INCONNU') AS risque_rga,

    -- Niveau 4 : formation géologique nationale
    COALESCE(ug.type_sols, 'INCONNU')     AS formation_geologique,

    -- Niveau 5 : hydrogéologie
    COALESCE(hg.libelle, 'INCONNU')       AS hydrogeo_classe,

    -- Contexte composite KED : ZONE|PEDO(4)|RISQUE|GEO(6)
    CONCAT_WS('|',
        COALESCE(z.nom, 'NAT'),
        LEFT(COALESCE(up.type_sol, 'INC'), 4),
        COALESCE(rg.niveau_risque, 'INC'),
        LEFT(COALESCE(ug.type_sols, 'INC'), 6)
    )                                     AS contexte_complet,

    -- Repli zone+pédologie (niveau 2)
    CONCAT_WS('|',
        COALESCE(z.nom, 'NAT'),
        LEFT(COALESCE(up.type_sol, 'INC'), 4)
    )                                     AS contexte_zone_pedo

FROM atlas.mailles m

-- Niveau 1 : zone spéciale (LIMIT 1 → 1 ligne max par maille)
LEFT JOIN LATERAL (
    SELECT id, nom
    FROM atlas.zones_etude
    WHERE ST_Intersects(ST_Centroid(m.geom), geom)
    LIMIT 1
) z ON TRUE

-- Niveau 2 : pédologie
LEFT JOIN LATERAL (
    SELECT type_sol
    FROM atlas.unites_pedologiques
    WHERE ST_Contains(geom, ST_Centroid(m.geom))
    LIMIT 1
) up ON TRUE

-- Niveau 3 : risque Chassagneux
LEFT JOIN LATERAL (
    SELECT niveau_risque
    FROM atlas.risque_gonflement
    WHERE ST_Intersects(ST_Centroid(m.geom), geom)
    ORDER BY ST_Area(geom) DESC   -- si chevauchement, prendre le plus grand polygone
    LIMIT 1
) rg ON TRUE

-- Niveau 4 : géologie nationale
LEFT JOIN LATERAL (
    SELECT type_sols
    FROM atlas.unites_geologiques
    WHERE ST_Intersects(ST_Centroid(m.geom), geom)
    ORDER BY ST_Area(geom) DESC
    LIMIT 1
) ug ON TRUE

-- Niveau 5 : hydrogéologie
LEFT JOIN LATERAL (
    SELECT libelle
    FROM atlas.hydrogeologie
    WHERE ST_Intersects(ST_Centroid(m.geom), geom)
    ORDER BY ST_Area(geom) DESC
    LIMIT 1
) hg ON TRUE

WHERE m.code IS NOT NULL;

-- Index obligatoires (DB-20)
CREATE UNIQUE INDEX ON atlas.v_contexte_geologique (maille_code);
CREATE        INDEX ON atlas.v_contexte_geologique (maille_id);
CREATE        INDEX ON atlas.v_contexte_geologique (type_pedologique);
CREATE        INDEX ON atlas.v_contexte_geologique (formation_geologique);
CREATE        INDEX ON atlas.v_contexte_geologique (zone_speciale);
CREATE        INDEX ON atlas.v_contexte_geologique (contexte_complet);

-- Validation post-création (GEN-01 + DATA-02)
DO $$
DECLARE
    n_total      INTEGER;
    n_pedologie  INTEGER;
    n_geologie   INTEGER;
    n_zones      INTEGER;
BEGIN
    SELECT COUNT(*)             INTO n_total     FROM atlas.v_contexte_geologique;
    SELECT COUNT(*)             INTO n_pedologie FROM atlas.v_contexte_geologique WHERE type_pedologique != 'INCONNU';
    SELECT COUNT(*)             INTO n_geologie  FROM atlas.v_contexte_geologique WHERE formation_geologique != 'INCONNU';
    SELECT COUNT(DISTINCT zone_speciale_id) INTO n_zones
        FROM atlas.v_contexte_geologique WHERE zone_speciale_id IS NOT NULL;

    RAISE NOTICE '=== v_contexte_geologique ===';
    RAISE NOTICE 'Mailles totales  : %', n_total;
    RAISE NOTICE 'Avec pedologie   : % (%.1f%%)', n_pedologie, 100.0*n_pedologie/NULLIF(n_total,0);
    RAISE NOTICE 'Avec geologie    : % (%.1f%%)', n_geologie,  100.0*n_geologie/NULLIF(n_total,0);
    RAISE NOTICE 'Zones speciales  : %', n_zones;

    IF n_total < 29000 THEN
        RAISE EXCEPTION 'Couverture insuffisante: %/29407 mailles', n_total;
    END IF;
    IF n_pedologie < 20000 THEN
        RAISE EXCEPTION 'Couverture pedologique < 20000: %', n_pedologie;
    END IF;
END $$;

COMMIT;
