#!/usr/bin/env python3
"""Test direct des matches"""

import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

localites = ['Apeheme', 'Davie', 'Dzogbecope', 'Konsogou T1', 'Konsogou T2', 'Kontongbongue', 'Nassablé', 'Tekpo']

print("="*80)
print("TEST DIRECT MATCHING")
print("="*80)

for loc in localites:
    print(f"\n📍 {loc}:")
    cur = conn.execute("SELECT * FROM match_adm3_strict(%s)", (loc,))
    rows = cur.fetchall()
    if rows:
        for row in rows:
            print(f"   {row[1]} ({row[0]}) - score={row[2]:.2f} - method={row[3]}")
    else:
        print(f"   ✗ Aucun match")

conn.close()
