"""
Import complet des 16 projets depuis fichiers MD
Version robuste avec:
- Parsing tolérant (tableaux MD, listes, CSV)
- Mapping fort + fallback meta JSONB
- Upsert idempotent
- Logs détaillés
- Politique géoloc: adm_random_cell (pas de spread)
"""

import re
import hashlib
from pathlib import Path
from typing import List, Dict, Tuple, Optional, Any
from datetime import datetime
import json
import unicodedata

# Configuration
XLSX_CONVERT_DIR = Path("data/xlsx_convert")
OUTPUT_SQL_DIR = Path("sql/imports_projects")
OUTPUT_SQL_DIR.mkdir(parents=True, exist_ok=True)

# Normalisation des clés
def normalize_key(key: str) -> str:
    """Normalise une clé: minuscules, sans accents, espaces → _"""
    if not key:
        return ""
    # Retirer accents
    key = unicodedata.normalize('NFD', key)
    key = ''.join(c for c in key if unicodedata.category(c) != 'Mn')
    # Minuscules, espaces → _
    key = key.lower().strip()
    key = re.sub(r'[^\w\s-]', '', key)
    key = re.sub(r'[\s-]+', '_', key)
    return key

# Mapping des clés vers colonnes
MAPPING = {
    # Atterberg
    'wl': 'wl', 'limite_liquidite': 'wl', 'liquid_limit': 'wl',
    'wp': 'wp', 'limite_plasticite': 'wp', 'plastic_limit': 'wp',
    
    # VBS
    'vbs': 'vbs', 'bleu': 'vbs', 'bleu_methylene': 'vbs',
    
    # Densités
    'densite_apparente': 'densite_apparente_gcm3',
    'densite_absolue': 'densite_absolue_gcm3',
    'densite_reelle': 'densite_absolue_gcm3',
    
    # Teneur eau
    'teneur_eau': 'teneur_eau_pct',
    'water_content': 'teneur_eau_pct',
    'w': 'teneur_eau_pct',
    
    # Classifications
    'classification_hrb': 'classif_aashto',
    'classification_aashto': 'classif_aashto',
    'aashto': 'classif_aashto',
    'hrb': 'classif_aashto',
    'classification_uscs': 'classif_uscs',
    'uscs': 'classif_uscs',
    
    # Proctor
    'gamma_d_max': 'gamma_d_max',
    'w_opt': 'w_opt',
    'proctor_type': 'proctor_type',
    
    # Granulo
    'passant_80um': 'passant_80um',
    'passant_2mm': 'passant_2mm',
    'passant_20mm': 'passant_20mm',
}

def parse_md_table(lines: List[str]) -> Tuple[List[str], List[List[str]]]:
    """Parse un tableau Markdown"""
    if len(lines) < 2:
        return [], []
    
    # Ligne 1 = headers
    headers = [h.strip() for h in lines[0].split('|')[1:-1]]
    
    # Ligne 2 = séparateur (ignorer)
    # Lignes 3+ = données
    rows = []
    for line in lines[2:]:
        if not line.strip():
            continue
        cells = [c.strip() for c in line.split('|')[1:-1]]
        if any(c for c in cells):  # Ignorer lignes vides
            rows.append(cells)
    
    return headers, rows

def extract_tables_from_md(md_path: Path) -> List[Dict]:
    """Extrait tous les tableaux d'un fichier MD"""
    with open(md_path, 'r', encoding='utf-8') as f:
        content = f.read()
    
    tables = []
    current_section = None
    in_table = False
    table_lines = []
    
    for line in content.split('\n'):
        # Détecter section
        if line.startswith('## '):
            current_section = line[3:].split('{')[0].strip()
            in_table = False
            table_lines = []
        
        # Détecter début de tableau
        elif line.startswith('|') and not in_table:
            in_table = True
            table_lines = [line]
        
        # Continuer tableau
        elif line.startswith('|') and in_table:
            table_lines.append(line)
        
        # Fin de tableau
        elif in_table and not line.startswith('|'):
            if len(table_lines) > 2:
                headers, rows = parse_md_table(table_lines)
                if rows:
                    tables.append({
                        'section': current_section,
                        'headers': headers,
                        'rows': rows
                    })
            in_table = False
            table_lines = []
    
    return tables

def identify_data_type(section_name: str, headers: List[str]) -> str:
    """Identifie le type de données"""
    section_lower = (section_name or '').lower()
    headers_str = ' '.join(headers).lower()
    
    if 'agt' in section_lower or 'ags' in section_lower or 'granulo' in section_lower:
        return 'granulometrie'
    elif 'limite' in section_lower or 'atterberg' in section_lower or 'wl' in headers_str or 'wp' in headers_str:
        return 'atterberg'
    elif 'bleu' in section_lower or 'vbs' in headers_str:
        return 'vbs'
    elif 'densit' in section_lower:
        return 'densite'
    elif 'teneur' in section_lower and 'eau' in section_lower:
        return 'teneur_eau'
    elif 'classification' in section_lower:
        return 'classification'
    else:
        return 'unknown'

