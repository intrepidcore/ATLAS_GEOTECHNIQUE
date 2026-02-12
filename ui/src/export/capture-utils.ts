/**
 * Utilitaires de capture d'écran et génération PDF
 * Atlas Géotechnique v3.0
 */

import { ExportOptions, QUALITY_SETTINGS } from './export-types';

// ============================================================================
// Types pour html2canvas et jsPDF (déclarations minimales)
// ============================================================================

declare function html2canvas(
  element: HTMLElement,
  options?: Html2CanvasOptions
): Promise<HTMLCanvasElement>;

interface Html2CanvasOptions {
  scale?: number;
  useCORS?: boolean;
  allowTaint?: boolean;
  backgroundColor?: string;
  logging?: boolean;
  width?: number;
  height?: number;
  x?: number;
  y?: number;
  scrollX?: number;
  scrollY?: number;
  windowWidth?: number;
  windowHeight?: number;
  foreignObjectRendering?: boolean;
  ignoreElements?: (element: Element) => boolean;
}

declare class jsPDF {
  constructor(options?: JsPDFOptions);
  addImage(
    imageData: string | HTMLCanvasElement,
    format: string,
    x: number,
    y: number,
    width: number,
    height: number
  ): jsPDF;
  setProperties(properties: { title?: string; author?: string; subject?: string }): jsPDF;
  save(filename: string): void;
  output(type: 'blob'): Blob;
  output(type: 'datauristring'): string;
  internal: {
    pageSize: {
      getWidth(): number;
      getHeight(): number;
    };
  };
}

interface JsPDFOptions {
  orientation?: 'portrait' | 'landscape';
  unit?: 'mm' | 'pt' | 'px';
  format?: 'a4' | 'a3' | [number, number];
}

// ============================================================================
// Vérification des dépendances
// ============================================================================

export function checkDependencies(): { html2canvas: boolean; jsPDF: boolean } {
  return {
    html2canvas: typeof (window as any).html2canvas === 'function',
    jsPDF: typeof (window as any).jspdf?.jsPDF === 'function'
  };
}

export function getHtml2Canvas(): typeof html2canvas | null {
  return (window as any).html2canvas || null;
}

export function getJsPDF(): typeof jsPDF | null {
  return (window as any).jspdf?.jsPDF || null;
}

// ============================================================================
// Capture d'un élément HTML en canvas
// ============================================================================

export interface CaptureOptions {
  scale?: number;
  backgroundColor?: string;
  ignoreElements?: (element: Element) => boolean;
  useCORS?: boolean;
}

export async function captureElement(
  element: HTMLElement,
  options: CaptureOptions = {}
): Promise<HTMLCanvasElement> {
  const html2canvasFn = getHtml2Canvas();
  
  if (!html2canvasFn) {
    throw new Error(
      'html2canvas non disponible. Ajoutez le script dans index.html:\n' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/html2canvas/1.4.1/html2canvas.min.js"></script>'
    );
  }
  
  const canvas = await html2canvasFn(element, {
    scale: options.scale ?? 1,
    useCORS: options.useCORS ?? true,
    allowTaint: false,
    backgroundColor: options.backgroundColor ?? '#ffffff',
    logging: false,
    ignoreElements: options.ignoreElements,
    foreignObjectRendering: false
  });
  
  return canvas;
}

// ============================================================================
// Capture de la carte Leaflet
// ============================================================================

export interface MapCaptureResult {
  canvas: HTMLCanvasElement;
  width: number;
  height: number;
}

export async function captureLeafletMap(
  mapContainer: HTMLElement,
  quality: 'web' | 'standard' | 'print' | 'hd' | 'light' = 'web'
): Promise<MapCaptureResult> {
  const scale = QUALITY_SETTINGS[quality].scale;
  
  // Éléments à ignorer lors de la capture
  const ignoreSelectors = [
    '.leaflet-control-container',
    '.leaflet-control',
    '.atlas-panel',
    '.atlas-modal',
    '.toast-container'
  ];
  
  // Préparer les SVG pour la capture (html2canvas a des problèmes avec les SVG)
  await prepareSvgForCapture(mapContainer);
  
  const canvas = await captureElement(mapContainer, {
    scale,
    backgroundColor: '#ffffff',
    useCORS: true,
    ignoreElements: (el) => {
      if (!(el instanceof HTMLElement)) return false;
      return ignoreSelectors.some(sel => el.matches(sel) || el.closest(sel));
    }
  });
  
  return {
    canvas,
    width: canvas.width / scale,
    height: canvas.height / scale
  };
}

