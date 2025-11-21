/**
 * Module de base pour la configuration API
 * Fournit des helpers pour construire des URLs absolues de manière sûre
 * 
 * VERSION BÉTON : garantit que toutes les URLs sont absolues
 * UI = localhost:8080, API = localhost:8000
 */

const RAW_API_GEO = import.meta.env.VITE_API_GEO ?? "/api";

/**
 * Renvoie toujours une URL ABSOLUE sans slash final
 * @returns URL absolue de l'API (ex: "http://localhost:8000")
 */
export function getApiBase(): string {
  // Si la valeur est déjà absolue → on normalise juste
  if (/^https?:\/\//i.test(RAW_API_GEO)) {
    const normalized = RAW_API_GEO.replace(/\/+$/, "");
    console.debug('[API-BASE] Configuration explicite:', normalized);
    return normalized;
  }

  // Sinon : calculer depuis window.location
  // UI sur :8080 → API sur :8000
  const calculated = `${window.location.protocol}//${window.location.hostname}:8000`;
  
  console.debug('[API-BASE] Configuration calculée:', {
    raw: RAW_API_GEO,
    calculated: calculated
  });
  
  return calculated;
}

/**
 * Concatène proprement base + path
 * @param path - Chemin relatif (ex: "/surveys" ou "surveys")
 * @returns URL complète (ex: "http://localhost:8000/surveys")
 */
export function buildApiUrl(path: string): string {
  const base = getApiBase();
  const cleanPath = path.startsWith("/") ? path : `/${path}`;
  const url = `${base}${cleanPath}`;
  
  console.debug('[API-BASE] buildApiUrl', { base, path: cleanPath, url });
  
  return url;
}

// Export de la base pour compatibilité
export const API_BASE = getApiBase();

console.log('[API-BASE] ✓ Module initialisé, base:', API_BASE);
