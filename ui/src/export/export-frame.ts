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
  margin: 15,
  titleHeight: 50,
  subtitleHeight: 20,
  legendWidth: 180,
  legendMinHeight: 100,
  cartoucheHeight: 80,
  coordLabelMargin: 8,
  padding: 10
};

// ============================================================================
// Création du layout
// ============================================================================

export function computeExportLayout(
  mapWidth: number,
  mapHeight: number,
  options: ExportOptions
): ExportFrameLayout {
  const { margin, titleHeight, subtitleHeight, legendWidth, cartoucheHeight, coordLabelMargin, padding } = LAYOUT;
  
  // Espace pour les labels de coordonnées
  const labelSpace = options.grid.showLabels ? 40 : 0;
  
  // Calcul des dimensions totales
  const totalWidth = margin * 2 + labelSpace * 2 + mapWidth;
  
  let headerHeight = 0;
  if (options.includeTitle) {
    headerHeight = titleHeight + (options.zone === 'adm-filtered' ? subtitleHeight : 0);
  }
  
  const footerHeight = cartoucheHeight + padding;
  const totalHeight = margin * 2 + headerHeight + labelSpace * 2 + mapHeight + footerHeight;
  
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
  
  // Zone légende (bas gauche, dans le footer)
  const legendArea = {
    x: margin,
    y: mapArea.y + mapArea.height + labelSpace + padding,
    width: legendWidth,
    height: cartoucheHeight - padding
  };
  
  // Zone cartouche (bas droit)
  const cartoucheArea = {
    x: totalWidth - margin - legendWidth - 100,
    y: mapArea.y + mapArea.height + labelSpace + padding,
    width: legendWidth + 100,
    height: cartoucheHeight - padding
  };
  
  return {
    totalWidth,
    totalHeight,
    titleArea,
    mapArea,
    legendArea,
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
  
  constructor(
    mapWidth: number,
    mapHeight: number,
    options: ExportOptions
  ) {
    this.options = options;
    this.scale = QUALITY_SETTINGS[options.quality].scale;
    
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
      const date = new Date().toLocaleDateString('fr-FR');
      const subtitle = this.options.subtitle || `Zone : ${zonePath} – Export du ${date}`;
      
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
   */
  drawLegend(legendData?: ThematicLegendData): void {
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
    
    // Si pas de données de légende, afficher un placeholder
    if (!legendData || !legendData.classes || legendData.classes.length === 0) {
      ctx.font = '10px Arial, sans-serif';
      ctx.fillStyle = '#888888';
      ctx.fillText('(aucune thématique active)', legendArea.x + 8, legendArea.y + 25);
      return;
    }
    
    // Dessiner les classes
    const startY = legendArea.y + 24;
    const boxSize = 12;
    const lineHeight = 16;
    const textX = legendArea.x + 8 + boxSize + 6;
    
    ctx.font = '10px Arial, sans-serif';
    
    legendData.classes.forEach((cls, i) => {
      const y = startY + i * lineHeight;
      
      // Boîte de couleur
      ctx.fillStyle = cls.color;
      ctx.fillRect(legendArea.x + 8, y, boxSize, boxSize);
      ctx.strokeStyle = '#666666';
      ctx.lineWidth = 0.5;
      ctx.strokeRect(legendArea.x + 8, y, boxSize, boxSize);
      
      // Label
      ctx.fillStyle = '#333333';
      ctx.textBaseline = 'middle';
      ctx.fillText(cls.label, textX, y + boxSize / 2);
    });
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
