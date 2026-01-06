#!/usr/bin/env python3
"""
Script de diagnostic complet pour identifier la base de données utilisée
et vérifier l'état des mailles 28km.

Règle 1: Commence par des requêtes de diagnostic (SELECT, COUNT, ST_SRID)
avant toute modification.
"""
import os
import sys
import psycopg
from typing import Dict, Any

def test_connection(db_url: str) -> Dict[str, Any]:
    """Teste une connexion et retourne les infos de diagnostic."""
    result = {
        "url": db_url,
        "connected": False,
        "database_name": None,
        "atlas_mailles_count": None,
        "maille_28km_count": None,
        "maille_28km_srid": None,
        "boundary_togo_exists": False,
        "adm0_raw_exists": False,
        "colab_students_count": None,
        "migrations_applied": []
    }
    
    try:
        conn = psycopg.connect(db_url, connect_timeout=5)
        result["connected"] = True
        
        with conn.cursor() as cur:
            # Database name
            cur.execute("SELECT current_database();")
            result["database_name"] = cur.fetchone()[0]
            
            # atlas.mailles (2km)
            cur.execute("""
                SELECT COUNT(*) FROM atlas.mailles;
            """)
            result["atlas_mailles_count"] = cur.fetchone()[0]
            
            # atlas.maille_28km
            cur.execute("""
                SELECT COUNT(*), ST_SRID(geom) 
                FROM atlas.maille_28km 
                LIMIT 1;
            """)
            row = cur.fetchone()
            if row:
                result["maille_28km_count"] = row[0] if row[0] else 0
                result["maille_28km_srid"] = row[1]
            else:
                cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
                result["maille_28km_count"] = cur.fetchone()[0]
            
            # boundary_togo
            cur.execute("""
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema='atlas' AND table_name='boundary_togo'
                );
            """)
            result["boundary_togo_exists"] = cur.fetchone()[0]
            
            # adm0_raw
            cur.execute("""
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema='public' AND table_name='adm0_raw'
                );
            """)
            result["adm0_raw_exists"] = cur.fetchone()[0]
            
            # colab_students
            try:
                cur.execute("SELECT COUNT(*) FROM atlas.colab_students;")
                result["colab_students_count"] = cur.fetchone()[0]
            except:
                result["colab_students_count"] = 0
            
            # Migrations appliquées (si table existe)
            try:
                cur.execute("""
                    SELECT version FROM atlas.schema_migrations 
                    WHERE version LIKE '080%' OR version LIKE '081%'
                    ORDER BY version;
                """)
                result["migrations_applied"] = [row[0] for row in cur.fetchall()]
            except:
                pass
        
        conn.close()
        
    except Exception as e:
        result["error"] = str(e)
    
    return result

def print_diagnostic(result: Dict[str, Any]):
    """Affiche les résultats du diagnostic."""
    print(f"\n{'='*70}")
    print(f"DATABASE_URL: {result['url']}")
    print(f"{'='*70}")
    
    if not result["connected"]:
        print(f"❌ CONNEXION ÉCHOUÉE: {result.get('error', 'Unknown error')}")
        return
    
    print(f"✅ CONNECTÉ")
    print(f"   Database: {result['database_name']}")
    print(f"\n📊 TABLES:")
    print(f"   atlas.mailles (2km):     {result['atlas_mailles_count']:>6} lignes")
    print(f"   atlas.maille_28km:       {result['maille_28km_count']:>6} lignes (SRID: {result['maille_28km_srid']})")
    print(f"   atlas.boundary_togo:     {'✅ existe' if result['boundary_togo_exists'] else '❌ manquante'}")
    print(f"   public.adm0_raw:         {'✅ existe' if result['adm0_raw_exists'] else '❌ manquante'}")
    print(f"   atlas.colab_students:    {result['colab_students_count']:>6} lignes")
    
    if result["migrations_applied"]:
        print(f"\n🔧 MIGRATIONS 28km appliquées:")
        for m in result["migrations_applied"]:
            print(f"   - {m}")
    else:
        print(f"\n⚠️  Aucune migration 080/081 détectée")

