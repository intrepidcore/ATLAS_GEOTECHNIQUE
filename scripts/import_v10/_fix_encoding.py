"""Fix read_csv + Unicode chars in all import scripts."""
import glob

OLD_READ_CSV = '''def read_csv(path):
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_SEP)
        for row in reader:
            if any(v and v.strip() for v in row.values()):
                rows.append({k: (v.strip() if v else None) for k, v in row.items()})
    return rows'''

NEW_READ_CSV = '''def read_csv(path):
    """Lit un CSV ; gere colonnes extra (list) + valeurs NULL string."""
    rows = []
    with open(path, encoding="utf-8-sig", newline="") as f:
        reader = csv.DictReader(f, delimiter=CSV_SEP)
        for row in reader:
            clean = {}
            for k, v in row.items():
                if k is None:
                    continue
                if isinstance(v, list):
                    v = v[0] if v else None
                sv = v.strip() if v and isinstance(v, str) else None
                clean[k] = None if sv in ("NULL", "null", "None", "") else sv
            if any(v for v in clean.values()):
                rows.append(clean)
    return rows'''

unicode_replacements = [
    ('╔', '+'), ('═', '='), ('╗', '+'), ('║', '|'),
    ('╚', '+'), ('✓', 'OK'), ('✗', 'KO'), ('→', '->'),
    ('├', '+'), ('└', '+'), ('─', '-'), ('▶', '>>'),
    ('⚠', '!'), ('✔', 'OK'), ('✘', 'KO'), ('●', '*'),
]

files = glob.glob('C:/PROJET_ATLAS_MASTER/atlas_reclone/scripts/import_v10/*.py')
for f in files:
    if '_fix_encoding' in f:
        continue
    with open(f, encoding='utf-8') as fh:
        content = fh.read()
    for old, new in unicode_replacements:
        content = content.replace(old, new)
    if OLD_READ_CSV in content:
        content = content.replace(OLD_READ_CSV, NEW_READ_CSV)
        print('  read_csv patched in', f.split('\\')[-1].split('/')[-1])
    with open(f, 'w', encoding='utf-8') as fh:
        fh.write(content)
    print('Fixed:', f.split('\\')[-1].split('/')[-1])
print('All done')
