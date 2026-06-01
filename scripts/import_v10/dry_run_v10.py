#!/usr/bin/env python3
"""
dry_run_v10.py — Validation complète avant import V10_MASTER (mode lecture seule)
Intrepid Core Engineering Standards — Pipeline Safety Protocol

Usage:
    python dry_run_v10.py [--verbose]

Vérifie :
  1. Présence et structure de tous les CSV
  2. Comptage sondages nouveaux vs déjà en DB
  3. Détection problèmes de coordonnées (UTM/WGS84/NULL)
  4. Stratégie géocodage pour coordonnées NULL
  5. Vérification migrations 176/177/178 appliquées
  6. Estimation des lignes qui seront insérées
  7. Aucune écriture en base
"""
import sys
import io
import csv
import logging
import argparse
from collections import defaultdict
from pathlib import Path

import psycopg2
import psycopg2.extras

# Force UTF-8 stdout (Windows cp1252 fix)
if hasattr(sys.stdout, 'buffer'):
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8', errors='replace')

# Ajouter le répertoire parent au path
sys.path.insert(0, str(Path(__file__).parent))
from config import (
    DATABASE_URL, V10_FILES, CSV_SEP, LOGS_DIR,
    canon_horizon, canon_from_z, is_utm31n, UTM_THRESHOLD, IMPORT_BATCH
)

# -- Logging -------------------------------------------------------------------
log_file = LOGS_DIR / "dry_run_v10.log"
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
    handlers=[
        logging.FileHandler(log_file, encoding="utf-8"),
        logging.StreamHandler(sys.stdout)
    ]
)
log = logging.getLogger(__name__)

# -- Helpers -------------------------------------------------------------------

def read_csv(path: Path) -> list[dict]:
    """Lit un CSV ; retourne liste de dicts. Gere les lignes vides et colonnes extra."""
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_SEP)
        for row in reader:
            clean = {}
            for k, v in row.items():
                if k is None:
                    continue  # colonnes extra hors header
                if isinstance(v, list):
                    v = v[0] if v else None
                sv = v.strip() if v and isinstance(v, str) else None
                clean[k] = None if sv in ("NULL", "null", "None", "") else sv
            if any(v for v in clean.values()):
                rows.append(clean)
    return rows

def safe_float(val) -> float | None:
    try:
        return float(val) if val else None
    except (ValueError, TypeError):
        return None

def read_csv_noheader(path: Path, col_names: list[str]) -> list[dict]:
    """Lit un CSV sans entête (CBR, Proctor points)."""
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.reader(f, delimiter=CSV_SEP)
        for line in reader:
            if not line or not line[0].strip():
                continue
            row = {}
            for i, name in enumerate(col_names):
                row[name] = line[i].strip() if i < len(line) else None
            rows.append(row)
    return rows

# -- Section 1 : Vérification fichiers CSV ------------------------------------

def check_csv_files() -> bool:
    log.info("=" * 60)
    log.info("SECTION 1 — Vérification présence fichiers CSV")
    all_ok = True
    for name, path in V10_FILES.items():
        if path.exists():
            size_kb = path.stat().st_size // 1024
            log.info(f"  OK {name:25s} -> {path.name} ({size_kb} KB)")
        else:
            log.error(f"  KO {name:25s} -> MANQUANT : {path}")
            all_ok = False
    return all_ok

# -- Section 2 : Comptage sondages nouveaux -----------------------------------

def check_new_sondages(conn) -> dict:
    log.info("=" * 60)
    log.info("SECTION 2 — Comptage nouveaux sondages")

    loca = read_csv(V10_FILES["localisation"])
    v10_ids = {r["id_sondage"] for r in loca if r.get("id_sondage")}
    log.info(f"  V10 total entrées localisation : {len(loca)}")
    log.info(f"  V10 id_sondage uniques         : {len(v10_ids)}")

    with conn.cursor() as cur:
        cur.execute("SELECT code FROM atlas.sondages WHERE code IS NOT NULL")
        db_codes = {r[0] for r in cur.fetchall()}

    new_ids  = v10_ids - db_codes
    already  = v10_ids & db_codes
    log.info(f"  Déjà en DB                     : {len(already)}")
    log.info(f"  NOUVEAUX sondages               : {len(new_ids)}")

    if already:
        log.info(f"  Exemples déjà en DB : {sorted(already)[:5]}")

    return {"total": len(loca), "new": len(new_ids), "existing": len(already),
            "new_ids": new_ids, "existing_ids": already, "all_v10": v10_ids}

# -- Section 3 : Détection coordonnées ----------------------------------------

