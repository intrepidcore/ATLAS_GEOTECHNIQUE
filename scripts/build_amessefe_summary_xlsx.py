"""
build_amessefe_summary_xlsx.py

Résumé :
- Lit les fichiers Excel sources AMESSEFE (bleu, limites, granulo, etc.)
- Construit un tableau "1 ligne = 1 sondage/localité"
- Ajoute pour chaque type d'essai : has_xxx (booléen) + n_xxx (compte)
- Sauvegarde le tout dans un nouveau fichier Excel.

Usage:
    python scripts/build_amessefe_summary_xlsx.py
"""

from pathlib import Path
import pandas as pd
import unicodedata
import re

# --- CONFIG -------------------------------------------------------------------

BASE_DIR = Path(__file__).resolve().parent.parent
DATA_DIR = BASE_DIR / "data" / "xlsx"

# Définition des fichiers et colonnes de localité pour chaque type d'essai
EXCEL_CONFIG = {
    "vbs": {
        "file": "bleu.xlsx",
        "sheet": None,            # None = 1ère feuille
        "loc_col": "Localités",   # nom exact de la colonne dans Excel
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

OUTPUT_FILE = DATA_DIR / "audit_amessefe_essais_par_sondage.xlsx"


# --- FONCTIONS UTILITAIRES ----------------------------------------------------

def normalize_localite(name: str) -> str:
    """Normalise les noms de localité pour pouvoir les comparer.

    - trim, supprime espaces insécables
    - minuscules
    - supprime tous les accents (via unicodedata)
    - normalise les espaces multiples
    """
    if pd.isna(name):
        return ""

    s = str(name).strip()
    # Supprime espaces insécables et autres caractères spéciaux
    s = s.replace("\u00a0", " ").replace("\u2019", "'")
    s = s.lower()

    # Suppression des accents via unicodedata (plus robuste)
    s = unicodedata.normalize("NFD", s)
    s = "".join(c for c in s if unicodedata.category(c) != "Mn")

    # Normalise les espaces multiples
    s = re.sub(r"\s+", " ", s).strip()

    return s


# --- LOGIQUE PRINCIPALE -------------------------------------------------------

def build_summary():
    print("=" * 60)
    print("📊 BUILD AMESSEFE SUMMARY - Excel Only")
    print("=" * 60)
    print(f"\n📂 Dossier des données Excel : {DATA_DIR}")

    if not DATA_DIR.exists():
        print(f"❌ Dossier introuvable : {DATA_DIR}")
        return

    records = {}  # key = localite_norm, value = dict d'info

    for test_key, cfg in EXCEL_CONFIG.items():
        path = DATA_DIR / cfg["file"]
        loc_col = cfg["loc_col"]
        sheet = cfg["sheet"]

        if not path.exists():
            print(f"\n⚠️  Fichier introuvable pour {test_key} : {path.name}")
            continue

        print(f"\n📖 Lecture {test_key} depuis {path.name}...")

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
            print(f"   ⚠️  Colonne '{loc_col}' introuvable. Colonnes disponibles:")
            for c in df.columns[:5]:
                print(f"      - {c}")
            continue

        # On ne garde que la colonne localité
        df = df[[actual_col]].copy()
        df = df.dropna(subset=[actual_col])

        df["localite_raw"] = df[actual_col].astype(str).str.strip()
        df["localite_norm"] = df["localite_raw"].map(normalize_localite)

        # Agrégation par localité normalisée
        grouped = (
            df.groupby("localite_norm", dropna=True)["localite_raw"]
            .agg(["first", "size"])
            .reset_index()
        )

        print(f"   ✓ {len(grouped)} localités trouvées, {len(df)} lignes total")

        for _, row in grouped.iterrows():
            norm = row["localite_norm"]
            raw = row["first"]
            count = int(row["size"])

            if not norm:
                continue

            rec = records.setdefault(
                norm,
                {"localite_affichee": raw},
            )

            # Garde la version la plus longue comme nom affiché
            if len(raw) > len(rec["localite_affichee"]):
                rec["localite_affichee"] = raw

            rec[f"has_{test_key}"] = True
            rec[f"n_{test_key}"] = count

    # Compléter les champs manquants avec False / 0
    for rec in records.values():
        for test_key in EXCEL_CONFIG.keys():
            rec.setdefault(f"has_{test_key}", False)
            rec.setdefault(f"n_{test_key}", 0)

    # Construire le DataFrame final
    all_records = list(records.values())
    if not all_records:
        print("\n⚠️  Aucune donnée trouvée, rien à exporter.")
        return

    df_out = pd.DataFrame(all_records)

    # Ordonner par ordre alphabétique
    df_out = df_out.sort_values("localite_affichee", key=lambda s: s.str.lower())

    # Ordonner les colonnes
    cols = ["localite_affichee"]
    for test_key in EXCEL_CONFIG.keys():
        cols.append(f"has_{test_key}")
        cols.append(f"n_{test_key}")

    df_out = df_out[cols]
    df_out = df_out.rename(columns={"localite_affichee": "Localité"})

    # Calculer les totaux
    total_localites = len(df_out)
    total_essais = sum(df_out[f"n_{t}"].sum() for t in EXCEL_CONFIG.keys())

    # Sauvegarde Excel
    OUTPUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    df_out.to_excel(OUTPUT_FILE, index=False)

    print("\n" + "=" * 60)
    print("✅ RÉSUMÉ")
    print("=" * 60)
    print(f"   Localités uniques : {total_localites}")
    print(f"   Total essais      : {total_essais}")
    print(f"\n   Fichier généré : {OUTPUT_FILE}")
    print("\n   Colonnes :")
    for c in df_out.columns:
        print(f"      - {c}")


if __name__ == "__main__":
    build_summary()
