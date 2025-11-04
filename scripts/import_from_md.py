"""
Script d'import manuel des données depuis les fichiers MD
Génère des scripts SQL pour importer les données dans la base Atlas
"""

import re
from pathlib import Path
from typing import List, Dict, Tuple
import json

# Configuration
XLSX_CONVERT_DIR = Path("data/xlsx_convert")
OUTPUT_SQL_DIR = Path("sql/imports_manual")
OUTPUT_SQL_DIR.mkdir(parents=True, exist_ok=True)

def parse_md_table(lines: List[str]) -> Tuple[List[str], List[List[str]]]:
    """Parse un tableau Markdown et retourne (headers, rows)"""
    if len(lines) < 2:
        return [], []
    
    # Ligne 1 = headers
    headers = [h.strip() for h in lines[0].split('|')[1:-1]]
    
    # Ligne 2 = séparateur (ignorer)
    # Lignes 3+ = données
    rows = []
    for line in lines[2:]:
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
    """Identifie le type de données (granulo, atterberg, vbs, etc.)"""
    section_lower = section_name.lower() if section_name else ''
    headers_str = ' '.join(headers).lower()
    
    if 'agt' in section_lower or 'ags' in section_lower or 'granulo' in section_lower:
        return 'granulometrie'
    elif 'limite' in section_lower or 'atterberg' in section_lower or 'wl' in headers_str or 'wp' in headers_str:
        return 'atterberg'
    elif 'bleu' in section_lower or 'vbs' in headers_str or 'methylene' in headers_str:
        return 'vbs'
    elif 'densit' in section_lower:
        return 'densite'
    elif 'teneur' in section_lower and 'eau' in section_lower:
        return 'teneur_eau'
    elif 'classification' in section_lower:
        return 'classification'
    else:
        return 'unknown'

def generate_sql_for_project(project_name: str, md_path: Path) -> str:
    """Génère le script SQL pour un projet"""
    tables = extract_tables_from_md(md_path)
    
    if not tables:
        return f"-- Aucune donnée trouvée dans {project_name}\n"
    
    sql_lines = []
    sql_lines.append(f"-- Import manuel: {project_name}")
    sql_lines.append(f"-- Source: {md_path.name}")
    sql_lines.append(f"-- Date: {md_path.stat().st_mtime}")
    sql_lines.append(f"-- Nombre de tableaux: {len(tables)}\n")
    
    for idx, table in enumerate(tables, 1):
        data_type = identify_data_type(table['section'], table['headers'])
        
        sql_lines.append(f"\n-- Tableau {idx}: {table['section']} (Type: {data_type})")
        sql_lines.append(f"-- Headers: {', '.join(table['headers'])}")
        sql_lines.append(f"-- Lignes: {len(table['rows'])}\n")
        
        if data_type == 'atterberg':
            sql_lines.extend(generate_atterberg_sql(project_name, table))
        elif data_type == 'vbs':
            sql_lines.extend(generate_vbs_sql(project_name, table))
        elif data_type == 'granulometrie':
            sql_lines.extend(generate_granulo_sql(project_name, table))
        else:
            sql_lines.append(f"-- Type '{data_type}' non implémenté pour l'instant\n")
    
    return '\n'.join(sql_lines)

def generate_atterberg_sql(project_name: str, table: Dict) -> List[str]:
    """Génère SQL pour données Atterberg"""
    sql = []
    sql.append("-- TODO: Implémenter import Atterberg")
    sql.append(f"-- Projet: {project_name}")
    sql.append(f"-- Section: {table['section']}")
    return sql

def generate_vbs_sql(project_name: str, table: Dict) -> List[str]:
    """Génère SQL pour données VBS"""
    sql = []
    sql.append("-- TODO: Implémenter import VBS")
    sql.append(f"-- Projet: {project_name}")
    sql.append(f"-- Section: {table['section']}")
    return sql

def generate_granulo_sql(project_name: str, table: Dict) -> List[str]:
    """Génère SQL pour données Granulométrie"""
    sql = []
    sql.append("-- TODO: Implémenter import Granulométrie")
    sql.append(f"-- Projet: {project_name}")
    sql.append(f"-- Section: {table['section']}")
    return sql

def main():
    """Fonction principale"""
    print("="*70)
    print("IMPORT MANUEL DEPUIS FICHIERS MD")
    print("="*70)
    
    # Trouver tous les fichiers MD
    md_files = list(XLSX_CONVERT_DIR.rglob("*.md"))
    
    if not md_files:
        print("\n[ERREUR] Aucun fichier MD trouvé")
        return
    
    print(f"\n[*] {len(md_files)} fichier(s) MD trouvé(s)")
    
    # Traiter chaque fichier
    for md_path in md_files:
        project_name = md_path.parent.name
        print(f"\n[*] Traitement: {project_name}")
        
        # Extraire tables
        tables = extract_tables_from_md(md_path)
        print(f"    Tableaux trouvés: {len(tables)}")
        
        # Analyser types de données
        data_types = {}
        for table in tables:
            dtype = identify_data_type(table['section'], table['headers'])
            data_types[dtype] = data_types.get(dtype, 0) + 1
        
        print(f"    Types de données: {data_types}")
        
        # Générer SQL
        sql_content = generate_sql_for_project(project_name, md_path)
        
        # Sauvegarder
        output_file = OUTPUT_SQL_DIR / f"{project_name}.sql"
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(sql_content)
        
        print(f"    [OK] SQL généré: {output_file.name}")
    
    print("\n" + "="*70)
    print("RÉSUMÉ")
    print("="*70)
    print(f"\nFichiers traités: {len(md_files)}")
    print(f"Scripts SQL générés: {len(list(OUTPUT_SQL_DIR.glob('*.sql')))}")
    print(f"\nRépertoire de sortie: {OUTPUT_SQL_DIR}")
    print("\n[OK] Analyse terminée!")

if __name__ == '__main__':
    main()
