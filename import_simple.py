#!/usr/bin/env python3
"""Import simple et création vues - Sans rétro-liaison pour éviter les erreurs"""

import psycopg
import sys

dsn = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

print("="*70)
print("IMPORT SIMPLE + CREATION VUES")
print("="*70)

try:
    print("\n[1/4] Connexion PostgreSQL...")
    conn = psycopg.connect(dsn, connect_timeout=10, autocommit=True)
    print("✓ Connecté")
    
    # Import avec script d'import (sans rétro-liaison)
    print("\n[2/4] Import données (via script)...")
    print("Exécutez manuellement:")
    print("  python scripts\\02_import_excel.py --file atlas_import_example.xlsx --dsn postgresql://atlas:atlas@localhost:5432/atlas_clean --import-raw no")
    print("\nAppuyez sur Entrée quand c'est fait...")
    input()
    
    # Vérifier import
    print("\n[3/4] Vérification import...")
    cur = conn.execute("SELECT COUNT(*) FROM sondages")
    nb_sondages = cur.fetchone()[0]
    
    cur = conn.execute("SELECT COUNT(*) FROM echantillons")
    nb_echantillons = cur.fetchone()[0]
    
    print(f"  - Sondages: {nb_sondages}")
    print(f"  - Échantillons: {nb_echantillons}")
    
    if nb_sondages == 0:
        print("\n✗ Aucune donnée importée - Arrêt")
        sys.exit(1)
    
    # Créer vues
    print("\n[4/4] Création vues spread...")
    
    with open('fix_ui_vues_complete.sql', 'r', encoding='utf-8') as f:
        sql = f.read()
    
    # Exécuter par blocs
    for statement in sql.split(';'):
        statement = statement.strip()
        if statement and not statement.startswith('--') and not statement.startswith('\\'):
            try:
                conn.execute(statement)
            except Exception as e:
                if 'already exists' not in str(e):
                    print(f"Warning: {e}")
    
    print("✓ Vues créées")
    
    # Refresh vue matérialisée
    print("\nRefresh vue matérialisée...")
    try:
        conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech")
        print("✓ Vue rafraîchie")
    except Exception as e:
        print(f"Warning refresh: {e}")
        print("Essai sans CONCURRENTLY...")
        conn.execute("REFRESH MATERIALIZED VIEW mv_mailles_geotech")
        print("✓ Vue rafraîchie")
    
    # Vérification finale
    print("\n" + "="*70)
    print("VERIFICATION FINALE")
    print("="*70)
    
    cur = conn.execute("SELECT COUNT(*) FROM mv_mailles_geotech")
    nb_mailles = cur.fetchone()[0]
    print(f"Mailles avec stats: {nb_mailles}")
    
    if nb_mailles > 0:
        print("\n✓ SUCCÈS ! Les données devraient apparaître dans l'UI")
        print("\nProchaines étapes:")
        print("  1. Rafraîchir le navigateur (Ctrl+Shift+R)")
        print("  2. Vérifier que l'API pointe sur mv_mailles_geotech")
    else:
        print("\n⚠ Vue vide - Vérifier que les sondages ont geom ou adm3_code")
        
        cur = conn.execute("""
            SELECT code, (geom IS NOT NULL) AS has_geom, adm3_code 
            FROM sondages
        """)
        print("\nSondages:")
        for row in cur:
            print(f"  {row[0]}: GPS={row[1]}, ADM3={row[2]}")
    
    conn.close()
    
except Exception as e:
    print(f"\n✗ Erreur: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
