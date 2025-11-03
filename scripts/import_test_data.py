#!/usr/bin/env python3
"""
Importer les données de test directement dans PostgreSQL
"""

import csv
import psycopg2
from datetime import datetime

# Configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas',
    'user': 'atlas',
    'password': 'atlas123'
}

CSV_FILE = 'test_data_50_sondages.csv'  # Commencer avec le petit fichier

def import_data():
    print(f"🚀 Import des données depuis {CSV_FILE}...")
    
    # Connexion
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Lire le CSV
    with open(CSV_FILE, 'r', encoding='utf-8') as f:
        reader = csv.DictReader(f)
        rows = list(reader)
    
    print(f"📊 {len(rows)} lignes à importer")
    
    # Grouper par sondage
    sondages = {}
    for row in rows:
        code = row['code']
        if code not in sondages:
            sondages[code] = {
                'code': code,
                'date': row.get('date'),
                'source': row.get('source'),
                'lat': float(row['lat']),
                'lon': float(row['lon']),
                'laboratory': row.get('laboratory'),
                'essais': []
            }
        
        # Ajouter l'essai
        essai = {
            'depth_m': float(row['depth_m']),
            'passant_80um': float(row['passant_80um']) if row.get('passant_80um') else None,
            'passant_2mm': float(row['passant_2mm']) if row.get('passant_2mm') else None,
            'passant_20mm': float(row['passant_20mm']) if row.get('passant_20mm') else None,
            'wl': float(row['wl']) if row.get('wl') else None,
            'wp': float(row['wp']) if row.get('wp') else None,
            'vbs': float(row['vbs']) if row.get('vbs') else None,
            'gamma_d_max': float(row['gamma_d_max']) if row.get('gamma_d_max') else None,
            'w_opt': float(row['w_opt']) if row.get('w_opt') else None,
            'proctor_type': row.get('proctor_type'),
            'eg': float(row['eg']) if row.get('eg') else None,
            'norm': row.get('norm')
        }
        sondages[code]['essais'].append(essai)
    
    print(f"📍 {len(sondages)} sondages uniques")
    
    # Importer
    imported_sondages = 0
    imported_essais = 0
    
    for code, sondage in sondages.items():
        try:
            # Insérer le sondage
            cur.execute("""
                INSERT INTO sondages (code, date, source, geom, laboratory, created_at)
                VALUES (%s, %s, %s, ST_SetSRID(ST_MakePoint(%s, %s), 4326), %s, NOW())
                ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
                RETURNING id
            """, (
                sondage['code'],
                sondage['date'],
                sondage['source'],
                sondage['lon'],
                sondage['lat'],
                sondage['laboratory']
            ))
            
            sondage_id = cur.fetchone()[0]
            imported_sondages += 1
            
            # Insérer les essais
            for essai in sondage['essais']:
                cur.execute("""
                    INSERT INTO essais_geotechniques (
                        sondage_id, depth_m, 
                        passant_80um, passant_2mm, passant_20mm,
                        wl, wp, vbs,
                        gamma_d_max, w_opt, proctor_type,
                        eg, norm, created_at
                    ) VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, NOW())
                """, (
                    sondage_id,
                    essai['depth_m'],
                    essai['passant_80um'],
                    essai['passant_2mm'],
                    essai['passant_20mm'],
                    essai['wl'],
                    essai['wp'],
                    essai['vbs'],
                    essai['gamma_d_max'],
                    essai['w_opt'],
                    essai['proctor_type'],
                    essai['eg'],
                    essai['norm']
                ))
                imported_essais += 1
            
            if imported_sondages % 10 == 0:
                print(f"  ⏳ {imported_sondages}/{len(sondages)} sondages...")
                conn.commit()
        
        except Exception as e:
            print(f"  ❌ Erreur sur {code}: {e}")
            conn.rollback()
    
    conn.commit()
    
    # Rafraîchir la vue matérialisée
    print(f"\n🔄 Rafraîchissement de la vue matérialisée...")
    cur.execute("REFRESH MATERIALIZED VIEW grid_stats_geotechnical")
    conn.commit()
    
    # Statistiques finales
    cur.execute("""
        SELECT 
            COUNT(*) as total_mailles,
            COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
            SUM(n_sondages) as total_sondages,
            SUM(n_essais_geo) as total_essais
        FROM grid_stats_geotechnical
    """)
    stats = cur.fetchone()
    
    cur.close()
    conn.close()
    
    print(f"\n✅ Import terminé !")
    print(f"📊 Statistiques:")
    print(f"   • Sondages importés: {imported_sondages}")
    print(f"   • Essais importés: {imported_essais}")
    print(f"   • Mailles totales: {stats[0]}")
    print(f"   • Mailles avec données: {stats[1]}")
    print(f"   • Sondages en base: {stats[2]}")
    print(f"   • Essais en base: {stats[3]}")
    print(f"\n🎉 Vous pouvez maintenant tester la carte thématique !")

if __name__ == '__main__':
    import_data()
