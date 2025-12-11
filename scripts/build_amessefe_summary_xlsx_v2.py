"""
build_amessefe_summary_xlsx_v2.py

But :
- Lire les fichiers Excel AMESSEFE (bleu, limite, Granulométrie, classification, gonflement)
- Construire un résumé par localité côté Excel
- Construire un résumé par localité côté base Postgres (atlas_clean, schéma atlas)
- Fusionner les deux pour produire un fichier Excel de comparaison :
    1 ligne = 1 localité
    colonnes excel_has_*, excel_n_*, db_has_*, db_n_*, mismatch_*

Usage :
    python scripts/build_amessefe_summary_xlsx_v2.py

Connexion DB :
    - Via variable ATLAS_DB_DSN (ex: postgres://atlas:atlas@localhost:5432/atlas_clean)
    - Ou via Docker : docker exec -i atlas-db psql -U atlas atlas_clean
    - Ou variables PG* standards (PGHOST, PGPORT, PGUSER, PGPASSWORD, PGDATABASE)
"""

from pathlib import Path
import os
import sys
import subprocess
import pandas as pd

# Import du module de normalisation centralisé
sys.path.insert(0, str(Path(__file__).resolve().parent))
from utils.normalize import normalize_localite, find_best_display_name

try:
    import psycopg2
    HAS_PSYCOPG2 = True
except ImportError:
    HAS_PSYCOPG2 = False


# ---------------------------------------------------------------------------
# CONFIG
# ---------------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "xlsx"

# Source AMESSEFE dans la base
AMESSEFE_SOURCE = "AMESSEFE Komi Yoan Freddy"

# Schéma PostgreSQL
DB_SCHEMA = "atlas"

EXCEL_CONFIG = {
    "vbs": {
        "file": "bleu.xlsx",
        "sheet": None,
        "loc_col": "Localités",
    },
    "limites": {
        "file": "limite.xlsx",
        "sheet": None,
        "loc_col": "Localités",
    },
    "granulo": {
        "file": "Granulométrie.xlsx",
        "sheet": None,
        "loc_col": "Localités",
    },
    "classif": {
        "file": "classification.xlsx",
        "sheet": None,
        "loc_col": "Localités",
    },
    "gonflement": {
        "file": "potentielle_de_gonflement.xlsx",
        "sheet": None,
        "loc_col": "Localités",
    },
}

TEST_KEYS = list(EXCEL_CONFIG.keys())

OUTPUT_FILE = DATA_DIR / "audit_amessefe_essais_comparatif.xlsx"


# ---------------------------------------------------------------------------
# UTILITAIRES
# ---------------------------------------------------------------------------

def get_db_connection():
    """Ouvre une connexion Postgres.

    Priorité :
    1. ATLAS_DB_DSN (ex: postgres://atlas:atlas@localhost:5432/atlas_clean)
    2. Variables PG* standards
    3. Valeurs par défaut pour Docker local
    """
    if not HAS_PSYCOPG2:
        raise RuntimeError("psycopg2 non installé. Installe avec : pip install psycopg2-binary")

    dsn_env = os.getenv("ATLAS_DB_DSN")
    if dsn_env:
        return psycopg2.connect(dsn_env)

    # Valeurs par défaut pour setup Docker atlas-db
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


def query_db_via_docker(sql: str) -> list:
    """Exécute une requête SQL via docker exec si psycopg2 n'est pas dispo."""
    cmd = [
        "docker", "exec", "-i", "atlas-db",
        "psql", "-U", "atlas", "atlas_clean",
        "-t", "-A", "-F", "\t",
        "-c", sql
    ]
    try:
        result = subprocess.run(cmd, capture_output=True, text=True, check=True)
        lines = result.stdout.strip().split("\n")
        rows = []
        for line in lines:
            if line.strip():
                rows.append(line.split("\t"))
        return rows
    except subprocess.CalledProcessError as e:
        print(f"❌ Erreur Docker : {e.stderr}")
        raise


# ---------------------------------------------------------------------------
# 1. RÉSUMÉ EXCEL PAR LOCALITÉ
# ---------------------------------------------------------------------------

