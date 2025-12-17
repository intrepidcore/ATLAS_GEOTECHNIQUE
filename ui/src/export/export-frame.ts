/**
 * Canevas d'export avec titre, légende, cartouche et grille
 * Atlas Géotechnique v3.0
 */

import {
  ExportOptions,
  ExportFrameLayout,
  BBox,
  ActiveThematic,
  ActiveAdmFilters,
  formatAdmPath,
  QUALITY_SETTINGS,
  ThematicLegendData
} from './export-types';
import { ExportStats } from './export-stats';
import {
  generateGridLines,
  renderGrid,
  renderFrame,
  GridGeneratorOutput
} from './grid-generator';

// ============================================================================
// Constantes de layout
// ============================================================================

// Layout de base pour 72 DPI - sera multiplié par le ratio DPI
const LAYOUT_BASE = {
  margin: 20,           // Marge extérieure
  titleHeight: 50,      // Hauteur titre principal
  subtitleHeight: 20,   // Hauteur sous-titre (zone)
  legendWidth: 180,     // Largeur zone légende (classes) - augmentée pour texte
  statsWidth: 180,      // Largeur zone stats - augmentée
  cartoucheWidth: 220,  // Largeur zone cartouche - augmentée
  footerHeight: 170,    // Hauteur footer (augmentée pour plus de lignes)
  coordLabelMargin: 8,
  padding: 12
};

// Pour compatibilité avec le code existant (72 dpi)
const LAYOUT = LAYOUT_BASE;

/**
 * Calcule les dimensions de layout ajustées pour un DPI donné
 * Les valeurs de base sont pour 72 DPI
 */
function getScaledLayout(dpi: number) {
  const ratio = dpi / 72;
  return {
    margin: Math.round(LAYOUT_BASE.margin * ratio),
    titleHeight: Math.round(LAYOUT_BASE.titleHeight * ratio),
    subtitleHeight: Math.round(LAYOUT_BASE.subtitleHeight * ratio),
    legendWidth: Math.round(LAYOUT_BASE.legendWidth * ratio),
    statsWidth: Math.round(LAYOUT_BASE.statsWidth * ratio),
    cartoucheWidth: Math.round(LAYOUT_BASE.cartoucheWidth * ratio),
    footerHeight: Math.round(LAYOUT_BASE.footerHeight * ratio),
    coordLabelMargin: Math.round(LAYOUT_BASE.coordLabelMargin * ratio),
    padding: Math.round(LAYOUT_BASE.padding * ratio),
    // Tailles de police ajustées
    fontTitle: Math.round(18 * ratio),
    fontSubtitle: Math.round(12 * ratio),
    fontLegend: Math.round(11 * ratio),
    fontLegendTitle: Math.round(12 * ratio),
    fontStats: Math.round(10 * ratio),
    fontCartouche: Math.round(9 * ratio),
    fontCoordLabel: Math.round(9 * ratio)
  };
}

// Dimensions A4 en pixels selon DPI
// A4 = 210mm x 297mm = 8.27" x 11.69"
const A4_INCHES = { width: 8.27, height: 11.69 };

const A4_DIMENSIONS = {
  portrait: {
    72: { width: 595, height: 842 },
    150: { width: 1240, height: 1754 },
    300: { width: 2480, height: 3508 }
  },
  landscape: {
    72: { width: 842, height: 595 },
    150: { width: 1754, height: 1240 },
    300: { width: 3508, height: 2480 }
  }
};

/**
 * Calcule les dimensions A4 en pixels pour un DPI donné
 */
export function getA4Dimensions(
  dpi: number,
  orientation: 'portrait' | 'landscape' = 'portrait'
): { width: number; height: number } {
  // Utiliser les valeurs pré-calculées si disponibles
  const precomputed = A4_DIMENSIONS[orientation];
  if (dpi === 72) return precomputed[72];
  if (dpi === 150) return precomputed[150];
  if (dpi === 300) return precomputed[300];
  
  // Sinon calculer dynamiquement
  const w = Math.round(A4_INCHES.width * dpi);
  const h = Math.round(A4_INCHES.height * dpi);
  return orientation === 'portrait' ? { width: w, height: h } : { width: h, height: w };
}

/**
 * SOURCE DE VÉRITÉ UNIQUE pour le layout A4 et l'aspect ratio cible
 * Utilisé par:
 * - export-frame.ts pour créer le canvas
 * - export-quick-dialog.ts pour normaliser le viewport Leaflet
 * 
 * @returns Layout complet avec dimensions page, zone carte, et aspect ratio cible
 */
export function getA4Layout(
  dpi: number,
  orientation: 'portrait' | 'landscape' = 'portrait'
): {
  pageWidth: number;
  pageHeight: number;
  mapArea: { x: number; y: number; width: number; height: number };
  targetAspectRatio: number;
  margin: number;
  titleHeight: number;
  subtitleHeight: number;
  footerHeight: number;
} {
  const pageDims = getA4Dimensions(dpi, orientation);
  const scaled = getScaledLayout(dpi);
  
  // Zone carte = page - marges - titre - sous-titre - footer
  const mapX = scaled.margin;
  const mapY = scaled.margin + scaled.titleHeight + scaled.subtitleHeight;
  const mapWidth = pageDims.width - 2 * scaled.margin;
  const mapHeight = pageDims.height - 2 * scaled.margin - scaled.titleHeight - scaled.subtitleHeight - scaled.footerHeight;
  
  const targetAspectRatio = mapWidth / mapHeight;
  
  console.log('[getA4Layout] Layout calculé:', {
    dpi,
    pageWidth: pageDims.width,
    pageHeight: pageDims.height,
    mapWidth,
    mapHeight,
    targetAspectRatio: targetAspectRatio.toFixed(4)
  });
  
  return {
    pageWidth: pageDims.width,
    pageHeight: pageDims.height,
    mapArea: { x: mapX, y: mapY, width: mapWidth, height: mapHeight },
    targetAspectRatio,
    margin: scaled.margin,
    titleHeight: scaled.titleHeight,
    subtitleHeight: scaled.subtitleHeight,
    footerHeight: scaled.footerHeight
  };
}

/**
 * Calcule les dimensions optimales de la zone carte pour un ADM donné
 * La carte s'adapte au ratio de l'ADM tout en maximisant l'espace sur la page
 */
