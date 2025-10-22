#!/usr/bin/env python3
"""
Script de génération de données géotechniques de test
Génère 500 sondages avec tous les types d'essais possibles
Format CSV compatible avec l'import bulk
"""

import random
import csv
from datetime import datetime, timedelta

# Configuration
NUM_SONDAGES = 500
NUM_ESSAIS_PAR_SONDAGE = random.randint(3, 8)  # 3 à 8 essais par sondage

# Zones géographiques du Togo
REGIONS = {
    'Maritime': {'lat_range': (6.0, 6.5), 'lon_range': (1.0, 1.5)},
    'Plateaux': {'lat_range': (6.5, 7.5), 'lon_range': (0.8, 1.5)},
    'Centrale': {'lat_range': (7.5, 8.5), 'lon_range': (0.5, 1.5)},
    'Kara': {'lat_range': (8.5, 9.5), 'lon_range': (0.5, 1.5)},
    'Savanes': {'lat_range': (9.5, 11.0), 'lon_range': (0.0, 1.5)}
}

# Laboratoires
LABORATORIES = ['Lab A - Lomé', 'Lab B - Kara', 'Lab C - Sokodé', 'Lab D - Atakpamé', 'Lab E - Dapaong']

# Normes
NORMS = ['NF P94-051', 'NF P94-052', 'NF P94-057', 'ASTM D422', 'ASTM D4318']

# Types de sols avec paramètres réalistes
SOIL_TYPES = {
    'argileux': {
        'passant_80um': (60, 95),
        'passant_2mm': (85, 100),
        'passant_20mm': (95, 100),
        'wl': (40, 90),
        'wp': (20, 50),
        'vbs': (2.5, 8.0),
        'gamma_d_max': (15.0, 18.0),
        'w_opt': (18, 28),
        'eg': (2.0, 12.0),
        'weight': 0.25
    },
    'limoneux': {
        'passant_80um': (35, 65),
        'passant_2mm': (70, 95),
        'passant_20mm': (90, 100),
        'wl': (25, 45),
        'wp': (15, 30),
        'vbs': (1.0, 3.0),
        'gamma_d_max': (17.0, 19.0),
        'w_opt': (12, 20),
        'eg': (0.5, 3.0),
        'weight': 0.30
    },
    'sableux': {
        'passant_80um': (5, 30),
        'passant_2mm': (50, 85),
        'passant_20mm': (80, 100),
        'wl': (15, 30),
        'wp': (10, 20),
        'vbs': (0.0, 1.0),
        'gamma_d_max': (18.0, 21.0),
        'w_opt': (8, 14),
        'eg': (0.0, 0.8),
        'weight': 0.30
    },
    'graveleux': {
        'passant_80um': (0, 20),
        'passant_2mm': (20, 60),
        'passant_20mm': (60, 95),
        'wl': (None, None),  # Pas de limites d'Atterberg
        'wp': (None, None),
        'vbs': (0.0, 0.5),
        'gamma_d_max': (19.0, 22.0),
        'w_opt': (6, 10),
        'eg': (0.0, 0.3),
        'weight': 0.15
    }
}

def generate_value(range_tuple, decimals=2):
    """Générer une valeur aléatoire dans une plage"""
    if range_tuple[0] is None:
        return ''
    return round(random.uniform(range_tuple[0], range_tuple[1]), decimals)

def generate_date():
    """Générer une date aléatoire dans les 2 dernières années"""
    days_ago = random.randint(0, 730)
    date = datetime.now() - timedelta(days=days_ago)
    return date.strftime('%Y-%m-%d')

def select_soil_type():
    """Sélectionner un type de sol selon les poids"""
    types = list(SOIL_TYPES.keys())
    weights = [SOIL_TYPES[t]['weight'] for t in types]
    return random.choices(types, weights=weights)[0]

def generate_coordinates(region):
    """Générer des coordonnées dans une région"""
    lat_range = REGIONS[region]['lat_range']
    lon_range = REGIONS[region]['lon_range']
    
    lat = round(random.uniform(lat_range[0], lat_range[1]), 4)
    lon = round(random.uniform(lon_range[0], lon_range[1]), 4)
    
    return lat, lon

