#!/usr/bin/env python3
"""
Script de vérification reproductible pour les mailles 28km.
À exécuter régulièrement pour confirmer l'état de la base.
"""
import os
import sys
import psycopg
from typing import Dict, Any

def get_database_url():
    """Récupère la DATABASE_URL avec fallback."""
    db_url = os.getenv("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas")
    
    if "@db:" in db_url:
        try:
            conn = psycopg.connect(db_url, connect_timeout=3)
            conn.close()
            return db_url
        except:
            db_url = db_url.replace("@db:", "@localhost:")
    
    return db_url

def check_28km() -> Dict[str, Any]:
    """Vérifie l'état des mailles 28km."""
    db_url = get_database_url()
    
    result = {
        "database_url": db_url,
        "database_name": None,
        "maille_28km_count": 0,
        "profils_count": 0,
        "profil_min": None,
        "profil_max": None,
        "pk_min": None,
        "pk_max": None,
        "mailles_2km_linked": 0,
        "mailles_2km_total": 0,
        "sondages_linked": 0,
        "vue_kpi_count": 0,
        "errors": []
    }
    
    try:
        conn = psycopg.connect(db_url)
        
        with conn.cursor() as cur:
            # Database name
            cur.execute("SELECT current_database();")
            result["database_name"] = cur.fetchone()[0]
            
            # Mailles 28km
            cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
            result["maille_28km_count"] = cur.fetchone()[0]
            
            if result["maille_28km_count"] > 0:
                # Profils
                cur.execute("""
                    SELECT 
                        COUNT(DISTINCT profil_num),
                        MIN(profil_num),
                        MAX(profil_num)
                    FROM atlas.maille_28km;
                """)
                row = cur.fetchone()
                result["profils_count"] = row[0]
                result["profil_min"] = row[1]
                result["profil_max"] = row[2]
                
                # PK range
                cur.execute("""
                    SELECT MIN(pk_min_km), MAX(pk_max_km)
                    FROM atlas.maille_28km;
                """)
                row = cur.fetchone()
                result["pk_min"] = float(row[0]) if row[0] else None
                result["pk_max"] = float(row[1]) if row[1] else None
            
            # Mailles 2km
            cur.execute("SELECT COUNT(*) FROM atlas.mailles;")
            result["mailles_2km_total"] = cur.fetchone()[0]
            
            cur.execute("SELECT COUNT(*) FROM atlas.mailles WHERE id_m28 IS NOT NULL;")
            result["mailles_2km_linked"] = cur.fetchone()[0]
            
            # Sondages
            try:
                cur.execute("SELECT COUNT(*) FROM atlas.sondages WHERE id_m28 IS NOT NULL;")
                result["sondages_linked"] = cur.fetchone()[0]
            except Exception as e:
                result["errors"].append(f"sondages: {str(e)[:50]}")
            
            # Vue KPI
            try:
                cur.execute("SELECT COUNT(*) FROM atlas.v_maille_28km_kpi;")
                result["vue_kpi_count"] = cur.fetchone()[0]
            except Exception as e:
                result["errors"].append(f"v_maille_28km_kpi: {str(e)[:50]}")
        
        conn.close()
        
    except Exception as e:
        result["errors"].append(f"connexion: {str(e)}")
        return result
    
    return result

def print_report(result: Dict[str, Any]):
    """Affiche le rapport de vérification."""
    print("="*70)
    print("VÉRIFICATION MAILLES 28KM")
    print("="*70)
    print(f"\n📍 Base de données: {result['database_name']}")
    print(f"   URL: {result['database_url']}")
    
    if result["errors"] and "connexion" in result["errors"][0]:
        print(f"\n❌ ERREUR DE CONNEXION")
        print(f"   {result['errors'][0]}")
        return False
    
    print(f"\n📊 MAILLES 28KM:")
    print(f"   Nombre total: {result['maille_28km_count']}")
    
    if result["maille_28km_count"] == 0:
        print(f"   ❌ AUCUNE MAILLE 28KM")
        print(f"\n💡 Action requise:")
        print(f"   python scripts/run_migration_080.py")
        return False
    
    print(f"   ✅ {result['maille_28km_count']} mailles créées")
    print(f"\n📈 PROFILS:")
    print(f"   Nombre de profils: {result['profils_count']}")
    print(f"   Range: profil {result['profil_min']} → {result['profil_max']}")
    print(f"   PK: {result['pk_min']:.1f} km → {result['pk_max']:.1f} km")
    
    print(f"\n🔗 LIAISONS:")
    print(f"   Mailles 2km rattachées: {result['mailles_2km_linked']} / {result['mailles_2km_total']}")
    
    pct_linked = (result['mailles_2km_linked'] / result['mailles_2km_total'] * 100) if result['mailles_2km_total'] > 0 else 0
    if pct_linked < 90:
        print(f"   ⚠️  Seulement {pct_linked:.1f}% des mailles 2km sont rattachées")
    else:
        print(f"   ✅ {pct_linked:.1f}% des mailles 2km rattachées")
    
    print(f"   Sondages rattachés: {result['sondages_linked']}")
    
    print(f"\n📋 VUES:")
    print(f"   v_maille_28km_kpi: {result['vue_kpi_count']} features")
    
    if result['vue_kpi_count'] != result['maille_28km_count']:
        print(f"   ⚠️  Incohérence: vue KPI devrait avoir {result['maille_28km_count']} features")
    
    if result["errors"]:
        print(f"\n⚠️  ERREURS:")
        for err in result["errors"]:
            print(f"   - {err}")
    
    print(f"\n{'='*70}")
    
    # Verdict final
    all_ok = (
        result["maille_28km_count"] > 0 and
        result["profils_count"] > 0 and
        pct_linked > 80 and
        result["vue_kpi_count"] == result["maille_28km_count"]
    )
    
    if all_ok:
        print("✅ TOUT EST OK - Mailles 28km opérationnelles")
        return True
    else:
        print("⚠️  PROBLÈMES DÉTECTÉS - Voir ci-dessus")
        return False

def main():
    result = check_28km()
    success = print_report(result)
    
    if not success:
        sys.exit(1)

if __name__ == "__main__":
    main()
