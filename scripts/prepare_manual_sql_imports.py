import pandas as pd
from pathlib import Path
import uuid
import csv
from datetime import date

IMPORT_DATE = date.today().strftime("%Y%m%d")

def load_mapping():
    mapping = {}
    fpath = "c:/PROJET_ATLAS_MASTER/atlas_reclone/data/referentiels/localite_sondage_mapping.csv"
    with open(fpath, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            if row['sondage_id'] and row['confiance'] in ('high', 'low'):
                mapping[row['localite_xlsx']] = row['sondage_id']
    # Normalisation : ajouter des aliases avec/sans espaces autour des parenthèses
    extras = {}
    for k, v in mapping.items():
        k2 = k.replace('( ', '(').replace(' )', ')')
        if k2 != k:
            extras[k2] = v
    mapping.update(extras)
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
    print(f"Référentiel chargé : {len(mapping)} localités connues")
    
    sql_lines = [
        "BEGIN;",
        f"-- IMPORT v3 — {IMPORT_DATE} — Colonnes réelles + formes transposées",
        "",
    ]
    data_dir = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/data/xlsx")
    ech_map = {}
    stats = {"vbs": 0, "atterberg": 0, "gonflement": 0, "classif": 0, "granulo": 0, "skipped": 0}

    # ──────────────────────────────────────────────────────────────
    # 1. BLEU.XLSX → essais_vbs [col 'Localités', 1, 1.5, 2 = VBS]
    # ──────────────────────────────────────────────────────────────
    fname = "bleu.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- VBS ({fname})")
        df = pd.read_excel(fpath, skiprows=0)
        # bleu.xlsx : colonnes = Unnamed:0, N, Localités, 1, 1.5, 2, ...
        loc_col = next((c for c in df.columns if 'local' in str(c).lower()), None)
        if not loc_col:
            # Fallback : col index 2
            loc_col = df.columns[2]
        for idx, row in df.iterrows():
            loc = str(row[loc_col]).strip()
            sid = mapping.get(loc)
            if not sid:
                stats['skipped'] += 1
                continue
            for prof in [1, 1.5, 2]:
                if prof in df.columns:
                    vbs = row[prof]
                    if pd.notna(vbs):
                        v = float(vbs)
                        if 0 < v <= 20:
                            eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                            ref = f"{fname}:L{idx+2}:{IMPORT_DATE}"
                            sql_lines.append(f"INSERT INTO atlas.essais_vbs (echantillon_id, vbs, source_reference) VALUES ('{eid}', {v}, '{ref}') ON CONFLICT DO NOTHING;")
                            stats['vbs'] += 1

    # ――――――――――――――――――――――――――――――――――――――――――――――――――――――――
    # 2. LIMITE.XLSX → essais_atterberg
    #    Header réel col0=N°, col1=Localité, col2=Profondeur,
    #    col3='Limite de liquidité (WL)', col4='Limite de plasticité (WP)', col5='Indice de plasticité (IP)'
    # ――――――――――――――――――――――――――――――――――――――――――――――――――――――――
    fname = "limite.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- ATTERBERG ({fname})")
        df = pd.read_excel(fpath, header=0)  # ligne 0 = header
        # Col: N°, Localité, Profondeur, Limite de liquidité (WL), Limite de plasticité (WP), Indice de plasticité (IP)
        loc_col = next((c for c in df.columns if 'local' in str(c).lower()), None)
        prof_col = next((c for c in df.columns if 'profondeur' in str(c).lower()), None)
        wl_col = next((c for c in df.columns if 'liquidit' in str(c).lower() or str(c).upper() == 'WL'), None)
        wp_col = next((c for c in df.columns if 'plasticit' in str(c).lower() or str(c).upper() == 'WP'), None)
        print(f"  limite.xlsx loc={loc_col}, prof={prof_col}, wl={wl_col}, wp={wp_col}")
        if loc_col and wl_col and wp_col:
            for idx, row in df.iterrows():
                loc = str(row[loc_col]).strip()
                sid = mapping.get(loc)
                if not sid:
                    stats['skipped'] += 1
                    continue
                prof_str = str(row[prof_col]).replace(',', '.').replace('m', '').strip() if prof_col else '1'
                try:
                    prof = float(prof_str)
                except:
                    prof = 1.0
                wl = row[wl_col]; wp = row[wp_col]
                if pd.notna(wl) and pd.notna(wp):
                    try:
                        wl_f = float(str(wl).replace(',','.'))
                        wp_f = float(str(wp).replace(',','.'))
                        if 20 <= wl_f <= 120 and 10 <= wp_f <= 60 and wl_f > wp_f:
                            ip_f = round(wl_f - wp_f, 2)
                            eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                            ref = f"{fname}:L{idx+2}:{IMPORT_DATE}"
                            sql_lines.append(f"INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip_generated, source_reference) VALUES ('{eid}', {wl_f}, {wp_f}, {ip_f}, '{ref}') ON CONFLICT DO NOTHING;")
                            stats['atterberg'] += 1
                    except: pass

    # ──────────────────────────────────────────────────────────────
    # 3. POTENTIELLE_DE_GONFLEMENT.XLSX → essais_potentiel_gonflement [col cg]
    #    Format: col0=Localité, col1=Profondeur, col 'Potentiel...'
    # ──────────────────────────────────────────────────────────────
    fname = "potentielle_de_gonflement.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- GONFLEMENT ({fname})")
        df = pd.read_excel(fpath, skiprows=0, header=0)
        loc_col = df.columns[0]
        for idx, row in df.iterrows():
            loc = str(row[loc_col]).strip()
            sid = mapping.get(loc)
            if not sid:
                stats['skipped'] += 1
                continue
            prof_str = str(row[df.columns[1]]).replace(',', '.').replace('m', '').strip()
            try:
                prof = float(prof_str)
            except:
                prof = 1.0
            # Chercher colonne cg (potentiel numérique)
            for col in df.columns[2:]:
                col_key = str(col).lower()
                if 'gonflement' in col_key and 'analyse' not in col_key and 'type' not in col_key:
                    val = row[col]
                    if pd.notna(val) and str(val).strip():
                        try:
                            v = float(str(val).replace(',', '.'))
                            if 0 <= v <= 30:
                                eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                                ref = f"{fname}:L{idx+2}:{IMPORT_DATE}"
                                sql_lines.append(f"INSERT INTO atlas.essais_potentiel_gonflement (echantillon_id, cg, source_reference) VALUES ('{eid}', {v}, '{ref}') ON CONFLICT DO NOTHING;")
                                stats['gonflement'] += 1
                        except: pass

    # ――――――――――――――――――――――――――――――――――――――――――――――――――――――――
    # 4. CLASSIFICATION.XLSX → essais_classif [col hrb/unified]
    #    Header réel: Localité, Profondeur, Classifications..., Type de sol
    # ――――――――――――――――――――――――――――――――――――――――――――――――――――――――
    fname = "classification.xlsx"
    fpath = data_dir / fname
    if fpath.exists():
        sql_lines.append(f"\n-- CLASSIF ({fname})")
        df = pd.read_excel(fpath, header=0)
        loc_col = next((c for c in df.columns if 'local' in str(c).lower()), None)
        prof_col = next((c for c in df.columns if 'profondeur' in str(c).lower()), None)
        type_sol_col = next((c for c in df.columns if 'type' in str(c).lower() and 'sol' in str(c).lower()), None)
        # Classification SEED/CHASSAGNEUX/DAKSHA -> nos champs classif
        chassagneux_col = next((c for c in df.columns if 'chassagneux' in str(c).lower()), None)
        seed_col = next((c for c in df.columns if 'seed' in str(c).lower()), None)
        print(f"  classification.xlsx loc={loc_col}, prof={prof_col}, chassagneux={chassagneux_col}, seed={seed_col}")
        if loc_col:
            for idx, row in df.iterrows():
                loc = str(row[loc_col]).strip()
                sid = mapping.get(loc)
                if not sid:
                    stats['skipped'] += 1
                    continue
                prof_str = str(row[prof_col]).replace(',', '.').replace('m', '').strip() if prof_col else '1'
                try:
                    prof = float(prof_str)
                except:
                    prof = 1.0
                ts_v = str(row[type_sol_col]).strip() if type_sol_col and pd.notna(row[type_sol_col]) else None
                chassagneux_v = str(row[chassagneux_col]).strip() if chassagneux_col and pd.notna(row[chassagneux_col]) else None
                seed_v = str(row[seed_col]).strip() if seed_col and pd.notna(row[seed_col]) else None
                if ts_v or chassagneux_v:
                    eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                    ref = f"{fname}:L{idx+2}:{IMPORT_DATE}"
                    ts_s = f"'{ts_v}'" if ts_v else 'NULL'
                    ch_s = f"'{chassagneux_v}'" if chassagneux_v else 'NULL'
                    se_s = f"'{seed_v}'" if seed_v else 'NULL'
                    sql_lines.append(f"INSERT INTO atlas.essais_classif (echantillon_id, type_sol, class_chassagneux, class_seed, source_reference) VALUES ('{eid}', {ts_s}, {ch_s}, {se_s}, '{ref}') ON CONFLICT DO NOTHING;")
                    stats['classif'] += 1

    # ──────────────────────────────────────────────────────────────
    # 5. GRANULOMÉTRIE.XLSX → essais_physiques ? ou essais_granulo
    #    Format: N, Localités, 1, 1.5, 2 (passant au tamis %)
    # ──────────────────────────────────────────────────────────────
    # On cherche si une table de granulométrie existe en DB
    # Les colonnes clés seraient quelque chose comme d80, d60, d50...

    sql_lines.append("\nCOMMIT;")
    out_file = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/scripts/manual_imports_data.sql")
    out_file.write_text("\n".join(sql_lines), encoding="utf-8")
    
    print(f"\nSQL généré : {len(sql_lines)} lignes")
    print(f"  VBS        : {stats['vbs']} insertions")
    print(f"  Atterberg  : {stats['atterberg']} insertions")
    print(f"  Gonflement : {stats['gonflement']} insertions")
    print(f"  Classif    : {stats['classif']} insertions")
    print(f"  Skipped    : {stats['skipped']} localités sans match")
    return stats

if __name__ == '__main__':
    generate_sql()
