#!/usr/bin/env python3
"""
Hook post-import : génère automatiquement les suggestions de géocodage
À appeler après chaque import de sondages
"""

import psycopg
import sys
from pathlib import Path

def generate_suggestions():
    """Génère les suggestions de géocodage pour les nouveaux sondages"""
    print("="*80)
    print("POST-IMPORT HOOK : Génération suggestions géocodage")
    print("="*80)
    
    try:
        conn = psycopg.connect(
            'postgresql://atlas:atlas@localhost:5432/atlas_clean',
            connect_timeout=10
        )
        
        # Compter sondages sans ADM3
        cur = conn.execute("""
            SELECT COUNT(*) 
            FROM sondages 
            WHERE (meta->>'adm3_code') IS NULL 
              AND nullif(meta->>'localite','') IS NOT NULL
        """)
        count_without_adm3 = cur.fetchone()[0]
        
        print(f"\n📊 Sondages sans ADM3 : {count_without_adm3}")
        
        if count_without_adm3 == 0:
            print("✅ Tous les sondages ont un ADM3, aucune suggestion à générer")
            conn.close()
            return 0
        
        # Générer suggestions
        print("\n🔄 Génération des suggestions...")
        sql_path = Path(__file__).parent.parent / 'sql' / 'step1_generate_suggestions.sql'
        conn.execute(open(sql_path).read())
        conn.commit()
        
        # Statistiques
        cur = conn.execute("""
            SELECT 
              status,
              COUNT(*) AS count
            FROM geocode_suggestions
            WHERE entity = 'sondages'
            GROUP BY status
            ORDER BY status
        """)
        
        print("\n📈 Résultats :")
        total_suggestions = 0
        for row in cur:
            status, count = row
            icon = "✅" if status == "accepted" else "⚠️" if status == "pending" else "❌"
            print(f"  {icon} {status:10} : {count}")
            total_suggestions += count
        
        # Compter sondages sans suggestion
        cur = conn.execute("""
            SELECT COUNT(*) 
            FROM sondages s
            WHERE (s.meta->>'adm3_code') IS NULL
              AND nullif(s.meta->>'localite','') IS NOT NULL
              AND NOT EXISTS (
                SELECT 1 FROM geocode_suggestions gs 
                WHERE gs.entity_id = s.id AND gs.entity = 'sondages'
              )
        """)
        no_suggestion = cur.fetchone()[0]
        
        if no_suggestion > 0:
            print(f"  ❌ Sans suggestion : {no_suggestion}")
        
        # Appliquer automatiquement les accepted
        print("\n🚀 Application des suggestions accepted...")
        result = conn.execute("""
            WITH accepted AS (
              SELECT entity_id AS id, top_code
              FROM geocode_suggestions
              WHERE entity = 'sondages' 
                AND status = 'accepted'
                AND top_code IS NOT NULL
            )
            UPDATE sondages s
            SET meta = jsonb_set(s.meta, '{adm3_code}', to_jsonb(a.top_code))
            FROM accepted a
            WHERE s.id = a.id
              AND (s.meta->>'adm3_code') IS NULL
        """)
        applied_count = result.rowcount
        conn.commit()
        
        print(f"  ✅ {applied_count} suggestion(s) appliquée(s)")
        
        # Refresh vues matérialisées
        if applied_count > 0:
            print("\n🔄 Refresh vues matérialisées...")
            conn.execute("REFRESH MATERIALIZED VIEW CONCURRENTLY mv_mailles_geotech")
            conn.commit()
            print("  ✅ Vues refreshed")
        
        conn.close()
        
        print("\n" + "="*80)
        print("✅ POST-IMPORT HOOK TERMINÉ")
        print("="*80)
        print(f"  Total suggestions : {total_suggestions}")
        print(f"  Auto-appliquées : {applied_count}")
        print(f"  En attente validation : {total_suggestions - applied_count}")
        
        return total_suggestions
        
    except Exception as e:
        print(f"\n❌ Erreur : {e}", file=sys.stderr)
        return -1

if __name__ == '__main__':
    sys.exit(0 if generate_suggestions() >= 0 else 1)
