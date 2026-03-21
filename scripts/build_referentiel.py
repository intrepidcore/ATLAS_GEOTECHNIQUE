import psycopg2, csv, pandas as pd, re
from pathlib import Path

DB_URL = "postgres://atlas:atlas@localhost/atlas_clean"
data_dir = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/data/xlsx")
ref_file = Path("c:/PROJET_ATLAS_MASTER/atlas_reclone/data/referentiels/localite_sondage_mapping.csv")

def sanitize(s):
    if not s or s == 'None': return ""
    s = re.sub(r'\(.*?\)', '', str(s))
    s = re.sub(r'[^a-zA-Z0-9]', '', s)
    return s.lower()

# Charger tous les sondages
conn = psycopg2.connect(DB_URL)
c = conn.cursor()
c.execute("SELECT id, code, localite, adm3_name, maille_code FROM atlas.sondages")
sondages = c.fetchall()
conn.close()

# Charger mapping existant
existing_map = {}
with open(ref_file, 'r', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        existing_map[row['localite_xlsx']] = row

# Collecter toutes les localités des XLSX
xlsx_locs = {}
for fname in ["bleu.xlsx","limite.xlsx","classification.xlsx","potentielle_de_gonflement.xlsx","Granulométrie.xlsx"]:
    fpath = data_dir / fname
    if not fpath.exists(): continue
    df = pd.read_excel(fpath, header=0)
    loc_col = 'Localités' if 'Localités' in df.columns else next((c for c in df.columns if 'local' in str(c).lower()), None)
    if loc_col:
        for l in df[loc_col].dropna().unique():
            lstr = str(l).strip()
            if lstr not in xlsx_locs:
                xlsx_locs[lstr] = fname

print(f"Localités uniques dans les XLSX: {len(xlsx_locs)}")
print(f"Déjà dans le référentiel: {len([k for k in xlsx_locs if k in existing_map and existing_map[k]['sondage_id']])}")

# Trouver les nouvelles correspondances par jointure sur code ou adm3
new_rows = []
no_match = []
for loc_raw, source in xlsx_locs.items():
    if loc_raw in existing_map and existing_map[loc_raw]['sondage_id']:
        continue  # Déjà mappé
    
    loc_clean = sanitize(loc_raw)
    matched_sid = matched_code = matched_maille = None
    confiance = 'none'
    
    for sid, code, localite, adm3, maille in sondages:
        # Match par code sondage
        if sanitize(code) == loc_clean:
            matched_sid, matched_code, matched_maille = sid, code, maille
            confiance = 'high'
            break
        # Match par adm3_name
        if loc_clean and len(loc_clean) > 3 and sanitize(adm3) == loc_clean:
            if not matched_sid:
                matched_sid, matched_code, matched_maille = sid, code, maille
                confiance = 'low'

    new_rows.append({
        'localite_xlsx': loc_raw,
        'localite_normalized': loc_clean,
        'sondage_id': str(matched_sid) if matched_sid else '',
        'sondage_code': matched_code or '',
        'maille_code': matched_maille or '',
        'confiance': confiance,
        'notes': f"Cycle-2-auto ({source})" if matched_sid else f"Sans match ({source})"
    })
    if not matched_sid:
        no_match.append(loc_raw)

# Mettre à jour le référentiel
all_rows = list(existing_map.values()) + new_rows
with open(ref_file, 'w', encoding='utf-8', newline='') as f:
    fieldnames = ['localite_xlsx','localite_normalized','sondage_id','sondage_code','maille_code','confiance','notes']
    writer = csv.DictWriter(f, fieldnames=fieldnames)
    writer.writeheader()
    writer.writerows(all_rows)

print(f"\n{len(new_rows)} nouvelles entrées ajoutées au référentiel")
print(f"Localités SANS match: {no_match}")