def check_coordinates() -> dict:
    log.info("=" * 60)
    log.info("SECTION 3 — Détection systèmes de coordonnées")

    loca = read_csv(V10_FILES["localisation"])
    stats = {"wgs84": 0, "utm31n": 0, "null_both": 0, "null_lat": 0,
             "null_lon": 0, "utm_examples": [], "null_examples": []}

    for r in loca:
        lat = r.get("latitude_y_dec")
        lon = r.get("longitude_x_dec")
        sid = r.get("id_sondage", "?")

        if not lat and not lon:
            stats["null_both"] += 1
            stats["null_examples"].append(sid)
        elif not lat:
            stats["null_lat"] += 1
        elif not lon:
            stats["null_lon"] += 1
        elif is_utm31n(lat, lon):
            stats["utm31n"] += 1
            stats["utm_examples"].append((sid, lat, lon))
        else:
            lat_f = safe_float(lat)
            lon_f = safe_float(lon)
            if lat_f and (5.0 <= lat_f <= 12.0) and (lon_f and (-1.0 <= lon_f <= 2.0)):
                stats["wgs84"] += 1
            else:
                # Valeurs hors Togo -> suspicious
                log.warning(f"  SUSPECT coord: {sid} lat={lat} lon={lon}")
                stats["wgs84"] += 1  # accepter quand même

    log.info(f"  WGS84 valides       : {stats['wgs84']}")
    log.info(f"  UTM31N (à convertir): {stats['utm31n']}")
    log.info(f"  NULL lat ET lon     : {stats['null_both']}")
    log.info(f"  NULL lat seul       : {stats['null_lat']}")
    log.info(f"  NULL lon seul       : {stats['null_lon']}")

    if stats["utm_examples"]:
        log.info(f"  Exemples UTM31N (3 premiers): {stats['utm_examples'][:3]}")
    if stats["null_examples"]:
        log.info(f"  Exemples NULL coords (5 premiers): {stats['null_examples'][:5]}")
        log.info("  -> Stratégie: centroïde adm3 depuis description_localisation du projet")

    return stats

# -- Section 4 : Stratégie géocodage pour NULL --------------------------------

def check_geocoding_strategy(conn) -> None:
    log.info("=" * 60)
    log.info("SECTION 4 — Stratégie géocodage coordonnées NULL")

    loca_rows  = read_csv(V10_FILES["localisation"])
    proj_rows  = read_csv(V10_FILES["projets"])

    # Index projets
    proj_by_id = {}
    for p in proj_rows:
        pid = p.get("id_projet")
        if pid:
            proj_by_id[pid] = p

    null_sondages = [
        r for r in loca_rows
        if not r.get("latitude_y_dec") and not r.get("longitude_x_dec")
    ]
    log.info(f"  Sondages sans coordonnées : {len(null_sondages)}")

    # Pour chaque sondage NULL, chercher le centroïde adm3 le plus proche
    with conn.cursor(cursor_factory=psycopg2.extras.DictCursor) as cur:
        cur.execute("""
            SELECT id, name, ST_Y(ST_Centroid(geom)) lat, ST_X(ST_Centroid(geom)) lon
            FROM atlas.adm3_tg
            LIMIT 5
        """)
        sample_adm3 = cur.fetchall()
    log.info(f"  Exemples adm3 disponibles: {[(r['name'], r['lat'], r['lon']) for r in sample_adm3[:3]]}")

    # Comptage par projet pour les sondages NULL
    by_proj = defaultdict(list)
    for r in null_sondages:
        by_proj[r.get("id_projet", "UNKNOWN")].append(r["id_sondage"])

    log.info("  Répartition NULL par projet :")
    for proj_id, sids in sorted(by_proj.items()):
        proj = proj_by_id.get(proj_id, {})
        loc_desc = proj.get("description_localisation", "?")
        log.info(f"    {proj_id:25s} ({len(sids):3d} sondages) — localisation: {loc_desc}")

    log.info("  -> Résolution : ST_Centroid(geom) de l'adm3 matching description_localisation")
    log.info("  -> location_mode = 'estimated_adm3_centroid', location_accuracy = 'low'")
    log.info("  -> is_geocoded = FALSE (flag audit)")

# -- Section 5 : Vérification migrations --------------------------------------

