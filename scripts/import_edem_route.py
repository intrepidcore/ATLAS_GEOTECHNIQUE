#!/usr/bin/env python3
"""
import_edem_route.py
Import des données géotechniques routières EDEM :
  - 0012 : Région Maritime  46,8 km  (PC03/PC04/PC07 + emprunts)
  - 0013 : Région Plateaux 207,7 km  (PC06/PC11/PC12/PC14/PC16/PC18/PC20/PC25/PC26/PC30 + emprunts)
  - 0021 : 12 sondages avec coordonnées UTM 31N réelles

Sources :
  EDEM_EXTRACT/0012 - Document - (Région Maritime - 46,8 km).md
  EDEM_EXTRACT/0013 - Document - (région des Plateaux (207.7 km).md
  EDEM_EXTRACT/0021 - Résultats géotechniques 2.md

DB : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
Batch : edem_route_import_2024
"""

import sys
import hashlib
import random
import uuid
import psycopg2
from datetime import date

DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
BATCH  = "edem_route_import_2024"

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def det_point(code: str, lon_c: float, lat_c: float, spread: float = 0.10):
    """Point pseudo-aléatoire déterministe dans un rayon spread autour du centroïde."""
    seed = int(hashlib.sha256(code.encode()).hexdigest(), 16) % (2 ** 32)
    rng = random.Random(seed)
    lon = lon_c + (rng.random() - 0.5) * spread
    lat = lat_c + (rng.random() - 0.5) * spread
    return lon, lat


def h_canon_from_depth(depth_min: float, depth_max: float) -> str:
    centroid = (depth_min + depth_max) / 2.0
    if centroid <= 1.0:
        return "H1"
    elif centroid <= 1.5:
        return "H2"
    else:
        return "H3"


def get_or_create_sondage(cur, code, date_s, lon, lat, location_mode,
                           location_accuracy, adm3_name, adm2_name, adm1_name,
                           type_sol, source, batch):
    cur.execute("""
        INSERT INTO atlas.sondages
          (code, date_sondage, geom, location_mode, location_accuracy,
           adm3_name, adm2_name, adm1_name, type_sol,
           source, created_by_batch, meta)
        SELECT %s, %s,
          ST_SetSRID(ST_MakePoint(%s, %s), 4326),
          %s, %s, %s, %s, %s, %s, %s, %s, %s::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.sondages WHERE code = %s AND deleted_at IS NULL
        )
    """, (code, date_s, lon, lat,
          location_mode, location_accuracy,
          adm3_name, adm2_name, adm1_name,
          type_sol, source, batch,
          f'{{"batch":"{batch}","source":"{source}"}}',
          code))
    inserted = cur.rowcount
    cur.execute("SELECT id FROM atlas.sondages WHERE code = %s AND deleted_at IS NULL LIMIT 1", (code,))
    row = cur.fetchone()
    return str(row[0]), inserted


def get_or_create_echantillon(cur, sondage_id, depth_min, depth_max, batch):
    depth_mid = round((depth_min + depth_max) / 2.0, 3)
    hc = h_canon_from_depth(depth_min, depth_max)
    ech_id = str(uuid.uuid4())
    cur.execute("""
        INSERT INTO atlas.echantillons
          (id, sondage_id, depth_m, depth_z_min, depth_z_max, h_canon, meta)
        SELECT %s, %s, %s, %s, %s, %s, %s::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.echantillons
          WHERE sondage_id = %s AND ABS(depth_m - %s) < 0.01
        )
    """, (ech_id, sondage_id, depth_mid, depth_min, depth_max, hc,
          f'{{"batch":"{batch}"}}',
          sondage_id, depth_mid))
    if cur.rowcount == 0:
        cur.execute("""
            SELECT id FROM atlas.echantillons
            WHERE sondage_id = %s AND ABS(depth_m - %s) < 0.01
            LIMIT 1
        """, (sondage_id, depth_mid))
        ech_id = str(cur.fetchone()[0])
        return ech_id, False
    return ech_id, True


def insert_atterberg(cur, ech_id, wl, ip, source_ref):
    if wl is None or ip is None:
        return 0
    wp = float(wl) - float(ip)
    cur.execute("""
        INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip_generated, source_reference)
        SELECT %s, %s, %s, %s, %s
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.essais_atterberg WHERE echantillon_id = %s
        )
    """, (ech_id, float(wl), wp, float(ip), source_ref, ech_id))
    return cur.rowcount


def insert_cbr(cur, ech_id, cbr_pct, n_coups, source_ref):
    if cbr_pct is None:
        return 0
    cur.execute("""
        INSERT INTO atlas.essais_cbr
          (echantillon_id, cbr_pct, n_coups, proctor_type, source_reference)
        SELECT %s, %s, %s, 'modified', %s
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.essais_cbr
          WHERE echantillon_id = %s AND n_coups = %s
        )
    """, (ech_id, float(cbr_pct), n_coups, source_ref,
          ech_id, n_coups))
    return cur.rowcount


