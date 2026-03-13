#!/usr/bin/env python3
"""audit_geotech_localites_matrix.py

Génère un fichier Excel d'audit de complétude des données géotechniques.

- Granularité principale: localité (clé de regroupement = valeur "terrain" issue de sondages)
- 1 onglet = 1 localité (agrégats et flags has_data_*)
- 1 onglet = liste des sondages (flags par sondage)

Connexion DB:
- Read-only via `docker exec -i atlas-db psql ...` (aucune écriture)

Sortie:
- exports/audit_geotech_localites_matrix.xlsx
"""

from __future__ import annotations

from dataclasses import dataclass
from pathlib import Path
import subprocess
import sys
from typing import List, Dict, Any

import pandas as pd


BASE_DIR = Path(__file__).resolve().parent.parent
OUTPUT_PATH = BASE_DIR / "exports" / "audit_geotech_localites_matrix.xlsx"

DB_CONTAINER = "atlas-db"
DB_USER = "atlas"
DB_NAME = "atlas_clean"
DB_SCHEMA = "atlas"


@dataclass(frozen=True)
class QueryResult:
    columns: List[str]
    rows: List[List[str]]


def run_psql_tsv(sql: str) -> QueryResult:
    cmd = [
        "docker",
        "exec",
        "-i",
        DB_CONTAINER,
        "psql",
        "-U",
        DB_USER,
        "-d",
        DB_NAME,
        "-v",
        "ON_ERROR_STOP=1",
        "-A",
        "-F",
        "\t",
        "-P",
        "footer=off",
        "-P",
        "tuples_only=on",
        "-c",
        sql,
    ]

    res = subprocess.run(cmd, capture_output=True, text=True)
    if res.returncode != 0:
        raise RuntimeError(f"psql failed: {res.stderr.strip()}")

    lines = [ln for ln in res.stdout.splitlines() if ln.strip()]
    if not lines:
        return QueryResult(columns=[], rows=[])

    # We cannot easily fetch headers with tuples_only=on.
    # The caller must pass explicit column list OR rely on known order.
    rows = [ln.split("\t") for ln in lines]
    return QueryResult(columns=[], rows=rows)


def build_sondages_df() -> pd.DataFrame:
    sql = f"""
    WITH base AS (
      SELECT
        s.id::text AS sondage_id,
        s.code AS sondage_code,
        s.source AS source,
        COALESCE(
          NULLIF(s.localite_key, ''),
          NULLIF(s.localite_base, ''),
          NULLIF(s.localite, ''),
          NULLIF(s.meta->>'localite', ''),
          NULLIF(s.adm3_name, ''),
          '(unknown)'
        ) AS localite_key,
        COALESCE(s.location_mode, s.loc_mode, s.location_accuracy, 'unknown') AS location_mode,
        COALESCE(s.is_geocoded, false) AS is_geocoded
      FROM {DB_SCHEMA}.sondages s
      WHERE s.deleted_at IS NULL
    )
    SELECT
      b.sondage_id,
      b.sondage_code,
      b.source,
      b.localite_key,
      b.location_mode,
      b.is_geocoded::text,

      -- Presence flags (per sondage)
      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_vbs v ON v.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND v.vbs IS NOT NULL
      )::text AS has_data_vbs,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_atterberg a ON a.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND a.wl IS NOT NULL
      )::text AS has_data_wl,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_atterberg a ON a.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND a.wp IS NOT NULL
      )::text AS has_data_wp,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_atterberg a ON a.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND (
            a.ip_generated IS NOT NULL
            OR (a.wl IS NOT NULL AND a.wp IS NOT NULL)
          )
      )::text AS has_data_ip,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_proctor p ON p.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND p.gamma_d_max IS NOT NULL
      )::text AS has_data_gamma_d_max,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_proctor p ON p.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND p.w_opt IS NOT NULL
      )::text AS has_data_w_opt,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.granulo_points g ON g.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND g.sieve_mm = 0.08
          AND g.passing_pct IS NOT NULL
      )::text AS has_data_passant_80um,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.granulo_points g ON g.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND g.sieve_mm = 2
          AND g.passing_pct IS NOT NULL
      )::text AS has_data_passant_2mm,

      EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        WHERE e.sondage_id = b.sondage_id::uuid
          AND e.eg IS NOT NULL
      )
      OR EXISTS (
        SELECT 1
        FROM {DB_SCHEMA}.echantillons e
        JOIN {DB_SCHEMA}.essais_potentiel_gonflement eg ON eg.echantillon_id = e.id
        WHERE e.sondage_id = b.sondage_id::uuid
          AND eg.cg IS NOT NULL
      )
      AS has_data_eg
    FROM base b
    ORDER BY b.localite_key, b.sondage_code;
    """

    qr = run_psql_tsv(sql)

    columns = [
        "sondage_id",
        "sondage_code",
        "source",
        "localite_key",
        "location_mode",
        "is_geocoded",
        "has_data_vbs",
        "has_data_wl",
        "has_data_wp",
        "has_data_ip",
        "has_data_gamma_d_max",
        "has_data_w_opt",
        "has_data_passant_80um",
        "has_data_passant_2mm",
        "has_data_eg",
    ]

    df = pd.DataFrame(qr.rows, columns=columns)

    def to_bool(x: Any) -> bool:
        if x is None:
            return False
        s = str(x).strip().lower()
        return s in {"t", "true", "1", "yes", "y"}

    bool_cols = [
        "is_geocoded",
        "has_data_vbs",
        "has_data_wl",
        "has_data_wp",
        "has_data_ip",
        "has_data_gamma_d_max",
        "has_data_w_opt",
        "has_data_passant_80um",
        "has_data_passant_2mm",
    ]

    for c in bool_cols:
        df[c] = df[c].map(to_bool)

    # has_data_eg is computed as boolean expression but comes out as 't'/'f' as well
    df["has_data_eg"] = df["has_data_eg"].map(to_bool)

    df["localite_key"] = df["localite_key"].fillna("(unknown)")
    df["location_mode"] = df["location_mode"].fillna("unknown")

    return df


