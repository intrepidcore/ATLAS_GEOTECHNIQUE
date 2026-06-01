#!/usr/bin/env python3
"""
phase_02_import_sondages.py — Import sondages V10 avec géocodage
Intrepid Core Engineering Standards

Actions :
  - Insert nouveaux sondages dans atlas.sondages
  - Coordonnées WGS84 : insert direct
  - Coordonnées UTM31N : ST_Transform(EPSG:32631 -> 4326) via PostGIS
  - Coordonnées NULL   : centroïde adm3 depuis description_localisation du projet
                         is_geocoded=FALSE, location_mode='estimated_adm3_centroid'
"""
import sys, csv, logging, re
from pathlib import Path
from collections import defaultdict

import psycopg2
import psycopg2.extras

sys.path.insert(0, str(Path(__file__).parent))
from config import DATABASE_URL, V10_FILES, CSV_SEP, LOGS_DIR, is_utm31n, IMPORT_BATCH

log_file = LOGS_DIR / "phase_02_sondages.log"
logging.basicConfig(level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[logging.FileHandler(log_file, encoding="utf-8"),
              logging.StreamHandler(sys.stdout)])
log = logging.getLogger(__name__)


def safe_float(val):
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None


def read_csv(path):
    """Lit un CSV ; gere colonnes extra (list) + valeurs NULL string."""
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_SEP)
        for row in reader:
            clean = {}
            for k, v in row.items():
                if k is None:
                    continue
                if isinstance(v, list):
                    v = v[0] if v else None
                sv = v.strip() if v and isinstance(v, str) else None
                clean[k] = None if sv in ("NULL", "null", "None", "") else sv
            if any(v for v in clean.values()):
                rows.append(clean)
    return rows


def normalize_loc_name(name: str) -> str:
    """Normalise un nom pour correspondance floue."""
    if not name:
        return ""
    return re.sub(r"[^a-z0-9]", "", name.lower())


def find_adm3_centroid(conn, description: str, project_id: str):
    """
    Cherche le centroïde adm3 le plus proche du mot-clé de description.
    Retourne (lon_wgs84, lat_wgs84) ou None.
    """
    if not description:
        return None

    # Extraire mots-clés simples de la description
    keywords = [w.strip() for w in re.split(r"[,;()\s]+", description)
                if len(w.strip()) >= 3]

    with conn.cursor() as cur:
        for kw in keywords:
            cur.execute("""
                SELECT ST_X(ST_Centroid(geom)) AS lon,
                       ST_Y(ST_Centroid(geom)) AS lat,
                       name
                FROM atlas.adm3_tg
                WHERE LOWER(name) ILIKE %s
                LIMIT 1
            """, (f"%{kw.lower()}%",))
            r = cur.fetchone()
            if r:
                log.info(f"    Géocode '{project_id}' -> adm3 '{r[2]}' ({r[1]:.4f}, {r[0]:.4f})")
                return r[0], r[1]  # lon, lat

        # Fallback : centroïde géographique du Togo (WGS84) en dur
        # ~8.6N, 1.0E (centre approximatif du Togo)
        togo_lon, togo_lat = 1.0, 8.6
        log.warning(f"    Géocode '{project_id}' -> fallback Togo centroïde ({togo_lat:.4f}, {togo_lon:.4f})")
        return togo_lon, togo_lat

    return None