def insert_proctor(cur, ech_id, gamma_d_t_m3, w_opt, batch):
    """gamma_d_t_m3 en t/m³ → multiply by 10 pour kN/m³."""
    if gamma_d_t_m3 is None or w_opt is None:
        return 0
    gd_kn = round(float(gamma_d_t_m3) * 10.0, 3)
    if not (14.0 <= gd_kn <= 25.0) or not (0.0 <= float(w_opt) <= 50.0):
        print(f"  [WARN] Proctor hors plausibilité: gamma_d={gd_kn} kN/m³, w_opt={w_opt}% — skipped")
        return 0
    cur.execute("""
        INSERT INTO atlas.essais_proctor
          (echantillon_id, proctor_type, gamma_d_max, w_opt, meta)
        SELECT %s, 'modifie', %s, %s, %s::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.essais_proctor
          WHERE echantillon_id = %s AND proctor_type = 'modifie'
        )
    """, (ech_id, gd_kn, float(w_opt),
          f'{{"gamma_d_original_t_m3":{gamma_d_t_m3},"batch":"{batch}"}}',
          ech_id))
    return cur.rowcount


def insert_granulo(cur, ech_id, pct80, source_ref):
    if pct80 is None:
        return 0
    cur.execute("""
        INSERT INTO atlas.granulo_points
          (echantillon_id, sieve_mm, passing_pct)
        SELECT %s, 0.08, %s
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.granulo_points
          WHERE echantillon_id = %s AND ABS(sieve_mm - 0.08) < 0.001
        )
    """, (ech_id, float(pct80), ech_id))
    return cur.rowcount


def link_maille(cur, sondage_id):
    """Lie le sondage à sa maille via ST_Within."""
    cur.execute("""
        UPDATE atlas.sondages SET maille_code = (
            SELECT m.code FROM atlas.mailles m
            WHERE ST_Within((SELECT geom FROM atlas.sondages WHERE id = %s), m.geom)
            LIMIT 1
        )
        WHERE id = %s AND maille_code IS NULL
    """, (sondage_id, sondage_id))
    return cur.rowcount


# ===========================================================================
# SOURCE 0012 — Région Maritime 46,8 km
# ===========================================================================
# Tableau 1 : Sondages en chaussée (plateforme)
# Format : (troncon, sondage_num, pk_label, profil, depth_min, depth_max,
#           pct_80um, wl, ip, gamma_d_t_m3, w_opt, cbr_95)
# CBR "Nul" → None ; valeurs manquantes → None
MARITIME_CHAUSSEE = [
    # PC03
    ("PC03", "S1",  "0+300",  "Gauche", 0.10, 0.35, 32,  27, 13, 2.08, 7.6,  76),
    ("PC03", "S1",  "0+300",  "Gauche", 0.35, 1.00, 23,  27, 13, 2.16, 6.6,  30),
    ("PC03", "S2",  "2+300",  "Droit",  0.10, 1.00, 24,  None, None, 2.04, 8.3, 27),
    ("PC03", "S3",  "3+900",  "Gauche", 0.25, 0.70, 23,  35, 12, 2.15, 6.0,  10),
    ("PC03", "S4",  "6+600",  "Droit",  0.15, 0.35, 27,  None, None, 2.04, 8.3, 26),
    ("PC03", "S4",  "6+600",  "Droit",  0.35, 1.00, 11,  43, 12, 1.87, 6.6,  53),
    ("PC03", "S5",  "7+800",  "Gauche", 0.40, 1.00, 14,  32, 17, 2.13, 6.7,  42),
    ("PC03", "S7",  "11+000", "Droit",  0.00, 0.30, 29,  30, 14, 2.05, 7.6,  10),
    ("PC03", "S7",  "11+000", "Droit",  0.30, 1.00, 19,  42, 24, 2.06, 8.5,  11),
    ("PC03", "S8",  "13+000", "Gauche", 0.00, 0.30,  8,  47, 23, 2.11, 7.4,  30),
    ("PC03", "S8",  "13+000", "Gauche", 0.30, 1.00,  8,  36, 18, 2.17, 7.4,  20),
    ("PC03", "S9",  "14+000", "Gauche", 0.30, 1.00, None, 68, 35, 2.15, 10.5, 21),
    ("PC03", "S10", "16+000", "Droit",  0.00, 0.45,  6,  23, 10, 2.22, 7.5, 132),
    ("PC03", "S11", "16+700", "Gauche", 0.20, 1.00, None, None, None, 2.22, 7.1, 35),
    ("PC03", "S12", "18+600", "Gauche", 0.10, 1.00, None, 42, 24, 2.12, 7.6,   7),
    ("PC03", "S13", "21+300", "Droit",  0.10, 1.00, 15,  None, None, 2.02, 6.6, 53),
    ("PC03", "S14", "23+300", "Gauche", 0.00, 0.10, 23,  56, 32, 2.11, 8.3,  19),
    ("PC03", "S14", "23+300", "Gauche", 0.10, 1.00, 18,  46, 20, 2.07, 8.9,  18),
    # PC04
    ("PC04", "S1",  "0+100",  "Gauche", 0.15, 0.50, 14,  None, None, 2.02, 8.9, 40),
    ("PC04", "S2",  "0+500",  "Droit",  0.15, 0.50, 14,  None, None, 2.02, 8.9, 40),
    ("PC04", "S3",  "1+100",  "Gauche", 0.15, 1.00,  5,  None, None, 2.23, 8.5, 41),
    ("PC04", "S4",  "3+000",  "Droit",  0.10, 1.00, 12,  None, None, 1.85, 8.4, 33),
    ("PC04", "S5",  "4+700",  "Gauche", 0.25, 1.00, 33,  26, 10, 2.03, 9.1,  20),
    ("PC04", "S6",  "6+500",  "Droit",  0.20, 1.00, 18,  None, None, 1.95, 6.2, 36),
    ("PC04", "S7",  "7+900",  "Droit",  0.00, 1.00, 23,  21, 11, 2.15, 8.4,  35),
    # PC07
    ("PC07", "S1",  "0+000",  "Gauche", 0.10, 0.35, 17,  30, 15, 2.25, 9.3,  26),
    ("PC07", "S2",  "0+800",  "Droit",  0.00, 1.00, 28,  43, 19, 2.10, 10.1, 16),
    ("PC07", "S3",  "2+300",  "Gauche", 0.20, 1.00, 24,  21,  9, 2.05, 8.3,  30),
    ("PC07", "S4",  "4+000",  "Axe",    0.10, 1.00, 54,  41, 20, 1.79, 12.3,  2),
    ("PC07", "S5",  "4+500",  "Droit",  0.40, 1.00, 27,  21, 10, 2.06, 10.0, 33),
    ("PC07", "S6",  "6+400",  "Gauche", 0.10, 1.00, 54,  35, 16, 1.80, 14.1,  5),
    ("PC07", "S7",  "8+200",  "Gauche", 0.20, 0.65, 48,  29, 13, 1.92, 9.3,   3),
    ("PC07", "S8",  "8+300",  "Droit",  0.00, 1.00, 85,  43, 17, 1.78, 12.4, None),  # CBR Nul
    ("PC07", "S9",  "10+500", "Gauche", 0.30, 1.00, 42,  38, 17, 2.01, 10.5,  2),
    ("PC07", "S10", "12+600", "Droit",  0.00, 1.00, 41,  58, 33, 1.78, 12.0, None),  # CBR Nul
    ("PC07", "S11", "14+700", "Gauche", 0.15, 1.00, 46,  38, 19, 1.94, 10.6,  2),
]

