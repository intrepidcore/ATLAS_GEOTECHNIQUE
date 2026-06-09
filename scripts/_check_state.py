#!/usr/bin/env python3
import psycopg2
conn = psycopg2.connect("postgresql://postgres:Atlas2024!@127.0.0.1:5433/atlas_clean")
cur = conn.cursor()

print("=== ETAT ACTUEL ===")
cur.execute("SELECT location_mode, COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL GROUP BY location_mode ORDER BY COUNT(*) DESC")
for mode, n in cur.fetchall():
    print(f"  {str(mode):<25}: {n}")

cur.execute("SELECT COUNT(*) FROM atlas.mv_mailles_geotech WHERE has_data=true")
print(f"\n  Mailles has_data=true: {cur.fetchone()[0]}")

cur.execute("SELECT COUNT(*) FROM atlas.geocode_suggestions WHERE action='manual_required'")
print(f"  Suggestions manual_required: {cur.fetchone()[0]}")

print("\n=== SONDAGES FALLBACK RESTANTS ===")
cur.execute("SELECT id::text, code, source FROM atlas.sondages WHERE location_mode='fallback_default' AND deleted_at IS NULL ORDER BY code")
rows = cur.fetchall()
print(f"  {len(rows)} fallback_default restants:")
for r in rows:
    print(f"    {r[1]} ({r[2]})")

conn.close()
