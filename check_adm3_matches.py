#!/usr/bin/env python3
"""Vérifie les ADM3 matchés"""

import psycopg

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*80)
print("VÉRIFICATION ADM3 MATCHÉS")
print("="*80)

# Compteurs
cur = conn.execute("""
    SELECT 
      COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NOT NULL) AS avec_adm3,
      COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NULL 
                         AND nullif(meta->>'localite','') IS NOT NULL) AS sans_adm3_avec_localite,
      COUNT(*) FILTER (WHERE (meta->>'adm3_code') IS NULL 
                         AND nullif(meta->>'localite','') IS NULL) AS sans_adm3_sans_localite
    FROM sondages
""")
row = cur.fetchone()
print(f"\n📊 Compteurs:")
print(f"  ✓ Avec ADM3: {row[0]}")
print(f"  ⊘ Sans ADM3 (mais avec localité): {row[1]}")
print(f"  ✗ Sans ADM3 ni localité: {row[2]}")

# Détail des matches
print(f"\n{'='*80}")
print("DÉTAIL DES MATCHES")
print(f"{'='*80}")

cur = conn.execute("""
    SELECT 
      s.meta->>'code' AS code_site,
      s.meta->>'localite' AS localite,
      s.meta->>'adm3_code' AS adm3_code,
      a.adm3_fr AS adm3_name,
      a.adm2_fr AS adm2_name,
      a.adm1_fr AS adm1_name
    FROM sondages s
    LEFT JOIN adm3 a ON a.adm3_pcode = s.meta->>'adm3_code'
    WHERE (s.meta->>'adm3_code') IS NOT NULL
    ORDER BY s.meta->>'code'
""")

print(f"{'Code':<20} {'Localité':<20} {'ADM3':<15} {'Canton':<20} {'Préfecture':<20}")
print("-"*80)
for row in cur:
    print(f"{row[0]:<20} {row[1]:<20} {row[2]:<15} {row[3]:<20} {row[4]:<20}")

# Cas restants sans ADM3
print(f"\n{'='*80}")
print("CAS RESTANTS SANS ADM3")
print(f"{'='*80}")

cur = conn.execute("""
    SELECT 
      s.meta->>'code' AS code_site,
      s.meta->>'localite' AS localite
    FROM sondages s
    WHERE (s.meta->>'adm3_code') IS NULL
      AND nullif(s.meta->>'localite','') IS NOT NULL
    ORDER BY s.meta->>'code'
""")

rows = cur.fetchall()
if rows:
    for row in rows:
        print(f"  • {row[0]}: '{row[1]}'")
else:
    print("  ✓ Aucun (tous matchés !)")

# Cas ambigus en revue
print(f"\n{'='*80}")
print("CAS AMBIGUS EN REVUE MANUELLE")
print(f"{'='*80}")

cur = conn.execute("""
    SELECT 
      mr.localite,
      mr.candidates->0->>'name' AS top1_name,
      (mr.candidates->0->>'score')::numeric AS top1_score,
      mr.candidates->1->>'name' AS top2_name,
      (mr.candidates->1->>'score')::numeric AS top2_score
    FROM match_review mr
    ORDER BY mr.created_at DESC
""")

rows = cur.fetchall()
if rows:
    for row in rows:
        print(f"  • '{row[0]}': {row[1]} ({row[2]:.2f}) vs {row[3]} ({row[4]:.2f})")
else:
    print("  ✓ Aucun (tous sûrs !)")

conn.close()

print(f"\n{'='*80}")
print("✅ VÉRIFICATION TERMINÉE")
print(f"{'='*80}")
