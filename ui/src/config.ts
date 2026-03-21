/**
 * Configuration globale de l'application Atlas
 * v2.5.0 - Phase UI-01
 */

export const CONFIG = {
  // Feature flags
  features: {
    /**
     * v2.5.0 - Panneau Sondages à onglets style QGIS
     * 
     * Toggle: true = nouvelle UI, false = ancienne UI
     * Override localStorage: atlas_ui_tabs=on/off
     */
    get uiPanelTabs(): boolean {
      // Override localStorage pour test en prod sans rebuild
      const override = localStorage.getItem('atlas_ui_tabs');
      if (override === 'on') return true;
      if (override === 'off') return false;
      
      // Valeur par défaut (OFF - modal en développement)
      return false;
    },
  },
  
  // Persistance localStorage
  storage: {
    tabStateKey: 'atlas_active_tab',
    filtersStateKey: 'atlas_filters',
  },
  
  // Raccourcis clavier
  shortcuts: {
    nextTab: 'Control+Tab',
    prevTab: 'Control+Shift+Tab',
    closeModal: 'Escape',
  },
  
  // UI
  ui: {
    defaultTab: 'liste' as const,
    animationDuration: 200, // ms
  },
  
  // Version (pour migration localStorage)
  version: '2.5.0',
};

export type Config = typeof CONFIG;

// --- API Configuration (Source Unique de Vérité) ---

export interface AtlasConfig {
    apiBase: string;
    wsBase: string;
    version: string;
    environment: 'development' | 'production' | 'tauri';
}

function resolveConfig(): AtlasConfig {
    // Priorité 1 : Injection Tauri au runtime (Desktop)
    const tauriConfig = (window as any).__ATLAS_CONFIG__;
    if (tauriConfig?.apiBase) {
        console.log('[Config] Source: Tauri runtime injection');
        return {
            apiBase: tauriConfig.apiBase,
            wsBase: tauriConfig.wsBase || tauriConfig.apiBase.replace('http', 'ws'),
            version: tauriConfig.version || import.meta.env.VITE_APP_VERSION || 'tauri',
            environment: 'tauri'
        };
    }
    
    // Priorité 2 : Variable d'environnement Vite (développement)
    if (import.meta.env.VITE_API_BASE) {
        console.log('[Config] Source: VITE_API_BASE env var');
        return {
            apiBase: import.meta.env.VITE_API_BASE,
            wsBase: import.meta.env.VITE_API_BASE.replace('http', 'ws'),
            version: import.meta.env.VITE_APP_VERSION || 'dev',
            environment: 'development'
        };
    }
    
    // Priorité 3 : Relatif (production web — proxy Nginx/Vite gère le routing)
    console.log('[Config] Source: relative URL (proxy mode)');
    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    return {
        apiBase: '/api',
        wsBase: `${wsProtocol}//${window.location.host}/api/ws`,
        version: import.meta.env.VITE_APP_VERSION || 'unknown',
        environment: 'production'
    };
}

// Singleton — calculé une seule fois au démarrage
export const atlasConfig = resolveConfig();

// Log de démarrage
console.log(`[Atlas Config] environment=${atlasConfig.environment} api=${atlasConfig.apiBase}`);