/**
 * Prépare les éléments pour la capture par html2canvas
 * - Force les styles inline sur les SVG
 * - S'assure que les Canvas Leaflet sont visibles
 */
async function prepareSvgForCapture(container: HTMLElement): Promise<void> {
  // 1. Préparer les SVG (si Leaflet utilise le renderer SVG)
  const svgElements = container.querySelectorAll('svg');
  
  for (const svg of svgElements) {
    // S'assurer que le SVG a des dimensions explicites
    if (!svg.getAttribute('width') || !svg.getAttribute('height')) {
      const bbox = svg.getBoundingClientRect();
      svg.setAttribute('width', String(bbox.width));
      svg.setAttribute('height', String(bbox.height));
    }
    
    // S'assurer que les paths ont des styles inline
    const paths = svg.querySelectorAll('path');
    for (const path of paths) {
      const computedStyle = window.getComputedStyle(path);
      
      // Copier les styles calculés en inline
      if (!path.getAttribute('fill') && computedStyle.fill) {
        path.setAttribute('fill', computedStyle.fill);
      }
      if (!path.getAttribute('stroke') && computedStyle.stroke) {
        path.setAttribute('stroke', computedStyle.stroke);
      }
      if (!path.getAttribute('stroke-width') && computedStyle.strokeWidth) {
        path.setAttribute('stroke-width', computedStyle.strokeWidth);
      }
      if (!path.getAttribute('fill-opacity') && computedStyle.fillOpacity) {
        path.setAttribute('fill-opacity', computedStyle.fillOpacity);
      }
      if (!path.getAttribute('stroke-opacity') && computedStyle.strokeOpacity) {
        path.setAttribute('stroke-opacity', computedStyle.strokeOpacity);
      }
    }
  }
  
  // 2. Préparer les Canvas Leaflet (si preferCanvas: true)
  // S'assurer que les canvas ont le bon z-index et sont visibles
  const canvasElements = container.querySelectorAll('canvas.leaflet-zoom-animated');
  for (const canvas of canvasElements) {
    const htmlCanvas = canvas as HTMLCanvasElement;
    // Forcer le canvas à être visible pour html2canvas
    htmlCanvas.style.visibility = 'visible';
    htmlCanvas.style.opacity = '1';
  }
  
  // 3. Forcer un repaint du conteneur
  container.style.transform = 'translateZ(0)';
  
  // Attendre plusieurs frames pour que les changements soient appliqués
  await new Promise(resolve => setTimeout(resolve, 100));
}

// ============================================================================
// Génération PDF
// ============================================================================

export interface PdfOptions {
  orientation?: 'portrait' | 'landscape';
  format?: 'a4' | 'a3';
  title?: string;
  author?: string;
  filename?: string;
}

export async function generatePdf(
  canvas: HTMLCanvasElement,
  options: PdfOptions = {}
): Promise<Blob> {
  const JsPDFClass = getJsPDF();
  
  if (!JsPDFClass) {
    throw new Error(
      'jsPDF non disponible. Ajoutez le script dans index.html:\n' +
      '<script src="https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js"></script>'
    );
  }
  
  const {
    orientation = 'landscape',
    format = 'a4',
    title = 'Atlas Géotechnique - Export',
    author = 'Atlas Géotechnique',
    filename = 'atlas-export.pdf'
  } = options;
  
  // Créer le document PDF
  const pdf = new JsPDFClass({
    orientation,
    unit: 'mm',
    format
  });
  
  // Métadonnées
  pdf.setProperties({
    title,
    author,
    subject: 'Export cartographique Atlas Géotechnique'
  });
  
  // Dimensions de la page en mm
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();
  
  // Marges
  const margin = 10;
  const availableWidth = pageWidth - margin * 2;
  const availableHeight = pageHeight - margin * 2;
  
  // Calculer les dimensions de l'image pour tenir dans la page
  const canvasRatio = canvas.width / canvas.height;
  const pageRatio = availableWidth / availableHeight;
  
  let imgWidth: number;
  let imgHeight: number;
  
  if (canvasRatio > pageRatio) {
    // Image plus large que la page
    imgWidth = availableWidth;
    imgHeight = availableWidth / canvasRatio;
  } else {
    // Image plus haute que la page
    imgHeight = availableHeight;
    imgWidth = availableHeight * canvasRatio;
  }
  
  // Centrer l'image
  const x = margin + (availableWidth - imgWidth) / 2;
  const y = margin + (availableHeight - imgHeight) / 2;
  
  // Ajouter l'image
  const imgData = canvas.toDataURL('image/png');
  pdf.addImage(imgData, 'PNG', x, y, imgWidth, imgHeight);
  
  // Retourner le blob
  return pdf.output('blob');
}

