/**
 * Module de base pour la configuration API
 * 
 * Utilise désormais la source unique de vérité définie dans config.ts.
 */
import { atlasConfig } from './config';

/**
 * Renvoie l'URL absolue de l'API (ex: "http://localhost:8000/api")
 */
export function getApiBase(): string {
  return atlasConfig.apiBase;
}

/**
 * Concatène proprement base + path
 * @param path - Chemin relatif (ex: "/surveys" ou "surveys")
 * @returns URL complète (ex: "http://localhost:8000/api/surveys")
 */
export function buildApiUrl(path: string): string {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;
  return url;
}

// Exports de base pour compatibilité
export const API_BASE = atlasConfig.apiBase;
export const WS_BASE = atlasConfig.wsBase;

console.log('[API-BASE] ✓ Module initialisé, base:', API_BASE);
