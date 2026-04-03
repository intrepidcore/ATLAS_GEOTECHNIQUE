import argparse
import importlib.util
import json
from pathlib import Path
from typing import Any, Dict, List, Optional

import pandas as pd
from sqlalchemy import create_engine, text

# Phase 0 audit (roadmap + ADR-008) — même schéma que l'export lab (echantillons / essais_* sans préfixe)
_p0 = Path(__file__).resolve().parent / "audit_phase0_amessefe.py"
_spec = importlib.util.spec_from_file_location("audit_phase0_amessefe", _p0)
_p0_mod = importlib.util.module_from_spec(_spec)
if _spec.loader is not None:
    _spec.loader.exec_module(_p0_mod)
AUDIT_SONDAGES_ECHANTILLONS_SQL = getattr(_p0_mod, "AUDIT_SONDAGES_ECHANTILLONS_SQL", None)
DEPTH_SUSPECTS_SQL = getattr(_p0_mod, "DEPTH_SUSPECTS_SQL", None)
COLLISIONS_SQL = getattr(_p0_mod, "COLLISIONS_SQL", None)
COVERAGE_SQL = getattr(_p0_mod, "COVERAGE_SQL", None)

# Canonical table for listing surveys (see db/migrations/024_sondages_cleanup_and_documentation.sql).
# source = provenance / référence documentaire (NICABOU, BONOU, etc.); operator = entreprise de terrain si renseigné.
SONDAGES_SHEET_SQL = """
SELECT
    s.id::text AS id,
    COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code') AS code,
    ST_X(ST_Transform(COALESCE(s.geom_real, s.geom), 4326)) AS lon,
    ST_Y(ST_Transform(COALESCE(s.geom_real, s.geom), 4326)) AS lat,
    s.depth_m_min,
    s.depth_m_max,
    COALESCE(s.grid_code, s.maille_code) AS maille_ou_grid_code,
    s.maille_code,
    s.grid_code,
    s.adm1_name,
    s.adm2_name,
    s.adm3_name,
    s.adm3_id,
    s.localite,
    s.date,
    COALESCE(NULLIF(BTRIM(s.source), ''), NULLIF(BTRIM(s.meta->>'source'), '')) AS source,
    COALESCE(
        NULLIF(BTRIM(s.operator), ''),
        NULLIF(BTRIM(s.meta->>'operator'), '')
    ) AS operator,
    s.type_sol,
    s.is_geocoded,
    s.import_id,
    s.created_at,
    s.updated_at,
    s.deleted_at
FROM public.sondages s
WHERE (:include_deleted OR s.deleted_at IS NULL)
ORDER BY COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code'), s.id
"""

# Couverture lab par sondage : IP (Atterberg ip_generated), VBS, EG (essais_potentiel_gonflement.cg).
SONDAGES_LAB_IP_VBS_EG_SQL = """
SELECT
    s.id::text AS id,
    COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code') AS code,
    COALESCE(NULLIF(BTRIM(s.source), ''), NULLIF(BTRIM(s.meta->>'source'), '')) AS source,
    COALESCE(
        NULLIF(BTRIM(s.operator), ''),
        NULLIF(BTRIM(s.meta->>'operator'), '')
    ) AS operator,
    COALESCE(s.grid_code, s.maille_code) AS maille_ou_grid_code,
    EXISTS (
        SELECT 1
        FROM essais_atterberg ea
        INNER JOIN echantillons e ON ea.echantillon_id = e.id
        WHERE e.sondage_id = s.id
          AND ea.ip_generated IS NOT NULL
    ) AS has_ip,
    EXISTS (
        SELECT 1
        FROM essais_vbs ev
        INNER JOIN echantillons e ON ev.echantillon_id = e.id
        WHERE e.sondage_id = s.id
          AND ev.vbs IS NOT NULL
    ) AS has_vbs,
    EXISTS (
        SELECT 1
        FROM essais_potentiel_gonflement epg
        INNER JOIN echantillons e ON epg.echantillon_id = e.id
        WHERE e.sondage_id = s.id
          AND epg.cg IS NOT NULL
    ) AS has_eg,
    (
        EXISTS (
            SELECT 1 FROM essais_atterberg ea
            INNER JOIN echantillons e ON ea.echantillon_id = e.id
            WHERE e.sondage_id = s.id AND ea.ip_generated IS NOT NULL
        )
        AND EXISTS (
            SELECT 1 FROM essais_vbs ev
            INNER JOIN echantillons e ON ev.echantillon_id = e.id
            WHERE e.sondage_id = s.id AND ev.vbs IS NOT NULL
        )
        AND EXISTS (
            SELECT 1 FROM essais_potentiel_gonflement epg
            INNER JOIN echantillons e ON epg.echantillon_id = e.id
            WHERE e.sondage_id = s.id AND epg.cg IS NOT NULL
        )
    ) AS meets_ip_and_vbs_and_eg,
    NULLIF(TRIM(BOTH FROM CONCAT_WS(', ',
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM essais_atterberg ea
            INNER JOIN echantillons e ON ea.echantillon_id = e.id
            WHERE e.sondage_id = s.id AND ea.ip_generated IS NOT NULL
        ) THEN 'IP' END,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM essais_vbs ev
            INNER JOIN echantillons e ON ev.echantillon_id = e.id
            WHERE e.sondage_id = s.id AND ev.vbs IS NOT NULL
        ) THEN 'VBS' END,
        CASE WHEN NOT EXISTS (
            SELECT 1 FROM essais_potentiel_gonflement epg
            INNER JOIN echantillons e ON epg.echantillon_id = e.id
            WHERE e.sondage_id = s.id AND epg.cg IS NOT NULL
        ) THEN 'EG' END
    )), '') AS missing_ip_vbs_eg_labels
FROM public.sondages s
WHERE (:include_deleted OR s.deleted_at IS NULL)
ORDER BY meets_ip_and_vbs_and_eg ASC,
         COALESCE(NULLIF(BTRIM(s.source), ''), NULLIF(BTRIM(s.meta->>'source'), '')),
         COALESCE(NULLIF(BTRIM(s.code), ''), s.meta->>'code'),
         s.id
"""


