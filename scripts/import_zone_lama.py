#!/usr/bin/env python3
from __future__ import annotations

import argparse
import os
from dataclasses import dataclass
from typing import Iterable, Optional, Sequence, Tuple


@dataclass(frozen=True)
class LamaZoneInput:
    code: str = "DEPRESSION_LAMA_TG"
    srid_out: int = 25231  # SRID interne Atlas
    srid_in: int = 4326  # WGS84
    # Coordonnées WGS84 (lon, lat) - bande NNE-SSW (approximation réaliste)
    coords_wgs84: Tuple[Tuple[float, float], ...] = (
        (1.22, 6.22),
        (1.32, 6.18),
        (1.48, 6.22),
        (1.52, 6.35),
        (1.55, 6.55),
        (1.52, 6.72),
        (1.42, 6.88),
        (1.28, 6.90),
        (1.15, 6.78),
        (1.12, 6.58),
        (1.14, 6.38),
        (1.18, 6.28),
        (1.22, 6.22),
    )


def _require(name: str):
    try:
        return __import__(name)
    except Exception as e:
        raise SystemExit(
            f"Missing dependency '{name}'. Install requirements first.\n"
            f"Example: pip install -U psycopg2-binary shapely pyproj\n"
            f"Details: {e}"
        )


def _ensure_closed(coords: Sequence[Tuple[float, float]]) -> Sequence[Tuple[float, float]]:
    if len(coords) < 4:
        raise ValueError("Polygon needs at least 4 points.")
    if coords[0] != coords[-1]:
        return list(coords) + [coords[0]]
    return coords


def build_polygon_wgs84(coords: Sequence[Tuple[float, float]]):
    shapely = _require("shapely")
    from shapely.geometry import Polygon

    coords2 = _ensure_closed(coords)
    poly = Polygon(coords2)
    if not poly.is_valid:
        poly = poly.buffer(0)
    if not poly.is_valid:
        raise ValueError("Invalid polygon even after buffer(0).")
    return poly


def transform_polygon(poly, srid_in: int, srid_out: int):
    pyproj = _require("pyproj")
    from shapely.ops import transform as shp_transform

    transformer = pyproj.Transformer.from_crs(
        pyproj.CRS.from_epsg(srid_in),
        pyproj.CRS.from_epsg(srid_out),
        always_xy=True,
    )

    def _t(x, y, z=None):
        return transformer.transform(x, y)

    return shp_transform(_t, poly)


def build_polygon_from_gpkg(gpkg_path: str, layer_name: Optional[str] = None):
    gpd = _require("geopandas")
    gdf = gpd.read_file(gpkg_path, layer=layer_name) if layer_name else gpd.read_file(gpkg_path)
    if gdf.empty:
        raise ValueError(f"No geometry found in {gpkg_path}.")
    geom = gdf.unary_union
    if geom.geom_type == "Polygon":
        from shapely.geometry import MultiPolygon
        geom = MultiPolygon([geom])
    if not geom.is_valid:
        geom = geom.buffer(0)
    if not geom.is_valid:
        raise ValueError("Invalid geometry from GPKG.")
    return geom, gdf.crs


def polygon_area_km2(poly_25231) -> float:
    # 25231 est métrique → area en m²
    return float(poly_25231.area) / 1_000_000.0


def connect_pg(database_url: str):
    psycopg2 = _require("psycopg2")
    return psycopg2.connect(database_url)


def upsert_zone_geom(conn, zone_code: str, poly_25231_wkt: str, srid_out: int):
    with conn.cursor() as cur:
        cur.execute(
            """
            UPDATE atlas.zones_etude
            SET geom = ST_SetSRID(ST_GeomFromText(%s), %s),
                updated_at = NOW()
            WHERE code = %s
            """,
            (poly_25231_wkt, srid_out, zone_code),
        )
        if cur.rowcount != 1:
            raise RuntimeError(
                f"Zone code '{zone_code}' not found or not unique (updated {cur.rowcount} rows)."
            )


def recalc_zone_mailles(conn, zone_code: str):
    with conn.cursor() as cur:
        cur.execute("SELECT atlas.recalc_mailles_zones_etude(%s)", (zone_code,))


def get_zone_stats(conn, zone_code: str) -> Tuple[int, int]:
    with conn.cursor() as cur:
        cur.execute(
            """
            SELECT
              COUNT(*)::int AS total,
              SUM(CASE WHEN priorite_recherche = 1 THEN 1 ELSE 0 END)::int AS prio1
            FROM atlas.mailles_zones_etude mze
            JOIN atlas.zones_etude ze ON ze.id = mze.zone_id
            WHERE ze.code = %s
            """,
            (zone_code,),
        )
        row = cur.fetchone()
        return int(row[0] or 0), int(row[1] or 0)


def main(argv: Optional[Sequence[str]] = None) -> int:
    p = argparse.ArgumentParser(
        description="Met à jour la géométrie de la Dépression de la Lama et recalcule mailles_zones_etude."
    )
    p.add_argument(
        "--database-url",
        default=os.environ.get("DATABASE_URL", ""),
        help="Postgres URL (sinon env DATABASE_URL).",
    )
    p.add_argument("--zone-code", default="DEPRESSION_LAMA_TG")
    p.add_argument("--srid-in", type=int, default=4326)
    p.add_argument("--srid-out", type=int, default=25231)
    p.add_argument("--gpkg-path", default="", help="Optional GPKG path to use official geometry.")
    p.add_argument("--gpkg-layer", default="", help="Optional layer name in GPKG.")
    args = p.parse_args(argv)

    if not args.database_url:
        raise SystemExit("DATABASE_URL is required (arg --database-url or env DATABASE_URL).")

    zone = LamaZoneInput(code=args.zone_code, srid_in=args.srid_in, srid_out=args.srid_out)

    if args.gpkg_path:
        geom, crs = build_polygon_from_gpkg(args.gpkg_path, args.gpkg_layer or None)
        srid_in = zone.srid_in
        if crs is not None:
            try:
                epsg = crs.to_epsg() if hasattr(crs, "to_epsg") else None
                if epsg:
                    srid_in = int(epsg)
                else:
                    print("[lama] warning: GPKG CRS without EPSG; fallback to --srid-in / 4326")
            except Exception:
                print("[lama] warning: failed to resolve EPSG from GPKG CRS; fallback to --srid-in / 4326")
        poly_25231 = transform_polygon(geom, srid_in, zone.srid_out)
        print(f"[lama] source=gpkg:{args.gpkg_path}")
    else:
        poly_wgs84 = build_polygon_wgs84(zone.coords_wgs84)
        poly_25231 = transform_polygon(poly_wgs84, zone.srid_in, zone.srid_out)
        print("[lama] source=embedded-nne-ssw-approx")
    area_km2 = polygon_area_km2(poly_25231)

    print(f"[lama] zone_code={zone.code}")
    print(f"[lama] area_km2~{area_km2:.1f} (SRID {zone.srid_out})")
    print(f"[lama] centroid={poly_25231.centroid.x:.0f},{poly_25231.centroid.y:.0f} (SRID {zone.srid_out})")

    conn = connect_pg(args.database_url)
    try:
        conn.autocommit = False
        upsert_zone_geom(conn, zone.code, poly_25231.wkt, zone.srid_out)
        recalc_zone_mailles(conn, zone.code)
        total, prio1 = get_zone_stats(conn, zone.code)
        conn.commit()
    finally:
        conn.close()

    print(f"[lama] OK mailles_zones_etude total={total} prio1={prio1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