def build_excel_summary() -> dict:
    print("\n" + "=" * 60)
    print("📊 LECTURE DES FICHIERS EXCEL AMESSEFE")
    print("=" * 60)
    print(f"📂 Dossier : {DATA_DIR}")

    records = {}

    for test_key, cfg in EXCEL_CONFIG.items():
        path = DATA_DIR / cfg["file"]
        loc_col = cfg["loc_col"]
        sheet = cfg["sheet"]

        if not path.exists():
            print(f"\n⚠️  {test_key}: Fichier introuvable ({path.name})")
            continue

        print(f"\n📖 {test_key}: {path.name}")

        try:
            # Lire toutes les feuilles si sheet=None
            if sheet is None:
                xl = pd.ExcelFile(path)
                dfs = []
                for sn in xl.sheet_names:
                    try:
                        sheet_df = pd.read_excel(xl, sheet_name=sn)
                        if isinstance(sheet_df, pd.DataFrame) and len(sheet_df) > 0:
                            dfs.append(sheet_df)
                    except Exception:
                        pass
                if not dfs:
                    print(f"   ⚠️  Aucune feuille lisible")
                    continue
                df = pd.concat(dfs, ignore_index=True)
                print(f"   → {len(xl.sheet_names)} feuilles combinées")
            else:
                df = pd.read_excel(path, sheet_name=sheet)
        except Exception as e:
            print(f"   ❌ Erreur lecture : {e}")
            continue

        # Cherche la colonne localité (insensible à la casse)
        actual_col = None
        for col in df.columns:
            col_str = str(col).strip().lower()
            if col_str == loc_col.lower() or "localit" in col_str:
                actual_col = col
                break

        if actual_col is None:
            print(f"   ⚠️  Colonne '{loc_col}' introuvable")
            print(f"      Colonnes disponibles : {list(df.columns)[:5]}...")
            continue

        df = df[[actual_col]].copy()
        df = df.dropna(subset=[actual_col])
        df["localite_raw"] = df[actual_col].astype(str).str.strip()
        df["localite_norm"] = df["localite_raw"].map(normalize_localite)

        grouped = (
            df.groupby("localite_norm", dropna=True)["localite_raw"]
            .agg(["first", "size"])
            .reset_index()
        )

        print(f"   ✓ {len(grouped)} localités, {len(df)} lignes")

        for _, row in grouped.iterrows():
            norm = row["localite_norm"]
            if not norm:
                continue
            raw = row["first"]
            count = int(row["size"])

            rec = records.setdefault(norm, {"localite_excel": raw})
            if len(raw) > len(rec["localite_excel"]):
                rec["localite_excel"] = raw

            rec[f"excel_has_{test_key}"] = True
            rec[f"excel_n_{test_key}"] = count

    # Compléter les champs manquants
    for rec in records.values():
        for t in TEST_KEYS:
            rec.setdefault(f"excel_has_{t}", False)
            rec.setdefault(f"excel_n_{t}", 0)

    print(f"\n✅ Total Excel : {len(records)} localités uniques")
    return records


# ---------------------------------------------------------------------------
# 2. RÉSUMÉ DB PAR LOCALITÉ
# ---------------------------------------------------------------------------

