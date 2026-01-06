#!/usr/bin/env python3
"""
Fix migration 007 - Diagnostic et correction des SRID
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
print("  DIAGNOSTIC ET FIX MIGRATION 007")
print("=" * 70)

try:
    conn = psycopg2.connect(**config)
    cursor = conn.cursor()
    
    print("\n🔍 DIAGNOSTIC:")
    
    # Vérifier SRID des géométries
    cursor.execute("""
        SELECT 
            'atlas.mailles' as table_name,
            ST_SRID(geom) as srid,
            COUNT(*) as count
        FROM atlas.mailles
        GROUP BY ST_SRID(geom)
        UNION ALL
        SELECT 
            'public.adm2' as table_name,
            ST_SRID(geom) as srid,
            COUNT(*) as count
        FROM public.adm2
        GROUP BY ST_SRID(geom);
    """)
    
    print("\n   SRID des géométries:")
    for table, srid, count in cursor.fetchall():
        print(f"   - {table}: SRID {srid} ({count} lignes)")
    
    # Vérifier bbox
    cursor.execute("""
        SELECT 
            'mailles' as source,
            ST_XMin(ST_Extent(geom)) as xmin,
            ST_YMin(ST_Extent(geom)) as ymin,
            ST_XMax(ST_Extent(geom)) as xmax,
            ST_YMax(ST_Extent(geom)) as ymax
        FROM atlas.mailles
        UNION ALL
        SELECT 
            'adm2' as source,
            ST_XMin(ST_Extent(geom)) as xmin,
            ST_YMin(ST_Extent(geom)) as ymin,
            ST_XMax(ST_Extent(geom)) as xmax,
            ST_YMax(ST_Extent(geom)) as ymax
        FROM public.adm2;
    """)
    
    print("\n   Bounding boxes:")
    for source, xmin, ymin, xmax, ymax in cursor.fetchall():
        print(f"   - {source}: [{xmin:.2f}, {ymin:.2f}] → [{xmax:.2f}, {ymax:.2f}]")
    
    print("\n🔧 CORRECTION:")
    print("   Rattachement avec transformation SRID...")
    
    # Essayer avec transformation de coordonnées
    cursor.execute("""
        UPDATE atlas.mailles m
        SET adm2_name = adm2.adm2_fr
        FROM public.adm2
        WHERE ST_Intersects(
            ST_Transform(adm2.geom, ST_SRID(m.geom)),
            m.geom
        );
    """)
    conn.commit()
    
    # Vérifier résultat
    cursor.execute("""
        SELECT 
          COUNT(*) as total,
          COUNT(adm2_name) as avec_adm2,
          ROUND(COUNT(adm2_name) * 100.0 / COUNT(*), 1) as pct
        FROM atlas.mailles;
    """)
    
    total, avec_adm2, pct = cursor.fetchone()
    print(f"\n   Résultat:")
    print(f"   - Total: {total}")
    print(f"   - Avec ADM2: {avec_adm2} ({pct}%)")
    
    if pct > 90:
        print(f"   ✅ Excellent!")
    elif pct > 50:
        print(f"   ⚠️ Partiel")
    else:
        print(f"   ❌ Toujours en échec")
        
        # Essayer méthode alternative
        print("\n   Essai méthode alternative (centroïde)...")
        cursor.execute("""
            UPDATE atlas.mailles m
            SET adm2_name = adm2.adm2_fr
            FROM public.adm2
            WHERE ST_Contains(
                ST_Transform(adm2.geom, ST_SRID(m.geom)),
                ST_Centroid(m.geom)
            );
        """)
        conn.commit()
        
        cursor.execute("""
            SELECT 
              COUNT(*) as total,
              COUNT(adm2_name) as avec_adm2,
              ROUND(COUNT(adm2_name) * 100.0 / COUNT(*), 1) as pct
            FROM atlas.mailles;
        """)
        
        total, avec_adm2, pct = cursor.fetchone()
        print(f"   - Avec ADM2: {avec_adm2} ({pct}%)")
        
        if pct > 50:
            print(f"   ✅ Méthode centroïde fonctionne!")
    
    # Afficher quelques exemples
    cursor.execute("""
        SELECT adm2_name, COUNT(*) as n_mailles
        FROM atlas.mailles
        WHERE adm2_name IS NOT NULL
        GROUP BY adm2_name
        ORDER BY n_mailles DESC
        LIMIT 10;
    """)
    
    print("\n   Top 10 préfectures:")
    for adm2, count in cursor.fetchall():
        print(f"   - {adm2}: {count} mailles")
    
    cursor.close()
    conn.close()
    
    print("\n" + "=" * 70)
    if pct > 50:
        print("✅ MIGRATION CORRIGÉE!")
        print("\n📊 Prochaine étape:")
        print("   Adapter generate_national_analysis.py pour utiliser atlas.mailles")
    else:
        print("❌ ÉCHEC - Problème de géométries non résolu")
        print("\n💡 Actions manuelles requises:")
        print("   1. Vérifier que les géométries ADM2 sont valides")
        print("   2. Vérifier que les mailles ont des géométries valides")
        print("   3. Essayer un autre outil (QGIS) pour le rattachement")
    print("=" * 70)
    
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    if conn:
        conn.rollback()
        conn.close()
    exit(1)
