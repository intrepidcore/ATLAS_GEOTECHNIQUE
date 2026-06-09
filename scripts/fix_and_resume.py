#!/usr/bin/env python3
"""
fix_and_resume.py — Sprint final Atlas V11
Exécute dans l'ordre :
  1. Fix VfS job (mode calibrate, pas GEE)
  2. Reset running jobs (VfS bloqué)
  3. Re-queue MTGP sans LOO-RMSE
  4. Stats avant imports
  5. Import TREC CHAUSSÉE
  6. Import EDEM route (0012+0013+0021)
  7. Import EDEM pressiomètre (0015+0017x2+0018x2+0020)
  8. Stats après imports
  9. Kill workers + restart 1 clean worker
  10. Vérification finale
"""
import sys, os, subprocess, psycopg2, time
from pathlib import Path

DB = "postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean"
SCRIPTS = Path(__file__).parent
WDIR = SCRIPTS.parent
LOG_DIR = WDIR / "logs"
LOG_DIR.mkdir(exist_ok=True)

def db():
    conn = psycopg2.connect(DB)
    conn.autocommit = True
    return conn

def queue_state(cur):
    cur.execute("SELECT status, COUNT(*) FROM atlas.ai_job_queue GROUP BY status ORDER BY status")
    return dict(cur.fetchall())

def table_counts(cur):
    tbls = ['sondages','essais_cbr','essais_proctor','essais_pressiometre','granulo_points','essais_atterberg']
    return {t: (cur.execute(f'SELECT COUNT(*) FROM atlas.{t}') or cur.fetchone()[0]) for t in tbls}

print("=" * 60)
print("Atlas Sprint Final — fix_and_resume.py")
print("=" * 60)

conn = db()
cur = conn.cursor()

# ── 1. Fix VfS ────────────────────────────────────────────────
print("\n[1/10] Fix VfS (calibrate mode, no GEE)...")
cur.execute("""
    UPDATE atlas.ai_job_queue
    SET payload='{"mode":"calibrate","batch_size":500}'::jsonb,
        status='queued', started_at=NULL, error_message=NULL
    WHERE job_type='run_vfs' AND status IN ('running','failed','queued')
    RETURNING parameter_id
""")
vfs = cur.fetchall()
print(f"  VfS fixed: {vfs}")

# ── 2. Reset running (VfS bloqué) ────────────────────────────
print("\n[2/10] Reset running jobs...")
cur.execute("""
    UPDATE atlas.ai_job_queue SET status='queued', started_at=NULL
    WHERE status='running' RETURNING parameter_id
""")
reset = [r[0] for r in cur.fetchall()]
print(f"  Reset: {reset}")

# ── 3. Re-queue MTGP sans LOO-RMSE ────────────────────────────
print("\n[3/10] Re-queue MTGP without LOO-RMSE...")
cur.execute("""
    UPDATE atlas.ai_interpolation_runs SET status='superseded'
    WHERE method='mtgp_icm_gpflow'
      AND (metrics->>'loo_rmse' IS NULL
           OR metrics->>'loo_rmse' = 'null'
           OR (metrics->'loo_residual'->>'rmse') IS NULL)
    RETURNING id
""")
sup = len(cur.fetchall())
print(f"  MTGP superseded: {sup} runs")

cur.execute("""
    UPDATE atlas.ai_job_queue
    SET status='queued', started_at=NULL, finished_at=NULL, error_message=NULL
    WHERE job_type='run_mtgp' AND status='finished'
    RETURNING parameter_id
""")
mtgp_requeued = [r[0] for r in cur.fetchall()]
print(f"  MTGP re-queued ({len(mtgp_requeued)}): {mtgp_requeued}")

# ── 4. Stats avant imports ────────────────────────────────────
print("\n[4/10] Stats AVANT imports:")
counts_before = table_counts(cur)
for k, v in counts_before.items():
    print(f"  {k}: {v}")
print(f"  Queue: {queue_state(cur)}")

conn.close()

# ── 5-7. Imports ──────────────────────────────────────────────
env = {**os.environ, "PYTHONUTF8": "1", "TF_ENABLE_ONEDNN_OPTS": "0"}

scripts_to_run = [
    ("CHAUSSÉE",        SCRIPTS / "import_trec_chaussee.py"),
    ("EDEM ROUTE",      SCRIPTS / "import_edem_route.py"),
    ("EDEM PRESSIO",    SCRIPTS / "import_edem_pressiometre.py"),
]

for label, script in scripts_to_run:
    step = 5 + scripts_to_run.index((label, script))
    print(f"\n[{step}/10] Import {label}...")
    if not script.exists():
        print(f"  SKIP: {script} not found")
        continue
    r = subprocess.run(
        [sys.executable, str(script), "--database-url", DB],
        capture_output=True, text=True, encoding="utf-8", errors="replace",
        cwd=str(WDIR), env=env, timeout=300
    )
    lines = (r.stdout + r.stderr).splitlines()
    # Print last 15 lines
    for l in lines[-15:]:
        print(f"  {l}")
    if r.returncode != 0:
        print(f"  !! EXIT {r.returncode}")
    else:
        print(f"  OK (exit 0)")

# ── 8. Stats après imports ────────────────────────────────────
print("\n[8/10] Stats APRÈS imports:")
conn2 = db()
cur2 = conn2.cursor()
counts_after = table_counts(cur2)
for k, v in counts_after.items():
    delta = v - counts_before[k]
    marker = f" (+{delta})" if delta > 0 else ""
    print(f"  {k}: {v}{marker}")

# ── 9. Kill workers + restart ──────────────────────────────────
print("\n[9/10] Kill workers + restart clean worker...")
import subprocess as sp
r = sp.run(['wmic', 'process', 'where', "CommandLine like '%pipeline_worker%'", 'get', 'ProcessId'],
    capture_output=True, text=True, encoding='utf-8', errors='replace')
pids = [l.strip() for l in r.stdout.splitlines() if l.strip().isdigit()]
print(f"  Workers to kill: {pids}")
for pid in pids:
    sp.run(['taskkill', '/F', '/PID', pid], capture_output=True)
    print(f"  Killed PID {pid}")

time.sleep(2)

# Reset any leftover running
cur2.execute("UPDATE atlas.ai_job_queue SET status='queued',started_at=NULL WHERE status='running' RETURNING parameter_id")
leftover = [r[0] for r in cur2.fetchall()]
if leftover: print(f"  Leftover running reset: {leftover}")

# Start new worker
log_path = LOG_DIR / f"worker_final2_{time.strftime('%H%M')}.log"
worker_proc = sp.Popen(
    [sys.executable, 'scripts/pipeline_worker.py',
     '--database-url', DB, '--interval', '10'],
    cwd=str(WDIR),
    stdout=open(log_path, 'w'),
    stderr=sp.STDOUT,
    env=env,
    creationflags=0x00000008  # DETACHED_PROCESS on Windows
)
print(f"  New worker PID={worker_proc.pid}, log={log_path}")

# ── 10. Final state ────────────────────────────────────────────
print("\n[10/10] Final state:")
print(f"  Queue: {queue_state(cur2)}")
cur2.execute("SELECT COUNT(*) FROM atlas.ai_interpolation_runs")
print(f"  Runs in DB: {cur2.fetchone()[0]}")
conn2.close()

print("\n" + "=" * 60)
print("fix_and_resume.py DONE")
print("=" * 60)