def build_db_summary() -> dict:
    print("\n" + "=" * 60)
    print("🗄️  LECTURE DE LA BASE POSTGRESQL (atlas_clean)")
    print("=" * 60)

    sql = f"""
        SELECT
            s.id AS sondage_id,
            COALESCE(
                s.localite,
                s.localite_base,
                s.meta->>'localite',
                s.code
            ) AS localite_raw,
            COUNT(DISTINCT v.id)  AS n_vbs,
            COUNT(DISTINCT CASE WHEN eg.wl IS NOT NULL OR eg.wp IS NOT NULL THEN eg.id END) AS n_limites,
            COUNT(DISTINCT gp.id) AS n_granulo,
            COUNT(DISTINCT ec.id) AS n_classif,
            COUNT(DISTINCT pg.id) AS n_gonflement
        FROM {DB_SCHEMA}.sondages s
        LEFT JOIN {DB_SCHEMA}.echantillons e
            ON e.sondage_id = s.id
        LEFT JOIN {DB_SCHEMA}.essais_vbs v
            ON v.echantillon_id = e.id
        LEFT JOIN {DB_SCHEMA}.essais_geotechniques eg
            ON eg.echantillon_id = e.id
        LEFT JOIN {DB_SCHEMA}.granulo_points gp
            ON gp.echantillon_id = e.id
        LEFT JOIN {DB_SCHEMA}.essais_classif ec
            ON ec.echantillon_id = e.id
        LEFT JOIN {DB_SCHEMA}.essais_potentiel_gonflement pg
            ON pg.echantillon_id = e.id
        WHERE s.source = '{AMESSEFE_SOURCE}'
          AND s.deleted_at IS NULL
        GROUP BY s.id, localite_raw
    """

    rows = []
    use_docker = False

    # Essayer psycopg2 d'abord
    if HAS_PSYCOPG2:
        try:
            conn = get_db_connection()
            print("   ✓ Connexion psycopg2 établie")
            with conn.cursor() as cur:
                cur.execute(sql)
                rows = cur.fetchall()
            conn.close()
        except Exception as e:
            print(f"   ⚠️  Erreur psycopg2 : {e}")
            use_docker = True
    else:
        use_docker = True

    # Fallback Docker
    if use_docker:
        print("   → Fallback via Docker...")
        try:
            raw_rows = query_db_via_docker(sql)
            # Convertir les strings en types appropriés
            for raw in raw_rows:
                if len(raw) >= 7:
                    rows.append((
                        raw[0],  # sondage_id
                        raw[1],  # localite_raw
                        int(raw[2]) if raw[2] else 0,  # n_vbs
                        int(raw[3]) if raw[3] else 0,  # n_limites
                        int(raw[4]) if raw[4] else 0,  # n_granulo
                        int(raw[5]) if raw[5] else 0,  # n_classif
                        int(raw[6]) if raw[6] else 0,  # n_gonflement
                    ))
            print("   ✓ Requête Docker OK")
        except Exception as e:
            print(f"   ❌ Erreur Docker : {e}")
            print("\n💡 Solutions :")
            print("   1. Installer psycopg2 : pip install psycopg2-binary")
            print("   2. Vérifier que le container atlas-db est démarré")
            return {}

    print(f"   → {len(rows)} sondages AMESSEFE trouvés")

    # Charger dans DataFrame pour regrouper par localité_norm
    cols = [
        "sondage_id", "localite_raw",
        "db_n_vbs", "db_n_limites", "db_n_granulo", "db_n_classif", "db_n_gonflement"
    ]
    df = pd.DataFrame(rows, columns=cols)
    df["localite_norm"] = df["localite_raw"].map(normalize_localite)

    grouped = (
        df.groupby("localite_norm", dropna=True)
        .agg(
            localite_db=("localite_raw", "first"),
            db_n_vbs=("db_n_vbs", "sum"),
            db_n_limites=("db_n_limites", "sum"),
            db_n_granulo=("db_n_granulo", "sum"),
            db_n_classif=("db_n_classif", "sum"),
            db_n_gonflement=("db_n_gonflement", "sum"),
        )
        .reset_index()
    )

    records = {}
    for _, row in grouped.iterrows():
        norm = row["localite_norm"]
        if not norm:
            continue
        rec = {"localite_db": row["localite_db"]}
        for t in TEST_KEYS:
            n = int(row[f"db_n_{t}"])
            rec[f"db_n_{t}"] = n
            rec[f"db_has_{t}"] = n > 0
        records[norm] = rec

    print(f"✅ Total DB : {len(records)} localités uniques")
    return records


# ---------------------------------------------------------------------------
# 3. FUSION EXCEL + DB ET EXPORT
# ---------------------------------------------------------------------------

