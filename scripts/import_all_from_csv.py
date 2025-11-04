#!/usr/bin/env python3
"""
Import COMPLET de toutes les données depuis les fichiers CSV
- Granulométrie: 6 feuilles (31.csv à 36.csv)
- Bleu (VBS): 6 feuilles (3-7.csv à 3-12.csv)
- Limite (Atterberg): 1 feuille (3-13.csv)
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
    """Normalise le nom de localité pour matcher avec les codes sondages"""
    if not name:
        return None
    # Enlever les accents
    name = remove_accents(name)
    # Enlever les espaces multiples, parenthèses
    name = name.strip()
    name = re.sub(r'\s+', '-', name)  # Espaces -> tirets
    name = re.sub(r'[()]', '', name)  # Enlever parenthèses
    name = re.sub(r'[àâäéèêëïîôùûüç]', lambda m: {
        'à':'a','â':'a','ä':'a','é':'e','è':'e','ê':'e','ë':'e',
        'ï':'i','î':'i','ô':'o','ù':'u','û':'u','ü':'u','ç':'c'
    }.get(m.group(0), m.group(0)), name.lower())
    name = name.upper()
    return name

def find_sondage_id(cursor, locality_name, source_prefix):
    """Trouve l'ID du sondage correspondant à une localité"""
    normalized = normalize_locality_name(locality_name)
    if not normalized:
        return None
    
    # Essayer plusieurs patterns
    patterns = [
        f"{source_prefix}-{normalized}",
        f"{source_prefix}-{normalized.replace('-', '')}",
        f"{source_prefix}-{normalized.split('-')[0]}",  # Premier mot
    ]
    
    for pattern in patterns:
        # Recherche exacte sans accents
        cursor.execute("""
            SELECT id FROM sondages 
            WHERE UPPER(TRANSLATE(code, 
                'ÀÂÄÉÈÊËÏÎÔÙÛÜÇ', 
                'AAAEEEEIIOOUUC')) = UPPER(TRANSLATE(%s,
                'ÀÂÄÉÈÊËÏÎÔÙÛÜÇ',
                'AAAEEEEIIOOUUC'))
            AND deleted_at IS NULL
            LIMIT 1
        """, (pattern,))
        result = cursor.fetchone()
        if result:
            return result[0]
    
    # Recherche floue avec similarité
    first_word = normalized.split('-')[0] if '-' in normalized else normalized
    cursor.execute("""
        SELECT id, code FROM sondages 
        WHERE UPPER(TRANSLATE(code,
            'ÀÂÄÉÈÊËÏÎÔÙÛÜÇ',
            'AAAEEEEIIOOUUC')) LIKE UPPER(TRANSLATE(%s,
            'ÀÂÄÉÈÊËÏÎÔÙÛÜÇ',
            'AAAEEEEIIOOUUC'))
        AND deleted_at IS NULL
        LIMIT 1
    """, (f"{source_prefix}%-{first_word}%",))
    result = cursor.fetchone()
    if result:
        print(f"  [WARN]  Match flou: '{locality_name}' -> {result[1]}")
        return result[0]
    
    print(f"  [ERR] Sondage non trouvé: {source_prefix}-{normalized}")
    return None

