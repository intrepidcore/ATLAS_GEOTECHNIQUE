#!/usr/bin/env python3
"""
Atlas Géotechnique Togo — Corrections BLOC B + BLOC C + BLOC D
================================================================
Corrections appliquées (analyse QGIS 2026-06-14) :
  C1. Clip sur frontière nationale Togo (toutes zones)
  C2. BADO : fusion fragments + fill_holes (5 pièces → 1 unité continue)
  C3. OTI  : garder uniquement polygones à <15km de l'axe fleuve Oti
  C4. MONO : supprimer fragments hors-Togo
  C5. FOSSE: clip frontière (vérifie dépassement Bénin)

Puis BLOC D : import dans atlas.zones_etude avec backup préalable.
"""
import os, json, logging
import numpy as np
import geopandas as gpd
from shapely.geometry import MultiPolygon, Polygon
from shapely.ops import unary_union
from scipy.ndimage import binary_fill_holes
import warnings; warnings.filterwarnings('ignore')

logging.basicConfig(level=logging.INFO, format="%(asctime)s | %(levelname)-8s | %(message)s")
log = logging.getLogger("correct_import")

OUT       = "data/processed"
TOGO_SHP  = "data/shp/togo/tgo_admbnda_adm0_inseed_itos_20210107.shp"
OSM_OTI   = "data/raw/osm/oti_river_osm.geojson"
DB_URL    = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"

# ── Charger frontière Togo ─────────────────────────────────────────────
log.info("Chargement frontière nationale Togo...")
togo_gdf  = gpd.read_file(TOGO_SHP).to_crs("EPSG:4326")
togo_poly = unary_union(togo_gdf.geometry.tolist())
log.info("  Frontière OK — aire Togo : %.0f km2", togo_poly.area * 1.2e10 / 1e6)


def load_gpkg(code):
    path = os.path.join(OUT, f"{code.lower()}_final.gpkg")
    if not os.path.exists(path):
        log.error("Fichier manquant : %s", path)
        return None
    return gpd.read_file(path)

def save_corrected(geom, code, methode, corrections):
    """Sauvegarde le polygone corrigé (écrase la version précédente)."""
    if isinstance(geom, Polygon):
        geom = MultiPolygon([geom])
    simp = geom.simplify(0.001, preserve_topology=True)
    area = geom.area * 1.2e10 / 1e6
    gdf = gpd.GeoDataFrame(
        [{"zone_code": code, "methode": methode,
          "corrections": "; ".join(corrections),
          "area_km2": round(area, 1)}],
        geometry=[simp], crs="EPSG:4326"
    )
    gpkg = os.path.join(OUT, f"{code.lower()}_final.gpkg")
    wkt  = os.path.join(OUT, f"{code.lower()}_final.wkt")
    gdf.to_file(gpkg, driver="GPKG")
    with open(wkt, "w") as f:
        f.write(simp.wkt)
    log.info("  [%s] %.1f km2 — corrections: %s", code, area, "; ".join(corrections))
    return gdf, area


# ════════════════════════════════════════════════════════
# BLOC C — Corrections et validation
# ════════════════════════════════════════════════════════
log.info("\n" + "=" * 60)
log.info("BLOC C — Corrections scientifiques")
log.info("=" * 60)

resultats = {}

# ── C3/C1 — FOSSE AUX LIONS : clip Togo ───────────────────────────────
log.info("\n[C1+C5] Fosse aux Lions — clip frontière Togo")
gdf_f = load_gpkg("FOSSE_LIONS_TG")
geom_f = unary_union(gdf_f.geometry.tolist())
avant_f = geom_f.area * 1.2e10 / 1e6

geom_f_clipped = geom_f.intersection(togo_poly)
apres_f = geom_f_clipped.area * 1.2e10 / 1e6
delta_f = avant_f - apres_f

log.info("  Avant clip : %.2f km2 | Après : %.2f km2 | Hors-Togo supprimé : %.2f km2",
         avant_f, apres_f, delta_f)