def determine_action(row: dict, test_keys: list) -> str:
    """
    Détermine l'action suggérée pour une localité basée sur la comparaison Excel/DB.
    
    Actions possibles:
    - OK : Pas de mismatch, tout est synchronisé
    - CREER_SONDAGE : Localité existe dans Excel mais pas en DB
    - IMPORTER_ESSAIS : Sondage existe en DB mais il manque des essais
    - VERIFIER_ORPHELIN : Localité existe en DB mais pas dans Excel (anomalie?)
    - VERIFIER_SURPLUS : DB a plus d'essais que Excel (import en double?)
    """
    in_excel = row.get("present_in_excel", False)
    in_db = row.get("present_in_db", False)
    any_mismatch = row.get("any_mismatch", False)
    
    # Cas 1: Seulement dans Excel → créer le sondage
    if in_excel and not in_db:
        return "CREER_SONDAGE"
    
    # Cas 2: Seulement dans DB → vérifier si c'est normal
    if not in_excel and in_db:
        return "VERIFIER_ORPHELIN"
    
    # Cas 3: Dans les deux, pas de mismatch → OK
    if in_excel and in_db and not any_mismatch:
        return "OK"
    
    # Cas 4: Dans les deux avec mismatch → analyser le sens du mismatch
    if in_excel and in_db and any_mismatch:
        # Compter les essais manquants vs surplus
        missing_count = 0
        surplus_count = 0
        
        for t in test_keys:
            excel_n = row.get(f"excel_n_{t}", 0)
            db_n = row.get(f"db_n_{t}", 0)
            
            if excel_n > db_n:
                missing_count += (excel_n - db_n)
            elif db_n > excel_n:
                surplus_count += (db_n - excel_n)
        
        if missing_count > 0 and surplus_count == 0:
            return "IMPORTER_ESSAIS"
        elif surplus_count > 0 and missing_count == 0:
            return "VERIFIER_SURPLUS"
        elif missing_count > 0 and surplus_count > 0:
            return "VERIFIER_MIXTE"
    
    return "A_ANALYSER"


