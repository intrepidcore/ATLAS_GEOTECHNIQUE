/**
 * tile-manager.ts - Gestion des tuiles online/offline + fonds de carte
 * 
 * Ce module gère :
 * - La bascule automatique entre tuiles OSM (online) et MBTiles locales (offline)
 * - Les différents fonds de carte (OSM, ESRI, Mapbox, Azure)
 * 
 * v3.0 - Support multi-basemaps + auto-configuration via TileJSON
 */

import L from 'leaflet';
import { createAllBasemaps, createEsriImageryBasemap, createOsmBasemap } from './map/basemaps';

// Configuration du tileserver
const TILESERVER_URL = import.meta.env.VITE_TILES_URL || 'http://localhost:8081';
const TILESET_NAME = 'togo_map';

// Configuration des sources de tuiles
const TILE_SOURCES = {
  online: {
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
    minZoom: 4,
    maxZoom: 19,
  },
  // Offline sera configuré dynamiquement via TileJSON
  offline: {
    url: `${TILESERVER_URL}/data/${TILESET_NAME}/{z}/{x}/{y}.png`,
    attribution: '&copy; OpenStreetMap (offline)',
    minZoom: 5,  // Valeurs par défaut, seront mises à jour via TileJSON
    maxZoom: 15,
  },
};

// État global
let currentMode: 'online' | 'offline' | 'auto' = 'auto';
let onlineLayer: L.TileLayer | null = null;
let offlineLayer: L.TileLayer | null = null;
let activeLayer: L.TileLayer | null = null;
let failedOnline = false;
let offlineAvailable = false;
let offlineConfig: { url: string; minZoom: number; maxZoom: number; bounds?: L.LatLngBounds } | null = null;

/**
 * Récupère la configuration du tileserver via TileJSON
 * Retourne null si le tileserver n'est pas disponible
 */
async function fetchTileJSON(): Promise<{
  url: string;
  minZoom: number;
  maxZoom: number;
  bounds?: L.LatLngBounds;
} | null> {
  try {
    const resp = await fetch(`${TILESERVER_URL}/data/${TILESET_NAME}.json`, { 
      mode: 'cors',
      cache: 'no-cache'
    });
    
    if (!resp.ok) {
      console.warn(`[TileManager] TileJSON HTTP ${resp.status}`);
      return null;
    }
    
    const tilejson = await resp.json();
    
    // Extraire l'URL des tuiles (utiliser la première si plusieurs)
    const tileUrl: string = (tilejson.tiles && tilejson.tiles[0]) 
      || `${TILESERVER_URL}/data/${TILESET_NAME}/{z}/{x}/{y}.png`;
    
    // Extraire les zooms
    const minZoom: number = tilejson.minzoom ?? 5;
    const maxZoom: number = tilejson.maxzoom ?? 15;
    
    // Extraire les bounds si disponibles
    let bounds: L.LatLngBounds | undefined;
    if (tilejson.bounds && tilejson.bounds.length === 4) {
      bounds = L.latLngBounds(
        [tilejson.bounds[1], tilejson.bounds[0]], // SW
        [tilejson.bounds[3], tilejson.bounds[2]]  // NE
      );
    }
    
    console.log(`[TileManager] TileJSON OK: ${tileUrl}, zoom ${minZoom}-${maxZoom}`);
    
    return { url: tileUrl, minZoom, maxZoom, bounds };
    
  } catch (err) {
    console.warn('[TileManager] TileJSON fetch failed:', err);
    return null;
  }
}

/**
 * Initialise les tuiles offline via TileJSON (à appeler au démarrage)
 */
export async function initOfflineTiles(): Promise<boolean> {
  const config = await fetchTileJSON();
  
  if (config) {
    offlineConfig = config;
    offlineAvailable = true;
    
    // Mettre à jour TILE_SOURCES avec les vraies valeurs
    TILE_SOURCES.offline.url = config.url;
    TILE_SOURCES.offline.minZoom = config.minZoom;
    TILE_SOURCES.offline.maxZoom = config.maxZoom;
    
    console.log('[TileManager] Offline tiles configured:', config);
    return true;
  } else {
    offlineAvailable = false;
    console.warn('[TileManager] Offline tiles NOT available');
    return false;
  }
}

