import psycopg2, subprocess, sys, os
c = psycopg2.connect('postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean')
c.autocommit = True; cur = c.cursor()

# Cancel all VfS (requires GEE auth, not worth it)
cur.execute("""UPDATE atlas.ai_job_queue SET status='cancelled', error_message='requires_gee_auth'
    WHERE job_type='run_vfs' RETURNING parameter_id""")
print('VfS cancelled:', cur.fetchall())

# Queue state
cur.execute('SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status ORDER BY status')
print('QUEUE:', dict(cur.fetchall()))
cur.execute('SELECT COUNT(*) FROM atlas.ai_interpolation_runs')
print('Total runs:', cur.fetchone()[0])
c.close()
