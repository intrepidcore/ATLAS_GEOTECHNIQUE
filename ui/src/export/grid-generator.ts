/**
 * Générateur de grille automatique pour exports cartographiques
 * Atlas Géotechnique v3.0
 */

import {
  BBox,
  GridLine,
  GridOptions,
  GridType,
  ScrCode,
  SCR_DEFINITIONS,
  FrameStyle
} from './export-types';

// ============================================================================
// Calcul du pas de grille optimal (algorithme "nice step")
// ============================================================================

/**
 * Calcule un pas "propre" en normalisant en 10^n × {1, 2, 5}
 * Exemples: 0.037 → 0.05, 0.12 → 0.2, 2300 → 2000, 6100 → 10000
 */
export function niceStep(rawStep: number): number {
  if (rawStep <= 0) return 1;
  
  // Trouver l'ordre de grandeur (puissance de 10)
  const magnitude = Math.pow(10, Math.floor(Math.log10(rawStep)));
  
  // Normaliser le pas par rapport à l'ordre de grandeur
  const normalized = rawStep / magnitude;
  
  // Choisir le multiplicateur "propre" le plus proche (1, 2, 5, 10)
  let niceMultiplier: number;
  if (normalized <= 1) {
    niceMultiplier = 1;
  } else if (normalized <= 2) {
    niceMultiplier = 2;
  } else if (normalized <= 5) {
    niceMultiplier = 5;
  } else {
    niceMultiplier = 10;
  }
  
  return magnitude * niceMultiplier;
}

/**
 * Calcule le pas de grille optimal pour une dimension donnée
 * Utilise l'algorithme "nice step" puis vérifie contre les pas prédéfinis
 */
export function computeOptimalStep(
  dimension: number,
  targetDivisions: number,
  niceSteps: number[]
): number {
  const rawStep = dimension / targetDivisions;
  
  // Calculer un pas "propre" via l'algorithme nice step
  const calculatedNiceStep = niceStep(rawStep);
  
  // Vérifier si ce pas est dans la liste des pas prédéfinis
  // Sinon, trouver le plus proche dans la liste
  for (const step of niceSteps) {
    if (step >= calculatedNiceStep * 0.8) {
      return step;
    }
  }
  
  // Si aucun pas ne convient, utiliser le pas calculé
  return calculatedNiceStep;
}

/**
 * Vérifie que le nombre de lignes ne dépasse pas un maximum
 */
export function adjustStepForMaxLines(
  step: number,
  dimension: number,
  maxLines: number,
  niceSteps: number[]
): number {
  const numLines = Math.floor(dimension / step);
  
  if (numLines <= maxLines) {
    return step;
  }
  
  // Trouver un pas plus grand
  const currentIndex = niceSteps.indexOf(step);
  if (currentIndex >= 0 && currentIndex < niceSteps.length - 1) {
    return adjustStepForMaxLines(
      niceSteps[currentIndex + 1],
      dimension,
      maxLines,
      niceSteps
    );
  }
  
  return step;
}

// ============================================================================
// Génération des lignes de grille
// ============================================================================

export interface GridGeneratorInput {
  bbox: BBox;
  mapWidth: number;
  mapHeight: number;
  options: GridOptions;
}

export interface GridGeneratorOutput {
  stepX: number;
  stepY: number;
  linesX: GridLine[];
  linesY: GridLine[];
}

/**
 * Génère les lignes de grille pour une bbox donnée
 */
export function generateGridLines(input: GridGeneratorInput): GridGeneratorOutput {
  const { bbox, mapWidth, mapHeight, options } = input;
  const scrDef = SCR_DEFINITIONS[options.scr];
  
  const bboxWidth = bbox.maxX - bbox.minX;
  const bboxHeight = bbox.maxY - bbox.minY;
  
  // Calculer les pas
  let stepX = options.customStepX ?? computeOptimalStep(
    bboxWidth,
    options.targetDivisions,
    scrDef.niceSteps
  );
  
  let stepY = options.customStepY ?? computeOptimalStep(
    bboxHeight,
    options.targetDivisions,
    scrDef.niceSteps
  );
  
  // Ajuster si trop de lignes
  stepX = adjustStepForMaxLines(stepX, bboxWidth, 10, scrDef.niceSteps);
  stepY = adjustStepForMaxLines(stepY, bboxHeight, 10, scrDef.niceSteps);
  
  // Générer les lignes verticales (X constant)
  const linesX: GridLine[] = [];
  const firstX = Math.ceil(bbox.minX / stepX) * stepX;
  for (let x = firstX; x <= bbox.maxX; x += stepX) {
    const pixelPos = ((x - bbox.minX) / bboxWidth) * mapWidth;
    linesX.push({
      value: x,
      axis: 'x',
      pixelPos,
      label: scrDef.formatCoord(x, 'x')
    });
  }
  
  // Générer les lignes horizontales (Y constant)
  const linesY: GridLine[] = [];
  const firstY = Math.ceil(bbox.minY / stepY) * stepY;
  for (let y = firstY; y <= bbox.maxY; y += stepY) {
    // Inverser Y car les pixels vont de haut en bas
    const pixelPos = mapHeight - ((y - bbox.minY) / bboxHeight) * mapHeight;
    linesY.push({
      value: y,
      axis: 'y',
      pixelPos,
      label: scrDef.formatCoord(y, 'y')
    });
  }
  
  return { stepX, stepY, linesX, linesY };
}

