import psycopg2, logging
logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("reclass")

DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
zone_codes = [
    "DEPRESSION_LAMA_TG", "DEPRESSION_BADO_TG",
    "FOSSE_LIONS_TG", "PLAINE_MONO_TG", "PLAINE_OTI_TG",
]

conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

# Supprimer anciennes associations
cur.execute("""
    DELETE FROM atlas.mailles_zones_etude
    WHERE zone_id IN (SELECT id FROM atlas.zones_etude WHERE code = ANY(%s))
""", (zone_codes,))
log.info("Anciennes associations supprimées : %d", cur.rowcount)

# Réinsérer avec pct_intersection calculé
cur.execute("""
    INSERT INTO atlas.mailles_zones_etude
        (maille_id, zone_id, pct_intersection, intersection_method, calculated_at)
    SELECT
        m.id AS maille_id,
        z.id AS zone_id,
        ROUND(
            (ST_Area(ST_Intersection(m.geom, z.geom)) / NULLIF(ST_Area(m.geom), 0) * 100)::numeric,
            2
        ) AS pct_intersection,
        'ST_Intersection' AS intersection_method,
        now() AS calculated_at
    FROM atlas.mailles m
    JOIN atlas.zones_etude z ON ST_Intersects(m.geom, z.geom)
    WHERE z.code = ANY(%s)
      AND ST_Area(ST_Intersection(m.geom, z.geom)) > 0
    ON CONFLICT (maille_id, zone_id) DO UPDATE
        SET pct_intersection    = EXCLUDED.pct_intersection,
            intersection_method = EXCLUDED.intersection_method,
            calculated_at       = EXCLUDED.calculated_at
""", (zone_codes,))
log.info("Nouvelles associations insérées : %d", cur.rowcount)

# Résumé par zone
cur.execute("""
    SELECT z.code, COUNT(*) AS n_mailles,
           ROUND(AVG(mze.pct_intersection)::numeric, 1) AS pct_moy,
           SUM(CASE WHEN mze.priorite_recherche = 1 THEN 1 ELSE 0 END) AS priorite1
    FROM atlas.mailles_zones_etude mze
    JOIN atlas.zones_etude z ON z.id = mze.zone_id
    WHERE z.code = ANY(%s)
    GROUP BY z.code ORDER BY z.code
""", (zone_codes,))
log.info("\n  %-25s  %8s  %8s  %10s", "CODE", "mailles", "pct_moy", "priorité 1")
log.info("  " + "-" * 60)
for code, n, pct, p1 in cur.fetchall():
    log.info("  %-25s  %8d  %8.1f%%  %10d", code, n, pct or 0, p1 or 0)

cur.close()
conn.close()
log.info("\nReclassification OK")
