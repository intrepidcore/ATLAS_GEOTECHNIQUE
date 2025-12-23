"""
Import direct des fichiers Excel sources dans la base PostgreSQL
Lit les fichiers au format wide (granulo_tamisage_large, etc.) et les importe

Usage:
    python import_direct_from_xlsx.py <xlsx_file> [--dry-run]
    python import_direct_from_xlsx.py --all [--dry-run]

Auteur: Atlas Géotechnique
Version: 1.0.0
"""

import openpyxl
import psycopg2
from psycopg2.extras import execute_values
from pathlib import Path
import argparse
import re
from typing import Dict, List, Optional, Tuple
import uuid

# ============================================================================
# CONFIGURATION
# ============================================================================

DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

IMPORT_DIR = Path(__file__).parent.parent / 'data' / 'xlsx' / 'IMPORT'

# Mapping des sources vers les fichiers
SOURCE_FILES = {
    'TCHESSI Ezani Léleng Richard': 'TCHESSI Ezani Léleng Richard.xlsx',
    'SOGLO Ferdinand': 'SOGLO Ferdinand.xlsx',
    'ADANDOGOU Afiwa Pamela': 'ADANDOGOU Afiwa Pamela.xlsx',
    'NGOAPO Roxane Lenira Chrisie': 'NIGHASSIME ZAKARI KABOU OF NGOAPO Roxane Lenira Chrisie.xlsx',
    'NICABOU Ninsao Vianney': 'NICABOU Ninsao Vianney.xlsx',
}

# Mapping des codes Excel vers les codes en base
CODE_MAPPING = {
    # TCHESSI
    'BOHOU': 'BOHOU',
    'LAMA FEING': 'LAMA_FEING',
    'LAMA FIENG': 'LAMA_FEING',
    'LAMA TCHAMDÈ': 'LAMA_TCHAMDE',
    'LAMA TCHAMDE': 'LAMA_TCHAMDE',
    # SOGLO
    'KONSOGOU T1': 'KONSOGOUT1',
    'KONSOGOUT1': 'KONSOGOUT1',
    'KONSOGOU T2': 'KONSOGOUT2',
    'KONSOGOUT2': 'KONSOGOUT2',
    'NASSABLE': 'NASSABLE',
    'NASSABLÉ': 'NASSABLE',  # Avec accent
    'KONTONGBONGUE': 'KONTONGBONGUE',
    # ADANDOGOU
    'ASSAHOUN': 'ASSAHOUN',
    'ASSAHOUM': 'ASSAHOUN',  # Variante orthographique
    'BADJA': 'BADJA',
    'KEVE': 'KEVE',
    'KÉVÉ': 'KEVE',
    # NGOAPO
    'YADE': 'YADE',
    'TCHITCHAO': 'Tchitchao',
    'TCHETCHAO': 'Tchitchao',  # Variante orthographique
    'TCHTCHAO': 'Tchitchao',   # Autre variante
    # NICABOU
    'DAVIE': 'DAVIE',
    'DAVIÉ': 'DAVIE',
    'DZOGBECOPE': 'DZOGBECOPE',
    'DZOGBÉCOPÉ': 'DZOGBECOPE',
    'APEHEME': 'APEHEME',
    'APÉHÉMÉ': 'APEHEME',
}

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

def normalize_code(code: str) -> str:
    """Normalise un code pour le mapping"""
    if not code:
        return ''
    # Nettoyer
    code = code.strip().upper()
    # Chercher dans le mapping
    for key, value in CODE_MAPPING.items():
        if key.upper() in code or code in key.upper():
            return value
    return code


def parse_column_header(header: str) -> Tuple[Optional[str], Optional[float]]:
    """Parse un en-tête de colonne au format 'CODE@profondeur' ou 'CODE (profondeur)'"""
    if not header:
        return None, None
    
    header = str(header).strip()
    
    # Format CODE@1 ou CODE@1,5
    match = re.match(r'(.+?)@(\d+)[,.]?(\d*)', header)
    if match:
        code = match.group(1).strip()
        depth = float(f"{match.group(2)}.{match.group(3) or '0'}")
        return code, depth
    
    # Format CODE (1m) ou CODE (1,5m)
    match = re.match(r'(.+?)\s*\((\d+)[,.]?(\d*)\s*m?\)', header)
    if match:
        code = match.group(1).strip()
        depth = float(f"{match.group(2)}.{match.group(3) or '0'}")
        return code, depth
    
    return None, None


