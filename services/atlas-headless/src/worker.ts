/**
 * worker.ts — Boucle principale du worker Puppeteer
 * Sprint 2 — Moteur d'export serveur headless
 * Intrepid Core Engineering Standards
 *
 * Architecture :
 *   1. Poll atlas.hq_export_jobs (FOR UPDATE SKIP LOCKED)
 *   2. Ouvrir page Atlas UI via Puppeteer
 *   3. Appeler window.__atlasExportHQ(payload) pour configurer la carte
 *   4. Attendre fin chargement tiles (waitForTilesLoaded)
 *   5. Screenshot → PNG dans EXPORTS_DIR
 *   6. Composer cadre A4 (Sharp — Sprint 3)
 *   7. Marquer COMPLETED avec chemin fichier + duree
 */

import puppeteer, { Browser, Page } from 'puppeteer-core';
import * as path from 'path';
import * as fs from 'fs';
import config from './config';
import { claimNextJob, updateJobProgress, completeJob, failJob, cleanupOldJobs } from './db';
import { HqJob, HqExportPayload, TOGO_BBOX } from './types';
import { compositeA4Frame } from './frame/composer';

const EXPORTS_DIR = config.exportsDir;
const POLL_MS     = config.pollIntervalMs;
const TIMEOUT_MS  = config.jobTimeoutMs;

// Assurer que le repertoire d'exports existe
fs.mkdirSync(EXPORTS_DIR, { recursive: true });

// ── Puppeteer helpers ─────────────────────────────────────────────────────────

/**
 * Attend que les tuiles Leaflet soient toutes chargees.
 * Detecte fin de chargement reel (pas de sleep fixe).
 * Correspond au fix "Probleme 1" de la roadmap.
 */
async function waitForTilesLoaded(page: Page, timeout: number = 15_000): Promise<void> {
  await page.waitForFunction(
    () => {
      // Verifier que la carte est initialisee
      const leafletMap = (window as any).__leafletMap ?? (window as any).leafletMap;
      if (!leafletMap) return false;

      // Verifier qu'aucune tuile n'est en cours de chargement
      const loadingTiles = document.querySelectorAll('.leaflet-tile-loading');
      if (loadingTiles.length > 0) return false;

      // Verifier que les tuiles sont presentes (au moins 4 = carte visible)
      const tiles = document.querySelectorAll('.leaflet-tile');
      return tiles.length >= 4;
    },
    { timeout, polling: 250 }
  ).catch(() => {
    // Timeout non fatal — continuer avec ce qui est charge
    console.warn('[Worker] waitForTilesLoaded timeout — proceeding anyway');
  });

  // Attendre 300ms supplementaires pour la stabilisation du rendu SVG/canvas
  await new Promise((r) => setTimeout(r, 300));
}

/**
 * Configure la carte Atlas pour le job via window.__atlasExportHQ().
 * Cette fonction est exposee dans ui/src/main.ts (Sprint 4).
 * Si non disponible (ancienne version UI), on fait un fallback URL params.
 */
async function configureMapForJob(page: Page, payload: HqExportPayload): Promise<void> {
  const hasHQExport = await page.evaluate(() => {
    return typeof (window as any).__atlasExportHQ === 'function';
  });

  if (hasHQExport) {
    await page.evaluate(async (p: HqExportPayload) => {
      await (window as any).__atlasExportHQ(p);
    }, payload);
  } else {
    // Fallback : juste attendre que la page soit chargee
    console.warn('[Worker] __atlasExportHQ not available — using URL params fallback');
    await page.waitForFunction(
      () => document.readyState === 'complete' && !!(window as any).leafletMap,
      { timeout: 20_000 }
    );
  }
}

