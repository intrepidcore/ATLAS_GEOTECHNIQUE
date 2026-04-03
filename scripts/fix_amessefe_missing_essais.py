"""
fix_amessefe_missing_essais.py

Script de réparation ciblé pour les essais AMESSEFE manquants.

Ce script :
1. Lit le fichier d'audit audit_amessefe_essais_comparatif.xlsx
2. Identifie les localités avec action_suggeree = IMPORTER_ESSAIS
3. Pour chaque localité, retrouve les essais manquants dans les fichiers Excel
4. Importe uniquement les essais manquants (upsert)

Usage :
    python scripts/fix_amessefe_missing_essais.py [--dry-run]

Options :
    --dry-run : Affiche ce qui serait fait sans modifier la base

Prérequis :
    - Avoir exécuté build_amessefe_summary_xlsx_v2.py pour générer l'audit
    - Les fichiers Excel sources doivent être présents dans data/xlsx/
"""

from pathlib import Path
import sys
import argparse
import pandas as pd
import typing as _typing

# Import du module de normalisation centralisé
sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils.normalize import normalize_localite

# Windows console peut utiliser cp1252 et planter sur certains emojis.
try:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
    if hasattr(sys.stderr, "reconfigure"):
        sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False
    print("⚠️  psycopg2 non installé. Installe avec : pip install psycopg2-binary")


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "xlsx"

AMESSEFE_SOURCE = "AMESSEFE Komi Yoan Freddy"
DB_SCHEMA = "atlas"

# Fichier d'audit généré par build_amessefe_summary_xlsx_v2.py
# Essaie d'abord le fichier v2, sinon le fichier original
AUDIT_FILE_V2 = DATA_DIR / "audit_amessefe_v2.xlsx"
AUDIT_FILE_ORIG = DATA_DIR / "audit_amessefe_essais_comparatif.xlsx"
AUDIT_FILE = AUDIT_FILE_V2 if AUDIT_FILE_V2.exists() else AUDIT_FILE_ORIG

# Configuration des fichiers Excel sources
EXCEL_CONFIG = {
    "vbs": {
        "file": "bleu.xlsx",
        "loc_col": "Localités",
        "depth_col": "Profondeur (m)",
        "value_cols": ["VBS"],
    },
    "limites": {
        "file": "limite.xlsx",
        "loc_col": "Localités",
        "depth_col": "Profondeur (m)",
        "value_cols": ["WL", "WP", "IP"],
    },
    "granulo": {
        "file": "Granulométrie.xlsx",
        "loc_col": "Localités",
        "depth_col": "Profondeur (m)",
        "value_cols": [],  # Granulo a une structure différente
    },
    "classif": {
        "file": "classification.xlsx",
        "loc_col": "Localités",
        "depth_col": "Profondeur (m)",
        "value_cols": ["HRB", "USCS"],
    },
    "gonflement": {
        "file": "potentielle_de_gonflement.xlsx",
        "loc_col": "Localités",
        "depth_col": "Profondeur (m)",
        "value_cols": ["Potentiel de gonflement"],
    },
}


# ---------------------------------------------------------------------------
# CONNEXION DB
# ---------------------------------------------------------------------------

def get_db_connection():
    """Ouvre une connexion Postgres."""
    import os
    
    if not HAS_PSYCOPG2:
        raise RuntimeError("psycopg2 non installé")

    dsn_env = os.getenv("ATLAS_DB_DSN")
    if dsn_env:
        return psycopg2.connect(dsn_env)

    dbname = os.getenv("PGDATABASE", "atlas_clean")
    user = os.getenv("PGUSER", "atlas")
    password = os.getenv("PGPASSWORD", "atlas")
    host = os.getenv("PGHOST", "localhost")
    port = os.getenv("PGPORT", "5432")

    return psycopg2.connect(
        dbname=dbname,
        user=user,
        password=password,
        host=host,
        port=port
    )


# ---------------------------------------------------------------------------
# LECTURE DES DONNÉES
# ---------------------------------------------------------------------------