def get_connection():
    """Obtient une connexion à la base de données"""
    return psycopg2.connect(**DB_CONFIG)


def find_sondage_id(cursor, code: str, source: str) -> Optional[str]:
    """Trouve l'ID d'un sondage existant"""
    db_code = normalize_code(code)
    
    cursor.execute("""
        SELECT id FROM atlas.sondages 
        WHERE code = %s AND source ILIKE %s
        LIMIT 1
    """, (db_code, f'%{source}%'))
    
    row = cursor.fetchone()
    if row:
        return row[0]
    
    # Essayer avec UPPER
    cursor.execute("""
        SELECT id FROM atlas.sondages 
        WHERE UPPER(code) = %s AND source ILIKE %s
        LIMIT 1
    """, (db_code.upper(), f'%{source}%'))
    
    row = cursor.fetchone()
    return row[0] if row else None


def get_or_create_echantillon(cursor, sondage_id: str, depth_m: float, source: str) -> str:
    """Obtient ou crée un échantillon"""
    cursor.execute("""
        SELECT id FROM atlas.echantillons 
        WHERE sondage_id = %s AND depth_m = %s
        LIMIT 1
    """, (sondage_id, depth_m))
    
    row = cursor.fetchone()
    if row:
        return row[0]
    
    echantillon_id = str(uuid.uuid4())
    cursor.execute("""
        INSERT INTO atlas.echantillons (id, sondage_id, depth_m, laboratory, created_at)
        VALUES (%s, %s, %s, %s, NOW())
        RETURNING id
    """, (echantillon_id, sondage_id, depth_m, source))
    
    return cursor.fetchone()[0]


# ============================================================================
# PARSERS
# ============================================================================

def parse_granulo_wide_sheet(ws, method: str = 'tamisage') -> List[Dict]:
    """Parse une feuille granulo au format wide"""
    results = []
    rows = list(ws.iter_rows(values_only=True))
    
    if len(rows) < 2:
        return results
    
    header = rows[0]
    
    # Identifier les colonnes
    sieve_col = None
    data_cols = {}  # col_idx -> (code, depth)
    
    for col_idx, cell in enumerate(header):
        cell_str = str(cell or '').lower()
        
        if 'sieve' in cell_str or 'tamis' in cell_str or 'mm' in cell_str:
            sieve_col = col_idx
            continue
        
        code, depth = parse_column_header(str(cell or ''))
        if code and depth:
            data_cols[col_idx] = (code, depth)
    
    if sieve_col is None or not data_cols:
        return results
    
    # Parser les données
    for row in rows[1:]:
        try:
            sieve_val = row[sieve_col]
            if sieve_val is None:
                continue
            
            sieve_mm = float(sieve_val)
            if sieve_mm <= 0 or sieve_mm > 100:
                continue
            
            for col_idx, (code, depth) in data_cols.items():
                if col_idx >= len(row):
                    continue
                
                passing_val = row[col_idx]
                if passing_val is None:
                    continue
                
                try:
                    passing_pct = float(passing_val)
                    if 0 <= passing_pct <= 100:
                        results.append({
                            'code': code,
                            'depth_m': depth,
                            'sieve_mm': sieve_mm,
                            'passing_pct': passing_pct,
                            'method': method
                        })
                except (ValueError, TypeError):
                    pass
        except (ValueError, TypeError):
            continue
    
    return results


