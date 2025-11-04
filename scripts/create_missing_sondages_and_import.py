#!/usr/bin/env python3
"""
Crée les sondages manquants depuis les CSV et importe TOUS les essais
- Granulométrie: 77 localités
- Bleu (VBS): 75 localités
- Limite (Atterberg): 12 localités
"""

import csv
import os
import sys
from pathlib import Path
import psycopg2
from psycopg2.extras import execute_values
import re
import unicodedata

# Configuration DB
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def remove_accents(text):
    """Enlève tous les accents d'un texte"""
    nfd = unicodedata.normalize('NFD', text)
    return ''.join(char for char in nfd if unicodedata.category(char) != 'Mn')

def normalize_locality_name(name):
    """Normalise le nom de localité pour créer un code sondage"""
    if not name:
        return None
    # Enlever les accents
    name = remove_accents(name)
    # Enlever les espaces multiples, parenthèses
    name = name.strip()
    name = re.sub(r'\s+', '-', name)  # Espaces → tirets
    name = re.sub(r'[()]', '', name)  # Enlever parenthèses
    name = name.upper()
    return name

def create_sondage_if_not_exists(cursor, code, source):
    """Crée un sondage s'il n'existe pas déjà"""
    cursor.execute("""
        SELECT id FROM sondages WHERE code = %s AND deleted_at IS NULL
    """, (code,))
    result = cursor.fetchone()
    
    if result:
        return result[0]
    
    # Créer le sondage (unknown = pas encore géocodé)
    # Le trigger enqueue_geocode_suggestion l'ajoutera automatiquement aux suggestions
    cursor.execute("""
        INSERT INTO sondages (code, source, location_mode, is_geocoded)
        VALUES (%s, %s, 'unknown', false)
        RETURNING id
    """, (code, source))
    
    sondage_id = cursor.fetchone()[0]
    print(f"  [NEW] Sondage créé: {code}")
    return sondage_id

