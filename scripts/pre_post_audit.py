import psycopg2
import json
from datetime import datetime

DB_URL = "postgres://atlas:atlas@localhost/atlas_clean"

def check(phase="ETAT", save_baseline=False):
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    print(f"=== AUDIT {phase} - {datetime.now().strftime('%Y-%m-%d %H:%M:%S')} ===")
    
    cursor.execute("""
        SELECT 'vbs' as essai_type, COUNT(*) as nb_essais, COUNT(DISTINCT s.maille_code) as nb_mailles
        FROM atlas.essais_vbs ev
        JOIN atlas.echantillons e ON e.id = ev.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        UNION ALL
        SELECT 'atterberg', COUNT(*), COUNT(DISTINCT s.maille_code)
        FROM atlas.essais_atterberg ea
        JOIN atlas.echantillons e ON e.id = ea.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        UNION ALL
        SELECT 'gonflement', COUNT(*), COUNT(DISTINCT s.maille_code)
        FROM atlas.essais_potentiel_gonflement eg
        JOIN atlas.echantillons e ON e.id = eg.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id
        UNION ALL
        SELECT 'classif', COUNT(*), COUNT(DISTINCT s.maille_code)
        FROM atlas.essais_classif ec
        JOIN atlas.echantillons e ON e.id = ec.echantillon_id
        JOIN atlas.sondages s ON s.id = e.sondage_id;
    """)
    res = cursor.fetchall()

    data = {}
    print(f"{'Type'.ljust(15)} | {'Nb Essais'.rjust(9)} | {'Nb Mailles'.rjust(10)}")
    print("-" * 42)
    for r in res:
        print(f"  {r[0].ljust(13)} | {str(r[1]).rjust(9)} | {str(r[2]).rjust(10)}")
        data[r[0]] = {'nb_essais': r[1], 'nb_mailles': r[2]}

    # Vérifications physiques
    cursor.execute("SELECT COUNT(*) FROM atlas.essais_vbs WHERE vbs < 0 OR vbs > 20;")
    vbs_err = cursor.fetchone()[0]
    cursor.execute("SELECT COUNT(*) FROM atlas.essais_atterberg WHERE (wl - wp) < 0 OR wl > 120 OR wp < 10;")
    att_err = cursor.fetchone()[0]
    print(f"\nInvariants physiques : VBS hors [0-20]={vbs_err}, Atterberg incoh.={att_err}")

    if save_baseline:
        with open("tmp_audit_baseline.json", "w") as f:
            json.dump(data, f)
        print("Baseline sauvegardée.")
    
    conn.close()
    return data

if __name__ == '__main__':
    import sys
    phase = sys.argv[1] if len(sys.argv) > 1 else "ETAT"
    save = "--save" in sys.argv
    check(phase, save)