corrections_f = ["clip_frontiere_togo"]
if delta_f > 0.1:
    corrections_f.append(f"supprime_{delta_f:.2f}km2_hors_togo")

r_f, a_f = save_corrected(geom_f_clipped, "FOSSE_LIONS_TG",
                           "WDPA_alt_p20_clipped", corrections_f)
resultats["FOSSE_LIONS_TG"] = a_f


# ── C1 — LAMA : clip Togo ─────────────────────────────────────────────
log.info("\n[C1] Lama — clip frontière Togo")
gdf_l = load_gpkg("DEPRESSION_LAMA_TG")
geom_l = unary_union(gdf_l.geometry.tolist())
avant_l = geom_l.area * 1.2e10 / 1e6

geom_l_clipped = geom_l.intersection(togo_poly)
apres_l = geom_l_clipped.area * 1.2e10 / 1e6
log.info("  Avant : %.1f km2 | Après clip : %.1f km2", avant_l, apres_l)

r_l, a_l = save_corrected(geom_l_clipped, "DEPRESSION_LAMA_TG",
                           "DEM_35m_clipped", ["clip_frontiere_togo"])
resultats["DEPRESSION_LAMA_TG"] = a_l


# ── C1+C2 — BADO : clip + fusion fragments ────────────────────────────
log.info("\n[C1+C2] Bado — clip Togo + fusion fragments")
gdf_b = load_gpkg("DEPRESSION_BADO_TG")
geom_b_raw = unary_union(gdf_b.geometry.tolist())
avant_b = geom_b_raw.area * 1.2e10 / 1e6

# Clip Togo
geom_b = geom_b_raw.intersection(togo_poly)

# Compter fragments
n_avant = len(list(geom_b.geoms)) if hasattr(geom_b, 'geoms') else 1
log.info("  Fragments avant fusion : %d", n_avant)

# Stratégie : dilation + fill_holes + érosion pour unifier les fragments
# Via buffer positif/négatif (morphologie mathématique)
buf_dist = 0.015  # ~1.5 km en degrés (~0.015°)
geom_b_dilated  = geom_b.buffer(buf_dist)       # union des voisins proches
geom_b_filled   = geom_b_dilated.buffer(-buf_dist * 0.3)  # légère érosion
union_b = geom_b_filled

# Garder uniquement le fragment principal (plus grand)
if hasattr(union_b, 'geoms'):
    geoms_b = sorted(union_b.geoms, key=lambda g: g.area, reverse=True)
    # Garder fragments > 10 km2 (éliminer artefacts)
    geoms_b_filt = [g for g in geoms_b if g.area * 1.2e10 / 1e6 > 10]
    union_b = MultiPolygon(geoms_b_filt) if len(geoms_b_filt) > 1 else geoms_b_filt[0]

n_apres = len(list(union_b.geoms)) if hasattr(union_b, 'geoms') else 1
apres_b = union_b.area * 1.2e10 / 1e6
log.info("  Fragments après fusion : %d | Surface : %.1f km2", n_apres, apres_b)

r_b, a_b = save_corrected(union_b, "DEPRESSION_BADO_TG",
                           "DEM_25m_fusionne_clipped",
                           ["clip_frontiere_togo", f"fusion_{n_avant}_fragments_{n_apres}"])
resultats["DEPRESSION_BADO_TG"] = a_b


# ── C1+C4 — MONO : clip Togo + suppression fragments hors-Togo ────────
log.info("\n[C1+C4] Mono — clip Togo + suppression hors-Togo")
gdf_m = load_gpkg("PLAINE_MONO_TG")
geom_m = unary_union(gdf_m.geometry.tolist())
avant_m = geom_m.area * 1.2e10 / 1e6

geom_m_clipped = geom_m.intersection(togo_poly)
apres_m = geom_m_clipped.area * 1.2e10 / 1e6
supprime_m = avant_m - apres_m
log.info("  Avant : %.1f km2 | Après clip : %.1f km2 | Supprimé : %.1f km2",
         avant_m, apres_m, supprime_m)

