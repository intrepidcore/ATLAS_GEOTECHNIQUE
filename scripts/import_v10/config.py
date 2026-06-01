"""
config.py — Configuration partagée import V10_MASTER
Intrepid Core Engineering Standards
"""
import os
from pathlib import Path

# -- Base paths ----------------------------------------------------------------
PROJECT_ROOT = Path(__file__).resolve().parents[2]
DATA_DIR     = PROJECT_ROOT / "data" / "extend" / "V10_MASTER"
LOGS_DIR     = PROJECT_ROOT / "logs" / "import_v10"
LOGS_DIR.mkdir(parents=True, exist_ok=True)

# -- Database ------------------------------------------------------------------
# CRITICAL : port 5433 (pas 5432 — instance différente)
DATABASE_URL = os.environ.get(
    "ATLAS_DATABASE_URL",
    "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
)

# -- CSV files -----------------------------------------------------------------
CSV_SEP = ";"

V10_FILES = {
    "localisation":  DATA_DIR / "V10_SONDAGES_LOCALISATION.csv",
    "labo":          DATA_DIR / "V10_LABORATOIRE_HORIZONS.csv",
    "insitu":        DATA_DIR / "V10_INSITU_PROFIL_Z.csv",
    "projets":       DATA_DIR / "V10_PROJETS_METADATA.csv",
    # CBR + Proctor par projet
    "cbr_kante":         DATA_DIR / "V10_COMPACITE_CBR_KANTE.csv",
    "cbr_sokode":        DATA_DIR / "V10_COMPACITE_CBR_SOKODE.csv",
    "cbr_bafilo":        DATA_DIR / "V10_COMPACITE_CBR_BAFILO.csv",
    "cbr_amou_oblo":     DATA_DIR / "V10_COMPACITE_CBR_AMOU_OBLO.csv",
    "cbr_dzemekey":      DATA_DIR / "V10_COMPACITE_CBR_DZEMEKEY.csv",
    "cbr_etra":          DATA_DIR / "V10_COMPACITE_CBR_ETRA.csv",
    "cbr_lome2":         DATA_DIR / "V10_COMPACITE_CBR_LOME2_CHAUSSEE.csv",
    "proctor_kante":     DATA_DIR / "V10_PROCTOR_POINTS_KANTE.csv",
    "proctor_sokode":    DATA_DIR / "V10_PROCTOR_POINTS_SOKODE.csv",
    "proctor_bafilo":    DATA_DIR / "V10_PROCTOR_POINTS_BAFILO.csv",
    "proctor_amou_oblo": DATA_DIR / "V10_PROCTOR_POINTS_AMOU_OBLO.csv",
    "proctor_dzemekey":  DATA_DIR / "V10_PROCTOR_POINTS_DZEMEKEY.csv",
    "proctor_etra":      DATA_DIR / "V10_PROCTOR_POINTS_ETRA.csv",
    "proctor_lome2":     DATA_DIR / "V10_PROCTOR_POINTS_LOME2_CHAUSSEE.csv",
}

# -- Depth canonisation rules --------------------------------------------------
# Centroïde = (z_min + z_max) / 2
# H1 : 0 – 1.0 m
# H2 : 1.0 – 1.5 m
# H3 : > 1.5 m  (profondeurs > 2 m acceptées, mappées H3, valeur réelle conservée)

def canon_horizon(z_min: float, z_max: float) -> str:
    """Retourne 'H1', 'H2' ou 'H3' selon le centroïde de l'horizon."""
    centroid = (z_min + z_max) / 2.0
    if centroid <= 1.0:
        return "H1"
    elif centroid <= 1.5:
        return "H2"
    else:
        return "H3"

def canon_from_z(z: float) -> str:
    """Canonise une profondeur unique (profil continu) -> H1/H2/H3."""
    if z <= 1.0:
        return "H1"
    elif z <= 1.5:
        return "H2"
    else:
        return "H3"

# -- Coordinate detection ------------------------------------------------------
# latitude > 100 -> UTM31N northing -> convertir via PostGIS ST_Transform
UTM_THRESHOLD = 100.0

def is_utm31n(lat_raw, lon_raw) -> bool:
    """Retourne True si les coordonnées sont en UTM31N (northing > 100 000)."""
    try:
        return abs(float(lat_raw)) > UTM_THRESHOLD
    except (TypeError, ValueError):
        return False

# -- Batch tag -----------------------------------------------------------------
IMPORT_BATCH = "v10_master_import_2026"