def import_granulometrie_complete(cursor, csv_dir):
    """Importe TOUTES les données de granulométrie"""
    print("\n" + "="*80)
    print("IMPORT COMPLET GRANULOMETRIE")
    print("="*80)
    
    csv_files = ['31.csv', '32.csv', '33.csv', '34.csv', '35.csv', '36.csv']
    total_sondages = 0
    total_imported = 0
    
    for csv_file in csv_files:
        filepath = csv_dir / csv_file
        if not filepath.exists():
            print(f"  [WARN] Fichier manquant: {csv_file}")
            continue
        
        print(f"\n[FILE] {csv_file}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                locality = row.get('col_2') or row.get('Localité') or row.get('Localités')
                if not locality or locality in ['Localités', 'Localité']:
                    continue
                
                # Créer code sondage
                normalized = normalize_locality_name(locality)
                if not normalized:
                    continue
                
                code = f"GRANULO-{normalized}"
                
                # Créer sondage
                sondage_id = create_sondage_if_not_exists(cursor, code, 'Granulométrie')
                if not sondage_id:
                    continue
                
                total_sondages += 1
                
                # Extraire valeurs pour 3 profondeurs
                depths = [1.0, 1.5, 2.0]
                for i, depth in enumerate(depths):
                    col_name = f'col_{i+3}'
                    val = row.get(col_name, '').strip()
                    if val and val != '':
                        try:
                            passing_pct = float(val)
                            
                            # Créer échantillon
                            cursor.execute("""
                                INSERT INTO echantillons (sondage_id, depth_m)
                                VALUES (%s, %s)
                                ON CONFLICT (sondage_id, depth_m, date) DO NOTHING
                                RETURNING id
                            """, (sondage_id, depth))
                            
                            result = cursor.fetchone()
                            if result:
                                echantillon_id = result[0]
                            else:
                                cursor.execute("""
                                    SELECT id FROM echantillons 
                                    WHERE sondage_id = %s AND depth_m = %s AND date IS NULL
                                """, (sondage_id, depth))
                                echantillon_id = cursor.fetchone()[0]
                            
                            # Créer point granulo
                            cursor.execute("""
                                INSERT INTO granulo_points (echantillon_id, method, sieve_mm, passing_pct)
                                VALUES (%s, 'tamisage', 1.0, %s)
                                ON CONFLICT (echantillon_id, method, sieve_mm) DO NOTHING
                            """, (echantillon_id, passing_pct))
                            
                            total_imported += 1
                            
                        except (ValueError, TypeError) as e:
                            pass
    
    print(f"\n[OK] Granulo: {total_sondages} sondages, {total_imported} points importés")
    return total_sondages, total_imported

def import_bleu_vbs_complete(cursor, csv_dir):
    """Importe TOUTES les données VBS"""
    print("\n" + "="*80)
    print("IMPORT COMPLET BLEU DE METHYLENE (VBS)")
    print("="*80)
    
    csv_files = ['3-7.csv', '3-8.csv', '3-9.csv', '3-10.csv', '3-11.csv', '3-12.csv']
    total_sondages = 0
    total_imported = 0
    skipped_invalid = 0
    
    for csv_file in csv_files:
        filepath = csv_dir / csv_file
        if not filepath.exists():
            print(f"  [WARN] Fichier manquant: {csv_file}")
            continue
        
        print(f"\n[FILE] {csv_file}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.reader(f)
            header = next(reader)
            
            # Trouver indices des colonnes VBS
            vbs_indices = []
            for i, col in enumerate(header):
                if col in ['1', '1.5', '2'] and len(vbs_indices) < 3:
                    vbs_indices.append(i)
            
            locality_idx = header.index('Localités') if 'Localités' in header else 2
            
            for row in reader:
                if len(row) <= locality_idx:
                    continue
                
                locality = row[locality_idx].strip()
                if not locality or locality in ['Localités', 'Localité']:
                    continue
                
                # Créer code sondage
                normalized = normalize_locality_name(locality)
                if not normalized:
                    continue
                
                code = f"BLEU-{normalized}"
                
                # Créer sondage
                sondage_id = create_sondage_if_not_exists(cursor, code, 'bleu')
                if not sondage_id:
                    continue
                
                total_sondages += 1
                
                # Extraire valeurs VBS
                depths = [1.0, 1.5, 2.0]
                for i, depth in enumerate(depths):
                    if i < len(vbs_indices) and vbs_indices[i] < len(row):
                        val = row[vbs_indices[i]].strip()
                        if val and val != '':
                            try:
                                vbs_val = float(val.replace(',', '.'))
                                
                                # Skip valeurs hors limites (contrainte DB: 0-20)
                                if not (0 <= vbs_val <= 20):
                                    skipped_invalid += 1
                                    continue
                                
                                # Créer échantillon
                                cursor.execute("""
                                    INSERT INTO echantillons (sondage_id, depth_m)
                                    VALUES (%s, %s)
                                    ON CONFLICT (sondage_id, depth_m, date) DO NOTHING
                                    RETURNING id
                                """, (sondage_id, depth))
                                
                                result = cursor.fetchone()
                                if result:
                                    echantillon_id = result[0]
                                else:
                                    cursor.execute("""
                                        SELECT id FROM echantillons 
                                        WHERE sondage_id = %s AND depth_m = %s AND date IS NULL
                                    """, (sondage_id, depth))
                                    echantillon_id = cursor.fetchone()[0]
                                
                                # Créer essai VBS
                                cursor.execute("""
                                    INSERT INTO essais_vbs (echantillon_id, vbs)
                                    VALUES (%s, %s)
                                    ON CONFLICT (echantillon_id) DO NOTHING
                                """, (echantillon_id, vbs_val))
                                
                                total_imported += 1
                                
                            except (ValueError, TypeError) as e:
                                pass
    
    print(f"\n[OK] VBS: {total_sondages} sondages, {total_imported} essais importés")
    if skipped_invalid > 0:
        print(f"[WARN] {skipped_invalid} valeurs VBS >20 ignorées (contrainte DB)")
    return total_sondages, total_imported

def import_atterberg_complete(cursor, csv_dir):
    """Importe TOUTES les données Atterberg"""
    print("\n" + "="*80)
    print("IMPORT COMPLET ATTERBERG (Limites)")
    print("="*80)
    
    filepath = csv_dir / '3-13.csv'
    if not filepath.exists():
        print(f"  [ERR] Fichier manquant: 3-13.csv")
        return 0, 0
    
    total_sondages = set()
    total_imported = 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            locality = row.get('col_3') or row.get('Localité')
            if not locality or locality == 'Localité':
                continue
            
            # Créer code sondage
            normalized = normalize_locality_name(locality)
            if not normalized:
                continue
            
            code = f"LIMITE-{normalized}"
            
            # Créer sondage
            sondage_id = create_sondage_if_not_exists(cursor, code, 'limite')
            if not sondage_id:
                continue
            
            total_sondages.add(code)
            
            # Extraire valeurs
            try:
                depth = float(row.get('col_4') or row.get('Profondeur', 0))
                wl = float(row.get('col_5') or row.get('WL', 0))
                wp = float(row.get('col_6') or row.get('WP', 0))
            except (ValueError, TypeError):
                continue
            
            # Créer échantillon
            cursor.execute("""
                INSERT INTO echantillons (sondage_id, depth_m)
                VALUES (%s, %s)
                ON CONFLICT (sondage_id, depth_m, date) DO NOTHING
                RETURNING id
            """, (sondage_id, depth))
            
            result = cursor.fetchone()
            if result:
                echantillon_id = result[0]
            else:
                cursor.execute("""
                    SELECT id FROM echantillons 
                    WHERE sondage_id = %s AND depth_m = %s AND date IS NULL
                """, (sondage_id, depth))
                echantillon_id = cursor.fetchone()[0]
            
            # Créer essai Atterberg
            cursor.execute("""
                INSERT INTO essais_atterberg (echantillon_id, wl, wp)
                VALUES (%s, %s, %s)
                ON CONFLICT (echantillon_id) DO NOTHING
            """, (echantillon_id, wl, wp))
            
            total_imported += 1
    
    print(f"\n[OK] Atterberg: {len(total_sondages)} sondages, {total_imported} essais importés")
    return len(total_sondages), total_imported

def main():
    print("="*80)
    print("CREATION SONDAGES MANQUANTS + IMPORT COMPLET")
    print("="*80)
    
    # Chemins
    base_dir = Path(__file__).parent.parent / 'data' / 'xlsx_convert'
    granulo_dir = base_dir / 'Granulométrie'
    bleu_dir = base_dir / 'bleu'
    limite_dir = base_dir / 'limite'
    
    # Connexion DB
    try:
        conn = psycopg2.connect(**DB_CONFIG)
        conn.autocommit = False
        cursor = conn.cursor()
        print("[OK] Connexion DB etablie\n")
    except Exception as e:
        print(f"[ERR] Erreur connexion DB: {e}")
        return 1
    
    try:
        # Import complet
        n_sondages_granulo, n_granulo = import_granulometrie_complete(cursor, granulo_dir)
        n_sondages_vbs, n_vbs = import_bleu_vbs_complete(cursor, bleu_dir)
        n_sondages_atterberg, n_atterberg = import_atterberg_complete(cursor, limite_dir)
        
        # Commit
        conn.commit()
        
        print("\n" + "="*80)
        print("IMPORT TERMINE AVEC SUCCES!")
        print("="*80)
        print(f"Sondages crees/utilises:")
        print(f"  - Granulometrie: {n_sondages_granulo} sondages")
        print(f"  - VBS: {n_sondages_vbs} sondages")
        print(f"  - Atterberg: {n_sondages_atterberg} sondages")
        print(f"  - TOTAL: {n_sondages_granulo + n_sondages_vbs + n_sondages_atterberg} sondages")
        print(f"\nEssais importes:")
        print(f"  - Granulometrie: {n_granulo} points")
        print(f"  - VBS: {n_vbs} essais")
        print(f"  - Atterberg: {n_atterberg} essais")
        print(f"  - TOTAL: {n_granulo + n_vbs + n_atterberg} essais")
        
        # Refresh vue unifiée
        print("\n[REFRESH] Mise a jour vue unifiee...")
        cursor.execute("SELECT atlas.refresh_sondages_unifies();")
        conn.commit()
        print("[OK] Vue unifiee rafraichie")
        
    except Exception as e:
        conn.rollback()
        print(f"\n[ERR] ERREUR: {e}")
        import traceback
        traceback.print_exc()
        return 1
    finally:
        cursor.close()
        conn.close()
    
    return 0

if __name__ == '__main__':
    sys.exit(main())
