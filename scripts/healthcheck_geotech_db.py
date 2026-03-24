#!/usr/bin/env python3
"""
Atlas Géotechnique - Quality Gates & Healthcheck DB
Vérifie l'intégrité physique et logique des données insérées.
Doit retourner Exit Code 0 en cas de succès, 1 sinon.
Génère un rapport 'geotech_healthcheck.log'.
"""

import psycopg2
import sys
import logging
from pathlib import Path

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(message)s',
    handlers=[
        logging.FileHandler("geotech_healthcheck.log"),
        logging.StreamHandler(sys.stdout)
    ]
)

DB_PARAMS = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

def run_checks():
    errors_found = 0
    try:
        conn = psycopg2.connect(**DB_PARAMS)
        cur = conn.cursor()
        
        logging.info("=== DEMARRAGE DU HEALTHCHECK GEOTECHNIQUE ===")
        
        # 1. Vérification Atterberg
        cur.execute("SELECT id, wl, wp, ip_generated FROM atlas.essais_atterberg WHERE wl < wp OR wl > 150 OR wp > 80;")
        invalid_att = cur.fetchall()
        if invalid_att:
            logging.error(f"❌ {len(invalid_att)} essais Atterberg ont Wl < Wp ou sont hors normes (Wl>150, Wp>80).")
            errors_found += 1
        else:
            logging.info("✅ Limites d'Atterberg (Wl, Wp) cohérentes.")
            
        # 2. Vérification IP calculé
        cur.execute("SELECT id, wl, wp, ip_generated FROM atlas.essais_atterberg WHERE ABS(ip_generated - (wl - wp)) > 5;")
        invalid_ip = cur.fetchall()
        if invalid_ip:
            logging.error(f"❌ {len(invalid_ip)} essais ont un Indice de Plasticité (Ip) incohérent avec Wl-Wp > 5.")
            errors_found += 1
        else:
            logging.info("✅ Calcul de l'Indice de Plasticité (Ip) contrôlé.")

        # 3. Vérification VBS
        cur.execute("SELECT id, vbs FROM atlas.essais_vbs WHERE vbs < 0 OR vbs > 30;")
        invalid_vbs = cur.fetchall()
        if invalid_vbs:
            logging.error(f"❌ {len(invalid_vbs)} essais VBS hors limites [0, 30].")
            errors_found += 1
        else:
            logging.info("✅ Essais au bleu de méthylène (VBS) dans les bornes admissibles.")

        # 4. Vérification Proctor
        cur.execute("SELECT id, gamma_d_max, w_opt FROM atlas.essais_proctor WHERE gamma_d_max < 10.0 OR gamma_d_max > 30.0 OR w_opt < 0 OR w_opt > 50;")
        invalid_proc = cur.fetchall()
        if invalid_proc:
            logging.error(f"❌ {len(invalid_proc)} essais Proctor avec densité ou teneur en eau aberrante.")
            errors_found += 1
        else:
            logging.info("✅ Essais Proctor (Densité, Teneur en eau) validés.")
            
        # 5. Vérification Sondages Géométrie
        cur.execute("""
            SELECT id FROM atlas.sondages 
            WHERE geom IS NOT NULL 
            AND NOT ST_Intersects(geom, ST_MakeEnvelope(-1, 5, 2.5, 12, 4326));
        """)
        invalid_geom = cur.fetchall()
        if invalid_geom:
            logging.warning(f"⚠️ {len(invalid_geom)} sondages situés en dehors de l'enveloppe géographique du Togo.")
        else:
            logging.info("✅ Géométrie des sondages incluse dans la bounding box tolérée.")
            
        cur.close()
        conn.close()
        
    except Exception as e:
        logging.error(f"Erreur fatale lors de l'exécution des requêtes: {e}")
        return 1
        
    logging.info("=== FIN DU HEALTHCHECK ===")
    
    if errors_found > 0:
        logging.error(f"Le healthcheck a échoué avec {errors_found} violation(s) des Quality Gates.")
        return 1
    else:
        logging.info("Toutes les Quality Gates ont été franchies avec succès.")
        return 0

if __name__ == "__main__":
    sys.exit(run_checks())
