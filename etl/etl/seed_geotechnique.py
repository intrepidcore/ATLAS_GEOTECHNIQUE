#!/usr/bin/env python3
"""
Script pour générer des données géotechniques fictives
Usage: python -m etl.seed_geotechnique
"""

import random
import uuid
from datetime import date, timedelta
from typing import List, Dict, Tuple
import psycopg2
from psycopg2.extras import execute_batch


# Configuration
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas',
    'user': 'atlas',
    'password': 'atlas_password'
}

# Types de sols avec corrélations réalistes
SOIL_TYPES = {
    'argileux': {
        'passant_80um': (50, 90),
        'passant_2mm': (85, 100),
        'wl': (40, 90),
        'ip': (25, 60),
        'vbs': (2.5, 8),
        'gamma_d_max': (15, 18),
        'w_opt': (18, 28),
        'eg': (2, 12),
        'weight': 0.25
    },
    'limoneux': {
        'passant_80um': (35, 60),
        'passant_2mm': (70, 95),
        'wl': (25, 45),
        'ip': (10, 25),
        'vbs': (1, 3),
        'gamma_d_max': (17, 19),
        'w_opt': (12, 20),
        'eg': (0.5, 3),
        'weight': 0.30
    },
    'sableux': {
        'passant_80um': (5, 25),
        'passant_2mm': (50, 85),
        'wl': (15, 30),
        'ip': (0, 10),
        'vbs': (0, 1),
        'gamma_d_max': (18, 21),
        'w_opt': (8, 14),
        'eg': (0, 0.8),
        'weight': 0.30
    },
    'graveleux': {
        'passant_80um': (0, 15),
        'passant_2mm': (20, 60),
        'wl': None,  # Non plastique
        'ip': None,
        'vbs': (0, 0.5),
        'gamma_d_max': (20, 23),
        'w_opt': (5, 10),
        'eg': (0, 0.3),
        'weight': 0.15
    }
}

LABORATORIES = ['LBTP Lomé', 'LNBTP', 'SGS Togo', 'Bureau Veritas', 'Labogéo']
NORMS = ['NF P94-051', 'NF P94-068', 'ASTM D4318', 'ASTM D698', 'ASTM D1557']


def get_db_connection():
    """Connexion à la base de données"""
    return psycopg2.connect(**DB_CONFIG)


def fetch_sondages(conn) -> List[Tuple[str, float]]:
    """Récupère les sondages existants avec leur profondeur max"""
    with conn.cursor() as cur:
        cur.execute("""
            SELECT s.id, COALESCE(MAX(e.depth_m), 20) as max_depth
            FROM sondages s
            LEFT JOIN essais_geotechniques e ON e.sondage_id = s.id
            GROUP BY s.id
            LIMIT 200
        """)
        return cur.fetchall()


def generate_value(range_tuple: Tuple[float, float], distribution='triangular') -> float:
    """Génère une valeur dans une plage avec distribution"""
    if range_tuple is None:
        return None
    
    min_val, max_val = range_tuple
    
    if distribution == 'triangular':
        # Distribution triangulaire (pic au milieu)
        mode = (min_val + max_val) / 2
        return random.triangular(min_val, max_val, mode)
    elif distribution == 'uniform':
        return random.uniform(min_val, max_val)
    else:
        return random.gauss((min_val + max_val) / 2, (max_val - min_val) / 6)


def select_soil_type() -> str:
    """Sélectionne un type de sol selon pondération"""
    rand = random.random()
    cumulative = 0
    for soil_type, params in SOIL_TYPES.items():
        cumulative += params['weight']
        if rand <= cumulative:
            return soil_type
    return 'limoneux'  # Fallback


