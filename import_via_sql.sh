#!/bin/bash
# Script pour importer les données de test via SQL

echo "🚀 Import des données de test..."

# Convertir CSV en SQL INSERT
python3 << 'PYTHON_SCRIPT'
import csv

CSV_FILE = 'test_data_50_sondages.csv'

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

# Grouper par sondage
sondages = {}
for row in rows:
    code = row['code']
    if code not in sondages:
        sondages[code] = {
            'code': code,
            'date': row.get('date', ''),
            'source': row.get('source', ''),
            'lat': row['lat'],
            'lon': row['lon'],
            'laboratory': row.get('laboratory', ''),
            'essais': []
        }
    
    essais = {
        'depth_m': row['depth_m'],
        'passant_80um': row.get('passant_80um', ''),
        'passant_2mm': row.get('passant_2mm', ''),
        'passant_20mm': row.get('passant_20mm', ''),
        'wl': row.get('wl', ''),
        'wp': row.get('wp', ''),
        'vbs': row.get('vbs', ''),
        'gamma_d_max': row.get('gamma_d_max', ''),
        'w_opt': row.get('w_opt', ''),
        'proctor_type': row.get('proctor_type', ''),
        'eg': row.get('eg', ''),
        'norm': row.get('norm', '')
    }
    sondages[code]['essais'].append(essais)

# Générer SQL
with open('import_data.sql', 'w', encoding='utf-8') as f:
    f.write("-- Import automatique des données de test\n\n")
    f.write("BEGIN;\n\n")
    
    for code, s in sondages.items():
        # Insérer sondage
        f.write(f"""
INSERT INTO sondages (code, date, source, geom, laboratory, created_at)
VALUES (
    '{s['code']}',
    '{s['date']}',
    '{s['source']}',
    ST_SetSRID(ST_MakePoint({s['lon']}, {s['lat']}), 4326),
    '{s['laboratory']}',
    NOW()
)
ON CONFLICT (code) DO UPDATE SET updated_at = NOW()
RETURNING id INTO TEMPORARY TABLE temp_sondage_id;

""")
        
        # Insérer essais
        for e in s['essais']:
            vals = []
            vals.append(f"(SELECT id FROM temp_sondage_id)")
            vals.append(e['depth_m'] if e['depth_m'] else 'NULL')
            vals.append(e['passant_80um'] if e['passant_80um'] else 'NULL')
            vals.append(e['passant_2mm'] if e['passant_2mm'] else 'NULL')
            vals.append(e['passant_20mm'] if e['passant_20mm'] else 'NULL')
            vals.append(e['wl'] if e['wl'] else 'NULL')
            vals.append(e['wp'] if e['wp'] else 'NULL')
            vals.append(e['vbs'] if e['vbs'] else 'NULL')
            vals.append(e['gamma_d_max'] if e['gamma_d_max'] else 'NULL')
            vals.append(e['w_opt'] if e['w_opt'] else 'NULL')
            vals.append(f"'{e['proctor_type']}'" if e['proctor_type'] else 'NULL')
            vals.append(e['eg'] if e['eg'] else 'NULL')
            vals.append(f"'{e['norm']}'" if e['norm'] else 'NULL')
            
            f.write(f"""INSERT INTO essais_geotechniques (
    sondage_id, depth_m, passant_80um, passant_2mm, passant_20mm,
    wl, wp, vbs, gamma_d_max, w_opt, proctor_type, eg, norm, created_at
) VALUES ({', '.join(vals)}, NOW());

""")
        
        f.write("DROP TABLE IF EXISTS temp_sondage_id;\n\n")
    
    f.write("COMMIT;\n\n")
    f.write("-- Rafraîchir la vue\n")
    f.write("REFRESH MATERIALIZED VIEW grid_stats_geotechnical;\n\n")
    f.write("-- Statistiques\n")
    f.write("""
SELECT 
    COUNT(*) as total_mailles,
    COUNT(*) FILTER (WHERE n_sondages > 0) as mailles_avec_donnees,
    SUM(n_sondages) as total_sondages,
    SUM(n_essais_geo) as total_essais
FROM grid_stats_geotechnical;
""")

print(f"✅ Fichier SQL généré: import_data.sql ({len(sondages)} sondages)")
PYTHON_SCRIPT

echo "📦 Copie du fichier SQL dans le conteneur..."
docker compose cp import_data.sql db:/tmp/import.sql

echo "⚙️  Exécution de l'import..."
docker compose exec db psql -U atlas -d atlas -f /tmp/import.sql

echo "✅ Import terminé !"