// ============================================================================
// Téléchargement de fichiers
// ============================================================================

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function downloadDataURL(dataURL: string, filename: string): void {
  const link = document.createElement('a');
  link.href = dataURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

// ============================================================================
// Génération du nom de fichier
// ============================================================================

export function generateExportFilename(
  thematicName: string,
  zone: string,
  format: 'png' | 'pdf'
): string {
  const date = new Date().toISOString().split('T')[0];
  const safeName = thematicName
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  const safeZone = zone
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'togo';
  
  return `atlas_${safeName}_${safeZone}_${date}.${format}`;
}

// ============================================================================
// Conversion canvas vers Blob
// ============================================================================

export function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string = 'image/png',
  quality?: number
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Échec de la conversion canvas vers Blob'));
      },
      type,
      quality
    );
  });
}

// ============================================================================
// Attente du chargement complet des tuiles (améliorée pour 300dpi)
// ============================================================================

export interface TileLoadResult {
  loaded: number;
  errors: number;
  pending: number;
  stableMs: number;
  timedOut: boolean;
}

/**
 * Attend que les tuiles soient stables (toutes chargées pendant un certain temps)
 * Plus robuste que la version simple pour les exports haute résolution
 */
export async function waitForTilesLoaded(
  mapContainer: HTMLElement,
  timeout: number = 5000
): Promise<TileLoadResult> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    let lastPendingCount = -1;
    let stableStartTime = 0;
    const STABLE_DURATION = 300; // Tuiles stables pendant 300ms
    
    const checkTiles = () => {
      const tileImages = mapContainer.querySelectorAll('.leaflet-tile-container img');
      let loaded = 0;
      let errors = 0;
      let pending = 0;
      
      tileImages.forEach((img) => {
        if (img instanceof HTMLImageElement) {
          if (img.complete) {
            if (img.naturalWidth === 0) {
              errors++;
            } else {
              loaded++;
            }
          } else {
            pending++;
          }
        }
      });
      
      const elapsed = Date.now() - startTime;
      
      // Vérifier si les tuiles sont stables
      if (pending === 0 && pending === lastPendingCount) {
        if (stableStartTime === 0) {
          stableStartTime = Date.now();
        }
        const stableMs = Date.now() - stableStartTime;
        
        if (stableMs >= STABLE_DURATION) {
          console.log('[Export][TILES] Tuiles stables:', { loaded, errors, stableMs });
          resolve({ loaded, errors, pending, stableMs, timedOut: false });
          return;
        }
      } else {
        stableStartTime = 0;
      }
      
      lastPendingCount = pending;
      
      // Timeout
      if (elapsed > timeout) {
        console.warn('[Export][TILES] Timeout:', { loaded, errors, pending, elapsed });
        resolve({ loaded, errors, pending, stableMs: 0, timedOut: true });
        return;
      }
      
      requestAnimationFrame(checkTiles);
    };
    
    // Attendre un peu pour que les tuiles commencent à charger
    setTimeout(checkTiles, 100);
  });
}

/**
 * Attend plusieurs frames d'animation (pour laisser le navigateur peindre)
 */
export function waitForFrames(count: number = 2): Promise<void> {
  return new Promise(resolve => {
    let remaining = count;
    const tick = () => {
      remaining--;
      if (remaining <= 0) {
        resolve();
      } else {
        requestAnimationFrame(tick);
      }
    };
    requestAnimationFrame(tick);
  });
}

/**
 * Valide qu'une capture n'est pas noire/vide
 * Échantillonne des pixels et vérifie qu'ils ne sont pas tous noirs
 */
