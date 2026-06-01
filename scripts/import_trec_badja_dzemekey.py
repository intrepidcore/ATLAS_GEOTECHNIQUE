#!/usr/bin/env python3
"""
import_trec_badja_dzemekey.py
Import manuel des données VBS/Atterberg/OPM/CBR depuis :
  - TREC_EXTRACT/SONDAGES DE L'EMPRUNT DE BADJA.md    (28 sondages)
  - TREC_EXTRACT/SONDAGES DE L'EMPRUNT DE DZEMEKEY.md (6 sondages)

Données lues ligne par ligne depuis les documents sources.
Intégrité garantie : pas de parsing CSV automatique.

DB : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
Batch : trec_extract_import_2024
"""
import sys, hashlib, random, uuid, psycopg2
from datetime import date

DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
BATCH  = "trec_extract_import_2024"
DATE_BADJA    = date(2024, 11, 22)
DATE_DZEMEKEY = date(2024, 11, 22)

# ── Données BADJA (lues depuis TABLEAU 1 + 2 + 3) ─────────────────────────────
# Format : (id, sondage_num, profondeur_min, profondeur_max, materiau,
#           LL, IP, VBS, pct_80um, IG, hrb, date_essai)
BADJA_T1 = [
    (1,  "S01", 0.25, 1.0, "Graveleux lateritique", 36, 14, 2.0, 15, 0, "A2-6", date(2024,11,22)),
    (2,  "S02", 0.25, 1.0, "Graveleux lateritique", 34, 13, 1.8, 16, 0, "A2-6", date(2024,11,22)),
    (3,  "S03", 0.30, 1.0, "Graveleux lateritique", 36, 14, 2.2, 15, 0, "A2-6", date(2024,11,22)),
    (4,  "S04", 0.30, 1.0, "Graveleux lateritique", 35, 13, 1.5, 20, 0, "A2-6", date(2024,11,22)),
    (5,  "S05", 0.25, 1.0, "Graveleux lateritique", 36, 13, 1.8, 17, 0, "A2-6", date(2024,11,22)),
    (6,  "S06", 0.25, 1.0, "Graveleux lateritique", 35, 13, 1.5, 17, 0, "A2-6", date(2024,11,22)),
    (7,  "S07", 0.25, 1.0, "Graveleux lateritique", 38, 14, 1.9, 19, 0, "A2-6", date(2024,11,22)),
    (8,  "S08", 0.30, 1.0, "Graveleux lateritique", 40, 15, 1.9, 20, 0, "A2-6", date(2024,11,23)),
    (9,  "S09", 0.30, 1.0, "Graveleux lateritique", 36, 13, 1.8, 17, 0, "A2-6", date(2024,11,23)),
    (10, "S10", 0.30, 1.0, "Graveleux lateritique", 38, 14, 2.0, 18, 0, "A2-6", date(2024,11,23)),
    (11, "S11", 0.30, 1.0, "Graveleux lateritique", 38, 15, 2.0, 20, 0, "A2-6", date(2024,11,23)),
    (12, "S12", 0.30, 1.0, "Graveleux lateritique", 38, 14, 2.2, 18, 0, "A2-6", date(2024,11,23)),
    (13, "S13", 0.30, 1.0, "Graveleux lateritique", 40, 15, 2.0, 19, 0, "A2-6", date(2024,11,23)),
    (14, "S14", 0.30, 1.0, "Graveleux lateritique", 37, 14, 2.2, 20, 0, "A2-6", date(2024,11,23)),
    (15, "S15", 0.30, 1.0, "Graveleux lateritique", 39, 13, 1.8, 19, 0, "A2-6", date(2024,11,23)),
    (16, "S16", 0.30, 1.0, "Graveleux lateritique", 40, 14, 2.4, 18, 0, "A2-6", date(2024,11,23)),
    (17, "S17", 0.30, 1.0, "Graveleux lateritique", 40, 15, 2.2, 20, 0, "A2-6", date(2024,11,23)),
    (18, "S18", 0.25, 1.0, "Graveleux lateritique", 38, 14, 2.0, 18, 0, "A2-6", date(2024,11,23)),
    (19, "S19", 0.25, 1.0, "Graveleux lateritique", 35, 13, 1.8, 19, 0, "A2-6", date(2024,11,23)),
    (20, "S20", 0.30, 1.0, "Graveleux lateritique", 38, 14, 2.0, 20, 0, "A2-6", date(2024,11,24)),
    (21, "S21", 0.30, 1.0, "Graveleux lateritique", 39, 14, 2.3, 20, 0, "A2-6", date(2024,11,24)),
    (22, "S22", 0.30, 1.0, "Graveleux lateritique", 36, 14, 2.0, 17, 0, "A2-6", date(2024,11,24)),
    (23, "S23", 0.30, 1.0, "Graveleux lateritique", 40, 14, 2.2, 20, 0, "A2-6", date(2024,11,24)),
    (24, "S24", 0.30, 1.0, "Graveleux lateritique", 40, 15, 2.0, 20, 0, "A2-6", date(2024,11,24)),
    (25, "S25", 0.30, 1.0, "Graveleux lateritique", 37, 13, 2.0, 17, 0, "A2-6", date(2024,11,24)),
    (26, "S26", 0.30, 1.0, "Graveleux lateritique", 38, 13, 2.2, 20, 0, "A2-6", date(2024,11,24)),
    (27, "S27", 0.30, 1.0, "Graveleux lateritique", 38, 14, 2.0, 19, 0, "A2-6", date(2024,11,24)),
    (28, "S28", 0.30, 1.0, "Graveleux lateritique", 38, 13, 1.9, 18, 0, "A2-6", date(2024,11,24)),
]