def generate_sondage_data():
    """Générer les données pour un sondage complet"""
    # Sélectionner région et coordonnées
    region = random.choice(list(REGIONS.keys()))
    lat, lon = generate_coordinates(region)
    
    # Informations générales
    code = f"TEST-{random.randint(1000, 9999)}-{random.randint(100, 999)}"
    date = generate_date()
    source = random.choice(LABORATORIES)
    laboratory = random.choice(LABORATORIES)
    norm = random.choice(NORMS)
    
    # Générer plusieurs essais pour ce sondage (différentes profondeurs)
    essais = []
    num_essais = random.randint(3, 8)
    
    for i in range(num_essais):
        # Profondeur croissante
        depth_m = round(1.0 + (i * random.uniform(1.5, 3.0)), 1)
        
        # Sélectionner type de sol (peut varier avec la profondeur)
        soil_type = select_soil_type()
        soil = SOIL_TYPES[soil_type]
        
        # Générer les paramètres
        passant_80um = generate_value(soil['passant_80um'], 1)
        passant_2mm = generate_value(soil['passant_2mm'], 1)
        passant_20mm = generate_value(soil['passant_20mm'], 1)
        wl = generate_value(soil['wl'], 1)
        wp = generate_value(soil['wp'], 1)
        vbs = generate_value(soil['vbs'], 2)
        gamma_d_max = generate_value(soil['gamma_d_max'], 2)
        w_opt = generate_value(soil['w_opt'], 1)
        proctor_type = random.choice(['normal', 'modifie']) if gamma_d_max else ''
        eg = generate_value(soil['eg'], 2)
        
        essai = {
            'code': code,
            'date': date,
            'source': source,
            'lat': lat,
            'lon': lon,
            'depth_m': depth_m,
            'passant_80um': passant_80um,
            'passant_2mm': passant_2mm,
            'passant_20mm': passant_20mm,
            'wl': wl,
            'wp': wp,
            'vbs': vbs,
            'gamma_d_max': gamma_d_max,
            'w_opt': w_opt,
            'proctor_type': proctor_type,
            'eg': eg,
            'laboratory': laboratory,
            'norm': norm
        }
        
        essais.append(essai)
    
    return essais

def generate_csv(filename='test_data_500_sondages.csv', num_sondages=500):
    """Générer le fichier CSV avec tous les sondages"""
    
    print(f"🚀 Génération de {num_sondages} sondages géotechniques...")
    
    # En-têtes CSV
    fieldnames = [
        'code', 'date', 'source', 'lat', 'lon', 'depth_m',
        'passant_80um', 'passant_2mm', 'passant_20mm',
        'wl', 'wp', 'vbs',
        'gamma_d_max', 'w_opt', 'proctor_type',
        'eg', 'laboratory', 'norm'
    ]
    
    all_essais = []
    
    # Générer les sondages
    for i in range(num_sondages):
        if (i + 1) % 50 == 0:
            print(f"  ⏳ Génération: {i + 1}/{num_sondages} sondages...")
        
        essais = generate_sondage_data()
        all_essais.extend(essais)
    
    # Écrire le CSV
    print(f"\n💾 Écriture du fichier {filename}...")
    
    with open(filename, 'w', newline='', encoding='utf-8') as csvfile:
        writer = csv.DictWriter(csvfile, fieldnames=fieldnames)
        writer.writeheader()
        writer.writerows(all_essais)
    
    # Statistiques
    total_essais = len(all_essais)
    avg_essais = total_essais / num_sondages
    
    print(f"\n✅ Génération terminée !")
    print(f"📊 Statistiques:")
    print(f"   • Sondages générés: {num_sondages}")
    print(f"   • Essais totaux: {total_essais}")
    print(f"   • Moyenne essais/sondage: {avg_essais:.1f}")
    print(f"   • Fichier: {filename}")
    print(f"   • Taille: {len(all_essais) * 200 / 1024:.1f} KB (estimé)")
    
    # Répartition par région
    print(f"\n🗺️  Répartition géographique:")
    region_counts = {}
    for essai in all_essais:
        lat = float(essai['lat'])
        for region, coords in REGIONS.items():
            if coords['lat_range'][0] <= lat <= coords['lat_range'][1]:
                region_counts[region] = region_counts.get(region, 0) + 1
                break
    
    for region, count in sorted(region_counts.items()):
        percentage = (count / total_essais) * 100
        print(f"   • {region}: {count} essais ({percentage:.1f}%)")
    
    print(f"\n📝 Pour importer:")
    print(f"   1. Ouvrez Atlas Géotechnique")
    print(f"   2. Cliquez sur 'Import CSV/Bulk'")
    print(f"   3. Sélectionnez le fichier {filename}")
    print(f"   4. Suivez le wizard en 5 étapes")
    print(f"\n🎉 Prêt à tester !")

if __name__ == '__main__':
    # Générer 500 sondages
    generate_csv('test_data_500_sondages.csv', NUM_SONDAGES)
    
    # Générer aussi une version plus petite pour tests rapides
    print(f"\n" + "="*60)
    print(f"Génération version test rapide (50 sondages)...")
    print(f"="*60 + "\n")
    generate_csv('test_data_50_sondages.csv', 50)
