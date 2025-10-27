import psycopg
import sys
import time

if len(sys.argv) < 2:
    print("Usage: python run_sql.py <fichier.sql>")
    sys.exit(1)

sql_file = sys.argv[1]

print(f"📂 Lecture du fichier: {sql_file}")
sql = open(sql_file, encoding='utf-8').read()
print(f"   Taille: {len(sql)} caractères")

print(f"🔌 Connexion à PostgreSQL...")
start_conn = time.time()
conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10, autocommit=True)
print(f"   ✓ Connecté en {(time.time()-start_conn)*1000:.0f}ms")

print(f"⚙️  Exécution de la requête SQL...")
start_exec = time.time()

try:
    cur = conn.execute(sql)
    exec_time = (time.time()-start_exec)*1000
    print(f"   ✓ Exécuté en {exec_time:.0f}ms")
    
    # Afficher tous les résultats
    if cur.description:
        # Afficher les noms de colonnes
        col_names = [desc[0] for desc in cur.description]
        print(f"\n📊 Colonnes: {', '.join(col_names)}")
        print("=" * 80)
        
        row_count = 0
        for row in cur:
            row_count += 1
            print(" | ".join(str(v) if v is not None else 'NULL' for v in row))
        
        print("=" * 80)
        print(f"📈 {row_count} ligne(s) retournée(s)")
    else:
        print("   ℹ️  Aucun résultat (commande DDL/DML)")
    
    print(f"\n✅ {sql_file} exécuté avec succès")
except Exception as e:
    print(f"\n❌ Erreur: {e}")
    import traceback
    traceback.print_exc()
    sys.exit(1)
finally:
    conn.close()
    print("🔌 Connexion fermée")