# Tableau 2 : Emprunts Maritime
# Format : (troncon, localite, pct_80um, wl, ip, gamma_d_t_m3, w_opt, cbr_95)
MARITIME_EMPRUNTS = [
    ("PC3", "KODJE",         25, 46, 23, 2.18, 8.4,  21),
    ("PC3", "DJAKPO",        22, 36, 16, 2.23, 4.9,  31),
    ("PC3", "TSITO",         16, 43, 21, 2.12, 5.8,  18),
    ("PC3", "TOKPEVIA_N1",   12, 38, 17, 2.21, 6.3, 114),
    ("PC3", "TOKPEVIA_N2",   28, 40, 19, 2.19, 7.4,  72),
    ("PC3", "KONDOKOPE",     20, 62, 32, 2.06, 8.7,  18),
    ("PC3", "FOULANI_KONDJI",11, 31, 15, 2.20, 6.0,  49),
    ("PC4", "WONOUGBA",      15, 27, 13, 2.13, 8.0,  31),
    ("PC4", "AVEDZE",        11, 22,  8, 2.27, 7.4,  68),
    ("PC4", "KPEVIADZI_N1",   9, 56, 46, 2.23, 9.7,  52),
    ("PC4", "FRANGADUA_N1",   2, None, None, 2.12, 5.0, 63),
    ("PC4", "FRANGADUA_N2",  28, 32, 14, 2.00, 11.4, 15),
    ("PC7", "ZOKPAME",       19, 45, 23, 2.17, 8.2,  46),
    ("PC7", "KOGBE",         28, 63, 33, 1.95, 13.1, 11),
    ("PC7", "ASSI_KOPE",     15, 52, 25, 2.09, 11.9, 15),
]