def load_audit_file() -> pd.DataFrame:
    """Charge le fichier d'audit et retourne les localités à réparer."""
    if not AUDIT_FILE.exists():
        raise FileNotFoundError(
            f"Fichier d'audit introuvable : {AUDIT_FILE}\n"
            "Exécute d'abord : python scripts/build_amessefe_summary_xlsx_v2.py"
        )
    
    df = pd.read_excel(AUDIT_FILE, sheet_name="actions")
    
    # Filtrer les actions d'import
    df_import = df[df["action_suggeree"] == "IMPORTER_ESSAIS"].copy()
    
    return df_import


def load_excel_data(test_key: str) -> pd.DataFrame:
    """Charge les données d'un fichier Excel source."""
    cfg = EXCEL_CONFIG[test_key]
    path = DATA_DIR / cfg["file"]
    
    if not path.exists():
        print(f"   ⚠️  Fichier introuvable : {path}")
        return pd.DataFrame()
    
    # Lire toutes les feuilles
    xl = pd.ExcelFile(path)
    dfs = []
    for sheet in xl.sheet_names:
        try:
            sheet_df = pd.read_excel(xl, sheet_name=sheet)
            if isinstance(sheet_df, pd.DataFrame) and len(sheet_df) > 0:
                dfs.append(sheet_df)
        except Exception:
            pass
    
    if not dfs:
        return pd.DataFrame()
    
    df = pd.concat(dfs, ignore_index=True)
    
    # Trouver la colonne localité
    loc_col = None
    for col in df.columns:
        if "localit" in str(col).lower():
            loc_col = col
            break
    
    if loc_col is None:
        print(f"   ⚠️  Colonne localité introuvable dans {path.name}")
        return pd.DataFrame()
    
    df["localite_raw"] = df[loc_col].astype(str).str.strip()
    df["localite_norm"] = df["localite_raw"].map(normalize_localite)
    
    return df


