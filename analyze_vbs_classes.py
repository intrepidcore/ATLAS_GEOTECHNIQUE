#!/usr/bin/env python3
"""
Script d'analyse des classes VBS via l'API
Objectif: Comprendre pourquoi 4 couleurs à l'écran mais 2 classes dans l'export

Breaks VBS par défaut: [0.2, 1.5, 2.5, 6, 8]
Classes:
  - ≤ 0.2 (rouge)
  - 0.2 - 1.5 (orange)
  - 1.5 - 2.5 (jaune)
  - 2.5 - 6.0 (vert clair)
  - 6.0 - 8.0 (vert)
  - > 8.0 (vert foncé)
"""

import requests
import json
from collections import defaultdict

API_BASE = "http://localhost:8000"

# Breaks VBS (même que dans le code frontend)
VBS_BREAKS = [0.2, 1.5, 2.5, 6, 8]
VBS_LABELS = ['≤ 0.2', '0.2 - 1.5', '1.5 - 2.5', '2.5 - 6.0', '6.0 - 8.0', '> 8.0']
VBS_COLORS = ['#e74c3c', '#f39c12', '#f1c40f', '#9acd32', '#27ae60', '#1e8449']

def get_class_index(value, breaks):
    """Retourne l'index de la classe pour une valeur donnée"""
    if value is None:
        return None
    for i, b in enumerate(breaks):
        if value <= b:
            return i
    return len(breaks)  # Dernière classe (> dernier break)

