export type ExportLayerType = 'adm1' | 'adm2' | 'grid28' | 'grid2'

export interface ExportStrokeStyle {
  strokeStyle: string
  lineWidth: number
  globalAlpha?: number
  lineJoin?: CanvasLineJoin
  lineCap?: CanvasLineCap
  lineDash?: number[]
}

export interface ExportHaloStyle {
  strokeStyle: string
  lineWidth: number
  globalAlpha?: number
  lineJoin?: CanvasLineJoin
  lineCap?: CanvasLineCap
}

export function getExportDpiScale(dpi: number): number {
  if (!Number.isFinite(dpi) || dpi <= 0) return 1
  return dpi / 96
}

export function getExportBaseStroke(dpi: number): number {
  const dpiScale = getExportDpiScale(dpi)
  return 1.2 * dpiScale
}

export function getStrokeStyle(layerType: ExportLayerType, dpi: number): ExportStrokeStyle {
  const base = getExportBaseStroke(dpi)

  if (layerType === 'adm1') {
    return {
      strokeStyle: '#111827',
      lineWidth: base * 1.8,
      globalAlpha: 0.92,
      lineJoin: 'round',
      lineCap: 'round'
    }
  }

  if (layerType === 'adm2') {
    return {
      strokeStyle: '#1f2937',
      lineWidth: base * 1.2,
      globalAlpha: 0.85,
      lineJoin: 'round',
      lineCap: 'round'
    }
  }

  if (layerType === 'grid28') {
    return {
      strokeStyle: '#334155',
      lineWidth: base * 1.8,
      globalAlpha: 0.65,
      lineJoin: 'miter',
      lineCap: 'butt'
    }
  }

  return {
    strokeStyle: '#94a3b8',
    lineWidth: base * 0.55,
    globalAlpha: 0.55,
    lineJoin: 'miter',
    lineCap: 'butt'
  }
}

export function getAdm1HaloStyle(dpi: number): ExportHaloStyle {
  const base = getExportBaseStroke(dpi)
  return {
    strokeStyle: '#ffffff',
    lineWidth: base * 2.6,
    globalAlpha: 0.98,
    lineJoin: 'round',
    lineCap: 'round'
  }
}
