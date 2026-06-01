/**
 * renderer/maplibre.ts — Phase 2 : rendu natif MapLibre GL Node
 * Sprint 5 — Moteur d'export serveur headless
 *
 * Principe :
 *   - Utilise @maplibre/maplibre-gl-node pour rendre la carte sans navigateur
 *   - Appelle directement l'API Atlas /thematic/data pour les donnees
 *   - 50-200ms/carte vs 1-3s/carte en Phase 1 Puppeteer
 *
 * Prerequis :
 *   npm install @maplibre/maplibre-gl-node
 *   Sur Linux : apt-get install libgl1-mesa-dev libegl1-mesa-dev libgbm-dev
 *   Sur Docker : voir Dockerfile.phase2
 */

import { HqExportPayload, HqBbox, TOGO_BBOX } from '../types';
import config from '../config';

// ── Style GL ─────────────────────────────────────────────────────────────────

/** Style de base (fond de carte OSM / tuiles locales) */
function buildBaseStyle(): object {
  return {
    version: 8 as const,
    sources: {
      'osm-tiles': {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        attribution: '© OpenStreetMap contributors',
      },
    },
    layers: [
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#f8f4f0' },
      },
      {
        id: 'osm',
        type: 'raster',
        source: 'osm-tiles',
        paint: { 'raster-opacity': 0.6 },
      },
    ],
    glyphs: 'https://fonts.openmaptiles.org/{fontstack}/{range}.pbf',
  };
}

/** Construit les color stops MapLibre depuis une palette et des breaks */
function buildColorStops(breaks: number[], palette: string[]): (number | string)[] {
  const stops: (number | string)[] = [];
  for (let i = 0; i < breaks.length; i++) {
    stops.push(breaks[i]);
    stops.push(palette[Math.round((i / (breaks.length - 1)) * (palette.length - 1))] ?? '#ccc');
  }
  return stops;
}

/** Calcule les breaks quantiles simples sur un tableau de valeurs */
function computeQuantileBreaks(values: number[], nClasses: number = 5): number[] {
  const sorted = [...values].filter(isFinite).sort((a, b) => a - b);
  if (sorted.length === 0) return [];
  const breaks: number[] = [];
  for (let i = 0; i <= nClasses; i++) {
    const idx = Math.round((i / nClasses) * (sorted.length - 1));
    breaks.push(sorted[idx]);
  }
  return [...new Set(breaks)];
}

/** Fetche les donnees thematiques depuis l'API Atlas */
async function fetchThematicData(
  thematicId: string,
  admLevel: string,
  admName?: string,
  grid: string = '2km'
): Promise<{ type: string; features: any[] }> {
  const params = new URLSearchParams({
    parameter: thematicId,
    grid,
    adm_level: admLevel,
    ...(admName ? { adm_name: admName } : {}),
  });
  const url = `${config.apiBaseUrl}/thematic/data?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Thematic data fetch failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

/** Construit le style GL complet pour un job */
async function buildGLStyle(payload: HqExportPayload): Promise<object> {
  const style = payload.style ?? {};
  const palette = ['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d'];
  const nClasses = style.n_classes ?? 5;

  // Fetcher les donnees thematiques
  const geoJson = await fetchThematicData(
    payload.thematic_id,
    payload.adm_level,
    payload.adm_name,
    payload.grid
  );

  // Calculer les breaks quantiles
  const values = geoJson.features
    .map((f: any) => f.properties?.value as number)
    .filter((v: any): v is number => typeof v === 'number' && isFinite(v));
  const breaks = computeQuantileBreaks(values, nClasses);
  const colorStops = buildColorStops(breaks, palette);

  const baseStyle = buildBaseStyle() as any;

  return {
    ...baseStyle,
    sources: {
      ...baseStyle.sources,
      'atlas-data': {
        type: 'geojson',
        data: geoJson,
      },
    },
    layers: [
      ...baseStyle.layers,
      {
        id: 'thematic-fill',
        type: 'fill',
        source: 'atlas-data',
        paint: {
          'fill-color': breaks.length >= 2
            ? ['step', ['get', 'value'], '#f0f0f0', ...colorStops]
            : '#f0f0f0',
          'fill-opacity': 0.85,
        },
      },
      {
        id: 'thematic-outline',
        type: 'line',
        source: 'atlas-data',
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.3,
          'line-opacity': 0.6,
        },
      },
    ],
  };
}

/** Calcule le zoom pour afficher la bbox */
function computeZoom(bbox: HqBbox, widthPx: number, heightPx: number): number {
  const latDiff = bbox.north - bbox.south;
  const lonDiff = bbox.east - bbox.west;
  const zoomLat = Math.log2(180 * (heightPx / 256) / latDiff) - 1;
  const zoomLon = Math.log2(360 * (widthPx / 256) / lonDiff) - 1;
  return Math.max(1, Math.min(18, Math.floor(Math.min(zoomLat, zoomLon))));
}

/**
 * Rend une carte via MapLibre GL Node.
 * Retourne un Buffer PNG.
 *
 * NOTE : necessite `npm install @maplibre/maplibre-gl-node` et les libs Mesa.
 * Si le package n'est pas installe, leve une erreur descriptive.
 */
export async function renderMapLibre(payload: HqExportPayload): Promise<Buffer> {
  let MapLibreMap: any;
  try {
    // Import dynamique pour ne pas bloquer si le package est absent
    const mlgl = await import('@maplibre/maplibre-gl-node' as any);
    MapLibreMap = mlgl.Map ?? mlgl.default?.Map;
  } catch {
    throw new Error(
      'MapLibre GL Node not installed. Run: npm install @maplibre/maplibre-gl-node\n' +
      'Also requires: apt-get install libgl1-mesa-dev libegl1-mesa-dev libgbm-dev'
    );
  }

  const output = payload.output;
  const bbox   = payload.bbox ?? TOGO_BBOX;
  const center: [number, number] = [
    (bbox.west + bbox.east) / 2,
    (bbox.south + bbox.north) / 2,
  ];
  const zoom = computeZoom(bbox, output.width_px, output.height_px);

  const glStyle = await buildGLStyle(payload);

  const map = new MapLibreMap({
    style: glStyle,
    width: output.width_px,
    height: output.height_px,
    zoom,
    center,
    bearing: 0,
    pitch: 0,
  });

  // Attendre que toutes les sources soient chargees
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => reject(new Error('MapLibre render timeout')), 30_000);
    map.on('idle', () => {
      clearTimeout(timeout);
      resolve();
    });
    map.on('error', (err: Error) => {
      clearTimeout(timeout);
      reject(err);
    });
  });

  const image: Buffer = map.image();
  map.release();
  return image;
}