# Format : (id, gd_max_t_m3, w_opt_pct, cbr_95)
BADJA_T2 = [
    (1,  2.160, 9.0, 53), (2,  2.150, 8.4, 51), (3,  2.170, 9.5, 55),
    (4,  2.180, 8.4, 53), (5,  2.130, 7.7, 48), (6,  2.140, 8.2, 48),
    (7,  2.170, 7.8, 55), (8,  2.140, 8.4, 50), (9,  2.150, 8.4, 47),
    (10, 2.130, 7.7, 48), (11, 2.150, 8.4, 51), (12, 2.160, 8.0, 53),
    (13, 2.150, 8.0, 50), (14, 2.140, 7.7, 48), (15, 2.130, 8.5, 48),
    (16, 2.150, 8.5, 55), (17, 2.140, 7.5, 47), (18, 2.130, 8.2, 49),
    (19, 2.160, 7.7, 55), (20, 2.140, 8.0, 51), (21, 2.140, 8.0, 53),
    (22, 2.150, 8.2, 54), (23, 2.140, 8.6, 49), (24, 2.150, 8.9, 52),
    (25, 2.130, 8.3, 48), (26, 2.150, 8.2, 51), (27, 2.150, 8.8, 54),
    (28, 2.140, 8.2, 47),
]