# ===========================================================================
# SOURCE 0013 — Région Plateaux 207,7 km
# ===========================================================================
# Format identique CHAUSSEE : (troncon, sondage_num, pk_label, profil,
#   depth_min, depth_max, pct_80um, wl, ip, gamma_d_t_m3, w_opt, cbr_95)
PLATEAUX_CHAUSSEE = [
    # PC06
    ("PC06", "S0",  "0+100",  "Droit",  0.25, 1.00, 22,  22, 11, 2.03, 6.3,  14),
    ("PC06", "S1",  "2+000",  "Gauche", 0.20, 1.00, 14,  33, 16, 2.03, 8.0,  23),
    ("PC06", "S2",  "4+000",  "Droit",  0.25, 1.00, 21,  None, None, 1.98, 7.4, 15),
    ("PC06", "S3",  "6+000",  "Gauche", 0.20, 0.50, 23,  22, 12, 1.99, 7.2,  11),
    ("PC06", "S3",  "6+000",  "Gauche", 0.50, 1.00, 14,  None, None, 2.24, 6.0, 20),
    ("PC06", "S4",  "8+000",  "Droit",  0.15, 1.00, 37,  24,  9, 2.02, 8.4,   2),
    ("PC06", "S5",  "10+000", "Gauche", 0.25, 1.00, 12,  23, 10, 2.20, 6.6,  18),
    ("PC06", "S7",  "14+000", "Gauche", 0.25, 1.00, 17,  20, 10, 2.18, 6.0,  39),
    ("PC06", "S8",  "16+000", "Droit",  0.45, 1.00, 11,  26, 11, 2.11, 6.3,  16),
    ("PC06", "S9",  "18+000", "Gauche", 0.20, 1.00, 20,  26, 12, 2.13, 8.2,  20),
    ("PC06", "S10", "20+000", "Droit",  0.15, 1.00, 12,  None, None, 2.24, 6.6, 25),
    # PC11
    ("PC11", "S0",  "0+100",  "Droit",  0.10, 1.00, 19,  36, 17, 2.19, 7.2,  10),
    ("PC11", "S1",  "2+000",  "Gauche", 0.00, 1.00,  9,  19,  7, 2.19, 7.1,  43),
    ("PC11", "S2",  "4+000",  "Droit",  0.20, 1.00, 23,  65, 34, 2.12, 7.5,   9),
    ("PC11", "S3",  "6+000",  "Gauche", 0.20, 1.00, 34,  34, 17, 2.03, 8.4, None),  # Nul
    ("PC11", "S4",  "8+000",  "Droit",  0.30, 1.00, 12,  35, 16, 2.26, 6.1,  21),
    # PC12
    ("PC12", "S0",  "0+100",  "Gauche", 0.25, 1.00, 19,  33, 15, 2.27, 7.0,  18),
    ("PC12", "S1",  "2+000",  "Droit",  0.20, 1.00, 16,  46, 22, 2.14, 8.1,  11),
    ("PC12", "S2",  "4+000",  "Gauche", 0.25, 1.00, 23,  None, None, 2.16, 5.9, 9),
    ("PC12", "S3",  "6+000",  "Droit",  0.20, 1.00, 20,  43, 20, 2.21, 7.7,  28),
    ("PC12", "S4",  "8+000",  "Gauche", 0.60, 1.00, 32,  None, None, 2.05, 6.9, 7),
    ("PC12", "S5",  "10+000", "Droit",  0.15, 1.00, 29,  21,  9, 2.07, 7.7,   9),
    ("PC12", "S6",  "12+000", "Gauche", 0.20, 1.00, 50,  34, 18, 2.00, 7.9,   2),
    ("PC12", "S7",  "14+000", "Droit",  0.25, 1.00, 58,  37, 21, 2.03, 5.6, None),  # Nul
    ("PC12", "S8",  "16+000", "Gauche", 0.15, 1.00, 24,  None, None, 2.00, 6.7, 4),
    ("PC12", "S12", "24+000", "Gauche", 0.00, 1.00, 22,  41, 20, 2.20, 7.4,  16),
    ("PC12", "S13", "26+000", "Droit",  0.00, 1.00, 26,  45, 21, 2.07, 8.9,   4),
    ("PC12", "S14", "28+000", "Gauche", 0.00, 1.00, 26,  None, None, 2.11, 7.0, 20),
    ("PC12", "S15", "29+000", "Droit",  0.00, 1.00, 17,  49, 23, 2.08, 7.9,  18),
    # PC14
    ("PC14", "S0",  "0+000",  "Gauche", 0.25, 1.00, 21,  None, None, 2.26, 5.9, 10),
    ("PC14", "S1",  "2+000",  "Droit",  0.25, 1.00, 30,  None, None, 2.10, 6.9, 13),
    ("PC14", "S2",  "4+000",  "Gauche", 0.35, 1.00, 64,  None, None, 1.94, 8.8, 2),
    ("PC14", "S3",  "6+000",  "Droit",  0.45, 1.00, 24,  None, None, 2.05, 9.5, 2),
    # PC16
    ("PC16", "S0",  "0+000",  "Droit",  0.25, 1.00, 20,  None, None, 2.07, 7.4, 20),
    ("PC16", "S1",  "2+000",  "Gauche", 0.10, 1.00, 15,  None, None, 2.20, 7.8, 21),
    ("PC16", "S2",  "4+000",  "Droit",  0.20, 1.00, 19,  None, None, 1.99, 9.9, 2),
    ("PC16", "S3",  "6+000",  "Gauche", 0.20, 1.00, 32,  None, None, 2.10, 8.6, 2),
    ("PC16", "S4",  "8+000",  "Droit",  0.25, 1.00, 18,  None, None, 2.14, 7.6, 14),
    ("PC16", "S5",  "10+000", "Gauche", 0.20, 1.00, 31,  None, None, 2.06, 8.0, None),  # Nul
    # PC18
    ("PC18", "S0",  "0+000",  "Droit",  0.00, 1.00, 14,  None, None, 2.09, 6.3, 11),
    ("PC18", "S1",  "2+000",  "Gauche", 0.00, 1.00, 14,  None, None, 1.99, 6.7, 11),
    ("PC18", "S2",  "4+000",  "Droit",  0.00, 1.00, 48,  37, 20, 1.99, 9.9,   2),
    ("PC18", "S3",  "6+000",  "Gauche", 0.00, 0.60, 24,  24, 10, 2.09, 8.3,  15),
    ("PC18", "S5",  "10+000", "Gauche", 0.00, 1.00, 60,  33, 16, 2.00, 6.6,   2),
    ("PC18", "S6",  "12+000", "Droit",  0.25, 1.00, 18,  36, 18, 2.21, 7.6,   9),
    ("PC18", "S7",  "14+000", "Gauche", 0.25, 1.00, 55,  34, 17, 2.01, 6.2,   2),
    ("PC18", "S8",  "16+000", "Droit",  0.00, 0.40, 28,  20,  9, 2.02, 7.3,   8),
    ("PC18", "S9",  "18+000", "Gauche", 0.00, 1.00, 54,  24, 12, 1.94, 7.6, None),  # Nul
    ("PC18", "S10", "20+000", "Droit",  0.00, 1.00, 50,  43, 24, 1.98, 9.8,   2),
    # PC20
    ("PC20", "S0",  "0+000",  "Gauche", 0.30, 1.00, 12,  None, None, 2.14, 8.4, 26),
    ("PC20", "S1",  "2+000",  "Droit",  0.30, 1.00, 14,  None, None, 1.94, 8.7, 7),
    ("PC20", "S3",  "6+000",  "Droit",  0.25, 1.00, 20,  None, None, 2.23, 6.4, 47),
    ("PC20", "S5",  "10+000", "Droit",  0.20, 1.00, 11,  None, None, 2.33, 5.6, 52),
    ("PC20", "S6",  "12+000", "Gauche", 0.00, 1.00, 13,  None, None, 2.11, 6.5, 15),
    ("PC20", "S7",  "14+000", "Droit",  0.10, 1.00, 16,  None, None, 2.20, 6.8, 13),
    ("PC20", "S8",  "15+600", "Gauche", 0.00, 1.00,  5,  None, None, 2.30, 5.7, 36),
    # PC25
    ("PC25", "S1",  "2+000",  "Droit",  0.00, 1.00,  8,  25,  8, 2.22, 6.8,  60),
    ("PC25", "S2",  "4+000",  "Gauche", 0.10, 1.00,  7,  24,  7, 2.12, 7.6,  25),
    ("PC25", "S4",  "8+100",  "Gauche", 0.45, 1.00, 10,  22, 10, 2.20, 7.5,  40),
    ("PC25", "S5",  "10+000", "Droit",  0.15, 1.00,  8,  24,  8, 2.24, 7.0,  65),
    # PC26
    ("PC26", "S1",  "2+000",  "Gauche", 0.20, 1.00, 18,  None, None, 1.88, 6.4, 10),
    # PC30
    ("PC30", "S3",  "6+100",  "Gauche", 0.10, 1.00, 12,  29, 12, 2.17, 6.3,  56),
    ("PC30", "S4",  "8+100",  "Droit",  0.00, 1.00, 10,  27, 10, 2.20, 6.2,  68),
    ("PC30", "S11", "22+100", "Gauche", 0.00, 1.00,  9,  22,  9, 2.09, 7.5,  64),
]