def get_sondage_map(conn) -> dict:
    """Récupère le mapping localite_norm -> sondage_id depuis la DB."""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT 
                id,
                COALESCE(localite, localite_base, meta->>'localite', code) as localite_raw
            FROM {DB_SCHEMA}.sondages
            WHERE source = %s AND deleted_at IS NULL
        """, (AMESSEFE_SOURCE,))
        
        rows = cur.fetchall()
    
    sondage_map = {}
    for sondage_id, localite_raw in rows:
        norm = normalize_localite(localite_raw)
        if norm:
            sondage_map[norm] = str(sondage_id)
    
    return sondage_map


def get_echantillon_map(conn, sondage_id: str) -> dict:
    """Récupère le mapping depth_m -> echantillon_id pour un sondage."""
    with conn.cursor() as cur:
        cur.execute(f"""
            SELECT id, depth_m
            FROM {DB_SCHEMA}.echantillons
            WHERE sondage_id = %s
        """, (sondage_id,))
        
        rows = cur.fetchall()
    
    return {float(depth): str(ech_id) for ech_id, depth in rows if depth is not None}


# ---------------------------------------------------------------------------
# IMPORT DES ESSAIS MANQUANTS
# ---------------------------------------------------------------------------

def import_missing_vbs(conn, localite_norm: str, sondage_id: str, dry_run: bool) -> int:
    """Importe les VBS manquants pour une localité."""
    df = load_excel_data("vbs")
    if df.empty:
        return 0
    
    df_loc = df[df["localite_norm"] == localite_norm]
    if df_loc.empty:
        return 0
    
    ech_map = get_echantillon_map(conn, sondage_id)
    imported = 0
    
    with conn.cursor() as cur:
        for _, row in df_loc.iterrows():
            depth = row.get("Profondeur (m)")
            vbs = row.get("VBS")
            
            if pd.isna(depth) or pd.isna(vbs):
                continue
            
            depth = float(depth)
            ech_id = ech_map.get(depth)
            
            if not ech_id:
                print(f"      ⚠️  Échantillon non trouvé pour depth={depth}m")
                continue
            
            if dry_run:
                print(f"      [DRY-RUN] INSERT VBS: depth={depth}m, vbs={vbs}")
                imported += 1
            else:
                cur.execute(f"""
                    INSERT INTO {DB_SCHEMA}.essais_vbs (echantillon_id, vbs, source_reference, created_at)
                    VALUES (%s, %s, %s, now())
                    ON CONFLICT (echantillon_id) DO UPDATE SET
                        vbs = EXCLUDED.vbs,
                        source_reference = EXCLUDED.source_reference
                    RETURNING id
                """, (ech_id, float(vbs), AMESSEFE_SOURCE))
                if cur.fetchone():
                    imported += 1
    
    return imported


def import_missing_limites(conn, localite_norm: str, sondage_id: str, dry_run: bool) -> int:
    """Importe les limites d'Atterberg manquantes pour une localité."""
    df = load_excel_data("limites")
    if df.empty:
        return 0
    
    df_loc = df[df["localite_norm"] == localite_norm]
    if df_loc.empty:
        return 0
    
    ech_map = get_echantillon_map(conn, sondage_id)
    imported = 0
    
    with conn.cursor() as cur:
        for _, row in df_loc.iterrows():
            depth = row.get("Profondeur (m)")
            wl = row.get("WL")
            wp = row.get("WP")
            ip = row.get("IP")
            
            if pd.isna(depth):
                continue
            
            depth = float(depth)
            ech_id = ech_map.get(depth)
            
            if not ech_id:
                print(f"      ⚠️  Échantillon non trouvé pour depth={depth}m")
                continue
            
            if dry_run:
                print(f"      [DRY-RUN] INSERT/UPDATE limites (Atterberg): depth={depth}m, wl={wl}, wp={wp}, ip={ip}")
                imported += 1
            else:
                cur.execute(f"""
                    INSERT INTO {DB_SCHEMA}.essais_atterberg (echantillon_id, wl, wp, ip_generated, source_reference, created_at)
                    VALUES (%s, %s, %s, %s, %s, now())
                    ON CONFLICT (echantillon_id) DO UPDATE SET 
                        wl = COALESCE(EXCLUDED.wl, {DB_SCHEMA}.essais_atterberg.wl),
                        wp = COALESCE(EXCLUDED.wp, {DB_SCHEMA}.essais_atterberg.wp),
                        ip_generated = COALESCE(EXCLUDED.ip_generated, {DB_SCHEMA}.essais_atterberg.ip_generated),
                        source_reference = EXCLUDED.source_reference
                    RETURNING id
                """, (
                    ech_id,
                    float(wl) if not pd.isna(wl) else None,
                    float(wp) if not pd.isna(wp) else None,
                    float(ip) if not pd.isna(ip) else None,
                    AMESSEFE_SOURCE,
                ))
                if cur.fetchone():
                    imported += 1
    
    return imported


def import_missing_gonflement(conn, localite_norm: str, sondage_id: str, dry_run: bool) -> int:
    """Importe les potentiels de gonflement manquants pour une localité."""
    df = load_excel_data("gonflement")
    if df.empty:
        return 0
    
    df_loc = df[df["localite_norm"] == localite_norm]
    if df_loc.empty:
        return 0
    
    ech_map = get_echantillon_map(conn, sondage_id)
    imported = 0
    
    with conn.cursor() as cur:
        for _, row in df_loc.iterrows():
            depth = row.get("Profondeur (m)")
            potentiel = row.get("Potentiel de gonflement")
            
            if pd.isna(depth) or pd.isna(potentiel):
                continue
            
            depth = float(depth)
            ech_id = ech_map.get(depth)
            
            if not ech_id:
                print(f"      ⚠️  Échantillon non trouvé pour depth={depth}m")
                continue
            
            if dry_run:
                print(f"      [DRY-RUN] INSERT gonflement: depth={depth}m, potentiel={potentiel}")
                imported += 1
            else:
                cur.execute(f"""
                    INSERT INTO {DB_SCHEMA}.essais_potentiel_gonflement
                        (echantillon_id, cg, cg_qual, source_reference, created_at)
                    VALUES (%s, %s, NULL, %s, now())
                    ON CONFLICT (echantillon_id) DO UPDATE SET
                        cg = EXCLUDED.cg,
                        cg_qual = COALESCE(EXCLUDED.cg_qual, {DB_SCHEMA}.essais_potentiel_gonflement.cg_qual),
                        source_reference = EXCLUDED.source_reference
                    RETURNING id
                """, (ech_id, float(potentiel), AMESSEFE_SOURCE))
                if cur.fetchone():
                    imported += 1
    
    return imported


