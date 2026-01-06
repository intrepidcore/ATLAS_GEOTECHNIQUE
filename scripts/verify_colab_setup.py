#!/usr/bin/env python3
"""
Script de vérification de l'installation du système d'attribution Colab
"""

import os
import sys
import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

def check_database_connection(database_url):
    """Vérifie la connexion à la base de données"""
    try:
        conn = psycopg2.connect(database_url)
        conn.close()
        return True, "✓ Connexion base de données OK"
    except Exception as e:
        return False, f"✗ Erreur connexion: {e}"

def check_tables_exist(database_url):
    """Vérifie que les tables nécessaires existent"""
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    tables = [
        'atlas.colab_student_prefs',
        'atlas.colab_maille_assignments',
        'atlas.mailles',
        'atlas.adm2_tg',
        'atlas.adm3_tg'
    ]
    
    results = []
    for table in tables:
        schema, table_name = table.split('.')
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_schema = %s AND table_name = %s
            )
        """, (schema, table_name))
        exists = cursor.fetchone()['exists']
        status = "✓" if exists else "✗"
        results.append((exists, f"{status} Table {table}"))
    
    cursor.close()
    conn.close()
    return results

def check_views_exist(database_url):
    """Vérifie que les vues nécessaires existent"""
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    views = [
        'atlas.v_colab_maille_assignment_details',
        'atlas.v_colab_assignments_by_adm',
        'atlas.v_colab_students_without_maille'
    ]
    
    results = []
    for view in views:
        schema, view_name = view.split('.')
        cursor.execute("""
            SELECT EXISTS (
                SELECT FROM information_schema.views 
                WHERE table_schema = %s AND table_name = %s
            )
        """, (schema, view_name))
        exists = cursor.fetchone()['exists']
        status = "✓" if exists else "✗"
        results.append((exists, f"{status} Vue {view}"))
    
    cursor.close()
    conn.close()
    return results

def check_adm_data(database_url):
    """Vérifie que les données ADM sont présentes"""
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    cursor.execute("SELECT COUNT(*) as count FROM public.adm2")
    adm2_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM public.adm3")
    adm3_count = cursor.fetchone()['count']
    
    cursor.execute("SELECT COUNT(*) as count FROM atlas.mailles")
    mailles_count = cursor.fetchone()['count']
    
    cursor.close()
    conn.close()
    
    results = [
        (adm2_count > 0, f"{'✓' if adm2_count > 0 else '✗'} ADM2 (préfectures): {adm2_count}"),
        (adm3_count > 0, f"{'✓' if adm3_count > 0 else '✗'} ADM3 (communes): {adm3_count}"),
        (mailles_count > 0, f"{'✓' if mailles_count > 0 else '✗'} Mailles nationales: {mailles_count}")
    ]
    
    return results

def main():
    """Fonction principale"""
    print("="*70)
    print("🔍 VÉRIFICATION DU SYSTÈME D'ATTRIBUTION COLAB")
    print("="*70)
    print()
    
    # Charger les variables d'environnement
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("✗ Variable DATABASE_URL non définie")
        print()
        print("Solution:")
        print("  1. Créer un fichier .env à la racine du projet")
        print("  2. Ajouter: DATABASE_URL=postgresql://user:pass@host:port/dbname")
        sys.exit(1)
    
    all_ok = True
    
    # 1. Connexion
    print("1. Connexion à la base de données")
    ok, msg = check_database_connection(database_url)
    print(f"   {msg}")
    if not ok:
        all_ok = False
    print()
    
    if not ok:
        print("❌ Impossible de continuer sans connexion à la base")
        sys.exit(1)
    
    # 2. Tables
    print("2. Tables nécessaires")
    results = check_tables_exist(database_url)
    for ok, msg in results:
        print(f"   {msg}")
        if not ok:
            all_ok = False
    print()
    
    # 3. Vues
    print("3. Vues nécessaires")
    results = check_views_exist(database_url)
    for ok, msg in results:
        print(f"   {msg}")
        if not ok:
            all_ok = False
    print()
    
    # 4. Données ADM
    print("4. Données de référence")
    results = check_adm_data(database_url)
    for ok, msg in results:
        print(f"   {msg}")
        if not ok:
            all_ok = False
    print()
    
    # Résumé
    print("="*70)
    if all_ok:
        print("✅ SYSTÈME PRÊT À L'EMPLOI")
        print()
        print("Prochaines étapes:")
        print("  1. Créer le template Excel:")
        print("     poetry run python scripts/create_excel_template.py")
        print()
        print("  2. Remplir les données dans data/colab/etudiants_colab.xlsx")
        print()
        print("  3. Tester l'attribution:")
        print("     poetry run python scripts/colab_assign_mailles_from_excel.py \\")
        print("       --input data/colab/etudiants_colab.xlsx --dry-run true")
    else:
        print("⚠️  CONFIGURATION INCOMPLÈTE")
        print()
        print("Actions requises:")
        print("  1. Appliquer la migration 082:")
        print("     psql $env:DATABASE_URL -f db/migrations/082_colab_maille_assignment_system.sql")
        print()
        print("  2. Vérifier que les données ADM sont importées")
        print()
        print("  3. Relancer ce script pour vérifier")
    print("="*70)
    
    sys.exit(0 if all_ok else 1)

if __name__ == '__main__':
    main()
