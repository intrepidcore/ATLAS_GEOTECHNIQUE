#!/usr/bin/env python3
import psycopg2
DB = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
conn = psycopg2.connect(DB); conn.autocommit = True; cur = conn.cursor()

# Check valid status values
cur.execute("SELECT pg_get_constraintdef(c.oid) FROM pg_constraint c JOIN pg_class t ON c.conrelid=t.oid WHERE t.relname='ai_interpolation_runs' AND c.conname LIKE '%status%'")
print('Status constraint:', cur.fetchone())

cur.execute("SELECT DISTINCT status FROM atlas.ai_interpolation_runs LIMIT 10")
print('Existing statuses:', [r[0] for r in cur.fetchall()])

# Re-queue MTGP vbs/ip/eg jobs that ran without LOO (just mark as needing redo in queue)
cur.execute("""
    UPDATE atlas.ai_job_queue
    SET status='queued', started_at=NULL, finished_at=NULL, error_message=NULL
    WHERE job_type='run_mtgp'
    AND (parameter_id LIKE 'vbs_%' OR parameter_id LIKE 'ip_%' OR parameter_id LIKE 'eg_%')
    AND status='finished'
    RETURNING parameter_id
""")
requeued = [r[0] for r in cur.fetchall()]
print(f'Re-queued MTGP ({len(requeued)}): {requeued}')

cur.execute('SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status ORDER BY status')
print('QUEUE:', dict(cur.fetchall()))
conn.close()
