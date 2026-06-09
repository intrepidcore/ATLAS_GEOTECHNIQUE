import psycopg2
c = psycopg2.connect('postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean')
c.autocommit = True
cur = c.cursor()
cur.execute("""UPDATE atlas.ai_job_queue
    SET payload='{"mode":"calibrate","batch_size":500}'::jsonb,
        status='queued', started_at=NULL, error_message=NULL
    WHERE job_type='run_vfs' AND status IN ('running','failed','queued')
    RETURNING parameter_id""")
print('VfS fixed:', cur.fetchall())
cur.execute("UPDATE atlas.ai_job_queue SET status='queued',started_at=NULL WHERE status='running' RETURNING parameter_id")
print('Reset running:', cur.fetchall())
cur.execute('SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status ORDER BY status')
print('QUEUE:', dict(cur.fetchall()))
c.close()
