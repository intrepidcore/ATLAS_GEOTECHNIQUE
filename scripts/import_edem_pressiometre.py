#!/usr/bin/env python3
"""
import_edem_pressiometre.py
Import des données géotechniques de fondation EDEM (pressiomètre Ménard) :
  - 0015 : Site de Alinka             (Plateaux)
  - 0017 : Site d'Attiégou            (Plateaux)
  - 0017 : Site de Logote             (Maritime / Lomé)
  - 0018 : Site de Zossime            (Maritime / Lomé)
  - 0018 : Site de Dangbessito        (Maritime / Lomé)
  - 0020 : Immeuble INAM à Zossimé    (Maritime / Lomé)

Sources :
  EDEM_EXTRACT/0015 - Résultats géotechniques site de Alinka.md
  EDEM_EXTRACT/0017 - Résultats géotechniques site d'Attiégou.md
  EDEM_EXTRACT/0017 - Résultats géotechniques site de Logote.md
  EDEM_EXTRACT/0018 - Résultats géotechniques site de Zossime.md
  EDEM_EXTRACT/0018 - Résultats géotechniques site d'Dangbessito.md
  EDEM_EXTRACT/0020 - Résultats géotechniques immeuble INAM à Zossimé.md

DB  : postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean
Batch : edem_fondation_import_2024
"""

import sys
import uuid
import psycopg2
from datetime import date

DB_URL = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
BATCH  = "edem_fondation_import_2024"
SOURCE_REF_PRESSIO = "EDEM_PRESSIOMETRE_FONDATION"


# ===========================================================================
# Sites data
# ===========================================================================
# Chaque site est un dict avec :
#   code          : code sondage unique
#   source_tag    : identifiant fichier source
#   lon, lat      : coordonnées WGS84 (inferred depuis localité)
#   adm1_name     : région administrative
#   type_sol      : nature principale du terrain
#   date_s        : date sondage
#   pressio       : liste (prof_m, pf_mpa, pl_mpa, em_mpa, pl_star_mpa, e_pl_ratio)
#   lab           : liste (depth_min, depth_max, pct80, wl, ip, gamma_d_t_m3, w_opt)
#                   (gamma_d_t_m3 = None si pas de Proctor)
# ===========================================================================

# ---------------------------------------------------------------------------
# 0015 — Alinka (Région Plateaux)
# Coordonnées source : 06°14'39.48"N 01°14'01.62"E → WGS84 valides
# Mais les PD (11°04'07" N 00°04'33" E) sont erronées (nord Togo/Ghana).
# On utilise les coordonnées générales du site : lat=6.244300, lon=1.233783
# ---------------------------------------------------------------------------
SITE_ALINKA = {
    "code": "EDEM_0015_ALINKA",
    "source_tag": "EDEM_0015_ALINKA",
    "lon": 1.233783,
    "lat": 6.244300,
    "adm1_name": "Plateaux",
    "adm2_name": None,
    "adm3_name": None,
    "type_sol": "Argile jaunâtre",
    "date_s": date(2024, 1, 1),
    # Tableau 4 page 11 — Pressiomètre Ménard
    # (prof_m, pf_mpa, pl_mpa, em_mpa, pl_star_mpa, e_pl_ratio)
    "pressio": [
        (1.00,  0.51, 0.66, 1.02,  0.58,  1.76),
        (2.00,  0.61, 0.83, 2.83,  0.82,  3.47),
        (3.00,  0.42, 0.63, 4.91,  0.60,  8.18),
        (4.00,  0.66, 0.98, 4.75,  0.94,  5.04),
        (5.00,  0.68, 0.92, 5.73,  0.91,  6.30),
        (6.00,  0.63, 0.84, 5.27,  0.77,  6.81),
        (7.00,  0.88, 1.12, 5.61,  1.05,  5.34),
        (8.00,  0.88, 1.12, 6.00,  1.02,  5.86),
        (9.00,  1.01, 1.29, 5.85,  1.09,  5.37),
        (10.00, 1.44, 1.88, 6.01,  1.16,  5.18),
        (11.00, 2.01, 2.38, 5.14,  1.29,  3.98),
        (12.00, 2.03, 2.29, 5.17,  1.44,  3.59),
        (13.00, 1.68, 2.35, 6.29,  1.48,  4.25),
        (14.00, 1.33, 1.68, 5.68,  1.45,  3.92),
        (15.00, 1.55, 1.74, 6.23,  1.59,  3.92),
        (16.00, 1.42, 1.91, 5.76,  1.57,  3.67),
        (17.00, 1.28, 1.52, 6.66,  1.46,  4.56),
        (18.00, 1.38, 1.78, 8.37,  1.58,  5.30),
        (19.00, 1.56, 1.99, 9.71,  1.58,  6.15),
        (20.00, 1.34, 1.86, 9.12,  1.53,  5.96),
    ],
    # Tableau 8 — Identification
    # (depth_min, depth_max, pct80, wl, ip, gamma_d_t_m3, w_opt)
    # gamma_d_opm lu : 1.86 et 1.78 g/cm³ → *10 = kN/m³
    "lab": [
        (0.50, 1.50, 56.91, 47.50, 30.84, 1.86, 13.10),
        (1.50, 2.50, 64.86, 46.50, 30.41, 1.78, 14.25),
    ],
}