def check_maille_28km_details(db_url: str):
    """Analyse détaillée des mailles 28km si elles existent."""
    try:
        conn = psycopg.connect(db_url)
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
            count = cur.fetchone()[0]
            
            if count == 0:
                print(f"\n⚠️  Table atlas.maille_28km VIDE (0 lignes)")
                print(f"   → La migration 080 n'a pas généré de mailles")
                print(f"   → Vérifier atlas.mailles et boundary_togo/adm0_raw")
                return
            
            print(f"\n✅ Analyse détaillée de atlas.maille_28km ({count} mailles):")
            
            # Profils
            cur.execute("""
                SELECT 
                    COUNT(DISTINCT profil_num) as nb_profils,
                    MIN(profil_num) as min_profil,
                    MAX(profil_num) as max_profil
                FROM atlas.maille_28km;
            """)
            row = cur.fetchone()
            print(f"   Profils: {row[0]} distincts (de {row[1]} à {row[2]})")
            
            # PK range
            cur.execute("""
                SELECT MIN(pk_min_km), MAX(pk_max_km)
                FROM atlas.maille_28km;
            """)
            row = cur.fetchone()
            print(f"   PK range: {row[0]:.1f} km → {row[1]:.1f} km")
            
            # Mailles 2km rattachées
            cur.execute("""
                SELECT COUNT(*) FROM atlas.mailles WHERE id_m28 IS NOT NULL;
            """)
            linked_2km = cur.fetchone()[0]
            print(f"   Mailles 2km rattachées: {linked_2km}")
            
            # Sondages rattachés
            try:
                cur.execute("""
                    SELECT COUNT(*) FROM atlas.sondages WHERE id_m28 IS NOT NULL;
                """)
                linked_sondages = cur.fetchone()[0]
                print(f"   Sondages rattachés: {linked_sondages}")
            except:
                print(f"   Sondages rattachés: N/A (table absente)")
            
            # Vue KPI
            try:
                cur.execute("SELECT COUNT(*) FROM atlas.v_maille_28km_kpi;")
                kpi_count = cur.fetchone()[0]
                print(f"   Vue v_maille_28km_kpi: {kpi_count} features")
            except Exception as e:
                print(f"   Vue v_maille_28km_kpi: ❌ erreur ({str(e)[:50]})")
        
        conn.close()
        
    except Exception as e:
        print(f"\n❌ Erreur lors de l'analyse détaillée: {e}")

def main():
    print("="*70)
    print("DIAGNOSTIC COMPLET - BASE DE DONNÉES ATLAS")
    print("="*70)
    
    # Liste des DATABASE_URL à tester
    urls_to_test = [
        # Depuis .env.example
        "postgresql://atlas:atlas@db:5432/atlas_clean",
        "postgresql://atlas:atlas@localhost:5432/atlas_clean",
        # Depuis api-geo/.env.example
        "postgresql://atlas:atlas@localhost:5432/atlas",
        # Fallback classique
        "postgresql://atlas:atlas@db:5432/atlas",
    ]
    
    # Tester aussi DATABASE_URL depuis l'environnement
    env_db_url = os.getenv("DATABASE_URL")
    if env_db_url and env_db_url not in urls_to_test:
        urls_to_test.insert(0, env_db_url)
    
    results = []
    for url in urls_to_test:
        result = test_connection(url)
        results.append(result)
        print_diagnostic(result)
    
    # Identifier la base "canonique" (celle avec le plus de données)
    connected = [r for r in results if r["connected"]]
    if not connected:
        print("\n❌ AUCUNE CONNEXION RÉUSSIE")
        print("   Vérifier que PostgreSQL est démarré et accessible")
        sys.exit(1)
    
    # Trouver la base avec le plus de mailles 28km
    best = max(connected, key=lambda r: (r["maille_28km_count"] or 0, r["atlas_mailles_count"] or 0))
    
    print(f"\n{'='*70}")
    print(f"🎯 BASE CANONIQUE RECOMMANDÉE:")
    print(f"{'='*70}")
    print(f"   URL: {best['url']}")
    print(f"   Database: {best['database_name']}")
    print(f"   Mailles 28km: {best['maille_28km_count']}")
    print(f"   Mailles 2km: {best['atlas_mailles_count']}")
    
    # Analyse détaillée de cette base
    if best["maille_28km_count"] and best["maille_28km_count"] > 0:
        check_maille_28km_details(best["url"])
    else:
        print(f"\n⚠️  Cette base n'a PAS de mailles 28km")
        print(f"   → Il faut exécuter la migration 080_create_maille_28km.sql")
    
    print(f"\n{'='*70}")
    print(f"RECOMMANDATIONS:")
    print(f"{'='*70}")
    
    if best["maille_28km_count"] == 0:
        print("1. ✅ Utiliser cette DATABASE_URL dans tous les scripts:")
        print(f"   {best['url']}")
        print("2. ⚠️  Exécuter la migration 080 pour créer les mailles 28km")
        print("3. 📝 Mettre à jour .env et api-geo/.env avec cette URL")
    else:
        print("1. ✅ Cette base contient déjà les mailles 28km")
        print("2. 📝 S'assurer que tous les services utilisent cette URL:")
        print(f"   {best['url']}")
        print("3. 💾 Faire un dump complet de cette base pour sauvegarder")

if __name__ == "__main__":
    main()
