import random
import uuid
from datetime import date, timedelta
import psycopg2
from psycopg2.extras import execute_batch

DB_CONFIG = {
    'host': 'db',
    'port': 5432,
    'database': 'atlas',
    'user': 'atlas',
    'password': 'atlas_password'
}

SOIL_TYPES = {
    'argileux': {
        'passant_80um': (50, 90), 'passant_2mm': (85, 100), 'wl': (40, 90), 'ip': (25, 60),
        'vbs': (2.5, 8), 'gamma_d_max': (15, 18), 'w_opt': (18, 28), 'eg': (2, 12), 'weight': 0.25
    },
    'limoneux': {
        'passant_80um': (35, 60), 'passant_2mm': (70, 95), 'wl': (25, 45), 'ip': (10, 25),
        'vbs': (1, 3), 'gamma_d_max': (17, 19), 'w_opt': (12, 20), 'eg': (0.5, 3), 'weight': 0.30
    },
    'sableux': {
        'passant_80um': (5, 25), 'passant_2mm': (50, 85), 'wl': (15, 30), 'ip': (0, 10),
        'vbs': (0, 1), 'gamma_d_max': (18, 21), 'w_opt': (8, 14), 'eg': (0, 0.8), 'weight': 0.30
    },
    'graveleux': {
        'passant_80um': (0, 15), 'passant_2mm': (20, 60), 'wl': None, 'ip': None,
        'vbs': (0, 0.5), 'gamma_d_max': (19, 22), 'w_opt': (6, 10), 'eg': (0, 0.3), 'weight': 0.15
    }
}

def connect_db():
    return psycopg2.connect(**DB_CONFIG)

def fetch_sondages(conn):
    with conn.cursor() as cur:
        cur.execute('SELECT id FROM sondages LIMIT 200')
        return [row[0] for row in cur.fetchall()]

def generate_value(range_tuple):
    if range_tuple is None:
        return None
    return round(random.uniform(range_tuple[0], range_tuple[1]), 2)

def generate_essai(sondage_id):
    soil_type = random.choices(list(SOIL_TYPES.keys()), 
                               weights=[s['weight'] for s in SOIL_TYPES.values()])[0]
    soil = SOIL_TYPES[soil_type]
    
    depth = round(random.uniform(1, 15), 1)
    passant_80um = generate_value(soil['passant_80um'])
    passant_2mm = generate_value(soil['passant_2mm'])
    wl = generate_value(soil['wl'])
    wp = generate_value((soil['wl'][0] - 20, soil['wl'][1] - 15)) if soil['wl'] else None
    vbs = generate_value(soil['vbs'])
    gamma_d_max = generate_value(soil['gamma_d_max'])
    w_opt = generate_value(soil['w_opt'])
    eg = generate_value(soil['eg'])
    
    return (sondage_id, depth, passant_80um, passant_2mm, None, wl, wp, vbs,
            gamma_d_max, w_opt, random.choice(['normal', 'modifie']) if gamma_d_max else None,
            eg, date.today() - timedelta(days=random.randint(0, 365)),
            random.choice(['Lab A', 'Lab B', 'Lab C']), 'NF P94-051')

print('🔌 Connexion à la base de données...')
conn = connect_db()

print('📋 Récupération des sondages...')
sondages = fetch_sondages(conn)
print(f'✅ {len(sondages)} sondages trouvés')

print('🧪 Génération de 200 essais géotechniques...')
essais = [generate_essai(random.choice(sondages)) for _ in range(200)]

print('💾 Insertion dans essais_geotechniques...')
with conn.cursor() as cur:
    execute_batch(cur, '''
        INSERT INTO essais_geotechniques 
        (sondage_id, depth_m, passant_80um, passant_2mm, passant_20mm, wl, wp, vbs,
         gamma_d_max, w_opt, proctor_type, eg, test_date, laboratory, norm)
        VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
    ''', essais, page_size=50)
conn.commit()

print('🔄 Rafraîchissement de la vue matérialisée...')
with conn.cursor() as cur:
    cur.execute('REFRESH MATERIALIZED VIEW CONCURRENTLY mailles_geotechnique_stats')
conn.commit()

print('📊 Statistiques:')
with conn.cursor() as cur:
    cur.execute('SELECT COUNT(*) FROM essais_geotechniques')
    print(f'  - Essais insérés: {cur.fetchone()[0]}')
    cur.execute('SELECT COUNT(*) FROM mailles_geotechnique_stats WHERE n_essais_geo > 0')
    print(f'  - Mailles avec données: {cur.fetchone()[0]}')

conn.close()
print('✅ Seed terminé avec succès!')
