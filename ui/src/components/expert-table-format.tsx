/** Affichage table DB expert : JSONB / objets API → ReactNode (évite `[object Object]`). */
import type React from 'react'
import { Badge } from '@/components/ui/badge'

export function formatExpertTableCell(value: unknown): string {
  if (value === null || value === undefined) return '—'
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value)
  }
  if (value instanceof Date) return value.toISOString()
  try {
    return JSON.stringify(value)
  } catch {
    return String(value)
  }
}

export function renderCell(value: unknown): React.ReactNode {
  if (value === null || value === undefined)
    return <span className="text-muted-foreground">—</span>
  if (typeof value === 'boolean')
    return value
      ? <Badge variant="success">✓ Oui</Badge>
      : <Badge variant="secondary">✗ Non</Badge>
  if (typeof value === 'number')
    return Number.isInteger(value) ? String(value) : value.toFixed(4)
  if (typeof value === 'string') return value
  if (value instanceof Date) return value.toISOString()
  if (typeof value === 'object')
    return (
      <pre className="text-xs bg-muted p-1 rounded max-h-20 overflow-auto max-w-xs whitespace-pre-wrap break-words">
        {JSON.stringify(value, null, 2)}
      </pre>
    )
  return String(value)
}

export function statusBadge(status: string): React.ReactNode {
  const s = status?.toLowerCase() ?? ''
  if (s === 'queued') return <Badge variant="warning">queued</Badge>
  if (s === 'running') return <Badge variant="info">running</Badge>
  if (s === 'finished') return <Badge variant="success">finished</Badge>
  if (s === 'failed') return <Badge variant="destructive">failed</Badge>
  return <Badge variant="outline">{status}</Badge>
}

export function qualityBadge(looRmse: number | null, sill: number | null): React.ReactNode {
  if (looRmse == null || sill == null) return <Badge variant="outline">—</Badge>
  const ratio = looRmse / sill
  if (ratio < 0.3) return <Badge variant="success">excellent</Badge>
  if (ratio < 0.5) return <Badge variant="info">bon</Badge>
  return <Badge variant="warning">acceptable</Badge>
}
