import psycopg

print("Création des vues spread...")
conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10, autocommit=True)

sql = open('fix_ui_vues_complete.sql', encoding='utf-8').read()

# Exécuter par blocs
for statement in sql.split(';'):
    statement = statement.strip()
    if statement and not statement.startswith('--') and not statement.startswith('\\'):
        try:
            conn.execute(statement)
        except Exception as e:
            if 'already exists' not in str(e):
                print(f"Warning: {e}")

print("✓ Vues créées")

# Refresh
print("Refresh vue matérialisée...")
conn.execute("REFRESH MATERIALIZED VIEW mv_mailles_geotech")
print("✓ Vue rafraîchie")

# Vérification
cur = conn.execute("SELECT COUNT(*) FROM mv_mailles_geotech")
count = cur.fetchone()[0]
print(f"✓ {count} mailles avec stats")

conn.close()
