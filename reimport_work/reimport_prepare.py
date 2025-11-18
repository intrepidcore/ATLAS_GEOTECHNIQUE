#!/usr/bin/env python3
"""
Script de préparation Excel → CSV pour réimportation Atlas
Normalise les colonnes, types et formats pour PostgreSQL
"""

import pandas as pd
import re
import uuid
from pathlib import Path

# Configuration
IN = Path("atlas_import.xlsx")
OUT = Path("csv_ready")
OUT.mkdir(exist_ok=True)

# Mapping feuilles → tables cibles
sheets_map = {
    "public.sondages": "sondages",
    "public.echantillons": "echantillons", 
    "public.mailles": "mailles",
    "public.essais_atterberg": "essais_atterberg",
    "public.essais_classif": "essais_classif",
    "public.essais_geotechniques": "essais_geotechniques",
    "public.essais_physiques": "essais_physiques",
    "public.essais_proctor": "essais_proctor",
    "public.essais_vbs": "essais_vbs",
    "public.granulo_points": "granulo_points",
    "public.granulometrie_points": "granulometrie_points",
    "public.raw_lab_ags": "raw_lab_ags",
    "public.raw_lab_agt": "raw_lab_agt",
    "public.raw_lab_atterberg": "raw_lab_atterberg",
    "public.ref_types_essais": "ref_types_essais",
    "public.classifications": "classifications"
}

def snake_case(s):
    """Convertit en snake_case"""
    s = re.sub(r'[^0-9a-zA-Z]+', '_', s)
    s = re.sub(r'([a-z0-9])([A-Z])', r'\\1_\\2', s)
    return s.strip('_').lower()

def is_valid_uuid(val):
    """Vérifie si c'est un UUID valide"""
    if pd.isna(val) or val == '':
        return False
    try:
        uuid.UUID(str(val))
        return True
    except:
        return False

def normalize_dataframe(df, table_name):
    """Normalise un DataFrame pour l'import PostgreSQL"""
    
    # 1. Trim toutes les strings
    for col in df.columns:
        if df[col].dtype == 'object':
            df[col] = df[col].astype(str).str.strip()
    
    # 2. Normaliser noms colonnes
    df.columns = [snake_case(c) for c in df.columns]
    
    # 3. Remplacer valeurs vides/nulles
    df = df.replace({
        "": None, 
        "nan": None, 
        "NaN": None, 
        "NULL": None,
        "null": None
    })
    
    # 4. Traitement spécifique par table
    if table_name == "sondages":
        # Gérer les géométries
        if 'geom' in df.columns:
            df['geom_wkt'] = df['geom']
            df = df.drop('geom', axis=1)
        
        # Vérifier/générer UUIDs
        if 'id' in df.columns:
            # Générer UUID pour les lignes sans ID valide
            mask = ~df['id'].apply(is_valid_uuid)
            df.loc[mask, 'id'] = [str(uuid.uuid4()) for _ in range(mask.sum())]
        
        # Normaliser adm3_id en integer
        if 'adm3_id' in df.columns:
            df['adm3_id'] = pd.to_numeric(df['adm3_id'], errors='coerce')
    
    elif table_name == "echantillons":
        # Vérifier FK sondage_id
        if 'sondage_id' in df.columns:
            df = df[df['sondage_id'].apply(is_valid_uuid)]
    
    elif table_name == "essais_atterberg":
        # Calculer IP si WL et WP présents
        if 'wl' in df.columns and 'wp' in df.columns:
            df['wl'] = pd.to_numeric(df['wl'], errors='coerce')
            df['wp'] = pd.to_numeric(df['wp'], errors='coerce')
            df['ip_calculated'] = df['wl'] - df['wp']
    
    elif table_name == "ref_types_essais":
        # Ajouter colonne ID UUID si manquante
        if 'id' not in df.columns and 'code' in df.columns:
            df['id'] = [str(uuid.uuid4()) for _ in range(len(df))]
    
    # 5. Supprimer lignes complètement vides
    df = df.dropna(how='all')
    
    return df

def main():
    """Fonction principale"""
    print("🔄 Préparation Excel → CSV pour réimportation Atlas")
    print(f"📁 Fichier source: {IN}")
    print(f"📁 Dossier sortie: {OUT}")
    
    # Lire fichier Excel
    try:
        excel_file = pd.ExcelFile(IN, engine="openpyxl")
        print(f"📊 Feuilles disponibles: {excel_file.sheet_names}")
    except Exception as e:
        print(f"❌ Erreur lecture Excel: {e}")
        return
    
    # Traiter chaque feuille
    processed_count = 0
    
    for sheet_name in excel_file.sheet_names:
        if sheet_name not in sheets_map:
            print(f"⏭️  Feuille ignorée: {sheet_name}")
            continue
        
        table_name = sheets_map[sheet_name]
        print(f"\\n📋 Traitement: {sheet_name} → {table_name}")
        
        try:
            # Lire feuille
            df = pd.read_excel(IN, sheet_name=sheet_name, engine="openpyxl", dtype=str)
            print(f"   Lignes brutes: {len(df)}")
            
            # Normaliser
            df = normalize_dataframe(df, table_name)
            print(f"   Lignes nettoyées: {len(df)}")
            print(f"   Colonnes: {list(df.columns)}")
            
            # Sauvegarder CSV
            csv_path = OUT / f"{table_name}.csv"
            df.to_csv(csv_path, index=False, na_rep='', encoding='utf-8')
            print(f"   ✅ Sauvé: {csv_path}")
            
            processed_count += 1
            
        except Exception as e:
            print(f"   ❌ Erreur: {e}")
    
    print(f"\\n🎯 Résumé: {processed_count} fichiers CSV créés dans {OUT}")
    print("\\n📋 Prochaines étapes:")
    print("1. Vérifier les CSV dans ./csv_ready/")
    print("2. Exécuter clear_geotech_tables.sql")
    print("3. Lancer import_all_tables.sql")

if __name__ == "__main__":
    main()
