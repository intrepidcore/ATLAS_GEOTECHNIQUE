export type ScreenFeature = {
  properties?: Record<string, any>
  geometry?: any
}

export type AdmCell = {
  geometry: any
  has_data: boolean
  n_sondages?: number
  value?: number
  code?: string
  centroid?: { lat: number; lng: number }
}

export function extractNumericValue(props: Record<string, any>, parameterId?: string): number | undefined {
  const candidates: any[] = []
  if ('value' in props) candidates.push(props.value)
  if (parameterId && parameterId in props) candidates.push(props[parameterId])
  if ('raw_value' in props) candidates.push(props.raw_value)

  for (const c of candidates) {
    if (c == null) continue
    if (typeof c === 'string' && c.trim() === '') continue
    const n = typeof c === 'number' ? c : Number(c)
    if (!Number.isFinite(n)) continue
    return n
  }

  return undefined
}

export function buildThematicCellsFromScreenFeatures(
  screenFeatures: ScreenFeature[],
  parameterId: string | undefined,
  computeCentroid: (geometry: any) => { lat: number; lng: number } | undefined
): AdmCell[] {
  const out: AdmCell[] = []

  for (const f of screenFeatures) {
    const props: any = f.properties || {}
    const geometry = f.geometry
    if (!geometry) continue

    const value = extractNumericValue(props, parameterId)
    const code = props.code || props.grid_id || props.cell_id || props.id
    const centroid = computeCentroid(geometry)

    out.push({
      geometry,
      has_data: value != null,
      n_sondages: props.n_sondages || 0,
      value,
      code: code != null ? String(code) : undefined,
      centroid
    })
  }

  return out
}

export function mergeWithEmptyGrid(
  thematicCells: AdmCell[],
  emptyGridCells: Array<{ cell_id?: string; geometry: any }>
): AdmCell[] {
  const thematicCodes = new Set(thematicCells.map(c => c.code).filter(Boolean) as string[])
  const emptyCells = emptyGridCells
    .filter(cell => !thematicCodes.has(String(cell.cell_id)))
    .map(cell => ({
      geometry: cell.geometry,
      has_data: false,
      n_sondages: 0,
      value: undefined
    }))

  return [...thematicCells, ...emptyCells]
}