# ---------------------------------------------------------------------------
# 0017 — Attiégou (Région Plateaux / proche Lomé selon coordonnées générales)
# Coordonnées générales site : 06°14'39.48"N 01°14'01.62"E
# → on utilise fallback Plateaux (lon=1.12, lat=7.48) car texte dit "Attiégou"
# qui est dans la région des Plateaux
# ---------------------------------------------------------------------------
SITE_ATTIEGOU = {
    "code": "EDEM_0017_ATTIEGOU",
    "source_tag": "EDEM_0017_ATTIEGOU",
    "lon": 1.12,
    "lat": 7.48,
    "adm1_name": "Plateaux",
    "adm2_name": None,
    "adm3_name": None,
    "type_sol": "Sable silto argileux rougeâtre",
    "date_s": date(2024, 1, 1),
    # Tableau page 11 — Pressiomètre Ménard
    "pressio": [
        (1.00,  0.54, 0.62,  3.10, 0.66,  4.70),
        (3.00,  0.33, 0.41,  4.91, 0.41, 11.98),
        (5.00,  0.43, 0.58,  5.71, 0.55, 10.38),
        (7.00,  1.14, 1.23,  6.59, 1.17,  5.63),
        (9.00,  1.09, 1.38,  8.22, 1.21,  6.79),
        (11.00, 1.01, 1.25,  9.17, 1.20,  7.64),
        (13.00, 1.15, 1.38, 10.29, 1.29,  7.98),
        (15.00, 1.38, 1.88, 10.22, 1.74,  5.87),
        (17.00, 1.38, 1.67, 11.80, 1.52,  7.76),
        (19.00, 1.35, 1.99, 13.57, 1.82,  7.46),
        (21.00, 1.36, 1.88, 14.81, 1.83,  8.09),
        (23.00, 1.24, 1.90, 14.57, 1.80,  8.09),
        (25.00, 0.88, 1.12, 14.45, 1.20, 12.04),
    ],
    # Tableau 8 — Identification (pas de Proctor → gamma_d_t_m3=None)
    # depth_mid estimé à partir de "3,00 à 3,50" → 3.00-3.50
    "lab": [
        (3.00, 3.50, 37.3, 39, 15, None, None),
        (7.00, 7.50, 36.2, 36, 14, None, None),
        # Couches plus profondes : pas d'Atterberg exploitable en fondation shallow
        (13.00, 13.50, 28.1, 60, 28, None, None),
        (22.00, 22.50, 21.1, 64, 30, None, None),
    ],
}

# ---------------------------------------------------------------------------
# 0017 — Logote (Maritime / Lomé)
# Coordonnées source PD erronées (11°N). On utilise Maritime/Lomé.
# Note : différent de 0001 Château d'eau LOGOTE.
# lon=1.25, lat=6.25 (Maritime, proche Lomé)
# ---------------------------------------------------------------------------
SITE_LOGOTE = {
    "code": "EDEM_0017_LOGOTE",
    "source_tag": "EDEM_0017_LOGOTE",
    "lon": 1.25,
    "lat": 6.25,
    "adm1_name": "Maritime",
    "adm2_name": None,
    "adm3_name": None,
    "type_sol": "Sable silto argileux rougeâtre",
    "date_s": date(2024, 1, 1),
    # Tableau page 10 — Pressiomètre Ménard (30m)
    "pressio": [
        (1.00,  0.61, 0.82,  2.03, 0.66,  3.08),
        (3.00,  0.43, 0.63,  9.10, 0.60, 15.17),
        (5.00,  1.07, 1.70, 13.70, 1.66,  8.25),
        (7.00,  1.34, 1.93, 12.61, 1.87,  6.76),
        (10.00, 1.29, 1.88, 15.01, 1.79,  8.39),
        (13.00, 1.38, 2.35, 21.29, 2.23,  9.54),
        (15.00, 1.69, 2.88, 32.23, 2.75, 11.74),
        (17.00, 2.18, 2.88, 14.39, 2.61,  5.51),
        (20.00, 1.76, 2.99, 34.12, 2.81, 12.13),
        (25.00, 2.16, 3.67, 33.35, 3.44,  9.69),
        (30.00, 2.24, 3.81, 32.03, 3.54,  9.05),
    ],
    # Tableau 8 — Identification
    "lab": [
        (3.00,  3.50, 18.3, 23,  8, None, None),
        (7.00,  7.50, 74.1, 48, 20, None, None),
        (12.50, 13.00, 75.3, 70, 37, None, None),
        (22.00, 22.50, 95.5, 75, 37, None, None),
    ],
}

