#!/usr/bin/env python3
"""
Import final zones géologiques corrigées manuellement.
Commit après chaque UPDATE pour éviter rollback global.
"""
import os, logging
import geopandas as gpd
import psycopg2
from shapely.ops import unary_union
from shapely.geometry import MultiPolygon, Polygon

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("import_final")

OUT    = "data/processed"
DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"

zones = [
    {
        "code":      "DEPRESSION_LAMA_TG",
        "shp":       "depression_lama_tg_fix_manual.shp",
        "source":    "Correction manuelle QGIS 2026-06-14 — DEM 30m isocontour 35m",
        "biblio":    "Lamouroux 1960 (ORSTOM); Slansky 1962 (FAO SF:13/T0); RESULTAT delimitation 2026-06-14",
        "mineraux":  "{attapulgite,montmorillonite,kaolinite,illite}",
    },
    {
        "code":      "DEPRESSION_BADO_TG",
        "shp":       "bado_me.shp",
        "source":    "Correction manuelle QGIS 2026-06-14 — DEM 25m isocontour",
        "biblio":    "Willaime 1960, 1964 (ORSTOM); RESULTAT delimitation 2026-06-14",
        "mineraux":  None,
    },
    {
        "code":      "FOSSE_LIONS_TG",
        "shp":       "fosse_lions_tg_fix_manual.shp",
        "source":    "Correction manuelle QGIS 2026-06-14 — WDPA p20 altitude",
        "biblio":    "WDPA TGO; Affaton 1975; RESULTAT delimitation 2026-06-14",
        "mineraux":  None,
    },
    {
        "code":      "PLAINE_MONO_TG",
        "shp":       "plaine_mono_tg_fix_manual.shp",
        "source":    "Correction manuelle QGIS 2026-06-14 — JRC GSW Max Extent",
        "biblio":    "JRC/GSW1_4/GlobalSurfaceWater; barrage Nangbeto 1987; RESULTAT delimitation 2026-06-14",
        "mineraux":  None,
    },
    {
        "code":      "PLAINE_OTI_TG",
        "shp":       "plaine_oti_tg_fix_manual.shp",
        "source":    "Correction manuelle QGIS 2026-06-14 — DEM 130m + OKM WDPA",
        "biblio":    "WDPA Oti-Keran-Mandouri; OSM fleuve Oti; RESULTAT delimitation 2026-06-14",
        "mineraux":  None,
    },
]

def to_wkt_4326(shp_path):
    full = os.path.join(OUT, shp_path)
    gdf = gpd.read_file(full).to_crs("EPSG:4326")
    union = unary_union(gdf.geometry.tolist())
    if isinstance(union, Polygon):
        union = MultiPolygon([union])
    area_km2 = gdf.to_crs("EPSG:32631").geometry.area.sum() / 1e6
    return union.wkt, area_km2


# ── Connexion autocommit pour chaque opération ────────────────────────
conn = psycopg2.connect(DB_URL)
conn.autocommit = True
cur = conn.cursor()

# D0 — Backup
log.info("[D0] Backup...")
cur.execute("DROP TABLE IF EXISTS atlas.zones_etude_backup_20260614")
cur.execute("CREATE TABLE atlas.zones_etude_backup_20260614 AS SELECT * FROM atlas.zones_etude")
cur.execute("SELECT COUNT(*) FROM atlas.zones_etude_backup_20260614")
log.info("  Backup OK — %d zones", cur.fetchone()[0])

