import csv

CSV_FILE = 'test_data_50_sondages.csv'

with open(CSV_FILE, 'r', encoding='utf-8') as f:
    reader = csv.DictReader(f)
    rows = list(reader)

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
    
    sondages[code]['essais'].append({
        'depth_m': row['depth_m'],
        'passant_80um': row.get('passant_80um', ''),
        'passant_2mm': row.get('passant_2mm', ''),
        'wl': row.get('wl', ''),
        'wp': row.get('wp', ''),
        'vbs': row.get('vbs', ''),
        'gamma_d_max': row.get('gamma_d_max', ''),
        'w_opt': row.get('w_opt', ''),
        'eg': row.get('eg', '')
    })

with open('import_data.sql', 'w', encoding='utf-8') as f:
    f.write("BEGIN;\n\n")
    
    for code, s in sondages.items():
        f.write(f"-- Sondage {code}\n")
        f.write(f"WITH new_sondage AS (\n")
        f.write(f"  INSERT INTO sondages (code, date, source, geom, created_at)\n")
        f.write(f"  VALUES ('{s['code']}', '{s['date']}', '{s['source']}', ST_Transform(ST_SetSRID(ST_MakePoint({s['lon']}, {s['lat']}), 4326), 25231), NOW())\n")
        f.write(f"  ON CONFLICT (code) DO UPDATE SET updated_at = NOW()\n")
        f.write(f"  RETURNING id\n")
        f.write(f")\n")
        
        for i, e in enumerate(s['essais']):
            if i == 0:
                f.write(f"INSERT INTO essais_geotechniques (sondage_id, depth_m, passant_80um, passant_2mm, wl, wp, vbs, gamma_d_max, w_opt, eg, created_at)\n")
                f.write(f"SELECT id, ")
            else:
                f.write(f"UNION ALL SELECT id, ")
            
            vals = [
                e['depth_m'],
                e['passant_80um'] or 'NULL',
                e['passant_2mm'] or 'NULL',
                e['wl'] or 'NULL',
                e['wp'] or 'NULL',
                e['vbs'] or 'NULL',
                e['gamma_d_max'] or 'NULL',
                e['w_opt'] or 'NULL',
                e['eg'] or 'NULL',
                'NOW()'
            ]
            f.write(', '.join(vals))
            f.write(' FROM new_sondage\n')
        
        f.write(';\n\n')
    
    f.write("COMMIT;\n\n")
    f.write("REFRESH MATERIALIZED VIEW grid_stats_geotechnical;\n\n")
    f.write("SELECT COUNT(*) as mailles_avec_donnees FROM grid_stats_geotechnical WHERE n_sondages > 0;\n")

print(f"✅ SQL généré: import_data.sql ({len(sondages)} sondages)")