def main():
    print("=" * 60)
    print("ANALYSE DES CLASSES VBS - Atlas Géotechnique")
    print("=" * 60)
    
    try:
        # 1. Récupérer les données thématiques VBS via l'API
        print("\n1. DONNÉES THÉMATIQUES VBS (API /thematic/data)")
        print("-" * 40)
        
        url = f"{API_BASE}/thematic/data?parameter=vbs_avg&include_geometry=true&min_sondages=1"
        print(f"URL: {url}")
        
        response = requests.get(url)
        if response.status_code != 200:
            print(f"Erreur API: {response.status_code}")
            return
        
        data = response.json()
        features = data.get('features', [])
        print(f"Total features retournées: {len(features)}")
        
        # Analyser la distribution par classe
        class_counts = defaultdict(list)
        all_values = []
        
        for f in features:
            props = f.get('properties', {})
            value = props.get('value') or props.get('vbs_avg')
            code = props.get('code') or props.get('grid_id')
            n_sondages = props.get('n_sondages', 0)
            
            if value is not None:
                all_values.append(value)
                class_idx = get_class_index(value, VBS_BREAKS)
                class_counts[class_idx].append({
                    'code': code,
                    'vbs': value,
                    'n_sondages': n_sondages
                })
        
        print(f"Features avec valeur VBS: {len(all_values)}")
        
        print("\n2. DISTRIBUTION PAR CLASSE (TOUTES RÉGIONS)")
        print("-" * 40)
        
        for i, label in enumerate(VBS_LABELS):
            cells = class_counts.get(i, [])
            count = len(cells)
            color = VBS_COLORS[i]
            print(f"  Classe {i}: {label:12s} | {count:3d} mailles | Couleur: {color}")
            if cells:
                values = [c['vbs'] for c in cells]
                print(f"           Valeurs: min={min(values):.2f}, max={max(values):.2f}")
                for c in cells[:3]:  # Afficher les 3 premières
                    print(f"             - {c['code']}: VBS={c['vbs']:.2f}")
        
        # 3. Statistiques globales
        print("\n3. STATISTIQUES GLOBALES")
        print("-" * 40)
        if all_values:
            print(f"  Min: {min(all_values):.2f} g/100g")
            print(f"  Max: {max(all_values):.2f} g/100g")
            print(f"  Moyenne: {sum(all_values)/len(all_values):.2f} g/100g")
            
            # Compter les classes utilisées
            used_classes = [i for i in range(len(VBS_LABELS)) if class_counts.get(i)]
            print(f"  Classes utilisées: {len(used_classes)} / {len(VBS_LABELS)}")
            print(f"  Indices: {used_classes}")
        
        # 4. Récupérer le GeoJSON ADM pour Zio
        print("\n4. ANALYSE GÉOGRAPHIQUE - FILTRAGE ZIO")
        print("-" * 40)
        
        # Récupérer le polygone Zio
        adm_url = f"{API_BASE}/adm-geojson?level=adm2&name=Zio"
        adm_response = requests.get(adm_url)
        
        if adm_response.status_code == 200:
            adm_data = adm_response.json()
            print(f"Polygone Zio récupéré")
            
            # Extraire les coordonnées du polygone
            adm_features = adm_data.get('features', [])
            if adm_features:
                adm_geom = adm_features[0].get('geometry', {})
                coords = adm_geom.get('coordinates', [])
                if coords:
                    # Polygone simple ou MultiPolygon
                    if adm_geom.get('type') == 'MultiPolygon':
                        polygon = coords[0][0]  # Premier polygone, anneau extérieur
                    else:
                        polygon = coords[0]  # Anneau extérieur
                    
                    print(f"  Points du polygone: {len(polygon)}")
                    
                    # Calculer le bbox
                    lngs = [p[0] for p in polygon]
                    lats = [p[1] for p in polygon]
                    print(f"  Bbox: [{min(lngs):.4f}, {min(lats):.4f}] - [{max(lngs):.4f}, {max(lats):.4f}]")
                    
                    # Filtrer les features par centroïde dans le polygone
                    def point_in_polygon(point, polygon):
                        """Ray casting algorithm"""
                        x, y = point
                        n = len(polygon)
                        inside = False
                        j = n - 1
                        for i in range(n):
                            xi, yi = polygon[i]
                            xj, yj = polygon[j]
                            if ((yi > y) != (yj > y)) and (x < (xj - xi) * (y - yi) / (yj - yi) + xi):
                                inside = not inside
                            j = i
                        return inside
                    
                    def compute_centroid(geometry):
                        """Calcule le centroïde d'une géométrie"""
                        geom_type = geometry.get('type')
                        coords = geometry.get('coordinates', [])
                        
                        if geom_type == 'Polygon' and coords:
                            ring = coords[0]
                            if ring:
                                lngs = [p[0] for p in ring]
                                lats = [p[1] for p in ring]
                                return (sum(lngs) / len(lngs), sum(lats) / len(lats))
                        elif geom_type == 'MultiPolygon' and coords:
                            ring = coords[0][0]
                            if ring:
                                lngs = [p[0] for p in ring]
                                lats = [p[1] for p in ring]
                                return (sum(lngs) / len(lngs), sum(lats) / len(lats))
                        return None
                    
                    # Filtrer les features
                    zio_features = []
                    for f in features:
                        geom = f.get('geometry')
                        if geom:
                            centroid = compute_centroid(geom)
                            if centroid and point_in_polygon(centroid, polygon):
                                zio_features.append(f)
                    
                    print(f"\n  Features dans Zio (par centroïde): {len(zio_features)}")
                    
                    # Distribution dans Zio
                    zio_class_counts = defaultdict(list)
                    zio_values = []
                    
                    for f in zio_features:
                        props = f.get('properties', {})
                        value = props.get('value') or props.get('vbs_avg')
                        code = props.get('code') or props.get('grid_id')
                        
                        if value is not None:
                            zio_values.append(value)
                            class_idx = get_class_index(value, VBS_BREAKS)
                            zio_class_counts[class_idx].append({
                                'code': code,
                                'vbs': value
                            })
                    
                    print("\n5. DISTRIBUTION PAR CLASSE DANS ZIO")
                    print("-" * 40)
                    
                    for i, label in enumerate(VBS_LABELS):
                        cells = zio_class_counts.get(i, [])
                        count = len(cells)
                        color = VBS_COLORS[i]
                        if count > 0:
                            print(f"  Classe {i}: {label:12s} | {count:3d} mailles | Couleur: {color}")
                            values = [c['vbs'] for c in cells]
                            print(f"           Valeurs: min={min(values):.2f}, max={max(values):.2f}")
                            for c in cells:
                                print(f"             - {c['code']}: VBS={c['vbs']:.2f}")
                    
                    # Compter les classes utilisées dans Zio
                    zio_used_classes = [i for i in range(len(VBS_LABELS)) if zio_class_counts.get(i)]
                    print(f"\n  Classes utilisées dans Zio: {len(zio_used_classes)} / {len(VBS_LABELS)}")
                    print(f"  Indices: {zio_used_classes}")
                    
                    if zio_values:
                        print(f"\n  Stats Zio:")
                        print(f"    Min: {min(zio_values):.2f} g/100g")
                        print(f"    Max: {max(zio_values):.2f} g/100g")
                        print(f"    Moyenne: {sum(zio_values)/len(zio_values):.2f} g/100g")
        
        print("\n" + "=" * 60)
        print("CONCLUSION")
        print("=" * 60)
        print("""
Les classes sont définies par les breaks: [0.2, 1.5, 2.5, 6, 8]

HYPOTHÈSE:
- L'écran affiche les mailles de Maritime (66 features) avec 4+ classes
- L'export filtre par polygone Zio → moins de mailles → moins de classes

VÉRIFICATION:
- Si Zio n'a que 2 classes, c'est normal que l'export n'en montre que 2
- La légende de l'export n'affiche que les classes présentes dans la zone
""")
        
    except Exception as e:
        print(f"Erreur: {e}")
        import traceback
        traceback.print_exc()

if __name__ == '__main__':
    main()
