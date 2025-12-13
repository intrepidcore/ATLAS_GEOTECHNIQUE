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
  quality: 'web' | 'print' = 'web'
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
// Attente du chargement complet des tuiles
// ============================================================================

export function waitForTilesLoaded(
  mapContainer: HTMLElement,
  timeout: number = 5000
): Promise<void> {
  return new Promise((resolve) => {
    const startTime = Date.now();
    
    const checkTiles = () => {
      // Vérifier si toutes les images de tuiles sont chargées
      const tileImages = mapContainer.querySelectorAll('.leaflet-tile-container img');
      let allLoaded = true;
      
      tileImages.forEach((img) => {
        if (img instanceof HTMLImageElement && !img.complete) {
          allLoaded = false;
        }
      });
      
      if (allLoaded || Date.now() - startTime > timeout) {
        resolve();
      } else {
        requestAnimationFrame(checkTiles);
      }
    };
    
    // Attendre un peu pour que les tuiles commencent à charger
    setTimeout(checkTiles, 100);
  });
}