def build_localites_df(sondages_df: pd.DataFrame) -> pd.DataFrame:
    def top_mode(series: pd.Series) -> str:
        if series.empty:
            return "unknown"
        vc = series.fillna("unknown").value_counts()
        if vc.empty:
            return "unknown"
        return str(vc.index[0])

    g = sondages_df.groupby("localite_key", dropna=False)

    out = pd.DataFrame(
        {
            "localite_key": g.size().index,
            "has_data_eg_avg": g["has_data_eg"].any().values,
            "has_data_gamma_d_max_avg": g["has_data_gamma_d_max"].any().values,
            "has_data_ip_avg": g["has_data_ip"].any().values,
            "has_data_n_sondages": (g.size() > 0).values,
            "has_data_passant_2mm_avg": g["has_data_passant_2mm"].any().values,
            "has_data_passant_80um_avg": g["has_data_passant_80um"].any().values,
            "has_data_vbs_avg": g["has_data_vbs"].any().values,
            "has_data_w_opt_avg": g["has_data_w_opt"].any().values,
            "has_data_wl_avg": g["has_data_wl"].any().values,
            "has_data_wp_avg": g["has_data_wp"].any().values,
            "n_sondages": g.size().values,
            "n_geocoded": g["is_geocoded"].sum().values,
            "pct_geocoded": (g["is_geocoded"].mean() * 100).round(1).values,
            "location_mode_top": g["location_mode"].agg(top_mode).values,
        }
    )

    # Stable ordering: by missingness then name
    out = out.sort_values(["n_sondages", "localite_key"], ascending=[False, True])

    return out


def build_option1_matrix(localites_df: pd.DataFrame) -> pd.DataFrame:
    """Option 1: matrice minimaliste calquée sur thematic_maille_matrix_fixed.xlsx.

    Ici la granularité est la localité (localite_key) au lieu de maille_code/ADM.
    """
    cols = [
        "localite_key",
        "has_data_eg_avg",
        "has_data_gamma_d_max_avg",
        "has_data_ip_avg",
        "has_data_n_sondages",
        "has_data_passant_2mm_avg",
        "has_data_passant_80um_avg",
        "has_data_vbs_avg",
        "has_data_w_opt_avg",
        "has_data_wl_avg",
        "has_data_wp_avg",
    ]
    return localites_df.loc[:, cols].copy()


def build_option2_enriched(localites_df: pd.DataFrame) -> pd.DataFrame:
    """Option 2: audit enrichi (has_data + no_data + stats géocodage)."""
    df = localites_df.copy()

    has_cols = [
        "has_data_eg_avg",
        "has_data_gamma_d_max_avg",
        "has_data_ip_avg",
        "has_data_n_sondages",
        "has_data_passant_2mm_avg",
        "has_data_passant_80um_avg",
        "has_data_vbs_avg",
        "has_data_w_opt_avg",
        "has_data_wl_avg",
        "has_data_wp_avg",
    ]

    for c in has_cols:
        df[f"no_data_{c.removeprefix('has_data_')}"] = ~df[c].astype(bool)

    # Ordre de colonnes lisible
    base_cols = [
        "localite_key",
        "n_sondages",
        "n_geocoded",
        "pct_geocoded",
        "location_mode_top",
    ]
    no_cols = [f"no_data_{c.removeprefix('has_data_')}" for c in has_cols]
    cols = base_cols + has_cols + no_cols
    return df.loc[:, cols]


def build_missing_matrix(option1_df: pd.DataFrame) -> pd.DataFrame:
    """Filtre des localités où il manque au moins un type de données."""
    flag_cols = [c for c in option1_df.columns if c.startswith("has_data_")]
    if not flag_cols:
        return option1_df.copy()

    mask_missing = ~option1_df[flag_cols].all(axis=1)
    out = option1_df.loc[mask_missing].copy()
    return out


def main() -> int:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)

    sondages_df = build_sondages_df()
    localites_df = build_localites_df(sondages_df)

    option1_df = build_option1_matrix(localites_df)
    option2_df = build_option2_enriched(localites_df)
    missing_df = build_missing_matrix(option1_df)

    with pd.ExcelWriter(OUTPUT_PATH, engine="openpyxl") as writer:
        # Option 1: matrice minimaliste
        option1_df.to_excel(writer, sheet_name="matrix_option1", index=False)

        # Option 2: audit enrichi
        option2_df.to_excel(writer, sheet_name="audit_option2", index=False)

        # Missing matrix
        missing_df.to_excel(writer, sheet_name="missing_matrix", index=False)

        # Détail sondages
        sondages_cols = [
            "localite_key",
            "sondage_code",
            "source",
            "is_geocoded",
            "location_mode",
            "has_data_eg",
            "has_data_gamma_d_max",
            "has_data_w_opt",
            "has_data_ip",
            "has_data_wl",
            "has_data_wp",
            "has_data_vbs",
            "has_data_passant_80um",
            "has_data_passant_2mm",
            "sondage_id",
        ]
        sondages_df.to_excel(writer, sheet_name="sondages", index=False, columns=sondages_cols)

    print(f"✅ Excel généré: {OUTPUT_PATH}")
    print(f"   - Localités: {len(localites_df)}")
    print(f"   - Missing localités: {len(missing_df)}")
    print(f"   - Sondages: {len(sondages_df)}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
