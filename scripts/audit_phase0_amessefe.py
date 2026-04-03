#!/usr/bin/env python3
"""
Audit READ-ONLY Phase 0 (roadmap_30_03_2026) — aligné ADR-008 (gates G-01 à G-05).

Produit les CSV attendus sans aucun UPDATE/DELETE :
  - data/audit/audit_amessefe_avant_remediation.csv
  - data/audit/echantillons_depth_suspects.csv
  - data/audit/localite_key_collisions_amessefe.csv
  - data/audit/coverage_par_source.csv

Usage:
  python scripts/audit_phase0_amessefe.py [--pgurl URL] [--out-dir PATH]
"""

from __future__ import annotations

import argparse
from pathlib import Path

import pandas as pd
from sqlalchemy import create_engine, text

DEFAULT_PG = "postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean"

AUDIT_SONDAGES_ECHANTILLONS_SQL = """
WITH ames AS (
    SELECT s.id,
           s.localite_key,
           COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code') AS libelle,
           s.source,
           s.depth_m_min::float8 AS depth_m_min,
           s.depth_m_max::float8 AS depth_m_max
    FROM public.sondages s
    WHERE s.deleted_at IS NULL
      AND COALESCE(s.source, s.meta->>'source', '') ILIKE '%AMESSEFE%'
)
SELECT
    a.id::text AS sondage_id,
    a.localite_key AS localite_key_actuel,
    a.libelle,
    e.id::text AS echantillon_id,
    e.depth_m::float8 AS depth_m,
    EXISTS (
        SELECT 1 FROM essais_vbs ev
        WHERE ev.echantillon_id = e.id AND ev.vbs IS NOT NULL
    ) AS has_vbs,
    EXISTS (
        SELECT 1 FROM essais_atterberg ea
        WHERE ea.echantillon_id = e.id AND ea.ip_generated IS NOT NULL
    ) AS has_ip,
    EXISTS (
        SELECT 1 FROM essais_atterberg ea
        WHERE ea.echantillon_id = e.id AND ea.wl IS NOT NULL AND ea.wp IS NOT NULL
    ) AS has_wl_wp,
    EXISTS (
        SELECT 1 FROM essais_potentiel_gonflement epg
        WHERE epg.echantillon_id = e.id AND epg.cg IS NOT NULL
    ) AS has_eg,
    CASE
        WHEN e.depth_m IS NOT NULL AND (e.depth_m < 0 OR e.depth_m > 15) THEN 'DEPTH_OUT_OF_RANGE_ADR'
        WHEN e.depth_m IS NOT NULL
             AND a.depth_m_min IS NOT NULL
             AND a.depth_m_max IS NOT NULL
             AND (e.depth_m < a.depth_m_min OR e.depth_m > a.depth_m_max)
        THEN 'DEPTH_OUT_OF_RANGE_ADR'
        WHEN LENGTH(COALESCE(a.localite_key, '')) <= 3
             AND EXISTS (
                 SELECT 1
                 FROM public.sondages s2
                 WHERE s2.deleted_at IS NULL
                   AND COALESCE(s2.source, s2.meta->>'source', '') ILIKE '%AMESSEFE%'
                   AND s2.localite_key = a.localite_key
                   AND s2.id <> a.id
                   AND COALESCE(NULLIF(BTRIM(s2.code), ''), s2.meta->>'code') <> a.libelle
             )
        THEN 'LOCALITE_KEY_TRUNCATED'
        ELSE 'OK'
    END AS anomalie_type
FROM ames a
JOIN echantillons e ON e.sondage_id = a.id
ORDER BY a.libelle, e.depth_m, e.id
"""

DEPTH_SUSPECTS_SQL = """
SELECT
    e.id::text AS echantillon_id,
    e.sondage_id::text AS sondage_id,
    COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code') AS code_sondage,
    s.localite_key,
    e.depth_m::float8 AS depth_m,
    epg.cg::float8 AS cg_if_any,
    ea.wl::float8 AS wl_if_any,
    ea.ip_generated::float8 AS ip_if_any
FROM echantillons e
JOIN public.sondages s ON s.id = e.sondage_id
LEFT JOIN essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
LEFT JOIN essais_atterberg ea ON ea.echantillon_id = e.id
WHERE s.deleted_at IS NULL
  AND COALESCE(s.source, s.meta->>'source', '') ILIKE '%AMESSEFE%'
  AND (
    e.depth_m < 0
    OR e.depth_m > 15
    OR (s.depth_m_min IS NOT NULL AND e.depth_m < s.depth_m_min::float8)
    OR (s.depth_m_max IS NOT NULL AND e.depth_m > s.depth_m_max::float8)
  )
ORDER BY e.depth_m, code_sondage
"""