# Emprunts Plateaux
# Format : (troncon, localite, pct_80um, wl, ip, gamma_d_t_m3, w_opt, cbr_95)
PLATEAUX_EMPRUNTS = [
    ("PC06", "MESSIWOBE",    12,  None, None, 2.24, 6.6,  29),
    ("PC11", "PK3300_CD",    14,  None, None, 2.10, 8.6,  36),
    ("PC11", "KABLE_KONDJI", 14,  21,   8,   2.25, 6.0,  59),
    ("PC12", "KPOVE",        10,  26,  11,   2.27, 6.8,  80),
    ("PC12", "WEDEME",       13,  27,  14,   2.27, 7.0,  30),
    ("PC14", "SEYDOU_KOPE",  15,  None, None, 2.26, 6.3,  21),
    ("PC14", "KENOUKOPE",    12,  27,  12,   2.26, 5.9,  73),
    ("PC16", "PK8000_CD",    13,  None, None, 2.22, 6.0,  29),
    ("PC18", "GBOBLE",       18,  25,  10,   2.17, 5.4,  69),
    ("PC18", "AMENOUKOPE",   34,  21,   7,   2.16, 5.4,  69),
    ("PC18", "IRANDOMI",     13,  29,  14,   2.12, 6.2,  22),
    ("PC20", "TOKOH",        12,  67,  31,   2.05, 10.7, 36),
    ("PC20", "PK5100_CD",    10,  None, None, 2.27, 6.8,  25),
    ("PC20", "TOKOH_2",       8,  65,  29,   2.16, 4.0,  51),
    ("PC21", "SIM_KOPE",     11,  23,  10,   2.16, 6.8,  38),
    ("PC21", "ATRAVE",       18,  27,   4,   2.12, 5.8,  45),
    ("PC22", "KABLE_KOPE",    7,  26,  10,   2.19, 6.2,  63),
    ("PC23", "KPOGANDJI",    13,  23,   8,   2.24, 6.9,  36),
    ("PC25", "WANOUKOPE",    10,  29,  13,   2.24, 6.6,  64),
    ("PC25", "OKE",          10,  21,   8,   2.21, 7.0,  81),
    ("PC26", "GLITTO",       14,  36,  15,   2.25, 7.4,  46),
    ("PC30", "FODJAYE",       9,  25,  11,   2.23, 6.8,  63),
    ("PC30", "BEDJI",         8,  28,   9,   2.28, 6.4,  58),
    ("PC30", "TCHEKITA",     11,  21,   8,   2.17, 6.7,  79),
]

