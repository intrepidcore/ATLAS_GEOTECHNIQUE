#!/usr/bin/env python3
"""
Script pour exécuter la migration 080 (création mailles 28km).
Idempotent: peut être ré-exécuté sans problème.
"""
import os
import sys
import psycopg

def get_database_url():
    """Récupère la DATABASE_URL avec fallback."""
    db_url = os.getenv("DATABASE_URL", "postgresql://atlas:atlas@localhost:5432/atlas")
    
    # Fallback: si @db: échoue, essayer @localhost:
    if "@db:" in db_url:
        try:
            conn = psycopg.connect(db_url, connect_timeout=3)
            conn.close()
            return db_url
        except:
            db_url = db_url.replace("@db:", "@localhost:")
            print(f"⚠️  Fallback: utilisation de {db_url}")
    
    return db_url

def main():
    print("="*70)
    print("EXÉCUTION MIGRATION 080 - Création mailles 28km")
    print("="*70)
    
    db_url = get_database_url()
    print(f"\nDATABASE_URL: {db_url}")
    
    # Lire le fichier de migration
    migration_path = os.path.join(
        os.path.dirname(os.path.dirname(__file__)),
        "db", "migrations", "080_create_maille_28km.sql"
    )
    
    if not os.path.exists(migration_path):
        print(f"❌ Fichier de migration introuvable: {migration_path}")
        sys.exit(1)
    
    with open(migration_path, 'r', encoding='utf-8') as f:
        migration_sql = f.read()
    
    print(f"\n📄 Migration chargée: {len(migration_sql)} caractères")
    
    # Diagnostic pré-migration
    try:
        conn = psycopg.connect(db_url)
        print(f"✅ Connexion établie")
        
        with conn.cursor() as cur:
            # Vérifier l'état actuel
            cur.execute("SELECT COUNT(*) FROM atlas.mailles;")
            nb_mailles_2km = cur.fetchone()[0]
            print(f"\n📊 État actuel:")
            print(f"   atlas.mailles (2km): {nb_mailles_2km} lignes")
            
            try:
                cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
                nb_mailles_28km_avant = cur.fetchone()[0]
                print(f"   atlas.maille_28km: {nb_mailles_28km_avant} lignes (sera recréée)")
            except:
                print(f"   atlas.maille_28km: table n'existe pas encore")
            
            # Vérifier les dépendances
            cur.execute("""
                SELECT EXISTS(
                    SELECT 1 FROM information_schema.tables 
                    WHERE table_schema='public' AND table_name='adm0_raw'
                );
            """)
            has_adm0 = cur.fetchone()[0]
            
            if not has_adm0:
                print(f"\n⚠️  WARNING: public.adm0_raw n'existe pas")
                print(f"   La migration va créer les mailles mais le filtre Togo ne fonctionnera pas")
                print(f"   Continuer quand même? (y/n)")
                response = input().strip().lower()
                if response != 'y':
                    print("Annulé.")
                    sys.exit(0)
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        sys.exit(1)
    
    # Exécuter la migration
    print(f"\n🔧 Exécution de la migration...")
    try:
        conn = psycopg.connect(db_url)
        
        # Exécuter le SQL
        with conn.cursor() as cur:
            cur.execute(migration_sql)
        
        conn.commit()
        print(f"✅ Migration exécutée avec succès")
        
        # Diagnostic post-migration
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
            nb_mailles_28km = cur.fetchone()[0]
            
            cur.execute("""
                SELECT 
                    COUNT(DISTINCT profil_num) as nb_profils,
                    MIN(profil_num) as min_profil,
                    MAX(profil_num) as max_profil
                FROM atlas.maille_28km;
            """)
            row = cur.fetchone()
            
            cur.execute("""
                SELECT COUNT(*) FROM atlas.mailles WHERE id_m28 IS NOT NULL;
            """)
            nb_linked = cur.fetchone()[0]
        
        print(f"\n📊 Résultat:")
        print(f"   Mailles 28km créées: {nb_mailles_28km}")
        print(f"   Profils: {row[0]} (de {row[1]} à {row[2]})")
        print(f"   Mailles 2km rattachées: {nb_linked}")
        
        if nb_mailles_28km == 0:
            print(f"\n⚠️  ATTENTION: Aucune maille 28km créée!")
            print(f"   Causes possibles:")
            print(f"   - atlas.mailles est vide")
            print(f"   - Toutes les mailles ont été filtrées par adm0_raw")
            print(f"   - Problème de géométrie/SRID")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur lors de l'exécution: {e}")
        sys.exit(1)
    
    print(f"\n{'='*70}")
    print(f"✅ MIGRATION 080 TERMINÉE")
    print(f"{'='*70}")

if __name__ == "__main__":
    main()
