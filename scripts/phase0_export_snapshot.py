#!/usr/bin/env python3
"""Export snapshot de contrôle (sondages + suggestions)"""

import psycopg
import pandas as pd
from datetime import datetime

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10)

print("="*80)
print("EXPORT SNAPSHOT DE CONTRÔLE")
print("="*80)

# Export sondages avec statut géocodage
print("\n📊 Export sondages...")
df_sondages = pd.read_sql("""
    SELECT 
      s.id,
      s.meta->>'code' AS code_site,
      s.meta->>'localite' AS localite,
      s.meta->>'adm3_code' AS adm3_code,
      a.adm3_fr AS adm3_name,
      a.adm2_fr AS adm2_name,
      a.adm1_fr AS adm1_name,
      CASE 
        WHEN s.geom IS NOT NULL THEN 'Géocodé'
        WHEN s.meta->>'adm3_code' IS NOT NULL THEN 'ADM3 défini'
        ELSE 'Non géocodé'
      END AS statut_geocodage,
      s.created_at
    FROM sondages s
    LEFT JOIN adm3 a ON a.adm3_pcode = s.meta->>'adm3_code'
    ORDER BY s.meta->>'code'
""", conn)

print(f"  ✓ {len(df_sondages)} sondages exportés")

# Export suggestions
print("\n🤖 Export suggestions...")
df_suggestions = pd.read_sql("""
    SELECT 
      gs.id,
      s.meta->>'code' AS code_site,
      gs.localite,
      gs.top_code AS adm3_code_suggere,
      a.adm3_fr AS adm3_name_suggere,
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
""", conn)

print(f"  ✓ {len(df_suggestions)} suggestions exportées")

conn.close()

# Convertir timestamps (remove timezone)
for col in df_sondages.select_dtypes(include=['datetime64[ns, UTC]']).columns:
    df_sondages[col] = df_sondages[col].dt.tz_localize(None)
for col in df_suggestions.select_dtypes(include=['datetime64[ns, UTC]']).columns:
    df_suggestions[col] = df_suggestions[col].dt.tz_localize(None)

# Sauvegarder
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
filename_sondages = f'snapshot_sondages_{timestamp}.xlsx'
filename_suggestions = f'snapshot_suggestions_{timestamp}.xlsx'

df_sondages.to_excel(filename_sondages, index=False, sheet_name='Sondages')
df_suggestions.to_excel(filename_suggestions, index=False, sheet_name='Suggestions')

print(f"\n✅ Snapshots sauvegardés:")
print(f"  📄 {filename_sondages}")
print(f"  📄 {filename_suggestions}")

# Statistiques
print(f"\n📊 STATISTIQUES:")
print(f"  Total sondages: {len(df_sondages)}")
print(f"  Géocodés: {(df_sondages['statut_geocodage'] == 'Géocodé').sum()}")
print(f"  ADM3 défini: {(df_sondages['statut_geocodage'] == 'ADM3 défini').sum()}")
print(f"  Non géocodés: {(df_sondages['statut_geocodage'] == 'Non géocodé').sum()}")
print(f"\n  Suggestions accepted: {(df_suggestions['status'] == 'accepted').sum()}")
print(f"  Suggestions pending: {(df_suggestions['status'] == 'pending').sum()}")
print(f"  Suggestions rejected: {(df_suggestions['status'] == 'rejected').sum()}")