# ===========================================================================
# SOURCE 0021 — 12 sondages avec coordonnées UTM Zone 31N (EPSG:32631)
# ===========================================================================
# Format : (sondage_num, utm_x, utm_y, depth_min, depth_max,
#           wl, ip, pct_80um, gamma_d_t_m3, w_opt, cbr_95)
UTM21_SONDAGES = [
    # S1 : 2 couches
    ("S1", 299864, 684779, 0.20, 0.80, None, None, 15, 2.09, 10.2, 30),
    ("S1", 299864, 684779, 0.80, 1.05, None, None, 22, 2.04, 10.2, 44),
    # S2
    ("S2", 300804, 684807, 0.70, 1.10, 27, 15, 31, 2.07, 10.2, 25),
    # S3
    ("S3", 300196, 684845, 0.60, 1.00, None, None, 19, 2.06, 7.9, 30),
    # S4 : 2 couches
    ("S4", 300454, 684844, 0.20, 0.60, 24, 13, 29, 2.08, 8.7, 25),
    ("S4", 300454, 684844, 0.80, 1.00, 19, 10, 21, 2.16, 7.1, 28),
    # S5
    ("S5", 300695, 684870, 0.53, 1.20, None, None, 13, 1.99, 7.7, 42),
    # S6
    ("S6", 300934, 684835, 0.00, 1.00, 32, 17, 45, 1.19, 12.3, 3),
    # S7 : 2 couches
    ("S7", 299884, 684794, 0.20, 0.60, 21, 11, 22, 2.16, 7.2, 35),
    ("S7", 299884, 684794, 0.60, 1.00, 34, 17, 40, 1.98, 10.4, 4),
    # S8
    ("S8", 299952, 684867, 0.75, 1.20, None, None, 17, 2.06, 7.2, 44),
    # S9
    ("S9", 300131, 684838, 0.38, 1.10, 25, 13, 47, 1.96, 10.3, 7),
    # S10
    ("S10", 300397, 684856, 0.63, 1.00, 25, 14, 29, 2.15, 7.0, 30),
    # S11
    ("S11", 300668, 684875, 0.60, 1.00, None, None, 16, 2.09, 7.4, 35),
    # S12
    ("S12", 300694, 684854, 0.50, 1.00, 32, 18, 43, 2.01, 8.9, 5),
]


# ===========================================================================
# Import functions
# ===========================================================================

def import_route_source(cur, records, source_tag, source_ref_cbr,
                        batch, lon_c, lat_c, spread,
                        adm1_name, adm2_name,
                        location_mode='inferred', location_accuracy='low',
                        date_s=date(2024, 1, 1)):
    """
    Import générique pour les sondages de chaussée 0012/0013.
    records = liste de (troncon, sondage_num, pk_label, profil,
                        depth_min, depth_max, pct_80um, wl, ip,
                        gamma_d_t_m3, w_opt, cbr_95)
    """
    stats = dict(sondages=0, echantillons=0, atterberg=0,
                 cbr=0, proctor=0, granulo=0, maille=0)

    # Grouper par (troncon, sondage_num) pour créer 1 sondage par point
    from collections import defaultdict
    groups = defaultdict(list)
    for r in records:
        troncon, snum = r[0], r[1]
        groups[(troncon, snum)].append(r)

    for (troncon, snum), rows in groups.items():
        code = f"EDEM_{source_tag}_{troncon}_{snum}"
        lon, lat = det_point(code, lon_c, lat_c, spread)

        sondage_id, ins = get_or_create_sondage(
            cur, code, date_s, lon, lat,
            location_mode, location_accuracy,
            adm3_name=None, adm2_name=adm2_name, adm1_name=adm1_name,
            type_sol="Graveleux lateritique",
            source=source_tag, batch=batch
        )
        if ins:
            stats['sondages'] += 1
            print(f"  [SONDAGE] {code}  lon={lon:.4f} lat={lat:.4f}")
        else:
            print(f"  [SONDAGE] {code} déjà présent — skip")

        for r in rows:
            _, _, pk_label, profil, depth_min, depth_max, pct80, wl, ip, gd, wopt, cbr = r
            ech_id, ech_new = get_or_create_echantillon(
                cur, sondage_id, depth_min, depth_max, batch)
            if ech_new:
                stats['echantillons'] += 1

            if wl is not None:
                n = insert_atterberg(cur, ech_id, wl, ip, source_tag)
                stats['atterberg'] += n
                if n:
                    print(f"    [ATTERBERG] ech {ech_id[:8]} WL={wl} IP={ip}")

            if cbr is not None:
                n = insert_cbr(cur, ech_id, cbr, 25, source_ref_cbr)
                stats['cbr'] += n
                if n:
                    print(f"    [CBR] ech {ech_id[:8]} CBR95={cbr}%")

            if gd is not None:
                n = insert_proctor(cur, ech_id, gd, wopt, batch)
                stats['proctor'] += n
                if n:
                    print(f"    [PROCTOR] ech {ech_id[:8]} gd={gd} w_opt={wopt}%")

            if pct80 is not None:
                n = insert_granulo(cur, ech_id, pct80, source_tag)
                stats['granulo'] += n
                if n:
                    print(f"    [GRANULO] ech {ech_id[:8]} pct80={pct80}%")

        # Liaison maille
        n = link_maille(cur, sondage_id)
        stats['maille'] += n
        if n:
            print(f"  [MAILLE] {code} lié")

    return stats


