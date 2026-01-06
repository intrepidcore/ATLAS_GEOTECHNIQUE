#!/usr/bin/env python3
"""
Migration 007 adaptée à la structure réelle de la base
"""

import psycopg2
from pathlib import Path
from datetime import datetime
import json

atlas_root = Path(__file__).parent.parent
config = {
    'host': 'localhost',
    'port': '5432',
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

print("=" * 70)
print("  MIGRATION 007 ADAPTÉE")
print("=" * 70)

# Backup
backup_dir = atlas_root / 'backups'
backup_dir.mkdir(exist_ok=True)
timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')

try:
    conn = psycopg2.connect(**config)
    cursor = conn.cursor()
    
    print("\n🔧 ÉTAPE 1: Ajout des colonnes")
    cursor.execute("""
        ALTER TABLE atlas.mailles 
        ADD COLUMN IF NOT EXISTS pref_code TEXT,
        ADD COLUMN IF NOT EXISTS pref_name TEXT;
    """)
    conn.commit()
    print("   ✅ Colonnes ajoutées")
    
    print("\n🔧 ÉTAPE 2: Création des index")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_mailles_geom 
        ON atlas.mailles USING GIST (geom);
        
        CREATE INDEX IF NOT EXISTS idx_adm2_geom 
        ON public.adm2 USING GIST (geom);
    """)
    conn.commit()
    print("   ✅ Index créés")
    
    print("\n🔧 ÉTAPE 3: Détection structure table adm2...")
    # Détecter le nom de la colonne nom
    cursor.execute("""
        SELECT column_name 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = 'adm2'
        AND column_name LIKE '%nom%'
        ORDER BY ordinal_position
        LIMIT 1;
    """)
    
    nom_col = cursor.fetchone()
    if nom_col:
        nom_col = nom_col[0]
        print(f"   Colonne nom détectée: {nom_col}")
    else:
        # Fallback: essayer avec les colonnes standards
        cursor.execute("""
            SELECT column_name 
            FROM information_schema.columns 
            WHERE table_schema = 'public' 
            AND table_name = 'adm2'
            AND data_type = 'text'
            ORDER BY ordinal_position
            LIMIT 1 OFFSET 3;
        """)
        nom_col = cursor.fetchone()[0]
        print(f"   Colonne nom (fallback): {nom_col}")
    
    print("\n🔧 ÉTAPE 4: Rattachement spatial (peut prendre 1-2 minutes...)")
    cursor.execute(f"""
        UPDATE atlas.mailles m
        SET 
          pref_code = adm2.gid::text,
          pref_name = adm2.{nom_col}
        FROM public.adm2
        WHERE ST_Contains(
          adm2.geom,
          ST_PointOnSurface(m.geom)
        );
    """)
    conn.commit()
    print("   ✅ Rattachement effectué")
    
    print("\n🔍 ÉTAPE 5: Vérifications")
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(pref_name) as avec_pref,
          ROUND(COUNT(pref_name) * 100.0 / COUNT(*), 1) as pct
        FROM atlas.mailles;
    """)
    
    total, avec_pref, pct = cursor.fetchone()
    print(f"   Mailles totales: {total}")
    print(f"   Mailles avec préfecture: {avec_pref} ({pct}%)")
    
    if pct > 80:
        print(f"   ✅ Excellent!")
    elif pct > 50:
        print(f"   ⚠️ Partiel")
    else:
        print(f"   ⚠️ Faible")
    
    print("\n🔧 ÉTAPE 6: Création des vues")
    
    # Vue mailles avec KPI et préfecture
    cursor.execute("""
        CREATE OR REPLACE VIEW atlas.v_maille_kpi_pref AS
        SELECT 
            m.gid as maille_id,
            m.pref_code,
            m.pref_name,
            m.code,
            COUNT(DISTINCT s.gid) as n_sondages,
            AVG(eg.eg_mpa) as eg_avg,
            AVG(vbs.vbs) as vbs_avg,
            AVG(att.ip) as ip_avg
        FROM atlas.mailles m
        LEFT JOIN public.sondages s ON ST_Contains(m.geom, s.geom)
        LEFT JOIN public.essais_geotechniques eg ON s.gid = eg.sondage_id
        LEFT JOIN public.essais_vbs vbs ON s.gid = vbs.sondage_id
        LEFT JOIN public.essais_atterberg att ON s.gid = att.sondage_id
        GROUP BY m.gid, m.pref_code, m.pref_name, m.code;
    """)
    
    # Vue préfectures avec KPI agrégés
    cursor.execute("""
        CREATE OR REPLACE VIEW atlas.v_pref_kpi AS
        SELECT 
            pref_code,
            pref_name,
            COUNT(*) as n_mailles,
            SUM(n_sondages) as n_sondages_total,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY eg_avg) as eg_med,
            AVG(eg_avg) as eg_avg,
            STDDEV(eg_avg) as eg_std,
            MIN(eg_avg) as eg_min,
            MAX(eg_avg) as eg_max,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY vbs_avg) as vbs_med,
            AVG(vbs_avg) as vbs_avg,
            STDDEV(vbs_avg) as vbs_std,
            MIN(vbs_avg) as vbs_min,
            MAX(vbs_avg) as vbs_max,
            PERCENTILE_CONT(0.5) WITHIN GROUP (ORDER BY ip_avg) as ip_med,
            AVG(ip_avg) as ip_avg,
            STDDEV(ip_avg) as ip_std,
            MIN(ip_avg) as ip_min,
            MAX(ip_avg) as ip_max
        FROM atlas.v_maille_kpi_pref
        WHERE pref_name IS NOT NULL
        GROUP BY pref_code, pref_name
        ORDER BY n_mailles DESC;
    """)
    
    conn.commit()
    print("   ✅ Vues créées")
    
    # Vérifier les vues
    cursor.execute("SELECT COUNT(*) FROM atlas.v_pref_kpi;")
    pref_count = cursor.fetchone()[0]
    print(f"   📊 {pref_count} préfectures dans v_pref_kpi")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ MIGRATION 007 TERMINÉE!")
    print("=" * 70)
    print("\n📊 Prochaine étape:")
    print("   python scripts/generate_national_analysis.py")
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    if conn:
        conn.rollback()
        conn.close()
    exit(1)