def _strip_excel_unsupported_timezones(df: Optional[pd.DataFrame]) -> Optional[pd.DataFrame]:
    if df is None:
        return None
    cleaned = df.copy()
    for col in cleaned.columns:
        series = cleaned[col]
        try:
            tz_dtype = isinstance(series.dtype, pd.DatetimeTZDtype)
        except AttributeError:
            tz_dtype = pd.api.types.is_datetime64tz_dtype(series)
        if tz_dtype:
            cleaned[col] = series.dt.tz_localize(None)
    return cleaned


def main() -> int:
    parser = argparse.ArgumentParser(
        description=(
            "Export a global XLSX: (1) one row per 2km maille having at least one thematic value; "
            "(2) sondages with unified source/provenance; (3) sondages_lab_ip_vbs_eg (IP/VBS/EG + auteur). "
            "Reads run index.json for maille column names — they must exist on mailles_geotechnique_stats_wgs84."
        )
    )
    parser.add_argument("run_dir", help="Path to the export run folder (contains index.json)")
    parser.add_argument(
        "--pgurl",
        default="postgresql+psycopg2://atlas:atlas@localhost:5432/atlas_clean",
        help="SQLAlchemy Postgres URL",
    )
    parser.add_argument(
        "--min-sondages",
        type=int,
        default=None,
        help="Optional filter: only keep mailles with n_sondages >= N",
    )
    parser.add_argument(
        "--out",
        default=None,
        help="Output XLSX path (default: <run_dir>/thematic_maille_matrix.xlsx)",
    )
    parser.add_argument(
        "--include-deleted-sondages",
        action="store_true",
        help="Include soft-deleted rows in the sondages sheet (default: active only)",
    )
    parser.add_argument(
        "--no-sondages-sheet",
        action="store_true",
        help="Skip the sondages listing sheet (mailles_2km only)",
    )
    parser.add_argument(
        "--no-lab-coverage-sheet",
        action="store_true",
        help="Skip sondages_lab_ip_vbs_eg sheet (IP/VBS/EG presence per survey + author)",
    )
    parser.add_argument(
        "--with-phase0-audit",
        action="store_true",
        help="Append Phase 0 AMESSEFE audit sheets (roadmap 30_03_2026 / ADR-008 gates)",
    )

    args = parser.parse_args()

    run_dir = Path(args.run_dir)
    index_path = run_dir / "index.json"
    with index_path.open("r", encoding="utf-8") as f:
        index: Dict[str, Any] = json.load(f)

    thematics = sorted({e.get("thematic") for e in index.get("exports", []) if isinstance(e, dict) and e.get("thematic")})
    if not thematics:
        raise SystemExit("No thematics found in index.json exports[]")

    out_path = Path(args.out) if args.out else (run_dir / "thematic_maille_matrix.xlsx")

    safe_cols: List[str] = []
    for t in thematics:
        if not isinstance(t, str):
            continue
        safe_cols.append(t)

    if not safe_cols:
        raise SystemExit("No valid thematics")

    select_exprs = [
        "s.code AS maille_code",
        "s.adm1_name AS adm1_name",
        "s.adm2_name AS adm2_name",
        "s.adm3_name AS adm3_name",
    ]

    has_any_exprs: List[str] = []
    for col in safe_cols:
        if col == "n_sondages":
            select_exprs.append("(COALESCE(s.n_sondages, 0) > 0) AS has_data_n_sondages")
            has_any_exprs.append("COALESCE(s.n_sondages, 0) > 0")
        else:
            select_exprs.append(f"(s.\"{col}\" IS NOT NULL) AS has_data_{col}")
            has_any_exprs.append(f"s.\"{col}\" IS NOT NULL")

    where_parts = ["(" + " OR ".join(has_any_exprs) + ")"]
    if args.min_sondages is not None:
        where_parts.append("COALESCE(s.n_sondages, 0) >= :min_sondages")

    sql = f"""
        SELECT
            {',\n            '.join(select_exprs)}
        FROM mailles_geotechnique_stats_wgs84 s
        WHERE {' AND '.join(where_parts)}
        ORDER BY s.code
    """

    engine = create_engine(args.pgurl)
    df_sondages: Optional[pd.DataFrame] = None
    df_lab: Optional[pd.DataFrame] = None
    df_p0_audit: Optional[pd.DataFrame] = None
    df_p0_depth: Optional[pd.DataFrame] = None
    df_p0_coll: Optional[pd.DataFrame] = None
    df_p0_cov: Optional[pd.DataFrame] = None
    with engine.begin() as conn:
        df = pd.read_sql(text(sql), conn, params={"min_sondages": args.min_sondages})
        if not args.no_sondages_sheet:
            df_sondages = pd.read_sql(
                text(SONDAGES_SHEET_SQL),
                conn,
                params={"include_deleted": args.include_deleted_sondages},
            )
        if not args.no_lab_coverage_sheet:
            df_lab = pd.read_sql(
                text(SONDAGES_LAB_IP_VBS_EG_SQL),
                conn,
                params={"include_deleted": args.include_deleted_sondages},
            )
        if args.with_phase0_audit:
            if not all(
                (
                    AUDIT_SONDAGES_ECHANTILLONS_SQL,
                    DEPTH_SUSPECTS_SQL,
                    COLLISIONS_SQL,
                    COVERAGE_SQL,
                )
            ):
                raise SystemExit("Phase 0 audit SQL not available (import audit_phase0_amessefe failed).")
            df_full = pd.read_sql(text(AUDIT_SONDAGES_ECHANTILLONS_SQL), conn)
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
            df_p0_audit = df_full[audit_cols].copy()
            df_p0_depth = pd.read_sql(text(DEPTH_SUSPECTS_SQL), conn)
            df_p0_coll = pd.read_sql(text(COLLISIONS_SQL), conn)
            df_p0_cov = pd.read_sql(text(COVERAGE_SQL), conn)

    out_path.parent.mkdir(parents=True, exist_ok=True)
    df = _strip_excel_unsupported_timezones(df)
    df_sondages = _strip_excel_unsupported_timezones(df_sondages)
    df_lab = _strip_excel_unsupported_timezones(df_lab)
    df_p0_audit = _strip_excel_unsupported_timezones(df_p0_audit)
    df_p0_depth = _strip_excel_unsupported_timezones(df_p0_depth)
    df_p0_coll = _strip_excel_unsupported_timezones(df_p0_coll)
    df_p0_cov = _strip_excel_unsupported_timezones(df_p0_cov)
    with pd.ExcelWriter(out_path, engine="openpyxl") as writer:
        df.to_excel(writer, index=False, sheet_name="mailles_2km")
        if df_sondages is not None:
            df_sondages.to_excel(writer, index=False, sheet_name="sondages")
        if df_lab is not None:
            df_lab.to_excel(writer, index=False, sheet_name="sondages_lab_ip_vbs_eg")
        if df_p0_audit is not None:
            df_p0_audit.to_excel(writer, index=False, sheet_name="phase0_audit_amessefe")
        if df_p0_depth is not None:
            df_p0_depth.to_excel(writer, index=False, sheet_name="phase0_depth_suspects")
        if df_p0_coll is not None:
            df_p0_coll.to_excel(writer, index=False, sheet_name="phase0_localite_key")
        if df_p0_cov is not None:
            df_p0_cov.to_excel(writer, index=False, sheet_name="phase0_coverage_src")

    print(f"[OK] Wrote {len(df)} maille rows to sheet 'mailles_2km': {out_path}")
    if df_sondages is not None:
        print(f"[OK] Wrote {len(df_sondages)} sondage rows to sheet 'sondages' (source = col.source || meta->>'source')")
    if df_lab is not None:
        incomplete = df_lab["meets_ip_and_vbs_and_eg"].eq(False).sum() if "meets_ip_and_vbs_and_eg" in df_lab.columns else 0
        print(
            f"[OK] Wrote {len(df_lab)} rows to 'sondages_lab_ip_vbs_eg' "
            f"({int(incomplete)} sans IP+VBS+EG complets — filtrer meets_ip_and_vbs_and_eg=false dans Excel)"
        )
    if df_p0_audit is not None:
        print(
            f"[OK] Phase 0: {len(df_p0_audit)} lignes audit, "
            f"{len(df_p0_depth)} depth suspects, {len(df_p0_coll)} clés en collision, "
            f"{len(df_p0_cov)} sources (couverture)"
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