/**
 * Crée les couches de tuiles pour une carte
 */
export function createTileLayers(map: L.Map): { online: L.TileLayer; offline: L.TileLayer | null } {
  // Couche online (OSM)
  onlineLayer = L.tileLayer(TILE_SOURCES.online.url, {
    minZoom: TILE_SOURCES.online.minZoom,
    maxZoom: TILE_SOURCES.online.maxZoom,
    attribution: TILE_SOURCES.online.attribution,
  });

  // Couche offline (seulement si disponible)
  if (offlineAvailable && offlineConfig) {
    offlineLayer = L.tileLayer(offlineConfig.url, {
      minZoom: offlineConfig.minZoom,
      maxZoom: offlineConfig.maxZoom,
      attribution: TILE_SOURCES.offline.attribution,
      bounds: offlineConfig.bounds, // Limiter aux bounds du MBTiles
    });
    console.log(`[TileManager] Offline layer created: zoom ${offlineConfig.minZoom}-${offlineConfig.maxZoom}`);
  } else {
    offlineLayer = null;
    console.log('[TileManager] Offline layer NOT created (tileserver unavailable)');
  }

  // Écouter les erreurs de tuiles online pour basculer automatiquement
  onlineLayer.on('tileerror', () => {
    if (!failedOnline && currentMode === 'auto' && offlineLayer) {
      console.warn('[TileManager] Erreur tuiles online, bascule vers offline');
      failedOnline = true;
      switchToOffline(map);
    }
  });

  return { online: onlineLayer, offline: offlineLayer };
}

/**
 * Initialise la couche de tuiles avec détection automatique
 * IMPORTANT: Appeler initOfflineTiles() AVANT cette fonction pour configurer le tileserver
 */
export function initTileLayer(map: L.Map): L.TileLayer {
  const { online, offline } = createTileLayers(map);

  // Mode auto : essayer online d'abord
  if (navigator.onLine) {
    activeLayer = online;
    online.addTo(map);
    console.log('[TileManager] Mode online activé');
  } else if (offline) {
    activeLayer = offline;
    offline.addTo(map);
    console.log('[TileManager] Mode offline activé (pas de connexion)');
  } else {
    // Fallback: pas de connexion ET pas de tileserver → OSM quand même
    activeLayer = online;
    online.addTo(map);
    console.warn('[TileManager] Pas de connexion et tileserver indisponible, fallback OSM');
  }

  // Écouter les changements de connectivité
  window.addEventListener('online', () => {
    if (currentMode === 'auto' && !failedOnline) {
      console.log('[TileManager] Connexion rétablie, bascule vers online');
      switchToOnline(map);
    }
  });

  window.addEventListener('offline', () => {
    if (currentMode === 'auto' && offlineAvailable) {
      console.log('[TileManager] Connexion perdue, bascule vers offline');
      switchToOffline(map);
    }
  });

  return activeLayer!;
}

/**
 * Bascule vers les tuiles online
 */