def parse_atterberg_sheet(ws) -> List[Dict]:
    """Parse une feuille atterberg"""
    results = []
    rows = list(ws.iter_rows(values_only=True))
    
    if len(rows) < 2:
        return results
    
    header = [str(h or '').lower().strip() for h in rows[0]]
    
    col_map = {}
    for i, h in enumerate(header):
        if 'localit' in h or 'site' in h or 'code' in h:
            col_map['code'] = i
        elif 'prof' in h or 'depth' in h:
            col_map['depth'] = i
        elif h == 'wl' or 'liquid' in h:
            col_map['wl'] = i
        elif h == 'wp' or 'plast' in h:
            col_map['wp'] = i
    
    for row in rows[1:]:
        try:
            code = row[col_map.get('code', 0)] if 'code' in col_map else None
            depth = row[col_map.get('depth', 1)] if 'depth' in col_map else None
            wl = row[col_map.get('wl')] if 'wl' in col_map and col_map['wl'] < len(row) else None
            wp = row[col_map.get('wp')] if 'wp' in col_map and col_map['wp'] < len(row) else None
            
            if code and depth is not None and (wl is not None or wp is not None):
                results.append({
                    'code': str(code),
                    'depth_m': float(depth),
                    'wl': float(wl) if wl is not None else None,
                    'wp': float(wp) if wp is not None else None
                })
        except (ValueError, TypeError, IndexError):
            continue
    
    return results


def parse_vbs_sheet(ws) -> List[Dict]:
    """Parse une feuille vbs"""
    results = []
    rows = list(ws.iter_rows(values_only=True))
    
    if len(rows) < 2:
        return results
    
    header = [str(h or '').lower().strip() for h in rows[0]]
    
    col_map = {}
    for i, h in enumerate(header):
        if 'localit' in h or 'site' in h or 'code' in h:
            col_map['code'] = i
        elif 'prof' in h or 'depth' in h:
            col_map['depth'] = i
        elif 'vbs' in h or 'bleu' in h:
            col_map['vbs'] = i
    
    for row in rows[1:]:
        try:
            code = row[col_map.get('code', 0)] if 'code' in col_map else None
            depth = row[col_map.get('depth', 1)] if 'depth' in col_map else None
            vbs = row[col_map.get('vbs')] if 'vbs' in col_map and col_map['vbs'] < len(row) else None
            
            if code and depth is not None and vbs is not None:
                results.append({
                    'code': str(code),
                    'depth_m': float(depth),
                    'vbs': float(vbs)
                })
        except (ValueError, TypeError, IndexError):
            continue
    
    return results


# ============================================================================
# IMPORT PRINCIPAL
# ============================================================================