def import_emprunts(cur, records, source_tag, source_ref_cbr,
                    batch, lon_c, lat_c, spread,
                    adm1_name, adm2_name,
                    date_s=date(2024, 1, 1)):
    """
    Import des emprunts (gisements de matériaux).
    records = (troncon, localite, pct_80um, wl, ip, gamma_d_t_m3, w_opt, cbr_95)
    depth fixe 0.30 à 1.00 m (emprunt standard).
    """
    stats = dict(sondages=0, echantillons=0, atterberg=0,
                 cbr=0, proctor=0, granulo=0, maille=0)

    for r in records:
        troncon, localite, pct80, wl, ip, gd, wopt, cbr = r
        code = f"EDEM_{source_tag}_EMPRUNT_{troncon}_{localite}"
        lon, lat = det_point(code, lon_c, lat_c, spread)

        sondage_id, ins = get_or_create_sondage(
            cur, code, date_s, lon, lat,
            'inferred', 'low',
            adm3_name=None, adm2_name=adm2_name, adm1_name=adm1_name,
            type_sol="Graveleux lateritique",
            source=source_tag, batch=batch
        )
        if ins:
            stats['sondages'] += 1
            print(f"  [SONDAGE] {code}  lon={lon:.4f} lat={lat:.4f}")
        else:
            print(f"  [SONDAGE] {code} déjà présent — skip")

        ech_id, ech_new = get_or_create_echantillon(
            cur, sondage_id, 0.30, 1.00, batch)
        if ech_new:
            stats['echantillons'] += 1

        if wl is not None:
            n = insert_atterberg(cur, ech_id, wl, ip, source_tag)
            stats['atterberg'] += n
            if n:
                print(f"    [ATTERBERG] {localite} WL={wl} IP={ip}")

        if cbr is not None:
            n = insert_cbr(cur, ech_id, cbr, 25, source_ref_cbr)
            stats['cbr'] += n
            if n:
                print(f"    [CBR] {localite} CBR95={cbr}%")

        if gd is not None:
            n = insert_proctor(cur, ech_id, gd, wopt, batch)
            stats['proctor'] += n
            if n:
                print(f"    [PROCTOR] {localite} gd={gd} w_opt={wopt}%")

        if pct80 is not None:
            n = insert_granulo(cur, ech_id, pct80, source_tag)
            stats['granulo'] += n
            if n:
                print(f"    [GRANULO] {localite} pct80={pct80}%")

        n = link_maille(cur, sondage_id)
        stats['maille'] += n

    return stats


def import_utm21(cur, records, batch, date_s=date(2024, 1, 1)):
    """
    Import des 12 sondages 0021 avec coordonnées UTM 31N réelles.
    Conversion UTM→WGS84 via pyproj.
    """
    try:
        from pyproj import Transformer
        transformer = Transformer.from_crs(32631, 4326, always_xy=True)
    except ImportError:
        print("  [WARN] pyproj non disponible. Utilisation fallback lon/lat approché (Lomé).")
        transformer = None

    source_tag = "EDEM_0021_ROUTE"
    source_ref_cbr = "CBR_EDEM_0021"

    stats = dict(sondages=0, echantillons=0, atterberg=0,
                 cbr=0, proctor=0, granulo=0, maille=0)

    from collections import defaultdict
    groups = defaultdict(list)
    for r in records:
        groups[r[0]].append(r)

    for snum, rows in groups.items():
        utm_x, utm_y = rows[0][1], rows[0][2]
        if transformer:
            lon, lat = transformer.transform(utm_x, utm_y)
        else:
            # fallback centroide Lomé
            seed = int(hashlib.sha256(snum.encode()).hexdigest(), 16) % (2 ** 32)
            rng = random.Random(seed)
            lon = 1.22 + (rng.random() - 0.5) * 0.02
            lat = 6.14 + (rng.random() - 0.5) * 0.02

        code = f"EDEM_0021_{snum}"

        sondage_id, ins = get_or_create_sondage(
            cur, code, date_s, lon, lat,
            'geocoded', 'medium',
            adm3_name=None, adm2_name=None, adm1_name="Maritime",
            type_sol="Sable argileux",
            source=source_tag, batch=batch
        )
        if ins:
            stats['sondages'] += 1
            print(f"  [SONDAGE] {code}  lon={lon:.6f} lat={lat:.6f} (UTM→WGS84)")
        else:
            print(f"  [SONDAGE] {code} déjà présent — skip")

        for r in rows:
            _, _, _, depth_min, depth_max, wl, ip, pct80, gd, wopt, cbr = r

            ech_id, ech_new = get_or_create_echantillon(
                cur, sondage_id, depth_min, depth_max, batch)
            if ech_new:
                stats['echantillons'] += 1

            if wl is not None:
                n = insert_atterberg(cur, ech_id, wl, ip, source_ref_cbr)
                stats['atterberg'] += n
                if n:
                    print(f"    [ATTERBERG] {snum} {depth_min}-{depth_max}m WL={wl} IP={ip}")

            if cbr is not None:
                n = insert_cbr(cur, ech_id, cbr, 25, source_ref_cbr)
                stats['cbr'] += n
                if n:
                    print(f"    [CBR] {snum} {depth_min}-{depth_max}m CBR95={cbr}%")

            if gd is not None:
                n = insert_proctor(cur, ech_id, gd, wopt, batch)
                stats['proctor'] += n
                if n:
                    print(f"    [PROCTOR] {snum} gd={gd} w_opt={wopt}%")

            if pct80 is not None:
                n = insert_granulo(cur, ech_id, pct80, source_ref_cbr)
                stats['granulo'] += n
                if n:
                    print(f"    [GRANULO] {snum} pct80={pct80}%")

        n = link_maille(cur, sondage_id)
        stats['maille'] += n
        if n:
            print(f"  [MAILLE] {code} lié")

    return stats


def merge_stats(a, b):
    return {k: a[k] + b.get(k, 0) for k in a}


# ===========================================================================
# main
# ===========================================================================

