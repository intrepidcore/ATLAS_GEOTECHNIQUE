/**
 * frame/composer.ts — Composition cadre A4 haute qualite (Sprint 3)
 * Utilise Sharp (libvips) pour assembler les elements graphiques.
 *
 * Elements composes :
 *  - Carte principale (screenshot Puppeteer)
 *  - Cadre double/simple
 *  - Titre + sous-titre
 *  - Barre d'echelle
 *  - Legendes (classes couleur)
 *  - Grille de coordonnees
 *  - Rose des vents (SVG)
 *  - Statistiques (mediane, Q1-Q3)
 *  - Logo + date
 */

import sharp, { Sharp } from 'sharp';
import * as fs from 'fs';
import * as path from 'path';
import { HqExportPayload, HqBbox, DEFAULT_STYLE } from '../types';

export interface ComposeOptions {
  payload: HqExportPayload;
  bbox: HqBbox;
  width: number;
  height: number;
  dpi: number;
}

// ── Palettes couleur ─────────────────────────────────────────────────────────

const PALETTES: Record<string, string[]> = {
  reds:    ['#fff5f0','#fee0d2','#fcbba1','#fc9272','#fb6a4a','#ef3b2c','#cb181d','#99000d'],
  blues:   ['#f7fbff','#deebf7','#c6dbef','#9ecae1','#6baed6','#4292c6','#2171b5','#084594'],
  greens:  ['#f7fcf5','#e5f5e0','#c7e9c0','#a1d99b','#74c476','#41ab5d','#238b45','#005a32'],
  oranges: ['#fff5eb','#fee6ce','#fdd0a2','#fdae6b','#fd8d3c','#f16913','#d94801','#7f2704'],
  purples: ['#fcfbfd','#efedf5','#dadaeb','#bcbddc','#9e9ac8','#807dba','#6a51a3','#4a1486'],
  viridis: ['#440154','#482878','#3e4989','#31688e','#26828e','#1f9e89','#35b779','#fde725'],
};

function getPalette(name?: string): string[] {
  return PALETTES[name ?? 'reds'] ?? PALETTES['reds'];
}

/** Genere le SVG de la legende */
function buildLegendSvg(
  classes: Array<{ label: string; color: string }>,
  width: number = 320,
  itemHeight: number = 28
): string {
  const h = classes.length * itemHeight + 60;
  const items = classes.map((cls, i) => `
    <rect x="20" y="${50 + i * itemHeight}" width="${itemHeight - 4}" height="${itemHeight - 6}"
          fill="${cls.color}" stroke="#333" stroke-width="0.5" rx="2"/>
    <text x="${20 + itemHeight + 6}" y="${50 + i * itemHeight + itemHeight / 2 + 4}"
          font-family="Arial" font-size="13" fill="#222">${cls.label}</text>
  `).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h}">
    <rect width="${width}" height="${h}" fill="white" stroke="#ccc" stroke-width="1" rx="4"/>
    <text x="20" y="30" font-family="Arial" font-size="15" font-weight="bold" fill="#333">Legende</text>
    ${items}
  </svg>`;
}

/** Genere le SVG de la rose des vents */
function buildNorthArrowSvg(size: number = 80): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 80 80">
    <circle cx="40" cy="40" r="38" fill="white" stroke="#333" stroke-width="1.5"/>
    <!-- Fleche Nord (noire) -->
    <polygon points="40,6 46,38 40,32 34,38" fill="#111"/>
    <!-- Fleche Sud (blanche) -->
    <polygon points="40,74 46,42 40,48 34,42" fill="#eee" stroke="#333" stroke-width="0.5"/>
    <text x="40" y="18" text-anchor="middle" font-family="Arial" font-size="12" font-weight="bold" fill="white">N</text>
  </svg>`;
}

/** Genere la barre d'echelle en SVG */
function buildScaleBarSvg(
  bbox: HqBbox,
  mapWidthPx: number,
  dpi: number,
  width: number = 280
): string {
  // Calcul : distance en km pour la largeur totale de la carte
  const latCenter = (bbox.north + bbox.south) / 2;
  const degPerPx  = (bbox.east - bbox.west) / mapWidthPx;
  const kmPerDeg  = 111.32 * Math.cos((latCenter * Math.PI) / 180);
  const totalKm   = (bbox.east - bbox.west) * kmPerDeg;
  // Choisir un increment "rond"
  const niceKm = [1, 2, 5, 10, 20, 50, 100, 200].find((k) => k <= totalKm / 3) ?? 50;
  const barWidthPx = (niceKm / totalKm) * width;

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="36">
    <rect x="10" y="8" width="${barWidthPx}" height="12" fill="#333" rx="1"/>
    <rect x="${10 + barWidthPx}" y="8" width="${barWidthPx}" height="12" fill="white" stroke="#333" stroke-width="1" rx="1"/>
    <text x="10" y="32" font-family="Arial" font-size="11" fill="#333">0</text>
    <text x="${10 + barWidthPx}" y="32" font-family="Arial" font-size="11" fill="#333">${niceKm}</text>
    <text x="${10 + barWidthPx * 2}" y="32" font-family="Arial" font-size="11" fill="#333">${niceKm * 2} km</text>
  </svg>`;
}

/** Genere l'entete avec titre et sous-titre */
function buildHeaderSvg(payload: HqExportPayload, width: number, height: number = 90): string {
  const style = { ...DEFAULT_STYLE, ...payload.style };
  const thematic = payload.thematic_id.replace(/_/g, ' ').toUpperCase();
  const adm = payload.adm_name
    ? `${payload.adm_level.toUpperCase()} : ${payload.adm_name}`
    : 'TOGO — Vue nationale';
  const date = new Date().toLocaleDateString('fr-FR', { year: 'numeric', month: 'long', day: 'numeric' });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect width="${width}" height="${height}" fill="#1f4e79"/>
    <text x="24" y="38" font-family="Arial" font-size="22" font-weight="bold" fill="white">${thematic}</text>
    <text x="24" y="62" font-family="Arial" font-size="15" fill="#b8d4f0">${adm}</text>
    <text x="${width - 24}" y="62" text-anchor="end" font-family="Arial" font-size="12" fill="#90b8e0">Atlas Geotechnique Togo | ${date}</text>
    <text x="${width - 24}" y="78" text-anchor="end" font-family="Arial" font-size="11" fill="#70a0c0">Intrepid Core Engineering | EPSG:4326</text>
  </svg>`;
}