def import_source(source: str, dry_run: bool = False) -> Dict:
    """Importe les données d'une source"""
    
    filename = SOURCE_FILES.get(source)
    if not filename:
        print(f"  ❌ Source inconnue: {source}")
        return {'error': 'Source inconnue'}
    
    xlsx_path = IMPORT_DIR / filename
    if not xlsx_path.exists():
        print(f"  ❌ Fichier non trouvé: {xlsx_path}")
        return {'error': 'Fichier non trouvé'}
    
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Import de: {source}")
    print(f"  Fichier: {filename}")
    
    try:
        wb = openpyxl.load_workbook(xlsx_path, data_only=True)
    except Exception as e:
        print(f"  ❌ Erreur ouverture: {e}")
        return {'error': str(e)}
    
    # Parser les feuilles
    granulo_data = []
    atterberg_data = []
    vbs_data = []
    
    for sheet_name in wb.sheetnames:
        ws = wb[sheet_name]
        sheet_lower = sheet_name.lower()
        
        if 'granulo_tamisage' in sheet_lower or 'agt' in sheet_lower:
            data = parse_granulo_wide_sheet(ws, 'tamisage')
            if data:
                granulo_data.extend(data)
                print(f"  📋 {sheet_name}: {len(data)} points granulo (tamisage)")
        
        elif 'granulo_sedimento' in sheet_lower or 'ags' in sheet_lower:
            data = parse_granulo_wide_sheet(ws, 'sedimentation')
            if data:
                granulo_data.extend(data)
                print(f"  📋 {sheet_name}: {len(data)} points granulo (sédimento)")
        
        elif 'atterberg' in sheet_lower or 'limite' in sheet_lower:
            data = parse_atterberg_sheet(ws)
            if data:
                atterberg_data.extend(data)
                print(f"  📋 {sheet_name}: {len(data)} essais Atterberg")
        
        elif 'vbs' in sheet_lower or 'bleu' in sheet_lower:
            data = parse_vbs_sheet(ws)
            if data:
                vbs_data.extend(data)
                print(f"  📋 {sheet_name}: {len(data)} essais VBS")
    
    # Connexion à la base
    conn = get_connection()
    cursor = conn.cursor()
    
    stats = {
        'echantillons_created': 0,
        'atterberg_inserted': 0,
        'vbs_inserted': 0,
        'granulo_inserted': 0,
        'sondages_not_found': set(),
        'errors': []
    }
    
    try:
        # Collecter tous les codes uniques
        all_codes = set()
        code_depths = {}
        
        for item in granulo_data + atterberg_data + vbs_data:
            code = item['code']
            all_codes.add(code)
            if code not in code_depths:
                code_depths[code] = set()
            code_depths[code].add(item['depth_m'])
        
        # Mapper les codes aux sondages
        code_to_sondage = {}
        for code in all_codes:
            sondage_id = find_sondage_id(cursor, code, source)
            if sondage_id:
                code_to_sondage[code] = sondage_id
            else:
                stats['sondages_not_found'].add(f"{code} -> {normalize_code(code)}")
        
        if stats['sondages_not_found']:
            print(f"  ⚠️  Sondages non trouvés: {stats['sondages_not_found']}")
        
        print(f"  ✅ Sondages trouvés: {len(code_to_sondage)}/{len(all_codes)}")
        
        # Créer les échantillons
        echantillon_cache = {}
        
        for code, depths in code_depths.items():
            if code not in code_to_sondage:
                continue
            
            sondage_id = code_to_sondage[code]
            for depth in depths:
                key = (sondage_id, depth)
                if key not in echantillon_cache:
                    if not dry_run:
                        ech_id = get_or_create_echantillon(cursor, sondage_id, depth, source)
                        echantillon_cache[key] = ech_id
                    else:
                        echantillon_cache[key] = str(uuid.uuid4())
                    stats['echantillons_created'] += 1
        
        print(f"  ✅ Échantillons: {stats['echantillons_created']}")
        
        # Insérer Atterberg
        for item in atterberg_data:
            code = item['code']
            if code not in code_to_sondage:
                continue
            
            sondage_id = code_to_sondage[code]
            key = (sondage_id, item['depth_m'])
            
            if key not in echantillon_cache:
                continue
            
            echantillon_id = echantillon_cache[key]
            
            if not dry_run:
                try:
                    ip = None
                    if item['wl'] is not None and item['wp'] is not None:
                        ip = item['wl'] - item['wp']
                    
                    cursor.execute("""
                        INSERT INTO atlas.essais_atterberg (echantillon_id, wl, wp, ip_generated, created_at)
                        VALUES (%s, %s, %s, %s, NOW())
                        ON CONFLICT (echantillon_id) DO UPDATE SET
                            wl = COALESCE(EXCLUDED.wl, atlas.essais_atterberg.wl),
                            wp = COALESCE(EXCLUDED.wp, atlas.essais_atterberg.wp),
                            ip_generated = COALESCE(EXCLUDED.ip_generated, atlas.essais_atterberg.ip_generated)
                    """, (echantillon_id, item['wl'], item['wp'], ip))
                    stats['atterberg_inserted'] += 1
                except Exception as e:
                    stats['errors'].append(f"Atterberg {code}@{item['depth_m']}: {e}")
            else:
                stats['atterberg_inserted'] += 1
        
        print(f"  ✅ Atterberg: {stats['atterberg_inserted']}")
        
        # Insérer VBS
        for item in vbs_data:
            code = item['code']
            if code not in code_to_sondage:
                continue
            
            sondage_id = code_to_sondage[code]
            key = (sondage_id, item['depth_m'])
            
            if key not in echantillon_cache:
                continue
            
            echantillon_id = echantillon_cache[key]
            
            if not dry_run:
                try:
                    cursor.execute("""
                        INSERT INTO atlas.essais_vbs (echantillon_id, vbs, created_at)
                        VALUES (%s, %s, NOW())
                        ON CONFLICT (echantillon_id) DO UPDATE SET
                            vbs = COALESCE(EXCLUDED.vbs, atlas.essais_vbs.vbs)
                    """, (echantillon_id, item['vbs']))
                    stats['vbs_inserted'] += 1
                except Exception as e:
                    stats['errors'].append(f"VBS {code}@{item['depth_m']}: {e}")
            else:
                stats['vbs_inserted'] += 1
        
        print(f"  ✅ VBS: {stats['vbs_inserted']}")
        
        # Insérer Granulo
        granulo_batch = []
        for item in granulo_data:
            code = item['code']
            if code not in code_to_sondage:
                continue
            
            sondage_id = code_to_sondage[code]
            key = (sondage_id, item['depth_m'])
            
            if key not in echantillon_cache:
                continue
            
            echantillon_id = echantillon_cache[key]
            granulo_batch.append((
                echantillon_id,
                item['sieve_mm'],
                item['passing_pct'],
                item['method']
            ))
        
        if granulo_batch and not dry_run:
            try:
                execute_values(cursor, """
                    INSERT INTO atlas.granulo_points (echantillon_id, sieve_mm, passing_pct, method, created_at)
                    VALUES %s
                    ON CONFLICT (echantillon_id, method, sieve_mm) DO UPDATE SET
                        passing_pct = EXCLUDED.passing_pct
                """, granulo_batch, template="(%s, %s, %s, %s, NOW())")
                stats['granulo_inserted'] = len(granulo_batch)
            except Exception as e:
                stats['errors'].append(f"Granulo batch: {e}")
        else:
            stats['granulo_inserted'] = len(granulo_batch)
        
        print(f"  ✅ Granulo: {stats['granulo_inserted']}")
        
        if not dry_run:
            conn.commit()
            print(f"  💾 Commit OK")
        else:
            conn.rollback()
            print(f"  🔄 Rollback (dry-run)")
        
        if stats['errors']:
            print(f"  ⚠️  Erreurs: {len(stats['errors'])}")
            for err in stats['errors'][:3]:
                print(f"      - {err}")
    
    except Exception as e:
        conn.rollback()
        print(f"  ❌ Erreur: {e}")
        stats['errors'].append(str(e))
    
    finally:
        cursor.close()
        conn.close()
    
    return stats


