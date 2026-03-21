import psycopg2

DB_URL = "postgres://atlas:atlas@localhost/atlas_clean"

def check():
    conn = psycopg2.connect(DB_URL)
    cursor = conn.cursor()

    print("=== AUDIT PRE-IMPORT ===")
    
    # 1. Verification de cohérence globale
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
        JOIN atlas.sondages s ON s.id = e.sondage_id;
    """)
    res = cursor.fetchall()
    print("État de la couverture des essais (avant/après import) :")
    for r in res:
        print(f"  {r[0].ljust(15)} : {r[1]} essais sur {r[2]} mailles")

    # 2. Invariants physiques (Doit être 0)
    cursor.execute("""
        SELECT COUNT(*) FROM atlas.essais_vbs WHERE vbs < 0 OR vbs > 20;
    """)
    vbs_err = cursor.fetchone()[0]
    cursor.execute("""
        SELECT COUNT(*) FROM atlas.essais_atterberg WHERE ABS(ip - (wl - wp)) > 5;
    """)
    att_err = cursor.fetchone()[0]
    print(f"Erreurs physiques: VBS={vbs_err}, Atterberg={att_err}")

    conn.close()

if __name__ == '__main__':
    check()