export function switchToOnline(map: L.Map): void {
  if (!onlineLayer) return;
  
  if (offlineLayer && map.hasLayer(offlineLayer)) {
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
  if (!onlineLayer) return;
  
  // Si pas de layer offline, on reste sur online
  if (!offlineLayer) {
    console.warn('[TileManager] Offline non disponible, reste sur online');
    return;
  }
  
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
 * Retourne si les tuiles offline sont disponibles
 */
export function isOfflineAvailable(): boolean {
  return offlineAvailable;
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
 * Style clair et lisible sur fond de carte sombre
 * Affiche le statut du tileserver (disponible ou non)
 */
export function createTileControl(map: L.Map): L.Control {
  const TileControl = L.Control.extend({
    options: { position: 'bottomleft' as L.ControlPosition },
    
    onAdd: function() {
      const container = L.DomUtil.create('div', 'leaflet-bar leaflet-control tile-control');
      container.style.cssText = `
        background: #f9fafb;
        color: #111827;
        border: 1px solid #d1d5db;
        border-radius: 6px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.15);
        font-size: 11px;
        font-weight: 600;
        padding: 6px 10px;
        cursor: pointer;
        user-select: none;
        display: flex;
        align-items: center;
        gap: 4px;
      `;
      
      const updateLabel = () => {
        const mode = getCurrentTileMode();
        const offline = isOfflineAvailable();
        
        let icon: string;
        let label: string;
        let statusColor: string;
        let tooltip: string;
        
        if (mode === 'online') {
          icon = '🌐';
          label = 'Online';
          statusColor = '#059669';
          tooltip = 'Tuiles OSM (internet)';
        } else if (mode === 'offline') {
          if (offline) {
            icon = '💾';
            label = 'Offline';
            statusColor = '#d97706';
            tooltip = 'Tuiles locales (tileserver OK)';
          } else {
            icon = '⚠️';
            label = 'Offline (N/A)';
            statusColor = '#dc2626';
            tooltip = 'Tileserver indisponible, fallback OSM';
          }
        } else {
          icon = '🔄';
          label = offline ? 'Auto' : 'Auto (OSM)';
          statusColor = '#6366f1';
          tooltip = offline ? 'Bascule automatique online/offline' : 'Auto (tileserver indisponible)';
        }
        
        container.innerHTML = `<span style="font-size:14px">${icon}</span> <span style="color:${statusColor}">${label}</span>`;
        container.title = tooltip;
      };
      
      updateLabel();
      
      // Hover effect
      container.addEventListener('mouseenter', () => {
        container.style.background = '#e5e7eb';
      });
      container.addEventListener('mouseleave', () => {
        container.style.background = '#f9fafb';
      });
      
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

/**
 * Crée un contrôle de couches avec tous les fonds de carte disponibles
 * Inclut OSM, ESRI, et optionnellement Mapbox/Azure si les clés sont configurées
 */
export function createBasemapLayerControl(
  map: L.Map,
  overlays?: Record<string, L.Layer>
): L.Control.Layers {
  const basemaps = createAllBasemaps();
  
  // Ajouter le fond offline local s'il est disponible
  if (offlineAvailable && offlineConfig) {
    const offlineLayer = L.tileLayer(offlineConfig.url, {
      minZoom: offlineConfig.minZoom,
      maxZoom: offlineConfig.maxZoom,
      attribution: '&copy; OpenStreetMap (offline local)',
      bounds: offlineConfig.bounds,
    });
    basemaps['🗺️ Offline Local'] = offlineLayer;
  }
  
  console.log('[TileManager] Basemaps disponibles:', Object.keys(basemaps));
  
  return L.control.layers(basemaps, overlays || {}, {
    position: 'topright',
    collapsed: true,
  });
}

/**
 * Initialise la carte avec le meilleur fond de carte disponible
 * Priorité : ESRI Satellite > OSM
 */
export function initWithBestBasemap(map: L.Map): L.TileLayer {
  // Essayer ESRI Satellite d'abord (meilleure qualité)
  const esri = createEsriImageryBasemap();
  if (esri) {
    esri.addTo(map);
    console.log('[TileManager] Fond par défaut: ESRI Satellite');
    return esri;
  }
  
  // Fallback sur OSM
  const osm = createOsmBasemap();
  osm.addTo(map);
  console.log('[TileManager] Fond par défaut: OSM Standard');
  return osm;
}

export default {
  initTileLayer,
  initOfflineTiles,
  createTileLayers,
  switchToOnline,
  switchToOffline,
  setTileMode,
  getCurrentTileMode,
  isOfflineAvailable,
  createTileControl,
  createBasemapLayerControl,
  initWithBestBasemap,
};