# D1-D5 — UPDATE par zone (autocommit = chaque UPDATE est son propre commit)
log.info("\n[D1-D5] UPDATE zones...")
imported = []
for z in zones:
    code = z["code"]
    shp_path = os.path.join(OUT, z["shp"])
    if not os.path.exists(shp_path):
        log.error("  SKIP %s — fichier manquant : %s", code, shp_path)
        continue

    wkt, area = to_wkt_4326(z["shp"])
    log.info("  [%s] %.1f km²...", code, area)

    # Vérifier validité WKT
    cur.execute("SELECT ST_IsValid(ST_GeomFromText(%s, 4326))", (wkt,))
    is_valid = cur.fetchone()[0]

    if is_valid:
        geom_expr = "ST_Multi(ST_Transform(ST_GeomFromText(%s, 4326), 25231))"
    else:
        # Invalide → MakeValid + extract polygons uniquement
        geom_expr = "ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Transform(ST_GeomFromText(%s, 4326), 25231)), 3))"
        log.warning("  -> géométrie invalide, ST_MakeValid appliqué")

    sql = f"""
        UPDATE atlas.zones_etude
        SET geom         = {geom_expr},
            geom_display = {geom_expr},
            source_donnees   = %s,
            reference_biblio = %s,
            updated_at       = now()
        WHERE code = %s
    """
    cur.execute(sql, (wkt, wkt, z["source"], z["biblio"], code))
    rows = cur.rowcount
    log.info("  -> %d ligne(s) mise(s) à jour", rows)

    if z.get("mineraux"):
        cur.execute("UPDATE atlas.zones_etude SET mineraux_argileux = %s WHERE code = %s",
                    (z["mineraux"], code))
        log.info("  -> mineraux_argileux mis à jour")

    if rows > 0:
        imported.append(code)

# D6 — Vérification (autocommit, lecture seule)
log.info("\n[D6] Vérification post-import...")
cibles = {
    "DEPRESSION_LAMA_TG": (150, 700,  "230-450 km2"),
    "DEPRESSION_BADO_TG": (50,  500,  "92-300 km2"),
    "FOSSE_LIONS_TG":     (3,   30,   "7-8 km2"),
    "PLAINE_MONO_TG":     (200, 4000, ">300 km2"),
    "PLAINE_OTI_TG":      (100, 1500, "390-1350 km2"),
}
cur.execute("""
    SELECT code,
           ROUND((ST_Area(geom)/1e6)::numeric, 1) AS km2,
           updated_at::date
    FROM atlas.zones_etude
    WHERE code = ANY(%s)
    ORDER BY code
""", ([z["code"] for z in zones],))

log.info("  %-25s  %8s  %-18s  %-4s  %s", "CODE", "km²", "CIBLE", "OK", "updated")
log.info("  " + "-" * 75)
for code, km2, upd in cur.fetchall():
    mn, mx, lbl = cibles.get(code, (0, 99999, "?"))
    ok = "OK" if mn <= float(km2 or 0) <= mx else "HORS"
    log.info("  %-25s  %8.1f  %-18s  %-4s  %s", code, float(km2 or 0), lbl, ok, upd)

# D7 — Reclassification mailles_zones_etude
log.info("\n[D7] Reclassification mailles → zones_etude...")
zone_codes = [z["code"] for z in zones]

cur.execute("""
    DELETE FROM atlas.mailles_zones_etude
    WHERE zone_id IN (SELECT id FROM atlas.zones_etude WHERE code = ANY(%s))
""", (zone_codes,))
log.info("  Anciennes associations supprimées : %d", cur.rowcount)

cur.execute("""
    INSERT INTO atlas.mailles_zones_etude (maille_id, zone_id)
    SELECT m.id, z.id
    FROM atlas.mailles m
    JOIN atlas.zones_etude z ON ST_Intersects(m.geom, z.geom)
    WHERE z.code = ANY(%s)
    ON CONFLICT DO NOTHING
""", (zone_codes,))
log.info("  Nouvelles associations insérées   : %d", cur.rowcount)

cur.execute("""
    SELECT z.code, COUNT(*) AS n
    FROM atlas.mailles_zones_etude mze
    JOIN atlas.zones_etude z ON z.id = mze.zone_id
    WHERE z.code = ANY(%s)
    GROUP BY z.code ORDER BY z.code
""", (zone_codes,))
log.info("\n  Mailles par zone:")
for code, n in cur.fetchall():
    log.info("  %-25s : %d mailles", code, n)

cur.close()
conn.close()

log.info("\n" + "=" * 65)
log.info("IMPORT TERMINÉ — %d zones importées", len(imported))
log.info("Backup : atlas.zones_etude_backup_20260614")
log.info("=" * 65)
