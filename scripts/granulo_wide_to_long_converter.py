#!/usr/bin/env python3
"""
Convertisseur de format granulo WIDE → LONG
Transforme les feuilles granulo_*_large en format compatible avec 02_import_excel.py

Usage:
    python granulo_wide_to_long_converter.py input.xlsx output.xlsx
"""

import pandas as pd
import sys
import re
from pathlib import Path


def convert_granulo_wide_to_long(df_wide: pd.DataFrame, method: str = 'tamisage') -> pd.DataFrame:
    """
    Convertit un DataFrame granulo au format WIDE en format LONG
    
    Format WIDE (entrée):
        sieve_mm | APEHEME@1.0 | APEHEME@1.5 | DZOGBECOPE@1.0
        ---------|-------------|-------------|----------------
        0.08     | 37.99       | 50.58       | 47.90
        0.16     | 47.18       | 58.41       | 58.70
    
    Format LONG (sortie):
        code_site | depth_m | sieve_mm | passing_pct | method
        ----------|---------|----------|-------------|----------
        APEHEME   | 1.0     | 0.08     | 37.99       | tamisage
        APEHEME   | 1.0     | 0.16     | 47.18       | tamisage
        APEHEME   | 1.5     | 0.08     | 50.58       | tamisage
    
    Args:
        df_wide: DataFrame au format wide
        method: 'tamisage' ou 'sedimento'
    
    Returns:
        DataFrame au format long
    """
    
    # Identifier la colonne des tamis (première colonne normalement)
    sieve_col = df_wide.columns[0]
    
    # Colonnes des échantillons (toutes sauf la première)
    sample_cols = df_wide.columns[1:]
    
    # Pivoter le DataFrame
    df_long = df_wide.melt(
        id_vars=[sieve_col],
        value_vars=sample_cols,
        var_name='sample_id',
        value_name='passing_pct'
    )
    
    # Renommer la colonne tamis
    df_long = df_long.rename(columns={sieve_col: 'sieve_mm'})
    
    # Parser les identifiants d'échantillons (format: CODE@PROFONDEUR)
    # Exemples: APEHEME@1.0, DZOGBECOPE@1.5
    pattern = r'^(.+?)@([\d.]+)$'
    
    def parse_sample_id(sample_id):
        match = re.match(pattern, str(sample_id))
        if match:
            return match.group(1), float(match.group(2))
        else:
            # Si le format ne matche pas, essayer de deviner
            parts = str(sample_id).split('@')
            if len(parts) == 2:
                try:
                    return parts[0], float(parts[1])
                except ValueError:
                    pass
            # Fallback: tout mettre dans code_site
            return str(sample_id), None
    
    df_long[['code_site', 'depth_m']] = df_long['sample_id'].apply(
        lambda x: pd.Series(parse_sample_id(x))
    )
    
    # Supprimer la colonne temporaire
    df_long = df_long.drop(columns=['sample_id'])
    
    # Supprimer les lignes avec NaN (cellules vides dans le wide)
    df_long = df_long.dropna(subset=['passing_pct'])
    
    # Ajouter la méthode
    df_long['method'] = method
    
    # Réorganiser les colonnes
    df_long = df_long[['code_site', 'depth_m', 'sieve_mm', 'passing_pct', 'method']]
    
    # Trier par code_site, depth_m, sieve_mm
    df_long = df_long.sort_values(['code_site', 'depth_m', 'sieve_mm']).reset_index(drop=True)
    
    return df_long


def convert_excel_file(input_path: str, output_path: str):
    """
    Convertit un fichier Excel avec feuilles granulo wide → long
    
    Args:
        input_path: Chemin du fichier Excel source
        output_path: Chemin du fichier Excel de sortie
    """
    
    print(f"📂 Lecture de {input_path}...")
    xl = pd.ExcelFile(input_path)
    
    # Dictionnaire pour stocker toutes les feuilles
    sheets_to_write = {}
    
    for sheet_name in xl.sheet_names:
        print(f"\n📄 Traitement de la feuille '{sheet_name}'...")
        
        df = pd.read_excel(xl, sheet_name)
        
        # Détecter si c'est une feuille granulo large
        if 'granulo' in sheet_name.lower() and 'large' in sheet_name.lower():
            print(f"   ✓ Feuille granulo WIDE détectée")
            
            # Déterminer la méthode
            if 'sediment' in sheet_name.lower():
                method = 'sedimento'
            else:
                method = 'tamisage'
            
            print(f"   → Méthode: {method}")
            print(f"   → Format original: {df.shape[0]} tamis × {df.shape[1]-1} échantillons")
            
            # Convertir
            df_long = convert_granulo_wide_to_long(df, method=method)
            
            print(f"   → Format converti: {len(df_long)} points (lignes)")
            print(f"   → Échantillons uniques: {df_long['code_site'].nunique()}")
            
            # Nouveau nom de feuille (enlever "_large")
            new_sheet_name = sheet_name.replace('_large', '_long')
            sheets_to_write[new_sheet_name] = df_long
        
        else:
            # Copier la feuille telle quelle
            print(f"   → Copie sans modification")
            sheets_to_write[sheet_name] = df
    
    # Écrire le fichier de sortie
    print(f"\n💾 Écriture de {output_path}...")
    with pd.ExcelWriter(output_path, engine='openpyxl') as writer:
        for sheet_name, df in sheets_to_write.items():
            df.to_excel(writer, sheet_name=sheet_name, index=False)
            print(f"   ✓ {sheet_name}: {len(df)} lignes")
    
    print(f"\n✅ Conversion terminée !")
    print(f"   Fichier de sortie: {output_path}")


def main():
    if len(sys.argv) != 3:
        print("Usage: python granulo_wide_to_long_converter.py input.xlsx output.xlsx")
        sys.exit(1)
    
    input_path = sys.argv[1]
    output_path = sys.argv[2]
    
    if not Path(input_path).exists():
        print(f"❌ Erreur: fichier '{input_path}' introuvable")
        sys.exit(1)
    
    convert_excel_file(input_path, output_path)


if __name__ == '__main__':
    main()
