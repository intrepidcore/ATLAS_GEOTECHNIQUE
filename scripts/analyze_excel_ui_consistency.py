#!/usr/bin/env python3
"""
Script d'analyse de cohérence entre données Excel importées et affichage UI
Vérifie la correspondance entre les champs mappés lors de l'import et l'affichage dans les détails
"""

import requests
import json
from typing import Dict, List, Any

def get_sample_surveys():
    """Récupère un échantillon de sondages avec détails"""
    try:
        response = requests.get("http://localhost:8080/api/sondages?limit=10")
        if response.status_code != 200:
            print(f"❌ Erreur API sondages: {response.status_code}")
            return []
        
        surveys = response.json()
        print(f"✅ {len(surveys)} sondages récupérés")
        
        # Récupérer les détails pour quelques sondages
        detailed_surveys = []
        for survey in surveys[:5]:  # Limiter à 5 pour l'analyse
            try:
                detail_response = requests.get(f"http://localhost:8080/api/sondages/{survey['id']}/details")
                if detail_response.status_code == 200:
                    detailed_surveys.append(detail_response.json())
            except Exception as e:
                print(f"⚠️ Erreur détails pour {survey.get('code', 'N/A')}: {e}")
        
        return detailed_surveys
    except Exception as e:
        print(f"❌ Erreur récupération sondages: {e}")
        return []

def analyze_field_mapping():
    """Analyse les champs mappés dans les wizards d'import"""
    
    # Champs requis selon les wizards d'import (basé sur le code source)
    import_fields = {
        'core_fields': [
            'code', 'localite', 'latitude', 'longitude', 'source'
        ],
        'optional_fields': [
            'adm1', 'adm2', 'adm3', 'description', 'date_creation',
            'profondeur_max', 'type_sondage'
        ],
        'atterberg_fields': [
            'depth_m', 'wl', 'wp', 'ip'
        ],
        'granulometrie_fields': [
            'depth_m', 'gravel_percent', 'sand_percent', 'silt_percent', 'clay_percent'
        ],
        'spt_fields': [
            'depth_m', 'n_value', 'energy_ratio'
        ]
    }
    
    return import_fields

def analyze_ui_display_fields():
    """Analyse les champs affichés dans l'UI des détails"""
    
    # Champs affichés dans l'UI selon le code source (renderDetailsContent)
    ui_display_fields = {
        'localisation': [
            'localite', 'adm3_name', 'is_geocoded', 'coordinates'
        ],
        'metadonnees': [
            'source', 'created_at', 'code'
        ],
        'essais_atterberg': [
            'depth_m', 'wl', 'wp', 'ip'
        ],
        'essais_granulometrie': [
            'depth_m', 'gravel_percent', 'sand_percent', 'silt_percent', 'clay_percent'
        ],
        'essais_spt': [
            'depth_m', 'n_value', 'energy_ratio'
        ]
    }
    
    return ui_display_fields

def compare_field_consistency():
    """Compare la cohérence entre import et affichage"""
    
    import_fields = analyze_field_mapping()
    ui_fields = analyze_ui_display_fields()
    
    print("\n🔍 ANALYSE DE COHÉRENCE IMPORT ↔ UI")
    print("=" * 50)
    
    # Vérifier la cohérence des champs principaux
    print("\n📋 Champs principaux:")
    core_import = set(import_fields['core_fields'])
    ui_location = set(ui_fields['localisation'])
    ui_meta = set(ui_fields['metadonnees'])
    ui_all_main = ui_location.union(ui_meta)
    
    # Mapping des noms de champs
    field_mapping = {
        'latitude': 'coordinates',
        'longitude': 'coordinates',
        'adm3': 'adm3_name',
        'date_creation': 'created_at'
    }
    
    print(f"   Import: {sorted(core_import)}")
    print(f"   UI: {sorted(ui_all_main)}")
    
    # Champs manquants dans l'UI
    missing_in_ui = []
    for field in core_import:
        mapped_field = field_mapping.get(field, field)
        if mapped_field not in ui_all_main and field not in ['latitude', 'longitude']:
            missing_in_ui.append(field)
    
    if missing_in_ui:
        print(f"   ⚠️ Manquants dans UI: {missing_in_ui}")
    else:
        print("   ✅ Cohérence OK")
    
    # Vérifier les essais géotechniques
    print("\n🧪 Essais géotechniques:")
    for test_type in ['atterberg', 'granulometrie', 'spt']:
        import_test = set(import_fields.get(f'{test_type}_fields', []))
        ui_test = set(ui_fields.get(f'essais_{test_type}', []))
        
        print(f"   {test_type.title()}:")
        print(f"     Import: {sorted(import_test)}")
        print(f"     UI: {sorted(ui_test)}")
        
        if import_test == ui_test:
            print("     ✅ Cohérence parfaite")
        else:
            missing = import_test - ui_test
            extra = ui_test - import_test
            if missing:
                print(f"     ⚠️ Manquants dans UI: {missing}")
            if extra:
                print(f"     ℹ️ Supplémentaires dans UI: {extra}")