# Format : (id, n_coups, compacite_pct, gd_t_m3, cbr, w_imb_pct)
BADJA_T3 = [
    (1,55,100.0,2.160,68,9.6), (1,25,94.9,2.050,53,10.7), (1,12,89.8,1.940,35,11.7),
    (2,55,100.0,2.150,67,9.9), (2,25,94.9,2.040,51,11.0), (2,12,90.2,1.940,33,12.1),
    (3,55,100.0,2.170,73,11.2),(3,25,94.9,2.060,55,12.3), (3,12,89.9,1.950,35,13.4),
    (4,55,100.0,2.180,66,10.2),(4,25,95.0,2.070,53,11.1), (4,12,89.9,1.960,32,12.2),
    (5,55,100.0,2.130,59,9.3), (5,25,94.8,2.020,48,10.3), (5,12,90.1,1.920,26,11.4),
    (6,55,100.0,2.140,61,10.1),(6,25,94.9,2.030,48,11.0), (6,12,90.2,1.930,30,12.3),
    (7,55,100.0,2.170,68,10.4),(7,25,94.9,2.060,55,11.4), (7,12,89.9,1.950,33,12.2),
    (8,55,100.0,2.140,62,10.2),(8,25,94.9,2.030,50,11.3), (8,12,90.2,1.930,32,12.3),
    (9,55,100.0,2.150,59,10.1),(9,25,94.9,2.040,47,11.2), (9,12,90.2,1.940,28,12.0),
    (10,55,100.0,2.130,59,9.4),(10,25,94.8,2.020,48,10.3),(10,12,90.1,1.920,31,11.0),
    (11,55,100.0,2.150,62,9.4),(11,25,94.9,2.040,51,10.2),(11,12,90.2,1.940,35,11.4),
    (12,55,100.0,2.160,68,9.9),(12,25,94.9,2.050,53,10.8),(12,12,89.8,1.940,34,11.8),
    (13,55,100.0,2.150,68,10.1),(13,25,94.9,2.040,50,11.3),(13,12,90.2,1.940,32,12.2),
    (14,55,100.0,2.140,61,9.4),(14,25,94.9,2.030,48,10.3),(14,12,90.2,1.930,31,11.3),
    (15,55,100.0,2.130,63,10.2),(15,25,94.8,2.020,48,11.3),(15,12,90.1,1.920,28,12.4),
    (16,55,100.0,2.150,68,10.3),(16,25,94.9,2.040,55,11.0),(16,12,90.2,1.940,35,12.1),
    (17,55,100.0,2.140,65,9.2),(17,25,94.9,2.030,47,10.3),(17,12,90.2,1.930,28,11.2),
    (18,55,100.0,2.130,61,9.9),(18,25,94.8,2.020,49,11.1),(18,12,90.1,1.920,29,12.1),
    (19,55,100.0,2.160,68,9.4),(19,25,94.9,2.050,55,10.2),(19,12,89.8,1.940,33,11.3),
    (20,55,100.0,2.140,61,9.8),(20,25,94.9,2.030,51,10.9),(20,12,90.2,1.930,33,12.1),
    (21,55,100.0,2.140,67,9.8),(21,25,94.9,2.030,53,10.7),(21,12,90.2,1.930,35,12.0),
    (22,55,100.0,2.150,69,10.0),(22,25,94.9,2.040,54,11.1),(22,12,90.2,1.940,34,12.1),
    (23,55,100.0,2.140,63,10.4),(23,25,94.9,2.030,49,11.3),(23,12,90.2,1.930,28,12.4),
    (24,55,100.0,2.150,62,9.6),(24,25,94.9,2.040,52,10.7),(24,12,90.2,1.940,38,11.8),
    (25,55,100.0,2.130,58,10.1),(25,25,94.8,2.020,48,11.2),(25,12,90.1,1.920,31,12.1),
    (26,55,100.0,2.150,65,10.1),(26,25,94.9,2.040,51,11.0),(26,12,90.2,1.940,37,12.2),
    (27,55,100.0,2.150,66,9.6),(27,25,94.9,2.040,54,10.7),(27,12,90.2,1.940,36,11.7),
    (28,55,100.0,2.140,67,9.1),(28,25,94.9,2.030,47,10.0),(28,12,90.2,1.930,28,11.1),
]

# ── Données DZEMEKEY (lues depuis TABLEAU 1 + 2 + 3) ─────────────────────────
DZEMEKEY_T1 = [
    (1, "S01", 0.15, 1.0, "Graveleux lateritique", 31, 11, 1.8, 16, 0, "A2-6", date(2024,11,22)),
    (2, "S02", 0.20, 1.0, "Graveleux lateritique", 35, 14, 2.1, 18, 0, "A2-6", date(2024,11,22)),
    (3, "S03", 0.25, 1.0, "Graveleux lateritique", 35, 13, 1.7, 17, 0, "A2-6", date(2024,11,22)),
    (4, "S04", 0.20, 1.0, "Graveleux lateritique", 32, 12, 1.9, 14, 0, "A2-6", date(2024,11,22)),
    (5, "S05", 0.25, 1.0, "Graveleux lateritique", 37, 14, 2.1, 15, 0, "A2-6", date(2024,11,22)),
    (6, "S06", 0.25, 1.0, "Graveleux lateritique", 35, 13, 1.8, 15, 0, "A2-6", date(2024,11,22)),
]

DZEMEKEY_T2 = [
    (1, 2.150, 8.0, 50), (2, 2.130, 8.6, 48),
    (3, 2.140, 8.3, 45), (4, 2.120, 8.0, 47),
    (5, 2.140, 8.2, 50), (6, 2.130, 8.3, 48),
]

DZEMEKEY_T3 = [
    (1,55,100.0,2.150,65,9.8), (1,25,94.9,2.040,50,10.7),(1,12,90.2,1.940,32,11.8),
    (2,55,100.0,2.130,60,9.9), (2,25,94.8,2.020,48,11.1),(2,12,90.1,1.920,28,12.1),
    (3,55,100.0,2.140,58,10.4),(3,25,94.9,2.030,45,11.1),(3,12,90.2,1.930,28,12.4),
    (4,55,100.0,2.120,66,10.3),(4,25,94.8,2.010,47,11.4),(4,12,90.1,1.910,25,12.3),
    (5,55,100.0,2.141,65,9.2),(5,25,94.9,2.030,50,9.7), (5,12,90.2,1.930,34,11.0),
    (6,55,100.0,2.130,66,9.4),(6,25,94.8,2.020,48,10.3),(6,12,90.1,1.920,28,11.1),
]

