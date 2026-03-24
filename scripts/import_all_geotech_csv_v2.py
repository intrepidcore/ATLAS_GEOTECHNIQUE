#!/usr/bin/env python3
"""
ETL v2 : Import dynamique et itératif des fichiers CSV hétérogènes.
Parcourt data/xlsx_convert_md/ et insère les données trouvées dans atlas_clean.
Implémente la maximisation de la couverture de la matrice.
"""

import os
import glob
import pandas as pd
import psycopg2
from psycopg2.extras import execute_values
import uuid
from typing import List, Dict, Any
import numpy as np
import logging

logging.basicConfig(level=logging.INFO, format='%(levelname)s: %(message)s')

DB_PARAMS = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def clean_col_name(c):
    return str(c).lower().replace('\n', '').strip()

def extract_atterberg(df, ctx_source, ctx_localite):
    records = []
    # Recherche des colonnes Wl, Wp, Ip
    cols = [clean_col_name(c) for c in df.columns]
    
    wl_col = next((c for c in cols if 'liquidité' in c or 'wl' in c), None)
    wp_col = next((c for c in cols if 'plasticité' in c or 'wp' in c and 'indice' not in c), None)
    ip_col = next((c for c in cols if 'indice' in c and 'plasticité' in c or 'ip' in c), None)
    
    if wl_col and wp_col and ip_col:
        df.columns = cols
        for _, row in df.iterrows():
            wl = pd.to_numeric(row[wl_col], errors='coerce')
            wp = pd.to_numeric(row[wp_col], errors='coerce')
            ip = pd.to_numeric(row[ip_col], errors='coerce')
            
            if pd.notna(wl) and pd.notna(wp):
                if pd.isna(ip): ip = wl - wp
                # Quality Gate intra-ETL
                if 20 <= wl <= 120 and 10 <= wp <= 60 and abs(ip - (wl - wp)) <= 5:
                    records.append({
                        'wl': float(wl), 'wp': float(wp), 'ip': float(ip),
                        'source': ctx_source, 'localite': ctx_localite
                    })
    return records

def extract_vbs(df, ctx_source, ctx_localite):
    records = []
    cols = [clean_col_name(c) for c in df.columns]
    vbs_col = next((c for c in cols if 'vbs' in c or 'bleu' in c), None)
    if vbs_col:
        df.columns = cols
        for _, row in df.iterrows():
            vbs = pd.to_numeric(row[vbs_col], errors='coerce')
            if pd.notna(vbs) and 0 <= vbs <= 20:
                records.append({
                    'vbs': float(vbs), 'source': ctx_source, 'localite': ctx_localite
                })
    return records

def extract_proctor(df, ctx_source, ctx_localite):
    records = []
    cols = [clean_col_name(c) for c in df.columns]
    dens_col = next((c for c in cols if 'densité' in c or 'gd' in c or 'optimale' in c and 'eau' not in c), None)
    eau_col = next((c for c in cols if 'teneur' in c and 'eau' in c or 'wop' in c), None)
    
    if dens_col and eau_col:
        df.columns = cols
        for _, row in df.iterrows():
            dens = pd.to_numeric(row[dens_col], errors='coerce')
            eau = pd.to_numeric(row[eau_col], errors='coerce')
            if pd.notna(dens) and pd.notna(eau) and 1.0 <= dens <= 3.0 and 0 <= eau <= 50:
                records.append({
                    'density': float(dens), 'water': float(eau),
                    'source': ctx_source, 'localite': ctx_localite
                })
    return records