def generate_correlated_values(soil_type: str) -> Dict:
    """Génère des valeurs corrélées pour un type de sol"""
    params = SOIL_TYPES[soil_type]
    
    # Granulométrie
    passant_80um = generate_value(params['passant_80um'])
    passant_2mm = generate_value(params['passant_2mm'])
    passant_20mm = random.uniform(passant_2mm, 100) if passant_2mm else None
    
    # Atterberg (corrélé avec passant_80um)
    if params['wl'] is not None:
        # Plus de fines → WL et IP plus élevés
        wl_base = generate_value(params['wl'])
        # Ajustement selon passant_80um
        wl_factor = (passant_80um - 20) / 70  # 0 à 1
        wl = wl_base * (0.8 + 0.4 * wl_factor)
        
        ip_base = generate_value(params['ip'])
        ip = ip_base * (0.8 + 0.4 * wl_factor)
        
        # WP = WL - IP
        wp = wl - ip
        
        # Vérifier cohérence
        if wp < 0 or ip < 0:
            wl = None
            wp = None
    else:
        wl = None
        wp = None
    
    # VBS (corrélé avec IP et passant_80um)
    vbs_base = generate_value(params['vbs'])
    if wl is not None and ip is not None:
        # Relation empirique: VBS ≈ IP / 1.5
        vbs_from_ip = ip / 1.5
        # Moyenne pondérée
        vbs = 0.7 * vbs_base + 0.3 * vbs_from_ip
    else:
        vbs = vbs_base
    
    # Proctor
    gamma_d_max = generate_value(params['gamma_d_max'])
    w_opt = generate_value(params['w_opt'])
    proctor_type = random.choice(['normal', 'modifie'])
    
    # Gonflement (corrélé avec IP et VBS)
    eg_base = generate_value(params['eg'])
    if wl is not None and ip is not None:
        # IP élevé → eg élevé
        if ip > 40:
            eg = eg_base * random.uniform(1.2, 1.5)
        elif ip > 25:
            eg = eg_base * random.uniform(1.0, 1.2)
        else:
            eg = eg_base * random.uniform(0.8, 1.0)
    else:
        eg = eg_base
    
    return {
        'passant_80um': round(passant_80um, 1) if passant_80um else None,
        'passant_2mm': round(passant_2mm, 1) if passant_2mm else None,
        'passant_20mm': round(passant_20mm, 1) if passant_20mm else None,
        'wl': round(wl, 1) if wl else None,
        'wp': round(wp, 1) if wp else None,
        'vbs': round(vbs, 2) if vbs else None,
        'gamma_d_max': round(gamma_d_max, 1) if gamma_d_max else None,
        'w_opt': round(w_opt, 1) if w_opt else None,
        'proctor_type': proctor_type,
        'eg': round(eg, 2) if eg else None
    }


def generate_essais(sondages: List[Tuple[str, float]], n_essais: int = 200) -> List[Dict]:
    """Génère des essais géotechniques fictifs"""
    essais = []
    
    for _ in range(n_essais):
        # Sélectionner un sondage aléatoire
        sondage_id, max_depth = random.choice(sondages)
        
        # Profondeur (distribution triangulaire, pic à 8m)
        depth = random.triangular(1, min(max_depth, 20), 8)
        
        # Type de sol (peut varier avec la profondeur)
        soil_type = select_soil_type()
        
        # Générer valeurs corrélées
        values = generate_correlated_values(soil_type)
        
        # Date de test (derniers 2 ans)
        days_ago = random.randint(0, 730)
        test_date = date.today() - timedelta(days=days_ago)
        
        essai = {
            'id': str(uuid.uuid4()),
            'sondage_id': sondage_id,
            'depth_m': round(depth, 2),
            **values,
            'test_date': test_date,
            'laboratory': random.choice(LABORATORIES),
            'norm': random.choice(NORMS),
            'meta': '{}'
        }
        
        essais.append(essai)
    
    return essais


def insert_essais(conn, essais: List[Dict]):
    """Insère les essais dans la base de données"""
    with conn.cursor() as cur:
        query = """
            INSERT INTO essais_geotechniques (
                id, sondage_id, depth_m,
                passant_80um, passant_2mm, passant_20mm,
                wl, wp, vbs,
                gamma_d_max, w_opt, proctor_type,
                eg, test_date, laboratory, norm, meta
            ) VALUES (
                %(id)s, %(sondage_id)s, %(depth_m)s,
                %(passant_80um)s, %(passant_2mm)s, %(passant_20mm)s,
                %(wl)s, %(wp)s, %(vbs)s,
                %(gamma_d_max)s, %(w_opt)s, %(proctor_type)s,
                %(eg)s, %(test_date)s, %(laboratory)s, %(norm)s, %(meta)s
            )
        """
        
        execute_batch(cur, query, essais, page_size=100)
        conn.commit()
        print(f"✅ {len(essais)} essais insérés")