# ---------------------------------------------------------------------------
# 0018 — Zossime (Maritime / Lomé)
# Coordonnées générales site : 06°14'39.48"N 01°14'01.62"E → valides
# On utilise approx Lomé : lon=1.22, lat=6.19
# ---------------------------------------------------------------------------
SITE_ZOSSIME = {
    "code": "EDEM_0018_ZOSSIME",
    "source_tag": "EDEM_0018_ZOSSIME",
    "lon": 1.22,
    "lat": 6.19,
    "adm1_name": "Maritime",
    "adm2_name": None,
    "adm3_name": None,
    "type_sol": "Sable silto-argileux rougeâtre",
    "date_s": date(2024, 1, 1),
    # Tableau page 10 — Pressiomètre Ménard
    "pressio": [
        (1.00,  0.62, 0.80, 11.12, 0.79, 14.06),
        (3.00,  1.38, 1.44, 20.98, 1.41, 14.85),
        (5.00,  1.44, 1.48, 23.32, 1.43, 16.31),
        (7.00,  2.01, 1.42, 24.65, 1.34, 18.37),
        (10.00, 1.67, 1.88, 31.48, 1.76, 17.89),
        (13.00, 1.78, 1.66, 36.02, 1.50, 24.05),
        (15.00, 1.72, 1.44, 36.69, 1.25, 29.35),
        (18.00, 1.92, 2.37, 38.22, 2.14, 17.88),
        (20.00, 1.94, 2.28, 40.01, 2.02, 19.81),
    ],
    # Tableau 8 — Identification
    "lab": [
        (2.50, 3.00, 36.8, 28, 10, None, None),
        (7.00, 7.50, 48.1, 42, 23, None, None),
        (11.00, 11.50, 44.2, 40, 22, None, None),
    ],
}

# ---------------------------------------------------------------------------
# 0018 — Dangbessito (Maritime / Lomé)
# Coordonnées PD erronées (11°N, rapport le note lui-même).
# Fallback Maritime : lon=1.18, lat=6.22
# ---------------------------------------------------------------------------
SITE_DANGBESSITO = {
    "code": "EDEM_0018_DANGBESSITO",
    "source_tag": "EDEM_0018_DANGBESSITO",
    "lon": 1.18,
    "lat": 6.22,
    "adm1_name": "Maritime",
    "adm2_name": None,
    "adm3_name": None,
    "type_sol": "Sable argileux jaunâtre",
    "date_s": date(2024, 1, 1),
    # Tableau page 10 — Pressiomètre Ménard
    "pressio": [
        (1.00,  0.22, 0.36, 0.98, 0.33, 2.97),
        (3.00,  0.48, 0.55, 1.66, 0.50, 3.32),
        (5.00,  0.55, 0.78, 2.78, 0.71, 3.92),
        (7.00,  0.84, 1.11, 2.64, 1.00, 2.64),
        (9.00,  0.86, 1.15, 3.09, 1.06, 2.92),
        (10.00, 0.88, 1.18, 4.06, 1.05, 3.87),
    ],
    # Tableau 8 — Identification (pas de Proctor dans le fichier)
    "lab": [
        (3.50, 4.00, 26.2, 38, 17, None, None),
        (6.50, 7.00, 38.6, 48, 29, None, None),
    ],
}

