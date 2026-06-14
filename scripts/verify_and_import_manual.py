#!/usr/bin/env python3
"""
Vérification des corrections manuelles + import DB.
- Compare surface _fix_manual vs _final pour chaque zone
- Importe directement sans clip (le clip se fera via intersection mailles)
- BADO : bado_me.shp (fichier avec nom différent)
"""
import os, json, logging
import geopandas as gpd
import psycopg2
from shapely.ops import unary_union
from shapely.geometry import MultiPolygon, Polygon

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("verify_import")

OUT    = "data/processed"
DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"

# ── Catalogue des zones ────────────────────────────────────────────────
zones = [
    {
        "code":       "DEPRESSION_LAMA_TG",
        "final":      "depression_lama_tg_final.gpkg",
        "corrected":  "depression_lama_tg_fix_manual.shp",
        "source":     "Correction manuelle QGIS 2026-06-14 — DEM 30m isocontour 35m",
        "biblio":     "Lamouroux 1960 (ORSTOM); Slansky 1962 (FAO SF:13/T0); RESULTAT délimitation 2026-06-14",
        "mineraux":   "{attapulgite,montmorillonite,kaolinite,illite}",
    },
    {
        "code":       "DEPRESSION_BADO_TG",
        "final":      "depression_bado_tg_final.gpkg",
        "corrected":  "bado_me.shp",
        "source":     "Correction manuelle QGIS 2026-06-14 — DEM 25m isocontour",
        "biblio":     "Willaime 1960, 1964 (ORSTOM); RESULTAT délimitation 2026-06-14",
        "mineraux":   None,
    },
    {
        "code":       "FOSSE_LIONS_TG",
        "final":      "fosse_lions_tg_final.gpkg",
        "corrected":  "fosse_lions_tg_fix_manual.shp",
        "source":     "Correction manuelle QGIS 2026-06-14 — WDPA p20 altitude",
        "biblio":     "WDPA TGO; Affaton 1975 (schistes néoprotérozoïques 993±65 Ma); RESULTAT délimitation 2026-06-14",
        "mineraux":   None,
    },
    {
        "code":       "PLAINE_MONO_TG",
        "final":      "plaine_mono_tg_final.gpkg",
        "corrected":  "plaine_mono_tg_fix_manual.shp",
        "source":     "Correction manuelle QGIS 2026-06-14 — JRC GSW Max Extent",
        "biblio":     "JRC/GSW1_4/GlobalSurfaceWater; effet barrage Nangbéto 1987; RESULTAT délimitation 2026-06-14",
        "mineraux":   None,
    },
    {
        "code":       "PLAINE_OTI_TG",
        "final":      "plaine_oti_tg_final.gpkg",
        "corrected":  "plaine_oti_tg_fix_manual.shp",
        "source":     "Correction manuelle QGIS 2026-06-14 — DEM 130m + OKM WDPA",
        "biblio":     "WDPA Oti-Kéran-Mandouri; OSM fleuve Oti; RESULTAT délimitation 2026-06-14",
        "mineraux":   None,
    },
]

# ── Cibles scientifiques pour validation ──────────────────────────────
cibles = {
    "DEPRESSION_LAMA_TG": (150, 700,  "230-450 km²"),
    "DEPRESSION_BADO_TG": (50,  500,  "92-300 km²"),
    "FOSSE_LIONS_TG":     (3,   30,   "7-8 km²"),
    "PLAINE_MONO_TG":     (200, 4000, ">300 km²"),
    "PLAINE_OTI_TG":      (100, 1500, "390-1350 km²"),
}


def compute_area_km2(gdf):
    """Surface en km² via projection UTM 31N (EPSG:32631)."""
    g = gdf.to_crs("EPSG:32631")
    return g.geometry.area.sum() / 1e6


def load_shape(path):
    full = os.path.join(OUT, path)
    if not os.path.exists(full):
        return None, None
    gdf = gpd.read_file(full)
    area = compute_area_km2(gdf)
    return gdf, area


def to_wkt_4326(gdf):
    g4326 = gdf.to_crs("EPSG:4326")
    union = unary_union(g4326.geometry.tolist())
    if isinstance(union, Polygon):
        union = MultiPolygon([union])
    return union.wkt


# ════════════════════════════════════════════════════════════════
# BLOC C — Vérification et rapport des surfaces
# ════════════════════════════════════════════════════════════════
log.info("\n" + "=" * 65)
log.info("BLOC C — Vérification corrections manuelles")
log.info("=" * 65)

