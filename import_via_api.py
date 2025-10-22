#!/usr/bin/env python3
"""
Importer les données via l'API REST
"""

import csv
import requests
import json

API_URL = 'http://localhost:8000'
CSV_FILE = 'test_data_50_sondages.csv'

print(f"🚀 Import via API depuis {CSV_FILE}...")

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Grouper par sondage
sondages = {}
for row in rows:
    code = row['code']
    if code not in sondages:
        sondages[code] = {
            'code': code,
            'date': row.get('date'),
            'source': row.get('source'),
            'lat': float(row['lat']),
            'lon': float(row['lon']),
            'essais': []
        }
    
    sondages[code]['essais'].append({
        'depth_m': float(row['depth_m']),
        'passant_80um': float(row['passant_80um']) if row.get('passant_80um') else None,
        'passant_2mm': float(row['passant_2mm']) if row.get('passant_2mm') else None,
        'wl': float(row['wl']) if row.get('wl') else None,
        'wp': float(row['wp']) if row.get('wp') else None,
        'vbs': float(row['vbs']) if row.get('vbs') else None,
        'gamma_d_max': float(row['gamma_d_max']) if row.get('gamma_d_max') else None,
        'w_opt': float(row['w_opt']) if row.get('w_opt') else None,
        'eg': float(row['eg']) if row.get('eg') else None
    })

print(f"📍 {len(sondages)} sondages à importer")

imported = 0
for code, s in sondages.items():
    try:
        # Créer le sondage via API
        payload = {
            'code': s['code'],
            'date': s['date'],
            'source': s['source'],
            'lat': s['lat'],
            'lon': s['lon'],
            'location_mode': 'exact'
        }
        
        response = requests.post(f"{API_URL}/surveys", json=payload)
        
        if response.status_code in [200, 201]:
            imported += 1
            if imported % 10 == 0:
                print(f"  ⏳ {imported}/{len(sondages)} sondages...")
        else:
            print(f"  ❌ Erreur {code}: {response.status_code} - {response.text[:100]}")
    
    except Exception as e:
        print(f"  ❌ Exception {code}: {e}")

print(f"\n✅ Import terminé: {imported}/{len(sondages)} sondages")
print(f"\n⚠️  Note: Les essais géotechniques doivent être ajoutés séparément")
print(f"    L'API actuelle ne supporte pas l'import bulk complet")
