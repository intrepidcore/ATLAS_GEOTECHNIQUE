#!/usr/bin/env python3
"""Trouve les ADM3 correspondant aux localités des sondages"""

import pandas as pd
import psycopg
from pathlib import Path

# Connexion DB
conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

# Fichiers à analyser
files = [
    "data/xlsx/IMPORT/atlas_import_nicabou_ninsao_vianney.xlsx",
    "data/xlsx/IMPORT/atlas_import_soglo_ferdinand.xlsx"
]

print("="*80)
print("RECHERCHE ADM3 DEPUIS LOCALITÉS")
print("="*80)

# Charger les ADM3 disponibles
cur = conn.execute("""
    SELECT adm3_pcode, adm3_fr, adm2_fr, adm1_fr 
    FROM adm3 
    ORDER BY adm3_fr
""")
adm3_list = cur.fetchall()
print(f"\n{len(adm3_list)} ADM3 disponibles en base")

# Créer un dictionnaire de recherche (insensible à la casse, sans accents)
import unicodedata

def normalize(text):
    """Normalise le texte : minuscules, sans accents"""
    if not text:
        return ""
    text = str(text).lower().strip()
    # Supprimer les accents
    text = ''.join(c for c in unicodedata.normalize('NFD', text) 
                   if unicodedata.category(c) != 'Mn')
    return text

# Index ADM3 par nom normalisé
adm3_index = {}
for pcode, name_fr, adm2, adm1 in adm3_list:
    norm_name = normalize(name_fr)
    if norm_name:
        adm3_index[norm_name] = {
            'pcode': pcode,
            'name': name_fr,
            'adm2': adm2,
            'adm1': adm1
        }

print(f"Index créé avec {len(adm3_index)} entrées")

# Analyser chaque fichier
all_matches = []

for file_rel in files:
    file_path = Path("c:/PROJET_ATLAS_MASTER/atlas") / file_rel
    
    print(f"\n{'='*80}")
    print(f"📁 {file_path.name}")
    print(f"{'='*80}")
    
    df = pd.read_excel(file_path, sheet_name="sondages")
    
    for idx, row in df.iterrows():
        code = row.get('code_site', 'N/A')
        localite = row.get('localite', '')
        
        if not localite or pd.isna(localite):
            print(f"  ⊘ {code}: pas de localité")
            continue
        
        # Normaliser et chercher
        norm_localite = normalize(localite)
        
        if norm_localite in adm3_index:
            match = adm3_index[norm_localite]
            print(f"  ✓ {code}: '{localite}' → {match['pcode']} ({match['name']}, {match['adm2']})")
            all_matches.append({
                'file': file_path.name,
                'code_site': code,
                'localite': localite,
                'adm3_pcode': match['pcode'],
                'adm3_name': match['name'],
                'adm2': match['adm2'],
                'adm1': match['adm1']
            })
        else:
            # Recherche fuzzy (similarité)
            from difflib import get_close_matches
            candidates = get_close_matches(norm_localite, adm3_index.keys(), n=3, cutoff=0.6)
            
            if candidates:
                best = adm3_index[candidates[0]]
                print(f"  ~ {code}: '{localite}' → FUZZY: {best['pcode']} ({best['name']}) [score ~{int(100*0.6)}%]")
                all_matches.append({
                    'file': file_path.name,
                    'code_site': code,
                    'localite': localite,
                    'adm3_pcode': best['pcode'],
                    'adm3_name': best['name'],
                    'adm2': best['adm2'],
                    'adm1': best['adm1'],
                    'match_type': 'fuzzy'
                })
            else:
                print(f"  ✗ {code}: '{localite}' → AUCUN MATCH")

conn.close()

# Résumé
print(f"\n{'='*80}")
print(f"RÉSUMÉ")
print(f"{'='*80}")
print(f"Total matches: {len(all_matches)}")

if all_matches:
    print("\nMatches trouvés:")
    for m in all_matches:
        match_type = m.get('match_type', 'exact')
        symbol = '~' if match_type == 'fuzzy' else '✓'
        print(f"  {symbol} {m['code_site']}: {m['localite']} → {m['adm3_pcode']} ({m['adm3_name']})")

# Sauvegarder les matches
import json
with open('adm3_matches.json', 'w', encoding='utf-8') as f:
    json.dump(all_matches, f, indent=2, ensure_ascii=False)

print(f"\n✓ Résultats sauvegardés dans adm3_matches.json")