# ── Géolocalisation ─────────────────────────────────────────────────────────────
# BADJA : ADM3 Badja gid=62, Maritime/Ave, centroide lon=1.018 lat=6.384
BADJA_ADM3_GID = 62
BADJA_ADM1 = "Maritime"
BADJA_ADM2 = "Ave"
BADJA_ADM3 = "Badja"
BADJA_LON_C = 1.0178978989013572
BADJA_LAT_C = 6.383856245755278

# DZEMEKEY : aucune correspondance ADM3 — fallback centroide national Togo
DZEMEKEY_ADM3_GID = None
DZEMEKEY_ADM1 = None
DZEMEKEY_ADM2 = None
DZEMEKEY_ADM3 = "Dzemekey"
DZEMEKEY_LON_C = 1.0   # centroide national Togo
DZEMEKEY_LAT_C = 8.6


def det_point(code: str, lon_c: float, lat_c: float, spread: float = 0.03):
    """Point pseudo-aléatoire déterministe dans un rayon spread autour du centroïde."""
    seed = int(hashlib.sha256(code.encode()).hexdigest(), 16) % (2**32)
    rng = random.Random(seed)
    lon = lon_c + (rng.random() - 0.5) * spread
    lat = lat_c + (rng.random() - 0.5) * spread
    return lon, lat


def h_canon(depth_min: float, depth_max: float) -> str:
    centroid = (depth_min + depth_max) / 2.0
    if centroid <= 1.0:   return "H1"
    elif centroid <= 1.5: return "H2"
    else:                 return "H3"