def check_migrations(conn) -> bool:
    log.info("=" * 60)
    log.info("SECTION 5 — Vérification migrations 176/177/178")
    ok = True

    checks = [
        ("echantillons.h_canon",
         "SELECT 1 FROM information_schema.columns WHERE table_schema='atlas' AND table_name='echantillons' AND column_name='h_canon'"),
        ("echantillons.depth_z_min",
         "SELECT 1 FROM information_schema.columns WHERE table_schema='atlas' AND table_name='echantillons' AND column_name='depth_z_min'"),
        ("essais_penetrometre",
         "SELECT 1 FROM information_schema.tables WHERE table_schema='atlas' AND table_name='essais_penetrometre'"),
        ("essais_pressiometre",
         "SELECT 1 FROM information_schema.tables WHERE table_schema='atlas' AND table_name='essais_pressiometre'"),
        ("essais_cbr",
         "SELECT 1 FROM information_schema.tables WHERE table_schema='atlas' AND table_name='essais_cbr'"),
        ("essais_classif.indice_groupe",
         "SELECT 1 FROM information_schema.columns WHERE table_schema='atlas' AND table_name='essais_classif' AND column_name='indice_groupe'"),
    ]

    with conn.cursor() as cur:
        for name, sql in checks:
            cur.execute(sql)
            exists = cur.fetchone() is not None
            status = "OK" if exists else "KO MANQUANT — appliquer migration d'abord"
            log.info(f"  {status} {name}")
            if not exists:
                ok = False

    if not ok:
        log.error("  -> Appliquer les migrations avant de continuer !")
        log.error("  -> psql -f migrations_post_v1/176_...sql")
        log.error("  -> psql -f migrations_post_v1/177_...sql")
        log.error("  -> psql -f migrations_post_v1/178_...sql")
    else:
        log.info("  -> Toutes les migrations sont appliquées OK")

    return ok

# -- Section 6 : Estimation des insertions ------------------------------------

def check_insertion_estimates(conn, sondage_stats: dict) -> None:
    log.info("=" * 60)
    log.info("SECTION 6 — Estimation des insertions")

    new_ids = sondage_stats["new_ids"]

    # Labo horizons
    labo = read_csv(V10_FILES["labo"])
    labo_new = [r for r in labo if r.get("id_sondage") in new_ids]

    # Comptage par paramètre
    wl_count = sum(1 for r in labo_new if safe_float(r.get("limite_liquidite_ll")) is not None)
    ip_count = sum(1 for r in labo_new if safe_float(r.get("indice_plasticite_ip")) is not None)
    ig_count = sum(1 for r in labo_new if safe_float(r.get("indice_groupe_ig")) is not None)
    hrb_count= sum(1 for r in labo_new if r.get("classe_sol_hbr"))
    opm_count= sum(1 for r in labo_new if safe_float(r.get("densite_seche_opm")) is not None)
    cbr95_c  = sum(1 for r in labo_new if safe_float(r.get("cbr_95_pct")) is not None)
    dens_c   = sum(1 for r in labo_new if safe_float(r.get("densite_seche_nat_g_cm3")) is not None)

    log.info(f"  Horizons labo (nouveaux sondages)    : {len(labo_new)}")
    log.info(f"    +- WL (Atterberg)                  : {wl_count}")
    log.info(f"    +- IP (Atterberg)                  : {ip_count}")
    log.info(f"    +- Indice Groupe (essais_classif)   : {ig_count}")
    log.info(f"    +- Classe HRB (essais_classif)      : {hrb_count}")
    log.info(f"    +- OPM gamma_d/w (essais_proctor)   : {opm_count}")
    log.info(f"    +- CBR 95% (essais_cbr)             : {cbr95_c}")
    log.info(f"    +- Densité naturelle (physiques)    : {dens_c}")

    # In-situ profils
    insitu = read_csv(V10_FILES["insitu"])
    insitu_new = [r for r in insitu if r.get("id_sondage") in new_ids]
    pd_count = sum(1 for r in insitu_new if safe_float(r.get("penetrometre_rd_mpa")) is not None)
    sp_count = sum(1 for r in insitu_new if safe_float(r.get("pressiometre_em_mpa")) is not None)
    log.info(f"  Profils in-situ (nouveaux sondages)  : {len(insitu_new)}")
    log.info(f"    +- Pénétromètre Rd (essais_penetre) : {pd_count}")
    log.info(f"    +- Pressiomètre Em (essais_presso)  : {sp_count}")

    # CBR + Proctor courbes
    cbr_col  = ["id_sondage","n_coups","compactage_pct","gamma_d_gcm3","cbr_pct","w_pct"]
    proc_col = ["id_sondage","w_pct","gamma_d_gcm3"]

    total_cbr_rows   = 0
    total_proct_rows = 0
    for key, f in V10_FILES.items():
        if key.startswith("cbr_"):
            rows = read_csv_noheader(f, cbr_col)
            total_cbr_rows += sum(1 for r in rows if r["id_sondage"] in new_ids)
        elif key.startswith("proctor_"):
            rows = read_csv_noheader(f, proc_col)
            total_proct_rows += sum(1 for r in rows if r["id_sondage"] in new_ids)

    log.info(f"  CBR courbe compactage (nouveaux)     : {total_cbr_rows}")
    log.info(f"  Proctor points courbe (nouveaux)     : {total_proct_rows} (-> meta JSONB)")

    # Horizon distribution
    log.info("\n  Distribution horizons canoniques :")
    h_dist = defaultdict(int)
    for r in labo_new:
        z_min = safe_float(r.get("z_min_m")) or 0.0
        z_max = safe_float(r.get("z_max_m")) or 0.0
        if z_max > 0:
            h = canon_horizon(z_min, z_max)
        else:
            h = "H1"  # défaut
        h_dist[h] += 1
    for h in ["H1","H2","H3"]:
        log.info(f"    {h} : {h_dist[h]} horizons")

    deep = sum(1 for r in labo_new
               if safe_float(r.get("z_max_m") or 0) and safe_float(r.get("z_max_m")) > 2.0)
    if deep:
        log.info(f"  ! Profondeurs > 2 m (-> H3, valeur réelle conservée) : {deep}")

