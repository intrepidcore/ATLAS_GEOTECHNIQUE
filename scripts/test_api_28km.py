#!/usr/bin/env python3
"""
Script pour tester l'endpoint API GET /coverage/mailles?grid=28km
"""
import requests
import json
import sys

API_BASE_URL = "http://localhost:8000"

def test_endpoint(grid_type: str):
    """Teste l'endpoint /coverage/mailles."""
    url = f"{API_BASE_URL}/coverage/mailles"
    params = {"grid": grid_type}
    
    print(f"\n{'='*70}")
    print(f"TEST: GET {url}?grid={grid_type}")
    print(f"{'='*70}")
    
    try:
        response = requests.get(url, params=params, timeout=10)
        
        print(f"Status: {response.status_code}")
        
        if response.status_code == 200:
            data = response.json()
            
            if "type" in data and data["type"] == "FeatureCollection":
                feature_count = len(data.get("features", []))
                print(f"✅ GeoJSON FeatureCollection reçu")
                print(f"   Nombre de features: {feature_count}")
                
                if feature_count > 0:
                    # Analyser la première feature
                    first = data["features"][0]
                    print(f"\n📋 Première feature:")
                    print(f"   Type: {first.get('geometry', {}).get('type')}")
                    print(f"   Properties: {list(first.get('properties', {}).keys())}")
                    
                    # Compter les profils si grid=28km
                    if grid_type == "28km" and "profil_num" in first.get("properties", {}):
                        profils = set(f.get("properties", {}).get("profil_num") for f in data["features"])
                        print(f"   Profils distincts: {len(profils)} (de {min(profils)} à {max(profils)})")
                    
                    return True
                else:
                    print(f"⚠️  FeatureCollection vide (0 features)")
                    print(f"   → La table atlas.maille_{grid_type} est probablement vide")
                    return False
            else:
                print(f"⚠️  Réponse inattendue:")
                print(json.dumps(data, indent=2)[:500])
                return False
        else:
            print(f"❌ Erreur HTTP {response.status_code}")
            print(f"   {response.text[:200]}")
            return False
            
    except requests.exceptions.ConnectionError:
        print(f"❌ Impossible de se connecter à {API_BASE_URL}")
        print(f"   → Vérifier que l'API est démarrée (cargo run dans services/api-geo)")
        return False
    except Exception as e:
        print(f"❌ Erreur: {e}")
        return False

def main():
    print("="*70)
    print("TEST API - Endpoints mailles 2km et 28km")
    print("="*70)
    
    # Tester d'abord la connexion
    try:
        response = requests.get(f"{API_BASE_URL}/health", timeout=5)
        print(f"\n✅ API accessible sur {API_BASE_URL}")
    except:
        print(f"\n❌ API non accessible sur {API_BASE_URL}")
        print(f"   Démarrer l'API avec: cd services/api-geo && cargo run")
        sys.exit(1)
    
    # Tester les deux grilles
    success_2km = test_endpoint("2km")
    success_28km = test_endpoint("28km")
    
    print(f"\n{'='*70}")
    print(f"RÉSUMÉ")
    print(f"{'='*70}")
    print(f"Grille 2km:  {'✅ OK' if success_2km else '❌ ÉCHEC'}")
    print(f"Grille 28km: {'✅ OK' if success_28km else '❌ ÉCHEC'}")
    
    if not success_28km:
        print(f"\n💡 Actions recommandées:")
        print(f"   1. Vérifier la base: python scripts/check_28km.py")
        print(f"   2. Si mailles 28km = 0: python scripts/run_migration_080.py")
        print(f"   3. Redémarrer l'API: cd services/api-geo && cargo run")
        sys.exit(1)

if __name__ == "__main__":
    main()
