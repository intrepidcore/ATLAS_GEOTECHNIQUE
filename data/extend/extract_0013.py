import os
import re

base_dir = r'C:\PROJET_ATLAS_MASTER\atlas_reclone\data\extend\V10_MASTER'
meta_file = os.path.join(base_dir, 'V10_PROJETS_METADATA.csv')
sondages_file = os.path.join(base_dir, 'V10_SONDAGES_LOCALISATION.csv')
labo_file = os.path.join(base_dir, 'V10_LABORATOIRE_HORIZONS.csv')

doc_path = r'C:\PROJET_ATLAS_MASTER\atlas_reclone\data\extend\EDEM_EXTRACT\0013 - Document - (région des Plateaux (207.7 km).md'

def clean_val(val):
    val = val.strip().replace('*', '')
    if val == '-' or val == 'Nul' or val == '#VALEUR': return 'NULL'
    if val.replace(',', '.').replace('.', '').isdigit():
        return val.replace(',', '.')
    return val

with open(doc_path, 'r', encoding='utf-8') as f:
    lines = f.readlines()

plateforme_data = []
emprunts_data = {}
cubages_data = {}
purges_data = []

mode = None
for line in lines:
    if line.startswith('###'):
        if 'Sondages en Chaussée' in line: mode = 'PLAT'
        elif "Recherches d'Emprunts" in line or 'Gisements' in line: mode = 'EMP'
        elif 'Inventaire des Puissances' in line or 'Cubage' in line: mode = 'CUB'
        elif 'Zones de Purges' in line: mode = 'PURGE'
        else: mode = None
    
    if '|' in line and not line.startswith('| :') and not line.startswith('|---'):
        cols = [c.strip() for c in line.split('|')[1:-1]]
        if len(cols) > 0 and 'Tronçon' not in cols[0] and 'Localité' not in cols[0]:
            if mode == 'PLAT' and len(cols) >= 15:
                plateforme_data.append(cols)
            elif mode == 'EMP' and len(cols) >= 10:
                localite = cols[2]
                emprunts_data[localite] = cols
            elif mode == 'CUB' and len(cols) >= 4:
                localite = cols[0]
                cubages_data[localite] = cols
            elif mode == 'PURGE' and len(cols) >= 4:
                purges_data.append(cols)

with open(meta_file, 'a', encoding='utf-8') as f:
    f.write('PISTES_PLATEAUX_2026;Réseaux de Pistes (Région Plateaux);Piste;Plateaux (207.7 km);NULL;NULL;NULL;NULL;NULL;NULL;NULL;NULL\n')

sondages_lines = []
labo_lines = []

for p in plateforme_data:
    troncon = clean_val(p[0])
    sondage = clean_val(p[1])
    s_id = f'{troncon}_{sondage}'
    pk = clean_val(p[2]) + ' ' + clean_val(p[3])
    x = clean_val(p[4]).replace(' ', '')
    y = clean_val(p[5]).replace(' ', '')
    prof = clean_val(p[6])
    
    p80 = clean_val(p[7])
    ll = clean_val(p[8])
    ip = clean_val(p[9])
    ig = clean_val(p[10])
    hbr = clean_val(p[11])
    yopm = clean_val(p[12])
    wopm = clean_val(p[13])
    cbr = clean_val(p[14])
    
    obs = 'NULL'
    if '-' in prof:
        parts = prof.split('-')
        z_min = parts[0].replace(',', '.')
        z_max = parts[1].replace(',', '.')
    else:
        z_min, z_max = '0.00', '1.00'
        
    sondages_lines.append(f'{s_id};PISTES_PLATEAUX_2026;Sondage Piste;{pk};{y};{x};NULL;NULL;NULL;{obs}')
    labo_lines.append(f'{s_id};{z_min};{z_max};Sol en place;NULL;{p80};{ll};{ip};{ig};{hbr};NULL;NULL;{yopm};{wopm};{cbr};NULL')

for loc, emp in emprunts_data.items():
    troncon = clean_val(emp[1])
    s_id = f'{troncon}_EMPRUNT_{clean_val(loc).replace(" ", "_")}'
    c80 = clean_val(emp[3])
    ll = clean_val(emp[4])
    ip = clean_val(emp[5])
    yopm = clean_val(emp[6])
    wopm = clean_val(emp[7])
    cbr = clean_val(emp[8])
    obs = clean_val(emp[9])
    
    cubage = 'NULL'
    pos = 'NULL'
    if loc in cubages_data:
        cub = clean_val(cubages_data[loc][2]).replace(' ', '')
        if cub.isdigit(): cubage = cub
        pos = clean_val(cubages_data[loc][3])
        
    sondages_lines.append(f'{s_id};PISTES_PLATEAUX_2026;Emprunt;{pos};NULL;NULL;NULL;NULL;NULL;{obs}')
    labo_lines.append(f'{s_id};NULL;NULL;Graveleux latéritique;NULL;{c80};{ll};{ip};NULL;NULL;NULL;NULL;{yopm};{wopm};{cbr};{cubage}')

with open(sondages_file, 'a', encoding='utf-8') as f:
    for line in sondages_lines:
        f.write(line + '\n')

with open(labo_file, 'a', encoding='utf-8') as f:
    for line in labo_lines:
        f.write(line + '\n')

print(f'Extraction Plateaux terminee. {len(plateforme_data)} sondages, {len(emprunts_data)} emprunts traites.')