results = {}

for z in zones:
    code = z["code"]
    gdf_final, area_final = load_shape(z["final"])
    gdf_corr,  area_corr  = load_shape(z["corrected"])

    mn, mx, lbl = cibles[code]

    log.info("\n[%s]", code)

    if area_final is not None:
        ok_f = "✓" if mn <= area_final <= mx else "✗"
        log.info("  Final automatique  : %7.1f km²  %s (cible: %s)", area_final, ok_f, lbl)
    else:
        log.info("  Final automatique  : MANQUANT")

    if area_corr is not None:
        ok_c = "✓" if mn <= area_corr <= mx else "✗  HORS CIBLE"
        log.info("  Correction manuelle: %7.1f km²  %s", area_corr, ok_c)
        if area_final and area_corr:
            delta = area_corr - area_final
            sens = "+" if delta >= 0 else ""
            log.info("  Delta              : %s%.1f km²", sens, delta)
        results[code] = {"gdf": gdf_corr, "area": area_corr, "ok": mn <= area_corr <= mx}
    else:
        log.warning("  Correction manuelle: MANQUANT — fichier %s introuvable", z["corrected"])
        if gdf_final is not None:
            log.info("  -> Fallback vers final automatique")
            results[code] = {"gdf": gdf_final, "area": area_final, "ok": mn <= area_final <= mx}
        else:
            results[code] = {"gdf": None, "area": 0, "ok": False}


# ── Rapport synthèse ──────────────────────────────────────────────────
log.info("\n" + "=" * 65)
log.info("SYNTHÈSE — Zones prêtes pour import DB")
log.info("=" * 65)
all_ok = True
for z in zones:
    code = z["code"]
    r = results.get(code, {})
    ok = r.get("ok", False)
    area = r.get("area", 0)
    mn, mx, lbl = cibles[code]
    status = "OK" if ok else "HORS_CIBLE"
    if not ok: all_ok = False
    log.info("  [%s] %-25s : %7.1f km²  (cible: %s)", status, code, area, lbl)

if not all_ok:
    log.warning("\n  Certaines zones sont hors cible — import quand même (clip via mailles en DB)")


# ════════════════════════════════════════════════════════════════
# BLOC D — Import en base de données
# ════════════════════════════════════════════════════════════════
log.info("\n" + "=" * 65)
log.info("BLOC D — Import DB atlas.zones_etude")
log.info("=" * 65)