def build_comparative_excel():
    print("\n" + "=" * 60)
    print("🔄 AUDIT COMPARATIF EXCEL ↔ BASE DE DONNÉES")
    print("=" * 60)

    excel_map = build_excel_summary()
    db_map = build_db_summary()

    if not excel_map and not db_map:
        print("\n❌ Aucune donnée à comparer.")
        return

    all_norms = sorted(set(excel_map.keys()) | set(db_map.keys()))

    rows = []
    for norm in all_norms:
        excel_rec = excel_map.get(norm)
        db_rec = db_map.get(norm)

        row = {}
        # Nom affiché : priorité Excel, sinon DB
        display_name = None
        if excel_rec:
            display_name = excel_rec.get("localite_excel")
        if not display_name and db_rec:
            display_name = db_rec.get("localite_db")
        row["Localité"] = display_name or "(inconnu)"
        row["localite_norm"] = norm

        row["present_in_excel"] = excel_rec is not None
        row["present_in_db"] = db_rec is not None

        any_mismatch = False

        for t in TEST_KEYS:
            # Excel
            excel_n = excel_rec.get(f"excel_n_{t}", 0) if excel_rec else 0
            row[f"excel_has_{t}"] = excel_n > 0
            row[f"excel_n_{t}"] = int(excel_n)

            # DB
            db_n = db_rec.get(f"db_n_{t}", 0) if db_rec else 0
            row[f"db_has_{t}"] = db_n > 0
            row[f"db_n_{t}"] = int(db_n)

            # Mismatch
            mismatch = excel_n != db_n
            row[f"mismatch_{t}"] = mismatch
            if mismatch:
                any_mismatch = True

        row["any_mismatch"] = any_mismatch
        
        # Déterminer l'action suggérée
        row["action_suggeree"] = determine_action(row, TEST_KEYS)
        
        rows.append(row)

    df = pd.DataFrame(rows)

    # Colonnes dans un ordre lisible
    cols = ["Localité", "localite_norm", "present_in_excel", "present_in_db", "action_suggeree", "any_mismatch"]
    for t in TEST_KEYS:
        cols += [
            f"excel_has_{t}", f"excel_n_{t}",
            f"db_has_{t}", f"db_n_{t}",
            f"mismatch_{t}",
        ]
    df = df[cols]

    # Feuille résumé
    print("\n" + "-" * 60)
    print("📊 RÉSUMÉ PAR TYPE D'ESSAI")
    print("-" * 60)

    resume_rows = []
    for t in TEST_KEYS:
        r = {"essai": t}
        r["excel_localites"] = int((df[f"excel_has_{t}"] == True).sum())
        r["db_localites"] = int((df[f"db_has_{t}"] == True).sum())
        r["excel_total"] = int(df[f"excel_n_{t}"].sum())
        r["db_total"] = int(df[f"db_n_{t}"].sum())
        r["mismatch_count"] = int((df[f"mismatch_{t}"] == True).sum())
        r["match_pct"] = round(100 * (1 - r["mismatch_count"] / max(len(df), 1)), 1)
        resume_rows.append(r)

        status = "✅" if r["mismatch_count"] == 0 else "⚠️"
        print(f"   {status} {t:12} | Excel: {r['excel_total']:4} ({r['excel_localites']:3} loc) | "
              f"DB: {r['db_total']:4} ({r['db_localites']:3} loc) | Mismatch: {r['mismatch_count']}")

    df_resume = pd.DataFrame(resume_rows)

    # Stats globales
    total_localites = len(df)
    only_excel = int((df["present_in_excel"] & ~df["present_in_db"]).sum())
    only_db = int((~df["present_in_excel"] & df["present_in_db"]).sum())
    both = int((df["present_in_excel"] & df["present_in_db"]).sum())
    with_mismatch = int(df["any_mismatch"].sum())

    print("\n" + "-" * 60)
    print("📈 STATISTIQUES GLOBALES")
    print("-" * 60)
    print(f"   Total localités uniques : {total_localites}")
    print(f"   Dans Excel ET DB        : {both}")
    print(f"   Seulement Excel         : {only_excel}")
    print(f"   Seulement DB            : {only_db}")
    print(f"   Avec au moins 1 mismatch: {with_mismatch}")

    # Stats par action suggérée
    print("\n" + "-" * 60)
    print("🎯 ACTIONS SUGGÉRÉES")
    print("-" * 60)
    action_counts = df["action_suggeree"].value_counts()
    for action, count in action_counts.items():
        icon = {
            "OK": "✅",
            "CREER_SONDAGE": "🆕",
            "IMPORTER_ESSAIS": "📥",
            "VERIFIER_ORPHELIN": "❓",
            "VERIFIER_SURPLUS": "⚠️",
            "VERIFIER_MIXTE": "🔀",
            "A_ANALYSER": "🔍",
        }.get(action, "•")
        print(f"   {icon} {action:20} : {count:3} localités")

    # Créer feuille actions
    df_actions = df[["Localité", "localite_norm", "action_suggeree", "present_in_excel", "present_in_db"]].copy()
    for t in TEST_KEYS:
        df_actions[f"excel_n_{t}"] = df[f"excel_n_{t}"]
        df_actions[f"db_n_{t}"] = df[f"db_n_{t}"]
    df_actions = df_actions[df_actions["action_suggeree"] != "OK"].sort_values("action_suggeree")

    # Export Excel (3 feuilles)
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    with pd.ExcelWriter(OUTPUT_FILE, engine="openpyxl") as writer:
        df.to_excel(writer, sheet_name="par_localite", index=False)
        df_resume.to_excel(writer, sheet_name="resume", index=False)
        df_actions.to_excel(writer, sheet_name="actions", index=False)

    print("\n" + "=" * 60)
    print("✅ FICHIER GÉNÉRÉ")
    print("=" * 60)
    print(f"   {OUTPUT_FILE}")
    print("\n   Feuilles :")
    print("   - 'par_localite' : 1 ligne = 1 localité (détail complet)")
    print("   - 'resume'       : stats globales par type d'essai")
    print("   - 'actions'      : localités nécessitant une action (filtrées)")


# ---------------------------------------------------------------------------

if __name__ == "__main__":
    build_comparative_excel()
