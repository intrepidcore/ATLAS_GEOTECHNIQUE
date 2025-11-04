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
