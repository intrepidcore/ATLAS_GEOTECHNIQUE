"""
amessefe_excel.py - Module centralisé de lecture des fichiers Excel AMESSEFE

Ce module est la SOURCE UNIQUE DE VÉRITÉ pour lire les données Excel AMESSEFE.
Il est utilisé par :
- 04_import_amessefe_v2.py (import principal)
- fix_amessefe_missing_essais.py (réparation ciblée)
- build_amessefe_summary_xlsx_v2.py (audit)

Les fichiers Excel bruts sont dans data/xlsx/amessefe_raw/ (NE JAMAIS MODIFIER).
"""

from pathlib import Path
from typing import Dict, List, Optional, Tuple, Any
from dataclasses import dataclass
import pandas as pd

try:
    from .normalize import normalize_localite
except ImportError:
    # Pour exécution directe du module
    from normalize import normalize_localite

# =============================================================================
# CONFIGURATION
# =============================================================================

# Chemin vers les fichiers Excel bruts
BASE_DIR = Path(__file__).resolve().parent.parent.parent
RAW_DATA_DIR = BASE_DIR / "data" / "xlsx" / "amessefe_raw"

# Profondeurs standard AMESSEFE
STANDARD_DEPTHS = [1.0, 1.5, 2.0]

# Configuration des fichiers
FILES = {
    "vbs": "bleu.xlsx",
    "limites": "limite.xlsx",
    "granulo": "Granulométrie.xlsx",
    "classif": "classification.xlsx",
    "gonflement": "potentielle_de_gonflement.xlsx",
}


# =============================================================================
# STRUCTURES DE DONNÉES
# =============================================================================

@dataclass
class VbsRecord:
    """Un enregistrement VBS."""
    localite: str
    localite_norm: str
    depth_m: float
    vbs: float


@dataclass
class LimitesRecord:
    """Un enregistrement Limites d'Atterberg."""
    localite: str
    localite_norm: str
    depth_m: float
    wl: Optional[float]
    wp: Optional[float]
    ip: Optional[float]
    analyse_wi: Optional[str] = None
    type_sol: Optional[str] = None


@dataclass
class GranuloRecord:
    """Un enregistrement Granulométrie (% passant à 0.08mm)."""
    localite: str
    localite_norm: str
    depth_m: float
    passing_pct: float
    sieve_mm: float = 0.08


@dataclass
class ClassifRecord:
    """Un enregistrement Classification."""
    localite: str
    localite_norm: str
    depth_m: float
    class_chassagneux: Optional[str] = None
    class_daksha: Optional[str] = None
    class_seed: Optional[str] = None
    class_vijay: Optional[str] = None
    type_sol: Optional[str] = None


@dataclass
class GonflementRecord:
    """Un enregistrement Potentiel de gonflement."""
    localite: str
    localite_norm: str
    depth_m: float
    cg: Optional[float]
    cg_qual: Optional[str] = None


# =============================================================================
# FONCTIONS UTILITAIRES
# =============================================================================

def _parse_float(val: Any) -> Optional[float]:
    """Parse une valeur en float, retourne None si invalide.
    
    Gère les formats français avec virgule comme séparateur décimal.
    """
    if val is None or pd.isna(val):
        return None
    try:
        # Si c'est déjà un nombre
        if isinstance(val, (int, float)):
            return float(val)

        # Sinon, convertir en string et gérer la virgule.
        # NOTE: dans limite.xlsx, certains champs peuvent contenir '-' / '–' / '—'
        # pour représenter "non mesuré / non renseigné", pas une valeur numérique.
        s = str(val).strip()
        if s in {"-", "–", "—"}:
            return None

        s = s.replace(",", ".")
        return float(s)
    except (ValueError, TypeError):
        return None


def _parse_depth(val: Any) -> Optional[float]:
    """Parse une profondeur, gère les formats '1m', '1,5m', etc."""
    if val is None or pd.isna(val):
        return None
    
    s = str(val).strip().lower()
    s = s.replace("m", "").replace(",", ".").strip()
    
    try:
        return float(s)
    except ValueError:
        return None


def _find_localite_column(df: pd.DataFrame) -> Optional[str]:
    """Trouve la colonne contenant les localités."""
    for col in df.columns:
        col_lower = str(col).lower()
        if "localit" in col_lower:
            return col
    return None