// ============================================================================
// Rendu de la grille sur un canvas
// ============================================================================

export interface GridRenderOptions {
  ctx: CanvasRenderingContext2D;
  mapArea: { x: number; y: number; width: number; height: number };
  gridOutput: GridGeneratorOutput;
  gridType: GridType;
  showLabels: boolean;
  labelSides: GridOptions['labelSides'];
  labelMargin: number;
  dpi?: number; // DPI pour scaler les éléments (défaut: 72)
}

/**
 * Dessine la grille sur un canvas 2D
 */
export function renderGrid(opts: GridRenderOptions): void {
  const { ctx, mapArea, gridOutput, gridType, showLabels, labelSides, labelMargin, dpi = 72 } = opts;
  const { linesX, linesY } = gridOutput;
  const scale = dpi / 72;
  
  if (gridType === 'none') return;
  
  ctx.save();
  
  // Style de base pour la grille (scalé)
  ctx.strokeStyle = '#888888';
  ctx.lineWidth = 0.5 * scale;
  ctx.setLineDash([]);
  
  // Dessiner selon le type
  if (gridType === 'cross') {
    renderCrossGrid(ctx, mapArea, linesX, linesY, scale);
  } else if (gridType === 'continuous') {
    renderContinuousGrid(ctx, mapArea, linesX, linesY, scale);
  }
  // 'labels-only' ne dessine pas de lignes
  
  // Dessiner les labels si demandé
  if (showLabels) {
    renderGridLabels(ctx, mapArea, linesX, linesY, labelSides, labelMargin, scale);
  }
  
  ctx.restore();
}

/**
 * Dessine une grille en croix
 */
function renderCrossGrid(
  ctx: CanvasRenderingContext2D,
  mapArea: { x: number; y: number; width: number; height: number },
  linesX: GridLine[],
  linesY: GridLine[],
  scale: number = 1
): void {
  const crossSize = Math.round(6 * scale); // demi-longueur de la croix scalée
  
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; // Noir 60% opacité (plus visible)
  ctx.lineWidth = 1.5 * scale; // Épaisseur scalée
  
  // Pour chaque intersection
  for (const lineX of linesX) {
    for (const lineY of linesY) {
      const x = mapArea.x + lineX.pixelPos;
      const y = mapArea.y + lineY.pixelPos;
      
      // Vérifier que le point est dans la zone carte
      if (x >= mapArea.x && x <= mapArea.x + mapArea.width &&
          y >= mapArea.y && y <= mapArea.y + mapArea.height) {
        // Trait horizontal
        ctx.beginPath();
        ctx.moveTo(x - crossSize, y);
        ctx.lineTo(x + crossSize, y);
        ctx.stroke();
        
        // Trait vertical
        ctx.beginPath();
        ctx.moveTo(x, y - crossSize);
        ctx.lineTo(x, y + crossSize);
        ctx.stroke();
      }
    }
  }
}

/**
 * Dessine une grille continue
 */
function renderContinuousGrid(
  ctx: CanvasRenderingContext2D,
  mapArea: { x: number; y: number; width: number; height: number },
  linesX: GridLine[],
  linesY: GridLine[],
  scale: number = 1
): void {
  ctx.strokeStyle = 'rgba(0, 0, 0, 0.6)'; // Noir 60% opacité (plus visible)
  ctx.lineWidth = 1.0 * scale; // Épaisseur scalée
  
  // Lignes verticales
  for (const line of linesX) {
    const x = mapArea.x + line.pixelPos;
    if (x >= mapArea.x && x <= mapArea.x + mapArea.width) {
      ctx.beginPath();
      ctx.moveTo(x, mapArea.y);
      ctx.lineTo(x, mapArea.y + mapArea.height);
      ctx.stroke();
    }
  }
  
  // Lignes horizontales
  for (const line of linesY) {
    const y = mapArea.y + line.pixelPos;
    if (y >= mapArea.y && y <= mapArea.y + mapArea.height) {
      ctx.beginPath();
      ctx.moveTo(mapArea.x, y);
      ctx.lineTo(mapArea.x + mapArea.width, y);
      ctx.stroke();
    }
  }
}

/**
 * Dessine les labels de coordonnées autour du cadre
 */
