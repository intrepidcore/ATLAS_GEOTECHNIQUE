#!/usr/bin/env python3
"""
Script de génération de suggestions de géocodage
Parcourt les sondages sans géométrie et génère des suggestions ADM3
"""

import psycopg
import logging
from typing import List, Tuple, Optional
import re

logging.basicConfig(level=logging.INFO, format='%(asctime)s [%(levelname)s] %(message)s')
logger = logging.getLogger(__name__)

DSN = "postgresql://atlas:atlas@localhost:5432/atlas_clean"

def normalize_text(text: str) -> str:
    """Normaliser un texte pour matching"""
    if not text:
        return ""
    # Supprimer accents, mettre en majuscules, garder seulement alphanum
    text = text.upper()
    text = re.sub(r'[^A-Z0-9]+', '', text)
    return text

def levenshtein_distance(s1: str, s2: str) -> int:
    """Calcul distance de Levenshtein"""
    if len(s1) < len(s2):
        return levenshtein_distance(s2, s1)
    if len(s2) == 0:
        return len(s1)
    
    previous_row = range(len(s2) + 1)
    for i, c1 in enumerate(s1):
        current_row = [i + 1]
        for j, c2 in enumerate(s2):
            insertions = previous_row[j + 1] + 1
            deletions = current_row[j] + 1
            substitutions = previous_row[j] + (c1 != c2)
            current_row.append(min(insertions, deletions, substitutions))
        previous_row = current_row
    
    return previous_row[-1]

def calculate_similarity_score(text1: str, text2: str) -> float:
    """Calcul score de similarité (0-100)"""
    norm1 = normalize_text(text1)
    norm2 = normalize_text(text2)
    
    if not norm1 or not norm2:
        return 0.0
    
    # Match exact
    if norm1 == norm2:
        return 100.0
    
    # Contient
    if norm1 in norm2 or norm2 in norm1:
        return 85.0
    
    # Levenshtein
    max_len = max(len(norm1), len(norm2))
    distance = levenshtein_distance(norm1, norm2)
    score = (1 - distance / max_len) * 100
    
    return max(0.0, score)

def get_sondages_without_geom(conn) -> List[Tuple]:
    """Récupérer sondages sans géométrie"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT id, code, localite_base, localite_key, meta
            FROM public.sondages
            WHERE location_mode = 'unknown'
              AND geom IS NULL
              AND deleted_at IS NULL
            ORDER BY created_at DESC
        """)
        return cur.fetchall()

def get_adm3_list(conn) -> List[Tuple]:
    """Récupérer liste ADM3"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT gid, adm3_fr, adm3_pcode, adm2_fr, adm1_fr
            FROM adm3
            ORDER BY adm3_fr
        """)
        return cur.fetchall()

def find_adm3_candidates(sondage_localite: str, adm3_list: List[Tuple], top_n: int = 3) -> List[Tuple]:
    """Trouver les meilleurs candidats ADM3"""
    candidates = []
    
    for gid, adm3_fr, adm3_pcode, adm2_fr, adm1_fr in adm3_list:
        score = calculate_similarity_score(sondage_localite, adm3_fr)
        if score >= 60.0:  # Seuil minimum
            candidates.append((gid, adm3_fr, adm3_pcode, adm2_fr, adm1_fr, score))
    
    # Trier par score décroissant
    candidates.sort(key=lambda x: x[5], reverse=True)
    
    return candidates[:top_n]

def insert_suggestion(conn, sondage_id: str, sondage_code: str, localite: str,
                     candidates_list: List[Tuple[int, str, str, str, str, float]]):
    """Insérer une suggestion avec tous les candidats"""
    import json
    
    if not candidates_list:
        return
    
    # Premier candidat = top
    top_gid, top_name, top_pcode, _, _, top_score = candidates_list[0]
    
    with conn.cursor() as cur:
        # Créer ID unique
        suggestion_id = f"sugg_{sondage_id[:8]}_{top_pcode}"
        
        # Formater tous les candidats en JSON
        candidates_json = json.dumps([
            {
                "code": pcode,
                "name": name,
                "score": str(score)
            }
            for gid, name, pcode, adm2, adm1, score in candidates_list
        ])
        
        # Insérer
        cur.execute("""
            INSERT INTO public.geocode_suggestions (
                id, entity, entity_id, localite, candidates, top_code, top_score, 
                top_method, status, created_at
            ) VALUES (
                %s, 'sondage', %s, %s, %s, %s, %s, 'localite_match', 'pending', now()
            )
            ON CONFLICT (id) DO NOTHING
        """, (
            suggestion_id,
            sondage_id,
            localite,
            candidates_json,
            top_pcode,
            str(int(top_score))
        ))

def main():
    logger.info("🚀 Démarrage génération suggestions de géocodage")
    
    with psycopg.connect(DSN) as conn:
        conn.autocommit = False
        
        try:
            # Vider les suggestions pending existantes
            with conn.cursor() as cur:
                cur.execute("""
                    DELETE FROM public.geocode_suggestions 
                    WHERE status = 'pending' AND entity = 'sondage'
                """)
                deleted_count = cur.rowcount
                logger.info(f"🗑️  {deleted_count} suggestions pending supprimées")
            
            # Récupérer sondages
            logger.info("📍 Récupération sondages sans géométrie...")
            sondages = get_sondages_without_geom(conn)
            logger.info(f"  → {len(sondages)} sondages à traiter")
            
            # Récupérer ADM3
            logger.info("🗺️  Récupération liste ADM3...")
            adm3_list = get_adm3_list(conn)
            logger.info(f"  → {len(adm3_list)} ADM3 disponibles")
            
            # Générer suggestions
            logger.info("🔍 Génération des suggestions...")
            total_suggestions = 0
            
            for sondage_id, code, localite_base, localite_key, meta in sondages:
                if not localite_base and not localite_key:
                    continue
                
                search_text = localite_key or localite_base
                candidates = find_adm3_candidates(search_text, adm3_list, top_n=3)
                
                if candidates:
                    logger.info(f"  {code}: {len(candidates)} candidats trouvés")
                    insert_suggestion(
                        conn, str(sondage_id), code, search_text,
                        candidates
                    )
                    total_suggestions += 1
                    for gid, adm3_fr, adm3_pcode, adm2_fr, adm1_fr, score in candidates:
                        logger.info(f"    → {adm3_fr} (score: {score:.1f}%)")
            
            conn.commit()
            logger.info(f"✅ {total_suggestions} suggestions générées avec succès")
            
        except Exception as e:
            conn.rollback()
            logger.error(f"❌ Erreur: {e}")
            raise

if __name__ == "__main__":
    main()