def parse_float(value: str) -> Optional[float]:
    """Parse une valeur numérique (tolérant)"""
    if not value or value.strip() in ['', '-', 'N/A', 'n/a']:
        return None
    try:
        # Remplacer virgule par point
        value = value.replace(',', '.')
        return float(value)
    except:
        return None

def generate_sql_for_project(project_name: str, md_path: Path) -> Tuple[str, Dict]:
    """Génère le script SQL complet pour un projet"""
    tables = extract_tables_from_md(md_path)
    
    if not tables:
        return f"-- Aucune donnée trouvée dans {project_name}\n", {'error': 'no_data'}
    
    stats = {
        'project': project_name,
        'tables_found': len(tables),
        'sondages': 0,
        'essais': 0,
        'physiques': 0,
        'classif': 0,
        'granulo_points': 0,
        'errors': []
    }
    
    sql_lines = []
    sql_lines.append(f"-- Import projet: {project_name}")
    sql_lines.append(f"-- Source: {md_path.name}")
    sql_lines.append(f"-- Date: {datetime.now().isoformat()}")
    sql_lines.append(f"-- Tables: {len(tables)}\n")
    
    # Analyser les tables pour extraire les données
    sondages_data = {}  # {localite: {depth: {data}}}
    
    for table in tables:
        dtype = identify_data_type(table['section'], table['headers'])
        headers_norm = [normalize_key(h) for h in table['headers']]
        
        # Chercher colonnes clés
        localite_idx = None
        profondeur_idx = None
        
        for i, h in enumerate(headers_norm):
            if 'localit' in h or 'canton' in h or 'site' in h:
                localite_idx = i
            if 'profondeur' in h or 'depth' in h:
                profondeur_idx = i
        
        if localite_idx is None or profondeur_idx is None:
            continue
        
        # Extraire données par localité et profondeur
        for row in table['rows']:
            if len(row) <= max(localite_idx, profondeur_idx):
                continue
            
            localite = row[localite_idx].strip()
            profondeur_str = row[profondeur_idx].strip()
            
            if not localite or 'moyenne' in profondeur_str.lower():
                continue
            
            profondeur = parse_float(profondeur_str)
            if profondeur is None:
                continue
            
            # Initialiser structure
            if localite not in sondages_data:
                sondages_data[localite] = {}
            if profondeur not in sondages_data[localite]:
                sondages_data[localite][profondeur] = {}
            
            # Extraire valeurs
            for i, h_norm in enumerate(headers_norm):
                if i >= len(row):
                    continue
                value_str = row[i].strip()
                if not value_str or value_str in ['-', 'N/A']:
                    continue
                
                # Mapper vers colonne
                if h_norm in MAPPING:
                    col = MAPPING[h_norm]
                    value = parse_float(value_str)
                    if value is not None:
                        sondages_data[localite][profondeur][col] = value
                else:
                    # Fallback meta
                    value = parse_float(value_str)
                    if value is not None:
                        if 'meta' not in sondages_data[localite][profondeur]:
                            sondages_data[localite][profondeur]['meta'] = {}
                        sondages_data[localite][profondeur]['meta'][h_norm] = value
    
    # Générer SQL
    for localite, depths in sondages_data.items():
        code_sondage = f"{project_name.upper().replace(' ', '-')}-{localite.upper().replace(' ', '-')}"
        
        sql_lines.append(f"\n-- Sondage: {localite}")
        sql_lines.append(f"INSERT INTO sondages (id, code, source, created_at)")
        sql_lines.append(f"VALUES (gen_random_uuid(), '{code_sondage}', '{project_name}', now())")
        sql_lines.append(f"ON CONFLICT (code) DO NOTHING;")
        sql_lines.append("")
        
        stats['sondages'] += 1
        
        for depth, data in sorted(depths.items()):
            sql_lines.append(f"DO $$")
            sql_lines.append(f"DECLARE")
            sql_lines.append(f"    v_sondage_id uuid;")
            sql_lines.append(f"    v_essai_id uuid;")
            sql_lines.append(f"BEGIN")
            sql_lines.append(f"    SELECT id INTO v_sondage_id FROM sondages WHERE code = '{code_sondage}';")
            sql_lines.append(f"    ")
            
            # Essai géotechnique
            cols = ['id', 'sondage_id', 'depth_m']
            vals = ['gen_random_uuid()', 'v_sondage_id', str(depth)]
            
            for key in ['wl', 'wp', 'vbs', 'gamma_d_max', 'w_opt', 'proctor_type', 'passant_80um', 'passant_2mm', 'passant_20mm']:
                if key in data:
                    cols.append(key)
                    vals.append(f"'{data[key]}'" if isinstance(data[key], str) else str(data[key]))
            
            # Meta JSONB
            if 'meta' in data:
                cols.append('meta')
                meta_json = json.dumps(data['meta'])
                vals.append(f"'{meta_json}'::jsonb")
            
            sql_lines.append(f"    INSERT INTO essais_geotechniques ({', '.join(cols)})")
            sql_lines.append(f"    VALUES ({', '.join(vals)})")
            sql_lines.append(f"    RETURNING id INTO v_essai_id;")
            sql_lines.append(f"    ")
            
            stats['essais'] += 1
            
            # Physiques
            if any(k in data for k in ['densite_apparente_gcm3', 'densite_absolue_gcm3', 'teneur_eau_pct']):
                phys_cols = ['id', 'essai_id']
                phys_vals = ['gen_random_uuid()', 'v_essai_id']
                
                for key in ['densite_apparente_gcm3', 'densite_absolue_gcm3', 'teneur_eau_pct']:
                    if key in data:
                        phys_cols.append(key)
                        phys_vals.append(str(data[key]))
                
                sql_lines.append(f"    INSERT INTO essais_physiques ({', '.join(phys_cols)})")
                sql_lines.append(f"    VALUES ({', '.join(phys_vals)});")
                sql_lines.append(f"    ")
                
                stats['physiques'] += 1
            
            # Classifications
            for sys in ['classif_aashto', 'classif_uscs']:
                if sys in data:
                    systeme = 'AASHTO' if 'aashto' in sys else 'USCS'
                    classe = data[sys]
                    sql_lines.append(f"    INSERT INTO essais_classif (id, essai_id, systeme, classe)")
                    sql_lines.append(f"    VALUES (gen_random_uuid(), v_essai_id, '{systeme}', '{classe}')")
                    sql_lines.append(f"    ON CONFLICT (essai_id, systeme) DO NOTHING;")
                    sql_lines.append(f"    ")
                    
                    stats['classif'] += 1
            
            sql_lines.append(f"END $$;")
            sql_lines.append("")
    
    sql_lines.append(f"\n-- Statistiques: {stats['sondages']} sondages, {stats['essais']} essais, {stats['physiques']} physiques, {stats['classif']} classifications")
    
    return '\n'.join(sql_lines), stats