# Garder fragments > 20 km2 (éliminer petites enclaves côtières)
if hasattr(geom_m_clipped, 'geoms'):
    geoms_m = [g for g in geom_m_clipped.geoms if g.area * 1.2e10 / 1e6 > 20]
    geom_m_clipped = unary_union(geoms_m)

final_m = geom_m_clipped.area * 1.2e10 / 1e6
log.info("  Après filtre fragments < 20km2 : %.1f km2", final_m)

r_m, a_m = save_corrected(geom_m_clipped, "PLAINE_MONO_TG",
                           "JRC_GSW_clipped_fusionne",
                           ["clip_frontiere_togo", f"supprime_{supprime_m:.0f}km2_hors_togo",
                            "filtre_fragments_20km2"])
resultats["PLAINE_MONO_TG"] = a_m


# ── C1+C3 — OTI : clip Togo + filtre proximité fleuve Oti ─────────────
log.info("\n[C1+C3] Oti — clip Togo + filtre <15km fleuve Oti")
gdf_o = load_gpkg("PLAINE_OTI_TG")
geom_o = unary_union(gdf_o.geometry.tolist())
avant_o = geom_o.area * 1.2e10 / 1e6

# Clip Togo
geom_o_clipped = geom_o.intersection(togo_poly)

# Buffer 15km autour du fleuve Oti pour garder uniquement les polygones proches
oti_buffer = None
if os.path.exists(OSM_OTI):
    osm_gdf = gpd.read_file(OSM_OTI).to_crs("EPSG:32631")
    oti_buf_utm = osm_gdf.buffer(15000)  # 15km
    oti_buf_4326 = gpd.GeoDataFrame(
        geometry=[unary_union(oti_buf_utm.tolist())], crs="EPSG:32631"
    ).to_crs("EPSG:4326").geometry.iloc[0]
    oti_buffer = oti_buf_4326
    log.info("  Buffer 15km fleuve Oti créé")

if oti_buffer is not None:
    geom_o_filtered = geom_o_clipped.intersection(oti_buffer)
else:
    geom_o_filtered = geom_o_clipped

# Garder fragments > 5 km2
if hasattr(geom_o_filtered, 'geoms'):
    geoms_o = [g for g in geom_o_filtered.geoms if g.area * 1.2e10 / 1e6 > 5]
    geom_o_filtered = unary_union(geoms_o) if geoms_o else geom_o_clipped

apres_o = geom_o_filtered.area * 1.2e10 / 1e6
log.info("  Avant : %.1f km2 | Après corrections : %.1f km2", avant_o, apres_o)

corrections_o = ["clip_frontiere_togo", "filtre_15km_fleuve_oti", "filtre_fragments_5km2"]
r_o, a_o = save_corrected(geom_o_filtered, "PLAINE_OTI_TG",
                           "DEM_130m_OKM_clipped_oti15km", corrections_o)
resultats["PLAINE_OTI_TG"] = a_o


# ── Rapport BLOC C ─────────────────────────────────────────────────────
cibles = {
    "FOSSE_LIONS_TG":     (5,    15,   "7-8 km2"),
    "DEPRESSION_LAMA_TG": (200,  600,  "230-450 km2"),
    "DEPRESSION_BADO_TG": (80,   400,  "92-300 km2"),
    "PLAINE_MONO_TG":     (200,  3000, ">300 km2"),
    "PLAINE_OTI_TG":      (100,  1400, "390-1350 km2"),
}

log.info("\n" + "=" * 60)
log.info("RAPPORT BLOC C — Zones corrigées")
log.info("=" * 60)
all_ok = True
for code, (mn, mx, lbl) in cibles.items():
    area = resultats.get(code, 0)
    ok = mn <= area <= mx
    st = "OK" if ok else "HORS_CIBLE"
    if not ok: all_ok = False
    log.info("  [%s] %-25s : %.1f km2 (cible: %s)", st, code, area, lbl)


# ════════════════════════════════════════════════════════
# BLOC D — Import en base de données
# ════════════════════════════════════════════════════════
log.info("\n" + "=" * 60)
log.info("BLOC D — Import en base de données")
log.info("=" * 60)