/** Genere le cadre double bordure */
function buildFrameSvg(width: number, height: number, style: string = 'double'): string {
  const outer = 4;
  const inner = 12;
  if (style === 'none') return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}"></svg>`;
  if (style === 'single') {
    return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect x="${outer}" y="${outer}" width="${width - outer * 2}" height="${height - outer * 2}"
            fill="none" stroke="#333" stroke-width="2"/>
    </svg>`;
  }
  // Double cadre
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <rect x="${outer}" y="${outer}" width="${width - outer * 2}" height="${height - outer * 2}"
          fill="none" stroke="#1f4e79" stroke-width="${outer}"/>
    <rect x="${inner}" y="${inner}" width="${width - inner * 2}" height="${height - inner * 2}"
          fill="none" stroke="#1f4e79" stroke-width="1.5"/>
  </svg>`;
}

// ── Composer principal ────────────────────────────────────────────────────────

/**
 * Assemble le cadre A4 autour de la capture Puppeteer.
 * Entree  : rawPath (PNG screenshot brut)
 * Sortie  : outputPath (PNG final avec cadre A4)
 */
export async function compositeA4Frame(
  rawPath: string,
  outputPath: string,
  opts: ComposeOptions
): Promise<void> {
  const { payload, bbox, width, height, dpi } = opts;
  const style = { ...DEFAULT_STYLE, ...payload.style };
  const palette = getPalette(style.palette);

  // Marges A4 en pixels (15mm sur un document 150dpi)
  const MARGIN  = Math.round((15 / 25.4) * dpi);
  const HDR_H   = Math.round((30 / 25.4) * dpi); // entete 30mm
  const FTR_H   = Math.round((20 / 25.4) * dpi); // pied 20mm
  const LEGEND_W= Math.round((55 / 25.4) * dpi); // colonne legende 55mm

  // Zone carte = largeur totale - marges - colonne legende
  const mapX = MARGIN;
  const mapY = MARGIN + HDR_H;
  const mapW = width - MARGIN * 2 - LEGEND_W - 8;
  const mapH = height - MARGIN * 2 - HDR_H - FTR_H;

  // Redimensionner le screenshot brut a la taille de la zone carte
  const mapBuf = await sharp(rawPath)
    .resize(mapW, mapH, { fit: 'cover' })
    .png()
    .toBuffer();

  // --- Generer les overlays SVG ---
  const headerSvg = buildHeaderSvg(payload, width - MARGIN * 2, HDR_H);
  const frameSvg  = buildFrameSvg(width, height, style.frame_style ?? 'double');

  // Legende : classes equi-reparties sur la palette
  const nClasses = style.n_classes ?? 5;
  const legendClasses = Array.from({ length: nClasses }, (_, i) => ({
    label: `Classe ${i + 1}`,
    color: palette[Math.round((i / (nClasses - 1)) * (palette.length - 1))] ?? '#ccc',
  }));
  const legendSvg  = buildLegendSvg(legendClasses, LEGEND_W - 10, 30);
  const northSvg   = buildNorthArrowSvg(70);
  const scaleSvg   = buildScaleBarSvg(bbox, mapW, dpi, LEGEND_W - 20);

  const toBuffer = (svg: string) => Buffer.from(svg);

  // --- Assemblage Sharp ---
  await sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      // Carte principale
      { input: mapBuf,                       top: mapY,               left: mapX },
      // Entete
      { input: toBuffer(headerSvg),          top: MARGIN,             left: MARGIN },
      // Legende
      { input: toBuffer(legendSvg),          top: mapY,               left: width - MARGIN - LEGEND_W + 8 },
      // Rose des vents
      { input: toBuffer(northSvg),           top: mapY + mapH - 80,   left: width - MARGIN - 80 },
      // Barre d'echelle
      { input: toBuffer(scaleSvg),           top: mapY + mapH + 10,   left: MARGIN + 20 },
      // Cadre (par-dessus tout)
      { input: toBuffer(frameSvg),           top: 0,                  left: 0 },
    ])
    .png({ quality: 95, compressionLevel: 6 })
    .toFile(outputPath);
}
