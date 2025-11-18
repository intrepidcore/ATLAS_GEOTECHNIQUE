#!/usr/bin/env python3
"""
Comparaison échantillon Excel vs DB après import fidèle
Valide que les données ont été préservées exactement
"""

import pandas as pd
import psycopg2
from pathlib import Path

def connect_db():
    """Connexion à la base de données"""
    return psycopg2.connect(
        host="localhost",
        port="5432", 
        database="atlas_clean",
        user="atlas",
        password="atlas"
    )

def compare_sample_post_import():
    """Comparaison échantillon Excel vs DB après import fidèle"""
    
    print("🔍 VALIDATION POST-IMPORT - COMPARAISON EXCEL vs DB (10 ÉCHANTILLONS)")
    print("=" * 100)
    
    try:
        # Connexion DB
        conn = connect_db()
        cur = conn.cursor()
        
        # Lecture Excel
        xl_file = pd.ExcelFile('../atlas_import.xlsx')
        
        # ============================================================================
        # SONDAGES - Validation échantillon
        # ============================================================================
        print(f"\n📋 VALIDATION SONDAGES (10 premiers)")
        print("-" * 80)
        
        # Lire Excel
        df_excel = pd.read_excel('../atlas_import.xlsx', sheet_name='public.sondages')
        excel_sample = df_excel.head(10)
        
        # Lire DB
        cur.execute("""
            SELECT id, code, source, localite_base, localite_key, adm1_name, adm2_name, adm3_name,
                   location_mode, location_accuracy, is_geocoded, 
                   ST_AsText(geom) as geom_wkt, adm3_id, created_at, updated_at
            FROM public.sondages 
            ORDER BY created_at, code
            LIMIT 10
        """)
        
        db_rows = cur.fetchall()
        db_columns = ['id', 'code', 'source', 'localite_base', 'localite_key', 'adm1_name', 'adm2_name', 'adm3_name', 'location_mode', 'location_accuracy', 'is_geocoded', 'geom_wkt', 'adm3_id', 'created_at', 'updated_at']
        
        print(f"Excel: {len(excel_sample)} lignes")
        print(f"DB: {len(db_rows)} lignes")
        
        # Comparaison ligne par ligne
        success_count = 0
        total_fields = 0
        
        for i in range(min(len(excel_sample), len(db_rows))):
            print(f"\n🔍 LIGNE {i+1}:")
            
            excel_row = excel_sample.iloc[i]
            db_row = db_rows[i]
            db_dict = dict(zip(db_columns, db_row))
            
            line_success = 0
            line_total = 0
            
            # Colonnes importantes à vérifier
            key_columns = ['code', 'source', 'localite_base', 'localite_key', 'adm1_name', 'adm2_name', 'adm3_name']
            
            for col in key_columns:
                if col in excel_row.index:
                    excel_val = str(excel_row[col]).strip() if pd.notna(excel_row[col]) else None
                    db_val = str(db_dict.get(col, '')).strip() if db_dict.get(col) is not None else None
                    
                    # Normaliser les valeurs vides
                    if excel_val in ['nan', '', 'None']:
                        excel_val = None
                    if db_val in ['nan', '', 'None']:
                        db_val = None
                    
                    line_total += 1
                    total_fields += 1
                    
                    if excel_val == db_val:
                        status = "✅"
                        line_success += 1
                        success_count += 1
                    else:
                        status = "❌"
                    
                    print(f"   {col:20} | {status} | Excel: '{excel_val}' → DB: '{db_val}'")
            
            # Vérifier géocodage
            has_geom = db_dict.get('geom_wkt') is not None
            is_geocoded = db_dict.get('is_geocoded', False)
            
            print(f"   {'géométrie':20} | {'✅' if has_geom else '⚠️'} | Géométrie présente: {has_geom}")
            print(f"   {'is_geocoded':20} | {'✅' if is_geocoded else '⚠️'} | Marqué géocodé: {is_geocoded}")
            
            line_pct = (line_success / line_total * 100) if line_total > 0 else 0
            print(f"   📊 Fidélité ligne: {line_success}/{line_total} ({line_pct:.1f}%)")
        
        # ============================================================================
        # STATISTIQUES GLOBALES
        # ============================================================================
        print(f"\n📊 STATISTIQUES GLOBALES")
        print("-" * 80)
        
        # Comptes totaux
        cur.execute("SELECT COUNT(*) FROM public.sondages")
        db_sondages = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.echantillons")
        db_echantillons = cur.fetchone()[0]
        
        cur.execute("SELECT COUNT(*) FROM public.essais_atterberg")
        db_atterberg = cur.fetchone()[0]
        
        print(f"Sondages - Excel: {len(df_excel)}, DB: {db_sondages} ({'✅' if len(df_excel) == db_sondages else '❌'})")
        
        # Géocodage
        cur.execute("""
            SELECT 
                COUNT(*) as total,
                COUNT(*) FILTER (WHERE geom IS NOT NULL) as with_geom,
                COUNT(*) FILTER (WHERE is_geocoded = true) as marked_geocoded,
                COUNT(*) FILTER (WHERE localite_key IS NOT NULL AND localite_key != '') as with_localite_key
            FROM public.sondages
        """)
        
        geom_stats = cur.fetchone()
        total, with_geom, marked_geocoded, with_localite_key = geom_stats
        
        print(f"\nGéocodage:")
        print(f"  Total sondages: {total}")
        print(f"  Avec géométrie: {with_geom} ({with_geom/total*100:.1f}%)")
        print(f"  Marqués géocodés: {marked_geocoded} ({marked_geocoded/total*100:.1f}%)")
        print(f"  Avec localite_key: {with_localite_key} ({with_localite_key/total*100:.1f}%)")
        
        # Intégrité FK
        cur.execute("""
            SELECT COUNT(*) 
            FROM public.echantillons e 
            LEFT JOIN public.sondages s ON e.sondage_id = s.id 
            WHERE s.id IS NULL
        """)
        orphans = cur.fetchone()[0]
        
        print(f"\nIntégrité:")
        print(f"  Échantillons orphelins: {orphans} ({'✅' if orphans == 0 else '❌'})")
        
        # ============================================================================
        # RÉSUMÉ FINAL
        # ============================================================================
        print(f"\n🎯 RÉSUMÉ DE LA VALIDATION")
        print("=" * 80)
        
        overall_pct = (success_count / total_fields * 100) if total_fields > 0 else 0
        
        print(f"Fidélité des données: {success_count}/{total_fields} ({overall_pct:.1f}%)")
        
        if overall_pct >= 95:
            print("✅ EXCELLENT - Import fidèle réussi")
        elif overall_pct >= 80:
            print("⚠️ BON - Quelques différences mineures")
        else:
            print("❌ PROBLÈME - Import non fidèle")
        
        # Recommandations
        print(f"\n💡 RECOMMANDATIONS:")
        
        if with_geom < total * 0.5:
            print("  - Activer le géocodage automatique pour plus de sondages")
        
        if marked_geocoded < with_geom:
            print("  - Mettre à jour is_geocoded pour les sondages avec géométrie")
        
        if orphans > 0:
            print("  - Corriger les échantillons orphelins")
        
        if overall_pct < 95:
            print("  - Vérifier le mapping des colonnes dans l'import")
        
        conn.close()
        
    except Exception as e:
        print(f"❌ Erreur: {e}")

if __name__ == "__main__":
    compare_sample_post_import()