def refresh_matview(conn):
    """Rafraîchit la vue matérialisée"""
    with conn.cursor() as cur:
        print("🔄 Rafraîchissement de la vue matérialisée...")
        cur.execute("SELECT refresh_mailles_geotechnique_stats()")
        conn.commit()
        print("✅ Vue matérialisée rafraîchie")


def print_statistics(conn):
    """Affiche des statistiques sur les données générées"""
    with conn.cursor() as cur:
        # Statistiques globales
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(CASE WHEN ip IS NOT NULL THEN 1 END) as with_ip,
                COUNT(CASE WHEN vbs IS NOT NULL THEN 1 END) as with_vbs,
                COUNT(CASE WHEN eg IS NOT NULL THEN 1 END) as with_eg,
                ROUND(AVG(ip), 2) as ip_avg,
                ROUND(AVG(vbs), 2) as vbs_avg,
                ROUND(AVG(eg), 2) as eg_avg
            FROM essais_geotechniques
        """)
        stats = cur.fetchone()
        
        print("\n📊 Statistiques des essais géotechniques:")
        print(f"  Total: {stats[0]}")
        print(f"  Avec IP: {stats[1]} ({stats[1]/stats[0]*100:.1f}%)")
        print(f"  Avec VBS: {stats[2]} ({stats[2]/stats[0]*100:.1f}%)")
        print(f"  Avec eg: {stats[3]} ({stats[3]/stats[0]*100:.1f}%)")
        print(f"  IP moyen: {stats[4]}")
        print(f"  VBS moyen: {stats[5]}")
        print(f"  eg moyen: {stats[6]}")
        
        # Statistiques par classe IP
        cur.execute("""
            SELECT 
                COUNT(CASE WHEN ip < 12 THEN 1 END) as ip_faible,
                COUNT(CASE WHEN ip BETWEEN 12 AND 25 THEN 1 END) as ip_moyen,
                COUNT(CASE WHEN ip BETWEEN 25 AND 40 THEN 1 END) as ip_plastique,
                COUNT(CASE WHEN ip >= 40 THEN 1 END) as ip_tres_plastique
            FROM essais_geotechniques
            WHERE ip IS NOT NULL
        """)
        ip_classes = cur.fetchone()
        
        print("\n📈 Distribution IP:")
        print(f"  Faible (<12): {ip_classes[0]}")
        print(f"  Moyen (12-25): {ip_classes[1]}")
        print(f"  Plastique (25-40): {ip_classes[2]}")
        print(f"  Très plastique (>40): {ip_classes[3]}")
        
        # Statistiques mailles
        cur.execute("""
            SELECT 
                COUNT(*) as total_mailles,
                COUNT(CASE WHEN n_sondages > 0 THEN 1 END) as mailles_avec_sondages,
                COUNT(CASE WHEN n_essais_geo > 0 THEN 1 END) as mailles_avec_essais,
                ROUND(AVG(n_essais_geo), 2) as essais_par_maille
            FROM mailles_geotechnique_stats
        """)
        mailles_stats = cur.fetchone()
        
        print("\n🗺️ Statistiques mailles:")
        print(f"  Total mailles: {mailles_stats[0]}")
        print(f"  Avec sondages: {mailles_stats[1]}")
        print(f"  Avec essais: {mailles_stats[2]}")
        print(f"  Essais/maille: {mailles_stats[3]}")


def main():
    """Fonction principale"""
    print("🚀 Génération de données géotechniques fictives\n")
    
    try:
        # Connexion
        conn = get_db_connection()
        print("✅ Connexion à la base de données")
        
        # Récupérer sondages
        sondages = fetch_sondages(conn)
        if not sondages:
            print("❌ Aucun sondage trouvé. Créez d'abord des sondages.")
            return
        
        print(f"✅ {len(sondages)} sondages trouvés")
        
        # Générer essais
        print("\n🔧 Génération des essais...")
        essais = generate_essais(sondages, n_essais=200)
        print(f"✅ {len(essais)} essais générés")
        
        # Insérer
        print("\n💾 Insertion dans la base...")
        insert_essais(conn, essais)
        
        # Rafraîchir MatView
        refresh_matview(conn)
        
        # Statistiques
        print_statistics(conn)
        
        print("\n✅ Génération terminée avec succès!")
        
    except Exception as e:
        print(f"\n❌ Erreur: {e}")
        raise
    finally:
        if conn:
            conn.close()


if __name__ == '__main__':
    main()
