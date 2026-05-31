\set ON_ERROR_STOP 1
-- Migration : vue matérialisée atlas.v_contexte_geologique (5 niveaux)
-- Règles : DB-11 (atomique, idempotent), BM-SYNC-05, DB-24
-- Auteur : Intrepid Core Engineering
-- Usage  : psql -v ON_ERROR_STOP=1 -f scripts/sql/create_contexte_geologique.sql

BEGIN;

DROP MATERIALIZED VIEW IF EXISTS atlas.v_contexte_geologique;

CREATE MATERIALIZED VIEW atlas.v_contexte_geologique AS
SELECT
    m.code          AS maille_code,
    m.id::text      AS maille_id,

    -- Niveau 1 : zone géologique spéciale (NULL si hors zone — 14.5% territoire)
    z.id::text                           AS zone_speciale_id,
    COALESCE(z.nom, 'NATIONAL')          AS zone_speciale,

    -- Niveau 2 : pédologie FAO/IRD — dérive active du KED (100% couverture)
    COALESCE(up.type_sol, 'INCONNU')     AS type_pedologique,

    -- Niveau 3 : risque RGA Chassagneux 1996 (100% couverture)
    COALESCE(rg.niveau_risque, 'INCONNU') AS risque_rga,

    -- Niveau 4 : formation géologique nationale (100% couverture)
    COALESCE(ug.type_sols, 'INCONNU')    AS formation_geologique,

    -- Niveau 5 : hydrogéologie (couverture partielle)
    COALESCE(hg.libelle, 'INCONNU')      AS hydrogeo_classe,

    -- Contexte composite pour la dérive hiérarchique du KED
    -- Format : ZONE|PEDO(4)|RISQUE|GEO(6)
    CONCAT_WS('|',
        COALESCE(z.nom, 'NAT'),
        LEFT(COALESCE(up.type_sol, 'INC'), 4),
        COALESCE(rg.niveau_risque, 'INC'),
        LEFT(COALESCE(ug.type_sols, 'INC'), 6)
    )                                    AS contexte_complet,

    -- Contexte partiel zone+pédologie (repli niveau 2 dans hiérarchie)
    CONCAT_WS('|',
        COALESCE(z.nom, 'NAT'),
        LEFT(COALESCE(up.type_sol, 'INC'), 4)
    )                                    AS contexte_zone_pedo

FROM atlas.mailles m
LEFT JOIN atlas.zones_etude z
    ON ST_Intersects(ST_Centroid(m.geom), z.geom)
LEFT JOIN atlas.unites_pedologiques up
    ON ST_Contains(up.geom, ST_Centroid(m.geom))
LEFT JOIN atlas.risque_gonflement rg
    ON ST_Intersects(ST_Centroid(m.geom), rg.geom)
LEFT JOIN atlas.unites_geologiques ug
    ON ST_Intersects(ST_Centroid(m.geom), ug.geom)
LEFT JOIN atlas.hydrogeologie hg
    ON ST_Intersects(ST_Centroid(m.geom), hg.geom)
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
    SELECT COUNT(*)                                   INTO n_total     FROM atlas.v_contexte_geologique;
    SELECT COUNT(*)                                   INTO n_pedologie FROM atlas.v_contexte_geologique WHERE type_pedologique != 'INCONNU';
    SELECT COUNT(*)                                   INTO n_geologie  FROM atlas.v_contexte_geologique WHERE formation_geologique != 'INCONNU';
    SELECT COUNT(DISTINCT zone_speciale_id)           INTO n_zones     FROM atlas.v_contexte_geologique WHERE zone_speciale_id IS NOT NULL;

    RAISE NOTICE '=== v_contexte_geologique ===';
    RAISE NOTICE 'Mailles totales      : %', n_total;
    RAISE NOTICE 'Avec pédologie       : % (%.1f%%)', n_pedologie, 100.0*n_pedologie/NULLIF(n_total,0);
    RAISE NOTICE 'Avec géologie        : % (%.1f%%)', n_geologie,  100.0*n_geologie/NULLIF(n_total,0);
    RAISE NOTICE 'Zones spéciales      : %', n_zones;

    IF n_total < 29000 THEN
        RAISE EXCEPTION 'Couverture insuffisante: %/29407 mailles', n_total;
    END IF;
    IF n_pedologie < 20000 THEN
        RAISE EXCEPTION 'Couverture pédologique < 20000: %', n_pedologie;
    END IF;
END $$;

COMMIT;