export function computeOptimalMapDimensions(
  admRatio: number,  // largeur/hauteur de l'ADM en degrés corrigés
  dpi: number = 300,
  orientation: 'portrait' | 'landscape' = 'portrait',
  hasTitle: boolean = true,
  hasLabels: boolean = true
): { mapWidth: number; mapHeight: number; pageWidth: number; pageHeight: number } {
  const { margin, titleHeight, subtitleHeight, footerHeight, padding } = LAYOUT;
  
  // Dimensions de la page
  const pageDims = A4_DIMENSIONS[orientation][dpi as 72 | 150 | 300] || A4_DIMENSIONS[orientation][300];
  const pageWidth = pageDims.width;
  const pageHeight = pageDims.height;
  
  // Espace pour labels de coordonnées
  const labelSpace = hasLabels ? 40 : 0;
  
  // Espace réservé pour header et footer
  const headerHeight = hasTitle ? (titleHeight + subtitleHeight) : 0;
  const totalFooterHeight = footerHeight + padding;
  
  // Zone disponible pour la carte (en pixels)
  const availableWidth = pageWidth - (margin * 2) - (labelSpace * 2);
  const availableHeight = pageHeight - (margin * 2) - headerHeight - footerHeight - (labelSpace * 2);
  
  // Ratio de la zone disponible
  const availableRatio = availableWidth / availableHeight;
  
  let mapWidth: number;
  let mapHeight: number;
  
  if (admRatio > availableRatio) {
    // ADM plus large que la zone disponible → utiliser toute la largeur
    mapWidth = availableWidth;
    mapHeight = availableWidth / admRatio;
  } else {
    // ADM plus haut que la zone disponible → utiliser toute la hauteur
    mapHeight = availableHeight;
    mapWidth = availableHeight * admRatio;
  }
  
  // Arrondir aux pixels entiers
  mapWidth = Math.floor(mapWidth);
  mapHeight = Math.floor(mapHeight);
  
  console.log('[ExportFrame] Dimensions carte optimales:', {
    admRatio: admRatio.toFixed(3),
    availableRatio: availableRatio.toFixed(3),
    mapWidth, mapHeight,
    pageWidth, pageHeight
  });
  
  return { mapWidth, mapHeight, pageWidth, pageHeight };
}

// ============================================================================
// Création du layout
// ============================================================================

export function computeExportLayout(
  mapWidth: number,
  mapHeight: number,
  options: ExportOptions,
  dpi: number = 72
): ExportFrameLayout {
  // Utiliser le layout scalé pour le DPI
  const scaled = getScaledLayout(dpi);
  const { margin, titleHeight, subtitleHeight, legendWidth, footerHeight, coordLabelMargin, padding } = scaled;
  
  // Espace pour les labels de coordonnées (scalé)
  const labelSpace = options.grid.showLabels ? Math.round(40 * dpi / 72) : 0;
  
  // Calcul des dimensions totales
  const totalWidth = margin * 2 + labelSpace * 2 + mapWidth;
  
  let headerHeight = 0;
  if (options.includeTitle) {
    headerHeight = titleHeight + (options.zone === 'adm-filtered' ? subtitleHeight : 0);
  }
  
  const totalFooterHeight = footerHeight + padding;
  const totalHeight = margin * 2 + headerHeight + labelSpace * 2 + mapHeight + totalFooterHeight;
  
  // Zone titre
  const titleArea = {
    x: margin,
    y: margin,
    width: totalWidth - margin * 2,
    height: headerHeight
  };
  
  // Zone carte
  const mapArea = {
    x: margin + labelSpace,
    y: margin + headerHeight + labelSpace,
    width: mapWidth,
    height: mapHeight
  };
  
  // Footer: Légende | Stats | Cartouche
  const footerY = mapArea.y + mapArea.height + labelSpace + padding;
  const footerContentHeight = footerHeight - padding * 2;
  
  // Calculer les zones du footer de manière cohérente (pas de chevauchement)
  const footerWidth = totalWidth - 2 * margin;
  const gap = padding; // Espace entre les colonnes
  
  // Zone légende (bas gauche) - largeur fixe
  const legendArea = {
    x: margin,
    y: footerY,
    width: scaled.legendWidth,
    height: footerContentHeight
  };
  
  // Zone cartouche (bas droit) - largeur fixe, positionnée depuis la droite
  const cartoucheArea = {
    x: totalWidth - margin - scaled.cartoucheWidth,
    y: footerY,
    width: scaled.cartoucheWidth,
    height: footerContentHeight
  };
  
  // Zone stats (milieu) - prend l'espace restant entre légende et cartouche
  // IMPORTANT: statsArea.width est calculé pour ne PAS chevaucher cartoucheArea
  const statsX = legendArea.x + legendArea.width + gap;
  const statsWidth = cartoucheArea.x - statsX - gap;
  
  const statsArea = {
    x: statsX,
    y: footerY,
    width: Math.max(statsWidth, 100), // Minimum 100px
    height: footerContentHeight
  };
  
  // Log pour debug du layout footer
  console.log('[ExportFrame] Footer layout:', {
    footerWidth,
    legendArea: { x: legendArea.x, w: legendArea.width, right: legendArea.x + legendArea.width },
    statsArea: { x: statsArea.x, w: statsArea.width, right: statsArea.x + statsArea.width },
    cartoucheArea: { x: cartoucheArea.x, w: cartoucheArea.width },
    gap,
    noOverlap: statsArea.x + statsArea.width <= cartoucheArea.x
  });
  
  return {
    totalWidth,
    totalHeight,
    titleArea,
    mapArea,
    legendArea,
    statsArea,
    cartoucheArea,
    coordLabelMargin
  };
}

// ============================================================================
// Classe principale ExportFrame
// ============================================================================

export class ExportFrame {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private layout: ExportFrameLayout;
  private options: ExportOptions;
  private scale: number;
  private dpi: number;
  private fonts: ReturnType<typeof getScaledLayout>;
  
  constructor(
    mapWidth: number,
    mapHeight: number,
    options: ExportOptions
  ) {
    this.options = options;
    this.scale = QUALITY_SETTINGS[options.quality].scale;
    this.dpi = QUALITY_SETTINGS[options.quality].dpi;
    this.fonts = getScaledLayout(this.dpi);
    
    // Calculer le layout avec le DPI pour les dimensions scalées
    this.layout = computeExportLayout(mapWidth, mapHeight, options, this.dpi);
    
    // Créer le canvas
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.layout.totalWidth * this.scale;
    this.canvas.height = this.layout.totalHeight * this.scale;
    
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('Impossible de créer le contexte 2D');
    this.ctx = ctx;
    
    // Appliquer le scale
    this.ctx.scale(this.scale, this.scale);
    
    // Fond blanc
    this.ctx.fillStyle = '#ffffff';
    this.ctx.fillRect(0, 0, this.layout.totalWidth, this.layout.totalHeight);
    
    console.log('[ExportFrame] Créé avec dimensions:', {
      mapWidth, mapHeight,
      totalWidth: this.layout.totalWidth,
      totalHeight: this.layout.totalHeight,
      canvasWidth: this.canvas.width,
      canvasHeight: this.canvas.height,
      scale: this.scale,
      dpi: this.dpi
    });
  }
  