def insert_data(atterberg, vbs, proctor):
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        
        # Désactiver les triggers analytiques le temps de l'import
        cur.execute("ALTER TABLE atlas.sondages DISABLE TRIGGER trigger_refresh_mailles;")
        
        sondages_cache = {}
        
        def get_sondage_id(localite):
            if localite not in sondages_cache:
                sid = str(uuid.uuid4())
                cur.execute("""
                    INSERT INTO atlas.sondages (id, code, location_accuracy, source, localite)
                    VALUES (%s, %s, 'unknown', 'import_csv_v2', %s)
                    ON CONFLICT DO NOTHING;
                """, (sid, f"EXT-{localite[:15]}-{sid[:4]}", localite))
                sondages_cache[localite] = sid
            return sondages_cache[localite]
            
        # Atterberg
        for rec in atterberg:
            sid = get_sondage_id(rec['localite'])
            eid = str(uuid.uuid4())
            cur.execute("INSERT INTO atlas.echantillons (id, sondage_id, depth_m) VALUES (%s, %s, 1.0) ON CONFLICT DO NOTHING;", (eid, sid))
            cur.execute("""
                INSERT INTO atlas.essais_atterberg (id, echantillon_id, wl, wp, ip_generated)
                VALUES (%s, %s, %s, %s, %s) ON CONFLICT DO NOTHING;
            """, (str(uuid.uuid4()), eid, rec['wl'], rec['wp'], rec['ip']))
            
        # VBS
        for rec in vbs:
            sid = get_sondage_id(rec['localite'])
            eid = str(uuid.uuid4())
            cur.execute("INSERT INTO atlas.echantillons (id, sondage_id, depth_m) VALUES (%s, %s, 1.0) ON CONFLICT DO NOTHING;", (eid, sid))
            cur.execute("""
                INSERT INTO atlas.essais_vbs (id, echantillon_id, vbs)
                VALUES (%s, %s, %s) ON CONFLICT DO NOTHING;
            """, (str(uuid.uuid4()), eid, rec['vbs']))
            
        # Proctor
        for rec in proctor:
            sid = get_sondage_id(rec['localite'])
            eid = str(uuid.uuid4())
            cur.execute("INSERT INTO atlas.echantillons (id, sondage_id, depth_m) VALUES (%s, %s, 1.0) ON CONFLICT DO NOTHING;", (eid, sid))
            
            gamma = rec['density'] * 10.0 if rec['density'] < 10 else rec['density']
            if 10.0 <= gamma <= 30.0:
                cur.execute("""
                    INSERT INTO atlas.essais_proctor (id, echantillon_id, proctor_type, gamma_d_max, w_opt)
                    VALUES (%s, %s, 'modifie', %s, %s) ON CONFLICT DO NOTHING;
                """, (str(uuid.uuid4()), eid, gamma, rec['water']))

        # Réactiver et rafraichir
        cur.execute("ALTER TABLE atlas.sondages ENABLE TRIGGER trigger_refresh_mailles;")
        try:
            cur.execute("SELECT atlas.refresh_mailles_geotech();")
        except Exception as e:
            logging.warning(f"Refresh manuel impossible: {e}")

        conn.commit()
        cur.close()
        conn.close()
        logging.info(f"Insérés: {len(atterberg)} Atterberg, {len(vbs)} VBS, {len(proctor)} Proctor")
    except Exception as e:
        logging.error(f"Erreur d'insertion DB: {e}")

if __name__ == "__main__":
    base_dir = "data/xlsx_convert_md"
    all_csv = glob.glob(os.path.join(base_dir, "**", "*.csv"), recursive=True)
    
    total_att, total_vbs, total_proc = [], [], []
    
    for fpath in all_csv:
        folder_name = os.path.basename(os.path.dirname(fpath))
        file_name = os.path.basename(fpath)
        try:
            df = pd.read_csv(fpath, skiprows=1) # skip first row which is often col_0, col_1...
            if len(df) > 0:
                att = extract_atterberg(df, file_name, folder_name)
                vbs = extract_vbs(df, file_name, folder_name)
                proc = extract_proctor(df, file_name, folder_name)
                total_att.extend(att)
                total_vbs.extend(vbs)
                total_proc.extend(proc)
        except Exception as e:
            continue
            
    logging.info(f"Extraction terminée : {len(total_att)} Atterberg, {len(total_vbs)} VBS, {len(total_proc)} Proctor trouvés.")
    insert_data(total_att, total_vbs, total_proc)
