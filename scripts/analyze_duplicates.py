#!/usr/bin/env python3
"""
Script d'analyse des doublons dans les sondages
Identifie les sondages avec des localités similaires mais des codes différents
"""

import requests
import json
from collections import defaultdict
from difflib import SequenceMatcher

def similarity(a, b):
    """Calcule la similarité entre deux chaînes (0-1)"""
    return SequenceMatcher(None, a.lower(), b.lower()).ratio()

def normalize_locality(locality):
    """Normalise une localité pour la comparaison"""
    if not locality:
        return ""
    return locality.lower().strip().replace('é', 'e').replace('è', 'e').replace('ê', 'e')

def analyze_duplicates():
    """Analyse les doublons potentiels"""
    
    # Récupérer tous les sondages
    print("📡 Récupération des sondages...")
    response = requests.get("http://localhost:8080/api/sondages?limit=1000")
    if response.status_code != 200:
        print(f"❌ Erreur API: {response.status_code}")
        return
    
    sondages = response.json()
    print(f"✅ {len(sondages)} sondages récupérés")
    
    # Grouper par localité normalisée
    locality_groups = defaultdict(list)
    
    for sondage in sondages:
        locality = normalize_locality(sondage.get('localite', ''))
        if locality:
            locality_groups[locality].append(sondage)
    
    # Identifier les doublons potentiels
    duplicates = []
    
    print("\n🔍 Analyse des doublons...")
    
    # Doublons exacts (même localité normalisée)
    for locality, group in locality_groups.items():
        if len(group) > 1:
            duplicates.append({
                'type': 'exact',
                'locality': locality,
                'count': len(group),
                'sondages': group
            })
    
    # Doublons similaires (localités proches)
    localities = list(locality_groups.keys())
    for i, loc1 in enumerate(localities):
        for loc2 in localities[i+1:]:
            sim = similarity(loc1, loc2)
            if sim > 0.8 and sim < 1.0:  # Très similaires mais pas identiques
                duplicates.append({
                    'type': 'similar',
                    'similarity': sim,
                    'localities': [loc1, loc2],
                    'sondages': locality_groups[loc1] + locality_groups[loc2]
                })
    
    # Afficher les résultats
    print(f"\n📊 Résultats de l'analyse:")
    print(f"   • {len([d for d in duplicates if d['type'] == 'exact'])} groupes de doublons exacts")
    print(f"   • {len([d for d in duplicates if d['type'] == 'similar'])} groupes de doublons similaires")
    
    # Détailler les doublons exacts
    exact_duplicates = [d for d in duplicates if d['type'] == 'exact']
    if exact_duplicates:
        print(f"\n🎯 Doublons exacts:")
        for dup in exact_duplicates:
            print(f"\n   📍 {dup['locality']} ({dup['count']} sondages):")
            for s in dup['sondages']:
                adm3 = s.get('adm3_name', 'N/A')
                source = s.get('source', 'N/A')[:30] + '...' if len(s.get('source', '')) > 30 else s.get('source', 'N/A')
                geocoded = '✅' if s.get('is_geocoded') else '❌'
                print(f"      • {s['code']} | {adm3} | {source} | {geocoded}")
    
    # Détailler les doublons similaires
    similar_duplicates = [d for d in duplicates if d['type'] == 'similar']
    if similar_duplicates:
        print(f"\n🔍 Doublons similaires (top 10):")
        similar_duplicates.sort(key=lambda x: x['similarity'], reverse=True)
        for dup in similar_duplicates[:10]:
            print(f"\n   📍 {dup['localities'][0]} ↔ {dup['localities'][1]} ({dup['similarity']:.2f}):")
            for s in dup['sondages']:
                adm3 = s.get('adm3_name', 'N/A')
                source = s.get('source', 'N/A')[:20] + '...' if len(s.get('source', '')) > 20 else s.get('source', 'N/A')
                print(f"      • {s['code']} | {s['localite']} | {adm3} | {source}")
    
    # Cas spéciaux mentionnés
    print(f"\n🎯 Cas spéciaux (Badomé/ASSAHOUN):")
    
    badome_variants = []
    assahoun_variants = []
    
    for sondage in sondages:
        locality = sondage.get('localite', '').lower()
        if 'badom' in locality:
            badome_variants.append(sondage)
        elif 'assahoun' in locality:
            assahoun_variants.append(sondage)
    
    if badome_variants:
        print(f"\n   📍 Variantes Badomé ({len(badome_variants)} sondages):")
        for s in badome_variants:
            coords = f"({s['geom']['coordinates'][0]:.6f}, {s['geom']['coordinates'][1]:.6f})" if s.get('geom') else "No coords"
            print(f"      • {s['code']} | {s['localite']} | {s.get('adm3_name', 'N/A')} | {coords}")
    
    if assahoun_variants:
        print(f"\n   📍 Variantes Assahoun ({len(assahoun_variants)} sondages):")
        for s in assahoun_variants:
            coords = f"({s['geom']['coordinates'][0]:.6f}, {s['geom']['coordinates'][1]:.6f})" if s.get('geom') else "No coords"
            print(f"      • {s['code']} | {s['localite']} | {s.get('adm3_name', 'N/A')} | {coords}")
    
    # Recommandations
    print(f"\n💡 Recommandations:")
    print(f"   1. Vérifier les doublons exacts - possibles erreurs de saisie")
    print(f"   2. Harmoniser les variantes (Badomé vs BADOME, Assahoun vs ASSAHOUN)")
    print(f"   3. Vérifier les coordonnées des doublons - distances géographiques")
    print(f"   4. Considérer fusion ou marquage des doublons confirmés")

if __name__ == "__main__":
    analyze_duplicates()