  /**
   * Crée un ExportFrame avec dimensions A4 fixes
   * La carte sera centrée dans la zone disponible
   */
  static createA4(
    options: ExportOptions,
    orientation: 'portrait' | 'landscape' = 'portrait'
  ): ExportFrame {
    const dpi = QUALITY_SETTINGS[options.quality].dpi;
    const a4 = getA4Dimensions(dpi, orientation);
    
    // Utiliser le layout scalé pour le DPI
    const scaledLayout = getScaledLayout(dpi);
    const labelSpace = options.grid.showLabels ? Math.round(40 * dpi / 72) : 0;
    const headerHeight = options.includeTitle ? (scaledLayout.titleHeight + scaledLayout.subtitleHeight) : 0;
    
    // Zone disponible pour la carte
    const availableWidth = a4.width - (scaledLayout.margin * 2) - (labelSpace * 2);
    const availableHeight = a4.height - (scaledLayout.margin * 2) - headerHeight - scaledLayout.footerHeight - (labelSpace * 2) - scaledLayout.padding;
    
    console.log('[ExportFrame] Création A4 fixe:', {
      orientation,
      dpi,
      dpiRatio: dpi / 72,
      pageWidth: a4.width,
      pageHeight: a4.height,
      mapAreaWidth: availableWidth,
      mapAreaHeight: availableHeight,
      scaledLayout: { margin: scaledLayout.margin, titleHeight: scaledLayout.titleHeight, footerHeight: scaledLayout.footerHeight }
    });
    
    return new ExportFrame(availableWidth, availableHeight, options);
  }
  
