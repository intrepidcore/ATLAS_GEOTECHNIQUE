import psycopg2

DB_URL = "postgres://atlas:atlas@localhost/atlas_clean"

tables = [
    "essais_vbs",
    "essais_atterberg",
    "essais_potentiel_gonflement",
    "essais_classif"
]

def alter_tables():
    conn = psycopg2.connect(DB_URL)
    conn.autocommit = True
    cursor = conn.cursor()
    
    for t in tables:
        try:
            sql = f"ALTER TABLE atlas.{t} ADD COLUMN IF NOT EXISTS source_reference VARCHAR(255);"
            cursor.execute(sql)
            print(f"Colonne source_reference ajoutée (ou déjà existante) sur {t}")
        except Exception as e:
            print(f"Erreur sur {t}: {e}")

    conn.close()

if __name__ == '__main__':
    alter_tables()
