"""
Post-traitement automatique après export Atlas ADM1
Exécute migration SQL + génération stats Python
"""

import os
import sys
import subprocess
from pathlib import Path
from datetime import datetime
import logging

# Configuration
PROJECT_ROOT = Path(__file__).parent.parent.parent
DB_MIGRATION_PATH = PROJECT_ROOT / 'db' / 'migrations' / '007_enrichir_mailles_adm2_prefectures.sql'
PYTHON_STATS_SCRIPT = PROJECT_ROOT / 'scripts' / 'generate_stats_prefecture.py'
PYTHON_GRAPHS_SCRIPT = PROJECT_ROOT / 'scripts' / 'generate_national_graphs.py'

# Logging
logging.basicConfig(level=logging.INFO, format='[%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)


def run_sql_migration():
    """Exécute la migration SQL PostGIS"""
    logger.info("═" * 70)
    logger.info("ÉTAPE 1: Migration SQL - Enrichissement mailles → préfectures")
    logger.info("═" * 70)
    
    if not DB_MIGRATION_PATH.exists():
        logger.warning(f"⚠️ Migration SQL non trouvée: {DB_MIGRATION_PATH}")
        return False
    
    # Récupérer config DB depuis env
    db_host = os.getenv('DB_HOST', 'localhost')
    db_port = os.getenv('DB_PORT', '5432')
    db_name = os.getenv('DB_NAME', 'atlas_geotechnique')
    db_user = os.getenv('DB_USER', 'postgres')
    
    try:
        cmd = [
            'psql',
            '-h', db_host,
            '-p', db_port,
            '-U', db_user,
            '-d', db_name,
            '-f', str(DB_MIGRATION_PATH)
        ]
        
        logger.info(f"Exécution: psql -h {db_host} -d {db_name} -f {DB_MIGRATION_PATH.name}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300  # 5 minutes max
        )
        
        if result.returncode == 0:
            logger.info("✅ Migration SQL terminée avec succès")
            # Afficher output important
            if "CONTRÔLE QUALITÉ" in result.stdout:
                logger.info(result.stdout[result.stdout.index("CONTRÔLE QUALITÉ"):])
            return True
        else:
            logger.error(f"❌ Migration SQL échouée: {result.stderr}")
            return False
            
    except FileNotFoundError:
        logger.error("❌ psql non trouvé - installer PostgreSQL client")
        return False
    except subprocess.TimeoutExpired:
        logger.error("❌ Migration SQL timeout (> 5 min)")
        return False
    except Exception as e:
        logger.error(f"❌ Erreur migration SQL: {e}")
        return False


def run_python_graphs():
    """Exécute le script Python de génération graphiques nationaux"""
    logger.info("\n" + "═" * 70)
    logger.info("ÉTAPE 2: Python Graphs - Graphiques nationaux (bar, histogram, pie)")
    logger.info("═" * 70)
    
    if not PYTHON_GRAPHS_SCRIPT.exists():
        logger.warning(f"⚠️ Script Python non trouvé: {PYTHON_GRAPHS_SCRIPT}")
        return False
    
    try:
        cmd = [sys.executable, str(PYTHON_GRAPHS_SCRIPT)]
        
        logger.info(f"Exécution: python {PYTHON_GRAPHS_SCRIPT.name}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=300,  # 5 minutes max
            cwd=str(PROJECT_ROOT)
        )
        
        if result.returncode == 0:
            logger.info("✅ Graphiques nationaux générés avec succès")
            # Afficher résumé
            if "TERMINÉ" in result.stdout:
                logger.info(result.stdout[result.stdout.rindex("═"):])
            return True
        else:
            logger.error(f"❌ Graphiques nationaux échoués: {result.stderr}")
            return False
            
    except FileNotFoundError:
        logger.error("❌ Python non trouvé")
        return False
    except subprocess.TimeoutExpired:
        logger.error("❌ Graphiques nationaux timeout (> 5 min)")
        return False
    except Exception as e:
        logger.error(f"❌ Erreur graphiques nationaux: {e}")
        return False


def run_python_stats():
    """Exécute le script Python de génération stats préfectures"""
    logger.info("\n" + "═" * 70)
    logger.info("ÉTAPE 3: Python Stats - Boxplots + Choroplèthes par préfecture")
    logger.info("═" * 70)
    
    if not PYTHON_STATS_SCRIPT.exists():
        logger.warning(f"⚠️ Script Python non trouvé: {PYTHON_STATS_SCRIPT}")
        return False
    
    try:
        cmd = [sys.executable, str(PYTHON_STATS_SCRIPT)]
        
        logger.info(f"Exécution: python {PYTHON_STATS_SCRIPT.name}")
        
        result = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            timeout=600,  # 10 minutes max
            cwd=str(PROJECT_ROOT)
        )
        
        if result.returncode == 0:
            logger.info("✅ Stats Python générées avec succès")
            # Afficher résumé
            if "TERMINÉ" in result.stdout:
                logger.info(result.stdout[result.stdout.rindex("═"):])
            return True
        else:
            logger.error(f"❌ Stats Python échouées: {result.stderr}")
            return False
            
    except FileNotFoundError:
        logger.error("❌ Python non trouvé")
        return False
    except subprocess.TimeoutExpired:
        logger.error("❌ Stats Python timeout (> 10 min)")
        return False
    except Exception as e:
        logger.error(f"❌ Erreur stats Python: {e}")
        return False


def post_process_export_adm1():
    """
    Post-traitement complet après export ADM1
    Retourne True si tout OK, False sinon
    """
    logger.info("\n" + "█" * 70)
    logger.info("POST-TRAITEMENT EXPORT ADM1")
    logger.info(f"Date: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    logger.info("█" * 70 + "\n")
    
    success = True
    
    # Étape 1: Migration SQL
    if not run_sql_migration():
        logger.warning("⚠️ Migration SQL échouée - stats préfectures non disponibles")
        success = False
    
    # Étape 2: Graphiques nationaux (TOUJOURS exécuté, indépendant de SQL)
    if not run_python_graphs():
        logger.warning("⚠️ Graphiques nationaux échoués")
        # Ne pas bloquer le reste
    
    # Étape 3: Stats Python préfectures (seulement si SQL OK)
    if success:
        if not run_python_stats():
            logger.warning("⚠️ Stats Python échouées - visualisations préfectures non disponibles")
            success = False
    
    # Résumé final
    logger.info("\n" + "█" * 70)
    if success:
        logger.info("✅ POST-TRAITEMENT TERMINÉ AVEC SUCCÈS")
    else:
        logger.info("⚠️ POST-TRAITEMENT TERMINÉ AVEC ERREURS")
    logger.info("█" * 70 + "\n")
    
    return success


if __name__ == '__main__':
    success = post_process_export_adm1()
    sys.exit(0 if success else 1)
