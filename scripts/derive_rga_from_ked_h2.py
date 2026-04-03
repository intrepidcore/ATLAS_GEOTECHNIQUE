#!/usr/bin/env python3
from __future__ import annotations

import argparse
import json
import os
from typing import Dict, List, Tuple

import psycopg2
from psycopg2.extras import execute_batch

DB_DEFAULT = os.environ.get("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas_clean")


def classify_rga(ip: float, vbs: float, eg: float) -> Tuple[float, str, float, float]:
    # Rule-based deterministic scoring consistent with existing atlas formulas.
    sum_score = (vbs * 7.2) + (ip * 1.45) + (eg * 2.4)
    rga_score = max(0.0, min(100.0, round(sum_score, 2)))
    if sum_score >= 80.0:
        rga_class = "tres_fort"
    elif sum_score >= 60.0:
        rga_class = "fort"
    elif sum_score >= 40.0:
        rga_class = "moyen"
    else:
        rga_class = "faible"
    bearing = round(max(60.0, 230.0 - (max(0.0, min(100.0, sum_score)) * 1.1)), 2)
    settlement = round(max(0.0, min(100.0, (150.0 / max(bearing, 1.0)) * 100.0)), 2)
    return rga_score, rga_class, bearing, settlement


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--database-url", default=DB_DEFAULT)
    args = ap.parse_args()
    if not args.database_url:
        raise SystemExit("DATABASE_URL required")

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()
    try:
        # H2 only per roadmap.
        cur.execute(
            """
            WITH src_ip AS (
              SELECT maille_id, value AS ip
              FROM atlas.v_latest_ai_interpolation
              WHERE parameter_id = 'ip_derived_h2'
            ),
            src_vbs AS (
              SELECT maille_id, value AS vbs
              FROM atlas.v_latest_ai_interpolation
              WHERE parameter_id = 'vbs_ked_h2'
            ),
            src_eg AS (
              SELECT maille_id, value AS eg
              FROM atlas.v_latest_ai_interpolation
              WHERE parameter_id = 'eg_ked_h2'
            )
            SELECT m.id::text, m.code, ip.ip::double precision, vbs.vbs::double precision, eg.eg::double precision
            FROM atlas.mailles m
            LEFT JOIN src_ip ip ON ip.maille_id = m.id
            LEFT JOIN src_vbs vbs ON vbs.maille_id = m.id
            LEFT JOIN src_eg eg ON eg.maille_id = m.id
            WHERE ip.ip IS NOT NULL
              AND vbs.vbs IS NOT NULL
              AND eg.eg IS NOT NULL
            """
        )
        source_rows: List[Tuple[str, str, float, float, float]] = cur.fetchall()
        if not source_rows:
            raise SystemExit("No source rows for (ip_derived_h2, vbs_ked_h2, eg_ked_h2)")

        payload = []
        for maille_id, maille_code, ip, vbs, eg in source_rows:
            rga_score, rga_class, bearing, settlement = classify_rga(float(ip), float(vbs), float(eg))
            payload.append(
                (
                    maille_id,
                    maille_code,
                    rga_score,
                    rga_class,
                    bearing,
                    settlement,
                    85.0,
                    "derived_rga_from_ked",
                    json.dumps(
                        {
                            "horizon": "H2",
                            "inputs": {
                                "ip_parameter": "ip_derived_h2",
                                "vbs_parameter": "vbs_ked_h2",
                                "eg_parameter": "eg_ked_h2",
                            },
                            "rule": "derived_rga_from_ked_chassagneux1996",
                        }
                    ),
                )
            )

        execute_batch(
            cur,
            """
            INSERT INTO atlas.maille_geotech_infer (
                maille_id,
                maille_code,
                rga_score,
                rga_class,
                bearing_capacity_kpa,
                settlement_risk_pct,
                confidence_score,
                model_version,
                source_type,
                source_details,
                updated_at
            ) VALUES (
                %s::uuid,
                %s,
                %s,
                %s,
                %s,
                %s,
                %s,
                'derived_rga_from_ked_h2_v1',
                %s,
                %s::jsonb,
                now()
            )
            ON CONFLICT (maille_id) DO UPDATE SET
                maille_code = EXCLUDED.maille_code,
                rga_score = EXCLUDED.rga_score,
                rga_class = EXCLUDED.rga_class,
                bearing_capacity_kpa = EXCLUDED.bearing_capacity_kpa,
                settlement_risk_pct = EXCLUDED.settlement_risk_pct,
                confidence_score = EXCLUDED.confidence_score,
                model_version = EXCLUDED.model_version,
                source_type = EXCLUDED.source_type,
                source_details = EXCLUDED.source_details,
                updated_at = now()
            """,
            payload,
            page_size=2000,
        )

        conn.commit()
        print(
            json.dumps(
                {
                    "ok": True,
                    "rows_upserted": len(payload),
                    "source_type": "derived_rga_from_ked",
                    "horizon": "H2",
                },
                ensure_ascii=False,
            )
        )
        return 0
    finally:
        cur.close()
        conn.close()


if __name__ == "__main__":
    raise SystemExit(main())

