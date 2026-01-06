#!/usr/bin/env python3
"""
Script pour vérifier et peupler les mailles 28km
"""
import psycopg
import sys

DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def main():
    print("Connexion à la base de données...")
    
    try:
        conn = psycopg.connect(DATABASE_URL)
        print("✅ Connecté\n")
        
        with conn.cursor() as cur:
            # Vérifier atlas.mailles
            print("Vérification de atlas.mailles...")
            cur.execute("SELECT COUNT(*) FROM atlas.mailles;")
            count_mailles = cur.fetchone()[0]
            print(f"  → {count_mailles} mailles 2km trouvées")
            
            if count_mailles == 0:
                print("\n❌ La table atlas.mailles est vide!")
                print("   Les mailles 28km ne peuvent pas être générées sans mailles 2km.")
                print("   Il faut d'abord importer les données de base.")
                conn.close()
                sys.exit(1)
            
            # Vérifier public.adm0_raw
            print("\nVérification de public.adm0_raw...")
            cur.execute("SELECT COUNT(*) FROM public.adm0_raw;")
            count_adm0 = cur.fetchone()[0]
            print(f"  → {count_adm0} frontière(s) trouvée(s)")
            
            if count_adm0 == 0:
                print("\n❌ La table public.adm0_raw est vide!")
                print("   Nécessaire pour filtrer les mailles 28km au Togo.")
                conn.close()
                sys.exit(1)
            
            # Ré-exécuter la génération des mailles 28km
            print("\n" + "="*60)
            print("Génération des mailles 28km...")
            print("="*60)
            
            # Lire et exécuter la migration 080
            from pathlib import Path
            migration_file = Path(__file__).parent / "db" / "migrations" / "080_create_maille_28km.sql"
            sql = migration_file.read_text(encoding='utf-8')
            
            cur.execute(sql)
            conn.commit()
            
            # Vérifier le résultat
            print("\nVérification des résultats...")
            cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
            count_m28 = cur.fetchone()[0]
            print(f"✅ Mailles 28km créées: {count_m28}")
            
            if count_m28 > 0:
                # Afficher quelques exemples
                cur.execute("""
                    SELECT code_m28, profil_num, pk_min_km, pk_max_km 
                    FROM atlas.maille_28km 
                    ORDER BY code_m28 
                    LIMIT 5;
                """)
                print("\nExemples de mailles 28km:")
                for row in cur.fetchall():
                    print(f"  Code: {row[0]}, Profil: {row[1]}, PK: {row[2]}-{row[3]} km")
                
                # Vérifier la vue KPI
                cur.execute("SELECT COUNT(*) FROM atlas.v_maille_28km_kpi;")
                count_kpi = cur.fetchone()[0]
                print(f"\n✅ Features dans v_maille_28km_kpi: {count_kpi}")
            else:
                print("\n⚠️  Aucune maille 28km n'a été créée.")
                print("   Vérifiez que les mailles 2km intersectent bien le Togo.")
        
        conn.close()
        print("\n" + "="*60)
        print("✅ Vérification terminée")
        print("="*60)
        
    except Exception as e:
        print(f"❌ Erreur: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)

if __name__ == "__main__":
    main()