def import_granulometrie(cursor, csv_dir):
    """Importe toutes les données de granulométrie"""
    print("\nIMPORT GRANULOMETRIE")
    print("=" * 60)
    
    csv_files = ['31.csv', '32.csv', '33.csv', '34.csv', '35.csv', '36.csv']
    total_imported = 0
    
    for csv_file in csv_files:
        filepath = csv_dir / csv_file
        if not filepath.exists():
            print(f"  [WARN]  Fichier manquant: {csv_file}")
            continue
        
        print(f"\n  [FILE] Traitement: {csv_file}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for row in reader:
                locality = row.get('col_2') or row.get('Localité')
                if not locality or locality == 'Localités' or locality == 'Localité':
                    continue
                
                # Trouver le sondage
                sondage_id = find_sondage_id(cursor, locality, 'GRANULO')
                if not sondage_id:
                    continue
                
                # Extraire les valeurs pour les 3 profondeurs
                depths = [1.0, 1.5, 2.0]
                values = []
                for i, depth in enumerate(depths):
                    col_name = f'col_{i+3}' if 'col_3' in row else str(int(depth))
                    val = row.get(col_name, '').strip()
                    if val and val != '':
                        try:
                            values.append((depth, float(val)))
                        except ValueError:
                            pass
                
                if not values:
                    continue
                
                # Créer les échantillons et points granulo
                for depth, passing_pct in values:
                    try:
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
                            # Récupérer l'ID existant
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
                        print(f"    [OK] {locality} @ {depth}m: {passing_pct}%")
                        
                    except Exception as e:
                        print(f"    [ERR] Erreur {locality} @ {depth}m: {e}")
    
    print(f"\n  [OK] Total granulo importé: {total_imported} points")
    return total_imported

def import_bleu_vbs(cursor, csv_dir):
    """Importe toutes les données VBS (Bleu de Méthylène)"""
    print("\nIMPORT BLEU DE METHYLENE (VBS)")
    print("=" * 60)
    
    csv_files = ['3-7.csv', '3-8.csv', '3-9.csv', '3-10.csv', '3-11.csv', '3-12.csv']
    total_imported = 0
    
    for csv_file in csv_files:
        filepath = csv_dir / csv_file
        if not filepath.exists():
            print(f"  [WARN]  Fichier manquant: {csv_file}")
            continue
        
        print(f"\n  [FILE] Traitement: {csv_file}")
        
        with open(filepath, 'r', encoding='utf-8') as f:
            # Lire en mode liste car DictReader écrase les colonnes dupliquées
            reader = csv.reader(f)
            header = next(reader)  # col_0,N,Localités,1,1.5,2,1,1.5,2
            
            # Trouver les indices des colonnes VBS (premières occurrences de 1, 1.5, 2)
            vbs_indices = []
            for i, col in enumerate(header):
                if col in ['1', '1.5', '2'] and len(vbs_indices) < 3:
                    vbs_indices.append(i)
            
            locality_idx = header.index('Localités') if 'Localités' in header else header.index('Localité')
            
            for row in reader:
                if len(row) <= locality_idx:
                    continue
                    
                locality = row[locality_idx].strip()
                if not locality or locality == 'Localités' or locality == 'Localité':
                    continue
                
                # Trouver le sondage
                sondage_id = find_sondage_id(cursor, locality, 'BLEU')
                if not sondage_id:
                    continue
                
                # Extraire les valeurs VBS
                depths = [1.0, 1.5, 2.0]
                values = []
                
                for i, depth in enumerate(depths):
                    if i < len(vbs_indices) and vbs_indices[i] < len(row):
                        val = row[vbs_indices[i]].strip()
                        if val and val != '':
                            try:
                                vbs_val = float(val.replace(',', '.'))
                                # Skip valeurs hors limites (contrainte DB: 0-20)
                                if 0 <= vbs_val <= 20:
                                    values.append((depth, vbs_val))
                                else:
                                    print(f"    [WARN]  {locality} @ {depth}m: VBS={vbs_val} hors limites (0-20), ignoré")
                            except ValueError:
                                pass
                
                if not values:
                    if sondage_id:
                        print(f"    [WARN]  {locality}: aucune valeur VBS extraite")
                    continue
                
                # Créer les échantillons et essais VBS
                for depth, vbs in values:
                    try:
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
                        """, (echantillon_id, vbs))
                        
                        total_imported += 1
                        print(f"    [OK] {locality} @ {depth}m: VBS={vbs}")
                        
                    except Exception as e:
                        print(f"    [ERR] Erreur {locality} @ {depth}m: {e}")
    
    print(f"\n  [OK] Total VBS importé: {total_imported} essais")
    return total_imported

def import_atterberg(cursor, csv_dir):
    """Importe toutes les données Atterberg (WL, WP, IP)"""
    print("\nIMPORT ATTERBERG (Limites)")
    print("=" * 60)
    
    filepath = csv_dir / '3-13.csv'
    if not filepath.exists():
        print(f"  [ERR] Fichier manquant: 3-13.csv")
        return 0
    
    total_imported = 0
    
    with open(filepath, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        for row in reader:
            locality = row.get('col_3') or row.get('Localité')
            if not locality or locality == 'Localité':
                continue
            
            # Trouver le sondage (essayer LIMITE-, puis autres préfixes)
            sondage_id = find_sondage_id(cursor, locality, 'LIMITE')
            if not sondage_id:
                # Essayer avec d'autres préfixes
                for prefix in ['ATTERBERG', 'GRANULO', 'BLEU']:
                    sondage_id = find_sondage_id(cursor, locality, prefix)
                    if sondage_id:
                        break
            
            if not sondage_id:
                continue
            
            # Extraire les valeurs
            try:
                depth = float(row.get('col_4') or row.get('Profondeur', 0))
                wl = float(row.get('col_5') or row.get('WL', 0))
                wp = float(row.get('col_6') or row.get('WP', 0))
                ip = float(row.get('col_7') or row.get('IP', 0))
            except (ValueError, TypeError):
                continue
            
            try:
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
                
                # Créer essai Atterberg (ip est calculé automatiquement)
                cursor.execute("""
                    INSERT INTO essais_atterberg (echantillon_id, wl, wp)
                    VALUES (%s, %s, %s)
                    ON CONFLICT (echantillon_id) DO NOTHING
                """, (echantillon_id, wl, wp))
                
                total_imported += 1
                print(f"    [OK] {locality} @ {depth}m: WL={wl}, WP={wp}, IP={ip}")
                
            except Exception as e:
                print(f"    [ERR] Erreur {locality} @ {depth}m: {e}")
    
    print(f"\n  [OK] Total Atterberg importé: {total_imported} essais")
    return total_imported

def main():
    print("IMPORT COMPLET - Granulometrie, Bleu (VBS), Atterberg")
    print("=" * 60)
    
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
        print("[OK] Connexion DB établie")
    except Exception as e:
        print(f"[ERR] Erreur connexion DB: {e}")
        return 1
    
    try:
        # Import Granulométrie
        n_granulo = import_granulometrie(cursor, granulo_dir)
        
        # Import Bleu VBS
        n_vbs = import_bleu_vbs(cursor, bleu_dir)
        
        # Import Atterberg
        n_atterberg = import_atterberg(cursor, limite_dir)
        
        # Commit
        conn.commit()
        print("\n" + "=" * 60)
        print("[OK] IMPORT TERMINÉ AVEC SUCCÈS!")
        print(f"   - Granulométrie: {n_granulo} points")
        print(f"   - VBS: {n_vbs} essais")
        print(f"   - Atterberg: {n_atterberg} essais")
        print(f"   - TOTAL: {n_granulo + n_vbs + n_atterberg} essais")
        
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


