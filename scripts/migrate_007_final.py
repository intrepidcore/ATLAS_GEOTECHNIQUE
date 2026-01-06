#!/usr/bin/env python3
"""
Migration 007 finale - version simplifiée et robuste
"""

import psycopg2

config = {
    'host': 'localhost',
    'port': '5432',
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

print("=" * 70)
print("  MIGRATION 007 FINALE")
print("=" * 70)

try:
    conn = psycopg2.connect(**config)
    cursor = conn.cursor()
    
    print("\n🔧 ÉTAPE 1: Ajout colonnes")
    cursor.execute("""
        ALTER TABLE atlas.mailles 
        ADD COLUMN IF NOT EXISTS adm2_name TEXT;
    """)
    conn.commit()
    print("   ✅ Colonne ajoutée")
    
    print("\n🔧 ÉTAPE 2: Index")
    cursor.execute("""
        CREATE INDEX IF NOT EXISTS idx_mailles_geom ON atlas.mailles USING GIST (geom);
        CREATE INDEX IF NOT EXISTS idx_adm2_geom ON public.adm2 USING GIST (geom);
    """)
    conn.commit()
    print("   ✅ Index créés")
    
    print("\n🔧 ÉTAPE 3: Rattachement spatial...")
    print("   (Cela peut prendre 2-3 minutes pour 29407 mailles)")
    
    # Utiliser la bonne colonne de adm2
    cursor.execute("""
        UPDATE atlas.mailles m
        SET adm2_name = adm2.adm2_fr
        FROM public.adm2
        WHERE ST_Intersects(adm2.geom, m.geom);
    """)
    conn.commit()
    print("   ✅ Rattachement effectué")
    
    print("\n🔍 ÉTAPE 4: Vérifications")
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(adm2_name) as avec_adm2,
          ROUND(COUNT(adm2_name) * 100.0 / COUNT(*), 1) as pct
        FROM atlas.mailles;
    """)
    
    total, avec_adm2, pct = cursor.fetchone()
    print(f"   Total mailles: {total}")
    print(f"   Avec ADM2: {avec_adm2} ({pct}%)")
    
    if pct > 90:
        print(f"   ✅ Excellent!")
    elif pct > 50:
        print(f"   ⚠️ Partiel - vérifier géométries")
    else:
        print(f"   ❌ Échec - problème de géométries")
        print("   💡 Essayer ST_Contains au lieu de ST_Intersects")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 70)
    print("✅ MIGRATION 007 TERMINÉE!")
    print("=" * 70)
    
    if pct > 50:
        print("\n📊 Les données sont prêtes pour l'analyse")
        print("   Prochaine étape: adapter generate_national_analysis.py")
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    if conn:
        conn.rollback()
        conn.close()
    exit(1)
