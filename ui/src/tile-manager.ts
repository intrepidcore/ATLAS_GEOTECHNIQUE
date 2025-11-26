/**
 * tile-manager.ts - Gestion des tuiles online/offline
 * 
 * Ce module gère la bascule automatique entre tuiles OSM (online)
 * et tuiles MBTiles locales (offline via tileserver-gl).
 */

import L from 'leaflet';

// Configuration des sources de tuiles
const TILE_SOURCES = {
  online: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    maxZoom: 18,
  },
  offline: {
    // URL du tileserver local (docker-compose service tileserver)
    url: 'http://localhost:8081/styles/basic-preview/{z}/{x}/{y}.png',
    attribution: '&copy; OpenStreetMap (offline)',
    maxZoom: 18,
  },
};

// État global
let currentMode: 'online' | 'offline' | 'auto' = 'auto';
let onlineLayer: L.TileLayer | null = null;
let offlineLayer: L.TileLayer | null = null;
let activeLayer: L.TileLayer | null = null;
let failedOnline = false;

/**
 * Crée les couches de tuiles pour une carte
 */
export function createTileLayers(map: L.Map): { online: L.TileLayer; offline: L.TileLayer } {
  onlineLayer = L.tileLayer(TILE_SOURCES.online.url, {
    maxZoom: TILE_SOURCES.online.maxZoom,
    attribution: TILE_SOURCES.online.attribution,
  });

  offlineLayer = L.tileLayer(TILE_SOURCES.offline.url, {
    maxZoom: TILE_SOURCES.offline.maxZoom,
    attribution: TILE_SOURCES.offline.attribution,
  });

  // Écouter les erreurs de tuiles online pour basculer automatiquement
  onlineLayer.on('tileerror', () => {
    if (!failedOnline && currentMode === 'auto') {
      console.warn('[TileManager] Erreur tuiles online, bascule vers offline');
      failedOnline = true;
      switchToOffline(map);
    }
  });

  return { online: onlineLayer, offline: offlineLayer };
}

/**
 * Initialise la couche de tuiles avec détection automatique
 */
export function initTileLayer(map: L.Map): L.TileLayer {
  const { online, offline } = createTileLayers(map);

  // Mode auto : essayer online d'abord
  if (navigator.onLine) {
    activeLayer = online;
    online.addTo(map);
    console.log('[TileManager] Mode online activé');
  } else {
    activeLayer = offline;
    offline.addTo(map);
    console.log('[TileManager] Mode offline activé (pas de connexion)');
  }

  // Écouter les changements de connectivité
  window.addEventListener('online', () => {
    if (currentMode === 'auto' && !failedOnline) {
      console.log('[TileManager] Connexion rétablie, bascule vers online');
      switchToOnline(map);
    }
  });

  window.addEventListener('offline', () => {
    if (currentMode === 'auto') {
      console.log('[TileManager] Connexion perdue, bascule vers offline');
      switchToOffline(map);
    }
  });

  return activeLayer;
}

/**
 * Bascule vers les tuiles online
 */
export function switchToOnline(map: L.Map): void {
  if (!onlineLayer || !offlineLayer) return;
  
  if (map.hasLayer(offlineLayer)) {
    map.removeLayer(offlineLayer);
  }
  if (!map.hasLayer(onlineLayer)) {
    onlineLayer.addTo(map);
  }
  activeLayer = onlineLayer;
  console.log('[TileManager] Basculé vers online');
}

/**
 * Bascule vers les tuiles offline
 */
export function switchToOffline(map: L.Map): void {
  if (!onlineLayer || !offlineLayer) return;
  
  if (map.hasLayer(onlineLayer)) {
    map.removeLayer(onlineLayer);
  }
  if (!map.hasLayer(offlineLayer)) {
    offlineLayer.addTo(map);
  }
  activeLayer = offlineLayer;
  console.log('[TileManager] Basculé vers offline');
}

/**
 * Définit le mode de tuiles (auto, online, offline)
 */
export function setTileMode(mode: 'online' | 'offline' | 'auto', map: L.Map): void {
  currentMode = mode;
  failedOnline = false;
  
  switch (mode) {
    case 'online':
      switchToOnline(map);
      break;
    case 'offline':
      switchToOffline(map);
      break;
    case 'auto':
      if (navigator.onLine) {
        switchToOnline(map);
      } else {
        switchToOffline(map);
      }
      break;
  }
}

/**
 * Retourne le mode actuel
 */
export function getCurrentTileMode(): 'online' | 'offline' | 'auto' {
  return currentMode;
}

/**
 * Crée un contrôle Leaflet pour changer de mode de tuiles
 */
export function createTileControl(map: L.Map): L.Control {
  const TileControl = L.Control.extend({
    options: { position: 'bottomleft' as L.ControlPosition },
    
    onAdd: function() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control tile-control');
      container.style.cssText = 'background:white;padding:4px 8px;font-size:11px;cursor:pointer;';
      
      const updateLabel = () => {
        const mode = getCurrentTileMode();
        const icon = mode === 'online' ? '🌐' : mode === 'offline' ? '💾' : '🔄';
        container.innerHTML = `${icon} ${mode}`;
      };
      
      updateLabel();
      
      L.DomEvent.on(container, 'click', (e) => {
        L.DomEvent.stopPropagation(e);
        const modes: Array<'auto' | 'online' | 'offline'> = ['auto', 'online', 'offline'];
        const currentIndex = modes.indexOf(getCurrentTileMode());
        const nextMode = modes[(currentIndex + 1) % modes.length];
        setTileMode(nextMode, map);
        updateLabel();
      });
      
      return container;
    },
  });
  
  return new TileControl();
}

export default {
  initTileLayer,
  createTileLayers,
  switchToOnline,
  switchToOffline,
  setTileMode,
  getCurrentTileMode,
  createTileControl,
};
