#!/usr/bin/env python3
"""
Générateur de 25 000 sondages géotechniques aléatoires pour le Togo
Avec essais variés, profondeurs multiples, dates et opérateurs réalistes
"""

import psycopg2
import random
import uuid
from datetime import datetime, timedelta
from typing import List, Tuple, Dict
import math

# ============================================================================
# CONFIGURATION
# ============================================================================

N_SURVEYS_TARGET = 25000
BATCH_SIZE = 1000
RNG_SEED = 42
SRID_DB = 25231  # UTM Zone 31N
SRID_UI = 4326   # WGS84

# Connection string
DB_CONFIG = {
    'host': 'localhost',
    'port': 5432,
    'database': 'atlas',
    'user': 'atlas',
    'password': 'atlas'
}

# ============================================================================
# DISTRIBUTIONS
# ============================================================================

LOCATION_MODES = [
    ('exact', 0.70),
    ('centroid', 0.20),
    ('random', 0.10)
]

OPERATORS = [
    ('LNBTP', 0.15),
    ('LABOGENIE', 0.12),
    ('CEBTP Togo', 0.10),
    ('SOGEA-SATOM', 0.08),
    ('RAZEL', 0.08),
    ('EIFFAGE', 0.07),
    ('BOUYGUES', 0.06),
    ('Lab. Géotech Lomé', 0.05),
    ('COLAS', 0.05),
    ('EGIS', 0.04),
    ('SETAO', 0.04),
    ('BCEOM', 0.03),
    ('SCET-Tunisie', 0.03),
    ('BNETD', 0.03),
    ('Indépendant', 0.07)
]

SOURCES = [
    ('Étude routière', 0.25),
    ('Étude bâtiment', 0.20),
    ('Étude pont', 0.15),
    ('Étude barrage', 0.10),
    ('Campagne géotechnique', 0.15),
    ('Reconnaissance préliminaire', 0.10),
    ('Contrôle qualité', 0.05)
]

SOIL_TYPES = [
    ('Ferrugineux Tropicaux Lessivés', 0.25),
    ('Ferrugineux Tropicaux et Pseudogley', 0.20),
    ('Hydromorphes', 0.20),
    ('Vertisols et Paravertisols', 0.15),
    ('Ferralitique Typique ou Modaux', 0.10),
    ('Faiblement Ferralitique', 0.05),
    ('Autre', 0.05)
]

TEST_TYPES = {
    'SPT_N': 0.70,
    'qc': 0.50,
    'Granulometrie': 0.60,
    'BleuMethylene_VBS': 0.45,
    'Atterberg': 0.55,
    'Proctor': 0.25,
    'PotentielGonflement_eg': 0.20
}

# ============================================================================
# FONCTIONS UTILITAIRES
# ============================================================================

def weighted_choice(choices: List[Tuple[str, float]]) -> str:
    """Choix pondéré"""
    total = sum(w for _, w in choices)
    r = random.uniform(0, total)
    upto = 0
    for choice, weight in choices:
        if upto + weight >= r:
            return choice
        upto += weight
    return choices[-1][0]

def clamp(x: float, min_val: float, max_val: float) -> float:
    """Borner une valeur"""
    return max(min_val, min(max_val, x))

def random_normal(mu: float, sigma: float, min_val: float, max_val: float) -> float:
    """Normal bornée"""
    return clamp(random.gauss(mu, sigma), min_val, max_val)

def random_lognormal(mu_log: float, sigma_log: float, min_val: float, max_val: float) -> float:
    """Log-normale bornée"""
    return clamp(random.lognormvariate(mu_log, sigma_log), min_val, max_val)

def random_triangular(a: float, b: float, mode: float) -> float:
    """Distribution triangulaire"""
    return random.triangular(a, b, mode)

def random_date(start_date: datetime, end_date: datetime) -> str:
    """Date aléatoire"""
    delta = end_date - start_date
    random_days = random.randint(0, delta.days)
    return (start_date + timedelta(days=random_days)).strftime('%Y-%m-%d')

def jitter_point(lon: float, lat: float, radius_m: float) -> Tuple[float, float]:
    """Ajouter un bruit spatial (en degrés approximatifs)"""
    # 1 degré ≈ 111 km
    radius_deg = radius_m / 111000.0
    angle = random.uniform(0, 2 * math.pi)
    distance = random.uniform(0, radius_deg)
    return (
        lon + distance * math.cos(angle),
        lat + distance * math.sin(angle)
    )

# ============================================================================
# GÉNÉRATION DES ESSAIS
# ============================================================================

def sample_test_types() -> List[str]:
    """Échantillonner les types d'essais pour un sondage"""
    tests = []
    for test_type, prob in TEST_TYPES.items():
        if random.random() < prob:
            tests.append(test_type)
    return tests if tests else ['SPT_N']  # Au moins un essai

