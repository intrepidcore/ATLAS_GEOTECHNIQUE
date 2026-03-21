import argparse
import pandas as pd

def parse_args():
    parser = argparse.ArgumentParser(description="Comparer deux matrices géotechniques")
    parser.add_argument("--before", required=True, help="Matrice avant import")
    parser.add_argument("--after", required=True, help="Matrice après import")
    return parser.parse_args()

def analyze_matrix(df):
    total = len(df)
    vbs = df['Has VBS'].sum() if 'Has VBS' in df.columns else 0
    att = df['Has Atterberg'].sum() if 'Has Atterberg' in df.columns else 0
    proctor = df['Has Proctor'].sum() if 'Has Proctor' in df.columns else 0
    
    return {
        'total': total,
        'vbs_cnt': vbs,
        'vbs_pct': (vbs / total * 100) if total else 0,
        'att_cnt': att,
        'att_pct': (att / total * 100) if total else 0,
        'pro_cnt': proctor,
        'pro_pct': (proctor / total * 100) if total else 0
    }

def print_diff(name, before, after):
    diff = after[f'{name}_cnt'] - before[f'{name}_cnt']
    print(f"\n{name.upper()} :")
    print(f"  Avant : {before[f'{name}_cnt']}/{before['total']} mailles couvertes ({before[f'{name}_pct']:.1f}%)")
    print(f"  Après : {after[f'{name}_cnt']}/{after['total']} mailles couvertes ({after[f'{name}_pct']:.1f}%)")
    if diff > 0:
        print(f"  → +{diff} mailles nouvellement couvertes ✅")
    elif diff < 0:
        print(f"  → {diff} mailles perdues ❌")
    else:
        print(f"  → Aucun changement")

def main():
    args = parse_args()
    print("=== Comparaison Matrice Géotechnique ===")
    
    try:
        df_before = pd.read_excel(args.before)
        df_after = pd.read_excel(args.after)
        
        b = analyze_matrix(df_before)
        a = analyze_matrix(df_after)
        
        print_diff("vbs", b, a)
        print_diff("att", b, a)
        print_diff("pro", b, a)
        
    except Exception as e:
        print("Erreur de comparaison:", e)

if __name__ == '__main__':
    main()
