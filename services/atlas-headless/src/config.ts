/**
 * config.ts — Configuration depuis les variables d'environnement
 * Valeurs par defaut adaptees au developpement local.
 */

function requireEnv(name: string, fallback?: string): string {
  const val = process.env[name] ?? fallback;
  if (val === undefined) {
    throw new Error(`Env var ${name} is required`);
  }
  return val;
}

export const config = {
  /** URL PostgreSQL pour hq_export_jobs */
  databaseUrl: requireEnv(
    'DATABASE_URL',
    'postgresql://atlas:atlas@127.0.0.1:5433/atlas_clean'
  ),

  /** URL de l'API Atlas (pour fetcher les donnees thematiques en Phase 2) */
  apiBaseUrl: requireEnv('API_BASE_URL', 'http://localhost:8000'),

  /** URL de l'UI Atlas (Phase 1 Puppeteer uniquement) */
  atlasUiUrl: requireEnv('ATLAS_UI_URL', 'http://localhost:5173'),

  /** Repertoire de sortie pour les exports PNG/PDF */
  exportsDir: requireEnv('EXPORTS_DIR', './exports/hq'),

  /** Moteur de rendu actif */
  engine: (process.env.ENGINE ?? 'puppeteer') as 'puppeteer' | 'maplibre',

  /** Interval de polling de la job queue (ms) */
  pollIntervalMs: parseInt(process.env.POLL_INTERVAL_MS ?? '2000', 10),

  /** Nombre max de retries par job */
  maxRetries: parseInt(process.env.MAX_RETRIES ?? '3', 10),

  /** Timeout Puppeteer par job (ms) */
  jobTimeoutMs: parseInt(process.env.JOB_TIMEOUT_MS ?? '120000', 10),

  /** Taille du worker pool (Phase 1 : tabs Puppeteer en parallele) */
  workerPoolSize: parseInt(process.env.WORKER_POOL_SIZE ?? '3', 10),

  /** Age max des fichiers export avant nettoyage automatique (jours) */
  cleanupAgeDays: parseInt(process.env.CLEANUP_AGE_DAYS ?? '7', 10),

  /** Activer les metriques Prometheus sur :9091/metrics */
  metricsEnabled: process.env.METRICS_ENABLED !== 'false',
  metricsPort: parseInt(process.env.METRICS_PORT ?? '9091', 10),

  /** Chromium executable (Phase 1) */
  chromiumPath: process.env.PUPPETEER_EXECUTABLE_PATH ?? undefined,
} as const;

export default config;
