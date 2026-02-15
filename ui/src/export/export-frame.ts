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
import { buildExportStats } from './export-stats';
import { getAdm1HaloStyle, getStrokeStyle } from './export-style';
import { APP_VERSION } from '../version';

// ============================================================================
// Constantes de layout EN MILLIMÈTRES
// ============================================================================

/**
 * Layout défini en MILLIMÈTRES (taille physique constante)
 * Le DPI sert à la NETTETÉ, pas à grossir le design.
 * À 150 et 300 DPI, les cartouches ont la MÊME taille physique.
 */
const LAYOUT_MM = {
  margin: 5,              // 5mm marge extérieure
  titleHeight: 12,        // 12mm hauteur titre
  subtitleHeight: 5,      // 5mm sous-titre
  legendWidth: 45,        // 45mm largeur légende
  statsWidth: 35,         // 35mm largeur stats (réduit)
  cartoucheWidth: 55,     // 55mm largeur cartouche
  footerHeight: 42,       // 42mm hauteur footer
  coordLabelMargin: 2,    // 2mm marge labels coordonnées
  padding: 3,             // 3mm padding interne
  // Polices en mm (taille physique)
  fontTitle: 4.5,         // 4.5mm ≈ 13pt
  fontSubtitle: 3.2,      // 3.2mm ≈ 9pt
  fontLegend: 2.5,        // 2.5mm ≈ 7pt
  fontLegendTitle: 2.8,   // 2.8mm ≈ 8pt
  fontStats: 2.5,         // 2.5mm ≈ 7pt (aligner sur légende)
  fontCartouche: 2.0,     // 2.0mm ≈ 6pt
  fontCoordLabel: 2.0,    // 2.0mm ≈ 6pt
  // Épaisseurs de traits en mm
  borderWidth: 0.2,       // 0.2mm trait fin
  boxBorderWidth: 0.15    // 0.15mm bordure boîtes
};

/**
 * Convertit des millimètres en pixels pour un DPI donné
 * Formule: px = mm * dpi / 25.4
 */
function mmToPx(mm: number, dpi: number): number {
  return Math.round(mm * dpi / 25.4);
}

// Pour compatibilité avec le code existant (72 dpi)
const LAYOUT_BASE = {
  margin: 20,
  titleHeight: 50,
  subtitleHeight: 20,
  legendWidth: 180,
  statsWidth: 180,
  cartoucheWidth: 220,
  footerHeight: 170,
  coordLabelMargin: 8,
  padding: 12
};
const LAYOUT = LAYOUT_BASE;

/**
 * Calcule les dimensions de layout en pixels à partir des mm
 * Le DPI augmente la netteté, pas la taille visuelle
 */
