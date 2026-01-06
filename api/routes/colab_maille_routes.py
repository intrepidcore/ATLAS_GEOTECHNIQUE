"""
API Routes pour les attributions de mailles Colab
"""

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Optional
import psycopg2
from psycopg2.extras import RealDictCursor
import os

router = APIRouter(prefix="/api/colab/mailles", tags=["colab-mailles"])

def get_db_connection():
    """Obtenir une connexion à la base de données"""
    database_url = os.getenv('DATABASE_URL')
    if not database_url:
        raise HTTPException(status_code=500, detail="DATABASE_URL non configurée")
    
    try:
        conn = psycopg2.connect(database_url)
        return conn
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Erreur connexion DB: {str(e)}")

@router.get("/assignments")
async def get_maille_assignments(
    adm_code: Optional[str] = None,
    adm_niveau: Optional[str] = None
):
    """
    Récupère toutes les attributions de mailles
    
    Query params:
    - adm_code: Filtrer par code ADM (optionnel)
    - adm_niveau: Filtrer par niveau ADM2/ADM3 (optionnel)
    """
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        query = """
            SELECT 
                student_id,
                nom,
                prenom,
                email,
                telephone,
                maille_id,
                maille_code,
                adm_code_used,
                adm_niveau,
                pref_rank_used,
                assigned_at,
                ST_AsGeoJSON(bbox)::json as bbox_geojson
            FROM atlas.v_colab_maille_assignment_details
            WHERE 1=1
        """
        
        params = []
        
        if adm_code:
            query += " AND adm_code_used = %s"
            params.append(adm_code)
        
        if adm_niveau:
            query += " AND adm_niveau = %s"
            params.append(adm_niveau)
        
        query += " ORDER BY assigned_at DESC"
        
        cursor.execute(query, params)
        assignments = cursor.fetchall()
        
        return {
            "success": True,
            "count": len(assignments),
            "data": assignments
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/stats")
async def get_maille_stats():
    """Récupère les statistiques d'attribution par ADM"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                adm_code_used,
                adm_niveau,
                nb_etudiants,
                nb_mailles_attribuees,
                first_assignment,
                last_assignment
            FROM atlas.v_colab_assignments_by_adm
            ORDER BY nb_etudiants DESC
        """)
        
        stats = cursor.fetchall()
        
        return {
            "success": True,
            "count": len(stats),
            "data": stats
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/students-without-maille")
async def get_students_without_maille():
    """Récupère les étudiants sans maille attribuée"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        cursor.execute("""
            SELECT 
                student_id,
                nom,
                prenom,
                email,
                adm_niveau,
                adm_code_pref_1,
                adm_code_pref_2,
                adm_code_pref_3
            FROM atlas.v_colab_students_without_maille
            ORDER BY student_id
        """)
        
        students = cursor.fetchall()
        
        return {
            "success": True,
            "count": len(students),
            "data": students
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()

@router.get("/summary")
async def get_assignment_summary():
    """Récupère un résumé global des attributions"""
    conn = get_db_connection()
    cursor = conn.cursor(cursor_factory=RealDictCursor)
    
    try:
        # Total étudiants avec maille
        cursor.execute("SELECT COUNT(*) as total FROM atlas.colab_maille_assignments")
        total_assigned = cursor.fetchone()['total']
        
        # Total étudiants sans maille
        cursor.execute("SELECT COUNT(*) as total FROM atlas.v_colab_students_without_maille")
        total_unassigned = cursor.fetchone()['total']
        
        # Total mailles utilisées
        cursor.execute("SELECT COUNT(DISTINCT maille_id) as total FROM atlas.colab_maille_assignments")
        total_mailles = cursor.fetchone()['total']
        
        # Répartition par préférence
        cursor.execute("""
            SELECT 
                pref_rank_used,
                COUNT(*) as count
            FROM atlas.v_colab_maille_assignment_details
            GROUP BY pref_rank_used
            ORDER BY pref_rank_used
        """)
        pref_distribution = cursor.fetchall()
        
        # Répartition par ADM niveau
        cursor.execute("""
            SELECT 
                adm_niveau,
                COUNT(*) as count
            FROM atlas.v_colab_maille_assignment_details
            GROUP BY adm_niveau
            ORDER BY adm_niveau
        """)
        adm_distribution = cursor.fetchall()
        
        return {
            "success": True,
            "data": {
                "total_assigned": total_assigned,
                "total_unassigned": total_unassigned,
                "total_mailles_used": total_mailles,
                "preference_distribution": pref_distribution,
                "adm_distribution": adm_distribution
            }
        }
        
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        cursor.close()
        conn.close()