function renderGridLabels(
  ctx: CanvasRenderingContext2D,
  mapArea: { x: number; y: number; width: number; height: number },
  linesX: GridLine[],
  linesY: GridLine[],
  labelSides: GridOptions['labelSides'],
  labelMargin: number,
  scale: number = 1
): void {
  ctx.fillStyle = '#333333';
  const fontSize = Math.round(10 * scale);
  ctx.font = `${fontSize}px Arial, sans-serif`;
  
  // Labels X (haut et bas)
  for (const line of linesX) {
    const x = mapArea.x + line.pixelPos;
    if (x < mapArea.x || x > mapArea.x + mapArea.width) continue;
    
    ctx.textAlign = 'center';
    
    // Label en haut
    if (labelSides.top) {
      ctx.textBaseline = 'bottom';
      ctx.fillText(line.label, x, mapArea.y - labelMargin);
    }
    
    // Label en bas
    if (labelSides.bottom) {
      ctx.textBaseline = 'top';
      ctx.fillText(line.label, x, mapArea.y + mapArea.height + labelMargin);
    }
  }
  
  // Labels Y (gauche et droite)
  for (const line of linesY) {
    const y = mapArea.y + line.pixelPos;
    if (y < mapArea.y || y > mapArea.y + mapArea.height) continue;
    
    ctx.textBaseline = 'middle';
    
    // Label à gauche
    if (labelSides.left) {
      ctx.textAlign = 'right';
      ctx.fillText(line.label, mapArea.x - labelMargin, y);
    }
    
    // Label à droite
    if (labelSides.right) {
      ctx.textAlign = 'left';
      ctx.fillText(line.label, mapArea.x + mapArea.width + labelMargin, y);
    }
  }
}

// ============================================================================
// Rendu du cadre
// ============================================================================

export interface FrameRenderOptions {
  ctx: CanvasRenderingContext2D;
  mapArea: { x: number; y: number; width: number; height: number };
  style: FrameStyle;
  color?: string;
  thickness?: number;
}

/**
 * Dessine le cadre autour de la zone carte
 */
export function renderFrame(opts: FrameRenderOptions): void {
  const { ctx, mapArea, style, color = '#000000', thickness = 2 } = opts;
  
  if (style === 'none') return;
  
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = thickness;
  ctx.setLineDash([]);
  
  const { x, y, width, height } = mapArea;
  
  switch (style) {
    case 'simple':
      ctx.strokeRect(x, y, width, height);
      break;
      
    case 'double':
      // Cadre extérieur
      ctx.strokeRect(x - 3, y - 3, width + 6, height + 6);
      // Cadre intérieur
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, height);
      break;
      
    case 'zebra':
      renderZebraFrame(ctx, mapArea, thickness);
      break;
  }
  
  ctx.restore();
}

/**
 * Dessine un cadre zébré (style QGIS)
 */
function renderZebraFrame(
  ctx: CanvasRenderingContext2D,
  mapArea: { x: number; y: number; width: number; height: number },
  thickness: number
): void {
  const segmentLength = 20; // pixels
  const { x, y, width, height } = mapArea;
  
  // Fonction pour dessiner un segment
  const drawSegment = (
    startX: number, startY: number,
    endX: number, endY: number,
    isBlack: boolean
  ) => {
    ctx.fillStyle = isBlack ? '#000000' : '#ffffff';
    
    // Calculer la direction
    const dx = endX - startX;
    const dy = endY - startY;
    const length = Math.sqrt(dx * dx + dy * dy);
    
    if (length === 0) return;
    
    // Normaliser
    const nx = dx / length;
    const ny = dy / length;
    
    // Perpendiculaire
    const px = -ny * thickness / 2;
    const py = nx * thickness / 2;
    
    ctx.beginPath();
    ctx.moveTo(startX + px, startY + py);
    ctx.lineTo(endX + px, endY + py);
    ctx.lineTo(endX - px, endY - py);
    ctx.lineTo(startX - px, startY - py);
    ctx.closePath();
    ctx.fill();
  };
  
  // Dessiner les 4 côtés
  const sides = [
    { start: { x, y }, end: { x: x + width, y }, horizontal: true },
    { start: { x: x + width, y }, end: { x: x + width, y: y + height }, horizontal: false },
    { start: { x: x + width, y: y + height }, end: { x, y: y + height }, horizontal: true },
    { start: { x, y: y + height }, end: { x, y }, horizontal: false }
  ];
  
  for (const side of sides) {
    const dx = side.end.x - side.start.x;
    const dy = side.end.y - side.start.y;
    const sideLength = Math.sqrt(dx * dx + dy * dy);
    const numSegments = Math.ceil(sideLength / segmentLength);
    
    for (let i = 0; i < numSegments; i++) {
      const t1 = i / numSegments;
      const t2 = Math.min((i + 1) / numSegments, 1);
      
      const startX = side.start.x + dx * t1;
      const startY = side.start.y + dy * t1;
      const endX = side.start.x + dx * t2;
      const endY = side.start.y + dy * t2;
      
      drawSegment(startX, startY, endX, endY, i % 2 === 0);
    }
  }
  
  // Cadre noir fin par-dessus
  ctx.strokeStyle = '#000000';
  ctx.lineWidth = 0.5;
  ctx.strokeRect(x - thickness/2, y - thickness/2, width + thickness, height + thickness);
  ctx.strokeRect(x + thickness/2, y + thickness/2, width - thickness, height - thickness);
}