function getScaledLayout(dpi: number) {
  return {
    margin: mmToPx(LAYOUT_MM.margin, dpi),
    titleHeight: mmToPx(LAYOUT_MM.titleHeight, dpi),
    subtitleHeight: mmToPx(LAYOUT_MM.subtitleHeight, dpi),
    legendWidth: mmToPx(LAYOUT_MM.legendWidth, dpi),
    statsWidth: mmToPx(LAYOUT_MM.statsWidth, dpi),
    cartoucheWidth: mmToPx(LAYOUT_MM.cartoucheWidth, dpi),
    footerHeight: mmToPx(LAYOUT_MM.footerHeight, dpi),
    coordLabelMargin: mmToPx(LAYOUT_MM.coordLabelMargin, dpi),
    padding: mmToPx(LAYOUT_MM.padding, dpi),
    // Tailles de police en pixels (basées sur mm)
    fontTitle: mmToPx(LAYOUT_MM.fontTitle, dpi),
    fontSubtitle: mmToPx(LAYOUT_MM.fontSubtitle, dpi),
    fontLegend: mmToPx(LAYOUT_MM.fontLegend, dpi),
    fontLegendTitle: mmToPx(LAYOUT_MM.fontLegendTitle, dpi),
    fontStats: mmToPx(LAYOUT_MM.fontStats, dpi),
    fontCartouche: mmToPx(LAYOUT_MM.fontCartouche, dpi),
    fontCoordLabel: mmToPx(LAYOUT_MM.fontCoordLabel, dpi),
    // Épaisseurs de traits
    borderWidth: mmToPx(LAYOUT_MM.borderWidth, dpi),
    boxBorderWidth: mmToPx(LAYOUT_MM.boxBorderWidth, dpi)
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
  private dpi: number;
  private scale: number;
  private fonts: ReturnType<typeof getScaledLayout>;
  private options: ExportOptions;

  static createA4(options: ExportOptions, orientation: 'portrait' | 'landscape' = 'portrait'): ExportFrame {
    const dpi = QUALITY_SETTINGS[options.quality].dpi
    const { mapArea } = getA4Layout(dpi, orientation)
    return new ExportFrame(mapArea.width, mapArea.height, options)
  }

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

  // ...

  private clamp01(n: number): number {
    if (!Number.isFinite(n)) return 0
    return Math.max(0, Math.min(1, n))
  }

  private parseCssColor(
    input: string
  ):
    | { r: number; g: number; b: number; a: number; format: 'hex' | 'rgba' }
    | null {
    const s = (input || '').trim()
    if (!s) return null

    // Hex: #RGB, #RRGGBB, #RRGGBBAA
    const hexMatch = /^#?([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i.exec(s)
    if (hexMatch) {
      const v = hexMatch[1]
      const expand3 = (h: string) => `${h[0]}${h[0]}${h[1]}${h[1]}${h[2]}${h[2]}`
      const hex6 = v.length === 3 ? expand3(v) : v.slice(0, 6)
      const r = parseInt(hex6.slice(0, 2), 16)
      const g = parseInt(hex6.slice(2, 4), 16)
      const b = parseInt(hex6.slice(4, 6), 16)
      if (![r, g, b].every(Number.isFinite)) return null

      let a = 1
      if (v.length === 8) {
        const aa = parseInt(v.slice(6, 8), 16)
        if (Number.isFinite(aa)) a = this.clamp01(aa / 255)
      }
      return { r, g, b, a, format: a < 1 ? 'rgba' : 'hex' }
    }

    // rgb()/rgba()
    const rgbMatch = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i.exec(s)
    if (rgbMatch) {
      const r = Number(rgbMatch[1])
      const g = Number(rgbMatch[2])
      const b = Number(rgbMatch[3])
      const a = rgbMatch[4] != null ? Number(rgbMatch[4]) : 1
      if (![r, g, b, a].every(Number.isFinite)) return null
      return {
        r: Math.max(0, Math.min(255, r)),
        g: Math.max(0, Math.min(255, g)),
        b: Math.max(0, Math.min(255, b)),
        a: this.clamp01(a),
        format: this.clamp01(a) < 1 ? 'rgba' : 'hex'
      }
    }

    return null
  }

  private rgbToHex(r: number, g: number, b: number): string {
    const toHex = (x: number) => Math.max(0, Math.min(255, Math.round(x))).toString(16).padStart(2, '0')
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`
  }

  private rgbToRgbaString(r: number, g: number, b: number, a: number): string {
    const rr = Math.max(0, Math.min(255, Math.round(r)))
    const gg = Math.max(0, Math.min(255, Math.round(g)))
    const bb = Math.max(0, Math.min(255, Math.round(b)))
    const aa = this.clamp01(a)
    return `rgba(${rr}, ${gg}, ${bb}, ${aa})`
  }

  private rgbToHsl(r: number, g: number, b: number): { h: number; s: number; l: number } {
    const rn = r / 255
    const gn = g / 255
    const bn = b / 255
    const max = Math.max(rn, gn, bn)
    const min = Math.min(rn, gn, bn)
    let h = 0
    let s = 0
    const l = (max + min) / 2

    if (max !== min) {
      const d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      switch (max) {
        case rn:
          h = (gn - bn) / d + (gn < bn ? 6 : 0)
          break
        case gn:
          h = (bn - rn) / d + 2
          break
        case bn:
          h = (rn - gn) / d + 4
          break
      }
      h = h / 6
    }

    return { h: this.clamp01(h), s: this.clamp01(s), l: this.clamp01(l) }
  }

  private hslToRgb(h: number, s: number, l: number): { r: number; g: number; b: number } {
    const hue2rgb = (p: number, q: number, t: number) => {
      let tt = t
      if (tt < 0) tt += 1
      if (tt > 1) tt -= 1
      if (tt < 1 / 6) return p + (q - p) * 6 * tt
      if (tt < 1 / 2) return q
      if (tt < 2 / 3) return p + (q - p) * (2 / 3 - tt) * 6
      return p
    }

    const hh = this.clamp01(h)
    const ss = this.clamp01(s)
    const ll = this.clamp01(l)

    if (ss === 0) {
      const v = ll * 255
      return { r: v, g: v, b: v }
    }

    const q = ll < 0.5 ? ll * (1 + ss) : ll + ss - ll * ss
    const p = 2 * ll - q
    const r = hue2rgb(p, q, hh + 1 / 3) * 255
    const g = hue2rgb(p, q, hh) * 255
    const b = hue2rgb(p, q, hh - 1 / 3) * 255
    return { r, g, b }
  }

  private getExportPaletteEnhanceConfig(): any {
    const cfg = (window as any).__EXPORT_PALETTE_ENHANCE
    if (!cfg || typeof cfg !== 'object') return null
    if (cfg.enabled === false) return null
    return cfg
  }

  private enhanceExportColor(color: string): string {
    const cfg = this.getExportPaletteEnhanceConfig()
    if (!cfg) return color
    const parsed = this.parseCssColor(color)
    if (!parsed) return color

    const satMultiplier = Number.isFinite(cfg.satMultiplier) ? Number(cfg.satMultiplier) : 1
    const minSaturation = Number.isFinite(cfg.minSaturation) ? Number(cfg.minSaturation) : 0
    const lightnessMultiplier = Number.isFinite(cfg.lightnessMultiplier) ? Number(cfg.lightnessMultiplier) : 1
    const gammaContrast = Number.isFinite(cfg.gammaContrast) ? Number(cfg.gammaContrast) : 1

    const hsl = this.rgbToHsl(parsed.r, parsed.g, parsed.b)
    let s = hsl.s
    let l = hsl.l

    s = Math.max(minSaturation, s * satMultiplier)
    l = l * lightnessMultiplier
    l = 0.5 + (l - 0.5) * gammaContrast

    const out = this.hslToRgb(hsl.h, this.clamp01(s), this.clamp01(l))
    if (parsed.a < 1 || parsed.format === 'rgba') {
      return this.rgbToRgbaString(out.r, out.g, out.b, parsed.a)
    }
    return this.rgbToHex(out.r, out.g, out.b)
  }

  private enhanceExportClasses(
    classes: Array<{ min: number | null; max: number | null; color: string; label: string }>
  ): Array<{ min: number | null; max: number | null; color: string; label: string }> {
    const cfg = this.getExportPaletteEnhanceConfig()
    if (!cfg) return classes

    const enhanced = classes.map((c) => ({ ...c, color: this.enhanceExportColor(c.color) }))

    const sampleBefore = classes.slice(0, 6).map((c) => c.color)
    const sampleAfter = enhanced.slice(0, 6).map((c) => c.color)
    console.log('[ExportPalette] enhance classes:', {
      cfg: {
        enabled: cfg.enabled,
        satMultiplier: cfg.satMultiplier,
        minSaturation: cfg.minSaturation,
        lightnessMultiplier: cfg.lightnessMultiplier,
        gammaContrast: cfg.gammaContrast
      },
      sampleBefore,
      sampleAfter
    })

    return enhanced
  }

  wrapText(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
    if (!text) return ['']
    const words = text.split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const testWidth = ctx.measureText(testLine).width
      if (testWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }

    if (currentLine) lines.push(currentLine)
    return lines.length > 0 ? lines : [text]
  }

  drawTitle(thematic: ActiveThematic, admFilters?: ActiveAdmFilters): void {
    if (!this.options.includeTitle) return
    const { titleArea } = this.layout
    const ctx = this.ctx
    const scale = this.dpi / 72

    const title = this.options.title || `Atlas Géotechnique - ${thematic.name}`
    const now = new Date()
    const exportDate = now.toLocaleDateString('fr-FR')
    const exportTime = now.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })

    ctx.save()
    ctx.fillStyle = '#111827'
    ctx.font = `bold ${this.fonts.fontTitle}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'top'

    const titleY = titleArea.y + Math.round(5 * this.dpi / 72)
    ctx.fillText(title, titleArea.x + titleArea.width / 2, titleY)

    if (this.options.zone === 'adm-filtered') {
      const zoneLabel = admFilters ? formatAdmPath(admFilters) : ''
      const defaultSubtitle = zoneLabel ? `Zone : ${zoneLabel} – Export du ${exportDate} à ${exportTime}` : ''
      const sub = this.options.subtitle || defaultSubtitle
      if (sub) {
        ctx.fillStyle = '#4b5563'
        ctx.font = `${this.fonts.fontSubtitle}px Arial, sans-serif`
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        const subtitleY = titleArea.y + Math.round(5 * scale) + Math.round(this.fonts.fontTitle * 1.1)
        ctx.fillText(sub, titleArea.x + titleArea.width / 2, subtitleY)
      }
    }

    ctx.restore()

    console.log('[ExportFrame][TITLE] effective', {
      title,
      subtitle:
        this.options.zone === 'adm-filtered'
          ? (this.options.subtitle || (admFilters ? formatAdmPath(admFilters) : ''))
          : this.options.subtitle,
      zone: this.options.zone,
      exportDate,
      exportTime
    })
  }

  async drawMapImage(mapCanvas: HTMLCanvasElement): Promise<void> {
    const { mapArea } = this.layout
    const ctx = this.ctx
    if (!mapCanvas) return

    ctx.save()
    ctx.globalAlpha = 1
    ctx.globalCompositeOperation = 'source-over'
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(mapCanvas, mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.restore()
  }

  drawEmptyCells(cells: Array<{ geometry: any; has_data: boolean }>, bbox: BBox): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const scale = this.dpi / 72
    const emptyCells = (cells || []).filter((c) => !c?.has_data)
    if (emptyCells.length === 0) return

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.clip()

    // Réduire l'effet de filtre gris : opacité ÷2
    ctx.fillStyle = 'rgba(210, 210, 210, 0.175)'
    ctx.strokeStyle = 'rgba(140, 140, 140, 0.11)'
    ctx.lineWidth = 0.35 * scale

    console.log('[ExportFrame][EMPTY_CELLS] style', {
      fillStyle: ctx.fillStyle,
      strokeStyle: ctx.strokeStyle,
      lineWidth: ctx.lineWidth,
      count: emptyCells.length
    })

    for (const cell of emptyCells) {
      const geom = cell?.geometry
      if (!geom || geom.type !== 'Polygon') continue
      const coords = geom.coordinates?.[0]
      if (!coords || coords.length < 3) continue

      ctx.beginPath()
      const [sx, sy] = toPixel(coords[0][0], coords[0][1])
      ctx.moveTo(sx, sy)
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1])
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.fill()
      ctx.stroke()
    }

    ctx.restore()
  }

  drawCellBoundaries(
    cells: Array<{ geometry: any }>,
    bbox: BBox,
    layerType: 'grid2' | 'grid28' = 'grid2'
  ): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const style = getStrokeStyle(layerType, this.dpi)

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.clip()

    ctx.globalAlpha = typeof style.globalAlpha === 'number' ? style.globalAlpha : 1
    ctx.strokeStyle = style.strokeStyle
    ctx.lineWidth = style.lineWidth
    ctx.lineJoin = style.lineJoin || 'miter'
    ctx.lineCap = style.lineCap || 'butt'
    ctx.setLineDash(style.lineDash || [])

    for (const cell of cells || []) {
      const geom = (cell as any)?.geometry
      if (!geom || geom.type !== 'Polygon') continue
      const coords = geom.coordinates?.[0]
      if (!coords || coords.length < 3) continue

      ctx.beginPath()
      const [sx, sy] = toPixel(coords[0][0], coords[0][1])
      ctx.moveTo(sx, sy)
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1])
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    ctx.restore()
  }

  drawGridOverlayLines(features: any[], bbox: BBox, layerType: 'grid28' | 'grid2' = 'grid28'): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const style = getStrokeStyle(layerType, this.dpi)

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    const drawLineCoords = (coords: any[]) => {
      if (!Array.isArray(coords) || coords.length < 2) return
      ctx.beginPath()
      const [sx, sy] = toPixel(coords[0][0], coords[0][1])
      ctx.moveTo(sx, sy)
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1])
        ctx.lineTo(x, y)
      }
      ctx.stroke()
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.clip()

    ctx.globalAlpha = typeof style.globalAlpha === 'number' ? style.globalAlpha : 1
    ctx.strokeStyle = style.strokeStyle
    ctx.lineWidth = style.lineWidth
    ctx.lineJoin = style.lineJoin || 'miter'
    ctx.lineCap = style.lineCap || 'butt'
    ctx.setLineDash(style.lineDash || [])

    for (const f of features || []) {
      const g = f?.geometry || f
      if (!g || !g.type) continue
      if (g.type === 'LineString') {
        drawLineCoords(g.coordinates)
      } else if (g.type === 'MultiLineString') {
        for (const part of g.coordinates || []) drawLineCoords(part)
      }
    }

    ctx.restore()
  }

  drawAdmBoundary(
    admPolygon: Array<[number, number]> | number[][] | null | undefined,
    bbox: BBox,
    color: string = '#000000',
    width: number = 2
  ): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const scale = this.dpi / 72

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    if (!admPolygon || admPolygon.length < 3) return

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.clip()

    ctx.strokeStyle = color
    ctx.lineWidth = width * scale
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash([])

    ctx.beginPath()
    const [sx, sy] = toPixel((admPolygon[0] as any)[0], (admPolygon[0] as any)[1])
    ctx.moveTo(sx, sy)
    for (let i = 1; i < admPolygon.length; i++) {
      const [x, y] = toPixel((admPolygon[i] as any)[0], (admPolygon[i] as any)[1])
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()

    ctx.restore()
  }

  drawAdmMask(admPolygon: Array<[number, number]> | number[][] | null | undefined, bbox: BBox, mode: 'context' | 'focus' | 'clip'): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const scale = this.dpi / 72

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    if (!admPolygon || admPolygon.length < 3) return

    const alpha = mode === 'clip' ? 1 : mode === 'focus' ? 0.72 : 0.55

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    for (let i = 0; i < admPolygon.length; i++) {
      const [lng, lat] = admPolygon[i] as any
      const [x, y] = toPixel(lng, lat)
      if (i === 0) ctx.moveTo(x, y)
      else ctx.lineTo(x, y)
    }
    ctx.closePath()

    ctx.fillStyle = `rgba(255, 255, 255, ${alpha})`
    ctx.fill('evenodd')

    ctx.strokeStyle = '#3366cc'
    ctx.lineWidth = 2.2 * scale
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'
    ctx.setLineDash([])
    ctx.beginPath()
    const [sx, sy] = toPixel((admPolygon[0] as any)[0], (admPolygon[0] as any)[1])
    ctx.moveTo(sx, sy)
    for (let i = 1; i < admPolygon.length; i++) {
      const [x, y] = toPixel((admPolygon[i] as any)[0], (admPolygon[i] as any)[1])
      ctx.lineTo(x, y)
    }
    ctx.closePath()
    ctx.stroke()

    ctx.restore()
  }

  drawGridAndFrame(bbox: BBox): void {
    const { mapArea, coordLabelMargin } = this.layout
    const ctx = this.ctx
    const gridOutput = generateGridLines({
      bbox,
      mapWidth: mapArea.width,
      mapHeight: mapArea.height,
      options: this.options.grid
    })

    renderGrid({
      ctx,
      mapArea,
      gridOutput,
      gridType: this.options.grid.type,
      showLabels: this.options.grid.showLabels,
      labelSides: this.options.grid.labelSides,
      labelMargin: coordLabelMargin,
      dpi: this.dpi
    })

    renderFrame({
      ctx,
      mapArea,
      style: this.options.frameStyle,
      color: '#111827',
      thickness: Math.max(1, Math.round((this.dpi / 72) * 1.6))
    } as any)
  }

  drawCartouche(scaleText: string, admFilters?: ActiveAdmFilters): void {
    const { cartoucheArea } = this.layout
    const ctx = this.ctx
    const scale = this.dpi / 72
    const padding = Math.round(8 * scale)
    const lineHeight = Math.round(12 * scale)
    const innerWidth = cartoucheArea.width - padding * 2

    ctx.save()
    ctx.strokeStyle = '#cccccc'
    ctx.lineWidth = scale
    ctx.fillStyle = '#fafafa'
    ctx.fillRect(cartoucheArea.x, cartoucheArea.y, cartoucheArea.width, cartoucheArea.height)
    ctx.strokeRect(cartoucheArea.x, cartoucheArea.y, cartoucheArea.width, cartoucheArea.height)

    ctx.fillStyle = '#111827'
    ctx.font = `bold ${this.fonts.fontCartouche}px Arial, sans-serif`
    ctx.textAlign = 'left'
    ctx.textBaseline = 'top'

    let y = cartoucheArea.y + padding
    const srcLine = `Source : Atlas Géotechnique ${APP_VERSION}`
    const fondLine = 'Fond : © OpenStreetMap contributors'
    const scrLine = `SCR : WGS84 (${this.options.grid.scr})`
    const dataLine = 'Données : UTM 31N (EPSG:25231)'
    const dateStr = new Date().toLocaleDateString('fr-FR')

    ctx.fillText(srcLine, cartoucheArea.x + padding, y)
    y += lineHeight
    ctx.fillStyle = '#374151'
    ctx.font = `${this.fonts.fontCartouche}px Arial, sans-serif`
    ctx.fillText(fondLine, cartoucheArea.x + padding, y)
    y += lineHeight

    if (this.options.includeScrInfo) {
      ctx.fillText(scrLine, cartoucheArea.x + padding, y)
      y += lineHeight
    }

    ctx.fillText(dataLine, cartoucheArea.x + padding, y)
    y += Math.round(lineHeight * 1.1)

    ctx.fillText(`Date : ${dateStr}`, cartoucheArea.x + padding, y)
    y += Math.round(lineHeight * 1.1)

    // Zone (si présente) en plus petit
    // (Disposition ancienne) : pas d'affichage de zone dans le cartouche

    // Barre d'échelle (option)
    if (this.options.includeScaleBar && scaleText) {
      const barW = Math.min(innerWidth * 0.78, Math.round(150 * scale))
      const barH = Math.round(8 * scale)
      const barX = cartoucheArea.x + Math.round((cartoucheArea.width - barW) / 2)
      const barY = cartoucheArea.y + cartoucheArea.height - padding - barH - Math.round(10 * scale)

      ctx.fillStyle = '#000000'
      ctx.fillRect(barX, barY, Math.round(barW / 2), barH)
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(barX + Math.round(barW / 2), barY, Math.round(barW / 2), barH)
      ctx.strokeStyle = '#000000'
      ctx.lineWidth = Math.max(1, Math.round(1 * scale))
      ctx.strokeRect(barX, barY, barW, barH)

      ctx.fillStyle = '#111827'
      ctx.font = `${Math.max(9, Math.round(this.fonts.fontCartouche * 0.95))}px Arial, sans-serif`
      ctx.textBaseline = 'top'
      ctx.textAlign = 'center'
      ctx.fillText(scaleText, barX + barW / 2, barY + barH + Math.round(2 * scale))
      ctx.textAlign = 'left'
    }

    // Flèche du Nord (option)
    if (this.options.includeNorthArrow) {
      const nx = cartoucheArea.x + cartoucheArea.width - padding - Math.round(18 * scale)
      const ny = cartoucheArea.y + padding + Math.round(8 * scale)
      const radius = Math.round(16 * scale)

      // Compass rose (étoilé) 8 branches, alternance noir/blanc
      ctx.save()
      ctx.translate(nx, ny)
      ctx.lineWidth = Math.max(1, Math.round(1 * scale))
      ctx.strokeStyle = '#111827'

      const drawTriangle = (angleRad: number, r1: number, r2: number, fill: string) => {
        const a = angleRad
        const a1 = a - Math.PI / 16
        const a2 = a + Math.PI / 16
        ctx.beginPath()
        ctx.moveTo(Math.cos(a) * r2, Math.sin(a) * r2)
        ctx.lineTo(Math.cos(a1) * r1, Math.sin(a1) * r1)
        ctx.lineTo(Math.cos(a2) * r1, Math.sin(a2) * r1)
        ctx.closePath()
        ctx.fillStyle = fill
        ctx.fill()
        ctx.stroke()
      }

      for (let i = 0; i < 8; i++) {
        const ang = (-Math.PI / 2) + (i * Math.PI) / 4
        const isCardinal = i % 2 === 0
        const r2 = isCardinal ? radius * 1.35 : radius * 0.95
        const r1 = radius * 0.25
        const fill = isCardinal ? '#111827' : '#ffffff'
        drawTriangle(ang, r1, r2, fill)
      }

      // Cercle central
      ctx.beginPath()
      ctx.fillStyle = '#ffffff'
      ctx.arc(0, 0, Math.max(2, Math.round(2.4 * scale)), 0, Math.PI * 2)
      ctx.fill()
      ctx.stroke()

      ctx.restore()
    }

    ctx.restore()

    console.log('[ExportFrame][CARTOUCHE] layout', {
      cartoucheArea,
      includeScrInfo: this.options.includeScrInfo,
      includeScaleBar: this.options.includeScaleBar,
      includeNorthArrow: this.options.includeNorthArrow,
      lines: { srcLine, fondLine, scrLine, dataLine, dateStr },
      scaleText,
      innerWidth,
      padding,
      lineHeight
    })
  }

  drawAdmBoundaries(features: any[], bbox: BBox, level: 'adm1' | 'adm2'): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const style = getStrokeStyle(level, this.dpi)

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    const drawRing = (ring: any[]) => {
      if (!Array.isArray(ring) || ring.length < 3) return
      ctx.beginPath()
      const [sx, sy] = toPixel(ring[0][0], ring[0][1])
      ctx.moveTo(sx, sy)
      for (let i = 1; i < ring.length; i++) {
        const [x, y] = toPixel(ring[i][0], ring[i][1])
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.clip()

    ctx.globalAlpha = typeof style.globalAlpha === 'number' ? style.globalAlpha : 1
    ctx.strokeStyle = style.strokeStyle
    ctx.lineWidth = style.lineWidth
    ctx.lineJoin = style.lineJoin || 'round'
    ctx.lineCap = style.lineCap || 'round'
    ctx.setLineDash(style.lineDash || [])

    for (const f of features || []) {
      const geom = f?.geometry
      if (!geom || !geom.type) continue
      if (geom.type === 'Polygon') {
        for (const ring of geom.coordinates || []) drawRing(ring)
      } else if (geom.type === 'MultiPolygon') {
        for (const poly of geom.coordinates || []) {
          for (const ring of poly || []) drawRing(ring)
        }
      }
    }

    ctx.restore()
  }

  drawNeighborLabels(
    neighbors: Array<{ label: string; direction: string; lon: number; lat: number }>,
    bbox: BBox,
    _admPolygon?: Array<[number, number]> | number[][] | null
  ): void {
    const { mapArea } = this.layout
    const ctx = this.ctx
    const scale = this.dpi / 72
    if (!neighbors || neighbors.length === 0) return

    const toPixel = (lng: number, lat: number): [number, number] => {
      const x = mapArea.x + ((lng - bbox.minX) / (bbox.maxX - bbox.minX)) * mapArea.width
      const y = mapArea.y + ((bbox.maxY - lat) / (bbox.maxY - bbox.minY)) * mapArea.height
      return [x, y]
    }

    ctx.save()
    ctx.beginPath()
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height)
    ctx.clip()

    ctx.font = `${Math.round(9 * scale)}px Arial, sans-serif`
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (const n of neighbors) {
      const [x, y] = toPixel(n.lon, n.lat)
      const text = n.label
      const pad = Math.round(3 * scale)
      const w = ctx.measureText(text).width
      const h = Math.round(12 * scale)

      ctx.fillStyle = 'rgba(255, 255, 255, 0.85)'
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.35)'
      ctx.lineWidth = Math.max(1, Math.round(0.8 * scale))
      ctx.beginPath()
      ctx.rect(x - w / 2 - pad, y - h / 2, w + pad * 2, h)
      ctx.fill()
      ctx.stroke()

      ctx.fillStyle = '#111827'
      ctx.fillText(text, x, y)
    }

    ctx.restore()
  }

  // ...

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

    const enhancedClasses = this.enhanceExportClasses(classes)

    // Fonction pour trouver la couleur d'une valeur selon les classes
    const getColorForValue = (value: number): { color: string; classIndex: number } => {
      for (let i = 0; i < enhancedClasses.length; i++) {
        const cls = enhancedClasses[i];
        const min = cls.min ?? -Infinity;
        const max = cls.max ?? Infinity;
        if (value >= min && value < max) {
          return { color: cls.color, classIndex: i };
        }
      }
      // Fallback: première classe ou gris
      return { color: enhancedClasses[0]?.color || '#cccccc', classIndex: 0 };
    };

    // Log détaillé du mapping valeur → classe → couleur (debug)
    const sampleMapping = withDataCells.slice(0, 10).map(c => {
      const v = c.value ?? c.n_sondages ?? 0;
      const { color, classIndex } = getColorForValue(v);
      const classLabel = enhancedClasses[classIndex]?.label || 'N/A';
      return { value: v, classIndex, classLabel, color };
    });

    console.log('[ExportFrame] drawColoredCells:', {
      totalCells: cells.length,
      withData: withDataCells.length,
      classCount: enhancedClasses.length,
      classes: enhancedClasses.map(c => ({ min: c.min, max: c.max, label: c.label, color: c.color })),
      sampleMapping
    });

    ctx.save();
    ctx.beginPath();
    ctx.rect(mapArea.x, mapArea.y, mapArea.width, mapArea.height);
    ctx.clip();
    // Pass 1: fill (et un stroke minimal pour éviter les gaps)
    ctx.lineWidth = 0.05 * scale;
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.02)';

    let drawnCount = 0;
    for (const cell of withDataCells) {
      const geom = cell.geometry;
      if (!geom || geom.type !== 'Polygon') continue;

      const coords = geom.coordinates?.[0];
      if (!coords || coords.length < 3) continue;

      // IMPORTANT: Utiliser cell.value (valeur thématique) en priorité, pas n_sondages
      const value = cell.value ?? cell.n_sondages ?? 0;
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

    // Pass 2: contour thématique sombre UNIQUEMENT sur les cellules avec données
    // Objectif: aider à l'identification des cellules colorées sans assombrir toute la grille 2km.
    ctx.globalAlpha = 0.82
    ctx.lineWidth = Math.max(0.45 * scale, 1)
    ctx.strokeStyle = '#0b0f1a'

    let outlineCount = 0
    for (const cell of withDataCells) {
      const geom = cell.geometry
      if (!geom || geom.type !== 'Polygon') continue
      const coords = geom.coordinates?.[0]
      if (!coords || coords.length < 3) continue

      ctx.beginPath()
      const [startX, startY] = toPixel(coords[0][0], coords[0][1])
      ctx.moveTo(startX, startY)
      for (let i = 1; i < coords.length; i++) {
        const [x, y] = toPixel(coords[i][0], coords[i][1])
        ctx.lineTo(x, y)
      }
      ctx.closePath()
      ctx.stroke()
      outlineCount++
    }

    ctx.restore();

    // Log du comptage par classe
    const classCountLog: Record<string, number> = {};
    classUsageCount.forEach((count, idx) => {
      classCountLog[enhancedClasses[idx]?.label || `class${idx}`] = count;
    });
    console.log('[ExportFrame] Colored cells drawn:', drawnCount, 'outlineCount:', outlineCount, 'classUsage:', classCountLog);

    return classUsageCount;
  }

  // ...

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
    const titleHeight = Math.round(24 * scale);

    // Calculer le nombre d'entrées pour la hauteur dynamique
    let numEntries = 0;
    let visibleClasses: Array<{ label: string; color: string; actualCount?: number; index: number }> = [];
    
    if (legendData?.classes && legendData.classes.length > 0) {
      const classesWithCount = legendData.classes.map((cls, idx) => {
        const usageCount = classUsageCount?.get(idx) ?? cls.count ?? undefined;
        return { ...cls, actualCount: usageCount, index: idx, color: this.enhanceExportColor(cls.color) };
      });
      
      visibleClasses = classUsageCount 
        ? classesWithCount.filter(cls => cls.actualCount !== undefined && cls.actualCount > 0)
        : classesWithCount.filter(cls => cls.actualCount === undefined || cls.actualCount > 0);
      
      numEntries = visibleClasses.length > 0 ? visibleClasses.length : 1; // Au moins 1 pour "aucune donnée"
    } else {
      numEntries = 1; // "aucune thématique active"
    }
    
    if (showEmptyCells) numEntries++;
    if (showAdmBoundary) numEntries++;
    
    // Hauteur dynamique: titre + entrées + padding
    const dynamicHeight = titleHeight + (numEntries * lineHeight) + padding * 2;
    // Hauteur minimale = hauteur du layout (pour aligner avec stats/cartouche)
    const actualHeight = Math.max(dynamicHeight, legendArea.height);
    
    console.log('[ExportFrame] Légende hauteur dynamique:', {
      numEntries,
      dynamicHeight,
      layoutHeight: legendArea.height,
      actualHeight
    });
    
    // Cadre de la légende avec hauteur dynamique
    ctx.strokeStyle = '#cccccc';
    ctx.lineWidth = scale;
    ctx.fillStyle = '#fafafa';
    ctx.fillRect(legendArea.x, legendArea.y, legendArea.width, actualHeight);
    ctx.strokeRect(legendArea.x, legendArea.y, legendArea.width, actualHeight);
    
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
    } else if (visibleClasses.length === 0) {
      ctx.fillStyle = '#888888';
      ctx.fillText('(aucune donnée dans la zone)', legendArea.x + padding, currentY);
      currentY += lineHeight;
    } else {
      console.log('[ExportFrame] Légende - classes visibles:', visibleClasses.length, '/', legendData.classes.length,
        'classUsageCount:', classUsageCount ? Object.fromEntries(classUsageCount) : 'N/A');
      
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
    
    // Ajouter une séparation si on a des entrées supplémentaires
    if (showEmptyCells || showAdmBoundary) {
      currentY += Math.round(4 * scale); // Petit espace scalé
    }
    
    // Entrée "Mailles sans données" si activée
    if (showEmptyCells) {
      // Cohérent avec le rendu carte: opacité ÷2
      ctx.fillStyle = 'rgba(200, 200, 200, 0.25)';
      ctx.fillRect(legendArea.x + padding, currentY, boxSize, boxSize);
      ctx.strokeStyle = 'rgba(150, 150, 150, 0.6)';
      ctx.lineWidth = 0.5 * scale;
      ctx.strokeRect(legendArea.x + padding, currentY, boxSize, boxSize);
      
      ctx.fillStyle = '#333333';
      ctx.textBaseline = 'middle';
      ctx.fillText('Sans données', textX, currentY + boxSize / 2);
      currentY += lineHeight;
    }
    
    // Entrée "Délimitation ADM" si activée
    if (showAdmBoundary) {
      // Dessiner une ligne continue noire
      ctx.beginPath();
      ctx.setLineDash([]);
      ctx.strokeStyle = '#000000';
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

  drawStats(stats?: ExportStats): void {
    if (!this.options.includeStats || !stats) return;
    
    const { statsArea } = this.layout;
    const ctx = this.ctx;
    
    // Dimensions scalées pour le DPI
    const scale = this.dpi / 72;
    const basePadding = Math.round(6 * scale);
    const baseHeaderHeight = Math.round(18 * scale);
    const baseLineHeight = Math.round(10 * scale);
    const baseFontSize = Math.round(7 * scale);
    
    // Layout 2 colonnes: 50% label, 50% valeur
    const labelMaxWidth = Math.round((statsArea.width - basePadding * 3) * 0.50);
    const valueX = statsArea.x + statsArea.width - basePadding;

    // Estimer le besoin vertical réel (avec wrap) pour auto-fit
    ctx.save();
    ctx.font = `${baseFontSize}px Arial, sans-serif`;
    let requiredLines = 0;
    requiredLines += stats.subtitle ? 2 : 1;
    for (const row of stats.rows) {
      const labelWithColon = row.label + ' :';
      const labelLines = this.wrapText(ctx, labelWithColon, labelMaxWidth);
      requiredLines += Math.max(1, labelLines.length);
    }
    const requiredHeight = basePadding * 2 + baseHeaderHeight + requiredLines * baseLineHeight;
    const availableHeight = statsArea.height;
    const fit = requiredHeight > 0 ? Math.min(1, availableHeight / requiredHeight) : 1;
    const padding = Math.max(2, Math.floor(basePadding * fit));
    const headerHeight = Math.max(10, Math.floor(baseHeaderHeight * fit));
    const fontSize = Math.max(9, Math.floor(baseFontSize * fit));
    const lineHeight = Math.max(Math.floor(fontSize * 1.35), Math.floor(baseLineHeight * fit));
    ctx.restore();
    
    console.log('[ExportFrame] drawStats 2-col layout:', {
      statsArea,
      labelMaxWidth,
      rowCount: stats.rows.length,
      autoFit: { fit: Number(fit.toFixed(3)), requiredHeight: Math.round(requiredHeight), availableHeight }
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
      ctx.font = `${fontSize}px Arial, sans-serif`;
      ctx.fillStyle = '#666666';
      const subtitleY = statsArea.y + padding + Math.round(fontSize * 1.2);
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
  
  /**
   * Exporte en Blob avec métadonnées DPI correctes (v3.4.4)
   * Injecte le chunk pHYs dans le PNG pour définir la résolution physique
   * 
   * @param targetDpi DPI cible (défaut: 300 pour impression)
   */
  async toBlobWithDpi(targetDpi: number = 300): Promise<Blob> {
    const originalBlob = await this.toBlob('image/png');
    try {
      const injectedBlob = await injectPngDpiMetadata(originalBlob, targetDpi);

      const validation = await validatePngBlob(injectedBlob);
      if (!validation.valid) {
        console.warn('[DPI] Validation PNG injecté FAIL, fallback sur PNG original', {
          targetDpi,
          originalSize: originalBlob.size,
          injectedSize: injectedBlob.size,
          returnSize: originalBlob.size,
          validation
        });
        return originalBlob;
      }

      console.log('[DPI] Validation PNG injecté OK', {
        targetDpi,
        originalSize: originalBlob.size,
        injectedSize: injectedBlob.size,
        returnSize: injectedBlob.size,
        validation
      });
      return injectedBlob;
    } catch (e) {
      console.warn('[DPI] Injection/validation error, fallback sur PNG original', {
        targetDpi,
        originalSize: originalBlob.size,
        error: e instanceof Error ? e.message : String(e)
      })
      return originalBlob
    }
  }
}

// ============================================================================
// Utilitaire pour injecter les métadonnées DPI dans un PNG
// ============================================================================

/**
 * Injecte le chunk pHYs dans un PNG pour définir la résolution physique
 * Le chunk pHYs contient: pixels par unité X, pixels par unité Y, unité (1 = mètre)
 * 
 * 300 DPI = 11811 pixels/mètre (300 / 25.4 * 1000)
 * 150 DPI = 5906 pixels/mètre
 * 72 DPI = 2835 pixels/mètre
 */
export async function injectPngDpiMetadata(pngBlob: Blob, dpi: number): Promise<Blob> {
  const buffer = await pngBlob.arrayBuffer();
  const data = new Uint8Array(buffer);
  
  // Vérifier la signature PNG
  const pngSignature = [137, 80, 78, 71, 13, 10, 26, 10];
  for (let i = 0; i < 8; i++) {
    if (data[i] !== pngSignature[i]) {
      console.warn('[DPI] Fichier non PNG, retour sans modification');
      return pngBlob;
    }
  }
  
  // Calculer pixels par mètre
  const pixelsPerMeter = Math.round(dpi / 25.4 * 1000);
  
  // Créer le chunk pHYs (9 bytes de données)
  // Format: 4 bytes X ppm, 4 bytes Y ppm, 1 byte unit (1 = meter)
  const physData = new Uint8Array(9);
  const physView = new DataView(physData.buffer);
  physView.setUint32(0, pixelsPerMeter, false); // Big-endian
  physView.setUint32(4, pixelsPerMeter, false);
  physData[8] = 1; // Unit = meter
  
  // Calculer le CRC du chunk pHYs
  const physType = new Uint8Array([112, 72, 89, 115]); // 'pHYs'
  const physCrcData = new Uint8Array(4 + 9);
  physCrcData.set(physType, 0);
  physCrcData.set(physData, 4);
  const physCrc = crc32Png(physCrcData);
  
  // Construire le chunk complet (length + type + data + crc)
  const physChunk = new Uint8Array(4 + 4 + 9 + 4);
  const physChunkView = new DataView(physChunk.buffer);
  physChunkView.setUint32(0, 9, false); // Length
  physChunk.set(physType, 4);
  physChunk.set(physData, 8);
  physChunkView.setUint32(17, physCrc, false);
  
  // Trouver la position après IHDR pour insérer pHYs
  // IHDR est toujours le premier chunk après la signature (8 bytes)
  let pos = 8;
  
  // Lire la longueur du chunk IHDR
  const ihdrLength = new DataView(data.buffer).getUint32(pos, false);
  pos += 4 + 4 + ihdrLength + 4; // length + type + data + crc
  
  // Vérifier si pHYs existe déjà et le supprimer
  let newData = data;
  let insertPos = pos;
  
  while (pos < data.length - 12) {
    const chunkLength = new DataView(data.buffer).getUint32(pos, false);
    const chunkType = String.fromCharCode(data[pos + 4], data[pos + 5], data[pos + 6], data[pos + 7]);
    
    if (chunkType === 'pHYs') {
      // Supprimer le chunk existant
      const before = data.slice(0, pos);
      const after = data.slice(pos + 4 + 4 + chunkLength + 4);
      newData = new Uint8Array(before.length + after.length);
      newData.set(before, 0);
      newData.set(after, before.length);
      insertPos = pos;
      break;
    }
    
    if (chunkType === 'IDAT' || chunkType === 'IEND') {
      // Insérer avant IDAT ou IEND
      insertPos = pos;
      break;
    }
    
    pos += 4 + 4 + chunkLength + 4;
  }
  
  // Insérer le nouveau chunk pHYs
  const result = new Uint8Array(newData.length + physChunk.length);
  result.set(newData.slice(0, insertPos), 0);
  result.set(physChunk, insertPos);
  result.set(newData.slice(insertPos), insertPos + physChunk.length);
  
  console.log('[DPI] Métadonnées PNG injectées:', {
    dpi,
    pixelsPerMeter,
    originalSize: data.length,
    newSize: result.length
  });
  
  return new Blob([result], { type: 'image/png' });
}

async function validatePngBlob(blob: Blob): Promise<{ valid: boolean; blackRatio: number; whiteRatio: number; transparentRatio: number; uniformRatio: number; sampleCount: number; decodeOk: boolean }> {
  if (typeof createImageBitmap !== 'function') {
    return {
      valid: true,
      blackRatio: 0,
      whiteRatio: 0,
      transparentRatio: 0,
      uniformRatio: 0,
      sampleCount: 0,
      decodeOk: false
    };
  }

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(blob);
  } catch (e) {
    return {
      valid: false,
      blackRatio: 1,
      whiteRatio: 0,
      transparentRatio: 0,
      uniformRatio: 1,
      sampleCount: 0,
      decodeOk: false
    };
  }

  const width = bitmap.width;
  const height = bitmap.height;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    return {
      valid: false,
      blackRatio: 1,
      whiteRatio: 0,
      transparentRatio: 0,
      uniformRatio: 1,
      sampleCount: 0,
      decodeOk: true
    };
  }

  ctx.drawImage(bitmap, 0, 0);
  bitmap.close();

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

  return {
    valid,
    blackRatio,
    whiteRatio,
    transparentRatio,
    uniformRatio,
    sampleCount: samplePoints.length,
    decodeOk: true
  };
}

/**
 * Calcule le CRC32 pour les chunks PNG (polynôme standard)
 */
function crc32Png(data: Uint8Array): number {
  let crc = 0xFFFFFFFF;
  
  // Table CRC32 pré-calculée (polynôme PNG/ZIP)
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