export function validateCapture(canvas: HTMLCanvasElement): {
  valid: boolean;
  blackRatio: number;
  whiteRatio?: number;
  transparentRatio?: number;
  uniformRatio?: number;
  sampleCount: number;
} {
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    return { valid: false, blackRatio: 1, sampleCount: 0 };
  }
  
  const width = canvas.width;
  const height = canvas.height;
  
  // Échantillonner 50 points répartis sur le canvas
  const samplePoints: Array<[number, number]> = [];
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 10; j++) {
      const x = Math.floor((i + 0.5) * width / 5);
      const y = Math.floor((j + 0.5) * height / 10);
      samplePoints.push([x, y]);
    }
  }
  
  let blackCount = 0;
  let whiteCount = 0;
  let transparentCount = 0;
  let uniformCount = 0;

  for (const [x, y] of samplePoints) {
    const pixel = ctx.getImageData(x, y, 1, 1).data;
    const r = pixel[0];
    const g = pixel[1];
    const b = pixel[2];
    const a = pixel[3];

    if (a < 10) {
      transparentCount++;
      blackCount++;
      continue;
    }

    const isBlack = (r < 10 && g < 10 && b < 10);
    const isWhite = (r > 245 && g > 245 && b > 245);

    if (isBlack) blackCount++;
    if (isWhite) whiteCount++;

    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    if ((max - min) < 3) {
      uniformCount++;
    }
  }
  
  const blackRatio = blackCount / samplePoints.length;
  const whiteRatio = whiteCount / samplePoints.length;
  const transparentRatio = transparentCount / samplePoints.length;
  const uniformRatio = uniformCount / samplePoints.length;

  const valid = (
    blackRatio < 0.8 &&
    transparentRatio < 0.8 &&
    whiteRatio < 0.95 &&
    uniformRatio < 0.98
  );
  
  console.log('[Export][QA] Validation capture:', {
    blackRatio: blackRatio.toFixed(2),
    blackCount,
    whiteRatio: whiteRatio.toFixed(2),
    whiteCount,
    transparentRatio: transparentRatio.toFixed(2),
    transparentCount,
    uniformRatio: uniformRatio.toFixed(2),
    uniformCount,
    sampleCount: samplePoints.length,
    valid
  });
  
  return {
    valid,
    blackRatio,
    whiteRatio,
    transparentRatio,
    uniformRatio,
    sampleCount: samplePoints.length
  };
}

// ============================================================================
// Export ZIP avec métadonnées
// ============================================================================

/**
 * Interface pour les métadonnées d'export
 */
export interface ExportMetadata {
  version: string;
  exportDate: string;
  runId: string;
  thematic: {
    parameter: string;
    name: string;
    unit?: string;
  };
  zone: {
    type: string;
    adm1?: string;
    adm2?: string;
    adm3?: string;
    bounds: { north: number; south: number; east: number; west: number };
  };
  output: {
    format: string;
    quality: string;
    dpi: number;
    dimensions: { width: number; height: number };
  };
  stats?: {
    title: string;
    rows: Array<{ label: string; value: string; unit?: string }>;
  };
  cells?: {
    total: number;
    withData: number;
    withoutData: number;
  };
  /** Légendes enrichies v3.4.1 - Source de vérité pour reproduction */
  legends?: Record<string, LegendMetadata>;
  /** Légende simple (rétro-compatibilité) */
  legend?: {
    classes: Array<{ label: string; color: string; count?: number }>;
  };
  /** Thématiques ignorées car sans données */
  skipped?: Array<{ thematic: string; reason: 'no_data' | 'error'; message?: string }>;
  telemetry?: Record<string, any>;
  debugLogs?: Array<{ timestamp: string; stage: string; data: Record<string, any> }>;
  consoleLogs?: Array<{ timestamp: string; level: string; tag: string; message: string }>;
}

/**
 * Métadonnées de légende enrichies v3.4.1
 * Permet de reproduire exactement la carte à partir des métadonnées
 */
export interface LegendMetadata {
  parameterId: string;
  parameterLabel: string;
  unit: string;
  mapType: 'choropleth' | 'proportional' | 'binary' | 'heatmap';
  palette: string;
  paletteReversed?: boolean;
  classificationMethod: string;
  classes: Array<{
    index: number;
    label: string;
    min: number | null;
    max: number | null;
    color: string;
    count: number;
  }>;
  statistics?: {
    count: number;
    min: number;
    max: number;
    mean: number;
    median: number;
    stddev?: number;
  };
}

/**
 * Génère un fichier ZIP contenant l'image et les métadonnées
 * Utilise l'API de compression native si disponible, sinon crée un ZIP minimal
 */
