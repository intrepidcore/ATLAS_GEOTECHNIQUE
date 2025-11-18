# compare_schema.py
# Usage: python compare_schema.py ./audit_output
import sys, json, csv, os

out = sys.argv[1] if len(sys.argv)>1 else "audit_output"
def read_file(p):
    try:
        with open(p, 'r', encoding='utf-8') as f:
            return f.read()
    except:
        return None

# DB columns
db_cols_txt = read_file(os.path.join(out,"db_sondages_columns.txt")) or ""
atlas_cols_txt = read_file(os.path.join(out,"atlas_surveys_columns.txt")) or ""

def parse_cols(txt):
    lines = [l.strip() for l in txt.splitlines() if l.strip()]
    cols=[]
    for l in lines:
        parts = [p.strip() for p in l.split("|")] if "|" in l else l.split()
        # fallback: take first token as name
        if len(parts)>=1:
            cols.append(parts[0])
    return cols

db_cols = parse_cols(db_cols_txt)
atlas_cols = parse_cols(atlas_cols_txt)

# API fields
api_fields = []
api_file = os.path.join(out,"api_surveys.json")
if os.path.exists(api_file):
    try:
        arr = json.load(open(api_file, 'r', encoding='utf-8'))
        if isinstance(arr, list) and len(arr)>0:
            api_fields = list(arr[0].keys())
    except Exception as e:
        api_fields = []

api_canon_fields = []
api_canon_file = os.path.join(out,"api_surveys_canon.json")
if os.path.exists(api_canon_file):
    try:
        arr2 = json.load(open(api_canon_file,'r', encoding='utf-8'))
        if isinstance(arr2, list) and len(arr2)>0:
            api_canon_fields = list(arr2[0].keys())
    except:
        api_canon_fields = []

report = {
    "db_cols_count": len(db_cols), "db_cols_sample": db_cols[:50],
    "atlas_cols_count": len(atlas_cols), "atlas_cols_sample": atlas_cols[:50],
    "api_surveys_fields": api_fields,
    "api_surveys_canon_fields": api_canon_fields,
    "missing_in_api": [c for c in db_cols if c not in api_fields],
    "missing_in_api_canon": [c for c in atlas_cols if c not in api_canon_fields],
}

# sample rows
def sample_csv(path):
    p = os.path.join(out, path)
    if not os.path.exists(p): return None
    with open(p, 'r', encoding='utf-8', errors='ignore') as f:
        return f.readline().strip()
report['db_sondages_sample_line'] = sample_csv("db_sondages_sample_row.csv")
report['atlas_surveys_sample_line'] = sample_csv("atlas_surveys_sample_row.csv")

# write report
with open(os.path.join(out,"audit_report.json"), 'w', encoding='utf-8') as f:
    json.dump(report, f, indent=2, ensure_ascii=False)

print("Wrote audit_report.json to", out)
print("Summary:")
print(" DB cols:", len(db_cols))
print(" Atlas cols:", len(atlas_cols))
print(" API /surveys fields:", api_fields)
print(" Missing in API (from DB):", report['missing_in_api'][:20])
print(" Missing in API canonical (from atlas):", report['missing_in_api_canon'][:20])
