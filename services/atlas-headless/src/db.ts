/**
 * db.ts — Pool PostgreSQL + helpers pour hq_export_jobs
 * Sprint 1/2 — Intrepid Core Engineering
 */

import { Pool, PoolClient } from 'pg';
import config from './config';
import { HqJob, HqExportPayload, JobStatus } from './types';

let _pool: Pool | null = null;

export function getPool(): Pool {
  if (!_pool) {
    _pool = new Pool({
      connectionString: config.databaseUrl,
      max: config.workerPoolSize + 2,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 5_000,
    });
    _pool.on('error', (err) => {
      console.error('[DB] Pool error:', err.message);
    });
  }
  return _pool;
}

/**
 * Reclame le prochain job PENDING pour traitement.
 * Utilise FOR UPDATE SKIP LOCKED pour eviter les collisions entre workers.
 * Retourne null si aucun job disponible.
 */
export async function claimNextJob(): Promise<HqJob | null> {
  const pool = getPool();
  const client: PoolClient = await pool.connect();
  try {
    await client.query('BEGIN');

    const res = await client.query<HqJob>(`
      SELECT id, status, progress, payload, engine, requested_by, created_at
      FROM atlas.hq_export_jobs
      WHERE status = 'PENDING'
        AND (payload->>'engine' IS NULL OR payload->>'engine' = $1 OR engine = $1)
      ORDER BY created_at ASC
      LIMIT 1
      FOR UPDATE SKIP LOCKED
    `, [config.engine]);

    if (res.rows.length === 0) {
      await client.query('ROLLBACK');
      return null;
    }

    const job = res.rows[0];

    await client.query(`
      UPDATE atlas.hq_export_jobs
      SET status = 'PROCESSING', progress = 5, started_at = now(), updated_at = now()
      WHERE id = $1
    `, [job.id]);

    await client.query('COMMIT');
    return job;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

/** Met a jour la progression d'un job en cours */
export async function updateJobProgress(
  jobId: string,
  progress: number,
  status: JobStatus = 'PROCESSING'
): Promise<void> {
  const pool = getPool();
  await pool.query(`
    UPDATE atlas.hq_export_jobs
    SET progress = $1, status = $2, updated_at = now()
    WHERE id = $3
  `, [Math.min(100, Math.max(0, progress)), status, jobId]);
}

/** Marque un job comme COMPLETED avec le chemin du fichier et la duree */
export async function completeJob(
  jobId: string,
  resultPath: string,
  durationMs: number
): Promise<void> {
  const pool = getPool();
  await pool.query(`
    UPDATE atlas.hq_export_jobs
    SET status = 'COMPLETED',
        progress = 100,
        result_path = $1,
        duration_ms = $2,
        finished_at = now(),
        updated_at = now()
    WHERE id = $3
  `, [resultPath, durationMs, jobId]);
}

/** Marque un job comme FAILED avec le message d'erreur + incremente retry */
export async function failJob(
  jobId: string,
  errorMessage: string,
  retry: boolean = false
): Promise<void> {
  const pool = getPool();

  if (retry) {
    // Reinjecter en PENDING si sous le seuil max retries
    const res = await pool.query(`
      SELECT (COALESCE((payload->>'_retry_count')::int, 0) + 1) AS retry_count
      FROM atlas.hq_export_jobs WHERE id = $1
    `, [jobId]);
    const retryCount: number = res.rows[0]?.retry_count ?? 1;

    if (retryCount <= config.maxRetries) {
      await pool.query(`
        UPDATE atlas.hq_export_jobs
        SET status = 'PENDING',
            progress = 0,
            error_message = $1,
            payload = payload || jsonb_build_object('_retry_count', $2::int),
            updated_at = now()
        WHERE id = $3
      `, [errorMessage, retryCount, jobId]);
      console.log(`[DB] Job ${jobId} requeued (attempt ${retryCount}/${config.maxRetries})`);
      return;
    }
  }

  await pool.query(`
    UPDATE atlas.hq_export_jobs
    SET status = 'FAILED',
        error_message = $1,
        finished_at = now(),
        updated_at = now()
    WHERE id = $2
  `, [errorMessage, jobId]);
}

/**
 * Nettoie les fichiers et jobs COMPLETED plus vieux que cleanupAgeDays.
 * Appele periodiquement par le worker (Sprint 6).
 */
export async function cleanupOldJobs(): Promise<number> {
  const pool = getPool();
  const res = await pool.query(`
    DELETE FROM atlas.hq_export_jobs
    WHERE status IN ('COMPLETED', 'CANCELLED', 'FAILED')
      AND finished_at < now() - make_interval(days => $1)
    RETURNING result_path
  `, [config.cleanupAgeDays]);

  return res.rowCount ?? 0;
}

/** Stats pour les metriques (Sprint 6) */
export async function getJobMetrics(): Promise<Record<string, number>> {
  const pool = getPool();
  const res = await pool.query(`
    SELECT status, COUNT(*)::int AS n
    FROM atlas.hq_export_jobs
    WHERE created_at > now() - interval '24 hours'
    GROUP BY status
  `);
  const metrics: Record<string, number> = {};
  for (const row of res.rows) {
    metrics[`jobs_${row.status.toLowerCase()}_24h`] = row.n;
  }

  const durationRes = await pool.query(`
    SELECT AVG(duration_ms)::int AS avg_ms, MAX(duration_ms)::int AS max_ms
    FROM atlas.hq_export_jobs
    WHERE status = 'COMPLETED'
      AND finished_at > now() - interval '24 hours'
  `);
  if (durationRes.rows[0]) {
    metrics['job_duration_avg_ms'] = durationRes.rows[0].avg_ms ?? 0;
    metrics['job_duration_max_ms'] = durationRes.rows[0].max_ms ?? 0;
  }

  return metrics;
}