  /**
   * Dessine le titre et sous-titre
   */
  drawTitle(thematic: ActiveThematic, admFilters: ActiveAdmFilters): void {
    if (!this.options.includeTitle) return;
    
    const { titleArea } = this.layout;
    const ctx = this.ctx;
    
    // Titre principal (police scalée)
    ctx.fillStyle = '#1a1a1a';
    ctx.font = `bold ${this.fonts.fontTitle}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const title = this.options.title || `Atlas Géotechnique – ${thematic.name}`;
    const titleY = titleArea.y + Math.round(5 * this.dpi / 72);
    ctx.fillText(title, titleArea.x + titleArea.width / 2, titleY);
    
    // Sous-titre (zone + date) - police scalée
    if (this.options.zone === 'adm-filtered' || this.options.subtitle) {
      ctx.font = `${this.fonts.fontSubtitle}px Arial, sans-serif`;
      ctx.fillStyle = '#666666';
      
      const zonePath = formatAdmPath(admFilters);
      const now = new Date();
      const date = now.toLocaleDateString('fr-FR');
      const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const subtitle = this.options.subtitle || `Zone : ${zonePath} – Export du ${date} à ${time}`;
      
      const subtitleY = titleArea.y + Math.round(30 * this.dpi / 72);
      ctx.fillText(subtitle, titleArea.x + titleArea.width / 2, subtitleY);
    }
  }
  
  /**
   * Dessine l'image de la carte capturée
   * Utilise un rendu LETTERBOX pour préserver l'aspect ratio (évite l'étirement)
   */
  async drawMapImage(mapImageData: string | HTMLImageElement | HTMLCanvasElement): Promise<void> {
    const { mapArea } = this.layout;
    
    let img: HTMLImageElement | HTMLCanvasElement;
    
    if (typeof mapImageData === 'string') {
      // C'est une URL data ou une URL normale
      img = await this.loadImage(mapImageData);
    } else {
      img = mapImageData;
    }
    
    // ========== EXPÉRIENCE 2B: Rendu LETTERBOX pour préserver l'aspect ratio ==========
    const srcW = img.width;
    const srcH = img.height;
    const dstW = mapArea.width;
    const dstH = mapArea.height;
    
    const arSrc = srcW / srcH;
    const arDst = dstW / dstH;
    
    let drawW: number;
    let drawH: number;
    let drawX: number;
    let drawY: number;
    
    if (Math.abs(arSrc - arDst) < 0.01) {
      // Aspect ratios quasi-identiques, pas besoin de letterbox
      drawW = dstW;
      drawH = dstH;
      drawX = mapArea.x;
      drawY = mapArea.y;
    } else {
      // Calculer le scale pour FIT (letterbox) - pas de stretch
      const scale = Math.min(dstW / srcW, dstH / srcH);
      drawW = srcW * scale;
      drawH = srcH * scale;
      
      // Centrer dans la zone carte
      drawX = mapArea.x + (dstW - drawW) / 2;
      drawY = mapArea.y + (dstH - drawH) / 2;
      
      console.log('[ExportFrame] Letterbox applied:', {
        src: { w: srcW, h: srcH, ar: arSrc.toFixed(3) },
        dst: { w: dstW, h: dstH, ar: arDst.toFixed(3) },
        draw: { w: drawW.toFixed(0), h: drawH.toFixed(0), x: drawX.toFixed(0), y: drawY.toFixed(0) },
        scale: scale.toFixed(3)
      });
    }
    
    this.ctx.drawImage(img, drawX, drawY, drawW, drawH);
  }
  
  /**
   * Dessine un masque semi-transparent ou opaque hors de l'ADM
   * @param admPolygon - Coordonnées du polygone ADM en lat/lon [[lng, lat], ...]
   * @param bbox - Bounding box de la carte
   * @param mode - 'none' | 'context' (45%) | 'focus' (85%) | 'clip' (100%)
   */
  drawAdmMask(
    admPolygon: number[][] | null,
    bbox: BBox,
    mode: 'none' | 'context' | 'focus' | 'clip' = 'context'
  ): void {
    console.log('[ExportFrame] drawAdmMask called:', { 
      mode, 
      polygonPoints: admPolygon?.length,
      bbox
    });
    
    if (mode === 'none' || !admPolygon || admPolygon.length < 3) {
      console.log('[ExportFrame] drawAdmMask skipped');
      return;
    }
    
    const { mapArea } = this.layout;
    const ctx = this.ctx;
    
    // Opacité selon le mode: context=45%, focus=85%, clip=100%
    const opacity = mode === 'clip' ? 1.0 : (mode === 'focus' ? 0.85 : 0.45);
    
    // Convertir les coordonnées lng/lat en pixels sur le canvas (coordonnées logiques)
    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width;
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height;
      return [x, y];
    };
    
    // Debug: vérifier les premiers points convertis
    const debugPoints = admPolygon.slice(0, 3).map(pt => ({
      lng: pt[0], lat: pt[1],
      pixel: toPixel(pt[0], pt[1])
    }));
    console.log('[ExportFrame] Masque ADM - conversion coords:', {
      mapArea: { x: mapArea.x, y: mapArea.y, w: mapArea.width, h: mapArea.height },
      bbox,
      firstPoints: debugPoints,
      opacity
    });
    
    ctx.save();
    
    // MÉTHODE DIRECTE: Dessiner le masque directement sur le canvas principal
    // en utilisant fill('evenodd') pour créer un trou
    
    // 1. Créer un chemin qui couvre la zone carte SAUF le polygone ADM
    ctx.beginPath();
    
    // Rectangle extérieur (zone carte) - sens horaire
    ctx.moveTo(mapArea.x, mapArea.y);
    ctx.lineTo(mapArea.x + mapArea.width, mapArea.y);
    ctx.lineTo(mapArea.x + mapArea.width, mapArea.y + mapArea.height);
    ctx.lineTo(mapArea.x, mapArea.y + mapArea.height);
    ctx.closePath();
    
    // Polygone ADM intérieur (trou) - sens anti-horaire pour créer un trou
    const firstPoint = toPixel(admPolygon[0][0], admPolygon[0][1]);
    ctx.moveTo(firstPoint[0], firstPoint[1]);
    
    // Parcourir en sens inverse pour créer le trou
    for (let i = admPolygon.length - 1; i >= 0; i--) {
      const [x, y] = toPixel(admPolygon[i][0], admPolygon[i][1]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    
    // Remplir avec le masque blanc semi-transparent
    ctx.fillStyle = `rgba(255, 255, 255, ${opacity})`;
    ctx.fill('evenodd');
    
    console.log('[ExportFrame] Masque dessiné avec evenodd, opacity:', opacity);
    
    // Dessiner aussi la bordure de l'ADM en pointillés
    ctx.beginPath();
    const startPt = toPixel(admPolygon[0][0], admPolygon[0][1]);
    ctx.moveTo(startPt[0], startPt[1]);
    for (let i = 1; i < admPolygon.length; i++) {
      const [x, y] = toPixel(admPolygon[i][0], admPolygon[i][1]);
      ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.setLineDash([6, 4]);
    ctx.strokeStyle = '#3366cc';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.setLineDash([]);
    
    console.log('[ExportFrame] Mask drawn with evenodd fill rule');
    ctx.restore();
  }
  
  /**
   * Dessine les labels des ADM limitrophes sur les bords du polygone ADM
   * Les labels sont positionnés aux coordonnées réelles des voisins, sur le bord de l'ADM
   * @param neighbors - Liste des voisins avec direction et coordonnées
   * @param bbox - Bounding box de la carte
   * @param admPolygon - Optionnel: polygone ADM pour calculer les intersections
   */
  drawNeighborLabels(
    neighbors: Array<{
      label: string;
      direction: string;
      lon: number;
      lat: number;
    }>,
    bbox: BBox,
    admPolygon?: number[][] | null
  ): void {
    if (!neighbors || neighbors.length === 0) return;
    
    const { mapArea } = this.layout;
    const ctx = this.ctx;
    
    // Convertir coordonnées géo en pixels
    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width;
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height;
      return [x, y];
    };
    
    ctx.save();
    // Police plus grande et visible (16px pour meilleure lisibilité)
    ctx.font = 'italic bold 16px Arial, sans-serif';
    
    // Fonction pour dessiner un label avec halo
    const drawLabelWithHalo = (text: string, x: number, y: number, align: CanvasTextAlign, baseline: CanvasTextBaseline) => {
      ctx.textAlign = align;
      ctx.textBaseline = baseline;
      // Halo blanc épais
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.95)';
      ctx.lineWidth = 4;
      ctx.lineJoin = 'round';
      ctx.strokeText(text, x, y);
      // Texte principal en gris foncé
      ctx.fillStyle = '#333333';
      ctx.fillText(text, x, y);
    };
    
    // Calculer le centroïde de l'ADM si disponible
    let admCenterX = mapArea.x + mapArea.width / 2;
    let admCenterY = mapArea.y + mapArea.height / 2;
    
    if (admPolygon && admPolygon.length > 2) {
      let sumX = 0, sumY = 0;
      for (const pt of admPolygon) {
        const [px, py] = toPixel(pt[0], pt[1]);
        sumX += px;
        sumY += py;
      }
      admCenterX = sumX / admPolygon.length;
      admCenterY = sumY / admPolygon.length;
    }
    
    const labelOffset = 15; // Distance du bord de la carte
    
    // Dessiner chaque label à sa position géographique réelle
    for (const neighbor of neighbors) {
      const [px, py] = toPixel(neighbor.lon, neighbor.lat);
      const dir = neighbor.direction.toUpperCase();
      
      // Clamp la position aux bords de la zone carte avec offset
      let x = px;
      let y = py;
      let align: CanvasTextAlign = 'center';
      let baseline: CanvasTextBaseline = 'middle';
      
      // Déterminer la position et l'alignement selon la direction
      switch (dir) {
        case 'N':
          // Positionner en haut de la zone carte
          y = mapArea.y + labelOffset;
          x = Math.max(mapArea.x + 30, Math.min(mapArea.x + mapArea.width - 30, px));
          align = 'center';
          baseline = 'top';
          break;
        case 'S':
          // Positionner en bas de la zone carte
          y = mapArea.y + mapArea.height - labelOffset;
          x = Math.max(mapArea.x + 30, Math.min(mapArea.x + mapArea.width - 30, px));
          align = 'center';
          baseline = 'bottom';
          break;
        case 'E':
          // Positionner à droite de la zone carte
          x = mapArea.x + mapArea.width - labelOffset;
          y = Math.max(mapArea.y + 20, Math.min(mapArea.y + mapArea.height - 20, py));
          align = 'right';
          baseline = 'middle';
          break;
        case 'W':
          // Positionner à gauche de la zone carte
          x = mapArea.x + labelOffset;
          y = Math.max(mapArea.y + 20, Math.min(mapArea.y + mapArea.height - 20, py));
          align = 'left';
          baseline = 'middle';
          break;
        default:
          // Position par défaut basée sur la direction vers le centre
          if (px < admCenterX) {
            x = mapArea.x + labelOffset;
            align = 'left';
          } else {
            x = mapArea.x + mapArea.width - labelOffset;
            align = 'right';
          }
          y = Math.max(mapArea.y + 20, Math.min(mapArea.y + mapArea.height - 20, py));
      }
      
      drawLabelWithHalo(neighbor.label, x, y, align, baseline);
    }
    
    ctx.restore();
  }
  
  /**
   * Dessine les mailles vides (sans données) en gris clair
   * IMPORTANT: Cette fonction ne dessine QUE les mailles SANS données
   * Les mailles AVEC données sont dans la capture Leaflet (thématique)
   * @param cells - Liste des mailles avec leur géométrie
   * @param bbox - Bounding box de la carte
   */
  drawEmptyCells(
    cells: Array<{ geometry: any; has_data: boolean; value?: number }>,
    bbox: BBox
  ): void {
    const { mapArea } = this.layout;
    const ctx = this.ctx;
    
    // Convertir les coordonnées géo en pixels
    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width;
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height;
      return [x, y];
    };
    
    const scale = this.dpi / 72;
    const emptyCells = cells.filter(c => !c.has_data);
    const withDataCells = cells.filter(c => c.has_data);
    
    console.log('[ExportFrame] drawEmptyCells:', {
      total: cells.length,
      withData: withDataCells.length,
      withoutData: emptyCells.length
    });
    
    ctx.save();
    // Mailles vides : fond très léger + contour gris visible
    ctx.fillStyle = 'rgba(220, 220, 220, 0.15)'; // Fond quasi-transparent
    ctx.strokeStyle = 'rgba(180, 180, 180, 0.7)'; // Contour gris visible
    ctx.lineWidth = 0.5 * scale;
    
    for (const cell of emptyCells) {
      const geom = cell.geometry;
      if (!geom || geom.type !== 'Polygon') continue;
      
      const coords = geom.coordinates?.[0];
      if (!coords || coords.length < 3) continue;
      
      ctx.beginPath();
      const [startX, startY] = toPixel(coords[0][0], coords[0][1]);
      ctx.moveTo(startX, startY);
      
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    
    ctx.restore();
    console.log('[ExportFrame] Empty cells drawn:', emptyCells.length);
  }
  
  /**
   * Dessine les mailles avec données en mode DEBUG (rouge vif)
   * Utile pour vérifier si les mailles thématiques sont bien présentes
   * @param cells - Liste des mailles avec leur géométrie
   * @param bbox - Bounding box de la carte
   */
  drawDataCellsDebug(
    cells: Array<{ geometry: any; has_data: boolean; value?: number }>,
    bbox: BBox
  ): void {
    const { mapArea } = this.layout;
    const ctx = this.ctx;
    
    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width;
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height;
      return [x, y];
    };
    
    const scale = this.dpi / 72;
    const withDataCells = cells.filter(c => c.has_data);
    
    console.log('[ExportFrame] DEBUG: Drawing', withDataCells.length, 'cells with data in RED');
    
    ctx.save();
    ctx.fillStyle = 'rgba(255, 0, 0, 0.6)'; // Rouge vif semi-transparent
    ctx.strokeStyle = 'rgba(200, 0, 0, 1)'; // Contour rouge foncé
    ctx.lineWidth = 1.5 * scale;
    
    for (const cell of withDataCells) {
      const geom = cell.geometry;
      if (!geom || geom.type !== 'Polygon') continue;
      
      const coords = geom.coordinates?.[0];
      if (!coords || coords.length < 3) continue;
      
      ctx.beginPath();
      const [startX, startY] = toPixel(coords[0][0], coords[0][1]);
      ctx.moveTo(startX, startY);
      
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
    }
    
    ctx.restore();
    console.log('[ExportFrame] DEBUG cells with data drawn:', withDataCells.length);
  }
  
  /**
   * Dessine les mailles avec données en utilisant les couleurs de la légende
   * C'est la source de vérité unique pour le rendu thématique (pas de capture Leaflet)
   * @param cells - Liste des mailles avec leur géométrie et valeur
   * @param bbox - Bounding box de la carte
   * @param classes - Classes de la légende avec couleurs et breaks
   * @returns Comptage des mailles par classe (pour filtrer la légende)
   */
  drawColoredCells(
    cells: Array<{ geometry: any; has_data: boolean; n_sondages?: number; value?: number }>,
    bbox: BBox,
    classes: Array<{ min: number | null; max: number | null; color: string; label: string }>
  ): Map<number, number> {
    const { mapArea } = this.layout;
    const ctx = this.ctx;
    
    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width;
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height;
      return [x, y];
    };
    
    const scale = this.dpi / 72;
    const withDataCells = cells.filter(c => c.has_data);
    
    // Comptage des mailles par classe (pour filtrer la légende)
    const classUsageCount = new Map<number, number>();
    
    // Palette de couleurs plus saturées pour les classes basses (n_sondages)
    // Les couleurs originales Blues sont trop pâles pour les valeurs faibles
    const SATURATED_COLORS: Record<string, string> = {
      '#f7fbff': '#a6d4f7', // Classe 0-1 : bleu très clair → bleu ciel visible
      '#deebf7': '#7ec4f0', // Classe 1-2 : bleu clair → bleu moyen
      '#c6dbef': '#52b3e9', // Classe 2-3 : bleu → bleu plus saturé
    };
    
    // Fonction pour trouver la couleur d'une valeur selon les classes
    const getColorForValue = (value: number): { color: string; classIndex: number } => {
      for (let i = 0; i < classes.length; i++) {
        const cls = classes[i];
        const min = cls.min ?? -Infinity;
        const max = cls.max ?? Infinity;
        if (value >= min && value < max) {
          // Utiliser couleur saturée si disponible
          const saturated = SATURATED_COLORS[cls.color] || cls.color;
          return { color: saturated, classIndex: i };
        }
        // Cas spécial pour la dernière classe (inclusive)
        if (cls.max === null && value >= min) {
          const saturated = SATURATED_COLORS[cls.color] || cls.color;
          return { color: saturated, classIndex: i };
        }
      }
      // Fallback: première classe ou gris
      return { color: classes[0]?.color || '#cccccc', classIndex: 0 };
    };
    
    // Log détaillé du mapping valeur → classe → couleur (debug)
    const sampleMapping = withDataCells.slice(0, 10).map(c => {
      const v = c.n_sondages ?? c.value ?? 0;
      const { color, classIndex } = getColorForValue(v);
      const classLabel = classes[classIndex]?.label || 'N/A';
      return { value: v, classIndex, classLabel, color };
    });
    
    console.log('[ExportFrame] drawColoredCells:', {
      totalCells: cells.length,
      withData: withDataCells.length,
      classCount: classes.length,
      classes: classes.map(c => ({ min: c.min, max: c.max, label: c.label, color: c.color })),
      sampleMapping
    });
    
    ctx.save();
    // AMÉLIORATION VISIBILITÉ: stroke plus visible pour distinguer les mailles
    ctx.lineWidth = 1.0 * scale; // Plus épais (était 0.3)
    ctx.strokeStyle = 'rgba(50, 80, 120, 0.6)'; // Bleu-gris visible (était gris 0.3)
    
    let drawnCount = 0;
    for (const cell of withDataCells) {
      const geom = cell.geometry;
      if (!geom || geom.type !== 'Polygon') continue;
      
      const coords = geom.coordinates?.[0];
      if (!coords || coords.length < 3) continue;
      
      const value = cell.n_sondages ?? cell.value ?? 0;
      const { color, classIndex } = getColorForValue(value);
      
      // Compter l'usage de cette classe
      classUsageCount.set(classIndex, (classUsageCount.get(classIndex) || 0) + 1);
      
      ctx.fillStyle = color;
      ctx.beginPath();
      const [startX, startY] = toPixel(coords[0][0], coords[0][1]);
      ctx.moveTo(startX, startY);
      
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1]);
        ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.fill();
      ctx.stroke();
      drawnCount++;
    }
    
    ctx.restore();
    
    // Log du comptage par classe
    const classCountLog: Record<string, number> = {};
    classUsageCount.forEach((count, idx) => {
      classCountLog[classes[idx]?.label || `class${idx}`] = count;
    });
    console.log('[ExportFrame] Colored cells drawn:', drawnCount, 'classUsage:', classCountLog);
    
    return classUsageCount;
  }
  
  /**
   * Dessine la grille et le cadre
   */
  drawGridAndFrame(bbox: BBox): void {
    const { mapArea, coordLabelMargin } = this.layout;
    const { grid, frameStyle } = this.options;
    
    if (grid.type === 'none' && frameStyle === 'none') return;
    
    // Générer les lignes de grille
    const gridOutput: GridGeneratorOutput = generateGridLines({
      bbox,
      mapWidth: mapArea.width,
      mapHeight: mapArea.height,
      options: grid
    });
    
    // Dessiner la grille (avec DPI pour scaler les labels)
    renderGrid({
      ctx: this.ctx,
      mapArea,
      gridOutput,
      gridType: grid.type,
      showLabels: grid.showLabels,
      labelSides: grid.labelSides,
      labelMargin: coordLabelMargin,
      dpi: this.dpi
    });
    
    // Dessiner le cadre
    renderFrame({
      ctx: this.ctx,
      mapArea,
      style: frameStyle
    });
  }
  
  /**
   * Dessine la légende reconstruite depuis les classes thématiques
   * @param legendData - Données de légende
   * @param showEmptyCells - Afficher l'entrée mailles sans données
   * @param showAdmBoundary - Afficher l'entrée délimitation ADM
   * @param classUsageCount - Comptage des mailles par classe (pour filtrer et afficher n=X)
   */
  drawLegend(
    legendData?: ThematicLegendData, 
    showEmptyCells: boolean = false, 
    showAdmBoundary: boolean = false,
    classUsageCount?: Map<number, number>
  ): void {
    if (!this.options.includeLegend) return;
    
    const { legendArea } = this.layout;
    const ctx = this.ctx;
    
    // Dimensions scalées pour le DPI
    const scale = this.dpi / 72;
    const padding = Math.round(8 * scale);
    const boxSize = Math.round(12 * scale);
    const lineHeight = Math.round(16 * scale);
    
    // Cadre de la légende
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = scale;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(legendArea.x, legendArea.y, legendArea.width, legendArea.height);
    ctx.strokeRect(legendArea.x, legendArea.y, legendArea.width, legendArea.height);
    
    // Titre de la légende (paramètre + unité) - police scalée
    ctx.fillStyle = '#333333';
    ctx.font = `bold ${this.fonts.fontLegendTitle}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const legendTitle = legendData 
      ? `${legendData.parameterLabel}${legendData.unit ? ` (${legendData.unit})` : ''}`
      : 'Légende';
    ctx.fillText(legendTitle, legendArea.x + padding, legendArea.y + Math.round(6 * scale));
    
    const textX = legendArea.x + padding + boxSize + Math.round(6 * scale);
    let currentY = legendArea.y + Math.round(24 * scale);
    
    ctx.font = `${this.fonts.fontLegend}px Arial, sans-serif`;
    
    // Si pas de données de légende, afficher un placeholder
    if (!legendData || !legendData.classes || legendData.classes.length === 0) {
      ctx.fillStyle = '#888888';
      ctx.fillText('(aucune thématique active)', legendArea.x + padding, currentY);
      currentY += lineHeight;
    } else {
      // Filtrer les classes selon le comptage réel (classUsageCount)
      // Si classUsageCount est fourni, n'afficher que les classes utilisées
      // Sinon, utiliser le count de la classe ou afficher toutes
      const classesWithCount = legendData.classes.map((cls, idx) => {
        const usageCount = classUsageCount?.get(idx) ?? cls.count ?? undefined;
        return { ...cls, actualCount: usageCount, index: idx };
      });
      
      // Option: afficher toutes les classes mais griser celles à count=0
      // Pour l'instant, on filtre pour n'afficher que les classes utilisées
      const visibleClasses = classUsageCount 
        ? classesWithCount.filter(cls => cls.actualCount !== undefined && cls.actualCount > 0)
        : classesWithCount.filter(cls => cls.actualCount === undefined || cls.actualCount > 0);
      
      console.log('[ExportFrame] Légende - classes visibles:', visibleClasses.length, '/', legendData.classes.length,
        'classUsageCount:', classUsageCount ? Object.fromEntries(classUsageCount) : 'N/A');
      
      if (visibleClasses.length === 0) {
        ctx.fillStyle = '#888888';
        ctx.fillText('(aucune donnée dans la zone)', legendArea.x + padding, currentY);
        currentY += lineHeight;
      } else {
        // Calculer la largeur max des labels pour bbox dynamique
        let maxLabelWidth = 0;
        for (const cls of visibleClasses) {
          const labelText = cls.actualCount !== undefined 
            ? `${cls.label} (n=${cls.actualCount})`
            : cls.label;
          const measured = ctx.measureText(labelText);
          maxLabelWidth = Math.max(maxLabelWidth, measured.width);
        }
        
        // Calculer la largeur dynamique de la légende
        const dynamicWidth = padding * 2 + boxSize + Math.round(6 * scale) + maxLabelWidth + Math.round(10 * scale);
        const actualLegendWidth = Math.max(dynamicWidth, legendArea.width);
        
        console.log('[ExportFrame] Légende bbox dynamique:', {
          maxLabelWidth: maxLabelWidth.toFixed(0),
          dynamicWidth,
          actualWidth: actualLegendWidth
        });
        
        // Dessiner les classes thématiques présentes
        for (const cls of visibleClasses) {
          // Boîte de couleur
          ctx.fillStyle = cls.color;
          ctx.fillRect(legendArea.x + padding, currentY, boxSize, boxSize);
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 0.5 * scale;
          ctx.strokeRect(legendArea.x + padding, currentY, boxSize, boxSize);
          
          // Label avec comptage (n=X) si disponible
          ctx.fillStyle = '#333333';
          ctx.textBaseline = 'middle';
          const labelText = cls.actualCount !== undefined 
            ? `${cls.label} (n=${cls.actualCount})`
            : cls.label;
          ctx.fillText(labelText, textX, currentY + boxSize / 2);
          currentY += lineHeight;
        }
      }
    }
    
    // Ajouter une séparation si on a des entrées supplémentaires
    if (showEmptyCells || showAdmBoundary) {
      currentY += Math.round(4 * scale); // Petit espace scalé
    }
    
    // Entrée "Mailles sans données" si activée
    if (showEmptyCells) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.fillRect(legendArea.x + padding, currentY, boxSize, boxSize);
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
      ctx.lineWidth = 0.5 * scale;
      ctx.strokeRect(legendArea.x + padding, currentY, boxSize, boxSize);
      
      ctx.fillStyle = '#333333';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sans données', textX, currentY + boxSize / 2);
      currentY += lineHeight;
    }
    