# ---------------------------------------------------------------------------
# 0020 — INAM Zossimé (Maritime / Lomé)
# Coordonnées PD (11°04'07"N 00°04'33"E) incorrectes (nord Togo/Ghana).
# Projet décrit comme "immeuble INAM à Zossimé (Lomé)" → centroide Lomé.
# lon=1.22, lat=6.19
# ---------------------------------------------------------------------------
SITE_INAM_ZOSSIME = {
    "code": "EDEM_0020_INAM_ZOSSIME",
    "source_tag": "EDEM_0020_INAM_ZOSSIME",
    "lon": 1.22,
    "lat": 6.19,
    "adm1_name": "Maritime",
    "adm2_name": None,
    "adm3_name": None,
    "type_sol": "Sable silto-argileux rougeâtre",
    "date_s": date(2024, 1, 1),
    # Tableau page 10 — Pressiomètre Ménard (10 points)
    "pressio": [
        (1.00,  0.62, 0.80, 11.12, 0.79, 14.06),
        (3.00,  1.38, 1.44, 20.98, 1.41, 14.85),
        (5.00,  1.44, 1.48, 23.32, 1.43, 16.31),
        (7.00,  2.01, 1.42, 24.65, 1.34, 18.37),
        (10.00, 1.67, 1.88, 31.48, 1.76, 17.89),
        (13.00, 1.78, 1.66, 36.02, 1.50, 24.05),
        (15.00, 1.72, 1.44, 36.69, 1.25, 29.35),
        (17.00, 1.76, 1.68, 38.02, 1.46, 26.01),
        (19.00, 2.00, 2.08, 40.18, 1.83, 21.91),
        (20.00, 1.94, 2.28, 40.01, 2.02, 19.81),
    ],
    # Tableau 8 — Identification (pas de LL explicite dans fichier 0020)
    # Les IP sont fournis sans LL → on stocke granulo + IP uniquement
    "lab": [
        (2.50, 3.00, 36.8, None, 10, None, None),
        (7.00, 7.50, 48.1, None, 23, None, None),
        (11.00, 11.50, 44.2, None, 22, None, None),
    ],
}

# Liste de tous les sites
ALL_SITES = [
    SITE_ALINKA,
    SITE_ATTIEGOU,
    SITE_LOGOTE,
    SITE_ZOSSIME,
    SITE_DANGBESSITO,
    SITE_INAM_ZOSSIME,
]


# ===========================================================================
# Helpers
# ===========================================================================

def h_canon_from_prof(prof_m: float) -> str:
    """Détermine le h_canon depuis la profondeur pressiométrique."""
    if prof_m <= 1.0:
        return "H1"
    elif prof_m <= 1.5:
        return "H2"
    else:
        return "H3"


def h_canon_from_depth(depth_min: float, depth_max: float) -> str:
    centroid = (depth_min + depth_max) / 2.0
    if centroid <= 1.0:
        return "H1"
    elif centroid <= 1.5:
        return "H2"
    else:
        return "H3"