export async function generateZipWithMetadata(
  imageBlob: Blob,
  imageFilename: string,
  metadata: ExportMetadata
): Promise<Blob> {
  // Vérifier si JSZip est disponible (optionnel)
  const JSZip = (window as any).JSZip;
  
  if (JSZip) {
    // Utiliser JSZip si disponible
    const zip = new JSZip();
    // PNG est déjà compressé → STORE (compression: 'STORE') pour éviter CPU inutile
    zip.file(imageFilename, imageBlob, { compression: 'STORE' });
    // JSON/TXT sont petits → compression normale
    zip.file('metadata.json', JSON.stringify(metadata, null, 2), { compression: 'DEFLATE' });
    zip.file('README.txt', generateReadmeContent(metadata), { compression: 'DEFLATE' });
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
  }
  
  // Fallback: créer un ZIP minimal sans compression
  // Format ZIP simplifié (store only, pas de compression)
  return createMinimalZip([
    { name: imageFilename, data: imageBlob },
    { name: 'metadata.json', data: new Blob([JSON.stringify(metadata, null, 2)], { type: 'application/json' }) },
    { name: 'README.txt', data: new Blob([generateReadmeContent(metadata)], { type: 'text/plain' }) }
  ]);
}

/**
 * Génère le contenu du README enrichi v3.4.1
 */
function generateReadmeContent(metadata: ExportMetadata): string {
  let content = `Atlas Géotechnique du Togo - Export
=====================================

Date d'export: ${metadata.exportDate}
Run ID: ${metadata.runId}

Thématique: ${metadata.thematic.name} (${metadata.thematic.parameter})${metadata.thematic.unit ? ` [${metadata.thematic.unit}]` : ''}
Zone: ${metadata.zone.adm3 || metadata.zone.adm2 || metadata.zone.adm1 || 'Togo'}

Format: ${metadata.output.format.toUpperCase()}
Qualité: ${metadata.output.quality} (${metadata.output.dpi} DPI)
Dimensions: ${metadata.output.dimensions.width} x ${metadata.output.dimensions.height} px
`;

  // Ajouter les statistiques de mailles si disponibles
  if (metadata.cells) {
    content += `
Mailles:
- Total: ${metadata.cells.total}
- Avec données: ${metadata.cells.withData}
- Sans données: ${metadata.cells.withoutData}
`;
  }

  // Ajouter la légende si disponible
  if (metadata.legends) {
    const legendKeys = Object.keys(metadata.legends);
    if (legendKeys.length > 0) {
      content += `
Légende:
`;
      for (const key of legendKeys) {
        const legend = metadata.legends[key];
        content += `
  ${legend.parameterLabel} (${legend.unit || '-'})
  Méthode: ${legend.classificationMethod}
  Palette: ${legend.palette}${legend.paletteReversed ? ' (inversée)' : ''}
  Classes:
`;
        for (const cls of legend.classes) {
          content += `    - ${cls.label}: ${cls.color} (n=${cls.count})\n`;
        }
        
        if (legend.statistics) {
          content += `  Statistiques:
    - Min: ${legend.statistics.min}
    - Max: ${legend.statistics.max}
    - Moyenne: ${legend.statistics.mean?.toFixed(2) || '-'}
    - Médiane: ${legend.statistics.median?.toFixed(2) || '-'}
`;
        }
      }
    }
  } else if (metadata.legend?.classes) {
    // Rétro-compatibilité avec l'ancien format
    content += `
Légende:
`;
    for (const cls of metadata.legend.classes) {
      content += `  - ${cls.label}: ${cls.color}${cls.count !== undefined ? ` (n=${cls.count})` : ''}\n`;
    }
  }

  // Ajouter les thématiques ignorées si présentes
  if (metadata.skipped && metadata.skipped.length > 0) {
    content += `
Thématiques ignorées:
`;
    for (const skip of metadata.skipped) {
      content += `  - ${skip.thematic}: ${skip.reason}${skip.message ? ` (${skip.message})` : ''}\n`;
    }
  }

  content += `
Fichiers inclus:
- Image de la carte (${metadata.output.format})
- metadata.json (métadonnées complètes)
- README.txt (ce fichier)

Pour plus d'informations, consultez metadata.json
`;

  return content;
}

/**
 * Crée un fichier ZIP minimal sans compression (store only)
 * Compatible avec tous les décompresseurs standards
 */
