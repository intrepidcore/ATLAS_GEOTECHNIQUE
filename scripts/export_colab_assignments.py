#!/usr/bin/env python3
"""
Script d'export des attributions Colab en CSV
"""

import os
import sys
from pathlib import Path
from datetime import datetime
import csv

import psycopg2
from psycopg2.extras import RealDictCursor
from dotenv import load_dotenv

def export_assignments(database_url: str, output_file: str):
    """Exporte les attributions en CSV"""
    
    print(f"📊 Export des attributions Colab")
    print(f"   Fichier de sortie: {output_file}")
    print()
    
    # Connexion
    conn = psycopg2.connect(database_url)
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    # Requête
    cursor.execute("""
        SELECT 
            student_id,
            nom,
            prenom,
            email,
            telephone,
            adm_niveau,
            adm_code_pref_1,
            adm_code_pref_2,
            adm_code_pref_3,
            maille_code,
            maille_pref_name,
            adm_code_used,
            pref_rank_used,
            bbox_xmin,
            bbox_ymin,
            bbox_xmax,
            bbox_ymax,
            centroid_x,
            centroid_y,
            area_km2,
            assigned_at
        FROM atlas.v_colab_maille_assignment_details
        ORDER BY assigned_at DESC
    """)
    
    rows = cursor.fetchall()
    
    if not rows:
        print("⚠️  Aucune attribution trouvée")
        cursor.close()
        conn.close()
        return
    
    # Créer le répertoire si nécessaire
    output_path = Path(output_file)
    output_path.parent.mkdir(parents=True, exist_ok=True)
    
    # Écrire le CSV
    with open(output_file, 'w', newline='', encoding='utf-8') as f:
        writer = csv.DictWriter(f, fieldnames=rows[0].keys())
        writer.writeheader()
        writer.writerows(rows)
    
    print(f"✓ {len(rows)} attributions exportées")
    print(f"✓ Fichier créé: {output_file}")
    
    cursor.close()
    conn.close()

def main():
    """Point d'entrée"""
    load_dotenv()
    database_url = os.getenv('DATABASE_URL')
    
    if not database_url:
        print("❌ Variable DATABASE_URL non définie")
        sys.exit(1)
    
    # Nom du fichier avec timestamp
    timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
    output_file = f"output/colab_assignments_{timestamp}.csv"
    
    export_assignments(database_url, output_file)

if __name__ == '__main__':
    main()