def import_site(
    conn, cur,
    site_prefix: str,      # "BADJA" | "DZEMEKEY"
    t1: list, t2: list, t3: list,
    adm3_gid, adm1, adm2, adm3_name,
    lon_c: float, lat_c: float,
    spread: float = 0.04,
    dry_run: bool = False,
):
    """Importe les sondages d'un site emprunt."""
    # Index T2 et T3 par id
    t2_idx = {r[0]: r for r in t2}
    t3_idx: dict = {}
    for row in t3:
        t3_idx.setdefault(row[0], []).append(row)

    sondages_ok = 0; ech_ok = 0; vbs_ok = 0; att_ok = 0; cbr_ok = 0; proctor_ok = 0

    for row1 in t1:
        idx, snum, dep_min, dep_max, materiau, wl, ip, vbs, pct80, ig, hrb, date_essai = row1
        code = f"EMPRUNT_{site_prefix}_{snum}"
        lon, lat = det_point(code, lon_c, lat_c, spread)
        hc = h_canon(dep_min, dep_max)
        depth_mid = round((dep_min + dep_max) / 2.0, 3)
        wp = round(wl - ip, 1)

        if not dry_run:
            # 1. Sondage
            cur.execute("""
                INSERT INTO atlas.sondages
                  (code, date_sondage, geom, location_mode, location_accuracy,
                   adm3_id, adm3_name, adm2_name, adm1_name, type_sol,
                   created_by_batch, meta)
                SELECT %s, %s,
                  ST_SetSRID(ST_MakePoint(%s,%s), 4326),
                  'inferred','low', %s,%s,%s,%s, %s, %s, %s::jsonb
                WHERE NOT EXISTS (
                  SELECT 1 FROM atlas.sondages WHERE code=%s AND deleted_at IS NULL
                )
            """, (code, date_essai, lon, lat,
                  adm3_gid, adm3_name, adm2, adm1, materiau,
                  BATCH,
                  f'{{"source":"TREC_EXTRACT","site":"{site_prefix}","sondage":"{snum}",'
                  f'"materiau":"{materiau}","pct_80um":{pct80}}}',
                  code))
            sondages_ok += cur.rowcount

            cur.execute("SELECT id FROM atlas.sondages WHERE code=%s AND deleted_at IS NULL LIMIT 1", (code,))
            row = cur.fetchone()
            if not row:
                print(f"  [SKIP] sondage {code} deja existant — echantillon cherche")
                cur.execute("SELECT id FROM atlas.sondages WHERE code=%s AND deleted_at IS NULL LIMIT 1", (code,))
                row = cur.fetchone()
            sondage_id = str(row[0])

            # 2. Echantillon
            ech_id = str(uuid.uuid4())
            cur.execute("""
                INSERT INTO atlas.echantillons
                  (id, sondage_id, depth_m, depth_z_min, depth_z_max, h_canon, meta)
                SELECT %s,%s,%s,%s,%s,%s,%s::jsonb
                WHERE NOT EXISTS (
                  SELECT 1 FROM atlas.echantillons e
                  WHERE e.sondage_id=%s AND ABS(e.depth_m - %s) < 0.01
                )
            """, (ech_id, sondage_id, depth_mid, dep_min, dep_max, hc,
                  f'{{"batch":"{BATCH}","site":"{site_prefix}","sondage":"{snum}"}}',
                  sondage_id, depth_mid))

            if cur.rowcount == 0:
                cur.execute("SELECT id FROM atlas.echantillons WHERE sondage_id=%s AND ABS(depth_m-%s)<0.01 LIMIT 1",
                            (sondage_id, depth_mid))
                ech_id = str(cur.fetchone()[0])
            else:
                ech_ok += 1

            # 3. essais_vbs
            cur.execute("""
                INSERT INTO atlas.essais_vbs (echantillon_id, vbs, source_reference)
                SELECT %s, %s, %s
                WHERE NOT EXISTS (SELECT 1 FROM atlas.essais_vbs WHERE echantillon_id=%s)
            """, (ech_id, vbs, f"TREC_{site_prefix}_2024", ech_id))
            vbs_ok += cur.rowcount

            # 4. essais_atterberg (WL, WP=LL-IP, IP generé)
            cur.execute("""
                INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip_generated, source_reference)
                SELECT %s, %s, %s, %s, %s
                WHERE NOT EXISTS (SELECT 1 FROM atlas.essais_atterberg WHERE echantillon_id=%s)
            """, (ech_id, float(wl), float(wp), float(ip), f"TREC_{site_prefix}_2024", ech_id))
            att_ok += cur.rowcount

            # 5. essais_classif (HRB + IG)
            cur.execute("""
                INSERT INTO atlas.essais_classif (echantillon_id, hrb, indice_groupe, source_reference)
                SELECT %s, %s, %s, %s
                WHERE NOT EXISTS (SELECT 1 FROM atlas.essais_classif WHERE echantillon_id=%s)
            """, (ech_id, hrb, ig, f"TREC_{site_prefix}_2024", ech_id))

            # 6. essais_proctor OPM
            t2row = t2_idx.get(idx)
            if t2row:
                gd_max_gcm3 = t2row[1]   # t/m3 = g/cm3
                w_opt       = t2row[2]
                gd_kn_m3    = round(gd_max_gcm3 * 10.0, 3)  # convertir en kN/m3
                if 14 <= gd_kn_m3 <= 25 and 0 <= w_opt <= 50:
                    cur.execute("""
                        INSERT INTO atlas.essais_proctor
                          (echantillon_id, proctor_type, gamma_d_max, w_opt, meta)
                        SELECT %s, 'modifie', %s, %s, %s::jsonb
                        WHERE NOT EXISTS (
                          SELECT 1 FROM atlas.essais_proctor
                          WHERE echantillon_id=%s AND proctor_type='modifie'
                        )
                    """, (ech_id, gd_kn_m3, w_opt,
                          f'{{"gamma_d_original_gcm3":{gd_max_gcm3},"batch":"{BATCH}"}}',
                          ech_id))
                    proctor_ok += cur.rowcount

            # 7. essais_cbr (courbe 55/25/12 coups)
            cbr_rows = t3_idx.get(idx, [])
            for cbr_row in cbr_rows:
                _, n_coups, compacite_pct, gd_t, cbr_val, w_imb = cbr_row
                # n_coups -> pour distinguer les niveaux
                cur.execute("""
                    INSERT INTO atlas.essais_cbr
                      (echantillon_id, n_coups, compactage_pct, cbr_pct,
                       gamma_d_gcm3, w_pct, proctor_type, meta)
                    SELECT %s,%s,%s,%s,%s,%s,'modified',%s::jsonb
                    WHERE NOT EXISTS (
                      SELECT 1 FROM atlas.essais_cbr
                      WHERE echantillon_id=%s AND n_coups=%s
                    )
                """, (ech_id, n_coups, compacite_pct, float(cbr_val),
                      gd_t, w_imb,
                      f'{{"batch":"{BATCH}","w_imbibition":{w_imb}}}',
                      ech_id, n_coups))
                cbr_ok += cur.rowcount
        else:
            sondages_ok += 1
            print(f"  DRY: {code} lon={lon:.4f} lat={lat:.4f} hc={hc} VBS={vbs} WL={wl} IP={ip} WP={wp}")

    return sondages_ok, ech_ok, vbs_ok, att_ok, cbr_ok, proctor_ok