async function createMinimalZip(
  files: Array<{ name: string; data: Blob }>
): Promise<Blob> {
  const parts: Uint8Array[] = [];
  const centralDirectory: Uint8Array[] = [];
  let offset = 0;
  
  // Convertir les blobs en ArrayBuffer
  const fileDataArray: Array<{ name: string; data: Uint8Array }> = [];
  for (const file of files) {
    const buffer = await file.data.arrayBuffer();
    fileDataArray.push({ name: file.name, data: new Uint8Array(buffer) });
  }
  
  // Créer les entrées de fichier
  for (const file of fileDataArray) {
    const nameBytes = new TextEncoder().encode(file.name);
    const fileData = file.data;
    
    // Local file header
    const localHeader = new Uint8Array(30 + nameBytes.length);
    const view = new DataView(localHeader.buffer);
    
    view.setUint32(0, 0x04034b50, true); // Signature
    view.setUint16(4, 10, true); // Version needed
    view.setUint16(6, 0, true); // Flags
    view.setUint16(8, 0, true); // Compression (store)
    view.setUint16(10, 0, true); // Mod time
    view.setUint16(12, 0, true); // Mod date
    view.setUint32(14, crc32(fileData), true); // CRC32
    view.setUint32(18, fileData.length, true); // Compressed size
    view.setUint32(22, fileData.length, true); // Uncompressed size
    view.setUint16(26, nameBytes.length, true); // Filename length
    view.setUint16(28, 0, true); // Extra field length
    localHeader.set(nameBytes, 30);
    
    // Central directory entry
    const centralEntry = new Uint8Array(46 + nameBytes.length);
    const centralView = new DataView(centralEntry.buffer);
    
    centralView.setUint32(0, 0x02014b50, true); // Signature
    centralView.setUint16(4, 20, true); // Version made by
    centralView.setUint16(6, 10, true); // Version needed
    centralView.setUint16(8, 0, true); // Flags
    centralView.setUint16(10, 0, true); // Compression
    centralView.setUint16(12, 0, true); // Mod time
    centralView.setUint16(14, 0, true); // Mod date
    centralView.setUint32(16, crc32(fileData), true); // CRC32
    centralView.setUint32(20, fileData.length, true); // Compressed size
    centralView.setUint32(24, fileData.length, true); // Uncompressed size
    centralView.setUint16(28, nameBytes.length, true); // Filename length
    centralView.setUint16(30, 0, true); // Extra field length
    centralView.setUint16(32, 0, true); // Comment length
    centralView.setUint16(34, 0, true); // Disk number
    centralView.setUint16(36, 0, true); // Internal attributes
    centralView.setUint32(38, 0, true); // External attributes
    centralView.setUint32(42, offset, true); // Offset of local header
    centralEntry.set(nameBytes, 46);
    
    parts.push(localHeader);
    parts.push(fileData);
    centralDirectory.push(centralEntry);
    
    offset += localHeader.length + fileData.length;
  }
  
  // End of central directory
  const centralDirSize = centralDirectory.reduce((sum, entry) => sum + entry.length, 0);
  const endRecord = new Uint8Array(22);
  const endView = new DataView(endRecord.buffer);
  
  endView.setUint32(0, 0x06054b50, true); // Signature
  endView.setUint16(4, 0, true); // Disk number
  endView.setUint16(6, 0, true); // Central dir disk
  endView.setUint16(8, files.length, true); // Entries on disk
  endView.setUint16(10, files.length, true); // Total entries
  endView.setUint32(12, centralDirSize, true); // Central dir size
  endView.setUint32(16, offset, true); // Central dir offset
  endView.setUint16(20, 0, true); // Comment length
  
  // Assembler le ZIP
  const allParts = [...parts, ...centralDirectory, endRecord];
  const totalSize = allParts.reduce((sum, part) => sum + part.length, 0);
  const zipData = new Uint8Array(totalSize);
  
  let pos = 0;
  for (const part of allParts) {
    zipData.set(part, pos);
    pos += part.length;
  }
  
  return new Blob([zipData], { type: 'application/zip' });
}

/**
 * Calcule le CRC32 d'un tableau de bytes
 */
function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  
  // Table CRC32 pré-calculée
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let j = 0; j < 8; j++) {
      c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c;
  }
  
  for (let i = 0; i < data.length; i++) {
    crc = table[(crc ^ data[i]) & 0xFF] ^ (crc >>> 8);
  }
  
  return (crc ^ 0xFFFFFFFF) >>> 0;
}
