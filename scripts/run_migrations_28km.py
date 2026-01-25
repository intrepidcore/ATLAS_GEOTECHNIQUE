#!/usr/bin/env python3
"""
Script pour exécuter les migrations 28km (080 et 081)
"""
import psycopg
import sys
from pathlib import Path

DATABASE_URL = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def run_migration(conn, sql_file):
    """Exécute un fichier SQL de migration"""
    print(f"\n{'='*60}")
    print(f"Exécution de {sql_file.name}...")
    print(f"{'='*60}")
    
    sql = sql_file.read_text(encoding='utf-8')
    
    try:
        with conn.cursor() as cur:
            cur.execute(sql)
            conn.commit()
        print(f"✅ {sql_file.name} exécuté avec succès")
        return True
    except Exception as e:
        print(f"❌ Erreur lors de l'exécution de {sql_file.name}:")
        print(f"   {e}")
        conn.rollback()
        return False

def main():
    migrations_dir = Path(__file__).parent / "db" / "migrations"
    
    migrations = [
        migrations_dir / "080_create_maille_28km.sql",
        migrations_dir / "081_create_kpi_views.sql"
    ]
    
    print(f"Connexion à la base de données...")
    print(f"URL: {DATABASE_URL}")
    
    try:
        conn = psycopg.connect(DATABASE_URL)
        print("✅ Connecté à la base de données\n")
        
        for migration_file in migrations:
            if not migration_file.exists():
                print(f"⚠️  Fichier {migration_file.name} introuvable, ignoré")
                continue
            
            success = run_migration(conn, migration_file)
            if not success:
                print(f"\n❌ Migration {migration_file.name} a échoué, arrêt")
                sys.exit(1)
        
        # Vérifier le résultat
        print(f"\n{'='*60}")
        print("Vérification des résultats...")
        print(f"{'='*60}")
        
        with conn.cursor() as cur:
            # Compter les mailles 28km
            cur.execute("SELECT COUNT(*) FROM atlas.maille_28km;")
            count_m28 = cur.fetchone()[0]
            print(f"✅ Mailles 28km créées: {count_m28}")
            
            # Compter les features dans la vue KPI
            cur.execute("SELECT COUNT(*) FROM atlas.v_maille_28km_kpi;")
            count_kpi = cur.fetchone()[0]
            print(f"✅ Features dans v_maille_28km_kpi: {count_kpi}")
            
            # Vérifier boundary_togo
            cur.execute("SELECT COUNT(*) FROM atlas.boundary_togo;")
            count_boundary = cur.fetchone()[0]
            print(f"✅ Boundary Togo: {count_boundary} row(s)")
        
        conn.close()
        print(f"\n{'='*60}")
        print("✅ Toutes les migrations ont été appliquées avec succès!")
        print(f"{'='*60}\n")
        
    except Exception as e:
        print(f"❌ Erreur de connexion: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
