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
  const runtimeOverride = (window as any).__API_GEO__ as string | undefined;
  if (typeof runtimeOverride === 'string' && runtimeOverride.trim() !== '') {
    const raw = runtimeOverride.trim().replace(/\/+$/, "");
    if (/^https?:\/\//i.test(raw)) {
      try {
        const u = new URL(raw);
        if (u.pathname === '/' || u.pathname === '') {
          const normalized = `${u.origin}/api`;
          console.debug('[API-BASE] Runtime override (normalized):', normalized);
          return normalized;
        }
      } catch {
        // ignore URL parse errors and fall back to raw
      }
    }
    console.debug('[API-BASE] Runtime override:', raw);
    return raw;
  }

  // Si la valeur est déjà absolue → on normalise juste
  if (/^https?:\/\//i.test(RAW_API_GEO)) {
    const raw = RAW_API_GEO.replace(/\/+$/, "");
    try {
      const u = new URL(raw);
      if (u.pathname === '/' || u.pathname === '') {
        const normalized = `${u.origin}/api`;
        console.debug('[API-BASE] Configuration explicite (normalized):', normalized);
        return normalized;
      }
    } catch {
      // ignore URL parse errors and fall back to raw
    }
    console.debug('[API-BASE] Configuration explicite:', raw);
    return raw;
  }

  const normalized = RAW_API_GEO.replace(/\/+$/, "");
  console.debug('[API-BASE] Configuration relative:', normalized);
  return normalized;
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