def generate_test_value(test_type: str) -> float:
    """Générer une valeur réaliste pour un type d'essai"""
    if test_type == 'SPT_N':
        return round(random_normal(18, 7, 1, 80), 0)
    elif test_type == 'qc':
        return round(random_lognormal(1.2, 0.4, 0.1, 20), 2)
    elif test_type == 'Granulometrie':
        return round(random_normal(70, 15, 0, 100), 1)
    elif test_type == 'BleuMethylene_VBS':
        return round(random_normal(3.0, 1.0, 0.2, 8.0), 2)
    elif test_type == 'Atterberg_WL':
        return round(random_normal(45, 12, 15, 100), 1)
    elif test_type == 'Atterberg_WP':
        return round(random_normal(22, 8, 5, 60), 1)
    elif test_type == 'Proctor_gdmax':
        return round(random_normal(1.95, 0.12, 1.5, 2.3), 3)
    elif test_type == 'Proctor_wopt':
        return round(random_normal(12, 3, 5, 25), 1)
    elif test_type == 'PotentielGonflement_eg':
        return round(random_normal(5.0, 2.0, 0.5, 15.0), 2)
    else:
        return round(random.uniform(1, 100), 2)

def get_test_unit(test_type: str) -> str:
    """Unité pour un type d'essai"""
    units = {
        'SPT_N': 'blows/30cm',
        'qc': 'MPa',
        'Granulometrie': '%',
        'BleuMethylene_VBS': 'g/100g',
        'Atterberg_WL': '%',
        'Atterberg_WP': '%',
        'Atterberg_IP': '%',
        'Proctor_gdmax': 't/m³',
        'Proctor_wopt': '%',
        'PotentielGonflement_eg': '%'
    }
    return units.get(test_type, '')

# ============================================================================
# GÉNÉRATION DES SONDAGES
# ============================================================================

def generate_survey(conn, adm_zones: List[Dict]) -> Tuple[str, List[Dict]]:
    """Générer un sondage avec ses essais"""
    
    # 1. Choisir une zone ADM
    adm = random.choice(adm_zones)
    
    # 2. Mode de localisation
    loc_mode = weighted_choice(LOCATION_MODES)
    
    # 3. Générer point géographique
    if loc_mode == 'exact':
        # Point aléatoire dans la zone
        lon, lat = adm['lon'], adm['lat']
        lon, lat = jitter_point(lon, lat, 5000)  # ±5km
    elif loc_mode == 'centroid':
        lon, lat = adm['lon'], adm['lat']
        lon, lat = jitter_point(lon, lat, 150)  # ±150m
    else:  # random
        lon, lat = adm['lon'], adm['lat']
        lon, lat = jitter_point(lon, lat, 400)  # ±400m
    
    # 4. Métadonnées
    survey_id = str(uuid.uuid4())
    code = f"SND-{adm['adm3_pcode']}-{str(uuid.uuid4())[:8]}"  # UUID court pour unicité
    date = random_date(datetime(2015, 1, 1), datetime.now())
    source = weighted_choice(SOURCES)
    operator = weighted_choice(OPERATORS)
    soil_type = weighted_choice(SOIL_TYPES)
    
    # 5. Profondeurs
    n_depths = weighted_choice([(1, 0.4), (2, 0.3), (3, 0.2), (4, 0.1)])
    depths = sorted([round(random_triangular(1.0, 20.0, 6.0), 1) for _ in range(int(n_depths))])
    
    # 6. Types d'essais
    test_types = sample_test_types()
    
    # 7. Générer les essais
    tests = []
    for depth in depths:
        for test_type in test_types:
            # Gérer Atterberg (WL, WP, IP ensemble)
            if test_type == 'Atterberg':
                wl = generate_test_value('Atterberg_WL')
                wp = generate_test_value('Atterberg_WP')
                ip = max(wl - wp, 0)
                tests.append({
                    'sondage_id': survey_id,
                    'type': 'Atterberg_WL',
                    'depth': depth,
                    'value': wl,
                    'unit': '%'
                })
                tests.append({
                    'sondage_id': survey_id,
                    'type': 'Atterberg_WP',
                    'depth': depth,
                    'value': wp,
                    'unit': '%'
                })
                tests.append({
                    'sondage_id': survey_id,
                    'type': 'Atterberg_IP',
                    'depth': depth,
                    'value': ip,
                    'unit': '%'
                })
            # Gérer Proctor (gdmax + wopt ensemble)
            elif test_type == 'Proctor':
                gdmax = generate_test_value('Proctor_gdmax')
                wopt = generate_test_value('Proctor_wopt')
                tests.append({
                    'sondage_id': survey_id,
                    'type': 'Proctor_gdmax',
                    'depth': depth,
                    'value': gdmax,
                    'unit': 't/m³'
                })
                tests.append({
                    'sondage_id': survey_id,
                    'type': 'Proctor_wopt',
                    'depth': depth,
                    'value': wopt,
                    'unit': '%'
                })
            else:
                tests.append({
                    'sondage_id': survey_id,
                    'type': test_type,
                    'depth': depth,
                    'value': generate_test_value(test_type),
                    'unit': get_test_unit(test_type)
                })
    
    survey = {
        'id': survey_id,
        'code': code,
        'lon': lon,
        'lat': lat,
        'date': date,
        'source': source,
        'operator': operator,
        'soil_type': soil_type,
        'location_mode': loc_mode,
        'adm1_id': adm['adm1_gid'],
        'adm2_id': adm['adm2_gid'],
        'adm3_id': adm['adm3_gid']
    }
    
    return survey, tests