def main():
    import argparse
    parser = argparse.ArgumentParser(description="Import EDEM Route (0012+0013+0021)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Afficher les données sans insérer en DB")
    parser.add_argument("--database-url", default=DB_URL)
    args = parser.parse_args()

    print("=" * 60)
    print("Import EDEM Route : Maritime (0012) + Plateaux (0013) + UTM (0021)")
    print(f"DB  : {args.database_url}")
    print(f"Dry : {args.dry_run}")
    print("=" * 60)

    if args.dry_run:
        print("[DRY-RUN] Aucune modification en base.")
        total_records = (len(MARITIME_CHAUSSEE) + len(MARITIME_EMPRUNTS) +
                         len(PLATEAUX_CHAUSSEE) + len(PLATEAUX_EMPRUNTS) +
                         len(UTM21_SONDAGES))
        print(f"  Total enregistrements sources : {total_records}")
        print(f"  0012 Maritime chaussée : {len(MARITIME_CHAUSSEE)} couches")
        print(f"  0012 Maritime emprunts : {len(MARITIME_EMPRUNTS)} gisements")
        print(f"  0013 Plateaux chaussée : {len(PLATEAUX_CHAUSSEE)} couches")
        print(f"  0013 Plateaux emprunts : {len(PLATEAUX_EMPRUNTS)} gisements")
        print(f"  0021 UTM sondages      : {len(UTM21_SONDAGES)} couches")
        return

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Comptes avant
    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch = %s", (BATCH,))
    cnt_before = cur.fetchone()[0]
    print(f"\nSondages existants batch={BATCH} : {cnt_before}")

    global_stats = dict(sondages=0, echantillons=0, atterberg=0,
                        cbr=0, proctor=0, granulo=0, maille=0)

    # --- 0012 Maritime chaussée ---
    print("\n--- 0012 Maritime : sondages chaussée ---")
    s = import_route_source(
        cur, MARITIME_CHAUSSEE,
        source_tag='EDEM_0012_MARITIME',
        source_ref_cbr='CBR_EDEM_0012',
        batch=BATCH,
        lon_c=1.25, lat_c=6.30, spread=0.15,
        adm1_name='Maritime', adm2_name=None,
        location_mode='inferred', location_accuracy='low',
        date_s=date(2024, 1, 1)
    )
    global_stats = merge_stats(global_stats, s)
    print(f"  -> {s}")

    # --- 0012 Maritime emprunts ---
    print("\n--- 0012 Maritime : emprunts ---")
    s = import_emprunts(
        cur, MARITIME_EMPRUNTS,
        source_tag='EDEM_0012_MARITIME',
        source_ref_cbr='CBR_EDEM_0012',
        batch=BATCH,
        lon_c=1.25, lat_c=6.30, spread=0.20,
        adm1_name='Maritime', adm2_name=None,
        date_s=date(2024, 1, 1)
    )
    global_stats = merge_stats(global_stats, s)
    print(f"  -> {s}")

    # --- 0013 Plateaux chaussée ---
    print("\n--- 0013 Plateaux : sondages chaussée ---")
    s = import_route_source(
        cur, PLATEAUX_CHAUSSEE,
        source_tag='EDEM_0013_PLATEAUX',
        source_ref_cbr='CBR_EDEM_0013',
        batch=BATCH,
        lon_c=1.15, lat_c=7.20, spread=0.40,
        adm1_name='Plateaux', adm2_name=None,
        location_mode='inferred', location_accuracy='low',
        date_s=date(2024, 1, 1)
    )
    global_stats = merge_stats(global_stats, s)
    print(f"  -> {s}")

    # --- 0013 Plateaux emprunts ---
    print("\n--- 0013 Plateaux : emprunts ---")
    s = import_emprunts(
        cur, PLATEAUX_EMPRUNTS,
        source_tag='EDEM_0013_PLATEAUX',
        source_ref_cbr='CBR_EDEM_0013',
        batch=BATCH,
        lon_c=1.15, lat_c=7.20, spread=0.50,
        adm1_name='Plateaux', adm2_name=None,
        date_s=date(2024, 1, 1)
    )
    global_stats = merge_stats(global_stats, s)
    print(f"  -> {s}")

    # --- 0021 UTM ---
    print("\n--- 0021 Sondages UTM 31N ---")
    s = import_utm21(cur, UTM21_SONDAGES, batch=BATCH)
    global_stats = merge_stats(global_stats, s)
    print(f"  -> {s}")

    # Commit
    conn.commit()
    print("\nCommit OK")

    # Comptes après
    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch = %s", (BATCH,))
    cnt_after = cur.fetchone()[0]
    print(f"Sondages batch={BATCH} après import : {cnt_after} (+{cnt_after - cnt_before})")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.essais_cbr ec
        JOIN atlas.echantillons e ON e.id = ec.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE s.created_by_batch = %s
    """, (BATCH,))
    print(f"CBR total batch    : {cur.fetchone()[0]}")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.essais_proctor ep
        JOIN atlas.echantillons e ON e.id = ep.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE s.created_by_batch = %s
    """, (BATCH,))
    print(f"Proctor total batch: {cur.fetchone()[0]}")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.essais_atterberg ea
        JOIN atlas.echantillons e ON e.id = ea.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE s.created_by_batch = %s
    """, (BATCH,))
    print(f"Atterberg total    : {cur.fetchone()[0]}")

    print("\n=== STATS INSÉRÉES CETTE SESSION ===")
    print(global_stats)

    cur.close()
    conn.close()
    print("\nDONE")


if __name__ == "__main__":
    main()