# -- Section 7 : Vérification intégrité h_canon actuel ------------------------

def check_existing_data(conn) -> None:
    log.info("=" * 60)
    log.info("SECTION 7 — État actuel de la DB")

    with conn.cursor() as cur:
        cur.execute("""
            SELECT
              (SELECT COUNT(*) FROM atlas.sondages)         AS sondages,
              (SELECT COUNT(*) FROM atlas.echantillons)     AS echantillons,
              (SELECT COUNT(*) FROM atlas.essais_atterberg) AS atterberg,
              (SELECT COUNT(*) FROM atlas.essais_proctor)   AS proctor,
              (SELECT COUNT(*) FROM atlas.essais_classif)   AS classif,
              (SELECT COUNT(*) FROM atlas.essais_physiques) AS physiques,
              (SELECT COUNT(*) FROM atlas.essais_vbs)       AS vbs,
              (SELECT COUNT(*) FROM atlas.ai_interpolation_runs)  AS ai_runs,
              (SELECT COUNT(*) FROM atlas.ai_interpolation_values) AS ai_values
        """)
        r = cur.fetchone()
        names = ["sondages","echantillons","atterberg","proctor","classif",
                 "physiques","vbs","ai_runs","ai_values"]
        for name, val in zip(names, r):
            log.info(f"    {name:25s} : {val:>10,}")

# -- Main ----------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Dry-run V10_MASTER import validation")
    parser.add_argument("--verbose", action="store_true")
    args = parser.parse_args()

    log.info("=" * 60)
    log.info("  DRY-RUN V10_MASTER -- ATLAS GEOTECHNIQUE TOGO")
    log.info("  Mode lecture seule -- AUCUNE ecriture en base")
    log.info("=" * 60)
    log.info(f"  DB  : {DATABASE_URL}")
    log.info(f"  Log : {log_file}")

    # 1. CSV files
    csv_ok = check_csv_files()
    if not csv_ok:
        log.error("ABORT : fichiers CSV manquants")
        sys.exit(1)

    # Connexion DB
    try:
        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = True
        log.info(f"  DB connexion OK : {DATABASE_URL}")
    except Exception as e:
        log.error(f"  DB connexion FAILED : {e}")
        sys.exit(1)

    try:
        # 2. Nouveaux sondages
        sondage_stats = check_new_sondages(conn)

        # 3. Coordonnées
        coord_stats = check_coordinates()

        # 4. Géocodage NULL
        check_geocoding_strategy(conn)

        # 5. Migrations
        migrations_ok = check_migrations(conn)

        # 6. Estimations
        check_insertion_estimates(conn, sondage_stats)

        # 7. État DB actuel
        check_existing_data(conn)

        log.info("=" * 60)
        log.info("SYNTHÈSE DRY-RUN")
        log.info(f"  CSV                 : {'OK' if csv_ok else 'ERREUR'}")
        log.info(f"  Migrations          : {'OK' if migrations_ok else 'MANQUANTES — appliquer avant import'}")
        log.info(f"  Nouveaux sondages   : {sondage_stats['new']}")
        log.info(f"  UTM31N à convertir  : {coord_stats['utm31n']}")
        log.info(f"  Coords NULL         : {coord_stats['null_both']} (-> centroïde adm3)")

        if migrations_ok:
            log.info("\n  OK PRÊT pour l'import — Lancer : python run_all.py")
        else:
            log.info("\n  KO Appliquer d'abord les migrations 176/177/178")
            sys.exit(2)

    finally:
        conn.close()

if __name__ == "__main__":
    main()