# ============================================================================
# INSERTION EN BASE
# ============================================================================

def insert_batch(conn, surveys: List[Dict], all_tests: List[Dict]):
    """Insérer un batch de sondages et essais"""
    cur = conn.cursor()
    
    try:
        # Insérer les sondages
        for s in surveys:
            cur.execute("""
                INSERT INTO sondages (
                    id, code, geom, date_sondage, source, operator, type_sol,
                    location_mode, is_geocoded, location_accuracy,
                    adm1_id, adm2_id, adm3_id, created_at
                )
                VALUES (
                    %s, %s, 
                    ST_Transform(ST_SetSRID(ST_MakePoint(%s, %s), 4326), 25231),
                    %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, now()
                )
            """, (
                s['id'], s['code'], s['lon'], s['lat'], s['date'],
                s['source'], s['operator'], s['soil_type'],
                s['location_mode'],
                s['location_mode'] != 'unknown',  # is_geocoded
                'exact' if s['location_mode'] == 'exact' else f"{s['location_mode']}_adm3",
                None, None, None  # adm_id en NULL pour l'instant (UUID vs gid)
            ))
        
        # Insérer les essais
        for t in all_tests:
            cur.execute("""
                INSERT INTO essais (
                    id, sondage_id, type_essai, depth_m, valeur_numerique, unit, created_at
                )
                VALUES (gen_random_uuid(), %s, %s, %s, %s, %s, now())
            """, (
                t['sondage_id'], t['type'], t['depth'], t['value'], t['unit']
            ))
        
        conn.commit()
        return len(surveys)
        
    except Exception as e:
        conn.rollback()
        print(f"❌ Erreur insertion: {e}")
        raise

# ============================================================================
# MAIN
# ============================================================================

def main():
    print("\n🎲 Générateur de 25 000 sondages géotechniques")
    print("=" * 80)
    
    random.seed(RNG_SEED)
    
    # Connexion DB
    print("\n📡 Connexion à la base de données...")
    conn = psycopg2.connect(**DB_CONFIG)
    cur = conn.cursor()
    
    # Charger les zones ADM3 avec centroïdes
    print("📍 Chargement des zones administratives...")
    cur.execute("""
        SELECT 
            a3.gid AS adm3_gid,
            a3.adm3_pcode,
            a2.gid AS adm2_gid,
            a1.gid AS adm1_gid,
            ST_X(ST_Transform(ST_Centroid(a3.geom), 4326)) AS lon,
            ST_Y(ST_Transform(ST_Centroid(a3.geom), 4326)) AS lat
        FROM adm3 a3
        JOIN adm2 a2 ON a3.adm2_pcode = a2.adm2_pcode
        JOIN adm1 a1 ON a2.adm1_pcode = a1.adm1_pcode
    """)
    adm_zones = [dict(zip([desc[0] for desc in cur.description], row)) for row in cur.fetchall()]
    print(f"  ✅ {len(adm_zones)} zones ADM3 chargées")
    
    # Génération
    print(f"\n🏗️  Génération de {N_SURVEYS_TARGET} sondages...")
    total_inserted = 0
    batch_surveys = []
    batch_tests = []
    
    while total_inserted < N_SURVEYS_TARGET:
        survey, tests = generate_survey(conn, adm_zones)
        batch_surveys.append(survey)
        batch_tests.extend(tests)
        
        if len(batch_surveys) >= BATCH_SIZE:
            n = insert_batch(conn, batch_surveys, batch_tests)
            total_inserted += n
            print(f"  ✅ {total_inserted}/{N_SURVEYS_TARGET} sondages insérés ({len(batch_tests)} essais)")
            batch_surveys = []
            batch_tests = []
    
    # Dernier batch
    if batch_surveys:
        n = insert_batch(conn, batch_surveys, batch_tests)
        total_inserted += n
        print(f"  ✅ {total_inserted}/{N_SURVEYS_TARGET} sondages insérés ({len(batch_tests)} essais)")
    
    # Statistiques finales
    print("\n📊 Statistiques finales:")
    cur.execute("SELECT COUNT(*) FROM sondages WHERE deleted_at IS NULL")
    n_surveys = cur.fetchone()[0]
    cur.execute("SELECT COUNT(*) FROM essais WHERE deleted_at IS NULL")
    n_tests = cur.fetchone()[0]
    print(f"  • Sondages: {n_surveys}")
    print(f"  • Essais: {n_tests}")
    print(f"  • Moyenne: {n_tests/n_surveys:.1f} essais/sondage")
    
    conn.close()
    
    print("\n✅ Génération terminée avec succès!")
    print("=" * 80)

if __name__ == '__main__':
    main()
