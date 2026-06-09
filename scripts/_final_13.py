#!/usr/bin/env python3
"""Resoudre les 13 derniers sondages + debug ADM3 lookup."""
import psycopg2

DB_URL = "postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean"

def main():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = False
    cur  = conn.cursor()

    # Debug: chercher KANTE dans toutes les variations
    print("=== DEBUG KANTE ===")
    for pattern in ["kant", "kante", "dankpen", "oti", "tone"]:
        cur.execute("""
            SELECT gid, adm3_fr, adm2_fr, adm1_fr
            FROM atlas.adm3 WHERE LOWER(adm3_fr) LIKE LOWER(%s)
            OR LOWER(adm2_fr) LIKE LOWER(%s)
            ORDER BY adm3_fr LIMIT 3
        """, [f"%{pattern}%", f"%{pattern}%"])
        rows = cur.fetchall()
        if rows:
            for r in rows:
                print(f"  {pattern}: {r[1]} ({r[2]}, {r[3]}) gid={r[0]}")

    print("\n=== DEBUG KPOVE ===")
    for pattern in ["kpov", "kloto", "kpalim", "kpele"]:
        cur.execute("""
            SELECT gid, adm3_fr, adm2_fr, adm1_fr
            FROM atlas.adm3 WHERE LOWER(adm3_fr) LIKE LOWER(%s)
            OR LOWER(adm2_fr) LIKE LOWER(%s)
            ORDER BY adm3_fr LIMIT 3
        """, [f"%{pattern}%", f"%{pattern}%"])
        rows = cur.fetchall()
        if rows:
            for r in rows:
                print(f"  {pattern}: {r[1]} ({r[2]}, {r[3]}) gid={r[0]}")

    print("\n=== DEBUG KABLE ===")
    cur.execute("SELECT id::text, code FROM atlas.sondages WHERE location_mode='fallback_default' AND code LIKE 'KABLE%' AND deleted_at IS NULL")
    for r in cur.fetchall():
        print(f"  {r[1]}")
    for pattern in ["kable", "kloto", "ave", "notsie", "mono"]:
        cur.execute("""
            SELECT gid, adm3_fr, adm2_fr, adm1_fr
            FROM atlas.adm3 WHERE LOWER(adm3_fr) LIKE LOWER(%s)
            ORDER BY adm3_fr LIMIT 2
        """, [f"%{pattern}%"])
        rows = cur.fetchall()
        if rows:
            for r in rows:
                print(f"  {pattern}: {r[1]} ({r[2]}, {r[3]}) gid={r[0]}")

    # Tous les sondages restants
    print("\n=== SONDAGES RESTANTS ===")
    cur.execute("SELECT id::text, code FROM atlas.sondages WHERE location_mode='fallback_default' AND deleted_at IS NULL ORDER BY code")
    remaining = cur.fetchall()
    for r in remaining:
        print(f"  {r[1]}")

    # Resolution finale - KANTE -> Kanté is in Kara. Let's check ADM3 around Kara
    print("\n=== RECHERCHE EXHAUSTIVE KANTE REGION KARA ===")
    cur.execute("""
        SELECT gid, adm3_fr, adm2_fr, adm1_fr,
               ST_X(ST_Centroid(geom)) lon, ST_Y(ST_Centroid(geom)) lat
        FROM atlas.adm3
        WHERE LOWER(adm1_fr) LIKE '%kara%'
        ORDER BY adm3_fr
        LIMIT 20
    """)
    for r in cur.fetchall():
        print(f"  {r[1]:25s} ({r[2]:20s}) lon={r[4]:.3f} lat={r[5]:.3f}")

    conn.close()
    return 0


if __name__ == "__main__":
    import sys; sys.exit(main())