# ---------------------------------------------------------------------------
# MAIN
# ---------------------------------------------------------------------------

def main():
    parser = argparse.ArgumentParser(description="Répare les essais AMESSEFE manquants")
    parser.add_argument("--dry-run", action="store_true", help="Affiche sans modifier la base")
    args = parser.parse_args()
    
    print("=" * 60)
    print("🔧 FIX AMESSEFE MISSING ESSAIS")
    print("=" * 60)
    
    if args.dry_run:
        print("⚠️  MODE DRY-RUN : aucune modification ne sera effectuée\n")
    
    # Charger l'audit
    print("📖 Chargement du fichier d'audit...")
    try:
        df_audit = load_audit_file()
    except FileNotFoundError as e:
        print(f"❌ {e}")
        return 1
    
    if df_audit.empty:
        print("✅ Aucune localité avec action IMPORTER_ESSAIS")
        return 0
    
    print(f"   → {len(df_audit)} localités à traiter\n")
    
    # Connexion DB
    print("🗄️  Connexion à la base de données...")
    try:
        conn = get_db_connection()
        print("   ✓ Connecté\n")
    except Exception as e:
        print(f"❌ Erreur connexion : {e}")
        return 1
    
    # Récupérer le mapping sondages
    sondage_map = get_sondage_map(conn)
    print(f"   → {len(sondage_map)} sondages AMESSEFE en base\n")
    
    # Traiter chaque localité
    total_imported = {"vbs": 0, "limites": 0, "gonflement": 0}
    
    for _, row in df_audit.iterrows():
        localite = row["Localité"]
        localite_norm = row["localite_norm"]
        
        print(f"📍 {localite}")
        
        sondage_id = sondage_map.get(localite_norm)
        if not sondage_id:
            print(f"   ⚠️  Sondage non trouvé en base")
            continue
        
        # Identifier les essais manquants
        excel_n_vbs = row.get("excel_n_vbs", 0)
        db_n_vbs = row.get("db_n_vbs", 0)
        excel_n_limites = row.get("excel_n_limites", 0)
        db_n_limites = row.get("db_n_limites", 0)
        excel_n_gonflement = row.get("excel_n_gonflement", 0)
        db_n_gonflement = row.get("db_n_gonflement", 0)
        
        # Import VBS si manquants
        if excel_n_vbs > db_n_vbs:
            n = import_missing_vbs(conn, localite_norm, sondage_id, args.dry_run)
            total_imported["vbs"] += n
            print(f"   → VBS: {n} importés")
        
        # Import limites si manquants
        if excel_n_limites > db_n_limites:
            n = import_missing_limites(conn, localite_norm, sondage_id, args.dry_run)
            total_imported["limites"] += n
            print(f"   → Limites: {n} importés")
        
        # Import gonflement si manquants
        if excel_n_gonflement > db_n_gonflement:
            n = import_missing_gonflement(conn, localite_norm, sondage_id, args.dry_run)
            total_imported["gonflement"] += n
            print(f"   → Gonflement: {n} importés")
    
    # Commit si pas dry-run
    if not args.dry_run:
        conn.commit()
        print("\n✅ Modifications commitées")
    
    conn.close()
    
    # Résumé
    print("\n" + "=" * 60)
    print("📊 RÉSUMÉ")
    print("=" * 60)
    for test_type, count in total_imported.items():
        print(f"   {test_type:12} : {count} essais importés")
    
    total = sum(total_imported.values())
    print(f"\n   TOTAL : {total} essais")
    
    if args.dry_run:
        print("\n⚠️  Relance sans --dry-run pour appliquer les modifications")
    
    return 0


if __name__ == "__main__":
    sys.exit(main())