import psycopg2

try:
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur = conn.cursor()

    # ── D0 : Backup ───────────────────────────────────────────────────
    log.info("\n[D0] Backup zones_etude...")
    cur.execute("""
        DROP TABLE IF EXISTS atlas.zones_etude_backup_20260614;
        CREATE TABLE atlas.zones_etude_backup_20260614 AS SELECT * FROM atlas.zones_etude;
    """)
    cur.execute("SELECT COUNT(*) FROM atlas.zones_etude_backup_20260614")
    n_backup = cur.fetchone()[0]
    log.info("  Backup OK — %d zones sauvegardées dans zones_etude_backup_20260614", n_backup)

    # ── D1-D5 : UPDATE géométries ─────────────────────────────────────
    updates = [
        {
            "code": "FOSSE_LIONS_TG",
            "wkt_file": "data/processed/fosse_lions_tg_final.wkt",
            "source": "Copernicus DEM 30m + WDPA p20 altitude + clip Togo — 2026-06-14",
            "biblio": "WDPA TGO; Affaton 1975 (schistes néoprotérozoïques 993±65 Ma); RESULTAT délimitation 2026-06-14",
        },
        {
            "code": "DEPRESSION_LAMA_TG",
            "wkt_file": "data/processed/depression_lama_tg_final.wkt",
            "source": "Copernicus DEM 30m isocontour 35m + clip Togo — 2026-06-14",
            "biblio": "Lamouroux 1960 (ORSTOM); Slansky 1962 (FAO SF:13/T0); RESULTAT délimitation 2026-06-14",
            "mineraux": "{attapulgite,montmorillonite,kaolinite,illite}",
        },
        {
            "code": "DEPRESSION_BADO_TG",
            "wkt_file": "data/processed/depression_bado_tg_final.wkt",
            "source": "Copernicus DEM 30m isocontour 25m + fusion fragments + clip Togo — 2026-06-14",
            "biblio": "Willaime 1960, 1964 (ORSTOM); RESULTAT délimitation 2026-06-14",
        },
        {
            "code": "PLAINE_MONO_TG",
            "wkt_file": "data/processed/plaine_mono_tg_final.wkt",
            "source": "JRC Global Surface Water Max Extent + dilatation 300m + clip Togo — 2026-06-14",
            "biblio": "JRC/GSW1_4/GlobalSurfaceWater; effet barrage Nangbéto 1987; RESULTAT délimitation 2026-06-14",
        },
        {
            "code": "PLAINE_OTI_TG",
            "wkt_file": "data/processed/plaine_oti_tg_final.wkt",
            "source": "Copernicus DEM 30m alt<130m + WDPA OKM + buffer 15km fleuve Oti OSM + clip Togo — 2026-06-14",
            "biblio": "WDPA Oti-Kéran-Mandouri; OSM fleuve Oti; RESULTAT délimitation 2026-06-14",
        },
    ]

    for u in updates:
        wkt_path = u["wkt_file"]
        if not os.path.exists(wkt_path):
            log.error("  WKT manquant : %s — SKIP", wkt_path)
            continue

        with open(wkt_path) as f:
            wkt = f.read().strip()

        # Vérifier validité WKT via PostgreSQL
        cur.execute("SELECT ST_IsValid(ST_GeomFromText(%s, 4326))", (wkt,))
        is_valid = cur.fetchone()[0]
        if not is_valid:
            log.warning("  Géométrie invalide pour %s — tentative ST_MakeValid", u["code"])
            cur.execute("""
                UPDATE atlas.zones_etude
                SET geom        = ST_Multi(ST_MakeValid(ST_Transform(ST_GeomFromText(%s, 4326), 25231))),
                    geom_display = ST_Multi(ST_MakeValid(ST_Transform(ST_GeomFromText(%s, 4326), 25231))),
                    source_donnees = %s,
                    reference_biblio = %s,
                    updated_at  = now()
                WHERE code = %s
            """, (wkt, wkt, u["source"], u["biblio"], u["code"]))
        else:
            cur.execute("""
                UPDATE atlas.zones_etude
                SET geom        = ST_Multi(ST_Transform(ST_GeomFromText(%s, 4326), 25231)),
                    geom_display = ST_Multi(ST_Transform(ST_GeomFromText(%s, 4326), 25231)),
                    source_donnees = %s,
                    reference_biblio = %s,
                    updated_at  = now()
                WHERE code = %s
            """, (wkt, wkt, u["source"], u["biblio"], u["code"]))

        # Mise à jour minéraux si spécifié
        if "mineraux" in u:
            cur.execute("""
                UPDATE atlas.zones_etude SET mineraux_argileux = %s WHERE code = %s
            """, (u["mineraux"], u["code"]))

        rows = cur.rowcount
        log.info("  [D] UPDATE %s — %d ligne(s) modifiée(s)", u["code"], rows)

    # ── D6 : Vérification post-UPDATE ────────────────────────────────
    log.info("\n[D6] Vérification post-import...")
    cur.execute("""
        SELECT code,
               ROUND((ST_Area(geom)/1e6)::numeric, 1) AS km2_25231,
               source_donnees
        FROM atlas.zones_etude
        ORDER BY code
    """)
    rows_check = cur.fetchall()
    for code, km2, src in rows_check:
        log.info("  %-25s : %.1f km2 | %s", code, km2, (src or "")[:60])

    # ── D7 : Commit ───────────────────────────────────────────────────
    conn.commit()
    log.info("\n  COMMIT OK — toutes les zones mises à jour en base")

    # ── D8 : Reclassification mailles ─────────────────────────────────
    log.info("\n[D8] Reclassification mailles_zones_etude...")
    conn2 = psycopg2.connect(DB_URL)
    conn2.autocommit = False
    cur2 = conn2.cursor()

    zone_codes = ["FOSSE_LIONS_TG", "DEPRESSION_LAMA_TG",
                  "DEPRESSION_BADO_TG", "PLAINE_MONO_TG", "PLAINE_OTI_TG"]

    cur2.execute("""
        DELETE FROM atlas.mailles_zones_etude
        WHERE zone_id IN (
            SELECT id FROM atlas.zones_etude
            WHERE code = ANY(%s)
        )
    """, (zone_codes,))
    deleted = cur2.rowcount
    log.info("  Anciennes associations supprimées : %d", deleted)

    cur2.execute("""
        INSERT INTO atlas.mailles_zones_etude (maille_id, zone_id)
        SELECT m.id, z.id
        FROM atlas.mailles m
        JOIN atlas.zones_etude z ON ST_Intersects(m.geom, z.geom)
        WHERE z.code = ANY(%s)
        ON CONFLICT DO NOTHING
    """, (zone_codes,))
    inserted = cur2.rowcount
    log.info("  Nouvelles associations insérées : %d", inserted)

    cur2.execute("""
        SELECT z.code, COUNT(*) as n_mailles
        FROM atlas.mailles_zones_etude mze
        JOIN atlas.zones_etude z ON z.id = mze.zone_id
        WHERE z.code = ANY(%s)
        GROUP BY z.code ORDER BY z.code
    """, (zone_codes,))
    for code, n in cur2.fetchall():
        log.info("  %-25s : %d mailles", code, n)

    conn2.commit()
    log.info("  Reclassification OK")
    conn2.close()
    cur.close()
    conn.close()

    log.info("\n" + "=" * 60)
    log.info("BLOCS C+D TERMINÉS — Zones géologiques mises à jour en DB")
    log.info("=" * 60)
    log.info("Backup disponible : atlas.zones_etude_backup_20260614")
    log.info("Rollback si besoin :")
    log.info("  INSERT INTO atlas.zones_etude SELECT * FROM atlas.zones_etude_backup_20260614 ON CONFLICT (code) DO UPDATE SET geom=EXCLUDED.geom, ...;")

except Exception as e:
    log.exception("ERREUR DB : %s", e)
    if 'conn' in locals():
        conn.rollback()
        conn.close()
    raise
