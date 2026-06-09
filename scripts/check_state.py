import psycopg2
conn = psycopg2.connect('postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean')
cur = conn.cursor()
cur.execute('SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status ORDER BY status')
print('QUEUE:', dict(cur.fetchall()))
cur.execute("SELECT parameter_id FROM atlas.ai_job_queue WHERE status='running'")
print('RUNNING:', [r[0] for r in cur.fetchall()])
cur.execute('SELECT COUNT(*) FROM atlas.ai_interpolation_runs')
print('RUNS:', cur.fetchone()[0])
for t in ['sondages','essais_cbr','essais_proctor','essais_pressiometre','granulo_points']:
    cur.execute('SELECT COUNT(*) FROM atlas.' + t)
    print(f'  {t}:', cur.fetchone()[0])
conn.close()
