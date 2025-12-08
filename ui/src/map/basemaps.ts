/**
 * basemaps.ts - Configuration des fonds de carte pour Atlas
 * 
 * Fournit une API propre pour créer différents fonds de carte :
 * - OSM Standard (gratuit, sans clé)
 * - ESRI World Imagery (gratuit pour dev/usage modéré)
 * - Mapbox Satellite (nécessite token)
 * - Azure Maps Satellite (nécessite clé)
 * 
 * Les fonds nécessitant une clé renvoient null si la clé n'est pas configurée.
 */

import L from 'leaflet';

// Types
export type BasemapId = 'osm' | 'esri_imagery' | 'esri_topo' | 'mapbox_sat' | 'azure_sat';

export interface BasemapConfig {
  id: BasemapId;
  name: string;
  layer: L.TileLayer | null;
  available: boolean;
}

// ============================================
// OSM Standard (gratuit, sans clé)
// ============================================
export function createOsmBasemap(): L.TileLayer {
  return L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://openstreetmap.org">OpenStreetMap</a> contributors',
  });
}

// ============================================
// ESRI World Imagery (gratuit pour dev/usage modéré)
// ============================================
export function createEsriImageryBasemap(): L.TileLayer {
  return L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Source: Esri, i-cubed, USDA, USGS, AEX, GeoEye, Getmapping, Aerogrid, IGN, IGP, UPR-EGP, and the GIS User Community',
    }
  );
}

// ============================================
// ESRI World Topo Map (gratuit pour dev/usage modéré)
// ============================================
export function createEsriTopoBasemap(): L.TileLayer {
  return L.tileLayer(
    'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
    {
      maxZoom: 19,
      attribution: 'Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ, TomTom, Intermap, iPC, USGS, FAO, NPS, NRCAN, GeoBase, Kadaster NL, Ordnance Survey, Esri Japan, METI, Esri China (Hong Kong), and the GIS User Community',
    }
  );
}

// ============================================
// Mapbox Satellite (nécessite token)
// ============================================
export function createMapboxSatelliteBasemap(): L.TileLayer | null {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn('[Basemaps] VITE_MAPBOX_TOKEN manquant → fond Mapbox désactivé');
    return null;
  }

  return L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/satellite-v9/tiles/{z}/{x}/{y}?access_token=${token}`,
    {
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
      attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }
  );
}

// ============================================
// Mapbox Streets (nécessite token)
// ============================================
export function createMapboxStreetsBasemap(): L.TileLayer | null {
  const token = import.meta.env.VITE_MAPBOX_TOKEN;
  
  if (!token) {
    console.warn('[Basemaps] VITE_MAPBOX_TOKEN manquant → fond Mapbox Streets désactivé');
    return null;
  }

  return L.tileLayer(
    `https://api.mapbox.com/styles/v1/mapbox/streets-v12/tiles/{z}/{x}/{y}?access_token=${token}`,
    {
      maxZoom: 19,
      tileSize: 512,
      zoomOffset: -1,
      attribution: '&copy; <a href="https://www.mapbox.com/">Mapbox</a> &copy; <a href="https://openstreetmap.org">OpenStreetMap</a>',
    }
  );
}

// ============================================
// Azure Maps Satellite (nécessite clé)
// ============================================
export function createAzureSatelliteBasemap(): L.TileLayer | null {
  const key = import.meta.env.VITE_AZURE_MAPS_KEY;
  
  if (!key) {
    console.warn('[Basemaps] VITE_AZURE_MAPS_KEY manquant → fond Azure désactivé');
    return null;
  }

  // URL d'imagerie Azure Maps
  const urlTemplate = `https://atlas.microsoft.com/map/tile?api-version=2.1&tilesetId=microsoft.imagery&zoom={z}&x={x}&y={y}&subscription-key=${key}`;

  return L.tileLayer(urlTemplate, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://azure.microsoft.com/services/azure-maps/">Microsoft Azure Maps</a>',
  });
}

// ============================================
// Azure Maps Road (nécessite clé)
// ============================================
export function createAzureRoadBasemap(): L.TileLayer | null {
  const key = import.meta.env.VITE_AZURE_MAPS_KEY;
  
  if (!key) {
    console.warn('[Basemaps] VITE_AZURE_MAPS_KEY manquant → fond Azure Road désactivé');
    return null;
  }

  const urlTemplate = `https://atlas.microsoft.com/map/tile?api-version=2.1&tilesetId=microsoft.base.road&zoom={z}&x={x}&y={y}&subscription-key=${key}`;

  return L.tileLayer(urlTemplate, {
    maxZoom: 19,
    attribution: '&copy; <a href="https://azure.microsoft.com/services/azure-maps/">Microsoft Azure Maps</a>',
  });
}

// ============================================
// Helper: Créer tous les basemaps disponibles
// ============================================
export function createAllBasemaps(): Record<string, L.TileLayer> {
  const basemaps: Record<string, L.TileLayer> = {};

  // Fonds toujours disponibles
  basemaps['OSM Standard'] = createOsmBasemap();
  basemaps['ESRI Satellite'] = createEsriImageryBasemap();
  basemaps['ESRI Topo'] = createEsriTopoBasemap();

  // Fonds conditionnels (nécessitent une clé)
  const mapboxSat = createMapboxSatelliteBasemap();
  if (mapboxSat) {
    basemaps['Mapbox Satellite'] = mapboxSat;
  }

  const mapboxStreets = createMapboxStreetsBasemap();
  if (mapboxStreets) {
    basemaps['Mapbox Streets'] = mapboxStreets;
  }

  const azureSat = createAzureSatelliteBasemap();
  if (azureSat) {
    basemaps['Azure Satellite'] = azureSat;
  }

  const azureRoad = createAzureRoadBasemap();
  if (azureRoad) {
    basemaps['Azure Road'] = azureRoad;
  }

  console.log('[Basemaps] Fonds de carte disponibles:', Object.keys(basemaps));
  
  return basemaps;
}

// ============================================
// Helper: Obtenir le basemap par défaut
// ============================================
export function getDefaultBasemap(): L.TileLayer {
  // Priorité : ESRI Satellite > OSM
  return createEsriImageryBasemap();
}

// ============================================
// Helper: Créer le contrôle de couches avec basemaps
// ============================================
export function createBasemapControl(
  map: L.Map,
  overlays?: Record<string, L.Layer>
): L.Control.Layers {
  const basemaps = createAllBasemaps();
  
  // Ajouter le basemap par défaut à la carte s'il n'y en a pas
  const defaultBasemap = basemaps['ESRI Satellite'] || basemaps['OSM Standard'];
  if (defaultBasemap && !map.hasLayer(defaultBasemap)) {
    defaultBasemap.addTo(map);
  }

  return L.control.layers(basemaps, overlays || {}, {
    position: 'topright',
    collapsed: true,
  });
}

export default {
  createOsmBasemap,
  createEsriImageryBasemap,
  createEsriTopoBasemap,
  createMapboxSatelliteBasemap,
  createMapboxStreetsBasemap,
  createAzureSatelliteBasemap,
  createAzureRoadBasemap,
  createAllBasemaps,
  getDefaultBasemap,
  createBasemapControl,
};
