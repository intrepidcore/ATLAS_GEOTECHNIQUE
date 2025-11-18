#!/usr/bin/env python3
"""
Validation spécifique de la fidélité des sondages Excel vs DB
"""

import pandas as pd
import psycopg2

def connect_db():
    """Connexion à la base de données"""
    return psycopg2.connect(
        host="localhost",
        port="5432", 
        database="atlas_clean",
        user="atlas",
        password="atlas"
    )

def validate_sondages_fidelity():
    """Validation spécifique des sondages"""
    
    print("🎯 VALIDATION FIDÉLITÉ SONDAGES - EXCEL vs DB")
    print("=" * 80)
    
    try:
        # 1. Lire Excel
        print("📊 1. LECTURE EXCEL...")
        df_excel = pd.read_excel('../atlas_import.xlsx', sheet_name='public.sondages')
        print(f"   Excel: {len(df_excel)} lignes, {len(df_excel.columns)} colonnes")
        
        # 2. Lire DB
        print("📊 2. LECTURE BASE DE DONNÉES...")
        conn = connect_db()
        cur = conn.cursor()
        
        cur.execute("""
            SELECT id, code, source, localite_base, localite_key, 
                   adm1_name, adm2_name, adm3_name, location_mode, location_accuracy,
                   geom IS NOT NULL as has_geom, is_geocoded, created_at, updated_at
            FROM public.sondages 
            ORDER BY created_at, id
        """)
        
        db_rows = cur.fetchall()
        db_columns = ['id', 'code', 'source', 'localite_base', 'localite_key', 
                     'adm1_name', 'adm2_name', 'adm3_name', 'location_mode', 'location_accuracy',
                     'has_geom', 'is_geocoded', 'created_at', 'updated_at']
        
        print(f"   DB: {len(db_rows)} lignes")
        
        # 3. Validation des comptes
        print(f"\n📊 3. VALIDATION DES COMPTES:")
        if len(df_excel) == len(db_rows):
            print(f"   ✅ Nombre de lignes: {len(df_excel)} (Excel) = {len(db_rows)} (DB)")
        else:
            print(f"   ❌ Nombre de lignes: {len(df_excel)} (Excel) ≠ {len(db_rows)} (DB)")
        
        # 4. Test des IDs spécifiques Excel
        print(f"\n📊 4. VALIDATION DES IDs EXCEL:")
        
        test_ids = [
            'dda1e71b-8d0d-4c9e-b53f-877a6cf70da9',  # Premier sondage Excel
            'c45c3294-b93e-4277-b59e-3451c9d0998c',  # Deuxième sondage Excel
            'c9b8371f-8779-42e3-a087-7bbb44210dd9'   # Troisième sondage Excel
        ]
        
        for test_id in test_ids:
            cur.execute("""
                SELECT id, code, source, localite_key 
                FROM public.sondages 
                WHERE id = %s::uuid
            """, (test_id,))
            
            result = cur.fetchone()
            if result:
                print(f"   ✅ ID {test_id[:8]}... trouvé: {result[1]} | {result[2]} | {result[3]}")
            else:
                print(f"   ❌ ID {test_id[:8]}... NON TROUVÉ")
        
        # 5. Validation des données critiques
        print(f"\n📊 5. VALIDATION DES DONNÉES CRITIQUES:")
        
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE code IS NOT NULL AND code != '' AND code != '{}') as codes_valides,
                COUNT(*) FILTER (WHERE source IS NOT NULL AND source != 'reimport' AND source != '') as sources_originales,
                COUNT(*) FILTER (WHERE localite_key IS NOT NULL AND localite_key != '') as localite_key_valides,
                COUNT(*) FILTER (WHERE geom IS NOT NULL) as avec_geometrie,
                COUNT(*) FILTER (WHERE is_geocoded = true) as geocodes
            FROM public.sondages
        """)
        
        stats = cur.fetchone()
        total, codes_valides, sources_originales, localite_key_valides, avec_geometrie, geocodes = stats
        
        print(f"   ✅ Total sondages: {total}")
        print(f"   ✅ Codes valides: {codes_valides}/{total} ({codes_valides/total*100:.1f}%)")
        print(f"   ✅ Sources originales: {sources_originales}/{total} ({sources_originales/total*100:.1f}%)")
        print(f"   ✅ Localite_key valides: {localite_key_valides}/{total} ({localite_key_valides/total*100:.1f}%)")
        print(f"   ✅ Avec géométrie: {avec_geometrie}/{total} ({avec_geometrie/total*100:.1f}%)")
        print(f"   ✅ Géocodés: {geocodes}/{total} ({geocodes/total*100:.1f}%)")
        
        # 6. Échantillon de comparaison directe
        print(f"\n📊 6. ÉCHANTILLON DE COMPARAISON DIRECTE:")
        
        # Prendre les 5 premiers sondages Excel et vérifier s'ils correspondent en DB
        excel_sample = df_excel.head(5)
        
        for i, excel_row in excel_sample.iterrows():
            excel_id = excel_row['id']
            excel_code = excel_row['code']
            excel_source = excel_row['source']
            excel_localite_key = excel_row['localite_key']
            
            cur.execute("""
                SELECT code, source, localite_key 
                FROM public.sondages 
                WHERE id = %s::uuid
            """, (excel_id,))
            
            db_result = cur.fetchone()
            
            if db_result:
                db_code, db_source, db_localite_key = db_result
                
                # Comparaison
                code_match = excel_code == db_code
                source_match = excel_source == db_source
                localite_match = excel_localite_key == db_localite_key
                
                status = "✅" if (code_match and source_match and localite_match) else "❌"
                
                print(f"   {status} ID {excel_id[:8]}...")
                if not code_match:
                    print(f"      Code: Excel='{excel_code}' ≠ DB='{db_code}'")
                if not source_match:
                    print(f"      Source: Excel='{excel_source}' ≠ DB='{db_source}'")
                if not localite_match:
                    print(f"      Localite: Excel='{excel_localite_key}' ≠ DB='{db_localite_key}'")
                
                if code_match and source_match and localite_match:
                    print(f"      ✅ Parfaitement fidèle: {db_code} | {db_source} | {db_localite_key}")
            else:
                print(f"   ❌ ID {excel_id[:8]}... NON TROUVÉ en DB")
        
        # 7. Résumé final
        print(f"\n🎯 7. RÉSUMÉ FINAL:")
        
        success_criteria = [
            (len(df_excel) == len(db_rows), "Nombre de lignes identique"),
            (codes_valides == total, "Tous les codes sont valides"),
            (sources_originales > total * 0.8, "Sources originales préservées"),
            (localite_key_valides == total, "Toutes les localite_key préservées"),
            (avec_geometrie == total, "Toutes les géométries présentes"),
            (geocodes == total, "Tous les sondages géocodés")
        ]
        
        success_count = sum(1 for success, _ in success_criteria if success)
        
        print(f"   Critères de fidélité: {success_count}/{len(success_criteria)}")
        
        for success, message in success_criteria:
            status = "✅" if success else "❌"
            print(f"   {status} {message}")
        
        if success_count >= 5:
            print(f"\n🎉 FIDÉLITÉ EXCELLENTE!")
            print(f"   Les sondages sont fidèles à Excel")
            print(f"   L'interface ne devrait plus montrer de données grises")
        elif success_count >= 3:
            print(f"\n⚠️ FIDÉLITÉ ACCEPTABLE")
            print(f"   Quelques améliorations possibles")
        else:
            print(f"\n❌ FIDÉLITÉ INSUFFISANTE")
            print(f"   Import à refaire")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    validate_sondages_fidelity()