def import_all(dry_run: bool = False):
    """Importe toutes les sources"""
    
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}Import de {len(SOURCE_FILES)} sources")
    
    total = {
        'sources': 0,
        'echantillons': 0,
        'atterberg': 0,
        'vbs': 0,
        'granulo': 0
    }
    
    for source in SOURCE_FILES.keys():
        stats = import_source(source, dry_run)
        if 'error' not in stats:
            total['sources'] += 1
            total['echantillons'] += stats.get('echantillons_created', 0)
            total['atterberg'] += stats.get('atterberg_inserted', 0)
            total['vbs'] += stats.get('vbs_inserted', 0)
            total['granulo'] += stats.get('granulo_inserted', 0)
    
    print(f"\n{'[DRY-RUN] ' if dry_run else ''}=== RÉSUMÉ ===")
    print(f"  Sources: {total['sources']}")
    print(f"  Échantillons: {total['echantillons']}")
    print(f"  Atterberg: {total['atterberg']}")
    print(f"  VBS: {total['vbs']}")
    print(f"  Granulo: {total['granulo']}")


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='Import direct des fichiers Excel sources')
    parser.add_argument('source', nargs='?', help='Nom de la source à importer')
    parser.add_argument('--all', action='store_true', help='Importer toutes les sources')
    parser.add_argument('--dry-run', action='store_true', help='Simulation sans écriture')
    
    args = parser.parse_args()
    
    if args.all:
        import_all(args.dry_run)
    elif args.source:
        import_source(args.source, args.dry_run)
    else:
        parser.print_help()
        print("\nSources disponibles:")
        for s in SOURCE_FILES.keys():
            print(f"  - {s}")
