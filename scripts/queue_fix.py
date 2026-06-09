#!/usr/bin/env python3
"""queue_fix.py — fix queue state, cancel unsupported V11 jobs, re-queue MTGP"""
import psycopg2, sys
DB = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
conn = psycopg2.connect(DB); conn.autocommit = True; cur = conn.cursor()

# Cancel unsupported V11 fusion/MTGP
for p in ['cbr_95','gamma_d','w_opt','rd_mpa','em_mpa','pl_mpa']:
    cur.execute("""UPDATE atlas.ai_job_queue SET status='cancelled',
        error_message='param_not_supported_in_script'
        WHERE parameter_id LIKE %s AND job_type IN ('run_fusion','run_mtgp')
        AND status IN ('queued','failed') RETURNING parameter_id""", (f'{p}%',))
    r = cur.fetchall()
    if r: print(f'Cancelled {p} jobs: {[x[0] for x in r]}')

# Supersede old MTGP runs without LOO-RMSE
cur.execute("""UPDATE atlas.ai_interpolation_runs SET status='superseded'
    WHERE method='mtgp_icm_gpflow'
    AND (metrics->>'loo_rmse' IS NULL
         OR (metrics->'loo_residual'->>'rmse') IS NULL)
    RETURNING id""")
sup = len(cur.fetchall()); print(f'Superseded {sup} MTGP runs without LOO-RMSE')

# Re-queue finished MTGP for vbs/ip/eg (need LOO-RMSE recompute)
cur.execute("""UPDATE atlas.ai_job_queue
    SET status='queued', started_at=NULL, finished_at=NULL, error_message=NULL
    WHERE job_type='run_mtgp'
    AND (parameter_id LIKE 'vbs_%' OR parameter_id LIKE 'ip_%' OR parameter_id LIKE 'eg_%')
    AND status='finished' RETURNING parameter_id""")
requeued = [r[0] for r in cur.fetchall()]
print(f'Re-queued MTGP ({len(requeued)}): {requeued}')

# Queue state
cur.execute('SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status ORDER BY status')
print('QUEUE:', dict(cur.fetchall()))
cur.execute("SELECT COUNT(*) FROM atlas.ai_interpolation_runs WHERE status != 'superseded'")
print('Active runs in DB:', cur.fetchone()[0])
conn.close()