try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # D0 — Backup
    log.info("\n[D0] Backup zones_etude...")
    cur.execute("""
        DROP TABLE IF EXISTS atlas.zones_etude_backup_20260614;
        CREATE TABLE atlas.zones_etude_backup_20260614
            AS SELECT * FROM atlas.zones_etude;
    """)
    cur.execute("SELECT COUNT(*) FROM atlas.zones_etude_backup_20260614")
    n_bak = cur.fetchone()[0]
    log.info("  Backup OK — %d zones dans zones_etude_backup_20260614", n_bak)

    # D1-D5 — UPDATE par zone
    imported = []
    for z in zones:
        code = z["code"]
        r = results.get(code)
        if not r or r["gdf"] is None:
            log.error("  [SKIP] %s — pas de géométrie disponible", code)
            continue

        wkt = to_wkt_4326(r["gdf"])
        log.info("\n  [D] UPDATE %s (%.1f km²)...", code, r["area"])

        # Vérifier validité
        cur.execute("SELECT ST_IsValid(ST_GeomFromText(%s, 4326))", (wkt,))
        is_valid = cur.fetchone()[0]

        if is_valid:
            cur.execute("""
                UPDATE atlas.zones_etude
                SET geom         = ST_Multi(ST_Transform(ST_GeomFromText(%s, 4326), 25231)),
                    geom_display = ST_Multi(ST_Transform(ST_GeomFromText(%s, 4326), 25231)),
                    source_donnees   = %s,
                    reference_biblio = %s,
                    updated_at       = now()
                WHERE code = %s
            """, (wkt, wkt, z["source"], z["biblio"], code))
        else:
            log.warning("  Géométrie invalide — ST_MakeValid + ST_CollectionExtract appliqués")
            cur.execute("""
                UPDATE atlas.zones_etude
                SET geom         = ST_Multi(ST_CollectionExtract(
                                       ST_MakeValid(ST_Transform(ST_GeomFromText(%s, 4326), 25231)), 3)),
                    geom_display = ST_Multi(ST_CollectionExtract(
                                       ST_MakeValid(ST_Transform(ST_GeomFromText(%s, 4326), 25231)), 3)),
                    source_donnees   = %s,
                    reference_biblio = %s,
                    updated_at       = now()
                WHERE code = %s
            """, (wkt, wkt, z["source"], z["biblio"], code))

        rows = cur.rowcount
        log.info("  -> %d ligne(s) mise(s) à jour", rows)

        # Minéraux si spécifiés
        if z.get("mineraux"):
            cur.execute("""
                UPDATE atlas.zones_etude
                SET mineraux_argileux = %s WHERE code = %s
            """, (z["mineraux"], code))
            log.info("  -> mineraux_argileux mis à jour")

        if rows > 0:
            imported.append(code)

    # D6 — Vérification post-UPDATE
    log.info("\n[D6] Vérification post-import (surfaces en DB)...")
    cur.execute("""
        SELECT code,
               ROUND((ST_Area(geom)/1e6)::numeric, 1) AS km2_geo,
               source_donnees
        FROM atlas.zones_etude
        WHERE code = ANY(%s)
        ORDER BY code
    """, ([z["code"] for z in zones],))

    log.info("  %-25s  %10s  %s", "CODE", "km² (DB)", "SOURCE")
    log.info("  " + "-" * 80)
    for code, km2, src in cur.fetchall():
        mn, mx, lbl = cibles.get(code, (0, 99999, "?"))
        ok = "✓" if mn <= float(km2 or 0) <= mx else "✗"
        log.info("  %-25s  %8.1f km²  %s  | %s", code, km2 or 0, ok, (src or "")[:45])

    # COMMIT
    conn.commit()
    log.info("\n  COMMIT OK — %d zones importées", len(imported))
    log.info("  Zones: %s", ", ".join(imported))

    # D7 — Reclassification mailles_zones_etude
    log.info("\n[D7] Reclassification mailles → zones_etude (intersection spatiale)...")
    conn2 = psycopg2.connect(DB_URL)
    conn2.autocommit = False
    cur2 = conn2.cursor()

    zone_codes = [z["code"] for z in zones]

    # Supprimer anciennes associations pour ces zones
    cur2.execute("""
        DELETE FROM atlas.mailles_zones_etude
        WHERE zone_id IN (
            SELECT id FROM atlas.zones_etude WHERE code = ANY(%s)
        )
    """, (zone_codes,))
    deleted = cur2.rowcount
    log.info("  Anciennes associations supprimées : %d", deleted)

    # Recalculer via intersection
    cur2.execute("""
        INSERT INTO atlas.mailles_zones_etude (maille_id, zone_id)
        SELECT m.id, z.id
        FROM atlas.mailles m
        JOIN atlas.zones_etude z ON ST_Intersects(m.geom, z.geom)
        WHERE z.code = ANY(%s)
        ON CONFLICT DO NOTHING
    """, (zone_codes,))
    inserted = cur2.rowcount
    log.info("  Nouvelles associations insérées   : %d", inserted)

    # Résultat par zone
    cur2.execute("""
        SELECT z.code, COUNT(*) as n_mailles
        FROM atlas.mailles_zones_etude mze
        JOIN atlas.zones_etude z ON z.id = mze.zone_id
        WHERE z.code = ANY(%s)
        GROUP BY z.code ORDER BY z.code
    """, (zone_codes,))
    log.info("\n  Mailles affectées par zone:")
    for code, n in cur2.fetchall():
        log.info("  %-25s : %d mailles", code, n)

    conn2.commit()
    log.info("\n  Reclassification OK")
    conn2.close()
    cur.close()
    conn.close()

    log.info("\n" + "=" * 65)
    log.info("BLOCS C + D TERMINÉS")
    log.info("  Backup : atlas.zones_etude_backup_20260614")
    log.info("  Rollback si besoin via ce backup")
    log.info("=" * 65)

except psycopg2.OperationalError as e:
    log.error("Connexion DB impossible : %s", e)
    log.info("Vérifier : PostgreSQL port 5433 actif ? DB atlas_clean accessible ?")
except Exception as e:
    log.exception("ERREUR : %s", e)
    if 'conn' in locals() and conn:
        conn.rollback()
        conn.close()
    raise