    // Entrée "Délimitation ADM" si activée
    if (showAdmBoundary) {
      // Dessiner une ligne pointillée bleue
      ctx.beginPath();
      ctx.setLineDash([Math.round(3 * scale), Math.round(2 * scale)]);
      ctx.strokeStyle = '#3366cc';
      ctx.lineWidth = 2 * scale;
      ctx.moveTo(legendArea.x + padding, currentY + boxSize / 2);
      ctx.lineTo(legendArea.x + padding + boxSize, currentY + boxSize / 2);
      ctx.stroke();
      ctx.setLineDash([]);
      
      ctx.fillStyle = '#333333';
      ctx.textBaseline = 'middle';
      ctx.fillText('Limite ADM', textX, currentY + boxSize / 2);
      currentY += lineHeight;
    }
  }
  
  /**
   * Dessine le cartouche (infos, échelle, nord)
   */
  drawCartouche(scaleText: string, admFilters?: ActiveAdmFilters): void {
    const { cartoucheArea } = this.layout;
    const ctx = this.ctx;
    
    // Dimensions scalées pour le DPI
    const scale = this.dpi / 72;
    const padding = Math.round(10 * scale);
    const lineHeight = Math.round(12 * scale);
    
    // Cadre du cartouche
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = scale;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(cartoucheArea.x, cartoucheArea.y, cartoucheArea.width, cartoucheArea.height);
    ctx.strokeRect(cartoucheArea.x, cartoucheArea.y, cartoucheArea.width, cartoucheArea.height);
    
    const textX = cartoucheArea.x + padding;
    let textY = cartoucheArea.y + padding;
    
    ctx.fillStyle = '#333333';
    ctx.font = `${this.fonts.fontCartouche}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    // Source
    ctx.fillText('Source : Atlas Géotechnique v2.6.0', textX, textY);
    textY += lineHeight;
    
    // Fond de carte
    ctx.fillText('Fond : © OpenStreetMap contributors', textX, textY);
    textY += lineHeight;
    
    // SCR d'affichage et SCR des données
    if (this.options.includeScrInfo) {
      const scrDisplay = this.options.grid.scr === 'EPSG:4326' 
        ? 'WGS84 (EPSG:4326)' 
        : 'UTM 31N (EPSG:25231)';
      ctx.fillText(`SCR : ${scrDisplay}`, textX, textY);
      textY += lineHeight;
      
      // Toujours afficher le SCR des données (stockage en base)
      ctx.fillStyle = '#666666';
      ctx.fillText('Données : UTM 31N (EPSG:25231)', textX, textY);
      ctx.fillStyle = '#333333';
      textY += lineHeight;
    }
    
    // Date
    const date = new Date().toLocaleDateString('fr-FR');
    ctx.fillText(`Date : ${date}`, textX, textY);
    
    // Barre d'échelle (à droite du cartouche) - positions scalées
    if (this.options.includeScaleBar) {
      this.drawScaleBar(
        cartoucheArea.x + cartoucheArea.width - Math.round(100 * scale),
        cartoucheArea.y + cartoucheArea.height - Math.round(25 * scale),
        scaleText
      );
    }
    
    // Flèche du Nord - positions scalées
    if (this.options.includeNorthArrow) {
      this.drawNorthArrow(
        cartoucheArea.x + cartoucheArea.width - Math.round(30 * scale),
        cartoucheArea.y + Math.round(25 * scale)
      );
    }
  }
  
  /**
   * Dessine la barre d'échelle
   */
  private drawScaleBar(x: number, y: number, scaleText: string): void {
    const ctx = this.ctx;
    const scale = this.dpi / 72;
    const barWidth = Math.round(80 * scale);
    const barHeight = Math.round(6 * scale);
    const tickHeight = Math.round(3 * scale);
    
    // Barre
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, barWidth / 2, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + barWidth / 2, y, barWidth / 2, barHeight);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = scale;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Graduations
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - tickHeight);
    ctx.moveTo(x + barWidth / 2, y);
    ctx.lineTo(x + barWidth / 2, y - tickHeight);
    ctx.moveTo(x + barWidth, y);
    ctx.lineTo(x + barWidth, y - tickHeight);
    ctx.stroke();
    
    // Label - police scalée
    ctx.fillStyle = '#333333';
    ctx.font = `${this.fonts.fontCartouche}px Arial, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(scaleText, x + barWidth / 2, y + barHeight + Math.round(2 * scale));
  }
  
  /**
   * Dessine la flèche du Nord
   */
  private drawNorthArrow(x: number, y: number): void {
    const ctx = this.ctx;
    const scale = this.dpi / 72;
    const size = Math.round(20 * scale);
    
    ctx.save();
    ctx.translate(x, y);
    
    // Flèche
    ctx.fillStyle = '#333333';
    ctx.beginPath();
    ctx.moveTo(0, -size / 2);
    ctx.lineTo(size / 4, size / 2);
    ctx.lineTo(0, size / 4);
    ctx.lineTo(-size / 4, size / 2);
    ctx.closePath();
    ctx.fill();
    
    // Lettre N
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 10px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText('N', 0, -size / 2 - 2);
    
    ctx.restore();
  }
  
  /**
   * Découpe un texte en lignes pour tenir dans une largeur max
   */
  private wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;
      const testWidth = ctx.measureText(testLine).width;
      
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
    if (currentLine) {
      lines.push(currentLine);
    }
    return lines.length > 0 ? lines : [text];
  }
  
  /**
   * Dessine le bloc de statistiques avec layout 2 colonnes dynamiques
   * - Labels: colonne gauche avec word-wrap si nécessaire
   * - Valeurs: colonne droite alignée à droite, police monospace
   */
  drawStats(stats?: ExportStats): void {
    if (!this.options.includeStats || !stats) return;
    
    const { statsArea } = this.layout;
    const ctx = this.ctx;
    
    // Dimensions scalées pour le DPI
    const scale = this.dpi / 72;
    const padding = Math.round(6 * scale);
    const headerHeight = Math.round(18 * scale);
    const lineHeight = Math.round(10 * scale);
    const fontSize = Math.round(7 * scale);
    
    // Layout 2 colonnes: 50% label, 50% valeur
    const labelMaxWidth = Math.round((statsArea.width - padding * 3) * 0.50);
    const valueX = statsArea.x + statsArea.width - padding;
    
    console.log('[ExportFrame] drawStats 2-col layout:', {
      statsArea,
      labelMaxWidth,
      rowCount: stats.rows.length
    });
    
    // S'assurer que le contexte est propre
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = 'source-over';
    
    // Cadre principal
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = scale;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(statsArea.x, statsArea.y, statsArea.width, statsArea.height);
    ctx.strokeRect(statsArea.x, statsArea.y, statsArea.width, statsArea.height);
    
    // Titre - police scalée
    ctx.fillStyle = '#333333';
    ctx.font = `bold ${this.fonts.fontStats}px Arial, sans-serif`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const titleX = statsArea.x + padding;
    const titleY = statsArea.y + padding;
    ctx.fillText(stats.title, titleX, titleY);
    
    // Sous-titre (zone)
    if (stats.subtitle) {
      ctx.font = `${Math.round(7 * scale)}px Arial, sans-serif`;
      ctx.fillStyle = '#666666';
      const subtitleY = statsArea.y + padding + Math.round(10 * scale);
      ctx.fillText(stats.subtitle, titleX, subtitleY);
    }
    
    // Lignes de stats principales
    let y = statsArea.y + headerHeight + padding;
    const labelX = statsArea.x + padding;
    
    for (let i = 0; i < stats.rows.length; i++) {
      const row = stats.rows[i];
      const valueText = row.unit ? `${row.value} ${row.unit}` : row.value;
      
      // Label: police normale, word-wrap si trop long
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = row.highlight ? '#1a5276' : '#555555';
      ctx.textAlign = 'left';
      
      // Word-wrap le label
      const labelWithColon = row.label + ' :';
      const labelLines = this.wrapText(ctx, labelWithColon, labelMaxWidth);
      
      // Dessiner chaque ligne du label
      for (let lineIdx = 0; lineIdx < labelLines.length; lineIdx++) {
        ctx.fillText(labelLines[lineIdx], labelX, y + lineIdx * lineHeight);
      }
      
      // Valeur: alignée avec la première ligne du label
      ctx.font = row.highlight 
        ? `bold ${fontSize}px 'Consolas', 'Monaco', monospace`
        : `${fontSize}px 'Consolas', 'Monaco', monospace`;
      ctx.fillStyle = row.highlight ? '#1a5276' : '#333333';
      ctx.textAlign = 'right';
      ctx.fillText(valueText, valueX, y);
      ctx.textAlign = 'left';
      
      // Avancer Y en tenant compte du nombre de lignes du label
      y += lineHeight * labelLines.length;
    }
    
    // Contexte multi-niveaux (parent_context)
    if (stats.contextRows && stats.contextRows.length > 0) {
      y += Math.round(3 * scale);
      
      // Ligne de séparation
      ctx.strokeStyle = '#dddddd';
      ctx.lineWidth = scale;
      ctx.beginPath();
      ctx.moveTo(statsArea.x + padding, y);
      ctx.lineTo(statsArea.x + statsArea.width - padding, y);
      ctx.stroke();
      y += Math.round(5 * scale);
      
      // Titre contexte
      ctx.fillStyle = '#666666';
      ctx.font = `bold ${Math.round(7 * scale)}px Arial, sans-serif`;
      ctx.fillText('Contexte', statsArea.x + padding, y);
      y += lineHeight;
      
      // Lignes de contexte avec word-wrap
      ctx.font = `${fontSize}px Arial, sans-serif`;
      for (const row of stats.contextRows) {
        const ctxValueText = row.unit ? `${row.value} ${row.unit}` : row.value;
        const ctxLabelWithColon = row.label + ' :';
        const ctxLabelLines = this.wrapText(ctx, ctxLabelWithColon, labelMaxWidth);
        
        ctx.fillStyle = '#666666';
        ctx.textAlign = 'left';
        for (let lineIdx = 0; lineIdx < ctxLabelLines.length; lineIdx++) {
          ctx.fillText(ctxLabelLines[lineIdx], labelX, y + lineIdx * lineHeight);
        }
        
        ctx.fillStyle = '#444444';
        ctx.font = `${fontSize}px 'Consolas', 'Monaco', monospace`;
        ctx.textAlign = 'right';
        ctx.fillText(ctxValueText, valueX, y);
        ctx.textAlign = 'left';
        ctx.font = `${fontSize}px Arial, sans-serif`;
        
        y += lineHeight * ctxLabelLines.length;
      }
    }
    
    ctx.restore();
    
    console.log('[ExportFrame] drawStats COMPLETE:', {
      rowsDrawn: stats.rows.length,
      contextRowsDrawn: stats.contextRows?.length || 0,
      finalY: y
    });
  }
  
  /**
   * Charge une image depuis une URL
   */
  private loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }
  
  /**
   * Retourne le canvas
   */
  getCanvas(): HTMLCanvasElement {
    return this.canvas;
  }
  
  /**
   * Retourne le layout calculé
   */
  getLayout(): ExportFrameLayout {
    return this.layout;
  }
  
  /**
   * Exporte en data URL PNG
   */
  toDataURL(type: string = 'image/png', quality?: number): string {
    return this.canvas.toDataURL(type, quality);
  }
  
  /**
   * Exporte en Blob
   */
  toBlob(type: string = 'image/png', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => {
      this.canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Échec de la conversion en Blob'));
        },
        type,
        quality
      );
    });
  }
}

// ============================================================================
// Utilitaire pour calculer le texte d'échelle
// ============================================================================

export function computeScaleText(
  mapWidthPx: number,
  bboxWidthDegrees: number,
  centerLat: number
): string {
  // Conversion degrés → mètres (approximation à la latitude donnée)
  const metersPerDegree = 111320 * Math.cos(centerLat * Math.PI / 180);
  const mapWidthMeters = bboxWidthDegrees * metersPerDegree;
  
  // Largeur de la barre d'échelle en pixels (80px)
  const scaleBarWidthPx = 80;
  const scaleBarWidthMeters = (scaleBarWidthPx / mapWidthPx) * mapWidthMeters;
  
  // Arrondir à une valeur "propre"
  const niceValues = [100, 200, 500, 1000, 2000, 5000, 10000, 20000, 50000, 100000];
  let niceValue = niceValues[0];
  for (const v of niceValues) {
    if (v <= scaleBarWidthMeters * 1.2) {
      niceValue = v;
    }
  }
  
  // Formater
  if (niceValue >= 1000) {
    return `${niceValue / 1000} km`;
  }
  return `${niceValue} m`;
}
