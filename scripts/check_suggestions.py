#!/usr/bin/env python3
"""Vérifie les suggestions générées"""

import psycopg
import json

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*80)
print("VÉRIFICATION SUGGESTIONS GÉOCODAGE")
print("="*80)

# Compteurs par statut
cur = conn.execute("""
    SELECT status, COUNT(*) 
    FROM geocode_suggestions 
    WHERE entity = 'sondages'
    GROUP BY status
    ORDER BY status
""")

print("\n📊 Compteurs par statut:")
for row in cur:
    print(f"  {row[0]:10} : {row[1]}")

# Détail des suggestions
print(f"\n{'='*80}")
print("DÉTAIL DES SUGGESTIONS")
print(f"{'='*80}")

cur = conn.execute("""
    SELECT 
      gs.localite,
      gs.top_code,
      a.adm3_fr AS top_name,
      gs.top_score,
      gs.top_method,
      gs.status,
      gs.candidates
    FROM geocode_suggestions gs
    LEFT JOIN adm3 a ON a.adm3_pcode = gs.top_code
    WHERE gs.entity = 'sondages'
    ORDER BY gs.status, gs.top_score DESC
""")

current_status = None
for row in cur:
    localite, top_code, top_name, top_score, top_method, status, candidates = row
    
    if status != current_status:
        current_status = status
        print(f"\n{'='*80}")
        print(f"STATUS: {status.upper()}")
        print(f"{'='*80}")
    
    print(f"\n📍 {localite}")
    print(f"   Top: {top_name} ({top_code}) - score={top_score:.2f} - method={top_method}")
    
    # Afficher tous les candidats
    if candidates:
        cands = candidates if isinstance(candidates, list) else json.loads(candidates)
        print(f"   Candidats ({len(cands)}):")
        for i, c in enumerate(cands[:3], 1):
            print(f"     {i}. {c.get('name')} ({c.get('code')}) - {c.get('score'):.2f} - {c.get('method')}")

# Vérifier sondages (ne doivent PAS avoir adm3_code sauf accepted)
print(f"\n{'='*80}")
print("VÉRIFICATION SONDAGES (adm3_code)")
print(f"{'='*80}")

cur = conn.execute("""
    SELECT 
      s.meta->>'code' AS code_site,
      s.meta->>'localite' AS localite,
      s.meta->>'adm3_code' AS adm3_code,
      gs.status
    FROM sondages s
    LEFT JOIN geocode_suggestions gs ON gs.entity_id = s.id AND gs.entity = 'sondages'
    ORDER BY s.meta->>'code'
""")

print(f"{'Code':<20} {'Localité':<20} {'ADM3':<15} {'Status Suggestion':<20}")
print("-"*80)
for row in cur:
    adm3_mark = "✓" if row[2] else "⊘"
    print(f"{row[0]:<20} {row[1]:<20} {adm3_mark:<15} {row[3] or 'N/A':<20}")

conn.close()

print(f"\n{'='*80}")
print("✅ VÉRIFICATION TERMINÉE")
print(f"{'='*80}")
