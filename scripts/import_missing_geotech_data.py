#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
DONNÉES IMPORTABLES IMMÉDIATEMENT — Stratégie technique

Clé de jointure :
  Tous les fichiers xlsx doivent être rattachés via l'une des colonnes :
  1. sondage_code (si présent dans le xlsx → jointure directe)
  2. commune_nom + coordonnées GPS → résolution via atlas.colab_maille_code_map
  3. localité → résolution via atlas.v_maille_adm3 (fallback ADM3)

Vérification avant import (obligatoire) :
  - Le sondage existe dans atlas.sondages
  - Les valeurs sont dans les plages physiquement admissibles :
    VBS : 0 ≤ VBS ≤ 20 g/100g
    WL  : 20 ≤ WL ≤ 120 %
    WP  : 10 ≤ WP ≤ 60 %
    IP  : 0 ≤ IP ≤ 80 % (et IP = WL - WP ± 5%)
    Passant 80µm : 0 ≤ valeur ≤ 100 %
    Passant 2mm  : 0 ≤ valeur ≤ 100 %
    γd max : 14 ≤ γd max ≤ 22 kN/m³
    w opt  : 5 ≤ w opt ≤ 30 %
"""

import pandas as pd
import psycopg2
from dataclasses import dataclass
from typing import Optional, Tuple, List
import argparse

@dataclass
class ImportResult:
    source_file: str
    rows_read: int
    rows_matched: int      # Sondages trouvés en DB
    rows_imported: int     # Valeurs réellement insérées
    rows_skipped: int      # Valeurs hors plage ou déjà présentes
    errors: List[str]

def validate_atterberg(wl: float, wp: float, ip: float) -> Tuple[bool, str]:
    """Vérifie la cohérence interne des limites d'Atterberg."""
    if not (20 <= wl <= 120):
        return False, f"WL hors plage: {wl}"
    if not (10 <= wp <= 60):
        return False, f"WP hors plage: {wp}"
    if not (0 <= ip <= 80):
        return False, f"IP hors plage: {ip}"
    # Vérification cohérence : IP doit être proche de WL - WP
    ip_calc = wl - wp
    if abs(ip - ip_calc) > 5:
        return False, f"IP incohérent: IP={ip}, WL-WP={ip_calc:.1f}"
    return True, "OK"

def import_bleu_xlsx(db_url: str, xlsx_path: str) -> ImportResult:
    """
    Importe bleu.xlsx vers atlas.essais_vbs.
    Format attendu : colonnes [sondage_code, vbs, profondeur_m]
    """
    df = pd.read_excel(xlsx_path)
    result = ImportResult(
        source_file=xlsx_path,
        rows_read=len(df),
        rows_matched=0,
        rows_imported=0,
        rows_skipped=0,
        errors=[]
    )
    
    conn = psycopg2.connect(db_url)
    cursor = conn.cursor()
    
    for _, row in df.iterrows():
        # Validation plage physique
        vbs = row.get('vbs')
        if pd.isna(vbs) or not (0 <= float(vbs) <= 20):
            result.rows_skipped += 1
            result.errors.append(f"VBS hors plage: {vbs} pour sondage {row.get('sondage_code', 'inconnu')}")
            continue
        
        # Vérifier que le sondage existe
        cursor.execute(
            "SELECT id FROM atlas.sondages WHERE code = %s",
            (row['sondage_code'],)
        )
        sondage = cursor.fetchone()
        if not sondage:
            result.rows_skipped += 1
            continue
        
        result.rows_matched += 1
        
        # Insérer (idempotent : ON CONFLICT DO NOTHING)
        # Supposons l'existence d'une table `atlas.essais_vbs` et de contraintes d'unicité.
        cursor.execute("""
            INSERT INTO atlas.essais_vbs (sondage_id, vbs, profondeur_m, source_fichier)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (sondage_id, profondeur_m) DO NOTHING
        """, (sondage[0], vbs, row.get('profondeur_m', 0), xlsx_path))
        
        result.rows_imported += cursor.rowcount
    
    conn.commit()
    conn.close()
    return result

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description="Importer des données géotechniques manquantes avec validation stricte.")
    parser.add_argument('--db-url', type=str, required=True, help="URL de la base de données")
    parser.add_argument('--xlsx', type=str, required=True, help="Chemin vers le fichier XLSX à importer")
    parser.add_argument('--type', type=str, choices=['vbs', 'atterberg', 'granulometrie', 'proctor'], required=True, help="Type de l'essai à importer")
    
    args = parser.parse_args()
    
    print(f"Démarrage de l'import {args.type} depuis {args.xlsx}...")
    if args.type == 'vbs':
        res = import_bleu_xlsx(args.db_url, args.xlsx)
        print(f"Terminé : lus={res.rows_read}, match={res.rows_matched}, importés={res.rows_imported}, skippés={res.rows_skipped}")
        if res.errors:
            print(f"Erreurs rencontrées ({len(res.errors)}) :")
            for e in res.errors[:10]:
                print(f" - {e}")
            if len(res.errors) > 10:
                print(" ...et d'autres.")
    else:
        print(f"L'import de type {args.type} est en cours de développement.")