/** Construit l'URL de l'UI Atlas avec les parametres du job */
function buildAtlasUrl(payload: HqExportPayload): string {
  const params = new URLSearchParams({
    thematic: payload.thematic_id,
    adm_level: payload.adm_level,
    ...(payload.adm_name ? { adm_name: payload.adm_name } : {}),
    _headless: '1',
  });
  return `${config.atlasUiUrl}?${params.toString()}`;
}

// ── Job processing ────────────────────────────────────────────────────────────

/**
 * Traite un job d'export avec Puppeteer.
 * Retourne le chemin absolu du fichier genere.
 */
async function processJobWithPuppeteer(
  browser: Browser,
  job: HqJob
): Promise<string> {
  const payload = job.payload;
  const output  = { ...{ format: 'png' as const, dpi: 150, width_px: 2480, height_px: 3508 }, ...payload.output };

  const page = await browser.newPage();
  page.setDefaultTimeout(TIMEOUT_MS);
  page.setDefaultNavigationTimeout(TIMEOUT_MS);

  try {
    // Viewport = resolution de sortie / 2 (devicePixelRatio=2 pour HQ)
    await page.setViewport({
      width: Math.round(output.width_px / 2),
      height: Math.round(output.height_px / 2),
      deviceScaleFactor: 2,
    });

    // Navigation vers l'UI Atlas
    await updateJobProgress(job.id, 10);
    const url = buildAtlasUrl(payload);
    console.log(`[Worker] Navigating: ${url}`);
    await page.goto(url, { waitUntil: 'networkidle0', timeout: 30_000 });

    // Configuration carte via __atlasExportHQ
    await updateJobProgress(job.id, 25);
    await configureMapForJob(page, payload);

    // Attente des tiles
    await updateJobProgress(job.id, 50);
    await waitForTilesLoaded(page);

    // Screenshot brut
    await updateJobProgress(job.id, 70);
    const rawPath = path.join(EXPORTS_DIR, `${job.id}_raw.png`);
    await page.screenshot({
      path: rawPath as `${string}.png`,
      type: 'png',
      fullPage: false,
      captureBeyondViewport: false,
    });

    // Composition cadre A4 (Sprint 3)
    await updateJobProgress(job.id, 85);
    const outputPath = path.join(EXPORTS_DIR, `${job.id}.png`);
    const bbox = payload.bbox ?? TOGO_BBOX;
    await compositeA4Frame(rawPath, outputPath, {
      payload,
      bbox,
      width: output.width_px,
      height: output.height_px,
      dpi: output.dpi,
    });

    // Nettoyage screenshot brut
    fs.unlink(rawPath, () => {});

    return outputPath;
  } finally {
    await page.close().catch(() => {});
  }
}

// ── Worker pool ───────────────────────────────────────────────────────────────

/**
 * Traite un job : retry automatique jusqu'a maxRetries (Sprint 6).
 */
async function processJobWithRetry(browser: Browser, job: HqJob): Promise<void> {
  const t0 = Date.now();
  const retryCount = (job.payload as any)._retry_count ?? 0;

  try {
    console.log(`[Worker] Processing job ${job.id} (engine=puppeteer, retry=${retryCount})`);
    const outputPath = await processJobWithPuppeteer(browser, job);
    const durationMs = Date.now() - t0;
    await completeJob(job.id, outputPath, durationMs);
    console.log(`[Worker] Completed ${job.id} in ${durationMs}ms -> ${outputPath}`);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error(`[Worker] Job ${job.id} failed: ${msg}`);
    const shouldRetry = retryCount < config.maxRetries;
    await failJob(job.id, msg, shouldRetry);
  }
}

// ── Metrics (Sprint 6) ────────────────────────────────────────────────────────

let _jobsProcessed   = 0;
let _jobsFailed      = 0;
let _totalDurationMs = 0;