def main():
    import argparse
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--database-url", default=DB_URL)
    args = parser.parse_args()

    print("=== Import TREC BADJA + DZEMEKEY ===")
    print(f"Dry-run: {args.dry_run}")
    print(f"BADJA: {len(BADJA_T1)} sondages | DZEMEKEY: {len(DZEMEKEY_T1)} sondages")
    print()

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Desactiver triggers lourds pendant import
    conn2 = psycopg2.connect(args.database_url.replace('atlas:atlas','postgres:postgres'))
    conn2.autocommit = True
    cur2 = conn2.cursor()
    if not args.dry_run:
        cur2.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER trg_refresh_ai_maille_features_fast_sondages_insupd")
        cur2.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER trg_refresh_ai_maille_features_fast_sondages_del")
        print("Trigger desactive")

    # Import BADJA
    print("--- EMPRUNT DE BADJA ---")
    b = import_site(conn, cur, "BADJA", BADJA_T1, BADJA_T2, BADJA_T3,
                    BADJA_ADM3_GID, BADJA_ADM1, BADJA_ADM2, BADJA_ADM3,
                    BADJA_LON_C, BADJA_LAT_C, spread=0.04, dry_run=args.dry_run)
    print(f"  sondages={b[0]} echantillons={b[1]} vbs={b[2]} atterberg={b[3]} cbr={b[4]} proctor={b[5]}")

    # Import DZEMEKEY
    print("--- EMPRUNT DE DZEMEKEY ---")
    d = import_site(conn, cur, "DZEMEKEY", DZEMEKEY_T1, DZEMEKEY_T2, DZEMEKEY_T3,
                    DZEMEKEY_ADM3_GID, DZEMEKEY_ADM1, DZEMEKEY_ADM2, DZEMEKEY_ADM3,
                    DZEMEKEY_LON_C, DZEMEKEY_LAT_C, spread=0.02, dry_run=args.dry_run)
    print(f"  sondages={d[0]} echantillons={d[1]} vbs={d[2]} atterberg={d[3]} cbr={d[4]} proctor={d[5]}")

    if not args.dry_run:
        conn.commit()
        cur2.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER trg_refresh_ai_maille_features_fast_sondages_insupd")
        cur2.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER trg_refresh_ai_maille_features_fast_sondages_del")
        print()
        print("Commit + trigger reactive")

        # Verification
        cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch=%s", (BATCH,))
        print(f"Sondages importes batch={BATCH}: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM atlas.essais_vbs ev JOIN atlas.echantillons e ON e.id=ev.echantillon_id JOIN atlas.sondages s ON s.id=e.sondage_id WHERE s.created_by_batch=%s", (BATCH,))
        print(f"VBS importes: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM atlas.essais_cbr ec JOIN atlas.echantillons e ON e.id=ec.echantillon_id JOIN atlas.sondages s ON s.id=e.sondage_id WHERE s.created_by_batch=%s", (BATCH,))
        print(f"CBR importes: {cur.fetchone()[0]}")
        cur.execute("SELECT COUNT(*) FROM atlas.essais_proctor ep JOIN atlas.echantillons e ON e.id=ep.echantillon_id JOIN atlas.sondages s ON s.id=e.sondage_id WHERE s.created_by_batch=%s", (BATCH,))
        print(f"Proctor importes: {cur.fetchone()[0]}")

        # Verifier VBS global
        cur.execute("SELECT COUNT(*) FROM atlas.essais_vbs")
        print(f"VBS total en DB: {cur.fetchone()[0]} (avant: 810)")

    cur.close(); conn.close()
    cur2.close(); conn2.close()
    print()
    print("DONE")


if __name__ == "__main__":
    main()
