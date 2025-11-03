import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

try:
    cur = conn.execute("SELECT COUNT(*) FROM mv_adm3_maille_map")
    count = cur.fetchone()[0]
    print(f"✓ Carte ADM3→mailles : {count} correspondances")
    
    if count > 0:
        cur = conn.execute("""
            SELECT adm3_code, COUNT(*) AS nb_mailles
            FROM mv_adm3_maille_map
            GROUP BY 1
            ORDER BY 2 DESC
            LIMIT 5
        """)
        print("\nTop 5 ADM3 par nombre de mailles:")
        for row in cur:
            print(f"  {row[0]}: {row[1]} mailles")
    else:
        print("⚠ Aucune correspondance - Le ST_Intersects n'a rien trouvé")
except Exception as e:
    print(f"✗ Erreur: {e}")
finally:
    conn.close()