function startMetricsServer(): void {
  if (!config.metricsEnabled) return;
  const http = require('http');
  http.createServer(async (req: any, res: any) => {
    if (req.url === '/metrics') {
      const { getJobMetrics } = await import('./db');
      const dbMetrics = await getJobMetrics().catch(() => ({}));
      const lines = [
        `# HELP atlas_headless_jobs_processed_total Total jobs processed`,
        `atlas_headless_jobs_processed_total ${_jobsProcessed}`,
        `# HELP atlas_headless_jobs_failed_total Total jobs failed`,
        `atlas_headless_jobs_failed_total ${_jobsFailed}`,
        `# HELP atlas_headless_duration_avg_ms Avg job duration (ms)`,
        `atlas_headless_duration_avg_ms ${_jobsProcessed > 0 ? Math.round(_totalDurationMs / _jobsProcessed) : 0}`,
        ...Object.entries(dbMetrics).map(([k, v]) => `atlas_headless_${k} ${v}`),
      ];
      res.writeHead(200, { 'Content-Type': 'text/plain' });
      res.end(lines.join('\n') + '\n');
    } else {
      res.writeHead(404);
      res.end('Not found');
    }
  }).listen(config.metricsPort, () => {
    console.log(`[Metrics] Prometheus endpoint: http://localhost:${config.metricsPort}/metrics`);
  });
}

// ── Main loop ─────────────────────────────────────────────────────────────────

let _cleanupTick = 0;
const CLEANUP_EVERY_N_POLLS = 1000; // ~30 min avec poll=2s

export async function runWorker(): Promise<void> {
  console.log('[Worker] Starting atlas-headless worker');
  console.log(`[Worker] Engine: ${config.engine}`);
  console.log(`[Worker] Exports dir: ${EXPORTS_DIR}`);
  console.log(`[Worker] UI URL: ${config.atlasUiUrl}`);

  if (config.engine !== 'puppeteer') {
    console.warn('[Worker] Engine != puppeteer — MapLibre Phase 2 not yet active, fallback to puppeteer');
  }

  // Lancer serveur metriques (Sprint 6)
  startMetricsServer();

  // Lancer navigateur Puppeteer (une seule instance partagee)
  const browser = await puppeteer.launch({
    headless: true,
    executablePath: config.chromiumPath,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-gpu',
      '--disable-extensions',
      '--window-size=1280,1024',
    ],
  });
  console.log('[Worker] Puppeteer browser launched');

  // Gestion arret propre
  let stopping = false;
  process.on('SIGTERM', async () => {
    console.log('[Worker] SIGTERM received — shutting down gracefully');
    stopping = true;
    await browser.close();
    process.exit(0);
  });
  process.on('SIGINT', () => {
    stopping = true;
    browser.close().finally(() => process.exit(0));
  });

  // Active jobs en cours (pour le pool)
  const activeJobs = new Set<string>();

  while (!stopping) {
    // Nettoyage periodique (Sprint 6)
    _cleanupTick++;
    if (_cleanupTick % CLEANUP_EVERY_N_POLLS === 0) {
      const deleted = await cleanupOldJobs().catch(() => 0);
      if (deleted > 0) {
        console.log(`[Worker] Cleanup: deleted ${deleted} old jobs/files`);
      }
    }

    // Ne pas depasser la taille du pool
    if (activeJobs.size >= config.workerPoolSize) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }

    // Reclamer un job
    const job = await claimNextJob().catch((err) => {
      console.error('[Worker] Error claiming job:', err.message);
      return null;
    });

    if (!job) {
      await new Promise((r) => setTimeout(r, POLL_MS));
      continue;
    }

    // Traiter en arriere-plan (pool non-bloquant)
    activeJobs.add(job.id);
    const t0 = Date.now();
    processJobWithRetry(browser, job).finally(() => {
      activeJobs.delete(job.id);
      const dur = Date.now() - t0;
      _jobsProcessed++;
      _totalDurationMs += dur;
    }).catch((err) => {
      _jobsFailed++;
      console.error('[Worker] Unhandled error in processJobWithRetry:', err);
    });
  }
}
