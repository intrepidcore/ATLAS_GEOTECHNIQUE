#!/usr/bin/env python3
"""
Import resource layers (GPKG/SHP) into Atlas context tables.

Usage:
  python scripts/import_resource_layers.py --database-url ... --gpkg "ressource/RISQUE_GONFLEMENT/carte_risque_gonflement.gpkg" --layer risque_gonflement --table atlas.risque_gonflement
"""

from __future__ import annotations

import argparse
import os
import sys
from typing import Optional, List, Dict

import psycopg2
from psycopg2.extras import execute_values


def require_geopandas():
    try:
        import geopandas as gpd  # type: ignore
    except Exception as e:  # pragma: no cover
        raise SystemExit(
            "geopandas is required for resource import. Install: pip install geopandas pyogrio fiona shapely"
        ) from e
    return gpd


def normalize_geom_to_25231(gdf):
    if gdf.crs is None:
        raise SystemExit("Input layer has no CRS; provide a valid CRS in source file.")
    return gdf.to_crs(epsg=25231)

def to_multipolygon_wkt(geom):
    if geom is None:
        return None
    gt = geom.geom_type
    if gt == "Polygon":
        from shapely.geometry import MultiPolygon  # type: ignore
        return MultiPolygon([geom]).wkt
    if gt == "MultiPolygon":
        return geom.wkt
    return None

def list_target_columns(cur, table: str) -> List[str]:
    schema, name = table.split(".", 1) if "." in table else ("public", table)
    cur.execute(
        """
        SELECT column_name
        FROM information_schema.columns
        WHERE table_schema = %s AND table_name = %s
        ORDER BY ordinal_position
        """,
        (schema, name),
    )
    return [r[0] for r in cur.fetchall()]

def pick_source_value(row: Dict[str, object], candidates: List[str]):
    for c in candidates:
        if c in row and row[c] not in (None, ""):
            return row[c]
    return None


def import_layer(database_url: str, src_path: str, layer: Optional[str], table: str) -> int:
    gpd = require_geopandas()
    gdf = gpd.read_file(src_path, layer=layer) if layer else gpd.read_file(src_path)
    if gdf.empty:
        return 0
    gdf = normalize_geom_to_25231(gdf)

    src_cols = [c for c in gdf.columns if c != "geometry"]
    src_cols_lc = {c.lower(): c for c in src_cols}
    rows = []
    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            target_cols_all = list_target_columns(cur, table)
    target_cols = [c for c in target_cols_all if c not in ("ogc_fid", "geom")]

    for _, row in gdf.iterrows():
        row_map = {c.lower(): row.get(c) for c in src_cols}
        mapped_attrs = []
        for tc in target_cols:
            tcl = tc.lower()
            if tcl in row_map:
                mapped_attrs.append(row_map[tcl])
                continue
            if tcl == "code":
                mapped_attrs.append(pick_source_value(row_map, ["code", "id", "toghgcomb", "togglg"]))
            elif tcl == "libelle":
                mapped_attrs.append(pick_source_value(row_map, ["libelle", "label", "name", "toghgcomb", "togglg"]))
            elif tcl == "description":
                mapped_attrs.append(pick_source_value(row_map, ["description", "desc", "type_sol", "type_sols"]))
            else:
                mapped_attrs.append(None)
        geom_wkt = to_multipolygon_wkt(row.geometry)
        if geom_wkt is None:
            continue
        rows.append(tuple(mapped_attrs + [geom_wkt]))

    with psycopg2.connect(database_url) as conn:
        with conn.cursor() as cur:
            cur.execute(f"TRUNCATE TABLE {table} RESTART IDENTITY")
            fields_sql = ", ".join(target_cols + ["geom"])
            tpl = "(" + ", ".join(["%s"] * len(target_cols)) + ", ST_GeomFromText(%s, 25231))"
            execute_values(cur, f"INSERT INTO {table} ({fields_sql}) VALUES %s", rows, template=tpl, page_size=1000)
    return len(rows)


def main() -> int:
    p = argparse.ArgumentParser()
    p.add_argument("--database-url", default=os.getenv("DATABASE_URL", ""))
    p.add_argument("--gpkg", required=True, help="Input GPKG/SHP path")
    p.add_argument("--layer", default=None, help="Layer name for GPKG")
    p.add_argument("--table", required=True, help="Target table (ex: atlas.risque_gonflement)")
    args = p.parse_args()

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required")
    n = import_layer(args.database_url, args.gpkg, args.layer, args.table)
    print(f'{{"success": true, "table": "{args.table}", "rows": {n}}}')
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