def _read_all_sheets(filepath: Path) -> pd.DataFrame:
    """Lit toutes les feuilles d'un fichier Excel et les combine."""
    if not filepath.exists():
        raise FileNotFoundError(f"Fichier introuvable: {filepath}")
    
    xl = pd.ExcelFile(filepath)
    dfs = []
    
    for sheet in xl.sheet_names:
        try:
            df = pd.read_excel(xl, sheet_name=sheet)
            if isinstance(df, pd.DataFrame) and len(df) > 0:
                df["_sheet"] = sheet
                dfs.append(df)
        except Exception:
            pass
    
    if not dfs:
        return pd.DataFrame()
    
    return pd.concat(dfs, ignore_index=True)


# =============================================================================
# LOADERS PRINCIPAUX
# =============================================================================

def load_vbs() -> List[VbsRecord]:
    """
    Charge les données VBS depuis bleu.xlsx.
    
    Format Excel : Pivot (colonnes = profondeurs 1, 1.5, 2)
    
    Returns:
        Liste de VbsRecord avec (localite, localite_norm, depth_m, vbs)
    """
    filepath = RAW_DATA_DIR / FILES["vbs"]
    df = _read_all_sheets(filepath)
    
    if df.empty:
        return []
    
    loc_col = _find_localite_column(df)
    if not loc_col:
        raise ValueError(f"Colonne localité introuvable dans {filepath.name}")
    
    # Mapping colonnes profondeur -> depth_m
    depth_cols = {}
    for col in df.columns:
        if col in [1, 1.5, 2]:
            depth_cols[col] = float(col)
        elif col in ["1", "1.5", "2"]:
            depth_cols[col] = float(col)
        elif str(col) in ["1.0", "1.5", "2.0"]:
            depth_cols[col] = float(str(col))
    
    records = []
    for _, row in df.iterrows():
        localite_raw = str(row.get(loc_col, "")).strip()
        if not localite_raw or localite_raw.lower() in ("nan", "none", ""):
            continue
        
        localite_norm = normalize_localite(localite_raw)
        
        for col, depth in depth_cols.items():
            vbs_val = _parse_float(row.get(col))
            if vbs_val is not None:
                records.append(VbsRecord(
                    localite=localite_raw,
                    localite_norm=localite_norm,
                    depth_m=depth,
                    vbs=vbs_val
                ))
    
    return records


def load_limites() -> List[LimitesRecord]:
    """
    Charge les données Limites d'Atterberg depuis limite.xlsx.
    
    Format Excel : Tabulaire (1 ligne = 1 essai)
    
    Returns:
        Liste de LimitesRecord
    """
    filepath = RAW_DATA_DIR / FILES["limites"]
    df = _read_all_sheets(filepath)
    
    if df.empty:
        return []
    
    # Colonnes attendues
    col_localite = None
    col_profondeur = None
    col_wl = None
    col_wp = None
    col_ip = None
    col_analyse = None
    col_type_sol = None
    
    for col in df.columns:
        col_lower = str(col).lower()
        if "localit" in col_lower:
            col_localite = col
        elif "profondeur" in col_lower:
            col_profondeur = col
        elif "liquidit" in col_lower or col_lower == "wl":
            col_wl = col
        elif "plasticit" in col_lower and "indice" not in col_lower:
            col_wp = col
        elif "indice" in col_lower or col_lower == "ip":
            col_ip = col
        elif "analyse" in col_lower:
            col_analyse = col
        elif "type" in col_lower and "sol" in col_lower:
            col_type_sol = col
    
    if not col_localite:
        raise ValueError(f"Colonne localité introuvable dans {filepath.name}")
    
    records = []
    for _, row in df.iterrows():
        localite_raw = str(row.get(col_localite, "")).strip()
        if not localite_raw or localite_raw.lower() in ("nan", "none", ""):
            continue
        
        depth = _parse_depth(row.get(col_profondeur)) if col_profondeur else None
        if depth is None:
            continue
        
        wl = _parse_float(row.get(col_wl)) if col_wl else None
        wp = _parse_float(row.get(col_wp)) if col_wp else None
        ip = _parse_float(row.get(col_ip)) if col_ip else None
        
        # Au moins une valeur doit être présente
        if wl is None and wp is None and ip is None:
            continue
        
        records.append(LimitesRecord(
            localite=localite_raw,
            localite_norm=normalize_localite(localite_raw),
            depth_m=depth,
            wl=wl,
            wp=wp,
            ip=ip,
            analyse_wi=str(row.get(col_analyse, "")).strip() if col_analyse and pd.notna(row.get(col_analyse)) else None,
            type_sol=str(row.get(col_type_sol, "")).strip() if col_type_sol and pd.notna(row.get(col_type_sol)) else None
        ))
    
    return records


