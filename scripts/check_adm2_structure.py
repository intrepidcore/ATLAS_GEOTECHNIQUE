#!/usr/bin/env python3
"""
Vérifier la structure de la table adm2
"""

import psycopg2

config = {
    'host': 'localhost',
    'port': '5432',
    'database': 'atlas_clean',
    'user': 'atlas',
    'password': 'atlas'
}

conn = psycopg2.connect(**config)
cursor = conn.cursor()

print("Structure de public.adm2:")
cursor.execute("""
    SELECT column_name, data_type 
    FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'adm2'
    ORDER BY ordinal_position;
""")

for col, dtype in cursor.fetchall():
    print(f"  - {col}: {dtype}")

print("\nSample data:")
cursor.execute("SELECT * FROM public.adm2 LIMIT 2;")
print(cursor.fetchall())

cursor.close()
conn.close()
