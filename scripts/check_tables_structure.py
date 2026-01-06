#!/usr/bin/env python3
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

tables = ['sondages', 'essais_geotechniques', 'essais_vbs', 'essais_atterberg']

for table in tables:
    cursor.execute(f"""
        SELECT column_name, data_type 
        FROM information_schema.columns 
        WHERE table_schema = 'public' 
        AND table_name = '{table}'
        ORDER BY ordinal_position;
    """)
    
    print(f"\n{table}:")
    for col, dtype in cursor.fetchall():
        print(f"  - {col}: {dtype}")

cursor.close()
conn.close()