def load_granulo() -> List[GranuloRecord]:
    """
    Charge les données Granulométrie depuis Granulométrie.xlsx.
    
    Format Excel : Pivot (colonnes = profondeurs)
    Note : Ce fichier contient uniquement le % passant à 0.08mm
    
    Returns:
        Liste de GranuloRecord
    """
    filepath = RAW_DATA_DIR / FILES["granulo"]
    df = _read_all_sheets(filepath)
    
    if df.empty:
        return []
    
    loc_col = _find_localite_column(df)
    if not loc_col:
        raise ValueError(f"Colonne localité introuvable dans {filepath.name}")
    
    # Mapping colonnes profondeur
    depth_cols = {}
    for col in df.columns:
        if col in [1, 1.5, 2]:
            depth_cols[col] = float(col)
        elif col in ["1", "1.5", "2"]:
            depth_cols[col] = float(col)
    
    records = []
    for _, row in df.iterrows():
        localite_raw = str(row.get(loc_col, "")).strip()
        if not localite_raw or localite_raw.lower() in ("nan", "none", ""):
            continue
        
        localite_norm = normalize_localite(localite_raw)
        
        for col, depth in depth_cols.items():
            passing = _parse_float(row.get(col))
            if passing is not None:
                records.append(GranuloRecord(
                    localite=localite_raw,
                    localite_norm=localite_norm,
                    depth_m=depth,
                    passing_pct=passing,
                    sieve_mm=0.08
                ))
    
    return records


def load_classif() -> List[ClassifRecord]:
    """
    Charge les données Classification depuis classification.xlsx.
    
    Format Excel : Tabulaire (1 ligne = 1 essai)
    
    Returns:
        Liste de ClassifRecord
    """
    filepath = RAW_DATA_DIR / FILES["classif"]
    df = _read_all_sheets(filepath)
    
    if df.empty:
        return []
    
    # Colonnes attendues
    col_localite = None
    col_profondeur = None
    col_chassagneux = None
    col_daksha = None
    col_seed = None
    col_vijay = None
    col_type_sol = None
    
    for col in df.columns:
        col_str = str(col).lower()
        if "localit" in col_str:
            col_localite = col
        elif "profondeur" in col_str:
            col_profondeur = col
        elif "chassagneux" in col_str:
            col_chassagneux = col
        elif "dakshanamurthy" in col_str or "raman" in col_str:
            col_daksha = col
        elif "seed" in col_str:
            col_seed = col
        elif "vijayvergiya" in col_str or "ghazzaly" in col_str:
            col_vijay = col
        elif "type" in col_str and "sol" in col_str:
            col_type_sol = col
    
    if not col_localite:
        raise ValueError(f"Colonne localité introuvable dans {filepath.name}")
    
    records = []
    for _, row in df.iterrows():
        localite_raw = str(row.get(col_localite, "")).strip()
        if not localite_raw or localite_raw.lower() in ("nan", "none", ""):
            continue
        
        depth = _parse_depth(row.get(col_profondeur)) if col_profondeur else None
        if depth is None:
            continue
        
        def safe_str(val):
            if val is None or pd.isna(val):
                return None
            s = str(val).strip()
            return s if s and s.lower() not in ("nan", "none") else None
        
        records.append(ClassifRecord(
            localite=localite_raw,
            localite_norm=normalize_localite(localite_raw),
            depth_m=depth,
            class_chassagneux=safe_str(row.get(col_chassagneux)) if col_chassagneux else None,
            class_daksha=safe_str(row.get(col_daksha)) if col_daksha else None,
            class_seed=safe_str(row.get(col_seed)) if col_seed else None,
            class_vijay=safe_str(row.get(col_vijay)) if col_vijay else None,
            type_sol=safe_str(row.get(col_type_sol)) if col_type_sol else None
        ))
    
    return records