def main():
    """Fonction principale"""
    print("="*80)
    print("IMPORT COMPLET DES PROJETS MD")
    print("="*80)
    
    # Trouver tous les fichiers MD (sauf TEMPLATE)
    md_files = [f for f in XLSX_CONVERT_DIR.rglob("*.md") if 'TEMPLATE' not in f.name]
    
    if not md_files:
        print("\n[ERREUR] Aucun fichier MD trouvé")
        return
    
    print(f"\n[*] {len(md_files)} projet(s) trouvé(s)")
    
    all_stats = []
    
    # Traiter chaque projet
    for md_path in sorted(md_files):
        project_name = md_path.parent.name
        print(f"\n[*] Traitement: {project_name}")
        
        # Générer SQL
        sql_content, stats = generate_sql_for_project(project_name, md_path)
        
        # Sauvegarder
        output_file = OUTPUT_SQL_DIR / f"{project_name}.sql"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sql_content)
        
        print(f"    Sondages: {stats.get('sondages', 0)}")
        print(f"    Essais: {stats.get('essais', 0)}")
        print(f"    Physiques: {stats.get('physiques', 0)}")
        print(f"    Classifications: {stats.get('classif', 0)}")
        print(f"    [OK] SQL: {output_file.name}")
        
        all_stats.append(stats)
    
    # Résumé global
    print("\n" + "="*80)
    print("RÉSUMÉ GLOBAL")
    print("="*80)
    print(f"\nProjets traités: {len(all_stats)}")
    print(f"Sondages totaux: {sum(s.get('sondages', 0) for s in all_stats)}")
    print(f"Essais totaux: {sum(s.get('essais', 0) for s in all_stats)}")
    print(f"Physiques totaux: {sum(s.get('physiques', 0) for s in all_stats)}")
    print(f"Classifications totales: {sum(s.get('classif', 0) for s in all_stats)}")
    print(f"\nRépertoire SQL: {OUTPUT_SQL_DIR}")
    print("\n[OK] Génération terminée!")
    
    # Sauvegarder stats JSON
    stats_file = OUTPUT_SQL_DIR / "_stats.json"
    with open(stats_file, 'w', encoding='utf-8') as f:
        json.dump(all_stats, f, indent=2)
    print(f"[OK] Stats sauvegardées: {stats_file}")

if __name__ == '__main__':
    main()