def analyze_data_consistency():
    """Analyse la cohérence des données réelles"""
    
    surveys = get_sample_surveys()
    if not surveys:
        print("❌ Impossible d'analyser les données réelles")
        return
    
    print(f"\n📊 ANALYSE DES DONNÉES RÉELLES ({len(surveys)} échantillons)")
    print("=" * 50)
    
    # Analyser la structure des données
    field_presence = {}
    field_types = {}
    
    for survey in surveys:
        for key, value in survey.items():
            if key not in field_presence:
                field_presence[key] = 0
                field_types[key] = set()
            
            if value is not None:
                field_presence[key] += 1
                field_types[key].add(type(value).__name__)
    
    print("\n📈 Présence des champs:")
    for field, count in sorted(field_presence.items()):
        percentage = (count / len(surveys)) * 100
        types = ', '.join(field_types[field])
        status = "✅" if percentage == 100 else "⚠️" if percentage >= 50 else "❌"
        print(f"   {status} {field}: {count}/{len(surveys)} ({percentage:.0f}%) - Types: {types}")
    
    # Analyser les essais géotechniques
    print("\n🧪 Essais géotechniques:")
    test_types = ['atterberg', 'granulometrie', 'spt']
    
    for test_type in test_types:
        has_tests = sum(1 for s in surveys if s.get(test_type) and len(s[test_type]) > 0)
        total_tests = sum(len(s.get(test_type, [])) for s in surveys)
        print(f"   {test_type.title()}: {has_tests}/{len(surveys)} sondages ont des essais ({total_tests} essais total)")
        
        # Analyser la structure des essais
        if total_tests > 0:
            sample_test = None
            for s in surveys:
                if s.get(test_type) and len(s[test_type]) > 0:
                    sample_test = s[test_type][0]
                    break
            
            if sample_test:
                print(f"     Champs disponibles: {list(sample_test.keys())}")

def generate_ui_recommendations():
    """Génère des recommandations pour améliorer l'UI"""
    
    print(f"\n💡 RECOMMANDATIONS POUR L'HARMONISATION UI")
    print("=" * 50)
    
    recommendations = [
        {
            "category": "🎨 Amélioration visuelle",
            "items": [
                "Ajouter des icônes cohérentes pour chaque type de donnée",
                "Utiliser des badges colorés pour les statuts (géocodé/non-géocodé)",
                "Améliorer la lisibilité des tableaux d'essais",
                "Ajouter des graphiques pour visualiser les essais géotechniques"
            ]
        },
        {
            "category": "📊 Complétude des données",
            "items": [
                "Afficher tous les champs importés (même si vides)",
                "Ajouter une section 'Données manquantes' avec suggestions",
                "Montrer l'historique des modifications",
                "Afficher la source d'import (fichier Excel original)"
            ]
        },
        {
            "category": "🔄 Cohérence import/affichage",
            "items": [
                "Mapper correctement latitude/longitude → coordinates",
                "Harmoniser les noms de champs (adm3 → adm3_name)",
                "Afficher les champs optionnels s'ils sont présents",
                "Ajouter validation visuelle des données importées"
            ]
        },
        {
            "category": "⚡ Fonctionnalités avancées",
            "items": [
                "Permettre l'édition inline des champs",
                "Ajouter export vers Excel avec même structure",
                "Intégrer aperçu carte dans les détails",
                "Ajouter comparaison avec données similaires"
            ]
        }
    ]
    
    for rec in recommendations:
        print(f"\n{rec['category']}:")
        for item in rec['items']:
            print(f"   • {item}")

def main():
    """Fonction principale d'analyse"""
    
    print("🔍 ANALYSE COHÉRENCE EXCEL ↔ UI")
    print("=" * 50)
    print("Analyse de la cohérence entre les données Excel importées")
    print("et leur affichage dans l'interface utilisateur")
    
    # Analyser la cohérence des champs
    compare_field_consistency()
    
    # Analyser les données réelles
    analyze_data_consistency()
    
    # Générer les recommandations
    generate_ui_recommendations()
    
    print(f"\n✅ Analyse terminée")

if __name__ == "__main__":
    main()
