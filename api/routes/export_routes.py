"""
Routes API pour post-traitement export Atlas
"""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import JSONResponse
import subprocess
import sys
from pathlib import Path
import logging

router = APIRouter(prefix="/export", tags=["export"])
logger = logging.getLogger(__name__)

# Chemin vers le script post-traitement
PROJECT_ROOT = Path(__file__).parent.parent.parent
POST_PROCESS_SCRIPT = PROJECT_ROOT / 'api' / 'routes' / 'export_post_process.py'


@router.post("/post-process/adm1")
async def post_process_adm1_export():
    """
    Post-traitement automatique après export ADM1
    Exécute migration SQL + génération stats Python
    """
    logger.info("POST-TRAITEMENT ADM1 - Début")
    
    if not POST_PROCESS_SCRIPT.exists():
        logger.error(f"Script post-traitement non trouvé: {POST_PROCESS_SCRIPT}")
        raise HTTPException(
            status_code=500,
            detail="Script post-traitement non disponible"
        )
    
    try:
        # Exécuter le script Python en subprocess
        result = subprocess.run(
            [sys.executable, str(POST_PROCESS_SCRIPT)],
            capture_output=True,
            text=True,
            timeout=900,  # 15 minutes max
            cwd=str(PROJECT_ROOT)
        )
        
        success = result.returncode == 0
        
        # Parser la sortie pour extraire infos importantes
        output_lines = result.stdout.split('\n')
        sql_success = any('Migration SQL terminée avec succès' in line for line in output_lines)
        python_success = any('Stats Python générées avec succès' in line for line in output_lines)
        
        response_data = {
            "success": success,
            "sql_migration": sql_success,
            "python_stats": python_success,
            "message": "Post-traitement terminé" if success else "Post-traitement avec erreurs",
            "details": {
                "stdout": result.stdout[-1000:] if result.stdout else "",  # Derniers 1000 chars
                "stderr": result.stderr[-500:] if result.stderr else ""
            }
        }
        
        if success:
            logger.info("POST-TRAITEMENT ADM1 - Succès")
            return JSONResponse(content=response_data, status_code=200)
        else:
            logger.warning(f"POST-TRAITEMENT ADM1 - Erreurs: {result.stderr}")
            return JSONResponse(content=response_data, status_code=207)  # Multi-Status
            
    except subprocess.TimeoutExpired:
        logger.error("POST-TRAITEMENT ADM1 - Timeout (> 15 min)")
        raise HTTPException(
            status_code=504,
            detail="Post-traitement timeout (> 15 min)"
        )
    except Exception as e:
        logger.error(f"POST-TRAITEMENT ADM1 - Erreur: {e}")
        raise HTTPException(
            status_code=500,
            detail=f"Erreur post-traitement: {str(e)}"
        )


@router.get("/post-process/status")
async def get_post_process_status():
    """
    Vérifie la disponibilité du service post-traitement
    """
    script_exists = POST_PROCESS_SCRIPT.exists()
    
    # Vérifier dépendances
    dependencies = {
        "psql": subprocess.run(["where", "psql"], capture_output=True).returncode == 0,
        "python": True,  # Toujours vrai si on exécute ce code
        "script": script_exists
    }
    
    return {
        "available": all(dependencies.values()),
        "dependencies": dependencies,
        "script_path": str(POST_PROCESS_SCRIPT)
    }