def load_gonflement() -> List[GonflementRecord]:
    """
    Charge les données Potentiel de gonflement depuis potentielle_de_gonflement.xlsx.
    
    Format Excel : Pivot (colonnes = profondeurs avec Cg et Analyse)
    
    Returns:
        Liste de GonflementRecord
    """
    filepath = RAW_DATA_DIR / FILES["gonflement"]
    df = _read_all_sheets(filepath)
    
    if df.empty:
        return []
    
    loc_col = _find_localite_column(df)
    if not loc_col:
        raise ValueError(f"Colonne localité introuvable dans {filepath.name}")
    
    # Mapping colonnes Cg et Analyse par profondeur
    cg_cols = {}  # depth -> col_name
    analyse_cols = {}  # depth -> col_name
    
    for col in df.columns:
        col_str = str(col).lower()
        if "potentiel" in col_str or "cg" in col_str:
            if "1m" in col_str and "1,5" not in col_str and "1.5" not in col_str:
                cg_cols[1.0] = col
            elif "1,5" in col_str or "1.5" in col_str:
                cg_cols[1.5] = col
            elif "2m" in col_str or "2 m" in col_str:
                cg_cols[2.0] = col
        elif "analyse" in col_str:
            if "1m" in col_str and "1,5" not in col_str and "1.5" not in col_str:
                analyse_cols[1.0] = col
            elif "1,5" in col_str or "1.5" in col_str:
                analyse_cols[1.5] = col
            elif "2m" in col_str or "2 m" in col_str:
                analyse_cols[2.0] = col
    
    records = []
    for _, row in df.iterrows():
        localite_raw = str(row.get(loc_col, "")).strip()
        if not localite_raw or localite_raw.lower() in ("nan", "none", ""):
            continue
        
        localite_norm = normalize_localite(localite_raw)
        
        for depth in STANDARD_DEPTHS:
            cg_col = cg_cols.get(depth)
            analyse_col = analyse_cols.get(depth)
            
            cg_val = _parse_float(row.get(cg_col)) if cg_col else None
            
            if cg_val is not None:
                cg_qual = None
                if analyse_col and pd.notna(row.get(analyse_col)):
                    cg_qual = str(row.get(analyse_col)).strip()
                    if cg_qual.lower() in ("nan", "none", ""):
                        cg_qual = None
                
                records.append(GonflementRecord(
                    localite=localite_raw,
                    localite_norm=localite_norm,
                    depth_m=depth,
                    cg=cg_val,
                    cg_qual=cg_qual
                ))
    
    return records


# =============================================================================
# FONCTIONS DE RÉSUMÉ (pour l'audit)
# =============================================================================

def get_summary() -> Dict[str, Dict[str, int]]:
    """
    Retourne un résumé des données Excel.
    
    Returns:
        Dict avec pour chaque type d'essai :
        - total_records : nombre total d'enregistrements
        - unique_localites : nombre de localités uniques
    """
    summary = {}
    
    loaders = {
        "vbs": load_vbs,
        "limites": load_limites,
        "granulo": load_granulo,
        "classif": load_classif,
        "gonflement": load_gonflement,
    }
    
    for name, loader in loaders.items():
        try:
            records = loader()
            localites = set(r.localite_norm for r in records)
            summary[name] = {
                "total_records": len(records),
                "unique_localites": len(localites),
            }
        except Exception as e:
            summary[name] = {
                "total_records": 0,
                "unique_localites": 0,
                "error": str(e),
            }
    
    return summary


def get_all_localites() -> set:
    """Retourne l'ensemble des localités normalisées présentes dans tous les fichiers."""
    localites = set()
    
    for loader in [load_vbs, load_limites, load_granulo, load_classif, load_gonflement]:
        try:
            records = loader()
            localites.update(r.localite_norm for r in records)
        except Exception:
            pass
    
    return localites


# =============================================================================
# TESTS
# =============================================================================

if __name__ == "__main__":
    print("=" * 60)
    print("TEST MODULE amessefe_excel.py")
    print("=" * 60)
    print(f"\nDossier source: {RAW_DATA_DIR}")
    print(f"Fichiers attendus: {list(FILES.values())}")
    
    print("\n--- Résumé des données ---")
    summary = get_summary()
    for name, stats in summary.items():
        if "error" in stats:
            print(f"❌ {name}: ERREUR - {stats['error']}")
        else:
            print(f"✅ {name}: {stats['total_records']} records, {stats['unique_localites']} localités")
    
    print(f"\n--- Localités uniques totales ---")
    all_locs = get_all_localites()
    print(f"Total: {len(all_locs)} localités")
    
    print("\n--- Échantillon VBS ---")
    vbs = load_vbs()
    for r in vbs[:5]:
        print(f"  {r.localite_norm} @ {r.depth_m}m : VBS={r.vbs}")
    
    print("\n--- Échantillon Limites ---")
    limites = load_limites()
    for r in limites[:5]:
        print(f"  {r.localite_norm} @ {r.depth_m}m : WL={r.wl}, WP={r.wp}, IP={r.ip}")
