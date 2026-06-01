/**
 * index.ts — Point d'entree du worker atlas-headless
 * Intrepid Core Engineering Standards
 */

import { runWorker } from './worker';
import config from './config';

console.log('[Atlas Headless] Starting...');
console.log(`[Atlas Headless] Engine      : ${config.engine}`);
console.log(`[Atlas Headless] DB          : ${config.databaseUrl.replace(/:[^@]+@/, ':***@')}`);
console.log(`[Atlas Headless] UI URL      : ${config.atlasUiUrl}`);
console.log(`[Atlas Headless] Exports dir : ${config.exportsDir}`);
console.log(`[Atlas Headless] Pool size   : ${config.workerPoolSize}`);
console.log(`[Atlas Headless] Max retries : ${config.maxRetries}`);

runWorker().catch((err) => {
  console.error('[Atlas Headless] Fatal error:', err);
  process.exit(1);
});
