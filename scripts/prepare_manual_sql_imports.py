import psycopg2
import pandas as pd
from pathlib import Path
import os
import re

DB_URL = "postgres://atlas:atlas@localhost/atlas_clean"

def sanitize_loc(name):
    if not isinstance(name, str):
        return ""
    # Retirer les parenthèses, espaces, etc pour matching
    name = re.sub(r'\(.*?\)', '', name)
    name = re.sub(r'[^a-zA-Z0-9]', '', name)
    return name.lower()

def match_sondage(loc_name, sondages):
    if not loc_name:
        return None
    loc_clean = sanitize_loc(loc_name)
    # Chercher d'abord par code exact
    for s in sondages:
        if sanitize_loc(s['code']) == loc_clean or sanitize_loc(s['localite']) == loc_clean:
            return s['id']
    # Chercher par adm3 (Commune) si possible 
    # Beaucoup de sondages aléatoires ont la commune en adm3_name
    for s in sondages:
        if loc_clean in sanitize_loc(s['adm3_name']):
            return s['id']
    return None

import uuid

def get_or_create_echantillon(sid, prof, sql_lines, ech_map):
    key = f"{sid}_{prof}"
    if key not in ech_map:
        eid = str(uuid.uuid4())
        # Insertion idempotente approximative (il faudrait une contrainte d'unicité sur sondage_id+depth_m, si elle n'existe pas ça peut dupliquer, mais c'est manuel)
        sql_lines.append(f"INSERT INTO atlas.echantillons (id, sondage_id, depth_m) VALUES ('{eid}', '{sid}', {prof}) ON CONFLICT DO NOTHING;")
        ech_map[key] = eid
    return ech_map[key]

def generate_sql():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()
    
    cursor.execute("SELECT id, code, localite, adm3_name FROM atlas.sondages")
    sondages = [{'id': r[0], 'code': r[1], 'localite': r[2], 'adm3_name': r[3]} for r in cursor.fetchall()]
    conn.close()
    
    sql_lines = [
        "BEGIN;",
        "-- ===========================================================",
        "-- IMPORT MANUEL GEOTECHNIQUE",
        "-- Ce script lie les sondages aux échantillons et aux essais",
        "-- ===========================================================",
        ""
    ]
    
    data_dir = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/data/xlsx")
    ech_map = {} # Cache pour ne pas recréer l'échantillon à chaque essai
    
    # 1. BLEU.XLSX -> atlas.essais_vbs
    fpath = data_dir / "bleu.xlsx"
    if fpath.exists():
        sql_lines.append("-- IMPORT VBS (bleu.xlsx)")
        df = pd.read_excel(fpath)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        if loc_col:
            for idx, row in df.iterrows():
                sid = match_sondage(row[loc_col[0]], sondages)
                if sid:
                    for prof in [1, 1.5, 2]:
                        if prof in df.columns:
                            vbs = row[prof]
                            if pd.notna(vbs) and 0 <= float(vbs) <= 20:
                                eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                                sql_lines.append(f"INSERT INTO atlas.essais_vbs (echantillon_id, vbs) VALUES ('{eid}', {vbs}) ON CONFLICT DO NOTHING;")
    
    # 2. LIMITE.XLSX -> atlas.essais_atterberg
    fpath = data_dir / "limite.xlsx"
    if fpath.exists():
        sql_lines.append("\n-- IMPORT ATTERBERG (limite.xlsx)")
        df = pd.read_excel(fpath, skiprows=1)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        wl_col = [c for c in df.columns if 'wl' in str(c).lower()]
        wp_col = [c for c in df.columns if 'wp' in str(c).lower()]
        if loc_col and wl_col and wp_col:
            for idx, row in df.iterrows():
                sid = match_sondage(row[loc_col[0]], sondages)
                if sid:
                    wl, wp = row[wl_col[0]], row[wp_col[0]]
                    if pd.notna(wl) and pd.notna(wp):
                        try:
                            wl_f, wp_f = float(wl), float(wp)
                            if 20 <= wl_f <= 120 and 10 <= wp_f <= 60:
                                p = 1.0 # default
                                eid = get_or_create_echantillon(sid, p, sql_lines, ech_map)
                                ip_f = wl_f - wp_f
                                sql_lines.append(f"INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip) VALUES ('{eid}', {wl_f}, {wp_f}, {ip_f}) ON CONFLICT DO NOTHING;")
                        except: pass
    
    # 4. Potentielle_de_gonflement.xlsx
    fpath = data_dir / "potentielle_de_gonflement.xlsx"
    if fpath.exists():
        sql_lines.append("\n-- IMPORT GONFLEMENT (potentielle_de_gonflement.xlsx)")
        df = pd.read_excel(fpath)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        if loc_col:
            for idx, row in df.iterrows():
                sid = match_sondage(row[loc_col[0]], sondages)
                if sid:
                    for col in df.columns:
                        if 'gonflement' in str(col).lower() and 'analyse' not in str(col).lower():
                            prof = 1.5 if '1,5' in str(col) else (2.0 if '2m' in str(col) else 1.0)
                            val = row[col]
                            if pd.notna(val) and str(val).strip():
                                try:
                                    v = float(str(val).replace(',', '.'))
                                    eid = get_or_create_echantillon(sid, prof, sql_lines, ech_map)
                                    sql_lines.append(f"INSERT INTO atlas.essais_potentiel_gonflement (echantillon_id, eg) VALUES ('{eid}', {v}) ON CONFLICT DO NOTHING;")
                                except: pass

    # 5. classification.xlsx
    fpath = data_dir / "classification.xlsx"
    if fpath.exists():
        sql_lines.append("\n-- IMPORT CLASSIFICATION (classification.xlsx)")
        df = pd.read_excel(fpath, skiprows=1)
        loc_col = [c for c in df.columns if 'local' in str(c).lower()]
        if loc_col:
            for idx, row in df.iterrows():
                sid = match_sondage(row[loc_col[0]], sondages)
                if sid:
                    classif_cols = [c for c in df.columns if 'classe' in str(c).lower() or 'gtr' in str(c).lower() or 'hrb' in str(c).lower()]
                    for c in classif_cols:
                        val = row[c]
                        if pd.notna(val) and str(val).strip():
                            sys = 'GTR' if 'gtr' in str(c).lower() else ('USCS' if 'hrb' in str(c).lower() else 'Autre')
                            val_clean = str(val).replace("'", "''").strip()
                            eid = get_or_create_echantillon(sid, 1.0, sql_lines, ech_map)
                            sql_lines.append(f"INSERT INTO atlas.essais_classif (echantillon_id, systeme, classe) VALUES ('{eid}', '{sys}', '{val_clean}') ON CONFLICT DO NOTHING;")

    sql_lines.append("COMMIT;")
    sql_lines.append("-- FIN")
    
    out_file = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/scripts/manual_imports_data.sql")
    out_file.write_text("\n".join(sql_lines), encoding="utf-8")
    print(f"Généré {out_file} avec {len(sql_lines)} lignes.")

def execute_sql():
    out_file = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/scripts/manual_imports_data.sql")
    if out_file.exists():
        print("Exécution des requêtes SQL...")
        conn = psycopg2.connect(DB_URL)
        cursor = conn.cursor()
        with open(out_file, 'r', encoding='utf-8') as f:
            sql = f.read()
            cursor.execute(sql)
            conn.commit()
            print(f"Exécution terminée avec succès.")
        conn.close()

if __name__ == '__main__':
    generate_sql()
    execute_sql()
