#!/usr/bin/env python3
"""Export des suggestions de géocodage en CSV pour revue externe"""

import psycopg
import csv
from datetime import datetime

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*80)
print("EXPORT SUGGESTIONS GÉOCODAGE → CSV")
print("="*80)

# Export suggestions
cur = conn.execute("""
    SELECT 
      gs.id,
      s.meta->>'code' AS code_site,
      gs.localite,
      gs.adm2_code,
      gs.top_code AS adm3_suggere,
      a.adm3_fr AS adm3_name,
      a.adm2_fr AS prefecture,
      gs.top_score AS score,
      gs.top_method AS methode,
      gs.status,
      gs.created_at,
      gs.decided_at
    FROM geocode_suggestions gs
    JOIN sondages s ON s.id = gs.entity_id
    LEFT JOIN adm3 a ON a.adm3_pcode = gs.top_code
    WHERE gs.entity = 'sondages'
    ORDER BY gs.status, gs.top_score DESC
""")

rows = cur.fetchall()
conn.close()

if not rows:
    print("⊘ Aucune suggestion à exporter")
    exit(0)

# Générer nom fichier
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
filename = f'suggestions_geocodage_{timestamp}.csv'

# Écrire CSV
with open(filename, 'w', newline='', encoding='utf-8') as f:
    writer = csv.writer(f)
    writer.writerow([
        'ID', 'Code Site', 'Localité', 'ADM2', 'ADM3 Suggéré', 
        'Nom ADM3', 'Préfecture', 'Score', 'Méthode', 'Statut',
        'Créé le', 'Décidé le'
    ])
    
    for row in rows:
        writer.writerow([
            row[0],  # id
            row[1],  # code_site
            row[2],  # localite
            row[3],  # adm2_code
            row[4],  # adm3_suggere
            row[5],  # adm3_name
            row[6],  # prefecture
            f"{row[7]:.4f}" if row[7] else '',  # score
            row[8],  # methode
            row[9],  # status
            row[10].strftime('%Y-%m-%d %H:%M:%S') if row[10] else '',  # created_at
            row[11].strftime('%Y-%m-%d %H:%M:%S') if row[11] else '',  # decided_at
        ])

print(f"\n✅ Export terminé : {filename}")
print(f"   {len(rows)} suggestion(s) exportée(s)")

# Statistiques
from collections import Counter
stats = Counter(row[9] for row in rows)
print(f"\n📊 Répartition :")
for status, count in stats.items():
    icon = "✅" if status == "accepted" else "⚠️" if status == "pending" else "❌"
    print(f"   {icon} {status:10} : {count}")
