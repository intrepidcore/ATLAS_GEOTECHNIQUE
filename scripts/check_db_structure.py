#!/usr/bin/env python3
"""
Script pour inspecter la structure de la base de données
"""

import psycopg2

configs = [
    {
        'name': 'Docker (atlas/atlas)',
        'host': 'localhost',
        'port': '5432',
        'database': 'atlas_clean',
        'user': 'atlas',
        'password': 'atlas'
    },
    {
        'name': 'Local (postgres/postgres)',
        'host': 'localhost',
        'port': '5432',
        'database': 'atlas_geotechnique',
        'user': 'postgres',
        'password': 'postgres'
    }
]

print("=" * 70)
print("  INSPECTION BASE DE DONNÉES")
print("=" * 70)

for config in configs:
    print(f"\n{'=' * 70}")
    print(f"Configuration: {config['name']}")
    print(f"  {config['user']}@{config['host']}:{config['port']}/{config['database']}")
    print('=' * 70)
    
    try:
        conn = psycopg2.connect(
            host=config['host'],
            port=config['port'],
            database=config['database'],
            user=config['user'],
            password=config['password'],
            connect_timeout=3
        )
        
        print("✅ Connexion réussie\n")
        cursor = conn.cursor()
        
        # Lister les schémas
        print("📁 SCHÉMAS:")
        cursor.execute("""
            SELECT schema_name 
            FROM information_schema.schemata 
            WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
            ORDER BY schema_name;
        """)
        schemas = cursor.fetchall()
        for (schema,) in schemas:
            print(f"  - {schema}")
        
        # Pour chaque schéma, lister les tables
        for (schema,) in schemas:
            print(f"\n📊 TABLES dans {schema}:")
            cursor.execute("""
                SELECT table_name, table_type
                FROM information_schema.tables 
                WHERE table_schema = %s
                ORDER BY table_name;
            """, (schema,))
            
            tables = cursor.fetchall()
            if tables:
                for table_name, table_type in tables:
                    # Compter les lignes
                    try:
                        cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table_name};")
                        count = cursor.fetchone()[0]
                        print(f"  - {table_name} ({table_type}): {count} lignes")
                    except:
                        print(f"  - {table_name} ({table_type})")
            else:
                print("  (aucune table)")
        
        # Chercher spécifiquement les tables liées aux mailles
        print(f"\n🔍 RECHERCHE 'maille':")
        cursor.execute("""
            SELECT table_schema, table_name, table_type
            FROM information_schema.tables 
            WHERE table_name LIKE '%maille%'
            ORDER BY table_schema, table_name;
        """)
        
        maille_tables = cursor.fetchall()
        if maille_tables:
            for schema, table, ttype in maille_tables:
                try:
                    cursor.execute(f"SELECT COUNT(*) FROM {schema}.{table};")
                    count = cursor.fetchone()[0]
                    print(f"  - {schema}.{table} ({ttype}): {count} lignes")
                except:
                    print(f"  - {schema}.{table} ({ttype})")
        else:
            print("  (aucune table trouvée)")
        
        cursor.close()
        conn.close()
        
    except psycopg2.OperationalError as e:
        print(f"❌ Échec connexion: {str(e)[:100]}")
    except Exception as e:
        print(f"❌ Erreur: {str(e)[:100]}")

print("\n" + "=" * 70)
