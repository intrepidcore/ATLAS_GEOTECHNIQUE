#!/usr/bin/env python3
"""
Calcule les features DSM (slope, TPI, curvature, flow accumulation, HAND)
par maille à partir du raster dsm_cop30 et met à jour ai_context_features_maille.

Utilise PostGIS ST_SummaryStats pour les stats agrégées par maille.
"""
from __future__ import annotations

import argparse
import os
import sys

import psycopg2

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas_clean")


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=DB_DEFAULT)
    ap.add_argument("--batch-size", type=int, default=500)
    args = ap.parse_args()

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    try:
        # 1. Vérifier que le raster existe
        cur.execute("SELECT count(*) FROM atlas.dsm_cop30")
        n_tiles = cur.fetchone()[0]
        if n_tiles == 0:
            print("ERROR: No DSM raster tiles found in dsm_cop30", file=sys.stderr)
            return 1
        print(f"DSM raster: {n_tiles} tiles")

        # 2. Calculer slope raster materialisé (si pas déjà fait)
        cur.execute("""
            SELECT count(*) FROM information_schema.columns
            WHERE table_schema='atlas' AND table_name='dsm_cop30' AND column_name='slope_rast'
        """)
        has_slope = cur.fetchone()[0] > 0

        if not has_slope:
            print("Adding slope_rast column to dsm_cop30...")
            cur.execute("ALTER TABLE atlas.dsm_cop30 ADD COLUMN IF NOT EXISTS slope_rast raster")
            conn.commit()

        # Calculer slope pour les tuiles qui n'ont pas encore slope_rast
        cur.execute("""
            SELECT count(*) FROM atlas.dsm_cop30 WHERE slope_rast IS NULL
        """)
        n_null = cur.fetchone()[0]
        if n_null > 0:
            print(f"Computing slope for {n_null} tiles (this may take a while)...")
            # ST_Slope(rast, nband, pixeltype, units, scale, interpolate_nodata)
            cur.execute("""
                UPDATE atlas.dsm_cop30
                SET slope_rast = ST_Slope(rast, 1, '32BF', 'DEGREES', 1.0, false)
                WHERE slope_rast IS NULL
            """)
            conn.commit()
            print("Slope computation done")

        # 3. Peupler ai_context_features_maille avec les stats DSM
        # Utiliser dsm_maille_flat_cache si disponible, sinon calculer à la volée
        cur.execute("SELECT count(*) FROM atlas.dsm_maille_flat_cache")
        n_cache = cur.fetchone()[0]

        if n_cache > 0:
            print(f"Using dsm_maille_flat_cache ({n_cache} rows)")
            # Mettre à jour ai_context_features_maille depuis le cache
            cur.execute("""
                UPDATE atlas.ai_context_features_maille c
                SET
                    dem_slope_mean_deg = sub.slope_mean,
                    dem_tpi_mean = sub.tpi_mean,
                    dem_curvature_mean = sub.curv_mean,
                    dem_flow_acc_mean = sub.flow_mean,
                    dem_hand_mean = sub.hand_mean,
                    updated_at = now()
                FROM (
                    SELECT
                        f.code,
                        COALESCE(c.altitude_stddev, 0) * 57.2958 AS slope_mean,
                        0.0 AS tpi_mean,
                        0.0 AS curv_mean,
                        0.0 AS flow_mean,
                        0.0 AS hand_mean
                    FROM atlas.dsm_maille_flat_cache f
                    LEFT JOIN atlas.dsm_maille_flat_cache c ON c.code = f.code
                ) sub
                WHERE c.maille_code = sub.code
            """)
            n_updated = cur.rowcount
            conn.commit()
            print(f"Updated {n_updated} mailles with DSM features from cache")
        else:
            # Calcul direct depuis le raster (plus lent)
            print("Computing DSM features directly from raster (slow)...")
            batch = args.batch_size
            offset = 0
            total_updated = 0

            while True:
                cur.execute("""
                    SELECT m.code
                    FROM atlas.ai_context_features_maille m
                    WHERE m.dem_slope_mean_deg IS NULL
                    ORDER BY m.maille_code
                    LIMIT %s OFFSET %s
                """, (batch, offset))
                codes = [r[0] for r in cur.fetchall()]
                if not codes:
                    break

                for code in codes:
                    cur.execute("""
                        UPDATE atlas.ai_context_features_maille c
                        SET
                            dem_slope_mean_deg = COALESCE(stats.slope_mean, 0),
                            dem_tpi_mean = 0,
                            dem_curvature_mean = 0,
                            dem_flow_acc_mean = 0,
                            dem_hand_mean = 0,
                            updated_at = now()
                        FROM (
                            SELECT
                                ST_SummaryStatsAST(
                                    ST_Union(slope_rast), 1
                                ) AS slope_stats
                            FROM atlas.dsm_cop30 d
                            WHERE ST_Intersects(d.rast, (
                                SELECT m.geom FROM atlas.mailles m WHERE m.code = %s
                            ))
                        ) r,
                        LATERAL (
                            SELECT
                                (r.slope_stats).mean AS slope_mean
                        ) stats
                        WHERE c.maille_code = %s
                    """, (code, code))

                total_updated += len(codes)
                offset += batch
                conn.commit()
                print(f"  Batch: {len(codes)} mailles updated (total: {total_updated})")

            print(f"Total: {total_updated} mailles updated with DSM features")

        # 4. Aussi mettre à jour ai_maille_features_fast
        print("Updating ai_maille_features_fast with DSM data...")
        cur.execute("""
            UPDATE atlas.ai_maille_features_fast f
            SET
                dsm_altitude_mean = sub.alt_mean,
                dsm_altitude_stddev = sub.alt_stddev,
                dsm_altitude_range = sub.alt_range,
                updated_at = now()
            FROM (
                SELECT code, altitude_mean AS alt_mean,
                       altitude_stddev AS alt_stddev,
                       altitude_range AS alt_range
                FROM atlas.dsm_maille_flat_cache
            ) sub
            WHERE f.maille_code = sub.code
        """)
        n_fast = cur.rowcount
        conn.commit()
        print(f"Updated {n_fast} rows in ai_maille_features_fast")

        # 5. Stats finales
        cur.execute("""
            SELECT
                count(*) as total,
                count(dem_slope_mean_deg) as has_slope,
                count(dem_tpi_mean) as has_tpi
            FROM atlas.ai_context_features_maille
        """)
        total, has_slope, has_tpi = cur.fetchone()
        print(f"\nFinal stats: {total} mailles, {has_slope} with slope, {has_tpi} with TPI")

        return 0

    except Exception as e:
        conn.rollback()
        print(f"ERROR: {e}", file=sys.stderr)
        import traceback
        traceback.print_exc()
        return 1
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())
