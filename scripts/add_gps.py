import psycopg

# Coordonnées GPS fictives pour le Togo (zone Kévé/Assahoun/Badja)
coords = {
    'KEVE-S1': (1.0123, 6.4567),      # Lon, Lat approximatif
    'ASSA-S1': (1.1234, 6.5678),
    'BADJA-S1': (1.2345, 6.6789)
}

conn = psycopg.connect('postgresql://atlas:atlas@localhost:5432/atlas_clean', connect_timeout=10, autocommit=True)

for code, (lon, lat) in coords.items():
    sql = f"""
    UPDATE sondages 
    SET geom = ST_Transform(ST_SetSRID(ST_MakePoint({lon}, {lat}), 4326), 25231)
    WHERE meta->>'code' = '{code}'
    """
    conn.execute(sql)
    print(f"✓ {code}: GPS ajouté ({lon}, {lat})")

conn.close()
print("\n✅ GPS ajoutés aux sondages")
print("Maintenant il faut recréer les vues avec les vraies mailles...")
