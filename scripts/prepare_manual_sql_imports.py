import pandas as pd
from pathlib import Path
import uuid
import csv

def load_mapping():
    mapping = {}
    fpath = "c:/PROJET_ATLAS_MASTER/atlas_reclone/data/referentiels/localite_sondage_mapping.csv"
    with open(fpath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['sondage_id'] and row['sondage_id'].strip():
                mapping[row['localite_xlsx']] = row['sondage_id']
    return mapping

def get_or_create_echantillon(sid, prof, sql_lines, ech_map):
    key = f"{sid}_{prof}"
    if key not in ech_map:
        eid = str(uuid.uuid4())
        sql_lines.append(f"INSERT INTO atlas.echantillons (id, sondage_id, depth_m) VALUES ('{eid}', '{sid}', {prof}) ON CONFLICT DO NOTHING;")
        ech_map[key] = eid
    return ech_map[key]

def generate_sql():
    mapping = load_mapping()
    
    sql_lines = [
        "BEGIN;",
        "-- ===========================================================",
        "-- IMPORT MANUEL GEOTECHNIQUE STRICT",
        "-- Utilisation explicite du référentiel CSV",
        "-- Inclusion de la traçabilité source_reference",
        "-- ===========================================================",
        ""
    ]
    
    data_dir = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/data/xlsx")
    ech_map = {}
    
    # 1. BLEU.XLSX
    fname = "bleu.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- IMPORT VBS ({fname})")
        df = pd.read_excel(fpath)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        if loc_col:
            for idx, row in df.iterrows():
                loc = row[loc_col[0]]
                sid = mapping.get(str(loc))
                if sid:
                    for prof in [1, 1.5, 2]:
                        if prof in df.columns:
                            vbs = row[prof]
                            if pd.notna(vbs) and 0 <= float(vbs) <= 20:
                                eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                                ref = f"{fname}:ligne_{idx+2}"
                                sql_lines.append(f"INSERT INTO atlas.essais_vbs (echantillon_id, vbs, source_reference) VALUES ('{eid}', {vbs}, '{ref}') ON CONFLICT DO NOTHING;")
    
    # 2. LIMITE.XLSX -> atlas.essais_atterberg
    fname = "limite.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- IMPORT ATTERBERG ({fname})")
        df = pd.read_excel(fpath, skiprows=1)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        wl_col = [c for c in df.columns if 'wl' in str(c).lower()]
        wp_col = [c for c in df.columns if 'wp' in str(c).lower()]
        if loc_col and wl_col and wp_col:
            for idx, row in df.iterrows():
                loc = row[loc_col[0]]
                sid = mapping.get(str(loc))
                if sid:
                    wl, wp = row[wl_col[0]], row[wp_col[0]]
                    if pd.notna(wl) and pd.notna(wp):
                        try:
                            wl_f, wp_f = float(wl), float(wp)
                            if 20 <= wl_f <= 120 and 10 <= wp_f <= 60:
                                p = 1.0
                                eid = get_or_create_echantillon(sid, p, sql_lines, ech_map)
                                ip_f = wl_f - wp_f
                                ref = f"{fname}:ligne_{idx+3}"
                                sql_lines.append(f"INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip, source_reference) VALUES ('{eid}', {wl_f}, {wp_f}, {ip_f}, '{ref}') ON CONFLICT DO NOTHING;")
                        except: pass
    
    # 4. Potentielle_de_gonflement.xlsx
    fname = "potentielle_de_gonflement.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- IMPORT GONFLEMENT ({fname})")
        df = pd.read_excel(fpath)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        if loc_col:
            for idx, row in df.iterrows():
                loc = row[loc_col[0]]
                sid = mapping.get(str(loc))
                if sid:
                    for col in df.columns:
                        if 'gonflement' in str(col).lower() and 'analyse' not in str(col).lower():
                            prof = 1.5 if '1,5' in str(col) else (2.0 if '2m' in str(col) else 1.0)
                            val = row[col]
                            if pd.notna(val) and str(val).strip():
                                try:
                                    v = float(str(val).replace(',', '.'))
                                    eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                                    ref = f"{fname}:ligne_{idx+2}"
                                    sql_lines.append(f"INSERT INTO atlas.essais_potentiel_gonflement (echantillon_id, eg, source_reference) VALUES ('{eid}', {v}, '{ref}') ON CONFLICT DO NOTHING;")
                                except: pass

    # 5. classification.xlsx
    fname = "classification.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- IMPORT CLASSIFICATION ({fname})")
        df = pd.read_excel(fpath, skiprows=1)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        if loc_col:
            for idx, row in df.iterrows():
                loc = row[loc_col[0]]
                sid = mapping.get(str(loc))
                if sid:
                    classif_cols = [c for c in df.columns if 'classe' in str(c).lower() or 'gtr' in str(c).lower() or 'hrb' in str(c).lower()]
                    for c in classif_cols:
                        val = row[c]
                        if pd.notna(val) and str(val).strip():
                            sys = 'GTR' if 'gtr' in str(c).lower() else ('USCS' if 'hrb' in str(c).lower() else 'Autre')
                            val_clean = str(val).replace("'", "''").strip()
                            eid = get_or_create_echantillon(sid, 1.0, sql_lines, ech_map)
                            ref = f"{fname}:ligne_{idx+3}"
                            sql_lines.append(f"INSERT INTO atlas.essais_classif (echantillon_id, systeme, classe, source_reference) VALUES ('{eid}', '{sys}', '{val_clean}', '{ref}') ON CONFLICT DO NOTHING;")

    sql_lines.append("\nCOMMIT;")
    sql_lines.append("-- FIN")
    
    out_file = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/scripts/manual_imports_data.sql")
    out_file.write_text("\n".join(sql_lines), encoding="utf-8")
    print(f"Généré {out_file} avec {len(sql_lines)} lignes, sur {len(mapping)} sondages listés.")

if __name__ == '__main__':
    generate_sql()
