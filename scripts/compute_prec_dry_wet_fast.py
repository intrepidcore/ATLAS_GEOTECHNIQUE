#!/usr/bin/env python3
"""
Atlas — Calcul prec_dry / prec_wet optimisé
==========================================
Extrait ST_Value(rast,1,centroid) via requête batch par lot de mailles.
Règles : BM-SYNC-05 (idempotent), DATA-02 (validation physique), ETL-03

Usage: python scripts/compute_prec_dry_wet_fast.py \
         --database-url postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
"""
import sys, math, time, logging, argparse
from datetime import datetime
import psycopg2, psycopg2.extras

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s | %(levelname)s | %(message)s',
    datefmt='%H:%M:%S'
)
log = logging.getLogger('prec_calc')

BATCH_SIZE = 500   # mailles par lot


def main():
    p = argparse.ArgumentParser()
    p.add_argument('--database-url', required=True)
    args = p.parse_args()

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # BM-SYNC-05 : ne traiter que les mailles sans prec_wet
    cur.execute("""
        SELECT m.code, ST_X(ST_Transform(ST_Centroid(m.geom), 4326)) as lon,
               ST_Y(ST_Transform(ST_Centroid(m.geom), 4326)) as lat
        FROM atlas.mailles m
        JOIN atlas.maille_climate_features cf ON cf.maille_code = m.code
        WHERE cf.prec_wet IS NULL
        ORDER BY m.code
    """)
    mailles = cur.fetchall()
    log.info(f"{len(mailles)} mailles à calculer (prec_wet NULL)")

    if not mailles:
        log.info("Rien à calculer — idempotent OK")
        conn.close()
        return

    # GEN-01: vérifier que worldclim_prec a 1 bande/tuile
    cur.execute("SELECT ST_Numbands(rast) FROM atlas.worldclim_prec LIMIT 1")
    n_bands = cur.fetchone()[0]
    log.info(f"worldclim_prec: {n_bands} bande(s)/tuile")

    t0 = time.time()
    n_ok = 0
    n_err = 0

    for batch_start in range(0, len(mailles), BATCH_SIZE):
        batch = mailles[batch_start:batch_start + BATCH_SIZE]
        codes = [r[0] for r in batch]

        # Extraction efficace: une seule requête par lot via VALUES CTE
        values_sql = ','.join(f"('{r[0]}', {r[1]}, {r[2]})" for r in batch)

        cur.execute(f"""
            WITH pts AS (
                SELECT * FROM (VALUES {values_sql}) AS t(code, lon, lat)
            ),
            monthly AS (
                SELECT
                    pts.code,
                    ARRAY_AGG(
                        ST_Value(r.rast, 1,
                                 ST_SetSRID(ST_Point(pts.lon, pts.lat), 4326),
                                 false)
                        ORDER BY r.rid
                    ) AS monthly_values
                FROM pts
                JOIN atlas.worldclim_prec r
                    ON ST_Intersects(r.rast,
                        ST_SetSRID(ST_Point(pts.lon, pts.lat), 4326))
                GROUP BY pts.code
            )
            SELECT code, monthly_values FROM monthly
        """)
        results = cur.fetchall()

        # UPDATE pour ce batch
        updates = []
        for code, monthly in results:
            vals = [v for v in (monthly or []) if v is not None and v >= 0]
            if not vals:
                continue
            dry = min(vals)
            wet = max(vals)
            if dry > wet or dry < 0:
                log.warning(f"  {code}: valeurs incohérentes (dry={dry}, wet={wet})")
                n_err += 1
                continue
            updates.append((dry, wet, code))

        if updates:
            psycopg2.extras.execute_batch(cur, """
                UPDATE atlas.maille_climate_features
                SET prec_dry = %s, prec_wet = %s, updated_at = NOW()
                WHERE maille_code = %s
            """, updates)
            conn.commit()
            n_ok += len(updates)

        # Progression
        pct = (batch_start + len(batch)) / len(mailles) * 100
        elapsed = time.time() - t0
        eta = elapsed / (pct / 100) - elapsed if pct > 0 else 0
        log.info(f"  {pct:.1f}% | {n_ok} OK | ETA: {eta/60:.1f} min")

    conn.close()
    elapsed_total = time.time() - t0
    log.info(f"Terminé: {n_ok} mailles | {n_err} erreurs | {elapsed_total/60:.1f} min")


if __name__ == '__main__':
    main()
