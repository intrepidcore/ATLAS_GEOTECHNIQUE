import psycopg2
conn = psycopg2.connect('postgresql://postgres:postgres@127.0.0.1:5433/atlas_clean')
conn.autocommit = True
cur = conn.cursor()

cur.execute('ALTER TABLE atlas.sondages DISABLE TRIGGER ALL')
print('Triggers OFF')

FIXES = [
    ('DJOGBEKOPE',        1.463733, 6.314039, 358, 'Vogan',      'Vo',       'Maritime'),
    ('Kamina Dakr\xe9',   1.601468, 8.061530, 162, 'Kamina',     'Est-Mono', 'Plateaux'),
    ('Kaniamboua (Bago)', 0.997315, 8.578808, 165, 'Kaniamboua', 'Sotouboua','Centrale'),
]

for code, lon, lat, gid, adm3, adm2, adm1 in FIXES:
    cur.execute('SELECT id FROM atlas.sondages WHERE code=%s AND deleted_at IS NULL LIMIT 1', (code,))
    row = cur.fetchone()
    if not row:
        print('NOT_FOUND:', code)
        continue
    cur.execute(
        'SELECT code FROM atlas.mailles WHERE ST_Contains(geom,ST_Transform(ST_SetSRID(ST_MakePoint(%s,%s),4326),25231)) LIMIT 1',
        (lon, lat)
    )
    mc = cur.fetchone()
    maille_code = mc[0] if mc else None
    cur.execute("""
        UPDATE atlas.sondages
        SET geom=ST_SetSRID(ST_MakePoint(%s,%s),4326),
            location_mode='inferred', location_accuracy='low',
            adm3_id=%s, adm3_name=%s, adm2_name=%s, adm1_name=%s,
            maille_code=%s, updated_at=now()
        WHERE id=%s::uuid
    """, (lon, lat, gid, adm3, adm2, adm1, maille_code, str(row[0])))
    print('FIXED', code, 'adm1=' + adm1, 'maille=' + str(maille_code))

cur.execute('ALTER TABLE atlas.sondages ENABLE TRIGGER ALL')
print('Triggers ON')

cur.execute('SELECT COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL AND geom IS NULL')
print('sans_geom=' + str(cur.fetchone()[0]))

cur.execute('SELECT adm1_name, COUNT(*) FROM atlas.sondages WHERE deleted_at IS NULL GROUP BY adm1_name ORDER BY 2 DESC')
for r in cur.fetchall():
    print(str(r))

cur.close()
conn.close()
print('DONE')