COLLISIONS_SQL = """
SELECT
    s.localite_key,
    COUNT(*) AS n_sondages,
    COUNT(DISTINCT COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code')) AS n_libelles_distincts
FROM public.sondages s
WHERE s.deleted_at IS NULL
  AND COALESCE(s.source, s.meta->>'source', '') ILIKE '%AMESSEFE%'
GROUP BY s.localite_key
HAVING COUNT(*) > 1
ORDER BY n_sondages DESC, s.localite_key
"""

COVERAGE_SQL = """
SELECT
    COALESCE(NULLIF(BTRIM(s.source), ''), NULLIF(BTRIM(s.meta->>'source'), '')) AS source,
    COUNT(DISTINCT s.id) AS n_sondages,
    COUNT(DISTINCT CASE WHEN ev.vbs IS NOT NULL THEN s.id END) AS n_avec_vbs,
    COUNT(DISTINCT CASE WHEN ea.ip_generated IS NOT NULL THEN s.id END) AS n_avec_ip,
    COUNT(DISTINCT CASE WHEN ea.wl IS NOT NULL THEN s.id END) AS n_avec_wl,
    COUNT(DISTINCT CASE WHEN ea.wp IS NOT NULL THEN s.id END) AS n_avec_wp,
    COUNT(DISTINCT CASE WHEN epg.cg IS NOT NULL THEN s.id END) AS n_avec_eg
FROM public.sondages s
LEFT JOIN echantillons e ON e.sondage_id = s.id
LEFT JOIN essais_vbs ev ON ev.echantillon_id = e.id
LEFT JOIN essais_atterberg ea ON ea.echantillon_id = e.id
LEFT JOIN essais_potentiel_gonflement epg ON epg.echantillon_id = e.id
WHERE s.deleted_at IS NULL
GROUP BY COALESCE(NULLIF(BTRIM(s.source), ''), NULLIF(BTRIM(s.meta->>'source'), ''))
ORDER BY n_sondages DESC
"""


def main() -> int:
    p = argparse.ArgumentParser(description="Audit Phase 0 AMESSEFE (read-only)")
    p.add_argument("--pgurl", default=DEFAULT_PG)
    p.add_argument(
        "--out-dir",
        type=Path,
        default=None,
        help="Dossier de sortie (défaut: <repo>/data/audit)",
    )
    args = p.parse_args()

    repo = Path(__file__).resolve().parent.parent
    out_dir = args.out_dir or (repo / "data" / "audit")
    out_dir.mkdir(parents=True, exist_ok=True)

    eng = create_engine(args.pgurl)
    with eng.begin() as conn:
        df_audit = pd.read_sql(text(AUDIT_SONDAGES_ECHANTILLONS_SQL), conn)
        df_depth = pd.read_sql(text(DEPTH_SUSPECTS_SQL), conn)
        df_coll = pd.read_sql(text(COLLISIONS_SQL), conn)
        df_cov = pd.read_sql(text(COVERAGE_SQL), conn)

    audit_cols = [
        "sondage_id",
        "localite_key_actuel",
        "depth_m",
        "has_vbs",
        "has_ip",
        "has_wl_wp",
        "has_eg",
        "anomalie_type",
    ]
    df_audit_out = df_audit[audit_cols].copy()
    df_audit_out.to_csv(out_dir / "audit_amessefe_avant_remediation.csv", index=False, encoding="utf-8-sig")
    df_audit.to_csv(
        out_dir / "audit_amessefe_avant_remediation_detail.csv",
        index=False,
        encoding="utf-8-sig",
    )
    df_depth.to_csv(out_dir / "echantillons_depth_suspects.csv", index=False, encoding="utf-8-sig")
    df_coll.to_csv(out_dir / "localite_key_collisions_amessefe.csv", index=False, encoding="utf-8-sig")
    df_cov.to_csv(out_dir / "coverage_par_source.csv", index=False, encoding="utf-8-sig")

    print(f"[OK] {len(df_audit_out)} lignes -> {out_dir / 'audit_amessefe_avant_remediation.csv'} (colonnes roadmap)")
    print(f"[OK] {len(df_audit)} lignes -> {out_dir / 'audit_amessefe_avant_remediation_detail.csv'} (+echantillon_id, libelle)")
    print(f"[OK] {len(df_depth)} lignes -> {out_dir / 'echantillons_depth_suspects.csv'}")
    print(f"[OK] {len(df_coll)} groupes -> {out_dir / 'localite_key_collisions_amessefe.csv'}")
    print(f"[OK] {len(df_cov)} sources -> {out_dir / 'coverage_par_source.csv'}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
