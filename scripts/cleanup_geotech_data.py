#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Nettoyage complet des données géotechniques dans atlas_clean
"""

import psycopg2
from psycopg2.extras import RealDictCursor
import logging

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

DSN = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def cleanup_geotech_data():
    """Supprime toutes les données géotechniques"""
    
    conn = psycopg2.connect(DSN)
    
    try:
        cur = conn.cursor(cursor_factory=RealDictCursor)
        
        # 1) Lister les tables existantes
        logger.info("=== Inspection des tables existantes ===")
        cur.execute("""
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
              AND table_type = 'BASE TABLE'
            ORDER BY table_name
        """)
        tables = [row['table_name'] for row in cur.fetchall()]
        logger.info(f"Tables trouvées : {len(tables)}")
        for t in tables:
            logger.info(f"  - {t}")
        
        # 2) Compter les données avant suppression
        logger.info("\n=== Comptage avant suppression ===")
        
        count_queries = {
            'sondages': "SELECT count(*) as n FROM sondages",
            'echantillons': "SELECT count(*) as n FROM echantillons",
            'essais_atterberg': "SELECT count(*) as n FROM essais_atterberg",
            'essais_vbs': "SELECT count(*) as n FROM essais_vbs",
            'essais_proctor': "SELECT count(*) as n FROM essais_proctor",
            'granulo_points': "SELECT count(*) as n FROM granulo_points",
            'granulometrie_points': "SELECT count(*) as n FROM granulometrie_points",
            'raw_lab_agt': "SELECT count(*) as n FROM raw_lab_agt",
            'raw_lab_ags': "SELECT count(*) as n FROM raw_lab_ags",
            'raw_lab_atterberg': "SELECT count(*) as n FROM raw_lab_atterberg"
        }
        
        counts_before = {}
        for table, query in count_queries.items():
            conn.rollback()  # Reset transaction avant chaque requête
            try:
                cur.execute(query)
                count = cur.fetchone()['n']
                counts_before[table] = count
                logger.info(f"  {table}: {count} lignes")
            except psycopg2.Error as e:
                logger.warning(f"  {table}: table n'existe pas")
                counts_before[table] = None
        
        # 3) Suppression en CASCADE (ordre inverse des dépendances)
        logger.info("\n=== Suppression des données ===")
        
        delete_queries = [
            # RAW (pas de FK normalement)
            "DELETE FROM raw_lab_atterberg",
            "DELETE FROM raw_lab_ags",
            "DELETE FROM raw_lab_agt",
            
            # Granulo points (FK vers echantillons)
            "DELETE FROM granulometrie_points",
            "DELETE FROM granulo_points",
            
            # Essais (FK vers echantillons)
            "DELETE FROM essais_proctor",
            "DELETE FROM essais_vbs",
            "DELETE FROM essais_atterberg",
            
            # Echantillons (FK vers sondages)
            "DELETE FROM echantillons",
            
            # Sondages (racine)
            "DELETE FROM sondages"
        ]
        
        for query in delete_queries:
            table = query.split()[-1]
            conn.rollback()  # Reset avant chaque DELETE
            try:
                cur.execute(query)
                deleted = cur.rowcount
                conn.commit()
                logger.info(f"  ✓ {table}: {deleted} lignes supprimées")
            except psycopg2.Error as e:
                logger.warning(f"  ⚠ {table}: table n'existe pas ou erreur")
        
        # 4) Vérification après suppression
        logger.info("\n=== Vérification après suppression ===")
        
        for table, query in count_queries.items():
            conn.rollback()
            try:
                cur.execute(query)
                count = cur.fetchone()['n']
                before = counts_before.get(table, 0)
                if count == 0:
                    logger.info(f"  ✓ {table}: 0 ligne (avant: {before})")
                else:
                    logger.warning(f"  ⚠ {table}: {count} lignes restantes (avant: {before})")
            except psycopg2.Error:
                pass
        
        # 5) Reset des séquences
        logger.info("\n=== Reset des séquences ===")
        
        sequences = [
            'sondages_id_seq',
            'echantillons_id_seq',
            'essais_atterberg_id_seq',
            'essais_vbs_id_seq',
            'essais_proctor_id_seq',
            'granulo_points_id_seq',
            'granulometrie_points_id_seq',
            'raw_lab_agt_id_seq',
            'raw_lab_ags_id_seq',
            'raw_lab_atterberg_id_seq'
        ]
        
        for seq in sequences:
            conn.rollback()
            try:
                cur.execute(f"ALTER SEQUENCE {seq} RESTART WITH 1")
                conn.commit()
                logger.info(f"  ✓ {seq} réinitialisée")
            except psycopg2.Error:
                logger.debug(f"  - {seq} n'existe pas")
        
        logger.info("\n✅ Nettoyage terminé avec succès")
            
    except Exception as e:
        conn.rollback()
        logger.error(f"❌ Erreur lors du nettoyage : {e}")
        raise
    finally:
        conn.close()


if __name__ == "__main__":
    cleanup_geotech_data()