def get_or_create_sondage(cur, code, date_s, lon, lat,
                           adm3_name, adm2_name, adm1_name,
                           type_sol, source_tag, batch):
    cur.execute("""
        INSERT INTO atlas.sondages
          (code, date_sondage, geom, location_mode, location_accuracy,
           adm3_name, adm2_name, adm1_name, type_sol,
           source, created_by_batch, meta)
        SELECT %s, %s,
          ST_SetSRID(ST_MakePoint(%s, %s), 4326),
          'inferred', 'low',
          %s, %s, %s, %s, %s, %s, %s::jsonb
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.sondages WHERE code = %s AND deleted_at IS NULL
        )
    """, (code, date_s, lon, lat,
          adm3_name, adm2_name, adm1_name,
          type_sol, source_tag, batch,
          f'{{"batch":"{batch}","source":"{source_tag}","type":"fondation_pressiometre"}}',
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


def get_or_create_echantillon_pressio(cur, sondage_id, prof_m, batch):
    """
    Pour les mesures pressiométriques, depth_z_min = prof_m - 0.5,
    depth_z_max = prof_m (intervalle standard Ménard).
    """
    depth_min = max(0.0, round(prof_m - 0.5, 2))
    depth_max = round(prof_m, 2)
    return get_or_create_echantillon(cur, sondage_id, depth_min, depth_max, batch)


def insert_pressiometre(cur, ech_id, prof_m, pf, pl, em, pl_star, e_pl_ratio):
    hc = h_canon_from_prof(prof_m)
    cur.execute("""
        INSERT INTO atlas.essais_pressiometre
          (echantillon_id, z_reel_m, h_canon,
           pf_mpa, pl_mpa, em_mpa, e_pl_ratio, source_reference)
        SELECT %s, %s, %s, %s, %s, %s, %s, %s
        WHERE NOT EXISTS (
          SELECT 1 FROM atlas.essais_pressiometre
          WHERE echantillon_id = %s AND ABS(z_reel_m - %s) < 0.01
        )
    """, (ech_id, prof_m, hc,
          pf, pl, em, e_pl_ratio, SOURCE_REF_PRESSIO,
          ech_id, prof_m))
    return cur.rowcount


def insert_atterberg(cur, ech_id, wl, ip, source_ref):
    if wl is None:
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


def insert_proctor(cur, ech_id, gamma_d_t_m3, w_opt, batch):
    """gamma_d en t/m³ → kN/m³ (×10)."""
    if gamma_d_t_m3 is None or w_opt is None:
        return 0
    gd_kn = round(float(gamma_d_t_m3) * 10.0, 3)
    if not (14.0 <= gd_kn <= 25.0) or not (0.0 <= float(w_opt) <= 50.0):
        print(f"  [WARN] Proctor hors plausibilité: gamma_d={gd_kn} kN/m³ w_opt={w_opt}% — skipped")
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


def link_maille(cur, sondage_id):
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
# Import d'un site
# ===========================================================================

def import_site(cur, site: dict, batch: str) -> dict:
    """
    Importe un site complet :
      1. Sondage
      2. Echantillons pressiométriques + essais_pressiometre
      3. Echantillons lab + essais_atterberg + granulo_points + essais_proctor
      4. Liaison maille
    """
    stats = dict(sondages=0, echantillons=0, pressiometre=0,
                 atterberg=0, granulo=0, proctor=0, maille=0)

    code = site["code"]
    print(f"\n{'='*55}")
    print(f"[SITE] {code}")
    print(f"       lon={site['lon']:.6f}  lat={site['lat']:.6f}")
    print(f"       source={site['source_tag']}")

    # 1. Sondage
    sondage_id, ins = get_or_create_sondage(
        cur, code, site["date_s"], site["lon"], site["lat"],
        adm3_name=site.get("adm3_name"),
        adm2_name=site.get("adm2_name"),
        adm1_name=site.get("adm1_name"),
        type_sol=site["type_sol"],
        source_tag=site["source_tag"],
        batch=batch
    )
    stats['sondages'] += ins
    if ins:
        print(f"  [SONDAGE] {code} inséré (id={sondage_id[:8]}...)")
    else:
        print(f"  [SONDAGE] {code} déjà présent — réutilisation id={sondage_id[:8]}...")

    # 2. Pressiomètre
    for p in site["pressio"]:
        prof_m, pf, pl, em, pl_star, e_pl_ratio = p
        ech_id, ech_new = get_or_create_echantillon_pressio(
            cur, sondage_id, prof_m, batch)
        if ech_new:
            stats['echantillons'] += 1

        n = insert_pressiometre(cur, ech_id, prof_m, pf, pl, em, pl_star, e_pl_ratio)
        stats['pressiometre'] += n
        if n:
            print(f"  [PRESSIOMETRE] z={prof_m}m  Em={em} MPa  Pl={pl} MPa  E/Pl*={e_pl_ratio}")

    # 3. Données laboratoire
    for lab in site["lab"]:
        d_min, d_max, pct80, wl, ip, gd, wopt = lab
        ech_id, ech_new = get_or_create_echantillon(
            cur, sondage_id, d_min, d_max, batch)
        if ech_new:
            stats['echantillons'] += 1

        if wl is not None and ip is not None:
            n = insert_atterberg(cur, ech_id, wl, ip, site["source_tag"])
            stats['atterberg'] += n
            if n:
                print(f"  [ATTERBERG] {d_min}-{d_max}m  WL={wl}%  IP={ip}%")
        elif ip is not None:
            # IP sans WL (cas INAM 0020) : on stocke seulement en granulo/IP
            # On ne peut pas insérer essais_atterberg sans WL → skip silencieux
            print(f"  [ATTERBERG] {d_min}-{d_max}m  IP={ip}% (WL absent — skip)")

        n = insert_granulo(cur, ech_id, pct80, site["source_tag"])
        stats['granulo'] += n
        if n:
            print(f"  [GRANULO] {d_min}-{d_max}m  <80µm={pct80}%")

        n = insert_proctor(cur, ech_id, gd, wopt, batch)
        stats['proctor'] += n
        if n:
            print(f"  [PROCTOR] {d_min}-{d_max}m  gd={gd} t/m³  w_opt={wopt}%")

    # 4. Liaison maille
    n = link_maille(cur, sondage_id)
    stats['maille'] += n
    if n:
        print(f"  [MAILLE] {code} lié à sa maille")

    return stats


# ===========================================================================
# main
# ===========================================================================

def main():
    import argparse
    parser = argparse.ArgumentParser(
        description="Import EDEM Pressiomètre Fondation (0015/0017/0018/0020)")
    parser.add_argument("--dry-run", action="store_true",
                        help="Afficher les données sans insérer en DB")
    parser.add_argument("--database-url", default=DB_URL)
    args = parser.parse_args()

    print("=" * 60)
    print("Import EDEM Pressiomètre Fondation")
    print(f"DB  : {args.database_url}")
    print(f"Dry : {args.dry_run}")
    print("Sites :")
    for site in ALL_SITES:
        print(f"  {site['code']:40s} {len(site['pressio']):3d} mesures pressio  "
              f"{len(site['lab']):2d} couches lab")
    print("=" * 60)

    if args.dry_run:
        print("\n[DRY-RUN] Aucune modification en base.")
        total_pressio = sum(len(s["pressio"]) for s in ALL_SITES)
        total_lab = sum(len(s["lab"]) for s in ALL_SITES)
        print(f"  Total mesures pressiomètre : {total_pressio}")
        print(f"  Total couches laboratoire  : {total_lab}")
        return

    conn = psycopg2.connect(args.database_url)
    conn.autocommit = False
    cur = conn.cursor()

    # Comptes avant
    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch = %s", (BATCH,))
    cnt_before = cur.fetchone()[0]

    # Vérifier que la table essais_pressiometre existe
    cur.execute("""
        SELECT EXISTS (
            SELECT 1 FROM information_schema.tables
            WHERE table_schema = 'atlas'
            AND table_name = 'essais_pressiometre'
        )
    """)
    table_exists = cur.fetchone()[0]
    if not table_exists:
        print("\n[ERREUR] La table atlas.essais_pressiometre n'existe pas.")
        print("  Créez-la d'abord avec le DDL approprié.")
        print("  Exemple DDL minimal :")
        print("""
    CREATE TABLE IF NOT EXISTS atlas.essais_pressiometre (
        id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        echantillon_id  UUID NOT NULL REFERENCES atlas.echantillons(id),
        z_reel_m        NUMERIC(6,2) NOT NULL,
        h_canon         VARCHAR(5),
        pf_mpa          NUMERIC(6,3),
        pl_mpa          NUMERIC(6,3),
        em_mpa          NUMERIC(7,3),
        e_pl_ratio      NUMERIC(7,3),
        source_reference VARCHAR(120),
        created_at      TIMESTAMPTZ DEFAULT NOW()
    );
    CREATE INDEX ON atlas.essais_pressiometre (echantillon_id);
        """)
        conn.rollback()
        cur.close()
        conn.close()
        sys.exit(1)

    print(f"\nSondages existants batch={BATCH} : {cnt_before}")

    global_stats = dict(sondages=0, echantillons=0, pressiometre=0,
                        atterberg=0, granulo=0, proctor=0, maille=0)

    for site in ALL_SITES:
        s = import_site(cur, site, BATCH)
        for k in global_stats:
            global_stats[k] += s.get(k, 0)

    # Commit
    conn.commit()
    print("\n" + "=" * 55)
    print("Commit OK")

    # Comptes après
    cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE created_by_batch = %s", (BATCH,))
    cnt_after = cur.fetchone()[0]
    print(f"Sondages batch={BATCH} après import : {cnt_after} (+{cnt_after - cnt_before})")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.essais_pressiometre ep
        JOIN atlas.echantillons e ON e.id = ep.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE s.created_by_batch = %s
    """, (BATCH,))
    print(f"Pressiomètre total batch : {cur.fetchone()[0]}")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.essais_atterberg ea
        JOIN atlas.echantillons e ON e.id = ea.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE s.created_by_batch = %s
    """, (BATCH,))
    print(f"Atterberg total batch    : {cur.fetchone()[0]}")

    cur.execute("""
        SELECT COUNT(*) FROM atlas.granulo_points gp
        JOIN atlas.echantillons e ON e.id = gp.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        WHERE s.created_by_batch = %s
    """, (BATCH,))
    print(f"Granulo total batch      : {cur.fetchone()[0]}")

    print("\n=== STATS INSÉRÉES CETTE SESSION ===")
    print(global_stats)

    cur.close()
    conn.close()
    print("\nDONE")


if __name__ == "__main__":
    main()
