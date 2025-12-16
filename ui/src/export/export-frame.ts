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

const LAYOUT = {
  margin: 20,           // Marge extérieure
  titleHeight: 50,      // Hauteur titre principal
  subtitleHeight: 20,   // Hauteur sous-titre (zone)
  legendWidth: 160,     // Largeur zone légende (classes)
  statsWidth: 160,      // Largeur zone stats
  cartoucheWidth: 200,  // Largeur zone cartouche
  footerHeight: 150,    // Hauteur footer (augmentée)
  coordLabelMargin: 8,
  padding: 12
};

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
  options: ExportOptions
): ExportFrameLayout {
  const { margin, titleHeight, subtitleHeight, legendWidth, footerHeight, coordLabelMargin, padding } = LAYOUT;
  
  // Espace pour les labels de coordonnées
  const labelSpace = options.grid.showLabels ? 40 : 0;
  
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
  const footerContentHeight = LAYOUT.footerHeight - padding * 2;
  
  // Zone légende (bas gauche)
  const legendArea = {
    x: margin,
    y: footerY,
    width: LAYOUT.legendWidth,
    height: footerContentHeight
  };
  
  // Zone stats (milieu)
  const statsArea = {
    x: margin + LAYOUT.legendWidth + padding,
    y: footerY,
    width: LAYOUT.statsWidth,
    height: footerContentHeight
  };
  
  // Zone cartouche (bas droit)
  const cartoucheArea = {
    x: totalWidth - margin - LAYOUT.cartoucheWidth,
    y: footerY,
    width: LAYOUT.cartoucheWidth,
    height: footerContentHeight
  };
  
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
  
  constructor(
    mapWidth: number,
    mapHeight: number,
    options: ExportOptions
  ) {
    this.options = options;
    this.scale = QUALITY_SETTINGS[options.quality].scale;
    this.dpi = QUALITY_SETTINGS[options.quality].dpi;
    
    // Calculer le layout
    this.layout = computeExportLayout(mapWidth, mapHeight, options);
    
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
    
    // Calculer la zone carte disponible dans le layout A4
    const { margin, titleHeight, subtitleHeight, footerHeight, padding } = LAYOUT;
    const labelSpace = options.grid.showLabels ? 40 : 0;
    const headerHeight = options.includeTitle ? (titleHeight + subtitleHeight) : 0;
    
    // Zone disponible pour la carte
    const availableWidth = a4.width - (margin * 2) - (labelSpace * 2);
    const availableHeight = a4.height - (margin * 2) - headerHeight - footerHeight - (labelSpace * 2) - padding;
    
    console.log('[ExportFrame] Création A4 fixe:', {
      orientation,
      dpi,
      pageWidth: a4.width,
      pageHeight: a4.height,
      mapAreaWidth: availableWidth,
      mapAreaHeight: availableHeight
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
    
    // Titre principal
    ctx.fillStyle = '#1a1a1a';
    ctx.font = 'bold 18px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    
    const title = this.options.title || `Atlas Géotechnique – ${thematic.name}`;
    ctx.fillText(title, titleArea.x + titleArea.width / 2, titleArea.y + 5);
    
    // Sous-titre (zone + date)
    if (this.options.zone === 'adm-filtered' || this.options.subtitle) {
      ctx.font = '12px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      
      const zonePath = formatAdmPath(admFilters);
      const now = new Date();
      const date = now.toLocaleDateString('fr-FR');
      const time = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      const subtitle = this.options.subtitle || `Zone : ${zonePath} – Export du ${date} à ${time}`;
      
      ctx.fillText(subtitle, titleArea.x + titleArea.width / 2, titleArea.y + 30);
    }
  }
  
  /**
   * Dessine l'image de la carte capturée
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
    
    this.ctx.drawImage(img, mapArea.x, mapArea.y, mapArea.width, mapArea.height);
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
   * @param cells - Liste des mailles avec leur géométrie
   * @param bbox - Bounding box de la carte
   */
  drawEmptyCells(
    cells: Array<{ geometry: any; has_data: boolean }>,
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
    
    ctx.save();
    ctx.fillStyle = 'rgba(200, 200, 200, 0.3)'; // Gris clair semi-transparent
    ctx.strokeStyle = 'rgba(150, 150, 150, 0.5)';
    ctx.lineWidth = 0.5;
    
    for (const cell of cells) {
      // Ne dessiner que les mailles SANS données
      if (cell.has_data) continue;
      
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
    console.log('[ExportFrame] Empty cells drawn:', cells.filter(c => !c.has_data).length);
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
    
    // Dessiner la grille
    renderGrid({
      ctx: this.ctx,
      mapArea,
      gridOutput,
      gridType: grid.type,
      showLabels: grid.showLabels,
      labelSides: grid.labelSides,
      labelMargin: coordLabelMargin
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
   */
  drawLegend(legendData?: ThematicLegendData, showEmptyCells: boolean = false, showAdmBoundary: boolean = false): void {
    if (!this.options.includeLegend) return;
    
    const { legendArea } = this.layout;
    const ctx = this.ctx;
    
    // Cadre de la légende
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(legendArea.x, legendArea.y, legendArea.width, legendArea.height);
    ctx.strokeRect(legendArea.x, legendArea.y, legendArea.width, legendArea.height);
    
    // Titre de la légende (paramètre + unité)
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 11px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    
    const legendTitle = legendData 
      ? `${legendData.parameterLabel}${legendData.unit ? ` (${legendData.unit})` : ''}`
      : 'Légende';
    ctx.fillText(legendTitle, legendArea.x + 8, legendArea.y + 6);
    
    const boxSize = 12;
    const lineHeight = 16;
    const textX = legendArea.x + 8 + boxSize + 6;
    let currentY = legendArea.y + 24;
    
    ctx.font = '10px Arial, sans-serif';
    
    // Si pas de données de légende, afficher un placeholder
    if (!legendData || !legendData.classes || legendData.classes.length === 0) {
      ctx.fillStyle = '#888888';
      ctx.fillText('(aucune thématique active)', legendArea.x + 8, currentY);
      currentY += lineHeight;
    } else {
      // Filtrer les classes pour n'afficher que celles avec des mailles (count > 0)
      // Si count n'est pas défini, on affiche la classe (compatibilité)
      const visibleClasses = legendData.classes.filter(cls => 
        cls.count === undefined || cls.count > 0
      );
      
      console.log('[ExportFrame] Légende - classes visibles:', visibleClasses.length, '/', legendData.classes.length);
      
      if (visibleClasses.length === 0) {
        ctx.fillStyle = '#888888';
        ctx.fillText('(aucune donnée dans la zone)', legendArea.x + 8, currentY);
        currentY += lineHeight;
      } else {
        // Dessiner les classes thématiques présentes
        visibleClasses.forEach((cls) => {
          // Boîte de couleur
          ctx.fillStyle = cls.color;
          ctx.fillRect(legendArea.x + 8, currentY, boxSize, boxSize);
          ctx.strokeStyle = '#666666';
          ctx.lineWidth = 0.5;
          ctx.strokeRect(legendArea.x + 8, currentY, boxSize, boxSize);
          
          // Label
          ctx.fillStyle = '#333333';
          ctx.textBaseline = 'middle';
          ctx.fillText(cls.label, textX, currentY + boxSize / 2);
          currentY += lineHeight;
        });
      }
    }
    
    // Ajouter une séparation si on a des entrées supplémentaires
    if (showEmptyCells || showAdmBoundary) {
      currentY += 4; // Petit espace
    }
    
    // Entrée "Mailles sans données" si activée
    if (showEmptyCells) {
      ctx.fillStyle = 'rgba(200, 200, 200, 0.5)';
      ctx.fillRect(legendArea.x + 8, currentY, boxSize, boxSize);
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.8)';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(legendArea.x + 8, currentY, boxSize, boxSize);
      
      ctx.fillStyle = '#333333';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sans données', textX, currentY + boxSize / 2);
      currentY += lineHeight;
    }
    
    // Entrée "Délimitation ADM" si activée
    if (showAdmBoundary) {
      // Dessiner une ligne pointillée bleue
      ctx.beginPath();
      ctx.setLineDash([3, 2]);
      ctx.strokeStyle = '#3366cc';
      ctx.lineWidth = 2;
      ctx.moveTo(legendArea.x + 8, currentY + boxSize / 2);
      ctx.lineTo(legendArea.x + 8 + boxSize, currentY + boxSize / 2);
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
    
    // Cadre du cartouche
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(cartoucheArea.x, cartoucheArea.y, cartoucheArea.width, cartoucheArea.height);
    ctx.strokeRect(cartoucheArea.x, cartoucheArea.y, cartoucheArea.width, cartoucheArea.height);
    
    const textX = cartoucheArea.x + 10;
    let textY = cartoucheArea.y + 10;
    const lineHeight = 12;
    
    ctx.fillStyle = '#333333';
    ctx.font = '9px Arial, sans-serif';
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
    
    // Barre d'échelle (à droite du cartouche)
    if (this.options.includeScaleBar) {
      this.drawScaleBar(
        cartoucheArea.x + cartoucheArea.width - 100,
        cartoucheArea.y + cartoucheArea.height - 25,
        scaleText
      );
    }
    
    // Flèche du Nord
    if (this.options.includeNorthArrow) {
      this.drawNorthArrow(
        cartoucheArea.x + cartoucheArea.width - 30,
        cartoucheArea.y + 25
      );
    }
  }
  
  /**
   * Dessine la barre d'échelle
   */
  private drawScaleBar(x: number, y: number, scaleText: string): void {
    const ctx = this.ctx;
    const barWidth = 80;
    const barHeight = 6;
    
    // Barre
    ctx.fillStyle = '#000000';
    ctx.fillRect(x, y, barWidth / 2, barHeight);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(x + barWidth / 2, y, barWidth / 2, barHeight);
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 1;
    ctx.strokeRect(x, y, barWidth, barHeight);
    
    // Graduations
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x, y - 3);
    ctx.moveTo(x + barWidth / 2, y);
    ctx.lineTo(x + barWidth / 2, y - 3);
    ctx.moveTo(x + barWidth, y);
    ctx.lineTo(x + barWidth, y - 3);
    ctx.stroke();
    
    // Label
    ctx.fillStyle = '#333333';
    ctx.font = '9px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(scaleText, x + barWidth / 2, y + barHeight + 2);
  }
  
  /**
   * Dessine la flèche du Nord
   */
  private drawNorthArrow(x: number, y: number): void {
    const ctx = this.ctx;
    const size = 20;
    
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
   * Dessine le bloc de statistiques
   */
  drawStats(stats?: ExportStats): void {
    if (!this.options.includeStats || !stats) return;
    
    const { statsArea } = this.layout;
    const ctx = this.ctx;
    
    const padding = 6;
    const headerHeight = 18;
    const lineHeight = 12;
    
    // Cadre principal
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = 1;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(statsArea.x, statsArea.y, statsArea.width, statsArea.height);
    ctx.strokeRect(statsArea.x, statsArea.y, statsArea.width, statsArea.height);
    
    // Titre
    ctx.fillStyle = '#333333';
    ctx.font = 'bold 9px Arial, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(stats.title, statsArea.x + padding, statsArea.y + padding);
    
    // Sous-titre (zone)
    if (stats.subtitle) {
      ctx.font = '8px Arial, sans-serif';
      ctx.fillStyle = '#666666';
      ctx.fillText(stats.subtitle, statsArea.x + padding, statsArea.y + padding + 10);
    }
    
    // Lignes de stats principales
    ctx.font = '8px Arial, sans-serif';
    let y = statsArea.y + headerHeight + padding;
    
    for (const row of stats.rows) {
      ctx.fillStyle = '#555555';
      ctx.fillText(row.label + ' :', statsArea.x + padding, y);
      
      ctx.fillStyle = '#333333';
      const valueText = row.unit ? `${row.value} ${row.unit}` : row.value;
      ctx.textAlign = 'right';
      ctx.fillText(valueText, statsArea.x + statsArea.width - padding, y);
      ctx.textAlign = 'left';
      
      y += lineHeight;
    }
    
    // Contexte multi-niveaux (parent_context)
    if (stats.contextRows && stats.contextRows.length > 0) {
      y += 4; // Petit espace
      
      // Ligne de séparation
      ctx.strokeStyle = '#dddddd';
      ctx.beginPath();
      ctx.moveTo(statsArea.x + padding, y);
      ctx.lineTo(statsArea.x + statsArea.width - padding, y);
      ctx.stroke();
      y += 6;
      
      // Titre contexte
      ctx.fillStyle = '#666666';
      ctx.font = 'bold 8px Arial, sans-serif';
      ctx.fillText('Contexte', statsArea.x + padding, y);
      y += lineHeight;
      
      // Lignes de contexte
      ctx.font = '8px Arial, sans-serif';
      for (const row of stats.contextRows) {
        ctx.fillStyle = '#666666';
        ctx.fillText(row.label + ' :', statsArea.x + padding, y);
        
        ctx.fillStyle = '#444444';
        const valueText = row.unit ? `${row.value} ${row.unit}` : row.value;
        ctx.textAlign = 'right';
        ctx.fillText(valueText, statsArea.x + statsArea.width - padding, y);
        ctx.textAlign = 'left';
        
        y += lineHeight;
      }
    }
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