def import_sondages(conn):
    loca_rows  = read_csv(V10_FILES["localisation"])
    proj_rows  = read_csv(V10_FILES["projets"])

    # Index projets
    proj_by_id = {p["id_projet"]: p for p in proj_rows if p.get("id_projet")}

    # Sondages déjà en DB
    with conn.cursor() as cur:
        cur.execute("SELECT code FROM atlas.sondages WHERE code IS NOT NULL")
        db_codes = {r[0] for r in cur.fetchall()}

    new_rows = [r for r in loca_rows
                if r.get("id_sondage") and r["id_sondage"] not in db_codes]
    log.info(f"  Sondages à insérer : {len(new_rows)}")

    inserted = 0
    skipped  = 0
    geocoded_adm3 = 0

    for r in new_rows:
        sid     = r["id_sondage"]
        proj_id = r.get("id_projet")
        proj    = proj_by_id.get(proj_id, {})

        lat_raw = r.get("latitude_y_dec")
        lon_raw = r.get("longitude_x_dec")
        lat_f   = safe_float(lat_raw)
        lon_f   = safe_float(lon_raw)

        geom_expr   = None
        loc_mode    = "null"
        loc_acc     = "unknown"
        is_geocoded = False

        if lat_f is not None and lon_f is not None:
            if is_utm31n(lat_raw, lon_raw):
                # UTM31N -> WGS84
                geom_expr = f"ST_Transform(ST_SetSRID(ST_MakePoint({lon_f}, {lat_f}), 32631), 4326)"
                loc_mode    = "utm31n_converted"
                loc_acc     = "medium"
                is_geocoded = True
            else:
                # WGS84 direct
                geom_expr   = f"ST_SetSRID(ST_MakePoint({lon_f}, {lat_f}), 4326)"
                loc_mode    = "gps_wgs84"
                loc_acc     = "high"
                is_geocoded = True
        else:
            # NULL -> géocode via adm3
            loc_desc = proj.get("description_localisation", "")
            centroid = find_adm3_centroid(conn, loc_desc, proj_id or sid)
            if centroid:
                clon, clat = centroid
                geom_expr   = f"ST_SetSRID(ST_MakePoint({clon}, {clat}), 4326)"
                loc_mode    = "estimated_adm3_centroid"
                loc_acc     = "low"
                is_geocoded = False
                geocoded_adm3 += 1
            else:
                log.warning(f"  SKIP {sid} : aucune coordonnée ni adm3 trouvé")
                skipped += 1
                continue

        # Type de sondage depuis id_sondage suffix
        type_sondage = r.get("type_sondage") or "SC"

        # Métadonnées projet dans meta
        meta = {
            "id_projet":            proj_id,
            "type_projet":          proj.get("type_projet"),
            "nom_projet":           proj.get("nom_projet"),
            "description_loc":      proj.get("description_localisation"),
            "nappe_phreatique_m":   safe_float(r.get("nappe_phreatique_m")),
            "refus_penetrometre_m": safe_float(r.get("refus_penetrometre_m")),
            "observation_surface":  r.get("observation_surface"),
            "altitude_m":           safe_float(r.get("altitude_m")),
            "pk_brut":              r.get("pk_brut"),
            "import_batch":         IMPORT_BATCH,
        }

        # is_geocoded est une colonne GENERATED - ne pas l'inclure dans l'INSERT
        # sondages.code n'a pas de contrainte UNIQUE -> on vérifie l'existence avant INSERT
        sql = f"""
            INSERT INTO atlas.sondages
              (code, source, type_sol, loc_mode, location_accuracy,
               created_by_batch, meta, geom)
            SELECT %(code)s, 'V10_MASTER_2026', %(type_sol)s, %(loc_mode)s,
                   %(loc_acc)s, %(batch)s, %(meta)s,
                   {geom_expr}
            WHERE NOT EXISTS (
              SELECT 1 FROM atlas.sondages WHERE code = %(code)s AND deleted_at IS NULL
            )
        """
        with conn.cursor() as cur:
            try:
                cur.execute(sql, {
                    "code":        sid,
                    "type_sol":    type_sondage,
                    "loc_mode":    loc_mode,
                    "loc_acc":     loc_acc,
                    "batch":       IMPORT_BATCH,
                    "meta":        psycopg2.extras.Json(meta),
                })
                inserted += 1
            except Exception as e:
                log.error(f"  ERREUR {sid}: {e}")
                conn.rollback()
                skipped += 1

    conn.commit()
    log.info(f"  OK Sondages insérés       : {inserted}")
    log.info(f"  OK Géocodés via adm3      : {geocoded_adm3}")
    log.info(f"  KO Ignorés (erreur)       : {skipped}")
    return inserted


def main():
    log.info("=== PHASE 02 — Import sondages V10 ===")
    conn = psycopg2.connect(DATABASE_URL)
    try:
        n = import_sondages(conn)
        log.info(f"Phase 02 terminée : {n} sondages insérés")
    finally:
        conn.close()


if __name__ == "__main__":
    main()
